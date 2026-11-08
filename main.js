'use strict';
/* FocusFlow — start-up and background loops */

/* timer tick: updates only the clock, so typing elsewhere is never interrupted */
setInterval(() => {
  if (!F.active || !F.running) return;
  const l = fLeft(), tot = (F.mode === 'focus' ? F.dur : F.brk) * 60;
  const el = document.getElementById('tm'); if (el) el.textContent = clock(l);
  const b = document.getElementById('tbar'); if (b) b.style.width = Math.round((1 - l / tot) * 100) + '%';
  document.title = (F.mode === 'focus' ? '🎯 ' : '☕ ') + clock(l) + ' · FocusFlow';
  if (l <= 0) { document.title = 'FocusFlow'; fdone(false); }
}, 500);

/* gentle return-to-task nudge, task-switch counting, auto-lock */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); if (F.active && F.running && F.mode === 'focus') { F.switches++; saveF(); } return; }
  const away = Date.now() - hiddenAt;
  if (ST.pin && hiddenAt && away > 5 * 60000) showLock();
  if (F.active && F.running && F.mode === 'focus' && away > 20000) {
    const t = D.tasks.find(x => x.id === F.task);
    toast(`Welcome back. You were focusing${t ? ' on “' + t.title + '”' : ''}. Pick up where you left off 💜`, 5000);
  }
  checkReminders();
});

/* every minute: refresh Home (Now / Next in the timetable) and roll over to a new day if the app stayed open overnight */
let lastDay = today();
setInterval(() => {
  const busy = document.querySelector('.overlay,.lock') || ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName);
  if (today() !== lastDay) { lastDay = today(); C.sel = today(); C.y = new Date().getFullYear(); C.m = new Date().getMonth(); if (!busy) render(); return; }
  if (VIEW === 'home' && !busy && !document.hidden) render();
}, 60000);

(async function init() {
  try { await openDB(); await loadAll(); await syncLoad(); }
  catch (e) { document.getElementById('main').innerHTML = '<div class="page"><h1>Storage unavailable</h1><p>FocusFlow could not open its on-device database. Private browsing can cause this. Try a normal browser window.</p></div>'; return; }
  applyLook();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyLook);
  renderNav(); render();
  if (ST.pin) showLock();
  checkReminders(); dateAlerts(); syncNow(false);
  setInterval(checkReminders, 20000);
  setInterval(dateAlerts, 3600000);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/[?&]reset\b/.test(location.search)) {
    const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
    /* when a new version takes over, reload once so the fresh files are used */
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !reloaded && !document.querySelector('.overlay')) { reloaded = true; location.reload(); } });
  }
})();
