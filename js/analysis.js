// Порт логики анализа из Android-модуля domain (Kotlin): те же формулы и пороги.
export const P = { NOSE:0, L_EAR:7, R_EAR:8, L_SHOULDER:11, R_SHOULDER:12, L_ELBOW:13, R_ELBOW:14, L_WRIST:15, R_WRIST:16,
  L_HIP:23, R_HIP:24, L_KNEE:25, R_KNEE:26, L_ANKLE:27, R_ANKLE:28, L_HEEL:29, R_HEEL:30, L_FOOT:31, R_FOOT:32 };
const RAD = 180 / Math.PI;
const median = a => { const v = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); if (!v.length) return NaN; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
export const fmt = v => (Math.round(Math.abs(v) * 10) / 10).toString().replace('.', ',');

export const G = {
  angleAt(a, b, c) { const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y; const d = Math.hypot(ux, uy) * Math.hypot(vx, vy); if (!d) return 0; return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))) * RAD; },
  lineTilt(l, r) { const dx = Math.abs(r.x - l.x); return dx < 1e-9 ? 0 : Math.atan((r.y - l.y) / dx) * RAD; },
  toVertical(from, to) { return Math.atan2(to.x - from.x, -(to.y - from.y)) * RAD; },
  mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; },
  sideSign(p) { const s = Math.sign(p[P.R_SHOULDER].x - p[P.L_SHOULDER].x); return s === 0 ? 1 : s; },
};
export function levelled(p, w, h, deg) {
  if (!deg) return p; const a = deg / RAD, cx = w / 2, cy = h / 2, c = Math.cos(a), s = Math.sin(a);
  return p.map(l => ({ ...l, x: cx + (l.x - cx) * c - (l.y - cy) * s, y: cy + (l.x - cx) * s + (l.y - cy) * c }));
}
export const F = {
  shoulderTilt: p => G.lineTilt(p[P.L_SHOULDER], p[P.R_SHOULDER]),
  pelvicTilt: p => G.lineTilt(p[P.L_HIP], p[P.R_HIP]),
  headTilt: p => G.lineTilt(p[P.L_EAR], p[P.R_EAR]),
  trunkLateral(p) { return G.toVertical(G.mid(p[P.L_HIP], p[P.R_HIP]), G.mid(p[P.L_SHOULDER], p[P.R_SHOULDER])) * G.sideSign(p); },
  kneeFlexion(p, r) { return 180 - G.angleAt(p[r ? P.R_HIP : P.L_HIP], p[r ? P.R_KNEE : P.L_KNEE], p[r ? P.R_ANKLE : P.L_ANKLE]); },
  /** Поворот кисти внутрь в стойке (вид спереди): большой палец уходит к середине тела относительно мизинца.
   *  Ладони назад, «костяшки вперед» — признак внутренней ротации плеча и сутулых плеч (грудные, широчайшая). В долях длины кисти. */
  handRot(p, r) {
    const sh = p[r ? P.R_SHOULDER : P.L_SHOULDER], other = p[r ? P.L_SHOULDER : P.R_SHOULDER], wr = p[r ? P.R_WRIST : P.L_WRIST];
    const th = p[r ? 22 : 21], pk = p[r ? 18 : 17], ix = p[r ? 20 : 19];
    if (!th || !pk || !ix || [th, pk, ix, wr].some(l => (l.visibility ?? 1) < .5)) return NaN;
    const len = Math.hypot(ix.x - wr.x, ix.y - wr.y); if (len < 1) return NaN;
    return (th.x - pk.x) * Math.sign(other.x - sh.x || 1) / len;
  },
  fppa(p, r) {
    const hip = p[r ? P.R_HIP : P.L_HIP], knee = p[r ? P.R_KNEE : P.L_KNEE], ank = p[r ? P.R_ANKLE : P.L_ANKLE], other = p[r ? P.L_HIP : P.R_HIP];
    const mag = 180 - G.angleAt(hip, knee, ank);
    const lx = ank.x - hip.x, ly = ank.y - hip.y;
    const ck = lx * (knee.y - hip.y) - ly * (knee.x - hip.x), co = lx * (other.y - hip.y) - ly * (other.x - hip.x);
    const medial = co === 0 ? 1 : Math.sign(ck) * Math.sign(co);
    return medial < 0 ? -mag : mag;
  },
};

export function sideView(p) {
  const right = p[P.R_EAR].visibility + p[P.R_SHOULDER].visibility >= p[P.L_EAR].visibility + p[P.L_SHOULDER].visibility;
  const ear = p[right ? P.R_EAR : P.L_EAR], sh = p[right ? P.R_SHOULDER : P.L_SHOULDER], hip = p[right ? P.R_HIP : P.L_HIP], knee = p[right ? P.R_KNEE : P.L_KNEE], ank = p[right ? P.R_ANKLE : P.L_ANKLE];
  const fwd = p[P.NOSE].x >= ear.x ? 1 : -1;
  const height = Math.max(1, ank.y - Math.min(ear.y, p[P.NOSE].y)) * 1.08;
  const t = Math.max(0, Math.min(1, (knee.y - hip.y) / Math.max(1, ank.y - hip.y)));
  const lineX = hip.x + (ank.x - hip.x) * t, shank = Math.max(1, Math.hypot(ank.x - knee.x, ank.y - knee.y));
  return { headForwardDeg: Math.atan2((ear.x - sh.x) * fwd, sh.y - ear.y) * RAD, hipShift: (hip.x - ank.x) * fwd / height,
    shoulderShift: (sh.x - hip.x) * fwd / height, kneeHyperDeg: Math.atan((lineX - knee.x) * fwd / shank) * RAD };
}

/**
 * Сглаживание записи без сдвига во времени (центрированное среднее по 5 кадрам) и отбраковка кадров,
 * где ключевые точки плохо видны. Убирает дрожание точек — главный источник разброса между повторными тестами.
 */
export function smooth(fr) {
  if (fr.length < 5 || fr._s) return fr;
  const out = fr.map((f, i) => { const a = Math.max(0, i - 2), b = Math.min(fr.length - 1, i + 2), n = b - a + 1;
    return { t: f.t, w: f.w, p: f.p.map((l, j) => { let x = 0, y = 0; for (let k = a; k <= b; k++) { x += fr[k].p[j].x; y += fr[k].p[j].y; } return { ...l, x: x / n, y: y / n }; }) }; });
  out._s = true; return out;
}
const goodFrame = f => [P.L_HIP, P.R_HIP, P.L_KNEE, P.R_KNEE, P.L_ANKLE, P.R_ANKLE].every(i => (f.p[i].visibility ?? 1) > .55);

