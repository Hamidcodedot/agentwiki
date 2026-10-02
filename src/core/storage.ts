import * as fs from 'node:fs';
import * as path from 'node:path';
import * as YAML from 'yaml';
import {
  AgentWikiPage,
  AgentWikiPageSchema,
  AgentWikiProposal,
  AgentWikiProposalSchema,
  EntityIdSchema,
  ProposalStatus,
} from './types.js';

/**
 * StorageEngine manages file I/O for .agentwiki/
 * Handles markdown ground truth files with YAML frontmatter and JSON proposals.
 */
export class StorageEngine {
  public readonly baseDir: string;
  public readonly pagesDir: string;
  public readonly proposalsDir: string;

  constructor(baseDir: string = path.join(process.cwd(), '.agentwiki')) {
    this.baseDir = path.resolve(baseDir);
    this.pagesDir = path.join(this.baseDir, 'pages');
    this.proposalsDir = path.join(this.baseDir, 'proposals');
  }

  /**
   * Initializes storage directories if they do not exist.
   */
  public init(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.pagesDir)) {
      fs.mkdirSync(this.pagesDir, { recursive: true });
    }
    if (!fs.existsSync(this.proposalsDir)) {
      fs.mkdirSync(this.proposalsDir, { recursive: true });
    }
  }

  /**
   * Validates that an entity ID is safe and does not attempt directory traversal.
   */
  public validateId(id: string): string {
    return EntityIdSchema.parse(id);
  }

  /**
   * Returns the absolute path for an entity page file.
   */
  public getPagePath(id: string): string {
    const validId = this.validateId(id);
    const resolved = path.resolve(this.pagesDir, `${validId}.md`);
    if (!resolved.startsWith(this.pagesDir)) {
      throw new Error(`Path traversal attempt detected for ID: ${id}`);
    }
    return resolved;
  }

  /**
   * Saves an AgentWikiPage to disk with YAML frontmatter.
   */
  public savePage(page: AgentWikiPage): void {
    const validated = AgentWikiPageSchema.parse(page);
    const filePath = this.getPagePath(validated.metadata.id);

    const frontmatter = YAML.stringify(validated.metadata);
    const fileContent = `---\n${frontmatter}---\n\n${validated.content.trim()}\n`;

    fs.writeFileSync(filePath, fileContent, 'utf-8');
  }

  /**
   * Loads an AgentWikiPage from disk. Returns null if not found.
   */
  public loadPage(id: string): AgentWikiPage | null {
    const filePath = this.getPagePath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    return this.parsePageContent(raw);
  }

  /**
   * Deletes an entity page. Returns true if deleted, false if file did not exist.
   */
  public deletePage(id: string): boolean {
    const filePath = this.getPagePath(id);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * Lists all entity pages currently stored on disk.
   */
  public listPages(): AgentWikiPage[] {
    if (!fs.existsSync(this.pagesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.pagesDir);
    const pages: AgentWikiPage[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const fullPath = path.join(this.pagesDir, file);
        const raw = fs.readFileSync(fullPath, 'utf-8');
        try {
          const parsed = this.parsePageContent(raw);
          pages.push(parsed);
        } catch {
          // Skip malformed files cleanly
        }
      }
    }

    return pages;
  }

  /**
   * Parses raw markdown string containing YAML frontmatter into an AgentWikiPage.
   */
  private parsePageContent(raw: string): AgentWikiPage {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = raw.match(frontmatterRegex);

    if (!match) {
      throw new Error('Invalid AgentWiki page format: Missing YAML frontmatter');
    }

    const yamlBlock = match[1];
    const markdownContent = match[2] ?? '';

    const parsedYaml = YAML.parse(yamlBlock);
    return AgentWikiPageSchema.parse({
      metadata: parsedYaml,
      content: markdownContent.trim(),
    });
  }

  /**
   * Returns the absolute path for a proposal file.
   */
  public getProposalPath(id: string): string {
    const validId = this.validateId(id);
    const resolved = path.resolve(this.proposalsDir, `${validId}.json`);
    if (!resolved.startsWith(this.proposalsDir)) {
      throw new Error(`Path traversal attempt detected for proposal ID: ${id}`);
    }
    return resolved;
  }

  /**
   * Saves an agent proposal to .agentwiki/proposals/{id}.json.
   */
  public saveProposal(proposal: AgentWikiProposal): void {
    const validated = AgentWikiProposalSchema.parse(proposal);
    const filePath = this.getProposalPath(validated.id);
    fs.writeFileSync(filePath, JSON.stringify(validated, null, 2), 'utf-8');
  }

  /**
   * Loads a proposal by ID.
   */
  public loadProposal(id: string): AgentWikiProposal | null {
    const filePath = this.getProposalPath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return AgentWikiProposalSchema.parse(JSON.parse(raw));
  }

  /**
   * Lists all staged proposals.
   */
  public listProposals(): AgentWikiProposal[] {
    if (!fs.existsSync(this.proposalsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.proposalsDir);
    const proposals: AgentWikiProposal[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const fullPath = path.join(this.proposalsDir, file);
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          proposals.push(AgentWikiProposalSchema.parse(JSON.parse(raw)));
        } catch {
          // Skip corrupt files
        }
      }
    }

    return proposals;
  }

  /**
   * Updates the status of an existing proposal.
   */
  public updateProposalStatus(id: string, status: ProposalStatus): boolean {
    const proposal = this.loadProposal(id);
    if (!proposal) {
      return false;
    }
    proposal.status = status;
    this.saveProposal(proposal);
    return true;
  }

  /**
   * Approves a proposal, merges its patch/claim into the target AgentWikiPage,
   * updates the page timestamp, and saves both the page and proposal to disk.
   */
  public approveAndApplyProposal(id: string): {
    success: boolean;
    page?: AgentWikiPage;
    proposal?: AgentWikiProposal;
    error?: string;
  } {
    const proposal = this.loadProposal(id);
    if (!proposal) {
      return { success: false, error: `Proposal "${id}" not found.` };
    }

    const page = this.loadPage(proposal.entity_id);
    if (!page) {
      return {
        success: false,
        error: `Target entity "${proposal.entity_id}" does not exist in knowledge base.`,
      };
    }

    const headerRegex = /^##\s+Verified Invariants & Fixes\s*$/m;
    let entryText = `\n### Discovery: ${proposal.claim} (Reported by ${proposal.author_agent})\n`;
    entryText += `**Evidence:**\n\`\`\`\n${proposal.evidence}\n\`\`\`\n`;
    if (proposal.patch && proposal.patch.trim().length > 0) {
      entryText += `\n**Proposed Invariant / Patch:**\n\n${proposal.patch.trim()}\n`;
    }

    if (headerRegex.test(page.content)) {
      page.content = page.content.replace(headerRegex, (match) => `${match}${entryText}`);
    } else {
      page.content = `${page.content.trim()}\n\n## Verified Invariants & Fixes\n${entryText}`;
    }

    page.metadata.updated_at = new Date().toISOString();

    // Persist updated page
    this.savePage(page);

    // Update proposal status
    proposal.status = 'approved';
    this.saveProposal(proposal);

    return {
      success: true,
      page,
      proposal,
    };
  }
}
