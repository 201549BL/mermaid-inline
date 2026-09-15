import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { findBlocks, moveAnchor, type DiagramBlock } from './blocks';

type BlockState = {
  block: DiagramBlock;
  preview: boolean;
  inset?: vscode.WebviewEditorInset;
  ready?: boolean;
  revision: number;
  rendered?: number;
  error?: string;
};
type View = { editor: vscode.TextEditor; blocks: BlockState[]; timer?: ReturnType<typeof setTimeout> };
type LensTarget = { uri: string; version: number; start: number };
const supported = (doc: vscode.TextDocument) => doc.languageId === 'markdown' || standalone(doc);
const standalone = (doc: vscode.TextDocument) => doc.languageId === 'mermaid' || /\.(mmd|mermaid)$/i.test(doc.uri.path);

export function activate(context: vscode.ExtensionContext) {
  const views = new Map<vscode.TextEditor, View>();
  const changed = new vscode.EventEmitter<void>();
  const output = vscode.window.createOutputChannel('Mermaid Inline');
  let queue = Promise.resolve();
  let disposed = false;
  const run = (action: () => Promise<void>) => {
    queue = queue.then(action).catch(error => {
      output.appendLine(String(error?.stack ?? error));
      void vscode.window.showErrorMessage(`Mermaid Inline: ${error instanceof Error ? error.message : String(error)}`);
    });
    return queue;
  };

  function disposeInset(state: BlockState) {
    const inset = state.inset;
    state.inset = undefined;
    state.ready = false;
    state.rendered = undefined;
    inset?.dispose();
  }

  function send(state: BlockState) {
    if (!state.ready || !state.inset) return;
    state.revision++;
    state.error = undefined;
    void state.inset.webview.postMessage({ type: 'render', source: state.block.source, revision: state.revision,
      dark: [vscode.ColorThemeKind.Dark, vscode.ColorThemeKind.HighContrast].includes(vscode.window.activeColorTheme.kind) });
  }

  function mount(view: View, state: BlockState) {
    if (disposed || state.inset || !state.preview) return;
    const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
    const configured = vscode.workspace.getConfiguration('mermaidInline', view.editor.document).get<number>('height', 16);
    const height = Math.max(6, Math.min(50, Number.isFinite(configured) ? configured : 16));
    let inset: vscode.WebviewEditorInset;
    try {
      inset = vscode.window.createWebviewTextEditorInset(view.editor, state.block.startLine, height, {
        enableScripts: true, enableCommandUris: false, localResourceRoots: [root]
      });
    } catch {
      state.preview = false;
      throw new Error('Enable the editorInsets proposed API for 201549bl.mermaid-inline. See the included README and F5 launch configuration.');
    }
    state.inset = inset;
    const messages = inset.webview.onDidReceiveMessage(message => {
      if (!message || state.inset !== inset) return;
      if (message.type === 'ready') { state.ready = true; send(state); }
      if (message.type === 'code') void run(() => showCode(view, state, true));
      if (message.type === 'rendered' && message.revision === state.revision) {
        state.rendered = message.revision;
        state.error = typeof message.error === 'string' ? message.error : undefined;
      }
    });
    inset.onDidDispose(() => {
      messages.dispose();
      if (state.inset === inset) { state.inset = undefined; state.ready = false; }
    });
    inset.webview.html = webviewHtml(inset.webview, root);
  }

  function refresh(view: View) {
    if (disposed) return;
    const previous = view.blocks;
    view.blocks = findBlocks(view.editor.document.getText(), standalone(view.editor.document)).map(block => {
      const state = previous.find(item => item.block.start === block.start && item.block.kind === block.kind);
      if (!state) return { block, preview: false, revision: 0 };
      const moved = state.block.startLine !== block.startLine;
      const edited = state.block.source !== block.source;
      state.block = block;
      if (moved) disposeInset(state); // The proposed API's line anchor is immutable.
      if (state.preview) {
        if (!state.inset) mount(view, state);
        else if (edited) send(state);
      }
      return state;
    });
    for (const state of previous) if (!view.blocks.includes(state)) disposeInset(state);
    changed.fire();
  }

  function getView(editor: vscode.TextEditor): View {
    let view = views.get(editor);
    if (!view) {
      view = { editor, blocks: [] };
      views.set(editor, view);
    }
    if (view.timer) { clearTimeout(view.timer); view.timer = undefined; }
    refresh(view);
    return view;
  }

  async function focus(view: View) {
    if (vscode.window.activeTextEditor !== view.editor) {
      await vscode.window.showTextDocument(view.editor.document, { viewColumn: view.editor.viewColumn, preserveFocus: false });
    }
    return vscode.window.activeTextEditor === view.editor;
  }

  async function preview(view: View, state: BlockState) {
    if (state.preview && state.inset) return;
    if (!await focus(view)) return;
    state.preview = true;
    mount(view, state);
    const block = state.block;
    // Keep the caret outside the body; otherwise VS Code immediately reveals the fold.
    if (view.editor.selections.some(selection => selection.start.line <= block.endLine && selection.end.line > block.startLine)) {
      view.editor.selection = new vscode.Selection(block.startLine, 0, block.startLine, 0);
    }
    if (block.endLine > block.startLine) {
      await vscode.commands.executeCommand('editor.fold', { levels: 1, selectionLines: [block.startLine] });
    }
    changed.fire();
  }

  async function showCode(view: View, state: BlockState, reveal: boolean) {
    if (!await focus(view)) return;
    state.preview = false;
    disposeInset(state);
    await vscode.commands.executeCommand('editor.unfold', { levels: 1, selectionLines: [state.block.startLine] });
    if (reveal) {
      const line = Math.min(state.block.startLine + (state.block.kind === 'fence' ? 1 : 0), view.editor.document.lineCount - 1);
      view.editor.selection = new vscode.Selection(line, 0, line, 0);
      view.editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    changed.fire();
  }

  async function toggle(target?: LensTarget) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !supported(editor.document)) return;
    const view = getView(editor);
    if (target && (target.uri !== editor.document.uri.toString() || target.version !== editor.document.version)) {
      changed.fire();
      return;
    }
    const state = target ? view.blocks.find(item => item.block.start === target.start) : view.blocks.find(item =>
      item.block.startLine <= editor.selection.active.line && item.block.endLine >= editor.selection.active.line);
    if (!state) { void vscode.window.showInformationMessage('Place the cursor inside a Mermaid block first.'); return; }
    if (state.preview) await showCode(view, state, true);
    else await preview(view, state);
  }

  function visibleEditorsChanged() {
    for (const [editor, view] of views) {
      if (!vscode.window.visibleTextEditors.includes(editor)) {
        clearTimeout(view.timer);
        view.blocks.forEach(disposeInset);
        views.delete(editor);
      }
    }
    const active = vscode.window.activeTextEditor;
    if (active && supported(active.document)) {
      const isNew = !views.has(active);
      const view = getView(active);
      if (isNew && vscode.workspace.getConfiguration('mermaidInline', active.document).get('autoPreview', false)) {
        void run(async () => { for (const state of view.blocks) await preview(view, state); });
      }
    }
    changed.fire();
  }

  const selector: vscode.DocumentSelector = [{ language: 'markdown' }, { language: 'mermaid' }, { pattern: '**/*.mmd' }, { pattern: '**/*.mermaid' }];
  context.subscriptions.push(output, changed,
    vscode.commands.registerCommand('mermaidInline.toggle', (target?: LensTarget) => run(() => toggle(target))),
    vscode.commands.registerCommand('mermaidInline.previewAll', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !supported(editor.document)) return;
      const view = getView(editor);
      for (const state of view.blocks) await preview(view, state);
    })),
    vscode.commands.registerCommand('mermaidInline.showAllCode', () => run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !supported(editor.document)) return;
      const view = getView(editor);
      for (const state of view.blocks) if (state.preview) await showCode(view, state, false);
    })),
    vscode.languages.registerCodeLensProvider(selector, {
      onDidChangeCodeLenses: changed.event,
      provideCodeLenses(document) {
        const view = [...views.values()].find(item => item.editor === vscode.window.activeTextEditor && item.editor.document === document);
        return findBlocks(document.getText(), standalone(document)).map(block => new vscode.CodeLens(new vscode.Range(block.startLine, 0, block.startLine, 0), {
          title: view?.blocks.some(state => state.block.start === block.start && state.preview) ? '$(code) Show Mermaid source' : '$(graph) Preview Mermaid diagram',
          command: 'mermaidInline.toggle', arguments: [{ uri: document.uri.toString(), version: document.version, start: block.start } satisfies LensTarget]
        }));
      }
    }),
    // Markdown keeps its built-in folding provider. Standalone Mermaid files need one range.
    vscode.languages.registerFoldingRangeProvider([{ language: 'mermaid' }, { pattern: '**/*.mmd' }, { pattern: '**/*.mermaid' }], {
      provideFoldingRanges(document) { return document.lineCount > 1 ? [new vscode.FoldingRange(0, document.lineCount - 1)] : []; }
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      for (const view of views.values()) if (view.editor.document === event.document && event.contentChanges.length) {
        const changes = event.contentChanges.map(change => ({ start: change.rangeOffset, length: change.rangeLength, text: change.text }));
        for (const state of view.blocks) state.block = { ...state.block, start: moveAnchor(state.block.start, changes) };
        clearTimeout(view.timer);
        view.timer = setTimeout(() => { view.timer = undefined; void run(async () => refresh(view)); }, 120);
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(visibleEditorsChanged),
    vscode.window.onDidChangeActiveTextEditor(visibleEditorsChanged),
    vscode.window.onDidChangeActiveColorTheme(() => { for (const view of views.values()) for (const state of view.blocks) send(state); }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('mermaidInline.height')) for (const view of views.values()) for (const state of view.blocks) {
        disposeInset(state);
        if (state.preview) mount(view, state);
      }
    }),
    { dispose() { disposed = true; for (const view of views.values()) { clearTimeout(view.timer); view.blocks.forEach(disposeInset); } views.clear(); } }
  );
  visibleEditorsChanged();
  // Read-only diagnostics also let the integration suite check real webview round trips.
  return { inspect: () => [...views.values()].flatMap(view => view.blocks.map(state => ({
    uri: view.editor.document.uri.toString(), column: view.editor.viewColumn, startLine: state.block.startLine,
    preview: state.preview, mounted: !!state.inset, ready: !!state.ready,
    rendered: state.rendered === state.revision && state.rendered !== undefined, error: state.error
  }))) };
}