function bottoms(fr, minGap = 1.2, minDepth = 0.06) {
  if (fr.length < 10) return [];
  const y = fr.map(f => (f.p[P.L_HIP].y + f.p[P.R_HIP].y) / 2);
  const sm = y.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(y.length - 1, i + 2); j++) { s += y[j]; n++; } return s / n; });
  const first = fr.slice(0, 10);
  const leg = first.map(f => Math.hypot(f.p[P.L_HIP].x - f.p[P.L_ANKLE].x, f.p[P.L_HIP].y - f.p[P.L_ANKLE].y)).reduce((a, b) => a + b, 0) / first.length || 1;
  // положение стоя = самая высокая точка таза (10-й процентиль), а не первые кадры: человек может начать с середины движения
  const sorted = [...sm].sort((a, b) => a - b), base = sorted[Math.floor(sorted.length * .1)];
  const cand = []; for (let i = 2; i < sm.length - 2; i++) if (sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] - base > minDepth * leg) cand.push(i);
  cand.sort((a, b) => sm[b] - sm[a]);
  const out = []; for (const c of cand) if (!out.some(o => Math.abs(fr[o].t - fr[c].t) < minGap)) out.push(c);
  // повтор заметно мельче остальных (недоприсел, сбой) в расчет не берем
  if (out.length >= 3) { const dep = out.map(i => sm[i] - base), m = [...dep].sort((a, b) => a - b)[dep.length >> 1]; return out.filter((_, k) => dep[k] >= .6 * m).sort((a, b) => a - b); }
  return out.sort((a, b) => a - b);
}
const around = (fr, i) => { const a = fr.slice(Math.max(0, i - 2), Math.min(fr.length, i + 3)), g = a.filter(goodFrame); return g.length ? g : a; };
const vis = (fr, ids) => fr.length ? fr.map(f => ids.reduce((s, i) => s + f.p[i].visibility, 0) / ids.length).reduce((a, b) => a + b, 0) / fr.length : 0;
const LEGS = [P.L_HIP, P.R_HIP, P.L_KNEE, P.R_KNEE, P.L_ANKLE, P.R_ANKLE];
const res = (f, reps, v) => ({ f, reps, visibility: v, quality: reps >= 2 && v >= .75 ? 'GOOD' : reps >= 1 ? 'DOUBTFUL' : 'RETAKE' });
const ang = (a, c) => Math.atan2(c.x - a.x, a.y - c.y) * RAD;

/**
 * Руки вверх: насколько не хватает до полного сгибания плеча (180°), в градусах, отдельно для каждой руки.
 * Спереди руки, ушедшие вперед, видны как укороченная вертикальная проекция: подъем кисти над плечом / длина руки = cos(недостачи).
 * Если есть объемные точки MediaPipe, добавляем угол между корпусом и плечевой костью в 3D и усредняем.
 * Берем кадры стоя с руками над головой и 75-й процентиль: лучшее, что человек стабильно показывает.
 * MediaPipe занижает крайние углы сгибания плеча, поэтому порог правила взят с запасом.
 */
export function overheadReach(fr) {
  if (fr.length < 10) return {};
  const hy = fr.map(f => (f.p[P.L_HIP].y + f.p[P.R_HIP].y) / 2), base = [...hy].sort((a, b) => a - b)[Math.floor(hy.length * .1)];
  const leg = median(fr.map(f => Math.hypot(f.p[P.L_HIP].x - f.p[P.L_ANKLE].x, f.p[P.L_HIP].y - f.p[P.L_ANKLE].y))) || 1;
  const q75 = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length >= 4 ? v[Math.floor(v.length * .75)] : NaN; };
  const out = {};
  for (const r of [true, false]) {
    const S = r ? P.R_SHOULDER : P.L_SHOULDER, E = r ? P.R_ELBOW : P.L_ELBOW, W = r ? P.R_WRIST : P.L_WRIST;
    const arm = Math.max(...fr.map(f => Math.hypot(f.p[W].x - f.p[S].x, f.p[W].y - f.p[S].y)));
    const top = fr.filter((f, i) => hy[i] - base < .05 * leg && f.p[W].y < f.p[P.NOSE].y && f.p[W].visibility > .5 && f.p[S].visibility > .5);
    const r2 = q75(top.map(f => (f.p[S].y - f.p[W].y) / Math.max(1, arm)));
    const d2 = Number.isFinite(r2) ? Math.acos(Math.max(-1, Math.min(1, r2))) * RAD : NaN;
    const a3 = q75(top.filter(f => f.w).map(f => { const w = f.w, ms = { x: (w[11].x + w[12].x) / 2, y: (w[11].y + w[12].y) / 2, z: (w[11].z + w[12].z) / 2 }, mh = { x: (w[23].x + w[24].x) / 2, y: (w[23].y + w[24].y) / 2, z: (w[23].z + w[24].z) / 2 };
      const t = [ms.x - mh.x, ms.y - mh.y, ms.z - mh.z], u = [w[E].x - w[S].x, w[E].y - w[S].y, w[E].z - w[S].z], n = Math.hypot(...t) * Math.hypot(...u);
      return n ? Math.acos(Math.max(-1, Math.min(1, (t[0] * u[0] + t[1] * u[1] + t[2] * u[2]) / n))) * RAD : NaN; }));
    const d3 = Number.isFinite(a3) ? Math.max(0, a3) : NaN; // угол между «вверх по корпусу» и плечом: 0° = рука ровно вверх
    const v = [d2, d3].filter(Number.isFinite); if (v.length) out['oh_reach_' + (r ? 'r' : 'l')] = v.reduce((a, b) => a + b, 0) / v.length;
  }
  return out;
}

