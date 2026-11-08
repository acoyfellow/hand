import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const font = readFileSync(`${pub}fonts/google-sans-flex.woff2`).toString('base64');
const mark = readFileSync(`${pub}brand/mark.svg`, 'utf8').replace('#18181b', '#f4f4f5');

const html = `<!doctype html><html><head><style>
@font-face{font-family:F;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 600}
html,body{margin:0;width:1200px;height:630px;background:#141416;color:#f4f4f5;font-family:F,sans-serif}
.wrap{box-sizing:border-box;height:100%;padding:84px 96px;display:flex;flex-direction:column;justify-content:space-between}
.top{display:flex;align-items:center;gap:22px;font-size:46px;font-weight:600;letter-spacing:-.02em}
.top svg{width:84px;height:84px}
h1{margin:0;font-size:68px;line-height:1.08;font-weight:600;letter-spacing:-.03em;max-width:980px}
p{margin:0;font-size:30px;color:#a1a1aa}
.foot{display:flex;justify-content:space-between;align-items:flex-end}
.url{font-size:28px;color:#2e9bf0;font-weight:500}
</style></head><body><div class="wrap">
<div class="top">${mark}hand</div>
<h1>Let your AI agent use a computer without guessing where to click.</h1>
<div class="foot"><p>A small model picks the button. hand clicks it and checks it worked.</p><span class="url">hand.coey.dev</span></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${pub}og.png` });
await browser.close();
console.log('wrote public/og.png');
