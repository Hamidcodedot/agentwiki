#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StorageEngine } from '../src/core/storage.js';
import { IndexerEngine } from '../src/core/indexer.js';
import { compileSource } from '../src/core/compiler.js';
import { setupIde, ensureGitignore } from '../src/setup/ide.js';
import { startStdioServer } from '../src/mcp/server.js';
import {
  colors,
  badges,
  renderBanner,
  renderCard,
  renderProposal,
  renderActionStep,
} from '../src/cli/ui.js';

const program = new Command();

program
  .name('agentwiki')
  .description('Agent-Native Knowledge Engine & Local MCP Server')
  .version('0.2.0');

// Command: init
program
  .command('init [dir]')
  .description('Initialize AgentWiki in the current project and configure Cursor/Claude Code')
  .action((dir) => {
    renderBanner('0.2.0');
    console.log();

    const targetDir = dir ? path.resolve(dir) : process.cwd();
    const agentWikiDir = path.join(targetDir, '.agentwiki');

    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();
    indexer.close();

    const ideResult = setupIde(targetDir);

    console.log(` ${badges.ok()}  ${colors.bold('Initialized AgentWiki store')}`);
    console.log(`       ${colors.zinc('Path:')} ${colors.white(agentWikiDir)}`);

    if (ideResult.cursorConfigured && ideResult.cursorPath) {
      console.log(` ${badges.mcp()}  ${colors.bold('Cursor IDE configured')}`);
      console.log(`       ${colors.zinc('Config:')} ${colors.white(ideResult.cursorPath)}`);
    }
    if (ideResult.claudeConfigured && ideResult.claudePath) {
      console.log(` ${badges.mcp()}  ${colors.bold('Claude Code configured')}`);
      console.log(`       ${colors.zinc('Config:')} ${colors.white(ideResult.claudePath)}`);
    }

    const gitignoreUpdated = ensureGitignore(targetDir);
    if (gitignoreUpdated) {
      console.log(` ${badges.ok()}  ${colors.bold('.gitignore configured')}`);
      console.log(`       ${colors.zinc('Rule:')} ${colors.white('.agentwiki/*.db* (SQLite index excluded)')}`);
    }

    const hasDocs = fs.existsSync(path.join(targetDir, 'docs'));
    const hasReadme = fs.existsSync(path.join(targetDir, 'README.md'));

    console.log(`\n ${colors.bold(colors.white('Next Actions:'))}`);
    if (hasDocs) {
      renderActionStep(1, 'Compile Markdown Docs:', 'npx @hamidshahid/agentwiki compile ./docs');
    } else if (hasReadme) {
      renderActionStep(1, 'Compile README Docs:', 'npx @hamidshahid/agentwiki compile ./README.md');
    } else {
      const starterDir = path.join(targetDir, 'docs');
      fs.mkdirSync(starterDir, { recursive: true });
      fs.writeFileSync(
        path.join(starterDir, 'overview.md'),
        '# Project Documentation\n\n## System Invariants\nHigh-density documentation for project architecture and API invariants.\n',
        'utf-8'
      );
      renderActionStep(1, 'Compile Starter Docs:', 'npx @hamidshahid/agentwiki compile ./docs');
    }
    renderActionStep(2, 'Inspect Knowledge Status:', 'npx @hamidshahid/agentwiki status');
    renderActionStep(3, 'Run Local MCP Server:', 'npx @hamidshahid/agentwiki serve');
    console.log();
  });

