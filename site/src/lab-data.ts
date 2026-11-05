import { Schema } from 'effect';
import raw from './generated/lab-data.json';

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

const MiniwobArm = Schema.Struct({
  tasks: Schema.Number,
  solved: Schema.Number,
  usdPerTask: Schema.Number,
  solvedPerDollar: Schema.Number,
  medianSeconds: Schema.Number,
  errors: Schema.Number,
});

const Miniwob = Schema.Struct({ run: Schema.String, do: MiniwobArm, vision: MiniwobArm });

const Test = Schema.Struct({
  point: Schema.String,
  claim: Schema.String,
  run: Schema.String,
  pass: Schema.Boolean,
  metrics: Schema.Record(Schema.String, Schema.Unknown),
});

const Desk4Cell = Schema.Struct({
  tool: Schema.String,
  toolId: Schema.String,
  model: Schema.String,
  modelId: Schema.String,
  tasks: Schema.Number,
  finished: Schema.Number,
  web: Schema.Number,
  webTasks: Schema.Number,
  mac: Schema.Number,
  macTasks: Schema.Number,
  usd: Schema.Number,
  usdPerFinished: Schema.Number,
  results: Schema.Array(Schema.NullOr(Schema.Boolean)),
});

const Desk4 = Schema.Struct({
  run: Schema.String,
  tasks: Schema.Array(Schema.String),
  episodes: Schema.Number,
  usd: Schema.Number,
  models: Schema.Array(Schema.Struct({ id: Schema.String, label: Schema.String })),
  cells: Schema.Array(Desk4Cell),
});

const Desk3Row = Schema.Struct({
  tool: Schema.String,
  model: Schema.String,
  installed: Schema.Boolean,
  reason: Schema.String,
  tasks: Schema.Number,
  finished: Schema.Number,
  mac: Schema.Number,
  macTasks: Schema.Number,
  usd: Schema.Number,
});

const Desk3 = Schema.Struct({ run: Schema.String, rows: Schema.Array(Desk3Row) });

export type Desk4Data = typeof Desk4.Type;
export type Desk3Data = typeof Desk3.Type;
export type Desk4CellData = typeof Desk4Cell.Type;

const LabData = Schema.Struct({
  generatedAt: Schema.String,
  planner: Schema.String,
  headToHead: Schema.Array(HeadToHeadRow),
  scoreboard: Schema.Array(Row),
  competitors: Schema.Array(Competitor),
  benchmarks: Schema.Array(Benchmark),
  tests: Schema.Array(Test),
  miniwob: Schema.optionalKey(Miniwob),
  desk3: Schema.optionalKey(Desk3),
  desk4: Schema.optionalKey(Desk4),
});

export type LabData = typeof LabData.Type;

export const LAB_DATA: LabData = Schema.decodeUnknownSync(LabData)(raw);
