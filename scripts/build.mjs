import { build, context } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
const configs = [
  { entryPoints: ['src/extension.ts'], outfile: 'dist/extension.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], sourcemap: true },
  { entryPoints: ['src/renderer.ts'], outdir: 'dist/webview', bundle: true, platform: 'browser', format: 'esm', splitting: true, minify: true, target: 'es2022', loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' } },
  { entryPoints: ['test/integration.ts'], outfile: 'dist/integration.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['vscode'] }
];
// Remove obsolete hashed chunks so release packages contain only this build.
if (!process.argv.includes('--watch')) await rm('dist', { recursive: true, force: true });
await mkdir('dist/webview', { recursive: true });
await copyFile('media/renderer.css', 'dist/webview/renderer.css');
await import('./licenses.mjs');
if (process.argv.includes('--watch')) {
  for (const config of configs) await (await context(config)).watch();
} else {
  await Promise.all(configs.map(config => build(config)));
}
