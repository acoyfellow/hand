import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

interface AgentResult {
  readonly agent: string;
  readonly task: string;
  readonly text: string;
  readonly passed: boolean;
  readonly finishedAtMs: number;
  readonly usd: number;
}

const runDir = join(import.meta.dir, '..', '..', 'bench', 'runs', 'demo-swarm');
const work = join(runDir, 'cut');
const raw = join(runDir, 'raw.mov');
const out = join(runDir, 'hand-swarm.mp4');
const poster = join(runDir, 'hand-swarm.jpg');
mkdirSync(work, { recursive: true });

const receipt = JSON.parse(readFileSync(join(runDir, 'receipt.json'), 'utf8')) as { model: string; results: readonly AgentResult[] };
if (!receipt.results.every((result) => result.passed)) throw new Error('refusing to cut a take where an agent failed its checker');

const WIDTH = 1920;
const HEIGHT = 1080;
const TITLE_SECONDS = 3;
const END_SECONDS = 4;
const TARGET_SECONDS = 52;
const COLORS: Record<string, string> = { ada: '#8B5CF6', bix: '#16A34A', cyd: '#F38020' };
const SHORT: Record<string, string> = {
  'pwa-chat-attach-send': 'sent "see you at 3" in Chat',
  'mac-finder-rename': 'renamed draft.txt in Finder',
  'mac-settings-dark': 'turned on Dark mode in System Settings',
  'mac-textedit-edit-line': 'changed apples to pears in TextEdit',
};

const probe = Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', raw]);
const rawSeconds = Number(probe.stdout.toString().trim());
const lastFinish = Math.max(...receipt.results.map((result) => result.finishedAtMs)) / 1000;
const workSeconds = Math.min(rawSeconds, lastFinish + 2);
const bodySeconds = TARGET_SECONDS - TITLE_SECONDS - END_SECONDS;
const speed = Math.max(1, workSeconds / bodySeconds);
const atBody = (seconds: number) => TITLE_SECONDS + seconds / speed;

const page = (body: string, transparent: boolean) =>
  `<!doctype html><html><head><style>
  *{margin:0;box-sizing:border-box}
  body{width:${WIDTH}px;height:${HEIGHT}px;font-family:-apple-system,"SF Pro Display",Inter,system-ui,sans-serif;background:${transparent ? 'transparent' : '#0b0b0d'};color:#fff;position:relative;overflow:hidden}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:28px}
  h1{font-size:84px;font-weight:700;letter-spacing:-.02em;line-height:1.05}
  p{font-size:36px;color:#b8b8c0}
  .chips{display:flex;gap:18px}
  .chip{font-size:30px;font-weight:600;padding:12px 26px;border-radius:999px;color:#fff}
  .cap{position:absolute;left:50%;transform:translateX(-50%);bottom:56px;display:flex;align-items:center;gap:20px;background:rgba(10,10,12,.86);backdrop-filter:blur(8px);padding:22px 36px;border-radius:22px;font-size:38px;font-weight:600;white-space:nowrap}
  .dot{width:26px;height:26px;border-radius:50%}
  .tick{color:#4ade80;font-size:42px}
  .tag{position:absolute;left:44px;top:36px;background:rgba(10,10,12,.78);padding:12px 22px;border-radius:14px;font-size:26px;font-weight:600}
  .url{font-size:44px;font-weight:600;color:#2E9BF0}
  </style></head><body>${body}</body></html>`;

const chips = receipt.results.map((result) => `<span class="chip" style="background:${COLORS[result.agent]}">${result.agent}</span>`).join('');

const cards: { name: string; html: string; transparent: boolean }[] = [
  {
    name: 'title',
    transparent: false,
    html: `<div class="center"><h1>Three agents. One real Mac.</h1><p>Each has its own hand and cursor. Recorded in a macOS virtual machine, not staged.</p><div class="chips">${chips}</div></div>`,
  },
  { name: 'tag', transparent: true, html: `<div class="tag">Real run · macOS VM · ${receipt.model} · ${speed > 1.05 ? `${speed.toFixed(1)}× speed` : 'real time'}</div>` },
  ...receipt.results.map((result) => ({
    name: `cap-${result.agent}`,
    transparent: true,
    html: `<div class="cap"><span class="dot" style="background:${COLORS[result.agent]}"></span>${result.agent} ${SHORT[result.task] ?? result.task} <span class="tick">✓ checked</span></div>`,
  })),
  {
    name: 'end',
    transparent: false,
    html: `<div class="center"><h1>All three tasks passed the benchmark checker.</h1><p>Every finish is checked against the app's real state, not the agent's word.</p><div class="url">hand.coey.dev/lab</div></div>`,
  },
];

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
for (const card of cards) {
  await tab.setContent(page(card.html, card.transparent));
  await tab.screenshot({ path: join(work, `${card.name}.png`), omitBackground: card.transparent });
}
await browser.close();

const sorted = [...receipt.results].sort((a, b) => a.finishedAtMs - b.finishedAtMs);
const bodyEnd = atBody(workSeconds);
const captionWindows = sorted.map((result, index) => {
  const start = atBody(result.finishedAtMs / 1000);
  const next = sorted[index + 1];
  const end = Math.min(bodyEnd, next ? atBody(next.finishedAtMs / 1000) : bodyEnd);
  return { agent: result.agent, start, end: Math.max(end, start + 2) };
});

const inputs = ['-loop', '1', '-t', String(TITLE_SECONDS), '-i', join(work, 'title.png'), '-i', raw, '-loop', '1', '-t', String(END_SECONDS), '-i', join(work, 'end.png'), '-i', join(work, 'tag.png'), ...sorted.flatMap((result) => ['-i', join(work, `cap-${result.agent}.png`)])];
const scale = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0b0b0d,setsar=1,fps=30,format=yuv420p`;
const filters = [
  `[0:v]${scale}[title]`,
  `[1:v]trim=0:${workSeconds.toFixed(2)},setpts=(PTS-STARTPTS)/${speed.toFixed(4)},${scale}[work]`,
  `[2:v]${scale}[end]`,
  `[title][work][end]concat=n=3:v=1:a=0[base]`,
  `[base][3:v]overlay=0:0:enable='between(t,${TITLE_SECONDS},${bodyEnd.toFixed(2)})'[tagged]`,
];
let last = 'tagged';
captionWindows.forEach((window, index) => {
  const label = `cap${index}`;
  filters.push(`[${last}][${4 + index}:v]overlay=0:0:enable='between(t,${window.start.toFixed(2)},${window.end.toFixed(2)})'[${label}]`);
  last = label;
});

const ffmpeg = Bun.spawnSync(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', `[${last}]`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', '-an', out]);
if (ffmpeg.exitCode !== 0) throw new Error(ffmpeg.stderr.toString());
Bun.spawnSync(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(atBody(sorted[1]?.finishedAtMs ? sorted[1].finishedAtMs / 1000 - 1 : 10)), '-i', out, '-frames:v', '1', '-q:v', '3', poster]);
const final = Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', out]);
console.log(`cut ${out}: ${Number(final.stdout.toString()).toFixed(1)} s from ${rawSeconds.toFixed(1)} s raw at ${speed.toFixed(2)}x, captions at ${captionWindows.map((w) => `${w.agent} ${w.start.toFixed(1)}s`).join(', ')}`);
