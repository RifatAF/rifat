// Батарея v2.0: 6-этапный экспресс-скрининг (2 мин 15 с), Safety Gate с заменой на Chair Stand, Retro-Gait и автокалибровка шкалы.
// Здесь только расчеты по кадрам { t, p } (33 точки MediaPipe в пикселях): экран и голос живут в app.js.

/** Протокол по ТЗ 5.2: блок, длительность записи и что считаем. */
export const BATTERY = [
  { unit: 'stand', sec: 5, what: 'Шкала S, пропорции, наклон плеч и таза' },
  { unit: 'ohs_front', sec: 15, reps: 3, what: 'Вальгус, пронация стоп, падение рук' },
  { unit: 'fwd', sec: 10, what: 'Натяжение задней цепи, тест Адамса' },
  { unit: 'slb', sec: 12, what: 'Тест Тренделенбурга, спад средней ягодичной' },
  { unit: 'trot', sec: 10, what: 'Скручивание в горизонтальной плоскости' },
  { unit: 'reach', sec: 10, reps: 2, what: 'Плече-лопаточный ритм, крыловидность лопаток' },
];
export const BATTERY_UNITS = BATTERY.map(x => x.unit);
export const BATTERY_SEC = 135;

const RAD = 180 / Math.PI, ok = x => x && x.p;
const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : NaN; };
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const tilt = (l, r) => Math.atan2(r.y - l.y, Math.abs(r.x - l.x) || 1e-6) * RAD;
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined;
const res = (f, n) => ({ f, reps: n ?? 1, quality: n === 0 ? 'RETAKE' : 'GOOD' });

