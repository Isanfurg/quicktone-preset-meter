import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

test('local server serves only app files, validates writes, and persists sessions', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'quicktone-meter-test-'));
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  let child;
  try {
    for (const file of ['server.mjs', 'meter.mjs', 'index.html', 'app.mjs', 'worklet.mjs', 'style.css', 'patch-reader.mjs', 'patch-viewer.mjs', 'patch-catalog.mjs']) await cp(path.join(root, file), path.join(folder, file));
    child = spawn(process.execPath, ['server.mjs'], { cwd: folder, env: { ...process.env, QUICKTONE_METER_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([once(child.stdout, 'data'), once(child, 'error').then(([error]) => { throw error; }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000); timer.unref(); })]);
    const url = `http://127.0.0.1:${port}`;
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Balance de presets/);
    assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
    for (const file of ['/app.mjs', '/worklet.mjs', '/meter.mjs', '/style.css', '/patch-reader.mjs', '/patch-viewer.mjs', '/patch-catalog.mjs']) assert.equal((await fetch(url + file)).status, 200);
    assert.deepEqual(await (await fetch(url + '/api/preset-snapshot')).json(), { version: 1, presets: [] });
    assert.equal((await fetch(url + '/presets.private.json')).status, 404);
    assert.equal((await fetch(url + '/server.mjs')).status, 404);
    assert.equal((await fetch(url + '/session.json')).status, 404);
    assert.equal((await fetch(url + '/constructor')).status, 404);
    assert.equal((await fetch(url + '/api/session', { headers: { Origin: 'https://foreign.example' } })).status, 403);
    const headers = { 'Content-Type': 'application/json' };
    assert.equal((await fetch(url + '/api/session', { method: 'POST', headers, body: '{broken' })).status, 400);
    assert.equal((await fetch(url + '/api/session', { method: 'POST', headers, body: '{}' })).status, 400);
    assert.equal((await fetch(url + '/api/session', { method: 'POST', headers, body: ' '.repeat(1000001) })).status, 413);
    const session = { version: 1, takes: [], references: {} };
    assert.deepEqual(await (await fetch(url + '/api/session')).json(), session);
    assert.equal((await fetch(url + '/api/session', { method: 'POST', headers, body: JSON.stringify(session) })).status, 204);
    assert.deepEqual(JSON.parse(await readFile(path.join(folder, 'session.json'), 'utf8')), session);
  } finally {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    // The only recursive removal is the verified mkdtemp test fixture.
    if (!path.resolve(folder).startsWith(path.join(tmpdir(), 'quicktone-meter-test-'))) throw new Error('Unexpected fixture path');
    await rm(folder, { recursive: true, force: true });
  }
});
