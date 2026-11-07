import type { Html } from 'foldkit/html';
import { Message } from '../message.ts';
import type { Model } from '../model.ts';
import { Swarm } from '../mounts.ts';
import { INSTALL_COMMAND } from '../update.ts';
import { howDiagram } from './diagram.ts';
import { STEPS, stepIcon } from './icons.ts';
import { type Child, GITHUB, type H, codeBlock, scrollRegion } from './kit.ts';

const BLOCK = 'mx-auto max-w-[40rem] pt-12 md:pt-[4.5rem]';

const H2 = 'm-0 mb-4 text-[1.35rem] font-semibold tracking-[-0.01em]';

const DIM = 'text-dim';

const DMG_URL = 'https://github.com/acoyfellow/hand/releases/latest/download/hand.dmg';

const SWARM_VIDEO = '/hand-use.mp4';

const SWARM_POSTER = '/hand-use.jpg';

const hero = (h: H, model: Model): Html =>
  h.section(
    [h.AriaLabelledBy('hero-title'), h.Class('pt-10 pb-12 text-center md:pt-20 md:pb-16')],
    [
      h.h1(
        [h.Id('hero-title'), h.Class('mx-auto mb-5 max-w-[36rem] text-[1.9rem] leading-[1.15] font-semibold tracking-[-0.025em] md:text-[2.75rem]')],
        ['Let your AI agent use a computer without guessing where to click.'],
      ),
      h.p([h.Class(`mx-auto mb-9 max-w-[30rem] text-[1.15rem] text-balance ${DIM}`)], ['A small model picks the button. hand clicks it and checks it worked.']),
      h.a(
        [
          h.Href(DMG_URL),
          h.Class('mx-auto mb-3 inline-flex items-center gap-2.5 rounded-full bg-text px-7 py-3.5 text-[1.05rem] font-semibold text-bg no-underline shadow-sm hover:opacity-90'),
        ],
        ['Download for Mac'],
      ),
      h.p([h.Class(`m-0 mb-8 text-[0.85rem] ${DIM}`)], ['macOS 13 or later · Apple silicon · free, you pay Cloudflare about a cent per task']),
      h.p([h.Class(`m-0 mb-2 text-[0.8rem] ${DIM}`)], ['Building your own agent? Use the library:']),
      h.div(
        [h.Class('mx-auto mb-6 flex max-w-[30rem] items-center gap-2 rounded-[10px] bg-raise py-1.5 pr-1.5 pl-4 text-left font-mono text-[0.8rem] sm:text-[0.9rem]')],
        [
          h.code([h.Class('min-w-0 flex-1 break-all')], [INSTALL_COMMAND]),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ClickedCopyInstall()),
              h.AriaLabel(model.copied ? 'Copied install command' : 'Copy install command'),
              h.Class('cursor-pointer rounded-[7px] border border-line bg-bg px-3 py-1.5 font-sans text-[0.8rem] font-medium text-text hover:border-signal'),
            ],
            [model.copied ? 'Copied' : 'Copy'],
          ),
          h.span([h.Class('sr-only'), h.AriaLive('polite')], [model.copied ? 'Install command copied' : '']),
        ],
      ),
      h.p([h.Class('m-0 font-mono text-[0.85rem]')], [h.a([h.Href('/docs/'), h.Class(DIM)], ['Set up in 5 minutes'])]),
      h.figure(
        [h.Class('relative mx-auto mt-8 mb-0 max-w-[760px]')],
        [
          h.div(
            [
              h.Key(model.live ? 'swarm-live' : 'swarm-static'),
              h.Id('swarm'),
              h.AriaHidden(true),
              h.Inert(true),
              h.Class('min-h-[220px]'),
              ...(model.live ? [h.OnMount(Swarm({ seeds: ['ada', 'bix', 'cyd', 'dot'] }))] : []),
            ],
            [],
          ),
          h.figcaption([h.Class(`mt-3 text-center text-[0.85rem] ${DIM}`)], ['Four agents, each with its own hand, working in one app at once.']),
        ],
      ),
      h.div([h.Class('mt-12')], [howDiagram(h)]),
    ],
  );

const STATS: readonly (readonly [string, string])[] = [
  ['30/30', 'tasks finished'],
  ['$0.0016', 'per task'],
  ['0', 'unwanted deletes'],
];

