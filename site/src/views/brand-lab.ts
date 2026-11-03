import type { Html } from 'foldkit/html';
import { Mark } from '../brand.ts';
import { type ChoiceKey, type MarkOptions, type NumericKey, isChoiceKey } from '../mark-options.ts';
import { Message } from '../message.ts';
import { type MarkLab, type Model, Motion } from '../model.ts';
import { AnimatedPreview, MarkArt, Swarm } from '../mounts.ts';
import { galleryStyle } from '../update.ts';
import type { Child, H } from './kit.ts';

const RANGES: Record<NumericKey, readonly [number, number, number]> = {
  fingers: [1, 4, 1],
  fingerLen: [8, 36, 1],
  root: [0, 14, 1],
  palmWidth: [36, 64, 1],
  leftLen: [0, 30, 1],
  rightLen: [0, 40, 1],
  curl: [3, 12, 1],
  weight: [5, 16, 0.5],
  dotSize: [3, 9, 0.5],
  tilt: [-8, 8, 1],
};

const CHOICES: Record<ChoiceKey, readonly string[]> = { profile: Mark.PROFILES, thumb: Mark.THUMBS, dot: Mark.DOTS };

const LABELS: Record<NumericKey | ChoiceKey, string> = {
  fingers: 'Fingers',
  profile: 'Finger heights',
  fingerLen: 'Finger length',
  root: 'Finger gap from palm',
  palmWidth: 'Palm width',
  leftLen: 'Left side',
  rightLen: 'Right side',
  thumb: 'Thumb',
  curl: 'Thumb size',
  weight: 'Line weight',
  dot: 'Dot position',
  dotSize: 'Dot size',
  tilt: 'Tilt',
};

const GROUPS: readonly { readonly title: string; readonly keys: readonly (NumericKey | ChoiceKey)[] }[] = [
  { title: 'Fingers', keys: ['fingers', 'profile', 'fingerLen', 'root'] },
  { title: 'Palm', keys: ['palmWidth', 'leftLen', 'rightLen', 'thumb', 'curl'] },
  { title: 'Line', keys: ['weight', 'tilt'] },
  { title: 'Dot', keys: ['dot', 'dotSize'] },
];

const BUTTON = 'cursor-pointer rounded-lg border px-3.5 py-2 font-medium';
const SOLID = `${BUTTON} border-text bg-text text-bg`;
const QUIET = `${BUTTON} border-line bg-bg text-text hover:border-dim`;
const CARD = 'rounded-xl border border-line bg-bg';

const segmented = (h: H, label: string, items: readonly string[], active: string, toMessage: (item: string) => Message): Html =>
  h.div(
    [h.Role('group'), h.AriaLabel(label), h.Class('flex gap-0.5 rounded-lg border border-line bg-bg p-0.5')],
    items.map((item) =>
      h.button(
        [
          h.Type('button'),
          h.AriaPressed(String(item === active)),
          h.OnClick(toMessage(item)),
          h.Class('cursor-pointer rounded-md border-0 px-3 py-1.5 text-dim aria-pressed:bg-text aria-pressed:text-bg'),
        ],
        [item],
      ),
    ),
  );

const isMotion = (value: string): value is Motion => (Motion.literals as readonly string[]).includes(value);

const actions = (h: H, lab: MarkLab): Html =>
  h.div(
    [h.Class('flex flex-wrap items-center gap-2.5')],
    [
      segmented(h, 'Start from', Object.keys(Mark.PRESETS), lab.preset, (name) => Message.PickedPreset({ name })),
      segmented(h, 'Style', Mark.STYLES, lab.options.style, (style) => Message.PickedStyle({ style })),
      segmented(h, 'Motion', Mark.MOTIONS, lab.motion, (motion) => Message.PickedMotion({ motion: isMotion(motion) ? motion : 'still' })),
      h.button([h.Type('button'), h.AriaPressed(String(lab.morph)), h.OnClick(Message.ToggledMorph()), h.Class(QUIET)], [lab.morph ? 'Morph: on' : 'Morph: off']),
      h.button(
        [h.Type('button'), h.AriaPressed(String(lab.colorful)), h.OnClick(Message.ToggledColour()), h.Class(QUIET)],
        [lab.colorful ? 'Colour: by seed' : 'Colour: blue'],
      ),
      h.button([h.Type('button'), h.OnClick(Message.ClickedRandomize()), h.Class(SOLID)], ['Randomize']),
    ],
  );

