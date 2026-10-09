// Камера, MediaPipe, голос, тепловая карта (2D и 3D). Без сервера: все считается в браузере.
import { P } from './analysis.js';
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20';

// ---------- контент ----------
export const C = {};
export async function loadContent() {
  const get = n => fetch('data/' + n + '.json').then(r => r.json());
  const [mus, bm, ch, ex] = await Promise.all([get('muscles'), get('bodymap'), get('chains'), get('exercises')]);
  C.muscles = mus.muscles; C.bodymap = bm; C.chains = ch.chains; C.exercises = Object.fromEntries(ex.exercises.map(e => [e.id, e])); C.booking = 'https://t.me/BodyPassport_bot';
  return C;
}

// ---------- голос: заранее записанный нейроголос, системный как запасной ----------
let voiceIdx = {}, audio = null, unlocked = false;
export const voice = {
  async init() { voiceIdx = await fetch('voice/index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => voiceIdx || {}); },
  /** Проверка перед тестом: все фразы есть в списке записей; если нет — перечитать список. */
  async ensure(texts) { if (texts.some(t => !voiceIdx[t.trim()])) await this.init(); return texts.filter(t => !voiceIdx[t.trim()]); },
  unlock() { try { this._ac = this._ac || new (window.AudioContext || window.webkitAudioContext)(); this._ac.resume(); } catch (e) {} if (unlocked) return; unlocked = true; const a = new Audio(); a.muted = true; a.play().catch(() => {}); },
  muted: localStorage.getItem('bp_mute') === '1',
  // занят, пока звучит фраза; ограничено оценкой длины фразы, чтобы сбой или медленная загрузка звука не «вешали» тест
  until: 0, hardUntil: 0,
  busy() { const now = Date.now(); if (now > this.hardUntil) return false; return !!(audio && !audio.paused && !audio.ended && !audio.error) || now < this.until; },
  // заранее загружаем все фразы, чтобы голос звучал сразу, без пауз на загрузку
  // заранее грузим только фразы теста (около 1/3 записей), фразы упражнений грузятся, когда понадобятся
  preload(texts) { if (this._pre) return; this._pre = true; const files = [...new Set((texts || Object.keys(voiceIdx)).map(t => voiceIdx[t.trim()]).filter(Boolean))]; let i = 0;
    const next = () => { const batch = files.slice(i, i + 6); i += 6; if (!batch.length) return; Promise.all(batch.map(f => fetch('voice/' + f).catch(() => {}))).then(next); }; next(); },
  say(text, cueEl) {
    if (cueEl) cueEl.textContent = text;
    if (this.muted) return;
    const f = voiceIdx[text.trim()];
    if (audio) { audio.pause(); audio = null }
    const est = 400 + text.length * 70; this.until = Date.now() + Math.min(est, 1500); this.hardUntil = Date.now() + est + 2500;
    if (f) { const a = new Audio('voice/' + f); audio = a; a.onloadedmetadata = () => { if (isFinite(a.duration)) this.hardUntil = Date.now() + a.duration * 1000 + 800; };
      a.onerror = () => { this.until = Date.now() + est * .9; }; a.play().catch(() => { this.until = Date.now() + est * .9; }); }
    // фраз без записи не озвучиваем: системный голос в браузере часто женский и звучит иначе
  },
  // ждем конца фразы, но не дольше 15 с: если звук завис (без звука, ограничения браузера), тест не должен останавливаться
  /** Сказать фразу целиком и дождаться конца. Не обрывается следующими фразами. */
  speak(text, cueEl) {
    if (cueEl) cueEl.textContent = text;
    return new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } };
      const est = 500 + text.length * 75; if (this.muted) return setTimeout(fin, 200);
      const f = voiceIdx[text.trim()]; if (audio) { audio.pause(); audio = null; }
      if (!f) { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ru'));
          u.voice = vs.find(v => /dmitr|male|юр|макс/i.test(v.name)) || vs[0] || null; u.onend = () => setTimeout(fin, 150); speechSynthesis.speak(u); setTimeout(fin, est + 3000); } catch (e) { setTimeout(fin, est); } return; }
      const a = new Audio('voice/' + f); audio = a; a.onended = () => setTimeout(fin, 150); let known = false;
      // запись не проигралась (сеть, формат) — читаем системным голосом, чтобы не было тишины
      const tts = () => { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ru'));
        u.voice = vs.find(v => /dmitr|male|юр|макс/i.test(v.name)) || vs[0] || null; u.onend = () => setTimeout(fin, 150); speechSynthesis.speak(u); } catch (e) {} setTimeout(fin, est + 1500); };
      a.onerror = tts; a.onloadedmetadata = () => { if (isFinite(a.duration)) { known = true; setTimeout(fin, a.duration * 1000 + 600); } };
      // запасной предел по оценке длины действует, только пока настоящая длина записи неизвестна: иначе длинная фраза обрывалась следующей
      setTimeout(() => { if (!known) fin(); }, est + 2500); setTimeout(fin, 15000 + est); a.play().catch(tts); });
  },
  /** Звуковой сигнал: старт — один высокий, стоп — два коротких. Слышно, даже если человек стоит спиной. */
  beep(kind = 'start') { try { const ac = this._ac || (this._ac = new (window.AudioContext || window.webkitAudioContext)()); const t = ac.currentTime;
    const one = (at, f, d) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(.35, t + at + .02); g.gain.exponentialRampToValueAtTime(.0001, t + at + d); o.connect(g).connect(ac.destination); o.start(t + at); o.stop(t + at + d + .05); };
    if (kind === 'start') one(0, 880, .25); else { one(0, 660, .12); one(.18, 660, .12); } } catch (e) {} },
  async waitDone() { await sleep(200); while (this.busy()) await sleep(100); },
};
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- крен телефона (для выравнивания углов) ----------
export const phone = { roll: 0, pitch: 0, ok: false };
export async function startMotion() {
  try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) await DeviceMotionEvent.requestPermission(); } catch (e) {}
  window.addEventListener('devicemotion', e => { const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
    // портрет: крен вокруг оси экрана; сглаживаем
    const r = Math.atan2(g.x, g.y) * 180 / Math.PI; const roll = Math.abs(r) > 90 ? (r > 0 ? r - 180 : r + 180) : r;
    const pitch = Math.atan2(g.z, Math.hypot(g.x, g.y)) * 180 / Math.PI;
    phone.roll = phone.ok ? phone.roll * .85 + roll * .15 : roll; phone.pitch = phone.ok ? phone.pitch * .85 + pitch * .15 : pitch; phone.ok = true; });
}

