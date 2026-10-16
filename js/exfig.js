// Анимированные схемы упражнений: фигура из суставов плавно переходит из исходного положения в конечное.
// Чистый SVG с анимацией SMIL: без видео и сети, одинаковый стиль во всех упражнениях, работает и в превью списка.
// Углы в градусах экрана: 0 вправо, 90 вниз, -90 вверх, 180 влево. Пол на y = 152, кадр 200×160.
const L = { tr: 46, ua: 26, fa: 24, th: 36, sh: 34, ft: 11, head: 9 };
const G = 152;
const R = Math.PI / 180, dir = a => [Math.cos(a * R), Math.sin(a * R)];
const add = (p, a, l) => { const [x, y] = dir(a); return [p[0] + x * l, p[1] + y * l]; };

// исходные позы; упражнения меняют только нужные поля
const STAND = { v: 'side', hx: 100, hy: 79, t: -90, hd: -90, aN1: 92, aN2: 92, aF1: 88, aF2: 88, lN1: 90, lN2: 90, lN3: 0, lF1: 90, lF2: 90, lF3: 0 };
// спереди: N — рука и нога слева на экране, F — справа
const FRONT = { ...STAND, v: 'front', aN1: 100, aN2: 95, aF1: 80, aF2: 85, lN1: 94, lN2: 90, lN3: 120, lF1: 86, lF2: 90, lF3: 60 };
const SUPINE = { v: 'side', hx: 115, hy: 144, t: 180, hd: 180, aN1: 2, aN2: 0, aF1: 4, aF2: 2, lN1: -60, lN2: 70, lN3: 0, lF1: -56, lF2: 72, lF3: 0 };
const PRONE = { v: 'side', face: 90, hx: 115, hy: 144, t: 180, hd: 182, aN1: 2, aN2: 0, aF1: 4, aF2: 2, lN1: 0, lN2: 0, lN3: 80, lF1: 2, lF2: 0, lF3: 80 };
const SIDE = { v: 'side', hx: 120, hy: 146, t: 180, hd: 178, aN1: 8, aN2: 12, aF1: 182, aF2: 182, lN1: 0, lN2: 0, lN3: -90, lF1: 2, lF2: 0, lF3: -90 };
const QUAD = { v: 'side', hx: 82, hy: 112, t: -18, hd: -10, aN1: 90, aN2: 90, aF1: 88, aF2: 90, lN1: 90, lN2: 180, lN3: 180, lF1: 92, lF2: 180, lF3: 180 };

