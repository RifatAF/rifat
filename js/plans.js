// Тарифы и специализации. Один источник правды для кабинета и страницы /pricing.
import { meSync, configSync } from './auth.js';
// бета: у всех специалистов PRO, об оплате нигде ни слова. Переключает администратор в настройках
export const isBeta = () => configSync().beta !== false;
import { track } from './track.js';

// v2.0: Старт = 5 слотов клиентов навсегда, +3 слота за каждого приглашенного коллегу; Про = безлимит и свой бренд в отчетах.
// Числа совпадают с api/_session.js (BASE_SLOTS, REF_SLOTS): сервер считает, приложение показывает
export const BASE_SLOTS = 5, REF_SLOTS = 3, START_CLIENTS = BASE_SLOTS;
export const PRO_PRICE = '899 ₽ в месяц', PRO_YEAR = '6 990 ₽ в год';
// ссылка на годовой продукт lava.top: пусто, пока основатель его не создал (тогда кнопки «Год» нет)
export const PAY_URL_YEAR = '';
export const PAY_URL = 'https://app.lava.top/products/4ffb6883-76b0-46f9-b109-b2fe71c0f3a2/af840345-4288-4395-b221-2044c7fdc255';

export const PLANS = {
  start: { name: 'Free', price: 'Бесплатно' },
  pro: { name: 'PRO', price: PRO_PRICE },
  studio: { name: 'PRO', price: PRO_PRICE },
};
// что требует Про: число клиентов сверх слотов и свой бренд в отчете
const PRO = { clients: 1, brand: 1, history: 1, home: 1, pdf: 1, weblink: 1, reminders: 1 };

export const SPECIALTIES = [
  ['kinesio', 'Кинезиотерапевт, реабилитолог, ЛФК', 'Боль и восстановление: где перегрузка, что укрепить, проверка прогресса'],
  ['trainer', 'Персональный тренер', 'Первичный скрининг клиента и наглядный прогресс каждые 4–6 недель'],
  ['manual', 'Массажист, остеопат, мануальный терапевт', 'Осанка за минуту до и после сеанса: где работать и что изменилось'],
  ['sport', 'Тренер по спорту', 'Асимметрии и слабые звенья, которые мешают результату и ведут к травмам'],
  ['studio', 'Студия, клиника, зал', 'Единые протоколы и база клиентов для команды'],
];
// порядок шаблонов протокола под специализацию: первый открывается по умолчанию
export const TEMPLATE_ORDER = {
  kinesio: ['knee', 'low_back', 'low_back_mid', 'low_back_up', 'neck', 'full', 'screen', 'posture'],
  trainer: ['screen', 'full', 'knee', 'low_back', 'low_back_mid', 'low_back_up', 'neck', 'posture'],
  manual: ['posture', 'neck', 'low_back', 'low_back_mid', 'low_back_up', 'knee', 'screen', 'full'],
  sport: ['screen', 'knee', 'full', 'low_back', 'low_back_mid', 'low_back_up', 'neck', 'posture'],
  studio: ['screen', 'full', 'knee', 'low_back', 'low_back_mid', 'low_back_up', 'neck', 'posture'],
};

