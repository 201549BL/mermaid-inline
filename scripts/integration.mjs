import { runTests } from '@vscode/test-electron';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
const root = process.cwd();
const testData = process.env.VSCODE_TEST_DIR || await mkdtemp(resolve(tmpdir(), 'mermaid-inline-tests-'));
const userData = resolve(testData, 'profile');
await mkdir(resolve(userData, 'User'), { recursive: true });
await writeFile(resolve(userData, 'User/settings.json'), JSON.stringify({
  'security.workspace.trust.enabled': false,
  'workbench.startupEditor': 'none',
  'workbench.editor.enablePreview': false,
  'window.restoreWindows': 'none',
  'editor.minimap.enabled': false,
  'editor.folding': true,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.autoUpdate': false,
  'chat.disableAIFeatures': true
}));
await runTests({
  vscodeExecutablePath: process.env.VSCODE_EXECUTABLE || '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
  extensionDevelopmentPath: root,
  extensionTestsPath: resolve(root, 'dist/integration.cjs'),
  launchArgs: [
    '--user-data-dir', userData,
    '--extensions-dir', resolve(testData, 'extensions'),
    '--enable-proposed-api=201549bl.mermaid-inline',
    '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes'
  ],
  extensionTestsEnv: { ELECTRON_RUN_AS_NODE: '' }
});
