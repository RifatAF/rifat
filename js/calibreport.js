// Сводка калибровки по многим людям: что приложение сказало бы сейчас (пересчет по сохраненным замерам текущими правилами)
// против оценки специалиста. Один и тот же код работает в приложении (администрирование) и в скрипте scripts/calib-report.mjs.
import { analyze, calibCompare } from './analysis.js';

const RES = ['match', 'side', 'opposite', 'missed', 'notMeasured'];
export const RES_NAMES = { match: 'совпало', side: 'другая сторона', opposite: 'наоборот', missed: 'не увидело', notMeasured: 'тест не измеряет', extra: 'лишнее' };

/** docs: случаи из файла калибровки ({cases:[...]}) или с сервера ({case, from}). C: справочники приложения. */
export function calibReport(docs, C) {
  const cases = [], muscles = {}, tot = { expert: 0, app: 0, extra: 0 };
  const m = id => (muscles[id] = muscles[id] || { id, name: (C.muscles[id] || { name: id }).name, extra: 0, ...Object.fromEntries(RES.map(r => [r, 0])) });
  for (const d of docs) { const c = d.case || d; const a0 = (c.assessments || []).at(-1); if (!a0) continue;
    const a = { ...a0, date: Date.parse(a0.date) || Date.now() };
    let r; try { r = analyze(a, C); } catch (e) { continue; }
    // фоновый случай: явной оценки нет, сравниваем с проверками специалиста в разборе (кроме «норма»)
    const labels = (c.expert.labels || []).length ? c.expert.labels : (a0.specialistEdits || []).filter(e => e.state !== 'OK').map(e => ({ muscle: e.muscle, side: e.side, state: e.state }));
    const cmp = calibCompare(labels, r.tones, C.bodymap.rules);
    for (const x of cmp.rows) m(x.id)[x.res]++;
    for (const x of cmp.extra) m(x.id).extra++;
    for (const [k, v] of Object.entries(cmp.counts)) tot[k] = (tot[k] || 0) + v;
    cases.push({ label: c.caseId || c.name || '?', from: d.from ? d.from.name : '', own: d.own !== false, auto: !!c.auto, date: a0.date, note: c.expert.note || '', clientNote: a0.clientNote || '', pain: a0.pain || {},
      edits: a0.specialistEdits || null, findings: r.findings.map(f => f.observed), ...cmp }); }
  // доля совпадений среди отметок, которые тест вообще может увидеть
  const seen = (tot.match || 0) + (tot.side || 0) + (tot.opposite || 0) + (tot.missed || 0);
  tot.recall = seen ? Math.round((tot.match || 0) / seen * 100) : null;
  tot.precision = tot.app ? Math.round((tot.match || 0) / tot.app * 100) : null;
  const list = Object.values(muscles).sort((x, y) => (y.match + y.side + y.opposite + y.missed + y.extra) - (x.match + x.side + x.opposite + x.missed + x.extra));
  return { n: cases.length, cases, muscles: list, totals: tot };
}
const sideRu = s => s === 'LEFT' ? 'слева' : s === 'RIGHT' ? 'справа' : 'обе';
const dirRu = d => d > 0 ? 'тонус повышен' : 'слабая';
/** Таблица по мышцам в CSV (открывается в Excel и Google Таблицах). */
export function reportCSV(rep) {
  const head = ['Мышца', ...RES.map(r => RES_NAMES[r]), RES_NAMES.extra].join(';');
  return '﻿' + [head, ...rep.muscles.map(x => [x.name, ...RES.map(r => x[r]), x.extra].join(';'))].join('\n');
}
/** Короткий текст по одному случаю: что совпало и что нет. */
export function caseLines(c, C) {
  const nm = id => (C.muscles[id] || { name: id }).name;
  return c.rows.map(x => `${nm(x.id)} ${sideRu(x.side)}, ${dirRu(x.dir)}: ${RES_NAMES[x.res]}`).concat(c.extra.map(x => `${nm(x.id)} ${sideRu(x.side)}, ${dirRu(x.dir)}: лишнее (специалист не отмечал)`));
}

/** Правда специалиста по случаю: его отметки калибровки плюс правки в карточке (правка важнее; «Норма» = мышца в порядке). */
function truthOf(c, a0) { const t = new Map(), dir = st => st === 'WEAK' ? -1 : st === 'OK' ? 0 : 1;
  for (const l of c.expert.labels || []) for (const sd of (l.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [l.side])) t.set((l.muscle || l.id) + ':' + sd, dir(l.state || l.k));
  for (const e of a0.specialistEdits || []) t.set(e.muscle + ':' + e.side, dir(e.state));
  return t; }
