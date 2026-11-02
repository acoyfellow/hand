import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.ts';

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

const run = process.argv[2] ?? 'judge-1';
const dir = join(ROOT, 'bench', 'runs', run);
const rows = readFileSync(join(dir, 't4.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Row);

const samples = rows.flatMap((row) => [row.judgeStart, row.judgeEnd].filter((sample): sample is Judged => sample !== undefined));
const falseClaims = rows.filter((row) => row.claimedDone && row.judgeEnd && !row.judgeEnd.truth).map((row) => row.judgeEnd as Judged);

const wholeVerdict = (sample: Judged): Verdict => (sample.whole >= 0.5 ? 'pass' : 'fail');

const score = (name: string, verdictOf: (sample: Judged) => Verdict) => {
  const decided = samples.filter((sample) => verdictOf(sample) !== 'abstain');
  const correct = decided.filter((sample) => (verdictOf(sample) === 'pass') === sample.truth).length;
  const negatives = samples.filter((sample) => !sample.truth);
  const falsePass = negatives.filter((sample) => verdictOf(sample) === 'pass').length;
  const asFail = samples.filter((sample) => (verdictOf(sample) === 'pass') === sample.truth).length;
  const caught = falseClaims.filter((sample) => verdictOf(sample) !== 'pass').length;
  return {
    name,
    samples: samples.length,
    accuracyAbstainAsFail: asFail / samples.length,
    decidedRate: decided.length / samples.length,
    decidedAccuracy: decided.length ? correct / decided.length : 0,
    falsePassRate: negatives.length ? falsePass / negatives.length : 0,
    negatives: negatives.length,
    falseClaimsCaught: `${caught}/${falseClaims.length}`,
  };
};

const usd = (key: 'whole' | 'checklist') => {
  const total = samples.reduce((sum, sample) => sum + sample.usd, 0);
  return { key, totalUsdBothJudges: total, perSampleUsd: total / samples.length };
};

const result = {
  run,
  scored: [score('one whole-task question (screenshot)', wholeVerdict), score('checklist (screenshot + accessibility state)', (sample) => sample.checklist)],
  cost: usd('whole'),
};
writeFileSync(join(dir, 'judge.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
