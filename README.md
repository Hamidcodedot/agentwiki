# AgentWiki

[![npm version](https://img.shields.io/npm/v/@hamidshahid/agentwiki.svg)](https://www.npmjs.com/package/@hamidshahid/agentwiki)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/HamidCodedot/agentwiki/actions/workflows/ci.yml/badge.svg)](https://github.com/HamidCodedot/agentwiki/actions)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.12%20%7C%2024.x-brightgreen.svg)](https://nodejs.org)

> Local MCP server and CLI utility for indexing curated API specs and auditing agent rule files.

AgentWiki provides two tools for projects using Cursor, Claude Code, or other MCP-compatible coding agents:

1. **Agent Rule Linter (`agentwiki doctor`)**: Scans `CLAUDE.md`, `AGENTS.md`, and `.cursor/rules` for dead file paths and stale `npm run` commands that cause agents to fail or hallucinate.
2. **Local MCP Search (`agentwiki compile` + `agentwiki serve`)**: Indexes OpenAPI specs (3.0/3.1) and Markdown documentation into local Markdown files and an in-process SQLite FTS5 search index. Agents query relevant endpoints on demand over MCP instead of reading entire multi-thousand-line documentation files into context.

---

## What AgentWiki Is and Is Not

| AgentWiki Is | AgentWiki Is Not |
| :--- | :--- |
| A local full-text search layer for **curated OpenAPI specs and Markdown docs** | A general codebase-understanding engine (it does not parse source code ASTs) |
| A fast linter for broken file paths and script names in rule files | A replacement for IDE code search or git grep |
| A file-based proposal workflow (`propose_update` + `review`) to stage notes for human review | An autonomous AI that mutates code without human approval |
| An open-source, local-first utility using Node.js native `node:sqlite` | A cloud service or hosted vector database |

---

## Quick Start

### 1. Audit Existing Agent Rule Files
Find broken paths or stale commands in your existing agent rules:
```bash
npx @hamidshahid/agentwiki doctor
```

### 2. Initialize AgentWiki in Your Project
```bash
npx @hamidshahid/agentwiki init
```
This command:
- Creates `.agentwiki/` for storing compiled Markdown pages.
- Scans `package.json` (or `pyproject.toml` / `Cargo.toml` / `go.mod`) to create an `architecture_overview.md` page.
- Configures `.cursor/mcp.json` and `.mcp.json` to register the local MCP server.
- Excludes `.agentwiki/*.db*` in `.gitignore`.

### 3. Compile Curated Docs or OpenAPI Specs
```bash
# Compile an OpenAPI specification (JSON or YAML)
npx @hamidshahid/agentwiki compile ./openapi.json

# Compile Markdown documentation
npx @hamidshahid/agentwiki compile ./docs
```

### 4. Use via MCP in Cursor or Claude Code
Once configured by `init`, your IDE runs the server automatically over Stdio when you start a session.

To test the server directly in terminal:
```bash
npx @hamidshahid/agentwiki serve
```

---

## Commands

### `agentwiki doctor [dir]`
Audits rule files (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc`, `.claude/rules/*.md`, `.agentwiki/pages/*.md`) for:
- **Dead file paths**: Checks if files referenced in backticks or Markdown links actually exist on disk.
- **Stale scripts**: Checks if `npm run <script>` commands referenced in rules exist in `package.json`.

```bash
npx @hamidshahid/agentwiki doctor
```

### `agentwiki compile <source> [--prune]`
Parses an OpenAPI spec (3.0/3.1) or a directory of Markdown files into individual Markdown files with YAML frontmatter in `.agentwiki/pages/` and indexes them in SQLite FTS5 (`.agentwiki/index.db`).

```bash
npx @hamidshahid/agentwiki compile ./docs
```

### `agentwiki status`
Displays the current count of indexed entities and pending agent proposals.

```bash
npx @hamidshahid/agentwiki status
```

### `agentwiki review`
Reviews and applies or rejects staged agent proposals submitted via `agentwiki_propose_update`.

```bash
# List pending proposals
npx @hamidshahid/agentwiki review

# Approve and merge a proposal into the target Markdown page
npx @hamidshahid/agentwiki review --approve <proposal_id>

# Reject a proposal
npx @hamidshahid/agentwiki review --reject <proposal_id>
```

---

## MCP Tools Exposed to Agents

When connected, AgentWiki provides 4 tools over Stdio:

| Tool | Purpose |
| :--- | :--- |
| `agentwiki_search` | BM25 full-text keyword search over compiled entities. Returns entity names, IDs, categories, and summaries. |
| `agentwiki_read` | Retrieves the content of an entity by ID, or extracts a specific `## Header` section. |
| `agentwiki_explore_relations` | Returns prerequisite, superseding, and related entity links defined in page metadata. |
| `agentwiki_propose_update` | Stages an agent's note or discovery (with evidence) for an existing entity in `.agentwiki/proposals/` awaiting developer approval. Does not modify ground-truth files directly. |

---

## Known Scope & Limitations

* **Curated Documentation Focus:** AgentWiki is a local search layer for curated OpenAPI specs and Markdown guides. It does not parse source code ASTs, extract function signatures, or understand repository code logic.
* **No Remote `$ref` Resolution:** The OpenAPI parser handles inline JSON schemas. Remote and external `$ref` references are not resolved.
* **No Hard Output Truncation:** `agentwiki_read` returns the full page or requested section. If a documentation section is long, the tool returns the entire section without artificial clipping.
* **Prototype Status:** Designed for testing whether local, schema-structured documentation improves agent accuracy compared to broad codebase searches.

---

## Architecture Invariants

* **Zero Native C++ Compilation:** Uses Node.js native `node:sqlite` (`DatabaseSync`). Installs without `python`, `gcc`, or `node-gyp`.
* **Deterministic Rebuilds:** If `.agentwiki/index.db` is deleted or ignored, running `agentwiki compile` or launching `agentwiki serve` deterministically rebuilds the index from `.agentwiki/pages/*.md`.
* **Non-Destructive IDE Integration:** Tolerates comments and trailing commas in `.cursor/mcp.json` and `.mcp.json`. Automatically generates `.bak` backups on corrupted configurations to prevent wiping developer configs.

---

## License

MIT License. Copyright (c) 2026 Hamid Shahid.
