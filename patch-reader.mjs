import catalog from './patch-catalog.mjs';

// Read-only port of the already validated local PresetLab file layout.
// shortcut: only the observed 9902-byte record format is supported; require a new fixture before accepting another firmware layout.
export function readPatchFile(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { recordSize, sceneSize, layout, models } = catalog;
  if (bytes.length !== recordSize && bytes.length !== recordSize * 128) throw new Error(`Formato no compatible: ${bytes.length} bytes. Se admite un preset de ${recordSize} bytes o un banco completo de 128.`);
  const presets = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byPosition = Object.fromEntries(Object.entries(layout).map(([name, block]) => [block.model_offset, name]));
  for (let record = 0; record < bytes.length; record += recordSize) {
    const program = view.getUint32(record, true);
    if (program >= 128) throw new Error('Cabecera de preset no válida.');
    const scenes = [];
    for (let sceneIndex = 0; sceneIndex < 3; sceneIndex++) {
      const data = bytes.subarray(record + 4 + sceneIndex * sceneSize, record + 4 + (sceneIndex + 1) * sceneSize);
      const order = Array.from(data.subarray(94, 106));
      if (new Set(order).size !== 12 || order.some(value => value > 11)) throw new Error(`Cadena de S${sceneIndex + 1} no compatible. No se interpretaron sus parámetros.`);
      const nameBytes = Array.from(data.subarray(106, 122));
      const end = nameBytes.indexOf(0);
      const visibleName = end < 0 ? nameBytes : nameBytes.slice(0, end);
      if (!visibleName.length || visibleName.some(value => value < 32 || value > 126)) throw new Error('Nombre de preset no compatible con este formato.');
      const scene = { scene: `S${sceneIndex + 1}`, name: String.fromCharCode(...visibleName).trim(), bpm: data[91] * 128 + data[92], chain: order.map(id => byPosition[id]), blocks: {} };
      for (const [name, block] of Object.entries(layout)) {
        const rawSwitch = data[block.model_offset], modelId = rawSwitch & 63;
        const model = models.find(value => value.block === name && value.id === modelId);
        const raw = Array.from(data.subarray(block.parameter_offset, block.parameter_offset + block.capacity));
        scene.blocks[name] = { modelId, model: model?.name || `Modelo ${modelId} · sin mapear`, enabled: !(rawSwitch & 64), parameters: model ? model.parameters.map(parameter => ({ name: parameter.name, value: raw[parameter.index] ?? null })) : raw.map((value, index) => ({ name: `RAW ${index + 1}`, value })) };
        if (name === 'DLY' && modelId === 2 && [4, 212].includes(raw[3])) scene.blocks[name].subdivision = '1/8 con puntillo · codificación observada; confirmar TAP en la pedalera';
      }
      scenes.push(scene);
    }
    presets.push({ slot: `${String(Math.floor(program / 4) + 1).padStart(2, '0')}${'ABCD'[program % 4]}`, program, name: scenes[0].name, scenes });
  }
  return presets;
}
