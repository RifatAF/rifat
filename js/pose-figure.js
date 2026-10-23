// Поза клиента на типовой 3D-фигуре (ТЗ v4, п. 3.5–3.6): сетка мышц изгибается по замерам «Быстрого теста».
// Это положение на типовой фигуре, а не тело клиента. Координаты сетки в мм: x влево (+) / вправо (−) от человека,
// y вперед (−) / назад (+), z вверх от пола. Кости не нужны: каждая вершина поворачивается вокруг своего «сустава»
// с плавным весом по высоте, поэтому переходы между частями тела без разрывов.

// опорные высоты типовой фигуры, мм
const Z = { knee: 480, hip: 950, waist: 1080, chest: 1330, neck: 1470 };
// на типовой фигуре голова уже немного впереди плеча: отклонение считаем от этого положения, а не от нуля
export const NEUTRAL = { headForward: 12 };
const D2R = Math.PI / 180;
const smooth = (a, b, z) => { const t = Math.max(0, Math.min(1, (z - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (a, b, c, d, z) => smooth(a, b, z) * (1 - smooth(c, d, z));

/** Углы и сдвиги позы из замеров. by — показатели по видам (quick-metrics), gain — «Усилить» (1, 1.5, 2, 3). */
export function poseOf(q, gain = 1) {
  const v = (id, key) => { const m = q && q.by && q.by[id] && q.by[id].find(x => x.key === key); return m && Number.isFinite(m.v) ? m.v : null; };
  const avg = (...a) => { const r = a.filter(x => x != null); return r.length ? r.reduce((s, x) => s + x, 0) / r.length : 0; };
  const sidePct = key => { const r = avg(v('right', key), v('left', key)); const unit = (q.by.right || q.by.left || []).find(x => x.key === key); return unit && /см/.test(unit.unit) ? r / (q.h || 170) : r / 100; };
  const p = {
    headTilt: avg(v('front', 'headTilt'), v('back', 'headTilt')), shoulderTilt: avg(v('front', 'shoulderTilt'), v('back', 'shoulderTilt')),
    pelvicTilt: avg(v('front', 'pelvicTilt'), v('back', 'pelvicTilt')), trunkLateral: v('front', 'trunkLateral') || 0,
    headForward: avg(v('right', 'headForward'), v('left', 'headForward')), kneeHyper: avg(v('right', 'kneeHyper'), v('left', 'kneeHyper')),
    shoulderShift: sidePct('shoulderShift'), hipShift: sidePct('hipShift'),
  };
  if (!(q.by.right || q.by.left)) p.headForward = NEUTRAL.headForward;
  return scalePose(p, gain);
}
export const scalePose = (p, g) => ({ ...Object.fromEntries(Object.entries(p).map(([k, x]) => [k, k === 'headForward' ? NEUTRAL.headForward + (x - NEUTRAL.headForward) * g : x * g])) });

/** Повернуть точку в плоскости (u, z) вокруг (cu, cz) на угол a (рад) с весом w. */
function rot(u, z, cu, cz, a, w) { if (!w || !a) return [u, z]; const t = a * w, c = Math.cos(t), s = Math.sin(t), du = u - cu, dz = z - cz; return [cu + du * c - dz * s, cz + du * s + dz * c]; }

/** Новые координаты вершин. pos — Float32Array [x,y,z…] в мм, H — рост сетки (zmax). Возвращает новый массив. */
export function poseVerts(pos, pose, H = 1705) {
  const k = H / 1705, z0 = { knee: Z.knee * k, hip: Z.hip * k, waist: Z.waist * k, chest: Z.chest * k, neck: Z.neck * k };
  const p = pose || {}, out = new Float32Array(pos.length), n = pos.length / 3;
  // фронтальная плоскость: у всех наклонов + значит «правая сторона ниже / верх вправо», правая сторона это x < 0, и поворот
  // на +a делает то же самое. Замеры абсолютные, поэтому дочерней части даем угол за вычетом родительского
  const aPel = (p.pelvicTilt || 0) * D2R, aTrunk = (p.trunkLateral || 0) * D2R, aSh = ((p.shoulderTilt || 0) - (p.trunkLateral || 0)) * D2R, aHead = ((p.headTilt || 0) - (p.shoulderTilt || 0)) * D2R;
  // сагиттальная: вперед это y < 0
  const aHeadF = ((p.headForward ?? NEUTRAL.headForward) - NEUTRAL.headForward) * D2R, shF = -(p.shoulderShift || 0) * H, hipF = -(p.hipShift || 0) * H, knee = Math.tan((p.kneeHyper || 0) * D2R) * 420 * k;
  for (let i = 0; i < n; i++) {
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    // руки висят от плеча: для них вес считаем по высоте плеча, иначе кисть отрывалась бы от предплечья при наклоне корпуса
    const arm = Math.abs(x) > 185 * k && z > 600 * k, zw = arm ? z0.chest + 60 * k : z;
    // сагиттальная плоскость: колено назад, таз и все выше вперед, плечи вперед, голова вперед
    y += knee * bump(z0.knee - 230 * k, z0.knee, z0.knee, z0.knee + 230 * k, z);
    y += hipF * smooth(120 * k, z0.hip, z);
    y += shF * smooth(z0.waist, z0.chest + 40 * k, zw);
    if (aHeadF && zw > z0.neck - 60 * k) { const w = smooth(z0.neck - 60 * k, z0.neck + 40 * k, z); [y, z] = rot(y, z, hipF + shF, z0.neck, aHeadF, w); }
    // фронтальная: от головы к тазу, дочерние повороты раньше родительских
    if (aHead) [x, z] = rot(x, z, 0, z0.neck, aHead, smooth(z0.neck - 40 * k, z0.neck + 50 * k, zw));
    if (aSh) [x, z] = rot(x, z, 0, z0.chest, aSh, smooth(z0.chest - 150 * k, z0.chest + 30 * k, zw));
    if (aTrunk) [x, z] = rot(x, z, 0, z0.hip + 40 * k, aTrunk, smooth(z0.hip, z0.waist + 120 * k, zw));
    if (aPel) [x, z] = rot(x, z, 0, z0.hip, aPel, bump(z0.knee + 150 * k, z0.hip - 60 * k, z0.waist, z0.waist + 160 * k, zw) * (arm ? 0 : 1));
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}
