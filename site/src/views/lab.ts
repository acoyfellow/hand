import type { Html } from 'foldkit/html';
import { LAB_DATA } from '../lab-data.ts';
import { desk3Section, desk4Section } from './desk.ts';
import { type Child, type H, scrollRegion } from './kit.ts';

const money = (usd: number) => (usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(3)}`);

const runUrl = (run: string) => `https://github.com/acoyfellow/hand/tree/main/bench/runs/${run}`;

const TH = 'whitespace-nowrap border-b border-line bg-bg px-3 py-2 text-left align-top text-xs font-medium text-dim';
const TD = 'border-b border-line px-3 py-2 text-left align-top';
const NUM = 'text-right tabular-nums whitespace-nowrap';
const WIDE = 'hidden sm:table-cell';
const LEAD = 'font-semibold';

const TAG = 'inline-block whitespace-nowrap rounded-full px-[7px] py-1 text-[11px] leading-none font-medium';

const TAG_TONES: Record<string, string> = {
  'small model picks': 'bg-[#e7f6ec] text-[#17663a] dark:bg-[#123222] dark:text-[#8ee0ad]',
  'caller decides': 'bg-[#f2f0ff] text-[#4b3fb0] dark:bg-[#24203f] dark:text-[#c4bbff]',
  'big model every step': 'bg-[#fff1e6] text-[#9a4a0b] dark:bg-[#3a2412] dark:text-[#ffc48f]',
  'own vision model': 'bg-[#fde8f1] text-[#9d1d5a] dark:bg-[#3a1428] dark:text-[#ffa8cf]',
  measured: 'bg-[#e7f6ec] text-[#17663a] dark:bg-[#123222] dark:text-[#8ee0ad]',
  planned: 'bg-[#fff8db] text-[#6b5200] dark:bg-[#352d0c] dark:text-[#f2d77a]',
  pass: 'bg-[#e7f6ec] text-[#17663a] dark:bg-[#123222] dark:text-[#8ee0ad]',
  fail: 'bg-[#fdeaea] text-[#9b1c1c] dark:bg-[#3a1616] dark:text-[#f5a3a3]',
};

const tag = (h: H, text: string): Html => h.span([h.Class(`${TAG} ${TAG_TONES[text] ?? 'bg-raise text-dim'}`)], [text]);

type Column = { readonly label: string; readonly numeric?: boolean; readonly wide?: boolean };

const headRow = (h: H, columns: readonly Column[]): Html =>
  h.thead(
    [],
    [
      h.tr(
        [],
        columns.map((column) => h.th([h.Scope('col'), h.Class(`${TH} ${column.numeric ? 'text-right' : ''} ${column.wide ? WIDE : ''}`)], [column.label])),
      ),
    ],
  );

type Cell = { readonly content: readonly Child[]; readonly numeric?: boolean; readonly wide?: boolean; readonly header?: boolean };

const bodyRow = (h: H, cells: readonly Cell[], lead: boolean): Html =>
  h.tr(
    [h.Class(`[&:last-child>*]:border-b-0 ${lead ? LEAD : ''}`)],
    cells.map((cell) => {
      const className = `${TD} ${cell.numeric ? NUM : ''} ${cell.wide ? WIDE : ''}`;
      return cell.header ? h.th([h.Scope('row'), h.Class(`${className} font-normal`)], [...cell.content]) : h.td([h.Class(className)], [...cell.content]);
    }),
  );

const table = (h: H, label: string, columns: readonly Column[], rows: readonly Html[]): Html =>
  scrollRegion(h, label, [h.table([h.Class('w-full border-collapse text-[13.5px]')], [headRow(h, columns), h.tbody([], [...rows])])]);

const section = (h: H, index: number, id: string, title: string, lede: readonly Child[], body: readonly Child[]): Html =>
  h.section(
    [h.AriaLabelledBy(id)],
    [
      h.h2([h.Id(id), h.Class('mt-11 mb-1.5 text-[19px] font-semibold')], [h.span([h.Class('mr-2 font-medium text-dim')], [String(index)]), title]),
      h.p([h.Class('m-0 mb-3.5 max-w-[48rem] text-sm text-dim text-pretty')], [...lede]),
      ...body,
    ],
  );

const bold = (h: H, content: Child) => h.strong([h.Class('font-semibold')], [content]);

