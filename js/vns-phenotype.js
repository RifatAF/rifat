// ВНС-фенотип v2.0, фаза 1 (телефон в руках, 30–40 см от лица): окуломоторный блок «Жидкая частица», 2,3 секунды.
// 0,0–2,0 с: сфера без текста плавно идет по петле Лемниската (бесконечность), 2,0–2,3 с: схлопывается в центр и вспыхивает в углу (Saccadic Snap).
// Считываем: плавность слежения (Smooth Pursuit, подзатылочный зажим C0–C2), латентность саккады (норма 180–220 мс), rPPG по коже лба.
// Fallback Guard: уверенность глаз < 0.80 или взгляд в сторону > 25° — данные тихо помечаются INVALID, без ошибок на экране.
import { passiveOn } from './session-controller.js';

export const DUR = 2300, SNAP_AT = 2000;
/** Точка на лемнискате Бернулли, t 0..1 — один полный проход. */
export function lemniscate(t, w, h) { const a = Math.PI * 2 * t, s = Math.sin(a), c = Math.cos(a), d = 1 + s * s;
  return { x: w / 2 + (w * .38) * c / d, y: h / 2 + (h * .22) * s * c / d }; }

/** Уверенность глаз и поворот головы по точкам лица из MediaPipe Pose (0 нос, 2 и 5 глаза, 7 и 8 уши). */
export function gazeGuard(p) {
  if (!p) return { conf: 0, yaw: 90 }; const conf = Math.min(p[2].visibility ?? 0, p[5].visibility ?? 0);
  const dl = Math.abs(p[0].x - p[7].x), dr = Math.abs(p[8].x - p[0].x), yaw = Math.atan2(Math.abs(dl - dr), (dl + dr) / 2 || 1) * 180 / Math.PI;
  return { conf, yaw };
}
/** Слежение: корреляция горизонтального сдвига середины глаз с целью и запаздывание реакции на вспышку. */
export function pursuitStats(samples) {
  const v = samples.filter(s => s.eye && s.t < SNAP_AT); if (v.length < 12) return null;
  const mx = a => a.reduce((x, y) => x + y, 0) / a.length, tx = v.map(s => s.tx), ex = v.map(s => s.eye.x), mt = mx(tx), me = mx(ex);
  let num = 0, dt = 0, de = 0; for (let i = 0; i < v.length; i++) { num += (tx[i] - mt) * (ex[i] - me); dt += (tx[i] - mt) ** 2; de += (ex[i] - me) ** 2; }
  const corr = num / Math.sqrt(dt * de || 1);
  // рывки слежения: доля кадров со скачком больше трехкратного медианного шага
  const st = ex.slice(1).map((x, i) => Math.abs(x - ex[i])).sort((a, b) => a - b), md = st[st.length >> 1] || 1e-6, jumps = st.filter(x => x > md * 3).length / st.length;
  return { smooth: Math.round(Math.max(0, corr) * 100) / 100, jumps: Math.round(jumps * 100) / 100 };
}
export function saccadeLatency(samples) {
  const after = samples.filter(s => s.eye && s.t >= SNAP_AT); const before = samples.filter(s => s.eye && s.t < SNAP_AT).slice(-3); if (!before.length || after.length < 2) return null;
  const y0 = before.reduce((a, s) => a + s.eye.y, 0) / before.length, x0 = before.reduce((a, s) => a + s.eye.x, 0) / before.length;
  const mv = after.find(s => Math.hypot(s.eye.x - x0, s.eye.y - y0) > 3); return mv ? Math.round(mv.t - SNAP_AT) : null;
}
/** rPPG: средний зеленый канал на коже лба; пульс по интервалам между пиками (за 2,3 с — грубая оценка, помечается). */
export function rppg(trace) {
  if (trace.length < 30) return { hr: null, valid: false }; const g = trace.map(x => x.g), m = g.reduce((a, b) => a + b, 0) / g.length, d = g.map(x => x - m);
  const sm = d.map((_, i) => (d[i - 1] ?? d[i]) * .25 + d[i] * .5 + (d[i + 1] ?? d[i]) * .25), peaks = [];
  for (let i = 1; i < sm.length - 1; i++) if (sm[i] > sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > 0 && (!peaks.length || trace[i].t - trace[peaks.at(-1)].t > 330)) peaks.push(i);
  if (peaks.length < 2) return { hr: null, valid: false };
  const ibi = peaks.slice(1).map((p, i) => trace[p].t - trace[peaks[i]].t), mean = ibi.reduce((a, b) => a + b, 0) / ibi.length, hr = Math.round(60000 / mean);
  const sdnn = Math.round(Math.sqrt(ibi.reduce((a, b) => a + (b - mean) ** 2, 0) / ibi.length));
  return { hr: hr >= 40 && hr <= 180 ? hr : null, hrv: sdnn, valid: hr >= 40 && hr <= 180, rough: true };
}

/** Запуск блока поверх root. getFrame() → { pose, w, h, t }, video — элемент камеры. Возвращает итог или null в режиме специалиста. */
export async function runOculomotor(root, getFrame, video) {
  if (!passiveOn()) return null;
  const cv = document.createElement('canvas'), W = root.clientWidth || 360, H = root.clientHeight || 640; cv.width = W; cv.height = H;
  cv.style.cssText = 'position:absolute;inset:0;z-index:20;background:#0B1A20'; root.appendChild(cv); const ctx = cv.getContext('2d');
  const probe = document.createElement('canvas'); probe.width = 16; probe.height = 8; const px = probe.getContext('2d', { willReadFrequently: true });
  const samples = [], trace = []; let invalid = 0, total = 0; const t0 = performance.now();
  await new Promise(done => { const frame = () => { const t = performance.now() - t0; if (t >= DUR) return done();
    ctx.clearRect(0, 0, W, H); let x, y, r = 22;
    if (t < SNAP_AT) ({ x, y } = lemniscate(t / SNAP_AT, W, H));
    else { const k = Math.min(1, (t - SNAP_AT) / 60); x = W / 2; y = H / 2; r = 22 * (1 - k); if (k >= 1) { x = W - 40; y = 60; r = 26; } }
    const gr = ctx.createRadialGradient(x - r * .3, y - r * .3, 2, x, y, r); gr.addColorStop(0, '#E8FFF4'); gr.addColorStop(1, '#2BD47D'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, 7); ctx.fill();
    const f = getFrame(); if (f && f.pose) { total++; const gg = gazeGuard(f.pose);
      if (gg.conf < .8 || gg.yaw > 25) invalid++; else { const e = { x: (f.pose[2].x + f.pose[5].x) / 2, y: (f.pose[2].y + f.pose[5].y) / 2 }; samples.push({ t, tx: x, eye: e }); }
      // лоб: между бровями и линией волос, над серединой глаз
      try { const ex = (f.pose[2].x + f.pose[5].x) / 2, ey = (f.pose[2].y + f.pose[5].y) / 2, iw = Math.abs(f.pose[2].x - f.pose[5].x) || 20;
        px.drawImage(video, ex - iw, ey - iw * 1.4, iw * 2, iw * .8, 0, 0, 16, 8); const d = px.getImageData(0, 0, 16, 8).data; let g = 0; for (let i = 1; i < d.length; i += 4) g += d[i]; trace.push({ t, g: g / 128 }); } catch (er) {} }
    requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
  cv.remove();
  const status = !total || invalid / total > .5 ? 'INVALID' : 'OK';
  return { status, pursuit: status === 'OK' ? pursuitStats(samples) : null, saccadeMs: status === 'OK' ? saccadeLatency(samples) : null, ppg: rppg(trace), frames: total };
}
