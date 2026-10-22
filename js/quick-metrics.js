// «Быстрый тест» (ТЗ v4): 8 измеряемых показателей по 4 фото. Только числа и сторона, без оценок «норма / не норма».
// Формулы те же, что у теста по видео (analysis.js: F, sideView), поэтому правила зон в этапе 2 работают без изменений.
import { P, F, sideView, levelled } from './analysis.js';

export const VIEWS = [
  { id: 'front', name: 'Спереди', say: 'Встаньте лицом ко мне у стены' },
  { id: 'right', name: 'Справа', say: 'Повернитесь ко мне правым боком' },
  { id: 'back', name: 'Сзади', say: 'Повернитесь ко мне спиной' },
  { id: 'left', name: 'Слева', say: 'Повернитесь ко мне левым боком' },
];
// точки, которые специалист видит и правит на каждом фото
export const EDIT_POINTS = {
  front: [P.L_EAR, P.R_EAR, P.L_SHOULDER, P.R_SHOULDER, P.L_HIP, P.R_HIP, P.L_KNEE, P.R_KNEE, P.L_ANKLE, P.R_ANKLE],
  back: [P.L_EAR, P.R_EAR, P.L_SHOULDER, P.R_SHOULDER, P.L_HIP, P.R_HIP, P.L_KNEE, P.R_KNEE, P.L_ANKLE, P.R_ANKLE],
  right: [P.R_EAR, P.R_SHOULDER, P.R_HIP, P.R_KNEE, P.R_ANKLE],
  left: [P.L_EAR, P.L_SHOULDER, P.L_HIP, P.L_KNEE, P.L_ANKLE],
};
export const POINT_NAMES = { [P.L_EAR]: 'левое ухо', [P.R_EAR]: 'правое ухо', [P.L_SHOULDER]: 'левое плечо', [P.R_SHOULDER]: 'правое плечо', [P.L_HIP]: 'левый таз', [P.R_HIP]: 'правый таз',
  [P.L_KNEE]: 'левое колено', [P.R_KNEE]: 'правое колено', [P.L_ANKLE]: 'левая лодыжка', [P.R_ANKLE]: 'правая лодыжка' };

// Погрешность замера по одному фото: стартовые оценки (точность точки модели 1–2 % кадра плюс правка руками).
// Уточняются по docs/clinical/noise_protocol.md, когда будут 10 пар повторов; меняются здесь, без правки формул.
export const ERR = { headTilt: 2, shoulderTilt: 1.5, pelvicTilt: 1.5, trunkLateral: 1.5, headForward: 4, shoulderShift: 1.5, hipShift: 1.5, kneeHyper: 3 };

const r1 = v => Math.round(v * 10) / 10;
const side = (v, pos, neg) => v > 0 ? pos : neg;

/** Показатели одного вида. pts: 33 точки в пикселях фото, w/h: размер фото, roll: поправка крена телефона при съемке (°, как corr() в тесте по видео: для задней камеры −roll), heightCm: рост клиента. */
export function viewMetrics(id, pts, w, h, roll = 0, heightCm = 0) {
  if (!pts || pts.length < 33) return null;
  const p = levelled(pts, w, h, roll), out = [];
  if (id === 'front' || id === 'back') {
    const add = (key, name, v, pos, neg) => out.push({ key, name, v: r1(v), err: ERR[key], unit: '°', dir: Math.abs(v) <= ERR[key] ? 'в пределах погрешности' : side(v, pos, neg) });
    add('headTilt', 'Наклон головы', F.headTilt(p), 'к правому плечу', 'к левому плечу');
    add('shoulderTilt', 'Линия плеч', F.shoulderTilt(p), 'правое ниже', 'левое ниже');
    add('pelvicTilt', 'Линия таза', F.pelvicTilt(p), 'правая сторона ниже', 'левая сторона ниже');
    if (id === 'front') add('trunkLateral', 'Смещение корпуса', F.trunkLateral(p), 'вправо', 'влево');
  } else {
    // боковой вид: ближняя к камере сторона; sideView сам выбирает ее по видимости, здесь подсказываем видимостью по виду
    const near = id === 'right' ? 'R' : 'L', q = p.map((l, i) => ({ ...l }));
    for (const [l, r] of [[P.L_EAR, P.R_EAR], [P.L_SHOULDER, P.R_SHOULDER]]) { q[l].visibility = near === 'L' ? 1 : 0; q[r].visibility = near === 'R' ? 1 : 0; }
    const s = sideView(q), toCm = f => heightCm ? f * heightCm : f * 100, cmU = heightCm ? ' см' : '% роста';
    const deg = (key, name, v, pos, neg) => out.push({ key, name, v: r1(v), err: ERR[key], unit: '°', dir: Math.abs(v) <= ERR[key] ? 'в пределах погрешности' : side(v, pos, neg) });
    const cm = (key, name, f, pos, neg) => { const v = toCm(f), e = heightCm ? ERR[key] : r1(ERR[key] / 1.7); out.push({ key, name, v: r1(v), err: e, unit: cmU, dir: Math.abs(v) <= e ? 'в пределах погрешности' : side(v, pos, neg) }); };
    deg('headForward', 'Голова относительно плеча', s.headForwardDeg, 'впереди', 'позади');
    cm('shoulderShift', 'Плечо относительно таза', s.shoulderShift, 'впереди', 'позади');
    cm('hipShift', 'Таз относительно лодыжки', s.hipShift, 'впереди', 'позади');
    deg('kneeHyper', 'Колено относительно линии бедро–лодыжка', s.kneeHyperDeg, 'кзади (переразгибание)', 'кпереди (согнуто)');
  }
  return out;
}

