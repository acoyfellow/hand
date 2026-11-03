import type { Child, H } from './kit.ts';

export const notFoundMain = (h: H): readonly Child[] => [
  h.div(
    [h.Class('py-24 text-center')],
    [
      h.h1([h.Class('m-0 mb-3 text-[2.25rem] font-semibold tracking-[-0.03em]')], ['Not found.']),
      h.p([h.Class('m-0 text-dim text-balance')], ['There is no page at this address. ', h.a([h.Href('/')], ['Go to hand']), '.']),
    ],
  ),
];
