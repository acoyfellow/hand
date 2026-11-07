import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = process.env.HAND_SITE_URL ?? 'https://hand.coey.dev';
const RECEIPT = process.env.DEMO_RECEIPT ?? join(import.meta.dir, '..', '..', 'do', 'bench', 'runs', 'demo-use', 'receipt-published.json');
const MIN_SECONDS = 30;
const MAX_SECONDS = 90;
const MIN_AGENTS = 3;

interface UseReceipt {
  readonly events: readonly { readonly agent: string }[];
  readonly note: { readonly reasons: readonly string[]; readonly ticks: readonly { readonly item: string; readonly checked: boolean }[] };
}

const failures: string[] = [];
const expect = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const home = await fetch(`${SITE}/?gate=${Date.now()}`);
expect(home.status === 200, `home page returned ${home.status}`);
const html = await home.text();

const videoSource = html.match(/<video[^>]*\bsrc="([^"]+)"/)?.[1] ?? html.match(/<source[^>]*\bsrc="([^"]+\.(?:mp4|webm))"/)?.[1];
expect(Boolean(videoSource), 'home page has no video source');
expect(!/relay/i.test(videoSource ?? ''), `video source still points at the Relay demo: ${videoSource}`);
expect(!html.includes('A real 38 s run'), 'old Relay caption is still on the page');
expect(/<a[^>]*href="\/lab\/?"[^>]*>[^<]*(benchmark|lab)/i.test(html) || /href="\/lab\/?"/.test(html), 'no CTA link to /lab');

let durationSeconds = 0;
if (videoSource) {
  const videoUrl = new URL(videoSource, SITE).toString();
  const video = await fetch(videoUrl);
  expect(video.status === 200, `video returned ${video.status}`);
  const bytes = new Uint8Array(await video.arrayBuffer());
  const probe = Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', '-'], { stdin: bytes });
  durationSeconds = Number(probe.stdout.toString().trim());
  expect(durationSeconds >= MIN_SECONDS && durationSeconds <= MAX_SECONDS, `video is ${durationSeconds.toFixed(1)} s, expected ${MIN_SECONDS}-${MAX_SECONDS} s`);
  const partial = await fetch(videoUrl, { headers: { range: 'bytes=0-1' } });
  expect(
    partial.status === 206 && partial.headers.get('content-range') === `bytes 0-1/${bytes.byteLength}`,
    `video does not answer byte ranges (status ${partial.status}); Safari will not play it`,
  );
}

const receipt = JSON.parse(readFileSync(RECEIPT, 'utf8')) as UseReceipt;
const agents = new Set(receipt.events.map((event) => event.agent));
expect(agents.size >= MIN_AGENTS, `only ${agents.size} agents in the receipt`);
expect(receipt.note.reasons.length === 0, `the note check failed: ${receipt.note.reasons.join('; ')}`);
for (const tick of receipt.note.ticks) expect(tick.checked, `"${tick.item}" is not ticked`);

if (failures.length) {
  console.error(`video-gate FAIL:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`video-gate PASS: ${videoSource} is ${durationSeconds.toFixed(1)} s, ${agents.size} agents, note correct and every item ticked, /lab CTA present, Relay video gone`);