const results = (h: H): Html =>
  h.section(
    [h.Id('results'), h.AriaLabel('Results'), h.Class(BLOCK)],
    [
      h.p(
        [h.Class('m-0 mb-8 text-center text-[1.35rem] leading-[1.3] font-medium tracking-[-0.015em] md:text-[1.75rem]')],
        ['It finished ', h.strong([h.Class('font-[650]')], ['all 30 tasks']), ', three times over, for ', h.strong([h.Class('font-[650]')], ['a sixth of a cent']), ' each.'],
      ),
      h.dl(
        [h.Class('m-0 grid grid-cols-3 gap-2 md:gap-4')],
        STATS.map(([value, label]) =>
          h.div(
            [h.Class('flex flex-col-reverse rounded-[10px] bg-raise px-2 py-4 text-center md:p-[1.4rem]')],
            [
              h.dt([h.Class(`text-[0.8rem] leading-[1.35] ${DIM}`)], [label]),
              h.dd([h.Class('m-0 text-[1.3rem] font-semibold tracking-[-0.02em] md:text-[1.9rem]')], [value]),
            ],
          ),
        ),
      ),
      h.p(
        [h.Class(`mt-8 mb-0 text-center text-[1.05rem] leading-[1.45] text-balance`)],
        [
          'On a real Mac, across Chrome web apps and native Mac apps, hand finished ',
          h.strong([h.Class('font-[650]')], ['15 of 15 tasks']),
          ' with gpt-6.1 and with Claude Sonnet, for under 3 cents a task with gpt-6.1. ',
          h.a([h.Href('/lab/#desk-4')], ['See the benchmark']),
          '.',
        ],
      ),
    ],
  );

const demo = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('demo-title'), h.Class(BLOCK)],
    [
      h.h2([h.Id('demo-title'), h.Class(`${H2} text-center`)], ['Three agents clear a todo list']),
      h.p(
        [h.Class(`mx-auto mb-0 max-w-[34rem] text-center text-balance ${DIM}`)],
        [
          'One agent writes a checklist in Notes. Two more look up the answers in Safari and Chrome at the same time. The first fills each answer in and ticks it off. Real time, in a macOS virtual machine, and the ticks are read back from Notes itself.',
        ],
      ),
      h.video(
        [
          h.Src(SWARM_VIDEO),
          h.Poster(SWARM_POSTER),
          h.Controls(true),
          h.Playsinline(true),
          h.Muted(true),
          h.Preload('metadata'),
          h.AriaLabel(
            'A real-time recording of three hand agents in a macOS virtual machine: one writes a todo checklist in Notes, two look up the weather in Lisbon and the population of Portugal in Safari and Chrome, and the first fills in both answers and ticks both items.',
          ),
          h.Class('mt-6 w-full rounded-[10px] border border-line bg-black'),
        ],
        [],
      ),
      h.p(
        [h.Class('mt-6 mb-0 text-center')],
        [
          h.a(
            [h.Href('/lab/'), h.Class('inline-flex items-center gap-2 rounded-full bg-text px-5 py-2.5 text-[0.95rem] font-semibold text-bg no-underline hover:opacity-90')],
            ['See the benchmark →'],
          ),
        ],
      ),
    ],
  );

const howItWorks = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('how'), h.Class(BLOCK)],
    [
      h.h2([h.Id('how'), h.Class(H2)], ['How it works']),
      h.ol(
        [h.Class('m-0 my-5 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-4')],
        STEPS.map((step) =>
          h.li(
            [h.Class('m-0 min-w-0 rounded-[10px] border border-line bg-bg p-[1.1rem]')],
            [
              stepIcon(h, step.name, 56),
              h.strong([h.Class('mb-1 block text-[1.05rem]')], [step.name]),
              h.span([h.Class(`block text-[0.9rem] leading-[1.4] ${DIM}`)], [step.blurb]),
            ],
          ),
        ),
      ),
    ],
  );

const K = (text: string) => `<span class="text-[#c2410c] dark:text-[#ff9e64]">${text}</span>`;
const S = (text: string) => `<span class="text-[#15803d] dark:text-[#9ece6a]">${text}</span>`;
const F = (text: string) => `<span class="text-[#1d4ed8] dark:text-[#7aa2f7]">${text}</span>`;
const C = (text: string) => `<span class="text-dim italic">${text}</span>`;

const mcp = (h: H): Html =>
  h.section(
    [h.Id('mcp'), h.AriaLabelledBy('mcp-title'), h.Class(BLOCK)],
    [
      h.h2([h.Id('mcp-title'), h.Class(H2)], ['Use it with an AI agent']),
      h.p([h.Class(DIM)], ['Works with Claude, Pi or any MCP client, on a Mac.']),
      codeBlock(h, 'Install commands', `${F('bun')} add github:acoyfellow/hand#release\n${F('bunx')} hand doctor   ${C('# checks credentials and permissions, builds the helper')}`),
      codeBlock(
        h,
        'MCP configuration',
        `{\n  ${S('"mcpServers"')}: {\n    ${S('"hand"')}: {\n      ${S('"command"')}: ${S('"bunx"')},\n      ${S('"args"')}: [${S('"hand"')}, ${S('"mcp"')}],\n      ${S('"env"')}: { ${S('"HAND_HEADED"')}: ${S('"1"')} }\n    }\n  }\n}`,
      ),
      h.p([h.Class(DIM)], ['It reads back what it typed. Without HAND_HEADED it only uses accessibility actions and never touches your mouse or keyboard.']),
    ],
  );

