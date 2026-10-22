// «Быстрый тест» (ТЗ v4): клиент → согласие → 4 фото → точки с правкой → замер → отчет.
// Фото, точки, выводы и имя клиента остаются на телефоне специалиста (IndexedDB кабинета), на сервер не уходят.
import { _pro, proHome, clientCard } from './pro.js';
import { go, esc, ic, toast } from './app.js';
import { cam, startCamera, stopCamera, detectStill, initPose, startMotion, phone, cameraBlocked, openInBrowserSheet } from './core.js';
import { VIEWS, EDIT_POINTS, POINT_NAMES, quickMetrics, viewMetrics, observations, frameIssue } from './quick-metrics.js';
import { P } from './analysis.js';
import { track } from './track.js';

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
function shoot(i, single = false) {
  const v = VIEWS[i];
  go(`<div class="cam qcam" style="display:flex;flex-direction:column">
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
    <div id="qbox" style="position:relative;margin-top:10px;touch-action:none;user-select:none;-webkit-user-select:none"><canvas id="qcv" style="width:100%;display:block;border-radius:14px;background:#111"></canvas><canvas id="qloupe" width="240" height="240" style="position:absolute;top:8px;left:8px;width:120px;height:120px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.4);display:none;pointer-events:none"></canvas></div>
    <p class="sub" style="font-size:13px;margin-top:6px">Проверьте точки. Неточную перетащите пальцем: лупа покажет место.</p>
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pill${showGrid ? ' on' : ''}" id="qgrid">Сетка</button><button class="pill${showPlumb ? ' on' : ''}" id="qplumb">Отвес</button><button class="pill" id="qretake">${ic('camera', 's')} Переснять</button></div>
    <div id="qm" style="margin-top:12px"></div>
   </div>
   <div class="dock"><button class="btn" id="qok">${ic('check', 's')}Все точки верны</button></div></div>`);
  const cv = $('#qcv'), lp = $('#qloupe'), img = new Image(); let drag = -1, s = 1;
  const pts = () => x.pts || [];
  const draw = () => { if (!img.complete) return; const W = cv.clientWidth * devicePixelRatio; s = W / x.w; cv.width = W; cv.height = x.h * s; const g = cv.getContext('2d');
    g.drawImage(img, 0, 0, cv.width, cv.height); const p = pts(); if (!p.length) return;
    if (showGrid) { g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(cv.width * k / 8, 0); g.lineTo(cv.width * k / 8, cv.height); g.stroke(); g.beginPath(); g.moveTo(0, cv.height * k / 12 * 1.5); g.lineTo(cv.width, cv.height * k / 12 * 1.5); g.stroke(); } }
    if (showPlumb) { const ax = v.id === 'right' ? p[P.R_ANKLE].x : v.id === 'left' ? p[P.L_ANKLE].x : (p[P.L_ANKLE].x + p[P.R_ANKLE].x) / 2; g.strokeStyle = '#FBBF24'; g.lineWidth = 2 * devicePixelRatio; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(ax * s, 0); g.lineTo(ax * s, cv.height); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = 'rgba(108,99,255,.95)'; g.lineWidth = 2.5 * devicePixelRatio;
    for (const [a, b] of LINES[v.id]) { g.beginPath(); g.moveTo(p[a].x * s, p[a].y * s); g.lineTo(p[b].x * s, p[b].y * s); g.stroke(); }
    for (const k of EDIT_POINTS[v.id]) { g.beginPath(); g.arc(p[k].x * s, p[k].y * s, (k === drag ? 9 : 6.5) * devicePixelRatio, 0, 7); g.fillStyle = k === drag ? '#FF7A45' : '#fff'; g.fill(); g.lineWidth = 2 * devicePixelRatio; g.strokeStyle = '#6C63FF'; g.stroke(); }
  };
  const metrics = () => { const m = viewMetrics(v.id, x.pts, x.w, x.h, x.roll, heightCm()); $('#qm').innerHTML = m ? metricRows(m) : '<p class="sub">Точки не найдены: переснимите фото или загрузите другое.</p>'; };
  const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * x.w, y: (e.clientY - r.top) / r.height * x.h, cx: e.clientX - r.left, cy: e.clientY - r.top, rw: r.width }; };
  const loupe = (q) => { const g = lp.getContext('2d'), z = 3, half = 120 / z / (cv.clientWidth / x.w); g.clearRect(0, 0, 240, 240);
    g.drawImage(img, q.x - half, q.y - half, half * 2, half * 2, 0, 0, 240, 240); g.strokeStyle = '#FF7A45'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 96); g.lineTo(120, 144); g.moveTo(96, 120); g.lineTo(144, 120); g.stroke();
    lp.style.display = 'block'; lp.style.left = q.cx < q.rw / 2 ? 'auto' : '8px'; lp.style.right = q.cx < q.rw / 2 ? '8px' : 'auto'; };
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
  $('#qgrid').onclick = () => { showGrid = !showGrid; localStorage.setItem('bp_q_grid', showGrid ? '1' : '0'); $('#qgrid').classList.toggle('on', showGrid); draw(); };
  $('#qplumb').onclick = () => { showPlumb = !showPlumb; localStorage.setItem('bp_q_plumb', showPlumb ? '1' : '0'); $('#qplumb').classList.toggle('on', showPlumb); draw(); };
  $('#qretake').onclick = () => { Q.wasBack = cam.back; cam.back = true; shoot(i, true); };
  $('#back').onclick = () => { if (confirm('Выйти без сохранения? Фото этого теста удалятся.')) { Q = null; proHome(); } };
  $('#qok').onclick = () => { if (!x.pts) return toast('На этом фото нет точек: переснимите'); x.ok = true;
    const n = VIEWS.findIndex(w => !Q.views[w.id] || !Q.views[w.id].ok); n < 0 ? results() : editor(n); };
}
const heightCm = () => +((Q && Q.client && Q.client.height) || 0) || 0;
const num = v => String(Math.abs(v)).replace('.', ',');
const metricRows = m => `<div class="group">${m.map(r => `<div class="row" style="min-height:52px;gap:10px;align-items:flex-start;padding:10px 14px"><span style="font:700 10px var(--font);letter-spacing:.06em;color:var(--src-measured);border:1px solid var(--line);border-radius:6px;padding:2px 5px;flex:none;margin-top:2px">ЗАМЕР</span><span style="flex:1;font-size:14px;line-height:1.35">${r.name}<br><span class="sub" style="font-size:13px">${r.dir}</span></span><b style="font-size:15px;white-space:nowrap">${num(r.v)}${r.unit} <span class="sub" style="font-weight:500;font-size:12px">±${num(r.err)}</span></b></div>`).join('')}</div>`;

