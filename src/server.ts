import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WorldStore } from './store.ts';
import { DomainError, citizenView } from './domain.ts';
import type { Command } from './domain.ts';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
const store = await WorldStore.open(process.env.SIMULATOR_DATA_FILE ?? fileURLToPath(new URL('../.data/world.json', import.meta.url)));
const key = randomBytes(24).toString('base64url');
const digest = (s: string) => createHash('sha256').update(s).digest();
const expectedKey = digest(key);
let origin = `http://127.0.0.1:${port}`;
const assets = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]]);
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  const json = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  try {
    if (req.headers.origin && req.headers.origin !== origin) return json(403, { error: 'ORIGIN_FORBIDDEN', message: 'Use the local development origin.' });
    const url = new URL(req.url ?? '/', origin);
    if (req.method === 'GET' && assets.has(url.pathname)) {
      const [name, contentType] = assets.get(url.pathname)!;
      const content = await readFile(new URL(`../web/${name}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` }); res.end(content); return;
    }
    // Liveness only: this discloses no player state and does not claim database readiness.
    if (req.method === 'GET' && url.pathname === '/healthz') return json(200, { status: 'ok' });
    const access = req.headers['x-development-key'];
    if (typeof access !== 'string' || !timingSafeEqual(digest(access), expectedKey)) return json(401, { error: 'AUTH_REQUIRED', message: 'Enter the local development access key.' });
    // The key represents one development actor; payloads cannot impersonate another.
    const actorId = 'developer-citizen';
    if (req.method === 'GET' && url.pathname === '/api/citizen') return json(200, citizenView(store.snapshot(), actorId, Date.now()));
    if (req.method === 'POST' && url.pathname === '/api/commands') {
      if (req.headers['content-type']?.split(';')[0] !== 'application/json') return json(415, { error: 'JSON_REQUIRED', message: 'Send JSON.' });
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) { bytes += chunk.length; if (bytes > 8192) { req.resume(); throw new DomainError('BODY_TOO_LARGE', 'This request is too large.', 413); } chunks.push(chunk); }
      let command: Command;
      try { command = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DomainError('INVALID_JSON', 'Send a valid JSON command.', 400); }
      const result = await store.dispatch(actorId, command, Date.now());
      return json(200, { ...result, view: citizenView(store.snapshot(), actorId, Date.now()) });
    }
    return json(404, { error: 'NOT_FOUND', message: 'Unknown route.' });
  } catch (error) {
    if (error instanceof DomainError) return json(error.status, { error: error.code, message: error.message });
    console.error('Development request failed:', (error as Error).message);
    return json(500, { error: 'SERVER_ERROR', message: 'The action was not confirmed. Retry with the same request identifier.' });
  }
});
server.requestTimeout = 10_000;
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') origin = `http://127.0.0.1:${address.port}`;
  console.log(`Development foundation: ${origin}`); console.log(`Development access key: ${key}`);
});
