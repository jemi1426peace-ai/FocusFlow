'use strict';
/* FocusFlow — Sync across devices.
   Free and serverless: data is encrypted ON THE DEVICE (AES-GCM, key from your sync passphrase)
   and stored in a private GitHub Gist. GitHub only ever sees scrambled text.
   Merging: for each record the newest edit wins; deletions spread via tombstones. */

const SYNC_DESC = 'FocusFlow sync (encrypted)';
const SYNC_FILE = 'focusflow-sync.json';
const GH = 'https://api.github.com';
let SY = null;                 // { token, pass, gistId, last, lastErr } — stored only on this device
let syncing = false, syncTimer = null, syncAgain = false;

async function syncLoad() { SY = await kvGet('sync'); if (SY) delete SY.id; }
const syncSave = () => SY ? kvPut('sync', SY) : new Promise(r => { const q = tx('kv', 'readwrite').delete('sync'); q.onsuccess = r; q.onerror = r; });
const syncOn = () => !!(SY && SY.token && SY.pass);

/* ---------- encryption ---------- */
const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(c => s += String.fromCharCode(c)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sKey(pass, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sKey(pass, salt), new TextEncoder().encode(JSON.stringify(obj)));
  return JSON.stringify({ app: 'focusflow-sync', v: 1, salt: b64(salt), iv: b64(iv), data: b64(ct) });
}
async function unseal(text, pass) {
  const j = JSON.parse(text);
  if (j.app !== 'focusflow-sync') throw new Error('Not a FocusFlow sync file');
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(j.iv) }, await sKey(pass, unb64(j.salt)), unb64(j.data));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (e) { const er = new Error('Wrong sync passphrase'); er.pass = true; throw er; }
}

/* ---------- snapshot & merge (also used by "Merge a backup file") ---------- */
const SYNC_SKIP = ['pin', 'salt'];          // never leave the device
function snapshot() {
  const settings = {}; Object.keys(ST).forEach(k => { if (!SYNC_SKIP.includes(k)) settings[k] = ST[k]; });
  return { stores: Object.fromEntries(STORES.map(s => [s, D[s]])), tomb: TOMB, settings };
}
const ts = o => (o && (o.updated || o.created)) || '';
/* merges `remote` into the local data; returns how many things changed locally */
async function mergeIn(remote) {
  let n = 0; const cut = new Date(Date.now() - 120 * 864e5).toISOString();
  Object.entries(remote.tomb || {}).forEach(([k, t]) => { if (!TOMB[k] || TOMB[k] < t) TOMB[k] = t; });
  Object.keys(TOMB).forEach(k => { if (TOMB[k] < cut) delete TOMB[k]; });
  for (const s of STORES) {
    const rl = (remote.stores || remote.data || {})[s] || [];
    for (const r of rl) {
      if (!r || !r.id) continue;
      const tb = TOMB[s + ':' + r.id]; if (tb && tb >= ts(r)) continue;
      const l = D[s].find(x => x.id === r.id);
      if (!l || ts(r) > ts(l)) { await put(s, r, true); n++; }
    }
    for (const l of D[s].slice()) { const tb = TOMB[s + ':' + l.id]; if (tb && tb >= ts(l)) { await del(s, l.id, true); n++; } }
  }
  await saveTomb();
  const rs = remote.settings;
  if (rs && (rs._u || '') > (ST._u || '')) {
    SYNC_SKIP.forEach(k => delete rs[k]);
    Object.assign(ST, rs); fillWidgets(); ST.widgets = ST.widgets.filter(x => WIDGETS.find(w => w[0] === x.id));
    await saveSTraw(); applyLook(); n++;
  }
  return n;
}

