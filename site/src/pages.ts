export const PAGES = ['home', 'docs', 'reference', 'lab', 'brand', 'brandLab', 'notFound'] as const;

export type Page = (typeof PAGES)[number];

export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  docs: '/docs/',
  reference: '/docs/reference/',
  lab: '/lab/',
  brand: '/brand/',
  brandLab: '/brand/lab/',
  notFound: '/404/',
};

export const PRERENDER_PATHS = PAGES.map((page) => PAGE_PATHS[page]);

export const pageAt = (pathname: string): Page | undefined => PAGES.find((page) => PAGE_PATHS[page] === pathname);

export type PageMeta = { readonly title: string; readonly description?: string; readonly canonical?: string; readonly noindex?: boolean };

export const PAGE_META: Record<Page, PageMeta> = {
  home: {
    title: 'hand · computer use without pixel guessing',
    description:
      'A computer-use library. The device lists what can be clicked, Clef picks one with a probability, and a writer model is called only when a task needs new text.',
    canonical: 'https://hand.coey.dev/',
  },
  docs: {
    title: 'hand docs · set up hand on your Mac',
    description: 'Install hand, add Cloudflare credentials, check everything with hand doctor, and give it to your AI agent over MCP.',
    canonical: 'https://hand.coey.dev/docs/',
  },
  reference: {
    title: 'hand reference · every tool, type, error code and setting',
    description: 'All 16 MCP tools with their argument schemas, the Hand class, the hand.action event, error codes, environment variables and package exports, generated from the source.',
    canonical: 'https://hand.coey.dev/docs/reference/',
  },
  lab: {
    title: 'hand lab · computer-use tools, measured',
    description: 'Every computer-use tool for AI agents, side by side: how it sees the screen, who decides where to click, and measured results.',
    canonical: 'https://hand.coey.dev/lab/',
  },
  brand: { title: 'hand brand', description: 'Logo, icons, colour and type for hand.', canonical: 'https://hand.coey.dev/brand/' },
  brandLab: { title: 'hand mark lab', noindex: true },
  notFound: { title: 'not found · hand', noindex: true },
};
