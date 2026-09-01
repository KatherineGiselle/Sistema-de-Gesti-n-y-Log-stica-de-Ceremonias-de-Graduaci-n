// mock-data.js
// Este archivo simula las respuestas que en el futuro vendrán del backend
// de Gerardo. Cuando el backend esté listo, estas funciones se sustituyen
// por llamadas fetch()/axios() que devuelvan exactamente esta misma forma
// de datos (ese es el "contrato" que ya deben acordar ambos).

const MOCK = {
  usuario: {
    nombre: "Ashlee Evelin Robles Gallegos",
    puesto: "Jefa del Departamento de Comunicación y Difusión",
    avatar: null, // URL de imagen cuando exista
  },

  eventos: [
    { id: "grad-2026-2", nombre: "Graduación 2026-2", activo: true },
    { id: "grad-2026-1", nombre: "Graduación 2026-1", activo: false },
    { id: "grad-2025-2", nombre: "Graduación 2025-2", activo: false },
  ],

  estadisticas: {
    graduados: 542,
    invitadosAutorizados: 1626,
    asientosDisponibles: 184,
    asistentesRegistrados: 312,
  },

  carreras: [
    "Ing. en Sistemas Computacionales",
    "Ing. Industrial",
    "Ing. Mecatrónica",
    "Ing. Civil",
    "Lic. en Administración",
  ],

  graduados: [
    { id: 1, nombreCompleto: "Castillo Lorenzo Gerardo", numControl: "22210290", carrera: "Ing. en Sistemas Computacionales", invitadosAutorizados: 3, asientoAsignado: "A12", qrGenerado: true },
    { id: 2, nombreCompleto: "Díaz Morales Katherine Giselle", numControl: "22210302", carrera: "Ing. en Sistemas Computacionales", invitadosAutorizados: 3, asientoAsignado: "A13", qrGenerado: true },
    { id: 3, nombreCompleto: "Ramírez Soto Luis Fernando", numControl: "22210355", carrera: "Ing. Industrial", invitadosAutorizados: 2, asientoAsignado: "D08", qrGenerado: false },
  ],

  // Genera el mapa de asientos del Teatro Calafornix: filas A-K, columnas 1-22.
  generarMapaAsientos() {
    const filas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    const columnas = 22;
    const bloqueados = new Set(["H15","H16","H17","H18","I15","I16","I17","I18","J15","J16","J17"]);
    const reservados = new Set(["E10","E11","E12","F10","F11","F12","F13","G10","G11","G12","G13","G14","H10","H11","H12","H13","H14"]);
    const ocupados = new Set(["A12","A13","A14","A15","A16","B12","B13","B14","B15","B16","B17","C12","C13","C14","C15","C16"]);

    const seats = [];
    filas.forEach((fila) => {
      for (let col = 1; col <= columnas; col++) {
        const key = `${fila}${col}`;
        let status = "disponible";
        if (bloqueados.has(key)) status = "bloqueado";
        else if (reservados.has(key)) status = "reservado";
        else if (ocupados.has(key)) status = "ocupado";
        seats.push({ fila, col, key, status });
      }
    });
    return seats;
  },
};

window.MOCK_DATA = MOCK;
