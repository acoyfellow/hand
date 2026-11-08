import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';
import { PAGE_META, PAGE_PATHS, PRERENDER_PATHS } from '../src/pages.ts';

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = join(site, '..');
const client = join(site, 'dist', 'client');

await $`bun lab/build.ts --offline`.cwd(repo);
await $`./node_modules/.bin/tsc -p tsconfig.json`.cwd(site);
await $`./node_modules/.bin/vite build --logLevel warn`.cwd(site);

const notFoundDirectory = join(client, PAGE_PATHS.notFound);
renameSync(join(notFoundDirectory, 'index.html'), join(client, '404.html'));
rmSync(notFoundDirectory, { recursive: true });

const withHead = (file: string, extra: string) => writeFileSync(file, readFileSync(file, 'utf8').replace('</head>', `${extra}</head>`));

const SITE = 'https://hand.coey.dev';
const OG_IMAGE = `${SITE}/og.png`;
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'hand',
  description: PAGE_META.home.description,
  url: `${SITE}/`,
  image: OG_IMAGE,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS 13 or later',
  downloadUrl: 'https://github.com/acoyfellow/hand/releases/latest/download/hand.dmg',
  softwareHelp: `${SITE}/docs/`,
  author: { '@type': 'Person', name: 'Jordan Coeyman', url: 'https://x.com/acoyfellow' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

const socialTags = (page: string, title: string, description: string, canonical: string) =>
  [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="${page === 'home' ? 'website' : 'article'}">`,
    '<meta property="og:site_name" content="hand">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${OG_IMAGE}">`,
    '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="hand: let your AI agent use a computer without guessing where to click.">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:creator" content="@acoyfellow">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${OG_IMAGE}">`,
  ].join('');

for (const [page, meta] of Object.entries(PAGE_META)) {
  const path = page === 'notFound' ? '/404.html' : `${PAGE_PATHS[page as keyof typeof PAGE_PATHS]}index.html`;
  const description = meta.description ? escape(meta.description) : '';
  const tags = [
    description ? `<meta name="description" content="${description}">` : '',
    meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
    '<link rel="manifest" href="/manifest.webmanifest">',
    meta.canonical ? socialTags(page, escape(meta.title), description, meta.canonical) : '',
    page === 'home' ? `<script type="application/ld+json">${JSON.stringify(SOFTWARE)}</script>` : '',
    `<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))</script>`,
  ].join('');
  withHead(join(client, path), tags);
}

const indexed = Object.values(PAGE_META).filter((meta) => meta.canonical && !meta.noindex);
const today = new Date().toISOString().slice(0, 10);
const urls = indexed.map((meta) => `  <url><loc>${meta.canonical}</loc><lastmod>${today}</lastmod></url>`).join('\n');
writeFileSync(join(client, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

const expected = [...PRERENDER_PATHS.filter((path) => path !== PAGE_PATHS.notFound).map((path) => `${path}index.html`), '/404.html', '/llms.txt', '/cursor.js', '/lab/data.json', '/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/sw.js', '/og.png'];
const missing = expected.filter((path) => !existsSync(join(client, path)));
if (missing.length) throw new Error(`site build is missing ${missing.join(', ')}`);
console.log(`site built: ${expected.join(' ')}`);
