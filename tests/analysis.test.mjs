// Устойчивость находок: голосование по повторам и согласие ракурсов спереди и сзади.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findings, features } from '../js/analysis.js';
const rules = JSON.parse(fs.readFileSync(new URL('../data/bodymap.json', import.meta.url))).rules;
const t = (fr, br) => ({ moves: { ohs_front: { f: { ohs_valgus_r: 14, ohs_valgus_l: 2, reps: { valgus_r: fr, valgus_l: [2, 2, 2, 2, 2] } }, quality: 'GOOD' }, ...(br ? { ohs_back: { f: { back_valgus_r: br[0], back_valgus_l: 1, reps: { valgus_r: br[1], valgus_l: [1, 1, 1] } }, quality: 'GOOD' } } : {}) }, quality: {} });
const knee = f => findings(rules, f).find(x => x.rule.id === 'knee_valgus');

test('колено внутрь: засчитывается, если видно в большинстве повторов', () => {
  assert.ok(knee(features(t([14, 15, 13, 16, 14]))), 'во всех повторах');
  assert.equal(knee(features(t([30, 2, 3, 2, 2]))), undefined, 'один выброс — шум');
  assert.ok(knee(features(t([14, 15, 3, 2, 2]))).borderline, '2 из 5 — на границе'); assert.ok(!knee(features(t([14, 15, 3, 2, 14]))).borderline, '3 из 5 — засчитано');
});
test('колено внутрь: спереди есть, сзади нет — на границе', () => {
  const f = features(t([14, 15, 13, 16, 14], [2, [2, 3, 2]]));
  const k = knee(f); assert.ok(!k || k.borderline);
});

// подъемы на носок: 5 подъемов за 15 с, 30 кадров/с; в широких штанах пятка «плавает» и видна плохо
import { Movement } from '../js/analysis.js';
const calfFrames = (n, heelVis) => Array.from({ length: 450 }, (_, i) => { const t = i / 30, ph = Math.sin(Math.PI * n * t / 15) ** 2, rise = 40 * ph, noise = () => (Math.random() - .5) * 6;
  const p = Array.from({ length: 33 }, () => ({ x: 500, y: 500, visibility: .95 }));
  const at = (i, x, y, v = .95) => { p[i] = { x, y, visibility: v }; };
  at(0, 500, 200 - rise); at(11, 460, 300 - rise); at(12, 540, 300 - rise); at(23, 470, 600 - rise); at(24, 530, 600 - rise);
  at(25, 470, 800 - rise * .9); at(26, 530, 800 - rise * .9); at(27, 470, 1000 - rise * .5 + noise(), heelVis); at(28, 530, 1000 - rise * .5 + noise(), heelVis);
  at(29, 470, 1010 - rise + noise() * 2, heelVis); at(30, 530, 1010 - rise + noise() * 2, heelVis);
  return { t, p }; });
test('подъемы на носок: считает 5 подъемов и при плохо видной пятке', () => {
  for (const hv of [.95, .3]) assert.equal(Movement.calfRaise(calfFrames(5, hv), true).f.calf_reps_r, 5, 'видимость пятки ' + hv);
  assert.equal(Movement.calfRaise(calfFrames(0, .95), true).f.calf_reps_r, 0, 'без подъемов');
});

// ---------- аудит сторон 03.11.2026: перекосы во фронтальной плоскости ----------
const snap = s => features({ snapshot: s, moves: {}, protocol: [] });
const muscOf = (f, id) => (findings(rules, f).find(x => x.rule.id === id) || { muscles: [] }).muscles.map(m => `${m.id}:${m.side}:${m.state}`).sort();
test('таз ниже справа: слабая отводящая на высокой (левой) стороне, напрягатель фасции на низкой (Kendall)', () => {
  const m = muscOf(snap({ pelvicTilt: 5, trunkLateral: 0, shoulderTilt: 0, headTilt: 0 }), 'pelvis_tilt');
  assert.deepEqual(m, ['glute_med:LEFT:WEAK', 'tfl:RIGHT:SHORT']);
});
test('квадратная поясницы: сторона по наклону корпуса относительно таза', () => {
  // корпус ровный, таз ниже справа: поясница изогнута влево, вогнутая сторона левая (высокое бедро по Kendall)
  assert.deepEqual(muscOf(snap({ pelvicTilt: 5, trunkLateral: 0 }), 'trunk_shift'), ['obliques:LEFT:SHORT', 'ql:LEFT:SHORT']);
  // корпус ушел вправо вслед за тазом на тот же угол: изгиба нет, вывода о сторонах нет
  assert.deepEqual(muscOf(snap({ pelvicTilt: 3, trunkLateral: 3.4 }), 'trunk_shift'), []);
  // таз ровный, корпус наклонен вправо: короче правый бок
  assert.deepEqual(muscOf(snap({ pelvicTilt: 0, trunkLateral: 5 }), 'trunk_shift'), ['obliques:RIGHT:SHORT', 'ql:RIGHT:SHORT']);
});
test('плечо выше: верхняя трапециевидная укорочена на высокой стороне, а не «перерастянута»', () => {
  assert.deepEqual(muscOf(snap({ shoulderTilt: 5 }), 'shoulder_tilt'), ['levator:LEFT:SHORT', 'lower_trap:LEFT:WEAK', 'upper_trap:LEFT:SHORT']);
});
test('голова к правому плечу: укорочены правые грудино-ключично-сосцевидная и лестничные', () => {
  assert.deepEqual(muscOf(snap({ headTilt: 5 }), 'head_tilt'), ['scalene:RIGHT:SHORT', 'scm:RIGHT:SHORT']);
});
test('упражнение «Наклон в сторону» тянет бок, указанный в названии', () => {
  const ex = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('../data/exercises.json', import.meta.url))).exercises.map(e => [e.id, e]));
  assert.match(ex.ex_side_stretch_left.steps.join(' '), /левую руку.*вправо.*левый бок/);
  assert.match(ex.ex_side_stretch_right.steps.join(' '), /правую руку.*влево.*правый бок/);
  assert.match(ex.ex_ql_stretch_left.steps.join(' '), /левую руку.*вправо/);
});
