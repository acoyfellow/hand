import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Step = { tool: string; args: Record<string, unknown>; result?: string };
type Row = { entrant: string; task: string; kind: string; success: boolean; falseDone: boolean; seconds: number; turns: number; trace?: Step[] };

const rows = readFileSync(join(import.meta.dir, '..', '..', 'bench', 'runs', 'desk-3', 'desk.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Row);
const entrants = [...new Set(rows.map((row) => row.entrant))];
const tasks = [...new Set(rows.map((row) => row.task))];
const cell = (entrant: string, task: string) => rows.find((row) => row.entrant === entrant && row.task === task);

console.log(`${'task'.padEnd(28)}${entrants.map((entrant) => entrant.slice(0, 12).padEnd(14)).join('')}`);
for (const task of tasks) {
  const marks = entrants.map((entrant) => {
    const row = cell(entrant, task);
    return (row ? `${row.success ? 'PASS' : row.falseDone ? 'lie' : 'fail'} ${row.seconds}s` : '-').padEnd(14);
  });
  console.log(`${task.slice(0, 27).padEnd(28)}${marks.join('')}`);
}

const focus = process.argv[2];
if (focus) {
  for (const entrant of entrants) {
    const row = cell(entrant, focus);
    if (!row) continue;
    console.log(`\n=== ${entrant} on ${focus}: ${row.success ? 'PASS' : 'fail'} ${row.seconds}s ${row.turns} turns`);
    for (const step of row.trace ?? []) console.log(`  ${step.tool} ${JSON.stringify(step.args).slice(0, 220)}\n    -> ${(step.result ?? '').replace(/\n/g, ' ').slice(0, 160)}`);
  }
}
