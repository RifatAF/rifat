// Рост продукта: отзывы, «порекомендуете ли» (NPS), приглашение коллег, установка на экран телефона.
import { meSync } from './auth.js';
import { track } from './track.js';
import { toast } from './core.js';

const esc = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
const role = () => localStorage.getItem('bp_mode') === 'pro' ? 'pro' : 'client';
const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
export const VERSION = '2026-10-07';

export async function sendFeedback(fb) {
  const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fb, r: role(), v: VERSION }) });
  if (!r.ok) throw new Error(r.status); track('fb_sent', { s: fb.s ?? -1, c: fb.k }, false);
}

function sheet(html) {
  const d = document.createElement('div'); d.className = 'sheet'; d.innerHTML = `<div>${html}</div>`;
  document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); }; return d;
}
const contactBox = () => meSync() ? `<label class="row" style="margin-top:12px;font-size:14px;align-items:flex-start;gap:10px"><input type="checkbox" id="fbc" style="width:20px;height:20px;flex:none;accent-color:var(--ink);margin-top:1px"><span>Можно со мной связаться (${esc(meSync().name)})</span></label>` : '';

/** Свободный отзыв или идея: из меню и настроек. */
export function feedbackSheet(where = 'menu', preset = {}) {
  const d = sheet(`<h2 style="font-size:21px">Отзыв или идея</h2>
    <p class="sub" style="font-size:14px;margin-top:6px">Что понравилось, что неудобно, чего не хватает. Читаю каждый отзыв лично. Рифат Аюпов, автор методики.</p>
    <textarea id="fbt" rows="5" maxlength="2000" placeholder="Например: не понял, куда встать на втором шаге…" style="width:100%;margin-top:14px;border-radius:16px;border:1px solid var(--line);padding:12px 14px;font:16px Onest;background:#fff;resize:vertical">${esc(preset.t || '')}</textarea>
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

/** Оценка результата одним касанием (клиент, под картой). Один раз на тест. */
export function rateCard(key) {
  if (LS.get('bp_rate_' + key)) return '';
  return `<div class="card" id="rate" data-key="${esc(key)}" style="text-align:center;padding:16px"><b style="font-size:16px">Насколько полезен результат?</b>
    <div class="row" style="justify-content:center;gap:8px;margin-top:12px">${[1, 2, 3, 4, 5].map(n => `<button data-rate="${n}" aria-label="${n} из 5" style="width:48px;height:48px;border-radius:14px;border:1px solid var(--line);background:#fff;font:600 18px Onest;color:var(--text);cursor:pointer">${n}</button>`).join('')}</div>
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
    <div style="display:grid;grid-template-columns:repeat(11,1fr);gap:4px;margin-top:12px">${Array.from({ length: 11 }, (_, n) => `<button data-nps="${n}" aria-label="${n} из 10" style="height:44px;border-radius:10px;border:1px solid var(--line);background:#fff;font:600 14px Onest;color:var(--text);padding:0;cursor:pointer">${n}</button>`).join('')}</div>
    <div class="row" style="justify-content:space-between;font-size:12px;color:var(--sub);margin-top:6px"><span>точно нет</span><span>точно да</span></div>
    <button id="npsx" style="margin-top:8px;background:none;border:0;font:500 13px Onest;color:var(--sub);text-decoration:underline;padding:6px 0">Не сейчас</button></div></div>`;
}
export function bindNps() {
  const box = document.getElementById('nps'); if (!box) return;
  box.querySelector('#npsx').onclick = () => { LS.set('bp_nps', String(Date.now())); box.parentElement.remove(); };
  box.querySelectorAll('[data-nps]').forEach(b => b.onclick = () => { const s = +b.dataset.nps; LS.set('bp_nps', String(Date.now()));
    sendFeedback({ k: 'nps', s, w: 'home' }).catch(() => {});
    box.innerHTML = s >= 9 ? `<b style="font-size:16px">Спасибо! Пригласите коллегу</b><p class="sub" style="font-size:14px;margin-top:4px">За каждого коллегу, который начнет работать в кабинете, вам +1 месяц Про после беты.</p><button class="btn" id="npsref" style="margin-top:12px;height:48px">Пригласить коллегу</button>`
      : `<b style="font-size:16px">Спасибо! Что мешает поставить 10?</b><button class="btn" id="npsmore" style="margin-top:12px;height:48px">Написать</button>`;
    const r = document.getElementById('npsref'); if (r) r.onclick = referralSheet;
    const m = document.getElementById('npsmore'); if (m) m.onclick = () => feedbackSheet('home', { k: 'nps', s, t: '' }); });
}

// ссылка с кодом приглашения: у вошедшего свой код, иначе ссылка без кода
export const myRef = () => (meSync() && meSync().refCode) || '';
export const appLink = () => location.origin + '/' + (myRef() ? '?ref=' + myRef() : '');
export async function shareApp() {
  const url = appLink(), text = 'Тест движения по камере телефона за 3 минуты: карта мышц и что укрепить, растянуть, расслабить. Бесплатно.';
  track('ref_share', { c: 'client' }, false);
  if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url).catch(() => {}); toast('Ссылка скопирована'); }
}

/** Приглашение коллег-специалистов: ссылка с кодом, счетчик и бонус. */
export function referralSheet() {
  const u = meSync();
  if (!u || !u.refCode) { sheet('<h2 style="font-size:21px">Пригласить коллегу</h2><p class="sub" style="margin-top:8px">Войдите в кабинет, чтобы получить личную ссылку.</p><button class="btn" id="rfx" style="margin-top:16px">Понятно</button>').querySelector('#rfx').onclick = e => e.target.closest('.sheet').remove(); return; }
  const months = Math.round((u.refBonusDays || 0) / 30), url = location.origin + '/?ref=' + u.refCode;
  const d = sheet(`<div class="eyebrow">Реферальная программа</div><h2 style="font-size:22px;margin-top:6px">Пригласите коллегу, получите месяц Про</h2>
    <p class="sub" style="font-size:14px;margin-top:8px">За каждого специалиста, который зайдет по вашей ссылке и откроет кабинет, вам +1 месяц Про после окончания беты. До 12 месяцев.</p>
    <div class="kpi" style="margin-top:14px"><div><b>${u.invited || 0}</b><span>пришли по ссылке</span></div><div><b>${u.invitedPro || 0}</b><span>специалистов</span></div><div><b style="color:var(--ok-t)">+${months}</b><span>мес. Про</span></div></div>
    <div class="card row" style="margin-top:12px;padding:12px 14px"><span style="flex:1;font-size:14px;word-break:break-all">${esc(url)}</span></div>
    <button class="btn" id="rfs" style="margin-top:12px">Отправить ссылку</button><button class="btn ghost" id="rfx" style="margin-top:8px;border:0">Закрыть</button>`);
  d.querySelector('#rfx').onclick = () => d.remove();
  d.querySelector('#rfs').onclick = async () => { track('ref_share', { c: 'pro' }, false);
    const text = 'Пользуюсь BodyPassport: видеотест движения по камере телефона, карта мышц, гипотеза и отчет клиенту за 3 минуты. В бете Про бесплатно.';
    if (navigator.share) await navigator.share({ text, url }).catch(() => {}); else { await navigator.clipboard.writeText(text + ' ' + url).catch(() => {}); toast('Ссылка скопирована'); } };
}

// установка на главный экран: Android/Chrome дает событие, iOS Safari только через «Поделиться»
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { track('install_ok'); LS.set('bp_inst', 'done'); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const iOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
export function installCard() {
  if (standalone() || LS.get('bp_inst') || (!deferred && !iOS()) || (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)) return '';
  return `<div class="pad" style="margin-top:16px"><div class="card row" id="inst" style="gap:12px"><img src="icons/icon-192.png" alt="" width="44" height="44" style="border-radius:12px;flex:none"><div style="flex:1;min-width:0"><b style="font-size:15px">Установить на экран</b><div style="font-size:13px;color:var(--sub)">Открывается как приложение, без браузера</div></div><button class="pill" id="insty" style="background:var(--ink);color:#fff;border:0">Установить</button><button id="instx" aria-label="Скрыть" style="background:none;border:0;font-size:20px;color:var(--faint);width:32px;height:44px">×</button></div></div>`;
}
export function bindInstall() {
  const box = document.getElementById('inst'); if (!box) return; track('install_shown');
  box.querySelector('#instx').onclick = () => { LS.set('bp_inst', 'no'); box.parentElement.remove(); };
  box.querySelector('#insty').onclick = async () => {
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r && r.outcome === 'accepted') { LS.set('bp_inst', 'done'); box.parentElement.remove(); } return; }
    sheet('<h2 style="font-size:21px">Установить на iPhone</h2><ol style="margin:12px 0 0 20px;line-height:1.7;font-size:15px"><li>Нажмите «Поделиться» внизу Safari (квадрат со стрелкой)</li><li>Выберите «На экран Домой»</li><li>Нажмите «Добавить»</li></ol><button class="btn" id="iox" style="margin-top:16px">Понятно</button>').querySelector('#iox').onclick = e => { LS.set('bp_inst', 'ios'); e.target.closest('.sheet').remove(); box.parentElement.remove(); };
  };
}
