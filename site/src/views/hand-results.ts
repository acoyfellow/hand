import type { Html } from 'foldkit/html';
import type { Desk4CellData, Desk4Data } from '../lab-data.ts';
import { type Child, type H, scrollRegion } from './kit.ts';

const TH = 'whitespace-nowrap border-b border-line bg-bg px-3 py-2 text-left align-top text-xs font-medium text-dim';
const TD = 'border-b border-line px-3 py-2 align-top';
const NUM = 'text-right tabular-nums whitespace-nowrap';

const runUrl = (run: string) => `https://github.com/acoyfellow/hand/tree/main/bench/runs/${run}`;
const cents = (usd: number) => (usd < 0.1 ? `${(usd * 100).toFixed(1)}¢` : `$${usd.toFixed(2)}`);
const shortTask = (task: string) => task.replace(/^pwa-h-/, '').replace(/^pwa-/, '').replace(/^mac-/, '');

const handCells = (data: Desk4Data): readonly Desk4CellData[] =>
  data.models.flatMap((model) => data.cells.filter((cell) => cell.toolId === 'hand' && cell.modelId === model.id));

const headed = (h: H, id: string, index: number, title: string, lede: readonly Child[], body: readonly Child[]): Html =>
  h.section(
    [h.AriaLabelledBy(id)],
    [
      h.h2([h.Id(id), h.Class('mt-11 mb-1.5 text-[19px] font-semibold')], [h.span([h.Class('mr-2 font-medium text-dim')], [String(index)]), title]),
      h.p([h.Class('m-0 mb-3.5 max-w-[48rem] text-sm text-dim text-pretty')], lede),
      ...body,
    ],
  );

const resultsTable = (h: H, cells: readonly Desk4CellData[]): Html =>
  scrollRegion(h, 'hand on a real Mac, by model', [
    h.table(
      [h.DataAttribute('hand-results', 'desk4'), h.Class('w-full border-collapse text-[13.5px]')],
      [
        h.thead(
          [],
          [
            h.tr(
              [],
              ['Model', 'Finished', 'Web apps', 'Mac apps', 'Per finished task'].map((label, column) =>
                h.th([h.Scope('col'), h.Class(`${TH} ${column >= 1 ? 'text-right' : ''}`)], [label]),
              ),
            ),
          ],
        ),
        h.tbody(
          [],
          cells.map((cell) =>
            h.tr(
              [],
              [
                h.th([h.Scope('row'), h.Class(`${TD} text-left font-semibold`)], [cell.model]),
                h.td([h.Class(`${TD} ${NUM}`)], [`${cell.finished}/${cell.tasks}`]),
                h.td([h.Class(`${TD} ${NUM}`)], [`${cell.web}/${cell.webTasks}`]),
                h.td([h.Class(`${TD} ${NUM}`)], [`${cell.mac}/${cell.macTasks}`]),
                h.td([h.Class(`${TD} ${NUM}`)], [cents(cell.usdPerFinished)]),
              ],
            ),
          ),
        ),
      ],
    ),
  ]);

const taskGrid = (h: H, data: Desk4Data, cells: readonly Desk4CellData[]): Html => {
  const firstMac = data.tasks.findIndex((task) => task.startsWith('mac'));
  const divider = (index: number) => (index === firstMac ? 'border-l-2 border-l-line' : '');
  return scrollRegion(h, 'hand, every task', [
    h.table(
      [h.Class('w-full border-collapse text-[12px]')],
      [
        h.thead(
          [],
          [
            h.tr(
              [],
              [
                h.th([h.Class(`${TH} sticky left-0 z-10 border-r align-bottom`)], [h.span([h.Class('sr-only')], ['Model'])]),
                ...data.tasks.map((task, index) =>
                  h.th(
                    [h.Scope('col'), h.Class(`border-b border-line bg-bg px-1 py-2 align-bottom text-[11px] font-normal text-dim ${divider(index)}`)],
                    [h.span([h.Class('inline-block whitespace-nowrap [writing-mode:vertical-rl] rotate-180')], [shortTask(task)])],
                  ),
                ),
              ],
            ),
          ],
        ),
        h.tbody(
          [],
          cells.map((cell) =>
            h.tr(
              [],
              [
                h.th([h.Scope('row'), h.Class('sticky left-0 z-10 whitespace-nowrap border-b border-r border-line bg-bg px-3 py-1.5 text-left font-semibold')], [cell.model]),
                ...cell.results.map((result, index) =>
                  h.td(
                    [h.Class(`border-b border-line px-1 py-1.5 text-center ${divider(index)} ${result ? 'text-[#16a34a]' : result === false ? 'text-[#e5484d]' : 'text-dim'}`)],
                    [h.span([h.AriaHidden(true)], [result ? '✓' : result === false ? '✗' : '·']), h.span([h.Class('sr-only')], [result ? 'finished' : result === false ? 'not finished' : 'not run'])],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  ]);
};

export const handOnMac = (h: H, data: Desk4Data, index: number): Html => {
  const cells = handCells(data);
  const perfect = cells.filter((cell) => cell.finished === cell.tasks).map((cell) => cell.model);
  return headed(
    h,
    'desk-4',
    index,
    'On a real Mac',
    [
      `15 tasks inside a macOS virtual machine: 8 in web apps in Chrome, 7 in native Mac apps (Finder, Notes, TextEdit, Calendar, System Settings). One attempt each, on ${cells.length} models. A task counts only when the app's own state shows it is done, not when the agent says so. ${perfect.join(' and ')} finished every task.`,
    ],
    [
      resultsTable(h, cells),
      h.h3([h.Class('mt-6 mb-2 text-sm font-semibold')], ['Every task']),
      taskGrid(h, data, cells),
      h.p(
        [h.Class('mt-2.5 max-w-[48rem] text-[13px] text-dim text-pretty')],
        ['The rules were written down before the run in the ', h.a([h.Href(`${runUrl(data.run)}/CONTRACT.md`)], ['contract']), ', and every episode is in ', h.a([h.Href(runUrl(data.run))], [data.run]), '.'],
      ),
    ],
  );
};
