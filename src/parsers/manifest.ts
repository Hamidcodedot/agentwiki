import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { AgentWikiPage } from '../core/types.js';

interface PackageJsonData {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  bin?: string | Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Inspects a directory to produce a concise 1-line description of its contents.
 */
function summarizeDirectory(dirPath: string): string {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);

    if (subdirs.length > 0) {
      return `Contains ${subdirs.slice(0, 4).join(', ')}${subdirs.length > 4 ? '...' : ''}`;
    }
    const sampleFiles = files.slice(0, 3).join(', ');
    return `Contains ${files.length} file(s) (${sampleFiles})`;
  } catch {
    return 'Directory structure';
  }
}

/**
 * Extracts directory topology map from the project root.
 */
function extractTopology(projectDir: string): Array<{ name: string; summary: string }> {
  const ignored = new Set([
    'node_modules',
    '.git',
    '.agentwiki',
    'dist',
    'build',
    '.cache',
    'coverage',
    '.turbo',
    '.next',
    'tmp',
  ]);

  const topology: Array<{ name: string; summary: string }> = [];

  try {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !ignored.has(entry.name) && !entry.name.startsWith('.')) {
        const fullPath = path.join(projectDir, entry.name);
        topology.push({
          name: `${entry.name}/`,
          summary: summarizeDirectory(fullPath),
        });
      }
    }
  } catch {
    // Non-fatal
  }

  return topology;
}

/**
 * Computes a hash of the project's primary manifests to detect changes.
 */
export function getManifestHash(projectDir: string): string {
  const manifestPaths = [
    path.join(projectDir, 'package.json'),
    path.join(projectDir, 'pyproject.toml'),
    path.join(projectDir, 'Cargo.toml'),
    path.join(projectDir, 'go.mod'),
  ];

  const hash = crypto.createHash('sha256');
  let foundAny = false;

  for (const mPath of manifestPaths) {
    if (fs.existsSync(mPath)) {
      foundAny = true;
      hash.update(path.basename(mPath));
      hash.update(fs.readFileSync(mPath));
    }
  }

  return foundAny ? hash.digest('hex') : '';
}

/**
 * Parses project manifests and directory topology into an atomic AgentWikiPage.
 * Token-budgeted at < 400 tokens for instant contextual grounding.
 */
export function parseProjectManifest(projectDir: string = process.cwd()): AgentWikiPage | null {
  const pkgJsonPath = path.join(projectDir, 'package.json');
  const pyprojectPath = path.join(projectDir, 'pyproject.toml');
  const cargoPath = path.join(projectDir, 'Cargo.toml');
  const goModPath = path.join(projectDir, 'go.mod');

  const topology = extractTopology(projectDir);
  const sections: string[] = [];
  let projectName = path.basename(projectDir);
  let projectDesc = 'Repository codebase and module topology.';
  let ecosystem = 'Polyglot / Generic';
  const tags: string[] = ['architecture', 'topology', 'manifest'];

  if (fs.existsSync(pkgJsonPath)) {
    try {
      const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
      const pkg = JSON.parse(raw) as PackageJsonData;
      if (pkg.name) projectName = pkg.name;
      if (pkg.description) projectDesc = pkg.description;
      ecosystem = 'Node.js / TypeScript';
      tags.push('nodejs', 'npm');

      sections.push('## Project Metadata & Entrypoints');
      sections.push(`- **Package:** \`${pkg.name ?? 'unnamed'}\` (v${pkg.version ?? '0.0.0'})`);
      sections.push(`- **Description:** ${pkg.description ?? 'No description'}`);
      if (pkg.main) sections.push(`- **Main Entry:** \`${pkg.main}\``);
      if (pkg.bin) {
        const binStr = typeof pkg.bin === 'string' ? pkg.bin : JSON.stringify(pkg.bin);
        sections.push(`- **Bin Executable:** \`${binStr}\``);
      }

      if (pkg.scripts && Object.keys(pkg.scripts).length > 0) {
        sections.push('## Key Scripts & Toolchain');
        const scriptLines = Object.entries(pkg.scripts)
          .slice(0, 6)
          .map(([cmd, script]) => `- \`npm run ${cmd}\`: \`${script}\``);
        sections.push(scriptLines.join('\n'));
      }

      const deps = Object.keys(pkg.dependencies ?? {});
      if (deps.length > 0) {
        sections.push('## Core Runtime Dependencies');
        sections.push(deps.map((d) => `- \`${d}\``).slice(0, 10).join('\n'));
      }
    } catch {
      // Malformed package.json
    }
  } else if (fs.existsSync(pyprojectPath)) {
    ecosystem = 'Python';
    tags.push('python');
    sections.push('## Project Metadata');
    sections.push(`- **Ecosystem:** Python (pyproject.toml managed)`);
  } else if (fs.existsSync(cargoPath)) {
    ecosystem = 'Rust';
    tags.push('rust');
    sections.push('## Project Metadata');
    sections.push(`- **Ecosystem:** Rust (Cargo managed)`);
  } else if (fs.existsSync(goModPath)) {
    ecosystem = 'Go';
    tags.push('go');
    sections.push('## Project Metadata');
    sections.push(`- **Ecosystem:** Go (go.mod managed)`);
  }

  if (topology.length > 0) {
    sections.push('## Directory Topology Map');
    const topoLines = topology.map((t) => `- \`${t.name}\`: ${t.summary}`);
    sections.push(topoLines.join('\n'));
  }

  if (sections.length === 0) {
    return null;
  }

  const content = sections.join('\n\n');

  return {
    metadata: {
      id: 'architecture_overview',
      name: `${projectName} Architecture & Topology`,
      category: 'concept',
      tags,
      relations: {
        requires: [],
        supersedes: [],
        related: [],
      },
      summary: `${projectName} (${ecosystem}) codebase structure, entrypoints, toolchain scripts, and directory topology.`,
      updated_at: new Date().toISOString(),
    },
    content,
  };
}
