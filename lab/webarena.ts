import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, chromium } from 'playwright';
import { transport } from '../bench/lib.ts';
import { browserDevice } from '../src/devices/browser.ts';
import { Hand } from '../src/hand.ts';
import type { Msg, Tool } from '../src/llm.ts';
import { DEFAULT_HAND } from '../src/mcp.ts';
import { plannerChat } from './desk/models.ts';

interface AgentInput {
  readonly task_id: number;
  readonly sites: readonly string[];
  readonly start_urls: readonly string[];
  readonly intent: string;
}

interface Episode {
  readonly taskId: number;
  readonly sites: readonly string[];
  claimed: boolean;
  turns: number;
  usd: number;
  ms: number;
  score?: number;
  status?: string;
  error?: string;
}

const ROOT = join(import.meta.dir, '..');
const RUN = process.env.WA_RUN ?? 'webarena-1';
const OUT = join(ROOT, 'bench', 'runs', RUN);
const TASKS_DIR = join(OUT, 'tasks');
const MODEL = process.env.WA_MODEL ?? 'gpt-6.1-sol';
const MAX_TURNS = Number(process.env.WA_MAX_TURNS ?? 30);
const SITE = process.env.WA_SITE ?? 'reddit';
const LIMIT = Number(process.env.WA_LIMIT ?? 999);
const ONLY = process.env.WA_TASKS?.split(',').map(Number);
const CONCURRENCY = Number(process.env.WA_CONC ?? 3);
const URLS: Record<string, string> = {
  reddit: process.env.WA_REDDIT ?? 'http://localhost:9999',
  shopping: process.env.WA_SHOPPING ?? 'http://localhost:7770',
  shopping_admin: process.env.WA_SHOPPING_ADMIN ?? 'http://localhost:7780',
};
const CREDENTIALS: Record<string, { username: string; password: string }> = {
  reddit: { username: 'MarvelsGrantMan136', password: 'test1234' },
  shopping: { username: 'emma.lopez@gmail.com', password: 'Password.123' },
  shopping_admin: { username: 'admin', password: 'admin1234' },
};
const PLACEHOLDER: Record<string, string> = { reddit: '__REDDIT__', shopping: '__SHOPPING__', shopping_admin: '__SHOPPING_ADMIN__' };

mkdirSync(TASKS_DIR, { recursive: true });

const config = {
  environments: Object.fromEntries(
    Object.entries(URLS).map(([site, url]) => [PLACEHOLDER[site], { urls: [url], active_url_idx: 0, ...(site === 'shopping_admin' ? { use_header_login: true } : {}), credentials: CREDENTIALS[site] }]),
  ),
};
const configPath = join(OUT, 'config.json');
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

