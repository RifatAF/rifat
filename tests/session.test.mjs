import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickUnits, classify, compare, mdcOf, observations, SESSION_FEATURES, MAX_SEC } from '../js/session-protocol.js';
import { retestStats } from '../api/_autolearn.js';

// длительности и порядок как в app.js (UNITS, ORDER): app.js тянет браузерные модули, поэтому копия здесь
const SEC = { stand: 17, ohs_front: 36, fwd: 18, slb: 22, trot: 18, reach: 18, chair: 40 };
const ORDER = ['stand', 'ohs_front', 'fwd', 'slb', 'sls', 'trot', 'reach', 'chair'];
const order = u => ORDER.filter(x => u.includes(x)), sec = u => SEC[u];
const total = u => u.reduce((a, x) => a + sec(x), 0);

test('подбор по одной жалобе: блоки таблицы в порядке прохождения', () => {
  assert.deepEqual(pickUnits(['knee'], sec, order), ['ohs_front', 'slb']);
  assert.deepEqual(pickUnits(['neck'], sec, order), ['stand', 'reach']);
  assert.deepEqual(pickUnits(['low_back'], sec, order), ['fwd', 'trot']);
});
test('много жалоб: не больше 3 блоков, без дублей, сначала общие, не дольше 90 с', () => {
  const u = pickUnits(['neck', 'shoulder', 'upper_back', 'low_back', 'knee'], sec, order);
  assert.ok(u.length <= 3); assert.equal(new Set(u).size, u.length); assert.ok(total(u) <= MAX_SEC);
  assert.ok(u.includes('reach'), 'reach покрывает три жалобы'); assert.ok(u.includes('stand') || u.includes('trot'));
});
test('2 блока не дольше 90 с, 3 блока не дольше 2 минут: для всех сочетаний жалоб', () => {
  const keys = ['neck', 'shoulder', 'upper_back', 'low_back', 'hip', 'knee', 'foot', 'prevention'];
  for (let m = 1; m < 1 << keys.length; m++) { const u = pickUnits(keys.filter((_, i) => m >> i & 1), sec, order);
    assert.ok(u.length >= 1 && u.length <= 3); assert.ok(total(u) <= (u.length <= 2 ? 90 : 120), u.join()); }
});
test('без жалоб: профилактика', () => assert.ok(pickUnits([], sec, order).length >= 2));
test('острая боль 7 и выше: только вставание со стула', () => {
  assert.deepEqual(pickUnits(['knee', 'neck'], sec, order, 7), ['chair']); assert.deepEqual(pickUnits(['knee'], sec, order, 9), ['chair']);
  assert.notDeepEqual(pickUnits(['knee'], sec, order, 6), ['chair']);
});
test('классификация: |Δ| ≤ MDC никогда не «лучше», ухудшение ≤ 2×MDC никогда не «хуже»', () => {
  for (const [k, F] of Object.entries(SESSION_FEATURES)) { const m = F.mdc, a = F.up ? 50 : 10, s = F.up ? 1 : -1;
    assert.equal(classify(k, a, a + s * m, m), 'same', k); assert.equal(classify(k, a, a + s * m * .5, m), 'same', k);
    assert.equal(classify(k, a, a + s * m * 1.01, m), 'better', k);
    assert.equal(classify(k, a, a - s * m * 1.5, m), 'fluct', k); assert.equal(classify(k, a, a - s * m * 2, m), 'fluct', k);
    assert.equal(classify(k, a, a - s * m * 2.01, m), 'worse', k); }
  // знак угла не важен: перекос 3° вправо и 3° влево одинаков
  assert.equal(classify('pelvic_tilt', 3, -3, 2), 'same');
});
test('смешанная картина: часть лучше, часть хуже, без вердикта «лучше»', () => {
  const r = compare({ valgus_max: 14, sq_depth: 100, reach_r: 150 }, { valgus_max: 4, sq_depth: 100, reach_r: 120 }, null);
  assert.equal(r.verdict, 'mixed'); assert.equal(r.rows.find(x => x.key === 'valgus_max').c, 'better'); assert.equal(r.rows.find(x => x.key === 'reach_r').c, 'worse');
  assert.equal(compare({ valgus_max: 14 }, { valgus_max: 4 }, null).verdict, 'better');
  assert.equal(compare({ valgus_max: 14 }, { valgus_max: 12 }, null).verdict, 'same');
  assert.equal(compare({ valgus_max: 4, reach_r: 150 }, { valgus_max: 14, reach_r: 160 }, null).verdict, 'mixed', 'колебание не считается улучшением');
});
test('порог шума: по контрольным повторам при n ≥ 10, короткий интервал важнее, иначе по умолчанию', () => {
  assert.equal(mdcOf('valgus_max', null), SESSION_FEATURES.valgus_max.mdc);
  assert.equal(mdcOf('valgus_max', { features: { valgus_max: { n: 9, sem: 1 } } }), SESSION_FEATURES.valgus_max.mdc);
  assert.ok(Math.abs(mdcOf('valgus_max', { features: { valgus_max: { n: 12, sem: 1 } } }) - 1.96 * Math.SQRT2) < 1e-9);
  assert.ok(Math.abs(mdcOf('valgus_max', { features: { valgus_max: { n: 12, sem: 2 } }, featuresShort: { valgus_max: { n: 10, sem: 1 } } }) - 1.96 * Math.SQRT2) < 1e-9);
});
test('retestStats: отдельная статистика шума для интервала меньше 15 минут', () => {
  const pair = (gapMin, d) => ({ workout: false, gap: gapMin * 60, gapMin, f1: { valgus_max: 10 + d }, f2: { valgus_max: 10 - d }, m1: {}, m2: {} });
  const ps = [...Array(12)].map((_, i) => pair(5, i % 2 ? 1 : -1)).concat([...Array(12)].map((_, i) => pair(60 * 24, i % 2 ? 4 : -4)));
  const r = retestStats(ps); assert.equal(r.nShort, 12); assert.ok(r.featuresShort.valgus_max.sem < r.features.valgus_max.sem);
});
test('наблюдения: язык видимого, не больше трех', () => {
  const o = observations({ valgus_max: 15, shoulder_tilt: 5, reach_r: 140, slb_drop_r: 9, sq_depth: 120 });
  assert.equal(o.length, 3); assert.ok(o.every(x => typeof x.text === 'string'));
});
test('в экранах режима нет запрещенных слов', () => {
  const src = ['js/session.js', 'js/session-protocol.js'].map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  const strings = (src.match(/'[^'\n]*'|`[^`]*`/g) || []).join('\n');
  for (const w of [/гипертонус/i, /перегруз/i, /слабост/i, /укорочен/i, /(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/, /процент[а-я]* мышц/i, /pct\(/]) assert.ok(!w.test(strings), String(w));
});
