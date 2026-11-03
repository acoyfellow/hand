import { agent, cursorSvg } from '/brand/mark.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MARKUP = `
<div class="sw-app">
  <div class="sw-bar"><i></i><i></i><i></i><span>Workspace</span></div>
  <div class="sw-cols">
    <div class="sw-card sw-mail">
      <b>Inbox</b>
      <div class="sw-row" data-mail="0"><span>Ana Souza</span><em>Invoice March</em><button data-act="archive-0">Archive</button></div>
      <div class="sw-row" data-mail="1"><span>Ben Okafor</span><em>Team lunch?</em><button data-act="archive-1">Archive</button></div>
      <div class="sw-row" data-mail="2"><span>Cleo Park</span><em>Offsite plan</em><button data-act="archive-2">Archive</button></div>
    </div>
    <div class="sw-side">
      <div class="sw-card sw-settings">
        <b>Settings</b>
        <label class="sw-toggle"><span>Email alerts</span><button data-act="alerts" aria-pressed="false"></button></label>
        <label class="sw-toggle"><span>Dark mode</span><button data-act="dark" aria-pressed="false"></button></label>
        <button class="sw-primary" data-act="save">Save</button>
      </div>
      <div class="sw-card sw-shop">
        <b>Shop</b>
        <div class="sw-item"><span>Desk lamp</span><button data-act="lamp">Add</button></div>
        <div class="sw-item"><span>Notebook</span><button data-act="book">Add</button></div>
        <div class="sw-cart">Cart <strong data-cart>0</strong></div>
      </div>
    </div>
  </div>
  <div class="sw-done" data-done></div>
</div>`;

const CSS = `
.sw-app .hand-cursor,.sw-app .hand-ring{position:absolute}
.sw-app{position:relative;border:1px solid var(--line,#ebebe8);border-radius:14px;background:var(--bg,#fff);overflow:hidden;font:400 13px/1.4 var(--sans,system-ui);text-align:left}
.sw-bar{display:flex;align-items:center;gap:6px;padding:9px 12px;background:var(--raise,#f4f4f2);border-bottom:1px solid var(--line,#ebebe8);color:var(--dim,#6b6b70);font-size:12px}
.sw-bar i{width:9px;height:9px;border-radius:50%;background:var(--line,#ddd)}.sw-bar span{margin-left:8px}
.sw-cols{display:grid;grid-template-columns:1.3fr 1fr;gap:12px;padding:14px}
.sw-side{display:grid;gap:12px}
.sw-card{border:1px solid var(--line,#ebebe8);border-radius:10px;padding:10px 12px;display:grid;gap:8px;align-content:start}
.sw-card>b{font-weight:600;font-size:13px}
.sw-row{display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line,#ebebe8);transition:opacity .4s,transform .4s}
.sw-row em{font-style:normal;color:var(--dim,#6b6b70);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sw-row.gone{opacity:.25;transform:translateX(8px)}
.sw-app button{font:inherit;font-size:12px;border:1px solid var(--line,#ddd);background:var(--bg,#fff);color:var(--text,#18181b);border-radius:7px;padding:4px 9px;cursor:default}
.sw-toggle{display:flex;justify-content:space-between;align-items:center}
.sw-toggle button{width:34px;height:20px;border-radius:999px;padding:0;background:var(--line,#ddd);border:0;position:relative;transition:background .25s}
.sw-toggle button::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .25s}
.sw-toggle button[aria-pressed=true]{background:var(--sw-on,#2E9BF0)}.sw-toggle button[aria-pressed=true]::after{transform:translateX(14px)}
.sw-primary{justify-self:start;background:#18181b!important;color:#fff!important;border-color:#18181b!important}
.sw-item{display:flex;justify-content:space-between;align-items:center}
.sw-cart{color:var(--dim,#6b6b70);font-size:12px}.sw-cart strong{color:var(--text,#18181b)}
.sw-done{position:absolute;right:12px;bottom:12px;display:flex;gap:6px;flex-wrap:wrap;justify-content:end;max-width:60%}
.sw-done span{font-size:11px;padding:3px 8px;border-radius:999px;background:var(--raise,#f4f4f2);color:var(--dim,#6b6b70);display:flex;align-items:center;gap:5px;animation:sw-in .3s ease-out}
.sw-done i{width:7px;height:7px;border-radius:50%}
@keyframes sw-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (max-width:640px){.sw-cols{grid-template-columns:1fr}.sw-row{grid-template-columns:70px 1fr auto}}`;

const TASKS = [
  { name: 'Archive invoices', steps: [['archive-0', 'Archive Ana Souza', 0.97]] },
  { name: 'Turn on alerts', steps: [['alerts', 'Email alerts', 0.95], ['save', 'Save', 0.94]] },
  { name: 'Buy a lamp', steps: [['lamp', 'Add Desk lamp', 0.96]] },
  { name: 'Clear lunch thread', steps: [['archive-1', 'Archive Ben Okafor', 0.93], ['archive-2', 'Archive Cleo Park', 0.91]] },
];

function apply(root, act) {
  const button = root.querySelector(`[data-act="${act}"]`);
  if (!button) return;
  if (act.startsWith('archive-')) button.closest('.sw-row').classList.add('gone');
  if (act === 'alerts' || act === 'dark') button.setAttribute('aria-pressed', 'true');
  if (act === 'lamp' || act === 'book') {
    const cart = root.querySelector('[data-cart]');
    cart.textContent = String(Number(cart.textContent) + 1);
  }
}

export function swarm(el, { seeds = ['ada', 'bix', 'cyd', 'dot'], style = 'line' } = {}) {
  if (!document.querySelector('style[data-swarm]')) {
    const tag = document.createElement('style');
    tag.dataset.swarm = '';
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }
  el.innerHTML = MARKUP;
  const app = el.querySelector('.sw-app');
  const done = el.querySelector('[data-done]');
  const agents = seeds.slice(0, TASKS.length).map((seed) => agent(seed, { style }));
  const cursors = agents.map((a) => window.__handCursorMount(app, { svg: cursorSvg(a.shape, { accent: a.accent, size: 30 }), hotspot: [15, 4], accent: a.accent }));
  let alive = true;

  const pointOf = (act) => {
    const target = app.querySelector(`[data-act="${act}"]`).getBoundingClientRect();
    const box = app.getBoundingClientRect();
    return [target.left - box.left + target.width / 2, target.top - box.top + target.height / 2];
  };

  async function run(index) {
    const task = TASKS[index];
    const cursor = cursors[index];
    await wait(index * 450 + 300);
    for (const [act, label, p] of task.steps) {
      if (!alive) return;
      const [x, y] = pointOf(act);
      await cursor.click(x, y, label, p);
      apply(app, act);
      await wait(500 + index * 120);
    }
    const chip = document.createElement('span');
    chip.innerHTML = `<i style="background:${agents[index].accent}"></i>${task.name}`;
    done.appendChild(chip);
    await wait(500);
    cursor.hide();
  }

  async function loop() {
    while (alive) {
      await Promise.all(TASKS.map((_, index) => run(index)));
      await wait(2200);
      if (!alive) return;
      el.querySelectorAll('.hand-cursor,.hand-ring').forEach((node) => node.remove());
      return swarm(el, { seeds: seeds.map((s) => `${s}+`), style });
    }
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const task of TASKS) for (const [act] of task.steps) apply(app, act);
    TASKS.forEach((task, index) => {
      const chip = document.createElement('span');
      chip.innerHTML = `<i style="background:${agents[index].accent}"></i>${task.name}`;
      done.appendChild(chip);
    });
  } else loop();
  return { stop: () => (alive = false), agents };
}
