import catalog from './patch-catalog.mjs';
import { PatchDocument } from './patch-editor.mjs';

// Starting points in validated raw controls, not measured loudness or physical units.
const recipe = (id, title, description, model, values, dotted = false) => ({ id, title, description, model, values, dotted });
const recipes = {
  EFX: [
    recipe('boost', 'Boost · Tube', 'Poco drive y medios para empujar el ampli. El aumento real de volumen depende del ampli: vuelve a medir.', 5, { DRIVE: 12, TONE: 56, LEVEL: 58 }),
    recipe('crunch', 'Crunch · Blues', 'Ataque abierto para acordes y riffs con saturación moderada.', 6, { GAIN: 34, TONE: 52, LEVEL: 50 }),
    recipe('rock', 'Rock · Tube', 'Más drive y enfoque de medios para bases con cuerpo.', 5, { DRIVE: 48, TONE: 55, LEVEL: 50 }),
    recipe('solo', 'Solo · Tube', 'Más sustain y presencia. Ajusta el boost final midiendo LEVEL del EQ; más drive puede comprimir.', 5, { DRIVE: 40, TONE: 60, LEVEL: 58 }),
    recipe('ambient-drive', 'Ambient · Blues', 'Overdrive suave para arpegios con delay y Hall; conserva definición.', 6, { GAIN: 22, TONE: 48, LEVEL: 50 }),
  ],
  DLY: [
    recipe('short', 'Corto · Tape', 'Eco discreto para engordar frases. TIME es un valor bruto: ajusta la duración al oído.', 4, { TIME: 18, LEVEL: 14, REPEAT: 18 }),
    recipe('long', 'Largo · Tape', 'Repeticiones más espaciadas para melodías y solos. Ajusta el tiempo con TAP en la pedalera.', 4, { TIME: 65, LEVEL: 24, REPEAT: 35 }),
    recipe('dotted', 'Corchea con puntillo · TAP', 'Digital Delay en 1/8D. Marca negras con TAP en la NUX y comprueba la subdivisión; no se envía TAP desde aquí.', 2, { 'E.LEVEL': 27, 'F.BACK': 35, 'D.TIME': 50 }, true),
    recipe('ambient', 'Ambient · Modulado', 'Cola con movimiento para pasajes espaciosos; reduce LEVEL si tapa el ataque.', 3, { TIME: 65, LEVEL: 30, MOD: 20, REPEAT: 48 }),
  ],
  RVB: [
    recipe('short', 'Corta · Room', 'Espacio pequeño y discreto para bases definidas.', 1, { DECAY: 25, TONE: 52, LEVEL: 15 }),
    recipe('plate', 'Solo · Plate', 'Cola media para sostener melodías sin una nube muy grande.', 3, { DECAY: 42, LEVEL: 21 }),
    recipe('hall', 'Larga · Hall', 'Espacio amplio para arpegios y worship.', 2, { DECAY: 65, 'PRE.D': 22, LIVELINESS: 48, LEVEL: 27 }),
    recipe('ambient', 'Ambient suave · Hall', 'Hall largo con mezcla moderada para acompañar sin tapar tanto.', 2, { DECAY: 76, 'PRE.D': 25, LIVELINESS: 43, LEVEL: 30 }),
    recipe('shimmer', 'Ambient brillante · Shimmer', 'Textura de fondo con brillo; evita acumular demasiadas repeticiones del delay.', 5, { MIX: 25, DECAY: 70, SHIM: 22 }),
  ],
  MOD: [
    recipe('chorus', 'Chorus suave', 'Movimiento discreto para limpios y arpegios, pensado también para tu salida mono.', 2, { RATE: 18, DEPTH: 25 }),
    recipe('tremolo', 'Trémolo clásico', 'Pulso moderado para acordes sostenidos.', 11, { RATE: 30, DEPTH: 35 }),
    recipe('phase', 'Phaser lento', 'Barrido lento para riffs y texturas.', 7, { SPEED: 20 }),
  ],
  CMP: [
    recipe('light', 'Compresión suave', 'Punto de partida para igualar el ataque. Revisa el sustain y el volumen con tu guitarra.', 1, { SUSTAIN: 24, LEVEL: 50 }),
    recipe('sustain', 'Más sustain', 'Más compresión para notas sostenidas; puede reducir la dinámica.', 1, { SUSTAIN: 48, LEVEL: 50 }),
  ],
  EQ: [
    recipe('flat', 'Plano · sin boost', 'Restablece las seis bandas y la salida a 0 dB.', 1, { '100Hz': 50, '220Hz': 50, '500Hz': 50, '1.2kHz': 50, '2.6kHz': 50, '6.4kHz': 50, LEVEL: 50 }),
    recipe('presence', 'Medios para solo', 'Recorte suave de graves y presencia en medios. Salida a 0 dB: mide después el boost de solo.', 1, { '100Hz': 46, '220Hz': 48, '500Hz': 52, '1.2kHz': 55, '2.6kHz': 54, '6.4kHz': 49, LEVEL: 50 }),
  ],
  GATE: [
    recipe('gentle', 'Suave · arpegios / ambient', 'Umbral bajo para conservar notas suaves y colas. Ajústalo al ruido real de tus cápsulas.', 1, { SENS: 10, DECAY: 60 }),
    recipe('rock', 'Rock · cierre moderado', 'Cierra algo más el ruido entre frases; baja SENS si corta notas.', 1, { SENS: 25, DECAY: 45 }),
  ],
};
export function suggestions(block, modelId) {
  if (block === 'AMP') {
    const model = catalog.models.find(m => m.block === block && m.id === modelId);
    if (!model?.parameters.some(p => p.name === 'GAIN' && p.editable)) return [];
    return [recipe('clean', 'Más limpio', 'Baja GAIN para arpegios. Conserva modelo, EQ y volumen; un ampli de mucha ganancia puede seguir saturando.', modelId, { GAIN: 22 }), recipe('crunch', 'Crunch', 'Ganancia intermedia en tu ampli actual. Conserva Master y LEVEL.', modelId, { GAIN: 42 }), recipe('rock', 'Rock', 'Más saturación en tu ampli actual. No garantiza más volumen: mide después.', modelId, { GAIN: 60 })];
  }
  return recipes[block] || [];
}
export function applyRecipe(document, program, scene, block, id) {
  const current = document.describe(program).scenes[Number(scene[1]) - 1]?.blocks[block];
  const item = suggestions(block, current?.modelId).find(r => r.id === id);
  if (!item) throw new Error('Sugerencia no disponible para este bloque.');
  const copy = new PatchDocument(document.exportPreset(program));
  if (current.modelId !== item.model) copy.setModel(program, scene, block, item.model);
  for (const [name, value] of Object.entries(item.values)) copy.setParameter(program, scene, block, name, value);
  if (item.dotted) copy.setDottedEighth(program, scene);
  copy.setEnabled(program, scene, block, true);
  document.records.set(program, copy.exportPreset(program));
  return item;
}
