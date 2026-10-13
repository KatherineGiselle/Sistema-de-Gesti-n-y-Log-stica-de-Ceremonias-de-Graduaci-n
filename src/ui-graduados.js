// ui-graduados.js — Lista de alumnos: alta manual y carga masiva desde Excel.
Views.graduados = {
  render() {
    const t = $("#tablaGraduados"), chips = $("#graduadosChips");
    if (!App.evento) { chips.innerHTML = ""; t.innerHTML = `<tr><td colspan="10" class="empty-state">No hay ceremonias. Crea una en Eventos.</td></tr>`; return; }
    const e = App.evento;
    chips.innerHTML =
      `<span class="chip"><strong>${fmt(e.totalGraduados)}</strong> graduados</span>` +
      `<span class="chip"><strong>${fmt(e.totalInvitados)}</strong> invitados</span>` +
      `<span class="chip"><strong>${fmt(e.butacasOcupadas)}</strong> / ${e.capacidadTeatro} butacas ocupadas</span>` +
      (e.totalGraduados ? `<span class="chip">Invitados por alumno (PASES): <strong>${e.pases != null ? e.pases.toFixed(2) : "—"}</strong>${e.pasesFuente === "excel" ? " · hoja Total" : e.pasesFuente ? " · fórmula 500 − graduados" : ""}</span>` : "") +
      `<span class="chip">Orden: carrera → apellidos</span>`;
    if (!App.graduados.length) { t.innerHTML = `<tr><td colspan="10" class="empty-state">Esta ceremonia aún no tiene alumnos. Usa “Subir Excel” para cargar la lista, o “+ Agregar graduado”.</td></tr>`; return; }
    t.innerHTML = App.graduados.map((g) => `
      <tr>
        <td><strong>${g.fila ? esc(g.fila + g.asiento) : "—"}</strong></td>
        <td>${esc(g.apellidoPaterno)}</td><td>${esc(g.apellidoMaterno) || "—"}</td><td>${esc(g.nombre)}</td>
        <td>${esc(g.numControl) || "—"}</td>
        <td><div class="carrera-cell"><i class="carrera-dot" style="background:${ITT.core.colorPorCarrera(g.carrera)}"></i>${esc(g.carrera)}</div></td>
        <td class="num">${g.invitados}${g.invitadosManual ? " ✎" : ""}</td>
        <td><span class="badge ${g.qrGenerado ? "si" : "no"}">${g.qrGenerado ? "Generado" : "Pendiente"}</span></td>
        <td>${g.presente ? `<span class="badge si">Presente</span>` : `<span class="badge neutro">—</span>`}${g.invitadosPresentes ? ` <span class="badge neutro">${g.invitadosPresentes}/${g.invitados} inv.</span>` : ""}</td>
        <td><button class="btn-ghost" data-del="${g.id}" title="Eliminar alumno">✕</button></td>
      </tr>`).join("");
  },
};

// ---------- Carga masiva desde Excel ----------
async function importarExcel(file) {
  if (!file) return;
  if (!App.evento) return Toast.show("Primero crea una ceremonia en Eventos.", "error");
  Toast.show(`Leyendo ${file.name}…`, "info", { ms: 2500 });
  let datos;
  try { datos = ITT.excel.leerExcel(XLSX, await file.arrayBuffer()); }
  catch (e) { return Toast.show(e.message || "No pude leer el archivo.", "error", { ms: 8000 }); }
  const res = await ITT.api.importarGraduados({ eventoId: App.eventoId, alumnos: datos.alumnos, hojaTotal: datos.hojaTotal });
  await refrescar();
  mostrarResumenImportacion(file.name, datos, res);
}