// ---------- устройство ----------
export const device = (() => {
  const ua = navigator.userAgent || '';
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // встроенные браузеры соцсетей часто не дают камеру
  const inApp = /Instagram|FBAN|FBAV|Line\/|VKClient|TikTok|Snapchat/i.test(ua);
  const tg = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
  const weak = mem <= 3 || cores <= 4;
  let webgl2 = false; try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}
  return { ios, inApp, tg, weak, webgl2, camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
})();

// экран не гаснет во время теста и тренировки (телефон стоит на полу и его никто не трогает)
let wake = null;
export async function keepAwake(on) {
  try { if (on && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => wake = null); }
    if (!on && wake) { await wake.release(); wake = null; } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wake === null && cam.running) keepAwake(true); });

// ---------- камера и MediaPipe ----------
let landmarker = null;
export async function initPose() {
  if (landmarker) return landmarker;
  const { PoseLandmarker, FilesetResolver } = await import(MP + '/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks(MP + '/wasm');
  // на слабых телефонах облегченная модель: точность чуть ниже, но кадров в секунду вдвое больше
  const model = device.weak ? 'models/pose_landmarker_lite.task' : 'models/pose_landmarker_full.task';
  const opts = (d) => ({ baseOptions: { modelAssetPath: model, delegate: d }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .4, minPosePresenceConfidence: .4, minTrackingConfidence: .4 });
  try { landmarker = await PoseLandmarker.createFromOptions(fs, opts('GPU')); } catch (e) { landmarker = await PoseLandmarker.createFromOptions(fs, opts('CPU')); }
  return landmarker;
}
export const cam = { video: null, stream: null, back: localStorage.getItem('bp_back') === '1', frame: null, running: false };
export async function startCamera(video) {
  stopCamera();
  cam.video = video;
  cam.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: cam.back ? 'environment' : 'user', width: { ideal: device.weak ? 1280 : 1920 }, height: { ideal: device.weak ? 720 : 1080 } } });
  // самый широкий угол, который позволяет камера (на части Android есть зум меньше 1)
  try { const tr = cam.stream.getVideoTracks()[0], caps = tr.getCapabilities ? tr.getCapabilities() : {};
    if (caps.zoom) await tr.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }); } catch (e) {}
  video.srcObject = cam.stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play();
  video.style.transform = cam.back ? 'none' : 'scaleX(-1)'; video.style.objectFit = 'contain';
  cam.running = true; keepAwake(true); loop();
}
export function stopCamera() { keepAwake(false); cam.running = false; if (cam.stream) cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; }
let lastTs = -1, fpsT = performance.now(), fpsN = 0, loopGen = 0;
function loop(gen = ++loopGen) {
  // после перезапуска камеры старый цикл завершается: два цикла вызывали бы детектор дважды на кадр
  if (!cam.running || gen !== loopGen) return;
  const v = cam.video;
  if (landmarker && v.readyState >= 2) {
    const ts = performance.now(); if (ts - lastTs >= 30) { lastTs = ts;
      const r = landmarker.detectForVideo(v, ts); const w = v.videoWidth, h = v.videoHeight;
      const pose = r.landmarks && r.landmarks[0] ? r.landmarks[0].map(l => ({ x: l.x * w, y: l.y * h, z: l.z * w, visibility: l.visibility ?? 1 })) : null;
      const world = r.worldLandmarks && r.worldLandmarks[0] ? r.worldLandmarks[0].map(l => ({ x: l.x, y: l.y, z: l.z })) : null;
      fpsN++; if (ts - fpsT > 1000) { cam.fps = fpsN * 1000 / (ts - fpsT); fpsN = 0; fpsT = ts; }
      cam.frame = { t: ts / 1000, w, h, pose, world };
      if (cam.onFrame) cam.onFrame(cam.frame);
    }
  }
  requestAnimationFrame(() => loop(gen));
}
export function fullyVisible(p) { return p && [P.NOSE, P.L_ANKLE, P.R_ANKLE, P.L_SHOULDER, P.R_SHOULDER].every(i => p[i].visibility > .5); }

