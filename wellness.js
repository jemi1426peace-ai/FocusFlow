'use strict';
/* FocusFlow — Mood tracker & Hydration tracker (Home widgets + My Life tabs) */

/* ====================== MOOD ====================== */
const MOODS = [[1, '😣', 'Rough'], [2, '😔', 'Low'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '🥰', 'Great']];
const MTAGS = ['Calm', 'Happy', 'Motivated', 'Grateful', 'Tired', 'Stressed', 'Anxious', 'Overwhelmed', 'Lonely', 'Proud', 'Sleepy', 'Sick'];
const moodOf = v => MOODS.find(m => m[0] === Math.round(v)) || MOODS[2];
const dayMoods = ds => D.moods.filter(m => m.date === ds).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
const dayMood = ds => { const l = dayMoods(ds); return l.length ? l.reduce((a, m) => a + m.v, 0) / l.length : 0; };
const nowT = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };

function moodStrip(n = 7) {
  const t0 = today();
  return `<div class="mstrip">${Array.from({ length: n }, (_, i) => addDays(t0, i - n + 1)).map(d => {
    const v = dayMood(d);
    return `<div class="${d === t0 ? 'tday' : ''}"><span class="me">${v ? moodOf(v)[1] : '·'}</span><small>${'SMTWTFS'[pd(d).getDay()]}</small></div>`;
  }).join('')}</div>`;
}

W.mood = () => {
  const l = dayMoods(today()), last = l[l.length - 1];
  return `<p class="mut sm">${last ? `Last logged at ${esc(last.time)} — ${moodOf(last.v)[2].toLowerCase()} ${moodOf(last.v)[1]}` : 'Tap the face that fits right now.'}</p>
<div class="mpick">${MOODS.map(([v, e, n]) => `<button data-act="moodpick" data-v="${v}" aria-label="${n}" class="${last && last.v === v ? 'on' : ''}"><span>${e}</span><small>${n}</small></button>`).join('')}</div>
${moodStrip(7)}`;
};

A.moodpick = el => {
  const pre = +(el.dataset.v || 0);
  const o = modal(`<h3>How are you feeling?</h3><form>
<div class="mpick big">${MOODS.map(([v, e, n]) => `<label><input type="radio" name="v" value="${v}" ${v === pre ? 'checked' : ''} required><span>${e}</span><small>${n}</small></label>`).join('')}</div>
<div class="fld"><label>What's going on? <span class="mut">(optional)</span></label><div class="multi">${MTAGS.map(t => `<label class="pill"><input type="checkbox" name="tags" value="${t}"> ${t}</label>`).join('')}</div></div>
<div class="fld"><label for="m_note">Note <span class="mut">(optional)</span></label><textarea id="m_note" name="note" rows="2" placeholder="A few words about your day…"></textarea></div>
<div class="row end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Save mood</button></div></form>`);
  o.querySelector('[data-x]').onclick = o.close;
  o.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const f = e.target, v = f.querySelector('[name=v]:checked');
    if (!v) return toast('Pick a face first');
    put('moods', { date: today(), time: nowT(), v: +v.value, tags: [...f.querySelectorAll('[name=tags]:checked')].map(x => x.value), note: f.elements.note.value.trim() });
    o.close(); toast(+v.value >= 4 ? 'Love that for you 💜' : +v.value <= 2 ? 'Thanks for checking in. Be gentle with yourself today 🫶' : 'Mood saved 🌈'); render();
  };
};
A.mooddel = el => confirmBox('Delete this mood entry?', async () => { await del('moods', el.dataset.id); render(); });

function moodPage() {
  const t0 = today(), from = addDays(t0, -29);
  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i));
  const rec = D.moods.filter(m => m.date >= from);
  const logged = days.filter(d => dayMood(d));
  const avg = logged.length ? logged.reduce((a, d) => a + dayMood(d), 0) / logged.length : 0;
  const tagCount = {}; rec.forEach(m => (m.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
  const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let streak = 0; for (let d = t0; dayMood(d); d = addDays(d, -1)) streak++;
  const list = D.moods.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 20);
  return `<div class="grid">
<div class="card"><h3>Last 30 days</h3><div class="mcal">${'MTWTFSS'.split('').map(x => `<b>${x}</b>`).join('')}${'<i></i>'.repeat((pd(from).getDay() + 6) % 7)}${days.map(d => { const v = dayMood(d); return `<span class="mv${v ? Math.round(v) : 0} ${d === t0 ? 'tday' : ''}" title="${nice(d)}${v ? ' · ' + moodOf(v)[2] : ''}">${v ? moodOf(v)[1] : pd(d).getDate()}</span>`; }).join('')}</div></div>
<div class="card"><h3>Summary</h3><div class="stats"><div><b>${avg ? moodOf(avg)[1] : '–'}</b><small>Typical mood</small></div><div><b>${logged.length}</b><small>Days logged</small></div><div><b>${streak}</b><small>Day streak</small></div></div>
${top.length ? `<p class="sm" style="margin-top:10px"><b>Most common feelings:</b></p><div class="meta">${top.map(([t, n]) => `<span class="badge">${esc(t)} · ${n}</span>`).join('')}</div>` : ''}
<p class="mut sm" style="margin-top:10px">A simple record of what you logged, not medical advice. If low days keep stacking up, it's worth talking to someone you trust.</p></div>
</div>
<h2 style="margin-top:18px">Recent entries</h2><div class="list">${list.map(m => `<div class="item"><span style="font-size:1.8rem">${moodOf(m.v)[1]}</span><div class="grow"><div class="ttl">${moodOf(m.v)[2]} <span class="mut sm">· ${nice(m.date)} ${esc(m.time || '')}</span></div>${(m.tags || []).length ? `<div class="meta">${m.tags.map(t => `<span class="badge c2">${esc(t)}</span>`).join('')}</div>` : ''}${m.note ? `<p class="sm">${esc(m.note)}</p>` : ''}</div><button class="ibtn" data-act="mooddel" data-id="${m.id}" aria-label="Delete">🗑</button></div>`).join('') || empty('No moods logged yet. Start from the Home screen or the button above.')}</div>`;
}

