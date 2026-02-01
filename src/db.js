/**
 * Database module for Thudong Survey RAG
 * SQLite with FTS5 for Thai text search
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'db', 'thudong.db');

let db = null;

/**
 * Initialize database with schema
 */
export function initDatabase() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Create main responses table
    db.exec(`
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            respondent_type TEXT,

            -- หมวดความรู้ (1-5 scale)
            knowledge_history INTEGER,
            knowledge_dharma INTEGER,
            knowledge_samadhi INTEGER,
            knowledge_thudong INTEGER,
            knowledge_benefit INTEGER,
            knowledge_chavana INTEGER,
            knowledge_daily INTEGER,
            knowledge_other TEXT,

            -- หมวดคุณธรรม (1-5 scale)
            moral_metta INTEGER,
            moral_reason INTEGER,
            moral_responsible INTEGER,
            moral_discipline INTEGER,
            moral_patience INTEGER,
            moral_sacrifice INTEGER,
            moral_forgive INTEGER,
            moral_other TEXT,

            -- หมวดการจัดงาน (1-5 scale)
            event_schedule INTEGER,
            event_route INTEGER,
            event_mentor INTEGER,
            event_ceremony INTEGER,
            event_speech INTEGER,
            event_objective INTEGER,

            -- หมวดสิ่งอำนวยความสะดวก (1-5 scale)
            facility_pr INTEGER,
            facility_coordinate INTEGER,
            facility_atmosphere INTEGER,
            facility_tent INTEGER,
            facility_food INTEGER,
            facility_bathroom INTEGER,

            -- ข้อความอิสระ
            impressed_text TEXT,
            suggestion_text TEXT
        )
    `);

    // Create FTS5 virtual table for text search
    db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS responses_fts USING fts5(
            impressed_text,
            suggestion_text,
            content='responses',
            content_rowid='id',
            tokenize='unicode61 remove_diacritics 2'
        )
    `);

    // Triggers to keep FTS in sync
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS responses_ai AFTER INSERT ON responses BEGIN
            INSERT INTO responses_fts(rowid, impressed_text, suggestion_text)
            VALUES (new.id, new.impressed_text, new.suggestion_text);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS responses_ad AFTER DELETE ON responses BEGIN
            INSERT INTO responses_fts(responses_fts, rowid, impressed_text, suggestion_text)
            VALUES ('delete', old.id, old.impressed_text, old.suggestion_text);
        END
    `);

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS responses_au AFTER UPDATE ON responses BEGIN
            INSERT INTO responses_fts(responses_fts, rowid, impressed_text, suggestion_text)
            VALUES ('delete', old.id, old.impressed_text, old.suggestion_text);
            INSERT INTO responses_fts(rowid, impressed_text, suggestion_text)
            VALUES (new.id, new.impressed_text, new.suggestion_text);
        END
    `);

    // Create indexes for common queries
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_respondent_type ON responses(respondent_type)
    `);

    return db;
}

/**
 * Get database instance
 */
export function getDb() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

/**
 * Insert a response record
 */
export function insertResponse(data) {
    const db = getDb();
    const stmt = db.prepare(`
        INSERT INTO responses (
            timestamp, respondent_type,
            knowledge_history, knowledge_dharma, knowledge_samadhi, knowledge_thudong,
            knowledge_benefit, knowledge_chavana, knowledge_daily, knowledge_other,
            moral_metta, moral_reason, moral_responsible, moral_discipline,
            moral_patience, moral_sacrifice, moral_forgive, moral_other,
            event_schedule, event_route, event_mentor, event_ceremony,
            event_speech, event_objective,
            facility_pr, facility_coordinate, facility_atmosphere,
            facility_tent, facility_food, facility_bathroom,
            impressed_text, suggestion_text
        ) VALUES (
            @timestamp, @respondent_type,
            @knowledge_history, @knowledge_dharma, @knowledge_samadhi, @knowledge_thudong,
            @knowledge_benefit, @knowledge_chavana, @knowledge_daily, @knowledge_other,
            @moral_metta, @moral_reason, @moral_responsible, @moral_discipline,
            @moral_patience, @moral_sacrifice, @moral_forgive, @moral_other,
            @event_schedule, @event_route, @event_mentor, @event_ceremony,
            @event_speech, @event_objective,
            @facility_pr, @facility_coordinate, @facility_atmosphere,
            @facility_tent, @facility_food, @facility_bathroom,
            @impressed_text, @suggestion_text
        )
    `);
    return stmt.run(data);
}

