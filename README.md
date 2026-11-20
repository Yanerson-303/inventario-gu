# Almendra — control de inventario web

Aplicación **100 % estática** construida con HTML, CSS y JavaScript separados. Se diseñó a partir del PDF «Documentación técnica de funcionamiento y replicación — Software.xlsx» del 20 de noviembre de 2026. **Ese PDF no incluye los nombres, cantidades ni precios reales del Excel**, así que el catálogo empieza vacío.

## Abrir la aplicación

1. Descomprime el ZIP sin cambiar la estructura.
2. Para uso fiable en computadores y celulares, publica la carpeta en un servidor **HTTPS** o ejecútala localmente con `python -m http.server 8000` y visita `http://localhost:8000` desde el PC.
3. En un iPhone o Android, abre la URL HTTPS desde Safari/Chrome y opcionalmente usa «Añadir a pantalla de inicio» para instalarla como aplicación web. Algunos navegadores no garantizan IndexedDB si se abre `index.html` directamente como `file://`.
4. Añade productos y registra cantidades en «Registro semanal».
5. En «Copias y migración», descarga un JSON para llevar los datos a otro dispositivo. En el segundo dispositivo usa «Seleccionar archivo» y elige «Reemplazar» o «Fusionar».

**Vista previa con almacenamiento bloqueado:** si ChatGPT Web Preview u otro visor no permite IndexedDB, la aplicación prueba localStorage. Si también está restringido, funciona en memoria durante la sesión, indica claramente que los cambios son temporales y ofrece exportar JSON. Antes de cerrar o recargar, descarga la copia; para uso habitual utiliza HTTPS.

**No hay sincronización automática entre dispositivos:** cada uno tiene su propia base local. Para transferir, exporta e importa el JSON. El sistema funciona sin Internet una vez instalado mediante el service worker (requiere HTTPS o localhost).

## Archivos

- `index.html`: estructura y navegación.
- `styles.css`: interfaz adaptable, modo claro/oscuro y tres skins: Almendra, Rojo y Oro, Gris y Plata.
- `app.js`: formularios, catálogo, tablas, auditoría, exportaciones, importaciones y navegación.
- `db.js`: IndexedDB para datos y copias internas; respaldo alternativo en localStorage y, si el navegador bloquea todo, modo temporal en memoria.
- `calc.js`: fórmulas de Excel.
- `charts.js`: gráficas con Canvas 2D, sin dependencias.
- `manifest.webmanifest`, `icon.svg`, `sw.js`: instalación y funcionamiento offline en HTTPS.

## Correspondencia con el Excel

- Cinco períodos iniciales, ampliables.
- 100 espacios A-1 … A-100, ampliables y con alias editables.
- Registro de cantidades por producto × período × espacio.
- `CX = SUM(A-1 … A-100)`.
- `Final.H = SUM(CX de todos los períodos)`. Los cinco períodos iniciales reproducen la estructura original; los períodos adicionales también se consolidan.
- `G = H`, `J = Cantidad.N + Cantidad.V`, `N = H - J`, `P = N × Valor`, `Q = N`, `R = -Q`, `T = R / Promedio` cuando existe, `V = COCIENTE(R, Cajas) / RESIDUO(R, Cajas)` cuando Cajas > 0. Se conserva el signo del saldo negativo.
- `Precio (CY)` y `Total manual (CZ)` se almacenan por producto y período, por separado del `Valor (O)` de Final. «Estimado» = `CX × CY` es **un cálculo adicional de la web**, no una fórmula original de CZ.
- Reordenar o renombrar productos no mezcla movimientos porque se usan IDs estables.

**Definiciones pendientes del negocio**: qué representan Cantidad.N, Cantidad.V, saldos negativos, Promedio y precios semanales. La aplicación mantiene la aritmética sin redefinir esas variables.

## Datos y seguridad

- Los datos operativos no caben de forma segura en cookies: se guardan en **IndexedDB**, dentro del navegador y dispositivo. Las cookies solo contienen preferencias de paleta y luminosidad.
- Las copias internas están en IndexedDB, **no sobreviven necesariamente a borrar los datos del navegador o perder el teléfono**.
- Después de cambios se crea un respaldo automático en el navegador como máximo aproximadamente cada 12 horas (se conservan hasta 12 respaldos automáticos), más todos los respaldos manuales.
- La exportación JSON lleva integridad SHA-256 cuando Web Crypto está disponible. Las exportaciones cifradas emplean AES-256-GCM y PBKDF2-SHA256 (250 000 iteraciones). Si pierdes la contraseña no podrás descifrar ese archivo.
- No se envía información a servidores y no hay cuentas, autenticación multiusuario ni sincronización en tiempo real. Un candado visual no equivale a seguridad de servidor.
- Se detectan modificaciones de otra pestaña del mismo origen para evitar sobrescribir silenciosamente datos; tras el aviso, recarga.
- Un archivo CSV es para consulta en Excel; **solo JSON** restaura todo el modelo.
- Importar el mismo JSON mediante «Fusionar» usa IDs estables y sobreescribe las mismas celdas, no suma movimientos ni crea duplicados de esos IDs.
- Antes de importar o restaurar se genera una copia interna de los datos anteriores.

## Limitaciones importantes

- La importación directa del `.xlsx` original no está incluida porque únicamente se suministró su informe técnico en PDF. Si se obtiene el XLSX real, se debe extraer y mapear su catálogo, sus 5 hojas y sus parámetros a este esquema, conservando las filas originales y comprobando los signos.
- Los cálculos usan `Number` de JavaScript (coma flotante), con redondeos para mostrar resultados; no es un motor contable de precisión decimal arbitraria. Para importes elevados o requisitos financieros estrictos conviene un backend decimal verificado.
- El historial local es informativo y editable a través de copias; no es un registro legal inmutable.
- Si se cierran los períodos, quedan bloqueados sus registros semanales, pero los parámetros globales del producto siguen editables. Esto reproduce el carácter global de Final.
- Cuando las semanas superan las cinco iniciales, Final incluye todas; esa ampliación es intencionada.

## Verificación mínima recomendada

Usar 3 y 2 en dos espacios para verificar CX=5; sumar períodos para H; ingresar Cantidad.N=4 y Cantidad.V=6 para J=10; comprobar N=H−10, P=N×Valor y el signo de R. Establecer Promedio=0 y Cajas=0 para comprobar avisos. Cambiar nombre de producto, exportar/importar un JSON y verificar que las cifras permanezcan idénticas.
