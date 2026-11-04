import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GRID_CELLS, GRID_SPEND_LIMIT_USD, GRID_TASKS } from './desk/grid.ts';

interface Episode {
  readonly cell: string;
  readonly task: string;
  readonly kind: string;
  readonly success: boolean;
  readonly falseDone: boolean;
  readonly usd: number;
  readonly seconds: number;
}

const run = process.argv[2];
if (!run) throw new Error('usage: bun lab/grid-gate.ts <run>');
const dir = join(import.meta.dir, '..', 'bench', 'runs', run);
const fail = (message: string): never => {
  console.error(`grid-gate FAIL: ${message}`);
  process.exit(1);
};

if (!existsSync(join(dir, 'CONTRACT.md'))) fail('CONTRACT.md missing');

const lanes = ['a', 'b'];
const episodes = lanes
  .map((lane) => join(dir, `grid-${lane}.jsonl`))
  .filter(existsSync)
  .flatMap((file) => readFileSync(file, 'utf8').split('\n').filter(Boolean))
  .map((line) => JSON.parse(line) as Episode);
const installs = lanes
  .map((lane) => join(dir, `installs-${lane}.json`))
  .filter(existsSync)
  .reduce<Record<string, { ok: boolean; reason?: string }>>((all, file) => ({ ...all, ...JSON.parse(readFileSync(file, 'utf8')) }), {});

const summary: Record<string, unknown> = {};
for (const gridCell of GRID_CELLS) {
  const install = installs[gridCell.key];
  const mine = episodes.filter((episode) => episode.cell === gridCell.key);
  const finished = mine.filter((episode) => episode.success);
  summary[gridCell.key] = {
    entrant: gridCell.entrant,
    model: gridCell.model,
    ran: install?.ok ?? false,
    ...(install?.reason ? { reason: install.reason } : {}),
    tasks: new Set(mine.map((episode) => episode.task)).size,
    finished: finished.length,
    native: finished.filter((episode) => episode.kind === 'native').length,
    pwa: finished.filter((episode) => episode.kind === 'pwa').length,
    falseDone: mine.filter((episode) => episode.falseDone).length,
    usd: Number(mine.reduce((sum, episode) => sum + episode.usd, 0).toFixed(4)),
    avgSeconds: mine.length ? Math.round(mine.reduce((sum, episode) => sum + episode.seconds, 0) / mine.length) : 0,
  };
  if (!install) fail(`${gridCell.key} never attempted`);
  if (!install.ok) {
    if (!install.reason || install.reason.length < 20) fail(`${gridCell.key} did not run and has no written reason`);
    continue;
  }
  const missing = GRID_TASKS.filter((task) => !mine.some((episode) => episode.task === task));
  if (missing.length) fail(`${gridCell.key} missing ${missing.length} tasks, e.g. ${missing.slice(0, 3).join(', ')}`);
}

const total = episodes.reduce((sum, episode) => sum + episode.usd, 0);
if (total > GRID_SPEND_LIMIT_USD) fail(`spent $${total.toFixed(2)} over the $${GRID_SPEND_LIMIT_USD} limit`);
writeFileSync(join(dir, 'grid.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`grid-gate PASS: ${GRID_CELLS.length} cells, ${GRID_TASKS.length} tasks, ${episodes.length} episodes, $${total.toFixed(2)} spent`);
