# RAG Improvements Roadmap

วิเคราะห์จุดที่ควรปรับปรุงในระบบ RAG ของ Thudong MCP Server

---

## Executive Summary

| Priority | Issue | Impact | Effort | Status |
|----------|-------|--------|--------|--------|
| 🔴 High | Thai Tokenization | ผลค้นหาไม่ครบ | Medium | 📋 Planned |
| 🔴 High | Synonym Expansion | Miss related content | Low | 📋 Planned |
| 🟡 Medium | Vector Search | No semantic match | High | 📋 Planned |
| 🟡 Medium | Query Cache | Performance | Low | 📋 Planned |
| 🟢 Low | Text Chunking | Context precision | Medium | 📋 Planned |
| 🟢 Low | Feedback Loop | Continuous improvement | Medium | 📋 Planned |

---

## Issue 1: Thai Tokenization (🔴 High Priority)

### Problem

ปัจจุบันใช้ FTS5 tokenizer `unicode61` ซึ่งแยกคำตาม whitespace/punctuation:

```javascript
// db.js:74-80
CREATE VIRTUAL TABLE responses_fts USING fts5(
    impressed_text,
    suggestion_text,
    content='responses',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'  // ❌ ไม่เหมาะกับภาษาไทย
);
```

### Impact

- ภาษาไทยไม่มี word boundary ที่ชัดเจน
- "ห้องน้ำ" อาจไม่ match "ห้องน้ำสะอาด" ถ้าไม่มี space
- "พี่เลี้ยงดูแลดี" จะถูก tokenize เป็น 1 token แทนที่จะเป็น "พี่เลี้ยง", "ดูแล", "ดี"

### Example

```
Input: "พี่เลี้ยงดูแลดีมากครับ"

unicode61 tokenization:
  → ["พี่เลี้ยงดูแลดีมากครับ"]  // 1 token (wrong)

Correct Thai tokenization:
  → ["พี่เลี้ยง", "ดูแล", "ดี", "มาก", "ครับ"]  // 5 tokens
```

### Solution Options

#### Option A: ICU Tokenizer (Best, but requires recompile)

```sql
-- ต้อง compile SQLite with ICU extension
tokenize='icu th_TH'
```

**Pros:** Native Thai word segmentation
**Cons:** ต้อง compile SQLite ใหม่, Docker image จะใหญ่ขึ้น

#### Option B: Pre-tokenize with Python (Recommended)

```python
# preprocessing script using pythainlp
from pythainlp.tokenize import word_tokenize

def tokenize_thai(text):
    tokens = word_tokenize(text, engine='newmm')
    return ' '.join(tokens)

# Before insert:
# "พี่เลี้ยงดูแลดีมาก" → "พี่เลี้ยง ดูแล ดี มาก"
```

```javascript
// import.js - Add preprocessing step
function preprocessThaiText(text) {
    // Call Python script or use node-pythainlp binding
    return tokenizedText;
}
```

**Pros:** ใช้ได้กับ SQLite ปกติ
**Cons:** ต้องเพิ่ม preprocessing step, Python dependency

#### Option C: Trigram Tokenizer (Quick fix)

```sql
tokenize='trigram'
```

**Pros:** ง่าย, fuzzy match ได้
**Cons:** Index ใหญ่, อาจ match ผิด (false positives)

### Implementation Plan

```
┌─────────────────────────────────────────────────────────────────┐
│                  Thai Tokenization Pipeline                      │
└─────────────────────────────────────────────────────────────────┘

  Raw Text                Pre-tokenize              FTS5 Index
  ─────────              ────────────              ──────────
  "พี่เลี้ยงดูแลดี"  →   pythainlp/deepcut   →   "พี่เลี้ยง ดูแล ดี"
                              │
                              ▼
                     ┌─────────────────┐
                     │  Token Mapping  │
                     │  Table (optional)│
                     └─────────────────┘
```

### Files to Modify

- `src/import.js` - Add tokenization during import
- `src/db.js` - Update FTS5 schema
- `package.json` - Add tokenization dependency
- New: `src/tokenizer.js` - Thai tokenization wrapper

---

## Issue 2: No Synonym Expansion (🔴 High Priority)

### Problem

Query ถูกส่งตรงๆ ไป FTS5 โดยไม่มี synonym handling:

