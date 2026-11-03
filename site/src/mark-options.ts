import { Schema } from 'effect';

export const MarkOptions = Schema.Struct({
  style: Schema.String,
  fingers: Schema.Number,
  profile: Schema.String,
  fingerLen: Schema.Number,
  root: Schema.Number,
  palmWidth: Schema.Number,
  leftLen: Schema.Number,
  rightLen: Schema.Number,
  thumb: Schema.String,
  curl: Schema.Number,
  weight: Schema.Number,
  dot: Schema.String,
  dotSize: Schema.Number,
  tilt: Schema.Number,
  spacing: Schema.optionalKey(Schema.Number),
});

export type MarkOptions = typeof MarkOptions.Type;

export const NUMERIC_KEYS = ['fingers', 'fingerLen', 'root', 'palmWidth', 'leftLen', 'rightLen', 'curl', 'weight', 'dotSize', 'tilt'] as const;

export type NumericKey = (typeof NUMERIC_KEYS)[number];

export const CHOICE_KEYS = ['profile', 'thumb', 'dot'] as const;

export type ChoiceKey = (typeof CHOICE_KEYS)[number];

export const isNumericKey = (key: string): key is NumericKey => (NUMERIC_KEYS as readonly string[]).includes(key);

export const isChoiceKey = (key: string): key is ChoiceKey => (CHOICE_KEYS as readonly string[]).includes(key);
