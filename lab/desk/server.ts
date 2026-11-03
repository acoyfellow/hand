import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dir;
const appHtml = readFileSync(process.env.DESK_APP_HTML ?? join(here, '..', '..', 'bench', 'fixtures', 'app.html'), 'utf8').replace('</head>', '<script src="/bridge.js"></script></head>');

const files: Record<string, { path: string; type: string }> = {
  '/manifest.webmanifest': { path: 'pwa/manifest.webmanifest', type: 'application/manifest+json' },
  '/sw.js': { path: 'pwa/sw.js', type: 'text/javascript' },
  '/bridge.js': { path: 'pwa/bridge.js', type: 'text/javascript' },
  '/icon.svg': { path: 'pwa/icon.svg', type: 'image/svg+xml' },
};

let state: unknown = null;
let stateAt = 0;

const port = Number(process.env.DESK_PORT ?? 8787);

Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/app') return new Response(appHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    const file = files[url.pathname];
    if (file) return new Response(readFileSync(join(here, file.path)), { headers: { 'content-type': file.type } });
    if (url.pathname === '/state' && request.method === 'POST') {
      state = await request.json();
      stateAt = Date.now();
      return new Response('ok');
    }
    if (url.pathname === '/state') return Response.json({ state, stateAt });
    if (url.pathname === '/reset' && request.method === 'POST') {
      state = null;
      stateAt = 0;
      return new Response('ok');
    }
    return new Response('not found', { status: 404 });
  },
});

console.log(`desk server on http://127.0.0.1:${port}`);
