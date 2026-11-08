import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import { UrlRequest } from 'foldkit/navigation';
import { Url } from 'foldkit/url';
import { MarkOptions } from './mark-options.ts';
import { Motion } from './model.ts';

export const Message = defineMessageUnion({
  CompletedHydration: {},
  RequestedUrl: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigation: {},
  CompletedMount: {},
  CompletedEffect: {},
  ClickedCopyInstall: {},
  CopiedInstall: {},
  ClearedCopied: {},
  PickedPreset: { name: Schema.String },
  PickedStyle: { style: Schema.String },
  PickedMotion: { motion: Motion },
  ToggledMorph: {},
  ToggledColour: {},
  ClickedRandomize: {},
  GotRandomSeed: { seed: Schema.String },
  ClickedNewBatch: {},
  GotBatch: { seeds: Schema.Array(Schema.String) },
  ClickedNewAgents: {},
  GotAgents: { seeds: Schema.Array(Schema.String) },
  ChangedSeed: { seed: Schema.String },
  ChangedNumber: { key: Schema.String, value: Schema.Number },
  ChangedChoice: { key: Schema.String, value: Schema.String },
  PickedSample: { seed: Schema.String },
  ArrivedMorph: { seed: Schema.String, options: MarkOptions, accent: Schema.String },
  ClickedDownloadMark: {},
  ClickedDownloadIcon: {},
  ClickedCopySettings: {},
  CopiedSettings: {},
});

export type Message = typeof Message.Type;
