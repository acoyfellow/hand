import { DOC_ROUTES } from '../site/src/docs/routes.ts';

const base = process.argv[2] ?? 'https://hand.coey.dev';

const REQUIRED = [
  'bun add github:acoyfellow/hand#release',
  'hand doctor',
  '~/.config/hand/config.json',
  'hand-gateway',
  'Accessibility',
  'Screen Recording',
  'HAND_HEADED',
  'POLICY_DENIED',
  'steps',
  'helperOrBuild',
  'HAND_AX_HELPER',
];

const FORBIDDEN = [/\bDO_[A-Z]/, /bun (run )?\S*src\/mcp\.ts/, /swiftc -O node_modules/];

const fail = (message: string): never => {
  console.error(`docs-gate FAIL: ${message}`);
  process.exit(1);
};

const fetchText = async (path: string) => {
  const response = await fetch(`${base}${path}`, { headers: { 'cache-control': 'no-cache' } });
  if (response.status !== 200) fail(`${path} returned ${response.status}`);
  return (await response.text()).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
};

const pages = await Promise.all(DOC_ROUTES.map(async (route) => [route.path, await fetchText(route.path)] as const));
const docs = pages.map(([, text]) => text).join('\n');
const missing = REQUIRED.filter((needle) => !docs.includes(needle));
if (missing.length > 0) fail(`the docs are missing: ${missing.join(', ')}`);
for (const [path, text] of [['/', await fetchText('/')], ['/llms.txt', await fetchText('/llms.txt')], ...pages] as const) {
  const stale = FORBIDDEN.find((pattern) => pattern.test(text));
  if (stale) fail(`${path} still shows old setup (${stale})`);
}
const home = await fetch(`${base}/`).then((response) => response.text());
if (!home.includes('href="/docs/"')) fail('home does not link to /docs/');
console.log(`docs-gate PASS: ${pages.length} docs pages have all ${REQUIRED.length} setup facts, no old names, home links to docs`);
