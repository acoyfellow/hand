import { NATIVE_ORACLE, NATIVE_TRIVIALLY_PASSING } from './oracle.ts';
import { DESK_TASKS, defaultVm } from './suite.ts';

const box = defaultVm();
const only = process.argv[2];
const rows: { id: string; before: boolean; after: boolean | 'skipped'; ok: boolean }[] = [];

for (const task of DESK_TASKS.filter((candidate) => candidate.kind === 'native' && (!only || candidate.id.includes(only)))) {
  const key = task.id.replace(/^mac-/, '');
  await task.prepare(box);
  const before = await task.passed(box);
  const oracle = NATIVE_ORACLE[key];
  if (!oracle) throw new Error(`no oracle for ${key}`);
  await box.run(oracle);
  await Bun.sleep(600);
  const after = await task.passed(box);
  const ok = after && (NATIVE_TRIVIALLY_PASSING.has(key) || !before);
  rows.push({ id: task.id, before, after, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${task.id.padEnd(30)} before=${before} after=${after}`);
}

const failed = rows.filter((row) => !row.ok);
console.log(`${rows.length - failed.length}/${rows.length} native checks behave`);
if (failed.length) process.exit(1);
