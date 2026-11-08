'use strict';
/* FocusFlow — Spiritual Growth: Bible reading plan tracker, insight journal, verse of the day */

/* ---------- the 66 books and their chapter counts ---------- */
const BOOKS = [['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34], ['Joshua', 24], ['Judges', 21], ['Ruth', 4],
  ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13],
  ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31], ['Ecclesiastes', 12], ['Song of Songs', 8], ['Isaiah', 66], ['Jeremiah', 52],
  ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9], ['Obadiah', 1], ['Jonah', 4], ['Micah', 7],
  ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13],
  ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
  ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1],
  ['3 John', 1], ['Jude', 1], ['Revelation', 22]];
const chaps = (from, to) => BOOKS.slice(BOOKS.findIndex(b => b[0] === from), BOOKS.findIndex(b => b[0] === to) + 1).flatMap(([b, n]) => Array.from({ length: n }, (_, i) => [b, i + 1]));
const OT = chaps('Genesis', 'Malachi'), NT = chaps('Matthew', 'Revelation');
/* split a list of chapters evenly across `days` */
const split = (list, days) => Array.from({ length: days }, (_, i) => list.slice(Math.ceil(i * list.length / days), Math.ceil((i + 1) * list.length / days)));

const PLANS = {
  year: { name: 'Whole Bible in a year', note: 'Old + New Testament each day · 365 days', days: 365, build: () => { const o = split(OT, 365), n = split(NT, 365); return o.map((x, i) => [x, n[i]]); } },
  nt90: { name: 'New Testament in 90 days', note: 'About 3 chapters a day', days: 90, build: () => split(NT, 90).map(x => [x]) },
  gospels: { name: 'The Gospels in 30 days', note: 'Matthew, Mark, Luke & John', days: 30, build: () => split(chaps('Matthew', 'John'), 30).map(x => [x]) },
  wisdom: { name: 'Psalms & Proverbs in 60 days', note: 'Prayer and wisdom, ~3 chapters a day', days: 60, build: () => split(chaps('Psalms', 'Proverbs'), 60).map(x => [x]) },
  chrono: { name: 'Bible in 2 years (gentle pace)', note: 'Genesis to Revelation, ~1–2 chapters a day', days: 730, build: () => split(OT.concat(NT), 730).map(x => [x]) }
};
const PCACHE = {};
const planDays = k => PCACHE[k] || (PCACHE[k] = PLANS[k].build());

/* "Genesis 1–3; Exodus 1" from a list of [book, chapter] */
function refs(list) {
  const out = []; let cur = null;
  list.forEach(([b, c]) => {
    if (cur && cur.b === b && cur.to === c - 1) cur.to = c;
    else { cur = { b, from: c, to: c }; out.push(cur); }
  });
  return out.map(r => `${r.b} ${r.from}${r.to > r.from ? '–' + r.to : ''}`).join('; ');
}
const dayRefs = (k, i) => planDays(k)[i].filter(p => p.length).map(refs).join(' · ');
const dayCh = (k, i) => planDays(k)[i].reduce((a, p) => a + p.length, 0);

/* ---------- state (stored in the 'bible' store) ---------- */
const BP = () => D.bible.find(x => x.id === 'plan');
const logs = () => D.bible.filter(x => x.type === 'log');
function nextDay(p) { const n = PLANS[p.plan].days; for (let i = 0; i < n; i++) if (!p.done[i]) return i; return -1; }
function readDates() {
  const s = new Set(logs().map(l => l.date));
  const p = BP(); if (p) Object.values(p.done).forEach(d => s.add(d));
  D.insights.forEach(x => s.add(x.date));
  return s;
}
function spStreak() {
  const s = readDates(); let n = 0;
  for (let d = s.has(today()) ? today() : addDays(today(), -1); s.has(d); d = addDays(d, -1)) n++;
  return n;
}
function chaptersRead() {
  const p = BP(); let n = logs().reduce((a, l) => a + (l.ch || 0), 0);
  if (p) Object.keys(p.done).forEach(i => n += dayCh(p.plan, +i));
  return n;
}
const readToday = () => readDates().has(today());
/* the passage to pre-fill: what was read today, otherwise the next unread day */
function todayPassage() {
  const p = BP(); if (!p) return '';
  const d = Object.entries(p.done).find(([, v]) => v === today()), i = d ? +d[0] : nextDay(p);
  return i >= 0 ? dayRefs(p.plan, i) : '';
}

