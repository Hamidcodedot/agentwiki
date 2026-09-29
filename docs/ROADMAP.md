# Product Roadmap & Delivery Plan

**Product:** AgentWiki  
**Execution Horizon:** 48-Hour MVP -> Phase 2 (Self-Healing) -> Phase 3 (Enterprise Sync)  
**Methodology:** Atomic Pull Request Sequencing with Test-Driven Development (TDD)  

---

## 1. The Pre-Flight "Definition of Ready" Checklist

Before writing production implementation code, every software engineering prerequisite must be checked:

- [x] **Problem & Persona Validation:** Target personas, status-quo workarounds, and pain points documented.
- [x] **Product Requirements Document (PRD):** Functional stories and quantified NFRs locked in [PRD.md](file:///z:/agent-wiki/docs/PRD.md).
- [x] **System Architecture Specification (SAS):** Interfaces, SQLite FTS5 DDL, and MCP schemas defined in [ARCHITECTURE.md](file:///z:/agent-wiki/docs/ARCHITECTURE.md).
- [x] **Tech Stack Verification:** Node.js v24.18.0 + native `node:sqlite` FTS5 verified operational on host environment.
- [x] **Test Strategy & Quality Plan:** Acceptance criteria and benchmark harness specified in [TEST_PLAN.md](file:///z:/agent-wiki/docs/TEST_PLAN.md).
- [x] **Security & Threat Model:** Path traversal, injection, and hallucination poisoning guards specified.

---

## 2. Phase 1: MVP Milestones (The 48-Hour Build)

### Milestone 1: Storage Layer & SQLite FTS5 Index Engine
* **Objective:** Establish the foundational file storage and sub-15ms search/relation index.
* **Deliverables:**
  * `src/core/types.ts`: Strict TypeScript interfaces for pages, proposals, and search.
  * `src/core/storage.ts`: File I/O for `.agentwiki/` (reading/writing markdown + YAML frontmatter).
  * `src/core/indexer.ts`: Native `node:sqlite` engine managing FTS5 full-text indexing and graph edge tables.
  * `tests/storage.test.ts` & `tests/indexer.test.ts`: Automated unit test suites.
* **Definition of Done (DoD):**
  * Able to write 100 mock pages to disk.
  * Indexer builds database in $< 100\text{ms}$.
  * FTS5 queries return top matches with BM25 ranking in $< 5\text{ms}$.
  * 100% test pass rate.

### Milestone 2: Deterministic Ingestion Parsers
* **Objective:** Ingest OpenAPI 3.0/3.1 specs and Markdown files into atomic `AgentWikiPage`s.
* **Deliverables:**
  * `src/parsers/openapi.ts`: Traverses paths, methods, schemas, parameters, and error codes; produces token-dense markdown.
  * `src/parsers/markdown.ts`: Strips HTML, images, and prose fluff; extracts headings and code blocks.
  * `tests/parsers.test.ts`: Tests against real OpenAPI fixtures (e.g. Petstore, Stripe sample).
* **Definition of Done (DoD):**
  * Parses valid OpenAPI 3.0 JSON and YAML without errors.
  * Emits valid `AgentWikiPage` objects adhering to schema.
  * Achieves $\ge 70\%$ token reduction compared to raw input specs.

### Milestone 3: MCP Server Implementation
* **Objective:** Expose knowledge to Cursor and Claude Code via Model Context Protocol.
* **Deliverables:**
  * `src/mcp/server.ts`: Uses `@modelcontextprotocol/sdk` over Stdio transport.
  * Tools implemented:
    1. `agentwiki_search`
    2. `agentwiki_read`
    3. `agentwiki_explore_relations`
    4. `agentwiki_propose_update`
  * `tests/mcp.test.ts`: Integration test running tool calls over in-memory transport.
* **Definition of Done (DoD):**
  * All 4 tools return valid responses adhering to tool schema.
  * Search and read execute within token limits ($< 150$ tokens for search, $< 400$ for read).
  * Staged proposals write cleanly to `.agentwiki/proposals/`.

### Milestone 4: CLI Interface & 1-Click IDE Setup
* **Objective:** Zero-friction developer CLI packaging.
* **Deliverables:**
  * `bin/cli.ts`: Commands for `init`, `compile <source>`, `serve`, `review`, and `status`.
  * `src/setup/ide.ts`: Automatically detects and configures `.cursor/mcp.json` or `.mcp.json`.
  * `package.json`: Configured with bin executable `agent-wiki`.
* **Definition of Done (DoD):**
  * `npx agent-wiki init` sets up a fresh repository in $< 1$ second.
  * `npx agent-wiki compile ./spec.json` ingests and indexes files.
  * `npx agent-wiki review` displays pending proposals with approval options.

---

## 3. Phase 2: Post-MVP (Self-Healing & Telemetry)
* **Active Execution Telemetry:** Silent execution logging when agents call tools; automated error rate reporting.
* **Auto-Merge for Verified Traces:** Automatic promotion of proposals with passing CLI/unit test reproduction scripts.
* **LLM Prose Compactor:** Optional API-key-driven pass to summarize unstructured prose into structured constraints.

---

## 4. Phase 3: Commercial & Team Collaboration (Model 1 + Model 2)
* **Team Sync (Git / Remote Storage):** Automatic synchronization of `.agentwiki/` across developer teams.
* **Hosted Public Agent-Ready Docs (Model 2):** Serving `docs.company.com/agent-wiki` and `llms.txt` with live MCP endpoints.
* **Web Audit Dashboard:** Visual graph browser for engineering managers to inspect agent memory and documentation health.

---

## 5. Risk Register & Mitigations

| Risk | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Native SQLite Build Failure** | High | Low | Eliminated by using Node 24 native `node:sqlite`; zero node-gyp C++ compiling. |
| **Agent Hallucination Poisoning** | Critical | Med | Writeback is sandboxed into `.agentwiki/proposals/` requiring developer review. |
| **Token Budget Overrun** | High | Med | Hard output slicing and strict schema formatting in `agentwiki_read`. |
| **IDE MCP Config Clashes** | Med | Med | Read existing `.cursor/mcp.json`, merge non-destructively, preserve other servers. |
