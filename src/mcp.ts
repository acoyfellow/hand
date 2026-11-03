import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gatewayTransport, type Transport } from './clef.ts';
import { readConfig, readToken } from './credentials.ts';
import { type MacosDevice, macosDevice, type Receipt } from './devices/macos.ts';
import { Hand, type HandOptions } from './hand.ts';

const run = promisify(execFile);

export const DEFAULT_HAND: HandOptions = { model: 'clef', method: 'ax_text', tau: 0.5, minMargin: 0.6, riskTau: 0.5, injectionTau: 0.5, verify: true };

type JsonSchema = { type: 'object'; properties: Record<string, unknown>; required: string[] };
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

const app = { type: 'string', description: 'Exact app name as shown by the apps tool, for example "TextEdit" or "Google Chrome".' };
const agent = { type: 'string', description: 'Optional id of the agent acting, so parallel agents get their own cursor and take turns.' };

export const TOOLS: readonly McpTool[] = [
  {
    name: 'apps',
    description:
      'List the Mac apps that are running and can be controlled. The first line names the app in front. Window titles are shown in brackets: a web app such as "Workbench" runs inside "Google Chrome", so pass "Google Chrome" as the app. To open an app that is not running, call activate with its name; do not use Spotlight.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'activate',
    description:
      'Open any installed app by name (for example "System Settings", "Notes") and bring it to the front. Use this instead of Spotlight, the Dock or Terminal. Typing only works in the frontmost app.',
    inputSchema: { type: 'object', properties: { app }, required: ['app'] },
  },
  {
    name: 'outline',
    description: "List the controls in the app's front window and menu bar: role, name and box. Use it to see what can be clicked.",
    inputSchema: { type: 'object', properties: { app }, required: ['app'] },
  },
  {
    name: 'act',
    description:
      'Click one control in the app: pass its [id] from outline (for example "e3"), or describe it in plain words (for example "the New Document button"). A small model picks the control and checks the result. It refuses when unsure, and blocks controls that look destructive unless confirm is true. Only set confirm when the user clearly asked for that destructive action.',
    inputSchema: {
      type: 'object',
      properties: { app, agent, intent: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['app', 'intent'],
    },
  },
  {
    name: 'type',
    description: 'Type text into a text field of the app, described in plain words (for example "the document body"). The app must be frontmost.',
    inputSchema: {
      type: 'object',
      properties: { app, agent, text: { type: 'string' }, into: { type: 'string' } },
      required: ['app', 'text', 'into'],
    },
  },
  {
    name: 'key',
    description:
      'Press one key in the frontmost app: return, tab, escape, space, up, down, left, right, delete, or a shortcut like cmd+n or cmd+shift+g. Use it to confirm a name you typed, close a dialog or open a menu command.',
    inputSchema: { type: 'object', properties: { app, key: { type: 'string' } }, required: ['app', 'key'] },
  },
  {
    name: 'look',
    description: 'Ask a yes/no question about what is on screen now. Returns p(yes).',
    inputSchema: { type: 'object', properties: { app, question: { type: 'string' } }, required: ['app', 'question'] },
  },
];

export interface ActionEvent {
  readonly phase: 'before' | 'after';
  readonly agent: string;
  readonly app: string;
  readonly action: string;
  readonly target?: { role: string; name: string; x: number; y: number; w: number; h: number };
  readonly ok: boolean;
  readonly code?: string;
  readonly delivery?: string;
  readonly mechanism?: string;
}

export interface Session {
  hand(app: string, agent?: string): Hand;
  helper: string;
  receipts(app: string, agent?: string): readonly Receipt[];
}

const text = (body: string, isError = false) => ({ content: [{ type: 'text', text: body }], isError });

const str = (args: Record<string, unknown>, key: string): string => {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${key} is required`);
  return value;
};

export async function callTool(session: Session, name: string, args: Record<string, unknown>) {
  if (name === 'apps') {
    const [apps, front] = await Promise.all([run(session.helper, ['apps']), run(session.helper, ['front'])]);
    return text([`In front: ${JSON.parse(front.stdout) as string}`, ...(JSON.parse(apps.stdout) as string[])].join('\n'));
  }
  if (name === 'key') {
    const policy = process.env.HAND_HEADED === '1' ? ['--headed'] : [];
    const { stdout } = await run(session.helper, ['key', str(args, 'app'), str(args, 'key').toLowerCase(), ...policy]).catch((error: { stdout?: string }) => ({
      stdout: error.stdout ?? '{"ok":false,"detail":"key failed"}',
    }));
    const outcome = JSON.parse(stdout) as { ok: boolean; detail: string };
    return text(outcome.detail, !outcome.ok);
  }
  if (name === 'activate') {
    const { stdout } = await run(session.helper, ['activate', str(args, 'app')]);
    const outcome = JSON.parse(stdout) as { ok: boolean; detail: string };
    await new Promise((resolve) => setTimeout(resolve, 400));
    return text(outcome.detail, !outcome.ok);
  }
  const appName = str(args, 'app');
  const agentId = typeof args.agent === 'string' && args.agent !== '' ? args.agent : undefined;
  const hand = session.hand(appName, agentId);
  const before = session.receipts(appName, agentId).length;
  const withReceipts = (body: string) => {
    const fresh = session.receipts(appName, agentId).slice(before);
    if (fresh.length === 0) return text(body);
    const lines = fresh.map(
      (r) =>
        `${r.action} ${r.target ? `${r.target.role} "${r.target.name}"` : ''}: ${r.outcome.delivery ?? '?'} via ${r.outcome.mechanism ?? '?'}${r.outcome.code ? ` (${r.outcome.code})` : ''}`,
    );
    return text(`${body}\nReceipts:\n${lines.join('\n')}`);
  };
  if (name === 'outline') return text(await hand.outline());
  const target = (key: string) => (typeof args.id === 'string' && args.id ? args.id : str(args, key));
  if (name === 'act') return withReceipts(await hand.act(target('intent'), args.confirm === true));
  if (name === 'type') return withReceipts(await hand.type(str(args, 'text'), target('into')));
  if (name === 'look') return text(await hand.look(str(args, 'question')));
  return text(`unknown tool ${name}`, true);
}

export function defaultHelper(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = process.env.DO_AX_HELPER ?? join(here, '..', 'native', 'ax');
  if (!existsSync(candidate)) throw new Error(`accessibility helper not found at ${candidate}; build it with swiftc -O native/ax.swift -o native/ax`);
  return candidate;
}

export function makeSession(transport: Transport, helper: string, opts: HandOptions = DEFAULT_HAND, notify: (event: ActionEvent) => void = () => {}): Session {
  const hands = new Map<string, { hand: Hand; device: MacosDevice }>();
  const entry = (name: string, agentId = 'agent') => {
    const key = `${agentId}\u0000${name}`;
    const existing = hands.get(key);
    if (existing) return existing;
    const device = macosDevice({
      helper,
      app: name,
      agent: agentId,
      headed: process.env.HAND_HEADED === '1',
      allowMouse: process.env.HAND_HEADED === '1',
      onAction: ({ phase, receipt }) =>
        notify({
          phase,
          agent: agentId,
          app: name,
          action: receipt.action,
          target: receipt.target,
          ok: receipt.outcome.ok,
          code: receipt.outcome.code,
          delivery: receipt.outcome.delivery,
          mechanism: receipt.outcome.mechanism,
        }),
    });
    const created = { hand: new Hand(transport, device, opts), device };
    hands.set(key, created);
    return created;
  };
  return {
    helper,
    hand: (name, agentId) => entry(name, agentId).hand,
    receipts: (name, agentId) => entry(name, agentId).device.receipts,
  };
}

export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  const extra = error as Error & { stderr?: unknown; cmd?: unknown; status?: unknown; body?: unknown };
  if (typeof extra.status === 'number') return `${error.name} ${extra.status}: ${String(extra.body ?? '').slice(0, 400)}`;
  const stderr = typeof extra.stderr === 'string' ? extra.stderr.trim() : '';
  return [error.message || error.name, stderr, typeof extra.cmd === 'string' ? `(${extra.cmd})` : ''].filter(Boolean).join(' ').slice(0, 600);
};

type Rpc = { jsonrpc: '2.0'; id?: number | string; method: string; params?: Record<string, unknown> };

export async function handle(session: () => Session, message: Rpc): Promise<unknown | undefined> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result });
  if (message.method === 'initialize')
    return reply({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'hand', version: '0.1.0' } });
  if (message.method === 'tools/list') return reply({ tools: TOOLS });
  if (message.method === 'tools/call') {
    const params = message.params ?? {};
    const name = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    try {
      return reply(await callTool(session(), name, args));
    } catch (error) {
      return reply(text(`hand error: ${describeError(error)}`, true));
    }
  }
  if (message.method === 'ping') return reply({});
  if (message.id === undefined) return undefined;
  return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `method not found: ${message.method}` } };
}

export function serve(session: () => Session): void {
  const lines = createInterface({ input: process.stdin });
  lines.on('line', async (line) => {
    if (line.trim() === '') return;
    let message: Rpc;
    try {
      message = JSON.parse(line) as Rpc;
    } catch {
      return;
    }
    const response = await handle(session, message);
    if (response !== undefined) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

if (import.meta.main) {
  let cached: Session | undefined;
  serve(() => {
    cached ??= makeSession(gatewayTransport({ ...readConfig(), token: readToken() }), defaultHelper(), DEFAULT_HAND, (event) =>
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', logger: 'hand.action', data: event } })}\n`,
      ),
    );
    return cached;
  });
}
