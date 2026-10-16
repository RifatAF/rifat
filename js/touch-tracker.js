// Touch Dynamics v2.0: пассивный замер через PointerEvents, пока человек отмечает боль или двигает ползунок.
// Hold Time (норма 70–110 мс, больше 160 мс — признак тревожности или зажима), Path Jitter (волнистость свайпа), Micro-Reversals.
// Работает только в SELF_TEST: в режиме специалиста замер выключен, чтобы не мерить руку специалиста.
import { passiveOn } from './session-controller.js';

const S = { holds: [], jitter: [], reversals: 0, swipes: 0 };
export function resetTouch() { S.holds = []; S.jitter = []; S.reversals = 0; S.swipes = 0; }

/** Подключить замер к элементу (ползунок, карта боли). Возвращает функцию отключения. */
export function trackTouch(el) {
  if (!el || !passiveOn()) return () => {};
  let down = null, path = [];
  const pd = e => { down = { t: e.timeStamp, x: e.clientX, y: e.clientY }; path = [[e.clientX, e.clientY]]; };
  const pm = e => { if (down) path.push([e.clientX, e.clientY]); };
  const pu = e => { if (!down) return; const dt = e.timeStamp - down.t, dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist < 8) S.holds.push(dt); else { S.swipes++; const m = metrics(path); S.jitter.push(m.jitter); S.reversals += m.reversals; } down = null; };
  el.addEventListener('pointerdown', pd, { passive: true }); el.addEventListener('pointermove', pm, { passive: true }); el.addEventListener('pointerup', pu, { passive: true });
  return () => { el.removeEventListener('pointerdown', pd); el.removeEventListener('pointermove', pm); el.removeEventListener('pointerup', pu); };
}
/** Волнистость: среднее отклонение точек от прямой начало–конец, в долях длины. Откаты: смена знака движения по главной оси. */
export function metrics(path) {
  if (path.length < 3) return { jitter: 0, reversals: 0 };
  const [x0, y0] = path[0], [x1, y1] = path.at(-1), L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const dev = path.reduce((a, [x, y]) => a + Math.abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L, 0) / path.length;
  const ax = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 0 : 1; let rev = 0, sg = 0;
  for (let i = 1; i < path.length; i++) { const d = path[i][ax] - path[i - 1][ax]; if (Math.abs(d) < 1) continue; const s = Math.sign(d); if (sg && s !== sg) rev++; sg = s; }
  return { jitter: Math.round(dev / L * 1000) / 1000, reversals: rev };
}
/** Итог для результата теста. */
export function touchSummary() {
  if (!S.holds.length && !S.swipes) return null; const med = a => { const v = [...a].sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
  const hold = med(S.holds);
  return { holdMs: hold && Math.round(hold), holdFlag: hold > 160, jitter: med(S.jitter), reversals: S.reversals, swipes: S.swipes, taps: S.holds.length };
}
