import catalog from './patch-catalog.mjs';
import { PatchDocument, proposeBalance, applyBalance, eqDb } from './patch-editor.mjs';

const $ = id => document.getElementById(id);
let documentDraft, proposals = [], unsaved = new Set();
const program = () => Number($('studioPreset').value);
const scene = () => $('studioScene').value;
const note = text => $('studioStatus').textContent = text;
const selected = () => documentDraft.describe(program());
function changed(redraw = true) {
  unsaved.add(program()); proposals = []; $('studioApplyBalance').disabled = true;
  const preset = selected();
  $('studioPreset').selectedOptions[0].textContent = `${preset.slot} ${preset.name} · editado`;
  window.dispatchEvent(new CustomEvent('patch-edited', { detail: preset }));
  note('Borrador actualizado. Exporta una copia e impórtala en QuickTone para escuchar los cambios.');
  if (redraw) showScene();
}
function attempt(action) { try { action(); } catch (error) { note(error.message); } }
function showParameters() {
  const blockName = $('studioBlock').value, block = selected().scenes[Number(scene()[1]) - 1].blocks[blockName];
  const metadata = catalog.models.find(model => model.block === blockName && model.id === block.modelId);
  $('studioEnabled').checked = block.enabled;
  const options = catalog.models.filter(model => model.block === blockName && Number.isInteger(model.id) && model.id >= 1 && model.id <= 63 && !model.special && model.parameters.length && model.parameters.every(p => p.editable && p.index < catalog.layout[blockName].capacity && p.default >= p.min && p.default <= p.max));
  if (!options.some(model => model.id === block.modelId)) options.unshift({ id: block.modelId, name: `${block.model} · conservar controles especiales` });
  $('studioModel').replaceChildren(...options.map(model => { const option = new Option(model.name, model.id); option.selected = model.id === block.modelId; return option; }));
  $('studioDotted').disabled = !(blockName === 'DLY' && block.modelId === 2);
  $('studioParameters').replaceChildren(...block.parameters.map(parameter => {
    const row = document.createElement('label'); row.className = 'parameter-row';
    const title = document.createElement('span'); title.textContent = parameter.name;
    const spec = metadata?.parameters.find(p => p.name === parameter.name);
    const valid = spec?.editable && parameter.value >= spec.min && parameter.value <= spec.max;
    const range = document.createElement('input'); range.type = 'range'; range.min = spec?.min ?? 0; range.max = spec?.max ?? 255; range.step = 1; range.value = parameter.value ?? 0; range.disabled = !valid; range.setAttribute('aria-label', parameter.name);
    const value = document.createElement('input'); value.type = 'number'; value.min = range.min; value.max = range.max; value.step = 1; value.value = parameter.value ?? 0; value.disabled = !valid; value.setAttribute('aria-label', `${parameter.name} valor`);
    const detail = document.createElement('small');
    const describe = raw => detail.textContent = blockName === 'EQ' && block.modelId === 1 ? `${eqDb(raw).toFixed(1)} dB` : valid ? 'valor del preset' : 'solo lectura';
    describe(parameter.value);
    range.oninput = () => { value.value = range.value; describe(Number(range.value)); };
    range.onchange = () => attempt(() => { documentDraft.setParameter(program(), scene(), blockName, parameter.name, Number(range.value)); changed(false); });
    value.onchange = () => attempt(() => { documentDraft.setParameter(program(), scene(), blockName, parameter.name, Number(value.value)); range.value = value.value; describe(Number(value.value)); changed(false); });
    row.append(title, range, value, detail); return row;
  }));
}
function showScene() {
  const preset = selected(), current = preset.scenes[Number(scene()[1]) - 1];
  $('studioName').value = preset.name; $('studioBpm').value = current.bpm;
  const previous = $('studioBlock').value;
  $('studioBlock').replaceChildren(...current.chain.map(name => new Option(name, name)));
  $('studioBlock').value = current.chain.includes(previous) ? previous : 'AMP';
  $('studioChain').textContent = current.chain.join(' → ');
  showParameters();
}
async function load(bytes, source) {
  const next = new PatchDocument(bytes);
  if (unsaved.size && !window.confirm('Hay cambios sin exportar. ¿Descartarlos y abrir este archivo?')) return;
  documentDraft = next; unsaved = new Set(); proposals = [];
  $('studioFields').disabled = false;
  $('studioPreset').replaceChildren(...next.presets.map(preset => new Option(`${preset.slot} ${preset.name}`, preset.program)));
  $('studioSource').textContent = `${source} · ${next.presets.length} presets. Borrador local: no se conecta por MIDI.`;
  $('studioExportBank').disabled = next.presets.length !== 128;
  $('studioApplyBalance').disabled = true;
  showScene();
  window.dispatchEvent(new CustomEvent('patch-edited', { detail: selected() }));
  note('Archivo cargado. Los originales y sus recursos IR/NAM se conservan al exportar una copia.');
  $('studioEditor').dataset.ready = 'true';
}
$('studioFile').onchange = async () => {
  const file = $('studioFile').files[0]; if (!file) return;
  try { if (file.size > 9902 * 128) throw new Error('Archivo demasiado grande.'); await load(new Uint8Array(await file.arrayBuffer()), file.name); }
  catch (error) { note(error.message); }
};
$('studioPreset').onchange = () => { showScene(); note('Selecciona la escena y el bloque a editar.'); };
$('studioScene').onchange = showScene;
$('studioBlock').onchange = showParameters;
$('studioEnabled').onchange = () => attempt(() => { documentDraft.setEnabled(program(), scene(), $('studioBlock').value, $('studioEnabled').checked); changed(false); });
$('studioModel').onchange = () => attempt(() => { documentDraft.setModel(program(), scene(), $('studioBlock').value, Number($('studioModel').value)); changed(); });
$('studioRename').onclick = () => attempt(() => { documentDraft.rename(program(), $('studioName').value); changed(); });
$('studioTempo').onclick = () => attempt(() => { documentDraft.setTempo(program(), scene(), Number($('studioBpm').value)); changed(false); });
$('studioDotted').onclick = () => attempt(() => { documentDraft.setDottedEighth(program(), scene()); changed(); note('1/8D aplicado al Digital Delay. Confirma en la NUX que TAP siga el pulso correctamente.'); });
$('studioCopy').onclick = () => attempt(() => { documentDraft.copyScene(program(), scene(), $('studioCopyTo').value); changed(); });
$('studioReset').onclick = () => attempt(() => { documentDraft.reset(program()); unsaved.delete(program()); proposals = []; $('studioApplyBalance').disabled = true; showScene(); window.dispatchEvent(new CustomEvent('patch-edited', { detail: selected() })); note('Preset restaurado al archivo original.'); });
async function exportBytes(bytes, name) {
  if (window.presetDesktop) return window.presetDesktop.savePatch(bytes, name);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true, name };
}
async function exportDraft(bank) {
  try {
    const preset = selected(), bytes = bank ? documentDraft.exportAll() : documentDraft.exportPreset(program());
    const name = bank ? 'MG30_BANCO_EDITADO.mg30patch' : `${preset.slot} ${preset.name.replace(/[^A-Za-z0-9 _-]/g, '_')}_EDITADO.mg30patch`;
    const result = await exportBytes(bytes, name);
    if (result.saved) { if (bank) unsaved.clear(); else unsaved.delete(program()); note(`Copia exportada: ${result.name}. Impórtala con QuickTone y vuelve a medir antes de dar el balance por terminado.`); }
  } catch (error) { note(error.message); }
}
$('studioExportPreset').onclick = () => exportDraft(false);
$('studioExportBank').onclick = () => exportDraft(true);
$('studioMeasure').onclick = async () => {
  try {
    const preset = selected();
    window.dispatchEvent(new CustomEvent('measure-editor-scene', { detail: { program: program(), scene: scene(), preset: `${preset.slot} ${preset.name}`, family: /\bP90\b/i.test(preset.name) ? 'P90' : /\bJZ\b/i.test(preset.name) ? 'JZ' : $('family').value, patchFingerprint: await documentDraft.fingerprint(program(), scene()) } }));
    $('captureTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) { note(error.message); }
};
$('studioPropose').onclick = async () => {
  try {
    const response = await fetch('/api/session'); if (!response.ok) throw new Error('No se pudieron leer las mediciones guardadas.');
    const session = await response.json(), latest = new Map();
    for (const take of session.takes) if (documentDraft.records.has(take.program)) latest.set(`${take.program}:${take.scene}`, take);
    const rows = []; proposals = [];
    for (const take of latest.values()) {
      const reference = session.takes.find(item => item.id === session.references[take.family]);
      const proposal = take.id === reference?.id ? { reason: 'Referencia: se conserva.' } : await proposeBalance(documentDraft, take.program, take.scene, take, reference);
      const row = document.createElement('tr'), preset = documentDraft.describe(take.program);
      for (const text of [`${preset.slot} ${preset.name} · ${take.scene}`, proposal.reason || `${eqDb(proposal.before).toFixed(1)} → ${eqDb(proposal.after).toFixed(1)} dB`, proposal.reason ? 'Sin cambio' : `${proposal.actualDb >= 0 ? '+' : ''}${proposal.actualDb.toFixed(1)} dB`]) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }
      rows.push(row); if (!proposal.reason) proposals.push(proposal);
    }
    if (!rows.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 3; cell.textContent = 'Mide escenas desde «Preparar medición» del editor y fija una referencia. Las tomas antiguas sin versión de preset no se aplican automáticamente.'; row.append(cell); rows.push(row); }
    $('studioBalanceRows').replaceChildren(...rows); $('studioApplyBalance').disabled = !proposals.length;
    note(`${proposals.length} propuestas listas. Revisa la tabla antes de aplicarlas al borrador.`);
  } catch (error) { note(error.message); }
};
$('studioApplyBalance').onclick = async () => {
  const pending = proposals.slice(); let count = 0;
  try {
    for (const proposal of pending) { await applyBalance(documentDraft, proposal); unsaved.add(proposal.program); count++; }
    showScene(); proposals = []; $('studioApplyBalance').disabled = true;
    window.dispatchEvent(new CustomEvent('patch-edited', { detail: selected() }));
    note(`${count} escenas ajustadas en el borrador. Exporta, importa en QuickTone y vuelve a medir: todavía no cambiaron en la NUX.`);
  } catch (error) { note(`${count} propuestas aplicadas. ${error.message}`); }
};
window.addEventListener('beforeunload', event => { if (unsaved.size) { event.preventDefault(); event.returnValue = ''; } });
try {
  const response = await fetch('/api/patch-source');
  if (response.ok) await load(new Uint8Array(await response.arrayBuffer()), 'Tu exportación privada precargada');
  else $('studioEditor').dataset.ready = 'empty';
} catch (error) { note(`Abre un archivo exportado para comenzar. ${error.message}`); $('studioEditor').dataset.ready = 'empty'; }
