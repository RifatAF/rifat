// ВНС-фенотип v2.0, фаза 1: телефон в руках, 30–40 см от лица. Окуломоторный блок «Жидкая частица», 2,3 секунды.
//
//   Все это спрятано в экран загрузки перед тестом: человек видит красивый загрузчик и сам следит за каплей.
//   Пока идет настоящая загрузка, капля «дышит» в центре: проверяем лицо и расстояние, копим rPPG.
//   0,00–2,00 с  Smooth Pursuit: WebGL-сфера плавно идет по лемнискате Бернулли (∞). Слежение — подзатылочный зажим C0–C2.
//   2,00–2,06 с  сфера схлопывается в центр.
//   2,06–2,30 с  Saccadic Snap: вспышка в верхнем углу. Латентность саккады, норма 180–220 мс.
//   Все время: rPPG по коже лба (алгоритм POS) — пульс и HRV.
//
// Глаза: MediaPipe Face Landmarker (478 точек, точки 468–477 — ирисы) + матрица поворота головы + blendshapes моргания.
// Fallback Guard: если уверенность ириса < 0,80 или угол взора > 25°, кадр тихо помечается INVALID; при доле
// валидных кадров меньше 60% весь блок — INVALID. На экране никаких ошибок: человек просто идет дальше.
// Только SELF_TEST: в режиме специалиста блок не запускается.
import { passiveOn } from './session-controller.js';

export const T = { PURSUIT: 2000, COLLAPSE: 60, END: 2300, LEAD: 1500 };
export const FLASH_AT = T.PURSUIT + T.COLLAPSE;
export const GUARD = { irisConf: .8, gazeDeg: 25, validFrac: .6 };
export const SACCADE_NORM = [180, 220];

// ---------- геометрия стимула ----------
/** Точка лемнискаты Бернулли, t 0..1 — полный проход «восьмерки». */
export function lemniscate(t, w, h) { const a = Math.PI * 2 * t, s = Math.sin(a), c = Math.cos(a), d = 1 + s * s;
  return { x: w / 2 + (w * .36) * c / d, y: h / 2 + (h * .2) * s * c / d }; }
/** Положение цели в момент t (мс от старта стимула). */
export function stimulusAt(t, w, h) {
  if (t < T.PURSUIT) return { ...lemniscate(t / T.PURSUIT, w, h), r: 1, flash: 0 };
  if (t < FLASH_AT) { const k = (t - T.PURSUIT) / T.COLLAPSE, a = lemniscate(1, w, h); return { x: a.x + (w / 2 - a.x) * k, y: a.y + (h / 2 - a.y) * k, r: 1 - k, flash: 0 }; }
  return { x: w * .86, y: h * .12, r: .7, flash: Math.max(0, 1 - (t - FLASH_AT) / 240) };
}