// hl: подсветка рабочей зоны (сустав или середина сегмента); props: стена, валик, стул, полотенце, проем
const EX = {
  ex_thoracic_open_book: { a: { ...SIDE, view: 'top', hy: 70, hx: 125, aN1: 88, aN2: 88, aF1: 92, aF2: 92, lN1: 80, lN2: 10, lN3: 90, lF1: 84, lF2: 12, lF3: 90 },
    m: { kA: .2, aN1: 10, aN2: 10 }, b: { aN1: -90, aN2: -90 }, hl: 'chest' },
  ex_neck_rotation: { a: { ...FRONT, nose: 0 }, b: { nose: .85 }, hl: 'neck' },
  ex_side_stretch: { a: { ...FRONT }, b: { t: -78, aF1: -70, aF2: -55, hx: 96 }, hl: 'side' },
  ex_ql_stretch: { a: { ...FRONT }, b: { t: -74, aF1: -60, aF2: -40, hx: 94, lF1: 100 }, hl: 'side' },
  ex_glute_bridge: { a: { ...SUPINE, legAt: 1 }, b: { hy: 124, t: 154 }, hl: 'hip' },
  ex_side_plank_knees: { a: { ...SIDE, hx: 120, hy: 146, t: 208.6, hd: 205, aN1: 90, aN2: 180, aF1: 92, aF2: 182, lN1: 3, lN2: 160, kS: .35, lF1: 4, lF2: 160, lN3: 160, lF3: 160 },
    b: { hx: 121.6, hy: 137.2, t: 197.4, hd: 195, lN1: 17.4, lF1: 18.4 }, hl: 'side' },
  // ракушка: лежа на боку, колени согнуты, стопы вместе; верхнее колено поднимается, стопы не расходятся (вид спереди, бедра чуть в перспективе)
  ex_clamshell: { a: { ...SIDE, hy: 146, kS: .8, lN1: -34, lN2: 42, lN3: 0, lF1: -34, lF2: 42, lF3: 0, aN1: 8, aN2: 12, aF1: 182, aF2: 182, footFree: 1 }, b: { lN1: -74, kT: .9 }, hl: 'hip' },
  ex_ankle_mob: { a: { ...STAND, hx: 92, hy: 110, lN1: -8, lN2: 80, lN3: 40, lF1: 2, lF2: 90, lF3: 0, aN1: 70, aN2: 20, aF1: 70, aF2: 20, props: ['chair'] }, b: { lN3: -30 }, hl: 'ankle' },
  ex_hip_flexor_stretch: { a: { ...STAND, hx: 90, hy: 113, lN1: 80, lN2: 105, lN3: 0, lF1: 108, lF2: 178, lF3: 175, footAt: [140, 149], aN1: 70, aN2: 30, aF1: 70, aF2: 30 },
    b: { hx: 101, hy: 118, lF1: 125 }, hl: 'hipfront' },
  ex_upper_trap_stretch: { a: { ...FRONT }, b: { hd: -118, aN1: -120, aN2: -20 }, hl: 'neck' },
  ex_scalene_stretch: { a: { ...STAND, aN1: 60, aN2: -150 }, b: { hd: -128 }, hl: 'neck' },
  ex_chin_tuck: { a: { ...STAND, ho: 5 }, b: { ho: -3 }, hl: 'neck' },
  ex_doorway_pec_stretch: { a: { ...STAND, hx: 92, aN1: 0, aN2: -90, aF1: 2, aF2: -88, props: ['door'] }, b: { hx: 100, t: -80, aN1: 25, aN2: -70 }, hl: 'chest' },
  // лежа на животе, вид сбоку: руки вытянуты вперед за голову и приподнимаются от пола
  ex_y_raise: { a: { ...PRONE, aN1: 182, aN2: 182, aF1: 184, aF2: 184 }, b: { aN1: 196, aN2: 196, aF1: 198, aF2: 198 }, hl: 'upperback' },
  ex_hamstring_stretch: { a: { ...SUPINE, lF1: 0, lF2: 0, lF3: -90, aN1: -40, aN2: -10, props: ['towel'] }, b: { lN1: -82, lN2: -82, lN3: -170, aN1: -70, aN2: -75 }, hl: 'thighback' },
  ex_cat_cow: { a: { ...QUAD, c: 7, hd: -40 }, b: { c: -9, hd: 72 }, hl: 'upperback' },
  ex_dead_bug: { a: { ...SUPINE, aN1: -90, aN2: -90, aF1: -88, aF2: -88, lN1: -90, lN2: 0, lF1: -88, lF2: 2, lN3: -90, lF3: -88 }, b: { aN1: 176, aN2: 176, lF1: -12, lF2: -12, lF3: -100 }, hl: 'core' },
  ex_side_lying_abduction: { a: { ...SIDE, lN3: -60, lF3: -60 }, b: { lN1: -28, lN2: -28, lN3: -88 }, hl: 'hip' },
  ex_wall_slide: { a: { ...FRONT, aN1: 200, aN2: -90, aF1: -20, aF2: -90 }, b: { aN1: -118, aN2: -114, aF1: -62, aF2: -66 }, hl: 'upperback' },
  ex_lat_activation: { a: { ...FRONT, aN1: -110, aN2: -100, aF1: -70, aF2: -80, props: ['towelh'] }, b: { aN1: 150, aN2: -85, aF1: 30, aF2: -95 }, hl: 'lats' },
  ex_thoracic_extension: { a: { ...SUPINE, hx: 120, hy: 142, t: 194, hd: 196, aN1: -150, aN2: 20, aF1: -152, aF2: 20, props: ['roller'] }, b: { t: 176, hd: 168 }, hl: 'upperback' },
  ex_posterior_tilt: { a: { ...SUPINE, c: 4 }, b: { c: -3, hy: 145 }, hl: 'core' },
  ex_glute_set: { a: { ...PRONE }, b: { hy: 142 }, hl: 'hip', pulse: 1 },
  ex_glute_prone_lift: { a: { ...PRONE }, b: { lN1: -16, lN2: -16, lN3: 70 }, hl: 'hip' },
  ex_glute_med_wall: { a: { ...FRONT, hx: 92, props: ['wallL'] }, b: { lN1: 110, kT: .5, lN2: 92, hx: 88 }, hl: 'hip' },
  // подъем на носок одной ноги у стены: опорная нога ближняя, дальняя согнута назад, кисти на стене
  ex_calf_raise: { a: { ...STAND, hx: 112, hy: 82, lF1: 92, lF2: 140, lF3: 165, handAt: [152, 62], props: ['wallR'] }, b: { hy: 75, lN3: 34 }, hl: 'calf' },
  ex_deep_neck_nod: { a: { ...SUPINE }, b: { hd: 196 }, hl: 'neck' },
  ex_triceps_wall_push: { a: { ...STAND, hx: 96, hy: 82, t: -70, lN1: 105, lN2: 105, lF1: 103, lF2: 103, lN3: -20, lF3: -20, handAt: [150, 52], props: ['wallR'] }, b: { hx: 106, hy: 86, t: -60 }, hl: 'arm' },
  // схемы теста (на экране камеры, пока звучит объяснение)
  // присед с руками вверх: стопы на месте, таз назад и вниз, корпус наклоняется, руки остаются над головой
  test_squat: { a: { ...STAND, legAt: 1, aN1: -96, aN2: -96, aF1: -94, aF2: -94 }, b: { hx: 82, hy: 114, t: -58, hd: -50, aN1: -72, aN2: -72, aF1: -70, aF2: -70 }, hl: 'hip' },
  // одна нога: вторая согнута, стопа отведена назад; руки на поясе; неглубокий присед на опорной ноге
  test_sls: { a: { ...STAND, footAt: [100, 149], lF1: 94, lF2: 196, lF3: 250, aN1: 112, aN2: -25, aF1: 110, aF2: -27 }, b: { hx: 94, hy: 91, t: -80, lF1: 99, lF2: 200 }, hl: 'hip' },
};

