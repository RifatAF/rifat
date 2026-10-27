// «Быстрый тест» ТЗ v4: показатели по точкам фото, сторона, погрешность, проверка кадра.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewMetrics, quickMetrics, observations, frameIssue, VIEWS } from '../js/quick-metrics.js';

// человек ростом ~1000 px на фото 800×1200, вид спереди (задняя камера: правая сторона клиента слева на фото)
function front({ rShDrop = 0, rHipDrop = 0 } = {}) {
  const p = Array.from({ length: 33 }, () => ({ x: 400, y: 600, visibility: 1 }));
  const set = (i, x, y) => { p[i] = { x, y, visibility: 1 }; };
  set(0, 400, 150); set(7, 430, 160); set(8, 370, 160);
  set(11, 500, 300); set(12, 300, 300 + rShDrop); set(23, 450, 600); set(24, 350, 600 + rHipDrop);
  set(25, 450, 850); set(26, 350, 850); set(27, 450, 1100); set(28, 350, 1100);
  return p;
}
function sideR({ earFwd = 0 } = {}) {
  const p = Array.from({ length: 33 }, () => ({ x: 400, y: 600, visibility: .2 }));
  const set = (i, x, y) => { p[i] = { x, y, visibility: 1 }; };
  set(0, 440 + earFwd, 150); set(8, 400 + earFwd, 160); set(12, 400, 300); set(24, 400, 600); set(26, 400, 850); set(28, 400, 1100);
  set(7, 400 + earFwd, 160); set(11, 400, 300); set(23, 400, 600); set(25, 400, 850); set(27, 400, 1100);
  return p;
}

test('спереди: ровная стойка в пределах погрешности, правое плечо ниже определяется со стороной', () => {
  const even = viewMetrics('front', front(), 800, 1200);
  assert.equal(even.length, 6); assert.ok(even.every(m => m.dir === 'в пределах погрешности'));
  const drop = viewMetrics('front', front({ rShDrop: 16 }), 800, 1200).find(m => m.key === 'shoulderTilt');
  assert.equal(drop.dir, 'правое ниже'); assert.ok(drop.v > 4.4 && drop.v < 4.8, String(drop.v));
});
test('колени спереди: внутрь (Х) и наружу (О) от линии бедро–лодыжка, полуприсед идет в правила зон', () => {
  const p = front(); p[26] = { x: 375, y: 850, visibility: 1 }; p[25] = { x: 425, y: 850, visibility: 1 };
  const m = viewMetrics('front', p, 800, 1200), r = m.find(x => x.key === 'kneeR'), l = m.find(x => x.key === 'kneeL');
  assert.equal(r.dir, 'внутрь'); assert.equal(l.dir, 'внутрь'); assert.ok(r.v > 5, String(r.v));
  const o = front(); o[26] = { x: 325, y: 850, visibility: 1 }; assert.equal(viewMetrics('front', o, 800, 1200).find(x => x.key === 'kneeR').dir, 'наружу');
  const sq = viewMetrics('squat', p, 800, 1200); assert.deepEqual(sq.map(x => x.key), ['squatKneeR', 'squatKneeL', 'squatPelvis']);
  const q = quickMetrics({ front: { pts: front(), w: 800, h: 1200 }, squat: { pts: p, w: 800, h: 1200 } });
  assert.ok(q.moves.ohs_front.f.ohs_valgus_r > 5); assert.deepEqual(quickMetrics({ front: { pts: front(), w: 800, h: 1200 } }).moves, {});
});
test('крен телефона вычитается', () => {
  const p = front(); const a = 4 * Math.PI / 180, cx = 400, cy = 600;
  const rot = p.map(l => ({ ...l, x: cx + (l.x - cx) * Math.cos(a) - (l.y - cy) * Math.sin(a), y: cy + (l.x - cx) * Math.sin(a) + (l.y - cy) * Math.cos(a) }));
  const raw = viewMetrics('front', rot, 800, 1200, 0).find(m => m.key === 'shoulderTilt'), fixed = viewMetrics('front', rot, 800, 1200, -4).find(m => m.key === 'shoulderTilt');
  assert.ok(Math.abs(raw.v) > 3, 'без поправки видно наклон'); assert.ok(Math.abs(fixed.v) < .2, 'с поправкой ровно');
});
test('сбоку: голова впереди, сдвиги в см по росту', () => {
  const m = viewMetrics('right', sideR({ earFwd: 60 }), 800, 1200, 0, 170);
  const hf = m.find(x => x.key === 'headForward'); assert.equal(hf.dir, 'впереди'); assert.ok(hf.v > 20);
  assert.equal(m.find(x => x.key === 'hipShift').unit, ' см');
  assert.equal(viewMetrics('right', sideR(), 800, 1200).find(x => x.key === 'shoulderShift').unit, '% роста');
});
test('сводка для правил зон и «что видно» без оценочных слов', () => {
  const q = quickMetrics({ front: { pts: front({ rShDrop: 16, rHipDrop: 12 }), w: 800, h: 1200 }, right: { pts: sideR({ earFwd: 60 }), w: 800, h: 1200 } }, 170);
  assert.ok(q.snapshot.shoulderTilt > 4); assert.ok(q.side.headForwardDeg > 20); assert.equal(q.by.back, null);
  const o = observations(q.by); assert.ok(o.length >= 3); assert.ok(o[0].includes(','));
  assert.ok(!o.join(' ').match(/норм|патолог|диагноз|нарушен|слаб|зажат/i));
});
test('проверка кадра', () => {
  assert.equal(frameIssue('front', front(), 800, 1200), '');
  assert.match(frameIssue('right', front(), 800, 1200), /боком/);
  assert.match(frameIssue('front', sideR(), 800, 1200), /спереди/);
  const far = front().map(l => ({ ...l, y: 500 + (l.y - 600) * .3 })); assert.match(frameIssue('front', far, 800, 1200), /ближе/);
  assert.match(frameIssue('front', null, 800, 1200), /не найден/);
  assert.equal(VIEWS.length, 4);
});
