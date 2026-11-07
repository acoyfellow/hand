import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface GatewayConfig {
  readonly accountId: string;
  readonly gateway: string;
}

export const HAND_DIR = join(homedir(), '.config', 'hand');
export const CONFIG_FILE = join(HAND_DIR, 'config.json');
export const TOKEN_FILE = join(HAND_DIR, 'token');
export const KEYCHAIN_SERVICE = 'hand-gateway';

const SHARED_DIR = join(homedir(), '.config', 'odds');
const SHARED_KEYCHAIN_SERVICE = 'odds-gateway';

const readJson = (path: string): Partial<GatewayConfig> => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Partial<GatewayConfig>;
  } catch {
    return {};
  }
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const own = readJson(CONFIG_FILE);
  const shared = readJson(join(SHARED_DIR, 'config.json'));
  const accountId = env.HAND_ACCOUNT_ID ?? own.accountId ?? shared.accountId;
  const gateway = env.HAND_GATEWAY ?? own.gateway ?? shared.gateway ?? 'default';
  if (!accountId)
    throw new Error(
      `No Cloudflare account id. Set HAND_ACCOUNT_ID, or put {"accountId": "...", "gateway": "default"} in ${CONFIG_FILE}. Run \`hand doctor\` for every step.`,
    );
  return { accountId, gateway };
}

function fromKeychain(service: string): string | undefined {
  if (process.platform !== 'darwin') return undefined;
  try {
    const value = execFileSync('security', ['find-generic-password', '-a', process.env.USER ?? '', '-s', service, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5_000,
    }).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function fromFile(path: string): string | undefined {
  try {
    if ((statSync(path).mode & 0o077) !== 0) throw new Error(`${path} must be chmod 600`);
    return readFileSync(path, 'utf8').trim() || undefined;
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function findToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return (
    env.HAND_TOKEN?.trim() ||
    fromKeychain(KEYCHAIN_SERVICE) ||
    fromFile(TOKEN_FILE) ||
    fromKeychain(SHARED_KEYCHAIN_SERVICE) ||
    fromFile(join(SHARED_DIR, 'token'))
  );
}

export function readToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = findToken(env);
  if (!token) {
    throw new Error(
      `No Cloudflare API token. Set HAND_TOKEN, or store it with: security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w. Run \`hand doctor\` for every step.`,
    );
  }
  return token;
}

export function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join('[redacted]') : text;
}
