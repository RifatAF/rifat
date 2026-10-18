// Режим «Сеанс» (только администратор): подбор коротких тестов по жалобам и честное сравнение «до → после» правки руками.
// Здесь только расчеты без экрана и сети: их проверяют unit-тесты (tests/session.test.mjs).

// жалоба → блоки батареи. Черновая таблица, ждет подтверждения Рифата
export const COMPLAINT_UNITS = {
  neck: ['reach', 'stand'], shoulder: ['reach', 'stand'], upper_back: ['trot', 'reach'], low_back: ['fwd', 'trot'],
  hip: ['slb', 'ohs_front'], knee: ['ohs_front', 'slb'], foot: ['ohs_front', 'stand'],
  prevention: ['stand', 'ohs_front', 'reach'],
};
export const COMPLAINTS = [['neck', 'Шея'], ['shoulder', 'Плечо'], ['upper_back', 'Грудной отдел'], ['low_back', 'Поясница'], ['hip', 'Таз, бедро'], ['knee', 'Колено'], ['foot', 'Стопа'], ['prevention', 'Профилактика']];
export const MAX_UNITS = 3, MAX_SEC = 90, ACUTE_PAIN = 7;

/**
 * Блоки теста для жалоб: без дублей, не больше 3, сначала те, что покрывают больше жалоб,
 * суммарно не дольше MAX_SEC по длительностям шагов (sec(u) — секунды блока). order — порядок прохождения (sortUnits).
 * Острая боль 7 и выше: только вставание со стула, как в обычном тесте.
 */
export function pickUnits(complaints, sec, order, acute = 0) {
  if (acute >= ACUTE_PAIN) return ['chair'];
  const list = (complaints && complaints.length ? complaints : ['prevention']).filter(c => COMPLAINT_UNITS[c]);
  const score = new Map(), first = new Map();
  list.forEach((c, ci) => COMPLAINT_UNITS[c].forEach((u, ui) => { score.set(u, (score.get(u) || 0) + 1); if (!first.has(u)) first.set(u, ci * 10 + ui); }));
  const ranked = [...score.keys()].sort((a, b) => score.get(b) - score.get(a) || first.get(a) - first.get(b));
  const out = []; let total = 0;
  for (const u of ranked) { if (out.length >= MAX_UNITS) break; const s = sec(u); if (total + s > MAX_SEC) continue; out.push(u); total += s; }
  return order(out);
}

// признаки, которые видно глазом, с единицами. up: больше = лучше; иначе лучше меньше по модулю.
// mdc: осторожный порог шума по умолчанию, пока пар повторов мало. TODO calibrate по контрольным повторам режима
export const SESSION_FEATURES = {
  shoulder_tilt: { name: 'Плечи на одной высоте', unit: '°', mdc: 2, see: 'Одно плечо выше другого', bad: 3 },
  pelvic_tilt: { name: 'Таз ровно', unit: '°', mdc: 2, see: 'Таз стоит с перекосом', bad: 3 },
  head_tilt: { name: 'Голова прямо', unit: '°', mdc: 3, see: 'Голова наклонена в сторону', bad: 4 },
  valgus_max: { name: 'Колено в приседе', unit: '°', mdc: 6, see: 'Колено в приседе уходит внутрь', bad: 8 },
  sq_depth: { name: 'Глубина приседа', unit: '°', mdc: 10, up: true, see: 'Присед неглубокий', bad: 90, below: true },
  foot_out_max: { name: 'Стопа в приседе', unit: '°', mdc: 6, see: 'Стопа в приседе разворачивается наружу', bad: 15 },
  fwd_reach: { name: 'Наклон вперед, кисти к полу', unit: '%', scale: 100, mdc: .1, up: true, see: 'В наклоне руки не дотягиваются до пола', bad: .8, below: true },
  fwd_asym: { name: 'Плечи в наклоне ровно', unit: '°', mdc: 3, see: 'В наклоне одно плечо ниже', bad: 4 },
  slb_drop_r: { name: 'Таз, стоя на правой ноге', unit: '°', mdc: 3, see: 'Стоя на правой ноге, таз проседает', bad: 4 },
  slb_drop_l: { name: 'Таз, стоя на левой ноге', unit: '°', mdc: 3, see: 'Стоя на левой ноге, таз проседает', bad: 4 },
  slb_sway_r: { name: 'Покачивание на правой ноге', unit: '%', mdc: 3, see: 'На правой ноге сильно покачивает', bad: 6 },
  slb_sway_l: { name: 'Покачивание на левой ноге', unit: '%', mdc: 3, see: 'На левой ноге сильно покачивает', bad: 6 },
  trot_r: { name: 'Поворот корпуса вправо', unit: '°', mdc: 8, up: true },
  trot_l: { name: 'Поворот корпуса влево', unit: '°', mdc: 8, up: true },
  trot_asym: { name: 'Разница поворотов', unit: '°', mdc: 8, see: 'Поворот в одну сторону заметно меньше', bad: 10 },
  reach_r: { name: 'Правая рука вверх', unit: '°', mdc: 8, up: true, see: 'Правая рука не поднимается до конца', bad: 160, below: true },
  reach_l: { name: 'Левая рука вверх', unit: '°', mdc: 8, up: true, see: 'Левая рука не поднимается до конца', bad: 160, below: true },
  reach_shrug: { name: 'Плечо к уху при подъеме рук', unit: '%', scale: 100, mdc: .05, see: 'Поднимая руки, плечо тянется к уху', bad: .08 },
};
// изменение сразу после работы: ухудшение меньше ACUTE_WORSE × порог шума считаем колебанием, как в bindBa({ acute })
export const ACUTE_WORSE = 2, MIN_PAIRS = 10;

