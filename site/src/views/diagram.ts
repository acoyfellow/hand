import type { Html } from 'foldkit/html';
import { type H, rawSvg } from './kit.ts';

const SIGNAL = '#2E9BF0';

const arrow = (d: string, accent = false, dashed = false) =>
  `<path d="${d}" fill="none" stroke="${accent ? SIGNAL : 'currentColor'}" stroke-width="1" ${dashed ? 'stroke-dasharray="3 3"' : ''} marker-end="url(#hd-head${accent ? '-s' : ''})"/>`;

const DEFS =
  `<defs><marker id="hd-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="currentColor"/></marker>` +
  `<marker id="hd-head-s" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="${SIGNAL}"/></marker>` + '</defs>';

const step = (x: number, y: number, w: number, title: string, sub: string, accent = false) =>
  `<g><rect x="${x}" y="${y}" width="${w}" height="64" rx="8" fill="var(--hd-bg,#fff)" stroke="${accent ? SIGNAL : 'currentColor'}" stroke-width="${accent ? 1.6 : 1}"/>` +
  `<text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-size="14" font-weight="600" stroke="none" fill="${accent ? SIGNAL : 'currentColor'}">${title}</text>` +
  `<text x="${x + w / 2}" y="${y + 47}" text-anchor="middle" font-size="11.5" stroke="none" opacity=".65">${sub}</text></g>`;

const plain = (inner: string[]) =>
  DEFS + `<g font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor" stroke="currentColor" stroke-width="1">${inner.join('')}</g>`;

const WIDE = plain([
  step(8, 16, 196, 'Your agent', 'sets the goal'),
  arrow('M210 48H254'),
  step(262, 16, 196, 'hand', 'finds the button, clicks', true),
  arrow('M464 48H508'),
  step(516, 16, 196, 'hand', 'checks it worked', true),
]);

const TALL = plain([
  step(20, 8, 280, 'Your agent', 'sets the goal'),
  arrow('M160 76V96'),
  step(20, 100, 280, 'hand', 'finds the button, clicks', true),
  arrow('M160 168V188'),
  step(20, 192, 280, 'hand', 'checks it worked', true),
]);

const LABEL = 'Diagram: your agent sets the goal. hand finds the button and clicks it, then checks that it worked.';

export const howDiagram = (h: H): Html =>
  h.figure(
    [h.Class('mx-auto mt-0 mb-0 max-w-[760px] text-text')],
    [
      rawSvg(h, { viewBox: '0 0 320 260', className: 'mx-auto block h-auto w-full max-w-[320px] sm:hidden', label: LABEL }, TALL),
      rawSvg(
        h,
        {
          viewBox: '0 0 720 96',
          className: 'hidden h-auto w-full sm:block',
          label: LABEL,
        },
        WIDE,
      ),
      h.figcaption(
        [h.Class('mt-3 text-center text-[0.85rem] text-dim')],
        ['A small, fast model picks each click. If it is not sure, hand asks instead of guessing.'],
      ),
    ],
  );
