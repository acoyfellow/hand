import { homedir } from 'node:os';
import { join } from 'node:path';
import { transport } from '../../bench/lib.ts';
import { macosDevice } from '../../src/devices/macos.ts';
import { Hand } from '../../src/hand.ts';
import { DEFAULT_HAND } from '../../src/mcp.ts';
import type { Transport } from '../../src/clef.ts';
import { DESK_TASKS } from './suite.ts';
import { vm } from './vm.ts';

const started = performance.now();
const stamp = () => `${String(Math.round(performance.now() - started)).padStart(6)} ms`;
const traced = <T extends object>(label: string, target: T): T => {
  const record = target as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value !== 'function') continue;
    record[key] = async (...args: unknown[]) => {
      const begin = performance.now();
      const result = await (value as (...input: unknown[]) => unknown)(...args);
      console.log(`${stamp()}  ${label}.${key} took ${Math.round(performance.now() - begin)} ms`);
      return result;
    };
  }
  return target;
};

const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
const task = DESK_TASKS.find((candidate) => candidate.id === 'pwa-chat-attach-send');
if (!task) throw new Error('missing chat task');
await task.prepare(box);

const base = transport();
const clefCalls: Transport = async (model, body, signal) => {
  const begin = performance.now();
  const response = await base(model, body, signal);
  console.log(`${stamp()}  clef call took ${Math.round(performance.now() - begin)} ms`);
  return response;
};
const device = traced('device', macosDevice({ helper: join(homedir(), '.do', 'vm', 'ax-remote'), app: 'Google Chrome', agent: 'ada', headed: true, allowMouse: true }));
const hand = new Hand(clefCalls, device, DEFAULT_HAND);
for (const intent of ['open the conversation with Lena Fischer', 'click Attach file']) {
  const begin = performance.now();
  console.log(`--- act "${intent}"`);
  const result = await hand.act(intent);
  console.log(`${stamp()}  TOTAL ${Math.round(performance.now() - begin)} ms -> ${result.split('\n')[0].slice(0, 90)}`);
}
