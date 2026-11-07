export interface OAuthEnv {
  readonly OAUTH_CLIENT_ID?: string;
  readonly OAUTH_CLIENT_SECRET?: string;
  readonly SESSION_SECRET?: string;
}

const CLOUDFLARE = {
  authorize: 'https://dash.cloudflare.com/oauth2/auth',
  token: 'https://dash.cloudflare.com/oauth2/token',
  revoke: 'https://dash.cloudflare.com/oauth2/revoke',
} as const;

export const SCOPES = ['offline_access', 'user-details.read', 'ai.read'] as const;

const FLOW_COOKIE = '__Host-hand-flow';
const FLOW_SECONDS = 600;
const HANDOFF_SECONDS = 120;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

type Ready = { readonly clientId: string; readonly clientSecret: string; readonly sessionSecret: string };

type Flow = { readonly state: string; readonly verifier: string; readonly challenge: string; readonly port: number; readonly expires: number };

type Handoff = { readonly tokens: unknown; readonly challenge: string; readonly expires: number };

const ready = (env: OAuthEnv): Ready | null =>
  env.OAUTH_CLIENT_ID && env.OAUTH_CLIENT_SECRET && env.SESSION_SECRET
    ? { clientId: env.OAUTH_CLIENT_ID, clientSecret: env.OAUTH_CLIENT_SECRET, sessionSecret: env.SESSION_SECRET }
    : null;

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

const fromBase64Url = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4)), (char) => char.charCodeAt(0));

const randomToken = (): string => base64Url(crypto.getRandomValues(new Uint8Array(32)));