/* ====================== HYDRATION ====================== */
const wGet = ds => (D.water.find(w => w.id === ds) || {}).n || 0;
const wGoal = () => Math.max(1, ST.waterGoal || 8);
function wSet(ds, n) {
  const before = wGet(ds); n = Math.max(0, Math.min(40, n));
  put('water', { id: ds, date: ds, n });
  if (ds === today() && before < wGoal() && n >= wGoal()) { toast('Hydration goal reached! 💧🎉 Your body says thank you'); beep(); }
}
const ml = n => { const v = n * (ST.glassMl || 250); return v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + ' L' : v + ' ml'; };

function bottle(n, g, big) {
  const p = Math.min(100, Math.round(n / g * 100));
  return `<div class="bottle ${big ? 'big' : ''}" role="img" aria-label="${n} of ${g} glasses"><div class="cap"></div><div class="body"><div class="fill" style="height:${p}%">${p ? '<i class="wave"></i>' : ''}</div><span>${p}%</span></div></div>`;
}

W.water = () => {
  const n = wGet(today()), g = wGoal(), hr = new Date().getHours();
  const left = Math.max(0, g - n);
  const tip = n >= g ? 'Goal done — amazing! 🌟' : hr >= 12 && n < g * ((hr - 8) / 14) - 1 ? `A little behind — grab a glass now 💙` : `${left} more glass${left === 1 ? '' : 'es'} to go`;
  return `<div class="wrow">${bottle(n, g)}<div class="grow"><div class="wnum">${n}<small> / ${g} glasses</small></div><p class="mut sm">${ml(n)} · ${tip}</p>
<div class="drops">${Array.from({ length: Math.max(g, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}">💧</i>`).join('')}</div>
<div class="row" style="margin-top:8px"><button class="btn sm" data-act="wadd" data-d="1">+ 1 glass</button><button class="btn ghost sm" data-act="wadd" data-d="-1" aria-label="Remove a glass" ${n ? '' : 'disabled'}>−</button></div></div></div>`;
};
A.wadd = el => { wSet(today(), wGet(today()) + +el.dataset.d); render(); };
A.wday = el => { wSet(el.dataset.d, wGet(el.dataset.d) + +el.dataset.n); render(); };
A.wgoal = el => { const v = Math.round(+el.value); if (v > 0) { ST[el.dataset.k] = v; saveST(); render(); } };

function waterPage() {
  const t0 = today(), g = wGoal(), days = Array.from({ length: 14 }, (_, i) => addDays(t0, i - 13));
  const vals = days.map(wGet), maxV = Math.max(g, ...vals);
  let streak = 0; for (let d = wGet(t0) >= g ? t0 : addDays(t0, -1); wGet(d) >= g; d = addDays(d, -1)) streak++;
  const wk = vals.slice(-7), avg = (wk.reduce((a, b) => a + b, 0) / 7).toFixed(1), hit = wk.filter(v => v >= g).length;
  return `<div class="grid">
<div class="card center"><h3>Today</h3>${bottle(wGet(t0), g, true)}<div class="wnum" style="margin-top:8px">${wGet(t0)}<small> / ${g}</small></div><p class="mut sm">${ml(wGet(t0))} of ${ml(g)}</p>
<div class="row" style="justify-content:center;margin-top:8px"><button class="btn" data-act="wadd" data-d="1">+ 1 glass</button><button class="btn ghost" data-act="wadd" data-d="-1" ${wGet(t0) ? '' : 'disabled'}>−</button></div></div>
<div class="card"><h3>Last 14 days</h3><div class="weekbar wbar" style="margin-bottom:26px">${days.map((d, i) => `<div class="${vals[i] >= g ? 'hit' : ''}" style="height:${Math.max(4, vals[i] / maxV * 100)}%" title="${nice(d)}: ${vals[i]}"><span>${pd(d).getDate()}</span></div>`).join('')}</div>
<div class="stats"><div><b>${avg}</b><small>Avg / day (7d)</small></div><div><b>${hit}/7</b><small>Goal days</small></div><div><b>${streak}</b><small>Day streak</small></div></div></div>
<div class="card"><h3>Your goal</h3><div class="fld"><label for="wg">Glasses per day</label><input id="wg" type="number" min="1" max="30" inputmode="numeric" value="${g}" data-chg="wgoal" data-k="waterGoal"></div>
<div class="fld"><label for="wm">Glass size (ml)</label><input id="wm" type="number" min="50" max="1500" step="50" inputmode="numeric" value="${ST.glassMl || 250}" data-chg="wgoal" data-k="glassMl"></div>
<p class="mut sm">Around 8 glasses (2 L) is a common everyday target; hot weather, exercise or long clinical shifts usually mean more.</p>
<details><summary>Fix a past day</summary>${days.slice(-7).reverse().map(d => `<div class="row between mini"><span>${nice(d)}</span><span class="row"><button class="ibtn" data-act="wday" data-d="${d}" data-n="-1" aria-label="Remove">−</button><b>${wGet(d)}</b><button class="ibtn" data-act="wday" data-d="${d}" data-n="1" aria-label="Add">+</button></span></div>`).join('')}</details></div>
</div>`;
}