// ---------- WebGL-сцена загрузчика: «жидкая частица» ----------
// Метаболы: ведущая капля и три капли шлейфа сливаются в одну жидкую форму. Фон — медленное «северное сияние».
// В финале капля схлопывается в центр, а в правом верхнем углу вспыхивает звезда «готово» (это и есть стимул саккады).
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;uniform vec2 res;uniform float time,rad,flash,fade;uniform vec2 b0,b1,b2,b3;
float ball(vec2 q,vec2 c,float r){vec2 d=q-c;return r*r/max(dot(d,d),1.);}
vec2 grad(vec2 q,vec2 c,float r){vec2 d=q-c;float l=dot(d,d)+r*r*.6;return -2.*r*r*d/(l*l);}
void main(){vec2 q=gl_FragCoord.xy;q.y=res.y-q.y;vec2 uv=q/res;
 vec3 bg=mix(vec3(.024,.075,.09),vec3(.04,.16,.18),smoothstep(1.2,0.,length(uv-vec2(.5,.45))*1.6));
 float a=sin(uv.x*3.+time*.35)*sin(uv.y*2.2-time*.27);bg+=vec3(.0,.10,.08)*smoothstep(.2,1.,a)*.6;
 float f=ball(q,b0,rad)+ball(q,b1,rad*.78)+ball(q,b2,rad*.6)+ball(q,b3,rad*.45);
 vec3 col=bg+vec3(.17,.83,.55)*min(f,1.)*.18;
 vec2 g=grad(q,b0,rad)+grad(q,b1,rad*.78)+grad(q,b2,rad*.6)+grad(q,b3,rad*.45);
 // нормаль жидкой поверхности по градиенту поля метаболов; край сглажен, без «лесенки»
 float e=clamp((f-1.)/(f+.6),0.,1.);vec3 n=normalize(vec3(-g*rad*.9,e*1.2+.25));vec3 L=normalize(vec3(-.45,-.6,.65));
 float dif=max(dot(n,L),0.),sp=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),28.),rim=pow(1.-n.z,2.);
 vec3 liq=mix(vec3(.04,.36,.30),vec3(.35,.95,.70),dif)+sp*.85+rim*vec3(.3,1.,.75)*.55;
 col=mix(col,liq,smoothstep(.9,1.1,f));
 vec2 st=vec2(res.x*.86,res.y*.12),d=q-st;float r=length(d)/(res.x*.05);float ang=atan(d.y,d.x);
 float rays=pow(abs(cos(ang*2.)),36.)*exp(-r*.35)+pow(abs(cos(ang*2.+.785)),60.)*exp(-r*.6);
 col+=flash*(vec3(1.,.98,.9)*exp(-r*r*1.6)+vec3(.7,1.,.9)*rays*.9);
 gl_FragColor=vec4(col*fade,1.);}`;
/** Сцена загрузчика. WebGL, при его отсутствии — Canvas 2D (простая капля). */
export function createLiquidScene(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false }) || canvas.getContext('experimental-webgl');
  if (gl) { const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (gl.getProgramParameter(pr, gl.LINK_STATUS)) { gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = n => gl.getUniformLocation(pr, n), U = Object.fromEntries(['res', 'time', 'rad', 'flash', 'fade', 'b0', 'b1', 'b2', 'b3'].map(n => [n, u(n)])); canvas.__gl = gl;
      return { kind: 'webgl', draw({ pts, r, time, flash = 0, fade = 1 }) { const k = canvas.width / (canvas.clientWidth || 1); gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(U.res, canvas.width, canvas.height); gl.uniform1f(U.time, time); gl.uniform1f(U.rad, r * k); gl.uniform1f(U.flash, flash); gl.uniform1f(U.fade, fade);
          ['b0', 'b1', 'b2', 'b3'].forEach((n, i) => gl.uniform2f(U[n], pts[i].x * k, pts[i].y * k)); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
        dispose() { try { gl.flush(); gl.deleteBuffer(b); gl.deleteProgram(pr); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) {} } }; } }
  const ctx = canvas.getContext('2d');
  return { kind: '2d', draw({ pts, r, flash = 0, fade = 1 }) { const k = canvas.width / (canvas.clientWidth || 1), W = canvas.clientWidth, H = canvas.clientHeight; ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.globalAlpha = 1; ctx.fillStyle = '#06131A'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = fade;
      pts.forEach((p, i) => { const rr = r * [1, .78, .6, .45][i]; const g = ctx.createRadialGradient(p.x - rr * .3, p.y - rr * .3, 1, p.x, p.y, rr); g.addColorStop(0, '#C9FFE6'); g.addColorStop(1, '#14A07A'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.fill(); });
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,240,${flash})`; ctx.beginPath(); ctx.arc(W * .86, H * .12, 18, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }, dispose() {} };
}

