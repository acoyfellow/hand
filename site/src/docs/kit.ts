import type { Html } from 'foldkit/html';
import { type Child, type H, scrollRegion } from '../views/kit.ts';

export type Section = { readonly id: string; readonly title: string; readonly body: readonly Child[] };

export const P = 'my-3 max-w-[68ch] text-dim text-pretty';
export const H3 = 'mt-7 mb-2 scroll-mt-24 text-[1.02rem] font-semibold';
export const CODE = 'rounded bg-raise px-1 py-0.5 font-mono text-[0.85em] text-text';
export const CELL = 'border-b border-line px-3 py-2 text-left align-top';
export const HEAD = 'border-b border-line bg-raise px-3 py-2 text-left align-bottom text-[0.75rem] font-semibold tracking-[0.04em] text-dim uppercase';
export const MONO = `${CELL} font-mono text-[0.8rem] whitespace-nowrap text-text`;
export const TYPE = `${CELL} font-mono text-[0.76rem] text-dim`;
export const TEXT = `${CELL} text-dim`;

export const K = (text: string) => `<span class="text-[#c2410c] dark:text-[#ff9e64]">${text}</span>`;
export const S = (text: string) => `<span class="text-[#15803d] dark:text-[#9ece6a]">${text}</span>`;
export const F = (text: string) => `<span class="text-[#1d4ed8] dark:text-[#7aa2f7]">${text}</span>`;
export const C = (text: string) => `<span class="text-dim italic">${text}</span>`;

export const code = (h: H, text: string): Html => h.code([h.Class(CODE)], [text]);
export const p = (h: H, ...parts: readonly Child[]): Html => h.p([h.Class(P)], [...parts]);
export const strong = (h: H, text: string): Html => h.strong([h.Class('font-semibold text-text')], [text]);
export const link = (h: H, href: string, text: string): Html => h.a([h.Href(href)], [text]);
export const h3 = (h: H, text: string, id?: string): Html => h.h3([...(id ? [h.Id(id)] : []), h.Class(H3)], [text]);

export const list = (h: H, items: readonly (readonly Child[])[], ordered = false): Html =>
  (ordered ? h.ol : h.ul)([h.Class(`my-3 max-w-[68ch] ${ordered ? 'list-decimal' : 'list-disc'} pl-6 text-dim marker:text-faint`)], items.map((parts) => h.li([h.Class('my-1.5 pl-1')], [...parts])));

export const table = (h: H, label: string, heads: readonly string[], rows: readonly (readonly Html[])[]): Html =>
  h.div(
    [h.Class('my-4')],
    [
      scrollRegion(h, label, [
        h.table(
          [h.Class('w-full border-collapse text-[0.88rem]')],
          [h.thead([], [h.tr([], heads.map((head) => h.th([h.Scope('col'), h.Class(HEAD)], [head])))]), h.tbody([], rows.map((cells) => h.tr([h.Class('even:bg-raise/40')], [...cells])))],
        ),
      ]),
    ],
  );

export const note = (h: H, ...parts: readonly Child[]): Html =>
  h.div([h.Class('my-5 max-w-[68ch] rounded-r-[10px] border-l-4 border-signal bg-raise px-4 py-3 text-dim')], [...parts]);

export const steps = (h: H, items: readonly (readonly [string, readonly Child[]])[]): Html =>
  h.ol(
    [h.Class('my-5 grid max-w-[68ch] list-none gap-5 p-0')],
    items.map(([title, body], index) =>
      h.li(
        [h.Class('grid grid-cols-[2rem_1fr] gap-3')],
        [
          h.span([h.Class('grid size-8 place-items-center rounded-full bg-text text-[0.85rem] font-semibold text-bg'), h.AriaHidden(true)], [String(index + 1)]),
          h.div([h.Class('min-w-0')], [h.p([h.Class('m-0 mt-1 font-semibold text-text')], [title]), ...body]),
        ],
      ),
    ),
  );
