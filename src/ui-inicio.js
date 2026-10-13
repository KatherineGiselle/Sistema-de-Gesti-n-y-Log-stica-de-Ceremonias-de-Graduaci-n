// ui-inicio.js — Pantalla de Inicio: mapa de butacas + resumen de la ceremonia seleccionada.
Views.inicio = {
  render() {
    $("#welcomeTitle").textContent = `¡Bienvenida, ${USUARIO.nombre.split(" ")[0]}!`;
    if (!App.evento) { sinEvento("statsInicio"); $("#seatMapInicio").innerHTML = ""; return; }
    $("#statsInicio").innerHTML = tarjetasStats(App.stats);
    $("#vistaMapa").value = App.vistaMapa;
    SeatMap.render("seatMapInicio", "legendBaseInicio", "legendCarrerasInicio");
  },
};
function ligarInicio() {
  let zoom = 1;
  const aplicar = () => { $("#seatMapInicio").style.zoom = zoom; };
  $("#zoomIn").addEventListener("click", () => { zoom = Math.min(zoom + 0.15, 2); aplicar(); });
  $("#zoomOut").addEventListener("click", () => { zoom = Math.max(zoom - 0.15, 0.6); aplicar(); });
  $("#vistaMapa").addEventListener("change", (e) => { App.vistaMapa = e.target.value; Views.inicio.render(); });
}
