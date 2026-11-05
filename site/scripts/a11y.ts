import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { $ } from 'bun';
import { chromium, type Page } from 'playwright';
import { serveSite } from './serve.ts';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'lab', path: '/lab/' },
  { name: 'brand', path: '/brand/' },
  { name: 'brand-lab', path: '/brand/lab/' },
  { name: '404', path: '/this-page-does-not-exist/' },
] as const;

const SCHEMES = ['light', 'dark'] as const;

const MOTIONS = ['no-preference', 'reduce'] as const;

const WIDTHS = [1280, 390] as const;

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const site = fileURLToPath(new URL('..', import.meta.url));
const shots = join(site, '..', 'shots');
const wantsShots = process.argv.includes('--shots');

if (!process.argv.includes('--no-build')) await $`bun scripts/build.ts`.cwd(site);

const server = serveSite(0);
const origin = server.url.origin;
const browser = await chromium.launch();
const failures: string[] = [];

const settle = async (page: Page) => {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(1200);
};

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const skipLinkWorks = async (page: Page) => {
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const box = active?.getBoundingClientRect();
    return { text: active?.textContent ?? '', visible: Boolean(box && box.width > 1 && box.height > 1), outline: active ? getComputedStyle(active).outlineStyle : '' };
  });
  return first.text === 'Skip to content' && first.visible && first.outline !== 'none';
};

if (wantsShots) mkdirSync(shots, { recursive: true });

for (const motion of MOTIONS) {
for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: motion });
    for (const entry of PAGES) {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(`${origin}${entry.path}`);
      await settle(page);
      const label = `${entry.name} ${scheme} ${width} motion=${motion}`;
      const expectedStatus = entry.name === '404' ? 404 : 200;
      if (response?.status() !== expectedStatus) failures.push(`${label}: status ${response?.status()}, expected ${expectedStatus}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join('; ')}`);
      const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const violation of result.violations)
        failures.push(`${label}: ${violation.id} (${violation.impact}) ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 4).join(' | ')}`);
      const overflow = await horizontalOverflow(page);
      if (overflow > 0) failures.push(`${label}: horizontal scroll of ${overflow}px`);
      if (!(await skipLinkWorks(page))) failures.push(`${label}: first Tab does not land on a visible, outlined skip link`);
      if (wantsShots && motion === 'reduce') {
        await page.keyboard.press('Escape');
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.screenshot({ path: join(shots, `site-${entry.name}-${scheme}-${width === 1280 ? 'desktop' : 'mobile'}.png`), fullPage: true });
      }
      console.log(`${failures.length ? '…' : 'ok'} ${label}: ${result.violations.length} violations, ${result.passes.length} passes, overflow ${overflow}`);
      await page.close();
    }
    await context.close();
  }
}
}

await browser.close();
server.stop(true);

if (failures.length) {
  console.error(`\n${failures.length} accessibility failures:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\na11y: ${PAGES.length} pages x ${SCHEMES.length} schemes x ${WIDTHS.length} widths x ${MOTIONS.length} motion settings, no violations, no horizontal scroll`);