```javascript
// db.js:185-201
export function searchFeedback(query, type = 'all', limit = 10) {
    // ...
    const stmt = db.prepare(`
        SELECT ...
        WHERE responses_fts MATCH ?  // ❌ Raw query, no expansion
        ...
    `);
    return stmt.all(query, limit);  // query ไม่ถูก expand
}
```

### Impact

- "ห้องน้ำ" ไม่ match "ห้องสุขา" หรือ "toilet"
- "อาหาร" ไม่ match "ข้าว" หรือ "กับข้าว"
- "ที่พัก" ไม่ match "เต็นท์" หรือ "เต้นท์"

### Solution

```javascript
// src/synonyms.js (New file)

export const THAI_SYNONYMS = {
    // Facilities
    'ห้องน้ำ': ['ห้องน้ำ', 'ห้องสุขา', 'สุขา', 'toilet', 'ส้วม', 'ห้องอาบน้ำ'],
    'ที่พัก': ['ที่พัก', 'เต็นท์', 'เต้นท์', 'ที่นอน', 'ห้องพัก', 'tent'],
    'อาหาร': ['อาหาร', 'ข้าว', 'กับข้าว', 'อาหารเช้า', 'อาหารกลางวัน', 'อาหารเย็น', 'เครื่องดื่ม', 'น้ำ'],

    // People
    'พี่เลี้ยง': ['พี่เลี้ยง', 'พี่ๆ', 'คณะทำงาน', 'staff', 'ผู้ดูแล', 'เจ้าหน้าที่'],
    'พระอาจารย์': ['พระอาจารย์', 'หลวงพ่อ', 'พระ', 'อาจารย์', 'ท่าน'],

    // Activities
    'ธุดงค์': ['ธุดงค์', 'เดินธุดงค์', 'การเดิน', 'เดินป่า', 'เดินทาง'],
    'สมาธิ': ['สมาธิ', 'นั่งสมาธิ', 'ปฏิบัติ', 'ปฏิบัติธรรม', 'meditation'],

    // Places
    'สถานที่': ['สถานที่', 'วัด', 'บริเวณ', 'พื้นที่', 'location'],

    // Events
    'กำหนดการ': ['กำหนดการ', 'ตารางเวลา', 'schedule', 'เวลา', 'โปรแกรม'],
    'พิธี': ['พิธี', 'ศาสนพิธี', 'พิธีกรรม', 'ceremony'],

    // Common issues
    'คิว': ['คิว', 'แถว', 'รอ', 'รอคิว', 'เข้าแถว', 'queue'],
    'สุนัข': ['สุนัข', 'หมา', 'dog', 'สัตว์'],
    'หิน': ['หิน', 'พื้น', 'ทาง', 'เส้นทาง', 'ถนน'],
};

/**
 * Expand query with synonyms
 * @param {string} query - Original query
 * @returns {string} - FTS5 query with OR expansion
 */
export function expandQuery(query) {
    const normalizedQuery = query.trim().toLowerCase();

    // Check if query matches any synonym group
    for (const [key, synonyms] of Object.entries(THAI_SYNONYMS)) {
        if (synonyms.some(s => normalizedQuery.includes(s.toLowerCase()))) {
            // Build FTS5 OR query
            return synonyms.map(s => `"${s}"`).join(' OR ');
        }
    }

    // No synonyms found, return original
    return query;
}

/**
 * Expand query with fuzzy matching
 * @param {string} query - Original query
 * @returns {string} - FTS5 query with wildcards
 */
export function fuzzyQuery(query) {
    // Add prefix matching
    return `${query}*`;
}
```

### Update db.js

```javascript
// db.js
import { expandQuery } from './synonyms.js';

export function searchFeedback(query, type = 'all', limit = 10) {
    const db = getDb();

    // ✅ Expand query with synonyms
    const expandedQuery = expandQuery(query);

    const stmt = db.prepare(`
        SELECT ...
        WHERE responses_fts MATCH ?
        ...
    `);

    return stmt.all(expandedQuery, limit);
}
```

### Files to Create/Modify

- New: `src/synonyms.js` - Synonym definitions and expansion
- Modify: `src/db.js` - Use expandQuery()
- Modify: `src/index.js` - Log expanded queries for debugging

---

## Issue 3: No Semantic/Vector Search (🟡 Medium Priority)

### Problem

FTS5 ใช้แค่ keyword matching (BM25) ไม่เข้าใจความหมาย:

