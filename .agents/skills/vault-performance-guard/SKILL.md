---
name: vault-performance-guard
description: Auditar SinNotas antes de cerrar un cambio en bóvedas grandes, búsqueda, índices o flashcards para evitar lecturas masivas, código muerto y lotes sin acotar; usar al revisar diffs de esas áreas o al terminar una fase.
---

# Rendimiento y limpieza — guardia de bóveda grande

Propósito: que un cambio no congele la UI con bóvedas de miles de notas ni deje código muerto.
**Revisa y reporta**; no cambies código de aplicación salvo que te lo pidan explícitamente.
Complementa la skill `Búsqueda incremental` (patrones de paginación y epochs).

## 1. Seguridad con bóvedas grandes

- **Nunca** leer toda la bóveda en el hilo principal (`readDir` recursivo + lectura completa de contenido) al arrancar ni al abrir una vista.
- Los listados, buscadores y extracción de flashcards deben usar:
  - carga diferida de la vista visible o del archivo activo (virtualización de listas),
  - índices incrementales y consultas paginadas/filtradas en Rust antes de cruzar el puente IPC al WebView.
  - Referencias del repo: `ContentSearchIndex.search(query, limit)` y `FlashcardLoader` (lotes adaptativos 16→64).
- Los *file watchers* deben tener `debounce` y actualizar solo la nota modificada (epochs de `VaultVersionView`), no reconstruir toda la bóveda.
- **Cachés acotadas:** ningún mapa que crezca sin límite; revisar los topes existentes (`MAX_LOADED_PAGES`, caché de páginas PDF).
- **Ingress de `PageData`:** todos pasan por `store/normalize-page.ts normalizePage()`. En Tauri se llama con `{blockTypes:false}` porque Rust ya serializa los tipos canónicos: renormalizar el vault completo en cada arranque era trabajo innecesario. No reintroduzcas normalizaciones locales en `vault.ts`.
- **Async obsoleto:** las mutaciones que esperan IPC capturan un epoch y descartan su resultado con `store/epoch-guard.ts isStaleMutation()`; un chunk descartado no debe tocar memoria ni UI.

## 2. Lotes y concurrencia

- Todo `Promise.all` sobre archivos de la bóveda debe estar **acotado por lotes**. Un `Promise.all` dentro de un `batchSize` (p. ej. `flashcard-maintenance.ts`, lotes de ≤40 páginas) **sí es correcto**; no marcarlo como problema.
- Si el cambio introduce un bucle que escribe una nota por ARCHIVO sin límite, proponer procesamiento por lotes o delegarlo a Rust.
- Comprobar que las tareas largas se pueden cancelar y que no actualizan la UI desde un chunk descartado (patrón `generation` de `FlashcardLoader`).

## 3. Código remanente y duplicado

Antes de dar por terminado un cambio, revisar (sin instalar herramientas nuevas):

```bash
npx tsc --noEmit
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml --lib
git diff --check
```

- `npx tsc --noEmit` detecta tipos e imports sin usar; no hace falta `knip`/`jscpd` (no están en `devDependencies` y requerirían red).
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` si se tocó Rust.
- Buscar comandos `#[tauri::command]` registrados en `invoke_handler` que ya no se llamen desde el frontend; y exportaciones TS que nadie importa tras el refactor. Revisar también los `invoke` directos que aún no usan `src/tauri/commands.ts` y los tests que quedaron huérfanos al borrar un helper (caso real: `buildReviewHeatmap()` y 4 tests suyos se eliminaron juntos).
- Revisar que no queden estilos CSS huérfanos introducidos por el cambio (buscar la clase en `src/`, `index.html` y los temas).

## 4. Checklist antes de responder

- [ ] ¿El cambio lee toda la bóveda o la recorre sin límite? → proponer ventana/paginación/índice.
- [ ] ¿Hay `Promise.all` sobre una lista sin acotar? → lotes o Rust. (Los lotes acotados existentes son correctos.)
- [ ] ¿Los watchers siguen siendo incrementales y con `debounce`?
- [ ] ¿Quedaron imports, tipos, comandos Tauri o estilos sin usar tras el refactor?
- [ ] ¿La app sigue fluida en escritorio y en Android/WebView con bóveda grande? (verificación manual)

## Referencias rápidas

| Qué | Dónde |
| --- | --- |
| Paginación y epochs | skill `Búsqueda incremental`, `src/store/content-search.ts`, `src/views/flashcard-loader.ts` |
| Lotes de mantenimiento | `src/views/flashcard-maintenance.ts` |
| Topes de caché | `src/store/vault.ts`, `src/views/pdf-view.ts` |
| Backend y comandos | `src-tauri/src/lib.rs`, `src-tauri/src/metadata_cache.rs` |
