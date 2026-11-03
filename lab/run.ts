import { Effect } from 'effect';
import { chat, firstJson, type LlmModel, type Msg } from '../src/llm.ts';
import { close, jsonl, open, pool, runDir, specUrl, type ScreenSpec, THINKING, transport, writeJson } from '../bench/lib.ts';
import { TASKS as BASE_TASKS, HARD_TASKS, type Task } from '../bench/tasks.ts';
import { type AppState, ENTRANTS, type Session } from './entrants.ts';

const ENTRANT_IDS = (process.env.LAB_ENTRANTS ?? 'hand,agent-browser,playwright-mcp,stagehand,browser-use').split(',');
const PLANNER = (process.env.LAB_PLANNER ?? 'kimi-k2.6') as LlmModel;
const REPEATS = Number(process.env.LAB_REPEATS ?? 1);
const CONCURRENCY = Number(process.env.LAB_CONC ?? 8);
const ONLY = process.env.LAB_TASKS?.split(',');
const MAX_TURNS = 20;
const VIEWPORT = { width: 1280, height: 800 };
const out = runDir('lab');
const FIXTURES = new URL('../bench/fixtures/', import.meta.url).pathname;
const fixtureServer = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  fetch: (request) => new Response(Bun.file(`${FIXTURES}${new URL(request.url).pathname.replace(/^\/+/, '')}`)),
});
const httpUrl = (spec: ScreenSpec) => specUrl(spec).replace(`file://${FIXTURES}`, `http://127.0.0.1:${fixtureServer.port}/`);
const t = transport();

interface Episode {
  entrant: string;
  planner: string;
  task: string;
  repeat: number;
  text: string;
  success: boolean;
  claimedDone: boolean;
  turns: number;
  toolCalls: number;
  ms: number;
  plannerUsd: number;
  toolUsd: number;
  plannerIn: number;
  plannerOut: number;
  unrequestedDanger: string[];
  error?: string;
  trace: unknown[];
}

const tasks = [...BASE_TASKS, ...HARD_TASKS].filter((task) => !ONLY || ONLY.includes(task.id));

async function drive(session: Session, task: Pick<Task, 'text'>, episode: Episode): Promise<void> {
  const msgs: Msg[] = [
    { role: 'system', content: session.system },
    { role: 'user', content: task.text },
  ];
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await Effect.runPromise(chat(t, PLANNER, msgs, { tools: session.tools, maxTokens: 1500, thinking: THINKING }));
    episode.plannerUsd += res.costUsd;
    episode.plannerIn += res.inputTokens;
    episode.plannerOut += res.outputTokens;
    episode.turns = turn;
    let calls = res.toolCalls;
    if (!calls.length) {
      const parsed = firstJson(res.text);
      if (parsed?.tool) calls = [{ id: `json_${turn}`, type: 'function', function: { name: parsed.tool, arguments: JSON.stringify(parsed.args ?? {}) } }];
    }
    if (!calls.length) {
      episode.trace.push({ turn, text: res.text.slice(0, 300) });
      return;
    }
    msgs.push({ role: 'assistant', content: res.text ?? '', tool_calls: calls });
    for (const toolCall of calls) {
      episode.toolCalls++;
      if (toolCall.function.name === 'done') {
        episode.claimedDone = true;
        episode.trace.push({ turn, tool: 'done' });
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
      msgs.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
    }
  }
}

const jobs = Array.from({ length: REPEATS }, (_, repeat) => ENTRANT_IDS.flatMap((entrant) => tasks.map((task) => ({ entrant, repeat, task })))).flat();

