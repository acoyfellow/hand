import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Device } from '../hand.ts';
import { type Box, type Candidate, inside } from '../perceive.ts';

const run = promisify(execFile);

interface AxNode {
  id: string;
  role: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  path: number[];
  ref: string;
}
interface AxSnapshot {
  app: string;
  candidates: AxNode[];
}
export type Delivery = 'delivered_verified' | 'delivered_unverified' | 'not_delivered';
export type Mechanism = 'semantic_api' | 'physical_synthetic' | 'none';

export interface AxOutcome {
  ok: boolean;
  detail: string;
  code?: string;
  delivery?: Delivery;
  mechanism?: Mechanism;
  retrySafe?: boolean;
  agent?: string;
  leaseWaitMs?: number;
  after?: string;
}

export interface Receipt {
  readonly action: string;
  readonly target?: { role: string; name: string; x: number; y: number; w: number; h: number };
  readonly outcome: AxOutcome;
}

const ROLE_NAMES: Record<string, string> = {
  AXButton: 'button',
  AXLink: 'link',
  AXTextField: 'textbox',
  AXTextArea: 'textbox',
  AXSearchField: 'searchbox',
  AXCheckBox: 'checkbox',
  AXRadioButton: 'radio',
  AXPopUpButton: 'combobox',
  AXComboBox: 'combobox',
  AXMenuItem: 'menuitem',
  AXMenuButton: 'button',
  AXTab: 'tab',
  AXSlider: 'slider',
  AXIncrementor: 'spinbutton',
  AXDisclosureTriangle: 'button',
  AXSwitch: 'switch',
};

export interface MacosDeviceOptions {
  readonly helper: string;
  readonly app?: string;
  readonly display?: { width: number; height: number };
  readonly allowMouse?: boolean;
  readonly headed?: boolean;
  readonly agent?: string;
  readonly onAction?: (event: { phase: 'before' | 'after'; receipt: Receipt }) => void;
}

export interface MacosCandidate extends Candidate {
  readonly path: string;
  readonly ref: string;
}

export function toCandidate(node: AxNode, index: number): MacosCandidate {
  return {
    id: node.id,
    role: ROLE_NAMES[node.role] ?? node.role.replace(/^AX/, '').toLowerCase(),
    name: node.name.replace(/\s+/g, ' ').trim(),
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    backendNodeId: index,
    path: node.path.join('.'),
    ref: node.ref,
  };
}