function webviewHtml(webview: vscode.Webview, root: vscode.Uri): string {
  const nonce = randomBytes(18).toString('hex');
  const script = webview.asWebviewUri(vscode.Uri.joinPath(root, 'renderer.js'));
  const css = webview.asWebviewUri(vscode.Uri.joinPath(root, 'renderer.css'));
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src data:; font-src ${webview.cspSource} data:;">
    <meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"></head>
    <body><header><span class="renderer-label">MERMAID</span><span id="status" role="status">Rendering…</span><nav aria-label="Diagram controls">
    <button id="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><button id="zoom-level" title="Actual size (0)" aria-label="Reset zoom to 100 percent">100%</button><button id="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
    <button id="fit" title="Fit diagram">Fit</button><button id="code" class="primary">&lt;/&gt; Code</button></nav></header>
    <main id="viewport" tabindex="0" aria-label="Mermaid diagram" aria-describedby="pan-hint"><div id="diagram"></div><pre id="error" role="alert" hidden></pre></main>
    <footer id="pan-hint"><span>Drag to pan</span><span title="Pinch, or hold Ctrl/⌘ while scrolling">Pinch to zoom</span></footer>
    <div id="scratch" aria-hidden="true"></div><script type="module" nonce="${nonce}" src="${script}"></script></body></html>`;
}
