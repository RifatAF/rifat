// Биомеханическое ядро v2.0: три состояния мышцы «Зажим / Перетяг / Спад», статус «Не измерено»,
// названия-глаголы вместо латыни, маркеры утечки внутрибрюшного давления и данные для Ghost Overlay.
// Внутренние коды состояний прежние (SHORT, HYPER, WEAK), чтобы старые результаты и ссылки открывались как раньше.

/** Состояния: подпись для клиента, клинический термин для PDF специалиста, индикация, запрет и назначение. */
export const STATES = {
  SHORT: { ui: 'Зажим', icon: '🔴', clin: 'Концентрическое укорочение (Short-Tight)', vector: 'converge',
    what: 'мышца спазмирована и укорочена, смещает сустав', forbid: 'силовая нагрузка в укорочении', do: 'МФР, раскатка мячом, ПИР, растяжка' },
  HYPER: { ui: 'Перетяг', icon: '🟠', clin: 'Эксцентрический перегруз (Long-Tight)', vector: 'diverge',
    what: 'мышца перерастянута и держит сустав из последних сил', forbid: 'МФР и растяжка строго запрещены', do: 'снять нагрузку с зажатых мышц и мягкая изометрия' },
  WEAK: { ui: 'Спад', icon: '🔵', clin: 'Функциональная ингибиция (Inhibited)', vector: 'dashed',
    what: 'мышца «спит» и не включается в движение', forbid: 'плиометрика и резкие ускорения', do: 'изолированная нейромышечная активация' },
};
export const NOT_TESTED = 'NT';
export const NT_TEXT = 'Не измерено в данном тесте';

/** Названия-глаголы для клиента вместо анатомической латыни (что мышца делает с телом). */
export const ACTION_NAMES = {
  pec_minor: { name: 'Захватчик плеч', does: 'скручивает грудь и горбит спину' },
  lower_trap: { name: 'Якорь лопатки', does: 'тянет плечо вниз и назад' },
  iliopsoas: { name: 'Фиксатор бедра', does: 'заворачивает колено внутрь' },
  tfl: { name: 'Фиксатор бедра', does: 'заворачивает колено внутрь' },
};

const FORBID_HYPER = /stretch|mfr|massage|roll/i;
/** Упражнения «отпустить» для состояния: при Перетяге растяжка и МФР исключены, вместо них мягкая изометрия. */
export function releaseFor(m, k, exById) {
  const rel = (m && m.relax) || [];
  if (k !== 'HYPER') return rel;
  const safe = rel.filter(id => { const e = exById(id.replace('{s}', 'left')); return e && !FORBID_HYPER.test(id) && e.category !== 'растяжка'; });
  return safe.length ? safe : ((m.plan && m.plan.isolate) || m.activate || []);
}
/** Самомассаж допустим только при Зажиме. */
export const massageAllowed = k => k === 'SHORT';

/** Мышцы, которые проверялись этим тестом: есть хотя бы одно правило, чей признак реально измерен. */
export function measuredIds(a, rules) {
  const f = (a && a.f) || {}, out = new Set();
  for (const r of rules || []) if (Number.isFinite(f[r.feature])) for (const m of r.muscles) out.add(m.id);
  return out;
}
/** Состояние для показа: измеренная мышца без отклонений «в норме», не измеренная никогда не «в норме». */
export const shownState = (spot, measured) => spot.k === 'OK' && !measured.has(spot.id) ? NOT_TESTED : spot.k;

// ---------- 3. Утечка внутрибрюшного давления (ВБД) ----------
// p: 33 точки MediaPipe в пикселях; scale: см на пиксель из автокалибровки.
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
/** Rib Flare: расхождение плоскости грудной клетки (плечи) и таза (бедра) в градусах, во фронтали. */
export function ribFlare(p) { if (!p) return null; const d = Math.abs(ang(p[11], p[12]) - ang(p[23], p[24])); return Math.min(d, 360 - d); }
/** Апикальное дыхание: подъем плеч на вдохе до движения, мм. frames: [{ p }] за 2–3 секунды покоя. */
export function apicalRise(frames, cmPerPx) {
  // плечи относительно таза (раскачка всего тела не в счет), сглаживание по 5 кадрам, размах 10–90-й перцентиль (дрожание точек не в счет)
  const ys = frames.filter(f => f.p).map(f => ((f.p[11].y + f.p[12].y) - (f.p[23].y + f.p[24].y)) / 2); if (ys.length < 15 || !cmPerPx) return null;
  const sm = ys.map((_, i) => { const w = ys.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b); return w[w.length >> 1]; }).sort((a, b) => a - b);
  return (sm[Math.floor(sm.length * .9)] - sm[Math.floor(sm.length * .1)]) * cmPerPx * 10;
}

