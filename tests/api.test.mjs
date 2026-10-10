// Проверка серверной части без сети: хранилище Vercel Blob подменено словарем в памяти.
// Запуск: npm test (нужен Node 22+).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const R = new URL('../api/', import.meta.url).href;
process.env.SESSION_SECRET = 'test-secret'; process.env.CRON_SECRET = 'cron'; process.env.ADMIN_IDS = 't_1';
const store = new Map();
mock.module('@vercel/blob', { namedExports: {
  put: async (name, body) => { store.set(name, { body: String(body), uploadedAt: new Date().toISOString() }); return {}; },
  get: async name => { const b = store.get(name); if (!b) throw new Error('nf'); return { stream: (async function* () { yield Buffer.from(b.body); })() }; },
  del: async x => { for (const n of [].concat(x)) store.delete(n); },
  list: async ({ prefix, limit = 1000 }) => ({ blobs: [...store].filter(([k]) => k.startsWith(prefix)).slice(0, limit).map(([k, v]) => ({ pathname: k, url: k, uploadedAt: v.uploadedAt })), hasMore: false }),
} });
const relay = (await import(R + 'relay.js')).default, ev = (await import(R + 'ev.js')).default, auth = (await import(R + 'auth.js')).default, cron = (await import(R + 'cron.js')).default;
const cookie = uid => { const b = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 1e7 })).toString('base64url'); return `bp_s=${b}.${crypto.createHmac('sha256', 'test-secret').update(b).digest('base64url')}`; };
function call(h, { method = 'GET', query = {}, body, headers = {} } = {}) {
  return new Promise(ok => { const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, j }); }, end() { ok({ code: this.code }); } };
    Promise.resolve(h({ method, query, body, headers: { host: 'x.app', ...headers } }, res)); });
}
const user = (id, role) => store.set(`users/${id}.json`, { body: JSON.stringify({ id, role, name: 'N', consentVersion: '2026-10-v2' }), uploadedAt: new Date().toISOString() });
const env = JSON.stringify({ v: 1, iv: 'a', ct: 'b' });

