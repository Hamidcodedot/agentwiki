# AgentWiki

[![npm version](https://img.shields.io/npm/v/@hamidshahid/agentwiki.svg)](https://www.npmjs.com/package/@hamidshahid/agentwiki)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **The Agent-Native Knowledge Engine & Local MCP Server**  
> Token-dense, schema-validated, self-healing knowledge infrastructure for AI agents in Cursor, Claude Code, and autonomous systems.

---

## The Problem

Traditional software documentation and wikis (Notion, Confluence, Mintlify) are engineered for human eyes. When autonomous AI coding agents read these docs, they:
1. **Waste 5,000–15,000 tokens** per query on narrative introductions, marketing prose, and layout fluff.
2. **Suffer from amnesia across sessions**, re-discovering and failing on the exact same undocumented bugs.
3. **Hallucinate invalid parameters** because static docs lack explicit error recovery and parameter invariants.

## The Solution: AgentWiki

AgentWiki is a high-speed, local-first compiler and Model Context Protocol (MCP) server that transforms messy API specifications and documentation into **atomic, high-density knowledge units**:
* **60–80% Token Compression Ratio (TCR):** Delivers exact API signatures and constraints in $< 400$ tokens per entity.
* **Sub-15ms Full-Text & Relational Search:** Built on Node.js 24 native `node:sqlite` with BM25-ranked FTS5. Zero native C++ compilation (`node-gyp`) required.
* **Git-First Ground Truth:** Ground truth stored in human-readable Markdown files with YAML frontmatter (`.agentwiki/pages/*.md`).
* **Self-Healing Hive Mind:** Agents stage newly discovered bugs, rate limits, and fixes via `agentwiki_propose_update` without hallucination poisoning.

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
This initializes `.agentwiki/` and automatically configures `.cursor/mcp.json` and `.mcp.json`.

### 2. Compile Your Documentation or OpenAPI Specs
```bash
# Compile an OpenAPI 3.0/3.1 specification (JSON or YAML)
npx @hamidshahid/agentwiki compile ./openapi.json

# Or compile a folder of Markdown documentation
npx @hamidshahid/agentwiki compile ./docs
```

### 3. Check Knowledge Base Status
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
  Pending Agent Proposals: 0
```

### 4. Run the Local MCP Server
```bash
npx @hamidshahid/agentwiki serve
```

---

## MCP Tools Exposed to AI Agents

When Cursor or Claude Code connects to AgentWiki, the following 4 tools are available:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `agentwiki_search` | `query: string`, `category?: string`, `limit?: number` | BM25-ranked full-text search returning token-budgeted summaries ($< 150$ tokens). |
| `agentwiki_read` | `id: string`, `section?: string` | Fetches the full high-density atomic page ($< 400$ tokens) or a specific section. |
| `agentwiki_explore_relations` | `id: string` | Returns graph edges (`requires`, `supersedes`, `related`) for multi-hop reasoning. |
| `agentwiki_propose_update` | `entity_id: string`, `claim: string`, `evidence: string`, `patch?: string` | Stages an agent discovery in `.agentwiki/proposals/` awaiting developer approval. |

---

## Agent Proposal Review Workflow

When an autonomous agent discovers an undocumented behavior, it calls `agentwiki_propose_update`. The discovery is staged safely in `.agentwiki/proposals/` without modifying your canonical ground truth.

Developers review proposals via CLI:
```bash
# List all staged proposals
npx @hamidshahid/agentwiki review

# Approve a specific proposal
npx @hamidshahid/agentwiki review --approve prop_1727626000_abc12

# Reject a proposal
npx @hamidshahid/agentwiki review --reject prop_1727626000_abc12

# Approve all pending proposals
npx @hamidshahid/agentwiki review --approve-all
```

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run all unit and integration test suites
npm test

# Run strict TypeScript typecheck
npm run typecheck

# Build executable distribution
npm run build
```

---

## License

MIT
