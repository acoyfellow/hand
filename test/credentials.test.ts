import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig, readToken } from '../src/credentials.ts';
import { findHelper, helperOrBuild } from '../src/helper.ts';

test('HAND_ACCOUNT_ID and HAND_GATEWAY win over any config file', () => {
  expect(readConfig({ HAND_ACCOUNT_ID: 'acct-1', HAND_GATEWAY: 'gw-1' }, '/tmp/nonexistent.json')).toEqual({ accountId: 'acct-1', gateway: 'gw-1' });
});

test('HAND_TOKEN wins over the Keychain and token files', () => {
  expect(readToken({ HAND_TOKEN: '  tok-1  ' })).toBe('tok-1');
});

test('no old DO_ names are read', () => {
  expect(readToken({ DO_TOKEN: 'old', HAND_TOKEN: 'new' })).toBe('new');
  expect(readConfig({ DO_ACCOUNT_ID: 'old', HAND_ACCOUNT_ID: 'new' }, '/tmp/nonexistent.json').accountId).toBe('new');
});

test('a HAND_AX_HELPER path that does not exist is reported, not silently replaced', () => {
  const env = { HAND_AX_HELPER: '/nowhere/ax' };
  expect(findHelper(env)).toBeUndefined();
  expect(() => helperOrBuild(env)).toThrow('HAND_AX_HELPER points at /nowhere/ax');
});

test('invalid JSON in config file throws an error naming the file', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'hand-test-'));
  const configPath = join(tempDir, 'config.json');
  writeFileSync(configPath, '{invalid json}');
  expect(() => readConfig({ HAND_ACCOUNT_ID: 'test' }, configPath)).toThrow(`${configPath} is not valid JSON`);
});

test('missing config file returns empty and falls back to shared', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'hand-test-'));
  const configPath = join(tempDir, 'nonexistent.json');
  expect(() => readConfig({ HAND_ACCOUNT_ID: 'acct-1' }, configPath)).not.toThrow();
});
