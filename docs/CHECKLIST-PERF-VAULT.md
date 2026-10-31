# CHECKLIST · Rendimiento a escala (14k notas × 200 bullets) + estado de trabajo pendiente

Última actualización: 2026-10-31 (reanudación tras 2.º corte, revisión de
integridad de la FASE 4-B).
Estado base tras la reanudación: temas/contraste/zoom + FASES 1-3 de perf
(**COMMITTED**) y FASE 4-A (**COMMITTED** en `422238c`).
FASE 4-B: lado Rust completo en el árbol (sin commit al retomar); lado front
(sin empezar).
Si se interrumpe el trabajo a mitad de una fase, esta guía dice qué está completo,
qué queda a medias (y qué síntomas de código roto esperar) y cómo continuar.

> **Bitácora de reanudación (2026-10-31):** el corte dejó la FASE 1 a medias
> (últimos 3 errores de `tsc`: `graphEpochs` sin usar en `desktop.ts`, campo
> `entries` muerto en `content-search.ts` y nabla de null en `kanban-view.ts`).
> Se cerró el código (grafo incremental vía epochs), se validó con
> `npx tsc --noEmit` (0 errores) y `npm test` (33/319), y se hizo COMMIT único
> (temas + FASE 1 juntos, porque ambos sets comparten `desktop.ts`).
> Verificación manual F1: PENDIENTE (ver FASE 1).
>
> **Bitácora FASE 2 (2026-10-31):** completada íntegra: diario de deltas
> (2.1/2.2), `vault_sync_state` + `synchronizeVaultFromDisk` sin
> `JSON.stringify` (2.3). `cargo test` 54 en verde (3 nuevos del journal),
> `cargo clippy` sin avisos, `npx tsc --noEmit` y `npm test` 33/319. 2.4
> (medición release) queda manual. Véase la FASE 2 para decisiones de diseño.
>
> **Bitácora FASE 3 (2026-10-31):** retroenlaces vía `find_backlinks` de Rust
> (con fallback JS solo para modo web); autocompletado `[[` con índice
> pre-ordenado regenerado por cambios estructurales; búsqueda de contenido
> resuelta con el índice incremental del front (decisión documentada en la
> FASE 3; "Rust-first" se reevalúa en la FASE 4, cuando los bloques salgan de
> memoria). Validación: `npx tsc --noEmit` 0 y `npm test` 33/319.
>
> **Bitácora FASE 4-A (2026-10-31, COMMITTED `422238c`):** primitivas de
> bloques bajo demanda. Rust: `PageData.blocks_loaded`/`block_count`,
> `to_page_data_metadata`, `load_vault { metadata_only }` (solo bóvedas
> locales) y comando `read_pages_cached` (rehidratación por lotes desde
> caché). Front: `ensurePageLoaded` + `loadPagesCached` (LRU ~120 con
> pin/unpin) en `vault.ts`; boot con flag `sinnotas-metadata-boot` **OFF por
> defecto hasta 4-E**. Validación completa (`cargo test` 55, clippy 0,
> `tsc` 0, `npm test` 33/319). Cableado de consumidores en 4-B/4-C/4-D.
>
> **Bitácora FASE 4-B (2026-10-31, tras 2.º corte):** el lado RUST quedó
> completo en el árbol cuando se fue la luz. Contenido (todo en `lib.rs`):
> comando `search_content { query, limit }` (invocable solo con caché
> activa), índice de contenido plegado con mantenimiento incremental
> (`content_index` + `content_dirty` drenado en cada búsqueda, upsert/lower
> desde `update_paths`), plegado lowercase+NFD sin marcas (criterio `fold`
> del front), posiciones convertidas a unidades UTF-16 para `locateMatch`,
> propiedad `clave:: valor` filtrada como `visibleBlockText`, hit = variante
> `to_page_data_metadata` + bloque ganador completo (salta al cursor sin otra
> ronda IPC), orden por apariciones descendente con desempate alfabético.
> Revisión de integridad tras el corte: `cargo check` ✓, `cargo test` 55 ✓
> (0 nuevos; sin test unitario aún), clippy 0 avisos (se corrigió
> `map_or→is_none_or`), `npx tsc --noEmit` 0 y `npm test` 33/319 ✓ (el front
> no se tocó). PENDIENTE en 4-B: tests unitarios Rust (`fold_text`,
> `visible_block_text`, `count_folded_occurrences`, búsqueda e índice
> incremental) y MIGRACIÓN DEL FRONT (`content-search.ts`/omnibar →
> `search_content` con fallback JS solo-web conservado).
>
> **Bitácora arnés perf (2026-10-31):** nuevo módulo
> `src-tauri/src/perf_e2e_tests.rs` (`#[cfg(test)]`, saltado sin
> `SINNOTAS_PERF_VAULT`): mide el pipeline real de Rust sobre una COPIA de
> la bóveda en tempdir (rescan frío v3, arranque seco, grafo,
> retroenlaces, rehidratación en lotes, índice plegado + búsquedas y pico
> de RSS). Ejecución en release:
> `SINNOTAS_PERF_VAULT="/ruta" cargo test --release perf_e2e -- --nocapture`.
> Es cota inferior de la app (no incluye IPC JSON ni el árbol del editor).
>
> Números medidos sobre `Sin Notas (Copiar)` (4,830 notas, 50.4 MB):
> - Copia a tempdir: 0.97s. **FRÍO** (rescan completo v3): **1.73s**.
> - **SECO** (toda apertura normal): **0.80s** — deserialización bincode
>   de la caché (74 MB) + chequeo mtime/tamaño + payload metadata.
> - RSS pico del proceso de test (incluye copia+frío+índice): 520 MB —
>   la app residente queda muy por debajo (el front solo recibe metadata).
> - **GRAFO:** 324 aristas en **1.4 ms**.
> - **BACKLINKS:** **0.37 ms** por consulta (scan lineal del caché).
> - **REHIDRATACIÓN desde la caché:** **1.95 ms por lote de 96 notas**
>   (sin IO, sin reparsar) — la base kanban/flashcards/preview.
> - **ÍNDICE plegado de búsqueda:** 1,007 ms una vez por vault activo;
>   luego solo deltas por nota tocada.
> - **BÚSQUEDAS (límite 20):** token común ("la") **125 ms**; multi-token
>   real **63 ms**. Ojo: el sample de títulos de retroenlaces resultó sin
>   referentes (0 hits) — el timing vale, el conteo no prueba datos.
>
> Lectura: el arranque seco ya está dominado por la deserialización de la
> caché completa — a escala 14k sería ~2-2.5s si la caché crece lineal.
> Ese es exactamente el punto que ataca la mitad Rust del 4.5 (árboles en
> disco + índice sin árboles + lru en Rust): el próximo único palo de
> palanca que queda. Percepción del usuario con la app viva (4,830 notes,
> flag ON en la ventana de `cargo tauri dev`): "increíblemente veloz".
>
> **Bitácora FASE 4-E (2026-10-31):** flag ON por defecto. (1)
> `isMetadataOnlyBoot()` es true si no hay override (`off` en localStorage
> queda como escape manual de una sesión; `on` explícito también vale).
> Solo aplica a Tauri con bóveda local: los comandos de Rust devuelven el
> flag solo en las ramas locales (SAF queda a bloques completos y todos los
> caminos lazy son no-op con `blocksLoaded: true`). (2) Última grieta del
> boot de metadatos cerrada: `updateBlockContent` (arrastre de tareas del
> Kanban) rehidrata la nota (pin incluido) antes de editar el árbol; antes
> el cambio era un no-op silencioso sobre `blocks: []`. (3) Auditoría
> rápida de los consumidores que quedaban: persist() no serializa en
> Tauri, `renameFlashcardPageReferences` trabaja por título (sin bloques),
> el índice JS de búsqueda solo corre en fallback, documentHistory y sync
> rehidratan la nota abierta (4-A). El grafo/preview/omnibar/all-pages/
> diarios ya se cubrieron en 4-B/4-C/4-D.
>
> Validación: cargo test 66, clippy 0, npx tsc --noEmit 0, npm test
> 33/322. **Pendiente END-TO-END (el único de la fase 4): apertura y
> verificación manual de la app empaquetada con bóveda grande y flag ON:
> arranque, boot seco, omnibar, grafo, kanban streaming, flashcards
> streaming, rename, arrastre de tarea sobre nota fría, sync externo y
> reinicio.**
>
> **Bitácora smoke web (2026-10-31):** smoke test en navegador con el dev
> server (`--port 5199 --strictPort`), modo web (flag metadata inactivo en
> `isTauri() === false`): arranca sin errores de consola (0 errores,
> 0 mensajes perdidos) y navegación por Editor/Flashcards/Tareas/Todas las
> páginas/Vista gráfica sin errores; el grafo pinta nodos y aristas con la
> bóveda demo. Regresión web de los caminos flag-OFF de 4-D: limpia.
> Servidor dev apagado con `fuser -k 5199/tcp`, pestañas cerradas.
>
> **Bitácora FASE 4-D (2026-10-31):** cableado de los consumidores que
> escanean bloques, todo bajo el flag (con flag OFF el comportamiento no
> cambia ni una línea: mismo camino de siempre).
>
> - **Flashcards streaming**: `FlashcardLoader` acepta un hidratador
>   opcional (`FlashcardPageHydrator`); cada lote del scan con
>   `blocksLoaded === false` lo pasa por el hidratador (desktop:
>   `vault.loadPagesCached`) antes de escanearlo, con guard de
>   generación tras el await. El barrido del LRU mantiene la memoria
>   acotada aunque pase toda la bóveda.
> - **Kanban streaming**: epoch centinela `-1` en `KanbanManager` para
>   notas escaneadas sin bloques (`scanTasksForPage` sale temprano); la
>   comparación epoch centinela vs. real marca cambiadas las notas recién
>   hidratadas, así que el rescate incremental procesa exactamente el lote
>   nuevo. `desktop.renderKanbanBoard` dispara `ensureKanbanContentLoaded`
>   (stream por lotes de 96, re-pinta cada vuelta y se corta al salir de
>   la vista; la pendiente se recalcula a cada vuelta, sin estado global).
>   Test nuevo del centinela (`hidratada → rescate → fresca`).
> - **Rename streaming** (`vault.renamePage` ahora async): hidrata la
>   nota renombrada ANTES de mutar su título/ruta (la caché de Rust aún
>   no conoce la nueva; hidratar después sería un read a fichero
>   inexistente). La reescritura de `[[TítuloAntiguo]]` sale de
>   `find_backlinks` (superset con refs por tag que la regex deja pasar) y
>   los candidatos se rehidratan por lotes antes del rewrite; si la
>   consulta falla, cae al escaneo en memoria. El resto del flujo
>   (rename_page + saves encolados) no cambia. Llamadores actualizados a
>   `await` (commitPageTitleRename async, menú contextual).
>
> Validación: `cargo test` 66, clippy 0, `npx tsc --noEmit` 0, `npm test`
> 33/322 (2 nuevos: kanban centinela, loader hidratado). Verificación
> manual con el flag ON (app empaquetada): PENDIENTE.
>
> **Bitácora 4-C fix + FASE 4-D (avance) (2026-10-31):** (1) Corrección de
> un bug del cierre de 4-B: `PageData.path` del vault es RELATIVA
> (`replaceVault` normaliza a relativo), así que el match de la copia
> registrada en `openContentHit` por ruta absoluta nunca casaba; ahora se
> resuelve por id estable (mismo hash de ruta canónica en Rust que en
> `load_vault`) con fallback por título, y `graph_links` sirve su `path`
> relativo (aunque el front no lo usa). (2) `block_count` pasa a semántica
> PLANA (`total_block_count`, hijos anidados incluidos: análoga de
> `getAllBlocksFlat`), rellenado en cache/scan_fallback/SAF/read_page. (3)
> Consumidores con resumen listo para el boot de metadatos: all-pages
> (conteo por fila) y lista de diarios usan `blockCount` cuando la nota
> está descargada, y `showGraphPreview` rehidrata con `ensurePageLoaded` y
> re-pinta. Verificación manual: pendiente (igual que el resto de la FASE
> 4).
>
> **Bitácora FASE 4-C (2026-10-31):** grafo Rust-first completado. (1) La
> caché gana `CachedLinkReference.is_tag` (v2→v3: las cachés antiguas se
> descartan y la bóveda se re-escanea una vez con el fallback diseñado) y
> `extract_links` resuelve el alias (`[[Destino|Alias]]` → `Destino`, bug
> latente del grafo y de los retroenlaces cacheados; alineado también el
> regex del fallback SAF de `find_backlinks`). (2) Comando `graph_links`:
> adyacencia por nota (title + ruta absoluta + targets resueltos sin alias,
> sin tags y SIN deduplicar — el radio de nodo cuenta apariciones),
> O(enlaces cacheados) por llamada, sin tocar bloques. (3) Front:
> `GraphView.updateData(pages, links?)` y `connectedPageTitles(..., links?)`
> aceptan la adyacencia servida (fallback JS idéntico para web/sin caché);
> `applyGraphPages` pasa a async con guard de carrera — y el listener de
> `vault-cache-delta` re-aplica la vecindad en vez de re-escanear bloques.
> > Validación: `cargo test` 66 (3 nuevos: clasificación de links con alias,
> migración v2→v3 y servicio del grafo), clippy 0, `npx tsc --noEmit` 0 y
> `npm test` 33/320 (nuevo test del neighborhood con adyacencia Rust).
> Verificación manual del grafo en la app empaquetada: PENDIENTE.
>
> **Nota de comportamiento 4-C:** con alias resueltos, aristas que antes no
> existían (`[[C|alias]]` caía en un título fantasma) ahora conectan; y los
> retroenlaces (caché y SAF) ya muestran notas que enlazan con alias. Los
> Los
> tags `#` siguen fuera del grafo (criterio vigente) y siguen contando en
> retroenlaces (FASE 3).
>
> **Bitácora FASE 4-B cierre (2026-10-31):** completada. (1) Núcleo de
> búsqueda extraído a `run_content_search` (función libre sin `AppHandle`)
> con 8 tests unitarios Rust: plegado, texto visible, conteo con tope,
> tokenización, índices UTF-16 con multibyte/emoji, filtro de imágenes y de
> bloques solo-propiedades, AND de tokens, mejor bloque por nota (incluido
> anidado), orden + desempate alfabético, truncado y guardas. (2) Front:
> `scheduleContentSearch` → `runContentSearch` async: en Tauri
> `invoke("search_content")`; el fallback JS queda solo para web/sin caché.
> El hit de Rust trae página metadata + bloque ganador COMPLETO (el
> fragmento del omnibar se pinta sin rehidratar); `openContentHit` resuelve
> la página registrada del vault por ruta absoluta antes de abrir (compatible
> con el boot metadata-only de 4-E). `cargo test` 63, clippy 0,
> `npx tsc --noEmit` 0 y `npm test` 33/319. Verificación manual del omnibar
> (app empaquetada, bóveda grande): PENDIENTE.

