import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESK_ENTRANTS } from '../desk-gate.ts';
import { DESK_ROSTER } from './roster.ts';
import { DESK_TASKS, defaultVm } from './suite.ts';

const flag = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const runName = flag('run') ?? 'desk-3';
const smoke = process.argv.includes('--smoke');
const only = flag('entrants')?.split(',') ?? [...DESK_ENTRANTS];
const limitTasks = Number(flag('limit') ?? (smoke ? 5 : DESK_TASKS.length));
const STOP_AT_USD = 140;
const MAX_TURNS = 30;
const DEADLINE_MS = 4 * 60_000;

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};

const shuffled = <T>(items: readonly T[], seed: number) => {
  const random = seeded(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy;
};

const dir = join(import.meta.dir, '..', '..', 'bench', 'runs', runName);
mkdirSync(dir, { recursive: true });
const episodesPath = join(dir, smoke ? 'smoke.jsonl' : 'desk.jsonl');
const spent = () =>
  ['desk.jsonl', 'smoke.jsonl']
    .map((file) => join(dir, file))
    .filter(existsSync)
    .flatMap((file) => readFileSync(file, 'utf8').split('\n').filter(Boolean))
    .reduce((sum, line) => sum + (JSON.parse(line) as { usd: number }).usd, 0);

const done = new Set(
  existsSync(episodesPath)
    ? readFileSync(episodesPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const episode = JSON.parse(line) as { entrant: string; task: string; repeat: number };
          return `${episode.entrant}|${episode.task}|${episode.repeat}`;
        })
    : [],
);

const box = defaultVm();
const order = shuffled(DESK_TASKS, 3).slice(0, limitTasks);
const installs: Record<string, { ok: boolean; reason?: string }> = {};

for (const id of only) {
  const entrant = DESK_ROSTER[id];
  if (!entrant) {
    installs[id] = { ok: false, reason: 'no adapter' };
    continue;
  }
  const install = await entrant.install(box);
  installs[id] = install;
  if (!install.ok) {
    console.log(`${id}: not installed: ${install.reason}`);
    continue;
  }
  for (const task of order) {
    if (done.has(`${id}|${task.id}|1`)) continue;
    if (spent() >= STOP_AT_USD) {
      console.log(`stopping: spend reached $${STOP_AT_USD}`);
      process.exit(0);
    }
    await task.prepare(box);
    const started = Date.now();
    const result = await entrant.run(box, task.text, { maxTurns: MAX_TURNS, deadline: started + DEADLINE_MS }).catch((error: Error) => ({ claimedDone: false, turns: 0, usd: 0, trace: [], error: `harness: ${error.message.slice(0, 300)}` }));
    const success = await task.passed(box).catch(() => false);
    const episode = {
      entrant: id,
      task: task.id,
      kind: task.kind,
      repeat: 1,
      success,
      falseDone: result.claimedDone && !success,
      usd: Number(result.usd.toFixed(5)),
      seconds: Math.round((Date.now() - started) / 1000),
      turns: result.turns,
      usedShell: result.trace.some((turn) => turn.tool === 'shell'),
      error: result.error,
      trace: result.trace,
    };
    appendFileSync(episodesPath, `${JSON.stringify(episode)}\n`);
    console.log(`${id} ${task.id}: ${success ? 'PASS' : 'fail'} ${episode.seconds}s $${episode.usd}${episode.error ? ` (${episode.error.slice(0, 60)})` : ''}`);
  }
}

if (!smoke) {
  const episodes = readFileSync(episodesPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { entrant: string; success: boolean; usd: number });
  const summaryPath = join(dir, 'desk.summary.json');
  const previous = existsSync(summaryPath) ? (JSON.parse(readFileSync(summaryPath, 'utf8')) as Record<string, unknown>) : {};
  const summary: Record<string, unknown> = { ...previous };
  for (const [id, install] of Object.entries(installs)) {
    const mine = episodes.filter((episode) => episode.entrant === id);
    summary[id] = {
      entrant: id,
      installed: install.ok,
      ...(install.reason ? { reason: install.reason } : {}),
      tasks: mine.length,
      finished: mine.filter((episode) => episode.success).length,
      usd: Number(mine.reduce((sum, episode) => sum + episode.usd, 0).toFixed(4)),
    };
  }
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}
