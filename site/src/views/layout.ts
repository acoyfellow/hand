import type { Html } from 'foldkit/html';
import { Backdrop, Peek } from '../mounts.ts';
import { isDocKey } from '../docs/routes.ts';
import type { Page } from '../pages.ts';
import { cloudflareLogo, githubIcon } from './icons.ts';
import { type Child, GITHUB, type H } from './kit.ts';

export const SHELL = 'mx-auto w-full max-w-[72rem] px-5 sm:px-8';

const NAV_LINK = 'inline-flex items-center gap-1.5 rounded-sm text-dim no-underline hover:text-text aria-[current=page]:text-text';

const skipLink = (h: H): Html =>
  h.a(
    [
      h.Href('#main'),
      h.Class(
        'sr-only z-50 rounded-md bg-text px-3 py-2 text-bg no-underline focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:text-bg hover:text-bg',
      ),
    ],
    ['Skip to content'],
  );

const backdrop = (h: H): Html =>
  h.div(
    [
      h.Class('pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-0 transition-opacity duration-[1600ms] [contain:strict] [&.on]:opacity-100'),
      h.AriaHidden(true),
      h.OnMount(Backdrop()),
    ],
    [],
  );

export const header = (h: H, page: Page): Html =>
  h.header(
    [h.Class(`${SHELL} flex items-center gap-3 pt-[max(2.5rem,env(safe-area-inset-top))] pb-6`)],
    [
      h.a(
        [h.Href('/'), h.AriaLabel('hand home'), h.Class('flex items-center gap-3 rounded-[9px] text-text no-underline hover:text-text')],
        [
          h.img([h.Src('/brand/icon.svg'), h.Alt(''), h.Width('40'), h.Height('40'), h.Class('size-10 rounded-[9px]')]),
          h.span([h.Class('text-xl font-semibold')], ['hand']),
        ],
      ),
      h.nav(
        [h.AriaLabel('Main'), h.Class('ml-auto flex items-center gap-[1.1rem] text-[0.85rem]')],
        [
          h.a([h.Href('/docs/'), h.Class(NAV_LINK), ...(isDocKey(page) ? [h.AriaCurrent('page')] : [])], ['Docs']),
          h.a([h.Href('/lab/'), h.Class(NAV_LINK), ...(page === 'lab' ? [h.AriaCurrent('page')] : [])], ['Benchmarks']),
          h.a([h.Href(GITHUB), h.Class(NAV_LINK)], [githubIcon(h), 'GitHub']),
        ],
      ),
    ],
  );

const DRAGON_BODY: readonly (readonly [number, number])[] = [
  [28, 0], [30, 0], [26, 2], [28, 2], [30, 2], [32, 2], [24, 4], [26, 4], [28, 4], [30, 4], [32, 4], [34, 4], [0, 6], [22, 6], [24, 6], [26, 6], [28, 6], [30, 6],
  [0, 8], [2, 8], [20, 8], [22, 8], [24, 8], [26, 8], [2, 10], [4, 10], [10, 10], [12, 10], [14, 10], [16, 10], [18, 10], [20, 10], [22, 10], [24, 10],
  [4, 12], [6, 12], [8, 12], [10, 12], [12, 12], [14, 12], [16, 12], [18, 12], [20, 12], [22, 12], [24, 12], [6, 14], [8, 14], [10, 14], [12, 14], [14, 14],
  [16, 14], [18, 14], [20, 14], [22, 14], [8, 16], [10, 16], [18, 16], [20, 16], [8, 18], [18, 18],
];

const WING_UP: readonly (readonly [number, number])[] = [
  [12, 2], [14, 2], [14, 4], [16, 4], [18, 4], [16, 6], [18, 6], [20, 6], [22, 6], [18, 8], [20, 8], [22, 8], [24, 8],
];

const WING_DOWN: readonly (readonly [number, number])[] = [
  [18, 6], [20, 6], [22, 6], [24, 6], [16, 8], [18, 8], [20, 8], [22, 8], [14, 10], [16, 10], [18, 10], [12, 12], [14, 12],
];

const BELLY: readonly (readonly [number, number])[] = [
  [12, 12], [14, 12], [16, 12], [18, 12], [20, 12], [22, 12], [14, 14], [16, 14], [18, 14], [20, 14],
];

type Flame = readonly [x: number, y: number, phase: 1 | 2 | 3 | 4, hot: boolean];

