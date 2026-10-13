//Contrato: docs/API_CONTRACT.md.
(function () {
  const ITT = (window.ITT = window.ITT || {});
  const C = () => ITT.core;
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  let DB;
  // Arranca VACÍO: sin ceremonias, alumnos, códigos ni accesos de muestra.
  function nuevaDB() {
    return { eventos: [], graduados: [], reservados: [], codigos: [], accesos: [], seq: { graduado: 1, acceso: 1 } };
  }
  DB = nuevaDB();

  const getEvento = (id) => { const e = DB.eventos.find((x) => x.id === id); if (!e) throw new Error("La ceremonia no existe."); return e; };
  const graduadosDe = (eventoId) => DB.graduados.filter((g) => g.eventoId === eventoId);

  function resumenEvento(e) {
    const gs = graduadosDe(e.id);
    const inv = gs.reduce((s, g) => s + (g.invitados || 0), 0);
    const ocupadas = gs.length + inv;
    return {
      ...e, semestre: C().semestreDe(e.fecha),
      totalGraduados: gs.length, totalInvitados: inv,
      butacasOcupadas: ocupadas, butacasLibres: Math.max(C().CAPACIDAD_TEATRO - ocupadas, 0),
      capacidadTeatro: C().CAPACIDAD_TEATRO,
    };
  }

  // Reacomoda alumnos (carrera → apellidos → asiento) y reparte invitados según PASES
  function recalcularEvento(ev) {
    const gs = graduadosDe(ev.id);
    C().acomodarGraduados(gs, ev.carreras);
    const N = gs.length;
    // Sin hoja Total (o alta manual) se usa la misma fórmula del Excel: PASES = (500 − graduados) / graduados
    if (ev.pasesFuente !== "excel") { ev.pases = N ? (C().CAPACIDAD_BASE_INVITADOS - N) / N : null; ev.pasesFuente = N ? "formula" : null; }
    C().distribuirInvitados(gs, ev.pases || 0, ev.carreras);
  }

  function randomBase32(n) {
    const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(n); crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => abc[b % abc.length]).join("");
  }
  function tokenUnico(tipo) {
    let t; do { t = `ITT-${tipo === "alumno" ? "A" : "I"}-${randomBase32(12)}`; } while (DB.codigos.some((c) => c.token === t));
    return t;
  }

  const api = {
    // ---------- Catálogos ----------
    async getCarreras() { return clone(C().CARRERAS); },

    // ---------- Eventos ----------
    async getEventos() {
      return clone(DB.eventos.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).map(resumenEvento));
    },
    async crearEvento({ nombre, fecha, hora, carreras }) {
      if (!fecha || !hora) throw new Error("Indica la fecha y la hora del evento.");
      if (!Array.isArray(carreras) || carreras.length < 1) throw new Error("Agrega al menos una carrera.");
      if (carreras.length > C().MAX_CARRERAS_POR_EVENTO) throw new Error(`Máximo ${C().MAX_CARRERAS_POR_EVENTO} carreras por evento.`);
      if (new Set(carreras).size !== carreras.length) throw new Error("Hay carreras repetidas.");
      if (carreras.some((c) => !C().CARRERAS.includes(c))) throw new Error("Hay una carrera que no está en el catálogo.");
      const e = { id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`, fecha, hora, nombre: C().limpio(nombre) || C().nombreEvento(fecha, hora), carreras: carreras.slice(), pases: null, pasesFuente: null };
      DB.eventos.push(e);
      return clone(resumenEvento(e));
    },
    async eliminarEvento(id) {
      getEvento(id);
      DB.eventos = DB.eventos.filter((e) => e.id !== id);
      DB.graduados = DB.graduados.filter((g) => g.eventoId !== id);
      DB.reservados = DB.reservados.filter((r) => r.eventoId !== id);
      DB.codigos = DB.codigos.filter((c) => c.eventoId !== id);
      DB.accesos = DB.accesos.filter((a) => a.eventoId !== id);
      return { ok: true };
    },

    // ---------- Graduados ----------
    async getGraduados(eventoId) {
      const ev = getEvento(eventoId);
      return clone(C().ordenarGraduados(graduadosDe(eventoId), ev.carreras).map((g) => {
        const cods = DB.codigos.filter((c) => c.graduadoId === g.id);
        return { ...g, presente: cods.some((c) => c.tipo === "alumno" && c.usado), invitadosPresentes: cods.filter((c) => c.tipo === "invitado" && c.usado).length };
      }));
    },
    async crearGraduado(eventoId, d) {
      const ev = getEvento(eventoId);
      const carrera = C().carreraCanonica(d.carrera) || d.carrera;
      if (!ev.carreras.includes(carrera)) throw new Error("Esa carrera no pertenece a esta ceremonia.");
      if (!C().limpio(d.apellidoPaterno) || !C().limpio(d.nombre)) throw new Error("Escribe al menos apellido paterno y nombre.");
      const fila = C().limpio(d.fila).toUpperCase();
      const asiento = d.asiento ? Number(d.asiento) : null;
      let fijo = false;
      if (fila || asiento) {
        const info = ITT.layout.asientoInfo(fila + asiento);
        if (!info) throw new Error(`El asiento ${fila}${asiento || ""} no existe en el teatro.`);
        if (info.categoria !== "general") throw new Error(`El asiento ${info.key} es una zona reservada (${ITT.layout.CATEGORIAS[info.categoria]}).`);
        if (graduadosDe(eventoId).some((g) => g.fila === fila && g.asiento === asiento)) throw new Error(`El asiento ${info.key} ya está asignado a otro alumno.`);
        fijo = true;
      }
      const g = {
        id: DB.seq.graduado++, eventoId, numControl: C().limpio(d.numControl),
        apellidoPaterno: C().limpio(d.apellidoPaterno), apellidoMaterno: C().limpio(d.apellidoMaterno), nombre: C().limpio(d.nombre),
        carrera, fila: fijo ? fila : null, asiento: fijo ? asiento : null, asientoFijo: fijo,
        invitados: Math.max(0, Math.min(Number(d.invitados ?? C().MAX_INVITADOS), C().MAX_INVITADOS)),
        invitadosManual: true, qrGenerado: false,
      };
      DB.graduados.push(g);
      recalcularEvento(ev);
      return clone(g);
    },
    async eliminarGraduado(id) {
      const g = DB.graduados.find((x) => x.id === id);
      if (!g) throw new Error("El alumno no existe.");
      DB.graduados = DB.graduados.filter((x) => x.id !== id);
      DB.codigos = DB.codigos.filter((c) => c.graduadoId !== id);
      recalcularEvento(getEvento(g.eventoId));
      return { ok: true };
    },

    // Recibe lo ya leído del Excel (alumnos + hoja Total). Reparte cada alumno en la ceremonia de su
    // carrera (dentro del semestre de la ceremonia actual), los acomoda y calcula sus invitados.
    async importarGraduados({ eventoId, alumnos, hojaTotal }) {
      const actual = getEvento(eventoId);
      const sem = C().semestreDe(actual.fecha);
      const candidatos = DB.eventos.filter((e) => C().semestreDe(e.fecha) === sem);
      const res = { leidos: alumnos.length, agregados: 0, actualizados: 0, carreraDesconocida: {}, sinCeremonia: {}, porEvento: [], semestre: sem };
      const tocados = new Set();
      alumnos.forEach((a) => {
        const canon = C().carreraCanonica(a.carrera);
        if (!canon) { res.carreraDesconocida[a.carrera] = (res.carreraDesconocida[a.carrera] || 0) + 1; return; }
        const ev = candidatos.find((e) => e.carreras.includes(canon));
        if (!ev) { res.sinCeremonia[canon] = (res.sinCeremonia[canon] || 0) + 1; return; }
        let g = a.numControl ? DB.graduados.find((x) => x.eventoId === ev.id && x.numControl === a.numControl) : null;
        if (g) {
          Object.assign(g, { apellidoPaterno: a.apellidoPaterno, apellidoMaterno: a.apellidoMaterno, nombre: a.nombre, carrera: canon });
          res.actualizados++;
        } else {
          DB.graduados.push({
            id: DB.seq.graduado++, eventoId: ev.id, numControl: a.numControl || "",
            apellidoPaterno: a.apellidoPaterno, apellidoMaterno: a.apellidoMaterno, nombre: a.nombre, carrera: canon,
            fila: null, asiento: null, asientoFijo: false, invitados: 0, invitadosManual: false, qrGenerado: false,
          });
          res.agregados++;
        }
        tocados.add(ev.id);
      });
      tocados.forEach((id) => {
        const ev = getEvento(id);
        // PASES de la hoja Total (bloque que comparte carreras con este evento)
        let mejor = null, mejorN = 0;
        (hojaTotal ? hojaTotal.bloques : []).forEach((b) => {
          const n = b.carreras.filter((c) => c.canonica && ev.carreras.includes(c.canonica)).length;
          if (n > mejorN) { mejor = b; mejorN = n; }
        });
        ev.pases = mejor ? mejor.pases : null;
        ev.pasesFuente = mejor ? mejor.fuente || "excel" : "formula";
        recalcularEvento(ev);
        const r = resumenEvento(ev);
        res.porEvento.push({ eventoId: ev.id, nombre: ev.nombre, graduados: r.totalGraduados, invitados: r.totalInvitados, pases: ev.pases, fuente: ev.pasesFuente });
      });
      return clone(res);
    },

    // ---------- Zonas reservadas (3ra edad, padrinos/coordinadores, transmisión) ----------
    async getReservados(eventoId) {
      getEvento(eventoId);
      const m = {};
      DB.reservados.filter((r) => r.eventoId === eventoId).forEach((r) => (m[r.asiento] = r.nombre));
      return clone(m);
    },
    async asignarReservado(eventoId, asiento, nombre) {
      getEvento(eventoId);
      const info = ITT.layout.asientoInfo(asiento);
      if (!info || info.categoria === "general") throw new Error("Ese asiento no es una zona reservada.");
      DB.reservados = DB.reservados.filter((r) => !(r.eventoId === eventoId && r.asiento === asiento));
      const n = C().limpio(nombre);
      if (n) DB.reservados.push({ eventoId, asiento, nombre: n });
      return { ok: true };
    },

    // ---------- Códigos QR (⚠️ en producción los genera y firma el backend) ----------
    async generarQR(eventoId, carrera) {
      const ev = getEvento(eventoId);
      const gs = graduadosDe(eventoId).filter((g) => !carrera || g.carrera === carrera);
      const r = { alumnos: 0, invitados: 0, nuevos: 0, revocados: 0 };
      gs.forEach((g) => {
        const mios = DB.codigos.filter((c) => c.graduadoId === g.id);
        if (!mios.some((c) => c.tipo === "alumno")) { DB.codigos.push({ token: tokenUnico("alumno"), eventoId, tipo: "alumno", graduadoId: g.id, indice: 1, usado: false, usadoEn: null, estacion: null }); r.nuevos++; }
        const inv = mios.filter((c) => c.tipo === "invitado");
        for (let i = inv.length + 1; i <= g.invitados; i++) { DB.codigos.push({ token: tokenUnico("invitado"), eventoId, tipo: "invitado", graduadoId: g.id, indice: i, usado: false, usadoEn: null, estacion: null }); r.nuevos++; }
        inv.filter((c) => c.indice > g.invitados && !c.usado).forEach((c) => { DB.codigos = DB.codigos.filter((x) => x !== c); r.revocados++; });
        g.qrGenerado = true;
        r.alumnos++; r.invitados += g.invitados;
      });
      return clone({ ...r, evento: ev.nombre });
    },
    async getResumenQR(eventoId) {
      const ev = getEvento(eventoId);
      return clone(ev.carreras.map((carrera) => {
        const gs = graduadosDe(eventoId).filter((g) => g.carrera === carrera);
        const ids = new Set(gs.map((g) => g.id));
        const cods = DB.codigos.filter((c) => ids.has(c.graduadoId));
        const esperadosInv = gs.reduce((s, g) => s + g.invitados, 0);
        return {
          carrera, graduados: gs.length, invitadosEsperados: esperadosInv,
          qrAlumnos: cods.filter((c) => c.tipo === "alumno").length, qrInvitados: cods.filter((c) => c.tipo === "invitado").length,
          usados: cods.filter((c) => c.usado).length,
          completo: gs.length > 0 && cods.filter((c) => c.tipo === "alumno").length === gs.length && cods.filter((c) => c.tipo === "invitado").length === esperadosInv,
        };
      }));
    },
    // Tarjetas para imprimir (una por QR), en el orden de acomodo
    async getCodigosQR(eventoId, carrera) {
      const ev = getEvento(eventoId);
      const gs = C().ordenarGraduados(graduadosDe(eventoId).filter((g) => !carrera || g.carrera === carrera), ev.carreras);
      const out = [];
      gs.forEach((g) => {
        DB.codigos.filter((c) => c.graduadoId === g.id)
          .sort((a, b) => (a.tipo === b.tipo ? a.indice - b.indice : a.tipo === "alumno" ? -1 : 1))
          .forEach((c) => out.push({
            token: c.token, tipo: c.tipo, indice: c.indice, totalInvitados: g.invitados,
            graduado: { nombreCompleto: C().nombreCompleto(g), carrera: g.carrera, fila: g.fila, asiento: g.asiento },
          }));
      });
      return clone(out);
    },

    // ---------- Control de acceso (⚠️ el backend debe hacerlo de forma ATÓMICA y central) ----------
    async validarAcceso(eventoId, token, estacion) {
      const ev = getEvento(eventoId);
      const t = C().limpio(token);
      const c = DB.codigos.find((x) => x.token === t);
      const hora = new Date().toISOString();
      const reg = (res) => {
        DB.accesos.unshift({ id: DB.seq.acceso++, eventoId, token: t, estacion: estacion.nombre, ...res, hora });
        return clone({ ...res, hora, estacion: estacion.nombre });
      };
      if (!c) return reg({ ok: false, motivo: "no_existe", mensaje: "Código no reconocido." });
      const g = DB.graduados.find((x) => x.id === c.graduadoId);
      const info = g ? { nombre: C().nombreCompleto(g), carrera: g.carrera, asiento: g.fila ? g.fila + g.asiento : null } : {};
      const tipoTxt = c.tipo === "alumno" ? "Alumno" : `Invitado ${c.indice} de ${g ? g.invitados : "?"}`;
      if (c.eventoId !== eventoId) {
        const otro = DB.eventos.find((e) => e.id === c.eventoId);
        return reg({ ok: false, motivo: "otra_ceremonia", mensaje: `Este QR pertenece a otra ceremonia (${otro ? otro.nombre : "desconocida"}).`, tipo: c.tipo, ...info });
      }
      if (c.tipo !== estacion.tipo) {
        return reg({ ok: false, motivo: "tipo_incorrecto", mensaje: c.tipo === "alumno" ? "Este QR es de ALUMNO: debe pasar por el escáner de alumnos." : "Este QR es de INVITADO: debe pasar por un escáner de invitados.", tipo: c.tipo, ...info });
      }
      if (c.usado) {
        return reg({ ok: false, motivo: "ya_usado", mensaje: `Código ya utilizado (${new Date(c.usadoEn).toLocaleTimeString("es-MX")} en ${c.estacion}).`, tipo: c.tipo, tipoTxt, ...info });
      }
      c.usado = true; c.usadoEn = hora; c.estacion = estacion.nombre;
      return reg({ ok: true, motivo: "ok", mensaje: "Acceso permitido", tipo: c.tipo, tipoTxt, ...info });
    },
    async getAccesos(eventoId, limite = 200) {
      return clone(DB.accesos.filter((a) => a.eventoId === eventoId).slice(0, limite));
    },

    // ---------- Estadísticas ----------
    async getEstadisticasEvento(eventoId) {
      const ev = getEvento(eventoId);
      const r = resumenEvento(ev);
      const gs = graduadosDe(eventoId);
      const porId = new Map(gs.map((g) => [g.id, g]));
      const cods = DB.codigos.filter((c) => c.eventoId === eventoId);
      const usados = cods.filter((c) => c.usado);
      const porCarrera = ev.carreras.map((carrera) => {
        const ids = new Set(gs.filter((g) => g.carrera === carrera).map((g) => g.id));
        const gCar = gs.filter((g) => g.carrera === carrera);
        return {
          carrera, alumnos: gCar.length, invitados: gCar.reduce((s, g) => s + g.invitados, 0),
          alumnosPresentes: usados.filter((c) => ids.has(c.graduadoId) && c.tipo === "alumno").length,
          invitadosPresentes: usados.filter((c) => ids.has(c.graduadoId) && c.tipo === "invitado").length,
        };
      }).filter((x) => x.alumnos > 0);
      const alumnosPres = usados.filter((c) => c.tipo === "alumno").length;
      const invPres = usados.filter((c) => c.tipo === "invitado").length;
      return clone({
        graduados: r.totalGraduados, invitados: r.totalInvitados, butacasOcupadas: r.butacasOcupadas,
        asientosDisponibles: r.butacasLibres, esperados: r.totalGraduados + r.totalInvitados,
        asistentes: { alumnos: alumnosPres, invitados: invPres, total: alumnosPres + invPres }, porCarrera,
      });
    },
    // Graduados por semestre y acumulado total registrado
    async getEstadisticasGlobales() {
      const m = {};
      DB.eventos.forEach((e) => {
        const s = C().semestreDe(e.fecha);
        m[s] = m[s] || { semestre: s, graduados: 0, ceremonias: 0 };
        m[s].graduados += graduadosDe(e.id).length; m[s].ceremonias++;
      });
      let acum = 0;
      const lista = Object.values(m).sort((a, b) => a.semestre.localeCompare(b.semestre)).map((x) => { acum += x.graduados; return { ...x, acumulado: acum }; });
      return clone({ semestres: lista, totalRegistrado: acum });
    },
  };

  api._reset = () => { DB = nuevaDB(); };
  api._db = () => DB; // solo para pruebas
  ITT.mock = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})();
