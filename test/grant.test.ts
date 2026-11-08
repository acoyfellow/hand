import { expect, test } from 'bun:test';
import { workersAiUrl } from '../src/clef.ts';
import { type Grant, type GrantStore, grantTokenSource, parseGrant } from '../src/grant.ts';

const memoryStore = (start: Grant): GrantStore & { saved: Grant[] } => {
  let current = start;
  const saved: Grant[] = [];
  return { saved, load: () => current, save: (grant) => { current = grant; saved.push(grant); } };
};

test('a fresh grant is used without asking hand.coey.dev', async () => {
  const store = memoryStore({ accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() + 3_600_000, accountId: 'acct' });
  const send = (() => { throw new Error('no network expected'); }) as unknown as typeof fetch;
  expect(await grantTokenSource(store, send)()).toBe('a1');
});

test('an expiring grant is refreshed once and the new refresh token is stored', async () => {
  const store = memoryStore({ accessToken: 'old', refreshToken: 'r1', expiresAt: Date.now() + 1_000, accountId: 'acct' });
  let calls = 0;
  const send = (async (_url: string, init: RequestInit) => {
    calls += 1;
    expect(JSON.parse(String(init.body))).toEqual({ refresh_token: 'r1' });
    return new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 }));
  }) as unknown as typeof fetch;
  const token = grantTokenSource(store, send);
  expect(await Promise.all([token(), token()])).toEqual(['new', 'new']);
  expect(calls).toBe(1);
  expect(store.saved[0]).toMatchObject({ accessToken: 'new', refreshToken: 'r2', accountId: 'acct' });
});

test('a refused refresh says to sign in again', async () => {
  const store = memoryStore({ accessToken: 'old', refreshToken: 'r1', expiresAt: 0, accountId: 'acct' });
  const send = (async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as unknown as typeof fetch;
  await expect(grantTokenSource(store, send)()).rejects.toThrow('sign in again');
});

test('bad Keychain text is ignored', () => {
  expect(parseGrant('not json')).toBeUndefined();
  expect(parseGrant('{"accessToken":"a"}')).toBeUndefined();
});

test('signed-in users call Workers AI on their own account directly', () => {
  expect(workersAiUrl('acct', '', '@cf/x')).toBe('https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/x');
  expect(workersAiUrl('acct', 'gw', '@cf/x')).toBe('https://gateway.ai.cloudflare.com/v1/acct/gw/workers-ai/@cf/x');
});
