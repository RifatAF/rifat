// Pacing Guard v2.0: трехфазный светофор (Инструкция → Сигнал → Запись), защита от фальстарта,
// крупный цвет на весь экран при позиционировании и Zero-Click старт при совпадении скелета с контуром на 92%.

export const PHASE = { INSTR: 'instr', SIGNAL: 'signal', REC: 'rec', POS: 'pos' };
/** Краткие голосовые команды из двух слов для дальнего экрана (человек в 2,5 м от телефона). */
export const SHORT_CMD = { farther: 'Шаг назад', closer: 'Шаг вперёд', goLeft: 'Шаг влево', goRight: 'Шаг вправо', noFeet: 'Шаг назад', noHead: 'Шаг назад', ok: 'Замрите', wait: 'Подождите сигнала' };
export const ZERO_CLICK = .92;
/** Глаголы сигнала по типу движения. */
export const GO_WORD = { squat: 'ПРИСЕДАЙТЕ', bend: 'НАКЛОН', balance: 'НОГУ ВВЕРХ', rotate: 'ПОВОРОТ', reach: 'РУКИ ВВЕРХ', chair: 'ВСТАВАЙТЕ', hold: 'ЗАМРИТЕ' };
export const COUNT_WORDS = ['Раз', 'Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять', 'Одиннадцать', 'Двенадцать', 'Тринадцать', 'Четырнадцать', 'Пятнадцать', 'Шестнадцать', 'Семнадцать', 'Восемнадцать', 'Девятнадцать', 'Двадцать', 'Двадцать один', 'Двадцать два', 'Двадцать три', 'Двадцать четыре', 'Двадцать пять', 'Двадцать шесть', 'Двадцать семь', 'Двадцать восемь', 'Двадцать девять', 'Тридцать'];
/** Число словом (записано тем же голосом); больше 30 — молча. */
export const numWord = n => COUNT_WORDS[n - 1] || '';

/** Совпадение скелета с контурной рамкой 0..1: видимость ключевых точек, центр по горизонтали, рост в кадре 55–88%. */
export function matchScore(p, w, h) {
  if (!p) return 0; const key = [0, 11, 12, 23, 24, 25, 26, 27, 28];
  const vis = key.reduce((a, i) => a + Math.min(1, (p[i].visibility ?? 1) / .6), 0) / key.length;
  const cx = (p[23].x + p[24].x) / 2 / w, center = Math.max(0, 1 - Math.max(0, Math.abs(cx - .5) - .08) * 4);
  const hf = (Math.max(p[27].y, p[28].y) - p[0].y) / h, size = hf < .55 ? Math.max(0, 1 - (.55 - hf) * 4) : hf > .88 ? Math.max(0, 1 - (hf - .88) * 6) : 1;
  return Math.round(vis * center * size * 100) / 100;
}

/** Слой светофора поверх камеры. */
export function mountPacing(root) {
  let el = root.querySelector('.pg'); if (!el) { el = document.createElement('div'); el.className = 'pg'; el.innerHTML = '<b></b>'; root.appendChild(el); }
  const api = {
    phase: PHASE.INSTR,
    /** Позиционирование: красная маска — не в кадре, зеленая — позиция идеальна. */
    pos(good) { api.phase = PHASE.POS; el.className = 'pg pos ' + (good ? 'green' : 'red'); el.firstChild.textContent = ''; },
    /** Инструкция: желтая рамка, движение запрещено. */
    instr() { api.phase = PHASE.INSTR; el.className = 'pg instr'; el.firstChild.textContent = ''; },
    /** Сигнал: зеленая заливка с глаголом на весь экран и «Пип». */
    async signal(word, beep) { api.phase = PHASE.SIGNAL; el.className = 'pg go'; el.firstChild.textContent = word; if (beep) beep();
      await new Promise(r => setTimeout(r, 900)); api.rec(); },
    /** Запись: тонкая зеленая рамка, на экране только счет. */
    rec() { api.phase = PHASE.REC; el.className = 'pg rec'; el.firstChild.textContent = ''; },
    off() { el.className = 'pg'; el.firstChild.textContent = ''; },
  };
  return api;
}

/** Детектор фальстарта: таз опустился больше чем на 6% длины ноги от исходной высоты, пока идет инструкция. */
export function falseStart() {
  let base = null, leg = null;
  return {
    reset() { base = null; leg = null; },
    feed(p) { if (!p) return false; const hy = (p[23].y + p[24].y) / 2, ay = (p[27].y + p[28].y) / 2;
      if (base == null) { base = hy; leg = Math.max(1, ay - hy); return false; } base = Math.min(base, hy * .05 + base * .95);
      return (hy - base) / leg > .06; },
  };
}