/* ---------- verse of the day (King James Version — public domain) ---------- */
const VERSES = [
  ['Thy word is a lamp unto my feet, and a light unto my path.', 'Psalm 119:105'],
  ['I can do all things through Christ which strengtheneth me.', 'Philippians 4:13'],
  ['Trust in the LORD with all thine heart; and lean not unto thine own understanding.', 'Proverbs 3:5'],
  ['Be still, and know that I am God.', 'Psalm 46:10'],
  ['This is the day which the LORD hath made; we will rejoice and be glad in it.', 'Psalm 118:24'],
  ['Come unto me, all ye that labour and are heavy laden, and I will give you rest.', 'Matthew 11:28'],
  ['The LORD is my shepherd; I shall not want.', 'Psalm 23:1'],
  ['Casting all your care upon him; for he careth for you.', '1 Peter 5:7'],
  ['Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', 'Joshua 1:9'],
  ['Delight thyself also in the LORD; and he shall give thee the desires of thine heart.', 'Psalm 37:4'],
  ['For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', '2 Timothy 1:7'],
  ['But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', 'Isaiah 40:31'],
  ['And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', 'Romans 8:28'],
  ['Create in me a clean heart, O God; and renew a right spirit within me.', 'Psalm 51:10'],
  ['And whatsoever ye do, do it heartily, as to the Lord, and not unto men.', 'Colossians 3:23'],
  ['The LORD bless thee, and keep thee.', 'Numbers 6:24'],
  ['Let all your things be done with charity.', '1 Corinthians 16:14']
];
function verse() { const n = new Date(), d = Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 864e5); return VERSES[d % VERSES.length]; }
const verseHtml = () => { const [t, r] = verse(); return `<blockquote class="verse">“${esc(t)}”<cite>— ${esc(r)} <span>KJV</span></cite></blockquote>`; };

/* ---------- Home widget ---------- */
W.spirit = () => {
  const p = BP(), st = spStreak();
  let reading;
  if (!p) reading = `<p class="sm">Start a reading plan to get a passage each day.</p><button class="btn sm" data-act="go" data-v="spirit">Choose a plan</button>`;
  else {
    const i = nextDay(p);
    reading = i < 0 ? `<p>🎉 You finished <b>${esc(PLANS[p.plan].name)}</b>!</p>` : Object.values(p.done).includes(today()) && i >= 0
      ? `<p class="sm mut">✓ Today's reading done · next up: Day ${i + 1}</p><p class="bref">${esc(dayRefs(p.plan, i))}</p><button class="btn ghost sm" data-act="bdone" data-i="${i}">Read ahead ✓</button>`
      : `<p class="sm mut">Day ${i + 1} of ${PLANS[p.plan].days}</p><p class="bref">📖 ${esc(dayRefs(p.plan, i))}</p><button class="btn sm" data-act="bdone" data-i="${i}">✓ Mark as read</button>`;
  }
  return `${verseHtml()}<div class="sp-read">${reading}</div>
<form data-sub="qinsight" class="stack" style="margin-top:10px"><textarea name="t" rows="2" placeholder="Today's insight — what is God showing you?" required></textarea><div class="row between"><span class="mut sm">${st ? `🔥 ${st}-day streak` : 'Start your streak today'}</span><button class="btn ghost sm">Save insight</button></div></form>`;
};
A.qinsight = el => {
  const t = el.elements.t.value.trim(); if (!t) return;
  put('insights', { date: today(), passage: todayPassage(), insight: t });
  toast('Insight saved 🕊️'); render();
};

