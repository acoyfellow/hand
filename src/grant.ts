import { execFileSync } from 'node:child_process';

export const GRANT_KEYCHAIN_SERVICE = 'hand-oauth';
export const HAND_AUTH_ORIGIN = process.env.HAND_AUTH_ORIGIN ?? 'https://hand.coey.dev';
const REFRESH_EARLY_MS = 120_000;

export interface Grant {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: number;
  readonly accountId: string;
}

export interface GrantStore {
  readonly load: () => Grant | undefined;
  readonly save: (grant: Grant) => void;
}

const isGrant = (value: unknown): value is Grant => {
  const grant = value as Partial<Grant> | null;
  return typeof grant?.accessToken === 'string' && typeof grant.expiresAt === 'number' && typeof grant.accountId === 'string';
};

export const parseGrant = (text: string | undefined): Grant | undefined => {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return isGrant(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

export const keychainGrantStore: GrantStore = {
  load: () => {
    if (process.platform !== 'darwin') return undefined;
    try {
      return parseGrant(
        execFileSync('security', ['find-generic-password', '-a', process.env.USER ?? '', '-s', GRANT_KEYCHAIN_SERVICE, '-w'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 5_000,
        }).trim(),
      );
    } catch {
      return undefined;
    }
  },
  save: (grant) => {
    execFileSync('security', ['add-generic-password', '-U', '-a', process.env.USER ?? '', '-s', GRANT_KEYCHAIN_SERVICE, '-w', JSON.stringify(grant)], {
      stdio: 'ignore',
      timeout: 5_000,
    });
  },
};

export class GrantExpired extends Error {}

export const refreshGrant = async (grant: Grant, send: typeof fetch = fetch, now = Date.now()): Promise<Grant> => {
  if (!grant.refreshToken) throw new GrantExpired('Your Cloudflare sign-in expired. Open the hand app and sign in again.');
  const response = await send(`${HAND_AUTH_ORIGIN}/oauth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: grant.refreshToken }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string | null;
    expires_in?: number;
    error?: string;
  } | null;
  if (!response.ok || typeof body?.access_token !== 'string') {
    throw new GrantExpired(`Cloudflare would not refresh your sign-in (${body?.error ?? response.status}). Open the hand app and sign in again.`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? grant.refreshToken,
    expiresAt: now + (body.expires_in ?? 3600) * 1000,
    accountId: grant.accountId,
  };
};

export const grantTokenSource = (store: GrantStore = keychainGrantStore, send: typeof fetch = fetch): (() => Promise<string>) => {
  let pending: Promise<Grant> | undefined;
  return async () => {
    const grant = store.load();
    if (!grant) throw new GrantExpired('No Cloudflare sign-in. Open the hand app and click Sign in with Cloudflare.');
    if (grant.expiresAt - Date.now() > REFRESH_EARLY_MS) return grant.accessToken;
    pending ??= refreshGrant(grant, send).then((fresh) => {
      store.save(fresh);
      return fresh;
    });
    try {
      return (await pending).accessToken;
    } finally {
      pending = undefined;
    }
  };
};

export const signedInConfig = (store: GrantStore = keychainGrantStore): { accountId: string; gateway: string; token: () => Promise<string> } | undefined => {
  const grant = store.load();
  return grant ? { accountId: grant.accountId, gateway: '', token: grantTokenSource(store) } : undefined;
};
