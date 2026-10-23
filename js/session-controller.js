// Глобальный контекст сессии BodyPassport v2.0.
// session_mode: 'SELF_TEST' — человек проходит тест сам (B2C), 'SPECIALIST_OPERATED' — тест ведет врач или тренер (B2B).
// В режиме специалиста пассивный сбор (касания, окуломоторика, rPPG) и назначения ИИ строго выключены:
// телефон в руках у специалиста, и мерить его руку и глаза нельзя.

export const MODES = Object.freeze({ SELF: 'SELF_TEST', SPEC: 'SPECIALIST_OPERATED' });
const KEY = 'bp_session_mode';
const listeners = new Set();
let mode = (() => { try { return sessionStorage.getItem(KEY) === MODES.SPEC ? MODES.SPEC : MODES.SELF; } catch (e) { return MODES.SELF; } })();
// по режиму выбирается тема: клиент светлый, кабинет специалиста navy
try { document.documentElement.dataset.session = mode; } catch (e) {}

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
/** Цвет строки состояния и панели браузера под экран: тёмный на первом экране, камере и в кабинете, иначе светлый. */
export function syncThemeColor() {
  try { const root = document.documentElement, dark = !!document.querySelector('.welcome,.cam,.dark') || root.dataset.session === MODES.SPEC || root.dataset.theme === 'pro';
    // Apple Matte: кабинет, камера и лендинг одного цвета #161617, полоса статуса сливается с экраном
    const mt = root.dataset.ds === 'matte' && (dark || document.body.classList.contains('lp-on'));
    const c = mt ? '#161617' : document.querySelector('.welcome') ? '#0B1B3B' : document.querySelector('.cam,.dark') ? '#070C18' : dark ? '#0B1220' : '#F5F6FA';
    let m = document.querySelector('meta[name=theme-color]'); if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); } m.content = c; } catch (e) {}
}

