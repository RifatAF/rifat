// Тарифы и специализации. Один источник правды для кабинета и страницы /pricing.
import { meSync, configSync } from './auth.js';
// бета: у всех специалистов PRO, об оплате нигде ни слова. Переключает администратор в настройках
export const isBeta = () => configSync().beta !== false;
import { track } from './track.js';

// v2.0: Старт = 5 слотов клиентов навсегда, +3 слота за каждого приглашенного коллегу; Про = безлимит и свой бренд в отчетах.
// Числа совпадают с api/_session.js (BASE_SLOTS, REF_SLOTS): сервер считает, приложение показывает
export const BASE_SLOTS = 5, REF_SLOTS = 3, START_CLIENTS = BASE_SLOTS;
export const PRO_PRICE = '899 ₽ в месяц';
export const PAY_URL = 'https://app.lava.top/products/4ffb6883-76b0-46f9-b109-b2fe71c0f3a2/af840345-4288-4395-b221-2044c7fdc255';

export const PLANS = {
  start: { name: 'Free', price: 'Бесплатно' },
  pro: { name: 'PRO', price: PRO_PRICE },
  studio: { name: 'PRO', price: PRO_PRICE },
};
// что требует Про: число клиентов сверх слотов и свой бренд в отчете
const PRO = {
  clients: 'Больше клиентов',
  brand: 'Свой логотип в отчете',
};

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
  track('gate_hit', { c: 'clients' }, false); slotSheet(s); return false;
}
// ссылка-приглашение коллеге и готовый текст
export const refLink = () => { const u = meSync(); return location.origin + '/' + (u && u.refCode ? '?ref=' + u.refCode : ''); };
export const refText = () => 'Использую BodyPassport для составления 3D-отчетов биомеханики пациентов. Держи ссылку на бесплатный доступ: ' + refLink();
export async function copyRefText() {
  track('ref_share', { c: 'slots' }, false); const text = refText();
  try { await navigator.clipboard.writeText(text); toastMsg('Текст и ссылка скопированы'); }
  catch (e) { if (navigator.share) await navigator.share({ text }).catch(() => {}); }
}
function toastMsg(m) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
export function slotSheet(s = slots()) {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Все слоты заняты: ${s.used} из ${s.max}</h2>
    <p class="sub" style="margin-top:8px">На тарифе Free ${BASE_SLOTS} клиентов навсегда и +${REF_SLOTS} за каждого коллегу, который откроет кабинет по вашей ссылке.</p>
    <button class="btn" id="slref" style="margin-top:var(--s5)">Пригласить коллегу (+${REF_SLOTS} слота бесплатно)</button>
    <button class="btn line" id="slpro" style="margin-top:var(--s2)">Перейти на PRO (безлимит за ${PRO_PRICE})</button>
    <button class="btn ghost" id="slx" style="margin-top:var(--s2)">Не сейчас</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'slx') d.remove(); };
  d.querySelector('#slref').onclick = () => copyRefText();
  d.querySelector('#slpro').onclick = () => { d.remove(); goPro(); };
  return d;
}

/** Пускает к функции или показывает, что нужен PRO. */
export function gate(f) {
  if (can(f)) return true;
  if (f === 'clients') { slotSheet(); return false; }
  track('gate_hit', { c: f }, false);
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>${PRO[f]}: в тарифе PRO</h2>
    <p class="sub" style="margin-top:8px">PRO: безлимит клиентов и ваш логотип в отчетах. ${PRO_PRICE}.</p>
    <button class="btn" id="pwgo" style="margin-top:var(--s5)">Перейти на PRO</button>
    <button class="btn ghost" id="pwx" style="margin-top:var(--s2)">Не сейчас</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'pwx') d.remove(); };
  d.querySelector('#pwgo').onclick = () => { d.remove(); goPro(); };
  return false;
}
/** Переход к оплате PRO. Уведомление lava.top находит аккаунт по почте покупателя, поэтому сначала спрашиваем почту для оплаты. */
export function goPro() {
  track('pro_click', {}, false);
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
    location.href = PAY_URL; };
}
export function planLine() {
  const p = plan(), until = p.until ? new Date(p.until).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  if (isBeta()) return 'Бета: все возможности открыты';
  return `Тариф ${PLANS[p.plan].name}${p.plan !== 'start' && until ? ', до ' + until : ''}`;
}
// любая ссылка с классом gopro в приложении ведет через выбор почты к оплате
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.gopro'); if (!a) return; e.preventDefault(); document.querySelectorAll('.sheet').forEach(x => x.remove()); goPro(); });
