import { expect, test } from 'bun:test';
import { readConfig, readToken } from '../src/credentials.ts';
import { findHelper, helperOrBuild } from '../src/helper.ts';

test('HAND_ACCOUNT_ID and HAND_GATEWAY win over any config file', () => {
  expect(readConfig({ HAND_ACCOUNT_ID: 'acct-1', HAND_GATEWAY: 'gw-1' })).toEqual({ accountId: 'acct-1', gateway: 'gw-1' });
});

test('HAND_TOKEN wins over the Keychain and token files', () => {
  expect(readToken({ HAND_TOKEN: '  tok-1  ' })).toBe('tok-1');
});

test('no old DO_ names are read', () => {
  expect(readToken({ DO_TOKEN: 'old', HAND_TOKEN: 'new' })).toBe('new');
  expect(readConfig({ DO_ACCOUNT_ID: 'old', HAND_ACCOUNT_ID: 'new' }).accountId).toBe('new');
});

test('a HAND_AX_HELPER path that does not exist is reported, not silently replaced', () => {
  const env = { HAND_AX_HELPER: '/nowhere/ax' };
  expect(findHelper(env)).toBeUndefined();
  expect(() => helperOrBuild(env)).toThrow('HAND_AX_HELPER points at /nowhere/ax');
});