/**
 * Bulk insert responses
 */
export function insertManyResponses(records) {
    const db = getDb();
    const insert = db.transaction((items) => {
        for (const item of items) {
            insertResponse(item);
        }
        return items.length;
    });
    return insert(records);
}

/**
 * Search free text using FTS5
 */
export function searchFeedback(query, type = 'all', limit = 10) {
    const db = getDb();

    let whereClause = '';
    if (type === 'impressed') {
        whereClause = "AND r.impressed_text IS NOT NULL AND r.impressed_text != ''";
    } else if (type === 'suggestion') {
        whereClause = "AND r.suggestion_text IS NOT NULL AND r.suggestion_text != ''";
    }

    const stmt = db.prepare(`
        SELECT
            r.id,
            r.timestamp,
            r.respondent_type,
            r.impressed_text,
            r.suggestion_text,
            bm25(responses_fts) as rank
        FROM responses_fts f
        JOIN responses r ON f.rowid = r.id
        WHERE responses_fts MATCH ?
        ${whereClause}
        ORDER BY rank
        LIMIT ?
    `);

    return stmt.all(query, limit);
}

/**
 * Get statistics for a category
 */
export function getStatistics(category = 'all', respondentType = 'all') {
    const db = getDb();

    const categories = {
        knowledge: ['knowledge_history', 'knowledge_dharma', 'knowledge_samadhi',
                   'knowledge_thudong', 'knowledge_benefit', 'knowledge_chavana', 'knowledge_daily'],
        moral: ['moral_metta', 'moral_reason', 'moral_responsible', 'moral_discipline',
               'moral_patience', 'moral_sacrifice', 'moral_forgive'],
        event: ['event_schedule', 'event_route', 'event_mentor', 'event_ceremony',
               'event_speech', 'event_objective'],
        facility: ['facility_pr', 'facility_coordinate', 'facility_atmosphere',
                  'facility_tent', 'facility_food', 'facility_bathroom']
    };

    const categoryLabels = {
        knowledge_history: 'ประวัติพระอาจารย์หลวงพ่อ',
        knowledge_dharma: 'เกร็ดธรรมะ',
        knowledge_samadhi: 'ความรู้เกี่ยวกับสมาธิ',
        knowledge_thudong: 'ความรู้เกี่ยวกับการธุดงค์',
        knowledge_benefit: 'ประโยชน์ของสมาธิ',
        knowledge_chavana: 'ชวนะจิตในการแก้ปัญหา',
        knowledge_daily: 'การนำสมาธิไปใช้ในชีวิตประจำวัน',
        moral_metta: 'มีเมตตา',
        moral_reason: 'มีเหตุผล',
        moral_responsible: 'มีความรับผิดชอบ',
        moral_discipline: 'มีวินัย',
        moral_patience: 'มีความอดทน',
        moral_sacrifice: 'มีความเสียสละ',
        moral_forgive: 'รู้จักให้อภัย',
        event_schedule: 'กำหนดการ',
        event_route: 'เส้นทางเดินธุดงค์',
        event_mentor: 'พี่เลี้ยง/การกำกับแถว',
        event_ceremony: 'ศาสนพิธี',
        event_speech: 'พิธีกล่าวแสดงความรู้สึก',
        event_objective: 'จัดงานได้ตรงตามวัตถุประสงค์',
        facility_pr: 'การประชาสัมพันธ์',
        facility_coordinate: 'การติดต่อประสานงาน',
        facility_atmosphere: 'บรรยากาศสถานที่',
        facility_tent: 'เต้นท์/ที่พัก',
        facility_food: 'อาหาร เครื่องดื่ม',
        facility_bathroom: 'ห้องอาบน้ำ ห้องสุขา'
    };

    let columnsToQuery = [];
    if (category === 'all') {
        columnsToQuery = [...categories.knowledge, ...categories.moral,
                         ...categories.event, ...categories.facility];
    } else if (categories[category]) {
        columnsToQuery = categories[category];
    }

    let whereClause = '';
    if (respondentType === 'student') {
        whereClause = "WHERE respondent_type = 'นักศึกษาสอบภาคสนาม'";
    } else if (respondentType === 'staff') {
        whereClause = "WHERE respondent_type = 'คณะทำงาน'";
    } else if (respondentType === 'observer') {
        whereClause = "WHERE respondent_type = 'ผู้เข้าร่วมงาน/สังเกตุการณ์'";
    }

    const results = {};

    for (const col of columnsToQuery) {
        const stmt = db.prepare(`
            SELECT
                AVG(${col}) as avg_score,
                COUNT(${col}) as total_responses,
                COUNT(CASE WHEN ${col} = 5 THEN 1 END) as score_5,
                COUNT(CASE WHEN ${col} = 4 THEN 1 END) as score_4,
                COUNT(CASE WHEN ${col} = 3 THEN 1 END) as score_3,
                COUNT(CASE WHEN ${col} = 2 THEN 1 END) as score_2,
                COUNT(CASE WHEN ${col} = 1 THEN 1 END) as score_1
            FROM responses
            ${whereClause}
            ${whereClause ? 'AND' : 'WHERE'} ${col} IS NOT NULL
        `);

        const row = stmt.get();
        if (row && row.total_responses > 0) {
            results[col] = {
                label: categoryLabels[col] || col,
                avg: Math.round(row.avg_score * 100) / 100,
                total: row.total_responses,
                distribution: {
                    'ระดับ 5 (มากที่สุด)': row.score_5,
                    'ระดับ 4 (มาก)': row.score_4,
                    'ระดับ 3 (ปานกลาง)': row.score_3,
                    'ระดับ 2 (น้อย)': row.score_2,
                    'ระดับ 1 (น้อยที่สุด)': row.score_1
                },
                percentage: {
                    'ระดับ 5': Math.round(row.score_5 / row.total_responses * 100 * 10) / 10,
                    'ระดับ 4': Math.round(row.score_4 / row.total_responses * 100 * 10) / 10,
                    'ระดับ 3': Math.round(row.score_3 / row.total_responses * 100 * 10) / 10,
                    'ระดับ 2': Math.round(row.score_2 / row.total_responses * 100 * 10) / 10,
                    'ระดับ 1': Math.round(row.score_1 / row.total_responses * 100 * 10) / 10
                }
            };
        }
    }

    return results;
}

