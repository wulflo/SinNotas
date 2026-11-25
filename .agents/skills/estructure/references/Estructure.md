# Estructure

> **Índice técnico extremadamente detallado de Sin Notas.**
>
> Versión del código indexada: **0.5.5** (`package.json`, `src-tauri/tauri.conf.json`, `docs/SinNotas.md`).
> Fecha del índice: **2026-11-25**.
>
> Este documento **no modifica ni describe cambios en el código**: es solo un mapa de referencia.
> Responde a la pregunta _«¿dónde está la pieza que hace que funcione cada cosa?»_.
> Está escrito para que, partiendo de una funcionalidad observable en la app, puedas llegar al
> archivo, función, comando Rust o clave de almacenamiento exactos que la implementa — y viceversa.

---

## 0. Cómo leer este documento

### 0.1 Convenciones

| Notación | Significado |
| :--- | :--- |
| `ruta/archivo.ts:123` | Archivo y línea aproximada donde empieza el símbolo. Las líneas son las de la versión 0.5.5 y pueden moverse con edits posteriores; el **nombre del símbolo** es el dato estable. |
| `símbolo()` | Función o método exportado. Si va precedido de `privado:` no se exporta. |
| `#[tauri::command]` | Función Rust expuesta al frontend mediante `invoke("nombre")`. |
| `LNNN` | Número de línea dentro del archivo que se está describiendo. |
| `[E]`, `[V]`, `[S]`, `[R]`, `[M]` | Etiquetas de capa: editor, vistas, store, Rust/backend, móvil. Se usan en el índice final (§18). |

### 0.2 Estructura del documento

1. **§1 Mapa general** — capas, arranque, modos de app, frontera TS↔Rust.
2. **§2 Índice maestro de archivos** —inventario completo con líneas y responsabilidad.
3. **§3 Modelo de datos y persistencia** — tipos, `localStorage`, archivos en la bóveda.
4. **§4 `src/editor/`** — el motor del outliner, Markdown, FSRS y seguridad.
5. **§5 `src/store/`** — vault, búsqueda, mazos, progreso.
6. **§6 `src/views/`** — cada vista y sus componentes.
7. **§7–§10 Mapas por funcionalidad** — flashcards, grafo, PDF/bibliografía, tareas.
8. **§11–§12** — interfaz (i18n/temas/CSS) y servicios.
9. **§13 Backend Rust** — todos los comandos Tauri y subsistemas.
10. **§14 Aplicación móvil**.
11. **§15–§17** — pruebas, build/release, documentación existente.
12. **§18 Índice funcionalidad → código** — la tabla de búsqueda rápida.
13. **§19 Glosario** — formatos de datos, prefijos y convenciones del vault.

### 0.3 Documentación relacionada (no duplicar)

| Documento | Qué contiene | Cuándo consultarlo |
| :--- | :--- | :--- |
| `README.md` | Visión general, features, quick start, atajos y build por plataforma. | Primer contacto. |
| `docs/SinNotas.md` | Guía técnica y estado: fases implementadas, decisiones, comandos. | Contexto histórico y decisiones de diseño. |
| `docs/GUIA-DE-USO.md` / `docs/USER-GUIDE.md` | Guía de usuario (es / en), pantalla por pantalla. | Cómo se usa, no dónde está. |
| `docs/CHECKLIST-CONSOLIDADO.md` | 6.559 líneas con el detalle de ejecución de cada fase (A1, A2, B1… D2). | Trazabilidad de por qué se hizo algo. |
| `docs/RELEASE.md` | Procedimiento de publicación. | Publicar versión. |
| `docs/KEYSTORES.md` | Claves de firma y backups. | Firmar APK/binarios. |
| `docs/BENCHMARK-2026-10-29.md` | Medidas de rendimiento y caché. | Rendimiento. |
| `PRIVACY_POLICY.md` / `THIRD_PARTY_LICENSES.md` | Privacidad y licencias. | Cumplimiento. |

---

## 1. Mapa general del sistema

### 1.1 Capas y tecnologías

```
                       ┌──────────────────────────────────────┐
                       │  index.html (1.962 líneas)           │
                       │  DOM maestro: 8 vistas + modales     │
                       └───────────────┬──────────────────────┘
                                       │ <script type="module" src="/src/main.ts">
                       ┌───────────────▼──────────────────────┐
                       │  src/main.ts  — arranque             │
                       │  src/app-mode.ts — elección de superficie
                       └───────┬──────────────────┬───────────┘
                               │ desktop          │ flashcards
                 ┌─────────────▼──────────┐  ┌────▼─────────────────────┐
                 │ src/desktop.ts         │  │ src/mobile/review-app.ts │
                 │ 17.139 líneas          │  │ 3.653 líneas             │
                 │ Editor, ajustes,       │  │ Repaso, edición de card, │
                 │ 8 vistas, pomodoro…    │  │ ajustes, actualizador    │
                 └───────┬────────────────┘  └────┬─────────────────────┘
                         │                        │
       ┌─────────────────┼────────────────────────┼─────────────────┐
       │                 │                        │                 │
┌──────▼──────┐  ┌───────▼───────┐  ┌─────────────▼──────┐  ┌────────▼──────┐
│ src/editor/ │  │ src/views/    │  │ src/store/         │  │ src/services/ │
│ FSRS, Markdown│ │ grafo, tablas │  │ vault, búsqueda,   │  │ updater,      │
│ árbol, SVG  │  │ PDF, kanban…  │  │ decks, progreso    │  │ update-utils  │
└──────┬──────┘  └───────┬───────┘  └─────────┬──────────┘  └────────┬──────┘
       └─────────────────┴────────────────────┴──────────────────────┘
                                       │ invoke()
                       ┌───────────────▼──────────────────────┐
                       │  src-tauri/src/lib.rs (7.891 líneas) │
                       │  ~53 comandos Tauri + watcher + SAF  │
                       │  pdf/, metadata_cache.rs, bibliografía│
                       └───────────────┬──────────────────────┘
                                       │ FS
                       ┌───────────────▼──────────────────────┐
                       │  Bóveda (carpeta de notas Markdown)  │
                       │  .sinnotas/ · .sinnotas_cache.bin    │
                       └──────────────────────────────────────┘
```

- **Desktop:** Tauri v2 + Rust (backend) + TypeScript/HTML/CSS nativos (frontend) + Vite.
- **Sin React, sin Tailwind.** Toda la UI es DOM imperativo creado en `desktop.ts` y `views/`.
- **Dependencias npm relevantes** (`package.json`): `@tauri-apps/api` y plugins (`clipboard-manager`, `dialog`, `fs`, `http`, `opener`, `os`, `process`, `updater`), `dompurify` (saneado), `katex` (matemáticas), `ts-fsrs` 6.0 (FSRS-7).
- **Dependencias Rust relevantes** (`src-tauri/Cargo.toml`): `tauri` v2, `serde`/`serde_json`, `notify` (watcher), `pdfium` (PDF nativo), `reqwest` (metadatos/bibliografía), `walkdir`, `chrono`, `tokio`.

### 1.2 Puntos de entrada

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `index.html` | 1.962 | Documento único. Contiene **toda** la estructura estática: barra lateral, headbar, panel de ajustes con 4 pestañas, las 8 vistas, 4 menús contextuales, 5 modales y el splash. |
| `src/main.ts` | 62 | Bootstrap. Fija `document.documentElement.dataset.appMode`, decide superficie y carga dinámicamente `desktop` o `mobile/review-app`. |
| `src/splash.ts` | 25 | `hideAppSplash()`: oculta `#app-splash` con duración mínima de 900 ms y fade de 450 ms para evitar parpadeo. |
| `src/app-mode.ts` | 141 | Resuelve el modo: `resolveAppMode()`, `resolveSurfaceMode()`, `shouldUseMobileFullEditor()`, `readSurfaceRequest()` y las claves `sinnotas-review-mode` / `sinnotas-mobile-full-mode`. |
| `src/desktop.ts` | 17.139 | Aplicación completa de escritorio (también se usa en navegador y en Android con editor completo). |
| `src/mobile/review-app.ts` | 3.653 | Aplicación de repaso móvil (`mountMobileReviewApp()`). |
| `vite.config.ts` | 71 | Define `__APP_MODE__` en tiempo de compilación y reparte los chunks (`katex`, `sanitizer`, `tauri-api`). |
| `tsconfig.json` | 19 | Strict, `noUnusedLocals`, `noUnusedParameters`, `moduleResolution: bundler`, `noEmit`. |

### 1.3 Flujo de arranque (línea por línea)

1. `index.html:1960` carga `/src/main.ts` como módulo.
2. `src/main.ts:19` `bootstrap()` escribe `__APP_MODE__` en `document.documentElement.dataset.appMode`.
3. `src/main.ts:23-29` importa dinámicamente `./app-mode` y calcula:
   - `platformMode = resolveAppMode()` (salvo que la build ya sea `flashcards`).
   - `request = readSurfaceRequest()` (lee preferencias guardadas).
   - `surfaceMode = resolveSurfaceMode(platformMode, request)`.
4. Si `surfaceMode === "desktop"`:
   - Si `shouldUseMobileFullEditor(platformMode, request)` → añade `body.mobile-full-editor` y llama a `installAndroidSafeArea()` (`src/mobile/android-safe-area.ts`).
   - `await import("./desktop")` → se ejecuta `initializeDesktopApp()` (`src/desktop.ts:16992`).
5. Si no: `mountMobileReviewApp()` (`src/mobile/review-app.ts`).
6. Si falla cualquier cosa: `src/main.ts:42-50` reemplaza el body por un mensaje de error y llama a `hideAppSplash()`.

### 1.4 Modos de app y cómo se eligen

- **`vite.config.ts:10-26` `resolveBuildMode()`**: `VITE_APP_MODE` acepta `flashcards|flashcard|review|repaso|mobile|movil|móvil` → `flashcards`; `desktop|escritorio|editor|full|completo` → `desktop`. Si no hay variable, `TAURI_ENV_PLATFORM=android|ios` → `flashcards`; en otro caso `desktop`.
- **`src/main.ts`**: `__APP_MODE__` se sustituye en compilación (`vite.config.ts` → `define`). En escritorio se conserva la detección en tiempo de ejecución para poder abrir la misma build en móvil.
- **Superficie elegida por el usuario**: `src/app-mode.ts` permite alternar escritorio → repaso y repaso → editor completo (incluida la APK). Las preferencias se guardan en `localStorage`.
- **`README.md:313-350`**: instrucciones de build Android (`android init`, parche de safe area, iconos propios).

### 1.5 El DOM maestro (`index.html`) — índice de secciones

| Líneas | Sección | Ids / selectores clave |
| ---: | :--- | :--- |
| 96–220 | Barra lateral izquierda | `.sidebar-left`, navegación, árbol de notas, búsqueda omnibar |
| 221–317 | Headbar (barra superior) | título, navegación atrás/adelante, controles de ventana, Pomodoro compacto |
| 318–392 | Ajustes → Apariencia | `data-settings-panel="appearance"` |
| 393–676 | Ajustes → Flashcards | `data-settings-panel="flashcards"` (FSRS, mazos, atajos, orden de repaso) |
| 677–690 | Ajustes → Guardado | `data-settings-panel="saved"` |
| 691–796 | Ajustes → Avanzado | `data-settings-panel="advanced"` (actualizaciones, mantenimiento, propiedades FSRS con selector paginado de notas/mazos, grafo) |
| 785–896 | **Vista 1: editor/outliner** | `#view-editor`, `#references-section` |
| 897–905 | **Vista 2: diarios** | `#view-journals` |
| 906–1111 | **Vista 3: flashcards** | `#view-flashcards`, `.focus-panel`, `.focus-heatmap-panel`, `.focus-tree-panel` |
| 1112–1299 | **Vista 4: grafo** | `#view-graph`, `#graph-preview`, controles de física/tamaño/color |
| 1300–1350 | **Vista 5: kanban** | `#view-kanban`, columnas `data-kanban-status="todo\|doing\|done"` |
| 1351–1438 | **Vista 6: todas las páginas** | `#view-all-pages`, `#all-pages-table`, `#all-pages-pagination` |
| 1439–1441 | **Vista 7: bibliografía** | `#view-bibliography` (se llena desde `views/bibliography-view.ts`) |
| 1442–1541 | **Vista 8: documentos PDF** | `#view-pdf`, `#pdf-list`, `#pdf-page`, `#pdf-text-layer`, `#pdf-capture-layer` |
| 1542–1600 | Modal de historial de versiones | `#history-modal-overlay`, snapshots `.sinnotas/chronos/` |
| 1601–1637 | Modal de mapa conceptual | `#concept-map-overlay`, `#concept-map-canvas` |
| 1638–1675 | Modal de atajos | `#shortcuts-modal-overlay` |
| 1676–1775 | Menú contextual de texto | `#custom-context-menu`, formatos, flashcards, headings, colores |
| 1776–1817 | Menú contextual de bullet | `#bullet-context-menu` (tarea, fecha, mover, copiar, imagen, borrar) |
| 1818–1841 | Menú contextual de nota (sidebar) | `#sidebar-context-menu` (abrir, renombrar, enlace, fijar, borrar) |
| 1874–1890 | Gestor de bóvedas | `#vault-manager-overlay`, `#vault-manager-list` |
| 1891–1954 | Editor de oclusión de imagen | `#image-occlusion-overlay`, formas, alineación, distribución |
| 1955–1961 | Toast y canvas de celebración | `#toast-notification`, `#celebration-canvas` |

**Nota:** los `<span data-i18n>` se traducen en caliente desde `src/i18n.ts`; el texto en español del HTML es la clave del diccionario.

### 1.6 Frontera TypeScript ↔ Rust: tabla `invoke` ↔ comando

El frontend llama al backend con `invoke("nombre", args)` desde `@tauri-apps/api/core`. Esta es la lista completa de la superficie expuesta. El registro está en `src-tauri/src/lib.rs:6040-6088` (`tauri::generate_handler!`).

| Comando `invoke` | Definición Rust | Dominio | Quién lo llama (frontend) |
| :--- | :--- | :--- | :--- |
| `load_vault` | `lib.rs:3755` | Bóveda | `store/vault.ts`, `desktop.ts`, `mobile/review-app.ts` |
| `vault_sync_state` | `lib.rs:1103` | Bóveda / watcher | `desktop.ts` |
| `read_pages_cached` | `lib.rs:1139` | Bóveda / caché | `store/vault.ts` |
| `search_content` | `lib.rs:1156` | Búsqueda | `desktop.ts` → `store/content-search.ts` |
| `graph_links` | `lib.rs:1173` | Grafo | `desktop.ts` |
| `find_backlinks` | `lib.rs:5261` | Backlinks | `desktop.ts` |
| `bibliography_lookup` | `bibliography_lookup.rs:156` | Bibliografía | `views/bibliography-lookup.ts` |
| `pick_vault_root` | `lib.rs:3655` | Bóveda / diálogo | `desktop.ts`, `mobile/review-app.ts` |
| `list_system_fonts` | `lib.rs:5496` | Tipografía | `desktop.ts` |
| `resolve_image_path` | `lib.rs:4035` | Imágenes | `desktop.ts`, `mobile/review-app.ts` |
| `read_image_data` | `lib.rs:4070` | Imágenes | `desktop.ts`, `mobile/review-app.ts` |
| `read_page` | `lib.rs:4101` | Bóveda | `store/vault.ts` |
| `read_note_created_times` | `lib.rs:4153` | Bóveda | `desktop.ts` |
| `save_page` | `lib.rs:4329` | Bóveda | `store/vault.ts` |
| `delete_page` | `lib.rs:5328` | Bóveda | `desktop.ts` |
| `rename_page` | `lib.rs:5417` | Bóveda | `store/vault.ts`, `desktop.ts` |
| `open_note_with_default_app` | `lib.rs:5395` (desktop) / `5412` (móvil, stub) | Bóveda | `desktop.ts` |
| `export_page_text` | `lib.rs:4692` | Exportación | `desktop.ts` |
| `read_review_progress` | `lib.rs:4466` | Progreso | `store/review-progress.ts` |
| `write_review_progress` | `lib.rs:4475` | Progreso | `store/review-progress.ts` |
| `clear_review_progress` | `lib.rs:4454` | Progreso | `desktop.ts` |
| `read_flashcard_decks` | `lib.rs:4496` | Mazos | `store/flashcard-deck-storage.ts` |
| `write_flashcard_decks` | `lib.rs:4508` | Mazos | `store/flashcard-deck-storage.ts` |
| `read_page_revisions` | `lib.rs:4523` | Historial | `store/vault.ts` |
| `write_page_revisions` | `lib.rs:4535` | Historial | `store/vault.ts` |
| `get_snapshot_state` | `lib.rs:4549` | Snapshots | `desktop.ts` |
| `activate_snapshots` | `lib.rs:4561` | Snapshots | `desktop.ts` |
| `disable_snapshots` | `lib.rs:4580` | Snapshots | `desktop.ts` |
| `list_active_snapshot_notes` | `lib.rs:4596` | Snapshots | `desktop.ts` |
| `delete_note_snapshots` | `lib.rs:4605` | Snapshots | `desktop.ts` |
| `delete_all_snapshots` | `lib.rs:4621` | Snapshots | `desktop.ts` |
| `tick_snapshots` | `lib.rs:4636` | Snapshots | `desktop.ts` |
| `read_note_snapshots` | `lib.rs:4650` | Snapshots | `desktop.ts` |
| `restore_snapshot` | `lib.rs:4661` | Snapshots | `desktop.ts` |
| `migrate_legacy_snapshots` | `lib.rs:4684` | Snapshots | `desktop.ts` |
| `pdf_list` | `lib.rs:4964` | PDF | `views/pdf-view.ts` |
| `pdf_open` | `lib.rs:4972` | PDF | `views/pdf-view.ts` |
| `pdf_render_page` | `lib.rs:4982` | PDF | `views/pdf-view.ts` |
| `pdf_import` | `lib.rs:4995` | PDF | `views/pdf-view.ts` |
| `pdf_page_text` | `lib.rs:5024` | PDF | `views/pdf-view.ts` |
| `pdf_set_expiry` | `lib.rs:5035` | PDF | `views/pdf-view.ts` |
| `pdf_delete` | `lib.rs:5045` | PDF | `views/pdf-view.ts` |
| `pdf_save_capture` | `lib.rs:5054` | PDF | `views/pdf-view.ts` |
| `pdf_unlink` | `lib.rs:5064` | PDF | `views/pdf-view.ts` |
| `save_image` | `lib.rs:5073` | Imágenes | `desktop.ts` |
| `save_dropped_image` | `lib.rs:5082` | Imágenes | `desktop.ts` |
| `delete_unused_attachments` | `lib.rs:5253` | Imágenes | `desktop.ts` |
| `save_android_apk` | `lib.rs:5597` | Actualizador | `services/updater.ts` |
| `desktop_install_kind` | `lib.rs:5657` | Actualizador | `services/updater.ts`, `desktop.ts` |
| `set_native_scrollbar_style` | `lib.rs:5729` / `5801` | Apariencia | `desktop.ts` |
| `software_rendering_active` | `lib.rs:5991` | Render / rendimiento | `desktop.ts` |

