# Registro de progreso y funcionalidades

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** feature  
**Estado:** completed

> Registro histórico de las fases F1–F6 y de los cambios posteriores. Para las
> reglas de nombres y ubicación de documentos, consultar
> [convenciones-docs.md](convenciones-docs.md).

## Estado actual

Fase: Todas las fases (F1–F6) hechas y commiteadas en feat/sinnotas-fases
Paso: Informe final emitido
Siguiente acción: ninguna (push hecho)
Última verificación: npx tsc OK; npm test 189 OK; npm run build OK (desktop y flashcards); typography defaults at 15 px with em-based review cards; cargo test 48 OK; clippy OK; benchmark 5000: cold 754.82 ms / warm 250.36 ms (3.01x); HARNESS PASS 17/17

## Gates (comandos reales y si se pueden ejecutar)

- `npx tsc --noEmit` -> OK (ejecutado al cerrar cada fase)
- `npx vitest run <ruta>` / `npm test` -> OK (entorno node sin DOM; 168 tests al final)
- `npm run build` (tsc && vite build) -> OK (desktop y `VITE_APP_MODE=flashcards`)
- `src-tauri`: `cargo test --lib` -> 48 OK; `cargo clippy --all-targets -- -D warnings` -> OK
- `src-tauri`: `cargo check --lib --target aarch64-linux-android` -> OK (el watcher `notify` queda fuera por cfg)
- `VITE_APP_MODE=flashcards npm run build` -> OK (vista móvil con i18n)
- `scripts/benchmark-cache.sh 5000` -> cold 754.82 ms / warm 250.36 ms (3.01x, warm parsed=0)
- node_modules ya existía; Cargo 1.99.1 disponible; no hubo que saltarse ningún gate

## Decisiones cerradas (no reabrir)

- Sidebar: sin árbol de carpetas; Fijadas + Recientes (máx. 5 aperturas, la fijada solo aparece en Fijadas); botón "Ver todas las notas (N)" a la vista all-pages.
- Flashcards: deshacer devuelve a la tarjeta deshecha con la respuesta oculta y lista para puntuarse de nuevo; deshacer retrocede tarjeta a tarjeta; rehacer avanza a la siguiente de la cola; no se abre el editor.
- Búsqueda: en memoria sobre load_vault, sin Rust ni índice persistente, AND en el mismo bloque, sin mayúsculas/acentos, excluye líneas `clave:: valor`.
- Grafo: nodePerConnectionRadius por defecto 0; migración única con marcador "sinnotas-graph-settings-v2" escrito SIEMPRE en la 1ª carga; solo se reescribe si valía exactamente 1.2.
- Apertura con app: comando Rust; sin permisos opener nuevos ni cambios en capabilities.
- Textos de UI por translate(); diccionario clave en español/valor en inglés.

## Fases

### F1 Grafo [hecha]
Commit `feat(graph): radios uniformes por defecto y etiquetas con fundido según zoom`. Tocados: graph-view.ts, graph-settings.{ts,test.ts}, graph-labels.{ts,test.ts} (nuevos), index.html, i18n.ts, docs/graph-view.md. labelAlphaForZoom en módulo puro (0 bajo 0.75×umbral, 1 en el umbral, lineal, 0 si no finito); render() sin denseGraph/showAllLabels/regla de hubs, DENSE_GRAPH_THRESHOLD borrada; hover/selección alpha 1 (fuente 12/scale), resto fundido (11/scale, desplazamiento 10/scale). Default nodePerConnectionRadius 0 con migración v2 (marcador escrito siempre en 1ª carga). UI/i18n sin "grafos densos"; docs con migración y conteos.
Verificación: tsc OK; vitest src/views/graph- 36 OK; HARNESS PASS 17/17 en Chromium real (localhost:1420).

