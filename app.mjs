import { db, powerDb, summarize, compare, validSession } from './meter.mjs';

const $ = id => document.getElementById(id);
const names = ['CLEAN FUNK', 'ROCK', 'AMBIENT', '8D', 'POP CHORUS', 'EDGE BLUES', 'SWELL', 'BIG ROCK', 'SOFT AMB', 'OCT WORSHIP', 'TREM WORSHIP', 'SHIMMER', 'ROTARY', 'ROCK AC30', 'CRUNCH', 'LIBRE 3'];
let session = { version: 1, takes: [], references: {} };
let audio, stream, source, meter, settings, capture, countdown, snapshot, generation = 0, blocks = [], channels = 0, saving = Promise.resolve(), loading = true;
let latestId, clipUntil = 0;
let binding;
const controls = ['device', 'channel', 'family', 'preset', 'scene', 'offset', 'gate', 'confirmPatch'];
const number = value => Number.isFinite(value) && value > -119 ? value.toFixed(1) : '−∞';
const signed = value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)} dB`;
const reference = family => session.takes.find(t => t.id === session.references[family]);
const latest = () => session.takes.find(t => t.id === latestId);
function message(text) { $('status').textContent = text; }

function presets() {
  const family = $('family').value;
  $('presetOptions').replaceChildren(...names.map((name, index) => {
    const slot = `${Math.floor(index / 4) + (family === 'JZ' ? 5 : 1)}${'ABCD'[index % 4]}`;
    const option = document.createElement('option');
    option.value = `${slot} ${family} ${name}`;
    option.textContent = option.value;
    return option;
  }));
  $('preset').value = $('presetOptions').options[0].value;
}
function busy(value) {
  controls.forEach(id => $(id).disabled = value || (loading && ['family', 'preset', 'scene'].includes(id)));
  $('capture').disabled = value || !audio || channels === 0 || loading || session.takes.length >= 300;
  $('cancel').disabled = !value;
  $('connect').disabled = value;
  $('reference').disabled = value || !latest();
  if (!binding) $('confirmPatch').disabled = true;
}
function contextualSettings() {
  return JSON.stringify({ device: settings.deviceId || stream.getAudioTracks()[0].label, rate: audio.sampleRate, channel: $('channel').value, gate: Number($('gate').value), ec: settings.echoCancellation, agc: settings.autoGainControl, ns: settings.noiseSuppression });
}
function save() {
  const body = JSON.stringify(session);
  $('saveStatus').textContent = 'Guardando mediciones…';
  saving = saving.catch(() => {}).then(async () => {
    const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!response.ok) throw new Error('save');
    $('saveStatus').textContent = 'Mediciones guardadas en este computador. No se guarda audio.';
  }).catch(() => { $('saveStatus').textContent = 'No se pudo guardar en disco. Exporta CSV antes de cerrar para conservar estas mediciones.'; });
}
function recommendation(take) {
  const result = compare(take, reference(take.family), take.offset);
  if (result.reason) return result.reason;
  if (result.predictedPeak >= -1) return `${signed(result.adjustment)} llevaría los picos a ${number(result.predictedPeak)} dBFS: falta margen. Baja la referencia y repite las tomas.`;
  if (Math.abs(result.adjustment) <= 0.7) return `Parejo con el objetivo${take.offset ? ` de +${take.offset} dB` : ''}.`;
  return `${result.adjustment > 0 ? 'Subir' : 'Bajar'} el nivel de salida aproximadamente ${Math.abs(result.adjustment).toFixed(1)} dB y volver a medir.`;
}
function showResult(take) {
  if (!take) return;
  const result = compare(take, reference(take.family), take.offset);
  $('resultTitle').textContent = result.reason ? 'Revisar la toma' : Math.abs(result.adjustment) <= 0.7 ? 'Esta escena está pareja' : `${result.adjustment > 0 ? 'Subir' : 'Bajar'} ${Math.abs(result.adjustment).toFixed(1)} dB`;
  $('resultText').textContent = `${take.preset} · ${take.scene}. ${recommendation(take)}`;
  document.querySelector('.result').classList.toggle('warn', Boolean(result.reason) || result.predictedPeak >= -1);
}
function render() {
  $('referenceText').textContent = ['JZ', 'P90'].map(family => {
    const ref = reference(family);
    return `${family}: ${ref ? `${ref.preset} ${ref.scene} · ${number(ref.rmsDb)} dBFS` : 'sin referencia'}`;
  }).join(' · ');
  if (session.takes.length) {
    $('takes').replaceChildren(...[...session.takes].reverse().map(take => {
      const tr = document.createElement('tr');
      const isReference = session.references[take.family] === take.id;
      const result = compare(take, reference(take.family), take.offset);
      const label = document.createElement('td');
      label.textContent = `${take.preset} · ${take.scene}`;
      const time = document.createElement('small');
      time.textContent = `${new Date(take.date).toLocaleTimeString()} · ${take.input}`;
      label.append(time);
      tr.append(label);
      for (const value of [number(take.rmsDb), number(take.peakDb), isReference ? 'Referencia' : result.reason ? '—' : signed(result.adjustment), take.clipped ? 'CLIPPING' : take.activeSeconds < 2 ? 'Poca señal' : result.reason ? 'Revisar entrada' : result.predictedPeak >= -1 ? 'Sin margen' : 'Válida']) {
        const cell = document.createElement('td'); cell.textContent = value; tr.append(cell);
      }
      return tr;
    }));
  }
  $('reference').disabled = !latest() || Boolean(capture || countdown);
  $('export').disabled = !session.takes.length;
  showResult(latest());
}
function abort(text = 'Toma cancelada. No se guardó una medición incompleta.') {
  clearInterval(countdown); countdown = undefined; capture = undefined; blocks = [];
  busy(false); $('progressFill').style.width = '0%'; $('timer').textContent = 'Listo para otra toma';
  message(text);
}
async function disconnect(text = 'Entrada desconectada. Tus mediciones se conservan.') {
  generation++;
  if (capture || countdown) abort(text);
  const previous = audio;
  audio = undefined;
  stream?.getTracks().forEach(track => track.stop()); stream = undefined;
  source?.disconnect(); meter?.disconnect(); source = meter = undefined;
  if (previous && previous.state !== 'closed') await previous.close();
  channels = 0;
  $('capture').disabled = true; $('disconnect').disabled = true;
  $('connection').textContent = 'Entrada desconectada';
  $('rms').textContent = $('peak').textContent = '—'; $('levelMeter').value = -60;
  message(text);
}
async function devices(activeId) {
  const list = await navigator.mediaDevices.enumerateDevices();
  const selected = activeId || $('device').value;
  $('device').replaceChildren(...list.filter(device => device.kind === 'audioinput').map((device, index) => {
    const option = document.createElement('option'); option.value = device.deviceId;
    option.textContent = device.label || `Entrada ${index + 1}`; return option;
  }));
  if ([...$('device').options].some(option => option.value === selected)) $('device').value = selected;
}
async function connect() {
  const chosen = $('device').value;
  await disconnect();
  $('connect').disabled = true;
  message('Autoriza la entrada de audio en el navegador y selecciona la MG-30.');
  let candidate;
  try {
    candidate = await navigator.mediaDevices.getUserMedia({ audio: { ...(chosen ? { deviceId: { exact: chosen } } : {}), channelCount: { ideal: 2 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    stream = candidate;
    const track = stream.getAudioTracks()[0]; settings = track.getSettings();
    audio = new AudioContext();
    await audio.audioWorklet.addModule('/worklet.mjs');
    source = audio.createMediaStreamSource(stream);
    meter = new AudioWorkletNode(audio, 'preset-meter', { outputChannelCount: [1], channelInterpretation: 'discrete' });
    meter.port.postMessage({ mode: $('channel').value });
    const current = generation;
    meter.port.onmessage = event => { if (current === generation) onBlock(event.data); };
    source.connect(meter).connect(audio.destination);
    await audio.resume();
    track.addEventListener('ended', () => { if (current === generation) disconnect('Se perdió la entrada. Reconecta y verifica la referencia antes de medir.'); });
    audio.onstatechange = () => { if (current === generation && audio?.state !== 'running' && (capture || countdown)) abort('El navegador suspendió el audio. Repite esta toma.'); };
    await devices(settings.deviceId);
    const processing = ['echoCancellation', 'noiseSuppression', 'autoGainControl'].filter(key => settings[key]);
    $('inputDetails').textContent = `${track.label} · ${audio.sampleRate} Hz. ${processing.length ? 'Procesamiento activo: ' + processing.join(', ') + '. No se recomienda comparar.' : 'Se solicitó desactivar ganancia automática, cancelación de eco y reducción de ruido.'}`;
    $('connection').textContent = 'Entrada conectada';
    $('disconnect').disabled = false;
    message('Toca un poco para verificar la señal. Después mide 5A Clean Funk como referencia.');
  } catch (error) {
    candidate?.getTracks().forEach(track => track.stop());
    await disconnect();
    message(({ NotAllowedError: 'No se autorizó el audio. Permite la entrada desde el navegador y vuelve a conectar.', NotFoundError: 'No hay entrada de audio disponible. Conecta la MG-30 por USB.', NotReadableError: 'La entrada está ocupada o no responde. Revisa si otro programa la está usando en modo exclusivo.', OverconstrainedError: 'La entrada elegida ya no está disponible. Selecciona otra.' })[error.name] || `No se pudo conectar: ${error.message}`);
  } finally { $('connect').disabled = false; }
}
function onBlock(block) {
  channels = block.channels;
  $('rms').textContent = number(powerDb(block.energy / block.count));
  $('peak').textContent = number(db(block.peak));
  $('levelMeter').value = powerDb(block.energy / block.count);
  if (block.clipped) clipUntil = performance.now() + 2000;
  const clipping = performance.now() < clipUntil;
  $('clip').textContent = clipping ? 'CLIPPING' : block.peak < 0.0001 ? 'SIN SEÑAL' : 'RECIBIENDO';
  $('clip').classList.toggle('bad', clipping);
  if (!capture && !countdown) $('capture').disabled = loading || session.takes.length >= 300;
  if (!capture) return;
  blocks.push(block); capture.seconds += block.seconds;
  $('progressFill').style.width = `${Math.min(100, capture.seconds / 12 * 100)}%`;
  $('timer').textContent = `Toca el mismo riff · ${Math.max(0, Math.ceil(12 - capture.seconds))} s`;
  if (capture.seconds < 12) return;
  const take = { ...snapshot, ...summarize(blocks, snapshot.gate), id: crypto.randomUUID(), date: new Date().toISOString() };
  delete take.gate;
  session.takes.push(take); latestId = take.id; capture = undefined; blocks = [];
  busy(false); $('timer').textContent = 'Toma terminada';
  message('Toma medida. Si esta es tu referencia, pulsa «Usar última toma como referencia».');
  render(); save();
}
function startCapture() {
  if (!audio || audio.state !== 'running' || !channels) { message('Primero conecta audio y comprueba que llegue señal.'); return; }
  const gate = Number($('gate').value), offset = Number($('offset').value);
  if (!$('preset').value.trim()) { message('Escribe o selecciona el nombre del preset antes de medir.'); return; }
  if (binding && !$('confirmPatch').checked) { message('Confirma que cargaste y seleccionaste esta misma versión en la NUX antes de medir.'); return; }
  if (!Number.isFinite(gate) || gate < -80 || gate > -30 || !Number.isFinite(offset) || offset < 0 || offset > 6) { message('Revisa el umbral (−80 a −30) y el objetivo (0 a 6 dB).'); return; }
  if ($('channel').value === 'right' && channels < 2) { message('Esta entrada entrega solo un canal. Usa Izquierdo / mono.'); return; }
  if (session.takes.length >= 300) { message('La sesión llegó a 300 tomas. Exporta CSV para conservar los resultados.'); return; }
  snapshot = { family: $('family').value, preset: $('preset').value, scene: $('scene').value, offset, gate, context: contextualSettings(), input: `${stream.getAudioTracks()[0].label} · ${$('channel').selectedOptions[0].textContent}`, processing: ['echoCancellation', 'noiseSuppression', 'autoGainControl'].some(key => settings[key] === true) };
  if (binding) { snapshot.program = binding.program; snapshot.patchFingerprint = binding.patchFingerprint; }
  busy(true); blocks = []; let seconds = 3;
  $('timer').textContent = 'Prepárate… 3'; $('progressFill').style.width = '0%';
  message('Cambia al preset y escena elegidos. No muevas la consola ni la entrada USB.');
  countdown = setInterval(() => {
    seconds--;
    if (seconds > 0) { $('timer').textContent = `Prepárate… ${seconds}`; return; }
    clearInterval(countdown); countdown = undefined;
    if (audio?.state !== 'running') { abort('El audio se interrumpió. Reconecta antes de medir.'); return; }
    capture = { seconds: 0 }; blocks = []; $('timer').textContent = 'Toca el mismo riff · 12 s';
  }, 1000);
}
$('connect').onclick = connect;
$('disconnect').onclick = () => disconnect();
$('capture').onclick = startCapture;
$('cancel').onclick = () => abort();
$('device').onchange = () => { if (audio) disconnect('Entrada cambiada. Pulsa Conectar audio para usarla.'); };
$('channel').onchange = () => { channels = 0; $('capture').disabled = true; meter?.port.postMessage({ mode: $('channel').value }); message('Canal cambiado: repite la referencia con este canal.'); };
$('gate').onchange = () => message('Umbral cambiado: repite la referencia con este umbral.');
$('family').onchange = presets;
$('scene').onchange = () => $('offset').value = $('scene').value === 'S3' ? 2 : 0;
$('reference').onclick = () => {
  const take = latest(); if (!take) return;
  const check = compare(take, take);
  if (check.reason) { message(`No se puede usar esta toma: ${check.reason}`); return; }
  session.references[take.family] = take.id; render(); save();
  message(`Referencia ${take.family} fijada: ${take.preset} ${take.scene}. Mantén fija toda la cadena de entrada.`);
};
$('export').onclick = () => {
  const fields = ['family', 'preset', 'scene', 'rmsDb', 'peakDb', 'activeSeconds', 'seconds', 'clipped', 'offset', 'input', 'date'];
  const quote = value => { const text = typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? "'" + value : String(value); return `"${text.replaceAll('"', '""')}"`; };
  const lines = [['guitarra', 'preset', 'escena', 'rms_dbfs', 'pico_dbfs', 'segundos_activos', 'segundos', 'muestras_clip', 'objetivo_db', 'entrada', 'fecha', 'ajuste_db', 'observacion'].map(quote).join(',')];
  for (const take of session.takes) {
    const comparison = compare(take, reference(take.family), take.offset);
    lines.push([...fields.map(key => take[key]), comparison.reason ? '' : comparison.adjustment.toFixed(2), recommendation(take)].map(quote).join(','));
  }
  const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'quicktone-niveles.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener('beforeunload', () => stream?.getTracks().forEach(track => track.stop()));
