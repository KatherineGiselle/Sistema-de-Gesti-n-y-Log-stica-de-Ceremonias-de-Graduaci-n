// ui-seatmap.js — Dibuja el mapa de butacas del Teatro Calafornix (compartido por Inicio y Asientos).
const SeatMap = {
  // Devuelve el HTML de los 3 bloques (izquierda, centro, derecha) con la numeración real del plano
  html() {
    const L = ITT.layout;
    const porAsiento = new Map(App.graduados.filter((g) => g.fila).map((g) => [g.fila + g.asiento, g]));
    const porCarrera = App.vistaMapa === "carreras";
    const bloque = (nombre) => {
      const filas = L.bloques[nombre].map((f) => {
        const seats = f.asientos.map((a) => {
          let cls = "seat", style = "", titulo = "";
          if (a.categoria !== "general") {
            const nom = App.reservados[a.key];
            cls += " reservado" + (nom ? " con-nombre" : "");
            titulo = `${a.key} — ${L.CATEGORIAS[a.categoria]}: ${nom || "sin nombre asignado"}`;
          } else if (porAsiento.has(a.key)) {
            const g = porAsiento.get(a.key);
            cls += " ocupado" + (g.presente ? " presente" : "");
            if (porCarrera) style = ` style="background:${ITT.core.colorPorCarrera(g.carrera)}"`;
            titulo = `${a.key} — ${ITT.core.nombreCompleto(g)} (${g.carrera})${g.presente ? " · ya ingresó" : ""}`;
          } else titulo = `${a.key} — disponible`;
          return `<div class="${cls}"${style} data-key="${esc(a.key)}" title="${esc(titulo)}"></div>`;
        }).join("");
        return `<div class="seat-row"><span class="row-label">${f.fila}</span>${seats}</div>`;
      }).join("");
      return `<div class="seat-block ${nombre}">${filas}</div>`;
    };
    return bloque("izquierda") + bloque("centro") + bloque("derecha");
  },

  render(mapId, baseLegendId, carrerasLegendId, { interactivo = false, onClick = null } = {}) {
    const cont = document.getElementById(mapId);
    cont.innerHTML = this.html();
    if (interactivo) {
      $$(".seat", cont).forEach((s) => { s.classList.add("clickable"); });
      cont.onclick = (ev) => { const s = ev.target.closest(".seat"); if (s && onClick) onClick(s.dataset.key); };
    } else cont.onclick = null;
    this.leyenda(baseLegendId, carrerasLegendId);
  },

  leyenda(baseId, carrerasId) {
    const porCarrera = App.vistaMapa === "carreras";
    $("#" + baseId).innerHTML =
      `<span><i class="dot disponible"></i> Disponible${baseId === "legendBaseAsientos" ? " (clic para asignar)" : ""}</span>` +
      `<span><i class="dot reservado"></i> Reservado</span>` +
      (porCarrera ? "" : `<span><i class="dot ocupado"></i> Ocupado</span>`);
    const cont = $("#" + carrerasId);
    if (!porCarrera) { cont.innerHTML = ""; return; }
    const carreras = [...new Set(App.graduados.map((g) => g.carrera))];
    cont.innerHTML = carreras.length
      ? `<span style="width:100%;color:var(--text);font-weight:600;">Ocupado por carrera:</span>` + carreras.map((c) => `<span><i class="dot" style="background:${ITT.core.colorPorCarrera(c)}"></i> ${esc(c)}</span>`).join("")
      : `<span>Ocupado: aún no hay alumnos en esta ceremonia (sube el Excel en Graduados).</span>`;
  },
};
