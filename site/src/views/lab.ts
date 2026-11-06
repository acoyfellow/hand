import type { Html } from 'foldkit/html';
import { LAB_DATA } from '../lab-data.ts';
import { handOnMac } from './hand-results.ts';
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

const brief = (metrics: Record<string, unknown>) =>
  Object.entries(metrics)
    .filter(([key]) => key !== 'benchmark' && key !== 'arm')
    .slice(0, 4)
    .map(([key, value]) => `${key} ${typeof value === 'number' ? Number(value.toFixed(4)) : String(value)}`)
    .join(', ');

const tests = (h: H): Html =>
  section(
    h,
    2,
    'tests',
    'Every test, pass or fail',
    ['Each test had its pass bar written down before it ran. Failures stay here: they are what hand works on next.'],
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

export const labMain = (h: H): readonly Child[] => [
  h.div(
    [h.Class('mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5')],
    [
      h.div(
        [],
        [
          h.h1([h.Class('m-0 text-[clamp(28px,6vw,42px)] leading-tight font-semibold tracking-[-0.035em]')], ['hand, measured']),
          h.p(
            [h.Class('mt-2 mb-0 max-w-[44rem] text-dim text-balance')],
            ['Every number hand has, from real runs. A task counts only when the app shows it is done. Each test had its pass bar written down before it ran, and the failures stay on this page.'],
          ),
        ],
      ),
      h.p([h.Class('m-0 font-mono text-xs text-dim')], [`updated ${LAB_DATA.generatedAt}`]),
    ],
  ),
  ...(LAB_DATA.desk4 ? [handOnMac(h, LAB_DATA.desk4, 1)] : []),
  tests(h),
];
