# Inventarios GU 4.1.0 — Acceso automático y módulos conectados

- Pantalla introductoria 3D interactiva con rotación y zoom; se cierra automáticamente tras al menos 3 segundos, una vez que la aplicación informa que está lista. Error de inicio visible y salida automática de la intro.
- Edición rápida de existencias y valores desde Bodega y Predicciones. El catálogo y todas las métricas usan los mismos datos y guardan los cambios con auditoría.
- Edición de cantidades de conteos **pendientes** desde su propio panel. Los conteos aplicados y cancelados permanecen inmutables. Las fórmulas originales se mantienen.
- Umbrales por producto y selección de períodos para el pronóstico, editables desde su módulo. Avisos recalculados automáticamente.
- Modo de importación predeterminado editable desde Excel e informes.
- Distribución del panel con controles por tarjeta y opción para restablecer tamaños y orden.
- Descargas HTML autónomas para PC y teléfonos regeneradas; PWA y caché actualizadas.
- No se asumen ubicaciones físicas automáticamente: los cambios de stock se detectan y se señalan como discrepancias para que los confirme el operador.

**Instalación PWA:** requiere HTTPS o localhost. **Archivos HTML autónomos:** funcionamiento offline sin instalar PWA, pero almacenamiento puede variar entre navegadores móviles. Datos locales, no sincronización remota.

Antes de actualizar desde versiones anteriores, exporta una copia JSON del inventario.
