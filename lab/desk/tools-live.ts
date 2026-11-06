import { homedir } from 'node:os';
import { join } from 'node:path';
import { transport } from '../../bench/lib.ts';
import { callTool, DEFAULT_HAND, makeSession } from '../../src/mcp.ts';
import { vm } from './vm.ts';

const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
const session = makeSession(transport(), join(homedir(), '.do', 'vm', 'ax-remote'), DEFAULT_HAND);
const say = async (label: string, tool: string, args: Record<string, unknown>) => {
  const started = performance.now();
  const reply = await callTool(session, tool, { agent: 'probe', ...args });
  const body = reply.content.map((part) => part.text).join(' ').replace(/\s+/g, ' ');
  console.log(`${label.padEnd(26)} ${String(Math.round(performance.now() - started)).padStart(5)} ms  ${reply.isError ? 'ERR ' : ''}${body.slice(0, 170)}`);
  return body;
};

await box.run(`osascript -e 'tell application "Notes" to delete (every note whose name is "Todo")' >/dev/null 2>&1; osascript -e 'tell application "Notes" to activate'`);
await Bun.sleep(600);
const outline = await say('outline Notes', 'outline', { app: 'Notes' });
await say('new note', 'steps', {
  app: 'Notes',
  steps: [
    { tool: 'key', key: 'cmd+n' },
    { tool: 'type', into: 'the note body', mode: 'insert', text: 'Todo\nWeather in Lisbon\nPopulation of Portugal' },
  ],
});
const bodyId = /\[(e\d+)\] textbox/.exec(await say('outline again', 'outline', { app: 'Notes' }))?.[1];
console.log(`note body id: ${bodyId}  (first outline had ${outline.split('[e').length - 1} controls)`);
await say('make checklist', 'steps', {
  app: 'Notes',
  steps: [
    { tool: 'select_text', into: bodyId, from: 'Weather in Lisbon', through: 'Population of Portugal' },
    { tool: 'menu', path: ['Format', 'Checklist'] },
  ],
});
await say('answer + tick weather', 'steps', {
  app: 'Notes',
  steps: [
    { tool: 'type', into: bodyId, after: 'Weather in Lisbon', text: ' — 16°C, light rain' },
    { tool: 'menu', path: ['Format', 'Mark as Checked'] },
  ],
});
await say('answer + tick population', 'steps', {
  app: 'Notes',
  steps: [
    { tool: 'type', into: bodyId, after: 'Population of Portugal', text: ' — 11.4 million' },
    { tool: 'menu', path: ['Format', 'Mark as Checked'] },
  ],
});
await say('guard: missing anchor', 'type', { app: 'Notes', into: bodyId, after: 'Rain in Spain', text: 'x' });
await say('expect contains', 'expect', { app: 'Notes', into: bodyId, contains: '11.4 million' });
await say('clipboard write', 'clipboard', { text: 'hand clipboard check' });
await say('clipboard read', 'clipboard', {});
console.log(await box.run(`osascript -e 'tell application "Notes" to get plaintext of (first note whose name is "Todo")'`));

await box.run(`open "x-apple.systempreferences:com.apple.Desktop-Settings.extension"`);
await Bun.sleep(2500);
const settings = await say('outline Settings', 'outline', { app: 'System Settings' });
const dockId = /\[(e\d+)\] checkbox "Automatically hide and show the Dock"/.exec(settings)?.[1];
await say('expect dock off', 'expect', { app: 'System Settings', into: dockId, checked: false });
await say('check dock on', 'check', { app: 'System Settings', into: dockId, on: true });
await say('check dock on again', 'check', { app: 'System Settings', into: dockId, on: true });
await say('expect dock on', 'expect', { app: 'System Settings', into: dockId, checked: true });
await say('check dock off', 'check', { app: 'System Settings', into: dockId, on: false });
await say('menu missing item', 'menu', { app: 'Notes', path: ['Format', 'Nope'] });
