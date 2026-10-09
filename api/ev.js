// Обезличенные события воронки и ошибки из браузера (js/track.js). Пачка событий одной вкладки = один файл в Blob.
// Сводку видит только администратор беты: GET /api/ev?a=stats&days=14.
import { put, list, get } from '@vercel/blob';
import crypto from 'node:crypto';
import { currentUser, isAdmin, sessionUid } from './_session.js';
// псевдоним аккаунта: одинаков для одного человека, но по нему нельзя узнать id, имя или почту
const alias = uid => uid && process.env.SESSION_SECRET ? crypto.createHmac('sha256', process.env.SESSION_SECRET + ':ev').update(uid).digest('base64url').slice(0, 12) : null;

const NAMES = new Set(['app_open', 'onb_done', 'login_ok', 'safety_ok', 'safety_stop', 'test_start', 'test_done', 'test_cancel', 'map_view', 'share_result',
  'inv_open', 'result_sent', 'result_fail', 'pro_open', 'assess_start', 'assess_done', 'invite_sent', 'join_sent', 'result_pulled', 'report_sent', 'retest_set', 'err',
  'fb_sent', 'ref_share', 'install_shown', 'install_ok',
  'pose_init', 'pose_fail', 'cam_err', 'setup', 'retake', 'step_skip', 'cam_q', 'storage', 'db_empty', 'db_other', 'backup_done', 'restore_done',
  'gate_hit', 'compare_open', 'retest_done', 'report_shared', 'bug_sent', 'rage', 'slow']);
const KEYS = new Set(['m', 'f', 'l', 'n', 'c', 'r', 'd', 's', 'q']); // ошибка, файл, строка, число, категория, источник, секунды, оценка, качество
// события, у которых в сводке видна разбивка по категории (c) и медиана чисел (d, n, q)
const DETAIL = new Set(['pose_init', 'pose_fail', 'cam_err', 'setup', 'retake', 'step_skip', 'cam_q', 'storage', 'gate_hit', 'rage', 'slow', 'result_fail', 'test_done', 'assess_done']);
const MAX = 8 * 1024;
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
  const out = { days: [], events: {}, errors: {}, sources: {}, testSec: [], detail: {}, users: {}, weeks: {} };
  const nums = {}; const push = (k, v) => { if (Number.isFinite(v) && (nums[k] ||= []).length < 3000) nums[k].push(v); };
  for (let i = days - 1; i >= 0; i--) {
    const d = day(Date.now() - i * 864e5); out.days.push(d); let cursor; const names = [];
    do { const r = await list({ prefix: `ev/${d}/`, limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined; names.push(...r.blobs.map(b => b.pathname)); } while (cursor);
    const sess = {};
    for (let j = 0; j < names.length; j += 10) await Promise.all(names.slice(j, j + 10).map(async n => {
      try { const r = await get(n, { access: 'private', useCache: false }); const b = JSON.parse(await readAll(r.stream));
        if (b.u) { const W0 = Date.parse('2026-01-05'), wk = day(W0 + Math.floor((Date.parse(d) - W0) / (7 * 864e5)) * 7 * 864e5); ((out.users[b.u] ||= { r: b.r, days: new Set(), assess: 0, reports: 0, retests: 0, bugs: 0 }).days.add(d));
          const U = out.users[b.u]; if (b.r === 'pro') U.r = 'pro'; for (const x of b.ev) { if (x.e === 'assess_done') U.assess++; if (x.e === 'report_sent' || x.e === 'report_shared') U.reports++; if (x.e === 'retest_done') U.retests++; if (x.e === 'bug_sent') U.bugs++; }
          ((out.weeks[wk] ||= new Set()).add(b.u)); }
        for (const x of b.ev) { const k = b.r + ':' + x.e; (sess[k] ||= new Set()).add(b.s);
          if (DETAIL.has(x.e) && x.p) { if (x.p.c != null) { const D = (out.detail[x.e] ||= {}); const c = String(x.p.c).slice(0, 40); D[c] = (D[c] || 0) + 1; }
            for (const nk of ['d', 'n', 'q']) if (typeof x.p[nk] === 'number') push(x.e + '.' + nk, x.p[nk]); }
          if (x.e === 'err' && x.p) { const m = `${x.p.m || ''} @ ${x.p.f || ''}:${x.p.l || 0}`; out.errors[m] = (out.errors[m] || 0) + 1; }
          if (x.e === 'app_open' && x.p && x.p.r) { const k = String(x.p.r).slice(0, 40); out.sources[k] = (out.sources[k] || 0) + 1; }
          if (x.e === 'test_done' && x.p && x.p.d > 0 && out.testSec.length < 2000) out.testSec.push(x.p.d); } } catch (e) {} }));
    for (const [k, s] of Object.entries(sess)) ((out.events[k] ||= {})[d] = s.size);
  }
  const pct = (a, q) => a[Math.min(a.length - 1, Math.floor(a.length * q))];
  out.medians = Object.fromEntries(Object.entries(nums).map(([k, a]) => { a.sort((x, y) => x - y); return [k, { p50: pct(a, .5), p90: pct(a, .9), n: a.length }]; }));
  out.users = Object.entries(out.users).map(([id, U]) => ({ id, r: U.r, days: U.days.size, assess: U.assess, reports: U.reports, retests: U.retests, bugs: U.bugs })).sort((a, b) => b.days - a.days).slice(0, 200);
  out.weeks = Object.fromEntries(Object.entries(out.weeks).map(([w, s]) => [w, s.size]));
  const t = out.testSec.sort((a, b) => a - b); out.testMedianSec = t.length ? t[Math.floor(t.length / 2)] : null; out.testN = t.length; delete out.testSec;
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > MAX) return res.status(413).json({ error: 'too large' });
      let b; try { b = clean(JSON.parse(raw)); } catch (e) { b = null; }
      if (!b) return res.status(400).json({ error: 'bad body' });
      const u = alias(sessionUid(req)); if (u) b.u = u;
      const now = Date.now();
      await put(`ev/${day(now)}/${now}-${b.s}-${Math.random().toString(36).slice(2, 6)}.json`, JSON.stringify(b), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      return res.status(204).end();
    }
    if (req.method === 'GET' && req.query.a === 'stats') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await stats(Math.max(1, Math.min(31, +req.query.days || 14))));
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { console.error('ev', e); return res.status(500).json({ error: 'server' }); }
}
