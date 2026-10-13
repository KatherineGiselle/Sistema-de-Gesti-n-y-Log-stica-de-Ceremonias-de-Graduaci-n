// preload.js — Puente seguro (contextIsolation) entre la interfaz y las funciones del sistema operativo.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  guardarPdf: (html, nombreSugerido) => ipcRenderer.invoke("pdf:guardar", { html, nombreSugerido }),
  guardarPdfsEnCarpeta: (items) => ipcRenderer.invoke("pdf:guardarVarios", { items }),
  mostrarEnCarpeta: (ruta) => ipcRenderer.invoke("shell:mostrar", ruta),
});
