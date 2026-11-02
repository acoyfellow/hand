import { readFileSync, writeFileSync } from 'node:fs';
import type { LeadResult, PointId } from './lead-gate.ts';

type Summary = { t4: Record<string, { successMean: number; usdPerTask: number; medianSecondsPerTask: number }> };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export function writeLead(run: string, point: PointId, pass: boolean, metrics: LeadResult['metrics']): LeadResult {
  const manifest = readJson<{ srcCommit: string; mock: boolean }>(`bench/runs/${run}/manifest.json`);
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

if (import.meta.main) {
  const [kind, run] = process.argv.slice(2);
  if (kind === 'browser-device' && run) console.log(JSON.stringify(browserDevicePoint(run)));
  else throw new Error('usage: bun bench/lead-record.ts browser-device <run>');
}
