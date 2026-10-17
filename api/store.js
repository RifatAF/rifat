// Хранилище: состояние и перенос данных в резервные хранилища. Только администратор.
import { currentUser, isAdmin } from './_session.js';
import { storeInfo, copyBatch } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const u = await currentUser(req).catch(() => null); if (!isAdmin(u)) return res.status(403).json({ error: 'forbidden' });
  try {
    if (req.query.a === 'copy') { if (!storeInfo().mirrors.length) return res.status(400).json({ error: 'no mirror' }); return res.status(200).json(await copyBatch(req.query.cursor || undefined, 150)); }
    return res.status(200).json(storeInfo());
  } catch (e) { console.error('store', e); return res.status(500).json({ error: String(e.message || e) }); }
}
