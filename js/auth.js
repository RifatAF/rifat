// Быстрый вход (Google, Telegram), согласие на обработку данных и проверка противопоказаний перед тестом.
import { device } from './core.js';

const app = () => document.querySelector('#app');
const show = html => { app().innerHTML = html; window.scrollTo(0, 0); };
const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
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
/** Возврат с виджета Telegram: данные пришли в адресе страницы, подпись проверяет сервер. */
export async function tgWebLogin(data) {
  const role = localStorage.getItem('bp_login_role') || 'client';
  me = (await post('telegram', { data, role, consent: !!localStorage.getItem('bp_consent'), ref: localStorage.getItem('bp_ref') })).user;
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
  if (u) { if (role === 'specialist' && u.role !== 'specialist') u = await setRole('specialist').catch(() => u); else if (!u.role) u = await setRole(role).catch(() => u); return true; }
  // внутри Telegram Mini App вход без экрана: данные пользователя уже подписаны Telegram
  if (TG() && localStorage.getItem('bp_consent')) { try { me = (await post('telegram', { initData: TG().initData, role, consent: true, ref: localStorage.getItem('bp_ref') })).user; window.dispatchEvent(new Event('bp-login')); return true; } catch (e) {} }
  loginScreen(role, cont, opts); return false;
}

