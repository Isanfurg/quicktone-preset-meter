import catalog from './patch-catalog.mjs';
import { PatchDocument, proposeBalance, applyBalance, eqDb } from './patch-editor.mjs';
import { suggestions, applyRecipe } from './effect-recipes.mjs';

const $ = id => document.getElementById(id);
let documentDraft, proposals = [], unsaved = new Set();
let recipeUndo;
const program = () => Number($('studioPreset').value);
const scene = () => $('studioScene').value;
const note = text => $('studioStatus').textContent = text;
const selected = () => documentDraft.describe(program());
function setView(name) {
  for (const view of document.querySelectorAll('.workspace-view')) view.hidden = view.id !== `view-${name}`;
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === name));
}
for (const button of document.querySelectorAll('[data-view]')) button.onclick = () => setView(button.dataset.view);
const blockNames = { CMP: 'Compresor', EFX: 'Drive', AMP: 'Amplificador', IR: 'Cabina / IR', EQ: 'Ecualizador', MOD: 'Modulación', DLY: 'Delay', RVB: 'Reverb', NR: 'Noise gate' };
function showNavigation() {
  const preset = selected(), current = preset.scenes[Number(scene()[1]) - 1];
  $('presetHeading').textContent = `${preset.slot} ${preset.name}`;
  for (const button of $('presetList').children) {
    const active = Number(button.dataset.program) === program();
    button.setAttribute('aria-pressed', String(active));
    if (active) button.textContent = `${preset.slot}  ${preset.name}${unsaved.has(program()) ? ' •' : ''}`;
  }
  $('sceneTabs').replaceChildren(...['S1', 'S2', 'S3'].map((name, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'scene-tab'; button.setAttribute('aria-pressed', String(name === scene()));
    const title = document.createElement('strong'); title.textContent = `${name} · Escena ${index + 1}`;
    const detail = document.createElement('small');
    detail.textContent = preset.scenes[index].chain.filter(key => preset.scenes[index].blocks[key]?.enabled).join(' · ');
    button.append(title, detail);
    button.onclick = () => { $('studioScene').value = name; showScene(); };
    return button;
  }));
  $('studioChain').replaceChildren(...current.chain.map(name => {
    const block = current.blocks[name], button = document.createElement('button'); button.type = 'button';
    button.className = `effect-block${block?.enabled ? '' : ' bypassed'}`;
    button.setAttribute('aria-pressed', String(name === $('studioBlock').value));
    const title = document.createElement('strong'); title.textContent = name;
    const model = document.createElement('small'); model.textContent = block?.model || name;
    const state = document.createElement('span'); state.textContent = block?.enabled ? '● ACTIVO' : '○ BYPASS';
    button.append(title, model, state);
    button.onclick = () => { $('studioBlock').value = name; showParameters(); };
    return button;
  }));
}
// Keep the existing validated controls; only move them into an editor workspace.
const sidebar = document.createElement('aside'); sidebar.className = 'preset-sidebar';
const libraryTitle = document.createElement('h2'); libraryTitle.textContent = 'Mis presets';
const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Buscar preset…'; search.setAttribute('aria-label', 'Buscar preset');
const list = document.createElement('div'); list.id = 'presetList'; list.className = 'preset-list';
search.oninput = () => { for (const button of list.children) button.hidden = !button.textContent.toLowerCase().includes(search.value.toLowerCase()); };
sidebar.append(libraryTitle, search, list);
$('view-editor').prepend(sidebar);
const heading = document.createElement('h2'); heading.id = 'presetHeading'; heading.textContent = 'Abre tu banco de presets';
$('studioTitle').replaceWith(heading);
$('studioEditor').setAttribute('aria-labelledby', 'presetHeading');
const presetSettings = document.createElement('details'); presetSettings.className = 'preset-settings';
const settingsTitle = document.createElement('summary'); settingsTitle.textContent = 'Nombre y tempo del preset';
presetSettings.append(settingsTitle, document.querySelector('.editor-name'));
$('sceneTabs').before(presetSettings);
const recipePanel = document.createElement('section'); recipePanel.className = 'recipe-panel';
const recipeTitle = document.createElement('h3'); recipeTitle.textContent = 'Puntos de partida';
const recipeSelect = document.createElement('select'); recipeSelect.id = 'effectRecipe'; recipeSelect.setAttribute('aria-label', 'Sugerencia de sonido');
const recipeDescription = document.createElement('p'); recipeDescription.className = 'small';
const recipeValues = document.createElement('p'); recipeValues.className = 'recipe-values small';
const recipeActions = document.createElement('div'); recipeActions.className = 'actions';
const recipeApply = document.createElement('button'); recipeApply.id = 'applyEffectRecipe'; recipeApply.textContent = 'Aplicar a esta escena';
const recipeBack = document.createElement('button'); recipeBack.id = 'undoEffectRecipe'; recipeBack.className = 'secondary'; recipeBack.textContent = 'Deshacer sugerencia';
recipeActions.append(recipeApply, recipeBack);
recipePanel.append(recipeTitle, recipeSelect, recipeDescription, recipeValues, recipeActions);
$('studioParameters').after(recipePanel);
function showSuggestions() {
  const block = $('studioBlock').value, model = selected().scenes[Number(scene()[1]) - 1].blocks[block];
  const items = suggestions(block, model.modelId);
  recipeSelect.replaceChildren(...items.map(item => new Option(item.title, item.id)));
  recipeSelect.hidden = recipeApply.hidden = !items.length;
  const preview = () => {
    const item = items.find(item => item.id === recipeSelect.value);
    const target = catalog.models.find(m => m.block === block && m.id === item?.model);
    const guides = { WAH: 'Wah: deja bypass para sonidos normales y actívalo para frases expresivas. El recorrido y la asignación del pedal se configuran en QuickTone.', IR: 'Cabina / IR: compara usando el mismo riff y volumen. El carácter depende del IR cargado; conserva el recurso original y cambia sus controles especiales desde QuickTone.', SR: 'Send / Return: úsalo solo si tienes equipo conectado al loop. Revisa los niveles de envío y retorno en QuickTone.', VOL: 'Pedal de volumen: antes del delay y la reverb permite swells con colas; después recorta también las colas. Configura recorrido y posición en QuickTone.' };
    recipeDescription.textContent = item?.description || guides[block] || 'Este modelo no tiene una receta validada. Conserva sus ajustes y revisa sus controles en QuickTone.';
    recipeValues.textContent = item ? `${target.name} · ${Object.entries(item.values).map(([key, value]) => `${key} ${value}`).join(' · ')}${item.dotted ? ' · 1/8D' : ''}. ${item.model !== model.modelId ? 'Cambia el modelo y carga sus valores base; ' : ''}activa el bloque únicamente en ${scene()}. Valores brutos, no ms ni dB; vuelve a medir el volumen.` : '';
  };
  recipeSelect.onchange = preview; preview();
  recipeBack.disabled = !recipeUndo;
}
recipeApply.onclick = () => attempt(() => {
  const before = documentDraft.exportPreset(program()), targetProgram = program();
  const item = applyRecipe(documentDraft, targetProgram, scene(), $('studioBlock').value, recipeSelect.value);
  changed(); recipeUndo = { program: targetProgram, before }; recipeBack.disabled = false;
  note(`${item.title} aplicado a ${scene()} en el borrador. Exporta a QuickTone y comprueba tono y volumen.`);
});
recipeBack.onclick = () => attempt(() => {
  if (!recipeUndo) return;
  const undo = recipeUndo; documentDraft.records.set(undo.program, undo.before);
  $('studioPreset').value = undo.program; changed(); note('Sugerencia deshecha. Se conservaron los ajustes anteriores.');
});
function changed(redraw = true) {
  recipeUndo = undefined; recipeBack.disabled = true;
  unsaved.add(program()); proposals = []; $('studioApplyBalance').disabled = true;
  const preset = selected();
  $('studioPreset').selectedOptions[0].textContent = `${preset.slot} ${preset.name} · editado`;
  window.dispatchEvent(new CustomEvent('patch-edited', { detail: preset }));
  note('Borrador actualizado. Exporta una copia e impórtala en QuickTone para escuchar los cambios.');
  if (redraw) showScene(); else showNavigation();
}
function attempt(action) { try { action(); } catch (error) { note(error.message); } }
function showParameters() {
  showNavigation();
  const blockName = $('studioBlock').value, block = selected().scenes[Number(scene()[1]) - 1].blocks[blockName];
  const metadata = catalog.models.find(model => model.block === blockName && model.id === block.modelId);
  $('blockTitle').textContent = `${blockNames[blockName] || blockName} · ${block.model}`;
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
  showSuggestions();
}
function showScene() {
  const preset = selected(), current = preset.scenes[Number(scene()[1]) - 1];
  $('studioName').value = preset.name; $('studioBpm').value = current.bpm;
  const previous = $('studioBlock').value;
  $('studioBlock').replaceChildren(...current.chain.map(name => new Option(name, name)));
  $('studioBlock').value = current.chain.includes(previous) ? previous : 'AMP';
  showParameters();
}
async function load(bytes, source) {
  const next = new PatchDocument(bytes);
  if (unsaved.size && !window.confirm('Hay cambios sin exportar. ¿Descartarlos y abrir este archivo?')) return;
  documentDraft = next; unsaved = new Set(); proposals = [];
  recipeUndo = undefined;
  $('studioFields').disabled = false;
  $('studioPreset').replaceChildren(...next.presets.map(preset => new Option(`${preset.slot} ${preset.name}`, preset.program)));
  list.replaceChildren(...next.presets.map(preset => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.program = preset.program;
    button.textContent = `${preset.slot}  ${preset.name}`;
    button.onclick = () => { $('studioPreset').value = preset.program; showScene(); };
    return button;
  }));
  search.value = '';
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
$('studioReset').onclick = () => attempt(() => { documentDraft.reset(program()); recipeUndo = undefined; unsaved.delete(program()); proposals = []; $('studioApplyBalance').disabled = true; showScene(); window.dispatchEvent(new CustomEvent('patch-edited', { detail: selected() })); note('Preset restaurado al archivo original.'); });
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
    setView('meter');
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
