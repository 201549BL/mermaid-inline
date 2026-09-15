export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Camera = Point & { scale: number };
export const MAX_ZOOM = 8;
export const MIN_ZOOM = 0.00001;

export function fitCamera(content: Size, viewport: Size): Camera {
  const scale = Math.max(MIN_ZOOM, Math.min(1,
    Math.max(1, viewport.width - 32) / content.width,
    Math.max(1, viewport.height - 32) / content.height));
  return { scale, x: (viewport.width - content.width * scale) / 2, y: (viewport.height - content.height * scale) / 2 };
}

/** Keep the same diagram point under the pointer as its scale changes. */
export function zoomCamera(camera: Camera, scale: number, anchor: Point): Camera {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  const ratio = next / camera.scale;
  return { scale: next, x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio };
}