// ---------- глаза и голова по Face Landmarker ----------
export const LM = { R_IRIS: 468, L_IRIS: 473, R_OUT: 33, R_IN: 133, R_UP: 159, R_LO: 145, L_IN: 362, L_OUT: 263, L_UP: 386, L_LO: 374, FOREHEAD: [10, 109, 67, 338, 297, 151] };
const D = 180 / Math.PI;
/** Поворот головы из матрицы 4×4 (по столбцам): yaw — влево-вправо, pitch — вверх-вниз, в градусах. */
export function headPose(m) {
  if (!m || m.length < 16) return { yaw: 0, pitch: 0, roll: 0 }; const R = (r, c) => m[c * 4 + r];
  return { yaw: Math.asin(Math.max(-1, Math.min(1, -R(2, 0)))) * D, pitch: Math.atan2(R(2, 1), R(2, 2)) * D, roll: Math.atan2(R(1, 0), R(0, 0)) * D };
}
/** Положение ириса внутри глаза: h и v от −1 до 1 (0 — по центру), среднее двух глаз; open — раскрытие век. */
export function irisInEye(lm) {
  const one = (iris, a, b, up, lo) => { const cx = (lm[a].x + lm[b].x) / 2, cy = (lm[up].y + lm[lo].y) / 2, hw = Math.abs(lm[b].x - lm[a].x) / 2 || 1e-6, hh = Math.abs(lm[lo].y - lm[up].y) / 2 || 1e-6;
    return { h: (lm[iris].x - cx) / hw, v: (lm[iris].y - cy) / hh, open: hh / hw }; };
  const r = one(LM.R_IRIS, LM.R_OUT, LM.R_IN, LM.R_UP, LM.R_LO), l = one(LM.L_IRIS, LM.L_IN, LM.L_OUT, LM.L_UP, LM.L_LO);
  return { h: (r.h + l.h) / 2, v: (r.v + l.v) / 2, open: (r.open + l.open) / 2, x: (lm[LM.R_IRIS].x + lm[LM.L_IRIS].x) / 2, y: (lm[LM.R_IRIS].y + lm[LM.L_IRIS].y) / 2 };
}
/** Уверенность ириса 0..1: глаза открыты (blendshapes), ирис внутри глаза, веки раскрыты. */
export function irisConfidence(eye, blend) {
  // у открытого глаза eyeBlink обычно 0,2–0,3; закрытие начинается с 0,4 (проверено на портрете из тестов MediaPipe)
  const blink = blend ? Math.max(blend.eyeBlinkLeft || 0, blend.eyeBlinkRight || 0) : 0, bf = blink <= .4 ? 1 : Math.max(0, 1 - (blink - .4) / .3);
  const inside = Math.max(0, 1 - Math.max(0, Math.abs(eye.h) - .9) * 5) * Math.max(0, 1 - Math.max(0, Math.abs(eye.v) - 1.2) * 5);
  const open = Math.min(1, eye.open / .12);
  return Math.round(bf * inside * open * 100) / 100;
}
const EYE_H_DEG = 35, EYE_V_DEG = 20; // ирис у края глаза ≈ 35° по горизонтали, 20° по вертикали
/** Угол взора относительно камеры, градусы: голова + глаза в орбите. */
export function gazeAngles(head, eye) { const h = head.yaw + eye.h * EYE_H_DEG, v = head.pitch + eye.v * EYE_V_DEG; return { h, v, total: Math.hypot(h, v) }; }
/** Расстояние до лица по диаметру радужки (≈ 11,7 мм у взрослых), см. f — фокус в пикселях кадра. */
export function faceDistanceCm(lm, w, f = w * .78) { const px = (Math.abs(lm[469].x - lm[471].x) + Math.abs(lm[474].x - lm[476].x)) / 2 * w; return px > 1 ? Math.round(f * 1.17 / px) : null; }

// ---------- метрики ----------
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function corr(a, b) { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); }
/** Плавное слежение: корреляция взгляда с целью по горизонтали, усиление (gain) и догоняющие саккады.
 *  samples: [{ t, tx, gh }] — t мс, tx цель по горизонтали в градусах, gh взгляд по горизонтали в градусах (уже в системе экрана). */
