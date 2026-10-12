// BodyPassport web: тот же поток, тексты и дизайн, что в Android-версии.
import { P, F, G, Movement, sideView, levelled, analyze, fmt, standSnapshot, sideSnapshot, features } from './analysis.js';
import { track, vasSave, vasLog, vasStats, vasDelta, channel, screenView, deviceInfo } from './track.js';
import { bugSheet, rateCard, bindRate, installCard, bindInstall, installNow, canInstall, feedbackSheet, shareApp, appLink, mountBugTab, mountBetaBar, exitSurvey, testSurvey } from './grow.js';
import { proHome, motionViewer, consumerPoses, canSwitchMode } from './pro.js';
import { seal } from './core.js';
import { calibReport, reportCSV, caseLines, RES_NAMES, learnWeights } from './calibreport.js';
import { RULE_NAMES } from './evidence.js';
import { applyRuleWeights } from './core.js';
import { configSync, ensureLogin, linkConsent, linkConsentOk, safetyOk, safetyScreen, getMe, meSync, tgWebLogin, mailLinkLogin, logout, deleteAccount, betaUsers, providers, config, setAppMode } from './auth.js';
import { exFigure, hasFigure } from './exfig.js';
import { recordTest, saveBlob } from './core.js';
import { sayText } from './saytext.js';
import { repCounter, repKind, targetReps, setsOf, REP_KINDS } from './repcount.js';
import { ready3D, C, loadContent, voice, sleep, phone, startMotion, initPose, poseInfo, notePoseSpeed, prefetchPose, cam, startCamera, stopCamera, fullyVisible, drawSkeleton, drawSilhouette, drawHeat, drawMark, RAMP_CSS, body3D, preload3D, device, keepAwake, ic, toast, reduceMotion } from './core.js';
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
// данные клиента разделены по аккаунтам: у каждого входа свои результаты на этом устройстве
const K = k => { const u = meSync(); return u && u.id ? k + ':' + u.id : k; };
function claimLegacy() { const u = meSync(); if (!u || localStorage.getItem('bp_legacy_client')) return; localStorage.setItem('bp_legacy_client', u.id);
  for (const k of ['bp_tests', 'bp_profile', 'bp_done']) { const v = localStorage.getItem(k); if (v != null && localStorage.getItem(K(k)) == null) localStorage.setItem(K(k), v); localStorage.removeItem(k); } }
window.addEventListener('bp-login', () => claimLegacy());
const tests = () => JSON.parse(localStorage.getItem(K('bp_tests')) || '[]');
const saveTest = t => { const a = tests(); a.push(t); localStorage.setItem(K('bp_tests'), JSON.stringify(a.slice(-20))); };
const bot = () => C.booking + '?start=app_' + encodeURIComponent(REF);
export const TONE = { HYPER: ['Перегрузка', 'var(--hyper)', 'var(--over-s)', 'похоже, перегрузка', 'Гипертонус', 'var(--over-t)'], SHORT: ['Зажата', 'var(--short)', 'var(--short-s)', 'похоже, зажата', 'Укорочение', 'var(--short-t)'],
  WEAK: ['Не включается', 'var(--weak)', 'var(--weakS)', 'похоже, не включается', 'Слабость', 'var(--weak-t)'], OK: ['Норма', 'var(--ok)', 'var(--ok-s)', 'норма', 'Норма', 'var(--ok-t)'] };
// подпись состояния в числе зоны: «Глубокие мышцы шеи · не включаются», «Сгибатели бедра · зажаты»
const plural = id => { const z = (C.muscles[id] && C.muscles[id].zone) || ''; return /мышцы|^\S+(ые|ие|тели)\s/i.test(z + ' '); };
export const toneText = (s, i) => { const t = TONE[s.k][i]; return plural(s.id) ? t.replace('ата', 'аты').replace('ается', 'аются') : t; };
export const TONE_HEX = { HYPER: '#C8414A', SHORT: '#A3561A', WEAK: '#2F6BD8', OK: '#26775D' };
export const TONE_TEXT_HEX = { HYPER: '#B3343B', SHORT: '#9E4E0E', WEAK: '#2A5CB8', OK: '#1E7149' };
const sideWord = s => s === 'RIGHT' ? 'справа' : 'слева';
// ---------- итог в три строки: глагол действия, мышца, одна измеренная деталь ----------
const VERBS = [['WEAK', 'Укрепить'], ['SHORT', 'Растянуть'], ['HYPER', 'Расслабить']];
const lc = t => t ? t[0].toLowerCase() + t.slice(1) : t;
// винительный падеж для названий мышц после глагола: «укрепить среднюю ягодичную»
const acc = t => t.split(' ').map(w => { const m = w.match(/^(.*?)([,.]?)$/), x = m[1];
  for (const [a, b] of [['ая', 'ую'], ['яя', 'юю'], ['ца', 'цу'], ['ия', 'ию']]) if (x.endsWith(a)) return x.slice(0, -a.length) + b + m[2];
  return w; }).join(' ');
export function verdict(top, findings) {
  return VERBS.map(([k, verb]) => { const items = top.filter(s => s.k === k && !s.ambiguous).slice(0, 2); if (!items.length) return null;
    const s0 = items[0], f = findings.find(f => f.muscles.some(m => m.id === s0.id && (m.side === s0.side || m.side === 'BOTH')));
    // одна мышца с двух сторон: «с двух сторон» вместо двух строк
    const ids = [...new Set(items.map(s => s.id))], names = ids.map(id => { const sd = items.filter(s => s.id === id).map(s => s.side);
      return acc(lc(C.muscles[id].name)) + ' ' + (sd.length > 1 ? 'с двух сторон' : sideWord(sd[0])); });
    return { k, verb, what: names.join(', '), why: f ? f.observed.replace(' (на границе нормы)', '') : s0.byChain ? `Возможно, по цепи «${s0.byChain}»` : '' }; }).filter(Boolean);
}
// skip: причины, которые уже показаны выше на экране (блок «Измерено»), под решениями не повторяем.
// У каждой строки метка источника: ИЗМЕРЕНО (опирается на замер) или ГИПОТЕЗА (вывод по цепи). «На границе нормы» показываем, а не вырезаем.
export function verdictCard(top, findings, empty = 'Явных перекосов не видно', skip = []) {
  const v = verdict(top, findings);
  if (!v.length) return `<div class="card empty">${ic('check')}<b>${empty}</b><span class="sub">Движение симметричное. Повтори тест через месяц.</span></div>`;
  return `<div class="card" style="padding:4px var(--s4)">${v.map((x, i) => {
    const s0 = top.find(s => s.k === x.k && !s.ambiguous), f = s0 && findings.find(f => f.muscles.some(m => m.id === s0.id && (m.side === s0.side || m.side === 'BOTH')));
    const measured = f && s0 && !s0.derived && !s0.byChain, edge = f && / \(на границе нормы\)/.test(f.observed);
    const why = x.why && !skip.includes(x.why) && !(i && v[i - 1].why === x.why) ? `<span>${esc(x.why)}</span>` : '';
    return `<div class="verdict-row"><span class="mark ${x.k}"></span><div style="flex:1;min-width:0"><div class="what"><b>${x.verb}</b> ${esc(x.what)}</div>
      <div class="why">${measured ? '<span class="src">ИЗМЕРЕНО</span>' : '<span class="src hyp">ГИПОТЕЗА</span>'}${why}${edge ? '<span class="edge">на границе нормы</span>' : ''}</div></div></div>`; }).join('')}</div>`;
}
export const ex = id => C.exercises[id];
/** Название упражнения со стороной: «Ягодичный мостик, слева». Сторону не прячем, иначе непонятно, какую ногу качать. */
export const exSide = e => { const m = /\((левая|правая) сторона\)/.exec(e.title); return m ? (m[1] === 'левая' ? 'слева' : 'справа') : ''; };
export const exLabel = e => e.title.split(' (')[0] + (exSide(e) ? ', ' + exSide(e) : '');
const exSec = e => Math.max(10, e.durationSec) + 20;
export const minutes = e => Math.max(1, Math.ceil(exSec(e) / 60));
export const totalMin = list => Math.max(1, Math.round(list.reduce((x, e) => x + exSec(e), 0) / 60));
let view3d = null;
// тот же экран заново (правка, переключение вкладки): без анимации появления, иначе экран мигает
let lastHead = '';
const callerName = () => { try { const l = (new Error().stack || '').split('\n').map(x => x.trim()).filter(x => x.startsWith('at '));
  for (const x of l.slice(2)) { const m = /^at (?:async )?([\w$.]+)/.exec(x); if (m && !/^(go|Object\.go|HTMLButtonElement|HTMLDivElement|Promise|new Promise)/.test(m[1])) return m[1].replace(/^Object\./, '').slice(0, 40); } } catch (e) {} return 'screen'; };