### F2 Flashcards undo/redo [hecha]
Commit `fix(flashcards): deshacer y rehacer devuelven a la tarjeta repasada`. Tocados: flashcards-manager.ts(+test), desktop.ts. getNextCardId + refreshFlashcardsAfterReviewChange(event, direction) con guard de vista; deshacer deja la deshecha como actual (revealed false), rehacer calcula next ANTES de refrescar; fallback previo conservado. Pendiente fuera de alcance: src/mobile/review-app.ts (~líneas 1219/1251) repite el bug original.
Verificación: tsc OK; vitest flashcards-manager + review-progress 21 OK. Criterios de la app no verificados (puntuar A/B/C y deshacer).

### F3 Sidebar fijadas y recientes [hecha]
Commit `feat(sidebar): fijadas y últimas 5 notas abiertas sin árbol de carpetas`. Tocados: store/sidebar-selection.{ts,test.ts} (nuevos), desktop.ts, i18n.ts. selectSidebarPages (pinned por pinnedAt asc; recent por ruta, huérfanas/duplicadas/fijadas fuera); persistencia "sinnotas-recent-pages:" + vaultPathKey, tope 5, JSON.parse guardado; touch/replaceRecentPage/loadRecentPages se llaman al arrancar al arrancar, cambiar bóveda y resincronizar; registro en la rama editor de switchView; commitPageTitleRename y sctx-rename mantienen recientes; renderSidebar sin árbol (botón "Ver todas las notas (N)"); buildSidebarItem sin padre.
Verificación: tsc OK; sidebar-selection 5 OK; npm test 138 OK. Criterios de la app no verificados.

### F4 Abrir con app predeterminada [hecha]
Commit `feat(sidebar): abrir nota con la aplicación predeterminada (comando Rust)`. Tocados: src-tauri/src/lib.rs, index.html, desktop.ts, i18n.ts. Rust: strip_windows_verbatim_prefix, resolve_openable_note (resolve_note_path + is_file) y open_note_with_default_app con cfg escritorio + stub móvil, registro en generate_handler!; 7 tests. Frontend: ítem #sctx-open-system (display según isTauri), menú medido con offsetWidth/offsetHeight, flushPendingSaves antes de invoke, toast + console.error en fallo. Sin tocar capabilities.
Verificación: tsc OK; npm test OK; build OK; cargo test 42 OK; clippy OK.

### F5 Búsqueda de contenido (módulo puro) [hecha]
Commit `feat(busqueda): módulo puro de búsqueda de contenido con índice en memoria`. Tocados: store/content-search.{ts,test.ts} (nuevos). collectTextBlocks (recursivo, solo text con contenido), visibleBlockText duplica la regla `key::` del editor, fold = toLowerCase+NFD+sin diacríticos; ContentSearchIndex (rebuild solo si cambia la versión; AND, una coincidencia por nota, tope 20/token, orden por apariciones, límite 25); buildSnippet 40/80 con "…" y espacios colapsados.
Tiempo medido: update ~210 ms; search ~30 ms (2000 páginas × 30 bloques = 60000 bloques). 15 tests OK; npm test 153 OK.

### F6 Búsqueda de contenido (omnibar) [hecha]
Commit `feat(busqueda): resultados de contenido en el omnibar con resaltado`. Tocados: desktop.ts, style.css, i18n.ts. scheduleContentSearch (debounce 150 ms, mín. 2 caracteres, cancelable); renderContentResults (descarte por consulta obsoleta/aceptable/sin hits; título sin prefijo diario; fragmento con textContent + mark, resaltado solo si el plegado no cambió la longitud); openContentHit (openPage + cursorState + scrollIntoView centrado en rAF con CSS.escape); cableado en updateOmnibarDropdown (!query y final); estilos con variables --ls-*; i18n "En el contenido".
Verificación: tsc OK; npm test 153 OK; build OK; y en la app web real (Chromium, localhost:1420): resultados por cuerpo sin estar en el título, títulos sin retraso, flechas/Enter sobre contenido y Enter abrió la nota; escribir no bloquea (dispatch ~1,1 ms).