const code = (h: H): Html =>
  h.section(
    [h.Id('use'), h.AriaLabelledBy('use-title'), h.Class(BLOCK)],
    [
      h.h2([h.Id('use-title'), h.Class(H2)], ['Use it from code']),
      codeBlock(
        h,
        'Library example',
        `${K('await')} hand.${F('act')}(${S("'switch to the termlab tab'")});\n${K('await')} hand.${F('type')}(${S("'coey.dev'")}, ${S("'the address bar'")});\n${K('await')} hand.${F('look')}(${S("'Is coey.dev open?'")});`,
      ),
      h.p([h.Class(DIM)], [h.a([h.Href('/docs/')], ['Full setup in the docs']), '.']),
    ],
  );

const untested = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('untested'), h.Class(BLOCK)],
    [
      h.h2([h.Id('untested'), h.Class(H2)], ['Not tested yet']),
      h.ul(
        [h.Class(`pl-[1.1rem] ${DIM}`)],
        ['Apps with unlabelled icons or canvas UIs.', 'More than one attempt per Mac task, and more than one macOS version.', 'Windows and Linux.'].map((item) => h.li([h.Class('my-1.5')], [item])),
      ),
    ],
  );

const RESULT_ROWS: readonly (readonly [string, string, string, string, boolean])[] = [
  ['hand (Clef + writer)', 'Clef picks every action; a writer fills fields only when the task needs new text', '30.0/30', '$0.0016', true],
  ['Clef + copier', 'Clef picks every action; Clairic copies values out of the task, never writes new ones', '25.0/30', '$0.0015', false],
];

const CELL = 'border-b border-line px-2.5 py-2 text-left align-top';
const NUM = 'text-right tabular-nums whitespace-nowrap';

const detailsH2 = 'mt-8 mb-3 text-base font-semibold';

const details = (h: H): Html =>
  h.details(
    [h.Class('mx-auto mt-20 max-w-[40rem] border-t border-line pt-4')],
    [
      h.summary([h.Class('cursor-pointer rounded-sm text-base font-semibold')], ['Details: every result, writer models, the benchmark']),
      h.h2([h.Class(detailsH2)], ['All results']),
      scrollRegion(h, 'All results', [
        h.table(
          [h.Class('w-full border-collapse text-[0.88rem]')],
          [
            h.thead(
              [],
              [
                h.tr(
                  [],
                  [
                    h.th([h.Scope('col'), h.Class(`${CELL} text-[0.8rem] font-medium text-dim`)], ['setup']),
                    h.th([h.Scope('col'), h.Class(`${CELL} text-[0.8rem] font-medium text-dim`)], ['what drives it']),
                    h.th([h.Scope('col'), h.Class(`${CELL} ${NUM} text-[0.8rem] font-medium text-dim`)], ['finished']),
                    h.th([h.Scope('col'), h.Class(`${CELL} ${NUM} text-[0.8rem] font-medium text-dim`)], ['$/task']),
                  ],
                ),
              ],
            ),
            h.tbody(
              [],
              RESULT_ROWS.map(([setup, driver, finished, cost, win]) =>
                h.tr(
                  [h.Class(win ? 'font-semibold' : '')],
                  [h.td([h.Class(CELL)], [setup]), h.td([h.Class(CELL)], [driver]), h.td([h.Class(`${CELL} ${NUM}`)], [finished]), h.td([h.Class(`${CELL} ${NUM}`)], [cost])],
                ),
              ),
            ),
          ],
        ),
      ]),
      h.h2([h.Class(detailsH2)], ['Writer models']),
      h.p(
        [h.Class(DIM)],
        [
          'Scored alone on 44 messy requests. The default pairs a cheap model with a backup: ',
          h.strong([h.Class('text-text')], ['glm-5.3-flash, then kimi-k2.6']),
          ' for any field it leaves empty. 42–43 of 44 across runs, at $0.00009 a request. ',
          h.a([h.Href(`${GITHUB}#writers`)], ['All writers']),
          '.',
        ],
      ),
      h.h2([h.Id('bench'), h.Class(detailsH2)], ['The benchmark']),
      h.p(
        [h.Class(DIM)],
        ["Every change to the library has to pass a fixed benchmark: 30 tasks in a test app, success read from the app's own state, and a gate that fails if results get worse."],
      ),
      codeBlock(
        h,
        'Benchmark commands',
        `${F('bun')} run check   ${C('# types, lint, tests')}\n${F('bun')} run gate    ${C('# fails if results are stale or worse')}\n${F('bun')} run bench   ${C('# real models, writes bench/runs/&lt;id&gt;/')}`,
      ),
    ],
  );

export const homeMain = (h: H, model: Model): readonly Child[] => [hero(h, model), results(h), demo(h), howItWorks(h), mcp(h), code(h), untested(h), details(h)];
