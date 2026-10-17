// Хранилище данных сервера с двойной записью. Тот же интерфейс, что у @vercel/blob (put, get, list, del),
// поэтому остальной код не знает, где лежат файлы.
//
// Хранилища (включаются переменными окружения в Vercel):
//   blob   — Vercel Blob (BLOB_READ_WRITE_TOKEN), как было;
//   s3     — любое S3-совместимое: Cloudflare R2, Backblaze B2, Yandex Object Storage (S3_ENDPOINT, S3_BUCKET, S3_KEY, S3_SECRET, S3_REGION);
//   backup — второе S3, например MinIO на домашнем сервере (BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_KEY, BACKUP_S3_SECRET, BACKUP_S3_REGION).
// STORE_PRIMARY=blob|s3 выбирает, откуда читать (по умолчанию blob). Запись и удаление идут в основное хранилище,
// и копия уходит во все остальные настроенные. Сбой копии не ломает запрос, он пишется в лог.
import crypto from 'node:crypto';

const env = process.env;
let blobMod = null; const blob = async () => blobMod || (blobMod = await import('@vercel/blob'));

function s3cfg(p) {
  const e = env[p + 'ENDPOINT'], b = env[p + 'BUCKET'], k = env[p + 'KEY'], s = env[p + 'SECRET'];
  return e && b && k && s ? { endpoint: e.replace(/\/+$/, ''), bucket: b, key: k, secret: s, region: env[p + 'REGION'] || 'auto', name: p === 'S3_' ? 's3' : 'backup' } : null;
}
const sha = d => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const keyPath = k => k.split('/').map(enc).join('/');

/** Запрос к S3 с подписью AWS Signature V4 (path-style: endpoint/bucket/key). */
async function s3req(c, method, key, { query = {}, body = '', type } = {}) {
  const u = new URL(c.endpoint), path = `${u.pathname.replace(/\/$/, '')}/${enc(c.bucket)}${key ? '/' + keyPath(key) : ''}`;
  const now = new Date(), amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = amz.slice(0, 8), ph = sha(body);
  const cq = Object.keys(query).sort().map(k => `${enc(k)}=${enc(String(query[k]))}`).join('&');
  const hdr = { host: u.host, 'x-amz-content-sha256': ph, 'x-amz-date': amz }, sh = Object.keys(hdr).sort().join(';');
  const creq = [method, path, cq, Object.keys(hdr).sort().map(k => `${k}:${hdr[k]}\n`).join(''), sh, ph].join('\n');
  const scope = `${day}/${c.region}/s3/aws4_request`, sts = ['AWS4-HMAC-SHA256', amz, scope, sha(creq)].join('\n');
  const sk = hmac(hmac(hmac(hmac('AWS4' + c.secret, day), c.region), 's3'), 'aws4_request'), sig = crypto.createHmac('sha256', sk).update(sts).digest('hex');
  const headers = { 'x-amz-content-sha256': ph, 'x-amz-date': amz, Authorization: `AWS4-HMAC-SHA256 Credential=${c.key}/${scope}, SignedHeaders=${sh}, Signature=${sig}` };
  if (type) headers['Content-Type'] = type;
  return fetch(`${u.origin}${path}${cq ? '?' + cq : ''}`, { method, headers, body: method === 'PUT' ? body : undefined, signal: AbortSignal.timeout(15000) });
}
const xml = (s, tag) => [...s.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function s3store(c) {
  return { name: c.name,
    async put(p, body, o = {}) { const r = await s3req(c, 'PUT', p, { body: typeof body === 'string' ? body : Buffer.from(body), type: o.contentType || 'application/octet-stream' }); if (!r.ok) throw new Error(`${c.name} put ${r.status}`); return { pathname: p, url: p }; },
    async get(p) { const r = await s3req(c, 'GET', p); if (r.status === 404) return null; if (!r.ok) throw new Error(`${c.name} get ${r.status}`); return { stream: r.body, pathname: p }; },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const q = { 'list-type': 2, prefix, 'max-keys': Math.min(1000, limit) }; if (cursor) q['continuation-token'] = cursor;
      const r = await s3req(c, 'GET', '', { query: q }); if (!r.ok) throw new Error(`${c.name} list ${r.status}`); const t = await r.text();
      const blobs = xml(t, 'Contents').map(x => { const p = unxml(xml(x, 'Key')[0] || ''); return { pathname: p, url: p, size: +(xml(x, 'Size')[0] || 0), uploadedAt: new Date(xml(x, 'LastModified')[0] || 0) }; });
      const more = (xml(t, 'IsTruncated')[0] || '') === 'true'; return { blobs, hasMore: more, cursor: more ? unxml(xml(t, 'NextContinuationToken')[0] || '') : undefined }; },
    async del(ps) { for (const p of [].concat(ps)) { const r = await s3req(c, 'DELETE', p); if (!r.ok && r.status !== 404) throw new Error(`${c.name} del ${r.status}`); } } };
}
const blobStore = { name: 'blob',
  put: async (p, body, o) => (await blob()).put(p, body, o), get: async (p, o) => (await blob()).get(p, o),
  list: async o => (await blob()).list(o), del: async ps => (await blob()).del(ps) };

