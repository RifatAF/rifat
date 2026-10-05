// Кабинет специалиста: клиенты, оценки по протоколам, три слоя результата, резервная копия.
// Все данные в IndexedDB на телефоне специалиста; на сервер ничего не уходит.
import { analyze, fmt } from './analysis.js';
import { meSync, logout, getMe } from './auth.js';
import { gate, planLine, SPECIALTIES, TEMPLATE_ORDER, START_CLIENTS } from './plans.js';
import { C, voice, cam, startMotion, initPose, drawHeat, RAMP_CSS, device, seal, body3D } from './core.js';
import { cleanResult, verdictCard, LIMIT_NAMES, stepList, bindStepList, go, spots, title, tech, TONE, TONE_HEX, plan, ex, totalMin, workout, onboarding, UNITS, sortUnits, rowsOf, secs, mins, SETUP_SEC, runProtocol } from './app.js';

const $ = s => document.querySelector(s);
// имя специалиста для отчетов по умолчанию: из аккаунта (в бете кабинетом пользуются разные специалисты)
const defaultAuthor = () => { const u = meSync(); return u && u.name ? u.name : 'Специалист'; };
const esc = s => String(s ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
const DAY = 864e5;
const fmtDate = t => new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });

// ---------- IndexedDB ----------
// у каждого аккаунта своя база клиентов: имя базы содержит id пользователя
let dbp = null, dbName = '';
const LEGACY = 'bodypassport-pro';
const nameFor = () => { const u = meSync(); return u && u.id ? LEGACY + '-' + u.id : LEGACY; };
function openDb(name) { return new Promise((res, rej) => { const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('clients', { keyPath: 'id' }); const a = d.createObjectStore('assessments', { keyPath: 'id' }); a.createIndex('clientId', 'clientId'); d.createObjectStore('poses', { keyPath: 'assessmentId' }); d.createObjectStore('meta', { keyPath: 'k' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function db() {
  const name = nameFor(); if (dbp && dbName === name) return dbp;
  if (dbp) dbp.then(d => d.close()).catch(() => {});
  dbName = name; return (dbp = openDb(name));
}
// база, созданная до появления аккаунтов: предлагаем перенести ее первому вошедшему специалисту
async function legacyCount() {
  if (nameFor() === LEGACY || localStorage.getItem('bp_legacy_pro')) return 0;
  if (indexedDB.databases) { const l = await indexedDB.databases().catch(() => null); if (l && !l.some(x => x.name === LEGACY)) return 0; }
  const d = await openDb(LEGACY); const n = await new Promise(r => { const q = d.transaction('clients').objectStore('clients').count(); q.onsuccess = () => r(q.result); q.onerror = () => r(0); });
  d.close(); return n;
}
async function claimLegacy(take) {
  localStorage.setItem('bp_legacy_pro', meSync().id);
  if (!take) return;
  const src = await openDb(LEGACY), dst = await db();
  for (const st of ['clients', 'assessments', 'poses', 'meta']) {
    const rows = await new Promise(r => { const q = src.transaction(st).objectStore(st).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
    await new Promise((ok, no) => { const t = dst.transaction(st, 'readwrite'); const o = t.objectStore(st); rows.forEach(x => o.put(x)); t.oncomplete = ok; t.onerror = () => no(t.error); });
  }
  src.close(); indexedDB.deleteDatabase(LEGACY);
}
const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const st = t.objectStore(store); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
const all = store => tx(store, 'readonly', st => st.getAll());
const get = (store, k) => tx(store, 'readonly', st => st.get(k));
const put = (store, v) => tx(store, 'readwrite', st => st.put(v));
const del = (store, k) => tx(store, 'readwrite', st => st.delete(k));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const byClient = async id => (await all('assessments')).filter(a => a.clientId === id).sort((x, y) => x.date - y.date);
const meta = async k => (await get('meta', k))?.v; const setMeta = (k, v) => put('meta', { k, v });

// ---------- шаблоны протоколов ----------
export const TEMPLATES = [
  ['knee', 'Колено', ['stand', 'ohs_front', 'sls', 'calf', 'back']],
  ['low_back', 'Поясница', ['stand', 'ohs_front', 'sls', 'bends', 'side']],
  ['neck', 'Шея и плечи', ['stand', 'thold', 'bends', 'side']],
  ['run', 'Бег', ['stand', 'ohs_front', 'sls', 'calf', 'side']],
  ['full', 'Полный', ['stand', 'ohs_front', 'sls', 'thold', 'bends', 'calf', 'side', 'back']],
  ['screen', 'Первичный скрининг', ['stand', 'ohs_front', 'sls', 'side']],
  ['posture', 'Осанка до и после сеанса, 1 мин', ['stand', 'bends']],
];
// шаблоны в порядке, удобном для специализации: первый открывается по умолчанию
function orderTemplates(sp) { const o = TEMPLATE_ORDER[sp]; if (o) TEMPLATES.sort((a, b) => o.indexOf(a[0]) - o.indexOf(b[0])); }
// профиль специалиста: имя для шапки и отчетов, контакт для записи в отчете клиенту
async function profileForm() {
  const name = (await meta('profile')) || defaultAuthor(), contact = (await meta('contact')) || '';
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><b style="font-size:18px">Мой профиль</b></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:14px;margin-top:8px">
    <label><b>Имя и специальность</b><input id="pn" value="${esc(name)}" placeholder="Анна Смирнова, персональный тренер" style="margin-top:8px;width:100%;height:50px;border-radius:14px;border:1.5px solid var(--line);padding:0 14px;font:16px Onest;background:#fff"></label>
    <label><b>Контакт для записи</b><input id="pc" value="${esc(contact)}" placeholder="@telegram, телефон или сайт" style="margin-top:8px;width:100%;height:50px;border-radius:14px;border:1.5px solid var(--line);padding:0 14px;font:16px Onest;background:#fff"></label>
    <p class="sub" style="font-size:13px">Имя и контакт появятся в шапке кабинета и в отчете, который клиент сохранит и покажет друзьям.</p>
   </div><div class="pad" style="padding:20px"><button class="btn" id="ps">Сохранить</button></div></div>`);
  $('#back').onclick = () => proHome();
  $('#ps').onclick = async () => { await setMeta('profile', $('#pn').value.trim().slice(0, 80) || defaultAuthor()); await setMeta('contact', $('#pc').value.trim().slice(0, 60)); proHome(); };
}
// пример клиента: специалист видит результат до первой своей съемки
async function openDemo() {
  const now = Date.now(), d0 = now - 34 * DAY, d1 = now - 2 * DAY;
  const base = { protocol: ['stand', 'ohs_front', 'sls', 'side'], full: true, quality: {}, limits: {}, setup: {}, template: 'knee', templateName: 'Колено', pain: { knee: 4 }, plan: null, note: '', draft: false };
  const m0 = { snapshot: { shoulderTilt: 5.2, pelvicTilt: -4.6, headTilt: 1, trunkLateral: 1.5 }, side: { headForwardDeg: 21, kneeHyperDeg: 2, shoulderShift: .01, hipShift: 0 },
    moves: { ohs_front: { quality: 'GOOD', f: { ohs_valgus_r: 14, ohs_valgus_l: 5 } }, sls_r: { quality: 'GOOD', f: { sls_drop_r: 6, sls_valgus_r: 13, sls_trunk_r: 3 } }, sls_l: { quality: 'GOOD', f: { sls_drop_l: 1, sls_valgus_l: 4, sls_trunk_l: 1 } } } };
  const m1 = { snapshot: { shoulderTilt: 3.1, pelvicTilt: -2.2, headTilt: .8, trunkLateral: 1 }, side: { headForwardDeg: 18, kneeHyperDeg: 2, shoulderShift: .01, hipShift: 0 },
    moves: { ohs_front: { quality: 'GOOD', f: { ohs_valgus_r: 7, ohs_valgus_l: 5 } }, sls_r: { quality: 'GOOD', f: { sls_drop_r: 3, sls_valgus_r: 8, sls_trunk_r: 2 } }, sls_l: { quality: 'GOOD', f: { sls_drop_l: 1, sls_valgus_l: 4, sls_trunk_l: 1 } } } };
  await put('clients', { id: 'demo', demo: true, created: d0, name: 'Пример: Олег, боль в колене', first: 'Олег', last: '', dob: '1985-03-12', sex: 'M', height: '180', leg: 'R', hand: 'R', activity: 'офис, бег 2 раза в неделю', complaints: 'Ноет правое колено после бега', notes: 'Демо-клиент: удалите, когда будет не нужен' });
  await put('assessments', { id: 'demo-1', clientId: 'demo', date: d0, ...base, ...m0, hyp: {}, check: {}, expect: 'Справа слабая средняя ягодичная, колено уходит внутрь', expectMatch: 'yes', nextDate: d0 + 30 * DAY, prevId: null });
  await put('assessments', { id: 'demo-2', clientId: 'demo', date: d1, ...base, ...m1, pain: { knee: 1 }, hyp: {}, check: {}, nextDate: d1 + 30 * DAY, prevId: 'demo-1' });
  await put('poses', { assessmentId: 'demo-1', poses: [] }); await put('poses', { assessmentId: 'demo-2', poses: [] });
  clientCard('demo');
}
async function specialtyScreen(after) {
  go(`<div class="scr fade"><div class="pad" style="padding-top:20px"><div class="caps" style="color:var(--coral)">Кабинет специалиста</div><h1 style="margin-top:8px">Кто вы?</h1>
    <p class="sub" style="margin-top:6px">Под специализацию подстроим протоколы теста. Поменять можно в меню кабинета.</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-bottom:30px">${SPECIALTIES.map(([k, t, d]) => `<button class="list-item" data-sp="${k}" style="background:#fff;text-align:left;font:inherit;color:inherit"><div style="flex:1"><b style="font-size:15px">${t}</b><div class="sub" style="font-size:13px;margin-top:2px">${d}</div></div><span class="chev">›</span></button>`).join('')}</div></div>`);
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = async () => { const sp = b.dataset.sp; await setMeta('specialty', sp); localStorage.setItem('bp_sp', sp); orderTemplates(sp);
    fetch('/api/auth?a=profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specialty: sp }) }).catch(() => {});
    (after || proHome)(); });
}
const QNAMES = { stand: 'Стойка', ohs_front: 'Присед лицом', sls_r: 'Правая нога', sls_l: 'Левая нога', thold: 'Руки в стороны', t_hold: 'Руки в стороны', bends: 'Наклоны', calf_r: 'Носок, правая', calf_l: 'Носок, левая', side_stand: 'Стойка боком', ohs_side: 'Присед боком', ohs_back: 'Присед спиной' };
const UNIT_NAMES = { stand: 'Стойка', ohs_front: 'Присед лицом', sls: 'На одной ноге', thold: 'Руки в стороны', bends: 'Наклоны', calf: 'На носок', side: 'Боком', back: 'Спиной' };
const PAIN = [['neck', 'Шея'], ['shoulder', 'Плечо'], ['upper_back', 'Грудной отдел'], ['low_back', 'Поясница'], ['hip', 'Таз, бедро'], ['knee', 'Колено'], ['foot', 'Стопа']];
let HYP3D = false; // специалист смотрит гипотезу в 3D: режим сохраняется при правках
const STATES = [['OK', 'Норма', 0], ['HYPER', 'Перегрузка', .8], ['SHORT', 'Зажата', .7], ['WEAK', 'Слабость', -.8]];

// ---------- голосовая заметка (распознавание речи браузера) ----------
function dictate(textarea, btn) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { btn.textContent = 'Голосовой ввод не поддерживается'; return; }
  const r = new R(); r.lang = 'ru-RU'; r.interimResults = false; r.continuous = false;
  btn.textContent = '● Говори…'; r.onresult = e => { textarea.value = (textarea.value ? textarea.value + ' ' : '') + e.results[0][0].transcript; };
  r.onend = () => btn.textContent = '🎙 Надиктовать'; r.onerror = () => btn.textContent = '🎙 Надиктовать'; r.start();
}

// ---------- рабочий стол ----------
export async function proHome(query = '', pulled = null) {
  localStorage.setItem('bp_mode', 'pro');
  const lc = await legacyCount().catch(() => 0);
  if (lc) { go(`<div class="scr pad fade" style="justify-content:center;gap:14px"><div class="caps" style="color:var(--coral)">Кабинет ${esc(meSync().name)}</div>
      <h1>На этом телефоне есть база без аккаунта</h1><p class="sub">${lc} ${lc % 10 === 1 && lc % 100 !== 11 ? 'клиент' : [2, 3, 4].includes(lc % 10) && ![12, 13, 14].includes(lc % 100) ? 'клиента' : 'клиентов'}, созданных до входа. Перенести их в ваш кабинет? Другие аккаунты их больше не увидят.</p>
      <button class="btn" id="lgy">Перенести ко мне</button><button class="btn ghost" id="lgn">Это не мои, начать с чистого</button></div>`);
    $('#lgy').onclick = async () => { $('#lgy').textContent = 'Переношу…'; await claimLegacy(true); proHome(); };
    $('#lgn').onclick = async () => { await claimLegacy(false); proHome(); }; return; }
  const sp = await meta('specialty'); if (!sp) return specialtyScreen(); localStorage.setItem('bp_sp', sp); orderTemplates(sp); getMe();
  // новые результаты пришли, пока специалист уже ушел в карточку: не выдергиваем его на главный экран
  if (pulled === null) pullResults().then(n => { if (n.length && document.getElementById('join') && document.getElementById('menu')) proHome(query, n); });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  const [clients, asses] = await Promise.all([all('clients'), all('assessments')]);
  const last = id => asses.filter(a => a.clientId === id).sort((x, y) => y.date - x.date)[0];
  const soon = clients.map(c => ({ c, a: last(c.id) })).filter(x => x.a && x.a.nextDate && x.a.nextDate - Date.now() <= 3 * DAY).sort((x, y) => x.a.nextDate - y.a.nextDate);
  const q = query.trim().toLowerCase(); const list = clients.filter(c => !q || c.name.toLowerCase().includes(q)).sort((x, y) => (last(y.id)?.date || y.created) - (last(x.id)?.date || x.created));
  const lastBackup = await meta('lastBackup'); const needBackup = clients.length && (!lastBackup || Date.now() - lastBackup > 7 * DAY);
  go(`<div class="fade" style="padding:16px 0 40px">
    <div class="pad row"><div style="flex:1"><div class="caps" style="color:var(--coral)">Кабинет специалиста</div><h1>Клиенты</h1><div style="font-size:12px;color:var(--muted);margin-top:2px">${esc((await meta('profile')) || defaultAuthor())}</div></div><button class="round" id="menu">⚙︎</button></div>
    ${pulled && pulled.length ? `<div class="pad" style="margin-top:12px"><div class="card" style="background:var(--okS)"><b>Новые результаты из дома:</b> ${pulled.map(esc).join(', ')}</div></div>` : ''}
    <div class="pad" style="margin-top:14px;display:flex;flex-direction:column;gap:8px"><button class="btn" id="new"><span class="ic">+</span> Новая оценка</button><button class="btn ghost" id="join" style="background:#fff">Ссылка для нового клиента</button></div>
    ${needBackup ? `<div class="pad" style="margin-top:12px"><div class="card row" style="background:var(--shortS)"><div style="flex:1;font-size:14px"><b>Сохрани резервную копию.</b> Данные клиентов хранятся только на этом телефоне.</div><button class="pill" id="bk">Сохранить</button></div></div>` : ''}
    ${soon.length ? `<h3 class="pad" style="margin:22px 0 8px;font-size:17px">Повторный тест в ближайшие 3 дня</h3><div class="pad" style="display:flex;flex-direction:column;gap:8px">${soon.map(({ c, a }) => {
      const d = Math.ceil((a.nextDate - Date.now()) / DAY); return `<div class="list-item" data-id="${c.id}" style="background:#fff"><i class="bar" style="background:${d < 0 ? '#E5484D' : '#EE7B30'}"></i><div style="flex:1"><b>${esc(c.name)}</b><div style="font-size:13px;color:var(--muted)">${d < 0 ? 'просрочен на ' + (-d) + ' дн.' : d === 0 ? 'сегодня' : 'через ' + d + ' дн.'}</div></div><span class="chev">›</span></div>`; }).join('')}</div>` : ''}
    <div class="pad" style="margin-top:22px"><input id="q" value="${esc(query)}" placeholder="Поиск по имени" style="width:100%;height:48px;border-radius:14px;border:1.5px solid var(--line);padding:0 14px;font:16px Onest;background:#fff"></div>
    <div class="pad" style="margin-top:10px;display:flex;flex-direction:column;gap:8px">${list.length ? list.map(c => { const a = last(c.id);
      return `<div class="list-item" data-id="${c.id}" style="background:#fff"><div style="width:40px;height:40px;border-radius:50%;background:var(--seg);display:flex;align-items:center;justify-content:center;font-weight:700;flex:none">${esc(c.name.slice(0, 1).toUpperCase())}</div><div style="flex:1"><b>${esc(c.name)}</b><div style="font-size:13px;color:var(--muted)">${a ? 'Оценка ' + fmtDate(a.date) : 'Оценок пока нет'}</div></div><span class="chev">›</span></div>`; }).join('')
      : `<div class="card" style="margin-top:6px;text-align:center;padding:22px 18px"><b style="font-size:17px">Посмотрите, что получите</b><p class="sub" style="font-size:14px;margin-top:6px">Готовая оценка клиента с болью в колене: замеры, гипотеза, назначение и отчет. Удалите, когда будет не нужна.</p><button class="btn lime" id="demo" style="margin-top:14px">Открыть пример</button></div>`}</div></div>`);
  if ($('#demo')) $('#demo').onclick = openDemo;
  $('#new').onclick = () => clientForm(null, true); $('#join').onclick = sendJoin; $('#menu').onclick = proMenu; if ($('#bk')) $('#bk').onclick = backup;
  $('#q').oninput = e => { clearTimeout(window._qt); window._qt = setTimeout(() => proHome(e.target.value).then(() => { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 250); };
  document.querySelectorAll('.list-item').forEach(el => el.onclick = () => clientCard(el.dataset.id));
}

function proMenu() {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">Кабинет</h2>
    <a class="card row" href="/pricing" target="_blank" style="margin-top:12px;text-decoration:none;color:inherit;font-size:14px"><span style="flex:1">${planLine()}</span><span class="chev">›</span></a>
    <button class="btn ghost" id="msp" style="margin-top:10px">Специализация: ${(SPECIALTIES.find(x => x[0] === localStorage.getItem('bp_sp')) || ['', 'не выбрана'])[1]}</button>
    <button class="btn ghost" id="mb" style="margin-top:14px">Сохранить резервную копию</button>
    <label class="btn ghost" style="margin-top:10px">Восстановить из копии<input type="file" id="mr" accept=".json,.bpbackup,application/json" style="display:none"></label>
    <button class="btn ghost" id="mp" style="margin-top:10px">Мой профиль: имя и контакт</button>
    <button class="btn ghost" id="mc" style="margin-top:10px">Перейти в режим клиента</button>
    <a class="btn ghost" href="/privacy" target="_blank" style="margin-top:10px;text-decoration:none">Конфиденциальность</a>
    ${meSync() ? `<button class="btn ghost" id="mo" style="margin-top:10px">Выйти: ${esc(meSync().name)}</button>` : ''}
    <button class="btn" id="mx" style="margin-top:10px">Закрыть</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('#mb').onclick = () => { d.remove(); backup(); };
  d.querySelector('#msp').onclick = () => { d.remove(); specialtyScreen(); };
  d.querySelector('#mr').onchange = e => { const f = e.target.files[0]; d.remove(); if (f) restore(f); };
  d.querySelector('#mp').onclick = async () => { d.remove(); profileForm(); };
  d.querySelector('#mc').onclick = () => { localStorage.setItem('bp_mode', 'client'); d.remove(); onboarding(); };
  if (d.querySelector('#mo')) d.querySelector('#mo').onclick = async () => { await logout(); localStorage.removeItem('bp_mode'); d.remove(); onboarding(); };
  d.querySelector('#mx').onclick = () => d.remove();
}

// ---------- карточка клиента: создание и правка ----------
async function clientForm(id, thenAssess) {
  if (!id && (await all('clients')).filter(x => !x.demo).length >= START_CLIENTS && !gate('clients')) return;
  const c = id ? await get('clients', id) : { id: uid(), created: Date.now(), name: '', dob: '', sex: '', height: '', leg: 'R', hand: 'R', activity: '', complaints: '', notes: '' };
  const sel = (n, opts, v) => `<select id="${n}" style="height:48px;border-radius:14px;border:1.5px solid var(--line);padding:0 10px;font:16px Onest;background:#fff;width:100%">${opts.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const inp = (n, ph, v, type = 'text') => `<input id="${n}" type="${type}" value="${esc(v)}" placeholder="${ph}" style="width:100%;height:48px;border-radius:14px;border:1.5px solid var(--line);padding:0 14px;font:16px Onest;background:#fff">`;
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><b style="font-size:18px">${id ? 'Изменить клиента' : 'Новый клиент'}</b></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:12px;padding-bottom:24px">
    <div class="row" style="gap:10px"><div style="flex:1">${inp('first', 'Имя *', c.first ?? (c.name || '').split(' ')[0])}</div><div style="flex:1">${inp('last', 'Фамилия', c.last ?? (c.name || '').split(' ').slice(1).join(' '))}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Дата рождения</div>${inp('dob', '', c.dob, 'date')}</div><div style="width:110px"><div class="sub" style="font-size:12px;margin-bottom:4px">Пол</div>${sel('sex', [['', '—'], ['M', 'Муж'], ['F', 'Жен']], c.sex)}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Рост, см</div>${inp('height', '', c.height, 'number')}</div><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Ведущая сторона</div>${sel('hand', [['R', 'Правша'], ['L', 'Левша']], c.hand)}</div></div>
    ${inp('activity', 'Спорт или работа', c.activity)}
    <textarea id="complaints" placeholder="Жалобы, травмы" rows="3" style="border-radius:14px;border:1.5px solid var(--line);padding:12px 14px;font:16px Onest;background:#fff">${esc(c.complaints)}</textarea>
    <textarea id="notes" placeholder="Заметки" rows="3" style="border-radius:14px;border:1.5px solid var(--line);padding:12px 14px;font:16px Onest;background:#fff">${esc(c.notes)}</textarea>
    <button class="btn ghost" id="dict" style="height:44px">🎙 Надиктовать</button>
   </div><div class="pad" style="padding-bottom:24px"><button class="btn" id="save">${thenAssess ? 'Сохранить и начать оценку' : 'Сохранить'}</button></div></div>`);
  $('#back').onclick = () => id ? clientCard(id) : proHome(); $('#dict').onclick = () => dictate($('#notes'), $('#dict'));
  $('#save').onclick = async () => { const v = n => $('#' + n).value.trim(); if (!v('first')) { $('#first').style.borderColor = '#E5484D'; $('#first').focus(); return; }
    Object.assign(c, { first: v('first'), last: v('last'), name: [v('first'), v('last')].filter(Boolean).join(' '), dob: v('dob'), sex: v('sex'), height: v('height'), leg: v('hand'), hand: v('hand'), activity: v('activity'), complaints: v('complaints'), notes: v('notes') });
    await put('clients', c); thenAssess ? newAssessment(c.id) : clientCard(c.id); };
}

export async function clientCard(id) {
  const c = await get('clients', id); if (!c) return proHome(); const as = await byClient(id); const last = as.at(-1);
  const age = c.dob ? Math.floor((Date.now() - new Date(c.dob)) / (365.25 * DAY)) : null;
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><span style="flex:1"></span><button class="pill" id="edit">Изменить</button></div>
   <div class="pad"><h1>${esc(c.name)}</h1><p class="sub" style="font-size:14px;margin-top:4px">${[age != null ? age + ' ' + (age % 10 === 1 && age % 100 !== 11 ? 'год' : [2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100) ? 'года' : 'лет') : '', c.sex === 'M' ? 'муж' : c.sex === 'F' ? 'жен' : '', c.height ? c.height + ' см' : '', c.hand === 'L' ? 'левша' : c.hand === 'R' ? 'правша' : '', c.activity].filter(Boolean).map(esc).join(' · ')}</p>
    ${c.complaints ? `<div class="card" style="margin-top:12px;font-size:15px;line-height:1.4"><div class="caps" style="color:var(--muted)">Жалобы</div>${esc(c.complaints)}</div>` : ''}
    ${c.notes ? `<div class="card" style="margin-top:8px;font-size:15px;line-height:1.4"><div class="caps" style="color:var(--muted)">Заметки</div>${esc(c.notes)}</div>` : ''}</div>
   ${last && last.nextDate ? `<div class="pad" style="margin-top:12px"><div class="card row" style="background:${last.nextDate - Date.now() <= 3 * DAY ? 'var(--shortS)' : '#fff'}"><div style="flex:1"><b>Повторный тест</b><div style="font-size:14px;color:var(--sub)">${fmtDate(last.nextDate)}</div></div><button class="pill" id="msg">Написать</button><button class="pill" id="cal" style="margin-left:6px">В календарь</button></div></div>` : ''}
   ${as.length >= 2 ? '<div class="pad" style="margin-top:14px"><button class="btn lime" id="cmp">Было → стало</button></div>' : ''}${as.length >= 3 ? '<div class="pad" style="margin-top:8px"><button class="btn ghost" id="rel" style="background:#fff">Повторяемость: 3 последних теста</button></div>' : ''}
   <div class="pad" style="margin-top:14px;display:flex;flex-direction:column;gap:10px"><button class="btn" id="na"><span class="ic">●</span> ${last ? 'Повторный тест' : 'Новая оценка'}</button><button class="btn ghost" id="inv" style="background:#fff">Ссылка клиенту: тест дома</button>${last ? '<button class="btn ghost" id="nb">Новая оценка с другим протоколом</button>' : ''}</div>
   <h3 class="pad" style="margin:22px 0 8px;font-size:17px">История оценок</h3>
   <div class="pad" style="display:flex;flex-direction:column;gap:8px">${as.length ? [...as].reverse().map(a => { const q = Object.values(a.quality || {}); const qa = q.length ? Math.round(q.reduce((x, y) => x + y, 0) / q.length) : null;
      const pain = Object.values(a.pain || {}).filter(v => v > 0); return `<div class="list-item" data-a="${a.id}" style="background:#fff"><div style="flex:1"><b>${fmtDate(a.date)}</b><div style="font-size:13px;color:var(--muted)">${esc(a.templateName || 'Оценка')}${qa != null ? ' · качество ' + qa : ''}${pain.length ? ' · боль до ' + Math.max(...pain) : ''}${a.draft ? ' · черновик' : ''}</div></div><span class="chev">›</span></div>`; }).join('')
      : '<p class="sub">Оценок пока нет.</p>'}</div>
   <div class="pad" style="margin-top:28px"><button class="btn ghost" id="del" style="color:#E5484D;border-color:#F3C9C9">Удалить клиента</button></div></div>`);
  $('#back').onclick = () => proHome(); $('#edit').onclick = () => clientForm(id);
  $('#na').onclick = () => newAssessment(id, last ? last.id : null); if ($('#nb')) $('#nb').onclick = () => newAssessment(id);
  if ($('#cal')) $('#cal').onclick = () => remind(c, last.nextDate);
  if ($('#cmp')) $('#cmp').onclick = () => compare(as.at(-2).id, last.id);
  if ($('#rel')) $('#rel').onclick = () => repeatability(as.slice(-3), id);
  $('#inv').onclick = () => sendInvite(c);
  if ($('#msg')) $('#msg').onclick = () => messageClient(c, last.nextDate);
  document.querySelectorAll('[data-a]').forEach(el => el.onclick = () => result(el.dataset.a));
  $('#del').onclick = async () => { if (!confirm(`Удалить ${c.name} и все оценки? Это нельзя отменить.`)) return; for (const a of as) { await del('assessments', a.id); await del('poses', a.id); } await del('clients', id); proHome(); };
}

// напоминание в календаре телефона: событие за 3 дня до ретеста и в день ретеста
function remind(c, date) {
  const p = n => String(n).padStart(2, '0'), d = t => { const x = new Date(t); return `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T100000`; };
  const ev = (t, sum, uid2) => ['BEGIN:VEVENT', 'UID:' + uid2 + '@bodypassport', 'DTSTART:' + d(t), 'DURATION:PT15M', 'SUMMARY:' + sum, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + sum, 'END:VALARM', 'END:VEVENT'];
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyPassport//RU', ...ev(date - 3 * DAY, `Через 3 дня повторный тест: ${c.name.replace(/[\r\n,;]/g, ' ')}`, c.id + '-3'), ...ev(date, `Повторный тест: ${c.name.replace(/[\r\n,;]/g, ' ')}`, c.id + '-0'), 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'retest.ics'; a.click();
}

// ---------- новая оценка: протокол, боль, камера ----------
async function newAssessment(clientId, retestOf) {
  const c = await get('clients', clientId); const prev = retestOf ? await get('assessments', retestOf) : null;
  let tpl = prev ? TEMPLATES.find(t => t[0] === prev.template) || ['custom', prev.templateName || 'Свой', prev.protocol] : TEMPLATES[0]; let units = prev ? prev.protocol : tpl[2]; const pain = {}; const pre = {}; let expect = '';
  const draw = () => { const rows = rowsOf(units);
    go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><b style="font-size:18px">${prev ? 'Повторный тест' : 'Новая оценка'}: ${esc(c.name)}</b></div>
     <div class="pad" style="display:flex;flex-direction:column;gap:16px;padding-bottom:20px">
      ${prev ? `<div class="card" style="background:var(--okS);font-size:14px;line-height:1.4">Тот же протокол, что ${fmtDate(prev.date)}. Поставь телефон так же: подсказка в кадре покажет, ближе или дальше.</div>` : ''}
      <div><b>Протокол</b><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px">${TEMPLATES.map(t => `<button class="pill" data-t="${t[0]}" style="border:1.5px solid ${tpl[0] === t[0] ? 'var(--navy)' : 'transparent'}">${t[1]}</button>`).join('')}</div>
        <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">${Object.keys(UNITS).map(u => `<label style="display:flex;align-items:center;gap:6px;font-size:14px;background:#fff;border-radius:99px;padding:6px 12px"><input type="checkbox" data-u="${u}" ${units.includes(u) ? 'checked' : ''} ${u === 'stand' ? 'disabled' : ''}>${UNIT_NAMES[u]}</label>`).join('')}</div>
        <p class="sub" style="font-size:13px;margin-top:8px">${rows.length} шагов · около ${mins(SETUP_SEC + secs(rows))} мин</p><div style="margin-top:10px">${stepList(units, pre)}</div></div>
      <div><b>Боль сейчас, 0–10</b><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${PAIN.map(([k, n]) => `<div class="row" style="background:#fff;border-radius:14px;padding:8px 14px"><span style="width:110px;font-size:14px">${n}</span><input type="range" min="0" max="10" value="${pain[k] || 0}" data-p="${k}" style="flex:1;accent-color:#1E2533"><b style="width:24px;text-align:right" id="pv_${k}">${pain[k] || 0}</b></div>`).join('')}</div></div>
      <div><b>Что ожидаете увидеть</b> <span class="sub" style="font-size:13px">необязательно</span><textarea id="expect" rows="2" placeholder="Например: справа слабая средняя ягодичная, колено уходит внутрь" style="margin-top:8px;width:100%;border-radius:14px;border:1.5px solid var(--line);padding:12px;font:15px Onest;background:#fff">${esc(expect)}</textarea>
        <p class="sub" style="font-size:12px;margin-top:4px">Запишите свой вывод по осмотру руками: после теста увидите, совпало ли.</p></div>
      <div><b>Камера</b><div class="seg" style="margin-top:8px"><button id="c0" class="${cam.back ? '' : 'on'}">Фронтальная</button><button id="c1" class="${cam.back ? 'on' : ''}">Основная</button></div></div>
     </div><div class="pad" style="padding-bottom:24px"><button class="btn" id="go"><span class="ic">●</span> Начать съемку</button></div></div>`);
    $('#back').onclick = () => clientCard(clientId); bindStepList(pre, draw);
    document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = TEMPLATES.find(t => t[0] === b.dataset.t); units = tpl[2]; draw(); });
    document.querySelectorAll('[data-u]').forEach(b => b.onchange = () => { units = sortUnits(b.checked ? [...units, b.dataset.u] : units.filter(x => x !== b.dataset.u)); tpl = ['custom', 'Свой', units]; draw(); });
    document.querySelectorAll('[data-p]').forEach(r => r.oninput = () => { pain[r.dataset.p] = +r.value; $('#pv_' + r.dataset.p).textContent = r.value; });
    $('#expect').oninput = e => { expect = e.target.value; };
    $('#c0').onclick = () => { cam.back = false; localStorage.setItem('bp_back', '0'); draw(); }; $('#c1').onclick = () => { cam.back = true; localStorage.setItem('bp_back', '1'); draw(); };
    $('#go').onclick = async () => { voice.unlock(); startMotion(); $('#go').textContent = 'Загружаю модель…';
      try { await initPose(); } catch (e) { alert('Не удалось загрузить модель: ' + e.message); return draw(); }
      const r = await runProtocol(units, { target: prev && prev.setup, onCancel: () => clientCard(clientId), pre }); if (!r) return;
      const a = { id: uid(), clientId, date: r.date, template: tpl[0], templateName: tpl[1], protocol: r.protocol, snapshot: r.snapshot, side: r.side, moves: r.moves, quality: r.quality, setup: r.setup, limits: r.limits || {}, pain, hyp: {}, plan: null, note: '', expect: expect.trim().slice(0, 500), nextDate: r.date + 30 * DAY, prevId: prev ? prev.id : null, draft: true };
      await put('assessments', a); await put('poses', { assessmentId: a.id, poses: r.poses }); result(a.id); }; };
  draw();
}

// ---------- результат: измерено, гипотеза, назначение ----------
function proSpots(a) {
  const base = spots(analyze(a, C));
  return base.map(s => { const o = a.hyp && a.hyp[s.key]; if (!o) return s; const st = STATES.find(x => x[0] === o); return { ...s, k: o, tone: st[2], derived: false, edited: true }; });
}
export async function result(aid, view = 'measured') {
  const a = await get('assessments', aid); if (!a) return proHome(); const c = await get('clients', a.clientId);
  const an = analyze(a, C); const sp = proSpots(a); const top = sp.filter(s => s.k !== 'OK' && (!s.derived || s.edited)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone));
  const q = Object.entries(a.quality || {}); const qa = q.length ? Math.round(q.reduce((x, [, v]) => x + v, 0) / q.length) : null;
  const facts = an.findings.slice(0, 3);
  const tab = (k, t) => `<button class="${view === k ? 'on' : ''}" data-v="${k}">${t}</button>`;
  let body = '';
  if (view === 'measured') body = `
    ${verdictCard(top, an.findings)}
    <button class="btn lime" id="mv" style="height:50px">▶ Запись движения</button>
    ${a.expect ? `<div class="card" style="background:#fff;border:1.5px solid var(--line)"><div class="caps" style="color:var(--muted)">Ваше ожидание до теста</div><p style="font-size:15px;line-height:1.45;margin-top:6px">${esc(a.expect)}</p>
      <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">${[['yes', 'Совпало'], ['part', 'Частично'], ['no', 'Не совпало']].map(([k, n]) => `<button class="pill" data-em="${k}" style="font-size:12px;padding:6px 10px;border:1.5px solid ${a.expectMatch === k ? 'var(--navy)' : 'transparent'}">${n}</button>`).join('')}</div></div>` : ''}
    <div class="card"><div class="caps" style="color:var(--muted)">Главное по замеру</div>${facts.length ? facts.map(f => `<div style="margin-top:12px"><b style="font-size:16px">${f.observed}</b>${f.rule.weak ? '<div style="font-size:12px;color:var(--muted)">слабый признак</div>' : ''}</div>`).join('') : '<p class="sub" style="margin-top:8px">Существенных отклонений не найдено.</p>'}</div>
    ${q.length ? `<div class="card"><div class="caps" style="color:var(--muted)">Качество съемки${qa != null ? ' · ' + qa + ' из 100' : ''}</div>${q.map(([k, v]) => `<div class="row" style="margin-top:8px;font-size:14px"><span style="flex:1">${esc(QNAMES[k] || k)}</span><b style="color:${v < 60 ? '#E5484D' : 'var(--text)'}">${esc(v)}${v < 60 ? ' · не для строгого сравнения' : ''}</b></div>`).join('')}</div>` : ''}
    ${a.limits && Object.keys(a.limits).length ? `<div class="card" style="background:var(--shortS)"><div class="caps" style="color:var(--coral)">Не смог выполнить</div>${Object.entries(a.limits).map(([u, l]) => `<div style="margin-top:8px;font-size:14px"><b>${esc(UNIT_NAMES[u] || u)}</b>: ${esc([...(l.reasons || []), l.level, l.side && l.side !== 'BOTH' ? (l.side === 'LEFT' ? 'слева' : 'справа') : ''].filter(Boolean).join(', ').toLowerCase())}${l.alt ? ' · сделан вариант с опорой' : ''}</div>`).join('')}</div>` : ''}
    ${Object.values(a.pain || {}).some(v => v > 0) ? `<div class="card"><div class="caps" style="color:var(--muted)">Боль до теста</div>${PAIN.filter(([k]) => a.pain[k] > 0).map(([k, n]) => `<div class="row" style="margin-top:6px"><span style="flex:1">${n}</span><b>${a.pain[k]} / 10</b></div>`).join('')}</div>` : ''}
    <details class="card"><summary style="font-weight:600">Все показатели</summary>${Object.entries(an.f).filter(([k, v]) => typeof v === 'number' && !k.startsWith('const')).map(([k, v]) => `<div class="row" style="font-size:13px;margin-top:4px"><span style="flex:1;color:var(--sub)">${k}</span><b style="font-variant-numeric:tabular-nums">${fmt(v)}</b></div>`).join('')}</details>`;
  if (view === 'hyp') body = `
    <div class="card" style="padding:12px 0"><div class="row" style="justify-content:center"><div class="seg" style="width:auto"><button id="hf" class="on">Спереди</button><button id="hb">Сзади</button></div>${device.webgl2 ? '<span class="pill" id="h3" style="margin-left:8px;border:1.5px solid var(--line)">3D</span>' : ''}</div>
      <div id="hvis" style="width:100%;max-width:360px;margin:8px auto 0"><canvas id="heat" style="width:100%;display:block"></canvas></div>
      <div id="hz" class="row" style="display:none;gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 8px 0">${[['all', 'Всё тело'], ['head', 'Шея'], ['shoulders', 'Плечи'], ['back', 'Спина'], ['pelvis', 'Таз'], ['knees', 'Колени'], ['feet', 'Стопы']].map(([z, n]) => `<button class="pill" data-z="${z}" style="font-size:12px;padding:6px 10px">${n}</button>`).join('')}</div>
      <div style="padding:8px 16px 0"><div style="height:8px;border-radius:4px;background:${RAMP_CSS}"></div></div></div>
    <p class="sub" style="font-size:13px">Черновик по замеру и цепям. Проверь руками и поправь состояние: в отчет клиенту пойдет твоя версия.</p>
    ${(() => { const v = Object.values(a.check || {}); return v.length ? `<div class="card row" style="padding:10px 14px;font-size:14px"><span style="flex:1">Проверено руками: <b>${v.length}</b></span><span>подтвердилось <b>${v.filter(x => x === 'yes').length}</b> из ${v.length}</span></div>` : ''; })()}
    ${(top.length ? top : sp.filter(s => s.k !== 'OK').slice(0, 8)).concat(sp.filter(s => s.edited && s.k === 'OK')).slice(0, 14).map(s => `<div class="card" style="padding:12px 14px"><div class="row"><i class="bar" style="background:${TONE_HEX[s.k]};height:30px"></i><div style="flex:1"><b style="font-size:15px">${title(s)}</b><div style="font-size:12px;color:var(--muted)">${tech(s)}${s.edited ? ' · правка специалиста' : s.derived ? ' · вывод по цепи' : ' · замер'}</div></div></div>
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${STATES.map(([k, n]) => `<button class="pill" data-k="${s.key}" data-s="${k}" style="font-size:12px;padding:5px 10px;border:1.5px solid ${s.k === k ? 'var(--navy)' : 'transparent'}">${n}</button>`).join('')}</div>
      ${C.muscles[s.id] && C.muscles[s.id].proTest ? `<details style="margin-top:10px;border-top:1px solid #F0EBE2;padding-top:8px" ${(a.check || {})[s.key] ? '' : ''}><summary style="font-size:13px;font-weight:600;cursor:pointer;color:var(--navy)">Проверь руками${(a.check || {})[s.key] === 'yes' ? ' · подтвердилось ✓' : (a.check || {})[s.key] === 'no' ? ' · не подтвердилось' : ''}</summary>
        <p style="font-size:13.5px;line-height:1.45;margin-top:6px">${C.muscles[s.id].proTest}</p>
        <div class="row" style="gap:6px;margin-top:8px"><button class="pill" data-chk="${s.key}" data-v="yes" style="font-size:12px;padding:6px 10px;border:1.5px solid ${(a.check || {})[s.key] === 'yes' ? 'var(--navy)' : 'transparent'}">Подтвердилось</button><button class="pill" data-chk="${s.key}" data-v="no" style="font-size:12px;padding:6px 10px;border:1.5px solid ${(a.check || {})[s.key] === 'no' ? 'var(--navy)' : 'transparent'}">Не подтвердилось</button></div></details>` : ''}</div>`).join('')}
    <button class="btn ghost" id="addm" style="height:44px">Добавить мышцу</button>`;
  if (view === 'plan') { const pl = a.plan || { ex: plan(top), text: '' }; const recs = muscleRecs(a);
    body = `<div class="card"><div class="row"><div class="caps" style="color:var(--muted);flex:1">Рекомендации по мышцам</div>${recs.length ? '<button class="pill" id="addall" style="font-size:12px">Добавить все</button>' : ''}</div>
      ${recs.length ? recs.map((r, i) => `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #F0EBE2"><div class="row"><i class="bar" style="background:${TONE_HEX[r.s.k]};height:22px"></i><b style="flex:1;font-size:15px">${r.head}</b>${r.all.length ? `<button class="pill" data-add="${i}" style="font-size:12px">Добавить</button>` : ''}</div>
        ${r.out.map(([h, t]) => `<div style="font-size:14px;margin-top:6px;line-height:1.4"><b>${h}:</b> ${t}</div>`).join('')}</div>`).join('') : '<p class="sub" style="margin-top:8px">Значимых отклонений нет.</p>'}</div>
    <div class="card"><div class="caps" style="color:var(--muted)">Упражнения</div>${Object.values(C.exercises).filter(e => !e.id.endsWith('_right') || pl.ex.includes(e.id)).sort((x, y) => (pl.ex.includes(y.id) - pl.ex.includes(x.id)) || x.title.localeCompare(y.title)).slice(0, 40).map(e => `<label class="row" style="margin-top:8px;font-size:15px"><input type="checkbox" data-e="${e.id}" ${pl.ex.includes(e.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:#1E2533"><span style="flex:1">${e.title.split(' (')[0]}${e.id.endsWith('_right') ? ' (правая)' : e.id.endsWith('_left') && pl.ex.includes(e.id) ? ' (левая)' : ''}</span><span style="font-size:12px;color:var(--muted)">${e.dose || ''}</span></label>`).join('')}</div>
      <div class="card"><div class="caps" style="color:var(--muted)">Комментарий для клиента</div><textarea id="pt" rows="4" style="width:100%;margin-top:8px;border-radius:12px;border:1.5px solid var(--line);padding:10px;font:15px Onest">${esc(pl.text)}</textarea><button class="btn ghost" id="dict" style="height:40px;margin-top:8px">🎙 Надиктовать</button></div>
      <div class="card row"><span style="flex:1">Повторный тест</span><input type="date" id="nd" value="${Number.isFinite(+a.nextDate) && +a.nextDate > 0 ? new Date(+a.nextDate).toISOString().slice(0, 10) : ''}" style="height:40px;border-radius:10px;border:1.5px solid var(--line);padding:0 8px;font:15px Onest"></div>`; }
  go(`<div class="fade" style="padding-bottom:110px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><div style="flex:1"><b style="font-size:17px">${esc(c.name)}</b><div style="font-size:13px;color:var(--muted)">${fmtDate(a.date)} · ${esc(a.templateName)}</div></div></div>
    <div class="pad"><div class="seg">${tab('measured', 'Измерено')}${tab('hyp', 'Гипотеза')}${tab('plan', 'Назначение')}</div></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:10px;margin-top:12px">${body}</div>
    <div style="position:fixed;left:0;right:0;bottom:0;padding:12px 20px calc(env(safe-area-inset-bottom) + 20px);background:linear-gradient(transparent,var(--bg) 30%);max-width:480px;margin:0 auto"><div class="row" style="gap:8px"><button class="btn ghost" id="rep" style="flex:1;background:#fff">Отчет</button>${a.prevId ? '<button class="btn ghost" id="cmp" style="flex:1;background:#fff">Было → стало</button>' : ''}<button class="btn" id="fin" style="flex:1.3">${a.draft ? 'Сохранить' : 'Готово'}</button></div></div></div>`);
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = async () => { await savePlan(a); result(aid, b.dataset.v); });
  if ($('#mv')) $('#mv').onclick = async () => { const pp = await get('poses', aid); motionViewer(pp && pp.poses, a.setup, () => result(aid), `${c.name} · ${fmtDate(a.date)}`); };
  $('#back').onclick = async () => { await savePlan(a); clientCard(a.clientId); };
  $('#rep').onclick = async () => { await savePlan(a); a.draft = false; await put('assessments', a); report(aid); };
  if ($('#cmp')) $('#cmp').onclick = async () => { await savePlan(a); a.draft = false; await put('assessments', a); compare(a.prevId, aid); };
  $('#fin').onclick = async () => { await savePlan(a); a.draft = false; await put('assessments', a); clientCard(a.clientId); };
  document.querySelectorAll('[data-em]').forEach(btn => btn.onclick = async () => { a.expectMatch = a.expectMatch === btn.dataset.em ? null : btn.dataset.em; await put('assessments', a); const y = scrollY; await result(aid, view); scrollTo(0, y); });
  if (view === 'hyp') document.querySelectorAll('[data-chk]').forEach(btn => btn.onclick = async () => { a.check = a.check || {}; const k = btn.dataset.chk;
    a.check[k] = a.check[k] === btn.dataset.v ? undefined : btn.dataset.v; if (!a.check[k]) delete a.check[k];
    if (btn.dataset.v === 'no' && a.check[k]) { a.hyp = a.hyp || {}; a.hyp[k] = 'OK'; } // не подтвердилось руками: в отчет как норма
    await put('assessments', a); const y = scrollY; await result(aid, 'hyp'); scrollTo(0, y); });
  if (view === 'hyp') { let back = false; const lab = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 4)).map(s => ({ key: s.key, title: C.muscles[s.id].zone, sub: TONE[s.k][0].toLowerCase(), color: TONE_HEX[s.k] }));
    let v3 = null, mode3 = false;
    const draw2 = () => { if (mode3) { if (v3) v3.turn(back); return; } drawHeat($('#heat'), sp, back, null, lab); }; draw2();
    $('#hf').onclick = () => { back = false; $('#hf').classList.add('on'); $('#hb').classList.remove('on'); draw2(); }; $('#hb').onclick = () => { back = true; $('#hb').classList.add('on'); $('#hf').classList.remove('on'); draw2(); };
    // 3D-модель с той же картой (с правками специалиста); касание мышцы прокручивает к ее строке
    if ($('#h3')) $('#h3').onclick = async () => { mode3 = !mode3; HYP3D = mode3; $('#h3').textContent = mode3 ? 'Схема' : '3D'; $('#hz').style.display = mode3 ? 'flex' : 'none';
      if (!mode3) { if (v3) v3.dispose(); v3 = null; $('#hvis').style.height = ''; $('#hvis').innerHTML = '<canvas id="heat" style="width:100%;display:block"></canvas>'; draw2(); return; }
      $('#hvis').style.height = '380px'; v3 = await body3D($('#hvis'), sp, key => { const el = document.querySelector(`[data-k="${key}"]`); if (el) el.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      v3.turn(back); document.querySelectorAll('[data-z]').forEach(b => b.onclick = () => v3.focus(b.dataset.z)); };
    if (HYP3D && $('#h3')) { HYP3D = false; $('#h3').click(); }
    document.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { a.hyp = a.hyp || {}; a.hyp[b.dataset.k] = b.dataset.s; await put('assessments', a); const y = scrollY; await result(aid, 'hyp'); scrollTo(0, y); });
    $('#addm').onclick = () => { const d = document.createElement('div'); d.className = 'sheet';
      d.innerHTML = `<div><h2 style="font-size:20px">Добавить мышцу</h2>
        <select id="mm" style="width:100%;height:48px;margin-top:12px;border-radius:14px;border:1.5px solid var(--line);padding:0 10px;font:16px Onest">${Object.entries(C.muscles).sort((x, y) => (x[1].zone || '').localeCompare(y[1].zone || '')).map(([id, m]) => `<option value="${id}">${m.zone || m.name} — ${m.name}</option>`).join('')}</select>
        <div class="seg" style="margin-top:10px"><button id="sl" class="on">Левая</button><button id="sr">Правая</button></div>
        <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">${STATES.filter(x => x[0] !== 'OK').map(([k, n], i) => `<button class="pill" data-ns="${k}" style="border:1.5px solid ${i ? 'transparent' : 'var(--navy)'}">${n}</button>`).join('')}</div>
        <button class="btn" id="ma" style="margin-top:14px">Добавить</button><button class="btn ghost" id="mx" style="margin-top:8px;border:0">Отмена</button></div>`;
      document.body.appendChild(d); let side = 'LEFT', st = 'HYPER';
      d.querySelector('#sl').onclick = () => { side = 'LEFT'; d.querySelector('#sl').classList.add('on'); d.querySelector('#sr').classList.remove('on'); };
      d.querySelector('#sr').onclick = () => { side = 'RIGHT'; d.querySelector('#sr').classList.add('on'); d.querySelector('#sl').classList.remove('on'); };
      d.querySelectorAll('[data-ns]').forEach(b => b.onclick = () => { st = b.dataset.ns; d.querySelectorAll('[data-ns]').forEach(x => x.style.borderColor = x === b ? 'var(--navy)' : 'transparent'); });
      d.querySelector('#mx').onclick = () => d.remove();
      d.querySelector('#ma').onclick = async () => { a.hyp = a.hyp || {}; a.hyp[d.querySelector('#mm').value + ':' + side] = st; await put('assessments', a); d.remove(); result(aid, 'hyp'); }; }; }
  if (view === 'plan') { $('#dict').onclick = () => dictate($('#pt'), $('#dict'));
    const recs = muscleRecs(a); const addIds = async list => { await savePlan(a); a.plan = a.plan || { ex: [], text: '' }; a.plan.ex = [...new Set([...a.plan.ex, ...list])]; await put('assessments', a); const y = scrollY; await result(aid, 'plan'); scrollTo(0, y); };
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addIds(recs[+b.dataset.add].all));
    if ($('#addall')) $('#addall').onclick = () => addIds(recs.flatMap(r => r.all)); }
}
/** Рекомендации по конкретным мышцам: что отпустить, что включить, чем закрепить. Из правок специалиста и черновика. */
function muscleRecs(a) {
  const sp = proSpots(a).filter(s => s.k !== 'OK' && (!s.derived || s.edited)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone)).slice(0, 8);
  const sideW = s => s.side === 'RIGHT' ? 'справа' : 'слева', sk = s => s.side === 'RIGHT' ? 'right' : 'left';
  const ids = (l, s) => (l || []).map(x => x.replace('{s}', sk(s))).filter(x => C.exercises[x]);
  const exT = id => C.exercises[id].title.split(' (')[0];
  return sp.map(s => { const m = C.muscles[s.id], state = s.k === 'WEAK' ? 'слабая' : s.k === 'SHORT' ? 'укорочена' : 'перегружена', out = [];
    if (s.k === 'WEAK') { const subs = ((m.plan && m.plan.subs) || []).map(x => C.muscles[x]).filter(Boolean);
      const rel = ids(m.plan && m.plan.release, s), iso = ids((m.plan && m.plan.isolate) || m.activate, s).filter(x => !rel.includes(x)), integ = ids(m.plan && m.plan.integrate, s).filter(x => !rel.includes(x) && !iso.includes(x));
      if (subs.length || rel.length) out.push(['Отпустить', `${subs.map(x => x.name.toLowerCase()).join(', ') || 'перехватывающие мышцы'}${rel.length ? ': ' + rel.map(exT).join(', ') : ''}`, rel]);
      if (iso.length) out.push(['Включить отдельно', iso.map(exT).join(', '), iso]);
      if (integ.length) out.push(['Закрепить в движении', integ.map(exT).join(', '), integ]); }
    else { const rel = ids(m.relax, s), ant = m.antagonist && C.muscles[m.antagonist];
      if (m.massage) out.push(['Самомассаж' + (m.tool ? ' (' + m.tool + ')' : ''), m.massage, []]);
      if (rel.length) out.push(['Растянуть', rel.map(exT).join(', '), rel]);
      const act = ant ? ids(((ant.plan && ant.plan.isolate) || []).concat(ant.activate || []), s).filter(x => !rel.includes(x)).slice(0, 1) : [];
      if (act.length) out.push([`Включить антагонист: ${ant.name.toLowerCase()}`, act.map(exT).join(', '), act]); }
    return { s, head: `${m.name} ${sideW(s)}: ${state}`, out, all: [...new Set(out.flatMap(x => x[2]))] }; });
}

async function savePlan(a) {
  if ($('#pt')) { a.plan = { ex: [...document.querySelectorAll('[data-e]:checked')].map(x => x.dataset.e), text: $('#pt').value.trim() }; const d = $('#nd').value; if (d) a.nextDate = new Date(d + 'T10:00').getTime(); await put('assessments', a); }
}

// ---------- резервная копия ----------
async function backup() {
  const data = { app: 'bodypassport-pro', v: 1, created: Date.now(), clients: await all('clients'), assessments: await all('assessments'), poses: await all('poses'), meta: await all('meta') };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' }); const name = `bodypassport-${new Date().toISOString().slice(0, 10)}.bpbackup.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Резервная копия BodyPassport' }); } catch (e) { return; } }
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  await setMeta('lastBackup', Date.now()); proHome();
}
async function restore(file) {
  try { const d = JSON.parse(await file.text()); if (d.app !== 'bodypassport-pro') throw new Error('Это не резервная копия BodyPassport');
    for (const x of d.clients) await put('clients', x); for (const x of d.assessments) await put('assessments', x); for (const x of d.poses) await put('poses', x); for (const x of d.meta || []) await put('meta', x);
    alert(`Восстановлено клиентов: ${d.clients.length}, оценок: ${d.assessments.length}`); proHome(); }
  catch (e) { alert('Не удалось восстановить: ' + e.message); }
}

// для автотестов
export const _pro = { all, put, get, del, db, unpack: (...a) => unpack(...a), normalize: (...a) => normalize(...a), phaseRep: (...a) => phaseRep(...a) };

// =================== Этап 2: «было → стало» и отчет клиенту ===================
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30]];
const b64u8 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
/** Распаковка записи скелета в кадры с точками в пикселях исходного кадра. */
function unpack(pk, w = 720, h = 1280) {
  if (!pk || !pk.n) return [];
  const t = new Float32Array(b64u8(pk.t).buffer), d = new Int16Array(b64u8(pk.d).buffer), out = [];
  for (let i = 0; i < pk.n; i++) { const p = []; for (let j = 0; j < 33; j++) { const o = i * 99 + j * 3; p.push({ x: d[o] / 10000 * w, y: d[o + 1] / 10000 * h, v: d[o + 2] / 10000 }); } out.push({ t: t[i], p }); }
  return out;
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const medn = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : 0; };
/**
 * Приведение к одному виду: стопы в начале координат, рост в стойке = 1.
 * Опорная точка и масштаб берутся из первых кадров (человек стоит), поэтому не зависят от расстояния до камеры и места в кадре.
 */
