import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMidi, followMidi } from '../midi-follow.mjs';

test('MG-30 observed program and scene messages decode without guessing other controls', () => {
  assert.deepEqual(decodeMidi([0xc0, 7]), { program: 7 });
  assert.deepEqual(decodeMidi(new Uint8Array([0xb0, 0x50, 2])), { scene: 'S3' });
  for (const data of [[0xb0, 0x50, 3], [0xb0, 0x51, 0], [0xc0, 128], [0xc1, 7], [0xb1, 0x50, 0], [0xc0], [0xc0, -1], [0xf0, 0x43, 0x58, 0xf7]]) assert.equal(decodeMidi(data), undefined);
});
test('MIDI follower opens only one NUX input, handles disconnect and releases listeners', async () => {
  let opened = 0, closed = 0, options;
  const input = { id: 'nux', name: 'NUX MG-30 MIDI IN', state: 'connected', async open() { opened++; }, async close() { closed++; } };
  const other = { id: 'keys', name: 'Keyboard', state: 'connected', open() { throw Error('Wrong input'); } };
  const access = { inputs: new Map([['nux', input], ['keys', other]]), get outputs() { throw Error('Outputs must not be accessed'); } };
  const received = [], states = [];
  const stop = await followMidi(value => received.push(value), text => states.push(text), async value => { options = value; return access; });
  assert.deepEqual(options, { sysex: false, software: false }); assert.equal(opened, 1);
  input.onmidimessage({ data: [0xc0, 8] }); input.onmidimessage({ data: [0xb0, 0x50, 1] });
  assert.deepEqual(received, [{ program: 8 }, { scene: 'S2' }]);
  input.state = 'disconnected'; access.onstatechange(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, 1); assert.equal(input.onmidimessage, null); assert.match(states.at(-1), /desconectada/);
  input.state = 'connected'; access.onstatechange(); await new Promise(resolve => setImmediate(resolve)); assert.equal(opened, 2);
  await stop(); assert.equal(closed, 2); assert.equal(access.onstatechange, null); assert.equal(input.onmidimessage, null);
});
test('ambiguous MIDI inputs are not automatically selected', async () => {
  const port = id => ({ id, name: 'NUX MG-30', state: 'connected', open() { throw Error('Ambiguous port opened'); } });
  const access = { inputs: new Map([['a', port('a')], ['b', port('b')]]) }, states = [];
  const stop = await followMidi(() => {}, text => states.push(text), async () => access);
  assert.match(states[0], /varias/); await stop();
});
