import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRID_CELLS, GRID_SPEND_LIMIT_USD, GRID_TASKS } from './grid.ts';
import { probeModel } from './models.ts';
import { DESK_TASKS } from './suite.ts';
import { vm } from './vm.ts';

const flag = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const runName = flag('run') ?? 'desk-4';
const host = flag('host') ?? '192.168.64.7';
const lane = flag('lane') ?? 'a';
const cells = (flag('cells')?.split(',') ?? GRID_CELLS.map((gridCell) => gridCell.key)).map((key) => {
  const found = GRID_CELLS.find((gridCell) => gridCell.key === key);
  if (!found) throw new Error(`unknown cell ${key}`);
  return found;
});
const STOP_AT_USD = GRID_SPEND_LIMIT_USD - 4;
const MAX_TURNS = 30;
const DEADLINE_MS = 4 * 60_000;

const dir = join(import.meta.dir, '..', '..', 'bench', 'runs', runName);
mkdirSync(dir, { recursive: true });
const episodesPath = join(dir, `grid-${lane}.jsonl`);
const installsPath = join(dir, `installs-${lane}.json`);

interface Episode {
  readonly cell: string;
  readonly task: string;
  readonly usd: number;
}

const readEpisodes = (): Episode[] =>
  ['a', 'b']
    .map((name) => join(dir, `grid-${name}.jsonl`))
    .filter(existsSync)
    .flatMap((file) => readFileSync(file, 'utf8').split('\n').filter(Boolean))
    .map((line) => JSON.parse(line) as Episode);

const spent = () => readEpisodes().reduce((sum, episode) => sum + episode.usd, 0);
const alreadyRun = (cell: string, task: string) => readEpisodes().some((episode) => episode.cell === cell && episode.task === task);
const installs: Record<string, { ok: boolean; reason?: string }> = existsSync(installsPath) ? JSON.parse(readFileSync(installsPath, 'utf8')) : {};

const box = vm(host);
const tasks = GRID_TASKS.map((id) => {
  const task = DESK_TASKS.find((candidate) => candidate.id === id);
  if (!task) throw new Error(`grid task ${id} missing from suite`);
  return task;
});

for (const gridCell of cells) {
  const entrant = gridCell.make();
  const model = await probeModel(gridCell.model);
  const install = model.ok ? await entrant.install(box) : model;
  installs[gridCell.key] = install.ok ? { ok: true } : { ok: false, reason: install.reason };
  writeFileSync(installsPath, `${JSON.stringify(installs, null, 2)}\n`);
  if (!install.ok) {
    console.log(`${gridCell.key}: not run: ${install.reason}`);
    continue;
  }
  for (const task of process.argv.includes('--from-end') ? [...tasks].reverse() : tasks) {
    if (alreadyRun(gridCell.key, task.id)) continue;
    if (spent() >= STOP_AT_USD) {
      console.log(`stopping: spend reached $${STOP_AT_USD}`);
      process.exit(0);
    }
    await task.prepare(box);
    const started = Date.now();
    const result = await entrant
      .run(box, task.text, { maxTurns: MAX_TURNS, deadline: started + DEADLINE_MS })
      .catch((error: Error) => ({ claimedDone: false, turns: 0, usd: 0, trace: [], error: `harness: ${error.message.slice(0, 300)}` }));
    const success = await task.passed(box).catch(() => false);
    const episode = {
      cell: gridCell.key,
      entrant: gridCell.entrant,
      model: gridCell.model,
      task: task.id,
      kind: task.kind,
      success,
      falseDone: result.claimedDone && !success,
      usd: Number(result.usd.toFixed(5)),
      seconds: Math.round((Date.now() - started) / 1000),
      turns: result.turns,
      error: result.error,
      trace: result.trace,
    };
    appendFileSync(episodesPath, `${JSON.stringify(episode)}\n`);
    console.log(`${gridCell.key} ${task.id}: ${success ? 'PASS' : 'fail'} ${episode.seconds}s $${episode.usd}${episode.error ? ` (${episode.error.slice(0, 60)})` : ''}`);
  }
}