function normalize(fr) {
  if (!fr.length) return fr;
  const head = f => Math.min(f.p[0].y, f.p[7].y, f.p[8].y);
  const first = fr.slice(0, Math.min(10, fr.length));
  const ox = medn(first.map(f => mid(f.p[27], f.p[28]).x)), oy = medn(first.map(f => mid(f.p[27], f.p[28]).y));
  const hgt = Math.max(1, medn(first.map(f => mid(f.p[27], f.p[28]).y - head(f))));
  return fr.map(f => ({ t: f.t, p: f.p.map(l => ({ x: (l.x - ox) / hgt, y: (l.y - oy) / hgt, v: l.v })) }));
}
/** Один повтор, разложенный на 60 фаз от верхней точки через нижнюю обратно: повторы с разной скоростью совпадают по фазе. */
function phaseRep(fr) {
  if (fr.length < 20) return fr;
  const y = fr.map(f => mid(f.p[23], f.p[24]).y), sm = y.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(y.length - 1, i + 2); j++) { s += y[j]; n++; } return s / n; });
  const base = medn(sm.slice(0, 8)), bottoms = [];
  for (let i = 2; i < sm.length - 2; i++) if (sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] - base > .04 && (!bottoms.length || i - bottoms.at(-1) > 15)) bottoms.push(i);
  if (!bottoms.length) return resample(fr, 60);
  const b = bottoms[Math.floor(bottoms.length / 2)];
  let s0 = b; while (s0 > 0 && sm[s0 - 1] <= sm[s0] + 1e-4) s0--; let s1 = b; while (s1 < sm.length - 1 && sm[s1 + 1] <= sm[s1] + 1e-4) s1++;
  return resample(fr.slice(s0, s1 + 1), 60);
}
function resample(fr, n) {
  if (fr.length < 2) return fr; const out = [];
  for (let k = 0; k < n; k++) { const x = k / (n - 1) * (fr.length - 1), i = Math.floor(x), f = x - i, a = fr[i], b = fr[Math.min(fr.length - 1, i + 1)];
    out.push({ t: k / (n - 1), p: a.p.map((l, j) => ({ x: l.x + (b.p[j].x - l.x) * f, y: l.y + (b.p[j].y - l.y) * f, v: Math.min(l.v, b.p[j].v) })) }); }
  return out;
}
const REP_TESTS = ['ohs_front', 'ohs_side', 'ohs_back', 'sls_r', 'sls_l'];
const prepTrack = (pk, a, key) => { const fr = normalize(unpack(pk, a.setup && a.setup.w, a.setup && a.setup.h)); return REP_TESTS.includes(key) ? phaseRep(fr) : resample(fr, 120); };