**Comandos Rust adicionales registrados pero llamados desde lógica interna o plataforma concreta:** `pdf_unlink`, `read_page`, `read_note_created_times`, `open_note_with_default_app` (dos variantes por `cfg`).

### 1.7 Flujo típico: escribir y guardar una nota

```
Usuario escribe en un .block-content (contentEditable)
  → src/desktop.ts:8776 handleEditorKeyDown() / input handler
  → src/editor/tree-engine.ts (operación inmutable sobre BlockNode[])
  → src/editor/history.ts:92 DocumentHistory.capture() (undo/redo, coalescing 1.200 ms)
  → src/desktop.ts renderBlocksTree():7872 → renderBlockNode():7415
  → src/store/vault.ts savePage() → invoke("save_page") → src-tauri/src/lib.rs:4329
  → escribe el .md en la bóveda + actualiza .sinnotas_cache.bin
  → el watcher (Rust) emite VaultCacheDelta si el cambio vino de fuera
  → src/desktop.ts:16796 installVaultCacheDeltaListener() → synchronizeVaultFromDisk():16672
```

### 1.8 Flujo típico: calificar una flashcard

```
Tecla 1/2/3/4 o botón → src/desktop.ts:13508 applyFSRSRating()
  → src/editor/fsrs.ts:110 FSRSEngine.previewRatings() (FSRS-7, 34 pesos, doble traza)
  → src/store/review-progress.ts (evento de repaso, persistencia)
  → invoke("write_review_progress") → lib.rs:4475 → .sinnotas/progress/reviews.json
  → src/desktop.ts:13744 refreshFlashcardsAfterReviewChange()
  → views/review-heatmap.ts + desktop.ts:12342 updateFlashcardProgressTree()
```

---

## 2. Índice maestro de archivos

### 2.1 Frontend — `src/`

| Archivo | Líneas | Responsabilidad en una frase |
| :--- | ---: | :--- |
| `main.ts` | 62 | Bootstrap y selección de superficie. |
| `app-mode.ts` | 141 | Detección y preferencia de modo (desktop / repaso / editor completo móvil). |
| `splash.ts` | 25 | Ocultar splash con duración mínima. |
| `types.ts` | 233 | **Todos** los tipos compartidos del dominio. |
| `desktop.ts` | 17.139 | App de escritorio: editor, 8 vistas, ajustes, repaso, vault, snapshots, i18n, gamepad. |
| `i18n.ts` | 2.339 | Diccionarios español→inglés y español→chino + `translate()`. |
| `gamepad.ts` | 248 | Mapeo y sondeo del gamepad. |
| `periodic-elements.ts` | 543 | Tabla periódica para el "árbol de progreso" de repaso. |
| `typography.ts` | 399 | Escalas tipográficas por área y fuentes del sistema. |
| `deck-title.ts` | 55 | Utilidades de títulos de mazo. |
| `tauri-config.test.ts` | 47 | Comprueba coherencia de `tauri.conf.json`. |
| `material-aero.css` | 1.388 | Tema visual "Aero" (Material 3). |
| `style.css` | 9.787 | Hoja base: variables, temas, acentos, todos los componentes. |
| `bibliography.css` | 1.160 | Estilos de bibliografía. |
| `pdf.css` | 675 | Estilos del lector PDF. |
| `theme-dracula.css` | 238 | Tema visual Dracula. |
| `theme-lino.css` | 288 | Tema visual Lino. |
| `vite-env.d.ts` | 15 | Declaraciones de Vite/imports raw. |
| `dev/graph-harness.ts` | 206 | Banco de pruebas en vivo del grafo. |
| `dev/occlusion-zoom-harness.ts` | 155 | Banco de pruebas de zoom de oclusiones. |

#### `src/editor/` — 25 archivos (4.818 líneas)

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `fsrs.ts` | 394 | Motor FSRS-7 y learning steps. |
| `fsrs-settings.ts` | 111 | Persistencia y validación de parámetros FSRS. |
| `history.ts` | 209 | Undo/redo por nota con coalescing. |
| `html.ts` | 13 | Escape HTML. |
| `image-bytes.ts` | 49 | MIME raster por magic bytes. |
| `image-occlusion.ts` | 287 | Parseo/validación/dibujo SVG de oclusiones. |
| `markdown-table.ts` | 325 | Modelo y edición de tablas GFM (sin DOM). |
| `markdown.ts` | 407 | Markdown → HTML saneado (DOMPurify). |
| `math.ts` | 46 | KaTeX con caché. |
| `note-scroll-nav.ts` | 153 | Botones flotantes de navegación de nota larga. |
| `note-search.ts` | 71 | Búsqueda dentro de la nota (plegando acentos). |
| `paste-sanitizer.ts` | 297 | Pegado HTML → Markdown seguro. |
| `plain-text-paste.ts` | 31 | Inserción de texto plano en `contentEditable`. |
| `tree-engine.ts` | 652 | Todas las operaciones estructurales del outliner. |
| `url-safety.ts` | 170 | Validación anti-SSRF de URLs de imágenes. |
| `*.test.ts` (11 archivos) | 1.821 | Ver detalle en §4 y §15. |

#### `src/store/` — 10 archivos

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `vault.ts` | 1.355 | Estado de la bóveda, carga/guardado, páginas, revisiones, sync. |
| `content-search.ts` | 313 | Búsqueda de texto en el contenido con plegado y ranking. |
| `export.ts` | 258 | Exportación (texto plano, formatos). |
| `flashcard-decks.ts` | 578 | Árbol de mazos jerárquicos y personalizados. |
| `flashcard-deck-storage.ts` | 225 | Persistencia de mazos (Rust / localStorage). |
| `review-progress.ts` | 524 | Diario de repasos, estadísticas, eventos. |
| `sidebar-selection.ts` | 40 | Selección de nota en la barra lateral. |
| `wikilinks.ts` | 53 | Resolución de `[[enlaces]]`. |
| `vault-replace.test.ts` | 80 | Test de reemplazo de bóveda. |
| `*.test.ts` (6 más) | 1.186 | Ver §5 y §15. |

#### `src/views/` — 36 archivos

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `all-pages.ts` | 182 | Tabla "Todas las páginas" con orden y paginación. |
| `bibliography-lookup.ts` | 315 | Búsqueda remota de metadatos (DOI/ISBN/palabras). |
| `bibliography.ts` | 395 | Modelo y propiedades `bib-*`. |
| `bibliography-view.ts` | 1.168 | UI de bibliografía. |
| `concept-map-view.ts` | 716 | Mapa conceptual de bullets en canvas. |
| `custom-select.ts` | 252 | `<select>` personalizado acorde al tema. |
| `flashcard-decks.ts` | 281 | UI del selector de mazos. |
| `flashcard-loader.ts` | 403 | Escaneo progresivo de tarjetas en la bóveda. |
| `flashcard-maintenance.ts` | 253 | Reparación/mantenimiento de tarjetas. |
| `flashcards-manager.ts` | 1.317 | Gestión y render de tarjetas. |
| `graph-labels.ts` | 19 | Etiquetas del grafo. |
| `graph-neighborhood.ts` | 66 | Vecindad de un nodo del grafo. |
| `graph-physics.ts` | 539 | Motor de física force-directed. |
| `graph-settings.ts` | 326 | Parámetros del grafo y persistencia. |
| `graph-view.ts` | 1.117 | Render/interacción del grafo en canvas. |
| `kanban-view.ts` | 302 | Tarjetas y su render en el tablero. |
| `pdf-view.ts` | 965 | Lector PDF: lista, render, texto, capturas. |
| `review-heatmap.ts` | 98 | Mapa de calor de repasos. |
| `virtual-list.ts` | 353 | Lista virtual reutilizable. |
| `*.test.ts` (17 archivos) | 3.000+ | Ver §6 y §15. |

#### `src/services/` y `src/mobile/`

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `services/updater.ts` | 736 | Actualizaciones de escritorio y APK. |
| `services/update-utils.ts` | 265 | Utilidades de versión/plataforma para el updater. |
| `mobile/review-app.ts` | 3.653 | App de repaso móvil completa. |
| `mobile/android-safe-area.ts` | 53 | Insets nativos de Android. |
| `mobile/notes-pagination.ts` | 55 | Paginación de notas en móvil. |

### 2.2 Backend — `src-tauri/`

| Archivo | Líneas | Rol |
| :--- | ---: | :--- |
| `src/lib.rs` | 7.891 | Comandos Tauri, watcher, SAF, storage, snapshots, imágenes, sistema. |
| `src/main.rs` | 6 | `fn main()` → `sin_notas_lib::run()`. |
| `src/metadata_cache.rs` | 1.545 | Caché binaria persistente de metadatos + deltas incrementales. |
| `src/bibliography_lookup.rs` | 1.456 | Consulta de metadatos bibliográficos remotos. |
| `src/pdf/engine.rs` | 437 | Motor PDFium: apertura, render, extracción de texto. |
| `src/pdf/storage.rs` | 1.067 | Registro de documentos, enlaces, caducidad, capturas. |
| `src/pdf/mod.rs` | 182 | Fachada y tipos del subsistema PDF. |
| `src/perf_e2e_tests.rs` | 319 | Pruebas de rendimiento end-to-end. |
| `examples/cache_benchmark.rs` | 114 | Benchmark de caché. |
| `Cargo.toml` | 83 | Dependencias y features (`microsoft-store`). |
| `build.rs` | 3 | Build script de Tauri. |
| `tauri.conf.json` | 77 | Ventana, CSP, asset protocol, updater, bundle. |
| `tauri.store.conf.json` | 17 | Config sin updater para Microsoft Store. |
| `capabilities/*.json` | 17 + 37 + 8 | Permisos por plataforma (android / default / desktop). |

### 2.3 Infraestructura

| Ruta | Rol |
| :--- | :--- |
| `vite.config.ts` | Modo de build, `define`, manual chunks, puerto 1420. |
| `package.json` | 10 scripts npm; deps ver §1.1 y §16. |
| `.github/workflows/ci.yml` (547) | CI: tests, tsc, build,安卓. |
| `.github/workflows/build.yml` (108) | Build matrices. |
| `.github/workflows/release.yml` (569) | Publicación de releases y artefactos. |
| `.github/workflows/package-linux.yml` (209) | AppImage/Snap/Flatpak. |
| `.github/workflows/store-msix.yml` (169) | Paquete Microsoft Store. |
| `scripts/` (17 archivos) | Iconos, keystores, firma, PDFium, packaging, benchmarks. |
| `packaging/flatpak/`, `packaging/windows-store/`, `snap/`, `snapcraft.yaml` | Manifiestos de tienda. |
| `graph-harness.html`, `occlusion-zoom-harness.html` | Páginas de prueba manual en navegador. |
| `bench_mobile.mjs`, `bench_simple.mjs` | Benchmarks de arranque. |

---

## 3. Modelo de datos y persistencia

### 3.1 Tipos del dominio (`src/types.ts`)

| Tipo / interfaz | Líneas | Campos y significado |
| :--- | :--- | :--- |
| `BlockNode` | 3–10 | `id` (`b-…`), `type: "text"\|"image"`, `content`, `imageAlt?`, `children: BlockNode[]`, `collapsed?`. Unidad atómica del outliner. |
| `PageRevision` | 12–19 | `id`, `timestamp`, `blocks`, `summary`, `createdAt?` (ms UTC). Versión guardada por el usuario. |
| `SnapshotState` | 21–38 | `notePath`, `enabled`, `activatedAt`, `expiresAt`, `durationDays`, `intervalHours`, `maxPerDay`, `lastRunAt`, `nextRunAt`, `remainingMs`, `expired`, `clockAnomaly`, `lastStatus`, `storageFolder`, `maxDays`, `snapshotCount`. Estado del autosnapshot. |
| `SnapshotActiveNote` | 40–51 | Resumen de nota con snapshots activos (para el gestor). |
| `RestoredSnapshot` | 53–56 | `blocks` + `frontmatter` de una versión restaurada. |
| `PageData` | 58–82 | `id`, `title`, `path`, `blocks`, `frontmatter?`, `isJournal?`, `journalDate?`, `updatedAt?`, `updatedAtMs?`, `createdAtMs?`, `revisions?`, `pinned?`, `pinnedAt?`, `blocksLoaded?`, `blockCount?`. `blocksLoaded=false` ⇒ carga metadata-only, se rehidrata vía `read_pages_cached`. |
| `Backlink` | 84–89 | `source_page`, `source_path`, `line_number`, `snippet`. |
| `VaultCacheDelta` | 96–101 | `rootPath`, `changed: PageData[]`, `removed: string[]`, `revision`. Emitido por el watcher Rust. |
| `CursorState` | 103–106 | `blockId`, `offset`. |
| `FlashcardType` | 108 | `"basic" \| "cloze" \| "image-occlusion"`. |
| `Flashcard` | 110–131 | `id`, `pageTitle`, `blockId`, `cardType`, `question`, `answer`, `fsrs: FSRSItem`, `lastIntervalDays`, `easeFactor`, `createdAt?`, `dueDate?`, `imageSource?`, `imageOcclusion?`, `imageOcclusions?`, `parentContent?`, `searchText?`, `fingerprint?`. `fingerprint` identifica la tarjeta aunque cambie el `b-N`. |
| `ImageOcclusionRegion` | 133–144 | `source`, `x`, `y`, `width`, `height` (fracciones 0..1), `shape?: rect\|ellipse\|polygon`, `points?`, `rotation?`, `color?: #rrggbb`, `hint?`. |
| `KanbanStatus` / `KanbanTask` | 146–159 | `todo\|doing\|done`; `id`, `pageTitle`, `blockId`, `text`, `content`, `status`, `dueDate?`, `doingStartedAt?`, `completedAt?`, `doingDurationSeconds?`. |
| `TypographyType` | 161 | `sans\|serif\|mono\|dyslexic\|custom\|system`. |
| `ViewType` | 163 | `editor\|journals\|flashcards\|graph\|kanban\|all-pages\|bibliography\|pdf`. |
| `PdfListItem` | 166–179 | `relativePath` (o `link:<uuid>`), `title`, `fileSize`, `modified`, `linked`, `missing`, `expiresAt?`. |
| `PdfPageInfo` / `PdfDocumentInfo` | 181–199 | Índice, dimensiones en puntos, etiqueta; documento con `pageCount`, `pages`, `linked`, `expiresAt`. |
| `PdfTextRun` / `PdfTextPage` | 202–214 | Fragmento de texto en coordenadas normalizadas (0..1) para la capa transparente sobre la página. |
| `GraphNode` / `GraphLink` | 216–233 | Nodo con `x,y,vx,vy,radius,isJournal,connectionsCount,baseColor?,computedColor?`; enlace `source`→`target`. |

Los tipos FSRS (`FSRSItem`, `FSRSParameters`, `FSRSRating`, `CardState`) viven en `src/editor/fsrs.ts:23-49` y se importan en `types.ts:1`.

