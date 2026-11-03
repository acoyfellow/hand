import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:8799';
const out = 'site/public/brand';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${origin}/brand/`);
const files = await page.evaluate(async () => {
  const mark = await import('/brand/mark.js');
  const base = mark.DEFAULT_MARK;
  const favicon = { ...base, weight: base.weight * 1.25, fingers: Math.min(base.fingers, 3) };
  return {
    icon: mark.iconSvg(base),
    favicon: mark.iconSvg(favicon),
    mark: mark.markSvg(base),
    markLight: mark.markSvg(base, { ink: mark.COLORS.nightInk }),
  };
});
writeFileSync(`${out}/icon.svg`, `${files.icon}\n`);
writeFileSync(`${out}/favicon.svg`, `${files.favicon}\n`);
writeFileSync(`${out}/mark.svg`, `${files.mark}\n`);
writeFileSync(`${out}/mark-light.svg`, `${files.markLight}\n`);

const raster = async (name: string, svg: string, size: number, maskable: boolean) => {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#141416;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${size * 0.8}" height="${size * 0.8}" `).replace(/<rect[^>]*rx="22"[^>]*\/>/, '')}</div>`
    : svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<body style="margin:0;background:transparent">${inner}</body>`);
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
};
await raster('icon-512', files.icon, 512, false);
await raster('icon-192', files.icon, 192, false);
await raster('apple-touch-icon', files.icon, 180, false);
await raster('maskable-512', files.icon, 512, true);
await raster('maskable-192', files.icon, 192, true);
await browser.close();
console.log('brand files written from mark.js DEFAULT_MARK');
