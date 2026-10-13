(ver `docs/API_CONTRACT.md`)

## Cómo correrlo

```
npm install
npm start
```
Funciona sin internet (SheetJS, jsQR, el generador de QR y la tipografía Inter van incluidos en `src/vendor/` y `src/assets/fonts/`).

**Arranca vacío**: no trae ceremonias, alumnos ni códigos de prueba. Lo primero es crear las ceremonias en *Eventos* y luego subir el Excel en *Graduados*.
Mientras `USE_BACKEND` sea `false` (ver `src/api.js`), los datos viven en memoria y se pierden al cerrar la app.

## Manual de uso rápido

1. **Eventos** → *+ Nuevo evento*: fecha, hora y hasta 10 carreras (se muestran las 23; el orden en que las agregues es el orden de acomodo).
2. **Graduados** → *Subir Excel (.xlsx)*: lee la hoja de alumnos y la hoja **Total**. Reparte a cada alumno en la ceremonia de su carrera
   (dentro del semestre de la ceremonia seleccionada), los acomoda por carrera → apellidos, calcula sus invitados y se refleja en Asientos.
   Volver a subir el mismo archivo no duplica (se actualiza por No. de control). También hay alta manual (*+ Agregar graduado*).
3. **Asientos**: clic en un asiento **gris** (3ra edad, padrinos/coordinadores, transmisión) para escribir quién lo ocupa; clic en uno de color para ver al alumno.
4. **Acceso QR → Generar QR**: un QR único por alumno y uno por cada invitado. *Descargar PDF* por carrera (o *todas* en una carpeta).
5. **Acceso QR → Escaneo**: elige la **estación** (Alumnos 1 · Invitados 1 · Invitados 2) y la **fuente** (cámara o lector USB/manual). Cada estación solo acepta su tipo de QR y rechaza códigos repetidos.
6. **Inicio / Reportes / Estadísticas**: mapa por carreras, asistencia por carrera, monitoreo en vivo y las 2 gráficas de barras (graduados por semestre y acumulado).

## Escáneres (2 de invitados + 1 de alumnos)

- **Lector USB de mano**: se comporta como teclado (escribe el código y manda Enter). Fuente *Lector USB / manual*; la caja de captura se enfoca sola. 
- **Cámara**: Fuente *Cámara* → *Iniciar cámara* (permite elegir cuál si hay varias).
- Cada equipo con el programa abierto es **una estación**; su tipo y fuente se recuerdan en ese equipo. Para que las 2–3 estaciones se vean entre sí y no dejen pasar un QR dos veces, todas deben hablar con **el mismo backend** (ver el contrato).

## Reglas tomadas de tu Excel (validadas)

- Invitados: `butacas = 500 − graduados`, `PASES = butacas ÷ graduados`, máx. 3 boletos por alumno.
- Acomodo: se comparó contra las 6 hojas de asientos de la coordinación → **5 de 6 ceremonias idénticas al 100 %** (la de martes 28 11 am se acomodó a mano con un asiento suelto en A9).
- Plano: 535 butacas, numeración continua por fila; reservados = 37 (3ra edad 18 · padrinos/coordinadores 16 · transmisión 3).

## Estructura

```
main.js · preload.js · pdf-service.js     Electron (ventana, cámara, PDF)
src/
  index.html · styles.css                 Interfaz (8 pantallas)
  api.js                                  ÚNICA entrada a los datos (simulado ⇄ backend real)
  mock-backend.js · core.js               BACKEND SIMULADO y reglas de negocio (se reemplaza)
  theater-layout.js                       Plano del Teatro Calafornix
  excel-import.js                         Lector del .xlsx (hoja de alumnos + hoja Total)
  qr-utils.js                             Dibujo de QR y hoja imprimible por carrera
  charts.js                               Gráficas de barras en SVG
  ui-*.js · app.js                        Pantallas
docs/API_CONTRACT.md                      
test/                                     Pruebas automáticas (lógica, interfaz, cámara, casos límite) y sus datos de ejemplo (fixtures.js)
```

## Pruebas

```
npm test -- ruta/Lista_egresados.xlsx                         # lógica contra tus hojas de asientos
XLSX=ruta/Lista_egresados.xlsx npx electron test/run-ui.js     # recorrido completo de la interfaz
npx electron test/run-edge.js                                  # casos límite
python3 test/make-qr-mjpeg.py ITT-A-CAMARATEST1 qr.mjpeg && MJPEG=qr.mjpeg npx electron test/run-camera.js   # cámara con webcam simulada
```
(En Linux sin pantalla anteponer `xvfb-run -a` y agregar `--no-sandbox`.)

## Pendiente
- **Configuración** (módulo en espera, como se indicó).
- Conectar el backend (`USE_BACKEND` en `src/api.js`) y empaquetar el instalador (`electron-builder`, requiere `.ico`/`.icns` del logo).
