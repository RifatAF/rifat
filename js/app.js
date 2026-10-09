// BodyPassport web: тот же поток, тексты и дизайн, что в Android-версии.
import { P, F, G, Movement, sideView, levelled, analyze, fmt, standSnapshot, sideSnapshot } from './analysis.js';
import { track } from './track.js';
import { rateCard, bindRate, installCard, bindInstall, feedbackSheet, shareApp, appLink } from './grow.js';
import { proHome, motionViewer, consumerPoses } from './pro.js';
import { seal } from './core.js';
import { ensureLogin, safetyOk, safetyScreen, getMe, meSync, tgWebLogin, logout, deleteAccount, betaUsers, providers, config } from './auth.js';
import { C, loadContent, voice, sleep, phone, startMotion, initPose, cam, startCamera, stopCamera, fullyVisible, drawSkeleton, drawSilhouette, drawHeat, drawMark, RAMP_CSS, body3D, preload3D, device, keepAwake, ic, toast, reduceMotion } from './core.js';
export { ic, toast };

const $ = s => document.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
// данные из ссылки-приглашения не подписаны: пропускаем только ожидаемые поля и форматы
function cleanInv(o) { if (!o || typeof o !== 'object') throw new Error('bad invite');
  const str = (v, n) => typeof v === 'string' ? v.replace(/[<>&"'`]/g, '').slice(0, n) : '';
  const id = /^[A-Za-z0-9_-]{16,64}$/, key = /^[A-Za-z0-9_-]{43}$/;
  if (!id.test(o.i || '') || !key.test(o.k || '')) throw new Error('bad invite');
  const p = Array.isArray(o.p) ? o.p.filter(u => typeof u === 'string' && Object.prototype.hasOwnProperty.call(UNITS, u)) : [];
  return { i: o.i, k: o.k, s: str(o.s, 80) || 'Специалист', n: str(o.n, 40), p: p.length ? p : Object.keys(UNITS) }; }
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
export const TONE_HEX = { HYPER: '#D9484F', SHORT: '#E07A2E', WEAK: '#3A72D8', OK: '#2D9467' };
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
const exSec = e => Math.max(10, e.durationSec) + 20;
export const minutes = e => Math.max(1, Math.ceil(exSec(e) / 60));
export const totalMin = list => Math.max(1, Math.round(list.reduce((x, e) => x + exSec(e), 0) / 60));
let view3d = null;
// тот же экран заново (правка, переключение вкладки): без анимации появления, иначе экран мигает
let lastHead = '';
export function go(html) { if (view3d) { view3d.dispose(); view3d = null; } backFn = null; const head = html.slice(0, 260); if (head === lastHead) html = html.replace(' fade', ''); lastHead = head; app.innerHTML = html; window.scrollTo(0, 0);
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = html.includes('class="cam"') ? '#0A0C0F' : / dark[ "]/.test(html.slice(0, 200)) ? '#111418' : '#F4F3EF'; }

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
armBack();
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
export const tech = s => s.k === 'OK' ? C.muscles[s.id].name : `${TONE[s.k][4]} ${C.muscles[s.id].gen}`;
const seen = (a, s) => [...new Set(a.findings.filter(f => f.muscles.some(m => m.id === s.id && (m.side === s.side || m.side === 'BOTH'))).map(f => f.observed))];
export function zoneImg(id) { if (['suboccipital', 'scm', 'scalene', 'deep_neck_flex', 'levator'].includes(id)) return 'img_neck'; if (['upper_trap', 'lower_trap', 'rhomboid', 'lats', 'thoracic_ext', 'serratus', 'triceps', 'deltoid'].includes(id)) return 'img_muscles_back';
  if (['pec_major', 'pec_minor', 'biceps'].includes(id)) return 'img_onb_skeleton'; if (['ql', 'erector', 'obliques', 'abdominals'].includes(id)) return 'img_back_pain'; return 'img_spine'; }
export function plan(top) { const ids = []; for (const s of top.slice(0, 3)) { const m = C.muscles[s.id], sk = s.side === 'RIGHT' ? 'right' : 'left';
  const pick = s.k === 'WEAK' ? ((m.plan && m.plan.isolate) || m.activate || [])[0] : (m.relax || [])[0]; const id = pick && pick.replace('{s}', sk); if (id && ex(id) && !ids.includes(id)) ids.push(id); } return ids.slice(0, 4); }
// кабинет специалиста только после входа
export async function openPro() { if (await ensureLogin('specialist', openPro, { back: onboarding })) proHome(); }
let SHARED = null; // результат, открытый по чужой ссылке
function currentAnalysis() { const t = SHARED || tests().at(-1); return t ? { t, a: analyze(t, C) } : null; }

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
    <div class="row pad" style="padding-top:16px"><img src="icons/logo.svg" width="28" height="28" alt=""><b style="font-size:16px;font-weight:600;flex:1">BodyPassport</b><span class="eyebrow">бета</span></div>
    <div class="pad" style="margin-top:16px"><div class="hero"><img src="img/hero_squat.webp" alt="Присед с поднятыми руками, поверх тела линии скелета"><div class="joint-tag"><small>колено П</small><b>11°</b></div><span class="ondevice">${ic('cpu', 's')}Модель на телефоне</span></div></div>
    <div class="pad" style="margin-top:24px"><h1>Как ты двигаешься: тест за 3 минуты</h1>
      <p class="sub" style="margin-top:12px">Камера измерит углы плеч, таза и коленей и подскажет, что укрепить, растянуть и расслабить. Это оценка движения, а не медицинское заключение.</p>
      <div class="row" style="margin-top:20px"><span class="avatar">РА</span><div><b style="font-size:14px;font-weight:600;display:block">Методика Рифата Аюпова</b><span style="font-size:13px;color:var(--sub)">биомеханик, кинезиотерапевт</span></div></div></div>
    <div class="dock"><button class="btn" id="next">Начать тест <span class="meta">· бесплатно</span></button><button class="btn ghost" id="pro">Я специалист</button></div></div>`);
  $('#next').onclick = () => { track('onb_done'); prep(); }; $('#pro').onclick = () => openPro();
}

// ---------- 2. подготовка ----------
const PRE = {}; // тесты, от которых человек отказался заранее
let FULL = false, STRENGTH = localStorage.getItem('bp_str') !== '0';
// ---------- протоколы: из блоков собираются и тест клиента, и шаблоны специалиста ----------
// секунды шагов измерены по длине записанных фраз и паузам в коде
export const UNITS = {
  stand: [['Стой ровно', 'Руки вдоль тела', 17]],
  ohs_front: [['Присед с руками вверх', '5 раз', 33]],
  sls: [['Стоя на правой ноге', '3 неглубоких приседа', 26], ['Стоя на левой ноге', '3 неглубоких приседа', 24]],
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
  voice.preload(Object.values(SAY));
  const reopen = !!document.getElementById('prepsheet');
  const steps = stepsOf(), m = mins(SETUP_SEC + secs(steps));
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:var(--s4)">
    <div><div class="eyebrow">Видеотест · ${m} мин · ${steps.length} ${plural3(steps.length, 'шаг', 'шага', 'шагов')}</div><h1 style="margin-top:8px">Поставь телефон на пол и отойди</h1></div>
    <div class="card"><div class="row" style="gap:var(--s2);align-items:flex-end;justify-content:center;padding:4px 0 12px">
      <svg width="34" height="56" viewBox="0 0 34 56" aria-hidden="true"><rect x="2" y="2" width="30" height="52" rx="6" fill="none" stroke="var(--ink)" stroke-width="2.5"/><circle cx="17" cy="9" r="2.5" fill="var(--ink)"/></svg>
      <div style="flex:1;max-width:150px;text-align:center"><div class="measure sm" style="justify-content:center"><b>2–4</b><u>м</u></div><div style="border-top:2px dashed var(--line);margin-top:6px"></div></div>
      <svg width="40" height="76" viewBox="0 0 200 380" aria-hidden="true"><circle cx="100" cy="44" r="24" fill="var(--figure)" stroke="var(--faint)" stroke-width="5"/><path d="M78 72 L122 72 Q140 74 144 92 L156 176 Q158 186 150 188 Q144 188 142 180 L132 112 L128 190 L130 268 L128 352 Q128 362 118 362 Q110 362 110 352 L104 210 L96 210 L90 352 Q90 362 82 362 Q72 362 72 352 L70 268 L72 190 L68 112 L58 180 Q56 188 50 188 Q42 186 44 176 L56 92 Q60 74 78 72 Z" fill="var(--figure)" stroke="var(--faint)" stroke-width="5"/></svg></div>
      ${[['Телефон вертикально. <b>Точнее всего на штативе</b> на уровне пояса; подойдет и пол у стены'], ['В кадре весь рост, от макушки до стоп'], ['Дальше ведет голос, экран можно не видеть']].map(([t], i) => `<div class="row" style="align-items:flex-start;padding:10px 0;border-top:1px solid var(--line-2)"><span class="step-n" style="width:20px;padding-top:2px">${i + 1}</span><span style="flex:1;font-size:15px;line-height:1.4">${t}</span></div>`).join('')}</div>
    <div class="group"><div class="row" style="min-height:64px"><div style="flex:1;min-width:0"><b style="font-size:15px">${FULL ? 'Точный · с поворотами' : 'Быстрый · лицом и боком'}</b><div style="font-size:13px;color:var(--sub)">${cam.back ? 'Основная камера' : 'Фронтальная камера'}${FULL && STRENGTH ? ' · сила и симметрия' : ''} · ${steps.length} ${plural3(steps.length, 'шаг', 'шага', 'шагов')}</div></div><button class="link" id="chg">Изменить</button></div></div>
    ${device.inApp ? `<div class="card row" style="align-items:flex-start">${ic('info')}<span style="font-size:14px;line-height:1.4">Ты открыл ссылку внутри приложения соцсети. Камера здесь может не работать: открой через меню «⋯» → «Открыть в браузере».</span></div>` : ''}
   </div>
   <div class="dock"><span class="ondevice" style="justify-content:center">${ic('cpu', 's')}Модель уже на телефоне · видео не уходит</span><button class="btn" id="start">Начать тест</button><button class="btn ghost" id="cant">Какой-то шаг не смогу сделать</button></div></div>`);
  $('#back').onclick = () => tests().length ? map() : onboarding();
  $('#chg').onclick = () => prepSheet(); $('#cant').onclick = () => prepSheet(true);
  if (reopen) prepSheet(false, true);
  $('#start').onclick = async () => { voice.unlock(); startMotion(); const b = $('#start'); b.disabled = true; b.innerHTML = '<span class="spin" style="margin:0;width:20px;height:20px;border-width:2.5px;border-color:rgba(255,255,255,.3);border-top-color:#fff"></span>Загружаю модель на телефон…';
    try { await initPose(); runTest(); } catch (e) { toast('Не удалось запустить модель: ' + e.message); b.disabled = false; b.textContent = 'Начать тест'; } };
}
// шторка настроек теста: режим, камера, сила, список шагов с «Не могу». После перерисовки prep() остается открытой
function prepSheet(toSteps, keep) {
  document.querySelectorAll('#prepsheet').forEach(x => x.remove());
  const d = document.createElement('div'); d.className = 'sheet'; d.id = 'prepsheet'; if (keep) d.style.animation = 'none';
  d.innerHTML = `<div${keep ? ' style="animation:none"' : ''}><h2>Настройки теста</h2>
    <div class="seg" style="margin-top:var(--s4)"><button id="m0" class="${FULL ? '' : 'on'}">Быстрый · ${mins(SETUP_SEC + secs(QUICK))} мин</button><button id="m1" class="${FULL ? 'on' : ''}">Точный · ${mins(SETUP_SEC + secs(FULLS) + (STRENGTH ? secs(STR) : 0))} мин</button></div>
    <div class="eyebrow" style="margin-top:var(--s5)">Камера</div><div class="seg" style="margin-top:8px"><button id="c0" class="${cam.back ? '' : 'on'}">Фронтальная</button><button id="c1" class="${cam.back ? 'on' : ''}">Основная</button></div>
    <p class="sub" style="font-size:13px;margin-top:6px">${cam.back ? 'Точнее картинка. Экран не видно, ведет голос.' : 'Видишь себя на экране во время теста.'}</p>
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
  slsR: ['Стоя на правой ноге', '3 неглубоких приседа, можно держаться за стену', 'Встань на правую ногу, левую согни и подними. Можно держаться рукой за стену. Медленно присядь неглубоко три раза. Начинай, я буду считать'],
  slsL: ['Стоя на левой ноге', '3 неглубоких приседа, можно держаться за стену', 'Теперь встань на левую ногу, правую согни и подними. Медленно присядь неглубоко три раза. Начинай'],
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
  footDown: 'Стоп. Опусти ногу.',
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
export async function runProtocol(protocol, opts = {}) {
  await voice.ensure(Object.values(SAY));
  const pre = opts.pre || {}; const units = sortUnits(protocol); const steps = rowsOf(units.filter(u => !pre[u] || pre[u].alt));
  go(`<div class="cam"><video playsinline muted></video><canvas id="sil"></canvas><canvas id="sk"></canvas><div class="count" id="cnt"></div>
   <div class="top"><div class="segs">${steps.map(() => '<div><b></b></div>').join('')}</div><button class="round glass" id="x" aria-label="Закончить тест">${ic('x')}</button></div>
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
  $('#x').onclick = () => { stop = true; stopCamera(); cancel(); }; $('#skipb').onclick = () => { skip = true; };
  const video = app.querySelector('video'); const sk = $('#sk');
  try { if (!device.camera) throw new Error('no camera api'); await startCamera(video); } catch (e) { stop = true; return cameraHelp(); }
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
  let lastHint = '', lastHintAt = 0;
  const hint = (text, gap = 4000) => { const now = Date.now(); if (now - lastHintAt < gap || (text === lastHint && now - lastHintAt < 7000)) return; lastHint = text; lastHintAt = now; lastIssue = text; $('#cue').textContent = text; voice.say(text); };
  // ---- запись ----
  const grab = (fr, rolls) => { const f = cam.frame; if (f && f.pose && (!fr.length || fr.at(-1).t !== f.t)) { fr.push({ t: f.t, p: levelled(f.pose, f.w, f.h, corr()), w: f.world }); rolls.push(phone.roll); } };
  const poses = {}, quality = {}; let W = 1, H = 1;
  const keep = (key, fr, rolls, vis) => { const f = cam.frame; if (f) { W = f.w; H = f.h; } if (!fr.length) return; poses[key] = packPoses(fr, W, H);
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
  const reps = async (key, an, deep = .12, N = 3) => { voice.beep('start'); const fr = [], rolls = []; if (skip) return { f: {}, reps: 0, quality: 'RETAKE' };
    let n = 0, down = false, base = null, leg = null, maxFlex = 0; const t0 = Date.now(); let lastMove = Date.now(); bar(0, `Повторы: 0 из ${N}`); $('#reps').hidden = false; $('#ring').textContent = 0; $('#repn').textContent = `из ${N}`;
    while (!stop && !skip && n < N && Date.now() - t0 < 60000) { grab(fr, rolls); const p = fr.length && fr.at(-1).p;
      if (p) { const hy = (p[P.L_HIP].y + p[P.R_HIP].y) / 2; if (leg == null) leg = Math.max(1, Math.abs(((p[P.L_ANKLE].y + p[P.R_ANKLE].y) / 2) - hy));
        base = base == null ? hy : Math.min(base, hy * .02 + base * .98, base); const dy = (hy - base) / leg;
        const fl = Math.max(F.kneeFlexion(p, true), F.kneeFlexion(p, false)); if (fl > maxFlex) maxFlex = fl;
        if (!down && dy > deep) { down = true; lastMove = Date.now(); }
        if (down && dy < deep * .35) { down = false; n++; lastMove = Date.now(); $('#ring').textContent = n; bar(n / N, `Повторы: ${n} из ${N}`); voice.say(['Раз', 'Два', 'Три', 'Четыре', 'Пять'][n - 1]); } }
      if (!down && Date.now() - lastMove > 6000) { lastMove = Date.now(); hint(SAY.repWait, 0); }
      await sleep(30); }
    const r = fr.length > 10 ? an(fr) : { f: {}, reps: 0, quality: 'RETAKE' }; if (r.f) r.f.max_knee_flex = maxFlex; keep(key, fr, rolls, r.visibility);
    if (n === 0 && !skip && !stop) r.quality = 'RETAKE'; await sleep(700); voice.beep('stop'); return r; };
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
    if (stop) return; setupDone = true; sil.style.transition = 'opacity .32s'; sil.style.opacity = 0; await say(SAY.seen); }
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
      const st = await hold('stand', 5, 'Замри'); if (stop || skipped()) return;
      snapshot = standSnapshot(st);
      const f = cam.frame; setup = { bodyFrac: med(st.map(x => bodyFrac(x.p))) / (f ? f.h : 1), roll: phone.roll, pitch: phone.pitch ?? null, back: cam.back, w: f && f.w, h: f && f.h }; await say(SAY.good); k++; }
    if (u === 'ohs_front') { await face('front'); step(k, 'Присед с руками вверх', 'Руки вверх, пятки на полу, 5 раз', FOC.squat); await say(SAY.ohsIntro); if (skipped()) return; await say(SAY.ohsGo);
      moves.ohs_front = await reps('ohs_front', fr => Movement.front(fr), .12, 5); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'sls') { await face('front');
      step(k, 'Стоя на правой ноге', 'Левую ногу подними, 3 неглубоких приседа', FOC.kneeR); await say(SAY.slsRIntro); if (skipped()) return; await say(SAY.slsRGo);
      moves.sls_r = await reps('sls_r', fr => Movement.singleLeg(fr, true), .06); if (skipped()) return; await say(SAY.footDown); k++;
      step(k, 'Стоя на левой ноге', 'Правую ногу подними, 3 неглубоких приседа', FOC.kneeL); await say(SAY.slsLIntro); if (skipped()) return; await say(SAY.slsLGo);
      moves.sls_l = await reps('sls_l', fr => Movement.singleLeg(fr, false), .06); if (skipped()) return; await say(SAY.footDown); k++; }
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
      step(k, 'Боком: присед', 'Руки вверх, 3 раза'); await say(SAY.armsOverhead); await say(SAY.squatGo);
      moves.ohs_side = await reps('ohs_side', fr => Movement.side(fr)); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'profile') { await face('side'); step(k, 'Боком: стой ровно', 'Руки вдоль тела, смотри прямо', null); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (stop || skipped()) return; side = sideSnapshot(sf);
      await say(SAY.good); k++; }
    if (u === 'back') { await face('back'); step(k, 'Спиной: присед', 'Руки вверх, 3 раза', FOC.squat); await say(SAY.armsOverhead); if (skipped()) return; await say(SAY.squatGo);
      moves.ohs_back = await reps('ohs_back', fr => Movement.back(fr)); if (skipped()) return; await say(SAY.stop); k++; }
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
      if (bad) { const again = await retakeScreen(lastIssue, light >= 45, level, fullyVisible(cam.frame && cam.frame.pose)); if (stop) return;
        if (again) { k = k0; lastIssue = ''; await runUnit(u); } else skip = true; }
      else if (k > k0) await okFlash(steps[k - 1] ? steps[k - 1][0] : '', k); }
    if (skip && !stop) { voice.beep('stop'); step(null, 'Не получается? Ничего страшного', 'Ответь на пару вопросов'); limits[u] = await cantSheet(u); skip = false;
      if (/опор|неглуб/i.test(limits[u].level || '') && (u === 'ohs_front' || u === 'sls')) { limits[u].alt = 'support'; await runAlt(u); } else k = k0 + (UNITS[u] || []).length; }
  }
  if (stop) return;
  step(null, 'Готово', 'Считаю результат'); bar(1, ''); cam.onFrame = null; await say(SAY.finish); stopCamera();
  track('test_done', { n: units.length, d: Math.round((Date.now() - tStart) / 1000) }, false);
  return { date: Date.now(), protocol: units, full: units.includes('side') || units.includes('profile'), snapshot, side, moves, poses, quality, limits, setup };
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
  go(`<div class="scr fade"><div class="pad" style="padding-top:20px"><div class="eyebrow">Тест от специалиста</div><h1 style="margin-top:8px">Расскажите о себе</h1>
     <p class="sub" style="margin-top:8px">${esc(inv.s)} получит анкету вместе с результатом теста. Это займет минуту.</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:12px;margin-top:16px;padding-bottom:12px">
    ${inp('fn', 'Имя *', pr.name)}${inp('ln', 'Фамилия (по желанию)', pr.surname)}
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Дата рождения</div>${inp('dob', '', pr.dob, 'date')}</div><div style="width:120px"><div class="sub" style="font-size:12px;margin-bottom:4px">Пол</div>${sel('sex', [['', '—'], ['M', 'Муж'], ['F', 'Жен']], pr.sex)}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Рост, см</div>${inp('ht', '', pr.height, 'number')}</div><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Ведущая сторона</div>${sel('hand', [['R', 'Правша'], ['L', 'Левша']], pr.hand || 'R')}</div></div>
    ${inp('act', 'Спорт или работа', pr.activity)}
    <textarea id="cmp" rows="3" placeholder="Что беспокоит" class="field" style="height:auto;padding:12px 16px">${esc(pr.complaints)}</textarea>
   </div><div class="pad" style="padding:8px 20px 24px"><button class="btn" id="nx">Дальше</button></div></div>`);
  $('#nx').onclick = () => { const v = n => $('#' + n).value.trim(); if (!v('fn')) { $('#fn').style.borderColor = 'var(--over)'; $('#fn').focus(); return; }
    const token = pr.token || seal.rid();
    localStorage.setItem(K('bp_profile'), JSON.stringify({ token, name: v('fn'), surname: v('ln'), dob: v('dob'), sex: v('sex'), height: v('ht'), hand: v('hand'), activity: v('act'), complaints: v('cmp') }));
    inviteWelcome(); };
}
const PREI = {}, PAINI = {};
async function inviteWelcome() {
  track('inv_open');
  if (!(await ensureLogin('client', inviteWelcome))) return;
  if (!safetyOk()) return safetyScreen(inviteWelcome, null, bot());
  voice.preload(Object.values(SAY));
  const inv = INV(); const rows = rowsOf(inv.p); const pain = PAINI;
  if (inv.join && !PROFILE()) return joinForm();
  if (inv.join) inv.n = PROFILE().name;
  go(`<div class="scr fade"><div class="pad" style="padding-top:20px"><div class="eyebrow">Тест от специалиста</div>
     <h1 style="margin-top:8px">${(inv.n || (PROFILE() || {}).name) ? esc(inv.n || PROFILE().name) + ', ' : ''}здравствуйте!</h1>${inv.join ? '<button class="pill" id="editpf" style="margin-top:8px">Изменить анкету</button>' : ''}<p class="sub" style="margin-top:8px">${esc(inv.s)} подготовил для вас тест движения. Результат сразу придет специалисту, а вы увидите свою карту тела.</p></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:14px;margin-top:16px">
    ${stepList(inv.p, PREI)}
    <div><b>Где болит сейчас, 0–10</b>${PAINZ.map(([k, n]) => `<div class="row" style="background:var(--surface);border-radius:var(--r-md);padding:6px 16px;margin-top:6px;min-height:52px"><span style="width:110px;font-size:14px">${n}</span><input type="range" min="0" max="10" value="${pain[k] || 0}" data-p="${k}" style="flex:1;accent-color:var(--ink)"><b style="width:22px;text-align:right" id="pv_${k}">${pain[k] || 0}</b></div>`).join('')}</div>
    <p class="sub" style="font-size:13px">Поставьте телефон, отойдите на 2–4 метра, в кадре весь рост. Около ${mins(SETUP_SEC + secs(rows))} мин.</p>
    <label class="card row" style="padding:12px 14px;align-items:flex-start"><input type="checkbox" id="share_ok" ${localStorage.getItem('bp_share_' + inv.i) ? 'checked' : ''} class="check" style="margin-top:2px">
     <span style="font-size:14px;line-height:1.45">Согласен передать ${inv.join ? 'анкету, ' : ''}оценку боли и результат теста специалисту: ${esc(inv.s)}. Данные шифруются на телефоне, сервер их не читает.</span></label>
   </div><div class="pad" style="padding:14px 20px 24px"><button class="btn" id="go">Начать тест</button></div></div>`);
  bindStepList(PREI, inviteWelcome);
  app.querySelectorAll('[data-p]').forEach(r => r.oninput = () => { pain[r.dataset.p] = +r.value; $('#pv_' + r.dataset.p).textContent = r.value; });
  if ($('#editpf')) $('#editpf').onclick = joinForm;
  $('#go').onclick = async () => { if (!$('#share_ok').checked) { $('#share_ok').parentElement.style.outline = '2px solid var(--over)'; return; } localStorage.setItem('bp_share_' + inv.i, String(Date.now())); voice.unlock(); startMotion(); $('#go').textContent = 'Загружаю модель…'; try { await initPose(); } catch (e) { toast('Не удалось запустить камеру или модель'); return inviteWelcome(); }
    const r = await runProtocol(inv.p, { onCancel: inviteWelcome, pre: PREI }); if (!r) return;
    const { poses, ...light } = r; saveTest({ ...light, pain, inv: inv.i }); consumerPoses.save(poses).catch(() => {});
    savePosesLocal(r); sendResult({ ...r, pain, profile: inv.join ? PROFILE() : undefined }); analysisScreen(); };
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
  localStorage.setItem('bp_sent', 'sending');
  try { const pr = PROFILE(); const payload = inv.join ? { type: 'join', token: pr && pr.token, profile: pr, result: r } : r;
    const body = await seal.encrypt(inv.k, payload); const res = await fetch('/api/relay?id=' + inv.i, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
    if (!res.ok) throw new Error(res.status); localStorage.setItem('bp_sent', 'ok'); track('result_sent'); outbox.clear().catch(() => {}); }
  catch (e) { localStorage.setItem('bp_sent', 'fail'); track('result_fail', { c: String(e.message || e) }); await outbox.set(r).catch(() => {}); }
  const box = document.getElementById('sentbox'); if (box) box.outerHTML = sentBanner();
}
function sentBanner() { const inv = INV(); if (!inv) return ''; const st = localStorage.getItem('bp_sent');
  return `<div class="pad" id="sentbox" style="padding-top:12px"><div class="card row" style="font-size:14px;gap:10px">${st === 'ok' ? `<span class="mark OK"></span><span style="flex:1">Результат отправлен: ${esc(inv.s)}</span>` : st === 'fail' ? `<i class="dia" style="color:var(--short)"></i><span style="flex:1">Не удалось отправить результат</span><button class="pill" id="resend">Отправить снова</button>` : '<span class="spin" style="margin:0;width:16px;height:16px;border-width:2px"></span><span>Отправляю результат специалисту…</span>'}</div></div>`; }

// ---------- 4. анализ: тёмный экран, фигура проявляется, три строки статуса ----------
let REVEAL = false;
async function analysisScreen() {
  SEL = null; MODE3D = false; REVEAL = true;
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
   ${!SHARED && INV() ? sentBanner() : ''}
   ${SHARED ? `<div class="pad" style="padding-top:12px"><div class="card row" style="font-size:14px">${ic('info', 's')}<span>Это результат по ссылке. Твои данные не меняются.</span></div></div>` : ''}
   <div class="pad row" style="padding-top:16px;align-items:flex-start"><div style="flex:1;min-width:0"><div class="eyebrow">${new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · ${nSteps} ${plural3(nSteps, 'шаг', 'шага', 'шагов')}${qa != null ? ' · качество ' + qa : ''}</div><h1 style="margin-top:6px">${SHARED ? 'Карта тела' : 'Твоя карта тела'}</h1></div><button class="round" id="set" aria-label="Настройки">${ic('settings')}</button></div>
   ${days >= 7 && !SHARED ? `<div class="pad"><button class="row-link" id="re" style="color:var(--focus);font-weight:600"><span>Прошла неделя: пройди быстрый тест и сравни</span>${ic('chevron-right', 's')}</button></div>` : ''}
   <div class="pad" style="margin-top:12px"><div class="card" style="border-radius:var(--r-xl);padding:12px 8px 8px">
     <div class="seg" style="margin:0 4px"><button id="vf" class="${!BACK && !MODE3D ? 'on' : ''}">Спереди</button><button id="vb" class="${BACK && !MODE3D ? 'on' : ''}">Сзади</button>${device.webgl2 ? `<button id="v3" class="${MODE3D ? 'on' : ''}">3D</button>` : ''}</div>
     <div id="vis" style="position:relative;margin:8px auto 0;width:min(100%,360px);${MODE3D ? 'height:400px' : ''}">${MODE3D ? '' : '<canvas id="heat" style="width:100%;display:block;cursor:pointer"></canvas>'}</div>
     ${MODE3D ? `<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 4px 0">${[['all', 'Всё тело'], ['head', 'Шея'], ['shoulders', 'Плечи'], ['back', 'Спина'], ['pelvis', 'Таз'], ['knees', 'Колени'], ['feet', 'Стопы']].map(([z, n]) => `<button class="pill" data-z="${z}">${n}</button>`).join('')}</div>
       <div style="padding:12px 12px 4px"><div style="height:8px;border-radius:4px;background:${RAMP_CSS}"></div><div class="row" style="justify-content:space-between;font-size:12px;margin-top:6px"><span style="color:var(--weak-t)">Слабость</span><span style="color:var(--sub)">Норма</span><span style="color:var(--over-t)">Перегрузка</span></div></div>` : ''}
     <div id="selbox" style="margin:8px 4px 0"></div></div>
     <div class="row" style="justify-content:space-between;margin:8px 4px 0;gap:8px;flex-wrap:wrap"><span class="ondevice">${ic('cpu', 's')}Посчитано на телефоне</span><span style="font-size:12px;color:var(--sub)">Оценка движения, не медицинское заключение</span></div></div>
   <div class="pad" style="margin-top:16px">${verdictCard(top, a.findings, 'Сильных перекосов не видно')}</div>
   <div class="dock">${pl.length ? `<button class="btn" id="plan">${ic('play', 's')}Комплекс на сегодня · ${totalMin(pl.map(ex))} мин</button>` : `<button class="btn" id="again">${ic('rotate-ccw', 's')}${SHARED ? 'Пройти свой тест' : 'Пройти тест заново'}</button>`}<button class="btn ghost" id="more">Подробнее: лево/право, запись, поделиться</button></div></div>`);
  if (device.webgl2 && !device.weak) preload3D();
  // подписи: зона и короткий замер цветом состояния
  const labels = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 4)).map(s => ({ key: s.key, title: C.muscles[s.id].zone + (s.side === 'RIGHT' ? ' · П' : ' · Л'), sub: toneText(s, 3).replace('похоже, ', ''), value: shortVal(seen(a, s)[0]), color: TONE_HEX[s.k], text: TONE_TEXT_HEX[s.k] }));
  let h2d = null, first = reveal;
  const draw2d = () => { if (!MODE3D) { h2d = drawHeat($('#heat'), all, BACK, SEL, labels, { reveal: first }); first = false; } };
  const renderSel = () => { const x = all.find(q => q.key === SEL); const box = $('#selbox'); if (!box) return;
    box.innerHTML = x ? `<div class="group fade" style="padding:var(--s4);background:var(--surface-2)"><div class="row" style="gap:8px"><span class="mark ${x.k}"></span><span style="font-size:13px;font-weight:600;color:${TONE[x.k][5]}">${x.ambiguous ? 'Неоднозначно' : TONE[x.k][0]}</span></div>
        <div style="font-size:17px;font-weight:700;margin-top:6px;line-height:1.25">${title(x)}</div><div style="font-size:13px;color:var(--sub);margin-top:2px">${tech(x)}</div>
        <div class="why" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:13px;color:var(--sub)">${seen(a, x)[0] ? `<span class="src">ИЗМЕРЕНО</span><span>${esc(seen(a, x)[0].replace(' (на границе нормы)', ''))}</span>${/на границе нормы/.test(seen(a, x)[0]) ? '<span class="edge">на границе нормы</span>' : ''}` : x.k === 'OK' ? 'Здесь все в порядке' : '<span class="src hyp">ГИПОТЕЗА</span><span>Напрямую не измерено</span>'}</div>
        ${x.k !== 'OK' ? `<button class="btn line" id="what" style="height:48px;margin-top:12px">Что делать ${ic('chevron-right', 's')}</button>` : ''}</div>` : '';
    const w = $('#what'); if (w) w.onclick = () => muscle(SEL); };
  const pick = k => { SEL = k; const x = all.find(q => q.key === k); if (x && x.back !== BACK && !MODE3D) { BACK = x.back; setView(); } draw2d(); renderSel(); };
  const setView = () => { $('#vf').classList.toggle('on', !BACK && !MODE3D); $('#vb').classList.toggle('on', BACK && !MODE3D); if (view3d) view3d.turn(BACK); draw2d(); };
  if (!MODE3D) { draw2d(); $('#heat').onclick = e => { const x = h2d && h2d.hit(e.clientX, e.clientY); if (x) pick(x.key); }; }
  else body3D($('#vis'), all, k => pick(k), { reveal: true }).then(v => { view3d = v; v.turn(BACK); app.querySelectorAll('[data-z]').forEach(b => b.onclick = () => v.focus(b.dataset.z)); });
  renderSel();
  $('#vf').onclick = () => { if (MODE3D) { MODE3D = false; BACK = false; return map(); } BACK = false; setView(); };
  $('#vb').onclick = () => { if (MODE3D) { MODE3D = false; BACK = true; return map(); } BACK = true; setView(); };
  if ($('#v3')) $('#v3').onclick = () => { if (!MODE3D) { MODE3D = true; map(); } };
  if ($('#plan')) $('#plan').onclick = () => workout(pl, why);
  if ($('#again')) $('#again').onclick = again;
  if ($('#re')) $('#re').onclick = () => { FULL = false; prep(); };
  if ($('#resend')) $('#resend').onclick = async () => { const p = await outbox.get().catch(() => null); if (p) sendResult(p); };
  $('#set').onclick = settings; $('#more').onclick = () => moreSheet(cur, top, !!pl.length);
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
  const goal = benefits.length ? sec('К чему стремимся', benefits.map(b => `<div class="row" style="margin-top:10px;align-items:flex-start"><span class="mark OK" style="margin-top:3px"></span><span style="font-size:15px;line-height:1.4">${b}</span></div>`).join('') + '<p class="sub" style="font-size:14px;margin-top:12px">Делай комплекс 2 недели и пройди тест снова. Сравнишь карты до и после.</p>') : '';
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Подробнее</h2>${lr}${ba}${lim}${zones}${goal}
    <div class="group" style="margin-top:var(--s3)">
      ${SHARED ? '' : `<button class="row-link" id="myrec">${ic('play', 's')}<span>Моя запись: скелет и 3D-фигура</span>${ic('chevron-right', 's chev')}</button>`}
      <button class="row-link" id="shareRes">${ic('share', 's')}<span>Поделиться: ссылка или картинка</span>${ic('chevron-right', 's chev')}</button>
      ${top.length && !SHARED ? `<button class="row-link" id="cal">${ic('volume-2', 's')}<span>Напоминать каждый день в 20:00</span>${ic('chevron-right', 's chev')}</button>` : ''}
      ${hasPlan ? `<button class="row-link" id="again">${ic('rotate-ccw', 's')}<span>${SHARED ? 'Пройти свой тест' : 'Пройти тест заново'}</span>${ic('chevron-right', 's chev')}</button>` : ''}
      <a class="row-link" href="${bot()}" target="_blank">${ic('message-square', 's')}<span>Разобрать карту с автором методики<small style="display:block;font-size:13px;color:var(--sub);font-weight:400">Рифат Аюпов, кинезиотерапевт, 12 лет практики · онлайн</small></span>${ic('chevron-right', 's chev')}</a></div>
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
export async function passportImage({ eyebrow, name, date, sp, sections = [], delta = null, footer }) {
  const W = 1080, M = 72, cv = document.createElement('canvas'); cv.width = W; cv.height = 4200; const g = cv.getContext('2d');
  await document.fonts.ready; try { await document.fonts.load('500 32px "JetBrains Mono"'); } catch (e) {}
  g.fillStyle = '#F4F3EF'; g.fillRect(0, 0, W, cv.height);
  let y = M + 32; g.fillStyle = '#5B6068'; g.font = '500 32px "JetBrains Mono", monospace'; g.fillText(eyebrow, M, y);
  y += 96; g.fillStyle = '#111418'; g.font = '700 84px Onest, sans-serif'; g.fillText(String(name).slice(0, 22), M, y);
  y += 56; g.fillStyle = '#5B6068'; g.font = '400 40px Onest, sans-serif'; g.fillText(date, M, y);
  // две карты в белых плитках
  y += 48; const tw = (W - M * 2 - 24) / 2, th = tw * 1.45;
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px'; document.body.appendChild(holder);
  for (const [i, back] of [[0, false], [1, true]]) { const x = M + i * (tw + 24); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, tw, th, 48); g.fill();
    const hc = document.createElement('canvas'); hc.style.width = '200px'; holder.appendChild(hc); drawHeat(hc, sp, back, null, [], { reveal: false });
    const ih = th - 120, iw = ih * hc.width / hc.height; g.drawImage(hc, x + (tw - iw) / 2, y + 40, iw, ih);
    g.fillStyle = '#5B6068'; g.font = '500 32px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillText(back ? 'СЗАДИ' : 'СПЕРЕДИ', x + tw / 2, y + th - 32); g.textAlign = 'left'; }
  holder.remove(); y += th + 24;
  const wrap = (t, x0, size, weight, col, lh = 1.3) => { g.font = `${weight} ${size}px Onest, sans-serif`; g.fillStyle = col; let cur = '';
    for (const w of String(t).split(' ')) { const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > W - x0 - M && cur) { y += size * lh; g.fillText(cur, x0, y); cur = w; } else cur = tt; }
    if (cur) { y += size * lh; g.fillText(cur, x0, y); } };
  for (const sec of sections) { if (!sec.rows.length) continue; y += 64; g.fillStyle = '#111418'; g.font = '700 46px Onest, sans-serif'; g.fillText(sec.h, M, y); y += 8;
    for (const r of sec.rows) { y += 16; const y0 = y; if (r.k) { wrap(r.text, M + 72, 56, r.bold ? 700 : 400, '#111418', 1.2); drawMark(g, M + 26, y0 + 36, r.k, { scale: 2.2 }); }
      else wrap(r.text, M, 40, 400, r.col || '#16181C'); } }
  if (delta) { y += 72; g.fillStyle = '#111418'; g.font = '700 46px Onest, sans-serif'; g.fillText(delta.h, M, y); y += 40;
    g.fillStyle = '#5B6068'; g.font = '400 40px Onest, sans-serif'; g.fillText(delta.name, M, y + 10); y += 150;
    g.fillStyle = '#868B93'; g.font = '400 68px Onest, sans-serif'; const was = fmt(delta.was) + delta.u; g.fillText(was, M, y); const wx = M + g.measureText(was).width + 32;
    g.font = '400 56px Onest, sans-serif'; g.fillText('→', wx, y - 6); g.fillStyle = '#111418'; g.font = '600 132px Onest, sans-serif'; g.fillText(fmt(delta.now) + delta.u, wx + 90, y + 18);
    if (delta.note) { y += 70; g.fillStyle = delta.state === 'better' ? '#1E7149' : delta.state === 'worse' ? '#B3343B' : '#5B6068'; g.font = '600 40px Onest, sans-serif'; g.fillText(delta.note, M, y); } }
  for (const extra of footer.after || []) { y += 72; g.fillStyle = '#111418'; g.font = '700 46px Onest, sans-serif'; g.fillText(extra.h, M, y); y += 8; wrap(extra.text, M, 40, 400, '#16181C'); }
  const FH = 220, H = y + M + FH, out = document.createElement('canvas'); out.width = W; out.height = H; const o = out.getContext('2d'); o.drawImage(cv, 0, 0);
  o.fillStyle = '#111418'; o.fillRect(0, H - FH, W, FH);
  o.fillStyle = '#fff'; o.font = '700 46px Onest, sans-serif'; o.fillText(String(footer.name).slice(0, 36), M, H - FH + 76);
  if (footer.contact) { o.fillStyle = '#D0D3D8'; o.font = '400 38px Onest, sans-serif'; o.fillText(String(footer.contact).slice(0, 44), M, H - FH + 128); }
  o.fillStyle = '#B9BDC4'; o.font = '400 30px Onest, sans-serif'; o.fillText('BodyPassport · методика Р. Аюпова · оценка движения', M, H - 36);
  return new Promise(r => out.toBlob(r, 'image/png'));
}
async function resultImage() {
  const { t, a } = currentAnalysis(); const all = spots(a); const top = topOf(all);
  const v = verdict(top, a.findings), pl = plan(top);
  return passportImage({ eyebrow: 'КАРТА ТЕЛА', name: 'Моя карта тела', date: new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }), sp: all,
    sections: [{ h: 'Что делаем', rows: v.map(x => ({ k: x.k, text: `${x.verb} ${x.what}` })) }, { h: 'Комплекс', rows: pl.slice(0, 4).map(id => ({ text: '• ' + ex(id).title.split(' (')[0] })) }],
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
    ${m.selfTest ? `<div class="card"><div class="eyebrow" style="color:var(--weak-t)">Проверь себя за минуту</div><p style="font-size:15px;line-height:1.45;margin-top:8px">${m.selfTest}</p></div>` : ''}
    ${m.benefit ? `<div class="card row" style="align-items:flex-start"><span class="mark OK" style="margin-top:4px"></span><div><b>Что изменится</b><p style="font-size:15px;margin-top:4px;line-height:1.4">${m.benefit}</p></div></div>` : ''}
    ${stages.map((st, i) => `<div class="row" style="margin-top:8px"><span class="step-n" style="font-size:14px">${String(i + 1).padStart(2, '0')}</span><b style="font-size:18px">${st[0]}</b></div>
      ${st[1] ? `<p class="sub" style="font-size:14px">${st[1]}</p>` : ''}
      ${st[2] ? `<div class="card"><b>Самомассаж</b>${m.tool ? ` <span class="pill" style="min-height:28px;font-size:12px">${m.tool}</span>` : ''}<p style="font-size:15px;line-height:1.45;margin-top:6px">${st[2]}</p></div>` : ''}
      ${st[3].map(id => { const e = ex(id); n++; return `<div class="list-item exr" data-id="${id}"><span class="round" style="background:var(--surface-2);flex:none">${ic('play', 's')}</span><div style="flex:1"><b style="font-size:16px">${e.title.split(' (')[0]}</b><div class="sub" style="font-size:13px">${[e.dose, e.durationSec + ' с'].filter(Boolean).join(' · ')}</div></div><span class="step-n">${n}</span></div>`; }).join('')}`).join('')}
    <a class="row-link" href="${bot()}" target="_blank" style="color:var(--focus);font-weight:600"><span>Разобрать вместе с автором методики</span>${ic('chevron-right', 's')}</a>
   </div>${all.length ? `<div class="dock"><button class="btn" id="go">${ic('play', 's')}Начать комплекс · ${totalMin(all.map(ex))} мин</button></div>` : ''}</div>`);
  const rs = Object.fromEntries(all.map(id => [id, reason]));
  $('#back').onclick = map; app.querySelectorAll('.exr').forEach(el => el.onclick = () => workout([el.dataset.id], rs)); if ($('#go')) $('#go').onclick = () => workout(all, rs);
}

// ---------- 7. тренировка ----------
export async function workout(ids, reasons = {}) {
  const list = ids.map(ex).filter(Boolean); let i = 0, closed = false; voice.unlock(); keepAwake(true);
  const run = async () => {
    if (closed) return; if (i >= list.length) return done(list);
    const e = list[i], total = Math.max(10, e.durationSec); let left = total, playing = false; const rs = reasons[e.id];
    go(`<div class="scr dark fade" style="padding:16px 20px 28px">
      <div class="row"><div class="segs" style="flex:1">${list.map((_, k) => `<div><b style="width:${k <= i ? 100 : 0}%;background:${k === i ? '#fff' : 'var(--signal)'}"></b></div>`).join('')}</div><button class="round glass" id="x" aria-label="Закончить">${ic('x')}</button></div>
      <div class="eyebrow" style="color:var(--signal);margin-top:18px">${i + 1} из ${list.length}${rs ? ' · для итога' : ''}</div>
      ${rs ? `<div class="row" style="gap:8px;margin-top:6px;font-size:14px;color:var(--cam-sub)"><span class="mark sm ${rs.k}"></span><span>${esc(rs.t)}</span></div>` : ''}
      <h1 style="color:#fff;margin-top:8px">${e.title.split(' (')[0]}</h1>
      <div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap">${[e.dose, e.feel].filter(Boolean).map(x => `<span class="pill" style="background:rgba(255,255,255,.12);color:#fff">${x}</span>`).join('')}</div>
      <div style="display:flex;justify-content:center;margin-top:24px"><div style="position:relative;width:200px;height:200px"><svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle id="arc" cx="50" cy="50" r="45" fill="none" stroke="#D4F25A" stroke-width="5" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/></svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b id="tm" class="num" style="font-size:56px;font-weight:600;letter-spacing:-.04em;opacity:.45">${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}</b><span id="tml" style="font-size:13px;color:var(--cam-sub);margin-top:4px">старт после подсказки</span></div></div></div>
      <div style="flex:1;margin-top:20px;display:flex;flex-direction:column;gap:12px">${e.steps.slice(0, 3).map((s, k) => `<div class="row st" style="opacity:.45;align-items:flex-start"><span class="step-n" style="color:var(--signal);width:22px;padding-top:2px">${String(k + 1).padStart(2, '0')}</span><span style="font-size:16px;line-height:1.35;flex:1">${s}</span></div>`).join('')}
        ${e.check ? `<div class="row" style="background:rgba(255,255,255,.08);border-radius:var(--r-md);padding:12px;align-items:flex-start;gap:10px"><span style="color:var(--signal)">${ic('info', 's')}</span><span style="font-size:14px;line-height:1.4">${e.check}</span></div>` : ''}</div>
      <div class="row" style="justify-content:center;gap:28px;margin-top:16px"><button class="round" id="pv" aria-label="Назад" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">${ic('skip-back')}</button><button class="round" id="pp" aria-label="Пауза" style="width:80px;height:80px;background:var(--signal);color:var(--cam-bg)">${ic('pause')}</button><button class="round" id="nx" aria-label="Дальше" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">${ic('skip-forward')}</button></div></div>`);
    let token = {}; const myTok = token;
    $('#x').onclick = () => { closed = true; voice.say(''); map(); };
    $('#pv').onclick = () => { token.dead = true; i = Math.max(0, i - 1); run(); };
    $('#nx').onclick = () => { token.dead = true; mark(e); i++; run(); };
    $('#pp').onclick = () => { playing = !playing; $('#pp').innerHTML = ic(playing ? 'pause' : 'play'); $('#pp').setAttribute('aria-label', playing ? 'Пауза' : 'Продолжить'); };
    const full = e.title.split(' (')[0] + '. ' + e.steps.join(' ') + (e.check ? ' ' + e.check : '');
    voice.say(full); await voice.waitDone(); if (myTok.dead || closed) return; playing = true; $('#tm').style.opacity = 1; $('#tml').textContent = 'осталось';
    while (left > 0) { await sleep(1000); if (myTok.dead || closed) return; if (!playing) continue; left--;
      $('#tm').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; $('#arc').style.strokeDashoffset = 283 * (left / total);
      const cur = Math.min(e.steps.length - 1, Math.floor((total - left) * Math.min(3, e.steps.length) / total)); app.querySelectorAll('.st').forEach((el, k) => el.style.opacity = k <= cur ? 1 : .45);
      if (left <= 3 && left > 0) voice.say(String(left)); }
    voice.say('Отлично'); mark(e); i++; await sleep(700); run();
  };
  run();
}
function mark(e) { const d = JSON.parse(localStorage.getItem(K('bp_done')) || '[]'); d.push({ id: e.id, t: Date.now() }); localStorage.setItem(K('bp_done'), JSON.stringify(d.slice(-500))); }
function streak() { const days = new Set(JSON.parse(localStorage.getItem(K('bp_done')) || '[]').map(x => new Date(x.t).toDateString())); let n = 0; const d = new Date(); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); } return n; }
function done(list) { keepAwake(false); const s = Math.max(1, streak());
  go(`<div class="scr fade"><div class="empty" style="flex:1;justify-content:center"><span style="width:88px;height:88px;border-radius:50%;background:var(--ok-s);color:var(--ok-t);display:flex;align-items:center;justify-content:center">${ic('check')}</span>
   <h1>Комплекс выполнен</h1><p class="sub">Делай так 2 недели и повтори тест. Сравним карты.</p></div>
   <div class="pad kpi"><div><b>${list.length}</b><span>упражнения</span></div><div><b>${totalMin(list)}</b><span>мин на себя</span></div><div><b>${s}</b><span>дн. подряд</span></div></div>
   <div class="dock"><button class="btn" id="back">К карте тела</button><p style="text-align:center;font-size:13px;color:var(--sub)">Повтори тест через 7 дней, чтобы увидеть изменения</p></div></div>`);
  $('#back').onclick = map; }

