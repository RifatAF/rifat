// Автоматическая калибровка: раз в сутки (api/cron.js) веса «правило → мышца» пересчитываются по всем накопленным
// проверкам специалистов (явные и фоновые разборы из /api/calib). Без участия администратора, но осторожно:
// связь меняется, только когда за нее не меньше 3 взвешенных мнений, и не больше чем на 0,15 за сутки.
// Ручные веса администратора остаются, автоматические правки и откат видны в истории config/weights.json.
import { list, get, put } from './_store.js';
import { learnWeights } from '../js/calibreport.js';

const W = 'config/weights.json', MAX_DOCS = 3000, STEP = .15, MIN_N = 3;
async function readJson(path) { try { const r = await get(path, { access: 'private', useCache: false }); if (!r || !r.stream) return null; const ch = []; for await (const c of r.stream) ch.push(Buffer.from(c)); return JSON.parse(Buffer.concat(ch).toString('utf8')); } catch (e) { return null; } }

// Пары тестов (до и после комплекса, контрольные повторы без упражнений): разброс теста и порог заметного изменения.
// Порог берем по контрольным парам: там настоящего изменения нет, вся разница — шум (поза, свет, усталость, привыкание).
// Пока контрольных мало, порог считаем по парам с комплексом за вычетом средней разницы: он получается завышенным, это осторожно.
export function retestStats(pairs) {
  const ctl = pairs.filter(p => !p.workout), wk = pairs.filter(p => p.workout);
  const diffs = (list, key) => list.flatMap(p => Object.keys({ ...p[key + '1'], ...p[key + '2'] }).map(k => ({ k, d: (p[key + '2'][k] || 0) - (p[key + '1'][k] || 0), a: p[key + '1'][k], b: p[key + '2'][k] })));
  const sd = a => { if (a.length < 2) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const mc = diffs(ctl, 'm').map(x => x.d), mw = diffs(wk, 'm').map(x => x.d);
  const base = mc.length >= 30 ? mc : mw.length >= 30 ? mw.map(d => d - mean(mw)) : null;
  const mdc = base ? Math.round(1.96 * sd(base)) : null;
  // эффект комплекса: средняя разница с комплексом минус средняя разница простого повтора (привыкание к тесту, регрессия к среднему)
  const effect = mc.length >= 30 && mw.length >= 30 ? Math.round((mean(mw) - mean(mc)) * 10) / 10 : null;
  // надежность признаков: разброс между двумя тестами относительно разброса между людьми (1 — идеально, 0 — один шум)
  const feats = {}; for (const x of diffs(ctl.length >= 10 ? ctl : [], 'f')) if (Number.isFinite(x.a) && Number.isFinite(x.b)) ((feats[x.k] ||= { d: [], v: [] }).d.push(x.d), feats[x.k].v.push(x.a, x.b));
  const features = Object.fromEntries(Object.entries(feats).filter(([, F]) => F.d.length >= 10).map(([k, F]) => { const e = sd(F.d) / Math.SQRT2, t = sd(F.v);
    return [k, { n: F.d.length, sem: Math.round(e * 100) / 100, rel: t ? Math.round(Math.max(0, 1 - (e * e) / (t * t)) * 100) / 100 : null }]; }));
  return { at: Date.now(), n: pairs.length, nControl: ctl.length, nWorkout: wk.length, mdc, effect, features };
}

export async function autoLearn(host) {
  const base = 'https://' + host, j = n => fetch(`${base}/data/${n}.json`).then(r => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.json(); });
  const [mus, bm, ch, ex] = await Promise.all([j('muscles'), j('bodymap'), j('chains'), j('exercises')]);
  const C = { muscles: mus.muscles, bodymap: bm, chains: ch.chains, exercises: Object.fromEntries(ex.exercises.map(e => [e.id, e])) };
  const paths = []; let cursor;
  do { const r = await list({ prefix: 'calib/', limit: 1000, cursor }); paths.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor && paths.length < MAX_DOCS);
  const docs = (await Promise.all(paths.slice(-MAX_DOCS).map(readJson))).filter(Boolean);
  // пары тестов: пересчитываем всегда, даже если разборов специалистов мало
  const pp = []; let pc; do { const r = await list({ prefix: 'pairs/', limit: 1000, cursor: pc }); pp.push(...r.blobs.map(b => b.pathname)); pc = r.hasMore ? r.cursor : undefined; } while (pc && pp.length < MAX_DOCS);
  const retest = pp.length ? retestStats((await Promise.all(pp.slice(-MAX_DOCS).map(readJson))).filter(Boolean)) : null;
  if (retest) { const prev = (await readJson(W)) || {}; await put(W, JSON.stringify({ ...prev, retest }), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }); }
  if (docs.length < 5) return { skipped: 'few', docs: docs.length, pairs: pp.length };
  const learned = learnWeights(docs, C, MIN_N), prev = (await readJson(W)) || {}, cur = { ...(prev.w || {}) }, changes = [];
  for (const x of learned) { const was = Number.isFinite(cur[x.key]) ? cur[x.key] : x.w, nw = Math.round(Math.max(was - STEP, Math.min(was + STEP, x.nw)) * 100) / 100;
    if (Math.abs(nw - was) >= .02) { cur[x.key] = nw; changes.push({ k: x.key, from: was, to: nw, agree: x.agree, disagree: x.disagree }); } }
  if (!changes.length) return { docs: docs.length, changes: 0 };
  const hist = [...(prev.history || []), ...(prev.w || prev.t ? [{ at: prev.at, w: prev.w || {}, t: prev.t || {}, by: prev.by }] : [])].slice(-20);
  const doc = { at: Date.now(), by: 'auto', n: docs.length, w: cur, t: prev.t || {}, history: hist, ...(prev.retest ? { retest: prev.retest } : {}), lastAuto: { at: Date.now(), docs: docs.length, changes: changes.slice(0, 50) } };
  await put(W, JSON.stringify(doc), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return { docs: docs.length, changes: changes.length };
}
