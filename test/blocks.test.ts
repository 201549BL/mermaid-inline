import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBlocks, moveAnchor } from '../src/blocks.ts';

test('extracts multiple Mermaid blocks with accurate source ranges', () => {
  const text = '# Test\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n~~~Mermaid title\nsequenceDiagram\n A->>B: Hi\n~~~\n';
  const blocks = findBlocks(text);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].startLine, 2);
  assert.equal(blocks[0].endLine, 5);
  assert.equal(blocks[0].source, 'flowchart LR\n A-->B');
  assert.equal(text.slice(blocks[1].start, blocks[1].end), '~~~Mermaid title\nsequenceDiagram\n A->>B: Hi\n~~~');
});
test('ignores Mermaid examples inside other fences and indented code', () => {
  assert.equal(findBlocks('````markdown\n```mermaid\nA-->B\n```\n````').length, 0);
  assert.equal(findBlocks('    ```mermaid\n    A-->B\n    ```').length, 0);
});
test('closing fences must match delimiter and minimum length', () => {
  const [block] = findBlocks('````mermaid\nflowchart LR\n```\n~~~\n`````\n');
  assert.equal(block.endLine, 4);
  assert.equal(block.source, 'flowchart LR\n```\n~~~');
});
test('handles CRLF and strips at most opening indentation', () => {
  const text = 'Hi\r\n  ```mermaid\r\n  flowchart LR\r\n    A-->B\r\n  ```\r\n';
  const [block] = findBlocks(text);
  assert.equal(block.start, 4);
  assert.equal(block.source, 'flowchart LR\n  A-->B');
  assert.equal(text.slice(block.start, block.end), '  ```mermaid\r\n  flowchart LR\r\n    A-->B\r\n  ```');
});
test('unclosed fences end at EOF, including empty content', () => {
  assert.equal(findBlocks('```mermaid\nflowchart LR')[0].source, 'flowchart LR');
  assert.equal(findBlocks('```mermaid')[0].source, '');
});
test('standalone diagrams retain every source character', () => {
  const source = 'flowchart LR\r\n A-->B\r\n';
  assert.equal(findBlocks(source, true)[0].source, source);
  assert.deepEqual(findBlocks(' \n', true), []);
});
test('block anchors follow edits above them and inside their source', () => {
  assert.equal(moveAnchor(10, [{ start: 0, length: 0, text: 'Hello\n' }]), 16);
  assert.equal(moveAnchor(10, [{ start: 10, length: 0, text: '\n' }]), 11);
  assert.equal(moveAnchor(10, [{ start: 12, length: 5, text: 'x' }]), 10);
  assert.equal(moveAnchor(10, [{ start: 7, length: 5, text: 'new' }]), 7);
  assert.equal(moveAnchor(10, [{ start: 6, length: 2, text: '' }, { start: 0, length: 0, text: 'abc' }]), 11);
});
