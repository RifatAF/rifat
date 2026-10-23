// Камера, MediaPipe, голос, тепловая карта (2D и 3D). Без сервера: все считается в браузере.
import { P } from './analysis.js';
import { track } from './track.js';
// MediaPipe со своего домена (кладет scripts/fetch-assets.mjs при сборке), jsdelivr только запасной вариант
const MP_LOCAL = new URL('../vendor/mediapipe', import.meta.url).href, MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20';

// ---------- контент ----------
export const C = {};
/** Выученные веса поверх исходных; исходный вес хранится в w0, повторное применение не накапливается. */
export function applyRuleWeights(rules, w, t) { for (const r of rules) { for (const m of r.muscles) { if (m.w0 === undefined) m.w0 = m.w ?? 1; const v = w && w[r.id + '|' + m.id]; m.w = Number.isFinite(v) ? v : m.w0; }
  // порог правила по нормам базы: меняем тот вид порога, что задан в правиле (absGreater, greater или less)
  const key = r.absGreater != null ? 'absGreater' : r.greater != null ? 'greater' : r.less != null ? 'less' : null; if (!key) continue;
  if (r.t0 === undefined) r.t0 = r[key]; const tv = t && t[r.id]; r[key] = Number.isFinite(tv) ? tv : r.t0; } }
export async function loadContent() {
  const get = n => fetch('data/' + n + '.json').then(r => r.json());
  const [mus, bm, ch, ex] = await Promise.all([get('muscles'), get('bodymap'), get('chains'), get('exercises')]);
  // тексты для клиента простым языком: без них экран результата работает на технических формулировках
  fetch('data/plain.json').then(r => r.ok ? r.json() : null).then(j => { C.plain = (j && j.rules) || {}; }).catch(() => { C.plain = {}; });
  C.muscles = mus.muscles; C.bodymap = bm; C.chains = ch.chains; C.exercises = Object.fromEntries(ex.exercises.map(e => [e.id, e])); C.booking = 'https://t.me/BodyPassport_bot';
  // веса «правило → мышца», выученные по калибровкам специалистов (Администрирование → Калибровки): без сети остаются исходные из базы
  // ждем не дольше 2,5 с: иначе клиент и специалист разбирали один тест с разными весами и видели разные мышцы
  const wq = fetch('/api/calib?a=weights', { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).then(j => { if (j && (j.w || j.t)) { applyRuleWeights(bm.rules, j.w, j.t); C.weightsAt = j.at || 0; C.thresholds = j.t || {}; } if (j) C.weights = { retest: j.retest || null }; }).catch(() => {});
  await Promise.race([wq, sleep(2500)]);
  return C;
}

// ---------- голос: заранее записанный нейроголос, системный как запасной ----------
let voiceIdx = {}, audio = null, unlocked = false;
// Записи играем через WebAudio: встроенный браузер Telegram и другие WebView не дают играть <audio> без нажатия на каждый звук,
// а AudioContext, разблокированный кнопкой «Начать тест», работает весь тест. <audio> остается запасным путем.
const bufs = new Map();
// короткая тишина для разблокировки <audio> на iPhone
const SILENT = (() => { try { const b = new ArrayBuffer(46), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 38, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, 2, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); } catch (e) { return ''; } })();
let shared = null; const sharedEl = () => { if (!shared) { shared = new Audio(); shared.setAttribute('playsinline', ''); shared.preload = 'auto'; } return shared; };
const ctxOk = () => voice._ac && voice._ac.state === 'running';
async function decode(f) { if (bufs.has(f)) return bufs.get(f);
  const p = fetch('voice/' + f).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(ab => new Promise((ok, no) => voice._ac.decodeAudioData(ab, ok, no)));
  bufs.set(f, p); p.catch(() => bufs.delete(f)); return p; }
/** Проиграть запись: { done: Promise (true — проиграно, false — не удалось), stop(), dur }. */
function playFile(f) { let stopped = false, src = null, el = null, res;
  const h = { done: new Promise(r => res = r), dur: 0, stop() { stopped = true; try { src && src.stop(); } catch (e) {} if (el) el.pause(); res(true); } };
  const viaEl = () => { if (stopped) return; el = sharedEl(); el.src = 'voice/' + f; el.onended = () => res(true); el.onerror = () => res(false);
    el.onloadedmetadata = () => { if (isFinite(el.duration)) h.dur = el.duration; }; el.play().catch(() => res(false)); };
  if (voice._ac && voice._ac.state !== 'running') voice._ac.resume().catch(() => {});
  if (ctxOk()) decode(f).then(b => { if (stopped) return; h.dur = b.duration; src = voice._ac.createBufferSource(); src.buffer = b; src.connect(voice._ac.destination); src.onended = () => res(true); src.start(); }).catch(viaEl);
  else viaEl();
  return h; }
