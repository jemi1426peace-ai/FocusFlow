'use strict';
/* FocusFlow core — utilities, local database (IndexedDB), UI helpers, router.
   All data stays on this device. */

const STORES = ['tasks', 'subjects', 'assignments', 'exams', 'events', 'sessions', 'reminders', 'notes', 'lists',
  'habits', 'routines', 'goals', 'checkins', 'postings', 'moods', 'water', 'bible', 'insights'];
const D = {}; STORES.forEach(s => D[s] = []);
const WIDGETS = [['mood', 'How are you feeling?'], ['water', 'Hydration'], ['spirit', 'Spiritual growth'], ['priorities', 'Top priorities'], ['tasks', "Today's tasks"], ['timetable', 'Daily timetable'],
  ['deadlines', 'Upcoming deadlines'], ['reminders', 'Reminders'], ['focus', 'Focus timer'], ['checkin', 'Daily check-in'],
  ['progress', 'Progress overview'], ['calendar', 'Calendar'], ['notes', 'Quick notes & brain dump']];
const ST = { theme: 'auto', size: 'normal', accent: 'lavender', reduce: false, sound: true, quiet: false, insights: true,
  lowEnergy: false, studyGoal: 600, font: 'cute', waterGoal: 8, glassMl: 250, pin: null, salt: null, hideNav: [], widgets: WIDGETS.map(w => ({ id: w[0], on: true })) };
const V = {}, A = {}, FORMS = {};
const T = { acad: 'subjects', cal: 'month', mem: 'reminders', life: 'habits', chk: 'checkin', tf: 'open', tc: 'all', ntag: 'all' };
let VIEW = 'home', db;

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => fmt(new Date());
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return fmt(d); };
const diffDays = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const tmin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const mtime = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const nice = s => pd(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const bar = p => `<div class="bar" role="progressbar" aria-valuenow="${p}"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></div>`;
const empty = m => `<p class="empty">${m}</p>`;
const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const hd = (t, r = '') => `<div class="row between wrap hd"><h1>${t}</h1><div class="row wrap">${r}</div></div>`;
const tabs = (k, list) => `<div class="chips" role="tablist">${list.map(([v, l]) => `<button class="chip ${T[k] === v ? 'on' : ''}" data-act="tab" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
const countdown = ds => { const d = diffDays(today(), ds); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 0 ? `in ${d} days` : `${-d} day${d === -1 ? '' : 's'} ago`; };

/* ---------- IndexedDB ---------- */
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('focusflow', 3);
    r.onupgradeneeded = () => STORES.concat(['kv']).forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); });
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
}
const tx = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
const getAll = s => new Promise(r => { const q = tx(s).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
const kvGet = k => new Promise(r => { const q = tx('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
/* sync hooks: every record carries `updated`; deletions leave a tombstone so they spread to other devices */
let TOMB = {};
const changed = () => { if (typeof syncSoon === 'function') syncSoon(); };
const kvPut = (id, v) => new Promise(r => { const q = tx('kv', 'readwrite').put({ id, ...v }); q.onsuccess = () => r(); q.onerror = () => r(); });
const saveTomb = () => kvPut('tomb', { t: TOMB });
const saveSTraw = () => kvPut('settings', ST);
const saveST = () => { ST._u = new Date().toISOString(); changed(); return saveSTraw(); };
function put(s, o, raw) {
  if (!o.id) o.id = uid();
  if (!o.created) o.created = new Date().toISOString();
  if (!raw) { o.updated = new Date().toISOString(); delete TOMB[s + ':' + o.id]; changed(); }
  const i = D[s].findIndex(x => x.id === o.id);
  if (i < 0) D[s].push(o); else D[s][i] = o;
  return new Promise(r => { const q = tx(s, 'readwrite').put(JSON.parse(JSON.stringify(o))); q.onsuccess = () => r(o); q.onerror = () => { toast('Could not save — storage may be full'); r(o); }; });
}
function del(s, id, raw) {
  D[s] = D[s].filter(x => x.id !== id);
  if (!raw) { TOMB[s + ':' + id] = new Date().toISOString(); saveTomb(); changed(); }
  return new Promise(r => { const q = tx(s, 'readwrite').delete(id); q.onsuccess = r; q.onerror = r; });
}
const clearStore = s => new Promise(r => { const q = tx(s, 'readwrite').clear(); q.onsuccess = r; q.onerror = r; });
async function loadAll() {
  for (const s of STORES) D[s] = await getAll(s);
  const tb = await kvGet('tomb'); TOMB = (tb && tb.t) || {};
  const st = await kvGet('settings');
  if (st) { delete st.id; Object.assign(ST, st); }
  fillWidgets();
  ST.widgets = ST.widgets.filter(x => WIDGETS.find(w => w[0] === x.id));
}

/* new widgets (mood, water) slot in at the top for people upgrading from an older version */
function fillWidgets() {
  WIDGETS.forEach((w, i) => { if (!ST.widgets.find(x => x.id === w[0])) ST.widgets.splice(Math.min(i, ST.widgets.length), 0, { id: w[0], on: true }); });
}

/* ---------- look & feel ---------- */
function applyLook() {
  const r = document.documentElement;
  let t = ST.theme;
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  r.dataset.theme = t; r.dataset.accent = ST.accent; r.dataset.font = ST.font || 'cute';
  r.style.fontSize = { small: '14px', normal: '16px', large: '18px', xl: '20px' }[ST.size] || '16px';
  r.classList.toggle('reduce', !!ST.reduce);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'dark' ? '#1d1a26' : '#b9a6e8';
}
let actx;
function beep() {
  if (!ST.sound || ST.quiet) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t0 = actx.currentTime + i * .22; g.gain.setValueAtTime(.12, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .3);
      o.start(t0); o.stop(t0 + .32);
    });
  } catch (e) { /* sound unavailable */ }
}
const vib = () => { if (!ST.quiet && navigator.vibrate) navigator.vibrate([120, 60, 120]); };
function toast(msg, ms = 3000) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms);
}
function notify(title, body) {
  toast(title + (body ? ' — ' + body : ''), 6000); beep(); vib();
  if (ST.quiet) return;
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icons/icon-192.png' })).catch(() => new Notification(title, { body }));
      else new Notification(title, { body });
    }
  } catch (e) { /* ignore */ }
}

