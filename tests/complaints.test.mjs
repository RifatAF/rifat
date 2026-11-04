// Жалобы: разбор текста специалиста, поправка плана по боли, метки на 3D.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseComplaints, mergeComplaints, painPlan, painSpots, loadOf } from '../js/complaints.js';
const EX = new Set(JSON.parse(fs.readFileSync(new URL('../data/exercises.json', import.meta.url))).exercises.map(e => e.id));
const has = id => EX.has(id);
const pc = t => parseComplaints(t).map(e => [e.z, e.s, e.p]);

test('текст: зона, сторона и сила боли', () => {
  assert.deepEqual(pc('Боль в колене правом, в локте левом'), [['knee', 'RIGHT', null], ['elbow', 'LEFT', null]]);
  assert.deepEqual(pc('болит правое колено 6/10 после бега и ноет левое плечо'), [['knee', 'RIGHT', 6], ['shoulder', 'LEFT', 3]]);
  assert.deepEqual(pc('поясница, 7 из 10'), [['low_back', null, 7]]);
  assert.deepEqual(pc('колено ноет, правое'), [['knee', 'RIGHT', 3]]);
  assert.deepEqual(pc('болят оба колена'), [['knee', 'BOTH', null]]);
  assert.deepEqual(pc('Острая боль в пояснице слева'), [['low_back', 'LEFT', 7]]);
  assert.deepEqual(pc('в докте левом'), [['elbow', 'LEFT', null]]);
  assert.deepEqual(pc('тазобедренный справа, пятка слева'), [['hip', 'RIGHT', null], ['foot', 'LEFT', null]]);
});
test('текст: без отрицаний и ложных слов', () => {
  assert.deepEqual(pc('колено больше не болит'), []);
  assert.deepEqual(pc('плечо прошло'), []);
  assert.deepEqual(pc('на прошлой неделе заболело колено'), [['knee', null, null]]);
  assert.deepEqual(pc('отправил запах показал'), []);
  assert.deepEqual(pc('всё поправилось, плечо'), [['shoulder', null, null]]);
});
test('ручные правки главнее текста, удаленное не возвращается', () => {
  const m = mergeComplaints('колено справа, плечо слева', [{ z: 'knee', s: 'RIGHT', p: 8 }], ['shoulder:LEFT']);
  assert.deepEqual(m.map(e => [e.z, e.s, e.p]), [['knee', 'RIGHT', 8]]);
});
test('план: сильная боль убирает любую нагрузку на зону, средняя только основную', () => {
  const ids = ['ex_hip_flexor_stretch_left', 'ex_glute_bridge_left', 'ex_chin_tuck', 'ex_deep_squat_hold'].filter(has);
  const mid = painPlan(ids, [{ z: 'knee', s: 'RIGHT', p: 5 }], { has, add: false });
  assert.ok(!mid.ids.includes('ex_deep_squat_hold') && mid.ids.includes('ex_glute_bridge_left'));
  const hi = painPlan(ids, [{ z: 'knee', s: 'RIGHT', p: 8 }], { has });
  assert.ok(!hi.ids.some(id => loadOf(id).knee), 'при 8/10 нагрузки на колено нет');
  assert.equal(hi.added.length, 0, 'при сильной боли ничего не добавляем'); assert.equal(hi.acute.length, 1);
});
test('план: по жалобе добавляется упражнение нужной стороны, база не теряется', () => {
  const r = painPlan(['ex_chin_tuck'], [{ z: 'knee', s: 'RIGHT', p: 3 }], { has });
  assert.ok(r.ids.includes('ex_clamshell_right') && !r.ids.includes('ex_clamshell_left') && r.ids.includes('ex_chin_tuck'));
  const sh = painPlan([], [{ z: 'shoulder', s: 'LEFT', p: 5 }], { has });
  assert.deepEqual(sh.ids, ['ex_wall_er_iso'], 'при средней боли в плече изометрия, не резинка');
  const ft = painPlan([], [{ z: 'foot', s: 'LEFT', p: 4 }], { has });
  assert.deepEqual(ft.ids, ['ex_calf_raise_left'], 'нагрузка для стопы своей зоной не отрезается');
  assert.ok(painPlan(Array.from({ length: 8 }, (_, i) => 'x' + i), [{ z: 'hip', s: 'LEFT', p: 2 }], { has }).ids.length <= 8);
});
test('метки 3D: левая сторона при x > 0, без стороны две метки', () => {
  assert.ok(painSpots([{ z: 'knee', s: 'LEFT' }])[0].c[0] > 0);
  assert.ok(painSpots([{ z: 'knee', s: 'RIGHT' }])[0].c[0] < 0);
  assert.equal(painSpots([{ z: 'neck', s: null }]).length, 2);
});
