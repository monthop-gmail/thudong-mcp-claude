#!/usr/bin/env node

/**
 * MCP Server with Streamable HTTP Transport
 * For web clients and remote connections
 */

import crypto from 'crypto';
import { createServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';

import {
    initDatabase,
    searchFeedback,
    getStatistics,
    getOverview,
    getImprovementsByTopic,
    getImpressionsByTopic,
    compareGroups,
    closeDb
} from './db.js';

const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Store active transports
const transports = new Map();

// Create HTTP server
const httpServer = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Health check
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'thudong-mcp-claude' }));
        return;
    }

    // Streamable HTTP endpoint
    if (url.pathname === '/mcp') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const jsonBody = JSON.parse(body);
                    const sessionId = req.headers['mcp-session-id'];

                    let transport;

                    if (sessionId && transports.has(sessionId)) {
                        transport = transports.get(sessionId);
                    } else if (!sessionId && isInitializeRequest(jsonBody)) {
                        transport = new StreamableHTTPServerTransport({
                            sessionIdGenerator: () => crypto.randomUUID(),
                            onsessioninitialized: (sid) => {
                                transports.set(sid, transport);
                            },
                        });
                        transport.onclose = () => {
                            const sid = transport.sessionId;
                            if (sid) transports.delete(sid);
                        };
                        const server = createMCPServer();
                        await server.connect(transport);
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            error: { code: -32000, message: 'Bad Request: No valid session ID' },
                            id: null,
                        }));
                        return;
                    }

                    await transport.handleRequest(req, res, jsonBody);
                } catch (err) {
                    console.error('MCP error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: String(err) }));
                }
            });
            return;
        }

        if (req.method === 'GET') {
            const sessionId = req.headers['mcp-session-id'];
            if (!sessionId || !transports.has(sessionId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
                return;
            }
            await transports.get(sessionId).handleRequest(req, res);
            return;
        }

        if (req.method === 'DELETE') {
            const sessionId = req.headers['mcp-session-id'];
            if (!sessionId || !transports.has(sessionId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
                return;
            }
            await transports.get(sessionId).handleRequest(req, res);
            return;
        }
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

/**
 * Create MCP server instance with all tools
 */
function createMCPServer() {
    const server = new Server(
        {
            name: 'thudong-mcp-claude',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // Define all tools
    const TOOLS = [
        {
            name: 'search_feedback',
            description: `ค้นหาความคิดเห็นจากแบบสอบถามธุดงค์ วัดป่าร้อยปีหลวงพ่อวิริยังค์ 12-15 ธ.ค. 2568
ใช้สำหรับค้นหาข้อความจาก:
- สิ่งที่ประทับใจมากที่สุด
- สิ่งที่ควรปรับปรุง/ข้อเสนอแนะ

ตัวอย่างคำค้น: อาหาร, พี่เลี้ยง, ห้องน้ำ, สถานที่, พระอาจารย์`,
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'คำค้นหา เช่น "อาหาร", "พี่เลี้ยง", "ห้องน้ำ"'
                    },
                    type: {
                        type: 'string',
                        enum: ['impressed', 'suggestion', 'all'],
                        description: 'ประเภทข้อความ: impressed=ประทับใจ, suggestion=ข้อเสนอแนะ, all=ทั้งหมด',
                        default: 'all'
                    },
                    limit: {
                        type: 'number',
                        description: 'จำนวนผลลัพธ์สูงสุด',
                        default: 10
                    }
                },
                required: ['query']
            }
        },
        {
            name: 'get_statistics',
            description: `สรุปสถิติความพึงพอใจรายหมวด จากแบบสอบถามธุดงค์ วัดป่าร้อยปี

หมวดที่มี:
- knowledge: ความรู้ที่ได้รับ (7 ข้อ)
- moral: คุณธรรมจริยธรรม (7 ข้อ)
- event: การจัดงาน (6 ข้อ)
- facility: สิ่งอำนวยความสะดวก (6 ข้อ)
- all: ทุกหมวด`,
            inputSchema: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        enum: ['knowledge', 'moral', 'event', 'facility', 'all'],
                        description: 'หมวดที่ต้องการดูสถิติ',
                        default: 'all'
                    },
                    respondent_type: {
                        type: 'string',
                        enum: ['student', 'staff', 'observer', 'all'],
                        description: 'กลุ่มผู้ตอบ: student=นักศึกษา, staff=คณะทำงาน, observer=ผู้สังเกตการณ์',
                        default: 'all'
                    }
                }
            }
        },
        {
            name: 'get_survey_overview',
            description: `แสดงภาพรวมของแบบสอบถามธุดงค์ วัดป่าร้อยปี
- จำนวนผู้ตอบทั้งหมด
- แยกตามประเภทผู้ตอบ
- จำนวนที่มีข้อความประทับใจ/ข้อเสนอแนะ`,
            inputSchema: {
                type: 'object',
                properties: {}
            }
        },
        {
            name: 'get_improvements',
            description: `รวบรวมข้อเสนอแนะ/สิ่งที่ควรปรับปรุง จัดกลุ่มตามหัวข้อ
หัวข้อที่พบบ่อย: ห้องน้ำ, อาหาร, ที่พัก, กำหนดการ, พื้น/หิน, สุนัข`,
            inputSchema: {
                type: 'object',
                properties: {
                    topic: {
                        type: 'string',
                        description: 'หัวข้อที่สนใจ เช่น "ห้องน้ำ", "อาหาร" (ถ้าไม่ระบุจะแสดงทั้งหมด)'
                    },
                    limit: {
                        type: 'number',
                        description: 'จำนวนผลลัพธ์สูงสุด',
                        default: 20
                    }
                }
            }
        },
        {
            name: 'get_impressions',
            description: `รวบรวมสิ่งที่ประทับใจ จัดกลุ่มตามหัวข้อ
หัวข้อที่พบบ่อย: พี่เลี้ยง, สถานที่, พระอาจารย์, อาหาร, กัลยาณมิตร, การเดินธุดงค์`,
            inputSchema: {
                type: 'object',
                properties: {
                    topic: {
                        type: 'string',
                        description: 'หัวข้อที่สนใจ เช่น "พี่เลี้ยง", "สถานที่" (ถ้าไม่ระบุจะแสดงทั้งหมด)'
                    },
                    limit: {
                        type: 'number',
                        description: 'จำนวนผลลัพธ์สูงสุด',
                        default: 20
                    }
                }
            }
        },
        {
            name: 'compare_groups',
            description: `เปรียบเทียบความพึงพอใจระหว่างกลุ่มผู้ตอบ (นักศึกษา vs คณะทำงาน vs ผู้สังเกตการณ์)`,
            inputSchema: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        enum: ['event', 'facility'],
                        description: 'หมวดที่ต้องการเปรียบเทียบ: event=การจัดงาน, facility=สิ่งอำนวยความสะดวก'
                    }
                },
                required: ['category']
            }
        }
    ];

    // Handle list tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: TOOLS };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            switch (name) {
                case 'search_feedback': {
                    const query = args.query;
                    const type = args.type || 'all';
                    const limit = args.limit || 10;

                    const results = searchFeedback(query, type, limit);

                    if (results.length === 0) {
                        return {
                            content: [{
                                type: 'text',
                                text: `ไม่พบผลลัพธ์สำหรับคำค้น "${query}"`
                            }]
                        };
                    }

                    let output = `## ผลการค้นหา "${query}"\n\n`;
                    output += `พบ ${results.length} รายการ\n\n`;

                    for (let i = 0; i < results.length; i++) {
                        const r = results[i];
                        output += `### ${i + 1}. ${r.respondent_type || 'ไม่ระบุ'}\n`;
                        if (r.impressed_text && (type === 'all' || type === 'impressed')) {
                            output += `**ประทับใจ:** ${r.impressed_text}\n\n`;
                        }
                        if (r.suggestion_text && (type === 'all' || type === 'suggestion')) {
                            output += `**ข้อเสนอแนะ:** ${r.suggestion_text}\n\n`;
                        }
                        output += '---\n\n';
                    }

                    return { content: [{ type: 'text', text: output }] };
                }

                case 'get_statistics': {
                    const category = args.category || 'all';
                    const respondentType = args.respondent_type || 'all';
                    const stats = getStatistics(category, respondentType);

                    if (Object.keys(stats).length === 0) {
                        return { content: [{ type: 'text', text: 'ไม่พบข้อมูลสถิติ' }] };
                    }

                    let output = `## สถิติความพึงพอใจ\n\n`;
                    output += `**หมวด:** ${category === 'all' ? 'ทุกหมวด' : category}\n`;
                    output += `**กลุ่มผู้ตอบ:** ${respondentType === 'all' ? 'ทุกกลุ่ม' : respondentType}\n\n`;

                    const grouped = {
                        'ความรู้ที่ได้รับ': [],
                        'คุณธรรมจริยธรรม': [],
                        'การจัดงาน': [],
                        'สิ่งอำนวยความสะดวก': []
                    };

                    for (const [key, value] of Object.entries(stats)) {
                        if (key.startsWith('knowledge_')) grouped['ความรู้ที่ได้รับ'].push(value);
                        else if (key.startsWith('moral_')) grouped['คุณธรรมจริยธรรม'].push(value);
                        else if (key.startsWith('event_')) grouped['การจัดงาน'].push(value);
                        else if (key.startsWith('facility_')) grouped['สิ่งอำนวยความสะดวก'].push(value);
                    }

                    for (const [groupName, items] of Object.entries(grouped)) {
                        if (items.length === 0) continue;
                        output += `### ${groupName}\n\n`;
                        output += '| หัวข้อ | คะแนนเฉลี่ย | ผู้ตอบ | ระดับ 5 | ระดับ 4 |\n';
                        output += '|--------|------------|-------|---------|----------|\n';
                        for (const item of items) {
                            output += `| ${item.label} | ${item.avg} | ${item.total} | ${item.percentage['ระดับ 5']}% | ${item.percentage['ระดับ 4']}% |\n`;
                        }
                        output += '\n';
                    }

                    return { content: [{ type: 'text', text: output }] };
                }

                case 'get_survey_overview': {
                    const overview = getOverview();
                    let output = `## ภาพรวมแบบสอบถามธุดงค์\n\n`;
                    output += `**สถานที่:** วัดป่าร้อยปีหลวงพ่อวิริยังค์ จ.ราชบุรี\n`;
                    output += `**วันที่:** 12-15 ธันวาคม พ.ศ. 2568\n\n`;
                    output += `### จำนวนผู้ตอบ: ${overview.total_responses} คน\n\n`;

                    for (const item of overview.by_respondent_type) {
                        const pct = Math.round(item.count / overview.total_responses * 100 * 10) / 10;
                        output += `- ${item.respondent_type}: ${item.count} คน (${pct}%)\n`;
                    }

                    output += `\n### ข้อความอิสระ\n`;
                    output += `- มีข้อความ "ประทับใจ": ${overview.with_impressed_text} รายการ\n`;
                    output += `- มีข้อความ "ข้อเสนอแนะ": ${overview.with_suggestion_text} รายการ\n`;

                    return { content: [{ type: 'text', text: output }] };
                }

                case 'get_improvements': {
                    const topic = args.topic;
                    const limit = args.limit || 20;
                    const results = getImprovementsByTopic(topic, limit);

                    let output = `## ข้อเสนอแนะ/สิ่งที่ควรปรับปรุง\n\n`;
                    if (topic) output += `**หัวข้อ:** ${topic}\n\n`;
                    output += `พบ ${results.length} รายการ\n\n`;

                    for (let i = 0; i < results.length; i++) {
                        output += `${i + 1}. ${results[i].suggestion_text}\n`;
                        output += `   _(${results[i].respondent_type})_\n\n`;
                    }

                    return { content: [{ type: 'text', text: output }] };
                }

                case 'get_impressions': {
                    const topic = args.topic;
                    const limit = args.limit || 20;
                    const results = getImpressionsByTopic(topic, limit);

                    let output = `## สิ่งที่ประทับใจ\n\n`;
                    if (topic) output += `**หัวข้อ:** ${topic}\n\n`;
                    output += `พบ ${results.length} รายการ\n\n`;

                    for (let i = 0; i < results.length; i++) {
                        output += `${i + 1}. ${results[i].impressed_text}\n`;
                        output += `   _(${results[i].respondent_type})_\n\n`;
                    }

                    return { content: [{ type: 'text', text: output }] };
                }

                case 'compare_groups': {
                    const category = args.category;
                    const comparison = compareGroups(category);

                    let output = `## เปรียบเทียบความพึงพอใจระหว่างกลุ่ม\n\n`;
                    output += `**หมวด:** ${category === 'event' ? 'การจัดงาน' : 'สิ่งอำนวยความสะดวก'}\n\n`;

                    output += '| หัวข้อ | นักศึกษา | คณะทำงาน | ผู้สังเกตการณ์ |\n';
                    output += '|--------|----------|----------|----------------|\n';

                    for (const [key, values] of Object.entries(comparison)) {
                        output += `| ${values.label} | ${values.student || '-'} | ${values.staff || '-'} | ${values.observer || '-'} |\n`;
                    }

                    return { content: [{ type: 'text', text: output }] };
                }

                default:
                    return {
                        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                        isError: true
                    };
            }
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    });

    return server;
}

// Handle shutdown
process.on('SIGINT', () => {
    closeDb();
    httpServer.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeDb();
    httpServer.close();
    process.exit(0);
});

// Start server
httpServer.listen(PORT, () => {
    console.log(`Thudong MCP Server (Streamable HTTP) running on http://localhost:${PORT}`);
    console.log(`Streamable HTTP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
