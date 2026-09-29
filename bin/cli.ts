#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'node:path';
import { StorageEngine } from '../src/core/storage.js';
import { IndexerEngine } from '../src/core/indexer.js';
import { compileSource } from '../src/core/compiler.js';
import { setupIde } from '../src/setup/ide.js';
import { startStdioServer } from '../src/mcp/server.js';

const program = new Command();

program
  .name('agentwiki')
  .description('Agent-Native Knowledge Engine & Local MCP Server')
  .version('0.1.0');

// Command: init
program
  .command('init [dir]')
  .description('Initialize AgentWiki in the current project and configure Cursor/Claude Code')
  .action((dir) => {
    const targetDir = dir ? path.resolve(dir) : process.cwd();
    const agentWikiDir = path.join(targetDir, '.agentwiki');

    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();
    indexer.close();

    const ideResult = setupIde(targetDir);

    console.log('AgentWiki initialized successfully.');
    console.log(`Knowledge store created at: ${agentWikiDir}`);
    if (ideResult.cursorConfigured) {
      console.log(`Cursor IDE MCP configured: ${ideResult.cursorPath}`);
    }
    if (ideResult.claudeConfigured) {
      console.log(`Claude Code MCP configured: ${ideResult.claudePath}`);
    }
    console.log('\nNext steps:');
    console.log('  1. Compile your docs or OpenAPI spec: npx @hamidshahid/agentwiki compile ./docs');
    console.log('  2. Start the local MCP server: npx @hamidshahid/agentwiki serve');
  });

// Command: compile
program
  .command('compile <source>')
  .description('Compile OpenAPI specs or Markdown docs into high-density AgentWiki pages')
  .action((source) => {
    const agentWikiDir = path.join(process.cwd(), '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();

    try {
      const result = compileSource(source, storage, indexer);
      console.log(`Compilation complete:`);
      console.log(`  Files processed: ${result.filesProcessed}`);
      console.log(`  Entities created and indexed: ${result.entitiesCreated}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error during compilation: ${msg}`);
      process.exit(1);
    } finally {
      indexer.close();
    }
  });

// Command: serve
program
  .command('serve')
  .description('Start the Model Context Protocol (MCP) server over Stdio')
  .action(async () => {
    const agentWikiDir = path.join(process.cwd(), '.agentwiki');
    try {
      await startStdioServer(agentWikiDir);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`MCP Server failed: ${msg}`);
      process.exit(1);
    }
  });

// Command: status
program
  .command('status')
  .description('Display knowledge base statistics, indexed entities, and pending proposals')
  .action(() => {
    const agentWikiDir = path.join(process.cwd(), '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);

    const pages = storage.listPages();
    const proposals = storage.listProposals();
    const pendingProposals = proposals.filter((p) => p.status === 'pending');

    console.log('AgentWiki Knowledge Base Status:');
    console.log(`  Directory: ${agentWikiDir}`);
    console.log(`  Total Entities: ${pages.length}`);

    const categoryCounts: Record<string, number> = {};
    for (const p of pages) {
      const cat = p.metadata.category;
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }

    for (const [cat, count] of Object.entries(categoryCounts)) {
      console.log(`    - ${cat}: ${count}`);
    }

    console.log(`  Pending Agent Proposals: ${pendingProposals.length}`);
  });

// Command: review
program
  .command('review')
  .description('Review, approve, or reject staged proposals submitted by agents')
  .option('--approve <id>', 'Approve a proposal by ID')
  .option('--reject <id>', 'Reject a proposal by ID')
  .option('--approve-all', 'Approve all pending proposals')
  .action((options) => {
    const agentWikiDir = path.join(process.cwd(), '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    if (options.approve) {
      const ok = storage.updateProposalStatus(options.approve, 'approved');
      if (ok) {
        console.log(`Proposal ${options.approve} marked as approved.`);
      } else {
        console.error(`Proposal ${options.approve} not found.`);
      }
      return;
    }

    if (options.reject) {
      const ok = storage.updateProposalStatus(options.reject, 'rejected');
      if (ok) {
        console.log(`Proposal ${options.reject} marked as rejected.`);
      } else {
        console.error(`Proposal ${options.reject} not found.`);
      }
      return;
    }

    if (options.approveAll) {
      const proposals = storage.listProposals().filter((p) => p.status === 'pending');
      for (const p of proposals) {
        storage.updateProposalStatus(p.id, 'approved');
      }
      console.log(`Approved ${proposals.length} pending proposals.`);
      return;
    }

    // List all pending proposals
    const proposals = storage.listProposals();
    if (proposals.length === 0) {
      console.log('No staged proposals found.');
      return;
    }

    console.log(`Found ${proposals.length} staged proposal(s):\n`);
    for (const p of proposals) {
      console.log(`ID: ${p.id}`);
      console.log(`  Target Entity: ${p.entity_id}`);
      console.log(`  Author Agent:  ${p.author_agent}`);
      console.log(`  Status:        ${p.status}`);
      console.log(`  Claim:         ${p.claim}`);
      console.log(`  Evidence:      ${p.evidence}`);
      if (p.patch) {
        console.log(`  Proposed Patch:\n${p.patch}`);
      }
      console.log('---');
    }
    console.log('\nRun `npx @hamidshahid/agentwiki review --approve <id>` to approve.');
  });

program.parse(process.argv);
