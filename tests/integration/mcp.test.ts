import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StorageEngine } from '../../src/core/storage.js';
import { IndexerEngine } from '../../src/core/indexer.js';
import { createAgentWikiMcpServer } from '../../src/mcp/server.js';
import { AgentWikiPage } from '../../src/core/types.js';

describe('AgentWiki MCP Server', () => {
  let tempDir: string;
  let storage: StorageEngine;
  let indexer: IndexerEngine;
  let client: Client;

  const samplePage1: AgentWikiPage = {
    metadata: {
      id: 'stripe_checkout_sessions',
      name: 'Stripe Checkout Sessions API',
      category: 'api',
      version: '2024-06-20',
      tags: ['billing', 'stripe', 'checkout'],
      relations: {
        requires: ['customer_account'],
        supersedes: ['legacy_charges_v1'],
        related: ['invoices_api'],
      },
      summary: 'Creates a hosted payment checkout session for web and mobile.',
      updated_at: new Date().toISOString(),
    },
    content: '## Endpoint\n`POST /v1/checkout/sessions`\n\n## Pre-conditions\nRequires Idempotency-Key header.',
  };

  const samplePage2: AgentWikiPage = {
    metadata: {
      id: 'customer_account',
      name: 'Customer Account Entity',
      category: 'schema',
      tags: ['billing', 'customers'],
      relations: {
        requires: [],
        supersedes: [],
        related: ['stripe_checkout_sessions'],
      },
      summary: 'Represents a verified customer account.',
      updated_at: new Date().toISOString(),
    },
    content: 'Schema: { id: string, email: string }',
  };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wiki-mcp-'));
    storage = new StorageEngine(tempDir);
    storage.init();

    const dbPath = path.join(tempDir, 'index.db');
    indexer = new IndexerEngine(dbPath);
    indexer.init();

    // Populate mock pages
    storage.savePage(samplePage1);
    indexer.indexPage(samplePage1, storage.getPagePath('stripe_checkout_sessions'));

    storage.savePage(samplePage2);
    indexer.indexPage(samplePage2, storage.getPagePath('customer_account'));

    // Create MCP Server and Client
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createAgentWikiMcpServer(storage, indexer);
    await server.connect(serverTransport);

    client = new Client({ name: 'test-agent', version: '1.0' }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    indexer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers all 4 core MCP tools', async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain('agentwiki_search');
    expect(toolNames).toContain('agentwiki_read');
    expect(toolNames).toContain('agentwiki_explore_relations');
    expect(toolNames).toContain('agentwiki_propose_update');
  });

  it('agentwiki_search returns token-budgeted search results', async () => {
    const res = await client.callTool({
      name: 'agentwiki_search',
      arguments: { query: 'checkout' },
    });

    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('stripe_checkout_sessions');
    expect(text).toContain('Stripe Checkout Sessions API');
  });

  it('agentwiki_read returns full atomic page content', async () => {
    const res = await client.callTool({
      name: 'agentwiki_read',
      arguments: { id: 'stripe_checkout_sessions' },
    });

    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('POST /v1/checkout/sessions');
    expect(text).toContain('Idempotency-Key');
  });

  it('agentwiki_explore_relations returns graph edges', async () => {
    const res = await client.callTool({
      name: 'agentwiki_explore_relations',
      arguments: { id: 'stripe_checkout_sessions' },
    });

    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.requires).toContain('customer_account');
    expect(parsed.supersedes).toContain('legacy_charges_v1');
  });

  it('agentwiki_propose_update stages a proposal without mutating ground truth', async () => {
    const res = await client.callTool({
      name: 'agentwiki_propose_update',
      arguments: {
        entity_id: 'stripe_checkout_sessions',
        claim: 'Discovered undocumented rate limit of 100 req/sec',
        evidence: 'HTTP 429 received in benchmark test',
        patch: '## Rate Limit\nStrictly 100 req/sec per account.',
      },
    });

    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('staged');

    const proposals = storage.listProposals();
    expect(proposals.length).toBe(1);
    expect(proposals[0].claim).toContain('rate limit');
    expect(proposals[0].status).toBe('pending');

    // Verify ground truth was NOT modified
    const current = storage.loadPage('stripe_checkout_sessions');
    expect(current?.content).not.toContain('Strictly 100 req/sec');
  });
});