// голос везде один: мужская запись DmitryNeural. Фразы без записи телефон читает только мужским голосом,
// иначе тишина (текст все равно на экране). Женский или случайный системный голос не используем никогда.
const MALE = /dmitr|yuri|юрий|maxim|максим|pavel|павел/i;
function sysSay(text, done) { try { if (!window.speechSynthesis) return false; const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ru') && MALE.test(v.name) && !/female|жен/i.test(v.name));
  if (!vs.length) { try { track('voice_missing', { c: String(text).slice(0, 60) }, false); } catch (e) {} return false; }
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.voice = vs[0]; if (done) u.onend = done; speechSynthesis.speak(u); return true; } catch (e) { return false; } }
// звук держим только во время теста и комплекса (voice.armed): иначе телефон отдает приложению аудиосессию
// и приглушает чужую музыку и видео (Ютуб в фоне) от любого касания
addEventListener('pointerup', () => { if (voice.armed) voice.unlock(); }, { capture: true, passive: true });
addEventListener('touchend', () => { if (voice.armed) voice.unlock(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (voice.armed && document.visibilityState === 'visible' && voice._ac && voice._ac.state !== 'running') voice._ac.resume().catch(() => {}); });
export const voice = {
  async init() { voiceIdx = await fetch('voice/index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => voiceIdx || {}); },
  /** Проверка перед тестом: все фразы есть в списке записей; если нет — перечитать список. */
  async ensure(texts) { if (texts.some(t => !voiceIdx[t.trim()])) await this.init(); return texts.filter(t => !voiceIdx[t.trim()]); },
  /** Есть ли запись этой фразы (тем же голосом, что в тесте). */
  has(text) { return !!voiceIdx[String(text || '').trim()]; },
  // вызывать из обработчика нажатия: разблокирует звук на весь тест
  // iPhone: звук разблокируется только внутри касания, а WebAudio по умолчанию молчит при беззвучном режиме (переключатель сбоку).
  // Поэтому: сессия «playback» (iOS 17+, играет и в беззвучном), разблокировка на каждом касании, общий <audio> как запасной путь
  armed: false, keep: false,
  /** Тест или комплекс закончился: отдать звук обратно телефону, чужая музыка снова играет в полную громкость. */
  release() { this.armed = false; if (audio) { audio.stop(); audio = null; } try { speechSynthesis.cancel(); } catch (e) {}
    try { if (this._ac && this._ac.state === 'running') this._ac.suspend().catch(() => {}); } catch (e) {}
    try { if (shared) { shared.pause(); shared.removeAttribute('src'); shared.load(); } } catch (e) {}
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {} },
  unlock() { this.armed = true; try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
    try { if (!this._ac) { this._ac = new (window.AudioContext || window.webkitAudioContext)(); this._ac.onstatechange = () => { if (this.armed && this._ac.state !== 'running' && document.visibilityState === 'visible') this._ac.resume().catch(() => {}); }; }
      if (this._ac.state !== 'running') this._ac.resume().catch(() => {});
      const b = this._ac.createBuffer(1, 1, 22050), s = this._ac.createBufferSource(); s.buffer = b; s.connect(this._ac.destination); s.start(0); } catch (e) {}
    if (unlocked) return; unlocked = true;
    try { if (window.speechSynthesis) speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(' '), { volume: 0 })); } catch (e) {}
    try { const a = sharedEl(); a.src = SILENT; a.play().then(() => a.pause()).catch(() => {}); } catch (e) {} },
  muted: localStorage.getItem('bp_mute') === '1',
  // занят, пока звучит фраза; ограничено оценкой длины фразы, чтобы сбой или медленная загрузка звука не «вешали» тест
  until: 0, hardUntil: 0,
  busy() { return Date.now() < Math.min(this.until, this.hardUntil); },
  // заранее грузим только фразы теста (около 1/3 записей), фразы упражнений грузятся, когда понадобятся
  preload(texts) { if (this._pre) return; this._pre = true; const files = [...new Set((texts || Object.keys(voiceIdx)).map(t => voiceIdx[t.trim()]).filter(Boolean))]; let i = 0;
    const next = () => { const batch = files.slice(i, i + 6); i += 6; if (!batch.length) return; Promise.all(batch.map(f => ctxOk() ? decode(f).catch(() => {}) : fetch('voice/' + f).catch(() => {}))).then(next); }; next(); },
  /** После разблокировки звука: раскодировать записи теста заранее, чтобы первая фраза не ждала загрузки. */
  warm(texts) { if (!ctxOk()) return; texts.map(t => voiceIdx[t.trim()]).filter(Boolean).forEach(f => decode(f).catch(() => {})); },
  /** Сказать фразу, не дожидаясь конца (подсказки по ходу). Обрывает предыдущую. */
  say(text, cueEl) {
    if (cueEl) cueEl.textContent = text;
    if (this.muted || !text) { if (audio) { audio.stop(); audio = null; } return; }
    const f = voiceIdx[text.trim()]; if (audio) { audio.stop(); audio = null; }
    const est = 400 + text.length * 70; this.until = Date.now() + est; this.hardUntil = Date.now() + est + 2500;
    if (f) { this.until = this.hardUntil = Date.now() + 15000; const h = playFile(f); audio = h; h.done.then(ok => { if (!ok && audio === h) sysSay(text); if (audio === h) this.until = 0; }); }
    else if (!sysSay(text, () => { this.until = 0; })) this.until = 0;
  },
  /** Сказать фразу целиком и дождаться конца. Не обрывается следующими фразами; не дольше 15 с, чтобы сбой звука не останавливал тест. */
  speak(text, cueEl) {
    if (cueEl) cueEl.textContent = text;
    // короткая подсказка еще звучит: дать ей договорить (не дольше 2 с), а не обрывать на полуслове
    if (this.busy()) { const t0 = Date.now(); return new Promise(r => { const w = () => this.busy() && Date.now() - t0 < 2000 ? setTimeout(w, 80) : r(); w(); }).then(() => this.speak(text)); }
    return new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; this.until = 0; res(); } };
      const est = 500 + text.length * 75; if (this.muted) return setTimeout(fin, 200);
      const f = voiceIdx[text.trim()]; if (audio) { audio.stop(); audio = null; }
      this.until = Date.now() + est; this.hardUntil = Date.now() + est + 15000;
      const tts = () => { if (!sysSay(text, () => setTimeout(fin, 150))) setTimeout(fin, est); else setTimeout(fin, est + 3000); };
      if (!f) return tts();
      const h = playFile(f); audio = h; h.done.then(ok => ok ? setTimeout(fin, 150) : tts());
      setTimeout(() => { if (!h.dur) fin(); }, est + 4000); setTimeout(fin, 15000 + est); });
  },
  /** Звуковой сигнал: старт — один высокий, стоп — два коротких. Слышно, даже если человек стоит спиной. */
  beep(kind = 'start') { try { const ac = this._ac || (this._ac = new (window.AudioContext || window.webkitAudioContext)()); const t = ac.currentTime;
    const one = (at, f, d) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(.35, t + at + .02); g.gain.exponentialRampToValueAtTime(.0001, t + at + d); o.connect(g).connect(ac.destination); o.start(t + at); o.stop(t + at + d + .05); };
    if (kind === 'start') one(0, 880, .25); else if (kind === 'tick') one(0, 1175, .09); else { one(0, 660, .12); one(.18, 660, .12); } } catch (e) {} },
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
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|VKClient|TikTok|Snapchat|Telegram-Android/i.test(ua);
  const tg = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
  const weak = mem <= 3 || cores <= 4;
  // встроенный браузер (Telegram, Android WebView): памяти меньше, чем у Chrome, и при тяжелой модели позы вкладку молча выгружало.
  // Здесь облегченный режим: быстрая модель, камера 720p, без записи видео теста
  const wv = tg || inApp || /Telegram|; wv\)/i.test(ua);
  let webgl2 = false; try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}
  return { ios, inApp, tg, wv, weak, webgl2, camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
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
// какая модель и где считается: пишется в результат теста и в отчет о проблеме, чтобы ретест на другом телефоне был объясним
export const poseInfo = { model: null, deleg: null, loadSec: null, src: null };
export async function initPose() {
  if (landmarker) return landmarker;
  const t0 = performance.now();
  try {
    let MP = MP_LOCAL, mod; try { mod = await import(MP + '/vision_bundle.mjs'); } catch (e) { MP = MP_CDN; mod = await import(MP + '/vision_bundle.mjs'); }
    const { PoseLandmarker, FilesetResolver } = mod; poseInfo.src = MP === MP_LOCAL ? 'local' : 'cdn';
    const fs = await FilesetResolver.forVisionTasks(MP + '/wasm');
    // на слабых телефонах облегченная модель: точность чуть ниже, но кадров в секунду вдвое больше
    poseInfo.model = poseModel(); const model = `models/pose_landmarker_${poseInfo.model}.task`;
    const opts = (d) => ({ baseOptions: { modelAssetPath: model, delegate: d }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .4, minPosePresenceConfidence: .4, minTrackingConfidence: .4 });
    try { landmarker = await PoseLandmarker.createFromOptions(fs, opts('GPU')); poseInfo.deleg = 'GPU'; }
    catch (e) { if (poseInfo.model === 'heavy') { localStorage.setItem('bp_heavy', '0'); poseInfo.model = 'full'; return initPose(); } landmarker = await PoseLandmarker.createFromOptions(fs, opts('CPU')); poseInfo.deleg = 'CPU'; }
  } catch (e) { track('pose_fail', { c: String(e && e.message || e).slice(0, 50), d: (performance.now() - t0) / 1000 }, false); throw e; }
  poseInfo.loadSec = Math.round((performance.now() - t0) / 100) / 10;
  track('pose_init', { c: `${poseInfo.deleg} ${poseInfo.model} ${poseInfo.src}`, d: poseInfo.loadSec }, false);
  return landmarker;
}
// точная модель (heavy) только там, где прошлый тест на full шел быстро (от 26 кадров/с на видеокарте);
// если на heavy кадров стало меньше 18, телефон возвращается на full. Слабые телефоны всегда на lite.
function poseModel() { if (device.weak || device.wv) return 'lite'; return localStorage.getItem('bp_heavy') === '1' ? 'heavy' : 'full'; }
export function notePoseSpeed(fps) { if (!fps || poseInfo.deleg !== 'GPU') return;
  try { if (poseInfo.model === 'full' && fps >= 26 && localStorage.getItem('bp_heavy') == null) localStorage.setItem('bp_heavy', '1');
    if (poseInfo.model === 'heavy' && fps < 18) localStorage.setItem('bp_heavy', '0'); } catch (e) {} }
// модель и MediaPipe заранее, пока человек читает инструкцию: на плохом Wi-Fi клиент не стоит и не ждет «Загружаю модель…»
let prefetched = false;
export function prefetchPose() { if (prefetched || landmarker) return; prefetched = true;
  const go = () => [`models/pose_landmarker_${poseModel()}.task`, MP_LOCAL + '/vision_bundle.mjs', MP_LOCAL + '/wasm/vision_wasm_internal.js', MP_LOCAL + '/wasm/vision_wasm_internal.wasm']
    .forEach(u => fetch(u, { priority: 'low' }).catch(() => {}));
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(go); }
export const cam = { video: null, stream: null, back: localStorage.getItem('bp_back') === '1', frame: null, running: false };
// встроенные браузеры соцсетей и Telegram: камера не работает или открывает галерею (ТЗ v4, п. 4.3). До камеры не пускаем
// Telegram Mini App на iPhone камеру дает (там работаем как раньше), на Android поле камеры открывает галерею
export const cameraBlocked = () => device.inApp || (device.tg && /Android/i.test(navigator.userAgent));
export function openInBrowserSheet() {
  if (document.getElementById('inappsheet')) return; track('cam_err', { c: 'inapp' }, false);
  const url = location.href.split('#')[0], android = /Android/i.test(navigator.userAgent);
  const intent = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
  const d = document.createElement('div'); d.className = 'sheet'; d.id = 'inappsheet';
  d.innerHTML = `<div><h2 style="font-size:24px;line-height:1.2">Откройте ссылку в ${android ? 'Chrome' : 'Safari'}</h2>
    <p class="sub" style="font-size:16px;margin-top:10px;line-height:1.45">Встроенный браузер ${device.tg ? 'Telegram' : 'соцсети'} не дает приложению камеру. В ${android ? 'Chrome' : 'Safari'} все заработает.</p>
    <p style="font-size:15px;margin-top:12px;line-height:1.45">${android ? 'Нажмите «Открыть в Chrome» или меню ⋮ → «Открыть в браузере».' : 'Нажмите ⋯ вверху → «Открыть в Safari» или скопируйте ссылку и вставьте в Safari.'}</p>
    ${android ? `<a class="btn" href="${intent}" style="margin-top:16px;text-decoration:none">Открыть в Chrome</a>` : ''}
    <button class="btn${android ? ' ghost' : ''}" id="iacopy" style="margin-top:${android ? 8 : 16}px">Копировать ссылку</button>
    <button class="btn ghost" id="iax" style="margin-top:8px;border:0">Закрыть</button></div>`;
  document.body.appendChild(d);
  d.querySelector('#iax').onclick = () => d.remove();
  d.querySelector('#iacopy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); } catch (e) { prompt('Скопируйте ссылку', url); } };
}
export async function startCamera(video) {
  if (cameraBlocked()) { openInBrowserSheet(); throw Object.assign(new Error('in-app browser'), { name: 'InAppBrowser' }); }
  stopCamera();
  cam.video = video;
  try { cam.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: cam.back ? 'environment' : 'user', width: { ideal: device.weak || device.wv ? 1280 : 1920 }, height: { ideal: device.weak || device.wv ? 720 : 1080 } } }); }
  catch (e) { track('cam_err', { c: (e && e.name) || 'unknown' }, false); throw e; }
  // самый широкий угол, который позволяет камера (на части Android есть зум меньше 1)
  try { const tr = cam.stream.getVideoTracks()[0], caps = tr.getCapabilities ? tr.getCapabilities() : {};
    if (caps.zoom) await tr.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }); } catch (e) {}
  video.srcObject = cam.stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play();
  video.style.transform = cam.back ? 'none' : 'scaleX(-1)'; video.style.objectFit = 'contain';
  cam.running = true; keepAwake(true); loop();
}
export function stopCamera() { keepAwake(false); setTimeout(() => { if (!cam.running && !voice.keep) voice.release(); }, 4000); cam.running = false; if (cam.stream) cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; }
let lastTs = -1, fpsT = performance.now(), fpsN = 0, loopGen = 0;
// Фильтр One Euro (Casiez и др., CHI 2012): на медленных движениях сильно гасит дрожание точек, на быстрых почти не запаздывает.
// Сырые точки модели «дрожат» на 1–2 % кадра даже у неподвижного человека: скелет трясся, а углы и отрыв пятки шумели.
const OE = { minCut: 1.2, beta: 4, dCut: 1 }, oeA = (cut, dt) => { const r = 2 * Math.PI * cut * dt; return r / (r + 1); };
let oeS = null, oeT = 0;
function oneEuro(pts, t) {
  const dt = t - oeT; if (!oeS || dt <= 0 || dt > .5 || oeS.length !== pts.length) { oeS = pts.map(l => ({ x: l.x, y: l.y, z: l.z, dx: 0, dy: 0 })); oeT = t; return pts; }
  oeT = t; const ad = oeA(OE.dCut, dt);
  return pts.map((l, i) => { const s = oeS[i];
    s.dx += ad * ((l.x - s.x) / dt - s.dx); s.dy += ad * ((l.y - s.y) / dt - s.dy);
    // точку с низкой видимостью сглаживаем сильнее: ее координаты модель угадывает
    const sp = Math.hypot(s.dx, s.dy), a = oeA(OE.minCut * ((l.visibility ?? 1) < .5 ? .5 : 1) + OE.beta * sp, dt);
    s.x += a * (l.x - s.x); s.y += a * (l.y - s.y); s.z += a * (l.z - s.z);
    return { ...l, x: s.x, y: s.y, z: s.z }; });
}
function loop(gen = ++loopGen) {
  // после перезапуска камеры старый цикл завершается: два цикла вызывали бы детектор дважды на кадр
  if (!cam.running || gen !== loopGen) return;
  const v = cam.video;
  if (landmarker && v.readyState >= 2 && !cam.hold) {
    const ts = performance.now(); if (ts - lastTs >= 30) { lastTs = ts;
      const r = landmarker.detectForVideo(v, ts); const w = v.videoWidth, h = v.videoHeight;
      const raw = r.landmarks && r.landmarks[0] ? oneEuro(r.landmarks[0], ts / 1000) : (oeS = null);
      const pose = raw ? raw.map(l => ({ x: l.x * w, y: l.y * h, z: l.z * w, visibility: l.visibility ?? 1 })) : null;
      const world = r.worldLandmarks && r.worldLandmarks[0] ? r.worldLandmarks[0].map(l => ({ x: l.x, y: l.y, z: l.z })) : null;
      fpsN++; if (ts - fpsT > 1000) { cam.fps = fpsN * 1000 / (ts - fpsT); fpsN = 0; fpsT = ts; }
      cam.frame = { t: ts / 1000, w, h, pose, world };
      if (cam.onFrame) cam.onFrame(cam.frame);
    }
  }
  requestAnimationFrame(() => loop(gen));
}
/** Точки на неподвижном снимке (фото «Быстрого теста»): та же модель в режиме видео, без сглаживания,
 *  три прохода по одному кадру, чтобы трекер модели сошелся на этом снимке. Живой цикл камеры на это время стоит. */
