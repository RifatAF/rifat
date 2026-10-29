// BodyPassport web: тот же поток, тексты и дизайн, что в Android-версии.
import { matte as isMatte } from './ds.js';
import { backupSoon, restoreIfEmpty, downloadBackup, pickRestore } from './backup.js';
import { stateScores, cnsDelta } from './muscle-logic.js';
import { P, F, G, Movement, sideView, levelled, analyze, fmt, standSnapshot, sideSnapshot, features } from './analysis.js';
import { track, vasSave, vasLog, vasStats, vasDelta, channel, screenView, deviceInfo } from './track.js';
import { bugSheet, rateCard, bindRate, installCard, bindInstall, installNow, clientInstallCard, bindClientInstall, platform, installGuide, canInstall, feedbackSheet, shareApp, appLink, mountBugTab, mountBetaBar, exitSurvey, testSurvey } from './grow.js';
import { proHome, motionViewer, consumerPoses, canSwitchMode } from './pro.js';
import { seal } from './core.js';
import { calibReport, reportCSV, caseLines, RES_NAMES, learnWeights } from './calibreport.js';
import { RULE_NAMES } from './evidence.js';
import { applyRuleWeights } from './core.js';
import { configSync, ensureLogin, linkConsent, linkConsentOk, safetyOk, safetyScreen, getMe, meSync, tgWebLogin, mailLinkLogin, logout, deleteAccount, betaUsers, providers, config, setAppMode } from './auth.js';
import { exFigure, hasFigure } from './exfig.js';
import { testDemo } from './testdemo.js';
import { coachPlan, coachSec, cuesOf, PH, REST_NEXT, REST_SIDE, exName } from './coach.js';
import { painWord, PAIN_SCALE } from './vas.js';
import { sayText } from './saytext.js';
import { BATTERY_UNITS, forwardBend, singleBalance, thoracicRotation, trotSweep, overheadReach, chairStand, retroGait, autoScale } from './test-battery.js';
import { mountPacing, falseStart, matchScore, PHASE, SHORT_CMD, GO_WORD, COUNT_WORDS, numWord, ZERO_CLICK } from './pacing-guard.js';
import { pinhole, fpsGuard, flushGL } from './hardware-adapter.js';
import { setSession, MODES, passiveOn, syncThemeColor, isSpecialist } from './session-controller.js';
import { touchSummary, resetTouch, startPassive, rememberBaseline } from './touch-tracker.js';
import { runLoader, vnsSummary } from './vns-phenotype.js';
import { ribFlare, apicalBreath, buttWink } from './biomechanics-engine.js';
import { cnsScore, cnsScoreCard, cnsDetail } from './cns-report.js';
import { STATES, NT_TEXT, releaseFor, massageAllowed, measuredIds, ACTION_NAMES, LAYERS, LAYER_NAMES, layerOf } from './biomechanics-engine.js';
import { repCounter, repKind, targetReps, setsOf, REP_KINDS } from './repcount.js';
import { ready3D, C, loadContent, voice, sleep, phone, startMotion, initPose, poseInfo, notePoseSpeed, prefetchPose, cam, startCamera, stopCamera, fullyVisible, drawSkeleton, drawSilhouette, drawHeat, drawMark, clientPalette, RAMP_CSS, body3D, preload3D, setBodySex, device, keepAwake, ic, toast, reduceMotion, cameraBlocked, openInBrowserSheet } from './core.js';
export { ic, toast };

const $ = s => document.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
// данные из ссылки-приглашения не подписаны: пропускаем только ожидаемые поля и форматы
function cleanInv(o) { if (!o || typeof o !== 'object') throw new Error('bad invite');
  const str = (v, n) => typeof v === 'string' ? v.replace(/[<>&"'`]/g, '').slice(0, n) : '';
  const id = /^[A-Za-z0-9_-]{16,64}$/, key = /^[A-Za-z0-9_-]{43}$/;
  if (!id.test(o.i || '') || !key.test(o.k || '')) throw new Error('bad invite');
  const p = Array.isArray(o.p) ? o.p.filter(u => typeof u === 'string' && Object.prototype.hasOwnProperty.call(UNITS, u)) : [];
  const d = Number.isFinite(+o.d) && +o.d > 1.7e12 && +o.d < 4e12 ? +o.d : undefined;
  return { i: o.i, k: o.k, s: str(o.s, 80) || 'Специалист', n: str(o.n, 40), p: p.length ? p : Object.keys(UNITS), ...(d ? { d } : {}), ...(o.cal === 1 ? { cal: 1 } : {}) }; }
const app = $('#app');
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
if (TG) { TG.ready(); TG.expand(); }
const q = new URLSearchParams(location.search);
// источник перехода: первое касание (кто первым привел человека, тому и засчитывается приглашение)
const inRef = (q.get('ref') || q.get('utm_source') || '').replace(/[^\w.-]/g, '').slice(0, 40);
if (inRef && !localStorage.getItem('bp_ref')) localStorage.setItem('bp_ref', inRef);
const REF = localStorage.getItem('bp_ref') || 'direct';
// кампания из ссылок соцсетей (utm_campaign), тоже первое касание: в воронке видно, какой пост привел
const inCamp = (q.get('utm_campaign') || '').replace(/[^\w.-]/g, '').slice(0, 40);
if (inCamp && !localStorage.getItem('bp_camp')) localStorage.setItem('bp_camp', inCamp);
// данные клиента разделены по аккаунтам: у каждого входа свои результаты на этом устройстве
const K = k => { const u = meSync(); return u && u.id ? k + ':' + u.id : k; };
function claimLegacy() { const u = meSync(); if (!u || localStorage.getItem('bp_legacy_client')) return; localStorage.setItem('bp_legacy_client', u.id);
  for (const k of ['bp_tests', 'bp_profile', 'bp_done']) { const v = localStorage.getItem(k); if (v != null && localStorage.getItem(K(k)) == null) localStorage.setItem(K(k), v); localStorage.removeItem(k); } }
window.addEventListener('bp-login', () => claimLegacy());
const tests = () => JSON.parse(localStorage.getItem(K('bp_tests')) || '[]');
const saveTest = t => { const a = tests(); a.push(t); localStorage.setItem(K('bp_tests'), JSON.stringify(a.slice(-20))); backupSoon(); };
const bot = () => C.booking + '?start=app_' + encodeURIComponent(REF);
// v2.0: Гипертонус (SHORT), Перерастяжение (HYPER), Слабая (WEAK); NT — мышца этим тестом не измерялась, «нормой» ее не называем
const TONE_SPEC = { HYPER: ['Перерастяжение', 'var(--hyper)', 'var(--hyperS)', 'перегружена', 'Перерастяжение', 'var(--hyperT)'], SHORT: ['Гипертонус', 'var(--short)', 'var(--short-s)', 'зажата', 'Гипертонус', 'var(--short-t)'],
  WEAK: ['Слабая', 'var(--weak)', 'var(--weakS)', 'недорабатывает', 'Слабость', 'var(--weak-t)'], OK: ['Норма', 'var(--ok)', 'var(--ok-s)', 'норма', 'Норма', 'var(--ok-t)'], NT: ['Не измерено', 'var(--faint)', 'var(--line-2)', 'не измерено', 'Не измерено', 'var(--sub)'],
  DONE: ['Проработана сегодня', 'var(--ok)', 'var(--ok-s)', 'проработана сегодня', 'Проработана', 'var(--ok-t)'] };
// клиенту вместо состояния мышцы задача тренировки: что делать с зоной, без «гипертонуса» и «слабости» (юридический разбор, docs/legal_texts)
const TONE_CLIENT = { ...TONE_SPEC, HYPER: ['Мягко укрепить', 'var(--act-hyper)', 'var(--act-hyper-s)', 'мягко укрепить, не растягивать', 'Мягко укрепить', 'var(--act-hyper-t)'],
  SHORT: ['Расслабить', 'var(--act-short)', 'var(--act-short-s)', 'расслабить и растянуть', 'Расслабить', 'var(--act-short-t)'], WEAK: ['Укрепить', 'var(--act-weak)', 'var(--act-weak-s)', 'укрепить', 'Укрепить', 'var(--act-weak-t)'] };
// одна точка выбора: кабинет специалиста видит состояния, клиент видит задачи
let CLIENT_VIEW = false;
// кабинет специалиста видит состояния; клиент и отчет клиенту (asClient) видят задачи
function specView() { return isSpecialist() && !CLIENT_VIEW; }
const bySession = (spec, client) => new Proxy({}, { get: (_, k) => (specView() ? spec : client)[k] });
/** Отчет клиенту из кабинета специалиста: подписи и цвета как у клиента на время fn (без переключения режима и темы). */
export async function asClient(fn) { CLIENT_VIEW = true; clientPalette(true); try { return await fn(); } finally { CLIENT_VIEW = false; clientPalette(false); } }
export const TONE = bySession(TONE_SPEC, TONE_CLIENT);
// подпись состояния в числе зоны: «Глубокие мышцы шеи · не включаются», «Сгибатели бедра · зажаты»
const plural = id => { const z = (C.muscles[id] && C.muscles[id].zone) || ''; return /мышцы|^\S+(ые|ие|тели)\s/i.test(z + ' '); };
export const toneText = (s, i) => { const t = TONE[s.k][i]; return plural(s.id) ? t.replace('нута', 'нуты').replace('слабая', 'слабые').replace('ается', 'аются') : t; };
// что значит каждый цвет: одна строка простыми словами (клиент путал «укорочена» и «перегружена»)
const TONE_HELP_SPEC = `<details class="q"><summary aria-label="Что значат цвета">?</summary><div style="display:flex;flex-direction:column;gap:10px;line-height:1.4">
  <span><span class="mark sm SHORT"></span> <b>Гипертонус</b>: мышца зажата. Помогает расслабить и растянуть</span>
  <span><span class="mark sm HYPER"></span> <b>Перерастяжение</b>: мышцу тянет соседняя. Растягивать нельзя</span>
  <span><span class="mark sm WEAK"></span> <b>Слабая</b>: мышца не включается. Помогает укрепить</span>
  <span style="color:#B6BED0">В 3D точки бегут к центру мышцы, если она зажата, к краям, если растянута, и мерцают, если слабая</span></div></details>`;
const TONE_HELP_CLIENT = `<details class="q"><summary aria-label="Что значат цвета">?</summary><div style="display:flex;flex-direction:column;gap:10px;line-height:1.4">
  <span>Цвет показывает, что делать с зоной на тренировке. Теплый: нагрузить, холодный: расслабить.</span>
  <span><span class="mark sm WEAK"></span> <b>Укрепить</b>: упражнения, чтобы зона активнее включалась</span>
  <span><span class="mark sm HYPER"></span> <b>Мягко укрепить</b>: спокойные удержания. Растягивать не нужно</span>
  <span><span class="mark sm SHORT"></span> <b>Расслабить</b>: раскатка и мягкая растяжка</span></div></details>`;
export const TONE_HELP = () => specView() ? TONE_HELP_SPEC : TONE_HELP_CLIENT;
export const TONE_HEX = bySession({ HYPER: '#F59E0B', SHORT: '#EF4444', WEAK: '#3B73D9', OK: '#15803D', NT: '#B9BEC2', DONE: '#22C55E' }, { HYPER: '#EAB308', SHORT: '#2563EB', WEAK: '#F97316', OK: '#15803D', NT: '#B9BEC2', DONE: '#22C55E' });
export const TONE_TEXT_HEX = bySession({ HYPER: '#9E4E0E', SHORT: '#B42323', WEAK: '#2A5CB8', OK: '#15803D', NT: '#6B747A', DONE: '#15803D' }, { HYPER: '#A16207', SHORT: '#1D4ED8', WEAK: '#C2410C', OK: '#15803D', NT: '#6B747A', DONE: '#15803D' });
const sideWord = s => s === 'RIGHT' ? 'справа' : 'слева';
// ---------- итог в три строки: глагол действия, мышца, одна измеренная деталь ----------
const VERBS = [['WEAK', 'Укрепить'], ['SHORT', 'Расслабить'], ['HYPER', 'Разгрузить']];
const lc = t => t ? t[0].toLowerCase() + t.slice(1) : t;
// винительный падеж для названий мышц после глагола: «укрепить среднюю ягодичную»
const acc = t => t.split(' ').map(w => { const m = w.match(/^(.*?)([,.]?)$/), x = m[1];
  for (const [a, b] of [['ая', 'ую'], ['яя', 'юю'], ['ца', 'цу'], ['ия', 'ию']]) if (x.endsWith(a)) return x.slice(0, -a.length) + b + m[2];
  return w; }).join(' ');
// plain: клиенту бытовые зоны («ягодица сбоку справа») вместо анатомических названий
export function verdict(top, findings, plain = false) {
  return VERBS.map(([k, v0]) => { const verb = specView() ? v0 : TONE[k][4], items = top.filter(s => s.k === k && !s.ambiguous).slice(0, 12); if (!items.length) return null;
    const s0 = items[0], f = findings.find(f => f.muscles.some(m => m.id === s0.id && (m.side === s0.side || m.side === 'BOTH')));
    // одна мышца с двух сторон: «с двух сторон» вместо двух строк
    const ids = [...new Set(items.map(s => s.id))], names = ids.map(id => { const sd = items.filter(s => s.id === id).map(s => s.side);
      return (plain ? lc(C.muscles[id].zone || C.muscles[id].name) : acc(lc(C.muscles[id].name))) + ' ' + (sd.length > 1 ? 'с двух сторон' : sideWord(sd[0])); });
    if (plain) { const uniq = [...new Set(names)]; names.length = 0; names.push(...uniq.slice(0, 2)); }
    return { k, verb, f, what: names.join(', '), why: f ? f.observed.replace(' (на границе нормы)', '') : s0.byChain ? `Возможно, по цепи «${s0.byChain}»` : '' }; }).filter(Boolean);
}
// skip: причины, которые уже показаны выше на экране (блок «Измерено»), под решениями не повторяем.
// У каждой строки метка источника: ИЗМЕРЕНО (опирается на замер) или ГИПОТЕЗА (вывод по цепи). «На границе нормы» показываем, а не вырезаем.
// что значит каждое действие простыми словами: «вот почему мне так говорили»
const VERB_WHY = { WEAK: 'Упражнения, чтобы зона активнее включалась в движение.', SHORT: 'Раскатка и мягкая растяжка, чтобы движение стало свободнее.', HYPER: 'Спокойные удержания без растяжки, чтобы снять нагрузку.' };
export function verdictCard(top, findings, empty = 'Явных перекосов не видно', skip = [], plain = false) {
  const v = verdict(top, findings, plain);
  if (!v.length) return `<div class="card empty">${ic('check')}<b>${empty}</b><span class="sub">Движение симметричное. Повтори тест через месяц.</span></div>`;
  // камера мерит угол, а мышца выведена из него: метка «замер» стоит у факта, мышца подписана как вероятная причина (аудит, п. 2)
  return `<div class="card" style="padding:4px var(--s4)"><p class="sub" style="font-size:13px;padding-top:12px">${plain ? 'На что направить тренировку. Подобрано по тому, что увидела камера.' : 'Мышцы ниже: вероятная причина того, что измерила камера. Проверит специалист руками.'}</p>${v.map((x, i) => {
    const s0 = top.find(s => s.k === x.k && !s.ambiguous), f = s0 && findings.find(f => f.muscles.some(m => m.id === s0.id && (m.side === s0.side || m.side === 'BOTH')));
    const measured = f && s0 && !s0.derived && !s0.byChain, edge = f && / \(на границе нормы\)/.test(f.observed);
    // одно и то же наблюдение камеры под разными мышцами показываем один раз
    const why = x.why && !skip.includes(x.why) && !v.slice(0, i).some(y => y.why === x.why) ? `<span>${esc(x.why)}</span>` : '';
    return `<div class="verdict-row"><span class="mark ${x.k}"></span><div style="flex:1;min-width:0"><div class="what"><b>${x.verb}${plain ? ':' : ''}</b> ${esc(x.what)}</div>${plain ? `<div style="font-size:14px;line-height:1.4;color:var(--sub);margin-top:4px">${VERB_WHY[x.k]}</div>` : ''}
      <div class="why">${plain ? (why ? ic('camera', 's') : '') : measured ? '<span class="src">ЗАМЕР</span>' : '<span class="src hyp">ГИПОТЕЗА</span>'}${why}${edge ? '<span class="edge">на границе нормы</span>' : ''}</div></div></div>`; }).join('')}</div>`;
}
export const ex = id => C.exercises[id];
/** Название упражнения со стороной: «Ягодичный мостик, слева». Сторону не прячем, иначе непонятно, какую ногу качать. */
export const exSide = e => { const m = /\((левая|правая) сторона\)/.exec(e.title); return m ? (m[1] === 'левая' ? 'слева' : 'справа') : ''; };
export const exLabel = e => e.title.split(' (')[0] + (exSide(e) ? ', ' + exSide(e) : '');
const exSec = e => coachSec(e) + REST_NEXT + 15; // подходы и отдых по плану тренера, переход и короткое объяснение
export const minutes = e => Math.max(1, Math.ceil(exSec(e) / 60));
export const totalMin = list => Math.max(1, Math.round(list.reduce((x, e) => x + exSec(e), 0) / 60));
let view3d = null;
// тот же экран заново (правка, переключение вкладки): без анимации появления, иначе экран мигает
let lastHead = '';
const callerName = () => { try { const l = (new Error().stack || '').split('\n').map(x => x.trim()).filter(x => x.startsWith('at '));
  for (const x of l.slice(2)) { const m = /^at (?:async )?([\w$.]+)/.exec(x); if (m && !/^(go|Object\.go|HTMLButtonElement|HTMLDivElement|Promise|new Promise)/.test(m[1])) return m[1].replace(/^Object\./, '').slice(0, 40); } } catch (e) {} return 'screen'; };
export function go(html) { try { screenView(callerName()); } catch (e) {} delete document.documentElement.dataset.theme; document.querySelectorAll('.qpop').forEach(x => x.remove()); if (view3d) { view3d.dispose(); view3d = null; } backFn = null; const head = html.slice(0, 260); if (head === lastHead) html = html.replace(' fade', ''); lastHead = head; app.innerHTML = html; window.scrollTo(0, 0); syncThemeColor();
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = html.includes('class="cam"') ? '#0A0C0F' : / dark[ "]/.test(html.slice(0, 200)) ? '#0B1B3B' : '#F5F6FA'; }

// Конфиденциальность, соглашение, лицензии открываем внутри приложения листом: отдельная страница в установленном
// приложении закрывала его жестом «назад». Лист закрывается жестом «назад», как любой другой.
const DOC_RE = /^\/(privacy|terms|licenses)$/;
function docSheet(href) { const d = document.createElement('div'); d.className = 'sheet doc-sheet';
  d.innerHTML = `<div><button class="round" id="dcl" aria-label="Закрыть" style="position:absolute;right:12px;top:12px;z-index:1">${ic('x')}</button><iframe src="${esc(href)}" title="Документ" style="width:100%;height:80dvh;border:0;display:block;background:#fff;border-radius:12px"></iframe></div>`;
  document.body.appendChild(d); d.querySelector('#dcl').onclick = () => d.remove(); d.onclick = e => { if (e.target === d) d.remove(); }; }
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (!a || !DOC_RE.test(a.getAttribute('href'))) return; e.preventDefault(); e.stopPropagation(); docSheet(a.getAttribute('href')); }, true);

// ---------- «назад»: жест и системная кнопка ведут на шаг назад в приложении, а не закрывают его ----------
// В истории браузера держим одну запись-ловушку. Жест «назад» снимает ее, мы делаем шаг назад внутри
// приложения и ставим ловушку снова. На главном экране (нет кнопки «‹») жест закрывает приложение как обычно.
let backFn = null;
export const setBack = fn => { backFn = fn; };
const BACK_SEL = ['#x', '#back', '#lback', '#sback', '#sre'];
// ловушек держим три: после жеста «назад» новую запись Chrome тоже считает созданной без касания и пропускает,
// а во время теста человек экрана не касается. Запас из записей, поставленных по касанию, переживает несколько жестов подряд.
const TRAPS = 3, trapLvl = () => (history.state && history.state.bpTrap) || 0;
const armBack = () => { for (let k = trapLvl(); k < TRAPS; k++) history.pushState({ bpTrap: k + 1 }, ''); };
function stepBack() {
  const sheet = [...document.querySelectorAll('.sheet')].pop();
  if (sheet) { sheet.remove(); return true; }
  const dlg = app.querySelector('.cam-confirm'); if (dlg) { dlg.remove(); return true; } // повторный «назад» закрывает вопрос и продолжает тест
  if (backFn) { const f = backFn; backFn = null; f(); return true; }
  const b = BACK_SEL.map(s => app.querySelector(s)).find(x => x && x.offsetParent !== null);
  if (b) { b.click(); return true; }
  return false;
}
addEventListener('popstate', () => { if (stepBack()) { if (!trapLvl()) history.pushState({ bpTrap: 1 }, ''); } else history.back(); });
// Chrome пропускает при жесте «назад» записи, добавленные до первого касания страницы, и сразу закрывает вкладку.
// Поэтому ловушку ставим только по касанию: тогда запись считается созданной пользователем.
addEventListener('pointerdown', armBack, true);
// Telegram Mini App: своя кнопка «Назад» в шапке Telegram
try { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.BackButton && tg.initData) { tg.BackButton.show(); tg.BackButton.onClick(() => { stepBack(); }); } } catch (e) {}

// ---------- метаданные повторных тестов: тип скрининга и время старта ----------
export function testKind(units) { const u = units || [], n = rowsOf(u).length;
  return (u.includes('thold') || u.includes('calf') ? 'Силовой' : u.includes('side') || u.includes('back') ? 'Полный' : 'Быстрый') + ' ' + n + '-фазный'; }
export const testLabel = t => `${t.kind || testKind(t.protocol || Object.keys(t.moves || {}))} / ${new Date(t.started || t.date).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
// ---------- 7.4.3. активность за 4 недели в виде сетки: столбцы — дни недели, строки — недели, цвет — минуты ----------
export function doneMinutes(log) { const by = {}; for (const r of log) { const e = ex(r.id), d = new Date(r.t).toDateString(); by[d] = (by[d] || 0) + (e ? Math.max(10, e.durationSec) : 60) / 60; } return by; }
export function heatmap4w(by) {
  const now = new Date(); now.setHours(0, 0, 0, 0); const dow = (now.getDay() + 6) % 7, start = new Date(now - (dow + 21) * 864e5);
  const lvl = m => !m ? 0 : m < 5 ? 1 : m < 10 ? 2 : m < 20 ? 3 : 4, C4 = ['var(--surface-2)', '#CDEBD9', '#8FD3AE', '#22C55E', '#15803D'];
  const cells = Array.from({ length: 28 }, (_, i) => { const d = new Date(+start + i * 864e5), m = by[d.toDateString()] || 0, fut = d > now;
    return `<i title="${d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}: ${Math.round(m)} мин" style="display:block;aspect-ratio:1;border-radius:4px;background:${fut ? 'transparent' : C4[lvl(m)]};${+d === +now ? 'outline:2px solid var(--accent);outline-offset:1px' : ''}"></i>`; });
  const total = Math.round(Object.entries(by).filter(([d]) => new Date(d) >= start).reduce((a, [, m]) => a + m, 0));
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px;color:var(--sub);text-align:center;max-width:240px">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(x => `<span>${x}</span>`).join('')}${cells.join('')}</div>
    <div class="row" style="font-size:12px;color:var(--sub);gap:4px;justify-content:space-between"><span>${total} мин за 4 недели</span><span class="row" style="gap:3px">меньше ${C4.map(c => `<i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c}"></i>`).join('')} больше</span></div>`; }

// ---------- данные карты ----------
export function spots(a) {
  return a.tones.map(t => { const m = C.muscles[t.id]; if (!m) return null;
    const k = t.kind && Math.abs(t.tone) > .2 ? t.kind : t.tone > .2 ? (a.kindOf ? a.kindOf(t) : 'HYPER') : t.tone < -.2 ? 'WEAK' : 'OK';
    return { id: t.id, side: t.side, tone: t.derived ? t.tone * .7 : t.tone, k, back: m.view === 'back', derived: t.derived, ambiguous: t.ambiguous, byChain: t.byChain, cause: t.cause, x: t.side === 'LEFT' ? m.xLeft : 1 - m.xLeft, y: m.y, key: t.id + ':' + t.side };
  }).filter(Boolean);
}
/** Главные зоны: сначала измеренные, затем выведенные по подтвержденной цепи (с пометкой «возможно»).
 *  Раньше выведенные по цепи в списки не попадали вовсе, и, например, грудные при сутулости не показывались. */
export const topOf = all => all.filter(s => s.k !== 'OK' && (!s.derived || s.byChain || s.cause)).sort((x, y) => (!!x.derived - !!y.derived) || Math.abs(y.tone) - Math.abs(x.tone));
// Список клиента — эталон: клиент считает разбор у себя и отправляет специалисту готовый список мышц (main).
// Специалист показывает ровно его, пока сам ничего не поменял: так версия программы, веса правил или округление
// на двух телефонах уже не могут дать разную картинку.
const spotFor = (id, side) => { const m = C.muscles[id]; return m ? { id, side, tone: 0, k: 'OK', back: m.view === 'back', x: side === 'LEFT' ? m.xLeft : 1 - m.xLeft, y: m.y, key: id + ':' + side } : null; };
export const MAIN_RE = /^[a-z_]{1,32}:(LEFT|RIGHT)$/;
/** Применить эталонный список к пятнам: цвет и сила из списка, отсутствующие мышцы добавляются. */
export function applyMain(all, main) { if (!Array.isArray(main)) return all; const by = new Map(main.map(m => [m.key, m]));
  const out = all.map(x => { const m = by.get(x.key); return m ? { ...x, k: m.k, tone: m.tone, derived: !!m.d, byChain: m.c || null, ambiguous: false } : x; });
  for (const m of main) if (!out.some(x => x.key === m.key)) { const [id, side] = m.key.split(':'), b = spotFor(id, side); if (b) out.push({ ...b, k: m.k, tone: m.tone, derived: !!m.d, byChain: m.c || null }); }
  return out; }
/** Главный список из эталона: в том же порядке, что считал клиент. */
export const fromMain = (all, main) => main.map(m => all.find(x => x.key === m.key)).filter(Boolean);
/** Поставить эталон в результат перед сохранением и отправкой. */
export function stampMain(r) { try { r.main = mainOf(spots(analyze(r, C))).map(s => ({ key: s.key, k: s.k, tone: Math.round(s.tone * 100) / 100, ...(s.derived ? { d: 1 } : {}), ...(s.byChain ? { c: String(s.byChain).slice(0, 60) } : {}) })); r.rules = C.bodymap && C.bodymap.version; } catch (e) {} return r; }
export const cleanMain = m => Array.isArray(m) ? m.slice(0, 24).filter(x => x && MAIN_RE.test(x.key) && ['WEAK', 'SHORT', 'HYPER'].includes(x.k) && Number.isFinite(x.tone)).map(x => ({ key: x.key, k: x.k, tone: Math.max(-1, Math.min(1, x.tone)), ...(x.d ? { d: 1 } : {}), ...(typeof x.c === 'string' ? { c: x.c.replace(/[<>&"'`]/g, '').slice(0, 60) } : {}) })) : undefined;
/** Единый список «над чем работаем» для клиента и специалиста: строки итога, 2D-схема, 3D и упражнения берут ровно его.
 *  По 3 мышцы на состояние (укрепить, растянуть, расслабить); conf — отметки специалиста «нет» убирают мышцу. */
// лимит считаем по мышцам, а не по сторонам: иначе одна мышца с двух сторон показывалась только слева
export const mainOf = (all, conf = {}) => { const t = topOf(all.filter(s => conf[s.key] !== 'no'));
  return ['WEAK', 'SHORT', 'HYPER'].flatMap(k => { const l = t.filter(s => s.k === k && !s.ambiguous), ids = [...new Set(l.map(s => s.id))].slice(0, 3); return l.filter(s => ids.includes(s.id)); }); };
export const title = s => `${C.muscles[s.id].zone || C.muscles[s.id].name} ${sideWord(s.side)}: ${s.ambiguous ? 'признаки противоречат' : s.derived ? toneText(s, 3).replace('похоже', 'возможно') : toneText(s, 3)}`;
// для специалиста: конкретная мышца вместо области тела («Средняя ягодичная справа: похоже, не включается»)
const pluralName = id => /мышцы|^\S+(ые|ие|тели)(\s|$)/i.test(C.muscles[id].name + ' ');
export const ntitle = s => { let t = s.ambiguous ? 'признаки противоречат' : TONE[s.k][3]; if (s.derived && !s.edited) t = t.replace('похоже', 'возможно'); if (pluralName(s.id)) t = t.replace('нута', 'нуты').replace('слабая', 'слабые').replace('ается', 'аются');
  return `${C.muscles[s.id].name} ${sideWord(s.side)}: ${t}`; };
// короткие названия для подписей на схеме: узнаваемые специалисту сокращения
export const SHORT = { piriformis: 'Грушевидная', supraspinatus: 'Надостная', soleus: 'Камбаловидная', upper_trap: 'Верх. трапеция', levator: 'Подн. лопатку', suboccipital: 'Подзатылочные', lower_trap: 'Ниж. трапеция', rhomboid: 'Ромбовидные', erector: 'Разгиб. спины',
  ql: 'Квадр. поясн.', glute_med: 'Ср. ягодичная', glute_max: 'Б. ягодичная', hamstrings: 'Задняя группа бедра', calf: 'Икроножная', scm: 'ГКС', scalene: 'Лестничные', deep_neck_flex: 'Глуб. сгибат.',
  pec_minor: 'М. грудная', obliques: 'Косые живота', iliopsoas: 'Илиопсоас', tfl: 'Напр. фасции', rectus_fem: 'Прямая бедра', adductors: 'Приводящие', pec_major: 'Б. грудная',
  lats: 'Широчайшая', serratus: 'Зубчатая', rectus_abd: 'Прямая живота', vmo: 'Вн. широкая', abdominals: 'Пресс', thoracic_ext: 'Грудн. разгиб.', tibialis: 'Большеберцовая',
  vastus_lat: 'Нар. широкая', triceps: 'Трицепс', biceps: 'Бицепс', deltoid: 'Дельтовидная', forearm_flex: 'Предплечье', peroneus: 'Малоберцовые' };
export const tech = s => s.k === 'OK' ? C.muscles[s.id].name : specView() ? `${TONE[s.k][4]} ${C.muscles[s.id].gen}` : `${TONE[s.k][4]}: ${lc(C.muscles[s.id].zone || C.muscles[s.id].name)}`;
const TONE_WHY_SPEC = { HYPER: `перерастянута: ее тянет напряженная соседняя, и она держит сустав из последних сил. ${STATES.HYPER.forbid[0].toUpperCase() + STATES.HYPER.forbid.slice(1)}.`, SHORT: `в гипертонусе: зажата и укорочена. Помогают ${STATES.SHORT.do}.`, WEAK: `слабая: не включается в движение, ее работу забирают соседние. Помогает ${STATES.WEAK.do}.` };
const TONE_WHY_CLIENT = { HYPER: 'Задача тренировки: мягко укрепить. Растягивать и раскатывать эту зону не нужно, помогают спокойные удержания.', SHORT: 'Задача тренировки: расслабить. Помогают раскатка мячом и мягкая растяжка.', WEAK: 'Задача тренировки: укрепить, чтобы зона активнее включалась в движение.' };
/** Касание мышцы на 3D: шторка с названием, состоянием простыми словами, причиной из замера и проверкой руками.
 *  pro — для специалиста (проверка специалистом вместо самопроверки), onWhat — кнопка «Что делать». */
export function muscleInfo(key, all, a, { pro = false, onWhat } = {}) {
  const [id, side] = String(key).split(':'), m = C.muscles[id]; if (!m) return;
  const x0 = all.find(q => q.key === key) || { id, side, k: 'OK', tone: 0, key };
  const x = x0.k === 'OK' && a && !measuredIds(a, C.bodymap && C.bodymap.rules).has(id) ? { ...x0, k: 'NT' } : x0;
  const why = a ? seen(a, x) : [], test = pro ? m.proTest : m.selfTest, act = ACTION_NAMES[id];
  document.querySelectorAll('#minfo').forEach(e => e.remove());
  const d = document.createElement('div'); d.className = 'sheet'; d.id = 'minfo';
  d.innerHTML = `<div><div class="row" style="gap:8px"><span class="mark ${x.k}"></span><span style="font-size:13px;font-weight:600;color:${TONE[x.k][5]}">${x.k === 'NT' ? NT_TEXT : x.k === 'OK' ? 'Без отклонений' : x.ambiguous ? 'Признаки противоречат' : TONE[x.k][0]}${x.derived ? ' · гипотеза' : ''}</span></div>
    <h2 style="margin-top:6px">${esc(m.name)} ${side === 'RIGHT' ? 'справа' : 'слева'}</h2>${act && !pro ? `<div style="font-size:14px;margin-top:2px"><b>${act.name}</b>: ${act.does}</div>` : ''}${m.zone ? `<div class="sub" style="font-size:14px">${esc(m.zone)}</div>` : ''}
    ${x.k === 'NT' ? `<p class="sub" style="font-size:15px;margin-top:10px">${NT_TEXT}: ни одно движение этого теста ее не проверяло. Это не значит, что с ней все в порядке.</p>` : x.k !== 'OK' ? `<p style="font-size:15px;line-height:1.45;margin-top:10px">${specView() ? 'Мышца ' + TONE_WHY_SPEC[x.k] : TONE_WHY_CLIENT[x.k]}</p>` : `<p class="sub" style="font-size:15px;margin-top:10px">Этот тест ее проверял: отклонений не видно.</p>`}
    ${why.length ? `<div style="margin-top:10px;font-size:14px;line-height:1.45"><span class="src">ЗАМЕР</span> ${why.slice(0, 2).map(esc).join('; ')}</div>` : x.byChain ? `<div style="margin-top:10px;font-size:14px"><span class="src hyp">ГИПОТЕЗА</span> по цепи «${esc(x.byChain)}»</div>` : ''}
    ${!['OK', 'NT'].includes(x.k) && m.benefit ? `<p class="sub" style="font-size:14px;line-height:1.45;margin-top:10px">${esc(m.benefit)}</p>` : ''}
    ${test ? `<details class="acc" style="margin-top:10px;font-size:14px;line-height:1.45"><summary style="font-weight:600">${pro ? 'Проверка руками' : 'Как проверить самому'}</summary><p style="margin-top:6px">${esc(test)}</p></details>` : ''}
    ${!['OK', 'NT'].includes(x.k) && onWhat ? `<button class="btn" id="mi_what" style="margin-top:14px">Что делать</button>` : ''}<button class="btn ghost" id="mi_x" style="margin-top:8px">Закрыть</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('#mi_x').onclick = () => d.remove();
  if (d.querySelector('#mi_what')) d.querySelector('#mi_what').onclick = () => { d.remove(); onWhat(id); };
}
const seen = (a, s) => [...new Set(a.findings.filter(f => f.muscles.some(m => m.id === s.id && (m.side === s.side || m.side === 'BOTH'))).map(f => f.observed))];
export function zoneImg(id) { if (['suboccipital', 'scm', 'scalene', 'deep_neck_flex', 'levator'].includes(id)) return 'img_neck'; if (['upper_trap', 'lower_trap', 'rhomboid', 'lats', 'thoracic_ext', 'serratus', 'triceps', 'deltoid'].includes(id)) return 'img_muscles_back';
  if (['pec_major', 'pec_minor', 'biceps'].includes(id)) return 'img_onb_skeleton'; if (['ql', 'erector', 'obliques', 'abdominals', 'rectus_abd'].includes(id)) return 'img_back_pain'; return 'img_spine'; }
/** Мышцы, проработанные сегодня: по упражнениям из журнала, которые входят в их списки. */
export function workedToday() { const today = new Date().toDateString(), done = new Set(JSON.parse(localStorage.getItem(K('bp_done')) || '[]').filter(r => new Date(r.t).toDateString() === today).map(r => r.id)), out = new Set();
  if (!done.size) return out; for (const [id, m] of Object.entries(C.muscles)) { const l = [...(m.relax || []), ...(m.activate || []), ...((m.plan && [...(m.plan.isolate || []), ...(m.plan.release || []), ...(m.plan.integrate || [])]) || [])];
    for (const sk of ['left', 'right']) if (l.some(x => done.has(x.replace('{s}', sk)))) out.add(id + ':' + (sk === 'left' ? 'LEFT' : 'RIGHT')); } return out; }
/** 7.4.4. Комплекс на выбранное время: сначала мышцы, не проработанные сегодня; при нехватке упражнений круг повторяется. */
export function planFor(top, minutes) { const worked = workedToday(), pool = [];
  const order = [...top.filter(s => !worked.has(s.key)), ...top.filter(s => worked.has(s.key))];
  for (const s of order) { const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left', ant = m.antagonist && C.muscles[m.antagonist];
    const l = s.k === 'WEAK' ? [...((m.plan && m.plan.release) || []), ...((m.plan && m.plan.isolate) || m.activate || []), ...((m.plan && m.plan.integrate) || [])] : [...releaseFor(m, s.k, ex), ...(ant ? (ant.activate || []) : [])];
    for (const x of l) { const id = x.replace('{s}', sk); if (ex(id) && !pool.includes(id)) pool.push(id); } }
  if (!pool.length) return plan(top); const out = []; let sec = 0, k = 0;
  while (sec < minutes * 60 && k < 200) { const id = pool[k % pool.length]; out.push(id); sec += Math.max(10, ex(id).durationSec) + 15; k++; }
  return out; }
// комплекс: 3–4 упражнения по найденным зонам; зон мало — второе упражнение для главных зон
export function plan(top) { const ids = [], opts = s => { const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left';
    return (s.k === 'WEAK' ? [...((m.plan && m.plan.isolate) || []), ...(m.activate || [])] : releaseFor(m, s.k, ex)).map(x => x.replace('{s}', sk)).filter(id => ex(id)); };
  const add = id => { if (id && !ids.includes(id) && ids.length < 4) ids.push(id); };
  for (const s of top.slice(0, 4)) add(opts(s)[0]);
  for (const s of top.slice(0, 3)) if (ids.length < 3) opts(s).slice(1).forEach(add);
  return ids; }
// кабинет специалиста только после входа
export async function openPro() { if (await ensureLogin('specialist', openPro, { back: onboarding })) proHome(); }
let SHARED = null; // результат, открытый по чужой ссылке
let SHOW_T = null; // тест из истории, открытый в кабинете
function currentAnalysis() { const all = tests(), t = SHARED || (SHOW_T && all.find(x => x.date === SHOW_T)) || all.at(-1); return t ? { t, a: analyze(t, C) } : null; }

// ---------- результат в ссылке: данные теста сжаты в адрес, сервер не нужен ----------
const r1 = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v));
async function packResult(t) {
  const m = {}; for (const [k, v] of Object.entries(t.moves || {})) m[k] = { f: v.f, reps: v.reps, quality: v.quality };
  const json = JSON.stringify(r1({ v: 1, date: t.date, full: t.full, snapshot: t.snapshot, side: t.side, moves: m }));
  let bytes = new TextEncoder().encode(json), z = '0';
  if (window.CompressionStream) { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); z = '1'; }
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return z + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpackResult(code) {
  const z = code[0], b64 = code.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  let bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (z === '1') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
// результат из ссылки чужой: оставляем только числа в ожидаемой структуре, иначе битая ссылка ломала карту
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const numObj = (o, keys) => { if (!o || typeof o !== 'object') return null; const r = {}; for (const k of keys || Object.keys(o).slice(0, 120)) if (/^[a-z_]{1,32}$/.test(k) && num(o[k]) !== undefined) r[k] = o[k]; return r; };
export function cleanResult(o) {
  if (!o || typeof o !== 'object') throw new Error('bad result');
  const moves = {}; for (const [k, v] of Object.entries(o.moves && typeof o.moves === 'object' ? o.moves : {}).slice(0, 20)) {
    if (!/^[a-z_]{1,20}$/.test(k) || !v || typeof v !== 'object') continue;
    // значения по повторам нужны анализу (голосование повторов): без них у специалиста находки получались другими, чем у клиента
    const f = numObj(v.f) || {}, rp = v.f && v.f.reps && typeof v.f.reps === 'object' ? v.f.reps : null;
    if (rp) { f.reps = {}; for (const [rk, arr] of Object.entries(rp).slice(0, 20)) if (/^[a-z_]{1,32}$/.test(rk) && Array.isArray(arr)) f.reps[rk] = arr.slice(0, 30).filter(x => num(x) !== undefined); }
    moves[k] = { f, reps: num(v.reps) || 0, quality: ['GOOD', 'DOUBTFUL', 'RETAKE'].includes(v.quality) ? v.quality : 'DOUBTFUL', ...(v.alt ? { alt: 'support' } : {}) }; }
  return { date: num(o.date) || Date.now(), full: !!o.full, snapshot: numObj(o.snapshot, ['shoulderTilt', 'pelvicTilt', 'headTilt', 'trunkLateral', 'handRotL', 'handRotR', 'sway', 'yaw']),
    side: numObj(o.side, ['headForwardDeg', 'hipShift', 'shoulderShift', 'kneeHyperDeg', 'femurTibia']), quality: numObj(o.quality) || {}, moves, ...(cleanMain(o.main) ? { main: cleanMain(o.main) } : {}) };
}
async function resultLink() { return location.origin + location.pathname + '#r=' + await packResult(currentAnalysis().t); }

// ---------- 1. знакомство ----------
export function onboarding() {
  setSession(MODES.SELF);
  // лендинг для специалистов (ТЗ v4, п. 8): новым посетителям без приглашения и без своих тестов; тест для себя по ссылке внизу
  // «тест для себя» помнится только до закрытия вкладки: раньше флаг жил навсегда, и лендинг больше не открывался
  try { localStorage.removeItem('bp_self'); } catch (e) {}
  const self = (() => { try { return sessionStorage.getItem('bp_self'); } catch (e) { return null; } })();
  // новый дизайн (Apple Matte): старый экран «тест для себя» открывается только по приглашению клиента или в старом дизайне
  // (галочка «Новый дизайн» в «Администрировании»)
  if (!INV() && (isMatte() || (!tests().length && !localStorage.getItem('bp_acc') && !self)))
    return import('./landing.js').then(m => m.landing({ onTry: () => openPro(), onLogin: () => openPro(), onSelf: () => { try { sessionStorage.setItem('bp_self', '1'); } catch (e) {} onboarding(); } }));
  go(`<div class="scr welcome fade">
    <img class="welcome-bg" src="img/bp-hero-client.webp" alt="">
    <div class="row pad" style="padding-top:18px;position:relative"><img src="icons/mark.svg" width="36" height="36" alt=""><b class="brand-name">BodyPassport</b><span style="flex:1"></span><button class="spec-pill" id="pro">${ic('users', 's')}Я специалист</button></div>
    <div class="pad welcome-txt"><div class="welcome-kicker">Паспорт вашего тела</div><h1>Проверьте, как вы двигаетесь, за&nbsp;4&nbsp;минуты</h1>
      <p>Камера телефона посмотрит на осанку и движения и подскажет, с чего начать. Видео не записывается и не покидает телефон.</p>
      ${INV() ? '' : `<div class="row" style="margin-top:18px;gap:10px"><img src="img/rifat.jpg" alt="Рифат Аюпов" width="36" height="36" style="border-radius:50%;object-fit:cover;flex:none;border:1.5px solid rgba(255,255,255,.4)"><div style="font-size:13px;line-height:1.35"><b style="font-weight:600;display:block">Методика Рифата Аюпова</b><span style="opacity:.7">кинезиотерапевт, биомеханик</span></div></div>`}</div>
    <div class="dock dark-dock"><button class="btn white" id="next">Начать тест ${ic('arrow-right', 's')}</button><button class="btn ghost on-dark" id="mycab"${myReports().length || tests().length ? '' : ' hidden'}>${ic('user', 's')}Мой кабинет</button><button class="btn ghost on-dark" id="pro2">${ic('users', 's')}Кабинет специалиста</button></div></div>`);
  // уже есть кабинет: вошедший специалист идет в свой кабинет, клиент с аккаунтом или тестами в свой
  // вход проверяем заново: запомненный ответ мог быть «не вошел» из-за сбоя сети при запуске
  $('#mycab').onclick = clientHome;
  { const acc = localStorage.getItem('bp_acc'); if (acc) { $('#mycab').hidden = false; if (acc === 'pro') $('#mycab').onclick = () => openPro(); } }
  getMe(true).then(u => { const b = $('#mycab'); if (!b || !b.isConnected) return; if (!u) return; localStorage.setItem('bp_acc', u.role === 'specialist' ? 'pro' : '1'); b.hidden = false;
    if (u.role === 'specialist') { b.onclick = () => openPro(); for (const id of ['#pro', '#pro2']) { const pr = $(id); if (pr) pr.remove(); } } }).catch(() => {});
  $('#next').onclick = () => { track('onb_done'); prep(); }; for (const id of ['#pro', '#pro2']) if ($(id)) $(id).onclick = () => localStorage.getItem('bp_inv') ? specSheet() : openPro(); if ($('#inst1')) $('#inst1').onclick = () => installNow();
}

// ---------- 2. подготовка ----------
const PRE = {}; // тесты, от которых человек отказался заранее
let FULL = false, STRENGTH = localStorage.getItem('bp_str') !== '0';
// ---------- протоколы: из блоков собираются и тест клиента, и шаблоны специалиста ----------
// секунды шагов измерены по длине записанных фраз и паузам в коде
export const UNITS = {
  stand: [['Стой ровно', 'Руки вдоль тела', 17]],
  ohs_front: [['Присед с руками вверх', 'Стопы чуть шире плеч, 5 раз', 36]],
  sls: [['Стоя на правой ноге', 'Левую согнуть назад, 3 неглубоких приседа', 29], ['Стоя на левой ноге', 'Правую согнуть назад, 3 неглубоких приседа', 27]],
  thold: [['Руки в стороны', 'Держать 20 секунд', 26]],
  bends: [['Наклоны в стороны', 'Вправо и влево', 27]],
  calf: [['На носок правой ноги', '15 секунд', 27], ['На носок левой ноги', '15 секунд', 24]],
  side: [['Боком: стоять и 3 приседа', 'Правое плечо к камере, стопы шире плеч', 52]],
  // стойка боком без приседа: без нее не видно сутулость, вынос головы, таз вперед и переразгибание колен
  profile: [['Боком: стой ровно', 'Правое плечо к камере', 20]],
  back: [['Спиной: 3 приседа', 'Спиной к камере', 38]],
  // батарея v2.0 (6 этапов, 2 мин 15 с): наклон вперед, баланс на одной ноге, ротация корпуса, руки вверх
  fwd: [['Наклон вперед', 'Медленно тянитесь руками к полу', 18]],
  slb: [['Баланс на одной ноге', 'По 6 секунд на каждой', 22]],
  trot: [['Повороты корпуса', 'Туда-сюда несколько раз, руки на груди', 18]],
  reach: [['Руки вверх', '3 раза, медленно', 18]],
  // Safety Gate: безопасная замена при боли
  chair: [['Вставание со стула', '30 секунд', 40]],
};
export const ORDER = ['stand', 'ohs_front', 'fwd', 'slb', 'sls', 'trot', 'reach', 'thold', 'bends', 'calf', 'profile', 'side', 'back', 'chair'];
// «боком» уже включает стойку боком: отдельная стойка не нужна
export const sortUnits = u => ORDER.filter(x => u.includes(x) && !(x === 'profile' && u.includes('side')));
// быстрый: батарея v2 и присед боком (без него не видно, держит ли поясница в приседе и выносится ли голова); точный: плюс одна нога и спиной
export const QUICK_UNITS = [...BATTERY_UNITS, 'side'], FULL_UNITS = [...QUICK_UNITS, 'sls', 'back'];
const consumerProtocol = () => FULL ? sortUnits([...FULL_UNITS, ...(STRENGTH ? ['thold', 'bends', 'calf'] : [])]) : sortUnits(QUICK_UNITS);
export const rowsOf = p => sortUnits(p).flatMap(u => UNITS[u]);
const QUICK = rowsOf(QUICK_UNITS), FULLS = rowsOf(FULL_UNITS), STR = rowsOf(['thold', 'bends', 'calf']);
export const SETUP_SEC = 36;
export const secs = l => l.reduce((x, s) => x + s[2], 0);
export const mins = sec => (Math.ceil(sec / 30) / 2).toString().replace('.', ',');
const stepsOf = () => rowsOf(consumerProtocol().filter(u => !PRE[u] || PRE[u].alt));
export async function prep() {
  setSession(MODES.SELF);
  if (!(await ensureLogin('client', prep, { back: onboarding }))) return;
  if (!safetyOk()) return safetyScreen(prep, onboarding, bot());
  if (!profileOk()) return profileSteps(prep, onboarding);
  voice.preload(Object.values(SAY)); prefetchPose();
  const reopen = !!document.getElementById('prepsheet');
  const steps = stepsOf(), m = mins(SETUP_SEC + secs(steps));
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:var(--s4)">
    <div><div class="eyebrow">${m} мин · ${steps.length} ${plural3(steps.length, 'шаг', 'шага', 'шагов')}</div><h1 style="margin-top:8px">Поставьте телефон</h1></div>
    <div class="card"><div class="row" style="gap:var(--s2);align-items:flex-end;justify-content:center;padding:4px 0 12px">
      <svg width="34" height="56" viewBox="0 0 34 56" aria-hidden="true"><rect x="2" y="2" width="30" height="52" rx="6" fill="none" stroke="var(--ink)" stroke-width="2.5"/><circle cx="17" cy="9" r="2.5" fill="var(--ink)"/></svg>
      <div style="flex:1;max-width:150px;text-align:center"><div class="measure sm" style="justify-content:center"><b>2–4</b><u>м</u></div><div style="border-top:2px dashed var(--line);margin-top:6px"></div></div>
      <svg width="40" height="76" viewBox="0 0 200 380" aria-hidden="true"><circle cx="100" cy="44" r="24" fill="var(--figure)" stroke="var(--faint)" stroke-width="5"/><path d="M78 72 L122 72 Q140 74 144 92 L156 176 Q158 186 150 188 Q144 188 142 180 L132 112 L128 190 L130 268 L128 352 Q128 362 118 362 Q110 362 110 352 L104 210 L96 210 L90 352 Q90 362 82 362 Q72 362 72 352 L70 268 L72 190 L68 112 L58 180 Q56 188 50 188 Q42 186 44 176 L56 92 Q60 74 78 72 Z" fill="var(--figure)" stroke="var(--faint)" stroke-width="5"/></svg></div>
      ${[['smartphone', 'Вертикально, на уровне пояса'], ['maximize', 'Видно целиком, от головы до стоп'], ['sun', 'Лицом к свету, одежда по фигуре'], ['volume-2', 'Звук включен: голос ведет весь тест']].map(([i, t]) => `<div class="row" style="padding:12px 0;border-top:1px solid var(--line-2);font-size:15px"><span style="color:var(--brand)">${ic(i, 's')}</span><span style="flex:1">${t}</span></div>`).join('')}</div>
    <div class="group"><div class="row" style="min-height:60px"><div style="flex:1;min-width:0"><b style="font-size:15px">${FULL ? 'Точный тест' : 'Быстрый тест'}</b><div style="font-size:13px;color:var(--sub)">${cam.back ? 'Основная камера' : 'Фронтальная камера'}</div></div><button class="link" id="chg">Изменить</button></div></div>
    <details class="acc" id="compo"><summary style="font-weight:600;font-size:15px">Состав теста</summary>${sortUnits(consumerProtocol()).flatMap(u => UNITS[u] || []).map((r, k) => `<div class="row" style="padding:6px 0"><span class="step-n" style="width:22px;flex:none">${String(k + 1).padStart(2, '0')}</span><span style="flex:1;font-size:15px">${r[0]}</span><span style="font-size:12px;color:var(--sub)">${r[2]} с</span></div>`).join('')}
      <button class="link" id="cant" style="min-height:44px;font-size:14px">Не могу выполнить некоторые движения</button></details>
    ${device.inApp ? `<div class="card row" style="align-items:flex-start">${ic('info')}<span style="font-size:14px;line-height:1.4">Камера может не работать внутри соцсети. Меню «⋯» → «Открыть в браузере».</span></div>` : ''}
   </div>
   <div class="dock"><button class="btn" id="start">${ic('play', 's')}Начать тест</button>${skipBtn()}</div></div>`);
  $('#back').onclick = () => tests().length ? map() : onboarding();
  $('#chg').onclick = () => prepSheet(); $('#cant').onclick = () => prepSheet(true);
  if ($('#skipTest')) $('#skipTest').onclick = () => { track('beta_skip_test'); saveTest(fakeResult(consumerProtocol())); analysisScreen(); };
  if (reopen) prepSheet(false, true);
  // обычная кнопка вместо свайпа: свайп не находили и не понимали (аудит, п. 15)
  let starting = false; $('#start').onclick = async () => { if (cameraBlocked()) return openInBrowserSheet(); if (starting) return; starting = true; $('#start').disabled = true; const r = await launchTest(runTest, e => startError(e, () => launchTest(runTest, () => prep()))); if (r === null && $('#start')) prep(); };
}
// шторка настроек теста: режим, камера, сила, список шагов с «Не могу». После перерисовки prep() остается открытой
function prepSheet(toSteps, keep) {
  document.querySelectorAll('#prepsheet').forEach(x => x.remove());
  const d = document.createElement('div'); d.className = 'sheet'; d.id = 'prepsheet'; if (keep) d.style.animation = 'none';
  d.innerHTML = `<div${keep ? ' style="animation:none"' : ''}><h2>Настройки теста</h2>
    <div class="seg" style="margin-top:var(--s4)"><button id="m0" class="${FULL ? '' : 'on'}">Быстрый · ${mins(SETUP_SEC + secs(QUICK))} мин</button><button id="m1" class="${FULL ? 'on' : ''}">Точный · ${mins(SETUP_SEC + secs(FULLS) + (STRENGTH ? secs(STR) : 0))} мин</button></div>
    <div class="eyebrow" style="margin-top:var(--s5)">Камера</div><div class="seg" style="margin-top:8px"><button id="c0" class="${cam.back ? '' : 'on'}">Фронтальная</button><button id="c1" class="${cam.back ? 'on' : ''}">Основная</button></div>
    <p class="sub" style="font-size:13px;margin-top:6px">${cam.back ? 'Точнее картинка. Экран не видно, ведет голос.' : 'Во время теста вы видите себя на экране.'}</p>
    ${FULL ? `<label class="card row" style="margin-top:var(--s4);align-items:flex-start"><input type="checkbox" class="check" id="strc" ${STRENGTH ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Сила и симметрия</b><div class="sub" style="font-size:13px">Сравнит левую и правую сторону: плечи, бока, икры, бедра. Добавляет ${mins(secs(STR))} мин</div></div></label>` : `<p class="sub" style="font-size:13px;margin-top:var(--s4)">Быстрый: ${QUICK.length} шагов лицом и боком, около ${mins(SETUP_SEC + secs(QUICK))} мин. Сила и симметрия левой и правой стороны есть в точном тесте.</p>`}
    <div id="stepsat" class="eyebrow" style="margin-top:var(--s5)">Шаги</div><div style="margin-top:8px">${stepList(consumerProtocol(), PRE)}</div>
    <button class="btn" id="psx" style="margin-top:var(--s5)">Применить</button></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); prep(); };
  d.onclick = e => { if (e.target === d) close(); }; d.querySelector('#psx').onclick = close;
  bindStepList(PRE, prep);
  if ($('#strc')) $('#strc').onchange = e => { STRENGTH = e.target.checked; localStorage.setItem('bp_str', STRENGTH ? '1' : '0'); prep(); };
  $('#m0').onclick = () => { FULL = false; prep(); }; $('#m1').onclick = () => { FULL = true; prep(); };
  $('#c0').onclick = () => { cam.back = false; localStorage.setItem('bp_back', '0'); prep(); }; $('#c1').onclick = () => { cam.back = true; localStorage.setItem('bp_back', '1'); prep(); };
  if (toSteps) d.querySelector('#stepsat').scrollIntoView({ block: 'start' });
}
const plural3 = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;

// ---------- 3. тест камерой ----------
// Одни и те же слова на экране и в голосе: заголовок = что делать, подпись = как, голос = заголовок + коротко как.
// Голос говорит полную инструкцию (человек может не видеть экран), на экране коротко.
const S = {
  setup: ['Встань в кадр', 'Весь рост, от макушки до стоп', 'Отойди от телефона на два–четыре метра, чтобы в кадре было всё тело, от макушки до стоп'],
  far: ['Отойди дальше', 'Не видно стопы или голову', 'Отойди дальше. Камера не видит всё тело'],
  hold: ['Стой ровно', 'Руки вдоль тела, смотри в камеру', 'Встань прямо, стопы на ширине таза, руки вдоль тела. Смотри в камеру и не двигайся'],
  ohs: ['Присед с руками вверх', '3 раза, пятки на полу', 'Подними прямые руки вверх. Медленно присядь три раза, как можно глубже без боли. Пятки не отрывай, колени над стопами. Начинай, я буду считать'],
  side: ['Повернись правым боком', 'Правое плечо к камере', 'Повернись правым боком к камере, правое плечо к телефону'],
  back: ['Повернись спиной', 'Спиной к камере', 'Повернись спиной к камере'],
  front: ['Повернись лицом', 'Лицом к камере', 'Повернись лицом к камере'],
  slsR: ['Стоя на правой ноге', 'Чуть согнуть колено 3 раза, на 10–15 см, можно держаться за стену', 'Встань на правую ногу, левую согни и подними. Можно держаться рукой за стену. Медленно присядь неглубоко три раза. Начинай, я буду считать'],
  slsL: ['Стоя на левой ноге', 'Чуть согнуть колено 3 раза, на 10–15 см, можно держаться за стену', 'Теперь встань на левую ногу, правую согни и подними. Медленно присядь неглубоко три раза. Начинай'],
  done: ['Готово', 'Считаю результат', 'Готово. Считаю результат'],
  thold: ['Руки в стороны', 'На уровне плеч, держи 20 секунд', 'Подними прямые руки в стороны до уровня плеч, ладони вниз, и держи двадцать секунд'],
  bendR: ['Наклон вправо', 'Рука скользит по бедру, потом вернись', 'Медленно наклонись вправо, правая рука скользит по бедру вниз. Не поворачивайся и не наклоняйся вперед. Потом вернись'],
  bendL: ['Наклон влево', 'Рука скользит по бедру, потом вернись', 'Теперь так же наклонись влево и вернись'],
  calfR: ['На носок правой ноги', 'Вверх и вниз 15 секунд, держись за стену', 'Встань на правую ногу, левую подними, держись рукой за стену. Поднимайся на носок как можно выше и опускайся. Пятнадцать секунд'],
  calfL: ['На носок левой ноги', 'Вверх и вниз 15 секунд, держись за стену', 'Теперь на левой ноге. Поднимайся на носок как можно выше и опускайся. Пятнадцать секунд'],
  ohsAlt: ['Присед с опорой', 'Держись за стул или стену, 3 раза насколько можешь', 'Возьмись рукой за спинку стула или за стену. Присядь три раза, насколько можешь без боли. Начинай, я буду считать'],
  slsAlt: ['Правая нога с опорой', 'Держись за стену, чуть согни колено 3 раза', 'Держись за стену. Встань на правую ногу и чуть согни колено три раза. Начинай'],
  slsAltL: ['Левая нога с опорой', 'Держись за стену, чуть согни колено 3 раза', 'Теперь на левой ноге, держись за стену. Чуть согни колено три раза'],
  nudge: ['Начинай', 'Я жду первое движение', 'Начинай, я жду движение. Если не получается, нажми «Не могу»'],
  cant: ['Ответь на вопросы', 'Отметь на экране', 'Хорошо. Ответь на пару вопросов на экране'],
};
// Если тест не получается: вопросы вместо теста. side — спросить сторону.
/** Опросник «Не могу»: причины, сторона, что получается. Используется и до теста, и во время. */
export function cantSheet(u) {
  return new Promise(res => { const c = CANT[u] || CANT.side; const pick = { reasons: [], level: null, side: null };
    const o = document.createElement('div'); o.className = 'sheet'; o.style.zIndex = 30;
    o.innerHTML = `<div><h2>${c.q}</h2><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${c.opts.map((t, i) => `<button class="pill" data-r="${i}" style="min-height:44px">${t}</button>`).join('')}</div>
      ${c.side ? `<b style="display:block;margin-top:16px">Где</b><div class="seg" style="margin-top:8px"><button data-s="LEFT">Слева</button><button data-s="RIGHT">Справа</button><button data-s="BOTH" class="on">С обеих</button></div>` : ''}
      <b style="display:block;margin-top:16px">Как получается</b><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${c.lvl.map((t, i) => `<button class="btn line" data-l="${i}" style="height:48px">${t}</button>`).join('')}</div></div>`;
    document.body.appendChild(o); pick.side = c.side ? 'BOTH' : null; o.addEventListener('bp-close', () => res({ ...pick, cancelled: true }));
    o.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const t = c.opts[+b.dataset.r]; const on = !pick.reasons.includes(t); pick.reasons = on ? [...pick.reasons, t] : pick.reasons.filter(x => x !== t); b.classList.toggle('on', on); });
    o.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { pick.side = b.dataset.s; o.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
    o.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { pick.level = c.lvl[+b.dataset.l]; o.remove(); res(pick); }); });
}

/** Список шагов с кнопкой «Не могу» у каждого теста: человек может отказаться от теста заранее. */
export function stepList(units, pre) {
  const us = sortUnits(units); let n = 0;
  return `<div class="group" id="steplist">${us.map((u, ui) => { const l = pre[u]; const rows = UNITS[u];
    return `<div style="padding:10px 0;${ui < us.length - 1 ? 'border-bottom:1px solid var(--line-2)' : ''}">${rows.map((r, ri) => { n++; return `<div class="row" style="${ri ? 'margin-top:8px' : ''};opacity:${l && !l.alt ? .45 : 1}"><span class="step-n" style="width:22px;flex:none">${String(n).padStart(2, '0')}</span><div style="flex:1"><b style="font-size:15px">${r[0]}</b><div class="sub" style="font-size:13px">${r[1]}</div></div><span style="font-size:12px;color:var(--sub)">${r[2]} с</span></div>`; }).join('')}
      ${u === 'stand' ? '' : l ? `<div class="row" style="margin-top:8px;font-size:13px;color:var(--short-t)"><span style="flex:1">${l.alt ? 'Сделаю с опорой' : 'Пропущу'}: ${[...(l.reasons || []), l.level].filter(Boolean).join(', ').toLowerCase()}</span><button class="pill" data-undo="${u}">Отменить</button></div>`
        : `<button data-cant="${u}" class="link" style="min-height:44px;font-size:14px">Не могу это сделать</button>`}</div>`; }).join('')}</div>`;
}
export function bindStepList(pre, redraw) {
  document.querySelectorAll('[data-cant]').forEach(b => b.onclick = async () => { const u = b.dataset.cant; const a = await cantSheet(u); if (a.cancelled) return; if (/опор|неглуб/i.test(a.level || '') && (u === 'ohs_front' || u === 'sls')) a.alt = 'support'; pre[u] = a; redraw(); });
  document.querySelectorAll('[data-undo]').forEach(b => b.onclick = () => { delete pre[b.dataset.undo]; redraw(); });
}

// фразы голосового тренера: говорит постоянно, по тому, что видит камера
const V = {
  noFeet: 'Не вижу ноги. Отойди назад', noHead: 'Не вижу голову. Отойди назад', farther: 'Отойди чуть дальше', closer: 'Подойди чуть ближе',
  goLeft: 'Сделай шаг влево', goRight: 'Сделай шаг вправо', tilt: 'Телефон стоит криво. Выровняй его', dark: 'Мало света. Встань лицом к окну или включи свет',
  seen: 'Отлично, вижу тебя целиком', stay: 'Замри', good: 'Хорошо', wait: 'Я жду. Начинай движение', next: 'Отлично. Следующее упражнение',
  hold10: 'Ещё десять секунд', hold5: 'Ещё пять секунд', armsUp: 'Руки выше, до уровня плеч', armsDown: 'Опусти руки', keep: 'Держи, не опускай',
  lower: 'Ниже, рука скользит по бедру', back: 'Возвращайся', calfHigher: 'Поднимайся выше на носок', calfStop: 'Стоп. Опусти ногу',
  sideMore: 'Ещё немного. Правым плечом ко мне', turnMore: 'Повернись полностью', finish: 'Тест закончен. Можно подойти к телефону',
  go: 'Поехали', n1: '1', n2: '2', n3: '3',
};
export const LIMIT_NAMES = { fwd: 'Наклон вперед', slb: 'Баланс на одной ноге', trot: 'Повороты корпуса', reach: 'Руки вверх', chair: 'Вставание со стула', profile: 'Стойка боком', stand: 'Стойка', ohs_front: 'Присед', sls: 'На одной ноге', thold: 'Руки в стороны', bends: 'Наклоны', calf: 'На носок', side: 'Боком', back: 'Спиной' };
const CANT = {
  ohs_front: { q: 'Что мешает присесть?', side: false, opts: ['Боль в спине', 'Боль в колене', 'Боль в тазу или бедре', 'Не хватает сил', 'Теряю равновесие', 'Страшно'], lvl: ['Совсем не могу', 'Только с опорой', 'Немного, неглубоко'] },
  sls: { q: 'Что мешает стоять на одной ноге?', side: true, opts: ['Боль', 'Теряю равновесие', 'Не хватает сил'], lvl: ['Не могу постоять 10 секунд', 'Только с опорой', 'Могу, но не приседать'] },
  thold: { q: 'Что мешает держать руки?', side: true, opts: ['Боль в плече', 'Боль в шее', 'Устают руки'], lvl: ['Не поднимаю до плеч', 'Поднимаю, но не держу 20 секунд'] },
  bends: { q: 'Что мешает наклоняться?', side: true, opts: ['Боль в спине', 'Тянет бок', 'Кружится голова'], lvl: ['Совсем не могу', 'Только чуть-чуть'] },
  calf: { q: 'Что мешает подниматься на носок?', side: true, opts: ['Боль в стопе или голени', 'Не хватает сил', 'Теряю равновесие'], lvl: ['Не могу ни разу', 'Могу 1–5 раз'] },
  side: { q: 'Что мешает?', side: false, opts: ['Боль', 'Не хватает места'], lvl: ['Пропустить этот шаг'] },
  back: { q: 'Что мешает?', side: false, opts: ['Боль', 'Не хватает места'], lvl: ['Пропустить этот шаг'] },
  profile: { q: 'Что мешает?', side: false, opts: ['Боль', 'Кружится голова'], lvl: ['Пропустить этот шаг'] },
  stand: { q: 'Что мешает?', side: false, opts: ['Боль', 'Кружится голова'], lvl: ['Не могу стоять ровно'] },
  fwd: { q: 'Что мешает наклониться?', side: false, opts: ['Боль в спине', 'Тянет сзади бедра', 'Кружится голова'], lvl: ['Совсем не могу', 'Только немного'] },
  slb: { q: 'Что мешает стоять на одной ноге?', side: true, opts: ['Боль', 'Теряю равновесие'], lvl: ['Не могу поднять ногу', 'Держусь за опору'] },
  trot: { q: 'Что мешает поворачиваться?', side: true, opts: ['Боль в спине', 'Боль в шее'], lvl: ['Совсем не могу', 'Только немного'] },
  reach: { q: 'Что мешает поднять руки?', side: true, opts: ['Боль в плече', 'Боль в шее'], lvl: ['Не поднимаю до плеч', 'Поднимаю не до конца'] },
  chair: { q: 'Что мешает?', side: false, opts: ['Боль', 'Нет стула рядом'], lvl: ['Пропустить этот шаг'] },
};
// упаковка движения скелета: 33 точки × (x, y, видимость) в Int16, координаты в долях кадра ×10000
function packPoses(fr, w, h) {
  const n = fr.length, d = new Int16Array(n * 99), t = new Float32Array(n);
  fr.forEach((f, i) => { t[i] = f.t - fr[0].t; f.p.forEach((l, j) => { d[i * 99 + j * 3] = Math.round(l.x / w * 10000); d[i * 99 + j * 3 + 1] = Math.round(l.y / h * 10000); d[i * 99 + j * 3 + 2] = Math.round((l.visibility ?? 1) * 10000); }); });
  const b64 = a => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  // 3D-точки (мм, центр в тазу) — для объемной фигуры в просмотре записи
  let wd = null; if (fr.every(f => f.w)) { wd = new Int16Array(n * 99); fr.forEach((f, i) => f.w.forEach((l, j) => { wd[i * 99 + j * 3] = Math.round(l.x * 1000); wd[i * 99 + j * 3 + 1] = Math.round(l.y * 1000); wd[i * 99 + j * 3 + 2] = Math.round(l.z * 1000); })); }
  return { n, t: b64(t), d: b64(d), w: wd ? b64(wd) : null };
}

/**
 * Проводит протокол по шагам и возвращает результат. opts.target — постановка камеры прошлого теста (для ретеста),
 * opts.onCancel — выход по крестику. Экран и голос говорят одно и то же.
 */
// Голосовой сценарий теста. Каждый шаг: что делаем → как → «начинай» (сигнал) → счет или время → «стоп» (сигнал).
// Все фразы заранее записаны; фразы не обрывают друг друга, следующая звучит после конца предыдущей.
const SAY = {
  setup: 'Поставь телефон и отойди на два–четыре метра. Я скажу, когда увижу тебя целиком.',
  seen: 'Отлично, вижу тебя целиком',
  inFrame: 'Встань в кадр целиком', standIntro: 'Встань ровно. Руки вдоль тела, смотри прямо.', freeze: 'Замри.', good: 'Хорошо.', breathIn: 'Глубокий вдох носом.', breathOut: 'Медленный выдох.',
  wide: 'Стопы на ширине плеч', ohsIntro: 'Теперь присед. Подними прямые руки вверх. Пятки не отрывай.', ohsGo: 'Приседай. Пять раз, медленно.', go: 'Поехали', c3: 'Три', c2: 'Два', c1: 'Раз',
  ohsAltIntro: 'Возьмись рукой за спинку стула или за стену.', ohsAltGo: 'Приседай, насколько можешь без боли. Три раза.',
  repWait: 'Приседай. Я жду.', stop: 'Стоп. Хорошо.',
  slsRIntro: 'Встань на правую ногу. Согни вторую ногу назад, вперед ее не выставляй. Три неглубоких приседа', slsRGo: 'Приседай на правой ноге. Три раза, неглубоко.',
  slsLIntro: 'Теперь встань на левую ногу. Согни вторую ногу назад, вперед ее не выставляй. Три неглубоких приседа', slsLGo: 'Приседай на левой ноге. Три раза, неглубоко.',
  slsAltR: 'Встань на правую ногу, вторую согни назад. Можно держаться за стену.', slsAltL: 'Теперь встань на левую ногу, вторую согни назад.',
  footDown: 'Стоп. Опусти ногу.', cant: 'Начинай, я жду движение. Если не получается, нажми «Не могу»',
  tholdIntro: 'Подними руки в стороны до уровня плеч.', tholdGo: 'Держи двадцать секунд.', keep: 'Держи, не опускай', hold10: 'Ещё десять секунд', hold5: 'Ещё пять секунд',
  armsUp: 'Руки выше, до уровня плеч', armsDown: 'Опусти руки.',
  bendIntro: 'Наклоны в стороны. Руки вдоль тела.', bendR: 'Медленно наклонись вправо.', bendL: 'Теперь наклонись влево.', lower: 'Ниже, рука скользит по бедру', ret: 'Вернись.',
  calfRIntro: 'Встань на правую ногу и поднимайся на носок пятнадцать секунд', calfLIntro: 'Теперь на левой ноге. Поднимайся на носок пятнадцать секунд', calfGo: 'Поднимайся на носок и опускайся. Пятнадцать секунд.', calfHigher: 'Поднимайся выше на носок',
  sideTurn: 'Повернись правым боком к телефону.', backTurn: 'Повернись спиной к телефону.', frontTurn: 'Повернись ко мне лицом.',
  toPlace: 'Встаньте на место. Начнем по сигналу.', backIntro: 'Следующий присед спиной к телефону, три раза. Я буду считать вслух.',
  armsOverhead: 'Подними прямые руки вверх.', squatGo: 'Приседай. Три раза.', staySide: 'Остаемся боком к телефону. Стопы на ширине плеч.',
  // фразы батареи v2: в SAY, чтобы записи загрузились заранее и голос не замолкал на загрузке перед шагом
  fwdIntro: 'Стойте лицом к телефону. Наклонитесь вперед, к телефону. Колени прямые, руки тянутся к полу.', slbIntro: 'Руки на поясе. Встаньте на правую ногу, левую согните назад.', slbSwap: 'Смена ноги. Теперь на левой.',
  trotIntro: 'Стойте лицом к телефону, руки скрестите на груди. Поворачивайте плечи вправо и влево, как будто смотрите за спину. Таз и стопы на месте.', reachIntro: 'Поднимайте прямые руки над головой и опускайте. Три раза.',
  chairIntro: 'Сядьте на стул, руки скрестите на груди. По сигналу вставайте и садитесь, сколько сможете за тридцать секунд.', reachWait: 'Поднимите руки над головой. Я жду.',
  chairPain: 'Останавливаемся. Сделаем безопасный тест со стулом.',
  finish: 'Тест закончен. Можно подойти к телефону.',
  vertical: 'Поставь телефон вертикально, не наклоняй его',
  noFeet: 'Не вижу ноги. Отойди назад', noHead: 'Не вижу голову. Отойди назад', farther: 'Отойди чуть дальше', closer: 'Подойди чуть ближе',
  goLeft: 'Сделай шаг влево', goRight: 'Сделай шаг вправо', tilt: 'Телефон стоит криво. Выровняй его', dark: 'Мало света. Встань лицом к окну или включи свет',
};
// повторный тест: человек уже знает движения и хочет быстрее. Длинные объяснения заменяем короткими, «встаньте на место» убираем.
// null — фраза не звучит (текст шага все равно на экране)
const BRIEF = { setup: 'Поставьте телефон и отойдите, как в прошлый раз.', standIntro: null, wide: null, ohsIntro: 'Присед, руки вверх.',
  slsRIntro: 'Правая нога, три приседа.', slsLIntro: 'Левая нога, три приседа.', toPlace: null, backIntro: 'Присед спиной, три раза.',
  fwdIntro: 'Наклон вперед, к телефону.', trotIntro: 'Повороты корпуса, таз на месте.', chairIntro: 'Вставание со стула, тридцать секунд.',
  calfRIntro: 'Правая нога, на носок.', calfLIntro: 'Левая нога, на носок.', staySide: null };
export const BRIEF_PHRASES = Object.values(BRIEF).filter(Boolean);

const RETAKE_KEYS = { ohs_front: ['ohs_front'], sls: ['sls_r', 'sls_l'], side: ['ohs_side'], back: ['ohs_back'], fwd: ['fwd'], slb: ['slb'], trot: ['trot'], reach: ['reach'] };
const retakeOf = (u, moves) => (RETAKE_KEYS[u] || []).some(k => moves[k] && moves[k].quality === 'RETAKE');
/** Нормы по базе: только числа замеров, без имени, аккаунта и записи движения. Чем больше тестов, тем точнее пороги (Администрирование → Нормы). */
function sendNorms(r) { try { if (localStorage.getItem('bp_noev') === '1') return; const f = features(r), qv = Object.values(r.quality || {});
  delete f.lowq; const body = JSON.stringify({ f, q: qv.length ? Math.min(...qv) : null, r: localStorage.getItem('bp_mode') === 'pro' ? 'pro' : 'client', v: C.bodymap && C.bodymap.version });
  fetch('/api/norms', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {}); } catch (e) {} }
/** Стойка: раскачка (разброс наклона таза и плеч по кадрам, °) и разворот корпуса к камере (по 3D-точкам плеч и таза, °). */
function standCheck(fr) {
  const sd = a => { const v = a.filter(Number.isFinite); if (v.length < 5) return 0; const m = v.reduce((x, y) => x + y, 0) / v.length; return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length); };
  const sway = Math.max(sd(fr.map(x => F.pelvicTilt(x.p))), sd(fr.map(x => F.shoulderTilt(x.p))));
  const yawOf = w => { const a = (l, r) => Math.abs(Math.atan2(w[r].z - w[l].z, w[r].x - w[l].x) * 180 / Math.PI); const fold = v => Math.min(v, 180 - v); return (fold(a(11, 12)) + fold(a(23, 24))) / 2; };
  const ys = fr.filter(x => x.w).map(x => yawOf(x.w)).sort((x, y) => x - y);
  return { sway, yaw: ys.length >= 5 ? ys[ys.length >> 1] : NaN };
}
// бета: кнопка «Пропустить» на экране камеры сразу отдает правдоподобный результат (кроме калибровки: там нужно живое движение)
export async function runProtocol(protocol, opts = {}) {
  let done; const fake = new Promise(r => done = r);
  return Promise.race([runProtocol0(protocol, { ...opts, _skipAll: done }), fake]);
}
async function runProtocol0(protocol, opts = {}) {
  setSession(opts.specialist ? MODES.SPEC : MODES.SELF);
  // Safety Gate: острая боль до старта. 7 и выше — вместо батареи безопасный Chair Stand Test
  const acute = opts.noSafety ? 0 : opts.acute !== undefined ? opts.acute : await vasSheet('Есть ли острая боль прямо сейчас? (0–10)', 0, 'Боли нет', true);
  if (acute === undefined) return (opts.onCancel || prep)();
  if (acute >= 7) { toast('При сильной боли сделаем только безопасный тест: вставание со стула'); protocol = ['chair']; }

  // повторный тест этого человека: короче объяснения и отсчет
  const REPEAT = opts.repeat ?? (!opts.specialist && tests().length > 0);
  await voice.ensure(Object.values(SAY)); voice.warm([...Object.values(SAY), ...(REPEAT ? BRIEF_PHRASES : [])]);
  const pre = opts.pre || {}; const units = sortUnits(protocol); const BAT = units.includes('fwd'); const steps = rowsOf(units.filter(u => !pre[u] || pre[u].alt)); const startedAt = Date.now();
  go(`<div class="cam"><video playsinline muted autoplay></video><canvas id="sil"></canvas><canvas id="sk"></canvas><div class="count" id="cnt"></div>
   <div class="top"><div class="segs">${steps.map(() => '<div><b></b></div>').join('')}</div>${canFake() && !(INV() || {}).cal ? '<button class="pill glass" id="betaSkip" style="margin-right:8px;color:#fff">Пропустить</button>' : ''}<button class="round glass" id="x" aria-label="Закончить тест">${ic('x')}</button></div>
   <div class="reps" id="reps" hidden><b id="ring">0</b><span id="repn">из 5</span></div>
   <div class="joint-tag" id="jt" hidden><small id="jtn">колено Л</small><b id="jtv">—</b></div>
   <div class="glass">
    <div class="cam-status" id="stepl">ПОДГОТОВКА</div>
    <div class="cam-title" id="tt"></div>
    <div class="cam-sub">${ic('volume-2', 's')}<span id="cue"></span></div>
    <div class="row"><div class="cam-bar"><b id="pbf"></b></div><button type="button" class="cam-btn" id="skipb">Не могу</button></div>
    <button type="button" class="cam-btn pain" id="painb">⚡ БОЛЬНО / СТОП</button>
    <span id="pbt" class="sr-only" aria-live="polite"></span>
   </div></div>`);
  let stop = false, skip = false; const cancel = () => { track('test_cancel'); (opts.onCancel || prep)(); }; const limits = {};
  track('test_start', { n: units.length }, false); const tStart = Date.now();
  // крестик сразу обрывал тест: сначала спрашиваем, сколько уже пройдено (аудит, п. 9)
  $('#x').onclick = () => { if ($('#xconf')) return; const done = [...app.querySelectorAll('.segs b')].filter(b => parseFloat(b.style.width) >= 99).length;
    $('.cam').insertAdjacentHTML('beforeend', `<div class="cam-confirm" id="xconf" role="dialog" aria-modal="true" aria-labelledby="xct"><div><h2 id="xct">Прервать тест?</h2><p>Пройдено ${done} из ${steps.length}. Результат не сохранится.</p>
      <button class="btn white" id="xgo">Продолжить тест</button><button class="btn ghost on-dark" id="xstop">Прервать</button></div></div>`);
    $('#xgo').onclick = () => $('#xconf').remove(); $('#xstop').onclick = () => { stop = true; try { saveRec(); } catch (e) {} stopCamera(); cancel(); }; $('#xgo').focus(); }; $('#skipb').onclick = () => { skip = true; };
  let painStop = false; $('#painb').onclick = () => { painStop = true; skip = true; voice.say(''); track('step_skip', { c: 'pain' }, false); };
  if ($('#betaSkip')) $('#betaSkip').onclick = () => { stop = true; stopCamera(); voice.say(''); track('beta_skip_test', { c: 'camera' }); opts._skipAll({ ...fakeResult(units), poses: {}, vns: opts.vns || null, touch: passiveOn() ? touchSummary() : null }); };
  const video = app.querySelector('video'); const sk = $('#sk');
  try { if (!device.camera) throw new Error('no camera api'); await startCamera(video); } catch (e) { stop = true; return cameraHelp(); }
  // бета: тест пишется в видеофайл с камерой и скелетом, файл сохраняется в «Загрузки» по окончании или при выходе
  // видео теста не пишем и на телефоне не храним: в «Загрузках» копились файлы, которые никто не открывал
  const saveRec = async () => {};
  const corr = () => (cam.back ? -1 : 1) * phone.roll;
  // v2.0: светофор, фальстарт, FPS-Guard, коррекция перспективы при съемке с пола
  const pg = mountPacing(app.querySelector('.cam')), fs = falseStart(); let fsAt = 0, fsOff = false, gaitFr = [];
  const fg = fpsGuard(() => cam.fps, st => track('fps_mode', { c: st.mode }, false));
  const lev = f => pinhole(levelled(f.pose, f.w, f.h, corr()), f.h, phone.ok ? phone.pitch : 0);
  const lc = document.createElement('canvas'); lc.width = 32; lc.height = 32; const lx = lc.getContext('2d', { willReadFrequently: true }); let light = 128, lastL = 0;
  const bodyFrac = p => (Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) - p[P.NOSE].y);
  let setup0 = null; const fr0Pose = () => cam.frame && cam.frame.pose;
  let prof = false, level = true, setupDone = false, focus = null, stepLabel = '', lastStatus = '', lastIssue = '';
  const sil = $('#sil'); drawSilhouette(sil, opts.target && opts.target.bodyFrac > 0 ? opts.target : undefined);
  const jt = $('#jt'), cw = () => app.querySelector('.cam').clientWidth;
  cam.onFrame = f => { const ok = fullyVisible(f.pose, prof);
    if (performance.now() - lastL > 1000) { lastL = performance.now(); try { lx.drawImage(video, 0, 0, 32, 32); const d = lx.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; light = s / 1024; } catch (e) {} }
    level = !phone.ok || Math.abs(phone.roll) <= 5;
    const lv = f.pose ? levelled(f.pose, f.w, f.h, corr()) : null;
    if (setupDone && !fsOff && pg.phase === PHASE.INSTR && lv && fs.feed(lv) && Date.now() - fsAt > 4000 && !voice.busy()) { fsAt = Date.now(); voice.say(SHORT_CMD.wait); $('#cue').textContent = SHORT_CMD.wait; }
    if (!setupDone && f.pose) gaitFr.push({ t: f.t, p: f.pose });
    const fo = setupDone && focus && lv ? focus(lv) : null;
    const r = drawSkeleton(sk, f, { focus: fo ? fo.j : null, trail: setupDone, warn: !ok, prof });
    // одна подсказка за раз: первая проблема, иначе шаг или «в контуре»
    let warn = !ok ? 'Не видно всё тело' : !level ? `Наклон телефона ${fmt(phone.roll)}°` : light < 45 ? 'Мало света' : null, good = setupDone ? stepLabel : 'В контуре';
    if (!warn && opts.target && opts.target.bodyFrac > 0 && f.pose) { const dv = (bodyFrac(f.pose) / f.h - opts.target.bodyFrac) / opts.target.bodyFrac; if (Math.abs(dv) <= .1) { if (!setupDone) good = 'Как в прошлый раз'; } else warn = dv > 0 ? 'Отойди чуть дальше' : 'Подойди чуть ближе'; }
    const st = warn ? 'w' + warn : 'o' + good; if (st !== lastStatus) { lastStatus = st; const el = $('#stepl'); el.className = 'cam-status ' + (warn ? 'warn' : 'ok'); el.innerHTML = (warn ? '<i class="dia"></i>' : '') + esc((warn || good).toUpperCase()); }
    // угол у измеряемого сустава
    if (fo && fo.v && r.focusXY) { const [x, y] = r.focusXY, w = cw(); jt.hidden = false; jt.style.left = Math.max(8, Math.min(w - 150, x + 18)) + 'px'; jt.style.top = Math.max(80, y - 30) + 'px';
      if ($('#jtn').textContent !== fo.n) $('#jtn').textContent = fo.n; $('#jtv').textContent = fo.v; } else jt.hidden = true; };
  // какие суставы измеряет шаг: присед и одна нога — колено, стойка — плечи и таз, руки в стороны — плечо, наклоны — корпус
  const knee = r => p => { const v = F.fppa(p, r); return { j: [r ? P.R_KNEE : P.L_KNEE], n: 'колено ' + (r ? 'П' : 'Л'), v: Number.isFinite(v) ? fmt(Math.abs(v)) + '°' + (v > 1 ? ' внутрь' : '') : null }; };
  const FOC = { stand: p => ({ j: [P.L_SHOULDER, P.R_SHOULDER], n: 'плечи · таз', v: `${fmt(Math.abs(F.shoulderTilt(p)))}° · ${fmt(Math.abs(F.pelvicTilt(p)))}°` }),
    squat: p => { const l = Math.abs(F.fppa(p, false)) || 0, r = Math.abs(F.fppa(p, true)) || 0; return knee(r > l)(p); }, kneeR: knee(true), kneeL: knee(false),
    arms: p => ({ j: [P.R_SHOULDER], n: 'плечо П', v: fmt(G.angleAt(p[P.R_HIP], p[P.R_SHOULDER], p[P.R_ELBOW])) + '°' }),
    bend: p => ({ j: [P.L_SHOULDER, P.R_SHOULDER], n: 'корпус', v: fmt(Math.abs(F.trunkLateral(p))) + '°' }) };
  // ---- экран и голос ----
  const segs = [...app.querySelectorAll('.segs b')]; let si = -1;
  const step = (i, title, sub, fc) => { pg.instr(); fs.reset(); if (i !== null) { si = i; segs.forEach((b, k) => b.style.width = k < i ? '100%' : k === i ? '8%' : '0'); stepLabel = `Шаг ${i + 1} из ${steps.length}`; lastStatus = ''; } if (fc !== undefined) focus = fc; $('#tt').textContent = title; $('#cue').textContent = sub || ''; bar(0, ''); $('#reps').hidden = true; };
  // ушли с экрана теста жестом «назад»: элементов нет, останавливаем запись, а не падаем на каждом кадре
  const gone = el => { if (el) return false; if (!stop) { stop = true; try { stopCamera(); } catch (e) {} } return true; };
  const bar = (frac, label) => { if (gone($('#pbf'))) return; $('#pbf').style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; if (label !== undefined) $('#pbt').textContent = label; if (segs[si]) segs[si].style.width = Math.max(8, frac * 100) + '%'; };
  const short = new Map(REPEAT ? Object.entries(BRIEF).map(([k, v]) => [SAY[k], v]) : []);
  const say = async text => { if (stop) return; if (short.has(text)) { text = short.get(text); if (!text) return; } $('#cue').textContent = text; await voice.speak(text); };
  let lastHint = '', lastHintAt = 0, hints = 0; const fpsS = [];
  // подсказки не давят: не перебивают говорящий голос, любая не чаще раза в 6 с, та же фраза не чаще раза в 12 с
  const hint = (text, gap = 6000, force = false) => { const now = Date.now(); if (!force && (voice.busy() || now - lastHintAt < gap || (text === lastHint && now - lastHintAt < 12000))) return; if (gone($('#cue'))) return; lastHint = text; lastHintAt = now; hints++; lastIssue = text; $('#cue').textContent = text; voice.say(text); };
  // ---- запись ----
  const grab = (fr, rolls) => { const f = cam.frame; if (f && f.pose && (!fr.length || fr.at(-1).t !== f.t)) { if (fg.state.skip && fr.length % (fg.state.skip + 1)) { fr.push(fr.at(-1)); return; } fr.push({ t: f.t, p: lev(f), w: f.world }); rolls.push(phone.roll); } };
  const poses = {}, quality = {}; let W = 1, H = 1;
  const keep = (key, fr, rolls, vis) => { const f = cam.frame; if (f) { W = f.w; H = f.h; } if (cam.fps) fpsS.push(cam.fps); if (!fr.length) return; poses[key] = packPoses(fr, W, H);
    const m = rolls.reduce((a, b) => a + b, 0) / rolls.length, sd = Math.sqrt(rolls.reduce((a, b) => a + (b - m) ** 2, 0) / rolls.length) || 0;
    quality[key] = Math.round(100 * Math.min(1, (vis ?? .9) / .9) * Math.min(1, (cam.fps || 20) / 20) * (light < 45 ? .7 : 1) * (sd > 2 ? .8 : 1)); };
  // удержание позы заданное время: полоса показывает, сколько осталось; extra(p, left) — подсказки по ходу
  // человек вышел из кадра: шаг замирает, голос зовет обратно, и замер начинается заново, когда его снова видно целиком
  let seenAt = Date.now();
  // «в кадре» = видны плечо и таз: поднятая нога или наклон головы не считаются уходом из кадра
  const present = q => !!q && (q[P.L_SHOULDER].visibility > .5 || q[P.R_SHOULDER].visibility > .5) && (q[P.L_HIP].visibility > .5 || q[P.R_HIP].visibility > .5);
  const away = () => { const f = cam.frame; if (f && present(f.pose)) seenAt = Date.now(); return Date.now() - seenAt > 1500; };
  const backInFrame = async () => { const t = Date.now(); bar(0, 'Вернитесь в кадр целиком'); hint(SAY.inFrame, 0, true);
    let okSince = 0; while (!stop && !skip) { const f = cam.frame, ok = f && fullyVisible(f.pose, prof); if (ok) { okSince = okSince || Date.now(); if (Date.now() - okSince > 800) break; } else okSince = 0;
      if (Date.now() - t > 9000 && !okSince) { hint(SAY.inFrame, 10000); } await sleep(60); } seenAt = Date.now(); return Date.now() - t; };
  const hold = async (key, sec, label, extra) => { if (pg.phase !== PHASE.REC) { voice.beep('start'); pg.rec(); } const fr = [], rolls = []; let t0 = Date.now(); const said = {}; seenAt = Date.now();
    while (!stop && !skip) { if (away()) { await backInFrame(); fr.length = 0; rolls.length = 0; t0 = Date.now(); voice.beep('start'); continue; } const el = (Date.now() - t0) / 1000, left = Math.ceil(sec - el); if (el >= sec) break; grab(fr, rolls); bar(el / sec, `${label}: ${left} с`); $('#reps').hidden = false; $('#ring').textContent = left; $('#repn').textContent = 'сек';
      if (sec >= 12 && left === 10 && !said[10]) { said[10] = 1; hint(SAY.hold10, 0); } if (sec >= 9 && left === 5 && !said[5]) { said[5] = 1; hint(SAY.hold5, 0); }
      if (extra && fr.length) extra(fr, left); await sleep(30); }
    bar(1, ''); voice.beep('stop'); if (key) keep(key, fr, rolls); return fr; };
  // руки вверх: считаем подъемы (обе кисти выше носа, потом ниже плеч), а не секунды; счет голосом, не дольше 40 секунд
  const armReps = async (key, N = 3) => { voice.beep('start'); pg.rec(); const fr = [], rolls = []; let n = 0, up = false, t0 = Date.now(); seenAt = Date.now();
    bar(0, `Подъемы: 0 из ${N}`); $('#reps').hidden = false; $('#ring').textContent = 0; $('#repn').textContent = `из ${N}`;
    let idle = Date.now(); while (!stop && !skip && n < N && Date.now() - t0 < 40000) { if (away()) { t0 += await backInFrame(); idle = Date.now(); continue; } grab(fr, rolls); const q = fr.length && fr.at(-1).p; if (Date.now() - idle > 7000) { idle = Date.now(); hint(SAY.reachWait, 0); }
      if (q) { const hi = q[P.L_WRIST].y < q[P.NOSE].y && q[P.R_WRIST].y < q[P.NOSE].y, lo = q[P.L_WRIST].y > q[P.L_SHOULDER].y && q[P.R_WRIST].y > q[P.R_SHOULDER].y;
        if (hi && !up) { up = true; idle = Date.now(); } else if (lo && up) { up = false; n++; idle = Date.now(); $('#ring').textContent = n; bar(n / N, `Подъемы: ${n} из ${N}`); voice.say(numWord(n)); } }
      await sleep(30); }
    bar(1, ''); voice.beep('stop'); keep(key, fr, rolls); return fr; };
  // повторы: считаем по движению таза; полоса = сделанные повторы из трех
  const reps = async (key, an, deep = .12, N = 3, quiet = false, maxMs = 60000) => { if (!quiet) voice.beep('start'); pg.rec(); const fr = [], rolls = []; if (skip) return { f: {}, reps: 0, quality: 'RETAKE' };
    let n = 0, down = false, base = null, leg = null, maxFlex = 0, downAt = 0, countAt = 0, peak = 0, counted = false; const hys = []; let t0 = Date.now(); let lastMove = Date.now(); bar(0, `Повторы: 0 из ${N}`); $('#reps').hidden = false; $('#ring').textContent = 0; $('#repn').textContent = `из ${N}`;
    seenAt = Date.now(); while (!stop && !skip && n < N && Date.now() - t0 < maxMs) { if (away()) { t0 += await backInFrame(); lastMove = Date.now(); continue; } grab(fr, rolls); const p = fr.length && fr.at(-1).p;
      // высота таза по медиане последних кадров: дрожание точек не считается повтором
      if (p) { hys.push((p[P.L_HIP].y + p[P.R_HIP].y) / 2); if (hys.length > 5) hys.shift(); const hy = hys.slice().sort((x, y) => x - y)[hys.length >> 1]; if (leg == null) leg = Math.max(1, Math.abs(((p[P.L_ANKLE].y + p[P.R_ANKLE].y) / 2) - hy));
        base = base == null ? hy : Math.min(base, hy * .02 + base * .98, base); const dy = (hy - base) / leg;
        const fl = Math.max(F.kneeFlexion(p, true), F.kneeFlexion(p, false)); if (fl > maxFlex) maxFlex = fl;
        if (!down && dy > deep) { down = true; downAt = Date.now(); lastMove = Date.now(); peak = dy; counted = false; }
        // счет голосом строго в нижней точке: движение развернулось вверх после не меньше чем 250 мс внизу
        if (down) { if (dy > peak) peak = dy; if (!counted && dy < peak - deep * .25 && Date.now() - downAt >= 250 && Date.now() - countAt >= 500) { counted = true; n++; countAt = Date.now(); lastMove = Date.now(); $('#ring').textContent = n; bar(n / N, `Повторы: ${n} из ${N}`); voice.say(numWord(n)); } }
        // повтор засчитывается, если внизу были не меньше четверти секунды и с прошлого прошло больше полсекунды;
        // вместо слова короткий сигнал: слова запаздывали и обрывали друг друга
        if (down && dy < deep * .35) { down = false; if (!counted && Date.now() - downAt >= 250 && Date.now() - countAt >= 500) { n++; countAt = Date.now(); lastMove = Date.now(); $('#ring').textContent = n; bar(n / N, `Повторы: ${n} из ${N}`); voice.say(numWord(n)); } } }
      if (!down && Date.now() - lastMove > 6000) { lastMove = Date.now(); hint(SAY.repWait, 0); }
      await sleep(30); }
    const r = fr.length > 10 ? an(fr) : { f: {}, reps: 0, quality: 'RETAKE' }; if (r.f) r.f.max_knee_flex = maxFlex; keep(key, fr, rolls, r.visibility);
    if (n === 0 && !skip && !stop) r.quality = 'RETAKE'; await sleep(300); voice.beep('stop'); return r; };
  // счет идет с первого слова команды: люди начинают приседать на «Приседай», и раньше, пока голос договаривал, первые повторы терялись, а лишние засчитывались после
  // четкий старт: крупный отсчет 3-2-1 голосом и на экране, затем сигнал. Движение начинается только после сигнала
  // Pacing Guard: без счета «3-2-1». Инструкция (желтая рамка) → сигнал «Пип» и зеленый экран с глаголом → запись
  // перед сигналом время вернуться на место: люди подходят к телефону рассмотреть схему. Схема остается на экране,
  // крупный обратный отсчет виден издалека; на первых двух упражнениях дольше
  let nCount = 0;
  const countdown = async (word = GO_WORD.hold, short = false) => { if (stop || skip) return; const first = nCount++ === 0, T = short ? 1.5 : REPEAT ? 2 : first ? 4 : 3; if (first) say(SAY.toPlace);
    const t0 = Date.now(); $('#reps').hidden = false; $('#repn').textContent = 'сек'; while (!stop && !skip && Date.now() - t0 < T * 1000) { const left = Math.ceil(T - (Date.now() - t0) / 1000); $('#ring').textContent = left; bar((Date.now() - t0) / (T * 1000), `На место: ${left} с`); await sleep(100); }
    $('#reps').hidden = true; if (stop || skip) return; demo(null); await pg.signal(word, () => voice.beep('start')); };
  const goReps = async (phrase, key, an, deep, N) => { await countdown(GO_WORD.squat); if (stop || skip) return { f: {}, reps: 0, quality: 'RETAKE' }; $('#cue').textContent = phrase; voice.say(SAY.go); return reps(key, an, deep, N, true); };
  // схема движения крупно на экране, пока звучит объяснение: видно, как встать и насколько садиться
  const demo = (id, fc) => { const old = app.querySelector('.cam .demo'); if (old) old.remove(); if (!id) return; const d = document.createElement('div'); d.className = 'demo';
    d.style.cssText = 'position:absolute;left:50%;top:14%;transform:translateX(-50%);width:min(92vw,440px);background:rgba(255,255,255,.95);border-radius:24px;padding:12px;z-index:5;pointer-events:none;box-shadow:0 12px 40px rgba(0,0,0,.35)';
    d.innerHTML = testDemo(id, fc || facing); app.querySelector('.cam').appendChild(d); };
  // поворот: команда, затем 4 секунды с полосой, чтобы успеть повернуться
  let facing = 'front';
  const face = async want => { if (facing === want) return; prof = want !== 'front'; step(null, want === 'side' ? 'Повернись правым боком' : want === 'back' ? 'Повернись спиной' : 'Повернись лицом', '');
    await say(want === 'side' ? SAY.sideTurn : want === 'back' ? SAY.backTurn : SAY.frontTurn);
    const t0 = Date.now(); while (!stop && Date.now() - t0 < 2500) { bar((Date.now() - t0) / 2500, 'Поворачивайся'); await sleep(50); } facing = want; };
  // ---- 0. в кадр ----
  step(null, 'Поставьте телефон и отойдите', 'Не торопитесь: тест начнется сам, когда вы будете целиком в кадре'); pg.pos(false); await say(SAY.setup);
  const issue = () => { const f = cam.frame, p = f && f.pose; if (!level) return SAY.tilt; if (phone.ok && Math.abs(phone.pitch) > 18) return SAY.vertical; if (light < 45) return SAY.dark; if (!p) return SAY.farther;
    if (p[P.L_ANKLE].visibility < .5 || p[P.R_ANKLE].visibility < .5 || Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) > f.h * .97) return SAY.noFeet;
    if (p[P.NOSE].visibility < .5 || p[P.NOSE].y < f.h * .03) return SAY.noHead;
    const cx = (p[P.L_HIP].x + p[P.R_HIP].x) / 2 / f.w; if (cx < .28) return SAY.goLeft; if (cx > .72) return SAY.goRight;
    const hf = (Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) - p[P.NOSE].y) / f.h; if (hf < .45) return SAY.closer; if (hf > .9) return SAY.farther; return null; };
  const shortOf = t => { for (const k of Object.keys(SHORT_CMD)) if (SAY[k] === t) return SHORT_CMD[k]; return t; };
  { let okSince = 0, okSaid = 0, badSince = 0; const t0 = Date.now();
    while (!stop) { const bad = issue();
      // время на установку: не раньше 5 с от включения камеры и 1,5 с ровно в кадре, иначе тест стартовал, пока человек еще отходил
      const fr0 = cam.frame, ms = fr0 && fr0.pose ? matchScore(fr0.pose, fr0.w, fr0.h) : 0, good = !bad && fullyVisible(fr0 && fr0.pose) && ms >= ZERO_CLICK; pg.pos(good);
      // короткий сбой распознавания (до 0,4 с) не сбрасывает отсчет и не повторяет «Замрите»: раньше голос заикался на каждом мигании
      if (good) badSince = 0; else if (okSince && !badSince) badSince = Date.now();
      if (good || (okSince && Date.now() - badSince < 400)) { if (!okSince) { okSince = Date.now(); if (Date.now() - okSaid > 6000 && !voice.busy()) { okSaid = Date.now(); voice.say(SHORT_CMD.ok); } }
        bar((Date.now() - okSince) / 1500, 'Замрите'); if (good && Date.now() - okSince > 1500 && Date.now() - t0 > 5000) break; }
      else { okSince = 0; badSince = 0; bar(0, bad || ''); if (Date.now() - t0 > 6000) hint(shortOf(bad || SAY.farther), 8000); }
      if (Date.now() - t0 > 120000) { stop = true; stopCamera(); return cancel(); } await sleep(150); }
    if (stop) return; track('setup', { d: (Date.now() - t0) / 1000, n: hints }, false); setupDone = true;
    // сеанс: постановка камеры по кадру установки, даже если в наборе нет стойки (по ней ставят телефон на повторе)
    if (opts.session && fr0Pose()) { const f = cam.frame; setup0 = { bodyFrac: bodyFrac(f.pose) / f.h, roll: phone.roll, pitch: phone.pitch ?? null, back: cam.back, w: f.w, h: f.h }; } pg.instr(); var gait = retroGait(gaitFr); gaitFr = null; sil.style.transition = 'opacity .32s'; sil.style.opacity = 0; await say(SAY.seen); }
  // ---- тесты ----
  const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v[v.length >> 1] ?? 0; };
  let snapshot = null, side = null, setup = null; const moves = {}; let k = 0;
  const skipped = () => skip && !stop;
  const okFlash = async (name, n) => { const d = document.createElement('div'); d.className = 'result-ok';
    d.innerHTML = `<span style="width:48px;height:48px;border-radius:50%;background:var(--signal);color:var(--cam-bg);display:flex;align-items:center;justify-content:center;flex:none">${ic('check')}</span><div><b style="font-size:20px;display:block">Записано</b><span class="cam-status">Шаг ${n} · ${esc(name)}</span></div>`;
    app.querySelector('.cam').appendChild(d); await sleep(500); d.remove(); };
  const retakeScreen = (why, lightOk, levelOk, feetOk) => new Promise(res => { const d = document.createElement('div'); d.className = 'result';
    const li = (ok, t) => `<div class="row" style="font-size:17px;color:${ok ? 'var(--cam-sub)' : 'var(--cam-text)'}">${ok ? ic('check', 's') : '<i class="dia" style="color:var(--cam-warn)"></i>'}<span>${t}</span></div>`;
    d.innerHTML = `<span style="width:72px;height:72px;border-radius:50%;border:4px solid var(--cam-warn);color:var(--cam-warn);display:flex;align-items:center;justify-content:center">${ic('rotate-ccw')}</span>
      <div class="cam-title">Ещё раз</div><div style="font-size:20px;line-height:1.3;color:var(--cam-sub)">${esc(why || 'Не увидел движения')}</div>
      <div class="stack">${li(lightOk, 'Света достаточно')}${li(levelOk, 'Телефон стоит ровно')}${li(feetOk, 'Стопы и голова в кадре')}</div>
      <div class="stack" style="margin-top:8px"><button class="btn signal" id="rta" style="height:64px">Повторить шаг</button><button class="btn ghost" id="rts" style="color:var(--cam-sub)">Не могу, пропустить</button></div>`;
    app.querySelector('.cam').appendChild(d); d.querySelector('#rta').onclick = () => { d.remove(); res(true); }; d.querySelector('#rts').onclick = () => { d.remove(); res(false); }; });
  const runUnit = async u => {
    if (u === 'stand') { await face('front'); step(k, 'Стой ровно', 'Руки вдоль тела, смотри прямо', FOC.stand); await say(SAY.standIntro); await say(SAY.freeze);
      let st = await hold('stand', 5, 'Замри'); if (stop || skipped()) return;
      // стойка: качается ли человек и не развернут ли корпус к камере. Если да — подсказка и один повтор, берем более ровную попытку
      let sq = standCheck(st);
      if (sq.sway > 1.5 || sq.yaw > 15) { await say(sq.yaw > 15 ? SAY.frontTurn : SAY.freeze); if (sq.yaw > 15) await say(SAY.freeze);
        const st2 = await hold('stand', 5, 'Замри'); if (stop || skipped()) return; const sq2 = standCheck(st2); if (sq2.sway + sq2.yaw / 8 < sq.sway + sq.yaw / 8) { st = st2; sq = sq2; } }
      // разворот или раскачка остались: наклоны в стойке помечаем как неточные (слабые находки по ним не показываются)
      if (sq.yaw > 15 || sq.sway > 2.5) quality.stand = Math.min(quality.stand ?? 100, 55);
      snapshot = standSnapshot(st); snapshot.sway = Math.round(sq.sway * 10) / 10; if (Number.isFinite(sq.yaw)) snapshot.yaw = Math.round(sq.yaw);
      const f = cam.frame; setup = { bodyFrac: med(st.map(x => bodyFrac(x.p))) / (f ? f.h : 1), roll: phone.roll, pitch: phone.pitch ?? null, back: cam.back, w: f && f.w, h: f && f.h, scale: autoScale(st, (PROFILE() || {}).height), retroGait: gait || null };
      // ВБД в статике: расхождение плоскостей грудной клетки и таза, подъем плеч на вдохе (мм по шкале)
      // дыхание (Левит): плечи на глубоком вдохе не должны подниматься, работает диафрагма; один вдох и выдох по 5 секунд
      step(k, 'Глубокий вдох', 'Носом в живот, плечи на месте', FOC.stand); demo('test_breath'); await say(SAY.breathIn); const bIn = await hold('breath_in', 5, 'Вдох'); if (stop || skipped()) return;
      await say(SAY.breathOut); const bOut = await hold('breath_out', 5, 'Выдох'); if (stop || skipped()) return; demo(null);
      const ap = setup.scale ? apicalBreath(bIn, bOut, setup.scale.cmPerPx) : null;
      moves.iap = { quality: 'GOOD', f: { rib_flare: Math.round(med(st.map(x => ribFlare(x.p))) * 10) / 10, ...(Number.isFinite(ap) ? { apical_mm: Math.round(ap) } : {}) } };
      await say(SAY.good); k++; }
    if (u === 'ohs_front') { await face('front'); step(k, 'Присед с руками вверх', 'Стопы чуть шире плеч, руки вверх, пятки на полу. Садитесь как можно глубже без боли, 5 раз', FOC.squat); demo('test_squat'); await say(SAY.wide); await say(SAY.ohsIntro); if (skipped()) return; 
      moves.ohs_front = await goReps(SAY.ohsGo, 'ohs_front', fr => Movement.front(fr), .12, 5); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'sls') { await face('front');
      step(k, 'Стоя на правой ноге', 'Левую ногу согните в колене и отведите стопу назад. Руки на поясе. Присядьте на правой 3 раза: колено вперед на 10–15 см, как будто садитесь на высокий стул', FOC.kneeR); demo('test_sls'); await say(SAY.slsRIntro); if (skipped()) return; 
      moves.sls_r = await goReps(SAY.slsRGo, 'sls_r', fr => Movement.singleLeg(fr, true), .06); if (skipped()) return; await say(SAY.footDown); k++;
      step(k, 'Стоя на левой ноге', 'Правую ногу согните в колене и отведите стопу назад. Руки на поясе. Присядьте на левой 3 раза: колено вперед на 10–15 см', FOC.kneeL); demo('test_sls_left'); await say(SAY.slsLIntro); if (skipped()) return; 
      moves.sls_l = await goReps(SAY.slsLGo, 'sls_l', fr => Movement.singleLeg(fr, false), .06); if (skipped()) return; await say(SAY.footDown); k++; }
    if (u === 'thold') { await face('front'); step(k, 'Руки в стороны', 'На уровне плеч, держи 20 секунд', FOC.arms); await say(SAY.tholdIntro); if (skipped()) return; await countdown(); await say(SAY.tholdGo);
      const fr = await hold('t_hold', 20, 'Держи', (fr, left) => { const p = fr.at(-1).p; if (left === 15) hint(SAY.keep, 0);
        if (left < 18 && left > 6) { const ab = Math.min(G.angleAt(p[P.R_HIP], p[P.R_SHOULDER], p[P.R_ELBOW]), G.angleAt(p[P.L_HIP], p[P.L_SHOULDER], p[P.L_ELBOW])); if (ab < 70) hint(SAY.armsUp, 5000); } });
      if (skipped()) return; moves.t_hold = fr.length > 20 ? Movement.tHold(fr) : { f: {}, reps: 0, quality: 'RETAKE' }; await say(SAY.armsDown); k++; }
    if (u === 'bends') { await face('front'); step(k, 'Наклоны в стороны', 'Медленно вправо, потом влево', FOC.bend); await say(SAY.bendIntro); if (skipped()) return;
      const bend = async (cmd, sign) => { await say(cmd); voice.beep('start'); const fr = [], rolls = []; const t0 = Date.now(); let max = 0, low = false;
        while (!stop && !skip && Date.now() - t0 < 6000) { grab(fr, rolls); bar((Date.now() - t0) / 6000, 'Наклон'); const p = fr.length && fr.at(-1).p;
          if (p) { const tl = F.trunkLateral(p) * sign; if (tl > max) max = tl; if (!low && Date.now() - t0 > 2500 && max < 12) { low = true; hint(SAY.lower, 0); } } await sleep(30); }
        voice.beep('stop'); await say(SAY.ret); await sleep(300); return fr; };
      const b1 = await bend(SAY.bendR, 1); if (skipped()) return; const b2 = await bend(SAY.bendL, -1); if (skipped()) return;
      moves.side_bend = Movement.sideBend([...b1, ...b2]); keep('bends', [...b1, ...b2], b1.map(() => phone.roll)); await say(SAY.good); k++; }
    if (u === 'calf') { await face('front');
      for (const [right, intro, key] of [[true, SAY.calfRIntro, 'calf_r'], [false, SAY.calfLIntro, 'calf_l']]) {
        step(k, right ? 'На носок правой ноги' : 'На носок левой ноги', 'Вторую ногу согните назад. Поднимайтесь на носок как можно выше и опускайтесь, 15 секунд', null); await say(intro); if (skipped()) return; await countdown();
        const fr = await hold(key, 15, 'Вверх-вниз', (fr, left) => { if (left < 11 && left > 5 && fr.length > 60) { const hy = x => (x.p[P.L_HEEL].y + x.p[P.R_HEEL].y) / 2, rec = fr.slice(-90).map(hy); if (Math.max(...rec) - Math.min(...rec) < 8) hint(SAY.calfHigher, 6000); } });
        if (skipped()) return; moves[key] = fr.length > 20 ? Movement.calfRaise(fr, right) : { f: {}, reps: 0, quality: 'RETAKE' }; await say(SAY.footDown); k++; } }
    if (u === 'side') { await face('side'); step(k, 'Боком: стой ровно', 'Правое плечо к телефону', null); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (skipped()) return; side = sideSnapshot(sf);
      step(k, 'Боком: присед', 'Остаемся боком, правое плечо к телефону. Руки вверх, 3 раза'); demo('test_squat'); await say(SAY.staySide); await say(SAY.armsOverhead); 
      const osFr = []; moves.ohs_side = await goReps(SAY.squatGo, 'ohs_side', fr => { osFr.push(...fr); return Movement.side(fr); }, .12, 3);
      { const w = buttWink(osFr); if (Number.isFinite(w)) moves.iap = { quality: 'GOOD', f: { ...((moves.iap || {}).f || {}), butt_wink: Math.round(w * 10) / 10 } }; } if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'profile') { await face('side'); step(k, 'Боком: стой ровно', 'Руки вдоль тела, смотри прямо', null); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (stop || skipped()) return; side = sideSnapshot(sf);
      await say(SAY.good); k++; }
    if (u === 'fwd') { await face('front'); step(k, 'Наклон вперед', 'Лицом к телефону. Ноги прямые, тянитесь руками к полу и вернитесь', FOC.bend); demo('test_fwd'); await say(SAY.fwdIntro); if (skipped()) return;
      await countdown(GO_WORD.bend); const fr = await hold('fwd', 10, 'Наклон'); if (skipped()) return; moves.fwd = forwardBend(fr); await say(SAY.ret); k++; }
    if (u === 'slb') { await face('front'); step(k, 'Баланс на одной ноге', 'Руки на поясе. Сначала на правой, потом на левой, по 6 секунд', FOC.stand); demo('test_slb'); await say(SAY.slbIntro); if (skipped()) return;
      await countdown(GO_WORD.balance); const fR = await hold('slb_r', 6, 'Правая нога'); if (skipped()) return; await say(SAY.slbSwap); await countdown(GO_WORD.balance, true); const fL = await hold('slb_l', 6, 'Левая нога'); if (skipped()) return;
      moves.slb = singleBalance(fR, fL); await say(SAY.footDown); k++; }
    if (u === 'trot') { await face('front'); step(k, 'Повороты корпуса', 'Лицом к телефону. Плечи вправо и влево, таз и стопы на месте', FOC.stand); demo('test_trot'); await say(SAY.trotIntro); if (skipped()) return;
      await countdown(GO_WORD.rotate); const fr = await hold('trot', 10, 'Повороты'); if (skipped()) return; moves.trot = trotSweep(fr); await say(SAY.good); k++; }
    if (u === 'reach') { await face('front'); step(k, 'Руки вверх', 'Прямые руки вперед и вверх над головой, не через стороны. 3 раза', FOC.arms); demo('test_reach'); await say(SAY.reachIntro); if (skipped()) return;
      await countdown(GO_WORD.reach); const fr = await armReps('reach', 3); if (skipped()) return; moves.reach = overheadReach(fr); await say(SAY.armsDown); k++; }
    if (u === 'chair') { await face('front'); fsOff = true; step(k, 'Вставание со стула', 'Сядьте на стул боком к камере, руки на груди. Вставайте и садитесь 30 секунд'); demo('test_chair', 'side'); await say(SAY.chairIntro); if (skipped()) return;
      await countdown(GO_WORD.chair); moves.chair = await reps('chair', fr => chairStand(fr), .1, 99, true, 30000); moves.chair.quality = moves.chair.reps ? 'GOOD' : 'RETAKE'; await say(SAY.good); k++; fsOff = false; }
    // спиной экран не видно: сначала показываем и объясняем лицом к телефону, потом поворот; дальше ведет голос и счет
    if (u === 'back') { await face('front'); step(k, 'Спиной: присед', 'Стопы чуть шире плеч, руки вверх, 3 раза. Голос считает', FOC.squat); demo('test_squat', 'back'); await say(SAY.backIntro); await say(SAY.armsOverhead); await face('back'); if (skipped()) return; 
      moves.ohs_back = await goReps(SAY.squatGo, 'ohs_back', fr => Movement.back(fr), .12, 3); if (skipped()) return; await say(SAY.stop); k++; }
  };
  // облегченный вариант после «Не могу»
  const runAlt = async u => { if (u === 'ohs_front') { step(k, 'Присед с опорой', 'Держись за стул или стену', FOC.squat); await say(SAY.ohsAltIntro); await say(SAY.ohsAltGo);
      const r = await reps('ohs_front', fr => Movement.front(fr), .05); r.alt = 'support'; moves.ohs_front = r; await say(SAY.stop); k++; }
    if (u === 'sls') { step(k, 'Правая нога с опорой', 'Держитесь рукой за стену или стул'); await say(SAY.slsAltR); await say(SAY.slsRGo); const r = await reps('sls_r', fr => Movement.singleLeg(fr, true), .03); r.alt = 'support'; moves.sls_r = r; await say(SAY.footDown); k++;
      step(k, 'Левая нога с опорой', 'Держитесь рукой за стену или стул'); await say(SAY.slsAltL); await say(SAY.slsLGo); const r2 = await reps('sls_l', fr => Movement.singleLeg(fr, false), .03); r2.alt = 'support'; moves.sls_l = r2; await say(SAY.footDown); k++; } };
  for (const u of units) {
    if (stop) return; skip = false; const k0 = k;
    if (pre[u]) { limits[u] = pre[u]; if (pre[u].alt) await runAlt(u); continue; }
    await runUnit(u);
    // «Получилось» или «Еще раз»: повтор шага один раз, второй неудачный повтор не спрашиваем
    if (!skip && !stop) { const bad = retakeOf(u, moves);
      if (bad) { track('retake', { c: u, r: lastIssue || 'нет движения' }, false); const again = await retakeScreen(lastIssue, light >= 45, level, fullyVisible(cam.frame && cam.frame.pose, prof)); if (stop) return;
        if (again) { k = k0; lastIssue = ''; await runUnit(u); } else skip = true; }
      else if (k > k0) await okFlash(steps[k - 1] ? steps[k - 1][0] : '', k); }
    flushGL(app);
    if (painStop && !stop) { limits[u] = { level: 'Боль', reasons: ['Нажата кнопка «Больно»'] }; for (const r of units.slice(units.indexOf(u) + 1)) limits[r] = { level: 'Не выполнялось', reasons: ['Тест остановлен из-за боли'] };
      skip = false; painStop = false; if (u !== 'chair') { await say(SAY.chairPain); await runUnit('chair'); } break; }
    if (skip && !stop) { track('step_skip', { c: u }, false); voice.beep('stop'); step(null, 'Не получается? Ничего страшного', 'Ответь на пару вопросов'); limits[u] = await cantSheet(u); skip = false;
      if (/опор|неглуб/i.test(limits[u].level || '') && (u === 'ohs_front' || u === 'sls')) { limits[u].alt = 'support'; await runAlt(u); } else k = k0 + (UNITS[u] || []).length; }
  }
  if (stop) return; fg.stop(); pg.off();
  step(null, 'Готово', 'Считаю результат'); bar(1, ''); cam.onFrame = null; await say(SAY.finish); await saveRec(); stopCamera();
  track('test_done', { n: units.length, d: Math.round((Date.now() - tStart) / 1000) }, false);
  const fpsMed = fpsS.length ? [...fpsS].sort((a, b) => a - b)[fpsS.length >> 1] : null, qv = Object.values(quality);
  notePoseSpeed(fpsMed);
  track('cam_q', { n: fpsMed || 0, q: qv.length ? Math.min(...qv) : 0, c: `${poseInfo.deleg} ${poseInfo.model}` }, false);
  // техника съемки: без нее ретест на другом телефоне нельзя отличить от изменения у человека
  const tech = { model: poseInfo.model, deleg: poseInfo.deleg, fps: fpsMed && Math.round(fpsMed), pitch: phone.ok && Number.isFinite(phone.pitch) ? Math.round(phone.pitch) : null, rules: C.bodymap && C.bodymap.version };
  const res = { date: Date.now(), started: startedAt, kind: testKind(units), session: opts.specialist ? MODES.SPEC : MODES.SELF, vns: opts.vns || null, touch: passiveOn() ? touchSummary() : null, protocol: units, full: units.includes('side') || units.includes('profile'), snapshot, side, moves, poses, quality, limits, setup: setup || setup0, tech };
  sendNorms(res); return res;
}


// ---------- бета: пропустить видеотест ----------
// Только в бета-режиме: правдоподобный результат без камеры, чтобы тестировщики могли смотреть карту, кабинет и отчеты сколько угодно раз.
const isBetaMode = () => configSync().beta !== false;
// демо-результат без камеры только для владельца и локальной проверки: у клиента он выглядел как настоящий замер (аудит, п. 1)
const canFake = () => { const u = meSync(); return isBetaMode() && (!!(u && u.admin) || /^(localhost|127\.)/.test(location.hostname)); };
const skipBtn = () => canFake() && !(INV() || {}).cal ? '<button class="btn ghost" id="skipTest" style="margin-top:8px">Пропустить видеотест (бета)</button>' : '';
function fakeResult(protocol) {
  const j = (v, k = 1) => Math.round((v + (Math.random() - .5) * 2 * k) * 10) / 10, p = Array.isArray(protocol) && protocol.length ? protocol : ['stand', 'ohs_front', 'sls', 'side'];
  const v2 = p.includes('fwd') ? { fwd: { quality: 'GOOD', f: { fwd_reach: j(.6, .2), fwd_asym: j(3, 2), fwd_asym_side: 1 } }, slb: { quality: 'GOOD', f: { slb_drop_r: j(4, 2), slb_drop_l: j(1.5, 1), slb_sway_r: j(3, 1), slb_sway_l: j(2, 1) } }, trot: { quality: 'GOOD', f: { trot_r: j(38, 6), trot_l: j(45, 6), trot_asym: j(-7, 4) } }, reach: { quality: 'GOOD', f: { reach_r: j(165, 6), reach_l: j(170, 5), reach_asym: j(5, 3), reach_shrug: j(.07, .03), reach_shrug_side: 1 } }, iap: { quality: 'GOOD', f: { rib_flare: j(8, 4), apical_mm: j(9, 4) } } } : {};
  return { date: Date.now(), protocol: p, full: true, quality: {}, limits: {}, setup: {}, beta: true, kind: testKind(p),
    snapshot: { shoulderTilt: j(4, 2), pelvicTilt: j(-3.5, 2), headTilt: j(1, .5), trunkLateral: j(1.2, .6) }, side: { headForwardDeg: j(16, 6), kneeHyperDeg: j(2, 1), shoulderShift: .01, hipShift: 0 },
    moves: { ...v2, ohs_front: { quality: 'GOOD', f: { ohs_valgus_r: j(12, 4), ohs_valgus_l: j(5, 2) } }, sls_r: { quality: 'GOOD', f: { sls_drop_r: j(5, 2), sls_valgus_r: j(11, 4), sls_trunk_r: j(3, 1) } }, sls_l: { quality: 'GOOD', f: { sls_drop_l: j(1.5, 1), sls_valgus_l: j(4, 2), sls_trunk_l: j(1, .5) } } } };
}
/** Старт теста через экран загрузки. Пока грузятся камера и модель позы, на загрузчике плывет жидкая капля:
 *  человек сам следит за ней глазами, и в это время незаметно идут окуломоторный блок и пульс (только SELF_TEST, фронтальная камера). */
async function launchTest(run, onErr) {
  // Safety Gate до загрузчика, чтобы после загрузки сразу открылась камера
  const acute = await vasSheet('Есть ли острая боль прямо сейчас? (0–10)', 0, 'Боли нет', true); if (acute === undefined) return null;
  voice.unlock(); startMotion(); const front = !cam.back && device.camera;
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.appendChild(v);
  cam.hold = true; const ready = (async () => { if (front) { try { await startCamera(v); } catch (e) {} } await initPose(); })();
  let vns = null; try { vns = await runLoader({ ready, video: front ? v : null, mirror: true }); } catch (e) { cam.hold = false; v.remove(); return onErr(e); }
  cam.hold = false; v.remove(); return run(vns, acute);
}
/** Кнопка-свайп: ведете кружок вправо до конца. Касание без свайпа слегка «подталкивает» кружок, Enter и пробел тоже запускают. */
export const swipeHTML = (id, text) => `<div class="swipe" id="${id}" role="button" tabindex="0" aria-label="${text}"><span class="swipe-t">${text}</span><b class="swipe-k">${ic('chevron-right', 's')}</b></div>`;
export function bindSwipe(el, onDone) {
  if (!el) return; const k = el.querySelector('.swipe-k'); let x0 = null, dx = 0, fired = false; const max = () => el.clientWidth - k.offsetWidth - 12;
  const fire = () => { if (fired) return; fired = true; el.classList.add('done'); k.style.transform = `translateX(${max()}px)`; setTimeout(onDone, 180); };
  el.addEventListener('pointerdown', e => { if (fired) return; x0 = e.clientX; dx = 0; k.style.transition = 'none'; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (x0 == null) return; dx = Math.max(0, Math.min(max(), e.clientX - x0)); k.style.transform = `translateX(${dx}px)`; el.style.setProperty('--p', dx / max()); });
  el.addEventListener('pointerup', () => { if (x0 == null) return; x0 = null; k.style.transition = ''; if (dx >= max() * .85) return fire();
    k.style.transform = dx < 6 ? 'translateX(18px)' : 'translateX(0)'; el.style.setProperty('--p', 0); if (dx < 6) setTimeout(() => { if (!fired) k.style.transform = 'translateX(0)'; }, 260); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
}
async function runTest(vns = null, acute) {
  const r = await runProtocol(consumerProtocol(), { pre: PRE, vns, acute }); if (!r) return;
  const { poses, ...light } = r; saveTest(light); rememberBaseline(light.touch); resetTouch();
  const rt = +localStorage.getItem(K('bp_retest')); localStorage.removeItem(K('bp_retest')); if (rt) return afterWorkout(rt);
  // контрольная пара: тест повторили в течение 30 минут без упражнений между ними
  { const all = tests(), prev = all.at(-2), now = all.at(-1), done = JSON.parse(localStorage.getItem(K('bp_done')) || '[]');
    if (prev && now && now.date - prev.date < 30 * 60e3 && !done.some(x => x.t > prev.date)) sendPair(prev, now, false); }
  analysisScreen();
}

function cameraHelp() {
  stopCamera();
  const url = location.origin + location.pathname + '?ref=' + encodeURIComponent(REF);
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div>
    <div class="empty" style="flex:1;justify-content:center">${ic('lock')}<h1>Камера не запустилась</h1>
    <p class="sub">${device.inApp || device.tg ? 'Встроенный браузер этого приложения не дает доступ к камере. Открой тест в Chrome или Safari.' : 'Разреши доступ к камере: значок замка или «Аа» в адресной строке → Камера → Разрешить. Потом нажми «Попробовать снова».'}</p></div>
    <div class="dock">${device.tg ? '<button class="btn" id="ob">Открыть в браузере</button>' : `<button class="btn" id="cp">Скопировать ссылку</button>`}<button class="btn line" id="rt">Попробовать снова</button></div></div>`);
  if ($('#ob')) $('#ob').onclick = () => window.Telegram.WebApp.openLink(url, { try_instant_view: false });
  if ($('#cp')) $('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(url); toast('Ссылка скопирована. Вставь её в Chrome или Safari'); };
  $('#rt').onclick = prep; $('#back').onclick = prep;
}

// ---------- приглашение от специалиста: тест дома, результат уходит ему зашифрованным ----------
const INV = () => { try { const o = JSON.parse(localStorage.getItem('bp_inv') || 'null'); return o ? { ...cleanInv(o), join: !!o.join } : null; } catch (e) { return null; } };
const PAINZ = [['neck', 'Шея'], ['shoulder', 'Плечо'], ['upper_back', 'Грудной отдел'], ['low_back', 'Поясница'], ['hip', 'Таз, бедро'], ['knee', 'Колено'], ['foot', 'Стопа']];
const PROFILE = () => { try { return JSON.parse(localStorage.getItem(K('bp_profile')) || 'null'); } catch (e) { return null; } };
function joinForm() { return profileSteps(inviteWelcome, () => safetyScreen(inviteWelcome, () => linkConsent(inviteWelcome, (INV() || {}).s), bot()), true); }
export const profileOk = (p = PROFILE()) => !!(p && p.name && p.sex && +p.height && (p.dob || p.year));
/** Анкета по шагам. Человек печатает имя и год, выбирает пол, тянет ползунок роста, а в фоне уже идет замер ЦНС:
 *  ритм набора (интервалы, их разброс, исправления), удержание касаний и траектория пальца на ползунке (виляние, микро-откаты).
 *  Отдельного «теста» нет: так замер не искажается ожиданием проверки (эффект наблюдателя). invite: анкета для специалиста, 4 шага. */
export function profileSteps(done, back, invite = false) {
  const pr = { ...(PROFILE() || {}) }, Y = new Date().getFullYear();
  const st = { name: pr.name || '', surname: pr.surname || '', year: pr.year || (pr.dob ? +String(pr.dob).slice(0, 4) : ''),
    sex: pr.sex || '', height: +pr.height || 170, hand: pr.hand || 'R', activity: pr.activity || '', zones: pr.zones || [], complaints: pr.complaints || '' };
  const N = invite ? 4 : 3; let i = 0;
  const chips = (key, opts, multi) => `<div class="chips">${opts.map(([k, t]) => `<button type="button" class="chip2${(multi ? st[key].includes(k) : st[key] === k) ? ' on' : ''}" data-c="${key}" data-v="${k}" aria-pressed="${multi ? st[key].includes(k) : st[key] === k}">${t}</button>`).join('')}</div>`;
  const STEPS = [
    { h: 'Как вас зовут?', ok: () => st.name.trim().length >= 2, btn: 'Указать возраст',
      body: () => `<input id="pf_name" class="field big" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Имя" value="${esc(st.name)}">${invite ? `<input id="pf_surname" class="field" style="margin-top:12px" autocomplete="off" placeholder="Фамилия, по желанию" value="${esc(st.surname)}">` : ''}` },
    { h: 'Год рождения и пол', ok: () => +st.year >= 1925 && +st.year <= Y - 8 && !!st.sex, btn: 'Указать рост',
      body: () => `<input id="pf_year" class="field big num" inputmode="numeric" pattern="[0-9]*" maxlength="4" enterkeyhint="done" autocomplete="off" placeholder="${Y - 35}" value="${st.year}"><div style="height:16px"></div>${chips('sex', [['M', 'Мужской'], ['F', 'Женский']])}` },
    { h: 'Рост', ok: () => st.height >= 140 && st.height <= 210, btn: invite ? 'Сохранить рост' : 'Сохранить и начать',
      body: () => `<div class="hval"><b id="pf_hv" class="num">${st.height}</b><span>см</span></div><input id="pf_height" type="range" class="range" min="140" max="210" step="1" value="${st.height}" aria-label="Рост, см"><div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub);margin-top:6px"><span>140</span><span>210</span></div><div style="height:24px"></div>${chips('hand', [['R', 'Правша'], ['L', 'Левша']])}` },
    { h: 'Что беспокоит?', ok: () => true, btn: 'Сохранить и начать', skip: true,
      body: () => `${chips('zones', PAINZ, true)}<div class="eyebrow" style="margin-top:24px">Нагрузка</div><div style="height:8px"></div>${chips('activity', [['офис', 'Офис'], ['спорт', 'Спорт'], ['физический труд', 'Физ. труд'], ['мало движения', 'Мало движения']])}<textarea id="pf_complaints" rows="2" class="field" placeholder="Своими словами, по желанию" style="height:auto;padding:12px 16px;margin-top:16px">${esc(st.complaints)}</textarea>` },
  ].slice(0, N);
  const save = () => { const token = pr.token || seal.rid();
    localStorage.setItem(K('bp_profile'), JSON.stringify({ ...pr, token, name: st.name.trim(), surname: st.surname.trim(), year: +st.year, dob: `${st.year}-07-01`, sex: st.sex, height: String(st.height), hand: st.hand, activity: st.activity, zones: st.zones, complaints: st.complaints.trim() }));
    setBodySex(st.sex); backupSoon(); track('profile_done', { c: invite ? 'inv' : 'self' }, false); done(); };
  const draw = () => { const S = STEPS[i];
    go(`<div class="scr fade" id="pf"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="stepper"><span>Шаг ${i + 1} из ${N}</span><i><b style="width:${(i + 1) / N * 100}%"></b></i></div><span style="width:48px"></span></div>
      <div class="pad" style="padding-top:24px"><h1>${S.h}</h1><div style="margin-top:24px">${S.body()}</div></div>
      <div class="dock" style="padding-top:32px"><button class="btn" id="pf_go" ${S.ok() ? '' : 'disabled'}>${S.btn}</button>${S.skip ? '<button class="btn ghost" id="pf_skip">Пропустить</button>' : ''}</div></div>`);
    const upd = () => { $('#pf_go').disabled = !S.ok(); };
    app.querySelectorAll('#pf input,#pf textarea').forEach(el => el.oninput = () => { const k = el.id.slice(3);
      st[k] = k === 'year' ? el.value.replace(/\D/g, '').slice(0, 4) : k === 'height' ? +el.value : el.value; if (k === 'year' && el.value !== st.year) el.value = st.year;
      if (k === 'height') $('#pf_hv').textContent = st.height; upd(); });
    app.querySelectorAll('#pf [data-c]').forEach(b => b.onclick = () => { const k = b.dataset.c, v = b.dataset.v;
      if (Array.isArray(st[k])) st[k] = st[k].includes(v) ? st[k].filter(x => x !== v) : [...st[k], v]; else st[k] = st[k] === v ? (k === 'activity' ? '' : v) : v;
      app.querySelectorAll(`#pf [data-c="${k}"]`).forEach(x => { const on = Array.isArray(st[k]) ? st[k].includes(x.dataset.v) : st[k] === x.dataset.v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); upd(); });
    const f = app.querySelector('#pf input:not([type=range])'); if (f && !f.value) setTimeout(() => f.focus(), 250);
    app.querySelectorAll('#pf input').forEach(el => el.onkeydown = e => { if (e.key === 'Enter' && S.ok()) $('#pf_go').click(); });
    $('#pf_go').onclick = () => { if (!S.ok()) return; if (i < N - 1) { i++; draw(); } else save(); };
    if ($('#pf_skip')) $('#pf_skip').onclick = save;
    $('#back').onclick = () => { if (i) { i--; draw(); } else back(); }; };
  draw();
}
export const TIP_ACT = `<details class="tip"><summary aria-label="Подсказка">?</summary><div>Укажите ваш вид активности (например, «офис 8 часов» или «бег 3 раза в неделю»), это поможет точнее подобрать нагрузки.</div></details>`;
const PREI = {}, PAINI = {};

/** Понятная причина, если тест не запустился, и кнопка «Повторить» вместо сырого текста ошибки. */
export function startError(e, retry) {
  const n = (e && e.name) || '', m = String((e && e.message) || '');
  const [h, t] = /NotAllowed|Permission|denied/i.test(n + m) ? ['Нет доступа к камере', 'Разрешите камеру для этого сайта: значок замка или «Aa» в адресной строке → Камера → Разрешить. Видео не записывается.']
    : /NotFound|NotReadable|Overconstrained/i.test(n + m) ? ['Камера недоступна', 'Закройте другие приложения, которые используют камеру, и попробуйте снова.']
    : ['Не загрузилось распознавание движения', 'Нужен интернет при первом запуске: проверьте связь и нажмите «Повторить».'];
  track('start_error', { c: (n || m).slice(0, 40) }, false);
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:21px">${h}</h2><p class="sub" style="margin-top:8px;font-size:15px;line-height:1.45">${t}</p><button class="btn" id="err_r" style="margin-top:16px">Повторить</button><button class="btn ghost" id="err_x" style="margin-top:8px">Закрыть</button></div>`;
  document.body.appendChild(d); d.querySelector('#err_x').onclick = () => d.remove(); d.querySelector('#err_r').onclick = () => { d.remove(); retry && retry(); };
}
async function inviteWelcome() {
  track('inv_open'); if (!inviteWelcome.chk) { inviteWelcome.chk = 1; checkInvAlive(); }
  // клиенту по ссылке аккаунт не нужен: пожилые бросали тест на экране входа. Только согласия и проверка безопасности
  if (!linkConsentOk()) { linkConsent(inviteWelcome, (INV() || {}).s); return addSpecHint(); }
  if (!safetyOk()) { safetyScreen(inviteWelcome, () => linkConsent(inviteWelcome, (INV() || {}).s), bot()); return addSpecHint(); }
  voice.preload(Object.values(SAY));
  const inv = INV(); const rows = rowsOf(inv.p); const pain = PAINI;
  // анкета (имя, пол, дата рождения, рост) обязательна по общей ссылке и в калибровке: без нее данные калибровки не сравнить
  const needPf = inv.join || inv.cal; if (needPf && !PROFILE()) return joinForm();
  if (needPf) inv.n = PROFILE().name;
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div><div class="pad" style="padding-top:4px"><div class="eyebrow">Тест от специалиста</div>
     <h1 style="margin-top:8px">${(inv.n || (PROFILE() || {}).name) ? esc(inv.n || PROFILE().name) + ', ' : ''}здравствуйте!</h1>${inv.join || inv.cal ? '<button class="pill" id="editpf" style="margin-top:8px">Изменить анкету</button>' : ''}<p class="sub" style="margin-top:8px">${esc(inv.s)} подготовил для вас тест движения. Результат сразу придет специалисту, а вы увидите свою карту тела.</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
    <input type="checkbox" id="share_ok" checked hidden><!-- согласие на передачу уже дано на первом экране ссылки (linkConsent) -->
    <p class="sub" style="font-size:13px">Результат зашифруется и уйдет только специалисту: ${esc(inv.s)}.</p>
    <button class="btn" id="go">Начать тест · ${mins(SETUP_SEC + secs(rows))} мин</button>${skipBtn()}
    <p class="sub" style="font-size:13px;margin-top:-4px">Все объяснит голос по ходу теста. Ниже можно отметить, где болит, и подготовиться.</p></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:14px;margin-top:20px;padding-bottom:24px">
    <div class="card" style="display:flex;flex-direction:column;gap:8px"><b style="font-size:17px">Как подготовиться</b>${[['info', 'Одежда по фигуре: шорты или леггинсы и футболка, лучше босиком. Широкие брюки, юбка или халат скрывают колени и таз, и точность падает'], ['camera', 'Телефон вертикально, на уровне пояса: на полку, стул или прислоните к стене'], ['arrow-right-left', 'Отойдите на 2–4 метра, чтобы в кадре был весь рост. Свет спереди, не из-за спины']].map(([i, t]) => `<div class="row" style="align-items:flex-start;font-size:14px;line-height:1.45">${ic(i, 's')}<span>${t}</span></div>`).join('')}</div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><b style="font-size:17px">Где болит или беспокоит?</b><span class="sub" style="font-size:13px;margin-top:-6px">Отметьте зоны, если болит. Можно ничего не отмечать.</span>
      <div class="row" style="flex-wrap:wrap;gap:8px">${PAINZ.map(([k, n]) => `<button class="pill" data-pz2="${k}" style="border:1.5px solid ${pain[k] > 0 ? 'var(--brand)' : 'transparent'};${pain[k] > 0 ? 'background:var(--brand-s)' : ''}">${n}</button>`).join('')}</div>
      <div id="painsl" style="display:flex;flex-direction:column;gap:6px"></div>
      <textarea id="ccom" rows="3" maxlength="1000" class="field" placeholder="Комментарий для специалиста: что беспокоит, когда болит, что пробовали" style="height:auto;padding:12px 14px;font-size:15px">${esc(localStorage.getItem('bp_ccom_' + inv.i) || (inv.join && PROFILE() && PROFILE().complaints) || '')}</textarea></div>
    <div class="eyebrow" style="margin-top:4px">Что будет в тесте</div>${stepList(inv.p, PREI)}
   </div><div class="dock" id="sdock" style="display:none"><button class="btn" id="go2">Начать тест</button></div></div>`);
  bindStepList(PREI, inviteWelcome);
  // плавающая кнопка внизу: появляется, когда верхняя «Начать тест» уехала за экран, чтобы не листать вверх
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { if ($('#sdock')) $('#sdock').style.display = e.isIntersecting ? 'none' : ''; }).observe($('#go'));
  const dirty = () => { if ($('#go2')) $('#go2').textContent = 'Сохранить и начать тест'; };
  if (!app._dirty) { app._dirty = 1; app.addEventListener('input', dirty); app.addEventListener('change', dirty); }
  $('#go2').onclick = () => $('#go').click();
  $('#back').onclick = inv.join || inv.cal ? joinForm : () => safetyScreen(inviteWelcome, () => linkConsent(inviteWelcome, (INV() || {}).s), bot());
  addSpecHint();
  if ($('#skipTest')) $('#skipTest').onclick = () => { if (!$('#share_ok').checked) { $('#share_ok').parentElement.style.outline = '2px solid var(--over)'; return; }
    track('beta_skip_test'); const r = stampMain({ ...fakeResult(inv.p), poses: {} }), { poses, ...light } = r; saveTest({ ...light, pain, inv: inv.i });
    try { sendResult({ ...r, pain, comment: comment(), profile: inv.join || inv.cal ? PROFILE() : undefined }); } catch (e) {} analysisScreen(); };
  const drawPain = () => { $('#painsl').innerHTML = PAINZ.filter(([k]) => pain[k] > 0).map(([k, n]) => `<div class="row" style="background:var(--surface-2);border-radius:var(--r-md);padding:6px 14px;min-height:48px"><span style="width:110px;font-size:14px">${n}</span><input type="range" min="1" max="10" value="${pain[k]}" data-p="${k}" style="flex:1;accent-color:var(--brand)" aria-label="${n}, боль от 1 до 10"><b class="num" id="pv_${k}" style="width:28px;text-align:right">${pain[k]}</b></div><div id="pw_${k}" style="font-size:13px;color:var(--sub);margin:-2px 0 4px 14px">${painWord(pain[k])}</div>`).join('') + (PAINZ.some(([k]) => pain[k] > 0) ? `<div style="font-size:12px;color:var(--sub);line-height:1.4">${PAIN_SCALE}</div>` : '');
    app.querySelectorAll('[data-p]').forEach(r => r.oninput = () => { pain[r.dataset.p] = +r.value; $('#pv_' + r.dataset.p).textContent = r.value; $('#pw_' + r.dataset.p).textContent = painWord(r.value); }); };
  drawPain();
  app.querySelectorAll('[data-pz2]').forEach(b => b.onclick = () => { const k = b.dataset.pz2; pain[k] = pain[k] > 0 ? 0 : 3; b.style.borderColor = pain[k] > 0 ? 'var(--brand)' : 'transparent'; b.style.background = pain[k] > 0 ? 'var(--brand-s)' : ''; drawPain(); });
  $('#ccom').oninput = e => { try { localStorage.setItem('bp_ccom_' + inv.i, e.target.value); } catch (er) {} };
  // после теста экрана с полем уже нет: берем сохраненный текст
  const comment = () => String(($('#ccom') ? $('#ccom').value : (() => { try { return localStorage.getItem('bp_ccom_' + inv.i); } catch (e) { return ''; } })()) || '').trim().slice(0, 1000);
  if ($('#editpf')) $('#editpf').onclick = joinForm;
  $('#go').onclick = async () => { if (cameraBlocked()) return openInBrowserSheet(); if (!$('#share_ok').checked) { $('#share_ok').parentElement.style.outline = '2px solid var(--over)'; return; } localStorage.setItem('bp_share_' + inv.i, String(Date.now())); let st = null; try { st = await launchTest((vns, acute) => ({ vns, acute }), e => { throw e; }); } catch (e) { inviteWelcome(); return startError(e, () => $('#go') && $('#go').click()); } if (!st) return;
    const r = await runProtocol(inv.p, { onCancel: inviteWelcome, pre: PREI, vns: st.vns, acute: st.acute }); if (!r) return; stampMain(r);
    const { poses, ...light } = r; saveTest({ ...light, pain, inv: inv.i }); rememberBaseline(light.touch); resetTouch();
    const cm = comment(); sendResult({ ...r, pain, comment: cm, profile: inv.join || inv.cal ? PROFILE() : undefined }); analysisScreen(); };
}
// неотправленный результат с записью скелета весит мегабайты: храним в IndexedDB, а не в localStorage (там квота около 5 МБ)
const outbox = (() => { const open = () => new Promise((ok, no) => { const q = indexedDB.open('bodypassport-outbox', 1); q.onupgradeneeded = () => q.result.createObjectStore('o'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
  const tx = (mode, fn) => open().then(db => new Promise((ok, no) => { const t = db.transaction('o', mode); const r = fn(t.objectStore('o')); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }));
  return { set: v => tx('readwrite', s => s.put(v, 'pending')), get: () => tx('readonly', s => s.get('pending')), clear: () => tx('readwrite', s => s.delete('pending')) }; })();
// старые версии клали неотправленное в localStorage: переносим
try { const old = localStorage.getItem('bp_pending'); if (old) { outbox.set(JSON.parse(old)).then(() => localStorage.removeItem('bp_pending')).catch(() => {}); } } catch (e) {}
async function sendResult(r) {
  const inv = INV(); if (!inv) return;
  localStorage.setItem('bp_sent', 'sending'); localStorage.setItem('bp_sent_at', String(Date.now()));
  try { const pr = PROFILE(); const payload = inv.join || inv.cal ? { type: 'join', token: pr && pr.token, profile: pr, result: r } : r;
    const body = await seal.encrypt(inv.k, payload); const res = await fetch('/api/relay?id=' + inv.i, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (!res.ok) throw new Error(res.status); localStorage.setItem('bp_sent', 'ok'); track('result_sent'); outbox.clear().catch(() => {}); }
  catch (e) { localStorage.setItem('bp_sent', 'fail'); track('result_fail', { c: String(e.message || e) }); await outbox.set(r).catch(() => {}); }
  const box = document.getElementById('sentbox'); if (box) box.outerHTML = sentBanner(tests().at(-1));
}
// клиенту по ссылке специалиста: дата повторного теста и кнопка «в календарь телефона» с напоминанием за день
// специалист открыл ссылку, присланную как клиенту (например, коллега показал приложение): объясняем и ведем в свой кабинет
function specHint() { if (!canSwitchMode()) return ''; return '<div class="pad" style="padding-top:8px;text-align:center"><button class="link" id="iamsp" style="font-size:14px;color:var(--sub)">Вы специалист? Откройте свой кабинет</button></div>'; }
function bindSpecHint() { const b = document.getElementById('iamsp'); if (!b) return; b.onclick = specSheet; }
// на телефоне осталась ссылка клиента: объясняем и по согласию переводим в кабинет специалиста
function specSheet() {
  const d = document.createElement('div'); d.className = 'sheet'; const who = (INV() || {}).s || 'Коллега';
  d.innerHTML = `<div><h2>Это тест для клиента</h2><p class="sub" style="margin-top:8px">${esc(who)} прислал ссылку, по которой клиент проходит тест и результат уходит специалисту. Чтобы работать со своими клиентами, откройте собственный кабинет: в нем ваши клиенты, отчеты с вашим именем и ссылки для ваших клиентов.</p>
    <button class="btn" id="spgo" style="margin-top:var(--s4)">Открыть кабинет специалиста</button><button class="btn ghost" id="spx" style="margin-top:8px">Я клиент, продолжить</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'spx') d.remove(); };
  d.querySelector('#spgo').onclick = () => { d.remove(); track('inv_open', { c: 'specialist' }, false); localStorage.removeItem('bp_inv'); localStorage.removeItem('bp_sent'); localStorage.setItem('bp_mode', 'pro'); openPro(); }; }
function addSpecHint() { const sc = app.querySelector('.scr'); if (sc && !document.getElementById('iamsp')) { sc.insertAdjacentHTML('beforeend', specHint()); bindSpecHint(); } }
function retestCard() { const inv = INV(); if (!inv || !inv.d) return '';
  const days = Math.ceil((inv.d - Date.now()) / 864e5), date = new Date(inv.d).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  return `<div class="pad" style="padding-top:8px"><div class="card row" style="gap:10px;font-size:14px">${ic('calendar', 's')}<span style="flex:1">${days <= 0 ? '<b>Пора пройти повторный тест</b>' : `Повторный тест: <b>${date}</b>`}<br><span class="sub" style="font-size:13px">Назначил специалист: ${esc(inv.s)}</span></span><button class="pill" id="rtcal">${days <= 0 ? 'Пройти' : 'В календарь'}</button></div>
    ${days > 0 ? `<button class="btn line" id="rttg" style="margin-top:8px;height:44px">${localStorage.getItem('bp_tgon') ? 'Напоминание в Telegram включено' : 'Напомнить в Telegram'}</button>` : ''}</div>`; }
// напоминание о ретесте от бота: имя, дата и специалист, без данных о здоровье. Дата обновляется сама при новой ссылке
async function tgRemind(open) { const inv = INV(); if (!inv || !inv.d) return;
  const pr = PROFILE(), body = { code: localStorage.getItem('bp_tgc') || undefined, d: inv.d, n: (pr && pr.name ? pr.name : inv.n || '').split(' ')[0], s: inv.s };
  const r = await fetch('/api/remind?a=client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => ({})) : {}; if (!j.code) { if (open) toast(r && r.status === 503 ? 'Бот пока не подключен' : 'Нет связи, попробуйте позже'); return; }
  localStorage.setItem('bp_tgc', j.code); localStorage.setItem('bp_tgd', String(inv.d)); if (j.linked) localStorage.setItem('bp_tgon', '1');
  if (open) { track('tg_remind', {}, false); location.href = `https://t.me/${j.bot}?start=c_${j.code}`; localStorage.setItem('bp_tgon', '1'); } }
function bindRetestCard() { const t = document.getElementById('rttg'); if (t) t.onclick = () => tgRemind(true);
  { const inv = INV(); if (inv && inv.d && localStorage.getItem('bp_tgc') && localStorage.getItem('bp_tgd') !== String(inv.d)) tgRemind(false); }
  const b = document.getElementById('rtcal'); if (!b) return; const inv = INV();
  b.onclick = () => { if (inv.d - Date.now() <= 0) return inviteWelcome();
    const z = n => String(n).padStart(2, '0'), d = new Date(inv.d), day = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`, url = location.origin + '/';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyPassport//RU', 'BEGIN:VEVENT', 'UID:bp-retest-' + inv.i.slice(0, 12) + '@bodypassport', 'DTSTART;VALUE=DATE:' + day, 'SUMMARY:Повторный тест движения (BodyPassport)', 'DESCRIPTION:Откройте ' + url + ' и пройдите тест', 'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', 'DESCRIPTION:Завтра повторный тест движения', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'retest.ics'; a.click(); }; }
// плашка об отправке только у теста, пройденного по этой ссылке; «отправляю» дольше 2 минут — значит, отправка прервалась
function sentBanner(t) { const inv = INV(); if (!inv || (t && t.inv !== inv.i)) return ''; let st = localStorage.getItem('bp_sent'); if (!st) return '';
  if (st === 'sending' && Date.now() - +(localStorage.getItem('bp_sent_at') || 0) > 120000) st = 'fail';
  return `<div class="pad" id="sentbox" style="padding-top:12px"><div class="card row" style="font-size:14px;gap:10px">${st === 'ok' ? `<span class="mark OK"></span><span style="flex:1">Результат отправлен: ${esc(inv.s)}${inv.cal ? '. Специалист сверит его со своей оценкой и отправит без вашего имени на настройку приложения' : ''}</span>${localStorage.getItem('bp_ask') ? `<a class="pill" href="${esc(localStorage.getItem('bp_ask'))}" target="_blank" rel="noopener" style="text-decoration:none">Написать</a>` : ''}` : st === 'fail' ? `<i class="dia" style="color:var(--short)"></i><span style="flex:1">Не удалось отправить результат</span><button class="pill" id="resend">Отправить снова</button>` : '<span class="spin" style="margin:0;width:16px;height:16px;border-width:2px"></span><span>Отправляю результат специалисту…</span>'}</div></div>`; }

// ---------- 4. анализ: тёмный экран, фигура проявляется, три строки статуса ----------
let REVEAL = false;
async function analysisScreen() {
  setBodySex((PROFILE() || {}).sex);
  SEL = null; MODE3D = false; REVEAL = true; SHOW_T = null;
  if (reduceMotion()) return map();
  const cur = currentAnalysis(); const all = cur ? spots(cur.a) : [];
  go(`<div class="scr dark fade" style="align-items:center;justify-content:center;padding:0 var(--gutter)">
    <canvas id="anh" style="width:180px;display:block"></canvas>
    <h1 style="margin-top:28px;color:var(--cam-text);text-align:center">Собираем карту тела</h1><p style="margin-top:8px;color:var(--cam-sub)">Считаем прямо на телефоне</p>
    <div class="stagger" style="margin-top:24px;display:flex;flex-direction:column;gap:12px;color:var(--cam-text)">${['Углы и асимметрии', 'Связи между звеньями', 'Карта мышц'].map(t => `<div class="row" style="gap:10px"><span style="color:var(--signal)">${ic('check', 's')}</span><span>${t}</span></div>`).join('')}</div></div>`);
  const top = topOf(all); drawHeat($('#anh'), all, top[0] ? top[0].back : false, null, [], { reveal: true });
  await sleep(1700); map();
}

// ---------- 5. карта тела ----------
let BACK = true, SEL = null, MODE3D = false, MAP_OPEN = true; // карта тела открыта и стоит первой, под ней карточки задач
// короткий замер для подписи на карте: «14°», «8%»
const shortVal = t => { const m = String(t || '').match(/(\d+(?:[.,]\d+)?)\s*(°|%|см)?/); return m ? m[1] + (m[2] || '') : null; };
// для какой зоны итога упражнение: строка-связь на экране тренировки
function reasonsOf(ids, top) { const out = {};
  for (const id of ids) for (const s of top.slice(0, 3)) { const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left';
    const list = s.k === 'WEAK' ? ((m.plan && m.plan.isolate) || m.activate || []) : releaseFor(m, s.k, ex);
    if (!out[id] && list.some(x => x.replace('{s}', sk) === id)) out[id] = { k: s.k, t: `${TONE[s.k][4]}: ${lc(m.zone || m.name)} ${sideWord(s.side)}` }; }
  return out; }
// «Ваша осанка»: перекосы позы простыми словами и схемой, которая плавно уходит из ровной стойки в позу человека.
// Схема спереди: правая сторона человека слева на экране. Наклоны на схеме усилены в 3 раза, чтобы их было видно.
const POSE_PAT = { shoulder_tilt: 'tilt', trunk_shift: 'tilt', pelvis_tilt: 'pelvis', head_tilt: 'head', trot_asym: 'twist', fwd_adams: 'twist', head_forward: 'fwd', trunk_forward: 'fwd', sq_lean: 'fwd', reach_shrug: 'shrug' };
export function posturePatterns(findings) {
  const by = {}; for (const fd of findings) { const k = POSE_PAT[fd.rule.id]; if (!k || fd.borderline && by[k]) continue; const v = Math.abs(fd.value || 0); if (!by[k] || v > Math.abs(by[k].value || 0)) by[k] = fd; }
  const L = { tilt: fd => `Кренит ${fd.side === 'RIGHT' ? 'влево' : 'вправо'}`, pelvis: () => 'Таз перекошен', head: fd => `Голова к ${fd.side === 'RIGHT' ? 'правому' : 'левому'} плечу`,
    twist: fd => fd.rule.id === 'trot_asym' ? `Скручивает ${fd.side === 'LEFT' ? 'вправо' : 'влево'}` : 'Скручивает спину', fwd: () => 'Тянет вперед', shrug: () => 'Плечи к ушам' };
  return Object.entries(by).map(([k, fd]) => ({ k, fd, label: L[k](fd), sub: fd.observed.replace(' (на границе нормы)', '') })).slice(0, 3);
}
function postureFigure(pats) {
  const g = k => pats.find(p => p.k === k), deg = (fd, cap = 14) => Math.min(cap, Math.abs(fd.value || 0) * 3);
  // правая сторона человека на экране слева: «плечо выше справа» поднимает левую на экране сторону
  const sh = g('tilt') ? deg(g('tilt').fd) * (g('tilt').fd.side === 'RIGHT' ? 1 : -1) : 0, pv = g('pelvis') ? deg(g('pelvis').fd) * (g('pelvis').fd.side === 'RIGHT' ? 1 : -1) : 0;
  const hd = g('head') ? deg(g('head').fd, 18) * (g('head').fd.side === 'RIGHT' ? 1 : -1) : 0, tw = g('twist'), fw = g('fwd'), up = g('shrug') ? 5 : 0;
  const A = (v, a, b) => `<animateTransform attributeName="transform" type="rotate" values="0 ${a} ${b};${v} ${a} ${b};${v} ${a} ${b};0 ${a} ${b}" keyTimes="0;.4;.8;1" dur="4s" repeatCount="indefinite"/>`;
  const col = 'var(--short)';
  return `<svg viewBox="0 0 120 200" width="110" height="184" aria-hidden="true" style="flex:none">
    <g fill="var(--figure)" stroke="var(--faint)" stroke-width="2.5" stroke-linejoin="round">
      <g>${A(pv, 60, 112)}<path d="M44 108 L76 108 L74 190 L64 190 L60 128 L56 190 L46 190 Z"/></g>
      <g>${A(pv * .5, 60, 108)}
        <g>${A(sh - pv * .5, 60, 52)}<path d="M38 ${52 - up} L82 ${52 - up} L78 110 L42 110 Z"/><path d="M38 ${52 - up} L30 104 M82 ${52 - up} L90 104" stroke-width="7" stroke-linecap="round"/></g>
        <g>${A(-hd, 60, 44)}${fw ? `<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 7;0 7;0 0" keyTimes="0;.4;.8;1" dur="4s" repeatCount="indefinite"/>` : ''}<circle cx="60" cy="30" r="13"/></g></g></g>
    ${tw ? `<path d="M34 78 Q60 92 86 78" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" marker-end="url(#pfa)"><animate attributeName="stroke-dasharray" values="0 80;80 0;80 0;0 80" keyTimes="0;.4;.8;1" dur="4s" repeatCount="indefinite"/></path>` : ''}
    <defs><marker id="pfa" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="${col}"/></marker></defs></svg>`;
}
// поза для объемного скелета: те же признаки, что в подписях, в градусах (усилены втрое, чтобы было видно)
function poseOf(pats) {
  const g = k => pats.find(p => p.k === k), d = (fd, cap = 14) => Math.min(cap, Math.abs(fd.value || 0) * 3), o = {};
  if (g('tilt')) o.tilt = d(g('tilt').fd) * (g('tilt').fd.side === 'RIGHT' ? -1 : 1);
  if (g('pelvis')) o.pelvis = d(g('pelvis').fd) * (g('pelvis').fd.side === 'RIGHT' ? -1 : 1);
  if (g('head')) o.head = d(g('head').fd, 18) * (g('head').fd.side === 'RIGHT' ? 1 : -1);
  if (g('twist')) { const fd = g('twist').fd; o.twist = fd.rule.id === 'trot_asym' ? Math.min(30, Math.max(12, Math.abs(fd.value || 0) * 2)) * (fd.side === 'LEFT' ? -1 : 1) : 10; }
  if (g('fwd')) { const fd = g('fwd').fd; if (fd.rule.id === 'head_forward') o.headFwd = 1; else o.fwd = 14; }
  if (g('shrug')) o.shrug = 1; return o;
}
// «Ваша осанка» в раскрывающемся блоке: объемный скелет уходит из ровной стойки в позу человека, рядом подписи
function postureCard(a) {
  const pats = posturePatterns(a.findings);
  return `<div class="pad" style="margin-top:16px"><details class="acc card" id="posacc"><summary style="font-weight:600;min-height:40px"><span style="flex:1">Ваша осанка</span><span style="font-size:14px;font-weight:500;color:${pats.length ? 'var(--short-t)' : 'var(--ok-t)'};margin-right:8px">${pats.length ? esc(pats[0].label) : 'Ровно'}</span></summary>
    <div class="row" style="gap:12px;align-items:center;margin-top:8px">${device.webgl2 ? '<div id="pos3d" style="width:150px;height:240px;flex:none;position:relative"></div>' : postureFigure(pats)}
      <div style="flex:1;min-width:0">${pats.length ? pats.map(p => `<div style="margin-top:10px"><b style="font-size:16px">${p.label}</b><div style="font-size:13px;color:var(--sub);line-height:1.35">${esc(p.sub)}</div></div>`).join('') : '<div style="font-size:15px;line-height:1.4">Крена, скручивания и наклона вперед не видно</div>'}
        <div style="font-size:12px;color:var(--faint);margin-top:12px">Отклонения на скелете усилены. Скелет можно крутить пальцем</div></div></div></details></div>`;
}
// «Было → стало» на объемной фигуре: полупрозрачный силуэт в позе прошлого теста, цветная фигура переходит в позу нынешнего.
// Зеленым то, что выровнялось, красным то, что осталось или усилилось. Без WebGL блок не показывается, остаются цифры.
// «Было → стало» на 3D-фигуре с мышцами: две картинки одна над другой, человек сам тянет разделитель, как в сравнениях графики в играх.
// Под фигурой мышцы с процентами: насколько мышца ослаблена, зажата или перегружена в первом и в последнем тесте.
const BA_NOUN_SPEC = { WEAK: 'слабость', SHORT: 'зажатость', HYPER: 'перерастяжение' }; // HYPER везде одно: перерастянута (Long-Tight), растяжка запрещена
const baSpots = t => { const a = analyze(t, C); let all = spots(a); if (t.main) all = applyMain(all, t.main);
  const keys = new Set(topOf(all).slice(0, 12).map(x => x.key)); return all.map(x => keys.has(x.key) ? x : { ...x, k: 'OK', tone: 0 }); };
const pct = x => x && x.k !== 'OK' ? Math.min(100, Math.round(Math.abs(x.tone) * 100)) : 0;
// порог заметного изменения, процентных пунктов: из разброса пар тестов (автокалибровка), пока данных мало — 15
const baNoise = () => { const n = C.weights && C.weights.retest && C.weights.retest.mdc; return Number.isFinite(n) ? Math.max(8, Math.min(40, n)) : 15; };
export function baBlock(id) {
  return `<div class="bas" id="${id}"><div class="bas-tabs"><button class="on" data-b="0">Спереди</button><button data-b="1">Сзади</button></div>
    <div class="bas-box"><canvas class="bas-a"></canvas><canvas class="bas-b"></canvas><span class="bas-l">Было</span><span class="bas-r">Стало</span><div class="bas-h"><i></i></div>
    <input type="range" min="0" max="100" value="50" aria-label="Было или стало"></div>
    <p class="bas-hint">Тяните ползунок влево и вправо</p><div class="bas-list"></div></div>`;
}
// acute: сравнение сразу после занятия. Ухудшение в пределах двойного порога не показываем: через полчаса это чаще усталость
// и разброс теста, чем правда, а «хуже» после честной работы отбивает желание продолжать
export async function bindBa(id, prevT, curT, opts = {}) {
  const el = document.getElementById(id); if (!el || el.dataset.on) return; el.dataset.on = '1';
  let A, B; try { A = baSpots(prevT); B = baSpots(curT); } catch (e) { el.remove(); return; }
  const cvA = el.querySelector('.bas-a'), cvB = el.querySelector('.bas-b'), box = el.querySelector('.bas-box'), rng = el.querySelector('input');
  // сторона по умолчанию: где больше изменилось
  const diff = back => A.concat(B).filter(x => x.back === back && x.k !== 'OK').length;
  let back = diff(true) > diff(false);
  const draw = () => { drawHeat(cvA, A, back, null, [], { reveal: false }); drawHeat(cvB, B, back, null, [], { reveal: false });
    el.querySelectorAll('.bas-tabs button').forEach(b => b.classList.toggle('on', +b.dataset.b === +back)); };
  const set = v => { v = Math.max(0, Math.min(100, v)); rng.value = v; box.style.setProperty('--x', v + '%'); };
  el.querySelectorAll('.bas-tabs button').forEach(b => b.onclick = () => { back = b.dataset.b === '1'; draw(); });
  rng.oninput = () => set(+rng.value);
  const at = e => { const r = box.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
  box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); at(e); box._drag = true; });
  box.addEventListener('pointermove', e => { if (box._drag) at(e); }); box.addEventListener('pointerup', () => { box._drag = false; });
  set(50); draw();
  // подсказка движением: разделитель один раз проходит туда и обратно
  if (!reduceMotion()) { const t0 = performance.now(); const k = () => { if (box._drag) return; const t = (performance.now() - t0) / 1400; if (t > 1) return set(50); set(50 + Math.sin(t * Math.PI * 2) * 22); requestAnimationFrame(k); }; setTimeout(() => requestAnimationFrame(k), 500); }
  if (opts.list === false) { el.querySelector('.bas-list').remove(); return; }
  const byKey = new Map(A.map(x => [x.key, x])), rows = [...new Set([...topOf(A), ...topOf(B)].map(x => x.key))].map(key => { const a = byKey.get(key), b = B.find(x => x.key === key); return { a, b, s: b && b.k !== 'OK' ? b : a }; })
    .filter(r => r.s && C.muscles[r.s.id]);
  // показываем только заметные изменения: разница меньше порога лежит в пределах разброса между двумя тестами (поза, свет, усталость)
  const MDC = baNoise(), row = r => { const p0 = pct(r.a), p1 = pct(r.b), d = p1 - p0, k = (r.b && r.b.k !== 'OK' ? r.b : r.a).k;
    const v = p1 === 0 && p0 > 0 ? `<b class="up">${specView() ? 'норма' : 'лучше'}</b>` : d < 0 ? '<b class="up">лучше</b>' : '<b class="down">хуже</b>';
    return `<div class="bas-row"><div><span>${esc(specView() ? C.muscles[r.s.id].name : C.muscles[r.s.id].zone || C.muscles[r.s.id].name)} ${sideWord(r.s.side)}</span><small>${(specView() ? BA_NOUN_SPEC[k] : TONE[k] && TONE[k][3]) || ''}</small></div>${specView() ? `<div class="bas-p"><span>${p0}%</span><i>→</i><span>${p1}%</span></div>` : ''}${v}</div>`; };
  const big = rows.filter(r => { const d = pct(r.b) - pct(r.a); return opts.acute ? d <= -MDC || d >= 2 * MDC : Math.abs(d) >= MDC; }).sort((x, y) => Math.abs(pct(y.b) - pct(y.a)) - Math.abs(pct(x.b) - pct(x.a))), same = rows.length - big.length;
  el.querySelector('.bas-list').innerHTML = (big.length ? big.slice(0, 5).map(row).join('') : `<p class="bas-note" style="margin:0">${opts.acute ? 'Сразу после занятия тело откликается не всегда, это нормально. Главная проверка через неделю регулярных занятий.' : 'Заметных изменений пока нет. Обычно они видны через 2–3 недели занятий.'}</p>`)
    + (same > 0 ? `<p class="bas-note">Без заметных изменений: ${same} ${plural3(same, 'мышца', 'мышцы', 'мышц')}.</p>` : '');
}
function bindPosture(a) {
  const acc = $('#posacc'), box = $('#pos3d'); if (!acc || !box) return; let s3 = null;
  acc.addEventListener('toggle', async () => { if (acc.open && !s3) { try { const { skeleton3D } = await import('./skeleton3d.js'); s3 = await skeleton3D(box, poseOf(posturePatterns(a.findings))); } catch (e) { box.outerHTML = postureFigure(posturePatterns(a.findings)); } } });
}
// дыхание и внутрибрюшное давление: Коларж (ребра и таз), Левит (дыхание), Макгилл (поясница под нагрузкой)
export function iapRows(f) {
  const n = v => Number.isFinite(v), fmt1 = v => String(Math.round(v)).replace('.', ',');
  return [
    { who: 'Коларж', name: 'Ребра и таз', ok: n(f.rib_flare) ? f.rib_flare <= 12 : null, val: n(f.rib_flare) ? (f.rib_flare <= 12 ? 'в одной плоскости' : `расходятся на ${fmt1(f.rib_flare)}°`) : 'не измерено' },
    { who: 'Левит', name: 'Дыхание', ok: n(f.apical_mm) ? f.apical_mm <= 15 : null, val: n(f.apical_mm) ? (f.apical_mm <= 15 ? 'животом' : `грудью, плечи вверх на ${fmt1(f.apical_mm)} мм`) : 'не измерено' },
    { who: 'Макгилл', name: 'Поясница в приседе', ok: n(f.butt_wink) ? f.butt_wink <= 10 : null, val: n(f.butt_wink) ? (f.butt_wink <= 10 ? 'держится' : `подкручивается на ${fmt1(f.butt_wink)}°`) : 'нужен присед боком' } ];
}
function iapCard(a) {
  const rows = iapRows(a.f || {}), m = rows.filter(r => r.ok !== null); if (!m.length) return '';
  // зеленое «держится» только если измерены все три признака; иначе честно «оценено частично» (аудит, п. 6)
  const bad = m.filter(r => !r.ok).length, part = !bad && m.length < rows.length;
  return `<div class="pad" style="margin-top:16px"><div class="card"><div class="row" style="justify-content:space-between"><div><div class="eyebrow">Дыхание и давление в животе</div><h3 style="margin-top:4px;color:${bad ? 'var(--short-t)' : part ? 'var(--text)' : 'var(--ok-t)'}">${bad ? 'Давление не держится' : part ? `Оценено ${m.length} из ${rows.length}, отклонений нет` : 'Давление держится'}</h3></div>
    <details class="q"><summary aria-label="Что это">?</summary><div>Диафрагма, мышцы живота и тазового дна держат давление в животе, как корсет изнутри (Коларж). Если вдох делают плечи и шея, а не живот, корсет не работает (Левит). Тогда поясница проваливается под нагрузкой (Макгилл).</div></details></div>
    ${rows.map(r => `<div class="row" style="margin-top:12px;gap:10px"><span style="width:22px;height:22px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:${r.ok === null ? 'var(--surface-2)' : r.ok ? 'var(--ok-s)' : 'var(--short-s)'};color:${r.ok === null ? 'var(--faint)' : r.ok ? 'var(--ok-t)' : 'var(--short-t)'}">${r.ok === null ? '·' : r.ok ? ic('check', 's') : '!'}</span><span style="flex:1;font-size:15px">${r.name}</span><span style="font-size:14px;color:${r.ok === false ? 'var(--short-t)' : 'var(--sub)'};text-align:right">${r.val}</span></div>`).join('')}</div></div>`;
}
// проценты по состояниям: сколько гипертонуса, перерастяжения и слабости и как они делятся между сторонами.
// Клиенту сейчас не показываем: проценты состояния мышц похожи на медицинский вывод (docs/legal_texts/proposal_client_ui.md)
function balanceCard(all) {
  const sc = stateScores(all), rows = [['SHORT', 'Гипертонус'], ['HYPER', 'Перерастяжение'], ['WEAK', 'Слабость']].filter(([k]) => sc[k].all);
  if (!rows.length) return '';
  return `<div class="card"><div class="row" style="justify-content:space-between"><h3>Баланс мышц</h3><details class="q"><summary aria-label="Как считаем">?</summary><div>Процент по всем мышцам с этим состоянием, отдельно слева и справа. Чем больше разница сторон, тем сильнее перекос. Считаем по тестам движения; связи между мышцами по Янде, Шеррингтону, Майерсу, Шарман и Коларжу.</div></details></div>
    <div class="pct" style="margin-top:14px">${rows.map(([k, n]) => { const x = sc[k], c = TONE_HEX[k];
      return `<span class="row" style="gap:8px"><span class="mark sm ${k}"></span>${n}</span><span class="lr" aria-label="слева ${x.L}%, справа ${x.R}%"><i><b style="width:${x.L}%;background:${c}"></b></i><i><b style="width:${x.R}%;background:${c}"></b></i></span><span class="v">${x.all}%</span>
        <small><span>Л ${x.L}%</span><span>${Math.abs(x.asym) >= 10 ? `перекос ${x.asym > 0 ? 'вправо' : 'влево'} ${Math.abs(x.asym)}%` : 'стороны ровно'}</span><span>П ${x.R}%</span></small>`; }).join('')}</div></div>`;
}
// бета: оценка ЦНС по фоновым замерам (глаза, касания, набор) и подробная расшифровка: причины, развесовка по мышцам, что делать
function cnsCard(t, a) {
  if (SHARED || !isBetaMode() || !(t.vns || t.touch)) return '';
  const s = cnsScore(t); if (!s) return '';
  return `<div class="pad" style="margin-top:12px"><div class="card">${cnsScoreCard(t, { title: 'Оценка ЦНС · бета' })}
    <details class="acc" style="margin-top:12px"><summary style="font-weight:600;min-height:40px">Подробно: почему, развесовка, что делать</summary>
      <div style="margin-top:8px">${cnsDetail(t, a.findings, spots(a), spots(analyze({ ...t, vns: null, touch: null }, C)))}</div></details></div></div>`;
}
// Клиенту главное крупно и наглядно: что делать (укрепить, расслабить), где это на теле (мини-фигура с подсвеченной зоной)
// и с какого упражнения начать. Без чисел и анатомических названий; подробности в «Карте тела» и «Подробном обзоре».
// одна карточка = одна зона: «Укрепить · Ягодица сбоку справа»; до 4 карточек, сначала укрепить, потом мягко укрепить и расслабить
function tasksOf(top) { const by = ['WEAK', 'HYPER', 'SHORT'].map(k => { const l = top.filter(s => s.k === k && !s.ambiguous);
    return [...new Set(l.map(s => s.id))].map(id => { const items = l.filter(s => s.id === id), m = C.muscles[id];
      return { k, items, what: (m.zone || m.name) + ' ' + (items.length > 1 ? 'с двух сторон' : sideWord(items[0].side)) }; }); });
  // сначала по одной зоне каждого вида, затем вторые: так в четырех карточках видны и «укрепить», и «расслабить»
  const out = [...by.map(l => l[0]), ...by.map(l => l[1])].filter(Boolean).slice(0, 4);
  return ['WEAK', 'HYPER', 'SHORT'].flatMap(k => out.filter(x => x.k === k)); }
function taskCards(top) {
  const v = tasksOf(top); if (!v.length) return '';
  return `<div class="pad" style="margin-top:12px;display:flex;flex-direction:column;gap:10px">${v.map((x, i) => { const exs = plan(x.items).filter((id, j, l) => l.findIndex(y => y.replace(/_(left|right)$/, '') === id.replace(/_(left|right)$/, '')) === j).slice(0, 2);
    return `<div class="card task" style="display:flex;gap:12px;align-items:flex-start;padding:14px;border-left:4px solid ${TONE_HEX[x.k]}">
      <button class="tfig" data-i="${i}" aria-label="Показать на карте тела" style="border:0;background:var(--surface-2);border-radius:14px;padding:6px 4px;flex:none;cursor:pointer"><canvas data-i="${i}" style="width:76px;display:block"></canvas></button>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:${TONE_TEXT_HEX[x.k]}">${TONE[x.k][4]}</div>
        <div style="font-size:18px;font-weight:700;line-height:1.25;margin-top:2px">${esc(x.what)}</div>
        <div style="font-size:13px;color:var(--sub);line-height:1.4;margin-top:4px">${VERB_WHY[x.k]}</div>
        ${exs.length ? `<div style="display:flex;gap:8px;margin-top:10px">${exs.map(id => `<button class="tex" data-id="${id}" style="flex:0 0 calc(50% - 4px);min-width:0;border:0;background:var(--surface-2);border-radius:12px;padding:4px 4px 6px;font:inherit;color:inherit;cursor:pointer;text-align:center">${hasFigure(id) ? exFigure(id) : `<span class="round" style="margin:6px auto;background:var(--surface)">${ic('play', 's')}</span>`}<span style="display:block;font-size:12px;line-height:1.25;margin-top:2px">${esc(exLabel(ex(id)))}</span></button>`).join('')}</div>` : ''}</div></div>`; }).join('')}</div>`;
}
function bindTaskCards(top, a, all) {
  const v = tasksOf(top);
  app.querySelectorAll('.task canvas[data-i]').forEach(cv => { const x = v[+cv.dataset.i]; if (!x) return; const keys = new Set(x.items.map(s => s.key));
    const sp = all.map(s => keys.has(s.key) ? { ...s, tone: Math.sign(s.tone || 1), derived: false } : { ...s, k: 'OK', tone: 0 }), back = x.items.filter(s => s.back).length > x.items.length / 2;
    drawHeat(cv, sp, back, null, [], { reveal: false, halo: true }); });
  app.querySelectorAll('.task .tfig').forEach(b => b.onclick = () => { const x = v[+b.dataset.i]; if (!x) return;
    SEL = x.items[0].key; BACK = x.items[0].back; MAP_OPEN = true; map(); setTimeout(() => { const m = $('#mapacc'); if (m) m.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }, 50); });
  app.querySelectorAll('.task .tex').forEach(b => b.onclick = () => workout([b.dataset.id], reasonsOf([b.dataset.id], top)));
}
export function map() {
  setBodySex(SHARED ? 'M' : (PROFILE() || {}).sex); setSession(MODES.SELF);
  const cur = currentAnalysis(); if (!cur) return onboarding(); track('map_view');
  const { t, a } = cur; const all = applyMain(spots(a), cleanMain(t.main)); const top = t.main ? fromMain(all, cleanMain(t.main)) : mainOf(all);
  const reveal = REVEAL; REVEAL = false; if (reveal && top[0]) BACK = top[0].back;
  if (SEL && !all.some(s => s.key === SEL)) SEL = null;
  const pl = plan(top), why = reasonsOf(pl, top);
  const qs = Object.values(t.quality || {}), qa = qs.length ? Math.round(qs.reduce((x, y) => x + y, 0) / qs.length) : null;
  const nSteps = t.protocol ? rowsOf(t.protocol).length : Object.keys(t.moves || {}).length;
  const days = Math.floor((Date.now() - t.date) / 864e5);
  go(`<div class="scr fade">
   ${!SHARED && INV() ? sentBanner(t) + retestCard() : ''}
   ${!SHARED && SHOW_T && tests().length && SHOW_T !== tests().at(-1).date ? `<div class="pad" style="padding-top:12px"><button class="card row" id="toLast" style="width:100%;border:0;font:inherit;font-size:14px;cursor:pointer;color:inherit">${ic('info', 's')}<span style="flex:1;text-align:left">Это тест из истории</span><b style="color:var(--brand)">К последнему</b></button></div>` : ''}
   ${SHARED ? `<div class="pad" style="padding-top:12px"><div class="card row" style="font-size:14px">${ic('info', 's')}<span>Это результат по ссылке. Ваши данные не меняются.</span></div></div>` : ''}
   <div class="pad row" style="padding-top:16px;align-items:flex-start"><div style="flex:1;min-width:0"><div class="eyebrow">${new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · ${nSteps} ${plural3(nSteps, 'шаг', 'шага', 'шагов')}${qa != null ? ' · качество ' + qa : ''}</div><h1 style="margin-top:6px">Что мы нашли</h1></div></div>
   ${mainLine(top, a)}
   ${days >= 7 && !SHARED ? `<div class="pad"><button class="row-link" id="re" style="color:var(--focus);font-weight:600"><span>Прошла неделя: пройдите быстрый тест и сравните</span>${ic('chevron-right', 's')}</button></div>` : ''}
   <div class="pad" style="margin-top:12px"><details class="acc card" id="mapacc" style="border-radius:var(--r-xl);padding:12px 8px 8px"${MAP_OPEN || !top.length ? ' open' : ''}><summary style="font-weight:600;min-height:40px;padding:0 8px">Карта тела</summary>
     <div class="seg" style="margin:8px 4px 0"><button id="vf" class="${!BACK && !MODE3D ? 'on' : ''}">Спереди</button><button id="vb" class="${BACK && !MODE3D ? 'on' : ''}">Сзади</button>${device.webgl2 ? `<button id="v3" class="${MODE3D ? 'on' : ''}">3D</button>` : ''}</div>
     <div id="vis" style="position:relative;margin:8px auto 0;width:min(100%,360px);${MODE3D ? 'height:420px' : ''}">${MODE3D ? '' : '<canvas id="heat" style="width:100%;display:block;cursor:pointer"></canvas>'}</div>
     <div class="row" style="justify-content:center;gap:12px;flex-wrap:wrap;margin:10px 4px 0;font-size:13px;color:var(--sub)">${['SHORT', 'HYPER', 'WEAK'].filter(k => top.some(x => x.k === k)).map(k => `<span class="row" style="gap:6px"><span class="mark sm ${k}"></span>${TONE[k][3]}</span>`).join('')}${top.length ? TONE_HELP() : ''}</div>
     ${MODE3D ? `<details class="acc" style="margin:8px 8px 0;font-size:14px"><summary style="font-weight:600;min-height:40px">Слои и зоны</summary>
       <div class="row" id="lay" style="gap:6px;flex-wrap:wrap;justify-content:center;margin-top:6px"><button class="pill on" data-l="">Все слои</button>${LAYER_NAMES.map(([l, n]) => `<button class="pill" data-l="${l}">${n} · ${top.filter(x => layerOf(x.id) === l).length}</button>`).join('')}</div>
       <div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px">${[['all', 'Всё тело'], ['head', 'Шея'], ['shoulders', 'Плечи'], ['back', 'Спина'], ['pelvis', 'Таз'], ['knees', 'Колени'], ['feet', 'Стопы']].map(([z, n]) => `<button class="pill" data-z="${z}">${n}</button>`).join('')}</div></details>` : ''}
     <div id="selbox" style="margin:8px 4px 0"></div></details></div>
   ${taskCards(top)}
   ${top.length ? '' : `<div class="pad" style="margin-top:16px">${verdictCard(top, a.findings, 'Сильных перекосов не видно', [], true)}</div>`}
   ${cnsCard(t, a)}
   <div class="pad row" style="margin-top:12px;gap:16px"><button class="link" id="more">${ic('file-text', 's')} Подробный обзор</button><button class="link" id="lrs">${ic('arrow-right-left', 's')} Левая и правая</button></div>
   <div class="pad row" style="margin-top:12px;gap:8px;font-size:12px;color:var(--sub)">${ic('cpu', 's')}<span>Посчитано на телефоне. Оценка движения, не диагноз</span></div>
   <div class="dock">${pl.length ? `<button class="btn" id="plan">${ic('play', 's')}Комплекс на сегодня · ${totalMin(pl.map(ex))} мин</button>` : `<button class="btn" id="again">${ic('rotate-ccw', 's')}${SHARED ? 'Пройти свой тест' : 'Пройти тест заново'}</button>`}${clientNav('home')}</div></div>`);
  if (device.webgl2 && !device.weak && !device.wv) preload3D();
  // подписи: зона и короткий замер цветом состояния
  const labels = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 4)).map(s => ({ key: s.key, title: C.muscles[s.id].zone + (s.side === 'RIGHT' ? ' · П' : ' · Л'), sub: toneText(s, 3).replace('похоже, ', ''), color: TONE_HEX[s.k], text: TONE_TEXT_HEX[s.k] }));
  let h2d = null, first = reveal;
  // на схеме и в 3D один и тот же набор: главные зоны итога (до 8) и выбранная; остальное серым
  const focusK = new Set([...top.map(x => x.key), SEL].filter(Boolean)), today = SHARED ? new Set() : workedToday(), focus = () => all.map(x => focusK.has(x.key) || x.key === SEL ? x : { ...x, k: 'OK', tone: 0 });
  const draw2d = () => { if (!MODE3D) { h2d = drawHeat($('#heat'), focus(), BACK, SEL, labels, { reveal: first }); first = false; } };
  const renderSel = () => { const x = all.find(q => q.key === SEL); const box = $('#selbox'); if (!box) return;
    box.innerHTML = x ? `<div class="group fade" style="padding:var(--s4);background:var(--surface-2)"><div class="row" style="gap:8px"><span class="mark ${x.k}"></span><span style="font-size:13px;font-weight:600;color:${TONE[x.k][5]}">${x.ambiguous ? 'Неоднозначно' : TONE[x.k][0]}</span></div>
        <div style="font-size:17px;font-weight:700;margin-top:6px;line-height:1.25">${title(x)}</div><div style="font-size:13px;color:var(--sub);margin-top:2px">${tech(x)}</div>
        <div class="why" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:13px;color:var(--sub)">${seen(a, x)[0] ? `<span class="src">ЗАМЕР</span><span>${esc(seen(a, x)[0].replace(' (на границе нормы)', ''))}</span>${/на границе нормы/.test(seen(a, x)[0]) ? '<span class="edge">на границе нормы</span>' : ''}` : x.k === 'OK' ? 'Здесь все в порядке' : '<span class="src hyp">ГИПОТЕЗА</span><span>Напрямую не измерено</span>'}</div>
        ${x.k !== 'OK' ? `<button class="btn line" id="what" style="height:48px;margin-top:12px">Что делать ${ic('chevron-right', 's')}</button>` : ''}</div>` : '';
    const w = $('#what'); if (w) w.onclick = () => muscle(SEL); };
  const pick = (k, from3d) => { SEL = k; if (!all.some(q => q.key === k)) { const [id, sd] = k.split(':'), b = spotFor(id, sd); if (b) all.push(b); }
    const x = all.find(q => q.key === k); if (x && x.back !== BACK && !MODE3D) { BACK = x.back; setView(); } draw2d(); renderSel();
    if (from3d) muscleInfo(k, all, a, { onWhat: () => muscle(k) }); };
  const setView = () => { $('#vf').classList.toggle('on', !BACK && !MODE3D); $('#vb').classList.toggle('on', BACK && !MODE3D); if (view3d) view3d.turn(BACK); draw2d(); };
  if (!MODE3D) { draw2d(); $('#heat').onclick = e => { const x = h2d && h2d.hit(e.clientX, e.clientY); if (x) pick(x.key); }; }
  else body3D($('#vis'), focus(), k => pick(k, true), { reveal: true, arrows: true, onTurn: b => { BACK = b; } }).then(v => { view3d = v; v.turn(BACK); app.querySelectorAll('[data-z]').forEach(b => b.onclick = () => v.focus(b.dataset.z));
    app.querySelectorAll('#lay [data-l]').forEach(b => b.onclick = () => { app.querySelectorAll('#lay [data-l]').forEach(x => x.classList.toggle('on', x === b)); v.only(b.dataset.l ? new Set(LAYERS[b.dataset.l]) : null); }); });
  renderSel();
  $('#vf').onclick = () => { if (MODE3D) { MODE3D = false; BACK = false; return map(); } BACK = false; setView(); };
  $('#vb').onclick = () => { if (MODE3D) { MODE3D = false; BACK = true; return map(); } BACK = true; setView(); };
  if ($('#v3')) $('#v3').onclick = () => { if (!MODE3D) { MODE3D = true; map(); } };
  // карту можно свернуть: при раскрытии перерисовываем (в свернутом блоке у холста нулевая ширина)
  $('#mapacc').addEventListener('toggle', () => { const was = MAP_OPEN; MAP_OPEN = $('#mapacc').open; if (MAP_OPEN && !was) { if (MODE3D) map(); else draw2d(); } });
  bindTaskCards(top, a, all);
  if ($('#plan')) $('#plan').onclick = () => durationSheet(top, pl, why);
  if ($('#again')) $('#again').onclick = again;
  if ($('#re')) $('#re').onclick = () => { FULL = false; prep(); };
  if ($('#resend')) $('#resend').onclick = async () => { const p = await outbox.get().catch(() => null); if (p) sendResult(p); }; bindRetestCard(); if (!SHARED && INV()) addSpecHint();
  if ($('#mainl')) $('#mainl').onclick = () => mainSheet(top, a, pl.length ? () => durationSheet(top, pl, why) : null);
  bindClientNav(); if ($('#set')) $('#set').onclick = settings; $('#more').onclick = () => moreSheet(cur, top, !!pl.length); $('#lrs').onclick = () => moreSheet(cur, top, !!pl.length, 'lr'); if ($('#rec')) $('#rec').onclick = async () => { const p = await consumerPoses.get(); motionViewer(p, t.setup, map, 'Тест ' + new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })); }; if ($('#cab')) $('#cab').onclick = () => { SHOW_T = null; clientHome(); }; if ($('#toLast')) $('#toLast').onclick = () => { SHOW_T = null; map(); };
  // бета и калибровка: сразу после свежего теста короткая анкета «как прошло, что мешало» (один раз на тест)
  if (!SHARED && reveal && Date.now() - t.date < 30 * 60e3 && (isBetaMode() || (INV() || {}).cal)) setTimeout(() => { if (document.getElementById('heat') || document.getElementById('vis')) testSurvey(String(t.date), { cal: !!(INV() || {}).cal, steps: (t.protocol || []).length }); }, 30000);
}
// одна человеческая фраза итога сверху: главное наблюдение движения, без диагноза (спецификация UXUI, раздел 5)
// простые слова по правилу: что это, как ощущается, почему, что даст комплекс (data/plain.json)
const plainOf = f => f && f.rule && C.plain ? C.plain[f.rule.id.replace(/_[rl]$/, '')] || null : null;
function mainLine(top, a) {
  const v = verdict(top, a.findings)[0], f = v && v.f, pl = plainOf(f), obs = f ? f.observed.replace(' (на границе нормы)', '') : '';
  if (!f) return `<div class="pad" style="margin-top:12px"><div class="main-line"><b>Явных перекосов не видно</b><span>Тело двигается ровно. Повторите тест через месяц.</span></div></div>`;
  return `<div class="pad" style="margin-top:12px"><button class="main-line" id="mainl" aria-label="Подробнее: что это значит">
    <span class="ml-k">Главное</span><b>${esc(pl ? pl.title : obs)}</b>${pl && pl.feel ? `<span class="ml-feel">Отсюда может быть: ${esc(pl.feel.slice(0, 2).map(lc).join(', '))}</span>` : ''}
    ${pl ? `<span class="ml-obs">${ic('camera', 's')}${esc(obs.replace(/ на \d+(?:[.,]\d+)?\s*(?:°|%|мм|см)?/g, ''))}</span>` : ''}<span class="ml-more">Узнаете себя? Почему так и что делать ${ic('chevron-right', 's')}</span></button></div>`;
}
// шторка по главной находке: узнаете ли вы это, почему так, что даст комплекс; в конце кнопка комплекса
function mainSheet(top, a, start) {
  const v = verdict(top, a.findings, true), f = v[0] && v[0].f; if (!f) return; const pl = plainOf(f), obs = f.observed.replace(' (на границе нормы)', '');
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><button class="sheet-x" aria-label="Закрыть">✕</button><div class="eyebrow">Главное в вашем тесте</div><h2 style="margin-top:6px">${esc(pl ? pl.title : obs)}</h2>
    <div class="ml-obs light">${ic('camera', 's')}Камера увидела: ${esc(obs)}</div>
    ${pl && pl.feel ? `<div class="ms-block"><div class="ms-h">${ic('user', 's')}Узнаете себя?</div>${pl.feel.map(x => `<p class="ms-feel">${ic('check', 's')}${esc(x)}</p>`).join('')}
      <div class="row" id="msrec" style="gap:8px;margin-top:12px"><button class="pill" data-r="yes">Да, похоже</button><button class="pill" data-r="no">Не замечал(а)</button></div></div>` : ''}
    <div class="ms-block"><div class="ms-h">${ic('info', 's')}Почему так</div><p>${esc(pl ? pl.why : f.meaning || '')}</p></div>
    <div class="ms-block"><div class="ms-h">${ic('activity', 's')}Что даст комплекс</div><p>${esc(pl ? pl.gain : '')}</p><p class="sub" style="font-size:14px">Упражнения подобраны под ваш тест: 3–5 минут в день. Первые изменения обычно заметны через 2–3 недели, повторный тест покажет их в цифрах.</p></div>
    <p class="sub" style="font-size:13px;margin-top:12px">Это наблюдение движения, не диагноз. Если что-то болит, покажитесь врачу или специалисту.</p>
    ${start ? `<button class="btn" id="msgo" style="margin-top:16px">${ic('play', 's')}Начать комплекс</button>` : ''}</div>`;
  document.body.appendChild(d); const close = () => d.remove(); d.onclick = e => { if (e.target === d) close(); }; d.querySelector('.sheet-x').onclick = close;
  // «узнаете себя» без имени уходит в аналитику: так копится, какие находки люди подтверждают сами
  d.querySelectorAll('#msrec [data-r]').forEach(b => b.onclick = () => { track('main_recognize', { c: f.rule.id, r: b.dataset.r }, false); d.querySelector('#msrec').innerHTML = `<span class="sub" style="font-size:14px">${b.dataset.r === 'yes' ? 'Значит, комплекс как раз для вас.' : 'Спасибо, это помогает настроить точность.'}</span>`; });
  if (start) d.querySelector('#msgo').onclick = () => { close(); start(); };
}
/** Нижнее меню клиента: итог, история, поделиться, профиль. */
export function clientNav(on) {
  const items = SHARED ? [['home', 'activity', 'Результат'], ['shr', 'share', 'Поделиться']] : [['home', 'activity', 'Результат'], ['cab', 'clock', 'Прогресс'], ['shr', 'share', 'Поделиться'], ['set', 'user', 'Профиль']];
  return `<nav class="bnav" aria-label="Разделы">${items.map(([id, i, n]) => `<button id="${id === on ? 'nav-on' : id}" data-nav="${id}"${id === on ? ' aria-current="page"' : ''}>${ic(i, 's')}<span>${n}</span></button>`).join('')}</nav>`;
}
function bindClientNav() {
  app.querySelectorAll('[data-nav]').forEach(b => { if (b.getAttribute('aria-current')) return; const k = b.dataset.nav;
    b.onclick = k === 'home' ? () => { SHOW_T = null; tests().length ? map() : onboarding(); } : k === 'cab' ? () => { SHOW_T = null; clientHome(); } : k === 'set' ? settings : shareResult; });
}
// выбор длительности комплекса перед стартом
function durationSheet(top, pl, why) {
  const d = document.createElement('div'); d.className = 'sheet'; const w = workedToday();
  d.innerHTML = `<div><h2>Сколько времени есть?</h2>${w.size ? '<p class="sub" style="font-size:14px;margin-top:6px">Начнем с зон, которые сегодня не прорабатывали</p>' : ''}
    <button class="btn" id="dq" style="margin-top:20px">Начать · ${totalMin(pl.map(ex))} мин</button>
    <div class="eyebrow" style="margin-top:20px;text-align:center">или дольше</div><div class="seg" style="margin-top:8px">${[15, 30, 45, 60].map(m => `<button data-m="${m}">${m} мин</button>`).join('')}</div></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('#dq').onclick = () => { d.remove(); workout(pl, why); };
  d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { d.remove(); const ids = planFor(top, +b.dataset.m); track('plan_minutes', { c: b.dataset.m }, false); workout(ids, reasonsOf(ids, top)); });
}
function again() { if (!SHARED && INV()) return INV().join ? joinForm() : inviteWelcome(); if (SHARED) { SHARED = null; history.replaceState(null, '', location.pathname); } FULL = false; tests().length || SHARED ? prep() : onboarding(); }
// всё, что не нужно для решения «что делать сегодня», живет в шторке «Подробнее»
function moreSheet({ t, a }, top, hasPlan, only) {
  const all_t = SHARED ? [] : tests().filter(x => x.snapshot), first = all_t[0];
  const acc = (h, body, open = false) => `<details class="acc" style="margin-top:var(--s3)"${open ? ' open' : ''}><summary style="font-weight:600;font-size:16px">${h}</summary><div style="margin-top:4px">${body}</div></details>`;
  const d = document.createElement('div'); d.className = 'sheet'; const close = () => d.remove();
  // «Стороны»: та же мышца слева и справа, полосой; сверху проценты по состояниям
  if (only === 'lr') { const sp = applyMain(spots(a), cleanMain(t.main)).filter(x => x.k !== 'OK'), ids = [...new Set(sp.map(x => x.id))];
    const rows = ids.map(id => { const l = sp.find(x => x.id === id && x.side === 'LEFT'), r = sp.find(x => x.id === id && x.side === 'RIGHT'), v = x => x ? Math.round(Math.min(1, Math.abs(x.tone)) * 100) : 0;
      return { id, l, r, L: v(l), R: v(r), k: (l && r ? (Math.abs(l.tone) >= Math.abs(r.tone) ? l : r) : l || r).k }; }).filter(x => Math.abs(x.L - x.R) >= 10).sort((x, y) => Math.abs(y.L - y.R) - Math.abs(x.L - x.R)).slice(0, 8);
    const bar = (v, c, right) => `<i style="flex:1;height:10px;border-radius:5px;background:var(--surface-2);position:relative;overflow:hidden"><b style="position:absolute;top:0;bottom:0;${right ? 'left' : 'right'}:0;width:${v}%;background:${c};border-radius:5px"></b></i>`;
    d.innerHTML = `<div><h2>Левая и правая сторона</h2>
      ${rows.length ? `<div class="card" style="margin-top:var(--s3)"><div class="row" style="font-size:12px;color:var(--sub)"><span style="flex:1">Зона и задача</span><b style="width:34%;text-align:center">Л</b><b style="width:34%;text-align:center">П</b></div>
        ${rows.map(x => `<div style="margin-top:12px"><div style="font-size:14px">${esc(C.muscles[x.id].zone || C.muscles[x.id].name)} · ${TONE[x.k][3]}</div><div class="row" style="gap:4px;margin-top:4px"><span class="mark sm ${x.k}"></span>${bar(x.L, TONE_HEX[x.k])}${bar(x.R, TONE_HEX[x.k], true)}</div></div>`).join('')}</div>`
      : '<p class="sub" style="margin-top:var(--s4)">Стороны работают ровно: разница меньше 10%.</p>'}
      <button class="btn" id="mx" style="margin-top:var(--s4)">Закрыть</button></div>`;
    document.body.appendChild(d); d.onclick = e => { if (e.target === d) close(); }; d.querySelector('#mx').onclick = close; return; }
  // первый тест: сравнивать не с чем, он сам становится точкой отсчета
  const dd = x => new Date(x.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const word = (x, y) => !Number.isFinite(x) || !Number.isFinite(y) ? '' : Math.abs(y) < Math.abs(x) - .5 ? '<span style="color:var(--ok-t);font-size:13px;font-weight:600">ровнее</span>' : Math.abs(y) > Math.abs(x) + .5 ? '<span style="color:var(--over-t);font-size:13px;font-weight:600">сильнее</span>' : '<span class="sub" style="font-size:13px">так же</span>';
  const ba = all_t.length >= 2 && first !== t ? acc('Было → стало', baBlock('ba3d') + `<p class="sub" style="font-size:13px;margin-top:6px">Первый тест ${dd(first)} → этот тест ${dd(t)}.${t.snapshot && first.snapshot ? ' Меньше градусов: тело стоит ровнее.' : ''}</p>` + (!(t.snapshot && first.snapshot) ? [] : [['Наклон плеч', first.snapshot.shoulderTilt, t.snapshot.shoulderTilt], ['Наклон таза', first.snapshot.pelvicTilt, t.snapshot.pelvicTilt]].map(([n, x, y]) => `<div class="row" style="margin-top:10px;gap:8px"><span style="flex:1;font-size:15px">${n}</span><s style="color:var(--sub)">${fmt(x)}°</s>${ic('chevron-right', 's')}<b style="font-size:20px">${fmt(y)}°</b>${word(x, y)}</div>`)).join(''))
    : acc('Было → стало', `<p style="font-size:15px;line-height:1.45;margin-top:6px">${SHARED ? 'Сравнение появится после следующего теста.' : 'Это ваш первый тест: он станет точкой отсчета. Пройдите тест снова через 2–4 недели, и здесь будет видно, что изменилось.'}</p>`);
  const lim = t.limits && Object.keys(t.limits).length ? acc('Не получилось выполнить', Object.entries(t.limits).map(([u, l]) => `<div style="margin-top:8px;font-size:14px"><b>${esc(LIMIT_NAMES[u] || u)}</b>: ${esc([l.level, ...(l.reasons || [])].filter(Boolean).join(', '))}</div>`).join('')) : '';
  const zones = top.length ? acc(`Все зоны · ${top.length}`, `<div class="stack" style="margin-top:6px">${top.map(s => `<div class="list-item" data-k="${s.key}" style="background:var(--bg);min-height:52px"><span class="mark ${s.k}"></span><div style="flex:1;min-width:0"><b style="font-size:15px">${title(s)}</b></div><span class="chev">${ic('chevron-right', 's')}</span></div>`).join('')}</div>`, true) : '';
  const row = (id, icon, text) => `<button class="row-link" id="${id}">${ic(icon, 's')}<span>${text}</span>${ic('chevron-right', 's chev')}</button>`;
  d.innerHTML = `<div><h2>Обзор</h2>${zones}${ba}${lim}<div style="margin:0 calc(-1 * var(--gutter))">${postureCard(a)}${iapCard(a)}</div>
    ${acc('Действия', `<div class="group">${row('shareRes', 'share', 'Поделиться результатом')}${top.length && !SHARED ? row('cal', 'bell', 'Напоминать в 20:00') : ''}${hasPlan ? row('again', 'rotate-ccw', SHARED ? 'Пройти свой тест' : 'Пройти тест заново') : ''}${INV() ? '' : `<a class="row-link" href="${bot()}" target="_blank">${ic('message-square', 's')}<span>Разобрать с автором методики</span>${ic('chevron-right', 's chev')}</a>`}</div>`)}
    ${SHARED ? '' : `<div style="margin-top:var(--s3)">${rateCard(String(t.date))}</div>`}
    <button class="btn" id="mx" style="margin-top:var(--s4)">Закрыть</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) close(); };
  const q = s => d.querySelector(s);
  { const bx = q('#ba3d'), det = bx && bx.closest('details'); if (det) det.addEventListener('toggle', () => { if (det.open) bindBa('ba3d', first, t); }); }
  q('#mx').onclick = close; bindRate('map'); bindPosture(a);
  d.querySelectorAll('.list-item[data-k]').forEach(el => el.onclick = () => { close(); muscle(el.dataset.k); });
  q('#shareRes').onclick = () => { close(); shareResult(); };
  if (q('#cal')) q('#cal').onclick = calendar;
  if (q('#again')) q('#again').onclick = () => { close(); again(); };
}
async function shareResult() {
  track('share_result');
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Поделиться результатом</h2><p class="sub" style="font-size:14px;margin-top:6px">Другу, специалисту или себе на компьютер.</p>
    <button class="btn" id="sl" style="margin-top:16px">Ссылкой на карту</button>
    <p style="font-size:12px;color:var(--sub);margin:6px 4px 0">Откроется та же карта с разбором. Результат упакован в саму ссылку и на сервер не уходит, но открыть карту сможет любой, у кого есть ссылка.</p>
    <button class="btn line" id="si" style="margin-top:14px">Картинкой</button>
    <p style="font-size:12px;color:var(--sub);margin:6px 4px 0">Карта тела, главные зоны и сравнение сторон одним изображением.</p>
    <button class="btn ghost" id="sc" style="margin-top:8px">Отмена</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('#sc').onclick = () => d.remove();
  const when = new Date(currentAnalysis().t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  d.querySelector('#sl').onclick = async () => { const url = await resultLink(), text = `Моя карта тела BodyPassport от ${when}:`;
    if (navigator.share) navigator.share({ title: 'BodyPassport', text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url); toast('Ссылка скопирована'); } d.remove(); };
  d.querySelector('#si').onclick = async () => { d.querySelector('#si').textContent = 'Готовлю картинку…'; const blob = await resultImage(); const file = new File([blob], 'bodypassport.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'BodyPassport', text: 'Моя карта тела' }).catch(() => {});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bodypassport.png'; a.click(); } d.remove(); };
}

// ---------- картинки-отчеты (1080 px): общая верстка для клиента и специалиста ----------
// sections: [{ h, rows: [{ k?, text, col? }] }], delta: { name, was, now, u, state }, footer: { name, contact }
/** График боли 0–10 до и после занятий: пары столбиков по последним занятиям. Возвращает новую высоту. */
export function vasChart(g, list, x, y, w, h) {
  const n = Math.min(14, list.length), L = list.slice(-n), gap = 18, bw = Math.min(64, (w - 70 - gap * (n - 1)) / n / 2), base = y + h - 46, k = (h - 80) / 10;
  g.strokeStyle = '#E2E0DA'; g.lineWidth = 2; g.font = '500 26px "JetBrains Mono", monospace'; g.fillStyle = '#868B93';
  for (const v of [0, 5, 10]) { const yy = base - v * k; g.beginPath(); g.moveTo(x + 50, yy); g.lineTo(x + w, yy); g.stroke(); g.fillText(String(v), x, yy + 9); }
  L.forEach((r, i) => { const x0 = x + 60 + i * (bw * 2 + gap);
    g.fillStyle = '#C9CCD1'; g.fillRect(x0, base - r.pre * k, bw - 2, r.pre * k);
    g.fillStyle = r.post < r.pre ? '#15803D' : r.post > r.pre ? '#EF4444' : '#566079'; g.fillRect(x0 + bw, base - r.post * k, bw - 2, r.post * k); });
  g.font = '400 30px Manrope, sans-serif'; g.fillStyle = '#C9CCD1'; g.fillRect(x + 60, base + 22, 24, 24); g.fillStyle = '#566079'; g.fillText('до занятия', x + 94, base + 44);
  g.fillStyle = '#15803D'; g.fillRect(x + 330, base + 22, 24, 24); g.fillStyle = '#566079'; g.fillText('после', x + 364, base + 44);
  return y + h + 12;
}
export async function passportImage({ eyebrow, name, date, sp, sections = [], delta = null, footer, raw = false }) {
  await ready3D().catch(() => {}); // в отчете та же реалистичная модель, что и на экране
  const W = 1080, M = 72, cv = document.createElement('canvas'); cv.width = W; cv.height = 4200; const g = cv.getContext('2d');
  await document.fonts.ready; try { await document.fonts.load('500 32px "JetBrains Mono"'); } catch (e) {}
  g.fillStyle = '#F5F6FA'; g.fillRect(0, 0, W, cv.height);
  let y = M + 32; g.fillStyle = '#566079'; g.font = '500 32px "JetBrains Mono", monospace'; g.fillText(eyebrow, M, y);
  // логотип специалиста в правом верхнем углу, вписан в квадрат 110 px над именем
  if (footer && footer.logo) { try { const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = footer.logo; });
    const k = Math.min(110 / im.width, 110 / im.height), lw = im.width * k, lh = im.height * k; g.drawImage(im, W - M - lw, 28 + (110 - lh) / 2, lw, lh); } catch (e) {} }
  // имя целиком: шрифт уменьшается до 56 px, дальше многоточие; справа место под логотип
  { const maxW = W - M * 2 - (footer && footer.logo ? 140 : 0); let fs = 84, t = String(name).slice(0, 60); g.fillStyle = '#0B1B3B';
    const fit = () => { g.font = `700 ${fs}px Manrope, sans-serif`; return g.measureText(t).width <= maxW; };
    while (!fit() && fs > 56) fs -= 4; while (!fit() && t.length > 4) t = t.slice(0, -2).trimEnd() + '…';
    y += 96; g.fillText(t, M, y); }
  y += 56; g.fillStyle = '#566079'; g.font = '400 40px Manrope, sans-serif'; g.fillText(date, M, y);
  // две карты в белых плитках
  y += 48; const tw = (W - M * 2 - 24) / 2, th = tw * 1.45;
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px'; document.body.appendChild(holder);
  for (const [i, back] of [[0, false], [1, true]]) { const x = M + i * (tw + 24); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, tw, th, 48); g.fill();
    const hc = document.createElement('canvas'); hc.style.width = '200px'; holder.appendChild(hc); drawHeat(hc, sp, back, null, [], { reveal: false });
    const ih = th - 120, iw = ih * hc.width / hc.height; g.drawImage(hc, x + (tw - iw) / 2, y + 40, iw, ih);
    g.fillStyle = '#566079'; g.font = '500 32px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillText(back ? 'СЗАДИ' : 'СПЕРЕДИ', x + tw / 2, y + th - 32); g.textAlign = 'left'; }
  holder.remove(); y += th + 24; const breaks = [y]; // где можно резать на страницы PDF: между блоками, а не внутри
  const wrap = (t, x0, size, weight, col, lh = 1.3) => { g.font = `${weight} ${size}px Manrope, sans-serif`; g.fillStyle = col; let cur = '';
    for (const w of String(t).split(' ')) { const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > W - x0 - M && cur) { y += size * lh; g.fillText(cur, x0, y); cur = w; } else cur = tt; }
    if (cur) { y += size * lh; g.fillText(cur, x0, y); } };
  for (const sec of sections) { if (!sec.rows.length && !(sec.chart && sec.chart.length)) continue; breaks.push(y + 12); y += 64; g.fillStyle = '#0B1B3B'; g.font = '700 46px Manrope, sans-serif'; g.fillText(sec.h, M, y); y += 8;
    if (sec.chart && sec.chart.length) { y += 24; y = vasChart(g, sec.chart, M, y, W - M * 2, 300); }
    for (const [ri, r] of sec.rows.entries()) { if (ri) breaks.push(y + 10); y += 16; const y0 = y; if (r.k) { const fs = r.small ? 40 : 56; wrap(r.text, M + 72, fs, r.bold ? 700 : 400, '#0B1B3B', 1.25); drawMark(g, M + 26, y0 + (r.small ? 26 : 36), r.k, { scale: r.small ? 1.7 : 2.2 }); }
      else wrap(r.text, M, 40, 400, r.col || '#0B1B3B'); } }
  if (delta) { breaks.push(y + 16); y += 72; g.fillStyle = '#0B1B3B'; g.font = '700 46px Manrope, sans-serif'; g.fillText(delta.h, M, y); y += 40;
    g.fillStyle = '#566079'; g.font = '400 40px Manrope, sans-serif'; g.fillText(delta.name, M, y + 10); y += 150;
    g.fillStyle = '#868B93'; g.font = '400 68px Manrope, sans-serif'; const was = fmt(delta.was) + delta.u; g.fillText(was, M, y); const wx = M + g.measureText(was).width + 32;
    g.font = '400 56px Manrope, sans-serif'; g.fillText('→', wx, y - 6); g.fillStyle = '#0B1B3B'; g.font = '600 132px Manrope, sans-serif'; g.fillText(fmt(delta.now) + delta.u, wx + 90, y + 18);
    if (delta.note) { y += 70; g.fillStyle = delta.state === 'better' ? '#15803D' : delta.state === 'worse' ? '#B42323' : '#566079'; g.font = '600 40px Manrope, sans-serif'; g.fillText(delta.note, M, y); } }
  for (const extra of footer.after || []) { breaks.push(y + 16); y += 72; g.fillStyle = '#0B1B3B'; g.font = '700 46px Manrope, sans-serif'; g.fillText(extra.h, M, y); y += 8; wrap(extra.text, M, 40, 400, '#0B1B3B'); }
  // оговорка на каждой картинке: картинку пересылают дальше, а подпись под ней ставит специалист
  breaks.push(y + 16); y += 64; wrap(footer.note || 'Предварительная оценка движения по камере телефона, не медицинское заключение.', M, 30, 400, '#566079');
  // подвал: фото, имя, специализация, контакты. brand: 'pro' (свой бренд, «Powered by» мелко), 'free' (плашка «Сформировано в BodyPassport»)
  const T = footer.title ? 1 : 0, FH = 220 + T * 44, H = y + M + FH, out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d'); o.drawImage(cv, 0, 0);
  o.fillStyle = '#0B1B3B'; o.fillRect(0, H - FH, W, FH);
  // фото специалиста в кружке слева от имени
  let tx = M; if (footer.photo) { try { const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = footer.photo; });
    const D = 132, cx = M + D / 2, cy = H - FH + 92 + T * 14; o.save(); o.beginPath(); o.arc(cx, cy, D / 2, 0, Math.PI * 2); o.clip(); o.drawImage(im, M, cy - D / 2, D, D); o.restore();
    o.strokeStyle = 'rgba(255,255,255,.35)'; o.lineWidth = 3; o.beginPath(); o.arc(cx, cy, D / 2, 0, Math.PI * 2); o.stroke(); tx = M + D + 28; } catch (e) {} }
  o.fillStyle = '#fff'; o.font = '700 46px Manrope, sans-serif'; o.fillText(String(footer.name).slice(0, tx > M ? 30 : 36), tx, H - FH + 76);
  if (T) { o.fillStyle = '#B6BED0'; o.font = '400 34px Manrope, sans-serif'; o.fillText(String(footer.title).slice(0, tx > M ? 40 : 48), tx, H - FH + 122); }
  if (footer.contact) { o.fillStyle = '#D0D3D8'; o.font = '400 38px Manrope, sans-serif'; o.fillText(String(footer.contact).slice(0, tx > M ? 36 : 44), tx, H - FH + 128 + T * 44); }
  if (footer.brand === 'free') { const t = 'Сформировано в BodyPassport'; o.font = '600 28px Manrope, sans-serif'; const w = o.measureText(t).width + 36;
    o.fillStyle = '#0B1B3B'; o.beginPath(); o.roundRect(M, H - 66, w, 46, 12); o.fill(); o.fillStyle = '#FFFFFF'; o.fillText(t, M + 18, H - 33);
    o.fillStyle = '#B6BED0'; o.font = '400 26px Manrope, sans-serif'; o.fillText('бесплатный тест движения: ' + location.host, M + w + 18, H - 33); }
  else { o.fillStyle = footer.brand === 'pro' ? '#6E737B' : '#B6BED0'; o.font = `400 ${footer.brand === 'pro' ? 24 : 30}px Manrope, sans-serif`;
    o.fillText(footer.brand === 'pro' ? 'Powered by BodyPassport' : 'BodyPassport · методика Р. Аюпова · оценка движения', M, H - 36); }
  if (raw) { out.breaks = breaks; return out; }
  return new Promise(r => out.toBlob(r, 'image/png'));
}
async function resultImage() {
  const { t, a } = currentAnalysis(); const all = applyMain(spots(a), cleanMain(t.main)); const top = t.main ? fromMain(all, cleanMain(t.main)) : mainOf(all);
  const v = verdict(top, a.findings), pl = plan(top);
  return passportImage({ eyebrow: 'КАРТА ТЕЛА', name: 'Моя карта тела', date: new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }), sp: all,
    sections: [{ h: 'Что делаем', rows: v.map(x => ({ k: x.k, text: `${x.verb} ${x.what}` })) }, { h: 'Комплекс', rows: pl.slice(0, 4).map(id => ({ text: '• ' + exLabel(ex(id)) })) }],
    footer: { name: 'Пройди свой тест', contact: location.host } });
}

function share() { const url = appLink();
  const text = 'Тест осанки и движения по камере телефона, 2–5 минут. Подсказывает, что растянуть и что укрепить, и дает упражнения. Бесплатно:';
  if (navigator.share) navigator.share({ title: 'BodyPassport', text, url }).catch(() => {}); else { navigator.clipboard.writeText(text + ' ' + url); toast('Ссылка скопирована'); } }
function calendar() { // напоминание без сервера: событие в календаре телефона, каждый день в 20:00
  const d = new Date(); d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
  const p = n => String(n).padStart(2, '0'); const dt = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T200000`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyPassport//RU', 'BEGIN:VEVENT', 'UID:bp-daily@rifataiupov.com', 'DTSTART:' + dt, 'DURATION:PT10M', 'RRULE:FREQ=DAILY', 'SUMMARY:BodyPassport: комплекс упражнений',
    'DESCRIPTION:' + location.origin + location.pathname, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Комплекс готов', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'bodypassport.ics'; a.click(); }

// ---------- 6. зона подробнее ----------
export function muscle(key) {
  const { a } = currentAnalysis(); const s = spots(a).find(x => x.key === key); if (!s) return map();
  const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left';
  const ids = l => (l || []).map(x => x.replace('{s}', sk)).filter(x => ex(x));
  const fd = a.findings.find(f => f.muscles.some(x => x.id === s.id && (x.side === s.side || x.side === 'BOTH'))); const ch = a.chains.find(c => c.chain.members.some(x => x.id === s.id));
  // клиенту задача тренировки и что увидела камера, без выводов о состоянии мышцы (юридический разбор)
  const why = TONE_WHY_CLIENT[s.k] || '';
  let stages;
  if (s.k === 'WEAK' && m.plan) { const subs = (m.plan.subs || []).map(x => C.muscles[x]).filter(Boolean); const rel = ids(m.plan.release), iso = ids(m.plan.isolate).filter(x => !rel.includes(x));
    stages = [['Сначала расслабь соседние зоны', subs.length ? `Сначала ${subs.map(x => x.zone.toLowerCase()).join(' и ')}: так следующие упражнения пойдут легче.` : '', (subs.find(x => x.massage) || {}).massage, rel],
      ['Включи ее отдельно', 'Легкая нагрузка, чтобы зона активнее включалась.', null, iso], ['Закрепи в движении', 'Та же работа в обычном движении.', null, ids(m.plan.integrate).filter(x => !rel.includes(x) && !iso.includes(x))]];
  } else if (s.k === 'WEAK') stages = [['Включи ее', '', null, ids(m.activate)]];
  else { const rel = ids(releaseFor(m, s.k, ex)), ant = m.antagonist && C.muscles[m.antagonist]; const give = [...(ant ? ids((ant.plan && ant.plan.isolate) || []).concat(ids(ant.activate)) : []), ...ids(m.activate)].filter(x => !rel.includes(x));
    stages = [s.k === 'HYPER' ? ['Сними нагрузку мягко', '⛔ Растягивать и раскатывать эту зону не нужно. Только мягкие удержания.', null, rel] : ['Расслабь мышцу', '', massageAllowed(s.k) ? m.massage : null, rel], [ant ? 'Включи ' + ant.zone.toLowerCase() : 'Дай работу соседям', 'Часть работы возьмут на себя соседние мышцы.', null, [...new Set(give)].slice(0, 1)]]; }
  // причина по закону Шеррингтона, Майерса или Шарман: сначала работаем с мышцей-источником
  const cm = s.cause && C.muscles[s.cause.id];
  if (cm && s.cause.law !== 'sahr') stages.unshift([`Сначала расслабь ${lc(cm.zone || cm.name)} ${sideWord(s.cause.side)}`, 'Начните с нее: так следующие упражнения пойдут легче.', massageAllowed('SHORT') ? cm.massage : null, ids(releaseFor(cm, 'SHORT', ex))]);
  stages = stages.filter(x => x[3].length || x[2]); const all = [...new Set(stages.flatMap(x => x[3]))]; let n = 0;
  const obs = seen(a, s), num = obs.map(x => String(x).match(/(\d+(?:[.,]\d+)?)\s*(°|%)?/)).find(Boolean);
  const finds = a.findings.filter(f => f.muscles.some(x => x.id === s.id && (x.side === s.side || x.side === 'BOTH')));
  const reason = { k: s.k, t: `${TONE[s.k][4]}: ${lc(m.zone || m.name)} ${sideWord(s.side)}` };
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s4);padding-bottom:var(--s4)">
    <div class="row" style="gap:8px"><span class="mark ${s.k}"></span><span style="font-size:13px;font-weight:600;color:${TONE[s.k][5]}">${TONE[s.k][0]}</span></div>
    <div><h1 style="font-size:26px">${title(s)}</h1><div style="font-size:14px;color:var(--sub);margin-top:4px">${tech(s)}</div></div>
    ${num ? `<div><div class="why" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--sub)"><span class="src">ЗАМЕР</span><span>${esc(obs[0].replace(' (на границе нормы)', ''))}</span>${/на границе нормы/.test(obs[0]) ? '<span class="edge">на границе нормы</span>' : ''}</div></div>`
      : `<div class="why" style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--sub)"><span class="src hyp">ГИПОТЕЗА</span><span>Напрямую не измерено</span></div>`}
    <div class="card"><div class="eyebrow">Задача</div><p style="font-size:16px;line-height:1.45;margin-top:8px">${why}</p></div>
    <details class="acc"><summary style="font-weight:600;font-size:15px">Почему так</summary>
      ${finds.map(f => `<div style="margin-top:10px"><div class="row" style="gap:6px;align-items:flex-start"><span class="src" style="margin-top:2px">ЗАМЕР</span><b style="font-size:15px;flex:1">${f.observed}</b></div><div style="font-size:13px;color:var(--sub);margin-top:2px">${f.rule.basis || ''}${f.rule.weak ? ' · слабый признак' : ''}</div></div>`).join('')
        || `<div class="row" style="gap:6px;align-items:flex-start;margin-top:10px"><span class="src hyp" style="margin-top:2px">ЦЕПЬ</span><p style="font-size:15px;line-height:1.4;flex:1">${s.byChain ? `Напрямую не измерено. Предположение по цепи «${s.byChain}».` : s.cause || s.derived ? 'Напрямую не измерено. Подобрано по связи с соседними зонами.' : 'Признак из теста.'}</p></div>`}
      ${s.derived || finds.every(f => f.rule.weak) ? '<p style="font-size:13px;color:var(--short-t);margin-top:10px">Уверенность низкая. Проверь самопроверкой ниже или на консультации.</p>' : ''}</details>
    ${m.selfTest ? `<details class="acc"><summary style="font-weight:600;font-size:15px">Проверить себя за минуту</summary><p style="font-size:15px;line-height:1.45">${m.selfTest}</p></details>` : ''}
    ${m.benefit ? `<div class="card row" style="align-items:flex-start"><span class="mark OK" style="margin-top:4px"></span><div><b>Что изменится</b><p style="font-size:15px;margin-top:4px;line-height:1.4">${m.benefit}</p></div></div>` : ''}
    ${stages.map((st, i) => `<div class="row" style="margin-top:8px"><span class="step-n" style="font-size:14px">${String(i + 1).padStart(2, '0')}</span><b style="font-size:18px">${st[0]}</b></div>
      ${st[1] ? `<p class="sub" style="font-size:14px">${st[1]}</p>` : ''}
      ${st[2] ? `<div class="card"><b>Самомассаж</b>${m.tool ? ` <span class="pill" style="min-height:28px;font-size:12px">${m.tool}</span>` : ''}<p style="font-size:15px;line-height:1.45;margin-top:6px">${st[2]}</p></div>` : ''}
      ${st[3].map(id => { const e = ex(id); n++; return `<div class="list-item exr" data-id="${id}">${hasFigure(id) ? `<span style="width:76px;flex:none;background:var(--surface-2);border-radius:12px;padding:2px">${exFigure(id)}</span>` : `<span class="round" style="background:var(--surface-2);flex:none">${ic('play', 's')}</span>`}<div style="flex:1"><b style="font-size:16px">${exLabel(e)}</b><div class="sub" style="font-size:13px">${[e.dose, e.durationSec + ' с'].filter(Boolean).join(' · ')}</div></div><span class="step-n">${n}</span></div>`; }).join('')}`).join('')}
    ${INV() ? '' : `<a class="row-link" href="${bot()}" target="_blank" style="color:var(--focus);font-weight:600"><span>Разобрать вместе с автором методики</span>${ic('chevron-right', 's')}</a>`}
   </div>${all.length ? `<div class="dock"><button class="btn" id="go">${ic('play', 's')}Начать комплекс · ${totalMin(all.map(ex))} мин</button></div>` : ''}</div>`);
  const rs = Object.fromEntries(all.map(id => [id, reason]));
  $('#back').onclick = map; app.querySelectorAll('.exr').forEach(el => el.onclick = () => workout([el.dataset.id], rs)); if ($('#go')) $('#go').onclick = () => workout(all, rs);
}

// ---------- 7. тренировка ----------
// шкала боли 0–10: один ползунок в шторке. Возвращает число или null (пропустили)
// cancel: окно можно закрыть без ответа (вернет undefined), например чтобы не начинать тренировку
function vasSheet(title, init = 0, skip = 'Пропустить', cancel = false) {
  return new Promise(res => { const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div><h2 style="font-size:21px">${title}</h2><p class="sub" style="font-size:14px;margin-top:6px">${PAIN_SCALE}</p>
      <div class="row" style="gap:12px;margin-top:16px"><input type="range" id="vs" class="range" min="0" max="10" value="${init}" style="flex:1" aria-label="${title}"><b id="vsv" class="num" style="font-size:32px;width:44px;text-align:right">${init}</b></div><div id="vsw" style="font-size:15px;font-weight:600;margin-top:4px">${painWord(init)}</div>
      <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub)"><span>нет боли</span><span>сильнейшая</span></div>
      <button class="btn" id="vok" style="margin-top:16px">Готово</button><button class="btn ghost" id="vno" style="margin-top:8px;border:0">${skip}</button></div>`;
    document.body.appendChild(d); const r = d.querySelector('#vs'); r.oninput = () => { d.querySelector('#vsv').textContent = r.value; d.querySelector('#vsw').textContent = painWord(r.value); };
    d.querySelector('#vok').onclick = () => { d.remove(); res(+r.value); }; d.querySelector('#vno').onclick = () => { d.remove(); res(null); };
    d.addEventListener('bp-close', () => res(cancel ? undefined : null)); if (cancel) d.querySelector('#vno').insertAdjacentHTML('afterend', '<button class="btn ghost" id="vcx" style="margin-top:4px;border:0;color:var(--sub)">Отмена</button>'), d.querySelector('#vcx').onclick = () => { d.remove(); res(undefined); }; });
}
export async function workout(ids, reasons = {}) {
  try { localStorage.removeItem('bp_hw_new'); } catch (e) {}
  const pre = await vasSheet('Оцените уровень боли или дискомфорта прямо сейчас (0–10)', 0, 'Пропустить и начать', true);
  if (pre === undefined) return; // закрыли окно: остаемся на экране, тренировка не начинается
  // при сильной боли комплекс сам не запускаем: объясняем и даем безопасный шаг (аудит, п. 16)
  if (pre >= 7) { track('workout_pain_block', { v: pre }, false);
    go(`<div class="scr fade"><div class="empty" style="flex:1;justify-content:center">${ic('info')}<h1>Сегодня без комплекса</h1>
      <p class="sub">Боль ${pre} из 10 слишком сильная для упражнений. Отдохните и покажитесь врачу или специалисту, если боль не проходит или нарастает.</p></div>
      <div class="dock"><button class="btn" id="pbk">Понятно</button></div></div>`); $('#pbk').onclick = () => (tests().length ? map() : clientHome()); return; }
  const list = ids.map(ex).filter(Boolean); let i = 0, closed = false, doneN = 0; voice.unlock(); voice.keep = true; keepAwake(true);
  const finish = () => done(list, pre, doneN);
  const run = async () => {
    if (closed) return; if (i >= list.length) return finish();
    const e = list[i], hm = (e.dose || '').match(/(\d+)\s*×\s*(\d+)\s*с/), total = hm ? +hm[1] * +hm[2] : Math.max(10, e.durationSec); let left = total, playing = false; const rs = reasons[e.id];
    // камера считает повторы и подсказывает по технике там, где это надежно (мост, носки, отведение, руки вверх)
    camOff(); const tgt = targetReps(e.dose), rk = device.camera && tgt && repKind(e.id) ? repCounter(e.id) : null, sets = setsOf(e.dose);
    const camHtml = () => localStorage.getItem('bp_excam') === '1' ? `<div style="position:relative;border-radius:var(--r-lg);overflow:hidden;background:#000;height:190px"><video id="exv" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
      <div style="position:absolute;left:10px;top:8px;background:rgba(0,0,0,.55);border-radius:12px;padding:4px 10px;color:#fff"><b id="exn" class="num" style="font-size:28px">0</b><span style="font-size:14px;opacity:.8"> / ${tgt}${sets > 1 ? ' · подход <span id="exs">1</span> из ' + sets : ''}</span></div>
      <button class="pill" id="excoff" style="position:absolute;right:8px;top:8px;background:rgba(0,0,0,.55);color:#fff">Выключить</button><div id="exhint" style="position:absolute;left:10px;right:10px;bottom:8px;color:#fff;font-size:14px;text-shadow:0 1px 3px #000"></div></div>`
      : `<button class="btn line" id="excam" style="height:44px;color:#fff;background:transparent;border-color:rgba(255,255,255,.3)">${ic('camera', 's')}Считать повторы камерой</button>`;
    go(`<div class="scr dark fade" style="padding:16px 20px 28px">
      <div class="row"><div class="segs" style="flex:1">${list.map((_, k) => `<div><b style="width:${k <= i ? 100 : 0}%;background:${k === i ? '#fff' : 'var(--signal)'}"></b></div>`).join('')}</div><button class="round glass" id="x" aria-label="Закончить">${ic('x')}</button></div>
      <div class="eyebrow" style="color:var(--signal);margin-top:18px">${i + 1} из ${list.length}${rs ? ' · для итога' : ''}</div>
      ${rs ? `<div class="row" style="gap:8px;margin-top:6px;font-size:14px;color:var(--cam-sub)"><span class="mark sm ${rs.k}"></span><span>${esc(rs.t)}</span></div>` : ''}
      <h1 style="color:#fff;margin-top:8px">${e.title.split(' (')[0]}</h1>
      ${exSide(e) ? `<div style="display:inline-block;align-self:flex-start;width:fit-content;margin-top:8px;padding:6px 12px;border-radius:999px;background:var(--signal);color:var(--cam-bg,#0B1B3B);font-weight:700;font-size:15px">${exSide(e) === 'слева' ? 'Левая сторона' : 'Правая сторона'}</div>` : ''}
      <div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap">${[planText(e), e.feel].filter(Boolean).map(x => `<span class="pill" style="background:rgba(255,255,255,.12);color:#fff">${x}</span>`).join('')}</div>
      ${hasFigure(e.id) ? `<div style="margin-top:16px;background:#F5F6FA;border-radius:var(--r-lg);padding:10px 12px 8px">${exFigure(e.id)}<div style="text-align:center;font-size:13px;color:#4A5A63;margin-top:2px">Повторяйте за фигурой · <span style="color:#C77D12">светится</span> рабочая зона</div></div>` : ''}
      ${rk ? `<div id="cambox" style="margin-top:12px">${camHtml()}</div>` : ''}
      <div class="row" style="gap:14px;margin-top:14px;align-items:center"><div style="position:relative;width:${hasFigure(e.id) ? 72 : 200}px;height:${hasFigure(e.id) ? 72 : 200}px;flex:none;margin:${hasFigure(e.id) ? '0' : '8px auto 0'}"><svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/><circle id="arc" cx="50" cy="50" r="45" fill="none" stroke="#D4F25A" stroke-width="6" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/></svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><b id="tm" class="num" style="font-size:${hasFigure(e.id) ? 20 : 56}px;font-weight:600;letter-spacing:-.02em;opacity:.45">${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}</b></div></div><span id="tml" style="font-size:14px;color:var(--cam-sub)">старт после подсказки</span><b id="ccue" style="flex:1;font-size:20px;line-height:1.25;color:var(--signal)"></b></div>
      <div style="flex:1;margin-top:20px;display:flex;flex-direction:column;gap:12px">${e.steps.slice(0, 3).map((s, k) => `<div class="row st" style="opacity:.45;align-items:flex-start"><span class="step-n" style="color:var(--signal);width:22px;padding-top:2px">${String(k + 1).padStart(2, '0')}</span><span style="font-size:16px;line-height:1.35;flex:1">${s}</span></div>`).join('')}
        ${e.check ? `<div class="row" style="background:rgba(255,255,255,.08);border-radius:var(--r-md);padding:12px;align-items:flex-start;gap:10px"><span style="color:var(--signal)">${ic('info', 's')}</span><span style="font-size:14px;line-height:1.4">${e.check}</span></div>` : ''}
        <div id="exctl" style="display:flex;flex-direction:column;gap:8px"><button class="btn" id="exskip" style="background:var(--signal);color:var(--cam-bg,#0B1B3B);height:56px;font-size:18px">${ic('play', 's')}Я в положении, начинаем</button><button class="btn glass" id="exrep">${ic('volume-2', 's')}Объяснить еще раз</button></div></div>
      <div class="row" style="justify-content:center;gap:28px;margin-top:16px"><button class="round" id="pv" aria-label="Назад" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">${ic('skip-back')}</button><button class="round" id="pp" aria-label="Пауза" style="width:80px;height:80px;background:var(--signal);color:var(--cam-bg)">${ic('pause')}</button><button class="round" id="nx" aria-label="Дальше" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">${ic('skip-forward')}</button></div></div>`);
    let token = {}; const myTok = token;
    const camStart = async () => { const v = $('#exv'); if (!v || !rk) return; $('#excoff').onclick = () => { localStorage.setItem('bp_excam', '0'); camOff(); $('#cambox').innerHTML = camHtml(); bindCam(); };
      $('#exhint').textContent = 'Поставьте телефон так, чтобы было видно все тело'; let lastCue = 0, setN = 1;
      try { await initPose(); if (myTok.dead || closed) return; await startCamera(v); } catch (er) { $('#exhint').textContent = 'Камера недоступна'; return; }
      track('ex_cam', { c: rk.kind }, false);
      cam.onFrame = f => { if (myTok.dead || closed) return camOff(); const r = rk.feed(f.pose, f.t); if (!f.pose) return; if ($('#exhint').textContent.startsWith('Поставьте')) $('#exhint').textContent = '';
        if (r.ev === 'rep') { const inSet = r.n - (setN - 1) * tgt; $('#exn').textContent = inSet; voice.say(numWord(inSet));
          if (inSet >= tgt) { if (setN >= sets) { camOff(); voice.say('Отлично, упражнение выполнено'); mark(e); doneN++; i++; token.dead = true; setTimeout(run, 1500); return; }
            setN++; if ($('#exs')) $('#exs').textContent = setN; setTimeout(() => voice.say('Подход готов. Отдохните и продолжайте'), 600); $('#exn').textContent = 0; } }
        if (r.ev === 'low' && f.t - lastCue > 6) { lastCue = f.t; const cue = REP_KINDS[rk.kind].cue.low; $('#exhint').textContent = cue; voice.say(cue); } }; };
    const bindCam = () => { if ($('#excam')) $('#excam').onclick = () => { localStorage.setItem('bp_excam', '1'); $('#cambox').innerHTML = camHtml(); bindCam(); camStart(); }; };
    if (rk) { bindCam(); if ($('#exv')) camStart(); }
    const hush = () => { voice.say(''); try { speechSynthesis.cancel(); } catch (er) {} };
    $('#x').onclick = () => { closed = true; hush(); camOff(); keepAwake(false); voice.keep = false; voice.release(); if (doneN) finish(); else map(); };
    $('#pv').onclick = () => { token.dead = true; hush(); i = Math.max(0, i - 1); run(); };
    $('#nx').onclick = () => { token.dead = true; hush(); mark(e); doneN++; i++; run(); };
    $('#pp').onclick = () => { playing = !playing; $('#pp').innerHTML = ic(playing ? 'pause' : 'play'); $('#pp').setAttribute('aria-label', playing ? 'Пауза' : 'Продолжить'); };
    // читаем название и шаги по очереди, подсвечивая текущий шаг; без записи звучит системный голос
    const lit = k => app.querySelectorAll('.st').forEach((el, n) => el.style.opacity = n <= k ? 1 : .45);
    // есть мужская запись этого упражнения (тот же голос, что в тесте): играем ее, шаги подсвечиваем по ходу записи
    // запись на «вы» со стороной (озвучивается при сборке), иначе старая запись, иначе голос телефона по шагам
    // объяснение можно пропустить или послушать заново; после него короткий сигнал «Пип» и пошел таймер
    let exTok = 0, ready, full = false; const started = new Promise(r => ready = r);
    const explain = async () => { const my = ++exTok, dead = () => myTok.dead || closed || my !== exTok;
      // упражнение уже делали два раза и больше: только название, подробности по кнопке «Повторить»
      const sideTwo = i > 0 && list[i - 1].id.replace(/_(left|right)$/, '') === e.id.replace(/_(left|right)$/, '');
      if (!full && (timesDone(e) >= 2 || sideTwo)) { await voice.speak(exName(e) + (exSide(e) ? ', ' + (exSide(e) === 'слева' ? 'левая сторона' : 'правая сторона') : '')); full = true; if (!dead()) voice.say(PH.wait); return; }
      const rec = [sayText(e)].find(x => x && voice.has(x));
      if (rec) { const nS = Math.min(3, e.steps.length), t0 = Date.now(), per = (rec.length * 65) / (nS + (e.check ? 1 : 0));
        const tick = setInterval(() => { if (dead()) return clearInterval(tick); lit(Math.min(nS - 1, Math.floor((Date.now() - t0) / per))); }, 300);
        await voice.speak(rec); clearInterval(tick); }
      else { await voice.speak(e.title.split(' (')[0] + (exSide(e) ? ', ' + (exSide(e) === 'слева' ? 'левая сторона' : 'правая сторона') : ''));
        for (let k = 0; k < Math.min(3, e.steps.length); k++) { if (dead()) return; lit(k); await voice.speak(e.steps[k]); }
        if (e.check && !dead()) await voice.speak(e.check); }
      // старт только по кнопке: человек сам говорит, что уже лег, встал или сел как надо
      if (!dead()) voice.say(PH.wait); };
    $('#exskip').onclick = () => { exTok++; hush(); ready(); };
    $('#exrep').onclick = () => { hush(); lit(-1); full = true; explain(); };
    explain(); await started; if ($('#exctl')) $('#exctl').hidden = true;
    // короткий отсчет, чтобы после нажатия успеть вернуть руку в положение
    for (const n of [3, 2, 1]) { if (myTok.dead || closed) return; $('#tm').style.opacity = 1; $('#tm').textContent = n; $('#tml').textContent = 'приготовились'; voice.say(numWord(n)); await sleep(1000); }
    if (!myTok.dead && !closed) { voice.beep('start'); await sleep(300); }
    // дальше ведет тренер: подходы, счет повторов, подсказки по технике, отдых между подходами и упражнениями
    if (myTok.dead || closed) return; lit(-1); playing = true; $('#tm').style.opacity = 1;
    const P = coachPlan(e), cues = cuesOf(e), dead = () => myTok.dead || closed, cueEl = () => $('#ccue');
    const show = (big, label, frac) => { $('#tm').textContent = big; $('#tml').textContent = label; if (frac != null) $('#arc').style.strokeDashoffset = 283 * frac; };
    const tick = async () => { do { await sleep(250); if (dead()) return false; } while (!playing); return true; };
    const wait = async sec => { const t1 = Date.now() + sec * 1000; while (Date.now() < t1) { if (!(await tick())) return false; } return true; };
    const cue = t => { if (cueEl()) cueEl().textContent = t; voice.say(t); };
    // отдых с обратным отсчетом; за 3 секунды «Приготовились» и счет
    const rest = async (sec, phrase) => { if (!sec) return true; voice.say(phrase); let left = sec;
      while (left > 0) { show(String(left), 'отдых', left / sec); if (!(await wait(1))) return false; left--; if (left === 3) voice.say(PH.ready); } return true; };
    for (let s = 1; s <= P.sets; s++) {
      if (P.sets > 1) await voice.speak(PH.set(s, P.sets)); if (dead()) return;
      await voice.speak(P.holdReps ? PH.goSeries(P) : P.reps ? PH.goReps(P) : PH.goHold(P)); if (dead()) return; voice.beep('start');
      const label = P.sets > 1 ? `подход ${s} из ${P.sets}` : '';
      if (P.reps) { // счет вслух в темпе упражнения; на 40% и 75% вместо числа короткая подсказка
        let hushNext = false; const cueAt = new Set(cues.length ? [Math.max(2, Math.round(P.reps * .4)), P.reps >= 8 ? Math.round(P.reps * .75) : 0] : []);
        for (let r = 1; r <= P.reps; r++) { show(String(r), (label ? label + ' · ' : '') + `из ${P.reps} повторов`, 1 - r / P.reps);
          // после подсказки следующее число не звучит: фраза успевает договориться до конца
          if (cueAt.has(r)) { cue(cues[(s + r) % cues.length]); hushNext = true; } else if (hushNext) hushNext = false; else voice.say(numWord(r)); if (!(await wait(P.tempo))) return; } }
      else if (P.holdReps) { for (let r = 1; r <= P.holdReps; r++) { let left = P.hold;
          while (left > 0) { show(String(left), `${r} из ${P.holdReps} · держим`, left / P.hold); if (!(await wait(1))) return; left--; }
          if (r < P.holdReps) { voice.say(PH.relax(r, P.holdReps)); show('↺', 'расслабьтесь', 1); if (!(await wait(P.relax))) return; } } }
      else { let left = P.hold; const at = new Set([Math.round(P.hold * .66), Math.round(P.hold * .33)]);
        while (left > 0) { show(String(left), (label ? label + ' · ' : '') + 'держим', left / P.hold);
          if (left === 5 && P.hold > 10) voice.say(PH.five); else if (left <= 3) voice.say(numWord(left)); else if (cues.length && at.has(left)) cue(cues[(s + left) % cues.length]);
          if (!(await wait(1))) return; left--; } }
      voice.beep('stop'); if (cueEl()) cueEl().textContent = '';
      if (s < P.sets && !(await rest(P.rest, PH.setDone + '. ' + PH.rest(P.rest)))) return;
    }
    mark(e); doneN++; i++;
    // следующее упражнение: та же база с другой стороны — короткая смена стороны, иначе отдых и название следующего
    const nx = list[i]; if (!nx) { voice.say(PH.done); await sleep(1500); return run(); }
    const sameBase = nx.id.replace(/_(left|right)$/, '') === e.id.replace(/_(left|right)$/, '');
    if (!(await rest(sameBase ? REST_SIDE : REST_NEXT, sameBase ? PH.side : PH.next(REST_NEXT, exName(nx))))) return;
    run();
  };
  run();
}
function camOff() { cam.onFrame = null; if (cam.running) stopCamera(); }
const timesDone = e => JSON.parse(localStorage.getItem(K('bp_done')) || '[]').filter(x => x.id === e.id).length;
const planText = e => { const p = coachPlan(e); return [p.sets > 1 ? `${p.sets} подхода` : '', p.holdReps ? `${p.holdReps} × ${p.hold} с` : p.reps ? `${p.reps} раз` : `${p.hold} с`, p.rest ? `отдых ${p.rest} с` : ''].filter(Boolean).join(' · '); };
function mark(e) { const d = JSON.parse(localStorage.getItem(K('bp_done')) || '[]'); d.push({ id: e.id, t: Date.now() }); localStorage.setItem(K('bp_done'), JSON.stringify(d.slice(-500))); backupSoon(10000); }
function streak() { const days = new Set(JSON.parse(localStorage.getItem(K('bp_done')) || '[]').map(x => new Date(x.t).toDateString())); let n = 0; const d = new Date(); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); } return n; }
async function done(list, pre = null, n = list.length) { camOff(); keepAwake(false); voice.keep = false; setTimeout(() => { if (!cam.running) voice.release(); }, 6000); const s = Math.max(1, streak());
  const post = await vasSheet('Оцените уровень боли после упражнений (0–10)', pre ?? 0);
  const rec = { t: Date.now(), pre: pre ?? undefined, post: post ?? undefined, n, all: list.length }; const log = vasSave(rec, K('bp_vas'));
  const dl = vasDelta(pre, post); track('vas_done', { n, d: dl ?? undefined }, false);
  const w = vasStats(log, 7); sendProgress(log);
  go(`<div class="scr fade"><div class="empty" style="flex:1;justify-content:center"><span class="${dl > 0 ? 'pop' : ''}" style="width:88px;height:88px;border-radius:50%;background:var(--ok-s);color:var(--ok-t);display:flex;align-items:center;justify-content:center">${ic('check')}</span>
   <h1>${n < list.length ? `Сделано ${n} из ${list.length}` : 'Комплекс выполнен'}</h1>
   ${dl > 0 ? `<p class="vasgood" style="font-size:18px;font-weight:600;color:var(--ok-t)">Отличный результат! Уровень боли снижен на ${dl} ${dl === 1 ? 'балл' : dl < 5 ? 'балла' : 'баллов'}</p>` : dl < 0 ? '<p class="sub">Боль после занятия выше. Уменьшите амплитуду, а если повторится, покажите это специалисту.</p>' : (!tests().length && myReports().length ? '' : '<p class="sub">Делай так 2 недели и повтори тест. Сравним карты.</p>')}</div>
   <div class="pad kpi"><div><b>${n}</b><span>упражнения</span></div><div><b>${w.compliance}%</b><span>дней из 7</span></div><div><b>${s}</b><span>дн. подряд</span></div></div>
   ${progressChart(log)}
   ${!tests().length && myReports().length ? '<p class="sub pad" style="text-align:center;font-size:14px;margin-top:-8px">Отметка ушла специалисту. Завтра продолжим.</p>' : ''}
   <div class="dock">${!tests().length && myReports().length ? '<button class="btn" id="back">В мой кабинет</button>' : tests().length ? `<button class="btn" id="retest">${ic('activity', 's')}Посмотреть, как повлияли упражнения</button><button class="btn ghost" id="back">К карте тела</button><p style="text-align:center;font-size:13px;color:var(--sub)">Короткий повторный тест: сравним движения до и после занятия</p>` : '<button class="btn" id="back">К карте тела</button>'}</div></div>`);
  $('#back').onclick = !tests().length && myReports().length ? clientHome : map;
  // повторный тест сразу после комплекса: результат сравним с тестом до упражнений
  if ($('#retest')) $('#retest').onclick = () => { localStorage.setItem(K('bp_retest'), String(tests().at(-1).date)); track('retest_after', { n }, false); prep(); }; }
// база сравнения за период: последний тест не позже начала периода (иначе самый ранний в периоде)
function periodBase(all, p) { const last = all.at(-1); if (all.length < 2) return null; if (p === 'prev') return all.at(-2); if (p === 'all') return all[0];
  const from = last.date - (+p) * 864e5, before = all.filter(t => t.date <= from && t !== last); return before.at(-1) || all.find(t => t !== last && t.date >= from) || null; }
function baPeriods(all) { const has = p => { const b = periodBase(all, p); return b && b !== all.at(-1); };
  return `<div class="bap row" style="gap:6px;flex-wrap:wrap">${[['all', 'Все время'], ['30', 'Месяц'], ['7', 'Неделя'], ['prev', 'Прошлый тест']].filter(([p]) => has(p)).map(([p, n]) => `<button class="pill${p === 'all' ? ' on' : ''}" data-p="${p}">${n}</button>`).join('')}</div>`; }
// пара тестов для калибровки: признаки и проценты мышц обоих тестов, без имени и аккаунта.
// workout: между тестами был комплекс; иначе контрольная пара (повтор без упражнений) — по ней видно чистый разброс теста
function sendPair(was, now, workout) { if (was.beta || now.beta) return; try {
  const fOf = t => Object.fromEntries(Object.entries(analyze(t, C).f || {}).filter(([, v]) => Number.isFinite(v)));
  const mOf = t => Object.fromEntries(baSpots(t).filter(x => x.k !== 'OK').map(x => [x.key, pct(x)]));
  const q = t => { const v = Object.values(t.quality || {}).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const ex = workout ? JSON.parse(localStorage.getItem(K('bp_done')) || '[]').filter(x => x.t > was.date && x.t < now.date).length : 0;
  fetch('/api/calib?a=pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ workout, gap: Math.round((now.date - was.date) / 1000), ex, f1: fOf(was), f2: fOf(now), m1: mOf(was), m2: mOf(now), q1: q(was), q2: q(now) }) }).catch(() => {});
  track('retest_pair', { c: workout ? 'workout' : 'control' }, false); } catch (e) {} }
/** Сравнение сразу после комплекса: тест до упражнений и только что пройденный. */
// движения, которые человек сам чувствует: «до занятия присед был такой, после стал глубже». up: больше = лучше
const FEEL = [['sq_depth', 'Присед стал глубже', 8, true], ['valgus_max', 'Колени в приседе меньше уходят внутрь', 8], ['sls_valgus_r', 'Стоя на правой, колено держится ровнее', 8],
  ['sls_valgus_l', 'Стоя на левой, колено держится ровнее', 8], ['sls_drop_r', 'На правой ноге таз держится ровнее', 2.5], ['sls_drop_l', 'На левой ноге таз держится ровнее', 2.5],
  ['sq_lean', 'В приседе спина прямее', 5], ['sq_arms', 'Руки в приседе держатся выше', 6], ['oh_reach', 'Руки поднимаются выше над головой', 8],
  ['head_forward', 'Голова стоит ровнее над плечами', 4], ['shoulder_tilt', 'Плечи стоят ровнее', 2], ['pelvic_tilt', 'Таз стоит ровнее', 2],
  ['trot_r', 'Поворот корпуса вправо стал больше', 6, true], ['trot_l', 'Поворот корпуса влево стал больше', 6, true], ['asym_bend', 'Наклоны вправо и влево стали ровнее', 5]];
const MOVE_NAME = { sq_depth: 'Присед', valgus_max: 'Присед', sls_valgus_r: 'Присед на правой ноге', sls_valgus_l: 'Присед на левой ноге', sls_drop_r: 'Стойка на правой ноге', sls_drop_l: 'Стойка на левой ноге',
  sq_lean: 'Присед', sq_arms: 'Присед с руками вверх', oh_reach: 'Подъем рук', head_forward: 'Положение головы', shoulder_tilt: 'Положение плеч', pelvic_tilt: 'Положение таза', trot_r: 'Поворот вправо', trot_l: 'Поворот влево', asym_bend: 'Наклоны в стороны' };
/** Что изменилось в движениях между тестами. k: запас к порогу (сразу после занятия порог в 1,5 раза выше: там больше случайного разброса). */
function feelDeltas(was, now, k = 1.5) { const f0 = analyze(was, C).f, f1 = analyze(now, C).f;
  return FEEL.filter(([key]) => Number.isFinite(f0[key]) && Number.isFinite(f1[key])).map(([key, text, thr, up]) => { const a = Math.abs(f0[key]), b = Math.abs(f1[key]), gain = up ? b - a : a - b;
    return { key, text, a, b, gain, better: gain >= thr * k, worse: -gain >= thr * 3, size: gain / thr }; }); }
/** «Как повлияли упражнения»: тест до занятия и сразу после. Главное — что человек смог сделать лучше; честно о разбросе. */
export function afterWorkout(baseDate) { const all = tests(), was = all.find(t => t.date === baseDate), now = all.at(-1);
  if (!was || !now || was === now) return analysisScreen();
  sendPair(was, now, true);
  const ds = feelDeltas(was, now), good = ds.filter(x => x.better).sort((x, y) => y.size - x.size), bad = ds.filter(x => x.worse), deg = v => Math.round(v) + '°';
  const hero = good[0];
  track('retest_after', { c: 'view', n: good.length }, false);
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Как повлияли упражнения</b><small>до и после занятия</small></div></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);padding-bottom:var(--s4)">
    ${hero ? `<div class="card" style="background:var(--ok-s);border:0"><div class="row" style="gap:10px;align-items:center"><span style="color:var(--ok-t)">${ic('check')}</span><b style="font-size:20px;line-height:1.25">${esc(hero.text)}</b></div>
      <div class="row" style="gap:10px;margin-top:10px;font-size:17px"><span class="sub">до занятия</span><b class="num">${deg(hero.a)}</b><span class="sub">→ после</span><b class="num" style="color:var(--ok-t)">${deg(hero.b)}</b></div></div>
      ${good.length > 1 ? `<div class="group">${good.slice(1, 4).map(x => `<div class="row" style="min-height:52px;gap:10px"><span style="color:var(--ok-t)">${ic('check', 's')}</span><span style="flex:1;font-size:15px">${esc(x.text)}</span><span class="num sub">${deg(x.a)} → <b style="color:var(--text)">${deg(x.b)}</b></span></div>`).join('')}</div>` : ''}`
    : `<div class="card"><b style="font-size:18px">Сразу после занятия заметной разницы нет</b><p class="sub" style="margin-top:6px;font-size:15px;line-height:1.45">Так бывает часто: телу нужно время. Изменения обычно становятся видны через 1–2 недели регулярных занятий.</p></div>`}
    ${bad.length ? `<p class="sub" style="font-size:14px;line-height:1.45">${esc(MOVE_NAME[bad[0].key] || 'Одно движение')} сегодня получилось чуть хуже. Сразу после нагрузки это обычно усталость, а не откат. Если повторится через неделю, сделайте упражнения легче.</p>` : ''}
    <details class="acc"><summary style="font-weight:600">Мышцы до и после</summary>${baBlock('baw')}</details>
    <p class="sub" style="font-size:13px;line-height:1.45">У любого теста по камере есть разброс: два замера подряд никогда не совпадают точно. Поэтому здесь только то, что изменилось заметно больше обычного разброса. Надежный итог через неделю.</p></div>
    <div class="dock"><button class="btn" id="go">Готово</button></div></div>`);
  $('#back').onclick = $('#go').onclick = () => analysisScreen();
  const det = app.querySelector('details.acc'); det.addEventListener('toggle', () => { if (det.open) bindBa('baw', was, now, { acute: true }); }); }
// график прогресса клиента: боль до и после по последним занятиям (SVG, без библиотек)
export function progressChart(log) {
  const L = log.filter(r => Number.isFinite(r.pre) && Number.isFinite(r.post)).slice(-10); if (L.length < 2) return '';
  const W = 320, H = 120, step = W / L.length, k = (H - 20) / 10, bw = Math.min(12, step / 2 - 3);
  const bars = L.map((r, i) => { const x = i * step + step / 2; return `<rect x="${x - bw - 1}" y="${H - 10 - r.pre * k}" width="${bw}" height="${r.pre * k}" rx="2" fill="var(--faint)"/><rect x="${x + 1}" y="${H - 10 - r.post * k}" width="${bw}" height="${r.post * k}" rx="2" fill="${r.post < r.pre ? 'var(--ok-t)' : r.post > r.pre ? 'var(--over)' : 'var(--sub)'}"/>`; }).join('');
  const m = vasStats(log, 30);
  return `<div class="pad" style="margin-top:12px"><div class="card"><b style="font-size:15px">Боль до и после занятий</b>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin-top:8px" role="img" aria-label="График боли до и после занятий"><line x1="0" x2="${W}" y1="${H - 10}" y2="${H - 10}" stroke="var(--line)"/>${bars}</svg>
    <div class="row" style="gap:14px;font-size:12px;color:var(--sub)"><span><i style="display:inline-block;width:10px;height:10px;background:var(--faint);border-radius:2px"></i> до</span><span><i style="display:inline-block;width:10px;height:10px;background:var(--ok-t);border-radius:2px"></i> после</span><span style="flex:1;text-align:right">за 30 дней: ${m.avgPre == null ? '—' : String(m.avgPre).replace('.', ',')} → ${m.avgPost == null ? '—' : String(m.avgPost).replace('.', ',')}</span></div></div></div>`;
}
// клиенту по ссылке специалиста: сводка занятий уходит специалисту тем же зашифрованным каналом, не чаще раза в 12 часов
async function sendProgress(log) {
  // ящик приглашения на тест, иначе ящик из ссылки с домашкой (специалист видит, как идут занятия)
  const i0 = INV(), hb = (myReports().filter(r => r.box).at(-1) || {}).box, inv = i0 && localStorage.getItem('bp_share_' + i0.i) ? i0 : hb ? { i: hb.i, k: hb.k } : null; if (!inv) return;
  const last = +(localStorage.getItem('bp_prog_at') || 0); if (Date.now() - last < 12 * 3600e3) return;
  const pr = PROFILE();
  try { const body = await seal.encrypt(inv.k, { type: 'progress', token: inv.join ? pr && pr.token : undefined, vas: log.slice(-60) });
    const r = await fetch('/api/relay?id=' + inv.i, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (r.ok) { localStorage.setItem('bp_prog_at', String(Date.now())); track('progress_sent', {}, false); } } catch (e) {}
}

// ЦНС для уже отправленных тестов: раньше кабинет выбрасывал замеры глаз и касаний. Телефон клиента один раз досылает их,
// кабинет дописывает в оценки с той же датой. Видео и скелет не идут, только числа замеров.
async function backfillCns() {
  const inv = INV(); if (!inv || localStorage.getItem('bp_cns_bf_' + inv.i)) return;
  const items = tests().filter(t => t && t.date && (t.vns || t.touch)).slice(-10).map(t => ({ date: t.date, vns: t.vns || null, touch: t.touch || null }));
  if (!items.length) { localStorage.setItem('bp_cns_bf_' + inv.i, '1'); return; }
  try { const pr = PROFILE(); const body = await seal.encrypt(inv.k, { type: 'cns', token: inv.join ? pr && pr.token : undefined, items });
    const r = await fetch('/api/relay?id=' + inv.i, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (r.ok) { localStorage.setItem('bp_cns_bf_' + inv.i, '1'); track('cns_backfill', { n: items.length }, false); } } catch (e) {}
}

// ---------- отчет специалиста по веб-ссылке: только просмотр, без входа ----------
async function reportView(code) {
  const [id, k] = String(code).split('.');
  go('<div class="scr pad" style="justify-content:center;align-items:center"><span class="spin"></span><p class="sub">Открываю отчет…</p></div>');
  let r = null; try { if (!/^[A-Za-z0-9_-]{22}$/.test(id || '') || !/^[A-Za-z0-9_-]{43}$/.test(k || '')) throw new Error('bad');
    const res = await fetch('/api/share?id=' + id, { cache: 'no-store' }); if (!res.ok) throw new Error(res.status);
    r = await seal.decrypt(k, await res.text()); if (typeof r.img !== 'string' || !r.img.startsWith('data:image/jpeg;base64,')) throw new Error('bad'); } catch (e) { r = null; }
  if (!r) { go(`<div class="scr pad fade" style="justify-content:center;gap:14px"><h1>Отчет не открылся</h1><p class="sub">Ссылка устарела (отчет хранится 90 дней) или скопирована не целиком. Попросите специалиста прислать ее снова.</p><button class="btn" id="tst">Пройти свой тест движения</button></div>`); $('#tst').onclick = () => { history.replaceState(null, '', location.pathname); onboarding(); }; return; }
  saveReport(code, r); ackHw(myReports().find(x => x.code === String(code).slice(0, 80))); history.replaceState(null, '', location.pathname);
  const first = !lsGet('bp_wel_' + id); lsSet('bp_wel_' + id, String(Date.now()));
  return first ? clientWelcome(r, code) : reportScreen(r, code);
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const nameFirst = n => String(n || '').trim().split(/\s+/)[0] || '';
// первое открытие ссылки: от кого, что внутри и одна кнопка дальше
function clientWelcome(r, code) {
  track('client_welcome', {}, false); const exIds = (Array.isArray(r.ex) ? r.ex : []).filter(id => ex(id)), who = esc(String(r.author || 'Ваш специалист').slice(0, 80));
  const item = (icon, t, sub) => `<div class="row" style="gap:14px;align-items:flex-start"><span style="flex:none;width:44px;height:44px;border-radius:14px;background:var(--surface-2);display:grid;place-items:center">${ic(icon)}</span><div style="flex:1"><b style="font-size:16px">${t}</b><div class="sub" style="font-size:14px;line-height:1.4;margin-top:2px">${sub}</div></div></div>`;
  go(`<div class="scr fade"><div class="pad" style="padding-top:28px;display:flex;flex-direction:column;gap:18px;flex:1">
    <span class="avatar" style="width:64px;height:64px;font-size:26px">${esc(String(r.author || 'B').slice(0, 1).toUpperCase())}</span>
    <div><h1>${nameFirst(r.name) ? esc(nameFirst(r.name)) + ', здравствуйте!' : 'Здравствуйте!'}</h1><p class="sub" style="font-size:16px;margin-top:8px;line-height:1.45">Ваш специалист ${who}. Для вас готово:</p></div>
    ${item('file-text', 'Отчёт по замеру', 'Что видно в положении тела и над чем будете работать')}
    ${exIds.length ? item('play', `Домашнее задание · ${totalMin(exIds.map(ex))} мин`, `${exRowsN(exIds)} упр. Голос тренера ведёт по каждому, ничего запоминать не нужно`) : ''}
    ${item('message-square', 'Связь со специалистом', 'Если что-то непонятно или больно, напишите прямо из приложения')}
    <p class="sub" style="font-size:13px">Займёт пару минут: сначала отчёт, потом покажем, что делать дальше.</p></div>
    <div class="dock"><button class="btn" id="wgo">Посмотреть отчёт</button></div></div>`);
  $('#wgo').onclick = () => reportScreen(r, code);
}
const exRowsN = ids => new Set(ids.map(id => (ex(id).title || '').split(' (')[0])).size;
function reportScreen(r, code) {
  lsSet('bp_rep_seen', '1'); const str = (v, n) => esc(String(v || '').slice(0, n)), exIds = (Array.isArray(r.ex) ? r.ex : []).filter(id => ex(id));
  go(`<div class="scr fade" style="padding-bottom:150px"><div class="top-bar"><button class="round" id="rback" aria-label="В кабинет">${ic('chevron-left')}</button><div class="t"><b>Ваш отчёт</b></div></div>
    <div class="pad" style="padding-top:4px"><h1 style="font-size:24px">${str(r.name, 80)}</h1><p class="sub" style="font-size:14px">${str(r.date, 40)}${r.author ? ' · ' + str(r.author, 80) : ''}</p></div>
    <div class="pad" style="margin-top:12px"><img src="${r.img}" alt="Отчет" style="width:100%;display:block;border-radius:16px"></div>
    <div class="pad" style="margin-top:12px"><a class="btn line" href="${r.img}" download="bodypassport-report.jpg" style="text-decoration:none">${ic('download', 's')}Сохранить картинку</a>
    <p class="sub" style="font-size:12px;text-align:center;margin-top:8px">Отчёт сохранён в вашем кабинете на этом телефоне.</p></div>
    <div class="dock"><button class="btn" id="rnext">${exIds.length ? 'Дальше: домашнее задание' : 'Дальше: мой кабинет'}${ic('arrow-right', 's')}</button></div></div>`);
  $('#rback').onclick = clientHome; $('#rnext').onclick = clientHome;
}

// домашка живет по одной ссылке: специалист обновил упражнения, кабинет подтягивает новую версию сам
async function refreshHomework() {
  const rec = myReports().filter(r => r.upd).at(-1); if (!rec) return false; const [id, k] = rec.code.split('.');
  try { const res = await fetch('/api/share?id=' + id, { cache: 'no-store' }); if (!res.ok) return false;
    const r = await seal.decrypt(k, await res.text()); if (!(+r.upd > rec.upd)) { ackHw(rec); return false; }
    saveReport(rec.code, r); ackHw(myReports().find(x => x.code === rec.code)); lsSet('bp_hw_new', '1'); track('hw_seen', {}, false); return true; } catch (e) { return false; }
}
// специалист видит в карточке «клиент открыл»: короткое зашифрованное подтверждение в ящик из ссылки, один раз на версию
async function ackHw(rec) { const b = rec && rec.box, u = rec && +rec.upd; if (!b || !u || localStorage.getItem('bp_hw_ack') === String(u)) return;
  try { const body = await seal.encrypt(b.k, { type: 'seen', upd: u }); const res = await fetch('/api/relay?id=' + b.i, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (res.ok) localStorage.setItem('bp_hw_ack', String(u)); } catch (e) {} }
// контакт специалиста из отчета: Telegram, WhatsApp по номеру или ссылка; иначе только текст
const contactHref = t => { t = String(t || '').trim(); const tg = t.match(/(?:t\.me\/|^@)([A-Za-z0-9_]{4,32})/); if (tg) return 'https://t.me/' + tg[1];
  const d = t.replace(/[^\d+]/g, ''); if (/^\+?\d{10,15}$/.test(d)) return 'https://wa.me/' + d.replace(/^\+/, '').replace(/^8(?=\d{10}$)/, '7'); return /^https:\/\//.test(t) ? t : ''; };
// ---------- кабинет клиента: мои изменения, занятия и работа специалиста ----------
// Все хранится на этом телефоне: тесты, дневник занятий и отчеты, которые прислал специалист.
const REPS_KEY = 'bp_reports';
const myReports = () => { try { const l = JSON.parse(localStorage.getItem(REPS_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
function saveReport(code, r) {
  const s = (v, n) => String(v || '').slice(0, n), rec = { code: s(code, 80), name: s(r.name, 80), date: s(r.date, 40), author: s(r.author, 80), contact: s(r.contact, 120), at: +r.at || Date.now(),
    ex: (Array.isArray(r.ex) ? r.ex : []).filter(id => typeof id === 'string' && ex(id)).slice(0, 8), next: +r.next || 0, note: s(r.note, 600), focus: (Array.isArray(r.focus) ? r.focus : []).map(x => s(x, 120)).slice(0, 3), saved: Date.now(),
    upd: +r.upd || 0, ...(r.box && /^[A-Za-z0-9_-]{16,64}$/.test(r.box.i || '') && /^[A-Za-z0-9_-]{43}$/.test(r.box.k || '') ? { box: { i: r.box.i, k: r.box.k } } : {}) };
  try { localStorage.setItem(REPS_KEY, JSON.stringify([...myReports().filter(x => x.code !== rec.code), rec].sort((a, b) => a.at - b.at).slice(-30))); } catch (e) {}
}
let hwAt = 0;
// «Написать специалисту»: по желанию сначала короткий тест перед камерой, результат уходит ему зашифрованным в ящик из домашки
const ASK_UNITS = ['stand', 'ohs_front', 'sls', 'side'];
function askSheet(rep) {
  const href = contactHref(rep.contact), d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Написать специалисту</h2>
    ${rep.box ? `<p class="sub" style="margin-top:8px;line-height:1.45">Если есть несколько минут, сначала пройдите тест движения перед камерой. ${esc(rep.author || 'Специалист')} сразу увидит, как вы двигаетесь сейчас, и ответит точнее. Вопрос можно написать прямо в тесте. Это необязательно.</p>
    <button class="btn" id="askt" style="margin-top:var(--s4)">${ic('camera', 's')}Пройти тест · ${mins(SETUP_SEC + secs(rowsOf(ASK_UNITS)))} мин</button>` : ''}
    ${href ? `<a class="btn${rep.box ? ' line' : ''}" id="askw" href="${esc(href)}" target="_blank" rel="noopener" style="text-decoration:none;margin-top:8px">${ic('message-square', 's')}${rep.box ? 'Просто написать' : 'Написать'}</a>` : ''}
    <button class="btn ghost" id="askx" style="margin-top:8px">Отмена</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'askx') d.remove(); };
  if (d.querySelector('#askw')) d.querySelector('#askw').onclick = () => { track('hw_ask', { c: 'write' }, false); d.remove(); };
  if (d.querySelector('#askt')) d.querySelector('#askt').onclick = () => { track('hw_ask', { c: 'test' }, false); d.remove();
    localStorage.setItem('bp_inv', JSON.stringify({ i: rep.box.i, k: rep.box.k, s: String(rep.author || 'Специалист').slice(0, 80), p: ASK_UNITS })); localStorage.removeItem('bp_sent');
    if (href) localStorage.setItem('bp_ask', href); else localStorage.removeItem('bp_ask'); inviteWelcome(); };
}
export function clientHome() {
  track('client_home'); const all = tests(), last = all.at(-1), reps = myReports(), rep = reps.at(-1), inv = INV();
  const fmtD = t => new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const spec = (rep && rep.author) || (inv && inv.s) || '', next = (rep && rep.next > Date.now() - 864e5 && rep.next) || (inv && inv.d) || 0;
  // упражнения: назначенные специалистом, иначе подобранные по последнему тесту
  const own = last ? plan(topOf(spots(analyze(last, C)))) : [], repEx = rep && Array.isArray(rep.ex) ? rep.ex.filter(id => ex(id)) : [], exIds = (repEx.length ? repEx : own).filter(id => ex(id)), assigned = repEx.length > 0;
  const vl = vasLog(K('bp_vas')), st = vasStats(vl, 30), dayKey = t => new Date(t).toDateString(), doneDays = new Set(vl.filter(r => (r.n || 0) > 0).map(r => dayKey(r.t || 0)));
  const zonesOf = t => topOf(spots(analyze(t, C))).filter(x => x.k !== 'OK').length;
  const card = (h, body, extra = '') => `<div class="card" style="display:flex;flex-direction:column;gap:12px"${extra}><div class="eyebrow">${h}</div>${body}</div>`;
  const delta = all.length >= 2 && all[0].snapshot && last.snapshot ? [['Наклон плеч', all[0].snapshot.shoulderTilt, last.snapshot.shoulderTilt], ['Наклон таза', all[0].snapshot.pelvicTilt, last.snapshot.pelvicTilt]]
    .filter(([, a, b]) => Number.isFinite(a) && Number.isFinite(b)).map(([n, a, b]) => { const better = Math.abs(b) < Math.abs(a) - .5, worse = Math.abs(b) > Math.abs(a) + .5;
      return `<div class="row" style="font-size:15px"><span style="flex:1">${n}</span><span class="num" style="color:var(--sub)">${Math.abs(a).toFixed(1)}°</span><span style="margin:0 8px;color:var(--faint)">→</span><b class="num" style="color:${better ? 'var(--ok-t)' : worse ? 'var(--over-t)' : 'var(--text)'}">${Math.abs(b).toFixed(1)}°</b></div>`; }).join('') : '';
  // путь клиента по ссылке: три первых шага с прогрессом, потом каждый день одна карточка «Сегодня»
  const installed = !canInstall() || lsGet('bp_inst') === 'done', instLater = !!lsGet('bp_inst_later'), didWork = vl.some(r => (r.n || 0) > 0) || JSON.parse(localStorage.getItem(K('bp_done')) || '[]').length > 0;
  const steps = rep ? [{ id: 'rep', t: 'Посмотреть отчёт', sub: 'Что видно и над чем работаем', done: !!lsGet('bp_rep_seen'), btn: 'Открыть отчёт' },
    { id: 'inst', t: 'Установить приложение', sub: instLater && !installed ? 'Пропущено. Без иконки домашку легко потерять' : 'Иконка на экране: домашка под рукой и обновится сама', done: installed, skip: instLater, btn: 'Установить' },
    { id: 'work', t: 'Первое занятие', sub: exIds.length ? `${totalMin(exIds.map(ex))} мин, голос ведёт по каждому упражнению` : 'Упражнения появятся, когда их назначит специалист', done: didWork, btn: 'Начать', off: !exIds.length }] : [];
  const cur = steps.find(x => !x.done && !x.skip) || steps.find(x => !x.done), nDone = steps.filter(x => x.done).length, showSteps = steps.length && !(steps[0].done && steps[2].done && (installed || instLater));
  const stepRow = (x, n) => `<div class="row" style="gap:12px;align-items:flex-start;${x === cur ? '' : 'opacity:' + (x.done ? '.6' : '.85')}"><span style="flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;${x.done ? 'background:var(--ok-s);color:var(--ok-t)' : x === cur ? 'background:var(--brand);color:#fff' : 'background:var(--surface-2)'}">${x.done ? ic('check', 's') : n + 1}</span>
    <div style="flex:1;min-width:0"><b style="font-size:16px">${x.t}</b><div class="sub" style="font-size:13px;line-height:1.4;margin-top:2px">${x.sub}</div>${x === cur && !x.off ? `<button class="btn" data-step="${x.id}" style="margin-top:10px;height:46px">${x.btn}</button>${x.id === 'inst' ? '<button class="link" data-step="later" style="font-size:14px;margin-top:8px;display:block">Не сейчас</button>' : ''}` : !x.done && !x.off ? `<button class="link" data-step="${x.id}" style="font-size:14px;margin-top:4px">${x.btn}</button>` : ''}</div></div>`;
  const stepsCard = showSteps ? `<div class="card" style="display:flex;flex-direction:column;gap:14px;border:1.5px solid var(--brand)"><div class="row"><b style="flex:1;font-size:18px">Первые шаги</b><span class="sub mono" style="font-size:13px">${nDone} из ${steps.length}</span></div>
    <div style="height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${Math.round(nDone / steps.length * 100)}%;background:var(--ok-t)"></div></div>${steps.map(stepRow).join('')}</div>` : '';
  const today = doneDays.has(dayKey(Date.now())), sk = streak(), plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;
  const todayCard = !showSteps && exIds.length ? `<div class="card" style="display:flex;flex-direction:column;gap:10px;${today ? '' : 'border:1.5px solid var(--brand)'}"><div class="eyebrow">Сегодня</div>${today
    ? `<div class="row" style="gap:12px"><span style="flex:none;width:40px;height:40px;border-radius:50%;background:var(--ok-s);color:var(--ok-t);display:grid;place-items:center">${ic('check', 's')}</span><div><b style="font-size:17px">Занятие сделано</b><div class="sub" style="font-size:14px">${spec ? esc(spec) + ' видит отметку. ' : ''}Завтра продолжим${sk > 1 ? ` · ${sk} ${plural(sk, 'день', 'дня', 'дней')} подряд` : ''}</div></div></div>`
    : `<b style="font-size:18px">Занятие на сегодня · ${totalMin(exIds.map(ex))} мин</b><div class="sub" style="font-size:14px;line-height:1.4">${exRowsN(exIds)} упр. Встаньте рядом с телефоном, голос подскажет, что делать${sk ? ` · ${sk} ${plural(sk, 'день', 'дня', 'дней')} подряд, не прерывайте` : ''}</div><button class="btn" id="ctoday">${ic('play', 's')}Начать занятие</button>`}</div>` : '';
  go(`<div class="scr fade" style="padding-bottom:110px"><div class="top-bar">${all.length ? `<button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button>` : ''}<span style="flex:1"></span><button class="round" id="cset" aria-label="Настройки">${ic('settings')}</button></div>
   <div class="pad" style="padding-top:4px">${PROFILE() && PROFILE().name ? `<div class="eyebrow">${esc(PROFILE().name)}</div>` : ''}<h1 style="margin-top:6px">${rep && nameFirst(rep.name) ? esc(nameFirst(rep.name)) + ', ваш кабинет' : 'Мой прогресс'}</h1></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s3)">
    ${stepsCard}${todayCard}${showSteps ? '' : clientInstallCard()}
    ${spec || next ? card('Мой специалист', `${spec ? `<div class="row" style="gap:12px"><span class="avatar">${esc(spec.slice(0, 1).toUpperCase())}</span><div style="flex:1;min-width:0"><b style="font-size:17px">${esc(spec)}</b>${rep && rep.contact ? `<div class="sub" style="font-size:14px;user-select:text">${esc(rep.contact)}</div>` : ''}</div></div>` : ''}
      ${next ? `<div class="row" style="gap:10px;font-size:15px">${ic('calendar', 's')}<span style="flex:1">Повторный тест</span><b>${fmtD(next)}</b></div>` : ''}
      ${rep && rep.focus.length ? `<div style="font-size:15px;line-height:1.45"><div class="sub" style="font-size:13px;margin-bottom:4px">Над чем работаем</div>${rep.focus.map(x => `<div>• ${esc(x)}</div>`).join('')}</div>` : ''}
      ${rep && rep.note ? `<p style="font-size:15px;line-height:1.45;background:var(--surface-2);border-radius:12px;padding:10px 12px">${esc(rep.note)}</p>` : ''}`) : ''}
    ${exIds.length ? card(assigned ? `Упражнения от специалиста${lsGet('bp_hw_new') ? ' <span class="pill" style="background:var(--brand);color:#fff;font-size:11px;padding:2px 8px;min-height:0;margin-left:6px">Обновлено</span>' : ''}` : 'Упражнения по вашему тесту', `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${exIds.slice(0, 6).map(id => `<button class="cex" data-id="${id}" style="border:0;background:var(--surface-2);border-radius:14px;padding:4px 4px 8px;text-align:center;cursor:pointer;font:inherit;color:inherit">${exFigure(id)}<span style="display:block;font-size:12px;line-height:1.25;margin-top:2px">${esc(exLabel(ex(id)))}</span></button>`).join('')}</div>
      <button class="btn" id="cgo">${ic('play', 's')}Начать комплекс · ${totalMin(exIds.map(ex))} мин</button>
      ${assigned ? `<p class="sub" style="font-size:13px;line-height:1.45">Упражнения подобрал ваш специалист. Больно или сомневаетесь, можно ли вам упражнение, хотите добавить своё: не угадывайте, спросите его. Отметки занятий и боль до и после уходят только ему, зашифрованными.</p>${contactHref(rep.contact) || rep.box ? `<button class="btn line" id="cask">${ic('message-square', 's')}Написать специалисту</button>` : ''}` : ''}`) : ''}
    ${card('Занятия за 4 недели', `${heatmap4w(doneMinutes(JSON.parse(localStorage.getItem(K('bp_done')) || '[]')))}
      <div class="row" style="font-size:15px;gap:16px;flex-wrap:wrap"><span><b class="num">${st.activeDays || 0}</b> <span class="sub">дн. из 30</span></span>${st.avgPre != null && st.avgPost != null ? `<span><span class="sub">боль</span> <b class="num">${(+st.avgPre).toFixed(1)} → ${(+st.avgPost).toFixed(1)}</b></span>` : ''}</div>`)}
    ${card('Мои изменения', `${delta ? `${baPeriods(all)}<div id="bahw">${baBlock('bah')}</div><div style="display:flex;flex-direction:column;gap:8px"><div class="sub" style="font-size:13px">Первый тест → последний</div>${delta}</div>` : ''}
      ${all.length ? `<div class="group">${all.slice().reverse().slice(0, 8).map(t => `<button class="row-link ctest" data-d="${t.date}"><span style="flex:1;text-align:left"><b style="font-weight:600">${fmtD(t.date)} · ${testLabel(t)}</b><small class="sub" style="display:block;font-size:13px">${zonesOf(t) ? zonesOf(t) + ' ' + plural3(zonesOf(t), 'зона требует', 'зоны требуют', 'зон требуют') + ' внимания' : 'без выраженных перекосов'}</small></span>${ic('chevron-right', 's chev')}</button>`).join('')}</div>` : '<p class="sub">Тестов пока нет.</p>'}
      ${all.length === 1 ? '<p class="sub" style="font-size:14px">Пройдите тест еще раз через 3–4 недели, и здесь появится сравнение.</p>' : ''}`)}
    ${reps.length ? card('Отчеты специалиста', `<div class="group">${reps.slice().reverse().map(r => `<button class="row-link crep" data-c="${esc(r.code)}">${ic('file-text', 's')}<span style="flex:1;text-align:left">${esc(r.date || fmtD(r.at))}<small class="sub" style="display:block;font-size:13px">${esc(r.author)}</small></span>${ic('chevron-right', 's chev')}</button>`).join('')}</div>`) : ''}
   </div><div class="dock"${assigned && !all.length ? ' style="display:none"' : ''}><button class="btn${exIds.length ? ' line' : ''}" id="ctest">${ic('rotate-ccw', 's')}Пройти тест${all.length ? ' снова' : ''}</button>${all.length ? clientNav('cab') : ''}</div></div>`);
  if ($('#back')) $('#back').onclick = map; $('#cset').onclick = settings;
  const repLink = rep ? location.origin + '/#rep=' + rep.code : location.origin;
  app.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { const st = b.dataset.step; track('client_step', { c: st }, false);
    if (st === 'rep') return reportView(rep.code); if (st === 'work') return workout(exIds);
    if (st === 'inst') return installGuide({ link: repLink, client: true });
    if (st === 'later') { lsSet('bp_inst_later', String(Date.now())); track('install_later', {}, false); clientHome(); } });
  if ($('#ctoday')) $('#ctoday').onclick = () => workout(exIds);
  if ($('#cgo')) $('#cgo').onclick = () => workout(exIds);
  if ($('#cask')) $('#cask').onclick = () => askSheet(rep);
  if (Date.now() - hwAt > 10 * 60e3) { hwAt = Date.now(); refreshHomework().then(ch => { if (ch && $('#cgo')) { toast('Специалист обновил домашнее задание'); clientHome(); } }); }
  app.querySelectorAll('.cex').forEach(b => b.onclick = () => workout([b.dataset.id]));
  app.querySelectorAll('.ctest').forEach(b => b.onclick = () => { SHOW_T = +b.dataset.d; map(); });
  app.querySelectorAll('.crep').forEach(b => b.onclick = () => reportView(b.dataset.c));
  $('#ctest').onclick = () => { SHOW_T = null; again(); }; bindClientInstall(location.origin + (rep ? '/#rep=' + rep.code : '/'), clientHome); bindClientNav();
  if (delta && $('#bah')) { bindBa('bah', all[0], last);
    // период сравнения: после последнего комплекса (прошлый тест), неделя, месяц, все время
    app.querySelectorAll('.bap button').forEach(b => b.onclick = () => { const base = periodBase(all, b.dataset.p); if (!base) return;
      app.querySelectorAll('.bap button').forEach(x => x.classList.toggle('on', x === b)); $('#bahw').innerHTML = baBlock('bah'); bindBa('bah', base, last); track('ba_period', { c: b.dataset.p }, false); }); }
}

// ---------- настройки ----------
export function settings() {
  const d = document.createElement('div'); d.className = 'sheet';
  const row = (id, icon, text, extra = '') => `<button class="row-link" id="${id}"${extra}>${ic(icon, 's')}<span>${text}</span>${ic('chevron-right', 's chev')}</button>`;
  const acc = (h, body, open = false) => `<details class="acc" style="margin-top:var(--s3)"${open ? ' open' : ''}><summary style="font-weight:600;font-size:16px">${h}</summary><div style="margin-top:4px">${body}</div></details>`;
  // меню без лишнего: аккаунт, голос, связь. Редкое (копия в файл, документы, удаление) свернуто в «Ещё»
  d.innerHTML = `<div><h2>Профиль</h2>
    <div id="acc"></div>
    <div class="group" style="margin-top:var(--s3)"><div class="row" style="min-height:56px"><span style="flex:1">Голос тренера</span><button class="pill" id="vm">${voice.muted ? 'Выкл' : 'Вкл'}</button></div>
      ${row('fbk', 'message-square', 'Написать нам: ошибка или идея')}${canInstall() ? row('sinst', 'download', 'Установить на экран') : ''}${canSwitchMode() ? row('topro', 'user-plus', 'Кабинет специалиста') : ''}</div>
    ${acc('Ещё', `<div class="group">${row('shapp', 'share', 'Поделиться приложением')}${row('bkf', 'download', 'Сохранить копию в файл')}${row('rsf', 'upload', 'Восстановить из файла')}
      <button class="row-link" id="wipe" style="color:var(--over-t)">${ic('x', 's')}<span>${meSync() ? 'Удалить аккаунт и все данные' : 'Удалить все мои данные'}</span></button></div>
      <p style="margin-top:var(--s3);font-size:13px;color:var(--sub);line-height:1.6"><a href="/privacy" style="color:var(--sub)">Конфиденциальность</a> · <a href="/terms" style="color:var(--sub)">Соглашение</a> · <a href="/licenses" style="color:var(--sub)">Лицензии</a><br>Методика: Рифат Аюпов</p>`)}
    <button class="btn" id="cl" style="margin-top:var(--s4)">Готово</button></div>`;
  document.body.appendChild(d);
  // какими пунктами меню пользуются: лишнее потом убираем по данным
  d.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button[id],summary,a[href]'); if (b) track('menu', { c: b.id || (b.tagName === 'SUMMARY' ? 'more' : b.getAttribute('href')) }, false); }, true);
  d.querySelector('#fbk').onclick = () => { d.remove(); bugSheet(); };
  d.querySelector('#shapp').onclick = () => shareApp();
  d.querySelector('#bkf').onclick = () => downloadBackup(); d.querySelector('#rsf').onclick = () => pickRestore(n => { if (n) { d.remove(); tests().length ? map() : onboarding(); } });
  if (d.querySelector('#sinst')) d.querySelector('#sinst').onclick = () => { d.remove(); installNow(); };
  d.querySelector('#vm').onclick = e => { voice.muted = !voice.muted; localStorage.setItem('bp_mute', voice.muted ? '1' : '0'); e.target.textContent = voice.muted ? 'Выкл' : 'Вкл'; };
  // одно удаление вместо двух: вошел — стираем аккаунт на сервере и данные на телефоне, не вошел — только телефон
  d.querySelector('#wipe').onclick = async () => { const acc = !!meSync();
    if (!confirm(acc ? 'Удалить аккаунт навсегда? Сотрутся аккаунт, все тесты и результаты на сервере и на этом телефоне. Вернуть нельзя.' : 'Удалить все мои данные на этом телефоне: тесты, занятия, анкету? Вернуть нельзя.')) return;
    try { if (acc) { await deleteAccount(); localStorage.removeItem('bp_mode'); localStorage.removeItem('bp_acc'); } await wipeClientData(); d.remove(); toast(acc ? 'Аккаунт удален' : 'Данные удалены'); onboarding(); } catch (e) { toast('Не получилось: ' + e.message); } };
  if (d.querySelector('#topro')) d.querySelector('#topro').onclick = () => { d.remove(); openPro(); };
  d.querySelector('#cl').onclick = () => d.remove(); d.onclick = e => { if (e.target === d) d.remove(); };
  accountBlock(d.querySelector('#acc'), () => d.remove());
}
async function accountBlock(el, close) {
  const u = await getMe(true); if (!el.isConnected) return;
  if (!u) { if ((await providers()).length) { el.innerHTML = '<button class="btn line" id="login" style="margin-top:12px">Войти</button>'; el.querySelector('#login').onclick = () => { close(); const home = () => (tests().length ? map() : onboarding()); ensureLogin('client', home).then(ok => ok && home()); }; } return; }
  el.innerHTML = `<div class="group" style="margin-top:var(--s3)"><div class="row" style="min-height:64px"><span class="avatar">${esc((u.name || '?').slice(0, 1).toUpperCase())}</span><div style="flex:1;font-size:14px;line-height:1.35"><b>${esc(u.name)}</b><div style="color:var(--sub);font-size:12px">${u.provider === 'google' ? 'Google' : u.provider === 'email' ? esc(u.email || 'Почта') : 'Telegram'}</div></div><button class="pill" id="lo">Выйти</button></div>
    ${u.admin ? `<button class="row-link" id="adm">${ic('settings', 's')}<span>Администрирование</span>${ic('chevron-right', 's chev')}</button>` : ''}
    </div>`;
  el.querySelector('#lo').onclick = async () => { const out = async () => { await logout(); localStorage.removeItem('bp_mode'); localStorage.removeItem('bp_acc'); onboarding(); }; close(); if (configSync().beta !== false) exitSurvey('logout', out); else out(); };
  if (el.querySelector('#adm')) el.querySelector('#adm').onclick = () => { close(); adminScreen(); };
}
/** Панель администратора: режим приложения, участники, статистика, выгрузка данных, сброс. */
// названия экранов для статистики (в событиях — имя функции экрана, без данных людей)
const SCREEN_RU = { onboarding: 'Знакомство', prep: 'Подготовка к тесту', runProtocol: 'Тест перед камерой', analysisScreen: 'Подсчет результата', map: 'Карта тела клиента', muscle: 'Мышца подробно', workout: 'Упражнения',
  done: 'Конец занятия', clientHome: 'Кабинет клиента', inviteWelcome: 'Ссылка от специалиста', joinForm: 'Анкета по ссылке', cameraHelp: 'Нет доступа к камере', reportView: 'Отчет по ссылке',
  proHome: 'Главная специалиста', clientCard: 'Карточка клиента', result: 'Разбор теста', quickStart: 'Новая оценка', newAssessment: 'Новая оценка (клиент)', allClients: 'Все клиенты', clientForm: 'Анкета клиента',
  compare: 'Было → стало', calendarScreen: 'Календарь', profileForm: 'Личный бренд', specialtyScreen: 'Выбор специализации', motionViewer: 'Запись движения', experienceScreen: 'Мои проверки', repeatability: 'Повторяемость',
  trialEndScreen: 'Конец пробного', balanceScreen: 'Баланс', adminScreen: 'Администрирование', funnelScreen: 'Статистика', calibInbox: 'Калибровки', calibReportScreen: 'Сводка калибровки' };
const CHAN_RU = { calib: 'Ссылка калибровки', join: 'Тест по ссылке (новый клиент)', inv: 'Ссылка клиенту из карточки', pro: 'Приглашение специалиста', app: 'Ссылка на приложение', ref: 'Реферальная ссылка', report: 'Отчет по ссылке', direct: 'Напрямую' };
function chanCard(d) { const ch = Object.entries(d.channels || {}).sort((a, b) => (b[1].app_open || 0) - (a[1].app_open || 0)); if (!ch.length) return '';
  const cols = [['app_open', 'Открыли'], ['test_start', 'Начали тест'], ['test_done', 'Прошли'], ['result_sent', 'Отправили'], ['fb_sent', 'Отзыв'], ['pro_open', 'Кабинет спец.']];
  return `<div class="card" style="padding:14px 16px;overflow-x:auto"><b>Источники: откуда пришли и докуда дошли</b><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr><th style="text-align:left;padding:4px">Канал</th>${cols.map(c => `<th style="padding:4px;font-weight:600">${c[1]}</th>`).join('')}</tr>
    ${ch.map(([k, v]) => `<tr><td style="padding:4px;border-top:1px solid var(--line-2)">${esc(CHAN_RU[k] || k)}</td>${cols.map(([e]) => { const n = v[e] || 0, base = v.app_open || 0; return `<td style="padding:4px;text-align:center;border-top:1px solid var(--line-2)">${n}${e !== 'app_open' && base ? `<small style="display:block;color:var(--sub)">${Math.round(n / base * 100)}%</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</table>
    <p class="sub" style="font-size:12px;margin-top:6px">Каждая ссылка помечена своим каналом. Проценты от открывших.</p></div>`; }
function devCard(d) { const dv = Object.entries(d.devices || {}).sort((a, b) => (b[1].app_open || 0) - (a[1].app_open || 0)); if (!dv.length) return '';
  const cols = [['app_open', 'Открыли'], ['test_start', 'Начали'], ['test_done', 'Прошли'], ['pose_fail', 'Модель не загрузилась'], ['cam_err', 'Ошибка камеры']];
  const models = Object.entries(d.models || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
  return `<div class="card" style="padding:14px 16px;overflow-x:auto"><b>Устройства</b><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr><th style="text-align:left;padding:4px">Система · браузер</th>${cols.map(c => `<th style="padding:4px;font-weight:600">${c[1]}</th>`).join('')}<th style="padding:4px;font-weight:600">Кадров/с</th></tr>
    ${dv.map(([k, v]) => `<tr><td style="padding:4px;border-top:1px solid var(--line-2)">${esc(k)}</td>${cols.map(([e]) => `<td style="padding:4px;text-align:center;border-top:1px solid var(--line-2);${(e === 'pose_fail' || e === 'cam_err') && v[e] ? 'color:var(--over-t);font-weight:600' : ''}">${v[e] || 0}</td>`).join('')}<td style="padding:4px;text-align:center;border-top:1px solid var(--line-2);${v.fps && v.fps < 15 ? 'color:var(--over-t);font-weight:600' : ''}">${v.fps ?? '—'}</td></tr>`).join('')}</table>
    ${models.length ? `<p style="font-size:13px;margin-top:8px"><span class="sub">Модели:</span> ${models.map(([m, n]) => esc(m) + ' ' + n).join(', ')}</p>` : ''}
    <p class="sub" style="font-size:12px;margin-top:6px">Меньше 15 кадров в секунду — тест на этом устройстве менее точен. На iPhone модель телефона браузер не сообщает.</p></div>`; }
// пары тестов: насколько тест стабилен и есть ли эффект комплекса сверх простого повтора
function stabilityCard() { const r = C.weights && C.weights.retest; if (!r) return '<div class="card" style="padding:14px 16px"><b>Стабильность теста</b><p class="sub" style="font-size:13px;margin-top:6px">Пар тестов пока нет. Они появятся, когда люди пройдут тест после комплекса или повторят тест без упражнений.</p></div>';
  const fs = Object.entries(r.features || {}).sort((a, b) => (a[1].rel ?? 1) - (b[1].rel ?? 1)).slice(0, 8);
  return `<div class="card" style="padding:14px 16px"><b>Стабильность теста</b><p style="font-size:14px;margin-top:6px;line-height:1.5">Пар: ${r.n} (после комплекса ${r.nWorkout}, контрольных ${r.nControl}).
    Порог заметного изменения: <b>${r.mdc ?? '—'}</b> п.п.${r.effect != null ? ` Эффект комплекса сверх простого повтора: <b>${r.effect > 0 ? '+' : ''}${r.effect}</b> п.п. (минус — мышцы стали ближе к норме).` : ' Эффект комплекса появится после 30 контрольных пар.'}</p>
    ${fs.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr><th style="text-align:left;padding:4px">Признак (самые шумные сверху)</th><th style="text-align:left;padding:4px">Надежность</th><th style="text-align:left;padding:4px">Пар</th></tr>${fs.map(([k, v]) => `<tr><td style="padding:4px;border-top:1px solid var(--line-2)">${esc(k)}</td><td style="padding:4px;border-top:1px solid var(--line-2)"><b style="color:${v.rel != null && v.rel < .5 ? 'var(--over-t)' : 'inherit'}">${v.rel ?? '—'}</b></td><td style="padding:4px;border-top:1px solid var(--line-2)">${v.n}</td></tr>`).join('')}</table>` : ''}
    <p class="sub" style="font-size:12px;margin-top:6px">Надежность ниже 0,5: признак больше шумит, чем различает людей. Его правила стоит ослабить или переснять это движение.</p></div>`; }
function screensCard(d) { const sc = Object.entries(d.screens || {}).filter(([, v]) => v.n >= 2); if (!sc.length) return '';
  // «тупят»: долго на экране, много нажатий мимо кнопок, часто уходят назад
  const score = v => (v.p50 || 0) / 30 + v.miss * 2 + v.back / Math.max(1, v.n) * 5 + (v.qback || 0) / Math.max(1, v.n) * 8 + (v.skim || 0) / 25; sc.sort((a, b) => score(b[1]) - score(a[1]));
  const red = (x, bad) => `<b style="color:${bad ? 'var(--over-t)' : 'inherit'}">${x}</b>`;
  return `<div class="card" style="padding:14px 16px;overflow-x:auto"><b>Экраны: где тупят и где не читают</b><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr>${['Экран', 'Показов', 'Время, с (медиана / 90%)', 'Нажатий', 'Мимо кнопок', 'Назад', 'Сразу назад', 'Дочитали, %', 'Пролистали, %'].map(h => `<th style="text-align:left;padding:4px;font-weight:600">${h}</th>`).join('')}</tr>
    ${sc.slice(0, 20).map(([k, v]) => `<tr>${[esc(SCREEN_RU[k] || k), v.n, `${v.p50 ?? '—'} / ${v.p90 ?? '—'}`, v.taps, red(v.miss, v.miss >= 1), v.back, red(v.qback || 0, (v.qback || 0) / v.n > .15), v.depth ?? '—', red(v.skim ?? '—', v.skim >= 40)].map(x => `<td style="padding:4px;border-top:1px solid var(--line-2)">${x}</td>`).join('')}</tr>`).join('')}</table>
    <p class="sub" style="font-size:12px;margin-top:6px">Сверху экраны, где стоят дольше всего, жмут мимо кнопок и уходят назад. «Сразу назад»: ушли в первые 3 секунды, зашли не туда. «Пролистали»: долистали до конца быстрее экрана в секунду, текст не читали.
    Осторожно с выводами: эти цифры только по тем, кто дошел до экрана (кто бросил раньше, сюда не попал), а долгое время бывает и от интереса, и от непонимания. Смотрите вместе с «мимо кнопок».</p></div>`; }
/** Сводка калибровки: итог, таблица по мышцам, разбор каждого случая. Пересчитано текущими правилами по сохраненным замерам. */
function calibReportScreen(rep, back, docs = []) { const t = rep.totals, K = ['match', 'side', 'opposite', 'missed', 'notMeasured', 'extra'];
  const lw = learnWeights(docs, C), wf = v => String(v).replace('.', ',');
  const names = Object.fromEntries(docs.filter(d => d.from).map(d => [d.from.id, d.from.name || d.from.handle || d.from.id]));
  const relRows = Object.entries(lw.reliability || {}).sort((a, b) => b[1] - a[1]);
  const pct = v => v == null ? '—' : v + '%';
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Сводка калибровки · ${rep.n}</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:12px;padding-bottom:30px">
     <div class="card"><div class="row" style="gap:12px"><div style="flex:1"><div class="num" style="font-size:32px;font-weight:600">${pct(t.recall)}</div><div class="sub" style="font-size:13px">находит из того, что тест может увидеть</div></div>
       <div style="flex:1"><div class="num" style="font-size:32px;font-weight:600">${pct(t.precision)}</div><div class="sub" style="font-size:13px">гипотез приложения подтвердил специалист</div></div></div>
      <p class="sub" style="font-size:13px;line-height:1.4;margin-top:10px">Отметок специалистов ${t.expert}: ${K.slice(0, 5).map(k => RES_NAMES[k] + ' ' + (t[k] || 0)).join(', ')}. Лишних гипотез приложения ${t.extra || 0}. Пересчитано текущими правилами.</p></div>
     <div class="card" style="overflow-x:auto"><b>По мышцам</b><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr>${['Мышца', ...K.map(k => RES_NAMES[k])].map(h => `<th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--line-2);font-weight:600">${h}</th>`).join('')}</tr>
      ${rep.muscles.map(m => `<tr>${[esc(m.name), ...K.map(k => m[k] || '·')].map((v, i) => `<td style="padding:4px 6px;border-bottom:1px solid var(--line-2);${i && v !== '·' ? 'font-weight:600' : 'color:var(--sub)'}">${v}</td>`).join('')}</tr>`).join('')}</table>
      <button class="btn line" id="csv" style="margin-top:10px;height:44px">Скачать таблицу (Excel)</button></div>
     <div class="card"><b>Обучение: веса правил</b><p class="sub" style="font-size:13px;line-height:1.4;margin-top:4px">Сколько раз вывод правила подтвердили специалисты (за) и опровергли (против). Новый вес = старый × √((за+2)/(против+2)), от 0,1 до 1,5, нужно минимум 2 мнения. ${C.weightsAt ? 'Сейчас действуют веса от ' + new Date(C.weightsAt).toLocaleString('ru') + '.' : 'Сейчас действуют исходные веса.'}</p>
      ${lw.length ? lw.map(x => `<div class="row" style="gap:8px;margin-top:8px;font-size:14px;line-height:1.35"><span style="flex:1">${esc(RULE_NAMES[x.rule] || x.rule)} → ${esc(x.name)}<br><small class="sub">за ${wf(x.agree)}, против ${wf(x.disagree)} · источников ${x.sources}</small></span><b class="num" style="color:${x.nw < x.w ? 'var(--over-t)' : 'var(--ok-t,#15803D)'}">${wf(x.w)} → ${wf(x.nw)}</b></div>`).join('') + `<button class="btn" id="wapply" style="margin-top:12px;height:48px">Применить ${lw.length} ${lw.length === 1 ? 'изменение' : lw.length < 5 ? 'изменения' : 'изменений'} для всех</button>` : '<p style="font-size:14px;margin-top:8px">Пока нечего менять: мало мнений по одним и тем же правилам.</p>'}
      ${relRows.length ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line-2)"><b style="font-size:14px">Доверие к сторонним специалистам</b><p class="sub" style="font-size:12px;margin-top:2px">Насколько их проверки совпадают с вашими (или с большинством). С таким весом их мнение идет в обучение.</p>${relRows.map(([id, v]) => `<div class="row" style="font-size:14px;margin-top:6px"><span style="flex:1">${esc(names[id] || id)}</span><b>${v}%</b></div>`).join('')}</div>` : ''}
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn line" id="wundo" style="flex:1;height:44px;font-size:14px">Откатить последнее</button><button class="btn line" id="wreset" style="flex:1;height:44px;font-size:14px">Исходные веса</button></div></div>
     ${rep.cases.map(c => `<div class="card"><b>Случай ${esc(c.label)}</b> <span class="sub" style="font-size:13px">${esc(c.from || '')} · ${String(c.date).slice(0, 10)}</span>
       <ul style="margin:8px 0 0 18px;font-size:14px;line-height:1.45">${caseLines(c, C).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
       ${c.note ? `<p style="font-size:13px;line-height:1.4;margin-top:8px"><span class="sub">Заметка (не сравнивается):</span> ${esc(c.note)}</p>` : ''}
       ${c.clientNote ? `<p style="font-size:13px;line-height:1.4;margin-top:4px"><span class="sub">Человек:</span> ${esc(c.clientNote)}</p>` : ''}</div>`).join('')}
    </div></div>`);
  $('#back').onclick = back;
  const postW = async body => { const r = await fetch('/api/calib?a=weights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.status); applyRuleWeights(C.bodymap.rules, j.w, j.t); C.weightsAt = j.at; C.thresholds = j.t || {}; return j; };
  if ($('#wapply')) $('#wapply').onclick = async () => { if (!confirm('Применить новые веса? Они сразу начнут действовать у всех специалистов. Откатить можно здесь же.')) return;
    try { const cur = await fetch('/api/calib?a=weights', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ w: {} }));
      await postW({ w: { ...(cur.w || {}), ...Object.fromEntries(lw.map(x => [x.key, x.nw])) }, t: cur.t || {}, n: rep.n }); toast('Веса применены'); calibReportScreen(calibReport(docs, C), back, docs); } catch (e) { toast('Не получилось: ' + e.message); } };
  $('#wundo').onclick = async () => { try { await postW({ undo: true }); toast('Вернули предыдущие веса'); calibReportScreen(calibReport(docs, C), back, docs); } catch (e) { toast('Не получилось: ' + e.message); } };
  $('#wreset').onclick = async () => { if (!confirm('Вернуть исходные веса из базы знаний?')) return; try { const cur = await fetch('/api/calib?a=weights', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})); await postW({ w: {}, t: cur.t || {} }); toast('Исходные веса'); calibReportScreen(calibReport(docs, C), back, docs); } catch (e) { toast('Не получилось: ' + e.message); } };
  $('#csv').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reportCSV(rep)], { type: 'text/csv' })); a.download = `calibration-summary-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); };
}
/** Проверка 3D-модели: выбранная мышца подсвечивается слева (синим, «слабая») и справа (красным, «перегружена»), остальное серое. */
async function check3D(back, id = 'lower_trap') {
  const ids = Object.keys(C.muscles);
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Проверка 3D-модели</b></div>
   <div class="pad" style="padding-bottom:30px"><p class="sub" style="font-size:13px;line-height:1.4">Левая сторона человека синяя, правая красная. Если подсветилась не та мышца, напишите название через «Отзыв».</p>
    <select id="m3" class="field" style="margin-top:10px">${ids.map(k => `<option value="${k}" ${k === id ? 'selected' : ''}>${esc(C.muscles[k].name)}</option>`).join('')}</select>
    <div id="v3d" style="height:420px;margin-top:10px"></div><b id="m3n" style="display:block;text-align:center;margin-top:8px">${esc(C.muscles[id].name)}</b></div></div>`);
  $('#back').onclick = back;
  const sp = ids.map(k => ['LEFT', 'RIGHT'].map(sd => ({ id: k, side: sd, key: k + ':' + sd, k: k === id ? (sd === 'LEFT' ? 'WEAK' : 'HYPER') : 'OK', tone: k === id ? (sd === 'LEFT' ? -1 : 1) : 0, back: C.muscles[k].view === 'back' }))).flat();
  try { const v = await body3D($('#v3d'), sp, () => {}); v.turn(C.muscles[id].view === 'back'); view3d = v; } catch (e) { $('#v3d').innerHTML = '<p class="sub">3D не загрузилось</p>'; }
  $('#m3').onchange = e => check3D(back, e.target.value);
}
/** Нормы по базе: как распределен каждый замер у всех, кто прошел тест, и как часто срабатывает правило.
 *  Признак, который «срабатывает» у половины людей, не отличает проблему от нормы: порог предлагается такой, чтобы правило срабатывало примерно у каждого пятого.
 *  Сдвиг порога ограничен (от 0,7 до 1,6 исходного), нужно не меньше 30 тестов с хорошей съемкой. */
export function suggestThresholds(norms, rules, minN = 30) {
  const out = [];
  for (const r of rules) { const nf = norms[r.feature]; const key = r.absGreater != null ? 'absGreater' : r.greater != null ? 'greater' : r.less != null ? 'less' : null; if (!nf || !key || !nf.raw) continue;
    const a = nf.raw, t0 = r.t0 ?? r[key], cur = r[key];
    const fire = thr => key === 'absGreater' ? a.filter(v => Math.abs(v) > thr).length / a.length : key === 'greater' ? a.filter(v => v > thr).length / a.length : a.filter(v => v < thr).length / a.length;
    const target = key === 'absGreater' ? nf.abs80 : key === 'greater' ? a[Math.floor(a.length * .8)] : a[Math.floor(a.length * .2)];
    const lo = Math.min(t0 * .7, t0 * 1.6), hi = Math.max(t0 * .7, t0 * 1.6), sug = Math.round(Math.max(lo, Math.min(hi, target)) * 100) / 100;
    out.push({ id: r.id, feature: r.feature, key, n: nf.n, t0, cur, fire: Math.round(fire(cur) * 100), sug, fireSug: Math.round(fire(sug) * 100), ready: nf.n >= minN && Math.abs(sug - cur) / Math.max(1e-6, Math.abs(cur)) > .05 }); }
  return out.sort((x, y) => (y.ready - x.ready) || (y.fire - x.fire));
}
async function normsScreen(back) {
  go('<div class="spin"></div>');
  const [nr, cur] = await Promise.all([fetch('/api/norms?days=365', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null), fetch('/api/calib?a=weights', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ w: {}, t: {} }))]);
  const sg = nr ? suggestThresholds(nr.features, C.bodymap.rules) : [], ready = sg.filter(x => x.ready), f2 = v => String(Math.round(v * 100) / 100).replace('.', ',');
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Нормы по базе · ${nr ? nr.tests : 0} тестов</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:12px;padding-bottom:30px">
     <div class="card" style="font-size:14px;line-height:1.45">Каждый тест анонимно присылает числа замеров (без имени и записи). Здесь видно, у какой доли людей срабатывает каждое правило. Если признак есть у половины людей, он не отличает проблему от нормы: порог стоит поднять. Предложение появляется от 30 тестов с хорошей съемкой. Вместе с весами из калибровок это и есть рост точности с базой.</div>
     ${!nr ? '<div class="card">Не удалось загрузить</div>' : `<div class="card" style="overflow-x:auto"><b>Правила</b><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr>${['Правило', 'Тестов', 'Порог', 'Срабатывает', 'Предложено', 'Будет'].map(h => `<th style="text-align:left;padding:4px;font-weight:600">${h}</th>`).join('')}</tr>
      ${sg.map(x => `<tr style="${x.ready ? '' : 'color:var(--sub)'}">${[esc(RULE_NAMES[x.id] || x.id), x.n, f2(x.cur) + (x.cur !== x.t0 ? ` <small>(было ${f2(x.t0)})</small>` : ''), `<b style="color:${x.fire > 35 ? 'var(--over-t)' : 'inherit'}">${x.fire}%</b>`, x.ready ? '<b>' + f2(x.sug) + '</b>' : '—', x.ready ? x.fireSug + '%' : ''].map(v => `<td style="padding:4px;border-top:1px solid var(--line-2)">${v}</td>`).join('')}</tr>`).join('')}</table></div>`}
     ${ready.length ? `<button class="btn" id="tapply" style="height:48px">Применить ${ready.length} ${ready.length === 1 ? 'порог' : ready.length < 5 ? 'порога' : 'порогов'} для всех</button>` : '<p class="sub" style="font-size:13px">Пока нечего менять: мало тестов или пороги уже подходят.</p>'}
     <button class="btn line" id="treset" style="height:44px">Исходные пороги</button>
    </div></div>`);
  $('#back').onclick = back;
  const post = async t => { const r = await fetch('/api/calib?a=weights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ w: cur.w || {}, t, n: nr ? nr.tests : 0 }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.status); applyRuleWeights(C.bodymap.rules, j.w, j.t); C.weightsAt = j.at; C.thresholds = j.t || {}; };
  if ($('#tapply')) $('#tapply').onclick = async () => { if (!confirm('Применить новые пороги? Они сразу начнут действовать у всех. Вернуть можно кнопкой «Исходные пороги».')) return;
    try { await post({ ...(cur.t || {}), ...Object.fromEntries(ready.map(x => [x.id, x.sug])) }); toast('Пороги применены'); normsScreen(back); } catch (e) { toast('Не получилось: ' + e.message); } };
  $('#treset').onclick = async () => { if (!confirm('Вернуть исходные пороги правил?')) return; try { await post({}); toast('Исходные пороги'); normsScreen(back); } catch (e) { toast('Не получилось: ' + e.message); } };
}
/** Калибровки, присланные специалистами: список, скачать один случай или все сразу одним файлом. */
async function calibInbox(back, flt = 'all') {
  const j = await fetch('/api/calib', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null), allItems = (j && j.items) || [];
  const items = allItems.filter(x => flt === 'all' || (flt === 'own' ? x.own : !x.own));
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Калибровки · ${items.length}</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:8px;padding-bottom:30px">
     <p class="sub" style="font-size:14px;line-height:1.4">Явные калибровки (ваша оценка + тест человека) и фоновые: в бете каждая проверка специалиста в разборе («Подтверждаю», «Убрать», правка мышцы) приходит сюда сама. Имен нет.</p>
     <div class="seg">${[['all', 'Все · ' + allItems.length], ['own', 'Мои клиенты · ' + allItems.filter(x => x.own).length], ['ext', 'Специалисты · ' + allItems.filter(x => !x.own).length]].map(([k, t]) => `<button data-flt="${k}" class="${flt === k ? 'on' : ''}">${t}</button>`).join('')}</div>
     ${!j ? '<div class="card">Не удалось загрузить список</div>' : items.length ? `<button class="btn" id="calrep" style="height:48px">Сводка: где приложение совпадает со специалистами</button><button class="btn line" id="calall" style="height:48px">Скачать все одним файлом</button>` + items.map(x => `<button class="row-link card" data-p="${esc(x.p)}" style="padding:12px 14px"><span style="flex:1;text-align:left"><b style="font-weight:600">${new Date(x.at).toLocaleString('ru')}</b><br><small class="sub">${x.own ? 'мой клиент' : 'специалист'} · ${x.kind === 'auto' ? 'фоновая' : 'явная'} · ${kb(x.size)}</small></span>${ic('download', 's')}</button>`).join('') : '<div class="card">Пока ничего не прислали</div>'}
    </div></div>`);
  $('#back').onclick = back; app.querySelectorAll('[data-flt]').forEach(b => b.onclick = () => calibInbox(back, b.dataset.flt));
  const load = p => fetch('/api/calib?p=' + encodeURIComponent(p), { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const save = (obj, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  app.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { try { save(await load(b.dataset.p), 'calib-' + b.dataset.p.split('/').pop()); } catch (e) { toast('Не удалось скачать: ' + e.message); } });
  if ($('#calrep')) $('#calrep').onclick = async () => { const b = $('#calrep'); b.disabled = true; b.textContent = 'Считаю…';
    try { const docs = []; for (const x of items) docs.push(await load(x.p)); calibReportScreen(calibReport(docs, C), () => calibInbox(back, flt), docs); }
    catch (e) { b.disabled = false; b.textContent = 'Сводка'; toast('Не удалось посчитать: ' + e.message); } };
  if ($('#calall')) $('#calall').onclick = async () => { const b = $('#calall'); b.disabled = true; b.textContent = 'Собираю…';
    try { const docs = []; for (const x of items) docs.push(await load(x.p)); save({ exported: new Date().toISOString(), cases: docs }, `bodypassport-calibration-all-${new Date().toISOString().slice(0, 10)}.json`); }
    catch (e) { toast('Не удалось скачать: ' + e.message); } b.disabled = false; b.textContent = 'Скачать все одним файлом'; };
}
// почему у участника такой тариф: оплата или «Про +30 дней», пробный месяц, бета у всех или Free после пробного
const planWhy = x => { const dt = t => new Date(t).toLocaleDateString('ru');
  if (x.paidUntil > Date.now()) return `PRO до ${dt(x.paidUntil)} (${x.paidEver ? 'оплата' : 'выдан вручную'})`;
  if (x.plan === 'pro' && x.beta) return 'PRO: бета, у всех';
  if (x.plan === 'pro' && x.trialUntil > Date.now()) return `PRO: пробный до ${dt(x.trialUntil)}`;
  if (x.role !== 'specialist') return 'клиент, тариф не нужен';
  return 'Free' + (x.trialEndedBy ? ': пробный закончился после повторного теста' : x.trialUntil ? `: пробный закончился ${dt(x.trialUntil)}` : ': пробный не начат, зайдет в кабинет и начнется'); };
export async function adminScreen(back) {
  back = back || (localStorage.getItem('bp_mode') === 'pro' ? () => proHome() : () => (tests().length ? map() : onboarding()));
  const beta = configSync().beta !== false, noev = localStorage.getItem('bp_noev') === '1';
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:18px">Администрирование</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:12px;padding-bottom:32px">
     <div class="card"><b>Режим приложения</b><div class="seg" style="margin-top:10px"><button id="mb" class="${beta ? 'on' : ''}">Бета</button><button id="mf" class="${beta ? '' : 'on'}">Полный</button></div>
      <p class="sub" style="font-size:13px;margin-top:8px">${beta ? 'Бета: у всех специалистов открыты все возможности, об оплате нигде не говорится, видна пометка «бета».' : 'Полный: тариф Free (5 клиентов) и PRO с оплатой через lava.top.'}</p></div>
     <label class="card row" style="align-items:flex-start"><input type="checkbox" class="check" id="dsm" ${document.documentElement.dataset.ds === 'matte' ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Новый дизайн (Apple Matte)</b><div class="sub" style="font-size:13px">Выключите, чтобы вернуть прежний вид кабинета и лендинга. Функции не меняются. Действует на этом устройстве</div></div></label>
     <label class="card row" style="align-items:flex-start"><input type="checkbox" class="check" id="fullm" ${localStorage.getItem('bp_full') === '1' ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Полная версия</b><div class="sub" style="font-size:13px">Тест по видео, тест из дома по ссылке и сеанс в кабинете. Выключено: основа кабинета быстрый тест по 4 фото, прежние результаты по видео открываются как раньше. Действует на этом устройстве</div></div></label>
     <div class="card"><b>Режим сеанса</b><p class="sub" style="font-size:13px;margin-top:4px">Кнопка «Сеанс» в кабинете специалиста: жалобы, короткий тест, правка руками, повтор и «было → стало». Видно только вам.</p>
      <label class="row" style="margin-top:10px;gap:10px"><input type="checkbox" class="check" id="sesm" ${localStorage.getItem('bp_session_mode') === '1' ? 'checked' : ''}><span style="flex:1;font-size:15px">Включить режим сеанса</span></label>
      <label class="row" style="margin-top:6px;gap:10px"><input type="checkbox" class="check" id="sesc" ${localStorage.getItem('bp_session_ctl') === '1' ? 'checked' : ''}><span style="flex:1;font-size:15px">Контрольный повтор сразу после первого теста</span></label></div>
     <label class="card row" style="align-items:flex-start"><input type="checkbox" class="check" id="noev" ${noev ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Не учитывать мои действия</b><div class="sub" style="font-size:13px">На этом устройстве ваши тесты и клики не попадают в статистику</div></div></label>
     <div class="group">
      <button class="row-link" id="ausers">${ic('user-plus', 's')}<span>Участники</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="afun">${ic('info', 's')}<span>Статистика и отзывы</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="aexp">${ic('download', 's')}<span>Выгрузить данные для анализа</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="acal">${ic('star', 's')}<span>Калибровки от специалистов</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="anorm">${ic('cpu', 's')}<span>Нормы по базе и пороги</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="astore">${ic('download', 's')}<span>Хранилище: где лежат данные, копия</span>${ic('chevron-right', 's chev')}</button>
      ${device.webgl2 ? `<button class="row-link" id="a3d">${ic('search', 's')}<span>Проверка 3D-модели: какая мышца где</span>${ic('chevron-right', 's chev')}</button>` : ''}</div>
     <div class="card" style="border:1px solid var(--over-t)"><b>Сбросить статистику и отзывы</b><p class="sub" style="font-size:13px;margin-top:4px">Удаляет все события и отзывы на сервере. Аккаунты и клиенты не трогает. Перед сбросом сделайте выгрузку.</p>
      <input id="rsw" class="field" style="margin-top:10px;height:48px" placeholder="Напишите СБРОС" autocomplete="off"><button class="btn line" id="rsb" style="margin-top:8px;height:48px;color:var(--over-t)" disabled>Сбросить</button></div>
    </div></div>`);
  $('#back').onclick = back;
  const mode = async v => { try { await setAppMode(v); await getMe(true); toast(v ? 'Включена бета' : 'Включен полный режим'); adminScreen(back); } catch (e) { toast('Не получилось: ' + e.message); } };
  $('#mb').onclick = () => { if (!beta) mode(true); }; $('#mf').onclick = () => { if (beta) mode(false); };
  $('#noev').onchange = e => { localStorage.setItem('bp_noev', e.target.checked ? '1' : '0'); };
  $('#dsm').onchange = e => import('./ds.js').then(m => m.setDS(e.target.checked ? 'matte' : 'v3'));
  $('#fullm').onchange = e => { localStorage.setItem('bp_full', e.target.checked ? '1' : '0'); toast(e.target.checked ? 'Полная версия включена' : 'Основа: быстрый тест'); };
  $('#sesm').onchange = e => localStorage.setItem('bp_session_mode', e.target.checked ? '1' : '0'); $('#sesc').onchange = e => localStorage.setItem('bp_session_ctl', e.target.checked ? '1' : '0');
  $('#afun').onclick = () => funnelScreen();
  $('#acal').onclick = () => calibInbox(() => adminScreen(back));
  $('#anorm').onclick = () => normsScreen(() => adminScreen(back));
  // хранилище сервера: основное и копии (Vercel Blob, Cloudflare R2, домашний сервер); перенос пачками до конца
  $('#astore').onclick = async () => { let info; try { const r = await fetch('/api/store'); info = await r.json(); if (!r.ok) throw new Error(info.error || r.status); } catch (e) { return toast('Не удалось узнать: ' + e.message); }
    const N = { blob: 'Vercel Blob', s3: 'S3 (Cloudflare R2 или другое)', backup: 'резервное S3 (домашний сервер)' };
    if (!info.mirrors.length) return toast(`Данные в ${N[info.primary]}. Копии не настроены: добавьте S3_* или BACKUP_S3_* в Vercel`);
    if (!confirm(`Основное: ${N[info.primary]}. Копии: ${info.mirrors.map(m => N[m]).join(', ')}. Скопировать все старые данные в копии?`)) return;
    let cur = '', n = 0; try { do { const r = await fetch('/api/store?a=copy' + (cur ? '&cursor=' + encodeURIComponent(cur) : '')); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); n += j.copied; cur = j.cursor; toast('Скопировано файлов: ' + n); } while (cur); toast('Готово, скопировано файлов: ' + n); }
    catch (e) { toast('Остановилось на ' + n + ': ' + e.message); } };
  if ($('#a3d')) $('#a3d').onclick = () => check3D(() => adminScreen(back));
  $('#aexp').onclick = async () => { const b = $('#aexp'); b.style.opacity = .5; try { await exportData(); } catch (e) { toast('Не удалось выгрузить: ' + e.message); } b.style.opacity = 1; };
  $('#rsw').oninput = e => { $('#rsb').disabled = e.target.value.trim().toUpperCase() !== 'СБРОС'; };
  $('#rsb').onclick = async () => { if (!confirm('Точно удалить всю статистику и отзывы? Это нельзя отменить.')) return;
    const r = await fetch('/api/ev?a=reset&confirm=' + encodeURIComponent('СБРОС'), { method: 'DELETE' }); const j = await r.json().catch(() => ({}));
    toast(r.ok ? 'Удалено записей: ' + j.deleted : 'Ошибка: ' + (j.error || r.status)); if (r.ok) adminScreen(back); };
  $('#ausers').onclick = async () => { try { const list = await betaUsers();
    go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Участники · ${list.length}</b></div>
      <div class="pad" style="display:flex;flex-direction:column;gap:8px;padding-bottom:30px">${list.map(x => `<div class="card" style="padding:12px 14px;font-size:14px;line-height:1.4"><b>${esc(x.name)}</b> <span style="color:var(--sub)">${x.role === 'specialist' ? 'специалист' : 'клиент'} · ${x.provider === 'google' ? esc(x.email) : '@' + esc(x.username || 'telegram')}</span><div style="font-size:12px;color:var(--sub)">с ${new Date(x.created).toLocaleDateString('ru')}${x.ref ? ' · откуда: ' + esc(x.ref) : ''}${x.specialty ? ' · ' + esc(x.specialty) : ''} · ${planWhy(x)}${x.noStats ? ' · не в статистике' : ''}</div>${x.role === 'specialist' ? `<button class="pill" data-pro="${esc(x.id)}" style="margin-top:8px;border:1.5px solid var(--line)">Про +30 дней</button>` : ''}</div>`).join('')}</div></div>`);
    $('#back').onclick = () => adminScreen(back);
    app.querySelectorAll('[data-pro]').forEach(btn => btn.onclick = async () => { if (!confirm('Продлить Про на 30 дней?')) return;
      const r = await fetch('/api/auth?a=setplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: btn.dataset.pro, plan: 'pro', days: 30 }) }); btn.textContent = r.ok ? 'Продлено' : 'Ошибка'; });
  } catch (e) { toast(e.message); } };
}

/** Выгрузка для анализа: статистика за 90 дней, отзывы и участники одним файлом JSON. */
async function exportData() {
  const [st, fb, us] = await Promise.all([fetch('/api/ev?a=stats&days=90').then(r => r.ok ? r.json() : { error: r.status }), fetch('/api/feedback').then(r => r.ok ? r.json() : { error: r.status }), betaUsers().catch(e => ({ error: e.message }))]);
  const data = { exported: new Date().toISOString(), app: location.host, mode: configSync().beta !== false ? 'beta' : 'full', stats: st, feedback: fb, users: us };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name = 'bodypassport-data-' + new Date().toISOString().slice(0, 10) + '.json', file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) {} }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); toast('Файл сохранен: ' + name);
}

// ---------- воронка беты (только администратор): обезличенные шаги из js/track.js ----------
const FUNNEL = [['client', 'Клиент', [['app_open', 'Открыли приложение'], ['onb_done', 'Прошли знакомство'], ['login_ok', 'Вошли'], ['safety_ok', 'Скрининг: можно'], ['safety_stop', 'Скрининг: к врачу'],
  ['test_start', 'Начали тест'], ['test_done', 'Закончили тест'], ['test_cancel', 'Прервали тест'], ['map_view', 'Открыли карту'], ['share_result', 'Поделились'], ['inv_open', 'Открыли ссылку специалиста'], ['result_sent', 'Отправили результат'], ['result_fail', 'Не смогли отправить'], ['fb_sent', 'Оставили оценку или отзыв'], ['ref_share', 'Поделились приложением'], ['install_shown', 'Видели «Установить»'], ['install_ok', 'Установили на экран']]],
  ['pro', 'Специалист', [['pro_open', 'Открыли кабинет'], ['assess_start', 'Начали оценку'], ['assess_done', 'Закончили оценку'], ['report_sent', 'Отчет клиенту'], ['retest_set', 'Назначили ретест'], ['invite_sent', 'Ссылка клиенту'], ['join_sent', 'Общая ссылка'], ['result_pulled', 'Получили результат из дома'], ['retest_done', 'Сделали ретест'], ['compare_open', 'Открыли «Было → стало»'], ['report_shared', 'Отправили отчет'], ['gate_hit', 'Уперлись в тариф'], ['paywall_view', 'Видели шторку PRO'], ['limit_hit', 'Уперлись в лимит ведения'], ['pro_click', 'Нажали «PRO»'], ['pay_redirect', 'Перешли к оплате'], ['paid', 'Оплатили PRO'], ['trial_end', 'Пробный закончился ретестом'], ['trial_end_view', 'Видели конец пробного'], ['balance_pay', 'Оплатили PRO балансом'], ['backup_done', 'Сделали копию'], ['db_empty', 'Пустой кабинет после входа'], ['db_other', 'Нашли базу другого входа'], ['fb_sent', 'Оценка или отзыв'], ['bug_sent', 'Сообщили о проблеме']]]];
export async function funnelScreen(days = 14) {
  go('<div class="spin"></div>');
  let d; try { const r = await fetch('/api/ev?a=stats&days=' + days, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); d = await r.json(); } catch (e) { toast('Не удалось загрузить: ' + e.message); return map(); }
  const sum = k => Object.values(d.events[k] || {}).reduce((x, y) => x + y, 0);
  const block = ([role, name, steps]) => { const base = sum(role + ':' + steps[0][0]) || 1;
    return `<div class="card" style="padding:14px 16px"><b>${name}</b>${steps.map(([k, t]) => { const n = sum(role + ':' + k);
      return `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${t}</span><b>${n}</b><span style="width:52px;text-align:right;color:var(--sub)">${Math.round(n / base * 100)}%</span></div>`; }).join('')}</div>`; };
  // ошибки: { текст: { n, days: { дата: число }, own } }; старый ответ сервера был { текст: число }
  const errs = Object.entries(d.errors || {}).map(([m, v]) => typeof v === 'number' ? [m, { n: v, days: {}, own: true }] : [m, v]).sort((a, b) => b[1].n - a[1].n);
  const src = Object.entries(d.sources || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const [fb, users] = await Promise.all([fetch('/api/feedback?days=' + Math.max(days, 30), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null), betaUsers().catch(() => [])]);
  const refs = users.filter(u => u.invited && !u.noStats).sort((a, b) => b.invitedPro - a.invitedPro || b.invited - a.invited).slice(0, 10);
  const kind = { result: 'оценка теста', nps: 'порекомендует', free: 'отзыв', bug: 'проблема' };
  const bugs = fb ? fb.items.filter(x => x.k === 'bug') : [], M = d.medians || {}, med = (k, u = '') => M[k] ? `${M[k].p50}${u} <span style="color:var(--sub)">(p90 ${M[k].p90}, n ${M[k].n})</span>` : '—';
  const det = (k, t) => { const o = Object.entries((d.detail || {})[k] || {}).sort((a, b) => b[1] - a[1]).slice(0, 8); return o.length ? `<div style="margin-top:10px;font-size:13px"><b>${t}</b>${o.map(([c, n]) => `<div class="row" style="margin-top:4px"><span style="flex:1;word-break:break-word">${esc(c)}</span><b>${n}</b></div>`).join('')}</div>` : ''; };
  const weeks = Object.entries(d.weeks || {}).sort(), us = (d.users || []).filter(u => u.r === 'pro');
  const exitCard = fb && fb.exitN ? `<div class="card" style="padding:14px 16px"><b>Анкета беты при выходе (${fb.exitN})</b><div style="font-size:14px;margin-top:8px">Средняя оценка: <b>${String(fb.exitAvg).replace('.', ',')}</b> из 5 · получилось: да ${fb.exitGoals.yes}, частично ${fb.exitGoals.partly}, нет ${fb.exitGoals.no}</div>
    ${Object.entries(fb.exitIssues || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="row" style="font-size:13px;margin-top:6px"><span style="flex:1">${esc(k)}</span><b>${n}</b></div>`).join('')}
    ${fb.items.filter(x => x.k === 'exit' && x.t).slice(0, 8).map(x => `<div style="font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2)"><b>${x.s}/5</b> ${esc(x.t)}</div>`).join('')}</div>` : '<div class="card" style="padding:14px 16px"><b>Анкета беты при выходе</b><div class="sub" style="font-size:13px;margin-top:6px">Пока ответов нет</div></div>';
  // анкета специалистов (BP-17): сводка и полная выгрузка таблицей
  const proItems = fb ? fb.items.filter(x => x.k === 'pro') : [], useRu = { yes: 'да', maybe: 'может быть', no: 'нет' };
  const proCard = `<div class="card" style="padding:14px 16px"><b>Анкета специалистов (${fb ? fb.proN || 0 : 0})</b>${fb && fb.proN ? `<div style="font-size:14px;margin-top:8px">Польза: <b>${fb.proAvg != null ? String(fb.proAvg).replace('.', ',') : '—'}</b> из 10 · с клиентами: да ${fb.proUse.yes}, может быть ${fb.proUse.maybe}, нет ${fb.proUse.no}</div>
    ${proItems.slice(0, 10).map(x => { const q = x.q || {}; return `<div style="font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2);line-height:1.45"><b>${x.s ?? '—'}/10 · ${useRu[q.use] || '—'}</b> <span style="color:var(--sub)">${esc(x.name || x.uid || '')} · ${new Date(x.at).toLocaleDateString('ru')}</span>${[['why', 'Почему'], ['clear', 'Понятно / нет'], ['missing', 'Не хватило'], ['pay', 'Оплата']].map(([k, t]) => q[k] ? `<br>${t}: ${esc(q[k])}` : '').join('')}</div>`; }).join('')}` : '<div class="sub" style="font-size:13px;margin-top:6px">Пока нет ответов</div>'}
    <a class="btn ghost" href="/api/feedback?k=pro&format=csv&days=365" download style="margin-top:12px;height:44px">${ic('download', 's')}Скачать все ответы (CSV)</a></div>`;
  const bugCard = `<div class="card" style="padding:14px 16px"><b>Проблемы от участников (${bugs.length})</b>${bugs.length ? bugs.slice(0, 30).map(x => { const g = x.d || {};
      return `<details style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2);font-size:14px"><summary style="cursor:pointer;line-height:1.4"><span style="color:var(--sub);font-size:12px">${new Date(x.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${x.r === 'pro' ? 'специалист' : 'клиент'} · ${esc(g.os || '')} ${esc(g.br || '')}</span><br>${esc(x.t)}</summary>
        <div style="font-size:12px;color:var(--sub);margin-top:6px;line-height:1.5;word-break:break-word">${esc([g.scr, g.pwa ? 'PWA' : 'браузер', g.net, g.mem ? g.mem + ' ГБ' : '', g.cpu ? g.cpu + ' ядер' : '', g.model ? 'модель ' + g.model + ' ' + (g.deleg || '') : '', g.loadSec ? 'загрузка ' + g.loadSec + ' с' : '', g.fps ? g.fps + ' fps' : '', g.persisted === false ? 'хранилище НЕ закреплено' : g.persisted ? 'хранилище закреплено' : ''].filter(Boolean).join(' · '))}
        ${g.errors && g.errors.length ? '<div style="color:var(--over-t);margin-top:4px">' + g.errors.map(esc).join('<br>') + '</div>' : ''}${g.trail ? '<div style="margin-top:4px;font-family:monospace;font-size:11px">' + g.trail.map(esc).join('<br>') + '</div>' : ''}
        ${x.contact ? `<div style="margin-top:4px;color:var(--weak-t)">Контакт: ${esc(x.contact.name)} ${esc(x.contact.handle)}</div>` : ''}</div></details>`; }).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока никто не сообщил</div>'}</div>`;
  const techCard = `<div class="card" style="padding:14px 16px"><b>Техника камеры</b><div style="font-size:13px;margin-top:8px;line-height:1.7">Загрузка модели, с: ${med('pose_init.d')}<br>Встать в кадр, с: ${med('setup.d')}<br>Подсказок до кадра: ${med('setup.n')}<br>Кадров в секунду: ${med('cam_q.n')}<br>Худшее качество шага: ${med('cam_q.q')}<br>Длина теста, с: ${med('test_done.d')}</div>
    ${det('try_click', 'Лендинг: что нажимают в примерах')}${det('menu', 'Меню профиля: чем пользуются')}${det('qback', 'Сразу назад: зашли не туда')}${det('pose_init', 'Где считается модель')}${det('pose_fail', 'Модель не загрузилась')}${det('cam_err', 'Ошибки камеры')}${det('retake', 'Пересъемки по шагам')}${det('step_skip', '«Не могу» по шагам')}${det('rage', 'Злые тапы (4 нажатия подряд)')}${det('slow', 'Подвисания интерфейса')}${det('storage', 'Хранилище кабинета')}${det('gate_hit', 'Упор в тариф')}</div>`;
  const usersCard = `<div class="card" style="padding:14px 16px"><b>Специалисты по неделям</b><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px;font-size:13px">${weeks.length ? weeks.map(([w, n]) => `<span class="pill">с ${esc(w.slice(5))}: <b>${n}</b></span>`).join('') : '<span class="sub">Пока нет данных</span>'}</div>
    ${us.length ? `<div style="margin-top:10px;font-size:12px;color:var(--sub)">Псевдоним · активных дней · оценок · отчетов · ретестов · проблем</div>` + us.slice(0, 40).map(u => `<div class="row" style="font-size:13px;margin-top:4px;font-family:monospace"><span style="flex:1">${esc(u.id)}</span><span>${u.days} · ${u.assess} · ${u.reports} · ${u.retests} · ${u.bugs}</span></div>`).join('') : ''}
    <p class="sub" style="font-size:12px;margin-top:8px">Псевдоним одинаков у одного аккаунта, но имя и почту по нему не узнать.</p></div>`;
  // главное по стратегии: ценность → использование → повтор → оплата; по дням столбиками
  const both = k => sum('client:' + k) + sum('pro:' + k), perDay = k => d.days.map(x => ((d.events['client:' + k] || {})[x] || 0) + ((d.events['pro:' + k] || {})[x] || 0));
  const pros = (d.users || []).filter(u => u.r === 'pro'), back2 = pros.filter(u => u.days >= 2).length;
  const STEPS = [['page_view', 'Зашли на сайт'], ['pro_open', 'Открыли кабинет'], ['signup', 'Зарегистрировались'], ['first_test', 'Первый тест'], ['first_report', 'Первый отчет клиенту'], ['retest_14d', 'Повтор за 14 дней'], ['pay_redirect', 'Перешли к оплате'], ['paid', 'Оплатили']];
  const cnt = k => k === 'paid' ? sum('pro:paid') : both(k);
  const bars = (a, c = 'var(--accent, #0EA5E9)') => { const mx = Math.max(1, ...a); return `<div style="display:flex;align-items:flex-end;gap:2px;height:44px;margin-top:8px">${a.map((v, i) => `<i title="${d.days[i]}: ${v}" style="flex:1;min-width:2px;height:${v ? Math.max(6, v / mx * 100) : 2}%;background:${v ? c : 'var(--line-2)'};border-radius:2px"></i>`).join('')}</div><div class="row" style="font-size:11px;color:var(--sub);margin-top:2px"><span style="flex:1">${d.days[0].slice(5).split('-').reverse().join('.')}</span><span>${d.days.at(-1).slice(5).split('-').reverse().join('.')}</span></div>`; };
  const mainCard = `<div class="card" style="padding:14px 16px"><b>Главное за ${days} дней</b>
    <div class="kpi" style="margin-top:10px"><div><b class="mono">${pros.length}</b><span>специалистов работали</span></div><div><b class="mono">${back2}</b><span>вернулись 2+ дня</span></div><div><b class="mono">${sum('pro:paid')}</b><span>оплат</span></div></div>
    ${STEPS.map(([k, t], i) => { const n = cnt(k), prev = i ? cnt(STEPS[i - 1][0]) : 0; return `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${t}</span><b class="mono">${n}</b><span class="mono" style="width:56px;text-align:right;color:var(--sub)">${i && prev ? Math.round(n / prev * 100) + '%' : ''}</span></div>`; }).join('')}
    <p class="sub" style="font-size:12px;margin-top:6px">Процент от шага выше. Вкладки, а не люди: один человек с двух устройств считается дважды.</p>
    <div style="font-size:13px;margin-top:10px"><b>Заходы на сайт по дням</b>${bars(perDay('page_view'))}</div>
    <div style="font-size:13px;margin-top:8px"><b>Тесты по дням</b>${bars(d.days.map((x, i) => perDay('first_test')[i] + ((d.events['pro:assess_done'] || {})[x] || 0)), '#34C759')}</div>
    <p class="sub" style="font-size:12px;margin-top:8px">Без аккаунтов владельца и тестовых${d.excluded ? ` (отброшено записей: ${d.excluded})` : ''}.</p>
    <button class="btn line" id="purge" style="margin-top:6px;height:44px">Удалить с сервера их прежние данные</button></div>`;
  const own = errs.filter(([, v]) => v.own), ext = errs.filter(([, v]) => !v.own), fmt = x => x.slice(5).split('-').reverse().join('.');
  const errRow = ([m, v]) => { const ds = Object.keys(v.days).sort(); return `<div style="font-size:13px;margin-top:10px;word-break:break-word"><b>${v.n}×</b> ${esc(m)}${ds.length ? `<div style="font-size:12px;color:var(--sub);margin-top:2px">${ds.length > 1 ? `с ${fmt(ds[0])} по ${fmt(ds.at(-1))} · ` : ''}${ds.slice(-8).map(x => fmt(x) + (v.days[x] > 1 ? ' ×' + v.days[x] : '')).join(', ')}</div>` : ''}</div>`; };
  const errCard = `<div class="card" style="padding:14px 16px"><b>Ошибки приложения (${own.reduce((a, [, v]) => a + v.n, 0)})</b>${own.length ? bars(d.days.map(x => (d.errDays || {})[x] || 0), 'var(--over-t, #FF453A)') + own.slice(0, 15).map(errRow).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Ошибок нет</div>'}
    ${ext.length ? `<details style="margin-top:12px"><summary class="sub" style="font-size:13px;cursor:pointer">Чужие скрипты (${ext.reduce((a, [, v]) => a + v.n, 0)}): встроенные браузеры Instagram и Facebook, расширения</summary>${ext.slice(0, 15).map(errRow).join('')}<p class="sub" style="font-size:12px;margin-top:8px">Не из кода BodyPassport, с 28.10 не записываются.</p></details>` : ''}</div>`;
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Статистика · ${days} дней</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:10px;padding-bottom:30px">
     <p class="sub" style="font-size:13px">Число вкладок, где шаг был хотя бы раз, сумма по дням. Процент от первого шага.</p>
     <div class="seg">${[7, 30, 90].map(n => `<button data-d="${n}" class="${n === days ? 'on' : ''}">${n} дней</button>`).join('')}</div>
     ${mainCard}
     ${errCard}
     ${bugCard}
     ${chanCard(d)}${devCard(d)}${screensCard(d)}${stabilityCard()}
     ${proCard}
     ${exitCard}
     ${fb && fb.testN ? `<div class="card" style="padding:14px 16px"><b>Анкета после теста (${fb.testN})</b><div style="font-size:14px;margin-top:8px">Средняя оценка: <b>${String(fb.testAvg).replace('.', ',')}</b> из 5</div>
      ${Object.entries(fb.testIssues || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="row" style="font-size:13px;margin-top:6px"><span style="flex:1">${esc(k)}</span><b>${n}</b></div>`).join('')}
      ${fb.items.filter(x => x.k === 'test' && x.t).slice(0, 10).map(x => `<div style="font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2)"><b>${x.s}/5</b>${x.q && x.q.cal ? ' · калибровка' : ''}${x.q && x.q.src ? ' · ' + esc(x.q.src) : ''} ${esc(x.t)}</div>`).join('')}</div>` : ''}
     ${FUNNEL.map(block).join('')}
     ${usersCard}
     ${techCard}
     <div class="kpi"><div><b>${d.testMedianSec ? Math.round(d.testMedianSec / 60 * 10) / 10 : '—'}</b><span>мин на тест, медиана (${d.testN || 0})</span></div><div><b>${fb && fb.resultAvg != null ? fb.resultAvg : '—'}</b><span>польза теста из 5 (${fb ? fb.resultN : 0})</span></div><div><b>${fb && fb.nps != null ? fb.nps : '—'}</b><span>NPS специалистов (${fb ? fb.npsN : 0})</span></div></div>
     <div class="card" style="padding:14px 16px"><b>Откуда приходят</b>${src.length ? src.map(([k, n]) => `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1;word-break:break-all">${esc(k)}</span><b>${n}</b></div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока нет данных</div>'}<p class="sub" style="font-size:12px;margin-top:8px">Метка из ссылки ?ref= или ?utm_source=. Коды r… это приглашения пользователей.</p></div>
     <div class="card" style="padding:14px 16px"><b>Приглашения</b>${refs.length ? refs.map(u => `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${esc(u.name)}</span><span style="color:var(--sub)">${u.invited} пришли · </span><b>${u.invitedPro} спец.</b></div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока никто не пригласил</div>'}</div>
     <div class="card" style="padding:14px 16px"><b>Отзывы</b>${fb && fb.items.some(x => x.k !== 'bug') ? fb.items.filter(x => x.k !== 'bug').slice(0, 40).map(x => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2);font-size:14px;line-height:1.45"><div class="row" style="gap:8px;font-size:12px;color:var(--sub)"><span>${new Date(x.at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span><span>${x.r === 'pro' ? 'специалист' : 'клиент'}</span><span>${kind[x.k] || ''}${x.s != null ? ': <b style="color:var(--text)">' + x.s + '</b>' : ''}</span></div>${x.t ? `<div style="margin-top:4px">${esc(x.t)}</div>` : ''}${x.contact ? `<div style="margin-top:4px;font-size:13px;color:var(--weak-t)">Можно связаться: ${esc(x.contact.name)} ${esc(x.contact.handle)}</div>` : ''}</div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Отзывов пока нет</div>'}</div>
    </div></div>`);
  $('#back').onclick = () => adminScreen();
  app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => funnelScreen(+b.dataset.d));
  $('#purge').onclick = async () => { if (!confirm('Удалить с сервера все прежние события и отзывы аккаунтов владельца и тестовых? Остальные данные останутся.')) return;
    const b = $('#purge'); b.disabled = true; b.textContent = 'Удаляю…';
    const r = await fetch('/api/ev?a=purge', { method: 'DELETE' }).catch(() => null), j = r ? await r.json().catch(() => ({})) : {};
    if (r && r.ok) { toast(`Удалено записей: ${j.deleted} из ${j.checked}`); funnelScreen(days); } else { b.disabled = false; b.textContent = 'Удалить с сервера их прежние данные'; toast('Ошибка: ' + (j.error || (r ? r.status : 'сеть'))); } };
}

/** Все данные клиента на этом телефоне: тесты, отчеты, занятия, анкета, ссылка, комментарии, записи движения. Настройки (звук, камера) и согласие остаются. */
const KEEP = /^bp_(mode|ref|src|sid|noev|back|mute|login_role|legacy_pro|legacy_client|consent)/;
async function wipeClientData() {
  for (const k of Object.keys(localStorage)) if (k.startsWith('bp_') && !KEEP.test(k) && !/consent/i.test(k)) localStorage.removeItem(k);
  await consumerPoses.clear().catch(() => {}); await outbox.clear().catch(() => {}); try { indexedDB.deleteDatabase('bodypassport-client'); } catch (e) {}
  SHARED = null; SHOW_T = null; }
/** Специалист удалил клиента: ссылка закрыта. Убираем ее и отчеты, показываем понятное сообщение. */
async function checkInvAlive() { const inv = INV(); if (!inv || !inv.i) return;
  const j = await fetch('/api/relay?a=alive&id=' + encodeURIComponent(inv.i), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  if (j && j.alive === false) { for (const k of ['bp_inv', 'bp_reports', 'bp_sent']) localStorage.removeItem(k); toast(`${inv.s || 'Специалист'} закрыл доступ по ссылке. Ваши тесты остались на телефоне`); return; }
  // специалист сменил тест после отправки ссылки: берем назначенный сейчас
  if (j && Array.isArray(j.p)) { const p = sortUnits(j.p.filter(u => Object.prototype.hasOwnProperty.call(UNITS, u))); if (p.length && p.join() !== (inv.p || []).join()) { try { const o = JSON.parse(localStorage.getItem('bp_inv') || 'null'); if (o) { o.p = p; localStorage.setItem('bp_inv', JSON.stringify(o)); if (app.querySelector('#share_ok')) inviteWelcome(); } } catch (e) {} } } }

// ---------- старт ----------
// старые записи скелета на телефоне клиента больше не нужны: освобождаем место один раз
try { if (!localStorage.getItem('bp_poses_wiped')) { consumerPoses.clear().catch(() => {}); indexedDB.deleteDatabase('bodypassport-client'); localStorage.setItem('bp_poses_wiped', '1'); } } catch (e) {}
startPassive(); // фоновый сбор касаний и ритма набора с первого экрана (только SELF_TEST)
(async () => {
  track('app_open', { r: REF + (localStorage.getItem('bp_camp') ? '/' + localStorage.getItem('bp_camp') : ''), c: channel() });
  // бета: с какого устройства зашли, чтобы потом оптимизировать под iPhone и Android
  deviceInfo().then(d => track('device', { c: d.os + ' · ' + d.br, m: d.model || d.cls, n: d.mem || 0, r: d.pwa ? 'pwa' : 'web' })).catch(() => {});
  try { await loadContent(); } catch (e) { app.innerHTML = '<div class="scr pad" style="justify-content:center;gap:16px"><h1>Не удалось загрузить данные</h1><p class="sub">Проверь интернет и обнови страницу.</p><button class="btn" id="rl">Обновить</button></div>'; $('#rl').onclick = () => location.reload(); return; }
  mountBugTab(); await voice.init();
  // кнопка «Войти» из письма: входим и открываем свой режим (кабинет специалиста или карту клиента)
  { const ml = await mailLinkLogin(); if (ml && ml.error) toast('Ссылка для входа устарела: запросите новое письмо'); else if (ml && ml.role === 'specialist') localStorage.setItem('bp_mode', 'pro'); }
  await Promise.all([getMe(), config()]); claimLegacy(); await restoreIfEmpty().catch(() => 0); mountBetaBar(); if (localStorage.getItem('bp_mode') !== 'pro') checkInvAlive();
  if ('serviceWorker' in navigator) {
    // новая версия ждет, пока человек нажмет «Обновить»: молчаливая перезагрузка сбивала тест и формы
    let reloaded = false, asked = false; const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && asked && !reloaded) { reloaded = true; location.reload(); } });
    const offer = w => { if (!w || !had || document.getElementById('updbar')) return;
      const show = () => { if (cam.running || document.querySelector('.cam')) return setTimeout(show, 5000);
        const d = document.createElement('div'); d.id = 'updbar'; d.setAttribute('role', 'status');
        d.innerHTML = `<span>${ic('download', 's')}Есть обновление</span><button id="updgo">Обновить</button><button id="updx" aria-label="Позже">${ic('x', 's')}</button>`;
        document.body.appendChild(d); track('update_offer', {}, false);
        d.querySelector('#updgo').onclick = () => { asked = true; d.querySelector('#updgo').textContent = 'Обновляю…'; w.postMessage('skip'); setTimeout(() => { if (!reloaded) location.reload(); }, 3000); };
        d.querySelector('#updx').onclick = () => d.remove(); };
      show(); };
    navigator.serviceWorker.register('sw.js').then(r => {
      if (r.waiting) offer(r.waiting);
      r.addEventListener('updatefound', () => { const w = r.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
      r.update().catch(() => {});
      // приложение может висеть открытым днями: проверяем обновление при возврате и раз в полчаса
      document.addEventListener('visibilitychange', () => { if (!document.hidden) r.update().catch(() => {}); }); setInterval(() => r.update().catch(() => {}), 30 * 60e3);
    }).catch(() => {});
  }
  if (location.hash.startsWith('#tgAuthResult=')) { let data = null;
    try { const b = location.hash.slice(14).replace(/-/g, '+').replace(/_/g, '/'); data = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); } catch (e) {}
    history.replaceState(null, '', location.pathname); let role = 'client';
    if (data && data.hash) { try { role = await tgWebLogin(data); claimLegacy(); } catch (e) { toast('Не получилось войти через Telegram: ' + e.message); } }
    return role === 'specialist' ? openPro() : INV() ? inviteWelcome() : prep(); }
  if (q.get('tgauth') && q.get('hash') && q.get('id')) { const data = {}; for (const k of ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash']) if (q.get(k)) data[k] = q.get(k);
    history.replaceState(null, '', location.pathname); let role = 'client';
    try { role = await tgWebLogin(data); claimLegacy(); } catch (e) { toast('Не получилось войти через Telegram: ' + e.message); }
    return role === 'specialist' ? openPro() : INV() ? inviteWelcome() : prep(); }
  if (location.hash.startsWith('#rep=')) return reportView(location.hash.slice(5));
  setTimeout(() => backfillCns().catch(() => {}), 5000);
  if (location.hash.startsWith('#r=')) { try { SHARED = cleanResult(await unpackResult(location.hash.slice(3))); } catch (e) { SHARED = null; } }
  if (location.hash.startsWith('#join=')) { try { const inv = { ...cleanInv(seal.unpack(location.hash.slice(6))), join: true }; localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  if (location.hash.startsWith('#inv=')) { try { const inv = cleanInv(seal.unpack(location.hash.slice(5))); localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  // ссылка из уведомления бота «результат в кабинете»
  const proLink = new URLSearchParams(location.search).get('pro') === '1';
  if (proLink) { localStorage.setItem('bp_mode', 'pro'); history.replaceState(null, '', location.pathname); }
  // режим специалиста по умолчанию не включаем: без входа (или без явной ссылки «в кабинет») человек — клиент.
  // Иначе гость, открывший соглашение и обновивший страницу, попадал в кабинет специалиста.
  if (localStorage.getItem('bp_mode') === 'pro' && !proLink && !(meSync() && meSync().role === 'specialist')) localStorage.setItem('bp_mode', 'client');
  if (!SHARED && localStorage.getItem('bp_mode') === 'pro') return openPro();
  SHARED ? map() : myReports().length ? clientHome() : tests().length ? map() : platform() === 'installed' ? pasteLink() : onboarding();
})();
// установленное приложение открылось пустым (на iPhone у приложения своя память, отдельная от Safari): вставить ссылку от специалиста
function pasteLink() {
  track('paste_link_view', {}, false);
  go(`<div class="scr pad fade" style="justify-content:center;gap:14px"><img src="icons/bp7-192.png" alt="" width="64" height="64" style="border-radius:16px">
    <h1>Вставьте ссылку от специалиста</h1><p class="sub" style="line-height:1.45">На iPhone приложение не видит то, что было открыто в Safari. Вставьте ссылку, которую прислал специалист: откроются отчёт, домашка и ваш кабинет.</p>
    <button class="btn" id="plp">Вставить ссылку</button><input id="pli" class="field" placeholder="или вставьте сюда вручную" style="height:48px" aria-label="Ссылка от специалиста">
    <p class="sub" id="plerr" style="font-size:13px;color:var(--over-t)" hidden>Это не ссылка BodyPassport с отчётом. Попросите специалиста прислать её снова.</p>
    <button class="btn line" id="plt" style="margin-top:8px">Пройти тест самому</button><button class="link" id="pls" style="font-size:14px">Я специалист</button></div>`);
  const open = t => { const m = String(t || '').match(/#rep=([A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43})/); if (!m) { $('#plerr').hidden = false; return; } track('paste_link_ok', {}, false); reportView(m[1]); };
  $('#plp').onclick = async () => { try { open(await navigator.clipboard.readText()); } catch (e) { $('#pli').focus(); } };
  $('#pli').oninput = e => { if (e.target.value.includes('#rep=')) open(e.target.value); };
  $('#plt').onclick = onboarding; $('#pls').onclick = () => { localStorage.setItem('bp_mode', 'pro'); openPro(); };
}
