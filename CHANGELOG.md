# Changelog

## 0.2.1 — 2026-09-15

First public experimental release.

- Native inline rendering for Markdown Mermaid fences and standalone `.mmd` / `.mermaid` files.
- Per-diagram Code/Preview toggles and commands to preview or restore every block.
- Drag, scroll, and keyboard panning; pointer-centered zoom and touch/trackpad pinch.
- Fit and actual-size controls, including very large diagrams.
- Flat light/dark styling, readable annotations, and corrected label spacing.
- Source-change tracking, syntax errors, and recovery after correcting a diagram.
- Bundled local Mermaid rendering, with no CDN or diagram upload.
- Release identity: `201549bl.mermaid-inline` (replaces `local-prototypes.mermaid-inline`).

Requires the experimental `editorInsets` API to be enabled. Source is folded
beneath its first line; see the README for installation and known limitations.