export async function detectStill(src) {
  await initPose(); const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height; let r = null;
  const was = cam.hold; cam.hold = true;
  try { for (let i = 0; i < 3; i++) { const ts = Math.max(performance.now(), lastTs + 1); lastTs = ts; r = landmarker.detectForVideo(src, ts); } }
  finally { cam.hold = was; oeS = null; }
  const l = r && r.landmarks && r.landmarks[0]; return l ? l.map(p => ({ x: p.x * w, y: p.y * h, visibility: p.visibility ?? 1 })) : null;
}
// prof: человек боком или спиной; дальние плечо и стопа закрыты телом, поэтому достаточно одной точки из пары
export function fullyVisible(p, prof) { if (!p) return false; const v = i => p[i].visibility > .5;
  if (prof) return (v(P.NOSE) || v(P.L_EAR) || v(P.R_EAR)) && (v(P.L_SHOULDER) || v(P.R_SHOULDER)) && (v(P.L_ANKLE) || v(P.R_ANKLE));
  return [P.NOSE, P.L_ANKLE, P.R_ANKLE, P.L_SHOULDER, P.R_SHOULDER].every(v); }

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
  const a = .7; const p = frame.pose.map((l, i) => { const o = sm[i] || l; const n = { x: o.x + (l.x - o.x) * a, y: o.y + (l.y - o.y) * a, visibility: l.visibility }; sm[i] = n; return n; });
  const m = l => [ox + (mir ? frame.w - l.x : l.x) * s, oy + l.y * s];
  const warn = opts.warn || !fullyVisible(frame.pose, opts.prof), bone = warn ? '#FFB547' : '#D4F25A';
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

// ---------- бета: запись видео теста (камера + скелет) ----------
/** Записывает то, что видит камера, со скелетом поверх, в один видеофайл. Нужна, чтобы показать разработчику, как трясется скелет или где сбился тест:
 *  системная запись экрана на части телефонов останавливается, пока камера занята. Возвращает { stop(): Promise<Blob|null> } или null, если браузер не умеет. */
export function recordTest(video) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  const c = document.createElement('canvas'), x = c.getContext('2d'); let on = true, rec = null; const parts = [];
  const draw = () => { if (!on) return; const w = video.videoWidth, h = video.videoHeight;
    if (w && h) { const k = Math.min(1, 720 / Math.max(w, h)); if (c.width !== Math.round(w * k)) { c.width = Math.round(w * k); c.height = Math.round(h * k); }
      const mir = !cam.back; x.save(); if (mir) { x.translate(c.width, 0); x.scale(-1, 1); } x.drawImage(video, 0, 0, c.width, c.height);
      const p = cam.frame && cam.frame.pose; if (p) { x.strokeStyle = '#D4F25A'; x.lineWidth = 4; x.lineCap = 'round';
        for (const [i, j] of BONES) if (p[i].visibility > .4 && p[j].visibility > .4) { x.beginPath(); x.moveTo(p[i].x * k, p[i].y * k); x.lineTo(p[j].x * k, p[j].y * k); x.stroke(); }
        x.fillStyle = '#fff'; for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) if (p[i].visibility > .4) { x.beginPath(); x.arc(p[i].x * k, p[i].y * k, 5, 0, 7); x.fill(); } }
      x.restore(); }
    requestAnimationFrame(draw); };
  draw();
  try { const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(c.captureStream(24), type ? { mimeType: type, videoBitsPerSecond: 2.5e6 } : undefined); rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); }; rec.start(1000); }
  catch (e) { on = false; return null; }
  return { stop: () => new Promise(res => { on = false; if (!rec || rec.state === 'inactive') return res(null); rec.onstop = () => res(parts.length ? new Blob(parts, { type: rec.mimeType || 'video/webm' }) : null); rec.stop(); }) };
}
/** Сохранить файл на телефон (в «Загрузки»). */
export function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }

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
const RAMP = [[-1, 0x3B73D9], [-.45, 0x8FB0F0], [0, 0xCEDBF2], [.45, 0xF8B860], [1, 0xEF4444]];
// цвет мышцы по состоянию, а не по знаку: гипертонус красный, перерастяжение оранжевый, слабая синяя; сила отклонения дает насыщенность
const STATE_RGB = { HYPER: [245, 158, 11], SHORT: [239, 68, 68], WEAK: [59, 115, 217], DONE: [34, 197, 94] }, BASE_LIGHT = [206, 219, 242], BASE_DARK = [184, 202, 236];
// клиенту цвет означает задачу тренировки, а не состояние мышцы: теплый = нагрузить (укрепить оранжевый, мягко укрепить желтый), холодный = расслабить (синий)
const ACT_RGB = { ...STATE_RGB, WEAK: [249, 115, 22], HYPER: [234, 179, 8], SHORT: [37, 99, 235] };
// в кабинете специалиста (navy) фигура холодная синяя, у клиента светлая
const darkUI = () => document.documentElement.dataset.session === 'SPECIALIST_OPERATED' || document.documentElement.dataset.theme === 'pro';
const baseRGB = () => darkUI() ? BASE_DARK : BASE_LIGHT;
// отчет клиенту из кабинета специалиста: на время отрисовки цвета задач клиента, а не состояний (pro.js, report)
let CLIENT_PAL = false; export const clientPalette = on => { CLIENT_PAL = !!on; };
const specPal = () => darkUI() && !CLIENT_PAL;
export function stateRGB(k, tone) { const P = specPal() ? STATE_RGB : ACT_RGB, c = P[k] || (tone < 0 ? P.WEAK : P.HYPER); const t = k === 'OK' ? 0 : Math.max(.55, Math.min(1, Math.abs(tone) * 1.3));
  return baseRGB().map((b, i) => Math.round(b + (c[i] - b) * t)); }
export function ramp(v) { const x = Math.max(-1, Math.min(1, v)); let i = RAMP.findLastIndex(r => r[0] <= x); i = Math.max(0, Math.min(RAMP.length - 2, i));
  const [a, ca] = RAMP[i], [b, cb] = RAMP[i + 1], t = Math.max(0, Math.min(1, (x - a) / (b - a))); const ch = (c, s) => (c >> s) & 255; const mix = s => Math.round(ch(ca, s) + (ch(cb, s) - ch(ca, s)) * t);
  return [mix(16), mix(8), mix(0)]; }