### 3.2 Claves de `localStorage`

> Fuente:grep sobre `getItem`/`setItem` en `src/`. La definición de cada constante está en el archivo indicado.

| Clave | Definición | Contenido |
| :--- | :--- | :--- |
| `sinnotas-vault-v4` | `store/vault.ts:250` | Páginas en modo web (sin backend Rust). |
| `sinnotas-revisions-v1` | `store/vault.ts:251` | Revisiones en modo web. |
| `sinnotas-revisions-migrated-v1` | `store/vault.ts:252` | Flag de migración de `chronos/`. |
| `sinnotas-active-vault-root` / `-name` | `store/vault.ts:253-254` | Bóveda activa. |
| `sinnotas-metadata-boot` | `store/vault.ts:256` | Arranque metadata-only. |
| `sinnotas-recent-pages:<vaultPathKey>` | `desktop.ts:15107-15108` | Rutas recientes de la sidebar (consumidas por `sidebar-selection.ts`). |
| `sinnotas-vault-registry-v1` | `desktop.ts:285` | Registro de bóvedas conocidas. |
| `sinnotas-review-progress-v1` | `store/review-progress.ts:61` | Progreso de repaso en modo web. |
| `sinnotas-review-device-id` | `store/review-progress.ts:62` | ID de dispositivo. |
| `sinnotas-fsrs-settings` | `editor/fsrs-settings.ts:4` | Parámetros FSRS globales (mazo «Todos»). Los usan `desktop.ts flashcardFSRSDefaultSettings` y `mobile/review-app.ts globalFSRSSettings` al repasar sin mazo. |
| `sinnotas-flashcard-decks-v1:<vaultKey>` | `store/flashcard-deck-storage.ts:20,28` | Archivo de mazos en modo web, **por bóveda**. |
| `sinnotas-flashcard-active-deck-v1:<vaultKey>` | `store/flashcard-deck-storage.ts:21,32` | Mazo activo, **por bóveda y dispositivo**. |
| `sinnotas-flashcard-pages` | `desktop.ts` / `mobile/review-app.ts:131` | Filtro legacy de páginas en el explorador. |
| `sinnotas-flashcard-sort` / `-explorer-sort` | `desktop.ts:461`, `11925` | Orden del explorador. |
| `sinnotas-flashcard-progress` | `desktop.ts:670` | Estadísticas y puntos de progreso. |
| `sinnotas-flashcard-productivity-panel-hidden` | `desktop.ts:839` | Visibilidad del panel de productividad. |
| `sinnotas-flashcard-settings-section` | `desktop.ts:1840` | Última subsección abierta en Ajustes. |
| `sinnotas-flashcard-review-order` | `desktop.ts` | Orden de repaso. |
| `sinnotas-flashcard-key-again\|hard\|good\|easy` | `desktop.ts` | Teclas de calificación configuradas. |
| `sinnotas-flashcard-heatmap-settings` | `desktop.ts:671` | Ajustes del heatmap de repaso (fecha de inicio, estilo). |
| `sinnotas-graph-settings` | `views/graph-settings.ts:4` | Física, tamaños, colores del grafo. |
| `sinnotas-graph-node-colors` | `desktop.ts` | Colores personalizados de nodos. |
| `sinnotas-last-view` / `sinnotas-last-page-id` | `desktop.ts:4547-4548` | Última vista y nota abierta. |
| `sinnotas-recent-pages` | `desktop.ts:15107` (prefijo por bóveda) | Notas recientes. |
| `sinnotas-all-pages-sort` / `-widths` | `desktop.ts:14694+` | Orden y ancho (proporcional) de columnas de "Todas las páginas"; `applyAllPagesColumnWidths` ajusta siempre al ancho visible para evitar recortes a la derecha. |
| `sinnotas-split-view`, `sinnotas-split-reference-page(s)`, `sinnotas-split-open` | `desktop.ts:16070-16073` | Vista dividida y notas de referencia. |
| `sinnotas-pdf-editor-split` / `-ratio` | `desktop.ts:4756`, `4770` | Panel PDF+editor y proporción del separador. |
| `sinnotas-pdf-retention` | `views/pdf-view.ts:15` | Conservación por defecto de enlaces PDF. |
| `sinnotas-theme`, `sinnotas-accent`, `sinnotas-visual` | `desktop.ts` / `mobile/review-app.ts:129-130` | Tema claro/oscuro, acento, estilo visual. |
| `sinnotas-font`, `sinnotas-system-font`, `sinnotas-font-defaults-version` | `desktop.ts`, `typography.ts:160` | Tipografía y escalas. |
| `sinnotas-language` | `i18n.ts` | Preferencia `auto\|es\|en\|zh`. |
| `sinnotas-sidebar-width` / `-collapsed` | `desktop.ts` | Estado de la barra lateral. |
| `sinnotas-page-width` | `desktop.ts` | Ancho del "box" de Editor/Diarios/Todas las páginas como **porcentaje** (50–100, defecto 100). Antes guardaba píxeles; `migrateLegacyPageWidth()` convierte el valor antiguo. |
| `sinnotas-settings-tab` | `desktop.ts` | Última pestaña de ajustes. |
| `sinnotas-kanban-hide-completed` | `desktop.ts` | Ocultar tareas completadas. |
| `sinnotas-pomodoro-*` (`focus`, `break`, `long-break`, `sessions`, `sound`, `count-up`, `headbar`) | `desktop.ts` | Configuración y estado del Pomodoro. |
| `sinnotas-gamepad-enabled`, `sinnotas-gamepad-controller-type`, `sinnotas-gamepad-*` | `desktop.ts`, `gamepad.ts` | Gamepad y mapeo de botones. |
| `sinnotas-review-mode`, `sinnotas-mobile-full-mode` | `app-mode.ts:25-26` | Superficie elegida en móvil. |
| `sinnotas-learning-mode` | `mobile/review-app.ts:132` | Modo Aprendizaje (no modifica FSRS). |

### 3.3 Archivos dentro de la bóveda

| Ruta | Quién la escribe | Contenido |
| :--- | :--- | :--- |
| `*.md` | `lib.rs:4329 save_page` | Notas con frontmatter `clave:: valor` y bullets. |
| `.sinnotas/chronos/` | `lib.rs:4549+` | Snapshots automáticos de notas activas (máx. 30 días). |
| `.sinnotas/progress/reviews.json` | `lib.rs:4475` | Diario de repasos (≤4.000 entradas, 5 MB, 365 días). |
| `.sinnotas/documents/links.json` | `pdf/storage.rs` | Registro de PDFs enlazados y su caducidad. |
| `.sinnotas_cache.bin` | `metadata_cache.rs` | Caché binaria de metadatos para arranque rápido. |
| `assets/` | `lib.rs:5073 save_image` | Imágenes insertadas. |
| `assets/pdfs/` | `lib.rs:4995 pdf_import` | PDFs importados al vault. |
| `assets/pdf-captures/` | `lib.rs:5054 pdf_save_capture` | Capturas de páginas. |
| `.sinnotas/flashcard-decks.json` (o equivalente) | `lib.rs:4508` | Mazos personalizados. |

> Las carpetas legacy `chronos/` y `progress/` se migran automáticamente al cargar la bóveda (`docs/SinNotas.md:29-35`).

---

## 4. `src/editor/` — el núcleo del editor

> 25 archivos, 4.818 líneas. Es el área más interconnected del proyecto: `tree-engine.ts` exporta 26 símbolos que consume `desktop.ts`; `fsrs.ts` y `markdown.ts` son la base de flashcards y de toda representación visual.

### 4.1 `fsrs.ts` (394 líneas) — planificador FSRS-7

| Símbolo | Línea | Qué hace |
| :--- | ---: | :--- |
| `type FSRSRating` | 23 | `1` Again, `2` Hard, `3` Good, `4` Easy. |
| `type CardState` | 24 | `0` New, `1` Learning, `2` Review, `3` Relearning. |
| `const DAY_MS` | 26 | `86_400_000`. |
| `interface FSRSItem` | 28 | `stability`, `difficulty`, `stabilityFast?` (doble traza), `reps`, `lapses`, `state`, `lastReviewDate?`, `learningStep?`. |
| `interface FSRSParameters` | 40 | `w[34]`, `requestRetention`, `maximumInterval`, `learningSteps`, `relearningSteps`. |
| `FSRS7_WEIGHT_COUNT` | 52 | `34`. |
| `defaultFSRSParams` | 60 | Pesos oficiales, retención 0.9, máximo 36.500 días, pasos `[1/1440, 10/1440]` y `[10/1440]`. |
| `computeDueDate()` | 86 | ISO de vencimiento. |
| `class FSRSEngine` | 110 | Motor completo. |

**Métodos de `FSRSEngine`:** `constructor` (114, normaliza pasos/pesos/retención [0.7,0.97]/intervalo≥1), `version = "FSRS-7"` (163), `getParameters()` (166), `memoryState()` (171, S inválida→0.01, D inválida→5, SF inválida→S·0.8), `initStability()` (184), `initDifficulty()` (189), `retrievability()` (194–208), `nextInterval()` (215–233, conserva fracciones <1 día y acota al máximo), `formatInterval()` (239: `s/m/h/d/mo/y`, evita "1mo" para 44 días), `stepsForState()` (256), `learningTransition()` (268: Again→paso 0, Easy→gradúa, Hard→promedio de los dos primeros pasos solo en el primero, Good→siguiente), `previewRatings()` (312: calcula los 4 ratings y sus intervalos).

**Origen:** port de `fsrs-rs/src/model_v7.rs` vía `ts-fsrs/models/fsrs-7` (`FSRS7Algorithm`, `FSRS7_DEFAULT_WEIGHTS`, `FSRS7_MODEL_BOUNDS`, `clipFSRS7Parameters`). Ver `docs/CHECKLIST-CONSOLIDADO.md` §B1 y `THIRD_PARTY_LICENSES.md`.

**Consumidores:** `types.ts:1`, `desktop.ts:165`, `mobile/review-app.ts:4,11`, `store/review-progress.ts:2`, `store/flashcard-decks.ts:3`, `store/flashcard-deck-storage.ts:18`, `views/flashcard-maintenance.ts:2`, `views/flashcards-manager.ts:2–9`.

**Tests:** `fsrs.test.ts` (434 líneas) — vectores oficiales de `fsrs-rs` para los 4 ratings en estado nuevo y Review(S=10,SF=8,D=5), learning steps, Hard con 3 pasos, relearning vacío, intervalos fraccionarios, `formatInterval`, vencimientos a medianoche local.

### 4.2 `fsrs-settings.ts` (111 líneas) — configuración persistida

- `FSRS_SETTINGS_KEY = "sinnotas-fsrs-settings"` (L4).
- `normalizeFSRSParameters()` (L31): 34 pesos válidos → `clipFSRS7Parameters`; retención [0.7,0.97]; intervalo [1,36500]; pasos crecientes <1 día.
- `parseLearningSteps()` (L55): `"1m 10m 2h"` → `[1/1440, 10/1440, 1/12]`; rechaza `1d` (dejaría la tarjeta "aprendiendo" días), duplicados y desordenados.
- `parseMaximumInterval()` (L81): `12.7` → 13, vacío → default, `0` → 1, `999999` → 36500.
- `formatLearningSteps()` (L89), `loadFSRSParameters()` (L99), `saveFSRSParameters()` (L108).
- Copias profundas: mutar lo normalizado no altera `defaultFSRSParams`.
- Test: `fsrs-settings.test.ts` (103).

### 4.3 `history.ts` (209 líneas) — undo/redo

- `DocumentHistory` (L71) con mapas `undoStacks`, `redoStacks`, `lastStates`, `lastPushAt`.
- `MAX_ENTRIES_PER_PAGE = 60` (L18), `COALESCE_WINDOW_MS = 1200` (L20).
- `capture()` (L92) se llama desde `VaultStore.onBeforeSave`; abre un paso nuevo solo si cambia `structureKey` o pasaron 1.200 ms; descarta la rama de redo al abrir paso.
- `structureKeyOf()` (L23): firma `depth:id:type`; `treesEqual()` (L41) evita `JSON.stringify` de la nota completa en cada pulsación.
- `undo()` (L138), `redo()` (L154), `markApplied()` (L172), `seed()` (L181, fija la línea base al abrir nota), `clearPage()` (L187), `clearAll()` (L194).
- No tiene test directo: se ejerce desde `desktop.ts` y `mobile/review-app.ts`.

### 4.4 `tree-engine.ts` (652 líneas) — motor del outliner

Todas las operaciones son **inmutables** (clonan antes de modificar) e **iterativas** con `MAX_TREE_DEPTH = 64` (L3) para evitar stack overflow.

| Función | Línea | Comportamiento |
| :--- | ---: | :--- |
| `generateId()` | 5 | `"b-" + Math.random().toString(36).substring(2,9)`. |
| `cloneTree()` | 9 | Clon profundo por stack, hijos en orden inverso. |
| `findNodeLocation()` | 52 | Devuelve `{parentList, index, parentNode}`. |
| `getFlatVisibleBlocks()` | 86 | Aplana respetando `collapsed`. |
| `getAllBlocksFlat()` | 113 | Aplana **todo**, incluidos colapsados. |
| `getSelectedBlockRoots()` | 138 | Raíces de la selección (excluye descendientes de seleccionados). |
| `removeBlocks()` | 169 | Borra selección múltiple recorriendo de atrás hacia adelante; garantiza un bloque vacío. |
| `insertBlockAfter()` | 207 | Si hay hijos expandidos, `unshift` como primer hijo; si no, hermano siguiente. |
| `insertBlocksAfter()` | 234 | Inserta varios bloques clonados. |
| `splitBlock()` | 248 | Divide en el cursor; caso especial "Enter al inicio con subbullets" (L273–282). |
| `insertImageBlockAfter()` | 292 | Inserta bloque `type:"image"`. |
| `indentBlock()` / `outdentBlock()` | 315 / 332 | Tab / Shift+Tab. |
| `enterAtEnd()` | 364 | Secuencia Logseq: 1.º Enter crea hijo/hermano, 2.º desindenta si está vacío, 3.º crea hermano. |
| `indentBlocks()` / `outdentBlocks()` | 397 / 417 | Multiple; outdent en orden inverso para preservar hermanos. |
| `moveBlockTo()` | 433 | `before\|after\|inside`; prohíbe mover un nodo dentro de sus descendientes. |
| `deleteOrMergeBlock()` | 465 | Backspace: fusiona con el anterior o borra; devuelve `{newTree, targetFocusId, cursorOffset}`. |
| `moveBlockUp()` / `moveBlockDown()` | 511 / 524 | Intercambia con hermano. |
| `removeBlock()` | 537 | Borra uno. |
| `toggleTaskStatus()` | 556 | TODO/LATER → DOING → DONE → sin prefijo → TODO. |
| `applyFormatting()` / `clearFormatting()` | 571 / 606 | Envuelta o limpieza de Markdown sobre selección o todo. |
| `toggleCollapse()` | 644 | Invierte `collapsed`. |

**Tests:** `tree-engine.test.ts` (173) cubre `removeBlocks`, `enterAtEnd` y `splitBlock`; el resto se ejerce desde los entry points.

### 4.5 `markdown.ts` (407 líneas) — render seguro