function drawPair(cv, ghost, cur, k) {
  const ctx = cv.getContext('2d'), W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, W, H); const sc = H / 1.32, ox = W / 2, oy = H * .9;
  const P = l => [ox + l.x * sc, oy + l.y * sc];
  ctx.strokeStyle = '#E0D8CA'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
  const sk = (fr, color, width, alpha) => { const f = fr[Math.min(fr.length - 1, Math.round(k * (fr.length - 1)))]; if (!f) return; ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    for (const [i, j] of BONES) { if (f.p[i].v < .3 || f.p[j].v < .3) continue; ctx.beginPath(); ctx.moveTo(...P(f.p[i])); ctx.lineTo(...P(f.p[j])); ctx.stroke(); }
    const h = P(f.p[0]); ctx.beginPath(); ctx.arc(h[0], h[1], sc * .045, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; };
  sk(ghost, '#A9A091', 6 * devicePixelRatio, .55); sk(cur, '#1E2533', 4 * devicePixelRatio, 1);
}

// пороги «существенного изменения»: меньше — это погрешность съемки (до собственной валидации — консервативные значения)
const METRICS = [['sq_depth', 'Глубина приседа (сгибание колен)', '°', 8, true], ['valgus_max', 'Колено внутрь в приседе', '°', 5], ['sls_valgus_r', 'Колено внутрь, правая нога', '°', 5], ['sls_valgus_l', 'Колено внутрь, левая нога', '°', 5],
  ['sls_drop_r', 'Провал таза, на правой', '°', 2.5], ['sls_drop_l', 'Провал таза, на левой', '°', 2.5], ['sq_shift', 'Сдвиг таза в приседе', '', .12], ['sq_lean', 'Наклон корпуса в приседе', '°', 5],
  ['sq_arms', 'Руки падают вперед', '°', 6], ['shoulder_tilt', 'Перекос плеч', '°', 2], ['pelvic_tilt', 'Перекос таза', '°', 2], ['head_forward', 'Голова вперед', '°', 4],
  ['asym_delt', 'Разница рук в стороны', '°', 6], ['asym_bend', 'Разница наклонов', '°', 5], ['asym_calf', 'Разница икр', '%', 15], ['asym_quad', 'Разница глубины на одной ноге', '°', 8]];
