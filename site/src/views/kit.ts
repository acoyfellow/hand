import type { Html, HtmlBuilder } from 'foldkit/html';
import type { Message } from '../message.ts';

export type H = HtmlBuilder<Message>;

export type Child = Html | string;

export const GITHUB = 'https://github.com/acoyfellow/hand';

export const rawSvg = (h: H, attributes: { viewBox: string; className: string; label?: string; width?: string; height?: string }, inner: string): Html =>
  h.svg(
    [
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox(attributes.viewBox),
      h.Class(attributes.className),
      ...(attributes.width ? [h.Width(attributes.width)] : []),
      ...(attributes.height ? [h.Height(attributes.height)] : []),
      ...(attributes.label ? [h.Role('img'), h.AriaLabel(attributes.label)] : [h.AriaHidden(true)]),
      h.InnerHTML(inner),
    ],
    [],
  );

export const scrollRegion = (h: H, label: string, children: readonly Child[]): Html =>
  h.div(
    [h.Class('overflow-x-auto rounded-[10px] border border-line'), h.Role('region'), h.AriaLabel(label), h.Tabindex(0)],
    [...children],
  );

export const codeBlock = (h: H, label: string, inner: string): Html =>
  h.pre(
    [
      h.Class('my-4 overflow-x-auto rounded-[10px] bg-raise p-4 font-mono text-[0.82rem] leading-[1.55]'),
      h.Role('region'),
      h.AriaLabel(label),
      h.Tabindex(0),
    ],
    [h.code([h.InnerHTML(inner)], [])],
  );
