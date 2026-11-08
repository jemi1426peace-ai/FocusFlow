'use strict';
/* FocusFlow — Home, Tasks, Academics, Calendar */

const CATS = ['College / Academics', 'Clinical postings', 'Personal', 'Household', 'Health and self-care', 'Social commitments', 'Financial / Shopping', 'Other'];
const STAT = ['Not started', 'In progress', 'Completed', 'Postponed', 'Cancelled', 'Partially completed'];
const OPEN = t => t.status !== 'Completed' && t.status !== 'Cancelled';
const PW = { High: 3, Medium: 2, Low: 1 };
const catCls = c => 'c' + Math.max(0, CATS.indexOf(c));

/* rule-based priority: deadline closeness + long effort */
function prio(t) {
  if (t.priority && t.priority !== 'Auto') return t.priority;
  let s = 1;
  if (t.due) { const d = diffDays(today(), t.due); s = d <= 1 ? 3 : d <= 3 ? 2 : 1; }
  if ((t.est || 0) >= 120 && s < 3) s++;
  return ['', 'Low', 'Medium', 'High'][s];
}
const taskScore = t => PW[prio(t)] * 20 + (t.due ? Math.max(0, 14 - diffDays(today(), t.due)) : 0);
const subjName = id => (D.subjects.find(s => s.id === id) || {}).name || 'General';
const subjOpts = () => [['', 'General']].concat(D.subjects.map(s => [s.id, s.name]));

/* ====================== HOME ====================== */
let CUSTOM = false;
const WT = Object.fromEntries(WIDGETS);

function upcoming(days) {
  const t0 = today(), t1 = addDays(t0, days), out = [];
  D.tasks.filter(t => OPEN(t) && t.due && t.due >= t0 && t.due <= t1).forEach(t => out.push({ d: t.due, ic: '✅', t: t.title }));
  D.assignments.filter(a => a.status !== 'Submitted' && a.deadline && a.deadline >= t0 && a.deadline <= t1).forEach(a => out.push({ d: a.deadline, ic: '📝', t: a.title }));
  D.exams.filter(e => e.date >= t0 && e.date <= t1).forEach(e => out.push({ d: e.date, ic: '🎓', t: e.title }));
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
const W = {
  priorities() {
    const l = D.tasks.filter(OPEN).sort((a, b) => taskScore(b) - taskScore(a)).slice(0, ST.lowEnergy ? 2 : 3);
    return l.length ? l.map(t => `<div class="mini"><span class="badge p${PW[prio(t)]}">${prio(t)}</span> ${esc(t.title)}</div>`).join('') : empty('Nothing pressing. Enjoy the calm ✨');
  },
  tasks() {
    let l = D.tasks.filter(t => OPEN(t) && t.due && t.due <= today());
    if (ST.lowEnergy) l = l.filter(t => prio(t) === 'High' || (t.est && t.est <= 30));
    return l.length ? l.map(t => `<label class="sub"><input type="checkbox" data-chg="tdone" data-id="${t.id}"> <span>${esc(t.title)}</span></label>`).join('') + `<button class="btn ghost sm" data-act="go" data-v="tasks">All tasks</button>` : empty('No tasks due today.') + `<button class="btn ghost sm" data-act="add" data-s="tasks">+ Add task</button>`;
  },
  timetable() {
    const l = dayItems(today()), n = new Date(), now = n.getHours() * 60 + n.getMinutes();
    let next = l.find(i => i.a != null && i.a > now);
    const rows = l.map(i => {
      const live = i.a != null && i.a <= now && (i.b != null ? i.b > now : i.a + 1 > now - 0), past = i.a != null && !live && (i.b != null ? i.b <= now : i.a < now);
      const tag = live ? '<span class="tt-tag now">Now</span>' : i === next ? `<span class="tt-tag">Next · ${i.a - now < 60 ? 'in ' + (i.a - now) + ' min' : 'at ' + mtime(i.a)}</span>` : '';
      const act = i.k === 'event' ? `data-act="edit" data-s="events" data-id="${i.id}"` : i.k === 'task' ? `data-act="edit" data-s="tasks" data-id="${i.id}"` : `data-act="go" data-v="cal"`;
      return `<button class="tt-row ${live ? 'live' : ''} ${past ? 'past' : ''} ${i.k === 'event' ? kcls(i.cal) : 'kx'}" ${act}><span class="tt-time">${esc(i.time)}</span><span class="tt-ttl">${i.ic} ${esc(i.title)}</span>${tag}</button>`;
    }).join('');
    return (rows ? `<div class="tt">${rows}</div>` : empty('Nothing scheduled today. Add classes, duties or study blocks — repeat them on selected days to build your weekly timetable.')) +
      `<div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="add" data-s="events" data-date="${today()}">+ Add to timetable</button><button class="btn ghost sm" data-act="ttday">Day view</button></div>`;
  },
  deadlines() {
    const l = upcoming(14).slice(0, 6); return l.length ? l.map(i => `<div class="mini">${i.ic} ${esc(i.t)} <span class="mut sm">· ${countdown(i.d)}</span></div>`).join('') : empty('No deadlines in the next two weeks.');
  },
  reminders() {
    const now = Date.now(), open = D.reminders.filter(r => !r.done), missed = open.filter(r => dueTs(r) < now).length;
    const l = open.filter(r => dueTs(r) >= now).sort((a, b) => dueTs(a) - dueTs(b)).slice(0, 3);
    return (missed ? `<p class="badge late">${missed} missed</p>` : '') + (l.length ? l.map(r => `<div class="mini">⏰ ${esc(r.title)} <span class="mut sm">· ${nice(r.date)} ${esc(r.time || '')}</span></div>`).join('') : empty('No upcoming reminders.')) + `<button class="btn ghost sm" data-act="go" data-v="mem">Open Memory</button>`;
  },
  focus() {
    if (F.active) return `<p class="center timer" style="font-size:2.4rem">${clock(fLeft())}</p><p class="center mut">${F.mode === 'focus' ? 'Focusing' : 'On a break'}${F.running ? '' : ' (paused)'}</p><button class="btn" data-act="go" data-v="focus" style="width:100%">Open timer</button>`;
    return `<p class="mut">Ready when you are. Pick a length each time.</p><button class="btn" data-act="go" data-v="focus" style="width:100%">Start a focus session</button>`;
  },
  checkin() {
    const d = today(), m = D.checkins.find(c => c.id === d + '-morning'), e = D.checkins.find(c => c.id === d + '-evening');
    return `<div class="row wrap"><button class="btn ${m ? 'ghost' : ''} sm" data-act="chgo" data-p="morning">${m ? '✓ ' : ''}Morning</button><button class="btn ${e ? 'ghost' : ''} sm" data-act="chgo" data-p="evening">${e ? '✓ ' : ''}Evening</button></div>`;
  },
  progress() {
    const td = D.tasks.filter(t => t.due === today() && t.status !== 'Cancelled'), dn = td.filter(t => t.status === 'Completed').length;
    const wk = weekMinutes(), goal = ST.studyGoal || 0;
    const tp = D.subjects.flatMap(s => s.units.flatMap(u => u.topics)), sy = tp.length ? Math.round(tp.filter(t => t.done).length / tp.length * 100) : 0;
    return `<p class="sm">Today's tasks: ${dn}/${td.length}</p>${bar(td.length ? dn / td.length * 100 : 0)}<p class="sm">Study this week: ${wk} min${goal ? ` of ${goal}` : ''}</p>${bar(goal ? wk / goal * 100 : 0)}<p class="sm">Syllabus covered: ${sy}%</p>${bar(sy)}`;
  },
  calendar() {
    const n = new Date(); return monthGrid(n.getFullYear(), n.getMonth(), true) + `<button class="btn ghost sm" data-act="go" data-v="cal" style="margin-top:8px">Open calendar</button>`;
  },
  notes() {
    const l = D.notes.slice().sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 3);
    return `<form data-sub="qnote" class="stack"><textarea name="t" rows="2" placeholder="Brain dump… capture it now, sort it later" required></textarea><button class="btn sm">Save note</button></form>` + l.map(n => `<div class="mini">📝 ${esc(n.title || (n.body || '').slice(0, 50))}</div>`).join('');
  }
};
function weekMinutes() {
  const mon = addDays(today(), -((new Date().getDay() + 6) % 7));
  return D.sessions.filter(s => s.mode === 'focus' && s.date >= mon).reduce((a, s) => a + (s.mins || 0), 0);
}
function lateBanner() {
  const n = D.tasks.filter(t => OPEN(t) && t.due && t.due < today()).length;
  return n ? `<div class="banner"><b>${n} unfinished task${n > 1 ? 's' : ''}</b> from earlier. Reschedule, break down or remove them?<div style="margin-top:8px"><button class="btn sm" data-act="go" data-v="tasks">Review now</button></div></div>` : '';
}
const WICON = { mood: '🌈', water: '💧', priorities: '🌟', tasks: '✅', timetable: '🗓️', spirit: '📖', deadlines: '⏳', reminders: '⏰', focus: '🎯', checkin: '💭', progress: '📈', calendar: '📅', notes: '📝' };
const WTINT = { mood: 'pink', water: 'blue', priorities: 'lav', tasks: 'sage', timetable: 'blue', spirit: 'sage', deadlines: 'pink', reminders: 'lav', focus: 'lav', checkin: 'pink', progress: 'sage', calendar: 'blue', notes: 'sage' };
const CHEERS = ['Small steps still move you forward 🐾', 'You don\u2019t have to do it all today 🌷', 'Progress, not perfection ✨', 'Drink water, take breaks, be kind to yourself 💧',
  'One task at a time. You\u2019ve got this 💪', 'Rest is productive too 🌙', 'Proud of you for showing up 💜', 'Tiny wins count. Celebrate them 🎈', 'Breathe in, breathe out. Begin again 🍃'];
