// Ежедневная уборка по расписанию Vercel Cron (vercel.json → crons). Vercel присылает заголовок
// Authorization: Bearer <CRON_SECRET>, если переменная CRON_SECRET задана в настройках проекта.
import { cleanup } from './relay.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cs = process.env.CRON_SECRET;
  if (!cs || req.headers.authorization !== `Bearer ${cs}`) return res.status(401).json({ error: 'cron' });
  try { return res.status(200).json({ ok: true, deleted: await cleanup() }); }
  catch (e) { console.error('cron', e); return res.status(500).json({ error: 'server' }); }
}
