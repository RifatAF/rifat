// BodyPassport web: тот же поток, тексты и дизайн, что в Android-версии.
import { P, F, G, Movement, sideView, levelled, analyze, fmt, standSnapshot, sideSnapshot } from './analysis.js';
import { track } from './track.js';
import { rateCard, bindRate, installCard, bindInstall, feedbackSheet, shareApp, appLink } from './grow.js';
import { proHome, motionViewer, consumerPoses } from './pro.js';
import { seal } from './core.js';
import { ensureLogin, safetyOk, safetyScreen, getMe, meSync, tgWebLogin, logout, deleteAccount, betaUsers, providers, config } from './auth.js';
import { C, loadContent, voice, sleep, phone, startMotion, initPose, cam, startCamera, stopCamera, fullyVisible, drawSkeleton, drawHeat, RAMP_CSS, body3D, preload3D, device, keepAwake } from './core.js';

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
export const TONE = { HYPER: ['Перегрузка', 'var(--hyper)', 'var(--hyperS)', 'похоже, перегрузка', 'Гипертонус', 'var(--hyperT)'], SHORT: ['Зажата', 'var(--short)', 'var(--shortS)', 'похоже, зажата', 'Укорочение', 'var(--shortT)'],
  WEAK: ['Не включается', 'var(--weak)', 'var(--weakS)', 'похоже, не включается', 'Слабость', 'var(--weakT)'], OK: ['Норма', 'var(--ok)', 'var(--okS)', 'норма', 'Норма', 'var(--okT)'] };
// подпись состояния в числе зоны: «Глубокие мышцы шеи · не включаются», «Сгибатели бедра · зажаты»
const plural = id => { const z = (C.muscles[id] && C.muscles[id].zone) || ''; return /мышцы|^\S+(ые|ие|тели)\s/i.test(z + ' '); };
export const toneText = (s, i) => { const t = TONE[s.k][i]; return plural(s.id) ? t.replace('ата', 'аты').replace('ается', 'аются') : t; };
export const TONE_HEX = { HYPER: '#E5484D', SHORT: '#EE7B30', WEAK: '#3B7BE8', OK: '#2E9E6A' };
export const TONE_TEXT_HEX = { HYPER: '#B8323A', SHORT: '#A85010', WEAK: '#2C63C4', OK: '#1F7550' };
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
// skip: причины, которые уже показаны выше на экране (блок «Измерено»), под решениями не повторяем
export function verdictCard(top, findings, empty = 'Явных перекосов не видно', skip = []) {
  const v = verdict(top, findings);
  return `<div class="card verdict" style="padding:6px 18px">${v.length ? v.map((x, i) => `<div class="row" style="align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)">
    <span style="width:10px;height:10px;border-radius:5px;margin-top:7px;flex:none;background:${TONE_HEX[x.k]}"></span>
    <div style="flex:1;min-width:0"><div style="font-size:17px;line-height:1.3"><b>${x.verb}</b> ${esc(x.what)}</div>${x.why && !skip.includes(x.why) && !(i && v[i - 1].why === x.why) ? `<div style="font-size:13px;color:var(--muted);margin-top:3px">${esc(x.why)}</div>` : ''}</div></div>`).join('').replace(/border-bottom:1px solid var\(--line2\)">(?![\s\S]*border-bottom)/, '">') : `<p style="padding:12px 0;font-size:16px"><b>${empty}</b></p>`}</div>`;
}
export const ex = id => C.exercises[id];
const exSec = e => Math.max(10, e.durationSec) + 20;
export const minutes = e => Math.max(1, Math.ceil(exSec(e) / 60));
export const totalMin = list => Math.max(1, Math.round(list.reduce((x, e) => x + exSec(e), 0) / 60));
let view3d = null;
export function go(html) { if (view3d) { view3d.dispose(); view3d = null; } backFn = null; app.innerHTML = html; window.scrollTo(0, 0); }

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
  const slides = [['Болит шея, спина или колени?', 'Короткий тест по камере покажет, как ты двигаешься, и подскажет, какие мышцы, вероятно, перегружены, а какие недорабатывают. Это оценка движения, а не диагноз.', 'img_muscles_back'],
    ['Как проходит тест', 'Поставь телефон, отойди на 2–4 метра и сделай несколько приседаний. Камера измерит углы плеч, таза и коленей.', 'img_onb_skeleton'],
    ['Что ты получишь', 'Карту тела, вероятные причины перекосов и короткий комплекс упражнений. Методика Рифата Аюпова, биомеханика и кинезиотерапевта.', 'img_neck']];
  let i = 0;
  const draw = () => { const [t, s, img] = slides[i]; go(`<div class="scr fade">
    <div style="position:relative;flex:1;min-height:52vh;overflow:hidden"><img src="img/${img}.webp" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%">
      <div style="position:absolute;inset:0;background:linear-gradient(var(--bg) 0%,transparent 18%,transparent 70%,var(--bg) 100%)"></div>
      <div class="row pad" style="position:absolute;top:16px;left:0;right:0">${i ? '<button class="round" id="back" aria-label="Назад" style="box-shadow:var(--sh1)">‹</button>' : '<img src="icons/logo.svg" width="26">'}<div style="flex:1;line-height:1.1"><b>BodyPassport</b> <span style="background:var(--lime);border-radius:99px;padding:2px 7px;font-size:12px;font-weight:700;vertical-align:2px">БЕТА</span><div style="font-size:12px;color:var(--sub)">Рифат Аюпов · биомеханик, кинезиотерапевт</div></div><span class="pill" id="skip">Пропустить</span></div>
      <div class="row" style="position:absolute;bottom:8px;left:24px;gap:6px">${slides.map((_, k) => `<i style="height:6px;width:${k === i ? 28 : 6}px;border-radius:3px;background:${k === i ? 'var(--navy)' : 'var(--line)'};transition:.4s"></i>`).join('')}</div></div>
    <div class="pad" style="padding-bottom:24px"><h1 style="min-height:64px">${t}</h1><p class="sub" style="margin:10px 0 14px;min-height:44px">${s}</p>
      <div class="row" style="gap:8px;margin-bottom:16px;flex-wrap:wrap"><span class="pill">2–5 минут</span><span class="pill">Вход в один тап</span><span class="pill">Бесплатно</span></div>
      <button class="btn" id="next">${i < 2 ? 'Дальше' : 'Пройти тестирование'} <span class="ic">›</span></button>
      <button class="btn ghost" id="pro" style="margin-top:6px;border:0;height:44px;font-size:14px;color:var(--sub)">Я специалист: кабинет для клиентов ›</button></div></div>`);
    $('#next').onclick = () => i < 2 ? (i++, draw()) : (track('onb_done'), prep()); $('#skip').onclick = () => { track('onb_done'); prep(); }; $('#pro').onclick = () => openPro(); if ($('#back')) $('#back').onclick = () => { i--; draw(); }; };
  draw();
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
const consumerProtocol = () => sortUnits(['stand', 'ohs_front', 'sls', FULL ? 'side' : 'profile', ...(FULL ? ['back'] : []), ...(STRENGTH ? ['thold', 'bends', 'calf'] : [])]);
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
  const steps = stepsOf();
  go(`<div class="scr fade"><div class="pad" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:16px">
    <div class="seg"><button id="m0" class="${FULL ? '' : 'on'}">Быстрый · ${mins(SETUP_SEC + secs(QUICK) + (STRENGTH ? secs(STR) : 0))} мин</button><button id="m1" class="${FULL ? 'on' : ''}">Точный · ${mins(SETUP_SEC + secs(FULLS) + (STRENGTH ? secs(STR) : 0))} мин</button></div>
    <div><div class="caps" style="color:var(--coralT)">Видеотест · около ${mins(SETUP_SEC + secs(steps))} мин · ${FULL ? 'с поворотами' : 'лицом и боком'}</div><h1 style="margin-top:8px">Поставь телефон и отойди на 2–4 метра</h1><p class="sub" style="margin-top:6px">В кадре должен быть весь рост, от макушки до стоп.</p></div>
    <div><b style="font-size:15px">Камера</b><div class="seg" style="margin-top:8px"><button id="c0" class="${cam.back ? '' : 'on'}">Фронтальная</button><button id="c1" class="${cam.back ? 'on' : ''}">Основная</button></div>
      <p class="sub" style="font-size:13px;margin-top:6px">${cam.back ? 'Точнее картинка. Экран не видно, ведет голос.' : 'Видишь себя на экране во время теста.'}</p></div>
    <label class="card row" style="padding:14px 16px"><input type="checkbox" id="strc" ${STRENGTH ? 'checked' : ''} style="width:22px;height:22px;accent-color:#1E2533"><div style="flex:1"><b style="font-size:15px">Сила и симметрия</b><div class="sub" style="font-size:13px">Сравнит левую и правую сторону: плечи, бока, икры, бедра. Добавляет ${mins(secs(STR))} мин</div></div></label>
    ${stepList(consumerProtocol(), PRE)}
    ${device.inApp ? '<div class="card" style="background:var(--shortS);font-size:14px;line-height:1.4">Ты открыл ссылку внутри приложения соцсети. Камера здесь может не работать: открой через меню «⋯» → «Открыть в браузере».</div>' : ''}
    <div class="trust">🔒 Всё считается на телефоне · видео не сохраняется и не отправляется</div>
   </div><div class="pad" style="padding:14px 20px 24px"><button class="btn" id="start"><span class="ic">●</span> Начать проверку</button></div></div>`);
  $('#back').onclick = () => tests().length ? map() : onboarding(); bindStepList(PRE, prep);
  $('#strc').onchange = e => { STRENGTH = e.target.checked; localStorage.setItem('bp_str', STRENGTH ? '1' : '0'); prep(); };
  $('#m0').onclick = () => { FULL = false; prep(); }; $('#m1').onclick = () => { FULL = true; prep(); };
  $('#c0').onclick = () => { cam.back = false; localStorage.setItem('bp_back', '0'); prep(); }; $('#c1').onclick = () => { cam.back = true; localStorage.setItem('bp_back', '1'); prep(); };
  $('#start').onclick = async () => { voice.unlock(); startMotion(); $('#start').textContent = 'Загружаю модель…'; try { await initPose(); runTest(); } catch (e) { alert('Не удалось запустить камеру или модель: ' + e.message); prep(); } };
}

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
    o.innerHTML = `<div><h2 style="font-size:20px">${c.q}</h2><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${c.opts.map((t, i) => `<button class="pill" data-r="${i}" style="font-size:15px;padding:10px 14px;border:1.5px solid transparent">${t}</button>`).join('')}</div>
      ${c.side ? `<b style="display:block;margin-top:16px">Где</b><div class="seg" style="margin-top:8px"><button data-s="LEFT">Слева</button><button data-s="RIGHT">Справа</button><button data-s="BOTH" class="on">С обеих</button></div>` : ''}
      <b style="display:block;margin-top:16px">Как получается</b><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${c.lvl.map((t, i) => `<button class="btn ghost" data-l="${i}" style="height:48px;background:#fff">${t}</button>`).join('')}</div></div>`;
    document.body.appendChild(o); pick.side = c.side ? 'BOTH' : null;
    o.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const t = c.opts[+b.dataset.r]; const on = !pick.reasons.includes(t); pick.reasons = on ? [...pick.reasons, t] : pick.reasons.filter(x => x !== t); b.style.borderColor = on ? 'var(--navy)' : 'transparent'; });
    o.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { pick.side = b.dataset.s; o.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
    o.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { pick.level = c.lvl[+b.dataset.l]; o.remove(); res(pick); }); });
}

