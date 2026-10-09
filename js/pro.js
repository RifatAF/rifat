// Кабинет специалиста: клиенты, оценки по протоколам, три слоя результата, резервная копия.
// Все данные в IndexedDB на телефоне специалиста; на сервер ничего не уходит.
import { analyze, fmt, recompute } from './analysis.js';
import { track } from './track.js';
import { npsCard, bindNps, installCard, bindInstall, feedbackSheet, referralSheet, myRef, bugSheet } from './grow.js';
import { meSync, logout, getMe } from './auth.js';
import { scoreSpot, LABELS, BAND_NAMES, RULE_NAMES, RESEARCH } from './evidence.js';
import { gate, planLine, plan as tariff, SPECIALTIES, TEMPLATE_ORDER, START_CLIENTS } from './plans.js';
import { C, voice, cam, startMotion, initPose, prefetchPose, drawHeat, RAMP_CSS, device, seal, body3D, ic, toast } from './core.js';
import { cleanResult, verdict, verdictCard, ntitle, SHORT, passportImage, LIMIT_NAMES, stepList, bindStepList, go, spots, title, tech, TONE, TONE_HEX, TONE_TEXT_HEX, toneText, plan, ex, totalMin, workout, onboarding, UNITS, sortUnits, rowsOf, secs, mins, SETUP_SEC, runProtocol, funnelScreen } from './app.js';

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
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'клиент' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'клиента' : 'клиентов';
const countClients = d => new Promise(r => { try { const q = d.transaction('clients').objectStore('clients').getAll(); q.onsuccess = () => r((q.result || []).filter(c => !c.demo).length); q.onerror = () => r(0); } catch (e) { r(0); } });
// вход через Google и через Telegram — разные аккаунты и разные базы; если текущая пуста, а на телефоне есть другая с клиентами, предлагаем скопировать
async function otherDb() {
  const me = nameFor(); if (me === LEGACY || localStorage.getItem('bp_other_' + me) || !indexedDB.databases) return null;
  const list = (await indexedDB.databases()).map(x => x.name).filter(n => n && n !== me && n.startsWith(LEGACY + '-') && !n.endsWith('-snap'));
  if (!list.length || (await countClients(await db()))) return null;
  for (const name of list) { const d = await openDb(name); const n = await countClients(d); d.close();
    if (n) { const id = name.slice(LEGACY.length + 1); return { name, n, via: id.startsWith('t_') ? 'Telegram' : id.startsWith('g_') ? 'Google' : 'другой аккаунт' }; } }
  return null;
}
async function copyDb(name) {
  const src = await openDb(name), dst = await db();
  for (const st of ['clients', 'assessments', 'poses', 'meta']) {
    const rows = await new Promise(r => { const q = src.transaction(st).objectStore(st).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
    await new Promise((ok, no) => { const t = dst.transaction(st, 'readwrite'); const o = t.objectStore(st); rows.forEach(x => o.put(x)); t.oncomplete = ok; t.onerror = () => no(t.error); });
  }
  src.close();
}
// закреплено ли хранилище (браузер не сотрет при нехватке места) и риск iOS: Safari чистит данные сайта без установки через 7 дней
async function storageCheck() {
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let persisted = false, quota = null;
  try { if (navigator.storage) { persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false; if (!persisted && navigator.storage.persist) persisted = await navigator.storage.persist();
    if (navigator.storage.estimate) quota = Math.round((await navigator.storage.estimate()).quota / 1048576); } } catch (e) {}
  if (!sessionStorage.getItem('bp_st')) { sessionStorage.setItem('bp_st', '1'); track('storage', { c: (persisted ? 'закреплено' : 'не закреплено') + (ios ? (standalone ? ' iOS-PWA' : ' iOS-Safari') : ''), n: quota || 0 }, false); }
  return { persisted, ios, standalone };
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
// зона боли в пояснице по шаблону (ТЗ v2.1): LOW, MID, UPPER
const LUMBAR = { low_back: 'LOW', low_back_mid: 'MID', low_back_up: 'UPPER' };
export const TEMPLATES = [
  // шаблоны по жалобе сокращены до 3–4 тестов (ТЗ v2.1, раздел 5): каждая лишняя метрика добавляет шум
  ['knee', 'Колено', ['stand', 'ohs_front', 'sls', 'profile']],
  ['low_back', 'Поясница, низ', ['stand', 'ohs_front', 'profile']],
  ['low_back_mid', 'Поясница, середина', ['stand', 'ohs_front', 'profile', 'sls']],
  ['low_back_up', 'Поясница, верх', ['stand', 'ohs_front', 'profile', 'bends']],
  ['neck', 'Шея и плечи', ['stand', 'thold', 'profile']],
  // шаблон «Бег» убран до появления анализа бега: стойка и присед не равны бегу (фокус-группа, тренер по бегу)
  ['full', 'Полный', ['stand', 'ohs_front', 'sls', 'thold', 'bends', 'calf', 'side', 'back']],
  ['screen', 'Первичный скрининг', ['stand', 'ohs_front', 'sls', 'side']],
  ['posture', 'Осанка до и после сеанса, 1 мин', ['stand', 'bends', 'profile']],
];
// шаблоны в порядке, удобном для специализации: первый открывается по умолчанию
function orderTemplates(sp) { const o = TEMPLATE_ORDER[sp]; if (o) TEMPLATES.sort((a, b) => o.indexOf(a[0]) - o.indexOf(b[0])); }
// профиль специалиста: имя для шапки и отчетов, контакт для записи в отчете клиенту
async function profileForm() {
  const name = (await meta('profile')) || defaultAuthor(), contact = (await meta('contact')) || '', logo = (await meta('logo')) || '';
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:18px">Мой профиль</b></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:14px;margin-top:8px">
    <label><b>Имя и специальность</b><input id="pn" value="${esc(name)}" placeholder="Анна Смирнова, персональный тренер" class="field" style="margin-top:8px"></label>
    <label><b>Контакт для записи</b><input id="pc" value="${esc(contact)}" placeholder="@telegram, телефон или сайт" class="field" style="margin-top:8px"></label>
    <div><b>Логотип для отчета</b><div class="row" style="gap:12px;margin-top:8px"><div id="lgv" style="width:64px;height:64px;border-radius:14px;background:var(--surface);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none">${logo ? `<img src="${logo}" alt="" style="max-width:100%;max-height:100%">` : ic('image', 's')}</div>
      <label class="btn line" style="height:48px;flex:1;cursor:pointer">${logo ? 'Заменить' : 'Загрузить'}<input type="file" id="lgf" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="display:none"></label>${logo ? '<button class="btn ghost" id="lgx" style="height:48px;width:auto;padding:0 14px">Убрать</button>' : ''}</div></div>
    <p class="sub" style="font-size:13px">Имя, контакт и логотип появятся в отчете клиенту (картинка и PDF), который он сохранит и покажет друзьям.</p>
   </div><div class="pad" style="padding:20px"><button class="btn" id="ps">Сохранить</button></div></div>`);
  $('#back').onclick = () => proHome();
  $('#ps').onclick = async () => { await setMeta('profile', $('#pn').value.trim().slice(0, 80) || defaultAuthor()); await setMeta('contact', $('#pc').value.trim().slice(0, 60)); proHome(); };
  // логотип ужимается до 256 px и хранится в кабинете как PNG: попадает в копию и в отчеты, на сервер не уходит
  $('#lgf').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 5e6) return toast('Файл больше 5 МБ');
    try { const url = URL.createObjectURL(f), im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 256 / Math.max(im.width || 256, im.height || 256)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round((im.width || 256) * k)); c.height = Math.max(1, Math.round((im.height || 256) * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      await setMeta('profile', $('#pn').value.trim().slice(0, 80) || defaultAuthor()); await setMeta('contact', $('#pc').value.trim().slice(0, 60));
      await setMeta('logo', c.toDataURL('image/png')); toast('Логотип сохранен'); profileForm(); } catch (err) { toast('Не удалось прочитать картинку'); } };
  if ($('#lgx')) $('#lgx').onclick = async () => { await setMeta('logo', ''); profileForm(); };
}
// пример клиента: специалист видит результат до первой своей съемки
async function openDemo() {
  const now = Date.now(), d0 = now - 34 * DAY, d1 = now - 2 * DAY;
  const base = { protocol: ['stand', 'ohs_front', 'sls', 'side'], full: true, quality: {}, limits: {}, setup: {}, template: 'knee', templateName: 'Колено', pain: { knee: 4 }, plan: null, note: '', draft: false };
  const m0 = { snapshot: { shoulderTilt: 5.2, pelvicTilt: -4.6, headTilt: 1, trunkLateral: 1.5 }, side: { headForwardDeg: 21, kneeHyperDeg: 2, shoulderShift: .01, hipShift: 0 },
    moves: { ohs_front: { quality: 'GOOD', f: { ohs_valgus_r: 14, ohs_valgus_l: 5 } }, sls_r: { quality: 'GOOD', f: { sls_drop_r: 6, sls_valgus_r: 13, sls_trunk_r: 3 } }, sls_l: { quality: 'GOOD', f: { sls_drop_l: 1, sls_valgus_l: 4, sls_trunk_l: 1 } } } };
  const m1 = { snapshot: { shoulderTilt: 3.1, pelvicTilt: -2.2, headTilt: .8, trunkLateral: 1 }, side: { headForwardDeg: 11, kneeHyperDeg: 2, shoulderShift: .01, hipShift: 0 },
    moves: { ohs_front: { quality: 'GOOD', f: { ohs_valgus_r: 11, ohs_valgus_l: 5 } }, sls_r: { quality: 'GOOD', f: { sls_drop_r: 3, sls_valgus_r: 4, sls_trunk_r: 2 } }, sls_l: { quality: 'GOOD', f: { sls_drop_l: 1, sls_valgus_l: 4, sls_trunk_l: 1 } } } };
  await put('clients', { id: 'demo', demo: true, created: d0, name: 'Пример: Олег, боль в колене', first: 'Олег', last: '', dob: '1985-03-12', sex: 'M', height: '180', leg: 'R', hand: 'R', activity: 'офис, бег 2 раза в неделю', complaints: 'Ноет правое колено после бега', notes: 'Демо-клиент: удалите, когда будет не нужен' });
  await put('assessments', { id: 'demo-1', clientId: 'demo', date: d0, ...base, ...m0, hyp: {}, check: {}, expect: 'Справа слабая средняя ягодичная, колено уходит внутрь', expectMatch: 'yes', nextDate: d0 + 30 * DAY, prevId: null });
  await put('assessments', { id: 'demo-2', clientId: 'demo', date: d1, ...base, ...m1, pain: { knee: 1 }, hyp: {}, check: {}, nextDate: d1 + 30 * DAY, prevId: 'demo-1' });
  await put('poses', { assessmentId: 'demo-1', poses: [] }); await put('poses', { assessmentId: 'demo-2', poses: [] });
  clientCard('demo');
}
async function specialtyScreen(after) {
  go(`<div class="scr fade"><div class="pad" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div><div class="pad" style="padding-top:8px"><div class="eyebrow">Кабинет специалиста</div><h1 style="margin-top:8px">Кто вы?</h1>
    <p class="sub" style="margin-top:6px">Под специализацию подстроим протоколы теста. Поменять можно в меню кабинета.</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-bottom:30px">${SPECIALTIES.map(([k, t, d]) => `<button class="list-item" data-sp="${k}" style="background:#fff;text-align:left;font:inherit;color:inherit"><div style="flex:1"><b style="font-size:15px">${t}</b><div class="sub" style="font-size:13px;margin-top:2px">${d}</div></div><span class="chev">›</span></button>`).join('')}</div></div>`);
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = async () => { const sp = b.dataset.sp; await setMeta('specialty', sp); localStorage.setItem('bp_sp', sp); orderTemplates(sp);
    fetch('/api/auth?a=profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specialty: sp }) }).catch(() => {});
    (after || proHome)(); });
  // назад: из меню кабинета возвращаемся в кабинет, при первом входе на знакомство
  $('#back').onclick = () => { if (after) return after(); localStorage.removeItem('bp_mode'); onboarding(); };
}
const QNAMES = { stand: 'Стойка', ohs_front: 'Присед лицом', sls_r: 'Правая нога', sls_l: 'Левая нога', thold: 'Руки в стороны', t_hold: 'Руки в стороны', bends: 'Наклоны', calf_r: 'Носок, правая', calf_l: 'Носок, левая', side_stand: 'Стойка боком', ohs_side: 'Присед боком', ohs_back: 'Присед спиной' };
const UNIT_NAMES = { profile: 'Стойка боком', stand: 'Стойка', ohs_front: 'Присед лицом', sls: 'На одной ноге', thold: 'Руки в стороны', bends: 'Наклоны', calf: 'На носок', side: 'Боком', back: 'Спиной' };
const PAIN = [['neck', 'Шея'], ['shoulder', 'Плечо'], ['upper_back', 'Грудной отдел'], ['low_back', 'Поясница'], ['hip', 'Таз, бедро'], ['knee', 'Колено'], ['foot', 'Стопа']];
let HYP3D = false; const REVEALED = new Set(); // «Итог» оценки анимируется при первом открытии
const seen2 = (an, s) => [...new Set(an.findings.filter(f => f.muscles.some(m => m.id === s.id && (m.side === s.side || m.side === 'BOTH'))).map(f => f.observed))]; // специалист смотрит гипотезу в 3D: режим сохраняется при правках
const STATES = [['OK', 'Норма', 0], ['HYPER', 'Перегрузка', .8], ['SHORT', 'Зажата', .7], ['WEAK', 'Слабость', -.8]];

// ---------- голосовая заметка (распознавание речи браузера) ----------
function dictate(textarea, btn) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { btn.textContent = 'Голосовой ввод не поддерживается'; return; }
  const r = new R(); r.lang = 'ru-RU'; r.interimResults = false; r.continuous = false;
  btn.textContent = 'Говори…'; r.onresult = e => { textarea.value = (textarea.value ? textarea.value + ' ' : '') + e.results[0][0].transcript; };
  r.onend = () => btn.textContent = 'Надиктовать'; r.onerror = () => btn.textContent = 'Надиктовать'; r.start();
}

// ---------- рабочий стол ----------
export async function proHome(query = '', pulled = null) {
  track('pro_open');
  localStorage.setItem('bp_mode', 'pro');
  const lc = await legacyCount().catch(() => 0);
  if (lc) { go(`<div class="scr pad fade" style="justify-content:center;gap:14px"><div class="eyebrow">Кабинет ${esc(meSync().name)}</div>
      <h1>На этом телефоне есть база без аккаунта</h1><p class="sub">${lc} ${lc % 10 === 1 && lc % 100 !== 11 ? 'клиент' : [2, 3, 4].includes(lc % 10) && ![12, 13, 14].includes(lc % 100) ? 'клиента' : 'клиентов'}, созданных до входа. Перенести их в ваш кабинет? Другие аккаунты их больше не увидят.</p>
      <button class="btn" id="lgy">Перенести ко мне</button><button class="btn ghost" id="lgn">Это не мои, начать с чистого</button></div>`);
    $('#lgy').onclick = async () => { $('#lgy').textContent = 'Переношу…'; await claimLegacy(true); proHome(); };
    $('#lgn').onclick = async () => { await claimLegacy(false); proHome(); }; return; }
  const other = await otherDb().catch(() => null);
  if (other) { track('db_other', { n: other.n }, false);
    go(`<div class="scr pad fade" style="justify-content:center;gap:14px"><div class="eyebrow">Кабинет ${esc(meSync().name)}</div>
      <h1>На этом телефоне есть кабинет другого входа</h1><p class="sub">${other.n} ${plural(other.n)}. Похоже, раньше вы входили через ${other.via}. Скопировать их в этот кабинет? Исходный кабинет останется как есть.</p>
      <button class="btn" id="oy">Скопировать ко мне</button><button class="btn ghost" id="on">Это не мой кабинет</button></div>`);
    $('#oy').onclick = async () => { $('#oy').textContent = 'Копирую…'; await copyDb(other.name); localStorage.setItem('bp_other_' + dbName, 'done'); toast('Скопировано клиентов: ' + other.n); proHome(); };
    $('#on').onclick = () => { localStorage.setItem('bp_other_' + dbName, 'no'); proHome(); }; return; }
  const sp = await meta('specialty'); if (!sp) return specialtyScreen(); localStorage.setItem('bp_sp', sp); orderTemplates(sp); getMe();
  // новые результаты пришли, пока специалист уже ушел в карточку: не выдергиваем его на главный экран
  if (pulled === null) pullResults().then(n => { if (n.length && document.getElementById('join') && document.getElementById('menu')) proHome(query, n); });
  prefetchPose(); const pst = await storageCheck();
  const [clients, asses] = await Promise.all([all('clients'), all('assessments')]);
  // кабинет внезапно пуст, хотя на этом телефоне в нем были клиенты: главный сигнал потери базы (iOS чистит данные сайтов)
  const realN = clients.filter(c => !c.demo).length, ck = 'bp_cnt_' + dbName, was = +(localStorage.getItem(ck) || 0);
  const lost = !realN && was > 0; if (lost && !sessionStorage.getItem(ck)) { sessionStorage.setItem(ck, '1'); track('db_empty', { n: was }, false); }
  if (realN) localStorage.setItem(ck, String(realN));
  const byId = Object.fromEntries(clients.map(c => [c.id, c]));
  const last = id => asses.filter(a => a.clientId === id).sort((x, y) => y.date - x.date)[0];
  // главный экран «Сегодня»: что посмотреть, кому ретест, последние клиенты
  const review = asses.filter(a => a.draft && byId[a.clientId] && !byId[a.clientId].demo).sort((x, y) => y.date - x.date).slice(0, 5);
  const soon = clients.map(c => ({ c, a: last(c.id) })).filter(x => x.a && x.a.nextDate && x.a.nextDate - Date.now() <= 7 * DAY).sort((x, y) => x.a.nextDate - y.a.nextDate);
  const q = query.trim().toLowerCase(); const sorted = clients.filter(c => !q || c.name.toLowerCase().includes(q)).sort((x, y) => (last(y.id)?.date || y.created) - (last(x.id)?.date || x.created));
  const list = q ? sorted : sorted.slice(0, 6);
  const lastBackup = await meta('lastBackup'); const needBackup = realN && (!lastBackup || Date.now() - lastBackup > 7 * DAY);
  const iosRisk = realN && pst.ios && !pst.standalone && !pst.persisted;
  const name = (await meta('profile')) || defaultAuthor();
  const own = asses.filter(a => byId[a.clientId] && !byId[a.clientId].demo), real = clients.filter(c => !c.demo);
  const spName = (SPECIALTIES.find(x => x[0] === sp) || ['', ''])[1].split(',')[0];
  const row = (c, sub) => `<div class="list-item" data-id="${c.id}" style="border-radius:0;padding:var(--s3) 0;background:transparent"><span class="avatar">${esc(c.name.slice(0, 1).toUpperCase())}</span><div style="flex:1;min-width:0"><b>${esc(c.name)}</b><div style="font-size:13px;color:var(--sub)">${sub}</div></div><span class="chev">${ic('chevron-right', 's')}</span></div>`;
  const h3 = (t, n) => `<h3 class="pad" style="margin:var(--s5) 0 var(--s2)">${t}${n ? ` <span style="color:var(--sub);font-weight:500">${n}</span>` : ''}</h3>`;
  const today = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });
  // три цифры под роль: значение, требующее действия, — чернилами; ноль — бледным
  const d30 = Date.now() - 30 * DAY, checks = own.filter(a => a.date > d30).flatMap(a => Object.values(a.check || {}));
  const kv = ({ kinesio: [['посмотреть', review.length], ['ретеста на неделе', soon.length], ['гипотез подтверждено', checks.length ? Math.round(checks.filter(x => x === 'yes').length / checks.length * 100) + '%' : '—']],
    trainer: [['посмотреть', review.length], ['ретеста на неделе', soon.length], ['клиентов', real.length]],
    manual: [['посмотреть', review.length], ['сеансов за неделю', own.filter(a => a.template === 'posture' && a.date > Date.now() - 7 * DAY).length], ['до/после сделано', own.filter(a => a.templateName === 'После сеанса').length]],
    sport: [['посмотреть', review.length], ['ретеста на неделе', soon.length], ['асимметрий > 12%', real.filter(c => { const a = last(c.id); if (!a) return false; const f = analyze(a, C).f; return ['sym_delt', 'sym_bend', 'sym_calf', 'sym_quad'].some(k => Array.isArray(f[k]) && Math.abs(f[k][0] - f[k][1]) / Math.max(1e-6, Math.abs(f[k][0]), Math.abs(f[k][1])) > .12); }).length]] })[sp] || [['посмотреть', review.length], ['ретеста на неделе', soon.length], ['клиентов', real.length]];
  go(`<div class="scr fade"><div style="padding-top:16px">
    <div class="pad row" style="align-items:flex-start"><div style="flex:1;min-width:0"><div style="font-size:13px;color:var(--sub)">${esc(name)}${spName ? ' · ' + esc(spName.toLowerCase()) : ''}</div><h1>Сегодня</h1><div style="font-size:14px;color:var(--sub);margin-top:2px">${today[0].toUpperCase() + today.slice(1)}</div></div><button class="round" id="menu" aria-label="Меню">${ic('menu')}</button></div>
    ${real.length ? `<div class="pad kpi" style="margin-top:var(--s4)">${kv.map(([t, v]) => `<div><b style="color:${v && v !== '—' && v !== '0%' ? 'var(--ink)' : 'var(--faint)'}">${v}</b><span>${t}</span></div>`).join('')}</div>` : ''}
    <div class="pad tools" style="margin-top:var(--s2)"><button class="tool" id="join">${ic('mail')}Тест по ссылке</button><button class="tool" id="rtq">${ic('rotate-ccw')}Ретест</button><button class="tool" id="repq">${ic('file-text')}Отчёт</button><button class="tool" id="cmpq">${ic('arrow-right-left')}Было→стало</button></div>
    ${review.length ? h3('Нужно посмотреть', review.length) + `<div class="pad"><div class="group">${review.map(a => `<div class="list-item" data-a="${a.id}" style="border-radius:0;padding:var(--s3) 0;background:transparent"><span class="dot"></span><div style="flex:1;min-width:0"><b>${esc(byId[a.clientId].name)}</b><div style="font-size:13px;color:var(--sub)">${a.source === 'home' ? 'прошёл тест по ссылке' : 'гипотеза не подтверждена'} · ${esc(a.templateName || 'оценка')} · ${fmtDate(a.date)}</div></div><span class="chev">${ic('chevron-right', 's')}</span></div>`).join('')}</div></div>` : ''}
    ${soon.length ? h3('Ретесты', soon.length) + `<div class="pad"><div class="group">${soon.map(({ c, a }) => { const d = Math.ceil((a.nextDate - Date.now()) / DAY);
      return `<div class="row" style="min-height:64px"><span class="step-n" style="width:56px;color:${d < 0 ? 'var(--over-t)' : 'var(--sub)'}">${d < 0 ? '−' + (-d) + ' дн.' : d === 0 ? 'сегодня' : '+' + d + ' дн.'}</span><div style="flex:1;min-width:0;cursor:pointer" data-id="${c.id}"><b>${esc(c.name)}</b><div style="font-size:13px;color:var(--sub)">${fmtDate(a.nextDate)}</div></div><button class="pill" data-msg="${c.id}">Напомнить</button></div>`; }).join('')}</div></div>` : ''}
    ${h3(q ? 'Поиск' : 'Последние клиенты', clients.length > list.length && !q ? 'из ' + clients.length : '')}
    ${clients.length > 6 || q ? `<div class="pad" style="margin-bottom:var(--s2)"><input id="q" class="field" style="height:48px" value="${esc(query)}" placeholder="Найти клиента"></div>` : ''}
    <div class="pad">${list.length ? `<div class="group">${list.map(c => { const a = last(c.id); return row(c, a ? fmtDate(a.date) + ' · ' + esc(a.templateName || 'оценка') : 'оценок пока нет'); }).join('')}</div>`
      : q ? '<p class="sub">Никого не нашлось.</p>' : `<div class="card empty">${ic('file-text')}<b>Посмотрите, что получите</b><span class="sub" style="font-size:14px">Готовая оценка клиента с болью в колене: замер, гипотеза, решение и отчет.</span><button class="btn line" id="demo" style="margin-top:4px">Открыть пример</button></div>`}</div>
    ${lost ? `<div class="pad" style="margin-top:var(--s3)"><div class="card" style="border:1px solid var(--over-t);font-size:14px;line-height:1.45"><b>Кабинет пуст, хотя здесь было ${was} ${plural(was)}</b><div style="margin-top:6px">Телефон мог очистить данные сайта. Восстановите кабинет из копии через меню «Восстановить из копии». Если копии нет, напишите нам через «Проблема?».</div></div></div>` : ''}
    ${iosRisk ? `<div class="pad" style="margin-top:var(--s3)"><div class="card" style="font-size:14px;line-height:1.45"><b>Защитите базу клиентов</b><div style="margin-top:6px">Safari на iPhone может стереть кабинет, если не открывать его неделю. Установите приложение на экран «Домой»: «Поделиться» → «На экран Домой», и раз в неделю сохраняйте копию.</div><button class="btn line" id="bk2" style="height:44px;margin-top:10px">Сохранить копию сейчас</button></div></div>` : ''}
    ${needBackup ? `<div class="pad" style="margin-top:var(--s3)"><button class="link" id="bk" style="width:100%;color:var(--sub);font-weight:500;font-size:13px">Клиенты хранятся только на этом телефоне · <u>сохранить копию с паролем</u></button></div>` : ''}
    ${list.length ? installCard() : ''}
  </div><div class="dock"><button class="btn" id="new">${ic('plus', 's')}${({ trainer: 'Скрининг клиента', manual: 'До сеанса', sport: 'Спортивный тест' })[sp] || 'Новая оценка'}</button></div></div>`);
  if (pulled && pulled.length) toast('Пришли результаты по ссылке: ' + pulled.join(', '));
  if ($('#demo')) $('#demo').onclick = openDemo;
  bindInstall();
  $('#new').onclick = () => quickStart(); $('#join').onclick = sendJoin; $('#menu').onclick = proMenu; if ($('#bk')) $('#bk').onclick = backup; if ($('#bk2')) $('#bk2').onclick = backup;
  // инструменты в одно касание: клиент один — сразу действие, иначе выбор из последних
  const lastTwo = id => asses.filter(a => a.clientId === id).sort((x, y) => x.date - y.date).slice(-2);
  const tool = (title, ok, act) => () => { const cs = sorted.filter(c => ok(lastTwo(c.id))); if (!cs.length) return toast('Пока нет подходящих клиентов'); if (cs.length === 1) return act(cs[0], lastTwo(cs[0].id)); pickClient(title, cs, c => act(c, lastTwo(c.id))); };
  $('#rtq').onclick = tool('Ретест', l => l.length >= 1, (c, l) => newAssessment(c.id, l.at(-1).id));
  $('#repq').onclick = tool('Отчёт клиенту', l => l.length >= 1, (c, l) => report(l.at(-1).id));
  $('#cmpq').onclick = tool('Было → стало', l => l.length >= 2, (c, l) => compare(l[0].id, l[1].id));
  if ($('#q')) $('#q').oninput = e => { clearTimeout(window._qt); window._qt = setTimeout(() => proHome(e.target.value).then(() => { const i = $('#q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }), 250); };
  document.querySelectorAll('[data-id]').forEach(el => el.onclick = () => clientCard(el.dataset.id));
  document.querySelectorAll('[data-msg]').forEach(el => el.onclick = () => { const x = soon.find(y => y.c.id === el.dataset.msg); if (x) messageClient(x.c, x.a.nextDate); });
  document.querySelectorAll('.list-item[data-a]').forEach(el => el.onclick = () => result(el.dataset.a));
}
// шторка выбора клиента для инструментов «Сегодня»: 5 последних и поиск
function pickClient(title, cs, then) {
  const d = document.createElement('div'); d.className = 'sheet';
  const draw = q => { const l = cs.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
    d.querySelector('#pcl').innerHTML = l.map(c => `<button class="row-link" data-pc="${c.id}"><span class="avatar">${esc(c.name.slice(0, 1).toUpperCase())}</span><span>${esc(c.name)}</span>${ic('chevron-right', 's chev')}</button>`).join('') || '<p class="sub" style="padding:12px 0">Никого не нашлось.</p>';
    d.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { d.remove(); then(cs.find(c => c.id === b.dataset.pc)); }); };
  d.innerHTML = `<div><h2>${title}</h2><input class="field" id="pcq" placeholder="Найти клиента" style="margin-top:var(--s4);height:48px"><div class="group" id="pcl" style="margin-top:var(--s3)"></div><button class="btn ghost" id="pcx" style="margin-top:var(--s2)">Отмена</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('#pcx').onclick = () => d.remove();
  d.querySelector('#pcq').oninput = e => draw(e.target.value); draw('');
}

async function proMenu() {
  const hasSnap = await snapLoad().then(Boolean).catch(() => false);
  const d = document.createElement('div'); d.className = 'sheet'; const p = tariff(), u = meSync();
  const r = (id, icon, t) => `<button class="row-link" id="${id}">${ic(icon, 's')}<span>${t}</span>${ic('chevron-right', 's chev')}</button>`;
  d.innerHTML = `<div><h2>Кабинет</h2>
    ${p.plan === 'start' ? `<a class="row-link" href="/pricing" target="_blank" style="margin-top:var(--s2)"><span style="color:var(--sub);font-size:14px">${planLine()}</span>${ic('chevron-right', 's chev')}</a>` : ''}
    <div class="group" style="margin-top:var(--s3)">
      ${r('msp', 'settings', 'Специализация: ' + esc(((SPECIALTIES.find(x => x[0] === localStorage.getItem('bp_sp')) || ['', 'не выбрана'])[1]).split(',')[0]))}
      ${r('mp', 'user-plus', 'Мой профиль: имя и контакт')}
      ${r('demo2', 'file-text', 'Пример оценки')}
      ${r('mb', 'download', 'Сохранить копию с паролем')}
      <label class="row-link">${ic('upload', 's')}<span>Восстановить из копии</span>${ic('chevron-right', 's chev')}<input type="file" id="mr" accept=".json,.bpbackup,application/json" style="display:none"></label>
      ${r('mbug', 'info', 'Сообщить о проблеме')}
      ${r('mfb', 'message-square', 'Отзыв или идея')}
      ${r('mc', 'rotate-ccw', 'Перейти в режим клиента')}
      ${u && u.admin ? r('mst', 'info', 'Статистика и отзывы (админ)') : ''}
      <a class="row-link" href="/privacy" target="_blank">${ic('shield-check', 's')}<span>Конфиденциальность</span>${ic('chevron-right', 's chev')}</a>
      <details class="row-link" style="display:block"><summary style="font-size:15px;color:var(--sub)">Дополнительно</summary>
        ${r('mexp', 'info', 'Мой опыт по признакам')}${hasSnap ? r('mund', 'rotate-ccw', 'Отменить последнее восстановление') : ''}</details>
      ${u ? `<button class="row-link" id="mo">${ic('log-out', 's')}<span>Выйти: ${esc(u.name)}</span></button>` : ''}</div>
    <button class="btn" id="mx" style="margin-top:var(--s4)">Закрыть</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('#mb').onclick = () => { d.remove(); backup(); };
  if (d.querySelector('#mst')) d.querySelector('#mst').onclick = () => { d.remove(); funnelScreen(); };
  d.querySelector('#mbug').onclick = () => { d.remove(); bugSheet(); };
  if (d.querySelector('#mund')) d.querySelector('#mund').onclick = () => { d.remove(); undoRestore(); };
  d.querySelector('#mexp').onclick = () => { d.remove(); experienceScreen(); };
  d.querySelector('#demo2').onclick = () => { d.remove(); openDemo(); };
  d.querySelector('#mfb').onclick = () => { d.remove(); feedbackSheet('menu'); };
  d.querySelector('#msp').onclick = () => { d.remove(); specialtyScreen(proHome); };
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
  const sel = (n, opts, v) => `<select id="${n}" class="field" style="padding:0 10px">${opts.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const inp = (n, ph, v, type = 'text') => `<input id="${n}" type="${type}" value="${esc(v)}" placeholder="${ph}" class="field">`;
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:18px">${id ? 'Изменить клиента' : 'Новый клиент'}</b></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:12px;padding-bottom:24px">
    <div class="row" style="gap:10px"><div style="flex:1">${inp('first', 'Имя *', c.first ?? (c.name || '').split(' ')[0])}</div><div style="flex:1">${inp('last', 'Фамилия', c.last ?? (c.name || '').split(' ').slice(1).join(' '))}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Дата рождения</div>${inp('dob', '', c.dob, 'date')}</div><div style="width:110px"><div class="sub" style="font-size:12px;margin-bottom:4px">Пол</div>${sel('sex', [['', '—'], ['M', 'Муж'], ['F', 'Жен']], c.sex)}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Рост, см</div>${inp('height', '', c.height, 'number')}</div><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Ведущая сторона</div>${sel('hand', [['R', 'Правша'], ['L', 'Левша']], c.hand)}</div></div>
    ${inp('activity', 'Спорт или работа', c.activity)}
    <textarea id="complaints" placeholder="Жалобы, травмы" rows="3" class="field" style="height:auto;padding:12px 16px">${esc(c.complaints)}</textarea>
    <textarea id="notes" placeholder="Заметки" rows="3" class="field" style="height:auto;padding:12px 16px">${esc(c.notes)}</textarea>
    <button class="btn line" id="dict" style="height:48px">${ic('mic', 's')}Надиктовать</button>
   </div><div class="pad" style="padding-bottom:24px"><button class="btn" id="save">${thenAssess ? 'Сохранить и начать оценку' : 'Сохранить'}</button></div></div>`);
  $('#back').onclick = () => id ? clientCard(id) : proHome(); $('#dict').onclick = () => dictate($('#notes'), $('#dict'));
  $('#save').onclick = async () => { const v = n => $('#' + n).value.trim(); if (!v('first')) { $('#first').style.borderColor = 'var(--over)'; $('#first').focus(); return; }
    Object.assign(c, { first: v('first'), last: v('last'), name: [v('first'), v('last')].filter(Boolean).join(' '), dob: v('dob'), sex: v('sex'), height: v('height'), leg: v('hand'), hand: v('hand'), activity: v('activity'), complaints: v('complaints'), notes: v('notes') });
    await put('clients', c); thenAssess ? newAssessment(c.id) : clientCard(c.id); };
}

export async function clientCard(id) {
  const c = await get('clients', id); if (!c) return proHome(); const as = await byClient(id); const last = as.at(-1);
  const age = c.dob ? Math.floor((Date.now() - new Date(c.dob)) / (365.25 * DAY)) : null;
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><span style="flex:1"></span><button class="pill" id="edit">Изменить</button></div>
   <div class="pad"><h1>${esc(c.name)}</h1><p class="sub" style="font-size:14px;margin-top:4px">${[age != null ? age + ' ' + (age % 10 === 1 && age % 100 !== 11 ? 'год' : [2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100) ? 'года' : 'лет') : '', c.sex === 'M' ? 'муж' : c.sex === 'F' ? 'жен' : '', c.height ? c.height + ' см' : '', c.hand === 'L' ? 'левша' : c.hand === 'R' ? 'правша' : '', c.activity].filter(Boolean).map(esc).join(' · ')}</p>
    ${c.complaints ? `<div class="card" style="margin-top:12px;font-size:15px;line-height:1.4"><div class="eyebrow">Жалобы</div>${esc(c.complaints)}</div>` : ''}
    ${c.notes ? `<div class="card" style="margin-top:8px;font-size:15px;line-height:1.4"><div class="eyebrow">Заметки</div>${esc(c.notes)}</div>` : ''}</div>
   ${last && last.nextDate ? `<div class="pad" style="margin-top:12px"><div class="card row" style="background:${last.nextDate - Date.now() <= 3 * DAY ? 'var(--short-s)' : '#fff'}"><div style="flex:1"><b>Повторный тест</b><div style="font-size:14px;color:var(--sub)">${fmtDate(last.nextDate)}</div></div><button class="pill" id="msg">Написать</button><button class="pill" id="cal" style="margin-left:6px">В календарь</button></div></div>` : ''}
   ${as.length >= 2 ? '<div class="pad" style="margin-top:14px"><button class="btn line" id="cmp">Было → стало</button></div>' : ''}${as.length >= 3 ? '<div class="pad" style="margin-top:8px"><button class="btn ghost" id="rel" style="background:#fff">Повторяемость: 3 последних теста</button></div>' : ''}
   <div class="pad" style="margin-top:14px;display:flex;flex-direction:column;gap:10px"><button class="btn" id="na">${last ? 'Повторный тест' : 'Новая оценка'}</button><button class="btn ghost" id="inv" style="background:#fff">Ссылка клиенту: тест дома</button>${last ? '<button class="btn ghost" id="nb">Новая оценка с другим протоколом</button>' : ''}</div>
   <h3 class="pad" style="margin:22px 0 8px;font-size:17px">История оценок</h3>
   <div class="pad" style="display:flex;flex-direction:column;gap:8px">${as.length ? [...as].reverse().map(a => { const q = Object.values(a.quality || {}); const qa = q.length ? Math.round(q.reduce((x, y) => x + y, 0) / q.length) : null;
      const pain = Object.values(a.pain || {}).filter(v => v > 0); return `<div class="list-item" data-a="${a.id}" style="background:#fff"><div style="flex:1"><b>${fmtDate(a.date)}</b><div style="font-size:13px;color:var(--sub)">${esc(a.templateName || 'Оценка')}${qa != null ? ' · качество ' + qa : ''}${pain.length ? ' · боль до ' + Math.max(...pain) : ''}${a.draft ? ' · черновик' : ''}</div></div><span class="chev">›</span></div>`; }).join('')
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
  $('#del').onclick = async () => { if (!(await confirm2(`Удалить ${c.name} и все оценки? Это нельзя отменить.`, 'Удалить'))) return; for (const a of as) { await del('assessments', a.id); await del('poses', a.id); } await del('clients', id); proHome(); };
}

// напоминание в календаре телефона: событие за 3 дня до ретеста и в день ретеста
function remind(c, date) {
  const p = n => String(n).padStart(2, '0'), d = t => { const x = new Date(t); return `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T100000`; };
  const ev = (t, sum, uid2) => ['BEGIN:VEVENT', 'UID:' + uid2 + '@bodypassport', 'DTSTART:' + d(t), 'DURATION:PT15M', 'SUMMARY:' + sum, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + sum, 'END:VALARM', 'END:VEVENT'];
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyPassport//RU', ...ev(date - 3 * DAY, `Через 3 дня повторный тест: ${c.name.replace(/[\r\n,;]/g, ' ')}`, c.id + '-3'), ...ev(date, `Повторный тест: ${c.name.replace(/[\r\n,;]/g, ' ')}`, c.id + '-0'), 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'retest.ics'; a.click();
}

// ---------- новая оценка: протокол, боль, камера ----------

// ---------- быстрый старт оценки: только имя, остальное потом ----------
async function quickStart() {
  const clients = (await all('clients')).filter(c => !c.demo), asses = await all('assessments');
  const last = id => Math.max(0, ...asses.filter(a => a.clientId === id).map(a => a.date));
  const recent = clients.sort((x, y) => (last(y.id) || y.created) - (last(x.id) || x.created)).slice(0, 3);
  let tpl = TEMPLATES[0], picked = null, pz = null, pzv = 5, pzs = null;
  const stepsW = n => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'шаг' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'шага' : 'шагов');
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Новая оценка</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s2)">
    <input id="nm" class="field" placeholder="Имя клиента" autocomplete="off" aria-label="Имя клиента">
    ${recent.length ? `<div class="row" style="flex-wrap:wrap;gap:8px">${recent.map(c => `<button class="pill" data-c="${c.id}">${esc(c.name)}</button>`).join('')}${clients.length > 3 ? '<button class="pill" id="morec">Ещё…</button>' : ''}</div>` : ''}
    <div class="eyebrow" style="margin-top:var(--s3)">Цель</div>
    <div class="group" id="goals">${TEMPLATES.map(t => { const r = rowsOf(t[2]); return `<label class="row" style="min-height:60px;cursor:pointer" data-t="${t[0]}"><input type="radio" name="tpl" class="check" style="width:20px;height:20px" ${t === tpl ? 'checked' : ''}><b style="flex:1;font-size:15px">${t[1]}</b><span class="step-n">${stepsW(r.length)} · ${mins(SETUP_SEC + secs(r))} мин</span></label>`; }).join('')}</div>
    <div class="eyebrow" style="margin-top:var(--s3)">Боль сейчас</div>
    <div class="card" style="padding:12px 14px"><div class="row" style="flex-wrap:wrap;gap:6px" id="pz">${[['', 'Нет'], ...PAIN].map(([k, n]) => `<button class="pill" data-pz="${k}">${n}</button>`).join('')}</div>
      <div id="pzd" hidden><div class="row" style="margin-top:12px;gap:10px"><input type="range" min="0" max="10" value="5" id="pzv" style="flex:1;accent-color:var(--ink)" aria-label="Боль от 0 до 10"><b class="num" id="pzn" style="width:44px;text-align:right">5/10</b></div>
      <div class="seg" style="margin-top:10px">${[['LEFT', 'Слева'], ['RIGHT', 'Справа'], ['BOTH', 'С двух']].map(([k, n]) => `<button data-pzs="${k}">${n}</button>`).join('')}</div></div></div>
    <button class="row-link" id="adv" style="color:var(--focus);font-weight:600"><span>Моя гипотеза, камера, шаги</span>${ic('chevron-right', 's')}</button>
   </div><div class="dock"><button class="btn" id="go" disabled>Начать · ${mins(SETUP_SEC + secs(rowsOf(tpl[2])))} мин</button></div></div>`);
  $('#back').onclick = () => proHome();
  const nm = $('#nm'), go2 = $('#go');
  const sync = () => { go2.disabled = !(picked || nm.value.trim()); go2.textContent = `Начать · ${mins(SETUP_SEC + secs(rowsOf(tpl[2])))} мин`; };
  nm.oninput = () => { picked = null; document.querySelectorAll('[data-c]').forEach(x => x.classList.remove('on')); sync(); };
  nm.onkeydown = e => { if (e.key === 'Enter' && !go2.disabled) go2.click(); };
  document.querySelectorAll('[data-c]').forEach(el => el.onclick = () => { picked = el.dataset.c; nm.value = ''; document.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === el)); sync(); });
  if ($('#morec')) $('#morec').onclick = () => pickClient('Клиент', clients, c => { picked = c.id; nm.value = c.name; sync(); });
  document.querySelectorAll('#goals [data-t]').forEach(el => el.onchange = () => { tpl = TEMPLATES.find(t => t[0] === el.dataset.t); sync(); });
  // боль одной строкой: зона, 0–10 и сторона; без нее «Было → стало» не покажет главного для клиента
  const pzSet = k => { pz = k || null; document.querySelectorAll('[data-pz]').forEach(x => x.classList.toggle('on', x.dataset.pz === (k || ''))); $('#pzd').hidden = !pz; };
  document.querySelectorAll('[data-pz]').forEach(b => b.onclick = () => pzSet(b.dataset.pz));
  $('#pzv').oninput = e => { pzv = +e.target.value; $('#pzn').textContent = pzv + '/10'; };
  document.querySelectorAll('[data-pzs]').forEach(b => b.onclick = () => { pzs = pzs === b.dataset.pzs ? null : b.dataset.pzs; document.querySelectorAll('[data-pzs]').forEach(x => x.classList.toggle('on', x.dataset.pzs === pzs)); });
  const painOpts = () => pz ? { pain: { [pz]: pzv }, painSide: pzs } : {};
  // клиент из поля создается один раз (gate — единственное место про тариф), потом сразу камера
  const client = async () => { if (picked) return picked; if (clients.length >= START_CLIENTS && !gate('clients')) return null; const n = nm.value.trim().slice(0, 80);
    const c = { id: uid(), created: Date.now(), name: n, first: n.split(' ')[0], last: n.split(' ').slice(1).join(' '), dob: '', sex: '', height: '', leg: 'R', hand: 'R', activity: '', complaints: '', notes: '' };
    await put('clients', c); picked = c.id; return c.id; };
  go2.onclick = async () => { const id = await client(); if (id) newAssessment(id, null, { tpl, autostart: true, ...painOpts() }); };
  $('#adv').onclick = async () => { if (!picked && !nm.value.trim()) { nm.focus(); return toast('Сначала имя клиента'); } const id = await client(); if (id) newAssessment(id, null, { tpl, ...painOpts() }); };
  if (!recent.length) nm.focus();
}

async function newAssessment(clientId, retestOf, opts = {}) {
  const c = await get('clients', clientId); const prev = retestOf ? await get('assessments', retestOf) : null;
  let tpl = prev ? TEMPLATES.find(t => t[0] === prev.template) || ['custom', prev.templateName || 'Свой', prev.protocol] : opts.tpl || TEMPLATES[0]; let units = prev ? prev.protocol : tpl[2]; const pain = { ...(opts.pain || {}) }; const pre = {}; let expect = '', painSide = opts.painSide || (prev && prev.painSide) || null;
  const draw = () => { const rows = rowsOf(units);
    const session = prev && prev.template === 'posture' && Date.now() - prev.date < 12 * 3600e3; // массаж: «после сеанса» в тот же день
    const goalBtn = t => { const r = rowsOf(t[2]); return `<button class="list-item" data-t="${t[0]}" style="background:#fff;text-align:left;font:inherit;color:inherit;border:1.5px solid ${tpl[0] === t[0] ? 'var(--ink)' : 'transparent'}"><div style="flex:1"><b style="font-size:16px">${t[1]}</b><div style="font-size:13px;color:var(--sub)">${r.length} ${r.length === 1 ? 'шаг' : r.length < 5 ? 'шага' : 'шагов'} · ${mins(SETUP_SEC + secs(r))} мин</div></div>${tpl[0] === t[0] ? ic('check', 's') : ''}</button>`; };
    go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div style="flex:1;min-width:0"><b style="font-size:18px">${session ? 'После сеанса' : prev ? 'Повторный тест' : 'Новая оценка'}</b><div style="font-size:13px;color:var(--sub)">${esc(c.name)}</div></div></div>
     <div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-bottom:20px">
      ${prev ? `<div class="card row" style="font-size:14px;line-height:1.4;align-items:flex-start">${ic('info', 's')}<span>${session ? 'Тот же ракурс, что до сеанса.' : 'Тот же протокол, что ' + fmtDate(prev.date) + '.'} Поставьте телефон так же: подсказка в кадре покажет, ближе или дальше.</span></div>` : ''}
      ${prev ? '' : `<div><b>Цель</b><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${TEMPLATES.map(goalBtn).join('')}</div></div>`}
      <div><b>Моя гипотеза</b> <span class="sub" style="font-size:13px">необязательно</span><textarea id="expect" rows="2" placeholder="Что вы ожидаете увидеть по осмотру руками" class="field" style="margin-top:8px;height:auto;padding:12px 16px;font-size:15px">${esc(expect)}</textarea></div>
      <details class="card" ${prev && Object.values(prev.pain || {}).some(v => v > 0) ? 'open' : ''}><summary style="font-weight:600">Шаги, боль, камера${prev && Object.values(prev.pain || {}).some(v => v > 0) ? ' · отметьте боль сейчас' : ''}</summary>
        <div style="margin-top:10px">${stepList(units, pre)}</div>
        <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">${Object.keys(UNITS).map(u => `<label style="display:flex;align-items:center;gap:6px;font-size:14px;background:var(--bg);border-radius:99px;padding:6px 12px"><input type="checkbox" data-u="${u}" ${units.includes(u) ? 'checked' : ''} ${u === 'stand' ? 'disabled' : ''}>${UNIT_NAMES[u]}</label>`).join('')}</div>
        <div style="margin-top:14px"><b style="font-size:14px">Сторона боли</b><div class="seg" style="margin-top:6px">${[['LEFT', 'Слева'], ['RIGHT', 'Справа'], ['BOTH', 'С двух'], ['', 'Нет']].map(([k, n]) => `<button data-ps="${k}" class="${(painSide || '') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div style="margin-top:14px"><b style="font-size:14px">Боль сейчас, 0–10</b><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${PAIN.map(([k, n]) => `<div class="row" style="background:var(--bg);border-radius:12px;padding:6px 12px"><span style="width:110px;font-size:14px">${n}</span><input type="range" min="0" max="10" value="${pain[k] || 0}" data-p="${k}" style="flex:1;accent-color:var(--ink)"><b style="width:24px;text-align:right" id="pv_${k}">${pain[k] || 0}</b></div>`).join('')}</div></div>
        <div style="margin-top:14px"><b style="font-size:14px">Камера</b><div class="seg" style="margin-top:6px"><button id="c0" class="${cam.back ? '' : 'on'}">Фронтальная</button><button id="c1" class="${cam.back ? 'on' : ''}">Основная</button></div></div>
      </details>
     </div><div class="pad" style="padding-bottom:24px"><button class="btn" id="go">Начать · ${rows.length} ${rows.length === 1 ? 'шаг' : rows.length < 5 ? 'шага' : 'шагов'}, ${mins(SETUP_SEC + secs(rows))} мин</button></div></div>`);
    $('#back').onclick = () => clientCard(clientId); bindStepList(pre, draw);
    document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = TEMPLATES.find(t => t[0] === b.dataset.t); units = tpl[2]; draw(); });
    document.querySelectorAll('[data-u]').forEach(b => b.onchange = () => { units = sortUnits(b.checked ? [...units, b.dataset.u] : units.filter(x => x !== b.dataset.u)); tpl = ['custom', 'Свой', units]; draw(); });
    document.querySelectorAll('[data-p]').forEach(r => r.oninput = () => { pain[r.dataset.p] = +r.value; $('#pv_' + r.dataset.p).textContent = r.value; });
    $('#expect').oninput = e => { expect = e.target.value; };
    document.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { painSide = b.dataset.ps || null; document.querySelectorAll('[data-ps]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#c0').onclick = () => { cam.back = false; localStorage.setItem('bp_back', '0'); draw(); }; $('#c1').onclick = () => { cam.back = true; localStorage.setItem('bp_back', '1'); draw(); };
    $('#go').onclick = async () => { voice.unlock(); startMotion(); $('#go').textContent = 'Загружаю модель…';
      try { await initPose(); } catch (e) { toast('Не удалось загрузить модель: ' + e.message); return draw(); }
      track('assess_start', { n: units.length }, false);
      const r = await runProtocol(units, { target: prev && prev.setup, onCancel: () => clientCard(clientId), pre }); if (!r) return;
      const a = { id: uid(), clientId, date: r.date, template: tpl[0], templateName: session ? 'После сеанса' : tpl[0] === 'posture' && !prev ? 'До сеанса' : tpl[1], protocol: r.protocol, snapshot: r.snapshot, side: r.side, moves: r.moves, quality: r.quality, setup: r.setup, tech: r.tech || null, limits: r.limits || {}, pain, painSide, lumbarZone: LUMBAR[tpl[0]] || (prev && prev.lumbarZone) || null, hyp: {}, plan: null, note: '', expect: expect.trim().slice(0, 500), nextDate: r.date + 30 * DAY, prevId: prev ? prev.id : null, draft: true };
      await put('assessments', a); await put('poses', { assessmentId: a.id, poses: r.poses }); track('assess_done', { n: units.length }, false); if (prev) track('retest_done', { n: Math.round((r.date - prev.date) / DAY) }, false); result(a.id); }; };
  draw(); if (opts.autostart) $('#go').click();
}

// ---------- вкладка «Гипотеза»: карточка мышцы обновляется на месте, без перерисовки экрана ----------
const hypList = (a, sp, top) => (top.length ? top : sp.filter(s => s.k !== 'OK').slice(0, 8)).concat(sp.filter(s => s.edited && s.k === 'OK' && !top.includes(s))).slice(0, 14);
const STATE4 = [['WEAK', 'Слабость'], ['HYPER', 'Перегруз'], ['SHORT', 'Укороч.'], ['OK', 'Норма']];
function confLine(sc) {
  if (!sc || sc.S == null) return '';
  const lab = sc.labels.filter(l => l !== 'PRELIMINARY').map(l => LABELS[l]).join(' · ');
  // по фокус-группе: балл на каждой карточке шумит и читается как «точность»; показываем только низкую уверенность и особые метки
  if (sc.band !== 'LOW' && !lab) return '';
  return `<button class="link" data-conf="${esc(sc.rule)}" style="min-height:32px;font-size:13px;font-weight:500;color:var(--sub);text-align:left">${sc.band === 'LOW' ? '<b style="color:var(--short-t)">Низкая уверенность</b>, проверьте руками' : 'Уверенность: ' + BAND_NAMES[sc.band]}${lab ? ' · ' + esc(lab) : ''}</button>`;
}
function hypCard(a, an, s, open, evid) {
  const m = C.muscles[s.id], obs = seen2(an, s), chk = a.check || {}, why = (a.hypWhy || {})[s.key], sc = scoreSpot(s, an.findings, evid);
  return `<div class="card" data-card="${s.key}"><b style="font-size:16px">${ntitle(s)}</b>
    <div class="why" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;font-size:13px;color:var(--sub)">${s.edited ? `<span class="src">ПРАВКА</span><span>${why ? 'причина: ' + esc(why) : 'изменено специалистом'}</span>` : obs.length && !s.derived ? `<span class="src">ЗАМЕР</span><span>${esc(obs.map(x => x.replace(' (на границе нормы)', '')).join(' · '))}</span>${obs.some(x => /на границе нормы/.test(x)) ? '<span class="edge">на границе нормы</span>' : ''}` : `<span class="src hyp">ЦЕПЬ</span><span>${esc(s.byChain ? 'по цепи «' + s.byChain + '»' : 'вывод по связи мышц')}</span>`}</div>
    ${confLine(sc)}
    <div class="seg" style="margin-top:8px;border-radius:var(--r-sm)">${STATE4.map(([k, n]) => `<button data-k="${s.key}" data-s="${k}" class="${s.k === k ? 'on' : ''}" style="min-height:44px;padding:4px 2px;border-radius:var(--r-xs);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px"><span class="mark sm ${k}"></span>${n}</button>`).join('')}</div>
    ${m && m.proTest ? `<details style="margin-top:var(--s3);border-top:1px solid var(--line-2);padding-top:4px" ${open ? 'open' : ''}><summary class="row" style="font-size:14px;font-weight:600;color:var(--focus)"><span style="flex:1">Проверь руками${chk[s.key] === 'yes' ? ' · подтвердилось' : chk[s.key] === 'no' ? ' · не подтвердилось' : ''}</span>${ic('chevron-down', 's')}</summary>
      <p style="font-size:14px;line-height:1.45;margin-top:4px">${m.proTest}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);margin-top:10px"><button class="btn${chk[s.key] === 'yes' ? '' : ' line'}" data-chk="${s.key}" data-v="yes" style="height:48px;border-radius:var(--r-sm);font-size:15px">Подтвердилось</button><button class="btn${chk[s.key] === 'no' ? '' : ' line'}" data-chk="${s.key}" data-v="no" style="height:48px;border-radius:var(--r-sm);font-size:15px">Не подтвердилось</button></div></details>` : ''}</div>`;
}
// причина правки обязательна (ТЗ v2.1, раздел 6): быстрый выбор или свой текст
const WHY = ['Пальпация', 'Мышечный тест', 'Жалобы и анамнез', 'Визуальная оценка'];
let lastWhy = '';
function whySheet(text) {
  return new Promise(res => { const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div><h2>Почему меняете?</h2><p class="sub" style="font-size:14px;margin-top:6px">${esc(text)}. Нажмите причину, она сохранится в журнале правок и в карточке.</p>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:var(--s4)">${WHY.map(w => `<button class="pill" data-w="${w}" style="min-height:44px">${w}</button>`).join('')}</div>
      <input class="field" id="wt" placeholder="Или своими словами" maxlength="140" style="margin-top:var(--s3);height:48px">
      <button class="btn" id="wok" style="margin-top:var(--s4)">Сохранить правку</button><button class="btn ghost" id="wx" style="margin-top:var(--s2)">Отмена</button></div>`;
    document.body.appendChild(d); let pick = '';
    const done = v => { d.remove(); res(v); };
    // готовая причина сохраняется одним касанием; последняя причина подсвечена и подставляется кнопкой «Сохранить»
    pick = lastWhy; d.querySelectorAll('[data-w]').forEach(b => { b.classList.toggle('on', b.dataset.w === lastWhy); b.onclick = () => { lastWhy = b.dataset.w; done(b.dataset.w); }; });
    d.querySelector('#wok').onclick = () => { const t = (d.querySelector('#wt').value.trim() || pick).slice(0, 140); if (!t) { d.querySelector('#wt').focus(); return toast('Выберите причину'); } lastWhy = t; done(t); };
    d.querySelector('#wx').onclick = () => done(null); d.onclick = e => { if (e.target === d) done(null); }; });
}
async function logOverride(a, key, from, to, why) {
  a.overrides = [...(a.overrides || []), { key, from, to, why, t: Date.now() }].slice(-100);
  const log = (await meta('overrideLog')) || []; log.push({ a: a.id, key, from, to, why, t: Date.now() }); await setMeta('overrideLog', log.slice(-1000));
}
// разбивка уверенности: из чего сложился балл
function confSheet(sc, back) {
  const d = document.createElement('div'); d.className = 'sheet'; const p = n => String(n).replace('.', ',');
  d.innerHTML = `<div><div class="eyebrow">Уверенность вывода</div><h2 style="margin-top:6px">${esc(RULE_NAMES[sc.rule] || sc.rule)}</h2>
    <div class="group" style="margin-top:var(--s4)">
      <div class="row" style="min-height:56px"><span style="flex:1">Опыт специалиста ×0,50</span><b class="num">${sc.eExp == null ? 'не задан' : p(sc.parts.exp)}</b></div>
      <div class="row" style="min-height:56px"><span style="flex:1">Исследования ×0,35<small style="display:block;font-size:12px;color:var(--sub)">${esc(sc.source)}</small></span><b class="num">${p(sc.parts.res)}</b></div>
      <div class="row" style="min-height:56px"><span style="flex:1">Замер ×0,15<small style="display:block;font-size:12px;color:var(--sub)">до проверки повторяемости не больше половины веса</small></span><b class="num">${p(sc.parts.data)}</b></div>
      <div class="row" style="min-height:56px"><b style="flex:1">Итого · ${BAND_NAMES[sc.band]}</b><b class="num">${p(sc.S)}</b></div></div>
    ${sc.labels.length ? `<p style="font-size:13px;color:var(--short-t);margin-top:var(--s3)">${sc.labels.map(l => esc(LABELS[l])).join('. ')}.</p>` : ''}
    <p class="sub" style="font-size:13px;margin-top:var(--s3)">Высокая уверенность невозможна без исследований: опыт и замер вместе дают не больше средней.</p>
    <button class="btn line" id="cfe" style="margin-top:var(--s4)">Указать свой опыт по признакам</button><button class="btn" id="cfx" style="margin-top:var(--s2)">Понятно</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('#cfx').onclick = () => d.remove(); d.querySelector('#cfe').onclick = () => { d.remove(); experienceScreen(back); };
}
// профиль специалиста: доля клиентов, у которых он видит признак (e_exp). Хранится на телефоне, переносится резервной копией
async function experienceScreen(back) {
  const ev = (await meta('eexp')) || {};
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Мой опыт по признакам</b><small>влияет на уверенность выводов</small></div></div>
   <div class="pad" style="padding-bottom:var(--s5)"><p class="sub" style="font-size:14px;margin:var(--s2) 0 var(--s4)">У какой доли ваших клиентов с таким признаком вывод о мышцах подтверждается на практике? Не знаете — оставьте пустым: вывод будет помечен «нужна оценка специалиста».</p>
    <div class="group">${Object.entries(RULE_NAMES).map(([id, n]) => `<div class="row" style="min-height:64px;flex-wrap:wrap;gap:8px"><span style="flex:1 1 60%;font-size:15px">${n}${RESEARCH[id] ? `<small style="display:block;font-size:12px;color:var(--sub)">исследования: ${String(RESEARCH[id][0]).replace('.', ',')}</small>` : ''}</span>
      <select class="field" data-ev="${id}" style="width:104px;height:44px;padding:0 8px;font-size:15px"><option value="">—</option>${[10, 20, 30, 40, 50, 60, 70, 80, 90, 95].map(v => `<option value="${v}" ${ev[id] != null && Math.round(ev[id] * 100) === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></div>`).join('')}</div>
    <button class="link" id="evr" style="margin-top:var(--s3);color:var(--over-t)">Сбросить всё</button></div></div>`);
  $('#back').onclick = () => (back || proHome)();
  document.querySelectorAll('[data-ev]').forEach(sl => sl.onchange = async () => { const v = sl.value ? +sl.value / 100 : null; if (v == null) delete ev[sl.dataset.ev]; else ev[sl.dataset.ev] = v; await setMeta('eexp', ev); toast('Сохранено'); });
  $('#evr').onclick = async () => { if (!(await confirm2('Сбросить ваш опыт по всем признакам?', 'Сбросить'))) return; await setMeta('eexp', {}); experienceScreen(back); };
}

// ---------- результат: измерено, гипотеза, назначение ----------
function proSpots(a) {
  const base = spots(analyze(a, C));
  return base.map(s => { const o = a.hyp && a.hyp[s.key]; if (!o) return s; const st = STATES.find(x => x[0] === o); return { ...s, k: o, tone: st[2], derived: false, edited: true }; });
}
export async function result(aid, view = 'measured') {
  const a = await get('assessments', aid); if (!a) return proHome(); const c = await get('clients', a.clientId);
  const an = analyze(a, C); const sp = proSpots(a); const evid = (await meta('eexp')) || {}; const top = sp.filter(s => s.k !== 'OK' && (!s.derived || s.edited || s.byChain)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone));
  const q = Object.entries(a.quality || {}); const qa = q.length ? Math.round(q.reduce((x, [, v]) => x + v, 0) / q.length) : null;
  const facts = an.findings.slice(0, 3);
  const tab = (k, t) => `<button class="${view === k ? 'on' : ''}" data-v="${k}">${t}</button>`;
  let body = '';
  // номер факта = номер точки на фигуре; число крупно, «на границе нормы» показываем
  const spotOf = f => sp.find(s => f.muscles.some(m => m.id === s.id && (m.side === s.side || m.side === 'BOTH')) && !s.derived);
  const numOf = t => String(t).match(/(\d+(?:[.,]\d+)?)\s*(°|%)/);
  const plainObs = t => { const m = numOf(t); return String(t).replace(' (на границе нормы)', '').replace(m ? m[0] : '§§', '').replace(/\s+на\s*$/, '').replace(/\s+на\s+(в|при)\s/, ' $1 ').replace(/\s{2,}/g, ' ').trim(); };
  const numLabels = facts.map((f, i) => { const s = spotOf(f); return s ? { key: s.key, n: i + 1, title: '', sub: '', color: '#111418' } : null; }).filter(Boolean);
  const hasBack = numLabels.some(l => sp.find(s => s.key === l.key).back);
  let dock = '';
  if (view === 'measured') { const conf = a.check || {};
    // на «Итоге» одна главная гипотеза (меньше 60 слов), остальные во вкладке «Гипотеза»
    const hypAll = top.filter(s => !s.edited || s.k !== 'OK'), hypTop = hypAll.slice(0, 1), hypMore = hypAll.length - hypTop.length;
    const decided = sp.filter(s => s.k !== 'OK' && (conf[s.key] === 'yes' || s.edited)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone));
    const isBefore = a.template === 'posture' && !a.prevId;
    body = `
    ${qa != null && qa < 60 ? `<div class="card" style="border:1px solid var(--over-t);padding:12px 14px;font-size:14px;line-height:1.4"><span class="edge">Съемка ${qa} из 100</span> Мало света, тело не целиком в кадре или телефон качался. Слабые находки скрыты, остальное приблизительно. Лучше переснять.</div>` : ''}
    <div class="card"><div class="row" style="align-items:flex-start;gap:var(--s4)">
      <div style="width:92px;flex:none"><div class="seg" style="margin-bottom:6px;${hasBack ? '' : 'display:none'}"><button id="mf" class="on" style="min-height:32px;padding:0;font-size:12px">Пер.</button><button id="mb2" style="min-height:32px;padding:0;font-size:12px">Зад</button></div><canvas id="heat" style="width:92px;display:block"></canvas></div>
      <div style="flex:1;min-width:0"><span class="src">ИЗМЕРЕНО</span>${facts.length ? facts.map((f, i) => { const m = numOf(f.observed); return `<div class="mrow" style="margin-top:12px"><i>${i + 1}</i><span>${esc(plainObs(f.observed))}${/на границе нормы/.test(f.observed) ? ' <span class="edge">граница</span>' : ''}</span>${m ? `<b>${m[1]}${m[2]}</b>` : ''}</div>`; }).join('') + '<p style="font-size:11px;color:var(--faint);margin-top:10px">Одна камера: точность угла около ±5°</p>' : '<p class="sub" style="margin-top:8px;font-size:14px">Существенных отклонений нет</p>'}</div></div></div>
    ${hypTop.map(s => { const by = facts.map((f, i) => f.muscles.some(m => m.id === s.id) ? i + 1 : 0).filter(Boolean);
      return `<div class="hyp-card"><div class="eyebrow" style="color:var(--src-hyp)">Гипотеза${by.length ? ' · по ' + by.join(' и ') : ''}</div>
      <div class="row" style="margin-top:10px;align-items:flex-start"><span class="mark ${s.k}" style="margin-top:4px"></span><div style="font-size:16px;line-height:1.35">Вероятно: <b>${C.muscles[s.id].name} ${s.side === 'RIGHT' ? 'справа' : 'слева'}</b> · ${toneText(s, 0).toLowerCase()}</div></div>
      ${sideClash(a, s) ? '<div style="font-size:13px;color:var(--short-t);margin-top:8px">Боль с другой стороны: проверьте обе стороны руками</div>' : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);margin-top:var(--s3)"><button class="btn${conf[s.key] === 'yes' ? '' : ' line'}" data-chk="${s.key}" data-v="yes" style="height:48px;border-radius:var(--r-sm);font-size:15px">${conf[s.key] === 'yes' ? ic('check', 's') + 'Подтверждено' : 'Подтверждаю'}</button><button class="btn line" data-chk="${s.key}" data-v="no" style="height:48px;border-radius:var(--r-sm);font-size:15px">${conf[s.key] === 'no' ? 'Убрано' : 'Убрать'}</button></div>
      <button class="link" id="tohyp">${hypMore > 0 && hypMore < 10 ? `Проверка руками и ещё ${hypMore} ${hypMore === 1 ? 'гипотеза' : hypMore < 5 ? 'гипотезы' : 'гипотез'}` : 'Проверка руками и все гипотезы'}</button></div>`; }).join('')}
    <div><div class="eyebrow" style="color:${decided.length ? 'var(--ink)' : 'var(--short-t)'}">${decided.length ? 'Решение специалиста' : 'Решение · черновик'}</div><div style="margin-top:8px">${verdictCard(decided.length ? decided : top, an.findings, undefined, facts.map(f => f.observed.replace(' (на границе нормы)', '')))}</div>${(a.plan && a.plan.ex && a.plan.ex.length) ? `<button class="link" id="toplan">Назначение: ${a.plan.ex.length} упр.</button>` : '<button class="link" id="mkplan">Собрать упражнения по решению</button>'}</div>
    <div class="card" style="padding:12px 14px"><div class="eyebrow">Заметка к визиту</div><textarea id="vnote" rows="2" maxlength="1000" placeholder="Что нашли руками, что сказал клиент. Видите только вы" style="width:100%;margin-top:8px;border:0;background:transparent;font:15px Onest;resize:vertical;color:var(--text)">${esc(a.note || '')}</textarea></div>
    ${isBefore ? `<button class="btn line" id="after">${ic('camera', 's')}После сеанса: снять снова</button>` : ''}
    <details class="card"><summary style="font-weight:600">Подробнее: запись, качество, все показатели</summary><div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
    <button class="btn line" id="mv" style="height:48px">${ic('play', 's')}Запись движения</button>
    ${a.demo || a.clientId === 'demo' ? '' : `<button class="btn line" id="rc" style="height:48px">${a.recalc ? 'Пересчитано по новой методике · вернуть исходный расчет' : 'Пересчитать по новой методике'}</button>`}
    ${a.expect ? `<div class="group" style="padding:var(--s4)"><div class="eyebrow">Ваше ожидание до теста</div><p style="font-size:15px;line-height:1.45;margin-top:6px">${esc(a.expect)}</p>
      <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">${[['yes', 'Совпало'], ['part', 'Частично'], ['no', 'Не совпало']].map(([k, n]) => `<button class="pill ${a.expectMatch === k ? 'on' : ''}" data-em="${k}">${n}</button>`).join('')}</div></div>` : ''}
    ${q.length ? `<div class="group" style="padding:var(--s4)"><div class="eyebrow">Качество съемки${qa != null ? ' · ' + qa + ' из 100' : ''}</div>${q.map(([k, v]) => `<div class="row" style="margin-top:8px;font-size:14px"><span style="flex:1">${esc(QNAMES[k] || k)}</span><b class="num" style="color:${v < 60 ? 'var(--over-t)' : 'var(--text)'}">${esc(v)}${v < 60 ? ' · не для строгого сравнения' : ''}</b></div>`).join('')}</div>` : ''}
    ${a.limits && Object.keys(a.limits).length ? `<div class="group" style="padding:var(--s4)"><div class="eyebrow" style="color:var(--short-t)">Не смог выполнить</div>${Object.entries(a.limits).map(([u, l]) => `<div style="margin-top:8px;font-size:14px"><b>${esc(UNIT_NAMES[u] || u)}</b>: ${esc([...(l.reasons || []), l.level, l.side && l.side !== 'BOTH' ? (l.side === 'LEFT' ? 'слева' : 'справа') : ''].filter(Boolean).join(', ').toLowerCase())}${l.alt ? ' · сделан вариант с опорой' : ''}</div>`).join('')}</div>` : ''}
    ${Object.values(a.pain || {}).some(v => v > 0) ? `<div class="group" style="padding:var(--s4)"><div class="eyebrow">Боль до теста${a.painSide ? ' · ' + ({ LEFT: 'слева', RIGHT: 'справа', BOTH: 'с двух сторон' })[a.painSide] : ''}${a.lumbarZone ? ' · поясница: ' + ({ LOW: 'низ', MID: 'середина', UPPER: 'верх' })[a.lumbarZone] : ''}</div>${PAIN.filter(([k]) => a.pain[k] > 0).map(([k, n]) => `<div class="row" style="margin-top:6px"><span style="flex:1">${n}</span><b class="num">${a.pain[k]} / 10</b></div>`).join('')}</div>` : ''}
    <details class="group" style="padding:var(--s2) var(--s4)"><summary style="font-weight:600">Все показатели</summary>${Object.entries(an.f).filter(([k, v]) => typeof v === 'number' && !k.startsWith('const')).map(([k, v]) => { const mt = METRICS.find(x => x[0] === k); return `<div class="row" style="font-size:13px;margin-top:4px"><span style="flex:1;${mt ? '' : 'font:500 12px var(--mono);'}color:var(--sub)">${mt ? mt[1] : k}</span><b class="num">${fmt(v)}${mt ? mt[2] : ''}</b></div>`; }).join('')}</details></div></details>`;
    dock = `<div class="dock bar"><button class="btn line" id="rt" style="width:56px;flex:none;padding:0" aria-label="${a.nextDate && a.retestSet ? 'Ретест ' + fmtDate(a.nextDate) + ' назначен' : 'Ретест через 30 дней'}">${ic(a.nextDate && a.retestSet ? 'check' : 'rotate-ccw')}</button><button class="btn" id="send">Отправить клиенту</button></div>`; }
  if (view === 'hyp') { const chk = a.check || {}, list = hypList(a, sp, top);
    const testable = list.filter(s => C.muscles[s.id] && C.muscles[s.id].proTest);
    body = `
    <div class="card" style="padding:12px 8px"><div class="seg" style="margin:0 4px"><button id="hf" class="on">Спереди</button><button id="hb">Сзади</button>${device.webgl2 ? '<button id="h3">3D</button>' : ''}</div>
      <div id="hvis" style="width:100%;max-width:360px;margin:8px auto 0"><canvas id="heat" style="width:100%;display:block"></canvas></div>
      <div id="hz" class="row" style="display:none;gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 8px 0">${[['all', 'Всё тело'], ['head', 'Шея'], ['shoulders', 'Плечи'], ['back', 'Спина'], ['pelvis', 'Таз'], ['knees', 'Колени'], ['feet', 'Стопы']].map(([z, n]) => `<button class="pill" data-z="${z}">${n}</button>`).join('')}</div></div>
    <p class="sub" style="font-size:14px">Черновик по замеру и цепям. Проверьте руками: в отчёт пойдёт ваша версия. Уверенность считается по опыту, исследованиям и замеру.</p>
    <div id="hlist" style="display:flex;flex-direction:column;gap:var(--s3)">${list.map((s, i) => hypCard(a, an, s, i === list.findIndex(x => C.muscles[x.id] && C.muscles[x.id].proTest && !chk[x.key]), evid)).join('')}</div>`;
    dock = `<div class="dock bar"><div style="flex:1;font-size:14px;align-self:center">Проверено руками <b class="num" id="hcnt">${testable.filter(s => chk[s.key]).length} из ${testable.length}</b></div><button class="btn line" id="addm" style="width:auto;padding:0 18px">${ic('plus', 's')}Мышца</button></div>`; }
  if (view === 'plan') { const pl = a.plan || { ex: plan(top), text: '' }; const recs = muscleRecs(a);
    body = `<div class="card"><div class="row"><div class="eyebrow" style="flex:1">Рекомендации по мышцам</div>${recs.length ? '<button class="pill" id="addall" style="font-size:12px">Добавить все</button>' : ''}</div>
      ${recs.length ? recs.map((r, i) => `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line-2)"><div class="row"><i class="bar" style="background:${TONE_HEX[r.s.k]};height:22px"></i><b style="flex:1;font-size:15px">${r.head}</b>${r.all.length ? `<button class="pill" data-add="${i}" style="font-size:12px">Добавить</button>` : ''}</div>
        ${r.out.map(([h, t]) => `<div style="font-size:14px;margin-top:6px;line-height:1.4"><b>${h}:</b> ${t}</div>`).join('')}</div>`).join('') : '<p class="sub" style="margin-top:8px">Значимых отклонений нет.</p>'}</div>
    <div class="card"><div class="eyebrow">Упражнения</div><input id="exq" class="field" type="search" placeholder="Найти упражнение или мышцу" style="margin-top:8px;height:44px" aria-label="Поиск упражнения">${Object.values(C.exercises).filter(e => !e.id.endsWith('_right') || pl.ex.includes(e.id)).sort((x, y) => (pl.ex.includes(y.id) - pl.ex.includes(x.id)) || x.title.localeCompare(y.title)).map(e => `<label class="row" data-exq="${esc([e.title, e.goal, e.category].filter(Boolean).join(' ').toLowerCase())}" style="margin-top:8px;font-size:15px"><input type="checkbox" data-e="${e.id}" ${pl.ex.includes(e.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--ink)"><span style="flex:1">${e.title.split(' (')[0]}${e.id.endsWith('_right') ? ' (правая)' : e.id.endsWith('_left') && pl.ex.includes(e.id) ? ' (левая)' : ''}</span><span style="font-size:12px;color:var(--sub)">${e.dose || ''}</span></label>`).join('')}</div>
      <div class="card"><div class="eyebrow">Комментарий для клиента</div><textarea id="pt" rows="4" class="field" style="margin-top:8px;height:auto;padding:12px 16px;font-size:15px">${esc(pl.text)}</textarea><button class="btn line" id="dict" style="height:48px;margin-top:8px">${ic('mic', 's')}Надиктовать</button></div>
      <div class="card row"><span style="flex:1">Повторный тест</span><input type="date" id="nd" value="${Number.isFinite(+a.nextDate) && +a.nextDate > 0 ? new Date(+a.nextDate).toISOString().slice(0, 10) : ''}" class="field" style="width:auto;height:48px;padding:0 10px;font-size:15px"></div>`; }
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>${esc(c.name)}</b><small>${esc(a.templateName)} · ${fmtDate(a.date)}${qa != null ? ' · качество ' + qa : ''}</small></div>
      <button class="round" id="rep" aria-label="Отчёт клиенту">${ic('file-text')}</button>${a.prevId ? `<button class="round" id="cmp" aria-label="Было → стало">${ic('arrow-right-left')}</button>` : ''}<button class="link" id="fin" style="padding:0 8px">${a.draft ? 'Сохранить' : 'Готово'}</button></div>
    <div class="pad" style="margin-top:var(--s2)"><div class="seg">${tab('measured', 'Итог')}${tab('hyp', 'Гипотеза')}${tab('plan', 'Назначение')}</div></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s3);padding-bottom:var(--s5)">${body}</div>${dock}</div>`);
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = async () => { await savePlan(a); result(aid, b.dataset.v); });
  if ($('#rc')) $('#rc').onclick = async () => { $('#rc').textContent = 'Считаю…'; await recalc(a); const y = scrollY; await result(aid, view); scrollTo(0, y); };
  if (view === 'measured') { let bk = numLabels.filter(l => sp.find(x => x.key === l.key).back).length > numLabels.length / 2, first = !REVEALED.has(aid); REVEALED.add(aid); const lab = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 3)).map(s => ({ key: s.key, title: (SHORT[s.id] || C.muscles[s.id].name) + (s.side === 'RIGHT' ? ' · П' : ' · Л'), sub: toneText(s, 0).toLowerCase(), color: TONE_HEX[s.k], text: TONE_TEXT_HEX[s.k] }));
    const dh = () => drawHeat($('#heat'), sp, bk, null, numLabels, { reveal: first }); dh(); first = false; if (bk) { $('#mb2').classList.add('on'); $('#mf').classList.remove('on'); }
    $('#mf').onclick = () => { bk = false; $('#mf').classList.add('on'); $('#mb2').classList.remove('on'); dh(); }; $('#mb2').onclick = () => { bk = true; $('#mb2').classList.add('on'); $('#mf').classList.remove('on'); dh(); };
    if ($('#tohyp')) $('#tohyp').onclick = () => result(aid, 'hyp');
    if ($('#toplan')) $('#toplan').onclick = () => result(aid, 'plan');
    if ($('#mkplan')) $('#mkplan').onclick = async () => { await savePlan(a); a.plan = a.plan || { ex: [], text: '' }; a.plan.ex = [...new Set([...a.plan.ex, ...muscleRecs(a).flatMap(r => r.all)])].slice(0, 8); await put('assessments', a); result(aid, 'plan'); };
    if ($('#after')) $('#after').onclick = async () => { a.draft = false; await put('assessments', a); newAssessment(a.clientId, a.id); };
    $('#send').onclick = async () => { track('report_sent'); await savePlan(a); a.draft = false; await put('assessments', a); report(aid); };
    $('#rt').onclick = async () => { track('retest_set'); a.nextDate = Date.now() + 30 * DAY; a.retestSet = true; a.draft = false; await put('assessments', a); $('#rt').innerHTML = ic('check'); $('#rt').setAttribute('aria-label', 'Ретест ' + fmtDate(a.nextDate) + ' назначен'); toast('Ретест ' + fmtDate(a.nextDate)); }; }
  if ($('#mv')) $('#mv').onclick = async () => { const pp = await get('poses', aid); motionViewer(pp && pp.poses, a.setup, () => result(aid), `${c.name} · ${fmtDate(a.date)}`); };
  $('#back').onclick = async () => { await savePlan(a); clientCard(a.clientId); };
  $('#rep').onclick = async () => { await savePlan(a); a.draft = false; await put('assessments', a); report(aid); };
  if ($('#cmp')) $('#cmp').onclick = async () => { await savePlan(a); a.draft = false; await put('assessments', a); compare(a.prevId, aid); };
  $('#fin').onclick = async () => { await savePlan(a); a.draft = false; await put('assessments', a); clientCard(a.clientId); };
  if ($('#vnote')) { let tm = 0; $('#vnote').oninput = e => { clearTimeout(tm); tm = setTimeout(async () => { a.note = e.target.value.slice(0, 1000); await put('assessments', a); }, 600); }; }
  document.querySelectorAll('[data-em]').forEach(btn => btn.onclick = async () => { a.expectMatch = a.expectMatch === btn.dataset.em ? null : btn.dataset.em; await put('assessments', a); const y = scrollY; await result(aid, view); scrollTo(0, y); });
  if (view === 'measured') document.querySelectorAll('[data-chk]').forEach(btn => btn.onclick = async () => { a.check = a.check || {}; const k = btn.dataset.chk;
    a.check[k] = a.check[k] === btn.dataset.v ? undefined : btn.dataset.v; if (!a.check[k]) delete a.check[k];
    if (btn.dataset.v === 'no' && a.check[k]) { const from = (sp.find(x => x.key === k) || {}).k; a.hyp = a.hyp || {}; a.hyp[k] = 'OK'; a.hypWhy = { ...(a.hypWhy || {}), [k]: 'не подтвердилось руками' }; await logOverride(a, k, from, 'OK', 'не подтвердилось руками'); } // в отчет как норма, в журнал правок с причиной
    if (btn.dataset.v === 'yes' && a.hyp && a.hyp[k] === 'OK') delete a.hyp[k];
    await put('assessments', a); const y = scrollY; await result(aid, view); scrollTo(0, y); });
  if (view === 'hyp') { let back = false; const lab = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 4)).map(s => ({ key: s.key, title: (SHORT[s.id] || C.muscles[s.id].name) + (s.side === 'RIGHT' ? ' · П' : ' · Л'), sub: toneText(s, 0).toLowerCase(), color: TONE_HEX[s.k], text: TONE_TEXT_HEX[s.k] }));
    let v3 = null, mode3 = false, cur = sp;
    const draw2 = () => { if (mode3) { if (v3) v3.turn(back); return; } drawHeat($('#heat'), cur, back, null, lab); }; draw2();
    $('#hf').onclick = async () => { if (mode3) await $('#h3').onclick(); back = false; $('#hf').classList.add('on'); $('#hb').classList.remove('on'); draw2(); }; $('#hb').onclick = async () => { if (mode3) await $('#h3').onclick(); back = true; $('#hb').classList.add('on'); $('#hf').classList.remove('on'); draw2(); };
    // 3D-модель с той же картой (с правками специалиста); касание мышцы прокручивает к ее карточке
    if ($('#h3')) $('#h3').onclick = async () => { mode3 = !mode3; HYP3D = mode3; $('#h3').classList.toggle('on', mode3); $('#hf').classList.toggle('on', !mode3 && !back); $('#hb').classList.toggle('on', !mode3 && back); $('#hz').style.display = mode3 ? 'flex' : 'none';
      if (!mode3) { if (v3) v3.dispose(); v3 = null; $('#hvis').style.height = ''; $('#hvis').innerHTML = '<canvas id="heat" style="width:100%;display:block"></canvas>'; draw2(); return; }
      $('#hvis').style.height = '380px'; try { v3 = await body3D($('#hvis'), cur, key => { const el = document.querySelector(`[data-card="${key}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); }
      catch (e) { toast('3D не загрузилось, показываю схему'); mode3 = true; return $('#h3').onclick(); }
      v3.turn(back); document.querySelectorAll('[data-z]').forEach(b => b.onclick = () => v3.focus(b.dataset.z)); };
    if (HYP3D && $('#h3')) { HYP3D = false; $('#h3').click(); }
    // правка на месте: перерисовываются только карточка, схема или 3D и счетчик
    const refresh = key => { cur = proSpots(a); const s = cur.find(x => x.key === key) || cur.find(x => x.key === key);
      const el = document.querySelector(`[data-card="${key}"]`); if (el && s) { const open = el.querySelector('details') && el.querySelector('details').open; el.outerHTML = hypCard(a, an, s, open, evid); bindCard(document.querySelector(`[data-card="${key}"]`)); }
      if (mode3 && v3) v3.update(cur); else if ($('#heat')) drawHeat($('#heat'), cur, back, null, lab);
      const list = hypList(a, cur, top), testable = list.filter(x => C.muscles[x.id] && C.muscles[x.id].proTest), chk = a.check || {}; $('#hcnt').textContent = `${testable.filter(x => chk[x.key]).length} из ${testable.length}`; };
    const bindCard = el => {
      el.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { const key = b.dataset.k, to = b.dataset.s, s = cur.find(x => x.key === key), from = s ? s.k : null; if (to === from) return;
        const why = await whySheet(`${ntitle(s)} → ${STATE4.find(x => x[0] === to)[1].toLowerCase()}`); if (!why) return;
        a.hyp = a.hyp || {}; a.hyp[key] = to; a.hypWhy = { ...(a.hypWhy || {}), [key]: why }; await logOverride(a, key, from, to, why); await put('assessments', a); refresh(key); });
      el.querySelectorAll('[data-chk]').forEach(btn => btn.onclick = async () => { a.check = a.check || {}; const k = btn.dataset.chk;
        a.check[k] = a.check[k] === btn.dataset.v ? undefined : btn.dataset.v; if (!a.check[k]) delete a.check[k];
        if (btn.dataset.v === 'no' && a.check[k]) { a.hyp = a.hyp || {}; a.hyp[k] = 'OK'; a.hypWhy = { ...(a.hypWhy || {}), [k]: 'не подтвердилось руками' }; } // не подтвердилось руками: в отчет как норма
        if (btn.dataset.v === 'yes' && a.hyp && a.hyp[k] === 'OK') delete a.hyp[k];
        await put('assessments', a); refresh(k); });
      el.querySelectorAll('[data-conf]').forEach(b => b.onclick = () => { const s = cur.find(x => x.key === el.dataset.card); confSheet(scoreSpot(s, an.findings, evid), () => result(aid, 'hyp')); }); };
    document.querySelectorAll('[data-card]').forEach(bindCard);
    $('#addm').onclick = () => { const d = document.createElement('div'); d.className = 'sheet';
      d.innerHTML = `<div><h2>Добавить мышцу</h2>
        <select id="mm" class="field" style="margin-top:12px;padding:0 10px">${Object.entries(C.muscles).sort((x, y) => (x[1].zone || '').localeCompare(y[1].zone || '')).map(([id, m]) => `<option value="${id}">${m.zone || m.name} — ${m.name}</option>`).join('')}</select>
        <div class="seg" style="margin-top:10px"><button id="sl" class="on">Левая</button><button id="sr">Правая</button></div>
        <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">${STATES.filter(x => x[0] !== 'OK').map(([k, n], i) => `<button class="pill" data-ns="${k}" style="border:1.5px solid ${i ? 'transparent' : 'var(--ink)'}">${n}</button>`).join('')}</div>
        <button class="btn" id="ma" style="margin-top:14px">Добавить</button><button class="btn ghost" id="mx" style="margin-top:8px;border:0">Отмена</button></div>`;
      document.body.appendChild(d); let side = 'LEFT', st = 'HYPER';
      d.querySelector('#sl').onclick = () => { side = 'LEFT'; d.querySelector('#sl').classList.add('on'); d.querySelector('#sr').classList.remove('on'); };
      d.querySelector('#sr').onclick = () => { side = 'RIGHT'; d.querySelector('#sr').classList.add('on'); d.querySelector('#sl').classList.remove('on'); };
      d.querySelectorAll('[data-ns]').forEach(b => b.onclick = () => { st = b.dataset.ns; d.querySelectorAll('[data-ns]').forEach(x => x.style.borderColor = x === b ? 'var(--ink)' : 'transparent'); });
      d.querySelector('#mx').onclick = () => d.remove();
      d.querySelector('#ma').onclick = async () => { a.hyp = a.hyp || {}; a.hyp[d.querySelector('#mm').value + ':' + side] = st; await put('assessments', a); d.remove(); result(aid, 'hyp'); }; }; }
  if (view === 'plan') { $('#dict').onclick = () => dictate($('#pt'), $('#dict'));
    $('#exq').oninput = e => { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('[data-exq]').forEach(l => { l.hidden = !!q && !l.dataset.exq.includes(q); }); };
    const recs = muscleRecs(a); const addIds = async list => { await savePlan(a); a.plan = a.plan || { ex: [], text: '' }; a.plan.ex = [...new Set([...a.plan.ex, ...list])]; await put('assessments', a); const y = scrollY; await result(aid, 'plan'); scrollTo(0, y); };
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addIds(recs[+b.dataset.add].all));
    if ($('#addall')) $('#addall').onclick = () => addIds(recs.flatMap(r => r.all)); }
}
/** Пересчет по сохраненной записи скелета; исходный расчет хранится, чтобы можно было вернуться. Повторное нажатие возвращает исходный. */
async function recalc(a) {
  if (a.recalc && a.orig) { Object.assign(a, a.orig); delete a.orig; delete a.recalc; await put('assessments', a); return; }
  const pp = await get('poses', a.id), poses = (pp && pp.poses) || {}; const W = (a.setup && a.setup.w) || 720, H = (a.setup && a.setup.h) || 1280;
  const frames = k => { const pk = poses[k]; if (!pk || !pk.n) return []; const fr = unpack(pk, W, H).map(f => ({ t: f.t, p: f.p.map(l => ({ x: l.x, y: l.y, visibility: l.v })) }));
    const w = unpackWorld(pk); if (w) fr.forEach((f, i) => { f.w = w[i]; }); return fr; };
  const r = recompute(a, frames); a.orig = { snapshot: a.snapshot, side: a.side, moves: a.moves }; Object.assign(a, r); a.recalc = Date.now(); await put('assessments', a);
}
/** Рекомендации по конкретным мышцам: что отпустить, что включить, чем закрепить. Из правок специалиста и черновика. */
function muscleRecs(a) {
  const sp = proSpots(a).filter(s => s.k !== 'OK' && (!s.derived || s.edited || s.byChain)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone)).slice(0, 8);
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
// копия кабинета: в ней жалобы и боль клиентов, поэтому только зашифрованная паролем (PBKDF2 + AES-GCM, ключ не покидает телефон)
const te = new TextEncoder(), td = new TextDecoder();
const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pwKey(pw, salt) { const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
async function seal2(obj, pw) { const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await pwKey(pw, salt), te.encode(JSON.stringify(obj))));
  return { app: 'bodypassport-pro', v: 2, created: Date.now(), enc: { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) } }; }
async function open2(d, pw) { const k = await pwKey(pw, fromB64(d.enc.salt));
  return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(d.enc.iv) }, k, fromB64(d.enc.ct)))); }
function pwSheet(title, text, twice) {
  return new Promise(res => { const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div><h2>${title}</h2><p class="sub" style="font-size:14px;margin-top:6px">${text}</p>
      <input class="field" id="pw1" type="password" autocomplete="new-password" placeholder="Пароль, от 6 символов" style="margin-top:var(--s4);height:48px">
      ${twice ? '<input class="field" id="pw2" type="password" autocomplete="new-password" placeholder="Повторите пароль" style="margin-top:var(--s2);height:48px">' : ''}
      <p id="pwe" class="sub" style="font-size:13px;min-height:18px;margin-top:6px;color:var(--over-t)"></p>
      <button class="btn" id="pwok">${twice ? 'Зашифровать и сохранить' : 'Открыть копию'}</button><button class="btn ghost" id="pwx" style="margin-top:var(--s2)">Отмена</button></div>`;
    document.body.appendChild(d); const done = v => { d.remove(); res(v); }; setTimeout(() => d.querySelector('#pw1').focus(), 50);
    d.querySelector('#pwok').onclick = () => { const a = d.querySelector('#pw1').value, b = twice ? d.querySelector('#pw2').value : a;
      if (a.length < 6) return d.querySelector('#pwe').textContent = 'Нужно хотя бы 6 символов'; if (a !== b) return d.querySelector('#pwe').textContent = 'Пароли не совпадают'; done(a); };
    d.querySelector('#pwx').onclick = () => done(null); }); }
async function backup() {
  const pw = await pwSheet('Копия кабинета', 'В копии жалобы и боль клиентов, поэтому она шифруется паролем. Запишите пароль: без него копию не открыть, восстановить его нельзя.', true); if (!pw) return;
  toast('Шифрую…');
  const data = { app: 'bodypassport-pro', v: 1, created: Date.now(), clients: await all('clients'), assessments: await all('assessments'), poses: await all('poses'), meta: await all('meta') };
  const blob = new Blob([JSON.stringify(await seal2(data, pw))], { type: 'application/json' }); const name = `bodypassport-${new Date().toISOString().slice(0, 10)}.bpbackup`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Копия кабинета BodyPassport' }); } catch (e) { return; } }
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  track('backup_done', { n: data.clients.length }, false); await setMeta('lastBackup', Date.now()); proHome();
}
const okRows = (rows, key) => Array.isArray(rows) && rows.every(x => x && typeof x === 'object' && typeof x[key] === 'string' && x[key].length < 100);
async function restore(file) {
  try { let d = JSON.parse(await file.text()); if (!d || d.app !== 'bodypassport-pro') throw new Error('Это не копия BodyPassport');
    if (d.enc) { const pw = await pwSheet('Открыть копию', 'Введите пароль, который задали при сохранении копии.'); if (!pw) return;
      try { d = await open2(d, pw); } catch (e) { throw new Error('Неверный пароль или файл поврежден'); } }
    if (!okRows(d.clients, 'id') || !okRows(d.assessments, 'id') || !okRows(d.poses || [], 'assessmentId') || !okRows(d.meta || [], 'k')) throw new Error('Файл поврежден');
    if (d.assessments.some(a => !d.clients.some(c => c.id === a.clientId))) throw new Error('В копии оценки без клиентов, файл поврежден');
    // снимок текущей базы перед восстановлением: «Отменить восстановление» в меню вернет как было
    const snap = { created: Date.now(), clients: await all('clients'), assessments: await all('assessments'), poses: await all('poses'), meta: await all('meta') };
    await snapSave(snap);
    const have = new Set((await all('meta')).map(m => m.k));
    for (const x of d.clients) await put('clients', x); for (const x of d.assessments) await put('assessments', x); for (const x of d.poses || []) await put('poses', x);
    for (const x of d.meta || []) if (!have.has(x.k)) await put('meta', x); // свои настройки (имя, контакт, специализация) не затираем
    track('restore_done', { n: d.clients.length }, false);
    toast(`Восстановлено клиентов: ${d.clients.length}, оценок: ${d.assessments.length}`); proHome(); }
  catch (e) { toast('Не удалось восстановить: ' + e.message); }
}
// подтверждение своей шторкой вместо системного confirm(), который выглядит как ошибка браузера
function confirm2(text, ok = 'Да', danger = true) {
  return new Promise(res => { const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div><h2 style="font-size:20px;line-height:1.3">${esc(text)}</h2><button class="btn" id="cfy" style="margin-top:var(--s5);${danger ? 'background:var(--over-t)' : ''}">${esc(ok)}</button><button class="btn ghost" id="cfn" style="margin-top:var(--s2)">Отмена</button></div>`;
    document.body.appendChild(d); const done = v => { d.remove(); res(v); };
    d.querySelector('#cfy').onclick = () => done(true); d.querySelector('#cfn').onclick = () => done(false); d.onclick = e => { if (e.target === d) done(false); }; }); }
// снимок в отдельной базе этого аккаунта
const snapName = () => nameFor() + '-snap';
async function snapSave(v) { const d = await openDb(snapName()); await new Promise((ok, no) => { const t = d.transaction('meta', 'readwrite'); t.objectStore('meta').put({ k: 'snap', v }); t.oncomplete = ok; t.onerror = () => no(t.error); }); d.close(); }
async function snapLoad() { const d = await openDb(snapName()); const r = await new Promise(ok => { const q = d.transaction('meta').objectStore('meta').get('snap'); q.onsuccess = () => ok(q.result && q.result.v); q.onerror = () => ok(null); }); d.close(); return r; }
async function undoRestore() { const v = await snapLoad(); if (!v) return toast('Нечего отменять');
  if (!(await confirm2(`Вернуть кабинет как было ${fmtDate(v.created)}? Клиенты из копии, которых не было раньше, исчезнут.`))) return;
  const d = await db(); await new Promise((ok, no) => { const t = d.transaction(['clients', 'assessments', 'poses', 'meta'], 'readwrite');
    for (const st of ['clients', 'assessments', 'poses', 'meta']) { const o = t.objectStore(st); o.clear(); v[st].forEach(x => o.put(x)); } t.oncomplete = ok; t.onerror = () => no(t.error); });
  indexedDB.deleteDatabase(snapName()); toast('Вернул как было'); proHome(); }

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
  const ctx = cv.getContext('2d'), dpr = devicePixelRatio, W = cv.width = cv.clientWidth * dpr, H = cv.height = cv.clientHeight * dpr;
  ctx.clearRect(0, 0, W, H); const sc = H / 1.32, ox = W / 2, oy = H * .9;
  const P = l => [ox + l.x * sc, oy + l.y * sc];
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
  const sk = (fr, color, width, dash) => { const f = fr[Math.min(fr.length - 1, Math.round(k * (fr.length - 1)))]; if (!f) return; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.setLineDash(dash);
    for (const [i, j] of BONES) { if (f.p[i].v < .3 || f.p[j].v < .3) continue; ctx.beginPath(); ctx.moveTo(...P(f.p[i])); ctx.lineTo(...P(f.p[j])); ctx.stroke(); }
    const h = P(f.p[0]); ctx.beginPath(); ctx.arc(h[0], h[1], sc * .045, 0, 7); ctx.stroke(); ctx.setLineDash([]); };
  sk(ghost, 'rgba(255,255,255,.3)', 3 * dpr, [4 * dpr, 5 * dpr]); sk(cur, '#D4F25A', 3.5 * dpr, []);
}

// пороги «существенного изменения»: меньше — это погрешность съемки (до собственной валидации — консервативные значения).
// Колено внутрь: минимальное обнаружимое изменение 2D-угла 7,5–8,9° (Munro 2011, doi:10.1123/jsr.21.1.7), берем 8°
const METRICS = [['sq_depth', 'Глубина приседа (сгибание колен)', '°', 8, true], ['valgus_max', 'Колено внутрь в приседе', '°', 8], ['sls_valgus_r', 'Колено внутрь, правая нога', '°', 8], ['sls_valgus_l', 'Колено внутрь, левая нога', '°', 8],
  ['sls_drop_r', 'Провал таза, на правой', '°', 2.5], ['sls_drop_l', 'Провал таза, на левой', '°', 2.5], ['sq_shift', 'Сдвиг таза в приседе', '', .12], ['sq_lean', 'Наклон корпуса в приседе', '°', 5],
  ['sq_arms', 'Руки падают вперед', '°', 6], ['oh_reach', 'Руки вверх: не хватает до вертикали', '°', 8], ['shoulder_shift', 'Плечи впереди таза (сбоку)', '', .02], ['knee_hyper', 'Переразгибание колен', '°', 3], ['shoulder_tilt', 'Перекос плеч', '°', 2], ['pelvic_tilt', 'Перекос таза', '°', 2], ['head_forward', 'Голова вперед', '°', 4],
  ['asym_delt', 'Разница рук в стороны', '°', 6], ['asym_bend', 'Разница наклонов', '°', 5], ['asym_calf', 'Разница икр', '%', 15], ['asym_quad', 'Разница глубины на одной ноге', '°', 8]];
// сторона гипотезы не совпала со стороной боли: частая ловушка при компенсации, специалисту стоит проверить обе
const sideClash = (a, s) => (a.painSide === 'LEFT' || a.painSide === 'RIGHT') && (s.side === 'LEFT' || s.side === 'RIGHT') && s.side !== a.painSide;
// можно ли честно сравнивать два теста: та же постановка (рост в кадре ±10%) и среднее качество съемки не ниже 60
function comparable(pa, ca) {
  const qa = x => { const v = Object.values(x.quality || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 100; };
  const bf0 = pa.setup && pa.setup.bodyFrac, bf1 = ca.setup && ca.setup.bodyFrac, setupOk = !(bf0 > 0 && bf1 > 0) || Math.abs(bf1 - bf0) / bf0 <= .1;
  return { setupOk, qualityOk: Math.min(qa(pa), qa(ca)) >= 60, ok: setupOk && Math.min(qa(pa), qa(ca)) >= 60 };
}
function deltas(pa, ca) {
  const f0 = analyze(pa, C).f, f1 = analyze(ca, C).f;
  return METRICS.filter(([k]) => Number.isFinite(f0[k]) && Number.isFinite(f1[k])).map(([k, n, u, thr, up]) => { const was = Math.abs(f0[k]), now = Math.abs(f1[k]), d = now - was;
    return { k, n, u, was, now, d, state: Math.abs(d) < thr ? 'same' : (up ? d > 0 : d < 0) ? 'better' : 'worse' }; });
}

export async function compare(prevId, curId) {
  { const pa = await get('assessments', prevId), ca = await get('assessments', curId); const same = pa && ca && Math.abs(ca.date - pa.date) < 12 * 3600e3; if (!same && !gate('compare')) return; } // до/после одного сеанса доступно всем
  const [pa, ca, pp, cp] = await Promise.all([get('assessments', prevId), get('assessments', curId), get('poses', prevId), get('poses', curId)]);
  const c = await get('clients', ca.clientId);
  const keys = Object.keys((cp && cp.poses) || {}).filter(k => pp && pp.poses && pp.poses[k]);
  let key = keys.includes('ohs_front') ? 'ohs_front' : keys[0], k = 0, playing = true, raf = 0;
  const ds = deltas(pa, ca), main = [...ds].sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0], rest = ds.filter(x => x !== main);
  const painRows = PAIN.filter(([z]) => (pa.pain || {})[z] > 0 || (ca.pain || {})[z] > 0);
  const qa = x => { const v = Object.values(x.quality || {}); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '—'; };
  const { setupOk, qualityOk } = comparable(pa, ca);
  const badge = st => st === 'better' ? `<span style="color:var(--ok-t);display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:600">${ic('check', 's')}лучше</span>` : st === 'worse' ? '<span style="color:var(--over-t);display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600"><i class="dia"></i>хуже</span>' : '<span style="color:var(--sub);font-size:13px">без изм.</span>';
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Было → стало</b><small>${esc(c.name)} · ${fmtDate(pa.date)} → ${fmtDate(ca.date)}</small></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s2);padding-bottom:var(--s4)">
   ${keys.length ? `<div style="position:relative;height:260px;border-radius:var(--r-lg);background:var(--cam-bg);overflow:hidden"><canvas id="cv" style="width:100%;height:100%;display:block"></canvas>
       <span class="eyebrow" style="position:absolute;right:14px;top:12px;color:var(--cam-sub)">${REP_TESTS.includes(key) ? 'нижняя точка приседа' : esc(QNAMES[key] || key)}</span>
       <div style="position:absolute;left:14px;bottom:12px;font-size:12px;color:var(--cam-sub);display:flex;gap:12px"><span>— — ${new Date(pa.date).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span><span style="color:var(--signal)">▬ сегодня</span></div>
       <button class="round glass" id="pp" aria-label="Пауза" style="position:absolute;right:10px;bottom:8px;width:44px;height:44px">${ic('pause', 's')}</button></div>
     <input type="range" id="ph" min="0" max="1000" value="0" style="width:100%;accent-color:var(--ink)" aria-label="Фаза движения">
     ${keys.length > 1 ? `<div class="row" style="gap:6px;flex-wrap:wrap">${keys.map(x => `<button class="pill ${x === key ? 'on' : ''}" data-k="${esc(x)}">${esc(QNAMES[x] || x)}</button>`).join('')}</div>` : ''}` : ''}
   ${main ? `<div class="card"><div style="font-size:14px;color:var(--sub)">${main.n}</div><div class="row" style="margin-top:6px"><div class="delta" style="flex:1"><s>${fmt(main.was)}${main.u}</s><span style="color:var(--faint)">${ic('chevron-right', 's')}</span><b>${fmt(main.now)}${main.u}</b></div>${main.state === 'better' ? `<span style="color:var(--ok-t);display:flex;align-items:center;gap:4px;font-weight:600">${ic('check', 's')}лучше</span>` : badge(main.state)}</div></div>` : '<p class="sub">Нет общих показателей.</p>'}
   ${rest.length || painRows.length ? `<div class="group">${rest.map(x => `<div class="row" style="min-height:56px"><span style="flex:1;font-size:14px">${x.n}</span><span class="num" style="font-size:17px">${fmt(x.was)}${x.u} → <b>${fmt(x.now)}${x.u}</b></span><span style="width:76px;text-align:right">${badge(x.state)}</span></div>`).join('')}
     ${painRows.map(([z, n]) => { const w = (pa.pain || {})[z] || 0, nw = (ca.pain || {})[z] || 0; return `<div class="row" style="min-height:56px"><span style="flex:1;font-size:14px">Боль, ${n.toLowerCase()}</span><span class="num" style="font-size:17px">${w} → <b>${nw}</b> <small style="font-size:13px;color:var(--sub)">/10</small></span><span style="width:76px;text-align:right">${badge(nw < w ? 'better' : nw > w ? 'worse' : 'same')}</span></div>`; }).join('')}</div>` : ''}
   <p style="font-size:12px;color:var(--sub)">${!setupOk ? '<span class="edge">Постановка отличается</span> сравнение приблизительное' : !qualityOk ? `<span class="edge">Качество съемки ниже 60</span> (${qa(pa)} и ${qa(ca)}), сравнение приблизительное` : `Постановка совпала с прошлым тестом · качество ${qa(pa)} и ${qa(ca)}`}. В отчете клиенту при приблизительном сравнении «хуже» не показывается. Изменения меньше погрешности съемки считаются «без изменений».</p>
   </div><div class="dock"><button class="btn" id="rep">Отправить клиенту</button></div></div>`);
  track('compare_open', { c: setupOk ? 'ok' : 'setup' }, false);
  $('#back').onclick = () => { cancelAnimationFrame(raf); result(curId); };
  $('#rep').onclick = () => report(curId);
  if (!keys.length) return;
  let ghost, cur; const load = () => { ghost = prepTrack(pp.poses[key], pa, key); cur = prepTrack(cp.poses[key], ca, key); };
  load(); const cv = $('#cv');
  const loop = () => { if (!cv.isConnected) return; if (playing) { k = (k + 1 / 90) % 1; $('#ph').value = Math.round(k * 1000); } drawPair(cv, ghost, cur, k); raf = requestAnimationFrame(loop); }; loop();
  const pbtn = () => { $('#pp').innerHTML = ic(playing ? 'pause' : 'play', 's'); $('#pp').setAttribute('aria-label', playing ? 'Пауза' : 'Продолжить'); };
  $('#pp').onclick = () => { playing = !playing; pbtn(); };
  $('#ph').oninput = e => { playing = false; pbtn(); k = e.target.value / 1000; };
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { key = b.dataset.k; load(); document.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); });
}

// отчет клиенту: паспорт движения (что увидели, что делаем, было → стало, проверим снова), без технических показателей
async function report(aid) {
  const a = await get('assessments', aid), c = await get('clients', a.clientId), prev = a.prevId ? await get('assessments', a.prevId) : null;
  const author = (await meta('profile')) || defaultAuthor(), contact = await meta('contact');
  const sp = proSpots(a), an = analyze(a, C), top = sp.filter(s => s.k !== 'OK' && (!s.derived || s.edited || s.byChain)).sort((x, y) => Math.abs(y.tone) - Math.abs(x.tone)).slice(0, 5);
  const plain = t => t.replace(/ \(на границе нормы\)/, '').replace(/\s*на\s*[\d,.]+\s*°.*$/, '').replace(/:\s*$/, '');
  const same = prev && Math.abs(a.date - prev.date) < 12 * 3600e3;
  const conf = a.check || {}, decided = sp.filter(s => s.k !== 'OK' && (conf[s.key] === 'yes' || s.edited)).sort((x, y2) => Math.abs(y2.tone) - Math.abs(x.tone));
  const v = verdict(decided.length ? decided : top, an.findings), pl = a.plan || { ex: [], text: '' };
  const sections = [{ h: 'Что увидели', rows: an.findings.slice(0, 3).map(f => ({ text: '• ' + plain(f.observed) })) },
    { h: 'Что делаем', rows: [...v.map(x => ({ k: x.k, text: `${x.verb} ${x.what}` })), ...pl.ex.slice(0, 4).map(id => C.exercises[id]).filter(Boolean).map(e => ({ text: `• ${e.title}${e.dose ? ', ' + e.dose : ''}` })), ...(pl.text ? [{ text: pl.text }] : [])] }];
  let delta = null; const after = [];
  if (prev) { const cmp = comparable(prev, a);
    // при другой постановке или плохой съемке «хуже» может быть ошибкой камеры: клиенту его не показываем, только улучшения с оговоркой
    const ds = deltas(prev, a).filter(x => x.state !== 'same' && (cmp.ok || x.state === 'better')).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)); const h = same ? 'До и после сеанса' : `Было → стало, с ${fmtDate(prev.date)}`;
    if (!cmp.ok) after.push({ h: 'О сравнении', text: cmp.setupOk ? 'Качество съемки в этот раз ниже обычного, сравнение приблизительное.' : 'Телефон стоял иначе, чем в прошлый раз, сравнение приблизительное. В следующий раз поставим так же.' });
    if (ds.length) { const m = ds[0]; delta = { h, name: m.n, was: m.was, now: m.now, u: m.u, state: m.state, note: m.state === 'better' ? (cmp.ok ? 'Лучше' : 'Похоже, лучше') : 'Хуже, разберем на встрече' };
      if (ds.length > 1) after.push({ h: 'Ещё изменения', text: ds.slice(1, 4).map(x => `${x.n}: ${fmt(x.was)}${x.u} → ${fmt(x.now)}${x.u}`).join(' · ') }); }
    else after.push({ h, text: 'Существенных изменений пока нет' });
    const pr = PAIN.filter(([z]) => (prev.pain || {})[z] > 0 || (a.pain || {})[z] > 0); if (pr.length) after.push({ h: 'Боль 0–10', text: pr.map(([z, n]) => `${n}: ${(prev.pain || {})[z] || 0} → ${(a.pain || {})[z] || 0}`).join(' · ') }); }
  if (!same) after.push({ h: 'Проверим снова', text: fmtDate(a.nextDate) + ': тот же тест, сравним с сегодняшним' });
  const checked = Object.keys(a.check || {}).length > 0 || sp.some(s => s.edited);
  const note = 'Предварительная оценка движения по камере телефона, не медицинское заключение. ' + (checked ? 'Выводы проверены специалистом на приеме.' : 'Выводы о мышцах пока не проверены руками.');
  const logo = await meta('logo');
  const cv = await passportImage({ eyebrow: 'ПАСПОРТ ДВИЖЕНИЯ', name: c.name, date: 'Оценка ' + fmtDate(a.date), sp, sections, delta, footer: { name: author, contact: contact ? 'Запись: ' + contact : location.host, after, note, logo }, raw: true });
  // предпросмотр перед отправкой: специалист видит ровно то, что получит клиент
  const base = `bodypassport-${c.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${new Date(a.date).toISOString().slice(0, 10)}`;
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">Отчет клиенту</h2><p class="sub" style="font-size:13px;margin-top:4px">Так его увидит ${esc(c.name)}. PDF удобно распечатать, картинку переслать в мессенджер.</p>
    <div style="margin-top:12px;max-height:46dvh;overflow:auto;border-radius:16px;border:1px solid var(--line)"><img src="${cv.toDataURL('image/jpeg', .8)}" alt="Отчет" style="width:100%;display:block"></div>
    ${logo ? '' : '<button class="link" id="rplg" style="font-size:13px;margin-top:8px">Добавить свой логотип в отчет</button>'}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button class="btn" id="rpdf">${ic('file-text', 's')}PDF</button><button class="btn line" id="rpng">${ic('image', 's')}Картинка</button></div>
    <button class="btn ghost" id="rpx" style="margin-top:8px">Закрыть</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('#rpx').onclick = () => d.remove();
  if (d.querySelector('#rplg')) d.querySelector('#rplg').onclick = () => { d.remove(); profileForm(); };
  const send = async (blob, name, type, kind) => { const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Паспорт движения' }); track('report_shared', { c: kind }, false); } catch (e) {} }
    else { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = name; l.click(); track('report_shared', { c: kind + '_download' }, false); } };
  d.querySelector('#rpdf').onclick = async () => { const b = d.querySelector('#rpdf'); b.disabled = true; b.textContent = 'Собираю PDF…';
    try { const { canvasToPdf } = await import('./pdf.js'); await send(await canvasToPdf(cv, 'BodyPassport'), base + '.pdf', 'application/pdf', 'pdf'); } catch (e) { toast('Не удалось собрать PDF: ' + e.message); }
    b.disabled = false; b.innerHTML = ic('file-text', 's') + 'PDF'; };
  d.querySelector('#rpng').onclick = async () => send(await new Promise(r => cv.toBlob(r, 'image/png')), base + '.png', 'image/png', 'png');
}