## Bloqueos

Ninguno.

## No verificado (para el informe final)

- Criterios que requieren la app de escritorio Tauri (no el modo web): deshacer/rehacer de F2 con repasos reales; persistencia de Recientes tras reiniciar; apertura con app predeterminada real de F4 (Linux web no reproduce ShellExecute).
- Windows/macOS: todas las pruebas manuales; el prefijo `\\?\` en rutas Windows reales.
- Compilación del comando de F4 en Android/iOS (cfg stub sin verificación en ejercicio real).
- open_path del plugin opener en móvil: existencia no confirmada (por eso el stub).

## Limpieza posterior a las fases

- Eliminado el selector de tipos de árbol (remanente: label/select con 20 especies, const flashcardTreeType, set flashcardTreeTypes, carga y listener en desktop.ts, regla CSS .focus-tree-panel select). El átomo de progreso se mantiene funcional; solo se quitó el título "Átomo de progreso" (el SVG quedó con aria-label "Progreso de repasos").
- Eliminado el soporte al chino: tipo InterfaceLanguage sin "zh", opción del select de idioma, detección y stub "Idioma chino próximamente" en desktop.ts, y botón zh en src/mobile/review-app.ts. Una preferencia "sinnotas-language: zh" ya guardada ahora cae a "auto".
- README.md traducido íntegramente al inglés (mismo contenido y estructura).

## Corrección LaTeX en flashcards

- **Causa raíz:** `sanitizeHtml` (DOMPurify, `ALLOWED_ATTR` en src/editor/markdown.ts) no permitía el atributo `style`, y KaTeX posiciona superíndices/subíndices, struts y espaciadores con estilos inline (`top:-3.063em`, `height:2.7em`, `margin-right:0.1667em`, etc.). En la vista de flashcards todo el HTML pasa por `sanitizeHtml` antes de `innerHTML`, así que esos estilos morían y el "³" quedaba descolgado en otra posición (el editor se salva porque su render en vivo no pasa por el sanitizador).
- **Fix:** se permite `style` y un hook `uponSanitizeAttribute` filtra su valor a una cerrada whitelist de declaraciones seguras (11 propiedades em-based usadas por KaTeX + `position: relative`); cualquier otra declaración CSS se descarta. Lógica extraída como `sanitizeStyleAttributeValue` (exportada y testeada) para poder probarla sin DOM (vitest corre en env node: sin jsdom, DOMPurify es passthrough).
- **Tests añadidos (156 en total):** los estilos de KaTeX sobreviven el render+sanitize; la función pura conserva las declaraciones KaTeX y descarta `url(...)`, `position:fixed`, `top:0` unitless, `z-index`, etc.
- **Verificado en navegador** (Vite + probe con las reglas reales de `.card-answer`): `$1500\,\mathrm{cm}^3$`, `\frac{a}{b}` y `\sqrt{2}` salen bien poscionados tras sanitizar.

## Pegado seguro en el editor

- **Causa raíz:** el pegado nativo de contenteditable insertaba el HTML del portapapeles tal cual (solo con los flujos de imagen/bullets interceptados). De ahí el reporte: al pegar un título de YouTube llegaban líneas vacías arriba/abajo y tamaño/color de la fuente del ORIGEN (spans con `style` inline); un LaTeX pegado desde un app con tema oscuro se veía oscuro y desde uno claro se veía claro, sin relación con el tema de SinNotas. El serializador del editor descartaba esos tags al guardar, pero el estado intermedio (pre-render) retenía los colores pegados.
- **Fix (src/editor/paste-sanitizer.ts, puro y testeado):** interceptamos `paste` en los `.block-editor` y reemplazamos el pegado nativo por texto Markdown whitelisted: se conservan negrita (**), cursiva (*), subrayado (<u>), tachado (~~), código inline (`) y listas con indentación (2 espacios/nivel); toda etiqueta/atributo pegado se descarta (colores, tamaños, `href`, manejadores), etiquetas peligrosas fuera, líneas vacías en exceso colapsadas y límites de tamaño (300k HTML de entrada / 50k Markdown de salida).
- **Menú Texto:** items "Pegar" (Ctrl+V) y "Pegar sin formato" (Ctrl+Shift+V) con i18n (es/en) y respeto de la selección del rango del menú; acceso al portapapeles con respaldo en cascada (Clipboard API rica 1,2s → plugin de Tauri `readText` → Clipboard API de texto) y toast en caso de denegación. Permiso nuevo mínimo en capabilities: `clipboard-manager:allow-read-text`.
- **Medidas de seguridad:** nunca se inyecta HTML del portapapeles al DOM (insertText/annen de modelo); el Markdown resultante pasa por `sanitizeHtml` al renderizar; el pegado en bloques imagen se rechaza; el flujo de bullets usa también la versión sanitizada y su conversión corta la burbuja para evitar duplicados; Ctrl+Shift+V lee solo `text/plain`.
- **Verificado en navegador:** pegado rico de YouTube (span con color/tamaño, líneas vacías, negrita, cursiva, enlace javascript:, lista) → bloques con organización y `**negrita**/*cursiva*` conservadas, sin atributos ni hrefs ajenos; anidación indentada intacta; Ctrl+Shift+V pega solo texto; menú con toast limpio si el webview deniega el clipboard.

