# Prompts for Software Documentation

รวม Prompt สำหรับขอเอกสารต่างๆ ที่จำเป็นในงานพัฒนา Software จาก AI Assistant

---

## Documentation Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOFTWARE DOCUMENTATION LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────────────────┘

  Phase 1: Planning          Phase 2: Design           Phase 3: Development
  ─────────────────          ───────────────           ────────────────────
  ┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐
  │ 1. PRD          │   →    │ 4. Architecture │   →   │ 7. API Docs     │
  │ 2. Requirements │        │ 5. Database     │       │ 8. Code Style   │
  │ 3. User Stories │        │ 6. UI/UX Spec   │       │ 9. README       │
  └─────────────────┘        └─────────────────┘       └─────────────────┘
                                                                │
  Phase 6: Maintenance       Phase 5: Operations       Phase 4: Testing
  ────────────────────       ───────────────────       ────────────────
  ┌─────────────────┐        ┌─────────────────┐       ┌─────────────────┐
  │ 15. Changelog   │   ←    │ 13. Deployment  │   ←   │ 10. Test Plan   │
  │ 16. Improvement │        │ 14. Runbook     │       │ 11. QA Checklist│
  │     Roadmap     │        │                 │       │ 12. Security    │
  └─────────────────┘        └─────────────────┘       └─────────────────┘
```

---

## Phase 1: Planning & Requirements

### 1. Product Requirements Document (PRD)

```
ช่วยสร้าง PRD (Product Requirements Document) สำหรับ project นี้หน่อย

ควรประกอบด้วย:
- Problem Statement
- Goals & Objectives
- Target Users
- Key Features (MVP)
- Success Metrics
- Constraints & Assumptions
- Timeline Overview
```

**Output:** `docs/PRD.md`

---

### 2. Software Requirements Specification (SRS)

```
ช่วยสร้าง Software Requirements Specification (SRS) สำหรับ project นี้

ครอบคลุม:
- Functional Requirements (FR)
- Non-Functional Requirements (NFR)
  - Performance
  - Security
  - Scalability
  - Availability
- System Constraints
- Dependencies
- Acceptance Criteria
```

**Output:** `docs/SRS.md`

---

### 3. User Stories & Use Cases

```
ช่วยเขียน User Stories สำหรับ project นี้

