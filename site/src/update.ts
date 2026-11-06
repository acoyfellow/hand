import type { Command, Update } from 'foldkit';
import { modifyFields } from 'foldkit/struct';
import { Mark } from './brand.ts';
import {
  AnnounceHydration,
  ClearCopied,
  CopyInstall,
  CopySettings,
  DownloadIcon,
  DownloadMark,
  RandomAgents,
  RandomBatch,
  RandomSeed,
} from './commands.ts';
import { isChoiceKey, isNumericKey, type MarkOptions } from './mark-options.ts';
import { Message } from './message.ts';
import type { Flags, MarkLab, Model } from './model.ts';

export const INSTALL_COMMAND = 'bun add github:acoyfellow/hand#release';

export const DEFAULT_SWARM_SEEDS = ['ada', 'bix', 'cyd', 'dot'];

const DEFAULT_GALLERY = Array.from({ length: 24 }, (_, index) => `hand-${index + 1}`);

type Return = Update.Return<Model, Message>;

type AnyCommand = Command.Command<Message>;

export const initialLab = (): MarkLab => ({
  options: Mark.balance({ ...Mark.PRESETS.c3! }),
  preset: 'c3',
  seed: 'hand',
  accent: Mark.COLORS.accent,
  morph: false,
  colorful: false,
  motion: 'still',
  gallery: DEFAULT_GALLERY,
  swarmSeeds: DEFAULT_SWARM_SEEDS,
  copiedSettings: false,
});

export const init = ({ page }: Flags): Return => ({
  model: { page, live: false, copied: false, lab: initialLab() },
  commands: [AnnounceHydration()],
});

const withLab = (model: Model, change: (lab: MarkLab) => Partial<MarkLab>, commands: readonly AnyCommand[] = []): Return => ({
  model: modifyFields(model, { lab: (lab) => ({ ...lab, ...change(lab) }) }),
  commands: [...commands],
});

const fromSeed = (lab: MarkLab, seed: string, style?: string): Partial<MarkLab> => ({
  seed,
  options: Mark.generate(seed, style),
  preset: '',
  accent: lab.colorful ? Mark.accentOf(seed) : lab.accent,
});

const setNumber = (options: MarkOptions, key: string, value: number): MarkOptions => (isNumericKey(key) ? { ...options, [key]: value } : options);

const setChoice = (options: MarkOptions, key: string, value: string): MarkOptions => (isChoiceKey(key) ? { ...options, [key]: value } : options);

export const galleryStyle = (lab: MarkLab): string | undefined => (lab.preset === '' ? lab.options.style : undefined);

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    CompletedHydration: () => ({ model: modifyFields(model, { live: () => true }) }),
    CompletedMount: () => ({ model }),
    CompletedEffect: () => ({ model }),
    ClickedCopyInstall: () => ({ model, commands: [CopyInstall({ text: INSTALL_COMMAND })] }),
    CopiedInstall: () => ({ model: modifyFields(model, { copied: () => true }), commands: [ClearCopied()] }),
    ClearedCopied: () => ({ model: modifyFields(model, { copied: () => false }) }),
    PickedPreset: ({ name }) => {
      const preset = Mark.PRESETS[name];
      return preset ? withLab(model, () => ({ preset: name, options: Mark.balance({ ...preset }) })) : { model };
    },
    PickedStyle: ({ style }) => withLab(model, (lab) => ({ options: Mark.balance(Mark.generate(lab.seed, style)), preset: '' })),
    PickedMotion: ({ motion }) => withLab(model, () => ({ motion })),
    ToggledMorph: () => withLab(model, (lab) => ({ morph: !lab.morph })),
    ToggledColour: () =>
      withLab(model, (lab) => ({ colorful: !lab.colorful, accent: lab.colorful ? Mark.COLORS.accent : Mark.accentOf(lab.seed) })),
    ClickedRandomize: () => ({ model, commands: [RandomSeed()] }),
    GotRandomSeed: ({ seed }) => withLab(model, (lab) => ({ ...fromSeed(lab, seed), options: Mark.balance(Mark.generate(seed)) })),
    ClickedNewBatch: () => ({ model, commands: [RandomBatch()] }),
    GotBatch: ({ seeds }) => withLab(model, () => ({ gallery: seeds })),
    ClickedNewAgents: () => ({ model, commands: [RandomAgents()] }),
    GotAgents: ({ seeds }) => withLab(model, () => ({ swarmSeeds: seeds })),
    ChangedSeed: ({ seed }) => withLab(model, (lab) => ({ ...fromSeed(lab, seed), options: Mark.balance(Mark.generate(seed)) })),
    ChangedNumber: ({ key, value }) => withLab(model, (lab) => ({ options: setNumber(lab.options, key, value), preset: '' })),
    ChangedChoice: ({ key, value }) => withLab(model, (lab) => ({ options: setChoice(lab.options, key, value), preset: '' })),
    PickedSample: ({ seed }) => withLab(model, (lab) => ({ ...fromSeed(lab, seed, galleryStyle(lab)), options: Mark.balance(Mark.generate(seed, galleryStyle(lab))) })),
    ArrivedMorph: ({ seed, options, accent }) => withLab(model, () => ({ seed, options, accent, preset: '' })),
    ClickedDownloadMark: () => ({ model, commands: [DownloadMark({ options: model.lab.options })] }),
    ClickedDownloadIcon: () => ({ model, commands: [DownloadIcon({ options: model.lab.options })] }),
    ClickedCopySettings: () => ({ model, commands: [CopySettings({ options: model.lab.options })] }),
    CopiedSettings: () => withLab(model, () => ({ copiedSettings: true })),
  });