function deltas(pa, ca) {
  const f0 = analyze(pa, C).f, f1 = analyze(ca, C).f;
  return METRICS.filter(([k]) => Number.isFinite(f0[k]) && Number.isFinite(f1[k])).map(([k, n, u, thr, up]) => { const was = Math.abs(f0[k]), now = Math.abs(f1[k]), d = now - was;
    return { k, n, u, was, now, d, state: Math.abs(d) < thr ? 'same' : (up ? d > 0 : d < 0) ? 'better' : 'worse' }; });
}

export async function compare(prevId, curId) {
  if (!gate('compare')) return;
  const [pa, ca, pp, cp] = await Promise.all([get('assessments', prevId), get('assessments', curId), get('poses', prevId), get('poses', curId)]);
  const c = await get('clients', ca.clientId);
  const keys = Object.keys((cp && cp.poses) || {}).filter(k => pp && pp.poses && pp.poses[k]);
  let key = keys.includes('ohs_front') ? 'ohs_front' : keys[0], k = 0, playing = true, raf = 0;
  const ds = deltas(pa, ca); const better = ds.filter(x => x.state === 'better').length, worse = ds.filter(x => x.state === 'worse').length;
  const painRows = PAIN.filter(([z]) => (pa.pain || {})[z] > 0 || (ca.pain || {})[z] > 0);
  const lowQ = q => Object.values(q || {}).some(v => v < 60);
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><div style="flex:1"><b style="font-size:17px">Было → стало</b><div style="font-size:13px;color:var(--muted)">${esc(c.name)} · ${fmtDate(pa.date)} → ${fmtDate(ca.date)}</div></div></div>
   <div class="pad"><div class="card" style="background:${better > worse ? 'var(--okS)' : '#fff'}"><b style="font-size:17px">${better ? `Лучше: ${better}` : 'Существенных улучшений нет'}${worse ? ` · хуже: ${worse}` : ''} · без изменений: ${ds.length - better - worse}</b>
     <div style="font-size:13px;color:var(--sub);margin-top:4px">Изменения меньше погрешности съемки показаны как «без изменений».${lowQ(pa.quality) || lowQ(ca.quality) ? ' Часть тестов снята с низким качеством: сравнение по ним менее надежно.' : ''}</div></div></div>
   ${keys.length ? `<div class="pad" style="margin-top:12px"><div class="row" style="gap:6px;flex-wrap:wrap">${keys.map(x => `<button class="pill" data-k="${esc(x)}" style="border:1.5px solid ${x === key ? 'var(--navy)' : 'transparent'}">${esc(QNAMES[x] || x)}</button>`).join('')}</div>
     <div class="card" style="margin-top:10px;padding:10px"><canvas id="cv" style="width:100%;height:340px;display:block"></canvas>
       <div class="row" style="margin-top:8px"><button class="round" id="pp" style="background:var(--lime)">❚❚</button><input type="range" id="ph" min="0" max="1000" value="0" style="flex:1;accent-color:#1E2533"></div>
       <div class="row" style="font-size:12px;color:var(--muted);margin-top:6px;gap:14px"><span><b style="color:#A9A091">━</b> было</span><span><b style="color:#1E2533">━</b> стало</span><span style="flex:1;text-align:right">выровнено по стопам и росту</span></div></div></div>` : '<p class="pad sub" style="margin-top:12px">В этих оценках нет общих тестов со скелетом.</p>'}
   <div class="pad" style="margin-top:12px"><div class="card"><div class="caps" style="color:var(--muted)">Показатели</div>
     ${ds.map(x => `<div class="row" style="margin-top:10px;font-size:14px"><span style="flex:1">${x.n}</span><span style="font-variant-numeric:tabular-nums">${fmt(x.was)}${x.u} → <b>${fmt(x.now)}${x.u}</b></span><span class="badge" style="margin-left:8px;background:${x.state === 'better' ? 'var(--okS)' : x.state === 'worse' ? 'var(--hyperS)' : 'var(--seg)'};color:${x.state === 'better' ? 'var(--green)' : x.state === 'worse' ? '#E5484D' : 'var(--sub)'}">${x.state === 'better' ? 'лучше' : x.state === 'worse' ? 'хуже' : 'без изм.'}</span></div>`).join('') || '<p class="sub">Нет общих показателей.</p>'}</div></div>
   ${painRows.length ? `<div class="pad" style="margin-top:12px"><div class="card"><div class="caps" style="color:var(--muted)">Боль 0–10</div>${painRows.map(([z, n]) => `<div class="row" style="margin-top:8px"><span style="flex:1">${n}</span><b>${(pa.pain || {})[z] || 0} → ${(ca.pain || {})[z] || 0}</b></div>`).join('')}</div></div>` : ''}
   <div class="pad" style="margin-top:14px"><button class="btn" id="rep">Отчет клиенту</button></div></div>`);
  $('#back').onclick = () => { cancelAnimationFrame(raf); result(curId); };
  $('#rep').onclick = () => report(curId);
  if (!keys.length) return;
  let ghost, cur; const load = () => { ghost = prepTrack(pp.poses[key], pa, key); cur = prepTrack(cp.poses[key], ca, key); };
  load(); const cv = $('#cv');
  const loop = () => { if (!cv.isConnected) return; if (playing) { k = (k + 1 / 90) % 1; $('#ph').value = Math.round(k * 1000); } drawPair(cv, ghost, cur, k); raf = requestAnimationFrame(loop); }; loop();
  $('#pp').onclick = () => { playing = !playing; $('#pp').textContent = playing ? '❚❚' : '▶'; };
  $('#ph').oninput = e => { playing = false; $('#pp').textContent = '▶'; k = e.target.value / 1000; };
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { key = b.dataset.k; load(); document.querySelectorAll('[data-k]').forEach(x => x.style.borderColor = x === b ? 'var(--navy)' : 'transparent'); });
}

// отчет клиенту: картинка с именем специалиста, картой (с правками), фактами, «было → стало», упражнениями и датой ретеста
async function report(aid) {
  const a = await get('assessments', aid), c = await get('clients', a.clientId), prev = a.prevId ? await get('assessments', a.prevId) : null;
  const author = (await meta('profile')) || defaultAuthor();
  const sp = proSpots(a), an = analyze(a, C), top = sp.filter(s => s.k !== 'OK' && (!s.derived || s.edited)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone)).slice(0, 5);
  const W = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = 3000; const g = cv.getContext('2d'); await document.fonts.ready;
  g.fillStyle = '#F4F0E8'; g.fillRect(0, 0, W, 3000);
  g.fillStyle = '#E8765A'; g.font = '600 26px Onest, sans-serif'; g.fillText('ПАСПОРТ ДВИЖЕНИЯ', 64, 80);
  g.fillStyle = '#1C1B19'; g.font = '700 56px Onest, sans-serif'; g.fillText(c.name.slice(0, 28), 64, 150);
  g.fillStyle = '#6E6A63'; g.font = '400 30px Onest, sans-serif'; g.fillText(`Оценка ${fmtDate(a.date)}`, 64, 200);
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:470px'; document.body.appendChild(holder);
  for (const [i, back] of [[0, false], [1, true]]) { const hc = document.createElement('canvas'); hc.style.width = '470px'; holder.appendChild(hc); drawHeat(hc, sp, back, null, []); g.drawImage(hc, 64 + i * 486, 240, 470, 470 * hc.height / hc.width); }
  holder.remove(); let y = 860;
  const h2 = t => { y += 70; g.fillStyle = '#1C1B19'; g.font = '700 36px Onest, sans-serif'; g.fillText(t, 64, y); y += 10; };
  const line = (t, col = '#3E3A34', size = 28) => { y += size + 16; g.fillStyle = col; g.font = `400 ${size}px Onest, sans-serif`; g.fillText(t.slice(0, 62), 64, y); };
  h2('Главное по замеру'); an.findings.slice(0, 3).forEach(f => line('• ' + f.observed));
  if (a.limits && Object.keys(a.limits).length) { h2('Не получилось'); Object.entries(a.limits).forEach(([u, l]) => line(`• ${LIMIT_NAMES[u] || u}: ${[...(l.reasons || []), l.level].filter(Boolean).join(', ').toLowerCase()}`)); }
  if (top.length) { h2('Мышцы'); top.forEach(s => { y += 50; g.fillStyle = TONE_HEX[s.k]; g.fillRect(64, y - 30, 10, 38); g.fillStyle = '#1C1B19'; g.font = '600 28px Onest, sans-serif'; g.fillText(title(s).slice(0, 56), 90, y); }); }
  if (prev) { const ds = deltas(prev, a).filter(x => x.state !== 'same'); h2(`Было → стало (с ${fmtDate(prev.date)})`);
    if (!ds.length) line('Существенных изменений пока нет');
    ds.slice(0, 5).forEach(x => line(`${x.state === 'better' ? '✓' : '!'} ${x.n}: ${fmt(x.was)}${x.u} → ${fmt(x.now)}${x.u}`, x.state === 'better' ? '#2E9E6A' : '#E5484D'));
    PAIN.filter(([z]) => (prev.pain || {})[z] > 0 || (a.pain || {})[z] > 0).forEach(([z, n]) => line(`Боль, ${n.toLowerCase()}: ${(prev.pain || {})[z] || 0} → ${(a.pain || {})[z] || 0}`)); }
  const recs = muscleRecs(a).slice(0, 5); if (recs.length) { h2('По мышцам'); recs.forEach(r => { line('• ' + r.head, '#1C1B19'); r.out.slice(0, 2).forEach(([hh, t]) => line('   ' + hh + ': ' + t.slice(0, 50), '#6E6A63', 24)); }); }
  const pl = a.plan || { ex: [], text: '' };
  if (pl.ex.length || pl.text) { h2('Что делать'); pl.ex.forEach(id => { const e = C.exercises[id]; if (e) line(`• ${e.title}${e.dose ? ' — ' + e.dose : ''}`); }); if (pl.text) line(pl.text); }
  h2(`Следующий тест: ${fmtDate(a.nextDate)}`);
  const H2 = y + 170, out = document.createElement('canvas'); out.width = W; out.height = H2; const o = out.getContext('2d'); o.drawImage(cv, 0, 0);
  o.fillStyle = '#1E2533'; o.fillRect(0, H2 - 120, W, 120); o.fillStyle = '#C6E84B'; o.font = '700 30px Onest, sans-serif'; o.fillText(author.slice(0, 52), 64, H2 - 66);
  const contact = await meta('contact');
  if (contact) { o.fillStyle = '#fff'; o.font = '500 24px Onest, sans-serif'; o.fillText('Запись: ' + contact.slice(0, 48), 64, H2 - 28); o.textAlign = 'right'; o.fillStyle = 'rgba(255,255,255,.5)'; o.font = '400 18px Onest, sans-serif'; o.fillText('BodyPassport · не диагноз', W - 64, H2 - 28); o.textAlign = 'left'; }
  else { o.fillStyle = 'rgba(255,255,255,.6)'; o.font = '400 22px Onest, sans-serif'; o.fillText('BodyPassport · оценка по позе и движению, не диагноз', 64, H2 - 28); }
  const blob = await new Promise(r => out.toBlob(r, 'image/png')); const file = new File([blob], `bodypassport-${c.name}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Паспорт движения' }).catch(() => {});
  else { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = file.name; l.click(); }
}