- `MARKDOWN_SANITIZE_CONFIG` (L14–89): whitelist estricta de etiquetas (incluye MathML) y atributos; `FORBID_TAGS` incluye `script, style, iframe, object, embed, link, meta, svg, foreignobject, path, use`; `FORBID_ATTR` incluye todos los `on*`; `ALLOW_UNKNOWN_PROTOCOLS: false`.
- `katexSafeStyleProperties` (L98–116): solo propiedades CSS necesarias por KaTeX, con valores `em|ex|px` o `position: relative`.
- Hook `uponSanitizeAttribute` (L134–140) reescribe `style` con `sanitizeStyleAttributeValue()` (L121).
- `systemPropertyPattern` (L142–143): `card-*`, `last-reviewed`, `interval-days`, `ease-factor`, `due-date`, `created-at`, `image-occlusions`, `pdf-source`, `task-due`, `completion-rewarded`, `doing-started-at`, `done-at`, `doing-duration-seconds`, `heading`, `color`, `background-color`. `stripSystemProperties()` (L158) los oculta al renderizar.
- `renderInline()` (L165–288): **10 patrones separados** (no un regex gigante) con captura máxima de 500 chars para evitar ReDoS. Soporta código, wikilinks `[[target|label]]`, cloze `{{c1::...}}`, negrita, cursiva, tachado, resaltado `==`, subrayado `<u>` y math `$...$`.
- `renderBlockContent()` (L316–386): tope 50.000 chars; cercados `` ``` ``/`~~~` con lenguaje, math display `$$...$$` anclado a líneas, tablas GFM vía `findMarkdownTableRanges()`.
- `sanitizeHtml()` (L396): DOMPurify (no-op sin `window`, para tests Node).
- `renderMarkdownToHtml()` (L401): normaliza CRLF → render → sanea.
- **Tests:** `markdown.test.ts` (184) — math, código, tablas, seguridad (`<img onerror>`), estilos KaTeX, y 5 pruebas de ReDoS con 10.000 repeticiones.

### 4.6 `markdown-table.ts` (325 líneas) — tablas GFM

Modelo puro (sin DOM): `MarkdownTableModel` (L11) = `header`, `alignments`, `rows`; `MarkdownTableRange` (L17) = `index`, `length`, `model`.
- `splitTableRow()` (L51) respeta `\|` escapados; `isTableSeparatorLine()` (L41); `escapeTableCell()` (L77); `serializeMarkdownTable()` (L110).
- `findMarkdownTableRanges()` (L125) localiza tablas ignorando cercados de código mediante un autómata.
- `TableEditAction` (L25): 10 acciones (añadir/borrar fila o columna, mover fila arriba/abajo, columna izquierda/derecha).
- `applyTableEdit()` (L216, `rowIndex` lógico: 0=encabezado), `editMarkdownTable()` (L311).
- `editMarkdownTableCell()` (L331): aplica un `update` solo a una celda `(tableIndex, rowIndex, colIndex)`
  y conserva el resto del Markdown. Lo usan en `desktop.ts` los helpers `selectedTableCellInfo()`,
  `focusTableCell()`, `updateSelectedTableCell()` y `formatSelectedTableCell()` para aplicar negrita,
  cursiva, subrayado, tachado, código, cloze o limpiar formato **a la celda seleccionada** sin afectar
  a toda la tabla; el menú contextual de tabla incluye esas acciones `fmt:*`.
- Test: `markdown-table.test.ts` (incluye `editMarkdownTableCell`).

### 4.7 `paste-sanitizer.ts` (297 líneas) — pegado seguro

- Límites: HTML 300.000 chars (L27), Markdown 50.000 (L28).
- `DROP_TAGS` (L47–53): script, style, multimedia, formularios e `img/picture` (las imágenes van por otro flujo auditado).
- `INLINE_WRAPS` (L63–73): B/STRONG→`**`, I/EM→`*`, U→`<u>`, S/DEL/STRIKE→`~~`, CODE→backticks.
- `elementToLines()` (L131): UL/OL con indentación de 2 espacios, TABLE a filas de pipes, BLOCKQUOTE con `> `.
- `finalize()` (L244): colapsa ≥3 saltos, recorta extremos, trunca a 50.000.
- `sanitizeHtmlString()` (L269): **DOMPurify es la única ruta de saneado**; sin soporte devuelve `""` para que se use `text/plain`.
- `sanitizeDomNodeTree()` (L260) es puro y testeable; `sanitizePastedHtmlToMarkdown()` (L287) es el entry point de navegador.
- Test: `paste-sanitizer.test.ts` (108).

### 4.8 Seguridad y utilidades

| Archivo | Símbolos clave (línea) | Detalle |
| :--- | :--- | :--- |
| `url-safety.ts` (170) | `isPrivateOrLocalHostname()` (84), `isAllowedRemoteImageUrl()` (126), `isRemoteImageSource()` (142), `resolveAllowedRemoteImageUrl()` (151) | Anti-SSRF: solo `http(s)` a hosts públicos; bloquea `localhost`, `*.local`, `*.internal`, IPv4 privadas (0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16), IPv6 link-local/Única-local/mapeada y formas numéricas de IPv4. `data:image`/`blob:` pasan sin petición. Test: `url-safety.test.ts` (198). |
| `image-occlusion.ts` (287) | `normalizeImageOcclusionRegion()` (17), `parseImageOcclusions()` (66), `clampImageOcclusionRegion()` (100), `updateImageOcclusionInContent()` (129), `occlusionRegionsMatch()` (177), `appendOcclusionMasks()` (205) | Lee regiones **solo** de `image-occlusions::`; colores `#rrggbb`; `hint` ≤200 chars; SVG generado con `createElementNS` + `setAttribute` desde números validados; `fill=true` añade `width/height=100%` para que siga a la imagen al hacer zoom. Test: `image-occlusion.test.ts` (93). |
| `image-bytes.ts` (49) | `detectRasterImageMime()` (15), `normalizeRasterImageFile()` (36) | Magic bytes PNG/JPEG/GIF/WebP/BMP; **rechaza SVG** (no hay saneador en modo web). Test: `image-bytes.test.ts` (47). |
| `flashcard-markers.ts` (70) | `splitBlockProperties()` (10), `isFlashcardBlockContent()` (24), `removeFlashcardMarkers()` (36) | Primilla pura compartida por todas las rutas de borrado de flashcards: quita `#card`, cloze, `==…==`, `::` y propiedades FSRS **conservando la indentación de cada línea** (el `trim()` global anterior desplazaba los bullets anidados). Test: `flashcard-markers.test.ts`. |
| `html.ts` (13) | `escapeHtml()` (2) | `& < > " '` → entidades. Sin test directo. |
| `math.ts` (46) | `renderMathToHtml()` (35) | KaTeX con caché de 300 entradas, `trust:false`, `maxSize:500`, `maxExpand:1000`; fallback `<code class="math-error">`. |
| `note-search.ts` (71) | `findFoldedRanges()` (20), `findMatchesInBlocks()` (53) | Plegado de mayúsculas/acentos vía `fold()` de `content-search`; mapeo carácter→offset original; incluye bloques colapsados; tope 5.000 coincidencias. Test: `note-search.test.ts` (49). |
| `note-scroll-nav.ts` (153) | `noteScrollState()` (23), `installNoteScrollNav()` (71) | Umbral 80 px de overflow, tolerancia 8 px en extremos; listener de scroll en **captura** sobre `#view-editor` porque el contenedor que scrollea cambia en vista dividida; respeta `prefers-reduced-motion`. Test: `note-scroll-nav.test.ts` (70). |
| `plain-text-paste.ts` (31) | `insertPlainTextAtSelection()` (1) | Reemplaza selección por un nodo de texto y dispara un evento `input`. Test: `plain-text-paste.test.ts` (45). |

---

## 5. `src/store/` — vault, búsqueda, mazos y progreso

> 15 archivos, 4.808 líneas. Es la capa de estado: mantiene espejos en memoria y delega la persistencia real a Rust mediante `invoke`. La excepción son las preferencias locales (raíz/nombre de vault, mazo activo, device id, flag `metadata-boot`, recientes), que sí viven en `localStorage`.

### 5.1 `vault.ts` (1.355 líneas) — el corazón del estado

**Constantes:** `MAX_LOADED_PAGES = 120` (L258, LRU), `SAVE_DEBOUNCE_MS = 300` (L261), y las claves de la §3.2.

**`initialVaultPages` (L28–248):** vault semilla de 4 notas (`p-welcome`, `p-journals`, `p-rust`, `p-flashcards`) con ejemplos de wikilinks, `#card`, `{{cloze }}`, `==resaltado==`, propiedades `::` y estados TODO/DONE/NOW/LATER.

**`isMetadataOnlyBoot()` (L272):** lee `sinnotas-metadata-boot`; `"off"` → false, cualquier otro valor o error → **true por defecto**. Es el interruptor del arranque rápido (FASE 4).

**`VaultStore` (L348) — estado privado:** `pages` (L349), `activeRootPath` (L350), `activeVaultName` (L351), `pendingFileOperations: Map` (L352), `beforeSaveListener` (L353, usado por `history.ts`), `revisionCache` (L356), `pendingSaves` (L359), `mutationVersion` (L366), `pageVersions` (L369), `ownWriteEpoch` (L372), `loadedPageEpochs`/`pinnedLoadedPaths`/`loadedTick` (L378–381, LRU).

**Métodos públicos (los que importan otros módulos):**

| Método | Línea | Qué hace |
| :--- | ---: | :--- |
| `getMutationVersion()` | 383 | Versión estructural (reemplazo, borrado, renombre, deltas). |
| `getPageVersion(page)` / `capturePageVersions()` / `collectPageChanges(since)` | 392 / 405 / 414 | Epochs por nota para invalidar cachés sin reconstruir todo. |
| `getVersionView()` | 431 | `{getStructural, getPageVersion}`; consumido por `ContentSearchIndex`, `FlashcardLoader`, Kanban y grafo. |
| `constructor()` | 435 | En Tauri usa la semilla y **borra** `sinnotas-vault-v4`; en web parsea la copia local. Normaliza tipos y rutas. |
| `getRevisions(page, force?)` | 475 | Tauri `read_note_snapshots`; web `sinnotas-revisions-v1`. |
| `migrateLegacyRevisions()` | 507 | Migración one-shot de localStorage a `.sinnotas/chronos/` vía `write_page_revisions`. |
| `getPages()` | 565 | Referencia directa al array. |
| `onBeforeSave(listener)` | 570 | Hook invocado antes de persistir (historial de desktop.ts:306). |
| `getPageByTitle()` | 574 | Case-insensitive; también compara con `normalizeDeckTitle` (`::` ≡ `→`). |
| `replaceVault(pages, root, name)` | 620 | Tras `load_vault`: cancela escrituras, cambia páginas/raíz, sube versión, limpia LRU y caché, persiste. |
| `applyExternalDelta(delta, {skipPaths})` | 661 | Aplica cambios del watcher solo si coincide `rootPath`; conserva edición local; fusiona `id`, `pinned`, `revisions`. |
| `setActiveVault()` | 748 | Actualiza raíz/nombre en memoria y localStorage. |
| `pinPage()` / `unpinPage()` | 759 / 764 | Excluyen la nota del sweep LRU. |
| `ensurePageLoaded(page)` | 778 | Si `blocksLoaded===false`, rehidrata vía `loadPagesCached`. |
| `loadPagesCached(pages)` | 794 | `invoke("read_pages_cached", {paths})`, copia bloques y fechas, actualiza LRU. |
| `flushPendingFileOperations()` | 865 | Espera guardados y operaciones de archivo en vuelo. |
| `scheduleSavePage(page)` | 874 | Memoria inmediata + epoch de nota + timer de 300 ms. No-op si `blocksLoaded===false`. |
| `flushPendingSaves()` | 904 | Cancela timers y persiste todo en paralelo. |
| `getOwnWriteEpoch()` | 967 | Distingue escrituras propias de cambios externos. |
| `savePage(page)` | 975 | Estampa `updatedAtMs` y `updatedAt` (16 chars), persiste de inmediato. |
| `deletePage(pageId)` | 988 | Quita de memoria y encola `delete_page`. |
| `renamePage(pageId, newTitle)` | 1011 | Valida, hidrata, cambia título/ruta, reescribe `[[wikilinks]]`, traslada revisiones, encola `rename_page`. |
| `updateBlockContent()` / `appendBlockToPage()` | 1154 / 1175 | Usadas por Kanban; rehidratan si hace falta. |
| `restoreSnapshot(page, revisionId)` | 1210 | Tauri `restore_snapshot`; actualiza bloques/frontmatter en memoria. |
| `createPage()` / `createJournal()` | 1244 / 1274 | `pages/<Título>.md` / `journals/AAAA_MM_DD.md`. |

**Helpers privados destacados:** `normalizeBlockTypes()` (L11, detecta imágenes por regex `!\[...\]\(...\)` y extensión), `toRelativeNotePath()` (L591), `safeSetItem()` (L329, avisa con `CustomEvent("vault-operation-error")` si se llena la cuota), `sweepUnpinnedPages()` (L839, LRU), `persistPage()` (L937, encola `save_page`), `enqueueFileOperation()` (L1323, serializa por ruta), `rewriteRenameLinks()` (L1086, usa `find_backlinks` en modo metadata-only y rehidrata candidatos).

> **Hueco de cobertura:** `vault.ts` tiene un único test propio (`vault-replace.test.ts`, 80 líneas) que cubre solo `replaceVault`. Guardado, debounce, LRU, deltas, renombres y snapshots se ejercen solo de forma indirecta.

### 5.2 `content-search.ts` (313 líneas) — omnibar

- `fold(s)` (L65): `toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"")`; puede cambiar la longitud.
- `locateMatch(text, query, foldedIndex, foldedLength)` (L76): mapa plegado→original carácter a carácter; elige la coincidencia más cercana al índice; devuelve `{start,end}`. Usado para saltar el cursor al texto real.
- `ContentSearchIndex` (L148): `update(pages, version|versionView)` (L158) → `updateIncremental()` (L177). Si cambia `getStructural` o la vista, reconstruye todo; si no, reindexa solo las notas con epoch distinto. Comentario L140: con 14.000 notas, reconstruir por tecla congelaba la UI.
- `search(query, limit=25)` (L221): tokeniza con AND (todos los tokens en el mismo bloque), suma apariciones (tope 20/token), guarda el mejor bloque por nota, ordena por `count` y limita.
- `buildSnippet(text, index, matchLength)` (L295): `{before(40), match, after(80)}`, elipsis y colapso de espacios; se pinta con `textContent` + `<mark>`, nunca HTML.
- `collectTextBlocks()` (L32) ignora imágenes pero recorre sus hijos; `visibleBlockText()` (L52) quita líneas `clave:: valor`.
- Consumidores: `desktop.ts:98-106` (omnibar), `editor/note-search.ts:3`, `views/all-pages.ts:2`.

### 5.3 `flashcard-decks.ts` (578 líneas) + `flashcard-deck-storage.ts` (225)

**Modelo puro:** `FLASHCARD_DECKS_FILE = ".sinnotas/flashcards/decks.json"` (L17), versión 1, ≤1 MB, ≤200 mazos, ≤10.000 títulos por mazo, nombre ≤80 chars, 500 lápidas, id legacy `legacy-selection`.

- `FlashcardDeck` (L25): `id`, `name`, `pageTitles`, `fsrs?: FSRSParameters` (**por mazo**, no compartido), `createdAt`, `updatedAt`. `FlashcardDeckFile` (L45): `version`, `decks`, `tombstones`.
- `normalizeFlashcardDeckName()` (L83), `flashcardDeckNameKey()` (L98, NFKD + sin diacríticos + locale `es`), `generateFlashcardDeckId()` (L105), `validateFlashcardDeckName()` (L160), `uniqueFlashcardDeckName()` (L135).
- CRUD: `addFlashcardDeck()` (L212), `updateFlashcardDeck()` (L245), `deleteFlashcardDeck()` (L277, añade lápida; las notas no se tocan).
- Resolución: `resolveFlashcardDeckPageTitles()` (L304, descarta inexistentes y resuelve `::`→`→`), `mergeFlashcardDeckSelection()` (L350, conserva notas sin tarjetas).
- Sincronización: `parseFlashcardDeckFile()` (L458, valida sin lanzar), `serializeFlashcardDeckFile()` (L496), `mergeFlashcardDeckFiles()` (L521, gana `updatedAt` más reciente; lápida gana), `migrateLegacyFlashcardSelection()` (L559).
- `FlashcardDeckRepository` (`flashcard-deck-storage.ts:95`): `load()` (L96), `save()` (L126, **relee y fusiona siempre** antes de escribir), `getActiveDeckId()` (L155), `setActiveDeckId()` (L160), `resolveActiveDeckId()` (L167), `saveDeckSettings()` (L182), `loadWithMigration()` (L199). Claves por bóveda (`normalizedVaultKey`, L23).

### 5.4 `review-progress.ts` (524 líneas) — diario de repasos

- Vive en `.sinnotas/progress/reviews.json` (nunca en localStorage salvo demo web). No contiene texto de tarjetas, solo identidad estable + valoración + snapshots FSRS antes/después.
- `ReviewProgressEvent` (L18): `id`, `at`, `date` (`YYYY-MM-DD`), `deviceId`, `updatedAt`, `state: applied|undone`, `pagePath`, `pageTitle`, `blockId`, `cardId`, `cardType`, `cardFingerprint?`, `rating: 1..4`, `before`, `after`.
- Límites: `MAX_ENTRIES = 4000` (L63), `MAX_FILE_BYTES = 4.5 MB` (L65), `MAX_AGE_DAYS = 365` (L67).
- `parseReviewProgress()` (L250, nunca lanza; dedupe por id quedándose con mayor `updatedAt`), `mergeReviewProgress()` (L275).
- `ReviewProgressStore` (L306): `load()` (L314, single-flight), `clear()` (L378), `record()` (L390), `takeUndo()`/`commitUndo()`/`restoreUndo()` (L422/438/442), `takeRedo()`/`commitRedo()`/`restoreRedo()` (L450/465/469), `canUndo()`/`canRedo()` (L477/481), `getStats(today)` (L490), `getEntries()` (L501).
- `rebuildStacks()` (L360): solo repasos **de este dispositivo**; undo = últimos 100 `applied`, redo = `undone` posteriores al último applied. `sanitizeSnapshot()` (L130) conserva `stabilityFast` aunque sea negativo (FSRS-7 válido).
- `persist()` (L505) → `write_review_progress`; la respuesta del backend se re-parsea y fusiona en memoria.

### 5.5 Resto del store

