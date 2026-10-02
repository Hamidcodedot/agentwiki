import * as fs from 'node:fs';
import * as path from 'node:path';
import { StorageEngine } from './storage.js';
import { IndexerEngine } from './indexer.js';
import { parseOpenApi } from '../parsers/openapi.js';
import { parseMarkdownDoc } from '../parsers/markdown.js';
import { AgentWikiPage } from './types.js';

export interface CompileOptions {
  prune?: boolean;
}

export interface CompileResult {
  filesProcessed: number;
  entitiesCreated: number;
  prunedCount: number;
  warnings: string[];
  pages: AgentWikiPage[];
}

/**
 * Compiles files or directories into high-density AgentWiki pages and indexes them in SQLite FTS5.
 */
export function compileSource(
  sourcePath: string,
  storage: StorageEngine,
  indexer: IndexerEngine,
  options?: CompileOptions
): CompileResult {
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const stat = fs.statSync(resolved);
  const files: string[] = [];

  if (stat.isFile()) {
    files.push(resolved);
  } else if (stat.isDirectory()) {
    collectFiles(resolved, files);
  }

  let filesProcessed = 0;
  const compiledPages: AgentWikiPage[] = [];
  const warnings: string[] = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    let pages: AgentWikiPage[] = [];

    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      try {
        pages = parseOpenApi(content);
        if (pages.length === 0 && stat.isFile()) {
          warnings.push(`File "${path.basename(filePath)}" contains no valid OpenAPI operations or endpoints.`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (stat.isFile()) {
          warnings.push(`Failed to parse "${path.basename(filePath)}": ${msg}`);
        }
      }
    } else if (ext === '.md' || ext === '.markdown') {
      const docTitle = path.basename(filePath, ext);
      pages = parseMarkdownDoc(content, docTitle);
      if (pages.length === 0 && stat.isFile()) {
        warnings.push(`File "${path.basename(filePath)}" contains no headings or content to index.`);
      }
    }

    if (pages.length > 0) {
      filesProcessed++;
      for (const page of pages) {
        storage.savePage(page);
        indexer.indexPage(page, storage.getPagePath(page.metadata.id));
        compiledPages.push(page);
      }
    }
  }

  let prunedCount = 0;
  if (options?.prune) {
    const compiledIds = new Set(compiledPages.map((p) => p.metadata.id));
    const existingPages = storage.listPages();
    for (const existing of existingPages) {
      if (!compiledIds.has(existing.metadata.id)) {
        storage.deletePage(existing.metadata.id);
        indexer.removeIndex(existing.metadata.id);
        prunedCount++;
      }
    }
  }

  return {
    filesProcessed,
    entitiesCreated: compiledPages.length,
    prunedCount,
    warnings,
    pages: compiledPages,
  };
}

function collectFiles(dir: string, fileList: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.agentwiki' ||
        entry.name === 'dist'
      ) {
        continue;
      }
      collectFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.json', '.yaml', '.yml', '.md', '.markdown'].includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
}
