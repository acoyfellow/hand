import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { macosDevice, type Receipt } from '../src/devices/macos.ts';

const fakeHelper = (script: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'hand-ax-'));
  const file = join(dir, 'ax');
  writeFileSync(file, `#!/bin/sh\n${script}\n`);
  chmodSync(file, 0o755);
  return file;
};

const snapshot = JSON.stringify({
  app: 'Fake',
  candidates: [{ id: 'e1', role: 'AXTextArea', name: '', x: 10, y: 20, w: 300, h: 200, path: [0, 0, 0], ref: 'r1' }],
});

describe('macOS device receipts', () => {
  test('passes the snapshot ref, the agent and the headless policy to every targeted action', async () => {
    const log = join(mkdtempSync(join(tmpdir(), 'hand-log-')), 'args');
    const helper = fakeHelper(
      `echo "$@" >> ${log}\ncase "$1" in snapshot) echo '${snapshot}';; set) echo '{"ok":true,"detail":"AXValue 0","delivery":"delivered_verified","mechanism":"semantic_api"}';; value) echo '{"ok":true,"detail":"hello"}';; esac`,
    );
    const events: string[] = [];
    const device = macosDevice({ helper, app: 'Fake', agent: 'alpha', onAction: ({ phase, receipt }) => events.push(`${phase}:${receipt.action}`) });
    const [field] = await device.candidates();
    await device.typeInto(field!, 'hello');
    const calls = (await Bun.file(log).text()).trim().split('\n');
    const setCall = calls.find((line) => line.startsWith('set '));
    expect(setCall).toContain('--ref r1');
    expect(setCall).toContain('--agent alpha');
    expect(setCall).not.toContain('--headed');
    expect(events).toEqual(['before:set', 'after:set']);
    const receipt = device.receipts[0] as Receipt;
    expect(receipt.outcome.delivery).toBe('delivered_verified');
    expect(receipt.target).toEqual({ role: 'textbox', name: '', x: 10, y: 20, w: 300, h: 200 });
  });

  test('a stale ref fails the action instead of acting on another control', async () => {
    const helper = fakeHelper(
      `case "$1" in snapshot) echo '${snapshot}';; set) echo '{"ok":false,"code":"STALE_REF","detail":"changed","delivery":"not_delivered","mechanism":"none"}'; exit 1;; esac`,
    );
    const device = macosDevice({ helper, app: 'Fake' });
    const [field] = await device.candidates();
    await expect(device.typeInto(field!, 'hello')).rejects.toThrow('STALE_REF');
  });

  test('headless devices refuse to fall back to keystrokes', async () => {
    const helper = fakeHelper(
      `case "$1" in snapshot) echo '${snapshot}';; set) echo '{"ok":false,"code":"NOT_VERIFIED","detail":"read back differs","delivery":"delivered_unverified"}'; exit 1;; value) echo '{"ok":true,"detail":""}';; type) echo '{"ok":true,"detail":"typed"}';; esac`,
    );
    const device = macosDevice({ helper, app: 'Fake' });
    const [field] = await device.candidates();
    await expect(device.typeInto(field!, 'hello')).rejects.toThrow('keystrokes are off unless the device is headed');
  });
});

test('shouldAsk asks when the pick is unlikely or the top two are close', async () => {
  const { shouldAsk } = await import('../src/steer.ts');
  const base = { method: 'ax_text' as const, model: 'clef' as const, point: { x: 0, y: 0 }, calls: 1, inputTokens: 0, costUsd: 0, ms: 0 };
  expect(shouldAsk({ ...base, p: 0.95, probabilities: { a: 0.95, b: 0.03 } }, 0.5, 0.6)).toBe(false);
  expect(shouldAsk({ ...base, p: 0.4, probabilities: { a: 0.4, b: 0.3 } }, 0.5, 0.6)).toBe(true);
  expect(shouldAsk({ ...base, p: 0.68, probabilities: { a: 0.68, b: 0.3 } }, 0.5, 0.6)).toBe(true);
});