รูปแบบ:
- As a [user type], I want [goal], so that [benefit]
- Acceptance Criteria แต่ละ story
- Priority (Must/Should/Could/Won't)
- Story Points estimate

รวมถึง Use Case Diagrams ถ้าเป็นไปได้
```

**Output:** `docs/USER-STORIES.md`

---

## Phase 2: Design & Architecture

### 4. System Architecture Document

```
ช่วยทำเอกสารระบบ software ใน project นี้หน่อย

ต้องอธิบาย:
- Data flow ตั้งแต่ต้นจนจบ
- Component diagram
- Technology stack
- Integration points
- Deployment architecture
```

**Output:** `docs/SYSTEM-ARCHITECTURE.md`

---

### 5. Database Design Document

```
ช่วยสร้างเอกสาร Database Design สำหรับ project นี้

ประกอบด้วย:
- ER Diagram
- Table schemas พร้อม data types
- Indexes และเหตุผล
- Relationships (FK, constraints)
- Sample queries
- Migration strategy
```

**Output:** `docs/DATABASE-DESIGN.md`

---

### 6. UI/UX Specification (ถ้ามี Frontend)

```
ช่วยสร้าง UI/UX Specification สำหรับ project นี้

รวมถึง:
- Wireframes description
- User flow diagrams
- Component inventory
- Interaction patterns
- Responsive breakpoints
- Accessibility requirements (WCAG)
```

**Output:** `docs/UI-SPECIFICATION.md`

---

## Phase 3: Development

### 7. API Documentation

```
ช่วยสร้าง API Documentation สำหรับ project นี้

รูปแบบ:
- Endpoints list
- Request/Response format (JSON examples)
- Authentication method
- Error codes และ handling
- Rate limiting
- Versioning strategy

ถ้าเป็น MCP ให้อธิบาย Tools ทั้งหมดด้วย
```

**Output:** `docs/API-DOCUMENTATION.md`

---

### 8. Code Style Guide

```
ช่วยสร้าง Code Style Guide สำหรับ project นี้

ครอบคลุม:
- Naming conventions
- File/folder structure
- Code formatting rules
- Comment standards
- Git commit message format
- PR guidelines
- Code review checklist
```

**Output:** `docs/CODE-STYLE-GUIDE.md`

---

### 9. README Enhancement

```
ช่วยปรับปรุง README.md ให้สมบูรณ์

ควรมี:
- Project description (1-2 paragraphs)
- Features list
- Quick start (< 5 steps)
- Installation instructions
- Configuration options
- Usage examples
- Contributing guidelines
- License
```

**Output:** `README.md` (update)

---

## Phase 4: Testing

### 10. Test Plan

```
ช่วยสร้าง Test Plan สำหรับ project นี้

ประกอบด้วย:
- Test strategy (Unit/Integration/E2E)
- Test coverage goals
- Test cases list
- Test data requirements
- Testing tools
- CI/CD integration
```

**Output:** `docs/TEST-PLAN.md`

---

### 11. QA Checklist

```
ช่วยสร้าง QA Checklist สำหรับ project นี้

รวม:
- Functional testing checklist
- Edge cases
- Error handling scenarios
- Performance benchmarks
- Browser/device compatibility (ถ้ามี)
- Regression test cases
```

**Output:** `docs/QA-CHECKLIST.md`

---

### 12. Security Review Document

```
ช่วยทำ Security Review Document สำหรับ project นี้

วิเคราะห์:
- Authentication/Authorization
- Data validation
- SQL Injection prevention
- XSS prevention
- CSRF protection
- Secrets management
- Dependency vulnerabilities
- OWASP Top 10 checklist
```

**Output:** `docs/SECURITY-REVIEW.md`

---

## Phase 5: Operations

### 13. Deployment Guide

```
ช่วยสร้าง Deployment Guide สำหรับ project นี้

ครอบคลุม:
- Prerequisites
- Environment setup
- Step-by-step deployment
- Configuration management
- Docker/container instructions
- Cloud deployment (ถ้ามี)
- Rollback procedures
```

**Output:** `docs/DEPLOYMENT-GUIDE.md`

---

### 14. Operations Runbook

```
ช่วยสร้าง Operations Runbook สำหรับ project นี้

รวมถึง:
- Health check procedures
- Monitoring setup
- Log locations และ format
- Common issues และ solutions
- Incident response
- Backup/restore procedures
- Scaling guidelines
```

**Output:** `docs/RUNBOOK.md`

---

## Phase 6: Maintenance

### 15. Changelog

```
ช่วยสร้าง CHANGELOG.md สำหรับ project นี้

รูปแบบ Keep a Changelog:
- [Unreleased]
- [x.y.z] - YYYY-MM-DD
  - Added
  - Changed
  - Deprecated
  - Removed
  - Fixed
  - Security

ดึงข้อมูลจาก git log
```

**Output:** `CHANGELOG.md`

---

### 16. Improvement Roadmap

```
ช่วยวิเคราะห์จุดที่ควรปรับปรุงใน project นี้

พร้อม:
- Current issues/limitations
- Proposed solutions
- Priority ranking
- Effort estimation
- Implementation roadmap
- Quick wins ที่ทำได้เลย
```

**Output:** `docs/IMPROVEMENTS-ROADMAP.md`

---

## Quick Reference: One-liner Prompts

| # | Document | Quick Prompt |
|---|----------|--------------|
| 1 | PRD | "สร้าง PRD สำหรับ project นี้" |
| 2 | SRS | "สร้าง Software Requirements Specification" |
| 3 | User Stories | "เขียน User Stories พร้อม acceptance criteria" |
| 4 | Architecture | "ทำเอกสารระบบ software พร้อม data flow diagram" |
| 5 | Database | "สร้างเอกสาร Database Design พร้อม ER diagram" |
| 6 | UI Spec | "สร้าง UI/UX Specification" |
| 7 | API Docs | "สร้าง API Documentation พร้อม examples" |
| 8 | Code Style | "สร้าง Code Style Guide สำหรับทีม" |
| 9 | README | "ปรับปรุง README ให้สมบูรณ์" |
| 10 | Test Plan | "สร้าง Test Plan พร้อม test cases" |
| 11 | QA Checklist | "สร้าง QA Checklist สำหรับ release" |
| 12 | Security | "ทำ Security Review ตาม OWASP" |
| 13 | Deployment | "สร้าง Deployment Guide step-by-step" |
| 14 | Runbook | "สร้าง Operations Runbook" |
| 15 | Changelog | "สร้าง CHANGELOG จาก git history" |
| 16 | Roadmap | "วิเคราะห์จุดที่ควรปรับปรุง พร้อม roadmap" |

---

## Tips for Better Results

### 1. Provide Context First

```
ก่อนขอเอกสาร ให้ AI อ่าน codebase ก่อน:

"อ่าน source code ใน src/ และ package.json ก่อน
แล้วค่อยสร้าง [document name]"
```

### 2. Specify Output Format

```
"สร้าง API Documentation ในรูปแบบ OpenAPI/Swagger"
"สร้าง Architecture diagram แบบ ASCII art"
"สร้าง ER Diagram แบบ Mermaid syntax"
```

### 3. Request Incremental Updates

```
"อัพเดท README.md เฉพาะส่วน Installation"
"เพิ่ม section Security ใน ARCHITECTURE.md"
```

### 4. Ask for Specific Depth

```
"สร้าง PRD แบบย่อ 1 หน้า"
"สร้าง Architecture Document แบบละเอียด พร้อม code examples"
```

### 5. Chain Documents

```
"อ่าน PRD.md แล้วสร้าง User Stories ที่สอดคล้องกัน"
"อ่าน SRS.md แล้วสร้าง Test Plan ที่ครอบคลุม requirements"
```

---

## Folder Structure Recommendation

```
project/
├── README.md
├── CHANGELOG.md
├── CLAUDE.md              # AI context
├── ARCHITECTURE.md        # Quick reference
│
├── docs/
│   ├── PRD.md
│   ├── SRS.md
│   ├── USER-STORIES.md
│   ├── SYSTEM-ARCHITECTURE.md
│   ├── DATABASE-DESIGN.md
│   ├── API-DOCUMENTATION.md
│   ├── CODE-STYLE-GUIDE.md
│   ├── TEST-PLAN.md
│   ├── QA-CHECKLIST.md
│   ├── SECURITY-REVIEW.md
│   ├── DEPLOYMENT-GUIDE.md
│   ├── RUNBOOK.md
│   └── IMPROVEMENTS-ROADMAP.md
│
├── src/
├── tests/
└── ...
```

---

## Document Dependencies

```
PRD ─────────────────┐
                     ▼
           ┌─────────────────┐
           │      SRS        │
           └────────┬────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│User      │  │Database  │  │System    │
│Stories   │  │Design    │  │Arch      │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│Test Plan │  │API Docs  │  │Deployment│
└──────────┘  └──────────┘  └──────────┘
```

---

*Use these prompts with Claude Code or any AI assistant to generate comprehensive documentation for your software projects.*
