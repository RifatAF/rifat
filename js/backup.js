// Резервная копия. По умолчанию (ТЗ v4, п. 5) данные остаются на телефоне, копия только файлом: downloadBackup
// или шифрованная копия кабинета. Серверная копия в аккаунте включается флагом CLOUD_BACKUP на сервере (после юриста):
// тогда тесты, анкета, занятия и база клиентов дублируются в приватный Blob. Записи движения и видео не идут никогда.
// Старые копии, сохраненные до выключения, по-прежнему возвращаются на пустой телефон после входа.
import { meSync, configSync } from './auth.js';
import { toast } from './core.js';

// ключи, которые относятся к этому телефону, а не к человеку
const LOCAL_ONLY = /^bp_(sid|back|mute|noev|sess|login_role|inst|poses_wiped|tg|mail|bk_at|bk_hash|legacy_pro|legacy_client)\b/;
const PRO_STORES = ['clients', 'assessments', 'meta'];
const proDbName = () => { const u = meSync(); return u && u.id ? 'bodypassport-pro-' + u.id : null; };

function idb(name) { return new Promise((ok, no) => { const r = indexedDB.open(name, 1);
  r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('clients', { keyPath: 'id' }); const a = d.createObjectStore('assessments', { keyPath: 'id' }); a.createIndex('clientId', 'clientId'); d.createObjectStore('poses', { keyPath: 'assessmentId' }); d.createObjectStore('meta', { keyPath: 'k' }); };
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); }
const getAll = (d, st) => new Promise(ok => { try { const q = d.transaction(st).objectStore(st).getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); } catch (e) { ok([]); } });
const putAll = (d, st, rows) => new Promise(ok => { try { const t = d.transaction(st, 'readwrite'), o = t.objectStore(st); for (const x of rows) o.put(x); t.oncomplete = ok; t.onerror = () => ok(); } catch (e) { ok(); } });
async function proDump() { const n = proDbName(); if (!n || !indexedDB.databases) return null;
  const l = await indexedDB.databases().catch(() => null); if (!l || !l.some(x => x.name === n)) return null;
  const d = await idb(n), out = {}; for (const st of PRO_STORES) out[st] = await getAll(d, st); d.close();
  // записи скелета внутри оценок не храним
  out.assessments = out.assessments.map(({ poses, ...a }) => a); return out.clients.length || out.assessments.length ? out : null; }

/** Снимок данных человека на этом телефоне. */
export async function snapshot() {
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('bp_') && !LOCAL_ONLY.test(k)) ls[k] = localStorage.getItem(k); }
  return { ls, pro: await proDump().catch(() => null) };
}
const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

