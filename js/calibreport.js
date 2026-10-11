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
