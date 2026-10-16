// Перераспределение тонуса по пяти школам. Работает поверх измеренных тонов и трогает только мышцы без собственных признаков.
//  • Шеррингтон: реципрокная иннервация, возбуждение агониста тормозит антагониста (антагонист «слабая»).
//  • Майерс: мышца в Locked Short тянет антагониста в Locked Long («перерастяжение»): растяжка и МФР ему запрещены.
//  • Янда: тонические (постуральные) мышцы склонны к гипертонусу, фазические к слабости; перекрестные синдромы в chains.json.
//  • Шарман: потеря жесткости в слабом сегменте компенсируется защитным спазмом соседнего (сосед «гипертонус»).
//  • Коларж: Rib Flare («открытые ножницы») = потеря центрации и внутрибрюшного давления, косые мышцы живота выключаются.

/** Агонист в гипертонусе → [антагонист, что с ним, закон]. side: 'opp' — антагонист на другой стороне. */
export const RECIP = {
  pec_major: [['lats', 'HYPER', 'myers'], ['rhomboid', 'HYPER', 'myers']],
  pec_minor: [['lower_trap', 'WEAK', 'sherr'], ['serratus', 'WEAK', 'sherr']],
  upper_trap: [['lower_trap', 'WEAK', 'sherr']],
  levator: [['lower_trap', 'WEAK', 'sherr']],
  scm: [['deep_neck_flex', 'WEAK', 'sherr']],
  suboccipital: [['deep_neck_flex', 'WEAK', 'sherr']],
  scalene: [['deep_neck_flex', 'WEAK', 'sherr']],
  iliopsoas: [['glute_max', 'WEAK', 'sherr']],
  rectus_fem: [['hamstrings', 'HYPER', 'myers'], ['glute_max', 'WEAK', 'sherr']],
  erector: [['abdominals', 'WEAK', 'sherr']],
  tfl: [['glute_med', 'WEAK', 'sherr']],
  adductors: [['glute_med', 'WEAK', 'sherr']],
  calf: [['tibialis', 'WEAK', 'sherr']],
  vastus_lat: [['vmo', 'WEAK', 'sherr']],
  biceps: [['triceps', 'WEAK', 'sherr']],
  ql: [['ql', 'HYPER', 'myers', 'opp']],
  obliques: [['obliques', 'HYPER', 'myers', 'opp']],
};
/** Слабый сегмент → соседи, которые берут защитный спазм (Шарман). */
export const PROTECT = {
  abdominals: ['erector', 'iliopsoas'], obliques: ['ql'], glute_med: ['tfl', 'ql'], glute_max: ['hamstrings', 'erector'],
  deep_neck_flex: ['scm', 'scalene'], lower_trap: ['upper_trap', 'levator'], serratus: ['pec_minor'], rhomboid: ['pec_minor'],
  vmo: ['vastus_lat'], tibialis: ['calf'], triceps: ['biceps'],
};
/** Янда: тонические мышцы (склонны к гипертонусу) и фазические (склонны к слабости). */
export const TONIC = new Set(['upper_trap', 'levator', 'scm', 'scalene', 'suboccipital', 'pec_major', 'pec_minor', 'erector', 'ql', 'iliopsoas', 'rectus_fem', 'tfl', 'adductors', 'hamstrings', 'calf', 'biceps', 'forearm_flex']);
export const PHASIC = new Set(['deep_neck_flex', 'lower_trap', 'rhomboid', 'serratus', 'glute_max', 'glute_med', 'abdominals', 'obliques', 'rectus_abd', 'vmo', 'tibialis', 'triceps', 'thoracic_ext', 'peroneus']);
export const LAW = { sherr: 'Шеррингтон', myers: 'Майерс', sahr: 'Шарман', kolar: 'Коларж' };
/** Короткое объяснение причины для клиента: «из-за гипертонуса грудной справа». */
export const LAW_WHY = { sherr: 'тормозится напряженным антагонистом', myers: 'растянута напряженным антагонистом', sahr: 'защищает слабого соседа', kolar: 'грудная клетка раскрыта, давление в животе не держится' };

