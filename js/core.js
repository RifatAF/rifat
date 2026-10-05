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

// ---------- скелет поверх видео (лайм, как в Android) ----------
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const sm = {};
export function drawSkeleton(cv, frame) {
  const ctx = cv.getContext('2d'); const W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, W, H); if (!frame || !frame.pose) return;
  const s = Math.min(W / frame.w, H / frame.h), ox = (W - frame.w * s) / 2, oy = (H - frame.h * s) / 2, mir = !cam.back;
  const a = .35; const p = frame.pose.map((l, i) => { const o = sm[i] || l; const n = { x: o.x + (l.x - o.x) * a, y: o.y + (l.y - o.y) * a, visibility: l.visibility }; sm[i] = n; return n; });
  const m = l => [ox + (mir ? frame.w - l.x : l.x) * s, oy + l.y * s];
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(198,232,75,.95)'; ctx.lineWidth = 8 * devicePixelRatio / 2;
  for (const [i, j] of BONES) if (p[i].visibility > .4 && p[j].visibility > .4) { ctx.beginPath(); ctx.moveTo(...m(p[i])); ctx.lineTo(...m(p[j])); ctx.stroke(); }
  ctx.fillStyle = '#fff'; for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) if (p[i].visibility > .4) { ctx.beginPath(); ctx.arc(...m(p[i]), 5 * devicePixelRatio, 0, 7); ctx.fill(); }
}

// ---------- 2D тепловая карта (метеостиль), силуэт 200×440 из прототипа ----------
const BODY = ['M60 82 Q100 70 140 82 Q157 88 155 110 L147 196 Q144 226 151 252 L49 252 Q56 226 53 196 L45 110 Q43 88 60 82Z',
  'M50 85 C33 88 28 100 29 116 L25 200 C22 240 22 270 25 292 C28 302 38 302 39 292 C40 268 42 238 45 204 L53 124 Z',
  'M150 85 C167 88 172 100 171 116 L175 200 C178 240 178 270 175 292 C172 302 162 302 161 292 C160 268 158 238 155 204 L147 124 Z',
  'M49 246 L151 246 C157 270 155 292 148 308 L140 418 C139 430 117 430 116 418 L106 314 L100 302 L94 314 L84 418 C83 430 61 430 60 418 L52 308 C45 292 43 270 49 246Z'];
function bodyParts() { const e = (x, y, rx, ry) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); return p; };
  const neck = new Path2D(); neck.rect(90, 50, 20, 36);
  return [...BODY.map(d => new Path2D(d)), e(100, 34, 20, 24), neck, e(72, 428, 14, 6), e(128, 428, 14, 6)]; }
const RAMP = [[-1, 0x1E3A8A], [-.7, 0x2F6FDF], [-.45, 0x4FA9EA], [-.22, 0x6FD0C4], [0, 0x5DBE7C], [.2, 0xB9D65A], [.4, 0xF3D04A], [.62, 0xF29A38], [.82, 0xE8573A], [1, 0xC21F3A]];
export function ramp(v) { const x = Math.max(-1, Math.min(1, v)); let i = RAMP.findLastIndex(r => r[0] <= x); i = Math.max(0, Math.min(RAMP.length - 2, i));
  const [a, ca] = RAMP[i], [b, cb] = RAMP[i + 1], t = Math.max(0, Math.min(1, (x - a) / (b - a))); const ch = (c, s) => (c >> s) & 255; const mix = s => Math.round(ch(ca, s) + (ch(cb, s) - ch(ca, s)) * t);
  return [mix(16), mix(8), mix(0)]; }
export const RAMP_CSS = 'linear-gradient(90deg,' + RAMP.map(([v, c]) => '#' + c.toString(16).padStart(6, '0') + ' ' + ((v + 1) * 50) + '%').join(',') + ')';
const VW = 360, OX = 80;
// маска силуэта считается один раз: проверка 88 тысяч точек по контурам тормозила каждое касание карты
let bodyMask = null;
function mask() { if (bodyMask) return bodyMask; const parts = bodyParts(), tc = document.createElement('canvas').getContext('2d'); bodyMask = new Uint8Array(200 * 440);
  for (let y = 0; y < 440; y++) for (let x = 0; x < 200; x++) if (parts.some(pp => tc.isPointInPath(pp, x, y))) bodyMask[y * 200 + x] = 1; return bodyMask; }
