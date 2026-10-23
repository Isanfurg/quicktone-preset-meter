import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchDocument, proposeBalance, applyBalance, eqDb } from '../patch-editor.mjs';
import { readPatchFile } from '../patch-reader.mjs';

function source() {
  const data = new Uint8Array(9902); new DataView(data.buffer).setUint32(0, 29, true);
  for (let scene = 0; scene < 3; scene++) {
    const base = 4 + scene * 142;
    data.set([0, 1, 2, 3, 9, 4, 10, 6, 11, 7, 8, 5], base + 94);
    data.set(new TextEncoder().encode('JZ TEST'), base + 106);
    data[base + 3] = 9; data[base + 4] = 1; data[base + 7] = 2;
    data[base + 28] = 42; data[base + 29] = 60;
    data.fill(50, base + 37, base + 49); data[base + 92] = 120;
  }
  data.fill(173, 430); return data;
}
function take(extra = {}) { return { id: 'take', family: 'JZ', preset: '08B JZ TEST', scene: 'S2', context: 'same-input', input: 'NUX', date: '2026-01-01', processing: false, rmsDb: -23, peakDb: -12, seconds: 12, activeSeconds: 10, clipped: 0, offset: 0, program: 29, ...extra }; }

test('numeric editing changes exactly one byte and preserves original IR/NAM payload', () => {
  const original = source(), document = new PatchDocument(original);
  document.setParameter(29, 'S2', 'AMP', 'GAIN', 50);
  const output = document.exportPreset(29);
  assert.deepEqual([...output.keys()].filter(i => output[i] !== original[i]), [4 + 142 + 28]);
  assert.deepEqual(original, source()); assert.deepEqual(output.subarray(430), original.subarray(430));
  assert.equal(readPatchFile(output)[0].scenes[1].blocks.AMP.parameters[0].value, 50);
});
test('validation refuses unsupported parameters and models without mutating data', () => {
  const document = new PatchDocument(source());
  for (const action of [() => document.setParameter(29, 'S1', 'AMP', 'GAIN', 101), () => document.setParameter(29, 'S1', 'AMP', 'GAIN', 1.5), () => document.setParameter(29, 'S1', 'AMP', 'unknown', 30), () => document.setModel(29, 'S1', 'AMP', 63), () => document.rename(29, '🎸'), () => document.setTempo(29, 'S1', 900)]) assert.throws(action);
  assert.deepEqual(document.exportPreset(29), source());
});
test('rename, scene copying, bypass, model defaults and reset preserve unrelated bytes', () => {
  const document = new PatchDocument(source());
  document.rename(29, 'NEW NAME'); document.setEnabled(29, 'S1', 'AMP', false);
  document.setModel(29, 'S1', 'RVB', 2); document.setTempo(29, 'S1', 137); document.setDottedEighth(29, 'S1');
  document.copyScene(29, 'S1', 'S3');
  const preset = document.describe(29);
  assert.equal(preset.scenes[2].blocks.RVB.modelId, 2); assert.equal(preset.scenes[2].bpm, 137);
  assert.equal(preset.scenes[2].blocks.AMP.enabled, false); assert.match(preset.scenes[2].blocks.DLY.subdivision, /puntillo/);
  assert.deepEqual(document.exportPreset(29).subarray(430), source().subarray(430));
  document.reset(29); assert.deepEqual(document.exportPreset(29), source());
});
test('measured balance adjusts only calibrated EQ output and refuses double application', async () => {
  const document = new PatchDocument(source());
  const measured = take({ patchFingerprint: await document.fingerprint(29, 'S2') });
  const reference = take({ id: 'ref', program: 16, scene: 'S1', rmsDb: -20 });
  const proposal = await proposeBalance(document, 29, 'S2', measured, reference);
  assert.equal(proposal.before, 50); assert.equal(proposal.after, 60); assert.equal(proposal.actualDb, 3);
  assert.ok(Math.abs(eqDb(57) - 2.1) < 0.00001);
  await applyBalance(document, proposal);
  const output = document.exportPreset(29);
  assert.deepEqual([...output.keys()].filter(i => output[i] !== source()[i]), [4 + 142 + 43]);
  await assert.rejects(applyBalance(document, proposal), /Vuelve a medir/);
});
test('balance refuses stale versions, clipping, excess gain, disabled EQ and missing headroom', async () => {
  const reference = take({ id: 'ref', program: 16, rmsDb: -20 });
  const document = new PatchDocument(source());
  const fingerprint = await document.fingerprint(29, 'S2');
  for (const override of [{ patchFingerprint: '0'.repeat(64) }, { clipped: 1 }, { rmsDb: -35 }, { peakDb: -2 }, { activeSeconds: 0 }]) {
    const proposal = await proposeBalance(document, 29, 'S2', take({ patchFingerprint: fingerprint, ...override }), reference);
    assert.ok(proposal.reason);
  }
  document.setEnabled(29, 'S2', 'EQ', false);
  assert.match((await proposeBalance(document, 29, 'S2', take({ patchFingerprint: await document.fingerprint(29, 'S2') }), reference)).reason, /EQ activo/);
});