// ---------- иконки (спрайт Lucide, icons/ui.svg) ----------
export const ic = (n, cls = '') => '<svg class="ic ' + cls + '" aria-hidden="true"><use href="icons/ui.svg#i-' + n + '"/></svg>';
/** Короткое сообщение внизу экрана вместо alert(). */
export function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
export const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---------- скелет поверх видео ----------
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const sm = {}; const trail = [];
/** opts.focus: суставы текущего шага (кольцо и ореол кости); opts.trail: шлейф из 6 прошлых кадров; opts.warn: человек вне контура.
 *  Возвращает экранные координаты первого сустава из focus (CSS-пиксели), чтобы поставить рядом метку с углом. */
export function drawSkeleton(cv, frame, opts = {}) {
  const ctx = cv.getContext('2d'), dpr = devicePixelRatio; const W = cv.width = cv.clientWidth * dpr, H = cv.height = cv.clientHeight * dpr;
  ctx.clearRect(0, 0, W, H); if (!frame || !frame.pose) { trail.length = 0; return {}; }
  const s = Math.min(W / frame.w, H / frame.h), ox = (W - frame.w * s) / 2, oy = (H - frame.h * s) / 2, mir = !cam.back;
  const a = .35; const p = frame.pose.map((l, i) => { const o = sm[i] || l; const n = { x: o.x + (l.x - o.x) * a, y: o.y + (l.y - o.y) * a, visibility: l.visibility }; sm[i] = n; return n; });
  const m = l => [ox + (mir ? frame.w - l.x : l.x) * s, oy + l.y * s];
  const warn = opts.warn || !fullyVisible(frame.pose), bone = warn ? '#FFB547' : '#D4F25A';
  const bones = (q, w) => { for (const [i, j] of BONES) if (q[i].visibility > .4 && q[j].visibility > .4) { ctx.beginPath(); ctx.moveTo(...m(q[i])); ctx.lineTo(...m(q[j])); ctx.stroke(); } };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const useTrail = opts.trail && !device.weak && !reduceMotion();
  if (useTrail) { ctx.strokeStyle = bone; ctx.lineWidth = 3.5 * dpr; trail.forEach((q, k) => { ctx.globalAlpha = .08 + k * .044; bones(q); }); ctx.globalAlpha = 1;
    trail.push(p.map(l => ({ ...l }))); if (trail.length > 6) trail.shift(); } else trail.length = 0;
  const focus = (opts.focus || []).filter(i => p[i] && p[i].visibility > .4);
  // ореол костей у измеряемого сустава
  if (focus.length && !warn) { ctx.strokeStyle = bone; ctx.globalAlpha = .25; ctx.lineWidth = 10 * dpr;
    for (const [i, j] of BONES) if ((focus.includes(i) || focus.includes(j)) && p[i].visibility > .4 && p[j].visibility > .4) { ctx.beginPath(); ctx.moveTo(...m(p[i])); ctx.lineTo(...m(p[j])); ctx.stroke(); }
    ctx.globalAlpha = 1; }
  ctx.strokeStyle = bone; ctx.lineWidth = 3.5 * dpr; bones(p);
  ctx.fillStyle = '#fff'; for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) if (p[i].visibility > .4) { ctx.beginPath(); ctx.arc(...m(p[i]), 4.5 * dpr, 0, 7); ctx.fill(); }
  for (const i of focus) { ctx.beginPath(); ctx.arc(...m(p[i]), 7 * dpr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3 * dpr; ctx.strokeStyle = bone; ctx.stroke(); }
  if (!focus.length) return {};
  const [fx, fy] = m(p[focus[0]]); return { focusXY: [fx / dpr, fy / dpr] };
}

// ---------- контур «куда встать» (пунктир по центру кадра) ----------
const SIL = 'M78 72 L122 72 Q140 74 144 92 L156 176 Q158 186 150 188 Q144 188 142 180 L132 112 L128 190 L130 268 L128 352 Q128 362 118 362 Q110 362 110 352 L104 210 L96 210 L90 352 Q90 362 82 362 Q72 362 72 352 L70 268 L72 190 L68 112 L58 180 Q56 188 50 188 Q42 186 44 176 L56 92 Q60 74 78 72 Z';
export function drawSilhouette(cv, target = {}) {
  const ctx = cv.getContext('2d'), dpr = devicePixelRatio, W = cv.width = cv.clientWidth * dpr, H = cv.height = cv.clientHeight * dpr;
  ctx.clearRect(0, 0, W, H); const k = H * (target.bodyFrac || .72) / 340; // 340: от макушки (y≈20) до стоп (y≈362) в координатах контура
  ctx.save(); ctx.translate(W / 2 - 100 * k, (H - 380 * k) / 2); ctx.scale(k, k);
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5 * dpr / k; ctx.setLineDash([6 * dpr / k, 6 * dpr / k]);
  ctx.beginPath(); ctx.arc(100, 44, 24, 0, Math.PI * 2); ctx.stroke(); ctx.stroke(new Path2D(SIL)); ctx.restore();
}

// ---------- 2D тепловая карта, силуэт 200×440 из прототипа ----------
const BODY = ['M60 82 Q100 70 140 82 Q157 88 155 110 L147 196 Q144 226 151 252 L49 252 Q56 226 53 196 L45 110 Q43 88 60 82Z',
  'M50 85 C33 88 28 100 29 116 L25 200 C22 240 22 270 25 292 C28 302 38 302 39 292 C40 268 42 238 45 204 L53 124 Z',
  'M150 85 C167 88 172 100 171 116 L175 200 C178 240 178 270 175 292 C172 302 162 302 161 292 C160 268 158 238 155 204 L147 124 Z',
  'M49 246 L151 246 C157 270 155 292 148 308 L140 418 C139 430 117 430 116 418 L106 314 L100 302 L94 314 L84 418 C83 430 61 430 60 418 L52 308 C45 292 43 270 49 246Z'];
