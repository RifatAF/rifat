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
.mx-nav img{filter:grayscale(1) brightness(1.7)}.mx-nav b{font-size:17px;font-weight:600;letter-spacing:-.02em}
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
.mx-prec .mono{white-space:nowrap;background:rgba(255,159,10,.14);color:#FF9F0A;border-radius:9999px;padding:6px 12px;font-size:15px;font-weight:600}.mx-prec i{font-style:normal;font-weight:400;opacity:.8}
body.lp-on #betabar{background:#161617;color:#98989D;border-bottom:1px solid rgba(255,255,255,.06)}body.lp-on #betabar button{background:transparent;color:#0EA5E9;border:1px solid rgba(14,165,233,.5)}
.mx-sub{font-size:19px;line-height:1.5;color:#A1A1A6;margin:20px 0 0;max-width:32em}
.mx-btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.mx-note{font-size:13px;color:#86868B;margin-top:12px}
.mx-trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:26px;font-size:13px;color:#A1A1A6}
.mx-trust span{display:inline-flex;align-items:center;gap:7px}.mx-trust i{width:6px;height:6px;border-radius:50%;background:#30D158;box-shadow:0 0 8px #30D158}
.mx-stage{position:relative;height:620px;display:flex;justify-content:center;align-items:center}
.mx-glow{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(closest-side,rgba(14,165,233,.22),transparent);filter:blur(10px)}
.mx-phone{position:relative;width:280px;height:600px;flex:none;border-radius:50px;padding:11px;background:linear-gradient(145deg,#3A3A3D,#1C1C1E 40%,#2A2A2D);box-shadow:0 40px 90px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.12),inset 0 0 0 2px #0b0b0c}
.mx-phone .mx-scr{position:relative;width:100%;height:100%;border-radius:40px;overflow:hidden;background:#000}
.mx-phone video,.mx-phone img{width:100%;height:100%;object-fit:cover;display:block}
.mx-phone .isl{position:absolute;top:10px;left:50%;width:84px;height:24px;margin-left:-42px;border-radius:12px;background:#000;z-index:2}
.mx-p2{position:absolute;width:230px;height:493px;right:calc(50% - 300px);top:70px;transform:rotate(7deg);opacity:.92;z-index:0}
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
.mx-ba{display:grid;gap:14px;margin-top:30px;align-items:start}
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
/* v2 первого экрана: по центру, как продуктовая страница Apple; визуал из настоящей 3D-фигуры и реального ролика */
.mx-top{text-align:center;padding:56px 0 0;overflow:hidden;background:radial-gradient(120% 70% at 50% 0%,#232326 0%,#161617 60%)}
.mx-eye{font-size:15px;font-weight:500;color:#98989D;margin:0 0 14px}
.mx-top h1{font-size:clamp(40px,9.6vw,80px);line-height:1.04;letter-spacing:-.05em;font-weight:700;margin:0 auto;max-width:14em}
.mx-top h1 span,.mx h2 span{background:linear-gradient(180deg,#F5F5F7 0%,#8E8E93 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.mx-top .mx-sub{margin:22px auto 0;font-size:clamp(18px,2.4vw,22px);line-height:1.45;color:#A1A1A6;max-width:28em}
.mx-top .mx-btns{justify-content:center;align-items:center;gap:22px;margin-top:30px}
.mx-cta.mx-big{background:linear-gradient(180deg,#45C3F5 0%,#0EA5E9 52%,#0A92CF 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.18),0 14px 40px rgba(14,165,233,.35)}
.mx-link{display:inline-flex;align-items:center;gap:2px;color:#0EA5E9!important;font-size:17px;font-weight:500}
.mx-top .mx-note{margin-top:14px}
.mx-stage{position:relative;height:640px;margin-top:36px;display:flex;justify-content:center;align-items:flex-start}
.mx-glow{position:absolute;top:60px;width:760px;height:560px;border-radius:50%;background:radial-gradient(closest-side,rgba(14,165,233,.2),transparent);filter:blur(20px)}
.mx-fig{position:absolute;height:600px;width:auto;top:20px;left:calc(50% - 400px);filter:drop-shadow(0 30px 60px rgba(0,0,0,.6)) drop-shadow(0 0 40px rgba(14,165,233,.15));-webkit-mask-image:linear-gradient(180deg,#000 75%,transparent);mask-image:linear-gradient(180deg,#000 75%,transparent)}
.mx-p1{position:relative;z-index:2;animation:none}
.mx-p2{position:absolute;width:230px;height:493px;left:calc(50% + 170px);right:auto;top:70px;transform:rotate(6deg);opacity:.9;z-index:1}
.mx-cap{bottom:auto;top:612px}
.mx-c{text-align:center}.mx-c h2{margin:0 auto}
.mx-sec{padding:88px 0 0}
.mx-g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))!important}
.mx-card{background:linear-gradient(180deg,#262629 0%,#1F1F22 100%);border:1px solid rgba(255,255,255,.06);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 18px 40px rgba(0,0,0,.25)}
.mx-ba{display:grid;gap:36px;align-items:center}
.mx-list{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:12px;font-size:17px;color:#E5E5EA}.mx-list li{display:flex;gap:12px;align-items:flex-start}
.mx-list li:before{content:'';flex:none;width:8px;height:8px;border-radius:50%;margin-top:8px;background:#0EA5E9;box-shadow:0 0 10px #0EA5E9}
.mx-shot{justify-self:center;width:min(360px,100%);border-radius:36px;overflow:hidden;border:1px solid rgba(255,255,255,.08);box-shadow:0 30px 80px rgba(0,0,0,.55)}.mx-shot img{display:block;width:100%}
.mx-auth{justify-content:center;margin-top:36px}.mx-auth div{font-size:15px;line-height:1.45;text-align:left}.mx-auth b{display:block}.mx-auth span{color:#86868B}
.mx-final{padding:110px 0 90px}
@media(min-width:760px){.mx-ba{grid-template-columns:1fr 1fr}}
@media(max-width:959px){.mx-fig{display:none}.mx-stage{height:660px}.mx-cap{top:616px}.mx-top .mx-btns{flex-direction:column;gap:16px}}
.mx-try{max-width:400px;margin:32px auto 0;padding:14px;border-radius:32px;background:linear-gradient(180deg,#262629,#1C1C1E);border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 30px 80px rgba(0,0,0,.5)}
.mx-trow{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mx-seg{display:flex;gap:2px;padding:4px;border-radius:9999px;background:#141416;box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}
.mx-seg button{flex:1;height:38px;padding:0 14px;border:0;border-radius:9999px;background:transparent;color:#98989D;font:500 14px Inter,system-ui,sans-serif;cursor:pointer;transition:background .2s,color .2s}
.mx-seg button.on{background:linear-gradient(180deg,#48484C,#3A3A3D);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 2px 6px rgba(0,0,0,.4)}
.mx-seg button:active{transform:scale(.96)}
#tvw{margin-top:10px}#tvw button{padding:0 6px}
.mx-tst{position:relative;margin-top:10px;height:460px;border-radius:24px;background:radial-gradient(80% 60% at 50% 40%,#16202E,#0F151F);overflow:hidden;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none}
.mx-tst:active{cursor:grabbing}
.mx-turn{position:absolute;inset:16px 0 4px;background:url(img/lp/try-turn.webp) 0 0/2400% 100% no-repeat;width:200px;margin:0 auto}
.mx-tst img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mx-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9999px;background:rgba(33,33,36,.85);border:1px solid rgba(255,255,255,.1);font-size:13px;color:#E5E5EA;transition:opacity .4s;pointer-events:none}.mx-hint svg{width:15px;height:15px}
.mx-tcap{font-size:12.5px;color:#86868B;text-align:center;margin:10px 0 0}
.mx-hyp{display:grid;gap:8px;margin-top:12px}.mx-hyp div{display:grid;grid-template-columns:12px auto 1fr;gap:4px 10px;align-items:baseline;padding:12px 14px;border-radius:18px;background:#141416;font-size:14px}
.mx-hyp i{width:10px;height:10px;border-radius:50%;align-self:center}.mx-hyp b{font-weight:600}.mx-hyp span{color:#A1A1A6}
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
  const cta = (id, big = true) => `<button class="mx-pill mx-cta${big ? ' mx-big' : ''}" id="${id}">Попробовать бесплатно</button>`;
  go(`<div class="mx fade"><style>${CSS}</style>
    <nav class="mx-nav"><div class="w"><img src="icons/bp6-64.png" width="28" height="28" alt="" style="border-radius:7px"><b>BodyPassport</b>
      <div class="mx-links"><a href="#mxtry">Пример</a><a href="#mxf">Возможности</a><a href="#mxba">Было → стало</a><a href="#mxs">Как это работает</a><a href="/pricing">Цены</a></div>
      <span style="flex:1"></span><button class="mx-pill" id="lpin">Войти</button></div></nav>
    <header class="mx-top"><div class="w">
      <p class="mx-eye mx-in">Для тренеров, реабилитологов и массажистов</p>
      <h1 class="mx-in">Осанка в цифрах для&nbsp;вас.<br><span>В&nbsp;3D для&nbsp;клиента.</span></h1>
      <p class="mx-sub mx-in">По четырём фото приложение измерит наклоны и смещения головы, плеч и таза и покажет их на 3D‑фигуре в позе клиента. Ваша оценка объективна, клиент видит, за что платит.</p>
      <div class="mx-btns mx-in">${cta('lpgo')}<a class="mx-link" href="#mxtry">Попробовать на примере ${ic('chevron-right', 's')}</a></div>
      <p class="mx-note mx-in">30 дней бесплатно, без карты. Работает в браузере телефона.</p></div>
      <div class="mx-stage mx-in"><div class="mx-glow"></div>
        <img class="mx-fig" src="img/lp/hero-figure-v5.webp" alt="3D-фигура в позе клиента" width="343" height="1000">
        <div class="mx-phone mx-p1"><div class="mx-scr"><video id="lpv" autoplay muted loop playsinline preload="metadata" poster="img/lp/demo-poster-v5.webp" aria-label="Как проходит быстрый тест: 4 фото, точки, 3D-фигура, отчет"><source src="img/lp/demo-v5.mp4" type="video/mp4"></video></div></div>
        <div class="mx-phone mx-p2" aria-hidden="true"><div class="mx-scr"><img src="img/lp/screen-passport-v5.webp" alt="" loading="lazy"></div></div>
        <span class="mx-cap">Реальные экраны приложения</span></div>
    </header>
    <div class="w">
    <section class="mx-sec" id="mxtry"><div class="mx-in mx-c"><h2>Попробуйте сами.<br><span>Это настоящий результат теста.</span></h2>
        <p class="mx-lead" style="margin:12px auto 0">Покрутите фигуру пальцем, смените ракурс, откройте фото с замерами. Пример: клиент жалуется на поясницу.</p></div>
      <div class="mx-try mx-in">
        <div class="mx-trow"><div class="mx-seg" id="tmd"><button data-md="3d" class="on">3D</button><button data-md="ph">Фото</button></div><span class="mx-tag n" id="tlbl">Типовая фигура</span></div>
        <div class="mx-tst" id="tst"><div class="mx-turn" id="tturn" role="img" aria-label="3D-фигура в позе клиента, отмечены зоны для работы"></div><img id="tph" alt="Фото клиента с замерами" hidden>
          <span class="mx-hint" id="thint">${ic('arrow-right-left', 's')}Покрутите</span></div>
        <div class="mx-seg" id="tvw"><button data-vw="front" class="on">Спереди</button><button data-vw="right">Справа</button><button data-vw="back">Сзади</button><button data-vw="left">Слева</button></div>
        <p class="mx-tcap" id="tcap">Положение на типовой фигуре. Цветом отмечены зоны для работы</p>
        <div class="mx-hyp"><div><i style="background:#FF9F0A"></i><b>Расслабить</b><span>поясница, передняя сторона бедра, грудь</span></div><div><i style="background:#30D158"></i><b>Укрепить</b><span>ягодица, задняя сторона бедра</span></div></div>
        <p class="mx-tcap">Зоны предлагает специалист: это его гипотеза, не диагноз</p>
      </div></section>
    <section class="mx-sec" id="mxf"><div class="mx-in mx-c"><h2>Всё, что нужно на приёме.<br><span>Ничего лишнего.</span></h2></div>
      <div class="mx-grid">
        <div class="mx-card mx-in"><div class="mx-ico">${I.photo}</div><b>Замер по четырём фото</b><p>Точки встают сами. Неточную поправите пальцем, лупа покажет место.</p></div>
        <div class="mx-card mx-in"><div class="mx-ico">${I.cube}</div><b>3D-фигура в позе клиента</b><p>Анатомическая модель повторяет его наклоны. Покрутите и покажите крупнее, чтобы он увидел сам.</p></div>
        <div class="mx-card mx-in"><div class="mx-ico">${I.cmp}</div><b>Было → стало</b><p>Повторный тест рядом с первым. Видно, что изменилось на самом деле.</p></div>
        <div class="mx-card mx-in"><div class="mx-ico">${I.pdf}</div><b>Отчёт за минуту</b><p>PDF в мессенджер: фото, фигура, ваш вывод и упражнения. С ним клиент возвращается к вам.</p></div>
      </div></section>
    <section class="mx-sec" id="mxba"><div class="mx-ba">
        <div class="mx-in"><h2>Прогресс,<br><span>который клиент видит сам.</span></h2><p class="mx-lead">Повторный замер ставит два теста рядом. Лучший аргумент продолжить работу говорит не специалист, а фото.</p>
          <ul class="mx-list"><li>Фото до и после с теми же линиями</li><li>Отмечено только то, что изменилось больше погрешности</li><li>Клиент видит результат своих усилий</li></ul></div>
        <div class="mx-shot mx-in"><img src="img/lp/screen-compare-v5.webp" alt="Экран «Было → стало» в приложении" loading="lazy"></div>
      </div></section>
    <section class="mx-sec" id="mxs"><div class="mx-in mx-c"><h2>Пять минут<br><span>от фото до отчёта.</span></h2></div>
      <div class="mx-steps">
        <div class="mx-card mx-step mx-in"><span class="n">1</span><div><b>Снимите</b><p>Спереди, сбоку, сзади. Контур и уровень подскажут, как держать телефон.</p></div></div>
        <div class="mx-card mx-step mx-in"><span class="n">2</span><div><b>Проверьте</b><p>Точки уже на месте. Вы подтверждаете или правите одним касанием.</p></div></div>
        <div class="mx-card mx-step mx-in"><span class="n">3</span><div><b>Покажите</b><p>3D-фигура на экране и отчёт в мессенджер. Клиент уходит с планом.</p></div></div>
      </div></section>
    <section class="mx-sec"><div class="mx-in mx-c"><h2>Данные остаются у вас.</h2></div>
      <div class="mx-grid mx-g2">
        <div class="mx-card mx-in"><b>Фото не уходят на сервер</b><p>Фото, точки и выводы хранятся на вашем телефоне. Копию можно сохранить файлом с паролем.</p></div>
        <div class="mx-card mx-in"><b>Решение за вами</b><p>Приложение измеряет, вы делаете вывод. В отчёте он помечен как «гипотеза специалиста». Это не диагноз и не медицинское заключение.</p></div>
      </div>
      <div class="mx-auth mx-in"><img src="img/rifat.jpg" alt="Рифат Аюпов"><div><b>Рифат Аюпов</b><span>кинезиотерапевт, автор методики. Отвечаю специалистам сам</span></div></div></section>
    <section class="mx-final mx-in"><h2>Начните<br><span>со следующего клиента.</span></h2><div style="display:flex;justify-content:center;margin-top:28px">${cta('lpgo2')}</div></section>
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
  tryDemo();
}
/** «Попробуйте сами»: 24 кадра настоящей 3D-фигуры (поворот пальцем) и 4 фото с замерами. Кнопки работают как в приложении. */
function tryDemo() {
  const $ = id => document.getElementById(id), N = 24, turn = $('tturn'), ph = $('tph'), st = $('tst'), hint = $('thint');
  if (!turn) return;
  const VW = { front: 0, right: 6, back: 12, left: 18 }; let f = 0, mode = '3d', view = 'front', anim = 0;
  const show = () => { turn.style.backgroundPosition = `${(((Math.round(f) % N) + N) % N) * 100 / (N - 1)}% 0`; };
  const spin = (to, ms = 500) => { cancelAnimationFrame(anim); let d = ((to - f) % N + N) % N; if (d > N / 2) d -= N; const f0 = f, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3; f = f0 + d * e; show(); if (k < 1) anim = requestAnimationFrame(step); }; anim = requestAnimationFrame(step); };
  const setView = v => { view = v; document.querySelectorAll('#tvw button').forEach(b => b.classList.toggle('on', b.dataset.vw === v));
    if (mode === 'ph') ph.src = `img/lp/try-${v}.webp`; else spin(VW[v]); };
  const setMode = m => { mode = m; document.querySelectorAll('#tmd button').forEach(b => b.classList.toggle('on', b.dataset.md === m));
    turn.hidden = m !== '3d'; ph.hidden = m !== 'ph'; hint.style.display = m === '3d' ? '' : 'none'; st.style.cursor = m === '3d' ? '' : 'default';
    $('tlbl').textContent = m === '3d' ? 'Типовая фигура' : 'Фото клиента';
    $('tcap').textContent = m === '3d' ? 'Положение на типовой фигуре. Цветом отмечены зоны для работы' : 'Подписаны только отклонения больше погрешности. Линия: вертикаль от стоп';
    setView(view); };
  document.querySelectorAll('#tmd button').forEach(b => b.onclick = () => { setMode(b.dataset.md); track('try_click', { c: 'mode_' + b.dataset.md }, false); });
  document.querySelectorAll('#tvw button').forEach(b => b.onclick = () => setView(b.dataset.vw));
  // поворот пальцем: 360° на ширину блока; отпустили — фигура доворачивается к ближайшему кадру, вкладка ракурса подсвечивается
  let x0 = null, f0 = 0;
  st.addEventListener('pointerdown', e => { if (mode !== '3d') return; cancelAnimationFrame(anim); x0 = e.clientX; f0 = f; hint.style.opacity = 0; st.setPointerCapture(e.pointerId); });
  st.addEventListener('pointermove', e => { if (x0 === null) return; f = f0 - (e.clientX - x0) / st.clientWidth * N; show(); });
  const up = () => { if (x0 === null) return; x0 = null; const r = ((Math.round(f) % N) + N) % N, v = Object.keys(VW).find(k => VW[k] === r);
    document.querySelectorAll('#tvw button').forEach(b => b.classList.toggle('on', b.dataset.vw === v)); if (v) view = v; spin(Math.round(f), 200); };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  // при первом показе фигура делает один медленный оборот, чтобы было понятно, что ее можно крутить
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect(); setTimeout(() => { if (x0 === null && mode === '3d' && !f) spin(N, 2600); }, 600); }, { threshold: .6 }); io.observe(st); }
}