const FIRE: readonly Flame[] = [
  [36, 4, 1, true], [40, 2, 2, false], [40, 6, 2, false], [44, 0, 3, true], [44, 4, 3, false], [46, 8, 3, false], [50, 2, 4, true], [52, 6, 4, false], [56, 4, 4, false],
];

const FIRE_ANIMATION: Record<Flame[2], string> = {
  1: 'animate-fire-1',
  2: 'animate-fire-2',
  3: 'animate-fire-3',
  4: 'animate-fire-4',
};

const pixel = (h: H, [x, y]: readonly [number, number], className = ''): Html =>
  h.rect([h.X(String(x)), h.Y(String(y)), h.Width('2'), h.Height('2'), ...(className ? [h.Class(className)] : [])], []);

const dragon = (h: H): Html =>
  h.span(
    [h.Class('ml-1.5 inline-block h-5 w-16 align-[-5px]'), h.AriaHidden(true)],
    [
      h.svg(
        [h.ViewBox('0 0 64 20'), h.ShapeRendering('crispEdges'), h.Class('block h-5 w-16 fill-[#ffb35c]')],
        [
          ...DRAGON_BODY.map((at) => pixel(h, at)),
          h.g([h.Class('animate-wing-up')], WING_UP.map((at) => pixel(h, at))),
          h.g([h.Class('animate-wing-down')], WING_DOWN.map((at) => pixel(h, at))),
          h.g([h.Class('animate-inhale fill-[#fff3dc]')], BELLY.map((at) => pixel(h, at))),
          pixel(h, [30, 2], 'fill-text'),
          h.g(
            [],
            FIRE.map(([x, y, phase, hot]) => pixel(h, [x, y], `opacity-0 ${FIRE_ANIMATION[phase]} ${hot ? 'fill-[#fff3dc]' : 'fill-signal'}`)),
          ),
        ],
      ),
    ],
  );

const peek = (h: H): Html =>
  h.div(
    [
      h.Class('group pointer-events-none absolute bottom-full left-6 h-[154px] w-[min(170px,34vw)] overflow-hidden'),
      h.AriaHidden(true),
      h.OnMount(Peek()),
    ],
    [
      h.img([
        h.Src('/brand/astronaut-peek.webp'),
        h.Alt(''),
        h.Width('400'),
        h.Height('362'),
        h.Loading('lazy'),
        h.Class(
          'absolute bottom-0 left-0 h-auto w-full origin-bottom [transform:translateY(calc((1_-_var(--peek,0))_*_100%))_rotate(calc((1_-_var(--peek,0))_*_-10deg))] motion-reduce:[transform:none]',
        ),
      ]),
    ],
  );

const FOOT_LINK = 'text-dim';

export const footer = (h: H): Html =>
  h.footer(
    [h.Class(`${SHELL} mb-16`)],
    [
      h.div(
        [
          h.Class(
            'relative mt-52 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line pt-3.5 text-[12.5px] leading-[1.45] text-faint',
          ),
        ],
        [
          peek(h),
          h.div(
            [h.Class('flex max-w-[460px] items-center gap-3.5')],
            [
              cloudflareLogo(h),
              h.p(
                [h.Class('m-0')],
                [h.strong([h.Class('font-semibold text-dim')], ['OSS experiment, not officially endorsed by Cloudflare.']), ' Here be dragons.', dragon(h)],
              ),
            ],
          ),
          h.p(
            [h.Class('m-0 font-mono text-[11px] tracking-[0.04em]')],
            ['hand · MIT · ', h.a([h.Href(GITHUB), h.Class(FOOT_LINK)], ['source']), ' · ', h.a([h.Href('/docs/'), h.Class(FOOT_LINK)], ['docs']), ' · ', h.a([h.Href('/lab/'), h.Class(FOOT_LINK)], ['lab'])],
          ),
        ],
      ),
    ],
  );

export const layout = (h: H, page: Page, main: readonly Child[], mainClass = ''): Html =>
  h.div(
    [h.Class('relative min-h-dvh')],
    [
      skipLink(h),
      ...(isDocKey(page) ? [] : [backdrop(h)]),
      header(h, page),
      h.main([h.Id('main'), h.Tabindex(-1), h.Class(`${SHELL} outline-none ${mainClass}`)], [...main]),
      footer(h),
    ],
  );