let timer = null, busy = false;
/** Отправить копию, если что-то поменялось. Вызывается после теста, занятия, анкеты и при сворачивании приложения. */
export function backupSoon(ms = 3000) { clearTimeout(timer); timer = setTimeout(() => backupNow().catch(() => {}), ms); }
export async function backupNow() {
  if (busy || !configSync().cloudBackup || !meSync() || !navigator.onLine) return false; busy = true;
  try { const data = await snapshot(), raw = JSON.stringify(data), h = hash(raw);
    if (!Object.keys(data.ls).length && !data.pro) return false; if (localStorage.getItem('bp_bk_hash') === h) return true;
    const r = await fetch('/api/auth?a=backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }), keepalive: raw.length < 6e4 });
    if (r.ok) { localStorage.setItem('bp_bk_hash', h); localStorage.setItem('bp_bk_at', String(Date.now())); } return r.ok;
  } finally { busy = false; } }

/** Вернуть данные из копии: локальные значения не перетираются, тесты и журналы объединяются. */
export async function applyBackup(data) {
  let n = 0; const merge = (k, v) => { const cur = localStorage.getItem(k); if (cur == null) { localStorage.setItem(k, v); n++; return; }
    // списки (тесты, занятия, отчеты) объединяем без повторов
    try { const a = JSON.parse(cur), b = JSON.parse(v); if (Array.isArray(a) && Array.isArray(b)) { const seen = new Set(a.map(x => JSON.stringify(x))), add = b.filter(x => !seen.has(JSON.stringify(x)));
      if (add.length) { const all = [...a, ...add].sort((x, y) => ((x && (x.date || x.t || x.at)) || 0) - ((y && (y.date || y.t || y.at)) || 0)); localStorage.setItem(k, JSON.stringify(all)); n += add.length; } } } catch (e) {} };
  for (const [k, v] of Object.entries((data && data.ls) || {})) if (/^bp_/.test(k) && typeof v === 'string' && !LOCAL_ONLY.test(k)) merge(k, v);
  if (data && data.pro && proDbName()) { const d = await idb(proDbName()); for (const st of PRO_STORES) { const rows = (data.pro[st] || []).filter(x => x && typeof x === 'object'); const have = new Set((await getAll(d, st)).map(x => x.id || x.k));
    const add = rows.filter(x => !have.has(x.id || x.k)); if (add.length) { await putAll(d, st, add); n += add.length; } } d.close(); }
  return n;
}
/** После входа: если на телефоне пусто, а в аккаунте есть копия, вернуть ее (один раз за сессию). */
export async function restoreIfEmpty() {
  const u = meSync(); if (!u || sessionStorage.getItem('bp_rs_' + u.id)) return 0; sessionStorage.setItem('bp_rs_' + u.id, '1');
  const mine = await snapshot().catch(() => ({ ls: {} })); const hasTests = Object.keys(mine.ls).some(k => /^bp_(tests|done|profile)/.test(k));
  if (hasTests && mine.pro) return 0;
  const r = await fetch('/api/auth?a=backup', { cache: 'no-store' }).catch(() => null); if (!r || !r.ok) return 0;
  const j = await r.json().catch(() => null); if (!j || !j.backup || !j.backup.data) return 0;
  const n = await applyBackup(j.backup.data); if (n) toast('Данные восстановлены из аккаунта'); return n;
}

/** Восстановление из файла: своя копия (JSON с ls/pro) или выгрузка калибровки (cases) — из нее собираются клиенты и оценки. */
export async function restoreFromFile(file) {
  const o = JSON.parse(await file.text());
  if (o && (o.ls || o.pro)) return applyBackup(o);
  if (o && Array.isArray(o.cases)) {
    const latest = new Map(); for (const c of o.cases) { const k = c && c.case && c.case.caseId; if (k && (!latest.has(k) || latest.get(k).at < c.at)) latest.set(k, c); }
    const clients = [], assessments = [];
    for (const [id, c] of latest) { const k = c.case, cid = 'rc_' + id, created = Date.parse(k.created) || c.at;
      const sr = k.selfReport || null;
      clients.push({ id: cid, created, name: k.name || 'Клиент ' + new Date(created).toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' · ' + id.slice(0, 4), first: k.name || 'Клиент', last: '', dob: '', sex: (sr && sr.sex) || '', height: (sr && sr.height) || '', leg: 'R', hand: 'R', activity: '', complaints: '', notes: 'Восстановлено из калибровки',
        calib: { labels: ((k.expert && k.expert.labels) || []).map(l => ({ id: l.muscle, side: l.side, k: l.state })), note: (k.expert && k.expert.note) || '' }, ...(sr ? { selfReport: sr } : {}) });
      (k.assessments || []).forEach((a, i) => assessments.push({ id: cid + '_' + i, clientId: cid, date: Date.parse(a.date) || created, templateName: 'Восстановлено', protocol: a.protocol || [], snapshot: a.snapshot || null, side: a.side || null,
        moves: a.moves || {}, quality: a.quality || {}, limits: a.limits || {}, pain: a.pain || {}, clientNote: a.clientNote || '', hyp: {}, check: {}, note: '', plan: null })); }
    return applyBackup({ ls: {}, pro: { clients, assessments, meta: [] } });
  }
  throw new Error('Это не файл BodyPassport');
}
/** Файл с копией: на случай, если человек хочет сохранить данные у себя. */
export async function downloadBackup() {
  const data = await snapshot(), name = 'bodypassport-backup-' + new Date().toISOString().slice(0, 10) + '.json', blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) {} }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
/** Выбор файла и восстановление. */
export function pickRestore(done) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
  i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; try { const n = await restoreFromFile(f); toast(n ? `Восстановлено: ${n}` : 'Все уже на месте'); done && done(n); } catch (e) { toast(e.message || 'Не удалось прочитать файл'); } };
  i.click();
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') backupNow().catch(() => {}); });
addEventListener('bp-login', () => { restoreIfEmpty().catch(() => {}); });
