import { describe, expect, test } from 'bun:test';
import type { Hand } from '../src/hand.ts';
import { handle, type Session, TOOLS } from '../src/mcp.ts';

const fakeHand = {
  outline: async () => '2 controls on screen',
  act: async (intent: string, confirm: boolean) => (intent.includes('Delete') && !confirm ? 'BLOCKED: looks destructive' : `Clicked ${intent}`),
  type: async (value: string, into: string) => `Typed "${value}" into ${into}`,
  look: async () => 'p(yes)=0.90',
} as unknown as Hand;

const session = (): Session => ({ helper: '/bin/false', hand: () => fakeHand, receipts: () => [] });
const call = (name: string, args: Record<string, unknown>) =>
  handle(session, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

describe('hand mcp', () => {
  test('initialize and list tools', async () => {
    const init = (await handle(session, { jsonrpc: '2.0', id: 0, method: 'initialize' })) as { result: { serverInfo: { name: string } } };
    expect(init.result.serverInfo.name).toBe('hand');
    const listed = (await handle(session, { jsonrpc: '2.0', id: 1, method: 'tools/list' })) as { result: { tools: { name: string }[] } };
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
    expect(await handle(session, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
  });
});