/**
 * Get overview statistics
 */
export function getOverview() {
    const db = getDb();

    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM responses');
    const total = totalStmt.get().count;

    const byTypeStmt = db.prepare(`
        SELECT respondent_type, COUNT(*) as count
        FROM responses
        GROUP BY respondent_type
    `);
    const byType = byTypeStmt.all();

    const impressedStmt = db.prepare(`
        SELECT COUNT(*) as count FROM responses
        WHERE impressed_text IS NOT NULL AND impressed_text != ''
    `);
    const withImpressed = impressedStmt.get().count;

    const suggestionStmt = db.prepare(`
        SELECT COUNT(*) as count FROM responses
        WHERE suggestion_text IS NOT NULL AND suggestion_text != ''
    `);
    const withSuggestion = suggestionStmt.get().count;

    return {
        total_responses: total,
        by_respondent_type: byType,
        with_impressed_text: withImpressed,
        with_suggestion_text: withSuggestion
    };
}

/**
 * Get improvements/suggestions by topic
 */
export function getImprovementsByTopic(topic = null, limit = 20) {
    const db = getDb();

    if (topic) {
        const stmt = db.prepare(`
            SELECT r.id, r.respondent_type, r.suggestion_text
            FROM responses_fts f
            JOIN responses r ON f.rowid = r.id
            WHERE responses_fts MATCH ?
            AND r.suggestion_text IS NOT NULL AND r.suggestion_text != ''
            ORDER BY bm25(responses_fts)
            LIMIT ?
        `);
        return stmt.all(topic, limit);
    } else {
        const stmt = db.prepare(`
            SELECT id, respondent_type, suggestion_text
            FROM responses
            WHERE suggestion_text IS NOT NULL AND suggestion_text != ''
            ORDER BY id
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

/**
 * Get impressions by topic
 */
export function getImpressionsByTopic(topic = null, limit = 20) {
    const db = getDb();

    if (topic) {
        const stmt = db.prepare(`
            SELECT r.id, r.respondent_type, r.impressed_text
            FROM responses_fts f
            JOIN responses r ON f.rowid = r.id
            WHERE responses_fts MATCH ?
            AND r.impressed_text IS NOT NULL AND r.impressed_text != ''
            ORDER BY bm25(responses_fts)
            LIMIT ?
        `);
        return stmt.all(topic, limit);
    } else {
        const stmt = db.prepare(`
            SELECT id, respondent_type, impressed_text
            FROM responses
            WHERE impressed_text IS NOT NULL AND impressed_text != ''
            ORDER BY id
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

/**
 * Compare groups by category
 */
export function compareGroups(category) {
    const db = getDb();

    const categories = {
        event: ['event_schedule', 'event_route', 'event_mentor', 'event_ceremony',
               'event_speech', 'event_objective'],
        facility: ['facility_pr', 'facility_coordinate', 'facility_atmosphere',
                  'facility_tent', 'facility_food', 'facility_bathroom']
    };

    const categoryLabels = {
        event_schedule: 'กำหนดการ',
        event_route: 'เส้นทางเดินธุดงค์',
        event_mentor: 'พี่เลี้ยง/การกำกับแถว',
        event_ceremony: 'ศาสนพิธี',
        event_speech: 'พิธีกล่าวแสดงความรู้สึก',
        event_objective: 'จัดงานได้ตรงตามวัตถุประสงค์',
        facility_pr: 'การประชาสัมพันธ์',
        facility_coordinate: 'การติดต่อประสานงาน',
        facility_atmosphere: 'บรรยากาศสถานที่',
        facility_tent: 'เต้นท์/ที่พัก',
        facility_food: 'อาหาร เครื่องดื่ม',
        facility_bathroom: 'ห้องอาบน้ำ ห้องสุขา'
    };

    const respondentTypes = {
        student: 'นักศึกษาสอบภาคสนาม',
        staff: 'คณะทำงาน',
        observer: 'ผู้เข้าร่วมงาน/สังเกตุการณ์'
    };

    const columns = categories[category] || [];
    const results = {};

    for (const col of columns) {
        results[col] = { label: categoryLabels[col] || col };

        for (const [key, typeName] of Object.entries(respondentTypes)) {
            const stmt = db.prepare(`
                SELECT AVG(${col}) as avg_score
                FROM responses
                WHERE respondent_type = ? AND ${col} IS NOT NULL
            `);
            const row = stmt.get(typeName);
            results[col][key] = row && row.avg_score
                ? Math.round(row.avg_score * 100) / 100
                : null;
        }
    }

    return results;
}

/**
 * Clear all data (for reimport)
 */
export function clearData() {
    const db = getDb();
    db.exec('DELETE FROM responses');
    db.exec('DELETE FROM responses_fts');
    return true;
}

/**
 * Close database connection
 */
export function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

export default {
    initDatabase,
    getDb,
    insertResponse,
    insertManyResponses,
    searchFeedback,
    getStatistics,
    getOverview,
    getImprovementsByTopic,
    getImpressionsByTopic,
    compareGroups,
    clearData,
    closeDb
};
