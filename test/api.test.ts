import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';

test('HTTP authentication, command replay, server clock and bounded requests work end to end', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'simulator-api-'));
  const child = spawn(process.execPath, ['src/server.ts'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, PORT: '0', SIMULATOR_DATA_FILE: join(folder, 'world.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); await new Promise<void>(resolve => child.once('exit', () => resolve())); await rm(folder, { recursive: true, force: true }); });
  const { origin, key } = await new Promise<{ origin: string; key: string }>((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error('Server startup timed out')), 8000);
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited before startup (${code})`)); });
    child.stdout.on('data', data => { output += data; const origin = output.match(/Development foundation: (http:\/\/127\.0\.0\.1:\d+)/)?.[1], key = output.match(/Development access key: (\S+)/)?.[1]; if (origin && key) { clearTimeout(timer); resolve({ origin, key }); } });
  });
  const headers = { 'x-development-key': key, 'Content-Type': 'application/json' };
  assert.equal((await fetch(origin + '/')).status, 200);
  const health = await fetch(origin + '/healthz'); assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal((await fetch(origin + '/api/citizen')).status, 401);
  assert.equal((await fetch(origin + '/api/citizen', { headers: { ...headers, Origin: 'https://another-origin.invalid' } })).status, 403);
  const cmd = { id: 'create_api_001', type: 'CreateCitizen', payload: { name: 'Adé Ọlá', state: 'Lagos', adultConfirmed: true, actorId: 'intruder' } };
  const post = (body: unknown) => fetch(origin + '/api/commands', { method: 'POST', headers, body: JSON.stringify(body) });
  // A character may straddle network chunks; parse only after the bytes are joined.
  const encoded = Buffer.from(JSON.stringify(cmd)), split = encoded.findIndex(byte => byte > 127) + 1;
  const first = await new Promise<any>((resolve, reject) => {
    const req = httpRequest(origin + '/api/commands', { method: 'POST', headers }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => { try { assert.equal(res.statusCode, 200); resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
    }); req.on('error', reject); req.write(encoded.subarray(0, split)); setImmediate(() => req.end(encoded.subarray(split)));
  });
  assert.equal(first.view.citizen.name, 'Adé Ọlá');
  assert.equal(first.receipt.actorId, 'developer-citizen'); assert.equal(first.view.balance, 2000000);
  const second = await (await post(cmd)).json(); assert.equal(second.replayed, true); assert.deepEqual(second.receipt, first.receipt);
  const bypass = await post({ id: 'lesson_api_002', type: 'CompleteLesson', payload: { day: 2, now: Date.now() + 86400000 } });
  assert.equal(bypass.status, 409); assert.equal((await bypass.json()).error, 'LESSON_LOCKED');
  const large = await post({ ...cmd, payload: { oversized: 'a'.repeat(9000) } }); assert.equal(large.status, 413);
  const invalid = await fetch(origin + '/api/commands', { method: 'POST', headers, body: '{' }); assert.equal(invalid.status, 400);
  assert.equal((await fetch(origin + '/api/citizen', { headers })).status, 200);
});