function bodyParts() { const e = (x, y, rx, ry) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); return p; };
  const neck = new Path2D(); neck.rect(90, 50, 20, 36);
  return [...BODY.map(d => new Path2D(d)), e(100, 34, 20, 24), neck, e(72, 428, 14, 6), e(128, 428, 14, 6)]; }
// пять опорных точек: норма нейтральная (цвет фигуры), карта показывает только отклонения
const RAMP = [[-1, 0x2A5CB8], [-.45, 0x7FA6EE], [0, 0xE9E7E1], [.45, 0xF0A36A], [1, 0xD9484F]];
export function ramp(v) { const x = Math.max(-1, Math.min(1, v)); let i = RAMP.findLastIndex(r => r[0] <= x); i = Math.max(0, Math.min(RAMP.length - 2, i));
  const [a, ca] = RAMP[i], [b, cb] = RAMP[i + 1], t = Math.max(0, Math.min(1, (x - a) / (b - a))); const ch = (c, s) => (c >> s) & 255; const mix = s => Math.round(ch(ca, s) + (ch(cb, s) - ch(ca, s)) * t);
  return [mix(16), mix(8), mix(0)]; }
export const RAMP_CSS = 'linear-gradient(90deg,' + RAMP.map(([v, c]) => '#' + c.toString(16).padStart(6, '0') + ' ' + ((v + 1) * 50) + '%').join(',') + ')';
export const MARK_HEX = { HYPER: '#D9484F', SHORT: '#E07A2E', WEAK: '#3A72D8' };
/** Маркер состояния формой: перегрузка — круг, укорочение — ромб, слабость — кольцо. derived: пунктир без ореола. */
export function drawMark(ctx, x, y, k, o = {}) {
  const c = MARK_HEX[k]; if (!c) return; const sc = o.scale ?? 1; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  if (!o.derived) { ctx.globalAlpha = (k === 'WEAK' ? .14 : .18) * (o.alpha ?? 1); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill(); }
  ctx.globalAlpha = o.alpha ?? 1; ctx.setLineDash(o.derived ? [3, 3] : []);
  if (k === 'HYPER') { ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); if (o.derived) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); } }
  if (k === 'SHORT') { ctx.rotate(Math.PI / 4); if (o.derived) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(-6, -6, 12, 12); } else { ctx.fillStyle = c; ctx.fillRect(-6, -6, 12, 12); } }
  if (k === 'WEAK') { ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.strokeStyle = c; ctx.lineWidth = 3.5; ctx.stroke(); }
  ctx.restore();
}
const VW = 384, OX = 92;
// маска силуэта считается один раз: проверка 88 тысяч точек по контурам тормозила каждое касание карты
let bodyMask = null;
function mask() { if (bodyMask) return bodyMask; const parts = bodyParts(), tc = document.createElement('canvas').getContext('2d'); bodyMask = new Uint8Array(200 * 440);
  for (let y = 0; y < 440; y++) for (let x = 0; x < 200; x++) if (parts.some(pp => tc.isPointInPath(pp, x, y))) bodyMask[y * 200 + x] = 1; return bodyMask; }
const easeOut = t => 1 - (1 - t) ** 3;
/**
 * labels: [{ key, title, sub, color, text, value?, n? }]. value — короткий замер (mono, цвет состояния), n — номер точки вместо маркера.
 * opts.reveal — анимация появления (первый показ результата). Если у всех подписей есть n, поля под выноски не нужны: фигура во всю ширину.
 */
