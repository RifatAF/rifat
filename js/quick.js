// «Быстрый тест» (ТЗ v4): клиент → согласие → 4 фото → точки с правкой → замер → отчет.
// Фото, точки, выводы и имя клиента хранятся на телефоне специалиста (IndexedDB кабинета). Наружу только отчет по ссылке, зашифрованный на телефоне.
import { _pro, proHome, clientCard, homeworkLink, pullResults } from './pro.js';
import { go, esc, ic, toast, spots, topOf, asClient } from './app.js';
import { C, cam, startCamera, stopCamera, detectStill, initPose, startMotion, phone, cameraBlocked, openInBrowserSheet, posedFigure, body3D } from './core.js';
import { poseOf } from './pose-figure.js';
import { VIEWS as REQ, ALL_VIEWS as VIEWS, EDIT_POINTS, POINT_NAMES, quickMetrics, summaryOf, ALGO, viewMetrics, observations, frameIssue, ERR as QERR, isOut, LIMIT } from './quick-metrics.js';
import { P, analyze, levelled } from './analysis.js';
import { track } from './track.js';
import { matte } from './ds.js';
import qrcode from './qr.js';
import { releaseFor } from './biomechanics-engine.js';

const $ = s => document.querySelector(s);
const CONSENT_VER = '2026-10-v4-draft';
const LEGAL = 'Отчет не является медицинским заключением и не заменяет консультацию врача.';
const MAX_SIDE = 1600;
let Q = null;
// get кабинета для отсутствующей записи возвращает сам запрос IndexedDB, а не undefined
const row = async (st, k) => { const r = await _pro.get(st, k); return r && !(typeof IDBRequest !== 'undefined' && r instanceof IDBRequest) ? r : null; };

// ---------- 1. клиент ----------
export async function quickTest(clientId = null) {
  if (cameraBlocked()) return openInBrowserSheet();
  const clients = (await _pro.all('clients')).filter(c => !c.demo && !c.nocard), asses = await _pro.all('assessments');
  const last = id => Math.max(0, ...asses.filter(a => a.clientId === id).map(a => a.date));
  const recent = clients.sort((x, y) => (last(y.id) || y.created) - (last(x.id) || x.created)).slice(0, 6);
  Q = { client: clientId ? clients.find(c => c.id === clientId) || null : null, views: {}, date: Date.now() };
  if (Q.client) return consent();
  const num = (v, lo, hi) => { const n = +String(v || '').replace(',', '.'); return n >= lo && n <= hi ? n : 0; };
  // рост задает масштаб замеров в сантиметрах (без него 170 см), вес только для истории клиента; первый тест нового клиента проверяет пробный PRO
  const next = c => { const h = num($('#qhgt').value, 100, 230), kg = num($('#qkg').value, 25, 300);
    Q.client = { ...c, ...(h ? { height: String(Math.round(h)) } : {}), ...(kg ? { weight: String(Math.round(kg * 10) / 10) } : {}) }; _pro.trialGate(Q.client.id, consent); };
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Быстрый тест</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s2)">
    <p class="sub" style="font-size:15px;line-height:1.45">4 фото клиента в полный рост: спереди, справа, сзади, слева. Точки приложение поставит само.</p>
    <input id="nm" class="field" placeholder="Имя или метка клиента" autocomplete="off" aria-label="Имя или метка клиента">
    <div class="row" style="gap:10px"><input id="qhgt" class="field" type="text" inputmode="numeric" maxlength="3" placeholder="Рост, см" aria-label="Рост, см" style="flex:1;min-width:0"><input id="qkg" class="field" type="text" inputmode="decimal" maxlength="5" placeholder="Вес, кг" aria-label="Вес, кг" style="flex:1;min-width:0"></div>
    <p class="sub" style="font-size:12px;margin-top:-6px">Рост нужен для замеров в сантиметрах, без него считаем 170 см. Вес по желанию, для истории клиента.</p>
    ${recent.length ? `<div class="row" style="flex-wrap:wrap;gap:8px">${recent.map(c => `<button class="pill" data-c="${c.id}">${esc(c.name)}</button>`).join('')}</div>` : ''}
    <button class="btn" id="qnext">Дальше</button>
    <button class="btn ghost" id="qnocard" style="border:0">Без карточки</button>
   </div></div>`);
  $('#back').onclick = () => proHome();
  let pick = null;
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pick = clients.find(c => c.id === b.dataset.c); $('#nm').value = pick.name; $('#qhgt').value = pick.height || ''; $('#qkg').value = pick.weight || '';
    if (pick.height) return next(pick); document.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); $('#qhgt').focus(); });
  $('#qnext').onclick = async () => { const n = $('#nm').value.trim(); if (!n) { $('#nm').focus(); $('#nm').placeholder = 'Введите имя или метку'; return; }
    next(clients.find(c => c.name.toLowerCase() === n.toLowerCase()) || { id: _pro.uid(), created: Date.now(), name: n.slice(0, 60), first: n.slice(0, 60), last: '', quick: true }); };
  $('#qnocard').onclick = () => { const d = new Date(); next({ id: _pro.uid(), created: Date.now(), name: 'Без карточки · ' + d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }), first: 'Клиент', last: '', nocard: true, quick: true }); };
}

// ---------- 2. согласие клиента (ТЗ v4, п. 6; текст утверждает юрист) ----------
function consent() {
  const c = Q.client;
  if (c.consent && c.consent.ver === CONSENT_VER) { Q.consent = { ...c.consent, reused: true }; return startShooting(); }
  const li = (t, s) => `<div style="padding:12px 0;border-top:1px solid var(--line-2)"><b style="font-size:15px">${t}</b><div class="sub" style="font-size:14px;margin-top:3px;line-height:1.4">${s}</div></div>`;
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Согласие клиента</b></div></div>
   <div class="pad" style="margin-top:var(--s2)">
    <p style="font-size:16px;line-height:1.45">Покажите этот экран клиенту${c.nocard ? '' : ': <b>' + esc(c.name) + '</b>'}.</p>
    <div class="card" style="margin-top:12px;padding:4px 16px">
     ${li('Что снимаем', '4 фото в полный рост (спереди, с двух боков, сзади) и значения, измеренные по ним: углы и смещения.')}
     ${li('Зачем', 'Показать вам результат и сравнить его при следующем замере.')}
     ${li('Где хранится', 'На телефоне специалиста. Если специалист отправит вам отчет и домашнее задание ссылкой, они уходят зашифрованными: прочитать их можно только по этой ссылке.')}
     ${li('Сколько хранится', 'Пока специалист работает с вами, но не дольше 3 лет.')}
     ${li('Ваши права', 'Вы можете в любой момент отозвать согласие: специалист удалит фото и замеры.')}
    </div>
    <p class="sub" style="font-size:12px;margin-top:8px">Это не медицинское обследование и не диагноз. Текст согласия на утверждении у юриста.</p>
    <label class="row" style="gap:12px;margin-top:16px;font-size:16px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="qok" style="width:24px;height:24px;flex:none;accent-color:var(--ink)"><span>Клиент прочитал и согласен</span></label>
    <button class="btn" id="qgo" style="margin-top:16px" disabled>${ic('camera', 's')}Начать съемку</button>
   </div></div>`);
  $('#back').onclick = () => quickTest();
  $('#qok').onchange = e => { $('#qgo').disabled = !e.target.checked; };
  $('#qgo').onclick = () => { Q.consent = { at: Date.now(), ver: CONSENT_VER, who: c.nocard ? 'без карточки' : c.name }; c.consent = Q.consent; startShooting(); };
}