| Archivo | Símbolo principal | Detalle |
| :--- | :--- | :--- |
| `export.ts` (258) | `serializePageAsPlainText()` (L59), `exportVaultAsMarkdownZip()` (L162), `exportVaultAsMarkdown()` (L176), `exportVaultAsJson()` (L189), `exportVaultAsCsv()` (L202), `printVaultAsPdf()` (L234) | ZIP implementado a mano: CRC32 (L87), local headers, central directory y end record (L106–160). Solo `serializePageAsPlainText` tiene consumidor real (`desktop.ts:114,4354`); el resto es API latente. |
| `sidebar-selection.ts` (40) | `selectSidebarPages()` (L12) | `pinned` ordenados por `pinnedAt` ascendente; `recent` por `recentPaths`, sin fijadas, sin duplicados, sin huérfanas. |
| `wikilinks.ts` (53) | `WikiLinkRef` (L5), `collectOutgoingLinks()` (L28) | Extrae `[[Destino\|Alias]]`; dedupe por destino, omite auto-enlaces, ignora código, conserva destinos rotos. La reescritura en renombres **no** usa este módulo (vault.ts hace su propia regex en L1055). |

### 5.6 Mapa rápido del store

| Concepto | Ubicación |
| :--- | :--- |
| Semilla del vault | `store/vault.ts:28-248` |
| Arranque metadata-only | `store/vault.ts:256,272` |
| Guardado con debounce | `store/vault.ts:261,874,904` |
| Cola de operaciones de archivo | `store/vault.ts:1323` |
| Renombrado + wikilinks + revisiones | `store/vault.ts:1011,1086` |
| LRU de bloques (FASE 4) | `store/vault.ts:378-381,759-863` |
| Versionado para cachés | `store/vault.ts:313-433` |
| Hook antes de guardar (undo) | `store/vault.ts:570` |
| Búsqueda incremental por epochs | `store/content-search.ts:158,177` |
| Mapeo acento → offset original | `store/content-search.ts:76` |
| Snippet con `<mark>` | `store/content-search.ts:295` |
| ZIP sin librerías | `store/export.ts:87-160` |
| Modelo `decks.json` | `store/flashcard-decks.ts:17,25,45` |
| Fusión de mazos entre dispositivos | `store/flashcard-decks.ts:521` |
| Mazo activo por bóveda | `store/flashcard-deck-storage.ts:21,155-176` |
| Diario de repasos / undo por dispositivo | `store/review-progress.ts:18,43,360,422-475` |
| Fijadas y recientes | `store/sidebar-selection.ts:12` |
| Wikilinks salientes | `store/wikilinks.ts:28` |

---

## 6. `src/views/` — vistas y motores de UI

> 34 archivos, 12.278 líneas (19 módulos + 15 tests). La mayoría son **lógica pura o managers**; el render final de cada vista está en `desktop.ts`. Cuatro vistas pesadas (`bibliography-view`, `concept-map-view`, `graph-view`, `pdf-view`) no tienen test propio: se cubren vía sus módulos de lógica.

### 6.1 Flashcards

| Módulo | Líneas | Símbolos clave (línea) | Qué hace |
| :--- | ---: | :--- | :--- |
| `flashcards-manager.ts` | 1.317 | `FlashcardsManager` (166), `scanPages()` (973), `rate()` (1269), `getRatingPreviews()` (1248), `getCardStatsByPage()` (251), `sumCardStats()` (267), `recalculateDueDate()` (383), `rescheduleFSRS()` (403), `migrateLegacyFSRS()` (473), `clearFSRSProgress()` (577), `readScheduleSnapshot()` (640), `applyScheduleSnapshot()` (688), `cardFingerprint()` (744), `updateBlockFSRS()` (791), `readEditableFields()` (830), `applyCardEdit()` (857), `refreshCard()` (886), `updateCardInSession()` (945), `setDetectedCards()` (1113), `refreshDueQueue()` (1158), `restart()` (1313) | **Motor central**. Detecta los 3 tipos de tarjeta: oclusión (`fc-image-…`, una por región), cloze (`{{c1::…}}` / `==…==`) y básica (`::` o `#card`). Construye la cola con `new-first`/`reviews-first`/`mixed` (Fisher-Yates), filtra por notas y por `isDue`, calcula los 4 intervalos FSRS y serializa el estado en propiedades Markdown (`card-s`, `card-d`, `card-s-fast`, `card-reps`, `card-lapses`, `last-reviewed`, `interval-days`, `ease-factor`, `due-date`, `card-state`, `card-learn-step`). Los hijos del bullet se convierten en `<ul class="flashcard-answer-list">` (HTML real para conservar jerarquía). `cardFingerprint()` es FNV-1a de 32 bits sobre `cardType\|texto plegado`, estable aunque cambie el `b-N`. Modo Aprendizaje: `rate(..., persist=false)`. |
| `flashcard-loader.ts` | 403 | `FlashcardLoader` (88), `load()` (193), `processChunk()` (284), `finish()` (344), `evaluateCache()` (106) | Escaneo **streaming** por lotes adaptativos (16→64, objetivo 14 ms, mitad si >28 ms) con caché incremental por `VaultVersionView`. Hidrata notas metadata-only antes de escanear. `setDetectedCards` se llama **una sola vez** al terminar para que `mixed` no se rebaraje a mitad. |
| `flashcard-maintenance.ts` | 253 | `runFlashcardMaintenance()` (176), `groupCardsByBlock()` (100), `applyAction()` (144), `DEFAULT_BATCH_SIZE = 40` (65) | 4 acciones (`due-dates`, `reschedule`, `convert` FSRS-4.5→7, `reset`). Agrupa por `page.id\0block.id` para escribir una sola vez cada bloque aunque produzca varias tarjetas; comprueba `signal.aborted` antes y dentro de cada lote; cede el hilo con rAF. |
| `flashcard-decks.ts` | 281 | `buildDeckTree()` (75), `searchDeckTree()` (203), `flattenDeckRows()` (262), `getDeckSelectionState()` (168), `collectDeckPageTitles()` (156), `sortDeckTree()` (144) | **Árbol de mazos jerárquico** derivado de los títulos (`Salud mental → Ansiedad → Tema 1`), con selección tri-state y paginación por raíces visibles. Ojo: es distinto de `store/flashcard-decks.ts` (el modelo `decks.json`). |
| `review-heatmap.ts` | 98 | `buildReviewHeatmap()` (41), `defaultHeatmapStart()` (95), `levelFor()` (27) | Semanas × 7 días, niveles 0–4 (`0→0, 1→1, 2-3→2, 4-6→3, ≥7→4`), máximo 365 días, solo eventos `state === "applied"`. |

### 6.2 Grafo y mapa conceptual

| Módulo | Líneas | Símbolos clave | Qué hace |
| :--- | ---: | :--- | :--- |
| `graph-physics.ts` | 539 | `DEFAULT_PHYSICS_CONFIG` (36), `physicsStep()` (286), `applyCollisionForce()` (210), `applyBarnesHutForce()` (158), `shouldStopSimulation()` (431), `computeRevealOrder()` (440), `computeInitialPosition()` (502) | Motor de fuerzas: repulsión (Barnes-Hut `O(n log n)` con theta 0,8 por encima de 200 nodos; `O(n²)` por debajo), colisión por **rejilla espacial** (3×3 celdas, evitó 4–10 FPS con 1.500 nodos), resortes de Hooke, atracción al centro, integración con amortiguación y `alpha` decreciente (`~170 pasos`). `shouldStopSimulation` ya no exige energía residual baja. |
| `graph-settings.ts` | 326 | `GRAPH_SETTINGS_STORAGE_KEY` (4), `loadGraphSettings()` (249), `saveGraphSettings()` (264), `colorForPage()` (290), `toPhysicsConfig()` (313), `migratePerConnectionRadiusV2()` (228) | Persistencia en `sinnotas-graph-settings`, validación, migración v2 del radio por conexión (1.2→0), reglas de color por nombre con coincidencia insensible a acentos. |
| `graph-view.ts` | 1.117 | `GraphView` (55), `updateData()` (242), `frame()` (461), `recomputeColors()` (729), `render()` (820), `setupEvents()` (954), `wakeSimulation()` (436) | Canvas del grafo. Revelado progresivo en lotes de 30 nodos, física a 30 Hz con render bajo demanda, zoom ×1.12, pan con botón medio/derecho, marquee, selección alterna, doble clic para reset. Los colores manuales se propagan por BFS a 4 niveles `[1, 0.5, 0.25, 0.125]`; las reglas por nombre pintan sin teñir. Un solo `beginPath/stroke` para todos los enlaces. Parar física al ocultarse (`IntersectionObserver`) y respetar `prefers-reduced-motion`. |
| `graph-labels.ts` | 19 | `labelAlphaForZoom()` (10) | Fundido de etiquetas: 0 por debajo de `0.75×umbral`, lineal hasta 1 en el umbral. Evita `fillText` por nodo cuando son invisibles. |
| `graph-neighborhood.ts` | 66 | `connectedPageTitles()` (12) | BFS bidireccional hasta profundidad N; usa la adyacencia servida por Rust `graph_links` si llega, o extrae de los bloques; descarta destinos inexistentes. |
| `concept-map-view.ts` | 716 | `ConceptMapView` (87), `setPage()` (173), `buildTree()` (244), `appendNextChildren()` (275), `measure()` (389), `layout()` (448), `render()` (532), `setupEvents()` (629) | Mapa conceptual en canvas del árbol de bullets. Lotes de 80 hijos, máximo 800 nodos y nodo pseudo `isMore`, wrapping de texto, layout por columnas con resolución de solapes, Bézier para enlaces, pan/zoom/doble-clic para centrar, hover con tolerancia de 4 px. Colores leídos de variables CSS `--ls-*`. |

### 6.3 Documentos y bibliografía

| Módulo | Líneas | Símbolos clave | Qué hace |
| :--- | ---: | :--- | :--- |
| `pdf-view.ts` | 965 | `PdfReaderView` (97), `renderLibrary()` (320), `open()` (396), `renderCurrentPage()` (429), `renderTextLayer()` (513), `prepareCapture()` (764), `importPdf()` (844) | Lector PDF. 30 ids del DOM en `index.html:1445-1521`. Render PNG vía `pdf_render_page`, capa de texto con `<span>` en `%` y caché LRU de 32 páginas, selección → insertar/copiar, captura de región con `<canvas>` → PNG → insertar o crear oclusión, retención de enlaces en `localStorage`. Nunca abre un PDF automáticamente al entrar en la vista. |
| `bibliography.ts` | 395 | Constantes `bib-*` (12–23), `bibliographyItemFromPage()` (212), `applyBibliographyPatch()` (269), `linkedBibliographyNotes()` (356), `sanitizeWikilinkTitle()` (329), `filterBibliographyItems()` (368) | Modelo: cada recurso es una nota con frontmatter `biblioteca`, `bib-tipo`, `bib-estado`, `bib-autor`, `bib-anio`, `bib-total`, `bib-actual`, `bib-portada`, `bib-enlace`, `bib-valoracion`; las notas hija usan `bib-nota`/`bib-padre`. |
| `bibliography-lookup.ts` | 315 | `lookupBibliography()` (256), `detectLookupMode()` (174), `normalizeDoi()` (115), `normalizeIsbn()` (158), `isAllowedLookupCoverUrl()` (182), `lookupErrorCode()` (297) | Cliente IPC: el front **nunca** construye URLs, invoca `bibliography_lookup` y sanea la respuesta (defensa en profundidad). 10 códigos de error estables. |
| `bibliography-view.ts` | 1.168 | `BibliographyView` (96), `render()` (256), `openDetail()` (380), `openAddDialog()` (726), `renderLookupResults()` (1030), `openNoteDialog()` (1080) | Toda la UI de bibliografía (tablero, filtros, diálogos, estrellas, portadas). No toca el vault: recibe un `BibliographyHost` con 11 métodos implementados en `desktop.ts:6717`. |

### 6.4 Componentes y otras vistas

| Módulo | Líneas | Qué hace |
| :--- | ---: | :--- |
| `all-pages.ts` | 182 | `filterAllPages()` (80): tokens plegados sobre `título \0 path`; `sortAllPages()` (145): fijadas arriba, `Intl.Collator` numérico, fechas desconocidas al final, desempate estable. `pageUpdatedMs()` (107) y `pageCreatedMs()` (118) prefieren las marcas ms de Rust. |
| `kanban-view.ts` | 302 | `KanbanManager` (6): `scanTasks()` (44) con epochs, `scanTasksForPage()` (152) extrae TODO/LATER→todo, DOING/NOW→doing, DONE→done y los metadatos `task-due::`, `doing-started-at::`, `done-at::`, `doing-duration-seconds::`; `formatBlockWithStatus()` (248) reescribe el prefijo conservando metadatos ajenos. El render del tablero está en `desktop.ts:10138`. |
| `custom-select.ts` | 252 | `CustomSelect` (25), `migrateSelect()` (236), `syncCustomSelect()` (249). El `<select>` original sigue siendo la fuente de verdad; el menú se inserta en `document.body`, con navegación por teclado y `change` sintético. |
| `virtual-list.ts` | 353 | `VirtualList<T>` (92), `computeVisibleRange()` (55), `findIndexAtOffset()` (32), `renderWindow()` (237). Altura variable con caché por clave, `overscan=300`, `anchorIndex` para evitar saltos, `ResizeObserver`. Con 15.000 filas solo monta <25. |

---

## 7. Flashcards y repaso espaciado — mapa transversal

| Necesidad | Archivo y símbolo |
| :--- | :--- |
| Motor FSRS-7 (34 pesos, doble traza S/SF) | `editor/fsrs.ts:110 FSRSEngine`, `previewRatings():312` |
| Parámetros y pasos de aprendizaje | `editor/fsrs-settings.ts:31 normalizeFSRSParameters`, `:55 parseLearningSteps` |
| Configuración **por mazo** | `store/flashcard-decks.ts:25 FlashcardDeck.fsrs`, `:190 deckFSRSSettings` |
| Validación/persistencia de `decks.json` | `store/flashcard-decks.ts:458`, `store/flashcard-deck-storage.ts:95 FlashcardDeckRepository` |
| Detección de tarjetas en Markdown | `views/flashcards-manager.ts:973 scanPages` |
| Programación escrita en el bullet | `views/flashcards-manager.ts:791 updateBlockFSRS` (propiedades `card-*`) |
| Cola y orden de repaso | `views/flashcards-manager.ts:589 orderReviewCards`, `:1184 applyPageFilter` |
| Escaneo no bloqueante de 14k notas | `views/flashcard-loader.ts:193 load`, `:284 processChunk` |
| Recálculo masivo por lotes de 40 | `views/flashcard-maintenance.ts:176 runFlashcardMaintenance` |
| Borrado de propiedades FSRS (todas / notas o mazos elegidos) | `[D] desktop.ts renderFsrsClearPicker` (selector paginado que reutiliza `views/flashcard-decks.ts buildDeckTree/searchDeckTree/flattenDeckRows`) → `[V] flashcard-maintenance.ts runFlashcardMaintenance` acción `reset` |
| Calificación en escritorio | `desktop.ts:13508 applyFSRSRating` → `views/flashcards-manager.ts:1269 rate` |
| Calificación en móvil | `mobile/review-app.ts:2068 rate` (usa `persist=false` en modo Aprendizaje) |
| Diario de repasos | `store/review-progress.ts:18 ReviewProgressEvent`, `:306 ReviewProgressStore`, `.sinnotas/progress/reviews.json` |
| Undo/redo de repasos por dispositivo | `store/review-progress.ts:360 rebuildStacks`, `desktop.ts:13777/13804`, `mobile/review-app.ts:2398/2425` |
| Snapshots antes/después en el diario (sin texto) | `views/flashcards-manager.ts:50 CardScheduleSnapshot`, `:640/:688` |
| Identidad estable de tarjeta | `views/flashcards-manager.ts:744 cardFingerprint` (FNV-1a) |
| Modo Aprendizaje | `desktop.ts` (`LEARNING_MODE_STORAGE_KEY`), `mobile/review-app.ts:2581-2627` |
| Tarjetas de oclusión de imagen | `editor/image-occlusion.ts`, `desktop.ts:12887 createImageOcclusionPreview`, `mobile/review-app.ts:3326 createImagePreview` |
| Explorador (lista virtual) | `desktop.ts:13167 renderFlashcardExplorer`, `views/virtual-list.ts` |
| Heatmap | `views/review-heatmap.ts:41`, `desktop.ts:12401 renderFlashcardHeatmap` |
| "Árbol periódico" de progreso | `periodic-elements.ts:530 progressStageFromPoints` (118 elementos + 15 moléculas), `desktop.ts:12111/12133/12283/12342` |
| Pomodoro | `desktop.ts:12507 renderPomodoro`, `:12572 startPomodoro`, `:12553 startPomodoroBreak` |
| Gamepad (calificar con mando) | `gamepad.ts:200 GamepadListener`, `desktop.ts:3462 handleGamepadButton` |
| Atajos de calificación | `1/2/3/4` configurables en Ajustes → Flashcards (`sinnotas-flashcard-key-*`) |