export function go(html) { try { screenView(callerName()); } catch (e) {} if (view3d) { view3d.dispose(); view3d = null; } backFn = null; const head = html.slice(0, 260); if (head === lastHead) html = html.replace(' fade', ''); lastHead = head; app.innerHTML = html; window.scrollTo(0, 0);
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = html.includes('class="cam"') ? '#0A0C0F' : / dark[ "]/.test(html.slice(0, 200)) ? '#13212B' : '#F3F6F6'; }

// ---------- «назад»: жест и системная кнопка ведут на шаг назад в приложении, а не закрывают его ----------
// В истории браузера держим одну запись-ловушку. Жест «назад» снимает ее, мы делаем шаг назад внутри
// приложения и ставим ловушку снова. На главном экране (нет кнопки «‹») жест закрывает приложение как обычно.
let backFn = null;
export const setBack = fn => { backFn = fn; };
const BACK_SEL = ['#x', '#back', '#lback', '#sback', '#sre'];
const armBack = () => { if (!(history.state && history.state.bpTrap)) history.pushState({ bpTrap: 1 }, ''); };
function stepBack() {
  const sheet = [...document.querySelectorAll('.sheet')].pop();
  if (sheet) { sheet.remove(); return true; }
  if (backFn) { const f = backFn; backFn = null; f(); return true; }
  const b = BACK_SEL.map(s => app.querySelector(s)).find(x => x && x.offsetParent !== null);
  if (b) { b.click(); return true; }
  return false;
}
addEventListener('popstate', () => { if (stepBack()) armBack(); else history.back(); });
// Chrome пропускает при жесте «назад» записи, добавленные до первого касания страницы, и сразу закрывает вкладку.
// Поэтому ловушку ставим только по касанию: тогда запись считается созданной пользователем.
addEventListener('pointerdown', armBack, true);
// Telegram Mini App: своя кнопка «Назад» в шапке Telegram
try { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.BackButton && tg.initData) { tg.BackButton.show(); tg.BackButton.onClick(() => { stepBack(); }); } } catch (e) {}

// ---------- данные карты ----------
export function spots(a) {
  return a.tones.map(t => { const m = C.muscles[t.id]; if (!m) return null;
    const short = a.findings.some(f => f.muscles.some(x => x.id === t.id && x.state === 'SHORT' && (x.side === t.side || x.side === 'BOTH'))) || a.chains.some(c => c.chain.members.some(x => x.id === t.id && x.state === 'SHORT'));
    const k = t.tone > .25 ? (short ? 'SHORT' : 'HYPER') : t.tone < -.25 ? 'WEAK' : 'OK';
    return { id: t.id, side: t.side, tone: t.derived ? t.tone * .7 : t.tone, k, back: m.view === 'back', derived: t.derived, ambiguous: t.ambiguous, byChain: t.byChain, x: t.side === 'LEFT' ? m.xLeft : 1 - m.xLeft, y: m.y, key: t.id + ':' + t.side };
  }).filter(Boolean);
}
/** Главные зоны: сначала измеренные, затем выведенные по подтвержденной цепи (с пометкой «возможно»).
 *  Раньше выведенные по цепи в списки не попадали вовсе, и, например, грудные при сутулости не показывались. */
export const topOf = all => all.filter(s => s.k !== 'OK' && (!s.derived || s.byChain)).sort((x, y) => (!!x.derived - !!y.derived) || Math.abs(y.tone) - Math.abs(x.tone));
export const title = s => `${C.muscles[s.id].zone || C.muscles[s.id].name} ${sideWord(s.side)}: ${s.ambiguous ? 'признаки противоречат' : s.derived ? toneText(s, 3).replace('похоже', 'возможно') : toneText(s, 3)}`;
// для специалиста: конкретная мышца вместо области тела («Средняя ягодичная справа: похоже, не включается»)
const pluralName = id => /мышцы|^\S+(ые|ие|тели)(\s|$)/i.test(C.muscles[id].name + ' ');
export const ntitle = s => { let t = s.ambiguous ? 'признаки противоречат' : TONE[s.k][3]; if (s.derived && !s.edited) t = t.replace('похоже', 'возможно'); if (pluralName(s.id)) t = t.replace('ата', 'аты').replace('ается', 'аются');
  return `${C.muscles[s.id].name} ${sideWord(s.side)}: ${t}`; };
// короткие названия для подписей на схеме: узнаваемые специалисту сокращения
export const SHORT = { upper_trap: 'Верх. трапеция', levator: 'Подн. лопатку', suboccipital: 'Подзатылочные', lower_trap: 'Ниж. трапеция', rhomboid: 'Ромбовидные', erector: 'Разгиб. спины',
  ql: 'Квадр. поясн.', glute_med: 'Ср. ягодичная', glute_max: 'Б. ягодичная', hamstrings: 'Задняя группа бедра', calf: 'Икроножная', scm: 'ГКС', scalene: 'Лестничные', deep_neck_flex: 'Глуб. сгибат.',
  pec_minor: 'М. грудная', obliques: 'Косые живота', iliopsoas: 'Илиопсоас', tfl: 'Напр. фасции', rectus_fem: 'Прямая бедра', adductors: 'Приводящие', pec_major: 'Б. грудная',
  lats: 'Широчайшая', serratus: 'Зубчатая', rectus_abd: 'Прямая живота', vmo: 'Вн. широкая', abdominals: 'Пресс', thoracic_ext: 'Грудн. разгиб.', tibialis: 'Большеберцовая',
  vastus_lat: 'Нар. широкая', triceps: 'Трицепс', biceps: 'Бицепс', deltoid: 'Дельтовидная', forearm_flex: 'Предплечье', peroneus: 'Малоберцовые' };
export const tech = s => s.k === 'OK' ? C.muscles[s.id].name : `${TONE[s.k][4]} ${C.muscles[s.id].gen}`;
const seen = (a, s) => [...new Set(a.findings.filter(f => f.muscles.some(m => m.id === s.id && (m.side === s.side || m.side === 'BOTH'))).map(f => f.observed))];
export function zoneImg(id) { if (['suboccipital', 'scm', 'scalene', 'deep_neck_flex', 'levator'].includes(id)) return 'img_neck'; if (['upper_trap', 'lower_trap', 'rhomboid', 'lats', 'thoracic_ext', 'serratus', 'triceps', 'deltoid'].includes(id)) return 'img_muscles_back';
  if (['pec_major', 'pec_minor', 'biceps'].includes(id)) return 'img_onb_skeleton'; if (['ql', 'erector', 'obliques', 'abdominals', 'rectus_abd'].includes(id)) return 'img_back_pain'; return 'img_spine'; }
export function plan(top) { const ids = []; for (const s of top.slice(0, 3)) { const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left';
  const pick = s.k === 'WEAK' ? ((m.plan && m.plan.isolate) || m.activate || [])[0] : (m.relax || [])[0]; const id = pick && pick.replace('{s}', sk); if (id && ex(id) && !ids.includes(id)) ids.push(id); } return ids.slice(0, 4); }
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
const numObj = (o, keys) => { if (!o || typeof o !== 'object') return null; const r = {}; for (const k of keys || Object.keys(o).slice(0, 60)) if (/^[a-z_]{1,32}$/.test(k) && num(o[k]) !== undefined) r[k] = o[k]; return r; };
export function cleanResult(o) {
  if (!o || typeof o !== 'object') throw new Error('bad result');
  const moves = {}; for (const [k, v] of Object.entries(o.moves && typeof o.moves === 'object' ? o.moves : {}).slice(0, 20)) {
    if (!/^[a-z_]{1,20}$/.test(k) || !v || typeof v !== 'object') continue;
    moves[k] = { f: numObj(v.f) || {}, reps: num(v.reps) || 0, quality: ['GOOD', 'DOUBTFUL', 'RETAKE'].includes(v.quality) ? v.quality : 'DOUBTFUL', ...(v.alt ? { alt: 'support' } : {}) }; }
  return { date: num(o.date) || Date.now(), full: !!o.full, snapshot: numObj(o.snapshot, ['shoulderTilt', 'pelvicTilt', 'headTilt', 'trunkLateral', 'handRotL', 'handRotR']), side: numObj(o.side, ['headForwardDeg', 'hipShift', 'shoulderShift', 'kneeHyperDeg']), moves };
}
async function resultLink() { return location.origin + location.pathname + '#r=' + await packResult(currentAnalysis().t); }

// ---------- 1. знакомство ----------
export function onboarding() {
  go(`<div class="scr fade">
    <div class="row pad" style="padding-top:16px"><img src="icons/logo.svg" width="28" height="28" alt=""><b style="font-size:16px;font-weight:600;flex:1">BodyPassport</b>${configSync().beta !== false ? '<span class="eyebrow">бета</span>' : ''}</div>
    <div class="pad" style="margin-top:16px"><div class="hero"><img src="img/hero_squat.webp" alt="Присед с поднятыми руками, поверх тела линии скелета"><div class="joint-tag"><small>колено П</small><b>11°</b></div><span class="ondevice" title="Видео не записывается" aria-label="Видео не записывается">${ic('shield-check', 's')}</span></div></div>
    <div class="pad" style="margin-top:24px"><h1>Тест движения за 3 минуты</h1>
      <p class="sub" style="margin-top:12px">Встаньте перед камерой телефона и сделайте несколько простых движений. Вы увидите, какие мышцы перегружены, а какие работают слабо, и получите упражнения. Это оценка движения, а не диагноз.</p>
      ${INV() ? '' : `<div class="row" style="margin-top:20px"><img src="img/rifat.jpg" alt="Рифат Аюпов" width="44" height="44" style="border-radius:50%;object-fit:cover;flex:none"><div><b style="font-size:14px;font-weight:600;display:block">Методика Рифата Аюпова</b><span style="font-size:13px;color:var(--sub)">кинезиотерапевт, биомеханик</span></div></div>`}</div>
    <div class="dock"><button class="btn" id="next">Начать тест <span class="meta">· бесплатно</span></button>${myReports().length || tests().length ? '<button class="btn line" id="mycab">Мой кабинет</button>' : ''}<button class="btn ghost" id="pro">Я специалист: вход в кабинет</button>${canInstall() ? `<button class="link" id="inst1" style="display:block;margin:4px auto 0;font-size:14px;color:var(--sub)">${ic('download', 's')} Установить приложение</button>` : ''}</div></div>`);
  $('#next').onclick = () => { track('onb_done'); prep(); }; if ($('#pro')) $('#pro').onclick = () => localStorage.getItem('bp_inv') ? specSheet() : openPro(); if ($('#mycab')) $('#mycab').onclick = clientHome; if ($('#inst1')) $('#inst1').onclick = () => installNow();
}

// ---------- 2. подготовка ----------
const PRE = {}; // тесты, от которых человек отказался заранее
let FULL = false, STRENGTH = localStorage.getItem('bp_str') !== '0';
// ---------- протоколы: из блоков собираются и тест клиента, и шаблоны специалиста ----------
// секунды шагов измерены по длине записанных фраз и паузам в коде
export const UNITS = {
  stand: [['Стой ровно', 'Руки вдоль тела', 17]],
  ohs_front: [['Присед с руками вверх', '5 раз', 33]],
  sls: [['Стоя на правой ноге', 'Чуть согнуть колено 3 раза, глубоко не нужно', 26], ['Стоя на левой ноге', 'Чуть согнуть колено 3 раза, глубоко не нужно', 24]],
  thold: [['Руки в стороны', 'Держать 20 секунд', 26]],
  bends: [['Наклоны в стороны', 'Вправо и влево', 27]],
  calf: [['На носок правой ноги', '15 секунд', 27], ['На носок левой ноги', '15 секунд', 24]],
  side: [['Боком: стоять и 3 приседа', 'Правое плечо к камере', 49]],
  // стойка боком без приседа: без нее не видно сутулость, вынос головы, таз вперед и переразгибание колен
  profile: [['Боком: стой ровно', 'Правое плечо к камере', 20]],
  back: [['Спиной: 3 приседа', 'Спиной к камере', 38]],
};
export const ORDER = ['stand', 'ohs_front', 'sls', 'thold', 'bends', 'calf', 'profile', 'side', 'back'];
// «боком» уже включает стойку боком: отдельная стойка не нужна
export const sortUnits = u => ORDER.filter(x => u.includes(x) && !(x === 'profile' && u.includes('side')));
const consumerProtocol = () => sortUnits(['stand', 'ohs_front', 'sls', FULL ? 'side' : 'profile', ...(FULL ? ['back'] : []), ...(FULL && STRENGTH ? ['thold', 'bends', 'calf'] : [])]);
// быстрый тест: 4 теста (стойка, присед, одна нога, стойка боком) без поворотов и силового блока; сила и симметрия только в точном
export const rowsOf = p => sortUnits(p).flatMap(u => UNITS[u]);
const QUICK = rowsOf(['stand', 'ohs_front', 'sls', 'profile']), FULLS = rowsOf(['stand', 'ohs_front', 'sls', 'side', 'back']), STR = rowsOf(['thold', 'bends', 'calf']);
export const SETUP_SEC = 36;
export const secs = l => l.reduce((x, s) => x + s[2], 0);
export const mins = sec => (Math.ceil(sec / 30) / 2).toString().replace('.', ',');
const stepsOf = () => rowsOf(consumerProtocol().filter(u => !PRE[u] || PRE[u].alt));
export async function prep() {
  if (!(await ensureLogin('client', prep, { back: onboarding }))) return;
  if (!safetyOk()) return safetyScreen(prep, onboarding, bot());
  voice.preload(Object.values(SAY)); prefetchPose();
  const reopen = !!document.getElementById('prepsheet');
  const steps = stepsOf(), m = mins(SETUP_SEC + secs(steps));
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:var(--s4)">
    <div><div class="eyebrow">Видеотест · ${m} мин · ${steps.length} ${plural3(steps.length, 'шаг', 'шага', 'шагов')}</div><h1 style="margin-top:8px">Подготовка к тесту</h1></div>
    <div class="card"><div class="row" style="gap:var(--s2);align-items:flex-end;justify-content:center;padding:4px 0 12px">
      <svg width="34" height="56" viewBox="0 0 34 56" aria-hidden="true"><rect x="2" y="2" width="30" height="52" rx="6" fill="none" stroke="var(--ink)" stroke-width="2.5"/><circle cx="17" cy="9" r="2.5" fill="var(--ink)"/></svg>
      <div style="flex:1;max-width:150px;text-align:center"><div class="measure sm" style="justify-content:center"><b>2–4</b><u>м</u></div><div style="border-top:2px dashed var(--line);margin-top:6px"></div></div>
      <svg width="40" height="76" viewBox="0 0 200 380" aria-hidden="true"><circle cx="100" cy="44" r="24" fill="var(--figure)" stroke="var(--faint)" stroke-width="5"/><path d="M78 72 L122 72 Q140 74 144 92 L156 176 Q158 186 150 188 Q144 188 142 180 L132 112 L128 190 L130 268 L128 352 Q128 362 118 362 Q110 362 110 352 L104 210 L96 210 L90 352 Q90 362 82 362 Q72 362 72 352 L70 268 L72 190 L68 112 L58 180 Q56 188 50 188 Q42 186 44 176 L56 92 Q60 74 78 72 Z" fill="var(--figure)" stroke="var(--faint)" stroke-width="5"/></svg></div>
      ${[['Поставьте телефон вертикально: на штатив на уровне пояса или на пол у стены'], ['Отойдите на 2–4 метра, чтобы в кадре вы были целиком, от головы до стоп'], ['Лучше всего облегающая одежда: леггинсы или короткие шорты и футболка по фигуре, босиком. В широкой одежде камера хуже видит суставы, и точность падает'], ['Встаньте лицом к свету, окно не должно быть за спиной'], ['Дальше подсказывает голос, смотреть в экран не обязательно']].map(([t], i) => `<div class="row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--line-2)"><span class="step-n" style="width:20px;padding-top:2px">${i + 1}</span><span style="flex:1;font-size:15px;line-height:1.4">${t}</span></div>`).join('')}</div>
    <div class="group"><div class="row" style="min-height:64px"><div style="flex:1;min-width:0"><b style="font-size:15px">${FULL ? 'Точный · с поворотами' : 'Быстрый · лицом и боком'}</b><div style="font-size:13px;color:var(--sub)">${cam.back ? 'Основная камера' : 'Фронтальная камера'}${FULL && STRENGTH ? ' · сила и симметрия' : ''} · ${steps.length} ${plural3(steps.length, 'шаг', 'шага', 'шагов')}</div></div><button class="link" id="chg">Изменить</button></div></div>
    ${device.inApp ? `<div class="card row" style="align-items:flex-start">${ic('info')}<span style="font-size:14px;line-height:1.4">Ссылка открыта внутри приложения соцсети, здесь камера может не работать. Откройте ее в браузере: меню «⋯» → «Открыть в браузере».</span></div>` : ''}
   </div>
   <div class="dock"><button class="btn" id="start">${ic('shield-check', 's')}Начать тест</button><button class="btn ghost" id="cant">Не могу выполнить некоторые движения</button>${skipBtn()}</div></div>`);
  $('#back').onclick = () => tests().length ? map() : onboarding();
  $('#chg').onclick = () => prepSheet(); $('#cant').onclick = () => prepSheet(true);
  if ($('#skipTest')) $('#skipTest').onclick = () => { track('beta_skip_test'); saveTest(fakeResult(consumerProtocol())); analysisScreen(); };
  if (reopen) prepSheet(false, true);
  $('#start').onclick = async () => { voice.unlock(); startMotion(); const b = $('#start'); b.disabled = true; b.innerHTML = '<span class="spin" style="margin:0;width:20px;height:20px;border-width:2.5px;border-color:rgba(255,255,255,.3);border-top-color:#fff"></span>Включаю камеру…';
    try { await initPose(); runTest(); } catch (e) { b.disabled = false; b.textContent = 'Начать тест'; startError(e, () => b.click()); } };
}
// шторка настроек теста: режим, камера, сила, список шагов с «Не могу». После перерисовки prep() остается открытой
function prepSheet(toSteps, keep) {
  document.querySelectorAll('#prepsheet').forEach(x => x.remove());
  const d = document.createElement('div'); d.className = 'sheet'; d.id = 'prepsheet'; if (keep) d.style.animation = 'none';
  d.innerHTML = `<div${keep ? ' style="animation:none"' : ''}><h2>Настройки теста</h2>
    <div class="seg" style="margin-top:var(--s4)"><button id="m0" class="${FULL ? '' : 'on'}">Быстрый · ${mins(SETUP_SEC + secs(QUICK))} мин</button><button id="m1" class="${FULL ? 'on' : ''}">Точный · ${mins(SETUP_SEC + secs(FULLS) + (STRENGTH ? secs(STR) : 0))} мин</button></div>
    <div class="eyebrow" style="margin-top:var(--s5)">Камера</div><div class="seg" style="margin-top:8px"><button id="c0" class="${cam.back ? '' : 'on'}">Фронтальная</button><button id="c1" class="${cam.back ? 'on' : ''}">Основная</button></div>
    <p class="sub" style="font-size:13px;margin-top:6px">${cam.back ? 'Точнее картинка. Экран не видно, ведет голос.' : 'Во время теста вы видите себя на экране.'}</p>
    ${FULL ? `<label class="card row" style="margin-top:var(--s4);align-items:flex-start"><input type="checkbox" class="check" id="strc" ${STRENGTH ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Сила и симметрия</b><div class="sub" style="font-size:13px">Сравнит левую и правую сторону: плечи, бока, икры, бедра. Добавляет ${mins(secs(STR))} мин</div></div></label>` : `<p class="sub" style="font-size:13px;margin-top:var(--s4)">Быстрый: 4 теста лицом и боком, около ${mins(SETUP_SEC + secs(QUICK))} мин. Сила и симметрия левой и правой стороны есть в точном тесте.</p>`}
    <div id="stepsat" class="eyebrow" style="margin-top:var(--s5)">Шаги</div><div style="margin-top:8px">${stepList(consumerProtocol(), PRE)}</div>
    <button class="btn" id="psx" style="margin-top:var(--s5)">Готово</button></div>`;
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
    document.body.appendChild(o); pick.side = c.side ? 'BOTH' : null;
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
  document.querySelectorAll('[data-cant]').forEach(b => b.onclick = async () => { const u = b.dataset.cant; const a = await cantSheet(u); if (/опор|неглуб/i.test(a.level || '') && (u === 'ohs_front' || u === 'sls')) a.alt = 'support'; pre[u] = a; redraw(); });
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
export const LIMIT_NAMES = { profile: 'Стойка боком', stand: 'Стойка', ohs_front: 'Присед', sls: 'На одной ноге', thold: 'Руки в стороны', bends: 'Наклоны', calf: 'На носок', side: 'Боком', back: 'Спиной' };
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
  standIntro: 'Встань ровно. Руки вдоль тела, смотри прямо.', freeze: 'Замри.', good: 'Хорошо.',
  ohsIntro: 'Теперь присед. Подними прямые руки вверх. Пятки не отрывай.', ohsGo: 'Приседай. Пять раз, медленно.',
  ohsAltIntro: 'Возьмись рукой за спинку стула или за стену.', ohsAltGo: 'Приседай, насколько можешь без боли. Три раза.',
  repWait: 'Приседай. Я жду.', stop: 'Стоп. Хорошо.',
  slsRIntro: 'Встань на правую ногу, левую подними. Можно держаться за стену.', slsRGo: 'Приседай на правой ноге. Три раза, неглубоко.',
  slsLIntro: 'Теперь встань на левую ногу, правую подними.', slsLGo: 'Приседай на левой ноге. Три раза, неглубоко.',
  footDown: 'Стоп. Опусти ногу.', cant: 'Начинай, я жду движение. Если не получается, нажми «Не могу»',
  tholdIntro: 'Подними руки в стороны до уровня плеч.', tholdGo: 'Держи двадцать секунд.', keep: 'Держи, не опускай', hold10: 'Ещё десять секунд', hold5: 'Ещё пять секунд',
  armsUp: 'Руки выше, до уровня плеч', armsDown: 'Опусти руки.',
  bendIntro: 'Наклоны в стороны. Руки вдоль тела.', bendR: 'Медленно наклонись вправо.', bendL: 'Теперь наклонись влево.', lower: 'Ниже, рука скользит по бедру', ret: 'Вернись.',
  calfRIntro: 'Встань на правую ногу, держись за стену.', calfLIntro: 'Теперь на левую ногу, держись за стену.', calfGo: 'Поднимайся на носок и опускайся. Пятнадцать секунд.', calfHigher: 'Поднимайся выше на носок',
  sideTurn: 'Повернись правым боком к телефону.', backTurn: 'Повернись спиной к телефону.', frontTurn: 'Повернись ко мне лицом.',
  armsOverhead: 'Подними прямые руки вверх.', squatGo: 'Приседай. Три раза.',
  finish: 'Тест закончен. Можно подойти к телефону.',
  vertical: 'Поставь телефон вертикально, не наклоняй его',
  noFeet: 'Не вижу ноги. Отойди назад', noHead: 'Не вижу голову. Отойди назад', farther: 'Отойди чуть дальше', closer: 'Подойди чуть ближе',
  goLeft: 'Сделай шаг влево', goRight: 'Сделай шаг вправо', tilt: 'Телефон стоит криво. Выровняй его', dark: 'Мало света. Встань лицом к окну или включи свет',
};

const RETAKE_KEYS = { ohs_front: ['ohs_front'], sls: ['sls_r', 'sls_l'], side: ['ohs_side'], back: ['ohs_back'] };
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
  await voice.ensure(Object.values(SAY));
  const pre = opts.pre || {}; const units = sortUnits(protocol); const steps = rowsOf(units.filter(u => !pre[u] || pre[u].alt));
  go(`<div class="cam"><video playsinline muted></video><canvas id="sil"></canvas><canvas id="sk"></canvas><div class="count" id="cnt"></div>
   <div class="top"><div class="segs">${steps.map(() => '<div><b></b></div>').join('')}</div>${isBetaMode() && !(INV() || {}).cal ? '<button class="pill glass" id="betaSkip" style="margin-right:8px;color:#fff">Пропустить</button>' : ''}<button class="round glass" id="x" aria-label="Закончить тест">${ic('x')}</button></div>
   <div class="reps" id="reps" hidden><b id="ring">0</b><span id="repn">из 5</span></div>
   <div class="joint-tag" id="jt" hidden><small id="jtn">колено Л</small><b id="jtv">—</b></div>
   <div class="glass">
    <div class="cam-status" id="stepl">ПОДГОТОВКА</div>
    <div class="cam-title" id="tt"></div>
    <div class="cam-sub">${ic('volume-2', 's')}<span id="cue"></span></div>
    <div class="row"><div class="cam-bar"><b id="pbf"></b></div><button type="button" class="cam-btn" id="skipb">Не могу</button></div>
    <span id="pbt" class="sr-only" aria-live="polite"></span>
   </div></div>`);
  let stop = false, skip = false; const cancel = () => { track('test_cancel'); (opts.onCancel || prep)(); }; const limits = {};
  track('test_start', { n: units.length }, false); const tStart = Date.now();
  $('#x').onclick = () => { stop = true; try { saveRec(); } catch (e) {} stopCamera(); cancel(); }; $('#skipb').onclick = () => { skip = true; };
  if ($('#betaSkip')) $('#betaSkip').onclick = () => { stop = true; stopCamera(); voice.say(''); track('beta_skip_test', { c: 'camera' }); opts._skipAll({ ...fakeResult(units), poses: {} }); };
  const video = app.querySelector('video'); const sk = $('#sk');
  try { if (!device.camera) throw new Error('no camera api'); await startCamera(video); } catch (e) { stop = true; return cameraHelp(); }
  // бета: тест пишется в видеофайл с камерой и скелетом, файл сохраняется в «Загрузки» по окончании или при выходе
  const rec = isBetaMode() && localStorage.getItem('bp_rec') !== '0' ? recordTest(video) : null;
  const saveRec = async () => { if (!rec) return; const b = await rec.stop(); if (b && b.size > 1e4) { saveBlob(b, `bodypassport-test-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${/mp4/.test(b.type) ? 'mp4' : 'webm'}`); toast('Видео теста сохранено в «Загрузки»'); } };
  const corr = () => (cam.back ? -1 : 1) * phone.roll;
  const lc = document.createElement('canvas'); lc.width = 32; lc.height = 32; const lx = lc.getContext('2d', { willReadFrequently: true }); let light = 128, lastL = 0;
  const bodyFrac = p => (Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) - p[P.NOSE].y);
  let level = true, setupDone = false, focus = null, stepLabel = '', lastStatus = '', lastIssue = '';
  const sil = $('#sil'); drawSilhouette(sil, opts.target && opts.target.bodyFrac > 0 ? opts.target : undefined);
  const jt = $('#jt'), cw = () => app.querySelector('.cam').clientWidth;
  cam.onFrame = f => { const ok = fullyVisible(f.pose);
    if (performance.now() - lastL > 1000) { lastL = performance.now(); try { lx.drawImage(video, 0, 0, 32, 32); const d = lx.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; light = s / 1024; } catch (e) {} }
    level = !phone.ok || Math.abs(phone.roll) <= 5;
    const lv = f.pose ? levelled(f.pose, f.w, f.h, corr()) : null, fo = setupDone && focus && lv ? focus(lv) : null;
    const r = drawSkeleton(sk, f, { focus: fo ? fo.j : null, trail: setupDone, warn: !ok });
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
  const step = (i, title, sub, fc) => { if (i !== null) { si = i; segs.forEach((b, k) => b.style.width = k < i ? '100%' : k === i ? '8%' : '0'); stepLabel = `Шаг ${i + 1} из ${steps.length}`; lastStatus = ''; } if (fc !== undefined) focus = fc; $('#tt').textContent = title; $('#cue').textContent = sub || ''; bar(0, ''); $('#reps').hidden = true; };
  const bar = (frac, label) => { $('#pbf').style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; if (label !== undefined) $('#pbt').textContent = label; if (segs[si]) segs[si].style.width = Math.max(8, frac * 100) + '%'; };
  const say = async text => { if (stop) return; $('#cue').textContent = text; await voice.speak(text); };
  let lastHint = '', lastHintAt = 0, hints = 0; const fpsS = [];
  const hint = (text, gap = 4000) => { const now = Date.now(); if (now - lastHintAt < gap || (text === lastHint && now - lastHintAt < 7000)) return; lastHint = text; lastHintAt = now; hints++; lastIssue = text; $('#cue').textContent = text; voice.say(text); };
  // ---- запись ----
  const grab = (fr, rolls) => { const f = cam.frame; if (f && f.pose && (!fr.length || fr.at(-1).t !== f.t)) { fr.push({ t: f.t, p: levelled(f.pose, f.w, f.h, corr()), w: f.world }); rolls.push(phone.roll); } };
  const poses = {}, quality = {}; let W = 1, H = 1;
  const keep = (key, fr, rolls, vis) => { const f = cam.frame; if (f) { W = f.w; H = f.h; } if (cam.fps) fpsS.push(cam.fps); if (!fr.length) return; poses[key] = packPoses(fr, W, H);
    const m = rolls.reduce((a, b) => a + b, 0) / rolls.length, sd = Math.sqrt(rolls.reduce((a, b) => a + (b - m) ** 2, 0) / rolls.length) || 0;
    quality[key] = Math.round(100 * Math.min(1, (vis ?? .9) / .9) * Math.min(1, (cam.fps || 20) / 20) * (light < 45 ? .7 : 1) * (sd > 2 ? .8 : 1)); };
  // удержание позы заданное время: полоса показывает, сколько осталось; extra(p, left) — подсказки по ходу
  const hold = async (key, sec, label, extra) => { voice.beep('start'); const fr = [], rolls = []; const t0 = Date.now(); const said = {};
    while (!stop && !skip) { const el = (Date.now() - t0) / 1000, left = Math.ceil(sec - el); if (el >= sec) break; grab(fr, rolls); bar(el / sec, `${label}: ${left} с`); $('#reps').hidden = false; $('#ring').textContent = left; $('#repn').textContent = 'сек';
      if (sec >= 12 && left === 10 && !said[10]) { said[10] = 1; hint(SAY.hold10, 0); } if (sec >= 9 && left === 5 && !said[5]) { said[5] = 1; hint(SAY.hold5, 0); }
      if (left <= 3 && !said['c' + left]) { said['c' + left] = 1; voice.say(String(left)); }
      if (extra && fr.length) extra(fr, left); await sleep(30); }
    bar(1, ''); voice.beep('stop'); if (key) keep(key, fr, rolls); return fr; };
  // повторы: считаем по движению таза; полоса = сделанные повторы из трех
  const reps = async (key, an, deep = .12, N = 3, quiet = false) => { if (!quiet) voice.beep('start'); const fr = [], rolls = []; if (skip) return { f: {}, reps: 0, quality: 'RETAKE' };
    let n = 0, down = false, base = null, leg = null, maxFlex = 0, downAt = 0, countAt = 0; const hys = []; const t0 = Date.now(); let lastMove = Date.now(); bar(0, `Повторы: 0 из ${N}`); $('#reps').hidden = false; $('#ring').textContent = 0; $('#repn').textContent = `из ${N}`;
    while (!stop && !skip && n < N && Date.now() - t0 < 60000) { grab(fr, rolls); const p = fr.length && fr.at(-1).p;
      // высота таза по медиане последних кадров: дрожание точек не считается повтором
      if (p) { hys.push((p[P.L_HIP].y + p[P.R_HIP].y) / 2); if (hys.length > 5) hys.shift(); const hy = hys.slice().sort((x, y) => x - y)[hys.length >> 1]; if (leg == null) leg = Math.max(1, Math.abs(((p[P.L_ANKLE].y + p[P.R_ANKLE].y) / 2) - hy));
        base = base == null ? hy : Math.min(base, hy * .02 + base * .98, base); const dy = (hy - base) / leg;
        const fl = Math.max(F.kneeFlexion(p, true), F.kneeFlexion(p, false)); if (fl > maxFlex) maxFlex = fl;
        if (!down && dy > deep) { down = true; downAt = Date.now(); lastMove = Date.now(); }
        // повтор засчитывается, если внизу были не меньше четверти секунды и с прошлого прошло больше полсекунды;
        // вместо слова короткий сигнал: слова запаздывали и обрывали друг друга
        if (down && dy < deep * .35) { down = false; if (Date.now() - downAt >= 250 && Date.now() - countAt >= 500) { n++; countAt = Date.now(); lastMove = Date.now(); $('#ring').textContent = n; bar(n / N, `Повторы: ${n} из ${N}`); voice.beep('tick'); } } }
      if (!down && Date.now() - lastMove > 6000) { lastMove = Date.now(); hint(SAY.repWait, 0); }
      await sleep(30); }
    const r = fr.length > 10 ? an(fr) : { f: {}, reps: 0, quality: 'RETAKE' }; if (r.f) r.f.max_knee_flex = maxFlex; keep(key, fr, rolls, r.visibility);
    if (n === 0 && !skip && !stop) r.quality = 'RETAKE'; await sleep(700); voice.beep('stop'); return r; };
  // счет идет с первого слова команды: люди начинают приседать на «Приседай», и раньше, пока голос договаривал, первые повторы терялись, а лишние засчитывались после
  const goReps = async (phrase, key, an, deep, N) => { const sp = say(phrase); const r = await reps(key, an, deep, N, true); await sp; return r; };
  // поворот: команда, затем 4 секунды с полосой, чтобы успеть повернуться
  let facing = 'front';
  const face = async want => { if (facing === want) return; step(null, want === 'side' ? 'Повернись правым боком' : want === 'back' ? 'Повернись спиной' : 'Повернись лицом', '');
    await say(want === 'side' ? SAY.sideTurn : want === 'back' ? SAY.backTurn : SAY.frontTurn);
    const t0 = Date.now(); while (!stop && Date.now() - t0 < 4000) { bar((Date.now() - t0) / 4000, 'Поворачивайся'); await sleep(50); } facing = want; };
  // ---- 0. в кадр ----
  step(null, 'Встань в кадр', 'Весь рост, от макушки до стоп'); await say(SAY.setup);
  const issue = () => { const f = cam.frame, p = f && f.pose; if (!level) return SAY.tilt; if (phone.ok && Math.abs(phone.pitch) > 18) return SAY.vertical; if (light < 45) return SAY.dark; if (!p) return SAY.farther;
    if (p[P.L_ANKLE].visibility < .5 || p[P.R_ANKLE].visibility < .5 || Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) > f.h * .97) return SAY.noFeet;
    if (p[P.NOSE].visibility < .5 || p[P.NOSE].y < f.h * .03) return SAY.noHead;
    const cx = (p[P.L_HIP].x + p[P.R_HIP].x) / 2 / f.w; if (cx < .28) return SAY.goLeft; if (cx > .72) return SAY.goRight;
    const hf = (Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) - p[P.NOSE].y) / f.h; if (hf < .45) return SAY.closer; if (hf > .9) return SAY.farther; return null; };
  { let okSince = 0; const t0 = Date.now();
    while (!stop) { const bad = issue();
      if (!bad && fullyVisible(cam.frame && cam.frame.pose)) { if (!okSince) okSince = Date.now(); bar((Date.now() - okSince) / 1500, 'Стой на месте'); if (Date.now() - okSince > 1500) break; }
      else { okSince = 0; bar(0, bad || ''); hint(bad || SAY.farther, 3500); }
      if (Date.now() - t0 > 120000) { stop = true; stopCamera(); return cancel(); } await sleep(150); }
    if (stop) return; track('setup', { d: (Date.now() - t0) / 1000, n: hints }, false); setupDone = true; sil.style.transition = 'opacity .32s'; sil.style.opacity = 0; await say(SAY.seen); }
  // ---- тесты ----
  const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v[v.length >> 1] ?? 0; };
  let snapshot = null, side = null, setup = null; const moves = {}; let k = 0;
  const skipped = () => skip && !stop;
  const okFlash = async (name, n) => { const d = document.createElement('div'); d.className = 'result-ok';
    d.innerHTML = `<span style="width:48px;height:48px;border-radius:50%;background:var(--signal);color:var(--cam-bg);display:flex;align-items:center;justify-content:center;flex:none">${ic('check')}</span><div><b style="font-size:20px;display:block">Получилось</b><span class="cam-status">Шаг ${n} · ${esc(name)}</span></div>`;
    app.querySelector('.cam').appendChild(d); await sleep(800); d.remove(); };
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
      const f = cam.frame; setup = { bodyFrac: med(st.map(x => bodyFrac(x.p))) / (f ? f.h : 1), roll: phone.roll, pitch: phone.pitch ?? null, back: cam.back, w: f && f.w, h: f && f.h }; await say(SAY.good); k++; }
    if (u === 'ohs_front') { await face('front'); step(k, 'Присед с руками вверх', 'Руки вверх, пятки на полу, 5 раз', FOC.squat); await say(SAY.ohsIntro); if (skipped()) return; 
      moves.ohs_front = await goReps(SAY.ohsGo, 'ohs_front', fr => Movement.front(fr), .12, 5); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'sls') { await face('front');
      step(k, 'Стоя на правой ноге', 'Чуть согните колено на 10–15 см и выпрямитесь, 3 раза. Можно держаться за стену. Не получается — нажмите «Не могу»', FOC.kneeR); await say(SAY.slsRIntro); if (skipped()) return; await say(SAY.cant); if (skipped()) return; 
      moves.sls_r = await goReps(SAY.slsRGo, 'sls_r', fr => Movement.singleLeg(fr, true), .06); if (skipped()) return; await say(SAY.footDown); k++;
      step(k, 'Стоя на левой ноге', 'Чуть согните колено на 10–15 см и выпрямитесь, 3 раза. Можно держаться за стену. Не получается — нажмите «Не могу»', FOC.kneeL); await say(SAY.slsLIntro); if (skipped()) return; 
      moves.sls_l = await goReps(SAY.slsLGo, 'sls_l', fr => Movement.singleLeg(fr, false), .06); if (skipped()) return; await say(SAY.footDown); k++; }
    if (u === 'thold') { await face('front'); step(k, 'Руки в стороны', 'На уровне плеч, держи 20 секунд', FOC.arms); await say(SAY.tholdIntro); if (skipped()) return; await say(SAY.tholdGo);
      const fr = await hold('t_hold', 20, 'Держи', (fr, left) => { const p = fr.at(-1).p; if (left === 15) hint(SAY.keep, 0);
        if (left < 18 && left > 6) { const ab = Math.min(G.angleAt(p[P.R_HIP], p[P.R_SHOULDER], p[P.R_ELBOW]), G.angleAt(p[P.L_HIP], p[P.L_SHOULDER], p[P.L_ELBOW])); if (ab < 70) hint(SAY.armsUp, 5000); } });
      if (skipped()) return; moves.t_hold = fr.length > 20 ? Movement.tHold(fr) : { f: {}, reps: 0, quality: 'RETAKE' }; await say(SAY.armsDown); k++; }
    if (u === 'bends') { await face('front'); step(k, 'Наклоны в стороны', 'Медленно вправо, потом влево', FOC.bend); await say(SAY.bendIntro); if (skipped()) return;
      const bend = async (cmd, sign) => { await say(cmd); voice.beep('start'); const fr = [], rolls = []; const t0 = Date.now(); let max = 0, low = false;
        while (!stop && !skip && Date.now() - t0 < 6000) { grab(fr, rolls); bar((Date.now() - t0) / 6000, 'Наклон'); const p = fr.length && fr.at(-1).p;
          if (p) { const tl = F.trunkLateral(p) * sign; if (tl > max) max = tl; if (!low && Date.now() - t0 > 2500 && max < 12) { low = true; hint(SAY.lower, 0); } } await sleep(30); }
        voice.beep('stop'); await say(SAY.ret); await sleep(800); return fr; };
      const b1 = await bend(SAY.bendR, 1); if (skipped()) return; const b2 = await bend(SAY.bendL, -1); if (skipped()) return;
      moves.side_bend = Movement.sideBend([...b1, ...b2]); keep('bends', [...b1, ...b2], b1.map(() => phone.roll)); await say(SAY.good); k++; }
    if (u === 'calf') { await face('front');
      for (const [right, intro, key] of [[true, SAY.calfRIntro, 'calf_r'], [false, SAY.calfLIntro, 'calf_l']]) {
        step(k, right ? 'На носок правой ноги' : 'На носок левой ноги', 'Держись за стену, вверх и вниз 15 секунд', null); await say(intro); if (skipped()) return; await say(SAY.calfGo);
        const fr = await hold(key, 15, 'Вверх-вниз', (fr, left) => { if (left < 11 && left > 5 && fr.length > 60) { const hy = x => (x.p[P.L_HEEL].y + x.p[P.R_HEEL].y) / 2, rec = fr.slice(-90).map(hy); if (Math.max(...rec) - Math.min(...rec) < 8) hint(SAY.calfHigher, 6000); } });
        if (skipped()) return; moves[key] = fr.length > 20 ? Movement.calfRaise(fr, right) : { f: {}, reps: 0, quality: 'RETAKE' }; await say(SAY.footDown); k++; } }
    if (u === 'side') { await face('side'); step(k, 'Боком: стой ровно', 'Правое плечо к телефону', null); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (skipped()) return; side = sideSnapshot(sf);
      step(k, 'Боком: присед', 'Руки вверх, 3 раза'); await say(SAY.armsOverhead); 
      moves.ohs_side = await goReps(SAY.squatGo, 'ohs_side', fr => Movement.side(fr), .12, 3); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'profile') { await face('side'); step(k, 'Боком: стой ровно', 'Руки вдоль тела, смотри прямо', null); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (stop || skipped()) return; side = sideSnapshot(sf);
      await say(SAY.good); k++; }
    if (u === 'back') { await face('back'); step(k, 'Спиной: присед', 'Руки вверх, 3 раза', FOC.squat); await say(SAY.armsOverhead); if (skipped()) return; 
      moves.ohs_back = await goReps(SAY.squatGo, 'ohs_back', fr => Movement.back(fr), .12, 3); if (skipped()) return; await say(SAY.stop); k++; }
  };
  // облегченный вариант после «Не могу»
  const runAlt = async u => { if (u === 'ohs_front') { step(k, 'Присед с опорой', 'Держись за стул или стену', FOC.squat); await say(SAY.ohsAltIntro); await say(SAY.ohsAltGo);
      const r = await reps('ohs_front', fr => Movement.front(fr), .05); r.alt = 'support'; moves.ohs_front = r; await say(SAY.stop); k++; }
    if (u === 'sls') { step(k, 'Правая нога с опорой', 'Держись за стену'); await say(SAY.slsRIntro); await say(SAY.slsRGo); const r = await reps('sls_r', fr => Movement.singleLeg(fr, true), .03); r.alt = 'support'; moves.sls_r = r; await say(SAY.footDown); k++;
      step(k, 'Левая нога с опорой', 'Держись за стену'); await say(SAY.slsLIntro); await say(SAY.slsLGo); const r2 = await reps('sls_l', fr => Movement.singleLeg(fr, false), .03); r2.alt = 'support'; moves.sls_l = r2; await say(SAY.footDown); k++; } };
  for (const u of units) {
    if (stop) return; skip = false; const k0 = k;
    if (pre[u]) { limits[u] = pre[u]; if (pre[u].alt) await runAlt(u); continue; }
    await runUnit(u);
    // «Получилось» или «Еще раз»: повтор шага один раз, второй неудачный повтор не спрашиваем
    if (!skip && !stop) { const bad = retakeOf(u, moves);
      if (bad) { track('retake', { c: u, r: lastIssue || 'нет движения' }, false); const again = await retakeScreen(lastIssue, light >= 45, level, fullyVisible(cam.frame && cam.frame.pose)); if (stop) return;
        if (again) { k = k0; lastIssue = ''; await runUnit(u); } else skip = true; }
      else if (k > k0) await okFlash(steps[k - 1] ? steps[k - 1][0] : '', k); }
    if (skip && !stop) { track('step_skip', { c: u }, false); voice.beep('stop'); step(null, 'Не получается? Ничего страшного', 'Ответь на пару вопросов'); limits[u] = await cantSheet(u); skip = false;
      if (/опор|неглуб/i.test(limits[u].level || '') && (u === 'ohs_front' || u === 'sls')) { limits[u].alt = 'support'; await runAlt(u); } else k = k0 + (UNITS[u] || []).length; }
  }
  if (stop) return;
  step(null, 'Готово', 'Считаю результат'); bar(1, ''); cam.onFrame = null; await say(SAY.finish); await saveRec(); stopCamera();
  track('test_done', { n: units.length, d: Math.round((Date.now() - tStart) / 1000) }, false);
  const fpsMed = fpsS.length ? [...fpsS].sort((a, b) => a - b)[fpsS.length >> 1] : null, qv = Object.values(quality);
  notePoseSpeed(fpsMed);
  track('cam_q', { n: fpsMed || 0, q: qv.length ? Math.min(...qv) : 0, c: `${poseInfo.deleg} ${poseInfo.model}` }, false);
  // техника съемки: без нее ретест на другом телефоне нельзя отличить от изменения у человека
  const tech = { model: poseInfo.model, deleg: poseInfo.deleg, fps: fpsMed && Math.round(fpsMed), pitch: phone.ok && Number.isFinite(phone.pitch) ? Math.round(phone.pitch) : null, rules: C.bodymap && C.bodymap.version };
  const res = { date: Date.now(), protocol: units, full: units.includes('side') || units.includes('profile'), snapshot, side, moves, poses, quality, limits, setup, tech };
  sendNorms(res); return res;
}


// ---------- бета: пропустить видеотест ----------
// Только в бета-режиме: правдоподобный результат без камеры, чтобы тестировщики могли смотреть карту, кабинет и отчеты сколько угодно раз.
const isBetaMode = () => configSync().beta !== false;
const skipBtn = () => isBetaMode() && !(INV() || {}).cal ? '<button class="btn ghost" id="skipTest" style="margin-top:8px">Пропустить видеотест (бета)</button>' : '';
function fakeResult(protocol) {
  const j = (v, k = 1) => Math.round((v + (Math.random() - .5) * 2 * k) * 10) / 10, p = Array.isArray(protocol) && protocol.length ? protocol : ['stand', 'ohs_front', 'sls', 'side'];
  return { date: Date.now(), protocol: p, full: true, quality: {}, limits: {}, setup: {}, beta: true,
    snapshot: { shoulderTilt: j(4, 2), pelvicTilt: j(-3.5, 2), headTilt: j(1, .5), trunkLateral: j(1.2, .6) }, side: { headForwardDeg: j(16, 6), kneeHyperDeg: j(2, 1), shoulderShift: .01, hipShift: 0 },
    moves: { ohs_front: { quality: 'GOOD', f: { ohs_valgus_r: j(12, 4), ohs_valgus_l: j(5, 2) } }, sls_r: { quality: 'GOOD', f: { sls_drop_r: j(5, 2), sls_valgus_r: j(11, 4), sls_trunk_r: j(3, 1) } }, sls_l: { quality: 'GOOD', f: { sls_drop_l: j(1.5, 1), sls_valgus_l: j(4, 2), sls_trunk_l: j(1, .5) } } } };
}
async function runTest() {
  const r = await runProtocol(consumerProtocol(), { pre: PRE }); if (!r) return;
  const { poses, ...light } = r; saveTest(light); try { await consumerPoses.save(poses); } catch (e) {} analysisScreen();
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
function joinForm() {
  const inv = INV(), acc = meSync(), pr = PROFILE() || (acc ? { name: (acc.name || '').split(' ')[0], surname: (acc.name || '').split(' ').slice(1).join(' ') } : {});
  const inp = (n, ph, v, type = 'text') => `<input id="${n}" type="${type}" value="${esc(v)}" placeholder="${ph}" class="field">`;
  const sel = (n, opts, v) => `<select id="${n}" class="field" style="padding:0 10px">${opts.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div><div class="pad" style="padding-top:4px"><div class="eyebrow">Тест от специалиста</div><h1 style="margin-top:8px">Расскажите о себе</h1>
     <p class="sub" style="margin-top:8px">${esc(inv.s)} получит анкету вместе с результатом теста. Это займет минуту.</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:12px;margin-top:16px;padding-bottom:12px">
    ${inp('fn', 'Имя *', pr.name)}${inp('ln', 'Фамилия (по желанию)', pr.surname)}
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Дата рождения</div>${inp('dob', '', pr.dob, 'date')}</div><div style="width:120px"><div class="sub" style="font-size:12px;margin-bottom:4px">Пол</div>${sel('sex', [['', '—'], ['M', 'Муж'], ['F', 'Жен']], pr.sex)}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Рост, см</div>${inp('ht', '', pr.height, 'number')}</div><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Ведущая сторона</div>${sel('hand', [['R', 'Правша'], ['L', 'Левша']], pr.hand || 'R')}</div></div>
    ${inp('act', 'Спорт или работа', pr.activity)}
    <textarea id="cmp" rows="3" placeholder="Что беспокоит" class="field" style="height:auto;padding:12px 16px">${esc(pr.complaints)}</textarea>
   </div><div class="pad" style="padding:8px 20px 24px"><button class="btn" id="nx">Дальше</button></div></div>`);
  $('#back').onclick = () => safetyScreen(inviteWelcome, () => linkConsent(inviteWelcome, (INV() || {}).s), bot());
  $('#nx').onclick = () => { const v = n => $('#' + n).value.trim(); if (!v('fn')) { $('#fn').style.borderColor = 'var(--over)'; $('#fn').focus(); return; }
    const token = pr.token || seal.rid();
    localStorage.setItem(K('bp_profile'), JSON.stringify({ token, name: v('fn'), surname: v('ln'), dob: v('dob'), sex: v('sex'), height: v('ht'), hand: v('hand'), activity: v('act'), complaints: v('cmp') }));
    inviteWelcome(); };
}
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
  track('inv_open');
  // клиенту по ссылке аккаунт не нужен: пожилые бросали тест на экране входа. Только согласия и проверка безопасности
  if (!linkConsentOk()) { linkConsent(inviteWelcome, (INV() || {}).s); return addSpecHint(); }
  if (!safetyOk()) { safetyScreen(inviteWelcome, () => linkConsent(inviteWelcome, (INV() || {}).s), bot()); return addSpecHint(); }
  voice.preload(Object.values(SAY));
  const inv = INV(); const rows = rowsOf(inv.p); const pain = PAINI;
  if (inv.join && !PROFILE()) return joinForm();
  if (inv.join) inv.n = PROFILE().name;
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div><div class="pad" style="padding-top:4px"><div class="eyebrow">Тест от специалиста</div>
     <h1 style="margin-top:8px">${(inv.n || (PROFILE() || {}).name) ? esc(inv.n || PROFILE().name) + ', ' : ''}здравствуйте!</h1>${inv.join ? '<button class="pill" id="editpf" style="margin-top:8px">Изменить анкету</button>' : ''}<p class="sub" style="margin-top:8px">${esc(inv.s)} подготовил для вас тест движения. Результат сразу придет специалисту, а вы увидите свою карту тела.</p></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:14px;margin-top:16px">
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><b style="font-size:17px">Где болит или беспокоит?</b><span class="sub" style="font-size:13px;margin-top:-6px">Отметьте зоны, если болит. Можно ничего не отмечать.</span>
      <div class="row" style="flex-wrap:wrap;gap:8px">${PAINZ.map(([k, n]) => `<button class="pill" data-pz2="${k}" style="border:1.5px solid ${pain[k] > 0 ? 'var(--brand)' : 'transparent'};${pain[k] > 0 ? 'background:var(--brand-s)' : ''}">${n}</button>`).join('')}</div>
      <div id="painsl" style="display:flex;flex-direction:column;gap:6px"></div>
      <textarea id="ccom" rows="3" maxlength="1000" class="field" placeholder="Комментарий для специалиста: что беспокоит, когда болит, что пробовали" style="height:auto;padding:12px 14px;font-size:15px">${esc(localStorage.getItem('bp_ccom_' + inv.i) || (inv.join && PROFILE() && PROFILE().complaints) || '')}</textarea></div>
    ${stepList(inv.p, PREI)}
    <p class="sub" style="font-size:13px">Поставьте телефон, отойдите на 2–4 метра, в кадре весь рост. Лучше облегающая одежда и босиком: так камера точнее видит суставы. Свет не за спиной. Около ${mins(SETUP_SEC + secs(rows))} мин.</p>
    <label class="card row" style="padding:12px 14px;align-items:flex-start"><input type="checkbox" id="share_ok" ${localStorage.getItem('bp_share_' + inv.i) ? 'checked' : ''} class="check" style="margin-top:2px">
     <span style="font-size:14px;line-height:1.45">Согласен передать ${inv.join ? 'анкету, ' : ''}оценку боли и результат теста специалисту: ${esc(inv.s)}. Данные шифруются на телефоне, сервер их не читает.</span></label>
   </div><div class="pad" style="padding:14px 20px 24px"><button class="btn" id="go">Начать тест</button>${skipBtn()}</div></div>`);
  bindStepList(PREI, inviteWelcome);
  $('#back').onclick = inv.join ? joinForm : () => safetyScreen(inviteWelcome, () => linkConsent(inviteWelcome, (INV() || {}).s), bot());
  addSpecHint();
  if ($('#skipTest')) $('#skipTest').onclick = () => { if (!$('#share_ok').checked) { $('#share_ok').parentElement.style.outline = '2px solid var(--over)'; return; }
    track('beta_skip_test'); const r = { ...fakeResult(inv.p), poses: {} }, { poses, ...light } = r; saveTest({ ...light, pain, inv: inv.i });
    try { sendResult({ ...r, pain, comment: comment(), profile: inv.join ? PROFILE() : undefined }); } catch (e) {} analysisScreen(); };
  const drawPain = () => { $('#painsl').innerHTML = PAINZ.filter(([k]) => pain[k] > 0).map(([k, n]) => `<div class="row" style="background:var(--surface-2);border-radius:var(--r-md);padding:6px 14px;min-height:48px"><span style="width:110px;font-size:14px">${n}</span><input type="range" min="1" max="10" value="${pain[k]}" data-p="${k}" style="flex:1;accent-color:var(--brand)" aria-label="${n}, боль от 1 до 10"><b class="num" id="pv_${k}" style="width:28px;text-align:right">${pain[k]}</b></div>`).join('');
    app.querySelectorAll('[data-p]').forEach(r => r.oninput = () => { pain[r.dataset.p] = +r.value; $('#pv_' + r.dataset.p).textContent = r.value; }); };
  drawPain();
  app.querySelectorAll('[data-pz2]').forEach(b => b.onclick = () => { const k = b.dataset.pz2; pain[k] = pain[k] > 0 ? 0 : 3; b.style.borderColor = pain[k] > 0 ? 'var(--brand)' : 'transparent'; b.style.background = pain[k] > 0 ? 'var(--brand-s)' : ''; drawPain(); });
  $('#ccom').oninput = e => { try { localStorage.setItem('bp_ccom_' + inv.i, e.target.value); } catch (er) {} };
  // после теста экрана с полем уже нет: берем сохраненный текст
  const comment = () => String(($('#ccom') ? $('#ccom').value : (() => { try { return localStorage.getItem('bp_ccom_' + inv.i); } catch (e) { return ''; } })()) || '').trim().slice(0, 1000);
  if ($('#editpf')) $('#editpf').onclick = joinForm;
  $('#go').onclick = async () => { if (!$('#share_ok').checked) { $('#share_ok').parentElement.style.outline = '2px solid var(--over)'; return; } localStorage.setItem('bp_share_' + inv.i, String(Date.now())); voice.unlock(); startMotion(); $('#go').textContent = 'Загружаю модель…'; try { await initPose(); } catch (e) { inviteWelcome(); return startError(e, () => $('#go') && $('#go').click()); }
    const r = await runProtocol(inv.p, { onCancel: inviteWelcome, pre: PREI }); if (!r) return;
    const { poses, ...light } = r; saveTest({ ...light, pain, inv: inv.i }); consumerPoses.save(poses).catch(() => {});
    savePosesLocal(r); const cm = comment(); sendResult({ ...r, pain, comment: cm, profile: inv.join ? PROFILE() : undefined }); analysisScreen(); };
}
// запись скелета остается и у клиента (IndexedDB на его телефоне)
function savePosesLocal(r) { try { const q = indexedDB.open('bodypassport-client', 1); q.onupgradeneeded = () => q.result.createObjectStore('poses', { keyPath: 'date' });
  q.onsuccess = () => { const t = q.result.transaction('poses', 'readwrite'); t.objectStore('poses').put({ date: r.date, protocol: r.protocol, poses: r.poses, setup: r.setup }); }; } catch (e) {} }
// неотправленный результат с записью скелета весит мегабайты: храним в IndexedDB, а не в localStorage (там квота около 5 МБ)
const outbox = (() => { const open = () => new Promise((ok, no) => { const q = indexedDB.open('bodypassport-outbox', 1); q.onupgradeneeded = () => q.result.createObjectStore('o'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
  const tx = (mode, fn) => open().then(db => new Promise((ok, no) => { const t = db.transaction('o', mode); const r = fn(t.objectStore('o')); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }));
  return { set: v => tx('readwrite', s => s.put(v, 'pending')), get: () => tx('readonly', s => s.get('pending')), clear: () => tx('readwrite', s => s.delete('pending')) }; })();
// старые версии клали неотправленное в localStorage: переносим
try { const old = localStorage.getItem('bp_pending'); if (old) { outbox.set(JSON.parse(old)).then(() => localStorage.removeItem('bp_pending')).catch(() => {}); } } catch (e) {}
async function sendResult(r) {
  const inv = INV(); if (!inv) return;
  localStorage.setItem('bp_sent', 'sending'); localStorage.setItem('bp_sent_at', String(Date.now()));
  try { const pr = PROFILE(); const payload = inv.join ? { type: 'join', token: pr && pr.token, profile: pr, result: r } : r;
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
  return `<div class="pad" id="sentbox" style="padding-top:12px"><div class="card row" style="font-size:14px;gap:10px">${st === 'ok' ? `<span class="mark OK"></span><span style="flex:1">Результат отправлен: ${esc(inv.s)}${inv.cal ? '. Специалист сверит его со своей оценкой и отправит без вашего имени на настройку приложения' : ''}</span>` : st === 'fail' ? `<i class="dia" style="color:var(--short)"></i><span style="flex:1">Не удалось отправить результат</span><button class="pill" id="resend">Отправить снова</button>` : '<span class="spin" style="margin:0;width:16px;height:16px;border-width:2px"></span><span>Отправляю результат специалисту…</span>'}</div></div>`; }

// ---------- 4. анализ: тёмный экран, фигура проявляется, три строки статуса ----------
let REVEAL = false;
async function analysisScreen() {
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
let BACK = true, SEL = null, MODE3D = false;
// короткий замер для подписи на карте: «14°», «8%»
const shortVal = t => { const m = String(t || '').match(/(\d+(?:[.,]\d+)?)\s*(°|%|см)?/); return m ? m[1] + (m[2] || '') : null; };
const VERB_OF = { WEAK: 'Укрепить', SHORT: 'Растянуть', HYPER: 'Расслабить' };
// для какой зоны итога упражнение: строка-связь на экране тренировки
function reasonsOf(ids, top) { const out = {};
  for (const id of ids) for (const s of top.slice(0, 3)) { const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left';
    const list = s.k === 'WEAK' ? ((m.plan && m.plan.isolate) || m.activate || []) : (m.relax || []);
    if (!out[id] && list.some(x => x.replace('{s}', sk) === id)) out[id] = { k: s.k, t: `${VERB_OF[s.k]} ${acc(lc(m.name))} ${sideWord(s.side)}` }; }
  return out; }
export function map() {
  const cur = currentAnalysis(); if (!cur) return onboarding(); track('map_view');
  const { t, a } = cur; const all = spots(a); const top = topOf(all);
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
   <div class="pad row" style="padding-top:16px;align-items:flex-start"><div style="flex:1;min-width:0"><div class="eyebrow">${new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · ${nSteps} ${plural3(nSteps, 'шаг', 'шага', 'шагов')}${qa != null ? ' · качество ' + qa : ''}</div><h1 style="margin-top:6px">${SHARED ? 'Карта тела' : 'Ваша карта тела'}</h1></div>${SHARED ? '' : '<button class="pill" id="cab" style="margin-right:8px">Мой кабинет</button>'}<button class="round" id="set" aria-label="Настройки">${ic('settings')}</button></div>
   ${days >= 7 && !SHARED ? `<div class="pad"><button class="row-link" id="re" style="color:var(--focus);font-weight:600"><span>Прошла неделя: пройдите быстрый тест и сравните</span>${ic('chevron-right', 's')}</button></div>` : ''}
   <div class="pad" style="margin-top:12px"><div class="card" style="border-radius:var(--r-xl);padding:12px 8px 8px">
     <div class="seg" style="margin:0 4px"><button id="vf" class="${!BACK && !MODE3D ? 'on' : ''}">Спереди</button><button id="vb" class="${BACK && !MODE3D ? 'on' : ''}">Сзади</button>${device.webgl2 ? `<button id="v3" class="${MODE3D ? 'on' : ''}">3D</button>` : ''}</div>
     <div id="vis" style="position:relative;margin:8px auto 0;width:min(100%,360px);${MODE3D ? 'height:400px' : ''}">${MODE3D ? '' : '<canvas id="heat" style="width:100%;display:block;cursor:pointer"></canvas>'}</div>
     ${MODE3D ? `<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 4px 0">${[['all', 'Всё тело'], ['head', 'Шея'], ['shoulders', 'Плечи'], ['back', 'Спина'], ['pelvis', 'Таз'], ['knees', 'Колени'], ['feet', 'Стопы']].map(([z, n]) => `<button class="pill" data-z="${z}">${n}</button>`).join('')}</div>
` : ''}
     ${`<div class="row" style="justify-content:center;gap:14px;flex-wrap:wrap;margin:6px 4px 0;font-size:13px;color:var(--sub)">${[['HYPER', 'перегружена'], ['SHORT', 'укорочена'], ['WEAK', 'слабая']].filter(([k]) => top.some(x => x.k === k)).map(([k, t]) => `<span class="row" style="gap:6px"><span class="mark sm ${k}"></span>${t}</span>`).join('')}</div>`}
     <div id="selbox" style="margin:8px 4px 0"></div></div>
     <div class="row" style="justify-content:space-between;margin:8px 4px 0;gap:8px;flex-wrap:wrap"><span class="ondevice">${ic('cpu', 's')}Посчитано на телефоне</span><span style="font-size:12px;color:var(--sub)">Оценка движения, не медицинское заключение</span></div></div>
   <div class="pad" style="margin-top:16px">${verdictCard(top, a.findings, 'Сильных перекосов не видно')}</div>
   <div class="dock">${pl.length ? `<button class="btn" id="plan">${ic('play', 's')}Комплекс на сегодня · ${totalMin(pl.map(ex))} мин</button>` : `<button class="btn" id="again">${ic('rotate-ccw', 's')}${SHARED ? 'Пройти свой тест' : 'Пройти тест заново'}</button>`}<button class="btn ghost" id="more">Подробнее: лево/право, запись, поделиться</button></div></div>`);
  if (device.webgl2 && !device.weak) preload3D();
  // подписи: зона и короткий замер цветом состояния
  const labels = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 4)).map(s => ({ key: s.key, title: C.muscles[s.id].zone + (s.side === 'RIGHT' ? ' · П' : ' · Л'), sub: toneText(s, 3).replace('похоже, ', ''), value: shortVal(seen(a, s)[0]), color: TONE_HEX[s.k], text: TONE_TEXT_HEX[s.k] }));
  let h2d = null, first = reveal;
  // на схеме и в 3D один и тот же набор: главные зоны итога (до 8) и выбранная; остальное серым
  const focusK = new Set([...top.slice(0, 8).map(x => x.key), SEL].filter(Boolean)), focus = () => all.map(x => focusK.has(x.key) || x.key === SEL ? x : { ...x, k: 'OK', tone: 0 });
  const draw2d = () => { if (!MODE3D) { h2d = drawHeat($('#heat'), focus(), BACK, SEL, labels, { reveal: first }); first = false; } };
  const renderSel = () => { const x = all.find(q => q.key === SEL); const box = $('#selbox'); if (!box) return;
    box.innerHTML = x ? `<div class="group fade" style="padding:var(--s4);background:var(--surface-2)"><div class="row" style="gap:8px"><span class="mark ${x.k}"></span><span style="font-size:13px;font-weight:600;color:${TONE[x.k][5]}">${x.ambiguous ? 'Неоднозначно' : TONE[x.k][0]}</span></div>
        <div style="font-size:17px;font-weight:700;margin-top:6px;line-height:1.25">${title(x)}</div><div style="font-size:13px;color:var(--sub);margin-top:2px">${tech(x)}</div>
        <div class="why" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:13px;color:var(--sub)">${seen(a, x)[0] ? `<span class="src">ИЗМЕРЕНО</span><span>${esc(seen(a, x)[0].replace(' (на границе нормы)', ''))}</span>${/на границе нормы/.test(seen(a, x)[0]) ? '<span class="edge">на границе нормы</span>' : ''}` : x.k === 'OK' ? 'Здесь все в порядке' : '<span class="src hyp">ГИПОТЕЗА</span><span>Напрямую не измерено</span>'}</div>
        ${x.k !== 'OK' ? `<button class="btn line" id="what" style="height:48px;margin-top:12px">Что делать ${ic('chevron-right', 's')}</button>` : ''}</div>` : '';
    const w = $('#what'); if (w) w.onclick = () => muscle(SEL); };
  const pick = k => { SEL = k; const x = all.find(q => q.key === k); if (x && x.back !== BACK && !MODE3D) { BACK = x.back; setView(); } draw2d(); renderSel(); };
  const setView = () => { $('#vf').classList.toggle('on', !BACK && !MODE3D); $('#vb').classList.toggle('on', BACK && !MODE3D); if (view3d) view3d.turn(BACK); draw2d(); };
  if (!MODE3D) { draw2d(); $('#heat').onclick = e => { const x = h2d && h2d.hit(e.clientX, e.clientY); if (x) pick(x.key); }; }
  else body3D($('#vis'), focus(), k => pick(k), { reveal: true }).then(v => { view3d = v; v.turn(BACK); app.querySelectorAll('[data-z]').forEach(b => b.onclick = () => v.focus(b.dataset.z)); });
  renderSel();
  $('#vf').onclick = () => { if (MODE3D) { MODE3D = false; BACK = false; return map(); } BACK = false; setView(); };
  $('#vb').onclick = () => { if (MODE3D) { MODE3D = false; BACK = true; return map(); } BACK = true; setView(); };
  if ($('#v3')) $('#v3').onclick = () => { if (!MODE3D) { MODE3D = true; map(); } };
  if ($('#plan')) $('#plan').onclick = () => workout(pl, why);
  if ($('#again')) $('#again').onclick = again;
  if ($('#re')) $('#re').onclick = () => { FULL = false; prep(); };
  if ($('#resend')) $('#resend').onclick = async () => { const p = await outbox.get().catch(() => null); if (p) sendResult(p); }; bindRetestCard(); if (!SHARED && INV()) addSpecHint();
  $('#set').onclick = settings; $('#more').onclick = () => moreSheet(cur, top, !!pl.length); if ($('#cab')) $('#cab').onclick = () => { SHOW_T = null; clientHome(); }; if ($('#toLast')) $('#toLast').onclick = () => { SHOW_T = null; map(); };
  // бета и калибровка: сразу после свежего теста короткая анкета «как прошло, что мешало» (один раз на тест)
  if (!SHARED && reveal && Date.now() - t.date < 30 * 60e3 && (isBetaMode() || (INV() || {}).cal)) setTimeout(() => { if (document.getElementById('heat') || document.getElementById('vis')) testSurvey(String(t.date), { cal: !!(INV() || {}).cal, steps: (t.protocol || []).length }); }, 2500);
}
function again() { if (!SHARED && INV()) return INV().join ? joinForm() : inviteWelcome(); if (SHARED) { SHARED = null; history.replaceState(null, '', location.pathname); } FULL = false; tests().length || SHARED ? prep() : onboarding(); }
// всё, что не нужно для решения «что делать сегодня», живет в шторке «Подробнее»
function moreSheet({ t, a }, top, hasPlan) {
  const all_t = SHARED ? [] : tests().filter(x => x.snapshot), first = all_t[0];
  const benefits = [...new Set(top.map(s => C.muscles[s.id].benefit).filter(Boolean))].slice(0, 3);
  const sec = (h, body) => `<div class="card" style="margin-top:var(--s3)"><div class="eyebrow">${h}</div>${body}</div>`;
  const f = a.f, rows = [['Руки в стороны, угол в конце', f.sym_delt, '°'], ['Наклон в сторону', f.sym_bend, '°'], ['Подъемы на носок', f.sym_calf, ''], ['Глубина приседа на одной ноге', f.sym_quad, '°']].filter(r => r[1]);
  const lr = rows.length ? sec('Левая и правая сторона', `<div class="row" style="margin-top:10px;font-size:12px;color:var(--sub)"><span style="flex:1"></span><b style="width:72px;text-align:center">Левая</b><b style="width:72px;text-align:center">Правая</b></div>
    ${rows.map(([n, v, u]) => { const [l, r] = v, d = Math.abs(l - r) / Math.max(1e-6, Math.max(Math.abs(l), Math.abs(r))); const weak = d > .12 ? (l < r ? 0 : 1) : -1;
      const cell = (x, i) => `<b class="num" style="width:72px;text-align:center;color:${weak === i ? 'var(--over-t)' : 'var(--text)'}">${weak === i ? '<i class="dia" style="color:var(--over)"></i> ' : ''}${fmt(x)}${u}</b>`;
      return `<div class="row" style="margin-top:8px"><span style="flex:1;font-size:14px">${n}</span>${cell(l, 0)}${cell(r, 1)}</div>`; }).join('')}
    <p style="font-size:12px;color:var(--sub);margin-top:10px">Ромб — сторона, где результат хуже больше чем на 12%.</p>`) : '';
  const ba = all_t.length >= 2 && t.snapshot && first !== t ? sec('Было → стало', [['Наклон плеч', first.snapshot.shoulderTilt, t.snapshot.shoulderTilt], ['Наклон таза', first.snapshot.pelvicTilt, t.snapshot.pelvicTilt]].map(([n, x, y]) => `<div style="margin-top:12px"><div style="font-size:14px;color:var(--sub)">${n}</div><div class="delta"><s>${fmt(x)}°</s>${ic('chevron-right', 's')}<b style="font-size:32px">${fmt(y)}°</b></div></div>`).join('')) : '';
  const lim = t.limits && Object.keys(t.limits).length ? sec('Не получилось выполнить', Object.entries(t.limits).map(([u, l]) => `<div style="margin-top:8px;font-size:14px"><b>${esc(LIMIT_NAMES[u] || u)}</b>: ${esc([l.level, ...(l.reasons || [])].filter(Boolean).join(', '))}${l.alt ? ' · сделан облегченный вариант' : ''}${l.side && l.side !== 'BOTH' ? (l.side === 'LEFT' ? ', слева' : ', справа') : ''}</div>`).join('') + '<p style="font-size:12px;color:var(--sub);margin-top:8px">Это важно для специалиста: такие ограничения разбираются на консультации.</p>') : '';
  const zones = top.length ? sec(`Все зоны · ${Math.min(5, top.length)}`, `<div class="stack" style="margin-top:8px">${top.slice(0, 5).map(s => `<div class="list-item" data-k="${s.key}" style="background:var(--bg);min-height:56px"><span class="mark ${s.k}"></span><div style="flex:1;min-width:0"><b style="font-size:15px">${title(s)}</b><div style="font-size:12px;color:var(--sub)">${tech(s)}</div></div><span class="chev">${ic('chevron-right', 's')}</span></div>`).join('')}</div>`) : '';
  const goal = benefits.length ? sec('К чему стремимся', benefits.map(b => `<div class="row" style="margin-top:10px;align-items:flex-start"><span class="mark OK" style="margin-top:3px"></span><span style="font-size:15px;line-height:1.4">${b}</span></div>`).join('') + '<p class="sub" style="font-size:14px;margin-top:12px">Делай комплекс 2 недели и пройди тест снова. Сравните карты до и после.</p>') : '';
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Подробнее</h2>${lr}${ba}${lim}${zones}${goal}
    <div class="group" style="margin-top:var(--s3)">
      ${SHARED ? '' : `<button class="row-link" id="myrec">${ic('play', 's')}<span>Моя запись: скелет и 3D-фигура</span>${ic('chevron-right', 's chev')}</button>`}
      <button class="row-link" id="shareRes">${ic('share', 's')}<span>Поделиться: ссылка или картинка</span>${ic('chevron-right', 's chev')}</button>
      ${top.length && !SHARED ? `<button class="row-link" id="cal">${ic('volume-2', 's')}<span>Напоминать каждый день в 20:00</span>${ic('chevron-right', 's chev')}</button>` : ''}
      ${hasPlan ? `<button class="row-link" id="again">${ic('rotate-ccw', 's')}<span>${SHARED ? 'Пройти свой тест' : 'Пройти тест заново'}</span>${ic('chevron-right', 's chev')}</button>` : ''}
      ${INV() ? '' : `<a class="row-link" href="${bot()}" target="_blank">${ic('message-square', 's')}<span>Разобрать карту с автором методики<small style="display:block;font-size:13px;color:var(--sub);font-weight:400">Рифат Аюпов, кинезиотерапевт, 12 лет практики · онлайн</small></span>${ic('chevron-right', 's chev')}</a>`}</div>
    ${SHARED ? '' : `<div style="margin-top:var(--s3)">${rateCard(String(t.date))}</div>${installCard()}`}
    <button class="btn" id="mx" style="margin-top:var(--s4)">Закрыть</button></div>`;
  document.body.appendChild(d); const close = () => d.remove(); d.onclick = e => { if (e.target === d) close(); };
  const q = s => d.querySelector(s);
  q('#mx').onclick = close; bindRate('map'); bindInstall();
  d.querySelectorAll('.list-item[data-k]').forEach(el => el.onclick = () => { close(); muscle(el.dataset.k); });
  q('#shareRes').onclick = () => { close(); shareResult(); };
  if (q('#cal')) q('#cal').onclick = calendar;
  if (q('#again')) q('#again').onclick = () => { close(); again(); };
  if (q('#myrec')) q('#myrec').onclick = async () => { close(); const p = await consumerPoses.get(); motionViewer(p, t.setup, map, 'Тест ' + new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })); };
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
    g.fillStyle = r.post < r.pre ? '#26775D' : r.post > r.pre ? '#C8414A' : '#5A6872'; g.fillRect(x0 + bw, base - r.post * k, bw - 2, r.post * k); });
  g.font = '400 30px Onest, sans-serif'; g.fillStyle = '#C9CCD1'; g.fillRect(x + 60, base + 22, 24, 24); g.fillStyle = '#5A6872'; g.fillText('до занятия', x + 94, base + 44);
  g.fillStyle = '#26775D'; g.fillRect(x + 330, base + 22, 24, 24); g.fillStyle = '#5A6872'; g.fillText('после', x + 364, base + 44);
  return y + h + 12;
}
export async function passportImage({ eyebrow, name, date, sp, sections = [], delta = null, footer, raw = false }) {
  await ready3D().catch(() => {}); // в отчете та же реалистичная модель, что и на экране
  const W = 1080, M = 72, cv = document.createElement('canvas'); cv.width = W; cv.height = 4200; const g = cv.getContext('2d');
  await document.fonts.ready; try { await document.fonts.load('500 32px "JetBrains Mono"'); } catch (e) {}
  g.fillStyle = '#F3F6F6'; g.fillRect(0, 0, W, cv.height);
  let y = M + 32; g.fillStyle = '#5A6872'; g.font = '500 32px "JetBrains Mono", monospace'; g.fillText(eyebrow, M, y);
  // логотип специалиста в правом верхнем углу, вписан в квадрат 110 px над именем
  if (footer && footer.logo) { try { const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = footer.logo; });
    const k = Math.min(110 / im.width, 110 / im.height), lw = im.width * k, lh = im.height * k; g.drawImage(im, W - M - lw, 28 + (110 - lh) / 2, lw, lh); } catch (e) {} }
  // имя целиком: шрифт уменьшается до 56 px, дальше многоточие; справа место под логотип
  { const maxW = W - M * 2 - (footer && footer.logo ? 140 : 0); let fs = 84, t = String(name).slice(0, 60); g.fillStyle = '#13212B';
    const fit = () => { g.font = `700 ${fs}px Onest, sans-serif`; return g.measureText(t).width <= maxW; };
    while (!fit() && fs > 56) fs -= 4; while (!fit() && t.length > 4) t = t.slice(0, -2).trimEnd() + '…';
    y += 96; g.fillText(t, M, y); }
  y += 56; g.fillStyle = '#5A6872'; g.font = '400 40px Onest, sans-serif'; g.fillText(date, M, y);
  // две карты в белых плитках
  y += 48; const tw = (W - M * 2 - 24) / 2, th = tw * 1.45;
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px'; document.body.appendChild(holder);
  for (const [i, back] of [[0, false], [1, true]]) { const x = M + i * (tw + 24); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, tw, th, 48); g.fill();
    const hc = document.createElement('canvas'); hc.style.width = '200px'; holder.appendChild(hc); drawHeat(hc, sp, back, null, [], { reveal: false });
    const ih = th - 120, iw = ih * hc.width / hc.height; g.drawImage(hc, x + (tw - iw) / 2, y + 40, iw, ih);
    g.fillStyle = '#5A6872'; g.font = '500 32px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillText(back ? 'СЗАДИ' : 'СПЕРЕДИ', x + tw / 2, y + th - 32); g.textAlign = 'left'; }
  holder.remove(); y += th + 24; const breaks = [y]; // где можно резать на страницы PDF: между блоками, а не внутри
  const wrap = (t, x0, size, weight, col, lh = 1.3) => { g.font = `${weight} ${size}px Onest, sans-serif`; g.fillStyle = col; let cur = '';
    for (const w of String(t).split(' ')) { const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > W - x0 - M && cur) { y += size * lh; g.fillText(cur, x0, y); cur = w; } else cur = tt; }
    if (cur) { y += size * lh; g.fillText(cur, x0, y); } };
  for (const sec of sections) { if (!sec.rows.length && !(sec.chart && sec.chart.length)) continue; breaks.push(y + 12); y += 64; g.fillStyle = '#13212B'; g.font = '700 46px Onest, sans-serif'; g.fillText(sec.h, M, y); y += 8;
    if (sec.chart && sec.chart.length) { y += 24; y = vasChart(g, sec.chart, M, y, W - M * 2, 300); }
    for (const [ri, r] of sec.rows.entries()) { if (ri) breaks.push(y + 10); y += 16; const y0 = y; if (r.k) { const fs = r.small ? 40 : 56; wrap(r.text, M + 72, fs, r.bold ? 700 : 400, '#13212B', 1.25); drawMark(g, M + 26, y0 + (r.small ? 26 : 36), r.k, { scale: r.small ? 1.7 : 2.2 }); }
      else wrap(r.text, M, 40, 400, r.col || '#16181C'); } }
  if (delta) { breaks.push(y + 16); y += 72; g.fillStyle = '#13212B'; g.font = '700 46px Onest, sans-serif'; g.fillText(delta.h, M, y); y += 40;
    g.fillStyle = '#5A6872'; g.font = '400 40px Onest, sans-serif'; g.fillText(delta.name, M, y + 10); y += 150;
    g.fillStyle = '#868B93'; g.font = '400 68px Onest, sans-serif'; const was = fmt(delta.was) + delta.u; g.fillText(was, M, y); const wx = M + g.measureText(was).width + 32;
    g.font = '400 56px Onest, sans-serif'; g.fillText('→', wx, y - 6); g.fillStyle = '#13212B'; g.font = '600 132px Onest, sans-serif'; g.fillText(fmt(delta.now) + delta.u, wx + 90, y + 18);
    if (delta.note) { y += 70; g.fillStyle = delta.state === 'better' ? '#1E7149' : delta.state === 'worse' ? '#B3343B' : '#5A6872'; g.font = '600 40px Onest, sans-serif'; g.fillText(delta.note, M, y); } }
  for (const extra of footer.after || []) { breaks.push(y + 16); y += 72; g.fillStyle = '#13212B'; g.font = '700 46px Onest, sans-serif'; g.fillText(extra.h, M, y); y += 8; wrap(extra.text, M, 40, 400, '#16181C'); }
  // оговорка на каждой картинке: картинку пересылают дальше, а подпись под ней ставит специалист
  breaks.push(y + 16); y += 64; wrap(footer.note || 'Предварительная оценка движения по камере телефона, не медицинское заключение.', M, 30, 400, '#5A6872');
  // подвал: фото, имя, специализация, контакты. brand: 'pro' (свой бренд, «Powered by» мелко), 'free' (плашка «Сформировано в BodyPassport»)
  const T = footer.title ? 1 : 0, FH = 220 + T * 44, H = y + M + FH, out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d'); o.drawImage(cv, 0, 0);
  o.fillStyle = '#13212B'; o.fillRect(0, H - FH, W, FH);
  // фото специалиста в кружке слева от имени
  let tx = M; if (footer.photo) { try { const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = footer.photo; });
    const D = 132, cx = M + D / 2, cy = H - FH + 92 + T * 14; o.save(); o.beginPath(); o.arc(cx, cy, D / 2, 0, Math.PI * 2); o.clip(); o.drawImage(im, M, cy - D / 2, D, D); o.restore();
    o.strokeStyle = 'rgba(255,255,255,.35)'; o.lineWidth = 3; o.beginPath(); o.arc(cx, cy, D / 2, 0, Math.PI * 2); o.stroke(); tx = M + D + 28; } catch (e) {} }
  o.fillStyle = '#fff'; o.font = '700 46px Onest, sans-serif'; o.fillText(String(footer.name).slice(0, tx > M ? 30 : 36), tx, H - FH + 76);
  if (T) { o.fillStyle = '#B9BDC4'; o.font = '400 34px Onest, sans-serif'; o.fillText(String(footer.title).slice(0, tx > M ? 40 : 48), tx, H - FH + 122); }
  if (footer.contact) { o.fillStyle = '#D0D3D8'; o.font = '400 38px Onest, sans-serif'; o.fillText(String(footer.contact).slice(0, tx > M ? 36 : 44), tx, H - FH + 128 + T * 44); }
  if (footer.brand === 'free') { const t = 'Сформировано в BodyPassport'; o.font = '600 28px Onest, sans-serif'; const w = o.measureText(t).width + 36;
    o.fillStyle = '#0E5A6B'; o.beginPath(); o.roundRect(M, H - 66, w, 46, 12); o.fill(); o.fillStyle = '#FFFFFF'; o.fillText(t, M + 18, H - 33);
    o.fillStyle = '#B9BDC4'; o.font = '400 26px Onest, sans-serif'; o.fillText('бесплатный тест движения: ' + location.host, M + w + 18, H - 33); }
  else { o.fillStyle = footer.brand === 'pro' ? '#6E737B' : '#B9BDC4'; o.font = `400 ${footer.brand === 'pro' ? 24 : 30}px Onest, sans-serif`;
    o.fillText(footer.brand === 'pro' ? 'Powered by BodyPassport' : 'BodyPassport · методика Р. Аюпова · оценка движения', M, H - 36); }
  if (raw) { out.breaks = breaks; return out; }
  return new Promise(r => out.toBlob(r, 'image/png'));
}
async function resultImage() {
  const { t, a } = currentAnalysis(); const all = spots(a); const top = topOf(all);
  const v = verdict(top, a.findings), pl = plan(top);
  return passportImage({ eyebrow: 'КАРТА ТЕЛА', name: 'Моя карта тела', date: new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }), sp: all,
    sections: [{ h: 'Что делаем', rows: v.map(x => ({ k: x.k, text: `${x.verb} ${x.what}` })) }, { h: 'Комплекс', rows: pl.slice(0, 4).map(id => ({ text: '• ' + exLabel(ex(id)) })) }],
    footer: { name: 'Пройди свой тест', contact: location.host } });
}

