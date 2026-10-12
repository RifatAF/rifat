// Калибровка беты: специалист отправляет разбор одного человека (своя оценка, анкета, замеры, гипотезы приложения, запись движения).
// Имени человека в данных нет: вместо него номер случая. Отправить может только вошедший специалист, список и файлы видит только администратор.
import { put, list, get } from '@vercel/blob';
import { currentUser, isAdmin } from './_session.js';

const MAX = 4 * 1024 * 1024;
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, n) : '';
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }
// о новой калибровке сразу пишем администраторам в Telegram (ADMIN_IDS вида t_<id>)
async function notify(text) { const tok = process.env.TELEGRAM_BOT_TOKEN; if (!tok) return;
  const ids = String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(x => /^t_\d+$/.test(x)).map(x => x.slice(2));
  await Promise.all(ids.map(id => fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: id, text: text.slice(0, 3500) }), signal: AbortSignal.timeout(4000) }).catch(() => {}))); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // веса правил, выученные по калибровкам: читают все приложения, меняет только администратор
    if (req.query.a === 'weights') {
      const W = 'config/weights.json', load = async () => { try { const r = await get(W, { access: 'private', useCache: false }); return r && r.stream ? JSON.parse(await readAll(r.stream)) : null; } catch (e) { return null; } };
      if (req.method === 'GET') { const cur = await load(); res.setHeader('Cache-Control', 'public, max-age=300'); return res.status(200).json(cur ? { w: cur.w || {}, at: cur.at, n: cur.n || 0 } : { w: {} }); }
      if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
      const u = await currentUser(req).catch(() => null); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      let b; try { b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      const prev = await load(); let hist = [...((prev && prev.history) || []), ...(prev && prev.w ? [{ at: prev.at, w: prev.w }] : [])].slice(-10);
      let w = {};
      // откат: берем версию до текущей, текущую в историю не кладем
      if (b.undo) { hist = ((prev && prev.history) || []).slice(); const last = hist.pop(); w = last ? last.w : {}; }
      else if (!b.reset) { for (const [k, v] of Object.entries(b.w || {})) if (/^[a-z0-9_]{1,40}\|[a-z0-9_]{1,40}$/.test(k) && Number.isFinite(+v) && +v >= .05 && +v <= 2) w[k] = Math.round(+v * 100) / 100; }
      const doc = { at: Date.now(), by: String(u.id), n: Math.max(0, Math.round(+b.n || 0)), w, history: hist };
      await put(W, JSON.stringify(doc), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
      return res.status(200).json({ ok: true, w, at: doc.at });
    }
    const u = await currentUser(req).catch(() => null);
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      if (!u) return res.status(401).json({ error: 'auth' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > MAX) return res.status(413).json({ error: 'too large' });
      let b; try { b = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      const c = b && b.case; if (!c || typeof c !== 'object' || !c.expert || !Array.isArray(c.assessments)) return res.status(400).json({ error: 'case' });
      const at = Date.now(), from = { id: String(u.id), name: clip(u.name, 80), handle: u.username ? '@' + clip(u.username, 40) : clip(u.email, 120) };
      const doc = { at, app: clip(b.app, 80), v: clip(b.v, 20), from, case: c };
      const path = `calib/${new Date(at).toISOString().slice(0, 10)}/${at}-${Math.random().toString(36).slice(2, 8)}.json`;
      await put(path, JSON.stringify(doc), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      await notify(`Калибровка от ${from.name || from.handle}: оценка специалиста ${c.expert.labels ? c.expert.labels.length : 0} пунктов, тестов ${c.assessments.length}. Скачать: Администрирование → Калибровки.`).catch(() => {});
      return res.status(200).json({ ok: true, at });
    }
    if (req.method === 'GET') {
      if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      if (req.query.p) { const p = String(req.query.p); if (!/^calib\/\d{4}-\d{2}-\d{2}\/[\w.-]+\.json$/.test(p)) return res.status(400).json({ error: 'path' });
        const r = await get(p, { access: 'private', useCache: false }); if (!r || !r.stream) return res.status(404).json({ error: 'not found' });
        return res.status(200).json(JSON.parse(await readAll(r.stream))); }
      const items = []; let cursor;
      do { const r = await list({ prefix: 'calib/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        items.push(...r.blobs.map(x => ({ p: x.pathname, at: new Date(x.uploadedAt).getTime(), size: x.size }))); } while (cursor);
      items.sort((x, y) => y.at - x.at);
      return res.status(200).json({ items });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { console.error('calib', e); return res.status(500).json({ error: 'server' }); }
}
