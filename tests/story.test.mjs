import test from 'node:test';
import assert from 'node:assert/strict';
import { story } from '../js/story.js';
const m = (key, v, err, unit, dir = 'x') => ({ key, v, err, unit, dir });

test('story: таз вперед и плечи назад дают цепочку снизу вверх с числами замера', () => {
  const by = { right: [m('headForward', 17.8, 4, '°'), m('shoulderShift', -3, 1.5, ' см'), m('hipShift', 3.9, 1.5, ' см')], left: [m('headForward', 13.3, 4, '°'), m('shoulderShift', -1.7, 1.5, ' см'), m('hipShift', 3.7, 1.5, ' см')],
    back: [m('shoulderTilt', 3.5, 1.5, '°'), m('trunkLateral', 3.4, 1.5, '°')], front: [m('trunkLateral', .8, 1.5, '°', 'в пределах погрешности')] };
  const s = story(by);
  assert.equal(s.items[0].key, 'sway');
  assert.deepEqual(s.items[0].chain, ['Таз впереди стоп на 3,8 см', 'Плечи позади таза на 2,4 см', 'Голова впереди плеча на 15,6°']);
  // в цепочке вбок число как в «Измерено» (вид вне погрешности), а не среднее с видом в пределах
  assert.ok(s.items.find(x => x.key === 'side').chain.includes('Корпус смещен вправо на 3,4°'));
  assert.match(s.main, /^Таз подан вперед/);
});

test('story: без отклонений пусто, невозможные значения не идут', () => {
  assert.deepEqual(story({ front: [m('headTilt', 1, 2, '°', 'в пределах погрешности')] }).items, []);
  assert.deepEqual(story({ squat: [{ ...m('squatKneeR', 68, 5, '°'), suspect: true }] }).items, []);
});

test('story: клиенту без состояний мышц, диагнозов и боли', () => {
  const by = { right: [m('headForward', 25, 4, '°'), m('shoulderShift', 4, 1.5, ' см')], front: [m('kneeR', 9, 5, '°'), m('pelvicTilt', 3, 1.5, '°')], squat: [m('squatPelvis', 4, 2, '°')] };
  const txt = JSON.stringify(story(by)).toLowerCase();
  // с начала слова: «больше» и «расслабить» допустимы
  assert.doesNotMatch(txt, /(?<![а-яё])(бол[ьи](?![а-яё])|болев|зажат|слаб|спазм|диагноз|гипертонус|укорочен)/);
});
