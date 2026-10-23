import { readPatchFile } from './patch-reader.mjs';

const $ = id => document.getElementById(id);
let entries = [];
function show() {
  const selected = entries[Number($('patchSelect').value)];
  if (!selected) return;
  $('patchSource').textContent = `${selected.source} · Archivo exportado, sin conexión MIDI. No representa cambios posteriores en la NUX.`;
  const rows = [];
  const addRow = (label, values, heading = false) => {
    const row = document.createElement('tr');
    const title = document.createElement('th'); title.scope = 'row'; title.textContent = label; row.append(title);
    const different = new Set(values).size > 1;
    for (const value of values) {
      const cell = document.createElement('td'); cell.textContent = value;
      if (heading) cell.className = 'model-cell';
      else if (different) cell.className = 'caution';
      row.append(cell);
    }
    rows.push(row);
  };
  addRow('BPM guardado', selected.scenes.map(scene => String(scene.bpm)));
  addRow('Cadena', selected.scenes.map(scene => scene.chain.join(' → ')));
  for (const name of selected.scenes[0].chain) {
    const blocks = selected.scenes.map(scene => scene.blocks[name]);
    addRow(name, blocks.map(block => `${block.enabled ? 'ON' : 'OFF'} · ${block.model}`), true);
    const labels = new Set(blocks.flatMap(block => block.parameters.map(parameter => parameter.name)));
    for (const label of labels) addRow(label, blocks.map(block => {
      const parameter = block.parameters.find(item => item.name === label);
      return parameter?.value == null ? '—' : String(parameter.value);
    }));
    if (blocks.some(block => block.subdivision)) addRow('Subdivisión', blocks.map(block => block.subdivision || 'Sin confirmar'));
  }
  $('patchRows').replaceChildren(...rows);
  $('usePatch').disabled = false;
}
function refresh() {
  $('patchSelect').replaceChildren(...entries.map((preset, index) => {
    const option = document.createElement('option'); option.value = index;
    option.textContent = `${preset.slot} ${preset.name}`; return option;
  }));
  $('patchSelect').disabled = !entries.length;
  if (entries.length) show();
}
$('patchSelect').onchange = show;
$('patchFiles').onchange = async () => {
  const files = [...$('patchFiles').files];
  if (!files.length) return;
  const imported = [], errors = [];
  for (const file of files.slice(0, 128)) {
    try {
      if (file.size > 9902 * 128) throw new Error('Archivo demasiado grande.');
      const decoded = readPatchFile(await file.arrayBuffer());
      if (imported.length + decoded.length > 128) throw new Error('Importa hasta 128 presets por vez.');
      imported.push(...decoded.map(preset => ({ ...preset, source: `${file.name} · modificado ${new Date(file.lastModified).toLocaleString()}` })));
    } catch (error) { errors.push(`${file.name}: ${error.message}`); }
  }
  if (files.length > 128) errors.push('Se procesaron solo los primeros 128 archivos.');
  if (imported.length) { entries = imported; refresh(); }
  $('patchNotice').textContent = errors.length ? errors.join(' ') : `${imported.length} presets leídos localmente. Los archivos y su audio/IR no se suben ni se modifican.`;
};
$('usePatch').onclick = () => {
  const preset = entries[Number($('patchSelect').value)];
  if (!preset) return;
  const family = /\bP90\b/i.test(preset.name) ? 'P90' : /\bJZ\b/i.test(preset.name) ? 'JZ' : $('family').value;
  $('family').value = family; $('family').dispatchEvent(new Event('change'));
  $('preset').value = `${preset.slot} ${preset.name}`;
  $('captureTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('status').textContent = 'Nombre del archivo elegido para medir. Selecciona ese mismo preset y escena manualmente en la NUX.';
};
try {
  const response = await fetch('/api/preset-snapshot');
  if (response.ok) {
    const value = await response.json();
    if (value.version === 1 && Array.isArray(value.presets) && value.presets.length <= 128) {
      entries = value.presets;
      if (entries.length) {
        refresh();
        const date = value.fileModifiedAt ? new Date(value.fileModifiedAt).toLocaleString() : 'fecha anterior';
        $('patchNotice').textContent = value.historical === false
          ? `EXPORTACIÓN CARGADA · archivo del ${date} · ${entries.length} presets. Refleja el archivo exportado, no cambios posteriores en la NUX.`
          : `RESPALDO HISTÓRICO · ${date}. Importa una exportación nueva para ver una fotografía más reciente de la pedalera.`;
      }
    }
  }
} catch { $('patchNotice').textContent = 'No se pudo cargar el respaldo local. Puedes elegir archivos exportados desde QuickTone.'; }