/** Исходы одного случая по связям «правило → мышца»: +1 специалист подтвердил вывод правила, −1 опроверг. */
function outcomes(c, a0, C) { let r; try { r = analyze({ ...a0, date: Date.parse(a0.date) || Date.now() }, C); } catch (e) { return new Map(); }
  const truth = truthOf(c, a0), hands = new Set((a0.specialistEdits || []).filter(e => e.hands !== false).map(e => e.muscle + ':' + e.side)), seen = new Map();
  for (const fd of r.findings) { if (fd.borderline) continue;
    for (const m of fd.muscles) { const k = fd.rule.id + '|' + m.id, want = m.state === 'WEAK' ? -1 : 1;
      for (const sd of (m.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [m.side])) { const key = m.id + ':' + sd, tv = truth.get(key); if (tv === undefined) continue;
        // в фоновых случаях учитываем только проверенное руками, а не просто мнение
        if (c.auto && !hands.has(key)) continue;
        const v = tv === want ? 1 : -1; seen.set(k, Math.max(seen.get(k) ?? -1, v)); } } }
  return seen; }
/** Выучить веса «правило → мышца» по калибровкам с учетом источника.
 *  Свои случаи администратора (own) весят 1. Сторонний специалист весит столько, насколько его проверки совпадают с проверками администратора
 *  по тем же связям (сглажено: (совпало + 1) / (сравнено + 2)); если пересечений нет — с большинством других специалистов; иначе 0,5.
 *  Связь меняется, когда взвешенных мнений не меньше minN, а если мнения только сторонние — от двух разных специалистов.
 *  Новый вес = старый × √((за + 2) / (против + 2)), от 0,1 до 1,5. */
export function learnWeights(docs, C, minN = 2) {
  const per = [];
  for (const d of docs) { const c = d.case || d; const a0 = (c.assessments || []).at(-1); if (!a0) continue;
    const src = d.own === false ? 's:' + ((d.from && d.from.id) || '?') : 'own'; per.push({ src, seen: outcomes(c, a0, C) }); }
  // голоса по источникам: источник → связь → сумма исходов
  const bySrc = new Map(); for (const { src, seen } of per) { const m = bySrc.get(src) || new Map(); for (const [k, v] of seen) m.set(k, (m.get(k) || 0) + v); bySrc.set(src, m); }
  const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0, own = bySrc.get('own') || new Map(), rel = new Map([['own', 1]]);
  for (const [src, m] of bySrc) { if (src === 'own') continue; let ok = 0, n = 0;
    for (const [k, v] of m) { if (!own.has(k) || !sign(own.get(k))) continue; n++; if (sign(own.get(k)) === sign(v)) ok++; }
    if (!n) for (const [k, v] of m) { let tot = 0; for (const [s2, m2] of bySrc) if (s2 !== src && s2 !== 'own' && m2.has(k)) tot += sign(m2.get(k)); if (!tot) continue; n++; if (sign(tot) === sign(v)) ok++; }
    rel.set(src, n ? (ok + 1) / (n + 2) : .5); }
  const st = new Map();
  for (const { src, seen } of per) { const w = rel.get(src) ?? .5;
    for (const [k, v] of seen) { const o = st.get(k) || { agree: 0, disagree: 0, srcs: new Set(), own: false }; if (v > 0) o.agree += w; else o.disagree += w; o.srcs.add(src); if (src === 'own') o.own = true; st.set(k, o); } }
  const out = [];
  for (const [k, o] of st) { const [rid, mid] = k.split('|'), rule = C.bodymap.rules.find(x => x.id === rid), m = rule && rule.muscles.find(x => x.id === mid); if (!m) continue;
    const w = m.w0 ?? m.w ?? 1, n = o.agree + o.disagree; if (n < minN - 1e-9 || (!o.own && o.srcs.size < 2)) continue;
    const nw = Math.round(Math.max(.1, Math.min(1.5, w * Math.sqrt((o.agree + 2) / (o.disagree + 2)))) * 100) / 100;
    if (Math.abs(nw - w) >= .02) out.push({ key: k, rule: rid, muscle: mid, name: (C.muscles[mid] || { name: mid }).name, w, nw, agree: Math.round(o.agree * 10) / 10, disagree: Math.round(o.disagree * 10) / 10, sources: o.srcs.size }); }
  out.reliability = Object.fromEntries([...rel].filter(([k]) => k !== 'own').map(([k, v]) => [k.slice(2), Math.round(v * 100)]));
  return out.sort((x, y) => Math.abs(y.nw - y.w) - Math.abs(x.nw - x.w));
}
