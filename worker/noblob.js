// В Cloudflare Worker пакет @vercel/blob не нужен: данные в R2. Заглушка на случай, если STORE_PRIMARY=blob.
const no = () => { throw new Error('Vercel Blob недоступен в Cloudflare Worker'); };
export const put = no, get = no, list = no, del = no;