export const RAMP_CSS = 'linear-gradient(90deg,' + RAMP.map(([v, c]) => '#' + c.toString(16).padStart(6, '0') + ' ' + ((v + 1) * 50) + '%').join(',') + ')';
export const MARK_HEX = { HYPER: '#F59E0B', SHORT: '#EF4444', WEAK: '#3B73D9', DONE: '#22C55E' }, ACT_HEX = { ...MARK_HEX, WEAK: '#F97316', HYPER: '#EAB308', SHORT: '#2563EB' };
/** Маркер состояния формой: перегрузка — круг, укорочение — ромб, слабость — кольцо. derived: пунктир без ореола. */
export function drawMark(ctx, x, y, k, o = {}) {
  const c = (specPal() ? MARK_HEX : ACT_HEX)[k]; if (!c) return; const sc = o.scale ?? 1; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
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

// ---------- снимок 3D-модели для схемы: реалистичный силуэт и точные границы мышц вместо овалов ----------
// Один общий невидимый WebGL-рендерер; кадр рисуется синхронно, когда модель уже загружена.
let snap3 = null, snapFail = false;
const SNAP_HT = 1.08, SNAP_HW = SNAP_HT * 200 / 440; // кадр 200×440, как у плоской схемы
/** Загрузить three.js и модель заранее; без WebGL2 или при ошибке остается плоская схема. */
export async function ready3D() {
  if (snap3) return snap3; if (snapFail || !device.webgl2) throw new Error('no 3d');
  try { const [THREE, m] = await Promise.all([import('three'), loadMesh()]);
    const geo = new THREE.BufferGeometry(), p2 = new Float32Array(m.nv * 3), n2 = new Float32Array(m.nv * 3), col = new Float32Array(m.nv * 3);
    for (let i = 0; i < m.nv; i++) { p2[i * 3] = m.pos[i * 3]; p2[i * 3 + 1] = m.pos[i * 3 + 2]; p2[i * 3 + 2] = -m.pos[i * 3 + 1];
      n2[i * 3] = m.nrm[i * 3] / 127; n2[i * 3 + 1] = m.nrm[i * 3 + 2] / 127; n2[i * 3 + 2] = -m.nrm[i * 3 + 1] / 127; }
    geo.setAttribute('position', new THREE.BufferAttribute(p2, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
    const scene = new THREE.Scene(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0 });
    const obj = new THREE.Mesh(geo, mat), cz = (m.meta.zmin + m.meta.zmax) / 2, k = 2 / (m.meta.zmax - m.meta.zmin); obj.position.y = -cz;
    const root = new THREE.Group(); root.add(obj); root.scale.setScalar(k); scene.add(root);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 3); scene.add(dl);
    const fl = new THREE.DirectionalLight(0xffffff, .6); fl.position.set(-1, 0, 2); scene.add(fl);
    const cam = new THREE.OrthographicCamera(-SNAP_HW, SNAP_HW, SNAP_HT, -SNAP_HT, .1, 10); cam.position.set(0, 0, 4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setClearColor(0xffffff, 0);
    snap3 = { m, geo, col, root, scene, cam, renderer, cz, k, THREE, ix: m.idx };
    return snap3;
  } catch (e) { snapFail = true; throw e; }
}
/** Нарисовать модель в canvas-контекст (в координатах 200×440) и вернуть точки мышц в долях кадра. */
function draw3D(spots, back, wpx, hpx) {
  const S = snap3; spots = alias3d(spots, S.m.meta.order); paintMesh(S.m, spots, S.col); S.geo.attributes.color.needsUpdate = true;
  { const ix = meshIndex(S.m, spots); if (S.ix !== ix) { S.ix = ix; S.geo.setIndex(new S.THREE.BufferAttribute(ix, 1)); } }
  S.root.rotation.y = back ? Math.PI : 0;
  if (S.renderer.domElement.width !== wpx || S.renderer.domElement.height !== hpx) S.renderer.setSize(wpx, hpx, false);
  S.renderer.render(S.scene, S.cam);
  const img = document.createElement('canvas'); img.width = wpx; img.height = hpx; img.getContext('2d').drawImage(S.renderer.domElement, 0, 0);
  const order = S.m.meta.order, pos = new Map();
  for (const s of spots) { const i = order.indexOf(s.id); if (i < 0) continue; const c = S.m.meta.blobs[1 + i * 2 + (s.side === 'RIGHT' ? 1 : 0)]; if (!c) continue;
    const X = c[0] * S.k * (back ? -1 : 1), Y = (c[2] - S.cz) * S.k;
    pos.set(s.key, [(X + SNAP_HW) / (2 * SNAP_HW), (SNAP_HT - Y) / (2 * SNAP_HT)]); }
  return { img, pos };
}
/** Типовая фигура в позе клиента (ТЗ v4, п. 3.5): view 'front' | 'back' | 'right' | 'left', pose из pose-figure.poseOf.
 *  Возвращает canvas wpx×hpx с прозрачным фоном или null, если 3D недоступна. Сетку после снимка возвращаем в исходный вид. */
export async function posedFigure(spots, pose, view, wpx, hpx) {
  let S; try { S = await ready3D(); } catch (e) { return null; }
  const { poseVerts } = await import('./pose-figure.js'), m = S.m, pa = S.geo.attributes.position, na = S.geo.attributes.normal;
  if (!S.p0) { S.p0 = pa.array.slice(); S.n0 = na.array.slice(); }
  const pv = poseVerts(m.pos, pose, m.meta.zmax);
  for (let i = 0; i < m.nv; i++) { pa.array[i * 3] = pv[i * 3]; pa.array[i * 3 + 1] = pv[i * 3 + 2]; pa.array[i * 3 + 2] = -pv[i * 3 + 1]; }
  // нормали оставляем исходные: у анатомической сетки двойные слои, пересчет дает «хромированные» разводы; изгибы малы, свет почти не меняется
  pa.needsUpdate = true;
  const sp = alias3d(spots || [], m.meta.order); paintMesh(m, sp, S.col); S.geo.attributes.color.needsUpdate = true;
  { const ix = meshIndex(m, sp); if (S.ix !== ix) { S.ix = ix; S.geo.setIndex(new S.THREE.BufferAttribute(ix, 1)); } }
  S.root.rotation.y = { front: 0, back: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 }[view] || 0;
  if (S.renderer.domElement.width !== wpx || S.renderer.domElement.height !== hpx) S.renderer.setSize(wpx, hpx, false);
  S.renderer.render(S.scene, S.cam);
  const img = document.createElement('canvas'); img.width = wpx; img.height = hpx; img.getContext('2d').drawImage(S.renderer.domElement, 0, 0);
  pa.array.set(S.p0); pa.needsUpdate = true; na.array.set(S.n0); na.needsUpdate = true; S.root.rotation.y = 0;
  return img;
}
export function drawHeat(cv, spots0, back, selected, labels = [], opts = {}) {
  const use3 = !!snap3 && !opts.flat; cv._tok = (cv._tok || 0) + 1; const tok = cv._tok;
  if (!snap3 && !snapFail && device.webgl2 && !opts.flat) ready3D().then(() => { if (cv.isConnected && cv._tok === tok) drawHeat(cv, spots0, back, selected, labels, { ...opts, reveal: false }); }).catch(() => {});
  let spots = spots0.map(anchor), mine = spots.filter(s => s.back === back);
  const parts = bodyParts();
  // все фигуры этой стороны: тонкий контур как анатомическая подсказка, мышцы с отклонением заливаются цветом состояния
  const outline = Object.entries(SHAPES).filter(([id]) => C.muscles && C.muscles[id] && (C.muscles[id].view === 'back') === back).flatMap(([id]) => [...SHAPES[id], ...mirrorX(SHAPES[id], 'RIGHT')]).map(ell);
  const fillShapes = k => mine.filter(s => Math.abs(s.tone) > .05 && SHAPES[s.id]).sort((a, b) => Math.abs(a.tone) - Math.abs(b.tone)).flatMap(s => { const [r, g, b] = stateRGB(s.k, s.tone * k * (s.derived && !s.edited ? .75 : 1)); return shapeOf(s).map(e => [ell(e), `rgb(${r},${g},${b})`]); });
  const numbered = labels.length && labels.every(l => l.n), vw = numbered ? 200 : VW, ox = numbered ? 0 : OX;
  const ctx = cv.getContext('2d'); const sc = cv.clientWidth * devicePixelRatio / vw; cv.width = vw * sc; cv.height = 440 * sc;
  // реалистичная модель: точки мышц берем из проекции модели, а не из овалов плоской схемы
  let fig3 = null; if (use3) { try { fig3 = draw3D(spots0, back, Math.round(200 * sc), Math.round(440 * sc));
    const at = x => { const q = fig3.pos.get(x.key); return q ? { ...x, x: q[0], y: q[1] } : x; }; spots = spots.map(at); mine = mine.map(at); } catch (e) { fig3 = null; } }
  const shown = labels.filter(l => mine.some(s => s.key === l.key));
  const marks = mine.filter(s => s.k !== 'OK' && (!s.derived || s.byChain || s.edited) && !shown.some(l => l.key === s.key && l.n)).sort((a, b) => Math.abs(b.tone) - Math.abs(a.tone)).slice(0, 8);
  const render = (figA, toneK, markT, labA) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(sc, sc); ctx.save(); ctx.translate(ox, 0); ctx.globalAlpha = figA;
    if (fig3) { ctx.drawImage(fig3.img, 0, 0, 200, 440); ctx.globalAlpha = 1; } else {
    ctx.fillStyle = darkUI() ? '#B8CAEC' : '#CEDBF2'; parts.forEach(pp => ctx.fill(pp));
    ctx.strokeStyle = 'rgba(17,20,24,.10)'; ctx.lineWidth = .8; for (const pp of parts) { ctx.save(); ctx.clip(pp); outline.forEach(e => ctx.stroke(e)); ctx.restore(); }
    if (toneK > 0) { const fs = fillShapes(toneK); for (const pp of parts) { ctx.save(); ctx.clip(pp); ctx.globalAlpha = figA * .88; for (const [e, c] of fs) { ctx.fillStyle = c; ctx.fill(e); } ctx.restore(); } ctx.globalAlpha = figA; }
    ctx.strokeStyle = darkUI() ? '#93ACDA' : '#AFC2E6'; ctx.lineWidth = 1.2; parts.forEach(pp => ctx.stroke(pp)); ctx.globalAlpha = 1; }
    // halo: мини-фигура в карточке задачи; зона светится крупным пятном, иначе на маленькой фигуре ее не видно
    if (opts.halo) marks.forEach(s => { const c = (specPal() ? MARK_HEX : ACT_HEX)[s.k]; if (!c) return; const g = ctx.createRadialGradient(s.x * 200, s.y * 440, 0, s.x * 200, s.y * 440, 46);
      g.addColorStop(0, c + 'AA'); g.addColorStop(.55, c + '44'); g.addColorStop(1, c + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x * 200, s.y * 440, 46, 0, 7); ctx.fill(); });
    marks.forEach((s, i) => { const t = markT(i); if (t <= 0) return; const sc2 = t < .7 ? .4 + (1.15 - .4) * (t / .7) : 1.15 - .15 * ((t - .7) / .3);
      drawMark(ctx, s.x * 200, s.y * 440, s.k, { derived: s.derived && !s.edited, scale: t >= 1 ? 1 : sc2, alpha: Math.min(1, t * 2) }); });
    for (const l of shown.filter(l => l.n)) { const s = mine.find(q => q.key === l.key); ctx.globalAlpha = Math.min(1, labA * 2 + (markT(0) > 0 ? 1 : 0));
      ctx.fillStyle = '#0B1B3B'; ctx.beginPath(); ctx.arc(s.x * 200, s.y * 440, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 14px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(l.n), s.x * 200, s.y * 440 + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1; }
    // выбранная мышца видна в карточке под схемой: черное кольцо на схеме путали с еще одним состоянием
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
    const maxW = OX + 18; ctx.font = '400 12px Manrope, sans-serif';
    let title = l.title; while (ctx.measureText(title).width > maxW && title.length > 4) title = title.slice(0, -2) + '…';
    const val = l.value || l.sub || ''; ctx.font = l.value ? '500 13px "JetBrains Mono", monospace' : '600 12px Manrope, sans-serif';
    let v = val; while (ctx.measureText(v).width > maxW && v.length > 4) v = v.slice(0, -2) + '…';
    const tw = Math.max(ctx.measureText(v).width, (ctx.font = '400 12px Manrope, sans-serif', ctx.measureText(title).width));
    const bx = left ? 4 : VW - 4 - tw, ex = left ? bx + tw + 4 : bx - 4;
    ctx.strokeStyle = l.color; ctx.globalAlpha = alpha * .6; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, zy); ctx.lineTo(ex, py); ctx.stroke(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#566079'; ctx.font = '400 12px Manrope, sans-serif'; ctx.fillText(title, bx, py - 3);
    ctx.fillStyle = l.text || l.color; ctx.font = l.value ? '500 13px "JetBrains Mono", monospace' : '600 12px Manrope, sans-serif'; ctx.fillText(v, bx, py + 12);
  }
  ctx.globalAlpha = 1;
}

// ---------- 3D-модель мышц (Z-Anatomy на основе BodyParts3D, CC BY-SA) ----------
let mesh3d = null;
// Ромбовидные идут от остистых отростков C7–T5 косо вниз и наружу к медиальному краю лопатки: чем ниже, тем дальше от позвоночника.
// В группе сетки была и горизонтальная полоса до плеча (поперечные волокна трапециевидной): все, что шире этой косой границы, не ромбовидные.
const rhMaxX = z => 20 + Math.max(0, 1470 - z) * .41;
const TRAP_MID = 254; // средние (поперечные) волокна трапециевидной: своей мышцы в списке нет, красятся нейтрально
// Глубокие мышцы закрыты другими: когда такая мышца отмечена, все, что лежит над ней (снаружи по нормали, до 5 см), не рисуется.
// Так видна форма самой мышцы, а не пятно на поверхностной.
export const DEEP_IDS = ['rhomboid', 'levator', 'suboccipital', 'deep_neck_flex', 'scalene', 'pec_minor', 'serratus', 'iliopsoas', 'abdominals', 'ql', 'thoracic_ext', 'erector', 'glute_med'];
/** Индексы треугольников без слоев, закрывающих отмеченные глубокие мышцы. */
function meshIndex(m, spots) {
  const gs = [...new Set((spots || []).filter(s => s.k !== 'OK' && DEEP_IDS.includes(s.id)).flatMap(s => { const o = m.meta.order.indexOf(s.id); if (o < 0) return [];
    return (s.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [s.side]).map(sd => 1 + o * 2 + (sd === 'RIGHT' ? 1 : 0)); }))].sort((a, b) => a - b);
  if (!gs.length) return m.idx; const key = gs.join(); if (m.idxCache.has(key)) return m.idxCache.get(key);
  const G = new Set(gs), C = 20, key3 = (a, b, c) => ((a + 200) * 512 + (b + 200)) * 512 + (c + 200), cell = (x, y, z) => key3(Math.floor(x / C), Math.floor(y / C), Math.floor(z / C)), grid = new Map(), bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (let v = 0; v < m.nv; v++) { if (!G.has(m.grp[v])) continue; const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
    // только наружная сторона мышцы: нормаль смотрит от оси тела
    if (m.nrm[v * 3] * x + m.nrm[v * 3 + 1] * y <= 0) continue; const k = cell(x, y, z); (grid.get(k) || grid.set(k, []).get(k)).push(v);
    bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.min(bb[2], z); bb[3] = Math.max(bb[3], x); bb[4] = Math.max(bb[4], y); bb[5] = Math.max(bb[5], z); }
  const hide = new Uint8Array(m.nv);
  for (let q = 0; q < m.nv; q++) { if (G.has(m.grp[q])) continue; const x = m.pos[q * 3], y = m.pos[q * 3 + 1], z = m.pos[q * 3 + 2];
    if (x < bb[0] - 60 || x > bb[3] + 60 || y < bb[1] - 60 || y > bb[4] + 60 || z < bb[2] - 60 || z > bb[5] + 60) continue;
    const cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C); let h = false;
    for (let a = -2; a <= 2 && !h; a++) for (let b = -2; b <= 2 && !h; b++) for (let c = -2; c <= 2 && !h; c++) { const L = grid.get(key3(cx + a, cy + b, cz + c)); if (!L) continue;
      for (const p of L) { const dx = x - m.pos[p * 3], dy = y - m.pos[p * 3 + 1], dz = z - m.pos[p * 3 + 2], nx = m.nrm[p * 3] / 127, ny = m.nrm[p * 3 + 1] / 127, nz = m.nrm[p * 3 + 2] / 127;
        const al = dx * nx + dy * ny + dz * nz; if (al > 1 && al < 50 && dx * dx + dy * dy + dz * dz - al * al < 324) { h = true; break; } } }
    if (h) hide[q] = 1; }
  const keep = []; for (let t = 0; t < m.idx.length; t += 3) { const a = m.idx[t], b = m.idx[t + 1], c = m.idx[t + 2]; if (hide[a] || hide[b] || hide[c]) continue; keep.push(a, b, c); }
  const out = new Uint32Array(keep); m.idxCache.set(key, out); return out; }
// Женская фигура: та же размеченная сетка мышц с женскими пропорциями (уже плечи и грудная клетка, шире таз,
// полнее ягодицы, небольшой объем груди). Отдельной женской модели с разметкой мышц нет, поэтому меняем форму, а не мышцы.
let bodySex = 'M', meshF = null;
/** Пол фигуры для схем и 3D: 'F' — женская, иначе мужская. Вызывать перед отрисовкой экрана человека. */
export function setBodySex(s) { const v = s === 'F' ? 'F' : 'M'; if (v === bodySex) return; bodySex = v; if (snap3) { try { snap3.renderer.dispose(); } catch (e) {} snap3 = null; } }
const XS = [[0, 1], [.3, 1], [.42, 1.03], [.5, 1.08], [.56, 1.07], [.62, .93], [.7, .94], [.78, .9], [.82, .88], [.86, .9], [.9, .95], [1, .95]];
const lerpT = (t, h) => { for (let i = 1; i < t.length; i++) if (h <= t[i][0]) { const [a, va] = t[i - 1], [b, vb] = t[i]; return va + (vb - va) * (h - a) / (b - a); } return t[t.length - 1][1]; };
const gs = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));
function shapeF(x, y, z, zmin, H) { const h = (z - zmin) / H; x *= lerpT(XS, h);
  if (y > 0) y *= 1 + .1 * gs(h, .52, .04); // ягодицы
  else { const ax = Math.abs(x); y -= 22 * gs(h, .73, .03) * gs(ax, 85, 40); } // грудь
  return [x, y, z]; }
