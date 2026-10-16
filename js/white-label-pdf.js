// White-Label PDF v2.0 для режима SPECIALIST_OPERATED: клиническая классификация мышц и сырая векторная сетка
// (абсолютные углы θ относительно вектора гравитации g и смещения в мм). Логотип клиники и отчет без плашки BodyPassport
// собирает pro.js (passportImage → pdf.canvasToPdf); здесь только клинические разделы отчета.
import { STATES, ghostDiff } from './biomechanics-engine.js';

const sideRu = s => s === 'RIGHT' ? 'справа' : s === 'LEFT' ? 'слева' : 'с обеих сторон';
const deg = v => Number.isFinite(v) ? (Math.round(v * 10) / 10).toString().replace('.', ',') + '°' : '—';

/** Раздел «Клиническая классификация»: мышца, сторона, термин и противопоказание. */
export function clinicalSection(spots, muscles) {
  const rows = spots.filter(s => STATES[s.k]).slice(0, 10).map(s => ({ k: s.k, small: true,
    text: `${(muscles[s.id] || { name: s.id }).name} ${sideRu(s.side)}: ${STATES[s.k].clin}${s.k === 'HYPER' ? '. МФР и растяжка противопоказаны' : s.k === 'WEAK' ? '. Без плиометрики' : ''}` }));
  return rows.length ? { h: 'Клиническая классификация', rows } : null;
}
/** Раздел «Векторная сетка»: углы линий плеч, таза, головы и корпуса относительно g; смещения точек в мм по шкале автокалибровки. */
export function vectorSection(snapshot, setup, pose) {
  if (!snapshot) return null; const rows = [
    { text: `θ плеч ${deg(snapshot.shoulderTilt)} · θ таза ${deg(snapshot.pelvicTilt)} · θ головы ${deg(snapshot.headTilt)} · отклонение корпуса от g ${deg(snapshot.trunkLateral)}` }];
  const s = setup && setup.scale; if (s && pose) { const g = ghostDiff(pose, s.cmPerPx); if (g) rows.push({ text: 'Смещение от симметричной нормы, мм: ' + g.points.filter(x => x.mm > 0).map(x => `${PT[x.i] || x.i} ${x.mm}`).join(' · ') + (s.est ? ' (шкала по среднему росту)' : '') }); }
  if (setup && setup.retroGait) rows.push({ text: `Retro-Gait: асимметрия шага назад ${setup.retroGait.asym}%` });
  return { h: 'Векторная сетка (относительно g)', rows };
}
const PT = { 0: 'голова', 11: 'плечо Л', 12: 'плечо П', 23: 'таз Л', 24: 'таз П', 25: 'колено Л', 26: 'колено П', 27: 'стопа Л', 28: 'стопа П' };
