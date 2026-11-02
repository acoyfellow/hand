import type { Device } from '../hand.ts';
import { type Box, type Candidate, center } from '../perceive.ts';

export interface Cdp {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
}

export interface BrowserDeviceOptions {
  readonly settleMs?: number;
  readonly jpegQuality?: number;
}

const INTERACTIVE = new Set([
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
]);

const SET_VALUE = `function(v){
  const want = String(v).trim().toLowerCase();
  if (this.tagName === 'SELECT') {
    const o = [...this.options].find((o) => o.text.trim().toLowerCase() === want || o.value.toLowerCase() === want);
    if (!o) return false;
    this.value = o.value;
  } else { this.value = v; }
  this.dispatchEvent(new Event('input', { bubbles: true }));
  this.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}`;

const FOCUS_AND_SELECT = `function(){
  this.focus();
  if (typeof this.select === 'function') this.select();
  else if (this.isContentEditable) document.getSelection().selectAllChildren(this);
  return document.activeElement === this || this.contains(document.activeElement);
}`;

const READ_VALUE = `function(){ return this.isContentEditable ? this.innerText : String(this.value ?? ''); }`;

const MARKS = `(boxes) => {
  const root = document.createElement('div');
  root.id = '__do_overlay';
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  boxes.forEach((c, i) => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + c.h + 'px;outline:2px solid #ff1f8f;';
    const l = document.createElement('div');
    l.textContent = c.label ?? String(i + 1);
    l.style.cssText = 'position:fixed;left:' + Math.max(0, c.x - 2) + 'px;top:' + Math.max(0, c.y - 13) + 'px;background:#ff1f8f;color:#fff;font:700 11px/13px monospace;padding:0 3px;border-radius:3px;';
    root.append(b, l);
  });
  document.body.append(root);
}`;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function callOn(cdp: Cdp, backendNodeId: number, functionDeclaration: string, args: unknown[] = []): Promise<unknown> {
  const { object } = await cdp.send('DOM.resolveNode', { backendNodeId });
  const result = await cdp.send('Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration,
    arguments: args.map((value) => ({ value })),
    returnByValue: true,
  });
  return result.result.value;
}

async function evaluate(cdp: Cdp, expression: string): Promise<unknown> {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

export async function enableBrowser(cdp: Cdp): Promise<void> {
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
}

export async function viewportOf(cdp: Cdp): Promise<{ width: number; height: number }> {
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const view = metrics.cssVisualViewport ?? metrics.layoutViewport;
  return { width: Math.round(view.clientWidth), height: Math.round(view.clientHeight) };
}

async function boxOf(cdp: Cdp, backendNodeId: number): Promise<Box | undefined> {
  try {
    const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId });
    const quad = model.border as number[];
    const xs = [quad[0], quad[2], quad[4], quad[6]] as number[];
    const ys = [quad[1], quad[3], quad[5], quad[7]] as number[];
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  } catch {
    return undefined;
  }
}

const insideDialog = (cdp: Cdp, backendNodeId: number) =>
  callOn(cdp, backendNodeId, 'function(){return !!this.closest("[role=dialog]")}').then(
    (value) => value === true,
    () => false,
  );

export async function browserCandidates(cdp: Cdp, viewport: { width: number; height: number }): Promise<Candidate[]> {
  await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const modal = (await evaluate(cdp, '!!document.querySelector("[role=dialog]")')) === true;
  const found: Candidate[] = [];
  for (const node of nodes) {
    if (node.ignored || !node.backendDOMNodeId) continue;
    const role = node.role?.value as string;
    if (!INTERACTIVE.has(role)) continue;
    const box = await boxOf(cdp, node.backendDOMNodeId);
    if (!box || box.w < 2 || box.h < 2 || box.x + box.w < 0 || box.y + box.h < 0 || box.x > viewport.width || box.y > viewport.height) continue;
    const name = String(node.name?.value ?? '')
      .trim()
      .slice(0, 80);
    found.push({ id: '', role, name, backendNodeId: node.backendDOMNodeId, ...box });
  }
  const visible = modal
    ? (await Promise.all(found.map(async (c) => ((await insideDialog(cdp, c.backendNodeId)) ? c : null)))).filter((c) => c !== null)
    : found;
  visible.sort((a, b) => a.y - b.y || a.x - b.x);
  return visible.map((c, i) => ({ ...c, id: `e${i + 1}` }));
}

export async function browserScreenshot(cdp: Cdp, clip?: Box, quality = 80): Promise<string> {
  const params: Record<string, unknown> = { format: 'jpeg', quality };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 };
  const { data } = await cdp.send('Page.captureScreenshot', params);
  return `data:image/jpeg;base64,${data}`;
}

async function withOverlay(cdp: Cdp, boxes: (Box & { label?: string })[], clip?: Box): Promise<string> {
  await evaluate(cdp, `(${MARKS})(${JSON.stringify(boxes)})`);
  try {
    return await browserScreenshot(cdp, clip);
  } finally {
    await evaluate(cdp, 'document.getElementById("__do_overlay")?.remove()');
  }
}

export async function browserClick(cdp: Cdp, point: { x: number; y: number }): Promise<void> {
  const base = { x: point.x, y: point.y, button: 'left', clickCount: 1 };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
}

export async function browserType(cdp: Cdp, c: Candidate, text: string): Promise<void> {
  const focused = await callOn(cdp, c.backendNodeId, FOCUS_AND_SELECT);
  if (focused !== true) await browserClick(cdp, center(c));
  await cdp.send('Input.insertText', { text });
  const value = String(await callOn(cdp, c.backendNodeId, READ_VALUE));
  if (!value.includes(text)) throw new Error(`typed into ${c.role} "${c.name}" but the field reads "${value.slice(0, 80)}"`);
}

export async function browserSetValue(cdp: Cdp, c: Candidate, value: string): Promise<boolean> {
  return (await callOn(cdp, c.backendNodeId, SET_VALUE, [value])) === true;
}

export async function browserSelectOptions(cdp: Cdp, c: Candidate): Promise<string[]> {
  const value = await callOn(cdp, c.backendNodeId, 'function(){ return this.tagName === "SELECT" ? [...this.options].map((o) => o.text) : []; }');
  return Array.isArray(value) ? value.map(String) : [];
}

export async function browserDevice(cdp: Cdp, opts: BrowserDeviceOptions = {}): Promise<Device> {
  await enableBrowser(cdp);
  let viewport = await viewportOf(cdp);
  const settleMs = opts.settleMs ?? 150;
  return {
    viewport: () => viewport,
    screenshot: (clip) => browserScreenshot(cdp, clip, opts.jpegQuality),
    marked: (cands) => withOverlay(cdp, cands),
    gridShot: async (region, n = 4) => {
      const cells: Record<string, Box> = {};
      const cw = region.w / n;
      const ch = region.h / n;
      for (let r = 0; r < n; r++)
        for (let col = 0; col < n; col++) cells[`${String.fromCharCode(65 + r)}${col + 1}`] = { x: region.x + col * cw, y: region.y + r * ch, w: cw, h: ch };
      const img = await withOverlay(
        cdp,
        Object.entries(cells).map(([label, box]) => ({ ...box, label })),
        region,
      );
      return { img, cells };
    },
    candidates: async () => {
      viewport = await viewportOf(cdp);
      return browserCandidates(cdp, viewport);
    },
    click: (point) => browserClick(cdp, point),
    typeInto: (c, text) => browserType(cdp, c, text),
    setValue: (c, value) => browserSetValue(cdp, c, value),
    settle: () => wait(settleMs),
  };
}
