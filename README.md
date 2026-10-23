# QuickTone Preset Studio

**Free, local, open-source desktop preset editing and measured level matching.** Edit supported MG-30 files, compare three scenes, and propose output-level adjustments from real guitar measurements. Spanish interface. The repository retains its original `quicktone-preset-meter` name.

[Español](#español) · [English](#english) · [Technical notes](#technical-notes) · [MIT license](LICENSE)

## Español

### Qué hace

- Interfaz de escritorio: biblioteca con búsqueda a la izquierda, tarjetas S1/S2/S3 y cadena de efectos clicable. Selecciona un bloque para editar sus controles; «Nombre y tempo» despliega los datos del preset.
- Ilustraciones vectoriales originales de amplis, pedales, EQ y pedales de expresión, sin imágenes ni marcas de terceros. El dibujo identifica la familia; el nombre de modelo sigue siendo la referencia exacta.
- «Seguir NUX · MIDI» escucha cambios de preset y escena con QuickTone cerrado. Acepta el permiso MIDI y cambia de preset y escena en la pedalera para establecer el estado inicial. Solo abre una entrada NUX, sin salidas ni SysEx. Observado en firmware 6.0.5: Program Change canal 1 y CC80, valores 0/1/2 para S1/S2/S3. Los nombres y parámetros vienen del archivo abierto; MIDI no confirma su versión. Una toma se cancela si cambia el estado MIDI.
- Las pestañas «Editor», «Medidor y balance» y «Comparar» separan las tareas sin perder la sesión. «Preparar medición» abre el medidor con la escena vinculada.
- «Puntos de partida» sugiere ajustes para drive (Tube/Blues, crunch, rock, boost, solo), ampli, delay (corto, largo, TAP 1/8D, ambient), reverb (Room, Plate, Hall, Shimmer), modulación, compresor, EQ y gate. Muestra modelo y valores antes de aplicar y permite deshacer la última sugerencia mientras no hagas otra edición. Solo cambia el bloque de la escena seleccionada; no equilibra su volumen automáticamente. Si cambia el modelo, sus demás controles cargan los valores base. Son recetas iniciales en valores brutos, no calibración acústica ni tiempos en milisegundos.
- Muestra RMS y picos en dBFS, y avisa cuando las muestras llegan al límite digital.
- Mide tomas de 12 segundos, después de 3 segundos de preparación.
- Compara cada preset/escena con una referencia por perfil de guitarra: JZ o P90.
- Sugiere cuánto subir o bajar **el nivel de salida en dB**, con un objetivo opcional de +2 dB para solos.
- Comprueba si ese aumento dejaría margen para los picos.
- Conserva el historial localmente y lo exporta a CSV.
- No reproduce, almacena ni sube el audio. No modifica QuickTone ni la pedalera.
- Abre un banco o preset MG-30 compatible y edita sus tres escenas: modelos numéricos compatibles, parámetros, bypass, nombre, BPM y copia entre escenas.
- Exporta presets individuales o bancos como copias, conservando los bytes originales de IR/NAM y otros recursos.
- Propone balance medido mediante LEVEL de 6-BAND EQ activo. Aplica únicamente después de revisar la tabla y solo al borrador.

No lee Gain/Master en vivo desde USB ni cambia presets automáticamente. El visor sí muestra los valores guardados en archivos exportados compatibles. Las sugerencias no equivalen a puntos de una perilla: cambia un poco el nivel de salida y vuelve a medir.

### Visor de presets exportados

En «Tus presets, escena por escena» puedes abrir archivos `.mg30patch` exportados desde QuickTone: uno o varios presets individuales, o un banco completo. Muestra las tres escenas, modelos, estados ON/OFF, cadena y parámetros guardados; resalta las diferencias. «Usar nombre para medir» copia el nombre al formulario, pero no cambia la pedalera.

Este visor **no abre una segunda conexión MIDI**. Los archivos se leen en el navegador y no se suben. Es una fotografía de la exportación: los cambios posteriores en la NUX no aparecen hasta que exportes y cargues de nuevo. Un respaldo antiguo se identifica como histórico; no equivale a leer el estado actual.

Solo está validado el formato observado de 9902 bytes por preset (tres escenas de 142 bytes) y bancos completos de 128 registros. Otros tamaños/cadenas se rechazan. Valores de controles especiales son datos en bruto, sin conversiones no verificadas a dB, ms o Hz. Los modelos desconocidos muestran RAW. El indicador 1/8D solo reconoce una codificación observada: confirma el funcionamiento con TAP en la pedalera.

El catálogo y la estructura de lectura se basan en el trabajo local previo de PresetLab, contrastado con exportaciones reales. No se incluyen IR, audio ni presets propietarios en el repositorio. El respaldo opcional `presets.private.json` permanece local y está excluido de Git.

Para precargar tu propia exportación al abrir la página, ejecuta `node import-snapshot.mjs "ruta/al/archivo-o-carpeta"` y recarga el visor. Admite un banco completo o archivos individuales sin slots repetidos. Añade `--historical` para marcar un respaldo antiguo. Solo se genera el resumen privado de lectura; los `.mg30patch` originales no se modifican ni se publican.

### Requisitos e inicio

**Aplicación de escritorio para Windows 10/11 x64:** descarga el ZIP de [Releases](https://github.com/Isanfurg/quicktone-preset-meter/releases), extrae toda la carpeta y abre `QuickTone Preset Studio.exe`. Conserva los archivos que acompañan al ejecutable. No necesitas Node.js para la versión empaquetada. El binario comunitario no está firmado con un certificado comercial.

**Desde código:** instala [Node.js](https://nodejs.org/) 22.12 o superior, clona el repositorio, ejecuta `npm ci` y después `npm start`. Electron abre una ventana independiente. `npm run build` genera la carpeta de Windows x64 en `release/`. Si ya existe, muévela antes de volver a empaquetar: el build no la sobrescribe.

**Modo navegador opcional:** `npm run web` o `node server.mjs` y abre `http://127.0.0.1:8787` en Chrome/Edge. El servidor web puede ejecutarse sin instalar dependencias con Node.js 20+. Para cerrarlo usa Ctrl+C. `start.cmd` abre el ejecutable compilado si está disponible.

### Editar y aplicar balance

1. Exporta tu banco actual desde QuickTone y ábrelo en «Editar presets». Trabaja siempre sobre un respaldo.
2. Elige preset, escena y bloque. Los controles especiales no validados se conservan en solo lectura. Cambiar de modelo aplica sus valores numéricos iniciales; los modelos que requieren recursos/controles especiales no se ofrecen como sustitutos.
3. Exporta una copia editada e impórtala con QuickTone. La aplicación nunca envía cambios a la NUX por MIDI.
4. Pulsa «Preparar medición de esta escena». Confirma que esa misma versión está cargada y seleccionada en la pedalera. Toca el riff y fija la referencia del perfil correspondiente.
5. Mide las demás escenas. «Calcular propuestas» muestra ajustes, exclusiones y motivos. «Aplicar propuestas al borrador» cambia LEVEL del EQ de seis bandas en pasos de 0.3 dB.
6. Exporta, importa en QuickTone y vuelve a medir. No se presume que el resultado ya quedó calibrado.

Cada toma vinculada conserva una huella SHA-256 de su escena y recursos. Si el borrador cambió después, no se aplica una toma vieja. Las mediciones manuales anteriores sin huella siguen sirviendo como comparación, pero no generan cambios automáticos. Tampoco se aplican ajustes con clipping, falta de señal/margen, entradas incompatibles, EQ apagado/no compatible o diferencias mayores de 6 dB. El EQ debe estar después del ampli, drive y compresor.

Este balance usa mediciones, no una IA externa ni suscripciones. No escucha por sí solo lo que significa «más cálido»: la decisión de EQ/tono sigue siendo tuya. La conversión dB solo está comprobada para 6-BAND EQ: raw 50=0 dB, 57=+2.1 dB, 60=+3 dB, 63=+3.9 dB en la instalación v6.0.5 observada. No se convierte Master/Gain a dB.

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

El servidor escucha solo en `127.0.0.1`. No hay cuentas, analítica ni servicios externos. En escritorio los datos se guardan en `%APPDATA%/QuickTonePresetStudio`; en modo web, junto al programa. `session.json` contiene nombres, dispositivo, fechas, perfil y estadísticas; **no muestras de audio**. Los archivos privados y CSV están excluidos de Git y del ejecutable. Haz una copia para respaldar una sesión. La sesión admite hasta 300 tomas; antes de iniciar otra, respalda y mueve manualmente `session.json` con la aplicación cerrada. Los cambios del borrador se conservan exportándolos; al cerrar se avisa si quedan cambios sin exportar.

No expongas el servidor a Internet. El permiso de audio se concede manualmente y se libera al desconectar o cerrar la página. Cambiar entre `localhost` y `127.0.0.1` puede pedir permiso de nuevo: conserva la misma dirección.

## English

### Run

Windows 10/11 x64: download the portable ZIP from Releases, extract the entire folder and run `QuickTone Preset Studio.exe`. No Node.js installation is needed for the packaged app. The community executable is not commercially code-signed.

From source: Node.js 22.12+, `npm ci`, then `npm start`. Run `npm run build` to package Windows x64. Optional browser mode: `npm run web` at `http://127.0.0.1:8787`; that server alone needs only Node.js 20+.

Connect your modeler/interface over USB, select its **processed** output rather than the dry DI path, and grant audio input permission in the browser. The app never monitors audio back to your speakers.

### Match levels

1. Keep guitar controls, interface gain, USB level, global output and mixer settings fixed.
2. Play the same riff for each 12-second take. Measure a comfortable clean preset and mark it as the reference.
3. Enter the actual preset and scene manually. JZ and P90 are independent comparison profiles with separate references; use the profiles for your own two guitars if desired.
4. Rhythm scenes default to the reference level; S3 defaults to a +2 dB target for lead parts.
5. Follow the suggested **output-level change in dB**, then measure again. The suggestion is not a Gain/Master knob position.
6. Repeat the reference if the input path, guitar controls or capture settings change.

The editor and comparison viewer work on all three scenes of supported QuickTone `.mg30patch` exports. Optional MIDI following listens to one NUX input only (channel 1 Program Change and CC80 scene messages observed on firmware 6.0.5). Keep QuickTone closed and switch preset/scene to initialize it. No MIDI outputs or SysEx are used. Names and controls still come from your file; following does not confirm the patch version. No files are uploaded and no hardware settings are changed. Export new copies and import them through QuickTone. Original IR/NAM payload bytes are preserved. Only observed 9902-byte records and full 128-record banks are accepted; unknown/special controls stay read-only. Original SVG gear illustrations identify device families rather than claiming exact hardware appearance.

Measured auto-balance changes only the calibrated output LEVEL of an enabled six-band EQ, after the amp/drive/compressor. Capture a scene through the editor, confirm that exact version is loaded on the pedal, then measure. SHA-256 fingerprints reject stale takes after edits. Review proposals before applying them, export/import and measure again. Unsupported EQ, clipping, insufficient signal/headroom, incompatible contexts, and changes exceeding 6 dB are refused. This is local signal-based assistance, not a paid AI service.

This is a gated RMS meter, not a calibrated loudness or true-peak meter. EQ and compression affect perceived volume. Finish by ear. It cannot detect clipping that occurred upstream of an attenuated signal. Browser/device processing and physical gain changes may not always be detectable.

Only measurement metadata/statistics are saved to a local `session.json`; audio is never recorded or uploaded. The server binds only to loopback and should not be exposed publicly. Git ignores session data and CSV exports.

## Technical notes

- Electron desktop shell, native Web Audio API / AudioWorklet, plain HTML/CSS/JavaScript, Node standard library server. Electron and Packager are development/build dependencies; the editor and meter do not call cloud APIs.
- Stereo measurement averages channel energy rather than summing waveforms, preserving out-of-phase signal power.
- Each take retains its sample-peak and clipping count, plus active and total audio duration.
- Suggested adjustment = reference RMS + lead offset − measured RMS. Suggestions are withheld for incompatible capture contexts, insufficient active signal, declared automatic processing, or clipping.
- Persistence validates the data shape and limits request/session size. Requests from other origins or unexpected Host headers are rejected; writes use a temporary file followed by rename. Only app assets and the session API are served.
- No outgoing MIDI, automatic hardware preset changes, firmware updates, LUFS, audio recording, or live internal-gain reading in this version. MIDI input follows preset/scene only; supported stored parameters are editable and only validated numeric controls can be written.

### Development

```sh
npm test
npm run test:desktop
npm run build
npm start
```

Tests cover known signal levels, out-of-phase stereo, gating, clipping, channel selection, reference comparisons, headroom prediction, file editing, exact resource preservation, stale/double balance application, validation and local HTTP boundaries. The desktop smoke test checks the actual Electron window, preload, editor, measurement binding, writer and an AudioWorklet with a synthetic oscillator; it does not represent real guitar calibration. Microphone permission, real hardware routing and importing a newly edited file into QuickTone require a manual check.

To use a different port, set `QUICKTONE_METER_PORT`, e.g. PowerShell: `$env:QUICKTONE_METER_PORT=8788` then `npm start`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributions and [SECURITY.md](SECURITY.md) for security reporting. MIT licensed: you may use, modify and redistribute it, including commercially, under the license terms.

QuickTone and NUX are trademarks of their respective owners. This community project is not affiliated with or endorsed by NUX. No proprietary presets, impulse responses, firmware or audio are included.