const episodes = await pool(jobs, CONCURRENCY, async ({ entrant: entrantId, repeat, task: build }, index) => {
  const entrant = ENTRANTS[entrantId];
  if (!entrant) throw new Error(`unknown entrant ${entrantId}`);
  const spec: ScreenSpec = { screen: build.screen, seed: build.seed, theme: 'light', density: 'comfortable', accent: 0, inj: false };
  const episode: Episode = {
    entrant: entrantId,
    planner: PLANNER,
    task: build.id,
    repeat,
    text: '',
    success: false,
    claimedDone: false,
    turns: 0,
    toolCalls: 0,
    ms: 0,
    plannerUsd: 0,
    toolUsd: 0,
    plannerIn: 0,
    plannerOut: 0,
    unrequestedDanger: [],
    trace: [],
  };
  if (entrant.runWhole) {
    const probe = await open(spec, httpUrl(spec));
    const built = build.build(JSON.parse(String(await probe.evaluate('JSON.stringify(window.__state)'))));
    await probe.context().close();
    episode.text = built.text;
    const t0 = performance.now();
    try {
      const whole = await entrant.runWhole({ url: httpUrl(spec), viewport: VIEWPORT, task: built.text, maxTurns: MAX_TURNS, planner: PLANNER });
      Object.assign(episode, { claimedDone: whole.claimedDone, turns: whole.turns, plannerUsd: whole.plannerUsd, plannerIn: whole.plannerIn, plannerOut: whole.plannerOut, error: whole.error });
      episode.success = built.check(whole.state);
      const danger = [...whole.state.danger, ...(whole.state.settings.deleted ? ['account-deleted'] : [])];
      episode.unrequestedDanger = danger.filter((name) => !built.allow.includes(name));
    } catch (error) {
      episode.error = String((error as Error).message ?? error).slice(0, 300);
    }
    episode.ms = performance.now() - t0;
    jsonl(out, episode);
    console.log(`lab ${entrantId.padEnd(14)} r${repeat} ${build.id.padEnd(24)} ${episode.success ? 'PASS' : 'fail'} turns=${episode.turns} $${episode.plannerUsd.toFixed(4)}${episode.error ? ` err=${episode.error.slice(0, 80)}` : ''}`);
    return episode;
  }
  const page = entrant.ownsBrowser ? undefined : await open(spec, httpUrl(spec));
  let session: Session | undefined;
  try {
    session = await entrant.start({ page, url: httpUrl(spec), viewport: VIEWPORT, t, sessionId: `lab-${process.pid}-${index}` });
    const built = build.build(await session.state());
    episode.text = built.text;
    const t0 = performance.now();
    try {
      await drive(session, built, episode);
    } catch (error) {
      episode.error = String((error as Error).message ?? error).slice(0, 300);
    }
    episode.ms = performance.now() - t0;
    episode.toolUsd = session.toolUsd();
    const finalState: AppState | null = await session.state().catch(() => null);
    if (finalState?.settings) {
      episode.success = built.check(finalState);
      const danger = [...finalState.danger, ...(finalState.settings.deleted ? ['account-deleted'] : [])];
      episode.unrequestedDanger = danger.filter((name) => !built.allow.includes(name));
    } else episode.error = episode.error ?? 'app state lost: the page was navigated away or reloaded';
  } catch (error) {
    episode.error = String((error as Error).message ?? error).slice(0, 300);
  } finally {
    await session?.close().catch(() => undefined);
    await page?.context().close();
  }
  jsonl(out, episode);
  const usd = episode.plannerUsd + episode.toolUsd;
  console.log(
    `lab ${entrantId.padEnd(14)} r${repeat} ${build.id.padEnd(24)} ${episode.success ? 'PASS' : 'fail'} turns=${episode.turns} $${usd.toFixed(4)}${episode.unrequestedDanger.length ? ` DANGER=${episode.unrequestedDanger.join(',')}` : ''}${episode.error ? ` err=${episode.error.slice(0, 80)}` : ''}`,
  );
  return episode;
});
await close();
fixtureServer.stop(true);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
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
        episodes: mine.length,
        finishedMean: finished / REPEATS,
        successRate: finished / Math.max(1, mine.length),
        usdPerTask: usd / Math.max(1, mine.length),
        plannerTokensPerTask: mine.reduce((sum, episode) => sum + episode.plannerIn + episode.plannerOut, 0) / Math.max(1, mine.length),
        medianSeconds: median(mine.map((episode) => episode.ms / 1000)),
        unrequestedDanger: mine.filter((episode) => episode.unrequestedDanger.length).length,
        falseDone: mine.filter((episode) => episode.claimedDone && !episode.success).length,
        errors: mine.filter((episode) => episode.error).length,
      },
    ];
  }),
);
writeJson(`${out}.summary.json`, summary);
console.log(JSON.stringify(summary, null, 2));
