import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Effect } from 'effect';
import { jsonl, runDir, THINKING, transport, writeJson } from '../bench/lib.ts';
import { macosDevice } from '../src/devices/macos.ts';
import { Hand } from '../src/hand.ts';
import { chat, firstJson, type LlmModel, type Msg, type Tool } from '../src/llm.ts';
import { DEFAULT_HAND, defaultHelper } from '../src/mcp.ts';
import { DESKTOP_TASKS, type DesktopTask } from './desktop-tasks.ts';

const run = promisify(execFile);
const ENTRANT_IDS = (process.env.LAB_ENTRANTS ?? 'hand,agent-desktop').split(',');
const PLANNER = (process.env.LAB_PLANNER ?? 'kimi-k2.6') as LlmModel;
const REPEATS = Number(process.env.LAB_REPEATS ?? 1);
const ONLY = process.env.LAB_TASKS?.split(',');
const MAX_TURNS = 20;
const out = runDir('desktop');
const t = transport();
const helper = defaultHelper();

interface DesktopSession {
  system: string;
  tools: Tool[];
  call(name: string, args: Record<string, unknown>): Promise<string>;
  toolUsd(): number;
}

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): Tool => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const str = { type: 'string' };
const DONE = fn('done', 'Call when the task is finished.');
const RULES = 'Only do what the user asked. When finished call done. If you cannot call tools, reply with only JSON {"tool": name, "args": {...}}.';

function handSession(task: DesktopTask): DesktopSession {
  const device = macosDevice({ helper, app: task.app });
  const worker = new Hand(t, device, { ...DEFAULT_HAND, verify: true });
  const ref = (args: Record<string, unknown>, key: string) => String(args.id ?? args[key] ?? '');
  return {
    system: `You operate the Mac app ${task.app} for the user through tools. You cannot see the screen: call outline to list its controls (each has an [id]) and the text on screen, then act or type. Pass an [id] or plain words. ${RULES}`,
    tools: [
      fn('outline', 'List the controls on screen with [id]s, and the text on screen.'),
      fn('act', 'Click one control: its [id] from outline in intent, or plain words. Destructive clicks are blocked unless confirm is true.', { intent: str, confirm: { type: 'boolean' } }, ['intent']),
      fn('type', 'Replace the text in a field or document: [id] or plain words.', { text: str, into: str }, ['text', 'into']),
      DONE,
    ],
    call: async (name, args) => {
      if (name === 'outline') return worker.outline();
      if (name === 'act') return worker.act(ref(args, 'intent'), args.confirm === true);
      if (name === 'type') return worker.type(String(args.text ?? ''), ref(args, 'into'));
      return `unknown tool ${name}`;
    },
    toolUsd: () => worker.costUsd,
  };
}

const AGENT_DESKTOP = 'node_modules/.bin/agent-desktop';

function agentDesktopSession(task: DesktopTask): DesktopSession {
  const ad = async (...args: string[]) => {
    try {
      const { stdout } = await run(AGENT_DESKTOP, args, { timeout: 60_000, maxBuffer: 16 << 20 });
      return stdout.trim();
    } catch (error) {
      const failed = error as { stdout?: string; stderr?: string; message: string };
      return (failed.stdout || failed.stderr || failed.message).trim().slice(0, 1500);
    }
  };
  return {
    system: `You operate the Mac app ${task.app} for the user with agent-desktop. Call snapshot to get the accessibility tree as JSON with refs like @s1abc:e3, then click, type, set_value or press keys by ref. Use find to read text such as a display. Snapshot again after the app changes. ${RULES}`,
    tools: [
      fn('snapshot', 'Accessibility tree of the app window as JSON, interactive elements with refs.'),
      fn('find', 'Search elements by role, name or text; returns values, for example role statictext to read a display.', { role: str, text: str }),
      fn('click', 'Click an element by ref.', { ref: str }, ['ref']),
      fn('type', 'Insert text into a text element by ref.', { ref: str, text: str }, ['ref', 'text']),
      fn('set_value', 'Set the value of an element by ref, replacing what is there.', { ref: str, value: str }, ['ref', 'value']),
      fn('press', 'Send a key combo to the app, for example return, escape, cmd+a, delete.', { combo: str }, ['combo']),
      DONE,
    ],
    call: async (name, args) => {
      const text = (key: string) => String(args[key] ?? '');
      if (name === 'snapshot') return ad('snapshot', '--app', task.app, '-i', '--compact');
      if (name === 'find') return ad('find', '--app', task.app, ...(args.role ? ['--role', text('role')] : []), ...(args.text ? ['--text', text('text')] : []));
      if (name === 'click') return ad('click', text('ref'));
      if (name === 'type') return ad('type', text('ref'), text('text'));
      if (name === 'set_value') return ad('set-value', text('ref'), text('value'));
      if (name === 'press') return ad('press', text('combo'), '--app', task.app);
      return `unknown tool ${name}`;
    },
    toolUsd: () => 0,
  };
}