---

## 8. Grafo y mapa conceptual — mapa transversal

| Necesidad | Archivo y símbolo |
| :--- | :--- |
| Extraer wikilinks salientes | `store/wikilinks.ts:28 collectOutgoingLinks` |
| Adyacencia servida por Rust (FASE 4-C) | `lib.rs:1173 graph_links` → `lib.rs:904 graph_links_from_cache` |
| Backlinks | `lib.rs:5261 find_backlinks` → `metadata_cache.rs:1117 find_cached_backlinks` |
| Física | `views/graph-physics.ts:286 physicsStep` |
| Configuración y colores | `views/graph-settings.ts` (`sinnotas-graph-settings`) |
| Render y gestos | `views/graph-view.ts:820 render`, `:954 setupEvents` |
| Vecindad de un nodo (T5) | `views/graph-neighborhood.ts:12`, `desktop.ts:14058 openGraphNeighborhood` |
| Preview lateral | `desktop.ts:13930 showGraphPreview`, `:13850 renderGraphPreviewContent` |
| Mapa conceptual de bullets | `views/concept-map-view.ts:87 ConceptMapView`, modal en `index.html:1601` |
| Banco de pruebas en vivo | `graph-harness.html` + `dev/graph-harness.ts` (17 comprobaciones, debe terminar en `HARNESS PASS`) |

---

## 9. Documentos PDF y bibliografía — mapa transversal

| Necesidad | Archivo y símbolo |
| :--- | :--- |
| Motor PDFium nativo (carga perezosa) | `src-tauri/src/pdf/engine.rs:13`, `:76 load_pdfium`, `:312 render_png`, `:281 extract_text` |
| Límites de seguridad PDF | `pdf/engine.rs:15-19` (10.000 páginas, 2.400 px, 12.000 px alto, 24 Mpx, 50.000 runs) |
| Enlazar sin copiar | `pdf/storage.rs:460 link_pdf` → `.sinnotas/documents/links.json` |
| Registro, caducidad, capturas | `pdf/storage.rs:166 load_registry`, `:532 set_expiry`, `:589 save_capture` |
| 9 comandos PDF | `lib.rs:4964-5064` (tabla completa en §13) |
| UI del lector | `views/pdf-view.ts:97 PdfReaderView` |
| CSS del lector y modo paralelo | `pdf.css:1`, `pdf.css:526` |
| Propiedad insertada al pegar texto | `pdf-source::` — `desktop.ts:6455 insertPdfTextIntoEditor`, `editor/markdown.ts:142` |
| Crear oclusión desde captura | `desktop.ts:6491 insertPdfCaptureIntoEditor` |
| Buscar DOI/ISBN/palabras | `views/bibliography-lookup.ts:256` → Rust `bibliography_lookup.rs:156` |
| Proveedores permitidos | Crossref `api.crossref.org`, Open Library `openlibrary.org` (`bibliography_lookup.rs:29-32`) |
| Portadas permitidas | `covers.openlibrary.org/b/id/<dígitos>-[SML].jpg` (`bibliography_lookup.rs:1089`) |
| Frontmatter `bib-*` | `views/bibliography.ts:12-23` |
| Host de persistencia en desktop | `desktop.ts:6717 createBibliographyHost` |

---

## 10. Tareas, diarios y productividad — mapa transversal

| Necesidad | Archivo y símbolo |
| :--- | :--- |
| Extraer tareas de bullets | `views/kanban-view.ts:44 scanTasks` |
| Render del tablero (3 columnas) | `desktop.ts:10138 renderKanbanBoard`, `index.html:1300-1350` |
| Cambiar estado | `desktop.ts:10188 updateTaskState`, `views/kanban-view.ts:295 cycleTaskStatus` |
| Fecha de vencimiento y urgencia | `desktop.ts:9933 taskDueUrgency`, `:9974 promptTaskDueDate` |
| Lista virtual de tareas | `views/virtual-list.ts`, `desktop.ts:10022 getKanbanVirtualLists` |
| Recompensa por completar | `desktop.ts:12008 applyTaskCompletionReward`, propiedad `completion-rewarded::` |
| Diarios | `store/vault.ts:1274 createJournal`, `desktop.ts:14872 renderJournalCalendar`, `:14987 renderJournalsView` (ruta `journals/AAAA_MM_DD.md`) |
| Todas las páginas | `views/all-pages.ts`, `desktop.ts:14685 renderAllPagesView`, `index.html:1352` |
| Pomodoro | `desktop.ts:12460-12633`, claves `sinnotas-pomodoro-*` |
| Panel de productividad | `desktop.ts:12643 setFlashcardProductivityVisible`, `style.css:6671` |
| Atajos globales | `index.html:1638-1675`, `desktop.ts` sección GLOBAL KEYBOARD SHORTCUTS (L16525) |

---

## 11. Interfaz: internacionalización, temas, tipografía y CSS

### 11.1 `i18n.ts` (2.339 líneas) — 3 idiomas sin recargar

- `InterfaceLanguage = "es"|"en"|"zh"`, `LanguagePreference = "auto"|…` (L1–2). Español = idioma fuente.
- `englishBySpanish` (L4–943, ~920 entradas) y `chineseBySpanish` (L944–1867, ~910). Diccionarios inversos en L1869/1873 y `reverseDictionary` (L1911).
- `localizedText()` (L1968) y `canonicalSpanish()` (L1917) aplican ~72 y ~21 patrones regex respectivamente para cadenas dinámicas ("Card N of M", "Active vault: X", etc.).
- `excludedContentSelector` (L1877): 24 selectores de contenido del usuario **nunca traducido** (`.block-editor`, `.page-title`, `.flashcard-explorer-question`, `[contenteditable='true']`, `.bib-user-data`, selectores `.mobile-*`, …).
- `WeakMap`s de originales y salidas (L1907–1910) permiten alternar idiomas sin perder el texto original.
- API: `translate()` (2230), `currentLanguage()` (2234), `currentLanguagePreference()` (2238), `setLanguagePreference()` (2247, persiste `sinnotas-language` y aplica en caliente), `onLanguageChange()` (2257), `initializeLocalization()` (2278, instala `MutationObserver` sobre `document.body` para traducir nodos dinámicos).
- Consumidores: `desktop.ts:214`, `mobile/review-app.ts:59-64`, `views/pdf-view.ts:2`, `views/bibliography-view.ts:1`. **Sin test propio.**

### 11.2 `typography.ts` (399 líneas) — 10 tamaños configurables

- `FontSizeKey` (L10): `ui, editor, pageTitle, h1…h6, flashcardText`.
- `FONT_SIZE_DEFINITIONS` (L41): defaults ui 15 (11–40), editor 15 (12–24), pageTitle 32 (20–56), h1 28, h2 24, h3 20, h4 18, h5 16, h6 14, flashcardText **1 em** (0.8–3).
- `migrateFontSizeDefaults()` (L209, versión 2: UI 24/26 → 15), `readFontSize()` (236, convierte px históricos de tarjeta a em), `readFontSizes()` (263), `writeFontSize()` (276), `resetFontSizes()` (292), `applyFontSizes()` (303, escribe las 10 CSS vars `--ls-font-size-*`, `--ls-flashcard-text-em`, `--ls-font-scale`, `--mobile-font-scale`), `applyStoredFontFamily()` (361, lee `sinnotas-font`/`sinnotas-system-font` y pone `data-font`).
- `mobileFontScale(uiSize)` (396) = `clamp(ui)/13` limitado a [0.85, 3]. Base histórica 13 px.
- Lo usan `desktop.ts:226-236`, `mobile/review-app.ts:67-73`, `views/graph-view.ts:17` y `views/concept-map-view.ts:3` (`activeFontFamily()` para canvas, que no entiende variables CSS).

### 11.3 Temas visuales y hojas CSS

| Archivo | Líneas | Banners / secciones (línea aprox.) |
| :--- | ---: | :--- |
| `style.css` | 9.787 | `:root` (1, tema oscuro y tokens `--ls-*`), `[data-theme=light]` (77), 12 acentos (128–261), TYPOGRAPHY MODES (263), COLLAPSIBLE SIDEBAR (319), Integrated Search & Omnibar (816), BÚSQUEDA DE CONTENIDO (923), MAIN WORKSPACE (1187), Top Headbar (1277), SETTINGS DROPDOWN (1661), CustomSelect (1702), selector de mazos (2395), mosaico de mazos (2415), árbol `--deck-depth` (2610), VIEWS CONTAINER (2773), CANVAS & OUTLINER (2786), OUTLINER BLOCKS (2951), MATH & CODE (3463), Tasks (3632), BACKLINKS (3757), CONTEXT MENUS (3837), KANBAN (4138), PAGE HISTORY (4538), Snapshots (4580/4637), CONCEPT MAP (4838), TOAST (4999), IMAGE OCCLUSION (5023), VAULT MANAGER (5076), SHORTCUTS (5856), oclusiones/zoom (6028), FLASHCARDS (6079), productividad (6671), APK editor completo (6695), GRAPH VIEW (7561), ajustes grafo (7589), ALL PAGES & JOURNALS (7881), GRAPH SETTINGS (8762), transiciones (8864), MÓVIL editor completo (8981), ACTUALIZACIONES (9058), sidebar en mosaico (9595). ~602 clases. |
| `material-aero.css` | 1.388 | Capa Material 3 sobre `style.css`: roles tonales (14), mapa `--md-*`→`--ls-*` (43), radio/desenfoco aero (87), BASE AERO (188), SUPERFICIES (245), NAVEGACIÓN M3 (395), BOTONES/CHIPS/INPUTS (548), FLOTANTES (667), TABLAS/DIARIOS (842), EDITOR (1010), FLASHCARDS/KANBAN/GRAFO (1068), MENÚS/MODALES (1122), MOVIMIENTO (1276), RESPONSIVE (1317), radios duros (1340), scrollbars (1382). |
| `theme-lino.css` | 288 | Tema "Simple" (nombre interno `lino`): tapiz plano, `color-mix` desde `--ls-accent`, sin gradientes/glow. `:root[data-visual="lino"]` (26), neutralizar aero (142/156), tapiz (164), tablas (258), tarjetas (267). |
| `theme-dracula.css` | 238 | `:root[data-visual="dracula"]` (14), paleta violeta/rosa/verde/cian/ámbar, variante diurna (85), neutralizar aero (143). |
| `bibliography.css` | 1.160 | `#view-bibliography` (2), tarjetas `.bib-card` (227), estados `--pending/--reading/--paused/--completed` (346–368), Modales (561), Formularios (892), Búsqueda de metadatos (964). |
| `pdf.css` | 675 | LECTOR PDF (1), `.pdf-library` (16), `.pdf-reader-toolbar` (236), `.pdf-stage` (317), `.pdf-text-layer span` (390), `.pdf-capture-layer` (406), PDF + EDITOR EN PARALELO (526). |
| `mobile/mobile.css` | 2.620 | Ver §14.3. |

**Orden de carga:** `style.css` → `material-aero.css` → `theme-lino.css` → `theme-dracula.css` → `pdf.css` → `bibliography.css` (`desktop.ts:18-24,149`). `mobile.css` solo en la APK.

---

## 12. Servicios y utilidades compartidas

### 12.1 `services/updater.ts` (736) + `update-utils.ts` (265)

- **Ninguna comprobación es automática**: el usuario pulsa "Buscar actualizaciones".
- `getUpdatePlatform()` (updater.ts:189): sin Tauri → `unsupported`; tienda → `store`; `platform()` → `android|ios|desktop`. `detectInstallKind()` (132) invoca `desktop_install_kind` y cachea (`native|snap|flatpak|msix`).
- Escritorio: `checkDesktop()` (528) → `downloadAndInstall` con eventos → `relaunch()` (559). Firma minisign verificada por el plugin.
- Android: `fetchAndroidManifest()` → `readAndroidManifestResponse()` (292) → streaming con `readResponseBytes()` (347) → tamaño ≤150 MB → `sha256Hex()` (408) → `saveAndroidApk()` (420) → `invoke("save_android_apk")` (MediaStore). **Instalación manual.**
- Deduplicación con `checkInFlight`/`installInFlight`; `subscribeUpdateState()` (180) notifica a la UI (`desktop.ts:4000`, `mobile/review-app.ts:3592`).
- Seguridad en `update-utils.ts`: `isAllowedUpdateUrl()` (145) exige HTTPS, whitelist de hosts de GitHub y prefijo `/wulflo/sinnotas/releases/download/`; `parseReleaseManifest()` (203) exige sha256 de 64 hex; `formatBytes()` (171), `compareVersions()` (83), `bytesToHex()` (260).
- Tests: `updater.test.ts` (75, 5 tests) y `update-utils.test.ts` (160, 14 tests).

### 12.2 Otros módulos compartidos

| Archivo | Líneas | Qué contiene |
| :--- | ---: | :--- |
| `gamepad.ts` | 248 | 5 presets (`CONTROLLER_PRESETS`: Xbox, PlayStation, Switch con inversión W3C, Steam Deck, genérico), `pressedButtonIndexes()` (171, gatillos en ejes 4/5, **nunca** 2/3), `GamepadListener` (200, flanco de subida, poll cada 60 ms). Consumido por `desktop.ts:3401-3531`. |
| `periodic-elements.ts` | 543 | 118 elementos (Z 1–118), 15 moléculas (h₂ a macromolécula, 119→539 puntos), `progressStageFromPoints()` (530). Solo escritorio (`desktop.ts:12000-12386`). |
| `deck-title.ts` | 55 | `DECK_SEPARATOR = " → "`(8), `splitDeckTitle()` (18), `normalizeDeckTitle()` (33), `sanitizeDeckTitle()` (45), `hasInvalidDeckTitleCharacters()` (53). Acepta `::`, `->`, `=>`, `›`, `»`, `→`, `>` como alias; `::` es inválido en Windows. |
| `app-mode.ts` | 141 | Ver §1.4. `resolveAppMode()` (123), `resolveSurfaceMode()` (90), `requestReviewMode()` (71), `requestDesktopEditor()` (78). |
| `tauri-config.test.ts` | 47 | 4 tests de regresión: CSP con `style-src-attr 'unsafe-inline'` y `font-src 'self' data:` (KaTeX en producción), manifiestos de iconos desktop/Android. |

### 12.3 Harnesses de desarrollo

| Archivo | Qué prueba |
| :--- | :--- |
| `graph-harness.html` + `src/dev/graph-harness.ts` (206) | 17 comprobaciones de gestos del grafo: clics alternos, fondo, drag, pan, zoom, color, estabilidad tras el settle, y que el loop de render pare en reposo (batería). Debe imprimir `HARNESS PASS`. |
| `occlusion-zoom-harness.html` + `src/dev/occlusion-zoom-harness.ts` (155) | Alineamiento de máscaras SVG con la imagen a zoom 1×, 1.5×, 2×, 3× y 4× (rect, elipse, polígono). |

---

## 13. Backend Rust / Tauri (`src-tauri/`)

### 13.1 Arquitectura

El crate `sin-notas` v0.5.5 (`lib` = `sin_notas_lib`) tiene en `lib.rs`:
- **Trait `VaultStorage` (L38)** con dos implementaciones: `FsStorage` (L109, filesystem, escritorio y vault interno móvil) y `SafStorage` (L274, Android SAF vía `tauri-plugin-android-fs`; `rename_note` = leer+escribir+borrar porque SAF no tiene rename atómico).
- **Estado global**: `ActiveVault` (600), `ApprovedVaultRoots` (613), `SnapshotGate` (1358), `VaultCacheState` (1837), registrados con `.manage()` en `run()` (6007–6009).
- **Runtime de caché** `VaultCacheRuntime` (1839): caché en disco + watcher `notify` + índice plegado + deltas al frontend.
- **Parser Markdown** `parse_markdown_with_frontmatter()` (1376, ids `b-N`, profundidad máx. 64) y `serialize_page_to_markdown()` (1533).
- **Validación de rutas**: `resolve_note_path()` (1601, rechaza NUL, 7 esquemas URI, `..`, componentes reservadas/temporales, exige `.md`, anti-symlink) y `resolve_vault_path()` (1691, variante para assets, `symlink_metadata`).
- **Escritura atómica** `write_file_atomically()` (4274, temp + rename, UUID, 32 intentos).

### 13.2 Los 51 comandos registrados

Registro exacto: `lib.rs:6040-6092` (`generate_handler!`). El único evento Rust→front es `"vault-cache-delta"` (emitido en `lib.rs:1958`), consumido por `desktop.ts:16796`.

