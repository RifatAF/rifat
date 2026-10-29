// Напоминания специалисту: кабинет присылает расписание (дата, тип, имя клиента, без данных о здоровье),
// раз в день по расписанию Vercel Cron бот пишет в Telegram, что завтра ретест или консультация.
// Вход через Google: напоминания видны только в приложении (экран «Сегодня» и календарь).
import { put, get, del, list } from './_store.js';
import { currentUser, loadUser, effectivePlan, loadApp } from './_session.js';

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

// Клиент: напоминание о ретесте в Telegram. Приложение клиента создает запись (имя, дата, специалист — без данных о здоровье),
// клиент открывает бота по ссылке t.me/<бот>?start=c_<код>, бот запоминает чат и пишет за день до ретеста. /stop удаляет запись.
const cpath = t => `remindc/${t}.json`, CODE = /^[a-z0-9]{20}$/;
async function readJSON(p) { try { const g = await get(p, { access: 'private', useCache: false }); return g && g.stream ? JSON.parse(await readAll(g.stream)) : null; } catch (e) { return null; } }
const save = (p, o) => put(p, JSON.stringify(o), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
async function tgSend(chat, text) { const tok = process.env.TELEGRAM_BOT_TOKEN; if (!tok) return false;
  return fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) }).then(x => x.ok).catch(() => false); }
const ruDate = t => new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
export function clientMessage(r, origin, kind) {
  if (kind === 'hello') return `Здравствуйте${r.n ? ', ' + r.n : ''}! Я напомню о повторном тесте движения${r.d ? ' ' + ruDate(r.d) : ''}${r.s ? ' (назначил специалист: ' + r.s + ')' : ''}.\n\nВаша карта тела и упражнения: ${origin}/\nОтключить напоминания: /stop`;
  return `${r.n ? r.n + ', з' : 'З'}автра повторный тест движения${r.s ? ' от специалиста ' + r.s : ''}. Это 2–4 минуты, результат сразу придет специалисту.\n\nОткрыть: ${origin}/`; }
export function clientDue(r, now = Date.now()) { return !!(r && r.chat && r.d && r.sentFor !== r.d && r.d > now && r.d - now <= 36 * 3600e3); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const origin0 = 'https://' + (req.headers.host || 'bodypassport.app');
    // вебхук бота: Telegram присылает секрет в заголовке (setWebhook ... secret_token=TG_WEBHOOK_SECRET)
    if (req.method === 'POST' && req.query.a === 'tg') {
      const sec = process.env.TG_WEBHOOK_SECRET; if (!sec || req.headers['x-telegram-bot-api-secret-token'] !== sec) return res.status(401).json({ error: 'secret' });
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
      const m = b && b.message, chat = m && m.chat && m.chat.id, text = String((m && m.text) || '').trim(); if (!chat) return res.status(200).json({ ok: true });
      const st = /^\/start\s+c_([a-z0-9]{20})$/.exec(text);
      if (st) { const r = await readJSON(cpath(st[1])); if (!r) { await tgSend(chat, 'Ссылка устарела. Откройте приложение и нажмите «Напомнить в Telegram» еще раз.'); return res.status(200).json({ ok: true }); }
        r.chat = chat; r.linked = Date.now(); await save(cpath(st[1]), r); await save(`remindc/chat/${chat}.json`, { code: st[1] }); await tgSend(chat, clientMessage(r, origin0, 'hello')); return res.status(200).json({ ok: true }); }
      if (text === '/stop') { const ix = await readJSON(`remindc/chat/${chat}.json`); if (ix) { await del(cpath(ix.code)).catch(() => {}); await del(`remindc/chat/${chat}.json`).catch(() => {}); }
        await tgSend(chat, 'Напоминания отключены. Включить снова можно в приложении.'); return res.status(200).json({ ok: true }); }
      if (text.startsWith('/start')) await tgSend(chat, `Это бот BodyPassport. Напоминания о повторном тесте включаются в приложении: ${origin0}/`);
      return res.status(200).json({ ok: true });
    }
    // приложение клиента: создать или обновить напоминание (без входа; код знает только телефон клиента)
    if (req.method === 'POST' && req.query.a === 'client') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const bot = process.env.TELEGRAM_BOT_USERNAME; if (!bot || !process.env.TG_WEBHOOK_SECRET) return res.status(503).json({ error: 'бот не настроен' });
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } b = b || {};
      const d = Number.isFinite(+b.d) && +b.d > Date.now() - 864e5 && +b.d < Date.now() + 400 * 864e5 ? +b.d : null;
      let code = CODE.test(String(b.code || '')) ? b.code : null, r = code ? await readJSON(cpath(code)) : null;
      if (!r) { code = Array.from(crypto.getRandomValues(new Uint8Array(20)), x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); r = { at: Date.now() }; }
      Object.assign(r, { n: clip(b.n, 30), s: clip(b.s, 60), d }); await save(cpath(code), r);
      return res.status(200).json({ code, bot: bot.replace(/^@/, ''), linked: !!r.chat });
    }
    if (req.method === 'GET' && req.query.a === 'cron') {
      const cs = process.env.CRON_SECRET; if (!cs || req.headers.authorization !== `Bearer ${cs}`) return res.status(401).json({ error: 'cron' });
      // клиентам: за день до ретеста
      { let cur2; const now = Date.now(); do { const r2 = await list({ prefix: 'remindc/', limit: 1000, cursor: cur2 }); cur2 = r2.hasMore ? r2.cursor : undefined;
          for (const bl of r2.blobs) { if (bl.pathname.startsWith('remindc/chat/')) continue;
            const r = await readJSON(bl.pathname); if (!clientDue(r, now)) continue; if (await tgSend(r.chat, clientMessage(r, origin0, 'due'))) { r.sentFor = r.d; await save(bl.pathname, r); } } } while (cur2); }
      const tok = process.env.TELEGRAM_BOT_TOKEN; let sent = 0, cursor;
      const origin = 'https://' + (req.headers.host || 'bodypassport.app');
      await loadApp(true);
      do { const r = await list({ prefix: 'remind/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        for (const b of r.blobs) { const uid = b.pathname.slice(7, -5); if (!/^t_\d+$/.test(uid) || !tok) continue;
          const owner = await loadUser(uid).catch(() => null); if (!owner || effectivePlan(owner).plan === 'start') continue; // напоминания в Telegram только PRO и пробный
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
