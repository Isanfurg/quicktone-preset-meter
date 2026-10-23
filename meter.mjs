export const db = (amplitude) => amplitude > 0 ? 20 * Math.log10(amplitude) : -120;
export const powerDb = (power) => power > 0 ? 10 * Math.log10(power) : -120;

// Stereo uses mean channel power; opposite-phase channels must not cancel.
export function frameStats(channels, mode = 'left') {
  const selected = mode === 'stereo' ? channels.slice(0, 2) : [channels[mode === 'right' ? 1 : 0]];
  if (!selected.length || selected.some(channel => !channel?.length)) return null;
  let energy = 0, peak = 0, clipped = 0;
  for (const channel of selected) {
    for (const sample of channel) {
      energy += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if (Math.abs(sample) >= 0.999) clipped++;
    }
  }
  const count = selected.reduce((sum, channel) => sum + channel.length, 0);
  return { energy, count, peak, clipped, frames: selected[0].length };
}

export function summarize(blocks, gateDb = -55) {
  let energy = 0, count = 0, peak = 0, clipped = 0, activeSeconds = 0, seconds = 0;
  for (const block of blocks) {
    peak = Math.max(peak, block.peak);
    clipped += block.clipped;
    seconds += block.seconds;
    if (powerDb(block.energy / block.count) >= gateDb) {
      energy += block.energy;
      count += block.count;
      activeSeconds += block.seconds;
    }
  }
  return { rmsDb: powerDb(count ? energy / count : 0), peakDb: db(peak), clipped, activeSeconds, seconds };
}

export function compare(take, reference, offset = 0) {
  if (!reference) return { reason: 'Falta medir y marcar una referencia.' };
  if (take.family !== reference.family) return { reason: 'Usa una referencia de la misma guitarra.' };
  if (take.context !== reference.context) return { reason: 'Cambió la entrada, el canal o el umbral. Repite la referencia.' };
  if (take.activeSeconds < 2 || reference.activeSeconds < 2) return { reason: 'Se necesitan al menos 2 segundos de señal sobre el umbral.' };
  if (take.clipped || reference.clipped) return { reason: 'Hay clipping. Baja la entrada o salida y vuelve a medir también la referencia.' };
  if (take.processing || reference.processing) return { reason: 'La entrada aplica procesamiento automático. Desactívalo y repite la referencia.' };
  const adjustment = reference.rmsDb + offset - take.rmsDb;
  return { adjustment, headroom: -take.peakDb, predictedPeak: take.peakDb + adjustment };
}

export function validTake(take) {
  return take && typeof take.id === 'string' && take.id.length < 100 &&
    ['JZ', 'P90'].includes(take.family) && typeof take.preset === 'string' && take.preset.length < 80 &&
    ['S1', 'S2', 'S3'].includes(take.scene) && typeof take.context === 'string' && take.context.length < 1000 &&
    typeof take.input === 'string' && take.input.length < 300 && typeof take.date === 'string' &&
    typeof take.processing === 'boolean' &&
    ['rmsDb', 'peakDb', 'activeSeconds', 'seconds', 'clipped', 'offset'].every(key => Number.isFinite(take[key])) &&
    take.rmsDb >= -120 && take.rmsDb <= 12 && take.peakDb >= -120 && take.peakDb <= 12 &&
    take.seconds >= 0 && take.seconds < 120 && take.activeSeconds >= 0 && take.activeSeconds <= take.seconds + 0.1 &&
    take.clipped >= 0 && take.offset >= 0 && take.offset <= 6;
}

export function validSession(value) {
  return value?.version === 1 && Array.isArray(value.takes) && value.takes.length <= 300 &&
    value.takes.every(validTake) && new Set(value.takes.map(t => t.id)).size === value.takes.length &&
    value.references && ['JZ', 'P90'].every(family => value.references[family] == null ||
      value.takes.some(t => t.id === value.references[family] && t.family === family));
}
