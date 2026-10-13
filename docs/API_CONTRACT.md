# Contrato de API — Frontend ⇄ Backend

La interfaz solo habla con `ITT.api` (archivo `src/api.js`). Hoy responde el **backend simulado**
(`src/mock-backend.js`). Para conectar el backend real:

1. En `src/api.js` pon `USE_BACKEND = true` y `BASE_URL = "http://servidor:puerto/api"`.
2. Haz que tus rutas respondan con los JSON de abajo (o ajusta el mapeo `HttpBackend` en `api.js`).
3. No hay que tocar ninguna pantalla.

> Todos los errores deben responder `4xx/5xx` con `{ "mensaje": "texto para mostrar al usuario" }`.

## Modelos

```jsonc
// Evento (ceremonia)  — los campos calculados los entrega el backend
{ "id": "ev-001", "nombre": "Jueves 30 de abril, 11:00 AM", "fecha": "2026-04-30", "hora": "11:00",
  "carreras": ["Ing. en Sistemas Computacionales", "Ing. Informática"],   // 1–10, EL ORDEN IMPORTA
  "pases": 2.597, "pasesFuente": "excel",            // "excel" | "formula" | null
  "semestre": "2026-1",                              // ene–jun = 1, jul–dic = 2
  "totalGraduados": 139, "totalInvitados": 361,
  "butacasOcupadas": 500, "butacasLibres": 35, "capacidadTeatro": 535 }

// Graduado
{ "id": 1, "eventoId": "...", "numControl": "00000000", "apellidoPaterno": "APELLIDO1", "apellidoMaterno": "APELLIDO2",
  "nombre": "NOMBRE", "carrera": "Ing. Informática",
  "fila": "B", "asiento": 1,                         // asiento = número CONTINUO de la fila (1–42), null si no hay lugar
  "asientoFijo": false, "invitados": 2, "invitadosManual": false,
  "qrGenerado": true, "presente": false, "invitadosPresentes": 0 }

// Estación de escaneo (la manda el frontend en cada validación)
{ "id": "invitados-1", "nombre": "Invitados 1", "tipo": "alumno" | "invitado" }
```

## Endpoints

| Función (`ITT.api.*`) | Método y ruta | Cuerpo → Respuesta |
|---|---|---|
| `getCarreras()` | `GET /carreras` | → `string[]` (las 23 carreras) |
| `getEventos()` | `GET /eventos` | → `Evento[]` ordenados por fecha/hora |
| `crearEvento(d)` | `POST /eventos` | `{nombre?, fecha, hora, carreras[]}` → `Evento` (si no hay nombre: "Jueves 30 de abril, 11:00 AM") |
| `eliminarEvento(id)` | `DELETE /eventos/:id` | borra también alumnos, reservados, QR y accesos |
| `getGraduados(ev)` | `GET /eventos/:ev/graduados` | → `Graduado[]` en orden de acomodo |
| `crearGraduado(ev, d)` | `POST /eventos/:ev/graduados` | `{apellidoPaterno, apellidoMaterno, nombre, numControl, carrera, invitados, fila?, asiento?}` → `Graduado` |
| `eliminarGraduado(id)` | `DELETE /graduados/:id` | |
| `importarGraduados(...)` | `POST /eventos/:ev/graduados/importar` | `{alumnos[], hojaTotal}` → `{leidos, agregados, actualizados, carreraDesconocida:{}, sinCeremonia:{}, porEvento:[{eventoId,nombre,graduados,invitados,pases,fuente}], semestre}` |
| `getReservados(ev)` | `GET /eventos/:ev/reservados` | → `{ "A19": "Nombre", ... }` |
| `asignarReservado(ev, asiento, nombre)` | `PUT /eventos/:ev/reservados/:asiento` | `{nombre}` (vacío = quitar) |
| `generarQR(ev, carrera?)` | `POST /eventos/:ev/qr/generar` | `{carrera}` → `{alumnos, invitados, nuevos, revocados}` |
| `getResumenQR(ev)` | `GET /eventos/:ev/qr/resumen` | → `[{carrera, graduados, invitadosEsperados, qrAlumnos, qrInvitados, usados, completo}]` |
| `getCodigosQR(ev, carrera?)` | `GET /eventos/:ev/qr?carrera=` | → `[{token, tipo, indice, totalInvitados, graduado:{nombreCompleto, carrera, fila, asiento}}]` |
| `validarAcceso(ev, token, estacion)` | `POST /eventos/:ev/acceso/validar` | `{token, estacion}` → `{ok, motivo, mensaje, tipo, tipoTxt, nombre, carrera, asiento, hora, estacion}` |
| `getAccesos(ev, limite)` | `GET /eventos/:ev/accesos?limite=` | → lista de resultados de validación, más recientes primero |
| `getEstadisticasEvento(ev)` | `GET /eventos/:ev/estadisticas` | → `{graduados, invitados, butacasOcupadas, asientosDisponibles, esperados, asistentes:{alumnos,invitados,total}, porCarrera:[{carrera,alumnos,invitados,alumnosPresentes,invitadosPresentes}]}` |
| `getEstadisticasGlobales()` | `GET /estadisticas/globales` | → `{semestres:[{semestre, graduados, ceremonias, acumulado}], totalRegistrado}` |

