import test from 'node:test';
import assert from 'node:assert/strict';
import { frameStats, summarize, compare, validSession } from '../meter.mjs';

const sine = amplitude => Float32Array.from({ length: 4800 }, (_, i) => amplitude * Math.sin(2 * Math.PI * 1000 * i / 48000));
const block = channels => ({ ...frameStats(channels, 'stereo'), seconds: 0.1 });
const take = (extra = {}) => ({ id: 'a', family: 'JZ', preset: '5A Clean', scene: 'S1', context: 'usb-left', input: 'MG-30', date: '2026-01-01', rmsDb: -20, peakDb: -8, activeSeconds: 10, seconds: 12, clipped: 0, processing: false, offset: 0, ...extra });

test('known sine level and opposite-phase stereo preserve power', () => {
  const wave = sine(0.5), inverse = wave.map(x => -x);
  const result = summarize([block([wave, inverse])]);
  assert.ok(Math.abs(result.rmsDb - (-9.0309)) < 0.001);
  assert.ok(Math.abs(result.peakDb - (-6.0206)) < 0.001);
});
test('gating excludes pauses but retains their duration and catches clipping', () => {
  const loud = block([sine(0.5)]), silence = block([new Float32Array(4800)]);
  const result = summarize([loud, silence, silence]);
  assert.ok(Math.abs(result.rmsDb + 9.0309) < 0.001);
  assert.equal(result.activeSeconds, 0.1);
  assert.ok(Math.abs(result.seconds - 0.3) < 0.000001);
  assert.equal(frameStats([Float32Array.of(0, 1, -1, 0.2)]).clipped, 2);
});
test('channel selection does not silently substitute missing right input', () => {
  assert.equal(frameStats([sine(0.5)], 'right'), null);
  assert.equal(frameStats([], 'left'), null);
  assert.ok(frameStats([sine(0.5)], 'stereo'));
});
test('comparison sign, solo target, and predicted headroom', () => {
  assert.equal(compare(take({ rmsDb: -24 }), take()).adjustment, 4);
  assert.equal(compare(take({ rmsDb: -18 }), take()).adjustment, -2);
  const solo = compare(take({ rmsDb: -24, peakDb: -5 }), take(), 2);
  assert.equal(solo.adjustment, 6);
  assert.equal(solo.predictedPeak, 1);
});
test('invalid comparisons refuse a misleading adjustment', () => {
  for (const change of [{ clipped: 1 }, { activeSeconds: 0 }, { context: 'other-input' }, { processing: true }, { family: 'P90' }]) {
    const result = compare(take(change), take());
    assert.ok(result.reason);
    assert.equal(result.adjustment, undefined);
  }
  assert.ok(compare(take(), null).reason);
  assert.ok(compare(take(), take({ clipped: 1 })).reason);
});
test('session validation rejects malformed files and dangling references', () => {
  assert.ok(validSession({ version: 1, takes: [take()], references: { JZ: 'a' } }));
  for (const value of [null, {}, { version: 1, takes: [take({ rmsDb: NaN })], references: {} }, { version: 1, takes: [take()], references: { JZ: 'missing' } }, { version: 1, takes: [take(), take()], references: {} }, { version: 1, takes: [take({ context: 'x'.repeat(1001) })], references: {} }]) assert.ok(!validSession(value));
});
