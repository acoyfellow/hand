import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hand } from '../src/hand.ts';
import { handle, normalizeChord, type Session, TOOLS } from '../src/mcp.ts';

const fakeHand = {
  outline: async () => '2 controls on screen',
  act: async (intent: string, confirm: boolean) => (intent.includes('Delete') && !confirm ? 'BLOCKED: looks destructive' : `Clicked ${intent}`),
  type: async (value: string, into: string) => `Typed "${value}" into ${into}`,
  look: async () => 'p(yes)=0.90',
  assess: async (action: string) => ({ p: action.includes('Empty Trash') || action.includes('cmd+backspace') ? 0.9 : 0.1, costUsd: 0.001 }),
  opts: { riskTau: 0.5 },
} as unknown as Hand;

const makeSession = (): Session => ({ helper: '/bin/false', hand: () => fakeHand, receipts: () => [], notify: () => {} });
const call = (name: string, args: Record<string, unknown>) =>
  handle(() => makeSession(), { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

describe('hand mcp', () => {
  test('initialize and list tools', async () => {
    const init = (await handle(() => makeSession(), { jsonrpc: '2.0', id: 0, method: 'initialize' })) as { result: { serverInfo: { name: string } } };
    expect(init.result.serverInfo.name).toBe('hand');
    const listed = (await handle(() => makeSession(), { jsonrpc: '2.0', id: 1, method: 'tools/list' })) as { result: { tools: { name: string }[] } };
    expect(listed.result.tools.map((tool) => tool.name)).toEqual(TOOLS.map((tool) => tool.name));
  });

  test('act passes confirm and keeps the destructive block', async () => {
    const blocked = (await call('act', { app: 'TextEdit', intent: 'Delete account' })) as { result: { content: { text: string }[] } };
    expect(blocked.result.content[0]?.text).toContain('BLOCKED');
    const confirmed = (await call('act', { app: 'TextEdit', intent: 'Delete account', confirm: true })) as { result: { content: { text: string }[] } };
    expect(confirmed.result.content[0]?.text).toContain('Clicked');
  });

  test('missing arguments become tool errors, not crashes', async () => {
    const missing = (await call('type', { app: 'TextEdit', text: 'x' })) as { result: { isError: boolean; content: { text: string }[] } };
    expect(missing.result.isError).toBe(true);
    expect(missing.result.content[0]?.text).toContain('into is required');
  });

  test('steps runs actions in order and stops at the first refusal', async () => {
    const ran = (await call('steps', {
      app: 'TextEdit',
      steps: [
        { tool: 'act', intent: 'the New button' },
        { tool: 'type', text: 'hello', into: 'the body' },
        { tool: 'act', intent: 'Delete account' },
        { tool: 'act', intent: 'never reached' },
      ],
    })) as { result: { content: { text: string }[] } };
    const body = ran.result.content[0]?.text ?? '';
    expect(body).toContain('1. act: Clicked the New button');
    expect(body).toContain('2. type: Typed "hello" into the body');
    expect(body).toContain('3. act: BLOCKED');
    expect(body).toContain('Stopped after step 3 of 4.');
    expect(body).not.toContain('never reached');
  });

  test('steps refuses a tool that is not a step', async () => {
    const ran = (await call('steps', { app: 'TextEdit', steps: [{ tool: 'look', question: 'x' }] })) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(ran.result.isError).toBe(true);
    expect(ran.result.content[0]?.text).toContain('not a step tool');
  });

  test('notifications get no reply', async () => {
    expect(await handle(() => makeSession(), { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
  });

  test('helper non-JSON stdout produces isError with JSON parse failure message', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'hand-mcp-test-'));
    const helperScript = join(tempDir, 'boom.sh');
    writeFileSync(helperScript, '#!/bin/sh\necho "boom"\n');
    chmodSync(helperScript, 0o755);

    const badSessionFactory = () => ({ helper: helperScript, hand: () => fakeHand, receipts: () => [] } as Session);
    const result = (await handle(badSessionFactory, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'activate', arguments: { app: 'TextEdit' } } })) as {
      result: { isError: boolean; content: { text: string }[] };
    };

    expect(result.result.isError).toBe(true);
    expect(result.result.content[0]?.text).toContain('did not answer with JSON');
    expect(result.result.content[0]?.text).toContain('boom');
  });

  test('steps with type that includes "failed" text succeeds both steps', async () => {
    const successHand: Hand = {
      outline: async () => 'controls',
      act: async () => 'Clicked e2',
      type: async (value: string, into: string) => `Typed "${value}" into ${into}`,
      look: async () => 'looks good',
    } as unknown as Hand;

    const successSession = (): Session => ({
      helper: '/bin/false',
      hand: () => successHand,
      receipts: () => [],
    });

    const ran = (await handle(successSession, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'steps',
        arguments: {
          app: 'TextEdit',
          steps: [
            { tool: 'type', text: 'deploy failed on staging', into: 'e1' },
            { tool: 'act', intent: 'e2' },
          ],
        },
      },
    })) as { result: { isError: boolean; content: { text: string }[] } };

    const body = ran.result.content[0]?.text ?? '';
    expect(body).toContain('1. type: Typed "deploy failed on staging" into e1');
    expect(body).toContain('2. act: Clicked e2');
    expect(body).not.toContain('Stopped');
    expect(ran.result.isError).toBe(false);
  });

  test('steps stops when reply text starts with BLOCKED:', async () => {
    const blockedReplyHand: Hand = {
      outline: async () => 'controls',
      act: async () => 'BLOCKED: cannot click this',
      type: async () => 'unreachable',
      look: async () => 'ok',
    } as unknown as Hand;

    const blockedReplySession = (): Session => ({
      helper: '/bin/false',
      hand: () => blockedReplyHand,
      receipts: () => [],
    });

    const ran = (await handle(blockedReplySession, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'steps',
        arguments: {
          app: 'TextEdit',
          steps: [
            { tool: 'act', intent: 'button' },
            { tool: 'type', text: 'never', into: 'field' },
          ],
        },
      },
    })) as { result: { isError: boolean; content: { text: string }[] } };

    const body = ran.result.content[0]?.text ?? '';
    expect(body).toContain('1. act: BLOCKED:');
    expect(body).toContain('Stopped after step 1 of 2.');
    expect(body).not.toContain('never');
  });

  test('menu blocks destructive items unless confirm is true', async () => {
    const blocked = (await call('menu', { app: 'Finder', path: ['Finder', 'Empty Trash'] })) as { result: { content: { text: string }[] } };
    expect(blocked.result.content[0]?.text).toContain('BLOCKED');
    expect(blocked.result.content[0]?.text).toContain('Empty Trash');
    expect(blocked.result.content[0]?.text).toContain('p=0.90');
  });

  test('menu allows destructive items with confirm=true', async () => {
    const confirmed = (await call('menu', { app: 'Finder', path: ['Finder', 'Empty Trash'], confirm: true })) as { result: { content: { text: string }[] } };
    expect(confirmed.result.content[0]?.text).not.toContain('BLOCKED');
  });

  test('key blocks known destructive shortcuts without asking the model', async () => {
    for (const key of ['cmd+backspace', 'Command+Shift+Delete', 'shift+cmd+backspace', 'cmd+q']) {
      const blocked = (await call('key', { app: 'Finder', key })) as { result: { content: { text: string }[] } };
      expect(blocked.result.content[0]?.text).toStartWith('BLOCKED');
      expect(blocked.result.content[0]?.text).toContain(key);
    }
  });

  test('key asks the model for a shortcut not on the list', async () => {
    const blocked = (await call('key', { app: 'Notes', key: 'ctrl+cmd+backspace' })) as { result: { content: { text: string }[] } };
    expect(blocked.result.content[0]?.text).toContain('BLOCKED');
    expect(blocked.result.content[0]?.text).toContain('p=0.90');
  });

  test('normalizeChord orders modifiers and maps aliases', () => {
    expect(normalizeChord('Shift+Command+Delete')).toBe('cmd+shift+delete');
    expect(normalizeChord('alt+cmd+backspace')).toBe('cmd+option+backspace');
    expect(normalizeChord('return')).toBe('return');
  });

  test('key allows destructive shortcuts with confirm=true', async () => {
    const confirmed = (await call('key', { app: 'TextEdit', key: 'cmd+backspace', confirm: true })) as { result: { content: { text: string }[] } };
    expect(confirmed.result.content[0]?.text).not.toContain('BLOCKED');
  });
});
