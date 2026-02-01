# thudong-mcp-claude

MCP Server สำหรับ RAG ข้อมูลแบบสอบถาม **"หลังการสอบภาคสนามธุดงค์"**

- **สถานที่:** วัดป่าร้อยปีหลวงพ่อวิริยังค์ จ.ราชบุรี
- **วันที่:** 12-15 ธันวาคม พ.ศ. 2568

## Features

- ค้นหาความคิดเห็นด้วย Full-Text Search (FTS5)
- สถิติความพึงพอใจรายหมวด
- เปรียบเทียบระหว่างกลุ่มผู้ตอบ
- รองรับทั้ง stdio และ SSE transport
- Docker ready

## Quick Stats

| รายการ | จำนวน |
|--------|-------|
| ผู้ตอบทั้งหมด | 804 คน |
| นักศึกษาสอบภาคสนาม | 690 คน (85.8%) |
| คณะทำงาน | 105 คน (13.1%) |
| ผู้สังเกตการณ์ | 9 คน (1.1%) |
| ข้อความ "ประทับใจ" | 660 รายการ |
| ข้อความ "ข้อเสนอแนะ" | 510 รายการ |

## Installation

```bash
# Clone repository
git clone https://github.com/monthop-gmail/thudong-mcp-claude.git
cd thudong-mcp-claude

# Install dependencies
npm install

# Import data to SQLite
npm run import

# Start MCP server
npm run start
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

## Usage with Claude Desktop

เพิ่มใน `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "thudong": {
      "command": "node",
      "args": ["/path/to/thudong-mcp-claude/src/index.js"]
    }
  }
}
```

## Docker

```bash
# Build image
docker build -t thudong-mcp-claude .

# Run (stdio mode)
docker run -i --rm thudong-mcp-claude

# Run (SSE mode on port 3000)
docker run -p 3000:3000 thudong-mcp-claude node src/server-sse.js
```

## Example Prompts

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

## Data Structure

### 4 หมวดหลัก (32 คอลัมน์)

1. **ความรู้ที่ได้รับ** (8 ข้อ) - เฉพาะนักศึกษา
   - ประวัติหลวงพ่อ, เกร็ดธรรมะ, สมาธิ, การธุดงค์, ประโยชน์สมาธิ, ชวนะจิต, การนำไปใช้
   - Scale: มากที่สุด(5) → น้อยที่สุด(1)

2. **คุณธรรมจริยธรรม** (8 ข้อ) - เฉพาะนักศึกษา
   - เมตตา, เหตุผล, รับผิดชอบ, วินัย, อดทน, เสียสละ, ให้อภัย
   - Scale: มากที่สุด(5) → น้อยที่สุด(1)

3. **การจัดงาน** (6 ข้อ) - ทุกกลุ่ม
   - กำหนดการ, เส้นทาง, พี่เลี้ยง, ศาสนพิธี, พิธีกล่าวความรู้สึก, ตรงวัตถุประสงค์
   - Scale: พอใจมากที่สุด(5) → พอใจน้อยที่สุด(1)

4. **สิ่งอำนวยความสะดวก** (6 ข้อ) - ทุกกลุ่ม
   - ประชาสัมพันธ์, ประสานงาน, บรรยากาศ, ที่พัก, อาหาร, ห้องน้ำ
   - Scale: พอใจมากที่สุด(5) → พอใจน้อยที่สุด(1)

5. **ข้อความอิสระ** (2 ข้อ) - RAG Target
   - สิ่งที่ประทับใจมากที่สุด
   - สิ่งที่ควรปรับปรุง/ข้อเสนอแนะ

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **MCP SDK:** @modelcontextprotocol/sdk
- **Database:** SQLite + FTS5 (better-sqlite3)
- **Transport:** stdio / SSE

## Development

```bash
npm run start          # Production (stdio)
npm run start:sse      # Production (SSE on port 3000)
npm run dev            # Development with watch
npm run import         # Import CSV to database
npm run test:db        # Test database operations
```

## License

MIT

## Related

- [สถาบันพลังจิตตานุภาพ](https://samathi101.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