export function drawHeat(cv, spots, back, selected, labels) {
  const mine = spots.filter(s => s.back === back);
  const k = 1, W = 200 * k, H = 440 * k;
  const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d');
  const img = o.createImageData(W, H), parts = bodyParts(), inside = mask();
  const vals = new Float32Array(W * H).fill(NaN);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ux = x / k, uy = y / k; if (!inside[y * W + x]) continue;
    let num = 0, den = .55;
    for (const s of mine) { const dx = ux - s.x * 200, dy = uy - s.y * 440, sg = 13 + 13 * Math.abs(s.tone); const g = Math.exp(-(dx * dx + dy * dy) / (2 * sg * sg)); num += g * s.tone; den += g; }
    vals[y * W + x] = num / den;
  }
  const lvl = f => f < -.6 ? 0 : f < -.3 ? 1 : f < .3 ? 2 : f < .6 ? 3 : 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, f = vals[i]; if (Number.isNaN(f)) continue;
    let [r, g, b] = ramp(f); const rr = vals[i + 1], dd = vals[i + W];
    if ((x + 1 < W && !Number.isNaN(rr) && lvl(rr) !== lvl(f)) || (y + 1 < H && !Number.isNaN(dd) && lvl(dd) !== lvl(f))) { r *= .82; g *= .82; b *= .82; }
    img.data.set([r, g, b, 230], i * 4); }
  o.putImageData(img, 0, 0);
  const ctx = cv.getContext('2d'); const sc = cv.clientWidth * devicePixelRatio / VW; cv.width = VW * sc; cv.height = 440 * sc;
  ctx.scale(sc, sc); ctx.save(); ctx.translate(OX, 0);
  const grd = ctx.createLinearGradient(0, 0, 0, 440); grd.addColorStop(0, '#F7F1E7'); grd.addColorStop(1, '#E8DDCC'); ctx.fillStyle = grd; parts.forEach(pp => ctx.fill(pp));
  const sh = ctx.createLinearGradient(0, 0, 0, 440); sh.addColorStop(0, 'rgba(255,255,255,.22)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.06)');
  ctx.imageSmoothingQuality = 'high';
  for (const pp of parts) { ctx.save(); ctx.clip(pp); ctx.drawImage(off, 0, 0, 200, 440); ctx.fillStyle = sh; ctx.fillRect(0, 0, 200, 440); ctx.restore(); }
  ctx.strokeStyle = '#CDBFA9'; ctx.lineWidth = 1.2; parts.forEach(pp => ctx.stroke(pp));
  for (const s of mine.filter(s => s.k !== 'OK')) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(s.x * 200, s.y * 440, 3.2, 0, 7); ctx.fill(); }
  const sel = mine.find(s => s.key === selected); if (sel) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1E2533'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(sel.x * 200, sel.y * 440, 6, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // выноски
  const placed = []; ctx.font = '600 11.5px Onest, sans-serif';
  for (const l of labels.filter(l => mine.some(s => s.key === l.key)).sort((a, b) => mine.find(s => s.key === a.key).y - mine.find(s => s.key === b.key).y)) {
    const h = mine.find(s => s.key === l.key); const px = h.x * 200 + OX; let py = h.y * 440; const left = h.x < .5;
    // подпись целиком: перенос на вторую строку вместо обрезки, ширина по тексту
    ctx.font = '700 11px Onest, sans-serif'; const maxW = Math.max(60, OX + 22), words = l.title.split(' '), lines = [''];
    for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); }
    if (lines.length > 2) { lines.length = 2; while (ctx.measureText(lines[1] + '…').width > maxW && lines[1].length > 1) lines[1] = lines[1].slice(0, -1); lines[1] += '…'; }
    const tw = Math.max(...lines.map(t => ctx.measureText(t).width), (ctx.font = '500 10px Onest, sans-serif', ctx.measureText(l.sub).width));
    const bw = Math.ceil(tw) + 14, bh = 14 + lines.length * 12;
    while (placed.some(p => Math.abs(p - py) < bh + 4)) py += 8; placed.push(py);
    const bx = left ? 2 : VW - bw - 2, top = py - bh / 2;
    ctx.strokeStyle = l.color; ctx.globalAlpha = .7; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, h.y * 440); ctx.lineTo(left ? bx + bw : bx, py); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(bx, top, bw, bh, 9); ctx.fill(); ctx.fillStyle = l.color; ctx.fillRect(bx, top, 4, bh);
    ctx.fillStyle = '#1C1B19'; ctx.font = '700 11px Onest, sans-serif'; lines.forEach((t, i) => ctx.fillText(t, bx + 9, top + 13 + i * 12));
    ctx.fillStyle = l.color; ctx.font = '500 10px Onest, sans-serif'; ctx.fillText(l.sub, bx + 9, top + 13 + lines.length * 12);
  }
  return { hit(clientX, clientY) { const r = cv.getBoundingClientRect(); const ux = (clientX - r.left) / r.width * VW - OX, uy = (clientY - r.top) / r.height * 440;
    let best = null, bd = 34; for (const s of mine) { const d = Math.hypot(s.x * 200 - ux, s.y * 440 - uy); if (d < bd) { bd = d; best = s; } } return best; } };
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
export async function body3D(container, spots, onPick) {
  container.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#8A847A;font-size:14px">Загружаю 3D-модель…</div>';
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const m = await loadMesh(); const order = m.meta.order;
  const tone = new Map(); for (const s of spots) { const g = 1 + order.indexOf(s.id) * 2 + (s.side === 'RIGHT' ? 1 : 0); if (order.indexOf(s.id) >= 0) tone.set(g, s.tone); }
  const blobs = Object.entries(m.meta.blobs).map(([g, c]) => [+g, c]).filter(([g]) => Math.abs(tone.get(g) || 0) > .02);
  const col = new Float32Array(m.nv * 3);
  for (let i = 0; i < m.nv; i++) { const g = m.grp[i];
    if (g === 255) { col.set([.80, .74, .63], i * 3); continue; }
    const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; let num = 0, den = .9;
    for (const [bg, c] of blobs) { const t = tone.get(bg), sg = 75 * (.8 + .6 * Math.abs(t)); const d2 = (x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2; const w = Math.exp(-d2 / (2 * sg * sg)); num += w * t; den += w; }
    if (tone.has(g)) { num += 2.5 * tone.get(g); den += 2.5; }
    let v = Math.max(-1, Math.min(1, num / den * 1.3)); if (g === 0) v *= .7; const [r, gg, b] = ramp(v);
    // цвета шкалы заданы в sRGB, а рендер считает в линейном пространстве: переводим, иначе модель выглядит блеклой
    col.set([(r / 255) ** 2.2, (gg / 255) ** 2.2, (b / 255) ** 2.2], i * 3); }
  const geo = new THREE.BufferGeometry();
  // модель: x человека, z вверх, перед = −y → Three: X = x, Y = z, Z = −y
  const p2 = new Float32Array(m.nv * 3), n2 = new Float32Array(m.nv * 3);
  for (let i = 0; i < m.nv; i++) { p2[i * 3] = m.pos[i * 3]; p2[i * 3 + 1] = m.pos[i * 3 + 2]; p2[i * 3 + 2] = -m.pos[i * 3 + 1];
    n2[i * 3] = m.nrm[i * 3] / 127; n2[i * 3 + 1] = m.nrm[i * 3 + 2] / 127; n2[i * 3 + 2] = -m.nrm[i * 3 + 1] / 127; }
  geo.setAttribute('position', new THREE.BufferAttribute(p2, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xF3EEE6);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: 0, side: THREE.DoubleSide });
  const obj = new THREE.Mesh(geo, mat); const cz = (m.meta.zmin + m.meta.zmax) / 2; obj.position.y = -cz; const root = new THREE.Group(); root.add(obj); root.scale.setScalar(2 / (m.meta.zmax - m.meta.zmin)); scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 3); scene.add(dl); const bl = new THREE.DirectionalLight(0xffffff, 1.2); bl.position.set(-1, 1, -3); scene.add(bl);
  const W = container.clientWidth, H = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(30, W / H, .1, 50); camera.position.set(0, 0, 4.2);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(W, H); container.innerHTML = ''; container.appendChild(renderer.domElement);
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
  let alive = true; function anim() { if (!alive) return; if (!renderer.domElement.isConnected) { api.dispose(); return; }
    if (fly) { fly.k = Math.min(1, fly.k + .06); const e = 1 - (1 - fly.k) ** 3; ctl.target.lerpVectors(fly.from.t, fly.to.t, e); camera.position.lerpVectors(fly.from.p, fly.to.p, e); if (fly.k >= 1) fly = null; }
    ctl.update(); renderer.render(scene, camera); requestAnimationFrame(anim); }
  let isBack = false;
  const api = { turn(back) { isBack = back; const d = camera.position.distanceTo(ctl.target); flyTo(ctl.target, d, back); },
    focus(zone) { const [y, d] = ZONES[zone] || ZONES.all; flyTo(new THREE.Vector3(0, y, 0), d, isBack); },
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