/** Butt Wink: потеря нейтрали поясницы в нижней трети приседа, градусы подкручивания таза (вид сбоку). */
export function buttWink(frames) {
  const v = frames.filter(f => f.p).map(f => ({ hipY: (f.p[23].y + f.p[24].y) / 2, tilt: ang(f.p[11], f.p[23]) }));
  if (v.length < 10) return null; const lo = Math.min(...v.map(x => x.hipY)), hi = Math.max(...v.map(x => x.hipY)), cut = hi - (hi - lo) / 3;
  const bottom = v.filter(x => x.hipY >= cut), top = v.filter(x => x.hipY < cut); if (!bottom.length || !top.length) return null;
  const mean = a => a.reduce((s, x) => s + x.tilt, 0) / a.length; return Math.abs(mean(bottom) - mean(top));
}
export const IAP_LIMITS = { ribFlare: 12, apicalMm: 12, buttWink: 10 };
/** Маркеры утечки ВБД и вклад в карту мышц по ТЗ (раздел 3). */
export function iapAssess({ flare, apicalMm, wink }) {
  const marks = [];
  if (flare > IAP_LIMITS.ribFlare) marks.push({ id: 'rib_flare', observed: `Ребра и таз расходятся на ${Math.round(flare)}°` });
  if (apicalMm > IAP_LIMITS.apicalMm) marks.push({ id: 'apical', observed: `Плечи поднимаются на вдохе на ${Math.round(apicalMm)} мм` });
  if (wink > IAP_LIMITS.buttWink) marks.push({ id: 'butt_wink', observed: `Поясница подкручивается внизу приседа на ${Math.round(wink)}°` });
  if (!marks.length) return { marks, muscles: [] };
  return { marks, muscles: [{ id: 'abdominals', side: 'BOTH', state: 'WEAK' }, { id: 'upper_trap', side: 'BOTH', state: 'SHORT' }, { id: 'scalene', side: 'BOTH', state: 'SHORT' }, { id: 'erector', side: 'BOTH', state: 'HYPER' }] };
}

// ---------- 2.3. Ghost Overlay: норма поверх факта ----------
/** Эталонный симметричный силуэт из фактической позы: зеркальное усреднение сторон относительно средней линии таза. */
export function normPose(p) {
  if (!p) return null; const mid = (p[23].x + p[24].x) / 2, out = p.map(q => ({ ...q }));
  const pairs = [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
  for (const [l, r] of pairs) { const y = (p[l].y + p[r].y) / 2, dx = (Math.abs(p[l].x - mid) + Math.abs(p[r].x - mid)) / 2;
    out[l] = { ...p[l], x: mid + Math.sign(p[l].x - mid || 1) * dx, y }; out[r] = { ...p[r], x: mid + Math.sign(p[r].x - mid || -1) * dx, y }; }
  out[0] = { ...p[0], x: mid }; return out;
}
/** Смещения факта от нормы: по каждой точке мм (по шкале) и угол линии плеч и таза в градусах. */
export function ghostDiff(p, cmPerPx = 0) {
  const n = normPose(p); if (!n) return null; const mm = i => Math.round(Math.hypot(p[i].x - n[i].x, p[i].y - n[i].y) * cmPerPx * 10);
  return { norm: n, shoulderDeg: Math.round(ang(p[11], p[12]) * 10) / 10, pelvisDeg: Math.round(ang(p[23], p[24]) * 10) / 10,
    points: [0, 11, 12, 23, 24, 25, 26, 27, 28].map(i => ({ i, mm: cmPerPx ? mm(i) : null })) };
}
const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];
/** Рисует наложение: зеленая норма полупрозрачно поверх факта, подписи смещений. */
export function drawGhost(ctx, p, cmPerPx = 0, { fact = true } = {}) {
  const g = ghostDiff(p, cmPerPx); if (!g) return null;
  const line = (q, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (const [a, b] of BONES) { ctx.moveTo(q[a].x, q[a].y); ctx.lineTo(q[b].x, q[b].y); } ctx.stroke(); };
  ctx.save(); if (fact) line(p, 'rgba(255,255,255,.9)', 4); ctx.globalAlpha = .55; line(g.norm, '#2BD47D', 6); ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = '600 14px system-ui'; for (const { i, mm } of g.points) if (mm > 5) ctx.fillText(mm + ' мм', p[i].x + 8, p[i].y - 6);
  ctx.restore(); return g;
}

// ---------- 7.4.2. Слои мышц на 3D: клик попадает только в выбранный слой ----------
export const LAYERS = {
  surface: ['upper_trap', 'lower_trap', 'glute_max', 'hamstrings', 'calf', 'scm', 'pec_major', 'lats', 'deltoid', 'triceps', 'biceps', 'forearm_flex', 'rectus_fem', 'vastus_lat', 'vmo', 'tibialis', 'peroneus', 'tfl', 'rectus_abd', 'abdominals'],
  middle: ['levator', 'rhomboid', 'glute_med', 'scalene', 'obliques', 'adductors', 'serratus'],
  deep: ['suboccipital', 'deep_neck_flex', 'iliopsoas', 'ql', 'pec_minor', 'erector', 'thoracic_ext'],
};
export const LAYER_NAMES = [['surface', 'Поверхностный'], ['middle', 'Средний'], ['deep', 'Глубокий']];
export const layerOf = id => Object.keys(LAYERS).find(k => LAYERS[k].includes(id)) || 'surface';
