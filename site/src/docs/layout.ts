import type { Html } from 'foldkit/html';
import type { Child, H } from '../views/kit.ts';
import { codeSections, cursorSections, dataSections, firstTaskSections, fixSections, headedSections, helperSections, howSections, overviewSections, parallelSections, uninstallSections } from './guide-pages.ts';
import type { Section } from './kit.ts';
import { eventSections, exportSections, handSections, referenceIndex, replySections, settingsSections, toolSections, typeSections } from './reference-pages.ts';
import { type DocKey, DOC_ROUTES, NAV_GROUPS, routeOf } from './routes.ts';

const SECTIONS: Record<DocKey, (h: H) => readonly Section[]> = {
  docs: overviewSections,
  tutorialFirstTask: firstTaskSections,
  howtoCode: codeSections,
  howtoHeaded: headedSections,
  howtoCursor: cursorSections,
  howtoParallel: parallelSections,
  howtoFix: fixSections,
  howtoUninstall: uninstallSections,
  reference: referenceIndex,
  refTools: toolSections,
  refReplies: replySections,
  refEvent: eventSections,
  refHand: handSections,
  refTypes: typeSections,
  refSettings: settingsSections,
  refExports: exportSections,
  explainHow: howSections,
  explainData: dataSections,
  explainHelper: helperSections,
};

const SIDE_LINK = 'block rounded-[8px] px-2.5 py-1.5 text-[0.9rem] leading-snug text-dim no-underline hover:bg-raise hover:text-text aria-[current=page]:bg-text aria-[current=page]:text-bg';

const sidebar = (h: H, current: DocKey): Html =>
  h.nav(
    [h.AriaLabel('Docs')],
    NAV_GROUPS.map(([group, keys]) =>
      h.div(
        [h.Class('mb-5')],
        [
          h.p([h.Class('m-0 mb-1.5 px-2.5 text-[0.7rem] font-semibold tracking-[0.12em] text-faint uppercase')], [group]),
          h.ul(
            [h.Class('m-0 list-none p-0')],
            keys.map((key) => {
              const route = routeOf(key);
              return h.li([], [h.a([h.Href(route.path), h.Class(SIDE_LINK), ...(key === current ? [h.AriaCurrent('page')] : [])], [route.nav])]);
            }),
          ),
        ],
      ),
    ),
  );

const mobileNav = (h: H, current: DocKey): Html =>
  h.details(
    [h.Class('group mb-6 rounded-[10px] border border-line lg:hidden')],
    [
      h.summary([h.Class('flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[0.9rem] font-medium')], [routeOf(current).nav, h.span([h.Class('text-dim group-open:rotate-180'), h.AriaHidden(true)], ['▾'])]),
      h.div([h.Class('border-t border-line px-2 pt-4 pb-1')], [sidebar(h, current)]),
    ],
  );

const onThisPage = (h: H, sections: readonly Section[]): Html =>
  h.nav(
    [h.AriaLabel('On this page'), h.Class('text-[0.85rem]')],
    [
      h.p([h.Class('m-0 mb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-faint uppercase')], ['On this page']),
      h.ul(
        [h.Class('m-0 list-none space-y-1 border-l border-line p-0')],
        sections.map((section) => h.li([], [h.a([h.Href(`#${section.id}`), h.Class('-ml-px block border-l border-transparent py-0.5 pl-3 text-dim no-underline hover:border-text hover:text-text')], [section.title])])),
      ),
    ],
  );

const sectionView = (h: H, section: Section): Html =>
  h.section(
    [h.AriaLabelledBy(section.id), h.Class('mt-12 border-t-2 border-text pt-4 first:mt-10')],
    [h.h2([h.Id(section.id), h.Class('m-0 mb-3 scroll-mt-24 text-[1.35rem] font-semibold tracking-[-0.015em]')], [section.title]), ...section.body],
  );

const pager = (h: H, current: DocKey): Html => {
  const order = NAV_GROUPS.flatMap(([, keys]) => keys);
  const index = order.indexOf(current);
  const previous = index > 0 ? routeOf(order[index - 1] as DocKey) : undefined;
  const next = index < order.length - 1 ? routeOf(order[index + 1] as DocKey) : undefined;
  const card = (label: string, route: (typeof DOC_ROUTES)[number], align: string) =>
    h.a([h.Href(route.path), h.Class(`block flex-1 rounded-[10px] border border-line px-4 py-3 no-underline hover:border-text ${align}`)], [h.span([h.Class('block text-[0.75rem] text-faint')], [label]), h.span([h.Class('block font-medium text-text')], [route.nav])]);
  return h.nav(
    [h.AriaLabel('Previous and next'), h.Class('mt-16 flex flex-col gap-3 sm:flex-row')],
    [...(previous ? [card('Previous', previous, '')] : [h.span([h.Class('flex-1')], [])]), ...(next ? [card('Next', next, 'sm:text-right')] : [])],
  );
};

export const docsPage = (h: H, key: DocKey): readonly Child[] => {
  const route = routeOf(key);
  const sections = SECTIONS[key](h);
  return [
    h.div(
      [h.Class('grid gap-10 pt-4 pb-16 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_12rem]')],
      [
        h.aside([h.Class('hidden lg:block')], [h.div([h.Class('sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto border-r border-line pr-5 pb-6')], [sidebar(h, key)])]),
        h.article(
          [h.Class('min-w-0')],
          [
            mobileNav(h, key),
            h.nav(
              [h.AriaLabel('Breadcrumb'), h.Class('mb-6 text-[0.8rem] text-faint')],
              [h.a([h.Href('/docs/'), h.Class('text-faint')], ['Docs']), ...(key === 'docs' ? [] : [' / ', h.span([], [route.kind])])],
            ),
            h.p([h.Class('m-0 text-[0.75rem] font-semibold tracking-[0.12em] text-link uppercase')], [route.kind]),
            h.h1([h.Class('m-0 mt-2 mb-4 text-[2.1rem] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[2.6rem]')], [route.title]),
            h.p([h.Class('m-0 max-w-[62ch] text-[1.1rem] text-dim text-pretty')], [route.description]),
            ...sections.map((section) => sectionView(h, section)),
            pager(h, key),
            h.p([h.Class('mt-10 text-[0.8rem] text-faint')], [h.a([h.Href(`https://github.com/acoyfellow/hand/issues/new?title=${encodeURIComponent(`Docs: ${route.title}`)}`), h.Class('text-faint')], ['Something wrong on this page? Open an issue.'])]),
          ],
        ),
        h.aside([h.Class('hidden xl:block')], [h.div([h.Class('sticky top-6')], [onThisPage(h, sections)])]),
      ],
    ),
  ];
};