| Dominio | Comandos (línea de la función en `lib.rs` salvo indicación) |
| :--- | :--- |
| Bóveda / notas | `load_vault` (3755), `pick_vault_root` (3655), `vault_sync_state` (1103), `read_pages_cached` (1139), `read_page` (4101), `read_note_created_times` (4153), `save_page` (4329), `delete_page` (5328), `rename_page` (5417), `find_backlinks` (5261), `open_note_with_default_app` (5395 / stub móvil 5412), `export_page_text` (4692) |
| Búsqueda / grafo | `search_content` (1156), `graph_links` (1173) |
| Bibliografía | `bibliography_lookup` (`bibliography_lookup.rs:156`) |
| Progreso / mazos / revisiones | `read_review_progress` (4466), `write_review_progress` (4475), `clear_review_progress` (4454), `read_flashcard_decks` (4496), `write_flashcard_decks` (4508), `read_page_revisions` (4523), `write_page_revisions` (4535), `migrate_legacy_snapshots` (4684) |
| Snapshots / Chronos | `get_snapshot_state` (4549), `activate_snapshots` (4561), `disable_snapshots` (4580), `list_active_snapshot_notes` (4596), `delete_note_snapshots` (4605), `delete_all_snapshots` (4621), `tick_snapshots` (4636), `read_note_snapshots` (4650), `restore_snapshot` (4661) |
| Imágenes | `resolve_image_path` (4035), `read_image_data` (4070), `save_image` (5073), `save_dropped_image` (5082), `delete_unused_attachments` (5253) |
| PDF | `pdf_list` (4964), `pdf_open` (4972), `pdf_render_page` (4982), `pdf_import` (4995), `pdf_unlink` (5064), `pdf_page_text` (5024), `pdf_set_expiry` (5035), `pdf_delete` (5045), `pdf_save_capture` (5054) |
| Sistema | `list_system_fonts` (5496), `save_android_apk` (5597), `desktop_install_kind` (5657), `set_native_scrollbar_style` (5729 Linux / 5801 otros), `software_rendering_active` (5991) |

### 13.3 Subsistemas

- **Caché de metadatos** (`metadata_cache.rs`, 1.545): `.sinnotas_cache.bin` (magic `SNC1`, v3, ≤256 MiB) y `.sinnotas_cache_delta.log` (magic `SND1`, v1). `load_or_scan_vault_with_mode()` (944) reutiliza entradas por `modified_ns`/`size`; `metadata_only=true` sirve `blocksLoaded=false` con `block_count`. `append_cache_delta()` (370) escribe solo lo cambiado con fsync; `apply_cache_delta()` (487) usa reglas convergentes (gana `modified_ns` mayor). `vault_fingerprint()` (543) permite el chequeo O(n) sin IPC. `find_cached_backlinks()` (1117). `extract_links()` (740) separa wikilinks de tags desde v3.
- **Búsqueda en Rust** (FASE 4-B): `fold_text()` (809), `visible_block_text()` (831), `refresh_content_index()` (2097, solo rutas sucias), `run_content_search()` (936, AND por bloque, mejor bloque por nota, índices en UTF-16 para coincidir con `locateMatch` del front).
- **Bibliografía** (`bibliography_lookup.rs`, 1.456): único HTTP saliente. Crossref (DOI/búsqueda) y Open Library (ISBN/palabras), `tokio::join!` con resultados parciales, `enforce_rate_limit()` 750 ms, caché 10 min/32 entradas, `https_only`, sin redirects, timeout 12 s, ≤2 MiB, allowlist de hosts y de portadas. 10 códigos de error estables.
- **PDF** (`pdf/engine.rs` 437 + `pdf/storage.rs` 1.067): `Pdfium` en `Mutex<Option<…>>` con carga perezosa; `links.json` con `link:<uuid>`, caducidad, `missing`, capturas en `assets/pdf-captures/`. El front recibe solo PNG y metadatos, nunca RGBA ni el PDF.
- **Snapshots**: constantes en `lib.rs:1186-1200` (máx. 30 días, 16 MiB, 2.000 archivos por nota, tolerancia de reloj 5 min); `tick_snapshots_in_root()` (3327) decide creación/borrado/anomalías; `restore_snapshot_from_root()` (3437) crea snapshot de seguridad antes de restaurar.
- **Permisos** (`capabilities/*.json`): `default.json` mínimo (opener solo a GitHub, portapapeles, `$APPCACHE/SinNotas-update.apk`); `desktop.json` updater+process; `android.json` `http:default` solo a GitHub Releases. CSP estricta en `tauri.conf.json:27-28`.
- **Build**: `Cargo.toml:67-73` features `updater` (default) y `microsoft-store`; release `opt-level="s"`, LTO, `panic="abort"`, strip.

### 13.4 Tests Rust

~56 tests en `lib.rs:6097-7891` (paths/symlinks, parser Markdown, imágenes/SVG, revisiones/snapshots, journals, SAF, progreso, búsqueda/grafo, virtualización); 15 en `metadata_cache.rs:1144-1545`; 12 en `bibliography_lookup.rs:1211-1456`; 4 en `pdf/engine.rs:345-437`; 13 en `pdf/storage.rs:643-1067`; 1 condicional en `perf_e2e_tests.rs:138` (requiere `SINNOTAS_PERF_VAULT`); ejemplo `examples/cache_benchmark.rs`.

---

## 14. Aplicación móvil (`src/mobile/`)

### 14.1 Arranque y superficies

`main.ts:49` → `review-app.ts:3646 mountMobileReviewApp()` → `new MobileReviewApp().mount()` → `initializeLocalization()`.

`MobileReviewApp.constructor()` (L430) inyecta **todo el HTML** como template literal (L433–791) y resuelve ~90 referencias con `requireElement()`. `mount()` (L887) aplica tema/acento/tipografía, FSRS del mazo activo, modo aprendizaje, eventos, actualizador y `bootstrapVault()` (L928). En Android sin root guardado: `pick_vault_root` (SAF) o *vault gate* (L948); con root: `loadAndApply()` (L1213). `syncFromDiskIfIdle()` (L1258) sincroniza al enfocar la app (1800 ms de espera, sin diálogos abiertos).

**12 capas DOM** generadas por código: cabecera/progreso, tarjeta, acciones, editor de tarjeta, ajustes, editor de mazos/selector paginado, ajustes FSRS, mazos, editor de oclusión, drawer, vault gate y toast. `syncOverlayState()` (L2189) mantiene la clase `has-editor`.

### 14.2 Índice de métodos de `review-app.ts`

| Área | Métodos (línea) |
| :--- | :--- |
| Ciclo de vida y bóveda | `constructor` 430, `mount` 887, `bootstrapVault` 928, `showVaultGate` 948, `loadAndApply` 1213, `syncFromDiskIfIdle` 1258, `loadVault` 1319, `applySnapshot` 1350, `readStoredPageFilter` 1387, `reconcilePageFilter` 1409, `pickVault` 2040 |
| Eventos y navegación | `bindEvents` 958 (delegado `click` sobre `[data-action]` con ~40 acciones, atajos en 1145–1199), `openDrawer` 2640, `openSettings` 2658, `syncOverlayState` 2189, `setBusy` 3554, `showToast` 3634 |
| Repaso | `reveal` 2060, `rate` 2068, `render` 3198, `showEmpty` 3309, `getRatingPreviews` (vía manager) |
| Editor de tarjeta y undo | `openEditor` 2143, `closeEditor` 2183, `saveEditor` 2202, `seedHistoryFor` 2253, `locateReviewBlock` 2292, `applyReviewSnapshot` 2329, `undo` 2364, `redo` 2381, `undoLastReview` 2398, `redoLastReview` 2425, `applyHistoryEntry` 2452 |
| Mazos | `activeDeck` 1450, `loadDecksForVault` 1462, `applyActiveDeckFilter` 1511, `activateDeck` 1524, `openDecks` 1538, `renderDecksList` 1641, `openDeckEditor` 1679, `renderNotesList` 1893, `appendDeckRow` 1958, `saveDeckFromEditor` 1751, `deleteDeck` 1831, `updateDeckIndicators` 2022 |
| Apariencia y aprendizaje | `readStoredTheme` 2490, `applyTheme` 2504, `readStoredAccent` 2526, `applyAccent` 2536, `applyStoredFontSizes` 2555, `nudgeCardTextSize` 2573, `readStoredLearningMode` 2581, `setLearningMode` 2590, `updateLanguageButtons` 2629 |
| FSRS y mantenimiento | `renderFSRSSettings` 2702, `saveFSRSSettings` 2736, `pageDeckFSRSSettings` 2809, `applyFlashcardMaintenance` 2822, `restoreFSRSDefaults` 2910 |
| Oclusión | `openOcclusionEditor` 2922, `renderOcclusionEditor` 2999, `startOcclusionDrag` 3030, `onOcclusionPointerMove` 3057, `onOcclusionPointerUp` 3099, `nudgeOcclusionFromKeyboard` 3106, `saveOcclusionEditor` 3132, `closeOcclusionEditor` 3185, `createImagePreview` 3326, `resolveImageUrl` 3492 |
| Actualizador | `initUpdateSettings` 3567, `renderUpdateState` 3592 |

### 14.3 CSS móvil (`mobile.css`, 2.620 líneas)

- `:root` (9): tokens `--mobile-*`, `--mobile-font-scale: 1.1538…`, `--mobile-safe-area-*` = `max(env(...), var(--sinnotas-safe-area-*))` (42–45).
- `:root[data-font=…]` (49–63), 11 acentos oscuros (67–111), tema claro (113–130) + 11 acentos claros (132–176).
- Layout: `.mobile-header` (250), `.mobile-progress` (429), `.mobile-card` (447–565), Markdown (566–724), imágenes/zoom (726–849), acciones y 4 valoraciones (898–1087).
- Bottom sheets (1089–1181), acentos (1183–1290), drawer y switch de aprendizaje (1318–1463), ajustes/FSRS (1465–1656), **escala global de texto** (1657–1764), selector de notas y mazos (1777–2108), oclusión (2110–2192), vault gate (2194–2248), toast (2250–2276), actualizaciones (2428–2491), control de tamaño y contexto del padre (2493–2541), CustomSelect (2543–2620).
- Media queries: 420 px (1939), horizontal ≥640 px (2320), 380 px (2359), `prefers-reduced-motion` (2370), 1024 px (2420). Animaciones `mobile-drawer-in` (1766), `mobile-fade-in` (2309), `mobile-sheet-up` (2314).
- `body.mobile-full-editor` (2379–2426): editor completo dentro de la APK.

### 14.4 Módulos de soporte

- `android-safe-area.ts` (53): `applyAndroidSafeArea()` (24) y `installAndroidSafeArea()` (40) puentean `window.SinNotasSafeArea` para WebView < 140; el script `scripts/patch-android-safe-area.mjs` inyecta el puente `SinNotasSafeArea v2` en `MainActivity.kt`.
- `notes-pagination.ts` (55): `NOTES_PER_PAGE = 20`, `NOTES_RENDER_CHUNK = 8`, `paginateNotes()` (36).
- Tests: `android-safe-area.test.ts` (93, 6 tests), `notes-pagination.test.ts` (52, 5 tests). **No hay test de `review-app.ts` ni de `mobile.css`.**

---

## 15. Pruebas, benchmarks y verificación

| Comando | Qué ejecuta |
| :--- | :--- |
| `npm test` | `vitest run` — ~465 pruebas en 45 archivos (según `docs/SinNotas.md:680`). Entorno `happy-dom` donde hace falta DOM. |
| `npx tsc --noEmit` | Gate de tipos estricto (`noUnusedLocals`/`noUnusedParameters`). |
| `npm run build` | `tsc && vite build` → `dist/`. |
| `cargo test --locked` (en `src-tauri`) | ~56 + 15 + 12 + 4 + 13 tests Rust. |
| `cargo clippy --locked -- -D warnings` | Lint Rust. |
| `cargo audit` | Auditoría de dependencias (con `glib 0.18.5` tolerada, ver checklist §A3). |
| `npm run dev` → `localhost:1420/graph-harness.html` | Harness del grafo, debe terminar en `HARNESS PASS`. |
| `npm run dev` → `localhost:1420/occlusion-zoom-harness.html` | Harness de zoom de oclusiones. |
| `scripts/benchmark-cache.sh [n]` | `cargo run --release … --example cache_benchmark -- n`. |
| `SINNOTAS_PERF_VAULT=<ruta> cargo test perf_e2e …` | Medición end-to-end (cold/warm, RSS, grafo, backlinks, rehidratación, búsqueda). |

**Mayores suites frontend** (por líneas): `desktop` no tiene test propio; `views/flashcards-manager.test.ts` (1.065, 50 `it`), `store/flashcard-decks.test.ts` (313), `store/review-progress.test.ts` (297), `store/content-search.test.ts` (239), `views/bibliography.test.ts` (242), `i18n.ts` sin test, `editor/fsrs.test.ts` (434), `editor/markdown.test.ts` (184), `editor/tree-engine.test.ts` (173), `services/update-utils.test.ts` (160).

**Huecos de cobertura conocidos:** `vault.ts` (1.355 líneas) solo tiene `vault-replace.test.ts`; `history.ts`, `html.ts`, `math.ts` no tienen test directo; `export.ts` no tiene tests y 5 de sus 6 exportaciones no tienen consumidor; `desktop.ts`, `main.ts`, `splash.ts`, `i18n.ts`, `bibliography-view.ts`, `concept-map-view.ts`, `graph-view.ts`, `pdf-view.ts`, `review-app.ts` y `mobile.css` carecen de test propio.

Resultados publicados en `docs/BENCHMARK-2026-10-29.md`: caché 5.000 notas frío 1.446,71 ms vs caliente 253,82 ms (5,70×); 20.000 notas 5.423,30 vs 1.019,74 ms (5,32×).

---

## 16. Build, CI, releases y empaquetado

### 16.1 Configuración

- `package.json` (48): 9 scripts (`dev`, `build`, `build:store`, `preview`, `android:patch`, `android:icons`, `tauri`, `test`, `test:watch`), Node ≥24, 12 dependencias de producción y 7 de desarrollo con `overrides` de seguridad.
- `vite.config.ts` (71): `resolveBuildMode()` (10) decide `__APP_MODE__`; target `es2021`; chunks manuales `katex`/`sanitizer`/`tauri-api`; puerto 1420 estricto.
- `tsconfig.json` (19): `strict`, `noEmit`, `moduleResolution: bundler`, `include: ["src"]`.
- `src-tauri/tauri.conf.json` (77): ventana 1240×840 sin decoraciones, CSP, `assetProtocol` `$APPDATA/**`, `resources/pdfium/**/*`, endpoint del updater y pubkey minisign.
- `src-tauri/tauri.store.conf.json` (17): capa para Microsoft Store sin updater.

### 16.2 Workflows

| Workflow | Trigger | Resultado |
| :--- | :--- | :--- |
| `ci.yml` (547) | push/PR a main/master/develop + dispatch | `lint-and-test` (cargo test, tsc, vitest, clippy, audit) → APK debug y APK release **firmada** como artefacto (master/dispatch). |
| `build.yml` (108) | push a master/main + dispatch | 4 instaladores (Windows, macOS ×2, Linux) como artefactos; **no crea release**. |
| `package-linux.yml` (209) | `workflow_call` desde release + dispatch | `.deb` → staging `packaging/linux/deb-root/` → `.snap` (publicación opcional) y `.flatpak` GNOME 51. |
| `release.yml` (569) | tag `v*` | `validate` (tag ↔ 3 versiones, tsc, test) → Android firmada + desktop ×3 (con `.sig` minisign) + Linux packages → `publish-release` con `prepare-release-assets.mjs` y `latest.json`. |
| `store-msix.yml` (169) | solo dispatch | MSIX **sin firmar** para Partner Center; verifica que `tauri-plugin-updater` **no** está en el grafo (`--no-default-features --features microsoft-store`). |

Todas las acciones de terceros están pineadas a SHA; `npm ci --ignore-scripts`; Node 24; PDFium se descarga en cada job de empaquetado.

### 16.3 Scripts (`scripts/`)

| Script | Uso |
| :--- | :--- |
| `fetch-pdfium.sh` (90) | Descarga PDFium build 8125 por OS/arch a `src-tauri/resources/pdfium/<target>/`. No se versiona. |
| `patch-android-safe-area.mjs` (171) | `npm run android:patch`; inyecta `SinNotasSafeArea v2` en `MainActivity.kt` generado. |
| `android-icons.mjs` (85) | `npm run android:icons`; regenera iconos launcher Android desde `icon-manifest.android.json`. |
| `prepare-release-assets.mjs` (258) | Único productor de `latest.json`: aplana artefactos, valida 6 plataformas, firma minisign, SHA-256 de la APK, y aborta si aparece `PRIVATE KEY` en un archivo. |
| `prepare-store-icons.mjs` (328) | Genera 46 iconos MSIX (`targetsize-*`) con decoder/encoder PNG propio. |
| `prepare-store-msix.mjs` (135) | Sustituye 5 placeholders en `AppxManifest.template.xml`. |
| `generate-keystore.sh` (126) / `sign-local.sh` (102) / `verify-signing.sh` (72) | Keystore PKCS12, firma local y verificación de alias/SHA-256. Ver `docs/KEYSTORES.md`. |
| `snap-store-credential.sh` (54) | `snapcraft export-login` acotado. |
| `package-linux.sh` (56) | Equivalente local del job `build-deb`. |
| `bench.ts` (61) / `bench_simple.mjs` (56) / `bench_mobile.mjs` (61) / `benchmark-cache.sh` (9) | Benchmarks; escriben `docs/benchmark-*.md` con timestamp. |

