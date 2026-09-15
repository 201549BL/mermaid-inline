import mermaid from 'mermaid';
import { PanZoom } from './pan-zoom';
import { diagramTheme } from './theme';
declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const vscode = acquireVsCodeApi();
const diagram = document.getElementById('diagram')!;
const viewport = document.getElementById('viewport')!;
const errorElement = document.getElementById('error')!;
const status = document.getElementById('status')!;
const scratch = document.getElementById('scratch')!;
type RenderMessage = { type: 'render'; source: string; revision: number; dark: boolean };
let pending: RenderMessage | undefined;
let latest = 0;
let rendering = false;
const camera = new PanZoom(viewport, diagram, document.getElementById('zoom-level')!);
document.getElementById('code')!.addEventListener('click', () => vscode.postMessage({ type: 'code' }));
document.getElementById('fit')!.addEventListener('click', () => camera.fit());
document.getElementById('zoom-in')!.addEventListener('click', () => camera.zoomBy(1.25));
document.getElementById('zoom-out')!.addEventListener('click', () => camera.zoomBy(0.8));
document.getElementById('zoom-level')!.addEventListener('click', () => camera.actualSize());
document.addEventListener('keydown', event => { if (event.key === 'Escape') vscode.postMessage({ type: 'code' }); });

async function renderPending() {
  if (rendering) return;
  rendering = true;
  while (pending) {
    const message = pending;
    pending = undefined;
    status.textContent = 'Rendering…';
    try {
      mermaid.initialize({ ...diagramTheme(message.dark), startOnLoad: false, securityLevel: 'strict',
        suppressErrorRendering: true });
      if (!message.source.trim()) throw new Error('This Mermaid block is empty. Choose Code to add a diagram.');
      const { svg } = await mermaid.render(`diagram-${message.revision}`, message.source, scratch);
      if (message.revision !== latest) continue;
      diagram.innerHTML = svg;
      errorElement.hidden = true;
      diagram.hidden = false;
      const element = diagram.querySelector('svg');
      const box = element?.viewBox.baseVal;
      camera.setContent(box?.width || element?.getBoundingClientRect().width || 600,
        box?.height || element?.getBoundingClientRect().height || 300);
      status.textContent = '';
      vscode.postMessage({ type: 'rendered', revision: message.revision });
    } catch (error) {
      if (message.revision !== latest) continue;
      const text = error instanceof Error ? error.message : String(error);
      diagram.replaceChildren();
      camera.clear();
      diagram.hidden = true;
      errorElement.hidden = false;
      errorElement.textContent = text;
      status.textContent = 'Check diagram syntax';
      vscode.postMessage({ type: 'rendered', revision: message.revision, error: text });
    } finally {
      scratch.replaceChildren();
    }
  }
  rendering = false;
}
window.addEventListener('message', event => {
  const message = event.data;
  if (message?.type !== 'render' || typeof message.source !== 'string' || !Number.isInteger(message.revision)) return;
  latest = message.revision;
  pending = message;
  void renderPending();
});
vscode.postMessage({ type: 'ready' });
