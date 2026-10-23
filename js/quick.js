// «Быстрый тест» (ТЗ v4): клиент → согласие → 4 фото → точки с правкой → замер → отчет.
// Фото, точки, выводы и имя клиента остаются на телефоне специалиста (IndexedDB кабинета), на сервер не уходят.
import { _pro, proHome, clientCard } from './pro.js';
import { go, esc, ic, toast, spots, topOf, plan, asClient } from './app.js';
import { C, cam, startCamera, stopCamera, detectStill, initPose, startMotion, phone, cameraBlocked, openInBrowserSheet, posedFigure, body3D } from './core.js';
import { poseOf } from './pose-figure.js';
import { VIEWS, EDIT_POINTS, POINT_NAMES, quickMetrics, viewMetrics, observations, frameIssue } from './quick-metrics.js';
import { P, analyze } from './analysis.js';
import { track } from './track.js';
import { matte } from './ds.js';

const $ = s => document.querySelector(s);
const CONSENT_VER = '2026-10-v4-draft';
const LEGAL = 'Отчёт не является медицинским заключением и не заменяет консультацию врача.';
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
  go(`<div class="scr fade"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Быстрый тест</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s2)">
    <p class="sub" style="font-size:15px;line-height:1.45">4 фото клиента в полный рост: спереди, справа, сзади, слева. Точки приложение поставит само.</p>
    <input id="nm" class="field" placeholder="Имя или метка клиента" autocomplete="off" aria-label="Имя или метка клиента">
    ${recent.length ? `<div class="row" style="flex-wrap:wrap;gap:8px">${recent.map(c => `<button class="pill" data-c="${c.id}">${esc(c.name)}</button>`).join('')}</div>` : ''}
    <button class="btn" id="qnext">Дальше</button>
    <button class="btn ghost" id="qnocard" style="border:0">Без карточки</button>
   </div></div>`);
  $('#back').onclick = () => proHome();
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { Q.client = clients.find(c => c.id === b.dataset.c); consent(); });
  $('#qnext').onclick = async () => { const n = $('#nm').value.trim(); if (!n) { $('#nm').focus(); $('#nm').placeholder = 'Введите имя или метку'; return; }
    Q.client = clients.find(c => c.name.toLowerCase() === n.toLowerCase()) || { id: _pro.uid(), created: Date.now(), name: n.slice(0, 60), first: n.slice(0, 60), last: '', quick: true };
    consent(); };
  $('#qnocard').onclick = () => { const d = new Date(); Q.client = { id: _pro.uid(), created: Date.now(), name: 'Без карточки · ' + d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }), first: 'Клиент', last: '', nocard: true, quick: true }; consent(); };
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
     ${li('Где хранится', 'Только на телефоне специалиста. На сервер фото и замеры не отправляются.')}
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
.mt-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.mt-steps div{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-radius:16px;font:500 12px Inter,system-ui;color:#98989D;border:1px solid transparent}
.mt-steps div.on{color:#0EA5E9;border-color:rgba(14,165,233,.6);background:rgba(14,165,233,.12)}.mt-steps div.ok{color:#E5E5EA}.mt-steps svg{width:22px;height:22px}
.mt-shot{flex:1;height:56px;border:0;border-radius:9999px;background:#0EA5E9;color:#00131D;font:600 17px Inter,system-ui;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 10px 30px rgba(14,165,233,.35);cursor:pointer}`;
const STEP_IC = { front: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.6"/><path d="M8.5 9h7l-.8 6.5H13l-.5 6.5h-1L11 15.5H9.3z"/></svg>', back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="2.4"/><path d="M8.5 9h7l-.8 6.5H13l-.5 6.5h-1L11 15.5H9.3z"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12h12M12 7l5 5-5 5M20 5v14"/></svg>', left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 12H8M12 7l-5 5 5 5M4 5v14"/></svg>' };
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
      <div style="padding:2px 6px 12px"><div class="row" style="gap:8px;justify-content:space-between"><span style="font:600 12px 'JetBrains Mono',monospace;color:#0EA5E9;letter-spacing:.04em">${i + 1} / 4 · ${v.name.toUpperCase()}</span><span id="qhint" style="font:600 12px Inter,system-ui;padding:4px 10px;border-radius:9999px;background:rgba(255,255,255,.08)"></span></div>
        <div style="font:700 19px Inter,system-ui;line-height:1.25;margin-top:6px;letter-spacing:-.02em">«${v.say}»</div></div>
      <div class="mt-steps">${VIEWS.map((w, k) => `<div class="${k === i ? 'on' : Q.views[w.id] ? 'ok' : ''}">${Q.views[w.id] && k !== i ? '<svg viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="2.4" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : STEP_IC[w.id]}${w.name}</div>`).join('')}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px"><label class="mt-glass" style="height:56px;padding:0 16px;border-radius:9999px;display:grid;place-items:center;font:500 15px Inter,system-ui;cursor:pointer">Загрузить<input type="file" id="qfile" accept="image/*" style="display:none"></label>
        <button id="qshot" class="mt-shot" aria-label="Сделать снимок">${ic('camera', 's')}Сделать снимок</button></div>
      <div style="text-align:center;font:400 11.5px Inter,system-ui;color:#98989D;margin-top:8px">Снимок с поправкой на крен телефона</div></div>
    <div id="qflash" style="position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s"></div></div>`;
}
function shoot(i, single = false) {
  const v = VIEWS[i];
  if (matte()) go(camMatte(i, v)); else go(`<div class="cam qcam" style="display:flex;flex-direction:column">
    <video id="qv" playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>
    <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" style="position:absolute;left:50%;top:8%;height:84%;transform:translateX(-50%);fill:none;stroke:rgba(255,255,255,.55);stroke-width:.7;stroke-dasharray:2 1.6;pointer-events:none" aria-hidden="true">${v.id === 'front' || v.id === 'back' ? SIL.front : SIL.side}</svg>
    <div style="position:relative;padding:calc(env(safe-area-inset-top) + 12px) 16px 0;display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1"><div class="cam-status">${i + 1} / 4 · ${v.name.toUpperCase()}</div><div style="font-size:22px;font-weight:700;line-height:1.2;margin-top:4px;text-shadow:0 1px 6px #000">«${v.say}»</div>
        <div id="qhint" style="margin-top:8px;font-size:15px;font-weight:600;min-height:22px;text-shadow:0 1px 6px #000"></div></div>
      <button class="cam-btn" id="qx" aria-label="Закрыть" style="width:48px;padding:0">${ic('x', 's')}</button></div>
    <div id="qlevel" style="position:absolute;left:50%;top:50%;width:120px;height:4px;margin-left:-60px;border-radius:2px;background:rgba(255,255,255,.7);transition:transform .1s;pointer-events:none"></div>
    <div style="margin-top:auto;position:relative;padding:0 16px calc(env(safe-area-inset-bottom) + 18px);display:flex;align-items:center;justify-content:space-between">
      <label class="cam-btn" style="display:grid;place-items:center;cursor:pointer">Загрузить<input type="file" id="qfile" accept="image/*" style="display:none"></label>
      <button id="qshot" aria-label="Сделать фото" style="width:78px;height:78px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.25);cursor:pointer"></button>
      <span style="width:96px"></span></div>
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
    Q.views[v.id] = { photo: cv.toDataURL('image/jpeg', .85), w: cv.width, h: cv.height, pts, roll, ok: false, issue };
    if (issue) return review(i, single);
    next(i, single);
  };
  $('#qshot').onclick = () => { if (video.readyState < 2) return; done(video, video.videoWidth, video.videoHeight, (cam.back ? -1 : 1) * (phone.ok ? phone.roll : 0)); };
  $('#qfile').onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { done(img, img.naturalWidth, img.naturalHeight, 0); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); };
  $('#qx').onclick = () => { finish(); if (Object.keys(Q.views).length) editor(firstOpen()); else proHome(); };
  (async () => { try { await Promise.all([startCamera(video), initPose()]); } catch (e) { $('#qhint').textContent = 'Камера недоступна. Загрузите фото кнопкой «Загрузить»'; } })();
}
function next(i, single) { if (single) { finish(); return editor(i); } if (i < 3) return shoot(i + 1); finish(); track('test_done', { c: 'quick' }, false); editor(0); }
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
LINES.back = LINES.front;
let showGrid = localStorage.getItem('bp_q_grid') === '1', showPlumb = localStorage.getItem('bp_q_plumb') !== '0';
function editor(i) {
  const v = VIEWS[i], x = Q.views[v.id];
  if (!x) return shoot(i, true);
  go(`<div class="scr fade" style="padding-bottom:110px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Точки · ${v.name}</b></div></div>
   <div class="pad" style="margin-top:8px"><div class="row" style="gap:6px">${VIEWS.map((w, k) => { const y = Q.views[w.id];
     return `<button data-v="${k}" style="flex:1;height:58px;border-radius:12px;border:2px solid ${k === i ? 'var(--ink)' : 'var(--line)'};background:${y ? `center/cover url(${y.photo})` : 'var(--surface-2)'};position:relative;cursor:pointer" aria-label="${w.name}">${y && y.ok ? `<span style="position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#16A34A;color:#fff;display:grid;place-items:center">${ic('check', 's')}</span>` : ''}${!y ? `<span style="font-size:11px;color:var(--sub)">${w.name}</span>` : ''}</button>`; }).join('')}</div>
    ${x.issue ? `<p style="font-size:13px;color:var(--over-t);margin-top:8px">${esc(x.issue)}</p>` : ''}
    <div id="qbox" style="position:relative;margin-top:10px;touch-action:pan-y;user-select:none;-webkit-user-select:none"><canvas id="qcv" style="width:100%;display:block;border-radius:14px;background:#111"></canvas><canvas id="qloupe" width="240" height="240" style="position:absolute;top:8px;left:8px;width:120px;height:120px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.4);display:none;pointer-events:none;z-index:3"></canvas>
      <button class="pill" id="qnextv" style="position:absolute;right:10px;top:10px;height:40px;font-weight:600;background:rgba(22,22,23,.78);color:#fff;border-color:rgba(255,255,255,.18);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)">${i < VIEWS.length - 1 ? 'Следующий снимок' : 'К первому снимку'} ${ic('chevron-right', 's')}</button></div>
    <p class="sub" style="font-size:13px;margin-top:6px">Проверьте точки. Неточную перетащите пальцем: лупа покажет место. ${v.id === 'front' || v.id === 'back' ? 'Две точки у головы: на ушах, у козелка (хрящ перед слуховым проходом); сзади там же, по краю головы.' : 'Точка у головы: на ухе, у козелка (хрящ перед слуховым проходом).'}</p>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pill tog${showGrid ? ' on' : ''}" id="qgrid" aria-pressed="${showGrid}">Сетка</button><button class="pill tog${showPlumb ? ' on' : ''}" id="qplumb" aria-pressed="${showPlumb}">Отвес</button><button class="pill" id="qretake">${ic('camera', 's')} Переснять</button></div>
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
  $('#qretake').onclick = () => { Q.wasBack = cam.back; cam.back = true; shoot(i, true); };
  $('#back').onclick = () => { if (confirm('Выйти без сохранения? Фото этого теста удалятся.')) { Q = null; proHome(); } };
  // «Следующий снимок»: этот вид проверен, к следующему; «Все точки верны» подтверждает сразу все фото
  $('#qnextv').onclick = () => { if (x.pts) x.ok = true; editor((i + 1) % VIEWS.length); };
  $('#qok').onclick = () => { const miss = VIEWS.findIndex(w => !Q.views[w.id] || !Q.views[w.id].pts);
    if (miss >= 0) { toast(Q.views[VIEWS[miss].id] ? `${VIEWS[miss].name}: точек нет, переснимите` : `Нет фото: ${VIEWS[miss].name.toLowerCase()}`); return miss === i ? null : editor(miss); }
    VIEWS.forEach(w => { Q.views[w.id].ok = true; }); results(); };
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
 *  (шея, плечевой пояс, корпус, таз, ноги) не больше 4 зон, всего до 10. Самые выраженные идут первыми. */
const RELAX = .6, FERR = { pelvic_tilt: 1.5, shoulder_tilt: 1.5, head_tilt: 2, trunk_lateral: 1.5, head_forward: 4, knee_hyper: 3, shoulder_shift: .015, hip_shift: .015 };
const relax = (t, e) => t == null ? t : Math.sign(t) * Math.max(Math.abs(t) * RELAX, e);
const REGION = y => y < .23 ? 0 : y < .38 ? 1 : y < .52 ? 2 : y < .63 ? 3 : 4;
export function zonesOf(q) {
  try { const rules = C.bodymap.rules.map(r => FERR[r.feature] == null ? r : { ...r, absGreater: relax(r.absGreater, FERR[r.feature]), greater: relax(r.greater, FERR[r.feature]), less: relax(r.less, FERR[r.feature]) });
    const a = analyze({ snapshot: q.snapshot, side: q.side, moves: {}, protocol: [] }, { ...C, bodymap: { ...C.bodymap, rules } });
    const seen = new Set(), per = [0, 0, 0, 0, 0], out = [];
    for (const s of topOf(spots(a))) { const k = s.id + ':' + s.side, r = REGION(s.y); if (seen.has(k) || per[r] >= 4) continue; seen.add(k); per[r]++; out.push(s); if (out.length >= 10) break; }
    return out.map(s => ({ id: s.id, side: s.side, k: s.k, key: s.key })); }
  catch (e) { return []; } }
const zSpots = zones => zones.map(z => ({ ...z, key: z.key || z.id + ':' + z.side, tone: z.k === 'WEAK' ? -.75 : .75, back: (C.muscles[z.id] || {}).view === 'back' }));
// клиенту: одна короткая фраза на показатель, без чисел (числа у специалиста и в «Измерено»)
const PLAIN = { headForward: ['Голова выдвинута вперед', 'Голова отведена назад'], headTilt: ['Голова наклонена к правому плечу', 'Голова наклонена к левому плечу'],
  shoulderTilt: ['Правое плечо ниже левого', 'Левое плечо ниже правого'], pelvicTilt: ['Таз: правая сторона ниже', 'Таз: левая сторона ниже'], trunkLateral: ['Корпус смещен вправо', 'Корпус смещен влево'],
  shoulderShift: ['Плечи впереди таза', 'Плечи позади таза'], hipShift: ['Таз смещен вперед', 'Таз смещен назад'], kneeHyper: ['Колени переразогнуты', 'Колени согнуты'] };
export function plainObs(by, max = 3) { const best = {};
  for (const v of VIEWS) for (const m of (by || {})[v.id] || []) { if (m.dir === 'в пределах погрешности' || !PLAIN[m.key]) continue; const sc = Math.abs(m.v) / m.err; if (!best[m.key] || sc > best[m.key].sc) best[m.key] = { sc, t: PLAIN[m.key][m.v > 0 ? 0 : 1] }; }
  return Object.values(best).sort((a, b) => b.sc - a.sc).slice(0, max).map(x => x.t); }
/** Зоны языком задач, сгруппированные: «Укрепить: глубокие мышцы шеи, верх плеча справа». Одна зона с двух сторон пишется один раз. */
export function taskGroups(zones) { const g = new Map();
  for (const z of zones || []) { if (!g.has(z.k)) g.set(z.k, new Map()); const m = g.get(z.k), nm = ((C.muscles[z.id] || {}).zone || zoneName(z)).toLowerCase(); if (!m.has(nm)) m.set(nm, new Set()); m.get(nm).add(z.side); }
  return [...g].map(([k, m]) => ({ k, t: TASK[k], list: [...m].map(([nm, s]) => s.size > 1 ? nm : `${nm} ${sideRu([...s][0])}`.trim()) })); }
const gainPlate = g => g > 1 ? `<div style="font-size:13px;font-weight:700;color:#B45309;background:#FEF3C7;border-radius:10px;padding:6px 10px;margin-top:8px">Показано с увеличением ×${String(g).replace('.', ',')}, не реальный масштаб</div>` : '';
// ---------- замеры на фото: линии, отвес и подписи отклонений прямо у суставов (паспорт, было → стало) ----------
const MONO = "'JetBrains Mono', ui-monospace, monospace", SANS = "Inter, -apple-system, system-ui, sans-serif";
// у какого сустава подписать показатель и с какой стороны тела ставить подпись
const ANCHOR = { headTilt: [[P.L_EAR, P.R_EAR], 'Голова'], shoulderTilt: [[P.L_SHOULDER, P.R_SHOULDER], 'Плечи'], pelvicTilt: [[P.L_HIP, P.R_HIP], 'Таз'], trunkLateral: [[P.L_SHOULDER, P.R_SHOULDER, P.L_HIP, P.R_HIP], 'Корпус'],
  headForward: [[P.L_EAR, P.R_EAR], 'Голова'], shoulderShift: [[P.L_SHOULDER, P.R_SHOULDER], 'Плечо'], hipShift: [[P.L_HIP, P.R_HIP], 'Таз'], kneeHyper: [[P.L_KNEE, P.R_KNEE], 'Колено'] };
const SIDE_PT = { right: { [P.L_EAR]: P.R_EAR, [P.L_SHOULDER]: P.R_SHOULDER, [P.L_HIP]: P.R_HIP, [P.L_KNEE]: P.R_KNEE }, left: { [P.R_EAR]: P.L_EAR, [P.R_SHOULDER]: P.L_SHOULDER, [P.R_HIP]: P.L_HIP, [P.R_KNEE]: P.L_KNEE } };
const loadedImg = new Map();
const imgOf = src => { if (!loadedImg.has(src)) loadedImg.set(src, new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; })); return loadedImg.get(src); };
/** Фото вида с замерами. x: { photo, w, h, pts }, ms: показатели этого вида (quick-metrics). Холст 4:5, тело по центру. */
async function drawMeasure(cv, x, view, ms, compact = false) {
  const im = x && x.photo ? await imgOf(x.photo) : null; if (!im || !cv.isConnected) return false;
  try { await Promise.all([document.fonts.load(`600 20px ${MONO}`), document.fonts.load(`500 20px ${SANS}`)]); } catch (e) {}
  // компактно (два фото рядом): холст крупнее при тех же размерах подписей, поэтому подписи относительно мельче
  const d = Math.min(2, devicePixelRatio || 1), W = Math.round(cv.clientWidth * d * (compact ? 1.7 : 1)) || 600, H = Math.round(W * 1.25); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), pts = x.pts, ids = EDIT_POINTS[view];
  // кадр по телу: от макушки до стоп с запасом, пропорция холста
  let bx = 0, by = 0, bw = x.w, bh = x.h;
  if (pts) { const ys = ids.map(i => pts[i].y), xs = ids.map(i => pts[i].x), top = Math.min(...ys), bot = Math.max(...ys), span = bot - top;
    bh = Math.min(x.h, span * 1.5); bw = Math.min(x.w, bh * W / H); if (bw === x.w) bh = Math.min(x.h, bw * H / W);
    by = Math.max(0, Math.min(x.h - bh, top - span * .28)); bx = Math.max(0, Math.min(x.w - bw, (Math.min(...xs) + Math.max(...xs)) / 2 - bw / 2)); }
  const sc = Math.min(W / bw, H / bh), ox = (W - bw * sc) / 2, oy = (H - bh * sc) / 2;
  g.fillStyle = '#1C1C1E'; g.fillRect(0, 0, W, H); g.drawImage(im, bx, by, bw, bh, ox, oy, bw * sc, bh * sc);
  g.fillStyle = 'rgba(10,10,12,.22)'; g.fillRect(0, 0, W, H);
  // сетка как в правке точек (переключатель «Сетка» общий): тонкие квадратные клетки
  if (showGrid) { const cell = W / 8; g.beginPath(); for (let gx = cell; gx < W - 1; gx += cell) { g.moveTo(gx, 0); g.lineTo(gx, H); } for (let gy = cell; gy < H - 1; gy += cell) { g.moveTo(0, gy); g.lineTo(W, gy); }
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.6 * d; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .6 * d; g.stroke(); }
  if (!pts) return true;
  const X = i => ox + (pts[i].x - bx) * sc, Y = i => oy + (pts[i].y - by) * sc, CY = '#0EA5E9', AM = '#FF9F0A';
  const out = new Set(ms.filter(m => m.dir !== 'в пределах погрешности').map(m => m.key));
  // отвес от середины стоп и горизонтали через плечи и таз
  const ax = view === 'right' ? X(P.R_ANKLE) : view === 'left' ? X(P.L_ANKLE) : (X(P.L_ANKLE) + X(P.R_ANKLE)) / 2;
  g.save(); g.shadowColor = 'rgba(14,165,233,.8)'; g.shadowBlur = 8 * d; g.strokeStyle = 'rgba(14,165,233,.9)'; g.lineWidth = 1 * d; g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax, H); g.stroke(); g.restore();
  // скелет: сегмент с показателем вне погрешности янтарный
  const hot = { front: { [P.L_SHOULDER + ':' + P.R_SHOULDER]: 'shoulderTilt', [P.L_HIP + ':' + P.R_HIP]: 'pelvicTilt', [P.L_EAR + ':' + P.R_EAR]: 'headTilt' } }; hot.back = hot.front;
  for (const [a, b] of LINES[view]) { const k = (hot[view] || {})[a + ':' + b], on = k && out.has(k);
    g.save(); g.shadowColor = on ? 'rgba(255,159,10,.7)' : 'rgba(14,165,233,.7)'; g.shadowBlur = 6 * d; g.strokeStyle = on ? AM : CY; g.lineWidth = 1.5 * d; g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke(); g.restore(); }
  for (const i of ids) { g.beginPath(); g.arc(X(i), Y(i), 5.5 * d, 0, 7); g.fillStyle = 'rgba(14,165,233,.25)'; g.fill(); g.beginPath(); g.arc(X(i), Y(i), 3 * d, 0, 7); g.fillStyle = '#E0F2FE'; g.fill(); g.lineWidth = 1.5 * d; g.strokeStyle = CY; g.stroke(); }
  // подписи: значение моноширинным в пилюле, под ней что это; по очереди слева и справа от тела
  const placed = []; let side = 0;
  const label = (k, m) => { const [pp, name] = ANCHOR[k] || []; if (!pp) return; const pi = pp.map(i => (SIDE_PT[view] || {})[i] ?? i);
    const axp = pi.reduce((s, i) => s + X(i), 0) / pi.length, ayp = pi.reduce((s, i) => s + Y(i), 0) / pi.length, isOut = out.has(k);
    const v = `${num(m.v)}${m.unit.trim() === '°' ? '°' : m.unit.includes('см') ? ' см' : '%'}`;
    // в пределах погрешности: тихая пилюля «Плечи · в пределах» с зеленой точкой, без цифр
    // в пределах погрешности подписи нет: на фото только то, на что стоит посмотреть (меньше цифр, глаз не сбивается)
    if (!isOut) return;
    if (!isOut) { g.font = `500 ${12 * d}px ${SANS}`; const t = `${name} · в пределах`, tw = g.measureText(t).width + 30 * d, lft = side++ % 2 === 0 ? axp > W / 2 : axp <= W / 2;
      let tx = lft ? 12 * d : W - tw - 12 * d, ty = ayp - 12 * d; for (const p of placed) if (Math.abs(p.y - ty) < 40 * d && p.left === lft) ty = p.y + 42 * d; ty = Math.max(8 * d, Math.min(H - 30 * d, ty)); placed.push({ y: ty, left: lft });
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1 * d; g.beginPath(); g.moveTo(axp, ayp); g.lineTo(lft ? tx + tw : tx, ty + 12 * d); g.stroke();
      g.fillStyle = 'rgba(28,28,30,.86)'; g.beginPath(); g.roundRect(tx, ty, tw, 24 * d, 12 * d); g.fill(); g.fillStyle = '#30D158'; g.beginPath(); g.arc(tx + 12 * d, ty + 12 * d, 3.5 * d, 0, 7); g.fill();
      g.fillStyle = '#E5E5EA'; g.textBaseline = 'middle'; g.fillText(t, tx + 21 * d, ty + 12.5 * d); g.textBaseline = 'alphabetic'; return; }
    g.font = `600 ${15 * d}px ${MONO}`; const vw = g.measureText(v).width + 20 * d;
    g.font = `500 ${12 * d}px ${SANS}`; const sub = isOut ? `${name}: ${m.dir.replace(' (переразгибание)', '').replace(' (согнуто)', '')}` : name, sw = g.measureText(sub).width + 18 * d;
    const bwid = Math.max(vw, sw), left = side++ % 2 === 0 ? axp > W / 2 : axp <= W / 2; let lx = left ? 12 * d : W - bwid - 12 * d, ly = ayp - 20 * d;
    for (const p of placed) if (Math.abs(p.y - ly) < (compact ? 30 : 50) * d && p.left === left) ly = p.y + (compact ? 32 : 52) * d; ly = Math.max(8 * d, Math.min(H - 52 * d, ly)); placed.push({ y: ly, left });
    g.strokeStyle = isOut ? 'rgba(255,159,10,.75)' : 'rgba(255,255,255,.35)'; g.lineWidth = 1 * d; g.beginPath(); g.moveTo(axp, ayp); g.lineTo(left ? lx + bwid : lx, ly + 14 * d); g.stroke();
    g.fillStyle = isOut ? 'rgba(58,36,6,.92)' : 'rgba(18,48,28,.9)'; g.beginPath(); g.roundRect(lx, ly, vw, 28 * d, 14 * d); g.fill();
    g.strokeStyle = isOut ? 'rgba(255,159,10,.55)' : 'rgba(48,209,88,.45)'; g.stroke(); g.fillStyle = isOut ? AM : '#30D158'; g.font = `600 ${15 * d}px ${MONO}`; g.textBaseline = 'middle'; g.fillText(isOut ? v : 'в пределах', lx + 10 * d, ly + 14.5 * d);
    if (isOut && !compact) { g.fillStyle = 'rgba(28,28,30,.88)'; g.beginPath(); g.roundRect(lx, ly + 31 * d, sw, 22 * d, 11 * d); g.fill(); g.fillStyle = '#E5E5EA'; g.font = `500 ${12 * d}px ${SANS}`; g.fillText(sub, lx + 9 * d, ly + 42.5 * d); }
    g.textBaseline = 'alphabetic'; };
  // сначала вне погрешности (главное), потом остальные
  for (const m of [...ms].sort((a, b) => (out.has(b.key) ? 1 : 0) - (out.has(a.key) ? 1 : 0))) label(m.key, m);
  return true;
}
const HYPCLS = { WEAK: 'g', HYPER: 'm', SHORT: 'a' };
/** Карточки «Гипотеза специалиста» по задачам: «Укрепить: …», «Расслабить: …» (как увидит клиент). */
const hypCards = zones => taskGroups(zones).map(g => `<div><b>Гипотеза специалиста</b><span class="mt-tag ${HYPCLS[g.k]}">${g.t}</span><ul>${g.list.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
/** Что видно: показатели вне погрешности, самые заметные первыми; значение и погрешность моноширинным. */
const obsRows = by => { const r = []; for (const v of VIEWS) for (const m of by[v.id] || []) if (m.dir !== 'в пределах погрешности') r.push({ v, m, sc: Math.abs(m.v) / m.err });
  return r.sort((a, b) => b.sc - a.sc).slice(0, 4).map(({ v, m }) => `<div class="row" style="gap:10px;align-items:center;padding:12px 14px;min-height:56px"><span style="flex:1;font-size:15px;line-height:1.3">${m.name}<br><span class="sub" style="font-size:13px">${v.name} · ${m.dir}</span></span><span class="mt-val" style="font-size:15px;white-space:nowrap;color:#FF9F0A">${num(m.v)}${m.unit.trim() === '°' ? '°' : m.unit}</span></div>`).join(''); };
/** Блок результата (после теста и в карточке клиента): сцена «3D | Фото» с ракурсами, «Усилить», гипотезы по задачам,
 *  зоны со статусами, что видно, все замеры. st: { by, zones, gain, h }; photos: { front: { photo, w, h, pts }, … }. */
function panel(host, st, { onChange = () => {}, onNoFig = () => {}, photos = {} } = {}) {
  const n = VIEWS.reduce((s, v) => s + (st.by[v.id] || []).length, 0), out = VIEWS.reduce((s, v) => s + (st.by[v.id] || []).filter(m => m.dir !== 'в пределах погрешности').length, 0);
  const hasPh = VIEWS.some(v => photos[v.id] && photos[v.id].pts); let v3 = null, mode = '3d', view = 'front';
  const pose = () => poseOf({ by: st.by, h: st.h || 170 }, st.gain);
  host.innerHTML = `<div class="card" id="qfcard" style="padding:12px">
      ${hasPh ? `<div class="row" style="justify-content:space-between;gap:8px"><div class="seg" id="qmode" style="width:auto;flex:none"><button data-md="3d" class="on" style="padding:0 18px">3D</button><button data-md="ph" style="padding:0 18px">Фото</button></div><span style="flex:1"></span><button class="pill tog${showGrid ? ' on' : ''}" id="qpgrid" aria-pressed="${showGrid}" style="display:none;height:34px">Сетка</button><span class="mt-tag n" id="qmlbl">Типовая фигура</span></div>` : ''}
      <div id="q3d" style="height:min(58vh,420px);margin-top:10px"></div><canvas id="qph" style="width:100%;display:none;margin-top:10px;border-radius:22px"></canvas>
      <div class="seg" id="qview" style="margin-top:10px">${VIEWS.map((v, i) => `<button data-vw="${v.id}" class="${i ? '' : 'on'}" style="padding:0 6px">${v.name}</button>`).join('')}</div>
      <div id="qgr"><div class="row" style="gap:10px;margin-top:10px"><span class="sub" style="font-size:13px;flex:none">Усилить</span><div class="seg" id="qgain" style="flex:1">${GAINS.map(g => `<button data-g="${g}" class="${g === st.gain ? 'on' : ''}" style="padding:0 6px">×${String(g).replace('.', ',')}</button>`).join('')}</div></div><div id="qplate">${gainPlate(st.gain)}</div></div>
      <div class="sub" id="qcap" style="font-size:12px;text-align:center;margin-top:8px">Положение на типовой фигуре, а не тело клиента. Цветом отмечены зоны</div></div>
    <div class="mt-hyp" id="qhyp"></div>
    <div><div class="eyebrow">Зоны · предположение по замеру, проверьте</div><div id="qzl"></div>
      <button class="btn line" id="qadd" style="margin-top:10px">${ic('plus', 's')}Добавить зону</button>
      <p class="sub" style="font-size:12px;margin-top:6px">Касание по статусу меняет его, крестик убирает зону. Клиент увидит зоны как задачи: «Укрепить», «Расслабить».</p></div>
    <div><div class="eyebrow">Что видно</div>${out ? `<div class="group" style="padding:0">${obsRows(st.by)}</div>` : '<div class="card" style="font-size:15px">Все значения в пределах погрешности</div>'}</div>
    <details class="acc"><summary style="font-weight:600;font-size:15px">Все замеры: <span class="mono">${n}</span>, вне погрешности <span class="mono">${out}</span></summary><div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">${VIEWS.filter(v => st.by[v.id]).map(v => `<div><div class="eyebrow">${v.name}</div>${metricRows(st.by[v.id])}</div>`).join('')}</div></details>
    <p class="mt-cal">Поправка на крен телефона учтена · погрешности замера в методике</p>`;
  const $h = s => host.querySelector(s);
  const hyp = () => { $h('#qhyp').innerHTML = hypCards(st.zones); $h('#qhyp').style.display = st.zones.length ? '' : 'none'; };
  const changed = () => { if (v3) v3.update(zSpots(st.zones)); zl(); hyp(); onChange(st); };
  const zl = () => { $h('#qzl').innerHTML = st.zones.length ? `<div class="group">${st.zones.map((z, i) => `<div class="row" style="gap:10px;min-height:52px;padding:8px 12px"><span style="flex:1;font-size:15px;line-height:1.3">${esc(zoneName(z))} <span class="sub">${sideRu(z.side)}</span></span>
      <button class="pill" data-zs="${i}" style="color:${ZCOL[z.k]};border-color:${ZCOL[z.k]};font-weight:600">${ZST[z.k]}</button><button class="round" data-zx="${i}" aria-label="Убрать зону" style="width:36px;height:36px">${ic('x', 's')}</button></div>`).join('')}</div>` : '<div class="card sub" style="font-size:14px">По замеру выраженных зон нет</div>';
    host.querySelectorAll('[data-zs]').forEach(b => b.onclick = () => { const z = st.zones[+b.dataset.zs]; z.k = ZNEXT[z.k]; changed(); });
    host.querySelectorAll('[data-zx]').forEach(b => b.onclick = () => { st.zones.splice(+b.dataset.zx, 1); changed(); }); };
  zl(); hyp();
  const photoView = () => drawMeasure($h('#qph'), photos[view], view, st.by[view] || []).then(ok => { if (!ok && $h('#qph')) { const c = $h('#qph').getContext('2d'); c.clearRect(0, 0, 1e4, 1e4); } });
  const setMode = md => { mode = md; host.querySelectorAll('[data-md]').forEach(x => x.classList.toggle('on', x.dataset.md === md));
    $h('#q3d').style.display = md === '3d' ? '' : 'none'; $h('#qph').style.display = md === 'ph' ? 'block' : 'none'; $h('#qgr').style.display = md === '3d' ? '' : 'none';
    if ($h('#qmlbl')) $h('#qmlbl').textContent = md === '3d' ? 'Типовая фигура' : 'Фото клиента';
    if ($h('#qpgrid')) $h('#qpgrid').style.display = md === 'ph' ? '' : 'none';
    $h('#qcap').textContent = md === '3d' ? 'Положение на типовой фигуре, а не тело клиента. Цветом отмечены зоны' : 'Подписаны только отклонения больше погрешности. Линия: вертикаль от стоп';
    if (md === 'ph') photoView(); else if (v3) v3.look(view); };
  host.querySelectorAll('[data-md]').forEach(b => b.onclick = () => setMode(b.dataset.md));
  if ($h('#qpgrid')) $h('#qpgrid').onclick = () => { showGrid = !showGrid; localStorage.setItem('bp_q_grid', showGrid ? '1' : '0'); $h('#qpgrid').classList.toggle('on', showGrid); $h('#qpgrid').setAttribute('aria-pressed', showGrid); photoView(); };
  $h('#qadd').onclick = () => addZone(zs => { const rest = st.zones.filter(x => !zs.some(z => x.id === z.id && x.side === z.side)); if (rest.length + zs.length > 12) return toast('Не больше 12 зон'); st.zones = [...rest, ...zs]; changed(); });
  host.querySelectorAll('[data-vw]').forEach(b => b.onclick = () => { view = b.dataset.vw; host.querySelectorAll('[data-vw]').forEach(x => x.classList.toggle('on', x === b)); if (mode === 'ph') photoView(); else if (v3) v3.look(view); });
  host.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { st.gain = +b.dataset.g; host.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); $h('#qplate').innerHTML = gainPlate(st.gain); if (v3) v3.pose(pose()); onChange(st); });
  // без WebGL2 3D-фигуры нет: остаются фото с замерами (если есть) или блок прячется
  body3D($h('#q3d'), zSpots(st.zones), key => { const z = st.zones.find(x => (x.key || x.id + ':' + x.side) === key); if (z) toast(`${zoneName(z)} ${sideRu(z.side)}: ${ZST[z.k]}`); }, { pose: pose() })
    .then(api => { v3 = api; }).catch(() => { if (hasPh) { setMode('ph'); const m = $h('#qmode'); if (m) m.remove(); } else { const f = $h('#qfcard'); if (f) f.remove(); } onNoFig(); });
}
function results() {
  const q = Q.metrics || quickMetrics(Q.views, heightCm()); Q.metrics = q; Q.obs = observations(q.by);
  if (!Q.zones) Q.zones = zonesOf(q); if (!Q.gain) Q.gain = 1;
  go(`<div class="scr fade" style="padding-bottom:150px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>${esc(Q.client.nocard ? 'Замер' : Q.client.name)}</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:16px;margin-top:8px"><div id="qpanel" style="display:flex;flex-direction:column;gap:16px"></div>
    <div><div class="eyebrow">Ваш вывод · ГИПОТЕЗА</div><textarea id="qcon" class="field" rows="3" maxlength="1200" placeholder="Необязательно. В отчете будет с пометкой «гипотеза специалиста»" style="height:auto;padding:12px 16px">${esc(Q.note || '')}</textarea></div>
    <div><div class="eyebrow">Рекомендации</div><textarea id="qrec" class="field" rows="2" maxlength="1200" placeholder="Необязательно: упражнения из карточек зон добавятся сами" style="height:auto;padding:12px 16px">${esc(Q.rec || '')}</textarea></div>
    <label class="row" id="qgl" style="gap:10px;font-size:14px"><input type="checkbox" id="qgpdf"${Q.gainPdf ? ' checked' : ''} style="width:20px;height:20px"> В отчет с увеличением (с той же пометкой)</label>
   </div>
   <div class="dock"><button class="btn line" id="qshow">${ic('maximize', 's')}Показать клиенту</button><button class="btn" id="qsave" style="margin-top:8px">${ic('file-text', 's')}Сохранить и отчет</button></div></div>`);
  const st = { by: q.by, zones: Q.zones, gain: Q.gain, h: heightCm() || 170 };
  panel($('#qpanel'), st, { photos: Q.views, onChange: s => { Q.zones = s.zones; Q.gain = s.gain; }, onNoFig: () => { const l = $('#qgl'); if (l) l.remove(); } });
  const keep = () => { Q.note = $('#qcon').value.trim(); Q.rec = $('#qrec').value.trim(); Q.gainPdf = !!($('#qgpdf') && $('#qgpdf').checked); };
  $('#qshow').onclick = () => { keep(); showClient(st, Q.client.nocard ? '' : Q.client.name); };
  $('#back').onclick = () => { keep(); editor(3); };
  $('#qsave').onclick = async () => { keep(); const id = await save(); report(id); };
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
  const a = await row('assessments', aid), c = await row('clients', a.clientId), qz = a.quick || {};
  const st = { by: qz.by || {}, zones: (qz.zones || []).map(z => ({ ...z })), gain: 1, h: qz.h || 170 };
  // действия под рукой: отчет, показать клиенту, было → стало (до повторного теста кнопка видна, но неактивна)
  const tool = (id, icon, t, off) => `<button class="tool" id="${id}"${off ? ' disabled style="opacity:.45"' : ''}>${ic(icon)}<span>${t}</span></button>`;
  host.innerHTML = `<div class="pad" style="margin-top:12px;display:flex;flex-direction:column;gap:16px"><div class="row" style="gap:8px"><b style="flex:1;font-size:17px">Быстрый тест · ${_pro.fmtDate(a.date)}</b></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${tool('qcrep', 'share', 'Отчет клиенту')}${tool('qcshow', 'maximize', 'Показать клиенту')}${tool('qccmp', 'arrow-right-left', 'Было → стало', !prevId)}</div>
    ${prevId ? '' : '<p class="sub" style="font-size:12px;margin-top:-8px">«Было → стало» откроется после повторного теста этого клиента.</p>'}
    <div id="qcp" style="display:flex;flex-direction:column;gap:16px"></div>
    ${a.note ? `<div><div class="eyebrow">Ваш вывод · ГИПОТЕЗА</div><div class="card" style="font-size:15px;line-height:1.45;white-space:pre-line">${esc(a.note)}</div></div>` : ''}</div>`;
  panel(host.querySelector('#qcp'), st, { photos: ((await row('poses', aid)) || {}).photos || {}, onChange: async s => { a.quick = { ...a.quick, zones: s.zones.map(({ id, side, k, key }) => ({ id, side, k, key })), confirmed: true }; await _pro.put('assessments', a); } });
  host.querySelector('#qcrep').onclick = () => report(aid);
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
     <div class="seg" id="cmpv" style="margin-top:10px">${VIEWS.map((v, i) => `<button data-vw="${v.id}" class="${i ? '' : 'on'}" style="padding:0 6px">${v.name}</button>`).join('')}</div></div>
    <div><div class="eyebrow">Изменения</div><div class="group" style="padding:0">${rows.map(r => `<div class="row" style="gap:10px;align-items:center;padding:12px 14px"><span style="flex:1;font-size:14px;line-height:1.35">${r.m.name}<br><span class="sub" style="font-size:12px">${r.v.name}</span></span><span style="text-align:right;line-height:1.5"><span class="mt-val" style="font-size:14px">${num(r.p.v)}${u(r.m)} → ${num(r.m.v)}${u(r.m)}</span><br>${tag(r)}</span></div>`).join('') || '<div class="row sub" style="padding:12px 14px">Нет общих замеров</div>'}</div></div>
    <p class="mt-cal">«Без изменений»: разница в пределах погрешности замера · «меньше»: отклонение от вертикали уменьшилось</p></div></div>`);
  $('#back').onclick = () => clientCard(B.clientId);
  const draw = async () => { for (const [i, x, ph] of [[0, qa, pa], [1, qb, pb]]) { const cv = $('#cmp' + i); if (!cv) return;
    if (mode === 'ph') { await drawMeasure(cv, ph[view], view, (x.by || {})[view] || [], true); continue; }
    const im = await posedFigure(zSpots(x.zones || []), poseOf({ by: x.by || {}, h: x.h || 170 }, 1), view, 400, 880); if (!im) { if (!hasPh) { const f = $('#cmpf'); if (f) f.remove(); } return; }
    cv.width = 400; cv.height = 500; const g = cv.getContext('2d'), fw = 500 * 400 / 880; g.clearRect(0, 0, 400, 500); g.strokeStyle = '#0EA5E9'; g.lineWidth = 2; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(200, 0); g.lineTo(200, 500); g.stroke(); g.setLineDash([]); g.drawImage(im, 200 - fw / 2, 0, fw, 500); } };
  draw();
  document.querySelectorAll('#cmpv [data-vw]').forEach(b => b.onclick = () => { view = b.dataset.vw; document.querySelectorAll('#cmpv [data-vw]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  document.querySelectorAll('#cmpm [data-md]').forEach(b => b.onclick = () => { mode = b.dataset.md; document.querySelectorAll('#cmpm [data-md]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  track('screen', { c: 'quick_compare' }, false);
}
async function save() {
  const c = Q.client; if (!(await row('clients', c.id))) await _pro.put('clients', { ...c }); else if (Q.consent && !Q.consent.reused) await _pro.put('clients', { ...(await row('clients', c.id)), consent: Q.consent });
  const id = _pro.uid(), q = Q.metrics, prev = (await _pro.all('assessments')).filter(a => a.clientId === c.id).sort((a, b) => b.date - a.date)[0];
  const a = { id, clientId: c.id, date: Q.date, template: 'quick', templateName: 'Быстрый тест', quick: { by: q.by, obs: Q.obs, zones: Q.zones.map(({ id, side, k, key }) => ({ id, side, k, key })), confirmed: true, gain: Q.gainPdf ? Q.gain : 1, h: heightCm() || 170, views: VIEWS.filter(v => Q.views[v.id]).map(v => v.id), edited: VIEWS.filter(v => Q.views[v.id] && Q.views[v.id].edited).map(v => v.id) },
    snapshot: q.snapshot, side: q.side, consent: Q.consent, note: Q.note, plan: { ex: [], text: Q.rec }, protocol: [], moves: {}, quality: {}, limits: {}, setup: {}, pain: {}, hyp: {}, check: {}, draft: false, prevId: prev ? prev.id : null };
  await _pro.put('assessments', a);
  await _pro.put('poses', { assessmentId: id, photos: Object.fromEntries(VIEWS.filter(v => Q.views[v.id]).map(v => { const x = Q.views[v.id]; return [v.id, { photo: x.photo, w: x.w, h: x.h, pts: x.pts, roll: x.roll }]; })) });
  track('assess_done', { n: a.quick.views.length, c: 'quick' }, false);
  if (prev && Q.date - prev.date <= 14 * 864e5) track('retest_14d', null, false);
  return id;
}

// ---------- 6. отчет: PDF и картинка ----------
export async function quickResult(aid) { return report(aid); }
async function report(aid) {
  const a = await row('assessments', aid), c = await row('clients', a.clientId), ph = (await row('poses', aid)) || {};
  const cv = await renderReport(a, c, ph.photos || {});
  const base = `bodypassport-${(c.nocard ? 'zamer' : c.name).replace(/[^\p{L}\p{N}]+/gu, '-')}-${new Date(a.date).toISOString().slice(0, 10)}`;
  const d = document.createElement('div'); d.className = 'sheet';
  d.innerHTML = `<div><h2 style="font-size:20px">Отчет клиенту</h2><p class="sub" style="font-size:13px;margin-top:4px">Так его увидит клиент.</p>
    <div style="margin-top:12px;max-height:50dvh;overflow:auto;border-radius:16px;border:1px solid var(--line)"><img src="${cv.toDataURL('image/jpeg', .8)}" alt="Отчет" style="width:100%;display:block"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button class="btn" id="qpdf">${ic('file-text', 's')}PDF</button><button class="btn line" id="qpng">${ic('image', 's')}Картинка</button></div>
    <button class="btn ghost" id="qcard" style="margin-top:8px;border:0">${c.nocard ? 'В кабинет' : 'К карточке клиента'}</button></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); c.nocard ? proHome() : clientCard(c.id); };
  d.onclick = e => { if (e.target === d) close(); }; d.querySelector('#qcard').onclick = close;
  const send = async (blob, name, type, kind) => { const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Замер осанки' }); } catch (e) {} } else { const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = name; l.click(); }
    track('report_shared', { c: 'quick_' + kind }, false);
    if (!localStorage.getItem('bp_first_report')) { localStorage.setItem('bp_first_report', String(Date.now())); track('first_report', null, false); const g = await import('./grow.js'); setTimeout(() => g.installSheet(_pro.backup), 1200); } };
  d.querySelector('#qpdf').onclick = async () => { const b = d.querySelector('#qpdf'); b.disabled = true; b.textContent = 'Собираю PDF…';
    try { const { canvasToPdf } = await import('./pdf.js'); await send(await canvasToPdf(cv, 'BodyPassport'), base + '.pdf', 'application/pdf', 'pdf'); } catch (e) { toast('Не удалось собрать PDF: ' + e.message); }
    b.disabled = false; b.innerHTML = `${ic('file-text', 's')}PDF`; };
  d.querySelector('#qpng').onclick = async () => send(await new Promise(r => cv.toBlob(r, 'image/png')), base + '.png', 'image/png', 'png');
}

const loadImg = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
function wrap(g, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t; }
  if (line) { g.fillText(line, x, y); y += lh; } return y; }
/** Отчет 1080 px шириной: шапка, 4 фото с линиями, ЗАМЕР, что видно, ГИПОТЕЗА специалиста, рекомендации, юридическая строка. */
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
  shown.forEach((v, k) => { const x0 = PAD + k * (cw + 24), p = photos[v.id], im = imgs[v.id], pts = p.pts;
    let bx = 0, by = 0, bw = p.w, bh = p.h; if (pts) { const ys = EDIT_POINTS[v.id].map(i => pts[i].y), xs = EDIT_POINTS[v.id].map(i => pts[i].x); const top = Math.min(...ys), bot = Math.max(...ys), hh = (bot - top) * 1.35, cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      bh = Math.min(p.h, hh); bw = Math.min(p.w, bh / 2); by = Math.max(0, Math.min(p.h - bh, top - (bot - top) * .2)); bx = Math.max(0, Math.min(p.w - bw, cx - bw / 2)); }
    g.save(); g.beginPath(); g.roundRect(x0, y, cw, ch, 18); g.clip(); g.fillStyle = '#111'; g.fillRect(x0, y, cw, ch);
    const sc = Math.min(cw / bw, ch / bh), dw = bw * sc, dh = bh * sc, ox = x0 + (cw - dw) / 2, oy = y + (ch - dh) / 2; g.drawImage(im, bx, by, bw, bh, ox, oy, dw, dh);
    if (pts) { const X = i => ox + (pts[i].x - bx) * sc, Y = i => oy + (pts[i].y - by) * sc;
      const ax = v.id === 'right' ? pts[P.R_ANKLE].x : v.id === 'left' ? pts[P.L_ANKLE].x : (pts[P.L_ANKLE].x + pts[P.R_ANKLE].x) / 2;
      g.strokeStyle = '#FBBF24'; g.lineWidth = 2; g.setLineDash([7, 6]); g.beginPath(); g.moveTo(ox + (ax - bx) * sc, y); g.lineTo(ox + (ax - bx) * sc, y + ch); g.stroke(); g.setLineDash([]);
      g.strokeStyle = LN; g.lineWidth = 3; for (const [m, n] of LINES[v.id]) { g.beginPath(); g.moveTo(X(m), Y(m)); g.lineTo(X(n), Y(n)); g.stroke(); }
      for (const i of EDIT_POINTS[v.id]) { g.beginPath(); g.arc(X(i), Y(i), 5, 0, 7); g.fillStyle = '#fff'; g.fill(); } }
    g.restore(); g.fillStyle = SUB; g.font = `600 22px ${F}`; g.textAlign = 'center'; g.fillText(v.name, x0 + cw / 2, y + ch + 32); g.textAlign = 'left'; });
  y += ch + 70;
  const head = (t, tag, col) => { breaks.push(y - 40); g.fillStyle = INK; g.font = `800 32px ${F}`; g.fillText(t, PAD, y); if (tag) { const tw = g.measureText(t).width; g.font = `700 16px ${F}`; const w2 = g.measureText(tag).width + 18;
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.roundRect(PAD + tw + 16, y - 24, w2, 30, 8); g.stroke(); g.fillStyle = col; g.fillText(tag, PAD + tw + 25, y - 3); } y += 22; };
  // фигура в позе клиента с подтвержденными зонами в цветах задач (клиентская палитра); усиление только если специалист включил
  const qz = a.quick || {}, zones = qz.zones || [], gain = qz.gain || 1;
  const figs = []; for (const view of ['front', 'right']) { const im = await asClient(() => posedFigure(zSpots(zones), poseOf({ by: qz.by, h: qz.h || 170 }, gain), view, 400, 880)); if (im) figs.push(im); }
  if (figs.length) { y += 30; head('Положение тела', '', INK); y += 16; const fw = 300, fh = 660, gap = 60, x0 = (W - fw * figs.length - gap * (figs.length - 1)) / 2;
    figs.forEach((im, n) => { const x = x0 + n * (fw + gap); g.strokeStyle = '#F59E0B'; g.lineWidth = 2; g.setLineDash([8, 7]); g.beginPath(); g.moveTo(x + fw / 2, y); g.lineTo(x + fw / 2, y + fh); g.stroke(); g.setLineDash([]); g.drawImage(im, x, y, fw, fh);
      g.fillStyle = SUB; g.font = `600 20px ${F}`; g.textAlign = 'center'; g.fillText(n ? 'Справа' : 'Спереди', x + fw / 2, y + fh + 28); g.textAlign = 'left'; });
    y += fh + 56; g.fillStyle = SUB; g.font = `400 20px ${F}`; y = wrap(g, 'Положение на типовой фигуре по фото, а не тело клиента. Цветом отмечены зоны для работы, пунктир: вертикаль.', PAD, y, W - PAD * 2, 28);
    if (gain > 1) { g.fillStyle = '#B45309'; g.font = `700 22px ${F}`; y = wrap(g, `Показано с увеличением ×${String(gain).replace('.', ',')}, не реальный масштаб. Числа ниже реальные.`, PAD, y + 4, W - PAD * 2, 30); }
    y += 40; }
  // коротко: 2–3 понятные фразы без чисел, как на экране «Показать клиенту»
  const plain = plainObs(qz.by); if (plain.length) { head('Коротко', '', INK); g.fillStyle = INK; g.font = `600 27px ${F}`; for (const t of plain) { y += 42; g.fillText('• ' + t, PAD, y); } y += 60; }
  // измерено: только значения вне погрешности, остальные одной строкой (специалист видит все в приложении)
  head('Измерено', 'ЗАМЕР', INK); let inTol = 0;
  for (const v of VIEWS) { const m = (qz.by || {})[v.id]; if (!m) continue; const outs = m.filter(r => r.dir !== 'в пределах погрешности'); inTol += m.length - outs.length; if (!outs.length) continue;
    y += 44; g.fillStyle = SUB; g.font = `700 19px ${F}`; g.fillText(v.name.toUpperCase(), PAD, y);
    for (const r of outs) { y += 38; g.fillStyle = INK; g.font = `500 25px ${F}`; g.fillText(`${r.name}: ${r.dir}`, PAD, y); g.font = `600 24px ${M ? MN : F}`; g.textAlign = 'right'; g.fillText(`${num(r.v)}${r.unit.trim() === '°' ? '°' : r.unit}`, W - PAD, y); g.textAlign = 'left'; } }
  if (inTol) { y += 40; g.fillStyle = SUB; g.font = `400 21px ${F}`; g.fillText(`Еще ${inTol} ${inTol % 10 === 1 && inTol % 100 !== 11 ? 'значение' : [2, 3, 4].includes(inTol % 10) && ![12, 13, 14].includes(inTol % 100) ? 'значения' : 'значений'} в пределах погрешности`, PAD, y); }
  if (zones.length || a.note) { y += 60; head('Над чем работаем', 'ГИПОТЕЗА СПЕЦИАЛИСТА', VIO); y += 10;
    for (const gr of taskGroups(zones)) { y += 40; g.fillStyle = { WEAK: '#C2410C', HYPER: '#A16207', SHORT: '#1D4ED8' }[gr.k] || INK; g.font = `700 26px ${F}`; const t = gr.t + ': '; g.fillText(t, PAD, y); const tw = g.measureText(t).width; g.fillStyle = INK; g.font = `500 26px ${F}`;
      y = wrap(g, gr.list.join(', '), PAD + tw, y, W - PAD * 2 - tw, 36) - 36; }
    if (a.note) { y += 14; g.fillStyle = INK; g.font = `400 25px ${F}`; for (const para of a.note.split('\n')) y = wrap(g, para, PAD, y + 30, W - PAD * 2, 34); } }
  // рекомендации: упражнения из существующих карточек зон и текст специалиста
  const exIds = zones.length ? plan(zSpots(zones).map(z => ({ ...z, k: z.k }))).slice(0, 4) : [], exs = exIds.map(id => C.exercises[id]).filter(Boolean);
  if (exs.length || (a.plan && a.plan.text)) { y += 60; head('Рекомендации специалиста', '', INK); y += 10; g.fillStyle = INK; g.font = `400 25px ${F}`;
    exs.forEach((e, n) => { y = wrap(g, `${n + 1}. ${e.title.split(' (')[0]}${e.dose ? ': ' + e.dose : ''}`, PAD, y + 30, W - PAD * 2, 34) - 4; });
    if (a.plan && a.plan.text) for (const para of a.plan.text.split('\n')) y = wrap(g, para, PAD, y + 30, W - PAD * 2, 34); }
  y += 50; breaks.push(y - 20); g.fillStyle = SUB; g.font = `400 21px ${F}`;
  y = wrap(g, 'Замер по фото. Показаны значения больше погрешности замера. Положение на фото зависит от стойки в момент съемки.', PAD, y, W - PAD * 2, 30);
  g.fillStyle = INK; g.font = `700 22px ${F}`; y = wrap(g, LEGAL, PAD, y + 10, W - PAD * 2, 30);
  y += 30; g.fillStyle = BAND; g.fillRect(0, y, W, 120); g.fillStyle = '#fff'; g.font = `700 26px ${F}`; g.fillText(author, PAD, y + 52);
  g.font = `400 21px ${F}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(contact ? 'Запись: ' + contact : 'Сделано в BodyPassport', PAD, y + 86);
  if (contact) { g.textAlign = 'right'; g.fillText('Сделано в BodyPassport', W - PAD, y + 86); g.textAlign = 'left'; }
  y += 120;
  const out = document.createElement('canvas'); out.width = W; out.height = y; out.getContext('2d').drawImage(cv, 0, 0); out.breaks = breaks; return out;
}
