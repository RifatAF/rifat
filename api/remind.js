// Напоминания специалисту: кабинет присылает расписание (дата, тип, имя клиента, без данных о здоровье),
// раз в день по расписанию Vercel Cron бот пишет в Telegram, что завтра ретест или консультация.
// Вход через Google: напоминания видны только в приложении (экран «Сегодня» и календарь).
import { put, get, del, list } from '@vercel/blob';
import { currentUser } from './_session.js';

const KINDS = { retest: 'Повторный тест', consult: 'Консультация' };
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }
const path = uid => `remind/${uid}.json`;
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, n) : '';

/** Что отправить сегодня: события в ближайшие 36 часов, которые еще не отправлялись. */
export function due(rec, now = Date.now()) {
  const sent = new Set(rec.sent || []);
  return (rec.items || []).filter(i => i.t > now && i.t - now <= 36 * 3600e3 && !sent.has(i.k + ':' + i.t + ':' + i.n));
}
export function message(items, tz, origin) {
  const local = t => new Date(t - (tz || 0) * 60e3);
  const line = i => `• ${KINDS[i.k] || 'Событие'}${i.timed ? ' в ' + String(local(i.t).getUTCHours()).padStart(2, '0') + ':' + String(local(i.t).getUTCMinutes()).padStart(2, '0') : ''}: ${i.n}`;
  return `BodyPassport: скоро у ваших клиентов\n${items.map(line).join('\n')}\n\nКабинет: ${origin}/?pro=1`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET' && req.query.a === 'cron') {
      const cs = process.env.CRON_SECRET; if (!cs || req.headers.authorization !== `Bearer ${cs}`) return res.status(401).json({ error: 'cron' });
      const tok = process.env.TELEGRAM_BOT_TOKEN; let sent = 0, cursor;
      const origin = 'https://' + (req.headers.host || 'bodypassport.vercel.app');
      do { const r = await list({ prefix: 'remind/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        for (const b of r.blobs) { const uid = b.pathname.slice(7, -5); if (!/^t_\d+$/.test(uid) || !tok) continue;
          try { const g = await get(b.pathname, { access: 'private', useCache: false }); const rec = JSON.parse(await readAll(g.stream)); const d = due(rec); if (!d.length) continue;
            const ok = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
              body: JSON.stringify({ chat_id: uid.slice(2), text: message(d, rec.tz, origin), disable_web_page_preview: true }) }).then(x => x.ok).catch(() => false);
            if (ok) { rec.sent = [...(rec.sent || []), ...d.map(i => i.k + ':' + i.t + ':' + i.n)].slice(-500); rec.lastSent = Date.now(); sent += d.length;
              await put(b.pathname, JSON.stringify(rec), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }); } } catch (e) { console.error('remind', uid, e); } } } while (cursor);
      return res.status(200).json({ ok: true, sent });
    }
    const u = await currentUser(req); if (!u) return res.status(401).json({ error: 'войдите' });
    if (req.method === 'GET') { const g = await get(path(u.id), { access: 'private', useCache: false }).catch(() => null); const rec = g && g.stream ? JSON.parse(await readAll(g.stream)) : null;
      return res.status(200).json({ on: !!rec, count: rec ? rec.items.length : 0, lastSent: rec ? rec.lastSent || null : null, telegram: /^t_\d+$/.test(u.id) }); }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
    if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== 'object') return res.status(400).json({ error: 'bad body' });
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).map(i => i && typeof i === 'object' && Number.isFinite(+i.t) && KINDS[i.k] ? { t: +i.t, k: i.k, n: clip(i.n, 40) || 'клиент', timed: !!i.timed } : null).filter(Boolean);
    if (b.on === false || !items.length) { await del(path(u.id)).catch(() => {}); return res.status(200).json({ ok: true, on: false }); }
    const old = await get(path(u.id), { access: 'private', useCache: false }).then(g => g && g.stream ? readAll(g.stream).then(JSON.parse) : null).catch(() => null);
    const tz = Number.isFinite(+b.tz) ? Math.max(-840, Math.min(840, +b.tz)) : 0;
    await put(path(u.id), JSON.stringify({ items, tz, sent: (old && old.sent) || [], lastSent: old && old.lastSent, t: Date.now() }), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    return res.status(200).json({ ok: true, on: true, count: items.length });
  } catch (e) { console.error('remind', e); return res.status(500).json({ error: 'server' }); }
}
