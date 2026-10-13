// ui-eventos.js — Alta y consulta de ceremonias.
const fechaCorta = (iso) => { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; };

Views.eventos = {
  render() {
    const t = $("#tablaEventos");
    if (!App.eventos.length) { t.innerHTML = `<tr><td colspan="9" class="empty-state">Aún no hay ceremonias. Crea la primera con “+ Nuevo evento”.</td></tr>`; return; }
    t.innerHTML = App.eventos.map((e) => `
      <tr class="${e.id === App.eventoId ? "actual" : ""}" data-id="${esc(e.id)}" style="cursor:pointer;">
        <td class="col-evento"><strong>${esc(e.nombre)}</strong>${e.id === App.eventoId ? ` <span class="badge si">Actual</span>` : ""}</td>
        <td class="nw">${fechaCorta(e.fecha)}</td><td class="nw">${ITT.core.horaLegible(e.hora)}</td>
        <td>${e.carreras.map((c, i) => `<span class="tag">${i + 1}. ${esc(c)}</span>`).join("")}</td>
        <td class="num">${fmt(e.totalGraduados)}</td><td class="num">${fmt(e.totalInvitados)}</td>
        <td class="num"><strong>${fmt(e.butacasOcupadas)}</strong></td><td class="num">${fmt(e.butacasLibres)}</td>
        <td><button class="btn-ghost" data-del="${esc(e.id)}">Eliminar</button></td>
      </tr>`).join("");
  },
};

function abrirModalEvento() {
  const elegidas = []; // carreras en el orden en que se agregan (define el orden de acomodo)
  const MAX = ITT.core.MAX_CARRERAS_POR_EVENTO;
  const cuerpo = `
    <div class="form-grid">
      <label class="field full">Nombre del evento (opcional)<input id="evNombre" placeholder="Si lo dejas vacío se genera con la fecha y la hora" /></label>
      <label class="field">Fecha<input type="date" id="evFecha" /></label>
      <label class="field">Hora<input type="time" id="evHora" value="11:00" /></label>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;">
      <strong style="font-size:13px;">Carreras <span id="evContador" style="color:var(--muted);font-weight:400;"></span></strong>
      <button type="button" id="evAdd" class="btn-secondary btn-sm">+ Agregar carrera</button>
    </div>
    <p class="hint" style="margin:4px 0 10px;">Máximo ${MAX}. El orden en que las agregues es el orden en que se sientan los alumnos en el teatro.</p>
    <div id="evCarreras"></div>`;

  Modal.abrir({
    titulo: "Nuevo evento", cuerpo, ancho: true,
    alMontar: (ctx) => {
      const pintar = () => {
        $("#evCarreras", ctx.el).innerHTML = elegidas.map((c, i) => `
          <div class="carrera-fila"><span class="orden">${i + 1}.</span>
            <select data-i="${i}"><option value="">— Selecciona una carrera —</option>
              ${App.carreras.map((x) => { const usada = elegidas.includes(x) && x !== c; return `<option value="${esc(x)}" ${x === c ? "selected" : ""} ${usada ? "disabled" : ""}>${esc(x)}${usada ? " (ya agregada)" : ""}</option>`; }).join("")}
            </select><button type="button" class="btn-ghost" data-rm="${i}" title="Quitar">✕</button></div>`).join("");
        $("#evContador", ctx.el).textContent = `(${elegidas.filter(Boolean).length}/${MAX})`;
        $("#evAdd", ctx.el).disabled = elegidas.length >= MAX;
      };
      $("#evAdd", ctx.el).addEventListener("click", () => { if (elegidas.length < MAX) { elegidas.push(""); pintar(); } });
      ctx.el.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.i !== undefined) { elegidas[+e.target.dataset.i] = e.target.value; pintar(); } });
      ctx.el.addEventListener("click", (e) => { const rm = e.target.dataset && e.target.dataset.rm; if (rm !== undefined && rm !== "") { elegidas.splice(+rm, 1); pintar(); } });
      elegidas.push(""); pintar();
    },
    botones: [
      { texto: "Cancelar" },
      { texto: "Guardar evento", clase: "btn-primary", onClick: async (ctx) => {
        const fecha = $("#evFecha", ctx.el).value, hora = $("#evHora", ctx.el).value;
        const carreras = elegidas.filter(Boolean);
        if (!fecha || !hora) throw new Error("Indica la fecha y la hora.");
        if (!carreras.length) throw new Error("Agrega al menos una carrera.");
        const nuevo = await ITT.api.crearEvento({ nombre: $("#evNombre", ctx.el).value, fecha, hora, carreras });
        App.eventoId = nuevo.id;
        await refrescar();
        Toast.show(`Evento “${nuevo.nombre}” creado con ${carreras.length} carrera(s).`, "ok");
      } },
    ],
  });
}

function ligarEventos() {
  $("#btnNuevoEvento").addEventListener("click", abrirModalEvento);
  $("#tablaEventos").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const ev = App.eventos.find((x) => x.id === del.dataset.del);
      if (await confirmar(`¿Eliminar “${ev.nombre}”? También se borrarán sus ${ev.totalGraduados} alumnos, códigos QR y registros de acceso.`, { titulo: "Eliminar evento", textoOk: "Eliminar", peligro: true })) {
        await ITT.api.eliminarEvento(ev.id); await refrescar(); Toast.show("Evento eliminado.", "ok");
      }
      return;
    }
    const tr = e.target.closest("tr[data-id]");
    if (tr && tr.dataset.id !== App.eventoId) { await cambiarEvento(tr.dataset.id); Toast.show("Ceremonia seleccionada.", "info", { ms: 1800 }); }
  });
}
