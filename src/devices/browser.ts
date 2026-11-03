import { readFileSync } from 'node:fs';
import type { Device } from '../hand.ts';
import { type Box, type Candidate, center } from '../perceive.ts';

export interface Cdp {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
}

export interface BrowserDeviceOptions {
  readonly settleMs?: number;
  readonly jpegQuality?: number;
  readonly showCursor?: boolean;
}

const SCREEN_TEXT = `(() => {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
  const lines = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || skip.has(parent.tagName) || parent.closest('.hand-cursor,.hand-ring,[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(parent);
      if (style.visibility === 'hidden' || style.display === 'none') return NodeFilter.FILTER_REJECT;
      const box = parent.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let last = null;
  let line = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const block = node.parentElement.closest('p,li,tr,h1,h2,h3,h4,h5,h6,label,button,a,div,section,article,td,th,dt,dd');
    const piece = node.textContent.replace(/\\s+/g, ' ').trim();
    if (block !== last && line) { lines.push(line); line = ''; }
    line = line ? line + ' ' + piece : piece;
    last = block;
  }
  if (line) lines.push(line);
  const unique = [];
  for (const entry of lines) if (entry !== unique[unique.length - 1]) unique.push(entry);
  return unique.join('\\n').slice(0, 6000);
})()`;

const CURSOR_SCRIPT = readFileSync(new URL('../cursor.js', import.meta.url), 'utf8');
const HIDE_CURSOR = `document.querySelectorAll('.hand-cursor,.hand-ring').forEach((el) => { el.dataset.handVisibility = el.style.visibility; el.style.visibility = 'hidden'; })`;
const RESTORE_CURSOR = `document.querySelectorAll('.hand-cursor,.hand-ring').forEach((el) => { el.style.visibility = el.dataset.handVisibility || ''; })`;

