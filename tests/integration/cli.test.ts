import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { setupIde, ensureGitignore } from '../../src/setup/ide.js';
import { StorageEngine } from '../../src/core/storage.js';
import { IndexerEngine } from '../../src/core/indexer.js';
import { compileSource } from '../../src/core/compiler.js';

describe('CLI Integration Workflows', () => {
  let tempProjectDir: string;

  beforeEach(() => {
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wiki-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  });

  it('init workflow configures .cursor/mcp.json and .mcp.json non-destructively', () => {
    const result = setupIde(tempProjectDir);

    expect(result.cursorConfigured).toBe(true);
    expect(result.claudeConfigured).toBe(true);

    const cursorConfig = JSON.parse(
      fs.readFileSync(path.join(tempProjectDir, '.cursor', 'mcp.json'), 'utf-8')
    );
    expect(cursorConfig.mcpServers['agentwiki']).toBeDefined();
    expect(cursorConfig.mcpServers['agentwiki'].command).toBe('npx');

    const claudeConfig = JSON.parse(
      fs.readFileSync(path.join(tempProjectDir, '.mcp.json'), 'utf-8')
    );
    expect(claudeConfig.mcpServers['agentwiki']).toBeDefined();
  });

  it('compile workflow ingests OpenAPI fixture and indexes into SQLite', () => {
    const agentWikiDir = path.join(tempProjectDir, '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();

    const openapiFixture = path.resolve('tests/fixtures/sample_openapi.json');
    const result = compileSource(openapiFixture, storage, indexer);

    expect(result.filesProcessed).toBe(1);
    expect(result.entitiesCreated).toBe(2);

    // Verify files exist in storage
    const pages = storage.listPages();
    expect(pages.length).toBe(2);

    // Verify search works on the index
    const searchResults = indexer.search('checkout');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].id).toBe('post_v2_checkout_sessions');

    indexer.close();
  });

  it('compile workflow handles directory of mixed markdown and OpenAPI files', () => {
    const agentWikiDir = path.join(tempProjectDir, '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();

    const fixturesDir = path.resolve('tests/fixtures');
    const result = compileSource(fixturesDir, storage, indexer);

    expect(result.filesProcessed).toBe(2);
    expect(result.entitiesCreated).toBeGreaterThanOrEqual(4);

    const searchApi = indexer.search('checkout');
    expect(searchApi.length).toBeGreaterThan(0);

    const searchGuide = indexer.search('webhook');
    expect(searchGuide.length).toBeGreaterThan(0);

    indexer.close();
  });

  it('compile workflow prunes orphaned entities when source files are deleted', () => {
    const agentWikiDir = path.join(tempProjectDir, '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();

    try {
      // 1. Create a dummy doc directory with 2 files
      const docsDir = path.join(tempProjectDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'fileA.md'), '## Alpha Service\nArchitecture for Alpha', 'utf-8');
      fs.writeFileSync(path.join(docsDir, 'fileB.md'), '## Beta Payment\nIntegration for Beta', 'utf-8');

      // Compile both
      const initialResult = compileSource(docsDir, storage, indexer);
      expect(initialResult.entitiesCreated).toBe(2);
      expect(storage.listPages().length).toBe(2);

      // 2. Delete fileB.md
      fs.unlinkSync(path.join(docsDir, 'fileB.md'));

      // Re-compile with prune: true
      const prunedResult = compileSource(docsDir, storage, indexer, { prune: true });
      expect(prunedResult.entitiesCreated).toBe(1);
      expect(prunedResult.prunedCount).toBe(1);

      // Verify storage only has Alpha Service
      const pages = storage.listPages();
      expect(pages.length).toBe(1);
      expect(pages[0].metadata.id).toBe('alpha_service');
      expect(storage.loadPage('beta_payment')).toBeNull();

      // Verify indexer does not return Beta Payment
      const searchBeta = indexer.search('Beta');
      expect(searchBeta.length).toBe(0);
    } finally {
      indexer.close();
    }
  });

  it('collects diagnostic warnings when compiling a file without valid endpoints', () => {
    const agentWikiDir = path.join(tempProjectDir, '.agentwiki');
    const storage = new StorageEngine(agentWikiDir);
    storage.init();

    const dbPath = path.join(agentWikiDir, 'index.db');
    const indexer = new IndexerEngine(dbPath);
    indexer.init();

    // Create an empty json file
    const invalidFile = path.join(tempProjectDir, 'empty.json');
    fs.writeFileSync(invalidFile, '{"name": "not an openapi spec"}', 'utf-8');

    const result = compileSource(invalidFile, storage, indexer);
    expect(result.entitiesCreated).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('no valid OpenAPI operations');

    indexer.close();
  });

  it('detects local package installation and generates direct node config with workspaceFolder cwd', () => {
    // Scaffold fake local package in node_modules
    const localPkgDir = path.join(tempProjectDir, 'node_modules', '@hamidshahid', 'agentwiki', 'dist', 'bin');
    fs.mkdirSync(localPkgDir, { recursive: true });
    fs.writeFileSync(path.join(localPkgDir, 'cli.js'), '#!/usr/bin/env node', 'utf-8');

    const result = setupIde(tempProjectDir);
    expect(result.cursorConfigured).toBe(true);

    const cursorConfig = JSON.parse(
      fs.readFileSync(path.join(tempProjectDir, '.cursor', 'mcp.json'), 'utf-8')
    );
    expect(cursorConfig.mcpServers['agentwiki'].command).toBe('node');
    expect(cursorConfig.mcpServers['agentwiki'].cwd).toBe('${workspaceFolder}');
  });

  it('preserves existing servers in mcp.json even with comments or trailing commas', () => {
    const cursorDir = path.join(tempProjectDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });

    // Existing config with single-line comments, multi-line comments, and trailing commas
    const existingRaw = `{
      // Development server
      "mcpServers": {
        "existing_server": {
          "command": "node",
          "args": ["server.js"],
        }, /* end of existing */
      },
    }`;
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), existingRaw, 'utf-8');

    const result = setupIde(tempProjectDir);
    expect(result.cursorConfigured).toBe(true);

    const updated = JSON.parse(
      fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf-8')
    );
    expect(updated.mcpServers['existing_server']).toBeDefined();
    expect(updated.mcpServers['agentwiki']).toBeDefined();
  });

  it('creates backup file if existing mcp config is severely corrupted rather than wiping user data', () => {
    const cursorDir = path.join(tempProjectDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });

    const corruptRaw = 'THIS IS COMPLETELY UNPARSABLE CORRUPT DATA {{{';
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), corruptRaw, 'utf-8');

    setupIde(tempProjectDir);

    // Verify backup was created preserving user data
    expect(fs.existsSync(path.join(cursorDir, 'mcp.json.bak'))).toBe(true);
    expect(fs.readFileSync(path.join(cursorDir, 'mcp.json.bak'), 'utf-8')).toBe(corruptRaw);
  });

  it('ensureGitignore safely appends sqlite index exclusion to project .gitignore', () => {
    // 1. Initial creation
    const created = ensureGitignore(tempProjectDir);
    expect(created).toBe(true);

    let content = fs.readFileSync(path.join(tempProjectDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.agentwiki/*.db*');

    // 2. Second run is idempotent
    const second = ensureGitignore(tempProjectDir);
    expect(second).toBe(false);

    content = fs.readFileSync(path.join(tempProjectDir, '.gitignore'), 'utf-8');
    const matches = content.match(/\.agentwiki\/\*\.db\*/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
