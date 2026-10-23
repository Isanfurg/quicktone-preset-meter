import catalog from './patch-catalog.mjs';
import { readPatchFile } from './patch-reader.mjs';
import { compare, validTake } from './meter.mjs';

export class PatchDocument {
  constructor(input) {
    this.original = new Uint8Array(input).slice();
    this.presets = readPatchFile(this.original);
    if (new Set(this.presets.map(p => p.program)).size !== this.presets.length) throw new Error('El banco contiene slots repetidos.');
    this.records = new Map(this.presets.map((preset, index) => [preset.program, this.original.slice(index * 9902, (index + 1) * 9902)]));
  }
  record(program) { const value = this.records.get(program); if (!value) throw new Error('Preset no encontrado.'); return value; }
  base(program, scene) { this.record(program); if (!['S1', 'S2', 'S3'].includes(scene)) throw new Error('Escena no válida.'); return 4 + (Number(scene[1]) - 1) * 142; }
  describe(program) { return readPatchFile(this.record(program))[0]; }
  model(program, scene, block) {
    const layout = catalog.layout[block]; if (!layout) throw new Error('Bloque no válido.');
    const id = this.record(program)[this.base(program, scene) + layout.model_offset] & 63;
    const model = catalog.models.find(item => item.block === block && item.id === id);
    if (!model) throw new Error('Modelo sin mapear: sus bytes se conservan.');
    return model;
  }
  setParameter(program, scene, block, name, value) {
    const parameter = this.model(program, scene, block).parameters.find(item => item.name === name);
    if (!parameter?.editable || !Number.isInteger(value) || value < parameter.min || value > parameter.max || parameter.index >= catalog.layout[block].capacity) throw new Error('Control especial o valor fuera del rango validado.');
    this.record(program)[this.base(program, scene) + catalog.layout[block].parameter_offset + parameter.index] = value;
  }
  setEnabled(program, scene, block, enabled) {
    if (typeof enabled !== 'boolean' || !catalog.layout[block]) throw new Error('Estado de bloque no válido.');
    const record = this.record(program), at = this.base(program, scene) + catalog.layout[block].model_offset;
    record[at] = enabled ? record[at] & ~64 : record[at] | 64;
  }
  setModel(program, scene, block, id) {
    const layout = catalog.layout[block];
    const model = catalog.models.find(item => item.block === block && item.id === id);
    if (!layout || !Number.isInteger(id) || id < 1 || id > 63 || !model || model.special || !model.parameters.length || model.parameters.some(p => !p.editable || p.index >= layout.capacity || !Number.isInteger(p.default) || p.default < p.min || p.default > p.max)) throw new Error('Este modelo requiere un archivo base con sus controles especiales ya configurados.');
    const record = this.record(program), base = this.base(program, scene);
    record[base + layout.model_offset] = (record[base + layout.model_offset] & 192) | id;
    for (const parameter of model.parameters) record[base + layout.parameter_offset + parameter.index] = parameter.default;
    record[base + layout.count_offset] = Math.max(...model.parameters.map(p => p.index)) + 1;
  }
  rename(program, name) {
    if (typeof name !== 'string' || !/^[\x20-\x7e]{1,16}$/.test(name) || !name.trim()) throw new Error('El nombre necesita entre 1 y 16 caracteres ASCII.');
    for (const scene of ['S1', 'S2', 'S3']) {
      const record = this.record(program), base = this.base(program, scene);
      record.fill(0, base + 106, base + 122); record.set(new TextEncoder().encode(name), base + 106);
    }
  }
  setTempo(program, scene, bpm) {
    if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240) throw new Error('BPM fuera del rango validado: 40–240.');
    const record = this.record(program), base = this.base(program, scene);
    record[base + 91] = Math.floor(bpm / 128); record[base + 92] = bpm % 128;
  }
  setDottedEighth(program, scene) {
    if (this.model(program, scene, 'DLY').id !== 2) throw new Error('Solo se validó 1/8D para Digital Delay.');
    this.record(program)[this.base(program, scene) + 65] = 212;
  }
  copyScene(program, from, to) {
    const record = this.record(program), source = this.base(program, from), destination = this.base(program, to);
    record.set(record.slice(source, source + 142), destination);
  }
  reset(program) { const index = this.presets.findIndex(p => p.program === program); this.records.set(program, this.original.slice(index * 9902, (index + 1) * 9902)); }
  exportPreset(program) {
    const record = this.record(program).slice(); readPatchFile(record);
    const index = this.presets.findIndex(p => p.program === program);
    const payload = this.original.subarray(index * 9902 + 430, (index + 1) * 9902);
    if (payload.some((value, offset) => value !== record[430 + offset])) throw new Error('Se alteró la carga IR/NAM. No se exportará.');
    return record;
  }
  exportAll() { const result = new Uint8Array(this.original.length); this.presets.forEach((p, i) => result.set(this.exportPreset(p.program), i * 9902)); return result; }
  async fingerprint(program, scene) {
    const record = this.record(program), base = this.base(program, scene), data = new Uint8Array(142 + record.length - 430);
    data.set(record.subarray(base, base + 142)); data.set(record.subarray(430), 142);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
  }
}

