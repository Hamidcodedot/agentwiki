import { z } from 'zod';

/**
 * Valid category types for AgentWiki knowledge entities.
 */
export const PageCategorySchema = z.enum([
  'api',
  'concept',
  'schema',
  'guide',
  'troubleshooting',
]);
export type PageCategory = z.infer<typeof PageCategorySchema>;

/**
 * Strict regex pattern for entity IDs: alphanumeric, underscores, hyphens only.
 * Disallows path traversal characters (no slashes, no dots, no backslashes).
 */
export const EntityIdPattern = /^[a-zA-Z0-9_-]+$/;

export const EntityIdSchema = z
  .string()
  .min(1, 'Entity ID cannot be empty')
  .max(128, 'Entity ID cannot exceed 128 characters')
  .regex(
    EntityIdPattern,
    'Entity ID must contain only alphanumeric characters, underscores, and hyphens'
  );

/**
 * Relational edges between knowledge entities.
 */
export const PageRelationsSchema = z.object({
  requires: z.array(z.string()).default([]),
  supersedes: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
});
export type PageRelations = z.infer<typeof PageRelationsSchema>;

/**
 * Metadata stored in YAML frontmatter.
 */
export const AgentWikiMetadataSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'Entity name is required'),
  category: PageCategorySchema.default('api'),
  version: z.string().optional(),
  tags: z.array(z.string()).default([]),
  relations: PageRelationsSchema.default({ requires: [], supersedes: [], related: [] }),
  summary: z.string().min(1, 'Summary is required'),
  updated_at: z.string().datetime().default(() => new Date().toISOString()),
});
export type AgentWikiMetadata = z.infer<typeof AgentWikiMetadataSchema>;

/**
 * Complete in-memory representation of an AgentWiki knowledge unit.
 */
export const AgentWikiPageSchema = z.object({
  metadata: AgentWikiMetadataSchema,
  content: z.string().default(''),
});
export type AgentWikiPage = z.infer<typeof AgentWikiPageSchema>;

/**
 * Staged proposal submitted by an autonomous agent.
 */
export const ProposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const AgentWikiProposalSchema = z.object({
  id: z.string().min(1),
  entity_id: EntityIdSchema,
  author_agent: z.string().default('unknown-agent'),
  claim: z.string().min(1, 'Claim description is required'),
  evidence: z.string().min(1, 'Evidence trace is required'),
  patch: z.string().optional(),
  status: ProposalStatusSchema.default('pending'),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});
export type AgentWikiProposal = z.infer<typeof AgentWikiProposalSchema>;

/**
 * Search result returned by the FTS5 indexer.
 */
export interface SearchResult {
  id: string;
  name: string;
  category: PageCategory;
  summary: string;
  tags: string[];
  score: number;
}

/**
 * Graph traversal result for explore_relations tool.
 */
export interface RelationGraph {
  id: string;
  requires: string[];
  required_by: string[];
  supersedes: string[];
  superseded_by: string[];
  related: string[];
}
