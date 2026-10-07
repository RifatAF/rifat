// Отзывы из приложения: оценка (1–5 после теста или 0–10 «порекомендуете ли»), текст, где оставлен.
// Имя и контакт сохраняются, только если человек сам отметил «можно со мной связаться».
// Список видит только администратор беты: GET /api/feedback?days=90.
import { put, list, get } from '@vercel/blob';
import { currentUser, isAdmin } from './_session.js';

const KINDS = { result: [1, 5], nps: [0, 10], free: [0, 5] };
const PLACES = new Set(['map', 'result', 'home', 'menu', 'settings', 'done']);
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, n) : '';
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 6000) return res.status(413).json({ error: 'too large' });
      let b; try { b = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      const range = KINDS[b && b.k]; if (!range) return res.status(400).json({ error: 'kind' });
      const score = b.s == null || b.s === '' ? null : Math.round(+b.s);
      if (score != null && !(score >= range[0] && score <= range[1])) return res.status(400).json({ error: 'score' });
      const text = clip(b.t, 2000);
      if (score == null && !text) return res.status(400).json({ error: 'empty' });
      const fb = { at: Date.now(), k: b.k, s: score, t: text, w: PLACES.has(b.w) ? b.w : 'menu', r: b.r === 'pro' ? 'pro' : 'client', v: clip(b.v, 20) };
      if (b.contact === true) { const u = await currentUser(req).catch(() => null);
        fb.contact = { name: u ? clip(u.name, 80) : '', handle: u ? (u.username ? '@' + clip(u.username, 40) : clip(u.email, 120)) : '', note: clip(b.c, 120) }; }
      const day = new Date(fb.at).toISOString().slice(0, 10);
      await put(`feedback/${day}/${fb.at}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify(fb), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      const days = Math.max(1, Math.min(365, +req.query.days || 90)), edge = Date.now() - days * 864e5, names = []; let cursor;
      do { const r = await list({ prefix: 'feedback/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        names.push(...r.blobs.filter(x => new Date(x.uploadedAt).getTime() >= edge).map(x => x.pathname)); } while (cursor);
      const items = [];
      for (let i = 0; i < names.length; i += 10) await Promise.all(names.slice(i, i + 10).map(async n => {
        try { const r = await get(n, { access: 'private', useCache: false }); items.push(JSON.parse(await readAll(r.stream))); } catch (e) {} }));
      items.sort((x, y) => y.at - x.at);
      const nps = items.filter(x => x.k === 'nps' && x.s != null), res5 = items.filter(x => x.k === 'result' && x.s != null);
      const npsScore = nps.length ? Math.round((nps.filter(x => x.s >= 9).length - nps.filter(x => x.s <= 6).length) / nps.length * 100) : null;
      const avg = res5.length ? Math.round(res5.reduce((a, x) => a + x.s, 0) / res5.length * 10) / 10 : null;
      return res.status(200).json({ items: items.slice(0, 300), nps: npsScore, npsN: nps.length, resultAvg: avg, resultN: res5.length });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { console.error('feedback', e); return res.status(500).json({ error: 'server' }); }
}
