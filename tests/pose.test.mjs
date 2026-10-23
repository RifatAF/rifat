// Поза на типовой фигуре: направления наклонов и сдвигов совпадают с подписями замеров, «Усилить» масштабирует.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poseVerts, scalePose, poseOf, NEUTRAL } from '../js/pose-figure.js';

// точки-маркеры: голова, правое/левое плечо, правый/левый таз, правая стопа, колено спереди
const P = { head: [0, 0, 1650], shR: [-180, 0, 1430], shL: [180, 0, 1430], hipR: [-90, 0, 950], hipL: [90, 0, 950], footR: [-90, 0, 40], knee: [-90, 0, 480], chest: [0, 0, 1300] };
const names = Object.keys(P), arr = new Float32Array(names.flatMap(n => P[n]));
const at = (out, n) => { const i = names.indexOf(n); return [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]]; };

test('ноль замеров: фигура не меняется', () => { const o = poseVerts(arr, { headForward: NEUTRAL.headForward }); for (let i = 0; i < arr.length; i++) assert.ok(Math.abs(o[i] - arr[i]) < 1e-3); });
test('правое плечо ниже: правое плечо опускается, стопы на месте', () => {
  const o = poseVerts(arr, { shoulderTilt: 6 }); assert.ok(at(o, 'shR')[2] < at(o, 'shL')[2] - 20); assert.deepEqual(at(o, 'footR').map(Math.round), P.footR);
});
test('таз: правая сторона ниже, плечи не наклоняются', () => {
  const o = poseVerts(arr, { pelvicTilt: 5 }); assert.ok(at(o, 'hipR')[2] < at(o, 'hipL')[2] - 8); assert.ok(Math.abs(at(o, 'shR')[2] - at(o, 'shL')[2]) < 1);
});
test('голова к правому плечу и корпус вправо уводят верх в сторону x < 0', () => {
  assert.ok(at(poseVerts(arr, { headTilt: 8 }), 'head')[0] < -5); assert.ok(at(poseVerts(arr, { trunkLateral: 4 }), 'chest')[0] < -5);
});
test('голова и таз вперед уходят в y < 0, колено назад в y > 0', () => {
  assert.ok(at(poseVerts(arr, { headForward: 30 }), 'head')[1] < -20);
  assert.ok(at(poseVerts(arr, { hipShift: .03, headForward: NEUTRAL.headForward }), 'hipR')[1] < -40);
  assert.ok(at(poseVerts(arr, { kneeHyper: 8, headForward: NEUTRAL.headForward }), 'knee')[1] > 30);
});
test('«Усилить» ×2 удваивает отклонение от нейтрали, а у наклона головы вперед считает от типовой фигуры', () => {
  const g = scalePose({ shoulderTilt: 3, headForward: 20 }, 2); assert.equal(g.shoulderTilt, 6); assert.equal(g.headForward, NEUTRAL.headForward + 16);
  const q = { by: { front: [{ key: 'shoulderTilt', v: 2 }, { key: 'headTilt', v: 1 }], right: [{ key: 'headForward', v: 20, unit: '°' }, { key: 'hipShift', v: 3, unit: ' см' }] }, h: 170 };
  const p = poseOf(q, 1.5); assert.equal(p.shoulderTilt, 3); assert.ok(Math.abs(p.hipShift - 3 / 170 * 1.5) < 1e-9);
});
test('голень и бедро прямые: середина голени смещается на половину колена', () => {
  const a = new Float32Array([-90, 0, 280, -90, 0, 480, -90, 0, 715]), o = poseVerts(a, { kneeHyper: -10, headForward: NEUTRAL.headForward });
  assert.ok(o[4] < -30); assert.ok(Math.abs(o[1] - o[4] * (280 - 80) / 400) < 1); assert.ok(Math.abs(o[7] - o[4] / 2) < 1);
});
test('голова вперед: макушка и подбородок сдвигаются почти одинаково, шея не ломается', () => {
  const a = new Float32Array([0, 0, 1700, 0, -80, 1520]), o = poseVerts(a, { headForward: 40 });
  assert.ok(o[1] < -50); assert.ok(Math.abs(o[1] - (o[4] + 80)) < 40);
});
