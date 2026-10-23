import test from 'node:test';
import assert from 'node:assert/strict';
import { readPatchFile } from '../patch-reader.mjs';
import { mkdtemp, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

function fixture(program = 29) {
  const bytes = new Uint8Array(9902);
  new DataView(bytes.buffer).setUint32(0, program, true);
  for (let scene = 0; scene < 3; scene++) {
    const base = 4 + scene * 142;
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], base + 94);
    bytes.set(new TextEncoder().encode('TEST PRESET'), base + 106);
    bytes[base + 3] = 9;
    bytes[base + 28] = 42 + scene;
    bytes[base + 29] = 60;
    bytes[base + 7] = 2;
    bytes[base + 65] = 212;
    bytes[base + 92] = 120;
  }
  return bytes;
}
test('read-only file viewer decodes all scenes without changing payload bytes', () => {
  const bytes = fixture(); bytes[6000] = 239;
  const original = bytes.slice();
  const [preset] = readPatchFile(bytes);
  assert.equal(preset.slot, '08B'); assert.equal(preset.name, 'TEST PRESET');
  assert.equal(preset.scenes.length, 3);
  assert.equal(preset.scenes[0].blocks.AMP.modelId, 9);
  assert.equal(preset.scenes[2].blocks.AMP.parameters.find(p => p.name === 'GAIN').value, 44);
  assert.match(preset.scenes[0].blocks.DLY.subdivision, /puntillo/);
  assert.deepEqual(bytes, original);
});
test('reader honors typed-array offsets and full 128-record banks', () => {
  const wrapped = new Uint8Array(9902 + 10); wrapped.set(fixture(), 5);
  assert.equal(readPatchFile(wrapped.subarray(5, -5))[0].program, 29);
  const bank = new Uint8Array(9902 * 128);
  for (let i = 0; i < 128; i++) bank.set(fixture(i), i * 9902);
  const result = readPatchFile(bank);
  assert.equal(result.length, 128); assert.equal(result[127].slot, '32D');
});
test('incompatible layout is rejected instead of guessing values', () => {
  assert.throws(() => readPatchFile(new Uint8Array(430)), /Formato no compatible/);
  const badHeader = fixture(); badHeader[0] = 255;
  assert.throws(() => readPatchFile(badHeader), /Cabecera/);
  const badChain = fixture(); badChain[4 + 94] = 11;
  assert.throws(() => readPatchFile(badChain), /Cadena/);
  const badName = fixture(); badName[4 + 106] = 200;
  assert.throws(() => readPatchFile(badName), /Nombre/);
});
test('unknown models and bypass are represented without inventing parameter names', () => {
  const data = fixture(); data[4 + 3] = 63 | 64;
  const block = readPatchFile(data)[0].scenes[0].blocks.AMP;
  assert.equal(block.enabled, false); assert.equal(block.modelId, 63);
  assert.match(block.model, /sin mapear/); assert.equal(block.parameters[0].name, 'RAW 1');
});

test('snapshot importer saves metadata, preserves source, and refuses duplicate slots', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'quicktone-import-test-'));
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const run = promisify(execFile);
  try {
    for (const file of ['import-snapshot.mjs', 'patch-reader.mjs', 'patch-catalog.mjs']) await cp(path.join(root, file), path.join(folder, file));
    const patch = path.join(folder, 'test.mg30patch'), original = fixture();
    await writeFile(patch, original);
    await run(process.execPath, ['import-snapshot.mjs', patch, '--historical'], { cwd: folder });
    const target = path.join(folder, 'presets.private.json');
    const saved = await readFile(target, 'utf8');
    const snapshot = JSON.parse(saved);
    assert.equal(snapshot.historical, true); assert.equal(snapshot.presets.length, 1);
    assert.equal(snapshot.presets[0].slot, '08B'); assert.ok(snapshot.fileModifiedAt);
    assert.deepEqual(new Uint8Array(await readFile(patch)), original);
    await writeFile(path.join(folder, 'duplicate.mg30patch'), original);
    await assert.rejects(run(process.execPath, ['import-snapshot.mjs', folder], { cwd: folder }), /Slot repetido/);
    assert.equal(await readFile(target, 'utf8'), saved);
  } finally {
    if (!path.resolve(folder).startsWith(path.join(tmpdir(), 'quicktone-import-test-'))) throw new Error('Unexpected fixture path');
    await rm(folder, { recursive: true, force: true });
  }
});
