import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseProjectManifest, getManifestHash } from '../../src/parsers/manifest.js';
import { syncManifestIfChanged } from '../../src/core/compiler.js';
import { StorageEngine } from '../../src/core/storage.js';
import { IndexerEngine } from '../../src/core/indexer.js';

describe('Manifest & Topology Parser', () => {
  let tmpDir: string;
  let agentWikiDir: string;
  let storage: StorageEngine;
  let indexer: IndexerEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentwiki-manifest-test-'));
    agentWikiDir = path.join(tmpDir, '.agentwiki');
    storage = new StorageEngine(agentWikiDir);
    storage.init();
    indexer = new IndexerEngine(path.join(agentWikiDir, 'index.db'));
    indexer.init();
  });

  afterEach(() => {
    indexer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses Node.js package.json and workspace directory topology', () => {
    // Create mock project structure
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-saas-api',
          version: '1.2.0',
          description: 'Payment gateway service',
          main: './dist/index.js',
          bin: { 'test-cli': './dist/bin.js' },
          scripts: {
            build: 'tsc -p tsconfig.json',
            test: 'vitest run',
            lint: 'eslint .',
          },
          dependencies: {
            express: '^4.18.2',
            zod: '^3.22.4',
          },
        },
        null,
        2
      )
    );

    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, 'tests'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export const api = true;');

    const page = parseProjectManifest(tmpDir);
    expect(page).toBeDefined();
    expect(page?.metadata.id).toBe('architecture_overview');
    expect(page?.metadata.tags).toContain('nodejs');
    expect(page?.metadata.tags).toContain('npm');
    expect(page?.content).toContain('test-saas-api');
    expect(page?.content).toContain('v1.2.0');
    expect(page?.content).toContain('Payment gateway service');
    expect(page?.content).toContain('npm run build');
    expect(page?.content).toContain('express');
    expect(page?.content).toContain('src/');
    expect(page?.content).toContain('tests/');

    // Verify token budget invariant (< 400 tokens / 1600 characters)
    const charCount = (page?.content.length ?? 0) + (page?.metadata.summary.length ?? 0);
    const estimatedTokens = Math.ceil(charCount / 4);
    expect(estimatedTokens).toBeLessThan(400);
  });

  it('detects manifest hash changes when dependencies are updated', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'hash-test', version: '1.0.0' }));

    const initialHash = getManifestHash(tmpDir);
    expect(initialHash).toBeTruthy();

    // Modify package.json
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({ name: 'hash-test', version: '1.0.1', dependencies: { axios: '^1.0.0' } })
    );

    const updatedHash = getManifestHash(tmpDir);
    expect(updatedHash).not.toBe(initialHash);
  });

  it('syncManifestIfChanged updates ground truth and SQLite index, and is idempotent on repeat', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'sync-test', version: '1.0.0' })
    );

    // Initial sync
    const firstSync = syncManifestIfChanged(tmpDir, storage, indexer);
    expect(firstSync.updated).toBe(true);
    expect(firstSync.page).toBeDefined();

    const loaded = storage.loadPage('architecture_overview');
    expect(loaded).toBeDefined();
    expect(loaded?.content).toContain('sync-test');

    const searchResults = indexer.search('sync-test');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].id).toBe('architecture_overview');

    // Repeat sync with unchanged manifest should NOT update
    const repeatSync = syncManifestIfChanged(tmpDir, storage, indexer);
    expect(repeatSync.updated).toBe(false);

    // Update manifest -> should update
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'sync-test', version: '2.0.0', dependencies: { fastify: '^4.0.0' } })
    );

    const afterUpdateSync = syncManifestIfChanged(tmpDir, storage, indexer);
    expect(afterUpdateSync.updated).toBe(true);

    const reloaded = storage.loadPage('architecture_overview');
    expect(reloaded?.content).toContain('fastify');
  });

  it('parses Python, Rust, and Go project ecosystems gracefully', () => {
    const pythonDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentwiki-python-'));
    fs.writeFileSync(path.join(pythonDir, 'pyproject.toml'), '[tool.poetry]\nname = "py-app"\n');
    const pythonPage = parseProjectManifest(pythonDir);
    expect(pythonPage?.metadata.tags).toContain('python');
    fs.rmSync(pythonDir, { recursive: true, force: true });

    const rustDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentwiki-rust-'));
    fs.writeFileSync(path.join(rustDir, 'Cargo.toml'), '[package]\nname = "rust-app"\n');
    const rustPage = parseProjectManifest(rustDir);
    expect(rustPage?.metadata.tags).toContain('rust');
    fs.rmSync(rustDir, { recursive: true, force: true });

    const goDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentwiki-go-'));
    fs.writeFileSync(path.join(goDir, 'go.mod'), 'module github.com/user/goapp\n');
    const goPage = parseProjectManifest(goDir);
    expect(goPage?.metadata.tags).toContain('go');
    fs.rmSync(goDir, { recursive: true, force: true });
  });
});