function mostrarResumenImportacion(nombre, datos, r) {
  const sin = Object.entries(r.sinCeremonia), raras = Object.entries(r.carreraDesconocida);
  const filasEv = r.porEvento.map((p) => `<tr><td>${esc(p.nombre)}</td><td class="num">${fmt(p.graduados)}</td><td class="num">${fmt(p.invitados)}</td><td class="num">${p.pases != null ? p.pases.toFixed(2) : "—"}</td></tr>`).join("");
  Modal.abrir({
    titulo: "Importación terminada", ancho: true,
    cuerpo: `
      <p class="subtitle" style="margin-bottom:12px;">${esc(nombre)} · hoja de alumnos “${esc(datos.hojaAlumnos)}” · hoja Total: ${datos.hojaTotal ? "encontrada ✓" : "no encontrada (se usa la fórmula 500 − graduados)"}</p>
      <div class="resumen-grid">
        <div class="mini-stat"><div class="l">Alumnos leídos</div><div class="v">${fmt(r.leidos)}</div></div>
        <div class="mini-stat"><div class="l">Agregados</div><div class="v">${fmt(r.agregados)}</div></div>
        <div class="mini-stat"><div class="l">Actualizados</div><div class="v">${fmt(r.actualizados)}</div></div>
      </div>
      ${r.porEvento.length ? `<table class="data-table"><thead><tr><th>Ceremonia (semestre ${esc(r.semestre)})</th><th class="num">Alumnos</th><th class="num">Invitados</th><th class="num">PASES</th></tr></thead><tbody>${filasEv}</tbody></table>` : ""}
      ${sin.length ? `<div class="aviso"><strong>${fmt(sin.reduce((s, [, n]) => s + n, 0))} alumnos sin ceremonia:</strong> sus carreras no pertenecen a ningún evento del semestre ${esc(r.semestre)} (${sin.map(([c, n]) => `${esc(c)}: ${n}`).join(" · ")}). Crea o edita el evento en <em>Eventos</em> y vuelve a subir el archivo.</div>` : ""}
      ${raras.length ? `<div class="aviso"><strong>Carreras no reconocidas</strong> (no están en el catálogo de 23): ${raras.map(([c, n]) => `${esc(c)}: ${n}`).join(" · ")}.</div>` : ""}
      <p class="hint">Los alumnos se acomodaron por carrera y apellidos, los invitados se calcularon con la hoja Total y ya se reflejan en Asientos.</p>`,
    botones: [{ texto: "Listo", clase: "btn-primary" }],
  });
}

// ---------- Alta manual (también se usa desde el mapa de asientos) ----------
function abrirModalGraduado({ asiento = null } = {}) {
  if (!App.evento) return Toast.show("Primero crea una ceremonia en Eventos.", "error");
  const sugerido = App.evento.pases != null ? Math.min(ITT.core.MAX_INVITADOS, Math.round(App.evento.pases)) : ITT.core.MAX_INVITADOS;
  Modal.abrir({
    titulo: asiento ? `Asignar alumno al asiento ${asiento.key}` : "Agregar graduado", ancho: true,
    cuerpo: `<div class="form-grid">
      <label class="field">Apellido paterno<input id="gPat" /></label>
      <label class="field">Apellido materno<input id="gMat" /></label>
      <label class="field">Nombre(s)<input id="gNom" /></label>
      <label class="field">No. de control (opcional)<input id="gCtl" /></label>
      <label class="field full">Carrera<select id="gCar">${App.evento.carreras.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
      <label class="field">Invitados (máx. ${ITT.core.MAX_INVITADOS})<input id="gInv" type="number" min="0" max="${ITT.core.MAX_INVITADOS}" value="${sugerido}" /></label>
      <span></span>
      <label class="field">Fila (opcional)<input id="gFila" maxlength="1" style="text-transform:uppercase" value="${asiento ? esc(asiento.fila) : ""}" ${asiento ? "disabled" : ""} /></label>
      <label class="field">Asiento (opcional)<input id="gAsi" type="number" min="1" value="${asiento ? asiento.num : ""}" ${asiento ? "disabled" : ""} /></label>
    </div>
    <p class="hint">Si dejas fila y asiento vacíos, el sistema lo acomoda solo por carrera y apellidos.</p>`,
    botones: [
      { texto: "Cancelar" },
      { texto: "Guardar", clase: "btn-primary", onClick: async (ctx) => {
        const v = (id) => $(id, ctx.el).value;
        await ITT.api.crearGraduado(App.eventoId, {
          apellidoPaterno: v("#gPat"), apellidoMaterno: v("#gMat"), nombre: v("#gNom"), numControl: v("#gCtl"),
          carrera: v("#gCar"), invitados: Number(v("#gInv")), fila: v("#gFila"), asiento: v("#gAsi"),
        });
        await refrescar();
        Toast.show("Alumno agregado.", "ok");
      } },
    ],
  });
}

function ligarGraduados() {
  $("#btnSubirExcel").addEventListener("click", () => $("#inputExcel").click());
  $("#inputExcel").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    try { await importarExcel(f); } catch (err) { Toast.show(err.message || String(err), "error", { ms: 8000 }); }
  });
  $("#btnAddGraduado").addEventListener("click", () => abrirModalGraduado());
  $("#tablaGraduados").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    const g = App.graduados.find((x) => String(x.id) === b.dataset.del);
    if (await confirmar(`¿Eliminar a ${ITT.core.nombreCompleto(g)}? Se quitan también sus códigos QR.`, { titulo: "Eliminar alumno", textoOk: "Eliminar", peligro: true })) {
      await ITT.api.eliminarGraduado(g.id); await refrescar(); Toast.show("Alumno eliminado.", "ok");
    }
  });
}
