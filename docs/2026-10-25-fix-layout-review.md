# Corrección del layout y presentación de la tarjeta de repaso

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** fix  
**Estado:** completed

## Problema

En la vista de repaso móvil el contenido podía dibujarse fuera del cuerpo de la
tarjeta aunque los contenedores tuvieran borde y `overflow` visible. La captura
del usuario corresponde a un viewport de `370×656`; la reproducción con la
escala de interfaz 18 (`--mobile-font-scale: 1.3846153846153846`) mostró:

| Elemento | Medición antes del fix |
| --- | --- |
| `.mobile-main` | `y=85`, alto `446` |
| `.mobile-card` | `y=87`, alto `434` |
| `.mobile-card-body` | `y=170`, alto `334` |
| `.mobile-question` | `y=154–330` (16 px por encima del body) |
| `.mobile-answer` | `y=348–520` (16 px por debajo del body) |

La tarjeta no crecía con el contenido: `mainScroll === mainClient` y
`cardScroll === cardClient` a pesar del desbordamiento.

### Causa

`.mobile-main` era un flex container en fila con el `align-items: stretch`
predeterminado. Esa regla estiraba `.mobile-card` hasta la altura disponible y
le impedía crecer con su contenido. Dentro de la tarjeta,
`.mobile-card-body` usaba `justify-content: center`, que reparte el exceso de
contenido hacia arriba y hacia abajo cuando la altura está restringida. El
resultado era texto invadiendo el meta superior y el borde inferior en lugar de
desplazarse.

## Cambios

- `src/mobile/mobile.css`
  - `.mobile-main` ahora usa `align-items: flex-start`. La tarjeta conserva
    `min-height: 100%`, así que llena la pantalla cuando el contenido es corto,
    pero puede crecer cuando no cabe.
  - `.mobile-card-body` usa `justify-content: safe center`. Si en el futuro una
    restricción de altura vuelve a limitar el body, el contenido se alinea al
    inicio en vez de desbordarse por arriba.
  - El scroll queda en `.mobile-main`. La tarjeta mantiene su padding, borde,
    radios y sombra; las acciones, herramientas y calificaciones siguen fijas
    debajo del área desplazable.

No se modificaron `--ls-font-scale`, `--mobile-font-scale`, el cambio
bidireccional escritorio↔review, el drawer de ajustes ni los controles de
tipografía.

## Scrollbar en la vista review

Android WebView usa barras de desplazamiento superpuestas: en la mayoría de
equipos aparecen solo mientras se hace scroll y se desvanecen después. Aun así,
para que no se vean nunca en la vista de repaso se ocultan explícitamente en
`.mobile-main` con `scrollbar-width: none`, `-ms-overflow-style: none` y
`.mobile-main::-webkit-scrollbar { display: none }`.

Ocultar la barra no desactiva el desplazamiento: `.mobile-main` conserva
`overflow-y: auto` y sigue respondiendo a gestos táctiles, rueda y teclado.
También evita que el ancho de la tarjeta cambie entre un estado con scroll y
otro sin él.

## Tarjetas cloze

Antes, al revelar una tarjeta cloze se mostraban dos versiones del mismo texto:
la pregunta con huecos (`[ ... ]`) arriba y la respuesta completa debajo. Ahora:

- Sin revelar se sigue mostrando la pregunta con los huecos.
- Al revelar se oculta la pregunta y se muestra únicamente la respuesta
  completa, con los huecos resueltos y resaltados.
- En landscape, la tarjeta cloze revelada usa una sola columna para que la
  respuesta ocupe el ancho disponible.
- El separador punteado y el padding superior de `.mobile-answer` se eliminan
  cuando la respuesta es el único contenido de la tarjeta.

Las tarjetas básicas y las de oclusión de imagen conservan su comportamiento.

## Verificación

Mediciones realizadas en un iframe de `370×656` sobre la app de desarrollo:

| Escenario | Resultado |
| --- | --- |
| UI 13 / escala 1, sin revelar | Pregunta centrada dentro del body; sin solapamientos |
| UI 18 / escala 1.3846, sin revelar | Tarjeta `444` px; pregunta `176` px dentro del body; sin desbordamiento |
| UI 18 / escala 1.3846, revelada | Tarjeta `505` px; body `405` px; pregunta `190–366`; respuesta `384–556`; sin solapamiento con meta, borde ni acciones |
| UI 18, revelada y scroll al final | `scrollTop=71` (máximo); la tarjeta termina 10 px por encima de las acciones y se ve el borde inferior |
| Landscape `740×360`, UI 18, revelada | Tarjeta `300` px con grid de dos columnas; pregunta y respuesta contenidas; scroll vertical disponible |
| UI 18, cloze revelada | Solo la respuesta (`En SinNotas, las notas se guardan directamente…`), sin duplicar la pregunta; tarjeta `87–521`, respuesta `260–414` |
| UI 18, cloze revelada en landscape | Una sola columna; respuesta de `666` px de ancho, sin borde ni padding de separador |
| Scrollbar en `370×656` y `740×360` | `scrollbarWidth: none`; la tarjeta conserva el ancho completo y el scroll sigue funcionando |
| Tarjeta básica revelada | Sigue mostrando pregunta y respuesta, incluidas las dos columnas en landscape |

