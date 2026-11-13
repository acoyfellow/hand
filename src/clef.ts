// The one load-bearing call: ask Clef typed questions about a state plus up to 4 images.
// Input is checked before any network call; answers are checked before anyone trusts them.
import { Data, Effect, Schedule, Schema } from 'effect';
import { redact } from './credentials.ts';

export const CLEF_MODELS = {
  clef: { workersAiId: '@cf/cloudflare/clef', usdPerMillionIn: 0.24, context: 65_536 },
  'clef-flash': { workersAiId: '@cf/cloudflare/clef-flash', usdPerMillionIn: 0.038, context: 24_576 },
  'clef-omni': { workersAiId: '@cf/cloudflare/clef-omni', usdPerMillionIn: 0.15, context: 64_000 },
} as const;

export type ClefModel = keyof typeof CLEF_MODELS;

export type Question =
  | { readonly type: 'noul'; readonly instructions: string; readonly criteria?: { true?: string; false?: string } }
  | { readonly type: 'choice'; readonly instructions: string; readonly criteria: Record<string, string> }
  | { readonly type: 'score'; readonly instructions: string; readonly criteria: readonly string[] };

export interface ClefRequest {
  readonly model: ClefModel;
  readonly state: unknown;
  readonly questions: Record<string, Question>;
  /** data URLs (image/png, image/jpeg, image/webp). Clef places them before the state, in order. */
  readonly images?: readonly string[];
}

export type Answer =
  | { readonly type: 'noul'; readonly p: number }
  | {
      readonly type: 'choice';
      readonly choice: string;
      readonly probabilities: Record<string, number>;
      readonly confidence: number;
    }
  | {
      readonly type: 'score';
      readonly score: number;
      readonly probabilities: Record<string, number>;
      readonly confidence: number;
    };

export interface ClefResult {
  readonly model: ClefModel;
  readonly answers: Record<string, Answer>;
  readonly inputTokens: number;
  readonly costUsd: number;
  readonly ms: number;
}

export class ClefInputError extends Data.TaggedError('ClefInputError')<{ readonly reason: string }> {}
export class ClefHttpError extends Data.TaggedError('ClefHttpError')<{
  readonly status: number;
  readonly body: string;
}> {}
export class ClefAnswerError extends Data.TaggedError('ClefAnswerError')<{ readonly reason: string }> {}
export type ClefError = ClefInputError | ClefHttpError | ClefAnswerError;

/** Anything that can POST a JSON body to a Workers AI model id and return the parsed JSON. */
export type Transport = (workersAiId: string, body: unknown, signal?: AbortSignal) => Promise<{ status: number; json: unknown; text: string }>;

export interface TransportConfig {
  readonly accountId: string;
  readonly gateway: string;
  readonly token: string | (() => Promise<string>);
}