// ---------- 3. съемка 4 фото ----------
const SIL = {
  front: '<ellipse cx="50" cy="11" rx="7" ry="8.5"/><path d="M50 20c-9 0-16 3-17 9l-3 26c0 3 4 3 4 0l3-20v27l-2 47c0 3 5 3 5 0l7-42h6l7 42c0 3 5 3 5 0l-2-47V35l3 20c0 3 4 3 4 0l-3-26c-1-6-8-9-17-9z"/>',
  side: '<ellipse cx="50" cy="11" rx="7" ry="8.5"/><path d="M48 20c-6 0-9 4-9 9l1 33-3 50c0 3 5 3 5 0l5-42 3 42c0 3 5 3 5 0l-2-50 2-33c0-5-3-9-7-9z"/>',
};
async function startShooting() {
  Q.wasBack = cam.back; cam.back = true; startMotion(); if (!localStorage.getItem('bp_first_test')) { localStorage.setItem('bp_first_test', String(Date.now())); track('first_test', null, false); }
  track('assess_start', { n: 4, c: 'quick' }, false); shoot(0);
}
// камера в стиле Matte: инклинометр сверху, шаги ракурсов и одна кнопка снизу; id элементов те же, логика общая
const CAM_CSS = `.mt-cam #qhint:empty{display:none}.mt-cam .mt-glass{background:rgba(22,22,23,.72);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1)}
.mt-inc{display:flex;flex-direction:column;align-items:center;gap:5px;padding:7px 14px 8px;border-radius:18px;min-width:150px}.mt-inc span{font:500 11px Inter,system-ui;color:#98989D;letter-spacing:.02em}
.mt-inc b{font:600 17px 'JetBrains Mono',ui-monospace,monospace;color:#fff}.mt-inc i{position:relative;display:block;width:110px;height:6px;border-radius:3px;background:rgba(255,255,255,.14)}
.mt-inc i:after{content:'';position:absolute;left:50%;top:-2px;width:1px;height:10px;background:rgba(255,255,255,.5)}.mt-inc em{position:absolute;top:-1px;left:50%;width:14px;height:8px;margin-left:-7px;border-radius:4px;background:#30D158;transition:transform .12s}
.mt-chip{font:500 11.5px 'JetBrains Mono',ui-monospace,monospace;color:#E5E5EA;padding:6px 10px;border-radius:12px;line-height:1.35}
.mt-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.mt-steps div.opt{border:1px dashed rgba(255,255,255,.22)}.mt-steps div.opt.on{border-style:solid}.mt-steps div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-radius:16px;font:500 12px Inter,system-ui;color:#98989D;border:1px solid transparent}
.mt-steps div.on{color:#0EA5E9;border-color:rgba(14,165,233,.6);background:rgba(14,165,233,.12)}.mt-steps div.ok{color:#E5E5EA}.mt-steps svg{width:22px;height:22px}
.mt-shot{flex:1;height:56px;border:0;border-radius:9999px;background:#0EA5E9;color:#00131D;font:600 17px Inter,system-ui;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 10px 30px rgba(14,165,233,.35);cursor:pointer}`;
const STEP_IC = { front: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.6"/><path d="M8.5 9h7l-.8 6.5H13l-.5 6.5h-1L11 15.5H9.3z"/></svg>', back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="2.4"/><path d="M8.5 9h7l-.8 6.5H13l-.5 6.5h-1L11 15.5H9.3z"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12h12M12 7l5 5-5 5M20 5v14"/></svg>',
  squat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2.2"/><path d="M12 7.5v5.5M6 10h12M12 13l-4 2 1 6M12 13l4 2-1 6"/></svg>', left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12H8M12 7l-5 5 5 5M4 5v14"/></svg>' };
const OPT_NOTE = '<div style="font:400 13px Inter,system-ui;line-height:1.35;color:#C7C7CC;margin-top:6px">Для точности: видно, как колени и таз ведут себя под нагрузкой. Можно пропустить.</div>';
function camMatte(i, v) {
  return `<div class="cam qcam mt-cam" style="display:flex;flex-direction:column"><style>${CAM_CSS}</style>
    <video id="qv" playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>
    <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" style="position:absolute;left:50%;top:8%;height:84%;transform:translateX(-50%);fill:none;stroke:rgba(14,165,233,.75);stroke-width:.6;stroke-dasharray:2 1.6;pointer-events:none;filter:drop-shadow(0 0 2px rgba(14,165,233,.6))" aria-hidden="true">${v.id === 'front' || v.id === 'back' ? SIL.front : SIL.side}</svg>
    <div style="position:relative;padding:calc(env(safe-area-inset-top) + 10px) 14px 0;display:flex;align-items:flex-start;gap:10px">
      <button class="cam-btn mt-glass" id="qx" aria-label="Закрыть" style="width:44px;height:44px;padding:0;border-radius:50%">${ic('x', 's')}</button>
      <div style="flex:1;display:flex;justify-content:center"><div class="mt-inc mt-glass"><span>Инклинометр</span><b id="qinc">0,0°</b><i><em id="qbub"></em></i></div></div>
      <div class="mt-chip mt-glass" id="qlight" style="min-width:44px">Свет<br>…</div></div>
    <div id="qlevel" style="position:absolute;left:50%;top:50%;width:120px;height:3px;margin-left:-60px;border-radius:2px;background:rgba(255,255,255,.7);transition:transform .1s;pointer-events:none"></div>
    <div class="mt-glass" style="margin:auto 10px calc(env(safe-area-inset-bottom) + 10px);position:relative;border-radius:30px;padding:12px">
      <!-- инструкция внизу, а не поверх головы человека в кадре -->
      <div style="padding:2px 6px 12px"><div class="row" style="gap:8px;justify-content:space-between"><span style="font:600 12px 'JetBrains Mono',monospace;color:#0EA5E9;letter-spacing:.04em">${v.opt ? 'ДОП. СНИМОК · НЕОБЯЗАТЕЛЬНО' : `${i + 1} / 4 · ${v.name.toUpperCase()}`}</span><span id="qhint" style="font:600 12px Inter,system-ui;padding:4px 10px;border-radius:9999px;background:rgba(255,255,255,.08)"></span></div>
        <div style="font:700 19px Inter,system-ui;line-height:1.25;margin-top:6px;letter-spacing:-.02em">«${v.say}»</div>${v.opt ? OPT_NOTE : ''}</div>
      <div class="mt-steps">${VIEWS.map((w, k) => `<div class="${k === i ? 'on' : Q.views[w.id] ? 'ok' : ''}${w.opt ? ' opt' : ''}">${Q.views[w.id] && k !== i ? '<svg viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="2.4" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : STEP_IC[w.id]}${w.short || w.name}${w.opt ? '<span style="font-size:9.5px;margin-top:-3px;opacity:.8">доп.</span>' : ''}</div>`).join('')}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px"><label class="mt-glass" style="height:56px;padding:0 16px;border-radius:9999px;display:grid;place-items:center;font:500 15px Inter,system-ui;cursor:pointer">Загрузить<input type="file" id="qfile" accept="image/*" style="display:none"></label>
        <button id="qshot" class="mt-shot" aria-label="Сделать снимок">${ic('camera', 's')}Сделать снимок</button></div>${v.opt ? '<button id="qskip" class="mt-glass" style="width:100%;height:48px;margin-top:8px;border-radius:9999px;color:#fff;font:600 15px Inter,system-ui;cursor:pointer">Пропустить и проверить точки</button>' : ''}
      <div style="text-align:center;font:400 11.5px Inter,system-ui;color:#98989D;margin-top:8px">Снимок с поправкой на крен телефона</div></div>
    <div id="qflash" style="position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s"></div></div>`;
}
function shoot(i, single = false) {
  const v = VIEWS[i];
  if (matte()) go(camMatte(i, v)); else go(`<div class="cam qcam" style="display:flex;flex-direction:column">
    <video id="qv" playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>
    <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" style="position:absolute;left:50%;top:8%;height:84%;transform:translateX(-50%);fill:none;stroke:rgba(255,255,255,.55);stroke-width:.7;stroke-dasharray:2 1.6;pointer-events:none" aria-hidden="true">${v.id === 'front' || v.id === 'back' ? SIL.front : SIL.side}</svg>
    <div style="position:relative;padding:calc(env(safe-area-inset-top) + 12px) 16px 0;display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1"><div class="cam-status">${v.opt ? 'ДОП. СНИМОК · НЕОБЯЗАТЕЛЬНО' : `${i + 1} / 4 · ${v.name.toUpperCase()}`}</div><div style="font-size:22px;font-weight:700;line-height:1.2;margin-top:4px;text-shadow:0 1px 6px #000">«${v.say}»</div>${v.opt ? OPT_NOTE : ''}
        <div id="qhint" style="margin-top:8px;font-size:15px;font-weight:600;min-height:22px;text-shadow:0 1px 6px #000"></div></div>
      <button class="cam-btn" id="qx" aria-label="Закрыть" style="width:48px;padding:0">${ic('x', 's')}</button></div>
    <div id="qlevel" style="position:absolute;left:50%;top:50%;width:120px;height:4px;margin-left:-60px;border-radius:2px;background:rgba(255,255,255,.7);transition:transform .1s;pointer-events:none"></div>
    <div style="margin-top:auto;position:relative;padding:0 16px calc(env(safe-area-inset-bottom) + 18px);display:flex;align-items:center;justify-content:space-between">
      <label class="cam-btn" style="display:grid;place-items:center;cursor:pointer">Загрузить<input type="file" id="qfile" accept="image/*" style="display:none"></label>
      <button id="qshot" aria-label="Сделать фото" style="width:78px;height:78px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.25);cursor:pointer"></button>
      ${v.opt ? '<button class="cam-btn" id="qskip">Пропустить</button>' : '<span style="width:96px"></span>'}</div>
    <div id="qflash" style="position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s"></div>
   </div>`);
  const video = $('#qv'); let lum = 255, lumT = 0, busy = false;
  const lumCv = document.createElement('canvas'); lumCv.width = lumCv.height = 24;
  cam.onFrame = f => {
    const lv = $('#qlevel'); if (!lv) return; const roll = phone.ok ? phone.roll : 0;
    lv.style.transform = `rotate(${-roll}deg)`; lv.style.background = Math.abs(roll) <= 2 ? '#34D399' : 'rgba(255,255,255,.7)';
    const now = performance.now(); if (now - lumT > 900) { lumT = now; try { const x = lumCv.getContext('2d', { willReadFrequently: true }); x.drawImage(video, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] * .3 + d[k + 1] * .59 + d[k + 2] * .11; lum = s / 576; } catch (e) {} }
    const h = Math.abs(roll) > 2.5 && phone.ok ? 'Выровняйте телефон: полоска станет зеленой' : lum < 45 ? 'Мало света: включите свет или повернитесь к окну' : f.pose ? frameIssue(v.id, f.pose, f.w, f.h) : 'Клиент целиком в контуре';
    $('#qhint').textContent = h; $('#qhint').style.color = h ? '#FDE68A' : '#86EFAC'; if (!h) $('#qhint').textContent = 'Можно снимать';
    if ($('#qinc')) { const r = phone.ok ? roll : 0, ok = Math.abs(r) <= 2; $('#qinc').textContent = (r < 0 ? '−' : '') + Math.abs(r).toFixed(1).replace('.', ',') + '°'; $('#qinc').style.color = ok ? '#30D158' : '#FF9F0A';
      $('#qbub').style.transform = `translateX(${Math.max(-48, Math.min(48, r * 4))}px)`; $('#qbub').style.background = ok ? '#30D158' : '#FF9F0A';
      $('#qlight').innerHTML = `Свет<br>${lum < 45 ? '<span style="color:#FF9F0A">мало</span>' : 'норм'}`; }
  };
  const done = async (src, w, h, roll) => {
    if (busy) return; busy = true; $('#qflash').style.opacity = '.8'; setTimeout(() => { const f = $('#qflash'); if (f) f.style.opacity = '0'; }, 120);
    const k = Math.min(1, MAX_SIDE / Math.max(w, h)), cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    let pts = null; try { pts = await detectStill(cv); } catch (e) {}
    const issue = frameIssue(v.id, pts, cv.width, cv.height);
    // крена с датчика нет (фото из галереи, датчик не разрешен): выравниваем по линиям фона
    let rollSrc = roll ? 'sensor' : null; if (!roll) { try { roll = estimateRoll(cv, cv.width, cv.height, pts); } catch (e) { roll = 0; } rollSrc = roll ? 'image' : 'none'; }
    Q.views[v.id] = { photo: cv.toDataURL('image/jpeg', .85), w: cv.width, h: cv.height, pts, auto: pts ? pts.map(p => ({ ...p })) : null, roll, rollSrc, ok: false, issue };
    if (issue) return review(i, single);
    next(i, single);
  };
  $('#qshot').onclick = () => { if (video.readyState < 2) return; done(video, video.videoWidth, video.videoHeight, (cam.back ? -1 : 1) * (phone.ok ? phone.roll : 0)); };
  $('#qfile').onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { done(img, img.naturalWidth, img.naturalHeight, 0); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); };
  if ($('#qskip')) $('#qskip').onclick = () => { finish(); if (!single) track('test_done', { c: 'quick' }, false); editor(single ? firstOpen() : 0); };
  $('#qx').onclick = () => { finish(); if (Object.keys(Q.views).length) editor(firstOpen()); else proHome(); };
  (async () => { try { await Promise.all([startCamera(video), initPose()]); } catch (e) { $('#qhint').textContent = 'Камера недоступна. Загрузите фото кнопкой «Загрузить»'; } })();
}
function next(i, single) { if (single) { finish(); return editor(i); } if (i < VIEWS.length - 1 && !Q.views[VIEWS[i + 1].id]) return shoot(i + 1); finish(); track('test_done', { c: 'quick' }, false); editor(0); }
function finish() { cam.onFrame = null; stopCamera(); if (Q && Q.wasBack != null) { cam.back = Q.wasBack; } }
const firstOpen = () => Math.max(0, VIEWS.findIndex(v => Q.views[v.id] && !Q.views[v.id].ok));
// плохой кадр: показываем фото и причину, специалист решает переснять или оставить
function review(i, single) {
  const v = VIEWS[i], x = Q.views[v.id];
  const d = document.createElement('div'); d.className = 'cam-confirm';
  d.innerHTML = `<div style="width:100%"><img src="${x.photo}" alt="" style="display:block;max-height:46vh;margin:0 auto 12px;border-radius:12px"><div style="font-size:18px;font-weight:700;line-height:1.3">${esc(x.issue)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px"><button class="btn white" id="qre">Переснять</button><button class="cam-btn" id="qkeep">Оставить</button></div></div>`;
  ($('.qcam') || document.body).appendChild(d);
  d.querySelector('#qre').onclick = () => { d.remove(); shoot(i, single); };
  d.querySelector('#qkeep').onclick = () => { d.remove(); next(i, single); };
}

// ---------- 4. точки: правка касанием с лупой, сетка, отвес ----------
const LINES = { front: [[P.L_EAR, P.R_EAR], [P.L_SHOULDER, P.R_SHOULDER], [P.L_HIP, P.R_HIP], [P.L_HIP, P.L_KNEE], [P.L_KNEE, P.L_ANKLE], [P.R_HIP, P.R_KNEE], [P.R_KNEE, P.R_ANKLE]],
  right: [[P.R_EAR, P.R_SHOULDER], [P.R_SHOULDER, P.R_HIP], [P.R_HIP, P.R_KNEE], [P.R_KNEE, P.R_ANKLE]], left: [[P.L_EAR, P.L_SHOULDER], [P.L_SHOULDER, P.L_HIP], [P.L_HIP, P.L_KNEE], [P.L_KNEE, P.L_ANKLE]] };
LINES.back = LINES.front; LINES.squat = LINES.front.slice(1);
let showGrid = localStorage.getItem('bp_q_grid') === '1', showNums = localStorage.getItem('bp_q_nums') !== '0', showPlumb = localStorage.getItem('bp_q_plumb') !== '0';
function editor(i) {
  const v = VIEWS[i], x = Q.views[v.id];
  if (!x) { if (Q.editId) return; return shoot(i, true); }
  // следующий снятый ракурс по кругу (доп. снимок, если его нет, пропускаем)
  const nx = [1, 2, 3, 4, 5].map(d => (i + d) % VIEWS.length).find(k => Q.views[VIEWS[k].id]);
  go(`<div class="scr fade" style="padding-bottom:110px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Точки · ${v.name}</b>${Q.editId ? `<br><span class="sub" style="font-size:12px">Правка до ${new Date(Q.until).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}</div></div>
   <div class="pad" style="margin-top:8px"><div class="row" style="gap:6px">${VIEWS.map((w, k) => { const y = Q.views[w.id];
     return `<button data-v="${k}"${!y && Q.editId ? ' disabled' : ''} style="flex:1;height:58px;border-radius:12px;border:2px ${!y && w.opt ? 'dashed' : 'solid'} ${k === i ? 'var(--ink)' : 'var(--line)'};background:${y ? `center/cover url(${y.photo})` : 'var(--surface-2)'};position:relative;cursor:pointer" aria-label="${w.name}">${y && y.ok ? `<span style="position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#16A34A;color:#fff;display:grid;place-items:center">${ic('check', 's')}</span>` : ''}${!y ? `<span style="font-size:11px;color:var(--sub);line-height:1.2">${w.opt ? `+ ${w.short}<br>необяз.` : w.name}</span>` : ''}</button>`; }).join('')}</div>
    ${x.issue ? `<p style="font-size:13px;color:var(--over-t);margin-top:8px">${esc(x.issue)}</p>` : ''}
    <div id="qbox" style="position:relative;margin-top:10px;touch-action:pan-y;user-select:none;-webkit-user-select:none"><canvas id="qcv" style="width:100%;display:block;border-radius:14px;background:#111"></canvas><canvas id="qloupe" width="240" height="240" style="position:absolute;top:8px;left:8px;width:120px;height:120px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.4);display:none;pointer-events:none;z-index:3"></canvas>
      <button class="pill" id="qnextv" style="position:absolute;right:10px;top:10px;height:40px;font-weight:600;background:rgba(22,22,23,.78);color:#fff;border-color:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)">${nx > i ? 'Следующий снимок' : 'К первому снимку'} ${ic('chevron-right', 's')}</button></div>
    <p class="sub" style="font-size:13px;margin-top:6px">Проверьте точки. Неточную перетащите пальцем: лупа покажет место. ${v.opt ? 'Дополнительный снимок: проверьте точки таза, коленей и лодыжек.' : v.id === 'front' || v.id === 'back' ? 'Две точки у головы: на ушах, у козелка (хрящ перед слуховым проходом); сзади там же, по краю головы.' : 'Точка у головы: на ухе, у козелка (хрящ перед слуховым проходом).'}</p>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pill tog${showGrid ? ' on' : ''}" id="qgrid" aria-pressed="${showGrid}">Сетка</button><button class="pill tog${showPlumb ? ' on' : ''}" id="qplumb" aria-pressed="${showPlumb}">Отвес</button>${Q.editId ? '' : `<button class="pill" id="qretake">${ic('camera', 's')} Переснять</button>${v.opt ? `<button class="pill" id="qdrop">${ic('x', 's')} Убрать снимок</button>` : ''}`}</div>
    <div id="qm" style="margin-top:12px"></div>
   </div>
   <div class="dock"><button class="btn" id="qok">${ic('check', 's')}Все точки верны · ${VIEWS.filter(w => Q.views[w.id]).length} фото</button></div></div>`);
  const cv = $('#qcv'), lp = $('#qloupe'), img = new Image(); let drag = -1, s = 1;
  const pts = () => x.pts || [];
  const draw = () => { if (!img.complete) return; const W = cv.clientWidth * devicePixelRatio; s = W / x.w; cv.width = W; cv.height = x.h * s; const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, cv.width, cv.height);
    // сетка: квадратные клетки, светлая линия с темной подложкой видна и на светлой стене, и на темной одежде
    if (showGrid) { const cell = cv.width / 8, d = devicePixelRatio || 1; g.beginPath(); for (let gx = cell; gx < cv.width - 1; gx += cell) { g.moveTo(gx, 0); g.lineTo(gx, cv.height); } for (let gy = cell; gy < cv.height - 1; gy += cell) { g.moveTo(0, gy); g.lineTo(cv.width, gy); }
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.6 * d; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .6 * d; g.stroke(); }
    const p = pts(); if (!p.length) return;
    if (showPlumb) { const ax = v.id === 'right' ? p[P.R_ANKLE].x : v.id === 'left' ? p[P.L_ANKLE].x : (p[P.L_ANKLE].x + p[P.R_ANKLE].x) / 2; g.strokeStyle = '#FBBF24'; g.lineWidth = 1 * devicePixelRatio; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(ax * s, 0); g.lineTo(ax * s, cv.height); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = 'rgba(79,209,217,.95)'; g.lineWidth = 1.4 * devicePixelRatio;
    for (const [a, b] of LINES[v.id]) { g.beginPath(); g.moveTo(p[a].x * s, p[a].y * s); g.lineTo(p[b].x * s, p[b].y * s); g.stroke(); }
    for (const k of EDIT_POINTS[v.id]) { g.beginPath(); g.arc(p[k].x * s, p[k].y * s, (k === drag ? 8 : 5.5) * devicePixelRatio, 0, 7); g.fillStyle = k === drag ? '#FF7A45' : '#fff'; g.fill(); g.lineWidth = 1.5 * devicePixelRatio; g.strokeStyle = '#0E9AA7'; g.stroke(); }
    // подписи ушей: какие две точки у головы, видно сразу
    g.font = `600 ${11 * devicePixelRatio}px Inter, system-ui, sans-serif`; g.textBaseline = 'middle';
    const ears = EDIT_POINTS[v.id].filter(k => k === P.L_EAR || k === P.R_EAR), cx = v.id === 'right' ? 1e9 : v.id === 'left' ? -1e9 : ears.reduce((a, k) => a + p[k].x * s, 0) / ears.length;
    for (const k of ears) { const t = 'ухо', tw = g.measureText(t).width, out = p[k].x * s >= cx ? 1 : -1, d = devicePixelRatio, ex = p[k].x * s, ey = p[k].y * s;
      // подпись в стороне от лица: наружу от середины головы (сбоку — назад, к затылку)
      const tx = out > 0 ? ex + 34 * d : ex - 34 * d - tw, ty = ey - 18 * d;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .8 * d; g.beginPath(); g.moveTo(ex + out * 6 * d, ey - 3 * d); g.lineTo(out > 0 ? tx - 5 * d : tx + tw + 5 * d, ty); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(tx - 5 * devicePixelRatio, ty - 9 * devicePixelRatio, tw + 10 * devicePixelRatio, 18 * devicePixelRatio, 9 * devicePixelRatio); g.fill(); g.fillStyle = '#fff'; g.fillText(t, tx, ty); }
    g.textBaseline = 'alphabetic';
  };
  const metrics = () => { const m = viewMetrics(v.id, x.pts, x.w, x.h, x.roll, heightCm()); $('#qm').innerHTML = m ? metricRows(m) : '<p class="sub">Точки не найдены: переснимите фото или загрузите другое.</p>'; };
  const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * x.w, y: (e.clientY - r.top) / r.height * x.h, cx: e.clientX - r.left, cy: e.clientY - r.top, rw: r.width }; };
  const loupe = (q) => { const g = lp.getContext('2d'), z = 3, half = 120 / z / (cv.clientWidth / x.w); g.clearRect(0, 0, 240, 240);
    g.drawImage(img, q.x - half, q.y - half, half * 2, half * 2, 0, 0, 240, 240); g.strokeStyle = '#FF7A45'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 96); g.lineTo(120, 144); g.moveTo(96, 120); g.lineTo(144, 120); g.stroke();
    lp.style.display = 'block'; lp.style.left = q.cx < q.rw / 2 ? 'auto' : '8px'; lp.style.right = q.cx < q.rw / 2 ? '8px' : 'auto'; };
  // страница листается пальцем по фото; если палец лег на точку, прокрутку гасим и тянем точку
  const hold = e => { if (drag >= 0 && e.cancelable) e.preventDefault(); };
  cv.addEventListener('touchstart', hold, { passive: false }); cv.addEventListener('touchmove', hold, { passive: false });
  cv.addEventListener('pointerdown', e => { if (!x.pts) return; const q = at(e), r = 30 / (cv.clientWidth / x.w); let best = -1, bd = r;
    for (const k of EDIT_POINTS[v.id]) { const d = Math.hypot(x.pts[k].x - q.x, x.pts[k].y - q.y); if (d < bd) { bd = d; best = k; } }
    if (best < 0) return; drag = best; cv.setPointerCapture(e.pointerId); loupe({ ...q, x: x.pts[best].x, y: x.pts[best].y }); draw(); });
  cv.addEventListener('pointermove', e => { if (drag < 0) return; const q = at(e); x.pts[drag] = { ...x.pts[drag], x: Math.max(0, Math.min(x.w, q.x)), y: Math.max(0, Math.min(x.h, q.y)), visibility: 1, edited: true }; x.edited = true; loupe(q); draw(); metrics(); });
  const up = () => { if (drag < 0) return; drag = -1; lp.style.display = 'none'; draw(); metrics(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  img.onload = () => { draw(); metrics(); }; img.src = x.photo;
  // при первом показе ширина холста еще 0: перерисовываем, когда экран разложен
  new ResizeObserver(() => { if (cv.isConnected && drag < 0) draw(); }).observe(cv);
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => editor(+b.dataset.v));
  $('#qgrid').onclick = () => { showGrid = !showGrid; localStorage.setItem('bp_q_grid', showGrid ? '1' : '0'); $('#qgrid').classList.toggle('on', showGrid); $('#qgrid').setAttribute('aria-pressed', showGrid); draw(); };
  $('#qplumb').onclick = () => { showPlumb = !showPlumb; localStorage.setItem('bp_q_plumb', showPlumb ? '1' : '0'); $('#qplumb').classList.toggle('on', showPlumb); $('#qplumb').setAttribute('aria-pressed', showPlumb); draw(); };
  if ($('#qretake')) $('#qretake').onclick = () => { Q.wasBack = cam.back; cam.back = true; shoot(i, true); };
  $('#back').onclick = () => { if (Q.editId) { if (confirm('Выйти без сохранения правок?')) { const id = Q.client.id; Q = null; clientCard(id); } return; }
    if (confirm('Выйти без сохранения? Фото этого теста удалятся.')) { Q = null; proHome(); } };
  // «Следующий снимок»: этот вид проверен, к следующему; «Все точки верны» подтверждает сразу все фото
  $('#qnextv').onclick = () => { if (x.pts) x.ok = true; editor(nx); };
  if ($('#qdrop')) $('#qdrop').onclick = () => { delete Q.views[v.id]; editor(0); };
  // обязательны 4 ракурса; доп. снимок без точек просто не считается
  $('#qok').onclick = () => { const miss = REQ.findIndex(w => !Q.views[w.id] || !Q.views[w.id].pts);
    if (miss >= 0) { toast(Q.views[REQ[miss].id] ? `${REQ[miss].name}: точек нет, переснимите` : `Нет фото: ${REQ[miss].name.toLowerCase()}`); return miss === i ? null : editor(miss); }
    VIEWS.forEach(w => { if (Q.views[w.id]) Q.views[w.id].ok = true; }); Q.metrics = null; results(); };
}
const heightCm = () => +((Q && Q.client && Q.client.height) || 0) || 0;
const num = v => String(Math.abs(v)).replace('.', ',');
const metricRows = m => `<div class="group">${m.map(r => `<div class="row" style="min-height:52px;gap:10px;align-items:flex-start;padding:10px 14px"><span style="font:700 10px var(--font);letter-spacing:.06em;color:var(--src-measured);border:1px solid var(--line);border-radius:6px;padding:2px 5px;flex:none;margin-top:2px">ЗАМЕР</span><span style="flex:1;font-size:14px;line-height:1.35">${r.name}<br><span class="sub" style="font-size:13px">${r.dir}</span></span><b class="mt-val" style="font-size:15px;white-space:nowrap">${num(r.v)}${r.unit.trim() === '°' ? '°' : r.unit}</b></div>`).join('')}</div>`;

// ---------- 5. результат: фигура в позе клиента с зонами → что видно → замеры → вывод специалиста ----------
// статусы зон для специалиста (ТЗ v4, п. 3.5); клиент видит не статус, а задачу тренировки
const ZST = { WEAK: 'слабая', SHORT: 'зажатая', HYPER: 'перерастянутая' }, ZNEXT = { WEAK: 'SHORT', SHORT: 'HYPER', HYPER: 'WEAK' };
const ZCOL = matte() ? { WEAK: '#0A84FF', SHORT: '#FF453A', HYPER: '#FF9F0A' } : { WEAK: '#2563EB', SHORT: '#DC2626', HYPER: '#D97706' }, TCOL = matte() ? { WEAK: '#30D158', HYPER: '#66D4CF', SHORT: '#FF9F0A' } : { WEAK: '#F97316', HYPER: '#EAB308', SHORT: '#3B82F6' };
export const TASK = { WEAK: 'Укрепить', HYPER: 'Мягко укрепить', SHORT: 'Расслабить' };
const sideRu = s => s === 'RIGHT' ? 'справа' : s === 'LEFT' ? 'слева' : '';
const zoneName = z => (C.muscles[z.id] || {}).name || z.id;
const GAINS = [1, 1.5, 2, 3], VIEWS3 = [['front', 'Спереди'], ['right', 'Сбоку'], ['back', 'Сзади']];
/** Подсказки зон по существующим правилам проекта (bodymap, веса источников) для 4 фото.
 *  Пороги правил подобраны для теста по видео; на фото признак учитывается с 60% порога, но не меньше погрешности замера.
 *  Наклон головы вперед почти всегда выше порога и раньше забирал все места шеей: теперь из одного отдела тела
 *  (шея, плечевой пояс, корпус, таз, ноги) не больше 3 мышц, всего до 8 мышц (с двух сторон считается одной). Самые выраженные идут первыми. */
const RELAX = .6, FERR = { valgus_max: 5, pelvic_tilt: 1.5, shoulder_tilt: 1.5, head_tilt: 2, trunk_lateral: 1.5, head_forward: 4, knee_hyper: 3, shoulder_shift: .015, hip_shift: .015 };
const relax = (t, e) => t == null ? t : Math.sign(t) * Math.max(Math.abs(t) * RELAX, e);
const REGION = y => y < .23 ? 0 : y < .38 ? 1 : y < .52 ? 2 : y < .63 ? 3 : 4;
export function zonesOf(q) {
  try { const rules = C.bodymap.rules.map(r => FERR[r.feature] == null ? r : { ...r, absGreater: relax(r.absGreater, FERR[r.feature]), greater: relax(r.greater, FERR[r.feature]), less: relax(r.less, FERR[r.feature]) });
    const a = analyze({ snapshot: q.snapshot, side: q.side, moves: q.moves || {}, protocol: [] }, { ...C, bodymap: { ...C.bodymap, rules } });
    // мышца с двух сторон занимает одно место: иначе симметричная шея от наклона головы вперед вытесняла перекос таза и корпуса
    // (квадратная поясницы, косые). Одностороннее (перекос) идет раньше двустороннего при равной выраженности
    const seen = new Set(), mus = new Set(), per = [0, 0, 0, 0, 0], out = [], sp = topOf(spots(a)), two = id => sp.filter(x => x.id === id).length > 1;
    for (const s of sp.map((x, i) => [x, i + (two(x.id) ? 2 : 0)]).sort((x, y) => x[1] - y[1]).map(x => x[0])) { const k = s.id + ':' + s.side, r = REGION(s.y);
      if (seen.has(k)) continue; if (!mus.has(s.id)) { if (per[r] >= 3 || mus.size >= 8) continue; mus.add(s.id); per[r]++; } seen.add(k); out.push(s); }
    // перекос виден на фото, значит его главные мышцы в списке всегда: у слабых правил (корпус вбок) вес мал, и косые с квадратной не набирали порог
    const sn = q.snapshot || {}, f = { pelvic_tilt: sn.pelvicTilt, trunk_lateral: sn.trunkLateral, shoulder_tilt: sn.shoulderTilt, head_tilt: sn.headTilt }, lat = [];
    for (const r of rules) { const v = f[r.feature]; if (r.source !== 'camera' || r.absGreater == null || r.sideFrom !== r.feature || !Number.isFinite(v) || Math.abs(v) <= Math.abs(r.absGreater)) continue;
      const sg = Math.sign(v) * (r.sideNegate ? -1 : 1), side = sg > 0 ? 'RIGHT' : 'LEFT', opp = side === 'RIGHT' ? 'LEFT' : 'RIGHT';
      for (const m of r.muscles) { if (m.w < .4 || m.side === 'both' || !C.muscles[m.id]) continue; const sd = m.side === 'opposite' ? opp : side, key = m.id + ':' + sd;
        if (!seen.has(key)) { seen.add(key); lat.push({ id: m.id, side: sd, k: m.state === 'OVERLOAD' ? 'HYPER' : m.state, key }); } } }
    // ноги: ось колена в стойке (спереди и сзади) и в полуприседе в правила не попадала, поэтому ноги не показывались.
    // Колено внутрь: мышцы правила knee_valgus той же стороны; наружу: напряжены наружные, слабее приводящие
    const kv = (k, sq) => { const B = q.by || {}, ok = m => m && !m.suspect ? m.v : NaN, v = [(B.front || []), (B.back || [])].map(l => ok(l.find(m => m.key === k))).filter(Number.isFinite), st = v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
      const sv = ok((B.squat || []).find(m => m.key === sq)); return { st, sq: Number.isFinite(sv) ? sv : 0 }; };
    const valg = (rules.find(r => r.id === 'knee_valgus') || { muscles: [] }).muscles.filter(m => m.w >= .4), VAR = [['tfl', 'HYPER'], ['piriformis', 'SHORT'], ['adductors', 'WEAK']];
    const addM = (id, sd, k) => { const key = id + ':' + sd; if (C.muscles[id] && !seen.has(key)) { seen.add(key); lat.push({ id, side: sd, k, key }); } };
    for (const [k, sq, sd] of [['kneeR', 'squatKneeR', 'RIGHT'], ['kneeL', 'squatKneeL', 'LEFT']]) { const v = kv(k, sq);
      if (v.st > 6 || v.sq > 6) valg.forEach(m => addM(m.id, sd, m.state === 'OVERLOAD' ? 'HYPER' : m.state));
      else if (v.st < -6) VAR.forEach(([id, st]) => addM(id, sd, st)); }
    // база коррекции специалиста важнее общих правил: ее мышцы ставятся первыми, тот же мускул с той же стороны из правил не дублируется
    const pat = patternZones(q, kv), pk = new Set(pat.map(z => z.id + ':' + z.side));
    const base = [...pat, ...[...lat, ...out].filter(s => !pk.has(s.id + ':' + s.side)).map(s => ({ id: s.id, side: s.side, k: s.k, key: s.key }))];
    return [...base, ...chainZones(q, new Set(base.map(z => z.id + ':' + z.side)), new Set(base.map(z => z.id)), base)]; }
  catch (e) { return []; } }
/** Шаблоны базы коррекции (data/patterns.json), которые включаются сами по замеру: зажатые → «зажатая», слабые → «слабая».
 *  Поясница (наклон таза) и плечо (ротаторы) по 4 фото не измеряются: только вручную кнопкой «Шаблон». */
export function patternZones(q, kv) {
  const P = Object.fromEntries((C.patterns || []).map(p => [p.id, p])), B = q.by || {}, out = [], seen = new Set(), E = QERR;
  const avg = (views, k) => { const v = views.map(id => ((B[id] || []).find(m => m.key === k && !m.suspect) || {}).v).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  const put = (pid, tight, weak, c) => { const p = P[pid]; if (!p) return;
    for (const [ids, k, sides] of [[p.tight, 'SHORT', tight], [p.weak, 'WEAK', weak]]) for (const id of ids) for (const sd of sides) { const key = id + ':' + sd;
      if (!C.muscles[id] || seen.has(key)) continue; seen.add(key); out.push({ id, side: sd, k, key, p: pid, ...(c ? { c: 1 } : {}) }); } };
  const both = ['RIGHT', 'LEFT'], hf = avg(['right', 'left'], 'headForward'), sh = avg(['right', 'left'], 'shoulderShift'), hp = avg(['right', 'left'], 'hipShift'), pt = avg(['front', 'back'], 'pelvicTilt');
  if (hf > 12) put('neck', both, both);
  if (hp > E.hipShift && sh < 0) put('sway', both, both);
  // таз ниже справа: высокая (доминирующая, зажатая) сторона левая
  if (Math.abs(pt) > E.pelvicTilt) { const high = pt > 0 ? 'LEFT' : 'RIGHT'; put('pelvis_rot', [high], [high === 'RIGHT' ? 'LEFT' : 'RIGHT']); }
  if (kv) for (const [k, sq, sd] of [['kneeR', 'squatKneeR', 'RIGHT'], ['kneeL', 'squatKneeL', 'LEFT']]) { const v = kv(k, sq);
    if (v.st > 6 || v.sq > 6) put('knee', [sd], [sd]); if (v.st > 6) put('flat_foot', [sd], [sd], true); }
  return out;
}
/** Зоны «по цепочке»: не видны на фото напрямую, но следуют из измеренного положения по механике стойки.
 *  Отдельный лимит (до 5 мышц, ноги первыми), чтобы шея и плечи не вытесняли ноги. Помечены c:1, специалист проверяет руками.
 *  Основания (docs/clinical/chain_rules.md):
 *  - тело впереди лодыжек: икроножная и камбаловидная держат стойку, их активность растет с наклоном вперед (Fitzpatrick 1994, Loram 2005);
 *  - колени согнуты в стойке: нагрузка на четырехглавую растет ~4 % веса тела на градус сгибания (Hsu, Perry 1993);
 *  - таз впереди лодыжек, плечи позади таза (sway back по Kendall): задняя группа бедра укорочена, сгибатели бедра и наружная косая длинные;
 *  - корпус впереди таза: разгибатели спины держат наклон, передняя цепь (сгибатели бедра, прямая бедра) укорочена;
 *  - таз выше с одной стороны (Kendall): на высокой стороне бедро приведено (средняя и малая ягодичные длинные, приводящие короткие), на низкой напряжена напрягатель фасции. */
export function chainZones(q, seenKeys = new Set(), have = new Set(), base = []) {
  const B = q.by || {}, sv = k => { const v = ['right', 'left'].map(id => ((B[id] || []).find(m => m.key === k && !m.suspect) || {}).v).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  const fv = k => { const v = ['front', 'back'].map(id => ((B[id] || []).find(m => m.key === k && !m.suspect) || {}).v).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  const sh = sv('shoulderShift'), hp = sv('hipShift'), kn = sv('kneeHyper'), hf = sv('headForward'), pt = fv('pelvicTilt'), E = QERR, out = [];
  // одна функция, противоположные задачи: сгибатели бедра не бывают одновременно «слабые» (sway back) и «зажатые» (колено согнуто)
  const SYN = { iliopsoas: 'hipflex', rectus_fem: 'hipflex' }, pol = k => k === 'SHORT' ? 1 : k === 'WEAK' ? -1 : 0;
  const clash = (id, k) => SYN[id] && [...base, ...out].some(z => SYN[z.id] === SYN[id] && pol(z.k) * pol(k) < 0);
  const add = (id, k, sides = ['RIGHT', 'LEFT']) => { if (!C.muscles[id] || clash(id, k)) return; for (const sd of sides) { const key = id + ':' + sd; if (seenKeys.has(key)) continue; seenKeys.add(key); out.push({ id, side: sd, k, key, c: 1 }); } };
  const fwd = (Number.isFinite(sh) ? sh : 0) + (Number.isFinite(hp) ? hp : 0); // плечо относительно лодыжки, см
  // порядок = сила оснований: нагрузка на икры и бедро (измерения ЭМГ и сил), затем позы по Kendall
  if (fwd > 2 * E.shoulderShift || (hf > 2 * E.headForward && sh > E.shoulderShift)) { add('soleus', 'SHORT'); add('calf', 'SHORT'); }
  if (kn < -E.kneeHyper) add('rectus_fem', 'SHORT');
  if (Math.abs(pt) > E.pelvicTilt) { const low = pt > 0 ? 'RIGHT' : 'LEFT', high = low === 'RIGHT' ? 'LEFT' : 'RIGHT'; add('glute_min', 'WEAK', [high]); add('adductors', 'SHORT', [high]); add('tfl', 'SHORT', [low]); }
  if (kn < -E.kneeHyper) { add('iliopsoas', 'SHORT'); add('hamstrings', 'SHORT'); }
  if (hp > E.hipShift && sh < 0) { add('hamstrings', 'SHORT'); add('transversus', 'WEAK'); }
  if (sh > E.shoulderShift) { add('iliopsoas', 'SHORT'); add('rectus_fem', 'SHORT'); add('erector', 'HYPER'); add('multifidus', 'WEAK'); }
  // до 7 мест; икроножная с камбаловидной и две мышцы бедра занимают по одному; мышцы из основного списка не дублируем
  const slot = id => ({ soleus: 'calf' })[id] || id, mus = new Set(), ok = new Set();
  for (const z of out) { if (have.has(z.id)) continue; if (!mus.has(slot(z.id)) && mus.size >= 7) continue; mus.add(slot(z.id)); ok.add(z.id); }
  return out.filter(z => ok.has(z.id));
}
const sameZones = (x, y) => { const k = l => (l || []).map(z => z.id + ':' + z.side + ':' + z.k).sort().join(); return k(x) === k(y); };
/** Пересчет сохраненного теста по его точкам после обновления формул (ALGO): замеры, «что видно», фигура и отчет.
 *  Зоны: не правленные специалистом заменяются новой подсказкой; правленные остаются; у старых тестов (до учета правок)
 *  новые подсказки добавляются к имеющимся один раз. */
export async function refreshQuick(a) {
  if (!a || a.template !== 'quick' || !a.quick || a.quick.algo === ALGO || !C.bodymap) return false;
  const pose = await row('poses', a.id), ph = (pose || {}).photos || {}, views = {};
  // старые снимки без крена: оценка по фону один раз, сохраняется в снимок (фото и замеры станут ровными)
  let lv = false; for (const v of VIEWS) { const x = ph[v.id]; if (!x || !x.photo || x.roll || x.rollSrc) continue;
    try { const im = await imgOf(x.photo); x.roll = im ? estimateRoll(im, x.w, x.h, x.pts) : 0; } catch (e) { x.roll = 0; } x.rollSrc = x.roll ? 'image' : 'none'; lv = true; }
  if (lv) await _pro.put('poses', pose);
  for (const v of VIEWS) if (ph[v.id] && ph[v.id].pts) views[v.id] = ph[v.id];
  if (!Object.keys(views).length) { a.quick = { ...a.quick, algo: ALGO }; await _pro.put('assessments', a); return false; }
  const q = quickMetrics(views, a.quick.hSet ? a.quick.h : 0), auto = zonesOf(q), cur = a.quick.zones || [];
  let zones = cur, zEdit = a.quick.zEdit;
  if (zEdit === false || !cur.length) { zones = auto; zEdit = false; }
  else if (zEdit == null) { const have = new Set(cur.map(z => z.id + ':' + z.side)); zones = [...cur, ...auto.filter(z => !have.has(z.id + ':' + z.side))]; zEdit = true; }
  a.quick = { ...a.quick, by: q.by, obs: observations(q.by), zones: zones.map(({ id, side, k, key, c, p }) => ({ id, side, k, key, ...(c ? { c: 1 } : {}), ...(p ? { p } : {}) })), zEdit, algo: ALGO };
  a.snapshot = q.snapshot; a.side = q.side; await _pro.put('assessments', a); return true;
}
/** Фоном при открытии кабинета: все быстрые тесты старой версии расчета. */
export async function refreshAll() { let n = 0; for (const a of await _pro.all('assessments')) if (a.template === 'quick' && a.quick && a.quick.algo !== ALGO) { try { if (await refreshQuick(a)) n++; } catch (e) {} } return n; }
const zSpots = zones => zones.map(z => ({ ...z, key: z.key || z.id + ':' + z.side, tone: (z.k === 'WEAK' ? -1 : 1) * (z.c ? .45 : .75), back: (C.muscles[z.id] || {}).view === 'back' }));
// ---------- домашнее задание: по умолчанию из карточек подтвержденных зон, специалист правит список ----------
// Подбор по парам мышц: у каждой зоны свое упражнение и упражнение для ее антагониста.
// Зажата или перегружена: расслабить ее и укрепить антагониста (грудные → ромбовидные).
// Слабая: укрепить ее и расслабить того, кто ее перегружает (ягодицы → сгибатели бедра), затем в движении.
// Круги: сначала главное для каждой зоны, потом пары, потом движение; одна мышца с двух сторон идет парой упражнений.
export function chainEx(zones, max = 8) {
  const ex = id => C.exercises[id], out = [], why = {}, rank = {}, groups = new Map(), ORD = { SHORT: 0, WEAK: 1, HYPER: 2 };
  for (const z of zones || []) { const k = z.id + ':' + z.k; if (!groups.has(k)) groups.set(k, { id: z.id, k: z.k, sides: new Set() }); groups.get(k).sides.add(z.side === 'RIGHT' ? 'right' : 'left'); }
  const nm = id => ((C.muscles[id] || {}).name || id).toLowerCase(), rounds = [[], [], []];
  // зажатые и слабые по очереди: в домашку попадают и расслабление, и активация, даже когда зон много (протокол базы коррекции)
  const gs = [...groups.values()].sort((a, b) => ORD[a.k] - ORD[b.k]), sw = gs.filter(g => g.k !== 'WEAK'), wk = gs.filter(g => g.k === 'WEAK'), mixed = [];
  for (let i = 0; i < Math.max(sw.length, wk.length); i++) { if (sw[i]) mixed.push(sw[i]); if (wk[i]) mixed.push(wk[i]); }
  for (const g of mixed) { const m = C.muscles[g.id]; if (!m) continue;
    const p = m.plan || {}, ant = m.antagonist && C.muscles[m.antagonist];
    if (g.k === 'WEAK') { rounds[0].push([g, [...(p.isolate || []), ...(m.activate || [])], `${nm(g.id)}: укрепить`]);
      const subs = (p.subs || []).filter(x => C.muscles[x]).slice(0, 1).map(nm); rounds[1].push([g, p.release || [], subs.length ? `${subs.join(', ')}: расслабить, работает вместо «${nm(g.id)}»` : `${nm(g.id)}: снять перегруз`]); rounds[2].push([g, p.integrate || [], `${nm(g.id)}: в движении`]); }
    else { rounds[0].push([g, releaseFor(m, g.k, ex), `${nm(g.id)}: расслабить`]);
      // зажатую без антагониста в базе не укрепляем; перегруженную можно мягко
      if (ant) rounds[1].push([g, [...((ant.plan && ant.plan.isolate) || []), ...(ant.activate || [])], `${nm(m.antagonist)}: укрепить, пара к «${nm(g.id)}»`]);
      else if (g.k === 'HYPER') rounds[1].push([g, m.activate || [], `${nm(g.id)}: мягко укрепить`]); } }
  // не растягиваем то, что в плане слабое или перерастянутое: выпад для сгибателей бедра при sway back, где они слабые (аудит 31.10.2026)
  const long = new Set((zones || []).filter(z => z.k !== 'SHORT').map(z => z.id)), base = x => x.replace(/_(left|right|\{s\})$/, '');
  const hits = x => Object.entries(C.muscles).some(([id, m]) => long.has(id) && (m.relax || []).some(r => base(r) === base(x)));
  for (const r of rounds) for (const [g, list, reason] of r) for (const x of list) {
    if (/расслабить|снять/.test(reason) && hits(x)) continue;
    const ids = [...g.sides].map(sd => x.replace('{s}', sd)).filter((id, i, l) => ex(id) && l.indexOf(id) === i); if (!ids.length) continue;
    const add = ids.filter(id => !out.includes(id)); if (add.length && out.length + add.length <= max) { out.push(...add); add.forEach(id => { why[id] = reason; rank[id] = r === rounds[2] ? 2 : /расслабить|снять/.test(reason) ? 0 : 1; }); } break; }
  // порядок занятия: сначала расслабить зажатые, затем активировать слабые, в конце движение
  return { ids: out.map((id, i) => [id, i]).sort((x, y) => (rank[x[0]] - rank[y[0]]) || x[1] - y[1]).map(x => x[0]), why };
}
const autoEx = a => chainEx((a.quick || {}).zones || []).ids;
export const hwEx = a => (a.plan && Array.isArray(a.plan.ex) && a.plan.ex.length ? a.plan.ex : autoEx(a)).filter(id => C.exercises[id]).slice(0, 8);
const exLabel = id => C.exercises[id].title.split(' (')[0] + (id.endsWith('_right') ? ', правая' : id.endsWith('_left') ? ', левая' : '');
// левая и правая версии одного упражнения в отчете одной строкой
const exRows = ids => ids.map(id => C.exercises[id]).filter((e, i, l) => l.findIndex(x => x.title.split(' (')[0] === e.title.split(' (')[0]) === i);
const sameSet = (x, y) => x.length === y.length && x.every(id => y.includes(id));
const DAYMS = 864e5;
/** Блок в карточке клиента: что задано, дошло ли до клиента, как он занимается. */
let pulledAt = 0;
async function hwBlock(host, aid) {
  const a = await row('assessments', aid), c = await row('clients', a.clientId), ids = hwEx(a), hw = c.hw || null;
  const since = hw ? hw.at : Date.now() - 14 * DAYMS, log = ((c.progress && c.progress.vas) || []).filter(r => r.t >= since - DAYMS);
  const days = new Set(log.filter(r => (r.n || 0) > 0).map(r => new Date(r.t).toDateString())).size, pp = log.filter(r => r.pre != null && r.post != null);
  const avg = k => (pp.reduce((x, r) => x + r[k], 0) / pp.length).toFixed(1).replace('.', ',');
  const diff = hw && !sameSet(ids, hw.ex || []), fresh = hw && hw.seen && (hw.seenUpd || 0) >= (hw.upd || 0);
  const when = t => `${_pro.fmtDate(t)}, ${new Date(t).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`;
  const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней';
  // статус говорит только то, что известно: ссылку создали, клиент открыл, версия у него актуальная
  const status = !hw ? 'Не передана клиенту'
    : !hw.seen ? `<span class="mark WEAK"></span> Ссылка готова, клиент ещё не открывал`
    : `<span class="mark OK"></span> Клиент открыл ${when(hw.seen)}${fresh ? ', видит последнюю версию' : '. Новая версия появится у него, когда он откроет приложение'}.`;
  host.innerHTML = `<div class="eyebrow">Домашнее задание</div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      ${ids.length ? exRows(ids).map((e, n) => `<div class="row" style="font-size:15px;gap:10px;align-items:baseline"><b class="mono" style="color:var(--sub);width:18px">${n + 1}</b><span style="flex:1;min-width:0">${esc(e.title.split(' (')[0])}<small class="sub" style="display:block;font-size:12px;line-height:1.35">${esc(e.dose || '')}</small></span></div>`).join('') : '<p class="sub" style="font-size:14px">Пока пусто: отметьте зоны или выберите упражнения сами.</p>'}
      ${c.demo ? '<p class="sub" style="font-size:12px">Это пример. Настоящему клиенту домашка передается ссылкой или QR-кодом.</p>' : c.nocard ? '<p class="sub" style="font-size:12px">Чтобы передать домашку, заведите карточку клиента.</p>' : `<p class="sub" style="font-size:13px;line-height:1.45">${status}${diff ? '<br><b style="color:var(--short-t)">Вы изменили список: нажмите «Обновить у клиента».</b>' : ''}${hw && hw.seen ? `<br>Занимался ${days} ${plural(days)} из ${Math.max(1, Math.ceil((Date.now() - hw.at) / DAYMS))}${pp.length ? ` · боль до ${avg('pre')}, после ${avg('post')}` : ''}` : ''}</p>`}
      <div style="display:flex;flex-direction:column;gap:8px">${c.nocard || c.demo ? '' : `<button class="btn" id="hwgo" ${ids.length ? '' : 'disabled'}>${ic(diff ? 'rotate-ccw' : 'share', 's')}${!hw ? 'Передать клиенту' : diff ? 'Обновить у клиента' : 'Передать ещё раз'}</button>`}<button class="btn line" id="hwed">${ic('pencil', 's')}Изменить список</button></div>
    </div>`;
  host.querySelector('#hwed').onclick = () => hwPicker(a, () => hwBlock(host, aid));
  const go = host.querySelector('#hwgo'); if (go) go.onclick = async () => { if (hw && !diff) return handSheet(c, hwUrl(hw), hw.seen ? 'again' : 'new');
    go.disabled = true; go.textContent = 'Готовлю ссылку…'; await sendHw(aid); hwBlock(host, aid); };
  // ждем подтверждение «открыл»: забираем ящики не чаще раза в 30 секунд, пока карточка открыта
  if (hw && !fresh && Date.now() - pulledAt > 30e3) { pulledAt = Date.now(); pullResults().then(() => row('clients', c.id)).then(c2 => { if (c2 && c2.hw && (c2.hw.seen !== hw.seen || c2.hw.seenUpd !== hw.seenUpd) && host.isConnected) hwBlock(host, aid); }).catch(() => {}); }
}
const hwUrl = hw => location.origin + '/#rep=' + hw.id + '.' + hw.key;
function hwPicker(a, done) {
  const sel = new Set(hwEx(a)), d = document.createElement('div'); d.className = 'sheet';
  const list = Object.values(C.exercises).sort((x, y) => (sel.has(y.id) - sel.has(x.id)) || x.title.localeCompare(y.title));
  d.innerHTML = `<div style="max-height:86dvh;display:flex;flex-direction:column"><h2 style="font-size:20px">Домашнее задание</h2><p class="sub" style="font-size:13px;margin-top:4px">До 8 упражнений. Клиент увидит шаги, дозировку, что почувствует и чего избегать.</p>
    <input id="hwq" class="field" type="search" placeholder="Найти упражнение" style="margin-top:10px;height:44px" aria-label="Поиск упражнения">
    <div id="hwl" style="overflow:auto;margin-top:8px;flex:1">${list.map(e => `<label class="row" data-q="${esc([e.title, e.goal, e.category].filter(Boolean).join(' ').toLowerCase())}" style="padding:8px 0;font-size:15px;gap:10px"><input type="checkbox" data-e="${e.id}" ${sel.has(e.id) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--ink)"><span style="flex:1">${esc(exLabel(e.id))}</span><span class="sub" style="font-size:12px">${esc(e.dose || '')}</span></label>`).join('')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn line" id="hwauto">По замеру</button><button class="btn" id="hwok">Готово</button></div></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('#hwq').oninput = e => { const q = e.target.value.trim().toLowerCase(); d.querySelectorAll('[data-q]').forEach(l => { l.hidden = !!q && !l.dataset.q.includes(q); }); };
  d.querySelectorAll('[data-e]').forEach(b => b.onchange = () => { if (b.checked && sel.size >= 8) { b.checked = false; return toast('Не больше 8 упражнений'); } b.checked ? sel.add(b.dataset.e) : sel.delete(b.dataset.e); });
  const save = async ex => { a.plan = { text: '', ...(a.plan || {}), ex }; await _pro.put('assessments', a); d.remove(); done(); };
  d.querySelector('#hwauto').onclick = () => save([]); d.querySelector('#hwok').onclick = () => save([...sel]);
}
/** Отчет и домашка одной ссылкой. Первый раз ссылку отправляет специалист, дальше содержимое меняется по ней само. */
async function sendHw(aid) {
  const a = await row('assessments', aid), c = await row('clients', a.clientId), ph = (await row('poses', aid)) || {};
  if (!(await _pro.canTrack(c))) return; // домашка по ссылке = ведение клиента
  try { const cv = await renderReport(a, c, ph.photos || {}), author = (await _pro.meta('profile')) || _pro.author(), contact = (await _pro.meta('contact')) || '';
    const info = { name: c.name, date: _pro.fmtDate(a.date), author, contact, at: a.date, ex: hwEx(a), next: +a.nextDate || 0, note: String((a.plan && a.plan.text) || '').slice(0, 600),
      focus: taskGroups((a.quick || {}).zones).map(g => `${g.t}: ${g.list.join(', ')}`).slice(0, 3) };
    const { url, fresh } = await homeworkLink(c, cv, info); track('hw_sent', { c: fresh ? 'new' : 'update', n: info.ex.length }, false);
    handSheet(c, url, fresh ? 'new' : 'update');
  } catch (e) { toast('Не удалось отправить: ' + e.message); }
}
/** Как отдать ссылку клиенту: QR при встрече, Telegram, WhatsApp, другое приложение, копия. Почта и телефон клиента не нужны. */
function handSheet(c, url, mode = 'new') {
  const first = c.name.split(' ')[0], text = mode === 'update' ? `${first}, я обновил ваше домашнее задание. Откройте приложение BodyPassport или ссылку:` : `${first}, здравствуйте! Ваш замер и домашнее задание. Откройте ссылку и нажмите «Установить»: когда я поменяю упражнения, они обновятся сами.`;
  const q = qrcode(0, 'M'); q.addData(url, 'Byte'); q.make();
  const d = document.createElement('div'); d.className = 'sheet';
  const ch = (id, icon, t) => `<button class="btn line" id="${id}">${ic(icon, 's')}${t}</button>`;
  d.innerHTML = `<div><h2 style="font-size:20px">${mode === 'update' ? 'Сообщить клиенту' : 'Передать клиенту'}</h2>
    <p class="sub" style="font-size:13px;margin-top:4px">${mode === 'update' ? 'Новая версия сохранена. Клиент увидит её по прежней ссылке, когда откроет приложение. Можно написать ему, чтобы открыл сейчас.' : 'Клиент рядом: пусть наведёт камеру телефона на код. Иначе отправьте в мессенджер.'}</p>
    ${mode === 'update' ? '' : `<div style="background:#fff;border-radius:20px;padding:14px;margin:14px auto 0;width:min(240px,70vw)">${q.createSvgTag({ cellSize: 6, margin: 0, scalable: true })}</div>`}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">${ch('hwtg', 'message-square', 'Telegram')}${ch('hwwa', 'message-square', 'WhatsApp')}${navigator.share ? ch('hwsh', 'share', 'Другое') : ''}${ch('hwcp', 'download', 'Копировать')}</div>
    <p class="sub" style="font-size:12px;margin-top:10px">${mode === 'update' ? 'Когда клиент откроет, в карточке появится «видит последнюю версию».' : 'Когда клиент откроет ссылку, в карточке появится «Клиент открыл».'}</p>
    <button class="btn ghost" id="hwx" style="margin-top:6px;border:0">Готово</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'hwx') d.remove(); };
  const used = via => track('hw_sent', { c: 'via_' + via }, false), enc = encodeURIComponent;
  d.querySelector('#hwtg').onclick = () => { used('tg'); open(`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, '_blank', 'noopener'); };
  d.querySelector('#hwwa').onclick = () => { used('wa'); open(`https://wa.me/?text=${enc(text + ' ' + url)}`, '_blank', 'noopener'); };
  if (d.querySelector('#hwsh')) d.querySelector('#hwsh').onclick = () => { used('share'); navigator.share({ text, url }).catch(() => {}); };
  d.querySelector('#hwcp').onclick = async () => { used('copy'); try { await navigator.clipboard.writeText(text + ' ' + url); toast('Скопировано: вставьте в переписку с клиентом'); } catch (e) { prompt('Скопируйте ссылку', url); } };
  if (mode !== 'update') track('hw_sent', { c: 'qr_shown' }, false);
}
// клиенту: одна короткая фраза на показатель, без чисел (числа у специалиста и в «Измерено»)
const PLAIN = { headForward: ['Голова выдвинута вперед', 'Голова отведена назад'], headTilt: ['Голова наклонена к правому плечу', 'Голова наклонена к левому плечу'],
  shoulderTilt: ['Правое плечо ниже левого', 'Левое плечо ниже правого'], pelvicTilt: ['Таз: правая сторона ниже', 'Таз: левая сторона ниже'], trunkLateral: ['Корпус смещен вправо', 'Корпус смещен влево'],
  shoulderShift: ['Плечи впереди таза', 'Плечи позади таза'], hipShift: ['Таз смещен вперед', 'Таз смещен назад'], kneeHyper: ['Колени переразогнуты', 'Колени согнуты'],
  kneeR: ['Правое колено уходит внутрь', 'Правое колено уходит наружу'], kneeL: ['Левое колено уходит внутрь', 'Левое колено уходит наружу'],
  squatKneeR: ['В полуприседе правое колено уходит внутрь', 'В полуприседе правое колено уходит наружу'], squatKneeL: ['В полуприседе левое колено уходит внутрь', 'В полуприседе левое колено уходит наружу'],
  squatPelvis: ['В полуприседе таз перекошен: правая сторона ниже', 'В полуприседе таз перекошен: левая сторона ниже'] };
export function plainObs(by, max = 3) { const best = {};
  for (const v of VIEWS) for (const m of (by || {})[v.id] || []) { if (!isOut(m) || !PLAIN[m.key]) continue; const sc = Math.abs(m.v) / m.err; if (!best[m.key] || sc > best[m.key].sc) best[m.key] = { sc, t: PLAIN[m.key][m.v > 0 ? 0 : 1] }; }
  return Object.values(best).sort((a, b) => b.sc - a.sc).slice(0, max).map(x => x.t); }
/** Зоны языком задач, сгруппированные: «Укрепить: глубокие мышцы шеи, верх плеча справа». Одна зона с двух сторон пишется один раз. */
export function taskGroups(zones) { const g = new Map();
  for (const z of zones || []) { if (!g.has(z.k)) g.set(z.k, new Map()); const m = g.get(z.k), nm = ((C.muscles[z.id] || {}).zone || zoneName(z)).toLowerCase(); if (!m.has(nm)) m.set(nm, new Set()); m.get(nm).add(z.side); }
  return [...g].map(([k, m]) => ({ k, t: TASK[k], list: [...m].map(([nm, s]) => s.size > 1 ? nm : `${nm} ${sideRu([...s][0])}`.trim()) })); }
const REPORT_GAIN = 2; // усиление фигуры в отчете клиенту по умолчанию
const gainPlate = g => g > 1 ? `<div style="font-size:13px;font-weight:700;color:#B45309;background:#FEF3C7;border-radius:10px;padding:6px 10px;margin-top:8px">Показано с увеличением ×${String(g).replace('.', ',')}, не реальный масштаб</div>` : '';
// ---------- замеры на фото: линии, отвес и подписи отклонений прямо у суставов (паспорт, было → стало) ----------
const MONO = "'JetBrains Mono', ui-monospace, monospace", SANS = "Inter, -apple-system, system-ui, sans-serif";
// у какого сустава подписать показатель и с какой стороны тела ставить подпись
const ANCHOR = { headTilt: [[P.L_EAR, P.R_EAR], 'Голова'], shoulderTilt: [[P.L_SHOULDER, P.R_SHOULDER], 'Плечи'], pelvicTilt: [[P.L_HIP, P.R_HIP], 'Таз'], trunkLateral: [[P.L_SHOULDER, P.R_SHOULDER, P.L_HIP, P.R_HIP], 'Корпус'],
  headForward: [[P.L_EAR, P.R_EAR], 'Голова'], shoulderShift: [[P.L_SHOULDER, P.R_SHOULDER], 'Плечо'], hipShift: [[P.L_HIP, P.R_HIP], 'Таз'], kneeHyper: [[P.L_KNEE, P.R_KNEE], 'Колено'],
  kneeR: [[P.R_KNEE], 'Колено'], kneeL: [[P.L_KNEE], 'Колено'], squatKneeR: [[P.R_KNEE], 'Колено'], squatKneeL: [[P.L_KNEE], 'Колено'], squatPelvis: [[P.L_HIP, P.R_HIP], 'Таз'] };
const SIDE_PT = { right: { [P.L_EAR]: P.R_EAR, [P.L_SHOULDER]: P.R_SHOULDER, [P.L_HIP]: P.R_HIP, [P.L_KNEE]: P.R_KNEE }, left: { [P.R_EAR]: P.L_EAR, [P.R_SHOULDER]: P.L_SHOULDER, [P.R_HIP]: P.L_HIP, [P.R_KNEE]: P.L_KNEE } };
const loadedImg = new Map();
const imgOf = src => { if (!loadedImg.has(src)) loadedImg.set(src, new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; })); return loadedImg.get(src); };
/** Крен кадра по фону: стены, углы, двери и пол дают вертикали и горизонтали. Человек исключен (полоса по его точкам).
 *  Возвращает поправку в градусах (как roll датчика: levelled(pts, w, h, roll) делает кадр ровным) или 0, если фон не дает уверенной оценки. */
export function estimateRoll(src, w, h, pts) {
  const k = Math.min(1, 640 / Math.max(w, h)), W = Math.max(8, Math.round(w * k)), H = Math.max(8, Math.round(h * k)), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, W, H); const px = g.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = px[i * 4] * .299 + px[i * 4 + 1] * .587 + px[i * 4 + 2] * .114;
  let x0 = -1, x1 = -1; if (pts) { const xs = pts.filter(Boolean).map(p => p.x * k), a = Math.min(...xs), b = Math.max(...xs), pad = (b - a) * .35 + W * .04; x0 = a - pad; x1 = b + pad; }
  // тензор структуры по окну 15×15: голосуют только четкие прямые края (высокая когерентность), шум и фактура отсеиваются
  const N = W * H, XX = new Float32Array(N), YY = new Float32Array(N), XY = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x;
    const gx = L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1], gy = L[i + W - 1] + 2 * L[i + W] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - W] - L[i - W + 1];
    XX[i] = gx * gx; YY[i] = gy * gy; XY[i] = gx * gy; }
  const box = A => { const T = new Float32Array(N), O = new Float32Array(N), r = 7;
    for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x < W + r; x++) { if (x + r < W) s += A[y * W + x + r]; if (x - r - 1 >= 0) s -= A[y * W + x - r - 1]; if (x >= 0 && x < W) T[y * W + x] = s; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y < H + r; y++) { if (y + r < H) s += T[(y + r) * W + x]; if (y - r - 1 >= 0) s -= T[(y - r - 1) * W + x]; if (y >= 0 && y < H) O[y * W + x] = s; } } return O; };
  const SX = box(XX), SY = box(YY), SXY = box(XY), BIN = .25, R = 10, NB = Math.round(2 * R / BIN) + 1, hist = new Float32Array(NB);
  const wrap = a => ((a + 90) % 180 + 180) % 180 - 90;
  for (let y = 8; y < H - 8; y++) for (let x = 8; x < W - 8; x++) { if (x > x0 && x < x1) continue; const i = y * W + x, tr = SX[i] + SY[i]; if (tr < 225 * 1600) continue;
    const coh = Math.hypot(SX[i] - SY[i], 2 * SXY[i]) / tr; if (coh < .85) continue;
    const th = .5 * Math.atan2(2 * SXY[i], SX[i] - SY[i]) * 180 / Math.PI, tv = wrap(th), t2 = wrap(th + 90), wgt = Math.sqrt(tr) * coh;
    // вертикали (углы стен, двери) надежнее горизонталей: линия пола искажена перспективой
    if (Math.abs(tv) <= R) hist[Math.round((tv + R) / BIN)] += wgt; else if (Math.abs(t2) <= R) hist[Math.round((t2 + R) / BIN)] += wgt * .25; }
  const tot = hist.reduce((a, b) => a + b, 0); if (tot < 2e5) return 0;
  let best = 0, bi = 0; for (let i = 2; i < NB - 2; i++) { const s = hist[i - 2] + hist[i - 1] + hist[i] + hist[i + 1] + hist[i + 2]; if (s > best) { best = s; bi = i; } }
  // второй пик дальше 2° почти такой же: фон противоречит сам себе (стул, перспектива), кадр не трогаем
  let second = 0; for (let i = 2; i < NB - 2; i++) if (Math.abs(i - bi) * BIN > 2) second = Math.max(second, hist[i - 2] + hist[i - 1] + hist[i] + hist[i + 1] + hist[i + 2]);
  let sw = 0, sa = 0; for (let i = Math.max(0, bi - 4); i <= Math.min(NB - 1, bi + 4); i++) { sw += hist[i]; sa += hist[i] * (i * BIN - R); }
  const t = sw ? sa / sw : bi * BIN - R; // наклон линий фона; поправка обратная. Меньше 0,5°, неуверенный или спорный пик не трогаем
  return best / tot < .15 || second > .6 * best || Math.abs(t) < .5 || Math.abs(t) > 8 ? 0 : Math.round(-t * 10) / 10;
}
/** Фото вида с замерами. x: { photo, w, h, pts }, ms: показатели этого вида (quick-metrics). Холст 4:5, тело по центру. */
async function drawMeasure(cv, x, view, ms, compact = false, nums = true) {
  const im = x && x.photo ? await imgOf(x.photo) : null; if (!im || !cv.isConnected) return false;
  try { await Promise.all([document.fonts.load(`600 20px ${MONO}`), document.fonts.load(`500 20px ${SANS}`)]); } catch (e) {}
  // компактно (два фото рядом): холст крупнее при тех же размерах подписей, поэтому подписи относительно мельче
  const d = Math.min(2, devicePixelRatio || 1), W = Math.round(cv.clientWidth * d * (compact ? 1.7 : 1)) || 600, H = Math.round(W * 1.25); cv.width = W; cv.height = H;
  // кадр выровнен по горизонту: фото и точки повернуты на крен телефона (датчик или оценка по фону), как и в расчете замеров
  const deg = x.roll || 0, g = cv.getContext('2d'), pts = x.pts && deg ? levelled(x.pts, x.w, x.h, deg) : x.pts, ids = EDIT_POINTS[view];
  // кадр по телу: от макушки до стоп с запасом, пропорция холста
  let bx = 0, by = 0, bw = x.w, bh = x.h;
  if (pts) { const ys = ids.map(i => pts[i].y), xs = ids.map(i => pts[i].x), top = Math.min(...ys), bot = Math.max(...ys), span = bot - top;
    bh = Math.min(x.h, span * 1.5); bw = Math.min(x.w, bh * W / H); if (bw === x.w) bh = Math.min(x.h, bw * H / W);
    by = Math.max(0, Math.min(x.h - bh, top - Math.max(0, bh - span) * .7)); bx = Math.max(0, Math.min(x.w - bw, (Math.min(...xs) + Math.max(...xs)) / 2 - bw / 2)); }
  const sc = Math.min(W / bw, H / bh), ox = (W - bw * sc) / 2, oy = (H - bh * sc) / 2;
  g.fillStyle = '#1C1C1E'; g.fillRect(0, 0, W, H);
  // углы после поворота закрыты размытой копией фото: тело целиком в кадре, пустых клиньев нет
  if (deg) { g.save(); g.filter = 'blur(12px)'; g.drawImage(im, ox - bw * sc * .15, oy - bh * sc * .15, bw * sc * 1.3, bh * sc * 1.3); g.restore();
    g.save(); g.beginPath(); g.rect(ox, oy, bw * sc, bh * sc); g.clip(); g.translate(ox - bx * sc, oy - by * sc); g.scale(sc, sc); g.translate(x.w / 2, x.h / 2); g.rotate(deg * Math.PI / 180); g.drawImage(im, -x.w / 2, -x.h / 2); g.restore(); }
  else g.drawImage(im, bx, by, bw, bh, ox, oy, bw * sc, bh * sc);
  g.fillStyle = 'rgba(10,10,12,.22)'; g.fillRect(0, 0, W, H);
  // сетка как в правке точек (переключатель «Сетка» общий): тонкие квадратные клетки
  if (showGrid) { const cell = W / 8; g.beginPath(); for (let gx = cell; gx < W - 1; gx += cell) { g.moveTo(gx, 0); g.lineTo(gx, H); } for (let gy = cell; gy < H - 1; gy += cell) { g.moveTo(0, gy); g.lineTo(W, gy); }
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.6 * d; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .6 * d; g.stroke(); }
  if (!pts) return true;
  const X = i => ox + (pts[i].x - bx) * sc, Y = i => oy + (pts[i].y - by) * sc, CY = '#0EA5E9', AM = '#FF9F0A';
  const out = new Set(ms.filter(isOut).map(m => m.key));
  // отвес от середины стоп и горизонтали через плечи и таз
  const ax = view === 'right' ? X(P.R_ANKLE) : view === 'left' ? X(P.L_ANKLE) : (X(P.L_ANKLE) + X(P.R_ANKLE)) / 2;
  g.save(); g.shadowColor = 'rgba(14,165,233,.8)'; g.shadowBlur = 8 * d; g.strokeStyle = 'rgba(14,165,233,.9)'; g.lineWidth = 1 * d; g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, H); g.stroke(); g.restore();
  // скелет: сегмент с показателем вне погрешности янтарный
  const hot = { front: { [P.L_SHOULDER + ':' + P.R_SHOULDER]: 'shoulderTilt', [P.L_HIP + ':' + P.R_HIP]: 'pelvicTilt', [P.L_EAR + ':' + P.R_EAR]: 'headTilt',
    [P.R_HIP + ':' + P.R_KNEE]: 'kneeR', [P.R_KNEE + ':' + P.R_ANKLE]: 'kneeR', [P.L_HIP + ':' + P.L_KNEE]: 'kneeL', [P.L_KNEE + ':' + P.L_ANKLE]: 'kneeL' } }; hot.back = hot.front;
  hot.squat = { [P.L_HIP + ':' + P.R_HIP]: 'squatPelvis', [P.R_HIP + ':' + P.R_KNEE]: 'squatKneeR', [P.R_KNEE + ':' + P.R_ANKLE]: 'squatKneeR', [P.L_HIP + ':' + P.L_KNEE]: 'squatKneeL', [P.L_KNEE + ':' + P.L_ANKLE]: 'squatKneeL' };
  for (const [a, b] of LINES[view]) { const k = (hot[view] || {})[a + ':' + b], on = k && out.has(k);
    g.save(); g.shadowColor = on ? 'rgba(255,159,10,.7)' : 'rgba(14,165,233,.7)'; g.shadowBlur = 6 * d; g.strokeStyle = on ? AM : CY; g.lineWidth = 1.5 * d; g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke(); g.restore(); }
  const dots = () => { for (const i of ids) { g.beginPath(); g.arc(X(i), Y(i), 5.5 * d, 0, 7); g.fillStyle = 'rgba(14,165,233,.25)'; g.fill(); g.beginPath(); g.arc(X(i), Y(i), 3 * d, 0, 7); g.fillStyle = '#E0F2FE'; g.fill(); g.lineWidth = 1.5 * d; g.strokeStyle = CY; g.stroke(); } };
  // подписи: значение моноширинным в пилюле, под ней что это; по очереди слева и справа от тела
  const placed = [], ptsXY = ids.map(i => [X(i), Y(i)]); let side = 0;
  // тело по ширине (точки плюс запас на руки): подписи стараемся класть в поля слева и справа от него
  const bxs = ptsXY.map(q => q[0]), bpad = (Math.max(...bxs) - Math.min(...bxs)) * .3 + 10 * d, body = { l: Math.min(...bxs) - bpad, r: Math.max(...bxs) + bpad }, margin = { l: body.l, r: W - body.r };
  // голова: подписи не кладем на лицо, а ставим над головой (или под подбородком, если сверху мало места)
  const hp = [P.NOSE, P.L_EAR, P.R_EAR].filter(i => pts[i]), span = Math.max(...ids.map(Y)) - Math.min(...ids.map(Y));
  const hx = hp.reduce((a, i) => a + X(i), 0) / hp.length, hy = hp.reduce((a, i) => a + Y(i), 0) / hp.length;
  const head = { l: hx - span * .08, r: hx + span * .08, t: hy - span * .09, b: hy + span * .08 };
  const label = (k, m) => { const [pp, name] = ANCHOR[k] || []; if (!pp) return; const pi = pp.map(i => (SIDE_PT[view] || {})[i] ?? i);
    const axp = pi.reduce((s, i) => s + X(i), 0) / pi.length; let ayp = pi.reduce((s, i) => s + Y(i), 0) / pi.length, isOut = out.has(k);
    const v = `${num(m.v)}${m.unit.trim() === '°' ? '°' : m.unit.includes('см') ? ' см' : '%'}`;
    // в пределах погрешности: короткая зеленая пилюля «Плечи 0,8°» без пояснения
    if (!isOut && compact) return; // «было → стало»: два узких фото, только отклонения
    const tv = isOut ? v : `${name} ${v}`; g.font = `600 ${(isOut ? 15 : 13) * d}px ${MONO}`; const vw = g.measureText(tv).width + 20 * d;
    g.font = `500 ${12 * d}px ${SANS}`; const sub = m.dir.replace(' (переразгибание)', '').replace(' (согнуто)', '').replace(' сторона', '');
    // текст под значением переносится по словам, чтобы подпись помещалась в поле сбоку от тела
    const room = Math.max(vw, 112 * d, Math.min(W * .42, Math.max(margin.l, margin.r) - 18 * d)), wrap = []; for (const w of sub.split(' ')) { const t = wrap.length ? wrap[wrap.length - 1] + ' ' + w : w;
      if (wrap.length && g.measureText(t).width + 18 * d > room) wrap.push(w); else if (wrap.length) wrap[wrap.length - 1] = t; else wrap.push(w); }
    const lines = isOut ? [name, ...wrap] : [];
    const sw = lines.length ? Math.max(...lines.map(t => g.measureText(t).width)) + 18 * d : 0, subH = (6 + lines.length * 16) * d;
    // колено: подпись со своей стороны, снаружи ноги
    const bwid = Math.max(vw, sw), want = /nee[RL]$/.test(k) ? axp < W / 2 : side++ % 2 === 0 ? axp > W / 2 : axp <= W / 2, hh = compact || !isOut ? 28 * d : 31 * d + subH;
    // место подписи: у края кадра, без наложения на точки, другие подписи и лицо; ближе к суставу по высоте
    let best = null; for (const left of [want, !want]) { const lx = left ? 12 * d : W - bwid - 12 * d;
      for (let st = -24; st <= 24; st++) { const ly = Math.max(8 * d, Math.min(H - hh - 4 * d, ayp - 20 * d + st * 7 * d)), r = { x: lx - 6 * d, y: ly - 6 * d, w: bwid + 12 * d, h: hh + 12 * d };
        const hit = (x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
        const cost = ptsXY.filter(([x, y]) => hit(x, y)).length * 1000 + placed.filter(p => p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y).length * 800
          + (lx < head.r && lx + bwid > head.l && ly < head.b && ly + hh > head.t ? 600 : 0) + Math.max(0, Math.min(r.x + r.w, body.r) - Math.max(r.x, body.l)) / d * 3 + Math.abs(ly - (ayp - 20 * d)) / d + (left === want ? 0 : 40);
        if (!best || cost < best.cost) best = { cost, lx, ly, left }; } }
    const { lx, ly, left } = best, ly0 = ayp - 20 * d; placed.push({ x: lx, y: ly, w: bwid, h: hh });
    // подпись ушла с лица: выноска от макушки или подбородка, а не через лицо
    if (ly !== ly0 && axp > head.l && axp < head.r && ayp > head.t && ayp < head.b) ayp = ly < head.t ? head.t : head.b;
    g.strokeStyle = isOut ? 'rgba(255,159,10,.75)' : 'rgba(255,255,255,.35)'; g.lineWidth = 1 * d; g.beginPath(); g.moveTo(axp, ayp); g.lineTo(left ? lx + bwid : lx, ly + 14 * d); g.stroke();
    g.fillStyle = isOut ? 'rgba(58,36,6,.84)' : 'rgba(18,48,28,.84)'; g.beginPath(); g.roundRect(lx, ly, vw, 28 * d, 14 * d); g.fill();
    g.strokeStyle = isOut ? 'rgba(255,159,10,.55)' : 'rgba(48,209,88,.45)'; g.stroke(); g.fillStyle = isOut ? AM : '#30D158'; g.font = `600 ${(isOut ? 15 : 13) * d}px ${MONO}`; g.textBaseline = 'middle'; g.fillText(tv, lx + 10 * d, ly + 14.5 * d);
    if (!compact && isOut) { g.fillStyle = 'rgba(28,28,30,.8)'; g.beginPath(); g.roundRect(lx, ly + 31 * d, sw, subH, 11 * d); g.fill(); g.fillStyle = '#E5E5EA'; g.font = `500 ${12 * d}px ${SANS}`; lines.forEach((t, n) => g.fillText(t, lx + 9 * d, ly + (42.5 + n * 16) * d)); }
    g.textBaseline = 'alphabetic'; };
  // сначала вне погрешности (главное), потом остальные
  if (nums) for (const m of [...ms].sort((a, b) => (out.has(b.key) ? 1 : 0) - (out.has(a.key) ? 1 : 0))) label(m.key, m);
  dots(); // точки поверх подписей: специалист всегда видит, куда они поставлены
  return true;
}
/** «План»: одна строка на мышцу и задачу (стороны вместе): задача, мышца, цепочка упражнений.
 *  Касание раскрывает тест руками, технику, смену статуса и «Убрать». Заменяет прежние «Что делать», «Гипотезу» и список зон. */