`motivo` de `validarAcceso`: `ok` · `no_existe` · `otra_ceremonia` · `tipo_incorrecto` · `ya_usado`.



El frontend ya lo **simula** en `src/mock-backend.js` + `src/core.js` para poder funcionar hoy; todo eso se reemplaza.

1. **Base de datos y persistencia** (hoy todo vive en memoria, arranca vacío y se pierde al cerrar). Entidades: eventos, evento_carreras (con orden), graduados, reservados (por evento + asiento), códigos QR, accesos.
2. **Inicio/cierre de sesión y usuarios** (hoy el usuario es fijo; "Cerrar sesión" no hace nada). El token se lee de `localStorage["itt.authToken"]` y se manda como `Authorization: Bearer`.
3. **Generación y seguridad de los QR**: token único, aleatorio e imposible de adivinar (≥ 96 bits o firmado con HMAC), guardado en BD, tipo `alumno`/`invitado`, índice del invitado. El QR solo lleva el token, nunca datos personales.
4. **Validación de acceso ATÓMICA y central** (clave con 2–3 estaciones a la vez): marcar el código como usado con una sola operación (`UPDATE … WHERE usado = false`), validando: existe → es de esta ceremonia → el tipo coincide con la estación → no estaba usado. Guardar quién/cuándo/en qué estación.
5. **Sincronización entre estaciones**: que lo que escanee una se vea en las demás y en Estadísticas (WebSocket/SSE o sondeo cada ~2 s; hoy la pantalla de Estadísticas consulta cada 2 s).
6. **Algoritmo de acomodo de alumnos** (réplica de las hojas del Excel; validado contra 5 de 6 ceremonias al 100 %): orden carrera (en el orden del evento) → apellido paterno → materno → nombre (vacío al final, `Ñ` después de `N`); asientos en secuencia: izquierda B→F, centro B→F, derecha B→F (B-derecha es de padrinos y se salta), desborde por filas G→O (derecha, centro, izquierda). Se saltan los asientos reservados.
7. **Cálculo de invitados** (hoja Total): `butacas = 500 − graduados`, `PASES = butacas ÷ graduados`; cada alumno recibe `floor(PASES)` boletos (**máx. 3**) y el sobrante se reparte parejo entre los alumnos. Si no viene la hoja Total, se usa la misma fórmula.
8. **Importación del Excel**: hoy el frontend lee el `.xlsx` (SheetJS) y manda JSON. El backend recibe `alumnos[]` + `hojaTotal`, reparte cada alumno en el evento de su carrera (dentro del semestre de la ceremonia actual), evita duplicados por `numControl` y recalcula acomodo/invitados.
9. **Regenerar/revocar QR** cuando cambia el número de invitados o el asiento de un alumno (hoy `generarQR` sincroniza: crea los faltantes y revoca los sobrantes sin usar).
10. **Empaquetado/despliegue** (instalador `.exe`/`.app`, servidor, HTTPS en red local).

## Lo que ya hace el FRONTEND (no hay que repetirlo)

Pantallas, mapa de butacas con la numeración real (535), lectura del `.xlsx`, cámara y lector USB, selección de estación, sonidos, dibujo de los QR, PDF imprimible por carrera, gráficas y estadísticas en pantalla.
