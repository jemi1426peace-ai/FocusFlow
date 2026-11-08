'use strict';
/* FocusFlow — Focus, Memory, My Life, Check-ins, Settings */

/* ====================== FOCUS ====================== */
const F = { mode: 'focus', dur: 25, brk: 5, left: 0, running: false, active: false, endAt: 0, task: '', subject: '', topic: '', distr: [], switches: 0, breaksTaken: 0 };
try { Object.assign(F, JSON.parse(localStorage.getItem('ff_timer') || '{}')); } catch (e) { /* ignore */ }
if (F.active && F.running && F.endAt < Date.now() - 6 * 36e5) { F.active = false; F.running = false; }
const saveF = () => { try { localStorage.setItem('ff_timer', JSON.stringify(F)); } catch (e) { /* ignore */ } };
const fLeft = () => F.running ? Math.max(0, Math.round((F.endAt - Date.now()) / 1000)) : F.left;
const clock = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const encourage = ['You showed up — that counts. 🌱', 'One focused block at a time. ✨', 'Great work staying with it!', 'Small steps add up. 💜', 'That was a solid session!'];

V.focus = () => {
  const ss = D.sessions.filter(s => s.mode === 'focus' && s.date === today());
  const mins = ss.reduce((a, s) => a + s.mins, 0);
  const task = D.tasks.find(t => t.id === F.task);
  let top;
  if (F.active) {
    const tot = (F.mode === 'focus' ? F.dur : F.brk) * 60, l = fLeft();
    top = `<div class="card focusbox"><p class="mut">${F.mode === 'focus' ? '🎯 Focus' : '☕ Break'}${F.running ? '' : ' · paused'}</p>
<h2>${task ? esc(task.title) : F.topic ? esc(F.topic) : 'Focus session'}</h2>${F.subject ? `<p class="mut">${esc(subjName(F.subject))}</p>` : ''}
<div class="timer" id="tm" aria-live="off">${clock(l)}</div><div class="bar"><i id="tbar" style="width:${Math.round((1 - l / tot) * 100)}%"></i></div>
<div class="row" style="justify-content:center;margin:12px 0">${F.running ? '<button class="btn" data-act="fpause">⏸ Pause</button>' : '<button class="btn" data-act="fresume">▶ Resume</button>'}<button class="btn ghost" data-act="ffinish">${F.mode === 'focus' ? 'Finish now' : 'End break'}</button><button class="btn warn" data-act="fcancel">Cancel</button></div>
${F.mode === 'focus' ? `<form data-sub="fdistr" class="row"><input name="t" placeholder="Distracted? Jot it down, then return" required><button class="btn ghost sm">Log</button></form>
<form data-sub="fdump" class="row" style="margin-top:8px"><input name="t" placeholder="Brain dump — park a thought for later" required><button class="btn ghost sm">Park</button></form>
<p class="mut sm" style="margin-top:8px">${F.distr.length} distraction${F.distr.length === 1 ? '' : 's'} noted · ${F.switches} app switch${F.switches === 1 ? '' : 'es'}</p>` : '<p class="mut">Stretch, sip some water, rest your eyes.</p>'}</div>`;
  } else {
    const opts = D.tasks.filter(OPEN).filter(t => !ST.lowEnergy || prio(t) === 'High' || (t.est && t.est <= 30)).sort((a, b) => taskScore(b) - taskScore(a));
    top = `<div class="card focusbox" style="text-align:left"><h3>Start a session</h3>
${ST.lowEnergy ? '<p class="badge c2">🌙 Low-energy mode: short sessions, essential tasks only</p>' : ''}
<form data-sub="fstart"><div class="fld"><label>Length (minutes)</label><div class="chips">${[10, 15, 25, 45, 60].map(m => `<button type="button" class="chip" data-act="fpre" data-v="${m}">${m}</button>`).join('')}</div><input id="fdur" name="dur" type="number" min="1" max="240" value="${ST.lowEnergy ? 10 : F.dur}" inputmode="numeric"></div>
<div class="fld"><label>Break afterwards</label><select name="brk">${[[0, 'No break'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes']].map(([v, l]) => `<option value="${v}" ${F.brk === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
<div class="fld"><label>Task (optional)</label><select name="task"><option value="">No specific task</option>${opts.map(t => `<option value="${t.id}" ${t.id === F.task ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>
<div class="fld"><label>Subject (optional)</label><select name="subject">${subjOpts().map(([v, l]) => `<option value="${esc(v)}" ${v === F.subject ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
<div class="fld"><label>Topic (optional)</label><input name="topic" value="${esc(F.topic || '')}" placeholder="e.g. Brachial plexus"></div>
<button class="btn" style="width:100%">▶ Start</button></form>
<div class="row between wrap" style="margin-top:12px"><label class="row"><input type="checkbox" data-chg="lowen" ${ST.lowEnergy ? 'checked' : ''}> Low-energy mode</label>${ST.lowEnergy ? '<button class="btn ghost sm" data-act="gentle">Gentle reset</button>' : ''}</div></div>`;
  }
  const cnt = {};
  D.sessions.forEach(s => (s.distr || []).forEach(d => { const k = d.t.toLowerCase().trim(); cnt[k] = (cnt[k] || 0) + 1; }));
  const rec = Object.entries(cnt).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tasksUsed = new Set(ss.map(s => s.task || '-')).size;
  return hd('Focus') + top + `<div class="grid" style="margin-top:14px"><div class="card"><h3>Today</h3><p>${ss.length} session${ss.length === 1 ? '' : 's'} · ${mins} min</p>${ss.length ? `<p class="mut sm">Switched between ${tasksUsed} task${tasksUsed === 1 ? '' : 's'}</p>` : ''}${ss.map(s => `<div class="mini">${s.mins} min ${s.task && D.tasks.find(t => t.id === s.task) ? '· ' + esc(D.tasks.find(t => t.id === s.task).title) : s.topic ? '· ' + esc(s.topic) : ''}</div>`).join('')}</div>
<div class="card"><h3>Recurring distractions</h3>${rec.length ? rec.map(([k, n]) => `<div class="mini">${esc(k)} <span class="badge">×${n}</span></div>`).join('') : empty('Patterns appear here once the same distraction shows up twice.')}</div></div>`;
};
A.fpre = el => { $('#fdur').value = el.dataset.v; };
A.lowen = el => { ST.lowEnergy = el.checked; if (el.checked) F.dur = 10; saveST(); render(); };
A.gentle = () => modal(`<h3>Gentle reset 🌿</h3><p>Hard days happen. Let's make today lighter:</p><div class="mini">1. Take three slow breaths and drink some water.</div><div class="mini">2. Pick just one small task (10 minutes or less).</div><div class="mini">3. Start a short session. Stopping early is fine.</div><div class="row end" style="margin-top:12px"><button class="btn" onclick="this.closest('.overlay').remove()">Okay</button></div>`);
A.fstart = el => {
  const e = el.elements, dur = Math.max(1, Math.min(240, +e.dur.value || 25));
  Object.assign(F, { mode: 'focus', dur, brk: +e.brk.value, task: e.task.value, subject: e.subject.value, topic: e.topic.value.trim(), distr: [], switches: 0, breaksTaken: 0, active: true, running: true, left: dur * 60, endAt: Date.now() + dur * 60000 });
  saveF(); render();
};
A.fpause = () => { F.left = fLeft(); F.running = false; saveF(); render(); };
A.fresume = () => { F.endAt = Date.now() + F.left * 1000; F.running = true; saveF(); render(); };
A.fcancel = () => confirmBox('Cancel this session without saving it?', () => { F.active = false; F.running = false; saveF(); render(); }, 'Cancel session');
A.ffinish = () => fdone(true);
A.fdistr = el => { const t = el.elements.t.value.trim(); if (t) { F.distr.push({ t, at: new Date().toISOString() }); saveF(); toast('Noted. Back to it 💜'); render(); } };
A.fdump = el => { const t = el.elements.t.value.trim(); if (t) { put('notes', { title: t.slice(0, 40), body: t, tag: 'Brain dump' }); toast('Parked for later'); render(); } };

function fdone(early) {
  const total = (F.mode === 'focus' ? F.dur : F.brk) * 60, el = Math.max(0, total - fLeft());
  const mins = early ? Math.max(1, Math.round(el / 60)) : F.dur;
  F.running = false; F.active = false; saveF();
  if (F.mode === 'break') { beep(); toast('Break over. Ready when you are 🌿'); render(); return; }
  beep(); vib();
  const s = { mode: 'focus', date: today(), mins, task: F.task, subject: F.subject, topic: F.topic, distr: F.distr.slice(), switches: F.switches, breaks: 0, ended: new Date().toISOString() };
  put('sessions', s);
  const t = D.tasks.find(x => x.id === F.task);
  if (t) { t.actual = (t.actual || 0) + mins; if (t.status === 'Not started') t.status = 'In progress'; put('tasks', t); }
  const todayMins = D.sessions.filter(x => x.mode === 'focus' && x.date === today()).reduce((a, x) => a + x.mins, 0);
  const intro = `<p class="center" style="font-size:2rem;margin:0">🎉</p><p class="center"><b>${mins} minutes focused.</b> ${encourage[Math.floor(Math.random() * encourage.length)]}<br><span class="mut sm">${todayMins} min today</span></p>`;
  const after = () => { if (F.brk > 0 && !early) breakPrompt(); render(); };
  formModal(early ? 'Session ended' : 'Session complete!', [{ k: 'topic', label: 'Topics studied / what you did', type: 'text' }, { k: 'understanding', label: 'How well did you understand it?', type: 'select', opts: [['', 'Skip'], ['1', '1 · Barely'], ['2', '2 · Partly'], ['3', '3 · Okay'], ['4', '4 · Well'], ['5', '5 · Very well']] }, { k: 'dnote', label: 'Distraction notes', type: 'textarea', rows: 2 }], { topic: s.topic },
    out => { s.topic = out.topic; s.understanding = out.understanding ? +out.understanding : null; s.dnote = out.dnote; put('sessions', s); after(); }, intro);
  render();
}
function breakPrompt() {
  const o = modal(`<h3>☕ Time for a break?</h3><p>A ${F.brk}-minute break is ready.</p><div class="row end"><button class="btn ghost" data-n>Skip</button><button class="btn" data-y>Start break</button></div>`);
  o.querySelector('[data-n]').onclick = o.close;
  o.querySelector('[data-y]').onclick = () => { o.close(); const last = D.sessions.filter(x => x.mode === 'focus').pop(); if (last) { last.breaks = (last.breaks || 0) + 1; put('sessions', last); } Object.assign(F, { mode: 'break', active: true, running: true, left: F.brk * 60, endAt: Date.now() + F.brk * 60000 }); saveF(); go('focus'); };
}

/* ====================== MEMORY ====================== */
const dueTs = r => new Date(r.date + 'T' + (r.time || '09:00')).getTime();
const advLabel = m => m >= 1440 ? `${m / 1440} day${m > 1440 ? 's' : ''}` : m >= 60 ? `${m / 60} hour${m > 60 ? 's' : ''}` : `${m} minutes`;
const ADV = [['', 'None'], ['10', '10 minutes before'], ['60', '1 hour before'], ['1440', '1 day before'], ['2880', '2 days before']];
FORMS.reminders = {
  name: 'reminder', def: () => ({ type: 'General', date: today(), time: mtime(Math.min(23 * 60, (new Date().getHours() + 1) * 60)), repeat: 'none', adv1: '', adv2: '' }),
  fields: () => [{ k: 'title', label: 'Remind me to…', req: 1 }, { k: 'type', label: 'Type', type: 'select', opts: ['General', 'Medication', 'Appointment', 'Follow-up', 'Deadline', 'Preparation'] },
    { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' },
    { k: 'repeat', label: 'Repeats', type: 'select', opts: [['none', 'Once'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] },
    { k: 'adv1', label: 'Advance alert 1', type: 'select', opts: ADV }, { k: 'adv2', label: 'Advance alert 2', type: 'select', opts: ADV }, { k: 'notes', label: 'Notes', type: 'textarea', rows: 2 }],
  after: o => { o.fired = []; o.done = false; }
};
const NTAGS = ['Note', 'Brain dump', 'Important info', 'Person', 'Remember later', 'Link / document', 'Procedure', 'Important date'];
FORMS.notes = {
  name: 'note', def: () => ({ tag: 'Note' }),
  fields: () => [{ k: 'title', label: 'Title', req: 1 }, { k: 'tag', label: 'Type', type: 'select', opts: NTAGS }, { k: 'body', label: 'Details', type: 'textarea', rows: 5 },
    { k: 'date', label: 'Date (for important dates, optional)', type: 'date' }, { k: 'link', label: 'Link (optional)', type: 'url', ph: 'https://' }]
};
const LTPL = {
  Packing: ['Clothes', 'Toiletries', 'Phone charger', 'Medication', 'ID and documents', 'Water bottle', 'Snacks'],
  Shopping: ['Fruits and vegetables', 'Staples', 'Toiletries', 'Stationery'],
  College: ['Notebooks and pens', 'ID card', 'Lab coat / uniform', 'Laptop or tablet and charger', 'Assignments to submit', 'Water bottle'],
  'Clinical posting': ['Uniform and ID', 'Assessment tools', 'Notebook', 'Hand sanitiser', 'Case notes', 'Posting schedule'],
  Household: ['Laundry', 'Tidy room', 'Dishes', 'Plan meals', 'Water the plants'],
  'Exam preparation': ['Hall ticket', 'Pens and pencils', 'Water', 'Revise key topics', 'Plan travel', 'Sleep early'],
  Blank: []
};
const advDate = (r) => {
  const d = pd(r.date);
  if (r.repeat === 'daily') d.setDate(d.getDate() + 1); else if (r.repeat === 'weekly') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
  return fmt(d);
};
function remCard(r, missed) {
  return `<div class="item"><div class="grow"><div class="ttl">${esc(r.title)}</div><div class="meta"><span class="badge ${missed ? 'late' : ''}">⏰ ${nice(r.date)} ${esc(r.time || '')}</span><span class="badge">${esc(r.type)}</span>${r.repeat !== 'none' ? `<span class="badge">repeats ${r.repeat}</span>` : ''}${[r.adv1, r.adv2].filter(Boolean).map(a => `<span class="badge">alert ${advLabel(+a)} before</span>`).join('')}</div>${r.notes ? `<div class="sm mut">${esc(r.notes)}</div>` : ''}${missed ? `<div class="row wrap" style="margin-top:6px"><button class="btn sm" data-act="rdone" data-id="${r.id}">Done</button><button class="btn ghost sm" data-act="rsnooze" data-id="${r.id}" data-m="1h">+1 hour</button><button class="btn ghost sm" data-act="rsnooze" data-id="${r.id}" data-m="tom">Tomorrow</button></div>` : ''}</div><div class="acts">${missed ? '' : `<button class="ibtn" data-act="rdone" data-id="${r.id}" aria-label="Done">✓</button>`}<button class="ibtn" data-act="edit" data-s="reminders" data-id="${r.id}">✏️</button><button class="ibtn" data-act="del" data-s="reminders" data-id="${r.id}">🗑</button></div></div>`;
}
V.mem = () => {
  const k = T.mem; let body = '', add = '';
  if (k === 'reminders') {
    add = `<button class="btn" data-act="add" data-s="reminders">+ Reminder</button>`;
    const now = Date.now(), open = D.reminders.filter(r => !r.done), missed = open.filter(r => dueTs(r) < now).sort((a, b) => dueTs(a) - dueTs(b)), up = open.filter(r => dueTs(r) >= now).sort((a, b) => dueTs(a) - dueTs(b)), dn = D.reminders.filter(r => r.done).slice(-5).reverse();
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    body = `<div class="card sm" style="margin-bottom:12px">Reminders alert you <b>while FocusFlow is open</b>. Alerts while the app is closed depend on your device and are not guaranteed. ${perm === 'default' ? '<button class="btn ghost sm" data-act="notifyperm">Enable notifications</button>' : perm === 'granted' ? '✓ Notifications enabled.' : perm === 'denied' ? 'Notifications are blocked in your browser settings.' : ''}</div>` +
      (missed.length ? `<h3>Missed</h3><div class="list">${missed.map(r => remCard(r, true)).join('')}</div>` : '') +
      `<h3 style="margin-top:14px">Upcoming</h3>` + (up.length ? `<div class="list">${up.map(r => remCard(r)).join('')}</div>` : empty('No upcoming reminders.')) +
      (dn.length ? `<details><summary>Recently done</summary>${dn.map(r => `<div class="mini mut">✓ ${esc(r.title)}</div>`).join('')}</details>` : '');
  }
  if (k === 'notes') {
    add = `<button class="btn" data-act="add" data-s="notes">+ Note</button>`;
    const l = D.notes.filter(n => T.ntag === 'all' || n.tag === T.ntag).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    body = `<select data-chg="ntag" style="max-width:260px;margin-bottom:12px"><option value="all">All types</option>${NTAGS.map(t => `<option ${T.ntag === t ? 'selected' : ''}>${t}</option>`).join('')}</select>` +
      (l.length ? `<div class="list">${l.map(n => `<div class="card"><div class="row between"><b class="ttl">${esc(n.title || 'Untitled')}</b><span class="row"><button class="ibtn" data-act="edit" data-s="notes" data-id="${n.id}">✏️</button><button class="ibtn" data-act="del" data-s="notes" data-id="${n.id}">🗑</button></span></div><div class="meta"><span class="badge">${esc(n.tag)}</span>${n.date ? `<span class="badge">📅 ${nice(n.date)}</span>` : ''}</div>${n.body && n.body !== n.title ? `<p style="white-space:pre-wrap">${esc(n.body)}</p>` : ''}${n.link ? `<p><a href="${/^https?:\/\//i.test(n.link) ? esc(n.link) : '#'}" target="_blank" rel="noopener noreferrer">${esc(n.link)}</a></p>` : ''}</div>`).join('')}</div>` : empty('No notes yet.'));
  }
  if (k === 'lists') {
    add = `<button class="btn" data-act="newlist">+ List</button>`;
    body = D.lists.length ? `<div class="grid">${D.lists.map(l => { const dn = l.items.filter(i => i.done).length; return `<div class="card"><div class="row between"><b>${esc(l.name)}</b><span class="mut sm">${dn}/${l.items.length}</span></div>${bar(l.items.length ? dn / l.items.length * 100 : 0)}${l.items.map((i, n) => `<div class="row"><label class="sub grow"><input type="checkbox" data-chg="litem" data-id="${l.id}" data-i="${n}" ${i.done ? 'checked' : ''}> <span class="${i.done ? 'mut' : ''}">${esc(i.t)}</span></label><button class="ibtn" data-act="ldel" data-id="${l.id}" data-i="${n}" aria-label="Remove item">✕</button></div>`).join('')}<form data-sub="ladd" data-id="${l.id}" class="row" style="margin-top:8px"><input name="t" placeholder="Add item" required><button class="btn ghost sm">Add</button></form><div class="row wrap" style="margin-top:8px"><button class="btn ghost sm" data-act="lreset" data-id="${l.id}">Uncheck all</button><button class="btn warn sm" data-act="del" data-s="lists" data-id="${l.id}">Delete list</button></div></div>`; }).join('')}</div>` : empty('Create a checklist: packing, shopping, college, clinical posting, household or exam preparation.');
  }
  return hd('Memory', add) + tabs('mem', [['reminders', 'Reminders'], ['notes', 'Notes'], ['lists', 'Checklists']]) + body;
};
FORMS.lists = { name: 'list', fields: () => [] };
A.ntag = el => { T.ntag = el.value; render(); };
A.notifyperm = () => { if ('Notification' in window) Notification.requestPermission().then(() => render()); };
A.rdone = el => {
  const r = D.reminders.find(x => x.id === el.dataset.id);
  if (r.repeat && r.repeat !== 'none') { do { r.date = advDate(r); } while (dueTs(r) < Date.now()); r.fired = []; toast('Done. Next one scheduled.'); } else r.done = true;
  put('reminders', r); render();
};
A.rsnooze = el => {
  const r = D.reminders.find(x => x.id === el.dataset.id), d = new Date();
  if (el.dataset.m === '1h') { d.setHours(d.getHours() + 1); r.date = fmt(d); r.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`; } else { r.date = addDays(today(), 1); }
  r.fired = []; put('reminders', r); render();
};
A.newlist = () => formModal('New checklist', [{ k: 'name', label: 'Name', req: 1 }, { k: 'tpl', label: 'Start from', type: 'select', opts: Object.keys(LTPL) }], { tpl: 'Blank' }, o => {
  put('lists', { name: o.name, items: (LTPL[o.tpl] || []).map(t => ({ t, done: false })) }); render();
});
A.litem = el => { const l = D.lists.find(x => x.id === el.dataset.id); l.items[+el.dataset.i].done = el.checked; put('lists', l); render(); };
A.ldel = el => { const l = D.lists.find(x => x.id === el.dataset.id); l.items.splice(+el.dataset.i, 1); put('lists', l); render(); };
A.ladd = el => { const l = D.lists.find(x => x.id === el.dataset.id), t = el.elements.t.value.trim(); if (t) { l.items.push({ t, done: false }); put('lists', l); render(); } };
A.lreset = el => { const l = D.lists.find(x => x.id === el.dataset.id); l.items.forEach(i => i.done = false); put('lists', l); render(); };

function checkReminders() {
  const now = Date.now(); let any = false;
  D.reminders.forEach(r => {
    if (r.done) return;
    r.fired = r.fired || []; const due = dueTs(r); let ch = false;
    [[r.adv1, 'a1'], [r.adv2, 'a2'], [0, 'due']].forEach(([m, key]) => {
      if (m === '' || m == null) return; m = +m; if (key !== 'due' && !m) return;
      const t = due - m * 60000;
      if (now >= t && !r.fired.includes(key)) {
        r.fired.push(key); ch = true;
        if (now - t < 12 * 36e5) { notify(key === 'due' ? '⏰ ' + r.title : 'Coming up: ' + r.title, key === 'due' ? 'Due now' : 'In ' + advLabel(m)); any = true; }
      }
    });
    if (ch) put('reminders', r);
  });
  if (any && !document.querySelector('.overlay') && (VIEW === 'mem' || VIEW === 'home')) render();
}
function dateAlerts() {
  const t = today();
  [['assignments', 'deadline', 'status', 'Submitted'], ['exams', 'date', null, null]].forEach(([s, f, sf, sv]) => {
    D[s].forEach(x => {
      const n = +x.remind || 0; if (!n || (sf && x[sf] === sv) || x[f] < t) return;
      if (t >= addDays(x[f], -n)) {
        const key = 'ff_al_' + x.id; let seen = null; try { seen = localStorage.getItem(key); } catch (e) { /* ignore */ }
        if (!seen) { try { localStorage.setItem(key, t); } catch (e) { /* ignore */ } notify(`${x.title}`, `Due ${countdown(x[f])}`); }
      }
    });
  });
}

/* ====================== MY LIFE ====================== */
const DAYS = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']];
FORMS.habits = { name: 'habit', def: () => ({ rest: [] }), fields: () => [{ k: 'name', label: 'Habit', req: 1 }, { k: 'rest', label: 'Rest days (don\u2019t break the streak)', type: 'multi', opts: DAYS }], after: o => { o.log = o.log || {}; } };
FORMS.routines = {
  name: 'routine', def: () => ({ kind: 'Morning' }),
  fields: () => [{ k: 'name', label: 'Routine name', req: 1 }, { k: 'kind', label: 'Type', type: 'select', opts: ['Morning', 'Evening', 'Daily personal care', 'Weekly', 'Household', 'Study preparation', 'Clinical preparation', 'Custom'] }, { k: 'itemsText', label: 'Steps (one per line)', type: 'textarea', rows: 6 }],
  pre: v => { v.itemsText = (v.items || []).join('\n'); },
  after: o => { o.items = lines(o.itemsText); delete o.itemsText; o.log = o.log || {}; }
};
FORMS.goals = {
  name: 'goal', def: () => ({ type: 'Weekly' }),
  fields: () => [{ k: 'title', label: 'Goal', req: 1 }, { k: 'type', label: 'Type', type: 'select', opts: ['Daily', 'Weekly', 'Monthly', 'Long-term', 'Personal project', 'Decluttering'] }, { k: 'target', label: 'Target date (optional)', type: 'date' }, { k: 'stepsText', label: 'Smaller steps (one per line; new lines are added)', type: 'textarea', rows: 5 }],
  after: (o, cur) => { const old = o.steps || []; o.steps = old.concat(lines(o.stepsText).map(t => ({ t, done: false }))); o.stepsText = ''; }
};
function streak(h) {
  let d = today(), n = 0; const rest = h.rest || [], log = h.log || {};
  if (!log[d]) d = addDays(d, -1);
  for (let i = 0; i < 500; i++) { if (log[d]) n++; else if (!rest.includes(String(pd(d).getDay()))) break; d = addDays(d, -1); }
  return n;
}
V.life = () => {
  const k = T.life; let body = '', add = '';
  if (k === 'habits') {
    add = `<button class="btn" data-act="add" data-s="habits">+ Habit</button>`;
    const days = [6, 5, 4, 3, 2, 1, 0].map(i => addDays(today(), -i));
    body = D.habits.length ? `<div class="grid">${D.habits.map(h => `<div class="card"><div class="row between"><b>${esc(h.name)}</b><span class="row"><span class="badge c6">🔥 ${streak(h)}</span><button class="ibtn" data-act="edit" data-s="habits" data-id="${h.id}">✏️</button><button class="ibtn" data-act="del" data-s="habits" data-id="${h.id}">🗑</button></span></div><div class="dotrow" style="margin-top:8px">${days.map(d => { const rest = (h.rest || []).includes(String(pd(d).getDay())), on = h.log && h.log[d]; return `<button class="${on ? 'on' : rest ? 'rest' : ''}" data-act="htog" data-id="${h.id}" data-d="${d}" aria-label="${nice(d)}${on ? ' done' : rest ? ' rest day' : ''}">${'SMTWTFS'[pd(d).getDay()]}</button>`; }).join('')}</div><p class="mut sm" style="margin-top:6px">Blue = rest day (keeps your streak).</p></div>`).join('')}</div>` : empty('Add a habit to start a streak with rest days.');
  }
  if (k === 'routines') {
    add = `<button class="btn" data-act="add" data-s="routines">+ Routine</button>`;
    body = D.routines.length ? `<div class="grid">${D.routines.map(r => { const lg = (r.log || {})[today()] || {}, dn = r.items.filter((_, i) => lg[i]).length; return `<div class="card"><div class="row between"><b>${esc(r.name)}</b><span class="row"><span class="badge">${esc(r.kind)}</span><button class="ibtn" data-act="edit" data-s="routines" data-id="${r.id}">✏️</button><button class="ibtn" data-act="del" data-s="routines" data-id="${r.id}">🗑</button></span></div>${bar(r.items.length ? dn / r.items.length * 100 : 0)}${r.items.map((t, i) => `<label class="sub"><input type="checkbox" data-chg="rtog" data-id="${r.id}" data-i="${i}" ${lg[i] ? 'checked' : ''}> <span>${esc(t)}</span></label>`).join('')}<p class="mut sm">${dn}/${r.items.length} today · resets each day</p></div>`; }).join('')}</div>` : empty('Create a morning, evening, study or clinical-prep routine.');
  }
  if (k === 'goals') {
    add = `<button class="btn" data-act="add" data-s="goals">+ Goal</button>`;
    body = D.goals.length ? `<div class="grid">${D.goals.map(g => { const dn = (g.steps || []).filter(s => s.done).length; return `<div class="card"><div class="row between"><b>${esc(g.title)}</b><span class="row"><button class="ibtn" data-act="edit" data-s="goals" data-id="${g.id}">✏️</button><button class="ibtn" data-act="del" data-s="goals" data-id="${g.id}">🗑</button></span></div><div class="meta"><span class="badge">${esc(g.type)}</span>${g.target ? `<span class="badge">🎯 ${nice(g.target)}</span>` : ''}</div>${bar((g.steps || []).length ? dn / g.steps.length * 100 : 0)}${(g.steps || []).map((s, i) => `<label class="sub"><input type="checkbox" data-chg="gtog" data-id="${g.id}" data-i="${i}" ${s.done ? 'checked' : ''}> <span>${esc(s.t)}</span></label>`).join('')}<p class="mut sm">${dn}/${(g.steps || []).length} steps</p></div>`; }).join('')}</div>` : empty('Set a goal and break it into small steps.');
  }
  if (k === 'mood') { body = moodPage(); add = `<button class="btn" data-act="moodpick">+ Log mood</button>`; }
  if (k === 'water') body = waterPage();
  return hd('My Life', add) + tabs('life', [['habits', 'Habits'], ['routines', 'Routines'], ['goals', 'Goals'], ['mood', '🌈 Mood'], ['water', '💧 Water']]) + body + (k !== 'habits' && k !== 'routines' ? '' : `<p class="mut sm" style="margin-top:14px">Shopping lists, wish lists and household checklists live in Memory → Checklists.</p>`);
};
A.htog = el => { const h = D.habits.find(x => x.id === el.dataset.id); h.log = h.log || {}; const d = el.dataset.d; if (h.log[d]) delete h.log[d]; else h.log[d] = true; put('habits', h); render(); };
A.rtog = el => { const r = D.routines.find(x => x.id === el.dataset.id); r.log = r.log || {}; const t = today(); r.log[t] = r.log[t] || {}; if (el.checked) r.log[t][el.dataset.i] = true; else delete r.log[t][el.dataset.i]; put('routines', r); render(); };
A.gtog = el => { const g = D.goals.find(x => x.id === el.dataset.id); g.steps[+el.dataset.i].done = el.checked; put('goals', g); render(); if (g.steps.every(s => s.done)) toast('Goal complete! 🎉'); };

/* ====================== CHECK-INS ====================== */
let journalOpen = false;
const SL = [['mood', 'Mood', '😞', '😊'], ['energy', 'Energy', '🪫', '⚡'], ['stress', 'Stress', '😌', '😣'], ['focus', 'Focus', '🌫', '🎯']];
const CQ = {
  morning: [['feeling', 'How are you feeling this morning?'], ['priorities', 'What matters most today?'], ['difficult', 'Anything that might be difficult?'], ['support', 'What support might help?']],
  evening: [['wins', 'Today\u2019s wins'], ['challenges', 'What was difficult?'], ['improve', 'What could go better tomorrow?'], ['gratitude', 'Something I\u2019m grateful for'], ['remember', 'Things to remember']]
};
const JTYPES = ['Journal', 'Daily highlight', 'Accomplishment', 'Challenge', 'Gratitude', 'Win / milestone', 'Brain dump', 'Weekly reflection'];
V.chk = () => {
  const k = T.chk; let body = '';
  const per = T.cp || (new Date().getHours() < 15 ? 'morning' : 'evening'), cur = D.checkins.find(c => c.id === today() + '-' + per) || {};
  if (k === 'checkin') {
    body = `<div class="chips">${['morning', 'evening'].map(p => `<button class="chip ${per === p ? 'on' : ''}" data-act="cp" data-p="${p}">${p === 'morning' ? '🌅 Morning' : '🌙 Evening'}</button>`).join('')}</div>
<form data-sub="chsave" data-p="${per}" class="card">${SL.map(([n, l, a, b]) => `<div class="slider"><div class="row"><label for="s_${n}"><b>${l}</b></label><span class="mut">${a} ↔ ${b}</span></div><input id="s_${n}" type="range" name="${n}" min="1" max="5" value="${cur[n] || 3}"></div>`).join('')}
${CQ[per].map(([n, l]) => `<div class="fld"><label for="q_${n}">${l}</label><textarea id="q_${n}" name="${n}" rows="2">${esc(cur[n] || '')}</textarea></div>`).join('')}<button class="btn" style="width:100%">Save ${per} check-in</button></form>`;
  }
  if (k === 'journal') {
    if (ST.pin && !journalOpen) body = `<div class="card center"><p>🔒 Your journal is private.</p><button class="btn" data-act="jopen">Unlock journal</button></div>`;
    else {
      const l = D.checkins.filter(c => c.type === 'entry').sort((a, b) => b.created.localeCompare(a.created));
      body = `<form data-sub="jadd" class="card stack"><div class="fld"><label>Type</label><select name="kind">${JTYPES.map(t => `<option>${t}</option>`).join('')}</select></div><textarea name="t" rows="5" placeholder="Write freely. This stays on your device." required></textarea><button class="btn">Save entry</button></form>
<div class="list" style="margin-top:14px">${l.map(e => `<div class="card"><div class="row between"><span class="badge">${esc(e.kind)}</span><span class="row"><span class="mut sm">${new Date(e.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span><button class="ibtn" data-act="jdel" data-id="${e.id}" aria-label="Delete entry">🗑</button></span></div><p style="white-space:pre-wrap">${esc(e.text)}</p></div>`).join('') || empty('No entries yet.')}</div>` + (ST.pin ? `<button class="btn ghost sm" data-act="jlock" style="margin-top:10px">Lock journal</button>` : '');
    }
  }
  if (k === 'insights') body = insights();
  return hd('Check-ins') + tabs('chk', [['checkin', 'Check-in'], ['journal', 'Journal'], ['insights', 'Insights']]) + body;
};
A.cp = el => { T.cp = el.dataset.p; render(); };
A.chsave = el => {
  const per = el.dataset.p, e = el.elements, o = { id: today() + '-' + per, type: 'check', period: per, date: today() };
  SL.forEach(([n]) => o[n] = +e[n].value); CQ[per].forEach(([n]) => o[n] = e[n].value.trim());
  const old = D.checkins.find(c => c.id === o.id); if (old) o.created = old.created;
  put('checkins', o); toast('Check-in saved 💜'); render();
};
A.jadd = el => { const t = el.elements.t.value.trim(); if (t) { put('checkins', { type: 'entry', kind: el.elements.kind.value, text: t, date: today() }); toast('Saved'); render(); } };
A.jdel = el => confirmBox('Delete this entry?', async () => { await del('checkins', el.dataset.id); render(); });
A.jopen = () => verifyPinModal(() => { journalOpen = true; render(); });
A.jlock = () => { journalOpen = false; render(); };
function insights() {
  if (!ST.insights) return `<div class="card"><p>Insights are turned off. You can enable them in Settings.</p></div>`;
  const from = addDays(today(), -6), cs = D.checkins.filter(c => c.type === 'check' && c.date >= from);
  if (!cs.length) return `<div class="card">${empty('Complete a few check-ins and a summary will appear here.')}</div>`;
  const avg = n => { const v = cs.filter(c => c[n]).map(c => c[n]); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'; };
  const byDay = {}; cs.forEach(c => { (byDay[c.date] = byDay[c.date] || []).push(c); });
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const dayAvg = (d, n) => { const v = (byDay[d] || []).filter(c => c[n]).map(c => c[n]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const best = days.filter(d => dayAvg(d, 'energy')).sort((a, b) => dayAvg(b, 'energy') - dayAvg(a, 'energy'))[0];
  const done = D.tasks.filter(t => t.completedOn && t.completedOn >= from).length;
  return `<div class="card"><h3>Your last 7 days</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">${SL.map(([n, l]) => `<div class="center"><div style="font-size:1.6rem;font-weight:700;color:var(--acc)">${avg(n)}</div><div class="mut sm">${l} (avg of 5)</div></div>`).join('')}</div>
<h3 style="margin-top:20px">Mood by day</h3><div class="weekbar" style="margin-bottom:26px">${days.map(d => `<div style="height:${dayAvg(d, 'mood') * 20}%"><span>${'SMTWTFS'[pd(d).getDay()]}</span></div>`).join('')}</div>
<p>You completed <b>${cs.length}</b> check-in${cs.length === 1 ? '' : 's'}, <b>${done}</b> task${done === 1 ? '' : 's'} and <b>${weekMinutes()}</b> focus minutes.</p>${best ? `<p>Energy was highest on <b>${pd(best).toLocaleDateString(undefined, { weekday: 'long' })}</b>.</p>` : ''}
<p class="mut sm">These are simple descriptions of what you recorded, not medical or diagnostic advice.</p></div>`;
}

/* ====================== SETTINGS & PRIVACY ====================== */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
const sel = (n, v, opts) => `<select data-chg="setsel" data-k="${n}" aria-label="${n}">${opts.map(([a, b]) => `<option value="${a}" ${String(v) === a ? 'selected' : ''}>${b}</option>`).join('')}</select>`;
const tog = (n, v, l) => `<label class="row" style="padding:6px 0"><input type="checkbox" data-chg="settog" data-k="${n}" ${v ? 'checked' : ''}> ${l}</label>`;
V.set = () => `${hd('Settings')}<div class="grid">
<div class="card"><h3>Appearance</h3><div class="fld"><label>Theme</label>${sel('theme', ST.theme, [['auto', 'Automatic (device)'], ['light', 'Light'], ['dark', 'Dark']])}</div>
<div class="fld"><label>Accent colour</label>${sel('accent', ST.accent, [['lavender', 'Lavender'], ['pink', 'Dusty pink'], ['sage', 'Sage'], ['blue', 'Powder blue']])}</div>
<div class="fld"><label>Font style</label>${sel('font', ST.font || 'cute', [['cute', 'Cute & rounded (Fredoka + Nunito)'], ['system', 'Device default']])}</div>
<div class="fld"><label>Text size</label>${sel('size', ST.size, [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']])}</div>
${tog('reduce', ST.reduce, 'Reduce animations')}${tog('sound', ST.sound, 'Sounds')}${tog('quiet', ST.quiet, 'Quiet mode (no sounds, vibration or notifications)')}${tog('insights', ST.insights, 'Show check-in insights')}</div>
<div class="card"><h3>Navigation</h3><p class="mut sm">Choose which sections appear in the menu.</p>${NAV.filter(n => n[0] !== 'home' && n[0] !== 'set').map(n => `<label class="row" style="padding:5px 0"><input type="checkbox" data-chg="navtog" data-k="${n[0]}" ${ST.hideNav.includes(n[0]) ? '' : 'checked'}> ${n[1]} ${n[2]}</label>`).join('')}<button class="btn ghost sm" data-act="go" data-v="home" style="margin-top:8px" onclick="CUSTOM=true">Rearrange Home widgets</button></div>
<div class="card"><h3>Privacy &amp; lock</h3><p class="sm">${ST.pin ? '🔒 App PIN is on.' : 'No PIN set.'}</p><div class="row wrap"><button class="btn" data-act="setpin">${ST.pin ? 'Change PIN' : 'Set PIN'}</button>${ST.pin ? '<button class="btn ghost" data-act="locknow">Lock now</button><button class="btn warn" data-act="rmpin">Remove PIN</button>' : ''}</div>
<p class="mut sm" style="margin-top:8px">A PIN keeps casual viewers out of the app. It is <b>not encryption</b>: your data is stored unencrypted on this device. No analytics, no ads, no accounts. ${syncOn() ? 'Sync sends only encrypted data to your own GitHub account.' : 'No data leaves your device.'}</p></div>
${syncCard()}<input type="file" id="mergefile" accept=".json,application/json" hidden>
<div class="card"><h3>Backup &amp; restore</h3><p class="mut sm">Your data lives on this device${syncOn() ? ' and in your encrypted sync copy' : ''}. Export a backup regularly (for example weekly) and keep it in Files or Drive.</p><div class="row wrap"><button class="btn" data-act="exportjson">Export backup</button><button class="btn ghost" data-act="importpick">Restore backup</button><button class="btn ghost" data-act="exportics">Export calendar (.ics)</button></div><input type="file" id="importfile" accept=".json,application/json" hidden></div>
<div class="card"><h3>Notifications &amp; install</h3><p class="sm mut">Reminders alert you while the app is open. Closed-app alerts depend on your device and aren't guaranteed.</p><div class="row wrap">${'Notification' in window && Notification.permission === 'default' ? '<button class="btn ghost" data-act="notifyperm">Enable notifications</button>' : ''}${deferredInstall ? '<button class="btn" data-act="install">Install app</button>' : ''}</div><p class="sm mut" style="margin-top:8px"><b>iPad:</b> Share ▸ Add to Home Screen. <b>Android:</b> browser menu ▸ Install app.</p></div>
<div class="card"><h3>Your data</h3><p class="sm">${STORES.reduce((a, s) => a + D[s].length, 0)} records stored on this device.</p><button class="btn warn" data-act="clearall">Clear all data…</button></div></div>`;
A.setsel = el => { ST[el.dataset.k] = el.value; saveST(); applyLook(); render(); };
A.settog = el => { ST[el.dataset.k] = el.checked; saveST(); applyLook(); render(); };
A.navtog = el => { const k = el.dataset.k; ST.hideNav = ST.hideNav.filter(x => x !== k); if (!el.checked) ST.hideNav.push(k); saveST(); render(); };
A.install = () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } };

/* PIN */
const canPin = () => !!(window.crypto && crypto.subtle);
async function hashPin(pin, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256);
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function verifyPinModal(ok) {
  const o = modal(`<h3>Enter PIN</h3><form><input name="p" type="password" inputmode="numeric" autocomplete="off" required><div class="row end" style="margin-top:10px"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Unlock</button></div></form>`);
  o.querySelector('[data-x]').onclick = o.close;
  o.querySelector('form').onsubmit = async e => { e.preventDefault(); if (await hashPin(o.querySelector('[name=p]').value, ST.salt) === ST.pin) { o.close(); ok(); } else toast('Wrong PIN'); };
}
A.setpin = () => {
  if (!canPin()) return toast('PIN needs a secure (https) connection');
  const go2 = () => formModal('Set a PIN', [{ k: 'a', label: 'New PIN (at least 4 digits)', type: 'password', req: 1 }, { k: 'b', label: 'Repeat PIN', type: 'password', req: 1 }], {}, o => {
    if (!/^\d{4,12}$/.test(o.a)) return 'Use 4–12 digits'; if (o.a !== o.b) return 'PINs do not match';
    const salt = uid() + uid(); hashPin(o.a, salt).then(h => { ST.salt = salt; ST.pin = h; saveST(); toast('PIN set'); render(); });
  });
  ST.pin ? verifyPinModal(go2) : go2();
};
A.rmpin = () => verifyPinModal(() => { ST.pin = null; ST.salt = null; journalOpen = false; saveST(); toast('PIN removed'); render(); });
A.locknow = () => showLock();
function showLock() {
  if (!ST.pin || document.querySelector('.lock')) return;
  const l = document.createElement('div'); l.className = 'lock';
  l.innerHTML = `<form class="card"><h2>FocusFlow 🔒</h2><p class="mut">Enter your PIN</p><input name="p" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" autofocus><button class="btn" style="width:100%;margin-top:12px">Unlock</button></form>`;
  document.body.appendChild(l); journalOpen = false;
  l.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const inp = l.querySelector('input');
    if (await hashPin(inp.value, ST.salt) === ST.pin) { l.remove(); render(); } else { inp.value = ''; inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 400); }
  };
  setTimeout(() => l.querySelector('input').focus(), 50);
}

/* export / import / delete */
function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
A.exportjson = () => {
  const { pin, salt, ...st } = ST;
  dl(new Blob([JSON.stringify({ app: 'focusflow', version: 1, exported: new Date().toISOString(), settings: st, data: D }, null, 1)], { type: 'application/json' }), `focusflow-backup-${today()}.json`);
  toast('Backup exported. Save it somewhere safe.');
};
A.importpick = () => $('#importfile').click();
document.addEventListener('change', e => {
  if (e.target.id !== 'importfile' || !e.target.files[0]) return;
  const f = e.target.files[0], rd = new FileReader();
  rd.onload = () => {
    let j; try { j = JSON.parse(rd.result); } catch (x) { return toast('That file could not be read'); }
    if (j.app !== 'focusflow' || !j.data) return toast('That is not a FocusFlow backup');
    confirmBox('Restoring replaces everything currently in the app with the backup. Continue?', async () => {
      for (const s of STORES) { await clearStore(s); D[s] = []; for (const o of (j.data[s] || [])) await put(s, o); }
      const keep = { pin: ST.pin, salt: ST.salt }; Object.assign(ST, j.settings || {}, keep); await saveST();
      fillWidgets();
      applyLook(); toast('Backup restored ✓'); render();
    }, 'Restore');
  };
  rd.readAsText(f); e.target.value = '';
});
A.exportics = () => {
  const e2 = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const dt = s => s.replace(/-/g, ''), tm = t => t.replace(':', '') + '00';
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FocusFlow//EN'];
  D.events.forEach(ev => {
    out.push('BEGIN:VEVENT', `UID:${ev.id}@focusflow`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `SUMMARY:${e2(ev.title)}`);
    if (ev.allDay || !ev.start) { out.push(`DTSTART;VALUE=DATE:${dt(ev.date)}`, `DTEND;VALUE=DATE:${dt(addDays(ev.endDate || ev.date, 1))}`); }
    else { out.push(`DTSTART:${dt(ev.date)}T${tm(ev.start)}`, `DTEND:${dt(ev.date)}T${tm(ev.end || ev.start)}`); }
    const r = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[ev.repeat]; if (r) out.push(`RRULE:FREQ=${r}${ev.until ? ';UNTIL=' + dt(ev.until) : ''}`);
    if (ev.notes) out.push(`DESCRIPTION:${e2(ev.notes)}`); out.push('END:VEVENT');
  });
  D.exams.forEach(x => out.push('BEGIN:VEVENT', `UID:${x.id}@focusflow`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `SUMMARY:${e2('Exam: ' + x.title)}`, `DTSTART;VALUE=DATE:${dt(x.date)}`, `DTEND;VALUE=DATE:${dt(addDays(x.date, 1))}`, 'END:VEVENT'));
  out.push('END:VCALENDAR');
  dl(new Blob([out.join('\r\n')], { type: 'text/calendar' }), 'focusflow-calendar.ics'); toast('Calendar file exported');
};
A.clearall = () => {
  const o = modal(`<h3>Clear all data?</h3><p>This permanently deletes every task, note, journal entry and setting on this device${syncOn() ? ' and turns sync off here (your encrypted cloud copy is kept, so you can reconnect later)' : ''}. Export a backup first if you might want it back.</p><form><input name="c" placeholder="Type DELETE to confirm" autocomplete="off"><div class="row end" style="margin-top:10px"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn warn">Delete everything</button></div></form>`);
  o.querySelector('[data-x]').onclick = o.close;
  o.querySelector('form').onsubmit = async e => {
    e.preventDefault(); if (o.querySelector('[name=c]').value.trim() !== 'DELETE') return toast('Type DELETE to confirm');
    for (const s of STORES) await clearStore(s);
    await new Promise(r => { const q = tx('kv', 'readwrite').clear(); q.onsuccess = r; q.onerror = r; });
    try { Object.keys(localStorage).filter(k => k.startsWith('ff_')).forEach(k => localStorage.removeItem(k)); } catch (x) { /* ignore */ }
    location.reload();
  };
};
