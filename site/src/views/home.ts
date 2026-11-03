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

const hero = (h: H, model: Model): Html =>
  h.section(
    [h.AriaLabelledBy('hero-title'), h.Class('pt-10 pb-12 text-center md:pt-20 md:pb-16')],
    [
      h.h1(
        [h.Id('hero-title'), h.Class('mx-auto mb-5 max-w-[36rem] text-[1.9rem] leading-[1.15] font-semibold tracking-[-0.025em] md:text-[2.75rem]')],
        ['Let your AI agent use a computer without guessing where to click.'],
      ),
      h.p([h.Class(`mx-auto mb-9 max-w-[30rem] text-[1.15rem] text-balance ${DIM}`)], ['A small model picks the button. hand clicks it and checks it worked.']),
      h.div(
        [h.Class('mx-auto mb-6 flex max-w-[26rem] items-center gap-2 rounded-[10px] bg-raise py-1.5 pr-1.5 pl-4 text-left font-mono text-[0.9rem]')],
        [
          h.code([h.Class('min-w-0 flex-1 overflow-x-auto whitespace-nowrap')], [INSTALL_COMMAND]),
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
      h.p([h.Class('m-0 font-mono text-[0.85rem]')], [h.a([h.Href('#mcp'), h.Class(DIM)], ['Use with an AI agent'])]),
      howDiagram(h),
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
        ['It finished ', h.strong([h.Class('font-[650]')], ['all 30 tasks']), ', three times over, at ', h.strong([h.Class('font-[650]')], ['1/18 the cost']), ' of Claude Opus.'],
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
    ],
  );

const demo = (h: H): Html =>
  h.section(
    [h.AriaLabel('Demo video'), h.Class(BLOCK)],
    [
      h.video(
        [
          h.Src('/demo.mp4'),
          h.Poster('/demo-poster.jpg'),
          h.Controls(true),
          h.Playsinline(true),
          h.Preload('none'),
          h.AriaLabel('A real 38 second run of hand writing a message and clicking'),
          h.Class('mt-4 w-full rounded-[10px] border border-line bg-black'),
        ],
        [],
      ),
      h.p([h.Class(`mt-1.5 text-center text-[0.85rem] ${DIM}`)], ['A real 38 s run. hand writes the message and makes every click.']),
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
            [h.Class('m-0 min-w-0 rounded-[10px] border border-line p-[1.1rem]')],
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
      codeBlock(h, 'Install commands', `${F('bun')} add github:acoyfellow/hand\n${F('swiftc')} -O node_modules/hand/native/ax.swift -o node_modules/hand/native/ax`),
      codeBlock(
        h,
        'MCP configuration',
        `{\n  ${S('"mcpServers"')}: {\n    ${S('"hand"')}: {\n      ${S('"command"')}: ${S('"bun"')},\n      ${S('"args"')}: [${S('"node_modules/hand/src/mcp.ts"')}]\n    }\n  }\n}`,
      ),
      h.p([h.Class(DIM)], ['It never moves your mouse, and it reads back what it typed.']),
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
      h.p([h.Class(DIM)], [h.a([h.Href(`${GITHUB}#use`)], ['Full setup in the README']), '.']),
    ],
  );

const untested = (h: H): Html =>
  h.section(
    [h.AriaLabelledBy('untested'), h.Class(BLOCK)],
    [
      h.h2([h.Id('untested'), h.Class(H2)], ['Not tested yet']),
      h.ul(
        [h.Class(`pl-[1.1rem] ${DIM}`)],
        ['Apps with unlabelled icons or canvas UIs.', 'A scored set of real Mac tasks.', 'Windows and Linux.'].map((item) => h.li([h.Class('my-1.5')], [item])),
      ),
    ],
  );

const RESULT_ROWS: readonly (readonly [string, string, string, string, boolean])[] = [
  ['hand (Clef + writer)', 'Clef picks every action; a writer fills fields only when the task needs new text', '30.0/30', '$0.0016', true],
  ['Clef + copier', 'Clef picks every action; Clairic copies values out of the task, never writes new ones', '25.0/30', '$0.0015', false],
  ['Opus, screenshots', 'Claude Opus reads screenshots and clicks', '22.7/30', '$0.029', false],
  ['Opus + Clef', 'Opus plans, Clef clicks', '22.0/30', '$0.029', false],
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
