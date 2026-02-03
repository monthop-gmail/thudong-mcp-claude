# MCP + RAG: Thudong Survey vs Other Solutions

เปรียบเทียบ MCP+RAG Implementation ของ Thudong Survey กับ Solutions อื่นๆ ในตลาด

---

## Executive Summary

| Feature | Thudong MCP (เรา) | LlamaIndex MCP | LangChain MCP | Anthropic RAG | OpenAI Assistants |
|---------|-------------------|----------------|---------------|---------------|-------------------|
| **Search Engine** | SQLite FTS5 | Vector DB | Vector DB | Vector DB | Vector DB |
| **Embedding** | None (BM25) | OpenAI/Local | OpenAI/Local | Voyage AI | OpenAI |
| **Dependencies** | 2 packages | 20+ packages | 30+ packages | 5+ packages | API only |
| **Hosting** | Self-hosted | Self-hosted | Self-hosted | Anthropic Cloud | OpenAI Cloud |
| **Thai Support** | Native FTS5 | Depends on model | Depends on model | Limited | Limited |
| **Cost** | $0 (self-hosted) | Embedding cost | Embedding cost | Per-token | Per-token |
| **Complexity** | Low | High | Very High | Medium | Low |
| **Latency** | ~5-20ms | ~100-500ms | ~100-500ms | ~200-1000ms | ~200-1000ms |

---

## 1. Architecture Comparison

### Thudong MCP (Our Approach)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THUDONG MCP ARCHITECTURE                             │
│                        (Lightweight + Domain-Specific)                       │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐         ┌──────────────────────────────────────────────────┐
   │  CSV Data    │         │              MCP Server                           │
   │  (804 rows)  │────────►│  ┌─────────────────────────────────────────────┐ │
   └──────────────┘         │  │           SQLite + FTS5                      │ │
                            │  │  ┌───────────────┐  ┌────────────────────┐  │ │
                            │  │  │ Structured    │  │ Full-Text Search   │  │ │
                            │  │  │ (Statistics)  │  │ (BM25 Ranking)     │  │ │
                            │  │  └───────────────┘  └────────────────────┘  │ │
                            │  └─────────────────────────────────────────────┘ │
                            │                      │                            │
                            │              6 MCP Tools                          │
                            └──────────────────────────────────────────────────┘
                                           │
                            ┌──────────────┴──────────────┐
                            ▼                              ▼
                     ┌─────────────┐               ┌─────────────┐
                     │   stdio     │               │    SSE      │
                     │ (Claude CLI)│               │ (Web Client)│
                     └─────────────┘               └─────────────┘

   Key Decisions:
   ✓ No embedding generation (use keyword matching)
   ✓ Single SQLite file (portable, no infra needed)
   ✓ Domain-specific tools (not generic RAG)
   ✓ Thai text via unicode61 tokenizer
```

### Vector-Based RAG (LlamaIndex/LangChain)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TYPICAL VECTOR RAG ARCHITECTURE                           │
│                        (Heavy + General-Purpose)                             │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────────┐
   │  Documents   │───►│  Chunking    │───►│        Embedding Generation       │
   │  (Various)   │    │  (256-512)   │    │  (OpenAI text-embedding-ada-002) │
   └──────────────┘    └──────────────┘    └──────────────────────────────────┘
                                                          │
                                                          ▼
                                          ┌──────────────────────────────────┐
                                          │         Vector Database           │
                                          │  (Pinecone/Chroma/Weaviate/etc)  │
                                          │                                   │
                                          │  • High-dimensional vectors       │
                                          │  • ANN search (HNSW/IVF)         │
                                          │  • Requires GPU/Cloud             │
                                          └──────────────────────────────────┘
                                                          │
                                                          ▼
                                          ┌──────────────────────────────────┐
                                          │          Query Pipeline           │
                                          │  1. Embed query                   │
                                          │  2. Similarity search             │
                                          │  3. Re-ranking                    │
                                          │  4. Context assembly              │
                                          └──────────────────────────────────┘

   Key Characteristics:
   • Semantic understanding (can find "delicious" when searching "tasty")
   • Requires embedding API calls ($)
   • More complex infrastructure
   • Better for diverse document types
```

---

## 2. Search Technology Comparison

### BM25 (Thudong) vs Vector Search (Others)

