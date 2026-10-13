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