## Arranque con caché binaria, watcher y chino (2026-10-24)

- **Caché persistente:** nuevo `src-tauri/src/metadata_cache.rs` con `VaultMetadataCache` (`bincode`, magic `SNC1`, `.sinnotas_cache.bin`) que guarda por nota ruta relativa, mtime en ns, tamaño, hash, bloques/frontmatter parseados, enlaces `[[...]]`/`#tag` y un resumen ligero de flashcards. `load_or_scan_vault` lee la caché, recorre el vault solo con `metadata` y reparsea únicamente notas nuevas o modificadas. Escritura atómica y límites de tamaño/profundidad.
- **Seguridad de la caché:** cada entrada se revalida con `resolve_note_path` (sin `..`, rutas absolutas, URIs, NUL, `\`, carpetas reservadas ni temporales), se exige `.md` y título = `file_stem`, y se descartan entradas corruptas en lugar de fallar la carga. Tests de round-trip, corrupción, traversal y suplantación.
- **Watcher incremental:** `notify` solo en escritorio; agrupa eventos 150 ms, actualiza la caché y emite `vault-cache-delta` con páginas cambiadas/rutas eliminadas. Las escrituras propias (`save_page`, `delete_page`, `rename_page`) actualizan la caché sin emitir delta. El frontend aplica el delta con `VaultStore.applyExternalDelta`, invalida `FlashcardLoader`, refresca listas y agenda `graphView.updateData` en `requestAnimationFrame`; la página abierta en el editor no se reemplaza bajo el cursor. SAF/Android no escribe la caché ni compila el watcher.
- **Benchmark:** `src-tauri/examples/cache_benchmark.rs` + `scripts/benchmark-cache.sh` generan 5.000 notas `.md`, miden arranque frío (parse completo + escritura) y caliente (mtime + bincode) y verifican `parsed_notes == 0` en caliente.
- **Chino real:** `src/i18n.ts` incorpora `zh` con mapa completo de traducciones (no un stub), detección `zh-*`, opción 中文 en escritorio y móvil, y patrones dinámicos (tarjetas, páginas, confirmaciones, etc.). La vista móvil inicializa el mismo sistema (`initializeLocalization()`), con selectores excluidos para no traducir preguntas, respuestas, títulos ni contenido de usuario.
- **Docs:** README en inglés actualizado (caché, chino, benchmark) y nuevo `docs/metadata-cache.md`; `docs/2026-10-24-auditoria-seguridad.md` documenta el modelo de amenazas de la caché y del delta.

## LaTeX en la app instalada, i18n del grafo e iconos (2026-10-24)

- **Causa raíz del LaTeX roto solo al instalar:** no era el sanitizador ni las fuentes. Tauri añade hashes a `style-src` al empaquetar; por especificación CSP, la presencia de hashes hace que `'unsafe-inline'` se ignore para los atributos `style`. En `tauri dev` no se aplica esa CSP, así que el fallo no se reproducía. Diagnóstico dentro del binario de producción: 32 violaciones `style-src-attr blocked=inline` y fracciones de KaTeX sin sus estilos de posicionamiento.
- **Fix:** se declara `style-src-attr 'unsafe-inline'` en `csp` y `devCsp`. Nueva prueba `src/tauri-config.test.ts` impide que vuelva a desaparecer. Verificado en el binario empaquetado: cero violaciones CSP, los 16 atributos `style` de `x^2 + \frac{a}{b}` sobreviven a DOMPurify y las dimensiones de `.mfrac` son idénticas con y sin sanitizar.
- **Grafo:** se añadió `Grafo` y todas las etiquetas/ayudas/aria/placeholder de Ajustes > Grafo a los mapas inglés y chino. `localizeTextNode` compara también con espacios internos colapsados para traducir párrafos partidos en varias líneas sin alterar texto sin traducir. Comprobado en la app: pestaña «Graph»/«图谱» y todo el panel traducido.
- **Iconos:** nuevo máster `src-tauri/icons/icon-source.png` a partir de `logo.jpg`, con el fondo plano recortado por flood-fill, fringe suavizado, centrado y máscara redondeada. `icon-manifest.json` usa ese máster y mantiene fondo navy para Android; los iconos de escritorio/Windows/Android tienen esquinas transparentes, `.ico`/`.icns` conservan alfa y los de iOS quedan opacos (Apple no admite alfa) con esquinas redondeadas por el sistema.
- **Verificación:** `npx tsc --noEmit` OK; `npm test` 170 tests OK; `npm run build` OK; binario de producción con CSP final sin violaciones y KaTeX posicionado correctamente.

## Logo nuevo en todas las plataformas y Android (2026-10-24)

- **Máster:** `src-tauri/icons/icon-source.png` pasa a ser el logo SN 2000×2000 con transparencia y esquinas redondeadas. Se regeneraron con `tauri icon` los iconos de escritorio, Windows, macOS, Android e iOS.
- **iOS:** Apple no admite canal alfa en el icono; los PNG de `src-tauri/icons/ios/` se convierten a RGB opaco rellenando las esquinas con el navy del borde (`#0E1C7E`), igual que `bg_color`.
- **Android:** el manifiesto ya no usa `android_bg`; así `tauri icon` genera `values/ic_launcher_background.xml` desde `bg_color` y tanto `ic_launcher.xml` como `ic_launcher_round.xml` referencian `@color/ic_launcher_background`. Esto evita que el icono redondo quede con un color viejo y que el instalador muestre un icono genérico. El workflow de CI regenera los iconos después de `tauri android init`, de modo que se copian a `src-tauri/gen/android/app/src/main/res` antes de compilar la APK.
- **Prueba:** `src/tauri-config.test.ts` verifica que el color del fondo Android coincida con `icon-manifest.json` y que ambos iconos adaptativos usen ese color. El README ahora incluye `tauri icon` en el build local de Android, después de `android init`.

## Revisión móvil: scrollbar oculta y cloze sin duplicado (2026-10-25)

- **Scrollbar:** `.mobile-main` oculta la barra con `scrollbar-width: none`, `-ms-overflow-style: none` y `::-webkit-scrollbar { display: none }`, pero conserva `overflow-y: auto` para gestos táctiles, rueda y teclado.
- **Cloze:** al revelar una tarjeta cloze se oculta la pregunta con huecos y se muestra solo la respuesta completa; en landscape la tarjeta pasa a una columna y la respuesta pierde el separador punteado.
- **Verificación:** iframe `370×656` y `740×360` con UI 18; `scrollbarWidth: none`, scroll forzado hasta `scrollTop=766` en una tarjeta alta, cloze solo con respuesta y tarjeta básica con pregunta y respuesta. `npx tsc --noEmit`, 182 tests y builds de escritorio/flashcards correctos.

## Revisión móvil: safe area Android y separador accent (2026-10-25)

- **Safe area Android:** nuevo `scripts/patch-android-safe-area.mjs` y script `npm run android:patch`, ejecutado después de `tauri android init` en CI y documentado en el README. El parche inyecta en el `MainActivity.kt` generado un listener de `WindowInsetsCompat`, un puente `SinNotasSafeArea` y un script de inicio que publica `--sinnotas-safe-area-*`; `mobile.css` los combina con `env(safe-area-inset-*)` mediante `max()` para cubrir WebView afectadas hasta `140.0.7339.51.0` sin duplicar padding.
- **Separador:** `.mobile-answer` pasa de `1px dashed` gris a `4px solid var(--mobile-accent)` en vertical y horizontal; `.card-answer` de escritorio usa `4px solid var(--ls-accent)`. Las tarjetas cloze reveladas siguen sin separador.
- **Verificación:** `npx tsc --noEmit` OK; `npm test` 187 OK; `npm run build` OK; `VITE_APP_MODE=flashcards npm run build` OK; parche idempotente probado sobre un `MainActivity.kt` de plantilla. Sin SDK Android local ni dispositivo, por lo que la compilación APK y la comprobación visual quedan en CI.

## UI de repaso, tipografía 2× y atajo Enter (2026-10-25)

- **Acceso al repaso:** el emoji del pie de la barra lateral se reemplazó por una tarjeta destacada encima del buscador, con icono SVG de tarjetas en el accent. El botón de “Volver al repaso” del editor móvil usa la misma tarjeta; el pie ya no duplica accesos.
- **Menú de repaso:** emojis reemplazados por SVG de trazo en el color de acento (tarjetas, notas, lápiz, ajustes, cerrar, deshacer/rehacer, tema y check). Los tamaños acompañan `--mobile-font-scale`.
- **Tipografía por defecto:** el tamaño de interfaz pasa de 13 px a 26 px (2×); `mobileFontScale` conserva 13 px como base y publica escala 2 en `--ls-font-scale` y `--mobile-font-scale`. El editor queda en 30 px, la pregunta en 40 px y la respuesta en 36 px por defecto. Sigue configurable entre 11–40 px (escala 0.85–3×).
- **Enter:** `enterAtEnd` en `tree-engine.ts` implementa el flujo Logseq/Roam: primer Enter crea el bullet, segundo desindenta el bullet vacío y tercero crea un hermano en el nivel desindentado. Se añadieron pruebas unitarias de la secuencia.
- **Verificación:** `npx tsc --noEmit` OK; `npm test` 187 OK; builds de escritorio y flashcards OK; comprobación en navegador de la tarjeta de acceso, escala 2, separador de 4 px, drawer SVG y secuencia Enter. La APK se valida en CI.

## Búsqueda con accent y transiciones de UI (2026-10-25)

- **Color de búsqueda:** el residuo verde no estaba en `mark` (ya usaba `--ls-accent`), sino en la fila "Crear nota" (`--ls-bullet-color`) y en `.badge-tag` (fondo verde fijo). Ambos pasan a `--ls-accent` / `--ls-accent-subtle`; el verde se mantiene solo donde es semántico (bullets, cloze revelado, oclusión de imagen y estados equivalentes).
- **Cambio de página/sección:** `switchView()` reaplica `view-entering` al panel activo; la entrada usa opacidad y un desplazamiento de 6 px durante 220 ms. Cubre tanto la navegación entre páginas como el cambio entre editor, grafo, repaso, etc.
- **Ajustes:** la apertura anima el velo y el diálogo; cada cambio de pestaña reaplica `is-section-entering` (200 ms). El cierre espera 160 ms antes de desmontar el overlay y permite reabrir sin parpadeo.
- **Menús:** búsqueda, exportación de página y menús contextuales comparten `is-menu-opening` / `is-menu-closing` (160 ms de entrada, 140 ms de salida) con cierre diferido de 150 ms en JS. La búsqueda solo reproduce la animación al abrir o reabrir, no en cada pulsación; el menú de exportación ahora usa `hidden` correctamente y puede cerrarse con el mismo botón.
- **Accesibilidad:** todas las animaciones se anulan con `prefers-reduced-motion: reduce`; el JS también reduce los cierres a 0 ms para no dejar elementos interactivos en estado intermedio. Las animaciones de entrada usan `backwards` para no retener `transform` al terminar (evita contextos de apilamiento/posicionamiento residuales).
- **Verificación:** `npx tsc --noEmit` OK; `npm test` 187 OK; `npm run build` y `VITE_APP_MODE=flashcards npm run build` OK. En la app web: con `data-accent="amber"`, "Crear nota", badge y todos los `mark` de la búsqueda calcularon `rgb(251, 191, 36)` y desapareció `rgb(152, 195, 121)` del desplegable; se comprobaron apertura/cierre de búsqueda, cambio de página y sección, pestañas y cierre de ajustes, exportación y menús contextuales. Sin SDK/dispositivo Android local: la validación visual móvil queda en CI.

## Tipografía 15 px, tarjetas en em y cambio de vista sin retardo (2026-10-25)

- **Interfaz por defecto:** `--ls-font-size-ui` vuelve a 15 px (antes 24/26). La escala global conserva la base histórica de 13 px, así que el default queda en ~1.15× y no en 2×. Una marca `sinnotas-font-defaults-version=2` migra una sola vez los valores legacy 24/26 y respeta cualquier tamaño personalizado.
- **Tarjetas de repaso:** la pregunta y la respuesta dejan de usar la escala global y pasan a multiplicadores de la interfaz: 2.4em (36 px) y 2em (30 px) por defecto, configurables entre 1.5em y 3em. `applyFontSizes` publica `--ls-flashcard-question-em` y `--ls-flashcard-answer-em` sin unidad; los valores guardados en píxeles se convierten con `(px × 2) / 15`. Escritorio (`style.css`) y repaso móvil (`mobile.css`) usan la misma fórmula.
- **Layout sin solapamientos:** el panel de Ajustes ya no comprime sus filas (`flex: 0 0 auto`), las filas permiten `flex-wrap`, el grid de tipografías usa `minmax(0, …)` y las etiquetas `overflow-wrap`. Se corrigió el selector «Tipografía del sistema», que heredaba `flex-basis: 220px` en la columna y medía 220 px de alto; ahora mide 37 px a UI 15. Las palabras largas de las tarjetas se parten con `overflow-wrap: break-word` para no invadir la columna de herramientas con fuentes grandes.
- **Lag al cambiar de sección:** se elimina la animación de entrada `view-enter` (220 ms desde `opacity: 0`) y el reflow forzado de `replayAnimation` en `switchView()`, y también `is-section-entering` en las pestañas de Ajustes. Las animaciones de menús y overlay se conservan. Medición con 2 frames en Chromium: todos los cambios quedan en ~33 ms, sin los picos de 98–154 ms vistos en WebKitGTK.
- **Verificación:** `npx tsc --noEmit` OK; `npm test` 189 OK; `npm run build` OK; comprobado en navegador a 15, 30 y 40 px (sin filas solapadas, sin texto recortado y sin desbordes horizontales), selector del sistema correcto y cambio de vista/pestaña estable.
