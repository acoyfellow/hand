import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Effect } from 'effect';
import type { Page } from 'playwright';
import { browserDevice } from '../src/devices/browser.ts';
import { Hand } from '../src/hand.ts';
import { chat, coordinateInstruction, firstJson, type LlmModel, type Msg, screenshotFrame, type Tool, toViewportPoint, withInstructions } from '../src/llm.ts';
import { DEFAULT_HAND } from '../src/mcp.ts';
import { cdp, screenshotAt } from './browser.ts';
import { writeLead } from './lead-record.ts';
import { jsonl, launch, pool, ROOT, runDir, transport, writeJson } from './lib.ts';

const EXTERNAL = join(ROOT, 'bench', 'external');
const MINIWOB_HTML = join(EXTERNAL, 'miniwob-plusplus', 'miniwob', 'html', 'miniwob');
const BROWSERGYM_BASE = join(EXTERNAL, 'BrowserGym', 'browsergym', 'miniwob', 'src', 'browsergym', 'miniwob', 'base.py');
const METADATA = join(EXTERNAL, 'BrowserGym', 'browsergym', 'experiments', 'src', 'browsergym', 'experiments', 'benchmark', 'metadata', 'miniwob.csv');
const VIEWPORT = { width: 332, height: 214 };
const MAX_STEPS = 10;
const PLANNER = (process.env.HAND_PLANNER ?? 'kimi-k2.6') as LlmModel;
const ARMS = (process.env.HAND_ARMS ?? 'do,vision').split(',');
const LIMIT = Number(process.env.HAND_LIMIT ?? 999);
const CONCURRENCY = Number(process.env.HAND_PUBLIC_CONC ?? 8);
const out = runDir('public');
const run = process.env.HAND_RUN as string;
const t = transport();

export const TASK_NAMES = readFileSync(METADATA, 'utf8')
  .split('\n')
  .slice(1)
  .filter(Boolean)
  .map((line) => (line.split(',')[0] as string).replace(/^miniwob\./, ''));

function removeDisplayScript(): string {
  const source = readFileSync(BROWSERGYM_BASE, 'utf8');
  const start = source.indexOf('r"""', source.indexOf('if self.remove_human_display:')) + 4;
  return source.slice(start, source.indexOf('"""', start));
}
const REMOVE_DISPLAY = removeDisplayScript();

const REWARD_WATCH = `(() => {
  window.__doReward = null;
  const original = core.endEpisode;
  core.endEpisode = function (reward, timeProportional, reason) {
    if (window.__doReward === null) window.__doReward = { reward, reason: String(reason ?? '') };
    return original.apply(this, arguments);
  };
})()`;

interface Episode {
  readonly arm: string;
  readonly task: string;
  readonly seed: number;
  goal: string;
  success: boolean;
  reward: number | null;
  steps: number;
  ms: number;
  usd: number;
  claimedDone: boolean;
  error?: string;
  log: string[];
}

async function openTask(task: string, seed: number): Promise<{ page: Page; goal: string }> {
  const browser = await launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`file://${join(MINIWOB_HTML, `${task}.html`)}`);
  await page.evaluate(REMOVE_DISPLAY);
  await page.evaluate(`Math.seedrandom(${seed}); core.EPISODE_MAX_TIME = 1000000; core.startEpisodeReal();`);
  await page.evaluate(REWARD_WATCH);
  await page.waitForTimeout(300);
  const goal = String(await page.evaluate('core.getUtterance()'));
  return { page, goal };
}

const ended = (page: Page) => page.evaluate('window.__doReward !== null') as Promise<boolean>;

