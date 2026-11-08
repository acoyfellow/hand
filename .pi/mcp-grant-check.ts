import { spawn } from 'node:child_process';

const bin = '/Users/jcoeyman/cloudflare/do/dist/hand.app/Contents/Resources/bin/hand';
const env = { ...process.env, HAND_AX_HELPER: '/Users/jcoeyman/cloudflare/do/dist/hand.app/Contents/Resources/bin/ax'};
delete env.HAND_TOKEN;
delete env.HAND_ACCOUNT_ID;
const child = spawn(bin, ['mcp'], { env, stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '';
const replies = new Map<number, (value: unknown) => void>();
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
    const line = buffer.slice(0, at);
    buffer = buffer.slice(at + 1);
    const message = JSON.parse(line) as { id?: number };
    if (message.id !== undefined) replies.get(message.id)?.(message);
  }
});
const call = (id: number, method: string, params: unknown) =>
  new Promise((resolve) => {
    replies.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
await call(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } });
const reply = (await call(2, 'tools/call', { name: 'act', arguments: { app: 'hand', intent: 'press the Copy command only button' } })) as { result?: { content?: { text: string }[]; isError?: boolean } };
console.log(JSON.stringify(reply.result?.content?.[0]?.text ?? reply).slice(0, 400));
child.kill();