const opp = s => s === 'LEFT' ? 'RIGHT' : 'LEFT';
const FREE = .25, SRC = .45;
/** tones: [{id, side, tone, derived, ambiguous}], kindOf(t) → 'SHORT'|'HYPER' для положительного тона.
 *  ribFlare: сработал признак Коларжа. Возвращает новый список: выведенные мышцы получают kind и cause {id, side, law}. */
export function rebalance(tones, kindOf, { ribFlare = false } = {}) {
  const map = new Map(tones.map(t => [t.id + ':' + t.side, { ...t }]));
  const free = k => { const x = map.get(k); return !x || (Math.abs(x.tone) <= FREE && !x.ambiguous && !x.cause); };
  const put = (id, side, k, v, cause) => { const key = id + ':' + side; if (!free(key)) return; const cur = map.get(key) || { id, side, tone: 0 };
    // Янда: фазическая мышца тормозится сильнее, тоническая перерастягивается сильнее
    const g = k === 'WEAK' ? (PHASIC.has(id) ? 1 : .8) : k === 'HYPER' ? (TONIC.has(id) ? 1 : .85) : (TONIC.has(id) ? 1 : .8);
    map.set(key, { ...cur, tone: (k === 'WEAK' ? -1 : 1) * Math.round(v * g * 100) / 100, derived: true, kind: k, cause }); };
  const strength = t => Math.min(.5, .3 + .4 * (Math.abs(t) - SRC));
  const own = tones.filter(t => !t.derived && !t.ambiguous && Math.abs(t.tone) > SRC);
  for (const t of own.filter(t => t.tone > 0 && kindOf(t) === 'SHORT'))
    for (const [ant, k, law, rel] of RECIP[t.id] || []) put(ant, rel === 'opp' ? opp(t.side) : t.side, k, strength(t.tone), { id: t.id, side: t.side, law });
  for (const t of own.filter(t => t.tone < 0))
    for (const n of PROTECT[t.id] || []) put(n, t.side, 'SHORT', strength(t.tone) * .9, { id: t.id, side: t.side, law: 'sahr' });
  if (ribFlare) for (const s of ['LEFT', 'RIGHT']) put('obliques', s, 'WEAK', .35, { id: 'abdominals', side: s, law: 'kolar' });
  return [...map.values()];
}

/** Проценты по состояниям для карты: сумма |тона| трех самых выраженных мышц состояния на стороне, деленная на 3.
 *  Одна мышца на пределе дает 33%, три на пределе 100%; общий процент — среднее сторон, перекос — разница сторон. */
export const TOP_N = 3;
export function stateScores(spots) {
  const out = {}; for (const k of ['SHORT', 'HYPER', 'WEAK']) {
    const side = s => Math.round(spots.filter(x => x.k === k && x.side === s && !x.ambiguous).map(x => Math.min(1, Math.abs(x.tone))).sort((a, b) => b - a).slice(0, TOP_N).reduce((a, b) => a + b, 0) / TOP_N * 100);
    const L = side('LEFT'), R = side('RIGHT'); out[k] = { L, R, all: Math.round((L + R) / 2), asym: R - L }; }
  return out;
}

/** Бета: как замеры ЦНС поменяли карту. with/without — пятна с ЦНС и без. */
export function cnsDelta(withS, withoutS) {
  const a = stateScores(withS), b = stateScores(withoutS), by = new Map(withoutS.map(s => [s.key, s]));
  const muscles = withS.map(s => { const o = by.get(s.key) || { tone: 0, k: 'OK' }; return { key: s.key, id: s.id, side: s.side, k: s.k, from: o.tone, to: s.tone, d: Math.round((Math.abs(s.tone) - Math.abs(o.tone)) * 100) }; })
    .filter(x => Math.abs(x.d) >= 5 && x.k !== 'OK').sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  return { scores: Object.fromEntries(Object.keys(a).map(k => [k, a[k].all - b[k].all])), muscles };
}