const wav = (...args: string[]) => {
  const result = Bun.spawnSync(['uvx', 'webarena-verified', ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`webarena-verified ${args[0]} failed: ${result.stderr.toString().slice(-800)}`);
  return result.stdout.toString();
};

const inputsPath = join(OUT, 'agent-inputs.json');
const HARD = join(OUT, 'hard-ids.json');
if (!existsSync(HARD)) writeFileSync(HARD, await (await fetch('https://raw.githubusercontent.com/ServiceNow/webarena-verified/main/assets/dataset/subsets/webarena-verified-hard.json')).text());
const hardIds = (JSON.parse(readFileSync(HARD, 'utf8')) as { task_ids: number[] }).task_ids;
if (!existsSync(inputsPath)) wav('agent-input-get', '--task-ids', hardIds.join(','), '--config', configPath, '--output', inputsPath);
const allInputs = JSON.parse(readFileSync(inputsPath, 'utf8')) as AgentInput[];
const done = new Set(process.env.WA_RESUME === '1' ? allInputs.map((input) => input.task_id).filter((id) => existsSync(join(TASKS_DIR, String(id), 'agent_response.json'))) : []);
const chosen = allInputs.filter((input) => !done.has(input.task_id)).filter((input) => (ONLY ? ONLY.includes(input.task_id) : input.sites.length === 1 && input.sites[0] === SITE)).slice(0, LIMIT);
console.log(`${chosen.length} WebArena-Verified hard tasks on ${ONLY ? 'the chosen ids' : SITE}, planner ${MODEL}`);

const login = async (context: BrowserContext, site: string) => {
  const base = URLS[site] as string;
  const who = CREDENTIALS[site];
  if (!who) return;
  const page = await context.newPage();
  if (site === 'reddit') {
    await page.goto(base);
    await page.getByRole('link', { name: 'Log in' }).click();
    await page.getByLabel('Username').fill(who.username);
    await page.getByLabel('Password').fill(who.password);
    await page.getByRole('button', { name: 'Log in' }).click();
  } else if (site === 'shopping') {
    await page.goto(`${base}/customer/account/login/`);
    await page.getByLabel('Email', { exact: true }).fill(who.username);
    await page.getByLabel('Password', { exact: true }).fill(who.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
  } else if (site === 'shopping_admin') {
    await page.goto(base);
    await page.getByLabel('Username').fill(who.username);
    await page.getByLabel('Password').fill(who.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.close();
};

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]): Tool => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });
const TOOLS: Tool[] = [
  fn('outline', 'List the controls on the page with [id]s.', {}, []),
  fn('read', 'Read the visible text of the page.', {}, []),
  fn('act', 'Click one control by its [id] from outline (fastest) or plain words. Set confirm only when the task asks for a change that deletes or submits.', { intent: { type: 'string' }, confirm: { type: 'boolean' } }, ['intent']),
  fn('type', 'Type text into a field by its [id] or plain words. Replaces what is there.', { text: { type: 'string' }, into: { type: 'string' } }, ['text', 'into']),
  fn('select', 'Choose an option in a dropdown by its [id] or plain words.', { value: { type: 'string' }, into: { type: 'string' } }, ['value', 'into']),
  fn('key', 'Press a key in the page, like Enter or Escape.', { key: { type: 'string' } }, ['key']),
  fn('goto', 'Open a URL on the same site.', { url: { type: 'string' } }, ['url']),
  fn('back', 'Go back one page.', {}, []),
  fn(
    'finish',
    'End the task with the final answer in the required format.',
    {
      task_type: { type: 'string', enum: ['RETRIEVE', 'MUTATE', 'NAVIGATE'] },
      status: { type: 'string', enum: ['SUCCESS', 'NOT_FOUND_ERROR', 'ACTION_NOT_ALLOWED_ERROR', 'PERMISSION_DENIED_ERROR', 'DATA_VALIDATION_ERROR', 'UNKNOWN_ERROR'] },
      retrieved_data: { type: 'array', items: {} },
      error_details: { type: 'string' },
    },
    ['task_type', 'status'],
  ),
];

const SYSTEM = (input: AgentInput) =>
  [
    `You are an autonomous web agent. The task is on ${input.sites.join(' and ')}. You are already logged in. Begin from the start URL and stay on that site.`,
    'You cannot see the page: use outline to list its controls and read to read its text, then act, type, select or key.',
    'Task types: RETRIEVE (find data), MUTATE (create, change or delete something), NAVIGATE (end on a specific page).',
    'Do not change anything unless the task asks for it. Do not download files. Do not ask the user anything.',
    'When finished, call finish. For RETRIEVE, retrieved_data must be a list (even for one item) of plain values unless the task asks for objects; otherwise leave it out.',
    'Use status SUCCESS when the objective is achieved, NOT_FOUND_ERROR if what it asks for does not exist, ACTION_NOT_ALLOWED_ERROR if the site cannot do it, PERMISSION_DENIED_ERROR if you lack permission, DATA_VALIDATION_ERROR if the request is missing or invalid.',
  ].join(' ');

