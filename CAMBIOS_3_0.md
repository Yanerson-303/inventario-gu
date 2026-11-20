# Inventarios GU 3.0 — actualización acumulativa

Se parte del código de Inventarios GU 2.3. Se conservan las funciones existentes y su formato de datos compatible:

- Catálogo, clientes/espacios, registro semanal con desplazamiento horizontal/vertical y versión de tarjetas en móvil.
- Fórmulas de consolidado, gráficos, proyecciones, indicadores minimizables y bodega isométrica interactiva 3D con contadores y cajas según saldo.
- Copias JSON, backups internos/automáticos, CSV, cifrado AES-GCM, importación/fusión, historial, deshacer, tema oscuro y paletas.
- Instalación PWA y modo sin conexión en HTTPS, descargas de HTML independientes para PC y teléfono.

## Nuevo en 3.0

1. Centro de revisión: saldos negativos o cero, unidades por caja/promedios no definidos, referencias sin registros, cobertura de registro y períodos fechados, con filtros y exportación CSV. Es **diagnóstico informativo**, no modifica el inventario.
2. Comparativa descriptiva de movimientos entre los dos últimos períodos, sin confundir el movimiento con ventas.
3. Búsqueda global por sección/producto con Ctrl/Cmd+K o botón de la barra superior.
4. Iconografía SVG local y diseño adaptativo para PC y móviles, mejores estados de foco y soporte de movimiento reducido.
5. Copia interna preventiva **antes de eliminar** producto o período. Si el respaldo falla, no se elimina nada.
6. Se corrigen los enlaces de descarga PC/móvil que antes contenían espacios en vez de los guiones bajos de los nombres reales.
7. Actualización del service worker y las versiones autónomas para PC/móvil.

## Límites importantes

- No hay servidor, multiusuario ni sincronización entre dispositivos. Los datos quedan en cada navegador.
- Los diagnósticos se basan en N = H − (L+M) y no sustituyen un conteo físico.
- Las proyecciones son extrapolaciones de movimientos fechados, no predicciones de ventas futuras.
- Los HTML autónomos son **archivos web**, no ejecutables nativos y su almacenamiento local puede estar restringido en iOS y en file://.
- Para la mejor experiencia offline, servir la carpeta en HTTPS, instalar PWA y completar la primera carga de recursos.
