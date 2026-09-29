# Quality Assurance & Verification Strategy

**Product:** AgentWiki  
**Testing Philosophy:** Test-Driven Development (TDD) — Verify Through Execution  
**Coverage Target:** $\ge 85\%$ line and branch coverage across core components  

---

## 1. Test Architecture & Directory Structure

```
tests/
├── fixtures/
│   ├── sample_openapi.json       # Realistic multi-endpoint OpenAPI 3.0 spec
│   ├── sample_doc.md             # Verbose human-oriented markdown doc with images & HTML
│   └── sample_proposals/         # Mock agent findings
├── unit/
│   ├── storage.test.ts           # Tests markdown file serialization, YAML frontmatter, path security
│   ├── indexer.test.ts           # Tests SQLite FTS5 table creation, BM25 search, graph relations
│   ├── openapi_parser.test.ts    # Tests endpoint extraction, parameter parsing, schema compression
│   └── markdown_parser.test.ts   # Tests prose stripping, heading hierarchy, atomic chunking
├── integration/
│   ├── mcp_tools.test.ts         # Tests full MCP server lifecycle and all 4 tool calls over stdio/in-memory
│   └── cli_workflow.test.ts      # Tests init -> compile -> serve -> review end-to-end
└── benchmarks/
    └── compression_benchmark.ts  # Measures Token Compression Ratio (TCR) & SQLite query latency
```

---

## 2. Test Suites Specification

### Suite 1: Storage & Serialization (`storage.test.ts`)
* **Test Cases:**
  1. `writePage()` writes a valid `.agentwiki/pages/{id}.md` file with correct YAML frontmatter.
  2. `readPage()` parses YAML frontmatter and markdown body without data corruption.
  3. `deletePage()` removes file cleanly and handles non-existent IDs gracefully.
  4. **Security Test:** IDs with path traversal attempts (`../../etc/passwd` or `..\hack`) are strictly rejected.
  5. `listPages()` correctly lists all active entity files.

### Suite 2: SQLite FTS5 & Graph Indexer (`indexer.test.ts`)
* **Test Cases:**
  1. `initDatabase()` creates `entities`, `entities_fts`, `relations`, and `entity_tags` tables idempotently.
  2. `indexPage()` inserts and updates records across tables atomically.
  3. `search()` performs BM25-ranked full-text search and returns sorted matches.
  4. `search()` respects category filtering (`category = 'api'`).
  5. `getRelations()` correctly queries bidirectional graph edges (`requires`, `supersedes`, `related`).
  6. **Performance Test:** Search against 1,000 indexed entities completes in $\le 10\text{ms}$.

### Suite 3: Ingestion Parsers (`openapi_parser.test.ts`, `markdown_parser.test.ts`)
* **Test Cases:**
  1. Extracts HTTP method, path, operationId, parameters, request body, and responses.
  2. Identifies required vs optional parameters and enum constraints.
  3. Extracts error recovery codes (4xx, 5xx) with descriptions.
  4. Generates unique, URL-safe entity IDs (e.g., `post_v1_checkout_sessions`).
  5. Strips HTML tags, base64 images, and conversational filler from markdown docs.

### Suite 4: MCP Protocol Server (`mcp_tools.test.ts`)
* **Test Cases:**
  1. MCP server initializes and lists all 4 tools (`search`, `read`, `explore_relations`, `propose_update`).
  2. Calling `agentwiki_search` returns token-budgeted array of entities.
  3. Calling `agentwiki_read` returns clean atomic markdown $< 400$ tokens.
  4. Calling `agentwiki_explore_relations` returns valid dependency graph edges.
  5. Calling `agentwiki_propose_update` stages a proposal file in `.agentwiki/proposals/`.

---

## 3. Benchmark Harness: Token Compression Ratio (TCR)

We measure the single most critical economic metric:
$$\text{TCR} = 1 - \frac{\text{Tokens}(\text{AgentWiki Page})}{\text{Tokens}(\text{Raw Source Input})}$$

* **Target:** $\text{TCR} \ge 70\%$.
* **Measurement:** Token counter using standard cl100k_base / GPT-4 tokenizer estimate ($1 \text{ token} \approx 4 \text{ chars}$).
* **Execution:** Automated benchmark script `npm run benchmark` fails CI if TCR drops below 65%.

---

## 4. Definition of Done (DoD) for Entire Phase 1

1. **Compilation:** TypeScript builds with 0 errors (`npm run build`).
2. **Tests:** All test suites pass with 100% success rate (`npm test`).
3. **Lint & Format:** Strict zero-warning lint check.
4. **Dogfooding:** Ingest an actual OpenAPI spec and run 5 successful queries using Cursor/Claude Code via the MCP server.
