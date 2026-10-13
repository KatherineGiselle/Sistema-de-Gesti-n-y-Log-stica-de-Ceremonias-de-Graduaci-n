// qr-utils.js — Dibuja códigos QR (SVG) y arma las hojas imprimibles por carrera.
// ⚠️ El CONTENIDO del QR (token único y seguro) lo genera/valida el backend; aquí solo se dibuja.
(function () {
  const ITT = (window.ITT = window.ITT || {});
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function matriz(texto) {
    const lib = typeof qrcode !== "undefined" ? qrcode : global.qrcode;
    const qr = lib(0, "M"); qr.addData(String(texto)); qr.make();
    const n = qr.getModuleCount(); const m = [];
    for (let r = 0; r < n; r++) { const fila = []; for (let c = 0; c < n; c++) fila.push(qr.isDark(r, c)); m.push(fila); }
    return m;
  }

  // SVG compacto: un solo <path> con tramos horizontales unidos. quiet = zona blanca alrededor.
  function svg(texto, { quiet = 2 } = {}) {
    const m = matriz(texto); const n = m.length; let d = "";
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (!m[r][c]) { c++; continue; }
        let k = c; while (k < n && m[r][k]) k++;
        d += `M${c + quiet} ${r + quiet}h${k - c}v1h-${k - c}z`; c = k;
      }
    }
    const t = n + quiet * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  function htmlTarjetas({ evento, carrera, items }) {
    const tarjetas = items.map((it) => {
      const g = it.graduado;
      const esAlumno = it.tipo === "alumno";
      const badge = esAlumno ? "ALUMNO" : `INVITADO ${it.indice} DE ${it.totalInvitados}`;
      const linea1 = esAlumno ? g.nombreCompleto : `Invitado de: ${g.nombreCompleto}`;
      const asiento = esAlumno ? (g.fila ? `Asiento ${esc(g.fila)}${esc(g.asiento)} · ` : "Sin asiento · ") : "";
      return `<div class="card ${esAlumno ? "alumno" : "invitado"}">
        <div class="badge">${esc(badge)}</div>
        <div class="qr">${svg(it.token)}</div>
        <div class="nombre">${esc(linea1)}</div>
        <div class="meta">${asiento}${esc(g.carrera)}</div>
        <div class="meta">${esc(evento.nombre)}</div>
        <div class="tok">${esc(it.token)}</div>
      </div>`;
    }).join("");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>QR — ${esc(carrera)}</title><style>
@page { size: Letter; margin: 10mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; }
h1 { font-size: 13pt; margin: 0 0 1mm; } .sub { font-size: 9pt; color: #555; margin: 0 0 4mm; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.card { border: 0.3mm solid #999; border-radius: 2mm; padding: 2.5mm; text-align: center; height: 56mm; overflow: hidden;
  break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.badge { font-size: 7.5pt; font-weight: bold; letter-spacing: .4px; padding: .6mm 2.5mm; border-radius: 10mm; color: #fff; }
.alumno .badge { background: #17233d; } .invitado .badge { background: #b5701f; }
.qr { width: 29mm; height: 29mm; } .qr svg { width: 100%; height: 100%; display: block; }
.nombre { font-size: 8pt; font-weight: bold; line-height: 1.15; max-height: 9.5mm; overflow: hidden; }
.meta { font-size: 6.5pt; color: #444; line-height: 1.15; max-height: 7.5mm; overflow: hidden; }
.tok { font-family: "Courier New", monospace; font-size: 6pt; color: #777; }
</style></head><body>
<h1>Códigos QR de acceso — ${esc(carrera)}</h1>
<p class="sub">${esc(evento.nombre)} · ${items.length} códigos · Cada QR es de un solo uso</p>
<div class="grid">${tarjetas}</div></body></html>`;
  }

  ITT.qr = { svg, matriz, htmlTarjetas, esc };
  if (typeof module === "object" && module.exports) module.exports = ITT.qr;
})();