test('relay: подписанный ящик, владелец, чужой специалист', async () => {
  user('t_1', 'specialist'); user('t_2', 'specialist'); user('t_3', 'client');
  assert.equal((await call(relay, { method: 'POST', query: { a: 'new' }, headers: { cookie: cookie('t_3') } })).code, 401, 'клиент не создает ящик');
  const r = await call(relay, { method: 'POST', query: { a: 'new' }, headers: { cookie: cookie('t_1') } }); assert.equal(r.code, 200); const id = r.j.id; assert.equal(id.length, 46);
  assert.equal((await call(relay, { method: 'POST', query: { id }, body: env })).code, 200, 'клиент без входа отправляет в подписанный');


  const own = await call(relay, { query: { ids: id }, headers: { cookie: cookie('t_1') } }); assert.equal(own.j[id].length, 1, 'владелец видит');
  const other = await call(relay, { query: { ids: id }, headers: { cookie: cookie('t_2') } }); assert.equal(other.j[id], undefined, 'чужой не видит');
  const p = own.j[id][0].p;
  assert.equal((await call(relay, { method: 'DELETE', query: { p }, headers: { cookie: cookie('t_2') } })).code, 403, 'чужой не удаляет');
  assert.equal((await call(relay, { method: 'DELETE', query: { p }, headers: { cookie: cookie('t_1') } })).code, 200, 'владелец удаляет');
  for (let i = 0; i < 20; i++) await call(relay, { method: 'POST', query: { id }, body: env });
  assert.equal((await call(relay, { method: 'POST', query: { id }, body: env })).code, 429, 'лимит 20 на ящик');
  assert.equal((await call(relay, { method: 'POST', query: { id }, body: '{"x":1}' })).code, 400, 'только конверт');

});
test('relay: лимит новых ящиков в сутки', async () => {
  user('t_5', 'specialist'); let last;
  for (let i = 0; i < 31; i++) last = await call(relay, { method: 'POST', query: { a: 'new' }, headers: { cookie: cookie('t_5') } });
  assert.equal(last.code, 429);
});
test('cron: без секрета 401, со старыми файлами удаляет', async () => {
  assert.equal((await call(cron, {})).code, 401);
  store.set('relay/old/1.json', { body: env, uploadedAt: new Date(Date.now() - 40 * 864e5).toISOString() });
  const r = await call(cron, { headers: { authorization: 'Bearer cron' } }); assert.equal(r.code, 200); assert.ok(r.j.deleted >= 1); assert.ok(!store.has('relay/old/1.json'));
});
test('ev: принимает обезличенные события, отбрасывает лишнее, сводка только админу', async () => {
  assert.equal((await call(ev, { method: 'POST', body: JSON.stringify({ s: 'abc123', r: 'client', ev: [{ e: 'app_open', t: 1 }, { e: 'hack', t: 2 }, { e: 'err', t: 3, p: { m: 'x', email: 'a@b' } }] }) })).code, 204);
  assert.equal((await call(ev, { method: 'POST', body: JSON.stringify({ s: 'abc123', ev: [{ e: 'nope' }] }) })).code, 400);
  assert.equal((await call(ev, { method: 'POST', body: 'x'.repeat(9000) })).code, 413);
  assert.equal((await call(ev, { method: 'POST', body: '{}', headers: { origin: 'https://evil.com' } })).code, 403);
  const saved = [...store].find(([k]) => k.startsWith('ev/')); const b = JSON.parse(saved[1].body);
  assert.deepEqual(b.ev.map(x => x.e), ['app_open', 'err']); assert.equal(b.ev[1].p.email, undefined, 'неизвестные ключи отброшены');
  assert.equal((await call(ev, { query: { a: 'stats' }, headers: { cookie: cookie('t_2') } })).code, 403);
  const s = await call(ev, { query: { a: 'stats', days: 1 }, headers: { cookie: cookie('t_1') } }); assert.equal(s.code, 200); assert.equal(Object.values(s.j.events['client:app_open'])[0], 1);
});
test('auth: без второго согласия новый вход запрещен; в config нет бесплатного периода', async () => {
  const c = await call(auth, { query: { a: 'config' } }); assert.equal(c.j.betaUntil, undefined);
  const me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_1') } }); assert.equal(me.j.user.consentOk, true);
  store.set('users/t_9.json', { body: JSON.stringify({ id: 't_9', role: 'client', consentVersion: '2026-10-beta' }), uploadedAt: '' });
  const me9 = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_9') } }); assert.equal(me9.j.user.consentOk, false, 'старая версия согласия');
});

