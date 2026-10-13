const { app, BrowserWindow, ipcMain, dialog, shell, session, systemPreferences } = require("electron");
const path = require("path");
const fs = require("fs");
const { htmlToPdf, nombreArchivoSeguro } = require("./pdf-service");

let ventana = null;

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1180, minHeight: 720,
    backgroundColor: "#f4f6fa",
    title: "Ceremonias de Graduación — ITT",
    icon: path.join(__dirname, "src", "assets", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  ventana.setMenuBarVisibility(false);
  ventana.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(async () => {
  // Cámara: se permite solo el permiso "media" (escaneo de QR)
  session.defaultSession.setPermissionRequestHandler((_wc, permiso, cb) => cb(permiso === "media"));
  session.defaultSession.setPermissionCheckHandler((_wc, permiso) => permiso === "media");
  if (process.platform === "darwin") { try { await systemPreferences.askForMediaAccess("camera"); } catch (e) { /* el usuario puede darlo luego */ } }
  crearVentana();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ---------- Descarga de PDF (QR por carrera) ----------
ipcMain.handle("pdf:guardar", async (_e, { html, nombreSugerido }) => {
  const r = await dialog.showSaveDialog(ventana, {
    title: "Guardar PDF de códigos QR", defaultPath: nombreArchivoSeguro(nombreSugerido || "QR") + ".pdf", filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (r.canceled || !r.filePath) return { cancelado: true };
  fs.writeFileSync(r.filePath, await htmlToPdf(html));
  return { archivos: [r.filePath] };
});

ipcMain.handle("pdf:guardarVarios", async (_e, { items }) => {
  const r = await dialog.showOpenDialog(ventana, { title: "Elige la carpeta donde guardar los PDF", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths.length) return { cancelado: true };
  const archivos = [];
  for (const it of items) {
    const destino = path.join(r.filePaths[0], nombreArchivoSeguro(it.nombre) + ".pdf");
    fs.writeFileSync(destino, await htmlToPdf(it.html));
    archivos.push(destino);
  }
  return { carpeta: r.filePaths[0], archivos };
});

ipcMain.handle("shell:mostrar", (_e, ruta) => { shell.showItemInFolder(ruta); return true; });
