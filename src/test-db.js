#!/usr/bin/env node

/**
 * Test script for database operations
 */

import {
    initDatabase,
    searchFeedback,
    getStatistics,
    getOverview,
    closeDb
} from './db.js';

console.log('=== Database Test ===\n');

try {
    // Initialize
    initDatabase();

    // Test 1: Overview
    console.log('--- Test 1: Overview ---');
    const overview = getOverview();
    console.log(`Total responses: ${overview.total_responses}`);
    console.log(`With impressed: ${overview.with_impressed_text}`);
    console.log(`With suggestion: ${overview.with_suggestion_text}\n`);

    // Test 2: Search "ห้องน้ำ"
    console.log('--- Test 2: Search "ห้องน้ำ" ---');
    const results1 = searchFeedback('ห้องน้ำ', 'all', 5);
    console.log(`Found: ${results1.length} results`);
    if (results1.length > 0) {
        console.log(`First result (${results1[0].respondent_type}):`);
        console.log(`  Impressed: ${results1[0].impressed_text?.substring(0, 80)}...`);
        console.log(`  Suggestion: ${results1[0].suggestion_text?.substring(0, 80)}...`);
    }
    console.log();

    // Test 3: Search "อาหาร"
    console.log('--- Test 3: Search "อาหาร" ---');
    const results2 = searchFeedback('อาหาร', 'all', 5);
    console.log(`Found: ${results2.length} results`);
    if (results2.length > 0) {
        console.log(`First result: ${results2[0].impressed_text?.substring(0, 80) || results2[0].suggestion_text?.substring(0, 80)}...`);
    }
    console.log();

    // Test 4: Search "พี่เลี้ยง"
    console.log('--- Test 4: Search "พี่เลี้ยง" ---');
    const results3 = searchFeedback('พี่เลี้ยง', 'impressed', 5);
    console.log(`Found: ${results3.length} results (impressed only)`);
    console.log();

    // Test 5: Statistics - facility
    console.log('--- Test 5: Statistics (facility) ---');
    const stats = getStatistics('facility', 'all');
    for (const [key, value] of Object.entries(stats)) {
        console.log(`${value.label}: avg=${value.avg}, n=${value.total}`);
    }
    console.log();

    // Test 6: Statistics - event (students only)
    console.log('--- Test 6: Statistics (event, students) ---');
    const statsStudent = getStatistics('event', 'student');
    for (const [key, value] of Object.entries(statsStudent)) {
        console.log(`${value.label}: avg=${value.avg}, n=${value.total}`);
    }

    console.log('\n=== All Tests Passed ===');

} catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
} finally {
    closeDb();
}
