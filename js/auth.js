// Быстрый вход (Google, Telegram), согласие на обработку данных и проверка противопоказаний перед тестом.
import { device, ic } from './core.js';
import { track } from './track.js';

const app = () => document.querySelector('#app');
const show = html => { app().innerHTML = html; window.scrollTo(0, 0); };
const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
// ключ меняется вместе с версией политики: при новой версии согласие спрашивается заново
const CONSENT_KEY = 'bp_consent_2026-10-b2';
const TG = () => (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ? window.Telegram.WebApp : null;

let cfg = null, me;
export async function config() {
  if (cfg) return cfg;
  try { const r = await fetch('/api/auth?a=config', { cache: 'no-store' }); cfg = r.ok ? await r.json() : {}; } catch (e) { cfg = {}; }
  return cfg;
}
// какими способами можно войти на этом устройстве: Google не пускает вход во встроенных браузерах Telegram и соцсетей
export async function providers() {
  const c = await config(), out = [];
  if (c.telegram && TG()) out.push('tg-app');
  if (c.google && !TG() && !device.inApp) out.push('google');
  if (c.telegram && c.telegramWeb && !TG()) out.push('tg-web');
  return out;
}
export async function getMe(force) {
  if (me !== undefined && !force) return me;
  try { const r = await fetch('/api/auth?a=me', { cache: 'no-store' }); me = r.ok ? (await r.json()).user : null; } catch (e) { me = null; }
  return me;
}
async function post(a, body) {
  const r = await fetch('/api/auth?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'ошибка ' + r.status); return j;
}
export const meSync = () => me || null;
export const configSync = () => cfg || {};
/** Возврат с виджета Telegram: данные пришли в адресе страницы, подпись проверяет сервер. */
export async function tgWebLogin(data) {
  const role = localStorage.getItem('bp_login_role') || 'client';
  me = (await post('telegram', { data, role, consent: !!localStorage.getItem(CONSENT_KEY), health: !!localStorage.getItem(CONSENT_KEY), ref: localStorage.getItem('bp_ref') })).user;
  if (role === 'specialist' && me.role !== 'specialist') me = await setRole('specialist');
  return role;
}
export async function setRole(role) { me = (await post('role', { role })).user; return me; }
export async function logout() { await post('logout').catch(() => {}); me = null; }
export async function deleteAccount() { await post('delete'); me = null; }
export async function betaUsers() { return (await post('users')).users; }

/** Пускает дальше, если человек вошел. Если вход на сайте еще не настроен или сервер недоступен, не блокирует. */
export async function ensureLogin(role, cont, opts = {}) {
  if (!(await providers()).length) return true;
  let u = await getMe();
  // политика сменилась: вход заново с новым согласием (один тап)
  if (u && u.consentOk === false) { loginScreen(role, cont, opts); return false; }
  if (u) { if (role === 'specialist' && u.role !== 'specialist') u = await setRole('specialist').catch(() => u); else if (!u.role) u = await setRole(role).catch(() => u); return true; }
  // внутри Telegram Mini App вход без экрана: данные пользователя уже подписаны Telegram
  if (TG() && localStorage.getItem(CONSENT_KEY)) { try { me = (await post('telegram', { initData: TG().initData, role, consent: true, health: true, ref: localStorage.getItem('bp_ref') })).user; window.dispatchEvent(new Event('bp-login')); return true; } catch (e) {} }
  loginScreen(role, cont, opts); return false;
}

/** Клиент по ссылке специалиста: без аккаунта, только согласия (18+, условия, данные о здоровье). Результат уходит специалисту зашифрованным. */
export const linkConsentOk = () => !!localStorage.getItem(CONSENT_KEY);
export function linkConsent(cont, who) {
  show(`<div class="scr fade"><div class="top-bar"><div style="height:48px"></div><span style="flex:1"></span><span class="step-n" style="padding-right:8px">шаг 1 из 2</span></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:var(--s3)">
    <div class="eyebrow">Тест от специалиста</div><h1>Без регистрации</h1>
    <p class="sub">Аккаунт не нужен. Результат зашифруется на телефоне и уйдет только ${who ? 'специалисту: ' + esc(who) : 'вашему специалисту'}.</p>
    <label class="card row" style="align-items:flex-start;border-radius:var(--r-md)"><input type="checkbox" class="check" id="cons"><span style="font-size:14px;line-height:1.45">Мне есть 18 лет. Принимаю <a href="/terms" target="_blank">соглашение</a> и <a href="/privacy" target="_blank">политику конфиденциальности</a>. Понимаю, что это оценка движения, а не медицинское заключение.</span></label>
    <label class="card row" style="align-items:flex-start;border-radius:var(--r-md)"><input type="checkbox" class="check" id="consh"><span style="font-size:14px;line-height:1.45">Отдельно соглашаюсь на обработку данных о здоровье: боль и результат теста для моего специалиста.</span></label>
    <span class="ondevice">${ic('cpu', 's')}Видео не записывается и не уходит с телефона. Сохраняется только скелет движения.</span>
   </div><div class="pad" style="padding:14px 20px 24px"><p id="cerr" class="sub" style="font-size:13px;min-height:18px;color:var(--over-t)"></p><button class="btn" id="cgo">Продолжить</button></div></div>`);
  document.getElementById('cgo').onclick = () => { if (!['cons', 'consh'].every(id => document.getElementById(id).checked)) { document.getElementById('cerr').textContent = 'Отметьте оба пункта'; return; }
    localStorage.setItem(CONSENT_KEY, String(Date.now())); track('login_ok', { c: 'link_no_account' }, false); cont(); };
}

export function loginScreen(role, cont, opts = {}) {
  const pro = role === 'specialist';
  const consented = () => ['cons', 'consh'].every(id => document.getElementById(id) && document.getElementById(id).checked);
  show(`<div class="scr fade"><div class="top-bar">${opts.back ? `<button class="round" id="lback" aria-label="Назад">${ic('chevron-left')}</button>` : '<div style="height:48px"></div>'}<span style="flex:1"></span>${pro ? '' : '<span class="step-n" style="padding-right:8px">шаг 1 из 2</span>'}</div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:var(--s3)">
    <div class="eyebrow">${pro ? 'Кабинет специалиста · бета' : 'Быстрый вход · бета'}</div>
    <h1>${pro ? 'Войдите, чтобы вести клиентов' : 'Войди в один тап'}</h1>
    <p class="sub">${pro ? 'Вход привязывает кабинет к вам: результаты клиентов из дома может забрать только вошедший специалист.' : 'Без паролей. Нужно, чтобы участники беты могли вернуться к своим результатам и получить ответ от специалиста.'}</p>
    <label class="card row" style="align-items:flex-start;border-radius:var(--r-md)"><input type="checkbox" class="check" id="cons" ${localStorage.getItem(CONSENT_KEY) ? 'checked' : ''}>
     <span style="font-size:14px;line-height:1.45">Мне есть 18 лет. Принимаю <a href="/terms" target="_blank">соглашение</a> и <a href="/privacy" target="_blank">политику конфиденциальности</a>. Понимаю, что это оценка движения, а не диагноз.</span></label>
    <label class="card row" style="align-items:flex-start;border-radius:var(--r-md)"><input type="checkbox" class="check" id="consh" ${localStorage.getItem(CONSENT_KEY) ? 'checked' : ''}>
     <span style="font-size:14px;line-height:1.45">Отдельно соглашаюсь на обработку данных о здоровье: жалобы, боль, результаты теста${pro ? ' моих клиентов в моем кабинете' : ''}. Отозвать согласие: удалить аккаунт в настройках.</span></label>
    <span class="ondevice">${ic('cpu', 's')}Видео не записывается и не уходит с телефона. Сохраняется только скелет движения.</span>
    ${pro ? '<a href="/pricing" target="_blank" class="link" style="text-align:center;display:block;line-height:48px">Тарифы и возможности</a>' : ''}
   </div>
   <div class="dock"><p id="lhint" style="font-size:13px;color:var(--sub);text-align:center">Отметь оба согласия, чтобы войти</p>
    <div id="lbtns" style="display:flex;flex-direction:column;gap:var(--s2);align-items:stretch;transition:opacity .2s"></div>
    <p id="lerr" style="font-size:13px;color:var(--over-t);min-height:18px;text-align:center"></p></div></div>`);
  if (opts.back) document.getElementById('lback').onclick = opts.back;
  const box = document.getElementById('lbtns'), err = document.getElementById('lerr'), cons = document.getElementById('cons'), consh = document.getElementById('consh');
  const sync = () => { const ok = consented(); document.getElementById('lhint').style.display = ok ? 'none' : ''; box.style.opacity = ok ? '1' : '.45'; box.style.pointerEvents = ok ? 'auto' : 'none'; if (ok) { localStorage.setItem(CONSENT_KEY, String(Date.now())); err.textContent = ''; } else localStorage.removeItem(CONSENT_KEY); };
  cons.onchange = sync; consh.onchange = sync; sync();
  const done = async (a, body) => {
    if (!consented()) { err.textContent = 'Отметь оба согласия выше'; return; }
    err.textContent = 'Вхожу…';
    try { const r = await post(a, { ...body, role, consent: true, health: true, ref: localStorage.getItem('bp_ref') }); me = r.user;
      if (pro && me.role !== 'specialist') me = await setRole('specialist'); track('login_ok'); err.textContent = ''; window.dispatchEvent(new Event('bp-login')); cont(); }
    catch (e) { err.textContent = 'Не получилось войти: ' + e.message; }
  };
  providers().then(list => {
    if (!list.length) { box.innerHTML = '<p class="sub" style="font-size:14px;text-align:center">Вход временно недоступен.</p><button class="btn" id="lskip">Продолжить</button>'; document.getElementById('lskip').onclick = cont; return; }
    if (list.includes('tg-app')) { box.insertAdjacentHTML('beforeend', '<button class="btn" id="tgapp">Войти через Telegram</button>'); document.getElementById('tgapp').onclick = () => done('telegram', { initData: TG().initData }); }
    if (list.includes('google')) { const d = document.createElement('div'); d.id = 'gbtn'; d.style.minHeight = '48px'; d.style.display = 'flex'; d.style.justifyContent = 'center'; box.appendChild(d);
      loadScript('https://accounts.google.com/gsi/client').then(() => {
        window.google.accounts.id.initialize({ client_id: cfg.google, callback: r => done('google', { credential: r.credential }), ux_mode: 'popup', auto_select: false, itp_support: true });
        window.google.accounts.id.renderButton(d, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', locale: 'ru', width: Math.min(400, box.clientWidth || 320) });
      }).catch(() => { d.innerHTML = '<p class="sub" style="font-size:13px">Google сейчас недоступен</p>'; }); }
    if (list.includes('tg-web')) {
      // своя кнопка вместо iframe-виджета: без артефактов на фоне, и вход идет через страницу Telegram с возвратом на сайт
      localStorage.setItem('bp_login_role', role);
      const u = `https://oauth.telegram.org/auth?bot_id=${cfg.telegramId}&origin=${encodeURIComponent(location.origin)}&request_access=write&return_to=${encodeURIComponent(location.origin + '/')}`;
      box.insertAdjacentHTML('beforeend', `<a class="btn" id="tgweb" href="${u}" style="text-decoration:none"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M9.8 15.2 9.6 19c.4 0 .6-.2.8-.4l2-1.9 4.1 3c.8.4 1.3.2 1.5-.7l2.7-12.6c.3-1.1-.4-1.6-1.2-1.3L3.7 11.3c-1.1.4-1.1 1-.2 1.3l4.1 1.3 9.6-6c.5-.3.9-.1.5.2"/></svg>Войти через Telegram</a>`);
    }
  });
}
const scripts = {};
function loadScript(src) { return scripts[src] || (scripts[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); })); }

// ---------- противопоказания перед тестом: приседания и стойка на одной ноге ----------
const FLAGS = [
  ['urgent', 'Онемение в паху или проблемы с контролем мочеиспускания'],
  ['night', 'Сильная боль в покое или ночью, боль усиливается с каждым днем'],
  ['neuro', 'Онемение, покалывание или слабость в руке или ноге'],
  ['radic', 'Боль в спине отдаёт в ногу ниже колена'],
  ['injury', 'Травма, перелом или операция за последние 3 месяца'],
  ['cardio', 'Головокружение, обмороки, проблемы с сердцем или давлением'],
  ['fever', 'Температура, общее недомогание, резкая потеря веса'],
  ['preg', 'Беременность'],
];
const RF_DAYS = 30;
export const safetyOk = () => { const t = +localStorage.getItem('bp_rf') || 0; return Date.now() - t < RF_DAYS * 864e5; };
export function safetyScreen(cont, back, booking) {
  const sel = new Set();
  show(`<div class="scr fade"><div class="top-bar">${back ? `<button class="round" id="sback" aria-label="Назад">${ic('chevron-left')}</button>` : '<div style="height:48px"></div>'}<span style="flex:1"></span><span class="step-n" style="padding-right:8px">шаг 2 из 2</span></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:var(--s3)">
    <div class="eyebrow">Перед тестом</div><h1 style="font-size:26px">Есть ли у тебя сейчас что-то из этого?</h1>
    <p class="sub" style="font-size:14px">В тесте приседания и стойка на одной ноге. Если что-то из списка есть, сначала нужен врач.</p>
    <div class="group">${FLAGS.map(([k, t]) => `<label class="chk-row" data-k="${k}"><input type="checkbox" class="check"><span>${t}</span></label>`).join('')}</div>
   </div><div class="dock"><p style="font-size:13px;color:var(--sub);text-align:center">Спросим снова через ${RF_DAYS} дней</p><button class="btn" id="sok">Ничего из этого нет</button></div></div>`);
  if (back) document.getElementById('sback').onclick = back;
  app().querySelectorAll('[data-k]').forEach(l => l.querySelector('input').onchange = e => { e.target.checked ? sel.add(l.dataset.k) : sel.delete(l.dataset.k); 
    document.getElementById('sok').textContent = sel.size ? 'Дальше' : 'Ничего из этого нет'; });
  document.getElementById('sok').onclick = () => {
    if (!sel.size) { track('safety_ok'); localStorage.setItem('bp_rf', String(Date.now())); return cont(); }
    track('safety_stop');
    const urgent = sel.has('urgent');
    show(`<div class="scr fade"><div class="empty" style="flex:1;justify-content:center">${ic('info')}
      <h1>${urgent ? 'Нужен врач сегодня' : 'Сначала к врачу'}</h1>
      <p class="sub">${urgent ? 'Онемение в паху и проблемы с мочеиспусканием при боли в спине требуют срочного осмотра. Обратись в неотложную помощь.' : 'С такими признаками тест движения сейчас может навредить или показать неверную картину. Покажись врачу, а когда он разрешит нагрузку, возвращайся.'}</p></div>
      <div class="dock">${urgent ? '' : `<a class="btn" style="text-decoration:none" href="${booking || 'https://t.me/BodyPassport_bot'}" target="_blank">Спросить специалиста</a>`}
      <button class="btn ghost" id="sre">Я ошибся в ответах</button></div></div>`);
    document.getElementById('sre').onclick = () => safetyScreen(cont, back, booking);
  };
}
