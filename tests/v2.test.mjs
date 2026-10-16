// Ядро v2.0: батарея тестов, светофор, железо, состояния мышц, ВНС-блок, касания.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forwardBend, singleBalance, thoracicRotation, overheadReach, chairStand, retroGait, autoScale, mergeV2, BATTERY, BATTERY_SEC } from '../js/test-battery.js';
import { matchScore, falseStart, COUNT_WORDS } from '../js/pacing-guard.js';
import { perspK, pinhole, jerk } from '../js/hardware-adapter.js';
import { STATES, releaseFor, measuredIds, iapAssess, ribFlare, normPose, ghostDiff, layerOf } from '../js/biomechanics-engine.js';
import { lemniscate, rppg, pursuitStats, saccadeLatency, stimulusAt, headPose, irisInEye, irisConfidence, gazeAngles, faceDistanceCm, FLASH_AT, T } from '../js/vns-phenotype.js';
import { metrics, energyWord } from '../js/touch-tracker.js';
import { setSession, MODES, passiveOn, aiRecsOn, uiLang } from '../js/session-controller.js';

// стоящий человек 1000×1000: голова сверху, лодыжки внизу
const body = (o = {}) => { const p = Array.from({ length: 33 }, () => ({ x: 500, y: 500, visibility: .95 }));
  const at = (i, x, y) => { p[i] = { x, y, visibility: .95 }; };
  at(0, 500, 150); at(2, 490, 140); at(5, 510, 140); at(7, 470, 150); at(8, 530, 150); at(11, 440, 260); at(12, 560, 260); at(13, 420, 380); at(14, 580, 380); at(15, 410, 480); at(16, 590, 480);
  at(23, 460, 520); at(24, 540, 520); at(25, 460, 700); at(26, 540, 700); at(27, 460, 880); at(28, 540, 880); at(31, 460, 900); at(32, 540, 900);
  for (const [i, v] of Object.entries(o)) p[i] = { ...p[i], ...v }; return p; };
const frames = (n, f) => Array.from({ length: n }, (_, i) => ({ t: i * 33, p: f(i / (n - 1)) }));

test('батарея: 6 этапов, 2 мин 15 с', () => { assert.equal(BATTERY.length, 6); assert.equal(BATTERY_SEC, 135); });
test('наклон вперед: кисти у стоп дают reach около 1, перекос плеч считается', () => {
  const r = forwardBend(frames(30, k => body({ 15: { y: 480 + 400 * k }, 16: { y: 480 + 400 * k }, 11: { y: 260 + 300 * k }, 12: { y: 270 + 300 * k } })));
  assert.ok(r.f.fwd_reach > .9, 'reach ' + r.f.fwd_reach); assert.ok(r.f.fwd_asym > 0);
});
test('баланс: провал таза на свободную сторону — Тренделенбург', () => {
  const r = singleBalance(frames(20, () => body({ 23: { y: 530 } })), frames(20, () => body()));
  assert.ok(r.f.slb_drop_r > 5, 'drop ' + r.f.slb_drop_r); assert.ok(Math.abs(r.f.slb_drop_l) < 1);
});
test('ротация: сужение плеч вдвое ≈ 60°', () => {
  const rot = frames(20, k => body({ 11: { x: 440 + 30 * k }, 12: { x: 560 - 30 * k } }));
  const r = thoracicRotation(rot, frames(20, () => body()));
  assert.ok(Math.abs(r.f.trot_r - 60) < 2, 'trot ' + r.f.trot_r); assert.ok(r.f.trot_asym > 50);
});
test('руки вверх: угол в плече и подъем надплечья', () => {
  const r = overheadReach(frames(30, k => body({ 13: { x: 440, y: 260 - 120 * k }, 14: { x: 560, y: 260 - 120 * k }, 12: { y: 260 - 40 * k } })));
  assert.ok(r.f.reach_r > 170); assert.ok(r.f.reach_shrug > .1); assert.equal(r.f.reach_shrug_side, 1);
});
test('стул: считает вставания', () => {
  const fr = frames(300, k => { const up = Math.sin(k * Math.PI * 2 * 5) > 0; return body({ 23: { y: up ? 520 : 650 }, 24: { y: up ? 520 : 650 } }); });
  assert.equal(chairStand(fr).f.chair_reps, 5);
});
test('автокалибровка шкалы: 93.6% роста от глаз до лодыжек', () => {
  const s = autoScale(frames(5, () => body()), 180); assert.ok(Math.abs(s.cmPerPx - .936 * 180 / 740) < 1e-3); assert.equal(s.est, false);
});
test('Retro-Gait: шаги только правой дают асимметрию', () => {
  const fr = frames(60, k => body({ 32: { y: 900 - Math.floor(k * 4) * 20 } })); const g = retroGait(fr); assert.ok(g && g.asym > 80);
});
test('признаки батареи попадают в общий набор', () => { const f = mergeV2({}, { slb: { quality: 'GOOD', f: { slb_drop_r: 4 } }, fwd: { quality: 'RETAKE', f: { fwd_reach: .2 } } }); assert.equal(f.slb_drop_r, 4); assert.equal(f.fwd_reach, undefined); });

