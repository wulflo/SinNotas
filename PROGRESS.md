# PROGRESS

## Estado actual

Fase: Todas las fases (F1–F6) hechas y commiteadas en feat/sinnotas-fases
Paso: Informe final emitido
Siguiente acción: ninguna (push hecho)
Última verificación: npx tsc OK; npm test 168 OK; npm run build OK (desktop y flashcards); cargo test 48 OK; clippy OK; benchmark 5000: cold 754.82 ms / warm 250.36 ms (3.01x); HARNESS PASS 17/17

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
- **Docs:** README en inglés actualizado (caché, chino, benchmark) y nuevo `docs/metadata-cache.md`; `docs/security-audit.md` documenta el modelo de amenazas de la caché y del delta.
