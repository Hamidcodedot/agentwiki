# AgentWiki

[![npm version](https://img.shields.io/npm/v/@hamidshahid/agentwiki.svg)](https://www.npmjs.com/package/@hamidshahid/agentwiki)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/HamidCodedot/agentwiki/actions/workflows/ci.yml/badge.svg)](https://github.com/HamidCodedot/agentwiki/actions)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.12%20%7C%2024.x-brightgreen.svg)](https://nodejs.org)

> **The Agent-Native Knowledge Engine & Local MCP Server**  
> Token-dense, schema-validated, self-healing knowledge infrastructure for AI agents in Cursor, Claude Code, and autonomous systems.

---

## The Problem

Traditional documentation and wikis (Notion, Confluence, Mintlify, Readme) are authored for human eyes. When autonomous AI coding agents ingest them, they:
1. **Waste 5,000–15,000 tokens** per query on narrative introductions, layout formatting, and marketing prose.
2. **Suffer from session amnesia**, repeatedly encountering and failing on the exact same undocumented edge cases.
3. **Hallucinate invalid parameters** because static human docs lack machine-verifiable invariants and recovery paths.

---

## The Solution: AgentWiki v0.2.0

AgentWiki is a high-speed, local-first compiler and Model Context Protocol (MCP) server that transforms API specifications and developer documentation into **atomic, high-density knowledge units**:

* **70%+ Token Compression Ratio (TCR):** Extracts exact signatures, schemas, and constraints in $< 400$ tokens per atomic entity.
* **Sub-15ms Full-Text & Relational Search:** Powered by Node.js 24 native `node:sqlite` with BM25-ranked FTS5. Zero native C++ compilation (`node-gyp`) and zero external vector database dependencies.
* **Git-First Ground Truth:** Ground truth remains stored in version-controlled Markdown files with YAML frontmatter (`.agentwiki/pages/*.md`).
* **True Self-Healing Ground Truth:** When an agent discovers an undocumented parameter or error guard, it stages a proposal. Approving it via `review --approve` automatically merges the invariant into the canonical Markdown file and re-indexes SQLite in milliseconds.
* **Sub-100ms Fast MCP Startup:** Automatically detects local package installations to run direct Node binaries with `${workspaceFolder}` anchoring, eliminating `npx` network cold-start delays.

---

## Empirical Benchmark

Tested against a Stripe-grade payments API and real-world authentication guides:

| Metric | Raw Docs (Condition A) | AgentWiki MCP (Condition B) | Impact |
| :--- | :--- | :--- | :--- |
| **Token Ingestion Footprint** | 2,169 tokens / query | 632 tokens / query | **70.9% Token Reduction** |
| **BM25 Search Retrieval** | N/A (Linear Scan) | 3.79 ms | **Sub-5ms Lookup** |
| **Total MCP Cycle Time** | 800+ ms (Vector Search) | 21.29 ms | **37x Faster Retrieval** |
| **Cost per 1,000 Agent Queries** | \$6.51 | \$1.90 | **71% Cost Reduction** |
| **Self-Healing Verification** | Unverified / Amorphous | Staged $\rightarrow$ Approved $\rightarrow$ Merged | **Zero Hallucination Poisoning** |

---

## Quick Start (Under 60 Seconds)

### 1. Initialize Your Project
Run in your repository root:
```bash
npx @hamidshahid/agentwiki init
```
Or install globally:
```bash
npm install -g @hamidshahid/agentwiki
agentwiki init
```
This initializes `.agentwiki/`, auto-detects existing `README.md` or `docs/`, and configures `.cursor/mcp.json` and `.mcp.json`.

### 2. Compile Your Documentation or OpenAPI Specs
```bash
# Compile an OpenAPI 3.0/3.1 specification (JSON or YAML)
npx @hamidshahid/agentwiki compile ./openapi.json

# Compile a documentation folder
npx @hamidshahid/agentwiki compile ./docs

# Or compile your README directly
npx @hamidshahid/agentwiki compile ./README.md

# Prune deleted or renamed entities
npx @hamidshahid/agentwiki compile ./docs --prune
```

### 3. Inspect Knowledge Base Status
```bash
npx @hamidshahid/agentwiki status
```
Output:
```
AgentWiki Knowledge Base Status:
  Directory: /path/to/project/.agentwiki
  Total Entities: 14
    - api: 10
    - guide: 4
  Pending Agent Proposals: 1
```

### 4. Run the Local MCP Server
```bash
npx @hamidshahid/agentwiki serve
```
*(Cursor and Claude Code launch this process automatically using your configured `.cursor/mcp.json` or `.mcp.json`).*

---

## MCP Tools Exposed to AI Agents

When Cursor or Claude Code connects to AgentWiki, 4 tools are provided over Stdio:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `agentwiki_search` | `query: string`, `category?: string`, `limit?: number` | BM25-ranked full-text search returning token-budgeted summaries ($< 150$ tokens). |
| `agentwiki_read` | `id: string`, `section?: string` | Fetches the full high-density atomic page ($< 400$ tokens) or a specific section. |
| `agentwiki_explore_relations` | `id: string` | Returns graph edges (`requires`, `supersedes`, `related`) for multi-hop reasoning. |
| `agentwiki_propose_update` | `entity_id: string`, `claim: string`, `evidence: string`, `patch?: string` | Stages an agent discovery in `.agentwiki/proposals/` awaiting developer approval. |

---

## Self-Healing Review Workflow

When an autonomous agent discovers an undocumented invariant (e.g., an undocumented rate limit or missing header), it calls `agentwiki_propose_update`. The discovery is staged safely in `.agentwiki/proposals/` without modifying your canonical ground truth.

Developers review and merge proposals via CLI:
```bash
# List all staged proposals
npx @hamidshahid/agentwiki review

# Approve and merge a proposal into the target page + re-index
npx @hamidshahid/agentwiki review --approve prop_1727626000_abc12

# Reject a proposal
npx @hamidshahid/agentwiki review --reject prop_1727626000_abc12

# Approve and merge all pending proposals
npx @hamidshahid/agentwiki review --approve-all
```

When approved, AgentWiki:
1. Appends the verified invariant under `## Verified Invariants & Fixes` in `.agentwiki/pages/{entity_id}.md`.
2. Updates `updated_at` in the page's YAML frontmatter.
3. Re-indexes the entity in SQLite FTS5 instantly.

---

## Architecture & Storage Invariants

* **Ground Truth Files:** Stored as human-readable Markdown files with YAML frontmatter in `.agentwiki/pages/*.md`. These should be committed to Git.
* **Search Index:** Fast SQLite index at `.agentwiki/index.db`. This file can be excluded from Git via `.gitignore` as it can be deterministically rebuilt at any time via `agentwiki compile`.
* **Zero Native C++:** Built using Node.js native `node:sqlite` (`DatabaseSync`), requiring zero Python or `node-gyp` toolchains.

---

## Development & Testing

```bash
# Clone repository
git clone https://github.com/HamidCodedot/agentwiki.git
cd agentwiki

# Install dependencies
npm install

# Run unit and integration tests (33 tests)
npm test

# Run strict typecheck
npm run typecheck

# Run empirical benchmark
npm run benchmark

# Build distribution
npm run build
```

---

## License

MIT License. Copyright (c) 2026 Hamid Shahid.