export const Movement = {
  front(fr) { fr = smooth(fr);
    const b = bottoms(fr), st = fr.slice(0, 6), f = {};
    const footOut = (p, r) => { const heel = p[r ? P.R_HEEL : P.L_HEEL], toe = p[r ? P.R_FOOT : P.L_FOOT]; const dx = (toe.x - heel.x) * (r ? -1 : 1);
      return Math.atan2(dx, Math.abs(toe.y - heel.y) + 1e-6 + Math.hypot(toe.x - heel.x, toe.y - heel.y) * .3) * RAD; };
    const shift = p => { const pel = G.mid(p[P.L_HIP], p[P.R_HIP]), ank = G.mid(p[P.L_ANKLE], p[P.R_ANKLE]); return -(pel.x - ank.x) / Math.max(1, Math.abs(p[P.L_HIP].x - p[P.R_HIP].x)); };
    const elbow = (p, r) => 180 - G.angleAt(p[r ? P.R_SHOULDER : P.L_SHOULDER], p[r ? P.R_ELBOW : P.L_ELBOW], p[r ? P.R_WRIST : P.L_WRIST]);
    if (b.length) {
      const bf = b.flatMap(i => around(fr, i));
      f.ohs_valgus_l = median(bf.map(x => F.fppa(x.p, false))); f.ohs_valgus_r = median(bf.map(x => F.fppa(x.p, true)));
      f.ohs_foot_out_l = median(bf.map(x => footOut(x.p, false))) - median(st.map(x => footOut(x.p, false)));
      f.ohs_foot_out_r = median(bf.map(x => footOut(x.p, true))) - median(st.map(x => footOut(x.p, true)));
      f.ohs_shift = median(bf.map(x => shift(x.p))) - median(st.map(x => shift(x.p)));
      f.ohs_elbow_r = median(bf.map(x => elbow(x.p, true))); f.ohs_elbow_l = median(bf.map(x => elbow(x.p, false)));
      // значения по каждому повтору: находка засчитывается, только если видна в большинстве повторов
      const per = fn => b.map(i => median(around(fr, i).map(x => fn(x.p)))), s0 = median(st.map(x => shift(x.p)));
      f.reps = { valgus_l: per(p => F.fppa(p, false)), valgus_r: per(p => F.fppa(p, true)), shift: per(p => shift(p) - s0),
        foot_out_l: per(p => footOut(p, false) - median(st.map(x => footOut(x.p, false)))), foot_out_r: per(p => footOut(p, true) - median(st.map(x => footOut(x.p, true)))) };
    }
    Object.assign(f, overheadReach(fr));
    return res(f, b.length, vis(fr, LEGS));
  },
  side(fr) { fr = smooth(fr);
    const b = bottoms(fr), f = {};
    if (b.length) {
      const bf = b.flatMap(i => around(fr, i));
      const near = p => p[P.R_SHOULDER].visibility + p[P.R_HIP].visibility >= p[P.L_SHOULDER].visibility + p[P.L_HIP].visibility;
      const fwd = p => p[P.NOSE].x >= p[near(p) ? P.R_EAR : P.L_EAR].x ? 1 : -1;
      const trunk = bf.map(x => { const p = x.p, r = near(p); return ang(p[r ? P.R_HIP : P.L_HIP], p[r ? P.R_SHOULDER : P.L_SHOULDER]) * fwd(p); });
      const shin = bf.map(x => { const p = x.p, r = near(p); return ang(p[r ? P.R_ANKLE : P.L_ANKLE], p[r ? P.R_KNEE : P.L_KNEE]) * fwd(p); });
      f.ohs_lean_excess = median(trunk) - median(shin);
      f.ohs_arms_fwd = median(bf.map(x => { const p = x.p, r = near(p); const s = p[r ? P.R_SHOULDER : P.L_SHOULDER], h = p[r ? P.R_HIP : P.L_HIP], w = p[r ? P.R_WRIST : P.L_WRIST]; return (ang(h, s) - ang(s, w)) * fwd(p); }));
      const lift = p => { const r = near(p), heel = p[r ? P.R_HEEL : P.L_HEEL], toe = p[r ? P.R_FOOT : P.L_FOOT]; return (toe.y - heel.y) / Math.max(1, Math.hypot(heel.x - toe.x, heel.y - toe.y)); };
      // отрыв пятки считаем, только если стопа хорошо видна и пятка реально поднялась над исходным положением:
      // один угол стопы дрожит от кадра к кадру и давал ложный «отрыв» при пятках на полу
      const footVis = p => { const r = near(p); return (p[r ? P.R_HEEL : P.L_HEEL].visibility ?? 1) > .6 && (p[r ? P.R_FOOT : P.L_FOOT].visibility ?? 1) > .6; };
      const st = fr.slice(0, 8).filter(x => footVis(x.p)), bv = bf.filter(x => footVis(x.p));
      if (st.length >= 3 && bv.length >= 3) {
        const r0 = near(st[0].p), HL = r0 ? P.R_HEEL : P.L_HEEL, TO = r0 ? P.R_FOOT : P.L_FOOT, HP = r0 ? P.R_HIP : P.L_HIP, AN = r0 ? P.R_ANKLE : P.L_ANKLE;
        const leg = median(st.map(x => Math.hypot(x.p[HP].x - x.p[AN].x, x.p[HP].y - x.p[AN].y))) || 1;
        const h0 = median(st.map(x => x.p[HL].y)), t0 = median(st.map(x => x.p[TO].y));
        // насколько сама пятка поднялась над полом, в долях длины ноги (0,025 ≈ 2 см); носок, «уехавший» вниз, отрывом не считаем
        const rise = median(bv.map(x => ((h0 - x.p[HL].y) - Math.max(0, t0 - x.p[TO].y)) / leg));
        const tilt = median(bv.map(x => lift(x.p))) - median(st.map(x => lift(x.p)));
        f.ohs_heel_lift = rise > .025 ? tilt : Math.min(tilt, 0);
      }
    }
    Object.assign(f, overheadReach(fr));
    return res(f, b.length, vis(fr, [P.R_HIP, P.R_KNEE, P.R_ANKLE, P.R_SHOULDER]));
  },
  back(fr) { fr = smooth(fr);
    const b = bottoms(fr), f = {}, st = fr.slice(0, 6);
    const legs = p => { const a = [p[P.L_HIP], p[P.L_KNEE], p[P.L_ANKLE]], c = [p[P.R_HIP], p[P.R_KNEE], p[P.R_ANKLE]]; return a[0].x < c[0].x ? [a, c] : [c, a]; };
    const valgus = (l, rightLeg) => { const t = Math.max(0, Math.min(1, (l[1].y - l[0].y) / Math.max(1, l[2].y - l[0].y))); const lineX = l[0].x + (l[2].x - l[0].x) * t;
      return Math.atan2((l[1].x - lineX) * (rightLeg ? -1 : 1), Math.hypot(l[2].x - l[1].x, l[2].y - l[1].y)) * RAD; };
    const shift = p => { const [l, r] = legs(p); return ((l[0].x + r[0].x) / 2 - (l[2].x + r[2].x) / 2) / Math.max(1, Math.abs(l[0].x - r[0].x)); };
    const tilt = p => { const [l, r] = legs(p); return Math.atan2(r[0].y - l[0].y, r[0].x - l[0].x) * RAD; };
    if (b.length) {
      const bf = b.flatMap(i => around(fr, i));
      f.back_shift = median(bf.map(x => shift(x.p))) - median(st.map(x => shift(x.p)));
      f.back_valgus_l = median(bf.map(x => valgus(legs(x.p)[0], false))); f.back_valgus_r = median(bf.map(x => valgus(legs(x.p)[1], true)));
      f.back_pelvis_tilt = median(bf.map(x => tilt(x.p))) - median(st.map(x => tilt(x.p)));
      const per = fn => b.map(i => median(around(fr, i).map(x => fn(x.p)))), s0 = median(st.map(x => shift(x.p))), t0 = median(st.map(x => tilt(x.p)));
      f.reps = { valgus_l: per(p => valgus(legs(p)[0], false)), valgus_r: per(p => valgus(legs(p)[1], true)), shift: per(p => shift(p) - s0), pelvis: per(p => tilt(p) - t0) };
    }
    return res(f, b.length, vis(fr, LEGS));
  },
  singleLeg(fr, right) { fr = smooth(fr);
    const b = bottoms(fr, 1.0, 0.04), f = {}, k = right ? 'r' : 'l', st = fr.slice(0, 6);
    if (b.length) {
      const bf = b.flatMap(i => around(fr, i));
      f['sls_valgus_' + k] = median(bf.map(x => F.fppa(x.p, right)));
      const drop = median(bf.map(x => F.pelvicTilt(x.p))) - median(st.map(x => F.pelvicTilt(x.p)));
      f['sls_drop_' + k] = right ? -drop : drop;
      f['sls_trunk_' + k] = median(bf.map(x => F.trunkLateral(x.p))) * (right ? 1 : -1);
      f['sls_depth_' + k] = median(bf.map(x => F.kneeFlexion(x.p, right)));
      const per = fn => b.map(i => median(around(fr, i).map(x => fn(x.p)))), d0 = median(st.map(x => F.pelvicTilt(x.p)));
      f.reps = { ['sls_valgus_' + k]: per(p => F.fppa(p, right)), ['sls_drop_' + k]: per(p => (F.pelvicTilt(p) - d0) * (right ? -1 : 1)), ['sls_trunk_' + k]: per(p => F.trunkLateral(p) * (right ? 1 : -1)) };
    }
    Object.assign(f, balance(fr, right, k));
    return res(f, b.length, vis(fr, [P.L_HIP, P.R_HIP, right ? P.R_KNEE : P.L_KNEE, right ? P.R_ANKLE : P.L_ANKLE]));
  },
};
/** Равновесие на одной ноге за всю запись: раскачка таза (% ширины плеч), доля кадров с руками в стороны (%),
 * сколько раз свободная нога касалась пола. Все это компенсации слабой опоры: средней ягодичной, стопы, мышц корпуса. */
