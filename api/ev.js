// Обезличенные события воронки и ошибки из браузера (js/track.js). Пачка событий одной вкладки = один файл в Blob.
// Сводку видит только администратор беты: GET /api/ev?a=stats&days=14.
import { put, list, get } from '@vercel/blob';
import { currentUser, isAdmin } from './_session.js';

const NAMES = new Set(['app_open', 'onb_done', 'login_ok', 'safety_ok', 'safety_stop', 'test_start', 'test_done', 'test_cancel', 'map_view', 'share_result',
  'inv_open', 'result_sent', 'result_fail', 'pro_open', 'assess_start', 'assess_done', 'invite_sent', 'join_sent', 'result_pulled', 'report_sent', 'retest_set', 'err']);
const KEYS = new Set(['m', 'f', 'l', 'n', 'c']); // текст ошибки, файл, строка, число шагов, причина
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
  const out = { days: [], events: {}, errors: {} };
  for (let i = days - 1; i >= 0; i--) {
    const d = day(Date.now() - i * 864e5); out.days.push(d); let cursor; const names = [];
    do { const r = await list({ prefix: `ev/${d}/`, limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined; names.push(...r.blobs.map(b => b.pathname)); } while (cursor);
    const sess = {};
    for (let j = 0; j < names.length; j += 10) await Promise.all(names.slice(j, j + 10).map(async n => {
      try { const r = await get(n, { access: 'private', useCache: false }); const b = JSON.parse(await readAll(r.stream));
        for (const x of b.ev) { const k = b.r + ':' + x.e; (sess[k] ||= new Set()).add(b.s);
          if (x.e === 'err' && x.p) { const m = `${x.p.m || ''} @ ${x.p.f || ''}:${x.p.l || 0}`; out.errors[m] = (out.errors[m] || 0) + 1; } } } catch (e) {} }));
    for (const [k, s] of Object.entries(sess)) ((out.events[k] ||= {})[d] = s.size);
  }
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
