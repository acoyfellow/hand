import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = join(import.meta.dir, '..', 'site', 'dist', 'client', 'lab', 'index.html');
const fail = (reason: string): never => {
  console.error(`site-gate FAIL: ${reason}`);
  process.exit(1);
};

if (!existsSync(page)) fail('site/dist/client/lab/index.html missing; build the site first');
const html = readFileSync(page, 'utf8');
const data = JSON.parse(readFileSync(join(import.meta.dir, '..', 'site', 'public', 'lab', 'data.json'), 'utf8')) as {
  desk3?: { rows: { tool: string; installed: boolean }[] };
  desk4?: { cells: unknown[]; episodes: number };
};

for (const id of ['desk-4', 'desk-3']) if (!html.includes(`id="${id}"`)) fail(`section ${id} missing`);
for (const chart of ['finished', 'cost']) if (!html.includes(`data-chart="${chart}"`)) fail(`slope chart ${chart} missing`);
if (!data.desk4 || data.desk4.cells.length !== 12) fail(`desk-4 needs 12 cells, has ${data.desk4?.cells.length ?? 0}`);
const sortableBody = html.split('data-sortable="desk4"')[1]?.split('</table>')[0] ?? '';
const rows = (sortableBody.match(/<tr/g) ?? []).length - 1;
if (rows !== 12) fail(`desk-4 table shows ${rows} rows, expected 12`);
const notInstalled = (data.desk3?.rows ?? []).filter((row) => !row.installed);
const installedCount = (data.desk3?.rows ?? []).length - notInstalled.length;
if (installedCount < 4) fail('desk-3 must show hand, cua, Claude computer use and agent-desktop');
if ((html.match(/Not installed\./g) ?? []).length < notInstalled.length) fail('desk-3 table does not show every not-installed reason');
if (!html.includes('Head to head, browser only')) fail('head-to-head is not labelled browser only');
console.log(`site-gate PASS: desk-4 12 rows and 2 charts, desk-3 ${data.desk3?.rows.length} tools (${notInstalled.length} not installed), head-to-head labelled`);
