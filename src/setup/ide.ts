import * as fs from 'node:fs';
import * as path from 'node:path';

export interface IdeSetupResult {
  cursorConfigured: boolean;
  cursorPath?: string;
  claudeConfigured: boolean;
  claudePath?: string;
}

function safeParseJsonWithComments(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      // Strip comments and trailing commas common in VSCode JSON configs
      const cleaned = raw
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

/**
 * Automatically detects Cursor and Claude Code configuration directories
 * and non-destructively injects the AgentWiki MCP server definition.
 */
export function setupIde(projectDir: string = process.cwd()): IdeSetupResult {
  const result: IdeSetupResult = {
    cursorConfigured: false,
    claudeConfigured: false,
  };

  const localPkgCli = path.join(projectDir, 'node_modules', '@hamidshahid', 'agentwiki', 'dist', 'bin', 'cli.js');
  const hasLocalInstall = fs.existsSync(localPkgCli);

  const agentWikiServerConfig: Record<string, unknown> = hasLocalInstall
    ? {
        command: 'node',
        args: ['./node_modules/@hamidshahid/agentwiki/dist/bin/cli.js', 'serve'],
        cwd: '${workspaceFolder}',
      }
    : {
        command: 'npx',
        args: ['-y', '@hamidshahid/agentwiki@^0.2.0', 'serve'],
        cwd: '${workspaceFolder}',
      };

  // 1. Configure Cursor IDE (.cursor/mcp.json)
  const cursorDir = path.join(projectDir, '.cursor');
  const cursorMcpPath = path.join(cursorDir, 'mcp.json');

  try {
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    let cursorConfig: { mcpServers?: Record<string, unknown> } = {};
    if (fs.existsSync(cursorMcpPath)) {
      const raw = fs.readFileSync(cursorMcpPath, 'utf-8');
      const parsed = safeParseJsonWithComments(raw);
      if (parsed !== null) {
        cursorConfig = parsed;
      } else {
        // Severe syntax error: Create backup and never erase silently
        const backupPath = `${cursorMcpPath}.bak`;
        fs.writeFileSync(backupPath, raw, 'utf-8');
        cursorConfig = {};
      }
    }

    if (!cursorConfig.mcpServers) {
      cursorConfig.mcpServers = {};
    }

    cursorConfig.mcpServers['agentwiki'] = agentWikiServerConfig;
    fs.writeFileSync(cursorMcpPath, JSON.stringify(cursorConfig, null, 2), 'utf-8');
    result.cursorConfigured = true;
    result.cursorPath = cursorMcpPath;
  } catch {
    // Non-fatal error
  }

  // 2. Configure Claude Code / Universal MCP (.mcp.json in root)
  const rootMcpPath = path.join(projectDir, '.mcp.json');
  try {
    let rootConfig: { mcpServers?: Record<string, unknown> } = {};
    if (fs.existsSync(rootMcpPath)) {
      const raw = fs.readFileSync(rootMcpPath, 'utf-8');
      const parsed = safeParseJsonWithComments(raw);
      if (parsed !== null) {
        rootConfig = parsed;
      } else {
        const backupPath = `${rootMcpPath}.bak`;
        fs.writeFileSync(backupPath, raw, 'utf-8');
        rootConfig = {};
      }
    }

    if (!rootConfig.mcpServers) {
      rootConfig.mcpServers = {};
    }

    rootConfig.mcpServers['agentwiki'] = agentWikiServerConfig;
    fs.writeFileSync(rootMcpPath, JSON.stringify(rootConfig, null, 2), 'utf-8');
    result.claudeConfigured = true;
    result.claudePath = rootMcpPath;
  } catch {
    // Non-fatal error
  }

  return result;
}

/**
 * Ensures the target project's .gitignore file excludes the binary SQLite index.
 */
export function ensureGitignore(projectDir: string = process.cwd()): boolean {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const ignoreEntry = '.agentwiki/*.db*';

  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (!content.includes(ignoreEntry)) {
        const addition = content.endsWith('\n')
          ? `\n# AgentWiki SQLite Index\n${ignoreEntry}\n`
          : `\n\n# AgentWiki SQLite Index\n${ignoreEntry}\n`;
        fs.appendFileSync(gitignorePath, addition, 'utf-8');
        return true;
      }
      return false;
    } else {
      fs.writeFileSync(gitignorePath, `# AgentWiki SQLite Index\n${ignoreEntry}\n`, 'utf-8');
      return true;
    }
  } catch {
    return false;
  }
}
