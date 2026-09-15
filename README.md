# Mermaid Inline

Render Mermaid diagrams inside VS Code's text editor. Supports Markdown code
blocks and `.mmd` / `.mermaid` files, with source toggling, pan and zoom.

https://github.com/user-attachments/assets/33dfca7d-05c7-4cd3-847d-99b628cd2ec9

## Install

Requires **VS Code 1.134+**. Uses the experimental `editorInsets` API, so it's
installed from GitHub rather than the Marketplace.

1. Download the `.vsix` from [Releases](https://github.com/201549BL/mermaid-inline/releases).
2. In VS Code, run **Extensions: Install from VSIX…** from the Command Palette.
3. Fully quit VS Code, then launch with:

   ```sh
   code --enable-proposed-api=201549bl.mermaid-inline
   ```

## Use

- Click **Preview Mermaid diagram** above a block; **Code** restores the source.
- **⌘⌥M** / **Ctrl+Alt+M** toggles the block at the cursor.
- Drag or scroll to pan. Pinch or **Ctrl/⌘ + scroll** to zoom. **Fit** resets the view.

For automatic previews, set `"mermaidInline.autoPreview": true` in settings.
Keep editor folding enabled; the opening fence or first source line stays visible.

Try the [examples](examples).