// двухзвенная обратная кинематика: колено или локоть так, чтобы стопа или кисть попали в точку
function ik(base, target, a, b, bend) {
  const dx = target[0] - base[0], dy = target[1] - base[1], d = Math.min(Math.hypot(dx, dy), a + b - .01);
  const al = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))) / R, ang = Math.atan2(dy, dx) / R + bend * al;
  const j = add(base, ang, a); return [j, add(j, Math.atan2(target[1] - j[1], target[0] - j[0]) / R, b)];
}
// суставы позы
function joints(p, ref) {
  const H = [p.hx, p.hy], S = add(H, p.t, L.tr), front = p.v === 'front';
  const perp = front ? dir(p.t + 90) : [0, 0], off = (P, k) => [P[0] + perp[0] * k, P[1] + perp[1] * k];
  const sN = off(S, -13), sF = off(S, 13), hN = off(H, -8), hF = off(H, 8);
  const head = add(S, p.hd, 18 + (p.ho || 0) * 0); const hc = [head[0] + (p.ho || 0), head[1]];
  const kA = p.kA ?? 1, kT = p.kT ?? 1, kS = p.kS ?? 1;
  const arm = (s, a1, a2, k) => { const e = add(s, a1, L.ua * k); return [s, e, add(e, a2, L.fa * k)]; };
  const leg = (h, l1, l2, l3, kt) => { const k = add(h, l1, L.th * kt), an = add(k, l2, L.sh * kS); return [h, k, an, add(an, l3, L.ft)]; };
  let aN = arm(sN, p.aN1, p.aN2, kA), aF = arm(sF, p.aF1, p.aF2, 1), lN = leg(hN, p.lN1, p.lN2, p.lN3, kT), lF = leg(hF, p.lF1, p.lF2, p.lF3, 1);
  // фиксированные опоры из исходной позы: стопы на полу, кисти на стене
  if (ref && ref.legAt) { const fix = (h, r, s) => { const [k, an] = ik(h, r[2], L.th, L.sh, s); return [h, k, an, add(an, 0, L.ft)]; }; lN = fix(hN, ref.lN, -1); lF = fix(hF, ref.lF, -1); }
  if (ref && ref.footAt) { const [k, an] = ik(hN, ref.footAt, L.th, L.sh, -1); lN = [hN, k, an, add(an, 0, L.ft)]; }
  // стопа стоит на месте, голень тянется за коленом (поворот бедра наружу в перспективе)
  if (ref && ref.footFree) { const k = add(hN, p.lN1, L.th * kT), an = ref.lN[2]; lN = [hN, k, an, add(an, ref.lN3 ?? 0, L.ft)]; }
  if (ref && ref.footN) { const [k, an] = ik(hN, ref.lN[2], L.th, L.sh, 1); lN = [hN, k, an, add(an, ref.lN3 ?? 140, L.ft)]; }
  if (ref && ref.handAt) { const t = ref.handAt; const [e, w] = ik(sN, t, L.ua, L.fa, 1); aN = [sN, e, w]; const [e2, w2] = ik(sF, [t[0] - 2, t[1] + 4], L.ua, L.fa, 1); aF = [sF, e2, w2]; }
  return { H, S, hc, aN, aF, lN, lF, c: p.c || 0, nose: p.nose || 0, front, face: p.face ?? p.hd + 90 };
}
const lerp = (a, b, k) => a + (b - a) * k;
function mix(a, b, k) { const o = { ...a }; for (const key in b) if (typeof b[key] === 'number' && typeof a[key] === 'number') o[key] = lerp(a[key], b[key], k); else o[key] = b[key]; return o; }

