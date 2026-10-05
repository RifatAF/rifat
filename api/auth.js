// Быстрый вход: Google (Google Identity Services) и Telegram (виджет на сайте или Mini App внутри Telegram).
import crypto from 'node:crypto';
import { setSession, clearSession, sessionUid, loadUser, saveUser, deleteUser, allUsers, publicUser, isAdmin, effectivePlan } from './_session.js';

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_NAME = process.env.TELEGRAM_BOT_USERNAME || '';
const CONSENT_VERSION = '2026-10-beta';
const ROLES = ['client', 'specialist'];
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, n) : '';
const hex = (a, b) => { const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex'); return x.length === 32 && x.length === y.length && crypto.timingSafeEqual(x, y); };

async function verifyGoogle(credential) {
  if (!GOOGLE_ID || typeof credential !== 'string' || credential.length > 4096) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) return null; const t = await r.json();
  if (t.aud !== GOOGLE_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || +t.exp * 1000 < Date.now() || String(t.email_verified) !== 'true') return null;
  return { id: 'g_' + t.sub, provider: 'google', name: clip(t.name || t.email, 80), email: clip(t.email, 120), photo: clip(t.picture, 300) };
}

// виджет Telegram Login: secret = SHA256(токен бота)
function verifyTgWidget(d) {
  if (!TG_TOKEN || !d || typeof d !== 'object' || !d.hash || !d.id) return null;
  const fields = Object.keys(d).filter(k => k !== 'hash' && d[k] != null && ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'].includes(k)).sort();
  const dcs = fields.map(k => `${k}=${d[k]}`).join('\n');
  const h = crypto.createHmac('sha256', crypto.createHash('sha256').update(TG_TOKEN).digest()).update(dcs).digest('hex');
  if (!hex(h, d.hash) || Date.now() / 1000 - +d.auth_date > 86400) return null;
  return { id: 't_' + d.id, provider: 'telegram', name: clip([d.first_name, d.last_name].filter(Boolean).join(' ') || d.username, 80), username: clip(d.username, 40), photo: clip(d.photo_url, 300) };
}

// Mini App: secret = HMAC_SHA256("WebAppData", токен бота)
function verifyTgInitData(initData) {
  if (!TG_TOKEN || typeof initData !== 'string' || initData.length > 4096) return null;
  const p = new URLSearchParams(initData); const hash = p.get('hash'); if (!hash) return null; p.delete('hash');
  const dcs = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TG_TOKEN).digest();
  const h = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  if (!hex(h, hash) || Date.now() / 1000 - +p.get('auth_date') > 86400) return null;
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

async function signIn(req, res, ident) {
  if (!ident) return res.status(401).json({ error: 'не удалось подтвердить вход' });
  const b = req.body || {}; const old = await loadUser(ident.id);
  if (!old && b.consent !== true) return res.status(400).json({ error: 'нужно согласие на обработку данных' });
  const now = Date.now();
  const u = { ...(old || { created: now, consentAt: now, consentVersion: CONSENT_VERSION }), ...ident, lastLogin: now,
    role: (old && old.role) || (ROLES.includes(b.role) ? b.role : null), ref: (old && old.ref) || clip(b.ref, 40) || null };
  if (b.consent === true && (!old || old.consentVersion !== CONSENT_VERSION)) { u.consentAt = now; u.consentVersion = CONSENT_VERSION; }
  await saveUser(u); setSession(res, u.id);
  return res.status(200).json({ user: publicUser(u), created: !old });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = String(req.query.a || '');
  try {
    if (!process.env.SESSION_SECRET) return res.status(503).json({ error: 'вход не настроен' });
    if (req.method === 'GET' && a === 'config') return res.status(200).json({ google: GOOGLE_ID || null, telegram: TG_TOKEN && TG_NAME ? TG_NAME : null, telegramWeb: await widgetReady(String(req.headers.host || '').split(':')[0]), telegramId: TG_TOKEN ? TG_TOKEN.split(':')[0] : null });
    if (req.method === 'GET' && a === 'me') { const uid = sessionUid(req); const u = uid && await loadUser(uid); if (!u) { if (uid) clearSession(res); return res.status(401).json({ user: null }); } return res.status(200).json({ user: publicUser(u) }); }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    // защита от отправки формы с чужого сайта: запрос должен прийти с нашего адреса
    const origin = req.headers.origin; if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'origin' });
    const b = req.body || {};
    if (a === 'google') return signIn(req, res, await verifyGoogle(b.credential));
    if (a === 'telegram') return signIn(req, res, b.initData ? verifyTgInitData(b.initData) : verifyTgWidget(b.data));
    const uid = sessionUid(req); const u = uid && await loadUser(uid);
    if (!u) return res.status(401).json({ error: 'войдите заново' });
    if (a === 'role') { if (!ROLES.includes(b.role)) return res.status(400).json({ error: 'role' }); u.role = b.role; await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    if (a === 'profile') { const sp = ['kinesio', 'trainer', 'manual', 'sport', 'studio']; if (!sp.includes(b.specialty)) return res.status(400).json({ error: 'specialty' });
      u.specialty = b.specialty; await saveUser(u); return res.status(200).json({ user: publicUser(u) }); }
    // оплата в бете вручную: администратор продлевает тариф после оплаты через бота
    if (a === 'setplan') { if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      if (!/^[gt]_[A-Za-z0-9_.-]{1,80}$/.test(b.id || '') || !['start', 'pro', 'studio'].includes(b.plan)) return res.status(400).json({ error: 'bad' });
      const t = await loadUser(b.id); if (!t) return res.status(404).json({ error: 'нет такого пользователя' });
      const days = Math.max(0, Math.min(400, +b.days || 30)); t.plan = b.plan; t.planUntil = Math.max(Date.now(), t.planUntil || 0) + days * 864e5; if (b.plan === 'start') t.planUntil = 0;
      await saveUser(t); return res.status(200).json({ ok: true, plan: effectivePlan(t) }); }
    if (a === 'logout') { clearSession(res); return res.status(200).json({ ok: true }); }
    if (a === 'delete') { await deleteUser(u.id); clearSession(res); return res.status(200).json({ ok: true }); }
    if (a === 'users') { if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      const all = (await allUsers()).sort((x, y) => (y.created || 0) - (x.created || 0));
      return res.status(200).json({ users: all.map(x => ({ id: x.id, plan: effectivePlan(x).plan, paidUntil: x.planUntil || 0, name: x.name, provider: x.provider, email: x.email || null, username: x.username || null, role: x.role, specialty: x.specialty || null, created: x.created, lastLogin: x.lastLogin, ref: x.ref })) }); }
    return res.status(404).json({ error: 'action' });
  } catch (e) { console.error('auth', e); return res.status(500).json({ error: 'ошибка сервера' }); }
}
