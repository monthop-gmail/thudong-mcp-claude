# thudong-mcp-claude

MCP Server สำหรับ RAG ข้อมูลแบบสอบถาม **"หลังการสอบภาคสนามธุดงค์"**

- **สถานที่:** วัดป่าร้อยปีหลวงพ่อวิริยังค์ จ.ราชบุรี
- **วันที่:** 12-15 ธันวาคม พ.ศ. 2568

## Features

- ค้นหาความคิดเห็นด้วย Full-Text Search (FTS5)
- สถิติความพึงพอใจรายหมวด
- เปรียบเทียบระหว่างกลุ่มผู้ตอบ
- SSE Transport + Docker

## Quick Stats

| รายการ | จำนวน |
|--------|-------|
| ผู้ตอบทั้งหมด | 804 คน |
| นักศึกษาสอบภาคสนาม | 690 คน (85.8%) |
| คณะทำงาน | 105 คน (13.1%) |
| ผู้สังเกตการณ์ | 9 คน (1.1%) |
| ข้อความ "ประทับใจ" | 660 รายการ |
| ข้อความ "ข้อเสนอแนะ" | 510 รายการ |

## Reports

รายงานวิเคราะห์ข้อมูลแบบสอบถาม:

| รายงาน | เนื้อหา |
|--------|---------|
| [executive-summary.md](reports/executive-summary.md) | รายงานสรุป 1 หน้าสำหรับผู้บริหาร |
| [survey-overview.md](reports/survey-overview.md) | ภาพรวมและสถิติทั้งหมด |
| [swot-analysis.md](reports/swot-analysis.md) | วิเคราะห์จุดแข็ง/จุดอ่อน |
| [top-impressions.md](reports/top-impressions.md) | สิ่งที่ประทับใจมากที่สุด |
| [improvements-2569.md](reports/improvements-2569.md) | ประเด็นที่ต้องปรับปรุงปีหน้า |

## Example Prompts

> ดูตัวอย่าง Prompt ทั้งหมดได้ที่ [PROMPTS.md](PROMPTS.md)

### ภาพรวมและสถิติ
- "แสดงภาพรวมแบบสอบถามธุดงค์"
- "สรุปความพึงพอใจด้านสิ่งอำนวยความสะดวก"
- "สถิติความพึงพอใจหมวดการจัดงาน เฉพาะนักศึกษา"

### ค้นหาความคิดเห็น
- "มีคนพูดถึงห้องน้ำอะไรบ้าง"
- "ค้นหาความเห็นเกี่ยวกับอาหาร"
- "หาข้อเสนอแนะที่เกี่ยวกับที่พัก"

### สิ่งประทับใจและข้อเสนอแนะ
- "รวมสิ่งที่ประทับใจเกี่ยวกับพี่เลี้ยง"
- "รวมข้อเสนอแนะเรื่องกำหนดการ"
- "ข้อเสนอแนะเกี่ยวกับสถานที่มีอะไรบ้าง"

### เปรียบเทียบกลุ่ม
- "เปรียบเทียบความพึงพอใจด้านสิ่งอำนวยความสะดวก ระหว่างนักศึกษากับคณะทำงาน"
- "เปรียบเทียบคะแนนการจัดงานระหว่างกลุ่มผู้ตอบ"

### วิเคราะห์เชิงลึก
- "วิเคราะห์จุดแข็งและจุดอ่อนของการจัดงานธุดงค์"
- "สรุปประเด็นที่ต้องปรับปรุงสำหรับปีหน้า"
- "อะไรคือสิ่งที่ผู้เข้าร่วมประทับใจมากที่สุด"

## Installation

```bash
# Clone repository
git clone https://github.com/monthop-gmail/thudong-mcp-claude.git
cd thudong-mcp-claude

# Start with Docker Compose
docker compose up -d
```

Server จะรันที่ `http://localhost:3200`

## Claude Code Configuration

### Option 1: CLI Command

```bash
claude mcp add thudong --transport sse --url http://localhost:3200/sse
```

### Option 2: Manual Config

เพิ่มไฟล์ `.mcp.json` ใน project:

```json
{
  "mcpServers": {
    "thudong": {
      "type": "sse",
      "url": "http://localhost:3200/sse"
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_feedback` | ค้นหาข้อความจาก "ประทับใจ" และ "ข้อเสนอแนะ" ด้วย FTS5 |
| `get_statistics` | สรุปสถิติความพึงพอใจรายหมวด |
| `get_survey_overview` | แสดงภาพรวมจำนวนผู้ตอบและข้อมูลสรุป |
| `get_improvements` | รวบรวมข้อเสนอแนะ/สิ่งที่ควรปรับปรุง |
| `get_impressions` | รวบรวมสิ่งที่ประทับใจ |
| `compare_groups` | เปรียบเทียบความพึงพอใจระหว่างกลุ่มผู้ตอบ |

## Docker Commands

```bash
# Start server
docker compose up -d

# View logs
docker compose logs -f

# Stop server
docker compose down

# Rebuild after changes
docker compose up -d --build
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /sse` | SSE connection for MCP |
| `POST /message` | Message endpoint for SSE |

## Tech Stack

- **Runtime:** Node.js 20
- **MCP SDK:** @modelcontextprotocol/sdk
- **Database:** SQLite + FTS5
- **Transport:** SSE (Server-Sent Events)

## License

MIT

## Related

- [สถาบันพลังจิตตานุภาพ](https://samathi101.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