export function pursuitStats(samples) {
  const v = samples.filter(s => s.ok && s.t < T.PURSUIT); if (v.length < 15) return null;
  const tx = v.map(s => s.tx), gx = v.map(s => s.gh), c = corr(tx, gx);
  const vel = a => a.slice(1).map((x, i) => (x - a[i]) / Math.max(1, v[i + 1].t - v[i].t) * 1000);
  const tv = vel(tx), gv = vel(gx), rms = a => Math.sqrt(mean(a.map(x => x * x)));
  const gain = rms(tv) > 1e-6 ? rms(gv) / rms(tv) : 0;
  // догоняющая саккада: скорость взгляда в 3 раза выше скорости цели и больше 60°/с
  const catchUp = gv.filter((x, i) => Math.abs(x) > Math.max(60, Math.abs(tv[i]) * 3)).length;
  return { corr: Math.round(c * 100) / 100, gain: Math.round(gain * 100) / 100, catchUp, n: v.length };
}
/** Латентность саккады на вспышку: первый кадр после вспышки, где взгляд сместился к углу больше шума фиксации. */
export function saccadeLatency(samples) {
  const pre = samples.filter(s => s.ok && s.t >= T.PURSUIT && s.t < FLASH_AT), post = samples.filter(s => s.ok && s.t >= FLASH_AT);
  const base = samples.filter(s => s.ok && s.t >= FLASH_AT - 200 && s.t < FLASH_AT); const ref = base.length ? base : pre; if (!ref.length || post.length < 2) return null;
  const bx = mean(ref.map(s => s.gh)), by = mean(ref.map(s => s.gv)), noise = Math.max(1.5, Math.sqrt(mean(ref.map(s => (s.gh - bx) ** 2 + (s.gv - by) ** 2))) * 3);
  // вспышка справа сверху от центра экрана: взгляд уходит вправо и вверх
  const hit = post.find(s => Math.hypot(s.gh - bx, s.gv - by) > noise && (s.gh - bx) > 0);
  if (!hit) return null; const ms = Math.round(hit.t - FLASH_AT); return ms >= 80 && ms <= 600 ? ms : null;
}
/** rPPG по алгоритму POS (Wang и др., 2017): трасса средних R, G, B кожи лба → пульс (уд/мин) и HRV (RMSSD, мс). */
export function rppg(trace) {
  if (trace.length < 45) return { hr: null, hrv: null, valid: false, sec: trace.length ? Math.round((trace.at(-1).t - trace[0].t) / 100) / 10 : 0 };
  const mr = mean(trace.map(x => x.r)), mg = mean(trace.map(x => x.g)), mb = mean(trace.map(x => x.b));
  const s1 = trace.map(x => x.g / mg - x.b / mb), s2 = trace.map(x => x.g / mg + x.b / mb - 2 * x.r / mr);
  const sd = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2))) || 1e-9, alpha = sd(s1) / sd(s2);
  let h = s1.map((x, i) => x + alpha * s2[i]); const m = mean(h); h = h.map(x => x - m);
  // сглаживание по трем кадрам и поиск пиков не чаще 180 уд/мин
  const sm = h.map((_, i) => ((h[i - 1] ?? h[i]) + h[i] * 2 + (h[i + 1] ?? h[i])) / 4), peaks = [];
  for (let i = 1; i < sm.length - 1; i++) if (sm[i] > sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > 0 && (!peaks.length || trace[i].t - trace[peaks.at(-1)].t >= 333)) peaks.push(i);
  const sec = (trace.at(-1).t - trace[0].t) / 1000; if (peaks.length < 3) return { hr: null, hrv: null, valid: false, sec: Math.round(sec * 10) / 10 };
  const ibi = peaks.slice(1).map((p, i) => trace[p].t - trace[peaks[i]].t), mi = mean(ibi), hr = Math.round(60000 / mi);
  const rmssd = ibi.length > 2 ? Math.round(Math.sqrt(mean(ibi.slice(1).map((x, i) => (x - ibi[i]) ** 2)))) : null;
  const ok = hr >= 42 && hr <= 180;
  return { hr: ok ? hr : null, hrv: ok ? rmssd : null, valid: ok, sec: Math.round(sec * 10) / 10, rough: sec < 10 };
}

// ---------- загрузка модели ----------
let facePromise = null;
const MP_LOCAL = new URL('../vendor/mediapipe', import.meta.url).href, MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20';
export const FACE_MODEL = 'models/face_landmarker.task';
export function loadFace() {
  if (facePromise) return facePromise;
  facePromise = (async () => {
    let base = MP_LOCAL, mod; try { mod = await import(base + '/vision_bundle.mjs'); } catch (e) { base = MP_CDN; mod = await import(base + '/vision_bundle.mjs'); }
    const fs = await mod.FilesetResolver.forVisionTasks(base + '/wasm');
    const opts = d => ({ baseOptions: { modelAssetPath: FACE_MODEL, delegate: d }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: .5, minFacePresenceConfidence: .5, minTrackingConfidence: .5 });
    try { return await mod.FaceLandmarker.createFromOptions(fs, opts('GPU')); } catch (e) { return mod.FaceLandmarker.createFromOptions(fs, opts('CPU')); }
  })().catch(e => { facePromise = null; throw e; });
  return facePromise;
}