export const workersAiUrl = (accountId: string, gateway: string, workersAiId: string): string =>
  gateway === ''
    ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${workersAiId}`
    : `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/${workersAiId}`;

export function gatewayTransport(cfg: TransportConfig): Transport {
  return async (workersAiId, body, signal) => {
    const token = typeof cfg.token === 'string' ? cfg.token : await cfg.token();
    const res = await fetch(workersAiUrl(cfg.accountId, cfg.gateway, workersAiId), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(process.env.HAND_SKIP_CACHE === '1' ? { 'cf-aig-skip-cache': 'true' } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    const text = redact(await res.text(), token);
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  };
}

const ID = /^[A-Za-z0-9_.-]{1,100}$/;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,/i;

export function checkRequest(req: ClefRequest): string | undefined {
  if (!(req.model in CLEF_MODELS)) return `unknown model ${req.model}`;
  if (req.state === undefined || req.state === null || req.state === '') return 'state is required';
  const qs = Object.entries(req.questions);
  if (qs.length < 1 || qs.length > 64) return 'need 1 to 64 questions';
  for (const [id, q] of qs) {
    if (!ID.test(id)) return `bad question id ${id}`;
    if (!q.instructions.trim()) return `question ${id} needs instructions`;
    if (q.type === 'choice') {
      const n = Object.keys(q.criteria).length;
      if (n < 2 || n > 255) return `choice ${id} needs 2 to 255 options, got ${n}`;
    }
    if (q.type === 'score' && (q.criteria.length < 2 || q.criteria.length > 10)) return `score ${id} needs 2 to 10 levels`;
  }
  const images = req.images ?? [];
  if (images.length > 4) return 'at most 4 images';
  for (const img of images) if (!DATA_URL.test(img)) return 'images must be png/jpeg/webp data URLs';
  return undefined;
}

const Unit = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));
const Probs = Schema.Record(Schema.String, Schema.Finite);
const WireAnswer = Schema.Union([
  Schema.Struct({ type: Schema.Literal('noul'), noul: Unit }),
  Schema.Struct({ type: Schema.Literal('choice'), choice: Schema.String, probabilities: Probs, confidence: Unit }),
  Schema.Struct({ type: Schema.Literal('score'), score: Schema.Finite, probabilities: Probs, confidence: Unit }),
]);
const WireBody = Schema.Struct({
  answers: Schema.Record(Schema.String, WireAnswer),
  usage: Schema.optional(Schema.Struct({ input_tokens: Schema.Finite })),
});

const sumsToOne = (p: Record<string, number>) => Math.abs(Object.values(p).reduce((a, b) => a + b, 0) - 1) < 0.02;

function checkAnswers(req: ClefRequest, raw: unknown): Effect.Effect<{ answers: Record<string, Answer>; inputTokens: number }, ClefAnswerError> {
  // AI Gateway wraps Workers AI output as { result: {...} }; a raw SystemOne server does not.
  const inner = (raw as { result?: unknown })?.result ?? raw;
  return Schema.decodeUnknownEffect(WireBody)(inner).pipe(
    Effect.mapError((e) => new ClefAnswerError({ reason: `answer shape: ${String(e).slice(0, 300)}` })),
    Effect.flatMap((body) => {
      const answers: Record<string, Answer> = {};
      for (const [id, q] of Object.entries(req.questions)) {
        const a = body.answers[id];
        if (!a) return Effect.fail(new ClefAnswerError({ reason: `missing answer ${id}` }));
        if (a.type !== q.type) return Effect.fail(new ClefAnswerError({ reason: `${id}: asked ${q.type}, got ${a.type}` }));
        if (a.type === 'noul') answers[id] = { type: 'noul', p: a.noul };
        else {
          if (!sumsToOne(a.probabilities)) return Effect.fail(new ClefAnswerError({ reason: `${id}: probabilities do not sum to 1` }));
          if (a.type === 'choice') {
            if (q.type !== 'choice' || !(a.choice in q.criteria)) return Effect.fail(new ClefAnswerError({ reason: `${id}: unknown option ${a.choice}` }));
            answers[id] = { type: 'choice', choice: a.choice, probabilities: { ...a.probabilities }, confidence: a.confidence };
          } else {
            answers[id] = { type: 'score', score: a.score, probabilities: { ...a.probabilities }, confidence: a.confidence };
          }
        }
      }
      return Effect.succeed({ answers, inputTokens: body.usage?.input_tokens ?? 0 });
    }),
  );
}

const retryable = (e: ClefError) => e._tag === 'ClefHttpError' && (e.status === 429 || e.status >= 500 || e.status === 0);

export function ask(transport: Transport, req: ClefRequest): Effect.Effect<ClefResult, ClefError> {
  const bad = checkRequest(req);
  if (bad) return Effect.fail(new ClefInputError({ reason: bad }));
  const model = CLEF_MODELS[req.model];
  const body = { model: req.model, state: req.state, questions: req.questions, ...(req.images?.length ? { images: req.images } : {}) };
  const once = Effect.gen(function* () {
    const t0 = performance.now();
    const res = yield* Effect.tryPromise({
      try: (signal) => transport(model.workersAiId, body, signal),
      catch: (e) => new ClefHttpError({ status: 0, body: String(e).slice(0, 300) }),
    });
    if (res.status !== 200) return yield* Effect.fail(new ClefHttpError({ status: res.status, body: res.text.slice(0, 500) }));
    const { answers, inputTokens } = yield* checkAnswers(req, res.json);
    const ms = performance.now() - t0;
    return { model: req.model, answers, inputTokens, costUsd: (inputTokens * model.usdPerMillionIn) / 1e6, ms } satisfies ClefResult;
  });
  return once.pipe(
    Effect.timeout('60 seconds'),
    Effect.catchTag('TimeoutError', () => Effect.fail(new ClefHttpError({ status: 0, body: 'timeout' }))),
    Effect.retry({ schedule: Schedule.exponential('500 millis'), times: 4, while: retryable }),
  );
}

export const askPromise = (transport: Transport, req: ClefRequest) => Effect.runPromise(ask(transport, req));