const headToHead = (h: H): Html => {
  const rows = LAB_DATA.headToHead;
  const leader = rows[0];
  return section(
    h,
    3,
    'head-to-head',
    'Head to head, browser only',
    [
      `Browser only, not the desktop. Same 30 tasks, three repeats each, and the same planner model (${LAB_DATA.planner}) driving every tool. Only the tool changes. A task counts only when the app's own state says it is done. Best first.`,
    ],
    [
      table(
        h,
        'Head to head',
        [
          { label: 'Tool' },
          { label: 'Finished', numeric: true },
          { label: 'Cost per task', numeric: true },
          { label: 'Tasks per $1', numeric: true },
          { label: 'Median time', numeric: true, wide: true },
          { label: 'Planner tokens', numeric: true, wide: true },
          { label: 'Unasked deletes', numeric: true, wide: true },
          { label: 'False "done"', numeric: true, wide: true },
        ],
        rows.length
          ? rows.map((row) =>
              bodyRow(
                h,
                [
                  { content: [bold(h, row.arm)], header: true },
                  { content: [`${row.finished}/${row.tasks}`], numeric: true },
                  { content: [money(row.usdPerTask)], numeric: true },
                  { content: [row.finishedPerDollar.toLocaleString('en-US')], numeric: true },
                  { content: [`${row.medianSeconds} s`], numeric: true, wide: true },
                  { content: [row.tokensPerTask.toLocaleString('en-US')], numeric: true, wide: true },
                  { content: [String(row.danger)], numeric: true, wide: true },
                  { content: [String(row.falseDone)], numeric: true, wide: true },
                ],
                row === leader,
              ),
            )
          : [h.tr([], [h.td([h.Colspan(8), h.Class(TD)], ['Running.'])])],
      ),
      ...(leader
        ? [
            h.p(
              [h.Class('mt-2.5 text-[13px] text-dim')],
              ['Run ', h.a([h.Href(runUrl(leader.run))], [leader.run]), ', contract in CONTRACT.md there.'],
            ),
          ]
        : []),
    ],
  );
};

const miniwob = (h: H): Html | undefined => {
  const result = LAB_DATA.miniwob;
  if (!result) return undefined;
  const arms = [
    { name: 'hand', arm: result.do },
    { name: 'Same planner, screenshot every step', arm: result.vision },
  ];
  return section(
    h,
    4,
    'miniwob',
    'Public benchmark: MiniWoB++',
    ["All 125 MiniWoB++ tasks, scored by MiniWoB's own reward, never the agent's claim. hand against the same planner looking at a screenshot every step."],
    [
      table(
        h,
        'MiniWoB++',
        [
          { label: 'Setup' },
          { label: 'Solved', numeric: true },
          { label: 'Cost per task', numeric: true },
          { label: 'Solved per $1', numeric: true },
          { label: 'Median time', numeric: true, wide: true },
          { label: 'Errors', numeric: true, wide: true },
        ],
        arms.map(({ name, arm }, index) =>
          bodyRow(
            h,
            [
              { content: [bold(h, name)], header: true },
              { content: [`${arm.solved}/${arm.tasks}`], numeric: true },
              { content: [money(arm.usdPerTask)], numeric: true },
              { content: [String(Math.round(arm.solvedPerDollar))], numeric: true },
              { content: [`${arm.medianSeconds.toFixed(1)} s`], numeric: true, wide: true },
              { content: [String(arm.errors)], numeric: true, wide: true },
            ],
            index === 0,
          ),
        ),
      ),
      h.p(
        [h.Class('mt-2.5 text-[13px] text-dim')],
        ['Same success, half the cost. Our bar was 3x the value, so this counts as a ', bold(h, 'fail'), '. Both solve about half the set. Run ', h.a([h.Href(runUrl(result.run))], [result.run]), '.'],
      ),
    ],
  );
};

const brief = (metrics: Record<string, unknown>) =>
  Object.entries(metrics)
    .filter(([key]) => key !== 'benchmark' && key !== 'arm')
    .slice(0, 4)
    .map(([key, value]) => `${key} ${typeof value === 'number' ? Number(value.toFixed(4)) : String(value)}`)
    .join(', ');

const tests = (h: H): Html =>
  section(
    h,
    5,
    'tests',
    'Every test, pass or fail',
    ['Each test had its pass bar written down before it ran. Failures stay here. They are the hill to climb.'],
    [
      table(
        h,
        'Every test, pass or fail',
        [{ label: 'Claim' }, { label: 'Result' }, { label: 'Numbers', wide: true }, { label: 'Run' }],
        LAB_DATA.tests.map((test) =>
          bodyRow(
            h,
            [
              { content: [test.claim], header: true },
              { content: [tag(h, test.pass ? 'pass' : 'fail')] },
              { content: [h.small([h.Class('text-xs text-dim')], [brief(test.metrics)])], wide: true },
              { content: [h.a([h.Href(runUrl(test.run))], [test.run])] },
            ],
            false,
          ),
        ),
      ),
    ],
  );