export function loginScreen(role, cont, opts = {}) {
  const pro = role === 'specialist';
  const consented = () => document.getElementById('cons') && document.getElementById('cons').checked;
  show(`<div class="scr fade"><div class="pad" style="padding-top:8px">${opts.back ? '<button class="round" id="lback" style="background:transparent">‹</button>' : '<div style="height:44px"></div>'}</div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:14px">
    <div class="row" style="gap:8px"><span class="caps" style="color:var(--coral)">${pro ? 'Кабинет специалиста' : 'Быстрый вход'}</span><span class="pill" style="background:var(--lime);font-size:11px;padding:4px 9px">Бета</span></div>
    <h1>${pro ? 'Войдите, чтобы вести клиентов' : 'Войди в один тап'}</h1>
    <p class="sub">${pro ? 'Вход привязывает кабинет к вам: результаты клиентов из дома может забрать только вошедший специалист.' : 'Без паролей. Нужно, чтобы участники беты могли вернуться к своим результатам и получить ответ от специалиста.'}</p>
    <label class="card row" style="padding:14px 16px;align-items:flex-start"><input type="checkbox" id="cons" ${localStorage.getItem('bp_consent') ? 'checked' : ''} style="width:22px;height:22px;flex:none;margin-top:2px;accent-color:#1E2533">
     <span style="font-size:14px;line-height:1.45">Мне есть 18 лет. Я согласен на обработку данных о движении и самочувствии по <a href="/privacy" target="_blank" style="color:var(--navy);font-weight:600">политике конфиденциальности</a>. Понимаю, что это оценка, а не диагноз.</span></label>
    <div id="lbtns" style="display:flex;flex-direction:column;gap:12px;align-items:center;transition:opacity .2s"></div>
    ${pro ? '<a href="/pricing" target="_blank" class="sub" style="font-size:14px;text-align:center;color:var(--navy);font-weight:600">Тарифы и возможности ›</a>' : ''}
    <p id="lerr" class="sub" style="font-size:13px;color:#C0392B;min-height:18px;text-align:center"></p>
   </div></div>`);
  if (opts.back) document.getElementById('lback').onclick = opts.back;
  const box = document.getElementById('lbtns'), err = document.getElementById('lerr'), cons = document.getElementById('cons');
  const sync = () => { box.style.opacity = cons.checked ? '1' : '.4'; box.style.pointerEvents = cons.checked ? 'auto' : 'none'; if (cons.checked) { localStorage.setItem('bp_consent', String(Date.now())); err.textContent = ''; } };
  cons.onchange = sync; sync();
  const done = async (a, body) => {
    if (!consented()) { err.textContent = 'Отметь согласие выше'; return; }
    err.textContent = 'Вхожу…';
    try { const r = await post(a, { ...body, role, consent: true, ref: localStorage.getItem('bp_ref') }); me = r.user;
      if (pro && me.role !== 'specialist') me = await setRole('specialist'); err.textContent = ''; window.dispatchEvent(new Event('bp-login')); cont(); }
    catch (e) { err.textContent = 'Не получилось войти: ' + e.message; }
  };
  providers().then(list => {
    if (!list.length) { box.innerHTML = '<p class="sub" style="font-size:14px">Вход временно недоступен.</p><button class="btn" id="lskip">Продолжить</button>'; document.getElementById('lskip').onclick = cont; return; }
    if (list.includes('tg-app')) { box.insertAdjacentHTML('beforeend', '<button class="btn" id="tgapp" style="background:#2AABEE">Войти через Telegram</button>'); document.getElementById('tgapp').onclick = () => done('telegram', { initData: TG().initData }); }
    if (list.includes('google')) { const d = document.createElement('div'); d.id = 'gbtn'; d.style.minHeight = '44px'; box.appendChild(d);
      loadScript('https://accounts.google.com/gsi/client').then(() => {
        window.google.accounts.id.initialize({ client_id: cfg.google, callback: r => done('google', { credential: r.credential }), ux_mode: 'popup', auto_select: false, itp_support: true });
        window.google.accounts.id.renderButton(d, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'ru', width: Math.min(340, box.clientWidth || 320) });
      }).catch(() => { d.innerHTML = '<p class="sub" style="font-size:13px">Google сейчас недоступен</p>'; }); }
    if (list.includes('tg-web')) {
      // своя кнопка вместо iframe-виджета: без артефактов на фоне, и вход идет через страницу Telegram с возвратом на сайт
      localStorage.setItem('bp_login_role', role);
      const u = `https://oauth.telegram.org/auth?bot_id=${cfg.telegramId}&origin=${encodeURIComponent(location.origin)}&request_access=write&return_to=${encodeURIComponent(location.origin + '/')}`;
      box.insertAdjacentHTML('beforeend', `<a class="btn" id="tgweb" href="${u}" style="background:#2AABEE;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:10px;max-width:340px;width:100%"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M9.8 15.2 9.6 19c.4 0 .6-.2.8-.4l2-1.9 4.1 3c.8.4 1.3.2 1.5-.7l2.7-12.6c.3-1.1-.4-1.6-1.2-1.3L3.7 11.3c-1.1.4-1.1 1-.2 1.3l4.1 1.3 9.6-6c.5-.3.9-.1.5.2"/></svg>Войти через Telegram</a>`);
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
  ['injury', 'Травма, перелом или операция за последние 3 месяца'],
  ['cardio', 'Головокружение, обмороки, проблемы с сердцем или давлением'],
  ['fever', 'Температура, общее недомогание, резкая потеря веса'],
  ['preg', 'Беременность'],
];
const RF_DAYS = 30;
export const safetyOk = () => { const t = +localStorage.getItem('bp_rf') || 0; return Date.now() - t < RF_DAYS * 864e5; };
export function safetyScreen(cont, back, booking) {
  const sel = new Set();
  show(`<div class="scr fade"><div class="pad" style="padding-top:8px">${back ? '<button class="round" id="sback" style="background:transparent">‹</button>' : '<div style="height:44px"></div>'}</div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:12px">
    <div class="caps" style="color:var(--coral)">Перед тестом</div><h1>Есть ли у тебя сейчас что-то из этого?</h1>
    <p class="sub" style="font-size:14px">В тесте приседания и стойка на одной ноге. Если что-то из списка есть, сначала нужен врач.</p>
    ${FLAGS.map(([k, t]) => `<label class="list-item" data-k="${k}" style="background:#fff"><input type="checkbox" style="width:22px;height:22px;flex:none;accent-color:#1E2533"><span style="font-size:15px;line-height:1.35">${t}</span></label>`).join('')}
   </div><div class="pad" style="padding:14px 20px 24px"><button class="btn" id="sok">Ничего из этого нет</button></div></div>`);
  if (back) document.getElementById('sback').onclick = back;
  app().querySelectorAll('[data-k]').forEach(l => l.querySelector('input').onchange = e => { e.target.checked ? sel.add(l.dataset.k) : sel.delete(l.dataset.k); l.classList.toggle('on', e.target.checked);
    document.getElementById('sok').textContent = sel.size ? 'Дальше' : 'Ничего из этого нет'; });
  document.getElementById('sok').onclick = () => {
    if (!sel.size) { localStorage.setItem('bp_rf', String(Date.now())); return cont(); }
    const urgent = sel.has('urgent');
    show(`<div class="scr pad fade" style="justify-content:center;gap:16px">
      <h1>${urgent ? 'Нужен врач сегодня' : 'Сначала к врачу'}</h1>
      <p class="sub">${urgent ? 'Онемение в паху и проблемы с мочеиспусканием при боли в спине требуют срочного осмотра. Обратись в неотложную помощь.' : 'С такими признаками тест движения сейчас может навредить или показать неверную картину. Покажись врачу, а когда он разрешит нагрузку, возвращайся.'}</p>
      ${urgent ? '' : `<a class="btn lime" style="text-decoration:none" href="${booking || 'https://t.me/BodyPassport_bot'}" target="_blank">Спросить специалиста</a>`}
      <button class="btn ghost" id="sre">Я ошибся в ответах</button></div>`);
    document.getElementById('sre').onclick = () => safetyScreen(cont, back, booking);
  };
}