const f1 = n => n.toFixed(1);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]) || 1, nrm = v => { const l = len(v); return [v[0] / l, v[1] / l]; };
// дуга вокруг точки: фиксированное число вершин, чтобы кадры анимации имели одинаковую структуру пути
const arc = (c, r, a0, a1, n = 5) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (n - 1); return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]; });
/** «Трубка» вдоль точек с переменной толщиной: конечности и туловище с формой, а не палочки. */
function tube(pts, radii) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) { const d = nrm(sub(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)])), no = [-d[1], d[0]], r = radii[i];
    L.push([pts[i][0] + no[0] * r, pts[i][1] + no[1] * r]); R.push([pts[i][0] - no[0] * r, pts[i][1] - no[1] * r]); }
  const dE = nrm(sub(pts[n - 1], pts[n - 2])), aE = Math.atan2(dE[1], dE[0]), dS = nrm(sub(pts[1], pts[0])), aS = Math.atan2(dS[1], dS[0]);
  const all = [...L, ...arc(pts[n - 1], radii[n - 1], aE - Math.PI / 2, aE + Math.PI / 2), ...R.reverse(), ...arc(pts[0], radii[0], aS + Math.PI / 2, aS + 3 * Math.PI / 2)];
  return 'M' + all.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
}
const seg = (a, b, ra, rb) => tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], [ra, (ra + rb) / 2, rb]);
function spine(j, n = 6) { const [hx, hy] = j.H, [sx, sy] = j.S, mx = (hx + sx) / 2, my = (hy + sy) / 2, l = Math.hypot(sx - hx, sy - hy) || 1, nx = -(sy - hy) / l, ny = (sx - hx) / l;
  const cx = mx + nx * j.c * 2, cy = my + ny * j.c * 2;
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1), u = 1 - t; return [u * u * hx + 2 * u * t * cx + t * t * sx, u * u * hy + 2 * u * t * cy + t * t * sy]; }); }
function hlPoint(j, hl) {
  const mid = (a, b, k = .5) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return ({ hip: mid(j.H, j.lN[1], .2), hipfront: mid(j.H, j.lF[1], .25), chest: mid(j.H, j.S, .78), side: mid(j.H, j.S, .45), core: mid(j.H, j.S, .3),
    upperback: mid(j.H, j.S, .8), lats: mid(j.H, j.S, .65), neck: mid(j.S, j.hc, .45), thighback: mid(j.lN[0], j.lN[1], .55), ankle: j.lN[2], calf: mid(j.lN[1], j.lN[2], .4), arm: mid(j.aN[0], j.aN[1], .6) })[hl] || j.H;
}
// кадры анимации: углы интерполируются по дуге, поэтому конечности не «сжимаются» на полпути
function frames(spec, n = 6) {
  const A = { kA: 1, kT: 1, kS: 1, c: 0, ho: 0, nose: 0, ...spec.a }, B = mix(A, spec.b, 1), M = spec.m ? mix(mix(A, B, .5), spec.m, 1) : null, out = [];
  const jA = joints(A), ref = { ...A, lN: jA.lN, lF: jA.lF }; // опоры берем из исходной позы
  for (let i = 0; i <= n; i++) { const k = (1 - Math.cos(Math.PI * i / n)) / 2; let p;
    if (M) p = k < .5 ? mix(A, M, k * 2) : mix(M, B, (k - .5) * 2); else p = mix(A, B, k);
    out.push(joints(p, ref)); }
  return out;
}

