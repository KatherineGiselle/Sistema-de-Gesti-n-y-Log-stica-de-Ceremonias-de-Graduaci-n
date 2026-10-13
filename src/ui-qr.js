// ui-qr.js — Acceso QR: escaneo (cámara / lector USB / manual) y generación de códigos por carrera.
// ⚠️ BACKEND: la validación (código válido, de esta ceremonia, de la estación correcta y NO usado)
// debe hacerse en el servidor de forma atómica, para que 2–3 estaciones trabajen a la vez sin duplicar accesos.

const Pref = {
  get(k, d) { try { const v = localStorage.getItem("itt." + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("itt." + k, v); } catch (e) { /* sin almacenamiento */ } },
};
const ESTACIONES = [
  { id: "alumnos-1", nombre: "Alumnos 1", tipo: "alumno" },
  { id: "invitados-1", nombre: "Invitados 1", tipo: "invitado" },
  { id: "invitados-2", nombre: "Invitados 2", tipo: "invitado" },
];
const QR = { tab: "escaneo", estacion: Pref.get("estacion", "alumnos-1"), fuente: Pref.get("fuente", "camara"), camaraId: Pref.get("camaraId", ""), cola: Promise.resolve(), resumen: [], accesos: [] };
const estacionActual = () => ESTACIONES.find((e) => e.id === QR.estacion) || ESTACIONES[0];

const Sonido = {
  ctx: null,
  tono(freq, dur, tipo = "sine") {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = tipo; o.frequency.value = freq; g.gain.value = 0.08; o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) { /* sin audio */ }
  },
  ok() { this.tono(880, 0.12); }, error() { this.tono(200, 0.35, "square"); },
};

// ---------- Cámara ----------
const Escaner = {
  stream: null, activo: false, timer: null, ultimo: { t: "", ms: 0 },
  async iniciar() {
    this.detener();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Este equipo no permite usar la cámara.");
    const id = $("#qrCamara").value;
    const video = { width: { ideal: 1280 }, height: { ideal: 720 } };
    if (id) video.deviceId = { exact: id }; else video.facingMode = "environment";
    this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    const v = $("#qrVideo"); v.srcObject = this.stream; await v.play();
    this.activo = true; $("#qrFrame").classList.add("activa"); $("#btnCamara").textContent = "Detener cámara";
    await listarCamaras();
    this.bucle();
  },
  bucle() {
    if (!this.activo) return;
    const v = $("#qrVideo");
    if (v.readyState >= 2 && v.videoWidth) {
      const c = $("#qrCanvas"), k = Math.min(1, 720 / v.videoWidth);
      c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const r = jsQR(img.data, c.width, c.height, { inversionAttempts: "dontInvert" });
      if (r && r.data) this.emitir(r.data);
    }
    this.timer = setTimeout(() => requestAnimationFrame(() => this.bucle()), 90);
  },
  emitir(texto) {
    // Mientras el MISMO QR siga frente a la cámara no se vuelve a procesar; si se retira ~2 s y vuelve a pasar, sí (→ "ya utilizado")
    const ahora = Date.now();
    const sigueAhi = texto === this.ultimo.t && ahora - this.ultimo.ms < 2000;
    this.ultimo = { t: texto, ms: ahora };
    if (sigueAhi) return;
    procesarCodigo(texto);
  },
  detener() {
    this.activo = false; clearTimeout(this.timer);
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    const v = $("#qrVideo"); if (v) v.srcObject = null;
    const f = $("#qrFrame"); if (f) f.classList.remove("activa");
    const b = $("#btnCamara"); if (b) b.textContent = "Iniciar cámara";
  },
};