export function keepUseful(cands: MacosCandidate[]): MacosCandidate[] {
  const seen = new Set<string>();
  return cands.filter((c) => {
    if (!c.name && c.role !== 'textbox' && c.role !== 'searchbox') return false;
    const key = `${c.role}|${c.name}|${Math.round(c.x)}|${Math.round(c.y)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function smallestContaining(cands: MacosCandidate[], p: { x: number; y: number }): MacosCandidate | undefined {
  return cands.filter((c) => inside(p, c)).sort((a, b) => a.w * a.h - b.w * b.h)[0];
}

export interface MacosDevice extends Device {
  readonly lastActions: string[];
  readonly receipts: Receipt[];
  submit(c: Candidate): Promise<boolean>;
}

export function macosDevice(opts: MacosDeviceOptions): MacosDevice {
  const appArg = opts.app ?? '-';
  let last: MacosCandidate[] = [];
  const lastActions: string[] = [];
  const policy = [...(opts.headed || opts.allowMouse ? ['--headed'] : []), ...(opts.agent ? ['--agent', opts.agent] : [])];
  const helper = async <T>(...args: string[]): Promise<T> => {
    try {
      return JSON.parse((await run(opts.helper, [...args, ...policy], { maxBuffer: 64 * 1024 * 1024 })).stdout) as T;
    } catch (error) {
      const stdout = (error as { stdout?: string }).stdout;
      if (stdout?.trim().startsWith('{')) return JSON.parse(stdout) as T;
      throw error;
    }
  };
  const receipts: Receipt[] = [];
  const boxOf = (c: MacosCandidate) => ({ role: c.role, name: c.name, x: c.x, y: c.y, w: c.w, h: c.h });
  const onTarget = async (action: string, c: MacosCandidate, ...rest: string[]): Promise<AxOutcome> => {
    opts.onAction?.({ phase: 'before', receipt: { action, target: boxOf(c), outcome: { ok: true, detail: 'pending' } } });
    const outcome = await helper<AxOutcome>(action, appArg, c.path, ...rest, '--ref', c.ref).catch(
      (error: Error): AxOutcome => ({ ok: false, detail: error.message, code: 'HELPER_FAILED', delivery: 'not_delivered' }),
    );
    const receipt = { action, target: boxOf(c), outcome };
    receipts.push(receipt);
    opts.onAction?.({ phase: 'after', receipt });
    return outcome;
  };

  const capture = async (clip?: Box): Promise<string> => {
    const dir = mkdtempSync(join(tmpdir(), 'do-shot-'));
    const file = join(dir, 'shot.jpg');
    try {
      const region = clip ? ['-R', `${Math.round(clip.x)},${Math.round(clip.y)},${Math.round(clip.w)},${Math.round(clip.h)}`] : [];
      await run('screencapture', ['-x', '-t', 'jpg', ...region, file]);
      await run('sips', ['-Z', '1600', file]);
      return `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  const press = async (c: MacosCandidate): Promise<boolean> => {
    const outcome = await onTarget('press', c);
    lastActions.push(`press ${c.role} "${c.name}": ${outcome.detail}`);
    return outcome.ok;
  };

  return {
    lastActions,
    receipts,
    viewport: () => opts.display ?? { width: 1728, height: 1117 },
    screenshot: (clip) => capture(clip),
    marked: () => capture(),
    gridShot: async (region) => ({ img: await capture(region), cells: { a1: region } }),
    candidates: async () => {
      const snap = await helper<AxSnapshot>('snapshot', appArg);
      last = keepUseful(snap.candidates.map(toCandidate));
      return last;
    },
    press: async (c) => {
      const target = c as MacosCandidate;
      if (await press(target)) return;
      if (!opts.allowMouse) throw new Error(`${target.role} "${target.name}" has no accessibility press action and mouse input is off`);
      const p = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      const outcome = await helper<AxOutcome>('click', String(p.x), String(p.y));
      lastActions.push(`mouse ${outcome.detail}`);
    },
    click: async (p) => {
      const target = smallestContaining(last, p);
      if (target && (await press(target))) return;
      if (!opts.allowMouse) throw new Error(`no accessibility action for the control at ${Math.round(p.x)},${Math.round(p.y)} and mouse input is off`);
      const outcome = await helper<AxOutcome>('click', String(p.x), String(p.y));
      lastActions.push(`mouse ${outcome.detail}`);
    },
    typeInto: async (c, text) => {
      const target = c as MacosCandidate;
      if (appArg === '-') throw new Error('typing needs a named app so keystrokes go only to it');
      const readBack = async () => (await helper<AxOutcome>('value', appArg, target.path).catch(() => ({ ok: false, detail: '' }))).detail;
      const set = await onTarget('set', target, text);
      if (set.code === 'STALE_REF') throw new Error(`${target.role} "${target.name}" changed since the snapshot (STALE_REF); take a new outline`);
      lastActions.push(`set value: ${set.detail}`);
      if (set.ok && (await readBack()).includes(text)) {
        lastActions.push('read back: field contains the text');
        return;
      }
      if (!opts.headed)
        throw new Error(
          `could not set ${target.role} "${target.name}" through accessibility (${set.detail}), and keystrokes are off unless the device is headed`,
        );
      const focused = await onTarget('focus', target);
      lastActions.push(`focus ${target.role} "${target.name}": ${focused.detail}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const typed = await helper<AxOutcome>('type', appArg, text);
      lastActions.push(typed.detail);
      if (!typed.ok) throw new Error(`could not type: ${typed.detail}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await helper<AxOutcome>('key', appArg, 'escape').catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!(await readBack()).includes(text)) {
        lastActions.push('read back: text missing');
        throw new Error(`typed into ${target.role} "${target.name}" but the field does not contain the text afterwards (keystrokes did not land)`);
      }
      lastActions.push('read back: field contains the typed text');
    },
    setValue: async (c, value) => {
      const target = c as MacosCandidate;
      const outcome = await onTarget('set', target, value);
      lastActions.push(`set ${target.role} "${target.name}": ${outcome.detail}`);
      return outcome.ok;
    },
    submit: async (c) => {
      const target = c as MacosCandidate;
      if (appArg === '-') return false;
      lastActions.push(`submit ${target.role} "${target.name}"`);
      const key = await helper<AxOutcome>('key', appArg, 'return').catch(() => ({ ok: false, detail: 'key failed' }));
      lastActions.push(`return key: ${key.detail}`);
      return key.ok;
    },
    settle: () => new Promise((resolve) => setTimeout(resolve, 400)),
  };
}