const patName = id => ((C.patterns || []).find(p => p.id === id) || {}).name;
const zGroups = zones => { const g = new Map(); for (const z of zones) { const k = z.id + ':' + z.k; if (!g.has(k)) g.set(k, []); g.get(k).push(z); } return [...g]; };
function planBlock(zones, open = new Set()) {
  const rows = zGroups(zones).map(([key, l]) => { const z = l[0], m = C.muscles[z.id] || {}, sd = l.length > 1 ? '' : ' ' + sideRu(z.side);
    const ex = m.name ? exRows(chainEx(l, 3).ids).map(e => esc(e.title.split(' (')[0])).join(' → ') : '', more = [m.proTest && `<b>Проверка:</b> ${esc(m.proTest)}`, z.k !== 'WEAK' && m.massage && `<b>Руками:</b> ${esc(m.massage)}`].filter(Boolean);
    return `<details data-pg="${key}" style="padding:9px 0;border-top:1px solid var(--line-2)"${open.has(key) ? ' open' : ''}><summary style="display:block;position:relative;padding-right:24px;list-style:none;cursor:pointer;font-size:15px;line-height:1.35"><span style="position:absolute;right:0;top:4px;color:var(--sub)">${ic('chevron-down', 's')}</span><span class="pill" style="font-size:12px;padding:2px 8px;margin-right:6px;color:${TCOL[z.k]};border-color:${TCOL[z.k]}">${TASK[z.k]}</span><b>${esc(zoneName(z))}</b><span class="sub">${sd}</span>${(() => { const tag = l[0].p && patName(l[0].p) ? `база: ${esc(patName(l[0].p))}` : l.every(x => x.c) ? 'по цепочке' : ''; return ex || tag ? `<div class="sub" style="font-size:13px;margin-top:3px">${tag ? `<span style="color:var(--ink);opacity:.8">${tag}</span>` + (ex ? ' · ' : '') : ''}${ex}</div>` : ''; })()}</summary>
      ${more.length ? `<div class="sub" style="font-size:13px;line-height:1.4;margin-top:6px">${more.join('<br>')}</div>` : ''}
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${Object.keys(ZST).map(k => `<button class="pill" data-pk="${k}" style="height:32px;font-size:12px;padding:0 10px;${k === z.k ? `color:${ZCOL[k]};border-color:${ZCOL[k]};font-weight:600` : 'opacity:.7'}">${ZST[k]}</button>`).join('')}<span style="flex:1"></span><button class="round" data-px aria-label="Убрать зону" style="width:32px;height:32px">${ic('x', 's')}</button></div></details>`; });
  return `<div class="card" style="padding:12px 16px 12px"><div class="row"><b style="flex:1">План</b><span class="sub" style="font-size:12px">${rows.length ? 'гипотеза, проверьте руками' : ''}</span></div>
    ${rows.join('') || '<div class="sub" style="font-size:14px;padding:8px 0">По замеру выраженных зон нет</div>'}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px"><button class="btn line" id="qadd" style="height:44px;font-size:14px;padding:0 6px">${ic('plus', 's')}Зона</button><button class="btn line" id="qtpl" style="height:44px;font-size:14px;padding:0 6px">${ic('file-text', 's')}Шаблон</button><button class="btn line" id="qauto" style="height:44px;font-size:14px;padding:0 6px">${ic('rotate-ccw', 's')}Замер</button></div></div>`;
}
/** «Проверьте замер»: значения вне физиологии (не учтены) и расхождение правого и левого бока больше двух погрешностей
 *  (снимок не строго в профиль или поворот головы). Такие места специалист смотрит до выводов. */