function femalize(b) { const zmin = b.meta.zmin, H = b.meta.zmax - b.meta.zmin, pos = new Float32Array(b.pos.length);
  for (let i = 0; i < b.nv; i++) { const [x, y, z] = shapeF(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2], zmin, H); pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }
  const blobs = Object.fromEntries(Object.entries(b.meta.blobs).map(([g, c]) => [g, Array.isArray(c) ? shapeF(c[0], c[1], c[2], zmin, H) : c]));
  return { ...b, pos, idxCache: new Map(), meta: { ...b.meta, blobs } }; }
async function loadMesh() { const b = await loadMeshM(); if (bodySex !== 'F') return b; return meshF || (meshF = femalize(b)); }
async function loadMeshM() {
  if (mesh3d) return mesh3d;
  const [buf, meta] = await Promise.all([fetch('data/body3d.bin').then(r => r.arrayBuffer()), fetch('data/body3d.json').then(r => r.json())]);
  const dv = new DataView(buf); const nv = dv.getInt32(4, true), ni = dv.getInt32(8, true);
  const pos = new Float32Array(buf, 12, nv * 3); const nrm = new Int8Array(buf, 12 + nv * 12, nv * 3); const grp = new Uint8Array(buf, 12 + nv * 15, nv); const idx = new Uint32Array(buf.slice(12 + nv * 16, 12 + nv * 16 + ni * 4));
  // в сетке группы трапециевидной подписаны наоборот: «верхняя» лежит на уровне середины спины (центр 1325 мм), «нижняя» у шеи (1474 мм).
  // Меняем имена местами, чтобы слабая нижняя трапециевидная красилась внизу, а не у шеи
  const ord = meta.order.slice(), iu = ord.indexOf('upper_trap'), il = ord.indexOf('lower_trap');
  if (iu >= 0 && il >= 0 && meta.blobs[1 + iu * 2] && meta.blobs[1 + il * 2] && meta.blobs[1 + iu * 2][2] < meta.blobs[1 + il * 2][2]) { ord[iu] = 'lower_trap'; ord[il] = 'upper_trap'; }
  // Разметка сетки проверена по сводке групп (scripts/fetch-assets.mjs → data/body3d-stats.json):
  // 1) в группу «ромбовидные» попала поперечная часть трапециевидной: ромбовидные идут от остистых отростков до медиального края лопатки
  //    (не дальше ~85 мм от средней линии), а группа доходила до 167 мм, к акромиону. Все дальше 85 мм — нейтральная мышца;
  // 2) у «нижней трапециевидной» верхняя часть (выше 1360 мм) — это средние, поперечные волокна: тоже нейтральная;
  // 3) прямой мышцы живота в сетке нет отдельной группой: передняя полоса живота (|x| < 55 мм, спереди, 880–1260 мм) из групп «косые» и «пресс» становится rectus_abd.
  const gOf = id => ord.indexOf(id), rh = gOf('rhomboid'), lt = gOf('lower_trap'), ob = gOf('obliques'), ab = gOf('abdominals');
  const isG = (g, o) => o >= 0 && (g === 1 + o * 2 || g === 2 + o * 2);
  let ra = -1; const blobs = { ...meta.blobs }, acc = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
  if (!ord.includes('rectus_abd') && 1 + ord.length * 2 + 1 < 255) { ord.push('rectus_abd'); ra = ord.length - 1; }
  for (let i = 0; i < nv; i++) { const g = grp[i], x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (isG(g, rh) && Math.abs(x) > rhMaxX(z)) grp[i] = TRAP_MID;
    else if (isG(g, lt) && z > 1360) grp[i] = TRAP_MID;
    else if (ra >= 0 && (isG(g, ob) || isG(g, ab)) && Math.abs(x) < 55 && y < -80 && z > 880 && z < 1260) { const s = x > 0 ? 'L' : 'R'; grp[i] = 1 + ra * 2 + (s === 'R' ? 1 : 0); const a = acc[s]; a[0] += x; a[1] += y; a[2] += z; a[3]++; } }
  if (ra >= 0) for (const [s, a] of Object.entries(acc)) if (a[3]) blobs[1 + ra * 2 + (s === 'R' ? 1 : 0)] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
  // центры поправленных групп пересчитываем, чтобы маркеры и подсветка глубоких мышц стояли на месте
  for (const o of [rh, lt]) if (o >= 0) for (const d of [0, 1]) { const g = 1 + o * 2 + d; let n = 0, c = [0, 0, 0];
    for (let i = 0; i < nv; i++) if (grp[i] === g) { c[0] += pos[i * 3]; c[1] += pos[i * 3 + 1]; c[2] += pos[i * 3 + 2]; n++; } if (n) blobs[g] = c.map(v => v / n); }
  mesh3d = { pos, nrm, grp, idx, idxCache: new Map(), meta: { ...meta, order: ord, blobs }, nv };
  return mesh3d;
}
/** Фоновая подгрузка 3D, пока человек смотрит карту: кнопка 3D потом открывается сразу. */
export function preload3D() { const go = () => { import('three'); import('three/addons/controls/OrbitControls.js'); ready3D().catch(() => {}); };
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500); }
// раскраска сетки по тону: и для живой 3D-модели, и для снимков схемы
function paintMesh(m, spots, out) { const order = m.meta.order, lin = c => (c / 255) ** 2.2, BASE3 = baseRGB().map(lin);
  // группа сетки → цвет мышцы по состоянию; соседям достается слабый край того же цвета, чтобы граница читалась
  const col = new Map(); for (const s of spots) { const o = order.indexOf(s.id); if (o < 0 || s.k === 'OK' || Math.abs(s.tone) < .02) continue; col.set(1 + o * 2 + (s.side === 'RIGHT' ? 1 : 0), stateRGB(s.k, s.tone).map(lin)); }
  // глубокие мышцы закрыты поверхностными (ромбовидные под трапецией, малая грудная под большой): их цвет просвечивает четким пятном над ними
  const DEEP = new Set([]); // глубокие мышцы теперь видны через окно в верхних слоях (meshIndex), свечение сквозь поверхность не нужно
  const blobs = Object.entries(m.meta.blobs).map(([g, c]) => [+g, c, DEEP.has((+g - 1) >> 1)]).filter(([g]) => col.has(+g));
  for (let i = 0; i < m.nv; i++) { const g = m.grp[i];
    if (g === 255 || g === TRAP_MID) { out.set(BASE3, i * 3); continue; }
    let c = col.get(g);
    if (!c) { const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; let w0 = 1, acc = BASE3.slice();
      for (const [bg, ctr, deep] of blobs) { const sg = deep ? 30 : 22, d2 = (x - ctr[0]) ** 2 + (y - ctr[1]) ** 2 + (z - ctr[2]) ** 2; if (d2 > 9 * sg * sg) continue; const w = (deep ? 1.6 : .3) * Math.exp(-d2 / (2 * sg * sg)), bc = col.get(bg);
        for (let q = 0; q < 3; q++) acc[q] += w * bc[q]; w0 += w; }
      c = acc.map(v => v / w0); }
    if (g === 0 && c !== BASE3) c = c.map((v, q) => BASE3[q] + (v - BASE3[q]) * .7);
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; } }
// мышцы без своей группы в сетке (глубокие и мелкие) показываем на покрывающей их мышце, если та сама не отмечена
const ALIAS3D = { piriformis: 'glute_max', supraspinatus: 'upper_trap', soleus: 'calf' };
const alias3d = (spots, order) => (spots || []).map(s => order.indexOf(s.id) >= 0 || !ALIAS3D[s.id] || (spots.some(o => o.id === ALIAS3D[s.id] && o.side === s.side && o.k !== 'OK')) ? s : { ...s, id: ALIAS3D[s.id] });
export async function body3D(container, spots0, onPick, opts = {}) {
  container.style.borderRadius = '24px'; container.style.overflow = 'hidden'; const bg3 = darkUI() ? 0x101A2E : 0xFFFFFF; container.style.background = '#' + bg3.toString(16).padStart(6, '0');
  container.innerHTML = '<div class="skel" style="height:100%"></div>';
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const m = await loadMesh(); const order = m.meta.order; let spots = alias3d(spots0, order);
  const col = new Float32Array(m.nv * 3), lin = c => (c / 255) ** 2.2, BASE3 = ramp(0).map(lin);
  const paint = (spots, out) => paintMesh(m, spots, out);
  paint(spots, col);
  const geo = new THREE.BufferGeometry();
  // модель: x человека, z вверх, перед = −y → Three: X = x, Y = z, Z = −y
  const p2 = new Float32Array(m.nv * 3), n2 = new Float32Array(m.nv * 3);
  for (let i = 0; i < m.nv; i++) { p2[i * 3] = m.pos[i * 3]; p2[i * 3 + 1] = m.pos[i * 3 + 2]; p2[i * 3 + 2] = -m.pos[i * 3 + 1];
    n2[i * 3] = m.nrm[i * 3] / 127; n2[i * 3 + 1] = m.nrm[i * 3 + 2] / 127; n2[i * 3 + 2] = -m.nrm[i * 3 + 1] / 127; }
  // фигура в позе клиента (быстрый тест): вершины и центры мышц сдвигаются по замерам, нормали пересчитываются
  const PF = opts.pose ? await import('./pose-figure.js') : null; let curPose = opts.pose || null;
  const bend = pose => { const pv = PF.poseVerts(m.pos, pose, m.meta.zmax); for (let i = 0; i < m.nv; i++) { p2[i * 3] = pv[i * 3]; p2[i * 3 + 1] = pv[i * 3 + 2]; p2[i * 3 + 2] = -pv[i * 3 + 1]; } };
  const at3 = c => { if (!curPose) return new THREE.Vector3(c[0], c[2], -c[1]); const q = PF.poseVerts(Float32Array.of(c[0], c[1], c[2]), curPose, m.meta.zmax); return new THREE.Vector3(q[0], q[2], -q[1]); };
  if (curPose) bend(curPose);
  geo.setAttribute('position', new THREE.BufferAttribute(p2, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); let curIx = meshIndex(m, spots); geo.setIndex(new THREE.BufferAttribute(curIx, 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg3);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, side: THREE.DoubleSide });
  const obj = new THREE.Mesh(geo, mat); const cz = (m.meta.zmin + m.meta.zmax) / 2; obj.position.y = -cz; const root = new THREE.Group(); root.add(obj); root.scale.setScalar(2 / (m.meta.zmax - m.meta.zmin)); scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 3); scene.add(dl); const bl = new THREE.DirectionalLight(0xffffff, 1.2); bl.position.set(-1, 1, -3); scene.add(bl);
  const W = container.clientWidth, H = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(30, W / H, .1, 50); camera.position.set(0, 0, 4.2);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(device.weak ? 1.25 : 1.75, devicePixelRatio)); renderer.setSize(W, H); container.innerHTML = ''; container.appendChild(renderer.domElement); if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.insertAdjacentHTML('beforeend', '<a href="/licenses" target="_blank" style="position:absolute;right:12px;bottom:6px;font-size:12px;color:#566079;text-decoration:none">3D: Z-Anatomy, CC BY-SA 4.0</a><div class="hint3d">Один палец: повернуть · два: приблизить</div><div class="ctl3d"><button data-c="in" aria-label="Приблизить">+</button><button data-c="out" aria-label="Отдалить">−</button><button data-c="turn" aria-label="Повернуть на 180°">↻</button><button data-c="home" aria-label="Все тело">⌂</button></div>');
  setTimeout(() => { const h = container.querySelector('.hint3d'); if (h) h.style.opacity = 0; }, 3000);
  // масштаб к точке под пальцами, сдвиг двумя пальцами: можно рассмотреть шею или стопу, а не только центр
  const ctl = new OrbitControls(camera, renderer.domElement); ctl.enablePan = true; ctl.screenSpacePanning = true; ctl.zoomToCursor = true;
  ctl.minDistance = .35; ctl.maxDistance = 6; ctl.enableDamping = true; ctl.dampingFactor = .12; ctl.rotateSpeed = .7; ctl.zoomSpeed = .9; ctl.panSpeed = .7;
  // фигура не переворачивается: наклон камеры ограничен, вращение в основном вокруг вертикальной оси, как на поворотном столе
  ctl.minPolarAngle = Math.PI * .3; ctl.maxPolarAngle = Math.PI * .7; ctl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  renderer.domElement.style.touchAction = 'none';
  const ray = new THREE.Raycaster(); let down = null;
  // плавный перелет камеры к зоне
  let fly = null; const flyTo = (target, dist, back) => { const from = { t: ctl.target.clone(), p: camera.position.clone() };
    const dir = back === undefined ? camera.position.clone().sub(ctl.target).normalize() : back.isVector3 ? back.clone() : new THREE.Vector3(0, 0, back ? -1 : 1);
    fly = { from, to: { t: target.clone(), p: target.clone().add(dir.multiplyScalar(dist)) }, k: 0 }; };
  const H0 = 2; // рост модели в сцене
  container.querySelectorAll('.ctl3d [data-c]').forEach(b => b.onclick = e => { e.stopPropagation(); const c = b.dataset.c, d = camera.position.distanceTo(ctl.target);
    if (c === 'in' || c === 'out') flyTo(ctl.target.clone(), Math.max(ctl.minDistance, Math.min(ctl.maxDistance, d * (c === 'in' ? .7 : 1.4))));
    else if (c === 'turn') api.turn(!isBack); else api.focus('all'); });
  const ZONES = { all: [0, 4.2], head: [.82, 1.1], shoulders: [.62, 1.3], back: [.32, 1.5], pelvis: [.05, 1.4], knees: [-.45, 1.3], feet: [-.88, 1.0] };
  let tapT = 0; renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY];
    // двойное касание: приблизиться к этой точке
    if (Date.now() - tapT < 300) { const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
      const hit = ray.intersectObject(obj)[0]; if (hit) flyTo(hit.point, Math.max(.6, camera.position.distanceTo(ctl.target) * .5)); }
    tapT = Date.now(); });
  renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return; const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = ray.intersectObject(obj)[0]; if (!hit) return; const g = m.grp[hit.face.a]; if (g > 0 && g < 255 && order[(g - 1) >> 1]) { const id = order[(g - 1) >> 1]; if (only && !only.has(id)) return; onPick && onPick(id + ':' + ((g - 1) % 2 ? 'RIGHT' : 'LEFT')); } });
  // маркеры состояния поверх модели. Видимость без трассировки лучей: маркер виден, если его сторона тела смотрит на камеру
  // (трассировка по сетке на каждом кадре тормозила вращение на телефонах)
  let marks = [], only = null, lastSpots = spots;
  const buildMarks = spots => { marks.forEach(x => x.el.remove()); if (opts.noMarks) { marks = []; return; }
    marks = spots.filter(s => s.k !== 'OK' && s.k !== 'DONE' && s.k !== 'NT' && order.indexOf(s.id) >= 0).map(s => { const g = 1 + order.indexOf(s.id) * 2 + (s.side === 'RIGHT' ? 1 : 0), c = m.meta.blobs[g]; if (!c) return null;
      const el = document.createElement('button'); el.className = 'mark3d'; el.setAttribute('aria-label', s.key); el.innerHTML = `<span class="mark ${s.k}"${s.derived && !s.edited ? ' style="opacity:.75"' : ''}></span>`;
      el.onclick = () => onPick && onPick(s.key); container.appendChild(el); return { el, c, local: at3(c), vis: null }; }).filter(Boolean); };
  buildMarks(spots);
  // Поток частиц по волокнам, как ветер на погодной карте: главная ось мышцы (PCA по ее наружной поверхности) ≈ направление
  // волокон, поперек оси несколько дорожек на всю ширину мышцы. Гипертонус: частицы стекаются с концов к центру и гаснут
  // в нем (мышца стягивается). Перерастяжение: разбегаются от центра к краям (мышцу растягивают). Слабая: редкие тусклые
  // частицы еле ползут и мерцают (мышца не включается). Частица — светящаяся точка с хвостом, лежит на коже по нормали сетки.
  const arrows = new THREE.Group(); obj.add(arrows); let arr = [];
  const lanesOf = g => { const V = []; for (let v = 0; v < m.nv; v++) if (m.grp[v] === g && m.nrm[v * 3] * m.pos[v * 3] + m.nrm[v * 3 + 1] * m.pos[v * 3 + 1] > 0) V.push(v);
    if (V.length < 12) return null; const c = [0, 0, 0], nn = [0, 0, 0]; for (const v of V) for (let q = 0; q < 3; q++) { c[q] += m.pos[v * 3 + q] / V.length; nn[q] += m.nrm[v * 3 + q]; }
    const cv = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const v of V) { const d = [0, 1, 2].map(q => m.pos[v * 3 + q] - c[q]); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cv[a * 3 + b] += d[a] * d[b]; }
    let u = [1, .7, .4]; for (let it = 0; it < 24; it++) { const w = [0, 1, 2].map(a => cv[a * 3] * u[0] + cv[a * 3 + 1] * u[1] + cv[a * 3 + 2] * u[2]), l = Math.hypot(...w) || 1; u = w.map(x => x / l); }
    // поперечная ось: перпендикуляр к оси волокон в плоскости кожи
    const nl = Math.hypot(...nn) || 1, n0 = nn.map(x => x / nl); let w = [u[1] * n0[2] - u[2] * n0[1], u[2] * n0[0] - u[0] * n0[2], u[0] * n0[1] - u[1] * n0[0]]; const wl = Math.hypot(...w) || 1; w = w.map(x => x / wl);
    const pu = V.map(v => (m.pos[v * 3] - c[0]) * u[0] + (m.pos[v * 3 + 1] - c[1]) * u[1] + (m.pos[v * 3 + 2] - c[2]) * u[2]).sort((a, b) => a - b);
    const pw = V.map(v => (m.pos[v * 3] - c[0]) * w[0] + (m.pos[v * 3 + 1] - c[1]) * w[1] + (m.pos[v * 3 + 2] - c[2]) * w[2]).sort((a, b) => a - b);
    const t0 = pu[Math.floor(pu.length * .1)], t1 = pu[Math.floor(pu.length * .9)], o0 = pw[Math.floor(pw.length * .28)], o1 = pw[Math.floor(pw.length * .72)], K = 16, NL = 4, lanes = [];
    for (let li = 0; li < NL; li++) { const o = o0 + (o1 - o0) * (NL === 1 ? .5 : li / (NL - 1)), P = [], N = []; let miss = 0;
      for (let k = 0; k < K; k++) { const t = t0 + (t1 - t0) * k / (K - 1), q = [0, 1, 2].map(a => c[a] + u[a] * t + w[a] * o); let best = -1, bd = 1e18;
        for (const v of V) { const d = (m.pos[v * 3] - q[0]) ** 2 + (m.pos[v * 3 + 1] - q[1]) ** 2 + (m.pos[v * 3 + 2] - q[2]) ** 2; if (d < bd) { bd = d; best = v; } }
        if (bd > 225) miss++; // точка дорожки ушла с мышцы дальше 1,5 см: такую дорожку не рисуем, чтобы частицы не заходили на соседей
        P.push(new THREE.Vector3(m.pos[best * 3], m.pos[best * 3 + 2], -m.pos[best * 3 + 1])); N.push(new THREE.Vector3(m.nrm[best * 3], m.nrm[best * 3 + 2], -m.nrm[best * 3 + 1]).normalize()); }
      if (miss < K * .2) lanes.push({ P, N }); }
    return lanes.length ? lanes : null; };
  const lanesBy = new Map(), RGB = { SHORT: [.784, .255, .29], HYPER: [.851, .51, .169], WEAK: [.184, .42, .847] };
  const TAIL = [[1, 1], [.8, .6], [.62, .34], [.46, .16]]; // размер и яркость головы и хвоста
  const pmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: { value: 1 } },
    vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC; void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; float a = vA * smoothstep(.5, .28, d); gl_FragColor = vec4(mix(min(vec3(1.), vC * 1.45 + .12), vC * .5, smoothstep(.1, .45, d)), a); }' });
  let pts = null, parts = [];
  const along = (ln, f) => { const x = Math.max(0, Math.min(ln.P.length - 1.001, f * (ln.P.length - 1))), i = Math.floor(x), k = x - i; return [ln.P[i].clone().lerp(ln.P[i + 1], k), ln.N[i].clone().lerp(ln.N[i + 1], k).normalize()]; };
  const buildArrows = spots => { parts = []; if (pts) { arrows.remove(pts); pts.geometry.dispose(); pts = null; }
    if (!opts.arrows) return;
    for (const s of spots) { if (!RGB[s.k] || order.indexOf(s.id) < 0 || (only && !only.has(s.id))) continue; const g = 1 + order.indexOf(s.id) * 2 + (s.side === 'RIGHT' ? 1 : 0);
      if (!lanesBy.has(g)) lanesBy.set(g, lanesOf(g)); const L = lanesBy.get(g); if (!L) continue;
      const n = s.k === 'WEAK' ? 8 : Math.round(8 + 10 * Math.min(1, Math.abs(s.tone))); // сильнее отклонение, гуще поток
      for (let j = 0; j < n; j++) parts.push({ k: s.k, ln: L[j % L.length], half: j % 2, ph: Math.random(), sp: (s.k === 'WEAK' ? .05 : .32) * (.75 + Math.random() * .5), fl: Math.random() * 6.3, c: RGB[s.k] }); }
    if (!parts.length) return; const nv = parts.length * TAIL.length, geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3)); geo2.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(nv), 1));
    geo2.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(nv), 1)); const colA = new Float32Array(nv * 3); parts.forEach((p, i) => { for (let t = 0; t < TAIL.length; t++) colA.set(p.c, (i * TAIL.length + t) * 3); });
    geo2.setAttribute('aColor', new THREE.BufferAttribute(colA, 3)); pts = new THREE.Points(geo2, pmat); pts.frustumCulled = false; pts.renderOrder = 2; arrows.add(pts); arrows.userData.done = false; };
  let lastT = performance.now();
  const stepArrows = now => { if (!pts) return; const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    pmat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)) * root.scale.x;
    const P = pts.geometry.attributes.position.array, S = pts.geometry.attributes.aSize.array, A = pts.geometry.attributes.aAlpha.array;
    parts.forEach((p, i) => { p.ph = (p.ph + dt * p.sp) % 1; let f, dir, a;
      if (p.k === 'WEAK') { f = .15 + .7 * ((p.fl * .13 + p.ph) % 1); dir = p.half ? 1 : -1; a = .25 + .45 * (.5 + .5 * Math.sin(now / 420 + p.fl)); }
      // гипертонус: от конца к центру; перерастяжение: от центра к концу. Половина частиц с одной стороны, половина с другой
      else { const r = p.k === 'SHORT' ? p.ph * .5 : .5 - p.ph * .5; f = p.half ? 1 - r : r; dir = ((p.k === 'SHORT') === !p.half) ? 1 : -1; a = Math.sin(Math.PI * p.ph) ** .7; }
      for (let t = 0; t < TAIL.length; t++) { const ft = f - dir * t * (p.k === 'WEAK' ? .012 : .03), [q, nrm] = along(p.ln, ft), o = (i * TAIL.length + t);
        q.addScaledVector(nrm, 5); P[o * 3] = q.x; P[o * 3 + 1] = q.y; P[o * 3 + 2] = q.z; S[o] = (p.k === 'WEAK' ? 8 : 10) * TAIL[t][0]; A[o] = a * TAIL[t][1] * .75; } });
    pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.aSize.needsUpdate = true; pts.geometry.attributes.aAlpha.needsUpdate = true; };
  buildArrows(spots); let normOn = false, lastArrow = 0;
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
    const now = performance.now(); if (parts.length && !normOn && now - lastArrow > (device.weak ? 66 : 33)) { lastArrow = now; if (!reduceMotion() || !arrows.userData.done) { stepArrows(reduceMotion() ? 900 : now); arrows.userData.done = true; dirty = true; } }
    ctl.update(); if (dirty) { dirty = false; renderer.render(scene, camera); placeMarks(); } requestAnimationFrame(anim); }
  let isBack = false;
  const api = { turn(back) { isBack = back; const d = camera.position.distanceTo(ctl.target); flyTo(ctl.target, d, back); if (opts.onTurn) opts.onTurn(back); },
    focus(zone) { const [y, d] = ZONES[zone] || ZONES.all; flyTo(new THREE.Vector3(0, y, 0), d, isBack); },
    /** Ракурс: 'front' | 'right' | 'back' | 'left' (правый бок клиента к камере, как на фото «Справа»). */
    look(view) { const a = { front: 0, right: -Math.PI / 2, back: Math.PI, left: Math.PI / 2 }[view] || 0; isBack = view === 'back';
      flyTo(new THREE.Vector3(0, 0, 0), ZONES.all[1], new THREE.Vector3(Math.sin(a), 0, Math.cos(a))); },
    /** Новая поза (кнопки «Усилить») без пересоздания сцены. */
    pose(p) { if (!PF) return; curPose = p; bend(p); geo.attributes.position.needsUpdate = true; marks.forEach(x => { x.local = at3(x.c); }); dirty = true; },
    /** Новая раскраска и маркеры (правка специалиста) без пересоздания сцены и сброса камеры. */
    /** Слой мышц: ids — набор видимых и кликабельных мышц, null — все слои. */
    only(ids) { only = ids; api.update(lastSpots); },
    /** «Как должно быть»: мышцы в балансе, без цвета, маркеров и стрелок. false — вернуть результат теста. */
    norm(on) { normOn = !!on; const sp = normOn ? lastSpots.map(s => ({ ...s, k: 'OK', tone: 0 })) : (only ? lastSpots.map(s => only.has(s.id) ? s : { ...s, k: 'OK', tone: 0 }) : lastSpots);
      paint(sp, col); target.set(col); geo.attributes.color.needsUpdate = true; arrows.visible = !normOn; marks.forEach(x => { x.el.hidden = normOn; }); dirty = true; },
    update(spots) { spots = alias3d(spots, order); lastSpots = spots; spots = only ? spots.map(s => only.has(s.id) ? s : { ...s, k: 'OK', tone: 0 }) : spots; paint(spots, col); target.set(col); geo.attributes.color.needsUpdate = true; { const ix = meshIndex(m, spots); if (ix !== curIx) { curIx = ix; geo.setIndex(new THREE.BufferAttribute(ix, 1)); } } buildMarks(spots); buildArrows(spots); if (normOn) api.norm(true); dirty = true; },
    dispose() { if (!alive) return; alive = false; ctl.dispose(); if (pts) pts.geometry.dispose(); pmat.dispose(); geo.dispose(); mat.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {} } };
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

