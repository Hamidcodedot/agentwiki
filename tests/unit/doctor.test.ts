import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanWorkspaceRules } from '../../src/core/doctor.js';

describe('Agent Rules Doctor (Staleness Scanner)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentwiki-doctor-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles workspaces with no agent rule files gracefully', () => {
    const result = scanWorkspaceRules(tmpDir);
    expect(result.ruleFilesScanned.length).toBe(0);
    expect(result.issues.length).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('detects broken file paths referenced in CLAUDE.md and .cursor/rules', () => {
    // Create CLAUDE.md with a real path and a broken path
    fs.writeFileSync(path.join(tmpDir, 'real_file.ts'), 'export const ready = true;');
    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      '# Agent Rules\nAlways consult `real_file.ts` before editing `src/missing_auth.ts`.\nAlso read [docs](docs/old_guide.md).\n'
    );

    // Create a .cursor/rules/ file
    const cursorDir = path.join(tmpDir, '.cursor', 'rules');
    fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(
      path.join(cursorDir, 'deploy.mdc'),
      'Before releasing, run checks on `config/prod.json`.\n'
    );

    const result = scanWorkspaceRules(tmpDir);

    expect(result.ruleFilesScanned.length).toBe(2);
    expect(result.passed).toBe(false);

    const brokenPaths = result.issues.filter((i) => i.type === 'broken_path').map((i) => i.reference);
    expect(brokenPaths).toContain('src/missing_auth.ts');
    expect(brokenPaths).toContain('docs/old_guide.md');
    expect(brokenPaths).toContain('config/prod.json');
    expect(brokenPaths).not.toContain('real_file.ts');
  });

  it('detects stale npm script commands not defined in package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        scripts: {
          test: 'vitest run',
          build: 'tsc',
        },
      })
    );

    fs.writeFileSync(
      path.join(tmpDir, 'AGENTS.md'),
      '# Rules\nRun `npm run build` after changes.\nDo not forget to execute `npm run lint:fix` before commit.\n'
    );

    const result = scanWorkspaceRules(tmpDir);

    expect(result.passed).toBe(false);
    const missingScripts = result.issues.filter((i) => i.type === 'missing_script');
    expect(missingScripts.length).toBe(1);
    expect(missingScripts[0].message).toContain('lint:fix');
  });

  it('passes completely when all referenced files and scripts exist', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        scripts: {
          verify: 'npm run test',
          test: 'vitest',
        },
      })
    );

    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export default {};');

    fs.writeFileSync(
      path.join(tmpDir, 'CLAUDE.md'),
      '# Instructions\nEntrypoint is located at `src/index.ts`.\nRun `npm run verify` to validate.\n'
    );

    const result = scanWorkspaceRules(tmpDir);
    expect(result.ruleFilesScanned.length).toBe(1);
    expect(result.issues.length).toBe(0);
    expect(result.passed).toBe(true);
  });
});