También se comprobó que la tarjeta sigue ocupando el alto disponible cuando el
contenido es corto (sin revelar a UI 13) y que las calificaciones permanecen
visibles y fuera del área de scroll.

## Gates ejecutados

- `npx tsc --noEmit`: OK
- `npm test`: 182 pruebas en 21 archivos, todas en verde
- `npm run build`: OK
- `VITE_APP_MODE=flashcards npm run build`: OK

## Safe area en Android y separador accent

### Barras del sistema

En Android las barras de estado y navegación podían tapar el encabezado y las
acciones de la vista de repaso. La causa es la combinación de `enableEdgeToEdge`
en la plantilla de Tauri con WebView anteriores a `140.0.7339.51.0`, que
devuelven `env(safe-area-inset-*)` en `0px` aunque el contenido se dibuje debajo
de las barras.

El proyecto Android se genera en `src-tauri/gen/`, que está ignorado y se
recrea con `tauri android init`. Por eso el arreglo no se edita a mano en ese
directorio: se aplica con:

```bash
npm run android:patch
```

`scripts/patch-android-safe-area.mjs` localiza el `MainActivity.kt` generado e
inyecta, de forma idempotente:

- Un `JavascriptInterface` llamado `SinNotasSafeArea` que devuelve las insets
  actuales calculadas con `WindowInsetsCompat` (`systemBars` + `displayCutout`).
- Un listener de `WindowInsets` sobre el WebView que actualiza las insets al
  rotar o cuando cambian las barras.
- Un script de inicio de documento que publica los valores en
  `--sinnotas-safe-area-top|right|bottom|left` y los reaplica en cada cambio.

`src/mobile/mobile.css` combina ambos orígenes para no duplicar padding:

```css
--mobile-safe-area-top: max(env(safe-area-inset-top, 0px), var(--sinnotas-safe-area-top, 0px));
```

El mismo cálculo se usa en el layout de review, el editor, el drawer y el toast.
El WebView sigue siendo edge-to-edge, así que el degradado del fondo continúa
detrás de las barras; solo la interfaz interactiva queda dentro de la zona
segura. En WebView que ya calcula bien `env()` ambos valores coinciden y
`max()` no suma dos veces. El paso está integrado en los dos jobs Android de
`.github/workflows/ci.yml` y en las instrucciones de build del README.

### Separador de la tarjeta básica

El separador entre pregunta y respuesta usaba `1px dashed` con el borde gris
de baja opacidad. Ahora es una línea sólida de `4px` con el accent activo:

- Vertical: `border-top: 4px solid var(--mobile-accent)`.
- Horizontal: `border-left: 4px solid var(--mobile-accent)`.
- Escritorio: `.card-answer` usa `4px solid var(--ls-accent)` para que la
  tarjeta básica del repaso de escritorio mantenga el mismo lenguaje visual.

Las tarjetas cloze reveladas siguen sin separador porque solo muestran la
respuesta completa.

### Verificación

- `npx tsc --noEmit`: OK.
- `npm test`: 187 pruebas en 21 archivos, todas en verde.
- `npm run build`: OK.
- `VITE_APP_MODE=flashcards npm run build`: OK.
- El parche nativo se ejecutó dos veces sobre un `MainActivity.kt` de prueba:
  aplicó imports, listener y bridge en la primera pasada, y fue idempotente en
  la segunda.
- No se pudo compilar la APK ni hacer verificación visual en dispositivo:
  esta máquina no tiene Android SDK instalado y no hay emulador/dispositivo
  disponible. Esa comprobación queda a cargo del job Android de CI.

## Ajustes posteriores: cloze de escritorio y tablas

- El repaso de escritorio aplica la misma presentación cloze que la APK. Al
  revelar, `.card-question` se oculta (`.cloze-hidden`) y `.card-answer` pierde
  el separador y el padding superior (`.cloze-only`), de modo que solo se ve el
  texto completo con el hueco resuelto, sin el hueco vacío encima. Se mantiene
  una tarjeta por bloque aunque haya varios resaltados.
- Las tablas Markdown renderizadas (`.markdown-table`) y las editables
  (`.markdown-block-table`) derivan fondo, cabecera y bordes del accent activo
  con `color-mix`, con intensidades distintas para tema oscuro y claro. La vista
  Android replica el ajuste con `--mobile-accent`. El texto conserva contraste
  AA en todas las paletas.

## Texto de tarjeta unificado y centrado

- Pregunta y respuesta comparten una sola medida configurable,
  `--ls-flashcard-text-em` (2.4em por defecto, 36 px con la interfaz en 15 px).
  Se eliminó el control separado de respuesta; la clave histórica
  `sinnotas-font-size-flashcard-question` se conserva para respetar la
  preferencia ya guardada.
- `.card-question` y `.card-answer` (escritorio) y `.mobile-question` y
  `.mobile-answer` (repaso) usan el mismo `font-size`, `line-height: 1.55` y
  `text-align: center`.
