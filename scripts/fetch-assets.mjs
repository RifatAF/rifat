// Тяжелые файлы (модель позы, озвучка, 3D-модель) не хранятся в Git.
// При сборке на Vercel скрипт копирует их с рабочего сайта; модели при необходимости берет у Google (MediaPipe, версия 1 закреплена:
// пороги правил подобраны под конкретную модель, «latest» мог бы молча ее подменить).
// Если чего-то не хватает, сборка падает: неполная версия не попадет на сайт.
import { mkdir, writeFile, access, cp, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

const ORIGINS = (process.env.ASSETS_ORIGIN || 'https://bodypassport.vercel.app,https://test.rifataiupov.com').split(',');
const MP = { 'models/pose_landmarker_full.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  'models/pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  'models/pose_landmarker_heavy.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task' };
// MediaPipe и three.js отдаются с нашего домена: в РФ jsdelivr бывает недоступен или медленный, а модель на приеме должна открыться всегда.
// Версии закреплены так же, как в коде (js/core.js, index.html); без них сборка падает.
const CDN = 'https://cdn.jsdelivr.net/npm/', TV = '@mediapipe/tasks-vision@0.10.20/', TH = 'three@0.160.0/';
const VENDOR = { 'vendor/mediapipe/vision_bundle.mjs': CDN + TV + 'vision_bundle.mjs',
  'vendor/mediapipe/wasm/vision_wasm_internal.js': CDN + TV + 'wasm/vision_wasm_internal.js', 'vendor/mediapipe/wasm/vision_wasm_internal.wasm': CDN + TV + 'wasm/vision_wasm_internal.wasm',
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js': CDN + TV + 'wasm/vision_wasm_nosimd_internal.js', 'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm': CDN + TV + 'wasm/vision_wasm_nosimd_internal.wasm',
  'vendor/three/three.module.js': CDN + TH + 'build/three.module.js', 'vendor/three/addons/controls/OrbitControls.js': CDN + TH + 'examples/jsm/controls/OrbitControls.js' };
Object.assign(MP, VENDOR);
const MIN = { 'models/pose_landmarker_full.task': 1e6, 'models/pose_landmarker_lite.task': 1e6, 'data/body3d.bin': 1e6, 'vendor/mediapipe/wasm/vision_wasm_internal.wasm': 1e6, 'vendor/three/three.module.js': 3e5 };

const exists = p => access(p).then(() => true, () => false);
async function get(path) {
  for (const o of ORIGINS) {
    try { const r = await fetch(o.replace(/\/$/, '') + '/' + path + '?build=' + Date.now(), { signal: AbortSignal.timeout(60000) });
      if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length >= (MIN[path] || 100) && !/^\s*<(!doctype|html)/i.test(b.subarray(0, 64).toString())) return b; } } catch (e) {}
  }
  if (MP[path]) { const r = await fetch(MP[path]); if (r.ok) return Buffer.from(await r.arrayBuffer()); }
  throw new Error('не удалось получить ' + path);
}
async function save(path, buf) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, buf); }

// сайт собирается в public/: Vercel публикует ее целиком, вместе со скачанными файлами
const OUT = 'public';
const SKIP = new Set(['api', 'scripts', 'node_modules', 'public', '.git', '.vercel', 'package.json', 'package-lock.json', 'AUDIT.md', '.gitignore', '.vercelignore', 'vercel.json', '_headers', 'tests']);
await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true });
const { readdir } = await import('node:fs/promises');
for (const e of await readdir('.')) if (!SKIP.has(e) && !e.endsWith('.md')) await cp(e, OUT + '/' + e, { recursive: true });

const idx = JSON.parse((await get('voice/index.json')).toString('utf8'));
const files = ['models/pose_landmarker_full.task', 'models/pose_landmarker_lite.task', 'data/body3d.bin', ...Object.keys(VENDOR), ...new Set(Object.values(idx).map(f => 'voice/' + f))];
await save(OUT + '/voice/index.json', JSON.stringify(idx));
let n = 0;
for (let i = 0; i < files.length; i += 10) await Promise.all(files.slice(i, i + 10).map(async f => { if (await exists(OUT + '/' + f)) return; await save(OUT + '/' + f, await get(f)); n++; }));
console.log(`assets: ${n} файлов скопировано, всего ${files.length + 1}`);
// точная модель для сильных телефонов: без нее приложение просто остается на full
try { if (!(await exists(OUT + '/models/pose_landmarker_heavy.task'))) await save(OUT + '/models/pose_landmarker_heavy.task', await get('models/pose_landmarker_heavy.task')); } catch (e) { console.warn('heavy: ' + e.message); }