const fb = (await import(R + 'feedback.js')).default;
test('feedback: проверка оценки, контакт только по согласию, список только админу', async () => {
  assert.equal((await call(fb, { method: 'POST', body: JSON.stringify({ k: 'result', s: 9 }) })).code, 400, 'оценка вне 1–5');
  assert.equal((await call(fb, { method: 'POST', body: JSON.stringify({ k: 'free' }) })).code, 400, 'пустой');
  assert.equal((await call(fb, { method: 'POST', body: JSON.stringify({ k: 'nps', s: 10, t: 'Супер <b>' }) })).code, 200);
  assert.equal((await call(fb, { method: 'POST', body: JSON.stringify({ k: 'result', s: 4, contact: true }), headers: { cookie: cookie('t_2') } })).code, 200);
  assert.equal((await call(fb, { method: 'POST', body: JSON.stringify({ k: 'nps', s: 3 }) })).code, 200);
  assert.equal((await call(fb, { headers: { cookie: cookie('t_2') } })).code, 403);
  const l = await call(fb, { headers: { cookie: cookie('t_1') } });
  assert.equal(l.j.items.length, 3); assert.equal(l.j.nps, 0, '1 промоутер и 1 критик'); assert.equal(l.j.resultAvg, 4);
  assert.ok(!l.j.items.find(x => x.k === 'nps' && x.s === 10).contact, 'без согласия контакта нет');
  assert.equal(l.j.items.find(x => x.k === 'nps' && x.s === 10).t, 'Супер b', 'угловые скобки вырезаны');
  assert.ok(l.j.items.find(x => x.k === 'result').contact.name, 'с согласием контакт есть');
});
test('рефералы: код, засчет нового специалиста один раз, +3 слота, не за себя', async () => {
  const s = await import(R + '_session.js');
  const owner = { id: 't_100', role: 'specialist', name: 'A', consentVersion: '2026-10-v2' }; await s.ensureRefIndex(owner); await s.saveUser(owner);
  assert.match(owner.refCode, /^r[0-9a-f]{8}$/);
  const newbie = { id: 't_101', role: 'specialist', ref: owner.refCode };
  await s.creditReferral(newbie, true); await s.creditReferral(newbie, false);
  let o = await s.loadUser('t_100'); assert.equal(o.invited, 1); assert.equal(o.invitedPro, 1, 'засчитан один раз');
  const client = { id: 't_102', role: 'client', ref: owner.refCode }; await s.creditReferral(client, true);
  o = await s.loadUser('t_100'); assert.equal(o.invited, 2); assert.equal(o.invitedPro, 1, 'клиент не дает бонуса');
  client.role = 'specialist'; await s.creditReferral(client, false);
  o = await s.loadUser('t_100'); assert.equal(o.invitedPro, 2, 'стал специалистом позже');
  const self = { id: 't_100', role: 'specialist', ref: owner.refCode, refCode: owner.refCode }; await s.creditReferral(self, true);
  o = await s.loadUser('t_100'); assert.equal(o.invited, 2, 'не за себя');
  assert.equal(s.maxClientSlots(o), 11, '5 + 3 × 2 коллеги');
  assert.equal(s.effectivePlan(o).plan, 'start', 'приглашения не дают Про, только слоты');
});
test('слоты: Free 5 навсегда, +3 за коллегу, без бесплатного периода', async () => {
  const s = await import(R + '_session.js');
  assert.equal(s.maxClientSlots(null), 5); assert.equal(s.maxClientSlots({}), 5); assert.equal(s.maxClientSlots({ invitedPro: 1 }), 8); assert.equal(s.maxClientSlots({ invitedPro: -4 }), 5);
  assert.equal(s.effectivePlan({ role: 'specialist', created: Date.now() }).plan, 'start', 'новый специалист сразу на Free');
  assert.equal(s.isPro({ plan: 'pro', planUntil: Date.now() + 1e6 }), true);
  assert.equal(s.isPro({ plan: 'pro', planUntil: Date.now() - 1 }), false, 'истекший Про');
});
test('регистрация по ?ref: у пригласившего maxClientSlots +3 в /me', async () => {
  const s = await import(R + '_session.js');
  const owner = { id: 't_200', role: 'specialist', name: 'O', consentVersion: '2026-10-v2' }; await s.ensureRefIndex(owner); await s.saveUser(owner);
  let me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_200') } });
  assert.equal(me.j.user.maxClientSlots, 5); assert.equal(me.j.user.isPro, false); assert.equal(me.j.user.invitedColleagues, 0);
  // новый пользователь пришел по ссылке и выбрал роль специалиста
  store.set('users/t_201.json', { body: JSON.stringify({ id: 't_201', role: null, ref: owner.refCode, consentVersion: '2026-10-v2' }), uploadedAt: '' });
  assert.equal((await call(auth, { method: 'POST', query: { a: 'role' }, body: { role: 'specialist' }, headers: { cookie: cookie('t_201') } })).code, 200);
  me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_200') } });
  assert.equal(me.j.user.maxClientSlots, 8); assert.equal(me.j.user.invitedColleagues, 1);
  // повторный выбор роли не дает второй бонус
  await call(auth, { method: 'POST', query: { a: 'role' }, body: { role: 'specialist' }, headers: { cookie: cookie('t_201') } });
  me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_200') } }); assert.equal(me.j.user.maxClientSlots, 8);
});
test('PRO: включает только админ, isPro меняется, выключение возвращает Free', async () => {
  user('t_300', 'specialist');
  assert.equal((await call(auth, { method: 'POST', query: { a: 'setplan' }, body: { id: 't_300', plan: 'pro', days: 30 }, headers: { cookie: cookie('t_2') } })).code, 403, 'не админ');
  assert.equal((await call(auth, { method: 'POST', query: { a: 'setplan' }, body: { id: 't_300', plan: 'pro', days: 30 }, headers: { cookie: cookie('t_1') } })).code, 200);
  let me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_300') } }); assert.equal(me.j.user.isPro, true); assert.equal(me.j.user.plan, 'pro');
  await call(auth, { method: 'POST', query: { a: 'setplan' }, body: { id: 't_300', plan: 'start' }, headers: { cookie: cookie('t_1') } });
  me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_300') } }); assert.equal(me.j.user.isPro, false);
});
const share = (await import(R + 'share.js')).default;
test('share: отчет по ссылке создает только специалист, читает любой по id, только конверт', async () => {
  user('t_400', 'specialist'); user('t_401', 'client');
  assert.equal((await call(share, { method: 'POST', body: env })).code, 401, 'без входа');
  assert.equal((await call(share, { method: 'POST', body: env, headers: { cookie: cookie('t_401') } })).code, 401, 'клиент не создает');
  assert.equal((await call(share, { method: 'POST', body: '{"img":"x"}', headers: { cookie: cookie('t_400') } })).code, 400, 'только шифр');
  assert.equal((await call(share, { method: 'POST', body: env, headers: { cookie: cookie('t_400'), origin: 'https://evil.com' } })).code, 403);
  const r = await call(share, { method: 'POST', body: env, headers: { cookie: cookie('t_400') } }); assert.equal(r.code, 200); assert.match(r.j.id, /^[A-Za-z0-9_-]{22}$/);
  const g = await call(share, { query: { id: r.j.id } }); assert.equal(g.code, 200); assert.equal(g.j.ct, 'b');
  assert.equal((await call(share, { query: { id: 'x'.repeat(22) } })).code, 404);
  assert.equal((await call(share, { query: { id: '../users/t_1' } })).code, 400);
});
test('VAS: дельта, комплаенс и средние', async () => {
  const v = await import(new URL('../js/vas.js', import.meta.url).href);
  assert.equal(v.vasDelta(7, 4), 3); assert.equal(v.vasDelta(3, 5), -2); assert.equal(v.vasDelta(null, 4), null);
  const now = Date.parse('2026-10-10T12:00:00Z'), d = 864e5;
  const log = [{ t: now - 1 * d, pre: 6, post: 3, n: 4 }, { t: now - 1 * d + 3600e3, pre: 5, post: 4, n: 2 }, { t: now - 3 * d, pre: 4, post: 4, n: 3 }, { t: now - 20 * d, pre: 8, post: 2, n: 4 }, { t: now - 2 * d, n: 0 }];
  const w = v.vasStats(log, 7, now); assert.equal(w.activeDays, 2, 'два дня с упражнениями'); assert.equal(w.compliance, 29); assert.equal(w.avgDelta, 1.3); assert.equal(w.avgPre, 5);
  const m = v.vasStats(log, 30, now); assert.equal(m.activeDays, 3); assert.equal(m.compliance, 10); assert.equal(m.avgDelta, 2.5);
  assert.equal(v.vasStats([], 7, now).avgDelta, null);
});
