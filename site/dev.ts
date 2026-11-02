import { watch } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, 'public');
const port = Number(process.env.PORT ?? 8799);
const clients = new Set<ReadableStreamDefaultController<string>>();
const reloadScript = "<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>";

watch(root, { recursive: true }, () => {
  for (const client of clients) client.enqueue('data: reload\n\n');
});

function reloadStream(): Response {
  let own: ReadableStreamDefaultController<string>;
  const body = new ReadableStream<string>({
    start: (controller) => {
      own = controller;
      clients.add(controller);
    },
    cancel: () => {
      clients.delete(own);
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } });
}

async function page(pathname: string): Promise<Response> {
  const path = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const file = Bun.file(join(root, path));
  if (!(await file.exists())) return new Response(Bun.file(join(root, '404.html')), { status: 404 });
  if (!path.endsWith('.html')) return new Response(file);
  const html = (await file.text()).replace('</body>', `${reloadScript}</body>`);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

Bun.serve({
  port,
  hostname: '127.0.0.1',
  idleTimeout: 0,
  fetch: (request) => {
    const { pathname } = new URL(request.url);
    return pathname === '/__reload' ? reloadStream() : page(pathname);
  },
});

console.log(`hand site on http://127.0.0.1:${port}`);