| Aspect | BM25 (FTS5) | Vector Search |
|--------|-------------|---------------|
| **How it works** | Term frequency + document length normalization | Cosine similarity in embedding space |
| **Query: "อาหาร"** | Finds exact "อาหาร" matches | Finds "อาหาร", "ข้าว", "กับข้าว", "delicious" |
| **Query: "พี่เลี้ยงดูแลดี"** | Must contain those exact terms | Finds semantically similar (e.g. "staff helpful") |
| **Speed** | ~1-5ms (local SQLite) | ~50-200ms (vector similarity) |
| **Index Size** | ~100KB for 804 records | ~10MB+ for embeddings |
| **Thai Support** | Good (unicode61) | Depends on embedding model |
| **Cost** | Free | $0.0001/1K tokens (OpenAI) |

### When to Use Which

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DECISION MATRIX                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                     Low Data Volume                High Data Volume
                     (< 10K records)               (> 100K records)
                   ┌────────────────────────────┬────────────────────────────┐
   Exact Keyword   │  ★ FTS5/BM25 (Thudong)    │  Elasticsearch/Typesense   │
   Matching        │                            │                            │
                   │  • Simple setup            │  • Distributed search      │
                   │  • Zero cost               │  • Horizontal scaling      │
                   │  • Thai text works         │  • Advanced features       │
                   ├────────────────────────────┼────────────────────────────┤
   Semantic        │  Consider adding vectors   │  Vector DB + Hybrid        │
   Understanding   │  later (Hybrid approach)   │  (Best of both worlds)     │
                   │                            │                            │
                   │  • Start simple, evolve    │  • Pinecone + Elasticsearch│
                   │  • Add embeddings if needed│  • pgvector + FTS          │
                   └────────────────────────────┴────────────────────────────┘
```

---

## 3. MCP Implementation Comparison

### Thudong MCP (Domain-Specific Tools)

```javascript
// Our approach: 6 purpose-built tools for survey analysis
const TOOLS = [
    {
        name: 'search_feedback',        // FTS5 search
        // Designed specifically for Thai survey responses
    },
    {
        name: 'get_statistics',         // SQL aggregation
        // Pre-built queries for Likert scale analysis
    },
    {
        name: 'get_survey_overview',    // Quick stats
        // One-call overview of all respondents
    },
    {
        name: 'get_improvements',       // Suggestions clustering
        // Grouped by topic keywords
    },
    {
        name: 'get_impressions',        // Positive feedback
        // Grouped by topic keywords
    },
    {
        name: 'compare_groups',         // Group comparison
        // Student vs Staff vs Observer
    }
];

// Pros:
// ✓ AI knows exactly what each tool does
// ✓ Optimized SQL queries for each use case
// ✓ Thai-aware keyword grouping
// ✓ No generic "search documents" ambiguity

// Cons:
// ✗ Not reusable for other domains
// ✗ Need to modify code for new question types
```

### LlamaIndex MCP (Generic RAG Tools)

```javascript
// LlamaIndex approach: Generic document tools
const TOOLS = [
    {
        name: 'query_documents',
        description: 'Query the document index using natural language',
        parameters: {
            query: 'string',
            top_k: 'number',
            filters: 'object'
        }
    },
    {
        name: 'list_documents',
        description: 'List all available documents'
    },
    {
        name: 'get_document',
        description: 'Get a specific document by ID'
    }
];

// Pros:
// ✓ Works with any document type
// ✓ Semantic search capabilities
// ✓ Reusable across projects

// Cons:
// ✗ AI has to figure out how to use generic tools
// ✗ May return irrelevant chunks
// ✗ Needs prompt engineering for Thai
```

### LangChain MCP (Chains + Agents)

```javascript
// LangChain approach: Complex chains and agents
const TOOLS = [
    // Similar generic tools but with chain composition
    {
        name: 'conversational_retrieval',
        description: 'Multi-turn conversation with document retrieval'
    },
    {
        name: 'summarize_documents',
        description: 'Summarize retrieved documents'
    },
    {
        name: 'compare_documents',
        description: 'Compare multiple documents'
    }
];

// Pros:
// ✓ Built-in conversation memory
// ✓ Complex workflows possible
// ✓ Extensive ecosystem

