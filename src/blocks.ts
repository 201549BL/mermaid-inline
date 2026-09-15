export interface DiagramBlock {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  source: string;
  kind: 'fence' | 'file';
}

/** Top-level CommonMark fences, including tilde fences and unclosed fences at EOF. */
export function findBlocks(text: string, standalone = false): DiagramBlock[] {
  const lines = text.split(/\r?\n/);
  const offsets: number[] = [];
  let offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    offsets.push(offset);
    offset += line.length;
  }
  if (offsets.length < lines.length) offsets.push(text.length);
  if (standalone) return text.trim() ? [{ start: 0, end: text.length, startLine: 0, endLine: lines.length - 1, source: text, kind: 'file' }] : [];

  const blocks: DiagramBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const opener = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (!opener || (opener[2][0] === '`' && opener[3].includes('`'))) continue;
    const delimiter = opener[2][0];
    const length = opener[2].length;
    const startLine = i;
    let close = i + 1;
    const closing = new RegExp(`^ {0,3}${delimiter}{${length},}[\\t ]*$`);
    while (close < lines.length && !closing.test(lines[close])) close++;
    if (opener[3].trim().split(/\s+/)[0].toLowerCase() === 'mermaid') {
      const endLine = Math.min(close, lines.length - 1);
      const indent = opener[1].length;
      blocks.push({
        start: offsets[startLine], end: offsets[endLine] + lines[endLine].length,
        startLine, endLine, kind: 'fence',
        source: lines.slice(startLine + 1, close).map(line => line.replace(new RegExp(`^ {0,${indent}}`), '')).join('\n')
      });
    }
    // Skip other fenced languages too; apparent Mermaid fences inside them are literal text.
    i = close;
  }
  return blocks;
}

export interface OffsetChange { start: number; length: number; text: string }
/** Translate a block's anchor through a batch of edits expressed in old-document offsets. */
export function moveAnchor(anchor: number, changes: readonly OffsetChange[]): number {
  let shift = 0;
  for (const change of [...changes].sort((a, b) => a.start - b.start)) {
    if (change.start > anchor) break;
    if (change.start + change.length > anchor) return change.start + shift;
    shift += change.text.length - change.length;
  }
  return anchor + shift;
}