// сообщение клиенту о ретесте: текст в мессенджер одним касанием
function messageClient(c, date) {
  const text = `${c.name.split(' ')[0]}, здравствуйте! ${fmtDate(date)} пора повторить тест движения, чтобы увидеть изменения. Когда вам удобно?`;
  if (navigator.share) navigator.share({ text }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(text); toast('Текст скопирован'); }
}


// =================== Ссылка клиенту: тест дома → результат сразу у специалиста ===================
// ящик для результатов выдает и подписывает сервер. Старые ящики (id из браузера) сервер принимает до LEGACY_UNTIL:
// при новой ссылке такой ящик заменяется подписанным, а старый еще читается, чтобы дошли результаты по уже отправленным ссылкам
const LEGACY_UNTIL = Date.parse('2026-11-30T23:59:59Z');
const signedBox = id => typeof id === 'string' && id.length === 46;
async function newBoxId() {
  let r; try { r = await fetch('/api/relay?a=new', { method: 'POST' }); } catch (e) { r = null; }
  if (r && r.ok) { const j = await r.json().catch(() => ({})); if (j.id) return j.id; }
  if (r && r.status === 429) throw new Error('на сегодня создано слишком много ссылок, попробуйте завтра');
  // вход на этом адресе не настроен: до конца переходного периода работает ящик старого формата
  if (Date.now() < LEGACY_UNTIL) return seal.rid();
  throw new Error('войдите в кабинет и попробуйте снова');
}
async function freshBox(b) {
  if (b && signedBox(b.id)) return b;
  const id = await newBoxId(); if (!b) return { id, key: await seal.key() };
  return signedBox(id) ? { id, key: b.key, old: b.id } : b;
}
async function inviteLink(c, units) {
  const fresh = await freshBox(c.invite); if (fresh !== c.invite) { c.invite = fresh; await put('clients', c); }
  const author = (await meta('profile')) || defaultAuthor();
  return location.origin + '/' + (myRef() ? '?ref=' + myRef() : '') + '#inv=' + seal.pack({ i: c.invite.id, k: c.invite.key, n: c.name.split(' ')[0], s: author, p: units });
}
async function sendInvite(c) {
  if (!gate('invite')) return;
  const as = await byClient(c.id); const lastT = as.at(-1); let tpl = TEMPLATES.find(t => t[0] === (lastT && lastT.template)) || TEMPLATES[0];
  const d = document.createElement('div'); d.className = 'sheet';
  const draw = () => { d.innerHTML = `<div><h2>Ссылка клиенту</h2><p class="sub" style="font-size:14px;margin-top:6px">${esc(c.name)} откроет ссылку, пройдет тест дома, и результат сам появится в его карточке. Клиент тоже видит свою карту.</p>
    <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${TEMPLATES.map(t => `<button class="pill" data-t="${t[0]}" style="border:1.5px solid ${tpl[0] === t[0] ? 'var(--ink)' : 'transparent'}">${t[1]}</button>`).join('')}</div>
    <p class="sub" style="font-size:13px;margin-top:8px">${rowsOf(tpl[2]).length} шагов · около ${mins(SETUP_SEC + secs(rowsOf(tpl[2])))} мин</p>
    <button class="btn" id="snd" style="margin-top:14px">Отправить ссылку</button><p style="font-size:12px;color:var(--sub);margin-top:8px">Результат шифруется на телефоне клиента. Ключ есть только у тебя и клиента.</p>
    <button class="btn ghost" id="cx" style="margin-top:8px;border:0">Отмена</button></div>`;
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = TEMPLATES.find(t => t[0] === b.dataset.t); draw(); });
    d.querySelector('#cx').onclick = () => d.remove();
    d.querySelector('#snd').onclick = async () => { let url; try { url = await inviteLink(c, tpl[2]); } catch (e) { toast('Не удалось создать ссылку: ' + e.message); return; } track('invite_sent'); const text = `${c.name.split(' ')[0]}, здравствуйте! Пройдите, пожалуйста, тест движения по ссылке, это 2–4 минуты. Результат сразу придет мне.`;
      if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url); toast('Ссылка скопирована'); } d.remove(); }; };
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
  const a = { id: uid(), clientId: c.id, date: r.date || Date.now(), template: tpl ? tpl[0] : 'custom', templateName: 'По ссылке · ' + (tpl ? tpl[1] : 'свой протокол'), protocol: r.protocol, snapshot: r.snapshot, side: r.side, moves: r.moves, quality: r.quality, setup: r.setup,
    limits: r.limits || {}, pain: r.pain || {}, hyp: {}, plan: null, note: '', nextDate: (r.date || Date.now()) + 30 * DAY, prevId: prev ? prev.id : null, draft: true, source: 'home' };
  await put('assessments', a); await put('poses', { assessmentId: a.id, poses: r.poses || {} });
}
/** Личный «почтовый ящик» специалиста для ссылки новому клиенту. */
async function inbox() { const b = await meta('inbox'), f = await freshBox(b); if (f !== b) await setMeta('inbox', f); return f; }
async function sendJoin() {
  if (!gate('invite')) return;
  let tpl = TEMPLATES[0]; const d = document.createElement('div'); d.className = 'sheet';
  const draw = () => { d.innerHTML = `<div><h2>Ссылка новому клиенту</h2><p class="sub" style="font-size:14px;margin-top:6px">Клиент сам заполнит имя и анкету, пройдет тест, и у тебя появится его карточка с результатом и записью движения. Одну ссылку можно отправлять разным людям.</p>
    <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${TEMPLATES.map(t => `<button class="pill" data-t="${t[0]}" style="border:1.5px solid ${tpl[0] === t[0] ? 'var(--ink)' : 'transparent'}">${t[1]}</button>`).join('')}</div>
    <p class="sub" style="font-size:13px;margin-top:8px">${rowsOf(tpl[2]).length} шагов · около ${mins(SETUP_SEC + secs(rowsOf(tpl[2])))} мин + анкета</p>
    <button class="btn" id="snd" style="margin-top:14px">Отправить ссылку</button><button class="btn ghost" id="cx" style="margin-top:8px;border:0">Отмена</button></div>`;
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tpl = TEMPLATES.find(t => t[0] === b.dataset.t); draw(); });
    d.querySelector('#cx').onclick = () => d.remove();
    d.querySelector('#snd').onclick = async () => { let bx; try { bx = await inbox(); } catch (e) { toast('Не удалось создать ссылку: ' + e.message); return; } track('join_sent'); const author = (await meta('profile')) || defaultAuthor();
      const url = location.origin + '/' + (myRef() ? '?ref=' + myRef() : '') + '#join=' + seal.pack({ i: bx.id, k: bx.key, s: author, p: tpl[2] });
      const text = 'Здравствуйте! Пройдите, пожалуйста, тест движения по ссылке: короткая анкета и 2–4 минуты перед камерой. Результат сразу придет мне.';
      if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url); toast('Ссылка скопирована'); } d.remove(); }; };
  draw(); document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
}
/** Забирает новые результаты с сервера (по ссылкам клиентам и по общей ссылке), расшифровывает и кладет в карточки. */
// вернулись в приложение на главный экран кабинета: проверяем, не пришли ли результаты по ссылке (для входа через Google, где бота нет)
let pullAt = 0;
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' || !document.getElementById('join') || !document.getElementById('menu') || Date.now() - pullAt < 30000) return;
  pullAt = Date.now(); pullResults().then(n => { if (n.length && document.getElementById('join')) proHome('', n); }).catch(() => {}); });
