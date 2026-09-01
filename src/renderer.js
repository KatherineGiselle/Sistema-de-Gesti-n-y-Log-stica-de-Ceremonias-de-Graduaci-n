// renderer.js
const DATA = window.MOCK_DATA;

function renderTopbar() {
  document.getElementById("userName").textContent = DATA.usuario.nombre;
  document.getElementById("welcomeTitle").textContent =
    `¡Bienvenida, ${DATA.usuario.nombre.split(" ")[0]}!`;
}

function renderEventos() {
  const select = document.getElementById("eventoActual");
  select.innerHTML = DATA.eventos
    .map((e) => `<option value="${e.id}" ${e.activo ? "selected" : ""}>${e.nombre}</option>`)
    .join("");
}

function renderStats() {
  const s = DATA.estadisticas;
  const items = [
    { label: "Graduados", value: s.graduados },
    { label: "Invitados autorizados", value: s.invitadosAutorizados },
    { label: "Asientos disponibles", value: s.asientosDisponibles },
    { label: "Asistentes registrados", value: s.asistentesRegistrados },
  ];
  document.getElementById("statsCol").innerHTML = items
    .map(
      (i) => `
      <div class="stat-card">
        <div class="stat-label">${i.label}</div>
        <div class="stat-value">${i.value.toLocaleString("es-MX")}</div>
      </div>`
    )
    .join("");
}

function renderSeatMap() {
  const seats = DATA.generarMapaAsientos();
  const map = document.getElementById("seatMap");
  map.innerHTML = seats
    .map((s) => `<div class="seat ${s.status}" title="${s.key} — ${s.status}"></div>`)
    .join("");
}

// ---------- Navegación entre secciones ----------
function setupNav() {
  const buttons = document.querySelectorAll(".nav-item");
  const inicio = document.getElementById("view-inicio");
  const placeholder = document.getElementById("view-placeholder");
  const placeholderTitle = document.getElementById("placeholderTitle");

  const titles = {
    eventos: "Eventos",
    graduados: "Graduados",
    "acceso-qr": "Acceso QR",
    reportes: "Reportes",
    asientos: "Asientos",
    estadisticas: "Estadísticas",
    configuracion: "Configuración",
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view;
      if (view === "inicio") {
        inicio.classList.remove("hidden");
        placeholder.classList.add("hidden");
      } else {
        inicio.classList.add("hidden");
        placeholder.classList.remove("hidden");
        placeholderTitle.textContent = titles[view] || view;
      }
    });
  });
}

renderTopbar();
renderEventos();
renderStats();
renderSeatMap();
setupNav();
