import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebalance, stateScores, cnsDelta } from '../js/muscle-logic.js';

const kind = t => t.k0 || 'SHORT';
test('Майерс: гипертонус грудной перерастягивает широчайшую той же стороны', () => {
  const out = rebalance([{ id: 'pec_major', side: 'RIGHT', tone: .8 }], kind);
  const l = out.find(x => x.id === 'lats' && x.side === 'RIGHT');
  assert.equal(l.kind, 'HYPER'); assert.ok(l.tone > .25); assert.equal(l.cause.law, 'myers'); assert.equal(l.cause.id, 'pec_major');
  assert.ok(!out.some(x => x.id === 'lats' && x.side === 'LEFT'));
});
test('Шеррингтон: напряженная трапеция тормозит нижнюю, свой замер не перебивается', () => {
  const out = rebalance([{ id: 'upper_trap', side: 'LEFT', tone: .7 }, { id: 'lower_trap', side: 'RIGHT', tone: .5 }, { id: 'upper_trap', side: 'RIGHT', tone: .7 }], kind);
  assert.equal(out.find(x => x.id === 'lower_trap' && x.side === 'LEFT').kind, 'WEAK');
  assert.equal(out.find(x => x.id === 'lower_trap' && x.side === 'RIGHT').tone, .5);
});
test('Шарман: слабая средняя ягодичная дает защитный гипертонус соседей', () => {
  const out = rebalance([{ id: 'glute_med', side: 'LEFT', tone: -.7 }], kind);
  assert.equal(out.find(x => x.id === 'tfl' && x.side === 'LEFT').kind, 'SHORT');
  assert.equal(out.find(x => x.id === 'tfl' && x.side === 'LEFT').cause.law, 'sahr');
});
test('перерастяжение не тянет за собой новые выводы и слабый признак не запускает законы', () => {
  const out = rebalance([{ id: 'pec_major', side: 'LEFT', tone: .4 }, { id: 'rectus_fem', side: 'LEFT', tone: .9, k0: 'HYPER' }], kind);
  assert.equal(out.length, 2);
});
test('Коларж: Rib Flare выключает косые мышцы', () => {
  const out = rebalance([], kind, { ribFlare: true });
  assert.equal(out.filter(x => x.id === 'obliques' && x.kind === 'WEAK').length, 2);
});
test('проценты: стороны отдельно, перекос и предел 100%', () => {
  const sp = [{ k: 'SHORT', side: 'RIGHT', tone: .9 }, { k: 'SHORT', side: 'RIGHT', tone: .6 }, { k: 'SHORT', side: 'LEFT', tone: .3 }, { k: 'WEAK', side: 'LEFT', tone: -1 }, { k: 'WEAK', side: 'LEFT', tone: -1 }, { k: 'WEAK', side: 'LEFT', tone: -1 }, { k: 'WEAK', side: 'LEFT', tone: -1 }];
  const s = stateScores(sp);
  assert.deepEqual([s.SHORT.L, s.SHORT.R, s.SHORT.asym], [10, 50, 40]); assert.equal(s.WEAK.L, 100); assert.equal(s.HYPER.all, 0);
});
test('бета: дельта ЦНС считает прибавку по состояниям и мышцам', () => {
  const a = [{ key: 'upper_trap:LEFT', id: 'upper_trap', side: 'LEFT', k: 'SHORT', tone: .6 }], b = [{ key: 'upper_trap:LEFT', id: 'upper_trap', side: 'LEFT', k: 'SHORT', tone: .3 }];
  const d = cnsDelta(a, b); assert.equal(d.scores.SHORT, 5); assert.equal(d.muscles[0].d, 30);
});
