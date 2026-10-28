// Отзывы из приложения: оценка (1–5 после теста или 0–10 «порекомендуете ли»), текст, где оставлен.
// Имя и контакт сохраняются, только если человек сам отметил «можно со мной связаться».
// Список видит только администратор беты: GET /api/feedback?days=90; анкета специалистов таблицей: GET /api/feedback?k=pro&format=csv.
import { put, list, get } from './_store.js';
import { currentUser, isAdmin, allUsers, noStats } from './_session.js';

const KINDS = { result: [1, 5], nps: [0, 10], free: [0, 5], bug: [0, 0], exit: [1, 5], test: [1, 5], pro: [1, 10] };
const PLACES = new Set(['map', 'result', 'home', 'menu', 'settings', 'done', 'any', 'exit', 'return', 'logout', 'banner', 'test', 'calib']);
// анкета беты при выходе: удалось ли, что мешало
const GOALS = ['yes', 'partly', 'no'];
// анкета специалиста (BP-17): польза 1–10, будет ли использовать с клиентами (обязательно), остальное по желанию
const USE = ['yes', 'no', 'maybe'], USE_RU = { yes: 'да', no: 'нет', maybe: 'может быть' };
const PRO_Q = ['clear', 'why', 'missing', 'pay'];
// диагностика к сообщению о проблеме: устройство, браузер, последние нажатия (только id кнопок) и ошибки, без имен и данных клиентов
function diag(d) { if (!d || typeof d !== 'object') return null; const o = {};
  for (const k of ['os', 'br', 'ua', 'scr', 'net', 'role', 'path', 'model', 'deleg', 'screen', 'storage']) if (d[k] != null) o[k] = clip(String(d[k]), 200);
  for (const k of ['mem', 'cpu', 'sec', 'fps', 'loadSec', 'quota']) if (Number.isFinite(+d[k])) o[k] = +d[k];
  if (typeof d.pwa === 'boolean') o.pwa = d.pwa; if (typeof d.persisted === 'boolean') o.persisted = d.persisted;
  for (const k of ['trail', 'errors']) if (Array.isArray(d[k])) o[k] = d[k].slice(-40).map(x => clip(String(x), 200));
  return o; }
const clip = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').trim().slice(0, n) : '';
// жалоба сразу приходит администраторам в Telegram (ADMIN_IDS вида t_<id>), чтобы не ждать сводки
const proText = fb => `Анкета специалиста${fb.name ? ' (' + fb.name + ')' : ''}: польза ${fb.s ?? '—'}/10, с клиентами: ${USE_RU[fb.q.use]}` +
  [['why', 'Почему'], ['clear', 'Понятно / нет'], ['missing', 'Не хватило'], ['pay', 'Оплата']].map(([k, t]) => fb.q[k] ? `\n${t}: ${fb.q[k]}` : '').join('');
async function notify(fb) { const tok = process.env.TELEGRAM_BOT_TOKEN; if (!tok) return;
  const ids = String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(x => /^t_\d+$/.test(x)).map(x => x.slice(2));
  const d = fb.d || {}, text = fb.k === 'pro' ? proText(fb) : `Проблема (${fb.r}): ${fb.t}\n${d.os || ''} · ${d.br || ''} · ${d.scr || ''}${d.pwa ? ' · PWA' : ''}${d.fps ? ' · ' + d.fps + ' fps' : ''}${d.model ? ' · ' + d.model : ''}\n` +
    (d.errors && d.errors.length ? 'Ошибки: ' + d.errors.slice(-2).join(' | ') + '\n' : '') + (fb.contact ? 'Контакт: ' + fb.contact.handle : 'без контакта');
  await Promise.all(ids.map(id => fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: id, text: text.slice(0, 3500), disable_web_page_preview: true }), signal: AbortSignal.timeout(4000) }).catch(() => {}))); }