/** Все виды сразу и сводка в форматах теста по видео (snapshot спереди, side как среднее двух боков) для правил зон. */
export function quickMetrics(views, heightCm = 0) {
  const by = {}; for (const v of VIEWS) { const x = views[v.id]; by[v.id] = x && x.pts ? viewMetrics(v.id, x.pts, x.w, x.h, x.roll || 0, heightCm) : null; }
  const val = (id, key) => { const m = by[id] && by[id].find(x => x.key === key); return m ? m.v : NaN; };
  const avg = (...a) => { const v = a.filter(Number.isFinite); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : NaN; };
  const snapshot = by.front ? { headTilt: val('front', 'headTilt'), shoulderTilt: val('front', 'shoulderTilt'), pelvicTilt: val('front', 'pelvicTilt'), trunkLateral: val('front', 'trunkLateral') } : null;
  const frac = k => heightCm ? avg(val('right', k), val('left', k)) / heightCm : avg(val('right', k), val('left', k)) / 100;
  const side = by.right || by.left ? { headForwardDeg: avg(val('right', 'headForward'), val('left', 'headForward')), shoulderShift: frac('shoulderShift'), hipShift: frac('hipShift'), kneeHyperDeg: avg(val('right', 'kneeHyper'), val('left', 'kneeHyper')) } : null;
  return { by, snapshot, side };
}

/** «Что видно»: короткие фразы по показателям вне погрешности, самые заметные первыми. Без оценок и причин. */
export function observations(by, max = 6) {
  const out = [];
  for (const v of VIEWS) for (const m of by[v.id] || []) if (m.dir !== 'в пределах погрешности') out.push({ v, m, score: Math.abs(m.v) / m.err });
  return out.sort((a, b) => b.score - a.score).slice(0, max).map(({ v, m }) => `${v.name}: ${m.name.toLowerCase()} ${m.dir}, ${String(Math.abs(m.v)).replace('.', ',')}${m.unit}`);
}

/** Проверка кадра после съемки: тело целиком, нужный ракурс. Возвращает текст проблемы или ''. */
export function frameIssue(id, pts, w, h) {
  if (!pts) return 'Человек не найден на фото. Переснимите: тело целиком, от макушки до стоп';
  const vis = i => (pts[i].visibility ?? 1) > .5, sideView = id === 'right' || id === 'left';
  if (!(vis(P.L_ANKLE) || vis(P.R_ANKLE))) return 'Не видно стоп. Отойдите дальше или опустите телефон';
  if (!(vis(P.NOSE) || vis(P.L_EAR) || vis(P.R_EAR))) return 'Не видно головы. Отойдите дальше';
  const top = Math.min(pts[P.NOSE].y, pts[P.L_EAR].y, pts[P.R_EAR].y), bottom = Math.max(pts[P.L_ANKLE].y, pts[P.R_ANKLE].y), frac = (bottom - top) / h;
  if (frac < .45) return 'Человек слишком далеко. Подойдите ближе, чтобы тело заняло почти весь кадр';
  if (top < h * .02 || bottom > h * .99) return 'Тело у края кадра. Отойдите чуть дальше';
  const shW = Math.abs(pts[P.L_SHOULDER].x - pts[P.R_SHOULDER].x) / Math.max(1, bottom - top);
  if (sideView && shW > .15) return 'Нужен вид сбоку. Попросите клиента повернуться боком';
  if (!sideView && shW < .1) return 'Нужен вид ' + (id === 'front' ? 'спереди' : 'сзади') + '. Попросите клиента развернуться';
  return '';
}
