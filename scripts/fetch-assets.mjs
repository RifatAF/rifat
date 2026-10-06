// Тяжелые файлы (модель позы, озвучка, 3D-модель) не хранятся в Git.
// При сборке на Vercel скрипт копирует их с рабочего сайта; модели при необходимости берет у Google (MediaPipe).
// Если чего-то не хватает, сборка падает: неполная версия не попадет на сайт.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';

const ORIGINS = (process.env.ASSETS_ORIGIN || 'https://bodypassport.vercel.app,https://test.rifataiupov.com').split(',');
const MP = { 'models/pose_landmarker_full.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
  'models/pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task' };
const MIN = { 'models/pose_landmarker_full.task': 1e6, 'models/pose_landmarker_lite.task': 1e6, 'data/body3d.bin': 1e6 };

const exists = p => access(p).then(() => true, () => false);
async function get(path) {
  for (const o of ORIGINS) {
    try { const r = await fetch(o.replace(/\/$/, '') + '/' + path + '?build=' + Date.now(), { signal: AbortSignal.timeout(60000) });
      if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length >= (MIN[path] || 100)) return b; } } catch (e) {}
  }
  if (MP[path]) { const r = await fetch(MP[path]); if (r.ok) return Buffer.from(await r.arrayBuffer()); }
  throw new Error('не удалось получить ' + path);
}
async function save(path, buf) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, buf); }

const idx = JSON.parse((await get('voice/index.json')).toString('utf8'));
const files = ['models/pose_landmarker_full.task', 'models/pose_landmarker_lite.task', 'data/body3d.bin', ...new Set(Object.values(idx).map(f => 'voice/' + f))];
await save('voice/index.json', JSON.stringify(idx));
let n = 0;
for (let i = 0; i < files.length; i += 10) await Promise.all(files.slice(i, i + 10).map(async f => { if (await exists(f)) return; await save(f, await get(f)); n++; }));
console.log(`assets: ${n} файлов скопировано, всего ${files.length + 1}`);
