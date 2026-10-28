// Пиксель Meta и Conversions API для оценки рекламы. Работает сразу; плашка внизу сообщает о cookie и дает отключить (bp_ck = '0').
// Не включается у клиента, пришедшего по ссылке специалиста: там данные о здоровье, реклама специалисту не нужна.
// Автосбор кнопок и форм (autoConfig) и расширенное сопоставление выключены: уходят только названия шагов ниже.
// Каждое событие уходит дважды с одним event_id: из браузера и с сервера (/api/ev?a=capi), Meta оставляет одно.
const ID = '1834974184392747';
// наше событие воронки → событие Meta; 1: стандартное событие, 0: свое
const MAP = { page_view: ['PageView', 1], pro_open: ['Lead', 1], signup: ['CompleteRegistration', 1],
  first_test: ['FirstTest', 0], first_report: ['FirstReport', 0], pay_redirect: ['InitiateCheckout', 1] };
let on = false; const sent = new Set();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const invited = () => !!lsGet('bp_inv') || /^#(inv|join|r|rep|share)=/.test(location.hash);
const cookie = n => { try { const m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } };
const eid = () => { try { return crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } };
export const consent = () => lsGet('bp_ck');
function start() {
  if (on || consent() === '0' || invited() || lsGet('bp_noev') === '1') return; on = true;
  const f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
  if (!window._fbq) window._fbq = f; f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
  f('set', 'autoConfig', false, ID); f('init', ID);
}
/** Шаг воронки из track(): в Meta из браузера и с сервера (каждое событие один раз за вкладку, просмотр страницы каждый раз). */
export function pixel(e) {
  const m = MAP[e]; if (!m) return; start(); if (!on) return;
  if (e !== 'page_view') { if (sent.has(m[0])) return; sent.add(m[0]); }
  const id = eid(); window.fbq(m[1] ? 'track' : 'trackCustom', m[0], {}, { eventID: id });
  // cookie _fbp пиксель ставит после загрузки скрипта: серверную копию отправляем чуть позже
  setTimeout(() => { if (consent() === '0') return; const body = JSON.stringify({ n: m[0], id, u: location.origin + location.pathname, fbp: cookie('_fbp'), fbc: cookie('_fbc') });
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/ev?a=capi', body)) return; } catch (x) {}
    fetch('/api/ev?a=capi', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); }, 1500);
}
/** Плашка внизу экрана: сообщает о cookie один раз; «Отключить» выключает пиксель на этом устройстве. */
export function cookieBar() {
  if (consent() !== null || invited() || document.getElementById('ckbar')) return;
  const d = document.createElement('div'); d.id = 'ckbar'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookie');
  d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);z-index:80;max-width:560px;margin:0 auto;padding:14px 16px;border-radius:20px;background:rgba(28,28,30,.94);color:#F5F5F7;font:14px/1.4 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)';
  d.innerHTML = `Сайт использует cookie и пиксель Meta, чтобы понимать, какая реклама работает. Данные клиентов и результаты тестов туда не попадают. <a href="/privacy" style="color:#64D2FF">Подробнее</a>
    <div style="display:flex;gap:8px;margin-top:10px"><button id="ckyes" style="flex:1;height:40px;border:0;border-radius:9999px;background:#0EA5E9;color:#00131D;font:600 14px Inter,system-ui;cursor:pointer">Понятно</button><button id="ckno" style="flex:1;height:40px;border:1px solid rgba(255,255,255,.2);border-radius:9999px;background:transparent;color:#F5F5F7;font:500 14px Inter,system-ui;cursor:pointer">Отключить</button></div>`;
  document.body.appendChild(d);
  const set = v => { try { localStorage.setItem('bp_ck', v); } catch (e) {} };
  d.querySelector('#ckyes').onclick = () => { d.remove(); set('1'); };
  d.querySelector('#ckno').onclick = () => { d.remove(); set('0'); if (window.fbq) window.fbq('consent', 'revoke'); };
}
