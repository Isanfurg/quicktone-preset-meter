import { packager } from '@electron/packager';
import { mkdtemp, cp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stage = await mkdtemp(path.join(tmpdir(), 'preset-studio-build-'));
try {
  const files = ['index.html', 'style.css', 'app.mjs', 'meter.mjs', 'worklet.mjs', 'server.mjs', 'patch-reader.mjs', 'patch-viewer.mjs', 'patch-catalog.mjs', 'patch-editor.mjs', 'effect-recipes.mjs', 'editor-ui.mjs', 'LICENSE', 'README.md'];
  for (const file of files) await cp(path.join(root, file), path.join(stage, file));
  await mkdir(path.join(stage, 'desktop'));
  for (const file of ['main.mjs', 'preload.cjs']) await cp(path.join(root, 'desktop', file), path.join(stage, 'desktop', file));
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, type: 'module', main: pkg.main, license: pkg.license }));
  const output = await packager({ dir: stage, name: 'QuickTone Preset Studio', platform: 'win32', arch: 'x64', electronVersion: pkg.devDependencies.electron, out: path.join(root, 'release', pkg.version), asar: true, overwrite: false, appVersion: pkg.version, appCopyright: 'QuickTone Preset Studio contributors', win32metadata: { CompanyName: 'Community open source project', FileDescription: 'QuickTone Preset Studio', ProductName: 'QuickTone Preset Studio' } });
  console.log(`Desktop listo: ${output.join(', ')}. Los archivos privados nunca entran en la carpeta de empaquetado.`);
} finally {
  if (!path.resolve(stage).startsWith(path.join(tmpdir(), 'preset-studio-build-'))) throw new Error('Unexpected staging directory');
  await rm(stage, { recursive: true, force: true });
}
