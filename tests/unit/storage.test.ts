import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StorageEngine } from '../../src/core/storage.js';
import { AgentWikiPage, AgentWikiProposal } from '../../src/core/types.js';

describe('StorageEngine', () => {
  let tempDir: string;
  let storage: StorageEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wiki-test-'));
    storage = new StorageEngine(tempDir);
    storage.init();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes directories properly', () => {
    expect(fs.existsSync(path.join(tempDir, 'pages'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'proposals'))).toBe(true);
  });

  it('saves and loads a page with YAML frontmatter', () => {
    const page: AgentWikiPage = {
      metadata: {
        id: 'stripe_checkout_v1',
        name: 'Stripe Checkout API',
        category: 'api',
        version: '1.0',
        tags: ['billing', 'payments'],
        relations: {
          requires: ['auth_token'],
          supersedes: ['legacy_charge'],
          related: ['invoices'],
        },
        summary: 'High-density specification for Stripe checkout session creation.',
        updated_at: new Date().toISOString(),
      },
      content: '## Pre-conditions\n- Valid customer ID\n\n## Endpoint\nPOST /v1/checkout/sessions',
    };

    storage.savePage(page);

    const loaded = storage.loadPage('stripe_checkout_v1');
    expect(loaded).toBeDefined();
    expect(loaded?.metadata.id).toBe('stripe_checkout_v1');
    expect(loaded?.metadata.name).toBe('Stripe Checkout API');
    expect(loaded?.metadata.tags).toContain('billing');
    expect(loaded?.metadata.relations.requires).toContain('auth_token');
    expect(loaded?.content).toContain('POST /v1/checkout/sessions');
  });

  it('rejects path traversal attempts in entity ID', () => {
    expect(() => {
      storage.loadPage('../secret');
    }).toThrow();

    expect(() => {
      storage.loadPage('folder/nested');
    }).toThrow();

    expect(() => {
      storage.loadPage('..\\windows_traversal');
    }).toThrow();
  });

  it('lists all saved pages', () => {
    const pageA: AgentWikiPage = {
      metadata: {
        id: 'entity_a',
        name: 'Entity A',
        category: 'concept',
        tags: ['test'],
        relations: { requires: [], supersedes: [], related: [] },
        summary: 'Entity A summary',
        updated_at: new Date().toISOString(),
      },
      content: 'Content A',
    };

    const pageB: AgentWikiPage = {
      metadata: {
        id: 'entity_b',
        name: 'Entity B',
        category: 'schema',
        tags: ['test'],
        relations: { requires: [], supersedes: [], related: [] },
        summary: 'Entity B summary',
        updated_at: new Date().toISOString(),
      },
      content: 'Content B',
    };

    storage.savePage(pageA);
    storage.savePage(pageB);

    const pages = storage.listPages();
    expect(pages.length).toBe(2);
    const ids = pages.map((p) => p.metadata.id);
    expect(ids).toContain('entity_a');
    expect(ids).toContain('entity_b');
  });

  it('deletes a page cleanly', () => {
    const page: AgentWikiPage = {
      metadata: {
        id: 'to_delete',
        name: 'To Delete',
        category: 'guide',
        tags: [],
        relations: { requires: [], supersedes: [], related: [] },
        summary: 'Will be deleted',
        updated_at: new Date().toISOString(),
      },
      content: 'Goodbye',
    };

    storage.savePage(page);
    expect(storage.loadPage('to_delete')).toBeDefined();

    const deleted = storage.deletePage('to_delete');
    expect(deleted).toBe(true);
    expect(storage.loadPage('to_delete')).toBeNull();
  });

  it('saves, loads, and updates agent proposals', () => {
    const proposal: AgentWikiProposal = {
      id: 'prop_test_1',
      entity_id: 'stripe_checkout_v1',
      author_agent: 'claude-code',
      claim: 'Requires idempotency key header in production',
      evidence: 'HTTP 400 Idempotency-Key missing in curl test',
      patch: '## Header\nIdempotency-Key is required.',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    storage.saveProposal(proposal);

    const proposals = storage.listProposals();
    expect(proposals.length).toBe(1);
    expect(proposals[0].id).toBe('prop_test_1');
    expect(proposals[0].claim).toContain('idempotency key');

    storage.updateProposalStatus('prop_test_1', 'approved');
    const updated = storage.loadProposal('prop_test_1');
    expect(updated?.status).toBe('approved');
  });
});
