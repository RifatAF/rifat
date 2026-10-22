// Быстрый вход: Google (Google Identity Services), Telegram (виджет на сайте или Mini App внутри Telegram) и код на почту (подходит всем, в том числе iPhone без Google).
import crypto from 'node:crypto';
import { setSession, clearSession, sessionUid, loadUser, saveUser, deleteUser, allUsers, publicUser, isAdmin, effectivePlan, CONSENT_VERSION, maxClientSlots, ensureRefIndex, loadApp, saveApp, APP, creditReferral, startTrialIfNeeded, trialActive, PRO_PRICE } from './_session.js';
const CLOUD_BACKUP = process.env.CLOUD_BACKUP === '1';

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_NAME = process.env.TELEGRAM_BOT_USERNAME || '';
const ROLES = ['client', 'specialist'];
// вход по коду на почту: письмо отправляет Resend (RESEND_API_KEY, отправитель MAIL_FROM с подтвержденным доменом)
const MAIL_KEY = process.env.RESEND_API_KEY || '', MAIL_FROM = process.env.MAIL_FROM || 'BodyPassport <onboarding@resend.dev>';
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, n) : '';
const hex = (a, b) => { const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex'); return x.length === 32 && x.length === y.length && crypto.timingSafeEqual(x, y); };

async function verifyGoogle(credential) {
  if (!GOOGLE_ID || typeof credential !== 'string' || credential.length > 4096) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) return null; const t = await r.json();
  if (t.aud !== GOOGLE_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || +t.exp * 1000 < Date.now() || String(t.email_verified) !== 'true') return null;
  return { id: 'g_' + t.sub, provider: 'google', name: clip(t.name || t.email, 80), givenName: clip(t.given_name, 60), familyName: clip(t.family_name, 60), email: clip(t.email, 120), photo: clip(t.picture, 300) };
}

// виджет Telegram Login: secret = SHA256(токен бота)
function verifyTgWidget(d) {
  if (!TG_TOKEN || !d || typeof d !== 'object' || !d.hash || !d.id) return null;
  const fields = Object.keys(d).filter(k => k !== 'hash' && d[k] != null && ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'].includes(k)).sort();
  const dcs = fields.map(k => `${k}=${d[k]}`).join('\n');
  const h = crypto.createHmac('sha256', crypto.createHash('sha256').update(TG_TOKEN).digest()).update(dcs).digest('hex');
  // без auth_date разница давала NaN, и проверка срока пропускала данные
  const age = Date.now() / 1000 - +d.auth_date; if (!hex(h, d.hash) || !Number.isFinite(age) || age > 86400) return null;
  return { id: 't_' + d.id, provider: 'telegram', name: clip([d.first_name, d.last_name].filter(Boolean).join(' ') || d.username, 80), username: clip(d.username, 40), photo: clip(d.photo_url, 300) };
}

// Mini App: secret = HMAC_SHA256("WebAppData", токен бота)
function verifyTgInitData(initData) {
  if (!TG_TOKEN || typeof initData !== 'string' || initData.length > 4096) return null;
  const p = new URLSearchParams(initData); const hash = p.get('hash'); if (!hash) return null; p.delete('hash');
  const dcs = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TG_TOKEN).digest();
  const h = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const age = Date.now() / 1000 - +p.get('auth_date'); if (!hex(h, hash) || !(p.get('auth_date') > 0) || !Number.isFinite(age) || age > 86400) return null;
  let u; try { u = JSON.parse(p.get('user') || 'null'); } catch (e) { return null; } if (!u || !u.id) return null;
  return { id: 't_' + u.id, provider: 'telegram', name: clip([u.first_name, u.last_name].filter(Boolean).join(' ') || u.username, 80), username: clip(u.username, 40), photo: clip(u.photo_url, 300) };
}

// виджет входа на сайте работает, только если в @BotFather боту назначен этот домен (/setdomain).
// Проверяем сами и показываем кнопку только когда домен принят: иначе человек увидит «Bot domain invalid» и застрянет.
const widgetCache = new Map();
async function widgetReady(host) {
  if (!TG_NAME || !TG_TOKEN || !/^[a-z0-9.-]+$/i.test(host || '')) return false;
  const c = widgetCache.get(host); if (c && Date.now() - c.t < 5 * 60e3) return c.ok;
  let ok = false;
  try { const r = await fetch(`https://oauth.telegram.org/embed/${TG_NAME}?origin=${encodeURIComponent('https://' + host)}&size=large`, { signal: AbortSignal.timeout(3000) });
    const t = await r.text(); ok = r.ok && !/domain invalid/i.test(t); } catch (e) { ok = false; }
  widgetCache.set(host, { ok, t: Date.now() }); return ok;
}

