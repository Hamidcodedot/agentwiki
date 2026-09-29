import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { setupIde } from '../../src/setup/ide.js';
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
});
