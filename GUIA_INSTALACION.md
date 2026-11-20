# Almendra 2.0 — instalación y modo sin conexión

## Publicar una sola vez

Sube **todos** los archivos de esta carpeta a un alojamiento HTTPS (por ejemplo, GitHub Pages, Netlify o tu servidor). No abras `index.html` como `file://` para instalar la PWA: los service workers requieren HTTPS o localhost.

## Instalar en PC

En Chrome o Edge abre la URL HTTPS, pulsa **Instalar** en Almendra o el icono de instalación del navegador. Funciona como ventana independiente en Windows, macOS y Linux. No se entrega un ejecutable `.exe`/`.dmg`: es una PWA instalable.

## Android

Abre la URL HTTPS en Chrome. Pulsa Instalar aplicación desde el navegador o menú ⋮ → Añadir a pantalla de inicio. Confirma y abre el icono.

## iPhone / iPad

Abre la URL HTTPS **en Safari**, toca Compartir → Añadir a pantalla de inicio → Añadir. Abre el icono creado. La instalación de iOS no usa el evento de instalación de Chrome.

## Sin internet

1. Con conexión abre Almendra por HTTPS, espera que cargue y pulsa **Instalar** → **Preparar uso sin internet**.
2. Espera el mensaje «Archivos guardados».
3. Desconecta internet y abre la app desde su icono o la misma dirección previamente visitada. La navegación y las funciones locales siguen disponibles.
4. Los datos se guardan por navegador y dispositivo (IndexedDB con alternativa localStorage). No hay sincronización automática. **Exporta JSON** en Copias y migración y guárdalo fuera del dispositivo para evitar pérdidas.
5. El modo privado, borrar datos del sitio, políticas de almacenamiento del sistema y algunos navegadores pueden eliminar datos y caché. La opción **Proteger almacenamiento** solicita persistencia, pero no la garantiza.

## Actualizar

Publica los archivos nuevos manteniendo la URL y cambiando la versión de caché en `sw.js`. Conecta el dispositivo a internet y vuelve a abrir la app para descargar la actualización. Haz una copia JSON antes de actualizaciones importantes.

## Qué contiene esta entrega

Mismo sistema de productos, clientes, períodos, consolidado, historial, respaldos, analíticas y bodega 3D. Se añaden instalación multiplataforma, estado de conexión, preparación offline, iconos PNG, mejoras de diseño y ahorro de recursos en el render 3D.