/* ---------- modals & forms ---------- */
function modal(html) {
  const o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(o);
  o.close = () => o.remove();
  o.addEventListener('mousedown', e => { if (e.target === o) o.close(); });
  return o;
}
function fieldHtml(f, v) {
  const id = 'f_' + f.k, lab = `<label for="${id}">${esc(f.label)}</label>`;
  v = v == null ? '' : v;
  if (f.type === 'textarea') return `<div class="fld">${lab}<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea></div>`;
  if (f.type === 'select') return `<div class="fld">${lab}<select id="${id}" name="${f.k}">${f.opts.map(o => { const [val, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></div>`;
  if (f.type === 'checkbox') return `<div class="fld chk"><label><input type="checkbox" id="${id}" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
  if (f.type === 'multi') { const arr = Array.isArray(v) ? v : []; return `<div class="fld"><label>${esc(f.label)}</label><div class="multi">${f.opts.map(([val, l]) => `<label class="pill"><input type="checkbox" name="${f.k}" value="${esc(val)}" ${arr.includes(String(val)) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>`; }
  const num = f.type === 'number' ? ` inputmode="decimal" step="any"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}` : '';
  return `<div class="fld">${lab}<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.req ? 'required' : ''}${num} ${f.type === 'password' ? 'autocomplete="off"' : ''}></div>`;
}
function formModal(title, fields, vals, save, intro = '', okLabel = 'Save') {
  const o = modal(`<h3>${title}</h3>${intro}<form>${fields.map(f => fieldHtml(f, vals[f.k])).join('')}<div class="row end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">${okLabel}</button></div></form>`);
  o.querySelector('[data-x]').onclick = o.close;
  o.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const out = {};
    fields.forEach(f => {
      if (f.type === 'multi') out[f.k] = [...o.querySelectorAll(`[name="${f.k}"]:checked`)].map(x => x.value);
      else {
        const el = o.querySelector(`[name="${f.k}"]`);
        out[f.k] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? (el.value === '' ? null : +el.value) : el.value;
      }
    });
    const r = save(out);
    if (typeof r === 'string') toast(r);
    else if (r !== false) o.close();
  };
  const first = o.querySelector('input:not([type=checkbox]),textarea'); if (first && !first.value) setTimeout(() => first.focus(), 50);
  return o;
}
const ask = (label, cb, def = '', title = '') => formModal(title || esc(label), [{ k: 'v', label, req: 1 }], { v: def }, o => { cb(o.v.trim()); });
function confirmBox(msg, yes, label = 'Delete') {
  const o = modal(`<p>${msg}</p><div class="row end"><button class="btn ghost" data-n>Cancel</button><button class="btn warn" data-y>${label}</button></div>`);
  o.querySelector('[data-n]').onclick = o.close;
  o.querySelector('[data-y]').onclick = () => { o.close(); yes(); };
}

