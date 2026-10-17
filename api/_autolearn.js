// Автоматическая калибровка: раз в сутки (api/cron.js) веса «правило → мышца» пересчитываются по всем накопленным
// проверкам специалистов (явные и фоновые разборы из /api/calib). Без участия администратора, но осторожно:
// связь меняется, только когда за нее не меньше 3 взвешенных мнений, и не больше чем на 0,15 за сутки.
// Ручные веса администратора остаются, автоматические правки и откат видны в истории config/weights.json.
import { list, get, put } from '@vercel/blob';
import { learnWeights } from '../js/calibreport.js';

const W = 'config/weights.json', MAX_DOCS = 3000, STEP = .15, MIN_N = 3;
async function readJson(path) { try { const r = await get(path, { access: 'private', useCache: false }); if (!r || !r.stream) return null; const ch = []; for await (const c of r.stream) ch.push(Buffer.from(c)); return JSON.parse(Buffer.concat(ch).toString('utf8')); } catch (e) { return null; } }

export async function autoLearn(host) {
  const base = 'https://' + host, j = n => fetch(`${base}/data/${n}.json`).then(r => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.json(); });
  const [mus, bm, ch, ex] = await Promise.all([j('muscles'), j('bodymap'), j('chains'), j('exercises')]);
  const C = { muscles: mus.muscles, bodymap: bm, chains: ch.chains, exercises: Object.fromEntries(ex.exercises.map(e => [e.id, e])) };
  const paths = []; let cursor;
  do { const r = await list({ prefix: 'calib/', limit: 1000, cursor }); paths.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor && paths.length < MAX_DOCS);
  const docs = (await Promise.all(paths.slice(-MAX_DOCS).map(readJson))).filter(Boolean);
  if (docs.length < 5) return { skipped: 'few', docs: docs.length };
  const learned = learnWeights(docs, C, MIN_N), prev = (await readJson(W)) || {}, cur = { ...(prev.w || {}) }, changes = [];
  for (const x of learned) { const was = Number.isFinite(cur[x.key]) ? cur[x.key] : x.w, nw = Math.round(Math.max(was - STEP, Math.min(was + STEP, x.nw)) * 100) / 100;
    if (Math.abs(nw - was) >= .02) { cur[x.key] = nw; changes.push({ k: x.key, from: was, to: nw, agree: x.agree, disagree: x.disagree }); } }
  if (!changes.length) return { docs: docs.length, changes: 0 };
  const hist = [...(prev.history || []), ...(prev.w || prev.t ? [{ at: prev.at, w: prev.w || {}, t: prev.t || {}, by: prev.by }] : [])].slice(-20);
  const doc = { at: Date.now(), by: 'auto', n: docs.length, w: cur, t: prev.t || {}, history: hist, lastAuto: { at: Date.now(), docs: docs.length, changes: changes.slice(0, 50) } };
  await put(W, JSON.stringify(doc), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return { docs: docs.length, changes: changes.length };
}
