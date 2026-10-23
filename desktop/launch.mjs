import electron from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env };
// Editors built on Electron may export this flag; the app must run as a desktop process.
delete env.ELECTRON_RUN_AS_NODE;
const smoke = process.argv.includes('--smoke-test');
const child = spawn(electron, smoke ? ['desktop/smoke.mjs', '--smoke-test'] : ['.'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
