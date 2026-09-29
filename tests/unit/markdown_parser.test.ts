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
});