function heroArt(hr) {
  return hr < 12 ? '🌤️' : hr < 17 ? '🌻' : hr < 21 ? '🌇' : '🌙';
}
V.home = () => {
  const now = new Date(), hr = now.getHours(), g = hr < 5 ? 'Up late?' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const ws = ST.widgets.filter(w => CUSTOM || w.on);
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  const due = D.tasks.filter(t => OPEN(t) && t.due && t.due <= today()).length;
  const mv = dayMood(today()), wn = wGet(today());
  const fm = D.sessions.filter(x => x.mode === 'focus' && x.date === today()).reduce((a, x) => a + (x.mins || 0), 0);
  const stat = (ic, val, lab, v, lt) => `<button class="hstat" data-act="${v ? 'go' : 'moodpick'}" ${v ? `data-v="${v}"` : ''} ${lt ? `data-life="${lt}"` : ''}><span>${ic}</span><b>${val}</b><small>${lab}</small></button>`;
  return `<section class="hero"><div class="hero-txt"><p class="hello">${g}! ${heroArt(hr)}</p>
<p class="mut">${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${ST.lowEnergy ? ' · Low-energy mode on 🌙' : ''} <button class="syncbadge" data-sync data-act="go" data-v="set" hidden></button></p>
<p class="cheer">${CHEERS[doy % CHEERS.length]}</p></div>
<button class="btn ghost sm hero-btn" data-act="custom">${CUSTOM ? '✓ Done' : '✏️ Customise'}</button>
<div class="hstats">${stat('✅', due, due === 1 ? 'task today' : 'tasks today', 'tasks')}${stat('💧', `${wn}/${wGoal()}`, 'glasses', 'life', 'water')}${stat(mv ? moodOf(mv)[1] : '🙂', mv ? moodOf(mv)[2] : 'Log', 'mood', '')}${stat('🎯', fm, 'focus min', 'focus')}</div></section>
${lateBanner()}${CUSTOM ? '<p class="mut sm">Use ▲ ▼ to reorder and 👁 to show or hide cards.</p>' : ''}<div class="grid hgrid">` +
    ws.map(w => `<section class="card wcard t-${WTINT[w.id] || 'lav'} ${w.on ? '' : 'off'}"><div class="row between whd"><h3><span class="wic">${WICON[w.id] || '✨'}</span>${WT[w.id]}</h3>${CUSTOM ? `<span class="row"><button class="ibtn" data-act="wmove" data-id="${w.id}" data-d="-1" aria-label="Move up">▲</button><button class="ibtn" data-act="wmove" data-id="${w.id}" data-d="1" aria-label="Move down">▼</button><button class="ibtn" data-act="wtoggle" data-id="${w.id}" aria-label="Show or hide">${w.on ? '👁' : '🚫'}</button></span>` : ''}</div>${W[w.id]()}</section>`).join('') + '</div>';
};
A.custom = () => { CUSTOM = !CUSTOM; render(); };
A.ttday = () => { C.sel = today(); C.y = new Date().getFullYear(); C.m = new Date().getMonth(); T.cal = 'day'; go('cal'); };
A.wmove = el => {
  const i = ST.widgets.findIndex(w => w.id === el.dataset.id), j = i + +el.dataset.d;
  if (j < 0 || j >= ST.widgets.length) return;
  [ST.widgets[i], ST.widgets[j]] = [ST.widgets[j], ST.widgets[i]]; saveST(); render();
};
A.wtoggle = el => { const w = ST.widgets.find(x => x.id === el.dataset.id); w.on = !w.on; saveST(); render(); };
A.qnote = el => {
  const t = el.elements.t.value.trim(); if (!t) return;
  put('notes', { title: t.slice(0, 40), body: t, tag: 'Brain dump' }); toast('Saved'); render();
};