export async function pullResults() {
  const clients = (await all('clients')).filter(c => c.invite); const bx = await meta('inbox');
  const boxes = b => [b.id].concat(b.old && Date.now() < LEGACY_UNTIL ? [b.old] : []);
  const ids = clients.flatMap(c => boxes(c.invite)).concat(bx ? boxes(bx) : []); if (!ids.length) return [];
  let data; try { data = await (await fetch('/api/relay?ids=' + ids.join(','), { cache: 'no-store' })).json(); } catch (e) { return []; }
  const got = [], done = p => fetch('/api/relay?p=' + encodeURIComponent(p), { method: 'DELETE' }).catch(() => {});
  for (const c of clients) for (const item of boxes(c.invite).flatMap(id => data[id] || [])) {
    let r; try { r = await seal.decrypt(c.invite.key, item.data); } catch (e) { done(item.p); continue; } // не расшифровывается этим ключом: мусор, иначе он занимает лимит ссылки
    try { await addResult(c, r); got.push(c.name); done(item.p); } catch (e) { console.warn('relay item', e); } }
  if (bx) for (const item of boxes(bx).flatMap(id => data[id] || [])) {
    let m; try { m = await seal.decrypt(bx.key, item.data); } catch (e) { done(item.p); continue; }
    try { const p0 = m.profile && typeof m.profile === 'object' ? m.profile : {}, pr = { name: str(p0.name, 40), surname: str(p0.surname, 60), dob: /^\d{4}-\d{2}-\d{2}$/.test(p0.dob) ? p0.dob : '', sex: ['M', 'F'].includes(p0.sex) ? p0.sex : '', height: /^\d{2,3}$/.test(p0.height) ? p0.height : '', hand: ['R', 'L'].includes(p0.hand) ? p0.hand : '', activity: str(p0.activity, 120), complaints: str(p0.complaints, 1000) };
      if (typeof m.token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(m.token)) m.token = null;
      // тот же человек по общей ссылке повторно — в ту же карточку
      let c = m.token && (await all('clients')).find(x => x.remoteToken && x.remoteToken === m.token);
      if (!c) c = { id: uid(), created: Date.now(), remoteToken: m.token, notes: '' };
      Object.assign(c, { name: [pr.name, pr.surname].filter(Boolean).join(' ') || 'Без имени', dob: pr.dob || c.dob || '', sex: pr.sex || c.sex || '', height: pr.height || c.height || '', hand: pr.hand || c.hand || 'R', leg: pr.hand || c.leg || 'R', activity: pr.activity || c.activity || '', complaints: pr.complaints || c.complaints || '' });
      if (!m.result || typeof m.result !== 'object') throw new Error('no result');
      await put('clients', c); await addResult(c, m.result); got.push(c.name); done(item.p); } catch (e) { console.warn('inbox item', e); } }
  if (got.length) track('result_pulled', { n: got.length }, false);
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
  const keys = Object.keys(poses || {}).filter(k => poses[k] && poses[k].n); if (!keys.length) { toast('В этой оценке нет записи движения'); return back(); }
  let key = keys.includes('ohs_front') ? 'ohs_front' : keys[0], mode = 'flat', amp = 1, speed = 1, k = 0, playing = true, raf = 0, v3 = null;
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div style="flex:1"><b style="font-size:17px">Запись движения</b><div style="font-size:13px;color:var(--sub)">${esc(titleText || '')}</div></div></div>
   <div class="pad"><div class="row" style="gap:6px;flex-wrap:wrap">${keys.map(x => `<button class="pill" data-k="${esc(x)}" style="border:1.5px solid ${x === key ? 'var(--ink)' : 'transparent'}">${esc(QNAMES[x] || UNIT_NAMES[x] || x)}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px;gap:8px"><div class="seg" style="flex:1"><button id="m2" class="on">Схема</button><button id="m3">3D-фигура</button></div></div>
    <div class="card" style="margin-top:10px;padding:10px"><div id="stage" style="width:100%;height:380px;position:relative"><canvas id="cv" style="width:100%;height:100%;display:block"></canvas></div>
     <div class="row" style="margin-top:8px"><button class="round" id="pp" aria-label="Пауза" style="background:var(--surface-2)">${ic('pause', 's')}</button><input type="range" id="ph" min="0" max="1000" value="0" style="flex:1;accent-color:var(--ink)"></div>
     <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="pill" id="sp" style="font-size:12px">Скорость 1×</button><button class="pill" id="am" style="font-size:12px">Подчеркнуть отклонения</button><span id="amn" style="font-size:12px;color:var(--short-t)"></span></div>
     <p style="font-size:12px;color:var(--sub);margin-top:8px" id="note"></p></div></div></div>`);
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
  $('#pp').onclick = () => { playing = !playing; $('#pp').innerHTML = ic(playing ? 'pause' : 'play', 's'); };
  $('#ph').oninput = e => { playing = false; $('#pp').innerHTML = ic('play', 's'); k = e.target.value / 1000; };
  $('#sp').onclick = () => { speed = speed === 1 ? .5 : speed === .5 ? .25 : 1; $('#sp').textContent = `Скорость ${String(speed).replace('.', ',')}×`; };
  $('#am').onclick = () => { amp = amp === 1 ? 2 : 1; $('#am').style.borderColor = amp > 1 ? 'var(--short)' : 'transparent'; $('#amn').textContent = amp > 1 ? 'Колени и наклон корпуса усилены ×2 для наглядности' : ''; };
  $('#m2').onclick = () => { if (mode === 'flat') return; mode = 'flat'; $('#m2').classList.add('on'); $('#m3').classList.remove('on'); if (v3) v3.dispose(); v3 = null; $('#stage').innerHTML = '<canvas id="cv" style="width:100%;height:100%;display:block"></canvas>'; load(); };
  $('#m3').onclick = async () => { if (mode === '3d') return; mode = '3d'; $('#m3').classList.add('on'); $('#m2').classList.remove('on'); load(); v3 = await open3d(); };
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => { key = b.dataset.k; k = 0; document.querySelectorAll('[data-k]').forEach(x => x.style.borderColor = x === b ? 'var(--ink)' : 'transparent'); load(); if (mode === '3d') { if (v3) v3.dispose(); v3 = await open3d(); } });
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
  go(`<div class="fade" style="padding-bottom:40px"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div style="flex:1"><b style="font-size:17px">Повторяемость</b><div style="font-size:13px;color:var(--sub)">${list.map(a => fmtDate(a.date)).join(' · ')}</div></div></div>
   <div class="pad"><div class="card" style="background:${okN === rows.length ? 'var(--ok-s)' : 'var(--short-s)'}"><b>Стабильно: ${okN} из ${rows.length} показателей</b><div style="font-size:13px;color:var(--sub);margin-top:4px">Стабильно — разброс между тестами не больше погрешности съемки. Для проверки сделай 3 теста подряд с той же постановкой телефона.</div></div>
   <div class="card" style="margin-top:10px">${rows.map(r => `<div class="row" style="margin-top:8px;font-size:14px"><span style="flex:1">${r.n}</span><span style="font-variant-numeric:tabular-nums;font-size:13px">${r.v.map(x => fmt(x) + r.u).join(' / ')}</span><span class="badge" style="margin-left:8px;background:${r.ok ? 'var(--ok-s)' : 'var(--over-s)'};color:${r.ok ? 'var(--ok-t)' : 'var(--over)'}">±${fmt(r.range / 2)}${r.u}</span></div>`).join('') || '<p class="sub">Нет общих показателей.</p>'}</div></div></div>`);
  $('#back').onclick = () => clientCard(clientId);
}