// Анатомические фигуры мышц на схеме 200×440 (левая сторона тела; правая зеркально по x = 200 − x).
// Спереди левая сторона человека справа на картинке, сзади слева. [cx, cy, rx, ry, наклон°], у мышцы может быть несколько фигур.
export const SHAPES = {
  // спереди
  scm: [[108, 66, 3.5, 19, -24]], scalene: [[112, 74, 3.5, 9, 35]], deep_neck_flex: [[103, 66, 2.5, 13, 0]],
  pec_major: [[123, 103, 21, 13, 12]], pec_minor: [[127, 99, 8, 7, -20]], deltoid: [[147, 98, 9, 15, -8]], biceps: [[162, 135, 6.5, 20, -5]],
  forearm_flex: [[168, 222, 5.5, 26, -3]], serratus: [[141, 132, 6, 14, 12]], rectus_abd: [[106, 168, 6.5, 40, 0]], abdominals: [[110, 165, 14, 42, 0]],
  obliques: [[133, 178, 9, 28, -8]], iliopsoas: [[114, 244, 7, 16, -25]], tfl: [[143, 262, 5.5, 13, 10]], rectus_fem: [[123, 296, 8, 33, 2]],
  vastus_lat: [[139, 300, 6.5, 32, -3]], vmo: [[112, 334, 7, 9, 20]], adductors: [[108, 283, 7.5, 26, 6]], tibialis: [[123, 385, 4, 22, -3]], peroneus: [[134, 385, 3.5, 20, -3]],
  // сзади
  upper_trap: [[80, 88, 19, 7, 16]], levator: [[92, 71, 3, 12, 22]], suboccipital: [[95, 53, 6, 3.5, 0]], rhomboid: [[89, 117, 7, 13, -22]],
  lower_trap: [[89, 152, 6, 19, 22]], thoracic_ext: [[95, 125, 3.5, 24, 0]], erector: [[95, 196, 4.5, 38, 0]], ql: [[87, 224, 6.5, 12, 8]],
  lats: [[71, 172, 13, 32, 14]], triceps: [[37, 140, 6.5, 22, 4]], glute_med: [[67, 251, 12, 8, -12]], glute_max: [[81, 272, 15, 15, 0]],
  hamstrings: [[80, 315, 9.5, 30, 0]], calf: [[80, 382, 8, 21, 0]],
};
const mirrorX = (sh, side) => side === 'RIGHT' ? sh.map(([x, y, rx, ry, r]) => [200 - x, y, rx, ry, -r]) : sh;
export const shapeOf = s => SHAPES[s.id] ? mirrorX(SHAPES[s.id], s.side) : null;
const ell = ([x, y, rx, ry, r]) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, r * Math.PI / 180, 0, Math.PI * 2); return p; };
// точка зоны для маркера, подписи и касания: центр первой фигуры мышцы, иначе координаты из каталога
const anchor = s => { const sh = shapeOf(s); return sh ? { ...s, x: sh[0][0] / 200, y: sh[0][1] / 440 } : s; };
export function drawHeat(cv, spots0, back, selected, labels = [], opts = {}) {
  const spots = spots0.map(anchor), mine = spots.filter(s => s.back === back);
  const parts = bodyParts();
  // все фигуры этой стороны: тонкий контур как анатомическая подсказка, мышцы с отклонением заливаются цветом состояния
  const outline = Object.entries(SHAPES).filter(([id]) => C.muscles && C.muscles[id] && (C.muscles[id].view === 'back') === back).flatMap(([id]) => [...SHAPES[id], ...mirrorX(SHAPES[id], 'RIGHT')]).map(ell);
  const fillShapes = k => mine.filter(s => Math.abs(s.tone) > .05 && SHAPES[s.id]).sort((a, b) => Math.abs(a.tone) - Math.abs(b.tone)).flatMap(s => { const [r, g, b] = ramp(s.tone * k * (s.derived && !s.edited ? .75 : 1)); return shapeOf(s).map(e => [ell(e), `rgb(${r},${g},${b})`]); });
  const numbered = labels.length && labels.every(l => l.n), vw = numbered ? 200 : VW, ox = numbered ? 0 : OX;
  const ctx = cv.getContext('2d'); const sc = cv.clientWidth * devicePixelRatio / vw; cv.width = vw * sc; cv.height = 440 * sc;
  const shown = labels.filter(l => mine.some(s => s.key === l.key));
  const marks = mine.filter(s => s.k !== 'OK' && (!s.derived || s.byChain || s.edited) && !shown.some(l => l.key === s.key && l.n)).sort((a, b) => Math.abs(b.tone) - Math.abs(a.tone)).slice(0, 8);
  const render = (figA, toneK, markT, labA) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(sc, sc); ctx.save(); ctx.translate(ox, 0); ctx.globalAlpha = figA;
    ctx.fillStyle = '#E9E7E1'; parts.forEach(pp => ctx.fill(pp));
    ctx.strokeStyle = 'rgba(17,20,24,.10)'; ctx.lineWidth = .8; for (const pp of parts) { ctx.save(); ctx.clip(pp); outline.forEach(e => ctx.stroke(e)); ctx.restore(); }
    if (toneK > 0) { const fs = fillShapes(toneK); for (const pp of parts) { ctx.save(); ctx.clip(pp); ctx.globalAlpha = figA * .88; for (const [e, c] of fs) { ctx.fillStyle = c; ctx.fill(e); } ctx.restore(); } ctx.globalAlpha = figA; }
    ctx.strokeStyle = '#D5D2CA'; ctx.lineWidth = 1.2; parts.forEach(pp => ctx.stroke(pp)); ctx.globalAlpha = 1;
    marks.forEach((s, i) => { const t = markT(i); if (t <= 0) return; const sc2 = t < .7 ? .4 + (1.15 - .4) * (t / .7) : 1.15 - .15 * ((t - .7) / .3);
      drawMark(ctx, s.x * 200, s.y * 440, s.k, { derived: s.derived && !s.edited, scale: t >= 1 ? 1 : sc2, alpha: Math.min(1, t * 2) }); });
    for (const l of shown.filter(l => l.n)) { const s = mine.find(q => q.key === l.key); ctx.globalAlpha = Math.min(1, labA * 2 + (markT(0) > 0 ? 1 : 0));
      ctx.fillStyle = '#111418'; ctx.beginPath(); ctx.arc(s.x * 200, s.y * 440, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 14px Onest, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(l.n), s.x * 200, s.y * 440 + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1; }
    const sel = mine.find(s => s.key === selected); if (sel) { ctx.strokeStyle = '#111418'; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(sel.x * 200, sel.y * 440, 12, 0, 7); ctx.stroke(); }
    ctx.restore();
    if (labA > 0 && !numbered) callouts(ctx, shown.filter(l => !l.n), mine, labA);
  };
  const markDelay = i => 320 + i * 60;
  if (opts.reveal && !reduceMotion()) {
    const t0 = performance.now(), end = 880 + marks.length * 60 + 320 + 200;
    const step = now => { if (!cv.isConnected) return; const t = now - t0;
      render(Math.min(1, t / 320), t < 320 ? 0 : easeOut(Math.min(1, (t - 320) / 560)), i => Math.max(0, Math.min(1, (t - markDelay(i)) / 320)), Math.max(0, Math.min(1, (t - (end - 200)) / 200)));
      if (t < end) requestAnimationFrame(step); };
    requestAnimationFrame(step); render(0, 0, () => 0, 0);
  } else if (opts.reveal) { // меньше движения: один короткий fade
    const t0 = performance.now(); const step = now => { if (!cv.isConnected) return; const k = Math.min(1, (now - t0) / 160); render(k, 1, () => 1, k); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); render(0, 1, () => 1, 0);
  } else render(1, 1, () => 1, 1);
  return { hit(clientX, clientY) { const r = cv.getBoundingClientRect(); const ux = (clientX - r.left) / r.width * vw - ox, uy = (clientY - r.top) / r.height * 440;
    let best = null, bd = 34; for (const s of mine) { const d = Math.hypot(s.x * 200 - ux, s.y * 440 - uy); if (d < bd) { bd = d; best = s; } } return best; } };
}
// выноски: подпись прижата к ближайшему краю, шаг по высоте не меньше 36
function callouts(ctx, labels, mine, alpha) {
  const pos = l => mine.find(s => s.key === l.key); const placed = { L: [], R: [] };
  ctx.globalAlpha = alpha;
  for (const l of labels.sort((a, b) => pos(a).y - pos(b).y)) {
    const h = pos(l), left = h.x < .5, side = left ? 'L' : 'R', px = h.x * 200 + OX, zy = h.y * 440; let py = zy;
    for (const q of placed[side]) if (Math.abs(q - py) < 36) py = q + 36; placed[side].push(py);
    const maxW = OX + 18; ctx.font = '400 12px Onest, sans-serif';
    let title = l.title; while (ctx.measureText(title).width > maxW && title.length > 4) title = title.slice(0, -2) + '…';
    const val = l.value || l.sub || ''; ctx.font = l.value ? '500 13px "JetBrains Mono", monospace' : '600 12px Onest, sans-serif';
    let v = val; while (ctx.measureText(v).width > maxW && v.length > 4) v = v.slice(0, -2) + '…';
    const tw = Math.max(ctx.measureText(v).width, (ctx.font = '400 12px Onest, sans-serif', ctx.measureText(title).width));
    const bx = left ? 4 : VW - 4 - tw, ex = left ? bx + tw + 4 : bx - 4;
    ctx.strokeStyle = l.color; ctx.globalAlpha = alpha * .6; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, zy); ctx.lineTo(ex, py); ctx.stroke(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#5B6068'; ctx.font = '400 12px Onest, sans-serif'; ctx.fillText(title, bx, py - 3);
    ctx.fillStyle = l.text || l.color; ctx.font = l.value ? '500 13px "JetBrains Mono", monospace' : '600 12px Onest, sans-serif'; ctx.fillText(v, bx, py + 12);
  }
  ctx.globalAlpha = 1;
}

