// Страница тарифов: в бете цены и оплата скрыты, показана пометка о бете (режим переключает администратор)
fetch('/api/auth?a=config', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(c => {
  const beta = c.beta !== false;
  document.querySelectorAll('[data-paid]').forEach(el => { el.hidden = beta; });
  document.querySelectorAll('[data-beta]').forEach(el => { el.hidden = !beta; });
});
// «Назад» возвращает на прошлую страницу сайта; встроенный скрипт страницы блокирует CSP, поэтому здесь
document.getElementById('back').onclick = e => { if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) { e.preventDefault(); history.back(); } };
