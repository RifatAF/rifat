// Пиксель Meta для оценки рекламы. Включается только после согласия на cookie (плашка на лендинге, bp_ck = '1').
// Не включается у клиента, пришедшего по ссылке специалиста: там данные о здоровье, реклама специалисту не нужна.
// Автосбор кнопок и форм (autoConfig) и расширенное сопоставление выключены: уходят только названия шагов ниже.
const ID = '1665893074198906';
// наше событие воронки → событие Meta; std: стандартное событие, иначе свое
const MAP = { page_view: ['PageView', 1], pro_open: ['Lead', 1], signup: ['CompleteRegistration', 1],
  first_test: ['FirstTest', 0], first_report: ['FirstReport', 0], pay_redirect: ['InitiateCheckout', 1] };
let on = false; const sent = new Set();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const invited = () => !!lsGet('bp_inv') || /^#(inv|join|r|rep|share)=/.test(location.hash);
export const consent = () => lsGet('bp_ck');
export function setConsent(yes) { try { localStorage.setItem('bp_ck', yes ? '1' : '0'); } catch (e) {} if (yes) start(); }
function start() {
  if (on || consent() !== '1' || invited() || lsGet('bp_noev') === '1') return; on = true;
  const f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
  if (!window._fbq) window._fbq = f; f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
  f('set', 'autoConfig', false, ID); f('init', ID);
}
/** Шаг воронки из track(): если согласие есть, уходит в Meta (каждое событие один раз за вкладку, просмотр страницы каждый раз). */
export function pixel(e) {
  const m = MAP[e]; if (!m) return; start(); if (!on) return;
  if (e !== 'page_view') { if (sent.has(m[0])) return; sent.add(m[0]); }
  window.fbq(m[1] ? 'track' : 'trackCustom', m[0]);
}
/** Плашка cookie внизу экрана: показываем один раз, пока человек не выбрал. Без согласия пиксель не грузится. */
export function cookieBar() {
  if (consent() !== null || invited() || document.getElementById('ckbar')) return;
  const d = document.createElement('div'); d.id = 'ckbar'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Cookie');
  d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);z-index:80;max-width:560px;margin:0 auto;padding:14px 16px;border-radius:20px;background:rgba(28,28,30,.94);color:#F5F5F7;font:14px/1.4 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)';
  d.innerHTML = `Сайт использует cookie и пиксель Meta, чтобы понимать, какая реклама работает. Данные клиентов и результаты тестов туда не попадают. <a href="/privacy" style="color:#64D2FF">Подробнее</a>
    <div style="display:flex;gap:8px;margin-top:10px"><button id="ckyes" style="flex:1;height:40px;border:0;border-radius:9999px;background:#0EA5E9;color:#00131D;font:600 14px Inter,system-ui;cursor:pointer">Разрешить</button><button id="ckno" style="flex:1;height:40px;border:1px solid rgba(255,255,255,.2);border-radius:9999px;background:transparent;color:#F5F5F7;font:500 14px Inter,system-ui;cursor:pointer">Только необходимые</button></div>`;
  document.body.appendChild(d);
  d.querySelector('#ckyes').onclick = () => { d.remove(); setConsent(true); pixel('page_view'); };
  d.querySelector('#ckno').onclick = () => { d.remove(); setConsent(false); };
}
