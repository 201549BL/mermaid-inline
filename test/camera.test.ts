import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCamera, zoomCamera } from '../src/camera.ts';

test('fitting a very large diagram puts every edge inside the viewport', () => {
  const size = { width: 80000, height: 16000 };
  const camera = fitCamera(size, { width: 600, height: 300 });
  assert.ok(camera.scale < 0.05);
  assert.ok(camera.x >= 15.99 && camera.y >= 15.99);
  assert.ok(camera.x + size.width * camera.scale <= 584.01);
  assert.ok(camera.y + size.height * camera.scale <= 284.01);
});

test('zoom preserves the diagram coordinate underneath an arbitrary pointer', () => {
  const camera = { x: -190, y: 73, scale: 0.13 };
  const pointer = { x: 431, y: 196 };
  const after = zoomCamera(camera, 0.81, pointer);
  assert.ok(Math.abs((pointer.x - camera.x) / camera.scale - (pointer.x - after.x) / after.scale) < 1e-9);
  assert.ok(Math.abs((pointer.y - camera.y) / camera.scale - (pointer.y - after.y) / after.scale) < 1e-9);
});

test('zoom limits still preserve the anchor and fit does not enlarge small diagrams', () => {
  const camera = { x: 0, y: 0, scale: 1 };
  assert.equal(zoomCamera(camera, 100, { x: 50, y: 50 }).scale, 8);
  assert.ok(zoomCamera(camera, 0, { x: 50, y: 50 }).scale > 0);
  assert.deepEqual(fitCamera({ width: 100, height: 100 }, { width: 600, height: 300 }), { x: 250, y: 100, scale: 1 });
});
