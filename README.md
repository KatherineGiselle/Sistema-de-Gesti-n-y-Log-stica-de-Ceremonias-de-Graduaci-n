# Frontend — Sistema de Gestión y Logística de Ceremonias de Graduación

Proyecto base en **Electron** para el frontend del sistema. Usa datos simulados
(`src/mock-data.js`) para poder avanzar sin depender del backend de Gerardo.

## Cómo correrlo

1. Instala [Node.js LTS](https://nodejs.org) si no lo tienes.
2. Abre esta carpeta en una terminal y corre:
   ```
   npm install
   npm start
   ```
3. Se abrirá la ventana de escritorio con la pantalla de **Inicio** ya funcional
   (mapa de asientos, tarjetas de estadísticas, selector de evento).

## Estructura

```
graduacion-frontend/
├── main.js          # Proceso principal de Electron (abre la ventana)
├── preload.js        # Puente seguro entre Electron y el renderer
├── package.json
└── src/
    ├── index.html     # Sidebar + vista de Inicio + placeholders de otras vistas
    ├── styles.css      # Paleta y estilos (azul institucional / dorado / estados)
    ├── mock-data.js    # "Contrato de datos": la forma que tendrán las respuestas del backend
    └── renderer.js     # Lógica de la UI: navegación y renderizado
```

## El "contrato de datos"

`mock-data.js` define exactamente la forma de los datos que la interfaz espera.
Cuando el backend de Gerardo esté listo, la idea es **reemplazar las lecturas de
`window.MOCK_DATA` por llamadas fetch()/axios() a la API real**, siempre y cuando
el backend responda con esa misma estructura (mismos nombres de campos). Así se
evita rehacer la interfaz.

Ejemplo de un graduado:
```js
{
  id: 1,
  nombreCompleto: "Castillo Lorenzo Gerardo",
  numControl: "22210290",
  carrera: "Ing. en Sistemas Computacionales",
  invitadosAutorizados: 3,
  asientoAsignado: "A12",
  qrGenerado: true
}
```

## Próximos pasos sugeridos

- [ ] Construir la vista de **Graduados** (tabla + alta/edición) usando `DATA.graduados`
- [ ] Construir la vista de **Eventos** (crear/editar eventos de graduación)
- [ ] Construir la vista de **Acceso QR** (simulación de escaneo con datos falsos)
- [ ] Construir **Reportes** y **Estadísticas** (gráficas por carrera/generación)
- [ ] Sincronizar con Gerardo el contrato de datos real antes de conectar la API
