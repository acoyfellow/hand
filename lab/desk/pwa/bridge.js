(() => {
  const head = document.head;
  head.insertAdjacentHTML('beforeend', '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#2f6fed">');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
  let last = '';
  const push = () => {
    const state = window.__state;
    if (!state) return;
    const body = JSON.stringify(state);
    if (body === last) return;
    last = body;
    fetch('/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
  };
  setInterval(push, 250);
  addEventListener('pagehide', push);
})();
