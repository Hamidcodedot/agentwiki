import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import {
  AgentWikiPage,
  PageCategory,
  RelationGraph,
  SearchResult,
} from './types.js';

export interface SearchOptions {
  category?: PageCategory;
  limit?: number;
}

/**
 * IndexerEngine powers fast full-text search (BM25) and relational graph querying
 * using Node.js native node:sqlite with built-in FTS5.
 */
export class IndexerEngine {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
  }

  /**
   * Initializes database schema and virtual tables.
   */
  public init(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        version TEXT,
        summary TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        id,
        name,
        category,
        tags,
        summary,
        content,
        tokenize = 'porter unicode61'
      );

      CREATE TABLE IF NOT EXISTS relations (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        PRIMARY KEY (source_id, target_id, relation_type)
      );

      CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);

      CREATE TABLE IF NOT EXISTS entity_tags (
        entity_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (entity_id, tag)
      );

      CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag);
    `);
  }

  /**
   * Indexes an AgentWikiPage into SQLite tables and FTS5 virtual table.
   */
  public indexPage(page: AgentWikiPage, filePath: string): void {
    const meta = page.metadata;
    const contentHash = crypto
      .createHash('sha256')
      .update(page.content)
      .digest('hex');

    // 1. Upsert entities table
    const entityStmt = this.db.prepare(`
      INSERT OR REPLACE INTO entities (
        id, name, category, version, summary, file_path, content_hash, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    entityStmt.run(
      meta.id,
      meta.name,
      meta.category,
      meta.version ?? null,
      meta.summary,
      filePath,
      contentHash,
      meta.updated_at
    );

    // 2. Refresh FTS5 index
    const deleteFtsStmt = this.db.prepare('DELETE FROM entities_fts WHERE id = ?');
    deleteFtsStmt.run(meta.id);

    const insertFtsStmt = this.db.prepare(`
      INSERT INTO entities_fts (id, name, category, tags, summary, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const tagsString = meta.tags.join(' ');
    insertFtsStmt.run(
      meta.id,
      meta.name,
      meta.category,
      tagsString,
      meta.summary,
      page.content
    );

    // 3. Refresh relations table
    const deleteRelStmt = this.db.prepare('DELETE FROM relations WHERE source_id = ?');
    deleteRelStmt.run(meta.id);

    const insertRelStmt = this.db.prepare(`
      INSERT OR IGNORE INTO relations (source_id, target_id, relation_type)
      VALUES (?, ?, ?)
    `);

    for (const target of meta.relations.requires ?? []) {
      insertRelStmt.run(meta.id, target, 'requires');
    }
    for (const target of meta.relations.supersedes ?? []) {
      insertRelStmt.run(meta.id, target, 'supersedes');
    }
    for (const target of meta.relations.related ?? []) {
      insertRelStmt.run(meta.id, target, 'related');
    }

    // 4. Refresh entity_tags table
    const deleteTagsStmt = this.db.prepare('DELETE FROM entity_tags WHERE entity_id = ?');
    deleteTagsStmt.run(meta.id);

    const insertTagStmt = this.db.prepare(`
      INSERT OR IGNORE INTO entity_tags (entity_id, tag)
      VALUES (?, ?)
    `);
    for (const tag of meta.tags) {
      insertTagStmt.run(meta.id, tag);
    }
  }

  /**
   * Removes an entity from all index tables.
   */
  public removeIndex(id: string): void {
    this.db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM entities_fts WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM relations WHERE source_id = ? OR target_id = ?').run(id, id);
    this.db.prepare('DELETE FROM entity_tags WHERE entity_id = ?').run(id);
  }

  /**
   * Sanitizes user input into a valid FTS5 query string.
   */
  private sanitizeFtsQuery(query: string): string {
    // Extract alphanumeric terms, allowing underscores and hyphens
    const terms = query
      .trim()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (terms.length === 0) {
      return '';
    }

    // Combine terms with OR prefix matching or direct term matches
    return terms.map((t) => `"${t}"*`).join(' OR ');
  }

  /**
   * Searches the knowledge base using FTS5 BM25 ranking.
   */
  public search(query: string, options: SearchOptions = {}): SearchResult[] {
    const cleanQuery = this.sanitizeFtsQuery(query);
    if (!cleanQuery) {
      return [];
    }

    const limit = options.limit ?? 10;
    const category = options.category;

    let sql = `
      SELECT 
        e.id, 
        e.name, 
        e.category, 
        e.summary, 
        fts.rank AS score,
        COALESCE(GROUP_CONCAT(t.tag, ','), '') AS tags_csv
      FROM entities_fts fts
      JOIN entities e ON e.id = fts.id
      LEFT JOIN entity_tags t ON t.entity_id = e.id
      WHERE entities_fts MATCH ?
    `;

    const params: (string | number)[] = [cleanQuery];

    if (category) {
      sql += ' AND e.category = ?';
      params.push(category);
    }

    sql += ' GROUP BY e.id ORDER BY fts.rank ASC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      name: string;
      category: string;
      summary: string;
      score: number;
      tags_csv: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as PageCategory,
      summary: r.summary,
      score: r.score,
      tags: r.tags_csv ? r.tags_csv.split(',').filter(Boolean) : [],
    }));
  }

  /**
   * Traverses incoming and outgoing relational edges for an entity.
   */
  public getRelations(id: string): RelationGraph {
    const outgoingStmt = this.db.prepare(
      'SELECT target_id, relation_type FROM relations WHERE source_id = ?'
    );
    const outgoing = outgoingStmt.all(id) as Array<{
      target_id: string;
      relation_type: string;
    }>;

    const incomingStmt = this.db.prepare(
      'SELECT source_id, relation_type FROM relations WHERE target_id = ?'
    );
    const incoming = incomingStmt.all(id) as Array<{
      source_id: string;
      relation_type: string;
    }>;

    const graph: RelationGraph = {
      id,
      requires: [],
      required_by: [],
      supersedes: [],
      superseded_by: [],
      related: [],
    };

    for (const edge of outgoing) {
      if (edge.relation_type === 'requires') {
        graph.requires.push(edge.target_id);
      } else if (edge.relation_type === 'supersedes') {
        graph.supersedes.push(edge.target_id);
      } else if (edge.relation_type === 'related') {
        graph.related.push(edge.target_id);
      }
    }

    for (const edge of incoming) {
      if (edge.relation_type === 'requires') {
        graph.required_by.push(edge.source_id);
      } else if (edge.relation_type === 'supersedes') {
        graph.superseded_by.push(edge.source_id);
      } else if (edge.relation_type === 'related') {
        if (!graph.related.includes(edge.source_id)) {
          graph.related.push(edge.source_id);
        }
      }
    }

    return graph;
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    this.db.close();
  }
}
