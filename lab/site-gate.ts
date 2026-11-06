import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dir, '..', 'site', 'dist', 'client');
const fail = (reason: string): never => {
  console.error(`site-gate FAIL: ${reason}`);
  process.exit(1);
};

const lab = join(dist, 'lab', 'index.html');
const home = join(dist, 'index.html');
if (!existsSync(lab) || !existsSync(home)) fail('built pages missing; build the site first');
const labHtml = readFileSync(lab, 'utf8');
const homeHtml = readFileSync(home, 'utf8');
const data = JSON.parse(readFileSync(join(import.meta.dir, '..', 'site', 'public', 'lab', 'data.json'), 'utf8')) as {
  desk4?: { cells: { toolId: string }[] };
  tests: unknown[];
};

for (const id of ['desk-4', 'tests']) if (!labHtml.includes(`id="${id}"`)) fail(`lab section ${id} missing`);
const handRows = (data.desk4?.cells ?? []).filter((cell) => cell.toolId === 'hand').length;
const tableBody = labHtml.split('data-hand-results="desk4"')[1]?.split('</table>')[0] ?? '';
const shown = (tableBody.match(/<tr/g) ?? []).length - 1;
if (handRows === 0 || shown !== handRows) fail(`hand results table shows ${shown} rows, data has ${handRows}`);
const testRows = (labHtml.split('id="tests"')[1]?.split('</table>')[0]?.match(/<tr/g) ?? []).length - 1;
if (testRows !== data.tests.length) fail(`tests table shows ${testRows} rows, data has ${data.tests.length}`);
if (!/>fail</.test(labHtml)) fail('failed tests must stay visible on the lab page');
const rivals = /Claude computer use|agent-desktop|browser-use|Head to head|Landscape|competitor/i;
for (const [name, html] of [['home', homeHtml], ['lab', labHtml]] as const) {
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const hit = visible.match(rivals);
  if (hit) fail(`${name} page still names a rival: "${hit[0]}"`);
}
console.log(`site-gate PASS: lab shows hand on ${handRows} models and ${testRows} tests (failures kept); no rival named on home or lab`);
