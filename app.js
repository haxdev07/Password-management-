(() => {
  const KEY = 'securevault.vault.v1', DEFAULT_CATS = ['Social Media', 'Banking', 'Education', 'Work', 'Shopping', 'Entertainment', 'Other'];
  const LOCK_MS = 5 * 60 * 1000;
  const $app = document.getElementById('app');
  let key = null, data = null, meta = null, view = 'dashboard', f = { q: '', cat: '', sort: 'recent', fav: false }, timer = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => { const d = document.createElement('div'); d.className = 'toast ' + t; d.textContent = m; document.getElementById('toasts').append(d); setTimeout(() => d.remove(), 3500); };
  const copy = async (t, m) => { try { await navigator.clipboard.writeText(t); toast(m, 'success'); setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30000); } catch { toast('Copy failed', 'danger'); } };
  const cats = () => DEFAULT_CATS.concat(data.categories);
  const uid = () => SV.b64(SV.rand(9)).replace(/[+/=]/g, 'x');
  const fmt = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');
  const persist = async () => { meta.data = await SV.seal(key, data); localStorage.setItem(KEY, JSON.stringify(meta)); };
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.classList.toggle('loading', on); };

  const bump = () => { clearTimeout(timer); if (key) timer = setTimeout(() => lock('Vault locked after 5 minutes of inactivity.'), LOCK_MS); };
  ['click', 'keydown', 'pointermove'].forEach((e) => document.addEventListener(e, bump, { passive: true }));
  function lock(msg) { key = null; data = null; clearTimeout(timer); render(); if (msg) toast(msg); }

  const meter = (id = 'meter') => `<div class="meter" id="${id}"><span></span></div><small class="muted" id="${id}-l"></small>`;
  function paintMeter(p, id = 'meter') { const s = Gen.strength(p), m = document.getElementById(id); if (!m) return; m.className = 'meter' + (s >= 0 ? ' s' + s : ''); document.getElementById(id + '-l').textContent = s >= 0 ? Gen.LABELS[s] : ''; }
  function audit() {
    const groups = {}; data.entries.forEach((e) => (groups[e.password] ||= []).push(e.title));
    const weak = data.entries.filter((e) => Gen.strength(e.password) <= 1), reused = Object.values(groups).filter((g) => g.length > 1);
    const bad = new Set([...weak.map((e) => e.title), ...reused.flat()]);
    const pct = data.entries.length ? Math.round((100 * data.entries.filter((e) => !bad.has(e.title)).length) / data.entries.length) : 100;
    return { weak, reused, pct };
  }

  function authView() {
    const has = !!localStorage.getItem(KEY);
    $app.innerHTML = `<header class="top"><b class="brand">🛡️ SecureVault</b></header>
    <section class="hero"><h1>Your passwords. <span class="accent">Encrypted. Yours.</span></h1>
    <p class="muted">AES-256-GCM encryption with a PBKDF2-derived key. Everything happens in your browser — nothing is ever uploaded.</p></section>
    <section class="auth"><form id="auth" class="card" novalidate><h2>${has ? 'Unlock your vault' : 'Create your vault'}</h2>
    <div class="fg"><label for="mp">Master password</label><input id="mp" type="password" autocomplete="${has ? 'current-password' : 'new-password'}" required></div>
    ${has ? '' : `${meter()}<div class="fg"><label for="mp2">Confirm master password</label><input id="mp2" type="password" autocomplete="new-password" required></div>
    <p class="warn">⚠️ There is no recovery. If you forget this password, your vault is permanently inaccessible.</p>`}
    <p class="err" id="err"></p><button class="btn btn-primary w100">${has ? 'Unlock' : 'Create vault'}</button>
    ${has ? '<p class="muted center small">Data is stored only in this browser.</p>' : ''}</form></section>`;
  }

  function shell(html) {
    const nav = [['dashboard', '📊', 'Dashboard'], ['vault', '🔐', 'My Vault'], ['generator', '🎲', 'Password Generator'], ['categories', '🏷️', 'Categories'], ['security', '🛡️', 'Security Center'], ['settings', '⚙️', 'Settings']];
    $app.innerHTML = `<div class="app"><aside class="sidebar"><b class="brand">🛡️ SecureVault</b><nav>${nav.map(([v, i, l]) => `<a href="#${v}" class="${view === v || (view === 'form' && v === 'vault') ? 'on' : ''}">${i} <span>${l}</span></a>`).join('')}</nav>
    <button class="btn btn-ghost" data-act="logout">🚪 Logout</button></aside><main class="main">${html}</main></div>`;
  }

  const entryCard = (e) => `<div class="card entry"><div><h3>${esc(e.title)} ${e.fav ? '⭐' : ''}</h3>
    <p class="muted">${esc(e.username)} <button class="icon" data-act="copyu" data-id="${e.id}" aria-label="Copy username">📋</button></p>
    ${/^https?:\/\//i.test(e.url) ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.url)}</a>` : ''} <span class="tag">${esc(e.category)}</span>
    <code class="pw hidden" id="pw-${e.id}"></code></div>
    <div class="actions"><button class="btn btn-ghost" data-act="show" data-id="${e.id}">Show</button><button class="btn btn-ghost" data-act="copyp" data-id="${e.id}">Copy password</button>
    <button class="icon" data-act="fav" data-id="${e.id}" aria-label="Toggle favorite">${e.fav ? '★' : '☆'}</button><a class="icon" href="#edit/${e.id}" aria-label="Edit">✏️</a>
    <button class="icon" data-act="del" data-id="${e.id}" aria-label="Delete">🗑️</button></div></div>`;
  const empty = (t) => `<div class="card center empty"><div class="big-i">🗝️</div><p class="muted">${t}</p><a class="btn btn-primary" href="#add">Add password</a></div>`;

  function dashboardView() {
    const a = audit(), recent = [...data.entries].sort((x, y) => y.created - x.created).slice(0, 5), used = new Set(data.entries.map((e) => e.category));
    shell(`<h1>Welcome back 👋</h1><div class="search"><input id="gq" placeholder="Search by website or username" aria-label="Search"><button class="btn btn-primary" data-act="gsearch">Search</button></div>
    <div class="grid4"><div class="card stat"><span class="muted">Saved accounts</span><b>${data.entries.length}</b></div><div class="card stat"><span class="muted">Categories in use</span><b>${used.size}</b></div>
    <div class="card stat"><span class="muted">Weak passwords</span><b>${a.weak.length}</b></div><div class="card stat"><span class="muted">Security score</span><b>${a.pct}%</b></div></div>
    <div class="row wrap"><a class="btn btn-primary" href="#add">➕ Add password</a><a class="btn btn-ghost" href="#generator">Generate</a><a class="btn btn-ghost" href="#security">Security Center</a></div>
    <h2>Recently added</h2>${recent.length ? recent.map(entryCard).join('') : empty('Your vault is empty.')}`);
  }

  function listHtml() {
    const L = data.entries.filter((e) => (!f.cat || e.category === f.cat) && (!f.fav || e.fav) && (!f.q || e.title.toLowerCase().includes(f.q) || e.username.toLowerCase().includes(f.q)));
    L.sort(f.sort === 'name' ? (a, b) => a.title.localeCompare(b.title) : f.sort === 'used' ? (a, b) => (b.used || 0) - (a.used || 0) : (a, b) => b.created - a.created);
    return L.length ? L.map(entryCard).join('') : empty('No credentials found.');
  }
  function vaultView() {
    shell(`<div class="row between"><h1>My Vault</h1><a class="btn btn-primary" href="#add">➕ Add</a></div>
    <div class="filters card"><input data-f="q" value="${esc(f.q)}" placeholder="Search website or username" aria-label="Search">
    <select data-f="cat" aria-label="Category"><option value="">All categories</option>${cats().map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <select data-f="sort" aria-label="Sort"><option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>Recently added</option><option value="used" ${f.sort === 'used' ? 'selected' : ''}>Recently used</option><option value="name" ${f.sort === 'name' ? 'selected' : ''}>Name</option></select>
    <label class="chk"><input type="checkbox" data-f="fav" ${f.fav ? 'checked' : ''}> Favorites</label></div><div id="list">${listHtml()}</div>`);
  }

  function formView(id) {
    const e = id ? data.entries.find((x) => x.id === id) : { title: '', url: '', username: '', password: '', category: 'Other', notes: '', fav: false };
    if (!e) { location.hash = '#vault'; return; }
    shell(`<h1>${id ? 'Edit' : 'Add'} password</h1><form id="entry" class="card narrow" data-id="${id || ''}" novalidate>
    <div class="fg"><label for="t">Website name</label><input id="t" value="${esc(e.title)}" maxlength="120" required></div>
    <div class="fg"><label for="u">Website URL</label><input id="u" value="${esc(e.url)}" placeholder="https://" maxlength="500"></div>
    <div class="fg"><label for="n">Username or email</label><input id="n" value="${esc(e.username)}" maxlength="254" autocomplete="off" required></div>
    <div class="fg"><label for="p">Password</label><div class="row"><input id="p" type="password" value="${esc(e.password)}" maxlength="256" autocomplete="new-password" required>
    <button type="button" class="btn btn-ghost" data-act="toggle">Show</button><button type="button" class="btn btn-ghost" data-act="gen">Generate</button></div></div>${meter()}
    <div class="fg"><label for="c">Category</label><select id="c">${cats().map((c) => `<option ${c === e.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="fg"><label for="no">Notes</label><textarea id="no" rows="3" maxlength="2000">${esc(e.notes)}</textarea></div>
    <label class="chk"><input type="checkbox" id="fv" ${e.fav ? 'checked' : ''}> Mark as favorite</label><p class="err" id="err"></p>
    <div class="row"><button class="btn btn-primary">Save</button><a class="btn btn-ghost" href="#vault">Cancel</a></div></form>`);
    paintMeter(e.password);
  }

  function generatorView() {
    shell(`<h1>Password Generator</h1><div class="card narrow"><div class="fg"><label for="len">Length: <b id="lo">16</b></label><input type="range" id="len" min="8" max="64" value="16"></div>
    <div class="row wrap">${['upper', 'lower', 'digits', 'symbols'].map((k) => `<label class="chk"><input type="checkbox" data-g="${k}" checked> ${{ upper: 'Uppercase', lower: 'Lowercase', digits: 'Numbers', symbols: 'Symbols' }[k]}</label>`).join('')}</div>
    <div class="row"><input id="go" readonly aria-label="Generated password"><button class="btn btn-ghost" data-act="copyg">Copy</button></div>${meter()}<button class="btn btn-primary" data-act="regen">Generate</button></div>`);
    regen();
  }
  function regen() {
    try { const o = {}; document.querySelectorAll('[data-g]').forEach((c) => (o[c.dataset.g] = c.checked)); const p = Gen.generate(+document.getElementById('len').value, o); document.getElementById('go').value = p; paintMeter(p); }
    catch (e) { toast(e.message, 'danger'); }
  }

  function categoriesView() {
    shell(`<h1>Categories</h1><form id="catform" class="card row narrow"><input id="cn" placeholder="New category name" maxlength="40" aria-label="New category"><button class="btn btn-primary">Add</button></form>
    ${cats().map((c) => { const n = data.entries.filter((e) => e.category === c).length, custom = data.categories.includes(c); return `<div class="card entry"><div><h3>${esc(c)}</h3><p class="muted">${n} entr${n === 1 ? 'y' : 'ies'}</p></div>${custom ? `<button class="icon" data-act="delcat" data-c="${esc(c)}" aria-label="Delete category">🗑️</button>` : '<span class="tag">Default</span>'}</div>`; }).join('')}`);
  }

  function securityView() {
    const a = audit();
    shell(`<h1>Security Center</h1><div class="grid4"><div class="card stat"><span class="muted">Security score</span><b>${a.pct}%</b></div><div class="card stat"><span class="muted">Weak</span><b>${a.weak.length}</b></div>
    <div class="card stat"><span class="muted">Reuse groups</span><b>${a.reused.length}</b></div><div class="card stat"><span class="muted">Last review</span><b class="small">${fmt(data.lastReview)}</b></div></div>
    <h2>Weak passwords</h2>${a.weak.map((e) => `<div class="card entry"><div><h3>${esc(e.title)}</h3><span class="muted">${Gen.LABELS[Gen.strength(e.password)]}</span></div><a class="btn btn-ghost" href="#edit/${e.id}">Fix</a></div>`).join('') || '<p class="muted">No weak passwords found. 🎉</p>'}
    <h2>Reused passwords</h2>${a.reused.map((g) => `<div class="card"><b>Shared by:</b> ${g.map(esc).join(', ')}</div>`).join('') || '<p class="muted">No reuse detected.</p>'}
    <div class="row"><button class="btn btn-primary" data-act="review">Mark review complete</button></div><p class="muted">Analysis runs locally; passwords never leave your device.</p>`);
  }

  function settingsView() {
    shell(`<h1>Profile &amp; Settings</h1><div class="card narrow"><b>Local vault</b><p class="muted">${data.entries.length} entries · created ${fmt(meta.created)} · KDF: PBKDF2-SHA256 × ${meta.iter.toLocaleString()} · auto-locks after 5 min.</p></div>
    <form id="chpw" class="card narrow" novalidate><h2>Change master password</h2><div class="fg"><label for="cp">Current password</label><input id="cp" type="password" autocomplete="current-password"></div>
    <div class="fg"><label for="np">New password</label><input id="np" type="password" autocomplete="new-password"></div><div class="fg"><label for="np2">Confirm new password</label><input id="np2" type="password" autocomplete="new-password"></div>
    <p class="warn">⚠️ No recovery exists. Forgetting your master password means permanent data loss. Keep an encrypted export somewhere safe.</p><p class="err" id="err"></p><button class="btn btn-primary">Change password</button></form>
    <form id="exp" class="card narrow"><h2>Encrypted export</h2><div class="fg"><label for="ep">Export passphrase (8+ chars)</label><input id="ep" type="password"></div><button class="btn btn-ghost">Download export</button></form>
    <form id="imp" class="card narrow"><h2>Import</h2><div class="fg"><label for="if">Export file</label><input id="if" type="file" accept=".json"></div><div class="fg"><label for="ip">Passphrase</label><input id="ip" type="password"></div><button class="btn btn-ghost">Import</button></form>
    <div class="card narrow"><h2>Danger zone</h2><button class="btn btn-danger" data-act="wipe">Delete this vault</button></div>`);
  }

  function render() {
    if (!key) return authView();
    const [v, id] = (location.hash.slice(1) || 'dashboard').split('/');
    if (v === 'add' || v === 'edit') { view = 'form'; return formView(v === 'edit' ? id : null); }
    const views = { dashboard: dashboardView, vault: vaultView, generator: generatorView, categories: categoriesView, security: securityView, settings: settingsView };
    view = views[v] ? v : 'dashboard'; views[view]();
  }
  window.addEventListener('hashchange', render);

  const find = (id) => data.entries.find((e) => e.id === id);
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, id = b.dataset.id, e = id && find(id);
    if (a === 'logout') return lock('Vault locked.');
    if (a === 'gsearch') { f.q = document.getElementById('gq').value.trim().toLowerCase(); location.hash = '#vault'; return; }
    if (a === 'copyu') return copy(e.username, 'Username copied');
    if (a === 'copyp') { e.used = Date.now(); await persist(); return copy(e.password, 'Password copied'); }
    if (a === 'show') { const el = document.getElementById('pw-' + id); if (el.classList.toggle('hidden')) { el.textContent = ''; b.textContent = 'Show'; } else { el.textContent = e.password; b.textContent = 'Hide'; e.used = Date.now(); persist(); setTimeout(() => { el.classList.add('hidden'); el.textContent = ''; b.textContent = 'Show'; }, 15000); } return; }
    if (a === 'fav') { e.fav = !e.fav; await persist(); return render(); }
    if (a === 'del') { if (confirm(`Delete "${e.title}"? This cannot be undone.`)) { data.entries = data.entries.filter((x) => x.id !== id); await persist(); toast('Entry deleted.'); render(); } return; }
    if (a === 'toggle') { const p = document.getElementById('p'); p.type = p.type === 'password' ? 'text' : 'password'; b.textContent = p.type === 'password' ? 'Show' : 'Hide'; return; }
    if (a === 'gen') { const p = document.getElementById('p'); p.value = Gen.generate(20); paintMeter(p.value); return; }
    if (a === 'regen') return regen();
    if (a === 'copyg') { const v = document.getElementById('go').value; return v && copy(v, 'Password copied'); }
    if (a === 'delcat') { const c = b.dataset.c; if (confirm(`Delete category "${c}"? Entries move to Other.`)) { data.categories = data.categories.filter((x) => x !== c); data.entries.forEach((x) => { if (x.category === c) x.category = 'Other'; }); await persist(); render(); } return; }
    if (a === 'review') { data.lastReview = Date.now(); await persist(); toast('Security review recorded.', 'success'); return render(); }
    if (a === 'wipe') { if (confirm('Permanently delete this vault from this browser? This cannot be undone.')) { localStorage.removeItem(KEY); lock('Vault deleted.'); } }
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'p' || t.id === 'mp') paintMeter(t.value);
    if (t.dataset.f) { f[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.dataset.f === 'q' ? t.value.trim().toLowerCase() : t.value; document.getElementById('list').innerHTML = listHtml(); }
    if (t.id === 'len') { document.getElementById('lo').textContent = t.value; regen(); }
    if (t.dataset.g) regen();
  });

  function enter(k, d, m) { key = k; data = d; meta = m; bump(); if (location.hash !== '#dashboard') location.hash = '#dashboard'; else render(); }
  document.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const form = ev.target, btn = form.querySelector('button'), err = document.getElementById('err'), say = (m) => { if (err) err.textContent = m; };
    if (form.id === 'auth') {
      const pw = document.getElementById('mp').value, stored = localStorage.getItem(KEY); say('');
      const wait = +localStorage.getItem('sv.lock') || 0; if (wait > Date.now()) return say(`Too many attempts. Try again in ${Math.ceil((wait - Date.now()) / 1000)}s.`);
      busy(btn, true);
      try {
        if (!stored) {
          if (!Gen.isStrongMaster(pw)) return say('Use 12+ characters with uppercase, lowercase, a number and a symbol.');
          if (pw !== document.getElementById('mp2').value) return say('Passwords do not match.');
          const salt = SV.rand(16), k = await SV.deriveKey(pw, salt), d = { entries: [], categories: [], lastReview: null };
          const m = { v: 1, kdf: 'PBKDF2-SHA256', iter: SV.ITER, salt: SV.b64(salt), created: Date.now() }; m.data = await SV.seal(k, d);
          localStorage.setItem(KEY, JSON.stringify(m)); enter(k, d, m); toast('Vault created.', 'success');
        } else {
          const m = JSON.parse(stored), k = await SV.deriveKey(pw, SV.unb64(m.salt), m.iter);
          let d; try { d = await SV.open(k, m.data); } catch { d = null; }
          if (d) { localStorage.setItem('sv.fails', 0); enter(k, d, m); }
          else { const n = (+localStorage.getItem('sv.fails') || 0) + 1; localStorage.setItem('sv.fails', n); if (n >= 5) localStorage.setItem('sv.lock', Date.now() + 30000 * (n - 4)); say('Incorrect master password.'); }
        }
      } finally { busy(btn, false); }
    }
    if (form.id === 'entry') {
      const g = (i) => document.getElementById(i), url = g('u').value.trim(), id = form.dataset.id;
      if (!g('t').value.trim() || !g('n').value.trim() || !g('p').value) return say('Name, username and password are required.');
      if (url && !/^https?:\/\//i.test(url)) return say('URL must start with http:// or https://');
      const rec = { title: g('t').value.trim(), url, username: g('n').value.trim(), password: g('p').value, category: g('c').value, notes: g('no').value, fav: g('fv').checked };
      if (id) Object.assign(find(id), rec); else data.entries.push({ id: uid(), created: Date.now(), used: null, ...rec });
      await persist(); toast('Saved.', 'success'); location.hash = '#vault';
    }
    if (form.id === 'catform') {
      const n = document.getElementById('cn').value.trim(); if (!n) return;
      if (cats().some((c) => c.toLowerCase() === n.toLowerCase())) return toast('Category already exists.', 'danger');
      data.categories.push(n); await persist(); render();
    }
    if (form.id === 'chpw') {
      const cur = document.getElementById('cp').value, np = document.getElementById('np').value; busy(btn, true);
      try {
        try { await SV.open(await SV.deriveKey(cur, SV.unb64(meta.salt), meta.iter), meta.data); } catch { return say('Current password is incorrect.'); }
        if (!Gen.isStrongMaster(np)) return say('Use 12+ characters with upper, lower, number and symbol.');
        if (np !== document.getElementById('np2').value) return say('Passwords do not match.');
        const salt = SV.rand(16); key = await SV.deriveKey(np, salt); meta.salt = SV.b64(salt); meta.iter = SV.ITER; await persist(); toast('Master password changed; vault re-encrypted.', 'success'); render();
      } finally { busy(btn, false); }
    }
    if (form.id === 'exp') {
      const ph = document.getElementById('ep').value; if (ph.length < 8) return toast('Passphrase must be 8+ characters.', 'danger'); busy(btn, true);
      try { const salt = SV.rand(16), k = await SV.deriveKey(ph, salt), pkg = { app: 'securevault', v: 1, iter: SV.ITER, salt: SV.b64(salt), data: await SV.seal(k, data) };
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(pkg)], { type: 'application/json' })), download: 'securevault-export.json' }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Encrypted export downloaded.', 'success'); } finally { busy(btn, false); }
    }
    if (form.id === 'imp') {
      const file = document.getElementById('if').files[0], ph = document.getElementById('ip').value; if (!file || !ph) return toast('Choose a file and enter its passphrase.', 'danger'); busy(btn, true);
      try {
        const pkg = JSON.parse(await file.text()), inc = await SV.open(await SV.deriveKey(ph, SV.unb64(pkg.salt), pkg.iter), pkg.data); let n = 0;
        (inc.entries || []).slice(0, 5000).forEach((e) => { if (e.title && e.password) { data.entries.push({ id: uid(), created: Date.now(), used: null, title: String(e.title).slice(0, 120), url: /^https?:\/\//i.test(e.url) ? String(e.url).slice(0, 500) : '', username: String(e.username || '').slice(0, 254), password: String(e.password).slice(0, 256), category: cats().includes(e.category) ? e.category : 'Other', notes: String(e.notes || '').slice(0, 2000), fav: !!e.fav }); n++; } });
        await persist(); toast(`Imported ${n} entries.`, 'success'); render();
      } catch { toast('Import failed: wrong passphrase or invalid/tampered file.', 'danger'); } finally { busy(btn, false); }
    }
  });
  render();
})();