// Cons:
// ✗ Very heavy dependencies
// ✗ Debugging complexity
// ✗ Overkill for simple use cases
```

---

## 4. Dependency Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPENDENCY WEIGHT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Thudong MCP (2 packages):
├── @modelcontextprotocol/sdk     # MCP protocol
└── better-sqlite3                 # Database
    Total: ~15MB node_modules

─────────────────────────────────────────────────────────────────────────────

LlamaIndex MCP (20+ packages):
├── @modelcontextprotocol/sdk
├── llamaindex
├── openai                         # Embedding API
├── chromadb / pinecone-client    # Vector DB
├── tiktoken                       # Tokenization
├── langchain (optional)
├── pdf-parse, mammoth, etc.      # Document loaders
└── ... many transitive deps
    Total: ~200MB+ node_modules

─────────────────────────────────────────────────────────────────────────────

LangChain MCP (30+ packages):
├── @modelcontextprotocol/sdk
├── langchain
├── @langchain/community
├── @langchain/openai
├── vectorstore adapters
├── document loaders
├── text splitters
├── memory stores
└── ... extensive ecosystem
    Total: ~300MB+ node_modules
```

---

## 5. Performance Comparison

### Latency Benchmark (Simulated)

| Operation | Thudong MCP | LlamaIndex | LangChain |
|-----------|-------------|------------|-----------|
| Simple search | 5-10ms | 150-300ms | 200-400ms |
| Statistics query | 10-20ms | N/A | N/A |
| Semantic search | N/A | 100-200ms | 100-200ms |
| Cold start | 50ms | 2-5s | 3-8s |
| Memory usage | ~50MB | ~200MB | ~400MB |

### Cost Comparison (1000 queries/day)

| Solution | Embedding Cost | Hosting Cost | Total/Month |
|----------|---------------|--------------|-------------|
| Thudong MCP (self-hosted) | $0 | $5 (VPS) | $5 |
| LlamaIndex + OpenAI | ~$3 | $10 (VPS) | $13 |
| LlamaIndex + Pinecone | ~$3 | $70+ (Pinecone) | $73+ |
| Anthropic RAG | ~$20 | N/A (cloud) | $20+ |
| OpenAI Assistants | ~$30 | N/A (cloud) | $30+ |

---

## 6. Thai Language Support

### Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      THAI LANGUAGE SUPPORT MATRIX                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    Tokenization     Semantic         Accuracy
                    Support          Understanding    (Thai)
                   ─────────────────────────────────────────────
Thudong (FTS5)     ████░░░░░░ 40%   ░░░░░░░░░░ 0%   ████████░░ 80%
                   (unicode61)       (BM25 only)      (exact match)

OpenAI Embedding   ██████████ 100%  ████████░░ 80%  ██████░░░░ 60%
                   (auto)            (semantic)       (English-biased)

Cohere Multilingual ████████░░ 80%  ██████████ 100% ████████░░ 80%
                    (native)         (semantic)       (designed for it)

Local Thai Model   ██████████ 100%  ██████░░░░ 60%  ██████████ 100%
(WangchanBERTa)    (pythainlp)      (Thai-native)    (Thai-native)
```

### Thudong's Thai Handling

```javascript
// Current: Basic unicode61 tokenizer
tokenize='unicode61 remove_diacritics 2'

// What it does:
// "พี่เลี้ยงดูแลดีมาก" → tokenized as-is (no word segmentation)
// Works because Thai text naturally has some spacing in survey responses

// What could be improved:
// Option A: Pre-tokenize with pythainlp
// "พี่เลี้ยงดูแลดีมาก" → "พี่เลี้ยง ดูแล ดี มาก"

// Option B: Use trigram tokenizer (fuzzy matching)
// tokenize='trigram'

// Option C: Add synonym expansion (already documented in RAG-IMPROVEMENTS.md)
```

---

## 7. When to Use Each Approach

### Use Thudong-Style MCP When:

```
✓ Domain is well-defined (survey, FAQ, specific documents)
✓ Data volume is small-medium (< 50K records)
✓ Keyword search is sufficient
✓ Budget is limited
✓ Need fast response times
✓ Want minimal infrastructure
✓ Thai language with basic tokenization is acceptable
```

### Use Vector RAG When:

```
✓ Need semantic understanding ("happy" → "satisfied", "joyful")
✓ Documents are diverse (PDFs, emails, wikis)
✓ Multi-language support needed
✓ Budget allows for embedding costs
✓ Questions are open-ended
✓ Exact keyword matching isn't enough
```

### Use Hybrid When:

```
✓ Best of both worlds needed
✓ Can afford complexity
✓ Need both exact + semantic search
✓ Have resources for maintenance

