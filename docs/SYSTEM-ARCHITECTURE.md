# System Architecture: Thudong MCP Server

## Overview

ระบบ MCP Server สำหรับ RAG (Retrieval-Augmented Generation) ข้อมูลแบบสอบถาม "หลังการสอบภาคสนามธุดงค์"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW OVERVIEW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐      ┌──────────────┐      ┌──────────────────────────┐
   │  Google Form │  →   │  CSV Export  │  →   │  SQLite + FTS5 Database  │
   │  (แบบสอบถาม)  │      │  (Raw Data)  │      │  (Structured + Indexed)  │
   └──────────────┘      └──────────────┘      └──────────────────────────┘
                                                          │
                                                          ▼
                               ┌───────────────────────────────────────────┐
                               │            MCP Server                     │
                               │  ┌─────────────────────────────────────┐  │
                               │  │           6 MCP Tools               │  │
                               │  │  • search_feedback (FTS5 Search)   │  │
                               │  │  • get_statistics (SQL Aggregate)  │  │
                               │  │  • get_survey_overview             │  │
                               │  │  • get_improvements                │  │
                               │  │  • get_impressions                 │  │
                               │  │  • compare_groups                  │  │
                               │  └─────────────────────────────────────┘  │
                               └───────────────────────────────────────────┘
                                          │              │
                          ┌───────────────┘              └───────────────┐
                          ▼                                              ▼
                   ┌─────────────┐                              ┌─────────────┐
                   │    stdio    │                              │     SSE     │
                   │  Transport  │                              │  Transport  │
                   └─────────────┘                              └─────────────┘
                          │                                              │
                          ▼                                              ▼
                   ┌─────────────┐                              ┌─────────────┐
                   │ Claude Code │                              │ Web Client  │
                   │    (CLI)    │                              │  (Browser)  │
                   └─────────────┘                              └─────────────┘
```

---

## Phase 1: Data Collection (Google Forms)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE FORMS STRUCTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

 ผู้ตอบแบบสอบถาม (804 คน)
        │
        ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                          แบบสอบถาม 32 คอลัมน์                            │
 │                                                                          │
 │  ┌────────────────────────┐   ┌────────────────────────┐                │
 │  │ Section 1: ข้อมูลผู้ตอบ │   │ Section 2: ความรู้ (8)  │                │
 │  │  • ประทับเวลา          │   │  • ประวัติหลวงพ่อ       │                │
 │  │  • สถานะผู้ตอบ          │   │  • เกร็ดธรรมะ          │                │
 │  │    - นักศึกษา (690)    │   │  • สมาธิ               │                │
 │  │    - คณะทำงาน (105)    │   │  • การธุดงค์           │                │
 │  │    - ผู้สังเกตการณ์ (9) │   │  • ประโยชน์สมาธิ       │                │
 │  └────────────────────────┘   │  • ชวนะจิต             │                │
 │                               │  • นำไปใช้ชีวิตประจำวัน  │                │
 │  ┌────────────────────────┐   │  • อื่นๆ (text)        │                │
 │  │ Section 3: คุณธรรม (8) │   └────────────────────────┘                │
 │  │  • เมตตา              │                                              │
 │  │  • เหตุผล             │   ┌────────────────────────┐                │
 │  │  • รับผิดชอบ          │   │ Section 4: การจัดงาน (6)│                │
 │  │  • วินัย              │   │  • กำหนดการ            │                │
 │  │  • อดทน               │   │  • เส้นทาง             │                │
 │  │  • เสียสละ            │   │  • พี่เลี้ยง           │                │
 │  │  • ให้อภัย            │   │  • ศาสนพิธี            │                │
 │  │  • อื่นๆ (text)       │   │  • พิธีกล่าวความรู้สึก  │                │
 │  └────────────────────────┘   │  • ตรงวัตถุประสงค์     │                │
 │                               └────────────────────────┘                │
 │  ┌────────────────────────┐   ┌────────────────────────┐                │
 │  │ Section 5: สิ่งอำนวย   │   │ Section 6: ข้อความอิสระ │◄── RAG Target │
 │  │  ความสะดวก (6)        │   │  • สิ่งที่ประทับใจ      │                │
 │  │  • ประชาสัมพันธ์       │   │  • ข้อเสนอแนะ/ปรับปรุง │                │
 │  │  • ประสานงาน          │   └────────────────────────┘                │
 │  │  • บรรยากาศ           │                                              │
 │  │  • ที่พัก             │                                              │
 │  │  • อาหาร              │                                              │
 │  │  • ห้องน้ำ            │                                              │
 │  └────────────────────────┘                                              │
 └──────────────────────────────────────────────────────────────────────────┘

 Likert Scale Values:
 ┌──────────────────────────────────┐    ┌──────────────────────────────────┐
 │ ความรู้/คุณธรรม                  │    │ ความพึงพอใจ                      │
 │  มากที่สุด    → 5               │    │  พอใจมากที่สุด  → 5             │
 │  มาก         → 4               │    │  พอใจมาก       → 4             │
 │  ปานกลาง     → 3               │    │  พอใจปานกลาง   → 3             │
 │  น้อย        → 2               │    │  พอใจน้อย      → 2             │
 │  น้อยที่สุด   → 1               │    │  พอใจน้อยที่สุด → 1             │
 └──────────────────────────────────┘    └──────────────────────────────────┘
```