```
Query: "อาหารอร่อย"
FTS5 matches: records containing "อาหาร" or "อร่อย"
Misses: "ข้าวมันไก่รสเยี่ยม", "กับข้าวถูกปาก"
```

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HYBRID SEARCH ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

  User Query: "อาหารอร่อย"
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        QUERY PROCESSOR                                   │
  │  1. Synonym expansion: "อาหาร OR ข้าว OR กับข้าว"                       │
  │  2. Generate embedding: query → vector [0.1, 0.3, ...]                  │
  └─────────────────────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
  ┌──────────────────┐              ┌──────────────────┐
  │   FTS5 Search    │              │  Vector Search   │
  │   (Keyword)      │              │  (Semantic)      │
  │                  │              │                  │
  │  BM25 scoring    │              │  Cosine similarity│
  │  Fast, exact     │              │  Understands meaning│
  └────────┬─────────┘              └────────┬─────────┘
           │                                  │
           │    ┌────────────────────┐       │
           └───►│   RESULT FUSION    │◄──────┘
                │                    │
                │  Reciprocal Rank   │
                │  Fusion (RRF)      │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │   FINAL RESULTS    │
                │   (Re-ranked)      │
                └────────────────────┘
```

### Implementation Options

#### Option A: sqlite-vss (SQLite Vector Extension)

```javascript
// Requires sqlite-vss extension
import Database from 'better-sqlite3';

const db = new Database('thudong.db');
db.loadExtension('./vss0');

// Create vector table
db.exec(`
    CREATE VIRTUAL TABLE responses_vec USING vss0(
        embedding(384)  -- dimension depends on model
    );
`);

// Search
const results = db.prepare(`
    SELECT rowid, distance
    FROM responses_vec
    WHERE vss_search(embedding, ?)
    LIMIT 10
`).all(queryEmbedding);
```

**Pros:** All-in-one SQLite solution
**Cons:** Experimental, requires extension loading

#### Option B: Separate Vector DB (Recommended for production)

```javascript
// Using Chroma (local) or Pinecone (cloud)
import { ChromaClient } from 'chromadb';

const client = new ChromaClient();
const collection = await client.getOrCreateCollection({
    name: 'thudong_feedback',
    metadata: { 'hnsw:space': 'cosine' }
});

// Add documents with embeddings
await collection.add({
    ids: ['1', '2', '3'],
    embeddings: [[0.1, 0.2, ...], [0.3, 0.4, ...], ...],
    documents: ['พี่เลี้ยงดูแลดี', 'อาหารอร่อย', ...],
    metadatas: [{ type: 'impressed' }, ...]
});

// Search
const results = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: 10
});
```

#### Option C: Simple Embedding with OpenAI

```javascript
// src/embedding.js
import OpenAI from 'openai';

const openai = new OpenAI();

export async function getEmbedding(text) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}

export function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}
```

### Hybrid Search Implementation

```javascript
// src/hybrid-search.js
import { searchFeedback } from './db.js';
import { vectorSearch } from './vector-db.js';

export async function hybridSearch(query, limit = 10) {
    // Run both searches in parallel
    const [ftsResults, vecResults] = await Promise.all([
        searchFeedback(query, 'all', limit * 2),
        vectorSearch(query, limit * 2)
    ]);

    // Reciprocal Rank Fusion
    const scores = new Map();
    const k = 60; // RRF constant

    ftsResults.forEach((result, rank) => {
        const id = result.id;
        scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
    });

    vecResults.forEach((result, rank) => {
        const id = result.id;
        scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
    });

    // Sort by combined score
    const sortedIds = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

    // Fetch full records
    return getRecordsByIds(sortedIds);
}
```

### Files to Create

- New: `src/embedding.js` - Embedding generation
- New: `src/vector-db.js` - Vector database operations
- New: `src/hybrid-search.js` - Combined search
- Modify: `src/db.js` - Add vector storage columns
- Modify: `src/import.js` - Generate embeddings during import

---

## Issue 4: No Query Cache (🟡 Medium Priority)

### Problem

ทุก query run SQL ใหม่ทุกครั้ง แม้ query เดิมซ้ำๆ

### Solution

```javascript
// src/cache.js
import { LRUCache } from 'lru-cache';

const queryCache = new LRUCache({
    max: 500,                    // Max entries
    ttl: 1000 * 60 * 10,        // 10 minutes TTL
    updateAgeOnGet: true,        // Reset TTL on access
});

export function getCached(key) {
    return queryCache.get(key);
}

export function setCache(key, value) {
    queryCache.set(key, value);
}

