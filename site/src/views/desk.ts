import type { Html } from 'foldkit/html';
import type { Desk3Data, Desk4CellData, Desk4Data } from '../lab-data.ts';
import { SortableTable } from '../mounts.ts';
import { type Child, type H, rawSvg, scrollRegion } from './kit.ts';

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-5-5': '#D97757',
  'claude-sonnet-5-5': '#8B5CF6',
  'gpt-6.1-sol': '#16A34A',
  'glm-5.3': '#2E9BF0',
  'deepseek-v4-pro': '#EAB308',
};

const TOOL_ORDER = ['agent-desktop', 'hand', 'claude-cu'];
const TOOL_SHORT: Record<string, string> = { 'agent-desktop': 'agent-desktop', hand: 'hand', 'claude-cu': 'Claude computer use' };

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dollars = (usd: number) => (usd < 0.1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`);

type Metric = {
  readonly id: string;
  readonly title: string;
  readonly value: (cell: Desk4CellData) => number;
  readonly label: (cell: Desk4CellData) => string;
  readonly scale: (value: number) => number;
  readonly ticks: readonly { value: number; text: string }[];
  readonly better: string;
};

type Layout = { readonly modelName: (label: string) => string; readonly width: number; readonly height: number; readonly columns: readonly number[]; readonly font: number; readonly toolFont: number; readonly toolNames: Record<string, string> };

const WIDE_LAYOUT: Layout = { modelName: (label) => label, width: 640, height: 360, columns: [170, 345, 520], font: 11.5, toolFont: 12.5, toolNames: TOOL_SHORT };
const NARROW_LAYOUT: Layout = { modelName: (label) => label.replace('DeepSeek V4 Pro', 'DeepSeek').replace('gpt-6.1-sol', 'gpt-6.1'), width: 360, height: 360, columns: [122, 222, 312], font: 11, toolFont: 11, toolNames: { 'agent-desktop': 'agent-desktop', hand: 'hand', 'claude-cu': 'Claude CU' } };

const TOP = 34;
const BOTTOM = 318;

const linear = (low: number, high: number) => (value: number) => BOTTOM - ((value - low) / (high - low)) * (BOTTOM - TOP);

const logScale = (low: number, high: number) => (value: number) =>
  BOTTOM - ((Math.log10(Math.max(value, low)) - Math.log10(low)) / (Math.log10(high) - Math.log10(low))) * (BOTTOM - TOP);

const FINISHED: Metric = {
  id: 'finished',
  title: 'Tasks finished out of 15',
  value: (cell) => cell.finished,
  label: (cell) => String(cell.finished),
  scale: linear(5, 15),
  ticks: [5, 7, 9, 11, 13, 15].map((value) => ({ value, text: String(value) })),
  better: 'Higher is better.',
};

const COST: Metric = {
  id: 'cost',
  title: 'Cost per finished task',
  value: (cell) => cell.usdPerFinished,
  label: (cell) => dollars(cell.usdPerFinished),
  scale: (value) => TOP + BOTTOM - logScale(0.02, 4)(value),
  ticks: [0.02, 0.1, 0.5, 2].map((value) => ({ value, text: dollars(value) })),
  better: 'Lower is better, so up is cheaper. Log scale.',
};

const spread = (items: { key: string; y: number }[], gap: number) => {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1] as { y: number };
    const current = sorted[index] as { y: number };
    if (current.y - previous.y < gap) current.y = previous.y + gap;
  }
  return new Map(sorted.map((item) => [item.key, item.y]));
};

const slopeSvg = (data: Desk4Data, metric: Metric, layout: Layout) => {
  const COLUMN_X = layout.columns;
  const parts: string[] = [];
  for (const tick of metric.ticks) {
    const y = metric.scale(tick.value);
    parts.push(`<line x1="${COLUMN_X[0]}" x2="${COLUMN_X[2]}" y1="${y}" y2="${y}" stroke="var(--hd-line)" stroke-width="1"/>`);
  }
  TOOL_ORDER.forEach((tool, index) => {
    const x = COLUMN_X[index] as number;
    parts.push(`<line x1="${x}" x2="${x}" y1="${TOP - 6}" y2="${BOTTOM + 4}" stroke="var(--hd-line)" stroke-width="1"/>`);
    parts.push(`<text x="${x}" y="${layout.height - 16}" text-anchor="middle" fill="var(--hd-text)" font-size="${layout.toolFont}" font-weight="600">${layout.toolNames[tool]}</text>`);
  });
  const cellFor = (tool: string, model: string) => data.cells.find((cell) => cell.toolId === tool && cell.modelId === model);
  for (const model of data.models) {
    const color = MODEL_COLORS[model.id] ?? '#888';
    const points = TOOL_ORDER.flatMap((tool, index) => {
      const cell = cellFor(tool, model.id);
      return cell ? [{ x: COLUMN_X[index] as number, y: metric.scale(metric.value(cell)) }] : [];
    });
    const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y.toFixed(1)}`).join(' ');
    parts.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const point of points) parts.push(`<circle cx="${point.x}" cy="${point.y.toFixed(1)}" r="4.5" fill="${color}" stroke="var(--hd-bg)" stroke-width="1.5"/>`);
  }
  TOOL_ORDER.forEach((tool, index) => {
    const x = COLUMN_X[index] as number;
    const groups = new Map<string, { y: number; text: string; models: { label: string; color: string }[] }>();
    for (const model of data.models) {
      const cell = cellFor(tool, model.id);
      if (!cell) continue;
      const text = metric.label(cell);
      const group = groups.get(text) ?? { y: metric.scale(metric.value(cell)), text, models: [] };
      group.models.push({ label: model.label, color: MODEL_COLORS[model.id] ?? '#888' });
      groups.set(text, group);
    }
    type LabelEntry = { key: string; y: number; model: { label: string; color: string } | undefined; text: string; shared: number };
    const entries = [...groups.values()].flatMap((group): LabelEntry[] =>
      index === 0
        ? group.models.map((model, slot) => ({ key: `${group.text}|${slot}`, y: group.y, model, text: slot === group.models.length - 1 ? group.text : '', shared: group.models.length }))
        : [{ key: group.text, y: group.y, model: undefined, text: group.text, shared: group.models.length }],
    );
    const placed = spread(entries.map((entry) => ({ key: entry.key, y: entry.y })), 14);
    for (const entry of entries) {
      const y = (placed.get(entry.key) ?? entry.y) + 4;
      if (entry.model) {
        const value = entry.text ? ` <tspan fill="var(--hd-text)" font-weight="600">${escapeText(entry.text)}</tspan>` : entry.shared > 1 ? ' <tspan fill="var(--hd-dim)">┐</tspan>' : '';
        parts.push(`<text x="${x - 10}" y="${y}" text-anchor="end" font-size="${layout.font}"><tspan fill="${entry.model.color}" font-weight="600">${escapeText(layout.modelName(entry.model.label))}</tspan>${value}</text>`);
      } else {
        parts.push(`<text x="${x + 10}" y="${y}" font-size="${layout.font}"><tspan fill="var(--hd-text)" font-weight="600">${escapeText(entry.text)}</tspan></text>`);
      }
    }
  });
  return parts.join('');
};