// сообщение клиенту о ретесте: текст в мессенджер одним касанием
function messageClient(c, date) {
  const text = `${c.name.split(' ')[0]}, здравствуйте! ${fmtDate(date)} пора повторить тест движения, чтобы увидеть изменения. Когда вам удобно?`;
  if (navigator.share) navigator.share({ text }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(text); alert('Текст скопирован'); }
}


// =================== Ссылка клиенту: тест дома → результат сразу у специалиста ===================
async function inviteLink(c, units) {
  if (!c.invite) { c.invite = { id: seal.rid(), key: await seal.key() }; await put('clients', c); }
  const author = (await meta('profile')) || defaultAuthor();
  return location.origin + '/#inv=' + seal.pack({ i: c.invite.id, k: c.invite.key, n: c.name.split(' ')[0], s: author, p: units });
}
async function sendInvite(c) {
  if (!gate('invite')) return;
  const as = await byClient(c.id); const lastT = as.at(-1); let tpl = TEMPLATES.find(t => t[0] === (lastT && lastT.template)) || TEMPLATES[0];
  const d = document.createElement('div'); d.className = 'sheet';
  const draw = () => { d.innerHTML = `<div><h2 style="font-size:20px">Ссылка клиенту</h2><p class="sub" style="font-size:14px;margin-top:6px">${esc(c.name)} откроет ссылку, пройдет тест дома, и результат сам появится в его карточке. Клиент тоже видит свою карту.</p>
    <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${TEMPLATES.map(t => `<button class="pill" data-t="${t[0]}" style="border:1.5px solid ${tpl[0] === t[0] ? 'var(--navy)' : 'transparent'}">${t[1]}</button>`).join('')}</div>
    <p class="sub" style="font-size:13px;margin-top:8px">${rowsOf(tpl[2]).length} шагов · около ${mins(SETUP_SEC + secs(rowsOf(tpl[2])))} мин</p>
    <button class="btn" id="snd" style="margin-top:14px">Отправить ссылку</button><p style="font-size:12px;color:var(--muted);margin-top:8px">Результат шифруется на телефоне клиента. Ключ есть только у тебя и клиента.</p>
    <button class="btn ghost" id="cx" style="margin-top:8px;border:0">Отмена</button></div>`;
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = TEMPLATES.find(t => t[0] === b.dataset.t); draw(); });
    d.querySelector('#cx').onclick = () => d.remove();
    d.querySelector('#snd').onclick = async () => { const url = await inviteLink(c, tpl[2]); const text = `${c.name.split(' ')[0]}, здравствуйте! Пройдите, пожалуйста, тест движения по ссылке, это 2–4 минуты. Результат сразу придет мне.`;
      if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url); alert('Ссылка скопирована'); } d.remove(); }; };
  draw(); document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
}
const str = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, n) : '';
const KEY = /^[a-z_]{1,20}$/;
/** Результат пришел с чужого телефона: пропускаем только ожидаемые поля и типы (иначе возможна вставка HTML в кабинет). */
function cleanRemote(r) {
  const base = cleanResult(r), pick = (o, f) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 30).filter(([k]) => KEY.test(k)).map(([k, v]) => [k, f(v)]).filter(([, v]) => v !== undefined));
  const n = v => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const protocol = sortUnits(Array.isArray(r.protocol) ? r.protocol.filter(u => typeof u === 'string' && Object.prototype.hasOwnProperty.call(UNITS, u)) : []);
  const limits = pick(r.limits, l => l && typeof l === 'object' ? { reasons: Array.isArray(l.reasons) ? l.reasons.slice(0, 8).map(x => str(x, 60)).filter(Boolean) : [], level: str(l.level, 80) || null, side: ['LEFT', 'RIGHT', 'BOTH'].includes(l.side) ? l.side : null, ...(l.alt ? { alt: 'support' } : {}) } : undefined);
  const poses = pick(r.poses, p => p && typeof p === 'object' && Number.isInteger(p.n) && p.n > 0 && p.n < 20000 && typeof p.t === 'string' && typeof p.d === 'string' ? { n: p.n, t: p.t, d: p.d, w: typeof p.w === 'string' ? p.w : null } : undefined);
  const setup = r.setup && typeof r.setup === 'object' ? { bodyFrac: n(r.setup.bodyFrac), w: n(r.setup.w), h: n(r.setup.h), back: !!r.setup.back } : {};
  return { ...base, protocol, quality: pick(r.quality, v => n(v) !== undefined ? Math.max(0, Math.min(100, Math.round(v))) : undefined), limits, pain: pick(r.pain, v => n(v) !== undefined ? Math.max(0, Math.min(10, Math.round(v))) : undefined), poses, setup };
}
async function addResult(c, r) {
  r = cleanRemote(r); const prev = (await byClient(c.id)).at(-1); const tpl = TEMPLATES.find(t => t[2].join() === (r.protocol || []).join());
  const a = { id: uid(), clientId: c.id, date: r.date || Date.now(), template: tpl ? tpl[0] : 'custom', templateName: 'Дома · ' + (tpl ? tpl[1] : 'свой протокол'), protocol: r.protocol, snapshot: r.snapshot, side: r.side, moves: r.moves, quality: r.quality, setup: r.setup,
    limits: r.limits || {}, pain: r.pain || {}, hyp: {}, plan: null, note: '', nextDate: (r.date || Date.now()) + 30 * DAY, prevId: prev ? prev.id : null, draft: true, source: 'home' };
  await put('assessments', a); await put('poses', { assessmentId: a.id, poses: r.poses || {} });
}
/** Личный «почтовый ящик» специалиста для ссылки новому клиенту. */
async function inbox() { let b = await meta('inbox'); if (!b) { b = { id: seal.rid(), key: await seal.key() }; await setMeta('inbox', b); } return b; }
async function sendJoin() {
  if (!gate('invite')) return;
  let tpl = TEMPLATES[0]; const d = document.createElement('div'); d.className = 'sheet';
  const draw = () => { d.innerHTML = `<div><h2 style="font-size:20px">Ссылка новому клиенту</h2><p class="sub" style="font-size:14px;margin-top:6px">Клиент сам заполнит имя и анкету, пройдет тест, и у тебя появится его карточка с результатом и записью движения. Одну ссылку можно отправлять разным людям.</p>
    <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${TEMPLATES.map(t => `<button class="pill" data-t="${t[0]}" style="border:1.5px solid ${tpl[0] === t[0] ? 'var(--navy)' : 'transparent'}">${t[1]}</button>`).join('')}</div>
    <p class="sub" style="font-size:13px;margin-top:8px">${rowsOf(tpl[2]).length} шагов · около ${mins(SETUP_SEC + secs(rowsOf(tpl[2])))} мин + анкета</p>
    <button class="btn" id="snd" style="margin-top:14px">Отправить ссылку</button><button class="btn ghost" id="cx" style="margin-top:8px;border:0">Отмена</button></div>`;
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = TEMPLATES.find(t => t[0] === b.dataset.t); draw(); });
    d.querySelector('#cx').onclick = () => d.remove();
    d.querySelector('#snd').onclick = async () => { const bx = await inbox(), author = (await meta('profile')) || defaultAuthor();
      const url = location.origin + '/#join=' + seal.pack({ i: bx.id, k: bx.key, s: author, p: tpl[2] });
      const text = 'Здравствуйте! Пройдите, пожалуйста, тест движения по ссылке: короткая анкета и 2–4 минуты перед камерой. Результат сразу придет мне.';
      if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url); alert('Ссылка скопирована'); } d.remove(); }; };
  draw(); document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
}
/** Забирает новые результаты с сервера (по ссылкам клиентам и по общей ссылке), расшифровывает и кладет в карточки. */
export async function pullResults() {
  const clients = (await all('clients')).filter(c => c.invite); const bx = await meta('inbox');
  const ids = clients.map(c => c.invite.id).concat(bx ? [bx.id] : []); if (!ids.length) return [];
  let data; try { data = await (await fetch('/api/relay?ids=' + ids.join(','), { cache: 'no-store' })).json(); } catch (e) { return []; }
  const got = [], done = p => fetch('/api/relay?p=' + encodeURIComponent(p), { method: 'DELETE' }).catch(() => {});
  for (const c of clients) for (const item of (data[c.invite.id] || [])) {
    let r; try { r = await seal.decrypt(c.invite.key, item.data); } catch (e) { done(item.p); continue; } // не расшифровывается этим ключом: мусор, иначе он занимает лимит ссылки
    try { await addResult(c, r); got.push(c.name); done(item.p); } catch (e) { console.warn('relay item', e); } }
  if (bx) for (const item of (data[bx.id] || [])) {
    let m; try { m = await seal.decrypt(bx.key, item.data); } catch (e) { done(item.p); continue; }
    try { const p0 = m.profile && typeof m.profile === 'object' ? m.profile : {}, pr = { name: str(p0.name, 40), surname: str(p0.surname, 60), dob: /^\d{4}-\d{2}-\d{2}$/.test(p0.dob) ? p0.dob : '', sex: ['M', 'F'].includes(p0.sex) ? p0.sex : '', height: /^\d{2,3}$/.test(p0.height) ? p0.height : '', hand: ['R', 'L'].includes(p0.hand) ? p0.hand : '', activity: str(p0.activity, 120), complaints: str(p0.complaints, 1000) };
      if (typeof m.token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(m.token)) m.token = null;
      // тот же человек по общей ссылке повторно — в ту же карточку
      let c = m.token && (await all('clients')).find(x => x.remoteToken && x.remoteToken === m.token);
      if (!c) c = { id: uid(), created: Date.now(), remoteToken: m.token, notes: '' };
      Object.assign(c, { name: [pr.name, pr.surname].filter(Boolean).join(' ') || 'Без имени', dob: pr.dob || c.dob || '', sex: pr.sex || c.sex || '', height: pr.height || c.height || '', hand: pr.hand || c.hand || 'R', leg: pr.hand || c.leg || 'R', activity: pr.activity || c.activity || '', complaints: pr.complaints || c.complaints || '' });
      if (!m.result || typeof m.result !== 'object') throw new Error('no result');
      await put('clients', c); await addResult(c, m.result); got.push(c.name); done(item.p); } catch (e) { console.warn('inbox item', e); } }
  return got;
}

