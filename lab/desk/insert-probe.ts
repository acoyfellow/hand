import { homedir } from 'node:os';
import { join } from 'node:path';
import { transport } from '../../bench/lib.ts';
import { callTool, DEFAULT_HAND, makeSession } from '../../src/mcp.ts';
import { vm } from './vm.ts';

const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
const session = makeSession(transport(), join(homedir(), '.do', 'vm', 'ax-remote'), DEFAULT_HAND);
const say = async (name: string, args: Record<string, unknown>) => {
  const started = performance.now();
  const reply = await callTool(session, name, { ...args, agent: 'ada' });
  console.log(`${String(Math.round(performance.now() - started)).padStart(5)} ms  ${name}: ${reply.content[0]?.text.split('\n')[0]?.slice(0, 110)}`);
};

await say('activate', { app: 'Notes' });
await say('steps', {
  app: 'Notes',
  steps: [
    { tool: 'key', key: 'cmd+n' },
    { tool: 'type', text: 'Todo\nWeather in Lisbon\nPopulation of Portugal', into: 'the note body' },
  ],
});
await say('steps', {
  app: 'Notes',
  steps: [
    { tool: 'key', key: 'cmd+up' },
    { tool: 'key', key: 'down' },
    { tool: 'key', key: 'shift+down' },
    { tool: 'key', key: 'shift+down' },
    { tool: 'key', key: 'cmd+shift+l' },
    { tool: 'key', key: 'cmd+up' },
    { tool: 'key', key: 'down' },
    { tool: 'key', key: 'cmd+right' },
    { tool: 'type', text: ' — 14°C, light rain', into: 'the note body', mode: 'insert' },
    { tool: 'key', key: 'cmd+shift+u' },
  ],
});
console.log(await box.run(`osascript -e 'tell application "Notes" to get plaintext of (first note whose name is "Todo")'`));
