import { execFileSync } from 'node:child_process';

const ax = '/Users/jcoeyman/cloudflare/do/dist/hand.app/Contents/Resources/bin/ax';
const chrome = execFileSync('pgrep', ['-x', 'Google Chrome'], { encoding: 'utf8' }).split('\n')[0] ?? '';

type Candidate = { path: number[]; name: string; role: string; x: number; y: number; w: number; h: number };
const snapshot = (): Candidate[] => (JSON.parse(execFileSync(ax, ['snapshot', chrome], { encoding: 'utf8', timeout: 20_000 })) as { candidates: Candidate[] }).candidates;
const press = (name: RegExp): void => {
  const found = snapshot().find((candidate) => name.test(candidate.name) && candidate.path.slice(0, 6).join('.') === '0.0.0.0.0.1');
  if (!found) throw new Error(`no ${name} on the consent page`);
  const out = execFileSync(ax, ['click', String(found.x + found.w / 2), String(found.y + found.h / 2), '--headed'], { encoding: 'utf8', timeout: 20_000 });
  console.log(found.name, JSON.parse(out).ok);
};
const pause = (ms: number) => Bun.sleep(ms);

press(/^Search and select/);
await pause(800);
press(/^Coeyman@gmail\.com's Account$/);
await pause(800);
press(/^Review permissions$/);
await pause(2500);
press(/^Authorize$/);
