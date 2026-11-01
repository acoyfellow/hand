import { describe, expect, test } from 'bun:test';
import type { Hand } from '../src/hand.ts';
import { handle, type Session, TOOLS } from '../src/mcp.ts';

const fakeHand = {
  outline: async () => '2 controls on screen',
  act: async (intent: string, confirm: boolean) => (intent.includes('Delete') && !confirm ? 'BLOCKED: looks destructive' : `Clicked ${intent}`),
  type: async (value: string, into: string) => `Typed "${value}" into ${into}`,
  look: async () => 'p(yes)=0.90',
} as unknown as Hand;

const session = (): Session => ({ helper: '/bin/false', hand: () => fakeHand });
const call = (name: string, args: Record<string, unknown>) =>
  handle(session, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

describe('do mcp', () => {
  test('initialize and list tools', async () => {
    const init = (await handle(session, { jsonrpc: '2.0', id: 0, method: 'initialize' })) as { result: { serverInfo: { name: string } } };
    expect(init.result.serverInfo.name).toBe('do');
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

  test('notifications get no reply', async () => {
    expect(await handle(session, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
  });
});
