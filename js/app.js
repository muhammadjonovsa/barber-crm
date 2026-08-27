/* =====================================================
   GRAND BARBER CRM — Web App logic (localStorage only)
   All data lives on this device's browser (localStorage).
   No backend required.
   ===================================================== */
(function () {
  'use strict';

  /* ---------- storage helpers ---------- */
  const DB_KEY = 'gb_crm_db';
  const DEFAULT_INTERVAL = 20;

  let db = loadDB();

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return {
      meta: { name: 'Grand Barber', phone: '', createdAt: Date.now() },
      clients: [],
      visits: [],   // { clientId, date: 'YYYY-MM-DD' }
      counter: 1,
    };
  }
  function saveDB() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function today() {
    const d = new Date();
    return fmtISO(d);
  }
  function fmtISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return fmtISO(d);
  }
  function fmtDisplay(dateStr) {
    if (!dateStr) return '-';
    const p = dateStr.split('-');
    return `${p[2]}.${p[1]}.${p[0]}`;
  }
  function fmtDisplayShort(dateStr) {
    if (!dateStr) return '-';
    const p = dateStr.split('-');
    return `${p[2]}.${p[1]}`;
  }
  function normalizePhone(raw) {
    if (!raw || !String(raw).trim()) throw new Error('Telefon raqam kiritilishi shart');
    let c = String(raw).replace(/\D/g, '');
    if (c.length === 12 && c.startsWith('998')) c = c.slice(3);
    else if (c.length === 10 && c.startsWith('8')) c = c.slice(1);
    if (c.length >= 9) c = c.slice(-9);
    if (c.length === 9) return '+998' + c;
    throw new Error('Telefon raqam noto‘g‘ri formatda. Siz kiritdingiz: "' + raw + '" (raqamlar: ' + c + ')');
  }
  function maskPhone(phone) {
    const c = phone.replace(/[^\d]/g, '').replace(/^998/, '');
    if (c.length >= 9) {
      const code = c.slice(0, 2), tail = c.slice(-3);
      return `+998 ${code} *** ** ${tail}`;
    }
    return phone;
  }
  function titleCase(s) { return (s || '').toUpperCase(); }

  /* ---------- data ops ---------- */
  function nextId() { return db.counter++; }
  function getClient(id) { return db.clients.find(c => c.id === id); }
  function clientLastVisitDate(c) {
    const vs = db.visits.filter(v => v.clientId === c.id).map(v => v.date);
    if (!vs.length) return null;
    vs.sort();
    return vs[vs.length - 1];
  }
  function nextReminder(c) {
    const last = clientLastVisitDate(c);
    if (!last) return null;
    return addDays(last, c.interval || DEFAULT_INTERVAL);
  }
  function visitsFor(c) {
    return db.visits.filter(v => v.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  }
  function ensureClient(c) {
    c.interval = c.interval || DEFAULT_INTERVAL;
    return c;
  }

  /* ---------- state ---------- */
  let currentTab = 'home';
  let editingClientId = null;
  let clientSearch = '';
  let seg = 'arrived';

  /* ---------- element refs ---------- */
  const $ = (id) => document.getElementById(id);

  function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(`view-${viewName}`).classList.add('active');
  }

  function panel(name) { return $(`panel-${name}`); }
  function showPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    panel(name).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    currentTab = name;
  }

  /* ---------- rendering ---------- */
  function renderAll() {
    renderHome();
    renderClients();
    renderVisits();
    renderStats();
    renderSettings();
  }

  function renderHome() {
    const all = db.clients.map(ensureClient);
    const arrived = visitsForTodayIds().size;
    const due = all.filter(c => nextReminder(c) === today()).length;
    $('hero-name').textContent = db.meta.name || 'Sartarosh';

    const stats = [
      { b: all.length, l: 'Jami mijoz' },
      { b: arrived, l: 'Bugun kelgan' },
      { b: due, l: 'Kelishi kerak' },
    ];
    $('home-stats').innerHTML = stats.map(s =>
      `<div class="hstat"><b>${s.b}</b><span>${s.l}</span></div>`).join('');
  }

  function visitsForTodayIds() {
    const ids = new Set();
    db.visits.forEach(v => { if (v.date === today()) ids.add(v.clientId); });
    return ids;
  }

  function renderClients() {
    const list = $('client-list');
    let clients = db.clients.map(ensureClient);
    if (clientSearch) {
      const q = clientSearch.toLowerCase();
      clients = clients.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')));
    }
    clients.sort((a, b) => a.name.localeCompare(b.name));
    if (!clients.length) {
      list.innerHTML = `<div class="empty"><span class="emoji">🗂️</span>Mijozlar yo‘q.<br>Birinchisini qo‘shing!</div>`;
      return;
    }
    const arrived = visitsForTodayIds();
    list.innerHTML = clients.map(c => {
      const last = clientLastVisitDate(c);
      const arrivedToday = arrived.has(c.id);
      return `
        <div class="client-card" data-open-client="${c.id}">
          <div class="cc-top">
            <span class="cc-name">${escapeHtml(c.name)}</span>
            ${arrivedToday ? '<span class="badge green">✅ Bugun keldi</span>' : ''}
          </div>
          <div class="cc-phone">${maskPhone(c.phone)}</div>
          <div class="cc-arrived">📅 Oxirgi: ${fmtDisplay(last)} · 🔔 Bon o‘xshash: ${fmtDisplay(nextReminder(c))}</div>
        </div>`;
    }).join('');
  }

  function renderVisits() {
    const all = db.clients.map(ensureClient);
    const arrivedIds = visitsForTodayIds();
    const arrived = all.filter(c => arrivedIds.has(c.id));
    const due = all.filter(c => nextReminder(c) === today());

    $('arrived-list').innerHTML = arrived.length ? arrived.map(c => cardSmall(c, arrivedIds, false)).join('') :
      `<div class="empty"><span class="emoji">📥</span>Bugun hali kelgan yo‘q.</div>`;

    $('due-list').innerHTML = due.length
      ? due.map(c => `
          <div class="client-card" data-open-client="${c.id}">
            <div class="cc-top"><span class="cc-name">${escapeHtml(c.name)}</span><span class="badge gold">🔔 Eslatma</span></div>
            <div class="cc-phone">${maskPhone(c.phone)}</div>
            <div class="cc-arrived">📅 Oxirgi: ${fmtDisplay(clientLastVisitDate(c))} · Butun eslatma: ${fmtDisplay(nextReminder(c))}</div>
            <br><button class="btn btn-primary sm" data-sms="${c.id}">📨 SMS yuborish (mock)</button>
          </div>`).join('')
      : `<div class="empty"><span class="emoji">🎉</span>Bugun kelishi kerak bo‘lgan yo‘q.</div>`;
  }

  function cardSmall(c, arrivedIds, interactive) {
    return `
      <div class="client-card" data-open-client="${c.id}">
        <div class="cc-top"><span class="cc-name">${escapeHtml(c.name)}</span>
          <button class="badge green" data-toggle="${c.id}">${arrivedIds.has(c.id) ? '✅ Keldi' : '☐ Keldi'}</button>
        </div>
        <div class="cc-phone">${maskPhone(c.phone)}</div>
      </div>`;
  }

  function renderStats() {
    const all = db.clients.map(ensureClient);
    const allVisits = db.visits;
    const todayCount = visitsOnOrBefore(today()).length;
    const weekCount = db.clients.reduce((s, c) => s + visitsInRange(c.id, weekStart(), today()).length, 0);
    const monthCount = db.clients.reduce((s, c) => s + visitsInRange(c.id, monthStart(), today()).length, 0);
    const due = all.filter(c => nextReminder(c) === today()).length;

    $('stats-today').innerHTML = [
      { b: all.length, l: '👥 Jami mijozlar' },
      { b: todayCount, l: '✅ Bugun kelganlar' },
      { b: due, l: '🔔 Kelishi keraklar' },
      { b: allVisits.filter(v => v.date === today()).length, l: '✂️ Bugun tashriflar' },
    ].map(s => `<div class="stat-card"><b>${s.b}</b><span>${s.l}</span></div>`).join('');

    $('stats-periods').innerHTML = `
      <div class="srow"><span>📅 Bu hafta tashriflar</span><b>${weekCount}</b></div>
      <div class="srow"><span>📅 Bu oy tashriflar</span><b>${monthCount}</b></div>`;
  }

  function visitsOnOrBefore(dateStr) {
    return db.visits.filter(v => v.date <= dateStr);
  }
  function weekStart() {
    const d = new Date();
    const day = d.getDay() || 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day - 1));
    return fmtISO(mon);
  }
  function monthStart() {
    const d = new Date();
    return fmtISO(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function visitsInRange(clientId, start, end) {
    return db.visits.filter(v => v.clientId === clientId && v.date >= start && v.date <= end);
  }

  function renderSettings() {
    const items = [
      { label: '✏️ Sartarosh nomi', value: db.meta.name, action: 'rename' },
      { label: '📱 Telefon raqam', value: db.meta.phone || '—', action: 'phone' },
      { label: '🗑 Barcha ma’lumotlarni o‘chirish', value: '', action: 'wipe', danger: true },
    ];
    $('settings-list').innerHTML = items.map(it => `
      <div class="set-item" data-action="${it.action}" ${it.danger ? 'data-danger="1"' : ''}>
        <div><b>${it.label}</b><small>${it.value}</small></div><span style="color:var(--muted)">›</span>
      </div>`).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ---------- client detail ---------- */
  function openClient(id) {
    const c = ensureClient(getClient(id));
    if (!c) return;
    showView('client');
    $('client-detail-name').textContent = c.name;
    const visits = visitsFor(c);
    const history = visits.length ? visits.map(v =>
      `<div class="vh-item"><span class="date">${fmtDisplay(v.date)}</span><span style="color:var(--green)">✅</span></div>`).join('')
      : `<div class="empty"><span class="emoji">📭</span>Hali tashrif yo‘q.</div>`;

    $('client-detail-body').innerHTML = `
      <div style="text-align:center">
        <div style="font-family:var(--font-serif);font-size:34px;font-weight:900">${escapeHtml(c.name)}</div>
        <div class="detail-phone">📞 ${maskPhone(c.phone)}</div>
      </div>
      <div class="sub">Tashriflar tarixi</div>
      ${history}
      <div class="vh-count">Jami tashriflar: <b>${visits.length}</b></div>
      <div class="detail-actions">
        <button class="btn btn-primary" data-mark="${c.id}">✅ Bugun keldi (tashrif qo‘shish)</button>
        <button class="btn btn-ghost" data-edit="${c.id}">✏️ Tahrirlash</button>
        <button class="btn btn-ghost" data-remind="${c.id}">🔔 Eslatma kuni: ${fmtDisplay(nextReminder(c))}</button>
        <button class="btn btn-danger" data-del="${c.id}">🗑 O‘chirish</button>
      </div>`;
  }

  /* ---------- add / edit form ---------- */
  function openForm(id) {
    editingClientId = id;
    const c = id ? ensureClient(getClient(id)) : null;
    $('form-title').textContent = c ? 'Tahrirlash' : 'Mijoz qo‘shish';
    $('f-id').value = c ? c.id : '';
    $('f-name').value = c ? c.name : '';
    $('f-phone').value = c ? c.phone : '';
    renderIntervalChips(c ? c.interval : DEFAULT_INTERVAL);
    showView('form');
  }

  function renderIntervalChips(active) {
    const opts = [15, 20, 25, 30];
    $('f-interval-chips').innerHTML = opts.map(o =>
      `<button type="button" class="chip ${o === active ? 'active' : ''}" data-interval="${o}">${o} kun</button>`).join('');
  }

  /* ---------- event wiring ---------- */
  function wire() {
    // login
    $('login-btn').addEventListener('click', () => {
      const phone = $('login-phone-input').value.trim();
      try { normalizePhone(phone); } catch (e) { alert(e.message); return; }
      db.meta.phone = phone;
      db.meta.name = db.meta.name || 'Grand Barber';
      saveDB();
      showView('app');
      renderAll();
    });
    $('login-phone-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-btn').click(); });

    // tabs
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      showPanel(t.dataset.view);
      renderAll();
    }));

    // topbar toggle -> home
    $('toggle-sidebar').addEventListener('click', () => showPanel('home'));

    // quick actions
    document.querySelectorAll('.quick').forEach(q => q.addEventListener('click', () => {
      const action = q.dataset.quick;
      if (action === 'add') openForm(null);
      else if (action === 'arrivals') { showPanel('visits'); }
      else if (action === 'due') { showPanel('visits'); seg = 'due'; updateSeg(); renderVisits(); }
      else if (action === 'now') { showPanel('visits'); seg = 'arrived'; updateSeg(); renderVisits(); }
    }));

    // clients panel
    $('add-client-btn').addEventListener('click', () => openForm(null));
    $('client-search').addEventListener('input', e => { clientSearch = e.target.value; renderClients(); });

    // visits seg
    $('seg-arrived').addEventListener('click', () => { seg = 'arrived'; updateSeg(); renderVisits(); });
    $('seg-due').addEventListener('click', () => { seg = 'due'; updateSeg(); renderVisits(); });

    // client list delegation (open / toggle / sms)
    $('client-list').addEventListener('click', e => {
      const open = e.target.closest('[data-open-client]');
      if (open) { openClient(Number(open.dataset.openClient)); return; }
    });
    $('arrived-list').addEventListener('click', e => {
      const open = e.target.closest('[data-open-client]');
      if (open) { openClient(Number(open.dataset.openClient)); return; }
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) { toggleArrival(Number(toggle.dataset.toggle)); }
    });
    $('due-list').addEventListener('click', e => {
      const sms = e.target.closest('[data-sms]');
      if (sms) { sendSmsMock(Number(sms.dataset.sms)); return; }
      const open = e.target.closest('[data-open-client]');
      if (open) { openClient(Number(open.dataset.openClient)); }
    });

    // client detail actions
    $('client-detail-body').addEventListener('click', e => {
      const mark = e.target.closest('[data-mark]'); if (mark) { markArrival(Number(mark.dataset.mark)); return; }
      const edit = e.target.closest('[data-edit]'); if (edit) { openForm(Number(edit.dataset.edit)); return; }
      const del = e.target.closest('[data-del]'); if (del) { deleteClient(Number(del.dataset.del)); return; }
    });

    $('client-back').addEventListener('click', () => { showView('app'); renderAll(); });
    $('form-back').addEventListener('click', () => {
      showView('app');
      showPanel('clients');
      renderAll();
    });

    // form
    $('client-form').addEventListener('submit', e => {
      e.preventDefault();
      saveClientForm();
    });
    $('f-interval-chips').addEventListener('click', e => {
      const chip = e.target.closest('[data-interval]');
      if (!chip) return;
      document.querySelectorAll('#f-interval-chips .chip').forEach(cp => cp.classList.remove('active'));
      chip.classList.add('active');
    });

    // settings delegation
    $('settings-list').addEventListener('click', e => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      handleSettings(item.dataset.action, !!item.dataset.danger);
    });
  }

  /* ---------- actions ---------- */
  function toggleArrival(id) {
    const c = getClient(id); if (!c) return;
    if (!db.visits.some(v => v.clientId === id && v.date === today())) {
      db.visits.push({ clientId: id, date: today() });
      saveDB();
    }
    renderVisits(); renderHome(); renderStats();
  }

  function markArrival(id) {
    const c = getClient(id); if (!c) return;
    if (db.visits.some(v => v.clientId === id && v.date === today())) {
      alert('Bu mijoz bugun allaqachon belgilangan.');
      return;
    }
    db.visits.push({ clientId: id, date: today() });
    saveDB();
    alert(`✅ ${c.name} — Keldi!\n🔔 Keyingi eslatma: ${fmtDisplay(nextReminder(c))}`);
    openClient(id);
    renderAll();
  }

  function sendSmsMock(id) {
    const c = getClient(id); if (!c) return;
    alert(`📨 [MOCK SMS] ${c.name} ga yuborildi:\n\n"Assalomu Alaykum! Bugun kelasizmi 😊"\n\n(Haqiqiy SMS uchun backend + SMS Gateway kerak)`);
  }

  function deleteClient(id) {
    const c = getClient(id); if (!c) return;
    if (!confirm(`🗑 "${c.name}" o‘chirilsinmi?`)) return;
    db.clients = db.clients.filter(x => x.id !== id);
    db.visits = db.visits.filter(v => v.clientId !== id);
    saveDB();
    showView('app');
    renderAll();
  }

  function saveClientForm() {
    const name = titleCase($('f-name').value.trim());
    const phoneRaw = $('f-phone').value.trim();
    if (!name) { alert('Ism kiritilishi shart'); return; }
    let phone;
    try { phone = normalizePhone(phoneRaw); } catch (e) { alert(e.message); return; }
    const chip = document.querySelector('#f-interval-chips .chip.active');
    const interval = chip ? Number(chip.dataset.interval) : DEFAULT_INTERVAL;

    const id = Number($('f-id').value);
    if (id) {
      const c = getClient(id);
      if (c) { c.name = name; c.phone = phone; c.interval = interval; }
    } else {
      // duplicate phone check
      if (db.clients.some(c => c.phone === phone)) {
        alert('⚠️ Bu telefon raqam bazada mavjud!');
        return;
      }
      db.clients.push({ id: nextId(), name, phone, interval, createdAt: Date.now() });
    }
    saveDB();
    showView('app');
    showPanel('clients');
    renderAll();
  }

  function updateSeg() {
    $('seg-arrived').classList.toggle('active', seg === 'arrived');
    $('seg-due').classList.toggle('active', seg === 'due');
    $('arrived-panel').classList.toggle('hidden', seg !== 'arrived');
    $('due-panel').classList.toggle('hidden', seg !== 'due');
  }

  function handleSettings(action, danger) {
    if (action === 'rename') {
      const v = prompt('Sartarosh nomi:', db.meta.name || '');
      if (v !== null && v.trim()) { db.meta.name = v.trim(); saveDB(); renderSettings(); renderHome(); }
    } else if (action === 'phone') {
      const v = prompt('Telefon raqam:', db.meta.phone || '');
      if (!v) return;
      try { db.meta.phone = normalizePhone(v); saveDB(); renderSettings(); }
      catch (e) { alert(e.message); }
    } else if (action === 'wipe') {
      if (danger && confirm('⚠️ Barcha ma’lumotlar o‘chiriladi. Davom etasizmi?')) {
        db = loadDB(); db.clients = []; db.visits = []; db.meta.name = 'Grand Barber'; saveDB();
        renderAll();
      }
    }
  }

  /* ---------- bootstrap ---------- */
  function init() {
    db.clients.forEach(ensureClient);
    // If already logged in, skip login
    if (db.meta.phone) {
      showView('app');
    } else {
      showView('login');
    }
    renderAll();
    updateSeg();
    wire();
  }

  init();
})();
