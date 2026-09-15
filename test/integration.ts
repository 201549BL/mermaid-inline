import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import type { activate } from '../src/extension';
type Api = ReturnType<typeof activate>;

async function eventually(check: () => boolean, description: string, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${description}`);
}

export async function run() {
  try { await testExtension(); }
  catch (error) {
    console.error('INTEGRATION FAILURE', error instanceof Error ? error.stack : error);
    await new Promise(resolve => setTimeout(resolve, 500));
    throw error;
  }
}

async function testExtension() {
  const extension = vscode.extensions.getExtension<Api>('201549bl.mermaid-inline');
  assert.ok(extension, 'extension discovered');
  const api = await extension.activate();
  const text = '# Native editor test\n\n```mermaid\nflowchart LR\n A[Write] --> B[Render]\n```\n\nSome editable Markdown.\n\n```mermaid\nsequenceDiagram\n A->>B: Hello\n```\n';
  const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: text });
  const editor = await vscode.window.showTextDocument(document);
  const states = () => api.inspect().filter(state => state.uri === document.uri.toString());
  await vscode.commands.executeCommand('vscode.executeFoldingRangeProvider', document.uri);
  editor.selection = new vscode.Selection(2, 0, 2, 0);
  await vscode.commands.executeCommand('mermaidInline.toggle');
  await eventually(() => states()[0]?.rendered === true, 'flowchart SVG rendered in actual inset webview');
  assert.equal(states()[0].error, undefined);
  assert.equal(states()[1].preview, false);
  assert.equal(document.getText(), text, 'preview never edits source');
  await eventually(() => !editor.visibleRanges.some(range => range.start.line <= 4 && range.end.line >= 4), 'Mermaid body folded');
  console.log('PASS native Markdown flowchart, real webview round trip, folded source');

  await vscode.commands.executeCommand('mermaidInline.toggle');
  assert.equal(states()[0].mounted, false);
  await eventually(() => editor.visibleRanges.some(range => range.start.line <= 4 && range.end.line >= 4), 'source unfolded');
  assert.equal(document.getText(), text);
  console.log('PASS code toggle restores source without modifying text');

  await vscode.commands.executeCommand('mermaidInline.previewAll');
  // Inset webviews below the visible editor can defer loading until scrolled into view.
  for (const state of states()) {
    editor.revealRange(new vscode.Range(state.startLine, 0, state.startLine, 0), vscode.TextEditorRevealType.AtTop);
    try {
      await eventually(() => !!states().find(item => item.startLine === state.startLine)?.rendered, `visible diagram at line ${state.startLine} rendered`);
    } catch (error) { console.error('INSET STATES', JSON.stringify(states())); throw error; }
  }
  await eventually(() => states().length === 2 && states().every(state => state.rendered && !state.error), 'both diagrams rendered');
  console.log('PASS independent flowchart and sequence diagram previews');

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, new vscode.Position(0, 0), 'An inserted line.\n');
  assert.ok(await vscode.workspace.applyEdit(edit));
  await eventually(() => states()[0]?.startLine === 3, 'block positions refreshed');
  for (const state of states()) {
    editor.revealRange(new vscode.Range(state.startLine, 0, state.startLine, 0), vscode.TextEditorRevealType.AtTop);
    await eventually(() => !!states().find(item => item.startLine === state.startLine)?.rendered, 'moved visible diagram rendered');
  }
  await eventually(() => states()[0]?.startLine === 3 && states().every(state => state.rendered && !state.error), 'insets follow insertion above diagrams');
  console.log('PASS preview positions follow document edits');

  await vscode.commands.executeCommand('mermaidInline.showAllCode');
  assert.ok(states().every(state => !state.mounted && !state.preview));
  console.log('PASS show all source disposes insets');

  const badDocument = await vscode.workspace.openTextDocument({ language: 'mermaid', content: 'this is not valid mermaid\n???\n' });
  const badEditor = await vscode.window.showTextDocument(badDocument);
  const badState = () => api.inspect().find(state => state.uri === badDocument.uri.toString());
  await vscode.commands.executeCommand('mermaidInline.toggle');
  await eventually(() => !!badState()?.rendered && !!badState()?.error, 'invalid Mermaid displays error');
  console.log('PASS syntax errors return a readable error from the renderer');
  const fix = new vscode.WorkspaceEdit();
  fix.replace(badDocument.uri, new vscode.Range(0, 0, badDocument.lineCount - 1, 0), 'flowchart TD\n A-->B\n');
  assert.ok(await vscode.workspace.applyEdit(fix));
  await eventually(() => !!badState()?.rendered && !badState()?.error, 'preview recovers after source correction');
  assert.equal(badDocument.getText(), 'flowchart TD\n A-->B\n');
  await vscode.commands.executeCommand('mermaidInline.showAllCode');
  badEditor.selection = new vscode.Selection(0, 0, 0, 0);
  console.log('PASS standalone Mermaid and recovery from invalid source');

  console.log('ALL INTEGRATION CHECKS PASSED');
}