// =================== Просмотр записи движения: схема и объемная фигура ===================
function unpackWorld(pk) { if (!pk || !pk.w) return null; const d = new Int16Array(b64u8(pk.w).buffer), out = [];
  for (let i = 0; i < pk.n; i++) { const p = []; for (let j = 0; j < 33; j++) { const o = i * 99 + j * 3; p.push({ x: d[o] / 1000, y: d[o + 1] / 1000, z: d[o + 2] / 1000 }); } out.push(p); } return out; }
/** Усиление отклонений для наглядности: отклонение колена от линии таз–стопа и смещение плеч над тазом ×k. */
function exaggerate(p, k) {
  if (k === 1) return p; const q = p.map(l => ({ ...l }));
  for (const [h, kn, a] of [[23, 25, 27], [24, 26, 28]]) { const t = Math.max(0, Math.min(1, (q[kn].y - q[h].y) / ((q[a].y - q[h].y) || 1e-6)));
    const lx = q[h].x + (q[a].x - q[h].x) * t, lz = (q[h].z ?? 0) + ((q[a].z ?? 0) - (q[h].z ?? 0)) * t; q[kn].x = lx + (q[kn].x - lx) * k; if (q[kn].z != null) q[kn].z = lz + (q[kn].z - lz) * k; }
  const hx = (q[23].x + q[24].x) / 2, sx = (q[11].x + q[12].x) / 2, dx = (sx - hx) * (k - 1);
  for (const j of [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16]) q[j].x += dx;
  return q;
}
export async function motionViewer(poses, setup, back, titleText) {
  const keys = Object.keys(poses || {}).filter(k => poses[k] && poses[k].n); if (!keys.length) { alert('В этой оценке нет записи движения'); return back(); }
  let key = keys.includes('ohs_front') ? 'ohs_front' : keys[0], mode = 'flat', amp = 1, speed = 1, k = 0, playing = true, raf = 0, v3 = null;
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><div style="flex:1"><b style="font-size:17px">Запись движения</b><div style="font-size:13px;color:var(--muted)">${esc(titleText || '')}</div></div></div>
   <div class="pad"><div class="row" style="gap:6px;flex-wrap:wrap">${keys.map(x => `<button class="pill" data-k="${esc(x)}" style="border:1.5px solid ${x === key ? 'var(--navy)' : 'transparent'}">${esc(QNAMES[x] || UNIT_NAMES[x] || x)}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px;gap:8px"><div class="seg" style="flex:1"><button id="m2" class="on">Схема</button><button id="m3">3D-фигура</button></div></div>
    <div class="card" style="margin-top:10px;padding:10px"><div id="stage" style="width:100%;height:380px;position:relative"><canvas id="cv" style="width:100%;height:100%;display:block"></canvas></div>
     <div class="row" style="margin-top:8px"><button class="round" id="pp" style="background:var(--lime)">❚❚</button><input type="range" id="ph" min="0" max="1000" value="0" style="flex:1;accent-color:#1E2533"></div>
     <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="pill" id="sp" style="font-size:12px">Скорость 1×</button><button class="pill" id="am" style="font-size:12px">Подчеркнуть отклонения</button><span id="amn" style="font-size:12px;color:var(--coral)"></span></div>
     <p style="font-size:12px;color:var(--muted);margin-top:8px" id="note"></p></div></div></div>`);
  let fr2 = [], fr3 = null, dur = 1;
  const load = () => { const pk = poses[key]; fr2 = normalize(unpack(pk, setup && setup.w, setup && setup.h)); fr3 = unpackWorld(pk); dur = Math.max(1, fr2.length ? fr2.at(-1).t : 1);
    $('#note').textContent = mode === '3d' && !fr3 ? 'Для этой записи нет объемных данных: фигура построена по плоской записи.' : 'Скелет выровнен по стопам и росту. Скорость реальная.'; };
  const frameAt = () => { const i = Math.min(fr2.length - 1, Math.round(k * (fr2.length - 1))); return i; };
  const draw2 = () => { const cv = $('#cv'); if (!cv) return; const ctx = cv.getContext('2d'), W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, W, H); const f = fr2[frameAt()]; if (!f) return; const p = exaggerate(f.p, amp), sc = H / 1.6, ox = W / 2, oy = H * .94, P = l => [ox + l.x * sc, oy + l.y * sc];
    ctx.strokeStyle = '#E0D8CA'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
    ctx.lineCap = 'round'; for (const [i, j] of BONES) { if (p[i].v < .3 || p[j].v < .3) continue; ctx.strokeStyle = [25, 26, 23, 24].includes(i) || [25, 26].includes(j) ? '#E8765A' : '#1E2533'; ctx.lineWidth = 7 * devicePixelRatio; ctx.beginPath(); ctx.moveTo(...P(p[i])); ctx.lineTo(...P(p[j])); ctx.stroke(); }
    ctx.fillStyle = '#C6E84B'; for (const j of [11, 12, 13, 14, 23, 24, 25, 26, 27, 28]) { ctx.beginPath(); ctx.arc(...P(p[j]), 6 * devicePixelRatio, 0, 7); ctx.fill(); }
    const h = P(p[0]); ctx.strokeStyle = '#1E2533'; ctx.lineWidth = 5 * devicePixelRatio; ctx.beginPath(); ctx.arc(h[0], h[1], sc * .05, 0, 7); ctx.stroke(); };
  const loop = () => { if (!document.getElementById('stage')) return; if (playing) { k = (k + (1 / 60) * speed / dur) % 1; $('#ph').value = Math.round(k * 1000); }
    if (mode === 'flat') draw2(); else if (v3) v3.set(frameAt()); raf = requestAnimationFrame(loop); };
  const open3d = async () => { const THREE = await import('three'); const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const stage = $('#stage'); stage.innerHTML = ''; const W = stage.clientWidth, H = stage.clientHeight;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xF3EEE6); scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 2); scene.add(dl);
    const grid = new THREE.GridHelper(2, 10, 0xCDBFA9, 0xE0D8CA); grid.position.y = -1; scene.add(grid);
    const camera = new THREE.PerspectiveCamera(35, W / H, .05, 20); camera.position.set(0, 0, 3.4);
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(W, H); stage.appendChild(r.domElement);
    const ctl = new OrbitControls(camera, r.domElement); ctl.enablePan = true; ctl.zoomToCursor = true; ctl.enableDamping = true;
    const matB = new THREE.MeshStandardMaterial({ color: 0x1E2533, roughness: .6 }), matL = new THREE.MeshStandardMaterial({ color: 0xE8765A, roughness: .6 }), matJ = new THREE.MeshStandardMaterial({ color: 0xC6E84B, roughness: .4 });
    const SEG = [...BONES.filter(([i, j]) => j <= 28), ['ms', 'mh'], [0, 'ms']];
    const limbs = SEG.map(([i, j]) => { const leg = [23, 24, 25, 26].includes(i); const m = new THREE.Mesh(new THREE.CylinderGeometry(leg ? .045 : .035, leg ? .04 : .03, 1, 12), leg ? matL : matB); scene.add(m); return { i, j, m }; });
    const joints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map(j => { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), matJ); scene.add(m); return { j, m }; });
    const head = new THREE.Mesh(new THREE.SphereGeometry(.11, 24, 16), matB); scene.add(head);
    const up = new THREE.Vector3(0, 1, 0);
    // точки кадра в координатах сцены: 3D-запись (метры) или плоская запись, рост = 1.7 м
    const pts = i => { let p;
      if (fr3) { p = exaggerate(fr3[Math.min(fr3.length - 1, i)], amp).map(l => new THREE.Vector3(l.x, -l.y, -l.z)); }
      else { p = exaggerate(fr2[i].p, amp).map(l => new THREE.Vector3(l.x * 1.7, -l.y * 1.7 - 0, 0)); }
      const mid = (a, b) => a.clone().add(b).multiplyScalar(.5); const ms = mid(p[11], p[12]), mh = mid(p[23], p[24]);
      const foot = Math.min(p[27].y, p[28].y, p[31] ? p[31].y : 9); const shift = new THREE.Vector3(-mh.x, -1 - foot, -mh.z);
      const g = x => (x === 'ms' ? ms : x === 'mh' ? mh : p[x]).clone().add(shift); return g; };
    const set = i => { const g = pts(i);
      for (const L of limbs) { const a = g(L.i), b = g(L.j), d = b.clone().sub(a), len = d.length(); L.m.position.copy(a.clone().add(b).multiplyScalar(.5)); L.m.scale.set(1, Math.max(.001, len), 1); L.m.quaternion.setFromUnitVectors(up, d.normalize()); }
      for (const J of joints) J.m.position.copy(g(J.j)); const hp = g(0); head.position.copy(hp); };
    let alive = true; const dispose = () => { if (!alive) return; alive = false; ctl.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); [matB, matL, matJ].forEach(x => x.dispose()); r.dispose(); try { r.forceContextLoss(); } catch (e) {} };
    // ушли с экрана: освобождаем WebGL, иначе после нескольких просмотров браузер упирается в лимит контекстов
    ctl.target.set(0, -.1, 0); (function a() { if (!alive) return; if (!r.domElement.isConnected) return dispose(); ctl.update(); r.render(scene, camera); requestAnimationFrame(a); })();
    return { set, dispose }; };
  load();
  $('#back').onclick = () => { cancelAnimationFrame(raf); if (v3) v3.dispose(); back(); };
  $('#pp').onclick = () => { playing = !playing; $('#pp').textContent = playing ? '❚❚' : '▶'; };
  $('#ph').oninput = e => { playing = false; $('#pp').textContent = '▶'; k = e.target.value / 1000; };
  $('#sp').onclick = () => { speed = speed === 1 ? .5 : speed === .5 ? .25 : 1; $('#sp').textContent = `Скорость ${String(speed).replace('.', ',')}×`; };
  $('#am').onclick = () => { amp = amp === 1 ? 2 : 1; $('#am').style.borderColor = amp > 1 ? 'var(--coral)' : 'transparent'; $('#amn').textContent = amp > 1 ? 'Колени и наклон корпуса усилены ×2 для наглядности' : ''; };
  $('#m2').onclick = () => { if (mode === 'flat') return; mode = 'flat'; $('#m2').classList.add('on'); $('#m3').classList.remove('on'); if (v3) v3.dispose(); v3 = null; $('#stage').innerHTML = '<canvas id="cv" style="width:100%;height:100%;display:block"></canvas>'; load(); };
  $('#m3').onclick = async () => { if (mode === '3d') return; mode = '3d'; $('#m3').classList.add('on'); $('#m2').classList.remove('on'); load(); v3 = await open3d(); };
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => { key = b.dataset.k; k = 0; document.querySelectorAll('[data-k]').forEach(x => x.style.borderColor = x === b ? 'var(--navy)' : 'transparent'); load(); if (mode === '3d') { if (v3) v3.dispose(); v3 = await open3d(); } });
  loop();
}
export const consumerPoses = { save: p => put('poses', { assessmentId: 'consumer-last', poses: p }), get: async () => (await get('poses', 'consumer-last'))?.poses, clear: () => del('poses', 'consumer-last') };

