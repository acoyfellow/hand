import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/client', import.meta.url));

const fileAt = async (pathname: string) => {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = safe.endsWith('/') ? [`${safe}index.html`] : [safe, `${safe}/index.html`];
  for (const candidate of candidates) {
    const file = Bun.file(join(root, candidate));
    if (await file.exists()) return { file, redirect: candidate.endsWith('/index.html') && !safe.endsWith('/') };
  }
  return undefined;
};

export const serveSite = (port: number) =>
  Bun.serve({
    port,
    hostname: '127.0.0.1',
    fetch: async (request) => {
      const url = new URL(request.url);
      const found = await fileAt(url.pathname);
      if (!found) return new Response(Bun.file(join(root, '404.html')), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
      if (found.redirect) return Response.redirect(`${url.pathname}/${url.search}`, 307);
      return new Response(found.file);
    },
  });

if (import.meta.main) {
  const server = serveSite(Number(process.env.PORT ?? 8798));
  console.log(`hand site (built) on ${server.url}`);
}