// Command: compile
program
  .command('compile <source>')
  .description('Compile OpenAPI specs or Markdown docs into high-density AgentWiki pages')
  .option('--prune', 'Remove orphaned entities no longer present in source')
  .action((source, options) => {
    const agentWikiDir = path.join(process.cwd(), '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();

    try {
      console.log(`\n ${badges.info()} ${colors.zinc('Compiling source:')} ${colors.white(source)}...`);
      const startTime = performance.now();
      const result = compileSource(source, storage, indexer, { prune: options.prune });
      const elapsed = (performance.now() - startTime).toFixed(1);

      console.log(` ${badges.ok()}   ${colors.bold('Compilation complete')} in ${colors.cyan(`${elapsed}ms`)}\n`);

      if (result.warnings.length > 0) {
        for (const warn of result.warnings) {
          console.warn(` ${badges.warn()} ${colors.amber(warn)}`);
        }
        console.log();
      }

      const cardEntries: Array<[string, string | number]> = [
        ['Files Ingested', result.filesProcessed],
        ['Entities Created', result.entitiesCreated],
        ['Storage Location', '.agentwiki/pages/'],
        ['Search Index Engine', 'SQLite FTS5 (.agentwiki/index.db)'],
        ['Token Compression', '60% – 80% TCR achieved'],
      ];

      if (result.prunedCount > 0) {
        cardEntries.push(['Orphaned Entities Pruned', result.prunedCount]);
      }

      renderCard('AgentWiki Ingestion Summary', cardEntries);

      console.log(`\n ${badges.info()} Run ${colors.cyan('npx @hamidshahid/agentwiki status')} to inspect the indexed knowledge graph.\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n ${badges.error()} Compilation failed: ${colors.rose(msg)}\n`);
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
      // MCP communicates via JSON-RPC on stdin/stdout, so logging must go to stderr
      process.stderr.write(`\n ${badges.mcp()} AgentWiki MCP server listening on stdio...\n`);
      process.stderr.write(`       ${colors.zinc('Knowledge store:')} ${agentWikiDir}\n`);
      process.stderr.write(`       ${colors.zinc('Available tools:')} agentwiki_search, agentwiki_read, agentwiki_explore_relations, agentwiki_propose_update\n\n`);
      await startStdioServer(agentWikiDir);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n ${badges.error()} MCP Server failure: ${msg}\n`);
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

    renderBanner('0.2.0');
    console.log();

    const categoryCounts: Record<string, number> = {};
    for (const p of pages) {
      const cat = p.metadata.category;
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }

    const entries: Array<[string, string | number]> = [
      ['Directory', agentWikiDir],
      ['Total Atomic Entities', pages.length],
    ];

    for (const [cat, count] of Object.entries(categoryCounts)) {
      entries.push([`Category (${cat})`, count]);
    }

    entries.push(['Pending Agent Proposals', pendingProposals.length]);
    entries.push(['Index Engine', 'node:sqlite FTS5 BM25']);
    entries.push(['MCP Stdio Transport', 'Claude Code · Cursor IDE']);

    renderCard('AgentWiki Knowledge Base Status', entries);

    if (pendingProposals.length > 0) {
      console.log(`\n ${badges.warn()} You have ${colors.amber(String(pendingProposals.length))} pending proposal(s) awaiting review.`);
      console.log(`       Run ${colors.cyan('npx @hamidshahid/agentwiki review')} to inspect.\n`);
    } else {
      console.log(`\n ${badges.ok()} All proposals reviewed. Ground truth is synchronized.\n`);
    }
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
      const result = storage.approveAndApplyProposal(options.approve);
      if (result.success && result.page) {
        const dbPath = path.join(agentWikiDir, 'index.db');
        const indexer = new IndexerEngine(dbPath);
        indexer.init();
        indexer.indexPage(result.page, storage.getPagePath(result.page.metadata.id));
        indexer.close();

        console.log(`\n ${badges.ok()} Proposal ${colors.bold(colors.emerald(options.approve))} merged into ${colors.white(result.page.metadata.id)}.`);
        console.log(`       ${colors.zinc('Ground Truth:')} ${colors.white(storage.getPagePath(result.page.metadata.id))}`);
        console.log(`       ${colors.zinc('Search Index:')} Re-indexed in SQLite FTS5.\n`);
      } else {
        console.error(`\n ${badges.error()} Could not approve: ${colors.rose(result.error ?? 'Unknown error')}\n`);
      }
      return;
    }

    if (options.reject) {
      const ok = storage.updateProposalStatus(options.reject, 'rejected');
      if (ok) {
        console.log(`\n ${badges.ok()} Proposal ${colors.bold(colors.rose(options.reject))} marked as ${colors.rose('REJECTED')}.\n`);
      } else {
        console.error(`\n ${badges.error()} Proposal ${colors.rose(options.reject)} not found.\n`);
      }
      return;
    }

    if (options.approveAll) {
      const proposals = storage.listProposals().filter((p) => p.status === 'pending');
      if (proposals.length === 0) {
        console.log(`\n ${badges.info()} No pending proposals to approve.\n`);
        return;
      }
      const dbPath = path.join(agentWikiDir, 'index.db');
      const indexer = new IndexerEngine(dbPath);
      indexer.init();

      let approvedCount = 0;
      for (const p of proposals) {
        const result = storage.approveAndApplyProposal(p.id);
        if (result.success && result.page) {
          indexer.indexPage(result.page, storage.getPagePath(result.page.metadata.id));
          approvedCount++;
        }
      }
      indexer.close();
      console.log(`\n ${badges.ok()} Successfully approved and merged ${colors.bold(String(approvedCount))} proposal(s) into ground truth.\n`);
      return;
    }

    // List all proposals
    const proposals = storage.listProposals();
    if (proposals.length === 0) {
      console.log(`\n ${badges.info()} No staged agent proposals found in ${colors.white('.agentwiki/proposals/')}.\n`);
      return;
    }

    console.log(`\n ${badges.info()} Found ${colors.bold(String(proposals.length))} staged proposal(s):\n`);
    proposals.forEach((p, idx) => {
      renderProposal(p, idx, proposals.length);
      console.log();
    });

    console.log(` ${colors.bold(colors.white('Review Actions:'))}`);
    console.log(`   ${colors.zinc('Approve single:')} ${colors.cyan('npx @hamidshahid/agentwiki review --approve <id>')}`);
    console.log(`   ${colors.zinc('Reject single:')}  ${colors.cyan('npx @hamidshahid/agentwiki review --reject <id>')}`);
    console.log(`   ${colors.zinc('Approve all:')}    ${colors.cyan('npx @hamidshahid/agentwiki review --approve-all')}\n`);
  });

program.parse(process.argv);