/** Повторяемость: показатели трех последних оценок, разброс сравнивается с погрешностью съемки. */
async function repeatability(list, clientId) {
  if (!gate('repeat')) return;
  const fs = list.map(a => analyze(a, C).f);
  const rows = METRICS.map(([k, n, u, thr]) => { const v = fs.map(f => f[k]).filter(Number.isFinite).map(Math.abs); if (v.length < 2) return null;
    const range = Math.max(...v) - Math.min(...v); return { n, u, v, range, ok: range <= thr, thr }; }).filter(Boolean);
  const okN = rows.filter(r => r.ok).length;
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><div style="flex:1"><b style="font-size:17px">Повторяемость</b><div style="font-size:13px;color:var(--muted)">${list.map(a => fmtDate(a.date)).join(' · ')}</div></div></div>
   <div class="pad"><div class="card" style="background:${okN === rows.length ? 'var(--okS)' : 'var(--shortS)'}"><b>Стабильно: ${okN} из ${rows.length} показателей</b><div style="font-size:13px;color:var(--sub);margin-top:4px">Стабильно — разброс между тестами не больше погрешности съемки. Для проверки сделай 3 теста подряд с той же постановкой телефона.</div></div>
   <div class="card" style="margin-top:10px">${rows.map(r => `<div class="row" style="margin-top:8px;font-size:14px"><span style="flex:1">${r.n}</span><span style="font-variant-numeric:tabular-nums;font-size:13px">${r.v.map(x => fmt(x) + r.u).join(' / ')}</span><span class="badge" style="margin-left:8px;background:${r.ok ? 'var(--okS)' : 'var(--hyperS)'};color:${r.ok ? 'var(--green)' : '#E5484D'}">±${fmt(r.range / 2)}${r.u}</span></div>`).join('') || '<p class="sub">Нет общих показателей.</p>'}</div></div></div>`);
  $('#back').onclick = () => clientCard(clientId);
}
