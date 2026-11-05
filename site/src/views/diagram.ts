import type { Html } from 'foldkit/html';
import { type H, rawSvg } from './kit.ts';

const SIGNAL = '#2E9BF0';

const arrow = (prefix: string, d: string, accent = false, dashed = false) =>
  `<path d="${d}" fill="none" stroke="${accent ? SIGNAL : 'currentColor'}" stroke-width="1" ${dashed ? 'stroke-dasharray="3 3"' : ''} marker-end="url(#${prefix}-head${accent ? '-s' : ''})"/>`;

const defs = (prefix: string) =>
  `<defs><marker id="${prefix}-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="9" markerHeight="9" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8Z" fill="currentColor" stroke="none"/></marker>` +
  `<marker id="${prefix}-head-s" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="${SIGNAL}"/></marker>` + '</defs>';

const CLEF = '#2E9BF0';
const CLAIRIC = '#8B5CF6';

const chip = (cx: number, y: number, name: string, job: string, color: string) => {
  const w = 30 + (name.length + job.length) * 6.4;
  return (
    `<g><rect x="${cx - w / 2}" y="${y}" width="${w}" height="22" rx="11" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-width="1"/>` +
    `<text x="${cx}" y="${y + 15}" text-anchor="middle" font-size="11.5" stroke="none" fill="${color}"><tspan font-weight="650">${name}</tspan> ${job}</text></g>`
  );
};

const step = (x: number, y: number, w: number, hgt: number, title: string, sub: string, chips: string[]) =>
  `<g><rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="10" fill="var(--hd-bg,#fff)" stroke="currentColor" stroke-opacity=".35" stroke-width="1"/>` +
  `<text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-size="15" font-weight="650" stroke="none" fill="currentColor">${title}</text>` +
  `<text x="${x + w / 2}" y="${y + 47}" text-anchor="middle" font-size="11.5" stroke="none" opacity=".6">${sub}</text>${chips.join('')}</g>`;

const plain = (prefix: string, inner: string[]) =>
  defs(prefix) + `<g font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor" stroke="currentColor" stroke-width="1">${inner.join('')}</g>`;

const WIDE = plain('hd-wide', [
  step(8, 8, 196, 128, 'Your agent', 'any model', [`<text x="106" y="96" text-anchor="middle" font-size="12" stroke="none" opacity=".8">sets the goal</text>`]),
  arrow('hd-wide', 'M210 72H256'),
  step(262, 8, 196, 128, 'hand acts', 'on your real app', [chip(360, 66, 'Clef', 'picks the button', CLEF), chip(360, 98, 'Clairic', 'copies the words', CLAIRIC)]),
  arrow('hd-wide', 'M464 72H510'),
  step(516, 8, 196, 128, 'hand checks', 'before and after', [chip(614, 82, 'Clef', 'did it work?', CLEF)]),
]);

const TALL = plain('hd-tall', [
  step(20, 8, 280, 84, 'Your agent', 'any model · sets the goal', []),
  arrow('hd-tall', 'M160 96V118'),
  step(20, 122, 280, 128, 'hand acts', 'on your real app', [chip(160, 180, 'Clef', 'picks the button', CLEF), chip(160, 212, 'Clairic', 'copies the words', CLAIRIC)]),
  arrow('hd-tall', 'M160 254V276'),
  step(20, 280, 280, 96, 'hand checks', 'before and after', [chip(160, 344, 'Clef', 'did it work?', CLEF)]),
]);

const LABEL = 'Diagram: your agent sets the goal. hand acts on your real app: Clef picks the button and Clairic copies the exact words from the task. Then Clef compares before and after to check it worked.';

export const howDiagram = (h: H): Html =>
  h.figure(
    [h.Class('mx-auto mt-0 mb-0 max-w-[760px] text-text')],
    [
      rawSvg(h, { viewBox: '0 0 320 384', className: 'mx-auto block h-auto w-full max-w-[320px] sm:hidden', label: LABEL }, TALL),
      rawSvg(
        h,
        {
          viewBox: '0 0 720 144',
          className: 'hidden h-auto w-full sm:block',
          label: LABEL,
        },
        WIDE,
      ),
      h.figcaption(
        [h.Class('mt-3 text-center text-[0.85rem] text-dim')],
        ['Clef and Clairic are small, fast models. If Clef is not sure, hand asks instead of guessing. A big model only writes text the task does not contain.'],
      ),
    ],
  );
