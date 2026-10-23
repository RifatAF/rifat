// Лендинг для специалистов (ТЗ v4, п. 8): первый экран для невошедших. Один путь: «Попробовать бесплатно 30 дней».
// Тексты в границах обещаний (docs/legal_texts/blacklist.md): замер и наблюдение, без диагнозов и обещаний точности.
import { go, ic } from './app.js';
import { track } from './track.js';

const CSS = `
body.lp-on{background:#070D1F}body.lp-on #app{max-width:none}
.lp{background:#070D1F;color:#EEF1FA;min-height:100dvh;font-family:var(--font);overflow-x:hidden}
.lp a{color:inherit}
.lp-w{max-width:1080px;margin:0 auto;padding:0 20px}
.lp-top{display:flex;align-items:center;gap:10px;padding:16px 0}
.lp-top b{font-size:18px;font-weight:800;letter-spacing:-.02em}
.lp-in{margin-left:auto;background:none;border:1.5px solid rgba(255,255,255,.3);color:#fff;border-radius:999px;height:40px;padding:0 16px;font:600 14px var(--font);cursor:pointer}
.lp-hero{display:grid;gap:28px;padding:18px 0 40px;align-items:center}
.lp-k{display:inline-block;font:700 12px var(--font);letter-spacing:.08em;text-transform:uppercase;color:#A9A3FF;background:rgba(108,99,255,.14);border:1px solid rgba(108,99,255,.35);border-radius:999px;padding:6px 12px}
.lp h1{font-size:clamp(32px,8.6vw,58px);line-height:1.04;letter-spacing:-.035em;font-weight:800;margin:16px 0 0}
.lp h1 em{font-style:normal;background:linear-gradient(90deg,#8F88FF,#FF8A5B);-webkit-background-clip:text;background-clip:text;color:transparent}
.lp-sub{font-size:18px;line-height:1.5;color:#B7BED3;margin:16px 0 0;max-width:34em}
.lp-cta{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:420px;height:58px;border:0;border-radius:18px;background:#6C63FF;color:#fff;font:700 18px var(--font);cursor:pointer;margin-top:24px;box-shadow:0 10px 40px rgba(108,99,255,.45);transition:transform .15s}
.lp-cta:active{transform:scale(.98)}
.lp-note{font-size:14px;color:#8C94AD;margin-top:10px}
.lp-phone{position:relative;justify-self:center;width:min(300px,78vw);aspect-ratio:9/19;border-radius:44px;padding:10px;background:linear-gradient(160deg,#2A3150,#0E1428);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08) inset}
.lp-phone video,.lp-phone img{width:100%;height:100%;object-fit:cover;border-radius:34px;display:block;background:#0B1B3B}
.lp-glow{position:absolute;inset:-12%;z-index:-1;background:radial-gradient(closest-side,rgba(108,99,255,.45),transparent);filter:blur(20px)}
.lp-cap{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);white-space:nowrap;background:#fff;color:#0B1B3B;font:700 13px var(--font);border-radius:999px;padding:8px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.lp-sec{padding:48px 0}
.lp h2{font-size:clamp(26px,6vw,40px);line-height:1.1;letter-spacing:-.03em;font-weight:800;margin:0}
.lp-steps{display:grid;gap:14px;margin-top:24px}
.lp-step{background:#0F1730;border:1px solid rgba(255,255,255,.07);border-radius:24px;padding:20px;display:flex;gap:16px;align-items:flex-start}
.lp-step .lp-n{flex:none;width:40px;height:40px;border-radius:12px;background:rgba(108,99,255,.18);color:#A9A3FF;display:grid;place-items:center;font:800 18px var(--font)}
.lp-step b{font-size:18px;display:block}
.lp-step span{font-size:15px;line-height:1.5;color:#A9B1C8;display:block;margin-top:4px}
.lp-legal{border-radius:20px;padding:18px 20px;background:rgba(255,138,91,.08);border:1px solid rgba(255,138,91,.3);font-size:16px;line-height:1.5}
.lp-grid{display:grid;gap:14px;margin-top:20px}
.lp-card{background:#0F1730;border:1px solid rgba(255,255,255,.07);border-radius:24px;padding:20px;font-size:15px;line-height:1.5;color:#B7BED3}
.lp-card b{display:block;color:#fff;font-size:17px;margin-bottom:6px}
.lp-auth{display:flex;gap:14px;align-items:center;margin-top:20px}
.lp-auth img{width:56px;height:56px;border-radius:50%;object-fit:cover}
.lp-foot{padding:28px 0 calc(40px + env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px;color:#8C94AD}
.lp-foot button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0;text-decoration:underline}
.lp-sticky{position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(transparent,#070D1F 40%);display:flex;justify-content:center;z-index:5;transition:opacity .2s}
.lp-sticky .lp-cta{margin:0}
@media(min-width:880px){.lp-hero{grid-template-columns:1.2fr .8fr;gap:56px;padding:40px 0 60px}.lp-steps{grid-template-columns:repeat(3,1fr)}.lp-grid{grid-template-columns:1fr 1fr}.lp-sticky{display:none}}
@media(prefers-reduced-motion:reduce){.lp-cta{transition:none}}
`;

