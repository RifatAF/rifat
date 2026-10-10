// Оплата PRO через lava.top: уведомления (вебхуки) включают и продлевают PRO сами.
// Кабинет lava.top → API → вебхуки: адрес https://<сайт>/api/lava, аутентификация Basic.
// Логин и пароль те же, что в переменной LAVA_WEBHOOK_BASIC (вида login:password) в настройках Vercel.
// Кого продлевать: по договору (повторные списания приходят с parentContractId первого платежа),
// иначе по почте покупателя: почта входа Google или «почта для оплаты», которую специалист указал в приложении.
// Не нашли человека: платеж лежит в lava/unmatched, администратору приходит сообщение в Telegram.
import crypto from 'node:crypto';
import { put, get } from '@vercel/blob';
import { loadUser, saveUser, allUsers } from './_session.js';

const PRO_DAYS = 31;
const SUCCESS = /(^|\.)payment\.success$/; // payment.success и subscription.recurring.payment.success
const REVOKE = /refund|chargeback/i;
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }
const J = { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true };
async function getJ(p) { try { const r = await get(p, { access: 'private', useCache: false }); return r && r.stream ? JSON.parse(await readAll(r.stream)) : null; } catch (e) { return null; } }
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const safe = s => String(s || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80);

/** Проверка, что уведомление прислал lava.top: Basic login:password или ключ в заголовке X-Api-Key. */
export function authorized(req) {
  const basic = process.env.LAVA_WEBHOOK_BASIC || '', key = process.env.LAVA_WEBHOOK_KEY || '';
  const h = String(req.headers.authorization || '');
  if (basic && /^Basic /i.test(h)) { let dec = ''; try { dec = Buffer.from(h.slice(6).trim(), 'base64').toString('utf8'); } catch (e) {} if (eq(dec, basic)) return true; }
  const k = req.headers['x-api-key'];
  if (key && k && eq(k, key)) return true;
  return false;
}
async function tg(chat, text) {
  const tok = process.env.TELEGRAM_BOT_TOKEN; if (!tok || !chat) return;
  await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(4000),
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) }).catch(() => {});
}
const admins = () => String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(x => /^t_\d+$/.test(x)).map(x => x.slice(2));
async function byEmail(email) {
  if (!email) return null;
  const all = await allUsers();
  return all.find(u => u.role === 'specialist' && (String(u.payEmail || '').toLowerCase() === email)) || all.find(u => String(u.email || '').toLowerCase() === email) || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.LAVA_WEBHOOK_BASIC && !process.env.LAVA_WEBHOOK_KEY) return res.status(503).json({ error: 'not configured' });
  if (!authorized(req)) return res.status(401).json({ error: 'auth' });
  try {
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { return res.status(400).json({ error: 'bad body' }); } }
    if (!b || typeof b !== 'object') return res.status(400).json({ error: 'bad body' });
    const ev = String(b.eventType || ''), cid = safe(b.contractId), parent = safe(b.parentContractId) || cid;
    const email = String((b.buyer && b.buyer.email) || b.email || '').trim().toLowerCase().slice(0, 120);
    const pid = process.env.LAVA_PRODUCT_ID; if (pid && b.product && b.product.id && b.product.id !== pid) return res.status(200).json({ ok: true, skip: 'product' });
    // журнал без платежных данных: что пришло и чем кончилось
    const note = { t: Date.now(), ev, cid, parent, status: String(b.status || '').slice(0, 40), amount: b.amount, currency: String(b.currency || '').slice(0, 8) };
    if (SUCCESS.test(ev)) {
      if (!cid) return res.status(400).json({ error: 'no contract' });
      if (await getJ(`lava/done/${cid}.json`)) return res.status(200).json({ ok: true, dup: true }); // повтор того же уведомления
      const link = parent && await getJ(`lava/contracts/${parent}.json`);
      let u = link && link.uid ? await loadUser(link.uid) : null; if (!u) u = await byEmail(email);
      if (!u) { await put(`lava/unmatched/${cid}.json`, JSON.stringify({ ...note, email }), J);
        for (const a of admins()) await tg(a, `BodyPassport: оплата PRO (${ev}) не привязалась к аккаунту. Почта покупателя: ${email || 'нет'}, договор ${cid}. Включите вручную в «Участники беты».`);
        return res.status(200).json({ ok: true, matched: false }); }
      u.plan = 'pro'; u.planUntil = Math.max(Date.now(), u.planUntil || 0) + PRO_DAYS * 864e5; u.lavaContract = parent; u.paidVia = 'lava';
      await saveUser(u);
      await put(`lava/contracts/${parent}.json`, JSON.stringify({ uid: u.id, t: Date.now() }), J);
      await put(`lava/done/${cid}.json`, JSON.stringify({ ...note, uid: u.id }), J);
      if (/^t_\d+$/.test(u.id)) await tg(u.id.slice(2), `BodyPassport: PRO включен до ${new Date(u.planUntil).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}. Спасибо!`);
      return res.status(200).json({ ok: true, uid: u.id, until: u.planUntil });
    }
    if (REVOKE.test(ev)) {
      const link = parent && await getJ(`lava/contracts/${parent}.json`); const u = link && link.uid ? await loadUser(link.uid) : await byEmail(email);
      if (u) { u.planUntil = Math.min(u.planUntil || 0, Date.now()); await saveUser(u); }
      for (const a of admins()) await tg(a, `BodyPassport: возврат или чарджбэк по PRO (${ev}), договор ${cid || parent}. ${u ? 'PRO выключен: ' + u.id : 'Аккаунт не найден.'}`);
      return res.status(200).json({ ok: true, revoked: !!u });
    }
    // отмена подписки и неуспешные списания: PRO сам истечет в конце оплаченного месяца
    await put(`lava/events/${Date.now()}-${cid || 'x'}.json`, JSON.stringify(note), J);
    return res.status(200).json({ ok: true, ignored: ev });
  } catch (e) { console.error('lava', e); return res.status(500).json({ error: 'server' }); }
}