async function browserShow(cdp: Cdp, target: { x: number; y: number; label: string; p?: number }): Promise<void> {
  await cdp.send('Runtime.evaluate', {
    expression: `${CURSOR_SCRIPT}; window.__handCursor.click(${target.x}, ${target.y}, ${JSON.stringify(target.label)}, ${target.p ?? 'undefined'})`,
    awaitPromise: true,
  });
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

const CLICK_EVENTS = new Set(['click', 'mousedown', 'mouseup', 'pointerdown']);

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

const CLICKABLE_SCAN = `(() => {
  const native = 'a[href],button,input,select,textarea,[role],[contenteditable=""],[contenteditable=true]';
  return [...document.querySelectorAll('body *')].filter((el) => {
    if (el.closest(native)) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (!(typeof el.onclick === 'function' || el.hasAttribute('onclick') || style.cursor === 'pointer')) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  });
})()`;

const NEAR_LABEL = `function(){
  const own = (this.getAttribute('placeholder') || this.getAttribute('title') || '').trim();
  if (own) return own;
  if (this.id) { const l = document.querySelector('label[for="' + CSS.escape(this.id) + '"]'); if (l && l.innerText.trim()) return l.innerText.trim(); }
  let node = this;
  for (let depth = 0; depth < 4 && node; depth++) {
    let prev = node.previousElementSibling;
    while (prev) { const t = (prev.innerText || '').trim(); if (t && t.length <= 60) return t; prev = prev.previousElementSibling; }
    node = node.parentElement;
  }
  return '';
}`;

const SHAPE_NAME = `function(){
  const text = (this.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
  const label = (this.getAttribute('title') || this.getAttribute('aria-label') || this.id || this.getAttribute('class') || '').trim();
  if (text) return label && label !== text && text.length <= 3 ? label + ' ' + text : text;
  const fill = this.getAttribute('fill');
  const shape = ['circle', 'rect', 'polygon', 'path', 'ellipse', 'line'].includes(this.tagName.toLowerCase()) ? this.tagName.toLowerCase() : '';
  return [label, shape, fill && fill !== 'none' ? fill : ''].filter(Boolean).join(' ') || this.tagName.toLowerCase();
}`;

async function clickableNodes(cdp: Cdp): Promise<number[]> {
  const listed = await cdp.send('Runtime.evaluate', { expression: CLICKABLE_SCAN, returnByValue: false });
  const arrayId = listed.result?.objectId;
  if (!arrayId) return [];
  const { result } = await cdp.send('Runtime.getProperties', { objectId: arrayId, ownProperties: true });
  const ids: number[] = [];
  for (const property of result as { name: string; value?: { objectId?: string } }[]) {
    if (!/^\d+$/.test(property.name) || !property.value?.objectId) continue;
    const { node } = await cdp.send('DOM.describeNode', { objectId: property.value.objectId });
    if (node?.backendNodeId) ids.push(node.backendNodeId);
  }
  return ids;
}

async function listenerNodes(cdp: Cdp): Promise<number[]> {
  const queue = await cdp.send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('body *')].filter((el) => !el.closest('a[href],button,input,select,textarea,[role]') && el.getBoundingClientRect().width >= 4)`,
    returnByValue: false,
  });
  if (!queue.result?.objectId) return [];
  const { result: items } = await cdp.send('Runtime.getProperties', { objectId: queue.result.objectId, ownProperties: true });
  const listened: number[] = [];
  for (const property of items as { name: string; value?: { objectId?: string } }[]) {
    if (!/^\d+$/.test(property.name) || !property.value?.objectId) continue;
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: property.value.objectId, depth: 0 });
    if (!(listeners as { type: string }[]).some((listener) => CLICK_EVENTS.has(listener.type))) continue;
    const { node } = await cdp.send('DOM.describeNode', { objectId: property.value.objectId });
    if (node?.backendNodeId) listened.push(node.backendNodeId);
  }
  return listened;
}

const inView = (box: Box, viewport: { width: number; height: number }) =>
  box.w >= 2 && box.h >= 2 && box.x + box.w >= 0 && box.y + box.h >= 0 && box.x <= viewport.width && box.y <= viewport.height;

export async function browserCandidates(cdp: Cdp, viewport: { width: number; height: number }): Promise<Candidate[]> {
  await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const modal = (await evaluate(cdp, '!!document.querySelector("[role=dialog]")')) === true;
  const found: Candidate[] = [];
  const seen = new Set<number>();
  for (const node of nodes) {
    if (node.ignored || !node.backendDOMNodeId) continue;
    const role = node.role?.value as string;
    if (!INTERACTIVE.has(role)) continue;
    const box = await boxOf(cdp, node.backendDOMNodeId);
    if (!box || !inView(box, viewport)) continue;
    let name = String(node.name?.value ?? '')
      .trim()
      .slice(0, 80);
    if (!name && (role === 'textbox' || role === 'searchbox' || role === 'combobox' || role === 'spinbutton'))
      name = String(await callOn(cdp, node.backendDOMNodeId, NEAR_LABEL).catch(() => '')).slice(0, 80);
    seen.add(node.backendDOMNodeId);
    found.push({ id: '', role, name, backendNodeId: node.backendDOMNodeId, ...box });
  }
  const extra = [...new Set([...(await clickableNodes(cdp).catch(() => [])), ...(await listenerNodes(cdp).catch(() => []))])];
  for (const backendNodeId of extra) {
    if (seen.has(backendNodeId)) continue;
    const box = await boxOf(cdp, backendNodeId);
    if (!box || !inView(box, viewport)) continue;
    const name = String(await callOn(cdp, backendNodeId, SHAPE_NAME).catch(() => '')).slice(0, 80);
    seen.add(backendNodeId);
    found.push({ id: '', role: 'clickable', name, backendNodeId, ...box });
  }
  const clickables = found.filter((c) => c.role === 'clickable');
  const sameAsChild = (c: Candidate) =>
    c.role === 'clickable' &&
    clickables.some(
      (child) => child !== c && child.name === c.name && c.x <= child.x && c.y <= child.y && c.x + c.w >= child.x + child.w && c.y + c.h >= child.y + child.h,
    );
  const insideOther = (c: Candidate) =>
    sameAsChild(c) ||
    (c.role === 'clickable' &&
      found.some(
        (other) =>
          other !== c && other.role !== 'clickable' && other.x <= c.x && other.y <= c.y && other.x + other.w >= c.x + c.w && other.y + other.h >= c.y + c.h,
      ));
  const kept = found.filter((c) => !insideOther(c));
  const visible = modal ? (await Promise.all(kept.map(async (c) => ((await insideDialog(cdp, c.backendNodeId)) ? c : null)))).filter((c) => c !== null) : kept;
  visible.sort((a, b) => a.y - b.y || a.x - b.x);
  return visible.map((c, i) => ({ ...c, id: `e${i + 1}` }));
}

export async function browserScreenshot(cdp: Cdp, clip?: Box, quality = 80): Promise<string> {
  const params: Record<string, unknown> = { format: 'jpeg', quality };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 };
  await evaluate(cdp, HIDE_CURSOR);
  try {
    const { data } = await cdp.send('Page.captureScreenshot', params);
    return `data:image/jpeg;base64,${data}`;
  } finally {
    await evaluate(cdp, RESTORE_CURSOR);
  }
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
  if (String(await callOn(cdp, c.backendNodeId, READ_VALUE)).includes(text)) return;
  await browserSetValue(cdp, c, text);
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
    show: opts.showCursor ? (target) => browserShow(cdp, target) : undefined,
    text: async () => String(await evaluate(cdp, SCREEN_TEXT)),
  };
}
