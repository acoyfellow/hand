import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { LeadResult, PointId } from './lead-gate.ts';

type Summary = { t4: Record<string, { successMean: number; usdPerTask: number; medianSecondsPerTask: number }> };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const lastSrcCommit = () => execFileSync('git', ['log', '-1', '--format=%h', '--', 'src'], { encoding: 'utf8' }).trim();

export function writeLead(run: string, point: PointId, pass: boolean, metrics: LeadResult['metrics']): LeadResult {
  const manifestPath = `bench/runs/${run}/manifest.json`;
  const manifest = existsSync(manifestPath) ? readJson<{ srcCommit: string; mock: boolean }>(manifestPath) : { srcCommit: lastSrcCommit(), mock: false };
  const result: LeadResult = { point, pass, mock: manifest.mock, srcCommit: manifest.srcCommit, metrics };
  writeFileSync(`bench/runs/${run}/lead.json`, `${JSON.stringify(result, null, 2)}\n`);
  const pointsPath = 'bench/runs/lead/points.json';
  writeFileSync(pointsPath, `${JSON.stringify({ ...readJson<Record<string, string>>(pointsPath), [point]: run }, null, 2)}\n`);
  return result;
}

export function browserDevicePoint(run: string, arm = 'relay:kimi-k2.6'): LeadResult {
  const got = readJson<Summary>(`bench/runs/${run}/summary.json`).t4[arm];
  if (!got) throw new Error(`${arm} missing from ${run}`);
  const pass = got.successMean >= 28 && got.usdPerTask <= 0.003 && got.medianSecondsPerTask <= 4;
  return writeLead(run, 'browser-device', pass, {
    arm,
    successMean: got.successMean,
    usdPerTask: Number(got.usdPerTask.toFixed(5)),
    medianSeconds: Number(got.medianSecondsPerTask.toFixed(2)),
  });
}

type ParallelSummary = {
  runs: number;
  successes: number;
  lostActions: number;
  crossedActions: number;
  actions: number;
  wallSeconds: number;
  usdPerTask: number;
};

export function parallelPoint(run: string): LeadResult {
  const got = readJson<ParallelSummary>(`bench/runs/${run}/parallel.summary.json`);
  const pass = got.runs === 30 && got.lostActions === 0 && got.crossedActions === 0 && got.successes >= 28;
  return writeLead(run, 'parallel-agents', pass, got);
}

type ArmSummary = { tasks: number; solved: number; usdPerTask: number; solvedPerDollar: number };

export function publicPoint(run: string): LeadResult {
  const got = readJson<Record<'do' | 'vision', ArmSummary>>(`bench/runs/${run}/public.summary.json`);
  const pass =
    got.do.tasks === 125 && got.vision.tasks === 125 && got.do.solved >= got.vision.solved - 3 && got.do.solvedPerDollar >= 3 * got.vision.solvedPerDollar;
  return writeLead(run, 'public-benchmark', pass, {
    benchmark: 'MiniWoB++ (BrowserGym miniwob, 125 tasks)',
    doSolved: got.do.solved,
    visionSolved: got.vision.solved,
    doUsdPerTask: Number(got.do.usdPerTask.toFixed(5)),
    visionUsdPerTask: Number(got.vision.usdPerTask.toFixed(5)),
    doSolvedPerDollar: Number(got.do.solvedPerDollar.toFixed(1)),
    visionSolvedPerDollar: Number(got.vision.solvedPerDollar.toFixed(1)),
  });
}

if (import.meta.main) {
  const [kind, run] = process.argv.slice(2);
  if (kind === 'browser-device' && run) console.log(JSON.stringify(browserDevicePoint(run)));
  else if (kind === 'parallel-agents' && run) console.log(JSON.stringify(parallelPoint(run)));
  else if (kind === 'public-benchmark' && run) console.log(JSON.stringify(publicPoint(run)));
  else throw new Error('usage: bun bench/lead-record.ts browser-device|parallel-agents|public-benchmark <run>');
}