export function generateCacheKey(tool, args) {
    return `${tool}:${JSON.stringify(args)}`;
}

export function clearCache() {
    queryCache.clear();
}
```

### Update db.js

```javascript
// db.js
import { getCached, setCache, generateCacheKey } from './cache.js';

export function searchFeedback(query, type = 'all', limit = 10) {
    const cacheKey = generateCacheKey('search', { query, type, limit });

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }

    // Execute query
    const results = executeSearch(query, type, limit);

    // Cache results
    setCache(cacheKey, results);

    return results;
}
```

### Files to Create/Modify

- New: `src/cache.js` - LRU cache implementation
- Modify: `src/db.js` - Add caching to all query functions
- Modify: `package.json` - Add `lru-cache` dependency

---

## Issue 5: No Text Chunking (🟢 Low Priority)

### Problem

บาง record มีข้อความยาวมาก ทำให้:
- BM25 score ถูก dilute
- AI อ่าน context ไม่ตรงจุด
- Embedding ครอบคลุมหลาย topics

### Example

```
Current (1 record):
{
  id: 42,
  impressed_text: "พี่เลี้ยงดูแลดีมาก ใส่ใจทุกคน อาหารอร่อยมาก
                   โดยเฉพาะข้าวมันไก่ สถานที่สวยงาม บรรยากาศดี
                   การเดินธุดงค์เป็นประสบการณ์ที่ดี ได้เรียนรู้ธรรมะ..."
}

Better (multiple chunks):
{
  chunk_id: 1,
  source_id: 42,
  text: "พี่เลี้ยงดูแลดีมาก ใส่ใจทุกคน",
  topic: "พี่เลี้ยง"
}
{
  chunk_id: 2,
  source_id: 42,
  text: "อาหารอร่อยมาก โดยเฉพาะข้าวมันไก่",
  topic: "อาหาร"
}
...
```

### Solution

```javascript
// src/chunker.js

const TOPIC_KEYWORDS = {
    'พี่เลี้ยง': ['พี่เลี้ยง', 'พี่ๆ', 'ดูแล', 'ใส่ใจ'],
    'อาหาร': ['อาหาร', 'ข้าว', 'อร่อย', 'เครื่องดื่ม'],
    'สถานที่': ['สถานที่', 'วัด', 'บรรยากาศ', 'สวย'],
    'ธุดงค์': ['ธุดงค์', 'เดิน', 'ประสบการณ์'],
    'ห้องน้ำ': ['ห้องน้ำ', 'ห้องสุขา', 'สะอาด'],
    'ที่พัก': ['ที่พัก', 'เต็นท์', 'นอน'],
};

export function chunkText(text, sourceId) {
    if (!text || text.length < 50) {
        return [{ source_id: sourceId, text, topic: 'general' }];
    }

    const chunks = [];

    // Split by common delimiters
    const sentences = text.split(/[,،、，。．.!\n]/);

    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 10) continue;

        // Detect topic
        const topic = detectTopic(trimmed);

        chunks.push({
            source_id: sourceId,
            text: trimmed,
            topic
        });
    }

    return chunks.length > 0 ? chunks : [{ source_id: sourceId, text, topic: 'general' }];
}

function detectTopic(text) {
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) {
            return topic;
        }
    }
    return 'general';
}
```

### New Schema

```sql
-- Additional table for chunks
CREATE TABLE response_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES responses(id),
    text TEXT,
    topic TEXT,
    field_type TEXT  -- 'impressed' or 'suggestion'
);

CREATE VIRTUAL TABLE chunks_fts USING fts5(
    text,
    content='response_chunks',
    content_rowid='id',
    tokenize='unicode61'
);

CREATE INDEX idx_chunks_topic ON response_chunks(topic);
CREATE INDEX idx_chunks_source ON response_chunks(source_id);
```

---

## Issue 6: No Feedback Loop (🟢 Low Priority)

### Problem

ไม่มีการเก็บ user feedback เพื่อปรับปรุง ranking

### Solution

```sql
-- New table for tracking
CREATE TABLE search_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT,
    tool_name TEXT,
    result_ids TEXT,  -- JSON array of returned IDs
    timestamp TEXT,
    session_id TEXT
);