// ---------- 3D-модель мышц (Z-Anatomy на основе BodyParts3D, CC BY-SA) ----------
let mesh3d = null;
async function loadMesh() {
  if (mesh3d) return mesh3d;
  const [buf, meta] = await Promise.all([fetch('data/body3d.bin').then(r => r.arrayBuffer()), fetch('data/body3d.json').then(r => r.json())]);
  const dv = new DataView(buf); const nv = dv.getInt32(4, true), ni = dv.getInt32(8, true);
  const pos = new Float32Array(buf, 12, nv * 3); const nrm = new Int8Array(buf, 12 + nv * 12, nv * 3); const grp = new Uint8Array(buf, 12 + nv * 15, nv); const idx = new Uint32Array(buf.slice(12 + nv * 16, 12 + nv * 16 + ni * 4));
  mesh3d = { pos, nrm, grp, idx, meta, nv };
  return mesh3d;
}
/** Фоновая подгрузка 3D, пока человек смотрит карту: кнопка 3D потом открывается сразу. */
export function preload3D() { const go = () => { import('three'); import('three/addons/controls/OrbitControls.js'); loadMesh(); };
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500); }
export async function body3D(container, spots, onPick, opts = {}) {
  container.style.borderRadius = '32px'; container.style.overflow = 'hidden'; container.style.background = '#fff';
  container.innerHTML = '<div class="skel" style="height:100%"></div>';
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const m = await loadMesh(); const order = m.meta.order;
  const col = new Float32Array(m.nv * 3), lin = c => (c / 255) ** 2.2, BASE3 = ramp(0).map(lin);
  // раскраска по тону: пересчитывается и при правке специалиста, без пересоздания сцены
  const paint = (spots, out) => {
    const tone = new Map(); for (const s of spots) { const g = 1 + order.indexOf(s.id) * 2 + (s.side === 'RIGHT' ? 1 : 0); if (order.indexOf(s.id) >= 0) tone.set(g, s.tone); }
    const blobs = Object.entries(m.meta.blobs).map(([g, c]) => [+g, c]).filter(([g]) => Math.abs(tone.get(g) || 0) > .02);
    for (let i = 0; i < m.nv; i++) { const g = m.grp[i];
      if (g === 255) { out.set(BASE3, i * 3); continue; }
      // мышца красится своим цветом целиком и только она; соседям достается слабый край, чтобы граница читалась, но цвет не «растекался»
      let v;
      if (tone.has(g)) v = Math.max(-1, Math.min(1, tone.get(g) * 1.15));
      else { const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; let num = 0, den = 1;
        for (const [bg, c] of blobs) { const t = tone.get(bg), sg = 22; const d2 = (x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2; if (d2 > 9 * sg * sg) continue; const w = .35 * Math.exp(-d2 / (2 * sg * sg)); num += w * t; den += w; }
        v = Math.max(-1, Math.min(1, num / den)); }
      if (g === 0) v *= .7; const [r, gg, b] = ramp(v);
      // цвета шкалы заданы в sRGB, а рендер считает в линейном пространстве: переводим, иначе модель выглядит блеклой
      out[i * 3] = lin(r); out[i * 3 + 1] = lin(gg); out[i * 3 + 2] = lin(b); } };
  paint(spots, col);
  const geo = new THREE.BufferGeometry();
  // модель: x человека, z вверх, перед = −y → Three: X = x, Y = z, Z = −y
  const p2 = new Float32Array(m.nv * 3), n2 = new Float32Array(m.nv * 3);
  for (let i = 0; i < m.nv; i++) { p2[i * 3] = m.pos[i * 3]; p2[i * 3 + 1] = m.pos[i * 3 + 2]; p2[i * 3 + 2] = -m.pos[i * 3 + 1];
    n2[i * 3] = m.nrm[i * 3] / 127; n2[i * 3 + 1] = m.nrm[i * 3 + 2] / 127; n2[i * 3 + 2] = -m.nrm[i * 3 + 1] / 127; }
  geo.setAttribute('position', new THREE.BufferAttribute(p2, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xFFFFFF);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, side: THREE.DoubleSide });
  const obj = new THREE.Mesh(geo, mat); const cz = (m.meta.zmin + m.meta.zmax) / 2; obj.position.y = -cz; const root = new THREE.Group(); root.add(obj); root.scale.setScalar(2 / (m.meta.zmax - m.meta.zmin)); scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 3); scene.add(dl); const bl = new THREE.DirectionalLight(0xffffff, 1.2); bl.position.set(-1, 1, -3); scene.add(bl);
  const W = container.clientWidth, H = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(30, W / H, .1, 50); camera.position.set(0, 0, 4.2);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(device.weak ? 1.25 : 1.75, devicePixelRatio)); renderer.setSize(W, H); container.innerHTML = ''; container.appendChild(renderer.domElement); if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.insertAdjacentHTML('beforeend', '<a href="/licenses" target="_blank" style="position:absolute;right:12px;bottom:6px;font-size:12px;color:#5B6068;text-decoration:none">3D: Z-Anatomy, CC BY-SA 4.0</a><div class="hint3d">Двумя пальцами: приблизить и повернуть</div>');
  setTimeout(() => { const h = container.querySelector('.hint3d'); if (h) h.style.opacity = 0; }, 3000);
  // масштаб к точке под пальцами, сдвиг двумя пальцами: можно рассмотреть шею или стопу, а не только центр
  const ctl = new OrbitControls(camera, renderer.domElement); ctl.enablePan = true; ctl.screenSpacePanning = true; ctl.zoomToCursor = true;
  ctl.minDistance = .35; ctl.maxDistance = 6; ctl.enableDamping = true; ctl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const ray = new THREE.Raycaster(); let down = null;
  // плавный перелет камеры к зоне
  let fly = null; const flyTo = (target, dist, back) => { const from = { t: ctl.target.clone(), p: camera.position.clone() };
    const dir = back === undefined ? camera.position.clone().sub(ctl.target).normalize() : new THREE.Vector3(0, 0, back ? -1 : 1);
    fly = { from, to: { t: target.clone(), p: target.clone().add(dir.multiplyScalar(dist)) }, k: 0 }; };
  const H0 = 2; // рост модели в сцене
  const ZONES = { all: [0, 4.2], head: [.82, 1.1], shoulders: [.62, 1.3], back: [.32, 1.5], pelvis: [.05, 1.4], knees: [-.45, 1.3], feet: [-.88, 1.0] };
  let tapT = 0; renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY];
    // двойное касание: приблизиться к этой точке
    if (Date.now() - tapT < 300) { const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
      const hit = ray.intersectObject(obj)[0]; if (hit) flyTo(hit.point, Math.max(.6, camera.position.distanceTo(ctl.target) * .5)); }
    tapT = Date.now(); });
  renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return; const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObject(obj)[0]; if (!hit) return; const g = m.grp[hit.face.a]; if (g > 0 && g < 255) { const id = order[(g - 1) >> 1]; onPick && onPick(id + ':' + ((g - 1) % 2 ? 'RIGHT' : 'LEFT')); } });
  // маркеры состояния поверх модели. Видимость без трассировки лучей: маркер виден, если его сторона тела смотрит на камеру
  // (трассировка по сетке на каждом кадре тормозила вращение на телефонах)
  let marks = [];
  const buildMarks = spots => { marks.forEach(x => x.el.remove());
    marks = spots.filter(s => s.k !== 'OK' && order.indexOf(s.id) >= 0).map(s => { const g = 1 + order.indexOf(s.id) * 2 + (s.side === 'RIGHT' ? 1 : 0), c = m.meta.blobs[g]; if (!c) return null;
      const el = document.createElement('button'); el.className = 'mark3d'; el.setAttribute('aria-label', s.key); el.innerHTML = `<span class="mark ${s.k}"${s.derived && !s.edited ? ' style="opacity:.75"' : ''}></span>`;
      el.onclick = () => onPick && onPick(s.key); container.appendChild(el); return { el, local: new THREE.Vector3(c[0], c[2], -c[1]), vis: null }; }).filter(Boolean); };
  buildMarks(spots);
  const wv = new THREE.Vector3(), nv = new THREE.Vector3(), cv3 = new THREE.Vector3();
  const placeMarks = () => { const w = container.clientWidth, h = container.clientHeight;
    for (const x of marks) { obj.localToWorld(wv.copy(x.local));
      nv.set(wv.x, 0, wv.z).normalize(); cv3.copy(camera.position).sub(wv); const vis = nv.dot(cv3) > -0.05 * cv3.length();
      const p = cv3.copy(wv).project(camera); x.el.style.transform = `translate(${((p.x + 1) / 2 * w).toFixed(1)}px,${((1 - p.y) / 2 * h).toFixed(1)}px)`;
      if (vis !== x.vis) { x.vis = vis; x.el.style.opacity = vis ? 1 : 0; x.el.style.pointerEvents = vis ? 'auto' : 'none'; } } };
  // появление: тон 0→1 за 560 мс, камера доезжает с поворота 25° до фронта за 800 мс
  const target = col.slice(); let rv = null;
  if (opts.reveal && !reduceMotion()) { for (let i = 0; i < m.nv; i++) col.set(BASE3, i * 3); geo.attributes.color.needsUpdate = true;
    const a0 = 25 * Math.PI / 180; camera.position.set(Math.sin(a0) * 4.2, 0, Math.cos(a0) * 4.2); rv = { t0: performance.now() }; }
  const reveal = () => { if (!rv) return; const t = performance.now() - rv.t0, k = Math.min(1, t / 560), e = 1 - (1 - k) ** 3;
    for (let i = 0; i < col.length; i++) { const b = BASE3[i % 3]; col[i] = b + (target[i] - b) * e; } geo.attributes.color.needsUpdate = true;
    const c = Math.min(1, t / 800), ec = 1 - (1 - c) ** 3, a = 25 * Math.PI / 180 * (1 - ec); if (!fly) camera.position.set(Math.sin(a) * 4.2, 0, Math.cos(a) * 4.2);
    if (k >= 1 && c >= 1) rv = null; };
  // кадр рисуется только когда что-то меняется: вращение, перелет, появление; в покое GPU не занят
  let alive = true, dirty = true; ctl.addEventListener('change', () => { dirty = true; });
  function anim() { if (!alive) return; if (!renderer.domElement.isConnected) { api.dispose(); return; }
    if (rv) { reveal(); dirty = true; }
    if (fly) { fly.k = Math.min(1, fly.k + .06); const e = 1 - (1 - fly.k) ** 3; ctl.target.lerpVectors(fly.from.t, fly.to.t, e); camera.position.lerpVectors(fly.from.p, fly.to.p, e); if (fly.k >= 1) fly = null; dirty = true; }
    ctl.update(); if (dirty) { dirty = false; renderer.render(scene, camera); placeMarks(); } requestAnimationFrame(anim); }
  let isBack = false;
  const api = { turn(back) { isBack = back; const d = camera.position.distanceTo(ctl.target); flyTo(ctl.target, d, back); },
    focus(zone) { const [y, d] = ZONES[zone] || ZONES.all; flyTo(new THREE.Vector3(0, y, 0), d, isBack); },
    /** Новая раскраска и маркеры (правка специалиста) без пересоздания сцены и сброса камеры. */
    update(spots) { paint(spots, col); target.set(col); geo.attributes.color.needsUpdate = true; buildMarks(spots); dirty = true; },
    dispose() { if (!alive) return; alive = false; ctl.dispose(); geo.dispose(); mat.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} } };
  anim(); return api;
}