function share() { const url = appLink();
  const text = 'Тест осанки и движения по камере телефона, 2–5 минут. Показывает перегруженные и слабые мышцы. Бесплатно:';
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
  const why = (fd && fd.meaning) || (ch && ch.chain.description) || (s.k === 'WEAK' ? 'Мышца почти не включается, и ее работу забирают соседи.' : s.k === 'SHORT' ? 'Мышца зажата и укорочена, поэтому движение ограничено.' : 'Мышца работает больше, чем нужно, и не отдыхает даже в покое.');
  let stages;
  if (s.k === 'WEAK' && m.plan) { const subs = (m.plan.subs || []).map(x => C.muscles[x]).filter(Boolean); const rel = ids(m.plan.release), iso = ids(m.plan.isolate).filter(x => !rel.includes(x));
    stages = [['Отпусти тех, кто работает за нее', subs.length ? `Пока ${subs.map(x => x.zone.toLowerCase()).join(' и ')} перехватывают работу, упражнения нагружают их, а не нужную мышцу.` : '', (subs.find(x => x.massage) || {}).massage, rel],
      ['Включи ее отдельно', 'Легкая нагрузка, чтобы мышца снова начала включаться.', null, iso], ['Закрепи в движении', 'Мышца работает в обычном движении, без подмены.', null, ids(m.plan.integrate).filter(x => !rel.includes(x) && !iso.includes(x))]];
  } else if (s.k === 'WEAK') stages = [['Включи ее', '', null, ids(m.activate)]];
  else { const rel = ids(m.relax), ant = m.antagonist && C.muscles[m.antagonist]; const give = [...(ant ? ids((ant.plan && ant.plan.isolate) || []).concat(ids(ant.activate)) : []), ...ids(m.activate)].filter(x => !rel.includes(x));
    stages = [['Отпусти напряжение', '', m.massage, rel], [ant ? 'Включи ' + ant.zone.toLowerCase() : 'Дай работу соседям', 'Перегрузка уменьшится, когда заработают мышцы, которые сейчас отлынивают.', null, [...new Set(give)].slice(0, 1)]]; }
  stages = stages.filter(x => x[3].length || x[2]); const all = [...new Set(stages.flatMap(x => x[3]))]; let n = 0;
  const obs = seen(a, s), num = obs.map(x => String(x).match(/(\d+(?:[.,]\d+)?)\s*(°|%)?/)).find(Boolean);
  const finds = a.findings.filter(f => f.muscles.some(x => x.id === s.id && (x.side === s.side || x.side === 'BOTH')));
  const reason = { k: s.k, t: `${VERB_OF[s.k] || ''} ${acc(lc(m.name))} ${sideWord(s.side)}` };
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s4);padding-bottom:var(--s4)">
    <div class="row" style="gap:8px"><span class="mark ${s.k}"></span><span style="font-size:13px;font-weight:600;color:${TONE[s.k][5]}">${TONE[s.k][0]}</span></div>
    <div><h1 style="font-size:26px">${title(s)}</h1><div style="font-size:14px;color:var(--sub);margin-top:4px">${tech(s)}</div></div>
    ${num ? `<div><div class="measure"><b>${num[1]}</b><u>${num[2] || ''}</u></div><div class="why" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:13px;color:var(--sub)"><span class="src">ИЗМЕРЕНО</span><span>${esc(obs[0].replace(' (на границе нормы)', ''))}</span>${/на границе нормы/.test(obs[0]) ? '<span class="edge">на границе нормы</span>' : ''}</div></div>`
      : `<div class="why" style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--sub)"><span class="src hyp">ГИПОТЕЗА</span><span>Напрямую не измерено</span></div>`}
    <div class="card"><div class="eyebrow">Что происходит</div><p style="font-size:16px;line-height:1.45;margin-top:8px">${why}</p></div>
    <div class="card"><div class="eyebrow">На чем основан вывод</div>
      ${finds.map(f => `<div style="margin-top:10px"><div class="row" style="gap:6px;align-items:flex-start"><span class="src" style="margin-top:2px">ЗАМЕР</span><b style="font-size:15px;flex:1">${f.observed}</b></div><div style="font-size:13px;color:var(--sub);margin-top:2px">${f.rule.basis || ''}${f.rule.weak ? ' · слабый признак' : ''}</div></div>`).join('')
        || `<div class="row" style="gap:6px;align-items:flex-start;margin-top:10px"><span class="src hyp" style="margin-top:2px">ЦЕПЬ</span><p style="font-size:15px;line-height:1.4;flex:1">${s.byChain ? `Напрямую не измерено. Предположение по цепи «${s.byChain}».` : s.derived ? 'Напрямую не измерено. Предположение: мышца-антагонист перегружена.' : 'Признак из теста.'}</p></div>`}
      ${s.derived || finds.every(f => f.rule.weak) ? '<p style="font-size:13px;color:var(--short-t);margin-top:10px">Уверенность низкая. Проверь самопроверкой ниже или на консультации.</p>' : ''}</div>
    ${m.selfTest ? `<div class="card"><div class="eyebrow" style="color:var(--weak-t)">Проверьте себя за минуту</div><p style="font-size:15px;line-height:1.45;margin-top:8px">${m.selfTest}</p></div>` : ''}
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
function vasSheet(title, init = 0, skip = 'Пропустить') {
  return new Promise(res => { const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div><h2 style="font-size:21px">${title}</h2><p class="sub" style="font-size:14px;margin-top:6px">0 — нет боли, 10 — сильнейшая.</p>
      <div class="row" style="gap:12px;margin-top:16px"><input type="range" id="vs" min="0" max="10" value="${init}" style="flex:1;accent-color:var(--ink)" aria-label="${title}"><b id="vsv" class="num" style="font-size:32px;width:44px;text-align:right">${init}</b></div>
      <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub)"><span>нет боли</span><span>сильнейшая</span></div>
      <button class="btn" id="vok" style="margin-top:16px">Готово</button><button class="btn ghost" id="vno" style="margin-top:8px;border:0">${skip}</button></div>`;
    document.body.appendChild(d); const r = d.querySelector('#vs'); r.oninput = () => { d.querySelector('#vsv').textContent = r.value; };
    d.querySelector('#vok').onclick = () => { d.remove(); res(+r.value); }; d.querySelector('#vno').onclick = () => { d.remove(); res(null); }; });
}
export async function workout(ids, reasons = {}) {
  const pre = await vasSheet('Оцените уровень боли или дискомфорта прямо сейчас (0–10)', 0, 'Пропустить и начать');
  const list = ids.map(ex).filter(Boolean); let i = 0, closed = false, doneN = 0; voice.unlock(); keepAwake(true);
  const finish = () => done(list, pre, doneN);
  const run = async () => {
    if (closed) return; if (i >= list.length) return finish();
    const e = list[i], total = Math.max(10, e.durationSec); let left = total, playing = false; const rs = reasons[e.id];
    // камера считает повторы и подсказывает по технике там, где это надежно (мост, носки, отведение, руки вверх)
    camOff(); const tgt = targetReps(e.dose), rk = device.camera && tgt && repKind(e.id) ? repCounter(e.id) : null, sets = setsOf(e.dose);
    const camHtml = () => localStorage.getItem('bp_excam') === '1' ? `<div style="position:relative;border-radius:var(--r-lg);overflow:hidden;background:#000;height:190px"><video id="exv" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
      <div style="position:absolute;left:10px;top:8px;background:rgba(0,0,0,.55);border-radius:12px;padding:4px 10px;color:#fff"><b id="exn" class="num" style="font-size:28px">0</b><span style="font-size:14px;opacity:.8"> / ${tgt}${sets > 1 ? ' · подход <span id="exs">1</span> из ' + sets : ''}</span></div>
      <button class="pill" id="excoff" style="position:absolute;right:8px;top:8px;background:rgba(0,0,0,.55);color:#fff">Выключить</button><div id="exhint" style="position:absolute;left:10px;right:10px;bottom:8px;color:#fff;font-size:14px;text-shadow:0 1px 3px #000"></div></div>`
      : `<button class="btn line" id="excam" style="height:44px;color:#fff;border-color:rgba(255,255,255,.3)">${ic('camera', 's')}Считать повторы камерой</button>`;
    go(`<div class="scr dark fade" style="padding:16px 20px 28px">
      <div class="row"><div class="segs" style="flex:1">${list.map((_, k) => `<div><b style="width:${k <= i ? 100 : 0}%;background:${k === i ? '#fff' : 'var(--signal)'}"></b></div>`).join('')}</div><button class="round glass" id="x" aria-label="Закончить">${ic('x')}</button></div>
      <div class="eyebrow" style="color:var(--signal);margin-top:18px">${i + 1} из ${list.length}${rs ? ' · для итога' : ''}</div>
      ${rs ? `<div class="row" style="gap:8px;margin-top:6px;font-size:14px;color:var(--cam-sub)"><span class="mark sm ${rs.k}"></span><span>${esc(rs.t)}</span></div>` : ''}
      <h1 style="color:#fff;margin-top:8px">${e.title.split(' (')[0]}</h1>
      ${exSide(e) ? `<div style="display:inline-block;align-self:flex-start;width:fit-content;margin-top:8px;padding:6px 12px;border-radius:999px;background:var(--signal);color:var(--cam-bg,#0B1A20);font-weight:700;font-size:15px">${exSide(e) === 'слева' ? 'Левая сторона' : 'Правая сторона'}</div>` : ''}
      <div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap">${[e.dose, e.feel].filter(Boolean).map(x => `<span class="pill" style="background:rgba(255,255,255,.12);color:#fff">${x}</span>`).join('')}</div>
      ${hasFigure(e.id) ? `<div style="margin-top:16px;background:#F4F7F8;border-radius:var(--r-lg);padding:10px 12px 8px">${exFigure(e.id)}<div style="text-align:center;font-size:13px;color:#4A5A63;margin-top:2px">Повторяйте за фигурой · <span style="color:#C77D12">светится</span> рабочая зона</div></div>` : ''}
      ${rk ? `<div id="cambox" style="margin-top:12px">${camHtml()}</div>` : ''}
      <div class="row" style="gap:14px;margin-top:14px;align-items:center"><div style="position:relative;width:${hasFigure(e.id) ? 72 : 200}px;height:${hasFigure(e.id) ? 72 : 200}px;flex:none;margin:${hasFigure(e.id) ? '0' : '8px auto 0'}"><svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/><circle id="arc" cx="50" cy="50" r="45" fill="none" stroke="#D4F25A" stroke-width="6" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/></svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><b id="tm" class="num" style="font-size:${hasFigure(e.id) ? 20 : 56}px;font-weight:600;letter-spacing:-.02em;opacity:.45">${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}</b></div></div><span id="tml" style="font-size:14px;color:var(--cam-sub)">старт после подсказки</span></div>
      <div style="flex:1;margin-top:20px;display:flex;flex-direction:column;gap:12px">${e.steps.slice(0, 3).map((s, k) => `<div class="row st" style="opacity:.45;align-items:flex-start"><span class="step-n" style="color:var(--signal);width:22px;padding-top:2px">${String(k + 1).padStart(2, '0')}</span><span style="font-size:16px;line-height:1.35;flex:1">${s}</span></div>`).join('')}
        ${e.check ? `<div class="row" style="background:rgba(255,255,255,.08);border-radius:var(--r-md);padding:12px;align-items:flex-start;gap:10px"><span style="color:var(--signal)">${ic('info', 's')}</span><span style="font-size:14px;line-height:1.4">${e.check}</span></div>` : ''}</div>
      <div class="row" style="justify-content:center;gap:28px;margin-top:16px"><button class="round" id="pv" aria-label="Назад" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">${ic('skip-back')}</button><button class="round" id="pp" aria-label="Пауза" style="width:80px;height:80px;background:var(--signal);color:var(--cam-bg)">${ic('pause')}</button><button class="round" id="nx" aria-label="Дальше" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">${ic('skip-forward')}</button></div></div>`);
    let token = {}; const myTok = token;
    const camStart = async () => { const v = $('#exv'); if (!v || !rk) return; $('#excoff').onclick = () => { localStorage.setItem('bp_excam', '0'); camOff(); $('#cambox').innerHTML = camHtml(); bindCam(); };
      $('#exhint').textContent = 'Поставьте телефон так, чтобы было видно все тело'; let lastCue = 0, setN = 1;
      try { await initPose(); if (myTok.dead || closed) return; await startCamera(v); } catch (er) { $('#exhint').textContent = 'Камера недоступна'; return; }
      track('ex_cam', { c: rk.kind }, false);
      cam.onFrame = f => { if (myTok.dead || closed) return camOff(); const r = rk.feed(f.pose, f.t); if (!f.pose) return; if ($('#exhint').textContent.startsWith('Поставьте')) $('#exhint').textContent = '';
        if (r.ev === 'rep') { const inSet = r.n - (setN - 1) * tgt; $('#exn').textContent = inSet; voice.say(String(inSet));
          if (inSet >= tgt) { if (setN >= sets) { camOff(); voice.say('Отлично, упражнение выполнено'); mark(e); doneN++; i++; token.dead = true; setTimeout(run, 1500); return; }
            setN++; if ($('#exs')) $('#exs').textContent = setN; setTimeout(() => voice.say('Подход готов. Отдохните и продолжайте'), 600); $('#exn').textContent = 0; } }
        if (r.ev === 'low' && f.t - lastCue > 6) { lastCue = f.t; const cue = REP_KINDS[rk.kind].cue.low; $('#exhint').textContent = cue; voice.say(cue); } }; };
    const bindCam = () => { if ($('#excam')) $('#excam').onclick = () => { localStorage.setItem('bp_excam', '1'); $('#cambox').innerHTML = camHtml(); bindCam(); camStart(); }; };
    if (rk) { bindCam(); if ($('#exv')) camStart(); }
    const hush = () => { voice.say(''); try { speechSynthesis.cancel(); } catch (er) {} };
    $('#x').onclick = () => { closed = true; hush(); camOff(); keepAwake(false); if (doneN) finish(); else map(); };
    $('#pv').onclick = () => { token.dead = true; hush(); i = Math.max(0, i - 1); run(); };
    $('#nx').onclick = () => { token.dead = true; hush(); mark(e); doneN++; i++; run(); };
    $('#pp').onclick = () => { playing = !playing; $('#pp').innerHTML = ic(playing ? 'pause' : 'play'); $('#pp').setAttribute('aria-label', playing ? 'Пауза' : 'Продолжить'); };
    // читаем название и шаги по очереди, подсвечивая текущий шаг; без записи звучит системный голос
    const lit = k => app.querySelectorAll('.st').forEach((el, n) => el.style.opacity = n <= k ? 1 : .45);
    // есть мужская запись этого упражнения (тот же голос, что в тесте): играем ее, шаги подсвечиваем по ходу записи
    // запись на «вы» со стороной (озвучивается при сборке), иначе старая запись, иначе голос телефона по шагам
    const rec = [sayText(e), e.voice].find(x => x && voice.has(x));
    if (rec) { const nS = Math.min(3, e.steps.length), t0 = Date.now(), per = (rec.length * 65) / (nS + (e.check ? 1 : 0));
      const tick = setInterval(() => { if (myTok.dead || closed) return clearInterval(tick); lit(Math.min(nS - 1, Math.floor((Date.now() - t0) / per))); }, 300);
      await voice.speak(rec); clearInterval(tick); }
    else { await voice.speak(e.title.split(' (')[0] + (exSide(e) ? ', ' + (exSide(e) === 'слева' ? 'левая сторона' : 'правая сторона') : ''));
      for (let k = 0; k < Math.min(3, e.steps.length); k++) { if (myTok.dead || closed) return; lit(k); await voice.speak(e.steps[k]); }
      if (e.check && !myTok.dead && !closed) await voice.speak(e.check); }
    if (myTok.dead || closed) return; lit(-1); playing = true; $('#tm').style.opacity = 1; $('#tml').textContent = 'осталось';
    while (left > 0) { await sleep(1000); if (myTok.dead || closed) return; if (!playing) continue; left--;
      $('#tm').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; $('#arc').style.strokeDashoffset = 283 * (left / total);
      const cur = Math.min(e.steps.length - 1, Math.floor((total - left) * Math.min(3, e.steps.length) / total)); app.querySelectorAll('.st').forEach((el, k) => el.style.opacity = k <= cur ? 1 : .45);
      if (left <= 3 && left > 0) voice.say(String(left)); }
    voice.say('Отлично'); mark(e); doneN++; i++; await sleep(700); run();
  };
  run();
}
function camOff() { cam.onFrame = null; if (cam.running) stopCamera(); }
function mark(e) { const d = JSON.parse(localStorage.getItem(K('bp_done')) || '[]'); d.push({ id: e.id, t: Date.now() }); localStorage.setItem(K('bp_done'), JSON.stringify(d.slice(-500))); }
function streak() { const days = new Set(JSON.parse(localStorage.getItem(K('bp_done')) || '[]').map(x => new Date(x.t).toDateString())); let n = 0; const d = new Date(); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); } return n; }
async function done(list, pre = null, n = list.length) { camOff(); keepAwake(false); const s = Math.max(1, streak());
  const post = await vasSheet('Оцените уровень боли после упражнений (0–10)', pre ?? 0);
  const rec = { t: Date.now(), pre: pre ?? undefined, post: post ?? undefined, n, all: list.length }; const log = vasSave(rec, K('bp_vas'));
  const dl = vasDelta(pre, post); track('vas_done', { n, d: dl ?? undefined }, false);
  const w = vasStats(log, 7); sendProgress(log);
  go(`<div class="scr fade"><div class="empty" style="flex:1;justify-content:center"><span class="${dl > 0 ? 'pop' : ''}" style="width:88px;height:88px;border-radius:50%;background:var(--ok-s);color:var(--ok-t);display:flex;align-items:center;justify-content:center">${ic('check')}</span>
   <h1>${n < list.length ? `Сделано ${n} из ${list.length}` : 'Комплекс выполнен'}</h1>
   ${dl > 0 ? `<p class="vasgood" style="font-size:18px;font-weight:600;color:var(--ok-t)">Отличный результат! Уровень боли снижен на ${dl} ${dl === 1 ? 'балл' : dl < 5 ? 'балла' : 'баллов'}</p>` : dl < 0 ? '<p class="sub">Боль после занятия выше. Уменьшите амплитуду, а если повторится, покажите это специалисту.</p>' : '<p class="sub">Делай так 2 недели и повтори тест. Сравним карты.</p>'}</div>
   <div class="pad kpi"><div><b>${n}</b><span>упражнения</span></div><div><b>${w.compliance}%</b><span>дней из 7</span></div><div><b>${s}</b><span>дн. подряд</span></div></div>
   ${progressChart(log)}
   <div class="dock"><button class="btn" id="back">К карте тела</button><p style="text-align:center;font-size:13px;color:var(--sub)">Повтори тест через 7 дней, чтобы увидеть изменения</p></div></div>`);
  $('#back').onclick = map; }
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
  const inv = INV(); if (!inv || !localStorage.getItem('bp_share_' + inv.i)) return;
  const last = +(localStorage.getItem('bp_prog_at') || 0); if (Date.now() - last < 12 * 3600e3) return;
  const pr = PROFILE();
  try { const body = await seal.encrypt(inv.k, { type: 'progress', token: inv.join ? pr && pr.token : undefined, vas: log.slice(-60) });
    const r = await fetch('/api/relay?id=' + inv.i, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (r.ok) { localStorage.setItem('bp_prog_at', String(Date.now())); track('progress_sent', {}, false); } } catch (e) {}
}

// ---------- отчет специалиста по веб-ссылке: только просмотр, без входа ----------
async function reportView(code) {
  const [id, k] = String(code).split('.');
  go('<div class="scr pad" style="justify-content:center;align-items:center"><span class="spin"></span><p class="sub">Открываю отчет…</p></div>');
  let r = null; try { if (!/^[A-Za-z0-9_-]{22}$/.test(id || '') || !/^[A-Za-z0-9_-]{43}$/.test(k || '')) throw new Error('bad');
    const res = await fetch('/api/share?id=' + id, { cache: 'no-store' }); if (!res.ok) throw new Error(res.status);
    r = await seal.decrypt(k, await res.text()); if (typeof r.img !== 'string' || !r.img.startsWith('data:image/jpeg;base64,')) throw new Error('bad'); } catch (e) { r = null; }
  if (!r) { go(`<div class="scr pad fade" style="justify-content:center;gap:14px"><h1>Отчет не открылся</h1><p class="sub">Ссылка устарела (отчет хранится 90 дней) или скопирована не целиком. Попросите специалиста прислать ее снова.</p><button class="btn" id="tst">Пройти свой тест движения</button></div>`); $('#tst').onclick = () => { history.replaceState(null, '', location.pathname); onboarding(); }; return; }
  const str = (v, n) => esc(String(v || '').slice(0, n)); saveReport(code, r); const exIds = (Array.isArray(r.ex) ? r.ex : []).filter(id => ex(id));
  go(`<div class="fade" style="padding-bottom:32px"><div class="pad row" style="padding-top:12px"><span style="flex:1"></span><button class="pill" id="rcab">Мой кабинет</button></div><div class="pad" style="padding-top:4px"><div class="eyebrow">Биомеханический паспорт</div><h1 style="margin-top:6px">${str(r.name, 80)}</h1><p class="sub" style="font-size:14px">${str(r.date, 40)}${r.author ? ' · ' + str(r.author, 80) : ''}</p></div>
    <div class="pad" style="margin-top:12px"><img src="${r.img}" alt="Отчет" style="width:100%;display:block;border-radius:16px"></div>
    <div class="pad" style="margin-top:14px;display:flex;flex-direction:column;gap:8px">${exIds.length ? `<button class="btn" id="rex">${ic('play', 's')}Начать упражнения · ${totalMin(exIds.map(ex))} мин</button>` : ''}<a class="btn${exIds.length ? ' line' : ''}" id="rdl" href="${r.img}" download="bodypassport-report.jpg" style="text-decoration:none">${ic('download', 's')}Сохранить картинку</a>
    <p class="sub" style="font-size:12px;text-align:center">Отчет сохранен в вашем кабинете на этом телефоне. Он зашифрован, ключ есть только в ссылке.</p></div></div>`);
  history.replaceState(null, '', location.pathname);
  $('#rcab').onclick = clientHome; if ($('#rex')) $('#rex').onclick = () => workout(exIds);
}

// ---------- кабинет клиента: мои изменения, занятия и работа специалиста ----------
// Все хранится на этом телефоне: тесты, дневник занятий и отчеты, которые прислал специалист.
const REPS_KEY = 'bp_reports';
const myReports = () => { try { const l = JSON.parse(localStorage.getItem(REPS_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
function saveReport(code, r) {
  const s = (v, n) => String(v || '').slice(0, n), rec = { code: s(code, 80), name: s(r.name, 80), date: s(r.date, 40), author: s(r.author, 80), contact: s(r.contact, 120), at: +r.at || Date.now(),
    ex: (Array.isArray(r.ex) ? r.ex : []).filter(id => typeof id === 'string' && ex(id)).slice(0, 8), next: +r.next || 0, note: s(r.note, 600), focus: (Array.isArray(r.focus) ? r.focus : []).map(x => s(x, 120)).slice(0, 3), saved: Date.now() };
  try { localStorage.setItem(REPS_KEY, JSON.stringify([...myReports().filter(x => x.code !== rec.code), rec].sort((a, b) => a.at - b.at).slice(-30))); } catch (e) {}
}
export function clientHome() {
  track('client_home'); const all = tests(), last = all.at(-1), reps = myReports(), rep = reps.at(-1), inv = INV();
  const fmtD = t => new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const spec = (rep && rep.author) || (inv && inv.s) || '', next = (rep && rep.next > Date.now() - 864e5 && rep.next) || (inv && inv.d) || 0;
  // упражнения: назначенные специалистом, иначе подобранные по последнему тесту
  const own = last ? plan(topOf(spots(analyze(last, C)))) : [], repEx = rep && Array.isArray(rep.ex) ? rep.ex.filter(id => ex(id)) : [], exIds = (repEx.length ? repEx : own).filter(id => ex(id)), assigned = repEx.length > 0;
  const vl = vasLog(K('bp_vas')), st = vasStats(vl, 30), dayKey = t => new Date(t).toDateString(), doneDays = new Set(vl.filter(r => (r.n || 0) > 0).map(r => dayKey(r.t || 0)));
  const days14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5); return { on: doneDays.has(d.toDateString()), today: i === 13 }; });
  const zonesOf = t => topOf(spots(analyze(t, C))).filter(x => x.k !== 'OK').length;
  const card = (h, body, extra = '') => `<div class="card" style="display:flex;flex-direction:column;gap:12px"${extra}><div class="eyebrow">${h}</div>${body}</div>`;
  const delta = all.length >= 2 && all[0].snapshot && last.snapshot ? [['Наклон плеч', all[0].snapshot.shoulderTilt, last.snapshot.shoulderTilt], ['Наклон таза', all[0].snapshot.pelvicTilt, last.snapshot.pelvicTilt]]
    .filter(([, a, b]) => Number.isFinite(a) && Number.isFinite(b)).map(([n, a, b]) => { const better = Math.abs(b) < Math.abs(a) - .5, worse = Math.abs(b) > Math.abs(a) + .5;
      return `<div class="row" style="font-size:15px"><span style="flex:1">${n}</span><span class="num" style="color:var(--sub)">${Math.abs(a).toFixed(1)}°</span><span style="margin:0 8px;color:var(--faint)">→</span><b class="num" style="color:${better ? 'var(--ok-t)' : worse ? 'var(--over-t)' : 'var(--text)'}">${Math.abs(b).toFixed(1)}°</b></div>`; }).join('') : '';
  go(`<div class="scr fade" style="padding-bottom:110px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><span style="flex:1"></span><button class="round" id="cset" aria-label="Настройки">${ic('settings')}</button></div>
   <div class="pad" style="padding-top:4px">${PROFILE() && PROFILE().name ? `<div class="eyebrow">${esc(PROFILE().name)}</div>` : ''}<h1 style="margin-top:6px">Мой кабинет</h1><p class="sub" style="font-size:14px;margin-top:4px">Ваши тесты, занятия и рекомендации специалиста</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s3)">
    ${spec || next ? card('Мой специалист', `${spec ? `<div class="row" style="gap:12px"><span class="avatar">${esc(spec.slice(0, 1).toUpperCase())}</span><div style="flex:1;min-width:0"><b style="font-size:17px">${esc(spec)}</b>${rep && rep.contact ? `<div class="sub" style="font-size:14px;user-select:text">${esc(rep.contact)}</div>` : ''}</div></div>` : ''}
      ${next ? `<div class="row" style="gap:10px;font-size:15px">${ic('calendar', 's')}<span style="flex:1">Повторный тест</span><b>${fmtD(next)}</b></div>` : ''}
      ${rep && rep.focus.length ? `<div style="font-size:15px;line-height:1.45"><div class="sub" style="font-size:13px;margin-bottom:4px">Над чем работаем</div>${rep.focus.map(x => `<div>• ${esc(x)}</div>`).join('')}</div>` : ''}
      ${rep && rep.note ? `<p style="font-size:15px;line-height:1.45;background:var(--surface-2);border-radius:12px;padding:10px 12px">${esc(rep.note)}</p>` : ''}`) : ''}
    ${exIds.length ? card(assigned ? 'Упражнения от специалиста' : 'Упражнения по вашему тесту', `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${exIds.slice(0, 6).map(id => `<button class="cex" data-id="${id}" style="border:0;background:var(--surface-2);border-radius:14px;padding:4px 4px 8px;text-align:center;cursor:pointer;font:inherit;color:inherit">${exFigure(id)}<span style="display:block;font-size:12px;line-height:1.25;margin-top:2px">${esc(exLabel(ex(id)))}</span></button>`).join('')}</div>
      <button class="btn" id="cgo">${ic('play', 's')}Начать комплекс · ${totalMin(exIds.map(ex))} мин</button>`) : ''}
    ${card('Занятия за 2 недели', `<div style="display:grid;grid-template-columns:repeat(14,1fr);gap:4px">${days14.map(d => `<i style="display:block;aspect-ratio:1;border-radius:6px;background:${d.on ? 'var(--brand)' : 'var(--surface-2)'};${d.today ? 'outline:2px solid var(--accent);outline-offset:1px' : ''}"></i>`).join('')}</div>
      <div class="row" style="font-size:15px;gap:16px;flex-wrap:wrap"><span><b class="num">${st.activeDays || 0}</b> <span class="sub">дн. из 30</span></span>${st.avgPre != null && st.avgPost != null ? `<span><span class="sub">боль</span> <b class="num">${(+st.avgPre).toFixed(1)} → ${(+st.avgPost).toFixed(1)}</b></span>` : ''}</div>`)}
    ${card('Мои изменения', `${delta ? `<div style="display:flex;flex-direction:column;gap:8px"><div class="sub" style="font-size:13px">Первый тест → последний</div>${delta}</div>` : ''}
      ${all.length ? `<div class="group">${all.slice().reverse().slice(0, 8).map(t => `<button class="row-link ctest" data-d="${t.date}"><span style="flex:1;text-align:left"><b style="font-weight:600">${fmtD(t.date)}</b><small class="sub" style="display:block;font-size:13px">${zonesOf(t) ? zonesOf(t) + ' ' + plural3(zonesOf(t), 'зона требует', 'зоны требуют', 'зон требуют') + ' внимания' : 'без выраженных перекосов'}</small></span>${ic('chevron-right', 's chev')}</button>`).join('')}</div>` : '<p class="sub">Тестов пока нет.</p>'}
      ${all.length === 1 ? '<p class="sub" style="font-size:14px">Пройдите тест еще раз через 3–4 недели, и здесь появится сравнение.</p>' : ''}`)}
    ${reps.length ? card('Отчеты специалиста', `<div class="group">${reps.slice().reverse().map(r => `<button class="row-link crep" data-c="${esc(r.code)}">${ic('file-text', 's')}<span style="flex:1;text-align:left">${esc(r.date || fmtD(r.at))}<small class="sub" style="display:block;font-size:13px">${esc(r.author)}</small></span>${ic('chevron-right', 's chev')}</button>`).join('')}</div>`) : ''}
   </div><div class="dock"><button class="btn${exIds.length ? ' line' : ''}" id="ctest">${ic('rotate-ccw', 's')}Пройти тест${all.length ? ' снова' : ''}</button></div></div>`);
  $('#back').onclick = () => (all.length ? map() : onboarding()); $('#cset').onclick = settings;
  if ($('#cgo')) $('#cgo').onclick = () => workout(exIds);
  app.querySelectorAll('.cex').forEach(b => b.onclick = () => workout([b.dataset.id]));
  app.querySelectorAll('.ctest').forEach(b => b.onclick = () => { SHOW_T = +b.dataset.d; map(); });
  app.querySelectorAll('.crep').forEach(b => b.onclick = () => reportView(b.dataset.c));
  $('#ctest').onclick = () => { SHOW_T = null; again(); };
}

// ---------- настройки ----------
export function settings() {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Настройки</h2>
    <div class="group" style="margin-top:var(--s4)"><div class="row" style="min-height:56px"><span style="flex:1">Голосовые подсказки</span><button class="pill" id="vm">${voice.muted ? 'Выкл' : 'Вкл'}</button></div></div>
    <p class="ondevice" style="margin-top:var(--s3)">${ic('shield-check', 's')}Результаты хранятся только в этом браузере.</p>
    <div id="acc"></div>
    <div class="group" style="margin-top:var(--s3)">
      <button class="row-link" id="fbk">${ic('message-square', 's')}<span>Ошибка, неудобство или идея</span>${ic('chevron-right', 's chev')}</button>
      ${canInstall() ? `<button class="row-link" id="sinst">${ic('download', 's')}<span>Установить приложение</span>${ic('chevron-right', 's chev')}</button>` : ''}
      <button class="row-link" id="shapp">${ic('share', 's')}<span>Поделиться приложением</span>${ic('chevron-right', 's chev')}</button>
      ${canSwitchMode() ? `<button class="row-link" id="topro">${ic('user-plus', 's')}<span>Кабинет специалиста</span>${ic('chevron-right', 's chev')}</button>` : ''}
      <a class="row-link" href="/privacy" target="_blank">${ic('shield-check', 's')}<span>Конфиденциальность</span>${ic('chevron-right', 's chev')}</a>
      <button class="row-link" id="wipe" style="color:var(--over-t)">${ic('x', 's')}<span>Удалить все мои данные</span></button></div>
    <div class="row" style="justify-content:center;gap:16px;margin-top:var(--s3);font-size:13px"><a href="/terms" target="_blank" style="color:var(--sub);font-weight:500">Соглашение</a><a href="/licenses" target="_blank" style="color:var(--sub);font-weight:500">Лицензии</a></div>
    <p style="margin-top:var(--s3);font-size:12px;color:var(--sub);line-height:1.45">Автор методики: Рифат Аюпов, биомеханик, кинезиотерапевт, rifataiupov.com. Распознавание позы: MediaPipe (Google, Apache 2.0). 3D-модель: Z-Anatomy на основе BodyParts3D (DBCLS), CC BY-SA.</p>
    <button class="btn" id="cl" style="margin-top:var(--s4)">Готово</button></div>`;
  document.body.appendChild(d);
  d.querySelector('#fbk').onclick = () => { d.remove(); bugSheet(); };
  d.querySelector('#shapp').onclick = () => shareApp();
  if (d.querySelector('#sinst')) d.querySelector('#sinst').onclick = () => { d.remove(); installNow(); };
  d.querySelector('#vm').onclick = e => { voice.muted = !voice.muted; localStorage.setItem('bp_mute', voice.muted ? '1' : '0'); e.target.textContent = voice.muted ? 'Выкл' : 'Вкл'; };
  d.querySelector('#wipe').onclick = async () => { if (!confirm('Удалить все мои данные на этом телефоне: тесты, отчеты специалиста, занятия, анкету и ссылку от специалиста? Это нельзя отменить.')) return;
    await wipeClientData(); d.remove(); toast('Данные удалены'); onboarding(); };
  if (d.querySelector('#topro')) d.querySelector('#topro').onclick = () => { d.remove(); openPro(); };
  d.querySelector('#cl').onclick = () => d.remove(); d.onclick = e => { if (e.target === d) d.remove(); };
  accountBlock(d.querySelector('#acc'), () => d.remove());
}
async function accountBlock(el, close) {
  const u = await getMe(true); if (!el.isConnected) return;
  if (!u) { if ((await providers()).length) { el.innerHTML = '<button class="btn line" id="login" style="margin-top:12px">Войти</button>'; el.querySelector('#login').onclick = () => { close(); const home = () => (tests().length ? map() : onboarding()); ensureLogin('client', home).then(ok => ok && home()); }; } return; }
  el.innerHTML = `<div class="group" style="margin-top:var(--s3)"><div class="row" style="min-height:64px"><span class="avatar">${esc((u.name || '?').slice(0, 1).toUpperCase())}</span><div style="flex:1;font-size:14px;line-height:1.35"><b>${esc(u.name)}</b><div style="color:var(--sub);font-size:12px">${u.provider === 'google' ? 'Google' : u.provider === 'email' ? esc(u.email || 'Почта') : 'Telegram'}${u.role === 'specialist' ? ' · специалист' : ''}</div></div><button class="pill" id="lo">Выйти</button></div>
    ${u.admin ? `<button class="row-link" id="adm">${ic('settings', 's')}<span>Администрирование</span>${ic('chevron-right', 's chev')}</button>` : ''}
    <button class="row-link" id="delacc" style="color:var(--over-t)"><span>Удалить аккаунт</span></button></div>`;
  el.querySelector('#lo').onclick = async () => { const out = async () => { await logout(); localStorage.removeItem('bp_mode'); onboarding(); }; close(); if (configSync().beta !== false) exitSurvey('logout', out); else out(); };
  el.querySelector('#delacc').onclick = async () => { if (!confirm('Удалить аккаунт? Результаты на этом телефоне останутся, их можно удалить отдельно.')) return; try { await deleteAccount(); localStorage.removeItem('bp_mode'); close(); onboarding(); } catch (e) { toast('Не получилось: ' + e.message); } };
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
function screensCard(d) { const sc = Object.entries(d.screens || {}).filter(([, v]) => v.n >= 2); if (!sc.length) return '';
  // «тупят»: долго на экране, много нажатий мимо кнопок, часто уходят назад
  const score = v => (v.p50 || 0) / 30 + v.miss * 2 + v.back / Math.max(1, v.n) * 5; sc.sort((a, b) => score(b[1]) - score(a[1]));
  return `<div class="card" style="padding:14px 16px;overflow-x:auto"><b>Экраны: где тупят</b><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><tr>${['Экран', 'Показов', 'Время, с (медиана / 90%)', 'Нажатий', 'Мимо кнопок', 'Назад'].map(h => `<th style="text-align:left;padding:4px;font-weight:600">${h}</th>`).join('')}</tr>
    ${sc.slice(0, 20).map(([k, v]) => `<tr>${[esc(SCREEN_RU[k] || k), v.n, `${v.p50 ?? '—'} / ${v.p90 ?? '—'}`, v.taps, `<b style="color:${v.miss >= 1 ? 'var(--over-t)' : 'inherit'}">${v.miss}</b>`, v.back].map(x => `<td style="padding:4px;border-top:1px solid var(--line-2)">${x}</td>`).join('')}</tr>`).join('')}</table>
    <p class="sub" style="font-size:12px;margin-top:6px">Сверху экраны, где люди дольше всего стоят, жмут мимо кнопок и уходят назад: их стоит упростить в первую очередь.</p></div>`; }
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
      ${lw.length ? lw.map(x => `<div class="row" style="gap:8px;margin-top:8px;font-size:14px;line-height:1.35"><span style="flex:1">${esc(RULE_NAMES[x.rule] || x.rule)} → ${esc(x.name)}<br><small class="sub">за ${wf(x.agree)}, против ${wf(x.disagree)} · источников ${x.sources}</small></span><b class="num" style="color:${x.nw < x.w ? 'var(--over-t)' : 'var(--ok-t,#2E7D5B)'}">${wf(x.w)} → ${wf(x.nw)}</b></div>`).join('') + `<button class="btn" id="wapply" style="margin-top:12px;height:48px">Применить ${lw.length} ${lw.length === 1 ? 'изменение' : lw.length < 5 ? 'изменения' : 'изменений'} для всех</button>` : '<p style="font-size:14px;margin-top:8px">Пока нечего менять: мало мнений по одним и тем же правилам.</p>'}
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
export async function adminScreen(back) {
  back = back || (localStorage.getItem('bp_mode') === 'pro' ? () => proHome() : () => (tests().length ? map() : onboarding()));
  const beta = configSync().beta !== false, noev = localStorage.getItem('bp_noev') === '1';
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:18px">Администрирование</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:12px;padding-bottom:32px">
     <div class="card"><b>Режим приложения</b><div class="seg" style="margin-top:10px"><button id="mb" class="${beta ? 'on' : ''}">Бета</button><button id="mf" class="${beta ? '' : 'on'}">Полный</button></div>
      <p class="sub" style="font-size:13px;margin-top:8px">${beta ? 'Бета: у всех специалистов открыты все возможности, об оплате нигде не говорится, видна пометка «бета».' : 'Полный: тариф Free (5 клиентов) и PRO с оплатой через lava.top.'}</p></div>
     <label class="card row" style="align-items:flex-start"><input type="checkbox" class="check" id="noev" ${noev ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Не учитывать мои действия</b><div class="sub" style="font-size:13px">На этом устройстве ваши тесты и клики не попадают в статистику</div></div></label>
     <div class="group">
      <button class="row-link" id="ausers">${ic('user-plus', 's')}<span>Участники</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="afun">${ic('info', 's')}<span>Статистика и отзывы</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="aexp">${ic('download', 's')}<span>Выгрузить данные для анализа</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="acal">${ic('star', 's')}<span>Калибровки от специалистов</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="anorm">${ic('cpu', 's')}<span>Нормы по базе и пороги</span>${ic('chevron-right', 's chev')}</button>
      ${device.webgl2 ? `<button class="row-link" id="a3d">${ic('search', 's')}<span>Проверка 3D-модели: какая мышца где</span>${ic('chevron-right', 's chev')}</button>` : ''}</div>
     <div class="card" style="border:1px solid var(--over-t)"><b>Сбросить статистику и отзывы</b><p class="sub" style="font-size:13px;margin-top:4px">Удаляет все события и отзывы на сервере. Аккаунты и клиенты не трогает. Перед сбросом сделайте выгрузку.</p>
      <input id="rsw" class="field" style="margin-top:10px;height:48px" placeholder="Напишите СБРОС" autocomplete="off"><button class="btn line" id="rsb" style="margin-top:8px;height:48px;color:var(--over-t)" disabled>Сбросить</button></div>
    </div></div>`);
  $('#back').onclick = back;
  const mode = async v => { try { await setAppMode(v); await getMe(true); toast(v ? 'Включена бета' : 'Включен полный режим'); adminScreen(back); } catch (e) { toast('Не получилось: ' + e.message); } };
  $('#mb').onclick = () => { if (!beta) mode(true); }; $('#mf').onclick = () => { if (beta) mode(false); };
  $('#noev').onchange = e => { localStorage.setItem('bp_noev', e.target.checked ? '1' : '0'); };
  $('#afun').onclick = () => funnelScreen();
  $('#acal').onclick = () => calibInbox(() => adminScreen(back));
  $('#anorm').onclick = () => normsScreen(() => adminScreen(back));
  if ($('#a3d')) $('#a3d').onclick = () => check3D(() => adminScreen(back));
  $('#aexp').onclick = async () => { const b = $('#aexp'); b.style.opacity = .5; try { await exportData(); } catch (e) { toast('Не удалось выгрузить: ' + e.message); } b.style.opacity = 1; };
  $('#rsw').oninput = e => { $('#rsb').disabled = e.target.value.trim().toUpperCase() !== 'СБРОС'; };
  $('#rsb').onclick = async () => { if (!confirm('Точно удалить всю статистику и отзывы? Это нельзя отменить.')) return;
    const r = await fetch('/api/ev?a=reset&confirm=' + encodeURIComponent('СБРОС'), { method: 'DELETE' }); const j = await r.json().catch(() => ({}));
    toast(r.ok ? 'Удалено записей: ' + j.deleted : 'Ошибка: ' + (j.error || r.status)); if (r.ok) adminScreen(back); };
  $('#ausers').onclick = async () => { try { const list = await betaUsers();
    go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Участники · ${list.length}</b></div>
      <div class="pad" style="display:flex;flex-direction:column;gap:8px;padding-bottom:30px">${list.map(x => `<div class="card" style="padding:12px 14px;font-size:14px;line-height:1.4"><b>${esc(x.name)}</b> <span style="color:var(--sub)">${x.role === 'specialist' ? 'специалист' : 'клиент'} · ${x.provider === 'google' ? esc(x.email) : '@' + esc(x.username || 'telegram')}</span><div style="font-size:12px;color:var(--sub)">с ${new Date(x.created).toLocaleDateString('ru')}${x.ref ? ' · откуда: ' + esc(x.ref) : ''}${x.specialty ? ' · ' + esc(x.specialty) : ''} · тариф ${esc(x.plan)}${x.paidUntil > Date.now() ? ' до ' + new Date(x.paidUntil).toLocaleDateString('ru') : ''}</div>${x.role === 'specialist' ? `<button class="pill" data-pro="${esc(x.id)}" style="margin-top:8px;border:1.5px solid var(--line)">Про +30 дней</button>` : ''}</div>`).join('')}</div></div>`);
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
  ['pro', 'Специалист', [['pro_open', 'Открыли кабинет'], ['assess_start', 'Начали оценку'], ['assess_done', 'Закончили оценку'], ['report_sent', 'Отчет клиенту'], ['retest_set', 'Назначили ретест'], ['invite_sent', 'Ссылка клиенту'], ['join_sent', 'Общая ссылка'], ['result_pulled', 'Получили результат из дома'], ['retest_done', 'Сделали ретест'], ['compare_open', 'Открыли «Было → стало»'], ['report_shared', 'Отправили отчет'], ['gate_hit', 'Уперлись в тариф'], ['paywall_view', 'Видели шторку PRO'], ['limit_hit', 'Уперлись в лимит ведения'], ['pro_click', 'Нажали «PRO»'], ['trial_end', 'Пробный закончился ретестом'], ['trial_end_view', 'Видели конец пробного'], ['balance_pay', 'Оплатили PRO балансом'], ['backup_done', 'Сделали копию'], ['db_empty', 'Пустой кабинет после входа'], ['db_other', 'Нашли базу другого входа'], ['fb_sent', 'Оценка или отзыв'], ['bug_sent', 'Сообщили о проблеме']]]];
export async function funnelScreen(days = 14) {
  go('<div class="spin"></div>');
  let d; try { const r = await fetch('/api/ev?a=stats&days=' + days, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); d = await r.json(); } catch (e) { toast('Не удалось загрузить: ' + e.message); return map(); }
  const sum = k => Object.values(d.events[k] || {}).reduce((x, y) => x + y, 0);
  const block = ([role, name, steps]) => { const base = sum(role + ':' + steps[0][0]) || 1;
    return `<div class="card" style="padding:14px 16px"><b>${name}</b>${steps.map(([k, t]) => { const n = sum(role + ':' + k);
      return `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${t}</span><b>${n}</b><span style="width:52px;text-align:right;color:var(--sub)">${Math.round(n / base * 100)}%</span></div>`; }).join('')}</div>`; };
  const errs = Object.entries(d.errors || {}).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const src = Object.entries(d.sources || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const [fb, users] = await Promise.all([fetch('/api/feedback?days=' + Math.max(days, 30), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null), betaUsers().catch(() => [])]);
  const refs = users.filter(u => u.invited).sort((a, b) => b.invitedPro - a.invitedPro || b.invited - a.invited).slice(0, 10);
  const kind = { result: 'оценка теста', nps: 'порекомендует', free: 'отзыв', bug: 'проблема' };
  const bugs = fb ? fb.items.filter(x => x.k === 'bug') : [], M = d.medians || {}, med = (k, u = '') => M[k] ? `${M[k].p50}${u} <span style="color:var(--sub)">(p90 ${M[k].p90}, n ${M[k].n})</span>` : '—';
  const det = (k, t) => { const o = Object.entries((d.detail || {})[k] || {}).sort((a, b) => b[1] - a[1]).slice(0, 8); return o.length ? `<div style="margin-top:10px;font-size:13px"><b>${t}</b>${o.map(([c, n]) => `<div class="row" style="margin-top:4px"><span style="flex:1;word-break:break-word">${esc(c)}</span><b>${n}</b></div>`).join('')}</div>` : ''; };
  const weeks = Object.entries(d.weeks || {}).sort(), us = (d.users || []).filter(u => u.r === 'pro');
  const exitCard = fb && fb.exitN ? `<div class="card" style="padding:14px 16px"><b>Анкета беты при выходе (${fb.exitN})</b><div style="font-size:14px;margin-top:8px">Средняя оценка: <b>${String(fb.exitAvg).replace('.', ',')}</b> из 5 · получилось: да ${fb.exitGoals.yes}, частично ${fb.exitGoals.partly}, нет ${fb.exitGoals.no}</div>
    ${Object.entries(fb.exitIssues || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="row" style="font-size:13px;margin-top:6px"><span style="flex:1">${esc(k)}</span><b>${n}</b></div>`).join('')}
    ${fb.items.filter(x => x.k === 'exit' && x.t).slice(0, 8).map(x => `<div style="font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2)"><b>${x.s}/5</b> ${esc(x.t)}</div>`).join('')}</div>` : '<div class="card" style="padding:14px 16px"><b>Анкета беты при выходе</b><div class="sub" style="font-size:13px;margin-top:6px">Пока ответов нет</div></div>';
  const bugCard = `<div class="card" style="padding:14px 16px"><b>Проблемы от участников (${bugs.length})</b>${bugs.length ? bugs.slice(0, 30).map(x => { const g = x.d || {};
      return `<details style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2);font-size:14px"><summary style="cursor:pointer;line-height:1.4"><span style="color:var(--sub);font-size:12px">${new Date(x.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${x.r === 'pro' ? 'специалист' : 'клиент'} · ${esc(g.os || '')} ${esc(g.br || '')}</span><br>${esc(x.t)}</summary>
        <div style="font-size:12px;color:var(--sub);margin-top:6px;line-height:1.5;word-break:break-word">${esc([g.scr, g.pwa ? 'PWA' : 'браузер', g.net, g.mem ? g.mem + ' ГБ' : '', g.cpu ? g.cpu + ' ядер' : '', g.model ? 'модель ' + g.model + ' ' + (g.deleg || '') : '', g.loadSec ? 'загрузка ' + g.loadSec + ' с' : '', g.fps ? g.fps + ' fps' : '', g.persisted === false ? 'хранилище НЕ закреплено' : g.persisted ? 'хранилище закреплено' : ''].filter(Boolean).join(' · '))}
        ${g.errors && g.errors.length ? '<div style="color:var(--over-t);margin-top:4px">' + g.errors.map(esc).join('<br>') + '</div>' : ''}${g.trail ? '<div style="margin-top:4px;font-family:monospace;font-size:11px">' + g.trail.map(esc).join('<br>') + '</div>' : ''}
        ${x.contact ? `<div style="margin-top:4px;color:var(--weak-t)">Контакт: ${esc(x.contact.name)} ${esc(x.contact.handle)}</div>` : ''}</div></details>`; }).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока никто не сообщил</div>'}</div>`;
  const techCard = `<div class="card" style="padding:14px 16px"><b>Техника камеры</b><div style="font-size:13px;margin-top:8px;line-height:1.7">Загрузка модели, с: ${med('pose_init.d')}<br>Встать в кадр, с: ${med('setup.d')}<br>Подсказок до кадра: ${med('setup.n')}<br>Кадров в секунду: ${med('cam_q.n')}<br>Худшее качество шага: ${med('cam_q.q')}<br>Длина теста, с: ${med('test_done.d')}</div>
    ${det('pose_init', 'Где считается модель')}${det('pose_fail', 'Модель не загрузилась')}${det('cam_err', 'Ошибки камеры')}${det('retake', 'Пересъемки по шагам')}${det('step_skip', '«Не могу» по шагам')}${det('rage', 'Злые тапы (4 нажатия подряд)')}${det('slow', 'Подвисания интерфейса')}${det('storage', 'Хранилище кабинета')}${det('gate_hit', 'Упор в тариф')}</div>`;
  const usersCard = `<div class="card" style="padding:14px 16px"><b>Специалисты по неделям</b><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px;font-size:13px">${weeks.length ? weeks.map(([w, n]) => `<span class="pill">с ${esc(w.slice(5))}: <b>${n}</b></span>`).join('') : '<span class="sub">Пока нет данных</span>'}</div>
    ${us.length ? `<div style="margin-top:10px;font-size:12px;color:var(--sub)">Псевдоним · активных дней · оценок · отчетов · ретестов · проблем</div>` + us.slice(0, 40).map(u => `<div class="row" style="font-size:13px;margin-top:4px;font-family:monospace"><span style="flex:1">${esc(u.id)}</span><span>${u.days} · ${u.assess} · ${u.reports} · ${u.retests} · ${u.bugs}</span></div>`).join('') : ''}
    <p class="sub" style="font-size:12px;margin-top:8px">Псевдоним одинаков у одного аккаунта, но имя и почту по нему не узнать.</p></div>`;
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Статистика · ${days} дней</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:10px;padding-bottom:30px">
     <p class="sub" style="font-size:13px">Число вкладок, где шаг был хотя бы раз, сумма по дням. Процент от первого шага.</p>
     <div class="seg">${[7, 30, 90].map(n => `<button data-d="${n}" class="${n === days ? 'on' : ''}">${n} дней</button>`).join('')}</div>
     ${bugCard}
     ${chanCard(d)}${devCard(d)}${screensCard(d)}
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
     <div class="card" style="padding:14px 16px"><b>Ошибки в браузере</b>${errs.length ? errs.map(([m, n]) => `<div style="font-size:13px;margin-top:8px;word-break:break-word"><b>${n}×</b> ${esc(m)}</div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Ошибок нет</div>'}</div>
    </div></div>`);
  $('#back').onclick = () => adminScreen();
  app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => funnelScreen(+b.dataset.d));
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
  if (j && j.alive === false) { for (const k of ['bp_inv', 'bp_reports', 'bp_sent']) localStorage.removeItem(k); toast(`${inv.s || 'Специалист'} закрыл доступ по ссылке. Ваши тесты остались на телефоне`); } }

// ---------- старт ----------
(async () => {
  track('app_open', { r: REF, c: channel() });
  // бета: с какого устройства зашли, чтобы потом оптимизировать под iPhone и Android
  deviceInfo().then(d => track('device', { c: d.os + ' · ' + d.br, m: d.model || d.cls, n: d.mem || 0, r: d.pwa ? 'pwa' : 'web' })).catch(() => {});
  try { await loadContent(); } catch (e) { app.innerHTML = '<div class="scr pad" style="justify-content:center;gap:16px"><h1>Не удалось загрузить данные</h1><p class="sub">Проверь интернет и обнови страницу.</p><button class="btn" id="rl">Обновить</button></div>'; $('#rl').onclick = () => location.reload(); return; }
  mountBugTab(); await voice.init();
  // кнопка «Войти» из письма: входим и открываем свой режим (кабинет специалиста или карту клиента)
  { const ml = await mailLinkLogin(); if (ml && ml.error) toast('Ссылка для входа устарела: запросите новое письмо'); else if (ml && ml.role === 'specialist') localStorage.setItem('bp_mode', 'pro'); }
  await Promise.all([getMe(), config()]); claimLegacy(); mountBetaBar(); if (localStorage.getItem('bp_mode') !== 'pro') checkInvAlive();
  if ('serviceWorker' in navigator) {
    // когда выходит новая версия, страница один раз перезагружается сама
    let reloaded = false; const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded && !cam.running) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
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
  if (location.hash.startsWith('#r=')) { try { SHARED = cleanResult(await unpackResult(location.hash.slice(3))); } catch (e) { SHARED = null; } }
  if (location.hash.startsWith('#join=')) { try { const inv = { ...cleanInv(seal.unpack(location.hash.slice(6))), join: true }; localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  if (location.hash.startsWith('#inv=')) { try { const inv = cleanInv(seal.unpack(location.hash.slice(5))); localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  // ссылка из уведомления бота «результат в кабинете»
  if (new URLSearchParams(location.search).get('pro') === '1') { localStorage.setItem('bp_mode', 'pro'); history.replaceState(null, '', location.pathname); }
  if (!SHARED && localStorage.getItem('bp_mode') === 'pro') return openPro();
  SHARED || tests().length ? map() : onboarding();
})();
