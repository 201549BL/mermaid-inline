import type { MermaidConfig } from 'mermaid';

/** A flat, restrained palette with explicit note and edge-label contrast. */
export function diagramTheme(dark: boolean): MermaidConfig {
  const palette = dark ? {
    background: '#1f1f1f', surface: '#293442', text: '#e2e8f0', border: '#71849a',
    group: '#24282e', groupBorder: '#454e5b', line: '#a3b2c4',
    note: '#303a46', noteBorder: '#657b94', muted: '#b5c2d3'
  } : {
    background: '#ffffff', surface: '#edf3fa', text: '#243449', border: '#6c819b',
    group: '#f7f9fc', groupBorder: '#c9d3df', line: '#566b84',
    note: '#eef2f7', noteBorder: '#94a6bd', muted: '#4b6079'
  };
  return {
    theme: 'base', look: 'classic',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    themeVariables: {
      darkMode: dark, background: palette.background, fontSize: '14px',
      primaryColor: palette.surface, primaryTextColor: palette.text, primaryBorderColor: palette.border,
      secondaryColor: palette.note, secondaryTextColor: palette.text, secondaryBorderColor: palette.noteBorder,
      tertiaryColor: palette.group, tertiaryTextColor: palette.text, tertiaryBorderColor: palette.groupBorder,
      mainBkg: palette.surface, nodeBorder: palette.border, textColor: palette.text,
      lineColor: palette.line, defaultLinkColor: palette.line,
      clusterBkg: palette.group, clusterBorder: palette.groupBorder, titleColor: palette.muted,
      edgeLabelBackground: palette.background,
      noteBkgColor: palette.note, noteBorderColor: palette.noteBorder, noteTextColor: palette.text,
      actorBkg: palette.surface, actorBorder: palette.border, actorTextColor: palette.text,
      actorLineColor: palette.groupBorder, signalColor: palette.line, signalTextColor: palette.text,
      labelBoxBkgColor: palette.group, labelBoxBorderColor: palette.groupBorder, labelTextColor: palette.text,
      activationBkgColor: palette.surface, activationBorderColor: palette.border,
      dropShadow: 'none'
    },
    themeCSS: `
      [filter*="drop-shadow"] { filter: none !important; }
      .edgeLabel rect { opacity: 1 !important; }
      .cluster-label text { font-weight: 600; }
      .node rect, .cluster rect { rx: 5px; ry: 5px; }
      .note { rx: 4px; ry: 4px; }
    `,
    flowchart: { htmlLabels: false, padding: 16, nodeSpacing: 36, rankSpacing: 60 },
    sequence: { noteFontSize: 13, messageFontSize: 14, actorFontSize: 14 }
  };
}
