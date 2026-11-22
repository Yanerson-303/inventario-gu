# Inventarios GU 3.2 — visualizaciones integradas

- Seis indicadores con gráficos propios: evolución por semanas, saldos positivos vs. negativos, participación de valoración positiva, catálogo con/sin movimientos, stock por producto y referencias por estado.
- La línea temporal semanal sustituye únicamente la representación de barras de la misma métrica. Las cifras siguen calculándose con `calc.js`.
- Proyecciones: gráfica de ritmo diario de períodos con fechas válidas; sin fechas aparece falta de datos, nunca cifras inventadas.
- Centro de revisión: barras por categoría; **no** torta, pues un producto puede aparecer en varias categorías.
- Comparativa: dos barras; no implica ventas futuras.
- Bodega 3D y tablas se mantienen sin cambios funcionales.
- Controles de minimizar y restaurar con solo `−` / `+`; nombre accesible y ayuda `i` conservados.
- Todas las visualizaciones operan localmente, sin bibliotecas de terceros.

**Instalación:** desde HTTPS o localhost; PWA para acceder sin conexión luego de cargar sus recursos. La versión HTML individual puede tener limitaciones de almacenamiento en algunos navegadores móviles. **Antes de actualizar, exporta respaldo JSON.**
