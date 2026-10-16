// Touch Dynamics v2.0: пассивный замер через PointerEvents, пока человек отмечает зоны боли или двигает ползунок энергии.
//  • Hold Time — сколько палец держит касание до отпускания или до начала движения. Норма 70–110 мс, больше 160 мс — признак тревожности или зажима.
//  • Path Jitter — виляние свайпа: среднеквадратичное отклонение траектории от прямой начало–конец, в долях длины пути.
//  • Micro-Reversals — микро-откаты: палец на 2–12 px возвращается назад против основного направления.
// Только SELF_TEST: в режиме специалиста трекер не подключается и ничего не хранит.
import { passiveOn, onSession } from './session-controller.js';

export const HOLD = { normMin: 70, normMax: 110, anxious: 160 };
const MOVE_PX = 4, REV_MIN = 2, REV_MAX = 12;
const S = { holds: [], jitter: [], reversals: 0, swipes: 0, taps: 0 };
const detach = new Set();
onSession(() => { if (!passiveOn()) { for (const f of detach) f(); detach.clear(); resetTouch(); } });

export function resetTouch() { S.holds = []; S.jitter = []; S.reversals = 0; S.swipes = 0; S.taps = 0; }

/** Виляние и микро-откаты одной траектории [[x, y, t], ...]. */
export function metrics(path) {
  if (path.length < 3) return { jitter: 0, reversals: 0, length: 0 };
  const [x0, y0] = path[0], [x1, y1] = path.at(-1); let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  const chord = Math.hypot(x1 - x0, y1 - y0) || 1e-6, ux = (x1 - x0) / chord, uy = (y1 - y0) / chord;
  // отклонение каждой точки от прямой начало–конец
  const rms = Math.sqrt(path.reduce((a, [x, y]) => { const d = (x - x0) * uy - (y - y0) * ux; return a + d * d; }, 0) / path.length);
  // откаты по главной оси: палец ушел назад на 2–12 px и снова пошел вперед
  const ax = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 0 : 1, dir = Math.sign(path.at(-1)[ax] - path[0][ax]) || 1;
  let rev = 0, peak = path[0][ax] * dir, back = 0;
  for (const p of path) { const v = p[ax] * dir;
    if (v > peak) { if (back >= REV_MIN && back <= REV_MAX) rev++; peak = v; back = 0; } else back = Math.max(back, peak - v); }
  return { jitter: Math.round(rms / Math.max(len, 1) * 1000) / 1000, reversals: rev, length: Math.round(len) };
}

/** Подключить замер к элементу. Возвращает функцию отключения; в режиме специалиста — пустую. */
export function trackTouch(el) {
  if (!el || !passiveOn()) return () => {};
  const live = new Map(); // pointerId → { t0, x0, y0, moved, holdDone, path }
  const down = e => { live.set(e.pointerId, { t0: e.timeStamp, x0: e.clientX, y0: e.clientY, moved: false, path: [[e.clientX, e.clientY, e.timeStamp]] }); };
  const move = e => { const s = live.get(e.pointerId); if (!s) return; s.path.push([e.clientX, e.clientY, e.timeStamp]);
    if (!s.moved && Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > MOVE_PX) { s.moved = true; S.holds.push(e.timeStamp - s.t0); } };
  const up = e => { const s = live.get(e.pointerId); if (!s) return; live.delete(e.pointerId);
    if (!s.moved) { S.taps++; S.holds.push(e.timeStamp - s.t0); return; }
    const m = metrics(s.path); if (m.length < 20) return; S.swipes++; S.jitter.push(m.jitter); S.reversals += m.reversals; };
  const cancel = e => live.delete(e.pointerId);
  const opt = { passive: true, capture: true };
  el.addEventListener('pointerdown', down, opt); el.addEventListener('pointermove', move, opt);
  el.addEventListener('pointerup', up, opt); el.addEventListener('pointercancel', cancel, opt);
  const off = () => { el.removeEventListener('pointerdown', down, opt); el.removeEventListener('pointermove', move, opt); el.removeEventListener('pointerup', up, opt); el.removeEventListener('pointercancel', cancel, opt); detach.delete(off); };
  detach.add(off); return off;
}

const med = a => { if (!a.length) return null; const v = [...a].sort((x, y) => x - y); return v[v.length >> 1]; };
/** Итог для результата теста. holdFlag — признак тревожности или зажима (медиана > 160 мс). */
export function touchSummary() {
  if (!passiveOn() || (!S.holds.length && !S.swipes)) return null;
  const hold = med(S.holds);
  return { holdMs: hold == null ? null : Math.round(hold), holdNorm: hold != null && hold >= HOLD.normMin && hold <= HOLD.normMax, holdFlag: hold != null && hold > HOLD.anxious,
    jitter: med(S.jitter), reversals: S.reversals, reversalsPerSwipe: S.swipes ? Math.round(S.reversals / S.swipes * 10) / 10 : 0, swipes: S.swipes, taps: S.taps, samples: S.holds.length };
}

// ---------- ползунок «Уровень энергии» ----------
const ENERGY = [[0, 'Истощение'], [20, 'Снижен'], [40, 'В норме'], [70, 'Приподнят'], [88, 'Перевозбуждение']];
export const energyWord = v => ENERGY.filter(([t]) => v >= t).pop()[1];
/** Шторка с ползунком энергии; замер касаний подключается сам. Возвращает { energy, touch } или null, если закрыли. */
export function energySheet() {
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div><h2 style="font-size:21px">Уровень энергии: <span id="enw">В норме</span></h2>
      <p class="sub" style="font-size:14px;margin-top:6px">Сдвиньте ползунок, как вы себя чувствуете прямо сейчас</p>
      <input type="range" id="en" min="0" max="100" value="55" style="width:100%;margin-top:18px;accent-color:var(--ink);height:40px" aria-label="Уровень энергии">
      <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub)"><span>без сил</span><span>на взводе</span></div>
      <button class="btn" id="enok" style="margin-top:16px">Дальше</button></div>`;
    document.body.appendChild(d); const off = trackTouch(d), r = d.querySelector('#en');
    r.oninput = () => { d.querySelector('#enw').textContent = energyWord(+r.value); };
    const done = v => { off(); d.remove(); res(v); };
    d.querySelector('#enok').onclick = () => done({ energy: +r.value, word: energyWord(+r.value), touch: touchSummary() });
    d.addEventListener('bp-close', () => done(null));
  });
}
