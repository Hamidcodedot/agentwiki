import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseMarkdownDoc } from '../../src/parsers/markdown.js';

describe('Markdown Parser', () => {
  const fixturePath = path.resolve('tests/fixtures/sample_doc.md');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');

  it('parses markdown doc into atomic high-density AgentWikiPages', () => {
    const pages = parseMarkdownDoc(fixtureContent, 'Authentication Guide');

    expect(pages.length).toBeGreaterThanOrEqual(2);

    const secretKeyPage = pages.find((p) => p.metadata.id.includes('secret_key'));
    expect(secretKeyPage).toBeDefined();
    expect(secretKeyPage?.content).toContain('Authorization: Bearer');
    expect(secretKeyPage?.content).toContain('sk_live_');

    const webhookPage = pages.find((p) => p.metadata.id.includes('webhook_signature'));
    expect(webhookPage).toBeDefined();
    expect(webhookPage?.content).toContain('X-Signature-SHA256');
    expect(webhookPage?.content).toContain('verifyWebhook');
  });

  it('strips HTML, image tags, and conversational fluff', () => {
    const pages = parseMarkdownDoc(fixtureContent, 'Authentication Guide');
    const allContent = pages.map((p) => p.content).join('\n');

    expect(allContent).not.toContain('<img');
    expect(allContent).not.toContain('<div');
    expect(allContent).not.toContain('badge.fury.io');
    expect(allContent).not.toContain('We are thrilled to have you here');
  });

  it('achieves >= 50% token compression ratio per atomic query vs raw human documentation', () => {
    const rawTokens = fixtureContent.length / 4;
    const pages = parseMarkdownDoc(fixtureContent, 'Authentication Guide');

    expect(pages.length).toBeGreaterThanOrEqual(2);

    for (const page of pages) {
      const pageTokens = (page.content.length + page.metadata.summary.length) / 4;
      const tcr = 1 - pageTokens / rawTokens;
      expect(tcr).toBeGreaterThanOrEqual(0.50);
    }
  });

  it('sanitizes tags by stripping brackets, apostrophes, and punctuation', () => {
    const raw = `
# Real-World Guide (it's fast & real!)
## Physics Simulations (it's real physics, really!)
Body content for simulation physics.
    `;
    const pages = parseMarkdownDoc(raw, 'Simulations');
    expect(pages.length).toBe(1);

    const tags = pages[0].metadata.tags;
    expect(tags).toContain('its');
    expect(tags).toContain('physics');
    expect(tags).not.toContain("(it's");
    expect(tags).not.toContain('physics,');
    expect(tags).not.toContain('really!');
  });

  it('preserves existing YAML frontmatter metadata when provided', () => {
    const raw = `---
id: custom_auth_page
name: Custom OAuth Flow
category: api
tags: [security, oauth2]
relations:
  requires: [client_id]
summary: Direct specification of OAuth flow.
---

## Authorization Code Exchange
POST /oauth/token with code and secret.
`;
    const pages = parseMarkdownDoc(raw, 'Custom Auth');
    expect(pages.length).toBe(1);
    expect(pages[0].metadata.id).toBe('custom_auth_page');
    expect(pages[0].metadata.name).toBe('Authorization Code Exchange');
    expect(pages[0].metadata.category).toBe('api');
    expect(pages[0].metadata.tags).toContain('security');
    expect(pages[0].metadata.tags).toContain('oauth2');
    expect(pages[0].metadata.relations.requires).toContain('client_id');
    expect(pages[0].metadata.summary).toBe('Direct specification of OAuth flow.');
  });
});