// UI/export evidence on firmware 6.0.5: raw 50=0 dB, 57=+2.1 dB, 60=+3 dB, 63=+3.9 dB.
export const eqDb = raw => (raw - 50) * 0.3;
export async function proposeBalance(document, program, scene, take, reference) {
  if (!validTake(take) || !validTake(reference)) return { reason: 'Falta una toma válida y su referencia.' };
  if (take.program !== program || take.scene !== scene || !take.patchFingerprint || take.patchFingerprint !== await document.fingerprint(program, scene)) return { reason: 'La medición no corresponde a esta versión de la escena. Cárgala en la NUX y vuelve a medir.' };
  if (Number.isInteger(reference.program) && document.records.has(reference.program) && reference.patchFingerprint && reference.patchFingerprint !== await document.fingerprint(reference.program, reference.scene)) return { reason: 'La referencia fue editada después de medir. Repite su medición.' };
  const result = compare(take, reference, take.offset);
  if (result.reason) return result;
  const data = document.describe(program).scenes[Number(scene[1]) - 1], eq = data.blocks.EQ;
  if (eq.modelId !== 1 || !eq.enabled) return { reason: 'El balance automático necesita 6-BAND EQ activo. Se conserva tu EQ actual.' };
  if (data.chain.indexOf('EQ') < data.chain.indexOf('AMP') || data.chain.indexOf('EQ') < data.chain.indexOf('EFX') || data.chain.indexOf('EQ') < data.chain.indexOf('CMP')) return { reason: 'El EQ debe estar después de ampli, drive y compresor para ajustar la salida.' };
  if (Math.abs(result.adjustment) > 6) return { reason: 'La diferencia supera 6 dB. Revisa entrada y referencia antes de aplicar un ajuste automático.' };
  const before = eq.parameters.find(p => p.name === 'LEVEL').value;
  const after = before + Math.round(result.adjustment / 0.3), actualDb = (after - before) * 0.3;
  if (after < 0 || after > 100) return { reason: 'El ajuste excede el rango del EQ. No se aplicará parcialmente.' };
  if (take.peakDb + actualDb >= -1) return { reason: 'No queda margen de pico suficiente. Baja la referencia y vuelve a medir.' };
  return { program, scene, before, after, actualDb, requestedDb: result.adjustment, fingerprint: take.patchFingerprint, takeId: take.id };
}
export async function applyBalance(document, proposal) {
  if (proposal.reason || proposal.fingerprint !== await document.fingerprint(proposal.program, proposal.scene)) throw new Error('La propuesta ya no corresponde a esta escena. Vuelve a medir.');
  document.setParameter(proposal.program, proposal.scene, 'EQ', 'LEVEL', proposal.after);
}
