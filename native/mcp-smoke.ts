import { spawn } from 'node:child_process';

const child = spawn('bun', [`${import.meta.dir}/../src/mcp.ts`], { stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '';
const waiting = new Map<number, (value: unknown) => void>();
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
    const line = buffer.slice(0, at);
    buffer = buffer.slice(at + 1);
    const message = JSON.parse(line) as { id: number };
    waiting.get(message.id)?.(message);
  }
});
let next = 0;
const rpc = (method: string, params?: unknown) =>
  new Promise<any>((resolve) => {
    const id = next++;
    waiting.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
const tool = async (name: string, args: Record<string, unknown>) => {
  const t0 = performance.now();
  const response = await rpc('tools/call', { name, arguments: args });
  const body = response.result.content[0].text as string;
  console.log(`${name} ${Math.round(performance.now() - t0)}ms ${response.result.isError ? 'ERROR ' : ''}${body.split('\n').slice(0, 3).join(' | ')}`);
  return body;
};

await rpc('initialize', {});
console.log('tools', (await rpc('tools/list')).result.tools.map((t: { name: string }) => t.name).join(','));
const marker = process.argv[2] ?? `hand-smoke-${Date.now()}`;
await tool('activate', { app: 'TextEdit' });
await tool('outline', { app: 'TextEdit' });
await tool('type', { app: 'TextEdit', text: marker, into: 'the document text area' });
child.kill();
