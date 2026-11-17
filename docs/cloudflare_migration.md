# Переезд BodyPassport с Vercel на Cloudflare (бесплатно)

Код уже готов (17.11.2026): `worker/index.js` запускает те же функции `api/` в Cloudflare Worker, сайт берется из `public/`, данные в R2 через привязку `DATA`, задачи по расписанию через Cron Triggers. Всё проверено локально (`wrangler dev`): страницы, заголовки безопасности, вход, ящик клиента (запись и чтение в R2), события, обе задачи по расписанию.

Что остается вам: 8 шагов в панели Cloudflare и у регистратора домена. Примерно час.

## Что бесплатно и где предел

| Что | Бесплатный тариф Cloudflare |
|---|---|
| Сайт: страницы, картинки, озвучка, 3D-модель | без ограничений, лимит запросов не тратит |
| Функции `/api/*`, модели `/models/*`, `/vendor/*` | 100 000 запросов в сутки, 10 мс работы процессора на запрос (ожидание сети не считается) |
| R2 (данные) | 10 ГБ хранения |
| Задачи по расписанию | 2 из 5 доступных |

Если упретесь в 10 мс (тяжелая статистика в «Администрировании» при большом числе событий), появится ошибка 1102. Тогда тариф Workers Paid, $5 в месяц, снимает ограничение.

Важно: в России провайдеры с 2025 года замедляют сайты на Cloudflare. Для клиентов из России приложение может грузиться плохо.

## Шаг 0. Перед переездом, пока сайт еще на Vercel

1. Откройте bodypassport.app → «Администрирование» → «Хранилище».
2. Если предлагает перенести данные из Vercel Blob в R2, нажмите «ОК» и дождитесь конца. После переезда Blob будет недоступен.
3. Откройте Vercel → проект bodypassport → Settings → Environment Variables. Перепишите значения переменных из списка в шаге 3: они понадобятся.

## Шаг 1. Создать Worker из GitHub

1. dash.cloudflare.com → Workers & Pages → Create → Import a repository (Workers).
2. Подключите GitHub, выберите репозиторий `RifatAF/rifat`.
3. Project name: `rifat` (так назван Worker в аккаунте; имя должно совпадать с `name` в `wrangler.jsonc`). Production branch: `main`.
4. Build command: `npm ci && node scripts/fetch-assets.mjs`
5. Deploy command: `npx wrangler deploy` (стоит по умолчанию).
6. Нажмите Deploy. Первая сборка 3–5 минут.

Привязка R2 `DATA` к бакету `bodypassport-data` и расписание задач берутся из `wrangler.jsonc` сами.

## Шаг 2. Проверить бакет R2

R2 → бакет `bodypassport-data` должен существовать в том же аккаунте (он уже используется с 13.11). Если имя другое, поправьте `bucket_name` в `wrangler.jsonc`.

## Шаг 3. Секреты

Worker `rifat` → Settings → Variables and Secrets → Add, тип Secret. Значения из Vercel:

Обязательные: `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_IDS`, `GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TG_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `LAVA_WEBHOOK_BASIC`, `LAVA_WEBHOOK_KEY`, `LAVA_PRODUCT_ID`.

Если заданы в Vercel, тоже перенесите: `LAVA_YEAR_PRODUCT_ID`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_API_VER`, `META_TEST_CODE`, `STATS_EXCLUDE`, `USD_RUB`, `EUR_RUB`, `RELAY_LEGACY_UNTIL`, `CLOUD_BACKUP`.

Не переносить: `BLOB_READ_WRITE_TOKEN`, `S3_KEY`, `S3_SECRET`, `STORE_PRIMARY`, `VERCEL_*`. В Worker данные идут в R2 напрямую, без ключей.

`SESSION_SECRET` должен совпасть с Vercel один в один, иначе всех выкинет из аккаунтов.

После секретов: Deployments → Retry deployment (или любой коммит в `main`).

## Шаг 4. Проверить на временном адресе

Откройте `https://rifat.<ваш-поддомен>.workers.dev`:
- главная и `/pricing` открываются;
- `.../api/auth?a=config` отдает JSON;
- `.../vendor/three/three.module.js` скачивается.

Вход через Google и Telegram на временном адресе не заработает: они привязаны к bodypassport.app. Это нормально.

## Шаг 5. Перенести домен в Cloudflare

1. Cloudflare → Add a domain → `bodypassport.app` → тариф Free.
2. Cloudflare покажет найденные DNS-записи. Проверьте, что есть записи почты (MX, TXT с SPF и DKIM для Resend). Без них письма с кодом входа перестанут доходить.
3. Удалите записи A и CNAME для `bodypassport.app` и `www`, которые ведут на Vercel (76.76.21.21, cname.vercel-dns.com).
4. У регистратора домена замените серверы имен на два, которые показал Cloudflare. Переключение от 10 минут до суток.

## Шаг 6. Привязать домен к Worker

Worker `rifat` → Settings → Domains & Routes → Add → Custom domain: `bodypassport.app`, затем так же `www.bodypassport.app`.

## Шаг 7. Проверка на bodypassport.app

- Вход через Google, Telegram и почту.
- Быстрый тест, сохранение, отчет.
- Онлайн-тест клиенту: ссылка, клиент отправил фото, результат пришел в кабинет.
- «Администрирование» → «Хранилище»: «Основное: S3 (Cloudflare R2…)».
- На следующий день: Worker → Logs, строки `cron /api/cron 200` и `cron /api/remind?a=cron 200`.

Вебхуки оплаты lava.top и бота Telegram менять не нужно: адреса на bodypassport.app те же.

## Шаг 8. Выключить Vercel

Через неделю без проблем: Vercel → проект → Settings → Git → Disconnect, затем удалить Blob store и перевести аккаунт на Hobby или удалить проект. Держите неделю как запасной путь.

## Откат

Вернуть DNS-записи на Vercel (A `76.76.21.21` для `bodypassport.app`, CNAME `cname.vercel-dns.com` для `www`) или удалить Custom domain у Worker и вернуть записи. Код совместим с обоими: Vercel продолжает собираться из того же `main`.

## Как устроено

- `worker/index.js`: маршруты `/api/*` → обработчики `api/*.js` через переходник req/res; `/models/*` и `/vendor/*` проксируются с Google и jsDelivr и кэшируются; остальное из `public/`.
- `public/_headers`: заголовки безопасности и кэша, собираются из `vercel.json` скриптом `scripts/fetch-assets.mjs`.
- `api/_store.js`: при привязке `DATA` пишет и читает R2 напрямую.
- `wrangler.jsonc`: имя, R2, расписание (`17 3 * * *` уборка, `0 12 * * *` напоминания), `nodejs_compat`.
- Локальная проверка: `node scripts/fetch-assets.mjs`, файл `.dev.vars` с `SESSION_SECRET=...` и `CRON_SECRET=...`, затем `npx wrangler dev --test-scheduled`.

Источники по лимитам: [лимиты Workers](https://developers.cloudflare.com/workers/platform/limits), [статика бесплатно и без ограничений](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations), [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration), [process.env в Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process).
