// Casos límite: archivo inválido, Excel sin hoja Total, re-subir el mismo archivo, sin ceremonias.
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");
const XLSX = require("xlsx");
dialog.showSaveDialog = async () => ({ canceled: true });
require("../main.js");
const { CEREMONIAS } = require("./fixtures");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0; const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) fallos++; };

app.whenReady().then(async () => {
  await wait(1200);
  const win = BrowserWindow.getAllWindows()[0]; const errores = [];
  win.webContents.on("console-message", (_e, l, m) => { if (l >= 2) errores.push(m); });
  const ev = (c) => win.webContents.executeJavaScript(c, true);
  win.reload(); await wait(1500);
  await ev(`(async()=>{ for (const c of ${JSON.stringify(CEREMONIAS)}) await ITT.api.crearEvento(c); await refrescar(); })()`);
  const b64 = (buf) => Buffer.from(buf).toString("base64");
  const subir = (buf, nombre) => ev(`(async()=>{ const b=Uint8Array.from(atob('${b64(buf)}'),c=>c.charCodeAt(0)); await importarExcel(new File([b],'${nombre}')); return true; })()`);

  console.log("Archivo que NO es Excel");
  await subir(Buffer.from("esto no es un excel"), "malo.xlsx"); await wait(500);
  ok(await ev(`!!document.querySelector('#toastRoot .toast.error')`), "muestra un aviso de error en vez de romperse");

  console.log("Excel sin hoja Total (usa la fórmula 500 − graduados)");
  const filas = [["#", "NO. CONTROL", "A. PATERNO", "A. MATERNO", "NOMBRE", "CARRERA"]];
  const nombres = [["ZAVALA", "ROJAS", "ANA"], ["AGUILAR", "", "LUIS"], ["AGUILAR", "BELTRAN", "MARIA"], ["ÑANDU", "PEREZ", "JOSE"], ["BRAVO", "LEON", "SOFIA"]];
  nombres.forEach((n, i) => filas.push([i + 1, "2021000" + i, n[0], n[1], n[2], i < 4 ? "INGENIERIA CIVIL" : "ARQUITECTURA"]));
  filas.push([6, "20210099", "FUERA", "DE", "LUGAR", "INGENIERIA EN CIBERSEGURIDAD"]); // carrera sin ceremonia en el semestre
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Alumnos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await ev(`cambiarEvento(App.eventos.find(e=>e.fecha==='2026-04-28'&&e.hora==='15:00').id)`); await wait(400);
  await subir(buf, "pequeno.xlsx"); await wait(800);
  const m = await ev(`({ g: App.graduados.length, inv: App.evento.totalInvitados, pases: App.evento.pases, fuente: App.evento.pasesFuente, orden: App.graduados.map(g=>g.apellidoPaterno+'/'+g.fila+g.asiento).join(' '), aviso: document.querySelector('.modal-box .aviso')?.textContent || '' })`);
  ok(m.g === 5, `5 alumnos cargados en la ceremonia de Civil/Arquitectura (${m.g})`);
  ok(m.fuente === "formula" && Math.abs(m.pases - 99) < 0.01, `PASES por fórmula = (500−5)/5 = ${m.pases} → tope de 3 boletos`);
  ok(m.inv === 15, `invitados = 3 por alumno = 15 (${m.inv})`);
  ok(m.orden === "AGUILAR/B1 AGUILAR/B2 ÑANDU/B3 ZAVALA/B4 BRAVO/B5", "orden por carrera (Civil, luego Arquitectura) y apellidos (Ñ después de N, A–Z): " + m.orden);
  ok(m.aviso.includes("Ing. en Ciberseguridad"), "avisa que la carrera sin ceremonia en el semestre no se importó");
  await ev(`document.querySelector('.modal-actions button').click()`);

  console.log("Re-subir el mismo archivo");
  await subir(buf, "pequeno.xlsx"); await wait(800);
  const r = await ev(`({ g: App.graduados.length, txt: document.querySelector('.resumen-grid')?.textContent.replace(/\\s+/g,' ') })`);
  ok(r.g === 5, `no duplica alumnos (siguen ${r.g})`);
  ok(/Agregados\s*0/.test(r.txt) && /Actualizados\s*5/.test(r.txt), `resumen: ${r.txt}`);
  await ev(`document.querySelector('.modal-actions button').click()`);

  console.log("Sin ceremonias: ninguna pantalla debe fallar");
  await ev(`(async()=>{ for (const e of App.eventos.slice()) await ITT.api.eliminarEvento(e.id); await refrescar(); })()`); await wait(500);
  for (const v of ["inicio", "eventos", "graduados", "acceso-qr", "reportes", "asientos", "estadisticas", "configuracion"]) {
    await ev(`document.querySelector('.nav-item[data-view="${v}"]').click()`); await wait(350);
  }
  ok(errores.length === 0, "las 8 pantallas abren sin ceremonias y sin errores de consola" + (errores.length ? ": " + errores.join(" | ") : ""));
  await ev(`document.querySelector('.nav-item[data-view="graduados"]').click()`); await wait(300);
  await ev(`abrirModalGraduado()`); await wait(200);
  ok(await ev(`!!document.querySelector('#toastRoot .toast.error')`), "agregar graduado sin ceremonia avisa en vez de fallar");
  console.log(fallos ? `\n❌ ${fallos} fallos` : "\n✅ Casos límite OK");
  app.exit(fallos ? 1 : 0);
});
