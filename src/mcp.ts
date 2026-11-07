import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { gatewayTransport, type Transport } from './clef.ts';
import { readConfig, readToken } from './credentials.ts';
import { signedInConfig } from './grant.ts';
import { type MacosDevice, macosDevice, type Receipt } from './devices/macos.ts';
import { Hand, type HandOptions } from './hand.ts';
import { helperOrBuild } from './helper.ts';

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
    description:
      'Type text into a text field of the app, by its [id] from outline (fastest) or described in plain words. By default the text replaces everything in the field. To add to one line of a longer text (a note, a document), pass after with text from that line: hand puts the text at the end of that line, checks nothing else changed,. To tick a checklist item afterwards, use check with line. Set mode to "insert" to type wherever the cursor already is.',
    inputSchema: {
      type: 'object',
      properties: {
        app,
        agent,
        text: { type: 'string' },
        into: { type: 'string' },
        after: { type: 'string' },
        mode: { type: 'string', enum: ['replace', 'insert'] },
      },
      required: ['app', 'text', 'into'],
    },
  },
  {
    name: 'key',
    description:
      'Press one key in the frontmost app: return, tab, escape, space, up, down, left, right, delete, or a shortcut like cmd+n or cmd+shift+g. Use it to confirm a name you typed, close a dialog or open a menu command. A shortcut is usually much faster than opening a menu: in Notes, cmd+shift+l starts a checklist and cmd+shift+u checks or unchecks the checklist item the cursor is on; in a browser, cmd+l focuses the address bar.',
    inputSchema: { type: 'object', properties: { app, key: { type: 'string' } }, required: ['app', 'key'] },
  },
  {
    name: 'steps',
    description:
      'Run several actions in a row in one call, when you already know what comes next: for example type into a field, press return, choose a menu item. Each step is one of act, type, key, menu, check or select_text, with the same fields as that tool. Steps that name an [id] skip the model and run at once. It stops at the first step that fails, is refused or is unsure, and returns what happened at every step.',
    inputSchema: {
      type: 'object',
      properties: {
        app,
        agent,
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', enum: ['act', 'type', 'key', 'menu', 'check', 'select_text'] },
              intent: { type: 'string' },
              text: { type: 'string' },
              into: { type: 'string' },
              after: { type: 'string' },
              key: { type: 'string' },
              path: { type: 'array', items: { type: 'string' } },
              on: { type: 'boolean' },
              line: { type: 'string' },
              from: { type: 'string' },
              through: { type: 'string' },
            },
            required: ['tool'],
          },
        },
      },
      required: ['app', 'steps'],
    },
  },
  {
    name: 'menu',
    description:
      'Choose a command from the app\'s menu bar by its exact path, for example ["Format", "Checklist"] or ["File", "New Folder"]. Faster and safer than clicking through menus. Says so if the item is missing (and lists what is there) or greyed out.',
    inputSchema: { type: 'object', properties: { app, agent, path: { type: 'array', items: { type: 'string' } } }, required: ['app', 'path'] },
  },
  {
    name: 'check',
    description:
      'Turn a check box or switch on (or off with on=false). Reads it first and does nothing if it is already right, then reads it back. Use this instead of act for check boxes so a second call never flips it back. For a checklist item inside a text (a Notes checklist), pass the text field as into and line with text from that item: hand ticks that line and reads it back.',
    inputSchema: {
      type: 'object',
      properties: { app, agent, into: { type: 'string' }, on: { type: 'boolean' }, line: { type: 'string' } },
      required: ['app', 'into'],
    },
  },
  {
    name: 'select_text',
    description:
      'Select text inside a text field, from the first occurrence of "from" through the end of "through" (or just "from"). Use it before a menu command that works on the selection, for example select two lines then menu ["Format", "Checklist"].',
    inputSchema: {
      type: 'object',
      properties: { app, agent, into: { type: 'string' }, from: { type: 'string' }, through: { type: 'string' } },
      required: ['app', 'into', 'from'],
    },
  },
  {
    name: 'expect',
    description:
      "Check a control's real state without changing anything: checked, enabled, an exact value, or a value that contains some text. Answers satisfied, unsatisfied or unknown (unknown never means success). Use it to prove a step worked before you call done.",
    inputSchema: {
      type: 'object',
      properties: {
        app,
        into: { type: 'string' },
        checked: { type: 'boolean' },
        enabled: { type: 'boolean' },
        value: { type: 'string' },
        contains: { type: 'string' },
      },
      required: ['app', 'into'],
    },
  },
  {
    name: 'read',
    description:
      'Read a text field line by line, by its [id] or plain words. Checklist items show as [ ] (unticked) or [x] (ticked), read from the app itself, so use this, not look, to see whether lines are a checklist or ticked.',
    inputSchema: { type: 'object', properties: { app, into: { type: 'string' } }, required: ['app', 'into'] },
  },
  {
    name: 'set_value',
    description:
      'Set a control to a value directly: choose an option in a popup or dropdown by its text, or set a slider, stepper, date or plain text field. Reads the value back.',
    inputSchema: { type: 'object', properties: { app, agent, into: { type: 'string' }, value: { type: 'string' } }, required: ['app', 'into', 'value'] },
  },
  {
    name: 'pointer',
    description:
      'Mouse gestures on a control by its [id] (or plain words): double_click (open a file or folder in Finder), right_click (context menu), or drag onto another control given as to (move a file into a folder). Needs headed mode.',
    inputSchema: {
      type: 'object',
      properties: { app, agent, action: { type: 'string', enum: ['double_click', 'right_click', 'drag'] }, into: { type: 'string' }, to: { type: 'string' } },
      required: ['app', 'action', 'into'],
    },
  },
  {
    name: 'clipboard',
    description: 'Read the clipboard, or write text to it with text set. Use it to copy between apps without selecting and pressing keys.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: [] },
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

type ToolReply = { content: { type: 'text'; text: string }[]; isError: boolean };
const text = (body: string, isError = false): ToolReply => ({ content: [{ type: 'text', text: body }], isError });

const str = (args: Record<string, unknown>, key: string): string => {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${key} is required`);
  return value;
};

const STOP = /^(UNSURE|BLOCKED|STALE_REF|EDIT FAILED|FAILED|No text fields|No matching)|did nothing|failed|not found|greyed out/i;
const STEP_TOOLS = ['act', 'type', 'key', 'menu', 'check', 'select_text'];

async function runSteps(session: Session, args: Record<string, unknown>): Promise<ToolReply> {
  const steps = Array.isArray(args.steps) ? (args.steps as Record<string, unknown>[]) : [];
  const lines: string[] = [];
  for (const [index, step] of steps.entries()) {
    const tool = typeof step.tool === 'string' ? step.tool : '';
    if (!STEP_TOOLS.includes(tool)) {
      lines.push(`${index + 1}. ${tool || '?'}: not a step tool; stopped.`);
      return text(lines.join('\n'), true);
    }
    const result: ToolReply = await callTool(session, tool, { ...step, app: args.app, agent: args.agent });
    const body =
      result.content
        .map((part) => part.text)
        .join('\n')
        .split('\nReceipts:')[0] ?? '';
    lines.push(`${index + 1}. ${tool}: ${body}`);
    if (result.isError || STOP.test(body)) {
      lines.push(`Stopped after step ${index + 1} of ${steps.length}.`);
      return text(lines.join('\n'), result.isError === true);
    }
  }
  return text(lines.join('\n'));
}

export async function callTool(session: Session, name: string, args: Record<string, unknown>): Promise<ToolReply> {
  if (name === 'steps') return runSteps(session, args);
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
  if (name === 'menu') {
    const path = Array.isArray(args.path) ? args.path.map(String) : [];
    if (path.length < 2) return text('path needs the menu and the item, for example ["Format", "Checklist"]; menu opens nothing by itself', true);
    const { stdout } = await run(session.helper, ['menu', str(args, 'app'), ...path]).catch((error: { stdout?: string }) => ({
      stdout: error.stdout ?? '{"ok":false,"detail":"menu failed"}',
    }));
    const outcome = JSON.parse(stdout) as { ok: boolean; detail: string };
    return text(outcome.detail, !outcome.ok);
  }
  if (name === 'clipboard') {
    const write = typeof args.text === 'string';
    const { stdout } = await run(session.helper, write ? ['clipboard', 'write', String(args.text)] : ['clipboard']);
    const outcome = JSON.parse(stdout) as { ok: boolean; detail: string };
    return text(write ? outcome.detail : `Clipboard: ${JSON.stringify(outcome.detail)}`, !outcome.ok);
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
  if (name === 'type' && typeof args.after === 'string' && args.after !== '')
    return withReceipts(await hand.typeAfter(str(args, 'text'), target('into'), args.after));
  if (name === 'type') return withReceipts(await hand.type(str(args, 'text'), target('into'), args.mode === 'insert' ? 'insert' : 'replace'));
  if (name === 'check' && typeof args.line === 'string' && args.line !== '') return text(await hand.tickLine(target('into'), args.line, args.on !== false));
  if (name === 'check') return withReceipts(await hand.setChecked(target('into'), args.on !== false));
  if (name === 'read') return text(await hand.readLines(target('into')));
  if (name === 'set_value') return withReceipts(await hand.select(str(args, 'value'), target('into')));
  if (name === 'pointer') {
    const action = str(args, 'action');
    if (!['double_click', 'right_click', 'drag'].includes(action)) return text('action must be double_click, right_click or drag', true);
    return text(await hand.pointer(action as 'double_click' | 'right_click' | 'drag', target('into'), typeof args.to === 'string' ? args.to : undefined));
  }
  if (name === 'select_text') return text(await hand.selectText(target('into'), str(args, 'from'), typeof args.through === 'string' ? args.through : ''));
  if (name === 'expect')
    return text(
      await hand.expect(target('into'), {
        ...(typeof args.checked === 'boolean' ? { checked: args.checked } : {}),
        ...(typeof args.enabled === 'boolean' ? { enabled: args.enabled } : {}),
        ...(typeof args.value === 'string' ? { value: args.value } : {}),
        ...(typeof args.contains === 'string' ? { contains: args.contains } : {}),
      }),
    );
  if (name === 'look') return text(await hand.look(str(args, 'question')));
  return text(`unknown tool ${name}`, true);
}

export function defaultHelper(): string {
  return helperOrBuild();
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

export const credentialsForServer = () => {
  const signedIn = process.env.HAND_TOKEN ? undefined : signedInConfig();
  return signedIn ?? { ...readConfig(), token: readToken() };
};

export function startServer(): void {
  let cached: Session | undefined;
  serve(() => {
    cached ??= makeSession(gatewayTransport(credentialsForServer()), defaultHelper(), DEFAULT_HAND, (event) =>
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', logger: 'hand.action', data: event } })}\n`,
      ),
    );
    return cached;
  });
}

if (import.meta.main) startServer();
