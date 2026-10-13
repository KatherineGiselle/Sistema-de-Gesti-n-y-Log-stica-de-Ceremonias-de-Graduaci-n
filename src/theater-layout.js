// theater-layout.js — Plano del Teatro Calafornix (535 butacas).
// La numeración es CONTINUA a lo largo de la fila (izquierda → centro → derecha),
// tal como en la hoja de asientos y en las hojas por ceremonia del Excel.
(function () {
  const ITT = (window.ITT = window.ITT || {});

  const FILAS = ["O", "Ñ", "N", "M", "L", "K", "J", "I", "H", "G", "F", "E", "D", "C", "B", "A"];

  // fila: [izq_ini, izq_fin, centro_ini, centro_fin, der_ini, der_fin]
  const TABLA = {
    O: [1, 14, 15, 28, 29, 42], "Ñ": [1, 13, 14, 27, 28, 40], N: [1, 12, 13, 25, 26, 37],
    M: [1, 13, 14, 27, 28, 40], L: [1, 12, 13, 25, 26, 37], K: [1, 12, 13, 24, 25, 36],
    J: [1, 12, 13, 24, 25, 35], I: [1, 11, 12, 23, 24, 34], H: [1, 11, 12, 22, 23, 32],
    G: [1, 10, 11, 22, 23, 33], F: [1, 10, 11, 21, 22, 31], E: [1, 10, 11, 20, 21, 30],
    D: [1, 10, 11, 20, 21, 29], C: [1, 9, 10, 19, 20, 28], B: [1, 8, 9, 17, 18, 25],
    A: [1, 8, 9, 18, 19, 26],
  };

  // Zonas reservadas (se muestran en gris y se les puede asignar un nombre)
  const CATEGORIAS = {
    general: "General",
    tercera_edad: "3ra edad",
    padrinos_coordinadores: "Padrinos y coordinadores",
    transmision: "Transmisión en vivo",
  };

  function categoriaDe(fila, num) {
    if (fila === "A" && num >= 1 && num <= 18) return "tercera_edad";
    if ((fila === "A" && num >= 19 && num <= 26) || (fila === "B" && num >= 18 && num <= 25)) return "padrinos_coordinadores";
    if ((fila === "H" && num === 12) || (fila === "G" && (num === 11 || num === 12))) return "transmision";
    return "general";
  }

  const BLOQUES_NOMBRES = ["izquierda", "centro", "derecha"];
  const bloques = { izquierda: [], centro: [], derecha: [] };
  const indice = {}; // key -> info

  FILAS.forEach((fila) => {
    const t = TABLA[fila];
    BLOQUES_NOMBRES.forEach((bloque, b) => {
      const ini = t[b * 2], fin = t[b * 2 + 1];
      const asientos = [];
      for (let n = ini; n <= fin; n++) {
        const key = fila + n;
        const info = { key, fila, num: n, bloque, categoria: categoriaDe(fila, n) };
        asientos.push(info);
        indice[key] = info;
      }
      bloques[bloque].push({ fila, asientos });
    });
  });

  const todos = Object.values(indice);
  const capacidadTotal = todos.length; // debe ser 535

  // Orden en que se acomodan los alumnos (réplica de las hojas por ceremonia del Excel):
  // izquierda B→F, centro B→F, derecha B→F (B-derecha es de padrinos y se omite sola),
  // y si faltan lugares, desborde por filas G→O (derecha, centro, izquierda).
  function secuenciaGraduados() {
    const seq = [];
    const push = (bloque, fila) => {
      const f = bloques[bloque].find((x) => x.fila === fila);
      f.asientos.forEach((a) => { if (a.categoria === "general") seq.push(a.key); });
    };
    ["B", "C", "D", "E", "F"].forEach((f) => push("izquierda", f));
    ["B", "C", "D", "E", "F"].forEach((f) => push("centro", f));
    ["B", "C", "D", "E", "F"].forEach((f) => push("derecha", f));
    ["G", "H", "I", "J", "K", "L", "M", "N", "Ñ", "O"].forEach((f) =>
      ["derecha", "centro", "izquierda"].forEach((b) => push(b, f)));
    return seq;
  }

  ITT.layout = {
    FILAS, TABLA, CATEGORIAS, bloques, capacidadTotal,
    asientoInfo: (key) => indice[key] || null,
    todos,
    reservados: () => todos.filter((a) => a.categoria !== "general"),
    secuenciaGraduados,
    categoriaDe,
  };

  if (typeof module === "object" && module.exports) module.exports = ITT.layout;
})();
