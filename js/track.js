// Обезличенная аналитика воронки и ошибки из браузера. Без имен, почты, id аккаунта и данных теста:
// только название шага, роль (клиент / специалист) и случайный номер вкладки, который живет до ее закрытия.
const EVENTS = new Set(['app_open', 'onb_done', 'login_ok', 'safety_ok', 'safety_stop', 'test_start', 'test_done', 'test_cancel', 'map_view', 'share_result',
  'inv_open', 'result_sent', 'result_fail', 'pro_open', 'assess_start', 'assess_done', 'invite_sent', 'join_sent', 'result_pulled', 'report_sent', 'retest_set', 'err',
  'fb_sent', 'ref_share', 'install_shown', 'install_ok']);
let sid; try { sid = sessionStorage.getItem('bp_sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('bp_sid', sid); } } catch (e) { sid = Math.random().toString(36).slice(2, 12); }
const t0 = Date.now(), q = [], seen = new Set(); let errs = 0;
const role = () => { try { return localStorage.getItem('bp_mode') === 'pro' ? 'pro' : 'client'; } catch (e) { return 'client'; } };
const clip = v => String(v).replace(/https?:\/\/[^\s)]+/g, u => u.split(/[?#]/)[0]).slice(0, 160);

function flush() {
  if (!q.length) return;
  const body = JSON.stringify({ s: sid, r: role(), ev: q.splice(0, 40) });
  try { if (navigator.sendBeacon && navigator.sendBeacon('/api/ev', body)) return; } catch (e) {}
  fetch('/api/ev', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}

/** Шаг воронки. once: считать один раз за вкладку (открытие экрана, а не каждое перерисовывание). */
export function track(e, p, once = true) {
  if (!EVENTS.has(e)) return;
  if (once && !p) { if (seen.has(e)) return; seen.add(e); }
  const ev = { e, t: Date.now() - t0 };
  if (p) ev.p = Object.fromEntries(Object.entries(p).slice(0, 4).map(([k, v]) => [k, typeof v === 'number' ? v : clip(v).slice(0, 60)]));
  q.push(ev); if (q.length >= 15) flush();
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);
setInterval(flush, 30000);

// ошибки JS: до 5 за вкладку, адреса без параметров и фрагмента (во фрагменте ссылки клиента лежит ключ шифрования)
function err(m, f, l) { if (errs++ >= 5) return; track('err', { m: clip(m || 'unknown'), f: clip(f || '').split('/').pop(), l: l || 0 }, false); flush(); }
addEventListener('error', e => err(e.message, e.filename, e.lineno));
addEventListener('unhandledrejection', e => { const r = e.reason; err(r && r.message ? r.message : String(r), r && r.stack ? (String(r.stack).match(/\/([\w.-]+\.js):(\d+)/) || [])[1] : '', r && r.stack ? +((String(r.stack).match(/\.js:(\d+)/) || [])[1] || 0) : 0); });
