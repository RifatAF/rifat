// Обезличенные события воронки и ошибки из браузера (js/track.js). Пачка событий одной вкладки = один файл в Blob.
// Сводку видит только администратор беты: GET /api/ev?a=stats&days=14.
import { put, list, get, del } from './_store.js';
import crypto from 'node:crypto';
import { currentUser, isAdmin, sessionUid, loadUser, allUsers, noStats } from './_session.js';
// псевдоним аккаунта: одинаков для одного человека, но по нему нельзя узнать id, имя или почту
const alias = uid => uid && process.env.SESSION_SECRET ? crypto.createHmac('sha256', process.env.SESSION_SECRET + ':ev').update(uid).digest('base64url').slice(0, 12) : null;

const NAMES = new Set(['app_open', 'plan_minutes', 'onb_done', 'login_ok', 'safety_ok', 'safety_stop', 'test_start', 'test_done', 'test_cancel', 'map_view', 'share_result',
  'inv_open', 'result_sent', 'result_fail', 'pro_open', 'assess_start', 'assess_done', 'invite_sent', 'join_sent', 'result_pulled', 'report_sent', 'retest_set', 'err',
  'fb_sent', 'ref_share', 'install_shown', 'install_ok', 'install_guide', 'install_copy', 'install_later', 'paste_link_view', 'paste_link_ok', 'client_welcome', 'client_step',
  // воронка ТЗ v4 (п. 8.4): регистрация, первый тест, первый отчет, повтор за 14 дней, установка, оплата; плюс события, что раньше терялись
  'page_view', 'signup', 'first_test', 'first_report', 'retest_14d', 'install_click', 'profile_done', 'beta_skip_test', 'calib_sent',
  'pose_init', 'pose_fail', 'cam_err', 'setup', 'retake', 'step_skip', 'cam_q', 'storage', 'db_empty', 'db_other', 'backup_done', 'restore_done',
  'gate_hit', 'compare_open', 'retest_done', 'report_shared', 'bug_sent', 'rage', 'slow',
  'pro_click', 'vas_done', 'report_link', 'progress_sent', 'hw_sent', 'hw_seen', 'hw_ask',
  'paywall_view', 'limit_hit', 'trial_end', 'trial_end_view', 'balance_pay', 'pay_redirect', 'screen', 'back', 'device', 'main_recognize', 'workout_pain_block', 'update_offer', 'session_start', 'session_done', 'retest_after', 'ba_period', 'scroll', 'qback', 'retest_pair', 'menu', 'try_click']);
const KEYS = new Set(['m', 'f', 'l', 'n', 'c', 'r', 'd', 's', 'q']); // ошибка, файл, строка, число, категория, источник, секунды, оценка, качество
// события, у которых в сводке видна разбивка по категории (c) и медиана чисел (d, n, q)
const DETAIL = new Set(['client_step', 'install_guide', 'hw_sent', 'try_click', 'menu', 'qback', 'pose_init', 'pose_fail', 'cam_err', 'setup', 'retake', 'step_skip', 'cam_q', 'storage', 'gate_hit', 'rage', 'slow', 'result_fail', 'test_done', 'assess_done', 'vas_done', 'report_link', 'paywall_view', 'limit_hit', 'trial_end', 'pro_click', 'fb_sent', 'main_recognize', 'workout_pain_block']);
const MAX = 8 * 1024;
// аккаунты вне статистики (noStats в _session.js): при записи проверяем вошедшего, в сводке и при очистке ищем по псевдониму
const skipUid = new Map();
async function skipped(uid) { if (!uid) return false; const c = skipUid.get(uid); if (c && Date.now() - c.t < 6e5) return c.v;
  const v = noStats(await loadUser(uid)); skipUid.set(uid, { v, t: Date.now() }); return v; }
async function excluded() { const us = (await allUsers()).filter(noStats); return { uids: new Set(us.map(u => u.id)), aliases: new Set(us.map(u => alias(u.id)).filter(Boolean)) }; }
// ошибка наша, если она в файле приложения (app.js, quick.js…); числовые файлы, пустые и логгеры встроенных браузеров чужие
const ownErr = (m, f) => /^[a-z][\w-]*\.js$/i.test(f || '') && !/ResizeObserver loop|Java object is gone|M_ID|window\._M/.test(m || '');
const day = t => new Date(t).toISOString().slice(0, 10);