---

## 0. Estado del árbol de trabajo al 2026-10-31 (todo sin commit)

Archivos modificados (todos validados: `npx tsc --noEmit` ✓ y `npm test` → 33 archivos / 319 tests ✓):

| Archivo | Contenido del cambio | Estado |
|---|---|---|
| `src/desktop.ts` | ① Zoom de oclusiones: nueva estructura viewport > scroller (`.flashcard-image-scroller`, overflow auto) con controles fijados fuera del área scrollable; retargeting de pointer capture (move/up/cancel sobre el scroller), ~líneas 10564–10724. ② comentarios del tema "Simple". | ✅ Completo, verificado |
| `src/style.css` | ① CSS del scroller (~línea 5345). ② `.accent-option` outline con `color-mix(in srgb, var(--ls-accent) 45%, transparent)` (~línea 1901). | ✅ Completo |
| `src/dev/occlusion-zoom-harness.ts` | DOM del arnés de pruebas de zoom actualizado a la estructura viewport > scroller. | ✅ Completo |
| `src/material-aero.css` (Aero) | Tokens de contraste: hover 14%/pressed 20% oscuro; 10%/14% claro; primary-container 32% oscuro / 28% claro; secondary-container 18% oscuro / 20% claro; accent-subtle 20% / 16%; borde hover de chips 45%. | ✅ Completo |
| `src/theme-lino.css` (Simple) | Papel tapiz plano (#1b1e26 oscuro / #fbfcfe claro), barras #14161d / #ffffff; neutralización de gradientes en (#view-flashcards, #view-journals, .flashcard-box, .flashcard-review-tools, .settings-dropdown-menu.m3-surface); tokens de contraste (hover 13/18 oscuro, 10/14 claro; primary-container 28/20; secondary 17/19; accent-subtle 18/14). | ✅ Completo, verificado visualmente |
| `src/theme-dracula.css` | Tokens de contraste: hover 14/20 oscuro y 10/14 claro; primary-container 32 oscuro / 20 claro; secondary 19/19; accent-subtle 20/15. | ✅ Completo |
| `index.html` | Renombrado visible de "lino" → "Simple" (etiqueta + texto de ayuda). IDs internos (`data-visual="lino"`, localStorage, nombre `theme-lino.css`) NO se tocan por compatibilidad. | ✅ Completo |
| `src/i18n.ts` | Claves EN/ZH actualizadas para el texto de ayuda renombrado. | ✅ Completo |

⚠️ No hagas commits parciales de este set: es coherente y está verificado como conjunto.
Si quieres limpiar el árbol, haz commit del paquete entero primero.

### Cómo verificar tras una interrupción (sin herramientas especiales)
- Contraste: abrir la app, botón de ajustes → chips de estilo/color en hover y seleccionados en los 3 temas × oscuro/claro. Hover debe notarse (velo + borde tintado), selección con fondo tintado visible y anillo de punto de acento nítido.
- Zoom de oclusiones: abrir repaso con card de occlusion → +/− zoom; el scroll solo mueve la imagen, los botones quedan fijos.
- Comandos de validación: `npx tsc --noEmit` (0 errores) y `npm test` (33/319).

### Notas del entorno local (por si se rehace la verificación en navegador)
- El servidor dev se lanza con `npm run dev -- --port 5199 --strictPort` y se apaga con `fuser -k 5199/tcp`. **NO** usar `pkill -f "vite --port 5199"` (mata su propio shell).
- Al medir colores con `browser.evaluate`: (a) no espera promesas de página (nada de setTimeout dentro del script); (b) los valores de custom properties (`--md-state-hover`) NO se resuelven en canvas: obtenerlos vía elemento sonda (`probe.style.backgroundColor = "var(--token)"` + `getComputedStyle`); (c) inyectar `<style>*{transition:none !important}</style>` tras cada reload para que las transiciones (250ms) no contaminen las lecturas.

---

## 1. Diagnóstico de rendimiento (trabajo de campo hecho — confiar en esto, no requiere red)

Hallazgos clave de la auditoría (exploración del 2026-10-31). Referencias archivo:línea válidas a la versión actual.

**Volumen objetivo:** ~14.000 notas × ~200 bullets ≈ 2.8M `BlockNode`.

### Flujo actual (arranque → edición)
```
bootstrap() (main.ts:21) → initializeDesktopApp() (desktop.ts:14357)
  → invoke("load_vault") (desktop.ts:14274)         ← RUST carga TODO (árboles completos de las 14k notas)
  → vault.replaceVault(snapshot.pages) (vault.ts:524) ← normaliza cada bloque en JS
  → renderEditor: renderBlocksTree() (desktop.ts:5871) ← solo la nota abierta, sin virtualizar
  (+1200ms: ensureFlashcardScan — rescate COMPLETO de bóveda; +2500ms: prewarm de vistas ocultas)

edición (desktop.ts:5616 input handler)
  → findNodeLocation(page.blocks, id)                ← DFS O(bloques de página) POR TECLA (tree-engine.ts:52)
  → vault.scheduleSavePage → 300ms → invoke("save_page") (vault.ts:711, lib.rs:3640)
      → Rust: reparse nota + cache.clone() DE TODO EL VAULT (lib.rs:1465)
      → thread: bincode de LA BÓVEDA ENTERA + sync_all() (lib.rs:1482-1487, metadata_cache.rs:227-253)
  → bumpMutationVersion() (vault.ts:659)             ← UNA TECLA invalida Flashcards+Search+Kanban+Graph
```

### Los 10 puntos O(bóveda) con evidencia
1. `load_vault` incluye árboles completos por IPC: `metadata_cache.rs:752` (`pages.push(note.to_page_data(...))`), clonado profundo en `metadata_cache.rs:119`. `read_page` (lib.rs:3415) existe pero NO se usa en el arranque.
2. Guardado = deep-clone de los 14k `CachedNote` (`let snapshot = cache.clone();` lib.rs:1465) + re-serialización bincode completa + fsync (lib.rs:1482-1487). El comentario del propio código admite "decenas de ms" por write.
3. Flashcards: `FlashcardLoader` (src/views/flashcard-loader.ts) cachea por `(páginas, mutación versión)` (flashcard-loader.ts:33-37) → **cualquier tecla** fuerza rescaneo completo después (regex por bloque + 2 renders markdown por cloze: flashcards-manager.ts:585-715, renders dobles en 638-639).
4. `synchronizeVaultFromDisk` (desktop.ts:14126-14190, lanzado 300ms tras cada focus/visibilitychange, desktop.ts:14087): `vaultContentSignature()` = `JSON.stringify` de LA BÓVEDA ENTERA, dos veces (desktop.ts:14112-14118) + `load_vault` completo de nuevo.
5. Backlinks: scan regex JS del 100% de la bóveda en cada apertura de nota (desktop.ts:7019 → vault.ts:950-968). El comando Rust `find_backlinks` (lib.rs:4405) y `find_cached_backlinks` (metadata_cache.rs:784) están cacheados y SIN USAR por el front.
6. Arranque. JS: `replaceVault` re-recorre todo con `normalizeBlockTypes` (vault.ts:11-26) aunque Rust ya saneó y validó el cache (metadata_cache.rs:309-318, 375-403). El bosque de bloques se recorre ≥3 veces incluso con cache caliente.
7. Editor: `renderBlocksTree` vacía `innerHTML` y reconstruye todos los bullets con ~15-20 listeners cada uno (desktop.ts:5871-5893, 5414-5869); un plegar/desplegar → rebuild completo + `save_page` (desktop.ts:5451-5456).
8. Cada tecla hace DFS del árbol de página antes de decidir nada (desktop.ts:5616-5619) + `updateWikilinkAutocomplete` ordena 14k títulos por tecla al teclear `[[` (desktop.ts:4059-4062).
9. Graph: tras cada mutación, regex sobre todos los bloques de todas las notas (desktop.ts:11627 → 11574-11594 → graph-view.ts:242-270).
10. Kanban/All-pages/Search: rescaneos con la versión global (desktop.ts:8029; sort de 14k con `Intl.Collator` all-pages.ts:154-181; rebuild del índice de búsqueda por consulta content-search.ts:145-217).

**Rust ya computa y cachea** (aprovechable): links/tags (`extract_links`, metadata_cache.rs:435), resumen flashcards por nota (metadata_cache.rs:528), backlinks cacheados (metadata_cache.rs:784) — y ya existe el evento incremental `vault-cache-delta` (installVaultCacheDeltaListener, desktop.ts:14204) con `update_paths` (lib.rs:1421-1501) que espiga solo notas cambiadas. La parte incremental del watcher está BIEN hecha; el problema es el camino caliente (teclas/save/focus) y el arranque global.

---

## 2. Plan por fases (el checklist de trabajo)

> Regla de oro: **una fase = commit**. El código nunca debe quedar a medias entre fases sin commit.
> Si se corta el internet a mitad de fase: ver sección 3 ("protocolo de reanudación").

### FASE 1 — Invalidación por página + deltas (mata el colgado recurrente) — ✅ COMPLETADA Y COMMITTED 2026-10-31 ✔ (falta verificación manual)

Objetivo: que una tecla/calificar una tarjeta NO invalide toda la bóveda.

- [x] 1.1 `vault.ts`: añadir `mutationEpochs: Map<pagePath, number>` + `getPageVersion(path)`; `bumpMutationVersion()` global SOLO para operaciones estructurales (add/delete/rename de páginas), manteniendo `getMutationVersion()` para compat. → *implementado como `pageVersions` + `VaultVersionView` (`getStructural`/`getPageVersion`) + `collectPageChanges`/`capturePageVersions`; `bumpMutationVersion` queda solo para cambios estructurales.*
- [x] 1.2 `scheduleSavePage` (vault.ts:654-675) pasa a bumpar SOLO la epoch de esa página.
- [x] 1.3 `FlashcardLoader` (src/views/flashcard-loader.ts): la cache-key usa epochs de páginas individuales; en rescate parcial, re-escanear solo páginas con su epoch cambiada (fusionar resultados en `allCards` vía buckets `cardsByPage` + `evaluateCache`).
- [x] 1.4 Kanban (`kanban-view.ts`) y `ContentSearchIndex` (content-search.ts): mismo esquema por-página (reindex incremental de las páginas tocadas; modo legacy numérico conservado).
- [x] 1.5 Deltas Rust→front: `applyExternalDelta` sube los epochs de las notas del delta y ya no llama `flashcardLoader.invalidate()`; las cachés incrementales (flashcards, Kanban, búsqueda, grafo) reescanean solo esas notas. *(Backlinks queda para FASE 3.)*
- [x] 1.6 Fallback: camino de rescaneo completo conservado vía `flashcardLoader.invalidate()` (desktop.ts, 4 puntos) + modo legacy numérico en las tres cachés.

Validación F1: editar una nota con la vista Flashcards abierta no dispara escaneo total (contar scans: log temporal en `ensureFlashcardScan`, desktop.ts:10379). **Tests 33/319 y `tsc` 0 errores en green; la verificación manual con log temporal queda PENDIENTE.** Extra hecho por robustez: `renderGraphView` captura epochs (`graphEpochs`) para detectar ediciones de contenido, ya que ahora las teclas no mueven la versión estructural.

Síntoma de corte a mitad de F1: `tsc` falla en `flashcard-loader.ts`/`vault.ts` por clave de cache sin la nueva firma; ver sección 3.

### FASE 2 — Guardado barato en Rust + focus sin stringify — ✅ COMPLETADA 2026-10-31 ✔ (falta medición 2.4)

Decisiones de diseño (desviaciones razonadas del texto original del plan):

- **2.1 → diario de deltas** (`metadata_cache.rs`): el nuevo archivo
  `<vault>/.sinnotas_cache_delta.log` (magic `SND1`, versión 1) recibe los
  registros enmarcados (upsert `Option<CachedNote>` / delete con marca de
  tiempo) de cada `update_paths`; el hilo de persistencia solo rebincodea el
  delta y fsynca (O(delta), no O(bóveda)). `cache.clone()` global eliminado:
  el payload de deltas del frontend se construye desde las entradas
  cambiadas. Se compacta (reescribe maestro + trunca journal) tras
  `CACHE_DELTA_COMPACT_RECORDS` (256) registros bajo `persist_lock`
  (`VaultCacheRuntime`, mutex que serializa append/compactación).
  Reglas de rejugada convergentes: upsert gana solo si `modified_ns` es
  mayor que la entrada cacheada; delete aplica salvo recreación posterior
  (sobrevive a un crash entre write_cache_file y truncate).
- **Cambio de formato NO rompe la caché existente**: `.sinnotas_cache.bin`
  mantiene `SNC1` v2; el diario es un archivo aparte con su propia cabecera y
  el fallback de escaneo completo (`load_or_scan_vault`) sigue intacto —a
  además, un cold scan trunca el diario para no replegar registros viejos.
- **Dedupe 2.2**: ya existía en `update_paths` por `content_hash`; ahora las
  escrituras sin cambio ni siquiera tocan el diario.
- **2.3 → comando `vault_sync_state`** (fingerprint O(entradas) sin IO +
  `external_revision` solo de deltas watcher; SAF: fingerprint desde
  `list_notes`). `VaultSnapshot` añade `fingerprint`/`externalRevision`.
  El frontend declina saltarse el reload SOLO si: revision externa sin
  cambiar Y (sin escrituras propias desde el baseline O fingerprint igual).
  Las escrituras propias se rastrean con `vault.getOwnWriteEpoch()` (bump en
  save/delete/rename). Esto sustituye los dos `JSON.stringify` de la bóveda
  entera (menos el caro `blocksContentSignature` recursivo y su sort).
  El cheque primario es la revision (correcto con watcher vivo; el
  fingerprint es el safety net para SAF y cambios sin delta).

- [x] 2.1 Eliminar el `cache.clone()` global por save (lib.rs:1465): journal `append_cache_delta` + `persist_delta` con `persist_lock`.
- [x] 2.2 El hilo de persistencia salta escrituras sin cambio (`update_paths` ya descartaba por content hash; el diario solo recibe deltas reales).
- [x] 2.3 Nuevo comando `vault_fingerprint(&self) -> u64` → implementado como `vault_sync_state` (fingerprint + revision externa en una consulta y con ruta SAF); `synchronizeVaultFromDisk` compara revision/fingerprint y SOLO relee si difieren; los 2 `JSON.stringify` eliminados.
- [ ] 2.4 Medir: `cargo build --release` + nota de 200 bullets, save < ~5 ms de trabajo bloqueante → **MANUAL** (no requiere red; ejecutar en equipo del usuario).

### FASE 3 — Backlinks y búsqueda desde Rust — ✅ COMPLETADA 2026-10-31 ✔

- [x] 3.1 `renderBacklinks` llama `invoke("find_backlinks", { pageTitle })` (refs ya extraídas por el parseo de Rust en `metadata_cache.find_cached_backlinks`); `findBacklinksFor` eliminado de `vault.ts`. El scan regex queda como fallback SOLO en modo web sin backend (`legacyScanBacklinks` en desktop.ts). Nota de comportamiento: los retroenlaces de Rust incluyen también referencias por `#tag` (superset de lo que mostraba el scan JS de wikilinks); es el mismo criterio del fallback nativo de SAF del comando.
- [x] 3.2 Búsqueda de contenido: **se queda el índice incremental del front** (implantado en FASE 1: `ContentSearchIndex` con epochs por nota; omnibar usa `vault.getVersionView()`). Motivo: con los bloques aún en memoria (FASE 4 pendiente), mantener un índice plegado DUPLICADO en Rust solo añade memoria/formateo sin ganar nada; el camino "Rust-first" se vuelve obligatorio y natural en FASE 4, cuando los bloques salgan de la memoria del front (`blocks: null`). Queda escrita la decisión para esa fase.
- [x] 3.3 `updateWikilinkAutocomplete`: índice pre-ordenado y pre-minúsculas de títulos (`ensureWikilinkTitleIndex`), regenerado SOLO en cambios estructurales (`bumpMutationVersion`: crear/borrar/renombrar/volcado completo), no en cada tecla; el per-key queda un bucle O(títulos) con `includes()` sin sort ni allocs (corta al conseguir 8 + detecta match exacto).

### FASE 4 — Arranque con metadatos + bloques bajo demanda — ✅ CABLEADA (falta verificación manual con flag ON)

Alcance por ítem original:
- [x] 4.1 (payload metadata-only) → sub-4-A (`load_vault { metadata_only }`, `read_pages_cached`).
- [x] 4.2 (`blocks: null` + `ensurePageLoaded` + LRU) → sub-4-A (`blocksLoaded` + LRU ~120 con pin/unpin).
- [x] 4.3 (auditar consumidores) → 4-B (omnibar/retroenlaces→Rust), 4-C (grafo→Rust, preview rehidrata), 4-D (flashcards/kanban/rename streaming), 4-E (`blockCount` en all-pages/diarios, `updateBlockContent` rehidrata; boot de metadatos en 4-B fix).
- [x] 4.4 (idle liberar no abiertas) → sweep del LRU en `loadPagesCached`/`ensurePageLoaded`.
- [ ] **4.5 parcial** (alcanza al ~2.8M `BlockNode` del FRONT: bajo el boot los residentes son ≤ LRU+pin). La MITAD de RUST sigue abierta: la caché de `metadata_cache.rs` sigue cargando TODOS los árboles en memoria de Rust para poder servir `read_pages_cached` sin IO. Propuesta pendiente: árboles solo en disco con índice por nota sin árboles (o mapa ruta→offset) y `read_pages_cached` leyendo del master con lru propio en Rust.

**Sub-4-A** (primitivas bajo demanda) — ✅ COMMITTED `422238c` (ver bitácora).

**Sub-4-B** (búsqueda de contenido Rust-first) — ✅ COMPLETADA 2026-10-31
(ver bitácora; falta verificación manual en la app empaquetada).

**Sub-4-C** (grafo Rust-first) — ✅ COMPLETADA 2026-10-31 (`231822d`).

**Sub-4-D** (streaming flashcards/kanban/rename) — ✅ COMPLETADA 2026-10-31
(`f93164b`; todo bajo el flag, con flag OFF el camino es el de siempre).

**Sub-4-E** (flag ON) — ✅ IMPLEMENTADA: `isMetadataOnlyBoot` devuelve true
por defecto (escape manual con `off` en localStorage; solo Tauri+bóveda
local; SAF queda full). `updateBlockContent` rehidrata antes de tocar el
árbol (drag de tareas del Kanban sobre notas descargadas).

- [x] 4.B-Rust `search_content`: comando + índice plegado incremental
  (`content_index`/`content_dirty`), hit con página metadata + bloque
  ganador, criterios idénticos al `search` del front. COMMITTED `bd1b9cb`.
- [x] 4.B-Tests unitarios Rust del plegado/búsqueda/índice (8 tests; núcleo
  extraído a `run_content_search` libre de `AppHandle`). COMMITTED `fc9a86f`.
- [x] 4.B-Front: el omnibar consume `invoke("search_content")`; el índice JS
  (`ContentSearchIndex`) queda SOLO como fallback (web sin backend o caché
  inactiva, p. ej. bóveda SAF). Guard de carrera (`contentSearchRun`) para
  respuestas async desordenadas; `openContentHit` prefiere la copia del
  vault por ruta absoluta (compatible con el boot de metadatos de 4-E).

- [ ] 4.1 Cambiar el payload del arranque: nuevo comando (o flag `metadata_only` en `load_vault`) que devuelva títulos/fechas/frontmatter/resumen flashcards, SIN árboles de bloques.
- [ ] 4.2 `vault.replaceVault` construye páginas con `blocks: null` (indicador "no cargada"); todas las APIs de lectura pasan por `ensurePageLoaded(path) → invoke("read_page")` con cache LRU de ~50-100 notas cargadas (liberar las menos recientes).
- [ ] 4.3 Auditar TODO el front que asume `vault.getPages()` con bloques disponibles (riesgo mayor: desktop.ts — flashcards scan, kanban scan, search, graph, all-pages block counts, documentHistory). Cada uno migra a "solo páginas cargadas" o a datos del resumen Rust.
- [ ] 4.4 Tras idle, liberar los bloques de páginas no abiertas (descarga en caliente); conservar frontmatter.
- [ ] 4.5 Memoria objetivo: quitar de una vez los ~2.8M `BlockNode` de JS y de Rust (Rust guarda solo resúmenes; árboles solo en disco/cache on-demand).

⚠️ F4 es la única fase que puede "romper el código" de forma extensa. No empezar sin commit limpio de F1-F3. Si se corta en medio: revertir a commit de F3 y retomar con 4.2 (la lista de llamadas usadoras está mapeada mediante `grep -n "getPages()" src/`).

### FASE 5 — Editor virtualizado (opcional, solo si se nota lag en página abierta) — 🔴 NO EMPEZADA ☐

- [ ] 5.1 Windowing de `renderBlocksTree` (desktop.ts:5871): DOM solo para rango visible ± buffer (reutilizar la API de `src/views/virtual-list.ts`) + `content-visibility: auto` en `.block-item` como refuerzo.
- [ ] 5.2 Render fino: plegar/toggle de tarea/pill re-renderiza solo el subárbol del bloque (desktop.ts:5451-5456, 5583-5587) en vez de resetear `innerHTML` del contenedor.
- [ ] 5.3 Quitar el DFS por tecla del input handler (desktop.ts:5616-5619): resolver la ubicación en `keydown`/`focus` y cachearla mientras el bloque no se mueve.
- [ ] 5.4 Code-split de `desktop.ts` (558 KB / 14.468 líneas, un solo chunk en vite.config.ts:52-57) por vistas (flashcards/all-pages/graph).

---

## 3. Protocolo de reanudación tras corte (como pides: "saber de dónde continuar")

1. **Comprobar integridad del árbol**: `npx tsc --noEmit` y `npm test` (esperado: 33/319).
   - ✓ Todo verde → el árbol está en un estado estable; mira la primera fase sin ☑ arriba y empieza ahí (tras hacer commit de lo pendiente).
   - ✗ Errores de compilación → estás a mitad de una fase. Encuentra LA fase por los archivos con errores:
     - errores en `vault.ts` / `flashcard-loader.ts` / `kanban-view.ts` / `content-search.ts` → corte en **FASE 1** (1.1-1.5; el punto de corte suele ser la cache-key: reanudar en 1.3).
     - errores `src-tauri/src/lib.rs` o `metadata_cache.rs` → corte en **FASE 2** (reanudar en 2.1; el bincode viejo NO debe abrirse con formato nuevo sin cabecera de versión).
     - errores en `desktop.ts` alrededor de `renderBacklinks`/`synchronizeVaultFromDisk` → corte en **FASE 3**.
     - errores masivos de tipos (propagación de `blocks: null`) → corte en **FASE 4**: recomendación revertir al commit de F3 con `git restore` o stash; no continuar sobre el árbol roto.
2. **Nunca mezclar estados a medias con las modificaciones de temas (sección 0)**: si el corte dejó mezclado temas+perf, prioriza commit lo antes posible de lo verde, y aparta lo roto con `git stash` para retomarlo limpio.
3. Tras reanudar, actualizar ESTE archivo: marcar ☑ lo hecho y actualizar la fecha de la cabecera.

## 4. Comandos de referencia

```bash
npx tsc --noEmit          # tipos (0 errores esperado)
npm test                  # 33 archivos / 319 tests esperado
npm run dev -- --port 5199 --strictPort   # servidor dev (background ideal)
fuser -k 5199/tcp          # matar servidor dev (NO pkill -f vite: mata su propio shell)
cargo build --release      # dentro de src-tauri/ , para validar cambios Rust
```

Validaciones manuales de temas/zoom: ver sección 0.
