// Аппаратная оптимизация v2.0: коррекция перспективы при съемке снизу, FPS-Guard (Android thermal),
// очистка WebGL после каждого теста (Safari iOS), разрешение датчиков на первом клике.
// Выравнивание по гравитации (поворот точек на угол крена из DeviceMotionEvent) уже делает core.phone + analysis.levelled.

/** Pinhole Height Correction: K = 1 / cos(α), где α — наклон камеры вверх (pitch). Растягивает Y относительно центра кадра. */
export const perspK = pitchDeg => { const a = Math.min(35, Math.abs(+pitchDeg || 0)) * Math.PI / 180; return 1 / Math.cos(a); };
export function pinhole(p, h, pitchDeg) {
  if (!p || !pitchDeg || Math.abs(pitchDeg) < 3) return p; const k = perspK(pitchDeg), cy = h / 2;
  return p.map(l => ({ ...l, y: cy + (l.y - cy) * k }));
}

/** FPS-Guard: каждые 3 с смотрит фактический FPS. ≥ 50 — полный анализ с рывком (jerk), < 45 — экономный режим. */
export function fpsGuard(getFps, onChange) {
  const state = { mode: 'full', jerk: true, filter: { minCutoff: 1, beta: .007 }, skip: 0 };
  const tick = () => { const fps = getFps(); if (!fps) return;
    if (fps < 45 && state.mode !== 'eco') { Object.assign(state, { mode: 'eco', jerk: false, filter: { minCutoff: .5, beta: .001 }, skip: fps < 25 ? 2 : 1 }); onChange && onChange(state); }
    else if (fps >= 50 && state.mode !== 'full') { Object.assign(state, { mode: 'full', jerk: true, filter: { minCutoff: 1, beta: .007 }, skip: 0 }); onChange && onChange(state); } };
  const id = setInterval(tick, 3000);
  return { state, stop: () => clearInterval(id) };
}
/** Рывок (3-я производная положения) по ряду значений с шагом dt; null, если FPS-Guard его выключил. */
export function jerk(series, dt, enabled = true) {
  if (!enabled || series.length < 4) return null; let m = 0;
  for (let i = 3; i < series.length; i++) { const j = (series[i] - 3 * series[i - 1] + 3 * series[i - 2] - series[i - 3]) / dt ** 3; m = Math.max(m, Math.abs(j)); }
  return m;
}

/** WebGL Memory Flush: после каждого теста сбрасываем буферы всех WebGL-холстов на странице (защита от падения вкладки Safari). */
export function flushGL(root = document) {
  for (const c of root.querySelectorAll('canvas')) {
    const gl = c.__gl || null; if (!gl) continue;
    try { gl.flush(); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); } catch (e) {} }
  for (const c of root.querySelectorAll('canvas')) { if (c.__gl) continue; const ctx = c.__ctx2d; if (ctx) ctx.clearRect(0, 0, c.width, c.height); }
}

/** iOS: разрешение датчика движения запрашиваем строго в момент первого клика на разблокировку камеры. */
export function armMotionPermission(btn, startMotion) {
  if (!btn) return; btn.addEventListener('click', () => { try { startMotion(); } catch (e) {} }, { once: true, capture: true });
}
