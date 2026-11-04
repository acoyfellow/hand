import { transport } from '../../bench/lib.ts';
import { toAnthropicMessages } from '../../src/anthropic.ts';
import type { Msg, Tool, ToolCall } from '../../src/llm.ts';

export type Route = 'anthropic' | 'openai' | 'workers-ai';

export interface GridModel {
  readonly id: string;
  readonly route: Route;
  readonly upstreamId: string;
  readonly usdIn: number;
  readonly usdOut: number;
}

export const GRID_MODELS: Record<string, GridModel> = {
  'claude-opus-5-5': { id: 'claude-opus-5-5', route: 'anthropic', upstreamId: 'claude-opus-5-5', usdIn: 5, usdOut: 25 },
  'claude-sonnet-5-5': { id: 'claude-sonnet-5-5', route: 'anthropic', upstreamId: 'claude-sonnet-5-5', usdIn: 3, usdOut: 15 },
  'gpt-6.1-sol': { id: 'gpt-6.1-sol', route: 'openai', upstreamId: 'gpt-6.1-sol', usdIn: 1.25, usdOut: 10 },
  'glm-5.3': { id: 'glm-5.3', route: 'workers-ai', upstreamId: '@cf/zai-org/glm-5.3', usdIn: 0.6, usdOut: 2.2 },
  'kimi-k3': { id: 'kimi-k3', route: 'workers-ai', upstreamId: '@cf/moonshotai/kimi-k3', usdIn: 0.95, usdOut: 4 },
  'deepseek-v4-pro': { id: 'deepseek-v4-pro', route: 'workers-ai', upstreamId: '@cf/deepseek-ai/deepseek-v4-pro-0813', usdIn: 1.32, usdOut: 3.96 },
  'kimi-k2.6': { id: 'kimi-k2.6', route: 'workers-ai', upstreamId: '@cf/moonshotai/kimi-k2.6', usdIn: 0.95, usdOut: 4 },
};

export interface PlannerReply {
  readonly text: string;
  readonly toolCalls: ToolCall[];
  readonly usd: number;
}

export class ModelUnavailable extends Error {}

const PROXY = process.env.DESK_MODEL_PROXY ?? 'http://127.0.0.1:49449';
const PROXY_KEY = 'harness-proxy-local';
const MAX_TOKENS = 1500;

const price = (model: GridModel, input: number, output: number) => (input * model.usdIn + output * model.usdOut) / 1_000_000;

const postJson = async (url: string, headers: Record<string, string>, body: unknown) => {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const text = await res.text();
  if (res.status === 403 || res.status === 404) throw new ModelUnavailable(`${res.status}: ${text.slice(0, 200)}`);
  if (res.status !== 200) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as Record<string, any>;
};

const withRetry = async <A>(attempt: () => Promise<A>): Promise<A> => {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (error instanceof ModelUnavailable || tries >= 4) throw error;
      await Bun.sleep(1000 * 2 ** tries);
    }
  }
};

const anthropic = async (model: GridModel, messages: Msg[], tools: Tool[]): Promise<PlannerReply> => {
  const converted = toAnthropicMessages(messages);
  const json = await postJson(
    `${PROXY}/anthropic/v1/messages`,
    { 'x-api-key': PROXY_KEY, 'anthropic-version': '2023-06-01', 'cf-aig-skip-cache': 'true' },
    {
      model: model.upstreamId,
      max_tokens: MAX_TOKENS,
      system: converted.system,
      messages: converted.messages,
      tools: tools.map((tool) => ({ name: tool.function.name, description: tool.function.description, input_schema: tool.function.parameters })),
    },
  );
  const blocks = (json.content ?? []) as { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
  const usage = json.usage ?? {};
  return {
    text: blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n'),
    toolCalls: blocks
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({ id: block.id ?? '', type: 'function', function: { name: block.name ?? '', arguments: JSON.stringify(block.input ?? {}) } })),
    usd: price(model, (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0), usage.output_tokens ?? 0),
  };
};

type ResponsesItem = Record<string, string>;

