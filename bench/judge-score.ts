import { readFileSync, writeFileSync } from 'node:fs';
import { writeLead } from './lead-record.ts';

type Verdict = 'pass' | 'fail' | 'abstain';
interface Judged {
  whole: number;
  checklist: Verdict;
  truth: boolean;
  usd: number;
}
interface Row {
  arm: string;
  task: string;
  claimedDone: boolean;
  judgeStart?: Judged;
  judgeEnd?: Judged;
}

export type JudgeName = 'whole' | 'checklist' | 'hybrid';

export const verdicts: Record<JudgeName, (sample: Judged) => Verdict> = {
  whole: (sample) => (sample.whole >= 0.5 ? 'pass' : 'fail'),
  checklist: (sample) => sample.checklist,
  hybrid: (sample) => (sample.checklist === 'abstain' ? (sample.whole >= 0.5 ? 'pass' : 'fail') : sample.checklist),
};

export function wilsonLower(successes: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = successes / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (centre - spread) / (1 + (z * z) / n);
}

export function scoreJudge(rows: readonly Row[], name: JudgeName) {
  const verdictOf = verdicts[name];
  const samples = rows.flatMap((row) => [row.judgeStart, row.judgeEnd].filter((sample): sample is Judged => sample !== undefined));
  const falseDone = rows.filter((row) => row.claimedDone && row.judgeEnd && !row.judgeEnd.truth).map((row) => row.judgeEnd as Judged);
  const trueDone = rows.filter((row) => row.claimedDone && row.judgeEnd?.truth).map((row) => row.judgeEnd as Judged);
  const negatives = samples.filter((sample) => !sample.truth);
  const caught = falseDone.filter((sample) => verdictOf(sample) !== 'pass').length;
  const metrics = {
    falseDone: falseDone.length,
    caught,
    catchRate: caught / Math.max(1, falseDone.length),
    catchLower95: wilsonLower(caught, falseDone.length),
    falsePassRate: negatives.filter((sample) => verdictOf(sample) === 'pass').length / Math.max(1, negatives.length),
    falseAlarmRate: trueDone.filter((sample) => verdictOf(sample) !== 'pass').length / Math.max(1, trueDone.length),
    abstainRate: samples.filter((sample) => verdictOf(sample) === 'abstain').length / Math.max(1, samples.length),
    usdPerCheck: samples.reduce((sum, sample) => sum + sample.usd, 0) / Math.max(1, samples.length),
    trueDone: trueDone.length,
    negatives: negatives.length,
  };
  const pass =
    metrics.falseDone >= 30 &&
    metrics.catchRate >= 0.8 &&
    metrics.catchLower95 >= 0.6 &&
    metrics.falsePassRate <= 0.02 &&
    metrics.falseAlarmRate <= 0.1 &&
    metrics.abstainRate <= 0.05 &&
    metrics.usdPerCheck <= 0.001;
  return { name, pass, metrics };
}

const readRows = (run: string): Row[] =>
  readFileSync(`bench/runs/${run}/t4.jsonl`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);

if (import.meta.main) {
  const runs = process.argv.slice(2);
  const rows = runs.flatMap(readRows);
  const names: JudgeName[] = ['whole', 'checklist', 'hybrid'];
  const scored = names.map((name) => scoreJudge(rows, name));
  const separate = Object.fromEntries(runs.map((run) => [run, names.map((name) => scoreJudge(readRows(run), name))]));
  const winner = scored
    .filter((judge) => judge.pass)
    .sort((a, b) => b.metrics.catchRate - a.metrics.catchRate || a.metrics.usdPerCheck - b.metrics.usdPerCheck)[0];
  const report = { runs, scored, separate, winner: winner?.name ?? null };
  writeFileSync(`bench/runs/${runs[0]}/judge-score.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ winner: report.winner, scored }, null, 2));
  if (process.env.HAND_RECORD_LEAD === '1' && !winner) {
    const best = [...scored].sort((a, b) => b.metrics.catchRate - a.metrics.catchRate)[0];
    const round = (value: number) => Number(value.toFixed(4));
    writeLead(runs[0] as string, 'done-check', false, {
      stage: 'judge selection',
      best: best?.name ?? 'none',
      ...Object.fromEntries(Object.entries(best?.metrics ?? {}).map(([key, value]) => [key, round(value)])),
    });
  }
}