export function plan() {
  const u = meSync();
  if (!u) return { plan: 'start', until: null };
  return { plan: u.plan || 'start', until: u.planUntil };
}
export const isPro = () => isBeta() || plan().plan !== 'start';
export const isTrial = () => !isBeta() && !!(meSync() && meSync().trial);
/** Слоты клиентов: max с сервера (5 + 3 за коллегу), у Про без лимита. */
export function slots(used = 0) {
  const u = meSync(), pro = isPro();
  const max = u && Number.isFinite(+u.maxClientSlots) ? +u.maxClientSlots : BASE_SLOTS;
  return { used, max, pro, free: pro ? Infinity : Math.max(0, max - used), invited: (u && u.invitedPro) || 0 };
}
export const can = f => !PRO[f] || isPro();
/** Можно ли завести еще одного клиента. Нет: показывает выбор «пригласить коллегу» или «PRO». */
export function checkClientSlotAvailable(activeClientsCount) {
  const s = slots(activeClientsCount);
  if (s.pro || s.used < s.max) return true;
  track('limit_hit', { c: 'clients' }, false); slotSheet(s); return false;
}
// ссылка-приглашение коллеге и готовый текст
export const refLink = () => { const u = meSync(); return location.origin + '/' + (u && u.refCode ? '?ref=' + u.refCode : ''); };
export const refText = () => 'Использую BodyPassport для составления 3D-отчетов биомеханики пациентов. Держи ссылку на бесплатный доступ: ' + refLink();
/** Приглашение коллеге: шторка с готовым текстом, «Отправить» (меню телефона) и «Скопировать» с явным подтверждением. */
export function copyRefText() {
  track('ref_share', { c: 'slots' }, false); const text = refText();
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Пригласить коллегу</h2><p class="sub" style="margin-top:6px">${isBeta() ? 'Отправьте коллеге этот текст со ссылкой.' : 'Когда коллега оплатит PRO, вам на баланс придет 20% его оплат в течение 24 месяцев. Баланс тратится на ваш PRO.'}</p>
    <div class="card" style="margin-top:var(--s3);font-size:15px;line-height:1.45;border:1px solid var(--line)">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
    ${navigator.share ? '<button class="btn" id="rfsh" style="margin-top:var(--s4)">Отправить коллеге</button>' : ''}
    <button class="btn${navigator.share ? ' line' : ''}" id="rfcp" style="margin-top:var(--s2)">Скопировать текст и ссылку</button>
    <button class="btn ghost" id="rfx" style="margin-top:var(--s2)">Закрыть</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'rfx') d.remove(); };
  if (d.querySelector('#rfsh')) d.querySelector('#rfsh').onclick = () => navigator.share({ text }).catch(() => {});
  const b = d.querySelector('#rfcp');
  b.onclick = async () => { let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e2) {} }
    if (!ok) { b.textContent = 'Не удалось, выделите текст выше вручную'; return; }
    b.innerHTML = '✓ Скопировано, вставьте в чат коллеге'; b.style.background = 'var(--ok-s)'; b.style.color = 'var(--ok-t)'; b.style.borderColor = 'var(--ok-t)';
    if (navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => { if (b.isConnected) { b.textContent = 'Скопировать еще раз'; b.removeAttribute('style'); b.style.marginTop = 'var(--s2)'; } }, 3000); };
}
function toastMsg(m) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
export function slotSheet(s = slots()) {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Вы ведете ${s.used} из ${s.max} клиентов</h2>
    <p class="sub" style="margin-top:8px">На Free можно вести ${s.max} клиентов одновременно: повторные тесты, ссылки на ретест и тест из дома за последние 30 дней. Первые тесты новых клиентов без лимита.</p>
    <button class="btn" id="slpro" style="margin-top:var(--s5)">PRO: ведение без лимита · 899 ₽</button>
    <button class="btn line" id="slref" style="margin-top:var(--s2)">Пригласить коллегу: 20% его оплат вам на баланс</button>
    <button class="btn ghost" id="slx" style="margin-top:var(--s2)">Не сейчас</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'slx') d.remove(); };
  d.querySelector('#slref').onclick = () => { d.remove(); copyRefText(); };
  d.querySelector('#slpro').onclick = () => { d.remove(); goPro(); };
  return d;
}

// что открывает PRO: заголовок шторки по месту, где специалист уперся
const GATE = {
  clients: 'Ведение без лимита клиентов',
  brand: 'Ваш логотип в отчете',
  history: 'Вся история «было → стало»',
  home: 'Занятия клиента дома',
  pdf: 'Отчет в PDF',
  weblink: 'Отчет по веб-ссылке',
  reminders: 'Напоминания в Telegram',
};
// два посыла по специализации: тем, у кого поток, PRO экономит время; начинающим продает их
const pitch = () => ['trainer', 'kinesio', 'studio'].includes(localStorage.getItem('bp_sp'))
  ? 'Экономит время: напоминания, вся история клиента и его занятия дома в одном месте.'
  : 'Продает вас: ваш логотип и ссылка на отчет вместо плашки BodyPassport, история прогресса клиентов.';
