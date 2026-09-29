# Product Requirements Document (PRD)

**Product Name:** AgentWiki  
**Status:** Approved for Implementation (Ready)  
**Version:** 1.0.0-MVP  
**Author:** AI Engineering Partner & Founder  
**Date:** September 2026  

---

## 1. Executive Summary & Vision

AgentWiki is an **Agent-Native Knowledge Engine** engineered to eliminate context window waste, agent amnesia, and hallucinated API invocations in autonomous AI systems. 

Unlike traditional human-facing documentation platforms (Notion, Confluence, Mintlify) that optimize for narrative prose, visual layout, and human readability, AgentWiki produces and serves **atomic, schema-validated, token-compressed knowledge units** directly to AI agents via the Model Context Protocol (MCP) and deterministic local storage.

---

## 2. Target Personas (ICP)

### Primary Persona: The Agentic Software Engineer ("Alex")
* **Profile:** Full-stack engineer or solo technical founder building daily with Claude Code, Cursor, Windsurf, or custom agent frameworks (LangGraph/CrewAI).
* **Pain Point:** Coding agents consume 10,000+ tokens reading raw markdown docs or repo code, hit context limits, hallucinate deprecated arguments, and repeat the same debugging mistakes across sessions.
* **Goal:** A zero-config local engine that gives agents exact, token-dense API ground truth and allows agents to stage learnings so the codebase gets smarter.

### Secondary Persona: The DevTool / API Platform Founder ("Sam")
* **Profile:** Creator of an API, SDK, or developer platform (e.g., payment, auth, cloud infrastructure).
* **Pain Point:** Users use AI coding agents to integrate their SDK, but the agents fail due to stale docs, missing auth headers, or incorrect parameter types.
* **Goal:** An automated compiler that turns their OpenAPI/docs into an agent-ready MCP package with live execution feedback.

---

## 3. Scope Boundaries

### In-Scope (MVP - Milestone 1 to 4)
* **Local CLI (`npx agent-wiki`):** Zero-install command-line interface for initialization, compilation, local serving, and proposal review.
* **Deterministic Ingestion Engine:** Automated parsing of OpenAPI 3.0/3.1 (JSON/YAML) and structured Markdown without requiring third-party LLM API keys.
* **Hybrid Storage Architecture:** Git-friendly `.agentwiki/pages/*.md` ground truth with YAML frontmatter + embedded Node.js SQLite FTS5 index (`.agentwiki/index.db`).
* **Model Context Protocol (MCP) Server:** Native Stdio transport exposing the lean core toolset:
  1. `agentwiki_search`
  2. `agentwiki_read`
  3. `agentwiki_explore_relations`
  4. `agentwiki_propose_update`
* **Agent Writeback & Staged Proposals:** Staging directory (`.agentwiki/proposals/`) and CLI review workflow (`agent-wiki review`) preventing synthetic hallucination loops.
* **1-Click IDE Configuration:** Auto-detection and injection for `.cursor/mcp.json` and `.mcp.json`.

### Out-of-Scope (Deferred to Post-MVP)
* Multi-tenant cloud SaaS authentication & user management.
* Web-based visual dashboard (React / Next.js).
* Third-party SaaS connectors (Slack bot, Jira webhooks, Notion OAuth).
* Paid subscription billing (Stripe).
* Hosted custom domain DNS infrastructure (`docs.company.com`).

---

## 4. User Stories & Acceptance Criteria

### US-01: One-Command Project Initialization
* **As a** developer using Cursor or Claude Code,
* **I want to** run `npx agent-wiki init` in my project root,
* **So that** my editor is automatically configured with the AgentWiki MCP server without manual JSON editing.
* **Acceptance Criteria:**
  1. Creates `.agentwiki/` directory with `pages/`, `proposals/`, and `config.json`.
  2. Detects `.cursor/` or root directory and safely writes/updates `.cursor/mcp.json` or `.mcp.json`.
  3. Exits with code 0 and prints clear confirmation instructions.

### US-02: Deterministic OpenAPI Compilation
* **As a** developer with an OpenAPI/Swagger spec,
* **I want to** run `npx agent-wiki compile ./openapi.json`,
* **So that** every endpoint, parameter schema, constraint, and error response is converted into high-density atomic markdown pages.
* **Acceptance Criteria:**
  1. Parses all HTTP methods, parameters, request bodies, and responses.
  2. Generates individual `.agentwiki/pages/{id}.md` files with strict YAML frontmatter.
  3. Rebuilds the SQLite FTS5 index in `.agentwiki/index.db`.
  4. Achieves $\ge 60\%$ token reduction compared to raw OpenAPI JSON.

### US-03: Sub-20ms Agent Knowledge Retrieval
* **As an** AI coding agent in Cursor/Claude Code,
* **I want to** call `agentwiki_search` and `agentwiki_read`,
* **So that** I retrieve precise endpoint specs and constraints in under 20ms and under 400 tokens.
* **Acceptance Criteria:**
  1. `agentwiki_search` returns top matches with titles and summaries in $< 150$ tokens.
  2. `agentwiki_read` returns exact schema, constraints, and error recovery in $< 400$ tokens.
  3. Retrieval latency across local SQLite FTS5 is $\le 20\text{ms}$.

### US-04: Agent-Assisted Self-Healing (Proposals)
* **As an** autonomous agent that discovered a bug fix or undocumented behavior,
* **I want to** invoke `agentwiki_propose_update`,
* **So that** my discovery is staged for human review with an evidence trace.
* **Acceptance Criteria:**
  1. Creates a structured JSON proposal in `.agentwiki/proposals/{prop_id}.json`.
  2. Does NOT mutate canonical `.agentwiki/pages/` automatically without review.
  3. Developer running `npx agent-wiki review` can inspect the diff and approve/reject.

---

## 5. Non-Functional Requirements (NFRs)

| ID | Category | Requirement | Metric / Target |
| :--- | :--- | :--- | :--- |
| **NFR-01** | **Performance** | Search query execution time via SQLite FTS5 | $\le 15\text{ms}$ on 10,000 entities |
| **NFR-02** | **Efficiency** | Token Compression Ratio (TCR) vs raw docs | $\ge 70\%$ token reduction |
| **NFR-03** | **Portability** | Zero native C++ compilation (no node-gyp) | Works on Windows, macOS, Linux out-of-the-box |
| **NFR-04** | **Reliability** | Deterministic index reconstruction | Index rebuild from markdown files is 100% reproducible |
| **NFR-05** | **Security** | Path traversal & command injection protection | Entity IDs validated against strict regex (`^[a-zA-Z0-9_-]+$`) |
| **NFR-06** | **Footprint** | CLI cold startup time | $\le 150\text{ms}$ to execute `npx agent-wiki` |
