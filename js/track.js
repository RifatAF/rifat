// Обезличенная аналитика воронки, технические события и ошибки из браузера. Без имен, почты и данных теста:
// название шага, роль (клиент / специалист), случайный номер вкладки и, если человек вошел, псевдоним аккаунта,
// который считает сервер (HMAC от id, обратно не превращается). Нужен, чтобы видеть одного специалиста по неделям.
const EVENTS = new Set(['app_open', 'onb_done', 'login_ok', 'safety_ok', 'safety_stop', 'test_start', 'test_done', 'test_cancel', 'map_view', 'share_result',
  'inv_open', 'result_sent', 'result_fail', 'pro_open', 'assess_start', 'assess_done', 'invite_sent', 'join_sent', 'result_pulled', 'report_sent', 'retest_set', 'err',
  'fb_sent', 'ref_share', 'install_shown', 'install_ok',
  // бета: техника и трение
  'pose_init', 'pose_fail', 'cam_err', 'setup', 'retake', 'step_skip', 'cam_q', 'storage', 'db_empty', 'db_other', 'backup_done', 'restore_done',
  'gate_hit', 'compare_open', 'retest_done', 'report_shared', 'bug_sent', 'rage', 'slow',
  'pro_click', 'vas_done', 'report_link', 'progress_sent',
  'paywall_view', 'limit_hit', 'trial_end', 'trial_end_view', 'balance_pay']);
let sid; try { sid = sessionStorage.getItem('bp_sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('bp_sid', sid); } } catch (e) { sid = Math.random().toString(36).slice(2, 12); }
const t0 = Date.now(), q = [], seen = new Set(); let errs = 0;
const role = () => { try { return localStorage.getItem('bp_mode') === 'pro' ? 'pro' : 'client'; } catch (e) { return 'client'; } };
const clip = v => String(v).replace(/https?:\/\/[^\s)]+/g, u => u.split(/[?#]/)[0]).slice(0, 160);
// последние действия для кнопки «Что-то не так»: остаются в памяти вкладки и уходят только вместе с жалобой
const trail = []; const remember = s => { trail.push(Math.round((Date.now() - t0) / 1000) + 's ' + s); if (trail.length > 40) trail.shift(); };
export const lastErrors = [];

function flush() {
  if (!q.length) return;
  // администратор тестирует сам: его действия не попадают в статистику (переключатель в панели администратора)
  try { if (localStorage.getItem('bp_noev') === '1') { q.length = 0; return; } } catch (e) {}
  const body = JSON.stringify({ s: sid, r: role(), ev: q.splice(0, 40) });
  try { if (navigator.sendBeacon && navigator.sendBeacon('/api/ev', body)) return; } catch (e) {}
  fetch('/api/ev', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}

/** Шаг воронки. once: считать один раз за вкладку (открытие экрана, а не каждое перерисовывание). */
export function track(e, p, once = true) {
  if (!EVENTS.has(e)) return;
  if (once && !p) { if (seen.has(e)) return; seen.add(e); }
  const ev = { e, t: Date.now() - t0 };
  if (p) ev.p = Object.fromEntries(Object.entries(p).slice(0, 4).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 10) / 10 : clip(v).slice(0, 60)]));
  remember(e + (ev.p ? ' ' + JSON.stringify(ev.p) : ''));
  q.push(ev); if (q.length >= 15) flush();
}

/** Сведения об устройстве и последних действиях для отчета о проблеме. Без имен и данных клиентов. */
export function diagnostics(extra = {}) {
  const n = navigator, sc = screen || {};
  const ua = n.userAgent || '', os = /iPhone|iPad/.test(ua) ? 'iOS ' + ((ua.match(/OS (\d+[_\d]*)/) || [])[1] || '').replace(/_/g, '.') : /Android/.test(ua) ? 'Android ' + ((ua.match(/Android ([\d.]+)/) || [])[1] || '') : n.platform || '?';
  const br = /YaBrowser/.test(ua) ? 'Yandex' : /Telegram/.test(ua) || window.Telegram?.WebApp?.initData ? 'Telegram' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox/.test(ua) ? 'Firefox' : '?';
  return { os, br, ua: ua.slice(0, 200), scr: `${sc.width || 0}x${sc.height || 0}@${devicePixelRatio || 1}`, mem: n.deviceMemory || null, cpu: n.hardwareConcurrency || null,
    pwa: matchMedia('(display-mode: standalone)').matches || n.standalone === true, net: n.connection ? n.connection.effectiveType : null, role: role(),
    path: location.pathname, sec: Math.round((Date.now() - t0) / 1000), trail: trail.slice(-30), errors: lastErrors.slice(-5), ...extra };
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);
setInterval(flush, 30000);

// нажатия: в след пишем только id кнопки (подписи могут содержать имя клиента); 4 нажатия по одному месту за 1,5 с = «злой тап»
let taps = [];
addEventListener('click', e => { const el = e.target.closest && e.target.closest('button,a,label,[role=button],input,select'); const id = el ? (el.id || el.className && String(el.className).split(' ')[0] || el.tagName.toLowerCase()) : '-';
  remember('tap ' + id); const now = Date.now(); taps = taps.filter(x => now - x.t < 1500 && x.id === id); taps.push({ t: now, id });
  if (taps.length === 4 && id !== '-') track('rage', { c: id }, false); }, { capture: true, passive: true });

// долгие подвисания интерфейса (больше 1 с) на слабых телефонах
try { let n = 0; new PerformanceObserver(l => { for (const x of l.getEntries()) if (x.duration > 1000 && n++ < 3) track('slow', { d: x.duration / 1000 }, false); }).observe({ type: 'longtask', buffered: false }); } catch (e) {}

// ошибки JS: до 5 за вкладку, адреса без параметров и фрагмента (во фрагменте ссылки клиента лежит ключ шифрования)
function err(m, f, l) { const x = { m: clip(m || 'unknown'), f: clip(f || '').split('/').pop(), l: l || 0 }; lastErrors.push(`${x.m} @ ${x.f}:${x.l}`); if (lastErrors.length > 10) lastErrors.shift();
  if (errs++ >= 5) return; track('err', x, false); flush(); }
addEventListener('error', e => err(e.message, e.filename, e.lineno));
addEventListener('unhandledrejection', e => { const r = e.reason; err(r && r.message ? r.message : String(r), r && r.stack ? (String(r.stack).match(/\/([\w.-]+\.js):(\d+)/) || [])[1] : '', r && r.stack ? +((String(r.stack).match(/\.js:(\d+)/) || [])[1] || 0) : 0); });

// шкала боли VAS 0–10 и комплаенс: чистые функции в js/vas.js (без DOM, проверяются в tests/api.test.mjs)
export { vasDelta, vasLog, vasSave, vasStats } from './vas.js';
