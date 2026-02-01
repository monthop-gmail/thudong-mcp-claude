# RAG Architecture: แบบสอบถามธุดงค์ วัดป่าร้อยปี

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Claude Code / AI Client                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ MCP Protocol (stdio/SSE)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          thudong-mcp-claude Server                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         MCP Tools                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │   │
│  │  │ search_text  │  │ get_stats    │  │ analyze_sentiment  │    │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘    │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │   │
│  │  │ get_feedback │  │ filter_by    │  │ get_improvement    │    │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Query Router                                │   │
│  │         (Structured Query vs Semantic Search)                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │                                        │                    │
│           ▼                                        ▼                    │
│  ┌─────────────────────┐              ┌─────────────────────────┐      │
│  │   SQL Query Engine  │              │   FTS5 Search Engine    │      │
│  │   (Statistics)      │              │   (Free Text RAG)       │      │
│  └─────────────────────┘              └─────────────────────────┘      │
│           │                                        │                    │
│           └────────────────┬───────────────────────┘                    │
│                            ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SQLite Database                               │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  responses (Main Table)                                   │   │   │
│  │  │  - id, timestamp, respondent_type                        │   │   │
│  │  │  - knowledge_* (8 cols), moral_* (8 cols)                │   │   │
│  │  │  - event_* (6 cols), facility_* (6 cols)                 │   │   │
│  │  │  - impressed_text, suggestion_text                        │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  responses_fts (FTS5 Virtual Table)                       │   │   │
│  │  │  - Full-text index on impressed_text, suggestion_text    │   │   │
│  │  │  - Thai tokenizer support                                 │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Main Table: `responses`

```sql
CREATE TABLE responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    respondent_type TEXT,  -- นักศึกษาสอบภาคสนาม, คณะทำงาน, ผู้เข้าร่วมงาน

    -- หมวดความรู้ (1-5 scale: 5=มากที่สุด, 1=น้อยที่สุด)
    knowledge_history INTEGER,      -- ประวัติพระอาจารย์หลวงพ่อ
    knowledge_dharma INTEGER,       -- เกร็ดธรรมะ
    knowledge_samadhi INTEGER,      -- ความรู้เกี่ยวกับสมาธิ
    knowledge_thudong INTEGER,      -- ความรู้เกี่ยวกับการธุดงค์
    knowledge_benefit INTEGER,      -- ประโยชน์ของสมาธิ
    knowledge_chavana INTEGER,      -- ชวนะจิตในการแก้ปัญหา
    knowledge_daily INTEGER,        -- การนำสมาธิไปใช้ในชีวิตประจำวัน
    knowledge_other TEXT,           -- อื่นๆ (free text)

    -- หมวดคุณธรรม (1-5 scale)
    moral_metta INTEGER,            -- มีเมตตา
    moral_reason INTEGER,           -- มีเหตุผล
    moral_responsible INTEGER,      -- มีความรับผิดชอบ
    moral_discipline INTEGER,       -- มีวินัย
    moral_patience INTEGER,         -- มีความอดทน
    moral_sacrifice INTEGER,        -- มีความเสียสละ
    moral_forgive INTEGER,          -- รู้จักให้อภัย
    moral_other TEXT,               -- อื่นๆ (free text)

    -- หมวดการจัดงาน (1-5 scale: 5=พอใจมากที่สุด)
    event_schedule INTEGER,         -- กำหนดการ
    event_route INTEGER,            -- เส้นทางเดินธุดงค์
    event_mentor INTEGER,           -- พี่เลี้ยง/การกำกับแถว
    event_ceremony INTEGER,         -- ศาสนพิธี
    event_speech INTEGER,           -- พิธีกล่าวแสดงความรู้สึก
    event_objective INTEGER,        -- จัดงานได้ตรงตามวัตถุประสงค์

    -- หมวดสิ่งอำนวยความสะดวก (1-5 scale)
    facility_pr INTEGER,            -- การประชาสัมพันธ์
    facility_coordinate INTEGER,    -- การติดต่อประสานงาน
    facility_atmosphere INTEGER,    -- บรรยากาศสถานที่
    facility_tent INTEGER,          -- เต้นท์/ที่พัก
    facility_food INTEGER,          -- อาหาร เครื่องดื่ม
    facility_bathroom INTEGER,      -- ห้องอาบน้ำ ห้องสุขา

    -- ข้อความอิสระ (สำหรับ RAG)
    impressed_text TEXT,            -- สิ่งที่ประทับใจมากที่สุด
    suggestion_text TEXT            -- สิ่งที่ควรปรับปรุง/ข้อเสนอแนะ
);
```

### FTS5 Virtual Table: `responses_fts`

```sql
-- Thai-aware FTS5 for semantic search
CREATE VIRTUAL TABLE responses_fts USING fts5(
    impressed_text,
    suggestion_text,
    content='responses',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER responses_ai AFTER INSERT ON responses BEGIN
    INSERT INTO responses_fts(rowid, impressed_text, suggestion_text)
    VALUES (new.id, new.impressed_text, new.suggestion_text);
END;
```