const PROPS = {
  chair: c => `<path d="M70 113 H112 M74 113 V152 M108 113 V152" stroke="${c.prop}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  door: c => `<path d="M124 6 V152" stroke="${c.prop}" stroke-width="6" stroke-linecap="round"/>`,
  wallL: c => `<path d="M66 4 V152" stroke="${c.prop}" stroke-width="6" stroke-linecap="round"/>`,
  wallR: c => `<path d="M156 4 V152" stroke="${c.prop}" stroke-width="6" stroke-linecap="round"/>`,
  roller: c => `<circle cx="86" cy="143" r="9" fill="${c.prop}"/>`,
  towel: () => '', towelh: () => '',
};

let UID = 0;
// палитра персонажа: футболка в цвет бренда, темные леггинсы, теплая кожа; дальние конечности темнее
const PAL = { skin: '#EDC3A2', skinF: '#D9A887', shirt: '#0E5A6B', shirtF: '#0A4453', pants: '#25343E', pantsF: '#1A252D', shoe: '#E9A23B', shoeF: '#C9862A', hair: '#2B211C' };

/** SVG-схема упражнения. animate: анимация движения; иначе статичный кадр (конечная поза поверх бледной исходной). */
export function exFigure(id, { dark = false, animate = true, size = '100%', ghost: withGhost = true } = {}) {
  const key = String(id).replace(/_(left|right)$/, ''), spec = EX[key]; if (!spec) return '';
  const mirror = /_right$/.test(id), fr = frames(spec), uid = 'xf' + (++UID), front = spec.a.v === 'front', top = spec.a.view === 'top';
  const seq = [...fr, fr[fr.length - 1], ...fr.slice(0, -1).reverse(), fr[0]]; // туда, пауза, обратно, пауза
  const dur = spec.pulse ? '2.4s' : '3.6s', end = fr[fr.length - 1], start = fr[0];
  const anim = (attr, vals) => animate ? `<animate attributeName="${attr}" dur="${dur}" repeatCount="indefinite" calcMode="linear" values="${vals.join(';')}"/>` : '';
  const P = (fn, fill, extra = '') => { const v = seq.map(fn); return `<path fill="${fill}" ${extra} d="${animate ? v[0] : fn(end)}">${anim('d', v)}</path>`; };
  const C = (fn, r, fill, extra = '') => { const v = seq.map(fn), p = animate ? v[0] : fn(end); return `<circle r="${r}" fill="${fill}" ${extra} cx="${f1(p[0])}" cy="${f1(p[1])}">${anim('cx', v.map(q => f1(q[0])))}${anim('cy', v.map(q => f1(q[1])))}</circle>`; };
  const tw = front ? [15, 18] : [10.5, 11.5];
  // части тела
  // туловище короче на скругления: плечи и таз на месте суставов, а не выпирают за них
  const trim = j => { const d = nrm(sub(j.S, j.H)); return { ...j, H: [j.H[0] + d[0] * tw[0] * .45, j.H[1] + d[1] * tw[0] * .45], S: [j.S[0] - d[0] * tw[1] * .55, j.S[1] - d[1] * tw[1] * .55] }; };
  const torso = j => { const t = trim(j), pts = spine(t); return tube(pts, pts.map((_, i, a) => tw[0] + (tw[1] - tw[0]) * i / (a.length - 1))); };
  const neck = j => { const b = trim(j).S; return seg(b, [b[0] + (j.hc[0] - b[0]) * .55, b[1] + (j.hc[1] - b[1]) * .55], 4.2, 3.8); };
  const ua = a => j => seg(j[a][0], j[a][1], 4.8, 4), fa = a => j => seg(j[a][1], j[a][2], 3.8, 3.1);
  const th = l => j => seg(j[l][0], j[l][1], 7.2, 5.4), sh = l => j => seg(j[l][1], j[l][2], 5.2, 3.6), ft = l => j => seg(j[l][2], j[l][3], 3.6, 2.8);
  const hand = a => j => j[a][2];
  const limbArm = (a, far) => P(ua(a), far ? PAL.shirtF : PAL.shirt) + P(fa(a), far ? PAL.skinF : PAL.skin) + C(hand(a), 3.3, far ? PAL.skinF : PAL.skin);
  const limbLeg = (l, far) => P(th(l), far ? PAL.pantsF : PAL.pants) + P(sh(l), far ? PAL.pantsF : PAL.pants) + P(ft(l), far ? PAL.shoeF : PAL.shoe);
  // голова: волосы на затылке, лицо к направлению взгляда, глаз
  const faceDir = j => j.front ? [0, 0] : [Math.cos(j.face * Math.PI / 180), Math.sin(j.face * Math.PI / 180)];
  const head = C(j => j.front ? [j.hc[0], j.hc[1] - 1.6] : [j.hc[0] - faceDir(j)[0] * 1.6, j.hc[1] - faceDir(j)[1] * 1.6], 10.6, PAL.hair)
    + C(j => j.front ? [j.hc[0], j.hc[1] + 1.2] : [j.hc[0] + faceDir(j)[0] * 1.4, j.hc[1] + faceDir(j)[1] * 1.4], 9.4, PAL.skin)
    + (front ? C(j => [j.hc[0] - 3.4 + j.nose * 5, j.hc[1] + 1.5], 1.2, '#2B211C') + C(j => [j.hc[0] + 3.4 + j.nose * 5, j.hc[1] + 1.5], 1.2, '#2B211C')
      : C(j => { const d = faceDir(j), up = [d[1], -d[0]]; const s = Math.sign(up[1]) > 0 ? -1 : 1; return [j.hc[0] + d[0] * 6 + up[0] * 2 * s, j.hc[1] + d[1] * 6 + up[1] * 2 * s]; }, 1.2, '#2B211C'));
  // подсветка рабочей зоны: мягкое теплое свечение поверх тела
  const glow = C(j => hlPoint(j, spec.hl), 15, `url(#${uid}g)`, spec.pulse ? 'opacity=".9"' : '');
  // тень на полу и коврик для упражнений лежа
  const lying = !front && !top && spec.a.hy >= 125;
  const floor = top ? '' : `<path d="M10 ${G + 3} H190" stroke="${dark ? 'rgba(255,255,255,.16)' : '#DCE4E6'}" stroke-width="2" stroke-linecap="round"/>`;
  const mat = lying ? `<rect x="22" y="${G - 1}" width="164" height="6" rx="3" fill="${dark ? 'rgba(126,209,199,.28)' : '#CFE4E7'}"/>` : '';
  const shadow = top ? '' : `<ellipse cy="${G + 2}" rx="${lying ? 60 : 26}" ry="3.2" fill="${dark ? 'rgba(0,0,0,.35)' : 'rgba(19,33,43,.10)'}" cx="${f1(end.H[0])}">${anim('cx', seq.map(j => f1(j.H[0])))}</ellipse>`;
  const c = { prop: dark ? 'rgba(255,255,255,.28)' : '#C9D3D6' };
  const props = (spec.a.props || []).map(p => PROPS[p] ? PROPS[p](c) : '').join('');
  // тень исходной позы в статичном кадре: видно, откуда и куда движение
  const gh = dark ? 'rgba(255,255,255,.14)' : '#E3EAEC';
  const ghost = animate || !withGhost ? '' : `<g fill="${gh}">${[ua('aF'), fa('aF'), th('lF'), sh('lF'), th('lN'), sh('lN'), torso, ua('aN'), fa('aN')].map(f => `<path d="${f(start)}"/>`).join('')}<circle cx="${f1(start.hc[0])}" cy="${f1(start.hc[1])}" r="10.4"/></g>`;
  const towel = (spec.a.props || []).includes('towel') ? P(j => seg(j.aN[2], j.lN[3], 1.3, 1.3), PAL.shoe) : (spec.a.props || []).includes('towelh') ? P(j => seg(j.aN[2], j.aF[2], 1.8, 1.8), PAL.shoe) : '';
  const figure = front
    ? limbLeg('lN') + limbLeg('lF') + P(neck, PAL.skin) + P(torso, PAL.shirt) + limbArm('aN') + limbArm('aF') + head
    : limbArm('aF', 1) + limbLeg('lF', 1) + P(neck, PAL.skin) + P(torso, PAL.shirt) + limbLeg('lN') + head + limbArm('aN');
  return `<svg viewBox="0 0 200 160" width="${size}" style="display:block;max-width:100%" role="img" aria-label="Схема упражнения">
    <defs><radialGradient id="${uid}g"><stop offset="0" stop-color="#FFB547" stop-opacity=".75"/><stop offset=".55" stop-color="#E9A23B" stop-opacity=".35"/><stop offset="1" stop-color="#E9A23B" stop-opacity="0"/></radialGradient></defs>
    <g${mirror ? ' transform="translate(200 0) scale(-1 1)"' : ''}>${floor}${mat}${shadow}${props}${ghost}${figure}${towel}${glow}</g></svg>`;
}
export const hasFigure = id => !!EX[String(id).replace(/_(left|right)$/, '')];
