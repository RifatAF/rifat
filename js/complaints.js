// Жалобы клиента в кабинете специалиста: разбор свободного текста, метки боли на 3D и поправка плана упражнений.
// Клиенту жалобы и связь с болью не показываются (docs/legal_texts): в его план попадает только итоговый набор упражнений.
// Основания поправки: docs/clinical/complaints.md.

export const PZ = [['neck', 'Шея'], ['shoulder', 'Плечо'], ['elbow', 'Локоть'], ['wrist', 'Запястье, кисть'], ['upper_back', 'Грудной отдел'], ['low_back', 'Поясница'], ['hip', 'Таз, бедро'], ['knee', 'Колено'], ['foot', 'Стопа, голеностоп']];
export const PZN = Object.fromEntries(PZ);
export const SIDES = { LEFT: 'слева', RIGHT: 'справа', BOTH: 'с двух сторон' };
export const ACUTE = 7, MID = 4;

// порядок важен: «тазобедренный» раньше «бедра», «верх спины» раньше «спины»
const WORDS = [
  [/тазобедр|(?:^|[^а-я])таз|ягодиц|(?:^|[^а-я])пах|бедр/, 'hip'],
  [/шея|шеи|шее|шею|шейн|затыл/, 'neck'],
  [/плеч/, 'shoulder'],
  [/локо?т|(?:^|[^а-я])докт(?:е|я|ем|ю)(?![а-я])/, 'elbow'],
  [/запяст|(?:^|[^а-я])кист(?:ь|и|ью|ей|я)?(?![а-я])|ладон/, 'wrist'],
  [/лопат|грудн\S* отдел|верх\S* спин|между лопат/, 'upper_back'],
  [/поясниц|поясн|крестц|копчик|спин/, 'low_back'],
  [/колен|надколен/, 'knee'],
  [/(?:^|[^а-я])стоп(?:а|е|у|ы|ой|ах)?(?![а-я])|пятк|пяточ|голеностоп|голен|лодыж|щиколот|ахилл|подошв|пальц\S* ног/, 'foot'],
];
const sideOf = t => /(?:^|[^а-я])(?:обе|оба|обоих|обеих)(?![а-я])|с двух сторон|(?:^|[^а-я])двух(?![а-я])/.test(t) ? 'BOTH' : /(?:^|[^а-я])(?:прав|справ)/.test(t) ? 'RIGHT' : /(?:^|[^а-я])(?:лев|слев)/.test(t) ? 'LEFT' : null;
const levelOf = t => { const m = t.match(/(\d{1,2})(?:[.,]\d)?\s*(?:\/\s*10|из\s*10|балл)/) || t.match(/(?:боль|болит|ноет)\D{0,12}?(?:^|[^а-я])на\s+(\d{1,2})(?!\d)/);
  if (m && +m[1] <= 10) return +m[1];
  if (/остр|сильн|невыносим|резк|очень бол|прострел/.test(t)) return 7;
  if (/умерен|средн/.test(t)) return 5;
  if (/слегка|немного|чуть|слаб|ноет|ноющ|дискомфорт|тянет|побаливает/.test(t)) return 3;
  return null; };
const NEG = /(?:^|[^а-я])не\s+(?:бол|бесп)|без\s+бол|(?:^|[^а-я])прошл[аио](?![а-я])|больше не/;

/** Свободный текст → [{z, s, p}]: зона, сторона (LEFT, RIGHT, BOTH или null) и боль 0–10 (null, если не названа). */
export function parseComplaints(text) {
  const out = [], put = e => { const o = out.find(x => x.z === e.z && x.s === e.s); if (o) { if (e.p != null && (o.p == null || e.p > o.p)) o.p = e.p; } else out.push(e); };
  let last = [];
  for (const raw of String(text || '').toLowerCase().replace(/ё/g, 'е').split(/[.;,\n!?()]|\s+и\s+|\s+а\s+|\s+но\s+/)) {
    const t = ' ' + raw.trim() + ' '; if (!raw.trim()) continue;
    const zs = [...new Set(WORDS.filter(([re]) => re.test(t)).map(([, z]) => z))], s = sideOf(t), p = levelOf(t);
    if (!zs.length) { // «…колене, правом» или «…колене, 6/10»: уточнение к предыдущей зоне
      for (const e of last) { if (s && !e.s) { const o = out.find(x => x === e); if (o && !out.some(x => x.z === o.z && x.s === s)) o.s = s; } if (p != null && (e.p == null || p > e.p)) e.p = p; }
      continue; }
    if (NEG.test(t)) { last = []; continue; }
    last = zs.map(z => ({ z, s, p })); last.forEach(put); last = last.map(e => out.find(x => x.z === e.z && x.s === e.s));
  }
  return out;
}

