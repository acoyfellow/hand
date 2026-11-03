import type { Html } from 'foldkit/html';
import { type H, rawSvg } from './kit.ts';

const SIGNAL = '#2E9BF0';

const box = (x: number, y: number, w: number, hgt: number, title: string, sub: string, accent = false) =>
  `<g><rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="3" fill="var(--hd-bg,#fff)" stroke="${accent ? SIGNAL : 'currentColor'}" stroke-width="${accent ? 1.6 : 1}"/>` +
  `<text x="${x + 12}" y="${y + 22}" font-size="12.5" font-weight="600" fill="${accent ? SIGNAL : 'currentColor'}">${title}</text>` +
  `<text x="${x + 12}" y="${y + 39}" font-size="10.5" opacity=".65">${sub}</text></g>`;

const arrow = (d: string, accent = false, dashed = false) =>
  `<path d="${d}" fill="none" stroke="${accent ? SIGNAL : 'currentColor'}" stroke-width="1" ${dashed ? 'stroke-dasharray="3 3"' : ''} marker-end="url(#hd-head${accent ? '-s' : ''})"/>`;

const note = (x: number, y: number, text: string, anchor = 'start') => `<text x="${x}" y="${y}" font-size="10" opacity=".6" text-anchor="${anchor}">${text}</text>`;

const DEFS =
  `<defs><marker id="hd-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="currentColor"/></marker>` +
  `<marker id="hd-head-s" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="${SIGNAL}"/></marker>` +
  `<pattern id="hd-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="currentColor" stroke-width=".4" opacity=".12"/></pattern></defs>`;

const frame = (w: number, hgt: number, inner: string[]) =>
  DEFS +
  `<rect x=".5" y=".5" width="${w - 1}" height="${hgt - 1}" fill="url(#hd-grid)" stroke="currentColor" stroke-width=".6" opacity=".55"/>` +
  `<g font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="currentColor" stroke="currentColor" stroke-width="1">${inner.join('')}</g>`;

const WIDE = frame(720, 280, [
  note(24, 24, 'FIG. 1  HOW HAND WORKS'),
  note(696, 24, 'p < 0.6 → ask, never guess', 'end'),
  box(24, 48, 168, 52, 'Your agent', 'any model, sets the goal'),
  box(24, 184, 168, 52, 'Screen', 'browser or Mac app'),
  box(276, 116, 168, 52, 'hand', 'lists the controls'),
  box(528, 48, 168, 52, 'Clef · System 1', 'picks one, with p', true),
  box(528, 184, 168, 52, 'Clef · System 1', 'did it work? p', true),
  arrow('M192 74H234V130H272'),
  note(200, 66, 'goal'),
  arrow('M360 116V74H524', true),
  note(372, 66, '[e1] [e2] [e3]'),
  arrow('M612 100V126H448', true),
  note(604, 120, 'e2 · p 0.94', 'end'),
  arrow('M318 168V210H196'),
  note(206, 202, 'click e2'),
  arrow('M108 236V258H612V240', true, true),
  note(124, 252, 'before / after'),
  arrow('M612 184V158H448', true),
  note(604, 176, 'changed · p 0.97', 'end'),
  note(696, 276 - 6, 'a big model only writes new text', 'end'),
]);

const TALL = frame(360, 520, [
  note(18, 24, 'FIG. 1  HOW HAND WORKS'),
  box(18, 44, 324, 52, 'Your agent', 'any model, sets the goal'),
  arrow('M180 96V128'),
  note(190, 116, 'goal'),
  box(18, 132, 324, 52, 'hand', 'lists the controls'),
  arrow('M120 184V216', true),
  note(130, 204, '[e1] [e2] [e3]'),
  box(18, 220, 324, 52, 'Clef · System 1', 'picks one, with p 0.94', true),
  arrow('M180 272V304'),
  note(190, 292, 'click e2'),
  box(18, 308, 324, 52, 'Screen', 'browser or Mac app'),
  arrow('M180 360V392', true, true),
  note(190, 380, 'before / after'),
  box(18, 396, 324, 52, 'Clef · System 1', 'did it work? p 0.97', true),
  note(18, 484, 'p < 0.6 → ask, never guess'),
  note(18, 504, 'a big model only writes new text'),
]);

const LABEL =
  'Diagram: your agent gives hand a goal. hand lists the controls on screen. Clef, a small System 1 model, picks one with a probability. hand clicks it, then Clef compares before and after to check it worked. Below 0.6 confidence hand asks instead of guessing. A big model is only used to write new text.';

export const howDiagram = (h: H): Html =>
  h.figure(
    [h.Class('mx-auto mt-10 mb-0 max-w-[760px] text-text')],
    [
      rawSvg(h, { viewBox: '0 0 360 520', className: 'block h-auto w-full sm:hidden', label: LABEL }, TALL),
      rawSvg(
        h,
        {
          viewBox: '0 0 720 280',
          className: 'hidden h-auto w-full sm:block',
          label: LABEL,
        },
        WIDE,
      ),
      h.figcaption(
        [h.Class('mt-3 text-center text-[0.85rem] text-dim')],
        ['The leverage: a small, fast System 1 model makes every click and says how sure it is. Your agent only sets the goal.'],
      ),
    ],
  );
