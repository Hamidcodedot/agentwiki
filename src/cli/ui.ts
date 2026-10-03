/**
 * Terminal UI & Formatting Engine for AgentWiki CLI
 * Design System: Obsidian Precision Engine
 * 
 * Invariants:
 *  - Absolute Zero Emoji Policy
 *  - 1px hairline box-drawing precision (┌─┐│└─┘)
 *  - Monochromatic neutral dark base (Zinc/Slate) + purposeful Electric Cyan & Emerald accents
 *  - Accurate ANSI-aware string width calculations
 */

const IS_TTY = process.stdout.isTTY ?? true;

// ANSI escape code stripper for accurate box border width calculation
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function padEndVisible(str: string, targetLength: number, padChar = ' '): string {
  const currentLen = visibleLength(str);
  if (currentLen >= targetLength) return str;
  return str + padChar.repeat(targetLength - currentLen);
}

export function padStartVisible(str: string, targetLength: number, padChar = ' '): string {
  const currentLen = visibleLength(str);
  if (currentLen >= targetLength) return str;
  return padChar.repeat(targetLength - currentLen) + str;
}

export const colors = {
  reset: (text: string) => (IS_TTY ? `\x1b[0m${text}\x1b[0m` : text),
  bold: (text: string) => (IS_TTY ? `\x1b[1m${text}\x1b[0m` : text),
  dim: (text: string) => (IS_TTY ? `\x1b[2m${text}\x1b[0m` : text),
  italic: (text: string) => (IS_TTY ? `\x1b[3m${text}\x1b[0m` : text),
  underline: (text: string) => (IS_TTY ? `\x1b[4m${text}\x1b[0m` : text),
  // High-precision colors
  cyan: (text: string) => (IS_TTY ? `\x1b[36m${text}\x1b[0m` : text),
  brightCyan: (text: string) => (IS_TTY ? `\x1b[96m${text}\x1b[0m` : text),
  emerald: (text: string) => (IS_TTY ? `\x1b[32m${text}\x1b[0m` : text),
  brightGreen: (text: string) => (IS_TTY ? `\x1b[92m${text}\x1b[0m` : text),
  amber: (text: string) => (IS_TTY ? `\x1b[33m${text}\x1b[0m` : text),
  brightYellow: (text: string) => (IS_TTY ? `\x1b[93m${text}\x1b[0m` : text),
  rose: (text: string) => (IS_TTY ? `\x1b[31m${text}\x1b[0m` : text),
  brightRed: (text: string) => (IS_TTY ? `\x1b[91m${text}\x1b[0m` : text),
  magenta: (text: string) => (IS_TTY ? `\x1b[35m${text}\x1b[0m` : text),
  white: (text: string) => (IS_TTY ? `\x1b[97m${text}\x1b[0m` : text),
  zinc: (text: string) => (IS_TTY ? `\x1b[90m${text}\x1b[0m` : text),
};

export const badges = {
  ok: () => (IS_TTY ? `\x1b[1;32m[ok]\x1b[0m` : '[ok]'),
  mcp: () => (IS_TTY ? `\x1b[1;36m[mcp]\x1b[0m` : '[mcp]'),
  sync: () => (IS_TTY ? `\x1b[1;96m[sync]\x1b[0m` : '[sync]'),
  tcr: () => (IS_TTY ? `\x1b[1;36m[tcr]\x1b[0m` : '[tcr]'),
  info: () => (IS_TTY ? `\x1b[1;36m[info]\x1b[0m` : '[info]'),
  warn: () => (IS_TTY ? `\x1b[1;33m[warn]\x1b[0m` : '[warn]'),
  error: () => (IS_TTY ? `\x1b[1;31m[err]\x1b[0m` : '[err]'),
  step: (n: number) => (IS_TTY ? `\x1b[1;90m[0${n}]\x1b[0m` : `[0${n}]`),
  statusApproved: () => (IS_TTY ? `\x1b[1;32mAPPROVED\x1b[0m` : 'APPROVED'),
  statusPending: () => (IS_TTY ? `\x1b[1;33mPENDING\x1b[0m` : 'PENDING'),
  statusRejected: () => (IS_TTY ? `\x1b[1;31mREJECTED\x1b[0m` : 'REJECTED'),
};

/**
 * Render the eye-catching Brand Header Banner
 */
export function renderBanner(version = '0.3.0'): void {
  const width = 64;
  const line = '─'.repeat(width);

  console.log(colors.zinc(`┌${line}┐`));
  
  // Line 1: Title and version
  const titlePart = `  ${colors.bold(colors.white('AGENTWIKI'))} ${colors.zinc(`v${version}`)}`;
  const tagPart = colors.cyan('Local MCP Knowledge Engine') + '  ';
  const l1Raw = `  AGENTWIKI v${version}` + `Local MCP Knowledge Engine  `;
  const pad1 = ' '.repeat(Math.max(0, width - visibleLength(l1Raw)));
  console.log(colors.zinc('│') + titlePart + pad1 + tagPart + colors.zinc('│'));

  // Line 2: Architectural Subtitle
  const subText = `  ${colors.zinc('Node 24 SQLite FTS5 · Sub-15ms BM25 · Token-Dense Ground Truth')}`;
  console.log(colors.zinc('│') + padEndVisible(subText, width) + colors.zinc('│'));

  console.log(colors.zinc(`└${line}┘`));
}

/**
 * Render a high-density data card with aligned columns
 */