/** Текст и ручные правки вместе: ручные записи главнее, удаленные специалистом из текста не возвращаются. */
export function mergeComplaints(text, manual = [], removed = []) {
  const key = e => e.z + ':' + (e.s || ''), off = new Set(removed), have = new Set(manual.map(key));
  return [...manual, ...parseComplaints(text).filter(e => !have.has(key(e)) && !off.has(key(e))).map(e => ({ ...e, t: 1 }))];
}

// Нагрузка упражнения на зону: 1 — заметная, 2 — основная (опора, вес тела, крайняя амплитуда).
const LOAD = {
  ex_thoracic_open_book: { upper_back: 1, shoulder: 1, low_back: 1 }, ex_neck_rotation: { neck: 1 }, ex_side_stretch: { low_back: 1, shoulder: 1 },
  ex_glute_bridge: { low_back: 1, hip: 1, knee: 1 }, ex_side_plank_knees: { shoulder: 2, elbow: 1, low_back: 1, hip: 1, knee: 1 }, ex_clamshell: { hip: 1 },
  ex_ankle_mob: { foot: 1 }, ex_ql_stretch: { low_back: 1, shoulder: 1 }, ex_hip_flexor_stretch: { knee: 2, hip: 1, low_back: 1 },
  ex_upper_trap_stretch: { neck: 1 }, ex_scalene_stretch: { neck: 1 }, ex_chin_tuck: { neck: 1 }, ex_doorway_pec_stretch: { shoulder: 2 },
  ex_y_raise: { shoulder: 2, neck: 1, upper_back: 1 }, ex_hamstring_stretch: { low_back: 1, knee: 1, hip: 1 },
  ex_cat_cow: { low_back: 1, upper_back: 1, wrist: 2, knee: 1, neck: 1 }, ex_dead_bug: { low_back: 1, shoulder: 1, hip: 1 }, ex_side_lying_abduction: { hip: 1 },
  ex_wall_slide: { shoulder: 2 }, ex_lat_activation: { shoulder: 1 }, ex_thoracic_extension: { upper_back: 2, neck: 1 }, ex_posterior_tilt: { low_back: 1 },
  ex_glute_set: { hip: 1 }, ex_glute_prone_lift: { low_back: 1, hip: 1 }, ex_glute_med_wall: { hip: 1, knee: 1 }, ex_deep_neck_nod: { neck: 1 },
  ex_triceps_wall_push: { elbow: 2, wrist: 2, shoulder: 1 }, ex_calf_raise: { foot: 2, knee: 1 }, ex_piriformis_stretch: { hip: 2, knee: 2, low_back: 1 },
  ex_soleus_stretch: { foot: 1, knee: 1 }, ex_supraspinatus_scaption: { shoulder: 2 }, ex_deep_squat_hold: { knee: 2, hip: 2, foot: 1, low_back: 1 },
  ex_lunge_tilt: { knee: 2, hip: 1, low_back: 1 }, ex_band_glute_bridge: { low_back: 1, hip: 1, knee: 1 }, ex_tva_breath: {},
  ex_plank_neutral: { shoulder: 2, low_back: 2, elbow: 1, wrist: 1 }, ex_standing_knee_raise: { hip: 1, knee: 1, foot: 1 },
  ex_band_row_one: { shoulder: 1, elbow: 1, wrist: 1, upper_back: 1 }, ex_pec_ball_mfr: { shoulder: 1 }, ex_face_pull: { shoulder: 2, elbow: 1, wrist: 1, neck: 1 },
  ex_band_row_low: { shoulder: 1, elbow: 1, wrist: 1 }, ex_sleeper_stretch: { shoulder: 2 }, ex_lat_roll_mfr: { shoulder: 1, upper_back: 1 },
  ex_band_ext_rot: { shoulder: 1, elbow: 1 }, ex_wall_er_iso: { shoulder: 1, wrist: 1 }, ex_calf_wall_stretch: { foot: 2, knee: 1 },
  ex_it_roll_mfr: { hip: 1, knee: 1, wrist: 1, shoulder: 1 }, ex_quad_set: { knee: 1 }, ex_adductor_squeeze: { hip: 1, knee: 1 },
  ex_shin_roll_mfr: { foot: 1, wrist: 1 }, ex_short_foot: { foot: 1 }, ex_calf_raise_axis: { foot: 2, knee: 1 },
};
const base = id => id.replace(/_(left|right)$/, '');
export const loadOf = id => LOAD[base(id)] || {};

