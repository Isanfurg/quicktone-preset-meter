import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../patch-catalog.mjs';
import { PatchDocument } from '../patch-editor.mjs';
import { suggestions, applyRecipe } from '../effect-recipes.mjs';

function source() {
  const data = new Uint8Array(9902); new DataView(data.buffer).setUint32(0, 29, true);
  for (let i = 0; i < 3; i++) {
    const base = 4 + i * 142;
    data.set([0, 1, 2, 3, 9, 4, 10, 6, 11, 7, 8, 5], base + 94);
    data.set(new TextEncoder().encode('JZ RECIPE'), base + 106);
    for (const block of Object.keys(catalog.layout)) data[base + catalog.layout[block].model_offset] = block === 'AMP' ? 9 : 1;
    data.fill(50, base + 28, base + 36); data[base + 92] = 120;
  }
  data.fill(173, 430); return data;
}
test('every suggested effect uses validated controls and changes only its block in the selected scene', () => {
  const original = source();
  for (const block of ['EFX', 'AMP', 'DLY', 'RVB', 'MOD', 'CMP', 'EQ', 'GATE']) {
    for (const item of suggestions(block, block === 'AMP' ? 9 : 1)) {
      const draft = new PatchDocument(original);
      applyRecipe(draft, 29, 'S2', block, item.id);
      const output = draft.exportPreset(29), layout = catalog.layout[block], base = 146;
      const allowed = new Set([base + layout.model_offset, base + layout.count_offset, ...Array.from({ length: layout.capacity }, (_, i) => base + layout.parameter_offset + i)]);
      for (let i = 0; i < original.length; i++) if (!allowed.has(i)) assert.equal(output[i], original[i], `${block}/${item.id} modified byte ${i}`);
      const applied = draft.describe(29).scenes[1].blocks[block];
      assert.equal(applied.modelId, item.model); assert.equal(applied.enabled, true);
      for (const [name, value] of Object.entries(item.values)) assert.equal(draft.model(29, 'S2', block).parameters.find(p => p.name === name)?.editable, true);
      if (item.dotted) assert.match(applied.subdivision, /puntillo/);
      if (block === 'AMP') { assert.equal(output[base + 29], original[base + 29]); assert.equal(output[base + 33], original[base + 33]); }
    }
  }
});
test('unknown recipes and invalid scenes leave the draft intact', () => {
  const original = source(), draft = new PatchDocument(original);
  assert.throws(() => applyRecipe(draft, 29, 'S2', 'EFX', 'missing'));
  assert.throws(() => applyRecipe(draft, 29, 'S9', 'DLY', 'dotted'));
  assert.deepEqual(draft.exportPreset(29), original);
  assert.deepEqual(suggestions('IR', 1), []);
  assert.deepEqual(suggestions('AMP', 63), []);
});
