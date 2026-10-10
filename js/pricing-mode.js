// Страница тарифов: в бете цены и оплата скрыты, показана пометка о бете (режим переключает администратор)
fetch('/api/auth?a=config', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({})).then(c => {
  const beta = c.beta !== false;
  document.querySelectorAll('[data-paid]').forEach(el => { el.hidden = beta; });
  document.querySelectorAll('[data-beta]').forEach(el => { el.hidden = !beta; });
});
