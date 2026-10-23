// Дизайн-система. «matte» (Apple Matte, с 24.10.2026): матовый графит, голубой акцент, Inter и JetBrains Mono для чисел.
// «v3»: прежний вид. Откат: галочка «Новый дизайн» в «Администрировании» (bp_ds = v3) или DEFAULT ниже; новый вид живет
// в отдельном блоке стилей html[data-ds=matte], поэтому без флага приложение выглядит ровно как раньше.
const DEFAULT = 'matte';
const saved = (() => { try { return localStorage.getItem('bp_ds'); } catch (e) { return null; } })();
export const DS = saved === 'v3' || saved === 'matte' ? saved : DEFAULT;
if (typeof document !== 'undefined') document.documentElement.dataset.ds = DS;
export const matte = () => DS === 'matte';
export function setDS(v) { try { localStorage.setItem('bp_ds', v); } catch (e) {} location.reload(); }
