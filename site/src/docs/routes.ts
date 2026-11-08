export type Kind = 'Overview' | 'Tutorial' | 'How-to' | 'Reference' | 'Explanation';

export type DocRoute = { readonly key: DocKey; readonly path: string; readonly kind: Kind; readonly nav: string; readonly title: string; readonly description: string };

export const DOC_KEYS = [
  'docs',
  'tutorialFirstTask',
  'howtoCode',
  'howtoHeaded',
  'howtoCursor',
  'howtoParallel',
  'howtoFix',
  'howtoUninstall',
  'reference',
  'refTools',
  'refReplies',
  'refEvent',
  'refHand',
  'refTypes',
  'refSettings',
  'refExports',
  'explainHow',
  'explainData',
  'explainHelper',
] as const;

export type DocKey = (typeof DOC_KEYS)[number];

export const DOC_ROUTES: readonly DocRoute[] = [
  { key: 'docs', path: '/docs/', kind: 'Overview', nav: 'Documentation', title: 'Documentation', description: 'Set up hand on your Mac, give it to your AI agent, and look up every tool, type and setting.' },
  { key: 'tutorialFirstTask', path: '/docs/tutorials/first-task/', kind: 'Tutorial', nav: 'Install hand and run your first task', title: 'Install hand and run your first task', description: 'Download the Mac app, sign in with Cloudflare, allow it to use apps, connect your agent and watch it type into TextEdit. About five minutes.' },
  { key: 'howtoCode', path: '/docs/how-to/use-from-code/', kind: 'How-to', nav: 'Use hand from code', title: 'Use hand from code', description: 'Install the library with Bun, add Cloudflare credentials, run hand doctor and drive a Mac app from TypeScript.' },
  { key: 'howtoHeaded', path: '/docs/how-to/headed-mode/', kind: 'How-to', nav: 'Turn on keystrokes and the mouse', title: 'Turn on keystrokes and the mouse', description: 'When to switch hand from accessibility-only to headed mode, and how to do it for the MCP server and the library.' },
  { key: 'howtoCursor', path: '/docs/how-to/draw-your-own-cursor/', kind: 'How-to', nav: 'Draw your own cursor', title: 'Draw your own cursor', description: 'Listen for hand.action events from the MCP server and draw where each agent is acting.' },
  { key: 'howtoParallel', path: '/docs/how-to/run-agents-in-parallel/', kind: 'How-to', nav: 'Run several agents at once', title: 'Run several agents at once', description: 'Give each agent an id so it gets its own cursor and they take turns on the screen.' },
  { key: 'howtoFix', path: '/docs/how-to/fix-problems/', kind: 'How-to', nav: 'Fix common problems', title: 'Fix common problems', description: 'What to do when hand doctor, permissions, the helper or an action fails.' },
  { key: 'howtoUninstall', path: '/docs/how-to/uninstall/', kind: 'How-to', nav: 'Sign out and uninstall', title: 'Sign out and uninstall', description: 'Revoke the Cloudflare sign-in, remove hand from your agent and delete the app.' },
  { key: 'reference', path: '/docs/reference/', kind: 'Reference', nav: 'Reference', title: 'Reference', description: 'Every MCP tool, reply, event, class, type, setting and export in hand, generated from the source.' },
  { key: 'refTools', path: '/docs/reference/mcp-tools/', kind: 'Reference', nav: 'MCP tools', title: 'MCP tools', description: 'All 16 tools the hand MCP server lists, with every argument, its type and whether it is required.' },
  { key: 'refReplies', path: '/docs/reference/replies-and-errors/', kind: 'Reference', nav: 'Replies and error codes', title: 'Replies and error codes', description: 'What hand replies with, and what each error code means and what to do about it.' },
  { key: 'refEvent', path: '/docs/reference/action-event/', kind: 'Reference', nav: 'The hand.action event', title: 'The hand.action event', description: 'The notification the MCP server sends before and after every action, field by field.' },
  { key: 'refHand', path: '/docs/reference/hand-class/', kind: 'Reference', nav: 'The Hand class', title: 'The Hand class', description: 'Every method and option of the Hand class, and the step record it keeps.' },
  { key: 'refTypes', path: '/docs/reference/types/', kind: 'Reference', nav: 'Types', title: 'Types', description: 'The Device interface, receipts, Clef requests and answers, and the other types hand exports.' },
  { key: 'refSettings', path: '/docs/reference/settings/', kind: 'Reference', nav: 'Settings and credentials', title: 'Settings and credentials', description: 'Every HAND_ environment variable, the config file, and the order hand looks for credentials in.' },
  { key: 'refExports', path: '/docs/reference/exports/', kind: 'Reference', nav: 'Package exports', title: 'Package exports', description: 'Every import path the hand package exports and what it holds.' },
  { key: 'explainHow', path: '/docs/explanation/how-it-works/', kind: 'Explanation', nav: 'How hand works', title: 'How hand works', description: 'Why hand lists controls instead of guessing pixels, how Clef picks one with a probability, and how hand checks the result.' },
  { key: 'explainData', path: '/docs/explanation/data-and-billing/', kind: 'Explanation', nav: 'Data, billing and permissions', title: 'Data, billing and permissions', description: 'What hand reads, where it sends it, who pays for it and which macOS permissions it needs.' },
  { key: 'explainHelper', path: '/docs/explanation/the-helper/', kind: 'Explanation', nav: 'The macOS helper', title: 'The macOS helper', description: 'The small Swift program hand uses to read and press controls, how it is built and why it is not signed yet.' },
];

export const NAV_GROUPS: readonly (readonly [string, readonly DocKey[]])[] = [
  ['Overview', ['docs']],
  ['Tutorials', ['tutorialFirstTask']],
  ['How-to guides', ['howtoCode', 'howtoHeaded', 'howtoParallel', 'howtoCursor', 'howtoFix', 'howtoUninstall']],
  ['Reference', ['reference', 'refTools', 'refReplies', 'refEvent', 'refHand', 'refTypes', 'refSettings', 'refExports']],
  ['Explanation', ['explainHow', 'explainData', 'explainHelper']],
];

export const routeOf = (key: DocKey): DocRoute => DOC_ROUTES.find((route) => route.key === key) ?? (DOC_ROUTES[0] as DocRoute);
export const isDocKey = (page: string): page is DocKey => (DOC_KEYS as readonly string[]).includes(page);
