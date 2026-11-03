export const STYLES = ['line', 'filled'];
export const PROFILES = ['natural', 'arch', 'index', 'even'];
export const THUMBS = ['out', 'curl', 'none'];
export const DOTS = ['side', 'above', 'tip', 'corner', 'palm', 'none'];

export const PRESETS = {
  wave: { style: 'line', fingers: 3, profile: 'natural', fingerLen: 26, root: 0, palmWidth: 50, leftLen: 10, rightLen: 26, thumb: 'out', curl: 7, weight: 9, dot: 'corner', dotSize: 6, tilt: -6, fan: 9, knuckle: 5, thumbAngle: 42 },
  c3: { style: 'line', fingers: 3, profile: 'arch', fingerLen: 24, root: 4, palmWidth: 52, leftLen: 18, rightLen: 30, thumb: 'none', curl: 7, weight: 9, dot: 'corner', dotSize: 5.5, tilt: 0, fan: 4, knuckle: 3, thumbAngle: 40 },
  c2: { style: 'line', fingers: 2, profile: 'index', fingerLen: 28, root: 3, palmWidth: 48, leftLen: 8, rightLen: 26, thumb: 'curl', curl: 7, weight: 9, dot: 'side', dotSize: 5.5, tilt: 0, fan: 6, knuckle: 3, thumbAngle: 40 },
  palm: { style: 'filled', fingers: 4, profile: 'natural', fingerLen: 22, root: 0, palmWidth: 48, leftLen: 0, rightLen: 0, thumb: 'out', curl: 7, weight: 10, dot: 'above', dotSize: 6, tilt: -5, fan: 8, knuckle: 5, thumbAngle: 46 },
  d2: { style: 'filled', fingers: 3, profile: 'arch', fingerLen: 18, root: 0, palmWidth: 50, leftLen: 0, rightLen: 0, thumb: 'out', curl: 7, weight: 13, dot: 'palm', dotSize: 6.5, tilt: 0, fan: 7, knuckle: 4, thumbAngle: 44 },
};

export const COLORS = { ink: '#18181b', accent: '#2E9BF0', paper: '#ffffff', night: '#141416', nightInk: '#ececee' };

export function hashOf(text) {
  let value = 0x811c9dc5;
  for (const character of String(text)) {
    value ^= character.charCodeAt(0);
    value += (value << 1) + (value << 4) + (value << 7) + (value << 8) + (value << 24);
  }
  return Math.abs(value >>> 0);
}

