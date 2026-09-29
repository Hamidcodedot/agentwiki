import { AgentWikiPage } from '../core/types.js';

/**
 * Parses a human-oriented Markdown document into atomic, high-density AgentWikiPages.
 * Strips HTML elements, images, badges, and marketing boilerplate.
 */
export function parseMarkdownDoc(
  rawMarkdown: string,
  docTitle: string = 'Documentation'
): AgentWikiPage[] {
  // 1. Strip HTML tags, images, badge links
  const cleaned = rawMarkdown
    .replace(/<[^>]*>/g, '') // HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '') // Images
    .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '') // Badges
    .replace(/^(\s*[-*_]\s*){3,}$/gm, '') // Horizontal rules
    .trim();

  // 2. Split by level 2 headings (## )
  const sections = cleaned.split(/(?=^##\s+)/m);
  const pages: AgentWikiPage[] = [];

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
      title = `${docTitle} Overview`;
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
    const entityId = title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 64);

    // Extract summary (first non-empty paragraph or list item)
    const firstParagraph = filteredBodyLines.find((l) => l.trim().length > 10 && !l.startsWith('```')) ?? title;
    const summary = firstParagraph.replace(/^[#-*\s]+/, '').slice(0, 160).trim();

    pages.push({
      metadata: {
        id: entityId,
        name: title,
        category: 'guide',
        tags: [docTitle, ...title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)],
        relations: {
          requires: [],
          supersedes: [],
          related: [],
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
    page.metadata.relations.related = allIds.filter((id) => id !== page.metadata.id);
  }

  return pages;
}
