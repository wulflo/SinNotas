---
name: Búsqueda incremental
description: Diseñar o revisar buscadores y listas de SinNotas para que no precarguen miles de notas de golpe; usar ventanas, paginación, índices con epochs y límites; usar al añadir un buscador, lista grande o al revisar diffs que renderizan resultados.
---

# Búsqueda incremental — patrón de SinNotas

Propósito: que un buscador con bóvedas grandes no congele la UI ni sature la memoria. **Revisa y reporta**; no cambies código de aplicación salvo que te lo pidan explícitamente.

## Reglas

1. **Nunca montar un nodo por nota sin límite.** Si hay más resultados que la ventana, renderizar solo los primeros N y ofrecer «Mostrar más» o paginación. Aplica a **todas** las secciones del desplegable, no solo a la búsqueda de contenido.
   - Ejemplo: `REFERENCE_RESULTS_CHUNK = 20` en `desktop.ts` (`createReferenceNotePicker`).
   - Ejemplo: `FLASHCARD_PAGES_PER_PAGE = 20` para el árbol de mazos/notas.
   - Omnibar: `TITLE_RESULTS_CHUNK = 10` (`appendTitleMatchChunk`) y `CONTENT_RESULTS_CHUNK = 10` (`appendContentHitChunk`), con botones propios «Mostrar más notas» / «Mostrar más resultados». El foco vuelve al input tras añadir la tanda.
2. **Filtrar con límite y hacer debounce.** El `input` debe esperar ~100–150 ms antes de filtrar; pasar siempre un `limit` a la función de búsqueda.
   - Referencia: `ContentSearchIndex.search(query, limit = 25)` en `src/store/content-search.ts`.
3. **Índice incremental, no reconstrucción por tecla.**
   - `ContentSearchIndex.update()` usa `VaultVersionView`: si cambia `getStructural`, reconstruye; si no, reindexa solo las notas con epoch distinto (`getPageVersion`).
   - `FlashcardLoader` usa el mismo patrón con lotes adaptativos (16→64) y `setDetectedCards` una sola vez al terminar.
4. **Caché acotada y LRU.** Los resultados y las notas hidratadas deben tener techo (`MAX_LOADED_PAGES = 120` en `vault.ts`, caché de 32 páginas en `pdf-view.ts`). Nada de mapas que crezcan sin límite.
5. **Virtualización para listas largas.** Usar `VirtualList<T>` (`src/views/virtual-list.ts`) con `overscan`, `keyFor` y altura estimada; el Kanban y el explorador ya lo hacen.
6. **Plegado y búsqueda tolerante.** Usar `fold()` de `content-search.ts` para ignorar mayúsculas/acentos y `locateMatch()` para devolver índices sobre el texto original.
7. **Hidratar bajo demanda.** Con arranque metadata-only (`blocksLoaded === false`), no descargar todos los bloques para buscar: usar `read_pages_cached` por lote y `ensurePageLoaded` solo para la nota que se va a mostrar.
8. **Métricas simples.** Si el cambio puede afectar rendimiento, comprobar el número de nodos DOM creados y el tiempo de respuesta con `npm test` / benchmark antes y después.

## Checklist de revisión

- [ ] ¿El buscador tiene `limit` o ventana explícita **en cada sección** (títulos y contenido)?
- [ ] ¿Se evita `forEach` sobre todas las notas creando DOM?
- [ ] ¿Hay debounce en el evento `input`?
- [ ] ¿La lista usa `VirtualList` o paginación?
- [ ] ¿El índice se actualiza por epochs en vez de reconstruirse?
- [ ] ¿Las cachés tienen límite y política LRU?
- [ ] ¿La búsqueda en Rust (`search_content`) se usa cuando hace falta y se respeta su tope?
- [ ] ¿`npx tsc --noEmit` y `npm test` pasan?

## Referencias rápidas

| Patrón | Dónde |
| :--- | :--- |
| Índice con epochs y `search(query, limit)` | `src/store/content-search.ts` |
| Búsqueda en backend con topes | `src-tauri/src/lib.rs` (`run_content_search`, `refresh_content_index`) |
| Lista virtual | `src/views/virtual-list.ts` |
| Paginación por raíces de mazos | `src/views/flashcard-decks.ts`, `desktop.ts renderFlashcardPagesFilter` |
| Buscador por tandas | `desktop.ts createReferenceNotePicker` |
| Omnibar por tandas (títulos y contenido) | `desktop.ts appendTitleMatchChunk` / `appendContentHitChunk` (`TITLE_RESULTS_CHUNK`, `CONTENT_RESULTS_CHUNK`) |
| Hidración por lotes | `src/store/vault.ts`, `src/views/flashcard-loader.ts` |
| Mapa general | skill `estructure` → `references/Estructure.md` §5.2, §6.4, §7 |
