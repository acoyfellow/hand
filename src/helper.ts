import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAND_DIR } from './credentials.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HELPER_SOURCE = join(packageRoot, 'native', 'ax.swift');
export const BUNDLED_HELPER = join(packageRoot, 'native', 'ax');
export const BUILT_HELPER = join(HAND_DIR, 'bin', 'ax');
export const RELEASES_URL = 'https://github.com/acoyfellow/hand/releases/latest';

export const hasSwift = () => {
  try {
    execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'ignore', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
};

export function findHelper(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.HAND_AX_HELPER) return existsSync(env.HAND_AX_HELPER) ? env.HAND_AX_HELPER : undefined;
  return [BUNDLED_HELPER, BUILT_HELPER].find((path) => existsSync(path));
}

export function buildHelper(target = BUILT_HELPER): string {
  mkdirSync(dirname(target), { recursive: true });
  execFileSync('xcrun', ['swiftc', '-O', HELPER_SOURCE, '-o', target], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 300_000 });
  return target;
}

export function helperOrBuild(env: NodeJS.ProcessEnv = process.env): string {
  if (env.HAND_AX_HELPER && !existsSync(env.HAND_AX_HELPER)) throw new Error(`HAND_AX_HELPER points at ${env.HAND_AX_HELPER}, which does not exist.`);
  const found = findHelper(env);
  if (found) return found;
  if (process.platform !== 'darwin') throw new Error('The hand accessibility helper runs only on macOS.');
  if (!hasSwift()) {
    throw new Error(
      `hand needs its small macOS helper. Install Xcode command line tools (xcode-select --install) so hand can build it, or download it from ${RELEASES_URL} and set HAND_AX_HELPER to its path. Run \`hand doctor\` for every step.`,
    );
  }
  return buildHelper();
}

export const CURSOR_SOCKET = process.env.HAND_CURSOR_SOCKET ?? '/tmp/hand-cursor.sock';

export function cursorOverlayBeside(helper: string): string | undefined {
  const overlay = join(dirname(helper), 'hand-cursor');
  return existsSync(overlay) ? overlay : undefined;
}

export function startCursorOverlay(helper: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.HAND_CURSOR === '0' || !helper || existsSync(CURSOR_SOCKET)) return existsSync(CURSOR_SOCKET);
  const overlay = cursorOverlayBeside(helper);
  if (!overlay) return false;
  spawn(overlay, [], { detached: true, stdio: 'ignore' }).unref();
  return true;
}