const previewKey = (lab: MarkLab) => JSON.stringify([lab.options, lab.accent, lab.motion, lab.morph, lab.colorful]);

const preview = (h: H, model: Model): Html => {
  const lab = model.lab;
  return h.div(
    [
      h.Key(model.live ? previewKey(lab) : 'preview-static'),
      h.Class('grid content-center justify-items-center gap-[18px] border-b border-line bg-raise p-7 lg:border-r lg:border-b-0'),
      ...(model.live
        ? [h.OnMount(AnimatedPreview({ options: lab.options, accent: lab.accent, motion: lab.motion, morph: lab.morph, colorful: lab.colorful }))]
        : []),
    ],
    [
      h.div(
        [h.Class('flex gap-3.5'), h.Role('img'), h.AriaLabel('The current mark on paper and on night')],
        [
          h.div([h.DataAttribute('stage', 'paper'), h.Class('grid size-[150px] place-items-center rounded-xl border border-[#e4e4e1] bg-paper sm:size-[190px]')], []),
          h.div([h.DataAttribute('stage', 'night'), h.Class('grid size-[150px] place-items-center rounded-xl bg-night sm:size-[190px]')], []),
        ],
      ),
      h.div([h.DataAttribute('stage', 'sizes'), h.Class('flex items-end gap-3.5'), h.Role('img'), h.AriaLabel('The current icon at 96, 64, 32 and 16 pixels')], []),
      h.label(
        [h.Class('grid w-full gap-1.5 text-dim')],
        [
          'Seed',
          h.input([
            h.Value(lab.seed),
            h.OnChange((seed) => Message.ChangedSeed({ seed })),
            h.Class('min-h-[34px] w-full rounded-md border border-dim bg-bg px-2.5 py-1 text-text'),
          ]),
        ],
      ),
    ],
  );
};

const shown = (options: MarkOptions, balanced: MarkOptions, key: NumericKey): string => {
  const rounded = Math.round(balanced[key] * 10) / 10;
  return rounded === options[key] ? `${rounded}` : `${rounded} (held)`;
};

const control = (h: H, lab: MarkLab, balanced: MarkOptions, key: NumericKey | ChoiceKey): Html => {
  const LABEL = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-dim';
  if (isChoiceKey(key))
    return h.label(
      [h.Class(LABEL)],
      [
        LABELS[key],
        h.select(
          [
            h.OnChange((value) => Message.ChangedChoice({ key, value })),
            h.Class('min-h-[34px] min-w-[120px] rounded-md border border-dim bg-bg px-2 py-1 text-text'),
          ],
          CHOICES[key].map((choice) => h.option([h.Value(choice), h.Selected(choice === lab.options[key])], [choice])),
        ),
      ],
    );
  const [min, max, step] = RANGES[key];
  return h.label(
    [h.Class(LABEL)],
    [
      LABELS[key],
      h.output([h.Class('font-mono text-[0.9em] text-text')], [shown(lab.options, balanced, key)]),
      h.input([
        h.Type('range'),
        h.Min(String(min)),
        h.Max(String(max)),
        h.Step(String(step)),
        h.Value(String(lab.options[key])),
        h.OnInput((value) => Message.ChangedNumber({ key, value: Number(value) })),
        h.Class('col-span-2 m-0 w-full accent-text'),
      ]),
    ],
  );
};

const controls = (h: H, lab: MarkLab): Html => {
  const balanced = Mark.balance(lab.options);
  return h.form(
    [h.AriaLabel('Mark settings'), h.Class('grid content-start gap-x-6 gap-y-[18px] p-6 sm:grid-cols-2')],
    [
      ...GROUPS.map((group) =>
        h.fieldset(
          [h.Class('m-0 grid content-start gap-2.5 border-0 p-0')],
          [h.legend([h.Class('mb-1.5 p-0 font-semibold')], [group.title]), ...group.keys.map((key) => control(h, lab, balanced, key))],
        ),
      ),
      h.div(
        [h.Class('flex flex-wrap gap-2.5 sm:col-span-2')],
        [
          h.button([h.Type('button'), h.OnClick(Message.ClickedDownloadMark()), h.Class(QUIET)], ['Download mark.svg']),
          h.button([h.Type('button'), h.OnClick(Message.ClickedDownloadIcon()), h.Class(QUIET)], ['Download icon.svg']),
          h.button([h.Type('button'), h.OnClick(Message.ClickedCopySettings()), h.Class(QUIET)], [lab.copiedSettings ? 'Copied settings' : 'Copy settings']),
        ],
      ),
    ],
  );
};