function balance(fr, right, k) {
  if (fr.length < 20) return {};
  const shw = median(fr.map(x => Math.abs(x.p[P.L_SHOULDER].x - x.p[P.R_SHOULDER].x))) || 1;
  const cx = fr.map(x => (x.p[P.L_HIP].x + x.p[P.R_HIP].x) / 2), m = cx.reduce((a, b) => a + b, 0) / cx.length;
  const sway = Math.sqrt(cx.reduce((a, b) => a + (b - m) ** 2, 0) / cx.length) / shw * 100;
  const out = x => [[P.L_SHOULDER, P.L_WRIST], [P.R_SHOULDER, P.R_WRIST]].some(([s, w]) => Math.abs(x.p[w].x - x.p[s].x) > shw * .55 && x.p[w].y > x.p[s].y - shw);
  const arms = fr.filter(out).length / fr.length * 100;
  const leg = median(fr.map(x => Math.abs(x.p[right ? P.R_ANKLE : P.L_ANKLE].y - x.p[right ? P.R_HIP : P.L_HIP].y))) || 1;
  const free = right ? P.L_ANKLE : P.R_ANKLE, stand = right ? P.R_ANKLE : P.L_ANKLE; let touch = 0, down = false, sinceUp = 0;
  for (const x of fr) { const d = (x.p[stand].y - x.p[free].y) / leg; if (!down && d < .05 && sinceUp > 8) { down = true; touch++; } else if (d > .12) { down = false; sinceUp++; } }
  return { ['sls_sway_' + k]: Math.round(sway * 10) / 10, ['sls_arms_' + k]: Math.round(arms), ['sls_touch_' + k]: touch };
}

// ---------- сила и симметрия: левая против правой ----------
const lift = (p, r, leg) => { const heel = p[r ? P.R_HEEL : P.L_HEEL], ank = p[r ? P.R_ANKLE : P.L_ANKLE]; return -(heel.y + ank.y) / 2 / leg; };
Movement.tHold = fr => { fr = smooth(fr);
  // руки в стороны 20 с: угол отведения плеча (бедро-плечо-локоть), в начале и в конце; слабая сторона опускается сильнее
  const ab = (p, r) => G.angleAt(p[r ? P.R_HIP : P.L_HIP], p[r ? P.R_SHOULDER : P.L_SHOULDER], p[r ? P.R_ELBOW : P.L_ELBOW]);
  if (fr.length < 30) return res({}, 0, 0);
  const n = fr.length, a = fr.slice(Math.floor(n * .1), Math.floor(n * .3)), z = fr.slice(Math.floor(n * .75));
  const f = { t_start_r: median(a.map(x => ab(x.p, true))), t_start_l: median(a.map(x => ab(x.p, false))), t_end_r: median(z.map(x => ab(x.p, true))), t_end_l: median(z.map(x => ab(x.p, false))) };
  return res(f, 2, vis(fr, [P.L_SHOULDER, P.R_SHOULDER, P.L_ELBOW, P.R_ELBOW]));
};
Movement.sideBend = fr => { fr = smooth(fr);
  // наклоны в стороны лицом к камере: плюс = наклон вправо человека
  const v = fr.map(x => F.trunkLateral(x.p)); if (v.length < 30) return res({}, 0, 0);
  const sorted = [...v].sort((a, b) => a - b), q = k => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * k)))];
  return res({ bend_r: q(.97), bend_l: -q(.03) }, 2, vis(fr, [P.L_SHOULDER, P.R_SHOULDER, P.L_HIP, P.R_HIP]));
};
Movement.calfRaise = (fr, right) => { fr = smooth(fr);
  // подъемы на носок одной ноги: число подъемов и высота подъема (в долях длины ноги).
  // Тело поднимается целиком, поэтому кроме пятки смотрим на плечи и нос: в широких штанах пятку почти не видно, и раньше 5 подъемов считались как 1
  if (fr.length < 30) return res({}, 0, 0);
  const leg = median(fr.slice(0, 10).map(x => Math.hypot(x.p[P.L_HIP].x - x.p[P.L_ANKLE].x, x.p[P.L_HIP].y - x.p[P.L_ANKLE].y))) || 1;
  const heelOk = median(fr.map(x => Math.min(x.p[right ? P.R_HEEL : P.L_HEEL].visibility ?? 1, x.p[right ? P.R_ANKLE : P.L_ANKLE].visibility ?? 1))) > .6;
  const up = x => -((x.p[P.L_SHOULDER].y + x.p[P.R_SHOULDER].y) / 2 * 2 + x.p[P.NOSE].y) / 3 / leg;
  const h = fr.map(x => heelOk ? (lift(x.p, right, leg) + up(x)) / 2 : up(x));
  const sm = h.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(h.length - 1, i + 2); j++) { s += h[j]; n++; } return s / n; });
  const srt = [...sm].sort((x, y) => x - y), base = srt[Math.floor(srt.length * .15)], top = srt[Math.floor(srt.length * .9)], amp = top - base;
  const k = right ? 'r' : 'l';
  if (!(amp > .012)) return res({ ['calf_reps_' + k]: 0, ['calf_h_' + k]: 0 }, 0, vis(fr, [right ? P.R_ANKLE : P.L_ANKLE, right ? P.R_HEEL : P.L_HEEL]));
  // гистерезис: подъем засчитан, когда сигнал прошел выше 55% размаха, следующий — только после опускания ниже 25%
  const hi = base + amp * .55, lo = base + amp * .25, peaks = []; let isUp = false, best = -1;
  for (let i = 0; i < sm.length; i++) { if (!isUp && sm[i] > hi) { isUp = true; best = i; } else if (isUp) { if (sm[i] > sm[best]) best = i; if (sm[i] < lo) { isUp = false; peaks.push(best); } } }
  if (isUp && best >= 0) peaks.push(best);
  return res({ ['calf_reps_' + k]: peaks.length, ['calf_h_' + k]: peaks.length ? median(peaks.map(i => sm[i] - base)) : 0 }, peaks.length, vis(fr, [right ? P.R_ANKLE : P.L_ANKLE, right ? P.R_HEEL : P.L_HEEL]));
};