## MCP Tools Design

### 1. `search_feedback` - RAG Search
```javascript
{
    name: "search_feedback",
    description: "ค้นหาความคิดเห็นจากแบบสอบถามธุดงค์ วัดป่าร้อยปี 12-15 ธ.ค. 2568",
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "คำค้นหา เช่น 'อาหาร', 'พี่เลี้ยง', 'ห้องน้ำ'"
            },
            type: {
                type: "string",
                enum: ["impressed", "suggestion", "all"],
                description: "ค้นหาจาก: ประทับใจ, ข้อเสนอแนะ, หรือทั้งหมด"
            },
            limit: {
                type: "number",
                default: 10
            }
        },
        required: ["query"]
    }
}
```

### 2. `get_statistics` - Aggregate Stats
```javascript
{
    name: "get_statistics",
    description: "สรุปสถิติความพึงพอใจรายหมวด",
    inputSchema: {
        type: "object",
        properties: {
            category: {
                type: "string",
                enum: ["knowledge", "moral", "event", "facility", "all"],
                description: "หมวดที่ต้องการ: ความรู้, คุณธรรม, การจัดงาน, สิ่งอำนวยความสะดวก"
            },
            respondent_type: {
                type: "string",
                enum: ["student", "staff", "observer", "all"],
                description: "กลุ่มผู้ตอบ"
            }
        }
    }
}
```

### 3. `get_improvements` - Top Issues
```javascript
{
    name: "get_improvements",
    description: "รวบรวมข้อเสนอแนะที่พบบ่อย พร้อมจัดกลุ่มตามหัวข้อ",
    inputSchema: {
        type: "object",
        properties: {
            topic: {
                type: "string",
                description: "หัวข้อที่สนใจ เช่น 'ห้องน้ำ', 'อาหาร', 'กำหนดการ'"
            },
            min_mentions: {
                type: "number",
                default: 2,
                description: "จำนวนครั้งขั้นต่ำที่ถูกกล่าวถึง"
            }
        }
    }
}
```

### 4. `get_impressions` - Positive Feedback
```javascript
{
    name: "get_impressions",
    description: "รวบรวมสิ่งที่ประทับใจ พร้อมจัดกลุ่มตามหัวข้อ",
    inputSchema: {
        type: "object",
        properties: {
            topic: {
                type: "string",
                description: "หัวข้อที่สนใจ เช่น 'พี่เลี้ยง', 'สถานที่', 'พระอาจารย์'"
            }
        }
    }
}
```

### 5. `compare_groups` - Group Comparison
```javascript
{
    name: "compare_groups",
    description: "เปรียบเทียบความพึงพอใจระหว่างกลุ่มผู้ตอบ",
    inputSchema: {
        type: "object",
        properties: {
            category: {
                type: "string",
                enum: ["event", "facility"],
                description: "หมวดที่ต้องการเปรียบเทียบ"
            }
        },
        required: ["category"]
    }
}
```

## File Structure

```
thudong-mcp-claude/
├── data/
│   └── Post-Thudong-Eval/
│       └── WatPaRoiPee-2025.csv      # Raw data
├── db/
│   └── thudong.db                     # SQLite database
├── src/
│   ├── index.js                       # MCP Server (stdio)
│   ├── server-sse.js                  # MCP Server (SSE)
│   ├── db.js                          # Database operations
│   ├── import.js                      # CSV to SQLite importer
│   ├── search.js                      # FTS5 search logic
│   └── stats.js                       # Statistics calculations
├── package.json
├── Dockerfile
├── docker-compose.yml
├── CLAUDE.md                          # AI context file
└── ARCHITECTURE.md                    # This file
```

## Data Flow

### Query: "มีคนพูดถึงห้องน้ำอะไรบ้าง"

```
1. Claude → MCP: search_feedback(query="ห้องน้ำ", type="all")

2. MCP Server:
   ├─ Parse query
   ├─ Execute FTS5 search:
   │   SELECT r.*,
   │          bm25(responses_fts) as rank
   │   FROM responses_fts f
   │   JOIN responses r ON f.rowid = r.id
   │   WHERE responses_fts MATCH 'ห้องน้ำ'
   │   ORDER BY rank
   │   LIMIT 10
   └─ Format results

3. MCP → Claude: [
     {
       "type": "impressed",
       "text": "ห้องน้ำสะอาดสร้างความสุขให้แก่ทุกคน...",
       "respondent": "นักศึกษา",
       "timestamp": "15/12/2025"
     },
     {
       "type": "suggestion",
       "text": "ปรับเรื่องการจัดระเบียบคิวห้องน้ำ...",
       "respondent": "นักศึกษา"
     },
     ...
   ]

4. Claude: สรุปและตอบผู้ใช้
```