function roll(seed, slot, span) {
  let value = (seed ^ Math.imul(slot, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) % span;
}

const pick = (seed, slot, list) => list[roll(seed, slot, list.length)];
const between = (seed, slot, low, high) => low + roll(seed, slot, high - low + 1);

export function generate(seedText, style) {
  const seed = hashOf(seedText);
  const chosen = style ?? pick(seed, 1, STYLES);
  const palmWidth = between(seed, 2, 44, 56);
  const weight = (palmWidth * between(seed, 3, 16, 22)) / 100;
  const shared = {
    profile: pick(seed, 5, ['natural', 'natural', 'arch', 'index']),
    fingerLen: (palmWidth * between(seed, 6, 42, 58)) / 100,
    palmWidth,
    thumb: pick(seed, 7, ['out', 'out', 'curl', 'none']),
    curl: weight * 0.75,
    weight,
    dotSize: weight * 0.66,
    tilt: pick(seed, 10, [-7, -5, -3, 0, 3]),
    fan: between(seed, 11, 5, 11),
    knuckle: between(seed, 12, 2, 6),
    thumbAngle: between(seed, 13, 34, 52),
  };
  if (chosen === 'filled') {
    return balance({ ...shared, style: 'filled', fingers: pick(seed, 4, [3, 4, 4]), root: 0, leftLen: 0, rightLen: 0, dot: pick(seed, 8, ['above', 'corner', 'palm']) });
  }
  return balance({
    ...shared,
    style: 'line',
    fingers: pick(seed, 9, [2, 3, 3]),
    root: 0,
    leftLen: (palmWidth * between(seed, 14, 10, 26)) / 100,
    rightLen: (palmWidth * between(seed, 15, 44, 58)) / 100,
    dot: pick(seed, 16, ['corner', 'above', 'side']),
  });
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const RULES = {
  gapToWeight: { line: [0.75, 1.5], filled: [0.3, 0.9] },
  fingerToPalm: [0.32, 0.62],
  weightToPalm: [0.12, 0.26],
  maxFingers: { line: 4, filled: 4 },
  dotToWeight: [0.55, 0.8],
  dotClearance: 0.9,
  tilt: 10,
  fan: [0, 13],
  knuckle: [0, 8],
  thumbAngle: [25, 60],
};

function spacingOf(style, palmWidth, weight, fingers) {
  if (style === 'line') return palmWidth / (fingers + 1);
  return fingers === 1 ? palmWidth : (palmWidth - weight) / (fingers - 1);
}

function weightBounds(style, palmWidth, fingers) {
  const [gapLow, gapHigh] = RULES.gapToWeight[style];
  if (style === 'line') {
    const spacing = palmWidth / (fingers + 1);
    return [spacing / (1 + gapHigh), spacing / (1 + gapLow)];
  }
  if (fingers === 1) return [0, Infinity];
  return [palmWidth / ((1 + gapHigh) * (fingers - 1) + 1), palmWidth / ((1 + gapLow) * (fingers - 1) + 1)];
}

export function balance(input) {
  const o = { ...input };
  const style = o.style === 'filled' ? 'filled' : 'line';
  o.fingers = clamp(Math.round(o.fingers), style === 'filled' ? 2 : 1, RULES.maxFingers[style]);
  o.palmWidth = clamp(o.palmWidth, 40, 62);
  const [fitLow, fitHigh] = weightBounds(style, o.palmWidth, o.fingers);
  const low = Math.max(o.palmWidth * RULES.weightToPalm[0], fitLow);
  const high = Math.min(o.palmWidth * RULES.weightToPalm[1], fitHigh);
  o.weight = low <= high ? clamp(o.weight, low, high) : high;
  o.fingerLen = clamp(o.fingerLen, o.palmWidth * RULES.fingerToPalm[0], o.palmWidth * RULES.fingerToPalm[1]);
  o.root = style === 'line' ? clamp(o.root ?? 0, 0, o.weight * 0.7) : 0;
  o.fan = clamp(o.fan ?? 0, ...RULES.fan);
  o.knuckle = clamp(o.knuckle ?? 0, ...RULES.knuckle);
  o.thumbAngle = clamp(o.thumbAngle ?? 40, ...RULES.thumbAngle);
  if (o.fingers > 3) o.fan = Math.min(o.fan, 9);
  if (style === 'line') {
    o.rightLen = clamp(o.rightLen, o.palmWidth * 0.35, o.palmWidth * 0.62);
    o.leftLen = clamp(o.leftLen, o.thumb === 'none' ? o.palmWidth * 0.12 : o.palmWidth * 0.05, o.rightLen * 0.8);
  }
  o.curl = clamp(o.curl, o.weight * 0.55, o.weight * 0.9);
  o.dotSize = clamp(o.dotSize, o.weight * RULES.dotToWeight[0], o.weight * RULES.dotToWeight[1]);
  if (o.dot === 'tip' && style === 'line') o.dotSize = Math.min(o.dotSize, o.weight * 0.42);
  o.tilt = clamp(o.tilt, -RULES.tilt, RULES.tilt);
  o.spacing = spacingOf(style, o.palmWidth, o.weight, o.fingers);
  return o;
}

function lengths(count, profile) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    if (profile === 'natural') {
      if (count === 2) return [0.96, 1][index];
      if (count === 3) return [0.88, 1, 0.9][index];
      return [0.86, 1, 0.94, 0.74][index];
    }
    if (profile === 'arch') return 1 - 0.3 * Math.abs(t - 0.5) * 2;
    if (profile === 'index') return index === 0 ? 1 : 0.7 - 0.06 * (index - 1);
    return 1;
  });
}

function fanned(o, count, left, right, baseY, factors) {
  const mid = (count - 1) / 2;
  return factors.map((factor, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const angle = ((index - mid) * o.fan * Math.PI) / 180;
    const x0 = left + t * (right - left);
    const dip = o.knuckle * (2 * (t - 0.5)) ** 2;
    const y0 = baseY + dip;
    const length = o.fingerLen * factor;
    return { x0, y0, x1: x0 + Math.sin(angle) * length, y1: y0 - Math.cos(angle) * length };
  });
}

const round = (value) => Math.round(value * 100) / 100;

function topmost(fingers, fallback) {
  return fingers.reduce((best, f) => (f.y1 < best.y1 ? f : best), fingers[0] ?? fallback);
}

function thumbStroke(o, sideX, sideY, direction) {
  const angle = (o.thumbAngle * Math.PI) / 180;
  const length = o.curl * 2.6;
  const tipX = sideX - direction * Math.cos(angle) * length;
  const tipY = sideY - Math.sin(angle) * length;
  if (o.thumb === 'out') return { d: `M${round(sideX)} ${round(sideY)}L${round(tipX)} ${round(tipY)}`, tip: [tipX, tipY] };
  if (o.thumb === 'curl') {
    const ctrlX = sideX - direction * length * 0.95;
    const ctrlY = sideY + length * 0.15;
    return { d: `M${round(sideX)} ${round(sideY)}Q${round(ctrlX)} ${round(ctrlY)} ${round(tipX)} ${round(tipY)}`, tip: [tipX, tipY] };
  }
  return { d: '', tip: null };
}

