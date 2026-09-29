# System Architecture Specification (SAS)

**System Name:** AgentWiki Core Engine & MCP Server  
**Architecture Style:** Modular Local-First Library & Stdio Protocol Server  
**Runtime:** Node.js $\ge 22.0.0$ (utilizing native `node:sqlite` with built-in FTS5)  
**Language:** TypeScript 5.x (Strict Mode)  

---

## 1. High-Level Component Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Developer Workflow                            │
│  CLI Commands: init | compile <src> | serve | review | status          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Ingestion Layer (Parsers)                       │
│  ├── openapi.ts: Ingests OpenAPI 3.0/3.1 JSON/YAML -> AgentWikiPage[]  │
│  └── markdown.ts: Ingests raw markdown docs -> Dense AgentWikiPage[]  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ writes
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Storage Layer (.agentwiki/)                      │
│  ├── pages/{id}.md         Ground truth files (YAML frontmatter + MD)  │
│  ├── proposals/{id}.json   Staged agent findings awaiting approval     │
│  └── index.db              SQLite 3 database (FTS5 + Graph Relations)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ reads/writes
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Query & Indexing Engine (indexer.ts)                 │
│  - FTS5 Full-Text Search (BM25 ranking across titles, tags, content)   │
│  - Graph Relation Traversal (requires, supersedes, related)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MCP Server Layer (server.ts)                      │
│  Official @modelcontextprotocol/sdk (Stdio Transport)                  │
│  Exposes: search | read | explore_relations | propose_update           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ stdio
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Consuming AI Agents (IDE / CLI)                     │
│  Cursor IDE (.cursor/mcp.json)  |  Claude Code (.mcp.json)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Data Contracts (TypeScript)

### 2.1 The Atomic Knowledge Unit (`AgentWikiPage`)
```typescript
export type PageCategory = "api" | "concept" | "schema" | "guide" | "troubleshooting";

export interface PageRelations {
  requires?: string[];     // Prerequisite entity IDs
  supersedes?: string[];   // Deprecated entity IDs replaced by this
  related?: string[];      // Associated entity IDs
}

export interface AgentWikiMetadata {
  id: string;              // Deterministic alphanumeric identifier: ^[a-z0-9_-]+$
  name: string;            // Human-readable title
  category: PageCategory;
  version?: string;        // API or schema version (e.g., "2024-08-01")
  tags: string[];          // Indexed search keywords
  relations: PageRelations;
  summary: string;         // Single-paragraph high-density summary (<50 tokens)
  updated_at: string;      // ISO 8601 timestamp
}

export interface AgentWikiPage {
  metadata: AgentWikiMetadata;
  content: string;         // Structured markdown (<400 tokens)
}
```

### 2.2 Staged Proposal Contract (`AgentWikiProposal`)
```typescript
export type ProposalStatus = "pending" | "approved" | "rejected";

export interface AgentWikiProposal {
  id: string;              // Format: prop_{timestamp}_{random}
  entity_id: string;       // Target entity ID being added or updated
  author_agent: string;    // Identifier of the invoking agent (e.g., "claude-code")
  claim: string;           // Concise statement of what was discovered
  evidence: string;        // Execution output, error stack, or curl trace
  patch?: string;          // Proposed unified markdown diff or replacement content
  status: ProposalStatus;
  created_at: string;      // ISO 8601 timestamp
}
```

---

## 3. Database Architecture (SQLite Schema)

Database location: `.agentwiki/index.db`  
Engine: Node.js native `node:sqlite` (`DatabaseSync`).

### DDL Specification

```sql
-- 1. Metadata and Entity Store
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT,
  summary TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Full-Text Search Virtual Table (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  id,
  name,
  category,
  tags,
  summary,
  content,
  tokenize = 'porter unicode61'
);

-- 3. Relational Knowledge Graph Table
CREATE TABLE IF NOT EXISTS relations (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- 'requires', 'supersedes', 'related'
  PRIMARY KEY (source_id, target_id, relation_type),
  FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);

-- 4. Tag Index Table
CREATE TABLE IF NOT EXISTS entity_tags (
  entity_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (entity_id, tag),
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag);
```

---

## 4. MCP Protocol Tool Contracts

### Tool 1: `agentwiki_search`
* **Description:** Search knowledge entities using full-text BM25 ranking and optional category filter. Returns token-budgeted summaries.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query terms or keywords" },
      "category": { "type": "string", "enum": ["api", "concept", "schema", "guide", "troubleshooting"] },
      "limit": { "type": "integer", "default": 5, "maximum": 20 }
    },
    "required": ["query"]
  }
  ```
* **Output:** JSON array of `{ id, name, category, summary }` ($\le 150$ tokens total).

### Tool 2: `agentwiki_read`
* **Description:** Retrieve the full atomic high-density page for a specific entity ID.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "The exact entity ID" },
      "section": { "type": "string", "description": "Optional section header to extract (e.g., 'Error Recovery')" }
    },
    "required": ["id"]
  }
  ```
* **Output:** Clean markdown containing frontmatter, pre-conditions, schemas, and error recovery ($\le 400$ tokens).

### Tool 3: `agentwiki_explore_relations`
* **Description:** Retrieve relational graph edges (prerequisites, deprecations, related entities).
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "The entity ID to explore" },
      "direction": { "type": "string", "enum": ["outgoing", "incoming", "both"], "default": "outgoing" },
      "relation_type": { "type": "string", "enum": ["requires", "supersedes", "related"] }
    },
    "required": ["id"]
  }
  ```
* **Output:** JSON object containing `{ requires: [], required_by: [], supersedes: [], superseded_by: [], related: [] }`.

### Tool 4: `agentwiki_propose_update`
* **Description:** Stage a newly discovered fact, bug fix, or undocumented parameter with evidence for human review.
* **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "entity_id": { "type": "string", "description": "Entity ID being updated or created" },
      "claim": { "type": "string", "description": "Concise summary of the discovery" },
      "evidence": { "type": "string", "description": "Terminal output, execution trace, or test proof" },
      "patch": { "type": "string", "description": "Proposed markdown diff or content" }
    },
    "required": ["entity_id", "claim", "evidence"]
  }
  ```
* **Output:** `{ "proposal_id": "prop_...", "status": "staged", "message": "Proposal staged for developer review." }`.

---

## 5. Security & Invariant Defenses

1. **Path Traversal Defense:** All file paths are strictly resolved inside `path.join(process.cwd(), '.agentwiki', 'pages')`. Any ID containing `..`, `/`, or `\` is rejected immediately with an invalid parameter error.
2. **Zero Eval / AST Execution:** Parsers do NOT evaluate executable code. OpenAPI is parsed strictly as a JSON/YAML AST data structure.
3. **Consensus Isolation:** Agent proposals are strictly sandboxed in `.agentwiki/proposals/*.json` and cannot alter the ground truth `.agentwiki/pages/*.md` files without human intervention or explicit `--auto-approve` configuration.
