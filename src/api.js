// api.js — ÚNICA puerta de entrada de la interfaz hacia los datos.
// Hoy usa el backend simulado 
//   1) pon USE_BACKEND = true y ajusta BASE_URL
//   2) revisa que sus rutas/JSON coincidan con docs/API_CONTRACT.md (o ajusta el mapeo de abajo)
// La interfaz NO necesita cambios: solo llama a ITT.api.<función>().
(function () {
  const ITT = (window.ITT = window.ITT || {});

  const USE_BACKEND = false;
  const BASE_URL = "http://localhost:3000/api";
  const getToken = () => { try { return localStorage.getItem("itt.authToken"); } catch (e) { return null; } }; // login: lo define el backend

  async function http(method, ruta, cuerpo) {
    const resp = await fetch(BASE_URL + ruta, {
      method,
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.mensaje || datos.message || `Error ${resp.status} del servidor`);
    return datos;
  }
  const q = encodeURIComponent;

  const HttpBackend = {
    getCarreras: () => http("GET", "/carreras"),
    getEventos: () => http("GET", "/eventos"),
    crearEvento: (d) => http("POST", "/eventos", d),
    eliminarEvento: (id) => http("DELETE", `/eventos/${q(id)}`),
    getGraduados: (ev) => http("GET", `/eventos/${q(ev)}/graduados`),
    crearGraduado: (ev, d) => http("POST", `/eventos/${q(ev)}/graduados`, d),
    eliminarGraduado: (id) => http("DELETE", `/graduados/${id}`),
    importarGraduados: ({ eventoId, alumnos, hojaTotal }) => http("POST", `/eventos/${q(eventoId)}/graduados/importar`, { alumnos, hojaTotal }),
    getReservados: (ev) => http("GET", `/eventos/${q(ev)}/reservados`),
    asignarReservado: (ev, asiento, nombre) => http("PUT", `/eventos/${q(ev)}/reservados/${q(asiento)}`, { nombre }),
    generarQR: (ev, carrera) => http("POST", `/eventos/${q(ev)}/qr/generar`, { carrera: carrera || null }),
    getResumenQR: (ev) => http("GET", `/eventos/${q(ev)}/qr/resumen`),
    getCodigosQR: (ev, carrera) => http("GET", `/eventos/${q(ev)}/qr${carrera ? "?carrera=" + q(carrera) : ""}`),
    validarAcceso: (ev, token, estacion) => http("POST", `/eventos/${q(ev)}/acceso/validar`, { token, estacion }),
    getAccesos: (ev, limite) => http("GET", `/eventos/${q(ev)}/accesos?limite=${limite || 200}`),
    getEstadisticasEvento: (ev) => http("GET", `/eventos/${q(ev)}/estadisticas`),
    getEstadisticasGlobales: () => http("GET", "/estadisticas/globales"),
  };

  ITT.api = USE_BACKEND ? HttpBackend : ITT.mock;
  ITT.api.modo = USE_BACKEND ? "backend" : "simulado";
})();
