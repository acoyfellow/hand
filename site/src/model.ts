import { Schema } from 'effect';
import { MarkOptions } from './mark-options.ts';
import { PAGES } from './pages.ts';

export const Page = Schema.Literals(PAGES);

export type Page = typeof Page.Type;

export const Motion = Schema.Literals(['still', 'wave', 'press', 'breathe']);

export type Motion = typeof Motion.Type;

export const MarkLab = Schema.Struct({
  options: MarkOptions,
  preset: Schema.String,
  seed: Schema.String,
  accent: Schema.String,
  morph: Schema.Boolean,
  colorful: Schema.Boolean,
  motion: Motion,
  gallery: Schema.Array(Schema.String),
  swarmSeeds: Schema.Array(Schema.String),
  copiedSettings: Schema.Boolean,
});

export type MarkLab = typeof MarkLab.Type;

export const Model = Schema.Struct({
  page: Page,
  live: Schema.Boolean,
  copied: Schema.Boolean,
  lab: MarkLab,
});

export type Model = typeof Model.Type;