export const challengeOf = async (verifier: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

const sealKey = async (secret: string, purpose: string): Promise<CryptoKey> => {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}:${secret}`));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const seal = async (secret: string, purpose: string, value: unknown): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(secret, purpose), new TextEncoder().encode(JSON.stringify(value))));
  return `${base64Url(iv)}.${base64Url(body)}`;
};

export const open = async <T>(secret: string, purpose: string, sealed: string): Promise<T | null> => {
  const [iv, body] = sealed.split('.');
  if (!iv || !body) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(iv) }, await sealKey(secret, purpose), fromBase64Url(body));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const page = (title: string, detail: string, status = 200): Response =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><body style="font:16px system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem"><h1 style="font-size:1.4rem">${title}</h1><p>${detail}</p></body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

const cookieValue = (request: Request, name: string): string | null => {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
};

const flowCookie = (value: string, maxAge: number): string => `${FLOW_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

const tokenRequest = async (client: Ready, body: Record<string, string>): Promise<Response> => {
  const response = await fetch(CLOUDFLARE.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}` },
    body: new URLSearchParams(body).toString(),
  });
  const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || typeof parsed?.access_token !== 'string') {
    const reason = typeof parsed?.error === 'string' ? parsed.error : `status ${response.status}`;
    return json({ error: reason }, response.status === 400 ? 400 : 502);
  }
  return json({
    access_token: parsed.access_token,
    refresh_token: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null,
    expires_in: typeof parsed.expires_in === 'number' ? parsed.expires_in : 3600,
    scope: typeof parsed.scope === 'string' ? parsed.scope : '',
  });
};

const start = async (request: Request, client: Ready, url: URL): Promise<Response> => {
  const port = Number(url.searchParams.get('port'));
  const challenge = url.searchParams.get('challenge') ?? '';
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !CHALLENGE.test(challenge)) return page('Open hand to sign in', 'Start sign-in from the hand app on your Mac.', 400);
  const flow: Flow = { state: randomToken(), verifier: randomToken(), challenge, port, expires: Date.now() + FLOW_SECONDS * 1000 };
  const target = new URL(CLOUDFLARE.authorize);
  target.searchParams.set('response_type', 'code');
  target.searchParams.set('client_id', client.clientId);
  target.searchParams.set('redirect_uri', `${url.origin}/oauth/callback`);
  target.searchParams.set('scope', SCOPES.join(' '));
  target.searchParams.set('state', flow.state);
  target.searchParams.set('code_challenge', await challengeOf(flow.verifier));
  target.searchParams.set('code_challenge_method', 'S256');
  return new Response(null, { status: 302, headers: { location: target.toString(), 'set-cookie': flowCookie(await seal(client.sessionSecret, 'flow', flow), FLOW_SECONDS), 'cache-control': 'no-store' } });
};

const callback = async (request: Request, client: Ready, url: URL): Promise<Response> => {
  const sealed = cookieValue(request, FLOW_COOKIE);
  const flow = sealed ? await open<Flow>(client.sessionSecret, 'flow', sealed) : null;
  if (!flow || flow.expires < Date.now() || url.searchParams.get('state') !== flow.state) return page('Sign-in expired', 'Go back to the hand app and click Sign in with Cloudflare again.', 400);
  const back = new URL(`http://127.0.0.1:${flow.port}/callback`);
  const clear = { 'set-cookie': flowCookie('', 0), 'cache-control': 'no-store' };
  const code = url.searchParams.get('code');
  if (!code) {
    back.searchParams.set('error', url.searchParams.get('error') ?? 'cancelled');
    return new Response(null, { status: 302, headers: { location: back.toString(), ...clear } });
  }
  const exchanged = await tokenRequest(client, { grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/oauth/callback`, code_verifier: flow.verifier });
  if (!exchanged.ok) {
    back.searchParams.set('error', ((await exchanged.json()) as { error: string }).error);
    return new Response(null, { status: 302, headers: { location: back.toString(), ...clear } });
  }
  const handoff: Handoff = { tokens: await exchanged.json(), challenge: flow.challenge, expires: Date.now() + HANDOFF_SECONDS * 1000 };
  back.searchParams.set('sealed', await seal(client.sessionSecret, 'handoff', handoff));
  return new Response(null, { status: 302, headers: { location: back.toString(), ...clear } });
};

const readBody = async (request: Request): Promise<Record<string, unknown>> => ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {};

const collect = async (request: Request, client: Ready): Promise<Response> => {
  const body = await readBody(request);
  if (typeof body.sealed !== 'string' || typeof body.verifier !== 'string') return json({ error: 'sealed and verifier are required' }, 400);
  const handoff = await open<Handoff>(client.sessionSecret, 'handoff', body.sealed);
  if (!handoff || handoff.expires < Date.now() || (await challengeOf(body.verifier)) !== handoff.challenge) return json({ error: 'expired or not yours' }, 403);
  return json(handoff.tokens);
};

const refresh = async (request: Request, client: Ready): Promise<Response> => {
  const body = await readBody(request);
  if (typeof body.refresh_token !== 'string') return json({ error: 'refresh_token is required' }, 400);
  return tokenRequest(client, { grant_type: 'refresh_token', refresh_token: body.refresh_token });
};

const revoke = async (request: Request, client: Ready): Promise<Response> => {
  const body = await readBody(request);
  if (typeof body.token !== 'string') return json({ error: 'token is required' }, 400);
  await fetch(CLOUDFLARE.revoke, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}` },
    body: new URLSearchParams({ token: body.token }).toString(),
  }).catch(() => undefined);
  return json({ revoked: true });
};

export const handleOAuth = async (request: Request, env: OAuthEnv): Promise<Response> => {
  const url = new URL(request.url);
  const client = ready(env);
  if (url.pathname === '/oauth/status') return json({ ready: client !== null, scopes: SCOPES });
  if (!client) return page('Sign in with Cloudflare is not open yet', 'Use a Cloudflare API token in the hand app for now.', 503);
  const origin = request.headers.get('origin');
  if (request.method === 'POST' && origin !== null && origin !== url.origin) return json({ error: 'wrong origin' }, 403);
  if (request.method === 'GET' && url.pathname === '/oauth/start') return start(request, client, url);
  if (request.method === 'GET' && url.pathname === '/oauth/callback') return callback(request, client, url);
  if (request.method === 'POST' && url.pathname === '/oauth/collect') return collect(request, client);
  if (request.method === 'POST' && url.pathname === '/oauth/refresh') return refresh(request, client);
  if (request.method === 'POST' && url.pathname === '/oauth/revoke') return revoke(request, client);
  return json({ error: 'not found' }, 404);
};
