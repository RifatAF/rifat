// Ежедневная уборка по расписанию Vercel Cron (vercel.json → crons). Vercel присылает заголовок
// Authorization: Bearer <CRON_SECRET>, если переменная CRON_SECRET задана в настройках проекта.
import { cleanup } from './relay.js';
import { autoLearn } from './_autolearn.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cs = process.env.CRON_SECRET;
  if (!cs || req.headers.authorization !== `Bearer ${cs}`) return res.status(401).json({ error: 'cron' });
  try { const deleted = await cleanup();
    // автоматическая калибровка по накопленным проверкам специалистов; ее сбой не мешает уборке
    let learn = null; try { learn = await autoLearn(process.env.VERCEL_PROJECT_PRODUCTION_URL || req.headers.host); } catch (e) { console.error('autolearn', e); learn = { error: String(e.message || e) }; }
    return res.status(200).json({ ok: true, deleted, learn }); }
  catch (e) { console.error('cron', e); return res.status(500).json({ error: 'server' }); }
}