function clearBinding() { binding = undefined; $('confirmPatch').checked = false; $('confirmPatch').disabled = true; $('bindingStatus').textContent = 'Sin versión vinculada. Prepara una medición desde el editor para usar balance automático.'; }
for (const id of ['family', 'scene', 'preset']) $(id).addEventListener(id === 'preset' ? 'input' : 'change', clearBinding);
window.addEventListener('patch-edited', () => { if (capture || countdown) abort('La versión del preset cambió durante la toma. Vuelve a medir.'); clearBinding(); });
window.addEventListener('measure-editor-scene', event => {
  if (capture || countdown) { message('Termina o cancela la toma actual antes de preparar otra escena.'); return; }
  const detail = event.detail;
  $('family').value = detail.family; presets(); $('preset').value = detail.preset; $('scene').value = detail.scene; $('offset').value = detail.scene === 'S3' ? 2 : 0;
  binding = detail; $('confirmPatch').disabled = false; $('confirmPatch').checked = false;
  $('bindingStatus').textContent = `${detail.preset} · ${detail.scene} vinculado al borrador. Confirma que esa versión está cargada en la pedalera.`;
});
presets();
try {
  const response = await fetch('/api/session');
  if (!response.ok) throw new Error('read');
  const loaded = await response.json();
  if (!validSession(loaded)) throw new Error('invalid');
  session = loaded; latestId = session.takes.at(-1)?.id; render();
} catch { message('No se pudo leer la sesión guardada. Para evitar sobrescribirla, reinicia el servidor y vuelve a abrir el medidor.'); $('connect').disabled = true; }
finally { loading = false; }