const responsesInput = (messages: Msg[]): ResponsesItem[] =>
  messages.flatMap((message): ResponsesItem[] => {
    const text = typeof message.content === 'string' ? message.content : message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
    if (message.role === 'system') return [];
    if (message.role === 'tool') return [{ type: 'function_call_output', call_id: message.tool_call_id ?? '', output: text }];
    if (message.role === 'assistant')
      return [
        ...(text ? [{ role: 'assistant', content: text }] : []),
        ...(message.tool_calls ?? []).map((call) => ({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments })),
      ];
    return [{ role: 'user', content: text }];
  });

const openai = async (model: GridModel, messages: Msg[], tools: Tool[]): Promise<PlannerReply> => {
  const instructions = messages
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content))
    .join('\n\n');
  const json = await postJson(
    `${PROXY}/v1/responses`,
    { authorization: `Bearer ${PROXY_KEY}` },
    {
      model: model.upstreamId,
      reasoning: { effort: 'low' },
      max_output_tokens: MAX_TOKENS * 4,
      instructions,
      input: responsesInput(messages),
      tools: tools.map((tool) => ({ type: 'function', name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters })),
    },
  );
  const output = (json.output ?? []) as { type: string; content?: { type: string; text?: string }[]; call_id?: string; name?: string; arguments?: string }[];
  const usage = json.usage ?? {};
  return {
    text: output
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? '')
      .join('\n'),
    toolCalls: output
      .filter((item) => item.type === 'function_call')
      .map((item) => ({ id: item.call_id ?? '', type: 'function', function: { name: item.name ?? '', arguments: item.arguments ?? '{}' } })),
    usd: price(model, usage.input_tokens ?? 0, usage.output_tokens ?? 0),
  };
};

const workersAi = async (model: GridModel, messages: Msg[], tools: Tool[]): Promise<PlannerReply> => {
  const res = await transport()(model.upstreamId, { messages, tools, max_tokens: MAX_TOKENS, temperature: 0 });
  if (res.status === 403 || res.status === 404) throw new ModelUnavailable(`${res.status}: ${res.text.slice(0, 200)}`);
  if (res.status !== 200) throw new Error(`${res.status}: ${res.text.slice(0, 300)}`);
  const root = ((res.json as { result?: unknown })?.result ?? res.json) as Record<string, any>;
  const message = root.choices?.[0]?.message ?? {};
  const rawCalls = (message.tool_calls ?? root.tool_calls ?? []) as { id?: string; name?: string; arguments?: unknown; function?: { name?: string; arguments?: unknown } }[];
  const usage = root.usage ?? {};
  return {
    text: message.content ?? (typeof root.response === 'string' ? root.response : ''),
    toolCalls: rawCalls.map((call, index) => {
      const args = call.function?.arguments ?? call.arguments ?? {};
      return { id: call.id ?? `call_${index}`, type: 'function', function: { name: call.function?.name ?? call.name ?? '', arguments: typeof args === 'string' ? args : JSON.stringify(args) } };
    }),
    usd: price(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0),
  };
};

const ROUTES: Record<Route, (model: GridModel, messages: Msg[], tools: Tool[]) => Promise<PlannerReply>> = { anthropic, openai, 'workers-ai': workersAi };

export const plannerChat = (modelId: string, messages: Msg[], tools: Tool[]): Promise<PlannerReply> => {
  const model = GRID_MODELS[modelId];
  if (!model) throw new ModelUnavailable(`unknown grid model ${modelId}`);
  return withRetry(() => ROUTES[model.route](model, messages, tools));
};

export const probeModel = async (modelId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const ping: Tool = { type: 'function', function: { name: 'ping', description: 'Reply by calling this.', parameters: { type: 'object', properties: {}, required: [] } } };
  try {
    const reply = await plannerChat(modelId, [{ role: 'user', content: 'Call the ping tool.' }], [ping]);
    return reply.toolCalls.length ? { ok: true } : { ok: false, reason: `${modelId} answered without calling a tool: ${reply.text.slice(0, 120)}` };
  } catch (error) {
    return { ok: false, reason: `${modelId} unavailable: ${(error as Error).message.slice(0, 240)}` };
  }
};
