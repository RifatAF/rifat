// Рост продукта: отзывы, «порекомендуете ли» (NPS), приглашение коллег, установка на экран телефона.
import { meSync, configSync } from './auth.js';
import { track, diagnostics, currentScreen } from './track.js';
import { refLink, copyRefText, BASE_SLOTS, REF_SLOTS } from './plans.js';
import { toast, poseInfo, cam } from './core.js';

const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
const role = () => localStorage.getItem('bp_mode') === 'pro' ? 'pro' : 'client';
const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
export const VERSION = '2026-10-09';

export async function sendFeedback(fb) {
  const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fb, r: role(), v: VERSION }) });
  if (!r.ok) throw new Error(r.status); track('fb_sent', { s: fb.s ?? -1, c: fb.k }, false);
}

// разработчик и автор методики: лицо и прямой контакт в бете повышают доверие и число сообщений о проблемах
export const DEV = { name: 'Рифат Аюпов', role: 'разработчик и автор методики', tg: 'RifatAiupov', photo: 'img/rifat.jpg' };
export const devCard = (note = 'отвечаю сам') => `<a class="row" href="https://t.me/${DEV.tg}" target="_blank" rel="noopener" style="gap:12px;margin-top:12px;padding:10px 12px;border-radius:16px;background:var(--surface);text-decoration:none;color:inherit">
  <img src="${DEV.photo}" alt="" width="44" height="44" style="border-radius:50%;object-fit:cover;flex:none"><span style="flex:1;min-width:0;line-height:1.3"><b style="font-size:15px">${DEV.name}</b><span style="display:block;font-size:12px;font-weight:400;color:var(--sub)">${DEV.role}${note ? ' · ' + note : ''}</span></span><span style="font-size:13px;font-weight:600;color:#229ED9">@${DEV.tg}</span></a>`;
