import { app, BrowserWindow } from 'electron';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

async function run() {
const folder = await mkdtemp(path.join(tmpdir(), 'preset-studio-smoke-'));
const watchdog = setTimeout(() => { console.error('DESKTOP_SMOKE_TIMEOUT'); app.exit(1); }, 15000);
console.log('SMOKE_STAGE fixture');
process.env.PRESET_STUDIO_TEST_DIR = folder;
const data = new Uint8Array(9902);
new DataView(data.buffer).setUint32(0, 29, true);
for (let scene = 0; scene < 3; scene++) {
  const base = 4 + scene * 142;
  data.set([0, 1, 2, 3, 9, 4, 10, 6, 11, 7, 8, 5], base + 94);
  data.set(new TextEncoder().encode('JZ SMOKE'), base + 106);
  data[base + 3] = 9; data[base + 4] = 1; data[base + 28] = 42; data[base + 29] = 60;
  data.fill(50, base + 37, base + 49); data[base + 92] = 120;
}
await writeFile(path.join(folder, 'source.private.mg30patch'), data);
let code = 0;
try {
  console.log('SMOKE_STAGE main');
  await import('./main.mjs');
  const deadline = Date.now() + 8000;
  while (!BrowserWindow.getAllWindows().length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  console.log('SMOKE_STAGE window');
  const window = BrowserWindow.getAllWindows()[0]; assert.ok(window);
  if (window.webContents.isLoading()) await new Promise(resolve => window.webContents.once('did-finish-load', resolve));
  const result = await window.webContents.executeJavaScript(`(async () => {
    const deadline = Date.now() + 8000;
    while (!document.getElementById('studioEditor').dataset.ready && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    const ready = document.getElementById('studioEditor').dataset.ready;
    if (ready !== 'true') throw new Error('Editor source not loaded: ' + ready);
    if (!window.presetDesktop?.savePatch) throw new Error('Desktop preload missing');
    if (document.getElementById('view-editor').hidden || !document.getElementById('view-meter').hidden) throw new Error('Editor should be the initial workspace');
    const scenes = document.querySelectorAll('#sceneTabs button');
    if (scenes.length !== 3 || document.querySelectorAll('#presetList button').length !== 1) throw new Error('Scene/preset navigation missing');
    scenes[1].click();
    if (document.getElementById('studioScene').value !== 'S2') throw new Error('Scene card selection failed');
    document.querySelectorAll('#sceneTabs button')[0].click();
    const effect = [...document.querySelectorAll('#studioChain button')].find(button => button.querySelector('strong').textContent === 'EQ');
    effect.click();
    if (document.getElementById('studioBlock').value !== 'EQ') throw new Error('Effect selection failed');
    [...document.querySelectorAll('#studioChain button')].find(button => button.querySelector('strong').textContent === 'AMP').click();
    if (document.getElementById('effectRecipe').options.length !== 3) throw new Error('Amp suggestions missing');
    if (document.querySelectorAll('#studioChain svg').length !== 12 || !document.querySelector('#gearPreview svg')) throw new Error('Gear illustrations missing');
    const fakePort = { id: 'smoke-nux', name: 'NUX MG-30', state: 'connected', async open() {}, async close() {} };
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async options => {
      if (options.sysex) throw new Error('SysEx should never be requested');
      return { inputs: new Map([['smoke-nux', fakePort]]) };
    }});
    document.getElementById('followMidi').click(); await new Promise(resolve => setTimeout(resolve, 30));
    fakePort.onmidimessage({ data: [0xc0, 29] }); fakePort.onmidimessage({ data: [0xb0, 0x50, 1] });
    if (document.getElementById('studioScene').value !== 'S2' || document.getElementById('scene').value !== 'S2') throw new Error('MIDI scene following failed');
    if (!document.getElementById('confirmPatch').disabled) throw new Error('MIDI must not confirm patch version');
    document.getElementById('followMidi').click(); await new Promise(resolve => setTimeout(resolve, 30));
    if (fakePort.onmidimessage !== null) throw new Error('MIDI disconnect failed');
    document.querySelectorAll('#sceneTabs button')[0].click();
    document.getElementById('applyEffectRecipe').click();
    if (document.querySelector('input[aria-label="GAIN valor"]').value !== '22') throw new Error('Recipe not applied');
    document.getElementById('undoEffectRecipe').click();
    if (document.querySelector('input[aria-label="GAIN valor"]').value !== '42') throw new Error('Recipe undo failed');
    document.getElementById('studioReset').click();
    const gain = document.querySelector('input[aria-label="GAIN valor"]');
    if (!gain || gain.value !== '42') throw new Error('Gain not decoded');
    gain.value = '47'; gain.dispatchEvent(new Event('change'));
    if (!document.getElementById('studioStatus').textContent.includes('Borrador')) throw new Error('Editor event failed');
    document.getElementById('studioReset').click();
    if (document.querySelector('input[aria-label="GAIN valor"]').value !== '42') throw new Error('Reset failed');
    document.getElementById('studioMeasure').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    if (document.getElementById('confirmPatch').disabled || document.getElementById('preset').value !== '08B JZ SMOKE') throw new Error('Measurement binding failed');
    if (document.getElementById('view-meter').hidden) throw new Error('Prepare measurement should open meter');
    document.querySelector('[data-view="editor"]').click();
    const { PatchDocument } = await import('/patch-editor.mjs');
    const response = await fetch('/api/patch-source'); const binary = new Uint8Array(await response.arrayBuffer());
    const draft = new PatchDocument(binary); draft.setParameter(29, 'S2', 'AMP', 'GAIN', 46);
    if (draft.exportPreset(29)[174] !== 46) throw new Error('Export did not preserve edited scene');
    const audio = new AudioContext(); await audio.audioWorklet.addModule('/worklet.mjs');
    const osc = audio.createOscillator(), node = new AudioWorkletNode(audio, 'preset-meter');
    const sample = new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Audio worklet timeout')), 3000); node.port.onmessage = event => { if (event.data.energy > 0) { clearTimeout(timeout); resolve(event.data); } }; });
    osc.connect(node).connect(audio.destination); osc.start(); await audio.resume(); await sample; osc.stop(); await audio.close();
    document.querySelector('[data-view="editor"]').click(); window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 150));
    return { editor: true, preload: true, binding: true, writer: true, audioWorklet: true, midiFollow: true, gearArt: true };
  })()`, true);
  console.log('DESKTOP_SMOKE_OK ' + JSON.stringify(result));
  if (process.env.PRESET_STUDIO_SCREENSHOT) await writeFile(process.env.PRESET_STUDIO_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
} catch (error) { console.error('DESKTOP_SMOKE_FAILED ' + error.stack); code = 1; }
finally {
  clearTimeout(watchdog);
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  // Give Chromium a chance to release profile handles on Windows.
  await new Promise(resolve => setTimeout(resolve, 250));
  if (path.resolve(folder).startsWith(path.join(tmpdir(), 'preset-studio-smoke-'))) await rm(folder, { recursive: true, force: true }).catch(() => {});
  app.exit(code);
}
}
app.whenReady().then(run).catch(error => { console.error(error); app.exit(1); });