test('светофор: совпадение с контуром и фальстарт', () => {
  assert.ok(matchScore(body(), 1000, 1000) >= .92); assert.ok(matchScore(body(), 1000, 3000) < .92);
  const g = falseStart(); g.feed(body()); assert.equal(g.feed(body()), false); assert.equal(g.feed(body({ 23: { y: 560 }, 24: { y: 560 } })), true);
  assert.equal(COUNT_WORDS[2], 'Три');
});
test('железо: перспектива, рывок', () => {
  assert.equal(perspK(0), 1); assert.ok(Math.abs(perspK(60) - 1 / Math.cos(35 * Math.PI / 180)) < 1e-9);
  assert.equal(pinhole(body(), 1000, 1)[27].y, 880); assert.ok(pinhole(body(), 1000, 20)[27].y > 880);
  assert.equal(jerk([1, 2, 3, 4, 5], 1), 0); assert.equal(jerk([1, 2, 3, 4], 1, false), null);
});
test('состояния: при Перетяге растяжка и МФР исключены', () => {
  assert.equal(STATES.HYPER.ui, 'Перетяг'); assert.equal(STATES.SHORT.ui, 'Зажим'); assert.equal(STATES.WEAK.ui, 'Спад');
  const ex = id => ({ ex_side_stretch_left: { category: 'растяжка' }, ex_iso_left: { category: 'укрепление' } })[id];
  assert.deepEqual(releaseFor({ relax: ['ex_side_stretch_{s}', 'ex_iso_{s}'] }, 'HYPER', ex), ['ex_iso_{s}']);
  assert.deepEqual(releaseFor({ relax: ['ex_side_stretch_{s}'], activate: ['ex_a'] }, 'HYPER', ex), ['ex_a']);
  assert.deepEqual(releaseFor({ relax: ['ex_side_stretch_{s}'] }, 'SHORT', ex), ['ex_side_stretch_{s}']);
});
test('«Не измерено»: мышца без измеренного признака не попадает в измеренные', () => {
  const rules = [{ feature: 'a', muscles: [{ id: 'glute_med' }] }, { feature: 'b', muscles: [{ id: 'rhomboid' }] }];
  const m = measuredIds({ f: { a: 3 } }, rules); assert.ok(m.has('glute_med')); assert.ok(!m.has('rhomboid'));
});
test('ВБД: маркеры и вклад в мышцы', () => {
  assert.ok(ribFlare(body({ 23: { y: 560 } })) > 12);
  const r = iapAssess({ flare: 15, apicalMm: 5, wink: 2 }); assert.equal(r.marks.length, 1); assert.ok(r.muscles.some(m => m.id === 'erector' && m.state === 'HYPER'));
  assert.equal(iapAssess({ flare: 3, apicalMm: 3, wink: 3 }).marks.length, 0);
});
test('Ghost Overlay: норма симметрична, смещения в мм', () => {
  const p = body({ 11: { y: 280 } }), n = normPose(p); assert.equal(n[11].y, n[12].y);
  const g = ghostDiff(p, .2); assert.ok(g.points.find(x => x.i === 11).mm > 0); assert.ok(g.shoulderDeg !== 0);
  assert.equal(layerOf('erector'), 'deep'); assert.equal(layerOf('upper_trap'), 'surface');
});
test('ВНС: стимул — лемниската 2,0 с, схлопывание, вспышка в углу', () => {
  const a = lemniscate(0, 100, 100), b = lemniscate(.25, 100, 100); assert.ok(a.x > 80 && Math.abs(b.x - 50) < 1);
  assert.equal(stimulusAt(T.PURSUIT + 30, 100, 100).r, .5); const f = stimulusAt(FLASH_AT + 10, 100, 100); assert.ok(f.flash > .9 && f.x > 80 && f.y < 20);
});
// лицо из 478 точек: глаза по центру, радужка 12 px в кадре 1000 px
const face = (dh = 0) => { const lm = Array.from({ length: 478 }, () => ({ x: .5, y: .5 })); const at = (i, x, y) => { lm[i] = { x, y }; };
  at(33, .40, .40); at(133, .46, .40); at(159, .43, .39); at(145, .43, .41); at(362, .54, .40); at(263, .60, .40); at(386, .57, .39); at(374, .57, .41);
  at(468, .43 + dh * .03, .40); at(473, .57 + dh * .03, .40); at(469, .436, .40); at(471, .424, .40); at(474, .576, .40); at(476, .564, .40); return lm; };