// ---------- 5. результат: измерено → что видно → вывод специалиста → действие ----------
function results() {
  const q = quickMetrics(Q.views, heightCm()), obs = observations(q.by);
  Q.metrics = q; Q.obs = obs;
  go(`<div class="scr fade" style="padding-bottom:120px"><div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>Замер · ${esc(Q.client.nocard ? 'без карточки' : Q.client.name)}</b></div></div>
   <div class="pad" style="display:flex;flex-direction:column;gap:14px;margin-top:8px">
    <p class="sub" style="font-size:13px;line-height:1.4">Замер по фото, погрешность указана у каждого значения. Без оценок «норма / не норма»: выводы делает специалист.</p>
    ${VIEWS.filter(v => q.by[v.id]).map(v => `<div><div class="eyebrow">${v.name}</div>${metricRows(q.by[v.id])}</div>`).join('')}
    <div><div class="eyebrow">Что видно</div><div class="card" style="font-size:15px;line-height:1.5">${obs.length ? obs.map(t => '• ' + esc(t)).join('<br>') : 'Все значения в пределах погрешности'}</div></div>
    <div><div class="eyebrow">Вывод специалиста · ГИПОТЕЗА</div><textarea id="qcon" class="field" rows="3" maxlength="1200" placeholder="Ваш вывод по замеру. В отчете будет с пометкой «гипотеза специалиста»" style="height:auto;padding:12px 16px">${esc(Q.note || '')}</textarea></div>
    <div><div class="eyebrow">Рекомендации специалиста</div><textarea id="qrec" class="field" rows="3" maxlength="1200" placeholder="Что делать клиенту: упражнения, повторный замер" style="height:auto;padding:12px 16px">${esc(Q.rec || '')}</textarea></div>
   </div>
   <div class="dock"><button class="btn" id="qsave">${ic('file-text', 's')}Сохранить и отчет</button></div></div>`);
  $('#back').onclick = () => editor(3);
  $('#qsave').onclick = async () => { Q.note = $('#qcon').value.trim(); Q.rec = $('#qrec').value.trim(); const id = await save(); report(id); };
}
async function save() {
  const c = Q.client; if (!(await row('clients', c.id))) await _pro.put('clients', { ...c }); else if (Q.consent && !Q.consent.reused) await _pro.put('clients', { ...(await row('clients', c.id)), consent: Q.consent });
  const id = _pro.uid(), q = Q.metrics, prev = (await _pro.all('assessments')).filter(a => a.clientId === c.id).sort((a, b) => b.date - a.date)[0];
  const a = { id, clientId: c.id, date: Q.date, template: 'quick', templateName: 'Быстрый тест', quick: { by: q.by, obs: Q.obs, views: VIEWS.filter(v => Q.views[v.id]).map(v => v.id), edited: VIEWS.filter(v => Q.views[v.id] && Q.views[v.id].edited).map(v => v.id) },
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
  const W = 1080, PAD = 64, F = 'Manrope, system-ui, sans-serif', INK = '#0B1B3B', SUB = '#566079', VIO = '#5148E0';
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
      g.strokeStyle = 'rgba(108,99,255,.95)'; g.lineWidth = 3; for (const [m, n] of LINES[v.id]) { g.beginPath(); g.moveTo(X(m), Y(m)); g.lineTo(X(n), Y(n)); g.stroke(); }
      for (const i of EDIT_POINTS[v.id]) { g.beginPath(); g.arc(X(i), Y(i), 5, 0, 7); g.fillStyle = '#fff'; g.fill(); } }
    g.restore(); g.fillStyle = SUB; g.font = `600 22px ${F}`; g.textAlign = 'center'; g.fillText(v.name, x0 + cw / 2, y + ch + 32); g.textAlign = 'left'; });
  y += ch + 70;
  const head = (t, tag, col) => { breaks.push(y - 40); g.fillStyle = INK; g.font = `800 32px ${F}`; g.fillText(t, PAD, y); if (tag) { const tw = g.measureText(t).width; g.font = `700 16px ${F}`; const w2 = g.measureText(tag).width + 18;
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.roundRect(PAD + tw + 16, y - 24, w2, 30, 8); g.stroke(); g.fillStyle = col; g.fillText(tag, PAD + tw + 25, y - 3); } y += 22; };
  head('Измерено', 'ЗАМЕР', INK);
  for (const v of VIEWS) { const m = a.quick.by[v.id]; if (!m) continue; y += 50; g.fillStyle = SUB; g.font = `700 20px ${F}`; g.fillText(v.name.toUpperCase(), PAD, y); y += 8;
    for (const r of m) { y += 40; g.fillStyle = INK; g.font = `500 26px ${F}`; g.fillText(r.name, PAD, y); const val = `${num(r.v)}${r.unit} ±${num(r.err)}`; g.font = `700 26px ${F}`; g.textAlign = 'right'; g.fillText(val, W - PAD, y); g.textAlign = 'left';
      y += 30; g.fillStyle = SUB; g.font = `400 21px ${F}`; g.fillText(r.dir, PAD, y); g.strokeStyle = '#ECEEF4'; g.lineWidth = 1; g.beginPath(); g.moveTo(PAD, y + 16); g.lineTo(W - PAD, y + 16); g.stroke(); } }
  y += 70; head('Что видно', '', INK); y += 18; g.fillStyle = INK; g.font = `400 26px ${F}`;
  for (const t of (a.quick.obs && a.quick.obs.length ? a.quick.obs : ['Все значения в пределах погрешности'])) y = wrap(g, '• ' + t, PAD, y + 8, W - PAD * 2, 36);
  if (a.note) { y += 50; head('Вывод специалиста', 'ГИПОТЕЗА', VIO); y += 18; g.fillStyle = INK; g.font = `400 26px ${F}`; for (const para of a.note.split('\n')) y = wrap(g, para, PAD, y + 8, W - PAD * 2, 36); }
  if (a.plan && a.plan.text) { y += 50; head('Рекомендации специалиста', '', INK); y += 18; g.fillStyle = INK; g.font = `400 26px ${F}`; for (const para of a.plan.text.split('\n')) y = wrap(g, para, PAD, y + 8, W - PAD * 2, 36); }
  y += 50; breaks.push(y - 20); g.fillStyle = SUB; g.font = `400 21px ${F}`;
  y = wrap(g, 'Замер по фото с погрешностью, указанной у каждого значения. Положение на фото зависит от стойки в момент съемки.', PAD, y, W - PAD * 2, 30);
  g.fillStyle = INK; g.font = `700 22px ${F}`; y = wrap(g, LEGAL, PAD, y + 10, W - PAD * 2, 30);
  y += 30; g.fillStyle = '#0B1B3B'; g.fillRect(0, y, W, 120); g.fillStyle = '#fff'; g.font = `700 26px ${F}`; g.fillText(author, PAD, y + 52);
  g.font = `400 21px ${F}`; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(contact ? 'Запись: ' + contact : 'Сделано в BodyPassport', PAD, y + 86);
  if (contact) { g.textAlign = 'right'; g.fillText('Сделано в BodyPassport', W - PAD, y + 86); g.textAlign = 'left'; }
  y += 120;
  const out = document.createElement('canvas'); out.width = W; out.height = y; out.getContext('2d').drawImage(cv, 0, 0); out.breaks = breaks; return out;
}