// ---------- снимки стойки: одинаково при съемке и при пересчете по сохраненной записи ----------
const medF = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : 0; };
const medU = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length >= 5 ? v[v.length >> 1] : undefined; };
export function standSnapshot(st) {
  if (!st.length) return null;
  return { shoulderTilt: medF(st.map(f => F.shoulderTilt(f.p))), pelvicTilt: medF(st.map(f => F.pelvicTilt(f.p))), headTilt: medF(st.map(f => F.headTilt(f.p))), trunkLateral: medF(st.map(f => F.trunkLateral(f.p))),
    handRotL: medU(st.map(f => F.handRot(f.p, false))), handRotR: medU(st.map(f => F.handRot(f.p, true))) };
}
export function sideSnapshot(sf) {
  if (!sf.length) return null; const sv = sf.map(f => sideView(f.p));
  const out = { headForwardDeg: medF(sv.map(s => s.headForwardDeg)), hipShift: medF(sv.map(s => s.hipShift)), shoulderShift: medF(sv.map(s => s.shoulderShift)), kneeHyperDeg: medF(sv.map(s => s.kneeHyperDeg)) };
  // антропометрия по 3D-точкам (метры модели): пропорции не зависят от расстояния до камеры. Бедро/голень объясняет наклон корпуса в приседе
  const W = sf.filter(f => f.w), d = (w, a, b) => Math.hypot(w[a].x - w[b].x, w[a].y - w[b].y, w[a].z - w[b].z);
  if (W.length >= 5) { const fem = medU(W.map(f => (d(f.w, 23, 25) + d(f.w, 24, 26)) / 2)), tib = medU(W.map(f => (d(f.w, 25, 27) + d(f.w, 26, 28)) / 2)), tr = medU(W.map(f => (d(f.w, 11, 23) + d(f.w, 12, 24)) / 2));
    if (fem > 0 && tib > 0) { out.femurTibia = Math.round(fem / tib * 100) / 100; out.seg = { femur: Math.round(fem * 100), tibia: Math.round(tib * 100), trunk: tr ? Math.round(tr * 100) : null }; } }
  return out;
}
const maxFlex = fr => fr.reduce((m, f) => Math.max(m, F.kneeFlexion(f.p, true), F.kneeFlexion(f.p, false)), 0);
/**
 * Пересчет оценки по сохраненной записи скелета: новая методика применяется к старым тестам без повторной съемки.
 * frames(key) возвращает кадры записи { t, p: [{ x, y, visibility }], w? } или пустой массив.
 */
export function recompute(t, frames) {
  const out = { snapshot: t.snapshot, side: t.side, moves: { ...(t.moves || {}) } };
  const st = frames('stand'); if (st.length) out.snapshot = standSnapshot(st);
  const sd = frames('side_stand'); if (sd.length) out.side = sideSnapshot(sd);
  const keep = (k, r) => { const old = out.moves[k]; if (old && old.alt) r.alt = old.alt; out.moves[k] = r; };
  const fr = { ohs_front: frames('ohs_front'), ohs_side: frames('ohs_side'), ohs_back: frames('ohs_back'), sls_r: frames('sls_r'), sls_l: frames('sls_l'), t_hold: frames('t_hold'), bends: frames('bends'), calf_r: frames('calf_r'), calf_l: frames('calf_l') };
  if (fr.ohs_front.length > 10) { const r = Movement.front(fr.ohs_front); r.f.max_knee_flex = maxFlex(fr.ohs_front); keep('ohs_front', r); }
  if (fr.ohs_side.length > 10) keep('ohs_side', Movement.side(fr.ohs_side));
  if (fr.ohs_back.length > 10) keep('ohs_back', Movement.back(fr.ohs_back));
  if (fr.sls_r.length > 10) keep('sls_r', Movement.singleLeg(fr.sls_r, true));
  if (fr.sls_l.length > 10) keep('sls_l', Movement.singleLeg(fr.sls_l, false));
  if (fr.t_hold.length > 20) keep('t_hold', Movement.tHold(fr.t_hold));
  if (fr.bends.length > 30) keep('side_bend', Movement.sideBend(fr.bends));
  if (fr.calf_r.length > 20) keep('calf_r', Movement.calfRaise(fr.calf_r, true));
  if (fr.calf_l.length > 20) keep('calf_l', Movement.calfRaise(fr.calf_l, false));
  return out;
}

