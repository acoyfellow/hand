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

for (const [page, meta] of Object.entries(PAGE_META)) {
  const path = page === 'notFound' ? '/404.html' : `${PAGE_PATHS[page as keyof typeof PAGE_PATHS]}index.html`;
  const tags = [
    meta.description ? `<meta name="description" content="${meta.description}">` : '',
    meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
    page === 'home'
      ? `<meta property="og:title" content="hand"><meta property="og:description" content="Don't let a model guess pixels. List what can be clicked, and let a small model choose."><meta property="og:url" content="https://hand.coey.dev/">`
      : '',
  ].join('');
  withHead(join(client, path), tags);
}

const expected = [...PRERENDER_PATHS.filter((path) => path !== PAGE_PATHS.notFound).map((path) => `${path}index.html`), '/404.html', '/llms.txt', '/cursor.js', '/lab/data.json'];
const missing = expected.filter((path) => !existsSync(join(client, path)));
if (missing.length) throw new Error(`site build is missing ${missing.join(', ')}`);
console.log(`site built: ${expected.join(' ')}`);