### 16.4 Canales de distribución

| Canal | Artefacto | Firma | Actualización |
| :--- | :--- | :--- | :--- |
| GitHub Releases | AppImage/.deb/NSIS/MSI/DMG + `latest.json` | minisign (`.sig`), `.deb.sig` manual | Plugin updater Tauri |
| Android | `app-release.apk` | JKS/PKCS12 release | Descarga manual desde `Descargas/SinNotas/` |
| Snap Store / Flathub | `.snap` / manifiesto GNOME 51 | tienda | La app oculta su botón al detectar `SNAP`/`FLATPAK_ID` |
| Microsoft Store | MSIX sin firmar | Microsoft tras certificación | Store (build sin updater) |

> **Atención:** `package.json`/workflows exigen Node 24 mientras README/CONTRIBUTING/SinNotas.md dicen 22.12+; `release.yml:validate` comprueba 3 archivos de versión pero `docs/RELEASE.md` exige 5; `THIRD_PARTY_LICENSES.md` resume 0.5.3 y el metainfo Flatpak solo lista hasta 0.4.15.

---

## 17. Documentación existente (índice)

| Archivo | Líneas | Secciones principales |
| :--- | ---: | :--- |
| `README.md` | 402 | Why (38), Features (49), Screenshots (115), Quick start (125), Shortcuts (191), Tests/benchmarks (210), Building (245), Android (313), Vault data (351), Docs (369). |
| `CONTRIBUTING.md` | 584 | Setup, **Project structure** muy detallado (incluye banners de `desktop.ts`, orden de import CSS, security boundaries), build/packaging, "Common changes: where to start", guidelines, tests, PRs, translations. |
| `docs/SinNotas.md` | 749 | Stack (9), Funcionalidad (37), PDF (59), Bibliografía (115), FSRS (138), Oclusión (173), Mazos (195/241), Safe area (290), Bóveda Android (315), Updater (339), Grafo (388), Caché (444), Seguridad (458), Rendimiento (494), Release (543/559/606), verificación (680). |
| `docs/CHECKLIST-CONSOLIDADO.md` | 6.559 | §0 reglas, §1 resumen, bloques **A1** (239), **A2** (974), **A3** (1.423), **B1** (1.977), **B2** (2.194), **B3** (2.444), **B4** (2.781), **C1** (3.036), **C2** (3.213), **D1** (3.420, tareas T1–T23), **D2** (6.074), §3 fuentes (6.530). |
| `docs/GUIA-DE-USO.md` / `USER-GUIDE.md` | 500 / 490 | Guías de usuario es/en, 13–14 secciones paralelas. |
| `docs/RELEASE.md` | 125 | 5 archivos de versión, validación, tag, Snap/Flatpak, errores. |
| `docs/KEYSTORES.md` | 140 | Regla de oro, backup GPG, key nueva vs legacy, 5 secretos, verificación local. |
| `docs/BENCHMARK-2026-10-29.md` | 84 | Resultados JS, caché Rust y vault sintética. |
| `PRIVACY_POLICY.md` / `THIRD_PARTY_LICENSES.md` | 31 / 1.494 | Privacidad e inventario de licencias (507 crates, PDFium, FSRS, fuentes KaTeX). |
| `.agents/skills/` | — | Skills del proyecto, en la ruta compatible con varios agentes (OpenCode también las descubre aquí): `estilo-ui`, `busqueda-incremental`, `traducciones-ui`, `guia-de-uso`, `vault-performance-guard`, `tauri-desktop` (config/CSP, ACL, IPC, plugins y build), `calidad-pruebas` (Vitest/Rust, depuración y refactor), `verificacion-manual` (navegador y matriz Tauri) y `mantenimiento-skills` (crear y revisar skills). |

---

## 18. Índice funcionalidad → código (búsqueda rápida)

> Tabla de consulta: partiendo de lo que ves en la app, aquí está la pieza que lo hace funcionar. `[E]` editor, `[V]` vistas, `[S]` store, `[R]` Rust, `[M]` móvil, `[D]` desktop, `[I]` infra.

### 18.1 Escritura y editor

| Funcionalidad | Dónde está |
| :--- | :--- |
| Árbol de bullets, Enter/Tab/Backspace, selección múltiple | `[E] src/editor/tree-engine.ts`; `[D] desktop.ts selectBulletRange` (Shift) y `toggleBulletSelection` (Ctrl/Cmd+clic intercalado) |
| Undo/redo coalescido | `[E] editor/history.ts:71` + `[D] desktop.ts:8329/8343` |
| Render Markdown + wikilinks + cloze + tablas + math | `[E] editor/markdown.ts:401` → `[D] desktop.ts:5399` |
| Tablas GFM con editor gráfico | `[E] editor/markdown-table.ts` + `[D] desktop.ts createTableToolbar` (8 botones agrupados insertar/mover/borrar, en flujo normal sobre la tabla), `activeTableCell` usa `lastFocusedTableCells` para respetar el cursor; menú `desktop.ts:10420` |
| Slash commands | `[D] desktop.ts:8542-8748` (`index.html:1676` menú de texto) |
| Buscar dentro de la nota (Ctrl+F) | `[E] editor/note-search.ts` + `[D] desktop.ts:15846-16006` |
| Botones ir al inicio/final de nota larga | `[E] editor/note-scroll-nav.ts` + `[D] desktop.ts:8077` |
| Pegar seguro desde portapapeles | `[E] editor/paste-sanitizer.ts` + `[E] plain-text-paste.ts` |
| Insertar imágenes (pegar/soltar/archivo) | `[D] desktop.ts insertImageBlock` (si el bullet destino está vacío se sustituye, sin dejar bullet en blanco) + `[E] image-bytes.ts` |
| URLs de imágenes anti-SSRF | `[E] editor/url-safety.ts` |
| Oclusión de imagen (dibujar/mover/rotar/alinear) | `[E] editor/image-occlusion.ts` + `[D] desktop.ts:11172-11447` |
| Historial de versiones (snapshots) | `[D] desktop.ts:9414-9894` + `[R] lib.rs:4549-4684` |
| Exportar nota a `.txt` | `[S] store/export.ts:59` + `[R] lib.rs:4692` |
| Grafo de wikilinks salientes en el editor | `[D] desktop.ts:9059 paintOutgoingLinks` + `[S] store/wikilinks.ts` |
| Autocompletado de `[[wikilink]]` | `[D] desktop.ts:5646-5818` |

### 18.2 Organización y vault

| Funcionalidad | Dónde está |
| :--- | :--- |
| Cargar bóveda desde `.md` | `[R] lib.rs:3755 load_vault` → `[S] vault.ts:620 replaceVault` |
| Caché binaria y arranque rápido | `[R] metadata_cache.rs:944` + `[S] vault.ts:272 isMetadataOnlyBoot` |
| Hidratar notas bajo demanda | `[R] lib.rs:1139 read_pages_cached` → `[S] vault.ts:794` |
| Detectar cambios externos | `[R] lib.rs:2183 install_watcher` → evento `vault-cache-delta` → `[D] desktop.ts:16796` |
| Guardado con debounce 300 ms | `[S] vault.ts:261,874,904` |
| Renombrar y reescribir wikilinks | `[S] vault.ts:1011,1086` + `[R] lib.rs:5417` |
| Bóvedas múltiples | `[D] desktop.ts:15237-15498` + `sinnotas-vault-registry-v1` |
| Omnibar (buscar/crear nota) | `[D] desktop.ts:15499-15791` + `[S] content-search.ts` |
| Búsqueda de contenido en Rust | `[R] lib.rs:1156 search_content`, `936 run_content_search` |
| Diarios por fecha | `[S] vault.ts:1274` + `[D] desktop.ts:14872` |
| Todas las páginas (orden/filtro columnas) | `[V] all-pages.ts` + `[D] desktop.ts:14685` |
| Backlinks | `[R] lib.rs:5261` + `[D] desktop.ts:9059` |

### 18.3 Repaso

| Funcionalidad | Dónde está |
| :--- | :--- |
| Calificar y programar | `[E] fsrs.ts` → `[V] flashcards-manager.ts:1269` → `[S] review-progress.ts` |
| Parámetros por mazo / globales (mazo «Todos») | `[S] flashcard-decks.ts:190` + `[D] desktop.ts:3142-3261` + `[M] review-app.ts globalFSRSSettings` (persistidos en `sinnotas-fsrs-settings`) |
| Crear/editar/borrar mazos | `[S] flashcard-decks.ts:212/245/277` + `[D] desktop.ts:2386-2732` |
| Árbol jerárquico de mazos | `[V] flashcard-decks.ts:75` |
| Recálculo masivo (40 por lote) | `[V] flashcard-maintenance.ts:176` |
| Borrado selectivo de propiedades FSRS y de marcadores | `[D] desktop.ts createFlashcardScopePicker` (selector paginado compartido, `#fsrs-clear-*` y `#flashcard-clear-*` en Avanzado) → `[E] flashcard-markers.ts removeFlashcardMarkers` |
| Explorador y filtros | `[D] desktop.ts:13167` + `[V] virtual-list.ts` |
| Modo Aprendizaje (sin persistir FSRS) | `[D] desktop.ts`, `[M] review-app.ts:2590` |
| Undo/redo de repasos | `[S] review-progress.ts:422-475` + `[D] desktop.ts:13777` |
| Pomodoro y productividad | `[D] desktop.ts:12460-12633` |
| Heatmap y árbol periódico | `[V] review-heatmap.ts`, `[E/D] periodic-elements.ts` |
| Gamepad | `[SVC] gamepad.ts` + `[D] desktop.ts:3379-3560` |

### 18.4 Grafos, documentos y tareas

| Funcionalidad | Dónde está |
| :--- | :--- |
| Grafo interactivo | `[V] graph-view.ts` + `[V] graph-physics.ts` + `[V] graph-settings.ts` |
| Vecindad y preview | `[V] graph-neighborhood.ts` + `[D] desktop.ts:13930/14058` |
| Grafo apilado sobre referencias en la sidebar derecha | `[D] desktop.ts showReferenceGraph / renderReferenceGraph` (`#reference-pane-graph`, `reference-graph-canvas`), reutiliza `[V] graph-view.ts GraphView` (con `centerOn()` que sigue al nodo mientras avanza la física) y `connectedPageTitles` |
| Buscador de notas de referencia | `[D] desktop.ts createReferenceNotePicker` + `REFERENCE_RESULTS_CHUNK = 20` (resultados por tandas con «Mostrar más» y debounce de 120 ms, sin montar todas las notas) |
| Mapa conceptual | `[V] concept-map-view.ts` + `index.html:1601` |
| Lector PDF | `[V] pdf-view.ts` + `[R] pdf/engine.rs` + `[R] pdf/storage.rs` |
| Enlazar PDF sin copiar | `[R] pdf/storage.rs:460 link_pdf` |
| Texto seleccionable del PDF | `[R] pdf/engine.rs:281` → `[V] pdf-view.ts:513` |
| Capturas y oclusiones desde PDF | `[D] desktop.ts:6491` + `[R] lib.rs:5054` |
| Búsqueda DOI/ISBN | `[V] bibliography-lookup.ts` → `[R] bibliography_lookup.rs` |
| Bibliografía (frontmatter `bib-*`) | `[V] bibliography.ts` + `[V] bibliography-view.ts` (todos sus `<select>` migrados a `[V] custom-select.ts CustomSelect`) |
| Kanban | `[V] kanban-view.ts` + `[D] desktop.ts:9895-10250` |
| Fuentes del sistema | `[R] lib.rs:5496 list_system_fonts` |
| Actualizaciones | `[SVC] services/updater.ts` + `[R] lib.rs:5657/5597` |
| Detección de tienda / render software | `[R] lib.rs:5657`, `:5991` |

### 18.5 Plataforma y build

| Necesidad | Dónde está |
| :--- | :--- |
| Elegir superficie de arranque | `[I] vite.config.ts:10` + `src/app-mode.ts` + `src/main.ts` |
| APK en modo repaso | `[M] mobile/review-app.ts` + `mobile.css` |
| Editor completo en Android | `[M] main.ts:43` (`body.mobile-full-editor`) + `android-safe-area.ts` |
| Safe area nativo | `[I] scripts/patch-android-safe-area.mjs` |
| Idiomas | `[SVC] i18n.ts` |
| Temas visuales | `style.css` + `material-aero.css` + `theme-lino.css` + `theme-dracula.css` |
| Firma Android | `[I] docs/KEYSTORES.md`, `scripts/generate-keystore.sh`, `sign-local.sh` |
| `latest.json` | `[I] scripts/prepare-release-assets.mjs` |
| MSIX | `[I] store-msix.yml`, `prepare-store-icons.mjs`, `prepare-store-msix.mjs` |
| Harness del grafo | `[I] graph-harness.html` + `src/dev/graph-harness.ts` |

---

## 19. Glosario de formatos y convenciones

| Término | Significado y dónde se define |
| :--- | :--- |
| **Vault / bóveda** | Carpeta de notas Markdown. Raíz activa en `sinnotas-active-vault-root`; registro en `sinnotas-vault-registry-v1`. |
| **Bloque** | Unidad del outliner (`BlockNode`, `types.ts:3`). Id `b-…`. `type: "text"\|"image"`. |
| **Propiedad** | Línea `clave:: valor` dentro del contenido de un bloque. Se excluye del texto visible (`content-search.ts:19`, `markdown.ts:142`, `lib.rs:831`). |
| **Frontmatter** | Bloque YAML `--- … ---` al inicio del `.md` (`lib.rs:1376`, `store/vault.ts`). |
| **`#card` / `::`** | Marcadores de tarjeta básica (`flashcards-manager.ts:973`). |
| **`{{c1::…}}` / `==…==`** | Cloze (`editor/markdown.ts:173-193`, `flashcards-manager.ts:973`). |
| **`image-occlusions::`** | JSON de regiones normalizadas (0..1) en la propiedad del bloque (`editor/image-occlusion.ts:66`). |
| **`pdf-source::`** | Origen de un fragmento insertado desde un PDF (`desktop.ts:6455`). |
| **`task-due::`, `doing-started-at::`, `done-at::`, `doing-duration-seconds::`, `completion-rewarded::`** | Metadatos de Kanban (`views/kanban-view.ts:19`, `desktop.ts:12008`). |
| **`card-s`, `card-d`, `card-s-fast`, `card-reps`, `card-lapses`, `last-reviewed`, `interval-days`, `ease-factor`, `due-date`, `card-state`, `card-learn-step`** | Estado FSRS serializado en el bloque (`flashcards-manager.ts:791`). `stabilityFast` es la doble traza FSRS-7. |
| **Separador de mazo `→`** | U+2192, canónico (`deck-title.ts:8`). Aliases `::`, `->`, `=>`, `›`, `»`, `>`. |
| **FSRS-7** | 34 pesos oficiales, `stability` + `stabilityFast`, retención [0.7,0.97], pasos <1 día (`editor/fsrs.ts`). |
| **`fingerprint`** | Huella FNV-1a del texto visible + tipo de tarjeta; identifica la tarjeta aunque cambie el `b-N` (`flashcards-manager.ts:744`). |
| **Metadata-only / `blocksLoaded:false`** | Arranque rápido: la nota llega sin bloques y se rehidrata con `read_pages_cached` (`types.ts:74`, `vault.ts:778`). |
| **`VaultCacheDelta`** | Evento del watcher Rust con `changed`, `removed` y `revision` (`types.ts:96`, `lib.rs:1958`). |
| **`link:<uuid>`** | Identificador de un PDF enlazado desde fuera del vault (`pdf/storage.rs:137`). |
| **`.sinnotas/`** | Única carpeta administrada por la app dentro del vault: `chronos/`, `progress/`, `documents/`, `flashcards/`, `revisions/`. Legacy `chronos/` y `progress/` se migran automáticamente. |
| **SAF** | Android Storage Access Framework; `SafStorage` (`lib.rs:274`) y `pick_vault_root` con `show_open_dir_dialog`. |
| **`__APP_MODE__`** | Constante de compilación inyectada por Vite (`vite.config.ts:47`); `"desktop"` o `"flashcards"`. |
| **`data-app-mode` / `data-theme` / `data-accent` / `data-visual` / `data-font`** | Atributos en `<html>`/`dataset` que gobiernan superficie, tema, acento, estilo visual y tipografía. |
| **`--ls-*` / `--md-*` / `--ma-*` / `--mobile-*`** | Variables CSS de la hoja base, Material 3, capa aero y móvil respectivamente. |

---

### Cierre

Este índice es un mapa, no una guía de cambio: para entender **por qué** se tomó una decisión (FSRS-7, FASE 4, A1–D2), consulta `docs/CHECKLIST-CONSOLIDADO.md`; para entender **cómo se usa** la app, `docs/GUIA-DE-USO.md`; y para el estado técnico y de releases, `docs/SinNotas.md`.