const TASK_SECONDS = Number(process.env.WA_TASK_SECONDS ?? 240);
const runEpisode = async (input: AgentInput): Promise<Episode> => {
  const deadline = Date.now() + TASK_SECONDS * 1000;
  const started = Date.now();
  const episode: Episode = { taskId: input.task_id, sites: input.sites, claimed: false, turns: 0, usd: 0, ms: 0 };
  const dir = join(TASKS_DIR, String(input.task_id));
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const killer = setTimeout(() => browser.close().catch(() => {}), (TASK_SECONDS + 60) * 1000);
  try {
    const setup = await browser.newContext();
    for (const site of input.sites) await login(setup, site);
    const state = await setup.storageState();
    await setup.close();
    const context = await browser.newContext({ storageState: state, viewport: { width: 1280, height: 900 }, recordHar: { path: join(dir, 'network.har'), content: 'embed' } });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(45_000);
    await page.goto(input.start_urls[0] as string, { waitUntil: 'domcontentloaded' });
    const session = await context.newCDPSession(page);
    const hand = new Hand(transport(), await browserDevice(session as never), DEFAULT_HAND);
    const msgs: Msg[] = [
      { role: 'system', content: SYSTEM(input) },
      { role: 'user', content: `Task: ${input.intent}\nStart URLs: ${input.start_urls.join(', ')}` },
    ];
    let answer: Record<string, unknown> | undefined;
    for (let turn = 1; turn <= MAX_TURNS && !answer && Date.now() < deadline; turn++) {
      episode.turns = turn;
      const reply = await plannerChat(MODEL, msgs, TOOLS);
      episode.usd += reply.usd;
      if (!reply.toolCalls.length) break;
      msgs.push({ role: 'assistant', content: reply.text ?? '', tool_calls: reply.toolCalls });
      for (const call of reply.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          args = {};
        }
        const name = call.function.name;
        let result: string;
        try {
          if (name === 'finish') {
            answer = { task_type: args.task_type, status: args.status, retrieved_data: args.task_type === 'RETRIEVE' ? (args.retrieved_data ?? []) : null, error_details: args.error_details ?? null };
            result = 'Finished.';
          } else if (name === 'outline') result = await hand.outline();
          else if (name === 'read') result = (await page.innerText('body')).slice(0, 6000);
          else if (name === 'act') result = await hand.act(String(args.intent ?? ''), args.confirm === true);
          else if (name === 'type') result = await hand.type(String(args.text ?? ''), String(args.into ?? ''));
          else if (name === 'select') result = await hand.select(String(args.value ?? ''), String(args.into ?? ''));
          else if (name === 'key') {
            await page.keyboard.press(String(args.key ?? 'Enter'));
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            result = `pressed ${args.key}; now at ${page.url()}`;
          } else if (name === 'goto') {
            await page.goto(String(args.url ?? ''), { waitUntil: 'domcontentloaded' });
            result = `now at ${page.url()}`;
          } else if (name === 'back') {
            await page.goBack({ waitUntil: 'domcontentloaded' });
            result = `now at ${page.url()}`;
          } else result = `unknown tool ${name}`;
        } catch (error) {
          result = `error: ${(error as Error).message.slice(0, 300)}`;
        }
        msgs.push({ role: 'tool', tool_call_id: call.id, content: `${result}\n(url: ${page.url()})` });
        if (answer) break;
      }
    }
    episode.usd += hand.costUsd;
    episode.claimed = answer?.status === 'SUCCESS';
    writeFileSync(join(dir, 'agent_response.json'), `${JSON.stringify(answer ?? { task_type: 'NAVIGATE', status: 'UNKNOWN_ERROR', retrieved_data: null, error_details: 'no answer within the turn limit' }, null, 2)}\n`);
    await context.close();
  } catch (error) {
    episode.error = (error as Error).message.slice(0, 300);
  } finally {
    clearTimeout(killer);
    await browser.close().catch(() => {});
  }
  episode.ms = Date.now() - started;
  return episode;
};

const episodes: Episode[] = [];
const queue = [...chosen];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let input = queue.shift(); input; input = queue.shift()) {
      const episode = await Promise.race([
        runEpisode(input),
        Bun.sleep((TASK_SECONDS + 90) * 1000).then((): Episode => ({ taskId: input.task_id, sites: input.sites, claimed: false, turns: 0, usd: 0, ms: (TASK_SECONDS + 90) * 1000, error: "task hung past its time limit and was abandoned" })),
      ]);
      episodes.push(episode);
      console.log(`task ${episode.taskId}: ${episode.claimed ? 'claimed' : 'gave up'} in ${(episode.ms / 1000).toFixed(0)} s, ${episode.turns} turns, $${episode.usd.toFixed(3)}${episode.error ? ` (${episode.error})` : ''}`);
    }
  }),
);

for (const id of done) {
  const prior = JSON.parse(readFileSync(join(TASKS_DIR, String(id), 'agent_response.json'), 'utf8')) as { status?: string };
  episodes.push({ taskId: id, sites: [SITE], claimed: prior.status === 'SUCCESS', turns: 0, usd: 0, ms: 0 });
}
wav('eval-tasks', '--task-ids', episodes.map((episode) => episode.taskId).join(','), '--output-dir', TASKS_DIR, '--config', configPath);
for (const episode of episodes) {
  const file = join(TASKS_DIR, String(episode.taskId), 'eval_result.json');
  if (!existsSync(file)) continue;
  const result = JSON.parse(readFileSync(file, 'utf8')) as { score?: number; status?: string };
  episode.score = result.score;
  episode.status = result.status;
}
const passed = episodes.filter((episode) => episode.score === 1).length;
const summary = {
  run: RUN,
  benchmark: 'WebArena-Verified hard subset',
  site: ONLY ? 'chosen ids' : SITE,
  model: MODEL,
  tasks: episodes.length,
  passed,
  usd: episodes.reduce((sum, episode) => sum + episode.usd, 0),
  episodes: episodes.sort((a, b) => a.taskId - b.taskId),
};
writeFileSync(join(OUT, `summary-${ONLY ? 'chosen' : SITE}.json`), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\nWebArena-Verified hard, ${summary.site}: ${passed}/${episodes.length} scored by the official evaluator, $${summary.usd.toFixed(2)}`);