const describe = (data: Desk4Data, metric: Metric) =>
  `${metric.title}, per model, for agent-desktop, hand and Claude computer use. ` +
  data.models
    .map((model) => {
      const values = TOOL_ORDER.flatMap((tool) => {
        const cell = data.cells.find((candidate) => candidate.toolId === tool && candidate.modelId === model.id);
        return cell ? [`${TOOL_SHORT[tool]} ${metric.label(cell)}`] : [];
      });
      return `${model.label}: ${values.join(', ')}`;
    })
    .join('. ');

const slopeChart = (h: H, data: Desk4Data, metric: Metric): Html =>
  h.figure(
    [h.Class('m-0 rounded-[10px] border border-line p-3 sm:p-4')],
    [
      h.figcaption([h.Class('mb-1 text-sm font-semibold text-balance')], [metric.title, h.span([h.Class('ml-2 text-xs font-normal text-dim')], [metric.better])]),
      h.div(
        [h.DataAttribute('chart', metric.id)],
        [
          rawSvg(h, { viewBox: `0 0 ${NARROW_LAYOUT.width} ${NARROW_LAYOUT.height}`, className: 'block h-auto w-full sm:hidden', label: describe(data, metric) }, slopeSvg(data, metric, NARROW_LAYOUT)),
          rawSvg(h, { viewBox: `0 0 ${WIDE_LAYOUT.width} ${WIDE_LAYOUT.height}`, className: 'hidden h-auto w-full sm:block', label: describe(data, metric) }, slopeSvg(data, metric, WIDE_LAYOUT)),
        ],
      ),
    ],
  );

const TH = 'whitespace-nowrap border-b border-line bg-bg px-3 py-2 text-left align-top text-xs font-medium text-dim';
const TD = 'border-b border-line px-3 py-2 align-top';
const NUM = 'text-right tabular-nums whitespace-nowrap';

type SortColumn = { readonly label: string; readonly numeric: boolean; readonly descending: boolean; readonly value: (cell: Desk4CellData) => string | number; readonly show: (cell: Desk4CellData) => string };

