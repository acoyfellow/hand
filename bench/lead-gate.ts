import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export type PointId = 'done-check' | 'probabilities' | 'browser-device' | 'parallel-agents' | 'public-benchmark';

export interface LeadResult {
  readonly point: PointId;
  readonly pass: boolean;
  readonly mock: boolean;
  readonly srcCommit: string;
  readonly metrics: Record<string, number | string | boolean>;
}

export const POINTS: readonly PointId[] = ['done-check', 'probabilities', 'browser-device', 'parallel-agents', 'public-benchmark'];

const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();

export function srcUnchangedSince(commit: string): boolean {
  if (!commit) return false;
  return git(`diff --name-only ${commit} HEAD -- src`) === '' && git('status --porcelain -- src') === '';
}

export function checkPoint(point: PointId, result: LeadResult | undefined, fresh: boolean, committed: boolean): string[] {
  if (!result) return [`${point}: no run recorded`];
  const failures: string[] = [];
  if (result.point !== point) failures.push(`${point}: run records point ${result.point}`);
  if (result.mock) failures.push(`${point}: mock run`);
  if (!fresh) failures.push(`${point}: ran on older src (${result.srcCommit.slice(0, 7)}), rerun`);
  if (!committed) failures.push(`${point}: run files are not committed`);
  if (!result.pass) failures.push(`${point}: below its bar ${JSON.stringify(result.metrics)}`);
  return failures;
}

if (import.meta.main) {
  const points: Partial<Record<PointId, string>> = existsSync('bench/runs/lead/points.json')
    ? JSON.parse(readFileSync('bench/runs/lead/points.json', 'utf8'))
    : {};
  const failures: string[] = [];
  for (const point of POINTS) {
    const run = points[point];
    const path = run ? `bench/runs/${run}/lead.json` : '';
    const result = path && existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as LeadResult) : undefined;
    const committed = Boolean(path) && existsSync(path) && git(`status --porcelain -- bench/runs/${run}`) === '';
    const pointFailures = checkPoint(point, result, result ? srcUnchangedSince(result.srcCommit) : false, committed);
    console.log(`${pointFailures.length ? 'FAIL' : 'PASS'} ${point}${run ? ` (${run})` : ''}`);
    for (const failure of pointFailures) console.log(`  ${failure}`);
    failures.push(...pointFailures);
  }
  console.log(
    failures.length ? `lead-gate: ${POINTS.length - new Set(failures.map((f) => f.split(':')[0])).size}/${POINTS.length} pass` : 'lead-gate: PASS 5/5',
  );
  process.exit(failures.length ? 1 : 0);
}
