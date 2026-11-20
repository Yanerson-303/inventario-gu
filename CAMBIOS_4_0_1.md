# Inventarios GU 4.0.1 — revisión funcional

- Se preservan las funciones de 4.0 y las versiones anteriores.
- Importaciones Excel/CSV: las columnas ausentes o celdas vacías no sobrescriben el inventario existente. Los productos nuevos reciben valores predeterminados seguros.
- Proyecciones: se informa cuando los períodos fechados se superponen, en lugar de generar una cifra distorsionada.
- Conteos físicos: se pueden cancelar los pendientes sin modificar el stock; mensajes de éxito solo tras una operación validada.
- Bodega 3D: muestra rack, nivel y posición de cada asignación.
- PWA: caché versionada y sin recursos duplicados, incluidas las descargas autónomas.
- Se mantienen los archivos separados, el respaldo JSON, el diseño de iconos y todas las pantallas.

## Uso
1. Realiza primero una copia JSON.
2. Publica todos los archivos en el mismo origen HTTPS, o abre las descargas HTML autónomas.
3. Espera a que aparezca `Guardado local` y prueba el funcionamiento sin conexión después de preparar la PWA.
4. No uses simultáneamente varias pestañas con el mismo espacio local.
