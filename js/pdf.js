// PDF из картинки отчета без библиотек: высокий холст режется на страницы A4, каждая страница — JPEG (DCTDecode).
// Текст в PDF не выделяется, зато файл весит мало, открывается везде и выглядит ровно как отчет в приложении.
const A4W = 595.28, A4H = 841.89;
const enc = new TextEncoder();
const jpeg = cv => new Promise(r => cv.toBlob(b => b.arrayBuffer().then(x => r(new Uint8Array(x))), 'image/jpeg', .9));

/** canvas: отчет шириной W. Возвращает Blob application/pdf. */
export async function canvasToPdf(canvas, title = 'BodyPassport') {
  const W = canvas.width, A = Math.round(W * A4H / A4W), pages = [], cx = canvas.getContext('2d');
  // отчет чуть длиннее целого числа страниц (до 15%) ужимается, а не выносит подвал на отдельный лист: страница A4 берет больше высоты холста, по бокам поля
  const n0 = Math.ceil(canvas.height / A), pageH = n0 >= 2 && canvas.height <= (n0 - 1) * A * 1.15 ? Math.ceil(canvas.height / (n0 - 1) * 1.06) : A, PW = Math.round(W * pageH / A);
  // разрыв страницы по последней однотонной полосе в нижней трети страницы, чтобы не резать строку текста
  const cut = top => { const end = top + pageH; if (end >= canvas.height) return canvas.height;
    // сначала разметка отчета (canvas.breaks: начала блоков), не выше половины страницы
    const b = (canvas.breaks || []).filter(y => y > top + pageH * .5 && y <= end), bb = b.length ? Math.round(Math.max(...b)) : 0;
    // разрыв по разметке, если после него остаток помещается; иначе режем между строками, чтобы не плодить почти пустой лист
    const last = canvas.height - end <= pageH; if (bb && (!last || canvas.height - bb <= pageH)) return bb; const minRun = last ? 10 : 28;
    const from = end - Math.round(pageH / 3), d = cx.getImageData(0, from, W, end - from).data;
    // полоса не уже 28 px: такие бывают между блоками, а между строками одного пункта зазор меньше
    let run = 0;
    for (let r = end - from - 1; r >= 0; r--) { const o = r * W * 4; let same = true;
      for (let x = 4; x < W * 4; x += 16) if (Math.abs(d[o + x] - d[o]) + Math.abs(d[o + x + 1] - d[o + 1]) + Math.abs(d[o + x + 2] - d[o + 2]) > 6) { same = false; break; }
      run = same ? run + 1 : 0; if (run >= minRun) return from + r + (minRun >> 1); }
    return end; };
  for (let top = 0; top < canvas.height;) {
    const bottom = cut(top), h = bottom - top; if (h < 40 && pages.length) break; // крошечный хвост не тянет на страницу
    const pc = document.createElement('canvas'); pc.width = PW; pc.height = pageH; const g = pc.getContext('2d');
    g.fillStyle = '#F3F6F6'; g.fillRect(0, 0, PW, pageH); g.drawImage(canvas, 0, top, W, h, (PW - W) / 2, 0, W, h);
    pages.push({ data: await jpeg(pc), w: PW, h: pageH }); top = bottom;
  }
  const parts = [], offs = []; let len = 0;
  const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body, stream) => { offs[n] = len; add(`${n} 0 obj\n`); add(body); if (stream) { add('\nstream\n'); add(stream); add('\nendstream'); } add('\nendobj\n'); };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  pages.forEach((p, i) => { const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4W} ${A4H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    const cs = enc.encode(`q ${A4W} 0 0 ${A4H} 0 0 cm /Im0 Do Q`);
    obj(ct, `<< /Length ${cs.length} >>`, cs);
    obj(im, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>`, p.data); });
  const info = 3 + n * 3; obj(info, `<< /Title (${String(title).replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '') || 'BodyPassport'}) /Producer (BodyPassport) >>`);
  const xref = len; add(`xref\n0 ${info + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= info; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  add(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