const heading = (h: H, id: string, title: string, text: string, button: Html): Html =>
  h.div(
    [h.Class('flex flex-wrap items-end justify-between gap-4')],
    [h.div([], [h.h2([h.Id(id), h.Class('m-0 text-lg font-semibold')], [title]), h.p([h.Class('m-0 text-dim')], [text])]), button],
  );

const swarmSection = (h: H, model: Model): Html =>
  h.section(
    [h.AriaLabelledBy('swarm-title'), h.Class('mt-6 grid gap-3.5')],
    [
      heading(
        h,
        'swarm-title',
        'Swarm',
        'The homepage hero. Each agent is a seed: its own hand and colour, working in the same app at once.',
        h.button([h.Type('button'), h.OnClick(Message.ClickedNewAgents()), h.Class(QUIET)], ['New agents']),
      ),
      h.div(
        [h.Class(`${CARD} overflow-hidden px-3 py-7`)],
        [
          h.div(
            [
              h.Key(model.live ? model.lab.swarmSeeds.join(',') : 'swarm-static'),
              h.AriaHidden(true),
              h.Inert(true),
              h.Class('min-h-[220px]'),
              ...(model.live ? [h.OnMount(Swarm({ seeds: model.lab.swarmSeeds }))] : []),
            ],
            [],
          ),
        ],
      ),
    ],
  );

const sample = (h: H, model: Model, label: string, options: MarkOptions, accent: string, message: Message, preset: boolean): Html =>
  h.button(
    [
      h.Type('button'),
      h.OnClick(message),
      h.AriaLabel(`Edit ${label}`),
      h.Class(`grid cursor-pointer place-items-center gap-1.5 rounded-[10px] border bg-paper px-1.5 py-3 text-[#18181b] ${preset ? 'border-[#18181b]' : 'border-[#e4e4e1]'}`),
    ],
    [
      h.span(
        [h.Key(`${label}-${accent}-${options.style}-${model.live}`), h.Class('size-[72px]'), ...(model.live ? [h.OnMount(MarkArt({ options, accent, size: 72 }))] : [])],
        [],
      ),
      h.span([h.Class('max-w-full truncate font-mono text-[11px] text-[#5f5f65]'), h.AriaHidden(true)], [label]),
    ],
  );

const gallery = (h: H, model: Model): Html => {
  const lab = model.lab;
  const style = galleryStyle(lab);
  return h.section(
    [h.AriaLabelledBy('range-title'), h.Class('mt-6 grid gap-3.5')],
    [
      heading(
        h,
        'range-title',
        'Generated range',
        'Deterministic from the seed. Click one to edit it.',
        h.button([h.Type('button'), h.OnClick(Message.ClickedNewBatch()), h.Class(QUIET)], ['New batch']),
      ),
      h.div(
        [h.Class('grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2')],
        [
          ...Object.entries(Mark.PRESETS).map(([name, options]) => sample(h, model, name, options, Mark.COLORS.accent, Message.PickedPreset({ name }), true)),
          ...lab.gallery.map((seed) =>
            sample(h, model, seed, Mark.generate(seed, style), lab.colorful ? Mark.accentOf(seed) : Mark.COLORS.accent, Message.PickedSample({ seed }), false),
          ),
        ],
      ),
    ],
  );
};

export const brandLabMain = (h: H, model: Model): readonly Child[] => [
  h.div(
    [h.Class('mb-6 flex flex-wrap items-end justify-between gap-6')],
    [
      h.div(
        [],
        [
          h.a([h.Href('/brand/'), h.Class('text-dim no-underline hover:text-text')], ['hand brand']),
          h.h1([h.Class('my-1 text-[clamp(26px,4vw,38px)] leading-[1.1] font-semibold')], ['Mark lab']),
          h.p(
            [h.Class('m-0 max-w-[60ch] text-dim')],
            ['The hand mark is generated, not drawn. The rules hold spacing, weight and the dot in proportion. Morph walks between random states so you can watch it change.'],
          ),
        ],
      ),
      actions(h, model.lab),
    ],
  ),
  h.section(
    [h.AriaLabel('Editor'), h.Class(`${CARD} grid overflow-hidden lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]`)],
    [preview(h, model), controls(h, model.lab)],
  ),
  swarmSection(h, model),
  gallery(h, model),
];
