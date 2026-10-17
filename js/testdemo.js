// Схема шага теста на экране камеры: подпись «лицом / боком к телефону», мини-план сверху (где телефон, куда смотреть)
// и сама схема движения. Схемы движения нарисованы сбоку, поэтому без плана люди разворачивались боком на наклоне вперед.
import { exFigure } from './exfig.js';

const INK = '#0B1B3B', BRAND = '#0B1B3B', HOT = '#EF4444';
const FACE = { front: 'Лицом к телефону', side: 'Правым боком к телефону', back: 'Спиной к телефону' };
// поворот фигуры на плане: 0 — смотрит на телефон (вниз), 90 — правое плечо к телефону, 180 — спиной
const ROT = { front: 0, side: -90, back: 180 };

/** Плечи, голова и нос человека сверху; rot — куда он повернут относительно телефона. */
const person = (cx, cy, rot, s = 1, extra = '') => `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${s})">
  <ellipse cx="0" cy="0" rx="26" ry="11" fill="#E9E5DC" stroke="${INK}" stroke-width="2.5"/>${extra}
  <circle cx="0" cy="0" r="10" fill="#fff" stroke="${INK}" stroke-width="2.5"/><path d="M-4 9 L0 16 L4 9 Z" fill="${INK}"/></g>`;
const phone = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-9" y="-15" width="18" height="30" rx="4" fill="${BRAND}"/><circle cx="0" cy="-10" r="2" fill="#fff"/></g>`;

/** Мини-план сверху: телефон внизу, человек повернут как нужно. */
export function planView(facing = 'front') {
  return `<svg viewBox="0 0 90 110" width="78" height="96" aria-hidden="true"><rect x="1" y="1" width="88" height="108" rx="14" fill="#F5F6FA"/>
    <text x="45" y="14" text-anchor="middle" font-size="9" fill="#566079" font-family="Manrope,sans-serif">вид сверху</text>
    ${person(45, 46, ROT[facing] ?? 0, .9)}<path d="M45 64 L45 78" stroke="#9AA3AB" stroke-width="2" stroke-dasharray="3 3"/>${phone(45, 92)}</svg>`;
}

/** Повороты корпуса сверху: таз и стопы на месте (пунктир), плечи ходят вправо-влево, телефон внизу. */
function trotPlan() {
  const anim = `<animateTransform attributeName="transform" type="rotate" values="0;-45;0;45;0" keyTimes="0;.25;.5;.75;1" dur="4s" repeatCount="indefinite"/>`;
  return `<svg viewBox="0 0 220 240" width="100%" style="max-height:44vh" aria-hidden="true">
    <text x="110" y="18" text-anchor="middle" font-size="13" fill="#566079" font-family="Manrope,sans-serif">вид сверху</text>
    <g transform="translate(110 110)">
      <path d="M-58 32 A66 66 0 0 0 58 32" fill="none" stroke="${HOT}" stroke-width="4" stroke-linecap="round" marker-start="url(#ta)" marker-end="url(#ta)"/>
      <ellipse cx="-14" cy="16" rx="6" ry="10" fill="#9AA3AB"/><ellipse cx="14" cy="16" rx="6" ry="10" fill="#9AA3AB"/>
      <g>${anim}<ellipse cx="0" cy="0" rx="46" ry="16" fill="#E9E5DC" stroke="${INK}" stroke-width="3"/>
        <path d="M-20 4 L20 4" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="0" cy="0" r="14" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M-5 13 L0 22 L5 13 Z" fill="${INK}"/></g>
      <ellipse cx="0" cy="4" rx="30" ry="12" fill="none" stroke="#566079" stroke-width="2.5" stroke-dasharray="5 4"/></g>
    <defs><marker id="ta" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0 0 L7 3.5 L0 7 Z" fill="${HOT}"/></marker></defs>
    <text x="110" y="190" text-anchor="middle" font-size="12" fill="#566079" font-family="Manrope,sans-serif">таз и стопы на месте</text>
    ${phone(110, 214)}</svg>`;
}

/** Блок схемы для экрана камеры: подпись направления, план сверху и схема движения. */
export function testDemo(id, facing = 'front') {
  const chip = `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:${BRAND};color:#fff;font:600 15px Manrope,sans-serif">${FACE[facing] || FACE.front}</div>`;
  if (id === 'test_trot') return `<div style="text-align:center">${chip}<div style="font:600 17px Manrope,sans-serif;color:${INK};margin-top:8px">Плечи вправо и влево, как будто смотрите за спину</div>${trotPlan()}</div>`;
  // человек повторяет картинку: стоит лицом или спиной к телефону, значит и фигура нарисована спереди, а не в профиль
  const FV = { test_squat: 'test_squat_f', test_slb: 'test_slb_f', test_sls: 'test_sls_f', test_sls_left: 'test_sls_f_right' };
  if (facing !== 'side' && FV[id]) id = FV[id];
  // наклон и дыхание остаются в профиль (спереди наклон не виден): телефон рисуем перед фигурой, чтобы было видно, куда наклоняться
  const front = facing === 'front' && /^test_(fwd|breath)$/.test(id);
  return `<div>${chip}<div style="display:flex;align-items:center;gap:8px;margin-top:8px">
    <div style="flex:1;min-width:0;position:relative">${exFigure(id, { size: '100%' })}${front ? `<div style="position:absolute;right:0;top:50%;transform:translateY(-50%);text-align:center"><svg width="26" height="40" viewBox="-13 -20 26 40">${phone(0, 0)}</svg><div style="font:500 10px Manrope,sans-serif;color:#566079">телефон</div></div>` : ''}</div>
    <div style="flex:none">${planView(facing)}</div></div></div>`;
}