---

## Phase 2: Data Import (CSV → SQLite)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMPORT PROCESS (import.js)                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    data/Post-Thudong-Eval/WatPaRoiPee-2025.csv         │
  │                              (Raw CSV File)                             │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           STEP 1: Read CSV                              │
  │                                                                         │
  │   const content = readFileSync(CSV_PATH, 'utf-8');                     │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         STEP 2: Parse CSV                               │
  │                                                                         │
  │   function parseCSV(content) {                                         │
  │     • Handle quoted fields with commas                                 │
  │     • Handle escaped quotes ("")                                       │
  │     • Handle newlines within quotes                                    │
  │     • Return array of arrays                                           │
  │   }                                                                    │
  │                                                                         │
  │   Output: [[col1, col2, ...], [row1], [row2], ...]                    │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    STEP 3: Transform to Records                         │
  │                                                                         │
  │   function parseRow(row) {                                             │
  │     return {                                                           │
  │       timestamp: row[0],                                               │
  │       respondent_type: row[1],                                         │
  │       knowledge_history: toLikertScore(row[2]),  // "มากที่สุด" → 5   │
  │       knowledge_dharma: toLikertScore(row[3]),                         │
  │       ...                                                              │
  │       impressed_text: row[30],    // Free text                        │
  │       suggestion_text: row[31]    // Free text                        │
  │     }                                                                  │
  │   }                                                                    │
  │                                                                         │
  │   function toLikertScore(value, type) {                               │
  │     • Map Thai text to integer (1-5)                                   │
  │     • Return null for empty values                                     │
  │   }                                                                    │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      STEP 4: Bulk Insert                                │
  │                                                                         │
  │   const inserted = insertManyResponses(records);                       │
  │                                                                         │
  │   • Uses transaction for performance                                   │
  │   • Triggers auto-populate FTS5 index                                  │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          db/thudong.db                                  │
  │                         (SQLite Database)                               │
  └─────────────────────────────────────────────────────────────────────────┘


  Command: npm run import