/** Пускает к функции или показывает шторку PRO с тем, что именно откроется. ctx: имя клиента для заголовка. */
export function gate(f, ctx) {
  if (can(f) || isPro()) return true;
  track('paywall_view', { c: f }, false);
  const d = document.createElement('div'), t = GATE[f] || 'Эта функция'; d.className = 'sheet';
  d.innerHTML = `<div><div class="eyebrow">PRO</div><h2 style="margin-top:6px">${t}${ctx ? ': ' + String(ctx).replace(/[<>&"]/g, '') : ''}</h2>
    <p class="sub" style="margin-top:8px">${pitch()}</p>
    <button class="btn" id="pwm" style="margin-top:var(--s5)">PRO на месяц · 899 ₽</button>
    ${PAY_URL_YEAR ? '<button class="btn line" id="pwy" style="margin-top:var(--s2)">PRO на год · 6 990 ₽ (2 месяца в подарок)</button>' : ''}
    <button class="btn ghost" id="pwr" style="margin-top:var(--s2)">Пригласить коллегу</button>
    <button class="btn ghost" id="pwx" style="margin-top:var(--s1);border:0">Не сейчас</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'pwx') d.remove(); };
  d.querySelector('#pwm').onclick = () => { d.remove(); goPro('month'); };
  if (d.querySelector('#pwy')) d.querySelector('#pwy').onclick = () => { d.remove(); goPro('year'); };
  d.querySelector('#pwr').onclick = () => { d.remove(); copyRefText(); };
  return false;
}
/** Переход к оплате PRO. Уведомление lava.top находит аккаунт по почте покупателя, поэтому сначала спрашиваем почту для оплаты. */
export function goPro(period = 'month') {
  track('pro_click', { c: period }, false);
  const u = meSync(); if (!u) { location.href = '/pricing'; return; }
  const d = document.createElement('div'); d.className = 'sheet'; const e0 = u.payEmail || u.email || '';
  d.innerHTML = `<div><h2>Переход на PRO</h2><p class="sub" style="margin-top:8px">${PRO_PRICE}, безлимит клиентов и ваш логотип в отчетах. Отменить можно в любой момент.</p>
    <label style="display:block;margin-top:var(--s4)"><b>Почта, которую укажете при оплате</b><input id="pem" type="email" class="field" style="margin-top:8px" value="${String(e0).replace(/"/g, '')}" placeholder="name@mail.ru" autocomplete="email"></label>
    <p class="sub" style="font-size:12px;margin-top:6px">По ней PRO включится сам сразу после оплаты.</p>
    <button class="btn" id="pgo" style="margin-top:var(--s4)">К оплате</button><button class="btn ghost" id="pgx" style="margin-top:var(--s2)">Не сейчас</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'pgx') d.remove(); };
  d.querySelector('#pgo').onclick = async () => { const em = d.querySelector('#pem').value.trim(), btn = d.querySelector('#pgo');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { d.querySelector('#pem').style.borderColor = 'var(--over)'; return; }
    btn.disabled = true; btn.textContent = 'Сохраняю…';
    try { if (em.toLowerCase() !== String(u.payEmail || '').toLowerCase()) { const r = await fetch('/api/auth?a=payemail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status); u.payEmail = em.toLowerCase(); } }
    catch (e) { btn.disabled = false; btn.textContent = 'К оплате'; toastMsg('Не удалось сохранить почту: ' + e.message); return; }
    location.href = period === 'year' && PAY_URL_YEAR ? PAY_URL_YEAR : PAY_URL; };
}
export function planLine() {
  const p = plan(), until = p.until ? new Date(p.until).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  if (isBeta()) return 'Бета: все возможности открыты';
  return `Тариф ${PLANS[p.plan].name}${p.plan !== 'start' && until ? ', до ' + until : ''}`;
}
// любая ссылка с классом gopro в приложении ведет через выбор почты к оплате
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.gopro'); if (!a) return; e.preventDefault(); document.querySelectorAll('.sheet').forEach(x => x.remove()); goPro(); });
