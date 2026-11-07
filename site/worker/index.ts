import { handleOAuth, type OAuthEnv } from './oauth.ts';

interface Env extends OAuthEnv {
  readonly ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const RANGE = /^bytes=(\d*)-(\d*)$/;

const partial = async (whole: Response, header: string): Promise<Response> => {
  const match = RANGE.exec(header.trim());
  const body = await whole.arrayBuffer();
  const size = body.byteLength;
  const headers = new Headers(whole.headers);
  headers.set('accept-ranges', 'bytes');
  if (!match || (match[1] === '' && match[2] === '')) {
    headers.set('content-range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = match[1] === '' ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[1] === '' || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start > end || start >= size) {
    headers.set('content-range', `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/oauth/')) return handleOAuth(request, env);
    const range = request.headers.get('range');
    if (!range || !url.pathname.endsWith('.mp4') || request.method !== 'GET') return env.ASSETS.fetch(request);
    const plain = new Request(request.url, { method: 'GET', headers: new Headers([...request.headers].filter(([name]) => name.toLowerCase() !== 'range')) });
    const whole = await env.ASSETS.fetch(plain);
    if (whole.status !== 200) return whole;
    return partial(whole, range);
  },
};
