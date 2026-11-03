export const STYLES = ['line', 'filled'];
export const PROFILES = ['arch', 'index', 'rise', 'fall', 'even'];
export const THUMBS = ['none', 'curl', 'out'];
export const DOTS = ['side', 'above', 'tip', 'corner', 'palm', 'none'];

export const PRESETS = {
  c3: { style: 'line', fingers: 3, profile: 'arch', fingerLen: 24, root: 6, palmWidth: 52, leftLen: 18, rightLen: 30, thumb: 'none', curl: 7, weight: 10, dot: 'corner', dotSize: 5.5, tilt: 0 },
  c2: { style: 'line', fingers: 2, profile: 'index', fingerLen: 28, root: 6, palmWidth: 48, leftLen: 8, rightLen: 26, thumb: 'curl', curl: 7, weight: 9, dot: 'side', dotSize: 5.5, tilt: 0 },
  d1: { style: 'filled', fingers: 3, profile: 'arch', fingerLen: 22, root: 0, palmWidth: 46, leftLen: 0, rightLen: 0, thumb: 'none', curl: 7, weight: 11, dot: 'side', dotSize: 5.5, tilt: 0 },
  d2: { style: 'filled', fingers: 3, profile: 'arch', fingerLen: 18, root: 0, palmWidth: 50, leftLen: 0, rightLen: 0, thumb: 'out', curl: 7, weight: 13, dot: 'palm', dotSize: 6.5, tilt: 0 },
};

export const COLORS = { ink: '#18181b', accent: '#2E9BF0', paper: '#ffffff', night: '#141416', nightInk: '#ececee' };

export const ACCENTS = ['#2E9BF0', '#F38020', '#16A34A', '#E5484D', '#8B5CF6', '#EAB308', '#14B8A6', '#EC4899'];

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

export function accentOf(seedText) {
  return pick(hashOf(seedText), 40, ACCENTS);
}

export function generate(seedText, style) {
  const seed = hashOf(seedText);
  const chosen = style ?? pick(seed, 1, STYLES);
  const palmWidth = between(seed, 2, 44, 56);
  const weight = (palmWidth * between(seed, 3, 17, 24)) / 100;
  if (chosen === 'filled') {
    return balance({
      style: 'filled',
      fingers: pick(seed, 4, [3, 3, 4]),
      profile: pick(seed, 5, ['arch', 'arch', 'rise', 'even']),
      fingerLen: (palmWidth * between(seed, 6, 36, 56)) / 100,
      root: 0,
      palmWidth,
      leftLen: 0,
      rightLen: 0,
      thumb: pick(seed, 7, ['none', 'none', 'curl']),
      curl: weight * 0.7,
      weight,
      dot: pick(seed, 8, ['above', 'side', 'palm', 'corner']),
      dotSize: weight * 0.65,
      tilt: 0,
    });
  }
  return balance({
    style: 'line',
    fingers: pick(seed, 9, [2, 3, 3, 3]),
    profile: pick(seed, 10, ['arch', 'arch', 'index', 'rise']),
    fingerLen: (palmWidth * between(seed, 11, 38, 58)) / 100,
    root: weight * 0.6,
    palmWidth,
    leftLen: (palmWidth * between(seed, 12, 14, 36)) / 100,
    rightLen: (palmWidth * between(seed, 13, 42, 60)) / 100,
    thumb: pick(seed, 14, ['none', 'none', 'curl']),
    curl: weight * 0.7,
    weight,
    dot: pick(seed, 15, ['corner', 'side', 'above']),
    dotSize: weight * 0.65,
    tilt: 0,
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
  tilt: 8,
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
  o.root = style === 'line' ? clamp(o.root, o.weight * 0.3, o.weight * 0.9) : 0;
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

const NUMERIC = ['fingerLen', 'root', 'palmWidth', 'leftLen', 'rightLen', 'curl', 'weight', 'dotSize', 'tilt'];

export function mix(from, to, t) {
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const out = { ...(eased < 0.5 ? from : to) };
  for (const key of NUMERIC) out[key] = from[key] + (to[key] - from[key]) * eased;
  return out;
}

function lengths(count, profile) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    if (profile === 'arch') return 1 - 0.32 * Math.abs(t - 0.5) * 2;
    if (profile === 'index') return index === 0 ? 1 : 0.68;
    if (profile === 'rise') return 0.66 + 0.34 * t;
    if (profile === 'fall') return 1 - 0.34 * t;
    return 1;
  });
}

const round = (value) => Math.round(value * 100) / 100;

