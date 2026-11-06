#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';
import { CONFIG_FILE, KEYCHAIN_SERVICE, readConfig, readToken } from './credentials.ts';
import { buildHelper, findHelper, hasSwift, RELEASES_URL } from './helper.ts';
import { startServer } from './mcp.ts';

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly fix?: string;
}

const USAGE = `hand: a computer-use library where a small model picks what to click.

Usage:
  hand doctor   check credentials, the macOS helper and permissions, with the fix for anything missing
  hand mcp      run the MCP server on stdio (tools: apps, activate, outline, act, type, key, steps, look)
  hand help     show this

More at hand.coey.dev`;

const attempt = <T>(read: () => T): { value?: T; error?: string } => {
  try {
    return { value: read() };
  } catch (error) {
    return { error: (error as Error).message };
  }
};

const checkPlatform = (): Check =>
  process.platform === 'darwin'
    ? { name: 'macOS', ok: true, detail: `macOS on ${process.arch}` }
    : {
        name: 'macOS',
        ok: false,
        detail: `${process.platform} is not supported for desktop control yet`,
        fix: 'Run hand on a Mac. The browser device (hand/devices/browser) works anywhere Playwright does.',
      };

const checkAccount = (): Check => {
  const { value } = attempt(() => readConfig());
  return value
    ? { name: 'Cloudflare account', ok: true, detail: `account ${value.accountId.slice(0, 6)}…, AI Gateway "${value.gateway}"` }
    : {
        name: 'Cloudflare account',
        ok: false,
        detail: 'missing',
        fix: `Find your account id in the Cloudflare dashboard (Workers AI > Use REST API), then either export HAND_ACCOUNT_ID=<id>, or write ${CONFIG_FILE} as {"accountId": "<id>", "gateway": "default"}. Add HAND_GATEWAY=<name> if your AI Gateway is not called "default".`,
      };
};

const checkToken = (): Check => {
  const { value } = attempt(() => readToken());
  return value
    ? { name: 'Cloudflare API token', ok: true, detail: `found (${value.length} characters)` }
    : {
        name: 'Cloudflare API token',
        ok: false,
        detail: 'missing',
        fix: `Create a token at https://dash.cloudflare.com/profile/api-tokens with "Workers AI: Read" and "AI Gateway: Run". Then store it in the Keychain: security add-generic-password -a "$USER" -s ${KEYCHAIN_SERVICE} -w   (or export HAND_TOKEN=<token>).`,
      };
};

const checkHelper = (): { check: Check; helper?: string } => {
  const found = findHelper();
  if (found) return { check: { name: 'macOS helper', ok: true, detail: found }, helper: found };
  if (process.env.HAND_AX_HELPER) {
    return {
      check: {
        name: 'macOS helper',
        ok: false,
        detail: `HAND_AX_HELPER points at ${process.env.HAND_AX_HELPER}, which does not exist`,
        fix: 'Fix the path, or unset HAND_AX_HELPER to let hand build its own.',
      },
    };
  }
  if (!hasSwift()) {
    return {
      check: {
        name: 'macOS helper',
        ok: false,
        detail: 'not built, and no Swift compiler to build it',
        fix: `Run xcode-select --install, then hand doctor again. Or download hand-ax from ${RELEASES_URL}, run xattr -d com.apple.quarantine ax, and export HAND_AX_HELPER=<path to ax>.`,
      },
    };
  }
  const built = attempt(() => buildHelper());
  return built.value
    ? { check: { name: 'macOS helper', ok: true, detail: `built ${built.value}` }, helper: built.value }
    : {
        check: {
          name: 'macOS helper',
          ok: false,
          detail: `build failed: ${built.error}`,
          fix: 'Run xcode-select --install, or download the helper from the releases page.',
        },
      };
};

const checkPermissions = (helper: string | undefined): Check[] => {
  if (!helper) return [];
  const report = attempt(
    () => JSON.parse(execFileSync(helper, ['permissions'], { encoding: 'utf8', timeout: 10_000 })) as { accessibility: boolean; screenRecording: boolean },
  );
  if (!report.value) return [{ name: 'permissions', ok: false, detail: report.error ?? 'helper did not answer' }];
  const host = process.env.TERM_PROGRAM ?? 'the app that runs hand (your terminal or agent app)';
  return [
    report.value.accessibility
      ? { name: 'Accessibility permission', ok: true, detail: 'granted' }
      : {
          name: 'Accessibility permission',
          ok: false,
          detail: 'not granted',
          fix: `System Settings > Privacy & Security > Accessibility: turn on ${host}, then restart it.`,
        },
    report.value.screenRecording
      ? { name: 'Screen Recording permission', ok: true, detail: 'granted' }
      : {
          name: 'Screen Recording permission',
          ok: false,
          detail: 'not granted (only the look tool and screenshots need it)',
          fix: `System Settings > Privacy & Security > Screen & System Audio Recording: turn on ${host}, then restart it.`,
        },
  ];
};

const doctor = () => {
  const { check: helperCheck, helper } = checkHelper();
  const checks = [checkPlatform(), checkAccount(), checkToken(), helperCheck, ...checkPermissions(helper)];
  for (const check of checks) {
    console.log(`${check.ok ? 'ok  ' : 'FIX '} ${check.name}: ${check.detail}`);
    if (!check.ok && check.fix) console.log(`     → ${check.fix}`);
  }
  const failing = checks.filter((check) => !check.ok).length;
  console.log(
    failing === 0
      ? '\nhand is ready. Add it to your agent with: {"command": "bunx", "args": ["hand", "mcp"]}'
      : `\n${failing} thing${failing === 1 ? '' : 's'} to fix.`,
  );
  process.exit(failing === 0 ? 0 : 1);
};

const command = process.argv[2] ?? 'help';
if (command === 'doctor') doctor();
else if (command === 'mcp') startServer();
else {
  console.log(USAGE);
  process.exit(command === 'help' || command === '--help' || command === '-h' ? 0 : 1);
}
