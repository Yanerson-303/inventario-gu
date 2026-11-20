# Inventarios GU 4.0

Versión acumulativa, código fuente separado y sin dependencias remotas.

- `index.html`: entrada del sistema, navegación y opción de descargar PC/móvil.
- `styles.css`, `ux.css`, `gu4.css`: estilos base y de la actualización 4.0.
- `app.js`: orquestación, validación, auditoría, backups y compatibilidad.
- `calc.js`: fórmulas originales no modificadas.
- `db.js`: motor local IndexedDB / alternativas explícitas.
- `warehouse.js`: bodega isométrica con cajas basadas en posiciones asignadas.
- `gu4-core.js`: ubicaciones, conteos, previsiones, importaciones, alertas y validación de copias.
- `gu4-views.js`: vistas y distribución de panel 4.0.
- `gu4-excel.js` + `jszip.min.js`: Excel y CSV sin conexión.
- `LICENCIA_JSZIP.md`: licencia de la biblioteca incorporada.
- `sw.js`, `manifest.webmanifest`, `install.js`: instalación PWA y precaché.
- `descargas/`: versiones HTML autónomas para PC, iPhone y Android (no nativas).
- `tests/`: pruebas automáticas del motor existente y del núcleo 4.0.

Ver `CAMBIOS_4_0.md` para límites y procedimiento de actualización.
