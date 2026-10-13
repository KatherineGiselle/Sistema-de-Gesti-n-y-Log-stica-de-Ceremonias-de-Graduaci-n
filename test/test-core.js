// Prueba de la lógica: importa el Excel real y compara el acomodo contra las hojas por ceremonia.
// Uso:  node test/test-core.js ruta/al/archivo.xlsx
global.window = global;
const path = require("path"), fs = require("fs");
const XLSX = require("xlsx");
["theater-layout", "core", "excel-import", "mock-backend"].forEach((f) => require(path.join(__dirname, "..", "src", f + ".js")));
const { CEREMONIAS } = require("./fixtures");
const archivo = process.argv[2] || process.env.XLSX;
if (!archivo) { console.error("Uso: node test/test-core.js ruta/Lista_egresados.xlsx"); process.exit(2); }
let fallos = 0;
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) fallos++; };

(async () => {
  const buf = fs.readFileSync(archivo);
  const datos = ITT.excel.leerExcel(XLSX, buf);
  const idDe = {};
  for (const c of CEREMONIAS) { const e = await ITT.mock.crearEvento(c); idDe[c.fecha + " " + c.hora] = e.id; }
  const eventos0 = await ITT.mock.getEventos();
  ok(eventos0.length === 6, "la app arranca vacía: las 6 ceremonias las crea la prueba");
  const res = await ITT.mock.importarGraduados({ eventoId: eventos0[0].id, alumnos: datos.alumnos, hojaTotal: datos.hojaTotal });
  console.log("IMPORTACIÓN:", { leidos: res.leidos, agregados: res.agregados, actualizados: res.actualizados, sinCeremonia: res.sinCeremonia, desconocidas: res.carreraDesconocida });
  ok(res.agregados === 760, `se agregaron 760 alumnos (${res.agregados})`);

  const wb = XLSX.read(buf, { type: "array" });
  const hojas = { "28 abril 11am": idDe["2026-04-28 11:00"], "28 abril 3pm": idDe["2026-04-28 15:00"], "29 abril 11am": idDe["2026-04-29 11:00"], "29 abril 3pm": idDe["2026-04-29 15:00"], "30 abril 11am": idDe["2026-04-30 11:00"], "30 abril 3pm": idDe["2026-04-30 15:00"] };
  const T = (s) => ITT.core.limpio(s);
  for (const [hoja, evId] of Object.entries(hojas)) {
    const gs = await ITT.mock.getGraduados(evId);
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: null });
    const esperado = new Map();
    filas.forEach((r) => { if (r && ITT.layout.FILAS.includes(r[0]) && typeof r[1] === "number") esperado.set([T(r[2]), T(r[3]), T(r[4])].join("|"), r[0] + r[1]); });
    let coinciden = 0, difieren = 0, faltan = 0; const ejemplos = [];
    gs.forEach((g) => {
      const k = [g.apellidoPaterno, g.apellidoMaterno, g.nombre].join("|");
      if (!esperado.has(k)) { faltan++; return; }
      if (esperado.get(k) === g.fila + g.asiento) coinciden++; else { difieren++; if (ejemplos.length < 3) ejemplos.push(`${k}: hoja=${esperado.get(k)} sistema=${g.fila}${g.asiento}`); }
    });
    const pct = ((coinciden / gs.length) * 100).toFixed(1);
    console.log(`\n[${hoja}] graduados en sistema: ${gs.length} | en la hoja: ${esperado.size} | asiento idéntico: ${coinciden} (${pct}%) | distinto: ${difieren} | no están en la hoja: ${faltan}`);
    if (ejemplos.length) console.log("    ej:", ejemplos);
    if (hoja !== "28 abril 11am") ok(coinciden / gs.length > 0.9, `${hoja}: ≥90% de asientos idénticos a los de la coordinación`);
  }

  console.log("\nINVITADOS Y BUTACAS:");
  const evs = await ITT.mock.getEventos();
  evs.forEach((e) => console.log(`  ${e.nombre} | grad ${e.totalGraduados} | inv ${e.totalInvitados} | ocupadas ${e.butacasOcupadas} | libres ${e.butacasLibres} | pases ${e.pases && e.pases.toFixed(4)} (${e.pasesFuente})`));
  const e5 = evs.find((e) => e.id === idDe["2026-04-30 11:00"]);
  ok(e5.totalGraduados === 139 && e5.totalInvitados === 361, "30 abril 11am: 139 graduados + 361 invitados = 500 (500 BUTACAS − 139)");
  const e1 = evs.find((e) => e.id === idDe["2026-04-28 11:00"]);
  ok(e1.totalGraduados === 115 && e1.totalInvitados === 345, "28 abril 11am: pases 3.35 → tope de 3 boletos = 345 invitados");
  const gs5 = await ITT.mock.getGraduados(idDe["2026-04-30 11:00"]);
  ok(gs5.every((g) => g.invitados === 2 || g.invitados === 3), "todos los alumnos del jueves 11am reciben 2 o 3 boletos");

  console.log("\nESTADÍSTICAS GLOBALES:", JSON.stringify(await ITT.mock.getEstadisticasGlobales()));
  console.log(fallos ? `\n❌ ${fallos} verificaciones fallaron` : "\n✅ Todas las verificaciones pasaron");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
