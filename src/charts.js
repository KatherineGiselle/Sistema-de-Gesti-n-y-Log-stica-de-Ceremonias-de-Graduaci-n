// charts.js — Gráficas en SVG puro (sin librerías, funcionan sin internet).
(function () {
  const ITT = (window.ITT = window.ITT || {});
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Barras horizontales: data = [{label, value, color, titulo?}]
  function barrasHorizontales(containerId, data, opts = {}) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    if (!data.length || data.every((d) => !d.value && opts.ocultarVacio)) { cont.innerHTML = `<p class="empty-state">${esc(opts.vacio || "Sin datos para mostrar todavía.")}</p>`; return; }
    const width = 760, barH = 24, gap = 10, labelW = opts.labelWidth || 250, valW = 60;
    const chartW = width - labelW - valW - 10;
    const max = Math.max(...data.map((d) => d.value), 1);
    const height = data.length * (barH + gap);
    const filas = data.map((d, i) => {
      const y = i * (barH + gap), w = Math.max((d.value / max) * chartW, d.value > 0 ? 3 : 0);
      return `<g><title>${esc(d.titulo || d.label)}</title>
        <text x="${labelW - 10}" y="${y + barH / 2}" text-anchor="end" dominant-baseline="middle" class="chart-label">${esc(d.label)}</text>
        <rect x="${labelW}" y="${y}" width="${chartW}" height="${barH}" rx="4" class="chart-track"/>
        <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="4" fill="${d.color || "var(--disponible)"}"/>
        <text x="${labelW + chartW + 10}" y="${y + barH / 2}" dominant-baseline="middle" class="chart-value">${esc(d.valorTexto != null ? d.valorTexto : d.value)}</text></g>`;
    }).join("");
    cont.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" style="height:auto;max-height:${height + 4}px">${filas}</svg>`;
  }

  // Barras verticales: data = [{label, value, color}]
  function barrasVerticales(containerId, data, opts = {}) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    if (!data.length || data.every((d) => !d.value)) { cont.innerHTML = `<p class="empty-state">${esc(opts.vacio || "Aún no hay graduados registrados. Sube la lista en el módulo Graduados.")}</p>`; return; }
    const W = 520, H = 280, m = { l: 44, r: 12, t: 24, b: 38 };
    const cw = W - m.l - m.r, ch = H - m.t - m.b;
    const max = Math.max(...data.map((d) => d.value), 1);
    // Escala "bonita": paso entero tal que haya como máximo 5 divisiones
    const pw = Math.pow(10, Math.floor(Math.log10(max)));
    let step = 1;
    for (const f of [0.2, 0.5, 1, 2, 5, 10]) { const s = Math.max(f * pw, 1); if (Math.ceil(max / s) <= 5) { step = s; break; } }
    const ticks = Math.ceil(max / step), top = ticks * step;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const v = step * i, y = m.t + ch - (v / top) * ch;
      grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" class="chart-grid"/><text x="${m.l - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-axis">${v}</text>`;
    }
    const slot = cw / data.length, bw = Math.min(70, slot * 0.6);
    const barras = data.map((d, i) => {
      const h = (d.value / top) * ch, x = m.l + slot * i + (slot - bw) / 2, y = m.t + ch - h;
      return `<g><title>${esc(d.label)}: ${d.value}</title>
        <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 0)}" rx="4" fill="${d.color || "var(--disponible)"}"/>
        <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" class="chart-value">${d.value}</text>
        <text x="${x + bw / 2}" y="${H - m.b + 18}" text-anchor="middle" class="chart-label">${esc(d.label)}</text></g>`;
    }).join("");
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="height:auto">${grid}${barras}</svg>`;
  }

  ITT.charts = { barrasHorizontales, barrasVerticales };
})();