const SORT_COLUMNS: readonly SortColumn[] = [
  { label: 'Model', numeric: false, descending: false, value: (cell) => cell.model, show: (cell) => cell.model },
  { label: 'Tool', numeric: false, descending: false, value: (cell) => cell.tool, show: (cell) => cell.tool },
  { label: 'Finished', numeric: true, descending: true, value: (cell) => cell.finished / cell.tasks, show: (cell) => `${cell.finished}/${cell.tasks}` },
  { label: 'Web apps', numeric: true, descending: true, value: (cell) => cell.web / cell.webTasks, show: (cell) => `${cell.web}/${cell.webTasks}` },
  { label: 'Mac apps', numeric: true, descending: true, value: (cell) => cell.mac / cell.macTasks, show: (cell) => `${cell.mac}/${cell.macTasks}` },
  { label: 'Cost', numeric: true, descending: false, value: (cell) => cell.usd, show: (cell) => dollars(cell.usd) },
  { label: 'Per finished task', numeric: true, descending: false, value: (cell) => cell.usdPerFinished, show: (cell) => dollars(cell.usdPerFinished) },
];

const bestByModel = (data: Desk4Data) =>
  new Set(
    data.models.map((model) => {
      const mine = data.cells.filter((cell) => cell.modelId === model.id);
      const best = [...mine].sort((a, b) => b.finished - a.finished || a.usdPerFinished - b.usdPerFinished)[0];
      return best ? `${best.toolId}@${best.modelId}` : '';
    }),
  );

