// Хранилище: с ключами R2 пишем только в R2, Vercel Blob только читаем как запасной источник и переносим кнопкой.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
const blob = new Map(), r2 = new Map();
mock.module('@vercel/blob', { namedExports: {
  put: async (p, b) => { blob.set(p, String(b)); return { pathname: p }; },
  get: async p => blob.has(p) ? { stream: [Buffer.from(blob.get(p))], pathname: p } : null,
  list: async () => ({ blobs: [...blob.keys()].map(p => ({ pathname: p })), hasMore: false }),
  del: async ps => [].concat(ps).forEach(p => blob.delete(p)) } });
globalThis.fetch = async (url, o) => { const u = new URL(url), key = decodeURIComponent(u.pathname.split('/').slice(2).join('/'));
  if (u.searchParams.has('list-type')) { const pre = u.searchParams.get('prefix') || ''; return new Response(`<R>${[...r2.keys()].filter(k => k.startsWith(pre)).map(k => `<Contents><Key>${k}</Key><Size>1</Size></Contents>`).join('')}<IsTruncated>false</IsTruncated></R>`, { status: 200 }); }
  if (o.method === 'PUT') { r2.set(key, String(o.body)); return new Response('', { status: 200 }); }
  if (o.method === 'DELETE') { r2.delete(key); return new Response(null, { status: 204 }); }
  return r2.has(key) ? new Response(r2.get(key), { status: 200 }) : new Response('', { status: 404 }); };
Object.assign(process.env, { BLOB_READ_WRITE_TOKEN: 'x', S3_KEY: 'k', S3_SECRET: 's' }); delete process.env.STORE_PRIMARY;
const S = await import('../api/_store.js');
const txt = async r => { const ch = []; for await (const c of r.stream) ch.push(Buffer.from(c)); return Buffer.concat(ch).toString(); };

test('R2 основное: запись только в R2, старое из Blob читается, перенос копирует в R2', async () => {
  assert.deepEqual(S.storeInfo(), { primary: 's3', mirrors: [], readBack: ['blob'] });
  await S.put('users/a.json', '{"a":1}', { access: 'private' });
  assert.equal(r2.get('users/a.json'), '{"a":1}'); assert.equal(blob.has('users/a.json'), false, 'в Blob не пишем');
  blob.set('users/old.json', '{"old":1}');
  assert.equal(await txt(await S.get('users/old.json')), '{"old":1}', 'старый файл из Blob');
  await S.del('users/old.json'); assert.equal(await S.get('users/old.json'), null, 'удаленное не возвращается из Blob');
  blob.set('users/old.json', '{"old":1}');
  r2.set('users/n.json', '1'); blob.set('users/n.json', '1'); const l = await S.list({ prefix: 'users/' }); assert.deepEqual(l.blobs.map(b => b.pathname).sort(), ['users/a.json', 'users/n.json', 'users/old.json'], 'список из R2 и Blob без повторов');
  const c = await S.copyBatch(); assert.equal(c.copied, 2); assert.equal(r2.get('users/old.json'), '{"old":1}');
});
