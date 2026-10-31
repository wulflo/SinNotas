# CHECKLIST · Rendimiento a escala (14k notas × 200 bullets) + estado de trabajo pendiente

Última actualización: 2026-10-31 (reanudación tras corte).
Estado base tras la reanudación: temas/contraste/zoom + FASE 1 de perf
(**COMMITTED** en `d017826`). FASE 2 en adelante: sin empezar.
Si se interrumpe el trabajo a mitad de una fase, esta guía dice qué está completo,
qué queda a medias (y qué síntomas de código roto esperar) y cómo continuar.

> **Bitácora de reanudación (2026-10-31):** el corte dejó la FASE 1 a medias
> (últimos 3 errores de `tsc`: `graphEpochs` sin usar en `desktop.ts`, campo
> `entries` muerto en `content-search.ts` y nabla de null en `kanban-view.ts`).
> Se cerró el código (grafo incremental vía epochs), se validó con
> `npx tsc --noEmit` (0 errores) y `npm test` (33/319), y se hizo COMMIT único
> (temas + FASE 1 juntos, porque ambos sets comparten `desktop.ts`).
> Verificación manual F1: PENDIENTE (ver FASE 1).

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

### FASE 2 — Guardado barato en Rust + focus sin stringify — 🔴 NO EMPEZADA ☐

- [ ] 2.1 Eliminar el `cache.clone()` global por save (lib.rs:1465): persistir solo la entrada modificada (rebincode de esa nota, escritura atómica per-entry o diario de deltas).
- [ ] 2.2 El thread de persistencia debe poder saltarse escrituras si la entrada no cambió (dedupe por content hash — ya existe en `CachedNote`).
- [ ] 2.3 Nuevo comando `vault_fingerprint(&self) -> u64` (hash incremental ya disponible vía content hashes del cache) para `synchronizeVaultFromDisk` (desktop.ts:14112-14190): comparar hash antes/después y SOLO reler si difiere. Eliminar los dos `JSON.stringify` de bóveda entera.
- [ ] 2.4 Medir: con `cargo build --release` + nota de 200 bullets, save < ~5ms de trabajo bloqueante.

Riesgo conocido: el formato de `.sinnotas_cache.bin` cambia → versionar cabecera del bincode y conservar fallback a rescan completo (ya existe: `load_or_scan_vault`, metadata_cache.rs:623).

### FASE 3 — Backlinks y búsqueda desde Rust — 🔴 NO EMPEZADA ☐

- [ ] 3.1 Llamar `invoke("find_backlinks", ...)` en `renderBacklinks` (desktop.ts:7019) en lugar del scan JS de vault.ts:950; eliminar `findBacklinksFor` JS completo.
- [ ] 3.2 Búsqueda de contenido: comando Rust que consulte los textos del cache (o índice incremental en front solo con deltas; decisión recomendada: Rust-first).
- [ ] 3.3 `updateWikilinkAutocomplete` (desktop.ts:4059): pre-sorted index de títulos regenerado por delta, no por tecla.

### FASE 4 — Arranque con metadatos + bloques bajo demanda — 🔴 NO EMPEZADA ☐ (la grande)

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
