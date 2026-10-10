// Отчет клиенту по веб-ссылке, только просмотр. Картинку отчета шифрует телефон специалиста,
// ключ живет во фрагменте ссылки (#...), который браузер не отправляет на сервер: сервер хранит только шифр.
// Создать может вошедший специалист (лимит в сутки), открыть может любой, у кого есть ссылка. Хранится 90 дней.
import crypto from 'node:crypto';
import { put, get, list } from '@vercel/blob';
import { currentUser } from './_session.js';

const ID = /^[A-Za-z0-9_-]{22}$/;
const MAX = 3.5 * 1024 * 1024;
const PER_DAY = 50;
export const SHARE_KEEP_DAYS = 90;
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || ''); if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const r = await get(`share/${id}.json`, { access: 'private', useCache: false }).catch(() => null);
      if (!r || !r.stream) return res.status(404).json({ error: 'ссылка устарела или удалена' });
      return res.status(200).json(JSON.parse(await readAll(r.stream)));
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
    if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
    const u = await currentUser(req); if (!u || u.role !== 'specialist') return res.status(401).json({ error: 'войдите как специалист' });
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (body.length > MAX) return res.status(413).json({ error: 'too large' });
    let env; try { env = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
    if (!env || env.v !== 1 || typeof env.iv !== 'string' || typeof env.ct !== 'string') return res.status(400).json({ error: 'bad body' });
    const tag = crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update('share:' + u.id).digest('base64url').slice(0, 10);
    const day = new Date().toISOString().slice(0, 10);
    const { blobs } = await list({ prefix: `sharecount/${tag}/${day}/`, limit: PER_DAY });
    if (blobs.length >= PER_DAY) return res.status(429).json({ error: 'на сегодня создано слишком много ссылок' });
    const id = crypto.randomBytes(16).toString('base64url');
    await put(`share/${id}.json`, JSON.stringify({ v: 1, z: !!env.z, iv: env.iv, ct: env.ct }), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
    await put(`sharecount/${tag}/${day}/${id}`, '1', { access: 'private', contentType: 'text/plain', addRandomSuffix: false });
    return res.status(200).json({ id, days: SHARE_KEEP_DAYS });
  } catch (e) { console.error('share', e); return res.status(500).json({ error: 'ошибка сервера' }); }
}