const frontier = (h: H): Html => {
  const best = LAB_DATA.scoreboard[0];
  return section(
    h,
    6,
    'frontier',
    'Against a frontier model',
    ['hand with a small planner against a frontier model doing everything itself, on the same 30 tasks.'],
    [
      table(
        h,
        'Against a frontier model',
        [
          { label: 'Setup' },
          { label: 'Finished', numeric: true },
          { label: 'Cost per task', numeric: true },
          { label: 'Tasks per $1', numeric: true },
          { label: 'Median time', numeric: true, wide: true },
          { label: 'Run', wide: true },
        ],
        LAB_DATA.scoreboard.map((row) =>
          bodyRow(
            h,
            [
              { content: [bold(h, row.arm)], header: true },
              { content: [`${row.finished}/${row.tasks}`], numeric: true },
              { content: [money(row.usdPerTask)], numeric: true },
              { content: [row.finishedPerDollar.toLocaleString('en-US')], numeric: true },
              { content: [`${row.medianSeconds} s`], numeric: true, wide: true },
              { content: [h.a([h.Href(runUrl(row.run))], [row.run])], wide: true },
            ],
            row === best,
          ),
        ),
      ),
    ],
  );
};

const landscape = (h: H): Html =>
  section(
    h,
    7,
    'landscape',
    'Landscape',
    ['How each one sees the screen, and who decides where to click. That second column is most of the cost.'],
    [
      table(
        h,
        'Landscape',
        [
          { label: 'Tool' },
          { label: 'Who decides' },
          { label: 'Sees', wide: true },
          { label: 'Runs on', wide: true },
          { label: 'Strength' },
          { label: 'Gap' },
          { label: 'Stars', numeric: true, wide: true },
          { label: 'In the lab' },
        ],
        LAB_DATA.competitors.map((competitor) =>
          bodyRow(
            h,
            [
              {
                content: [
                  bold(h, h.a([h.Href(competitor.repo ? `https://github.com/${competitor.repo}` : competitor.url)], [competitor.name])),
                  h.small([h.Class('block text-xs text-dim')], [competitor.ships]),
                ],
                header: true,
              },
              { content: [tag(h, competitor.brain)] },
              { content: [competitor.sees], wide: true },
              { content: [competitor.platforms.join(', ')], wide: true },
              { content: [competitor.strength] },
              { content: [competitor.gap] },
              { content: [competitor.stars ? competitor.stars.toLocaleString('en-US') : ''], numeric: true, wide: true },
              { content: competitor.adapter === 'none' ? [] : [tag(h, competitor.adapter)] },
            ],
            competitor.id === 'hand',
          ),
        ),
      ),
    ],
  );

const benchmarks = (h: H): Html =>
  section(
    h,
    8,
    'benchmarks',
    'Benchmarks',
    ['Where the scoreboard is going. Public sets first, so anyone can check the numbers.'],
    [
      table(
        h,
        'Benchmarks',
        [{ label: 'Benchmark' }, { label: 'Status' }, { label: 'What it is' }],
        LAB_DATA.benchmarks.map((benchmark) =>
          bodyRow(
            h,
            [
              { content: [bold(h, h.a([h.Href(`https://github.com/${benchmark.repo}`)], [benchmark.name]))], header: true },
              { content: [tag(h, benchmark.status)] },
              { content: [benchmark.note] },
            ],
            false,
          ),
        ),
      ),
    ],
  );

export const labMain = (h: H): readonly Child[] => [
  h.div(
    [h.Class('mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5')],
    [
      h.div(
        [],
        [
          h.h1([h.Class('m-0 text-[clamp(28px,6vw,42px)] leading-tight font-semibold tracking-[-0.035em]')], ['Computer-use tools, measured']),
          h.p(
            [h.Class('mt-2 mb-0 max-w-[44rem] text-dim text-balance')],
            ['Every tool that lets an AI agent click and type, side by side. Who decides where to click, what it costs, and how many tasks it finishes on the same tests.'],
          ),
        ],
      ),
      h.p([h.Class('m-0 font-mono text-xs text-dim')], [`updated ${LAB_DATA.generatedAt}`]),
    ],
  ),
  ...(LAB_DATA.desk4 ? [desk4Section(h, LAB_DATA.desk4, 1)] : []),
  ...(LAB_DATA.desk3 ? [desk3Section(h, LAB_DATA.desk3, 2)] : []),
  headToHead(h),
  ...(LAB_DATA.miniwob ? [miniwob(h) as Html] : []),
  tests(h),
  frontier(h),
  landscape(h),
  benchmarks(h),
];
