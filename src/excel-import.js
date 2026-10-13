// excel-import.js — Lee el .xlsx de egresados (lista de alumnos + hoja "Total").
// Requiere SheetJS (global XLSX). Todo ocurre en el equipo; el archivo no se sube a ningún servidor.
(function () {
  const ITT = (window.ITT = window.ITT || {});
  const norm = (s) => ITT.core.normalizar(s);

  function filasDeHoja(XLSX, ws) {
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  }

  // Busca la fila de encabezados que contenga todas las palabras pedidas
  function buscarEncabezado(filas, palabras, maxFilas = 15) {
    for (let i = 0; i < Math.min(filas.length, maxFilas); i++) {
      const celdas = (filas[i] || []).map((c) => norm(c));
      if (palabras.every((p) => celdas.some((c) => c.includes(p)))) return i;
    }
    return -1;
  }
  const colDe = (encab, pred) => encab.findIndex((c) => pred(norm(c)));

  function leerAlumnos(XLSX, wb) {
    const candidatas = [];
    wb.SheetNames.forEach((nombre) => {
      const filas = filasDeHoja(XLSX, wb.Sheets[nombre]);
      const h = buscarEncabezado(filas, ["PATERNO", "CARRERA"]);
      if (h < 0) return;
      const encab = filas[h];
      const tieneAsiento = encab.some((c) => norm(c).includes("ASIENTO"));
      if (tieneAsiento) return; // hojas por ceremonia (ya traen asientos): no son la lista maestra
      const cols = {
        numControl: colDe(encab, (c) => c.includes("CONTROL") || c.includes("MATRICULA")),
        paterno: colDe(encab, (c) => c.includes("PATERNO")),
        materno: colDe(encab, (c) => c.includes("MATERNO")),
        nombre: colDe(encab, (c) => c === "NOMBRE" || c === "NOMBRES" || c === "NOMBRE(S)"),
        carrera: colDe(encab, (c) => c.includes("CARRERA")),
        promedio: colDe(encab, (c) => c.includes("PROMEDIO")),
      };
      if (cols.nombre < 0 || cols.paterno < 0 || cols.carrera < 0) return;
      const alumnos = [];
      for (let i = h + 1; i < filas.length; i++) {
        const f = filas[i] || [];
        const paterno = ITT.core.limpio(f[cols.paterno]);
        const nombre = ITT.core.limpio(f[cols.nombre]);
        const carrera = ITT.core.limpio(f[cols.carrera]);
        if (!paterno && !nombre) continue;
        if (!carrera) continue;
        alumnos.push({
          numControl: cols.numControl >= 0 && f[cols.numControl] != null ? String(f[cols.numControl]).trim() : "",
          apellidoPaterno: paterno,
          apellidoMaterno: cols.materno >= 0 ? ITT.core.limpio(f[cols.materno]) : "",
          nombre, carrera,
          promedio: cols.promedio >= 0 ? f[cols.promedio] : null,
        });
      }
      const preferida = /LISTA|EGRESAD|ALUMN|GRADUAD/.test(norm(nombre)) ? 1 : 0;
      candidatas.push({ hoja: nombre, alumnos, preferida });
    });
    if (!candidatas.length) return null;
    candidatas.sort((a, b) => b.preferida - a.preferida || b.alumnos.length - a.alumnos.length);
    return candidatas[0];
  }

  // Hoja "Total": bloques por ceremonia con TOTAL, "500 BUTACAS" y PASES (valores calculados por sus fórmulas)
  function leerTotal(XLSX, wb, alumnos) {
    const nombreHoja = wb.SheetNames.find((n) => norm(n) === "TOTAL") || wb.SheetNames.find((n) => norm(n).includes("TOTAL"));
    if (!nombreHoja) return null;
    const filas = filasDeHoja(XLSX, wb.Sheets[nombreHoja]);
    const h = buscarEncabezado(filas, ["CEREMONIA", "CARRERA"]);
    if (h < 0) return null;
    const enc = filas[h];
    const col = {
      ceremonia: colDe(enc, (c) => c.includes("CEREMONIA")),
      depto: colDe(enc, (c) => c.includes("DEPARTAMENTO")),
      carrera: colDe(enc, (c) => c === "CARRERA"),
      total: colDe(enc, (c) => c === "TOTAL"),
      butacas: colDe(enc, (c) => c.includes("BUTACAS")),
      pases: colDe(enc, (c) => c === "PASES"),
    };
    const capacidadBase = (() => { const m = norm(enc[col.butacas]).match(/\d+/); return m ? Number(m[0]) : ITT.core.CAPACIDAD_BASE_INVITADOS; })();

    const bloques = [];
    let actual = null;
    for (let i = h + 1; i < filas.length; i++) {
      const f = filas[i] || [];
      const cer = ITT.core.limpio(f[col.ceremonia]);
      if (cer) { actual = { ceremonia: cer, departamento: ITT.core.limpio(f[col.depto]), carreras: [], butacas: null, pases: null }; bloques.push(actual); }
      if (!actual) continue;
      const carreraRaw = ITT.core.limpio(f[col.carrera]);
      const canon = carreraRaw ? ITT.core.carreraCanonica(carreraRaw) : null;
      if (carreraRaw) actual.carreras.push({ raw: carreraRaw, canonica: canon });
      if (typeof f[col.butacas] === "number" && actual.butacas == null) actual.butacas = f[col.butacas];
      if (typeof f[col.pases] === "number" && actual.pases == null) actual.pases = f[col.pases];
    }
    // Si el archivo no trae valores calculados de las fórmulas, se reconstruyen igual que el Excel:
    // butacas = 500 − graduados de la ceremonia ; pases = butacas / graduados
    bloques.forEach((b) => {
      if (b.pases != null && b.butacas != null) { b.fuente = "excel"; return; }
      const set = new Set(b.carreras.map((c) => c.canonica).filter(Boolean));
      const total = alumnos.filter((a) => set.has(ITT.core.carreraCanonica(a.carrera))).length;
      if (total) { b.butacas = capacidadBase - total; b.pases = b.butacas / total; b.fuente = "formula"; }
    });
    return { hoja: nombreHoja, capacidadBase, bloques: bloques.filter((b) => b.pases != null) };
  }

  function leerExcel(XLSX, arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const lista = leerAlumnos(XLSX, wb);
    if (!lista) throw new Error("No encontré una hoja con la lista de alumnos (se necesitan columnas A. PATERNO, NOMBRE y CARRERA).");
    const total = leerTotal(XLSX, wb, lista.alumnos);
    return { hojas: wb.SheetNames, hojaAlumnos: lista.hoja, alumnos: lista.alumnos, hojaTotal: total };
  }

  ITT.excel = { leerExcel };
  if (typeof module === "object" && module.exports) module.exports = ITT.excel;
})();
