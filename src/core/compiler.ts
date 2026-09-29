import * as fs from 'node:fs';
import * as path from 'node:path';
import { StorageEngine } from './storage.js';
import { IndexerEngine } from './indexer.js';
import { parseOpenApi } from '../parsers/openapi.js';
import { parseMarkdownDoc } from '../parsers/markdown.js';
import { AgentWikiPage } from './types.js';

export interface CompileResult {
  filesProcessed: number;
  entitiesCreated: number;
  pages: AgentWikiPage[];
}

/**
 * Compiles files or directories into high-density AgentWiki pages and indexes them in SQLite FTS5.
 */
export function compileSource(
  sourcePath: string,
  storage: StorageEngine,
  indexer: IndexerEngine
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

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    let pages: AgentWikiPage[] = [];

    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      try {
        pages = parseOpenApi(content);
      } catch {
        // Not a valid OpenAPI spec, skip cleanly
      }
    } else if (ext === '.md' || ext === '.markdown') {
      const docTitle = path.basename(filePath, ext);
      pages = parseMarkdownDoc(content, docTitle);
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

  return {
    filesProcessed,
    entitiesCreated: compiledPages.length,
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
