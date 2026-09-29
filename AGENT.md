# AGENT.md: Operating Instructions for AI Agents

Welcome, Agent. You are operating inside the **AgentWiki** codebase.
Before you write, modify, or execute code in this repository, you must read, understand, and adhere to every instruction and invariant in this document.

---

## 1. Project Mission & Core Philosophy

**AgentWiki** is an **Agent-Native Knowledge Engine**.
It distills human software documentation and API specifications into high-density, schema-validated, token-compressed knowledge units, serving them to autonomous coding agents via the Model Context Protocol (MCP) and local SQLite FTS5 search.

### Non-Negotiable Invariants

1. **Radical Simplicity (Zero Over-Engineering):**
   - The simplest code that solves the problem is the best code.
   - Never create abstractions, wrappers, factories, or layers for problems that do not yet exist.
   - No heavy ORMs (no Prisma, TypeORM). No external vector databases.
2. **Native SQLite Engine (Zero Native C++ Compiling):**
   - We strictly use Node.js 22+ built-in `node:sqlite` (`DatabaseSync`) with built-in FTS5.
   - **NEVER** install `better-sqlite3`, `sqlite3`, or any library requiring `node-gyp` or C++ build tools.
3. **Ground Truth Over Assumption:**
   - Always inspect files, schemas, and test outputs before assuming behavior.
   - Read [`docs/PRD.md`](file:///z:/agent-wiki/docs/PRD.md) and [`docs/ARCHITECTURE.md`](file:///z:/agent-wiki/docs/ARCHITECTURE.md) for architectural grounding.
4. **Always Follow & Update `PLAN.md`:**
   - Check [`PLAN.md`](file:///z:/agent-wiki/PLAN.md) before starting any work.
   - Complete tasks in sequence. Do NOT jump ahead.
   - Mark tasks `[x]` as they are completed and verified by tests.
5. **Verify Through Execution (TDD):**
   - Never declare work done without executing tests.
   - Code without tests is considered broken.
6. **Zero Emojis in Code & Logs:**
   - Do not include emojis in terminal outputs, logs, code comments, or commit messages. Keep output professional and parseable.

---

## 2. Repository Structure

```
z:/agent-wiki/
├── AGENT.md               # (This file) Rules of engagement for AI agents
├── PLAN.md                # Live execution plan & milestone task tracker
├── package.json           # Project manifest
├── tsconfig.json          # Strict TypeScript configuration
├── bin/
│   └── cli.ts             # CLI Entrypoint (init, compile, serve, review)
├── src/
│   ├── core/
│   │   ├── types.ts       # Strict schemas (AgentWikiPage, Proposal, etc.)
│   │   ├── storage.ts     # File I/O for .agentwiki/ (YAML frontmatter + Markdown)
│   │   └── indexer.ts     # Native node:sqlite FTS5 + graph edge indexer
│   ├── parsers/
│   │   ├── openapi.ts     # OpenAPI 3.0/3.1 AST -> AgentWikiPage[]
│   │   └── markdown.ts    # Raw docs -> Dense AgentWikiPage[]
│   ├── mcp/
│   │   └── server.ts      # @modelcontextprotocol/sdk Stdio server (4 tools)
│   └── setup/
│       └── ide.ts         # 1-Click config injection (.cursor/mcp.json, .mcp.json)
├── tests/
│   ├── fixtures/          # Realistic sample OpenAPI & markdown files
│   ├── unit/              # Storage, indexer, parser unit tests
│   └── integration/       # MCP server & CLI end-to-end integration tests
└── docs/
    ├── PRD.md             # Product Requirements Document
    ├── ARCHITECTURE.md    # System Architecture Specification
    ├── ROADMAP.md         # Long-term product roadmap
    └── TEST_PLAN.md       # Quality Assurance & Verification Strategy
```

---

## 3. Standard Agent Workflow Loop

Whenever you are assigned a task or begin a session, follow this exact loop:

```
┌────────────────────────────────────────────────────────┐
│ 1. READ PLAN.md                                        │
│    Identify the current active milestone and task.     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. WRITE FAILING TEST (TDD)                            │
│    Create test in tests/unit/ or tests/integration/.   │
│    Run test to prove it fails for the right reason.    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. WRITE MINIMAL IMPLEMENTATION                        │
│    Implement the simplest code that passes the test.   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. EXECUTE & VERIFY                                    │
│    Run tests: `npm test`                               │
│    Verify TypeScript compilation: `npm run build`      │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. UPDATE PLAN.md                                      │
│    Mark task [x] with verification notes and test pass │
└────────────────────────────────────────────────────────┘
```

---

## 4. Coding & Architecture Invariants

### 4.1 Strict Typing
* All interfaces and data contracts live in `src/core/types.ts`.
* Validate all incoming data at boundaries using `zod`.
* Never use `any` unless absolutely forced by external untyped library boundaries, and cast immediately.

### 4.2 Path Security & Storage Integrity
* Storage root is always strictly scoped inside `.agentwiki/`.
* Validate all entity IDs against the regex: `/^[a-zA-Z0-9_-]+$/`.
* Disallow any path containing `..`, `/`, or `\` in entity identifiers to prevent path traversal attacks.

### 4.3 Staged Proposals Guard
* When agents write via MCP `agentwiki_propose_update`, **NEVER** write directly to `.agentwiki/pages/`.
* Write exclusively to `.agentwiki/proposals/prop_{timestamp}_{rand}.json`.
* Only the human developer or the CLI `agent-wiki review` command may promote proposals to canonical pages.

---

## 5. Verification Commands

* Run all tests: `npm test`
* Run typecheck: `npm run typecheck`
* Build package: `npm run build`
* Run benchmark: `npm run benchmark`
