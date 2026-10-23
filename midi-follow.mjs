// Observed on MG-30 firmware 6.0.5: C0 pp and B0 50 ss (scene 0..2).
export function decodeMidi(data) {
  if (!data || !Array.from(data).every(n => Number.isInteger(n) && n >= 0 && n <= 255)) return;
  if (data.length === 2 && data[0] === 0xc0 && data[1] < 128) return { program: data[1] };
  if (data.length === 3 && data[0] === 0xb0 && data[1] === 0x50 && data[2] <= 2) return { scene: `S${data[2] + 1}` };
}
export async function followMidi(receive, status, request = options => navigator.requestMIDIAccess(options)) {
  const access = await request({ sysex: false, software: false });
  let active, stopped = false;
  const attach = async () => {
    if (stopped) return;
    const ports = [...access.inputs.values()].filter(port => /NUX|MG-?30/i.test(port.name || '') && port.state === 'connected');
    if (ports.length !== 1) {
      if (active) { active.onmidimessage = null; await active.close(); active = undefined; }
      status(ports.length ? 'Hay varias entradas NUX. Conecta solo una MG-30.' : 'NUX desconectada. Esperando entrada MIDI…'); return;
    }
    if (active?.id === ports[0].id) return;
    if (active) { active.onmidimessage = null; await active.close(); }
    active = ports[0];
    active.onmidimessage = event => { const decoded = decodeMidi(event.data); if (decoded && !stopped) receive(decoded); };
    await active.open();
    status('MIDI conectado. Cambia de preset y escena en la NUX para identificarlos.');
  };
  access.onstatechange = () => { attach().catch(error => status(`MIDI: ${error.message}`)); };
  try { await attach(); } catch (error) { access.onstatechange = null; if (active) { active.onmidimessage = null; await active.close(); } throw error; }
  // No outputs are opened and no MIDI/SysEx messages are sent.
  return async () => { stopped = true; access.onstatechange = null; if (active) { active.onmidimessage = null; await active.close(); } };
}
