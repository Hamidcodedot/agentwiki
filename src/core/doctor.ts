import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DoctorIssue {
  type: 'broken_path' | 'missing_script' | 'missing_dependency';
  severity: 'error' | 'warning';
  ruleFile: string;
  reference: string;
  message: string;
}

export interface DoctorResult {
  ruleFilesScanned: string[];
  issues: DoctorIssue[];
  passed: boolean;
}

/**
 * Finds all agent rule files in the given workspace root.
 */
function findRuleFiles(workspaceDir: string): string[] {
  const ruleFiles: string[] = [];

  const candidates = [
    'CLAUDE.md',
    'AGENTS.md',
    '.github/copilot-instructions.md',
  ];

  for (const rel of candidates) {
    const full = path.join(workspaceDir, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      ruleFiles.push(full);
    }
  }

  // Check .cursor/rules/
  const cursorRulesDir = path.join(workspaceDir, '.cursor', 'rules');
  if (fs.existsSync(cursorRulesDir) && fs.statSync(cursorRulesDir).isDirectory()) {
    try {
      const files = fs.readdirSync(cursorRulesDir);
      for (const f of files) {
        if (f.endsWith('.md') || f.endsWith('.mdc')) {
          ruleFiles.push(path.join(cursorRulesDir, f));
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
  }

  // Check .claude/rules/
  const claudeRulesDir = path.join(workspaceDir, '.claude', 'rules');
  if (fs.existsSync(claudeRulesDir) && fs.statSync(claudeRulesDir).isDirectory()) {
    try {
      const files = fs.readdirSync(claudeRulesDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          ruleFiles.push(path.join(claudeRulesDir, f));
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
  }

  // Check .agentwiki/pages/
  const agentWikiPagesDir = path.join(workspaceDir, '.agentwiki', 'pages');
  if (fs.existsSync(agentWikiPagesDir) && fs.statSync(agentWikiPagesDir).isDirectory()) {
    try {
      const files = fs.readdirSync(agentWikiPagesDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          ruleFiles.push(path.join(agentWikiPagesDir, f));
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
  }

  return ruleFiles;
}

/**
 * Normalizes backtick content to check whether it looks like a relative file path.
 */
function looksLikeFilePath(token: string): boolean {
  if (!token || token.length < 3 || token.length > 200) return false;
  if (token.includes(' ') || token.includes('\n') || token.includes('\t')) return false;
  if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('mailto:')) return false;
  if (token.includes('${') || token.includes('<') || token.includes('>') || token.includes('|')) return false;
  if (token.startsWith('-') || token.endsWith(':') || token.includes('`')) return false;

  // Must have a file extension or relative path delimiter
  const hasExt = /\.[a-zA-Z0-9]{1,10}$/.test(token);
  const hasSlash = token.includes('/') || token.includes('\\');

  // Skip pure node package names without file extension (e.g., @types/node or express)
  if (!hasExt && !token.startsWith('./') && !token.startsWith('../')) {
    return false;
  }

  // Common extensions to check
  const knownExts = [
    '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.mdc', '.yaml', '.yml',
    '.py', '.go', '.rs', '.toml', '.lock', '.sh', '.bash', '.css', '.html',
    '.sql', '.env', '.example',
  ];

  if (hasExt && !knownExts.some((ext) => token.toLowerCase().endsWith(ext)) && !hasSlash) {
    return false;
  }

  return true;
}

/**
 * Scans all agent rule files in a workspace to identify stale references:
 * - Broken file paths
 * - Missing package.json scripts
 */
export function scanWorkspaceRules(workspaceDir: string = process.cwd()): DoctorResult {
  const resolvedDir = path.resolve(workspaceDir);
  const ruleFiles = findRuleFiles(resolvedDir);
  const issues: DoctorIssue[] = [];

  // Read package.json scripts if available
  const pkgJsonPath = path.join(resolvedDir, 'package.json');
  let definedScripts: Set<string> | null = null;
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.scripts && typeof parsed.scripts === 'object') {
        definedScripts = new Set(Object.keys(parsed.scripts));
      }
    } catch {
      // Malformed package.json
    }
  }

  // Standard ignored file path placeholders often found in documentation
  const ignoredPlaceholders = new Set([
    'path/to/file',
    'path/to/file.ts',
    'path/to/file.js',
    'path/to/dir',
    'your/file/here',
    'file.ts',
    'file.js',
    'index.js',
    'package.json', // Only ignore if it is checked separately
  ]);

  for (const ruleFile of ruleFiles) {
    const relRuleFile = path.relative(resolvedDir, ruleFile).replace(/\\/g, '/');
    let content: string;
    try {
      content = fs.readFileSync(ruleFile, 'utf-8');
    } catch {
      continue;
    }

    // 1. Extract file paths enclosed in backticks: `path/to/file.ext`
    const backtickMatches = content.match(/`([^`\n]+)`/g) || [];
    for (const match of backtickMatches) {
      const token = match.slice(1, -1).trim();
      if (!looksLikeFilePath(token) || ignoredPlaceholders.has(token)) {
        continue;
      }

      // Clean leading ./ or trailing punctuation
      const cleanPath = token.replace(/^\.\//, '').replace(/[),;]+$/, '');
      const fullTarget = path.resolve(resolvedDir, cleanPath);

      // Also allow paths relative to the rule file itself
      const relToRule = path.resolve(path.dirname(ruleFile), cleanPath);

      if (!fs.existsSync(fullTarget) && !fs.existsSync(relToRule)) {
        issues.push({
          type: 'broken_path',
          severity: 'error',
          ruleFile: relRuleFile,
          reference: token,
          message: `Referenced file or path does not exist on disk: "${token}"`,
        });
      }
    }

    // 2. Extract markdown link targets [text](path/to/file.ext)
    const linkMatches = content.match(/\[[^\]]+\]\(([^)]+)\)/g) || [];
    for (const match of linkMatches) {
      const linkMatch = match.match(/\[[^\]]+\]\(([^)]+)\)/);
      if (!linkMatch) continue;
      const target = linkMatch[1].trim().split('#')[0]; // Strip hash anchor
      if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) {
        continue;
      }
      if (!looksLikeFilePath(target) || ignoredPlaceholders.has(target)) {
        continue;
      }

      const cleanPath = target.replace(/^\.\//, '');
      const fullTarget = path.resolve(resolvedDir, cleanPath);
      const relToRule = path.resolve(path.dirname(ruleFile), cleanPath);

      if (!fs.existsSync(fullTarget) && !fs.existsSync(relToRule)) {
        issues.push({
          type: 'broken_path',
          severity: 'error',
          ruleFile: relRuleFile,
          reference: target,
          message: `Markdown link target does not exist on disk: "${target}"`,
        });
      }
    }

    // 3. Extract npm / pnpm / yarn script commands
    if (definedScripts !== null) {
      const scriptRegex = /(?:npm run|pnpm run|yarn run|pnpm)\s+([a-zA-Z0-9_\-:]+)/g;
      let sMatch: RegExpExecArray | null;
      while ((sMatch = scriptRegex.exec(content)) !== null) {
        const scriptName = sMatch[1];
        // Ignore built-in commands like npm run test (often alias for npm test)
        if (!definedScripts.has(scriptName) && !['test', 'start', 'build'].includes(scriptName)) {
          issues.push({
            type: 'missing_script',
            severity: 'warning',
            ruleFile: relRuleFile,
            reference: sMatch[0],
            message: `Command "${sMatch[0]}" references script "${scriptName}" which is not defined in package.json`,
          });
        }
      }
    }
  }

  // Deduplicate issues by ruleFile + reference + type
  const seen = new Set<string>();
  const uniqueIssues = issues.filter((issue) => {
    const key = `${issue.ruleFile}::${issue.type}::${issue.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ruleFilesScanned: ruleFiles.map((f) => path.relative(resolvedDir, f).replace(/\\/g, '/')),
    issues: uniqueIssues,
    passed: uniqueIssues.length === 0,
  };
}