const SESSIONS: Record<string, (task: DesktopTask) => DesktopSession> = { hand: handSession, 'agent-desktop': agentDesktopSession };

interface Episode {
  entrant: string;
  task: string;
  repeat: number;
  success: boolean;
  claimedDone: boolean;
  turns: number;
  ms: number;
  plannerUsd: number;
  toolUsd: number;
  plannerTokens: number;
  error?: string;
  trace: unknown[];
}

async function drive(session: DesktopSession, task: DesktopTask, episode: Episode) {
  const msgs: Msg[] = [
    { role: 'system', content: session.system },
    { role: 'user', content: task.text },
  ];
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await Effect.runPromise(chat(t, PLANNER, msgs, { tools: session.tools, maxTokens: 1500, thinking: THINKING }));
    episode.plannerUsd += res.costUsd;
    episode.plannerTokens += res.inputTokens + res.outputTokens;
    episode.turns = turn;
    let calls = res.toolCalls;
    if (!calls.length) {
      const parsed = firstJson(res.text);
      if (parsed?.tool) calls = [{ id: `json_${turn}`, type: 'function', function: { name: parsed.tool, arguments: JSON.stringify(parsed.args ?? {}) } }];
    }
    if (!calls.length) return;
    msgs.push({ role: 'assistant', content: res.text ?? '', tool_calls: calls });
    for (const toolCall of calls) {
      if (toolCall.function.name === 'done') {
        episode.claimedDone = true;
        return;
      }
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }
      const result = await session.call(toolCall.function.name, args).catch((error: Error) => `error: ${error.message.slice(0, 300)}`);
      episode.trace.push({ turn, tool: toolCall.function.name, args, result: result.slice(0, 400) });
      msgs.push({ role: 'tool', tool_call_id: toolCall.id, content: result.slice(0, 12000) });
    }
  }
}

const tasks = DESKTOP_TASKS.filter((task) => !ONLY || ONLY.includes(task.id));
const episodes: Episode[] = [];
for (let repeat = 0; repeat < REPEATS; repeat++) {
  for (const task of tasks) {
    for (const entrant of repeat % 2 === 0 ? ENTRANT_IDS : [...ENTRANT_IDS].reverse()) {
      const episode: Episode = { entrant, task: task.id, repeat, success: false, claimedDone: false, turns: 0, ms: 0, plannerUsd: 0, toolUsd: 0, plannerTokens: 0, trace: [] };
      const t0 = performance.now();
      try {
        await task.setup();
        const session = (SESSIONS[entrant] as (task: DesktopTask) => DesktopSession)(task);
        await drive(session, task, episode);
        episode.toolUsd = session.toolUsd();
        episode.success = await task.check(helper);
      } catch (error) {
        episode.error = String((error as Error).message ?? error).slice(0, 300);
      } finally {
        await task.teardown().catch(() => undefined);
      }
      episode.ms = performance.now() - t0;
      episodes.push(episode);
      jsonl(out, episode);
      console.log(
        `desktop ${entrant.padEnd(14)} r${repeat} ${task.id.padEnd(16)} ${episode.success ? 'PASS' : 'fail'} turns=${episode.turns} $${(episode.plannerUsd + episode.toolUsd).toFixed(4)}${episode.error ? ` err=${episode.error.slice(0, 80)}` : ''}`,
      );
    }
  }
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const summary = Object.fromEntries(
  ENTRANT_IDS.map((entrant) => {
    const mine = episodes.filter((episode) => episode.entrant === entrant);
    const usd = mine.reduce((sum, episode) => sum + episode.plannerUsd + episode.toolUsd, 0);
    const finished = mine.filter((episode) => episode.success).length;
    return [
      entrant,
      {
        planner: PLANNER,
        tasks: tasks.length,
        repeats: REPEATS,
        finishedMean: finished / REPEATS,
        usdPerTask: usd / Math.max(1, mine.length),
        plannerTokensPerTask: mine.reduce((sum, episode) => sum + episode.plannerTokens, 0) / Math.max(1, mine.length),
        medianSeconds: median(mine.map((episode) => episode.ms / 1000)),
        falseDone: mine.filter((episode) => episode.claimedDone && !episode.success).length,
        errors: mine.filter((episode) => episode.error).length,
      },
    ];
  }),
);
writeJson(`${out}.summary.json`, summary);
console.log(JSON.stringify(summary, null, 2));
