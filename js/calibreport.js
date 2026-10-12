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
    const cmp = calibCompare(c.expert.labels || [], r.tones, C.bodymap.rules);
    for (const x of cmp.rows) m(x.id)[x.res]++;
    for (const x of cmp.extra) m(x.id).extra++;
    for (const [k, v] of Object.entries(cmp.counts)) tot[k] = (tot[k] || 0) + v;
    cases.push({ label: c.caseId || c.name || '?', from: d.from ? d.from.name : '', date: a0.date, note: c.expert.note || '', clientNote: a0.clientNote || '', pain: a0.pain || {},
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
/** Выучить веса «правило → мышца»: сколько раз вывод правила подтвердил специалист и сколько опроверг.
 *  Новый вес = старый × √((за + 2) / (против + 2)): осторожно, со сглаживанием; не меньше 0,1 и не больше 1,5; нужно минимум 2 мнения.
 *  Каждый случай учитывается один раз на пару, даже если правило задело обе стороны. */
export function learnWeights(docs, C, minN = 2) {
  const st = new Map();
  for (const d of docs) { const c = d.case || d; const a0 = (c.assessments || []).at(-1); if (!a0) continue;
    let r; try { r = analyze({ ...a0, date: Date.parse(a0.date) || Date.now() }, C); } catch (e) { continue; }
    const truth = truthOf(c, a0), seen = new Map();
    for (const fd of r.findings) { if (fd.borderline) continue;
      for (const m of fd.muscles) { const k = fd.rule.id + '|' + m.id, want = m.state === 'WEAK' ? -1 : 1;
        for (const sd of (m.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [m.side])) { const tv = truth.get(m.id + ':' + sd); if (tv === undefined) continue;
          const v = tv === want ? 1 : -1; seen.set(k, Math.max(seen.get(k) ?? -1, v)); } } }
    for (const [k, v] of seen) { const o = st.get(k) || { agree: 0, disagree: 0 }; if (v > 0) o.agree++; else o.disagree++; st.set(k, o); } }
  const out = [];
  for (const [k, o] of st) { const [rid, mid] = k.split('|'), rule = C.bodymap.rules.find(x => x.id === rid), m = rule && rule.muscles.find(x => x.id === mid); if (!m) continue;
    const w = m.w0 ?? m.w ?? 1, n = o.agree + o.disagree; if (n < minN) continue;
    const nw = Math.round(Math.max(.1, Math.min(1.5, w * Math.sqrt((o.agree + 2) / (o.disagree + 2)))) * 100) / 100;
    if (Math.abs(nw - w) >= .02) out.push({ key: k, rule: rid, muscle: mid, name: (C.muscles[mid] || { name: mid }).name, w, nw, ...o }); }
  return out.sort((x, y) => Math.abs(y.nw - y.w) - Math.abs(x.nw - x.w));
}