// ---------- любое всплывающее окно (.sheet): крестик, тап по затемнению и свайп вниз закрывают его ----------
// Порядок закрытия: событие 'bp-close' (окно с ожиданием ответа отвечает «отмена»), затем собственный обработчик
// тапа по фону, если он есть, и только потом простое удаление. data-locked="1" — окно закрыть нельзя (идет запись).
export function closeSheet(o) {
  if (!o.isConnected || o._closing) return; o._closing = true;
  o.dispatchEvent(new Event('bp-close')); if (o.isConnected) o.click(); if (o.isConnected) o.remove();
}
function armSheet(o) {
  const box = o.firstElementChild; if (!box || o.dataset.armed || o.dataset.locked) return; o.dataset.armed = '1';
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  const x = document.createElement('button'); x.className = 'sheet-x'; x.setAttribute('aria-label', 'Закрыть'); x.textContent = '✕';
  x.onclick = e => { e.stopPropagation(); closeSheet(o); }; box.prepend(x);
  o.addEventListener('click', e => { if (e.target === o && !o._closing) closeSheet(o); });
  let y0 = null, dy = 0;
  box.addEventListener('touchstart', e => { y0 = box.scrollTop <= 0 && !e.target.closest('input[type=range]') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  box.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); box.style.transform = dy ? `translateY(${dy}px)` : ''; }, { passive: true });
  box.addEventListener('touchend', () => { if (y0 === null) return; y0 = null; if (dy > 90) return closeSheet(o);
    box.style.transition = 'transform .2s'; box.style.transform = ''; setTimeout(() => { box.style.transition = ''; }, 220); });
}
if (typeof document !== 'undefined' && document.body) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('sheet')) armSheet(n); })
  .observe(document.body, { childList: true });

