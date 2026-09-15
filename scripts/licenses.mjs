import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const packages = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ls', '--omit=dev', '--all', '--parseable'], { encoding: 'utf8' }).trim().split('\n').slice(1);
const notices = [];
for (const directory of [...new Set(packages)]) {
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const files = (await readdir(directory)).filter(name => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name));
  const bodies = await Promise.all(files.map(name => readFile(join(directory, name), 'utf8').then(body => `${name}\n${body}`)));
  notices.push(`${manifest.name}@${manifest.version}\nLicense: ${manifest.license ?? 'See package source'}\n${bodies.join('\n\n')}`);
}
await writeFile('dist/THIRD_PARTY_LICENSES.txt', notices.join('\n\n' + '='.repeat(72) + '\n\n'));
