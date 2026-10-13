// ui-estadisticas.js — Monitoreo en vivo + graduados por semestre y acumulados (2 gráficas de barras).
let _timerVivo = null;

function pintarVivo() {
  const s = App.stats;
  if (!s) { $("#statsEstadisticas").innerHTML = ""; $("#progresoTexto").textContent = "0 / 0"; $("#progresoFill").style.width = "0%"; return; }
  const pct = s.esperados ? Math.min((s.asistentes.total / s.esperados) * 100, 100) : 0;
  $("#progresoTexto").textContent = `${fmt(s.asistentes.total)} / ${fmt(s.esperados)}`;
  $("#progresoFill").style.width = pct + "%";
  $("#statsEstadisticas").innerHTML = tarjetasStats(s);
}

Views.estadisticas = {
  async render() {
    pintarVivo();
    const g = await ITT.api.getEstadisticasGlobales();
    ITT.charts.barrasVerticales("chartSemestres", g.semestres.map((x) => ({ label: x.semestre, value: x.graduados, color: "var(--disponible)" })));
    ITT.charts.barrasVerticales("chartAcumulado", g.semestres.map((x) => ({ label: x.semestre, value: x.acumulado, color: "var(--ocupado)" })));
  },
  entrar() {
    clearInterval(_timerVivo);
    _timerVivo = setInterval(async () => {
      if (!App.evento) return;
      try { App.stats = await ITT.api.getEstadisticasEvento(App.eventoId); pintarVivo(); } catch (e) { /* reintenta en el siguiente ciclo */ }
    }, 2000);
  },
  salir() { clearInterval(_timerVivo); _timerVivo = null; },
};