/** Порог шума признака: из контрольных повторов (короткий интервал важнее), иначе осторожный по умолчанию.
 *  MDC95 = 1,96 · √2 · SEM; SEM считает retestStats по контрольным парам. */
export function mdcOf(key, retest) {
  const pick = s => s && s[key] && s[key].n >= MIN_PAIRS && Number.isFinite(s[key].sem) ? 1.96 * Math.SQRT2 * s[key].sem : null;
  const m = pick(retest && retest.featuresShort) ?? pick(retest && retest.features);
  const d = (SESSION_FEATURES[key] || {}).mdc;
  return m != null && m > 0 ? m : d;
}

/** Классификация изменения одного признака. same: в пределах шума; better: лучше больше чем на порог;
 *  worse: хуже больше чем на двойной порог; fluct: хуже, но в пределах двойного порога (колебание после работы). */
export function classify(key, a, b, mdc) {
  const F = SESSION_FEATURES[key] || {}, raw = b - a;
  const gain = F.up ? b - a : Math.abs(a) - Math.abs(b), size = Math.abs(F.up ? raw : gain);
  if (!(mdc > 0) || size <= mdc + 1e-9) return 'same'; // запас на округление дробей
  if (gain > 0) return 'better';
  return size > ACUTE_WORSE * mdc + 1e-9 ? 'worse' : 'fluct';
}

/** Сравнение двух тестов по признакам сеанса: строки с единицами и итог. */
export function compare(f0, f1, retest) {
  const rows = Object.keys(SESSION_FEATURES).filter(k => Number.isFinite(f0[k]) && Number.isFinite(f1[k])).map(k => {
    const mdc = mdcOf(k, retest), c = classify(k, f0[k], f1[k], mdc); return { key: k, a: f0[k], b: f1[k], mdc, c }; });
  const n = c => rows.filter(r => r.c === c).length;
  // колебание после работы не показываем как «хуже», но и итог «есть улучшения» рядом с ним был бы нечестным
  const verdict = n('better') && (n('worse') || n('fluct')) ? 'mixed' : n('better') ? 'better' : n('worse') ? 'worse' : 'same';
  return { rows, verdict };
}

/** Что видно сейчас: до трех наблюдаемых отклонений, самые заметные первыми. */
export function observations(f) {
  return Object.entries(SESSION_FEATURES).filter(([k, F]) => F.see && Number.isFinite(f[k]) && (F.below ? f[k] < F.bad : Math.abs(f[k]) > F.bad))
    .map(([k, F]) => ({ key: k, text: F.see, size: F.below ? (F.bad - f[k]) / F.mdc : (Math.abs(f[k]) - F.bad) / F.mdc }))
    .sort((x, y) => y.size - x.size).slice(0, 3);
}

/** Значение признака для экрана: угол без знака, доли в процентах. */
export function fmtVal(key, v) {
  const F = SESSION_FEATURES[key] || {}, x = Math.abs(v) * (F.scale || 1);
  return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString().replace('.', ',') + (F.unit === '%' ? '%' : F.unit || '');
}
export const VERDICT_TEXT = { better: 'Есть изменения больше погрешности', mixed: 'Смешанная картина', worse: 'Есть ухудшение больше двойной погрешности', same: 'Изменений больше погрешности нет' };
export const CLASS_TEXT = { better: 'изменилось', same: 'в пределах погрешности', worse: 'хуже', fluct: 'колебание сразу после работы: проверьте через 15–20 минут' };
