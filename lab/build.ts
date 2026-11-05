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

const POINT_LABEL: Record<string, string> = {
  'browser-device': 'hand finishes 30 browser tasks cheaply and fast',
  probabilities: "hand's confidence is honest: it asks instead of guessing",
  'parallel-agents': 'Three agents share one browser without losing or crossing clicks',
  'done-check': 'A checker can catch an agent that says "done" when it is not',
  'public-benchmark': 'MiniWoB++: as many tasks as a screenshot agent at 3x the value',
};

function tests() {
  const points = JSON.parse(readFileSync(join(RUNS, 'lead', 'points.json'), 'utf8')) as Record<string, string>;
  return Object.entries(points).map(([point, run]) => {
    const lead = JSON.parse(readFileSync(join(RUNS, run, 'lead.json'), 'utf8')) as { pass: boolean; metrics: Record<string, unknown>; srcCommit: string };
    return { point, claim: POINT_LABEL[point] ?? point, run, pass: lead.pass, srcCommit: lead.srcCommit, metrics: lead.metrics };
  });
}

function miniwob() {
  const path = join(RUNS, 'public-1', 'public.summary.json');
  if (!existsSync(path)) return undefined;
  return { run: 'public-1', ...(JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>) };
}

const DESK_MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Opus 5.5',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'gpt-6.1-sol': 'gpt-6.1-sol',
  'glm-5.3': 'glm-5.3',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

const DESK_TOOL_LABEL: Record<string, string> = {
  hand: 'hand',
  'agent-desktop': 'agent-desktop',
  'claude-cu': 'Claude computer use',
  'codex-cu': 'Codex computer use',
  cua: 'cua',
};

interface GridEpisode {
  readonly cell: string;
  readonly entrant: string;
  readonly model: string;
  readonly task: string;
  readonly kind: string;
  readonly success: boolean;
  readonly usd: number;
}

const isGridFile = (file: string) => file.startsWith('grid-') && file.endsWith('.jsonl');

const jsonLines = <T>(path: string): T[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);

const macFirstOrder = (a: string, b: string) => Number(a.startsWith('mac')) - Number(b.startsWith('mac')) || a.localeCompare(b);

function desk4() {
  const dir = join(RUNS, 'desk-4');
  if (!existsSync(join(dir, 'grid.summary.json'))) return undefined;
  const episodes = readdirSync(dir)
    .filter(isGridFile)
    .flatMap((file) => jsonLines<GridEpisode>(join(dir, file)));
  const tasks = [...new Set(episodes.map((episode) => episode.task))].sort(macFirstOrder);
  const cells = [...new Set(episodes.map((episode) => episode.cell))].map((cell) => {
    const mine = episodes.filter((episode) => episode.cell === cell);
    const first = mine[0] as GridEpisode;
    const finished = mine.filter((episode) => episode.success).length;
    const usd = mine.reduce((sum, episode) => sum + episode.usd, 0);
    const web = mine.filter((episode) => episode.kind === 'pwa');
    const mac = mine.filter((episode) => episode.kind !== 'pwa');
    return {
      tool: DESK_TOOL_LABEL[first.entrant] ?? first.entrant,
      toolId: first.entrant,
      model: DESK_MODEL_LABEL[first.model] ?? first.model,
      modelId: first.model,
      tasks: mine.length,
      finished,
      web: web.filter((episode) => episode.success).length,
      webTasks: web.length,
      mac: mac.filter((episode) => episode.success).length,
      macTasks: mac.length,
      usd: Number(usd.toFixed(4)),
      usdPerFinished: finished ? Number((usd / finished).toFixed(4)) : 0,
      results: tasks.map((task) => mine.find((episode) => episode.task === task)?.success ?? null),
    };
  });
  return {
    run: 'desk-4',
    tasks,
    episodes: episodes.length,
    usd: Number(episodes.reduce((sum, episode) => sum + episode.usd, 0).toFixed(2)),
    models: Object.keys(DESK_MODEL_LABEL)
      .filter((model) => cells.some((cell) => cell.modelId === model))
      .map((id) => ({ id, label: DESK_MODEL_LABEL[id] ?? id })),
    cells,
  };
}

interface Desk3Summary {
  readonly entrant: string;
  readonly installed: boolean;
  readonly reason?: string;
  readonly tasks: number;
  readonly finished: number;
  readonly usd: number;
}

const DESK3_MODEL: Record<string, string> = { hand: 'kimi-k2.6', 'agent-desktop': 'kimi-k2.6', 'claude-cu': 'Sonnet 4.6' };

function desk3() {
  const path = join(RUNS, 'desk-3', 'desk.summary.json');
  if (!existsSync(path)) return undefined;
  const summary = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Desk3Summary>;
  const episodes = jsonLines<{ entrant: string; task: string; success: boolean }>(join(RUNS, 'desk-3', 'desk.jsonl'));
  return {
    run: 'desk-3',
    rows: Object.values(summary)
      .map((row) => {
        const mac = episodes.filter((episode) => episode.entrant === row.entrant && episode.task.startsWith('mac'));
        return {
          tool: DESK_TOOL_LABEL[row.entrant] ?? row.entrant,
          model: DESK3_MODEL[row.entrant] ?? '',
          installed: row.installed,
          reason: row.reason ?? '',
          tasks: row.tasks,
          finished: row.finished,
          mac: mac.filter((episode) => episode.success).length,
          macTasks: mac.length,
          usd: Number(row.usd.toFixed(2)),
        };
      })
      .sort((a, b) => Number(b.installed) - Number(a.installed) || b.finished - a.finished),
  };
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
  tests: tests(),
  miniwob: miniwob(),
  desk3: desk3(),
  desk4: desk4(),
};
writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`lab: ${competitors.length} entrants, ${rows.length} scored rows -> ${OUT}`);
