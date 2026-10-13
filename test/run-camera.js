// Prueba de la cámara con una webcam FALSA de Chromium que "ve" un QR (video MJPEG).
// Uso: python3 test/make-qr-mjpeg.py ITT-A-CAMARATEST1 qr.mjpeg  y luego  MJPEG=qr.mjpeg npx electron test/run-camera.js
const { app, BrowserWindow } = require("electron");
const path = require("path"), fs = require("fs");
const SHOTS = process.env.SHOTS || require("os").tmpdir();
app.commandLine.appendSwitch("use-fake-device-for-media-stream");
app.commandLine.appendSwitch("use-fake-ui-for-media-stream");
app.commandLine.appendSwitch("use-file-for-fake-video-capture", process.env.MJPEG);
require("../main.js");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fallos = 0; const ok = (c, m) => { console.log((c ? "  ✅ " : "  ❌ ") + m); if (!c) fallos++; };

app.whenReady().then(async () => {
  await wait(1200);
  const win = BrowserWindow.getAllWindows()[0]; const errores = [];
  win.webContents.on("console-message", (_e, l, m) => { if (l >= 2) errores.push(m); });
  const ev = (c) => win.webContents.executeJavaScript(c, true);
  win.setSize(1440, 960); win.reload(); await wait(1500);

  // Prepara un alumno con un código conocido (el mismo que muestra la webcam falsa)
  const evId = await ev(`ITT.api.crearEvento({ fecha: "2026-04-29", hora: "11:00", carreras: ["Ing. Industrial"] }).then(e => e.id)`);
  await ev(`ITT.api.crearGraduado('${evId}', {apellidoPaterno:'PRUEBA', apellidoMaterno:'CAMARA', nombre:'ALUMNA', carrera:'Ing. Industrial', invitados:2})`);
  await ev(`ITT.api.generarQR('${evId}')`);
  await ev(`ITT.mock._db().codigos.find(c=>c.tipo==='alumno').token='ITT-A-CAMARATEST1'`);
  await ev(`cambiarEvento('${evId}')`); await wait(400);
  await ev(`document.querySelector('.nav-item[data-view="acceso-qr"]').click()`); await wait(600);
  await ev(`document.getElementById('qrEstacion').value='alumnos-1'; document.getElementById('qrEstacion').dispatchEvent(new Event('change'))`);

  console.log("Cámara (webcam simulada)");
  await ev(`document.getElementById('btnCamara').click()`);
  let titulo = null;
  for (let i = 0; i < 40 && !titulo; i++) { await wait(250); titulo = await ev(`document.querySelector('#qrResultado .qr-result-title')?.textContent || null`); }
  ok(await ev(`document.getElementById('qrFrame').classList.contains('activa')`), "la cámara se enciende y muestra video");
  ok(titulo === "Acceso permitido", `la cámara leyó el QR y validó el acceso → "${titulo}"`);
  const quien = await ev(`document.querySelector('#qrResultado .qr-result-sub').textContent`);
  ok(quien.includes("ALUMNA PRUEBA CAMARA"), `identificó a la persona: ${quien.replace(/\s+/g, " ").slice(0, 70)}…`);
  await wait(1500);
  fs.writeFileSync(path.join(SHOTS, "30-camara.png"), (await win.webContents.capturePage()).toPNG());
  await wait(5500); // el QR sigue frente a la cámara: NO debe volver a registrarse
  const n = await ev(`ITT.api.getAccesos('${evId}').then(a=>a.length)`);
  ok(n === 1, `con el QR fijo frente a la cámara solo hay 1 registro (hay ${n}), no se repite`);
  const lista = await ev(`navigator.mediaDevices.enumerateDevices().then(d=>d.filter(x=>x.kind==='videoinput').length)`);
  ok(lista >= 1, `se listan ${lista} cámara(s) en el selector`);
  await ev(`document.getElementById('btnCamara').click()`); await wait(400);
  ok(!(await ev(`document.getElementById('qrFrame').classList.contains('activa')`)), "el botón detiene la cámara");
  console.log("\nErrores de consola:", errores.length ? errores : "ninguno");
  console.log(fallos ? `\n❌ ${fallos} fallos` : "\n✅ Prueba de cámara OK");
  app.exit(fallos ? 1 : 0);
});
