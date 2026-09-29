import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'node:path';
import { StorageEngine } from '../core/storage.js';
import { IndexerEngine } from '../core/indexer.js';
import { PageCategorySchema } from '../core/types.js';

/**
 * Creates and configures the AgentWiki MCP Server with all 4 core tools.
 */
export function createAgentWikiMcpServer(
  storage: StorageEngine,
  indexer: IndexerEngine
): McpServer {
  const server = new McpServer({
    name: 'agentwiki',
    version: '0.1.0',
  });

  // Tool 1: agentwiki_search
  server.tool(
    'agentwiki_search',
    'Search knowledge entities using full-text BM25 ranking and optional category filter. Returns token-budgeted summaries.',
    {
      query: z.string().describe('Search query keywords or entity name'),
      category: PageCategorySchema.optional().describe('Optional category filter: api | concept | schema | guide | troubleshooting'),
      limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum number of results to return (default: 5)'),
    },
    async ({ query, category, limit }) => {
      const results = indexer.search(query, { category, limit });

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No entities found matching query "${query}". Try searching with broader keywords.`,
            },
          ],
        };
      }

      const formatted = results.map((r, i) => {
        const tags = r.tags.length > 0 ? ` [${r.tags.join(', ')}]` : '';
        return `${i + 1}. **${r.name}** (\`${r.id}\`, category: ${r.category})${tags}\n   Summary: ${r.summary}`;
      });

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} entities:\n\n${formatted.join('\n\n')}`,
          },
        ],
      };
    }
  );

  // Tool 2: agentwiki_read
  server.tool(
    'agentwiki_read',
    'Retrieve the full atomic high-density page for a specific entity ID.',
    {
      id: z.string().describe('The exact entity ID to read'),
      section: z.string().optional().describe('Optional section header name to extract'),
    },
    async ({ id, section }) => {
      const page = storage.loadPage(id);

      if (!page) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Entity with ID "${id}" does not exist in the knowledge base. Use agentwiki_search to find valid entity IDs.`,
            },
          ],
        };
      }

      let contentToReturn = page.content;

      if (section) {
        const regex = new RegExp(`^##\\s+${section}[\\s\\S]*?(?=^##\\s+|$)`, 'im');
        const match = page.content.match(regex);
        if (match) {
          contentToReturn = match[0].trim();
        } else {
          contentToReturn = `Section "${section}" not found in page "${id}". Available full content:\n\n${page.content}`;
        }
      }

      const meta = page.metadata;
      const header = `# ${meta.name} (\`${meta.id}\`)\n` +
        `Category: ${meta.category} | Version: ${meta.version ?? 'latest'}\n` +
        `Summary: ${meta.summary}\n\n`;

      return {
        content: [
          {
            type: 'text',
            text: header + contentToReturn,
          },
        ],
      };
    }
  );

  // Tool 3: agentwiki_explore_relations
  server.tool(
    'agentwiki_explore_relations',
    'Retrieve relational graph edges (prerequisites, deprecations, related entities) for an entity.',
    {
      id: z.string().describe('The entity ID to explore relations for'),
    },
    async ({ id }) => {
      const relations = indexer.getRelations(id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(relations, null, 2),
          },
        ],
      };
    }
  );

  // Tool 4: agentwiki_propose_update
  server.tool(
    'agentwiki_propose_update',
    'Stage a newly discovered fact, bug fix, or undocumented parameter with evidence for human review.',
    {
      entity_id: z.string().describe('Entity ID being updated or created'),
      claim: z.string().describe('Concise description of the discovery or fix'),
      evidence: z.string().describe('Terminal output, execution trace, or test proof'),
      patch: z.string().optional().describe('Proposed markdown content or patch'),
      author_agent: z.string().optional().default('claude-code').describe('Agent identifier'),
    },
    async ({ entity_id, claim, evidence, patch, author_agent }) => {
      const propId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      storage.saveProposal({
        id: propId,
        entity_id,
        author_agent: author_agent ?? 'claude-code',
        claim,
        evidence,
        patch,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                proposal_id: propId,
                entity_id,
                status: 'staged',
                message:
                  'Proposal staged successfully in .agentwiki/proposals/. A human developer will review and merge it via `npx agent-wiki review`.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Starts the AgentWiki MCP Server over Stdio transport.
 */
export async function startStdioServer(
  baseDir: string = path.join(process.cwd(), '.agentwiki')
): Promise<void> {
  const storage = new StorageEngine(baseDir);
  storage.init();

  const dbPath = path.join(storage.baseDir, 'index.db');
  const indexer = new IndexerEngine(dbPath);
  indexer.init();

  const server = createAgentWikiMcpServer(storage, indexer);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}
