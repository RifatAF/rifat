// Оценка ЦНС по фоновым замерам (глаза, касания, набор текста) и подробная расшифровка для бета-режима:
// что намерили, норма, что это значит, почему так бывает, как замер развесился по мышцам и что делать.
// Пульс по камере не используем: на телефонах он ошибался.
import { C } from './core.js';
import { cnsDelta } from './muscle-logic.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fx = (v, d = 0) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
const cl = v => Math.max(0, Math.min(1, v));
const n = v => typeof v === 'number' && Number.isFinite(v);

/** Безопасная копия замеров с чужого телефона: только числа и известные поля. */
export function cleanCns(vns, touch) {
  const num = v => n(v) ? v : null, out = {};
  if (vns && typeof vns === 'object') out.vns = { status: vns.status === 'OK' ? 'OK' : 'INVALID', reasons: Array.isArray(vns.reasons) ? vns.reasons.filter(x => typeof x === 'string' && /^[a-z_]{1,20}$/.test(x)).slice(0, 4) : [],
    validFrac: num(vns.validFrac), saccadeMs: num(vns.saccadeMs), pursuit: vns.pursuit && typeof vns.pursuit === 'object' ? { corr: num(vns.pursuit.corr), catchUp: num(vns.pursuit.catchUp) } : null };
  if (touch && typeof touch === 'object') { const ty = touch.typing && typeof touch.typing === 'object' ? touch.typing : null;
    out.touch = { holdMs: num(touch.holdMs), samples: num(touch.samples) || 0, swipes: num(touch.swipes) || 0, reversalsPerSwipe: num(touch.reversalsPerSwipe) || 0,
      typing: ty ? { ikiMs: num(ty.ikiMs), cv: num(ty.cv), rel: num(ty.rel), corrections: num(ty.corrections), keys: num(ty.keys) || 0, dwellMs: num(ty.dwellMs) } : null }; }
  return out;
}