// Озвучка фраз, для которых еще нет записи (упражнения на «вы», новые подсказки): нейроголос ru-RU-DmitryNeural при сборке.
// Новые записи попадают в voice/index.json на сайте, и следующая сборка просто копирует их. VOICE_REGEN_ALL=1 переозвучивает все фразы одним голосом.
// Ошибка озвучки не валит сборку: приложение тогда читает фразу голосом телефона.
try {
  const { sayText } = await import('../js/saytext.js');
  const { readFile } = await import('node:fs/promises'); const crypto = await import('node:crypto');
  const ex = JSON.parse(await readFile('data/exercises.json', 'utf8')).exercises;
  const extra = JSON.parse(await readFile('data/voice-extra.json', 'utf8').catch(() => '[]'));
  const regen = process.env.VOICE_REGEN_ALL === '1', voiceName = process.env.VOICE_TTS || 'ru-RU-DmitryNeural';
  const need = [...new Set([...ex.map(sayText), ...extra, ...(regen ? Object.keys(idx) : [])])].filter(t => t && (regen || !idx[t]));
  if (need.length) {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS(); await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    let made = 0; const t0 = Date.now();
    for (const text of need) { if (Date.now() - t0 > 240000) break;
      try { const { audioStream } = tts.toStream(text); const ch = []; await new Promise((ok, bad) => { audioStream.on('data', c => ch.push(c)); audioStream.on('end', ok); audioStream.on('close', ok); audioStream.on('error', bad); });
        const buf = Buffer.concat(ch); if (buf.length < 2000) continue;
        const f = crypto.createHash('sha1').update(voiceName + text).digest('hex').slice(0, 16) + '.mp3'; await save(OUT + '/voice/' + f, buf); idx[text] = f; made++; } catch (e) { console.log('voice: не озвучено', text.slice(0, 40), e.message); } }
    try { tts.close(); } catch (e) {}
    await save(OUT + '/voice/index.json', JSON.stringify(idx)); console.log(`voice: озвучено ${made} из ${need.length} (${voiceName})`);
  }
} catch (e) { console.log('voice: озвучка пропущена:', e.message); }

// Сводка по группам 3D-сетки (границы, центры, срезы по высоте): по ней проверяется разметка мышц без скачивания сетки
try {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(OUT + '/data/body3d.bin'), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), dv = new DataView(ab);
  const nv = dv.getInt32(4, true), pos = new Float32Array(ab, 12, nv * 3), grp = new Uint8Array(ab, 12 + nv * 15, nv), st = {}, slab = {};
  for (let i = 0; i < nv; i++) { const g = grp[i], x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; const s = st[g] ||= { n: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], c: [0, 0, 0] };
    s.n++; [x, y, z].forEach((v, k) => { s.min[k] = Math.min(s.min[k], v); s.max[k] = Math.max(s.max[k], v); s.c[k] += v; });
    // срезы: группа → высота (шаг 50 мм) → [|x| мин, |x| макс, y мин, y макс] для спины, шеи и живота
    if (z > 850 && z < 1600) { const zk = Math.round(z / 50) * 50, t = ((slab[g] ||= {})[zk] ||= [1e9, -1e9, 1e9, -1e9, 0]); const ax = Math.abs(x);
      t[0] = Math.min(t[0], ax); t[1] = Math.max(t[1], ax); t[2] = Math.min(t[2], y); t[3] = Math.max(t[3], y); t[4]++; } }
  for (const s of Object.values(st)) { s.c = s.c.map(v => Math.round(v / s.n)); s.min = s.min.map(Math.round); s.max = s.max.map(Math.round); }
  for (const g of Object.values(slab)) for (const k in g) g[k] = g[k].map(Math.round);
  await save(OUT + '/data/body3d-stats.json', JSON.stringify({ nv, groups: st, slab }));
} catch (e) { console.warn('mesh stats: ' + e.message); }