const HAND_TOOLS: Tool[] = [
  {
    type: 'function',
    function: { name: 'outline', description: 'List the controls on screen.', parameters: { type: 'object', properties: {}, required: [] } },
  },
  {
    type: 'function',
    function: {
      name: 'act',
      description:
        'Click one control: pass its [id] from outline (for example "e3"), or describe it in plain words. Blocked if it looks destructive unless confirm is true; set confirm only when the task asks for that action.',
      parameters: { type: 'object', properties: { intent: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['intent'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type',
      description: 'Type text into a field described in plain words.',
      parameters: { type: 'object', properties: { text: { type: 'string' }, into: { type: 'string' } }, required: ['text', 'into'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'select',
      description: 'Choose an option in a dropdown described in plain words.',
      parameters: { type: 'object', properties: { value: { type: 'string' }, into: { type: 'string' } }, required: ['value', 'into'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'look',
      description: 'Ask a yes/no question about the screen.',
      parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
    },
  },
  { type: 'function', function: { name: 'done', description: 'Finish.', parameters: { type: 'object', properties: {}, required: [] } } },
];

const callHand = (hand: Hand, name: string, args: Record<string, string>) => {
  if (name === 'outline') return hand.outline();
  if (name === 'act') return hand.act(args.intent ?? '', String(args.confirm) === 'true');
  if (name === 'type') return hand.type(args.text ?? '', args.into ?? '');
  if (name === 'select') return hand.select(args.value ?? '', args.into ?? '');
  if (name === 'look') return hand.look(args.question ?? '');
  return Promise.resolve(`unknown tool ${name}`);
};

async function doArm(page: Page, episode: Episode): Promise<void> {
  const hand = new Hand(t, await browserDevice(await cdp(page)), DEFAULT_HAND);
  const msgs: Msg[] = [
    {
      role: 'system',
      content:
        'You operate a small web page for the user through tools. You cannot see the screen: call outline to list its controls, then act, type or select. Only do what the task asks. Call done when finished. If you cannot call tools, reply with only JSON {"tool": name, "args": {...}}.',
    },
    { role: 'user', content: episode.goal },
  ];
  let plannerUsd = 0;
  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      episode.steps = step;
      const res = await Effect.runPromise(chat(t, PLANNER, msgs, { tools: HAND_TOOLS, maxTokens: 800, thinking: false }));
      plannerUsd += res.costUsd;
      let calls = res.toolCalls;
      if (!calls.length) {
        const parsed = firstJson(res.text);
        if (parsed?.tool) calls = [{ id: `json_${step}`, type: 'function', function: { name: parsed.tool, arguments: JSON.stringify(parsed.args ?? {}) } }];
      }
      if (!calls.length) return;
      msgs.push({ role: 'assistant', content: res.text ?? '', tool_calls: calls });
      for (const toolCall of calls) {
        if (toolCall.function.name === 'done') {
          episode.claimedDone = true;
          return;
        }
        const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, string>;
        const result = await callHand(hand, toolCall.function.name, args).catch((error: Error) => `error: ${error.message}`);
        episode.log.push(`${toolCall.function.name} ${toolCall.function.arguments} -> ${result.slice(0, 200)}`);
        msgs.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
      }
      if (await ended(page)) return;
    }
  } finally {
    episode.usd = plannerUsd + hand.costUsd;
  }
}

async function visionArm(page: Page, episode: Episode): Promise<void> {
  const frame = screenshotFrame(PLANNER);
  const system = `You operate a small web page for the user. Each turn you get a ${frame.width}x${frame.height} screenshot. Reply with ONE JSON action and nothing else:
{"action":"click","x":int,"y":int} | {"action":"type","text":"..."} (types into the focused field) | {"action":"key","key":"Enter"} | {"action":"done"}
${coordinateInstruction(PLANNER)}
Only do what the task asks.`;
  const history: string[] = [];
  for (let step = 1; step <= MAX_STEPS; step++) {
    episode.steps = step;
    const shot = await screenshotAt(page, frame.width, frame.height);
    const res = await Effect.runPromise(
      chat(
        t,
        PLANNER,
        withInstructions(PLANNER, system, [
          { type: 'text', text: `Task: ${episode.goal}\nActions so far:\n${history.join('\n') || '(none)'}` },
          { type: 'image_url', image_url: { url: shot } },
        ]),
        { maxTokens: 800, thinking: false },
      ),
    );
    episode.usd += res.costUsd;
    const action = firstJson(res.text) ?? {};
    history.push(JSON.stringify(action));
    if (action.action === 'done' || !action.action) {
      episode.claimedDone = action.action === 'done';
      return;
    }
    if (action.action === 'click') {
      const point = toViewportPoint(PLANNER, VIEWPORT, action.x, action.y);
      await page.mouse.click(point.x, point.y);
    } else if (action.action === 'type') await page.keyboard.type(String(action.text ?? ''));
    else if (action.action === 'key') await page.keyboard.press(String(action.key ?? 'Enter'));
    await page.waitForTimeout(150);
    if (await ended(page)) return;
  }
}

const ARM_FNS: Record<string, (page: Page, episode: Episode) => Promise<void>> = { do: doArm, vision: visionArm };

const jobs = ARMS.flatMap((arm) => TASK_NAMES.slice(0, LIMIT).map((task, index) => ({ arm, task, seed: 1000 + index })));
const episodes = await pool(jobs, CONCURRENCY, async ({ arm, task, seed }) => {
  const episode: Episode = { arm, task, seed, goal: '', success: false, reward: null, steps: 0, ms: 0, usd: 0, claimedDone: false, log: [] };
  let page: Page | undefined;
  const t0 = performance.now();
  try {
    const opened = await openTask(task, seed);
    page = opened.page;
    episode.goal = opened.goal;
    await (ARM_FNS[arm] as (page: Page, episode: Episode) => Promise<void>)(page, episode);
    await page.waitForTimeout(200);
    const outcome = (await page.evaluate('window.__doReward')) as { reward: number } | null;
    const raw = Number(await page.evaluate('WOB_RAW_REWARD_GLOBAL'));
    episode.reward = outcome?.reward ?? null;
    episode.success = raw > 0 || (outcome?.reward ?? 0) > 0;
  } catch (error) {
    episode.error = String((error as Error).message ?? error).slice(0, 240);
  }
  episode.ms = performance.now() - t0;
  await page?.context().close();
  jsonl(out, episode);
  console.log(
    `public ${arm.padEnd(7)} ${task.padEnd(28)} ${episode.success ? 'PASS' : 'fail'} steps=${episode.steps} $${episode.usd.toFixed(4)}${episode.error ? ` err=${episode.error.slice(0, 60)}` : ''}`,
  );
  return episode;
});

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const summary = Object.fromEntries(
  ARMS.map((arm) => {
    const mine = episodes.filter((episode) => episode.arm === arm);
    const solved = mine.filter((episode) => episode.success).length;
    const usd = mine.reduce((sum, episode) => sum + episode.usd, 0);
    return [
      arm,
      {
        tasks: mine.length,
        solved,
        successRate: solved / Math.max(1, mine.length),
        usdPerTask: usd / Math.max(1, mine.length),
        solvedPerDollar: usd ? solved / usd : 0,
        medianSeconds: median(mine.map((episode) => episode.ms / 1000)),
        errors: mine.filter((episode) => episode.error).length,
      },
    ];
  }),
);
writeJson(`${out}.summary.json`, summary);
console.log(JSON.stringify(summary, null, 2));
const doArmResult = summary.do;
const visionResult = summary.vision;
if (process.env.HAND_RECORD_LEAD === '1' && doArmResult && visionResult) {
  const pass =
    doArmResult.tasks === TASK_NAMES.length &&
    visionResult.tasks === TASK_NAMES.length &&
    doArmResult.solved >= visionResult.solved - 3 &&
    doArmResult.solvedPerDollar >= 3 * visionResult.solvedPerDollar;
  writeLead(run, 'public-benchmark', pass, {
    benchmark: 'MiniWoB++ (BrowserGym miniwob, 125 tasks)',
    doSolved: doArmResult.solved,
    visionSolved: visionResult.solved,
    doUsdPerTask: Number(doArmResult.usdPerTask.toFixed(5)),
    visionUsdPerTask: Number(visionResult.usdPerTask.toFixed(5)),
    doSolvedPerDollar: Number(doArmResult.solvedPerDollar.toFixed(1)),
    visionSolvedPerDollar: Number(visionResult.solvedPerDollar.toFixed(1)),
  });
}
writeFileSync(`${out}.done`, '');
