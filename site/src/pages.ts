import { DOC_KEYS, DOC_ROUTES, type DocKey } from './docs/routes.ts';

export const PAGES = ['home', ...DOC_KEYS, 'lab', 'brand', 'brandLab', 'notFound'] as const;

export type Page = (typeof PAGES)[number];

const DOC_PATHS = Object.fromEntries(DOC_ROUTES.map((route) => [route.key, route.path])) as Record<DocKey, string>;

export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  ...DOC_PATHS,
  lab: '/lab/',
  brand: '/brand/',
  brandLab: '/brand/lab/',
  notFound: '/404/',
};

export const PRERENDER_PATHS = PAGES.map((page) => PAGE_PATHS[page]);

export const pageAt = (pathname: string): Page | undefined => PAGES.find((page) => PAGE_PATHS[page] === pathname);

export type PageMeta = { readonly title: string; readonly description?: string; readonly canonical?: string; readonly noindex?: boolean };

const DOC_META = Object.fromEntries(
  DOC_ROUTES.map((route) => [
    route.key,
    { title: route.key === 'docs' ? 'hand docs · set up hand on your Mac' : `${route.title} · hand docs`, description: route.description, canonical: `https://hand.coey.dev${route.path}` },
  ]),
) as Record<DocKey, PageMeta>;

export const PAGE_META: Record<Page, PageMeta> = {
  home: {
    title: 'hand · computer use without pixel guessing',
    description:
      'A computer-use library. The device lists what can be clicked, Clef picks one with a probability, and a writer model is called only when a task needs new text.',
    canonical: 'https://hand.coey.dev/',
  },
  ...DOC_META,
  lab: {
    title: 'hand lab · computer-use tools, measured',
    description: 'Every computer-use tool for AI agents, side by side: how it sees the screen, who decides where to click, and measured results.',
    canonical: 'https://hand.coey.dev/lab/',
  },
  brand: { title: 'hand brand', description: 'Logo, icons, colour and type for hand.', canonical: 'https://hand.coey.dev/brand/' },
  brandLab: { title: 'hand mark lab', noindex: true },
  notFound: { title: 'not found · hand', noindex: true },
};