function clean(b) {
  if (!b || typeof b !== 'object' || !/^[a-z0-9]{4,16}$/.test(b.s || '') || !Array.isArray(b.ev)) return null;
  const ev = b.ev.slice(0, 40).filter(x => x && NAMES.has(x.e)).map(x => {
    const o = { e: x.e, t: Math.max(0, Math.min(864e5, +x.t || 0)) };
    if (x.p && typeof x.p === 'object') o.p = Object.fromEntries(Object.entries(x.p).slice(0, 4).filter(([k]) => KEYS.has(k))
      .map(([k, v]) => [k, typeof v === 'number' && Number.isFinite(v) ? v : String(v).slice(0, 160)]));
    return o; });
  return ev.length ? { s: b.s, r: b.r === 'pro' ? 'pro' : 'client', ev } : null;
}
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }

async function stats(days) {
  const ex = await excluded().catch(() => ({ uids: new Set(), aliases: new Set() }));
  const out = { excluded: 0, errDays: {}, days: [], events: {}, errors: {}, sources: {}, testSec: [], detail: {}, users: {}, weeks: {}, channels: {}, screens: {} };
  // воронка по каналу: сколько вкладок из каждого источника дошли до шага
  const FUN = ['app_open', 'inv_open', 'safety_ok', 'test_start', 'test_done', 'result_sent', 'map_view', 'fb_sent', 'pro_open', 'assess_done', 'invite_sent', 'join_sent', 'report_sent'];
  const scr = {}; const chOf = {}; const devOf = {}; out.devices = {}; out.models = {}; const fpsBy = {};
  const nums = {}; const push = (k, v) => { if (Number.isFinite(v) && (nums[k] ||= []).length < 3000) nums[k].push(v); };
  for (let i = days - 1; i >= 0; i--) {
    const d = day(Date.now() - i * 864e5); out.days.push(d); let cursor; const names = [];
    do { const r = await list({ prefix: `ev/${d}/`, limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined; names.push(...r.blobs.map(b => b.pathname)); } while (cursor);
    const sess = {}, docs = [];
    for (let j = 0; j < names.length; j += 10) await Promise.all(names.slice(j, j + 10).map(async n => {
      try { const r = await get(n, { access: 'private', useCache: false }); docs.push(JSON.parse(await readAll(r.stream))); } catch (e) {} }));
    // вкладка, где хоть раз был исключенный аккаунт, выпадает целиком: и действия до входа тоже
    const bad = new Set(docs.filter(b => b.u && ex.aliases.has(b.u)).map(b => b.s));
    for (const b of docs) {
      if (bad.has(b.s)) { out.excluded++; continue; }
      try {
        if (b.u) { const W0 = Date.parse('2026-01-05'), wk = day(W0 + Math.floor((Date.parse(d) - W0) / (7 * 864e5)) * 7 * 864e5); ((out.users[b.u] ||= { r: b.r, days: new Set(), wk: new Set(), assess: 0, reports: 0, retests: 0, hw: 0, bugs: 0 }).days.add(d));
          const U = out.users[b.u]; U.wk.add(wk); if (b.r === 'pro') U.r = 'pro'; for (const x of b.ev) { if (x.e === 'assess_done') U.assess++; if (x.e === 'report_sent' || x.e === 'report_shared') U.reports++; if (x.e === 'retest_done') U.retests++; if (x.e === 'hw_sent') U.hw++; if (x.e === 'bug_sent') U.bugs++; }
          ((out.weeks[wk] ||= new Set()).add(b.u)); }
        for (const x of b.ev) { const k = b.r + ':' + x.e; (sess[k] ||= new Set()).add(b.s);
          if (DETAIL.has(x.e) && x.p) { if (x.p.c != null) { const D = (out.detail[x.e] ||= {}); const c = String(x.p.c).slice(0, 40); D[c] = (D[c] || 0) + 1; }
            for (const nk of ['d', 'n', 'q']) if (typeof x.p[nk] === 'number') push(x.e + '.' + nk, x.p[nk]); }
          if (x.e === 'err' && x.p) { const m = `${x.p.m || ''} @ ${x.p.f || ''}:${x.p.l || 0}`, E = (out.errors[m] ||= { n: 0, days: {}, own: ownErr(x.p.m, x.p.f) });
            E.n++; E.days[d] = (E.days[d] || 0) + 1; if (E.own) out.errDays[d] = (out.errDays[d] || 0) + 1; }
          if (x.e === 'app_open' && x.p && x.p.c) chOf[b.s] = String(x.p.c).slice(0, 20);
          if (x.e === 'device' && x.p && x.p.c) { devOf[b.s] = String(x.p.c).slice(0, 40); const m = String(x.p.m || '').slice(0, 30); if (m) out.models[m] = (out.models[m] || 0) + 1; }
          if (x.e === 'cam_q' && x.p && typeof x.p.n === 'number' && x.p.n > 0) (fpsBy[b.s] ||= []).push(x.p.n);
          if (x.e === 'screen' && x.p && x.p.c) { const S = (scr[String(x.p.c).slice(0, 40)] ||= { n: 0, sec: [], taps: 0, miss: 0, back: 0, qback: 0, depth: [], skim: 0, scrolled: 0 }); S.n++; if (typeof x.p.d === 'number' && S.sec.length < 2000) S.sec.push(x.p.d); S.taps += +x.p.n || 0; S.miss += +x.p.q || 0; }
          if ((x.e === 'qback' || x.e === 'scroll') && x.p && x.p.c) { const S = (scr[String(x.p.c).slice(0, 40)] ||= { n: 0, sec: [], taps: 0, miss: 0, back: 0, qback: 0, depth: [], skim: 0, scrolled: 0 });
            if (x.e === 'qback') S.qback++; else { S.scrolled++; if (typeof x.p.v === 'number' && S.depth.length < 2000) S.depth.push(x.p.v); if (x.p.s >= 1.5 && x.p.v >= 80) S.skim++; } }
          if (x.e === 'back' && x.p && x.p.c) { const S = (scr[String(x.p.c).slice(0, 40)] ||= { n: 0, sec: [], taps: 0, miss: 0, back: 0, qback: 0, depth: [], skim: 0, scrolled: 0 }); S.back++; }
          if (x.e === 'app_open' && x.p && x.p.r) { const k = String(x.p.r).slice(0, 40); out.sources[k] = (out.sources[k] || 0) + 1; }
          if (x.e === 'test_done' && x.p && x.p.d > 0 && out.testSec.length < 2000) out.testSec.push(x.p.d); } } catch (e) {} }
    for (const [k, s] of Object.entries(sess)) ((out.events[k] ||= {})[d] = s.size);
    const DEVE = ['app_open', 'test_start', 'test_done', 'pose_fail', 'cam_err', 'result_sent', 'bug_sent'];
    for (const [k, set] of Object.entries(sess)) { const e = k.split(':')[1]; if (!DEVE.includes(e)) continue; for (const sid of set) { const dv = devOf[sid]; if (!dv) continue; const D = (out.devices[dv] ||= { fps: [] }); D[e] = (D[e] || 0) + 1; } }
    for (const [sid, a] of Object.entries(fpsBy)) { const dv = devOf[sid]; if (dv) ((out.devices[dv] ||= { fps: [] }).fps).push(...a); }
    for (const k of Object.keys(fpsBy)) delete fpsBy[k];
    for (const [k, set] of Object.entries(sess)) { const e = k.split(':')[1]; if (!FUN.includes(e)) continue; for (const sid of set) { const ch = chOf[sid] || 'direct'; const C = (out.channels[ch] ||= {}); C[e] = (C[e] || 0) + 1; } }
  }
  const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
  out.medians = Object.fromEntries(Object.entries(nums).map(([k, a]) => { a.sort((x, y) => x - y); return [k, { p50: pct(a, .5), p90: pct(a, .9), n: a.length }]; }));
  // пользуются ли: люди (аккаунты специалистов), а не вкладки. Шаги: работали → тест → отправили клиенту → вернулись → ведут клиента
  const P = Object.values(out.users).filter(U => U.r === 'pro'), last7 = new Set(out.days.slice(-7));
  out.people = { pros: P.length, tested: P.filter(U => U.assess).length, sent: P.filter(U => U.reports || U.hw).length, back: P.filter(U => U.days.size >= 2).length,
    weeks2: P.filter(U => U.wk.size >= 2).length, lead: P.filter(U => U.retests || U.hw >= 2).length, active7: P.filter(U => [...U.days].some(x => last7.has(x))).length };
  try { const from = Date.now() - days * 864e5, sp = (await allUsers()).filter(u => u.role === 'specialist' && !noStats(u));
    Object.assign(out.people, { signups: sp.filter(u => (u.created || 0) >= from).length, total: sp.length, payingNow: sp.filter(u => ['pro', 'studio'].includes(u.plan) && (u.planUntil || 0) > Date.now()).length, paidEver: sp.filter(u => u.paidEver).length }); } catch (e) {}
  out.users = Object.entries(out.users).map(([id, U]) => ({ id, r: U.r, days: U.days.size, weeks: U.wk.size, assess: U.assess, reports: U.reports, retests: U.retests, hw: U.hw, bugs: U.bugs })).sort((a, b) => b.days - a.days).slice(0, 200);
  out.devices = Object.fromEntries(Object.entries(out.devices).map(([k, D]) => { const f = D.fps.sort((x, y) => x - y); delete D.fps; return [k, { ...D, fps: f.length ? Math.round(pct(f, .5)) : null }]; }));
  out.screens = Object.fromEntries(Object.entries(scr).map(([k, S]) => { S.sec.sort((x, y) => x - y); return [k, { n: S.n, p50: S.sec.length ? Math.round(pct(S.sec, .5)) : null, p90: S.sec.length ? Math.round(pct(S.sec, .9)) : null, taps: S.n ? Math.round(S.taps / S.n * 10) / 10 : 0, miss: S.n ? Math.round(S.miss / S.n * 10) / 10 : 0, back: S.back, qback: S.qback || 0,
    depth: S.depth && S.depth.length ? Math.round(pct(S.depth.sort((x, y) => x - y), .5)) : null, skim: S.scrolled ? Math.round(S.skim / S.scrolled * 100) : null }]; }));
  out.weeks = Object.fromEntries(Object.entries(out.weeks).map(([w, s]) => [w, s.size]));
  const t = out.testSec.sort((a, b) => a - b); out.testMedianSec = t.length ? t[Math.floor(t.length / 2)] : null; out.testN = t.length; delete out.testSec;
  // оплаты PRO по вебхуку lava.top (api/lava.js пишет lava/done/): последний шаг воронки специалиста
  try { const from = Date.now() - days * 864e5; let cursor; do { const r = await list({ prefix: 'lava/done/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
    for (const b of r.blobs) { const t = +new Date(b.uploadedAt); if (t < from) continue;
      if (ex.uids.size) { try { const g = await get(b.pathname, { access: 'private', useCache: false }); if (ex.uids.has(JSON.parse(await readAll(g.stream)).uid)) continue; } catch (e) {} }
      { const k = day(t); ((out.events['pro:paid'] ||= {})[k] = (out.events['pro:paid'][k] || 0) + 1); } } } while (cursor); } catch (e) {}
  return out;
}

// Conversions API Meta: то же событие, что ушло из браузера (тот же event_id, Meta склеит дубли), но с сервера,
// чтобы не терять события из-за блокировщиков. Только названия шагов, IP, браузер и cookie _fbp/_fbc, без имени и почты.
// Токен в переменной окружения META_CAPI_TOKEN (Events Manager → Настройки → Conversions API); без токена ничего не уходит.
const CAPI_EVENTS = new Set(['PageView', 'Lead', 'CompleteRegistration', 'FirstTest', 'FirstReport', 'InitiateCheckout']);
async function capi(req, raw) {
  const tok = process.env.META_CAPI_TOKEN, pid = process.env.META_PIXEL_ID || '1834974184392747'; if (!tok) return 204;
  let b; try { b = JSON.parse(raw); } catch (e) { return 400; }
  if (!b || !CAPI_EVENTS.has(b.n) || !/^[\w-]{8,64}$/.test(b.id || '')) return 400;
  const url = /^https:\/\/(www\.)?bodypassport\.app\/[\w\/.-]*$/.test(b.u || '') ? b.u : 'https://www.bodypassport.app/';
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
  const user_data = { client_ip_address: ip, client_user_agent: String(req.headers['user-agent'] || '').slice(0, 400) };
  if (/^fb\.\d\.\d+\.[\w.-]+$/.test(b.fbp || '')) user_data.fbp = b.fbp; if (/^fb\.\d\.\d+\.[\w.-]+$/.test(b.fbc || '')) user_data.fbc = b.fbc;
  const body = { data: [{ event_name: b.n, event_time: Math.floor(Date.now() / 1000), event_id: b.id, action_source: 'website', event_source_url: url, user_data }] };
  if (process.env.META_TEST_CODE) body.test_event_code = process.env.META_TEST_CODE;
  const r = await fetch(`https://graph.facebook.com/${process.env.META_API_VER || 'v25.0'}/${pid}/events?access_token=${encodeURIComponent(tok)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) console.error('capi', r.status, (await r.text()).slice(0, 300));
  return 204;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST' && req.query.a === 'capi') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 2048) return res.status(413).json({ error: 'too large' });
      return res.status(await capi(req, raw)).end();
    }
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > MAX) return res.status(413).json({ error: 'too large' });
      let b; try { b = clean(JSON.parse(raw)); } catch (e) { b = null; }
      if (!b) return res.status(400).json({ error: 'bad body' });
      const uid = sessionUid(req); if (await skipped(uid).catch(() => false)) return res.status(204).end();
      const u = alias(uid); if (u) b.u = u;
      const now = Date.now();
      await put(`ev/${day(now)}/${now}-${b.s}-${Math.random().toString(36).slice(2, 6)}.json`, JSON.stringify(b), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      return res.status(204).end();
    }
    if (req.method === 'GET' && req.query.a === 'stats') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await stats(Math.max(1, Math.min(90, +req.query.days || 14))));
    }
    // очистка: удаляет уже накопленные события и отзывы аккаунтов вне статистики (вкладки целиком), остальное не трогает
    if (req.method === 'DELETE' && req.query.a === 'purge') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      const ex = await excluded(); let n = 0, seen = 0;
      for (const prefix of ['ev/', 'feedback/']) { let cursor; do { const r = await list({ prefix, limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        const docs = []; for (let j = 0; j < r.blobs.length; j += 20) await Promise.all(r.blobs.slice(j, j + 20).map(async x => {
          try { const g = await get(x.pathname, { access: 'private', useCache: false }); docs.push({ url: x.url, d: x.pathname.split('/')[1], b: JSON.parse(await readAll(g.stream)) }); } catch (e) {} }));
        seen += docs.length;
        const bad = new Set(docs.filter(x => x.b.u && ex.aliases.has(x.b.u)).map(x => x.d + ':' + x.b.s));
        const urls = docs.filter(x => prefix === 'ev/' ? bad.has(x.d + ':' + x.b.s) : ex.uids.has(x.b.uid)).map(x => x.url);
        for (let j = 0; j < urls.length; j += 500) await del(urls.slice(j, j + 500)); n += urls.length; } while (cursor); }
      return res.status(200).json({ ok: true, deleted: n, checked: seen, accounts: ex.uids.size });
    }
    // сброс статистики и отзывов перед реальным запуском: только админ и только с подтверждающим словом
    if (req.method === 'DELETE' && req.query.a === 'reset') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      if (String(req.query.confirm || '') !== 'СБРОС') return res.status(400).json({ error: 'нужно подтверждение' });
      let n = 0;
      for (const prefix of ['ev/', 'feedback/']) { let cursor; do { const r = await list({ prefix, limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        const urls = r.blobs.map(b => b.url); if (urls.length) { await del(urls); n += urls.length; } } while (cursor); }
      return res.status(200).json({ ok: true, deleted: n });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { console.error('ev', e); return res.status(500).json({ error: 'server' }); }
}
