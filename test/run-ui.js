// Prueba de interfaz de extremo a extremo (arranca la app real, importa el Excel y recorre las pantallas).
// Uso: XLSX=ruta/Lista_egresados.xlsx npx electron test/run-ui.js      (Linux sin pantalla: xvfb-run -a … --no-sandbox)
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path"), fs = require("fs");
const SHOTS = process.env.SHOTS || path.join(require("os").tmpdir(), "itt-shots"), OUT = process.env.OUT || path.join(require("os").tmpdir(), "itt-out");
const XLSX_PATH = process.env.XLSX;
if (!XLSX_PATH) { console.error("Indica el Excel de egresados:  XLSX=ruta/Lista_egresados.xlsx npx electron test/run-ui.js"); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

// En pruebas no hay diálogos: se guardan directo en OUT
dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: path.join(OUT, path.basename(o.defaultPath || "x.pdf")) });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [OUT] });
require("../main.js");
const { CEREMONIAS } = require("./fixtures");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let win, errores = [], fallos = 0;
const ev = (code) => win.webContents.executeJavaScript(code, true);
const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) fallos++; };
const shot = async (n) => { await wait(350); fs.writeFileSync(path.join(SHOTS, n + ".png"), (await win.webContents.capturePage()).toPNG()); };
const ir = async (v) => { await ev(`document.querySelector('.nav-item[data-view="${v}"]').click()`); await wait(500); };

