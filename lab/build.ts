import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCHMARKS, COMPETITORS } from './competitors.ts';

const ROOT = join(import.meta.dir, '..');
const RUNS = join(ROOT, 'bench', 'runs');
const OUT = join(ROOT, 'site', 'public', 'lab', 'data.json');

interface ArmSummary {
  successMean: number;
  n: number;
  repeats: number;
  usdPerTask: number;
  medianSecondsPerTask: number;
}

interface ScoreRow {
  readonly suite: string;
  readonly entrant: string;
  readonly arm: string;
  readonly run: string;
  readonly finished: number;
  readonly tasks: number;
  readonly repeats: number;
  readonly usdPerTask: number;
  readonly medianSeconds: number;
  readonly finishedPerDollar: number;
}

const ARM_ENTRANT: Record<string, string> = {
  'relay:kimi-k2.6': 'hand',
  duet: 'hand',
  pilot: 'hand',
  'vision:claude-opus-5-5': 'frontier-cu',
  'plan:claude-opus-5-5': 'frontier-cu',
};

const ARM_LABEL: Record<string, string> = {
  'relay:kimi-k2.6': 'hand (default: Clef picks, kimi-k2.6 plans)',
  duet: 'hand (Clef + writer only)',
  'vision:claude-opus-5-5': 'Claude Opus, screenshot every step',
  'plan:claude-opus-5-5': 'Claude Opus, page text every step',
};

function latestRunWith(arm: string): { run: string; summary: ArmSummary } | undefined {
  const runs = readdirSync(RUNS)
    .filter((run) => /^(bench-\d+|lead-browser-\d+)$/.test(run))
    .map((run) => ({ run, path: join(RUNS, run, 'summary.json') }))
    .filter(({ path }) => existsSync(path))
    .map(({ run, path }) => ({ run, t4: (JSON.parse(readFileSync(path, 'utf8')) as { t4?: Record<string, ArmSummary> }).t4 ?? {} }))
    .filter(({ t4 }) => t4[arm] && t4[arm].n === 30);
  const newest = runs.sort((a, b) => b.run.localeCompare(a.run, undefined, { numeric: true }))[0];
  return newest ? { run: newest.run, summary: newest.t4[arm] as ArmSummary } : undefined;
}

function scoreboard(): ScoreRow[] {
  return Object.keys(ARM_LABEL).flatMap((arm) => {
    const found = latestRunWith(arm);
    if (!found) return [];
    const { run, summary } = found;
    return [
      {
        suite: 'hand-30',
        entrant: ARM_ENTRANT[arm] as string,
        arm: ARM_LABEL[arm] as string,
        run,
        finished: Number(summary.successMean.toFixed(1)),
        tasks: summary.n,
        repeats: summary.repeats ?? 1,
        usdPerTask: Number(summary.usdPerTask.toFixed(5)),
        medianSeconds: Number(summary.medianSecondsPerTask.toFixed(1)),
        finishedPerDollar: Math.round(summary.successMean / summary.n / summary.usdPerTask),
      },
    ];
  });
}

async function stars(repo: string): Promise<{ stars: number; pushed: string } | undefined> {
  const response = await fetch(`https://api.github.com/repos/${repo}`, { headers: { 'user-agent': 'hand-lab' } });
  if (!response.ok) return undefined;
  const body = (await response.json()) as { stargazers_count: number; pushed_at: string };
  return { stars: body.stargazers_count, pushed: body.pushed_at.slice(0, 10) };
}

const previous = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as { competitors: { id: string; stars?: number; pushed?: string }[] }) : undefined;
const offline = process.argv.includes('--offline');
const competitors = await Promise.all(
  COMPETITORS.map(async (competitor) => {
    const live = competitor.repo && !offline ? await stars(competitor.repo) : undefined;
    const old = previous?.competitors.find((row) => row.id === competitor.id);
    return { ...competitor, stars: live?.stars ?? old?.stars, pushed: live?.pushed ?? old?.pushed };
  }),
);

interface LabSummary {
  planner: string;
  tasks: number;
  repeats: number;
  finishedMean: number;
  usdPerTask: number;
  plannerTokensPerTask: number;
  medianSeconds: number;
  unrequestedDanger: number;
  falseDone: number;
}

const ENTRANT_LABEL: Record<string, string> = {
  hand: 'hand',
  'agent-browser': 'agent-browser',
  'playwright-mcp': 'Playwright MCP',
  stagehand: 'Stagehand',
  'browser-use': 'browser-use',
};

function latestLabRun(): string | undefined {
  const runs = readdirSync(RUNS)
    .filter((run) => /^lab-\d+$/.test(run) && existsSync(join(RUNS, run, 'lab.summary.json')))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return process.env.LAB_RUN ?? runs[0];
}

function labRows(): (ScoreRow & { tokensPerTask: number; danger: number; falseDone: number })[] {
  const run = latestLabRun();
  if (!run) return [];
  const summary = JSON.parse(readFileSync(join(RUNS, run, 'lab.summary.json'), 'utf8')) as Record<string, LabSummary>;
  return Object.entries(summary).map(([entrant, row]) => ({
    suite: 'hand-30',
    entrant,
    arm: `${ENTRANT_LABEL[entrant] ?? entrant}`,
    run,
    finished: Number(row.finishedMean.toFixed(1)),
    tasks: row.tasks,
    repeats: row.repeats,
    usdPerTask: Number(row.usdPerTask.toFixed(5)),
    medianSeconds: Number(row.medianSeconds.toFixed(1)),
    finishedPerDollar: row.usdPerTask ? Math.round(row.finishedMean / row.tasks / row.usdPerTask) : 0,
    tokensPerTask: Math.round(row.plannerTokensPerTask),
    danger: row.unrequestedDanger,
    falseDone: row.falseDone,
  }));
}

const headToHead = labRows().sort((a, b) => b.finished - a.finished || b.finishedPerDollar - a.finishedPerDollar);
const rows = scoreboard().sort((a, b) => b.finished - a.finished || a.usdPerTask - b.usdPerTask);
const data = {
  generatedAt: new Date().toISOString().slice(0, 10),
  competitors: competitors.sort((a, b) => (a.id === 'hand' ? -1 : b.id === 'hand' ? 1 : (b.stars ?? 0) - (a.stars ?? 0))),
  benchmarks: BENCHMARKS,
  headToHead,
  planner: 'kimi-k2.6',
  scoreboard: rows,
};
writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`lab: ${competitors.length} entrants, ${rows.length} scored rows -> ${OUT}`);
