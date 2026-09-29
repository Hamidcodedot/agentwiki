import * as fs from 'node:fs';
import * as path from 'node:path';

export interface IdeSetupResult {
  cursorConfigured: boolean;
  cursorPath?: string;
  claudeConfigured: boolean;
  claudePath?: string;
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

  const agentWikiServerConfig = {
    command: 'npx',
    args: ['-y', '@hamidshahid/agentwiki', 'serve'],
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
      try {
        cursorConfig = JSON.parse(raw);
      } catch {
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
      try {
        rootConfig = JSON.parse(raw);
      } catch {
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
