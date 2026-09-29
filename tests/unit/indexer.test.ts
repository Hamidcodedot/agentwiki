import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { IndexerEngine } from '../../src/core/indexer.js';
import { AgentWikiPage } from '../../src/core/types.js';

describe('IndexerEngine (SQLite FTS5)', () => {
  let tempDir: string;
  let dbPath: string;
  let indexer: IndexerEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wiki-indexer-'));
    dbPath = path.join(tempDir, 'index.db');
    indexer = new IndexerEngine(dbPath);
    indexer.init();
  });

  afterEach(() => {
    indexer.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

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
    content: 'POST /v1/checkout/sessions\nRequires Idempotency-Key header.',
  };

  const samplePage2: AgentWikiPage = {
    metadata: {
      id: 'customer_account',
      name: 'Customer Account Entity',
      category: 'schema',
      tags: ['billing', 'auth', 'customers'],
      relations: {
        requires: [],
        supersedes: [],
        related: ['stripe_checkout_sessions'],
      },
      summary: 'Core schema representing a verified user billing customer.',
      updated_at: new Date().toISOString(),
    },
    content: 'Schema: { id: string, email: string, balance: number }',
  };

  it('indexes pages and performs full-text BM25 search', () => {
    indexer.indexPage(samplePage1, '/fake/path/1.md');
    indexer.indexPage(samplePage2, '/fake/path/2.md');

    // Search by keyword in name
    const checkoutResults = indexer.search('checkout');
    expect(checkoutResults.length).toBeGreaterThan(0);
    expect(checkoutResults[0].id).toBe('stripe_checkout_sessions');

    // Search by tag or content keyword
    const billingResults = indexer.search('billing');
    expect(billingResults.length).toBe(2);

    // Search by exact phrase or parameter in content
    const idempotencyResults = indexer.search('Idempotency');
    expect(idempotencyResults.length).toBe(1);
    expect(idempotencyResults[0].id).toBe('stripe_checkout_sessions');
  });

  it('filters search results by category', () => {
    indexer.indexPage(samplePage1, '/fake/path/1.md');
    indexer.indexPage(samplePage2, '/fake/path/2.md');

    const apiOnly = indexer.search('billing', { category: 'api' });
    expect(apiOnly.length).toBe(1);
    expect(apiOnly[0].category).toBe('api');
    expect(apiOnly[0].id).toBe('stripe_checkout_sessions');

    const schemaOnly = indexer.search('billing', { category: 'schema' });
    expect(schemaOnly.length).toBe(1);
    expect(schemaOnly[0].category).toBe('schema');
    expect(schemaOnly[0].id).toBe('customer_account');
  });

  it('traverses relational graph edges correctly', () => {
    indexer.indexPage(samplePage1, '/fake/path/1.md');
    indexer.indexPage(samplePage2, '/fake/path/2.md');

    // Check outgoing relations for samplePage1
    const relations1 = indexer.getRelations('stripe_checkout_sessions');
    expect(relations1.requires).toContain('customer_account');
    expect(relations1.supersedes).toContain('legacy_charges_v1');
    expect(relations1.related).toContain('invoices_api');

    // Check incoming relations for customer_account (it is required by stripe_checkout_sessions)
    const relations2 = indexer.getRelations('customer_account');
    expect(relations2.required_by).toContain('stripe_checkout_sessions');
    expect(relations2.related).toContain('stripe_checkout_sessions');
  });

  it('removes index when an entity is deleted', () => {
    indexer.indexPage(samplePage1, '/fake/path/1.md');
    expect(indexer.search('checkout').length).toBe(1);

    indexer.removeIndex('stripe_checkout_sessions');
    expect(indexer.search('checkout').length).toBe(0);

    const rels = indexer.getRelations('stripe_checkout_sessions');
    expect(rels.requires.length).toBe(0);
  });

  it('executes search within sub-15ms latency constraint', () => {
    // Index 50 items
    for (let i = 0; i < 50; i++) {
      indexer.indexPage(
        {
          metadata: {
            id: `entity_perf_${i}`,
            name: `Performance Test Entity ${i}`,
            category: i % 2 === 0 ? 'api' : 'concept',
            tags: ['benchmark', `tag_${i}`],
            relations: { requires: [], supersedes: [], related: [] },
            summary: `High throughput performance test summary item number ${i}`,
            updated_at: new Date().toISOString(),
          },
          content: `Benchmark test content payload with distinct identifiers token_${i}`,
        },
        `/fake/perf/${i}.md`
      );
    }

    const start = performance.now();
    const results = indexer.search('benchmark throughput');
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(15); // Must be under 15ms
  });
});
