// BodyPassport на Cloudflare Workers (с 17.11.2026): статика из public/ (Workers Static Assets), функции api/ без переделки.
// Переходник ниже дает обработчикам api/*.js те же req и res, что давал Vercel (req.query, req.body, res.status().json()).
// Данные в R2 через привязку DATA, задачи по расписанию через Cron Triggers (wrangler.jsonc), заголовки безопасности из vercel.json.
import auth from '../api/auth.js';
import calib from '../api/calib.js';
import cron from '../api/cron.js';
import ev from '../api/ev.js';
import feedback from '../api/feedback.js';
import lava from '../api/lava.js';
import norms from '../api/norms.js';
import relay from '../api/relay.js';
import remind from '../api/remind.js';
import share from '../api/share.js';
import store from '../api/store.js';
import vercel from '../vercel.json';

const API = { auth, calib, cron, ev, feedback, lava, norms, relay, remind, share, store };

// заголовки из vercel.json: источник вида «/(voice|img)/(.*)» превращается в регулярное выражение
const RULES = (vercel.headers || []).map(h => ({ re: new RegExp('^' + h.source.replace(/\/:(\w+)\*/g, '/(.*)') + '$'), headers: h.headers.filter(x => !/^x-vercel/i.test(x.key)) }));
function withHeaders(res, path) {
  const out = new Response(res.body, res);
  for (const r of RULES) if (r.re.test(path)) for (const { key, value } of r.headers) out.headers.set(key, value);
  return out;
}
// модели MediaPipe и библиотеки с CDN отдаются с нашего домена (как rewrites в vercel.json) и кэшируются на краю
const PROXY = (vercel.rewrites || []).map(r => ({ re: new RegExp('^' + r.source.replace(/:(\w+)\((.*?)\)/g, '(?<$1>$2)').replace(/:(\w+)\*/g, '(?<$1>.*)') + '$'), dest: r.destination }));
async function proxy(req, ctx, path) {
  for (const p of PROXY) { const m = path.match(p.re); if (!m) continue;
    const url = p.dest.replace(/:(\w+)\*?/g, (_, k) => (m.groups || {})[k] || '');
    const cache = caches.default, key = new Request(url), hit = await cache.match(key); if (hit) return hit;
    const r = await fetch(url, { cf: { cacheTtl: 2592000, cacheEverything: true } }); if (!r.ok) return r;
    const out = new Response(r.body, r); out.headers.set('Cache-Control', 'public, max-age=31536000, immutable'); ctx.waitUntil(cache.put(key, out.clone())); return out; }
  return null;
}

/** Запрос Cloudflare → req/res в стиле Vercel → Response. */
async function runApi(handler, request) {
  const url = new URL(request.url), headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  if (!headers['x-forwarded-for'] && headers['cf-connecting-ip']) headers['x-forwarded-for'] = headers['cf-connecting-ip'];
  if (!headers['x-forwarded-proto']) headers['x-forwarded-proto'] = url.protocol.replace(':', '');
  let body;
  if (!['GET', 'HEAD'].includes(request.method)) { const t = await request.text(), ct = headers['content-type'] || '';
    if (!t) body = undefined;
    else if (/json/.test(ct)) { try { body = JSON.parse(t); } catch (e) { body = t; } }
    else if (/x-www-form-urlencoded/.test(ct)) body = Object.fromEntries(new URLSearchParams(t));
    else body = t; }
  const req = { method: request.method, url: url.pathname + url.search, query: Object.fromEntries(url.searchParams), headers, body };
  return new Promise((resolve, reject) => {
    const h = new Headers(); let code = 200, done = false;
    const finish = (payload, type) => { if (done) return; done = true; if (type && !h.has('content-type')) h.set('content-type', type); resolve(new Response(payload, { status: code, headers: h })); };
    const res = {
      setHeader(k, v) { if (Array.isArray(v)) { h.delete(k); v.forEach(x => h.append(k, x)); } else h.set(k, String(v)); return res; },
      getHeader: k => h.get(k), status(c) { code = c; return res; },
      json(o) { finish(JSON.stringify(o), 'application/json; charset=utf-8'); return res; },
      send(b) { finish(typeof b === 'object' && !(b instanceof Uint8Array) ? JSON.stringify(b) : b, typeof b === 'object' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'); return res; },
      end(b) { finish(b ?? null); return res; },
      redirect(a, b) { const [c, l] = typeof a === 'number' ? [a, b] : [302, a]; code = c; h.set('location', l); finish(null); return res; } };
    Promise.resolve(handler(req, res)).then(() => finish(null), reject);
  });
}

function bind(env) {
  globalThis.__BP_R2 = env.DATA || null;
  // секреты и переменные Worker в process.env, если флаг nodejs_compat_populate_process_env их еще не положил
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string' && process.env[k] === undefined) process.env[k] = v;
}

export default {
  async fetch(request, env, ctx) {
    bind(env);
    const url = new URL(request.url), path = url.pathname;
    try {
      if (path.startsWith('/api/')) { const h = API[path.slice(5).replace(/\/+$/, '').split('/')[0]];
        if (!h) return withHeaders(new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } }), path);
        return withHeaders(await runApi(h, request), path); }
      const p = await proxy(request, ctx, path); if (p) return withHeaders(p, path);
      return withHeaders(await env.ASSETS.fetch(request), path);
    } catch (e) { console.error('worker', path, e && e.stack || e); return new Response(JSON.stringify({ error: 'server' }), { status: 500, headers: { 'content-type': 'application/json' } }); }
  },
  // Cron Triggers вместо Vercel Cron: те же адреса и тот же секрет CRON_SECRET
  async scheduled(event, env, ctx) {
    bind(env);
    const path = event.cron === '0 12 * * *' ? '/api/remind?a=cron' : '/api/cron';
    const r = await this.fetch(new Request('https://' + (env.SITE_HOST || 'bodypassport.app') + path, { headers: { authorization: 'Bearer ' + (env.CRON_SECRET || '') } }), env, ctx);
    console.log('cron', path, r.status);
  },
};
