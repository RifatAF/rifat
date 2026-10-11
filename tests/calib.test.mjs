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