// Что добавить по жалобе, если боль не сильная. Источник у каждой строки, подробнее docs/clinical/complaints.md.
const ADD = {
  knee: { max: 6, ex: () => ['ex_clamshell_{s}', 'ex_quad_set'], src: 'Crossley 2016: при боли в передней части колена упражнения для бедра и колена вместе' },
  hip: { max: 6, ex: () => ['ex_glute_med_wall_{s}'], src: 'Mellor 2018: обучение и упражнения для отводящих мышц при боли сбоку бедра' },
  shoulder: { max: 6, ex: p => [p >= MID ? 'ex_wall_er_iso' : 'ex_band_ext_rot'], src: 'Diercks 2014: при боли в плече малая интенсивность, часто' },
  neck: { max: 6, ex: p => p >= MID ? ['ex_deep_neck_nod'] : ['ex_deep_neck_nod', 'ex_band_row_low'], src: 'Gross 2015: укрепление шеи и лопаток, растяжка отдельно не помогает' },
  foot: { max: 5, ex: () => ['ex_calf_raise_{s}'], src: 'Silbernagel 2007, Rathleff 2015: нагрузка с контролем боли не выше 5 из 10' },
};
const lvl = e => e.p == null ? 5 : e.p;
const sidesOf = s => s === 'LEFT' ? ['left'] : s === 'RIGHT' ? ['right'] : ['left', 'right'];
export const painLabel = e => (PZN[e.z] || e.z) + (e.s ? ' ' + SIDES[e.s] : '');
// упражнение не дается, если зона под нагрузкой болит: сильная боль убирает любую нагрузку, средняя только основную
const cutBy = (id, pains, own) => pains.find(e => e !== own && (n => n && (lvl(e) >= ACUTE || (n >= 2 && lvl(e) >= MID)))(loadOf(id)[e.z]));

/** Поправка списка упражнений по жалобам. has(id) — есть ли упражнение в базе; add: false — только убрать лишнее. */
export function painPlan(ids, pains, { has = () => true, max = 8, add = true } = {}) {
  pains = (pains || []).filter(e => e && PZN[e.z]);
  const cut = [], keep = [];
  for (const id of ids) { const e = cutBy(id, pains); if (e) cut.push({ id, e }); else keep.push(id); }
  const added = [];
  if (add) for (const e of pains) { const r = ADD[e.z]; if (!r || lvl(e) > r.max) continue;
    for (const x of r.ex(lvl(e))) for (const id of [...new Set(sidesOf(e.s).map(sd => x.replace('{s}', sd)))]) {
      if (!has(id) || keep.includes(id) || added.some(a => a.id === id) || cutBy(id, pains, e)) continue; added.push({ id, e, src: r.src }); } }
  // добавленное по жалобе важнее хвоста плана по осанке
  const room = Math.max(0, max - added.length), out = [...keep.slice(0, room), ...added.map(a => a.id)].slice(0, max);
  return { ids: out, cut, added: added.filter(a => out.includes(a.id)), acute: pains.filter(e => lvl(e) >= ACUTE) };
}

/** Для совместимости со старыми экранами: боль по зонам (максимум) и сторона, если она одна. */
export function painCompat(pains) {
  const pain = {}; for (const e of pains || []) pain[e.z] = Math.max(pain[e.z] || 0, lvl(e));
  const ss = [...new Set((pains || []).map(e => e.s).filter(Boolean))];
  return { pain, painSide: ss.length === 1 ? ss[0] : ss.length > 1 ? 'BOTH' : null };
}

// Точки суставов на 3D-фигуре (мм, x > 0 — левая сторона человека, перед при y < 0), сняты по сетке data/body3d.bin.
// n — куда смотрит метка: сзади (y+), сбоку и чуть вперед (суставы рук и бедро) или спереди (y−).
export const ANCHOR = {
  neck: { c: [25, 40, 1500], n: [0, 1, 0] }, shoulder: { c: [185, 30, 1370], n: [1, -.7, 0] }, elbow: { c: [232, 30, 1060], n: [1, -.7, 0] },
  wrist: { c: [262, -15, 850], n: [1, -.7, 0] }, upper_back: { c: [40, 95, 1330], n: [0, 1, 0] }, low_back: { c: [40, 75, 1030], n: [0, 1, 0] },
  hip: { c: [128, 0, 890], n: [1, -.7, 0] }, knee: { c: [78, -30, 450], n: [0, -1, 0] }, foot: { c: [80, -10, 75], n: [0, -1, 0] },
};
/** Метки боли: по одной на сторону; без стороны или с двух сторон — две. */
export const painSpots = pains => (pains || []).filter(e => ANCHOR[e.z]).flatMap(e => (e.s === 'LEFT' ? [1] : e.s === 'RIGHT' ? [-1] : [1, -1])
  .map(sg => { const a = ANCHOR[e.z]; return { e, c: [a.c[0] * sg, a.c[1], a.c[2]], n: [a.n[0] * sg, a.n[1], a.n[2]], p: e.p, label: painLabel(e) + (e.p != null ? ', ' + e.p + ' из 10' : '') }; }));