/** Список шагов с кнопкой «Не могу» у каждого теста: человек может отказаться от теста заранее. */
export function stepList(units, pre) {
  const us = sortUnits(units); let n = 0;
  return `<div class="card" style="padding:6px 16px" id="steplist">${us.map((u, ui) => { const l = pre[u]; const rows = UNITS[u];
    return `<div style="padding:10px 0;${ui < us.length - 1 ? 'border-bottom:1px solid var(--line2)' : ''}">${rows.map((r, ri) => { n++; return `<div class="row" style="${ri ? 'margin-top:8px' : ''};opacity:${l && !l.alt ? .45 : 1}"><b style="width:28px;height:28px;border-radius:9px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:13px;flex:none">${n}</b><div style="flex:1"><b style="font-size:15px">${r[0]}</b><div class="sub" style="font-size:13px">${r[1]}</div></div><span style="font-size:12px;color:var(--muted)">${r[2]} с</span></div>`; }).join('')}
      ${u === 'stand' ? '' : l ? `<div class="row" style="margin-top:8px;font-size:13px;color:var(--coralT)"><span style="flex:1">${l.alt ? 'Сделаю с опорой' : 'Пропущу'}: ${[...(l.reasons || []), l.level].filter(Boolean).join(', ').toLowerCase()}</span><button class="pill" data-undo="${u}" style="font-size:12px">Отменить</button></div>`
        : `<button data-cant="${u}" style="margin-top:2px;min-height:32px;background:none;border:0;padding:6px 0;font:500 13px Onest;color:var(--sub);text-decoration:underline;text-underline-offset:3px;cursor:pointer">Не могу это сделать</button>`}</div>`; }).join('')}</div>`;
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

export async function runProtocol(protocol, opts = {}) {
  await voice.ensure(Object.values(SAY));
  const pre = opts.pre || {}; const units = sortUnits(protocol); const steps = rowsOf(units.filter(u => !pre[u] || pre[u].alt));
  go(`<div class="cam"><video playsinline muted></video><canvas id="sk"></canvas><div class="frame" id="fr"></div><div class="count" id="cnt"></div>
   <div class="top"><div class="segs">${steps.map(() => '<div><b></b></div>').join('')}</div>
    <div class="row" style="margin-top:14px"><span class="pill" style="background:rgba(0,0,0,.45);color:#fff" id="stepl">Подготовка</span><span style="flex:1"></span><button class="round" id="x" style="background:rgba(0,0,0,.45);color:#fff;width:40px;height:40px">✕</button></div>
    <div id="chips"></div></div>
   <div class="metric" id="met">Ищу тебя в кадре</div>
   <div class="glass" style="flex-direction:column;align-items:stretch;gap:0">
    <div class="row" style="gap:12px"><div style="flex:1"><div id="tt" style="font-size:26px;font-weight:700;line-height:1.08;letter-spacing:-.03em"></div><div id="cue" style="font-size:15px;opacity:.8;margin-top:6px;line-height:1.35"></div></div>
     <div style="width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--lime);border:5px solid rgba(255,255,255,.15);flex:none" id="ring">◎</div></div>
    <div style="height:10px;border-radius:5px;background:rgba(255,255,255,.15);margin-top:14px;overflow:hidden"><b id="pbf" style="display:block;height:100%;width:0;background:var(--lime);transition:width .15s linear"></b></div>
    <div class="row" style="margin-top:8px"><span id="pbt" style="flex:1;font-size:13px;opacity:.75"></span>
     <button type="button" class="pill" id="skipb" style="background:rgba(255,255,255,.18);color:#fff;white-space:nowrap;border:1.5px solid rgba(255,255,255,.35);padding:10px 14px;font-size:14px;cursor:pointer">Не могу</button></div></div></div>`);
  let stop = false, skip = false; const cancel = () => { track('test_cancel'); (opts.onCancel || prep)(); }; const limits = {};
  track('test_start', { n: units.length }, false); const tStart = Date.now();
  $('#x').onclick = () => { stop = true; stopCamera(); cancel(); }; $('#skipb').onclick = () => { skip = true; };
  const video = app.querySelector('video'); const sk = $('#sk');
  try { if (!device.camera) throw new Error('no camera api'); await startCamera(video); } catch (e) { stop = true; return cameraHelp(); }
  const corr = () => (cam.back ? -1 : 1) * phone.roll;
  const lc = document.createElement('canvas'); lc.width = 32; lc.height = 32; const lx = lc.getContext('2d', { willReadFrequently: true }); let light = 128, lastL = 0;
  const bodyFrac = p => (Math.max(p[P.L_ANKLE].y, p[P.R_ANKLE].y) - p[P.NOSE].y);
  let level = true;
  cam.onFrame = f => { drawSkeleton(sk, f); const ok = fullyVisible(f.pose);
    if (performance.now() - lastL > 1000) { lastL = performance.now(); try { lx.drawImage(video, 0, 0, 32, 32); const d = lx.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3; light = s / 1024; } catch (e) {} }
    level = !phone.ok || Math.abs(phone.roll) <= 5;
    $('#fr').style.borderColor = ok && level ? 'var(--green)' : '#EE9B30';
    const chips = [ok ? '✓ Всё тело в кадре' : '! Не видно всё тело', level ? '' : `! Наклон телефона ${fmt(phone.roll)}°`, light < 45 ? '! Мало света' : ''];
    if (opts.target && opts.target.bodyFrac > 0 && f.pose && ok) { const cur = bodyFrac(f.pose) / f.h, dv = (cur - opts.target.bodyFrac) / opts.target.bodyFrac; chips.push(Math.abs(dv) <= .1 ? '✓ Как в прошлый раз' : dv > 0 ? '↔ Отойди чуть дальше' : '↔ Подойди чуть ближе'); }
    $('#chips').innerHTML = chips.filter(Boolean).map(c => `<div class="chip" style="background:${c[0] === '✓' ? 'rgba(46,158,106,.85)' : 'rgba(238,155,48,.85)'}">${c}</div>`).join('');
    if (f.pose) { const lv = levelled(f.pose, f.w, f.h, corr()); $('#met').textContent = `Плечи ${fmt(F.shoulderTilt(lv))}° · Таз ${fmt(F.pelvicTilt(lv))}°`; } };
  // ---- экран и голос ----
  const segs = [...app.querySelectorAll('.segs b')]; let si = -1;
  const step = (i, title, sub) => { if (i !== null) { si = i; segs.forEach((b, k) => b.style.width = k < i ? '100%' : k === i ? '8%' : '0'); $('#stepl').textContent = `Шаг ${i + 1} из ${steps.length}`; } $('#tt').textContent = title; $('#cue').textContent = sub || ''; bar(0, ''); $('#ring').textContent = '◎'; };
  const bar = (frac, label) => { $('#pbf').style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; if (label !== undefined) $('#pbt').textContent = label; if (segs[si]) segs[si].style.width = Math.max(8, frac * 100) + '%'; };
  const say = async text => { if (stop) return; $('#cue').textContent = text; await voice.speak(text); };
  let lastHint = '', lastHintAt = 0;
  const hint = (text, gap = 4000) => { const now = Date.now(); if (now - lastHintAt < gap || (text === lastHint && now - lastHintAt < 7000)) return; lastHint = text; lastHintAt = now; $('#cue').textContent = text; voice.say(text); };
  // ---- запись ----
  const grab = (fr, rolls) => { const f = cam.frame; if (f && f.pose && (!fr.length || fr.at(-1).t !== f.t)) { fr.push({ t: f.t, p: levelled(f.pose, f.w, f.h, corr()), w: f.world }); rolls.push(phone.roll); } };
  const poses = {}, quality = {}; let W = 1, H = 1;
  const keep = (key, fr, rolls, vis) => { const f = cam.frame; if (f) { W = f.w; H = f.h; } if (!fr.length) return; poses[key] = packPoses(fr, W, H);
    const m = rolls.reduce((a, b) => a + b, 0) / rolls.length, sd = Math.sqrt(rolls.reduce((a, b) => a + (b - m) ** 2, 0) / rolls.length) || 0;
    quality[key] = Math.round(100 * Math.min(1, (vis ?? .9) / .9) * Math.min(1, (cam.fps || 20) / 20) * (light < 45 ? .7 : 1) * (sd > 2 ? .8 : 1)); };
  // удержание позы заданное время: полоса показывает, сколько осталось; extra(p, left) — подсказки по ходу
  const hold = async (key, sec, label, extra) => { voice.beep('start'); const fr = [], rolls = []; const t0 = Date.now(); const said = {};
    while (!stop && !skip) { const el = (Date.now() - t0) / 1000, left = Math.ceil(sec - el); if (el >= sec) break; grab(fr, rolls); bar(el / sec, `${label}: ${left} с`); $('#ring').textContent = left;
      if (sec >= 12 && left === 10 && !said[10]) { said[10] = 1; hint(SAY.hold10, 0); } if (sec >= 9 && left === 5 && !said[5]) { said[5] = 1; hint(SAY.hold5, 0); }
      if (left <= 3 && !said['c' + left]) { said['c' + left] = 1; voice.say(String(left)); }
      if (extra && fr.length) extra(fr, left); await sleep(30); }
    bar(1, ''); voice.beep('stop'); if (key) keep(key, fr, rolls); return fr; };
  // повторы: считаем по движению таза; полоса = сделанные повторы из трех
  const reps = async (key, an, deep = .12, N = 3) => { voice.beep('start'); const fr = [], rolls = []; if (skip) return { f: {}, reps: 0, quality: 'RETAKE' };
    let n = 0, down = false, base = null, leg = null, maxFlex = 0; const t0 = Date.now(); let lastMove = Date.now(); bar(0, `Повторы: 0 из ${N}`);
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
    if (stop) return; await say(SAY.seen); }
  // ---- тесты ----
  const med = a => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v[v.length >> 1] ?? 0; };
  let snapshot = null, side = null, setup = null; const moves = {}; let k = 0;
  const skipped = () => skip && !stop;
  const runUnit = async u => {
    if (u === 'stand') { await face('front'); step(k, 'Стой ровно', 'Руки вдоль тела, смотри прямо'); await say(SAY.standIntro); await say(SAY.freeze);
      const st = await hold('stand', 5, 'Замри'); if (stop || skipped()) return;
      snapshot = standSnapshot(st);
      const f = cam.frame; setup = { bodyFrac: med(st.map(x => bodyFrac(x.p))) / (f ? f.h : 1), roll: phone.roll, pitch: phone.pitch ?? null, back: cam.back, w: f && f.w, h: f && f.h }; await say(SAY.good); k++; }
    if (u === 'ohs_front') { await face('front'); step(k, 'Присед с руками вверх', 'Руки вверх, пятки на полу, 5 раз'); await say(SAY.ohsIntro); if (skipped()) return; await say(SAY.ohsGo);
      moves.ohs_front = await reps('ohs_front', fr => Movement.front(fr), .12, 5); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'sls') { await face('front');
      step(k, 'Стоя на правой ноге', 'Левую ногу подними, 3 неглубоких приседа'); await say(SAY.slsRIntro); if (skipped()) return; await say(SAY.slsRGo);
      moves.sls_r = await reps('sls_r', fr => Movement.singleLeg(fr, true), .06); if (skipped()) return; await say(SAY.footDown); k++;
      step(k, 'Стоя на левой ноге', 'Правую ногу подними, 3 неглубоких приседа'); await say(SAY.slsLIntro); if (skipped()) return; await say(SAY.slsLGo);
      moves.sls_l = await reps('sls_l', fr => Movement.singleLeg(fr, false), .06); if (skipped()) return; await say(SAY.footDown); k++; }
    if (u === 'thold') { await face('front'); step(k, 'Руки в стороны', 'На уровне плеч, держи 20 секунд'); await say(SAY.tholdIntro); if (skipped()) return; await say(SAY.tholdGo);
      const fr = await hold('t_hold', 20, 'Держи', (fr, left) => { const p = fr.at(-1).p; if (left === 15) hint(SAY.keep, 0);
        if (left < 18 && left > 6) { const ab = Math.min(G.angleAt(p[P.R_HIP], p[P.R_SHOULDER], p[P.R_ELBOW]), G.angleAt(p[P.L_HIP], p[P.L_SHOULDER], p[P.L_ELBOW])); if (ab < 70) hint(SAY.armsUp, 5000); } });
      if (skipped()) return; moves.t_hold = fr.length > 20 ? Movement.tHold(fr) : { f: {}, reps: 0, quality: 'RETAKE' }; await say(SAY.armsDown); k++; }
    if (u === 'bends') { await face('front'); step(k, 'Наклоны в стороны', 'Медленно вправо, потом влево'); await say(SAY.bendIntro); if (skipped()) return;
      const bend = async (cmd, sign) => { await say(cmd); voice.beep('start'); const fr = [], rolls = []; const t0 = Date.now(); let max = 0, low = false;
        while (!stop && !skip && Date.now() - t0 < 6000) { grab(fr, rolls); bar((Date.now() - t0) / 6000, 'Наклон'); const p = fr.length && fr.at(-1).p;
          if (p) { const tl = F.trunkLateral(p) * sign; if (tl > max) max = tl; if (!low && Date.now() - t0 > 2500 && max < 12) { low = true; hint(SAY.lower, 0); } } await sleep(30); }
        voice.beep('stop'); await say(SAY.ret); await sleep(800); return fr; };
      const b1 = await bend(SAY.bendR, 1); if (skipped()) return; const b2 = await bend(SAY.bendL, -1); if (skipped()) return;
      moves.side_bend = Movement.sideBend([...b1, ...b2]); keep('bends', [...b1, ...b2], b1.map(() => phone.roll)); await say(SAY.good); k++; }
    if (u === 'calf') { await face('front');
      for (const [right, intro, key] of [[true, SAY.calfRIntro, 'calf_r'], [false, SAY.calfLIntro, 'calf_l']]) {
        step(k, right ? 'На носок правой ноги' : 'На носок левой ноги', 'Держись за стену, вверх и вниз 15 секунд'); await say(intro); if (skipped()) return; await say(SAY.calfGo);
        const fr = await hold(key, 15, 'Вверх-вниз', (fr, left) => { if (left < 11 && left > 5 && fr.length > 60) { const hy = x => (x.p[P.L_HEEL].y + x.p[P.R_HEEL].y) / 2, rec = fr.slice(-90).map(hy); if (Math.max(...rec) - Math.min(...rec) < 8) hint(SAY.calfHigher, 6000); } });
        if (skipped()) return; moves[key] = fr.length > 20 ? Movement.calfRaise(fr, right) : { f: {}, reps: 0, quality: 'RETAKE' }; await say(SAY.footDown); k++; } }
    if (u === 'side') { await face('side'); step(k, 'Боком: стой ровно', 'Правое плечо к телефону'); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (skipped()) return; side = sideSnapshot(sf);
      step(k, 'Боком: присед', 'Руки вверх, 3 раза'); await say(SAY.armsOverhead); await say(SAY.squatGo);
      moves.ohs_side = await reps('ohs_side', fr => Movement.side(fr)); if (skipped()) return; await say(SAY.stop); k++; }
    if (u === 'profile') { await face('side'); step(k, 'Боком: стой ровно', 'Руки вдоль тела, смотри прямо'); await say(SAY.freeze);
      const sf = await hold('side_stand', 5, 'Замри'); if (stop || skipped()) return; side = sideSnapshot(sf);
      await say(SAY.good); k++; }
    if (u === 'back') { await face('back'); step(k, 'Спиной: присед', 'Руки вверх, 3 раза'); await say(SAY.armsOverhead); if (skipped()) return; await say(SAY.squatGo);
      moves.ohs_back = await reps('ohs_back', fr => Movement.back(fr)); if (skipped()) return; await say(SAY.stop); k++; }
  };
  // облегченный вариант после «Не могу»
  const runAlt = async u => { if (u === 'ohs_front') { step(k, 'Присед с опорой', 'Держись за стул или стену'); await say(SAY.ohsAltIntro); await say(SAY.ohsAltGo);
      const r = await reps('ohs_front', fr => Movement.front(fr), .05); r.alt = 'support'; moves.ohs_front = r; await say(SAY.stop); k++; }
    if (u === 'sls') { step(k, 'Правая нога с опорой', 'Держись за стену'); await say(SAY.slsRIntro); await say(SAY.slsRGo); const r = await reps('sls_r', fr => Movement.singleLeg(fr, true), .03); r.alt = 'support'; moves.sls_r = r; await say(SAY.footDown); k++;
      step(k, 'Левая нога с опорой', 'Держись за стену'); await say(SAY.slsLIntro); await say(SAY.slsLGo); const r2 = await reps('sls_l', fr => Movement.singleLeg(fr, false), .03); r2.alt = 'support'; moves.sls_l = r2; await say(SAY.footDown); k++; } };
  for (const u of units) {
    if (stop) return; skip = false; const k0 = k;
    if (pre[u]) { limits[u] = pre[u]; if (pre[u].alt) await runAlt(u); continue; }
    await runUnit(u);
    if (skip && !stop) { voice.beep('stop'); step(null, 'Не можешь — ничего страшного', 'Ответь на пару вопросов'); limits[u] = await cantSheet(u); skip = false;
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
  go(`<div class="scr pad fade" style="justify-content:center;gap:16px"><div style="position:absolute;top:12px;left:20px"><button class="round" id="back" aria-label="Назад" style="box-shadow:var(--sh1)">‹</button></div><h1>Камера не запустилась</h1>
    <p class="sub">${device.inApp || device.tg ? 'Встроенный браузер этого приложения не дает доступ к камере. Открой тест в Chrome или Safari.' : 'Разреши доступ к камере: значок замка или «Аа» в адресной строке → Камера → Разрешить. Потом нажми «Попробовать снова».'}</p>
    ${device.tg ? '<button class="btn" id="ob">Открыть в браузере</button>' : `<button class="btn" id="cp">Скопировать ссылку</button>`}
    <button class="btn ghost" id="rt">Попробовать снова</button></div>`);
  if ($('#ob')) $('#ob').onclick = () => window.Telegram.WebApp.openLink(url, { try_instant_view: false });
  if ($('#cp')) $('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(url); $('#cp').textContent = 'Ссылка скопирована, вставь в Chrome или Safari'; };
  $('#rt').onclick = prep; $('#back').onclick = prep;
}

// ---------- приглашение от специалиста: тест дома, результат уходит ему зашифрованным ----------
const INV = () => { try { const o = JSON.parse(localStorage.getItem('bp_inv') || 'null'); return o ? { ...cleanInv(o), join: !!o.join } : null; } catch (e) { return null; } };
const PAINZ = [['neck', 'Шея'], ['shoulder', 'Плечо'], ['upper_back', 'Грудной отдел'], ['low_back', 'Поясница'], ['hip', 'Таз, бедро'], ['knee', 'Колено'], ['foot', 'Стопа']];
const PROFILE = () => { try { return JSON.parse(localStorage.getItem(K('bp_profile')) || 'null'); } catch (e) { return null; } };
function joinForm() {
  const inv = INV(), acc = meSync(), pr = PROFILE() || (acc ? { name: (acc.name || '').split(' ')[0], surname: (acc.name || '').split(' ').slice(1).join(' ') } : {});
  const inp = (n, ph, v, type = 'text') => `<input id="${n}" type="${type}" value="${esc(v)}" placeholder="${ph}" style="width:100%;height:48px;border-radius:14px;border:1.5px solid var(--line);padding:0 14px;font:16px Onest;background:#fff">`;
  const sel = (n, opts, v) => `<select id="${n}" style="width:100%;height:48px;border-radius:14px;border:1.5px solid var(--line);padding:0 10px;font:16px Onest;background:#fff">${opts.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  go(`<div class="scr fade"><div class="pad" style="padding-top:20px"><div class="caps" style="color:var(--coralT)">Тест от специалиста</div><h1 style="margin-top:8px">Расскажите о себе</h1>
     <p class="sub" style="margin-top:8px">${esc(inv.s)} получит анкету вместе с результатом теста. Это займет минуту.</p></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:12px;margin-top:16px;padding-bottom:12px">
    ${inp('fn', 'Имя *', pr.name)}${inp('ln', 'Фамилия (по желанию)', pr.surname)}
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Дата рождения</div>${inp('dob', '', pr.dob, 'date')}</div><div style="width:120px"><div class="sub" style="font-size:12px;margin-bottom:4px">Пол</div>${sel('sex', [['', '—'], ['M', 'Муж'], ['F', 'Жен']], pr.sex)}</div></div>
    <div class="row" style="gap:10px"><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Рост, см</div>${inp('ht', '', pr.height, 'number')}</div><div style="flex:1"><div class="sub" style="font-size:12px;margin-bottom:4px">Ведущая сторона</div>${sel('hand', [['R', 'Правша'], ['L', 'Левша']], pr.hand || 'R')}</div></div>
    ${inp('act', 'Спорт или работа', pr.activity)}
    <textarea id="cmp" rows="3" placeholder="Что беспокоит" style="border-radius:14px;border:1.5px solid var(--line);padding:12px 14px;font:16px Onest;background:#fff">${esc(pr.complaints)}</textarea>
   </div><div class="pad" style="padding:8px 20px 24px"><button class="btn" id="nx">Дальше ›</button></div></div>`);
  $('#nx').onclick = () => { const v = n => $('#' + n).value.trim(); if (!v('fn')) { $('#fn').style.borderColor = '#E5484D'; $('#fn').focus(); return; }
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
  go(`<div class="scr fade"><div class="pad" style="padding-top:20px"><div class="caps" style="color:var(--coralT)">Тест от специалиста</div>
     <h1 style="margin-top:8px">${(inv.n || (PROFILE() || {}).name) ? esc(inv.n || PROFILE().name) + ', ' : ''}здравствуйте!</h1>${inv.join ? '<button class="pill" id="editpf" style="margin-top:8px">Изменить анкету</button>' : ''}<p class="sub" style="margin-top:8px">${esc(inv.s)} подготовил для вас тест движения. Результат сразу придет специалисту, а вы увидите свою карту тела.</p></div>
   <div class="pad" style="flex:1;display:flex;flex-direction:column;gap:14px;margin-top:16px">
    ${stepList(inv.p, PREI)}
    <div><b>Где болит сейчас, 0–10</b>${PAINZ.map(([k, n]) => `<div class="row" style="background:#fff;border-radius:14px;padding:6px 14px;margin-top:6px"><span style="width:110px;font-size:14px">${n}</span><input type="range" min="0" max="10" value="${pain[k] || 0}" data-p="${k}" style="flex:1;accent-color:#1E2533"><b style="width:22px;text-align:right" id="pv_${k}">${pain[k] || 0}</b></div>`).join('')}</div>
    <p class="sub" style="font-size:13px">Поставьте телефон, отойдите на 2–4 метра, в кадре весь рост. Около ${mins(SETUP_SEC + secs(rows))} мин.</p>
    <label class="card row" style="padding:12px 14px;align-items:flex-start"><input type="checkbox" id="share_ok" ${localStorage.getItem('bp_share_' + inv.i) ? 'checked' : ''} style="width:22px;height:22px;flex:none;margin-top:2px;accent-color:#1E2533">
     <span style="font-size:14px;line-height:1.45">Согласен передать ${inv.join ? 'анкету, ' : ''}оценку боли и результат теста специалисту: ${esc(inv.s)}. Данные шифруются на телефоне, сервер их не читает.</span></label>
   </div><div class="pad" style="padding:14px 20px 24px"><button class="btn" id="go"><span class="ic">●</span> Начать тест</button></div></div>`);
  bindStepList(PREI, inviteWelcome);
  app.querySelectorAll('[data-p]').forEach(r => r.oninput = () => { pain[r.dataset.p] = +r.value; $('#pv_' + r.dataset.p).textContent = r.value; });
  if ($('#editpf')) $('#editpf').onclick = joinForm;
  $('#go').onclick = async () => { if (!$('#share_ok').checked) { $('#share_ok').parentElement.style.outline = '2px solid #E5484D'; return; } localStorage.setItem('bp_share_' + inv.i, String(Date.now())); voice.unlock(); startMotion(); $('#go').textContent = 'Загружаю модель…'; try { await initPose(); } catch (e) { alert('Не удалось запустить камеру или модель'); return inviteWelcome(); }
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
  return `<div class="pad" id="sentbox" style="padding-top:12px"><div class="card" style="background:${st === 'ok' ? 'var(--okS)' : st === 'fail' ? 'var(--shortS)' : '#fff'};padding:12px 16px;font-size:14px">${st === 'ok' ? `✓ Результат отправлен: ${esc(inv.s)}` : st === 'fail' ? `Не удалось отправить результат. <button class="pill" id="resend">Отправить снова</button>` : 'Отправляю результат специалисту…'}</div></div>`; }

// ---------- 4. анализ ----------
async function analysisScreen() {
  SEL = null; MODE3D = false;
  const items = ['Углы плеч и таза', 'Колени в приседе', 'Таз на одной ноге', 'Цепи компенсации', 'Карта тонуса мышц'];
  go(`<div class="scr pad fade" style="align-items:center;padding-top:80px"><div style="width:220px;height:220px;border-radius:50%;overflow:hidden;border:6px solid var(--line)"><img src="img/img_onb_muscles.webp" style="width:100%;height:100%;object-fit:cover"></div>
   <h1 style="margin-top:40px">Собираем карту тела</h1><p class="sub" style="margin-top:8px">Считаем прямо на телефоне</p><div id="ck" style="width:100%;margin-top:30px;display:flex;flex-direction:column;gap:14px"></div></div>`);
  for (let i = 0; i <= items.length; i++) { $('#ck').innerHTML = items.map((t, k) => `<div class="row" style="opacity:${k <= i ? 1 : .35}"><b style="width:24px;height:24px;border-radius:50%;background:${k < i ? 'var(--navy)' : 'transparent'};border:2px solid ${k < i ? 'var(--navy)' : k === i ? 'var(--coral)' : '#CFC6B6'};color:var(--lime);font-size:12px;display:flex;align-items:center;justify-content:center">${k < i ? '✓' : ''}</b><span style="font-size:16px;font-weight:500">${t}</span></div>`).join(''); await sleep(600); }
  map();
}

// ---------- 5. карта тела ----------
let BACK = true, SEL = null, MODE3D = false;
export function map() {
  const cur = currentAnalysis(); if (!cur) return onboarding(); track('map_view');
  const { t, a } = cur; const all = spots(a); const top = topOf(all);
  if (SEL == null && top[0]) { SEL = top[0].key; BACK = top[0].back; }
  const sel = all.find(s => s.key === SEL);
  // считаем зоны, а не отдельные мышцы: одна зона на сторону, только по замеру
  const zoneSet = k => new Set(top.filter(s => Math.abs(s.tone) > .4 && (k === 'over' ? s.tone > 0 : s.tone < 0)).map(s => (C.muscles[s.id].zone || s.id) + s.side));
  const over = zoneSet('over').size, weak = zoneSet('weak').size;
  const pl = plan(top), benefits = [...new Set(top.map(s => C.muscles[s.id].benefit).filter(Boolean))].slice(0, 3);
  const all_t = SHARED ? [] : tests().filter(x => x.snapshot), first = all_t[0], days = Math.floor((Date.now() - t.date) / 864e5);
  go(`<div class="fade" style="padding-bottom:40px">
   ${!SHARED && INV() ? sentBanner() : ''}
   ${SHARED ? '<div class="pad" style="padding-top:12px"><div class="card" style="background:var(--lime);padding:12px 16px;font-size:14px"><b>Это результат по ссылке.</b> Твои данные не меняются. Внизу можно пройти свой тест.</div></div>' : ''}
   <div class="pad row" style="padding-top:16px;align-items:flex-start"><div style="flex:1"><div class="sub" style="font-size:13px">Тест от ${new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}</div><h1>${SHARED ? 'Карта тела' : 'Твоя карта тела'}</h1><div class="trust" style="margin-top:10px">🔒 Посчитано на телефоне · видео не сохранялось</div></div><button class="round" id="set" aria-label="Настройки" style="box-shadow:var(--sh1)">⚙︎</button></div>
   ${days >= 7 && !SHARED ? `<div class="pad" style="margin-top:12px"><div class="card row" id="re" style="background:var(--lime)"><div style="flex:1"><b>Прошла неделя</b><div style="font-size:14px">Пройди быстрый тест и сравни карту</div></div>›</div></div>` : ''}
   <div class="pad" style="margin-top:14px"><div style="border-radius:32px;background:radial-gradient(circle at 50% 38%,#FFFFFF,#ECEBE6 78%);padding:14px 0 16px;position:relative">
     <div class="row" style="justify-content:center;gap:8px"><div class="seg" style="width:auto"><button id="vf" class="${!BACK ? 'on' : ''}">Спереди</button><button id="vb" class="${BACK ? 'on' : ''}">Сзади</button></div>${device.webgl2 ? `<span class="pill" id="v3">${MODE3D ? 'Схема' : '3D'}</span>` : ''}</div>
     <div id="vis" style="position:relative;margin:10px auto 0;width:min(100%,360px);${MODE3D ? 'height:400px' : ''}">${MODE3D ? '' : '<canvas id="heat" style="width:100%;display:block"></canvas>'}</div>
     ${MODE3D ? `<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;margin:10px 8px 0">${[['all', 'Всё тело'], ['head', 'Шея'], ['shoulders', 'Плечи'], ['back', 'Спина'], ['pelvis', 'Таз'], ['knees', 'Колени'], ['feet', 'Стопы']].map(([z, n]) => `<button class="pill" data-z="${z}" style="font-size:12px;padding:6px 10px">${n}</button>`).join('')}</div>
       <p style="text-align:center;font-size:12px;color:var(--muted);margin-top:6px">Двумя пальцами: приблизить и сдвинуть · двойное касание: приблизить точку</p>` : ''}
     <div id="selbox" style="margin:10px 12px 0"></div>
     <div style="padding:10px 16px 0"><div style="height:8px;border-radius:4px;background:${RAMP_CSS}"></div><div class="row" style="justify-content:space-between;font-size:11px;font-weight:600;margin-top:5px"><span style="color:#3B7BE8">Слабость</span><span style="color:var(--okT)">Норма</span><span style="color:#E5484D">Перегрузка</span></div></div>
   </div><p style="font-size:12px;color:var(--muted);margin:6px 4px 0">Оценка по позе и движению. Это не диагноз.${MODE3D ? ' 3D: Z-Anatomy, BodyParts3D (CC BY-SA).' : ''}</p></div>

   <div class="pad" style="margin-top:16px">${verdictCard(top, a.findings, 'Сильных перекосов не видно')}</div>
   ${SHARED ? '' : `<div class="pad" style="margin-top:12px">${rateCard(String(t.date))}</div>`}
   ${top.length ? `<details class="pad" style="margin-top:16px"><summary class="row" style="font-size:15px;font-weight:600;color:var(--sub);padding:8px 0">Все зоны · ${Math.min(5, top.length)}<span style="flex:1"></span><span class="chev" style="font-size:16px">⌄</span></summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${top.slice(0, 5).map(s => `<div class="list-item ${s.key === SEL ? 'on' : ''}" data-k="${s.key}"><i class="bar" style="background:${TONE_HEX[s.k]}"></i><div style="flex:1"><b style="font-size:15px">${title(s)}</b><div style="font-size:12px;color:var(--muted)">${tech(s)}</div></div><span class="chev">›</span></div>`).join('')}</div></details>` : ''}
   ${top.length ? `<div class="pad" style="margin-top:16px"><div class="card"><div class="caps" style="color:var(--coralT)">К чему стремимся</div>${benefits.map(b => `<div class="row" style="margin-top:10px;align-items:flex-start"><b style="width:18px;height:18px;border-radius:50%;background:var(--lime);font-size:11px;display:flex;align-items:center;justify-content:center;flex:none;margin-top:2px">✓</b><span style="font-size:15px;line-height:1.4">${b}</span></div>`).join('')}
     <p class="sub" style="font-size:14px;margin-top:14px">Делай комплекс 2 недели и пройди тест снова. Сравнишь карты до и после.</p>
     ${pl.length ? `<button class="btn" id="plan" style="margin-top:14px"><span class="ic">▶</span> Комплекс на сегодня · ${totalMin(pl.map(ex))} мин</button>` : ''}
     <button class="btn ghost" id="cal" style="margin-top:10px">Напоминать каждый день в 20:00</button></div></div>` : ''}
   ${t.limits && Object.keys(t.limits).length ? `<div class="pad" style="margin-top:14px"><div class="card"><div class="caps" style="color:var(--coralT)">Не получилось выполнить</div>${Object.entries(t.limits).map(([u, l]) => `<div style="margin-top:8px;font-size:14px"><b>${esc(LIMIT_NAMES[u] || u)}</b>: ${esc([l.level, ...(l.reasons || [])].filter(Boolean).join(', '))}${l.alt ? ' · сделан облегченный вариант' : ''}${l.side && l.side !== 'BOTH' ? (l.side === 'LEFT' ? ', слева' : ', справа') : ''}</div>`).join('')}<p style="font-size:12px;color:var(--muted);margin-top:8px">Это важно для специалиста: такие ограничения разбираются на консультации.</p></div></div>` : ''}
   ${(() => { const f = a.f, rows = [['Руки в стороны, угол в конце', f.sym_delt, '°', true], ['Наклон в сторону', f.sym_bend, '°', true], ['Подъемы на носок', f.sym_calf, '', true], ['Глубина приседа на одной ноге', f.sym_quad, '°', true]].filter(r => r[1]);
      if (!rows.length) return ''; return `<div class="pad" style="margin-top:14px"><div class="card"><div class="caps" style="color:var(--coralT)">Левая и правая сторона</div>
      <div class="row" style="margin-top:10px;font-size:12px;color:var(--muted)"><span style="flex:1"></span><b style="width:64px;text-align:center">Левая</b><b style="width:64px;text-align:center">Правая</b></div>
      ${rows.map(([n, v, u]) => { const [l, r] = v, d = Math.abs(l - r) / Math.max(1e-6, Math.max(Math.abs(l), Math.abs(r))); const weak = d > .12 ? (l < r ? 0 : 1) : -1;
        const cell = (x, i) => `<b style="width:64px;text-align:center;font-variant-numeric:tabular-nums;color:${weak === i ? '#E5484D' : 'var(--text)'}">${fmt(x)}${u}</b>`;
        return `<div class="row" style="margin-top:8px"><span style="flex:1;font-size:14px">${n}</span>${cell(l, 0)}${cell(r, 1)}</div>`; }).join('')}
      <p style="font-size:12px;color:var(--muted);margin-top:10px">Красным — сторона, где результат хуже больше чем на 12%.</p></div></div>`; })()}
   ${all_t.length >= 2 && t.snapshot && first !== t ? `<div class="pad" style="margin-top:14px"><div class="card"><div class="caps" style="color:var(--coralT)">Было → стало</div>
     ${[['Наклон плеч', first.snapshot.shoulderTilt, t.snapshot.shoulderTilt], ['Наклон таза', first.snapshot.pelvicTilt, t.snapshot.pelvicTilt]].map(([n, x, y]) => `<div class="row" style="margin-top:10px"><span style="flex:1">${n}</span><b style="font-variant-numeric:tabular-nums;color:${Math.abs(y) < Math.abs(x) - .3 ? 'var(--green)' : 'var(--sub)'}">${fmt(x)}° → ${fmt(y)}°</b></div>`).join('')}</div></div>` : ''}
   <div class="pad tiles" style="margin-top:16px">${SHARED ? '' : '<button class="tile" id="myrec"><span class="ti">▶</span>Моя запись<small>Скелет и 3D-фигура</small></button>'}<button class="tile" id="shareRes"><span class="ti">↗</span>Поделиться<small>Ссылка или картинка</small></button><button class="btn ghost" id="again" style="grid-column:1/-1">↻ ${SHARED ? 'Пройти свой тест' : 'Пройти тест заново'}</button></div>
   ${SHARED ? '' : installCard()}
   <div class="pad" style="margin-top:16px"><a class="card row" href="${bot()}" target="_blank" style="text-decoration:none;color:inherit"><img src="img/img_neck.webp" alt="" style="width:52px;height:52px;border-radius:14px;object-fit:cover;flex:none"><div style="flex:1;min-width:0"><b style="font-size:15px">Разобрать карту с автором методики</b><div style="font-size:13px;color:var(--sub);margin-top:2px">Рифат Аюпов, кинезиотерапевт, 12 лет практики · онлайн</div></div><span class="chev">›</span></a></div></div>`);
  if (device.webgl2 && !device.weak) preload3D();
  // выбор зоны обновляет только подпись под моделью и метку, страница не перерисовывается
  const labels = [false, true].flatMap(b => top.filter(s => s.back === b).slice(0, 4)).map(s => ({ key: s.key, title: C.muscles[s.id].zone + (sideWord(s.side) ? ' ' + sideWord(s.side) : ''), sub: toneText(s, 3).replace('похоже, ', ''), color: TONE_HEX[s.k], text: TONE_TEXT_HEX[s.k] }));
  let h2d = null;
  const draw2d = () => { if (!MODE3D) h2d = drawHeat($('#heat'), all, BACK, SEL, labels); };
  const renderSel = () => { const x = all.find(q => q.key === SEL); const box = $('#selbox'); if (!box) return;
    box.innerHTML = x ? `<div class="card fade" style="padding:14px 16px"><div class="row" style="align-items:flex-start"><div style="flex:1"><span class="badge" style="background:${TONE[x.k][2]};color:${TONE[x.k][5]}"><i style="background:${TONE[x.k][1]}"></i>${x.ambiguous ? 'Неоднозначно' : TONE[x.k][0]}</span>
        <div style="font-size:17px;font-weight:700;margin-top:8px;letter-spacing:-.02em;line-height:1.25">${title(x)}</div><div style="font-size:13px;color:var(--muted);margin-top:2px">${tech(x)}</div>
        <div class="sub" style="font-size:13px;margin-top:4px">${seen(a, x)[0] || (x.derived ? 'Предположение, напрямую не измерено' : x.k === 'OK' ? 'Здесь все в порядке' : '')}</div></div></div>
        ${x.k !== 'OK' ? '<button class="btn" id="what" style="height:46px;margin-top:10px;font-size:15px">Что делать ›</button>' : ''}</div>`
      : '<div class="card sub" style="text-align:center;padding:14px">Нажми на зону на теле</div>';
    const w = $('#what'); if (w) w.onclick = () => muscle(SEL);
    app.querySelectorAll('.list-item').forEach(el => el.classList.toggle('on', el.dataset.k === SEL)); };
  const pick = k => { SEL = k; const x = all.find(q => q.key === k); if (x && x.back !== BACK && !MODE3D) { BACK = x.back; setView(); } draw2d(); renderSel(); };
  const setView = () => { $('#vf').classList.toggle('on', !BACK); $('#vb').classList.toggle('on', BACK); if (view3d) view3d.turn(BACK); draw2d(); };
  if (!MODE3D) { draw2d(); $('#heat').onclick = e => { const x = h2d && h2d.hit(e.clientX, e.clientY); if (x) pick(x.key); }; }
  else body3D($('#vis'), all, k => pick(k)).then(v => { view3d = v; v.turn(BACK); app.querySelectorAll('[data-z]').forEach(b => b.onclick = () => v.focus(b.dataset.z)); });
  renderSel();
  $('#vf').onclick = () => { BACK = false; setView(); }; $('#vb').onclick = () => { BACK = true; setView(); }; if ($('#v3')) $('#v3').onclick = () => { MODE3D = !MODE3D; map(); };
  app.querySelectorAll('.list-item').forEach(el => el.onclick = () => muscle(el.dataset.k));
  if ($('#plan')) $('#plan').onclick = () => workout(pl);
  if ($('#cal')) $('#cal').onclick = calendar;
  if ($('#re')) $('#re').onclick = () => { FULL = false; prep(); };
  if ($('#resend')) $('#resend').onclick = async () => { const p = await outbox.get().catch(() => null); if (p) sendResult(p); };
  bindRate('map'); bindInstall();
  $('#again').onclick = () => { if (!SHARED && INV()) return INV().join ? joinForm() : inviteWelcome(); if (SHARED) { SHARED = null; history.replaceState(null, '', location.pathname); } FULL = false; tests().length || SHARED ? prep() : onboarding(); }; $('#set').onclick = settings;
  $('#shareRes').onclick = shareResult; if ($('#myrec')) $('#myrec').onclick = async () => { const p = await consumerPoses.get(); motionViewer(p, t.setup, map, 'Тест ' + new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })); };
}
async function shareResult() {
  track('share_result');
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">Поделиться результатом</h2><p class="sub" style="font-size:14px;margin-top:6px">Другу, специалисту или себе на компьютер.</p>
    <button class="btn" id="sl" style="margin-top:16px">Ссылкой на карту</button>
    <p style="font-size:12px;color:var(--muted);margin:6px 4px 0">Откроется та же карта с разбором. Результат упакован в саму ссылку и на сервер не уходит, но открыть карту сможет любой, у кого есть ссылка.</p>
    <button class="btn ghost" id="si" style="margin-top:14px">Картинкой</button>
    <p style="font-size:12px;color:var(--muted);margin:6px 4px 0">Карта тела, главные зоны и сравнение сторон одним изображением.</p>
    <button class="btn ghost" id="sc" style="margin-top:14px;border:0">Отмена</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; d.querySelector('#sc').onclick = () => d.remove();
  const when = new Date(currentAnalysis().t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  d.querySelector('#sl').onclick = async () => { const url = await resultLink(), text = `Моя карта тела BodyPassport от ${when}:`;
    if (navigator.share) navigator.share({ title: 'BodyPassport', text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url); alert('Ссылка скопирована'); } d.remove(); };
  d.querySelector('#si').onclick = async () => { d.querySelector('#si').textContent = 'Готовлю картинку…'; const blob = await resultImage(); const file = new File([blob], 'bodypassport.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'BodyPassport', text: 'Моя карта тела' }).catch(() => {});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bodypassport.png'; a.click(); } d.remove(); };
}

// картинка результата 1080×1600: заголовок, тепловая карта, главные зоны, левая и правая сторона
async function resultImage() {
  const { t, a } = currentAnalysis(); const all = spots(a); const top = topOf(all).slice(0, 5);
  const W = 1080, H = 2400, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  await document.fonts.ready;
  c.fillStyle = '#F3F2EE'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#1C1B19'; c.font = '700 64px Onest, sans-serif'; c.fillText('Карта тела', 64, 120);
  c.fillStyle = '#6E6A63'; c.font = '400 32px Onest, sans-serif'; c.fillText('BodyPassport · тест от ' + new Date(t.date).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }), 64, 172);
  // две тепловые карты: спереди и сзади
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:470px'; document.body.appendChild(holder);
  for (const [i, back] of [[0, false], [1, true]]) { const hc = document.createElement('canvas'); hc.style.width = '470px'; holder.appendChild(hc);
    drawHeat(hc, all, back, null, []); c.drawImage(hc, 64 + i * 486, 210, 470, 470 * hc.height / hc.width);
    c.fillStyle = '#8A847A'; c.font = '600 26px Onest, sans-serif'; c.fillText(back ? 'Сзади' : 'Спереди', 64 + i * 486 + 200, 820); }
  holder.remove();
  let y = 890; c.fillStyle = '#1C1B19'; c.font = '700 38px Onest, sans-serif'; c.fillText('Главное', 64, y); y += 24;
  for (const s of top) { y += 62; c.fillStyle = TONE_HEX[s.k]; c.fillRect(64, y - 34, 10, 44); c.fillStyle = '#1C1B19'; c.font = '600 30px Onest, sans-serif'; c.fillText(title(s).slice(0, 52), 92, y);
    c.fillStyle = '#8A847A'; c.font = '400 24px Onest, sans-serif'; c.fillText(tech(s).slice(0, 60), 92, y + 30); y += 20; }
  const f = a.f, rows = [['Руки в стороны', f.sym_delt, '°'], ['Наклон в сторону', f.sym_bend, '°'], ['Подъемы на носок', f.sym_calf, ''], ['Присед на одной ноге', f.sym_quad, '°']].filter(r => r[1]);
  if (rows.length) { y += 70; c.fillStyle = '#1C1B19'; c.font = '700 34px Onest, sans-serif'; c.fillText('Левая / правая', 64, y); c.font = '400 28px Onest, sans-serif';
    for (const [n, v, u] of rows) { y += 46; c.fillStyle = '#3E3A34'; c.fillText(n, 64, y); c.fillText(`${fmt(v[0])}${u} / ${fmt(v[1])}${u}`, 700, y); } }
  // обрезаем по содержимому и добавляем подвал
  const H2 = y + 70 + 130, out = document.createElement('canvas'); out.width = W; out.height = H2; const o = out.getContext('2d');
  o.drawImage(cv, 0, 0); o.fillStyle = '#1E2533'; o.fillRect(0, H2 - 130, W, 130); o.fillStyle = '#C6E84B'; o.font = '700 34px Onest, sans-serif'; o.fillText('Пройди свой тест: ' + location.host, 64, H2 - 66);
  o.fillStyle = 'rgba(255,255,255,.6)'; o.font = '400 24px Onest, sans-serif'; o.fillText('Методика Рифата Аюпова · оценка по позе и движению, не диагноз', 64, H2 - 28);
  return new Promise(r => out.toBlob(r, 'image/png'));
}

function share() { const url = appLink();
  const text = 'Тест осанки и движения по камере телефона, 2–5 минут. Показывает перегруженные и слабые мышцы. Бесплатно:';
  if (navigator.share) navigator.share({ title: 'BodyPassport', text, url }).catch(() => {}); else { navigator.clipboard.writeText(text + ' ' + url); alert('Ссылка скопирована'); } }
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
  go(`<div class="fade" style="padding-bottom:110px"><div style="position:relative;height:300px"><img src="img/${zoneImg(s.id)}.webp" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;inset:0;background:linear-gradient(transparent 55%,var(--bg))"></div><button class="round" id="back" style="position:absolute;top:16px;left:16px;background:rgba(255,255,255,.8)">‹</button></div>
   <div class="pad" style="margin-top:-34px;position:relative;display:flex;flex-direction:column;gap:14px">
    <span class="badge" style="background:${TONE[s.k][2]};color:${TONE[s.k][5]};align-self:flex-start;font-size:13px"><i style="background:${TONE[s.k][1]}"></i>${TONE[s.k][0]}</span>
    <div><h1 style="font-size:26px">${title(s)}</h1><div style="font-size:14px;color:var(--muted);margin-top:4px">${tech(s)}</div></div>
    ${seen(a, s).slice(0, 2).map(x => `<span style="font-size:13px;font-weight:600;line-height:1.35;background:#fff;border-radius:12px;padding:8px 12px;align-self:flex-start">${x}</span>`).join('')}
    <div class="card"><div class="caps" style="color:var(--muted)">Что происходит</div><p style="font-size:16px;line-height:1.45;margin-top:8px">${why}</p></div>
    <div class="card"><div class="caps" style="color:var(--muted)">На чем основан вывод</div>
      ${a.findings.filter(f => f.muscles.some(x => x.id === s.id && (x.side === s.side || x.side === 'BOTH'))).map(f => `<div style="margin-top:10px"><b style="font-size:15px">${f.observed}</b><div style="font-size:13px;color:var(--muted)">${f.rule.basis || ''}${f.rule.weak ? ' · слабый признак' : ''}</div></div>`).join('')
        || `<p style="font-size:15px;margin-top:8px;line-height:1.4">${s.byChain ? `Напрямую не измерено. Предположение по цепи «${s.byChain}».` : s.derived ? 'Напрямую не измерено. Предположение: мышца-антагонист перегружена.' : 'Признак из теста.'}</p>`}
      ${s.derived || (a.findings.filter(f => f.muscles.some(x => x.id === s.id)).every(f => f.rule.weak)) ? '<p style="font-size:13px;color:var(--coralT);margin-top:10px">Уверенность низкая. Проверь самопроверкой ниже или на консультации.</p>' : ''}</div>
    ${m.selfTest ? `<div class="card" style="background:#EEF3FB"><div class="caps" style="color:#3B7BE8">Проверь себя за минуту</div><p style="font-size:15px;line-height:1.45;margin-top:8px">${m.selfTest}</p></div>` : ''}
    ${m.benefit ? `<div class="card row" style="background:var(--okS);align-items:flex-start"><b style="color:var(--okT);font-size:20px">✓</b><div><b>Что изменится</b><p style="font-size:15px;margin-top:4px;line-height:1.4">${m.benefit}</p></div></div>` : ''}
    ${stages.map((st, i) => `<div class="row" style="margin-top:8px"><b style="width:26px;height:26px;border-radius:8px;background:var(--navy);color:var(--lime);display:flex;align-items:center;justify-content:center;font-size:13px">${i + 1}</b><b style="font-size:18px">${st[0]}</b></div>
      ${st[1] ? `<p class="sub" style="font-size:14px">${st[1]}</p>` : ''}
      ${st[2] ? `<div class="card row" style="background:var(--peach);align-items:flex-start"><b style="width:40px;height:40px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;color:var(--coralT);flex:none">✳︎</b><div><b>Самомассаж</b>${m.tool ? ` <span class="pill" style="color:var(--coralT);font-size:12px;padding:3px 8px">${m.tool}</span>` : ''}<p style="font-size:15px;line-height:1.45;margin-top:4px;color:#3E3A34">${st[2]}</p></div></div>` : ''}
      ${st[3].map(id => { const e = ex(id); n++; return `<div class="card row exr" data-id="${id}" style="padding:10px"><div style="width:64px;height:64px;border-radius:14px;background:#ECEBE6 url(img/${zoneImg(s.id)}.webp) center/cover;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px">▶</div><div style="flex:1"><b style="font-size:16px">${e.title.split(' (')[0]}</b><div class="sub" style="font-size:13px">${[e.dose, e.durationSec + ' с'].filter(Boolean).join(' · ')}</div></div><b style="color:var(--faint);font-size:13px;padding-right:8px">${n}</b></div>`; }).join('')}`).join('')}
    <div style="border-radius:28px;background:var(--navy);padding:22px;color:#fff"><div class="caps" style="color:var(--lime)">Консультация</div><h2 style="font-size:20px;margin-top:8px">Разберем вместе</h2><a class="btn lime" style="width:auto;display:inline-flex;height:48px;padding:0 20px;margin-top:14px;text-decoration:none" href="${bot()}" target="_blank">Записаться</a></div>
   </div>${all.length ? `<div style="position:fixed;left:0;right:0;bottom:0;padding:12px 20px calc(env(safe-area-inset-bottom) + 20px);background:linear-gradient(transparent,var(--bg) 30%);max-width:480px;margin:0 auto"><button class="btn" id="go"><span class="ic">▶</span> Начать комплекс · ${totalMin(all.map(ex))} мин</button></div>` : ''}</div>`);
  $('#back').onclick = map; app.querySelectorAll('.exr').forEach(el => el.onclick = () => workout([el.dataset.id])); if ($('#go')) $('#go').onclick = () => workout(all);
}

// ---------- 7. тренировка ----------
export async function workout(ids) {
  const list = ids.map(ex).filter(Boolean); let i = 0, closed = false; voice.unlock(); keepAwake(true);
  const run = async () => {
    if (closed) return; if (i >= list.length) return done(list);
    const e = list[i], total = Math.max(10, e.durationSec); let left = total, playing = false;
    go(`<div class="scr dark fade" style="padding:16px 24px 34px">
      <div class="row"><div class="segs" style="flex:1">${list.map((_, k) => `<div><b style="width:${k < i ? 100 : k === i ? 100 : 0}%;background:${k === i ? '#fff' : 'var(--lime)'}"></b></div>`).join('')}</div><button class="round" id="x" style="background:rgba(255,255,255,.12);color:#fff;width:40px;height:40px">✕</button></div>
      <div style="color:var(--lime);font-size:13px;font-weight:600;margin-top:18px">Упражнение ${i + 1} из ${list.length}</div><h1 style="color:#fff;font-size:30px;margin-top:6px">${e.title.split(' (')[0]}</h1>
      <div class="row" style="gap:6px;margin-top:12px;flex-wrap:wrap">${[e.dose, e.feel].filter(Boolean).map(x => `<span class="pill" style="background:rgba(255,255,255,.12);color:#fff">${x}</span>`).join('')}</div>
      <div style="display:flex;justify-content:center;margin-top:26px"><div style="position:relative;width:220px;height:220px"><svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle id="arc" cx="50" cy="50" r="45" fill="none" stroke="#C6E84B" stroke-width="5" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/></svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b id="tm" style="font-size:52px;letter-spacing:-.04em;opacity:.45">${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}</b><span id="tml" style="font-size:13px;opacity:.55;margin-top:6px">старт после подсказки</span></div></div></div>
      <div style="flex:1;margin-top:22px;display:flex;flex-direction:column;gap:12px">${e.steps.slice(0, 3).map((s, k) => `<div class="row st" style="opacity:.45"><b style="width:28px;height:28px;border-radius:9px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:13px;flex:none">${k + 1}</b><span style="font-size:16px;line-height:1.35">${s}</span></div>`).join('')}
        ${e.check ? `<div class="row" style="background:rgba(198,232,75,.14);border-radius:16px;padding:12px;align-items:flex-start"><b style="color:var(--lime)">i</b><span style="font-size:14px;line-height:1.4">${e.check}</span></div>` : ''}</div>
      <div class="row" style="justify-content:center;gap:28px"><button class="round" id="pv" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">⏮</button><button class="round" id="pp" style="width:80px;height:80px;background:var(--lime);font-size:28px">❚❚</button><button class="round" id="nx" style="width:56px;height:56px;background:rgba(255,255,255,.1);color:#fff">⏭</button></div></div>`);
    let token = {}; const myTok = token;
    $('#x').onclick = () => { closed = true; voice.say(''); map(); };
    $('#pv').onclick = () => { token.dead = true; i = Math.max(0, i - 1); run(); };
    $('#nx').onclick = () => { token.dead = true; mark(e); i++; run(); };
    $('#pp').onclick = () => { playing = !playing; $('#pp').textContent = playing ? '❚❚' : '▶'; };
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
  go(`<div class="scr pad fade" style="padding-top:70px;padding-bottom:34px"><div style="width:88px;height:88px;border-radius:30px;background:var(--lime);margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:40px">✓</div>
   <h1 style="text-align:center;margin-top:26px">Комплекс выполнен</h1><p class="sub" style="text-align:center;margin-top:8px">Делай так 2 недели и повтори тест. Сравним карты.</p>
   <div class="row" style="margin-top:28px;gap:10px"><div class="card" style="flex:1"><b style="font-size:30px">${list.length}</b><div class="sub" style="font-size:13px">упражнения</div></div><div class="card" style="flex:1"><b style="font-size:30px">${totalMin(list)} мин</b><div class="sub" style="font-size:13px">на себя</div></div></div>
   <div class="card" style="margin-top:10px"><b>🔥 Серия: ${s} дн.</b></div><div style="flex:1"></div>
   <button class="btn" id="back">К карте тела</button><p style="text-align:center;font-size:13px;color:var(--muted);margin-top:12px">Повтори тест через 7 дней, чтобы увидеть изменения</p></div>`);
  $('#back').onclick = map; }

// ---------- настройки ----------
export function settings() {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">Настройки</h2>
    <div class="card row" style="margin-top:14px"><span style="flex:1">Голосовые подсказки</span><button class="pill" id="vm">${voice.muted ? 'Выкл' : 'Вкл'}</button></div>
    <div class="card" style="margin-top:10px;font-size:14px;line-height:1.45">Видео не сохраняется и никуда не отправляется. Результаты хранятся только в этом браузере.</div>
    <div class="card" style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.45">Автор: Рифат Аюпов, биомеханик, кинезиотерапевт, rifataiupov.com. Распознавание позы: MediaPipe (Google, Apache 2.0). 3D-модель: Z-Anatomy на основе BodyParts3D (DBCLS), CC BY-SA. Методика: кинезиотерапевт Рифат Аюпов, rifataiupov.com.</div>
    <div id="acc"></div>
    <button class="btn ghost" id="fbk" style="margin-top:10px">Отзыв или идея</button>
    <button class="btn ghost" id="shapp" style="margin-top:10px">Поделиться приложением</button>
    <a class="btn ghost" href="/privacy" target="_blank" style="margin-top:10px;text-decoration:none">Конфиденциальность</a>
    <div class="row" style="justify-content:center;gap:16px;margin-top:10px;font-size:13px"><a href="/terms" target="_blank" style="color:var(--sub)">Соглашение</a><a href="/licenses" target="_blank" style="color:var(--sub)">Лицензии</a></div>
    <button class="btn ghost" id="topro" style="margin-top:10px">Кабинет специалиста</button>
    <button class="btn ghost" id="wipe" style="margin-top:10px">Удалить мои результаты</button><button class="btn" id="cl" style="margin-top:10px">Готово</button></div>`;
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
  if (!u) { if ((await providers()).length) { el.innerHTML = '<button class="btn ghost" id="login" style="margin-top:10px">Войти</button>'; el.querySelector('#login').onclick = () => { close(); const home = () => (tests().length ? map() : onboarding()); ensureLogin('client', home).then(ok => ok && home()); }; } return; }
  el.innerHTML = `<div class="card row" style="margin-top:10px"><div style="flex:1;font-size:14px;line-height:1.35"><b>${esc(u.name)}</b><div style="color:var(--muted);font-size:12px">${u.provider === 'google' ? 'Google' : 'Telegram'}${u.role === 'specialist' ? ' · специалист' : ''}</div></div><button class="pill" id="lo">Выйти</button></div>
    ${u.admin ? '<button class="btn ghost" id="beta" style="margin-top:10px">Участники беты</button><button class="btn ghost" id="funnel" style="margin-top:10px">Статистика и отзывы</button>' : ''}
    <button class="btn ghost" id="delacc" style="margin-top:10px;color:#E5484D;border-color:#F3C9C9">Удалить аккаунт</button>`;
  el.querySelector('#lo').onclick = async () => { await logout(); localStorage.removeItem('bp_mode'); close(); onboarding(); };
  el.querySelector('#delacc').onclick = async () => { if (!confirm('Удалить аккаунт? Результаты на этом телефоне останутся, их можно удалить отдельно.')) return; try { await deleteAccount(); localStorage.removeItem('bp_mode'); close(); onboarding(); } catch (e) { alert('Не получилось: ' + e.message); } };
  if (el.querySelector('#funnel')) el.querySelector('#funnel').onclick = () => { close(); funnelScreen(); };
  if (el.querySelector('#beta')) el.querySelector('#beta').onclick = async () => { try { const list = await betaUsers(); close();
    go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><b style="font-size:17px">Участники беты · ${list.length}</b></div>
      <div class="pad" style="display:flex;flex-direction:column;gap:8px;padding-bottom:30px">${list.map(x => `<div class="card" style="padding:12px 14px;font-size:14px;line-height:1.4"><b>${esc(x.name)}</b> <span style="color:var(--muted)">${x.role === 'specialist' ? 'специалист' : 'клиент'} · ${x.provider === 'google' ? esc(x.email) : '@' + esc(x.username || 'telegram')}</span><div style="font-size:12px;color:var(--muted)">с ${new Date(x.created).toLocaleDateString('ru')}${x.ref ? ' · откуда: ' + esc(x.ref) : ''}${x.specialty ? ' · ' + esc(x.specialty) : ''} · тариф ${esc(x.plan)}${x.paidUntil > Date.now() ? ' до ' + new Date(x.paidUntil).toLocaleDateString('ru') : ''}</div>${x.role === 'specialist' ? `<button class="pill" data-pro="${esc(x.id)}" style="margin-top:8px;border:1.5px solid var(--line)">Про +30 дней</button>` : ''}</div>`).join('')}</div></div>`);
    $('#back').onclick = () => map();
    app.querySelectorAll('[data-pro]').forEach(btn => btn.onclick = async () => { if (!confirm('Продлить Про на 30 дней?')) return;
      const r = await fetch('/api/auth?a=setplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: btn.dataset.pro, plan: 'pro', days: 30 }) }); btn.textContent = r.ok ? 'Продлено ✓' : 'Ошибка'; });
  } catch (e) { alert(e.message); } };
}

// ---------- воронка беты (только администратор): обезличенные шаги из js/track.js ----------
const FUNNEL = [['client', 'Клиент', [['app_open', 'Открыли приложение'], ['onb_done', 'Прошли знакомство'], ['login_ok', 'Вошли'], ['safety_ok', 'Скрининг: можно'], ['safety_stop', 'Скрининг: к врачу'],
  ['test_start', 'Начали тест'], ['test_done', 'Закончили тест'], ['test_cancel', 'Прервали тест'], ['map_view', 'Открыли карту'], ['share_result', 'Поделились'], ['inv_open', 'Открыли ссылку специалиста'], ['result_sent', 'Отправили результат'], ['result_fail', 'Не смогли отправить'], ['fb_sent', 'Оставили оценку или отзыв'], ['ref_share', 'Поделились приложением'], ['install_shown', 'Видели «Установить»'], ['install_ok', 'Установили на экран']]],
  ['pro', 'Специалист', [['pro_open', 'Открыли кабинет'], ['assess_start', 'Начали оценку'], ['assess_done', 'Закончили оценку'], ['report_sent', 'Отчет клиенту'], ['retest_set', 'Назначили ретест'], ['invite_sent', 'Ссылка клиенту'], ['join_sent', 'Общая ссылка'], ['result_pulled', 'Получили результат из дома'], ['fb_sent', 'Оценка или отзыв'], ['ref_share', 'Пригласили коллегу']]]];
export async function funnelScreen(days = 14) {
  go('<div class="spin"></div>');
  let d; try { const r = await fetch('/api/ev?a=stats&days=' + days, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); d = await r.json(); } catch (e) { alert('Не удалось загрузить: ' + e.message); return map(); }
  const sum = k => Object.values(d.events[k] || {}).reduce((x, y) => x + y, 0);
  const block = ([role, name, steps]) => { const base = sum(role + ':' + steps[0][0]) || 1;
    return `<div class="card" style="padding:14px 16px"><b>${name}</b>${steps.map(([k, t]) => { const n = sum(role + ':' + k);
      return `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${t}</span><b>${n}</b><span style="width:52px;text-align:right;color:var(--sub)">${Math.round(n / base * 100)}%</span></div>`; }).join('')}</div>`; };
  const errs = Object.entries(d.errors || {}).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const src = Object.entries(d.sources || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const [fb, users] = await Promise.all([fetch('/api/feedback?days=' + Math.max(days, 30), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null), betaUsers().catch(() => [])]);
  const refs = users.filter(u => u.invited).sort((a, b) => b.invitedPro - a.invitedPro || b.invited - a.invited).slice(0, 10);
  const kind = { result: 'оценка теста', nps: 'порекомендует', free: 'отзыв' };
  go(`<div class="scr fade"><div class="pad row" style="padding-top:8px"><button class="round" id="back" style="background:transparent">‹</button><b style="font-size:17px">Статистика · ${days} дней</b></div>
    <div class="pad" style="display:flex;flex-direction:column;gap:10px;padding-bottom:30px">
     <p class="sub" style="font-size:13px">Число вкладок, где шаг был хотя бы раз, сумма по дням. Процент от первого шага.</p>
     <div class="seg">${[7, 14, 30].map(n => `<button data-d="${n}" class="${n === days ? 'on' : ''}">${n} дней</button>`).join('')}</div>
     ${FUNNEL.map(block).join('')}
     <div class="kpi"><div><b>${d.testMedianSec ? Math.round(d.testMedianSec / 60 * 10) / 10 : '—'}</b><span>мин на тест, медиана (${d.testN || 0})</span></div><div><b>${fb && fb.resultAvg != null ? fb.resultAvg : '—'}</b><span>польза теста из 5 (${fb ? fb.resultN : 0})</span></div><div><b>${fb && fb.nps != null ? fb.nps : '—'}</b><span>NPS специалистов (${fb ? fb.npsN : 0})</span></div></div>
     <div class="card" style="padding:14px 16px"><b>Откуда приходят</b>${src.length ? src.map(([k, n]) => `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1;word-break:break-all">${esc(k)}</span><b>${n}</b></div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока нет данных</div>'}<p class="sub" style="font-size:12px;margin-top:8px">Метка из ссылки ?ref= или ?utm_source=. Коды r… это приглашения пользователей.</p></div>
     <div class="card" style="padding:14px 16px"><b>Приглашения</b>${refs.length ? refs.map(u => `<div class="row" style="font-size:14px;margin-top:8px"><span style="flex:1">${esc(u.name)}</span><span style="color:var(--sub)">${u.invited} пришли · </span><b>${u.invitedPro} спец.</b></div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Пока никто не пригласил</div>'}</div>
     <div class="card" style="padding:14px 16px"><b>Отзывы</b>${fb && fb.items.length ? fb.items.slice(0, 40).map(x => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line2);font-size:14px;line-height:1.45"><div class="row" style="gap:8px;font-size:12px;color:var(--sub)"><span>${new Date(x.at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</span><span>${x.r === 'pro' ? 'специалист' : 'клиент'}</span><span>${kind[x.k] || ''}${x.s != null ? ': <b style="color:var(--text)">' + x.s + '</b>' : ''}</span></div>${x.t ? `<div style="margin-top:4px">${esc(x.t)}</div>` : ''}${x.contact ? `<div style="margin-top:4px;font-size:13px;color:var(--weakT)">Можно связаться: ${esc(x.contact.name)} ${esc(x.contact.handle)}</div>` : ''}</div>`).join('') : '<div class="sub" style="font-size:13px;margin-top:6px">Отзывов пока нет</div>'}</div>
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
    if (data && data.hash) { try { role = await tgWebLogin(data); claimLegacy(); } catch (e) { alert('Не получилось войти через Telegram: ' + e.message); } }
    return role === 'specialist' ? openPro() : INV() ? inviteWelcome() : prep(); }
  if (q.get('tgauth') && q.get('hash') && q.get('id')) { const data = {}; for (const k of ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash']) if (q.get(k)) data[k] = q.get(k);
    history.replaceState(null, '', location.pathname); let role = 'client';
    try { role = await tgWebLogin(data); claimLegacy(); } catch (e) { alert('Не получилось войти через Telegram: ' + e.message); }
    return role === 'specialist' ? openPro() : INV() ? inviteWelcome() : prep(); }
  if (location.hash.startsWith('#r=')) { try { SHARED = cleanResult(await unpackResult(location.hash.slice(3))); } catch (e) { SHARED = null; } }
  if (location.hash.startsWith('#join=')) { try { const inv = { ...cleanInv(seal.unpack(location.hash.slice(6))), join: true }; localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  if (location.hash.startsWith('#inv=')) { try { const inv = cleanInv(seal.unpack(location.hash.slice(5))); localStorage.setItem('bp_inv', JSON.stringify(inv)); localStorage.setItem('bp_mode', 'client'); history.replaceState(null, '', location.pathname); return inviteWelcome(); } catch (e) {} }
  if (!SHARED && localStorage.getItem('bp_mode') === 'pro') return openPro();
  SHARED || tests().length ? map() : onboarding();
})();
