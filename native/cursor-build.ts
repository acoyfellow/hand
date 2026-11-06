import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { accentOf, agent, COLORS, cursorSvg, DEFAULT_MARK } from '../site/public/brand/mark.js';

const out = join(import.meta.dir, 'cursors');
const SIZE = 56;
const SCALE = 2;
const HOTSPOT = [28, 7];
const agents = (process.argv[2] ?? 'hand,claude,codex,agent-desktop,cua,default').split(',');

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: SIZE * 2, height: SIZE * 2 } });

const render = async (name: string, svg: string, accent: string) => {
  await page.setContent(`<body style="margin:0;background:transparent"><div style="padding:${SIZE / 2}px">${svg}</div></body>`);
  await page.screenshot({ path: join(out, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: SIZE * 2, height: SIZE * 2 } });
  return { accent, hotspot: [HOTSPOT[0] + SIZE / 2, HOTSPOT[1] + SIZE / 2], size: SIZE * 2 };
};

const manifest: Record<string, { accent: string; hotspot: number[]; size: number }> = {};
for (const id of agents) {
  const look = id === 'hand' ? { shape: DEFAULT_MARK, accent: COLORS.accent } : agent(id);
  manifest[id] = await render(id, cursorSvg(look.shape, { accent: look.accent, size: SIZE }), look.accent);
}
manifest.fallback = await render('fallback', cursorSvg(DEFAULT_MARK, { accent: accentOf('fallback'), size: SIZE }), accentOf('fallback'));
writeFileSync(join(out, 'cursors.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
console.log(`cursors written from mark.js for ${agents.join(', ')}`);
