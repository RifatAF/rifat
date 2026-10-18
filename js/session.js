// Режим «Сеанс» для администратора: жалобы → 1–3 коротких теста → правка руками → тот же тест → «было → стало».
// Включается в Администрировании (bp_session_mode). Видео не пишется и не уходит с телефона, расчеты на устройстве;
// в сеть уходит только пара чисел замеров и только с согласия (bp_session_share).
import { C, voice, startMotion, initPose, drawSilhouette, ic, toast, saveBlob } from './core.js';
import { analyze } from './analysis.js';
import { track } from './track.js';
import { meSync } from './auth.js';
import { go, esc, runProtocol, UNITS, sortUnits, secs, baBlock, bindBa, spots, topOf, plan, ex } from './app.js';
import { exName } from './coach.js';
import { COMPLAINTS, pickUnits, compare, observations, fmtVal, SESSION_FEATURES, VERDICT_TEXT, CLASS_TEXT } from './session-protocol.js';
import { sessionSheet } from './white-label-pdf.js';

export const sessionOn = () => { const u = meSync(); return !!(u && u.admin) && localStorage.getItem('bp_session_mode') === '1'; };
const ctlOn = () => localStorage.getItem('bp_session_ctl') === '1';
const $ = s => document.querySelector(s);
const unitSec = u => secs(UNITS[u] || []);
const LS = 'bp_sessions', uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// записи сеансов отдельно от тестов клиента и базы специалиста: без записи движения, последние 20
function store(rec) { try { const l = JSON.parse(localStorage.getItem(LS) || '[]'); l.push(rec); localStorage.setItem(LS, JSON.stringify(l.slice(-20))); } catch (e) {} }
const strip = r => { const { poses, ...t } = r; return t; };
const camHint = r => r.setup ? { bodyFrac: r.setup.bodyFrac, roll: r.setup.roll, pitch: r.setup.pitch, back: r.setup.back } : null;
const featOf = t => Object.fromEntries(Object.entries(analyze(t, C).f || {}).filter(([k, v]) => SESSION_FEATURES[k] && Number.isFinite(v)));
const qOf = t => { const v = Object.values(t.quality || {}).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
// пара в калибровку: только числа признаков, без видео, имени и мышечных процентов. Демо-результат без камеры не отправляем
function sendPair(a, b, control) { if (localStorage.getItem('bp_session_share') !== '1' || a.beta || b.beta) return; try {
  const gap = Math.round((b.date - a.date) / 1000);
  fetch('/api/calib?a=pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ workout: !control, session: true, control, gap, gapMin: Math.round(gap / 60), ex: 0, f1: featOf(a), f2: featOf(b), m1: {}, m2: {}, q1: qOf(a), q2: qOf(b) }) }).catch(() => {});
  track('retest_pair', { c: control ? 'session_ctl' : 'session' }, false); } catch (e) {} }

const top = (back, title, sub) => `<div class="top-bar"><button class="round" id="back" aria-label="Назад">${ic('chevron-left')}</button><div class="t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
const startCam = async btn => { voice.unlock(); startMotion(); if (btn) btn.textContent = 'Загружаю модель…'; try { await initPose(); return true; } catch (e) { toast('Не удалось загрузить модель: ' + e.message); return false; } };

/** 1. Жалобы → набор тестов. */
export function sessionStart(back) {
  const pick = new Set(JSON.parse(localStorage.getItem('bp_session_last') || '[]'));
  const draw = () => { const units = pickUnits([...pick], unitSec, sortUnits), sec = units.reduce((a, u) => a + unitSec(u), 0);
    go(`<div class="scr fade">${top(back, 'Сеанс', 'тест, правка, повтор')}
      <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);padding-bottom:var(--s4)">
      <b>Что беспокоит</b><div class="row" style="flex-wrap:wrap;gap:8px">${COMPLAINTS.map(([k, n]) => `<button class="pill${pick.has(k) ? ' on' : ''}" data-c="${k}" style="min-height:44px">${n}</button>`).join('')}</div>
      <div class="card"><b style="font-size:15px">Тест: ${units.length} ${units.length === 1 ? 'шаг' : 'шага'}, около ${sec} с</b><div class="sub" style="font-size:14px;margin-top:4px">${units.map(u => esc((UNITS[u] || [[u]])[0][0])).join(' · ')}</div></div>
      <label class="card row" style="align-items:flex-start"><input type="checkbox" class="check" id="shr" ${localStorage.getItem('bp_session_share') === '1' ? 'checked' : ''}><div style="flex:1"><b style="font-size:15px">Клиент согласен помочь калибровке</b><div class="sub" style="font-size:13px">Уйдут только числа замеров до и после, без видео и имени</div></div></label>
      </div><div class="dock"><button class="btn" id="go">Начать тест</button></div></div>`);
    $('#back').onclick = back;
    document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const k = b.dataset.c; pick.has(k) ? pick.delete(k) : pick.add(k); draw(); });
    $('#shr').onchange = e => localStorage.setItem('bp_session_share', e.target.checked ? '1' : '0');
    $('#go').onclick = async () => { localStorage.setItem('bp_session_last', JSON.stringify([...pick])); if (!await startCam($('#go'))) return draw();
      track('session_start', { n: units.length }, false);
      const r = await runProtocol(units, { session: true, specialist: true, repeat: true, onCancel: () => sessionStart(back) }); if (!r) return;
      const s = { id: uid(), complaints: [...pick], first: r, back }; store({ id: s.id, role: 'pre', session: true, date: r.date, protocol: r.protocol, camHint: camHint(r), complaints: s.complaints, t: strip(r) });
      if (ctlOn()) return control(s); advice(s); };
  };
  draw();
}

/** Контрольный повтор без вмешательства: из таких пар считается чистый разброс теста. */
async function control(s) {
  go(`<div class="scr fade">${top(s.back, 'Контрольный повтор', 'без правки')}<div class="pad" style="display:flex;flex-direction:column;gap:var(--s3)">
    <p style="font-size:17px;line-height:1.45">Телефон не трогайте. Клиент повторяет тот же тест сразу, без перерыва и без правки.</p></div>
    <div class="dock"><button class="btn" id="go">Повторить сразу</button><button class="btn ghost" id="no">Пропустить</button></div></div>`);
  $('#back').onclick = () => advice(s); $('#no').onclick = () => advice(s);
  $('#go').onclick = async () => { if (!await startCam($('#go'))) return;
    const r = await runProtocol(s.first.protocol, { session: true, specialist: true, repeat: true, noSafety: true, target: s.first.setup, onCancel: () => advice(s) }); if (!r) return;
    const gapMin = Math.round((r.date - s.first.date) / 60000); store({ id: uid(), pairId: s.id, role: 'control', control: true, session: true, date: r.date, gapMin, protocol: r.protocol, camHint: camHint(r), t: strip(r) });
    sendPair(s.first, r, true); advice(s); };
}

/** 2. Что видно и с чем поработать, кнопка повтора с таймером. */
function advice(s) {
  const t = s.first, f = featOf(t), seen = observations(f);
  let acts = []; try { acts = [...new Set(plan(topOf(spots(analyze(t, C)))).map(id => ex(id)).filter(Boolean).map(exName))].slice(0, 3); } catch (e) {}
  s.seen = seen.map(x => x.text); s.acts = acts;
  go(`<div class="scr fade">${top(s.back, 'Что видно', 'до правки')}<div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);padding-bottom:var(--s4)">
    ${seen.length ? `<div class="group">${seen.map(x => `<div class="row" style="min-height:52px;gap:10px"><span style="color:var(--short-t)">${ic('info', 's')}</span><span style="flex:1;font-size:16px">${esc(x.text)}</span></div>`).join('')}</div>`
      : '<div class="card"><b>Заметных отклонений в этих движениях нет</b></div>'}
    ${acts.length ? `<b>С чем поработать</b><div class="group">${acts.map((a, i) => `<div class="row" style="min-height:48px;gap:10px"><span class="step-n" style="width:22px">${i + 1}</span><span style="flex:1;font-size:15px">${esc(a)}</span></div>`).join('')}</div>` : ''}
    <p class="sub" style="font-size:13px">После правки повторите тот же тест: сравним по тем же движениям.</p></div>
    <div class="dock"><button class="btn" id="go" style="height:64px">Повторить тест <span class="num" id="tmr" style="opacity:.75;margin-left:6px">0:00</span></button></div></div>`);
  $('#back').onclick = () => { if (confirm('Выйти из сеанса? Первый тест сохранен.')) s.back(); };
  const t0 = t.date, tick = () => { const el = $('#tmr'); if (!el) return; const sec = Math.floor((Date.now() - t0) / 1000); el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; setTimeout(tick, 1000); }; tick();
  $('#go').onclick = () => placeLikeFirst(s);
}

/** 3. Телефон как в первый раз: контур первого кадра и подсказки по постановке. */
function placeLikeFirst(s) {
  const h = camHint(s.first) || {};
  go(`<div class="scr dark fade" style="background:var(--cam-bg,#0A0C0F);color:#fff">${top(s.back, 'Поставьте телефон как в первый раз', '')}
    <div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);align-items:center"><canvas id="ghost" style="width:min(70vw,260px);height:min(60vh,420px);border:1.5px dashed rgba(255,255,255,.35);border-radius:20px"></canvas>
    <p style="font-size:16px;line-height:1.45;text-align:center;opacity:.85">Та же точка и высота телефона${h.back != null ? `, ${h.back ? 'основная' : 'фронтальная'} камера` : ''}. Клиент встает на то же место: в кадре подскажу ближе или дальше.</p></div>
    <div class="dock dark-dock" style="margin-top:auto"><button class="btn white" id="go">Начать повтор</button></div></div>`);
  $('#back').onclick = () => advice(s);
  drawSilhouette($('#ghost'), h.bodyFrac > 0 ? h : undefined);
  $('#go').onclick = async () => { if (!await startCam($('#go'))) return;
    const r = await runProtocol(s.first.protocol, { session: true, specialist: true, repeat: true, noSafety: true, target: s.first.setup, onCancel: () => advice(s) }); if (!r) return;
    const gapMin = Math.round((r.date - s.first.date) / 60000); store({ id: uid(), pairId: s.id, role: 'post', session: true, date: r.date, gapMin, protocol: r.protocol, camHint: camHint(r), t: strip(r) });
    sendPair(s.first, r, false); track('session_done', { n: gapMin }, false); result(s, r, gapMin); };
}

const COLOR = { better: 'var(--ok-t)', worse: 'var(--over-t)', same: 'var(--sub)', fluct: 'var(--sub)' };
/** 4. Было → стало: слайдер фигуры, признаки с единицами и честный итог. */
function result(s, r, gapMin) {
  const { rows, verdict } = compare(featOf(s.first), featOf(r), C.weights && C.weights.retest);
  const order = { better: 0, worse: 1, fluct: 2, same: 3 }, list = rows.slice().sort((x, y) => order[x.c] - order[y.c]);
  go(`<div class="scr fade">${top(s.back, 'Было → стало', `через ${gapMin} мин`)}<div class="pad" style="display:flex;flex-direction:column;gap:var(--s3);padding-bottom:var(--s4)">
    <div class="card"><b style="font-size:19px">${VERDICT_TEXT[verdict]}</b><p class="sub" style="font-size:14px;margin-top:4px">Наблюдение за одно занятие</p></div>
    ${baBlock('sba')}
    <div class="group">${list.map(x => `<div class="row" style="min-height:56px;gap:10px;align-items:center"><div style="flex:1;min-width:0"><span style="font-size:15px">${esc(SESSION_FEATURES[x.key].name)}</span><small style="display:block;font-size:12px;color:${COLOR[x.c]}">${CLASS_TEXT[x.c]}</small></div><span class="num" style="white-space:nowrap;color:${x.c === 'better' || x.c === 'worse' ? COLOR[x.c] : 'var(--text)'}">${fmtVal(x.key, x.a)} → ${fmtVal(x.key, x.b)}</span></div>`).join('') || '<div class="row" style="min-height:52px">Нет признаков для сравнения</div>'}</div>
    <p class="sub" style="font-size:13px;line-height:1.45">Погрешность у каждого признака своя, по повторам теста без вмешательства. Изменение меньше погрешности не считается. Сразу после работы небольшое ухудшение чаще колебание, чем откат.</p></div>
    <div class="dock"><button class="btn line" id="pdf">${ic('file-text', 's')}Лист клиенту</button><button class="btn" id="ok">Готово</button></div></div>`);
  $('#back').onclick = $('#ok').onclick = () => s.back();
  bindBa('sba', s.first, r, { list: false });
  $('#pdf').onclick = async () => { try { const { canvasToPdf } = await import('./pdf.js');
    const cv = sessionSheet({ date: new Date(r.date), seen: observations(featOf(r)).map(x => x.text), todo: s.acts || [], retest: new Date(r.date + 7 * 864e5) });
    saveBlob(await canvasToPdf(cv, 'BodyPassport'), `bodypassport-${new Date(r.date).toISOString().slice(0, 10)}.pdf`); } catch (e) { toast('Не удалось собрать лист: ' + e.message); } };
}