// ---------- настройки ----------
export function settings() {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2>Настройки</h2>
    <div class="group" style="margin-top:var(--s4)"><div class="row" style="min-height:56px"><span style="flex:1">Голосовые подсказки</span><button class="pill" id="vm">${voice.muted ? 'Выкл' : 'Вкл'}</button></div></div>
    <p class="ondevice" style="margin-top:var(--s3)">${ic('cpu', 's')}Видео не сохраняется. Результаты хранятся только в этом браузере.</p>
    <div id="acc"></div>
    <div class="group" style="margin-top:var(--s3)">
      <button class="row-link" id="fbk">${ic('message-square', 's')}<span>Отзыв или идея</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="shapp">${ic('share', 's')}<span>Поделиться приложением</span>${ic('chevron-right', 's chev')}</button>
      <button class="row-link" id="topro">${ic('user-plus', 's')}<span>Кабинет специалиста</span>${ic('chevron-right', 's chev')}</button>
      <a class="row-link" href="/privacy" target="_blank">${ic('shield-check', 's')}<span>Конфиденциальность</span>${ic('chevron-right', 's chev')}</a>
      <button class="row-link" id="wipe" style="color:var(--over-t)">${ic('x', 's')}<span>Удалить мои результаты</span></button></div>
    <div class="row" style="justify-content:center;gap:16px;margin-top:var(--s3);font-size:13px"><a href="/terms" target="_blank" style="color:var(--sub);font-weight:500">Соглашение</a><a href="/licenses" target="_blank" style="color:var(--sub);font-weight:500">Лицензии</a></div>
    <p style="margin-top:var(--s3);font-size:12px;color:var(--sub);line-height:1.45">Автор методики: Рифат Аюпов, биомеханик, кинезиотерапевт, rifataiupov.com. Распознавание позы: MediaPipe (Google, Apache 2.0). 3D-модель: Z-Anatomy на основе BodyParts3D (DBCLS), CC BY-SA.</p>
    <button class="btn" id="cl" style="margin-top:var(--s4)">Готово</button></div>`;
  document.body.appendChild(d);
  d.querySelector('#fbk').onclick = () => { d.remove(); feedbackSheet('settings'); };
  d.querySelector('#shapp').onclick = () => shareApp();
  d.querySelector('#vm').onclick = e => { voice.muted = !voice.muted; localStorage.setItem('bp_mute', voice.muted ? '1' : '0'); e.target.textContent = voice.muted ? 'Выкл' : 'Вкл'; };
  d.querySelector('#wipe').onclick = async () => { if (!confirm('Удалить все результаты?')) return;
    for (const k of ['bp_tests', 'bp_done', 'bp_profile']) localStorage.removeItem(K(k)); localStorage.removeItem('bp_sent');
    // записи движения тоже: последняя запись клиента, копия для специалиста и неотправленный результат
    await consumerPoses.clear().catch(() => {}); await outbox.clear().catch(() => {}); try { indexedDB.deleteDatabase('bodypassport-client'); } catch (e) {}
    SHARED = null; d.remove(); onboarding(); };
  d.querySelector('#topro').onclick = () => { d.remove(); openPro(); };
  d.querySelector('#cl').onclick = () => d.remove(); d.onclick = e => { if (e.target === d) d.remove(); };
  accountBlock(d.querySelector('#acc'), () => d.remove());
}
async function accountBlock(el, close) {
  const u = await getMe(true); if (!el.isConnected) return;
  if (!u) { if ((await providers()).length) { el.innerHTML = '<button class="btn line" id="login" style="margin-top:12px">Войти</button>'; el.querySelector('#login').onclick = () => { close(); const home = () => (tests().length ? map() : onboarding()); ensureLogin('client', home).then(ok => ok && home()); }; } return; }
  el.innerHTML = `<div class="group" style="margin-top:var(--s3)"><div class="row" style="min-height:64px"><span class="avatar">${esc((u.name || '?').slice(0, 1).toUpperCase())}</span><div style="flex:1;font-size:14px;line-height:1.35"><b>${esc(u.name)}</b><div style="color:var(--sub);font-size:12px">${u.provider === 'google' ? 'Google' : 'Telegram'}${u.role === 'specialist' ? ' · специалист' : ''}</div></div><button class="pill" id="lo">Выйти</button></div>
    ${u.admin ? `<button class="row-link" id="beta"><span>Участники беты</span>${ic('chevron-right', 's chev')}</button><button class="row-link" id="funnel"><span>Статистика и отзывы</span>${ic('chevron-right', 's chev')}</button>` : ''}
    <button class="row-link" id="delacc" style="color:var(--over-t)"><span>Удалить аккаунт</span></button></div>`;
  el.querySelector('#lo').onclick = async () => { await logout(); localStorage.removeItem('bp_mode'); close(); onboarding(); };
  el.querySelector('#delacc').onclick = async () => { if (!confirm('Удалить аккаунт? Результаты на этом телефоне останутся, их можно удалить отдельно.')) return; try { await deleteAccount(); localStorage.removeItem('bp_mode'); close(); onboarding(); } catch (e) { toast('Не получилось: ' + e.message); } };
  if (el.querySelector('#funnel')) el.querySelector('#funnel').onclick = () => { close(); funnelScreen(); };
  if (el.querySelector('#beta')) el.querySelector('#beta').onclick = async () => { try { const list = await betaUsers(); close();
    go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Участники беты · ${list.length}</b></div>
      <div class="pad" style="display:flex;flex-direction:column;gap:8px;padding-bottom:30px">${list.map(x => `<div class="card" style="padding:12px 14px;font-size:14px;line-height:1.4"><b>${esc(x.name)}</b> <span style="color:var(--sub)">${x.role === 'specialist' ? 'специалист' : 'клиент'} · ${x.provider === 'google' ? esc(x.email) : '@' + esc(x.username || 'telegram')}</span><div style="font-size:12px;color:var(--sub)">с ${new Date(x.created).toLocaleDateString('ru')}${x.ref ? ' · откуда: ' + esc(x.ref) : ''}${x.specialty ? ' · ' + esc(x.specialty) : ''} · тариф ${esc(x.plan)}${x.paidUntil > Date.now() ? ' до ' + new Date(x.paidUntil).toLocaleDateString('ru') : ''}</div>${x.role === 'specialist' ? `<button class="pill" data-pro="${esc(x.id)}" style="margin-top:8px;border:1.5px solid var(--line)">Про +30 дней</button>` : ''}</div>`).join('')}</div></div>`);
    $('#back').onclick = () => map();
    app.querySelectorAll('[data-pro]').forEach(btn => btn.onclick = async () => { if (!confirm('Продлить Про на 30 дней?')) return;
      const r = await fetch('/api/auth?a=setplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: btn.dataset.pro, plan: 'pro', days: 30 }) }); btn.textContent = r.ok ? 'Продлено' : 'Ошибка'; });
  } catch (e) { toast(e.message); } };
}

