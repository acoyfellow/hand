import type { Html } from 'foldkit/html';
import { type H, rawSvg } from './kit.ts';

const SIGNAL = '#2E9BF0';

export const STEP_ICONS = {
  List: `<g opacity=".35"><path d="M10 18h4"/><path d="M10 22h2"/><path d="M10 26h2"/><path d="M10 30h2"/><path d="M10 34h4"/><path d="M10 38h2"/><path d="M10 42h2"/><path d="M10 46h2"/><path d="M10 50h4"/><path d="M10 54h2"/><path d="M10 58h2"/><path d="M10 62h2"/><path d="M10 66h4"/><path d="M10 70h2"/><path d="M10 74h2"/><path d="M10 78h2"/><path d="M10 18v60"/></g><rect x="22" y="20" width="62" height="14" rx="3"/><rect x="22" y="41" width="62" height="14" rx="3"/><rect x="22" y="62" width="62" height="14" rx="3"/><path d="M27 27h7M27 48h7M27 69h7" stroke-width="2.4"/><path d="M40 27h30M40 48h22M40 69h34" opacity=".55"/><path d="M18 48h66" stroke="${SIGNAL}" stroke-dasharray="1.5 3" opacity=".9"/><path d="M16 46l2 2-2 2" stroke="${SIGNAL}"/>`,
  Pick: `<g opacity=".3"><rect x="10" y="14" width="56" height="12" rx="3"/><rect x="10" y="70" width="56" height="12" rx="3"/></g><rect x="10" y="42" width="56" height="12" rx="3"/><path d="M15 48h6M26 48h22" stroke-width="2.4"/><path d="M89.6 37.4A24 24 0 1 1 79.6 27.4"/><path d="M84 48h8M60 48h-4M72 60v4M72 36v-4" opacity=".45"/><circle cx="84.6" cy="27.8" r="3.4" fill="${SIGNAL}" stroke="none"/><path d="M66 18l6 -6M72 12h-4M72 12v4" opacity=".45"/>`,
  Act: `<rect x="14" y="54" width="54" height="22" rx="5"/><rect x="18" y="58" width="46" height="14" rx="3" opacity=".4"/><path d="M50 30l0 30 7-6 5 11 4-2-5-11 9-1z" fill="var(--bg,#fff)"/><path d="M41 44a12 12 0 0 1 18 -14" stroke="${SIGNAL}" opacity=".8"/><path d="M36 40a18 18 0 0 1 27 -21" stroke="${SIGNAL}" opacity=".4"/><circle cx="50" cy="60" r="2.2" fill="${SIGNAL}" stroke="none"/><g opacity=".4"><path d="M80 54v22M77 54h6M77 76h6"/><path d="M8 84h66" stroke-dasharray="1 3"/></g>`,
  Check: `<rect x="8" y="22" width="34" height="44" rx="4" opacity=".45"/><path d="M14 32h20M14 40h14M14 48h18" opacity=".35"/><rect x="54" y="22" width="34" height="44" rx="4"/><path d="M60 32h20M60 40h14" opacity=".55"/><path d="M62 52l6 6 12-13" stroke="${SIGNAL}" stroke-width="2"/><path d="M44 44h7M48 41l3 3-3 3"/><g opacity=".35"><path d="M8 76h80"/><path d="M8 73v6M42 73v6M54 73v6M88 73v6"/></g>`,
} as const;

export type StepName = keyof typeof STEP_ICONS;

export const STEPS: readonly { readonly name: StepName; readonly file: string; readonly blurb: string }[] = [
  { name: 'List', file: 'list.svg', blurb: 'Read the buttons on screen.' },
  { name: 'Pick', file: 'pick.svg', blurb: 'A small model chooses one.' },
  { name: 'Act', file: 'act.svg', blurb: 'Click it. Stop if unsure.' },
  { name: 'Check', file: 'check.svg', blurb: 'Confirm it worked.' },
];

export const stepIcon = (h: H, name: StepName, size: number): Html =>
  h.svg(
    [
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox('0 0 96 96'),
      h.Fill('none'),
      h.Stroke('currentColor'),
      h.StrokeWidth('1.25'),
      h.StrokeLinecap('round'),
      h.StrokeLinejoin('round'),
      h.Width(String(size)),
      h.Height(String(size)),
      h.Class('mb-3 block text-text'),
      h.AriaHidden(true),
      h.InnerHTML(STEP_ICONS[name]),
    ],
    [],
  );

const GITHUB_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

export const githubIcon = (h: H): Html =>
  rawSvg(h, { viewBox: '0 0 16 16', className: 'size-[18px] fill-current' }, `<path d="${GITHUB_PATH}"/>`);

const CLOUDFLARE_PATHS = `<path d="M275.125 68.25C311.507 68.25 341 97.9335 341 134.55C341 141.077 340.063 147.385 338.317 153.343C337.848 154.943 336.363 156 334.706 156H243.056C241.697 156 240.76 154.628 241.247 153.351L242.999 148.76C248.595 134.03 264.56 121.963 279.331 121.256L307.33 119.813C308.826 119.736 310 118.492 310 116.985C310 115.485 308.838 114.245 307.351 114.157L281.059 112.601C266.924 111.877 260.018 99.2932 263.82 86.179L268.195 71.0866C268.64 69.5514 269.971 68.4343 271.557 68.3476C272.738 68.2831 273.928 68.25 275.125 68.25Z" fill="#FF9910"/><path d="M184.062 0C222 0 253.868 26.1297 262.882 61.4824C263.26 62.967 263.142 64.5333 262.601 65.9662L255.383 85.0897C249.787 99.8196 235.406 112.593 219.134 112.593L93.7928 114.043C92.2801 114.061 91.063 115.3 91.0625 116.823C91.0625 118.344 92.2776 119.585 93.789 119.605L217.365 121.248C231.531 121.248 238.406 134.556 234.606 147.671L233.011 153.189C232.53 154.855 231.014 156 229.291 156H3.90889C1.98075 156 0.330745 154.574 0.17634 152.64C0.0594555 151.175 0 149.695 0 148.2C0 119.723 21.6617 96.3403 49.306 93.8266C48.7387 91.2419 48.4375 88.5564 48.4375 85.8C48.4375 65.3379 64.919 48.75 85.25 48.75C93.3413 48.75 100.822 51.3789 106.897 55.8321C117.716 23.3806 148.176 0 184.062 0Z" fill="#FF5F08"/>`;

export const cloudflareLogo = (h: H): Html =>
  rawSvg(h, { viewBox: '0 0 341 156', className: 'block h-[26px] w-[57px] flex-none', label: 'Cloudflare', width: '57', height: '26' }, CLOUDFLARE_PATHS);
