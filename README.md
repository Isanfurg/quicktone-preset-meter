# QuickTone Preset Meter

**Free, local, open-source guitar preset level matching.** Compare scenes against a reference without touching the mixing desk between songs. Spanish interface; works with any audio input exposed by the browser, not only NUX hardware.

[Español](#español) · [English](#english) · [Technical notes](#technical-notes) · [MIT license](LICENSE)

## Español

### Qué hace

- Muestra RMS y picos en dBFS, y avisa cuando las muestras llegan al límite digital.
- Mide tomas de 12 segundos, después de 3 segundos de preparación.
- Compara cada preset/escena con una referencia por perfil de guitarra: JZ o P90.
- Sugiere cuánto subir o bajar **el nivel de salida en dB**, con un objetivo opcional de +2 dB para solos.
- Comprueba si ese aumento dejaría margen para los picos.
- Conserva el historial localmente y lo exporta a CSV.
- No reproduce, almacena ni sube el audio. No modifica QuickTone ni la pedalera.

No lee Gain/Master en vivo desde USB ni cambia presets automáticamente. El visor sí muestra los valores guardados en archivos exportados compatibles. Las sugerencias no equivalen a puntos de una perilla: cambia un poco el nivel de salida y vuelve a medir.

### Visor de presets exportados

En «Tus presets, escena por escena» puedes abrir archivos `.mg30patch` exportados desde QuickTone: uno o varios presets individuales, o un banco completo. Muestra las tres escenas, modelos, estados ON/OFF, cadena y parámetros guardados; resalta las diferencias. «Usar nombre para medir» copia el nombre al formulario, pero no cambia la pedalera.

Este visor **no abre una segunda conexión MIDI**. Los archivos se leen en el navegador y no se suben. Es una fotografía de la exportación: los cambios posteriores en la NUX no aparecen hasta que exportes y cargues de nuevo. Un respaldo antiguo se identifica como histórico; no equivale a leer el estado actual.

Solo está validado el formato observado de 9902 bytes por preset (tres escenas de 142 bytes) y bancos completos de 128 registros. Otros tamaños/cadenas se rechazan. Valores de controles especiales son datos en bruto, sin conversiones no verificadas a dB, ms o Hz. Los modelos desconocidos muestran RAW. El indicador 1/8D solo reconoce una codificación observada: confirma el funcionamiento con TAP en la pedalera.

El catálogo y la estructura de lectura se basan en el trabajo local previo de PresetLab, contrastado con exportaciones reales. No se incluyen IR, audio ni presets propietarios en el repositorio. El respaldo opcional `presets.private.json` permanece local y está excluido de Git.

Para precargar tu propia exportación al abrir la página, ejecuta `node import-snapshot.mjs "ruta/al/archivo-o-carpeta"` y recarga el visor. Admite un banco completo o archivos individuales sin slots repetidos. Añade `--historical` para marcar un respaldo antiguo. Solo se genera el resumen privado de lectura; los `.mg30patch` originales no se modifican ni se publican.

### Requisitos e inicio

1. Instala [Node.js](https://nodejs.org/) 20 o superior.
2. Descarga o clona este repositorio y abre una terminal en su carpeta.
3. Ejecuta `npm start` (o `node server.mjs`). **No hace falta `npm install`: no hay dependencias.**
4. Abre [http://127.0.0.1:8787](http://127.0.0.1:8787) en Chrome o Edge de escritorio.

En Windows puedes abrir `start.cmd`. Para cerrar el servidor, usa Ctrl+C en su terminal.

### Conectar la MG-30

1. Conéctala por USB y conserva tu ruta habitual hacia el ampli o la consola.
2. Usa una ruta USB que entregue **el sonido procesado** del preset, no DI/Dry Out. Revisa la configuración de tu versión de firmware.
3. Pulsa **Conectar audio** y autoriza el acceso en el navegador. El navegador puede llamarlo «micrófono», aunque sea una interfaz USB.
4. Elige la MG-30 en Entrada de audio y vuelve a conectar si cambiaste de dispositivo.
5. Para una salida mono, usa Izquierdo / mono; para comparar ambos canales sin cancelación de fase, usa Estéreo · potencia media.
6. Toca y comprueba que el medidor responda a tu guitarra, no al micrófono ambiente. Silencia pistas y reproducción del computador si entran por loopback.

Si la entrada está ocupada, revisa si REAPER u otra aplicación la usa en modo exclusivo. El navegador usa los dispositivos del sistema, no un controlador ASIO seleccionado dentro de una DAW.

### Equilibrar escenas

1. Deja fijos consola, cápsula seleccionada, tono/volumen de guitarra, volumen global, nivel USB y ganancias de entrada.
2. Selecciona JZ y mide **5A JZ CLEAN FUNK / S1** con el riff de referencia. Elige **Usar última toma como referencia**.
3. Cambia manualmente en QuickTone al siguiente preset y escena. Escribe aquí su nombre; las sugerencias son solo una lista inicial, no una lectura del equipo.
4. Toca **el mismo riff, con fuerza similar**, durante los 12 segundos. Incluye acordes y notas, y mantén la misma dinámica al repetir.
5. Para acompañamientos usa un objetivo de 0 dB. Para solos, S3 propone +2 dB, que puedes modificar entre 0 y 6 dB.
6. Cambia el nivel de salida en QuickTone y repite hasta que el medidor y tu oído estén conformes.
7. Cambia a P90, conecta esa guitarra y mide su propia referencia (por ejemplo 1A P90 CLEAN FUNK). No reutilices a ciegas la referencia de otra guitarra.

Si hay clipping, baja el nivel que lo causa y **repite la referencia y las tomas comparadas**. Si cambias de entrada, canal o umbral, el programa exige una referencia compatible. Cambios físicos de consola, cápsulas o volumen no pueden detectarse: también requieren una nueva referencia.

### Qué significa la medición

El RMS usa la energía media de bloques de aproximadamente 20 ms que superan el umbral de silencio (−55 dBFS inicialmente). Se calcula en el hilo de audio, por lo que no depende de la frecuencia de dibujo de la interfaz. Las pausas bajo el umbral no reducen artificialmente el promedio. El umbral debe quedar sobre el ruido y bajo tus notas suaves; no es un noise gate que altere tu sonido.

RMS **no es LUFS**, y los picos son de muestras, **no true peak**. Dos sonidos con el mismo RMS pueden sentirse diferentes por EQ, compresión o distorsión. El medidor ayuda a comparar; termina de ajustar tocando con tu banda. No detecta saturación analógica o clipping ocurrido antes de una etapa que atenúa la señal.

El programa solicita desactivar ganancia automática, reducción de ruido y cancelación de eco, y bloquea recomendaciones si el dispositivo declara que siguen activas. Los ajustes internos del hardware, mejoras de Windows y procesamiento no declarado quedan fuera de su control.

### Datos y privacidad

El servidor escucha solo en `127.0.0.1`. No hay cuentas, analítica ni servicios externos. Se guarda `session.json` junto al programa: nombres de presets, dispositivo, fechas, perfil y estadísticas; **no muestras de audio**. Este archivo y los CSV están excluidos de Git. Haz una copia del archivo para respaldar una sesión. La sesión admite hasta 300 tomas; antes de iniciar otra, respalda y mueve manualmente `session.json` con el servidor cerrado.

No expongas el servidor a Internet. El permiso de audio se concede manualmente y se libera al desconectar o cerrar la página. Cambiar entre `localhost` y `127.0.0.1` puede pedir permiso de nuevo: conserva la misma dirección.

## English

### Run

Requires Node.js 20+ and desktop Chrome or Edge. Run `npm start` or `node server.mjs`, then open `http://127.0.0.1:8787`. No installation of npm dependencies is needed. On Windows, double-click `start.cmd`.

Connect your modeler/interface over USB, select its **processed** output rather than the dry DI path, and grant audio input permission in the browser. The app never monitors audio back to your speakers.

### Match levels

1. Keep guitar controls, interface gain, USB level, global output and mixer settings fixed.
2. Play the same riff for each 12-second take. Measure a comfortable clean preset and mark it as the reference.
3. Enter the actual preset and scene manually. JZ and P90 are independent comparison profiles with separate references; use the profiles for your own two guitars if desired.
4. Rhythm scenes default to the reference level; S3 defaults to a +2 dB target for lead parts.
5. Follow the suggested **output-level change in dB**, then measure again. The suggestion is not a Gain/Master knob position.
6. Repeat the reference if the input path, guitar controls or capture settings change.

The read-only file viewer also compares all three scenes from supported QuickTone `.mg30patch` exports. It does not open MIDI, upload files or modify hardware. Imported files are snapshots, not a live view. Only observed 9902-byte records and full 128-record banks are accepted; unknown models remain raw and special control values are not converted into unverified physical units.

This is a gated RMS meter, not a calibrated loudness or true-peak meter. EQ and compression affect perceived volume. Finish by ear. It cannot detect clipping that occurred upstream of an attenuated signal. Browser/device processing and physical gain changes may not always be detectable.

Only measurement metadata/statistics are saved to a local `session.json`; audio is never recorded or uploaded. The server binds only to loopback and should not be exposed publicly. Git ignores session data and CSV exports.

## Technical notes

- Native Web Audio API / AudioWorklet, plain HTML/CSS/JavaScript, Node standard library server.
- Stereo measurement averages channel energy rather than summing waveforms, preserving out-of-phase signal power.
- Each take retains its sample-peak and clipping count, plus active and total audio duration.
- Suggested adjustment = reference RMS + lead offset − measured RMS. Suggestions are withheld for incompatible capture contexts, insufficient active signal, declared automatic processing, or clipping.
- Persistence validates the data shape and limits request/session size. Requests from other origins or unexpected Host headers are rejected; writes use a temporary file followed by rename. Only app assets and the session API are served.
- No MIDI, automatic preset changes, firmware updates, LUFS, audio recording, or live internal-gain reading in this version. Gain/Master and other stored parameters can be viewed from supported exported files.

### Development

```sh
npm test
npm start
```

Tests cover known signal levels, out-of-phase stereo, gating, clipping, channel selection, reference comparisons, headroom prediction, validation and local HTTP boundaries. Browser microphone permission and real hardware routing require a manual check.

To use a different port, set `QUICKTONE_METER_PORT`, e.g. PowerShell: `$env:QUICKTONE_METER_PORT=8788` then `npm start`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributions and [SECURITY.md](SECURITY.md) for security reporting. MIT licensed: you may use, modify and redistribute it, including commercially, under the license terms.

QuickTone and NUX are trademarks of their respective owners. This community project is not affiliated with or endorsed by NUX. No proprietary presets, impulse responses, firmware or audio are included.
