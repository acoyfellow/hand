(() => {
  if (window.__handCursor) return;
  const css = `
.hand-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform .45s cubic-bezier(.3,.7,.2,1),opacity .3s;opacity:0;will-change:transform}
.hand-cursor svg{display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))}
.hand-cursor-label{position:absolute;left:22px;top:20px;white-space:nowrap;font:500 12px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;color:#fff;background:#111;padding:6px 8px;border-radius:999px;opacity:0;transform:translateY(-2px);transition:opacity .2s,transform .2s}
.hand-cursor-label b{color:var(--hand-accent,#7cc4ff);font-weight:600;margin-left:6px}
.hand-cursor.show-label .hand-cursor-label{opacity:1;transform:none}
.hand-cursor.flip .hand-cursor-label{left:auto;right:16px}
.hand-ring{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #2E9BF0;animation:hand-ring .6s ease-out forwards}
@keyframes hand-ring{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
@media (prefers-reduced-motion:reduce){.hand-cursor{transition:opacity .2s}.hand-ring{animation-duration:.01s}}`;
  const ARROW =
    '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 2l15 8.2-6.6 1.6L8.3 18z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function mount(root, opts = {}) {
    const host = root || document.body;
    const shape = opts.svg || ARROW;
    const [hx, hy] = opts.hotspot || [3, 2];
    const accent = opts.accent || '#2E9BF0';
    if (!(root ? root : document.head).querySelector(':scope > style[data-hand-cursor]')) {
      const style = document.createElement('style');
      style.dataset.handCursor = '';
      style.textContent = css;
      (root ? root : document.head).appendChild(style);
    }
    const cursor = document.createElement('div');
    cursor.className = 'hand-cursor';
    cursor.innerHTML = `${shape}<span class="hand-cursor-label"></span>`;
    cursor.style.setProperty('--hand-accent', accent);
    host.appendChild(cursor);
    const label = cursor.querySelector('.hand-cursor-label');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function moveTo(x, y) {
      const first = cursor.style.opacity !== '1';
      if (first) {
        cursor.style.transition = 'none';
        cursor.style.transform = `translate(${x + 40}px,${y + 40}px)`;
        cursor.getBoundingClientRect();
        cursor.style.transition = '';
      }
      cursor.style.opacity = '1';
      cursor.style.transform = `translate(${x - hx}px,${y - hy}px)`;
      await wait(first ? 380 : 470);
    }

    function ring(x, y) {
      const dot = document.createElement('div');
      dot.className = 'hand-ring';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.borderColor = accent;
      host.appendChild(dot);
      setTimeout(() => dot.remove(), 700);
    }

    async function click(x, y, text, p) {
      label.textContent = text || '';
      if (typeof p === 'number') {
        const sure = document.createElement('b');
        sure.textContent = `${Math.round(p * 100)}%`;
        label.appendChild(sure);
      }
      cursor.classList.toggle('show-label', Boolean(text));
      const room = (root ? host.clientWidth : innerWidth) - x;
      cursor.classList.toggle('flip', room < 190);
      await moveTo(x, y);
      ring(x, y);
      await wait(160);
    }

    function hide() {
      cursor.style.opacity = '0';
      cursor.classList.remove('show-label');
    }

    return { click, moveTo, ring, hide };
  }

  window.__handCursor = mount();
  window.__handCursorMount = mount;
})();
