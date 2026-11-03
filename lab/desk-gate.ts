import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESK_TASKS } from './desk/suite.ts';

export const DESK_ENTRANTS = ['hand', 'codex-cu', 'cua', 'claude-cu', 'agent-desktop'] as const;

export const SPEND_LIMIT_USD = 150;

interface Episode {
  readonly entrant: string;
  readonly task: string;
  readonly repeat: number;
  readonly success: boolean;
  readonly usd: number;
}

interface SummaryRow {
  readonly entrant: string;
  readonly installed: boolean;
  readonly reason?: string;
  readonly tasks: number;
  readonly finished: number;
  readonly usd: number;
}

const run = process.argv[2];
if (!run) throw new Error('usage: bun lab/desk-gate.ts <run>');

const dir = join(import.meta.dir, '..', 'bench', 'runs', run);
const fail = (message: string): never => {
  console.error(`desk-gate FAIL: ${message}`);
  process.exit(1);
};

if (!existsSync(join(dir, 'CONTRACT.md'))) fail('CONTRACT.md missing');
const summaryPath = join(dir, 'desk.summary.json');
if (!existsSync(summaryPath)) fail('desk.summary.json missing');
const episodesPath = join(dir, 'desk.jsonl');
const episodes: Episode[] = existsSync(episodesPath)
  ? readFileSync(episodesPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Episode)
  : [];

const summary = JSON.parse(readFileSync(summaryPath, 'utf8')) as Record<string, SummaryRow>;
const taskIds = new Set(DESK_TASKS.map((task) => task.id));
if (taskIds.size < 40) fail(`suite has ${taskIds.size} tasks, need >= 40`);

for (const entrant of DESK_ENTRANTS) {
  const row = summary[entrant];
  if (!row) fail(`no summary row for ${entrant}`);
  const mine = episodes.filter((episode) => episode.entrant === entrant);
  if (!row.installed) {
    if (!row.reason || row.reason.length < 20) fail(`${entrant} not installed and has no written reason`);
    continue;
  }
  const covered = new Set(mine.map((episode) => episode.task));
  const missing = [...taskIds].filter((id) => !covered.has(id));
  if (missing.length) fail(`${entrant} missing ${missing.length} tasks, e.g. ${missing.slice(0, 3).join(', ')}`);
  const finished = mine.filter((episode) => episode.success).length;
  const repeats = new Set(mine.map((episode) => episode.repeat)).size;
  const recomputed = finished / repeats;
  if (Math.abs(recomputed - row.finished) > 0.05) fail(`${entrant} finished ${row.finished} in summary but ${recomputed.toFixed(2)} from episodes`);
}

const spend = episodes.reduce((sum, episode) => sum + episode.usd, 0);
if (spend > SPEND_LIMIT_USD) fail(`spend $${spend.toFixed(2)} exceeds $${SPEND_LIMIT_USD}`);

console.log(`desk-gate PASS: ${DESK_ENTRANTS.length} entrants, ${taskIds.size} tasks, ${episodes.length} episodes, $${spend.toFixed(2)} spent`);