// замеры: значение, норма, отклонение 0…1, что значит, почему бывает, что делать
const MEASURES = [
  { id: 'saccade', name: 'Реакция глаз', get: t => t.vns && t.vns.status === 'OK' ? t.vns.saccadeMs : null, val: v => `${Math.round(v)} мс`, norm: '180–220 мс',
    dev: v => v < 180 ? cl((180 - v) / 50) : v > 220 ? cl((v - 220) / 80) : 0,
    mean: v => v < 180 ? 'Глаза срываются к цели раньше обычного: нервная система «настороже».' : v > 220 ? 'Глаза реагируют медленнее обычного: усталость или заторможенность.' : 'Реакция в норме.',
    why: v => v < 180 ? 'Стресс, кофеин, недосып, тревога. Тело держит защитный тонус: шея и верх плеч напряжены.' : v > 220 ? 'Усталость, недосып, после нагрузки или болезни, лекарства с седативным эффектом.' : '',
    todo: v => v < 180 ? 'Дыхание с длинным выдохом (вдох 4 с, выдох 6 с) 3 минуты перед занятием, расслабление трапеций и лестничных.' : v > 220 ? 'Перенести силовую нагрузку, сначала мягкая мобилизация. Повторить тест после сна.' : '' },
  { id: 'pursuit', name: 'Плавность слежения', get: t => t.vns && t.vns.status === 'OK' && t.vns.pursuit && n(t.vns.pursuit.corr) && t.vns.pursuit.corr > .1 ? t.vns.pursuit.corr : null, val: v => `${Math.round(v * 100)}%`, norm: 'от 75%',
    dev: v => cl((.75 - v) / .45), mean: v => v < .75 ? 'Взгляд ведет цель рывками, а не плавно.' : 'Слежение плавное.',
    why: v => v < .75 ? 'Подзатылочные мышцы (C0–C2) связаны с глазодвигательными рефлексами: при их зажиме слежение рвется. Также усталость глаз, головокружение, последствия хлыстовой травмы.' : '',
    todo: v => v < .75 ? 'Расслабление подзатылочных, кивки головой, упражнения «взгляд за пальцем» по 30 с. Если есть головокружение, показать неврологу.' : '' },
  { id: 'catchup', name: 'Догоняющие движения глаз', get: t => t.vns && t.vns.status === 'OK' && t.vns.pursuit && n(t.vns.pursuit.catchUp) ? t.vns.pursuit.catchUp : null, val: v => fx(v, 1), norm: 'до 3',
    dev: v => cl((v - 3) / 4), mean: v => v > 3 ? 'Глаза не успевают за целью и догоняют скачками.' : 'Глаза успевают за целью.',
    why: v => v > 3 ? 'Напряжение шейно-затылочной зоны, усталость, сниженная концентрация.' : '', todo: v => v > 3 ? 'Те же упражнения на шею и глаза, перерывы от экрана каждые 40 минут.' : '' },
  { id: 'hold', name: 'Удержание пальца на экране', get: t => t.touch && t.touch.samples >= 3 ? t.touch.holdMs : null, val: v => `${Math.round(v)} мс`, norm: '70–110 мс',
    dev: v => v > 110 ? cl((v - 110) / 100) : 0, mean: v => v > 160 ? 'Палец задерживается заметно дольше обычного.' : v > 110 ? 'Касания чуть длиннее нормы.' : 'Касания в норме.',
    why: v => v > 110 ? 'Общий мышечный тонус повышен: при тревоге мышцы кисти и предплечья не отпускают сразу. Также холодные руки, неуверенность в интерфейсе.' : '',
    todo: v => v > 110 ? 'Разгрузка предплечий и трапеций, дыхание с длинным выдохом. Сравнить со следующим тестом.' : '' },
  { id: 'typing', name: 'Скорость набора к вашей норме', get: t => t.touch && t.touch.typing && t.touch.typing.keys >= 8 ? t.touch.typing.rel : null, val: v => `×${fx(v, 2)}`, norm: '×0,8–1,3',
    dev: v => v > 1.3 ? cl((v - 1.1) / .6) : 0, mean: v => v > 1.3 ? 'Печатаете медленнее, чем обычно.' : 'Скорость как обычно.',
    why: v => v > 1.3 ? 'Усталость, стресс, недосып. Считаем только относительно ваших прошлых анкет: между людьми разница больше эффекта.' : '',
    todo: v => v > 1.3 ? 'Снизить нагрузку в этот день, больше восстановления, повторить тест в спокойном состоянии.' : '' },
  { id: 'typing_cv', name: 'Ровность ритма набора', get: t => t.touch && t.touch.typing && t.touch.typing.keys >= 8 ? t.touch.typing.cv : null, val: v => fx(v, 2), norm: 'до 0,75',
    dev: v => cl((v - .5) / .5), mean: v => v > .75 ? 'Паузы между символами скачут.' : 'Ритм ровный.',
    why: v => v > .75 ? 'Рассеянное внимание, отвлечения, повышенный тонус плечевого пояса.' : '', todo: v => v > .75 ? 'Расслабление верха трапеций, короткая пауза перед тестом.' : '' },
  { id: 'typing_err', name: 'Исправления при наборе', get: t => t.touch && t.touch.typing && t.touch.typing.keys >= 8 ? t.touch.typing.corrections : null, val: v => `${Math.round(v * 100)}%`, norm: 'до 20%',
    dev: v => cl((v - .1) / .3), mean: v => v > .2 ? 'Много исправлений.' : 'Исправлений мало.',
    why: v => v > .2 ? 'Спешка и напряжение, мелкая моторика под стрессом теряет точность.' : '', todo: v => v > .2 ? 'Разгрузка предплечий, дыхание, проходить тест без спешки.' : '' },
];
const EYE_WHY = { no_face: 'лицо не было в кадре', iris_conf: 'камера плохо видела глаза (свет, очки)', gaze_angle: 'взгляд уходил от экрана', model: 'не загрузилась модель лица' };

/** Оценка ЦНС: 0–100 (100 — спокойная), уровень и список замеров. null — ничего не измерено. */
export function cnsScore(t) {
  const rows = MEASURES.map(m => { const v = m.get(t || {}); return n(v) ? { m, v, d: m.dev(v) } : null; }).filter(Boolean);
  if (!rows.length) return null;
  // худший замер весит вдвое: одно сильное отклонение важнее нескольких нормальных
  const worst = Math.max(...rows.map(r => r.d)), avg = rows.reduce((x, r) => x + r.d, 0) / rows.length, score = Math.round(100 * (1 - Math.min(1, (avg + worst * 2) / 3)));
  const level = score >= 80 ? { k: 'ok', name: 'Спокойная', text: 'Нервная система не добавляет напряжения мышцам' } : score >= 60 ? { k: 'mid', name: 'Напряжение', text: 'Есть признаки стресса или усталости, они усиливают зажимы' } : { k: 'bad', name: 'Перегрузка', text: 'Нервная система держит защитный тонус: сначала расслабление, потом сила' };
  return { score, level, rows, eyes: t.vns ? (t.vns.status === 'OK' ? 'OK' : EYE_WHY[(t.vns.reasons || [])[0]] || 'мало данных') : 'не было' };
}
const COL = { ok: 'var(--ok-t)', mid: '#B5651D', bad: 'var(--short-t)' };