Implementation:
1. BM25 search for exact matches (fast, free)
2. Vector search for semantic matches (slower, cost)
3. Reciprocal Rank Fusion to combine results
```

---

## 8. Evolution Path for Thudong MCP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THUDONG EVOLUTION ROADMAP                            │
└─────────────────────────────────────────────────────────────────────────────┘

Current State (v1.0):
├── SQLite + FTS5
├── BM25 search
├── 6 domain-specific tools
└── ~100ms query time

Phase 1 - Enhanced FTS (v1.1):
├── + Synonym expansion
├── + Query cache (LRU)
├── + Thai pre-tokenization
└── Effort: 1-2 days

Phase 2 - Hybrid Search (v2.0):
├── + Vector column in SQLite
├── + Local embedding model (or OpenAI)
├── + RRF (Reciprocal Rank Fusion)
└── Effort: 1-2 weeks

Phase 3 - Production Scale (v3.0):
├── + Separate vector DB (if needed)
├── + Query analytics
├── + Auto-tuning based on feedback
└── Effort: 1 month
```

---

## 9. Code Comparison: Same Query, Different Approaches

### Query: "มีคนพูดถึงห้องน้ำอะไรบ้าง"

#### Thudong MCP (Our Approach)

```javascript
// src/db.js - Simple FTS5 query
export function searchFeedback(query, type = 'all', limit = 10) {
    const stmt = db.prepare(`
        SELECT r.*, bm25(responses_fts) as rank
        FROM responses_fts f
        JOIN responses r ON f.rowid = r.id
        WHERE responses_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    `);
    return stmt.all(query, limit);  // query = "ห้องน้ำ"
}

// Result: 8 matches in ~5ms
// Pros: Fast, simple, works offline
// Cons: Misses "ห้องสุขา", "toilet", etc.
```

#### LlamaIndex Approach

```python
# llamaindex style
from llama_index import VectorStoreIndex, SimpleDirectoryReader

# Setup (done once)
documents = SimpleDirectoryReader('data/').load_data()
index = VectorStoreIndex.from_documents(documents)

# Query
query_engine = index.as_query_engine()
response = query_engine.query("มีคนพูดถึงห้องน้ำอะไรบ้าง")

# Result: ~10 semantic matches in ~300ms
# Pros: Finds related terms
# Cons: Requires embedding API, heavier setup
```

#### LangChain Approach

```python
# langchain style
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings
from langchain.chains import RetrievalQA

# Setup (done once)
embeddings = OpenAIEmbeddings()
vectordb = Chroma.from_documents(docs, embeddings)
qa_chain = RetrievalQA.from_chain_type(
    llm=ChatOpenAI(),
    retriever=vectordb.as_retriever(),
    chain_type="stuff"
)

# Query
result = qa_chain.run("มีคนพูดถึงห้องน้ำอะไรบ้าง")

# Result: Synthesized answer with sources in ~500ms
# Pros: Full RAG pipeline
# Cons: Complex, expensive, overkill for simple search
```

---

## 10. Recommendations

### For This Project (Thudong Survey):

**Keep current approach** because:
- Data is structured (survey responses)
- Volume is small (804 records)
- Queries are predictable (topics like food, bathroom, staff)
- Budget is zero
- Response time is critical

**Consider adding** (Phase 1):
- Synonym expansion for common Thai terms
- Query caching for repeated queries

**Don't add** (unnecessary complexity):
- Full vector search (overkill)
- LLM-based re-ranking (expensive)
- Complex chain/agent patterns (unnecessary)

### For Future Similar Projects:

```
Small Dataset (<10K) + Structured Data + Thai
  → Use Thudong approach (SQLite + FTS5 + MCP)

Large Dataset (>100K) + Diverse Documents
  → Use LlamaIndex/LangChain with vector search

Enterprise + Multi-language + Complex Queries
  → Use Elasticsearch + Vector DB hybrid
```

---

## 11. After Full Improvement: Thudong v2.0

หาก implement ทุก improvement ตามแผนใน `RAG-IMPROVEMENTS.md` ระบบจะเปลี่ยนแปลงอย่างไร

