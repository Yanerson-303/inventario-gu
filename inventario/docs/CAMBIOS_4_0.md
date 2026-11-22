# Inventarios GU 4.0 — Cambios

Actualización acumulativa basada en Inventarios GU 3.4. No se eliminan las funciones originales.

## Módulos agregados

- **Bodega física:** tres racks × dos niveles × ocho posiciones. Ubicación guardada por producto y cantidad. No hay asignaciones automáticas ficticias: las unidades sin ubicar permanecen en el consolidado y aparecen como pendientes.
- **Conteos físicos:** revisión de existencias, diferencia frente a `N`, aprobación explícita y copia preventiva antes de ajustar `Cantidad.N`. La fórmula original `N = H − (Cantidad.N + Cantidad.V)` no cambia.
- **Predicciones y alertas:** proyección de volumen de movimientos con períodos fechados; avisos de saldo bajo, negativo, asignaciones excedidas y unidades sin ubicar. Los movimientos no se tratan como ventas.
- **Panel personalizable:** ordenar todas las tarjetas, alternar el tamaño y utilizar los controles anteriores para minimizar y expandir.
- **Excel e informes:** importar XLSX/CSV/TSV, previsualizar, detectar coincidencias por nombre e importar con copia previa; descargar plantilla e informe XLSX de varias hojas; imprimir o guardar PDF mediante navegador.
- **Offline:** nuevos módulos y JSZip almacenados localmente y precargados por el service worker PWA; descargas HTML autónomas para PC y móvil.

## Conservación y recuperación

- Conservados el catálogo, clientes, semanas, registro semanal, consolidado, fórmulas, métricas, bodega 3D, historial, copias JSON/cifradas, ajustes de tema, sonidos y descargas PC/móvil.
- La aplicación utiliza la misma base local `almendra_inventory_v1`, para que el origen HTTPS donde ya funciona 3.4 pueda abrir los mismos datos. No hay sincronización entre dispositivos.
- Al detectar datos previos sin `gu4`, crea una copia interna **Antes de migrar a 4.0** y añade el nuevo esquema de ubicaciones y conteos sin alterar los datos heredados.
- Los JSON 3.4 siguen siendo importables. Los JSON 4.0 preservan además ubicaciones, conteos y personalización del panel. La compatibilidad de retorno hacia versiones antiguas **no** conserva necesariamente los nuevos campos.
- En caso de pérdida del dispositivo o de limpiar el navegador, las copias internas también pueden desaparecer. Descarga un respaldo JSON externo con regularidad.

## Límites

- No hay ubicación automática ni verificación con sensores: el usuario debe asignar posiciones que correspondan a la bodega real.
- Las proyecciones usan un promedio de movimientos y requieren al menos dos períodos fechados y siete días de historial. No son previsiones de ventas ni garantizan falta de stock.
- El PDF se guarda desde **Imprimir → Guardar como PDF**. No hay generación nativa de archivos APK, IPA o EXE.
- El XLSX usa la primera hoja y espera nombres de columna identificables. No importa ni ejecuta macros o fórmulas de Excel.
- La instalación y el almacenamiento offline confiable requieren HTTPS/localhost. Abrir un HTML autónomo en un navegador móvil puede no permitir almacenamiento persistente.

## Actualización segura

1. En 3.4, descargar un respaldo JSON o cifrado.
2. Publicar **todos** los archivos 4.0 juntos en el mismo origen y ruta HTTPS, o comenzar en un origen nuevo y restaurar el JSON.
3. Abrir 4.0, revisar los productos, y entrar en **Bodega física** para asignar posiciones.
4. En **Descargar app**, preparar los archivos offline e instalar la PWA si lo deseas.
5. Comprobar en un dispositivo real el almacenamiento y la recuperación antes del uso productivo.
