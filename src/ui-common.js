// ui-common.js — Estado compartido, avisos, modales y utilidades de la interfaz.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("es-MX");

// ⚠️ BACKEND: el usuario en sesión (login) lo define el backend. Aquí es un dato fijo de demostración.
const USUARIO = { nombre: "Ashlee Evelin Robles Gallegos" };

const App = {
  eventos: [], eventoId: null, evento: null,   // ceremonia seleccionada (compartida por todas las pantallas)
  graduados: [], reservados: {}, stats: null,
  vista: "inicio", vistaMapa: "carreras",
};
const Views = {}; // cada pantalla registra { render, entrar?, salir? }

// ---------- Avisos ----------
const Toast = {
  show(msg, tipo = "info", { accion = null, ms = 4500 } = {}) {
    const t = document.createElement("div");
    t.className = "toast " + tipo;
    t.innerHTML = `<span>${esc(msg)}</span>`;
    if (accion) { const b = document.createElement("button"); b.textContent = accion.texto; b.onclick = () => { accion.onClick(); t.remove(); }; t.appendChild(b); }
    $("#toastRoot").appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
};

// ---------- Modales ----------
const Modal = {
  abrir({ titulo, cuerpo = "", botones = [], ancho = false, alMontar = null }) {
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal-box ${ancho ? "ancho" : ""}" role="dialog" aria-modal="true"><h2>${esc(titulo)}</h2><div class="modal-body">${cuerpo}</div><div class="form-error"></div><div class="modal-actions"></div></div>`;
    let onKey = null;
    const ctx = {
      el: ov, body: $(".modal-body", ov),
      error: (m) => { $(".form-error", ov).textContent = m || ""; },
      cerrar: () => { ov.remove(); if (onKey) document.removeEventListener("keydown", onKey); },
    };
    botones.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = b.clase || "btn-secondary"; btn.textContent = b.texto;
      btn.addEventListener("click", async () => {
        ctx.error(""); btn.disabled = true;
        try { const r = b.onClick ? await b.onClick(ctx) : undefined; if (r !== false) ctx.cerrar(); }
        catch (e) { ctx.error(e.message || String(e)); }
        finally { btn.disabled = false; }
      });
      $(".modal-actions", ov).appendChild(btn);
    });
    onKey = (e) => { if (e.key === "Escape") ctx.cerrar(); };
    document.addEventListener("keydown", onKey);
    $("#modalRoot").appendChild(ov);
    if (alMontar) alMontar(ctx);
    const primero = $("input:not([disabled]):not([type=hidden]), select", ov); if (primero) primero.focus();
    return ctx;
  },
};

function confirmar(mensaje, { titulo = "Confirmar", textoOk = "Aceptar", peligro = false } = {}) {
  return new Promise((resolve) => {
    Modal.abrir({
      titulo, cuerpo: `<p style="margin:0;font-size:14px;line-height:1.5;">${esc(mensaje)}</p>`,
      botones: [
        { texto: "Cancelar", onClick: () => resolve(false) },
        { texto: textoOk, clase: peligro ? "btn-danger" : "btn-primary", onClick: () => resolve(true) },
      ],
    });
  });
}

// ---------- Carga de datos y refresco ----------
async function cargarEventos() {
  App.eventos = await ITT.api.getEventos();
  if (!App.eventos.some((e) => e.id === App.eventoId)) App.eventoId = App.eventos.length ? App.eventos[0].id : null;
  App.evento = App.eventos.find((e) => e.id === App.eventoId) || null;
}
async function cargarDatosEvento() {
  if (!App.evento) { App.graduados = []; App.reservados = {}; App.stats = null; return; }
  const id = App.eventoId;
  const [g, r, s] = await Promise.all([ITT.api.getGraduados(id), ITT.api.getReservados(id), ITT.api.getEstadisticasEvento(id)]);
  App.graduados = g; App.reservados = r; App.stats = s;
}
function rellenarSelectoresEvento() {
  const opts = App.eventos.map((e) => `<option value="${esc(e.id)}">${esc(e.nombre)}</option>`).join("") || `<option value="">(sin ceremonias)</option>`;
  $$(".evento-select").forEach((sel) => { sel.innerHTML = opts; sel.value = App.eventoId || ""; });
}
function renderVistaActual() { const v = Views[App.vista]; if (v && v.render) return v.render(); }

async function refrescar({ eventos = true } = {}) {
  try {
    if (eventos) await cargarEventos();
    await cargarDatosEvento();
    rellenarSelectoresEvento();
    await renderVistaActual();
  } catch (e) { console.error(e); Toast.show(e.message || String(e), "error"); }
}
async function cambiarEvento(id) {
  App.eventoId = id; App.evento = App.eventos.find((e) => e.id === id) || null;
  await refrescar({ eventos: false });
}
async function mostrarVista(nombre) {
  const anterior = Views[App.vista];
  if (anterior && anterior.salir) anterior.salir();
  App.vista = nombre;
  $$(".content").forEach((s) => s.classList.add("hidden"));
  $("#view-" + nombre).classList.remove("hidden");
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === nombre));
  await refrescar({ eventos: true });
  if (Views[nombre] && Views[nombre].entrar) Views[nombre].entrar();
}

// ---------- Componentes compartidos ----------
function tarjetasStats(s) {
  if (!s) return "";
  const c = (label, valor) => `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${fmt(valor)}</div></div>`;
  return c("Graduados", s.graduados) + c("Invitados autorizados", s.invitados) + c("Asientos disponibles", s.asientosDisponibles) + c("Asistentes registrados", s.asistentes.total);
}
function sinEvento(contenedorId) {
  const el = document.getElementById(contenedorId);
  if (el) el.innerHTML = `<p class="empty-state">No hay ceremonias. Crea una en el módulo Eventos.</p>`;
}
function ligarSelectoresEvento() {
  document.addEventListener("change", (e) => {
    if (e.target.classList && e.target.classList.contains("evento-select")) cambiarEvento(e.target.value);
  });
}
