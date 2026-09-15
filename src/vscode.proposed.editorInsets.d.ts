/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.editorInsets.d.ts
declare module 'vscode' {
  export interface WebviewEditorInset {
    readonly editor: TextEditor;
    readonly line: number;
    readonly height: number;
    readonly webview: Webview;
    readonly onDidDispose: Event<void>;
    dispose(): void;
  }
  export namespace window {
    export function createWebviewTextEditorInset(editor: TextEditor, line: number, height: number, options?: WebviewOptions): WebviewEditorInset;
  }
}
