// Счет повторов упражнения по камере: сигнал по точкам позы и счетчик с гистерезисом.
// Без DOM: тот же код работает в приложении и в автотестах.
const ang = (a, b, c) => { const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y], n = Math.hypot(...v1) * Math.hypot(...v2);
  return n ? Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))) * 180 / Math.PI : NaN; };
const vis = (p, ids) => ids.every(i => p[i] && (p[i].visibility ?? 1) > .4);
// сторона: у упражнения «_left» берем левые точки, иначе ту сторону, что лучше видна
const sideIds = (p, side) => { const L = { sh: 11, hip: 23, knee: 25, ank: 27, wr: 15, heel: 29, toe: 31 }, R = { sh: 12, hip: 24, knee: 26, ank: 28, wr: 16, heel: 30, toe: 32 };
  if (side === 'left') return L; if (side === 'right') return R;
  const s = o => Object.values(o).reduce((a, i) => a + ((p[i] && p[i].visibility) ?? 0), 0); return s(L) >= s(R) ? L : R; };

/** Упражнения, которые камера умеет считать: сигнал растет в «верхней» фазе повтора. up/down: пороги гистерезиса. */
export const REP_KINDS = {
  // ягодичный мост, лежа боком к камере: угол плечо–таз–колено раскрывается до прямой
  bridge: { test: id => /glute_bridge/.test(id), up: 155, down: 135, sig: (p, s) => vis(p, [s.sh, s.hip, s.knee]) ? ang(p[s.sh], p[s.hip], p[s.knee]) : NaN,
    cue: { low: 'Поднимите таз выше, до прямой линии от плеч до колен' } },
  // подъем на носки: пятка поднимается относительно стоя, доля длины голени
  calf: { test: id => /calf_raise/.test(id), up: .1, down: .04, rel: true, sig: (p, s) => vis(p, [s.knee, s.ank, s.heel]) ? -(p[s.heel].y) / Math.hypot(p[s.knee].x - p[s.ank].x, p[s.knee].y - p[s.ank].y) : NaN,
    cue: { low: 'Поднимитесь на носки выше' } },
  // отведение ноги лежа на боку: угол между ногами
  abduct: { test: id => /side_lying_abduction|clamshell/.test(id), up: 28, down: 12, sig: p => vis(p, [23, 24, 25, 26]) ? ang(p[25], { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 }, p[26]) : NaN,
    cue: { low: 'Поднимайте ногу чуть выше, корпус не разворачивайте' } },
  // руки вверх у стены или лежа: запястье выше плеча, доля длины корпуса
  arms: { test: id => /wall_slide|y_raise|lat_activation/.test(id), up: .7, down: .3, sig: (p, s) => vis(p, [s.sh, s.hip, s.wr]) ? (p[s.sh].y - p[s.wr].y) / Math.hypot(p[s.sh].x - p[s.hip].x, p[s.sh].y - p[s.hip].y) : NaN,
    cue: { low: 'Тянитесь руками выше' } },
};
export const repKind = id => Object.entries(REP_KINDS).find(([, k]) => k.test(id)) || null;
/** Сколько повторов в подходе по тексту дозировки: «3 подхода по 12 раз», «2 × 8», «10 раз». */
export function targetReps(dose) { const s = String(dose || '');
  if (/\d\s*с(?![а-я])|секунд/.test(s) && !/по\s*\d+\s*раз|повтор/.test(s)) return null;
  const m = /по\s*(\d+)\s*раз/.exec(s) || /×\s*(\d+)/.exec(s) || /(\d+)\s*(?:медленных\s*)?(?:раз|повтор)/.exec(s); return m ? +m[1] : null; }
export function setsOf(dose) { const m = /(\d+)\s*(?:подход|раза?\s*по)|^(\d+)\s*×/.exec(String(dose || '')); return m ? +(m[1] || m[2]) : 1; }

/** Счетчик: feed(pose, t) → { n, ev } где ev: 'rep' (засчитан), 'low' (повтор не дотянул до верха), null. */
export function repCounter(id) {
  const kv = repKind(id); if (!kv) return null; const [kind, K] = kv, side = /_left$/.test(id) ? 'left' : /_right$/.test(id) ? 'right' : null;
  let st = 'down', n = 0, base = null, peak = -Infinity, lastT = 0, buf = [];
  return { kind, get n() { return n; },
    feed(p, t) { if (!p) return { n, ev: null }; let v = K.sig(p, sideIds(p, side)); if (!Number.isFinite(v)) return { n, ev: null };
      buf.push(v); if (buf.length > 3) buf.shift(); v = buf.reduce((a, b) => a + b, 0) / buf.length;
      // относительный сигнал: ноль — как человек стоял в начале (первые кадры и все нижние положения)
      if (K.rel) { if (base == null || (st === 'down' && v < base)) base = base == null ? v : base * .9 + v * .1; v -= base; }
      if (st === 'down') { if (v > K.up) { st = 'up'; peak = v; return { n, ev: null }; }
        peak = Math.max(peak, v);
        // поднялся заметно, но до верха не дошел и опустился: подсказка «выше»
        if (v < K.down) { const was = peak; peak = -Infinity; if (was > K.down + (K.up - K.down) * .4) return { n, ev: 'low' }; } return { n, ev: null }; }
      peak = Math.max(peak, v);
      if (v < K.down && t - lastT > .6) { st = 'down'; n++; lastT = t; peak = -Infinity; return { n, ev: 'rep' }; }
      return { n, ev: null }; } };
}
