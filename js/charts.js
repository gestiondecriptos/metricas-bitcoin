// Gráficos de líneas y espiral en SVG (sin librerías)
import { fmt, usd } from './format.js';

const day = t => new Date(t).toISOString().slice(0, 10);
const dateEs = t => new Date(t).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
export const thin = (pts, n = 500) => {
  if (pts.length <= n) return pts;
  const step = pts.length / n, out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts.at(-1));
  return out;
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const KIND = {
  usd: v => usd(v),
  eur: v => fmt(v, { style: 'currency', currency: 'EUR' }),
  idx: v => fmt(v, { maximumFractionDigits: 1 }),
  dec2: v => fmt(v, { maximumFractionDigits: 2 }),
};
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || Math.abs(hi) || 1, raw = span / (n - 1), mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const out = [];
  for (let k = Math.floor(lo / step); k <= Math.ceil(hi / step); k++) out.push(k * step);
  if (out.length < 2) out.push(out[0] + step);
  return out;
}

/** Marcas del eje Y en escala logarítmica: 1-2-5 por década (solo 1 por década si el rango es muy grande) */
function logTicks(lo, hi) {
  const a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi)), mult = Math.log10(hi / lo) <= 3.5 ? [1, 2, 5] : [1];
  const all = [];
  for (let e = a; e <= b; e++) for (const m of mult) all.push(m * 10 ** e);
  let i0 = 0, i1 = all.length - 1;
  all.forEach((v, i) => { if (v <= lo) i0 = i; });
  for (let i = all.length - 1; i >= 0; i--) if (all[i] >= hi) i1 = i;
  const out = all.slice(i0, i1 + 1);
  return out.length > 1 ? out : [10 ** a, 10 ** (a + 1)];
}
const chartWidth = () => Math.max(300, Math.min(640, Math.round((typeof innerWidth === 'number' ? innerWidth : 700) - 56)));
const axisLabel = v => (Math.abs(v) >= 1000 ? compact.format(v) : fmt(v, { maximumFractionDigits: v % 1 ? 2 : 0 }));

/**
 * Gráfico de líneas con eje Y, fechas en X y valor al pasar el cursor (Bitview, Métricas).
 * series: [{ label, color, pts: [[tiempoMs, valor|null], ...] }] · log: escala logarítmica · lines: [{ y, label }] líneas horizontales
 * domain: [min, max] fijo · kind: 'usd' | 'eur' | 'idx' | 'dec2' (formato del valor en el tooltip)
 */
