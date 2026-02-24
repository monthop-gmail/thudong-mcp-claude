import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const REPORTS_DIR = join(import.meta.dirname, 'reports');
const OUTPUT_DIR = join(import.meta.dirname, 'reports-pdf');

const reportFiles = [
  'executive-summary.md',
  'survey-overview.md',
  'swot-analysis.md',
  'top-impressions.md',
  'improvements-2569.md',
];

const CSS = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'TH Sarabun New', 'Loma', 'Garuda', 'Norasi', 'FreeSans', sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: #1a1a1a;
  padding: 40px 50px;
  max-width: 100%;
}

h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1a365d;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 3px solid #2b6cb0;
}

h2 {
  font-size: 19px;
  font-weight: 700;
  color: #2a4365;
  margin-top: 24px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1.5px solid #bee3f8;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2c5282;
  margin-top: 18px;
  margin-bottom: 6px;
}

h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin-top: 14px;
  margin-bottom: 4px;
}

p {
  margin-bottom: 10px;
}

hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 20px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}

th {
  background-color: #2b6cb0;
  color: white;
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
}

td {
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
}

tr:nth-child(even) {
  background-color: #f7fafc;
}

tr:hover {
  background-color: #ebf4ff;
}

strong {
  font-weight: 600;
  color: #1a365d;
}

ul, ol {
  margin: 8px 0 12px 24px;
}

li {
  margin-bottom: 4px;
}

blockquote {
  border-left: 4px solid #2b6cb0;
  padding: 8px 16px;
  margin: 12px 0;
  background-color: #ebf8ff;
  color: #2a4365;
  font-style: italic;
}

code {
  background-color: #edf2f7;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.footer {
  margin-top: 40px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  font-size: 11px;
  color: #a0aec0;
}
`;

async function convertMarkdownToPdf(mdFile) {
  const mdPath = join(REPORTS_DIR, mdFile);
  const pdfFile = basename(mdFile, '.md') + '.pdf';
  const pdfPath = join(OUTPUT_DIR, pdfFile);

  console.log(`  Converting: ${mdFile} → ${pdfFile}`);

  const markdown = readFileSync(mdPath, 'utf-8');
  const htmlContent = marked.parse(markdown);

  const fullHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
  ${htmlContent}
  <div class="footer">
    รายงานวิเคราะห์แบบสอบถามธุดงค์ พ.ศ. 2568 — วัดป่าร้อยปีหลวงพ่อวิริยังค์ จ.ราชบุรี
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-size:9px; font-family:sans-serif; color:#a0aec0; width:100%; text-align:center; padding:0 20mm;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>`,
  });

  await browser.close();
  console.log(`  ✓ Saved: ${pdfPath}`);
}

async function main() {
  console.log('=== แปลง Reports เป็น PDF ===\n');

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Process sequentially to avoid memory issues with multiple browser instances
  for (const file of reportFiles) {
    await convertMarkdownToPdf(file);
  }

  console.log(`\n✓ แปลงทั้งหมด ${reportFiles.length} ไฟล์เสร็จแล้ว!`);
  console.log(`📂 อยู่ที่: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