// выгрузка для Excel: точка с запятой и BOM, чтобы кириллица и столбцы открывались без настройки; формулы в ответах гасятся апострофом
const cell = v => { let t = String(v ?? '').replace(/\r?\n/g, ' '); if (/^[=+\-@]/.test(t)) t = "'" + t; return /[";]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
function sendCsv(res, items) {
  const head = ['Дата', 'ID пользователя', 'Имя', 'Роль', 'Польза 1–10', 'Будет использовать', 'Почему', 'Понятно / непонятно', 'Чего не хватило', 'Готов платить', 'Где', 'Версия'];
  const rows = items.map(x => { const q = x.q || {}; return [new Date(x.at).toISOString().replace('T', ' ').slice(0, 16), x.uid || '', x.name || '', x.r, x.s ?? '', USE_RU[q.use] || '', q.why, q.clear, q.missing, q.pay, x.w, x.v]; });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="bodypassport-pro-feedback-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(200); res.end('\ufeff' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n'));
}
async function readAll(stream) { const ch = []; for await (const c of stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString('utf8'); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const origin = req.headers.origin; let oh = null; try { oh = origin ? new URL(origin).host : null; } catch (e) { oh = '?'; }
      if (origin && oh !== req.headers.host) return res.status(403).json({ error: 'origin' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (raw.length > 16000) return res.status(413).json({ error: 'too large' });
      let b; try { b = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
      const range = KINDS[b && b.k]; if (!range) return res.status(400).json({ error: 'kind' });
      const score = b.s == null || b.s === '' ? null : Math.round(+b.s);
      if (score != null && !(score >= range[0] && score <= range[1])) return res.status(400).json({ error: 'score' });
      const text = clip(b.t, 2000);
      if (score == null && !text && b.k !== 'pro') return res.status(400).json({ error: 'empty' });
      const fb = { at: Date.now(), k: b.k, s: score, t: text, w: PLACES.has(b.w) ? b.w : 'menu', r: b.r === 'pro' ? 'pro' : 'client', v: clip(b.v, 20) };
      if (b.k === 'bug') { if (!text) return res.status(400).json({ error: 'empty' }); fb.d = diag(b.d); }
      if (b.k === 'exit' && b.q && typeof b.q === 'object') fb.q = { goal: GOALS.includes(b.q.goal) ? b.q.goal : null, issues: Array.isArray(b.q.issues) ? b.q.issues.slice(0, 8).map(x => clip(String(x), 40)).filter(Boolean) : [], sec: Number.isFinite(+b.q.sec) ? Math.max(0, Math.min(86400, Math.round(+b.q.sec))) : null };
      // анкета после теста: что мешало, был ли это тест калибровки, откуда пришел человек
      if (b.k === 'test' && b.q && typeof b.q === 'object') fb.q = { issues: Array.isArray(b.q.issues) ? b.q.issues.slice(0, 10).map(x => clip(String(x), 40)).filter(Boolean) : [], cal: b.q.cal === true, src: clip(String(b.q.src || ''), 24), steps: Number.isFinite(+b.q.steps) ? Math.max(0, Math.min(20, Math.round(+b.q.steps))) : null };
      if (b.k === 'pro') { const q = b.q && typeof b.q === 'object' ? b.q : {}; if (!USE.includes(q.use)) return res.status(400).json({ error: 'use' });
        fb.q = { use: q.use }; for (const k of PRO_Q) fb.q[k] = clip(q[k], 2000);
        const u = await currentUser(req).catch(() => null); fb.uid = u ? clip(String(u.id), 80) : null; fb.name = u ? clip(u.name, 80) : ''; }
      if (b.contact === true) { const u = await currentUser(req).catch(() => null);
        fb.contact = { name: u ? clip(u.name, 80) : '', handle: u ? (u.username ? '@' + clip(u.username, 40) : clip(u.email, 120)) : '', note: clip(b.c, 120) }; }
      const day = new Date(fb.at).toISOString().slice(0, 10);
      if (fb.k === 'bug' || fb.k === 'pro') await notify(fb).catch(() => {});
      await put(`feedback/${day}/${fb.at}-${Math.random().toString(36).slice(2, 8)}.json`, JSON.stringify(fb), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
      const days = Math.max(1, Math.min(365, +req.query.days || 90)), edge = Date.now() - days * 864e5, names = []; let cursor;
      do { const r = await list({ prefix: 'feedback/', limit: 1000, cursor }); cursor = r.hasMore ? r.cursor : undefined;
        names.push(...r.blobs.filter(x => new Date(x.uploadedAt).getTime() >= edge).map(x => x.pathname)); } while (cursor);
      const items = [];
      for (let i = 0; i < names.length; i += 10) await Promise.all(names.slice(i, i + 10).map(async n => {
        try { const r = await get(n, { access: 'private', useCache: false }); items.push(JSON.parse(await readAll(r.stream))); } catch (e) {} }));
      // отзывы аккаунтов владельца и тестовых не считаем (noStats в _session.js)
      const skip = new Set((await allUsers().catch(() => [])).filter(noStats).map(x => x.id));
      for (let i = items.length - 1; i >= 0; i--) if (items[i].uid && skip.has(items[i].uid)) items.splice(i, 1);
      items.sort((x, y) => y.at - x.at);
      if (req.query.format === 'csv') return sendCsv(res, items.filter(x => x.k === (req.query.k || 'pro')));
      const nps = items.filter(x => x.k === 'nps' && x.s != null), res5 = items.filter(x => x.k === 'result' && x.s != null);
      const npsScore = nps.length ? Math.round((nps.filter(x => x.s >= 9).length - nps.filter(x => x.s <= 6).length) / nps.length * 100) : null;
      const avg = res5.length ? Math.round(res5.reduce((a, x) => a + x.s, 0) / res5.length * 10) / 10 : null;
      const ex = items.filter(x => x.k === 'exit' && x.s != null), exAvg = ex.length ? Math.round(ex.reduce((a, x) => a + x.s, 0) / ex.length * 10) / 10 : null;
      const issues = {}; for (const x of ex) for (const i of (x.q && x.q.issues) || []) issues[i] = (issues[i] || 0) + 1;
      const goals = { yes: 0, partly: 0, no: 0 }; for (const x of ex) if (x.q && goals[x.q.goal] != null) goals[x.q.goal]++;
      const ts = items.filter(x => x.k === 'test' && x.s != null), testAvg = ts.length ? Math.round(ts.reduce((a, x) => a + x.s, 0) / ts.length * 10) / 10 : null;
      const testIssues = {}; for (const x of ts) for (const i of (x.q && x.q.issues) || []) testIssues[i] = (testIssues[i] || 0) + 1;
      const pro = items.filter(x => x.k === 'pro'), proS = pro.filter(x => x.s != null), proUse = { yes: 0, no: 0, maybe: 0 }; for (const x of pro) if (x.q && proUse[x.q.use] != null) proUse[x.q.use]++;
      const proAvg = proS.length ? Math.round(proS.reduce((a, x) => a + x.s, 0) / proS.length * 10) / 10 : null;
      return res.status(200).json({ proN: pro.length, proAvg, proUse, testAvg, testN: ts.length, testIssues, items: items.slice(0, 300), nps: npsScore, npsN: nps.length, resultAvg: avg, resultN: res5.length, exitAvg: exAvg, exitN: ex.length, exitIssues: issues, exitGoals: goals });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) { console.error('feedback', e); return res.status(500).json({ error: 'server' }); }
}
