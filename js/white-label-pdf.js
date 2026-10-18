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

/** Лист клиенту после сеанса (одна страница A4): что видно сейчас, что делаем, когда повторный тест. Только наблюдаемое, без диагнозов. */
export function sessionSheet({ date, seen = [], todo = [], retest }) {
  const W = 1240, H = 1754, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const day = d => d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
  g.fillStyle = '#F5F6FA'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(70, 70, W - 140, H - 140, 36); g.fill();
  let y = 170; const text = (t, size, color = '#14161A', weight = 400, x = 130, max = W - 260) => { g.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`; g.fillStyle = color;
    const words = String(t).split(' '); let line = ''; for (const w of words) { const s = line ? line + ' ' + w : w; if (g.measureText(s).width > max && line) { g.fillText(line, x, y); y += size * 1.35; line = w; } else line = s; }
    if (line) { g.fillText(line, x, y); y += size * 1.35; } };
  text('ЛИСТ ПОСЛЕ ЗАНЯТИЯ', 26, '#6B7280', 600); y += 10; text(day(date), 52, '#14161A', 700); y += 40;
  const block = (h, items, empty) => { text(h, 36, '#14161A', 700); y += 6; (items.length ? items : [empty]).forEach((t, i) => { const y0 = y; text(items.length ? `${i + 1}.` : '', 30, '#6B7280', 600, 130, 40); y = y0; text(t, 30, '#14161A', 400, 180, W - 310); y += 8; }); y += 36; };
  block('Что видно сейчас', seen, 'Заметных отклонений в проверенных движениях нет');
  block('Что делаем', todo, 'Продолжаем по плану специалиста');
  text('Повторный тест', 36, '#14161A', 700); y += 6; text(retest ? day(retest) : 'через неделю', 30); y += 40;
  text('Это наблюдение за движением по камере телефона, а не диагноз. Результат одного занятия может колебаться, надежнее сравнивать через неделю.', 24, '#6B7280');
  return cv;
}