/** Средний цвет кожи лба по точкам лица (многоугольник над бровями). */
function foreheadRGB(px, video, lm, w, h) {
  const xs = LM.FOREHEAD.map(i => lm[i].x * w), ys = LM.FOREHEAD.map(i => lm[i].y * h);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); if (x1 - x0 < 8 || y1 - y0 < 4) return null;
  px.drawImage(video, x0, y0, x1 - x0, y1 - y0, 0, 0, 16, 8); const d = px.getImageData(0, 0, 16, 8).data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return { r: r / n, g: g / n, b: b / n };
}

/** Экран загрузки перед тестом, внутри которого незаметно идет окуломоторный блок и rPPG.
 *  ready — промис настоящей загрузки (камера, модель позы). Пока он не готов, капля «дышит» в центре и копится пульс;
 *  затем 2,3 с стимула: «восьмерка», схлопывание и вспышка «готово». Возвращает итог ВНС или null (специалист, нет лица). */
export async function runLoader({ ready, video, mirror = true, caption = ['Загружаем распознавание движения', 'Настраиваем камеру', 'Почти готово'] } = {}) {
  const measure = passiveOn() && !!video && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const el = document.createElement('div'); el.className = 'vnsl';
  el.innerHTML = `<canvas></canvas><div class="vnsl-ui"><div class="vnsl-cap" aria-live="polite">${caption[0]}</div><div class="vnsl-bar"><b></b></div></div>`;
  document.body.appendChild(el); const cv = el.querySelector('canvas'), cap = el.querySelector('.vnsl-cap'), bar = el.querySelector('.vnsl-bar b');
  const W = innerWidth, H = innerHeight, dpr = Math.min(1.5, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
  const scene = createLiquidScene(cv), R = Math.min(W, H) * .055;
  let face = null, readyDone = false, readyErr = null; ready = Promise.resolve(ready).then(() => { readyDone = true; }, e => { readyDone = true; readyErr = e; });
  if (measure) loadFace().then(f => { face = f; }, () => {});
  const probe = document.createElement('canvas'); probe.width = 16; probe.height = 8; const px = probe.getContext('2d', { willReadFrequently: true });
  const CM_PER_PX = 2.54 / 160; let distCm = 35, faceSeen = 0;
  const samples = [], trace = [], reasons = new Set(); let lastTs = -1, total = 0, valid = 0;
  const sense = (now, tStim) => { if (!face || !video.videoWidth || now - lastTs < 15) return; lastTs = now; const vw = video.videoWidth, vh = video.videoHeight;
    let r; try { r = face.detectForVideo(video, now); } catch (e) { return; }
    const lm = r.faceLandmarks && r.faceLandmarks[0]; if (tStim >= 0) total++; if (!lm || lm.length < 478) { if (tStim >= 0) reasons.add('no_face'); return; } faceSeen++;
    const blend = r.faceBlendshapes && r.faceBlendshapes[0] ? Object.fromEntries(r.faceBlendshapes[0].categories.map(c => [c.categoryName, c.score])) : null;
    const head = headPose(r.facialTransformationMatrixes && r.facialTransformationMatrixes[0] && r.facialTransformationMatrixes[0].data);
    const eye = irisInEye(lm), conf = irisConfidence(eye, blend), gz = gazeAngles(head, eye), dc = faceDistanceCm(lm, vw); if (dc) distCm = distCm * .8 + dc * .2;
    try { const c = foreheadRGB(px, video, lm, vw, vh); if (c) trace.push({ t: now, ...c }); } catch (e) {}
    if (tStim < 0) return; const ok = conf >= GUARD.irisConf && gz.total <= GUARD.gazeDeg; if (!ok) reasons.add(conf < GUARD.irisConf ? 'iris_conf' : 'gaze_angle'); else valid++;
    const st = stimulusAt(tStim, W, H), deg = p => Math.atan2(p * CM_PER_PX, distCm) * D;
    samples.push({ t: tStim, ok, conf, tx: deg(st.x - W / 2), ty: deg(st.y - H / 2), gh: (mirror ? -1 : 1) * gz.h, gv: -gz.v }); };
  // шлейф: позиции капли с задержкой; при «дыхании» в центре капли кружат рядом
  // шлейф считается по времени, а не по кадрам: капли сливаются в одну форму при любой частоте кадров
  const posAt = (now, tStim) => { if (tStim < 0) { const a = now / 700; return { x: W / 2 + Math.cos(a) * R * .35, y: H / 2 + Math.sin(a * 1.3) * R * .25 }; } const s = stimulusAt(Math.min(tStim, T.END - 1), W, H); return { x: s.x, y: s.y }; };
  const t0 = performance.now(); let stimStart = null, endAt = null;
  await new Promise(done => { const frame = () => { const now = performance.now(), el0 = now - t0;
      // старт стимула: загрузка закончилась, прошло не меньше 1,6 с и (если меряем) накоплено 3,5 с пульса или прошло 7 с
      if (stimStart == null && readyDone && el0 > 1600 && (!measure || !face || trace.length > 90 || el0 > 7000 || (el0 > 3000 && !faceSeen))) stimStart = now;
      const tStim = stimStart == null ? -1 : now - stimStart; if (tStim >= T.END && endAt == null) endAt = now;
      const fade = endAt == null ? Math.min(1, el0 / 350) : Math.max(0, 1 - (now - endAt) / 420); if (endAt != null && fade <= 0) return done();
      const lag = i => posAt(now - i * 45, tStim < 0 ? -1 : (tStim - i * 45 < 0 ? -1 : tStim - i * 45)), p = lag(0);
      const st = tStim < 0 ? { r: 1, flash: 0 } : stimulusAt(Math.min(tStim, T.END - 1), W, H), r = R * (tStim < 0 ? 1 + Math.sin(now / 420) * .06 : Math.max(.15, st.r));
      scene.draw({ pts: [p, lag(1), lag(2), lag(3)], r, time: now / 1000, flash: st.flash, fade });
      const prog = stimStart == null ? Math.min(.8, el0 / 6000) : .8 + .2 * Math.min(1, tStim / T.END); bar.style.width = (prog * 100).toFixed(1) + '%';
      const ci = stimStart == null ? (el0 < 2200 ? 0 : 1) : 2; if (cap.textContent !== caption[ci]) cap.textContent = caption[ci];
      if (measure) sense(now, endAt == null ? tStim : -1); requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
  await ready; scene.dispose(); el.remove(); if (readyErr) throw readyErr;
  if (!measure || !total) return measure ? { status: 'INVALID', reasons: [face ? 'no_face' : 'model'], ppg: rppg(trace) } : null;
  const validFrac = valid / total, status = validFrac >= GUARD.validFrac ? 'OK' : 'INVALID';
  return { status, reasons: [...reasons], validFrac: Math.round(validFrac * 100) / 100, distanceCm: Math.round(distCm), renderer: scene.kind,
    pursuit: status === 'OK' ? pursuitStats(samples) : null, saccadeMs: status === 'OK' ? saccadeLatency(samples) : null, ppg: rppg(trace), frames: total };
}
/** Короткая сводка для экрана. */
export function vnsSummary(v) {
  if (!v || v.status !== 'OK') return null; const out = [];
  if (v.ppg && v.ppg.valid) out.push(`Пульс ${v.ppg.hr}${v.ppg.hrv ? `, HRV ${v.ppg.hrv} мс` : ''}${v.ppg.rough ? ' (оценка)' : ''}`);
  if (v.saccadeMs) out.push(`Реакция глаз ${v.saccadeMs} мс${v.saccadeMs < SACCADE_NORM[0] ? ' (быстрее нормы)' : v.saccadeMs > SACCADE_NORM[1] ? ' (медленнее нормы)' : ' (норма)'}`);
  if (v.pursuit) out.push(`Плавность слежения ${Math.round(Math.max(0, v.pursuit.corr) * 100)}%${v.pursuit.catchUp > 2 ? ', рывки взгляда' : ''}`);
  return out;
}