// ---------- шифрование результата для передачи специалисту (AES-GCM, ключ только в ссылке) ----------
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ub64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function z(bytes, how) { if (!window.CompressionStream) return bytes; const st = new Blob([bytes]).stream().pipeThrough(how ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(st).arrayBuffer()); }
export const seal = {
  rid: () => b64u(crypto.getRandomValues(new Uint8Array(16))),
  key: async () => b64u(new Uint8Array(await crypto.subtle.exportKey('raw', await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])))),
  async encrypt(k, obj) { const key = await crypto.subtle.importKey('raw', ub64u(k), 'AES-GCM', false, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await z(new TextEncoder().encode(JSON.stringify(obj)), true); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    return JSON.stringify({ v: 1, z: !!window.CompressionStream, iv: b64u(iv), ct: b64u(ct) }); },
  async decrypt(k, str) { const m = JSON.parse(str); const key = await crypto.subtle.importKey('raw', ub64u(k), 'AES-GCM', false, ['decrypt']);
    let pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64u(m.iv) }, key, ub64u(m.ct))); if (m.z) pt = await z(pt, false); return JSON.parse(new TextDecoder().decode(pt)); },
  pack: obj => b64u(new TextEncoder().encode(JSON.stringify(obj))),
  unpack: s => JSON.parse(new TextDecoder().decode(ub64u(s))),
};
