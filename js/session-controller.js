// Глобальный контекст сессии v2.0: SELF_TEST (B2C, человек сам) или SPECIALIST_OPERATED (B2B, тест ведет специалист).
// В режиме специалиста строго выключены пассивный сбор (касания, глаза, пульс) и назначения ИИ, интерфейс в клинических терминах.

export const MODES = { SELF: 'SELF_TEST', SPEC: 'SPECIALIST_OPERATED' };
let mode = MODES.SELF;

export function setSession(m) { mode = m === MODES.SPEC ? MODES.SPEC : MODES.SELF; try { document.documentElement.dataset.session = mode; } catch (e) {} return mode; }
export const session = () => mode;
export const isSpecialist = () => mode === MODES.SPEC;
/** Пассивный сбор UI (Touch Dynamics, окуломоторика, rPPG). */
export const passiveOn = () => mode === MODES.SELF;
/** Персональные авто-рекомендации упражнений. */
export const aiRecsOn = () => mode === MODES.SELF;
/** Язык интерфейса: бытовой с подсказками или клинический (углы θ и мм относительно вектора g). */
export const uiLang = () => mode === MODES.SELF ? 'plain' : 'clinical';
/** Роль по умолчанию: клиент. Специалист только после явного переключателя в профиле (см. auth.setRole). */
export const DEFAULT_ROLE = 'client';