/* generic add / edit / delete for stored records */
function openForm(s, id, pre) {
  const F = FORMS[s], cur = id ? D[s].find(x => x.id === id) : null;
  const vals = cur ? { ...cur } : { ...(F.def ? F.def() : {}), ...(pre || {}) };
  if (F.pre) F.pre(vals);
  const commit = o => { if (F.after) F.after(o, cur); put(s, o); render(); };
  const fo = formModal((cur ? 'Edit ' : 'New ') + F.name, F.fields(vals), vals, out => {
    const o = { ...(cur || {}), ...out };
    if (F.check) {
      const m = F.check(o, cur);
      /* {ask: message} = a soft warning; asks inside the app instead of a browser pop-up (which some iPads/PWAs block) */
      if (m && m.ask) { confirmBox(m.ask, () => { commit(o); fo.close(); }, m.yes || 'Save anyway'); return false; }
      if (m) return m;
    }
    commit(o);
  });
}
A.add = el => openForm(el.dataset.s, null, el.dataset.date ? { date: el.dataset.date } : null);
A.edit = el => openForm(el.dataset.s, el.dataset.id);
A.del = el => confirmBox('Delete this ' + (FORMS[el.dataset.s] ? FORMS[el.dataset.s].name : 'item') + '? This cannot be undone.', async () => { await del(el.dataset.s, el.dataset.id); render(); });

/* ---------- navigation ---------- */
const NAV = [['home', '🏠', 'Home'], ['tasks', '✅', 'Tasks'], ['acad', '🎓', 'Academics'], ['cal', '📅', 'Calendar'], ['focus', '⏱️', 'Focus'],
  ['mem', '🧠', 'Memory'], ['life', '🌿', 'My Life'], ['spirit', '🙏', 'Spiritual Growth', 'Faith'], ['chk', '💭', 'Check-ins'], ['set', '⚙️', 'Settings']];
function renderNav() {
  $('#nav').innerHTML = '<div class="brand">FocusFlow<small>plan · focus · organise · reflect</small><button class="syncbadge" data-sync data-act="go" data-v="set" hidden></button></div>' +
    NAV.filter(n => n[0] === 'home' || n[0] === 'set' || !ST.hideNav.includes(n[0]))
      .map(n => `<button class="${VIEW === n[0] ? 'on' : ''}" data-act="go" data-v="${n[0]}" aria-label="${n[2]}"><b>${n[1]}</b>${n[3] ? `<span class="nl">${n[2]}</span><span class="ns">${n[3]}</span>` : n[2]}</button>`).join('');
}
function render() {
  const sy = window.scrollY;
  $('#main').innerHTML = `<div class="page">${V[VIEW]()}</div>`;
  renderNav(); window.scrollTo(0, sy);
  if (typeof syncBadge === 'function') syncBadge();
}
function go(v) { VIEW = v; render(); window.scrollTo(0, 0); }
A.go = el => { if (el.dataset.life) T.life = el.dataset.life; go(el.dataset.v); };
A.tab = el => { T[el.dataset.k] = el.dataset.v; render(); };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const f = A[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && A[el.dataset.chg]) A[el.dataset.chg](el, e); });
document.addEventListener('submit', e => { const el = e.target.closest('[data-sub]'); if (el && A[el.dataset.sub]) { e.preventDefault(); A[el.dataset.sub](el, e); } });

/* ---------- calendar maths shared by several modules ---------- */
const CALS = ['College', 'Clinical', 'Study', 'Personal'];
function occurs(ev, ds) {
  const s = ev.date, e = ev.endDate || ev.date;
  if (!s || ds < s) return false;
  const rep = ev.repeat || 'none';
  if (rep === 'none') return ds <= e;
  if (ev.until && ds > ev.until) return false;
  const d0 = pd(s), d = pd(ds);
  if (rep === 'daily') return true;
  if (rep === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5;
  if (rep === 'days') return (ev.days || []).includes(String(d.getDay()));
  if (rep === 'weekly') return d.getDay() === d0.getDay();
  if (rep === 'monthly') return d.getDate() === d0.getDate();
  if (rep === 'yearly') return d.getDate() === d0.getDate() && d.getMonth() === d0.getMonth();
  return false;
}
/* start/end in minutes; an end time earlier than the start means it runs overnight (e.g. a 20:00–08:00 night duty) */
const span = (s, e) => { const a = tmin(s); let b = tmin(e); if (b <= a) b += 1440; return [a, b]; };
/* first free slot of `dur` minutes on date `ds`, at or after `from` */
function freeSlot(ds, dur, from = '08:00', to = '22:00') {
  const busy = D.events.filter(e => !e.allDay && e.start && e.end && occurs(e, ds)).map(e => span(e.start, e.end));
  D.tasks.filter(t => OPEN(t) && t.due === ds && t.startT && t.endT).forEach(t => busy.push(span(t.startT, t.endT)));
  busy.sort((a, b) => a[0] - b[0]);
  let t = tmin(from);
  for (const [s, e] of busy) { if (t + dur <= s) return mtime(t); t = Math.max(t, e); }
  return t + dur <= tmin(to) ? mtime(t) : null;
}
