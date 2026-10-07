// Ретранслятор результатов «клиент → специалист».
// Сервер хранит только зашифрованные данные: ключ живет во фрагменте ссылки (#...), который браузер не отправляет на сервер.
// Ящик (id) выдает сервер вошедшему специалисту и подписывает: в id зашиты случайная часть, метка владельца и подпись.
// Отправить может любой, у кого есть ссылка (клиенту вход не обязателен), но только в подписанный ящик.
// Забрать и удалить может только владелец ящика.
import crypto from 'node:crypto';
import { put, list, get, del } from '@vercel/blob';
import { currentUser, saveUser } from './_session.js';

const ID = /^[A-Za-z0-9_-]{16,64}$/;
const MAX = 3.5 * 1024 * 1024;
const PER_ID = 20; // не больше 20 неразобранных результатов на одну ссылку: защита от засорения хранилища
const PER_DAY = 30; // новых ящиков на специалиста в сутки
const KEEP_DAYS = 30; // неразобранные результаты старше удаляются по расписанию
const EV_KEEP_DAYS = 120; // события аналитики
// ящики старого формата (id создавал браузер) принимаются до этой даты, чтобы не сломать уже отправленные ссылки
const LEGACY_UNTIL = Date.parse(process.env.RELAY_LEGACY_UNTIL || '2026-11-30T23:59:59Z');

const SECRET = process.env.SESSION_SECRET || '';
const mac = (s, n) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url').slice(0, n);
const ownerTag = uid => mac('relay-owner:' + uid, 8);
// id = 22 знака случайности + 8 знаков метки владельца + 16 знаков подписи = 46
function issue(uid) { const r = crypto.randomBytes(16).toString('base64url'), t = ownerTag(uid); return r + t + mac('relay-id:' + r + t, 16); }
function parse(id) {
  if (!SECRET || id.length !== 46) return null;
  const r = id.slice(0, 22), t = id.slice(22, 30), s = Buffer.from(id.slice(30)), want = Buffer.from(mac('relay-id:' + r + t, 16));
  return s.length === want.length && crypto.timingSafeEqual(s, want) ? { tag: t } : null;
}
const legacyOk = () => Date.now() < LEGACY_UNTIL;
// может ли пользователь читать и удалять этот ящик
const owns = (u, id) => { const p = parse(id); return p ? p.tag === ownerTag(u.id) : legacyOk(); };

async function readAll(stream) { const chunks = []; for await (const c of stream) chunks.push(Buffer.from(c)); return Buffer.concat(chunks).toString('utf8'); }

// ежедневная уборка (Vercel Cron): старые неразобранные результаты и события
export async function cleanup() {
  let n = 0;
  for (const [prefix, days] of [['relay/', KEEP_DAYS], ['ev/', EV_KEEP_DAYS]]) {
    const edge = Date.now() - days * 864e5; let cursor;
    do { const r = await list({ prefix, limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
      const old = r.blobs.filter(b => new Date(b.uploadedAt).getTime() < edge).map(b => b.url);
      if (old.length) { await del(old); n += old.length; } } while (cursor);
  }
  return n;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = String(req.query.a || '');
  try {
    if (req.method === 'POST' && a !== 'new') {
      const id = String(req.query.id || '');
      if (!ID.test(id)) return res.status(400).json({ error: 'bad id' });
      if (!parse(id) && !legacyOk()) return res.status(410).json({ error: 'link expired' });
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
    if (req.method === 'POST') { // a === 'new': новый подписанный ящик
      if (!SECRET) return res.status(503).json({ error: 'not configured' });
      const day = new Date().toISOString().slice(0, 10);
      if (u.relayDay !== day) { u.relayDay = day; u.relayN = 0; }
      if (u.relayN >= PER_DAY) return res.status(429).json({ error: 'лимит новых ссылок на сегодня' });
      u.relayN++; await saveUser(u);
      return res.status(200).json({ id: issue(u.id) });
    }
    if (req.method === 'GET') {
      const ids = [...new Set(String(req.query.ids || '').split(',').filter(x => ID.test(x) && owns(u, x)))].slice(0, 200);
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
      const p = String(req.query.p || ''), m = p.match(/^relay\/([A-Za-z0-9_-]{16,64})\/[0-9a-z-]+\.json$/);
      if (!m) return res.status(400).json({ error: 'bad path' });
      if (!owns(u, m[1])) return res.status(403).json({ error: 'forbidden' });
      await del(p); return res.status(200).json({ ok: true });
    }
    res.status(405).json({ error: 'method' });
  } catch (e) { console.error('relay', e); res.status(500).json({ error: 'server' }); }
}
