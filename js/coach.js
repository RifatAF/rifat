// Режим тренера для комплекса: подходы, повторы, темп и отдых считаются из дозировки упражнения, голос ведет как тренер
// («Подход 1 из 2. 10 раз за 30 секунд. Поехали», счет, короткие подсказки по технике, «Отдыхаем 15 секунд»).
// Все фразы фиксированные: сборка (scripts/fetch-assets.mjs) озвучивает их заранее тем же голосом, что и тест.

const base = id => String(id).replace(/_(left|right)$/, '');
const r5 = s => Math.max(5, Math.round(s / 5) * 5);

/** План упражнения: sets подходов; в подходе reps повторов в темпе tempo с, либо удержание hold с;
 *  holdReps: серия коротких удержаний (10 × 5 с) с расслаблением relax с между ними; rest — отдых между подходами. */
export function coachPlan(e) {
  const d = String(e.dose || '').toLowerCase().replace(/\s+/g, ' '), cat = e.category || '';
  let sets = 1, reps = 0, hold = 0, m;
  if ((m = d.match(/(\d+)\s*(?:подход[а-яё]*|раз[а-яё]*)?\s*(?:×|x|по)\s*(\d+)\s*(?:с(?![а-яё])|сек)/))) { sets = +m[1]; hold = +m[2]; }
  else if ((m = d.match(/(\d+)\s*(?:подход[а-яё]*)?\s*(?:×|x|по)\s*(\d+)/))) { sets = +m[1]; reps = +m[2]; }
  else if ((m = d.match(/(\d+)/))) { reps = +m[1]; sets = e.sets || 1; }
  else { hold = Math.max(10, e.durationSec || 30); }
  // 10 × 5 с, 4 × 10 с: это не подходы, а серия коротких удержаний с расслаблением между ними
  let holdReps = 0, relax = 0; if (hold && hold <= 10 && sets >= 4) { holdReps = sets; sets = 1; relax = hold <= 5 ? 3 : 5; }
  sets = Math.max(1, Math.min(3, sets));
  const slow = /медленн/.test(d) || cat === 'подвижность' || cat === 'растяжка';
  const tempo = reps ? (slow ? 3 : 2.5) : 0;
  const work = holdReps ? holdReps * (hold + relax) : reps ? r5(reps * tempo) : hold;
  const rest = sets < 2 ? 0 : reps && cat === 'укрепление' ? 30 : hold ? 10 : 15;
  return { sets, reps, hold, holdReps, relax, tempo: reps ? work / reps : 0, work, rest };
}
/** Длительность упражнения с отдыхом между подходами, секунд. */
export const coachSec = e => { const p = coachPlan(e); return p.sets * p.work + (p.sets - 1) * p.rest; };

const plural = (n, a, b, c) => { const k = n % 100, j = n % 10; return k > 10 && k < 20 ? c : j === 1 ? a : j > 1 && j < 5 ? b : c; };
export const PH = {
  set: (s, n) => `Подход ${s} из ${n}`,
  goReps: p => `${p.reps} ${plural(p.reps, 'раз', 'раза', 'раз')} за ${p.work} секунд. Поехали`,
  goHold: p => `Держим ${p.hold} секунд. Поехали`,
  goSeries: p => `${p.holdReps} раз по ${p.hold} секунд. Поехали`,
  relax: (k, n) => `${k} из ${n}. Расслабьтесь на вдох и снова`,
  rest: s => `Отдыхаем ${s} секунд`,
  next: (s, name) => `Отлично. Отдыхаем ${s} секунд. Дальше: ${name}`,
  side: 'Меняем сторону. Приготовились',
  ready: 'Приготовились',
  half: 'Половина. Держим темп',
  five: 'Ещё пять секунд',
  setDone: 'Подход готов',
  done: 'Комплекс закончен. Отличная работа!',
};
export const REST_NEXT = 20, REST_SIDE = 5;
export const exName = e => String(e.title || '').split(' (')[0];

