import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

interface Receipt {
  readonly model: string;
  readonly recordStartMs?: number;
  readonly finishedAtMs: number;
  readonly answers: Record<string, string>;
  readonly noteWritten: { readonly finishedAtMs: number; readonly usd: number };
  readonly helperRuns: readonly { readonly agent: string; readonly finishedAtMs: number; readonly usd: number }[];
  readonly crossRuns: readonly { readonly finishedAtMs?: number; readonly usd?: number }[];
  readonly note: { readonly plaintext: string; readonly reasons: readonly string[]; readonly ticks: readonly { item: string; checked: boolean }[] };
}

const runDir = join(import.meta.dir, '..', '..', 'bench', 'runs', 'demo-use');
const work = join(runDir, 'cut');
const raw = join(runDir, 'raw.mov');
const out = join(runDir, 'hand-use.mp4');
const poster = join(runDir, 'hand-use.jpg');
mkdirSync(work, { recursive: true });

const receipt = JSON.parse(readFileSync(join(runDir, 'receipt.json'), 'utf8')) as Receipt;
if (receipt.note.reasons.length || !receipt.note.ticks.every((tick) => tick.checked)) throw new Error(`refusing to cut a failed take: ${receipt.note.reasons.join('; ')}`);

const WIDTH = 1920;
const HEIGHT = 1080;
const TITLE_SECONDS = 3;
const END_SECONDS = 4;
const COLORS: Record<string, string> = { ada: '#8B5CF6', bix: '#16A34A', cyd: '#F38020' };
const rawSeconds = Number(Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', raw]).stdout.toString().trim());
const lead = (receipt.recordStartMs ?? 10300) / 1000;
const clip = (ms: number) => Math.max(0, ms / 1000 - lead);
const workSeconds = Math.min(rawSeconds, clip(receipt.finishedAtMs) + 1.5);
const usd = [receipt.noteWritten.usd, ...receipt.helperRuns.map((run) => run.usd), ...receipt.crossRuns.map((run) => run.usd ?? 0)].reduce((sum, value) => sum + value, 0);

const page = (body: string, transparent: boolean) =>
  `<!doctype html><html><head><style>
  *{margin:0;box-sizing:border-box}
  body{width:${WIDTH}px;height:${HEIGHT}px;font-family:-apple-system,"SF Pro Display",Inter,system-ui,sans-serif;background:${transparent ? 'transparent' : '#0b0b0d'};color:#fff;position:relative;overflow:hidden}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:28px;padding:0 120px}
  h1{font-size:80px;font-weight:700;letter-spacing:-.02em;line-height:1.08}
  p{font-size:36px;color:#b8b8c0;line-height:1.35}
  .chips{display:flex;gap:18px}
  .chip{font-size:30px;font-weight:600;padding:12px 26px;border-radius:999px;color:#fff}
  .cap{position:absolute;left:50%;transform:translateX(-50%);bottom:56px;display:flex;align-items:center;gap:20px;background:rgba(10,10,12,.88);padding:22px 36px;border-radius:22px;font-size:38px;font-weight:600;white-space:nowrap}
  .dot{width:26px;height:26px;border-radius:50%}
  .tag{position:absolute;left:44px;top:36px;background:rgba(10,10,12,.8);padding:12px 22px;border-radius:14px;font-size:26px;font-weight:600}
  .url{font-size:44px;font-weight:600;color:#2E9BF0}
  </style></head><body>${body}</body></html>`;

const chip = (agent: string) => `<span class="chip" style="background:${COLORS[agent]}">${agent}</span>`;
const caption = (agent: string, text: string) => `<div class="cap"><span class="dot" style="background:${COLORS[agent]}"></span>${text}</div>`;
const firstAnswer = clip(Math.min(...receipt.helperRuns.map((run) => run.finishedAtMs)));
const beats = [
  { name: 'cap-write', start: 0.5, end: clip(receipt.noteWritten.finishedAtMs), html: caption('ada', 'ada writes the todo list in Notes') },
  { name: 'cap-look', start: clip(receipt.noteWritten.finishedAtMs), end: firstAnswer, html: caption('bix', 'bix and cyd look up both answers at once') },
  { name: 'cap-fill', start: firstAnswer, end: workSeconds, html: caption('ada', 'ada fills in each answer and ticks it off') },
];

const cards = [
  { name: 'title', transparent: false, html: `<div class="center"><h1>Three agents clear a todo list</h1><p>One writes the list. Two look things up in parallel. Each answer goes back in and gets ticked.</p><div class="chips">${['ada', 'bix', 'cyd'].map(chip).join('')}</div></div>` },
  { name: 'tag', transparent: true, html: `<div class="tag">Real run · macOS VM · ${receipt.model} · real time</div>` },
  ...beats.map((beat) => ({ name: beat.name, transparent: true, html: beat.html })),
  {
    name: 'end',
    transparent: false,
    html: `<div class="center"><h1>Done in ${clip(receipt.finishedAtMs).toFixed(0)} seconds for $${usd.toFixed(2)}</h1><p>Both items ticked, checked from Notes itself, not the agent's word.</p><div class="url">hand.coey.dev</div></div>`,
  },
];

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
for (const card of cards) {
  await tab.setContent(page(card.html, card.transparent));
  await tab.screenshot({ path: join(work, `${card.name}.png`), omitBackground: card.transparent });
}
await browser.close();

const at = (seconds: number) => TITLE_SECONDS + seconds;
const bodyEnd = at(workSeconds);
const inputs = ['-loop', '1', '-t', String(TITLE_SECONDS), '-i', join(work, 'title.png'), '-i', raw, '-loop', '1', '-t', String(END_SECONDS), '-i', join(work, 'end.png'), '-i', join(work, 'tag.png'), ...beats.flatMap((beat) => ['-i', join(work, `${beat.name}.png`)])];
const scale = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0b0b0d,setsar=1,fps=30,format=yuv420p`;
const filters = [
  `[0:v]${scale}[title]`,
  `[1:v]trim=0:${workSeconds.toFixed(2)},setpts=PTS-STARTPTS,${scale}[work]`,
  `[2:v]${scale}[end]`,
  '[title][work][end]concat=n=3:v=1:a=0[base]',
  `[base][3:v]overlay=0:0:enable='between(t,${TITLE_SECONDS},${bodyEnd.toFixed(2)})'[tagged]`,
];
let last = 'tagged';
beats.forEach((beat, index) => {
  const label = `cap${index}`;
  filters.push(`[${last}][${4 + index}:v]overlay=0:0:enable='between(t,${at(beat.start).toFixed(2)},${at(beat.end).toFixed(2)})'[${label}]`);
  last = label;
});
const ffmpeg = Bun.spawnSync(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', `[${last}]`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', '-an', out]);
if (ffmpeg.exitCode !== 0) throw new Error(ffmpeg.stderr.toString());
Bun.spawnSync(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(at(workSeconds - 1)), '-i', out, '-frames:v', '1', '-q:v', '3', poster]);
const seconds = Number(Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', out]).stdout.toString());
console.log(`cut ${out}: ${seconds.toFixed(1)} s at real time from ${rawSeconds.toFixed(1)} s raw, $${usd.toFixed(4)}`);