/* ====================== TASKS ====================== */
FORMS.tasks = {
  name: 'task', def: () => ({ cat: 'Personal', priority: 'Auto', status: 'Not started', due: today() }),
  fields: () => [{ k: 'title', label: 'Title', req: 1 }, { k: 'cat', label: 'Category', type: 'select', opts: CATS },
    { k: 'priority', label: 'Priority (Auto = suggested from deadline and effort)', type: 'select', opts: ['Auto', 'High', 'Medium', 'Low'] },
    { k: 'status', label: 'Status', type: 'select', opts: STAT }, { k: 'due', label: 'Due date', type: 'date' },
    { k: 'startT', label: 'Start time', type: 'time' }, { k: 'endT', label: 'End time', type: 'time' },
    { k: 'est', label: 'Estimated minutes', type: 'number', min: 0 }, { k: 'actual', label: 'Actual minutes', type: 'number', min: 0 },
    { k: 'notes', label: 'Notes', type: 'textarea' }],
  after: o => { if (o.status === 'Completed' && !o.completedOn) o.completedOn = today(); if (o.status !== 'Completed') delete o.completedOn; }
};
function taskCard(t) {
  const p = prio(t), od = t.due && t.due < today() && OPEN(t), subs = t.subs || [], sd = subs.filter(s => s.done).length;
  return `<div class="item ${t.status === 'Completed' ? 'done' : ''}">
<input type="checkbox" class="ck" data-chg="tdone" data-id="${t.id}" ${t.status === 'Completed' ? 'checked' : ''} aria-label="Mark complete">
<div class="grow"><div class="ttl">${esc(t.title)}</div>
<div class="meta"><span class="badge ${catCls(t.cat)}">${esc(t.cat)}</span><span class="badge p${PW[p]}">${p}${(!t.priority || t.priority === 'Auto') ? ' · auto' : ''}</span>${t.due ? `<span class="badge ${od ? 'late' : ''}">📅 ${nice(t.due)}</span>` : ''}${t.est ? `<span class="badge">⏳ ${t.est}m${t.actual ? ` · ${t.actual}m done` : ''}</span>` : ''}${t.startT ? `<span class="badge">🕒 ${esc(t.startT)}${t.endT ? '–' + esc(t.endT) : ''}</span>` : ''}</div>
${subs.length ? `<div class="subs">${subs.map((s, i) => `<label class="sub"><input type="checkbox" data-chg="tsub" data-id="${t.id}" data-i="${i}" ${s.done ? 'checked' : ''}> <span>${esc(s.t)}</span></label>`).join('')}<div class="mut sm">${sd}/${subs.length} subtasks</div></div>` : ''}
<select data-chg="tstatus" data-id="${t.id}" aria-label="Status">${STAT.map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
<div class="acts"><button class="ibtn" data-act="tfocus" data-id="${t.id}" aria-label="Focus on this task">⏱</button><button class="ibtn" data-act="tbreak" data-id="${t.id}" aria-label="Break down">🪜</button><button class="ibtn" data-act="edit" data-s="tasks" data-id="${t.id}" aria-label="Edit">✏️</button><button class="ibtn" data-act="del" data-s="tasks" data-id="${t.id}" aria-label="Delete">🗑</button></div></div>`;
}
V.tasks = () => {
  const f = T.tf, c = T.tc;
  const list = D.tasks.filter(t => (f === 'all' || (f === 'open' ? OPEN(t) : t.status === 'Completed')) && (c === 'all' || t.cat === c))
    .sort((a, b) => (OPEN(b) - OPEN(a)) || taskScore(b) - taskScore(a));
  const late = D.tasks.filter(t => OPEN(t) && t.due && t.due < today());
  return hd('Tasks', `<button class="btn" data-act="add" data-s="tasks">+ Detailed task</button>`) +
    `<form data-sub="tquick" class="row" style="margin-bottom:10px"><input name="t" placeholder="Quick add — type and press Enter" required><button class="btn">Add</button></form>` +
    (late.length && f !== 'done' ? `<div class="banner"><h3>Unfinished from earlier</h3><div class="list">${late.map(t => `<div><b>${esc(t.title)}</b> <span class="mut sm">· due ${nice(t.due)}</span><div class="row wrap" style="margin-top:4px"><button class="btn sm" data-act="tres" data-id="${t.id}">Reschedule</button><button class="btn ghost sm" data-act="tbreak" data-id="${t.id}">Break down</button><button class="btn warn sm" data-act="tremove" data-id="${t.id}">Remove</button></div></div>`).join('')}</div></div>` : '') +
    `<div class="chips">${[['open', 'Open'], ['done', 'Completed'], ['all', 'All']].map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-act="tab" data-k="tf" data-v="${v}">${l}</button>`).join('')}</div>` +
    `<select data-chg="tcat" style="max-width:320px;margin-bottom:12px"><option value="all">All categories</option>${CATS.map(x => `<option ${c === x ? 'selected' : ''}>${x}</option>`).join('')}</select>` +
    (list.length ? `<div class="list">${list.map(taskCard).join('')}</div>` : empty('No tasks here yet. Add one above ✨'));
};
A.tcat = el => { T.tc = el.value; render(); };
A.tquick = el => {
  const t = el.elements.t.value.trim(); if (!t) return;
  put('tasks', { title: t, cat: T.tc !== 'all' ? T.tc : 'Personal', priority: 'Auto', status: 'Not started', due: today() }); render();
};
A.tdone = el => {
  const t = D.tasks.find(x => x.id === el.dataset.id); if (!t) return;
  t.status = el.checked ? 'Completed' : 'Not started'; if (el.checked) t.completedOn = today(); else delete t.completedOn;
  put('tasks', t); if (el.checked) toast('Nice work! ✓'); render();
};
A.tstatus = el => { const t = D.tasks.find(x => x.id === el.dataset.id); t.status = el.value; if (t.status === 'Completed') t.completedOn = today(); put('tasks', t); render(); };
A.tsub = el => { const t = D.tasks.find(x => x.id === el.dataset.id); t.subs[+el.dataset.i].done = el.checked; put('tasks', t); render(); };
A.tremove = el => confirmBox('Remove this task?', async () => { await del('tasks', el.dataset.id); render(); }, 'Remove');
A.tfocus = el => { F.task = el.dataset.id; const t = D.tasks.find(x => x.id === el.dataset.id); if (t && t.est) F.dur = Math.min(90, Math.max(5, t.est)); go('focus'); };
A.tres = el => {
  const t = D.tasks.find(x => x.id === el.dataset.id), dur = t.est || 30;
  for (let i = 0; i < 7; i++) {
    const ds = addDays(today(), i), from = i === 0 ? mtime(Math.min(21 * 60, Math.ceil((new Date().getHours() * 60 + new Date().getMinutes() + 15) / 15) * 15)) : '08:00', sl = freeSlot(ds, dur, from);
    if (sl) { t.due = ds; t.startT = sl; t.endT = mtime(tmin(sl) + dur); t.status = 'Not started'; put('tasks', t); toast(`Moved to ${nice(ds)} at ${sl}`); render(); return; }
  }
  t.due = addDays(today(), 1); put('tasks', t); toast('Moved to tomorrow'); render();
};
const TPL = {
  assignment: ['Understand the brief and marking criteria', 'Gather references', 'Make an outline', 'Write the first draft', 'Review and edit', 'Check references and submit'],
  study: ['Skim the topic and its objectives', 'Read and make notes', 'Recall without looking', 'Practise questions', 'Revise weak points'],
  clinical: ['Review the patient or case background', 'Prepare assessment tools', 'Carry out the session', 'Write notes', 'Reflect on learning'],
  household: ['Gather what you need', 'Do the main job', 'Tidy up'],
  generic: ['Plan the steps', 'Do the main work', 'Review and finish']
};
function suggestSteps(t) {
  const x = (t.title || '').toLowerCase();
  if (/assign|report|essay|present|submi/.test(x)) return TPL.assignment;
  if (/study|revis|read|chapter|learn|anatomy|physio/.test(x) || t.cat === CATS[0]) return TPL.study;
  if (t.cat === CATS[1]) return TPL.clinical;
  if (t.cat === CATS[3]) return TPL.household;
  return TPL.generic;
}
A.tbreak = el => {
  const t = D.tasks.find(x => x.id === el.dataset.id);
  formModal('Break down: ' + esc(t.title), [{ k: 'steps', label: 'Suggested steps — edit freely, one per line', type: 'textarea', rows: 7 }], { steps: suggestSteps(t).join('\n') }, o => {
    t.subs = (t.subs || []).concat(lines(o.steps).map(s => ({ t: s, done: false }))); put('tasks', t); render();
  }, '', 'Add as subtasks');
};

/* ====================== ACADEMICS ====================== */
const OPENSUBJ = new Set();
FORMS.subjects = { name: 'subject', def: () => ({ units: [] }), fields: () => [{ k: 'name', label: 'Subject name', req: 1 }], after: o => { o.units = o.units || []; } };
const conf = ['—', '1 · Shaky', '2 · Weak', '3 · Okay', '4 · Good', '5 · Strong'];
function subjCard(s) {
  const tp = s.units.flatMap(u => u.topics), dn = tp.filter(t => t.done).length, pct = tp.length ? Math.round(dn / tp.length * 100) : 0, open = OPENSUBJ.has(s.id);
  const tree = s.units.map((u, i) => `<div class="unit"><div class="row between"><b>${esc(u.n)}</b><span class="row"><button class="btn ghost sm" data-act="atopic" data-id="${s.id}" data-i="${i}">+ Topic</button><button class="ibtn" data-act="dunit" data-id="${s.id}" data-i="${i}" aria-label="Delete unit">🗑</button></span></div>` +
    u.topics.map((t, j) => `<div class="topic"><div class="row"><input type="checkbox" class="ck" data-chg="ttop" data-id="${s.id}" data-i="${i}" data-j="${j}" ${t.done ? 'checked' : ''}><span class="grow ttl">${esc(t.n)}</span><select data-chg="tconf" data-id="${s.id}" data-i="${i}" data-j="${j}" aria-label="Confidence">${conf.map((c, k) => `<option value="${k}" ${(t.conf || 0) === k ? 'selected' : ''}>${c}</option>`).join('')}</select><button class="ibtn" data-act="asub" data-id="${s.id}" data-i="${i}" data-j="${j}" aria-label="Add subtopic">＋</button><button class="ibtn" data-act="dtopic" data-id="${s.id}" data-i="${i}" data-j="${j}" aria-label="Delete topic">🗑</button></div>` +
      (t.subs || []).map((x, k) => `<div class="subtopic"><input type="checkbox" data-chg="tsubt" data-id="${s.id}" data-i="${i}" data-j="${j}" data-k="${k}" ${x.done ? 'checked' : ''}><span class="grow ${x.done ? 'mut' : ''}">${esc(x.n)}</span><button class="ibtn" data-act="dsubt" data-id="${s.id}" data-i="${i}" data-j="${j}" data-k="${k}" aria-label="Delete subtopic">✕</button></div>`).join('') + '</div>').join('') + '</div>').join('');
  return `<div class="card"><div class="row between"><button class="lnk" data-act="osub" data-id="${s.id}">${open ? '▾' : '▸'} ${esc(s.name)}</button><span class="mut sm">${dn}/${tp.length} topics</span></div>${bar(pct)}${open ? `${tree || empty('Add a unit to begin your syllabus.')}<div class="row wrap"><button class="btn sm" data-act="aunit" data-id="${s.id}">+ Unit</button><button class="btn ghost sm" data-act="edit" data-s="subjects" data-id="${s.id}">Rename</button><button class="btn warn sm" data-act="del" data-s="subjects" data-id="${s.id}">Delete subject</button></div>` : ''}</div>`;
}
const subjOf = el => D.subjects.find(x => x.id === el.dataset.id);
const saveS = s => { put('subjects', s); render(); };
A.osub = el => { OPENSUBJ.has(el.dataset.id) ? OPENSUBJ.delete(el.dataset.id) : OPENSUBJ.add(el.dataset.id); render(); };
A.aunit = el => ask('Unit name', v => { const s = subjOf(el); s.units.push({ n: v, topics: [] }); saveS(s); });
A.atopic = el => ask('Topic name', v => { const s = subjOf(el); s.units[+el.dataset.i].topics.push({ n: v, done: false, conf: 0, subs: [] }); saveS(s); });
A.asub = el => ask('Subtopic name', v => { const s = subjOf(el), t = s.units[+el.dataset.i].topics[+el.dataset.j]; (t.subs = t.subs || []).push({ n: v, done: false }); saveS(s); });
A.ttop = el => { const s = subjOf(el); s.units[+el.dataset.i].topics[+el.dataset.j].done = el.checked; saveS(s); };
A.tconf = el => { const s = subjOf(el); s.units[+el.dataset.i].topics[+el.dataset.j].conf = +el.value; saveS(s); };
A.tsubt = el => { const s = subjOf(el); s.units[+el.dataset.i].topics[+el.dataset.j].subs[+el.dataset.k].done = el.checked; saveS(s); };
A.dunit = el => confirmBox('Delete this unit and its topics?', () => { const s = subjOf(el); s.units.splice(+el.dataset.i, 1); saveS(s); });
A.dtopic = el => confirmBox('Delete this topic?', () => { const s = subjOf(el); s.units[+el.dataset.i].topics.splice(+el.dataset.j, 1); saveS(s); });
A.dsubt = el => { const s = subjOf(el); s.units[+el.dataset.i].topics[+el.dataset.j].subs.splice(+el.dataset.k, 1); saveS(s); };

FORMS.assignments = {
  name: 'assignment', def: () => ({ priority: 'Medium', status: 'Not started', pct: 0, remind: '2', deadline: addDays(today(), 7) }),
  fields: () => [{ k: 'title', label: 'Title', req: 1 }, { k: 'subjectId', label: 'Subject', type: 'select', opts: subjOpts() },
    { k: 'deadline', label: 'Submission deadline', type: 'date', req: 1 }, { k: 'priority', label: 'Priority', type: 'select', opts: ['High', 'Medium', 'Low'] },
    { k: 'status', label: 'Submission status', type: 'select', opts: ['Not started', 'In progress', 'Ready to submit', 'Submitted'] },
    { k: 'pct', label: 'Completion %', type: 'number', min: 0, max: 100 },
    { k: 'steps', label: 'Task breakdown (one step per line)', type: 'textarea' }, { k: 'refs', label: 'References and notes', type: 'textarea' },
    { k: 'remind', label: 'Advance reminder', type: 'select', opts: [['0', 'None'], ['1', '1 day before'], ['2', '2 days before'], ['3', '3 days before'], ['7', '1 week before']] }]
};
FORMS.exams = {
  name: 'exam', def: () => ({ type: 'Theory', date: addDays(today(), 14), time: '09:00' }),
  fields: () => [{ k: 'title', label: 'Examination', req: 1 }, { k: 'subjectId', label: 'Subject', type: 'select', opts: subjOpts() },
    { k: 'type', label: 'Type', type: 'select', opts: ['Theory', 'Practical', 'Viva', 'Internal assessment', 'Other'] },
    { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'time', label: 'Time', type: 'time' }, { k: 'venue', label: 'Venue', type: 'text' },
    { k: 'marks', label: 'Marks obtained (after the exam)', type: 'number', min: 0 }, { k: 'max', label: 'Maximum marks', type: 'number', min: 0 },
    { k: 'notes', label: 'Preparation, viva questions, past question papers', type: 'textarea', rows: 4 }]
};
FORMS.postings = {
  name: 'clinical posting', def: () => ({ attended: 0, total: 0 }),
  fields: () => [{ k: 'title', label: 'Posting / rotation', req: 1 }, { k: 'place', label: 'Place / ward', type: 'text' },
    { k: 'start', label: 'Start date', type: 'date' }, { k: 'end', label: 'End date', type: 'date' },
    { k: 'timetable', label: 'Posting timetable and daily schedule', type: 'textarea' }, { k: 'skills', label: 'Clinical skills and competencies', type: 'textarea' },
    { k: 'cases', label: 'Patient and case-study learning notes', type: 'textarea' }, { k: 'deadlines', label: 'Assessments and case-presentation deadlines', type: 'textarea' },
    { k: 'attended', label: 'Days attended', type: 'number', min: 0 }, { k: 'total', label: 'Total posting days', type: 'number', min: 0 },
    { k: 'reflection', label: 'Clinical learning reflection', type: 'textarea', rows: 4 }]
};
const REV_DAYS = [0, 2, 4, 7, 14, 30];
function revisionList() {
  const out = [];
  D.subjects.forEach(s => s.units.forEach((u, i) => u.topics.forEach((t, j) => {
    const c = t.conf || 0, gap = t.rev ? diffDays(t.rev, today()) : 999, every = REV_DAYS[c] || 3;
    const due = !t.rev || gap >= every || c <= 2;
    out.push({ s, u, t, i, j, c, gap, every, due });
  })));
  return out.filter(x => x.due).sort((a, b) => (a.c || 1) - (b.c || 1) || b.gap - a.gap);
}
A.revdone = el => { const s = subjOf(el), t = s.units[+el.dataset.i].topics[+el.dataset.j]; t.rev = today(); saveS(s); toast('Marked revised today'); };
A.sgoal = () => ask('Weekly study goal (minutes)', v => { ST.studyGoal = Math.max(0, +v || 0); saveST(); render(); }, String(ST.studyGoal || 600));

V.acad = () => {
  const k = T.acad;
  let body = '';
  if (k === 'subjects') body = D.subjects.length ? `<div class="list">${D.subjects.map(subjCard).join('')}</div>` : empty('Add your first subject, then build Unit → Topic → Subtopic.');
  if (k === 'assign') {
    const l = D.assignments.slice().sort((a, b) => a.deadline.localeCompare(b.deadline));
    body = l.length ? `<div class="list">${l.map(a => `<div class="card"><div class="row between"><b class="ttl">${esc(a.title)}</b><span class="row"><button class="ibtn" data-act="edit" data-s="assignments" data-id="${a.id}">✏️</button><button class="ibtn" data-act="del" data-s="assignments" data-id="${a.id}">🗑</button></span></div><div class="meta"><span class="badge">${esc(subjName(a.subjectId))}</span><span class="badge p${PW[a.priority]}">${a.priority}</span><span class="badge ${a.status !== 'Submitted' && a.deadline < today() ? 'late' : ''}">📅 ${nice(a.deadline)} · ${countdown(a.deadline)}</span><span class="badge">${esc(a.status)}</span></div>${bar(a.pct || 0)}<span class="mut sm">${a.pct || 0}% complete</span>${a.steps ? `<details><summary>Task breakdown</summary>${lines(a.steps).map(x => `<div class="mini">• ${esc(x)}</div>`).join('')}</details>` : ''}${a.refs ? `<details><summary>References and notes</summary><p style="white-space:pre-wrap">${esc(a.refs)}</p></details>` : ''}</div>`).join('')}</div>` : empty('No assignments yet.');
  }
  if (k === 'exams') {
    const l = D.exams.slice().sort((a, b) => a.date.localeCompare(b.date));
    body = l.length ? `<div class="list">${l.map(e => `<div class="card"><div class="row between"><b class="ttl">${esc(e.title)}</b><span class="row"><button class="ibtn" data-act="edit" data-s="exams" data-id="${e.id}">✏️</button><button class="ibtn" data-act="del" data-s="exams" data-id="${e.id}">🗑</button></span></div><div class="meta"><span class="badge">${esc(subjName(e.subjectId))}</span><span class="badge c1">${esc(e.type)}</span><span class="badge ${e.date < today() ? '' : 'p2'}">🎓 ${nice(e.date)}${e.time ? ' ' + esc(e.time) : ''} · ${countdown(e.date)}</span>${e.venue ? `<span class="badge">${esc(e.venue)}</span>` : ''}${e.marks != null && e.max ? `<span class="badge c3">Result ${e.marks}/${e.max} (${Math.round(e.marks / e.max * 100)}%)</span>` : ''}</div>${syllabusLine(e.subjectId)}${e.notes ? `<details><summary>Preparation and past papers</summary><p style="white-space:pre-wrap">${esc(e.notes)}</p></details>` : ''}</div>`).join('')}</div>` : empty('No examinations added yet.');
  }
  if (k === 'rev') {
    const l = revisionList().slice(0, 15);
    body = `<p class="mut sm">Suggestions come from your confidence ratings and when you last revised: lower confidence means sooner and more often. Rate topics in the Subjects tab.</p>` + (l.length ? `<div class="list">${l.map(x => `<div class="item"><div class="grow"><div class="ttl">${esc(x.t.n)}</div><div class="meta"><span class="badge">${esc(x.s.name)} · ${esc(x.u.n)}</span><span class="badge">${conf[x.c]}</span><span class="badge ${x.t.rev ? '' : 'p2'}">${x.t.rev ? 'last revised ' + x.gap + ' d ago' : 'never revised'}</span></div></div><button class="btn sm" data-act="revdone" data-id="${x.s.id}" data-i="${x.i}" data-j="${x.j}">Revised ✓</button></div>`).join('')}</div>` : empty('Nothing due for revision. Add topics and confidence ratings to get suggestions.'));
  }
  if (k === 'clin') {
    body = D.postings.length ? `<div class="list">${D.postings.slice().sort((a, b) => (b.start || '').localeCompare(a.start || '')).map(p => `<div class="card"><div class="row between"><b class="ttl">${esc(p.title)}</b><span class="row"><button class="ibtn" data-act="edit" data-s="postings" data-id="${p.id}">✏️</button><button class="ibtn" data-act="del" data-s="postings" data-id="${p.id}">🗑</button></span></div><div class="meta">${p.place ? `<span class="badge">${esc(p.place)}</span>` : ''}${p.start ? `<span class="badge">${nice(p.start)}${p.end ? ' → ' + nice(p.end) : ''}</span>` : ''}${p.total ? `<span class="badge c3">Attendance ${p.attended || 0}/${p.total} (${Math.round((p.attended || 0) / p.total * 100)}%)</span>` : ''}</div>` +
      [['timetable', 'Timetable'], ['skills', 'Skills and competencies'], ['cases', 'Case-study notes'], ['deadlines', 'Assessment deadlines'], ['reflection', 'Reflection']].filter(([f]) => p[f]).map(([f, l]) => `<details><summary>${l}</summary><p style="white-space:pre-wrap">${esc(p[f])}</p></details>`).join('') + '</div>').join('')}</div>` : empty('Add a clinical posting to track schedules, cases, skills, attendance and reflections.');
  }
  if (k === 'study') {
    const ss = D.sessions.filter(s => s.mode === 'focus'), bySub = {};
    ss.forEach(s => { const n = s.subject ? subjName(s.subject) : 'General'; bySub[n] = (bySub[n] || 0) + (s.mins || 0); });
    const mx = Math.max(1, ...Object.values(bySub)), wk = weekMinutes();
    body = `<div class="card"><div class="row between"><h3>This week</h3><button class="btn ghost sm" data-act="sgoal">Set goal</button></div><p>${wk} min${ST.studyGoal ? ` of ${ST.studyGoal} min goal` : ''}</p>${bar(ST.studyGoal ? wk / ST.studyGoal * 100 : 0)}</div>` +
      `<div class="card" style="margin-top:12px"><h3>Time by subject</h3>${Object.keys(bySub).length ? Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([n, m]) => `<div class="sm">${esc(n)} — ${m} min</div>${bar(m / mx * 100)}`).join('') : empty('Finish a focus session to see this.')}</div>` +
      `<h3 style="margin-top:14px">Session history</h3><div class="list">${ss.slice().sort((a, b) => (b.ended || '').localeCompare(a.ended || '')).slice(0, 25).map(s => `<div class="item"><div class="grow"><div class="ttl">${s.mins} min · ${esc(s.subject ? subjName(s.subject) : 'General')}</div><div class="meta"><span class="badge">${nice(s.date)}</span>${s.understanding ? `<span class="badge c3">Understanding ${s.understanding}/5</span>` : ''}${(s.distr || []).length ? `<span class="badge p2">${s.distr.length} distraction${s.distr.length > 1 ? 's' : ''}</span>` : ''}${s.breaks ? `<span class="badge">${s.breaks} break${s.breaks > 1 ? 's' : ''}</span>` : ''}</div>${s.topic ? `<div class="sm">${esc(s.topic)}</div>` : ''}${s.dnote ? `<div class="sm mut">${esc(s.dnote)}</div>` : ''}</div></div>`).join('') || empty('No sessions yet.')}</div>`;
  }
  const addBtn = { subjects: ['subjects', '+ Subject'], assign: ['assignments', '+ Assignment'], exams: ['exams', '+ Exam'], clin: ['postings', '+ Posting'] }[k];
  return hd('Academics', addBtn ? `<button class="btn" data-act="add" data-s="${addBtn[0]}">${addBtn[1]}</button>` : '') +
    tabs('acad', [['subjects', 'Subjects'], ['assign', 'Assignments'], ['exams', 'Exams'], ['rev', 'Revision'], ['clin', 'Clinical'], ['study', 'Study log']]) + body;
};
function syllabusLine(id) {
  const s = D.subjects.find(x => x.id === id); if (!s) return '';
  const tp = s.units.flatMap(u => u.topics); if (!tp.length) return '';
  const dn = tp.filter(t => t.done).length, rv = tp.filter(t => t.rev).length;
  return `<div class="sm mut">Syllabus ${dn}/${tp.length} covered · ${rv} revised at least once</div>${bar(dn / tp.length * 100)}`;
}

/* ====================== CALENDAR ====================== */
const C = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: today(), filter: 'all' };
const kcls = c => 'k' + Math.max(0, CALS.indexOf(c));
FORMS.events = {
  name: 'event', def: () => ({ cal: 'Personal', date: C.sel, repeat: 'none', start: '09:00', end: '10:00' }),
  fields: () => [{ k: 'title', label: 'Title', req: 1 }, { k: 'cal', label: 'Calendar', type: 'select', opts: CALS },
    { k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'endDate', label: 'End date (multi-day, optional)', type: 'date' },
    { k: 'allDay', label: 'All-day event', type: 'checkbox' }, { k: 'start', label: 'Start', type: 'time' }, { k: 'end', label: 'End', type: 'time' },
    { k: 'repeat', label: 'Repeats', type: 'select', opts: [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Weekdays (Mon–Fri)'], ['days', 'On selected days ↓'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']] },
    { k: 'days', label: 'Selected days (when “On selected days” is chosen) — great for a class timetable', type: 'multi', opts: [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']] },
    { k: 'until', label: 'Repeat until (optional)', type: 'date' },
    { k: 'prep', label: 'Preparation checklist (one item per line)', type: 'textarea' }, { k: 'notes', label: 'Notes', type: 'textarea' }],
  check: o => {
    if (o.endDate && o.endDate < o.date) return 'End date is before the start date';
    if (o.repeat === 'days' && !(o.days || []).length) return 'Tick at least one day for “On selected days”';
    if (o.allDay) return;
    if ((o.start && !o.end) || (!o.start && o.end)) return 'Add both a start and an end time (or tick All-day)';
    if (o.start && o.end) {
      if (o.end === o.start) return 'Start and end time are the same';
      const [s, e] = span(o.start, o.end);
      const cl = D.events.filter(x => x.id !== o.id && !x.allDay && x.start && x.end && occurs(x, o.date) && (([a, b]) => a < e && b > s)(span(x.start, x.end)));
      if (cl.length) {
        const sl = freeSlot(o.date, e - s, o.start);
        return { ask: `<b>Time clash</b><br>This overlaps “${esc(cl[0].title)}” (${cl[0].start}–${cl[0].end}).` + (sl ? `<br>Next free slot: <b>${sl}–${mtime((tmin(sl) + e - s) % 1440)}</b>.` : '') + '<br><br>Save it anyway?' };
      }
    }
  }
};
function dayItems(ds, filter = 'all') {
  const out = [];
  D.events.forEach(e => {
    if (!((filter === 'all' || e.cal === filter) && occurs(e, ds))) return;
    const timed = !e.allDay && e.start, [a, b] = timed && e.end ? span(e.start, e.end) : [timed ? tmin(e.start) : 0, timed ? tmin(e.start) + 60 : 0];
    out.push({ k: 'event', id: e.id, ic: '🗓', title: e.title, time: timed ? e.start + (e.end ? '–' + e.end + (b > 1440 ? ' 🌙' : '') : '') : 'All day', sort: timed ? a : -1, a: timed ? a : null, b: timed ? b : null, cal: e.cal, e });
  });
  /* night duty that started yesterday and runs into this morning */
  D.events.forEach(e => {
    if (e.allDay || !e.start || !e.end || !(filter === 'all' || e.cal === filter)) return;
    const [a, b] = span(e.start, e.end); if (b <= 1440 || !occurs(e, addDays(ds, -1))) return;
    out.push({ k: 'event', id: e.id, ic: '🌙', title: e.title + ' (from last night)', time: 'until ' + e.end, sort: -0.5, a: 0, b: b - 1440, cal: e.cal, e });
  });
  if (filter === 'all') {
    D.tasks.filter(t => OPEN(t) && t.due === ds).forEach(t => out.push({ k: 'task', id: t.id, ic: '✅', title: t.title, time: t.startT ? t.startT + (t.endT ? '–' + t.endT : '') : 'Any time', sort: t.startT ? tmin(t.startT) : 1000, a: t.startT ? tmin(t.startT) : null, b: t.startT && t.endT ? span(t.startT, t.endT)[1] : null }));
    D.postings.filter(p => p.start && p.start <= ds && (!p.end || p.end >= ds)).forEach(p => out.push({ k: 'post', ic: '🏥', title: p.title + (p.place ? ' · ' + p.place : ''), time: 'Posting', sort: -0.8 }));
    D.assignments.filter(a => a.status !== 'Submitted' && a.deadline === ds).forEach(a => out.push({ k: 'assign', ic: '📝', title: 'Due: ' + a.title, time: 'Deadline', sort: 1001 }));
    D.exams.filter(e => e.date === ds).forEach(e => out.push({ k: 'exam', ic: '🎓', title: e.title, time: e.time || 'Exam', sort: e.time ? tmin(e.time) : 0, a: e.time ? tmin(e.time) : null }));
    D.reminders.filter(r => !r.done && r.date === ds).forEach(r => out.push({ k: 'rem', ic: '⏰', title: r.title, time: r.time || 'Reminder', sort: r.time ? tmin(r.time) : 1002, a: r.time ? tmin(r.time) : null }));
  }
  return out.sort((a, b) => a.sort - b.sort);
}
function monthGrid(y, m, mini) {
  const first = new Date(y, m, 1), start = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(fmt(new Date(y, m, d)));
  while (cells.length % 7) cells.push(null);
  return `<div class="cal ${mini ? 'mini' : ''}">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="dow">${d}</div>`).join('')}${cells.map(ds => {
    if (!ds) return '<button class="blank" tabindex="-1" aria-hidden="true"></button>';
    const dots = dayItems(ds, mini ? 'all' : C.filter).slice(0, 3).map(i => `<i class="${i.k === 'event' ? kcls(i.cal) : 'kx'}"></i>`).join('');
    return `<button class="${ds === today() ? 'today' : ''} ${ds === C.sel && !mini ? 'sel' : ''}" data-act="csel" data-d="${ds}" aria-label="${nice(ds)}">${+ds.slice(8)}<span class="dots">${dots}</span></button>`;
  }).join('')}</div>`;
}
function itemHtml(i) {
  let h = `<div class="dayblk ${i.k === 'event' ? kcls(i.cal) : ''}"><div class="row between"><span>${i.ic} <b>${esc(i.time)}</b> ${esc(i.title)}</span>${i.k === 'event' ? `<span class="row"><button class="ibtn" data-act="edit" data-s="events" data-id="${i.id}" aria-label="Edit">✏️</button><button class="ibtn" data-act="del" data-s="events" data-id="${i.id}" aria-label="Delete">🗑</button></span>` : ''}</div>`;
  if (i.e && i.e.prep) h += lines(i.e.prep).map((p, n) => `<label class="sub"><input type="checkbox" data-chg="prep" data-id="${i.id}" data-i="${n}" ${(i.e.prepDone || []).includes(n) ? 'checked' : ''}> <span>${esc(p)}</span></label>`).join('');
  if (i.e && i.e.notes) h += `<div class="sm mut">${esc(i.e.notes)}</div>`;
  return h + '</div>';
}
A.prep = el => { const e = D.events.find(x => x.id === el.dataset.id), n = +el.dataset.i; e.prepDone = e.prepDone || []; const k = e.prepDone.indexOf(n); k < 0 ? e.prepDone.push(n) : e.prepDone.splice(k, 1); put('events', e); render(); };
function dayBlock(ds) { const l = dayItems(ds, C.filter); return `<h3>${nice(ds)}${ds === today() ? ' · Today' : ''}</h3>` + (l.length ? l.map(itemHtml).join('') : empty('Nothing planned.')); }
V.cal = () => {
  const mode = T.cal;
  let body = '';
  const title = new Date(C.y, C.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (mode === 'month') body = `<div class="card">${monthGrid(C.y, C.m)}</div><div class="card" style="margin-top:12px">${dayBlock(C.sel)}</div>`;
  if (mode === 'week') { const mon = addDays(C.sel, -((pd(C.sel).getDay() + 6) % 7)); body = `<div class="list">${[0, 1, 2, 3, 4, 5, 6].map(i => `<div class="card">${dayBlock(addDays(mon, i))}</div>`).join('')}</div>`; }
  if (mode === 'day') body = `<div class="card">${dayBlock(C.sel)}</div>`;
  if (mode === 'agenda') { let h = ''; for (let i = 0; i < 30; i++) { const ds = addDays(today(), i); if (dayItems(ds, C.filter).length) h += `<div class="card" style="margin-bottom:10px">${dayBlock(ds)}</div>`; } body = h || empty('Nothing in the next 30 days.'); }
  if (mode === 'year') body = `<div class="grid">${Array.from({ length: 12 }, (_, m) => `<div class="card"><h3>${new Date(C.y, m, 1).toLocaleDateString(undefined, { month: 'long' })}</h3>${monthGrid(C.y, m, true)}</div>`).join('')}</div>`;
  const nav = mode === 'agenda' ? '' : `<div class="row"><button class="btn ghost sm" data-act="cnav" data-d="-1" aria-label="Previous">‹</button><b>${mode === 'year' ? C.y : mode === 'month' ? title : nice(C.sel)}</b><button class="btn ghost sm" data-act="cnav" data-d="1" aria-label="Next">›</button><button class="btn ghost sm" data-act="ctoday">Today</button></div>`;
  return hd('Calendar', `<button class="btn" data-act="add" data-s="events" data-date="${C.sel}">+ Event</button>`) +
    tabs('cal', [['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda'], ['year', 'Year']]) +
    `<div class="row between wrap" style="margin-bottom:10px">${nav}<select data-chg="cfilter" style="max-width:200px" aria-label="Calendar filter"><option value="all">All calendars</option>${CALS.map(c => `<option ${C.filter === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>` + body;
};
A.cfilter = el => { C.filter = el.value; render(); };
A.csel = el => { C.sel = el.dataset.d; const d = pd(C.sel); C.y = d.getFullYear(); C.m = d.getMonth(); render(); };
A.ctoday = () => { C.sel = today(); C.y = new Date().getFullYear(); C.m = new Date().getMonth(); render(); };
A.cnav = el => {
  const d = +el.dataset.d, mode = T.cal;
  if (mode === 'week') C.sel = addDays(C.sel, 7 * d);
  else if (mode === 'day') C.sel = addDays(C.sel, d);
  else if (mode === 'year') { C.y += d; C.sel = `${C.y}-01-01`; C.m = 0; }
  else { const n = new Date(C.y, C.m + d, 1); C.y = n.getFullYear(); C.m = n.getMonth(); C.sel = fmt(n); }
  if (mode === 'week' || mode === 'day') { const s = pd(C.sel); C.y = s.getFullYear(); C.m = s.getMonth(); }
  render();
};
A.chgo = el => { T.cp = el.dataset.p; T.chk = 'checkin'; go('chk'); };
