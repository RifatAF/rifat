# Хранилище данных сервера

Сервер хранит JSON-файлы: аккаунты, ссылки клиентов (relay), калибровки, аналитику, напоминания, оплаты.
Код работает через `api/_store.js`: запись идет в основное хранилище и копией во все остальные, чтение из основного, при сбое из копии.

## Почему переполнялся Vercel Blob
Бесплатный Vercel Blob дает мало операций в месяц. Больше всего их тратят аналитика (каждая пачка событий отдельный файл), проверка новых результатов по ссылкам (list) и калибровки.

## Что подключить
**Cloudflare R2** (рекомендую основным): 10 ГБ и миллион записей в месяц бесплатно, скачивание бесплатно.
1. dash.cloudflare.com → R2 → Create bucket, имя `bodypassport-data`.
2. R2 → Manage API tokens → Create API token, права Object Read & Write на этот бакет. Сохранить Access Key ID и Secret.
3. Vercel → проект bodypassport → Settings → Environment Variables:
   - `S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_BUCKET` = `bodypassport-data`
   - `S3_KEY`, `S3_SECRET` = ключи из шага 2
   - `S3_REGION` = `auto`
4. Redeploy. С этого момента все новые записи идут и в Blob, и в R2.
5. Кабинет → Меню → Администрирование → «Хранилище: где лежат данные, копия» → скопировать старые данные.
6. Когда копия готова: `STORE_PRIMARY` = `s3` и Redeploy. Чтение пойдет из R2, Blob останется копией. Можно убрать `BLOB_READ_WRITE_TOKEN`, чтобы Blob больше не тратил лимит.

**Домашний сервер** (вторая копия): MinIO в Docker.
```
docker run -d --name minio -p 9000:9000 -v /data/minio:/data \
  -e MINIO_ROOT_USER=bodypassport -e MINIO_ROOT_PASSWORD=<длинный пароль> \
  quay.io/minio/minio server /data
```
Сервер должен быть доступен из интернета по HTTPS (Cloudflare Tunnel или белый IP с сертификатом). Создать бакет `bodypassport-data` и ключ доступа в консоли MinIO, затем в Vercel:
`BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_KEY`, `BACKUP_S3_SECRET`, `BACKUP_S3_REGION=us-east-1`.
Если домашний сервер выключен, запросы работают дальше, сбой копии пишется в лог.

## Проверено
Подпись запросов S3 (AWS Signature V4) сверена с эталонной библиотекой botocore; запись, чтение, список с курсором и удаление проверены на тестовом S3-сервере (moto).