/** Наклон вперед (лицом к камере): насколько кисти опустились к стопам и перекос линии плеч внизу (тест Адамса спереди). */
export function forwardBend(fr) {
  const v = fr.filter(ok); if (v.length < 10) return res({}, 0);
  const leg = med(v.slice(0, 5).map(x => mid(x.p[27], x.p[28]).y - mid(x.p[23], x.p[24]).y)) || 1;
  let best = null; for (const x of v) { const w = mid(x.p[15], x.p[16]).y; if (!best || w > best.w) best = { w, x }; }
  const hipY = mid(best.x.p[23], best.x.p[24]).y, reach = (best.w - hipY) / leg; // 0 — кисти у таза, 1 — у стоп
  const asym = tilt(best.x.p[11], best.x.p[12]);
  return res({ fwd_reach: r1(Math.max(0, Math.min(1.2, reach))), fwd_asym: r1(Math.abs(asym)), fwd_asym_side: Math.sign(asym) || 1 });
}
/** Одноопорный баланс: по 6 секунд на каждой ноге. Провал таза в сторону свободной ноги (Тренделенбург) и раскачка. */
export function singleBalance(frR, frL) {
  const one = (fr, right) => { const v = fr.filter(ok); if (v.length < 10) return {};
    // стоим на правой: свободная левая, провал = левый край таза ниже правого
    const drop = med(v.map(x => (right ? 1 : -1) * (x.p[23].y - x.p[24].y) / (Math.abs(x.p[23].x - x.p[24].x) || 1) * RAD));
    const cx = v.map(x => mid(x.p[23], x.p[24]).x), w = med(v.map(x => Math.abs(x.p[11].x - x.p[12].x))) || 1, m = cx.reduce((a, b) => a + b, 0) / cx.length;
    const sway = Math.sqrt(cx.reduce((a, b) => a + (b - m) ** 2, 0) / cx.length) / w * 100;
    return right ? { slb_drop_r: r1(drop), slb_sway_r: r1(sway) } : { slb_drop_l: r1(drop), slb_sway_l: r1(sway) }; };
  const f = { ...one(frR, true), ...one(frL, false) };
  return res(f, Object.keys(f).length ? 1 : 0);
}
/** Ротация грудного отдела (руки скрещены на груди): угол по сужению видимой ширины плеч, вправо и влево. */
export function thoracicRotation(frR, frL) {
  const w0f = fr => med(fr.filter(ok).slice(0, 5).map(x => Math.abs(x.p[11].x - x.p[12].x)));
  const rot = fr => { const v = fr.filter(ok); if (v.length < 8) return NaN; const w0 = w0f(fr) || 1, wmin = Math.min(...v.map(x => Math.abs(x.p[11].x - x.p[12].x)));
    return Math.acos(Math.max(0, Math.min(1, wmin / w0))) * RAD; };
  const r = rot(frR), l = rot(frL); if (!Number.isFinite(r) || !Number.isFinite(l)) return res({}, 0);
  return res({ trot_r: r1(r), trot_l: r1(l), trot_asym: r1(r - l) });
}
/** Руки вверх 2 раза: максимальный угол в плече и подъем надплечья к уху (ритм лопатки), по сторонам. */
export function overheadReach(fr) {
  const v = fr.filter(ok); if (v.length < 10) return res({}, 0);
  const ang = (h, s, e) => { const a = Math.atan2(h.y - s.y, h.x - s.x), b = Math.atan2(e.y - s.y, e.x - s.x); let d = Math.abs(a - b) * RAD; return d > 180 ? 360 - d : d; };
  const trunk = med(v.slice(0, 5).map(x => mid(x.p[23], x.p[24]).y - mid(x.p[11], x.p[12]).y)) || 1;
  const s0r = med(v.slice(0, 5).map(x => x.p[12].y)), s0l = med(v.slice(0, 5).map(x => x.p[11].y));
  let mr = 0, ml = 0, er = 0, el = 0;
  for (const x of v) { const p = x.p; mr = Math.max(mr, ang(p[24], p[12], p[14])); ml = Math.max(ml, ang(p[23], p[11], p[13]));
    er = Math.max(er, (s0r - p[12].y) / trunk); el = Math.max(el, (s0l - p[11].y) / trunk); }
  const shrug = Math.max(er, el);
  return res({ reach_r: r1(mr), reach_l: r1(ml), reach_asym: r1(ml - mr), reach_shrug: Math.round(shrug * 100) / 100, reach_shrug_side: er >= el ? 1 : -1 }, 2);
}
/** Chair Stand Test (30 с): сколько раз встал со стула. Встал — таз поднялся выше середины между нижней и верхней точкой. */
export function chairStand(fr) {
  const v = fr.filter(ok); if (v.length < 10) return res({}, 0);
  const y = v.map(x => mid(x.p[23], x.p[24]).y), lo = Math.max(...y), hi = Math.min(...y), m = (lo + hi) / 2; if (lo - hi < 10) return res({ chair_reps: 0 }, 0);
  let n = 0, up = y[0] < m; for (const q of y) { if (!up && q < m - (lo - hi) * .15) { up = true; n++; } else if (up && q > m + (lo - hi) * .15) up = false; }
  return res({ chair_reps: n }, n);
}
/** Retro-Gait: человек отходит назад к месту теста. Сравниваем шаги правой и левой ноги по смещению носков (31, 32). */
export function retroGait(fr) {
  const v = fr.filter(ok); if (v.length < 15) return null;
  const steps = { r: 0, l: 0, nr: 0, nl: 0 };
  for (const [k, i] of [['r', 32], ['l', 31]]) { let prev = v[0].p[i].y, still = prev;
    for (const x of v) { const y = x.p[i].y; if (Math.abs(y - still) > 6 && Math.abs(y - prev) < 2) { steps[k] += Math.abs(y - still); steps['n' + k]++; still = y; } prev = y; } }
  const sum = steps.r + steps.l; if (!sum || steps.nr + steps.nl < 2) return null;
  return { asym: Math.round(Math.abs(steps.r - steps.l) / sum * 100), stepsR: steps.nr, stepsL: steps.nl };
}
/** Автокалибровка масштаба: от глаз до лодыжек 93.6% роста. Без роста берем 170 см и помечаем как оценку. */
export function autoScale(fr, heightCm) {
  const v = fr.filter(ok); if (v.length < 3) return null;
  const px = med(v.map(x => mid(x.p[27], x.p[28]).y - mid(x.p[2], x.p[5]).y)); if (!(px > 50)) return null;
  const h = +heightCm > 100 && +heightCm < 230 ? +heightCm : 170;
  return { cmPerPx: Math.round(.936 * h / px * 10000) / 10000, est: !(+heightCm > 100) };
}
/** Признаки батареи в общий набор признаков (analysis.features). */
export const V2_MOVES = ['fwd', 'slb', 'trot', 'reach', 'chair', 'iap'];
export function mergeV2(f, moves) {
  for (const n of V2_MOVES) { const m = moves && moves[n]; if (!m || m.quality === 'RETAKE' || !m.f) continue;
    for (const [k, v] of Object.entries(m.f)) if (Number.isFinite(v) && f[k] === undefined) f[k] = v; }
  return f;
}