const checkCard = by => { const f = v => String(Math.abs(v)).replace('.', ','), rows = [];
  for (const v of VIEWS) for (const m of by[v.id] || []) if (m.suspect) rows.push(`${esc(m.name)}: <span class="mono">${f(m.v)}${m.unit.trim() === '°' ? '°' : ' ' + m.unit.trim()}</span> вне физиологии, не учтено. Проверьте точки или переснимите`);
  for (const k of ['headForward', 'shoulderShift', 'hipShift', 'kneeHyper']) { const r = (by.right || []).find(m => m.key === k), l = (by.left || []).find(m => m.key === k);
    if (r && l && !r.suspect && !l.suspect && Math.abs(r.v - l.v) > 2 * r.err) rows.push(`${esc(r.name)}: справа <span class="mono">${f(r.v)}</span>, слева <span class="mono">${f(l.v)}</span>${r.unit.trim() === '°' ? '°' : ' ' + r.unit.trim()}. Бока расходятся: снимок не строго в профиль или поворот. В расчете среднее`); }
  return rows.length ? `<div class="card" style="padding:12px 16px;border:1px solid var(--short-t,#FF9F0A)"><b style="font-size:15px">Проверьте замер</b>${rows.map(t => `<p class="sub" style="font-size:13px;line-height:1.4;margin-top:6px">${t}</p>`).join('')}</div>` : ''; };