export function lineChart({ series, log = false, lines = [], domain = null, height = 220, kind = 'idx', yfmt = null }) {
  const ok = v => Number.isFinite(v) && (!log || v > 0);
  const S = series.map(s => ({ ...s, good: s.pts.filter(p => Number.isFinite(p[0]) && ok(p[1])) }));
  const all = S.flatMap(s => s.good);
  if (all.length < 2) return '<div class="label p-6">Sin datos disponibles para este gráfico.</div>';
  const W = chartWidth(), H = height, PL = 52, PR = 10, PT = 8, PB = 20, tr = v => (log ? Math.log(v) : v);
  let t0 = Infinity, t1 = -Infinity, lo = Infinity, hi = -Infinity;
  for (const p of all) { t0 = Math.min(t0, p[0]); t1 = Math.max(t1, p[0]); lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
  if (domain) { lo = domain[0]; hi = domain[1]; }
  const ticks = log ? logTicks(Math.max(lo, 1e-9), hi) : niceTicks(lo, hi);
  const ya = tr(domain && !log ? lo : ticks[0]), yb = tr(domain && !log ? hi : ticks.at(-1));
  const X = t => PL + (t - t0) / (t1 - t0 || 1) * (W - PL - PR);
  const Y = v => H - PB - (Math.min(Math.max(tr(v), ya), yb) - ya) / (yb - ya || 1) * (H - PT - PB);
  const shown = ticks.filter(v => tr(v) >= ya - 1e-9 && tr(v) <= yb + 1e-9);
  const grid = shown.map(v => `<line x1="${PL}" x2="${W - PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#2d3142" stroke-width=".6"/><text x="${PL - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10">${axisLabel(v)}</text>`).join('');
  const xl = [0, 1 / 3, 2 / 3, 1].map((f, i) => `<text x="${X(t0 + f * (t1 - t0)).toFixed(1)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}" fill="#94a3b8" font-size="10">${day(t0 + f * (t1 - t0))}</text>`).join('');
  const paths = S.map(s => {
    let d = '', pen = false;
    for (const [t, v] of s.pts) {
      if (!Number.isFinite(t) || !ok(v)) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`; pen = true;
    }
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linejoin="round"/>`;
  }).join('');
  const hl = lines.filter(l => ok(l.y)).map(l =>
    `<line x1="${PL}" x2="${W - PR}" y1="${Y(l.y).toFixed(1)}" y2="${Y(l.y).toFixed(1)}" stroke="#64748b" stroke-dasharray="4 4"/><text x="${W - PR - 2}" y="${(Y(l.y) - 3).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10">${l.label}</text>`).join('');
  const marks = `<line class="ct-v" y1="${PT}" y2="${H - PB}" stroke="#64748b" stroke-dasharray="3 3" visibility="hidden"/>`
    + S.map((s, i) => `<circle class="ct-m" data-i="${i}" r="4" fill="${s.color}" stroke="#0b0d16" stroke-width="1.5" visibility="hidden"/>`).join('');
  const data = { W, H, PL, PR, PT, PB, t0, t1, y0: ya, y1: yb, log, kind, rk: null, time: false, s: S.map(s => ({ l: s.label, c: s.color, p: s.good.map(p => [p[0], +p[1].toPrecision(7)]) })) };
  const yf = yfmt || KIND[kind] || KIND.idx;
  const legend = S.map(s => `<span><i style="display:inline-block;width:.6rem;height:.2rem;background:${s.color}"></i> ${s.label}</span>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="ct w-full" style="touch-action:pan-y" role="img" aria-label="${esc(S.map(s => s.label).join(', '))}" data-ct="${esc(JSON.stringify(data))}">${grid}${hl}${xl}${paths}${marks}</svg>
    <div class="num mt-1 text-xs text-slate-400">mín ${yf(lo)} · máx ${yf(hi)}${log ? ' · escala log' : ''}</div>
    <div class="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-400">${legend}</div>`;
}

/**
 * Gráfico en espiral de Bitcoin: cada vuelta completa = 4 años, radio logarítmico (10$ a 1M$),
 * halo de zona del ciclo, puntos de halving (verde), mínimos de ciclo (rojo) y máximos históricos (blanco).
 */
export function spiralChart({ pts, halvings = [], cycleLows = [], aths = [], zoneAt = null, size = 440 }) {
  const valid = (pts || []).filter(p => Number.isFinite(p.t) && Number.isFinite(p.price) && p.price > 0);
  if (valid.length < 2) return '<div class="label p-6">Sin datos disponibles para la espiral.</div>';

  const W = size, H = size, cx = W / 2, cy = H / 2;
  const rMin = W * 0.06, rMax = W * 0.39;
  const YEAR_MS = 365.25 * 864e5;
  const CYCLE_MS = 4 * YEAR_MS;
  const EPOCH0 = Date.UTC(2009, 0, 1);

  const logLevels = [
    { val: 10, label: '10 $' },
    { val: 100, label: '100 $' },
    { val: 1000, label: '1K $' },
    { val: 10000, label: '10K $' },
    { val: 100000, label: '100K $' },
    { val: 1000000, label: '1M $' },
  ];
  const eMin = 1, eMax = 6; // log10(10) = 1 .. log10(1,000,000) = 6
  const radiusOf = price => {
    const e = Math.log10(Math.max(price, 1));
    const norm = Math.max(0, Math.min(1.08, (e - eMin) / (eMax - eMin)));
    return rMin + norm * (rMax - rMin);
  };
  const angleOf = t => -Math.PI / 2 + ((t - EPOCH0) / CYCLE_MS) * Math.PI * 2;
  const xyOf = (t, price) => {
    const a = angleOf(t), r = radiusOf(price);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a), r, a];
  };

  // Círculos concéntricos y etiquetas de precio en el eje horizontal derecho (ángulo = 0)
  const rings = logLevels.map(lv => {
    const r = radiusOf(lv.val);
    const lx = cx + r + 3, ly = cy - 4;
    return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="#2d3142" stroke-width=".75" stroke-dasharray="${lv.val === 100 || lv.val === 10000 ? 'none' : '2 3'}"/>`
      + `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#94a3b8" font-size="8.5" font-family="JetBrains Mono, monospace">${lv.label}</text>`;
  }).join('');

  // Ejes cardinales de 4 años: arriba (2009·'13·'17·'21·'25), derecha (2010·'14·'18·'22·'26), abajo (2011·'15·'19·'23·'27), izquierda (2012·'16·'20·'24·'28)
  const axisR = rMax + 16;
  const axes = `
    <line x1="${cx}" y1="${cy - axisR + 6}" x2="${cx}" y2="${cy + axisR - 6}" stroke="#2d3142" stroke-width=".7"/>
    <line x1="${cx - axisR + 6}" y1="${cy}" x2="${cx + axisR - 6}" y2="${cy}" stroke="#2d3142" stroke-width=".7"/>
    <text x="${cx}" y="${cy - axisR - 4}" text-anchor="middle" fill="#cbd5e1" font-size="9.5" font-weight="600">2009 · '13 · '17 · '21 · '25</text>
    <text x="${cx + axisR + 4}" y="${cy + 3}" text-anchor="start" fill="#cbd5e1" font-size="9.5" font-weight="600">2010 · '14 · '18 · '22 · '26</text>
    <text x="${cx}" y="${cy + axisR + 12}" text-anchor="middle" fill="#cbd5e1" font-size="9.5" font-weight="600">2011 · '15 · '19 · '23 · '27</text>
    <text x="${cx - axisR - 4}" y="${cy + 3}" text-anchor="end" fill="#cbd5e1" font-size="9.5" font-weight="600">2012 · '16 · '20 · '24 · '28</text>
  `;

  // Enriquecer puntos con zona del ciclo para halo y tooltip
  const enriched = valid.map(p => {
    const z = zoneAt ? zoneAt(p.t) : null;
    return {
      t: p.t,
      price: p.price,
      zoneKey: z?.key || 'up',
      zoneLabel: z?.label || 'Ciclo',
      zoneColor: z?.color || '#38bdf8',
    };
  });

  // Halo / sombreado de zona del ciclo agrupado en tramos contiguos
  const haloSegs = [];
  for (let i = 1; i < enriched.length; i++) {
    const prev = enriched[i - 1], cur = enriched[i];
    const [x1, y1] = xyOf(prev.t, prev.price);
    const [x2, y2] = xyOf(cur.t, cur.price);
    const segStr = `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`;
    const last = haloSegs.at(-1);
    if (last && last.color === cur.zoneColor) {
      last.d += `L${x2.toFixed(1)},${y2.toFixed(1)}`;
    } else {
      haloSegs.push({ color: cur.zoneColor, d: segStr });
    }
  }
  const haloPaths = haloSegs.map(s =>
    `<path d="${s.d}" fill="none" stroke="${s.color}" stroke-width="6.5" stroke-opacity=".22" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join('');

  // Línea principal de precio BTC en espiral
  const spiralD = enriched.map((p, i) => {
    const [x, y] = xyOf(p.t, p.price);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('');
  const pricePath = `<path d="${spiralD}" fill="none" stroke="#f7931a" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round"/>`;

  // Puntos blancos: máximos históricos (ATH)
  const athDots = (aths || []).filter(a => Number.isFinite(a.t) && Number.isFinite(a.price) && a.price > 0).map(a => {
    const [x, y] = xyOf(a.t, a.price);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.7" fill="#ffffff" stroke="#0b0d16" stroke-width=".9"/>`;
  }).join('');

  // Puntos rojos: mínimos de ciclo
  const lowDots = (cycleLows || []).filter(m => Number.isFinite(m.t) && Number.isFinite(m.price) && m.price > 0).map(m => {
    const [x, y] = xyOf(m.t, m.price);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="#ef4444" stroke="#0b0d16" stroke-width="1.1"/>`;
  }).join('');

  // Puntos verdes: halvings
  const halvingDots = (halvings || []).filter(h => Number.isFinite(h.t) && Number.isFinite(h.price) && h.price > 0).map(h => {
    const [x, y] = xyOf(h.t, h.price);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#22c55e" stroke="#0b0d16" stroke-width="1.1"/>`;
  }).join('');

  // Marcador activo al pasar el cursor
  const hoverMark = `<circle class="sp-m" r="5" fill="#f7931a" stroke="#ffffff" stroke-width="1.5" visibility="hidden"/>`;

  // Submuestrear para tooltip rápido sin perder precisión
  const tipPts = thin(enriched, 420).map(p => {
    const [x, y] = xyOf(p.t, p.price);
    return [+x.toFixed(1), +y.toFixed(1), p.t, +p.price.toFixed(2), p.zoneLabel, p.zoneColor];
  });
  const meta = JSON.stringify({ cx, cy, rMin, rMax, eMin, eMax, EPOCH0, CYCLE_MS, p: tipPts });

  const legend = `
    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
      <span><i style="display:inline-block;width:.75rem;height:.2rem;background:#f7931a;vertical-align:middle"></i> Bitcoin</span>
      <span><i style="display:inline-block;width:.55rem;height:.55rem;border-radius:50%;background:#22c55e;vertical-align:middle"></i> Halvings</span>
      <span><i style="display:inline-block;width:.55rem;height:.55rem;border-radius:50%;background:#ef4444;vertical-align:middle"></i> Mínimos de ciclo</span>
      <span><i style="display:inline-block;width:.55rem;height:.55rem;border-radius:50%;background:#ffffff;vertical-align:middle"></i> Máximos históricos</span>
      <span class="label">Cada vuelta = 4 años · Halo = zona del ciclo</span>
    </div>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="sp-chart mx-auto w-full" style="max-width:${size}px;touch-action:pan-y" role="img" aria-label="Espiral de precio de Bitcoin cada 4 años" data-sp="${esc(meta)}">${rings}${axes}${haloPaths}${pricePath}${athDots}${lowDots}${halvingDots}${hoverMark}</svg>${legend}`;
}

/** Tooltip global: gráficos «svg.ct», espiral «svg.sp-chart» y cualquier elemento con data-tip. Llamar una sola vez al arrancar. */
export function initChartTips() {
  if (typeof document === 'undefined' || document.getElementById('ct-tip')) return;
  const tip = document.createElement('div');
  tip.id = 'ct-tip';
  tip.style.cssText = 'position:fixed;z-index:60;pointer-events:none;display:none;background:#0b0d16;border:1px solid #2d3142;border-radius:6px;padding:6px 10px;font-size:.8rem;line-height:1.35;white-space:nowrap';
  document.body.appendChild(tip);
  const cache = new WeakMap();
  let shown = null;
  const place = (x, y) => {
    tip.style.display = 'block';
    tip.style.left = Math.max(4, Math.min(x + 14, innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = Math.max(4, Math.min(y + 14, innerHeight - tip.offsetHeight - 8)) + 'px';
  };
  const hide = () => {
    tip.style.display = 'none';
    if (shown) {
      shown.querySelectorAll('.ct-v,.ct-m,.sp-m').forEach(e => e.setAttribute('visibility', 'hidden'));
      shown = null;
    }
  };
  const spiralTip = (svg, e) => {
    let c = cache.get(svg);
    if (!c) { try { c = JSON.parse(svg.dataset.sp); } catch { return; } cache.set(svg, c); }
    const vb = svg.viewBox.baseVal;
    const W = vb && vb.width ? vb.width : 440, H = vb && vb.height ? vb.height : 440;
    const r = svg.getBoundingClientRect();
    const sx = (e.clientX - r.left) / (r.width || 1) * W;
    const sy = (e.clientY - r.top) / (r.height || 1) * H;
    let best = null, bd = Infinity;
    for (const pt of c.p) {
      const dist = Math.hypot(pt[0] - sx, pt[1] - sy);
      if (dist < bd) { bd = dist; best = pt; }
    }
    if (!best || bd > 42) { hide(); return; }
    if (shown && shown !== svg) hide();
    shown = svg;
    const m = svg.querySelector('.sp-m');
    if (m) { m.setAttribute('cx', best[0]); m.setAttribute('cy', best[1]); m.setAttribute('fill', best[5] || '#f7931a'); m.setAttribute('visibility', 'visible'); }
    tip.innerHTML = `<div class="label">${dateEs(best[2])}</div>`
      + `<div>Precio: <b class="num">${usd(best[3])}</b></div>`
      + `<div>Zona: <b style="color:${best[5] || '#38bdf8'}">${esc(best[4])}</b></div>`;
    place(e.clientX, e.clientY);
  };
  const chartTip = (svg, e) => {
    let c = cache.get(svg);
    if (!c) { try { c = JSON.parse(svg.dataset.ct); } catch { return; } cache.set(svg, c); }
    const r = svg.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * c.W;
    if (cx < c.PL || cx > c.W - c.PR) { hide(); return; }
    const tt = c.t0 + (cx - c.PL) / (c.W - c.PL - c.PR) * (c.t1 - c.t0);
    const X = t => c.PL + (t - c.t0) / (c.t1 - c.t0 || 1) * (c.W - c.PL - c.PR);
    const tr = v => (c.log ? Math.log(v) : v);
    const Y = v => c.H - c.PB - (Math.min(Math.max(tr(v), c.y0), c.y1) - c.y0) / (c.y1 - c.y0 || 1) * (c.H - c.PT - c.PB);
    if (shown && shown !== svg) hide();
    shown = svg;
    let head = null, rows = '';
    c.s.forEach((s, i) => {
      let bp = null, bd = Infinity;
      for (const p of s.p) { const d = Math.abs(p[0] - tt); if (d < bd) { bd = d; bp = p; } }
      if (!bp) return;
      if (head == null) head = bp[0];
      rows += `<div><i style="display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:${s.c}"></i> ${s.l}: <b class="num">${KIND[c.kind](bp[1])}</b>${bp[2] != null && c.rk ? ` · <span class="num">${KIND[c.rk](bp[2])}</span>` : ''}</div>`;
      const m = svg.querySelector(`.ct-m[data-i="${i}"]`);
      if (m) { m.setAttribute('cx', X(bp[0]).toFixed(1)); m.setAttribute('cy', Y(bp[1]).toFixed(1)); m.setAttribute('visibility', 'visible'); }
    });
    if (head == null) return;
    const v = svg.querySelector('.ct-v');
    if (v) { v.setAttribute('x1', X(head).toFixed(1)); v.setAttribute('x2', X(head).toFixed(1)); v.setAttribute('visibility', 'visible'); }
    tip.innerHTML = `<div class="label">${c.time ? new Date(head).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : day(head)}</div>${rows}`;
    place(e.clientX, e.clientY);
  };
  const onMove = e => {
    const t = e.target instanceof Element ? e.target : null;
    const sp = t && t.closest('svg.sp-chart');
    if (sp) { spiralTip(sp, e); return; }
    const svg = t && t.closest('svg.ct');
    if (svg) { chartTip(svg, e); return; }
    const el = t && t.closest('[data-tip]');
    hide();
    if (el) { tip.innerHTML = el.dataset.tip; place(e.clientX, e.clientY); }
  };
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onMove, { passive: true });
  document.addEventListener('scroll', hide, true);
}