CREATE TABLE result_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_id INTEGER REFERENCES search_analytics(id),
    result_id INTEGER,
    was_useful BOOLEAN,
    feedback_type TEXT,  -- 'click', 'copy', 'thumbs_up', 'thumbs_down'
    timestamp TEXT
);
```

### Usage Analytics Tool

```javascript
// New MCP tool
{
    name: 'log_feedback',
    description: 'บันทึก feedback สำหรับผลการค้นหา',
    inputSchema: {
        type: 'object',
        properties: {
            search_id: { type: 'integer' },
            result_id: { type: 'integer' },
            was_useful: { type: 'boolean' }
        },
        required: ['search_id', 'result_id', 'was_useful']
    }
}
```

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)

```
┌─────────────────────────────────────────────────────────────────┐
│  Task                              │ Effort │ Impact │ Status  │
├─────────────────────────────────────────────────────────────────┤
│  1. Add synonym expansion          │ 2h     │ High   │ ☐ Todo  │
│  2. Add query cache (LRU)          │ 2h     │ Medium │ ☐ Todo  │
│  3. Log queries for analytics      │ 1h     │ Low    │ ☐ Todo  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Thai Language (Week 2-3)

```
┌─────────────────────────────────────────────────────────────────┐
│  Task                              │ Effort │ Impact │ Status  │
├─────────────────────────────────────────────────────────────────┤
│  1. Research Thai tokenizers       │ 4h     │ -      │ ☐ Todo  │
│  2. Implement pre-tokenization     │ 8h     │ High   │ ☐ Todo  │
│  3. Re-import data with tokens     │ 2h     │ High   │ ☐ Todo  │
│  4. Test search quality            │ 4h     │ -      │ ☐ Todo  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Semantic Search (Week 4-6)

```
┌─────────────────────────────────────────────────────────────────┐
│  Task                              │ Effort │ Impact │ Status  │
├─────────────────────────────────────────────────────────────────┤
│  1. Choose embedding model         │ 4h     │ -      │ ☐ Todo  │
│  2. Set up vector storage          │ 8h     │ High   │ ☐ Todo  │
│  3. Generate embeddings for data   │ 4h     │ -      │ ☐ Todo  │
│  4. Implement hybrid search        │ 8h     │ High   │ ☐ Todo  │
│  5. Tune RRF parameters            │ 4h     │ Medium │ ☐ Todo  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: Advanced Features (Week 7+)

```
┌─────────────────────────────────────────────────────────────────┐
│  Task                              │ Effort │ Impact │ Status  │
├─────────────────────────────────────────────────────────────────┤
│  1. Implement text chunking        │ 8h     │ Medium │ ☐ Todo  │
│  2. Add topic clustering           │ 8h     │ Medium │ ☐ Todo  │
│  3. Feedback tracking system       │ 8h     │ Low    │ ☐ Todo  │
│  4. Auto-tuning based on feedback  │ 16h    │ Medium │ ☐ Todo  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start: Synonym Expansion

ขั้นตอนเริ่มต้นที่ทำได้ทันที:

### Step 1: Create synonyms.js

```bash
touch src/synonyms.js
```

### Step 2: Add code

```javascript
// src/synonyms.js
export const THAI_SYNONYMS = {
    'ห้องน้ำ': ['ห้องน้ำ', 'ห้องสุขา', 'สุขา', 'toilet'],
    'อาหาร': ['อาหาร', 'ข้าว', 'กับข้าว', 'อาหารเช้า', 'อาหารกลางวัน'],
    'ที่พัก': ['ที่พัก', 'เต็นท์', 'เต้นท์', 'ที่นอน'],
    'พี่เลี้ยง': ['พี่เลี้ยง', 'พี่ๆ', 'คณะทำงาน', 'staff'],
};

export function expandQuery(query) {
    for (const [key, synonyms] of Object.entries(THAI_SYNONYMS)) {
        if (query.includes(key) || synonyms.some(s => query.includes(s))) {
            return synonyms.map(s => `"${s}"`).join(' OR ');
        }
    }
    return query;
}
```

### Step 3: Update db.js

```javascript
import { expandQuery } from './synonyms.js';

export function searchFeedback(query, type = 'all', limit = 10) {
    const expandedQuery = expandQuery(query);
    // ... rest of function
}
```

### Step 4: Test

```bash
npm run start
# Query: "ห้องน้ำ" should now also find "ห้องสุขา", "สุขา" etc.
```

---

## References

- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [PyThaiNLP](https://pythainlp.github.io/)
- [sqlite-vss](https://github.com/asg017/sqlite-vss)
- [Reciprocal Rank Fusion](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

---

*Last updated: 2025-12-15*
