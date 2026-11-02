import { Effect } from 'effect';
import type { CDPSession, Page } from 'playwright';
import { ask, type Transport } from '../src/clef.ts';
import { chat, firstJson, type LlmModel } from '../src/llm.ts';
import { screenshot } from './browser.ts';

export interface Requirement {
  readonly id: string;
  readonly text: string;
}

export interface RequirementFinding {
  readonly id: string;
  readonly text: string;
  readonly p: number;
}

export interface JudgeResult {
  readonly whole: number;
  readonly findings: readonly RequirementFinding[];
  readonly checklist: 'pass' | 'fail' | 'abstain';
  readonly usd: number;
  readonly ms: number;
}

const STATE_PROPERTIES = new Set(['checked', 'selected', 'pressed', 'expanded', 'disabled', 'focused']);
const STATE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'switch',
  'checkbox',
  'radio',
  'combobox',
  'tab',
  'menuitem',
  'option',
  'slider',
  'spinbutton',
  'listbox',
  'row',
  'cell',
  'heading',
  'status',
  'alert',
  'dialog',
  'StaticText',
]);
const MAX_STATE_CHARS = 12000;
const RUBRIC_MODEL: LlmModel = 'glm-5.3-flash';
const PASS_AT = 0.5;
const ABSTAIN_BAND = 0.15;

const propertyValue = (property: { name: string; value?: { value?: unknown } }) => property.value?.value;

export async function accessibilityState(session: CDPSession): Promise<string> {
  const { nodes } = (await session.send('Accessibility.getFullAXTree')) as { nodes: any[] };
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.ignored) continue;
    const role = String(node.role?.value ?? '');
    if (!STATE_ROLES.has(role)) continue;
    const name = String(node.name?.value ?? '').trim();
    const value = String(node.value?.value ?? '').trim();
    if (role === 'StaticText' && name.length < 2) continue;
    const flags = ((node.properties ?? []) as { name: string; value?: { value?: unknown } }[])
      .filter((property) => STATE_PROPERTIES.has(property.name) && propertyValue(property) !== false && propertyValue(property) !== 'false')
      .map((property) => `${property.name}=${String(propertyValue(property))}`);
    const parts = [role, name ? `"${name.slice(0, 80)}"` : '', value ? `value="${value.slice(0, 120)}"` : '', ...flags].filter(Boolean);
    lines.push(parts.join(' '));
  }
  const text = lines.join('\n');
  return text.length > MAX_STATE_CHARS ? text.slice(0, MAX_STATE_CHARS) : text;
}

const RATE_LIMIT_RETRIES = 6;
const isRateLimited = (error: unknown) => (error as { status?: number })?.status === 429;
const retryOnRateLimit = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    for (let attempt = 1; ; attempt++) {
      const result = yield* Effect.result(effect);
      if (result._tag === 'Success') return result.success;
      if (!isRateLimited(result.failure) || attempt >= RATE_LIMIT_RETRIES) return yield* Effect.fail(result.failure);
      yield* Effect.sleep(`${2 ** attempt} seconds`);
    }
  });

export function rubric(t: Transport, task: string): Effect.Effect<{ requirements: Requirement[]; usd: number }, unknown> {
  return retryOnRateLimit(
    chat(
      t,
      RUBRIC_MODEL,
      [
        {
          role: 'system',
          content:
            'Turn a computer task into the outcomes that must be true on screen when it is done. Reply with only JSON {"requirements": ["...", ...]}, one to four short checkable statements about the end state, such as "The email from X is no longer in the inbox" or "The Display name field contains Jordan". Describe results, not steps. Do not add conditions the task does not ask for.',
        },
        { role: 'user', content: `Task: ${task}` },
      ],
      { maxTokens: 300, thinking: false },
    ).pipe(
      Effect.map((res) => {
        const parsed = firstJson(res.text) as { requirements?: unknown } | undefined;
        const list = Array.isArray(parsed?.requirements)
          ? parsed.requirements.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
          : [];
        const requirements = (list.length ? list : [task]).slice(0, 4).map((text, index) => ({ id: `r${index + 1}`, text: text.trim() }));
        return { requirements, usd: res.costUsd };
      }),
    ),
  );
}

const verdictOf = (findings: readonly RequirementFinding[]): JudgeResult['checklist'] => {
  if (findings.some((finding) => finding.p < PASS_AT - ABSTAIN_BAND)) return 'fail';
  if (findings.every((finding) => finding.p >= PASS_AT + ABSTAIN_BAND)) return 'pass';
  return 'abstain';
};

export async function judge(t: Transport, page: Page, session: CDPSession, task: string, requirements: readonly Requirement[]): Promise<JudgeResult> {
  const t0 = performance.now();
  const [shot, state] = await Promise.all([screenshot(page), accessibilityState(session)]);
  const [whole, checklist] = await Promise.all([
    Effect.runPromise(
      retryOnRateLimit(
        ask(t, {
          model: 'clef',
          state: { task },
          images: [shot],
          questions: {
            achieved: {
              type: 'noul',
              instructions: 'The image is the screen right after the agent acted. Does it show that the agent succeeded at `task`?',
              criteria: { true: 'The screen changed in the way the task asked for.', false: 'Nothing changed, or something else happened.' },
            },
          },
        }),
      ),
    ),
    Effect.runPromise(
      retryOnRateLimit(
        ask(t, {
          model: 'clef',
          state: { task, accessibility_state: state },
          images: [shot],
          questions: Object.fromEntries(
            requirements.map((requirement) => [
              requirement.id,
              {
                type: 'noul' as const,
                instructions: `Requirement: "${requirement.text}". Using \`accessibility_state\` (the app's controls with their current values and states, read from the app itself) and the screenshot, is this requirement true right now? Judge only what is shown, not what the agent intended.`,
                criteria: { true: 'The current state shows the requirement is met.', false: 'The current state shows it is not met, or nothing shows it.' },
              },
            ]),
          ),
        }),
      ),
    ),
  ]);
  const findings = requirements.map((requirement) => {
    const answer = checklist.answers[requirement.id];
    return { id: requirement.id, text: requirement.text, p: answer?.type === 'noul' ? answer.p : 0 };
  });
  const wholeAnswer = whole.answers.achieved;
  return {
    whole: wholeAnswer?.type === 'noul' ? wholeAnswer.p : 0,
    findings,
    checklist: verdictOf(findings),
    usd: whole.costUsd + checklist.costUsd,
    ms: performance.now() - t0,
  };
}
