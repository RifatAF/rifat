import test from 'node:test'; import assert from 'node:assert/strict';
import { repCounter, targetReps, setsOf, repKind } from '../js/repcount.js';
// поза сбоку: плечо, таз, колено; угол в тазу задаем поворотом колена
const pose = deg => { const p = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 1 })), r = deg * Math.PI / 180;
  p[11] = p[12] = { x: -100, y: 0, visibility: 1 }; p[23] = p[24] = { x: 0, y: 0, visibility: 1 }; p[25] = p[26] = { x: 100 * Math.cos(Math.PI - r), y: 100 * Math.sin(Math.PI - r), visibility: 1 }; return p; };
const run = (c, seq) => { let t = 0, evs = []; for (const d of seq) for (let k = 0; k < 4; k++) { const r = c.feed(pose(d), t += .1); if (r.ev) evs.push(r.ev); } return evs; };
test('мост: 3 полных повтора', () => { const c = repCounter('ex_glute_bridge_left'); run(c, [120, 140, 165, 170, 140, 120, 120, 168, 120, 125, 170, 125]); assert.equal(c.n, 3); });
test('мост: недотянул — подсказка, не повтор', () => { const c = repCounter('ex_glute_bridge'); const ev = run(c, [120, 148, 150, 120]); assert.equal(c.n, 0); assert.deepEqual(ev, ['low']); });
test('шум не считается', () => { const c = repCounter('ex_glute_bridge'); run(c, [120, 122, 119, 125, 121]); assert.equal(c.n, 0); });
test('дозировка', () => { assert.equal(targetReps('3 подхода по 12 раз'), 12); assert.equal(targetReps('2 × 8'), 8); assert.equal(targetReps('10 медленных повторов'), 10); assert.equal(targetReps('3 × 10 с'), null); assert.equal(targetReps('2 раза по 30 секунд'), null); assert.equal(setsOf('3 подхода по 12 раз'), 3); assert.equal(setsOf('2 × 8'), 2); });
test('что считаем', () => { assert.ok(repKind('ex_calf_raise_left')); assert.equal(repKind('ex_chin_tuck'), null); });