export function features(t) {
  const f = { const_r: 1, const_l: -1 };
  const s = t.snapshot; if (s) { f.shoulder_tilt = s.shoulderTilt; f.pelvic_tilt = s.pelvicTilt; f.head_tilt = s.headTilt; f.trunk_lateral = s.trunkLateral;
    // кисти «костяшками вперед»: среднее двух рук (поворот у обеих рук обычно общий, от сутулых плеч)
    const hr = [s.handRotL, s.handRotR].filter(Number.isFinite); if (hr.length) f.hand_rot = hr.reduce((a, b) => a + b, 0) / hr.length; }
  if (t.side) { f.head_forward = t.side.headForwardDeg; f.knee_hyper = t.side.kneeHyperDeg; f.shoulder_shift = t.side.shoulderShift; f.hip_shift = t.side.hipShift; }
  const g = n => (t.moves[n] && t.moves[n].quality !== 'RETAKE') ? t.moves[n].f : {};
  const of = g('ohs_front'), os = g('ohs_side'), ob = g('ohs_back'), sr = g('sls_r'), sl = g('sls_l');
  const reps = {}, views = {}; // значения по повторам и по ракурсам для проверки устойчивости находок
  const avg = (...v) => { const a = v.filter(x => Number.isFinite(x)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined; };
  const ok = v => Number.isFinite(v) && Math.abs(v) <= 35 ? v : undefined; // больше 35° — сбой трекинга, не берем
  const vr = avg(ok(of.ohs_valgus_r), ok(ob.back_valgus_r)), vl = avg(ok(of.ohs_valgus_l), ok(ob.back_valgus_l));
  if (vr !== undefined && vl !== undefined) { f.valgus_max = Math.max(vr, vl); f.valgus_side = vr >= vl ? 1 : -1;
    // по повторам и по ракурсам для той стороны, где колено уходит сильнее
    const sd = vr >= vl ? 'r' : 'l', fr = (of.reps || {})['valgus_' + sd] || [], br = (ob.reps || {})['valgus_' + sd] || [];
    reps.valgus_max = [...fr, ...br].filter(v => Number.isFinite(v) && Math.abs(v) <= 35);
    const fv = ok(sd === 'r' ? of.ohs_valgus_r : of.ohs_valgus_l), bv = ok(sd === 'r' ? ob.back_valgus_r : ob.back_valgus_l); if (fv !== undefined && bv !== undefined) views.valgus_max = [fv, bv]; }
  const sh = avg(of.ohs_shift, ob.back_shift); if (sh !== undefined) { f.sq_shift = sh; reps.sq_shift = [...((of.reps || {}).shift || []), ...((ob.reps || {}).shift || [])]; if (Number.isFinite(of.ohs_shift) && Number.isFinite(ob.back_shift)) views.sq_shift = [of.ohs_shift, ob.back_shift]; }
  if (Number.isFinite(of.ohs_foot_out_r) && Number.isFinite(of.ohs_foot_out_l)) { f.foot_out_max = Math.max(of.ohs_foot_out_r, of.ohs_foot_out_l); f.foot_out_side = of.ohs_foot_out_r >= of.ohs_foot_out_l ? 1 : -1;
    reps.foot_out_max = (of.reps || {})['foot_out_' + (f.foot_out_side > 0 ? 'r' : 'l')] || []; }
  const put = (k, v) => { if (Number.isFinite(v)) f[k] = v; };
  // длинное бедро относительно голени само по себе дает больший наклон корпуса в приседе: вычитаем ожидаемую часть (не больше 8°), чтобы не винить мышцы
  const ft = t.side && Number.isFinite(t.side.femurTibia) ? t.side.femurTibia : null; if (ft) f.femur_tibia = ft;
  put('sq_lean', Number.isFinite(os.ohs_lean_excess) && ft ? os.ohs_lean_excess - Math.min(8, Math.max(0, (ft - 1.05) * 40)) : os.ohs_lean_excess); put('sq_arms', os.ohs_arms_fwd); put('sq_heel', os.ohs_heel_lift); put('sq_pelvis', ob.back_pelvis_tilt);
  put('sq_depth', Number.isFinite(of.max_knee_flex) && of.max_knee_flex > 0 ? of.max_knee_flex : of.ohs_depth);
  if (t.moves && t.moves.ohs_front && t.moves.ohs_front.alt) f.sq_assisted = 1;
  put('ohs_elbow_r', of.ohs_elbow_r); put('ohs_elbow_l', of.ohs_elbow_l);
  // руки вверх: недостача сгибания плеча, худшая рука и ее сторона (по виду спереди; если его нет — по виду сбоку)
  const rr = Number.isFinite(of.oh_reach_r) ? of.oh_reach_r : os.oh_reach_r, rl = Number.isFinite(of.oh_reach_l) ? of.oh_reach_l : os.oh_reach_l;
  if (Number.isFinite(rr) || Number.isFinite(rl)) { const a = Number.isFinite(rr) ? rr : -1, b = Number.isFinite(rl) ? rl : -1; f.oh_reach = Math.max(a, b); f.oh_reach_side = Math.abs(a - b) < 8 || a < 0 || b < 0 ? 0 : a > b ? 1 : -1; f.sym_reach = Number.isFinite(rr) && Number.isFinite(rl) ? [rl, rr] : undefined; if (!f.sym_reach) delete f.sym_reach; }
  for (const k of ['sls_sway_r', 'sls_arms_r', 'sls_touch_r']) put(k, sr[k]);
  for (const k of ['sls_sway_l', 'sls_arms_l', 'sls_touch_l']) put(k, sl[k]);
  for (const k of ['sls_valgus_r', 'sls_drop_r', 'sls_trunk_r']) { put(k, k.includes('valgus') ? ok(sr[k]) : sr[k]); if (sr.reps && sr.reps[k]) reps[k] = sr.reps[k]; }
  for (const k of ['sls_valgus_l', 'sls_drop_l', 'sls_trunk_l']) { put(k, k.includes('valgus') ? ok(sl[k]) : sl[k]); if (sl.reps && sl.reps[k]) reps[k] = sl.reps[k]; }
  if (ob.reps && ob.reps.pelvis) reps.sq_pelvis = ob.reps.pelvis;
  const th = g('t_hold'), sb = g('side_bend'), cr = g('calf_r'), cl = g('calf_l');
  // дельтовидная: насколько рука опустилась к концу удержания; плюс = правая опустилась сильнее
  if (Number.isFinite(th.t_end_r)) { const dr = th.t_start_r - th.t_end_r, dl = th.t_start_l - th.t_end_l; put('asym_delt', (dr - dl) + (th.t_end_l - th.t_end_r) * .5); f.sym_delt = [th.t_end_l, th.t_end_r]; }
  // наклоны: меньше наклон вправо = зажат левый бок (квадратная поясницы, широчайшая слева); плюс = вправо наклон меньше
  if (Number.isFinite(sb.bend_r)) { put('asym_bend', sb.bend_l - sb.bend_r); f.sym_bend = [sb.bend_l, sb.bend_r]; put('bend_sum', sb.bend_l + sb.bend_r); }
  // икры: меньше подъемов или ниже пятка; плюс = правая слабее
  if (Number.isFinite(cr.calf_reps_r) && Number.isFinite(cl.calf_reps_l)) { const sr2 = cr.calf_reps_r * (1 + cr.calf_h_r * 10), sl2 = cl.calf_reps_l * (1 + cl.calf_h_l * 10);
    put('asym_calf', (sl2 - sr2) / Math.max(1, Math.max(sl2, sr2)) * 100); f.sym_calf = [cl.calf_reps_l, cr.calf_reps_r]; }
  // сколько подъемов на носок за 15 секунд на каждой ноге: прямой тест силы икры
  put('calf_reps_l', cl.calf_reps_l); put('calf_reps_r', cr.calf_reps_r);
  // передняя поверхность бедра: на одной ноге приседаешь мельче той ногой, что слабее; плюс = правая мельче
  if (Number.isFinite(sr.sls_depth_r) && Number.isFinite(sl.sls_depth_l)) { put('asym_quad', sl.sls_depth_l - sr.sls_depth_r); f.sym_quad = [sl.sls_depth_l, sr.sls_depth_r]; }
  // признаки из шагов с плохой съемкой (качество ниже 60 или один повтор): слабые находки по ним не показываем, см. findings()
  const Q = t.quality || {}, low = k => (Q[k] != null && Q[k] < 60) || (t.moves && t.moves[k] && t.moves[k].quality === 'DOUBTFUL');
  const LQ = { stand: ['shoulder_tilt', 'pelvic_tilt', 'head_tilt', 'trunk_lateral', 'hand_rot'], side_stand: ['head_forward', 'knee_hyper', 'shoulder_shift', 'hip_shift'],
    ohs_front: ['valgus_max', 'sq_shift', 'foot_out_max', 'sq_depth', 'oh_reach'], ohs_back: ['valgus_max', 'sq_shift', 'sq_pelvis'], ohs_side: ['sq_lean', 'sq_arms', 'sq_heel'],
    sls_r: ['sls_valgus_r', 'sls_drop_r', 'sls_trunk_r', 'sls_sway_r', 'sls_arms_r', 'sls_touch_r', 'asym_quad'], sls_l: ['sls_valgus_l', 'sls_drop_l', 'sls_trunk_l', 'sls_sway_l', 'sls_arms_l', 'sls_touch_l', 'asym_quad'], t_hold: ['asym_delt'], bends: ['asym_bend', 'bend_sum'], calf_r: ['asym_calf', 'calf_reps_r'], calf_l: ['asym_calf', 'calf_reps_l'] };
  const lowq = {}; for (const [k, fs] of Object.entries(LQ)) if (low(k)) for (const x of fs) lowq[x] = true;
  if (Object.keys(lowq).length) f.lowq = lowq;
  if (Object.keys(reps).length) f._reps = reps; if (Object.keys(views).length) f._views = views;
  return f;
}

const sideWord = (s, form) => {
  if (s === 'BOTH') return ({ where: 'с обеих сторон', leg: 'ноги', dir: 'в сторону' })[form] || 'одной';
  const R = s === 'RIGHT';
  return ({ leg: R ? 'правой ноги' : 'левой ноги', where: R ? 'справа' : 'слева', adjF: R ? 'правая' : 'левая', adjN: R ? 'правое' : 'левое', dir: R ? 'вправо' : 'влево', gen: R ? 'правой' : 'левой', key: R ? 'right' : 'left' })[form];
};
const opp = s => s === 'LEFT' ? 'RIGHT' : s === 'RIGHT' ? 'LEFT' : 'BOTH';
function render(text, s, v) {
  let r = text;
  for (const f of ['where', 'adjF', 'adjN', 'dir', 'gen', 'leg']) r = r.split(`{side.${f}}`).join(sideWord(s, f)).split(`{opp.${f}}`).join(sideWord(opp(s), f));
  return r.split('{abs}').join(fmt(v)).split('{value}').join(fmt(v));
}
export function findings(rules, f) {
  const out = [];
  for (const r of rules) {
    const v = f[r.feature]; if (v === undefined || !Number.isFinite(v)) continue;
    if ((r.requires || []).some(k => f[k] === undefined)) continue;
    const hit = (r.absGreater == null || Math.abs(v) > r.absGreater) && (r.greater == null || v > r.greater) && (r.less == null || v < r.less);
    if (!hit) continue;
    // разница с порогом меньше погрешности измерения — «на границе нормы»: слабее и с пометкой, чтобы повторные тесты не «прыгали»
    const thr = r.absGreater != null ? r.absGreater : r.greater != null ? r.greater : r.less != null ? r.less : null, at = thr != null ? Math.abs(thr) : 0;
    const unit = at < 1 ? .03 : at >= 12 ? 3 : 1.5, gap = r.absGreater != null ? Math.abs(v) - thr : r.greater != null ? v - thr : thr != null ? thr - v : 0;
    let borderline = thr != null && gap < Math.max(unit, at * .12);
    // плохая съемка: находки на границе или с порогом до 5° (уровень погрешности одной камеры) скорее шум
    // плохая съемка: находка на границе отбрасывается, а с малым порогом (до 5°, уровень погрешности камеры) остается, но с пометкой «на границе»
    if (f.lowq && f.lowq[r.feature]) { if (borderline) continue; if (at <= 5) borderline = true; }
    // голосование по повторам: признак должен быть виден в большинстве повторов (от 3 повторов). Меньше 40% — шум, 40–60% — на границе
    const passV = x => (r.absGreater == null || Math.abs(x) > r.absGreater) && (r.greater == null || x > r.greater) && (r.less == null || x < r.less);
    const rv = f._reps && f._reps[r.feature] && f._reps[r.feature].filter(Number.isFinite);
    let vote = null; if (rv && rv.length >= 3) { vote = rv.filter(passV).length / rv.length; if (vote < .4) continue; if (vote < .6) borderline = true; }
    // два ракурса (спереди и сзади): если один показывает признак, а другой нет даже наполовину порога — на границе
    const vw = f._views && f._views[r.feature]; if (vw && thr != null && !(passV(vw[0]) && passV(vw[1])) && Math.min(Math.abs(vw[0]), Math.abs(vw[1])) < at * .5) borderline = true;
    let side = 'BOTH';
    if (r.sideFrom) { const sv = f[r.sideFrom]; if (sv === undefined) continue; const sg = Math.sign(sv) * (r.sideNegate ? -1 : 1); side = sg > 0 ? 'RIGHT' : sg < 0 ? 'LEFT' : 'BOTH'; }
    // w: вклад мышцы в признак по данным литературы (1 — основная причина, меньше — второстепенная)
    const muscles = r.muscles.map(m => ({ id: m.id, state: m.state, w: Number.isFinite(m.w) ? m.w : 1, side: m.side === 'same' ? side : m.side === 'opposite' ? opp(side) : 'BOTH' }));
    const ex = r.exercises.map(e => e.split('{side}').join(side === 'BOTH' ? 'left' : sideWord(side, 'key')).split('{opp}').join(side === 'BOTH' ? 'right' : sideWord(opp(side), 'key')));
    out.push({ rule: r, value: v, side, borderline, vote, observed: render(r.observed, side, v) + (borderline ? ' (на границе нормы)' : ''), meaning: render(r.meaning, side, v), muscles, exercises: ex });
  }
  return out.sort((a, b) => (b.rule.priority || 0) - (a.rule.priority || 0));
}
function strength(fd) { const r = fd.rule, v = Math.abs(fd.value);
  // для правил «меньше порога»: при положительном пороге (глубина 70°) сила = порог / значение, при отрицательном (-0,02) = |значение| / |порог|
  const ratio = r.absGreater != null ? v / r.absGreater : r.greater != null ? v / r.greater : r.less != null ? (r.less > 0 ? (v > 1e-6 ? r.less / v : 2) : (Math.abs(r.less) > 1e-9 ? v / Math.abs(r.less) : 2)) : 2;
  return Math.max(.45, Math.min(1, .45 + .55 * (ratio - 1))); }
export function tones(fds, catalog, antagonists) {
  const pos = new Map(), neg = new Map(), src = new Map(), key = (id, s) => id + ':' + s;
  // прямой тест мышцы (подъемы на носок для икры) важнее косвенных признаков из приседа: они не могут перевернуть его вывод
  const dPos = new Set(), dNeg = new Set();
  // ослабление слабых и пограничных признаков было слишком сильным (×0,6 и ×0,5, вместе ×0,3): одиночный признак пропадал с карты
  for (const fd of fds) { const s = strength(fd) * (fd.rule.weak ? .85 : 1) * (fd.borderline ? .85 : 1);
    for (const m of fd.muscles) for (const sd of (m.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [m.side])) { const k = key(m.id, sd), sm = s * (m.w ?? 1);
      // источник: какие независимые признаки (правила) указали на мышцу; пограничные в доказательства цепей не идут
      if (!fd.borderline) { if (!src.has(k)) src.set(k, new Set()); src.get(k).add(fd.rule.id + (fd.rule.feature || '')); }
      if (fd.rule.direct && !fd.borderline) (m.state === 'WEAK' ? dNeg : dPos).add(k);
      if (m.state === 'WEAK') neg.set(k, Math.min(1, (neg.get(k) || 0) + sm)); else pos.set(k, Math.min(1, (pos.get(k) || 0) + sm)); } }
  for (const k of dNeg) if (!dPos.has(k)) pos.delete(k);
  for (const k of dPos) if (!dNeg.has(k)) neg.delete(k);
  const t = new Map(), ambiguous = new Set();
  for (const k of new Set([...pos.keys(), ...neg.keys()])) { const p = pos.get(k) || 0, n = neg.get(k) || 0;
    if (p > .3 && n > .3) { ambiguous.add(k); t.set(k, 0); } else t.set(k, p - n); }
  // реципрокное торможение (Janda) — гипотеза: антагонист перегруженной мышцы помечаем «возможно слабым», мягко
  const derived = new Set();
  for (const [k, v] of [...t]) { const [id, sd] = k.split(':'); const ant = antagonists[id]; if (!ant) continue; const ak = key(ant, sd);
    if (v > .6 && Math.abs(t.get(ak) || 0) <= .25 && !ambiguous.has(ak)) { t.set(ak, -Math.min(.5, .3 + .2 * ((v - .6) / .4))); derived.add(ak); } }
  const out = []; for (const id of catalog) for (const sd of ['LEFT', 'RIGHT']) { const k = key(id, sd); out.push({ id, side: sd, tone: t.get(k) || 0, derived: derived.has(k), ambiguous: ambiguous.has(k), src: derived.has(k) ? [] : [...(src.get(k) || [])] }); }
  return out;
}
export function chains(defs, tn, triggers) {
  const own = new Map(tn.filter(x => !x.derived).map(x => [x.id + ':' + x.side, x.tone]));
  const srcOf = new Map(tn.filter(x => !x.derived).map(x => [x.id + ':' + x.side, x.src || []]));
  const out = [];
  for (const c of defs) for (const side of (c.lateral ? ['LEFT', 'RIGHT'] : ['BOTH'])) {
    const sideOf = m => (side === 'BOTH' || (m.rel || 'same') === 'same') ? side : opp(side);
    const tone = m => { const s = sideOf(m); if (s === 'BOTH') { const a = own.get(m.id + ':LEFT') || 0, b = own.get(m.id + ':RIGHT') || 0; return Math.abs(a) >= Math.abs(b) ? a : b; } return own.get(m.id + ':' + s) || 0; };
    const exp = m => m.state === 'WEAK' ? -1 : 1;
    const evM = c.members.filter(m => Math.abs(tone(m)) > .25 && tone(m) * exp(m) > 0);
    const ev = evM.map(m => m.id);
    const contra = c.members.filter(m => Math.abs(tone(m)) > .25 && tone(m) * exp(m) < 0).length;
    // доказательство = число разных измеренных признаков, а не число мышц одного правила: одно наблюдение считается один раз
    const rules = new Set(); for (const m of evM) { const s = sideOf(m); for (const sd of (s === 'BOTH' ? ['LEFT', 'RIGHT'] : [s])) for (const r of (srcOf.get(m.id + ':' + sd) || [])) rules.add(r); }
    const trig = (c.triggers || []).filter(x => triggers.has(x) && x.startsWith('CHAIN_'));
    const n = rules.size + trig.length - contra;
    // цепь, если ее подтверждают хотя бы два разных признака и треть звеньев. Раньше требовалась половина:
    // в верхнем перекрестном синдроме (11 звеньев) это 6 мышц, и цепь с грудными почти никогда не находилась
    if (rules.size < 2 || evM.length < Math.max(2, Math.ceil(c.members.length * .3)) || n < (c.minEvidence || 2)) continue;
    out.push({ chain: c, side, score: Math.max(0, Math.min(1, n / (c.members.length + 2))), evidence: ev, inferred: c.members.filter(m => !ev.includes(m.id) && Math.abs(tone(m)) <= .25).map(m => m.id) });
  }
  return out.sort((a, b) => b.score - a.score);
}
export function applyInferred(tn, act) {
  const map = new Map(tn.map(x => [x.id + ':' + x.side, { ...x }]));
  for (const a of act) { const v = .28 + .15 * a.score;
    for (const id of a.inferred) { const mem = a.chain.members.find(m => m.id === id);
      const own = (a.side === 'BOTH' || (mem.rel || 'same') === 'same') ? a.side : opp(a.side);
      for (const s of (own === 'BOTH' ? ['LEFT', 'RIGHT'] : [own])) { const k = id + ':' + s, cur = map.get(k) || { id, side: s, tone: 0 };
        if (Math.abs(cur.tone) <= .25 && !cur.ambiguous) map.set(k, { id, side: s, tone: mem.state === 'WEAK' ? -v : v, derived: true, byChain: a.chain.name }); } } }
  return [...map.values()];
}
export function analyze(test, C) {
  const f = features(test);
  const fds = findings(C.bodymap.rules, f);
  const triggers = new Set(); // в доказательства цепей идут только цепи-триггеры CHAIN_*, отдельный признак засчитывается один раз через правила
  const ants = Object.fromEntries(Object.entries(C.muscles).filter(([, m]) => m.antagonist).map(([k, m]) => [k, m.antagonist]));
  const base = tones(fds, Object.keys(C.muscles), ants);
  for (const a of chains(C.chains, base, triggers)) triggers.add('CHAIN_' + a.chain.id);
  const act = chains(C.chains, base, triggers);
  return { f, findings: fds, chains: act, tones: applyInferred(base, act) };
}

// ---------- калибровка: сверка оценки специалиста с ответом приложения ----------
/** labels: [{muscle|id, side: LEFT|RIGHT|BOTH, state|k: HYPER|SHORT|WEAK}], tones: из analyze(), rules: правила базы.
 *  Направление: HYPER и SHORT — «повышен тонус» (+1), WEAK — «слабая» (−1). Учитываем только измеренные гипотезы приложения, без выведенных.
 *  Итог по каждой отметке специалиста: match — совпало, side — та же мышца и направление, но другая сторона, opposite — противоположное направление,
 *  missed — приложение не увидело, хотя тест это измеряет, notMeasured — ни одно правило теста эту мышцу не затрагивает.
 *  extra — гипотезы приложения по мышцам, которых специалист не отмечал вовсе. */
export function calibCompare(labels, tones, rules) {
  const measurable = new Set(rules.flatMap(r => r.muscles.map(m => m.id)));
  const app = tones.filter(t => Math.abs(t.tone) > .25 && !t.derived).map(t => ({ id: t.id, side: t.side, dir: t.tone > 0 ? 1 : -1, tone: Math.round(t.tone * 100) / 100 }));
  const exp = labels.flatMap(l => (l.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [l.side]).map(s => ({ id: l.muscle || l.id, side: s, dir: (l.state || l.k) === 'WEAK' ? -1 : 1 })));
  const rows = exp.map(e => { const a = app.find(x => x.id === e.id && x.side === e.side);
    const res = a ? (a.dir === e.dir ? 'match' : 'opposite') : app.some(x => x.id === e.id && x.dir === e.dir) ? 'side' : measurable.has(e.id) ? 'missed' : 'notMeasured';
    return { ...e, res, app: a ? a.tone : null }; });
  const extra = app.filter(a => !exp.some(e => e.id === a.id));
  const counts = { expert: rows.length, app: app.length, extra: extra.length };
  for (const r of rows) counts[r.res] = (counts[r.res] || 0) + 1;
  return { rows, extra, counts };
}