export function renderCard(
  title: string,
  entries: Array<[string, string | number]>,
  options?: { width?: number; accentColor?: (s: string) => string }
): void {
  const width = options?.width ?? 64;
  const accent = options?.accentColor ?? colors.cyan;
  const line = '─'.repeat(width);

  console.log(colors.zinc(`┌${line}┐`));
  
  // Header
  const titleFormatted = `  ${colors.bold(accent(title))}`;
  console.log(colors.zinc('│') + padEndVisible(titleFormatted, width) + colors.zinc('│'));
  console.log(colors.zinc(`├${line}┤`));

  // Key-Value rows
  for (const [key, val] of entries) {
    const keyFormatted = `  ${colors.zinc(key.padEnd(24))}`;
    const valFormatted = colors.white(String(val));
    const combined = `${keyFormatted} ${valFormatted}`;
    console.log(colors.zinc('│') + padEndVisible(combined, width) + colors.zinc('│'));
  }

  console.log(colors.zinc(`└${line}┘`));
}

/**
 * Render a colorized Git-style diff
 */
export function renderDiff(patch: string, maxWidth = 60): void {
  const lines = patch.split('\n');
  for (const line of lines) {
    const truncated = line.length > maxWidth ? line.substring(0, maxWidth - 3) + '...' : line;
    if (truncated.startsWith('+')) {
      console.log(`    ${colors.emerald(truncated)}`);
    } else if (truncated.startsWith('-')) {
      console.log(`    ${colors.rose(truncated)}`);
    } else if (truncated.startsWith('@@')) {
      console.log(`    ${colors.cyan(truncated)}`);
    } else {
      console.log(`    ${colors.zinc(truncated)}`);
    }
  }
}

/**
 * Render an eye-catching Proposal Triage Card
 */
export function renderProposal(
  proposal: {
    id: string;
    entity_id: string;
    author_agent: string;
    status: string;
    claim: string;
    evidence: string;
    patch?: string;
  },
  index?: number,
  total?: number
): void {
  const width = 64;
  const line = '─'.repeat(width);

  const idxStr = index !== undefined && total !== undefined ? ` [${index + 1}/${total}]` : '';
  const headerText = `  ${colors.bold(colors.amber(`Proposal ${proposal.id}${idxStr}`))}`;

  console.log(colors.zinc(`┌${line}┐`));
  console.log(colors.zinc('│') + padEndVisible(headerText, width) + colors.zinc('│'));
  console.log(colors.zinc(`├${line}┤`));

  // Status and Target
  const targetRow = `  ${colors.zinc('Target Entity: ')} ${colors.white(proposal.entity_id)}`;
  console.log(colors.zinc('│') + padEndVisible(targetRow, width) + colors.zinc('│'));

  const authorRow = `  ${colors.zinc('Author Agent:  ')} ${colors.cyan(proposal.author_agent)}`;
  console.log(colors.zinc('│') + padEndVisible(authorRow, width) + colors.zinc('│'));

  const statusBadge =
    proposal.status === 'approved'
      ? badges.statusApproved()
      : proposal.status === 'rejected'
      ? badges.statusRejected()
      : badges.statusPending();
  const statusRow = `  ${colors.zinc('Status:        ')} ${statusBadge}`;
  console.log(colors.zinc('│') + padEndVisible(statusRow, width) + colors.zinc('│'));

  console.log(colors.zinc(`├${line}┤`));

  // Claim
  console.log(colors.zinc('│') + padEndVisible(`  ${colors.bold(colors.white('Claim:'))}`, width) + colors.zinc('│'));
  const words = proposal.claim.split(' ');
  let lineBuf = '';
  for (const w of words) {
    if ((lineBuf + ' ' + w).length > width - 6) {
      console.log(colors.zinc('│') + padEndVisible(`    ${colors.white(lineBuf)}`, width) + colors.zinc('│'));
      lineBuf = w;
    } else {
      lineBuf = lineBuf ? `${lineBuf} ${w}` : w;
    }
  }
  if (lineBuf) {
    console.log(colors.zinc('│') + padEndVisible(`    ${colors.white(lineBuf)}`, width) + colors.zinc('│'));
  }

  // Evidence trace preview
  console.log(colors.zinc('│') + padEndVisible(`  ${colors.zinc('Evidence Trace:')}`, width) + colors.zinc('│'));
  const evSummary = proposal.evidence.length > width - 8 ? proposal.evidence.substring(0, width - 8) + '...' : proposal.evidence;
  console.log(colors.zinc('│') + padEndVisible(`    ${colors.zinc(evSummary)}`, width) + colors.zinc('│'));

  // Patch
  if (proposal.patch) {
    console.log(colors.zinc(`├${line}┤`));
    console.log(colors.zinc('│') + padEndVisible(`  ${colors.bold(colors.cyan('Proposed Patch Diff:'))}`, width) + colors.zinc('│'));
    const patchLines = proposal.patch.split('\n');
    for (const pLine of patchLines.slice(0, 6)) {
      const truncated = pLine.length > width - 8 ? pLine.substring(0, width - 8) + '...' : pLine;
      let styledLine = colors.zinc(truncated);
      if (truncated.startsWith('+')) styledLine = colors.emerald(truncated);
      else if (truncated.startsWith('-')) styledLine = colors.rose(truncated);
      console.log(colors.zinc('│') + padEndVisible(`    ${styledLine}`, width) + colors.zinc('│'));
    }
    if (patchLines.length > 6) {
      console.log(colors.zinc('│') + padEndVisible(`    ${colors.zinc(`... (${patchLines.length - 6} more lines)`)}`, width) + colors.zinc('│'));
    }
  }

  console.log(colors.zinc(`└${line}┘`));
}

/**
 * Render Action Step Row
 */
export function renderActionStep(stepNum: number, label: string, command: string): void {
  console.log(`   ${badges.step(stepNum)}  ${colors.zinc(label.padEnd(26))} ${colors.cyan(command)}`);
}
