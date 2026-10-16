// Глобальный контекст сессии BodyPassport v2.0.
// session_mode: 'SELF_TEST' — человек проходит тест сам (B2C), 'SPECIALIST_OPERATED' — тест ведет врач или тренер (B2B).
// В режиме специалиста пассивный сбор (касания, окуломоторика, rPPG) и назначения ИИ строго выключены:
// телефон в руках у специалиста, и мерить его руку и глаза нельзя.

export const MODES = Object.freeze({ SELF: 'SELF_TEST', SPEC: 'SPECIALIST_OPERATED' });
const KEY = 'bp_session_mode';
const listeners = new Set();
let mode = (() => { try { return sessionStorage.getItem(KEY) === MODES.SPEC ? MODES.SPEC : MODES.SELF; } catch (e) { return MODES.SELF; } })();

/** Установить режим. Любое значение, кроме SPECIALIST_OPERATED, означает SELF_TEST. */
export function setSession(m) {
  const next = m === MODES.SPEC ? MODES.SPEC : MODES.SELF; if (next === mode) return mode; mode = next;
  try { sessionStorage.setItem(KEY, mode); } catch (e) {}
  try { document.documentElement.dataset.session = mode; } catch (e) {}
  for (const f of listeners) try { f(mode); } catch (e) {}
  return mode;
}
export const session = () => mode;
/** Флаг из ТЗ: session_mode. */
export const sessionMode = session;
export const isSpecialist = () => mode === MODES.SPEC;
/** Пассивный сбор UI: Touch Dynamics, Oculomotor Eye Tracking, rPPG. */
export const passiveOn = () => mode === MODES.SELF;
/** Персональные авто-рекомендации упражнений. */
export const aiRecsOn = () => mode === MODES.SELF;
/** Язык интерфейса: бытовой с подсказками или клиническая сетка (углы θ и мм относительно вектора g). */
export const uiLang = () => mode === MODES.SELF ? 'plain' : 'clinical';
/** Выполнить сбор только в SELF_TEST; иначе вернуть null без ошибок. */
export const whenPassive = fn => passiveOn() ? fn() : null;
/** Подписка на смену режима: модули сбора останавливаются сразу, а не на следующем экране. */
export function onSession(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** Роль по умолчанию: клиент. Специалист только после явного переключателя в профиле. */
export const DEFAULT_ROLE = 'client';
