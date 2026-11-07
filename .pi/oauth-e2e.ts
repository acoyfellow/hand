import { writeFileSync } from 'node:fs';

const origin = 'https://hand.coey.dev';
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
const port = 50_124;
const result = '/tmp/oauth-e2e.json';

const server = Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/callback') return new Response('no', { status: 404 });
    const sealed = url.searchParams.get('sealed');
    if (!sealed) {
      writeFileSync(result, JSON.stringify({ ok: false, error: url.searchParams.get('error') }));
      setTimeout(() => process.exit(1), 100);
      return new Response('failed');
    }
    const collected = await fetch(`${origin}/oauth/collect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sealed, verifier }) });
    const tokens = (await collected.json()) as { access_token?: string; refresh_token?: string | null; expires_in?: number; scope?: string };
    const replay = await fetch(`${origin}/oauth/collect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sealed, verifier: 'x'.repeat(43) }) });
    const token = tokens.access_token ?? '';
    const accounts = (await (await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=50', { headers: { authorization: `Bearer ${token}` } })).json()) as { result?: { id: string; name: string }[] };
    const account = accounts.result?.[0];
    const run = account
      ? await fetch(`https://api.cloudflare.com/client/v4/accounts/${account.id}/ai/run/@cf/meta/llama-3.2-1b-instruct`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'Say ok.', max_tokens: 5 }),
        })
      : null;
    const refreshed = tokens.refresh_token
      ? await fetch(`${origin}/oauth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: tokens.refresh_token }) })
      : null;
    const fresh = refreshed ? ((await refreshed.json()) as { access_token?: string; refresh_token?: string }) : null;
    if (fresh?.refresh_token) await fetch(`${origin}/oauth/revoke`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: fresh.refresh_token }) });
    writeFileSync(
      result,
      JSON.stringify({
        ok: collected.status === 200 && token.length > 0,
        collectStatus: collected.status,
        wrongKeyStatus: replay.status,
        scope: tokens.scope,
        hasRefresh: Boolean(tokens.refresh_token),
        expiresIn: tokens.expires_in,
        accountsSeen: accounts.result?.length ?? 0,
        workersAiStatus: run?.status ?? null,
        refreshStatus: refreshed?.status ?? null,
        refreshGaveNewToken: Boolean(fresh?.access_token && fresh.access_token !== token),
        revoked: Boolean(fresh?.refresh_token),
      }),
    );
    setTimeout(() => process.exit(0), 100);
    return new Response('<h1>Signed in</h1>', { headers: { 'content-type': 'text/html' } });
  },
});

console.log(`${origin}/oauth/start?port=${server.port}&challenge=${challenge}`);
setTimeout(() => process.exit(2), 300_000);
