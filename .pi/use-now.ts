import { spawn } from 'node:child_process';

const bin = '/Users/jcoeyman/cloudflare/do/dist/hand.app/Contents/Resources/bin';
const env = { ...process.env, HAND_AX_HELPER: `${bin}/ax`, HAND_CURSOR_WAIT_MS: '600' };
delete env.HAND_TOKEN;
const child = spawn(`${bin}/hand`, ['mcp'], { env, stdio: ['pipe', 'pipe', 'ignore'] });
let buffer = '';
const waiting = new Map<number, (value: any) => void>();
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
    const message = JSON.parse(buffer.slice(0, at));
    buffer = buffer.slice(at + 1);
    if (message.id !== undefined) waiting.get(message.id)?.(message);
  }
});
let next = 0;
const call = (name: string, args: unknown) =>
  new Promise<string>((resolve) => {
    const id = ++next;
    waiting.set(id, (m) => resolve(m.result?.content?.[0]?.text ?? JSON.stringify(m.error)));
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: id === 1 ? 'initialize' : 'tools/call', params: id === 1 ? { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pi', version: '1' } } : { name, arguments: args } })}\n`);
  });
await call('', {});
const started = Date.now();
console.log('apps:', (await call('apps', {})).split('\n').slice(0, 3).join(' / '));
console.log('menu:', await call('menu', { app: 'TextEdit', path: ['File', 'New'] }));
const outline = await call('outline', { app: 'TextEdit' });
const box = /\[(e\d+)\] textbox/.exec(outline)?.[1] ?? 'the document text';
console.log('outline first textbox:', box);
console.log('type:', await call('type', { app: 'TextEdit', into: box, text: 'hand is working, signed in with Cloudflare.' }));
console.log('read:', (await call('read', { app: 'TextEdit', into: box })).slice(0, 200));
console.log(`total ${((Date.now() - started) / 1000).toFixed(1)}s`);
child.kill();
