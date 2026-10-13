// core.js — Reglas de negocio puras (sin UI).
// el acomodo de asientos y el reparto de invitados son lógica de negocio que le

(function () {
  const ITT = (window.ITT = window.ITT || {});

  const CAPACIDAD_TEATRO = 535;
  const CAPACIDAD_BASE_INVITADOS = 500;   // "500 BUTACAS" de la hoja Total (butacas = 500 − graduados)
  const MAX_INVITADOS = 3;                // las invitaciones físicas traen 2–3 boletos
  const MAX_CARRERAS_POR_EVENTO = 10;

  const CARRERAS = [
    "Arquitectura", "Contador Público", "Ing. Aeronáutica", "Ing. Ambiental", "Ing. Biomédica",
    "Ing. Bioquímica", "Ing. Civil", "Ing. Electromecánica", "Ing. Electrónica", "Ing. en Diseño Industrial",
    "Ing. en Gestión Empresarial", "Ing. en Logística", "Ing. en Nanotecnología",
    "Ing. en Sistemas Computacionales", "Ing. en Tecnologías de la Información y Comunicaciones",
    "Ing. Industrial", "Ing. Industrial Semipresencial", "Ing. Informática", "Ing. Mecánica",
    "Ing. Química", "Lic. en Administración", "Ing. en Ciberseguridad", "Ing. en Inteligencia Artificial",
  ];

  // ---------- Normalización de nombres de carrera (Excel usa MAYÚSCULAS sin acentos) ----------
  function normalizar(texto) {
    return String(texto == null ? "" : texto)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/\s+/g, " ").trim();
  }
  function normCarrera(texto) {
    let s = normalizar(texto).replace(/[.,]/g, ". ").replace(/\s+/g, " ").trim();
    s = s.replace(/^ING\.? /, "INGENIERIA ").replace(/^LIC\.? /, "LICENCIATURA ");
    return s.replace(/\./g, "").replace(/\s+/g, " ").trim();
  }
  const MAPA_CARRERAS = {};
  CARRERAS.forEach((c) => (MAPA_CARRERAS[normCarrera(c)] = c));
  function carreraCanonica(raw) { return MAPA_CARRERAS[normCarrera(raw)] || null; }

  function colorPorCarrera(carrera) {
    const idx = CARRERAS.indexOf(carrera);
    const hue = idx >= 0 ? Math.round((idx * 137.508) % 360) : 210;
    return `hsl(${hue}, 60%, 40%)`;
  }

  // ---------- Fechas ----------
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function partesFecha(fechaISO) { const [y, m, d] = String(fechaISO).split("-").map(Number); return { y, m, d }; }
  function semestreDe(fechaISO) { const { y, m } = partesFecha(fechaISO); return `${y}-${m <= 6 ? 1 : 2}`; }
  function horaLegible(hora) {
    const [h, mi] = String(hora).split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mi).padStart(2, "0")} ${ampm}`;
  }
  function nombreEvento(fechaISO, hora) {
    const { y, m, d } = partesFecha(fechaISO);
    const dia = DIAS[new Date(y, m - 1, d).getDay()];
    return `${dia} ${d} de ${MESES[m - 1]}, ${horaLegible(hora)}`;
  }

  // ---------- Orden y acomodo ----------
  const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  const limpio = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  function nombreCompleto(g) { return [g.nombre, g.apellidoPaterno, g.apellidoMaterno].map(limpio).filter(Boolean).join(" "); }

  // Orden: carrera (en el orden en que se agregaron al evento) → apellido paterno → materno → nombre
  function ordenarGraduados(graduados, carrerasEvento) {
    const pos = (c) => { const i = carrerasEvento.indexOf(c); return i < 0 ? 999 : i; };
    // Igual que Excel: un campo vacío (p. ej. sin apellido materno) va después de los que sí lo tienen
    const cmp = (x, y) => { x = limpio(x); y = limpio(y); if (!x && y) return 1; if (x && !y) return -1; return collator.compare(x, y); };
    return graduados.slice().sort((a, b) =>
      pos(a.carrera) - pos(b.carrera) ||
      cmp(a.apellidoPaterno, b.apellidoPaterno) ||
      cmp(a.apellidoMaterno, b.apellidoMaterno) ||
      cmp(a.nombre, b.nombre));
  }

  // Asigna fila/asiento a cada graduado siguiendo la secuencia real del teatro.
  // Los graduados con asientoFijo (asignados a mano) conservan su lugar.
  function acomodarGraduados(graduados, carrerasEvento) {
    const orden = ordenarGraduados(graduados, carrerasEvento);
    const fijos = new Set(graduados.filter((g) => g.asientoFijo && g.fila).map((g) => g.fila + g.asiento));
    const seq = ITT.layout.secuenciaGraduados().filter((k) => !fijos.has(k));
    let i = 0;
    orden.forEach((g) => {
      if (g.asientoFijo) return;
      const key = seq[i++];
      if (!key) { g.fila = null; g.asiento = null; return; }
      const info = ITT.layout.asientoInfo(key);
      g.fila = info.fila; g.asiento = info.num;
    });
    return orden;
  }

  // Invitados por alumno según la hoja Total:  PASES = butacas / graduados.
  // Cada alumno recibe floor(PASES) boletos (máx. 3) y el resto se reparte de forma pareja.
  function distribuirInvitados(graduados, pases, carrerasEvento) {
    const auto = ordenarGraduados(graduados.filter((g) => !g.invitadosManual), carrerasEvento);
    const N = auto.length;
    if (!N) return;
    const base = Math.floor((pases || 0) + 1e-9);
    if (base >= MAX_INVITADOS) { auto.forEach((g) => (g.invitados = MAX_INVITADOS)); return; }
    const r = Math.max(0, Math.min(N, Math.round(((pases || 0) - base) * N)));
    auto.forEach((g, i) => {
      const extra = Math.floor(((i + 1) * r) / N) - Math.floor((i * r) / N);
      g.invitados = Math.min(base + extra, MAX_INVITADOS);
    });
  }

  ITT.core = {
    CAPACIDAD_TEATRO, CAPACIDAD_BASE_INVITADOS, MAX_INVITADOS, MAX_CARRERAS_POR_EVENTO, CARRERAS,
    normalizar, normCarrera, carreraCanonica, colorPorCarrera,
    semestreDe, nombreEvento, horaLegible, limpio, nombreCompleto,
    ordenarGraduados, acomodarGraduados, distribuirInvitados,
  };
  if (typeof module === "object" && module.exports) module.exports = ITT.core;
})();