function sheet(html) {
  const d = document.createElement('div'); d.className = 'sheet'; d.innerHTML = `<div>${html}</div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; return d;
}
const contactBox = () => meSync() ? `<label class="row" style="margin-top:12px;font-size:14px;align-items:flex-start;gap:10px"><input type="checkbox" id="fbc" style="width:20px;height:20px;flex:none;accent-color:var(--ink);margin-top:1px"><span>Можно со мной связаться (${esc(meSync().name)})</span></label>` : '';

/** Свободный отзыв или идея: из меню и настроек. */
export function feedbackSheet(where = 'menu', preset = {}) {
  const d = sheet(`<h2 style="font-size:21px">Отзыв или идея</h2>
    <p class="sub" style="font-size:14px;margin-top:6px">Что понравилось, что неудобно, чего не хватает. Читаю каждый отзыв лично.</p>${devCard()}
    <textarea id="fbt" rows="5" maxlength="2000" placeholder="Например: не понял, куда встать на втором шаге…" style="width:100%;margin-top:14px;border-radius:16px;border:1px solid var(--line);padding:12px 14px;font:16px Manrope;background:var(--surface);resize:vertical">${esc(preset.t || '')}</textarea>
    ${contactBox()}
    <p id="fbe" class="sub" style="font-size:13px;min-height:18px;margin-top:6px;color:var(--over-t)"></p>
    <button class="btn" id="fbs" style="margin-top:6px">Отправить</button><button class="btn ghost" id="fbx" style="margin-top:8px;border:0">Отмена</button>`);
  d.querySelector('#fbx').onclick = () => d.remove();
  d.querySelector('#fbs').onclick = async () => { const t = d.querySelector('#fbt').value.trim(); if (!t && preset.s == null) { d.querySelector('#fbe').textContent = 'Напишите пару слов'; return; }
    d.querySelector('#fbs').textContent = 'Отправляю…';
    try { await sendFeedback({ k: preset.k || 'free', s: preset.s ?? null, t, w: where, contact: !!(d.querySelector('#fbc') && d.querySelector('#fbc').checked) });
      d.firstElementChild.innerHTML = '<h2 style="font-size:21px">Спасибо!</h2><p class="sub" style="margin-top:8px">Отзыв получен. Лучшие идеи появятся в следующих версиях.</p><button class="btn" id="fbok" style="margin-top:16px">Готово</button>';
      d.querySelector('#fbok').onclick = () => d.remove(); }
    catch (e) { d.querySelector('#fbs').textContent = 'Отправить'; d.querySelector('#fbe').textContent = 'Не отправилось, проверьте интернет'; } };
}

/** «Что-то не так»: одна фраза от человека плюс сведения об устройстве и последние нажатия. Приходит автору в Telegram сразу. */
export async function bugSheet() {
  if (document.querySelector('.sheet #bgt')) return;
  const d = sheet(`<h2 style="font-size:21px">Ошибка, неудобство или идея?</h2>
    <p class="sub" style="font-size:14px;margin-top:6px">Пара слов о том, что на этом экране не так или как сделать удобнее. Каждое сообщение читаю в тот же день.</p>${devCard('отвечаю сам')}
    <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:12px">${['Ошибка', 'Неудобно', 'Непонятно', 'Идея'].map(t => `<button class="pill" data-bk="${t}">${t}</button>`).join('')}</div>
    <textarea id="bgt" rows="4" maxlength="1500" placeholder="Например: на шаге «одна нога» зависло, кнопка «Ещё раз» не нажималась" style="width:100%;margin-top:14px;border-radius:16px;border:1px solid var(--line);padding:12px 14px;font:16px Manrope;background:var(--surface);resize:vertical"></textarea>
    <label class="row" style="margin-top:12px;font-size:14px;align-items:flex-start;gap:10px"><input type="checkbox" id="bgd" checked style="width:20px;height:20px;flex:none;accent-color:var(--ink);margin-top:1px"><span>Приложить сведения о телефоне и последние нажатия. Без имен клиентов, видео и результатов.</span></label>
    ${contactBox()}
    <p id="bge" class="sub" style="font-size:13px;min-height:18px;margin-top:6px;color:var(--over-t)"></p>
    <button class="btn" id="bgs" style="margin-top:6px">Отправить</button><button class="btn ghost" id="bgx" style="margin-top:8px;border:0">Отмена</button>`);
  const c = d.querySelector('#fbc'); if (c) c.checked = true;
  let kind = ''; d.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => { kind = kind === b.dataset.bk ? '' : b.dataset.bk; d.querySelectorAll('[data-bk]').forEach(x => x.classList.toggle('on', x.dataset.bk === kind)); });
  d.querySelector('#bgx').onclick = () => d.remove(); setTimeout(() => d.querySelector('#bgt').focus(), 50);
  d.querySelector('#bgs').onclick = async () => { const t = d.querySelector('#bgt').value.trim(); if (!t) { d.querySelector('#bge').textContent = 'Напишите пару слов'; return; }
    d.querySelector('#bgs').textContent = 'Отправляю…';
    let st = {}; try { if (navigator.storage) { const [p, e] = await Promise.all([navigator.storage.persisted ? navigator.storage.persisted() : null, navigator.storage.estimate ? navigator.storage.estimate() : null]); st = { persisted: p === true, quota: e ? Math.round(e.quota / 1048576) : null }; } } catch (e) {}
    const dg = d.querySelector('#bgd').checked ? diagnostics({ model: poseInfo.model, deleg: poseInfo.deleg, loadSec: poseInfo.loadSec, fps: cam.fps ? Math.round(cam.fps) : null, ...st }) : null;
    // тип и экран идут в начало текста: в сводке сразу видно, где и что
    const scrName = currentScreen(); const t2 = (kind ? '[' + kind + '] ' : '') + (scrName ? '(' + scrName + ') ' : '') + t;
    try { await sendFeedback({ k: 'bug', t: t2.slice(0, 2000), w: 'any', d: dg ? { ...dg, screen: scrName } : null, contact: !!(c && c.checked) }); track('bug_sent', null, false);
      d.firstElementChild.innerHTML = '<h2 style="font-size:21px">Получил, спасибо!</h2><p class="sub" style="margin-top:8px">Разберусь и напишу, если оставили контакт.</p><button class="btn" id="bgok" style="margin-top:16px">Готово</button>';
      d.querySelector('#bgok').onclick = () => d.remove(); }
    catch (e) { d.querySelector('#bgs').textContent = 'Отправить'; d.querySelector('#bge').textContent = 'Не отправилось, проверьте интернет'; } };
}
/** Язычок «Отзыв» у края экрана на всех экранах, кроме камеры. */
export function mountBugTab() {
  if (document.getElementById('bugtab')) return;
  const b = document.createElement('button'); b.id = 'bugtab'; b.type = 'button'; b.textContent = 'Отзыв'; b.setAttribute('aria-label', 'Ошибка, неудобство или идея');
  b.onclick = bugSheet; document.body.appendChild(b);
}

/** Оценка результата одним касанием (клиент, под картой). Один раз на тест. */
export function rateCard(key) {
  if (LS.get('bp_rate_' + key)) return '';
  return `<div class="card" id="rate" data-key="${esc(key)}" style="text-align:center;padding:16px"><b style="font-size:16px">Насколько полезен результат?</b>
    <div class="row" style="justify-content:center;gap:8px;margin-top:12px">${[1, 2, 3, 4, 5].map(n => `<button data-rate="${n}" aria-label="${n} из 5" style="width:48px;height:48px;border-radius:14px;border:1px solid var(--line);background:var(--surface);font:600 18px Manrope;color:var(--text);cursor:pointer">${n}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub);margin:6px 6px 0"><span>бесполезно</span><span>очень полезно</span></div></div>`;
}
export function bindRate(where = 'map') {
  const box = document.getElementById('rate'); if (!box) return;
  box.querySelectorAll('[data-rate]').forEach(b => b.onclick = async () => { const s = +b.dataset.rate; LS.set('bp_rate_' + box.dataset.key, String(s));
    sendFeedback({ k: 'result', s, w: where }).catch(() => {});
    box.innerHTML = s >= 4 ? `<b style="font-size:16px">Спасибо!</b><p class="sub" style="font-size:14px;margin-top:4px">Поделитесь с тем, кому это тоже пригодится.</p><button class="btn" id="rshare" style="margin-top:12px;height:48px">Поделиться приложением</button>`
      : `<b style="font-size:16px">Спасибо! Что улучшить?</b><p class="sub" style="font-size:14px;margin-top:4px">Пара слов поможет сделать тест точнее.</p><button class="btn" id="rmore" style="margin-top:12px;height:48px">Написать</button>`;
    const sh = document.getElementById('rshare'); if (sh) sh.onclick = () => shareApp();
    const mo = document.getElementById('rmore'); if (mo) mo.onclick = () => feedbackSheet(where, { k: 'free' }); });
}

/** «Порекомендуете коллеге?» 0–10 у специалиста: после 3 своих оценок, не чаще раза в 60 дней. */
export function npsCard(ownAssessments) {
  const last = +LS.get('bp_nps') || 0; if (ownAssessments < 3 || Date.now() - last < 60 * 864e5) return '';
  return `<div class="pad" style="margin-top:16px"><div class="card" id="nps"><b style="font-size:16px">Порекомендуете BodyPassport коллеге?</b>
    <div style="display:grid;grid-template-columns:repeat(11,1fr);gap:4px;margin-top:12px">${Array.from({ length: 11 }, (_, n) => `<button data-nps="${n}" aria-label="${n} из 10" style="height:44px;border-radius:10px;border:1px solid var(--line);background:var(--surface);font:600 14px Manrope;color:var(--text);padding:0;cursor:pointer">${n}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub);margin-top:6px"><span>точно нет</span><span>точно да</span></div>
    <button id="npsx" style="margin-top:8px;background:none;border:0;font:500 13px Manrope;color:var(--sub);text-decoration:underline;padding:6px 0">Не сейчас</button></div></div>`;
}
export function bindNps() {
  const box = document.getElementById('nps'); if (!box) return;
  box.querySelector('#npsx').onclick = () => { LS.set('bp_nps', String(Date.now())); box.parentElement.remove(); };
  box.querySelectorAll('[data-nps]').forEach(b => b.onclick = () => { const s = +b.dataset.nps; LS.set('bp_nps', String(Date.now()));
    sendFeedback({ k: 'nps', s, w: 'home' }).catch(() => {});
    box.innerHTML = s >= 9 ? `<b style="font-size:16px">Спасибо! Пригласите коллегу</b><p class="sub" style="font-size:14px;margin-top:4px">Поделитесь приложением с коллегой: это лучшая помощь проекту.</p><button class="btn" id="npsref" style="margin-top:12px;height:48px">Пригласить коллегу</button>`
      : `<b style="font-size:16px">Спасибо! Что мешает поставить 10?</b><button class="btn" id="npsmore" style="margin-top:12px;height:48px">Написать</button>`;
    const r = document.getElementById('npsref'); if (r) r.onclick = referralSheet;
    const m = document.getElementById('npsmore'); if (m) m.onclick = () => feedbackSheet('home', { k: 'nps', s, t: '' }); });
}

// ссылка с кодом приглашения: у вошедшего свой код, иначе ссылка без кода
export const myRef = () => (meSync() && meSync().refCode) || '';
export const appLink = () => location.origin + '/?src=app' + (myRef() ? '&ref=' + myRef() : '');
export async function shareApp() {
  const url = appLink(), text = 'Тест движения по камере телефона за 3 минуты: карта мышц и что укрепить, растянуть, расслабить. Бесплатно.';
  track('ref_share', { c: 'client' }, false);
  if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url).catch(() => {}); toast('Ссылка скопирована'); }
}

/** Приглашение коллег-специалистов: ссылка с кодом, счетчик и +3 слота клиентов за каждого. */
export function referralSheet() {
  const u = meSync();
  if (!u || !u.refCode) { sheet('<h2 style="font-size:21px">Пригласить коллегу</h2><p class="sub" style="margin-top:8px">Войдите в кабинет, чтобы получить личную ссылку.</p><button class="btn" id="rfx" style="margin-top:16px">Понятно</button>').querySelector('#rfx').onclick = e => e.target.closest('.sheet').remove(); return; }
  const url = refLink(), beta = configSync().beta !== false;
  const d = sheet(`<div class="eyebrow">Пригласить коллегу</div><h2 style="font-size:22px;margin-top:6px">Приглашайте коллег, получайте PRO</h2>
    <div class="ref-steps"><div><b>1</b><span>Отправьте коллеге свою ссылку</span></div><div><b>2</b><span>Он входит по ней в кабинет специалиста и закрепляется за вами навсегда</span></div>
      <div><b>3</b><span>${beta ? 'После беты' : 'Каждый раз, когда он платит за PRO,'} 20% его оплаты 24 месяца приходят вам на баланс. Балансом оплачивается ваш PRO</span></div></div>
    <div class="kpi" style="margin-top:14px"><div><b>${u.invited || 0}</b><span>вошли по ссылке</span></div><div><b>${u.invitedPro || 0}</b><span>из них специалисты</span></div><div><b style="color:var(--ok-t)">${(u.balance || 0).toLocaleString('ru')} ₽</b><span>на балансе${beta ? ', начисления после беты' : ''}</span></div></div>
    <div class="card row" style="margin-top:12px;padding:12px 14px"><span style="flex:1;font-size:14px;word-break:break-all">${esc(url)}</span></div>
    <button class="btn" id="rfs" style="margin-top:12px">Пригласить</button><button class="btn ghost" id="rfx" style="margin-top:8px;border:0">Закрыть</button>`);
  d.querySelector('#rfx').onclick = () => d.remove();
  d.querySelector('#rfs').onclick = () => { d.remove(); copyRefText(); };
}

// установка на главный экран: Android/Chrome дает событие, iOS Safari только через «Поделиться»
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { track('install_ok'); LS.set('bp_inst', 'done'); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
export const canInstall = () => !standalone() && !(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
// встроенный браузер (Telegram, Instagram и т.п.) сам не ставит приложения: нужно открыть страницу в Chrome или Safari
const inApp = () => /Telegram|Instagram|FBAN|FBAV|VKClient|wv\)/i.test(navigator.userAgent) || (!deferred && /Android/.test(navigator.userAgent) && !/Chrome\/[\d.]+ Mobile Safari/.test(navigator.userAgent));
/** Установка одной кнопкой: системное окно Chrome. Где его нет (iOS, встроенные браузеры), одна короткая подсказка, без инструкций на экран. */
export async function installNow(done) {
  track('install_click');
  if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r && r.outcome === 'accepted') { LS.set('bp_inst', 'done'); done && done(); } return; }
  installGuide();
}
// где открыта страница: от этого зависят шаги установки
export function platform() { const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), android = /Android/.test(ua);
  if (standalone()) return 'installed'; if (deferred) return 'prompt';
  if (ios) return /Telegram|Instagram|FBAN|FBAV|VKClient|Line\//i.test(ua) ? 'ios-inapp' : /CriOS|FxiOS|EdgiOS|YaBrowser/.test(ua) ? 'ios-other' : 'ios-safari';
  if (android) return inApp() ? 'android-inapp' : 'android'; return 'desktop'; }
const MORE_ICO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-5px"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
const DOTS_ICO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-5px"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
/** Пошаговая установка под телефон и браузер. link: ссылка, с которой человек должен открыть приложение в другом браузере или после установки на iPhone
 *  (у Safari и установленного приложения на iPhone раздельная память, у встроенных браузеров Telegram и WhatsApp тоже). */
// ссылка, с которой клиент вернется в свой кабинет в другом браузере или в установленном приложении на iPhone
const repLink = () => { try { const r = JSON.parse(localStorage.getItem('bp_reports') || '[]').at(-1); return r && r.code ? location.origin + '/#rep=' + r.code : ''; } catch (e) { return ''; } };
export function installGuide({ link, client } = {}) {
  if (!link) link = repLink() || location.origin; if (client == null) client = !!repLink();
  const pf = platform(); track('install_guide', { c: pf }, false);
  const step = (n, t) => `<div class="row" style="gap:12px;align-items:center;margin-top:12px;font-size:15px;line-height:1.4"><b style="flex:none;width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center">${n}</b><span>${t}</span></div>`;
  const copy = `<button class="btn line" id="igc" style="margin-top:14px">Скопировать ссылку</button>`;
  const body = {
    prompt: `<p class="sub" style="margin-top:8px;font-size:15px">Одно нажатие, приложение появится на главном экране.</p><button class="btn" id="igp" style="margin-top:16px">Установить</button>`,
    android: `${step(1, `Нажмите ${DOTS_ICO} справа вверху в Chrome`)}${step(2, '«Установить приложение» или «Добавить на главный экран»')}${step(3, 'Откройте BodyPassport с главного экрана')}`,
    'android-inapp': `<p style="font-size:15px;margin-top:10px;line-height:1.45">Страница открыта внутри мессенджера, отсюда приложение не ставится. Откройте её в Chrome:</p>${step(1, `Нажмите ${DOTS_ICO} или ${MORE_ICO} вверху → «Открыть в браузере» или «Открыть в Chrome»`)}${step(2, 'Не получилось: скопируйте ссылку и вставьте её в адресную строку Chrome')}${step(3, `В Chrome: ${DOTS_ICO} → «Установить приложение»`)}${copy}`,
    'ios-safari': `${client ? step(1, 'Скопируйте ссылку кнопкой ниже: на iPhone приложение откроется пустым, ссылку нужно будет вставить') : ''}${step(client ? 2 : 1, `Нажмите ${SHARE_ICO} «Поделиться» внизу экрана. Нет такой кнопки: сначала ${MORE_ICO} справа внизу`)}${step(client ? 3 : 2, `Прокрутите вниз и выберите ${ADD_ICO} «На экран Домой» → «Добавить»`)}${step(client ? 4 : 3, client ? 'Откройте приложение с экрана Домой и нажмите «Вставить ссылку»' : 'Откройте приложение с экрана Домой')}${client ? copy : ''}`,
    'ios-other': `${client ? step(1, 'Скопируйте ссылку кнопкой ниже') : ''}${step(client ? 2 : 1, `Нажмите ${SHARE_ICO} в адресной строке`)}${step(client ? 3 : 2, `«На экран Домой» → «Добавить». Нет такого пункта: откройте ссылку в Safari`)}${client ? step(4, 'Откройте приложение с экрана Домой и нажмите «Вставить ссылку»') : ''}${copy}`,
    'ios-inapp': `<p style="font-size:15px;margin-top:10px;line-height:1.45">Страница открыта внутри мессенджера, отсюда приложение не ставится. Откройте её в Safari:</p>${step(1, `Нажмите ${MORE_ICO} или значок компаса → «Открыть в Safari». Не получилось: скопируйте ссылку и вставьте в Safari`)}${step(2, `В Safari: ${SHARE_ICO} «Поделиться» → ${ADD_ICO} «На экран Домой»`)}${copy}`,
    desktop: `<p style="font-size:15px;margin-top:10px;line-height:1.45">Приложение ставится на телефон. Откройте эту ссылку на телефоне в Chrome (Android) или Safari (iPhone).</p>${copy}`,
    installed: `<p style="font-size:15px;margin-top:10px">Приложение уже установлено.</p>` }[pf];
  const d = sheet(`<h2 style="font-size:22px">Установить приложение</h2>${client ? '<p class="sub" style="font-size:14px;margin-top:6px;line-height:1.45">Иконка на экране телефона: домашка и тренер всегда под рукой, новые упражнения от специалиста подтянутся сами.</p>' : ''}${body}<button class="btn ghost" id="igx" style="margin-top:8px;border:0">Закрыть</button>`);
  d.querySelector('#igx').onclick = () => d.remove();
  if (d.querySelector('#igp')) d.querySelector('#igp').onclick = async () => { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r && r.outcome === 'accepted') { LS.set('bp_inst', 'done'); d.remove(); } };
  if (d.querySelector('#igc')) d.querySelector('#igc').onclick = async () => { track('install_copy', { c: pf }, false); try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); } catch (e) { prompt('Скопируйте ссылку', link); } };
}
/** Клиенту: заметная карточка установки. «Не сейчас» прячет ее на 3 дня, вместо нее остается строка «Как установить», пока приложение не установлено. */
export function clientInstallCard() {
  if (!canInstall() || LS.get('bp_inst') === 'done') return '';
  const later = +(LS.get('bp_inst_later') || 0) > Date.now() - 3 * 864e5;
  if (later) return `<button class="row-link" id="cinst" style="gap:10px;border:1px solid var(--line);border-radius:16px;padding:10px 14px;width:100%;text-align:left"><img src="icons/bp7-192.png" alt="" width="28" height="28" style="border-radius:7px"><span style="flex:1;font-size:14px">Приложение не установлено · <b>Как установить</b></span></button>`;
  return `<div class="card" id="cinstc" style="display:flex;flex-direction:column;gap:12px;background:var(--brand);color:#fff;border:0"><div class="row" style="gap:12px"><img src="icons/bp7-192.png" alt="" width="48" height="48" style="border-radius:12px;flex:none"><div style="flex:1;min-width:0"><b style="font-size:17px">Установите приложение</b><div style="font-size:14px;opacity:.9;line-height:1.4;margin-top:2px">Иконка на экране: домашка всегда под рукой и обновится сама</div></div></div>
    <button class="btn" id="cinst" style="background:#fff;color:#111">Установить</button><button class="link" id="clater" style="color:#fff;opacity:.85;font-size:14px">Не сейчас</button></div>`;
}
export function bindClientInstall(link, rerender) {
  const b = document.getElementById('cinst'); if (!b) return; track('install_shown', { c: 'client' }, false);
  b.onclick = () => { if (deferred) return installNow(() => rerender && rerender()); installGuide({ link, client: true }); };
  const l = document.getElementById('clater'); if (l) l.onclick = () => { LS.set('bp_inst_later', String(Date.now())); track('install_later', {}, false); rerender && rerender(); };
}
// иконка «Поделиться» в Safari, чтобы человек узнал кнопку на своем экране
const SHARE_ICO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-5px"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const ADD_ICO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-5px"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
/** После первого готового отчета: установить приложение. На iPhone данные Safari и приложения раздельные, поэтому сначала копия файлом. */
export function installSheet(onBackup) {
  if (!canInstall() || LS.get('bp_inst') === 'done' || LS.get('bp_inst_ask')) return false;
  LS.set('bp_inst_ask', String(Date.now())); track('install_shown');
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua), safari = iOS(), android = /Android/.test(ua);
  const step = (n, t) => `<div class="row" style="gap:12px;align-items:center;margin-top:10px;font-size:15px;line-height:1.35"><b style="flex:none;width:28px;height:28px;border-radius:50%;background:var(--surface-2);display:grid;place-items:center">${n}</b><span>${t}</span></div>`;
  const how = deferred ? '' : ios && !safari ? `<p style="font-size:15px;margin-top:12px;line-height:1.45">Установить на iPhone можно только из Safari. Скопируйте ссылку и откройте ее в Safari.</p>`
    : ios ? `<div style="margin-top:12px">${step(1, 'Сохраните копию данных кнопкой ниже')}${step(2, `Нажмите ${SHARE_ICO} «Поделиться» внизу экрана`)}${step(3, `Выберите ${ADD_ICO} «На экран Домой» → «Добавить»`)}${step(4, 'Откройте приложение с экрана и загрузите копию: Меню → «Восстановить из копии»')}</div>`
    : android ? `<p style="font-size:15px;margin-top:12px;line-height:1.45">Меню ⋮ в Chrome → «Установить приложение» или «Добавить на главный экран».</p>` : '';
  const d = sheet(`<h2 style="font-size:22px">Установите приложение</h2>
    <p class="sub" style="font-size:15px;margin-top:8px;line-height:1.45">Данные клиентов хранятся только на этом устройстве. Браузер может очистить их, если долго не открывать сайт, а установленное приложение их не стирает.${ios ? ' На iPhone у Safari и приложения отдельная память, поэтому сначала сохраните копию.' : ''}</p>
    ${how}
    ${deferred ? '<button class="btn" id="isok" style="margin-top:16px">Установить</button>' : ios && !safari ? '<button class="btn" id="iscopy" style="margin-top:16px">Копировать ссылку</button>' : ''}
    ${onBackup ? `<button class="btn ${deferred || (ios && !safari) ? 'ghost' : ''}" id="isbk" style="margin-top:8px">Сохранить копию данных</button>` : ''}
    <button class="btn ghost" id="isx" style="margin-top:8px;border:0">Позже</button>`);
  d.querySelector('#isx').onclick = () => d.remove();
  if (d.querySelector('#isok')) d.querySelector('#isok').onclick = () => installNow(() => d.remove());
  if (d.querySelector('#iscopy')) d.querySelector('#iscopy').onclick = async () => { try { await navigator.clipboard.writeText(location.origin); toast('Ссылка скопирована'); } catch (e) {} };
  if (d.querySelector('#isbk')) d.querySelector('#isbk').onclick = () => onBackup();
  return true;
}
/** Строка «Установить приложение» с одной кнопкой. */
export function installCard() {
  if (!canInstall() || LS.get('bp_inst') === 'done') return '';
  return `<div class="pad" style="margin-top:16px"><div class="card row" id="inst" style="gap:12px;padding:12px 14px"><img src="icons/bp7-192.png" alt="" width="40" height="40" style="border-radius:10px;flex:none"><b style="flex:1;font-size:15px">Приложение на телефон</b><button class="pill" id="insty" style="background:var(--brand);color:#fff">Установить</button></div></div>`;
}
export function bindInstall() {
  const box = document.getElementById('inst'); if (!box) return; track('install_shown');
  box.querySelector('#insty').onclick = () => installNow(() => box.parentElement.remove());
}

// ---------- бета: заметная плашка и анкета «как прошла работа» перед выходом ----------
const SESSION_START = Date.now();
addEventListener('pagehide', () => { try { const prev = JSON.parse(localStorage.getItem('bp_sess') || 'null');
  const start = prev && prev.end > Date.now() - 20 * 60e3 ? prev.start : SESSION_START; // вернулся в течение 20 минут: та же сессия
  localStorage.setItem('bp_sess', JSON.stringify({ start, end: Date.now() })); } catch (e) {} });
const ISSUES = ['Камера не видела меня', 'Непонятно, что делать', 'Долго', 'Ошибки или зависания', 'Непонятен отчет', 'Ничего не мешало'];
/** Анкета беты: оценка, удалось ли сделать задуманное, что мешало, что изменить. then() вызывается после отправки или пропуска. */
export function exitSurvey(where = 'exit', then = null) {
  track('fb_sent', { c: 'exit_open' }, false);
  const pick = { s: 0, goal: null, issues: [] };
  const d = sheet(`<div class="eyebrow">Бета-версия</div><h2 style="font-size:22px;margin-top:6px">${where === 'return' ? 'Как прошла прошлая работа с приложением?' : 'Перед выходом: как все прошло?'}</h2>
    <p class="sub" style="font-size:14px;margin-top:6px">30 секунд. Ответы читает разработчик, по ним меняем приложение.</p>
    <b style="display:block;margin-top:16px">Оценка</b><div class="row" id="exs" style="gap:6px;margin-top:8px">${[1, 2, 3, 4, 5].map(n => `<button class="pill" data-s="${n}" style="flex:1;min-height:48px;font-size:18px">${n}</button>`).join('')}</div>
    <b style="display:block;margin-top:16px">Получилось сделать, что хотели?</b><div class="seg" style="margin-top:8px"><button data-g="yes">Да</button><button data-g="partly">Частично</button><button data-g="no">Нет</button></div>
    <b style="display:block;margin-top:16px">Что мешало?</b><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px">${ISSUES.map(t => `<button class="pill" data-i="${t}">${t}</button>`).join('')}</div>
    <textarea id="ext" class="field" rows="3" placeholder="Что добавить или изменить?" style="height:auto;padding:12px 16px;margin-top:14px"></textarea>
    <p id="exe" style="font-size:13px;color:var(--over-t);min-height:18px"></p>
    <button class="btn" id="exok">Отправить</button><button class="btn ghost" id="exno" style="margin-top:8px;border:0">Пропустить</button>`);
  const done = () => { d.remove(); if (then) then(); };
  d.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { pick.s = +b.dataset.s; d.querySelectorAll('[data-s]').forEach(x => { const on = +x.dataset.s <= pick.s; x.style.background = on ? 'var(--ink)' : ''; x.style.color = on ? '#fff' : ''; }); });
  d.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { pick.goal = b.dataset.g; d.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('on', x === b)); });
  d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const t = b.dataset.i, on = !pick.issues.includes(t); pick.issues = on ? [...pick.issues, t] : pick.issues.filter(x => x !== t); b.classList.toggle('on', on); });
  d.querySelector('#exno').onclick = () => { LS.set('bp_exit_at', String(Date.now())); done(); };
  d.querySelector('#exok').onclick = async () => { if (!pick.s) { d.querySelector('#exe').textContent = 'Поставьте оценку от 1 до 5'; return; }
    const b = d.querySelector('#exok'); b.disabled = true; b.textContent = 'Отправляю…'; const sess = JSON.parse(LS.get('bp_sess') || 'null');
    try { await sendFeedback({ k: 'exit', s: pick.s, t: d.querySelector('#ext').value.trim().slice(0, 2000), w: where, q: { goal: pick.goal, issues: pick.issues, sec: Math.round((Date.now() - SESSION_START) / 1000) } });
      LS.set('bp_exit_at', String(Date.now())); if (sess) LS.set('bp_sess_rated', String(sess.start)); toast('Спасибо! Это очень помогает'); done(); }
    catch (e) { b.disabled = false; b.textContent = 'Отправить'; d.querySelector('#exe').textContent = 'Не отправилось, попробуйте еще раз'; } };
}
/** Анкета после теста (бета и калибровка): как прошло, что мешало. Один раз на тест, открывается сама после результата. */
const TEST_ISSUES = ['Голос непонятный', 'Счет повторов сбивался', 'Камера не видела меня', 'Непонятно, что делать', 'Слишком долго', 'Зависло или ошибка', 'Было больно или неудобно', 'Результат не похож на правду'];
export function testSurvey(key, ctx = {}) {
  if (LS.get('bp_tfb_' + key)) return; LS.set('bp_tfb_' + key, '1'); track('fb_sent', { c: 'test_open' }, false);
  const pick = { s: 0, issues: [] };
  const d = sheet(`<div class="eyebrow">${ctx.cal ? 'Калибровка' : 'Бета-версия'}</div><h2 style="font-size:22px;margin-top:6px">Как прошел тест?</h2>
    <p class="sub" style="font-size:14px;margin-top:6px">30 секунд. Все замечания читает разработчик и правит приложение.</p>
    <b style="display:block;margin-top:16px">Оценка</b><div class="row" style="gap:6px;margin-top:8px">${[1, 2, 3, 4, 5].map(n => `<button class="pill" data-s="${n}" style="flex:1;min-height:48px;font-size:18px">${n}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub);margin:4px 4px 0"><span>плохо</span><span>отлично</span></div>
    <details id="tsiss" style="margin-top:12px"><summary style="font-weight:700">Что пошло не так?</summary><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px">${TEST_ISSUES.map(t => `<button class="pill" data-i="${t}">${t}</button>`).join('')}</div></details>
    <textarea id="tst" class="field" rows="3" maxlength="2000" placeholder="На каком шаге и что именно? Любые мелочи важны" style="height:auto;padding:12px 16px;margin-top:14px"></textarea>
    <p id="tse" style="font-size:13px;color:var(--over-t);min-height:18px"></p>
    <button class="btn" id="tsok">Отправить</button><button class="btn ghost" id="tsno" style="margin-top:8px;border:0">Пропустить</button>`);
  d.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { pick.s = +b.dataset.s; d.querySelectorAll('[data-s]').forEach(x => { const on = +x.dataset.s <= pick.s; x.style.background = on ? 'var(--ink)' : ''; x.style.color = on ? '#fff' : ''; }); d.querySelector('#tsiss').open = pick.s < 4; });
  d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const t = b.dataset.i, on = !pick.issues.includes(t); pick.issues = on ? [...pick.issues, t] : pick.issues.filter(x => x !== t); b.classList.toggle('on', on); });
  d.querySelector('#tsno').onclick = () => { track('fb_sent', { c: 'test_skip' }, false); d.remove(); };
  d.querySelector('#tsok').onclick = async () => { if (!pick.s) { d.querySelector('#tse').textContent = 'Поставьте оценку от 1 до 5'; return; }
    const b = d.querySelector('#tsok'); b.disabled = true; b.textContent = 'Отправляю…';
    try { await sendFeedback({ k: 'test', s: pick.s, t: d.querySelector('#tst').value.trim().slice(0, 2000), w: ctx.cal ? 'calib' : 'test', q: { issues: pick.issues, cal: !!ctx.cal, src: LS.get('bp_src') || '', steps: ctx.steps } });
      toast('Спасибо! Это очень помогает'); d.remove(); }
    catch (e) { b.disabled = false; b.textContent = 'Отправить'; d.querySelector('#tse').textContent = 'Не отправилось, попробуйте еще раз'; } };
}
/** Анкета специалиста (BP-17): польза для работы, будет ли использовать с клиентами, готовность платить. Клиенты видят свою анкету exitSurvey. */
const PRO_DONE = 'bp_prosv_done', PRO_AT = 'bp_prosv_at';
// сама открывается после теста, пока специалист не ответил; после «Позже» не чаще раза в 3 дня
export const proSurveyDue = () => !LS.get(PRO_DONE) && Date.now() - +(LS.get(PRO_AT) || 0) > 3 * 864e5;
export function proSurvey(where = 'menu', then = null) {
  if (document.querySelector('.sheet #psok')) return; LS.set(PRO_AT, String(Date.now())); track('fb_sent', { c: 'pro_open' }, false);
  const pick = { s: 0, use: '' }, area = (id, ph) => `<textarea id="${id}" class="field" rows="2" maxlength="2000" placeholder="${ph}" style="height:auto;padding:12px 16px;margin-top:8px"></textarea>`;
  const d = sheet(`<div class="eyebrow">Бета-версия · для специалистов</div><h2 style="font-size:22px;margin-top:6px">Оцените приложение</h2>
    <p class="sub" style="font-size:14px;margin-top:6px">2 минуты. Обязателен только вопрос 3, критикуйте смело: каждый ответ читаю сам.</p>
    <b style="display:block;margin-top:16px">1. Насколько приложение полезно для вашей работы?</b>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="pill" data-s="${n}" style="min-height:44px;font-size:17px;justify-content:center">${n}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub);margin:4px 4px 0"><span>бесполезно</span><span>очень полезно</span></div>
    <b style="display:block;margin-top:16px">2. Что было понятно, а что нет?</b>${area('psclear', 'Например: карта тела понятна, а что значит «Мягко укрепить», не ясно')}
    <b style="display:block;margin-top:16px">3. Будете использовать с клиентами?</b>
    <div class="seg" style="margin-top:8px"><button data-u="yes">Да</button><button data-u="maybe">Может быть</button><button data-u="no">Нет</button></div>${area('pswhy', 'Почему?')}
    <b style="display:block;margin-top:16px">4. Чего не хватило?</b>${area('psmiss', 'Функции, упражнения, данные в отчете…')}
    <b style="display:block;margin-top:16px">5. Готовы ли платить за такой инструмент? Сколько в месяц и за что?</b>${area('pspay', 'Например: 1000 ₽ в месяц, если будут ретесты и отчеты с моим логотипом')}
    <p id="pse" style="font-size:13px;color:var(--over-t);min-height:18px"></p>
    <button class="btn" id="psok">Отправить</button><button class="btn ghost" id="psno" style="margin-top:8px;border:0">Позже</button>`);
  const done = () => { d.remove(); if (then) then(); };
  d.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { pick.s = pick.s === +b.dataset.s ? 0 : +b.dataset.s; d.querySelectorAll('[data-s]').forEach(x => { const on = +x.dataset.s <= pick.s; x.style.background = on ? 'var(--ink)' : ''; x.style.color = on ? '#fff' : ''; }); });
  d.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { pick.use = b.dataset.u; d.querySelectorAll('[data-u]').forEach(x => x.classList.toggle('on', x === b)); d.querySelector('#pse').textContent = ''; });
  d.querySelector('#psno').onclick = () => { track('fb_sent', { c: 'pro_skip' }, false); done(); };
  d.querySelector('#psok').onclick = async () => { const e = d.querySelector('#pse');
    if (!pick.use) { e.textContent = 'Ответьте на вопрос 3: будете ли использовать с клиентами'; d.querySelector('[data-u]').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const v = id => d.querySelector(id).value.trim().slice(0, 2000), b = d.querySelector('#psok'); b.disabled = true; b.textContent = 'Отправляю…';
    try { await sendFeedback({ k: 'pro', s: pick.s || null, w: where, q: { use: pick.use, why: v('#pswhy'), clear: v('#psclear'), missing: v('#psmiss'), pay: v('#pspay') } });
      LS.set(PRO_DONE, String(Date.now())); toast('Спасибо! Ответ получен'); done(); }
    catch (err) { b.disabled = false; b.textContent = 'Отправить'; e.textContent = 'Не отправилось, проверьте интернет'; } };
}
/** Плашка беты сверху экрана (только в режиме «Бета»): видно, что это бета, и можно сразу оценить работу. */
export function mountBetaBar() {
  if (configSync().beta === false || document.getElementById('betabar')) return;
  const b = document.createElement('div'); b.id = 'betabar';
  b.innerHTML = `<span><b>Бета-версия</b> · все бесплатно</span><button id="betarate">Оценить работу</button>`;
  document.body.prepend(b); document.body.classList.add('beta');
  b.querySelector('#betarate').onclick = () => role() === 'pro' ? proSurvey('banner') : exitSurvey('banner');
  // вернулся после работы (2+ минуты) больше чем через 20 минут: один раз в день спрашиваем про прошлую сессию
  try { const s = JSON.parse(localStorage.getItem('bp_sess') || 'null'), lastAsk = +(LS.get('bp_exit_at') || 0);
    if (s && s.end - s.start > 120e3 && Date.now() - s.end > 20 * 60e3 && LS.get('bp_sess_rated') !== String(s.start) && Date.now() - lastAsk > 20 * 3600e3)
      setTimeout(() => { if (document.querySelector('.sheet') || document.querySelector('.cam')) return; if (role() !== 'pro') exitSurvey('return'); else if (proSurveyDue()) proSurvey('return'); }, 2500); } catch (e) {}
}