test('ВНС: ирис, уверенность, угол взора, расстояние', () => {
  const e = irisInEye(face()); assert.ok(Math.abs(e.h) < 1e-9); assert.ok(irisConfidence(e, { eyeBlinkLeft: 0, eyeBlinkRight: 0 }) >= .8);
  assert.ok(irisConfidence(e, { eyeBlinkLeft: .9 }) < .8, 'моргание');
  const right = irisInEye(face(.5)); assert.ok(right.h > .4); assert.ok(gazeAngles({ yaw: 20, pitch: 0 }, right).total > 25, 'взгляд в сторону');
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; assert.ok(Math.abs(headPose(id).yaw) < 1e-9);
  const c = Math.cos(.5), sn = Math.sin(.5), yawM = [c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1]; assert.ok(Math.abs(Math.abs(headPose(yawM).yaw) - 28.6) < .5);
  const d = faceDistanceCm(face(), 1000); assert.ok(d > 60 && d < 90, 'см ' + d);
});
test('ВНС: слежение, латентность саккады, пульс', () => {
  const s = Array.from({ length: 60 }, (_, i) => { const t = i * 33, tx = lemniscate(t / T.PURSUIT, 360, 640).x / 20; return { t, ok: true, tx, gh: tx * .9, gv: 0 }; }).filter(x => x.t < T.PURSUIT);
  const p = pursuitStats(s); assert.ok(p.corr > .99 && Math.abs(p.gain - .9) < .05);
  const sac = [...Array.from({ length: 8 }, (_, i) => ({ t: FLASH_AT - 200 + i * 25, ok: true, gh: 0, gv: 0 })), ...Array.from({ length: 8 }, (_, i) => { const t = FLASH_AT + i * 33; return { t, ok: true, gh: t - FLASH_AT >= 190 ? 12 : 0, gv: 0 }; })];
  const lat = saccadeLatency(sac); assert.ok(lat >= 190 && lat <= 235, 'мс ' + lat);
  const tr = Array.from({ length: 150 }, (_, i) => { const w = Math.sin(2 * Math.PI * 1.2 * i / 30); return { t: i * 1000 / 30, r: 150 - w * .3, g: 100 + w, b: 80 - w * .2 }; });
  const h = rppg(tr); assert.ok(h.valid && Math.abs(h.hr - 72) < 6, 'hr ' + h.hr);
});
test('касания: виляние, микро-откаты, слова ползунка', () => {
  const m = metrics([[0, 0], [10, 3], [20, -3], [15, 0], [30, 0], [26, 1], [60, 0]]); assert.ok(m.jitter > 0); assert.equal(m.reversals, 2);
  assert.equal(metrics([[0, 0], [30, 0], [60, 0]]).jitter, 0); assert.equal(energyWord(55), 'В норме'); assert.equal(energyWord(5), 'Истощение');
});
test('сессия: в режиме специалиста пассивный сбор и ИИ выключены', () => {
  setSession(MODES.SPEC); assert.equal(passiveOn(), false); assert.equal(aiRecsOn(), false); assert.equal(uiLang(), 'clinical');
  setSession(MODES.SELF); assert.equal(passiveOn(), true);
});
