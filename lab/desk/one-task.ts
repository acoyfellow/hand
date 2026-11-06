import { homedir } from 'node:os';
import { join } from 'node:path';
import { transport } from '../../bench/lib.ts';
import type { Tool } from '../../src/llm.ts';
import { callTool, DEFAULT_HAND, makeSession, TOOLS } from '../../src/mcp.ts';
import { plannerLoop } from './entrants.ts';
import { DESK_TASKS } from './suite.ts';
import { vm } from './vm.ts';

const taskId = process.argv[2] ?? 'mac-finder-rename';
const model = process.env.DEMO_MODEL ?? 'gpt-6.1-sol';
const box = vm(process.env.DESK_VM_HOST ?? '192.168.64.9');
const task = DESK_TASKS.find((candidate) => candidate.id === taskId);
if (!task) throw new Error(`no desk task ${taskId}`);

await task.prepare(box);
const session = makeSession(transport(), join(homedir(), '.do', 'vm', 'ax-remote'), DEFAULT_HAND);
const used = new Set<string>();
const startedAt = Date.now();
const call = async (name: string, args: Record<string, unknown>) => {
  if (typeof args.app === 'string') used.add(args.app);
  const reply = await callTool(session, name, args);
  const body = reply.content.map((part) => part.text).join('\n');
  console.log(`${((Date.now() - startedAt) / 1000).toFixed(1).padStart(6)} s  ${name} ${JSON.stringify(args).slice(0, 90)}\n         -> ${body.split('\n')[0]?.slice(0, 150)}`);
  return body;
};
const tools: Tool[] = TOOLS.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }));
const usd = () => [...used].reduce((sum, app) => sum + session.hand(app).costUsd, 0);
const run = await plannerLoop(tools, call, usd, task.text, { maxTurns: 30, deadline: Date.now() + 4 * 60_000 }, undefined, model);
const passed = await task.passed(box).catch(() => false);
console.log(`\n${taskId}: ${passed ? 'PASS' : 'FAIL'} in ${((Date.now() - startedAt) / 1000).toFixed(1)} s, ${run.turns} turns, $${run.usd.toFixed(4)}${run.error ? ` (${run.error})` : ''}`);
