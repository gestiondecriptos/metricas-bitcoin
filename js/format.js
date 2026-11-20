// Utilidades de formato usadas por la vista de métricas
export const fmt = (n, o) => n.toLocaleString('es-ES', o);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const usd = n => fmt(n, { style: 'currency', currency: 'USD' });
export const pct = (n, d = 1) => fmt(n, { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
export const cls = n => (n < 0 ? 'neg' : '');
