// Лендинг для специалистов (ТЗ v4, п. 8) в стиле Apple Matte: матовый графит, голубой акцент, числа моноширинным.
// Тексты в границах обещаний (docs/legal_texts/blacklist.md): замер и наблюдение с погрешностью, без диагнозов.
// Откат дизайна (bp_ds = v3) открывает прежний лендинг из landing-v1.js.
import { go, ic } from './app.js';
import { track } from './track.js';
import { matte } from './ds.js';
import { landing as landingV1 } from './landing-v1.js';

const CSS = `
body.lp-on{background:#161617}body.lp-on #app{max-width:none}
.mx{background:#161617;color:#F5F5F7;min-height:100dvh;font-family:Inter,-apple-system,'SF Pro Display',system-ui,sans-serif;letter-spacing:-.011em;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.mx a{color:inherit;text-decoration:none}
.mx .w{max-width:1120px;margin:0 auto;padding:0 20px}
.mx .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:0}
.mx-nav{position:sticky;top:0;z-index:6;background:rgba(22,22,23,.78);-webkit-backdrop-filter:saturate(1.6) blur(20px);backdrop-filter:saturate(1.6) blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.mx-nav .w{display:flex;align-items:center;gap:12px;height:60px}
.mx-nav b{font-size:17px;font-weight:600;letter-spacing:-.02em}
.mx-links{display:none;gap:28px;margin-left:36px;font-size:14px;color:#98989D}.mx-links a:hover{color:#fff}
.mx-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 18px;border-radius:9999px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;white-space:nowrap}
.mx-cta{background:#0EA5E9;border-color:#0EA5E9;color:#00131D}
.mx-big{height:56px;padding:0 26px;font-size:17px}
.mx-cta.mx-big{box-shadow:0 14px 40px rgba(14,165,233,.32)}
.mx-cta:active,.mx-pill:active{transform:scale(.98)}
.mx-hero{display:grid;gap:40px;padding:44px 0 56px;align-items:center}
.mx h1{font-size:clamp(40px,10vw,72px);line-height:1.02;letter-spacing:-.045em;font-weight:700;margin:0}
.mx h1 span{color:#98989D}
.mx-prec{display:inline-flex;align-items:center;gap:12px;margin-top:22px;padding:8px 16px 8px 8px;border-radius:9999px;background:#212124;border:1px solid rgba(255,255,255,.08);font-size:14px;color:#A1A1A6}
.mx-prec .mono{background:rgba(255,159,10,.14);color:#FF9F0A;border-radius:9999px;padding:6px 12px;font-size:15px;font-weight:600}.mx-prec i{font-style:normal;font-weight:400;opacity:.8}
body.lp-on #betabar{background:#161617;color:#98989D;border-bottom:1px solid rgba(255,255,255,.06)}body.lp-on #betabar button{background:transparent;color:#0EA5E9;border:1px solid rgba(14,165,233,.5)}
.mx-sub{font-size:19px;line-height:1.5;color:#A1A1A6;margin:20px 0 0;max-width:32em}
.mx-btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.mx-note{font-size:13px;color:#86868B;margin-top:12px}
.mx-trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:26px;font-size:13px;color:#A1A1A6}
.mx-trust span{display:inline-flex;align-items:center;gap:7px}.mx-trust i{width:6px;height:6px;border-radius:50%;background:#30D158;box-shadow:0 0 8px #30D158}
.mx-stage{position:relative;height:620px;display:flex;justify-content:center;align-items:center}
.mx-glow{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(closest-side,rgba(14,165,233,.22),transparent);filter:blur(10px)}
.mx-phone{position:relative;width:280px;aspect-ratio:9/19.3;border-radius:50px;padding:11px;background:linear-gradient(145deg,#3A3A3D,#1C1C1E 40%,#2A2A2D);box-shadow:0 40px 90px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.12),inset 0 0 0 2px #0b0b0c}
.mx-phone .scr{position:relative;width:100%;height:100%;border-radius:40px;overflow:hidden;background:#000}
.mx-phone video,.mx-phone img{width:100%;height:100%;object-fit:cover;display:block}
.mx-phone .isl{position:absolute;top:10px;left:50%;width:84px;height:24px;margin-left:-42px;border-radius:12px;background:#000;z-index:2}
.mx-p2{position:absolute;width:230px;right:calc(50% - 300px);top:70px;transform:rotate(7deg);opacity:.92;z-index:0}
.mx-p1{z-index:1;animation:mxf 7s ease-in-out infinite}
@keyframes mxf{50%{transform:translateY(-10px)}}
.mx-cap{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);z-index:3;white-space:nowrap;font-size:12px;color:#A1A1A6;background:rgba(33,33,36,.9);border:1px solid rgba(255,255,255,.08);border-radius:9999px;padding:7px 14px}
.mx-sec{padding:64px 0}
.mx h2{font-size:clamp(30px,6.4vw,48px);line-height:1.06;letter-spacing:-.035em;font-weight:700;margin:0}
.mx-lead{font-size:17px;color:#A1A1A6;line-height:1.5;margin-top:12px;max-width:36em}
.mx-grid{display:grid;gap:14px;margin-top:30px}
.mx-card{background:#212124;border:1px solid rgba(255,255,255,.08);border-radius:28px;padding:24px;position:relative;overflow:hidden}
.mx-card b{display:block;font-size:19px;font-weight:600;letter-spacing:-.02em}
.mx-card p{font-size:15px;line-height:1.5;color:#A1A1A6;margin:8px 0 0}
.mx-ico{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(14,165,233,.12);color:#0EA5E9;margin-bottom:16px}
.mx-ico svg{width:22px;height:22px}
.mx-metric{display:flex;align-items:baseline;gap:8px;margin-top:16px}.mx-metric .mono{font-size:28px;font-weight:600;color:#fff}.mx-metric small{color:#86868B;font-size:15px}
.mx-ba{display:grid;gap:14px;margin-top:30px}
.mx-ba .mx-card{padding:20px}
.mx-row{display:flex;align-items:center;gap:10px;padding:14px 0;border-top:1px solid rgba(255,255,255,.06);font-size:15px}
.mx-row:first-of-type{border-top:0}
.mx-row .mono{font-size:15px}
.mx-tag{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:9999px;font-size:12.5px;font-weight:600}
.mx-tag.g{background:rgba(48,209,88,.15);color:#30D158}.mx-tag.n{background:rgba(255,255,255,.08);color:#98989D}.mx-tag.c{background:rgba(14,165,233,.15);color:#0EA5E9}
.mx-steps{display:grid;gap:14px;margin-top:30px;counter-reset:s}
.mx-step{display:flex;gap:16px;align-items:flex-start}
.mx-step .n{flex:none;width:40px;height:40px;border-radius:9999px;border:1px solid rgba(14,165,233,.5);color:#0EA5E9;display:grid;place-items:center;font:600 15px 'JetBrains Mono',monospace}
.mx-legal{border-radius:24px;padding:18px 22px;background:rgba(255,159,10,.07);border:1px solid rgba(255,159,10,.28);font-size:15px;line-height:1.5;color:#E5E5EA}
.mx-auth{display:flex;gap:14px;align-items:center;margin-top:24px}.mx-auth img{width:56px;height:56px;border-radius:50%;object-fit:cover;filter:grayscale(.2)}
.mx-final{text-align:center;padding:80px 0 72px}
.mx-foot{padding:28px 0 calc(40px + env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;color:#86868B;border-top:1px solid rgba(255,255,255,.06)}
.mx-foot button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}
.mx-sticky{position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(rgba(22,22,23,0),#161617 45%);display:flex;justify-content:center;z-index:7;transition:opacity .2s}
.mx-sticky .mx-cta{width:100%;max-width:420px}
.mx-in{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .7s cubic-bezier(.2,.8,.2,1)}.mx-in.on{opacity:1;transform:none}
@media(min-width:760px){.mx-grid{grid-template-columns:1fr 1fr}.mx-ba{grid-template-columns:1.1fr .9fr}.mx-steps{grid-template-columns:repeat(3,1fr)}}
@media(min-width:960px){.mx-links{display:flex}.mx-hero{grid-template-columns:1.05fr .95fr;padding:72px 0 80px}.mx-sticky{display:none}.mx-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:959px){.mx-p2{display:none}.mx-stage{height:auto;padding:10px 0 30px}}
@media(prefers-reduced-motion:reduce){.mx-p1{animation:none}.mx-in{opacity:1;transform:none;transition:none}}
`;
const I = {
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><circle cx="12" cy="7.5" r="1.6"/><path d="M12 9.5v5M9 11.5h6M12 14.5l-2 4M12 14.5l2 4"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/></svg>',
  cmp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 18l5-5 4 3 7-8"/><path d="M15 8h5v5"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/></svg>',
};

