// Тарифы и специализации. Один источник правды для кабинета и страницы /pricing.
import { meSync, configSync } from './auth.js';

// дата конца беты одна, на сервере (BETA_PRO_UNTIL): приходит в /api/auth?a=config; здесь только запасное значение без сети
const BETA_FALLBACK = Date.parse('2026-12-31T23:59:59Z');
export const betaUntil = () => +configSync().betaUntil || BETA_FALLBACK;
export const START_CLIENTS = 5;

export const PLANS = {
  start: { name: 'Старт', price: 'Бесплатно' },
  pro: { name: 'Про', price: '15 $ в месяц или 144 $ в год' },
  studio: { name: 'Студия', price: '39 $ в месяц, до 5 специалистов' },
};
// что требует тарифа Про: остальное доступно бесплатно
const PRO = {
  clients: `Больше ${START_CLIENTS} клиентов`,
  invite: 'Тест клиента из дома по ссылке',
  compare: 'Было → стало: сравнение с прошлой оценкой',
  repeat: 'Повторяемость последних тестов',
};

export const SPECIALTIES = [
  ['kinesio', 'Кинезиотерапевт, реабилитолог, ЛФК', 'Боль и восстановление: где перегрузка, что укрепить, проверка прогресса'],
  ['trainer', 'Персональный тренер', 'Первичный скрининг клиента и наглядный прогресс каждые 4–6 недель'],
  ['manual', 'Массажист, остеопат, мануальный терапевт', 'Осанка за минуту до и после сеанса: где работать и что изменилось'],
  ['sport', 'Тренер по бегу или спорту', 'Асимметрии и слабые звенья, которые мешают результату и ведут к травмам'],
  ['studio', 'Студия, клиника, зал', 'Единые протоколы и база клиентов для команды'],
];
// порядок шаблонов протокола под специализацию: первый открывается по умолчанию
export const TEMPLATE_ORDER = {
  kinesio: ['knee', 'low_back', 'neck', 'full', 'screen', 'run', 'posture'],
  trainer: ['screen', 'full', 'knee', 'low_back', 'run', 'neck', 'posture'],
  manual: ['posture', 'neck', 'low_back', 'knee', 'screen', 'full', 'run'],
  sport: ['run', 'screen', 'knee', 'full', 'low_back', 'neck', 'posture'],
  studio: ['screen', 'full', 'knee', 'low_back', 'neck', 'posture', 'run'],
};

export function plan() {
  const u = meSync();
  // без входа (вход еще не настроен на этом адресе) в бете открыт Про
  const bu = betaUntil();
  if (!u) return { plan: Date.now() < bu ? 'pro' : 'start', beta: Date.now() < bu, until: bu };
  return { plan: u.plan || 'start', beta: !!u.planBeta, until: u.planUntil };
}
export const can = f => !PRO[f] || plan().plan !== 'start';

/** Пускает к функции или показывает, какой тариф нужен. */
export function gate(f) {
  if (can(f)) return true;
  // единственное место, где упоминается Про: шторка при упоре в лимит, один раз за сессию
  let seen = false; try { seen = sessionStorage.getItem('bp_gate_seen') === '1'; sessionStorage.setItem('bp_gate_seen', '1'); } catch (e) {}
  if (seen) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = f === 'clients' ? `Лимит Старт: ${START_CLIENTS} клиентов` : PRO[f] + ': тариф Про'; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); return false; }
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>${f === 'clients' ? `На тарифе Старт до ${START_CLIENTS} клиентов` : PRO[f] + ': в тарифе Про'}</h2>
    <p class="sub" style="margin-top:8px">В бете Про бесплатен до ${new Date(betaUntil()).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    <a class="btn" href="/pricing" target="_blank" style="margin-top:var(--s5);text-decoration:none">Подключить Про</a>
    <button class="btn ghost" id="pwx" style="margin-top:var(--s2)">Не сейчас</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'pwx') d.remove(); };
  return false;
}
export function planLine() {
  const p = plan(), until = p.until ? new Date(p.until).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return p.beta ? `Тариф Про бесплатно на время беты, до ${until}` : `Тариф ${PLANS[p.plan].name}${p.plan !== 'start' && until ? ', до ' + until : ''}`;
}
