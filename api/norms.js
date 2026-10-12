// Нормы по базе: каждый тест анонимно присылает только числа своих замеров (углы, доли, число повторов) — без имени, аккаунта и записи движения.
// Чем больше людей прошли тест, тем точнее видно, что «обычно» у людей, и пороги правил подстраиваются под реальную выборку.
// Сводку видит только администратор: GET /api/norms?days=180.
import { put, list, get } from '@vercel/blob';
import { currentUser, isAdmin } from './_session.js';

const KEY = /^[a-z][a-z0-9_]{1,30}$/;
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }
const pct = (a, q) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * q)))];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 6000) return res.status(413).json({ error: 'too large' });
      let b; try { b = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      // только числа с понятными именами признаков; все прочее отбрасываем
      const f = Object.fromEntries(Object.entries(b && b.f && typeof b.f === 'object' ? b.f : {}).slice(0, 80)
        .filter(([k, v]) => KEY.test(k) && !k.startsWith('const') && typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e4).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
      if (Object.keys(f).length < 3) return res.status(400).json({ error: 'empty' });
      const q = Number.isFinite(+b.q) ? Math.max(0, Math.min(100, Math.round(+b.q))) : null;
      const doc = { at: Date.now(), f, q, r: b.r === 'pro' ? 'pro' : 'client', v: String(b.v || '').slice(0, 30) };
      await put(`norms/${new Date(doc.at).toISOString().slice(0, 10)}/${doc.at}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify(doc), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      return res.status(204).end();
    }
    if (req.method === 'GET') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      const days = Math.max(1, Math.min(730, +req.query.days || 180)), edge = Date.now() - days * 864e5, names = []; let cursor;
      do { const r = await list({ prefix: 'norms/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        names.push(...r.blobs.filter(x => new Date(x.uploadedAt).getTime() >= edge).map(x => x.pathname)); } while (cursor);
      const vals = {}; let n = 0;
      for (let i = 0; i < names.length; i += 20) await Promise.all(names.slice(i, i + 20).map(async p => {
        try { const r = await get(p, { access: 'private', useCache: false }); const d = JSON.parse(await readAll(r.stream));
          if (d.q != null && d.q < 60) return; n++; // плохая съемка в нормы не идет
          for (const [k, v] of Object.entries(d.f || {})) (vals[k] ||= []).push(v); } catch (e) {} }));
      const out = {};
      for (const [k, a] of Object.entries(vals)) { a.sort((x, y) => x - y); const abs = a.map(Math.abs).sort((x, y) => x - y);
        out[k] = { n: a.length, p10: pct(a, .1), p25: pct(a, .25), p50: pct(a, .5), p75: pct(a, .75), p90: pct(a, .9), abs80: pct(abs, .8), abs90: pct(abs, .9), raw: a.length <= 4000 ? a : undefined }; }
      return res.status(200).json({ tests: n, features: out });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { console.error('norms', e); return res.status(500).json({ error: 'server' }); }
}