/* ---------- GitHub Gist transport ---------- */
async function gh(path, opt = {}) {
  const r = await fetch(GH + path, { ...opt, cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + SY.token, ...(opt.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status === 401) throw new Error('GitHub token was rejected — it may have expired. Set up sync again with a new token.');
  if (r.status === 403 || r.status === 404) { const e = new Error(r.status === 404 ? 'Sync storage not found' : 'GitHub refused — make sure the token has the “gist” permission'); e.code = r.status; throw e; }
  if (!r.ok) throw new Error('GitHub error ' + r.status);
  return r.json();
}
async function findGist() {
  for (let page = 1; page <= 5; page++) {
    const l = await gh(`/gists?per_page=100&page=${page}`);
    const g = l.find(x => x.files && x.files[SYNC_FILE]); if (g) return g.id;
    if (l.length < 100) break;
  }
  return null;
}
async function readGist(id) {
  const g = await gh('/gists/' + id), f = g.files && g.files[SYNC_FILE];
  if (!f) return null;
  if (f.truncated && f.raw_url) return (await fetch(f.raw_url, { cache: 'no-store' })).text();
  return f.content;
}

/* ---------- the sync itself ---------- */
async function syncNow(manual) {
  if (!syncOn()) return;
  if (syncing) { syncAgain = true; return; }
  if (!navigator.onLine) { if (manual) toast('You are offline — will sync when back online'); return; }
  syncing = true; syncBadge();
  try {
    if (!SY.gistId) SY.gistId = await findGist();
    let n = 0;
    if (SY.gistId) {
      let txt = null;
      try { txt = await readGist(SY.gistId); } catch (e) { if (e.code === 404) SY.gistId = null; else throw e; }
      if (txt) n = await mergeIn(await unseal(txt, SY.pass));
    }
    const body = await seal(snapshot(), SY.pass);
    if (SY.gistId) await gh('/gists/' + SY.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [SYNC_FILE]: { content: body } } }) });
    else SY.gistId = (await gh('/gists', { method: 'POST', body: JSON.stringify({ description: SYNC_DESC, public: false, files: { [SYNC_FILE]: { content: body } } }) })).id;
    SY.last = new Date().toISOString(); SY.lastErr = null; await syncSave();
    if (n && !document.querySelector('.overlay') && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) render();
    if (manual === true) toast(n ? `Synced ✓ — ${n} update${n === 1 ? '' : 's'} from your other devices` : 'Synced ✓ — everything is up to date');
  } catch (e) {
    SY.lastErr = e.message; await syncSave();
    if (manual === true || (e.pass && manual !== 'setup')) toast('Sync problem: ' + e.message, 6000);
  } finally {
    syncing = false; syncBadge(); if (VIEW === 'set' && !document.querySelector('.overlay')) render();
    if (syncAgain) { syncAgain = false; syncSoon(); }
  }
}
/* called after every local change: waits a few seconds so a burst of edits becomes one upload */
function syncSoon() { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 4000); }

function ago(iso) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString();
}
function syncBadge() {
  document.querySelectorAll('[data-sync]').forEach(b => {
    b.hidden = !syncOn() || (!SY.last && !SY.lastErr && !syncing);
    b.textContent = syncing ? '🔄 Syncing…' : SY && SY.lastErr ? '⚠️ Sync issue' : '☁️ Synced ' + ago(SY && SY.last);
    b.classList.toggle('err', !!(SY && SY.lastErr && !syncing));
  });
}

