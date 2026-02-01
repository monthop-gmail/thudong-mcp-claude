#!/usr/bin/env node

/**
 * CSV Importer for Thudong Survey Data
 * Imports WatPaRoiPee-2025.csv into SQLite database
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, insertManyResponses, clearData, getOverview, closeDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CSV file path
const CSV_PATH = join(__dirname, '..', 'data', 'Post-Thudong-Eval', 'WatPaRoiPee-2025.csv');

// Value mappings
const KNOWLEDGE_MORAL_MAP = {
    'มากที่สุด': 5,
    'มาก': 4,
    'ปานกลาง': 3,
    'น้อย': 2,
    'น้อยที่สุด': 1
};

const SATISFACTION_MAP = {
    'พอใจมากที่สุด': 5,
    'พอใจมาก': 4,
    'พอใจปานกลาง': 3,
    'พอใจน้อย': 2,
    'พอใจน้อยที่สุด': 1
};

/**
 * Parse CSV content (handles quoted fields with commas)
 */
function parseCSV(content) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentField.trim());
            currentField = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            currentLine.push(currentField.trim());
            if (currentLine.length > 1 || currentLine[0] !== '') {
                lines.push(currentLine);
            }
            currentLine = [];
            currentField = '';
            if (char === '\r') i++; // Skip \n after \r
        } else if (char !== '\r') {
            currentField += char;
        }
    }

    // Handle last field/line
    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        lines.push(currentLine);
    }

    return lines;
}

/**
 * Convert Likert scale text to integer
 */
function toLikertScore(value, type = 'knowledge') {
    if (!value || value.trim() === '') return null;

    const map = type === 'satisfaction' ? SATISFACTION_MAP : KNOWLEDGE_MORAL_MAP;
    const score = map[value.trim()];

    return score !== undefined ? score : null;
}

/**
 * Parse a single row into database record
 */
function parseRow(row) {
    // Column indices based on CSV structure (0-indexed)
    // 0: ประทับเวลา
    // 1: สถานะ
    // 2-9: ความรู้ (8 cols)
    // 10-17: คุณธรรม (8 cols)
    // 18-23: การจัดงาน (6 cols)
    // 24-29: สิ่งอำนวยความสะดวก (6 cols)
    // 30: ประทับใจ
    // 31: ข้อเสนอแนะ

    return {
        timestamp: row[0] || null,
        respondent_type: row[1] || null,

        // หมวดความรู้
        knowledge_history: toLikertScore(row[2], 'knowledge'),
        knowledge_dharma: toLikertScore(row[3], 'knowledge'),
        knowledge_samadhi: toLikertScore(row[4], 'knowledge'),
        knowledge_thudong: toLikertScore(row[5], 'knowledge'),
        knowledge_benefit: toLikertScore(row[6], 'knowledge'),
        knowledge_chavana: toLikertScore(row[7], 'knowledge'),
        knowledge_daily: toLikertScore(row[8], 'knowledge'),
        knowledge_other: row[9] || null,

        // หมวดคุณธรรม
        moral_metta: toLikertScore(row[10], 'knowledge'),
        moral_reason: toLikertScore(row[11], 'knowledge'),
        moral_responsible: toLikertScore(row[12], 'knowledge'),
        moral_discipline: toLikertScore(row[13], 'knowledge'),
        moral_patience: toLikertScore(row[14], 'knowledge'),
        moral_sacrifice: toLikertScore(row[15], 'knowledge'),
        moral_forgive: toLikertScore(row[16], 'knowledge'),
        moral_other: row[17] || null,

        // หมวดการจัดงาน
        event_schedule: toLikertScore(row[18], 'satisfaction'),
        event_route: toLikertScore(row[19], 'satisfaction'),
        event_mentor: toLikertScore(row[20], 'satisfaction'),
        event_ceremony: toLikertScore(row[21], 'satisfaction'),
        event_speech: toLikertScore(row[22], 'satisfaction'),
        event_objective: toLikertScore(row[23], 'satisfaction'),

        // หมวดสิ่งอำนวยความสะดวก
        facility_pr: toLikertScore(row[24], 'satisfaction'),
        facility_coordinate: toLikertScore(row[25], 'satisfaction'),
        facility_atmosphere: toLikertScore(row[26], 'satisfaction'),
        facility_tent: toLikertScore(row[27], 'satisfaction'),
        facility_food: toLikertScore(row[28], 'satisfaction'),
        facility_bathroom: toLikertScore(row[29], 'satisfaction'),

        // ข้อความอิสระ
        impressed_text: row[30] || null,
        suggestion_text: row[31] || null
    };
}

/**
 * Main import function
 */
async function main() {
    console.log('=== Thudong Survey Data Importer ===\n');
    console.log(`CSV File: ${CSV_PATH}\n`);

    try {
        // Read CSV file
        console.log('Reading CSV file...');
        const content = readFileSync(CSV_PATH, 'utf-8');

        // Parse CSV
        console.log('Parsing CSV...');
        const lines = parseCSV(content);
        console.log(`Total lines: ${lines.length}`);

        // Skip header row
        const header = lines[0];
        const dataRows = lines.slice(1);
        console.log(`Data rows: ${dataRows.length}`);
        console.log(`Columns: ${header.length}\n`);

        // Initialize database
        console.log('Initializing database...');
        initDatabase();

        // Clear existing data
        console.log('Clearing existing data...');
        clearData();

        // Parse and prepare records
        console.log('Parsing records...');
        const records = [];
        let parseErrors = 0;

        for (let i = 0; i < dataRows.length; i++) {
            try {
                const record = parseRow(dataRows[i]);
                records.push(record);
            } catch (err) {
                parseErrors++;
                console.error(`Error parsing row ${i + 2}: ${err.message}`);
            }
        }

        console.log(`Parsed: ${records.length} records`);
        if (parseErrors > 0) {
            console.log(`Parse errors: ${parseErrors}`);
        }

        // Insert records
        console.log('\nInserting into database...');
        const inserted = insertManyResponses(records);
        console.log(`Inserted: ${inserted} records`);

        // Show overview
        console.log('\n=== Import Summary ===');
        const overview = getOverview();
        console.log(`Total responses: ${overview.total_responses}`);
        console.log('\nBy respondent type:');
        for (const item of overview.by_respondent_type) {
            console.log(`  - ${item.respondent_type}: ${item.count}`);
        }
        console.log(`\nWith impressed text: ${overview.with_impressed_text}`);
        console.log(`With suggestion text: ${overview.with_suggestion_text}`);

        console.log('\n=== Import Complete ===');

    } catch (err) {
        console.error('Import failed:', err);
        process.exit(1);
    } finally {
        closeDb();
    }
}

main();
