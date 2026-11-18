// План домашки на 4 недели по трем «П» (18.11.2026, Рифат: «посмотрел отчет, а что дальше?»).
// Постоянство: 3 занятия в неделю, в любые дни, пропуск не догоняем.
// Постепенство: нагрузка растет только после недели, где было хотя бы 2 занятия и боль после занятий не выше, чем до.
// Периодизация: 4 этапа (освоение → привычка → нагрузка → закрепление) и повторный тест в конце.
// Клиенту только задачи тренировки и дозировка, без состояний мышц и диагнозов.
export const PER_WEEK = 3;
const DAY = 864e5, WEEK = 7 * DAY;
export const PHASES = [
  { t: 'Освоение', goal: 'Выучить технику', dose: 'Лёгкий старт: 1 подход каждого упражнения, медленно, следите за техникой.' },
  { t: 'Привычка', goal: 'Занятия по расписанию', dose: 'Полная дозировка, как в карточке упражнения.' },
  { t: 'Нагрузка', goal: 'Чуть сложнее', dose: 'Укрепление: +2 повтора или +5 секунд удержания. Растяжка и подвижность: +10 секунд или чуть больше амплитуды без боли.' },
  { t: 'Закрепление', goal: 'Держать результат', dose: 'Нагрузка как на прошлой неделе, ровная техника. В конце недели повторный тест.' }];
export const RULES = [
  `${PER_WEEK} занятия в неделю, в любые дни с перерывом хотя бы день. Лучше коротко и регулярно, чем долго и редко.`,
  'Пропустили занятие: продолжайте со следующего, не делайте два за раз.',
  'Нагрузку повышаем, только если на прошлой неделе было хотя бы 2 занятия и после занятий не больнее, чем до.',
  'Стало больнее во время упражнения: остановитесь и напишите специалисту.'];
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
/** Где клиент в плане: неделя по календарю, этап по выполнению. log: [{t, n, pre, post}] (дневник занятий), done: [время занятия]. */
export function planState({ start, next = 0, log = [], done = [], now = Date.now() } = {}) {
  const s0 = startOfDay(start || now), week = Math.max(0, Math.floor((startOfDay(now) - s0) / WEEK));
  const days = w => { const a = s0 + w * WEEK, b = a + WEEK, set = new Set();
    for (const r of log) if ((r.n || 0) > 0 && r.t >= a && r.t < b) set.add(startOfDay(r.t));
    for (const t of done) if (t >= a && t < b) set.add(startOfDay(t)); return set.size; };
  const worse = w => { const a = s0 + w * WEEK, b = a + WEEK, l = log.filter(r => r.t >= a && r.t < b && Number.isFinite(r.pre) && Number.isFinite(r.post));
    return l.length > 0 && l.reduce((x, r) => x + r.post - r.pre, 0) / l.length > 0.5; };
  // этап растет на 1 за каждую прошедшую неделю, где условие выполнено; иначе этап повторяется
  let phase = 0, held = null;
  for (let w = 0; w < week; w++) { if (phase >= PHASES.length - 1) break;
    if (days(w) >= 2 && !worse(w)) { phase++; held = null; } else held = days(w) < 2 ? 'few' : 'pain'; }
  const retest = +next > 0 ? +next : s0 + 4 * WEEK - DAY;
  return { week, phase, held, thisWeek: days(week), perWeek: PER_WEEK, retest, retestDue: now >= startOfDay(retest) };
}
/** Короткая строка для карточки «Сегодня». */
export function weekLine(st) { const p = PHASES[st.phase]; return `Неделя ${st.week + 1} · ${p.t}: занятий ${Math.min(st.thisWeek, st.perWeek)} из ${st.perWeek}`; }
export function heldNote(st) { return st.held === 'few' ? 'На прошлой неделе было меньше 2 занятий, поэтому этап тот же. Нагрузку повысим, когда наберётся ритм.'
  : st.held === 'pain' ? 'На прошлой неделе после занятий было больнее, чем до, поэтому нагрузку не повышаем. Напишите специалисту.' : ''; }