app.whenReady().then(async () => {
  await wait(800);
  win = BrowserWindow.getAllWindows()[0];
  win.webContents.on("console-message", (_e, level, msg, line, src) => { if (level >= 2) errores.push(`[${level}] ${msg} (${path.basename(src || "")}:${line})`); });
  win.setSize(1440, 960); win.reload(); await wait(1500);

  console.log("1) Arranque");
  ok(await ev("typeof ITT.api.getEventos === 'function' && ITT.api.modo === 'simulado'"), "app cargada con backend simulado");
  ok((await ev("App.eventos.length")) === 0, "la app arranca VACÍA (sin ceremonias de prueba)");
  ok(await ev("document.getElementById('statsInicio').textContent.includes('No hay ceremonias')"), "Inicio muestra el aviso de que no hay ceremonias");
  await shot("01-inicio-vacio");
  // Datos de ejemplo SOLO para la prueba: se crean las 6 ceremonias del Excel de muestra
  await ev(`(async()=>{ for (const c of ${JSON.stringify(CEREMONIAS)}) await ITT.api.crearEvento(c); await refrescar(); })()`);
  ok((await ev("App.eventos.length")) === 6, "se crearon las 6 ceremonias de ejemplo para la prueba");

  console.log("2) Eventos: nuevo evento con carreras (+, máx. 10)");
  await ir("eventos"); await shot("02-eventos");
  await ev("abrirModalEvento()"); await wait(300);
  ok((await ev("document.querySelectorAll('#evCarreras select').length")) === 1, "el modal arranca con 1 fila de carrera");
  ok((await ev("document.querySelectorAll('#evCarreras select option').length")) === 24, "el selector muestra las 23 carreras (+ opción vacía)");
  for (let i = 0; i < 12; i++) await ev("document.getElementById('evAdd').click()");
  ok((await ev("document.querySelectorAll('#evCarreras select').length")) === 10, "no deja pasar de 10 carreras");
  ok(await ev("document.getElementById('evAdd').disabled"), "el botón + se deshabilita al llegar a 10");
  // elige 3 carreras (las demás filas quedan vacías y se ignoran)
  await ev(`(()=>{ const s=[...document.querySelectorAll('#evCarreras select')]; const pick=(i,v)=>{ s[i].value=v; s[i].dispatchEvent(new Event('change',{bubbles:true})); }; pick(0,'Ing. en Ciberseguridad'); })()`);
  await ev(`(()=>{ const s=[...document.querySelectorAll('#evCarreras select')]; s[1].value='Ing. en Inteligencia Artificial'; s[1].dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await ev(`(()=>{ const s=[...document.querySelectorAll('#evCarreras select')]; s[2].value='Ing. Industrial'; s[2].dispatchEvent(new Event('change',{bubbles:true})); })()`);
  ok(await ev("[...document.querySelectorAll('#evCarreras select')[3].options].some(o=>o.value==='Ing. Industrial' && o.disabled)"), "una carrera ya elegida aparece deshabilitada en las demás filas");
  await ev("document.getElementById('evFecha').value='2025-12-05'");
  await shot("03-modal-nuevo-evento");
  await ev("[...document.querySelectorAll('.modal-actions button')].find(b=>b.textContent.includes('Guardar')).click()"); await wait(500);
  ok((await ev("App.eventos.length")) === 7, "evento creado (ahora hay 7)");
  ok(await ev("App.evento.nombre.includes('5 de diciembre') && App.evento.carreras.length===3"), "nombre automático por fecha/hora y 3 carreras guardadas");
  await shot("04-eventos-con-nuevo");

  console.log("3) Graduados: subir Excel");
  await ev("cambiarEvento(App.eventos.find(e=>e.fecha==='2026-04-30'&&e.hora==='11:00').id)"); await wait(400);
  await ir("graduados");
  const b64 = fs.readFileSync(XLSX_PATH).toString("base64");
  await ev(`(async()=>{ const b=Uint8Array.from(atob('${b64}'),c=>c.charCodeAt(0)); await importarExcel(new File([b],'Lista_egresados_abril_2026.xlsx')); return true; })()`);
  await wait(900); await shot("05-resumen-importacion");
  ok(await ev("document.querySelector('.modal-box h2')?.textContent==='Importación terminada'"), "aparece el resumen de importación");
  await ev("[...document.querySelectorAll('.modal-actions button')].find(b=>b.textContent==='Listo').click()"); await wait(300);
  const evs = await ev("App.eventos.map(e=>({n:e.nombre,g:e.totalGraduados,i:e.totalInvitados,o:e.butacasOcupadas,l:e.butacasLibres}))");
  const tot = evs.reduce((s, e) => s + e.g, 0);
  ok(tot === 760 + 0, `760 alumnos repartidos en las ceremonias (${tot})`);
  const jue = evs.find((e) => e.n.includes("30 de abril, 11:00"));
  ok(jue.g === 139 && jue.i === 361 && jue.o === 500 && jue.l === 35, `jueves 11am: 139 grad + 361 inv = 500 ocupadas, 35 libres`);
  ok((await ev("document.querySelectorAll('#tablaGraduados tr').length")) === 139, "la tabla de Graduados muestra los 139 alumnos del jueves 11am");
  ok(await ev("[...document.querySelectorAll('#tablaGraduados tr')].slice(0,3).map(r=>r.cells[0].textContent).join()==='B1,B2,B3'"), "los primeros alumnos arrancan en B1, B2, B3");
  await shot("06-graduados");

  console.log("4) Eventos / Inicio / Asientos");
  await ir("eventos"); await shot("07-eventos-con-butacas");
  await ir("inicio"); await shot("08-inicio-con-alumnos");
  await ir("asientos"); await shot("09-asientos");
  // zona reservada con nombre
  await ev("clicAsiento('A19')"); await wait(300);
  await ev("document.getElementById('resNombre').value='Mtro. Luis Fernando Soto (Padrino)'");
  await shot("10-modal-reservado");
  await ev("[...document.querySelectorAll('.modal-actions button')].find(b=>b.textContent==='Guardar').click()"); await wait(500);
  ok(await ev("App.reservados['A19']==='Mtro. Luis Fernando Soto (Padrino)'"), "se guardó el nombre en el asiento reservado A19 (padrinos)");
  ok(await ev("document.querySelector('#seatMapAsientos .seat[data-key=\"A19\"]').classList.contains('con-nombre')"), "A19 sigue gris y muestra el punto de 'con nombre'");
  await ev("clicAsiento('H12')"); await wait(200); await ev("document.getElementById('resNombre').value='Cámara transmisión'"); await ev("[...document.querySelectorAll('.modal-actions button')].find(b=>b.textContent==='Guardar').click()"); await wait(400);
  await ev("clicAsiento('A5')"); await wait(200); await ev("document.getElementById('resNombre').value='Sra. Rosa Martínez (3ra edad)'"); await ev("[...document.querySelectorAll('.modal-actions button')].find(b=>b.textContent==='Guardar').click()"); await wait(400);
  await shot("11-asientos-con-nombres");
  // cambio de ceremonia: otro evento muestra otra carrera/otros asientos
  await ev("cambiarEvento(App.eventos.find(e=>e.fecha==='2026-04-29'&&e.hora==='11:00').id)"); await wait(500);
  ok(await ev("document.querySelectorAll('#seatMapAsientos .seat.con-nombre').length")===0, "otra ceremonia no hereda los nombres de reservados");
  await shot("12-asientos-otra-ceremonia");
  await ev("cambiarEvento(App.eventos.find(e=>e.fecha==='2026-04-30'&&e.hora==='11:00').id)"); await wait(400);


  console.log("5) Acceso QR: generar códigos y descargar PDF por carrera");
  const { execSync } = require("child_process");
  await ir("acceso-qr");
  await ev("document.querySelector('.tab[data-tab=\"generar\"]').click()"); await wait(400);
  await shot("13-qr-generar-pendiente");
  await ev("generarQR(null)"); await wait(900);
  const resumen = await ev("QR.resumen");
  ok(resumen.every((r) => r.completo), "las 4 carreras quedan con estado Completo");
  ok(resumen.reduce((s, r) => s + r.qrAlumnos, 0) === 139 && resumen.reduce((s, r) => s + r.qrInvitados, 0) === 361, "139 QR de alumnos + 361 QR de invitados = 500");
  const tokens = await ev("ITT.api.getCodigosQR(App.eventoId).then(c=>c.map(x=>x.token))");
  ok(new Set(tokens).size === tokens.length && tokens.length === 500, "los 500 códigos son únicos");
  ok(await ev("App.graduados.every(g=>g.qrGenerado)"), "todos los alumnos quedan con QR 'Generado'");
  await shot("14-qr-generar-completo");
  await ev("pdfDeCarrera('Ing. Informática')"); await wait(5000);
  const pdfs1 = fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf"));
  ok(pdfs1.length === 1, `se descargó 1 PDF: ${pdfs1[0]}`);
  const info = execSync(`pdfinfo "${path.join(OUT, pdfs1[0])}"`).toString();
  const pags = Number((info.match(/Pages:\s+(\d+)/) || [])[1]);
  const informatica = resumen.find((r) => r.carrera === "Ing. Informática");
  const tarjetas = informatica.qrAlumnos + informatica.qrInvitados;
  ok(pags >= Math.ceil(tarjetas / 12) && pags <= Math.ceil(tarjetas / 12) + 1, `el PDF tiene ${pags} páginas para ${tarjetas} tarjetas (12 por página)`);
  const txt = execSync(`pdftotext "${path.join(OUT, pdfs1[0])}" -`).toString();
  ok(txt.includes("ALUMNO") && txt.includes("INVITADO 1 DE") && /ITT-A-[A-Z0-9]{12}/.test(txt), "el PDF trae tarjetas de ALUMNO e INVITADO con su código");
  await ev("pdfDeTodas()"); await wait(9000);
  const pdfs2 = fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf"));
  ok(pdfs2.length === 4, `descarga de todas las carreras: ${pdfs2.length} PDF (uno por carrera)`);
  execSync(`pdftoppm -png -r 60 -f 1 -l 1 "${path.join(OUT, pdfs1[0])}" "${path.join(SHOTS, "15-pdf-pagina1")}"`);

  console.log("6) Escaneo: estaciones, anti-duplicidad y errores");
  await ev("document.querySelector('.tab[data-tab=\"escaneo\"]').click()"); await wait(300);
  await ev("document.getElementById('qrFuente').value='lector'; document.getElementById('qrFuente').dispatchEvent(new Event('change'))");
  const cods = await ev("ITT.api.getCodigosQR(App.eventoId)");
  const tA = cods.filter((c) => c.tipo === "alumno"), tI = cods.filter((c) => c.tipo === "invitado");
  const escanear = async (t) => { await ev(`(()=>{ const i=document.getElementById('qrManual'); i.value='${t}'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); })()`); await wait(450); };
  const resultado = () => ev("document.querySelector('#qrResultado .qr-result-title')?.textContent");
  await ev("document.getElementById('qrEstacion').value='alumnos-1'; document.getElementById('qrEstacion').dispatchEvent(new Event('change'))");
  await escanear(tA[0].token);
  ok((await resultado()) === "Acceso permitido", `estación Alumnos 1: QR de alumno → "Acceso permitido"`);
  await shot("16-qr-acceso-permitido");
  await escanear(tA[0].token);
  ok((await resultado()) === "Código ya utilizado", "el mismo QR otra vez → rechazado (anti-duplicidad)");
  await shot("17-qr-ya-usado");
  await escanear(tI[0].token);
  ok((await resultado()) === "Escáner equivocado", "QR de invitado en la estación de alumnos → 'Escáner equivocado'");
  await ev("document.getElementById('qrEstacion').value='invitados-2'; document.getElementById('qrEstacion').dispatchEvent(new Event('change'))");
  await escanear(tI[0].token);
  ok((await resultado()) === "Acceso permitido", "estación Invitados 2: QR de invitado → permitido");
  await escanear(tA[1].token);
  ok((await resultado()) === "Escáner equivocado", "QR de alumno en estación de invitados → 'Escáner equivocado'");
  await escanear("ITT-A-INVENTADO1234");
  ok((await resultado()) === "Código no válido", "código inventado → 'Código no válido'");
  const st = await ev("ITT.api.getEstadisticasEvento(App.eventoId)");
  ok(st.asistentes.alumnos === 1 && st.asistentes.invitados === 1 && st.asistentes.total === 2, "contadores en vivo: 1 alumno + 1 invitado = 2 asistentes");
  await shot("18-qr-historial");
  // QR de otra ceremonia
  await ev("cambiarEvento(App.eventos.find(e=>e.fecha==='2026-04-28'&&e.hora==='15:00').id)"); await wait(400);
  await ev("generarQR(null)"); await wait(600);
  const otro = await ev("ITT.api.getCodigosQR(App.eventoId).then(c=>c.find(x=>x.tipo==='alumno').token)");
  await ev("cambiarEvento(App.eventos.find(e=>e.fecha==='2026-04-30'&&e.hora==='11:00').id)"); await wait(400);
  await ev("document.getElementById('qrEstacion').value='alumnos-1'; document.getElementById('qrEstacion').dispatchEvent(new Event('change'))");
  await escanear(otro);
  ok((await resultado()) === "Pertenece a otra ceremonia", "QR de otra ceremonia → rechazado");

  console.log("7) Estadísticas y Reportes");
  const dic = await ev("App.eventos.find(e=>e.fecha==='2025-12-05').id");
  for (const [p, n] of [["LOPEZ", "ANA"], ["RUIZ", "LUIS"], ["SOTO", "MARIA"]]) await ev(`ITT.api.crearGraduado('${dic}', {apellidoPaterno:'${p}', apellidoMaterno:'X', nombre:'${n}', carrera:'Ing. Industrial', invitados:2})`);
  await ir("estadisticas"); await wait(700); await shot("19-estadisticas");
  const g = await ev("ITT.api.getEstadisticasGlobales()");
  ok(g.semestres.length === 2 && g.semestres[0].semestre === "2025-2" && g.semestres[0].graduados === 3 && g.semestres[1].graduados === 760 && g.totalRegistrado === 763, "por semestre: 2025-2 = 3, 2026-1 = 760 · acumulado total = 763");
  ok((await ev("document.querySelectorAll('#chartSemestres svg rect[rx]').length")) === 2 && (await ev("document.querySelectorAll('#chartAcumulado svg rect[rx]').length")) === 2, "2 gráficas de barras verticales, con 2 barras cada una");
  const antes = await ev("document.getElementById('progresoTexto').textContent");
  await escanear; // (sin efecto: solo para claridad)
  await ev("ITT.api.validarAcceso(App.eventoId, '" + tA[2].token + "', {id:'alumnos-1', nombre:'Alumnos 1', tipo:'alumno'})"); await wait(2600);
  const despues = await ev("document.getElementById('progresoTexto').textContent");
  ok(antes !== despues, `el panel en vivo se actualiza solo (${antes} → ${despues})`);
  await ir("reportes"); await shot("20-reportes");
  await ir("inicio"); await shot("21-inicio-final");
  await ir("asientos"); await shot("22-asientos-final");

  fs.writeFileSync(path.join(OUT, "errores.txt"), errores.join("\n"));
  console.log("\nErrores/advertencias de consola:", errores.length ? errores : "ninguno");
  console.log(fallos ? `\n❌ ${fallos} fallos` : "\n✅ Todas las pruebas de interfaz pasaron");
  app.exit(fallos ? 1 : 0);
});
