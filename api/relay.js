// Ретранслятор результатов «клиент → специалист».
// Сервер хранит только зашифрованные данные: ключ живет во фрагменте ссылки (#...), который браузер не отправляет на сервер.
// Отправить может любой, у кого есть ссылка (клиенту вход не обязателен); забрать и удалить может только вошедший специалист.
import { put, list, get, del } from '@vercel/blob';
import { currentUser } from './_session.js';

const ID = /^[A-Za-z0-9_-]{16,64}$/;
const MAX = 3.5 * 1024 * 1024;
const PER_ID = 20; // не больше 20 неразобранных результатов на одну ссылку: защита от засорения хранилища

async function readAll(stream) { const chunks = []; for await (const c of stream) chunks.push(Buffer.from(c)); return Buffer.concat(chunks).toString('utf8'); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const id = String(req.query.id || '');
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (body.length > MAX) return res.status(413).json({ error: 'too large' });
      // принимаем только конверт шифрования, а не произвольные данные
      let env; try { env = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      if (!env || env.v !== 1 || typeof env.iv !== 'string' || typeof env.ct !== 'string') return res.status(400).json({ error: 'bad body' });
      const { blobs } = await list({ prefix: `relay/${id}/`, limit: PER_ID });
      if (blobs.length >= PER_ID) return res.status(429).json({ error: 'too many' });
      const name = `relay/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
      await put(name, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      return res.status(200).json({ ok: true });
    }
    const u = await currentUser(req);
    if (!u || u.role !== 'specialist') return res.status(401).json({ error: 'login' });
    if (req.method === 'GET') {
      const ids = [...new Set(String(req.query.ids || '').split(',').filter(x => ID.test(x)))].slice(0, 200);
      const out = {};
      // параллельно пачками по 10: последовательный обход упирался бы в лимит времени функции
      for (let i = 0; i < ids.length; i += 10) {
        await Promise.all(ids.slice(i, i + 10).map(async id => {
          const { blobs } = await list({ prefix: `relay/${id}/`, limit: PER_ID });
          out[id] = (await Promise.all(blobs.map(async b => { const r = await get(b.pathname, { access: 'private', useCache: false }).catch(() => null); return r && r.stream ? { p: b.pathname, data: await readAll(r.stream) } : null; }))).filter(Boolean);
        }));
      }
      return res.status(200).json(out);
    }
    if (req.method === 'DELETE') {
      const p = String(req.query.p || '');
      if (!/^relay\/[A-Za-z0-9_-]{16,64}\/[0-9a-z-]+\.json$/.test(p)) return res.status(400).json({ error: 'bad path' });
      await del(p); return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'method' });
  } catch (e) { console.error('relay', e); res.status(500).json({ error: 'server' }); }
}
