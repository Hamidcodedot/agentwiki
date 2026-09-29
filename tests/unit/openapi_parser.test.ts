import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseOpenApi } from '../../src/parsers/openapi.js';

describe('OpenAPI Parser', () => {
  const fixturePath = path.resolve('tests/fixtures/sample_openapi.json');
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');

  it('parses OpenAPI JSON into valid AgentWikiPage objects', () => {
    const pages = parseOpenApi(fixtureContent);

    expect(pages.length).toBe(2);

    const checkoutPage = pages.find((p) => p.metadata.id === 'post_v2_checkout_sessions');
    expect(checkoutPage).toBeDefined();
    expect(checkoutPage?.metadata.name).toBe('Create Checkout Session');
    expect(checkoutPage?.metadata.category).toBe('api');
    expect(checkoutPage?.metadata.tags).toContain('Checkout');
    expect(checkoutPage?.metadata.tags).toContain('Billing');

    // Verify content contains endpoint, required params, and error recovery
    expect(checkoutPage?.content).toContain('POST /v2/checkout/sessions');
    expect(checkoutPage?.content).toContain('Idempotency-Key');
    expect(checkoutPage?.content).toContain('customer_id');
    expect(checkoutPage?.content).toContain('currency');
    expect(checkoutPage?.content).toContain('409');
    expect(checkoutPage?.content).toContain('429');
  });

  it('correctly maps customer retrieval endpoint', () => {
    const pages = parseOpenApi(fixtureContent);
    const customerPage = pages.find((p) => p.metadata.id === 'get_v2_customers_id');

    expect(customerPage).toBeDefined();
    expect(customerPage?.metadata.name).toBe('Retrieve Customer');
    expect(customerPage?.content).toContain('GET /v2/customers/{id}');
    expect(customerPage?.content).toContain('delinquent');
  });

  it('achieves >= 60% token compression ratio vs raw OpenAPI definition', () => {
    const rawTokens = fixtureContent.length / 4; // Approx 4 chars per token
    const pages = parseOpenApi(fixtureContent);

    const totalPageTokens = pages.reduce((sum, p) => {
      return sum + (p.content.length + p.metadata.summary.length) / 4;
    }, 0);

    const tcr = 1 - totalPageTokens / rawTokens;
    expect(tcr).toBeGreaterThanOrEqual(0.60);
  });
});