// подсказки [?]: текст показывается одной плашкой внизу экрана, а не рядом с кнопкой (там он уезжал за край)
if (typeof document !== 'undefined') {
  const closeQ = () => { document.querySelectorAll('.qpop').forEach(x => x.remove()); document.querySelectorAll('details.q[open]').forEach(x => x.open = false); };
  document.addEventListener('toggle', e => { const d = e.target; if (!(d instanceof HTMLElement) || !d.matches('details.q')) return;
    if (!d.open) { document.querySelectorAll('.qpop').forEach(x => x.remove()); return; }
    document.querySelectorAll('details.q[open]').forEach(x => { if (x !== d) x.open = false; }); document.querySelectorAll('.qpop').forEach(x => x.remove());
    const body = d.querySelector(':scope > div'); if (!body) return; const p = document.createElement('div'); p.className = 'qpop'; p.setAttribute('role', 'dialog');
    p.innerHTML = `<div style="${body.getAttribute('style') || ''}">${body.innerHTML}</div><button aria-label="Закрыть">✕</button>`; p.querySelector('button').onclick = closeQ; document.body.appendChild(p); }, true);
  document.addEventListener('pointerdown', e => { if (document.querySelector('.qpop') && !e.target.closest('.qpop, details.q')) closeQ(); }, true);
}
