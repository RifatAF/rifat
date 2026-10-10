// Шкала боли VAS 0–10 до и после комплекса, комплаенс. Без DOM: работает и в браузере, и в тестах Node.
/** Δ = VAS до − VAS после: больше нуля значит боль снизилась. */
const num = v => v != null && v !== '' && Number.isFinite(+v);
export const vasDelta = (pre, post) => (num(pre) && num(post) ? +pre - +post : null);
// key: ключ хранилища с учетом аккаунта (в app.js это K('bp_vas'))
export function vasLog(key = 'bp_vas') { try { const l = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
/** Запись занятия: { t, pre, post, n (упражнений), all (сколько назначено) }. Хранится на телефоне клиента, 200 последних. */
export function vasSave(rec, key = 'bp_vas') { const l = vasLog(key); l.push(rec); try { localStorage.setItem(key, JSON.stringify(l.slice(-200))); } catch (e) {} return l; }
/** Сводка за период: комплаенс (дни с выполненным комплексом из дней периода, комплекс назначен ежедневно), средние VAS до/после и Δ. */
export function vasStats(list, days = 7, now = Date.now()) {
  const from = now - days * 864e5, L = (list || []).filter(r => r && r.t > from && r.t <= now);
  const dn = new Set(L.filter(r => (r.n || 0) > 0).map(r => new Date(r.t).toDateString())).size;
  const paired = L.filter(r => Number.isFinite(r.pre) && Number.isFinite(r.post));
  const avg = f => paired.length ? Math.round(paired.reduce((x, r) => x + f(r), 0) / paired.length * 10) / 10 : null;
  return { days, sessions: L.length, activeDays: dn, compliance: Math.round(Math.min(1, dn / days) * 100), avgPre: avg(r => r.pre), avgPost: avg(r => r.post), avgDelta: avg(r => r.pre - r.post) };
}