function lineHand(o, ink) {
  const cx = 48;
  const cy = 60;
  const r = o.palmWidth / 2;
  const lx = cx - r;
  const rx = cx + r;
  const leftTop = cy - o.leftLen;
  const rightTop = cy - o.rightLen;
  const palm = `M${lx} ${leftTop}V${cy}A${r} ${r} 0 0 0 ${rx} ${cy}V${rightTop}`;
  const thumbY = cy + r * 0.15;
  const thumbX = cx - Math.sqrt(Math.max(0, r * r - (thumbY - cy) ** 2));
  const thumb = thumbStroke(o, thumbX, thumbY, 1);
  const spacing = (rx - lx) / (o.fingers + 1);
  const baseY = cy - o.root;
  const fingers = fanned(o, o.fingers, lx + spacing, rx - spacing, baseY, lengths(o.fingers, o.profile));
  const strokes = [palm, thumb.d, ...fingers.map((f) => `M${round(f.x0)} ${round(f.y0)}L${round(f.x1)} ${round(f.y1)}`)].filter(Boolean);
  const top = topmost(fingers, { x1: cx, y1: cy - 20 });
  const clear = o.weight * (0.5 + RULES.dotClearance) + o.dotSize;
  const anchors = {
    side: thumb.tip ? [thumb.tip[0] - clear * 0.4, thumb.tip[1] - clear] : [lx, leftTop - clear],
    above: [top.x1, top.y1 - clear],
    tip: [top.x1, top.y1],
    corner: [rx + o.weight * 0.3 + o.dotSize, rightTop - clear],
    palm: [cx, cy + r * 0.25],
  };
  const body = `<g fill="none" stroke="${ink}" stroke-width="${o.weight}" stroke-linecap="round" stroke-linejoin="round">${strokes.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  return { body, anchors };
}

function filledHand(o, ink) {
  const cx = 48;
  const cy = 62;
  const r = o.palmWidth / 2;
  const lx = cx - r;
  const rx = cx + r;
  const w = o.weight;
  const shoulder = cy - Math.max(6, r * 0.4);
  const palm = `<path d="M${lx} ${shoulder}Q${lx} ${shoulder - r * 0.18} ${cx} ${shoulder - r * 0.22}Q${rx} ${shoulder - r * 0.18} ${rx} ${shoulder}V${cy}A${r} ${r} 0 0 1 ${lx} ${cy}Z" fill="${ink}"/>`;
  const baseY = shoulder + w * 0.2;
  const fingers = fanned(o, o.fingers, lx + w / 2, rx - w / 2, baseY, lengths(o.fingers, o.profile));
  const thumb = thumbStroke(o, lx + w * 0.55, cy + r * 0.05, 1);
  const strokes = fingers.map((f) => `<path d="M${round(f.x0)} ${round(f.y0)}L${round(f.x1)} ${round(f.y1)}"/>`).join('') + (thumb.d ? `<path d="${thumb.d}"/>` : '');
  const top = topmost(fingers, { x1: cx, y1: cy - 20 });
  const last = fingers[fingers.length - 1];
  const clear = w * (0.5 + RULES.dotClearance) + o.dotSize;
  const anchors = {
    side: thumb.tip ? [thumb.tip[0] - clear * 0.4, thumb.tip[1] - clear] : [lx - clear, fingers[0].y1 + o.dotSize],
    above: [top.x1, top.y1 - clear],
    tip: [top.x1, top.y1],
    corner: [last.x1 + clear * 0.75, last.y1 - clear * 0.75],
    palm: [cx + r * 0.15, cy + r * 0.1],
  };
  const body = `${palm}<g fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${strokes}</g>`;
  return { body, anchors };
}

export function markBody(input, ink = COLORS.ink, accent = COLORS.accent) {
  const options = balance(input);
  const { body, anchors } = options.style === 'filled' ? filledHand(options, ink) : lineHand(options, ink);
  const at = anchors[options.dot];
  const dot = at ? `<circle cx="${round(at[0])}" cy="${round(at[1])}" r="${options.dotSize}" fill="${accent}"/>` : '';
  const tilt = options.tilt ? ` transform="rotate(${options.tilt} 48 56)"` : '';
  return `<g${tilt}>${body}${dot}</g>`;
}

export function fitBox(body) {
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  probe.setAttribute('style', 'position:absolute;left:-9999px;width:96px;height:96px');
  probe.innerHTML = body;
  document.body.appendChild(probe);
  const box = probe.getBBox();
  probe.remove();
  const side = Math.max(box.width, box.height);
  const pad = side * 0.08;
  const x = box.x - (side - box.width) / 2 - pad;
  const y = box.y - (side - box.height) / 2 - pad;
  return [round(x), round(y), round(side + pad * 2), round(side + pad * 2)];
}

export function markSvg(input, { ink = COLORS.ink, accent = COLORS.accent, size } = {}) {
  const options = balance(input);
  const body = markBody(options, ink, accent);
  const reach = options.weight / 2;
  const [x, y, w, h] = fitBox(body);
  const view = `${round(x - reach)} ${round(y - reach)} ${round(w + reach * 2)} ${round(h + reach * 2)}`;
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}"${dims}>${body}</svg>`;
}

export function iconSvg(options, { size } = {}) {
  const inner = markSvg(options, { ink: COLORS.nightInk }).replace('<svg ', '<svg x="18" y="18" width="64" height="64" ');
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims}><rect width="100" height="100" rx="22" fill="${COLORS.night}"/>${inner}</svg>`;
}