/** Лендинг. onTry: вход специалиста; onSelf: старый экран теста для себя; onLogin: вход для тех, у кого уже есть кабинет. */
export function landing(o) {
  if (!matte()) return landingV1(o);
  let { onTry, onSelf, onLogin } = o;
  track('page_view', { c: 'landing' }, false); document.body.classList.add('lp-on');
  // уход с лендинга (вход, тест для себя): обычный фон и ширина приложения
  const leave = f => () => { document.body.classList.remove('lp-on'); f(); };
  onTry = leave(onTry); onLogin = leave(onLogin); onSelf = leave(onSelf);
  const cta = (id, big = true) => `<button class="mx-pill mx-cta${big ? ' mx-big' : ''}" id="${id}">Попробовать бесплатно 30 дней ${ic('arrow-right', 's')}</button>`;
  go(`<div class="mx fade"><style>${CSS}</style>
    <nav class="mx-nav"><div class="w"><img src="icons/mark.svg" width="28" height="28" alt=""><b>BodyPassport</b>
      <div class="mx-links"><a href="#mxf">Возможности</a><a href="#mxba">Было → стало</a><a href="#mxs">Как это работает</a><a href="/pricing">Цены</a></div>
      <span style="flex:1"></span><button class="mx-pill" id="lpin">Войти</button></div></nav>
    <div class="w">
    <section class="mx-hero">
      <div class="mx-in">
        <h1>BodyPassport.<br><span>Замер осанки по фото.</span></h1>
        <div class="mx-prec"><span class="mono">1,9° <i>± 1,5°</i></span><span>у каждого числа своя погрешность</span></div>
        <p class="mx-sub">Для тренеров, реабилитологов и массажистов. 4 фото клиента, точки ставятся сами, отчёт с замером и 3D-фигурой за 5 минут. Прямо в браузере телефона.</p>
        <div class="mx-btns">${cta('lpgo')}<a class="mx-pill mx-big" href="#mxs">Как это работает</a></div>
        <p class="mx-note">Без карты. Потом можно остаться на бесплатном тарифе.</p>
        <div class="mx-trust"><span><i></i>Фото остаются на телефоне специалиста</span><span><i></i>Значение <span class="mono">± погрешность</span></span><span><i></i>Вывод помечен «гипотеза»</span></div>
      </div>
      <div class="mx-stage mx-in"><div class="mx-glow"></div>
        <div class="mx-phone mx-p2" aria-hidden="true"><div class="scr"><img src="img/lp/screen-passport.webp" alt="" loading="lazy"></div></div>
        <div class="mx-phone mx-p1"><div class="scr"><span class="isl"></span><video id="lpv" autoplay muted loop playsinline preload="metadata" poster="img/lp/demo-poster-v4.webp" aria-label="Как проходит быстрый тест: 4 фото, точки, 3D-фигура, отчет"><source src="img/lp/demo-v4.mp4" type="video/mp4"></video></div></div>
        <span class="mx-cap">Реальные экраны приложения</span></div>
    </section>
    <section class="mx-sec" id="mxf"><div class="mx-in"><h2>Инструмент, а не догадка.</h2><p class="mx-lead">Каждое число измерено по фото и показано с погрешностью. Что считать проблемой, решаете вы.</p></div>
      <div class="mx-grid">
        <div class="mx-card mx-in"><div class="mx-ico">${I.photo}</div><b>Замер по фото</b><p>8 показателей: голова, плечи, таз, корпус, колени. Точки ставятся сами, неточную поправите пальцем с лупой.</p><div class="mx-metric"><span class="mono">1,9°</span><small class="mono">± 1,5°</small></div></div>
        <div class="mx-card mx-in"><div class="mx-ico">${I.cube}</div><b>3D-фигура в позе клиента</b><p>Анатомическая модель повторяет наклоны и смещения. Можно покрутить и усилить, чтобы клиент увидел разницу.</p></div>
        <div class="mx-card mx-in"><div class="mx-ico">${I.cmp}</div><b>Было → стало</b><p>Повторный тест рядом с первым: что изменилось больше погрешности, а что нет.</p></div>
        <div class="mx-card mx-in"><div class="mx-ico">${I.pdf}</div><b>Отчёт клиенту</b><p>PDF в мессенджер: фото с линиями, 3D-фигура, замер и ваши рекомендации.</p></div>
      </div></section>
    <section class="mx-sec" id="mxba" style="padding-top:20px"><div class="mx-in"><h2>Прогресс, который видно.</h2><p class="mx-lead">Клиент возвращается, когда видит изменения. Повторный замер показывает их в цифрах.</p></div>
      <div class="mx-ba">
        <div class="mx-card mx-in" style="padding:0;overflow:hidden"><img src="img/lp/screen-compare.webp" alt="Экран «Было → стало» в приложении" loading="lazy" style="width:100%;display:block"></div>
        <div class="mx-card mx-in"><div class="row" style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">Изменения</b><span class="mx-tag c">пример</span></div>
          <div class="mx-row"><span style="flex:1">Голова относительно плеча</span><span class="mono">18,2° → 11,4°</span><span class="mx-tag g">меньше</span></div>
          <div class="mx-row"><span style="flex:1">Линия таза</span><span class="mono">2,6° → 0,9°</span><span class="mx-tag g">меньше</span></div>
          <div class="mx-row"><span style="flex:1">Линия плеч</span><span class="mono">1,1° → 0,8°</span><span class="mx-tag n">без изменений</span></div>
          <p style="font-size:13px;color:#86868B;margin:12px 0 0">«Без изменений»: разница в пределах погрешности. Значения в карточке для примера.</p></div>
      </div></section>
    <section class="mx-sec" id="mxs" style="padding-top:20px"><div class="mx-in"><h2>Три шага, пять минут.</h2></div>
      <div class="mx-steps">
        <div class="mx-card mx-step mx-in"><span class="n">1</span><div><b>4 фото</b><p>Спереди, справа, сзади, слева. Контур, инклинометр и подсказки по свету.</p></div></div>
        <div class="mx-card mx-step mx-in"><span class="n">2</span><div><b>Проверка точек</b><p>Точки встают сами. Сетка, отвес и лупа, значения пересчитываются сразу.</p></div></div>
        <div class="mx-card mx-step mx-in"><span class="n">3</span><div><b>Отчёт клиенту</b><p>Замер, 3D-фигура, ваш вывод и рекомендации. PDF в мессенджер.</p></div></div>
      </div></section>
    <section class="mx-sec" style="padding-top:20px"><div class="mx-legal mx-in"><b>Не диагноз и не медицинское заключение.</b> Приложение измеряет углы и смещения по фото, решения принимает специалист.</div>
      <div class="mx-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <div class="mx-card mx-in"><b>Данные клиентов у вас</b><p>Фото, точки и выводы «Быстрого теста» хранятся на вашем телефоне и на сервер не отправляются. Копию можно сохранить файлом с паролем.</p></div>
        <div class="mx-card mx-in"><b>Клиент видит то, что подтвердили вы</b><p>В отчёт попадают замер с пометкой «ЗАМЕР» и ваш вывод с пометкой «гипотеза специалиста».</p></div>
      </div>
      <div class="mx-auth mx-in"><img src="img/rifat.jpg" alt="Рифат Аюпов"><div style="font-size:15px;line-height:1.45"><b style="display:block">Рифат Аюпов</b><span style="color:#86868B">кинезиотерапевт, автор методики. Отвечаю специалистам сам</span></div></div></section>
    <section class="mx-final mx-in"><h2>Попробуйте на следующем клиенте.</h2><div style="display:flex;justify-content:center;margin-top:28px">${cta('lpgo2')}</div></section>
    <footer class="mx-foot"><a href="/pricing">Тарифы</a><a href="/privacy">Конфиденциальность</a><button id="lpself">Пройти тест для себя</button><span style="margin-left:auto">© BodyPassport</span></footer>
  </div><div class="mx-sticky" id="lpst">${cta('lpgo3')}</div></div>`);
  const go2 = id => () => { track('pro_click', { c: 'landing_' + id }, false); onTry(); };
  for (const id of ['lpgo', 'lpgo2', 'lpgo3']) document.getElementById(id).onclick = go2(id);
  document.getElementById('lpin').onclick = onLogin; document.getElementById('lpself').onclick = onSelf;
  // ссылки на разделы прокручивают страницу, а не меняют адрес приложения
  document.querySelectorAll('.mx a[href^="#"]').forEach(a => a.onclick = e => { e.preventDefault(); const t = document.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
  // нижняя кнопка не дублирует другие: прячется, пока на экране верхняя или финальная кнопка
  const st = document.getElementById('lpst'), seen = new Set();
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); const hide = seen.size > 0; st.style.opacity = hide ? '0' : '1'; st.style.pointerEvents = hide ? 'none' : 'auto'; });
    ['lpgo', 'lpgo2'].forEach(id => io.observe(document.getElementById(id)));
    // появление блоков при прокрутке
    const ap = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); ap.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.mx-in').forEach(el => ap.observe(el)); }
  else document.querySelectorAll('.mx-in').forEach(el => el.classList.add('on'));
}
