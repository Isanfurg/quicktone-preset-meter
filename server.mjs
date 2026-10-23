import http from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validSession } from './meter.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.QUICKTONE_METER_PORT || 8787);
const sessionPath = path.join(root, 'session.json');
const assets = { '/': ['index.html', 'text/html'], '/app.mjs': ['app.mjs', 'text/javascript'], '/meter.mjs': ['meter.mjs', 'text/javascript'], '/worklet.mjs': ['worklet.mjs', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
for (const name of ['patch-reader.mjs', 'patch-viewer.mjs', 'patch-catalog.mjs']) assets['/' + name] = [name, 'text/javascript'];
let writing = false;
const server = http.createServer(async (req, res) => {
  const host = `127.0.0.1:${port}`;
  if (req.headers.host !== host && req.headers.host !== `localhost:${port}`) { res.writeHead(403).end(); return; }
  const origin = req.headers.origin;
  if (origin && ![`http://${host}`, `http://localhost:${port}`].includes(origin)) { res.writeHead(403).end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'");
  try {
    if (req.url === '/api/preset-snapshot' && req.method === 'GET') {
      let body;
      try { body = await readFile(path.join(root, 'presets.private.json')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; body = JSON.stringify({ version: 1, presets: [] }); }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
      return;
    }
    if (req.url === '/api/session' && req.method === 'GET') {
      let body;
      try { body = await readFile(sessionPath); } catch (error) { if (error.code !== 'ENOENT') throw error; body = JSON.stringify({ version: 1, takes: [], references: {} }); }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
      return;
    }
    if (req.url === '/api/session' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) { res.writeHead(415).end(); return; }
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 1000000) { res.writeHead(413).end(); return; }
      }
      let data;
      try { data = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
      if (!validSession(data)) { res.writeHead(400).end(); return; }
      if (writing) { res.writeHead(409).end(); return; }
      writing = true;
      try {
        await writeFile(sessionPath + '.tmp', JSON.stringify(data, null, 2));
        await rename(sessionPath + '.tmp', sessionPath);
      } finally { writing = false; }
      res.writeHead(204).end();
      return;
    }
    const asset = Object.hasOwn(assets, req.url) ? assets[req.url] : null;
    if (req.method !== 'GET' || !asset) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }).end(await readFile(path.join(root, asset[0])));
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) res.writeHead(500);
    res.end('No se pudo leer o guardar la sesión.');
  }
});
server.on('error', error => { console.error(`No se pudo iniciar el medidor: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`QuickTone Meter: http://127.0.0.1:${port}`));
