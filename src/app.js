// app.js — Arranque de la aplicación.
(async function iniciar() {
  $("#userName").textContent = USUARIO.nombre;

  try { App.carreras = await ITT.api.getCarreras(); }
  catch (e) { App.carreras = ITT.core.CARRERAS; Toast.show("No pude cargar el catálogo de carreras: " + e.message, "error"); }

  $$(".nav-item").forEach((b) => b.addEventListener("click", () => mostrarVista(b.dataset.view)));
  $("#btnCerrarSesion").addEventListener("click", () => Toast.show("Sesión cerrada correctamente.", "info"));
  ligarSelectoresEvento(); ligarInicio(); ligarEventos(); ligarGraduados(); ligarAsientos(); ligarQR();
  Views.configuracion = { render() {} };
  await mostrarVista("inicio");
})();