const sortableTable = (h: H, data: Desk4Data): Html => {
  const best = bestByModel(data);
  const rows = [...data.cells].sort((a, b) => data.models.findIndex((m) => m.id === a.modelId) - data.models.findIndex((m) => m.id === b.modelId) || b.finished - a.finished);
  return h.div([h.OnMount(SortableTable())], [
    scrollRegion(h, 'Same model, different tool: every result', [
    h.table(
      [h.Class('w-full border-collapse text-[13.5px]'), h.DataAttribute('sortable', 'desk4')],
      [
        h.thead(
          [],
          [
            h.tr(
              [],
              SORT_COLUMNS.map((column, index) =>
                h.th(
                  [h.Scope('col'), h.Class(`${TH} ${column.numeric ? 'text-right' : ''}`), ...(index === 0 ? [h.AriaSort('ascending')] : [])],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('cursor-pointer border-0 bg-transparent p-0 font-inherit text-inherit hover:text-ink'),
                        h.DataAttribute('sortColumn', String(index)),
                        h.DataAttribute('sortDescending', String(column.descending)),
                      ],
                      [column.label],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        h.tbody(
          [],
          rows.map((cell) =>
            h.tr(
              [h.Class(`[&:last-child>*]:border-b-0 `)],
              SORT_COLUMNS.map((column, index) => {
                const winner = index === 2 && best.has(`${cell.toolId}@${cell.modelId}`);
                const content: Child[] = [column.show(cell)];
                const attributes = [h.DataAttribute('sortValue', String(column.value(cell))), h.Class(`${TD} whitespace-nowrap ${column.numeric ? NUM : 'text-left'} ${index === 1 || winner ? 'font-semibold' : ''}`)];
                return index === 0 ? h.th([h.Scope('row'), ...attributes], content) : h.td(attributes, content);
              }),
            ),
          ),
        ),
      ],
    ),
  ]),
  ]);
};

const shortTask = (task: string) => task.replace(/^pwa-h-/, '').replace(/^pwa-/, '').replace(/^mac-/, '');

const taskGrid = (h: H, data: Desk4Data): Html => {
  const cells = [...data.cells].sort((a, b) => TOOL_ORDER.indexOf(a.toolId) - TOOL_ORDER.indexOf(b.toolId) || data.models.findIndex((m) => m.id === a.modelId) - data.models.findIndex((m) => m.id === b.modelId));
  const firstMac = data.tasks.findIndex((task) => task.startsWith('mac'));
  const divider = (index: number) => (index === firstMac ? 'border-l-2 border-l-line' : '');
  return scrollRegion(h, 'Every task, every run', [
    h.table(
      [h.Class('w-full border-collapse text-[12px]')],
      [
        h.thead(
          [],
          [
            h.tr(
              [],
              [
                h.th([h.Class(`${TH} sticky left-0 z-10 border-r align-bottom`)], [h.span([h.Class('sr-only')], ['Tool and model'])]),
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
                h.th([h.Scope('row'), h.Class('sticky left-0 z-10 whitespace-nowrap border-b border-r border-line bg-bg px-3 py-1.5 text-left font-normal')], [h.span([h.Class('font-semibold')], [cell.tool]), ` · ${cell.model}`]),
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

const runUrl = (run: string) => `https://github.com/acoyfellow/hand/tree/main/bench/runs/${run}`;

export const desk4Section = (h: H, data: Desk4Data, index: number): Html => {
  const wins = data.models.filter((model) => {
    const mine = data.cells.filter((cell) => cell.modelId === model.id);
    const hand = mine.find((cell) => cell.toolId === 'hand');
    return hand && mine.every((cell) => cell === hand || cell.finished < hand.finished);
  }).length;
  return h.section(
    [h.AriaLabelledBy('desk-4')],
    [
      h.h2([h.Id('desk-4'), h.Class('mt-11 mb-1.5 text-[19px] font-semibold')], [h.span([h.Class('mr-2 font-medium text-dim')], [String(index)]), 'Same model, different tool']),
      h.p(
        [h.Class('m-0 mb-3.5 max-w-[48rem] text-sm text-dim text-pretty')],
        [
          `Every tool runs on the same models, so the only thing that changes is the tool. 15 tasks inside a macOS virtual machine: 8 in web apps in Chrome, 7 in native Mac apps (Finder, Notes, TextEdit, Calendar, System Settings). One attempt each. A task counts only when the app's own state shows it is done. hand finished the most tasks on ${wins} of ${data.models.length} models. Claude computer use only works with Claude models.`,
        ],
      ),
      h.div([h.Class('grid gap-4 lg:grid-cols-2')], [slopeChart(h, data, FINISHED), slopeChart(h, data, COST)]),
      h.h3([h.Class('mt-6 mb-2 text-sm font-semibold')], ['Every result']),
      h.p([h.Class('m-0 mb-2 text-[13px] text-dim')], ['Select a column heading to sort. The best tool on each model is in bold.']),
      sortableTable(h, data),
      h.h3([h.Class('mt-6 mb-2 text-sm font-semibold')], ['Every task']),
      taskGrid(h, data),
      h.p(
        [h.Class('mt-2.5 max-w-[48rem] text-[13px] text-dim text-pretty')],
        [
          `${data.episodes} runs, $${data.usd.toFixed(2)} in model calls. kimi-k3 was planned but this account is refused access, so DeepSeek V4 Pro took its place. Runs broken by our harness (a retired Claude tool version, two proxy errors) were set aside and rerun; three tasks recorded twice are counted once. All of it is written down in the `,
          h.a([h.Href(`${runUrl(data.run)}/CONTRACT.md`)], ['contract']),
          ', with every episode in ',
          h.a([h.Href(runUrl(data.run))], [data.run]),
          '.',
        ],
      ),
    ],
  );
};

export const desk3Section = (h: H, data: Desk3Data, index: number): Html =>
  h.section(
    [h.AriaLabelledBy('desk-3')],
    [
      h.h2([h.Id('desk-3'), h.Class('mt-11 mb-1.5 text-[19px] font-semibold')], [h.span([h.Class('mr-2 font-medium text-dim')], [String(index)]), "On a real Mac, each maker's model"]),
      h.p(
        [h.Class('m-0 mb-3.5 max-w-[48rem] text-sm text-dim text-pretty')],
        ['50 tasks in the same macOS virtual machine, 30 in web apps and 20 in native Mac apps. Each tool used the model its maker recommends, so this mixes the tool and the model. Claude computer use finished the most. Tools that could not be installed are listed with the reason, not left out.'],
      ),
      scrollRegion(h, "On a real Mac, each maker's model", [
        h.table(
          [h.Class('w-full border-collapse text-[13.5px]')],
          [
            h.thead(
              [],
              [
                h.tr(
                  [],
                  ['Tool', 'Model', 'Finished', 'Mac apps only', 'Cost'].map((label, column) =>
                    h.th([h.Scope('col'), h.Class(`${TH} ${column >= 2 ? 'text-right' : ''}`)], [label]),
                  ),
                ),
              ],
            ),
            h.tbody(
              [],
              data.rows.map((row, position) =>
                h.tr(
                  [h.Class(`[&:last-child>*]:border-b-0 `)],
                  row.installed
                    ? [
                        h.th([h.Scope('row'), h.Class(`${TD} text-left font-semibold`)], [row.tool]),
                        h.td([h.Class(`${TD} text-left`)], [row.model]),
                        h.td([h.Class(`${TD} ${NUM} ${position === 0 ? 'font-semibold' : ''}`)], [`${row.finished}/${row.tasks}`]),
                        h.td([h.Class(`${TD} ${NUM}`)], [`${row.mac}/${row.macTasks}`]),
                        h.td([h.Class(`${TD} ${NUM}`)], [`$${row.usd.toFixed(2)}`]),
                      ]
                    : [
                        h.th([h.Scope('row'), h.Class(`${TD} text-left font-semibold`)], [row.tool]),
                        h.td([h.Colspan(4), h.Class(`${TD} text-left text-dim`)], [`Not installed. ${row.reason}`]),
                      ],
                ),
              ),
            ),
          ],
        ),
      ]),
      h.p(
        [h.Class('mt-2.5 text-[13px] text-dim')],
        ['Run ', h.a([h.Href(runUrl(data.run))], [data.run]), ', contract in CONTRACT.md there.'],
      ),
    ],
  );
