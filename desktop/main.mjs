import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
import { readPatchFile } from '../patch-reader.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
app.setName('QuickTone Preset Studio');
const smoke = process.argv.includes('--smoke-test');
app.setPath('userData', smoke && process.env.PRESET_STUDIO_TEST_DIR ? process.env.PRESET_STUDIO_TEST_DIR : path.join(app.getPath('appData'), 'QuickTonePresetStudio'));
let window, local, audioAllowed = false, midiAllowed = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); });
  app.whenReady().then(async () => {
  if (smoke) console.log('SMOKE_STAGE ready');
  try {
    const dataDir = app.getPath('userData'); await mkdir(dataDir, { recursive: true });
    // Private development data migrates once; packaged releases never include it.
    if (!app.isPackaged) for (const name of ['session.json', 'presets.private.json', 'source.private.mg30patch']) {
      try { await copyFile(path.join(root, name), path.join(dataDir, name), constants.COPYFILE_EXCL); }
      catch (error) { if (!['ENOENT', 'EEXIST'].includes(error.code)) throw error; }
    }
    local = await startServer({ port: smoke ? 0 : 8788, dataDir });
    if (smoke) console.log('SMOKE_STAGE server');
    window = new BrowserWindow({ width: 1330, height: 920, minWidth: 850, minHeight: 620, backgroundColor: '#101514', title: 'QuickTone Preset Studio', show: false, webPreferences: { preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
    const trusted = url => { try { return new URL(url).origin === local.url; } catch { return false; } };
    session.defaultSession.setPermissionCheckHandler((webContents, permission, origin, details) => webContents === window.webContents && trusted(origin) && ((permission === 'media' && details.mediaType === 'audio' && audioAllowed) || (['midi', 'midiSysex'].includes(permission) && midiAllowed)));
    session.defaultSession.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
      // Electron 45 requests midiSysex even when requestMIDIAccess uses sysex:false.
      if (webContents === window.webContents && trusted(details.requestingUrl) && details.isMainFrame && ['midi', 'midiSysex'].includes(permission)) {
        const result = await dialog.showMessageBox(window, { type: 'question', title: 'Seguimiento MIDI', message: '¿Permitir acceso MIDI para seguir preset y escena?', detail: 'Electron solicita un permiso MIDI ampliado. Esta aplicación solo abre la entrada NUX; no abre salidas ni envía comandos y usa sysex:false. Mantén QuickTone cerrado.', buttons: ['Permitir MIDI', 'Cancelar'], defaultId: 0, cancelId: 1 });
        midiAllowed = result.response === 0; callback(midiAllowed); return;
      }
      if (webContents !== window.webContents || !trusted(details.requestingUrl) || permission !== 'media' || !details.mediaTypes?.length || details.mediaTypes.some(type => type !== 'audio')) { callback(false); return; }
      const result = await dialog.showMessageBox(window, { type: 'question', title: 'Entrada de audio', message: '¿Permitir que el medidor escuche tu entrada de audio?', detail: 'La señal se mide localmente. No se graba ni se envía a Internet.', buttons: ['Permitir audio', 'Cancelar'], defaultId: 0, cancelId: 1 });
      audioAllowed = result.response === 0; callback(audioAllowed);
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
    window.webContents.on('will-prevent-unload', event => {
      const answer = dialog.showMessageBoxSync(window, { type: 'question', message: 'Hay cambios de preset sin exportar.', buttons: ['Seguir editando', 'Descartar y cerrar'], defaultId: 0, cancelId: 0 });
      if (answer === 1) event.preventDefault();
    });
    ipcMain.handle('save-patch', async (event, value) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !trusted(event.senderFrame.url)) throw new Error('Origen no autorizado.');
      if (!(value?.bytes instanceof Uint8Array) || value.bytes.length > 9902 * 128 || typeof value.name !== 'string') throw new Error('Archivo no válido.');
      readPatchFile(value.bytes);
      const name = path.basename(value.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 90).replace(/\.mg30patch$/i, '') + '.mg30patch';
      const result = await dialog.showSaveDialog(window, { title: 'Exportar una copia editada', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Preset NUX MG-30', extensions: ['mg30patch'] }] });
      if (result.canceled || !result.filePath) return { canceled: true };
      try { await writeFile(result.filePath, value.bytes, { flag: 'wx' }); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('El archivo ya existe. Elige otro nombre para conservarlo.'); throw error; }
      return { saved: true, name: path.basename(result.filePath) };
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Archivo', submenu: [{ role: 'quit', label: 'Salir' }] }, { label: 'Edición', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }, { label: 'Vista', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }]));
    window.once('ready-to-show', () => { if (!smoke) window.show(); });
    window.on('closed', () => { window = null; });
    await window.loadURL(local.url);
    if (smoke) console.log('SMOKE_STAGE loaded');
  } catch (error) { dialog.showErrorBox('No se pudo iniciar Preset Studio', error.message); app.quit(); }
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => local?.server.close());
  }).catch(error => { console.error(error); app.exit(1); });
}
