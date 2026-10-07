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
const user = (id, role) => store.set(`users/${id}.json`, { body: JSON.stringify({ id, role, name: 'N', consentVersion: '2026-10-beta2' }), uploadedAt: new Date().toISOString() });
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
test('auth: без второго согласия новый вход запрещен; config отдает дату беты', async () => {
  const c = await call(auth, { query: { a: 'config' } }); assert.ok(c.j.betaUntil > Date.now());
  const me = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_1') } }); assert.equal(me.j.user.consentOk, true);
  store.set('users/t_9.json', { body: JSON.stringify({ id: 't_9', role: 'client', consentVersion: '2026-10-beta' }), uploadedAt: '' });
  const me9 = await call(auth, { query: { a: 'me' }, headers: { cookie: cookie('t_9') } }); assert.equal(me9.j.user.consentOk, false, 'старая версия согласия');
});
