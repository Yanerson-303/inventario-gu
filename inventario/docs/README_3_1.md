# Inventarios GU 3.1 — Actualización de interfaz y operación

## Cambios sin retirar módulos
- Ayuda contextual en iconos «i» (táctil y teclado) para métricas, gráficos, avisos y encabezados.
- Menos descripciones permanentes en pantalla; avisos críticos de almacenamiento se mantienen visibles.
- Bodega: reparación del ciclo de render cuando está minimizada u oculta.
- Panel: centro de revisión puede desplegar hasta 500 incidencias; CSV conserva la lista completa.
- Semanas: Enter para siguiente fila; Alt + flechas para navegar por campos (PC); doble scroll y vista móvil conservados.
- Consolidado: filtros de saldo positivo, cero o negativo; los totales globales siguen inalterados.
- Productos: ordenar por nombre, menor stock o mayor valorización.
- Clientes: ver espacios con/sin alias.
- Historial: búsqueda, últimos siete días y CSV.
- Copias: resumen con número y fecha de la última copia local.
- Configuración: densidad cómoda/compacta persistida en el estado.
- Actualización PWA y dos HTML autónomos descargables desde la web.

## Seguridad de datos
La información sigue siendo local. Realiza y conserva un respaldo JSON antes de actualizar. Los filtros y la ayuda solo leen datos, las fórmulas anteriores permanecen intactas.