const S3 = s3cfg('S3_'), BK = s3cfg('BACKUP_S3_');
export const STORES = [env.BLOB_READ_WRITE_TOKEN ? blobStore : null, S3 ? s3store(S3) : null, BK ? s3store(BK) : null].filter(Boolean);
const primary = (env.STORE_PRIMARY === 's3' && S3 && STORES.find(s => s.name === 's3')) || STORES.find(s => s.name === 'blob') || STORES[0] || blobStore;
const mirrors = STORES.filter(s => s !== primary);
// ссылка Vercel Blob → путь файла: в S3 ключ равен пути
const pathOf = x => { const s = String(x); if (!/^https?:\/\//.test(s)) return s; try { return decodeURIComponent(new URL(s).pathname.replace(/^\//, '')); } catch (e) { return s; } };
const mirror = (what, fn) => Promise.all(mirrors.map(m => fn(m).catch(e => console.error('store mirror', m.name, what, e.message))));

export async function put(p, body, o = {}) { const r = await primary.put(p, body, o); await mirror('put ' + p, m => m.put(p, body, o)); return r; }
export async function get(p, o) {
  try { const r = await primary.get(p, o); if (r) return r; } catch (e) { if (!mirrors.length) throw e; console.error('store get', primary.name, e.message); }
  // основное хранилище недоступно или файла там нет: берем из копии
  for (const m of mirrors) { try { const r = await m.get(p, o); if (r) return r; } catch (e) {} } return null;
}
export const list = o => primary.list(o);
export async function del(x) { const ps = [].concat(x); await primary.del(primary.name === 'blob' ? x : ps.map(pathOf)); await mirror('del', m => m.del(m.name === 'blob' ? ps.map(pathOf) : ps.map(pathOf))); }
export const storeInfo = () => ({ primary: primary.name, mirrors: mirrors.map(m => m.name) });
/** Копия всех файлов основного хранилища в остальные: пачками, по курсору (кнопка в Администрировании). */
export async function copyBatch(cursor, limit = 200) {
  const r = await primary.list({ limit, cursor }); let n = 0;
  for (const b of r.blobs) { const g = await primary.get(b.pathname, { access: 'private', useCache: false }).catch(() => null); if (!g || !g.stream) continue;
    const ch = []; for await (const c of g.stream) ch.push(Buffer.from(c)); const body = Buffer.concat(ch);
    await Promise.all(mirrors.map(m => m.put(b.pathname, body, { access: 'private', contentType: b.pathname.endsWith('.json') ? 'application/json' : 'application/octet-stream', addRandomSuffix: false, allowOverwrite: true }))); n++; }
  return { copied: n, cursor: r.hasMore ? r.cursor : null };
}
