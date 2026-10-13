// ui-asientos.js — Mapa interactivo por ceremonia: nombres en zonas reservadas y consulta de alumnos.
Views.asientos = {
  render() {
    if (!App.evento) { $("#asientosInfo").textContent = "No hay ceremonias."; $("#seatMapAsientos").innerHTML = ""; return; }
    $("#asientosInfo").textContent = `${App.evento.nombre} · ${App.evento.carreras.length} carrera(s) · ${App.graduados.length} alumnos`;
    SeatMap.render("seatMapAsientos", "legendBaseAsientos", "legendCarrerasAsientos", { interactivo: true, onClick: clicAsiento });
    const L = ITT.layout, zonas = {};
    L.reservados().forEach((a) => { zonas[a.categoria] = zonas[a.categoria] || { total: 0, con: 0 }; zonas[a.categoria].total++; if (App.reservados[a.key]) zonas[a.categoria].con++; });
    const totalRes = L.reservados().length, totalCon = Object.keys(App.reservados).length;
    $("#zonasResumen").innerHTML = Object.entries(zonas).map(([cat, z]) =>
      `<span class="zona-chip"><strong>${L.CATEGORIAS[cat]}</strong>: ${z.con}/${z.total} con nombre</span>`).join("")
      + `<span class="zona-chip"><strong>Reservados</strong>: ${totalCon}/${totalRes} asignados</span>`;
  },
};

function clicAsiento(key) {
  const info = ITT.layout.asientoInfo(key);
  if (info.categoria !== "general") return modalReservado(info);
  const g = App.graduados.find((x) => x.fila + x.asiento === key);
  if (g) return modalAlumno(g);
  abrirModalGraduado({ asiento: info });
}

function modalReservado(info) {
  const actual = App.reservados[info.key] || "";
  Modal.abrir({
    titulo: `Asiento ${info.key} — ${ITT.layout.CATEGORIAS[info.categoria]}`,
    cuerpo: `<label class="field">Nombre de quien lo ocupa<input id="resNombre" value="${esc(actual)}" placeholder="Nombre y cargo (ej. Padrino)" maxlength="80" /></label>
      <p class="hint">Al guardar un nombre el asiento queda marcado como ocupado (sigue en gris, con un punto).</p>`,
    botones: [
      { texto: "Cancelar" },
      ...(actual ? [{ texto: "Quitar nombre", clase: "btn-secondary", onClick: async () => { await ITT.api.asignarReservado(App.eventoId, info.key, ""); await refrescar({ eventos: false }); Toast.show("Nombre quitado.", "ok"); } }] : []),
      { texto: "Guardar", clase: "btn-primary", onClick: async (ctx) => {
        const n = $("#resNombre", ctx.el).value.trim();
        if (!n) throw new Error("Escribe un nombre o usa “Quitar nombre”.");
        await ITT.api.asignarReservado(App.eventoId, info.key, n);
        await refrescar({ eventos: false });
        Toast.show(`Asiento ${info.key} asignado a ${n}.`, "ok");
      } },
    ],
  });
}

function modalAlumno(g) {
  Modal.abrir({
    titulo: "Alumno",
    cuerpo: `<dl class="info-lista">
      <dt>Nombre</dt><dd>${esc(ITT.core.nombreCompleto(g))}</dd>
      <dt>Carrera</dt><dd>${esc(g.carrera)}</dd>
      <dt>No. de control</dt><dd>${esc(g.numControl) || "—"}</dd>
      <dt>Asiento</dt><dd>${esc(g.fila + g.asiento)}</dd>
      <dt>Invitados</dt><dd>${g.invitados}${g.invitadosPresentes ? ` (${g.invitadosPresentes} ya ingresaron)` : ""}</dd>
      <dt>Asistencia</dt><dd>${g.presente ? "Ya ingresó" : "Aún no ingresa"}</dd></dl>`,
    botones: [{ texto: "Cerrar", clase: "btn-primary" }],
  });
}
function ligarAsientos() { /* eventos del mapa se ligan en cada render */ }
