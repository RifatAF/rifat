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