```

---

## Phase 3: Database Schema (SQLite + FTS5)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATABASE SCHEMA (db.js)                            │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        TABLE: responses (Main)                          │
  │                                                                         │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │ id                  INTEGER PRIMARY KEY AUTOINCREMENT           │   │
  │  │ timestamp           TEXT                                        │   │
  │  │ respondent_type     TEXT (นักศึกษา/คณะทำงาน/ผู้สังเกตการณ์)      │   │
  │  ├─────────────────────────────────────────────────────────────────┤   │
  │  │ knowledge_history   INTEGER (1-5)   ┐                           │   │
  │  │ knowledge_dharma    INTEGER (1-5)   │                           │   │
  │  │ knowledge_samadhi   INTEGER (1-5)   │ หมวดความรู้                │   │
  │  │ knowledge_thudong   INTEGER (1-5)   │ (เฉพาะนักศึกษา)            │   │
  │  │ knowledge_benefit   INTEGER (1-5)   │                           │   │
  │  │ knowledge_chavana   INTEGER (1-5)   │                           │   │
  │  │ knowledge_daily     INTEGER (1-5)   │                           │   │
  │  │ knowledge_other     TEXT            ┘                           │   │
  │  ├─────────────────────────────────────────────────────────────────┤   │
  │  │ moral_metta         INTEGER (1-5)   ┐                           │   │
  │  │ moral_reason        INTEGER (1-5)   │                           │   │
  │  │ moral_responsible   INTEGER (1-5)   │ หมวดคุณธรรม               │   │
  │  │ moral_discipline    INTEGER (1-5)   │ (เฉพาะนักศึกษา)            │   │
  │  │ moral_patience      INTEGER (1-5)   │                           │   │
  │  │ moral_sacrifice     INTEGER (1-5)   │                           │   │
  │  │ moral_forgive       INTEGER (1-5)   │                           │   │
  │  │ moral_other         TEXT            ┘                           │   │
  │  ├─────────────────────────────────────────────────────────────────┤   │
  │  │ event_schedule      INTEGER (1-5)   ┐                           │   │
  │  │ event_route         INTEGER (1-5)   │                           │   │
  │  │ event_mentor        INTEGER (1-5)   │ หมวดการจัดงาน             │   │
  │  │ event_ceremony      INTEGER (1-5)   │ (ทุกกลุ่ม)                 │   │
  │  │ event_speech        INTEGER (1-5)   │                           │   │
  │  │ event_objective     INTEGER (1-5)   ┘                           │   │
  │  ├─────────────────────────────────────────────────────────────────┤   │
  │  │ facility_pr         INTEGER (1-5)   ┐                           │   │
  │  │ facility_coordinate INTEGER (1-5)   │                           │   │
  │  │ facility_atmosphere INTEGER (1-5)   │ หมวดสิ่งอำนวยความสะดวก    │   │
  │  │ facility_tent       INTEGER (1-5)   │ (ทุกกลุ่ม)                 │   │
  │  │ facility_food       INTEGER (1-5)   │                           │   │
  │  │ facility_bathroom   INTEGER (1-5)   ┘                           │   │
  │  ├─────────────────────────────────────────────────────────────────┤   │
  │  │ impressed_text      TEXT ◄──────────┐ ข้อความอิสระ (RAG)        │   │
  │  │ suggestion_text     TEXT ◄──────────┘                           │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  │                                                                         │
  │  INDEX: idx_respondent_type ON responses(respondent_type)              │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ FTS5 Sync Triggers
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                  VIRTUAL TABLE: responses_fts (FTS5)                    │
  │                                                                         │
  │  CREATE VIRTUAL TABLE responses_fts USING fts5(                        │
  │      impressed_text,                                                    │
  │      suggestion_text,                                                   │
  │      content='responses',                                               │
  │      content_rowid='id',                                                │
  │      tokenize='unicode61 remove_diacritics 2'  ◄── Thai support        │
  │  );                                                                     │
  │                                                                         │
  │  ┌─────────────────────────────────────────────────────────────────┐   │
  │  │                     AUTO-SYNC TRIGGERS                          │   │
  │  │                                                                  │   │
  │  │  • responses_ai: AFTER INSERT → Insert into FTS                │   │
  │  │  • responses_ad: AFTER DELETE → Delete from FTS                │   │
  │  │  • responses_au: AFTER UPDATE → Delete old + Insert new        │   │
  │  └─────────────────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: MCP Server Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MCP SERVER (index.js)                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         INITIALIZATION                                   │
  │                                                                         │
  │   import { Server } from '@modelcontextprotocol/sdk/server/index.js';  │
  │   import { StdioServerTransport } from '...stdio.js';                  │
  │   import { initDatabase, ... } from './db.js';                         │
  │                                                                         │
  │   initDatabase();  // Connect to SQLite                                │
  │                                                                         │
  │   const server = new Server({                                          │
  │     name: 'thudong-mcp-claude',                                        │
  │     version: '1.0.0',                                                  │
  │   }, {                                                                  │
  │     capabilities: { tools: {} }                                        │
  │   });                                                                   │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                          TOOL DEFINITIONS                               │
  │                                                                         │
  │   const TOOLS = [                                                       │
  │     {                                                                   │
  │       name: 'search_feedback',                                         │
  │       description: '...',                                              │
  │       inputSchema: {                                                   │
  │         type: 'object',                                                │
  │         properties: {                                                  │
  │           query: { type: 'string', description: '...' },              │
  │           type: { enum: ['impressed', 'suggestion', 'all'] },         │
  │           limit: { type: 'number', default: 10 }                      │
  │         },                                                             │
  │         required: ['query']                                            │
  │       }                                                                │
  │     },                                                                  │
  │     // ... 5 more tools                                                │
  │   ];                                                                    │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        REQUEST HANDLERS                                  │
  │                                                                         │
  │   // List available tools                                              │
  │   server.setRequestHandler(ListToolsRequestSchema, async () => {       │
  │     return { tools: TOOLS };                                           │
  │   });                                                                   │
  │                                                                         │
  │   // Execute tool calls                                                │
  │   server.setRequestHandler(CallToolRequestSchema, async (request) => { │
  │     const { name, arguments: args } = request.params;                  │
  │                                                                         │
  │     switch (name) {                                                    │
  │       case 'search_feedback':                                          │
  │         return formatResults(searchFeedback(args.query, ...));        │
  │       case 'get_statistics':                                           │
  │         return formatStats(getStatistics(args.category, ...));        │
  │       // ...                                                           │
  │     }                                                                   │
  │   });                                                                   │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           TRANSPORT                                      │
  │                                                                         │
  │   // STDIO Transport (for Claude Code CLI)                             │
  │   const transport = new StdioServerTransport();                        │
  │   await server.connect(transport);                                      │
  │                                                                         │
  │   // SSE Transport (for Web Clients) - server-sse.js                   │
  │   const transport = new SSEServerTransport('/message', res);           │
  │   await server.connect(transport);                                      │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: MCP Tools Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            6 MCP TOOLS                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  TOOL 1: search_feedback                                                  │
│  ─────────────────────────────────────────────────────────────────────── │
│  Purpose: ค้นหาข้อความด้วย Full-Text Search (FTS5)                       │
│                                                                           │
│  Input:                                                                   │
│    • query: string (required) - คำค้นหา                                  │
│    • type: "impressed" | "suggestion" | "all"                            │
│    • limit: number (default: 10)                                         │
│                                                                           │
│  Process:                                                                 │
│    SELECT r.*, bm25(responses_fts) as rank                               │
│    FROM responses_fts f                                                   │
│    JOIN responses r ON f.rowid = r.id                                    │
│    WHERE responses_fts MATCH ?  ◄── FTS5 full-text query                │
│    ORDER BY rank                 ◄── BM25 relevance scoring             │
│    LIMIT ?                                                               │
│                                                                           │
│  Output: Formatted markdown with ranked results                          │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  TOOL 2: get_statistics                                                   │
│  ─────────────────────────────────────────────────────────────────────── │
│  Purpose: สรุปสถิติความพึงพอใจรายหมวด                                    │
│                                                                           │
│  Input:                                                                   │
│    • category: "knowledge" | "moral" | "event" | "facility" | "all"      │
│    • respondent_type: "student" | "staff" | "observer" | "all"           │
│                                                                           │
│  Process:                                                                 │
│    SELECT AVG(column), COUNT(*),                                         │
│           COUNT(CASE WHEN column = 5 THEN 1 END) as score_5,            │
│           COUNT(CASE WHEN column = 4 THEN 1 END) as score_4,            │
│           ...                                                            │
│    FROM responses                                                        │
│    WHERE respondent_type = ? AND column IS NOT NULL                      │
│                                                                           │
│  Output: Table with avg scores, counts, percentages per item             │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  TOOL 3: get_survey_overview                                              │
│  ─────────────────────────────────────────────────────────────────────── │
│  Purpose: แสดงภาพรวมจำนวนผู้ตอบแบบสอบถาม                                 │
│                                                                           │
│  Input: (none)                                                            │
│                                                                           │
│  Process:                                                                 │
│    • COUNT(*) total                                                      │
│    • GROUP BY respondent_type                                            │
│    • COUNT impressed_text IS NOT NULL                                    │
│    • COUNT suggestion_text IS NOT NULL                                   │
│                                                                           │
│  Output: Summary with total, breakdown by type, text field counts        │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  TOOL 4: get_improvements                                                 │
│  ─────────────────────────────────────────────────────────────────────── │
│  Purpose: รวบรวมข้อเสนอแนะ/สิ่งที่ควรปรับปรุง                            │
│                                                                           │
│  Input:                                                                   │
│    • topic: string (optional) - หัวข้อที่สนใจ                            │
│    • limit: number (default: 20)                                         │
│                                                                           │
│  Process:                                                                 │
│    • If topic: FTS5 search on suggestion_text                            │
│    • Else: Return all non-empty suggestion_text                          │
│                                                                           │
│  Output: Numbered list of suggestions with respondent type               │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  TOOL 5: get_impressions                                                  │
│  ─────────────────────────────────────────────────────────────────────── │
│  Purpose: รวบรวมสิ่งที่ประทับใจ                                          │
│                                                                           │
│  Input:                                                                   │
│    • topic: string (optional) - หัวข้อที่สนใจ                            │
│    • limit: number (default: 20)                                         │
│                                                                           │
│  Process:                                                                 │
│    • If topic: FTS5 search on impressed_text                             │
│    • Else: Return all non-empty impressed_text                           │
│                                                                           │
│  Output: Numbered list of impressions with respondent type               │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  TOOL 6: compare_groups                                                   │
│  ─────────────────────────────────────────────────────────────────────── │
│  Purpose: เปรียบเทียบความพึงพอใจระหว่างกลุ่มผู้ตอบ                       │
│                                                                           │
│  Input:                                                                   │
│    • category: "event" | "facility" (required)                           │
│                                                                           │
│  Process:                                                                 │
│    For each column in category:                                          │
│      For each respondent_type (student, staff, observer):               │
│        SELECT AVG(column) WHERE respondent_type = ?                      │
│                                                                           │
│  Output: Comparison table with avg scores per group                      │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 6: Transport Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRANSPORT COMPARISON                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────┐
  │                        STDIO Transport                                 │
  │                         (index.js)                                     │
  │                                                                        │
  │   Usage: Claude Code CLI                                              │
  │   Command: npm run start                                              │
  │                                                                        │
  │   ┌────────────────┐         ┌────────────────┐                       │
  │   │  Claude Code   │ ──────► │  MCP Server    │                       │
  │   │    (stdin)     │ ◄────── │   (stdout)     │                       │
  │   └────────────────┘         └────────────────┘                       │
  │                                                                        │
  │   • Direct process communication                                      │
  │   • Low latency                                                       │
  │   • Single client                                                     │
  └───────────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────┐
  │                         SSE Transport                                  │
  │                        (server-sse.js)                                 │
  │                                                                        │
  │   Usage: Web clients, remote connections                              │
  │   Command: npm run start:sse                                          │
  │                                                                        │
  │   ┌────────────────┐  HTTP   ┌────────────────┐                       │
  │   │  Web Client    │ ──────► │  HTTP Server   │                       │
  │   │   (Browser)    │ ◄────── │   Port 3000    │                       │
  │   └────────────────┘   SSE   └────────────────┘                       │
  │                                    │                                   │
  │   Endpoints:                       ▼                                   │
  │   • GET  /sse      - SSE connection                                   │
  │   • POST /message  - Send messages                                    │
  │   • GET  /health   - Health check                                     │
  │                                                                        │
  │   Features:                                                           │
  │   • CORS enabled                                                      │
  │   • Multiple clients                                                  │
  │   • Session management                                                │
  └───────────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              EXAMPLE: "มีคนพูดถึงห้องน้ำอะไรบ้าง"                           │
└─────────────────────────────────────────────────────────────────────────────┘

  User Query: "มีคนพูดถึงห้องน้ำอะไรบ้าง"

  ┌─────────────────────────────────────────────────────────────────────────┐
  │  STEP 1: Claude analyzes and selects tool                              │
  │                                                                         │
  │  Claude → MCP: CallToolRequest                                         │
  │  {                                                                      │
  │    "name": "search_feedback",                                          │
  │    "arguments": {                                                      │
  │      "query": "ห้องน้ำ",                                               │
  │      "type": "all",                                                    │
  │      "limit": 10                                                       │
  │    }                                                                   │
  │  }                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  STEP 2: MCP Server processes request                                  │
  │                                                                         │
  │  const results = searchFeedback("ห้องน้ำ", "all", 10);                │
  │                                                                         │
  │  // SQL executed:                                                      │
  │  SELECT r.id, r.timestamp, r.respondent_type,                         │
  │         r.impressed_text, r.suggestion_text,                          │
  │         bm25(responses_fts) as rank                                   │
  │  FROM responses_fts f                                                  │
  │  JOIN responses r ON f.rowid = r.id                                   │
  │  WHERE responses_fts MATCH 'ห้องน้ำ'                                   │
  │  ORDER BY rank                                                         │
  │  LIMIT 10                                                              │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  STEP 3: Format and return results                                     │
  │                                                                         │
  │  MCP → Claude: ToolResponse                                            │
  │  {                                                                      │
  │    "content": [{                                                       │
  │      "type": "text",                                                   │
  │      "text": "## ผลการค้นหา \"ห้องน้ำ\"\n\n                           │
  │               พบ 8 รายการ\n\n                                          │
  │               ### 1. นักศึกษาสอบภาคสนาม\n                              │
  │               **ประทับใจ:** ห้องน้ำสะอาด...\n                          │
  │               **ข้อเสนอแนะ:** ควรเพิ่มจำนวนห้องน้ำ...\n"              │
  │    }]                                                                  │
  │  }                                                                      │
  └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  STEP 4: Claude summarizes for user                                    │
  │                                                                         │
  │  "จากผลการค้นหาเกี่ยวกับ 'ห้องน้ำ' พบ 8 ความคิดเห็น:                  │
  │                                                                         │
  │   สิ่งที่ประทับใจ:                                                     │
  │   - ห้องน้ำสะอาด สร้างความสุข                                          │
  │   - มีห้องน้ำเพียงพอ                                                    │
  │                                                                         │
  │   ข้อเสนอแนะ:                                                          │
  │   - ควรเพิ่มจำนวนห้องน้ำ                                               │
  │   - จัดระเบียบคิวให้ดีขึ้น"                                            │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure Summary

```
thudong-mcp-claude/
├── data/
│   └── Post-Thudong-Eval/
│       └── WatPaRoiPee-2025.csv     ◄── Raw survey data (804 rows)
│
├── db/
│   └── thudong.db                    ◄── SQLite database
│
├── src/
│   ├── index.js                      ◄── MCP Server (STDIO transport)
│   ├── server-sse.js                 ◄── MCP Server (SSE transport)
│   ├── db.js                         ◄── Database operations & queries
│   ├── import.js                     ◄── CSV → SQLite importer
│   └── test-db.js                    ◄── Database tests
│
├── docs/
│   └── SYSTEM-ARCHITECTURE.md        ◄── This file
│
├── package.json                      ◄── Dependencies & scripts
├── Dockerfile                        ◄── Container build
├── docker-compose.yml                ◄── Container orchestration
├── CLAUDE.md                         ◄── AI context instructions
└── ARCHITECTURE.md                   ◄── Technical architecture
```

---

## Tech Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js (ES Modules) | JavaScript execution |
| Protocol | MCP SDK | AI tool integration |
| Database | better-sqlite3 | Data storage |
| Search | FTS5 (unicode61) | Thai text search |
| Transport | stdio / SSE | Communication |
| Container | Docker | Deployment |