/** Короткая карточка: балл, уровень, сколько замеров. */
export function cnsScoreCard(t, { title = 'Оценка ЦНС' } = {}) {
  const s = cnsScore(t); if (!s) return '';
  return `<div class="row" style="gap:14px;align-items:center"><div style="width:60px;height:60px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;border:4px solid ${COL[s.level.k]};font:700 20px/1 var(--mono, monospace);color:${COL[s.level.k]}">${s.score}</div>
    <div style="flex:1;min-width:0"><div class="eyebrow">${title}</div><b style="font-size:17px;color:${COL[s.level.k]}">${s.level.name}</b><div style="font-size:13px;color:var(--sub);line-height:1.35">${s.level.text}. Замеров: ${s.rows.length}${s.eyes !== 'OK' ? `, глаза: ${esc(s.eyes)}` : ''}</div></div></div>`;
}

/** Подробная расшифровка (бета): замеры, причины, развесовка по мышцам, что делать.
 *  withS / withoutS — пятна карты с ЦНС и без нее, findings — находки анализа. */
export function cnsDetail(t, findings, withS, withoutS) {
  const s = cnsScore(t); if (!s) return '<div style="font-size:14px;color:var(--sub)">Фоновые замеры не записались</div>';
  const fired = findings.filter(f => f.rule.source === 'cns'), d = cnsDelta(withS, withoutS), mn = id => (C.muscles[id] || {}).name || id;
  const ST = { SHORT: 'гипертонус', WEAK: 'слабость', HYPER: 'перерастяжение', OVERLOAD: 'перегрузка' };
  const rows = s.rows.map(({ m, v, d: dv }) => `<div style="padding:10px 0;border-top:1px solid var(--line-2)"><div class="row" style="gap:8px"><b style="flex:1;font-size:15px">${m.name}</b><b class="num" style="color:${dv > .3 ? 'var(--short-t)' : dv > 0 ? COL.mid : 'var(--ok-t)'}">${m.val(v)}</b></div>
      <div style="font-size:12px;color:var(--faint)">норма ${m.norm} · вклад в оценку ${Math.round(dv * 100)}%</div>
      <div style="font-size:14px;margin-top:4px;line-height:1.4">${m.mean(v)}</div>
      ${m.why(v) ? `<div style="font-size:13px;color:var(--sub);margin-top:4px;line-height:1.4"><b>Почему так бывает:</b> ${m.why(v)}</div>` : ''}
      ${m.todo(v) ? `<div style="font-size:13px;margin-top:4px;line-height:1.4"><b>Что делать:</b> ${m.todo(v)}</div>` : ''}</div>`).join('');
  const weights = fired.length ? fired.map(f => { const ts = (f.rule.muscles || []).map(x => `${esc(mn(x.id))} (${ST[x.state] || x.state}, вес ${fx(x.w, 2)})`).join(', ');
      return `<div style="margin-top:8px;font-size:13px;line-height:1.4"><b>${esc(f.observed)}</b><br>→ ${ts || 'без привязки к мышцам'}</div>`; }).join('')
    : '<div style="margin-top:8px;font-size:13px;color:var(--sub)">Ни один замер не вышел за порог: на карту мышц ЦНС не повлияла</div>';
  const delta = [['SHORT', 'гипертонус'], ['HYPER', 'перерастяжение'], ['WEAK', 'слабость']].filter(([k]) => d.scores[k]).map(([k, nm]) => `${d.scores[k] > 0 ? '+' : ''}${d.scores[k]}% ${nm}`).join(' · ');
  const mus = d.muscles.slice(0, 6).map(x => `${esc(mn(x.id))} ${x.side === 'LEFT' ? 'слева' : 'справа'} ${x.d > 0 ? '+' : ''}${x.d}%`).join(' · ');
  return `<div style="font-size:13px;color:var(--sub);line-height:1.4">Оценка = 100 минус среднее отклонение замеров, худший замер весит вдвое. 80+ спокойная, 60–79 напряжение, ниже 60 перегрузка.</div>
    ${rows}
    <div style="padding-top:10px;border-top:1px solid var(--line-2)"><b style="font-size:15px">Как замеры развесились по мышцам</b>
      <div style="font-size:13px;color:var(--sub);margin-top:4px;line-height:1.4">Замер за порогом добавляет мышцам тон с весом из правила. Вес у замеров ЦНС меньше, чем у камеры (0,1–0,35): они в основном усиливают то, что видно в движении. Если несколько замеров бьют в одну мышцу, веса складываются.</div>
      ${weights}
      ${delta ? `<div style="margin-top:8px;font-size:13px"><b>Итог по карте:</b> ${delta}</div>` : ''}${mus ? `<div style="margin-top:4px;font-size:13px;color:var(--sub)">${mus}</div>` : ''}</div>`;
}
