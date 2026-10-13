// pdf-service.js — Proceso principal de Electron: convierte HTML en PDF (printToPDF de Chromium).
const { BrowserWindow } = require("electron");
const fs = require("fs"), os = require("os"), path = require("path");

async function htmlToPdf(html) {
  const tmp = path.join(os.tmpdir(), `itt-qr-${Date.now()}-${Math.floor(Math.random() * 1e6)}.html`);
  fs.writeFileSync(tmp, html, "utf8");
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await win.loadFile(tmp);
    return await win.webContents.printToPDF({ pageSize: "Letter", printBackground: true, preferCSSPageSize: true });
  } finally {
    win.destroy();
    try { fs.unlinkSync(tmp); } catch (e) { /* ignorar */ }
  }
}

function nombreArchivoSeguro(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "archivo";
}

module.exports = { htmlToPdf, nombreArchivoSeguro };