### Query: "ความพึงพอใจด้านอาหารเป็นอย่างไร"

```
1. Claude → MCP: get_statistics(category="facility")

2. MCP Server:
   ├─ Execute SQL:
   │   SELECT
   │     AVG(facility_food) as avg_score,
   │     COUNT(CASE WHEN facility_food = 5 THEN 1 END) as excellent,
   │     COUNT(CASE WHEN facility_food = 4 THEN 1 END) as good,
   │     ...
   │   FROM responses
   │   WHERE facility_food IS NOT NULL
   └─ Calculate percentages

3. MCP → Claude: {
     "facility_food": {
       "avg": 4.72,
       "distribution": {
         "พอใจมากที่สุด": 78.5,
         "พอใจมาก": 18.2,
         "พอใจปานกลาง": 2.8,
         "พอใจน้อย": 0.4,
         "พอใจน้อยที่สุด": 0.1
       }
     }
   }
```

## Implementation Priority

### Phase 1: Core (MVP)
1. [ ] CSV Import → SQLite
2. [ ] FTS5 Setup with Thai support
3. [ ] `search_feedback` tool
4. [ ] `get_statistics` tool
5. [ ] Basic MCP server (stdio)

### Phase 2: Enhanced Search
6. [ ] `get_improvements` tool
7. [ ] `get_impressions` tool
8. [ ] Keyword clustering (group similar feedback)

### Phase 3: Analytics
9. [ ] `compare_groups` tool
10. [ ] Trend analysis by timestamp
11. [ ] Export reports

### Phase 4: Production
12. [ ] SSE transport
13. [ ] Docker deployment
14. [ ] Rate limiting & caching

## Value Mapping

### Likert Scale → Integer
```javascript
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
```

## Example Prompts

### ภาพรวมและสถิติ
| Prompt | Tool | Parameters |
|--------|------|------------|
| แสดงภาพรวมแบบสอบถามธุดงค์ | `get_survey_overview` | - |
| สรุปความพึงพอใจด้านสิ่งอำนวยความสะดวก | `get_statistics` | category=facility |
| สถิติหมวดการจัดงาน เฉพาะนักศึกษา | `get_statistics` | category=event, respondent_type=student |
| คะแนนด้านความรู้ที่ได้รับ | `get_statistics` | category=knowledge |

### ค้นหาความคิดเห็น
| Prompt | Tool | Parameters |
|--------|------|------------|
| มีคนพูดถึงห้องน้ำอะไรบ้าง | `search_feedback` | query=ห้องน้ำ |
| ค้นหาความเห็นเกี่ยวกับอาหาร | `search_feedback` | query=อาหาร |
| หาข้อเสนอแนะที่เกี่ยวกับที่พัก | `search_feedback` | query=ที่พัก, type=suggestion |
| สิ่งที่ประทับใจเกี่ยวกับพระอาจารย์ | `search_feedback` | query=พระอาจารย์, type=impressed |

### สิ่งประทับใจและข้อเสนอแนะ
| Prompt | Tool | Parameters |
|--------|------|------------|
| รวมสิ่งที่ประทับใจเกี่ยวกับพี่เลี้ยง | `get_impressions` | topic=พี่เลี้ยง |
| รวมข้อเสนอแนะเรื่องกำหนดการ | `get_improvements` | topic=กำหนดการ |
| สิ่งที่ประทับใจเกี่ยวกับการเดินธุดงค์ 10 อันดับ | `get_impressions` | topic=เดินธุดงค์, limit=10 |
| ข้อเสนอแนะเกี่ยวกับสถานที่ | `get_improvements` | topic=สถานที่ |

### เปรียบเทียบกลุ่ม
| Prompt | Tool | Parameters |
|--------|------|------------|
| เปรียบเทียบความพึงพอใจด้านสิ่งอำนวยความสะดวก | `compare_groups` | category=facility |
| เปรียบเทียบคะแนนการจัดงานระหว่างกลุ่ม | `compare_groups` | category=event |

### วิเคราะห์เชิงลึก (ใช้หลาย tools)
| Prompt | Tools |
|--------|-------|
| วิเคราะห์จุดแข็งและจุดอ่อนของการจัดงาน | `get_statistics` + `get_improvements` + `get_impressions` |
| สรุปประเด็นที่ต้องปรับปรุงสำหรับปีหน้า | `get_improvements` + `get_statistics` |
| อะไรคือสิ่งที่ผู้เข้าร่วมประทับใจมากที่สุด | `get_impressions` + `search_feedback` |

## Notes

- **Thai Language**: FTS5 uses `unicode61` tokenizer ซึ่งรองรับภาษาไทยได้ระดับหนึ่ง
- **Empty Values**: คณะทำงานไม่ตอบหมวดความรู้และคุณธรรม → store as NULL
- **Free Text Quality**: บาง record มี text ยาวมาก (paragraph) บางอันสั้นมาก (1-2 คำ)