/** Лендинг. onTry: вход специалиста; onSelf: старый экран теста для себя; onLogin: вход для тех, у кого уже есть кабинет. */
export function landing({ onTry, onSelf, onLogin }) {
  track('page_view', { c: 'landing' }, false); document.body.classList.add('lp-on');
  // уход с лендинга (вход, тест для себя): обычный фон и ширина приложения
  const leave = f => () => { document.body.classList.remove('lp-on'); f(); };
  onTry = leave(onTry); onLogin = leave(onLogin); onSelf = leave(onSelf);
  const cta = (id) => `<button class="lp-cta" id="${id}">Попробовать бесплатно 30 дней ${ic('arrow-right', 's')}</button>`;
  go(`<div class="lp fade"><style>${CSS}</style><div class="lp-w">
    <header class="lp-top"><img src="icons/mark.svg" width="32" height="32" alt=""><b>BodyPassport</b><button class="lp-in" id="lpin">Войти</button></header>
    <section class="lp-hero">
      <div><span class="lp-k">Для тренеров, реабилитологов, массажистов</span>
        <h1>Покажите клиенту его <em>прогресс</em>, а не просто рассказывайте о нём</h1>
        <p class="lp-sub">4 фото клиента, точки ставятся сами, отчёт с замером за 5 минут. Прямо в браузере телефона, без установки.</p>
        ${cta('lpgo')}<p class="lp-note">Без карты. Потом можно остаться на бесплатном тарифе.</p></div>
      <div class="lp-phone"><div class="lp-glow"></div>
        <video id="lpv" autoplay muted loop playsinline preload="metadata" poster="img/lp/demo-poster-v2.webp" aria-label="Как проходит быстрый тест: 4 фото, точки, отчет"><source src="img/lp/demo-v2.mp4" type="video/mp4"></video>
        <span class="lp-cap">Реальные экраны приложения</span></div>
    </section>
    <section class="lp-sec"><h2>Три шага, пять минут</h2>
      <div class="lp-steps">
        <div class="lp-step"><span class="lp-n">1</span><div><b>4 фото</b><span>Спереди, справа, сзади, слева. Контур, уровень телефона и подсказки по свету и расстоянию.</span></div></div>
        <div class="lp-step"><span class="lp-n">2</span><div><b>Правка точек</b><span>Точки встают сами. Неточную поправьте пальцем: лупа, сетка и отвес, значения пересчитываются сразу.</span></div></div>
        <div class="lp-step"><span class="lp-n">3</span><div><b>Отчёт клиенту</b><span>Замер с погрешностью, ваш вывод и рекомендации. PDF в мессенджер, повторный замер покажет «было → стало».</span></div></div>
      </div></section>
    <section class="lp-sec" style="padding-top:0"><div class="lp-legal"><b>Не диагноз и не медицинское заключение.</b> Приложение измеряет углы и смещения по фото, решения принимает специалист.</div>
      <div class="lp-grid">
        <div class="lp-card"><b>Данные клиентов у вас</b>Фото, точки и выводы «Быстрого теста» хранятся на вашем телефоне и на сервер не отправляются. Копию можно сохранить файлом с паролем.</div>
        <div class="lp-card"><b>Клиент видит то, что подтвердили вы</b>В отчёт попадают замер с пометкой «ЗАМЕР» и ваш вывод с пометкой «гипотеза специалиста».</div>
      </div>
      <div class="lp-auth"><img src="img/rifat.jpg" alt="Рифат Аюпов"><div style="font-size:15px;line-height:1.4"><b style="display:block">Рифат Аюпов</b><span style="color:#8C94AD">кинезиотерапевт, автор методики. Отвечаю специалистам сам</span></div></div>
    </section>
    <section class="lp-sec" style="text-align:center"><h2>Попробуйте на следующем клиенте</h2>${cta('lpgo2').replace('lp-cta"', 'lp-cta" style="margin:24px auto 0"')}</section>
    <footer class="lp-foot"><a href="/pricing">Тарифы</a><a href="/privacy">Конфиденциальность</a><button id="lpself">Пройти тест для себя</button><span style="margin-left:auto">© BodyPassport</span></footer>
  </div><div class="lp-sticky" id="lpst">${cta('lpgo3')}</div></div>`);
  const go2 = id => () => { track('pro_click', { c: 'landing_' + id }, false); onTry(); };
  for (const id of ['lpgo', 'lpgo2', 'lpgo3']) document.getElementById(id).onclick = go2(id);
  document.getElementById('lpin').onclick = onLogin; document.getElementById('lpself').onclick = onSelf;
  // нижняя кнопка не дублирует первую, пока та на экране
  const st = document.getElementById('lpst'), first = document.getElementById('lpgo');
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { st.style.opacity = e.isIntersecting ? '0' : '1'; st.style.pointerEvents = e.isIntersecting ? 'none' : 'auto'; }).observe(first);
}