async function listarCamaras() {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const sel = $("#qrCamara");
    sel.innerHTML = cams.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || "Cámara " + (i + 1))}</option>`).join("") || `<option value="">(no se detectó cámara)</option>`;
    if (QR.camaraId && cams.some((c) => c.deviceId === QR.camaraId)) sel.value = QR.camaraId;
  } catch (e) { /* sin permisos todavía */ }
}

// ---------- Validación de un código leído (cámara, lector USB o manual) ----------
function procesarCodigo(texto) {
  texto = String(texto || "").trim();
  if (!texto) return QR.cola;
  QR.cola = QR.cola.then(async () => {
    if (!App.evento) return;
    const est = estacionActual();
    try {
      const r = await ITT.api.validarAcceso(App.eventoId, texto, { id: est.id, nombre: est.nombre, tipo: est.tipo });
      mostrarResultado(r); r.ok ? Sonido.ok() : Sonido.error();
      await refrescarAcceso();
    } catch (e) { Toast.show(e.message || String(e), "error"); }
  });
  return QR.cola;
}

function mostrarResultado(r) {
  const titulos = { ya_usado: "Código ya utilizado", no_existe: "Código no válido", tipo_incorrecto: "Escáner equivocado", otra_ceremonia: "Pertenece a otra ceremonia" };
  const persona = r.nombre ? `<br><strong>${esc(r.tipoTxt || "")}</strong> ${esc(r.nombre)}<br>${esc(r.carrera || "")}${r.asiento && r.tipo === "alumno" ? " · Asiento " + esc(r.asiento) : ""}` : "";
  $("#qrResultado").innerHTML = `
    <div class="qr-result-card ${r.ok ? "ok" : "error"}">
      <div class="qr-result-icon">${r.ok ? "✅" : "⛔"}</div>
      <div><div class="qr-result-title">${r.ok ? "Acceso permitido" : titulos[r.motivo] || "Acceso rechazado"}</div>
      <div class="qr-result-sub">${r.ok ? "" : esc(r.mensaje) + "<br>"}${persona}<br><span style="color:var(--muted);">${esc(r.estacion)} · ${new Date(r.hora).toLocaleTimeString("es-MX")}</span></div></div>
    </div>`;
}

// ---------- Datos y pintado ----------
async function refrescarAcceso() {
  if (!App.evento) return;
  const id = App.eventoId;
  const [acc, res, st] = await Promise.all([ITT.api.getAccesos(id), ITT.api.getResumenQR(id), ITT.api.getEstadisticasEvento(id)]);
  QR.accesos = acc; QR.resumen = res; App.stats = st;
  pintarHistorial(); pintarMiniStats(); pintarTablaQR();
}
function pintarHistorial() {
  const motivos = { ok: "Permitido", ya_usado: "Ya usado", no_existe: "No válido", tipo_incorrecto: "Escáner equivocado", otra_ceremonia: "Otra ceremonia" };
  $("#tablaAccesos").innerHTML = QR.accesos.length ? QR.accesos.slice(0, 60).map((a) => `
    <tr><td>${new Date(a.hora).toLocaleTimeString("es-MX")}</td><td>${esc(a.estacion)}</td>
    <td>${esc(a.nombre || "—")}</td><td>${a.tipo ? (a.tipo === "alumno" ? "Alumno" : esc(a.tipoTxt || "Invitado")) : "—"}</td>
    <td><span class="badge ${a.ok ? "si" : "mal"}">${motivos[a.motivo] || a.motivo}</span></td></tr>`).join("")
    : `<tr><td colspan="5" class="empty-state">Sin escaneos todavía.</td></tr>`;
}
function pintarMiniStats() {
  const s = App.stats; if (!s) { $("#qrMiniStats").innerHTML = ""; return; }
  const m = (l, v) => `<div class="mini-stat"><div class="l">${l}</div><div class="v">${v}</div></div>`;
  $("#qrMiniStats").innerHTML = m("Alumnos presentes", `${s.asistentes.alumnos} / ${s.graduados}`) + m("Invitados presentes", `${s.asistentes.invitados} / ${s.invitados}`) + m("Total asistentes", `${s.asistentes.total} / ${s.esperados}`);
}
function pintarTablaQR() {
  const t = $("#tablaQR");
  if (!QR.resumen.length) { t.innerHTML = `<tr><td colspan="7" class="empty-state">Sin datos.</td></tr>`; return; }
  t.innerHTML = QR.resumen.map((r, i) => {
    const total = r.qrAlumnos + r.qrInvitados;
    const estado = !r.graduados ? `<span class="badge neutro">Sin alumnos</span>` : r.completo ? `<span class="badge si">Completo</span>` : total ? `<span class="badge no">Incompleto</span>` : `<span class="badge no">Pendiente</span>`;
    return `<tr><td><div class="carrera-cell"><i class="carrera-dot" style="background:${ITT.core.colorPorCarrera(r.carrera)}"></i>${esc(r.carrera)}</div></td>
      <td class="num">${r.graduados}</td><td class="num">${r.invitadosEsperados}</td>
      <td class="num">${r.qrAlumnos}</td><td class="num">${r.qrInvitados}</td><td>${estado}</td>
      <td style="white-space:nowrap;text-align:right;"><button class="btn-secondary btn-sm" data-gen="${i}" ${r.graduados ? "" : "disabled"}>Generar</button>
      <button class="btn-primary btn-sm" data-pdf="${i}" ${r.graduados ? "" : "disabled"}>⬇ PDF</button></td></tr>`;
  }).join("");
}

// ---------- Generación y descarga ----------
async function generarQR(carrera) {
  const r = await ITT.api.generarQR(App.eventoId, carrera || null);
  await refrescar();
  Toast.show(`QR listos: ${fmt(r.alumnos)} alumnos y ${fmt(r.invitados)} invitados${r.nuevos ? ` (${fmt(r.nuevos)} nuevos)` : " (ya estaban generados)"}.`, "ok");
}
function necesitaApp() {
  if (window.electronAPI) return true;
  Toast.show("La descarga de PDF solo está disponible en la app de escritorio (npm start).", "error", { ms: 7000 });
  return false;
}
async function pdfDeCarrera(carrera) {
  if (!necesitaApp()) return;
  await ITT.api.generarQR(App.eventoId, carrera);
  const items = await ITT.api.getCodigosQR(App.eventoId, carrera);
  if (!items.length) return Toast.show("Esta carrera no tiene códigos para imprimir.", "error");
  const html = ITT.qr.htmlTarjetas({ evento: App.evento, carrera, items });
  Toast.show(`Preparando PDF de ${carrera} (${fmt(items.length)} códigos)…`, "info", { ms: 2500 });
  const r = await window.electronAPI.guardarPdf(html, `QR ${carrera} ${App.evento.nombre}`);
  await refrescar();
  if (r.cancelado) return;
  Toast.show("PDF guardado.", "ok", { accion: { texto: "Mostrar", onClick: () => window.electronAPI.mostrarEnCarpeta(r.archivos[0]) }, ms: 9000 });
}
async function pdfDeTodas() {
  if (!necesitaApp()) return;
  const carreras = QR.resumen.filter((r) => r.graduados > 0).map((r) => r.carrera);
  if (!carreras.length) return Toast.show("No hay alumnos en esta ceremonia.", "error");
  await ITT.api.generarQR(App.eventoId, null);
  const items = [];
  for (const c of carreras) {
    const cods = await ITT.api.getCodigosQR(App.eventoId, c);
    items.push({ nombre: `QR ${c} ${App.evento.nombre}`, html: ITT.qr.htmlTarjetas({ evento: App.evento, carrera: c, items: cods }) });
  }
  Toast.show(`Preparando ${carreras.length} PDF…`, "info", { ms: 2500 });
  const r = await window.electronAPI.guardarPdfsEnCarpeta(items);
  await refrescar();
  if (r.cancelado) return;
  Toast.show(`${r.archivos.length} PDF guardados.`, "ok", { accion: { texto: "Mostrar carpeta", onClick: () => window.electronAPI.mostrarEnCarpeta(r.archivos[0]) }, ms: 9000 });
}

// ---------- Vista ----------
function aplicarFuente() {
  const camara = QR.fuente === "camara";
  $("#qrCamaraWrap").classList.toggle("hidden", !camara);
  $("#btnCamara").classList.toggle("hidden", !camara);
  $("#qrHint").textContent = camara ? "Cámara apagada" : "Lector USB listo: escanea con el lector";
  if (!camara) { Escaner.detener(); enfocarManual(); }
}
function enfocarManual() { if (QR.fuente === "lector" && App.vista === "acceso-qr" && QR.tab === "escaneo") { const i = $("#qrManual"); if (i) i.focus(); } }

Views["acceso-qr"] = {
  async render() {
    $("#qrEstacion").innerHTML = ESTACIONES.map((e) => `<option value="${e.id}">${esc(e.nombre)} (${e.tipo === "alumno" ? "alumnos" : "invitados"})</option>`).join("");
    $("#qrEstacion").value = QR.estacion; $("#qrFuente").value = QR.fuente;
    aplicarFuente();
    if (!App.evento) { $("#tablaAccesos").innerHTML = ""; $("#tablaQR").innerHTML = ""; return; }
    await refrescarAcceso();
  },
  entrar() { enfocarManual(); },
  salir() { Escaner.detener(); },
};

function ligarQR() {
  $$(".tab").forEach((b) => b.addEventListener("click", () => {
    QR.tab = b.dataset.tab;
    $$(".tab").forEach((x) => x.classList.toggle("active", x === b));
    $("#tab-escaneo").classList.toggle("hidden", QR.tab !== "escaneo");
    $("#tab-generar").classList.toggle("hidden", QR.tab !== "generar");
    if (QR.tab !== "escaneo") Escaner.detener(); else enfocarManual();
  }));
  $("#qrEstacion").addEventListener("change", (e) => { QR.estacion = e.target.value; Pref.set("estacion", QR.estacion); Toast.show(`Estación: ${estacionActual().nombre}`, "info", { ms: 1500 }); });
  $("#qrFuente").addEventListener("change", (e) => { QR.fuente = e.target.value; Pref.set("fuente", QR.fuente); aplicarFuente(); });
  $("#qrCamara").addEventListener("change", async (e) => { QR.camaraId = e.target.value; Pref.set("camaraId", QR.camaraId); if (Escaner.activo) { try { await Escaner.iniciar(); } catch (err) { Toast.show(err.message, "error"); } } });
  $("#btnCamara").addEventListener("click", async () => {
    if (Escaner.activo) return Escaner.detener();
    try { await Escaner.iniciar(); }
    catch (err) {
      Escaner.detener();
      const msg = err.name === "NotAllowedError" ? "Permiso de cámara denegado. Actívalo en la configuración del sistema." : err.name === "NotFoundError" ? "No se detectó ninguna cámara conectada." : err.message || String(err);
      Toast.show(msg, "error", { ms: 8000 });
    }
  });

  // Lector USB (se comporta como teclado: escribe el código y manda Enter) o captura manual
  const enviarManual = () => { const i = $("#qrManual"); const t = i.value; i.value = ""; procesarCodigo(t).then(enfocarManual); };
  $("#qrManual").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); enviarManual(); } });
  $("#btnManual").addEventListener("click", enviarManual);
  document.addEventListener("keydown", (e) => {
    if (App.vista !== "acceso-qr" || QR.tab !== "escaneo" || QR.fuente !== "lector" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement || {}).tagName;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag) || $("#modalRoot").children.length) return;
    if (e.key.length === 1 || e.key === "Enter") $("#qrManual").focus();
  });

  $("#btnSimular").addEventListener("click", async () => {
    if (!App.evento) return;
    const est = estacionActual();
    const todos = (await ITT.api.getCodigosQR(App.eventoId)).filter((c) => c.tipo === est.tipo);
    if (!todos.length) return Toast.show("Primero genera los QR en la pestaña “Generar QR”.", "error");
    procesarCodigo(todos[Math.floor(Math.random() * todos.length)].token);
  });

  $("#tablaQR").addEventListener("click", async (e) => {
    const g = e.target.closest("[data-gen]"), p = e.target.closest("[data-pdf]");
    try {
      if (g) await generarQR(QR.resumen[+g.dataset.gen].carrera);
      if (p) await pdfDeCarrera(QR.resumen[+p.dataset.pdf].carrera);
    } catch (err) { Toast.show(err.message || String(err), "error"); }
  });
  $("#btnGenerarTodos").addEventListener("click", async () => { try { await generarQR(null); } catch (err) { Toast.show(err.message, "error"); } });
  $("#btnDescargarTodos").addEventListener("click", async () => { try { await pdfDeTodas(); } catch (err) { Toast.show(err.message, "error"); } });
}