/** Что видно: показатели вне погрешности, самые заметные первыми; значение и погрешность моноширинным. */
const obsRows = by => { const r = []; for (const v of VIEWS) for (const m of by[v.id] || []) if (isOut(m)) r.push({ v, m, sc: Math.abs(m.v) / m.err });
  return r.sort((a, b) => b.sc - a.sc).slice(0, 4).map(({ v, m }) => `<div class="row" style="gap:10px;align-items:center;padding:12px 14px;min-height:56px"><span style="flex:1;font-size:15px;line-height:1.3">${m.name}<br><span class="sub" style="font-size:13px">${v.name} · ${m.dir}</span></span><span class="mt-val" style="font-size:15px;white-space:nowrap;color:#FF9F0A">${num(m.v)}${m.unit.trim() === '°' ? '°' : m.unit}</span></div>`).join(''); };
/** Блок результата (после теста и в карточке клиента): сцена «3D | Фото» с ракурсами, «Усилить», гипотезы по задачам,
 *  зоны со статусами, что видно, все замеры. st: { by, zones, gain, h }; photos: { front: { photo, w, h, pts }, … }. */
function panel(host, st, { onChange = () => {}, onNoFig = () => {}, photos = {} } = {}) {
  const n = VIEWS.reduce((s, v) => s + (st.by[v.id] || []).length, 0), out = VIEWS.reduce((s, v) => s + (st.by[v.id] || []).filter(isOut).length, 0);
  const hasPh = VIEWS.some(v => photos[v.id] && photos[v.id].pts); let v3 = null, mode = '3d', view = 'front';
  const pose = () => poseOf({ by: st.by, h: st.h || 170 }, st.gain);
  host.innerHTML = `<div class="card" id="qfcard" style="padding:12px">
      ${hasPh ? `<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="seg" id="qmode" style="width:auto;flex:none"><button data-md="3d" class="on" style="padding:0 18px">3D</button><button data-md="ph" style="padding:0 18px">Фото</button></div><span style="flex:1"></span><button class="pill tog${showNums ? ' on' : ''}" id="qpnum" aria-pressed="${showNums}" style="display:none;height:34px">Цифры</button><button class="pill tog${showGrid ? ' on' : ''}" id="qpgrid" aria-pressed="${showGrid}" style="display:none;height:34px">Сетка</button><span class="mt-tag n" id="qmlbl">Типовая фигура</span></div>` : ''}
      <div id="q3d" style="height:min(58vh,420px);margin-top:10px"></div><canvas id="qph" style="width:100%;display:none;margin-top:10px;border-radius:22px"></canvas>
      <div class="seg" id="qview" style="margin-top:10px">${VIEWS.filter(v => !v.opt || (photos[v.id] && photos[v.id].pts)).map((v, i) => `<button data-vw="${v.id}" class="${i ? '' : 'on'}" style="padding:0 6px">${v.short || v.name}</button>`).join('')}</div>
      <div id="qgr"><div class="row" style="gap:10px;margin-top:10px"><span class="sub" style="font-size:13px;flex:none">Усилить</span><div class="seg" id="qgain" style="flex:1">${GAINS.map(g => `<button data-g="${g}" class="${g === st.gain ? 'on' : ''}" style="padding:0 6px">×${String(g).replace('.', ',')}</button>`).join('')}</div></div><div id="qplate">${gainPlate(st.gain)}</div></div>
      <div class="sub" id="qcap" style="font-size:12px;text-align:center;margin-top:8px">Типовая фигура, цветом зоны</div></div>
    ${checkCard(st.by)}<div id="qplan"></div><div class="qslot" style="display:contents"></div>
    <details class="acc"><summary style="font-weight:600;font-size:15px"><span>Замеры · вне погрешности <span class="mono">${out}</span> из <span class="mono">${n}</span></span></summary><div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">${out ? `<div><div class="eyebrow">Главное</div><div class="group" style="padding:0">${obsRows(st.by)}</div></div>` : ''}${VIEWS.filter(v => st.by[v.id]).map(v => `<div><div class="eyebrow">${v.name}</div>${metricRows(st.by[v.id])}</div>`).join('')}</div></details>
    <p class="mt-cal">Поправка на крен телефона учтена · погрешности замера в методике</p>`;
  const $h = s => host.querySelector(s);
  const opened = new Set();
  const plan = () => { $h('#qplan').innerHTML = planBlock(st.zones, opened);
    host.querySelectorAll('[data-pg]').forEach(el => { const key = el.dataset.pg, [gid, gk] = key.split(':'), mine = z => z.id === gid && z.k === gk;
      el.ontoggle = () => el.open ? opened.add(key) : opened.delete(key);
      el.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { const k = b.dataset.pk; if (k === gk) return; st.zones.forEach(z => { if (mine(z)) z.k = k; }); opened.delete(key); opened.add(gid + ':' + k); changed(); });
      el.querySelector('[data-px]').onclick = () => { st.zones = st.zones.filter(z => !mine(z)); opened.delete(key); changed(); }; });
    $h('#qauto').onclick = () => { if (st.zones.length && !confirm('Заменить зоны подсказкой по замеру? Ваши правки зон пропадут.')) return; st.zones = zonesOf(summaryOf(st.by, st.h === 170 ? 0 : st.h)); changed(); toast('Зоны пересчитаны'); };
    $h('#qtpl').onclick = () => patternSheet(zs => { const rest = st.zones.filter(x => !zs.some(z => x.id === z.id && x.side === z.side)); st.zones = [...rest, ...zs]; changed(); toast('Шаблон добавлен в план'); });
    $h('#qadd').onclick = () => addZone(zs => { const rest = st.zones.filter(x => !zs.some(z => x.id === z.id && x.side === z.side)); if (new Set([...rest, ...zs].map(z => z.id)).size > 20) return toast('Не больше 20 мышц'); st.zones = [...rest, ...zs]; changed(); }); };
  const changed = () => { if (v3) v3.update(zSpots(st.zones)); plan(); onChange(st); };
  plan();
  const photoView = () => (md => { const r = (photos[view] || {}).roll; if (mode === 'ph') $h('#qcap').textContent = (r ? `Кадр выровнен на ${String(Math.abs(r)).replace('.', ',')}°${(photos[view] || {}).rollSrc === 'image' ? ' по линиям фона' : ''} · ` : '') + 'касание фото: цифры'; })() || drawMeasure($h('#qph'), photos[view], view, st.by[view] || [], false, showNums).then(ok => { if (!ok && $h('#qph')) { const c = $h('#qph').getContext('2d'); c.clearRect(0, 0, 1e4, 1e4); } });
  const setMode = md => { mode = md; host.querySelectorAll('[data-md]').forEach(x => x.classList.toggle('on', x.dataset.md === md));
    $h('#q3d').style.display = md === '3d' ? '' : 'none'; $h('#qph').style.display = md === 'ph' ? 'block' : 'none'; $h('#qgr').style.display = md === '3d' ? '' : 'none';
    if ($h('#qmlbl')) $h('#qmlbl').style.display = md === '3d' ? '' : 'none';
    for (const id of ['#qpgrid', '#qpnum']) if ($h(id)) $h(id).style.display = md === 'ph' ? '' : 'none';
    $h('#qcap').textContent = md === '3d' ? 'Типовая фигура, цветом зоны' : 'Касание фото: убрать или показать цифры';
    if (md === 'ph') photoView(); else if (v3) v3.look(view === 'squat' ? 'front' : view); };
  host.querySelectorAll('[data-md]').forEach(b => b.onclick = () => setMode(b.dataset.md));
  const nums = () => { showNums = !showNums; localStorage.setItem('bp_q_nums', showNums ? '1' : '0'); $h('#qpnum').classList.toggle('on', showNums); $h('#qpnum').setAttribute('aria-pressed', showNums); photoView(); };
  if ($h('#qpnum')) { $h('#qpnum').onclick = nums; $h('#qph').onclick = nums; }
  if ($h('#qpgrid')) $h('#qpgrid').onclick = () => { showGrid = !showGrid; localStorage.setItem('bp_q_grid', showGrid ? '1' : '0'); $h('#qpgrid').classList.toggle('on', showGrid); $h('#qpgrid').setAttribute('aria-pressed', showGrid); photoView(); };
  host.querySelectorAll('[data-vw]').forEach(b => b.onclick = () => { view = b.dataset.vw; host.querySelectorAll('[data-vw]').forEach(x => x.classList.toggle('on', x === b)); if (mode === 'ph') photoView(); else if (v3) v3.look(view === 'squat' ? 'front' : view); });
  host.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { st.gain = +b.dataset.g; host.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); $h('#qplate').innerHTML = gainPlate(st.gain); if (v3) v3.pose(pose()); onChange(st); });
  // без WebGL2 3D-фигуры нет: остаются фото с замерами (если есть) или блок прячется
  body3D($h('#q3d'), zSpots(st.zones), key => { const z = st.zones.find(x => (x.key || x.id + ':' + x.side) === key); if (z) toast(`${zoneName(z)} ${sideRu(z.side)}: ${ZST[z.k]}`); }, { pose: pose() })
    .then(api => { v3 = api; }).catch(() => { if (hasPh) { setMode('ph'); const m = $h('#qmode'); if (m) m.remove(); } else { const f = $h('#qfcard'); if (f) f.remove(); } onNoFig(); });
}
function results() {
  const q = Q.metrics || quickMetrics(Q.views, heightCm()); Q.metrics = q; Q.obs = observations(q.by);
  if (!Q.zones) Q.zones = zonesOf(q); if (!Q.gain) Q.gain = 1; if (Q.gainPdf == null) Q.gainPdf = true;
  go(`<div class="scr fade" style="padding-bottom:150px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>${esc(Q.client.nocard ? 'Замер' : Q.client.name)}</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:16px;margin-top:8px"><div id="qpanel" style="display:flex;flex-direction:column;gap:16px"></div>
    <div><div class="eyebrow">Ваш вывод · ГИПОТЕЗА</div><textarea id="qcon" class="field" rows="3" maxlength="1200" placeholder="Необязательно. В отчете будет с пометкой «гипотеза специалиста»" style="height:auto;padding:12px 16px">${esc(Q.note || '')}</textarea></div>
    <div><div class="eyebrow">Рекомендации</div><textarea id="qrec" class="field" rows="2" maxlength="1200" placeholder="Необязательно: упражнения из карточек зон добавятся сами" style="height:auto;padding:12px 16px">${esc(Q.rec || '')}</textarea></div>
    <label class="row" id="qgl" style="gap:10px;font-size:14px"><input type="checkbox" id="qgpdf"${Q.gainPdf ? ' checked' : ''} style="width:20px;height:20px"> В отчете фигура с усилением перекосов, ×${String(Q.gain > 1 ? Q.gain : REPORT_GAIN).replace('.', ',')} (с пометкой «усилено»)</label>
   </div>
   <div class="dock"><button class="btn line" id="qshow">${ic('maximize', 's')}Показать клиенту</button><button class="btn" id="qsave" style="margin-top:8px">${ic('file-text', 's')}${Q.editId ? 'Сохранить правку' : 'Сохранить и отчет'}</button></div></div>`);
  const st = { by: q.by, zones: Q.zones, gain: Q.gain, h: heightCm() || 170 };
  panel($('#qpanel'), st, { photos: Q.views, onChange: s => { Q.zones = s.zones; Q.gain = s.gain; }, onNoFig: () => { const l = $('#qgl'); if (l) l.remove(); } });
  const keep = () => { Q.note = $('#qcon').value.trim(); Q.rec = $('#qrec').value.trim(); Q.gainPdf = !!($('#qgpdf') && $('#qgpdf').checked); };
  $('#qshow').onclick = () => { keep(); showClient(st, Q.client.nocard ? '' : Q.client.name); };
  $('#back').onclick = () => { keep(); editor(3); };
  $('#qsave').onclick = async () => { keep(); const id = await save(); if (id) report(id); };
}
/** Шаблоны из базы коррекции специалиста (data/patterns.json): паттерн → зажатые и слабые мышцы. Только в кабинете. */
let patterns = null;
async function patternSheet(onAdd) {
  try { patterns = patterns || C.patterns || (await (await fetch('data/patterns.json')).json()).patterns; } catch (e) { return toast('Шаблоны не загрузились, проверьте сеть'); }
  const d = document.createElement('div'); d.className = 'sheet'; let side = 'RIGHT';
  const nm = id => esc(((C.muscles[id] || {}).name || id).toLowerCase());
  d.innerHTML = `<div style="max-height:86dvh;overflow:auto"><h2 style="font-size:20px">Шаблон</h2><p class="sub" style="font-size:13px;margin-top:4px">Из вашей базы коррекции. Рабочая гипотеза: подтвердите мышечными тестами и ретестом. Клиент увидит только задачи.</p>
    <div class="group" style="margin-top:12px">${patterns.map((p, i) => `<button class="row-link" data-pt="${i}" style="text-align:left"><span style="flex:1"><b style="font-weight:600">${esc(p.name)}</b><br><small class="sub" style="font-size:12px">Расслабить: ${p.tight.map(nm).join(', ')}<br>Укрепить: ${p.weak.map(nm).join(', ')}<br>${p.auto ? `Сам по замеру: ${esc(p.auto.toLowerCase())}` : 'Только вручную: по фото не измеряется'}</small></span>${ic('chevron-right', 's chev')}</button>`).join('')}</div>
    <div id="ptside" style="display:none;margin-top:12px"><b style="font-size:15px">Где зажато (доминирующая сторона)?</b><div class="seg" style="margin-top:8px"><button data-sd="RIGHT" class="on">Справа</button><button data-sd="LEFT">Слева</button></div><button class="btn" id="ptok" style="margin-top:10px">Добавить</button></div>
    <button class="btn ghost" id="ptx" style="margin-top:8px;border:0">Отмена</button></div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.id === 'ptx') d.remove(); };
  const both = ['RIGHT', 'LEFT'], opp = s => s === 'RIGHT' ? 'LEFT' : 'RIGHT';
  const apply = p => { const zs = []; const put = (id, k, sds) => { if (C.muscles[id]) for (const sd of sds) zs.push({ id, side: sd, k, key: id + ':' + sd, p: p.id }); };
    p.tight.forEach(id => put(id, 'SHORT', p.lateral ? [side] : both)); p.weak.forEach(id => put(id, 'WEAK', p.lateral ? [opp(side)] : both));
    track('pattern_add', { c: p.id }, false); d.remove(); onAdd(zs); };
  d.querySelectorAll('[data-sd]').forEach(b => b.onclick = () => { side = b.dataset.sd; d.querySelectorAll('[data-sd]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { const p = patterns[+b.dataset.pt]; if (!p.lateral) return apply(p);
    d.querySelector('#ptside').style.display = ''; d.querySelector('#ptok').onclick = () => apply(p); d.querySelector('#ptside').scrollIntoView({ block: 'nearest' }); });
}
function addZone(onAdd) {
  const ids = Object.keys(C.muscles).filter(id => C.muscles[id].name).sort((a, b) => C.muscles[a].name.localeCompare(C.muscles[b].name, 'ru'));
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">Добавить зону</h2>
    <select id="zm" class="field" style="margin-top:12px">${ids.map(id => `<option value="${id}">${esc(C.muscles[id].name)}</option>`).join('')}</select>
    <div class="seg" id="zsd" style="margin-top:10px"><button data-s="BOTH" class="on">С двух сторон</button><button data-s="RIGHT">Справа</button><button data-s="LEFT">Слева</button></div>
    <div class="seg" id="zk" style="margin-top:10px">${Object.entries(ZST).map(([k, t], i) => `<button data-k="${k}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div>
    <button class="btn" id="zok" style="margin-top:14px">Добавить</button><button class="btn ghost" id="zx" style="margin-top:8px;border:0">Отмена</button></div>`;
  document.body.appendChild(d); let side = 'BOTH', k = 'WEAK';
  d.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { side = b.dataset.s; d.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; d.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelector('#zx').onclick = () => d.remove();
  d.querySelector('#zok').onclick = () => { const id = d.querySelector('#zm').value; d.remove(); onAdd((side === 'BOTH' ? ['RIGHT', 'LEFT'] : [side]).map(s => ({ id, side: s, k, key: id + ':' + s }))); };
}
/** «Показать клиенту»: полный экран, крутящаяся фигура с зонами в цветах задач, 2–3 коротких фразы и задачи. Без кнопок специалиста. */
function showClient(st, name) {
  const d = document.createElement('div'), obs = plainObs(st.by), groups = taskGroups(st.zones);
  d.style.cssText = 'position:fixed;inset:0;z-index:60;background:' + (matte() ? '#161617' : '#080C13') + ';color:#fff;overflow:auto;padding:calc(env(safe-area-inset-top) + 16px) 20px calc(env(safe-area-inset-bottom) + 24px)';
  d.innerHTML = `<button id="scx" aria-label="Закрыть" style="position:absolute;z-index:2;right:16px;top:calc(env(safe-area-inset-top) + 12px);width:48px;height:48px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:22px">✕</button>
    <div style="font-size:15px;opacity:.7;min-height:18px">${esc(name || '')}</div><div style="font-size:28px;font-weight:800;line-height:1.1;margin-top:4px;padding-right:56px">Ваше положение тела</div>
    <div id="sc3" style="height:min(54vh,460px);margin-top:14px"></div>
    <div class="seg" id="scv" style="margin-top:10px">${VIEWS3.map(([v, t], i) => `<button data-vw="${v}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div>
    ${st.gain > 1 ? `<div style="font-size:15px;font-weight:700;color:#FDE68A;margin-top:10px">Показано с увеличением ×${String(st.gain).replace('.', ',')}, не реальный масштаб</div>` : ''}
    ${obs.length ? `<div style="font-size:14px;opacity:.7;margin-top:18px">Что видно на фото</div>${obs.map(t => `<div style="font-size:20px;font-weight:700;line-height:1.3;margin-top:6px">${t}</div>`).join('')}` : ''}
    ${groups.length ? `<div style="font-size:14px;opacity:.7;margin-top:18px">Над чем работаем · гипотеза специалиста</div>${groups.map(g => `<div style="font-size:19px;line-height:1.35;margin-top:8px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${TCOL[g.k]};margin-right:8px"></span><b>${g.t}:</b> ${esc(g.list.join(', '))}</div>`).join('')}` : ''}
    <div style="font-size:13px;opacity:.55;margin-top:22px">Положение тела в момент фото на типовой фигуре. Цветом отмечены зоны для работы. Не диагноз.</div>`;
  document.body.appendChild(d); let v3 = null; d.querySelector('#scx').onclick = () => { if (v3) v3.dispose(); d.remove(); };
  asClient(() => body3D(d.querySelector('#sc3'), zSpots(st.zones), null, { pose: poseOf({ by: st.by, h: st.h || 170 }, st.gain), noMarks: true }))
    .then(api => { v3 = api; d.querySelectorAll('[data-vw]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-vw]').forEach(x => x.classList.toggle('on', x === b)); api.look(b.dataset.vw); }); })
    .catch(() => { d.querySelector('#sc3').remove(); d.querySelector('#scv').remove(); });
  track('screen', { c: 'show_client' }, false);
}
/** Карточка клиента: тот же блок, что после быстрого теста. Правка зон сохраняется в оценку. */
export async function quickCard(host, aid, prevId) {
  await refreshQuick(await row('assessments', aid));
  const a = await row('assessments', aid), c = await row('clients', a.clientId), qz = a.quick || {};
  const st = { by: qz.by || {}, zones: (qz.zones || []).map(z => ({ ...z })), gain: 1, h: qz.h || 170 }, es = await editState(a);
  // действия под рукой: отчет, показать клиенту, было → стало (до повторного теста кнопка видна, но неактивна)
  const tool = (id, icon, t, off) => `<button class="tool" id="${id}"${off ? ' disabled style="opacity:.45"' : ''}>${ic(icon)}<span>${t}</span></button>`;
  host.innerHTML = `<div class="pad" style="margin-top:12px;display:flex;flex-direction:column;gap:16px"><div class="row" style="gap:8px"><b style="flex:1;font-size:17px">Быстрый тест · ${_pro.fmtDate(a.date)}</b></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${tool('qcrep', 'share', 'Отчет клиенту')}${tool('qcshow', 'maximize', 'Показать клиенту')}${tool('qccmp', 'arrow-right-left', 'Было → стало', !prevId)}</div>
    ${es.ok ? `<button class="btn line" id="qcedit">${ic('pencil', 's')}Поправить точки · до ${new Date(es.until).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</button>` : ''}
    ${editNote(a) ? `<p class="sub" style="font-size:12px;margin-top:-8px">${esc(editNote(a))}</p>` : ''}
    <div id="qcp" style="display:flex;flex-direction:column;gap:16px"></div>
    ${a.note ? `<div><div class="eyebrow">Ваш вывод · ГИПОТЕЗА</div><div class="card" style="font-size:15px;line-height:1.45;white-space:pre-line">${esc(a.note)}</div></div>` : ''}</div>`;
  panel(host.querySelector('#qcp'), st, { photos: ((await row('poses', aid)) || {}).photos || {}, onChange: async s => { a.quick = { ...a.quick, zones: s.zones.map(({ id, side, k, key, c, p }) => ({ id, side, k, key, ...(c ? { c: 1 } : {}), ...(p ? { p } : {}) })), confirmed: true, zEdit: !sameZones(s.zones, zonesOf(summaryOf(st.by, qz.hSet ? qz.h : 0))) }; await _pro.put('assessments', a); hwBlock(host.querySelector('#qhw'), aid); } });
  const hwh = document.createElement('div'); hwh.id = 'qhw'; hwh.style.cssText = 'display:flex;flex-direction:column;gap:8px'; host.querySelector('.qslot').appendChild(hwh);
  hwBlock(hwh, aid);
  host.querySelector('#qcrep').onclick = () => report(aid);
  if (host.querySelector('#qcedit')) host.querySelector('#qcedit').onclick = () => editSaved(aid);
  host.querySelector('#qcshow').onclick = () => showClient(st, c && !c.nocard ? c.name : '');
  if (prevId) host.querySelector('#qccmp').onclick = () => quickCompare(prevId, aid);
}
/** «Было → стало» двух быстрых тестов: фото с замерами (или фигуры) рядом и изменение каждого показателя с учетом погрешности. */
export async function quickCompare(prevId, curId) {
  const A = await row('assessments', prevId), B = await row('assessments', curId), qa = A.quick || {}, qb = B.quick || {};
  const pa = ((await row('poses', prevId)) || {}).photos || {}, pb = ((await row('poses', curId)) || {}).photos || {};
  const rows = []; for (const v of VIEWS) for (const m of (qb.by || {})[v.id] || []) { const p = ((qa.by || {})[v.id] || []).find(x => x.key === m.key); if (!p) continue;
    const d = Math.abs(m.v) - Math.abs(p.v), same = Math.abs(m.v - p.v) <= m.err; rows.push({ v, m, p, d, same }); }
  // сначала изменения больше погрешности, потом остальные
  rows.sort((x, y) => (x.same - y.same) || Math.abs(y.d) - Math.abs(x.d));
  const u = m => m.unit.trim() === '°' ? '°' : m.unit.includes('см') ? ' см' : '%';
  const tag = r => r.same ? '<span class="mt-tag n">без изменений</span>' : `<span class="mt-tag ${r.d < 0 ? 'g' : 'a'}">${r.d < 0 ? 'меньше' : 'больше'}</span>`;
  const hasPh = VIEWS.some(v => pa[v.id] && pb[v.id]); let mode = hasPh ? 'ph' : '3d', view = 'front';
  go(`<div class="scr fade" style="padding-bottom:40px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Было → стало</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:16px;margin-top:8px">
    <div class="card" id="cmpf" style="padding:12px">${hasPh ? '<div class="seg" id="cmpm" style="width:auto;display:inline-flex"><button data-md="ph" class="on" style="padding:0 18px">Фото</button><button data-md="3d" style="padding:0 18px">3D</button></div>' : ''}
     <div class="row" style="justify-content:center;gap:8px;margin-top:10px;align-items:flex-start">${[A, B].map((x, i) => `<div style="flex:1;max-width:230px;text-align:center"><div class="row" style="justify-content:center;gap:6px;margin-bottom:6px"><b style="font-size:14px">${i ? 'После' : 'До'}</b><span class="sub mono" style="font-size:12px">${new Date(x.date).toLocaleDateString('ru')}</span></div><canvas id="cmp${i}" style="width:100%;aspect-ratio:4/5;border-radius:18px;background:#1C1C1E"></canvas></div>`).join('')}</div>
     <div class="seg" id="cmpv" style="margin-top:10px">${VIEWS.filter(v => !v.opt || (pa[v.id] && pb[v.id])).map((v, i) => `<button data-vw="${v.id}" class="${i ? '' : 'on'}" style="padding:0 6px">${v.short || v.name}</button>`).join('')}</div></div>
    <div><div class="eyebrow">Изменения</div><div class="group" style="padding:0">${rows.map(r => `<div class="row" style="gap:10px;align-items:center;padding:12px 14px"><span style="flex:1;font-size:14px;line-height:1.35">${r.m.name}<br><span class="sub" style="font-size:12px">${r.v.name}</span></span><span style="text-align:right;line-height:1.5"><span class="mt-val" style="font-size:14px">${num(r.p.v)}${u(r.m)} → ${num(r.m.v)}${u(r.m)}</span><br>${tag(r)}</span></div>`).join('') || '<div class="row sub" style="padding:12px 14px">Нет общих замеров</div>'}</div></div>
    <button class="btn" id="cmprep">${ic('share', 's')}Отчет клиенту: до и после</button>
    <p class="mt-cal">«Без изменений»: разница в пределах погрешности замера · «меньше»: отклонение от вертикали уменьшилось</p>
    ${[['До', A], ['После', B]].filter(([, x]) => editNote(x)).map(([t, x]) => `<p class="mt-cal">${t}: ${esc(editNote(x).toLowerCase())}</p>`).join('')}</div></div>`);
  $('#back').onclick = () => clientCard(B.clientId);
  $('#cmprep').onclick = async () => { const b = $('#cmprep'); b.disabled = true; try { await reportCompare(prevId, curId); } finally { b.disabled = false; } };
  const draw = async () => { for (const [i, x, ph] of [[0, qa, pa], [1, qb, pb]]) { const cv = $('#cmp' + i); if (!cv) return;
    if (mode === 'ph') { await drawMeasure(cv, ph[view], view, (x.by || {})[view] || [], true); continue; }
    const im = await posedFigure(zSpots(x.zones || []), poseOf({ by: x.by || {}, h: x.h || 170 }, 1), view === 'squat' ? 'front' : view, 400, 880); if (!im) { if (!hasPh) { const f = $('#cmpf'); if (f) f.remove(); } return; }
    cv.width = 400; cv.height = 500; const g = cv.getContext('2d'), fw = 500 * 400 / 880; g.clearRect(0, 0, 400, 500); g.strokeStyle = '#0EA5E9'; g.lineWidth = 2; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(200, 0); g.lineTo(200, 500); g.stroke(); g.setLineDash([]); g.drawImage(im, 200 - fw / 2, 0, fw, 500); } };
  draw();
  document.querySelectorAll('#cmpv [data-vw]').forEach(b => b.onclick = () => { view = b.dataset.vw; document.querySelectorAll('#cmpv [data-vw]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  document.querySelectorAll('#cmpm [data-md]').forEach(b => b.onclick = () => { mode = b.dataset.md; document.querySelectorAll('#cmpm [data-md]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  track('screen', { c: 'quick_compare' }, false);
}
async function save() {
  if (Q.editId) return saveEdit();
  const c = Q.client, old = await row('clients', c.id);
  if (!old) await _pro.put('clients', { ...c }); else if ((Q.consent && !Q.consent.reused) || c.height !== old.height || c.weight !== old.weight) await _pro.put('clients', { ...old, ...(Q.consent && !Q.consent.reused ? { consent: Q.consent } : {}), height: c.height || old.height || '', weight: c.weight || old.weight || '' });
  const id = _pro.uid(), q = Q.metrics, prev = (await _pro.all('assessments')).filter(a => a.clientId === c.id).sort((a, b) => b.date - a.date)[0];
  const a = { id, clientId: c.id, date: Q.date, template: 'quick', templateName: 'Быстрый тест', quick: { by: q.by, obs: Q.obs, zones: Q.zones.map(({ id, side, k, key, c, p }) => ({ id, side, k, key, ...(c ? { c: 1 } : {}), ...(p ? { p } : {}) })), confirmed: true, algo: ALGO, zEdit: !sameZones(Q.zones, zonesOf(q)), gain: Q.gain > 1 ? Q.gain : REPORT_GAIN, gainOff: !Q.gainPdf, h: heightCm() || 170, hSet: !!heightCm(), kg: +c.weight || null, views: VIEWS.filter(v => Q.views[v.id]).map(v => v.id), edited: VIEWS.filter(v => Q.views[v.id] && Q.views[v.id].edited).map(v => v.id) },
    snapshot: q.snapshot, side: q.side, consent: Q.consent, note: Q.note, plan: { ex: [], text: Q.rec }, protocol: [], moves: {}, quality: {}, limits: {}, setup: {}, pain: {}, hyp: {}, check: {}, draft: false, prevId: prev ? prev.id : null, savedAt: Date.now() };
  await _pro.put('assessments', a);
  await _pro.put('poses', { assessmentId: id, photos: Object.fromEntries(VIEWS.filter(v => Q.views[v.id]).map(v => { const x = Q.views[v.id]; return [v.id, { photo: x.photo, w: x.w, h: x.h, pts: x.pts, auto: x.auto || null, roll: x.roll, rollSrc: x.rollSrc || null }]; })) });
  track('assess_done', { n: a.quick.views.length, c: 'quick' }, false);
  if (prev) track('retest_done', { n: Math.round((Q.date - prev.date) / 864e5) }, false);
  if (prev && Q.date - prev.date <= 14 * 864e5) track('retest_14d', null, false);
  return id;
}

// ---------- правка точек сохраненного теста ----------
// Защита клиента от подгонки: правка только 2 часа после сохранения и только пока нет более позднего теста этого клиента;
// фото не переснять, автоточки хранятся, каждая правка записывается и видна в отчете и в «Было → стало».
const EDIT_WIN = 2 * 3600e3;
const hm = t => new Date(t).toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export async function editState(a) {
  const t0 = a.savedAt || a.date, now = Date.now();
  if ((await _pro.all('assessments')).some(b => b.clientId === a.clientId && b.id !== a.id && b.date > a.date)) return { ok: false, why: 'Точки закрыты: у клиента есть более поздний тест' };
  // часы телефона переведены назад: правку тоже закрываем
  if (now < t0 - 6e4 || now > t0 + EDIT_WIN) return { ok: false, why: 'Точки закрыты: правка возможна 2 часа после сохранения' };
  return { ok: true, until: t0 + EDIT_WIN };
}
async function editSaved(aid) {
  const a = await row('assessments', aid), c = await row('clients', a.clientId), ps = await row('poses', aid), es = await editState(a);
  if (!es.ok) return toast(es.why); if (!ps || !ps.photos) return toast('Фото этого теста нет на телефоне');
  const qz = a.quick || {};
  Q = { client: c, date: a.date, editId: aid, until: es.until, consent: a.consent, zones: (qz.zones || []).map(z => ({ ...z })), gain: qz.gain || 1, gainPdf: !qz.gainOff, note: a.note || '', rec: (a.plan && a.plan.text) || '',
    views: Object.fromEntries(Object.entries(ps.photos).map(([k, x]) => [k, { ...x, pts: x.pts && x.pts.map(p => ({ ...p })), ok: true, edited: false }])) };
  editor(0);
}
async function saveEdit() {
  const a = await row('assessments', Q.editId), ps = await row('poses', Q.editId), es = await editState(a), cid = Q.client.id;
  if (!es.ok) { toast(es.why + '. Правка не сохранена'); Q = null; clientCard(cid); return null; }
  const q = Q.metrics, views = VIEWS.filter(v => Q.views[v.id] && Q.views[v.id].edited).map(v => v.id);
  a.quick = { ...a.quick, by: q.by, obs: Q.obs, zones: Q.zones.map(({ id, side, k, key, c, p }) => ({ id, side, k, key, ...(c ? { c: 1 } : {}), ...(p ? { p } : {}) })), gain: Q.gain > 1 ? Q.gain : REPORT_GAIN, gainOff: !Q.gainPdf,
    edited: [...new Set([...(a.quick.edited || []), ...views])], edits: views.length ? [...(a.quick.edits || []), { at: Date.now(), views }] : a.quick.edits || [] };
  Object.assign(a, { snapshot: q.snapshot, side: q.side, note: Q.note, plan: { ...(a.plan || {}), text: Q.rec } });
  for (const v of views) ps.photos[v].pts = Q.views[v].pts;
  await _pro.put('assessments', a); await _pro.put('poses', ps);
  if (views.length) track('points_edit', { n: views.length }, false);
  Q = null; return a.id;
}
const editNote = a => { const e = ((a.quick || {}).edits || []).at(-1); return e ? `Точки поправлены после сохранения: ${hm(e.at)}` : ''; };

// ---------- 6. отчет: PDF и картинка ----------
export async function quickResult(aid) { return report(aid); }
async function report(aid) {
  const a = await row('assessments', aid), c = await row('clients', a.clientId), ph = (await row('poses', aid)) || {};
  const cv = await renderReport(a, c, ph.photos || {});
  shareSheet(cv, `bodypassport-${(c.nocard ? 'zamer' : c.name).replace(/[^\p{L}\p{N}]+/gu, '-')}-${new Date(a.date).toISOString().slice(0, 10)}`, c, 'quick', undefined, aid);
}
/** Отчет «До и после» двух быстрых тестов: фото рядом, что изменилось больше погрешности, над чем работаем дальше. */
async function reportCompare(prevId, curId) {
  const A = await row('assessments', prevId), B = await row('assessments', curId), c = await row('clients', B.clientId);
  const pa = ((await row('poses', prevId)) || {}).photos || {}, pb = ((await row('poses', curId)) || {}).photos || {};
  const cv = await renderCompare(A, B, c, pa, pb);
  shareSheet(cv, `bodypassport-do-posle-${(c.nocard ? 'zamer' : c.name).replace(/[^\p{L}\p{N}]+/gu, '-')}-${new Date(B.date).toISOString().slice(0, 10)}`, c, 'compare', 'Отчет: до и после');
}
function shareSheet(cv, base, c, kind, title = 'Отчет клиенту', aid = null) {
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">${title}</h2><p class="sub" style="font-size:13px;margin-top:4px">Так его увидит клиент.</p>
    <div style="margin-top:12px;max-height:50dvh;overflow:auto;border-radius:16px;border:1px solid var(--line)"><img src="${cv.toDataURL('image/jpeg', .8)}" alt="Отчет" style="width:100%;display:block"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button class="btn" id="qpdf">${ic('file-text', 's')}PDF</button><button class="btn line" id="qpng">${ic('image', 's')}Картинка</button></div>
    ${aid && !c.nocard && !c.demo ? `<button class="btn" id="qhwl" style="margin-top:8px">${ic('mail', 's')}${c.hw ? 'Обновить отчет и домашку у клиента' : 'Ссылкой: отчет и домашка'}</button>` : ''}
    <button class="btn ghost" id="qcard" style="margin-top:8px;border:0">${kind === 'compare' ? 'Закрыть' : c.nocard ? 'В кабинет' : 'К карточке клиента'}</button></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); if (kind !== 'compare') c.nocard ? proHome() : clientCard(c.id); };
  d.onclick = e => { if (e.target === d) close(); }; d.querySelector('#qcard').onclick = close;
  const send = async (blob, name, type, fmt) => { const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Замер осанки' }); } catch (e) {} } else { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = name; l.click(); }
    track('report_shared', { c: kind + '_' + fmt }, false);
    if (!localStorage.getItem('bp_first_report')) { localStorage.setItem('bp_first_report', String(Date.now())); track('first_report', null, false); const g = await import('./grow.js'); setTimeout(() => g.installSheet(_pro.backup), 1200); } };
  d.querySelector('#qpdf').onclick = async () => { const b = d.querySelector('#qpdf'); b.disabled = true; b.textContent = 'Собираю PDF…';
    try { const { canvasToPdf } = await import('./pdf.js'); await send(await canvasToPdf(cv, 'BodyPassport'), base + '.pdf', 'application/pdf', 'pdf'); } catch (e) { toast('Не удалось собрать PDF: ' + e.message); }
    b.disabled = false; b.innerHTML = `${ic('file-text', 's')}PDF`; };
  d.querySelector('#qpng').onclick = async () => send(await new Promise(r => cv.toBlob(r, 'image/png')), base + '.png', 'image/png', 'png');
  if (d.querySelector('#qhwl')) d.querySelector('#qhwl').onclick = async () => { const b = d.querySelector('#qhwl'); b.disabled = true; b.textContent = 'Отправляю…'; await sendHw(aid); close(); };
}

const loadImg = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
function wrap(g, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t; }
  if (line) { g.fillText(line, x, y); y += lh; } return y; }
/** Отчет 1080 px шириной: шапка, 4 фото с линиями, ЗАМЕР, что видно, ГИПОТЕЗА специалиста, рекомендации, юридическая строка. */
/** Фото в отчете: обрезка по телу, отвес, линии и точки как у специалиста. */
function tile(g, im, p, view, x0, y, cw, ch, LN) { const pts = p.pts;
    let bx = 0, by = 0, bw = p.w, bh = p.h; if (pts) { const ys = EDIT_POINTS[view].map(i => pts[i].y), xs = EDIT_POINTS[view].map(i => pts[i].x); const top = Math.min(...ys), bot = Math.max(...ys), hh = (bot - top) * 1.35, cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      bh = Math.min(p.h, hh); bw = Math.min(p.w, bh / 2); by = Math.max(0, Math.min(p.h - bh, top - (bot - top) * .2)); bx = Math.max(0, Math.min(p.w - bw, cx - bw / 2)); }
    g.save(); g.beginPath(); g.roundRect(x0, y, cw, ch, 18); g.clip(); g.fillStyle = '#111'; g.fillRect(x0, y, cw, ch);
    const sc = Math.min(cw / bw, ch / bh), dw = bw * sc, dh = bh * sc, ox = x0 + (cw - dw) / 2, oy = y + (ch - dh) / 2; g.drawImage(im, bx, by, bw, bh, ox, oy, dw, dh);
    if (pts) { const X = i => ox + (pts[i].x - bx) * sc, Y = i => oy + (pts[i].y - by) * sc;
      const ax = view === 'right' ? pts[P.R_ANKLE].x : view === 'left' ? pts[P.L_ANKLE].x : (pts[P.L_ANKLE].x + pts[P.R_ANKLE].x) / 2;
      g.strokeStyle = '#FBBF24'; g.lineWidth = 2; g.setLineDash([7, 6]); g.beginPath(); g.moveTo(ox + (ax - bx) * sc, y); g.lineTo(ox + (ax - bx) * sc, y + ch); g.stroke(); g.setLineDash([]);
      g.strokeStyle = LN; g.lineWidth = 3; for (const [m, n] of LINES[view]) { g.beginPath(); g.moveTo(X(m), Y(m)); g.lineTo(X(n), Y(n)); g.stroke(); }
      for (const i of EDIT_POINTS[view]) { g.beginPath(); g.arc(X(i), Y(i), 5, 0, 7); g.fillStyle = '#fff'; g.fill(); } }
  g.restore(); }
export async function renderReport(a, c, photos) {
  // Matte: Inter, числа JetBrains Mono, голубой акцент; v3: прежние Manrope и бирюза
  const M = matte(), W = 1080, PAD = 64, F = M ? 'Inter, system-ui, sans-serif' : 'Manrope, system-ui, sans-serif', MN = "'JetBrains Mono', ui-monospace, monospace", INK = M ? '#1D1D1F' : '#0B1B3B', SUB = M ? '#6E6E73' : '#566079', VIO = M ? '#0284C7' : '#0E7C86', LN = M ? '#0EA5E9' : '#11A3AE', BAND = M ? '#161617' : '#0B1B3B';
  try { await Promise.all([document.fonts.load(`600 24px ${MN}`), document.fonts.load(`700 24px ${F}`)]); } catch (e) {}
  const author = (await _pro.meta('profile')) || _pro.author(), contact = (await _pro.meta('contact')) || '';
  const imgs = {}; for (const v of VIEWS) if (photos[v.id]) imgs[v.id] = await loadImg(photos[v.id].photo);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = 4200; const g = cv.getContext('2d'), breaks = [];
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, cv.height); g.textBaseline = 'alphabetic';
  let y = 90; g.fillStyle = SUB; g.font = `700 22px ${F}`; g.fillText('ЗАМЕР ОСАНКИ ПО ФОТО', PAD, y);
  y += 58; g.fillStyle = INK; g.font = `800 48px ${F}`; g.fillText(c.nocard ? 'Замер' : c.name, PAD, y);
  y += 44; g.fillStyle = SUB; g.font = `500 26px ${F}`; g.fillText(_pro.fmtDate(a.date) + ' · ' + author, PAD, y); y += 40;
  // фото: обрезка по телу, линии и точки как у специалиста
  const shown = VIEWS.filter(v => imgs[v.id]), cw = (W - PAD * 2 - 24 * (shown.length - 1)) / Math.max(1, shown.length), ch = cw * 2;
  shown.forEach((v, k) => { const x0 = PAD + k * (cw + 24); tile(g, imgs[v.id], photos[v.id], v.id, x0, y, cw, ch, LN);
    g.fillStyle = SUB; g.font = `600 22px ${F}`; g.textAlign = 'center'; g.fillText(v.name, x0 + cw / 2, y + ch + 32); g.textAlign = 'left'; });
  y += ch + 70;
  const head = (t, tag, col) => { breaks.push(y - 40); g.fillStyle = INK; g.font = `800 32px ${F}`; g.fillText(t, PAD, y); if (tag) { const tw = g.measureText(t).width; g.font = `700 16px ${F}`; const w2 = g.measureText(tag).width + 18;
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.roundRect(PAD + tw + 16, y - 24, w2, 30, 8); g.stroke(); g.fillStyle = col; g.fillText(tag, PAD + tw + 25, y - 3); } y += 22; };
  // фигура в позе клиента с подтвержденными зонами в цветах задач (клиентская палитра).
  // Перекосы по умолчанию усилены ×2, чтобы клиент их увидел; специалист может выключить. Числа в отчете всегда реальные
  const qz = a.quick || {}, zones = qz.zones || [], gain = qz.gainOff ? 1 : qz.gain > 1 ? qz.gain : REPORT_GAIN;
  const figs = []; for (const view of ['front', 'right']) { const im = await asClient(() => posedFigure(zSpots(zones), poseOf({ by: qz.by, h: qz.h || 170 }, gain), view, 400, 880)); if (im) figs.push(im); }
  if (figs.length) { y += 30; head('Положение тела', '', INK); y += 16; const fw = 300, fh = 660, gap = 60, x0 = (W - fw * figs.length - gap * (figs.length - 1)) / 2;
    figs.forEach((im, n) => { const x = x0 + n * (fw + gap); g.strokeStyle = '#F59E0B'; g.lineWidth = 2; g.setLineDash([8, 7]); g.beginPath(); g.moveTo(x + fw / 2, y); g.lineTo(x + fw / 2, y + fh); g.stroke(); g.setLineDash([]); g.drawImage(im, x, y, fw, fh);
      g.fillStyle = SUB; g.font = `600 20px ${F}`; g.textAlign = 'center'; g.fillText(n ? 'Справа' : 'Спереди', x + fw / 2, y + fh + 28); g.textAlign = 'left';
      if (gain > 1) { const t = `Усилено ×${String(gain).replace('.', ',')}`; g.font = `700 19px ${F}`; const tw = g.measureText(t).width + 24; g.fillStyle = '#FEF3C7'; g.beginPath(); g.roundRect(x + fw - tw, y, tw, 34, 10); g.fill(); g.fillStyle = '#B45309'; g.fillText(t, x + fw - tw + 12, y + 23); } });
    y += fh + 56; g.fillStyle = SUB; g.font = `400 20px ${F}`; y = wrap(g, 'Положение на типовой фигуре по фото, а не тело клиента. Цветом отмечены зоны для работы, пунктир: вертикаль.', PAD, y, W - PAD * 2, 28);
    if (gain > 1) { g.fillStyle = '#B45309'; g.font = `700 22px ${F}`; y = wrap(g, `Перекосы на фигуре усилены в ${String(gain).replace('.', ',')} раза, чтобы их было хорошо видно. Это не реальный масштаб: реальные значения в цифрах ниже.`, PAD, y + 4, W - PAD * 2, 30); }
    y += 40; }
  // коротко: 2–3 понятные фразы без чисел, как на экране «Показать клиенту»
  const plain = plainObs(qz.by); if (plain.length) { head('Коротко', '', INK); g.fillStyle = INK; g.font = `600 27px ${F}`; for (const t of plain) { y += 42; g.fillText('• ' + t, PAD, y); } y += 60; }
  // измерено: только значения вне погрешности, остальные одной строкой (специалист видит все в приложении)
  head('Измерено', 'ЗАМЕР', INK); let inTol = 0;
  for (const v of VIEWS) { const m = (qz.by || {})[v.id]; if (!m) continue; const outs = m.filter(isOut); inTol += m.filter(r => r.dir === 'в пределах погрешности').length; if (!outs.length) continue;
    y += 44; g.fillStyle = SUB; g.font = `700 19px ${F}`; g.fillText(v.name.toUpperCase(), PAD, y);
    for (const r of outs) { y += 38; g.fillStyle = INK; g.font = `500 25px ${F}`; g.fillText(`${r.name}: ${r.dir}`, PAD, y); g.font = `600 24px ${M ? MN : F}`; g.textAlign = 'right'; g.fillText(`${num(r.v)}${r.unit.trim() === '°' ? '°' : r.unit}`, W - PAD, y); g.textAlign = 'left'; } }
  if (inTol) { y += 40; g.fillStyle = SUB; g.font = `400 21px ${F}`; g.fillText(`Еще ${inTol} ${inTol % 10 === 1 && inTol % 100 !== 11 ? 'значение' : [2, 3, 4].includes(inTol % 10) && ![12, 13, 14].includes(inTol % 100) ? 'значения' : 'значений'} в пределах погрешности`, PAD, y); }
  if (zones.length || a.note) { y += 60; head('Над чем работаем', 'ГИПОТЕЗА СПЕЦИАЛИСТА', VIO); y += 10;
    for (const gr of taskGroups(zones)) { y += 40; g.fillStyle = { WEAK: '#C2410C', HYPER: '#A16207', SHORT: '#1D4ED8' }[gr.k] || INK; g.font = `700 26px ${F}`; const t = gr.t + ': '; g.fillText(t, PAD, y); const tw = g.measureText(t).width; g.fillStyle = INK; g.font = `500 26px ${F}`;
      y = wrap(g, gr.list.join(', '), PAD + tw, y, W - PAD * 2 - tw, 36) - 36; }
    if (a.note) { y += 14; g.fillStyle = INK; g.font = `400 25px ${F}`; for (const para of a.note.split('\n')) y = wrap(g, para, PAD, y + 30, W - PAD * 2, 34); } }
  // рекомендации: упражнения из существующих карточек зон и текст специалиста
  const exs = exRows(hwEx(a)).slice(0, 6);
  if (exs.length || (a.plan && a.plan.text)) { y += 60; head('Домашнее задание', '', INK); y += 10; g.fillStyle = INK; g.font = `400 25px ${F}`;
    exs.forEach((e, n) => { y = wrap(g, `${n + 1}. ${e.title.split(' (')[0]}${e.dose ? ': ' + e.dose : ''}`, PAD, y + 30, W - PAD * 2, 34) - 4; });
    if (a.plan && a.plan.text) for (const para of a.plan.text.split('\n')) y = wrap(g, para, PAD, y + 30, W - PAD * 2, 34); }
  y += 50; breaks.push(y - 20); g.fillStyle = SUB; g.font = `400 21px ${F}`;
  y = wrap(g, 'Замер по фото. Показаны значения больше погрешности замера. Положение на фото зависит от стойки в момент съемки.' + (editNote(a) ? ' ' + editNote(a) + '.' : ''), PAD, y, W - PAD * 2, 30);
  g.fillStyle = INK; g.font = `700 22px ${F}`; y = wrap(g, LEGAL, PAD, y + 10, W - PAD * 2, 30);
  y += 30; g.fillStyle = BAND; g.fillRect(0, y, W, 120); g.fillStyle = '#fff'; g.font = `700 26px ${F}`; g.fillText(author, PAD, y + 52);
  g.font = `400 21px ${F}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(contact ? 'Запись: ' + contact : 'Сделано в BodyPassport', PAD, y + 86);
  if (contact) { g.textAlign = 'right'; g.fillText('Сделано в BodyPassport', W - PAD, y + 86); g.textAlign = 'left'; }
  y += 120;
  const out = document.createElement('canvas'); out.width = W; out.height = y; out.getContext('2d').drawImage(cv, 0, 0); out.breaks = breaks; return out;
}
/** Отчет клиенту «До и после»: фото двух тестов рядом, изменения больше погрешности, над чем работаем дальше.
 *  Клиенту без состояний мышц и диагнозов: только замер, его изменение и задачи тренировки. */
export async function renderCompare(A, B, c, pa, pb) {
  const M = matte(), W = 1080, PAD = 64, F = M ? 'Inter, system-ui, sans-serif' : 'Manrope, system-ui, sans-serif', MN = "'JetBrains Mono', ui-monospace, monospace", INK = M ? '#1D1D1F' : '#0B1B3B', SUB = M ? '#6E6E73' : '#566079', LN = M ? '#0EA5E9' : '#11A3AE', BAND = M ? '#161617' : '#0B1B3B', GOOD = '#15803D', MORE = '#B45309';
  try { await Promise.all([document.fonts.load(`600 24px ${MN}`), document.fonts.load(`700 24px ${F}`)]); } catch (e) {}
  const author = (await _pro.meta('profile')) || _pro.author(), contact = (await _pro.meta('contact')) || '';
  const qa = A.quick || {}, qb = B.quick || {}, cv = document.createElement('canvas'); cv.width = W; cv.height = 5200; const g = cv.getContext('2d'), breaks = [];
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, cv.height); g.textBaseline = 'alphabetic';
  const dd = t => new Date(t).toLocaleDateString('ru'), weeks = Math.max(1, Math.round((B.date - A.date) / 6048e5)), u = m => m.unit.trim() === '°' ? '°' : m.unit.includes('см') ? ' см' : '%';
  let y = 90; g.fillStyle = SUB; g.font = `700 22px ${F}`; g.fillText('ЗАМЕР ОСАНКИ · ДО И ПОСЛЕ', PAD, y);
  y += 58; g.fillStyle = INK; g.font = `800 48px ${F}`; g.fillText(c.nocard ? 'Замер' : c.name, PAD, y);
  y += 44; g.fillStyle = SUB; g.font = `500 26px ${F}`; g.fillText(`${dd(A.date)} → ${dd(B.date)} · ${B.date - A.date < 6048e5 ? 'через несколько дней' : `через ${weeks} ${weeks % 10 === 1 && weeks % 100 !== 11 ? 'неделю' : [2, 3, 4].includes(weeks % 10) && ![12, 13, 14].includes(weeks % 100) ? 'недели' : 'недель'}`} · ${author}`, PAD, y);
  // изменения: те же показатели двух тестов, разница больше погрешности замера
  const rows = []; for (const v of VIEWS) for (const m of (qb.by || {})[v.id] || []) { const p = ((qa.by || {})[v.id] || []).find(x => x.key === m.key); if (!p) continue;
    rows.push({ v, m, p, d: Math.abs(m.v) - Math.abs(p.v), same: Math.abs(m.v - p.v) <= m.err }); }
  const ch = rows.filter(r => !r.same).sort((x, z) => Math.abs(z.d) / z.m.err - Math.abs(x.d) / x.m.err), less = ch.filter(r => r.d < 0).length;
  // итог крупно
  y += 40; g.fillStyle = M ? '#F5F5F7' : '#F1F5F9'; g.beginPath(); g.roundRect(PAD, y, W - PAD * 2, 150, 28); g.fill();
  g.fillStyle = less ? GOOD : INK; g.font = `700 64px ${MN}`; const big = `${less}`; g.fillText(big, PAD + 36, y + 92); const bw = g.measureText(big).width;
  g.fillStyle = INK; g.font = `700 28px ${F}`; g.fillText(less ? `${less % 10 === 1 && less % 100 !== 11 ? 'показатель стал' : [2, 3, 4].includes(less % 10) && ![12, 13, 14].includes(less % 100) ? 'показателя стали' : 'показателей стали'} ближе к вертикали` : 'Заметных изменений пока нет', PAD + 36 + bw + 20, y + 70);
  g.fillStyle = SUB; g.font = `400 22px ${F}`; g.fillText(`Из ${rows.length} измеренных: изменились больше погрешности ${ch.length}${ch.length - less ? `, из них отклонение больше ${ch.length - less}` : ''}`, PAD + 36 + bw + 20, y + 106);
  y += 150 + 60;
  // фото: по ракурсу пара «до | после», два ракурса в ряд
  const pairs = VIEWS.filter(v => pa[v.id] && pb[v.id]); const imgs = {};
  for (const v of pairs) imgs[v.id] = [await loadImg(pa[v.id].photo), await loadImg(pb[v.id].photo)];
  const tw = (W - PAD * 2 - 24 * 3) / 4, th = tw * 2;
  for (let r = 0; r < pairs.length; r += 2) { breaks.push(y - 30);
    pairs.slice(r, r + 2).forEach((v, k) => { const x0 = PAD + k * (tw * 2 + 48);
      g.fillStyle = INK; g.font = `700 24px ${F}`; g.fillText(v.name, x0, y);
      [[pa, 0, 'До', A], [pb, 1, 'После', B]].forEach(([ph, n, t, x]) => { const xx = x0 + n * (tw + 24); if (imgs[v.id][n]) tile(g, imgs[v.id][n], ph[v.id], v.id, xx, y + 18, tw, th, LN);
        g.fillStyle = SUB; g.font = `600 20px ${F}`; g.textAlign = 'center'; g.fillText(`${t} · ${dd(x.date)}`, xx + tw / 2, y + 18 + th + 30); g.textAlign = 'left'; }); });
    y += 18 + th + 80; }
  const head = t => { breaks.push(y - 40); g.fillStyle = INK; g.font = `800 32px ${F}`; g.fillText(t, PAD, y); y += 22; };
  if (ch.length) { y += 20; head('Что изменилось'); for (const r of ch) { y += 50; g.fillStyle = INK; g.font = `500 25px ${F}`; g.fillText(r.m.name, PAD, y); g.fillStyle = SUB; g.font = `400 20px ${F}`; g.fillText(r.v.name, PAD, y + 28);
      g.font = `600 25px ${MN}`; g.fillStyle = INK; g.textAlign = 'right'; g.fillText(`${num(r.p.v)}${u(r.m)} → ${num(r.m.v)}${u(r.m)}`, W - PAD, y);
      g.font = `600 20px ${F}`; g.fillStyle = r.d < 0 ? GOOD : MORE; g.fillText(r.d < 0 ? 'ближе к вертикали' : 'отклонение больше', W - PAD, y + 28); g.textAlign = 'left'; y += 28; }
    y += 30; }
  const same = rows.length - ch.length; if (same) { y += 20; g.fillStyle = SUB; g.font = `400 22px ${F}`; y = wrap(g, `Без изменений (в пределах погрешности): ${same} ${same % 10 === 1 && same % 100 !== 11 ? 'показатель' : [2, 3, 4].includes(same % 10) && ![12, 13, 14].includes(same % 100) ? 'показателя' : 'показателей'}.`, PAD, y, W - PAD * 2, 30); }
  const groups = taskGroups(qb.zones || []);
  if (groups.length) { y += 50; head('Над чем работаем дальше'); g.fillStyle = SUB; g.font = `400 20px ${F}`; g.fillText('Гипотеза специалиста', PAD, y + 4); y += 6;
    for (const gr of groups) { y += 40; g.fillStyle = { WEAK: '#C2410C', HYPER: '#A16207', SHORT: '#1D4ED8' }[gr.k] || INK; g.font = `700 26px ${F}`; const t = gr.t + ': '; g.fillText(t, PAD, y); const w2 = g.measureText(t).width; g.fillStyle = INK; g.font = `500 26px ${F}`;
      y = wrap(g, gr.list.join(', '), PAD + w2, y, W - PAD * 2 - w2, 36) - 36; } }
  y += 60; breaks.push(y - 20); g.fillStyle = SUB; g.font = `400 21px ${F}`;
  const notes = [editNote(A) && 'До: ' + editNote(A).toLowerCase(), editNote(B) && 'После: ' + editNote(B).toLowerCase()].filter(Boolean).join('. ');
  y = wrap(g, 'Сравниваются одни и те же показатели двух замеров по фото. «Ближе к вертикали»: отклонение уменьшилось больше погрешности замера. Положение на фото зависит от стойки в момент съемки.' + (notes ? ' ' + notes + '.' : ''), PAD, y, W - PAD * 2, 30);
  g.fillStyle = INK; g.font = `700 22px ${F}`; y = wrap(g, LEGAL, PAD, y + 10, W - PAD * 2, 30);
  y += 30; g.fillStyle = BAND; g.fillRect(0, y, W, 120); g.fillStyle = '#fff'; g.font = `700 26px ${F}`; g.fillText(author, PAD, y + 52);
  g.font = `400 21px ${F}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(contact ? 'Запись: ' + contact : 'Сделано в BodyPassport', PAD, y + 86);
  if (contact) { g.textAlign = 'right'; g.fillText('Сделано в BodyPassport', W - PAD, y + 86); g.textAlign = 'left'; }
  y += 120;
  const out = document.createElement('canvas'); out.width = W; out.height = y; out.getContext('2d').drawImage(cv, 0, 0); out.breaks = breaks; return out;
}
