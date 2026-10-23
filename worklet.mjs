import { frameStats } from './meter.mjs';

class PresetMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.mode = 'left';
    this.reset();
    this.port.onmessage = event => { this.mode = event.data.mode; this.reset(); };
  }
  reset() { this.block = { energy: 0, count: 0, peak: 0, clipped: 0, frames: 0 }; }
  process(inputs) {
    const channels = inputs[0];
    const stats = channels?.length ? frameStats(channels, this.mode) : null;
    if (!stats) return true;
    this.block.energy += stats.energy;
    this.block.count += stats.count;
    this.block.frames += stats.frames;
    this.block.clipped += stats.clipped;
    this.block.peak = Math.max(this.block.peak, stats.peak);
    if (this.block.frames >= sampleRate * 0.02) {
      this.port.postMessage({ ...this.block, seconds: this.block.frames / sampleRate, channels: channels.length });
      this.reset();
    }
    // No audio is copied to the output: this meter never monitors the guitar.
    return true;
  }
}
registerProcessor('preset-meter', PresetMeter);