/* ---------- actions ---------- */
A.bdone = el => {
  const p = BP(), i = +el.dataset.i; if (!p) return;
  if (p.done[i]) delete p.done[i]; else p.done[i] = today();
  put('bible', p);
  if (p.done[i]) toast(nextDay(p) < 0 ? 'Plan complete! What a faithful journey 🎉🙏' : `Day ${i + 1} done 🙏${spStreak() > 1 ? ' · ' + spStreak() + '-day streak 🔥' : ''}`);
  render();
};
A.bplan = el => {
  const k = el.dataset.k, cur = BP();
  const start = () => { put('bible', { id: 'plan', plan: k, start: today(), done: {} }); T.sp = 'today'; toast('Plan started — Day 1 is ready 📖'); render(); };
  if (cur && Object.keys(cur.done).length) confirmBox(`Switch to “${PLANS[k].name}”? Progress on your current plan (${Object.keys(cur.done).length} days) will be reset. Your insights and streak are kept.`, start, 'Switch plan');
  else start();
};
A.brestart = () => confirmBox('Restart this plan from Day 1? Your insights and streak are kept.', () => { const p = BP(); p.done = {}; p.start = today(); put('bible', p); render(); }, 'Restart');
A.bcatch = () => { const p = BP(); const i = nextDay(p); p.start = addDays(today(), -i); put('bible', p); toast('Schedule moved — you are on track again 💜'); render(); };
A.blog = el => {
  const f = el.elements, b = f.book.value, n = (BOOKS.find(x => x[0] === b) || [, 1])[1];
  let a = Math.max(1, Math.min(n, +f.from.value || 1)), z = Math.max(a, Math.min(n, +f.to.value || a));
  put('bible', { type: 'log', date: today(), book: b, from: a, to: z, ch: z - a + 1 }); toast(`Logged ${b} ${a}${z > a ? '–' + z : ''} 📖`); render();
};
A.blogdel = el => confirmBox('Remove this reading log?', async () => { await del('bible', el.dataset.id); render(); });
A.sinsight = el => {
  const f = el.elements, o = { date: today(), passage: f.passage.value.trim(), insight: f.insight.value.trim(), prayer: f.prayer.value.trim(), apply: f.apply.value.trim() };
  if (!o.insight && !o.prayer && !o.apply) return toast('Write at least one thing that stood out');
  put('insights', o); toast('Insight saved 🕊️'); render();
};
A.isearch = el => { T.iq = el.value; render(); const i = $('#iq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };

FORMS.insights = {
  name: 'insight', def: () => ({ date: today(), passage: todayPassage() }),
  fields: () => [{ k: 'date', label: 'Date', type: 'date', req: 1 }, { k: 'passage', label: 'Passage', ph: 'e.g. Psalm 23' },
    { k: 'insight', label: 'What stood out to me', type: 'textarea', rows: 4 }, { k: 'prayer', label: 'My prayer', type: 'textarea' },
    { k: 'apply', label: 'How I will live it out', type: 'textarea' }]
};

/* ---------- page ---------- */
T.sp = 'today'; T.iq = '';
V.spirit = () => {
  const k = T.sp, p = BP();
  let body = '';
  if (k === 'today') {
    let rd;
    if (!p) rd = `<div class="card t-sage wcard"><h3>📖 Today's reading</h3><p>No plan yet. Pick one to get a short passage each day.</p><button class="btn sm" data-act="tab" data-k="sp" data-v="plan">Choose a plan</button></div>`;
    else {
      const i = nextDay(p), P = PLANS[p.plan], dn = Object.keys(p.done).length, exp = Math.min(P.days, diffDays(p.start, today()) + 1), behind = exp - dn - (Object.values(p.done).includes(today()) ? 0 : 1);
      rd = `<div class="card wcard t-sage"><div class="row between"><h3>📖 Today's reading</h3><span class="badge c3">${esc(P.name)}</span></div>
${i < 0 ? `<p>🎉 Plan complete — ${dn} days of faithfulness.</p><button class="btn ghost sm" data-act="brestart">Read it again</button>` : `
${Object.values(p.done).includes(today()) ? `<p class="badge c3" style="margin:2px 0 8px">✓ Today's reading done — well done 🙏</p><p class="mut sm">Want to read ahead? Day ${i + 1}:</p>` : `<p class="mut sm">Day ${i + 1} of ${P.days}</p>`}${planDays(p.plan)[i].filter(x => x.length).map(x => `<p class="bref big">${esc(refs(x))}</p>`).join('')}
<button class="btn ${Object.values(p.done).includes(today()) ? 'ghost' : ''}" data-act="bdone" data-i="${i}" style="margin-top:6px">✓ ${Object.values(p.done).includes(today()) ? 'Read ahead' : "I've read this"}</button>`}
${bar(dn / P.days * 100)}<p class="mut sm">${dn}/${P.days} days · ${Math.round(dn / P.days * 100)}% complete</p>
${behind > 0 && i >= 0 ? `<p class="sm">You're ${behind} day${behind > 1 ? 's' : ''} behind the calendar — that's okay, grace not guilt 💜 <button class="lnk sm" data-act="bcatch" style="min-height:0;color:var(--acc)">Move my schedule</button></p>` : ''}</div>`;
    }
    body = `<div class="grid">
<div class="card wcard t-lav"><h3>✨ Verse of the day</h3>${verseHtml()}</div>
${rd}
<div class="card wcard t-pink"><h3>🌱 Your growth</h3><div class="stats"><div><b>${spStreak()}</b><small>Day streak 🔥</small></div><div><b>${chaptersRead()}</b><small>Chapters read</small></div><div><b>${D.insights.length}</b><small>Insights</small></div></div>
${(() => { const s = readDates(); return `<div class="mstrip">${Array.from({ length: 7 }, (_, j) => addDays(today(), j - 6)).map(d => `<div class="${d === today() ? 'tday' : ''}"><span class="me">${s.has(d) ? '🌿' : '·'}</span><small>${'SMTWTFS'[pd(d).getDay()]}</small></div>`).join('')}</div>`; })()}</div>
</div>
<form data-sub="sinsight" class="card wcard t-blue insight-box" style="margin-top:14px"><h3>🕊️ Insight box</h3><p class="mut sm">A simple pattern: what you read, what stood out, how you'll pray and live it.</p>
<div class="fld"><label for="i_p">Passage</label><input id="i_p" name="passage" value="${esc(todayPassage())}" placeholder="e.g. John 15"></div>
<div class="grid ib-grid"><div class="fld"><label for="i_i">💡 What stood out to me</label><textarea id="i_i" name="insight" rows="4" placeholder="A verse, a word, a question…"></textarea></div>
<div class="fld"><label for="i_r">🙏 My prayer</label><textarea id="i_r" name="prayer" rows="4" placeholder="Talk to God about it…"></textarea></div>
<div class="fld"><label for="i_a">👣 How I'll live it out</label><textarea id="i_a" name="apply" rows="4" placeholder="One small step today…"></textarea></div></div>
<button class="btn">Save insight</button></form>
<div class="card" style="margin-top:14px"><h3>Read something else today?</h3><form data-sub="blog" class="row wrap"><select name="book" style="flex:2;min-width:160px" aria-label="Book">${BOOKS.map(([b]) => `<option>${b}</option>`).join('')}</select><input name="from" type="number" min="1" inputmode="numeric" placeholder="Chapter" style="flex:1;min-width:90px" required aria-label="From chapter"><input name="to" type="number" min="1" inputmode="numeric" placeholder="to (optional)" style="flex:1;min-width:110px" aria-label="To chapter"><button class="btn">Log</button></form>
${logs().filter(l => l.date >= addDays(today(), -6)).sort((a, b) => b.created.localeCompare(a.created)).map(l => `<div class="row between mini"><span>📖 ${esc(l.book)} ${l.from}${l.to > l.from ? '–' + l.to : ''} <span class="mut sm">· ${nice(l.date)}</span></span><button class="ibtn" data-act="blogdel" data-id="${l.id}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
  }
  if (k === 'plan') {
    body = `<div class="grid">${Object.entries(PLANS).map(([key, P]) => `<div class="card wcard ${p && p.plan === key ? 't-sage' : 't-lav'}"><h3>${esc(P.name)}</h3><p class="mut sm">${esc(P.note)}</p><p class="sm">Day 1: <i>${esc(dayRefs(key, 0))}</i></p>${p && p.plan === key ? '<span class="badge c3">✓ Current plan</span>' : `<button class="btn ghost sm" data-act="bplan" data-k="${key}">Start this plan</button>`}</div>`).join('')}</div>`;
    if (p) {
      const P = PLANS[p.plan], all = planDays(p.plan), blocks = [];
      for (let s = 0; s < P.days; s += 30) blocks.push([s, Math.min(P.days, s + 30)]);
      const ni = nextDay(p);
      body += `<h2 style="margin-top:20px">${esc(P.name)} — all days</h2><p class="mut sm">Tick days off in any order. Started ${nice(p.start)}. <button class="lnk sm" data-act="brestart" style="min-height:0;color:var(--danger)">Restart plan</button></p>` +
        blocks.map(([a, z]) => { const dn = Object.keys(p.done).filter(i => +i >= a && +i < z).length; return `<details class="card" style="margin-top:8px" ${ni >= a && ni < z ? 'open' : ''}><summary>Days ${a + 1}–${z} <span class="mut sm">· ${dn}/${z - a} read</span></summary>${all.slice(a, z).map((_, j) => { const i = a + j; return `<label class="sub bday ${p.done[i] ? 'dn' : ''}"><input type="checkbox" data-chg="bdone" data-i="${i}" ${p.done[i] ? 'checked' : ''}> <b>Day ${i + 1}</b> <span>${esc(dayRefs(p.plan, i))}</span></label>`; }).join('')}</details>`; }).join('');
    }
  }
  if (k === 'insights') {
    const q = (T.iq || '').toLowerCase();
    const l = D.insights.slice().sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created)).filter(x => !q || [x.passage, x.insight, x.prayer, x.apply].join(' ').toLowerCase().includes(q));
    body = `<input id="iq" type="search" placeholder="Search your insights, prayers, passages…" value="${esc(T.iq || '')}" data-chg="isearch" style="margin-bottom:12px">
<div class="list">${l.map(x => `<div class="card insight"><div class="row between"><span><b>${esc(x.passage || 'Insight')}</b> <span class="mut sm">· ${nice(x.date)}</span></span><span class="row"><button class="ibtn" data-act="edit" data-s="insights" data-id="${x.id}" aria-label="Edit">✏️</button><button class="ibtn" data-act="del" data-s="insights" data-id="${x.id}" aria-label="Delete">🗑</button></span></div>
${x.insight ? `<p class="iq-l">💡 ${esc(x.insight)}</p>` : ''}${x.prayer ? `<p class="iq-l">🙏 ${esc(x.prayer)}</p>` : ''}${x.apply ? `<p class="iq-l">👣 ${esc(x.apply)}</p>` : ''}</div>`).join('') || empty(q ? 'No insights match that search.' : 'Your insights will collect here — a record of what God has been teaching you.')}</div>`;
  }
  return hd('Spiritual Growth', k === 'insights' ? `<button class="btn" data-act="add" data-s="insights">+ Insight</button>` : '') +
    tabs('sp', [['today', '☀️ Today'], ['plan', '📖 Reading plan'], ['insights', '🕊️ Insights']]) + body;
};
