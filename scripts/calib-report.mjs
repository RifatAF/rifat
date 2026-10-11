// Сводка калибровки из файлов: node scripts/calib-report.mjs файл1.json [файл2.json ...]
// Принимает файл «Сохранить файл себе», «Скачать все одним файлом» и отдельные случаи с сервера.
import fs from 'node:fs';
import { calibReport, caseLines, RES_NAMES } from '../js/calibreport.js';
const j = n => JSON.parse(fs.readFileSync(new URL('../data/' + n + '.json', import.meta.url)));
const C = { muscles: j('muscles').muscles, bodymap: j('bodymap'), chains: j('chains').chains, exercises: Object.fromEntries(j('exercises').exercises.map(e => [e.id, e])) };
const docs = process.argv.slice(2).flatMap(f => { const d = JSON.parse(fs.readFileSync(f)); return d.cases || (d.case ? [d] : []); });
const rep = calibReport(docs, C), t = rep.totals;
console.log(`Случаев: ${rep.n}. Отметок специалиста: ${t.expert}, гипотез приложения: ${t.app}.`);
console.log(`Совпало ${t.match || 0}, другая сторона ${t.side || 0}, наоборот ${t.opposite || 0}, не увидело ${t.missed || 0}, тест не измеряет ${t.notMeasured || 0}, лишнее ${t.extra || 0}.`);
console.log(`Находит из того, что тест может увидеть: ${t.recall ?? '—'}%. Точность гипотез: ${t.precision ?? '—'}%.\n`);
console.log('| Мышца | ' + ['match', 'side', 'opposite', 'missed', 'notMeasured', 'extra'].map(k => RES_NAMES[k]).join(' | ') + ' |');
console.log('|---|---|---|---|---|---|---|');
for (const m of rep.muscles) console.log(`| ${m.name} | ${m.match} | ${m.side} | ${m.opposite} | ${m.missed} | ${m.notMeasured} | ${m.extra} |`);
for (const c of rep.cases) { console.log(`\n### ${c.label}${c.from ? ' · ' + c.from : ''} · ${String(c.date).slice(0, 10)}`);
  for (const l of caseLines(c, C)) console.log('- ' + l);
  if (c.note) console.log('- Заметка специалиста (не сравнивается автоматически): ' + c.note);
  console.log('- Находки приложения: ' + c.findings.join('; ')); }
