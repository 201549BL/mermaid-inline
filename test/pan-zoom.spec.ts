import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import type { PanZoom } from '../src/pan-zoom';

declare global {
  interface Window {
    PanZoomModule: { PanZoom: typeof PanZoom };
    controls: PanZoom;
  }
}
const script = (await build({ entryPoints: ['src/pan-zoom.ts'], bundle: true, write: false, format: 'iife', globalName: 'PanZoomModule' })).outputFiles[0].text;
const styles = await readFile('media/renderer.css', 'utf8');
test.beforeEach(async ({ page }) => {
  await page.setContent(`<style>${styles}body{width:800px;height:400px;margin:20px}</style>
    <header><button id="zoom-level">100%</button></header>
    <main id="viewport" tabindex="0"><div id="diagram"><svg viewBox="0 0 12000 3000"><rect width="12000" height="3000" fill="teal"/></svg></div></main>`);
  await page.addScriptTag({ content: script });
  await page.evaluate(() => {
    window.controls = new window.PanZoomModule.PanZoom(document.getElementById('viewport')!, document.getElementById('diagram')!, document.getElementById('zoom-level')!);
    window.controls.setContent(12000, 3000);
  });
});

const camera = (page: Page) => page.locator('#diagram').evaluate(element => {
  const matrix = new DOMMatrix(getComputedStyle(element).transform);
  return { x: matrix.e, y: matrix.f, scale: matrix.a };
});

test('mouse drag pans; releasing outside the surface ends the drag', async ({ page }) => {
  const before = await camera(page);
  await page.mouse.move(200, 200);
  await page.mouse.down();
  await page.mouse.move(300, 250, { steps: 4 });
  const after = await camera(page);
  expect(after.x - before.x).toBeCloseTo(100);
  expect(after.y - before.y).toBeCloseTo(50);
  await page.mouse.move(950, 550);
  await page.mouse.up();
  const released = await camera(page);
  await page.mouse.move(200, 200);
  expect(await camera(page)).toEqual(released);
  await expect(page.locator('#viewport')).not.toHaveClass(/panning/);
});

test('Ctrl-wheel zooms around the pointer; plain wheel pans both axes', async ({ page }) => {
  const viewport = await page.locator('#viewport').boundingBox();
  const before = await camera(page);
  await page.mouse.move(viewport!.x + 250, viewport!.y + 150);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -60);
  await expect.poll(async () => (await camera(page)).scale).toBeGreaterThan(before.scale);
  await page.keyboard.up('Control');
  const after = await camera(page);
  expect((250 - before.x) / before.scale).toBeCloseTo((250 - after.x) / after.scale, 1);
  expect((150 - before.y) / before.scale).toBeCloseTo((150 - after.y) / after.scale, 1);
  await page.mouse.wheel(40, 60);
  await expect.poll(async () => (await camera(page)).x).toBeCloseTo(after.x - 40, 2);
  expect((await camera(page)).y).toBeCloseTo(after.y - 60, 2);
});

test('touch pinch scales and cancels cleanly', async ({ page }) => {
  // Dispatch touch events in Chromium while exercising the real pointer handlers.
  await page.locator('#viewport').evaluate(element => {
    element.setPointerCapture = () => {};
    const pointer = (type: string, id: number, x: number) => element.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: 200, button: 0, bubbles: true
    }));
    pointer('pointerdown', 1, 200);
    pointer('pointerdown', 2, 400);
  });
  const before = await camera(page);
  await page.locator('#viewport').dispatchEvent('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 500, clientY: 200 });
  expect((await camera(page)).scale / before.scale).toBeCloseTo(1.5, 4);
  await page.locator('#viewport').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.locator('#viewport').dispatchEvent('pointercancel', { pointerId: 2 });
  await expect(page.locator('#viewport')).not.toHaveClass(/panning/);
});

test('keyboard navigation, actual size, fit, resize, and render updates', async ({ page }) => {
  await page.locator('#viewport').focus();
  await page.keyboard.press('0');
  expect((await camera(page)).scale).toBe(1);
  await expect(page.locator('#zoom-level')).toHaveText('100%');
  const before = await camera(page);
  await page.keyboard.press('ArrowRight');
  expect((await camera(page)).x).toBeCloseTo(before.x - 48);
  await page.evaluate(() => window.controls.setContent(14000, 4000));
  expect((await camera(page)).scale).toBe(1);
  await page.keyboard.press('f');
  expect((await camera(page)).scale).toBeLessThan(0.06);
  await page.evaluate(() => { document.body.style.width = '500px'; });
  await expect.poll(async () => (await camera(page)).scale).toBeLessThan(0.04);
  const fitted = await camera(page);
  const size = await page.locator('#viewport').boundingBox();
  expect(fitted.x).toBeGreaterThanOrEqual(15.99);
  expect(fitted.x + 14000 * fitted.scale).toBeLessThan(size!.width - 15.9);
});
