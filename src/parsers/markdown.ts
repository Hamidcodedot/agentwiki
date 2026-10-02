import * as YAML from 'yaml';
import { AgentWikiPage, PageCategory } from '../core/types.js';

/**
 * Sanitizes a single tag word by stripping enclosing brackets, punctuation, and apostrophes.
 */
function sanitizeTagWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .trim();
}

/**
 * Parses a human-oriented Markdown document into atomic, high-density AgentWikiPages.
 * Preserves YAML frontmatter if present, and strips HTML elements, images, badges, and marketing boilerplate.
 */
export function parseMarkdownDoc(
  rawMarkdown: string,
  docTitle: string = 'Documentation'
): AgentWikiPage[] {
  let contentToParse = rawMarkdown;
  let customFrontmatter: {
    id?: string;
    name?: string;
    category?: PageCategory;
    tags?: string[];
    relations?: { requires?: string[]; supersedes?: string[]; related?: string[] };
    summary?: string;
  } | null = null;

  // 1. Detect and parse top-level YAML frontmatter if present
  const frontmatterMatch = contentToParse.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (frontmatterMatch) {
    try {
      customFrontmatter = YAML.parse(frontmatterMatch[1]);
      contentToParse = frontmatterMatch[2] ?? '';
    } catch {
      // Malformed frontmatter; treat as raw markdown
    }
  }

  // 2. Strip HTML tags, images, badge links, horizontal rules
  const cleaned = contentToParse
    .replace(/<[^>]*>/g, '') // HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '') // Images
    .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '') // Badges
    .replace(/^(\s*[-*_]\s*){3,}$/gm, '') // Horizontal rules
    .trim();

  // 3. Split by level 2 headings (## )
  const sections = cleaned.split(/(?=^##\s+)/m);
  const pages: AgentWikiPage[] = [];

  const baseCategory = customFrontmatter?.category ?? 'guide';
  const cleanDocTag = sanitizeTagWord(docTitle);
  const baseTags = customFrontmatter?.tags?.map(sanitizeTagWord).filter(Boolean) ?? (cleanDocTag ? [cleanDocTag] : []);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let title = '';
    let bodyLines: string[] = [];

    if (lines[0].startsWith('## ')) {
      title = lines[0].replace(/^##\s+/, '').trim();
      bodyLines = lines.slice(1);
    } else if (lines[0].startsWith('# ')) {
      title = lines[0].replace(/^#\s+/, '').trim();
      bodyLines = lines.slice(1);
    } else {
      // Preface or intro section
      title = customFrontmatter?.name ?? `${docTitle} Overview`;
      bodyLines = lines;
    }

    // Filter out pure marketing boilerplate lines
    const filteredBodyLines = bodyLines.filter((line) => {
      const lower = line.toLowerCase();
      if (
        lower.startsWith('welcome to') ||
        lower.includes('thrilled to have you') ||
        lower.includes('in this tutorial') ||
        lower.includes('in this guide, we will') ||
        lower.includes('whether you are a novice')
      ) {
        return false;
      }
      return true;
    });

    const bodyContent = filteredBodyLines.join('\n').trim();
    if (!bodyContent) continue;

    // Create unique safe ID
    const generatedId = title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 64);

    const entityId = (sections.length === 1 && customFrontmatter?.id) ? customFrontmatter.id : generatedId;

    // Extract summary (first non-empty paragraph or list item)
    const firstParagraph = filteredBodyLines.find((l) => l.trim().length > 10 && !l.startsWith('```')) ?? title;
    const summary = customFrontmatter?.summary ?? firstParagraph.replace(/^[#-*\s]+/, '').slice(0, 160).trim();

    // Clean and sanitize tags: eliminate punctuation and brackets
    const sectionTags = title
      .split(/\s+/)
      .map(sanitizeTagWord)
      .filter((w) => w.length > 2 && /^[a-zA-Z0-9_-]+$/.test(w));

    const combinedTags = Array.from(new Set([...baseTags, ...sectionTags]));

    pages.push({
      metadata: {
        id: entityId,
        name: title,
        category: baseCategory,
        tags: combinedTags,
        relations: {
          requires: customFrontmatter?.relations?.requires ?? [],
          supersedes: customFrontmatter?.relations?.supersedes ?? [],
          related: customFrontmatter?.relations?.related ?? [],
        },
        summary,
        updated_at: new Date().toISOString(),
      },
      content: bodyContent,
    });
  }

  // Cross-link sections within the same document
  const allIds = pages.map((p) => p.metadata.id);
  for (const page of pages) {
    const existingRelated = new Set(page.metadata.relations.related);
    for (const id of allIds) {
      if (id !== page.metadata.id) {
        existingRelated.add(id);
      }
    }
    page.metadata.relations.related = Array.from(existingRelated);
  }

  return pages;
}
