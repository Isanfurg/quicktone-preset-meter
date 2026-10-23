import { readdir, readFile, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPatchFile } from './patch-reader.mjs';

const input = process.argv[2];
if (!input || process.argv.slice(3).some(arg => arg !== '--historical')) {
  console.error('Uso: node import-snapshot.mjs archivo-o-carpeta [--historical]');
  process.exitCode = 1;
} else {
  try {
    const absolute = path.resolve(input), info = await stat(absolute);
    const files = info.isDirectory() ? (await readdir(absolute)).filter(name => name.toLowerCase().endsWith('.mg30patch')).map(name => path.join(absolute, name)) : [absolute];
    if (!files.length || files.length > 129) throw new Error('Elige una exportación de 1 a 128 presets, o un banco completo.');
    const sizes = await Promise.all(files.map(async file => ({ file, info: await stat(file) })));
    const banks = sizes.filter(entry => entry.info.size === 9902 * 128);
    if (banks.length > 1) throw new Error('Hay más de un banco completo. Elige un solo archivo para evitar mezclar respaldos.');
    const selected = banks.length ? banks : sizes;
    const presets = [], slots = new Set();
    for (const { file, info: fileInfo } of selected) {
      if (fileInfo.size > 9902 * 128) throw new Error('Archivo demasiado grande para el formato compatible.');
      const decoded = readPatchFile(await readFile(file));
      for (const preset of decoded) {
        if (slots.has(preset.slot)) throw new Error(`Slot repetido ${preset.slot}. No mezcles exportaciones distintas.`);
        slots.add(preset.slot);
        presets.push({ ...preset, source: `${path.basename(file)} · modificado ${fileInfo.mtime.toISOString()}` });
      }
    }
    if (presets.length > 128) throw new Error('El respaldo excede los 128 presets.');
    presets.sort((a, b) => a.program - b.program);
    const snapshot = { version: 1, historical: process.argv.includes('--historical'), loadedAt: new Date().toISOString(), fileModifiedAt: new Date(Math.max(...selected.map(entry => entry.info.mtimeMs))).toISOString(), presets };
    const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'presets.private.json');
    await writeFile(output + '.tmp', JSON.stringify(snapshot, null, 2));
    await rename(output + '.tmp', output);
    console.log(`Cargados ${presets.length} presets / ${presets.length * 3} escenas. ${snapshot.historical ? 'Respaldo histórico.' : 'Exportación cargada; no es una conexión en vivo.'} Recarga el visor.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
