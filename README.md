# AgentWiki

[![npm version](https://img.shields.io/npm/v/@hamidshahid/agentwiki.svg)](https://www.npmjs.com/package/@hamidshahid/agentwiki)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/HamidCodedot/agentwiki/actions/workflows/ci.yml/badge.svg)](https://github.com/HamidCodedot/agentwiki/actions)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.12%20%7C%2024.x-brightgreen.svg)](https://nodejs.org)

> **Agent-Native Knowledge Engine & Local MCP Server**  
> Token-dense, schema-validated, self-healing knowledge infrastructure for AI coding agents in Cursor, Claude Code, and autonomous systems.

---

## The Problem: Human Documentation vs Agent Economics

Traditional developer documentation, OpenAPI specs, and wikis (Notion, Mintlify, Readme, Swagger) are authored for human eyes:

1. **Massive Context Window Bloat:** Feeding a 10,000-line OpenAPI spec or narrative documentation into an LLM burns 10,000 to 40,000 tokens on every turn, driving up latency and API costs.
2. **Conversational Fluff & Hallucination:** Human guides contain marketing intros, screenshots, and prose. LLMs get distracted by layout boilerplate, frequently hallucinating endpoints and missing critical validation invariants.
3. **Session Amnesia:** When an AI agent encounters an undocumented edge case (like a mandatory idempotency header or rate limit guard) and fixes it in Turn 3, that knowledge vanishes the moment the context window compacts or the session restarts.

---

## The Solution: AgentWiki

AgentWiki is a high-speed, local-first compiler and Model Context Protocol (MCP) server that transforms raw documentation, OpenAPI specs, and repository architecture into **atomic, high-density knowledge units**:

```
 ┌────────────────────────┐      ┌─────────────────────────┐      ┌───────────────────────┐
 │   Developer Sources    │      │   AgentWiki Compiler    │      │    Local Knowledge    │
 │                        │ ───> │                         │ ───> │                       │
 │  • package.json / repo │      │  • Strips fluff         │      │  • .agentwiki/pages/  │
 │  • openapi.json/yaml   │      │  • < 400 tokens / card  │      │  • SQLite FTS5 Index  │
 │  • docs/*.md           │      │  • SHA-256 currency sync│      │  • Relational Graph   │
 └────────────────────────┘      └─────────────────────────┘      └───────────┬───────────┘
                                                                              │
                                                                   Stdio MCP  │ Sub-15ms
                                                                   Transport  │ BM25 Search
                                                                              ▼
                                                                  ┌───────────────────────┐
                                                                  │  Cursor / Claude Code │
                                                                  │                       │
                                                                  │  • search             │
                                                                  │  • read               │
                                                                  │  • explore_relations  │
                                                                  │  • propose_update     │
                                                                  └───────────────────────┘
```

* **70%+ Token Reduction:** Deconstructs bloated specifications into isolated, machine-verifiable cards under 400 tokens each.
* **Codebase Manifest & Topology Scanner:** Automatically maps project entrypoints, toolchain scripts, dependencies, and directory topology into `architecture_overview.md` with SHA-256 currency sync.
* **Sub-15ms Local BM25 Search:** Powered by Node.js 24 native `node:sqlite` with FTS5. Zero external vector databases, zero embedding costs, and zero native C++ compilation (`node-gyp`).
* **Git-First Ground Truth:** All knowledge entities are committed as human-readable Markdown files with YAML frontmatter in `.agentwiki/pages/*.md`.
* **Fresh Checkout Self-Healing:** The SQLite database is safely excluded from Git to prevent binary merge conflicts. On a fresh `git clone`, AgentWiki automatically rehydrates the search index from Markdown in $< 30\text{ ms}$.
* **Self-Healing Hive Mind:** When agents discover undocumented behaviors, they stage proposals (`agentwiki_propose_update`). Developers approve them with one command (`agentwiki review --approve`), permanently writing fixes into version-controlled ground truth.

---

## Quick Start (Under 60 Seconds)

### 1. Initialize Your Project
Run in your repository root:
```bash
npx @hamidshahid/agentwiki init
```

AgentWiki automatically:
- Creates the local knowledge store (`.agentwiki/`).
- Scans your project manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, or `go.mod`) and directory layout into `architecture_overview.md`.
- Safely configures `.cursor/mcp.json` and `.mcp.json` for Claude Code (non-destructively preserving existing servers and comments).
- Appends `.agentwiki/*.db*` to your `.gitignore`.

### 2. Compile Documentation or OpenAPI Specs
```bash
# Compile an OpenAPI 3.0/3.1 specification (JSON or YAML)
npx @hamidshahid/agentwiki compile ./openapi.json

# Compile a documentation directory
npx @hamidshahid/agentwiki compile ./docs

# Compile your repository README
npx @hamidshahid/agentwiki compile ./README.md

# Prune deleted or renamed entities
npx @hamidshahid/agentwiki compile ./docs --prune
```

### 3. Verify Knowledge Base Status
```bash
npx @hamidshahid/agentwiki status
```
```
 ┌────────────────────────────────────────────────────────────────┐
 │  AGENTWIKI v0.3.0                  Local MCP Knowledge Engine  │
 └────────────────────────────────────────────────────────────────┘

 ┌── AgentWiki Knowledge Base Status ─────────────────────────────┐
 │ Directory:                 /workspace/.agentwiki               │
 │ Total Atomic Entities:     15                                  │
 │ Category (api):            10                                  │
 │ Category (guide):          4                                   │
 │ Category (concept):        1                                   │
 │ Pending Agent Proposals:   0                                   │
 │ Index Engine:              node:sqlite FTS5 BM25               │
 │ MCP Stdio Transport:       Claude Code · Cursor IDE            │
 └────────────────────────────────────────────────────────────────┘
```

### 4. Connect with Cursor or Claude Code
You don't need to manually start a daemon. Your IDE runs AgentWiki automatically over Stdio whenever you open the workspace.

To test the server manually in terminal:
```bash
npx @hamidshahid/agentwiki serve
```

---

## MCP Tools Reference

AgentWiki exposes 4 precision tools to Cursor and Claude Code:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `agentwiki_search` | `query: string`<br>`category?: string`<br>`limit?: number` | BM25-ranked full-text search across all entity names, tags, and summaries. Returns token-budgeted results ($< 150$ tokens). |
| `agentwiki_read` | `id: string`<br>`section?: string` | Retrieves the full atomic page ($< 400$ tokens) or extracts a specific section (`## Invariants`). |
| `agentwiki_explore_relations` | `id: string` | Returns relational graph edges (`requires`, `supersedes`, `related`) for dependency analysis and multi-hop reasoning. |
| `agentwiki_propose_update` | `entity_id: string`<br>`claim: string`<br>`evidence: string`<br>`patch?: string` | Stages an agent discovery in `.agentwiki/proposals/` awaiting developer approval without mutating ground truth. |

---

## Anatomy of an Atomic Knowledge Unit

Every compiled entity is stored in `.agentwiki/pages/{id}.md` with strict YAML frontmatter:

```markdown
---
id: post_v1_checkout_sessions
name: Create Checkout Session
category: api
tags: [payments, checkout, sessions, stripe]
relations:
  requires: [customer_record]
  supersedes: []
  related: [get_v1_checkout_sessions_id]
summary: Creates a checkout session for customer payment collection.
updated_at: '2026-10-03T16:00:00.000Z'
---

## Endpoint Signature
- **Method:** `POST`
- **Path:** `/v1/checkout/sessions`
- **Auth:** `Bearer {sk_live_...}`

## Required Headers & Parameters
- `Idempotency-Key` (Header, UUIDv4)
- `customer_id` (Body, string): Customer identifier
- `currency` (Body, string): 3-letter ISO code (e.g., `usd`)

## System Invariants & Recovery
- Concurrent charge attempts with identical keys return `409 Conflict`.
- Rate limiting enforces 100 req/sec; returns `429 Too Many Requests` with `Retry-After`.

## Verified Invariants & Fixes
- [Verified 2026-10-03]: `success_url` must include protocol (`https://`).
```

---

## Self-Healing Ground Truth Workflow

When an AI agent discovers an undocumented requirement during code execution or test failure, it does **not** silently forget it, nor does it poison your codebase with untested assumptions. It calls `agentwiki_propose_update`.

```
[Agent Execution]
       │
       ▼
Discovers undocumented parameter (e.g., `client_reference_id` required for webhooks)
       │
       ▼
Calls `agentwiki_propose_update`
       │
       ▼
Staged in `.agentwiki/proposals/prop_1727626000_abc12.json`
       │
       ▼
[Human Review via CLI]
Run: `npx @hamidshahid/agentwiki review`
       │
       ├── `agentwiki review --approve <id>` ──> Merged into Markdown + SQLite Re-indexed
       └── `agentwiki review --reject <id>`  ──> Proposal discarded
```

### CLI Review Commands

```bash
# List all staged proposals with diffs and agent evidence
npx @hamidshahid/agentwiki review

# Approve and merge a specific proposal
npx @hamidshahid/agentwiki review --approve prop_1727626000_abc12

# Reject a proposal
npx @hamidshahid/agentwiki review --reject prop_1727626000_abc12

# Approve all pending proposals in batch
npx @hamidshahid/agentwiki review --approve-all
```

---

## Empirical Benchmark

Evaluated against a real-world Stripe-grade payments API specification (8,674 characters) and production authentication documentation:

| Metric | Condition A (Raw Docs in Context) | Condition B (AgentWiki MCP) | Measured Impact |
| :--- | :--- | :--- | :--- |
| **Token Ingestion Footprint** | 2,169 tokens / query | 632 tokens / query | **70.9% Token Reduction** |
| **BM25 Search Retrieval** | Linear scan across prompt | 7.16 ms | **Sub-10ms Instant Lookup** |
| **Total MCP Cycle Time** | 800+ ms (Vector Search) | 58.36 ms | **13x Faster Retrieval** |
| **Cost per 1,000 Agent Queries** | \$6.51 | \$1.90 | **71% Cost Reduction** |
| **Ground Truth Invariant Accuracy** | 50% (Missed error guards) | 100% (Passed all guards) | **Zero Hallucination** |
| **Ground Truth Poisoning Defense** | Unvetted direct mutation | Human-in-the-loop review | **100% Invariant Integrity** |

---

## CLI Command Reference

| Command | Usage | Description |
| :--- | :--- | :--- |
| `init` | `agentwiki init [dir]` | Initializes `.agentwiki`, scans manifests/topology, configures IDEs, and updates `.gitignore`. |
| `compile` | `agentwiki compile <source> [--prune]` | Compiles OpenAPI specs or Markdown docs into atomic cards and indexes them into SQLite FTS5. |
| `serve` | `agentwiki serve` | Launches the Model Context Protocol (MCP) server over Stdio. |
| `status` | `agentwiki status` | Displays knowledge base entity metrics, categories, proposals, and engine state. |
| `review` | `agentwiki review [--approve <id> \| --reject <id> \| --approve-all]` | Interactive CLI to inspect, approve, or reject staged agent proposals. |

---

## Architecture Invariants

* **Zero Native C++ Compilation:** Uses Node.js native `node:sqlite` (`DatabaseSync`). Installs instantaneously without `python`, `gcc`, or `node-gyp`.
* **Deterministic Rebuilds:** If `.agentwiki/index.db` is deleted or ignored, running `agentwiki compile` or launching `agentwiki serve` deterministically rebuilds the index from `.agentwiki/pages/*.md`.
* **Non-Destructive IDE Integration:** Tolerates comments and trailing commas in `.cursor/mcp.json` and `.mcp.json`. Automatically generates `.bak` backups on corrupted configurations to prevent wiping developer configs.
* **Token Budget Guard:** Enforces $< 400$ tokens per atomic page to preserve AI reasoning bandwidth.

---

## License

MIT License. Copyright (c) 2026 Hamid Shahid.