- Las tablas y listas se centran como bloque (`margin-inline: auto` y
  `width: fit-content`), pero sus celdas y viñetas conservan la alineación
  interna a la izquierda. Los bloques `pre` y `blockquote` también quedan a la
  izquierda para no perder legibilidad.
- En la vista de repaso horizontal, el grid de dos columnas aplicaba
  `align-items: center`; al revelar un cloze se cambiaba a `flex` sin reponer
  el estiramiento y el bloque de respuesta quedaba centrado a un ancho menor
  que la pregunta. El override de cloze ahora fija `align-items: stretch`, por
  lo que pregunta y respuesta ocupan el mismo ancho.
- Verificación en navegador (escritorio y repaso horizontal): pregunta y
  respuesta calculan 36 px y `text-align: center`; las tablas de ambos estados
  quedan centradas como bloque y las listas mantienen el texto a la izquierda.

## Reorganización de documentación

- `PROGRESS.md` se movió a `docs/2026-10-25-registro-progreso.md`.
- Se normalizaron los nombres de los documentos existentes a minúsculas y, en
  los registros cronológicos, se añadió la fecha:
  - `AUDITORIA-SEGURIDAD-COMPLETA.md` → `2026-10-25-auditoria-seguridad-completa.md`
  - `CONVENCIONES-DOCS.md` → `convenciones-docs.md`
  - `RELEASING.md` → `publicacion-apk-android.md`
  - `auditorias.md` → `2026-10-24-auditoria-seguridad-rendimiento.md`
  - `security-audit.md` → `2026-10-24-auditoria-seguridad.md`
  - `ci-release-diagnosis.md` → `2026-10-24-diagnostico-ci-release.md`
  - `phase4-saf-plan.md` → `2026-10-24-plan-saf-android.md`
  - `benchmark-1792893849228.md` → `2026-10-25-benchmark-rendimiento.md`
  - `benchmark-mobile-1792899153245.md` → `2026-10-25-benchmark-mobile.md`
- `README.md` ahora separa guías técnicas de registros históricos y benchmarks,
  y enlaza todos los documentos de `docs/`.
- `docs/convenciones-docs.md` documenta que la raíz solo conserva el README y
  que los registros que solo documentan cosas viven en `docs/`.
- Se actualizaron las referencias en `.github/workflows/ci.yml`,
  `src/store/content-search.test.ts` y los enlaces internos entre documentos.

## Insets de Android cuando el WebView no recibe WindowInsets

El parche anterior escuchaba `WindowInsets` únicamente en el WebView. Hay
versiones de WebView que nunca entregan esas insets a la vista aunque la
actividad esté en edge-to-edge; en esos equipos `latestSafeAreaInsets` quedaba
vacío y las barras de estado/navegación seguían tapando el encabezado y las
acciones del repaso.

Ahora `scripts/patch-android-safe-area.mjs`:

- Conserva el listener del WebView como vía principal.
- Lee además `ViewCompat.getRootWindowInsets(view)` en el primer layout, en
  `onResume` y en `onConfigurationChanged`. La raíz de la ventana conserva las
  insets reales aunque el WebView no las reciba.
- Solo vuelve a inyectar el script cuando el JSON de insets cambia.
- Marca el parche como `SinNotasSafeArea v2`. Si detecta el parche anterior,
  pide borrar `src-tauri/gen/android` y regenerarlo con `tauri android init`
  antes de aplicarlo, para no dejar una versión vieja silenciosamente.

`src/mobile/android-safe-area.ts` reaplica el valor guardado al montar la vista
de repaso y en `resize`/`orientationchange`. Cubre el caso en que el script de
inicio de documento corre antes de que Android entregue las primeras insets. En
escritorio y en WebView modernos el puente no existe y la función no hace nada.

### Verificación

- `npx tsc --noEmit`: OK.
- `npm test`: 236 pruebas en 24 archivos, todas en verde.
- `npm run build` y `VITE_APP_MODE=flashcards npm run build`: OK.
- `scripts/patch-android-safe-area.mjs` aplicado dos veces sobre un
  `MainActivity.kt` de plantilla: la primera pasada añade imports, listener,
  fallback de raíz y puente; la segunda es idempotente.
- APK debug arm64 compilada localmente sin Android Studio, usando solo las
  command-line tools del SDK, el NDK 30.0.16248370 y un JDK 21:
  `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
  (215 MB). Firma: Android Debug; paquete `com.sinnotas.desktop`, `minSdk 33`,
  `targetSdk 37`.
- Verificado dentro del APK: `SinNotasSafeArea` y las variables
  `--sinnotas-safe-area-*` están en el DEX, y `android:allowBackup="false"` está
  en el manifiesto compilado.
- La APK debug no puede actualizar la release v0.2.0 firmada con la keystore de
  release: Android rechaza la instalación por firma distinta. Para conservar
  los datos de la release hay que instalar una APK firmada con la misma clave
  (CI con los secretos) o desinstalar antes la release.
