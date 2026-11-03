import { Schema } from 'effect';
import raw from '../public/lab/data.json';

const Row = Schema.Struct({
  arm: Schema.String,
  run: Schema.String,
  finished: Schema.Number,
  tasks: Schema.Number,
  usdPerTask: Schema.Number,
  medianSeconds: Schema.Number,
  finishedPerDollar: Schema.Number,
});

const HeadToHeadRow = Schema.Struct({
  ...Row.fields,
  tokensPerTask: Schema.Number,
  danger: Schema.Number,
  falseDone: Schema.Number,
});

const Competitor = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  repo: Schema.optionalKey(Schema.String),
  url: Schema.String,
  sees: Schema.String,
  brain: Schema.String,
  platforms: Schema.Array(Schema.String),
  ships: Schema.String,
  strength: Schema.String,
  gap: Schema.String,
  adapter: Schema.String,
  stars: Schema.optionalKey(Schema.Number),
});

const Benchmark = Schema.Struct({ name: Schema.String, repo: Schema.String, status: Schema.String, note: Schema.String });

const LabData = Schema.Struct({
  generatedAt: Schema.String,
  planner: Schema.String,
  headToHead: Schema.Array(HeadToHeadRow),
  scoreboard: Schema.Array(Row),
  competitors: Schema.Array(Competitor),
  benchmarks: Schema.Array(Benchmark),
});

export type LabData = typeof LabData.Type;

export const LAB_DATA: LabData = Schema.decodeUnknownSync(LabData)(raw);