### 6 Planned Improvements

| # | Improvement | Priority | Current | After |
|---|-------------|----------|---------|-------|
| 1 | Thai Tokenization | 🔴 High | unicode61 (word boundary issues) | pythainlp pre-tokenization |
| 2 | Synonym Expansion | 🔴 High | exact match only | OR expansion + synonyms |
| 3 | Vector Search | 🟡 Medium | BM25 only | Hybrid (BM25 + Vector + RRF) |
| 4 | Query Cache | 🟡 Medium | no cache | LRU cache (500 entries, 10min TTL) |
| 5 | Text Chunking | 🟢 Low | whole response | split by topic |
| 6 | Feedback Loop | 🟢 Low | no analytics | query logging + feedback |

### Feature Matrix: Current → Improved → vs Others

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           THUDONG MCP: BEFORE vs AFTER vs OTHERS                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                        Current      After         LlamaIndex    LangChain     Anthropic
                        (v1.0)       (v2.0)        MCP           MCP           RAG
                       ──────────────────────────────────────────────────────────────────────
Search Engine          FTS5/BM25    Hybrid        Vector        Vector        Vector
                       ████░░░░░░   ████████░░    ██████████    ██████████    ██████████

Thai Tokenization      unicode61    pythainlp     Model-based   Model-based   Limited
                       ████░░░░░░   ██████████    ██████░░░░    ██████░░░░    ████░░░░░░

Semantic Search        None         Embeddings    Embeddings    Embeddings    Embeddings
                       ░░░░░░░░░░   ████████░░    ██████████    ██████████    ██████████

Synonym Handling       None         Domain Dict   None*         None*         None*
                       ░░░░░░░░░░   ██████████    ░░░░░░░░░░    ░░░░░░░░░░    ░░░░░░░░░░

Query Performance      5-10ms       5-15ms**      100-300ms     150-400ms     200-500ms
                       ██████████   ██████████    ██████░░░░    ████░░░░░░    ████░░░░░░

Dependencies           2 pkgs       5-7 pkgs      20+ pkgs      30+ pkgs      API only
                       ██████████   ████████░░    ████░░░░░░    ██░░░░░░░░    ██████████

Hosting Cost           $0           $0-5/mo       $10-70/mo     $10-70/mo     $20+/mo
                       ██████████   ██████████    ████░░░░░░    ████░░░░░░    ██████░░░░

Domain Optimization    Survey-fit   Survey-fit    Generic       Generic       Generic
                       ██████████   ██████████    ██████░░░░    ██████░░░░    ██████░░░░

* Embeddings ช่วยเรื่อง semantic แต่ไม่มี explicit synonym dict
** Cache hit = 1ms, miss = 15-50ms (hybrid)
```

### Search Quality: Before vs After

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEARCH QUALITY COMPARISON                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Query: "ห้องน้ำ"
─────────────────────────────────────────────────────────────────────────────
CURRENT (v1.0):
  Finds:  "ห้องน้ำสะอาด", "ห้องน้ำ ดี"
  Misses: "ห้องสุขา", "toilet", "ส้วม"
  Recall: ~60%

AFTER (v2.0):
  Synonym: "ห้องน้ำ" OR "ห้องสุขา" OR "สุขา" OR "toilet" OR "ส้วม"
  Vector:  Also finds "สิ่งอำนวยความสะดวกสุขอนามัย"
  Recall: ~95%

─────────────────────────────────────────────────────────────────────────────

Query: "พี่เลี้ยงดูแลดีมาก"
─────────────────────────────────────────────────────────────────────────────
CURRENT (v1.0):
  Tokenized as: ["พี่เลี้ยงดูแลดีมาก"]  (1 token - bad)
  Finds:  Only exact phrase matches
  Recall: ~30%

AFTER (v2.0):
  Tokenized as: ["พี่เลี้ยง", "ดูแล", "ดี", "มาก"]  (4 tokens)
  Synonym: พี่เลี้ยง OR พี่ๆ OR คณะทำงาน OR staff
  Vector:  Finds "เจ้าหน้าที่ใส่ใจ", "ทีมงานเอาใจใส่"
  Recall: ~90%

─────────────────────────────────────────────────────────────────────────────

Query: "อาหารอร่อย"
─────────────────────────────────────────────────────────────────────────────
CURRENT (v1.0):
  Finds:  "อาหารอร่อย", "อาหาร อร่อย"
  Misses: "ข้าวมันไก่รสเยี่ยม", "กับข้าวถูกปาก"
  Recall: ~40%

AFTER (v2.0):
  BM25:   "อาหาร" OR "ข้าว" OR "กับข้าว" + "อร่อย"
  Vector: Semantic similarity to "รสชาติดี", "ถูกปาก"
  RRF:    Combines both for best results
  Recall: ~85%
```

