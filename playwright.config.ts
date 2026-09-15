import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './test', testMatch: '*.spec.ts', workers: 1, reporter: 'list',
  outputDir: join(tmpdir(), 'mermaid-inline-panzoom-results'),
  use: { channel: 'chrome', headless: true, viewport: { width: 1000, height: 700 } }
});