// подсказки тренера по ходу: коротко, повелительно, про типичную ошибку упражнения
export const CUES = {
  ex_thoracic_open_book: ['Колени вместе', 'Смотрите за рукой', 'Выдох и раскрываемся'],
  ex_neck_rotation: ['Плавно, без рывков', 'Плечи на месте'],
  ex_side_stretch: ['Строго в сторону', 'Не наклоняйтесь вперед'],
  ex_glute_bridge: ['Сожмите ягодицы', 'Поясницу не прогибаем', 'Вверху задержка'],
  ex_side_plank_knees: ['Таз выше', 'Тело в одну линию'],
  ex_clamshell: ['Таз не заваливаем', 'Стопы вместе', 'Ягодица работает'],
  ex_ankle_mob: ['Пятка на полу', 'Колено над пальцами'],
  ex_ql_stretch: ['Строго в сторону', 'Дышим спокойно'],
  ex_hip_flexor_stretch: ['Подкрутите таз', 'Поясницу не прогибаем'],
  ex_upper_trap_stretch: ['Рука только лежит', 'Плечо вниз'],
  ex_scalene_stretch: ['Голову не запрокидываем', 'Плечо вниз'],
  ex_chin_tuck: ['Подбородок назад, не вниз', 'Макушка тянется вверх'],
  ex_doorway_pec_stretch: ['Шаг небольшой', 'Живот подтянут'],
  ex_y_raise: ['Плечи от ушей', 'Сведите лопатки', 'Голову не поднимаем'],
  ex_hamstring_stretch: ['Спина ровная', 'Без рывков, дышим'],
  ex_cat_cow: ['Медленно', 'Голову не запрокидываем'],
  ex_dead_bug: ['Поясница прижата', 'Не задерживайте дыхание'],
  ex_side_lying_abduction: ['Носок вперед, не вверх', 'Медленно вниз'],
  ex_wall_slide: ['Поясница у стены', 'Плечи от ушей'],
  ex_lat_activation: ['Плечи вниз', 'Сведите лопатки'],
  ex_thoracic_extension: ['Валик под лопатками', 'Таз на полу'],
  ex_posterior_tilt: ['Втяните низ живота', 'Плечи расслаблены'],
  ex_glute_set: ['Сожмите ягодицы', 'Бедра мягкие'],
  ex_glute_prone_lift: ['Поясница спокойна', 'Работает ягодица'],
  ex_glute_med_wall: ['Таз ровно', 'Ягодица сбоку работает'],
  ex_deep_neck_nod: ['Кивок совсем маленький', 'Шея спереди мягкая'],
  ex_triceps_wall_push: ['Локти вдоль ребер', 'Плечи от ушей'],
  ex_calf_raise: ['Медленно, без подскока', 'Вес на большом пальце'],
  ex_piriformis_stretch: ['Голова на полу', 'Поясница прижата'],
  ex_soleus_stretch: ['Пятка на полу', 'Колено согнуто'],
  ex_supraspinatus_scaption: ['Плечо от уха', 'Большой палец вверх'],
};
export const cuesOf = e => CUES[base(e.id)] || [];

/** Все фразы тренера для этих упражнений: сборка озвучивает те, которых еще нет. */
export function coachPhrases(list) {
  const out = new Set([PH.side, PH.ready, PH.half, PH.five, PH.setDone, PH.done]);
  for (const e of list) { const p = coachPlan(e);
    if (p.sets > 1) for (let s = 1; s <= p.sets; s++) out.add(PH.set(s, p.sets));
    out.add(p.holdReps ? PH.goSeries(p) : p.reps ? PH.goReps(p) : PH.goHold(p));
    if (p.holdReps) for (let k = 1; k <= p.holdReps; k++) out.add(PH.relax(k, p.holdReps));
    if (p.rest) out.add(PH.rest(p.rest));
    out.add(PH.next(REST_NEXT, exName(e)));
    cuesOf(e).forEach(c => out.add(c)); }
  return [...out];
}