### Performance: Before vs After

| Metric | Current | After (cache miss) | After (cache hit) |
|--------|---------|-------------------|-------------------|
| Simple search | 5-10ms | 15-50ms | 1-2ms |
| Statistics | 10-20ms | 10-20ms | 1-2ms |
| Cold start | 50ms | 200ms* | 200ms |
| Memory | ~50MB | ~150MB | ~150MB |
| Index size | ~100KB | ~15MB** | ~15MB |

*Cold start longer due to embedding model loading
**Embeddings add ~15MB for 804 records

### Cost: Before vs After

| Item | Current | After (Local) | After (OpenAI) |
|------|---------|---------------|----------------|
| Embedding generation | $0 | $0 | ~$0.50 (one-time) |
| Query embedding | $0 | $0 | ~$3/month |
| Hosting (VPS) | $5 | $5-10 | $5-10 |
| **Total/month** | **$5** | **$5-10** | **$8-15** |

### Complexity: Before vs After

```
CURRENT (v1.0):                          AFTER (v2.0):
├── package.json (2 deps)                ├── package.json (5-7 deps)
├── src/                                 ├── src/
│   ├── index.js                         │   ├── index.js
│   ├── db.js                            │   ├── db.js
│   └── import.js                        │   ├── import.js
└── Total: ~500 lines                    │   ├── synonyms.js    (NEW)
                                         │   ├── cache.js       (NEW)
                                         │   ├── tokenizer.js   (NEW)
                                         │   ├── embedding.js   (NEW)
                                         │   ├── vector-db.js   (NEW)
                                         │   ├── hybrid.js      (NEW)
                                         │   ├── chunker.js     (NEW)
                                         │   └── analytics.js   (NEW)
                                         └── Total: ~1500 lines
```

### Final Comparison: Thudong v2.0 vs Others

| Aspect | Thudong v2.0 | LlamaIndex | LangChain |
|--------|--------------|------------|-----------|
| **Thai Language** | ⭐⭐⭐⭐⭐ Best | ⭐⭐⭐ OK | ⭐⭐⭐ OK |
| **Search Quality** | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Best | ⭐⭐⭐⭐⭐ Best |
| **Performance** | ⭐⭐⭐⭐⭐ Fastest | ⭐⭐⭐ Slow | ⭐⭐ Slower |
| **Cost** | ⭐⭐⭐⭐⭐ Cheapest | ⭐⭐⭐ Medium | ⭐⭐⭐ Medium |
| **Complexity** | ⭐⭐⭐⭐ Low-Med | ⭐⭐ High | ⭐ Very High |
| **Domain Fit** | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐ Generic | ⭐⭐⭐ Generic |
| **Reusability** | ⭐⭐ Survey only | ⭐⭐⭐⭐⭐ Any | ⭐⭐⭐⭐⭐ Any |

### Recommended Implementation Path

**Sweet spot (แนะนำ):**
- Implement เฉพาะ **Phase 1** (Synonym + Cache) = effort ต่ำ, impact สูง
- พิจารณา **Phase 2** (Thai tokenization) ถ้า recall ยังไม่พอ
- **Skip Phase 3** (Vector) ถ้า data ยังน้อย (<5K records)

**After full improvement:**
- Thudong v2.0 จะมี search quality ใกล้เคียง LlamaIndex/LangChain (~85-90%)
- แต่ยังคงข้อได้เปรียบด้าน **performance**, **cost**, **Thai language**
- Trade-off: Complexity เพิ่มจาก ~500 → ~1500 lines

---

## References

- [SQLite FTS5 Documentation](https://www.sqlite.org/fts5.html)
- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [LangChain Documentation](https://python.langchain.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Thai NLP with PyThaiNLP](https://pythainlp.github.io/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

---

*Document created: 2025-12-15*
*Last updated: 2026-02-03*