// ---------- воронка беты (только администратор): обезличенные шаги из js/track.js ----------
const FUNNEL = [['client', 'Клиент', [['app_open', 'Открыли приложение'], ['onb_done', 'Прошли знакомство'], ['login_ok', 'Вошли'], ['safety_ok', 'Скрининг: можно'], ['safety_stop', 'Скрининг: к врачу'],
  ['test_start', 'Начали тест'], ['test_done', 'Закончили тест'], ['test_cancel', 'Прервали тест'], ['map_view', 'Открыли карту'], ['share_result', 'Поделились'], ['inv_open', 'Открыли ссылку специалиста'], ['result_sent', 'Отправили результат'], ['result_fail', 'Не смогли отправить'], ['fb_sent', 'Оставили оценку или отзыв'], ['ref_share', 'Поделились приложением'], ['install_shown', 'Видели «Установить»'], ['install_ok', 'Установили на экран']]],
  ['pro', 'Специалист', [['pro_open', 'Открыли кабинет'], ['assess_start', 'Начали оценку'], ['assess_done', 'Закончили оценку'], ['report_sent', 'Отчет клиенту'], ['retest_set', 'Назначили ретест'], ['invite_sent', 'Ссылка клиенту'], ['join_sent', 'Общая ссылка'], ['result_pulled', 'Получили результат из дома'], ['fb_sent', 'Оценка или отзыв'], ['ref_share', 'Пригласили коллегу']]]];
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
  const kind = { result: 'оценка теста', nps: 'порекомендует', free: 'отзыв' };
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><b style="font-size:17px">Статистика · ${days} дней</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:10px;padding-bottom:30px">
     <p class="sub" style="font-size:13px">Число вкладок, где шаг был хотя бы раз, сумма по дням. Процент от первого шага.</p>
     <div class="seg">${[7, 14, 30].map(n => `<button data-d="${n}" class="${n === days ? 'on' : ''}">${n} дней</button>`).join('')}</div>
     ${FUNNEL.map(block).join('')}
     <div class="kpi"><div><b>${d.testMedianSec ? Math.round(d.testMedianSec / 60 * 10) / 10 : '—'}</b><span>мин на тест, медиана (${d.testN || 0})</span></div><div><b>${fb && fb.resultAvg != null ? fb.resultAvg : '—'}</b><span>польза теста из 5 (${fb ? fb.resultN : 0})</span></div><div><b>${fb && fb.nps != null ? fb.nps : '—'}</b><span>NPS специалистов (${fb ? fb.npsN : 0})</span></div></div>
     <div class="card" style="padding:14px 16px"><b>Откуда приходят</b>${src.length ? src.map(([k, n]) => `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1;word-break:break-all">${esc(k)}</span><b>${n}</b></div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока нет данных</div>'}<p class="sub" style="font-size:12px;margin-top:8px">Метка из ссылки ?ref= или ?utm_source=. Коды r… это приглашения пользователей.</p></div>
     <div class="card" style="padding:14px 16px"><b>Приглашения</b>${refs.length ? refs.map(u => `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${esc(u.name)}</span><span style="color:var(--sub)">${u.invited} пришли · </span><b>${u.invitedPro} спец.</b></div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока никто не пригласил</div>'}</div>
     <div class="card" style="padding:14px 16px"><b>Отзывы</b>${fb && fb.items.length ? fb.items.slice(0, 40).map(x => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2);font-size:14px;line-height:1.45"><div class="row" style="gap:8px;font-size:12px;color:var(--sub)"><span>${new Date(x.at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span><span>${x.r === 'pro' ? 'специалист' : 'клиент'}</span><span>${kind[x.k] || ''}${x.s != null ? ': <b style="color:var(--text)">' + x.s + '</b>' : ''}</span></div>${x.t ? `<div style="margin-top:4px">${esc(x.t)}</div>` : ''}${x.contact ? `<div style="margin-top:4px;font-size:13px;color:var(--weak-t)">Можно связаться: ${esc(x.contact.name)} ${esc(x.contact.handle)}</div>` : ''}</div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Отзывов пока нет</div>'}</div>
     <div class="card" style="padding:14px 16px"><b>Ошибки в браузере</b>${errs.length ? errs.map(([m, n]) => `<div style="font-size:13px;margin-top:8px;word-break:break-word"><b>${n}×</b> ${esc(m)}</div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Ошибок нет</div>'}</div>
    </div></div>`);
  $('#back').onclick = () => localStorage.getItem('bp_mode') === 'pro' ? openPro() : map();
  app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => funnelScreen(+b.dataset.d));
}

// ---------- старт ----------
(async () => {
  track('app_open', { r: REF });
  try { await loadContent(); } catch (e) { app.innerHTML = '<div class="scr pad" style="justify-content:center;gap:16px"><h1>Не удалось загрузить данные</h1><p class="sub">Проверь интернет и обнови страницу.</p><button class="btn" id="rl">Обновить</button></div>'; $('#rl').onclick = () => location.reload(); return; }
  await voice.init();
  await Promise.all([getMe(), config()]); claimLegacy();
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
  if (location.hash.startsWith('#r=')) { try { SHARED = cleanResult(await unpackResult(location.hash.slice(3))); } catch (e) { SHARED = null; } }
  if (location.hash.startsWith('#join=')) { try { const inv = { ...cleanInv(seal.unpack(location.hash.slice(6))), join: true }; localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  if (location.hash.startsWith('#inv=')) { try { const inv = cleanInv(seal.unpack(location.hash.slice(5))); localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  if (!SHARED && localStorage.getItem('bp_mode') === 'pro') return openPro();
  SHARED || tests().length ? map() : onboarding();
})();