function lineHand(o, ink) {
  const cx = 48;
  const cy = 60;
  const r = o.palmWidth / 2;
  const lx = cx - r;
  const rx = cx + r;
  const leftTop = cy - o.leftLen;
  const rightTop = cy - o.rightLen;
  let start = `M${lx} ${leftTop}`;
  if (o.thumb === 'curl') start = `M${round(lx - o.curl * 2)} ${round(leftTop + o.curl * 0.4)}A${o.curl} ${o.curl} 0 0 1 ${lx} ${leftTop}`;
  const palm = `${start}V${cy}A${r} ${r} 0 0 0 ${rx} ${cy}V${rightTop}`;
  const thumbY = Math.min(cy, Math.max(leftTop + o.weight, cy - r * 0.25));
  const reach = o.curl * 2.4;
  const thumbOut = o.thumb === 'out' ? `M${lx} ${round(thumbY)}L${round(lx - reach * 0.75)} ${round(thumbY - reach)}` : '';
  const factors = lengths(o.fingers, o.profile);
  const base = cy - o.root;
  const fingers = factors.map((factor, index) => {
    const x = lx + ((index + 1) * (rx - lx)) / (o.fingers + 1);
    return { x: round(x), tip: round(base - o.root - o.fingerLen * factor), base };
  });
  const strokes = [palm, thumbOut, ...fingers.map((f) => `M${f.x} ${f.base}V${f.tip}`)].filter(Boolean);
  const tallest = fingers.reduce((best, f) => (f.tip < best.tip ? f : best), fingers[0] ?? { x: cx, tip: cy - 20 });
  const clear = o.weight * (0.5 + RULES.dotClearance) + o.dotSize;
  const anchors = {
    side: o.thumb === 'curl' ? [lx - o.curl, leftTop - o.curl - clear] : o.thumb === 'out' ? [lx - reach * 0.75, thumbY - reach - clear] : [lx, leftTop - clear],
    above: [tallest.x, tallest.tip - clear],
    tip: [tallest.x, tallest.tip],
    corner: [rx + o.weight * 0.35 + o.dotSize, rightTop - clear],
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
  const top = cy - Math.max(6, r * 0.35);
  const palm = `<path d="M${lx} ${top}V${cy}A${r} ${r} 0 0 0 ${rx} ${cy}V${top}Z" fill="${ink}"/>`;
  const w = o.weight;
  const factors = lengths(o.fingers, o.profile);
  const span = rx - lx - w;
  const fingers = factors.map((factor, index) => {
    const x = lx + w / 2 + (o.fingers === 1 ? span / 2 : (index * span) / (o.fingers - 1));
    return { x: round(x), tip: round(top - o.fingerLen * factor) };
  });
  const reach = o.curl * 2.2;
  const thumbs = {
    out: `<path d="M${round(lx + w * 0.5)} ${round(cy + r * 0.2)}L${round(lx - reach * 0.7)} ${round(cy - reach * 0.6)}"/>`,
    curl: `<path d="M${round(lx + w * 0.5)} ${round(cy + r * 0.25)}Q${round(lx - reach * 0.8)} ${round(cy)} ${round(lx - reach * 0.3)} ${round(cy - reach * 0.7)}"/>`,
  };
  const thumb = thumbs[o.thumb] ?? '';
  const strokes = fingers.map((f) => `<path d="M${f.x} ${top + w / 2}V${f.tip}"/>`).join('') + thumb;
  const tallest = fingers.reduce((best, f) => (f.tip < best.tip ? f : best), fingers[0]);
  const anchors = {
    side: [lx - w * RULES.dotClearance - o.dotSize, fingers[0].tip + o.dotSize],
    above: [tallest.x, tallest.tip - w * (0.5 + RULES.dotClearance) - o.dotSize],
    tip: [tallest.x, tallest.tip],
    corner: [rx + w * RULES.dotClearance * 0.6 + o.dotSize, fingers[fingers.length - 1].tip - w * RULES.dotClearance - o.dotSize],
    palm: [cx + r * 0.2, cy + r * 0.12],
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

export const FIXED_VIEW = '-6 -10 108 108';

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

export function markSvg(input, { ink = COLORS.ink, accent = COLORS.accent, size, fixed = false } = {}) {
  const options = balance(input);
  const body = markBody(options, ink, accent);
  const dims = size ? ` width="${size}" height="${size}"` : '';
  if (fixed) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FIXED_VIEW}"${dims}>${body}</svg>`;
  const reach = options.weight / 2;
  const [x, y, w, h] = fitBox(body);
  const view = `${round(x - reach)} ${round(y - reach)} ${round(w + reach * 2)} ${round(h + reach * 2)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}"${dims}>${body}</svg>`;
}

export function iconSvg(options, { size, accent = COLORS.accent, fixed = false } = {}) {
  const inner = markSvg(options, { ink: COLORS.nightInk, accent, fixed }).replace('<svg ', '<svg x="18" y="18" width="64" height="64" ');
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dims}><rect width="100" height="100" rx="22" fill="${COLORS.night}"/>${inner}</svg>`;
}

export const MOTIONS = ['still', 'wave', 'press', 'breathe'];
export const DEFAULT_MARK = PRESETS.c3;

const PERIOD_MS = 1600;

export function pose(base, motion, time) {
  const shape = { ...base };
  const swing = Math.sin(((time % PERIOD_MS) / PERIOD_MS) * Math.PI * 2);
  if (motion === 'wave') shape.tilt = 7 * swing;
  if (motion === 'press') {
    const dip = Math.max(0, swing);
    shape.fingerLen = base.fingerLen * (1 - 0.16 * dip);
    shape.dotSize = base.dotSize * (1 + 0.4 * dip);
  }
  if (motion === 'breathe') {
    shape.palmWidth = base.palmWidth * (1 + 0.04 * swing);
    shape.weight = base.weight * (1 + 0.05 * swing);
  }
  return shape;
}

export function prefersStill() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function walker(start, { colorful = false, keepStyle = 0.75, hold = 900, move = 1100, startAccent = COLORS.accent } = {}) {
  let from = balance(start);
  let fromAccent = startAccent;
  let to = null;
  let began = 0;
  const next = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    const style = Math.random() < keepStyle ? from.style : undefined;
    return { seed, shape: balance(generate(seed, style)), accent: colorful ? accentOf(seed) : startAccent };
  };
  return {
    at(now) {
      if (!to) {
        to = next();
        began = now;
      }
      const elapsed = now - began;
      if (elapsed >= hold + move) {
        const arrived = to;
        from = arrived.shape;
        fromAccent = arrived.accent;
        to = next();
        began = now;
        return { shape: from, accent: fromAccent, arrived };
      }
      const t = Math.max(0, (elapsed - hold) / move);
      return { shape: t > 0 ? mix(from, to.shape, t) : from, accent: t < 0.5 ? fromAccent : to.accent, arrived: null };
    },
  };
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export const FLEET_STORY = { appear: 900, spread: 1100, work: 2600, settle: 5600, loop: 8200 };

export function fleet(el, { base = DEFAULT_MARK, columns = 9, rows = 3, size = 52, gap = 10, ink = COLORS.ink } = {}) {
  el.replaceChildren();
  el.style.display = 'grid';
  el.style.gridTemplateColumns = `repeat(${columns}, ${size}px)`;
  el.style.gap = `${gap}px`;
  el.style.justifyContent = 'center';
  const home = balance(base);
  const middleRow = Math.floor(rows / 2);
  const middleColumn = Math.floor(columns / 2);
  const cells = Array.from({ length: columns * rows }, (_, index) => {
    const cell = document.createElement('div');
    cell.style.width = `${size}px`;
    cell.style.height = `${size}px`;
    el.appendChild(cell);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const seed = `fleet-${index}`;
    return {
      cell,
      leader: row === middleRow && column === middleColumn,
      distance: Math.hypot(row - middleRow, (column - middleColumn) * 0.8),
      shape: balance(generate(seed, base.style)),
      accent: accentOf(seed),
      last: '',
    };
  });
  const farthest = Math.max(...cells.map((c) => c.distance)) || 1;
  const story = FLEET_STORY;
  const render = (now) => {
    const t = now % story.loop;
    for (const c of cells) {
      const lag = (c.distance / farthest) * 700;
      const lead = 700 - lag;
      const shown = c.leader ? 1 : ease((t - story.appear - lag) / 450) * (1 - ease((t - story.settle - 300 - lead) / 450));
      const away = c.leader ? 0 : ease((t - story.spread - lag) / 900) * (1 - ease((t - story.settle - lead) / 900));
      const shape = away > 0 ? mix(home, c.shape, away) : home;
      const working = t > story.work && t < story.settle;
      const posed = working ? pose(shape, 'press', t + lag * 2.2) : shape;
      const accent = away > 0.5 ? c.accent : COLORS.accent;
      c.cell.style.opacity = shown.toFixed(3);
      const svg = shown > 0.01 ? markSvg(posed, { ink, accent, size, fixed: true }) : '';
      if (svg !== c.last) {
        c.cell.innerHTML = svg;
        c.last = svg;
      }
    }
  };
  let frame = 0;
  const loop = (now) => {
    render(now);
    frame = requestAnimationFrame(loop);
  };
  if (prefersStill()) render(story.work + 400);
  else frame = requestAnimationFrame(loop);
  return { stop: () => cancelAnimationFrame(frame) };
}

export function cursorSvg(options, { accent = COLORS.accent, size = 30 } = {}) {
  const shape = balance(options);
  const outline = markBody(shape, '#ffffff', '#ffffff').replace(/stroke-width="([\d.]+)"/g, (_, w) => `stroke-width="${Number(w) + 5}"`).replace(/fill="#ffffff"/g, 'fill="#ffffff" stroke="#ffffff" stroke-width="5"');
  const body = markBody(shape, COLORS.ink, accent);
  return `<svg width="${size}" height="${size}" viewBox="${FIXED_VIEW}" aria-hidden="true" style="overflow:visible">${outline}${body}</svg>`;
}

export function agent(seed, { style } = {}) {
  return { seed, shape: balance(generate(seed, style)), accent: accentOf(seed) };
}
