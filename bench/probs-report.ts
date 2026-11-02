import { readFileSync, writeFileSync } from 'node:fs';
import { writeLead } from './lead-record.ts';

interface Pick {
  readonly p: number;
  readonly correct: boolean;
}

const TAU = 0.5;
const BINS: readonly [number, number][] = [
  [0.5, 0.7],
  [0.7, 0.9],
  [0.9, 1.01],
];

export function scoreProbs(picks: readonly Pick[]) {
  const wrong = picks.filter((pick) => !pick.correct);
  const asked = picks.filter((pick) => pick.p < TAU);
  const acted = picks.filter((pick) => pick.p >= TAU);
  const bins = BINS.map(([lo, hi]) => {
    const inBin = picks.filter((pick) => pick.p >= lo && pick.p < hi);
    const meanP = inBin.reduce((sum, pick) => sum + pick.p, 0) / Math.max(1, inBin.length);
    const accuracy = inBin.filter((pick) => pick.correct).length / Math.max(1, inBin.length);
    return { lo, hi: Math.min(hi, 1), n: inBin.length, meanP, accuracy, gap: accuracy - meanP };
  });
  const counted = bins.filter((bin) => bin.n >= 20);
  const metrics = {
    picks: picks.length,
    wrongPicks: wrong.length,
    askRate: asked.length / picks.length,
    wrongRemoved: wrong.length ? wrong.filter((pick) => pick.p < TAU).length / wrong.length : 0,
    worstBinGap: Math.min(...counted.map((bin) => bin.gap)),
    wrongWhenActing: acted.filter((pick) => !pick.correct).length / Math.max(1, acted.length),
  };
  const enoughData = picks.length >= 500 && wrong.length >= 20;
  const pass = enoughData && metrics.askRate <= 0.1 && metrics.wrongRemoved >= 0.7 && metrics.worstBinGap >= -0.05 && metrics.wrongWhenActing <= 0.02;
  return { pass, enoughData, metrics, bins };
}

if (import.meta.main) {
  const run = process.argv[2] ?? 'probs-1';
  const picks = readFileSync(`bench/runs/${run}/t1.jsonl`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Pick);
  const scored = scoreProbs(picks);
  writeFileSync(`bench/runs/${run}/probs.json`, `${JSON.stringify(scored, null, 2)}\n`);
  const round = (value: number) => Number(value.toFixed(4));
  writeLead(run, 'probabilities', scored.pass, {
    enoughData: scored.enoughData,
    ...Object.fromEntries(Object.entries(scored.metrics).map(([key, value]) => [key, round(value)])),
  });
  console.log(JSON.stringify(scored, null, 2));
}
