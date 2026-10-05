// Сессия в подписанной cookie (HMAC-SHA256). Сервер не хранит сессии, только профили пользователей в приватном Blob.
import crypto from 'node:crypto';
import { put, get, del, list } from '@vercel/blob';

const SECRET = process.env.SESSION_SECRET || '';
const COOKIE = 'bp_s';
const DAYS = 30;

const b64u = b => Buffer.from(b).toString('base64url');
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

export function setSession(res, uid) {
  const body = b64u(JSON.stringify({ uid, exp: Date.now() + DAYS * 864e5 }));
  res.setHeader('Set-Cookie', `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}
export function clearSession(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); }

export function sessionUid(req) {
  if (!SECRET) return null;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)bp_s=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const s = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); return s.exp > Date.now() && /^[gt]_[A-Za-z0-9_.-]{1,80}$/.test(s.uid) ? s.uid : null; } catch (e) { return null; }
}

async function readStream(st) { const ch = []; for await (const c of st) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }
const path = uid => `users/${uid}.json`;
export async function loadUser(uid) {
  try { const r = await get(path(uid), { access: 'private', useCache: false }); return r && r.stream ? JSON.parse(await readStream(r.stream)) : null; } catch (e) { return null; }
}
export async function saveUser(u) {
  await put(path(u.id), JSON.stringify(u), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return u;
}
export async function deleteUser(uid) { await del(path(uid)); }
export async function allUsers() {
  const out = []; let cursor;
  do { const r = await list({ prefix: 'users/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
    const got = await Promise.all(r.blobs.map(b => get(b.pathname, { access: 'private', useCache: false }).then(x => x && x.stream ? readStream(x.stream) : null).catch(() => null)));
    for (const s of got) { try { if (s) out.push(JSON.parse(s)); } catch (e) {} } } while (cursor);
  return out;
}

// администраторы беты: id пользователей через запятую (t_<telegram id>, g_<google sub>) или email Google
export function isAdmin(u) {
  const list = String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return !!u && (list.includes(String(u.id).toLowerCase()) || (!!u.email && list.includes(String(u.email).toLowerCase())));
}
// тариф: оплаченный, пока не истек; в бете все специалисты получают Про бесплатно до BETA_PRO_UNTIL
const BETA_UNTIL = Date.parse(process.env.BETA_PRO_UNTIL || '2026-12-31T23:59:59Z');
export function effectivePlan(u) {
  if (!u) return { plan: 'start', until: null, beta: false };
  if (['pro', 'studio'].includes(u.plan) && (u.planUntil || 0) > Date.now()) return { plan: u.plan, until: u.planUntil, beta: false };
  if (u.role === 'specialist' && Date.now() < BETA_UNTIL) return { plan: 'pro', until: BETA_UNTIL, beta: true };
  return { plan: 'start', until: null, beta: false };
}
export const publicUser = u => { if (!u) return u; const p = effectivePlan(u);
  return { id: u.id, provider: u.provider, name: u.name, email: u.email || null, photo: u.photo || null, role: u.role || null, specialty: u.specialty || null, admin: isAdmin(u), plan: p.plan, planUntil: p.until, planBeta: p.beta }; };

export async function currentUser(req) { const uid = sessionUid(req); return uid ? loadUser(uid) : null; }
