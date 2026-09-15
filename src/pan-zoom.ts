import { fitCamera, zoomCamera, type Camera, type Point, type Size } from './camera';

export class PanZoom {
  private camera: Camera = { x: 0, y: 0, scale: 1 };
  private content: Size = { width: 1, height: 1 };
  private fitted = true;
  private enabled = false;
  private pointers = new Map<number, Point>();
  private abort = new AbortController();
  private observer: ResizeObserver;

  constructor(private viewport: HTMLElement, private diagram: HTMLElement, private percentage: HTMLElement) {
    const options = { signal: this.abort.signal };
    viewport.addEventListener('pointerdown', event => {
      if (!this.enabled || (event.button !== 0 && event.button !== 1)) return;
      event.preventDefault();
      viewport.focus({ preventScroll: true });
      viewport.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, this.point(event));
      viewport.classList.add('panning');
    }, options);
    viewport.addEventListener('pointermove', event => {
      const previous = this.pointers.get(event.pointerId);
      if (!previous) return;
      const next = this.point(event);
      const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
        const after = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 };
        const distance = Math.hypot(previous.x - other.x, previous.y - other.y);
        if (distance > 0) this.camera = zoomCamera(this.camera,
          this.camera.scale * Math.hypot(next.x - other.x, next.y - other.y) / distance, before);
        this.pan(after.x - before.x, after.y - before.y);
      } else this.pan(next.x - previous.x, next.y - previous.y);
      this.pointers.set(event.pointerId, next);
    }, options);
    const release = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) viewport.classList.remove('panning');
    };
    viewport.addEventListener('pointerup', release, options);
    viewport.addEventListener('pointercancel', release, options);
    viewport.addEventListener('lostpointercapture', release, options);
    viewport.addEventListener('wheel', event => {
      if (!this.enabled) return;
      event.preventDefault();
      // Trackpad pinch arrives as a Ctrl+wheel event in Chromium.
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const dx = event.deltaX * units;
      const dy = event.deltaY * units;
      if (event.ctrlKey || event.metaKey) {
        this.zoomTo(this.camera.scale * Math.exp(-Math.max(-200, Math.min(200, dy)) * 0.01), this.point(event));
      } else if (event.shiftKey && !dx) this.pan(-dy, 0);
      else this.pan(-dx, -dy);
    }, { ...options, passive: false });
    viewport.addEventListener('keydown', event => {
      if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
      const actions: Record<string, () => void> = {
        '+': () => this.zoomBy(1.25), '=': () => this.zoomBy(1.25), '-': () => this.zoomBy(0.8),
        '0': () => this.actualSize(), f: () => this.fit(), F: () => this.fit(),
        ArrowLeft: () => this.pan(48, 0), ArrowRight: () => this.pan(-48, 0),
        ArrowUp: () => this.pan(0, 48), ArrowDown: () => this.pan(0, -48)
      };
      if (actions[event.key]) { event.preventDefault(); event.stopPropagation(); actions[event.key](); }
    }, options);
    this.observer = new ResizeObserver(() => {
      if (this.enabled && this.fitted) this.fit();
    });
    this.observer.observe(viewport);
  }

  setContent(width: number, height: number) {
    this.content = { width: Math.max(1, width), height: Math.max(1, height) };
    this.enabled = true;
    this.viewport.classList.add('interactive');
    this.diagram.style.width = `${this.content.width}px`;
    this.diagram.style.height = `${this.content.height}px`;
    const svg = this.diagram.querySelector('svg');
    if (svg) {
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.maxWidth = 'none';
    }
    if (this.fitted) this.fit();
    else this.paint();
  }

  clear() {
    this.enabled = false;
    for (const id of this.pointers.keys()) if (this.viewport.hasPointerCapture(id)) this.viewport.releasePointerCapture(id);
    this.pointers.clear();
    this.viewport.classList.remove('interactive', 'panning');
    this.percentage.textContent = '100%';
  }

  fit() {
    if (!this.enabled) return;
    this.fitted = true;
    this.camera = fitCamera(this.content, { width: this.viewport.clientWidth, height: this.viewport.clientHeight });
    this.paint();
  }

  zoomBy(factor: number) { this.zoomTo(this.camera.scale * factor, this.center()); }
  actualSize() { this.zoomTo(1, this.center()); }

  private center(): Point { return { x: this.viewport.clientWidth / 2, y: this.viewport.clientHeight / 2 }; }
  private point(event: MouseEvent): Point {
    const rect = this.viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private zoomTo(scale: number, anchor: Point) {
    if (!this.enabled) return;
    this.fitted = false;
    this.camera = zoomCamera(this.camera, scale, anchor);
    this.paint();
  }
  private pan(dx: number, dy: number) {
    this.fitted = false;
    this.camera = { ...this.camera, x: this.camera.x + dx, y: this.camera.y + dy };
    this.paint();
  }
  private paint() {
    const { x, y, scale } = this.camera;
    this.diagram.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    const percent = scale * 100;
    this.percentage.textContent = `${percent < 10 ? Number(percent.toPrecision(2)) : Math.round(percent)}%`;
    this.percentage.setAttribute('aria-label', `Zoom ${this.percentage.textContent}. Reset to 100 percent`);
  }
  dispose() { this.clear(); this.abort.abort(); this.observer.disconnect(); }
}
