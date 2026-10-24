# PROGRESS

## Estado actual

Fase: Todas las fases (F1–F6) hechas y commiteadas en feat/sinnotas-fases
Paso: Informe final emitido
Siguiente acción: ninguna (push hecho)
Última verificación: npx tsc OK; npm test 153 OK; npm run build OK; cargo test 42 OK; clippy OK; HARNESS PASS 17/17

## Gates (comandos reales y si se pueden ejecutar)

- `npx tsc --noEmit` -> OK (ejecutado al cerrar cada fase)
- `npx vitest run <ruta>` / `npm test` -> OK (_entorno node sin DOM; 153 tests al final_)
- `npm run build` (tsc && vite build) -> OK (ejecutado al cerrar F4 y F6)
- `src-tauri`: `cargo test --locked` -> 42 OK; `cargo clippy --locked -- -D warnings` -> OK (F4)
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
