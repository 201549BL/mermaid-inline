# Mermaid, where you write it

Click **Preview Mermaid diagram** above either fence, or place your cursor inside
one and press **⌥⌘M** on macOS (**Ctrl+Alt+M** on Windows/Linux).

```mermaid
flowchart LR
    A[Write a diagram] --> B[Preview inline]
    B --> C{Need a change?}
    C -->|Code| A
    C -->|Looks good| D[Keep writing]
```

This is ordinary, editable Markdown in VS Code's native text editor.

```mermaid
sequenceDiagram
    participant You
    participant Editor
    participant Mermaid
    You->>Editor: Preview diagram
    Editor->>Mermaid: Render source locally
    Mermaid-->>Editor: SVG
    Editor-->>You: Inline diagram
    You->>Editor: Code
    Editor-->>You: Original source
```

The Command Palette also offers **Mermaid Inline: Preview All Diagrams** and
**Mermaid Inline: Show All Source Code**.