const codePath = e => `mailcode/${sha('mail:' + e)}.json`;
async function readJson(p) { try { const { get } = await import('./_store.js'); const r = await get(p, { access: 'private', useCache: false }); if (!r || !r.stream) return null;
  const ch = []; for await (const c of r.stream) ch.push(Buffer.from(c)); return JSON.parse(Buffer.concat(ch).toString('utf8')); } catch (e) { return null; } }
async function writeJson(p, o) { const { put } = await import('./_store.js'); await put(p, JSON.stringify(o), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }); }
/** Код на почту: 6 цифр, 10 минут, 5 попыток; не чаще раза в минуту и не больше 5 писем в час на адрес. */
async function sendMailCode(email, origin, extra = {}) {
  const e = String(email || '').trim().toLowerCase().slice(0, 120); if (!EMAIL.test(e)) return { status: 400, error: 'проверьте адрес почты' };
  if (!MAIL_KEY) return { status: 503, error: 'вход по почте пока не подключен' };
  const now = Date.now(), old = await readJson(codePath(e)), sent = ((old && old.sent) || []).filter(t => now - t < 3600e3);
  if (sent.length && now - sent.at(-1) < 60e3) return { status: 429, error: 'письмо уже отправлено, подождите минуту' };
  if (sent.length >= 5) return { status: 429, error: 'слишком много попыток, попробуйте через час' };
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  // в письме кнопка «Войти»: ссылка открывает приложение и входит сама, вводить код не нужно
  const link = `${origin}/?ml=${Buffer.from(e).toString('base64url')}.${code}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#13212B;max-width:480px">
    <p>Здравствуйте! Чтобы войти в BodyPassport, нажмите кнопку:</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#0E5A6B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold;display:inline-block">Войти в BodyPassport</a></p>
    <p style="color:#5A6872">Или введите код в приложении: <b style="font-size:20px;letter-spacing:3px;color:#13212B">${code}</b></p>
    <p style="color:#5A6872;font-size:13px">Кнопка и код действуют 10 минут. Если вы не входили, просто удалите это письмо.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + MAIL_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ from: MAIL_FROM, to: [e], subject: `Вход в BodyPassport: код ${code}`, html, text: `Войти в BodyPassport: ${link}\n\nИли введите код: ${code}\nДействует 10 минут.` }) }).catch(() => null);
  if (!r || !r.ok) return { status: 502, error: 'не удалось отправить письмо, попробуйте позже' };
  // согласия и роль запоминаем вместе с кодом: человек может открыть письмо в другом браузере
  await writeJson(codePath(e), { h: sha(process.env.SESSION_SECRET + ':' + e + ':' + code), exp: now + 600e3, tries: 0, sent: [...sent, now],
    consent: extra.consent === true && extra.health === true, role: ROLES.includes(extra.role) ? extra.role : null });
  return { status: 200 }; }
async function verifyMailCode(email, code) {
  const e = String(email || '').trim().toLowerCase().slice(0, 120); if (!EMAIL.test(e) || !/^\d{6}$/.test(String(code || ''))) return null;
  const rec = await readJson(codePath(e)); if (!rec || !rec.h || rec.exp < Date.now() || rec.tries >= 5) return null;
  if (rec.h !== sha(process.env.SESSION_SECRET + ':' + e + ':' + code)) { rec.tries++; await writeJson(codePath(e), rec); return null; }
  await writeJson(codePath(e), { sent: rec.sent || [] }); // код одноразовый
  return { ident: { id: 'e_' + sha('uid:' + e).slice(0, 24), provider: 'email', name: clip(e.split('@')[0], 80), email: clip(e, 120) }, consent: !!rec.consent, role: rec.role }; }

async function signIn(req, res, ident) {
  if (!ident) return res.status(401).json({ error: 'не удалось подтвердить вход' });
  const b = req.body || {}; const old = await loadUser(ident.id);
  // согласие на политику и отдельное согласие на данные о здоровье (152-ФЗ, ст. 10): у новых и при новой версии политики
  const fresh = b.consent === true && b.health === true;
  if ((!old || old.consentVersion !== CONSENT_VERSION) && !fresh) return res.status(400).json({ error: 'нужно согласие на обработку данных', consent: CONSENT_VERSION });
  const now = Date.now();
  const u = { ...(old || { created: now, consentAt: now, consentVersion: CONSENT_VERSION }), ...ident, lastLogin: now,
    role: (old && old.role) || (ROLES.includes(b.role) ? b.role : null), ref: old ? (old.ref || null) : (clip(b.ref, 40) || null) }; // приглашение засчитываем только новому аккаунту: старые пользователи по чужой ссылке не «приходят»
  if (fresh && (!old || old.consentVersion !== CONSENT_VERSION)) { u.consentAt = now; u.consentVersion = CONSENT_VERSION; u.healthConsentAt = now; }
  await ensureRefIndex(u); await creditReferral(u, !old).catch(e => console.error('ref', e));
  await saveUser(u); setSession(res, u.id);
  return res.status(200).json({ user: publicUser(u), created: !old });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = String(req.query.a || '');
  try {
    if (!process.env.SESSION_SECRET) return res.status(503).json({ error: 'вход не настроен' });
    await loadApp();
    if (req.method === 'GET' && a === 'config') return res.status(200).json({ beta: APP.beta, google: GOOGLE_ID || null, email: !!MAIL_KEY, telegram: TG_TOKEN && TG_NAME ? TG_NAME : null, telegramWeb: await widgetReady(String(req.headers.host || '').split(':')[0]), telegramId: TG_TOKEN ? TG_TOKEN.split(':')[0] : null, cloudBackup: CLOUD_BACKUP });
    if (req.method === 'GET' && a === 'me') { const uid = sessionUid(req); const u = uid && await loadUser(uid); if (!u) { if (uid) clearSession(res); return res.status(401).json({ user: null }); }
      if (!u.refCode && process.env.SESSION_SECRET) { await ensureRefIndex(u); await saveUser(u); } // код приглашения для тех, кто вошел до реферальной программы
      if (startTrialIfNeeded(u)) await saveUser(u);
      return res.status(200).json({ user: publicUser(u) }); }
    // резервная копия данных телефона в аккаунте: после удаления приложения тесты, анкета и занятия возвращаются при входе
    if (req.method === 'GET' && a === 'backup') { const uid = sessionUid(req); if (!uid) return res.status(401).json({ error: 'войдите' });
      const bk = await readJson(`backups/${uid}.json`); return res.status(200).json({ backup: bk || null }); }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    // защита от отправки формы с чужого сайта: запрос должен прийти с нашего адреса
    const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
    if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
    const b = req.body || {};
    if (a === 'google') return signIn(req, res, await verifyGoogle(b.credential));
    if (a === 'telegram') return signIn(req, res, b.initData ? verifyTgInitData(b.initData) : verifyTgWidget(b.data));
    if (a === 'mailcode') { const r = await sendMailCode(b.email, 'https://' + String(req.headers.host || 'bodypassport.vercel.app'), b); return res.status(r.status).json(r.status === 200 ? { ok: true } : { error: r.error }); }
    if (a === 'mail') { const v = await verifyMailCode(b.email, b.code); if (!v) return res.status(401).json({ error: 'неверный или просроченный код' });
      req.body = { ...b, ...(v.consent ? { consent: true, health: true } : {}), role: b.role || v.role }; return signIn(req, res, v.ident); }
    const uid = sessionUid(req); const u = uid && await loadUser(uid);
    if (!u) return res.status(401).json({ error: 'войдите заново' });
    // серверная копия за флагом (ТЗ v4, п. 5.3): по умолчанию данные клиентов не уходят с телефона
    if (a === 'backup' && !CLOUD_BACKUP) return res.status(403).json({ error: 'cloud backup off' });
    if (a === 'backup') { const d = b.data; if (!d || typeof d !== 'object' || Array.isArray(d)) return res.status(400).json({ error: 'data' });
      const raw = JSON.stringify(d); if (raw.length > 3.5e6) return res.status(413).json({ error: 'слишком большая копия' });
      await writeJson(`backups/${u.id}.json`, { at: Date.now(), v: 1, data: d }); return res.status(200).json({ ok: true, at: Date.now() }); }
    if (a === 'role') { if (!ROLES.includes(b.role)) return res.status(400).json({ error: 'role' }); u.role = b.role; startTrialIfNeeded(u); await ensureRefIndex(u); await creditReferral(u, false).catch(e => console.error('ref', e)); await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    if (a === 'profile') { const sp = ['kinesio', 'trainer', 'manual', 'sport', 'studio']; if (!sp.includes(b.specialty)) return res.status(400).json({ error: 'specialty' });
      u.specialty = b.specialty; await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    // оплата через lava.top: администратор включает Про после оплаты (вебхука пока нет)
    if (a === 'setplan') { if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      if (!/^[gte]_[A-Za-z0-9_.-]{1,80}$/.test(b.id || '') || !['start', 'pro', 'studio'].includes(b.plan)) return res.status(400).json({ error: 'bad' });
      const t = await loadUser(b.id); if (!t) return res.status(404).json({ error: 'нет такого пользователя' });
      const days = Number.isFinite(+b.days) && b.days !== '' && b.days != null ? Math.max(0, Math.min(400, +b.days)) : 30; t.plan = b.plan; t.planUntil = Math.max(Date.now(), t.planUntil || 0) + days * 864e5; if (b.plan === 'start') t.planUntil = 0;
      await saveUser(t); return res.status(200).json({ ok: true, plan: effectivePlan(t) }); }
    // почта, с которой специалист оплатит PRO на lava.top: по ней уведомление об оплате найдет аккаунт
    if (a === 'payemail') { const e = String(b.email || '').trim().toLowerCase().slice(0, 120);
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e)) return res.status(400).json({ error: 'проверьте почту' });
      u.payEmail = e; await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    // переключатель режима: бета или полный (только администратор)
    if (a === 'appmode') { if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' }); await saveApp(b.beta !== false); return res.status(200).json({ beta: APP.beta }); }
    // первый ретест клиента завершает пробный PRO (момент, когда специалист увидел «до/после»)
    if (a === 'trialend') { if (trialActive(u)) { u.trialEndedBy = 'retest'; u.trialEndedAt = Date.now(); await saveUser(u); } return res.status(200).json({ user: publicUser(u) }); }
    if (a === 'trialseen') { u.trialEndSeen = true; await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    // баланс за коллег тратится только на свой PRO: 899 ₽ = 31 день
    if (a === 'paybalance') { if ((u.balance || 0) < PRO_PRICE) return res.status(400).json({ error: 'на балансе меньше ' + PRO_PRICE + ' ₽' });
      u.balance -= PRO_PRICE; u.plan = 'pro'; u.planUntil = Math.max(Date.now(), u.planUntil || 0) + 31 * 864e5; u.paidEver = true;
      u.balanceLog = [...(u.balanceLog || []), { t: Date.now(), a: -PRO_PRICE, k: 'pro' }].slice(-100); await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    if (a === 'logout') { clearSession(res); return res.status(200).json({ ok: true }); }
    if (a === 'delete') { // аккаунт, расписание напоминаний и ящики с результатами клиентов
      const { purgeOwner } = await import('./relay.js'); const { del } = await import('./_store.js');
      await purgeOwner(u.id).catch(e => console.error('purge', e)); await del(`remind/${u.id}.json`).catch(() => {}); await del(`backups/${u.id}.json`).catch(() => {});
      await deleteUser(u.id); clearSession(res); return res.status(200).json({ ok: true }); }
    if (a === 'users') { if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      const all = (await allUsers()).sort((x, y) => (y.created || 0) - (x.created || 0));
      return res.status(200).json({ users: all.map(x => ({ id: x.id, plan: effectivePlan(x).plan, paidUntil: x.planUntil || 0, name: x.name, provider: x.provider, email: x.email || null, username: x.username || null, role: x.role, specialty: x.specialty || null, created: x.created, lastLogin: x.lastLogin, ref: x.ref, invited: x.invited || 0, invitedPro: x.invitedPro || 0, slots: maxClientSlots(x) })) }); }
    return res.status(404).json({ error: 'action' });
  } catch (e) { console.error('auth', e); return res.status(500).json({ error: 'ошибка сервера' }); }
}
