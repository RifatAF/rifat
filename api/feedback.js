// Отзывы из приложения: оценка (1–5 после теста или 0–10 «порекомендуете ли»), текст, где оставлен.
// Имя и контакт сохраняются, только если человек сам отметил «можно со мной связаться».
// Список видит только администратор беты: GET /api/feedback?days=90.
import { put, list, get } from '@vercel/blob';
import { currentUser, isAdmin } from './_session.js';

const KINDS = { result: [1, 5], nps: [0, 10], free: [0, 5], bug: [0, 0] };
const PLACES = new Set(['map', 'result', 'home', 'menu', 'settings', 'done', 'any']);
// диагностика к сообщению о проблеме: устройство, браузер, последние нажатия (только id кнопок) и ошибки, без имен и данных клиентов
function diag(d) { if (!d || typeof d !== 'object') return null; const o = {};
  for (const k of ['os', 'br', 'ua', 'scr', 'net', 'role', 'path', 'model', 'deleg', 'screen', 'storage']) if (d[k] != null) o[k] = clip(String(d[k]), 200);
  for (const k of ['mem', 'cpu', 'sec', 'fps', 'loadSec', 'quota']) if (Number.isFinite(+d[k])) o[k] = +d[k];
  if (typeof d.pwa === 'boolean') o.pwa = d.pwa; if (typeof d.persisted === 'boolean') o.persisted = d.persisted;
  for (const k of ['trail', 'errors']) if (Array.isArray(d[k])) o[k] = d[k].slice(-40).map(x => clip(String(x), 200));
  return o; }
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, n) : '';
// жалоба сразу приходит администраторам в Telegram (ADMIN_IDS вида t_<id>), чтобы не ждать сводки
async function notify(fb) { const tok = process.env.TELEGRAM_BOT_TOKEN; if (!tok) return;
  const ids = String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(x => /^t_\d+$/.test(x)).map(x => x.slice(2));
  const d = fb.d || {}, text = `Проблема (${fb.r}): ${fb.t}\n${d.os || ''} · ${d.br || ''} · ${d.scr || ''}${d.pwa ? ' · PWA' : ''}${d.fps ? ' · ' + d.fps + ' fps' : ''}${d.model ? ' · ' + d.model : ''}\n` +
    (d.errors && d.errors.length ? 'Ошибки: ' + d.errors.slice(-2).join(' | ') + '\n' : '') + (fb.contact ? 'Контакт: ' + fb.contact.handle : 'без контакта');
  await Promise.all(ids.map(id => fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: id, text: text.slice(0, 3500), disable_web_page_preview: true }), signal: AbortSignal.timeout(4000) }).catch(() => {}))); }
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 16000) return res.status(413).json({ error: 'too large' });
      let b; try { b = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      const range = KINDS[b && b.k]; if (!range) return res.status(400).json({ error: 'kind' });
      const score = b.s == null || b.s === '' ? null : Math.round(+b.s);
      if (score != null && !(score >= range[0] && score <= range[1])) return res.status(400).json({ error: 'score' });
      const text = clip(b.t, 2000);
      if (score == null && !text) return res.status(400).json({ error: 'empty' });
      const fb = { at: Date.now(), k: b.k, s: score, t: text, w: PLACES.has(b.w) ? b.w : 'menu', r: b.r === 'pro' ? 'pro' : 'client', v: clip(b.v, 20) };
      if (b.k === 'bug') { if (!text) return res.status(400).json({ error: 'empty' }); fb.d = diag(b.d); }
      if (b.contact === true) { const u = await currentUser(req).catch(() => null);
        fb.contact = { name: u ? clip(u.name, 80) : '', handle: u ? (u.username ? '@' + clip(u.username, 40) : clip(u.email, 120)) : '', note: clip(b.c, 120) }; }
      const day = new Date(fb.at).toISOString().slice(0, 10);
      if (fb.k === 'bug') await notify(fb).catch(() => {});
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
