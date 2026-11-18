import test from 'node:test';
import assert from 'node:assert/strict';
import { planState, PHASES, weekLine, heldNote } from '../js/homeplan.js';

const D = 864e5, start = new Date(2026, 10, 2, 10).getTime(); // понедельник
const s = (wk, day, extra = {}) => ({ t: start + (wk * 7 + day) * D + 3600e3, n: 5, ...extra });

test('первая неделя: освоение, повторный тест через 4 недели', () => {
  const st = planState({ start, now: start + D });
  assert.equal(st.week, 0); assert.equal(st.phase, 0); assert.equal(st.thisWeek, 0);
  assert.equal(new Date(st.retest).getDate(), new Date(start + 27 * D).getDate());
  assert.match(weekLine(st), /Неделя 1 · Освоение: занятий 0 из 3/);
});
test('этап растет только после недели с 2+ занятиями', () => {
  const log = [s(0, 0), s(0, 2), s(1, 1)];
  const st = planState({ start, log, now: start + 15 * D });
  assert.equal(st.week, 2); assert.equal(st.phase, 1); assert.equal(st.held, 'few');
  assert.match(heldNote(st), /меньше 2 занятий/);
});
test('боль после занятий выше, чем до: нагрузку не повышаем', () => {
  const log = [s(0, 0, { pre: 2, post: 4 }), s(0, 3, { pre: 2, post: 4 })];
  const st = planState({ start, log, now: start + 8 * D });
  assert.equal(st.phase, 0); assert.equal(st.held, 'pain');
});
test('регулярно 4 недели: закрепление, дальше этап не растет; дата теста от специалиста', () => {
  const log = [0, 1, 2, 3, 4, 5].flatMap(w => [s(w, 0), s(w, 2), s(w, 4)]), next = start + 30 * D;
  const st = planState({ start, next, log, now: start + 43 * D });
  assert.equal(st.phase, PHASES.length - 1); assert.equal(st.retest, next); assert.equal(st.retestDue, true); assert.equal(st.thisWeek, 0);
});
test('занятия из списка выполненных считаются, один день один раз', () => {
  const st = planState({ start, log: [s(0, 1)], done: [start + D + 7200e3, start + 3 * D], now: start + 4 * D });
  assert.equal(st.thisWeek, 2);
});
