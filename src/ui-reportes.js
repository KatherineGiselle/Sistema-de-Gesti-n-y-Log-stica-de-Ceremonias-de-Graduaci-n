// ui-reportes.js — Indicadores por ceremonia y por carrera.
const truncar = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

Views.reportes = {
  render() {
    if (!App.eventos.length) { sinEvento("chartGraduadosPorEvento"); return; }
    ITT.charts.barrasHorizontales("chartGraduadosPorEvento",
      App.eventos.map((e) => ({ label: e.nombre, value: e.totalGraduados, color: e.id === App.eventoId ? "var(--navy)" : "var(--disponible)" })),
      { labelWidth: 230, ocultarVacio: true, vacio: "Aún no hay graduados registrados. Sube la lista en el módulo Graduados." });

    const s = App.stats;
    $("#reportesInfo").textContent = s ? `${App.evento.nombre}: ${s.asistentes.total} de ${fmt(s.esperados)} asistentes esperados (alumnos + invitados)` : "";
    ITT.charts.barrasHorizontales("chartAsistenciaCarrera",
      (s ? s.porCarrera : []).map((c) => {
        const pres = c.alumnosPresentes + c.invitadosPresentes, total = c.alumnos + c.invitados;
        return { label: truncar(c.carrera, 34), titulo: c.carrera, value: pres, valorTexto: `${pres}/${total}`, color: ITT.core.colorPorCarrera(c.carrera) };
      }), { labelWidth: 260, vacio: "Sin alumnos en esta ceremonia todavía." });

    $("#tablaReportes").innerHTML = App.eventos.map((e) => `
      <tr class="${e.id === App.eventoId ? "actual" : ""}"><td>${esc(e.nombre)}</td><td class="num">${fmt(e.totalGraduados)}</td><td class="num">${fmt(e.totalInvitados)}</td>
      <td class="num"><strong>${fmt(e.butacasOcupadas)}</strong></td><td class="num">${fmt(e.butacasLibres)}</td></tr>`).join("");
  },
};
