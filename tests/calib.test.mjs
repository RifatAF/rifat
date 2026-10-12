// Сверка оценки специалиста с ответом приложения: совпало, другая сторона, наоборот, не увидело, тест не измеряет, лишнее.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibCompare } from '../js/analysis.js';

test('калибровка: исходы сверки', () => {
  const rules = [{ muscles: [{ id: 'calf' }, { id: 'glute_med' }, { id: 'lats' }, { id: 'ql' }] }];
  const tones = [{ id: 'calf', side: 'RIGHT', tone: -1 }, { id: 'glute_med', side: 'LEFT', tone: -.5 }, { id: 'lats', side: 'LEFT', tone: .5 }, { id: 'triceps', side: 'RIGHT', tone: .4 }, { id: 'ql', side: 'LEFT', tone: .1 }, { id: 'lats', side: 'RIGHT', tone: .6, derived: true }];
  const labels = [{ muscle: 'calf', side: 'LEFT', state: 'WEAK' }, { muscle: 'glute_med', side: 'LEFT', state: 'WEAK' }, { muscle: 'lats', side: 'LEFT', state: 'WEAK' }, { muscle: 'ql', side: 'RIGHT', state: 'HYPER' }, { muscle: 'suboccipital', side: 'BOTH', state: 'WEAK' }];
  const r = calibCompare(labels, tones, rules), by = Object.fromEntries(r.rows.map(x => [x.id + ':' + x.side, x.res]));
  assert.equal(by['calf:LEFT'], 'side'); assert.equal(by['glute_med:LEFT'], 'match'); assert.equal(by['lats:LEFT'], 'opposite');
  assert.equal(by['ql:RIGHT'], 'missed', 'слабый тон 0,1 не гипотеза'); assert.equal(by['suboccipital:LEFT'], 'notMeasured'); assert.equal(by['suboccipital:RIGHT'], 'notMeasured');
  assert.deepEqual(r.extra.map(x => x.id), ['triceps'], 'выведенные по цепи не считаются'); assert.equal(r.counts.expert, 6);
});

test('обучение весов: опровергнутая связь теряет вес, подтвержденная набирает', async () => {
  const fs = await import('node:fs'); const { learnWeights } = await import('../js/calibreport.js');
  const j = n => JSON.parse(fs.readFileSync(new URL('../data/' + n + '.json', import.meta.url)));
  const C = { muscles: j('muscles').muscles, bodymap: j('bodymap'), chains: j('chains').chains };
  // локоть сгибается в приседе справа (60°): правило говорит «трицепс и широчайшая укорочены»; специалист: трицепс слабый, широчайшая перегружена
  const doc = () => ({ case: { expert: { labels: [{ muscle: 'triceps', side: 'RIGHT', state: 'WEAK' }, { muscle: 'lats', side: 'RIGHT', state: 'HYPER' }] },
    assessments: [{ date: '2026-10-12', moves: { ohs_front: { f: { ohs_elbow_r: 60 }, quality: 'GOOD' } }, quality: { ohs_front: 100 } }] } });
  const lw = learnWeights([doc(), doc()], C), by = Object.fromEntries(lw.map(x => [x.key, x]));
  assert.ok(by['elbow_bend_r|triceps'].nw < by['elbow_bend_r|triceps'].w, 'трицепс: вес ниже');
  assert.ok(by['elbow_bend_r|lats'].nw > by['elbow_bend_r|lats'].w, 'широчайшая: вес выше');
  assert.equal(learnWeights([doc()], C).length, 0, 'одного мнения мало');
});