/* ---------- Settings card & setup ---------- */
function syncCard() {
  if (!syncOn()) return `<div class="card wcard t-blue"><h3>☁️ Sync across devices</h3><p class="sm">Keep your iPad, phone and laptop in step. Free, private and <b>end-to-end encrypted</b> — your data is locked with a passphrase before it leaves the device.</p>
<div class="row wrap"><button class="btn" data-act="syncsetup">Set up sync</button><button class="btn ghost" data-act="mergepick">Merge a backup file</button></div>
<p class="mut sm" style="margin-top:8px">No GitHub account? Use <b>Export backup</b> on one device and <b>Merge a backup file</b> on the other (AirDrop, Drive, WhatsApp to yourself…). Merging keeps the newest version of everything.</p></div>`;
  return `<div class="card wcard t-blue"><h3>☁️ Sync across devices</h3><p class="sm">${SY.lastErr ? `⚠️ <b>Last sync failed:</b> ${esc(SY.lastErr)}` : `✅ On · last synced <b>${ago(SY.last)}</b>`}</p>
<p class="mut sm">Syncs automatically when you open the app, after changes, and every few minutes. Encrypted with your passphrase.</p>
<div class="row wrap"><button class="btn" data-act="syncgo">Sync now</button><button class="btn ghost" data-act="mergepick">Merge a backup file</button><button class="btn warn" data-act="syncoff">Turn off</button></div></div>`;
}
A.syncsetup = () => {
  if (!(window.crypto && crypto.subtle)) return toast('Sync needs the app to be opened over https');
  const o = modal(`<h3>☁️ Set up sync</h3>
<p class="sm">Do this once on <b>each</b> device, using the same token and passphrase.</p>
<ol class="steps sm">
<li>Sign in to <b>GitHub</b> (free) and open <a href="https://github.com/settings/tokens/new?scopes=gist&description=FocusFlow%20sync" target="_blank" rel="noopener">this token page</a>.</li>
<li>Set <b>Expiration</b> to “No expiration” (or a long time), keep only <b>gist</b> ticked, then tap <b>Generate token</b>.</li>
<li>Copy the token (starts with <code>ghp_</code>) and paste it below. Keep it secret.</li>
<li>Choose a <b>sync passphrase</b>. It encrypts your data — use the same one on every device. If you forget it, the synced copy can't be opened (your device data stays safe).</li></ol>
<form><div class="fld"><label for="sy_t">GitHub token</label><input id="sy_t" name="t" type="password" autocomplete="off" placeholder="ghp_…" required></div>
<div class="fld"><label for="sy_p">Sync passphrase (8+ characters)</label><input id="sy_p" name="p" type="password" autocomplete="new-password" minlength="8" required></div>
<div class="row end"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">Connect &amp; sync</button></div></form>`);
  o.querySelector('[data-x]').onclick = o.close;
  o.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const t = e.target.t.value.trim(), p = e.target.p.value;
    if (p.length < 8) return toast('Passphrase needs at least 8 characters');
    const btn = e.target.querySelector('.btn:not(.ghost)'); btn.disabled = true; btn.textContent = 'Connecting…';
    SY = { token: t, pass: p, gistId: null, last: null };
    await syncNow('setup');
    if (SY.lastErr) { const err = SY.lastErr; SY = null; await syncSave(); btn.disabled = false; btn.textContent = 'Connect & sync'; return toast('Could not connect: ' + err, 7000); }
    o.close(); render(); toast('Sync is on ☁️ — set it up on your other devices with the same token and passphrase', 6000);
  };
};
A.syncgo = () => syncNow(true);
A.syncoff = () => confirmBox('Turn off sync on this device? Your data stays here, and the encrypted copy stays in your GitHub account.', async () => { SY = null; await syncSave(); syncBadge(); render(); toast('Sync turned off on this device'); }, 'Turn off');

/* merge a backup file (plain backup from Export, or an encrypted sync file) */
A.mergepick = () => $('#mergefile').click();
document.addEventListener('change', e => {
  if (e.target.id !== 'mergefile' || !e.target.files[0]) return;
  const rd = new FileReader();
  rd.onload = async () => {
    let j; try { j = JSON.parse(rd.result); } catch (x) { return toast('That file could not be read'); }
    try {
      if (j.app === 'focusflow-sync') { if (!SY || !SY.pass) return toast('This is an encrypted sync file — set up sync with its passphrase first'); j = await unseal(rd.result, SY.pass); }
      else if (j.app !== 'focusflow' || !j.data) return toast('That is not a FocusFlow backup');
      else j = { stores: j.data, tomb: {}, settings: null };
      const n = await mergeIn(j); render(); toast(n ? `Merged ✓ — ${n} newer item${n === 1 ? '' : 's'} added or updated` : 'Nothing new in that file — already up to date');
      syncSoon();
    } catch (x) { toast(x.message); }
  };
  rd.readAsText(e.target.files[0]); e.target.value = '';
});

/* ---------- automatic triggers ---------- */
window.addEventListener('online', () => syncNow(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(false); });
setInterval(() => { if (!document.hidden) syncNow(false); }, 5 * 60000);
setInterval(syncBadge, 30000);
