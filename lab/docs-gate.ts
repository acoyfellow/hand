export {};

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

const FORBIDDEN = [/\bDO_[A-Z]/, /src\/mcp\.ts/, /swiftc -O node_modules/];

const fail = (message: string): never => {
  console.error(`docs-gate FAIL: ${message}`);
  process.exit(1);
};

const fetchText = async (path: string) => {
  const response = await fetch(`${base}${path}`, { headers: { 'cache-control': 'no-cache' } });
  if (response.status !== 200) fail(`${path} returned ${response.status}`);
  return (await response.text()).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
};

const docs = await fetchText('/docs/');
const missing = REQUIRED.filter((needle) => !docs.includes(needle));
if (missing.length > 0) fail(`/docs/ is missing: ${missing.join(', ')}`);
for (const path of ['/', '/docs/', '/llms.txt']) {
  const text = path === '/docs/' ? docs : await fetchText(path);
  const stale = FORBIDDEN.find((pattern) => pattern.test(text));
  if (stale) fail(`${path} still shows old setup (${stale})`);
}
const home = await fetch(`${base}/`).then((response) => response.text());
if (!home.includes('href="/docs/"')) fail('home does not link to /docs/');
console.log(`docs-gate PASS: ${base}/docs/ has all ${REQUIRED.length} setup facts, no old names on /, /docs/ or /llms.txt, home links to docs`);
