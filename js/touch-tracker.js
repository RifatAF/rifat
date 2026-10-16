// Touch Dynamics v2.0: фоновый замер через PointerEvents на всем приложении. Отдельных экранов нет: человек заполняет
// анкету (имя, дата рождения, рост), листает, проводит пальцем по «Проведите, чтобы начать», а замер уже идет.
//  • Hold Time — сколько палец держит касание до отпускания или до начала движения. Норма 70–110 мс, больше 160 мс — признак тревожности или зажима.
//  • Path Jitter — виляние свайпа: среднеквадратичное отклонение траектории от прямой начало–конец, в долях длины пути.
//  • Micro-Reversals — микро-откаты: палец на 2–12 px возвращается назад против основного направления.
// Только SELF_TEST: в режиме специалиста трекер не подключается и ничего не хранит.
import { passiveOn, onSession } from './session-controller.js';

export const HOLD = { normMin: 70, normMax: 110, anxious: 160 };
const MOVE_PX = 4, REV_MIN = 2, REV_MAX = 12;
const S = { holds: [], jitter: [], reversals: 0, swipes: 0, taps: 0, iki: [], dwell: [], keys: 0, corrections: 0 };
const detach = new Set();
let global = null;
onSession(() => { if (!passiveOn()) { for (const f of detach) f(); detach.clear(); global = null; resetTouch(); } else if (global === false) startPassive(); });

export function resetTouch() { Object.assign(S, { holds: [], jitter: [], reversals: 0, swipes: 0, taps: 0, iki: [], dwell: [], keys: 0, corrections: 0 }); }

/** Фоновый сбор по всему документу с первого экрана. В режиме специалиста ждет возврата в SELF_TEST. */
export function startPassive(root = document) {
  if (!passiveOn()) { global = false; return; } if (global) return; const offT = trackTouch(root), offK = trackKeys(root);
  global = () => { offT(); offK(); }; detach.add(global);
}
/** Ритм набора в полях анкеты (keystroke dynamics по Vizer 2009, Epp 2011): интервалы между символами (событие input
 *  работает и с экранной клавиатурой), их разброс (коэффициент вариации), удержание клавиши, где есть keydown/keyup,
 *  и доля исправлений. Сам текст не читается и не хранится. Паузы длиннее 5 с (человек думает или отвлекся) не считаем. */
export function trackKeys(root) {
  if (!passiveOn()) return () => {}; let last = 0; const downAt = new Map();
  const inp = e => { const t = e.target; if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || /range|checkbox|radio|file/.test(t.type)) return;
    const now = e.timeStamp; if (/^delete/.test(e.inputType || '')) S.corrections++; else { S.keys++; if (last && now - last < 5000) S.iki.push(now - last); } last = now; };
  const kd = e => { if (e.key && e.key.length === 1 && !downAt.has(e.code || e.key)) downAt.set(e.code || e.key, e.timeStamp); };
  const ku = e => { const k = e.code || e.key, t = downAt.get(k); if (t != null) { const d = e.timeStamp - t; if (d > 20 && d < 1000) S.dwell.push(d); downAt.delete(k); } };
  const o = { passive: true, capture: true }; root.addEventListener('input', inp, o); root.addEventListener('keydown', kd, o); root.addEventListener('keyup', ku, o);
  const off = () => { root.removeEventListener('input', inp, o); root.removeEventListener('keydown', kd, o); root.removeEventListener('keyup', ku, o); detach.delete(off); };
  detach.add(off); return off;
}

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
const cvOf = a => { if (a.length < 4) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.round(Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m * 100) / 100; };
// Личная норма: стресс по набору надежно видно только относительно самого человека (межличностный разброс больше эффекта),
// поэтому храним медианы прошлых анкет (до 8) и считаем отношение к ним. Без истории отношения нет, правило не срабатывает.
const BASE = 'bp_cns_base';
const hist = () => { try { const h = JSON.parse(localStorage.getItem(BASE) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } };
/** Запомнить замер этой сессии в личную норму (после сохранения результата теста). */
export function rememberBaseline(t) { if (!t || !t.typing || !t.typing.ikiMs) return; try { localStorage.setItem(BASE, JSON.stringify([...hist(), { iki: t.typing.ikiMs, hold: t.holdMs }].slice(-8))); } catch (e) {} }
/** Итог для результата теста. holdFlag — признак тревожности или зажима (медиана > 160 мс). */
export function touchSummary() {
  if (!passiveOn() || (!S.holds.length && !S.swipes && S.keys < 5)) return null;
  const hold = med(S.holds);
  const iki = med(S.iki), dwell = med(S.dwell), h = hist(), base = h.length >= 2 ? med(h.map(x => x.iki).filter(Boolean)) : null;
  return { typing: S.keys >= 5 && iki ? { ikiMs: Math.round(iki), cv: cvOf(S.iki), rel: base ? Math.round(iki / base * 100) / 100 : null, dwellMs: dwell == null ? null : Math.round(dwell), corrections: Math.round(S.corrections / Math.max(1, S.keys) * 100) / 100, keys: S.keys } : null,
    holdMs: hold == null ? null : Math.round(hold), holdNorm: hold != null && hold >= HOLD.normMin && hold <= HOLD.normMax, holdFlag: hold != null && hold > HOLD.anxious,
    jitter: med(S.jitter), reversals: S.reversals, reversalsPerSwipe: S.swipes ? Math.round(S.reversals / S.swipes * 10) / 10 : 0, swipes: S.swipes, taps: S.taps, samples: S.holds.length };
}
