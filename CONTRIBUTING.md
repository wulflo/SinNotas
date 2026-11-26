# Contributing to SinNotas

Thanks for taking the time to improve SinNotas. This guide covers the development setup, project conventions, testing requirements and the pull-request process.

SinNotas is a small, deliberately dependency-light project: **Tauri v2 + Rust on the backend, native TypeScript/HTML/CSS on the frontend, and Vite for development and bundling**. There is no React and no Tailwind CSS. Keeping the stack small is a feature, not an accident.

---

## Ways to contribute

- 🐛 **Report a bug** with clear reproduction steps, the operating system, the SinNotas version and any relevant console output.
- 💡 **Propose a feature** by opening an issue describing the problem it solves, not only the UI you have in mind.
- 📝 **Improve documentation** in `README.md`, `docs/` or the in-app help text.
- 🌍 **Translate or review** the Spanish, English and Chinese interface strings.
- 🧪 **Add tests** for an existing edge case, a parser rule, a focus bug or a Rust path-validation rule.
- 💻 **Send code** for a bug fix, accessibility improvement, performance win or well-scoped feature.

For large features, refactors or changes that touch the data format, **open an issue first** so the design can be discussed before you spend time on implementation.

---

## Development setup

### 1. Prerequisites

- **Node.js 24 or newer** (required by `package.json` engines and CI).
- **Rust stable** with `rustup`.
- The system dependencies for your platform. The per-distribution Linux commands are in the [README quick start](README.md#-quick-start).

### 2. Install dependencies

```bash
npm ci
```

`npm ci --ignore-scripts` mirrors the CI installation and is a good choice if you do not need lifecycle scripts.

### 3. Fetch PDFium

PDFium is not committed to the repository. The PDF reader and its tests need the native library for your current platform:

```bash
scripts/fetch-pdfium.sh
```

The script downloads the matching library into `src-tauri/resources/pdfium/<os>-<arch>/`.

### 4. Start the app

Web frontend only — useful for UI work, but native features such as local vaults, PDFium and the updater will not be available:

```bash
npm run dev
# http://localhost:1420
```

Full desktop app:

```bash
npm run tauri dev
```

### 5. Run the tests before you change code

```bash
npm test
npx tsc --noEmit
npm run build
```

Backend:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

A clean baseline makes it much easier to tell whether a failure comes from your change.

---

## Project structure

SinNotas is a **file-first Markdown outliner**. The notes on disk are the source of truth; the UI is a rendering and editing layer over them. There is no database, no virtual DOM and no component framework. That constraint explains most of the structure: small pure TypeScript modules with co-located tests, one large orchestrator per surface, plain CSS files loaded in a deliberate order, and a Rust backend that owns every filesystem operation.

Tests live next to the code they cover (`foo.ts` + `foo.test.ts`) and run with Vitest in `happy-dom`. Rust unit tests live in `#[cfg(test)]` modules at the bottom of each file (or in `perf_e2e_tests.rs`).

### Repository layout

```text
.
├── index.html                  # Desktop HTML shell: splash, sidebar, views, settings, menus
├── graph-harness.html          # Dev-only live harness for the graph view
├── occlusion-zoom-harness.html # Dev-only harness for image-occlusion zoom
├── src/                        # Frontend (TypeScript + CSS, no framework)
│   ├── main.ts                 # Entry point: chooses desktop or mobile surface
│   ├── desktop.ts              # Desktop orchestrator (largest file)
│   ├── mobile/                 # Android/iOS review surface + mobile-only helpers
│   ├── editor/                 # Pure editor engine: blocks, Markdown, FSRS, sanitizers
│   ├── views/                  # Self-contained view components and view models
│   ├── store/                  # Persistence-aware stores and pure selectors
│   ├── services/               # Updater and release utilities
│   ├── dev/                    # Dev harness entry points
│   └── *.css                   # Base, theme layers and view-specific styles
├── src-tauri/                  # Rust backend + Tauri configuration
│   ├── src/lib.rs              # Vault, storage, commands, snapshots, fonts, policy
│   ├── src/metadata_cache.rs   # Persistent bincode note cache
│   ├── src/bibliography_lookup.rs
│   ├── src/pdf/                # Native PDFium integration
│   ├── capabilities/           # Per-platform permission scopes
│   ├── resources/pdfium/       # Downloaded native libraries (never committed)
│   └── tauri.conf.json         # Window, CSP, bundle and updater configuration
├── scripts/                    # Build, packaging, icon and benchmark automation
├── packaging/                  # Flatpak and Microsoft Store manifests
├── docs/                       # Technical reference and feature checklists
├── .github/workflows/          # CI, release and store pipelines
└── vite.config.ts              # App-mode selection, chunking and dev server
```

### Root files

| Path | Purpose |
| --- | --- |
| `index.html` | The entire desktop DOM: static shell plus empty containers that views fill at runtime. The inline `<style>` block is the **only** source of splash styles, deliberately applied before CSS loads. |
| `src/main.ts` | Single entry point. Reads the compile-time `__APP_MODE__`, combines it with the saved surface preference, then dynamically imports either `desktop.ts` or `mobile/review-app.ts`. Also installs Android safe-area insets and the boot-error fallback. |
| `vite.config.ts` | Resolves `VITE_APP_MODE` / `TAURI_ENV_PLATFORM` into `__APP_MODE__`, sets the ES2021 target, splits `katex`, `dompurify` and Tauri APIs into separate chunks, and pins the dev server to port 1420. |
| `tsconfig.json` | Strict TypeScript configuration for the frontend. |
| `graph-harness.html`, `occlusion-zoom-harness.html` | Standalone pages served by Vite for interactive regression testing of the graph and occlusion editor. |
| `package.json` | Dependencies and scripts. The accepted stack is Tauri v2, TypeScript, Vite, Vitest, KaTeX and DOMPurify. |
| `src-tauri/` | Rust crate, Tauri config, capabilities, icons and bundled resources. |

### Frontend bootstrap

`src/main.ts` is intentionally tiny and is the only place where the two surfaces meet:

1. `app-mode.ts` decides the surface. `resolveAppMode()` checks `VITE_APP_MODE`, the Tauri platform and the user agent; `resolveSurfaceMode()` then applies the user's saved request (`sinnotas-review-mode`, `sinnotas-mobile-full-mode`).
2. Desktop mode imports `desktop.ts`. On mobile builds the `mobile-full-editor` body class is added and Android safe-area insets are installed.
3. Review mode imports `mountMobileReviewApp()` from `mobile/review-app.ts`.
4. Any bootstrap failure replaces the body with a readable error and hides the splash.

`src/splash.ts` only owns `hideAppSplash()`. Do not add splash styling to `style.css`: the inline block in `index.html` is the single source of truth, to avoid a second repaint during startup.

### The desktop application (`src/desktop.ts`)

`desktop.ts` is deliberately a single orchestration file rather than a framework of abstractions. It wires DOM elements, global state, keyboard shortcuts and the views together. Pure logic is extracted into `editor/`, `views/` and `store/`; anything that needs the live DOM lives here.

It is organized by banner comments. When editing, jump to the banner rather than scrolling:

| Section | Responsibility |
| --- | --- |
| **Module-level state and helpers** | Undo history per note, pending title rename, empty-bullet tracking, deck and heatmap preferences, format helpers, toasts and prewarm scheduling. |
| **MAZOS PERSONALIZADOS** | Custom flashcard deck model, deck trees, naming, selection and migration of the legacy deck. |
| **MOVIMIENTO DE MENÚS** | Context-menu positioning and viewport clamping. |
| **TOAST NOTIFICATION** | The single `showToast()` implementation. |
| **GUARDADO AL CERRAR** | Flush pending edits and persist caches before the window closes. |
| **THEME & TYPOGRAPHY MANAGEMENT** | Theme (`sinnotas-theme`), visual style (`sinnotas-visual`), accent, font family, page width, font sizes and system-font enumeration. |
| **MAZOS PERSONALIZADOS: UI Y ESTADO** | Deck manager UI, filters, counts and lifecycle. |
| **ACTUALIZACIONES** | Desktop updater UI, install-kind detection and the Android APK download path. |
| **CONCEPT MAP** | Concept-map modal and its data derivation. |
| **SIDEBAR COLLAPSE / EXPAND** | Collapsed sidebar, resizer and persistence. |
| **NAVIGATION HISTORY (BACK / FORWARD)** | In-app back/forward stack. |
| **NAVIGATION & VIEWS** | `switchView()`, nav highlighting, view lifecycle and lazy prewarm. |
| **PDF + EDITOR EN PARALELO** | Split mode where the PDF reader and the outliner share the screen. |
| **OUTLINER EDITOR** | The core block editor: rendering, caret handling, keyboard commands, drag and drop, paste, formatting, images, tables and math. |
| **BIBLIOGRAFÍA** | Bibliography view host: CRUD over note frontmatter, detail panel, lookup, covers and filters. |
| **UNDO / REDO (Ctrl+Z / Ctrl+Y)** | Per-note `DocumentHistory` integration. |
| **PAGE DELETION** | Delete flows and confirmation. |
| **PAGE VERSION HISTORY / SNAPSHOTS** | Manual and automatic snapshot UI, restore and cleanup. |
| **KANBAN BOARD VIEW** | Kanban columns, drag between columns, persistence in the daily note. |
| **BLOCK CONTEXT MENU** | Block-level context actions. |
| **NAVIGATION CONTEXT MENU** / **SIDEBAR CONTEXT MENU ACTIONS** | Page and sidebar context menus. |
| **FLASHCARDS SESSION (FSRS-7)** | Review session, card queue, ratings, keybindings, heatmap and statistics. |
| **GRAPH VIEW** / **GRAPH SETTINGS UI** | Graph lifecycle, selection, dragging, filters and settings panel. |
| **ALL PAGES VIEW** | Sorting, filtering, dates and persistent column widths. |
| **JOURNALS VIEW** | Daily-note calendar and journal navigation. |
| **SIDEBAR & OMNIBAR (SMART SEARCH)** / **BARRA LATERAL: FIJADAS Y RECIENTES** | Pinned and recent pages, sidebar search. |
| **VAULT MANAGER** | Vault registry, switching, creation and removal. |
| **BÚSQUEDA DE CONTENIDO (OMNIBAR)** | Full-text search over the vault using `ContentSearchIndex`. |
| **BUSCAR DENTRO DE LA NOTA (T20)** | In-note search and match navigation. |
| **VISTA DIVIDIDA: PANEL DE REFERENCIA (T7, fase 1)** | Reference side panel in split view. |
| **GLOBAL KEYBOARD SHORTCUTS** | App-wide shortcut dispatch. |
| **SINCRONIZACIÓN ENTRE DISPOSITIVOS** | File watching and external-change reconciliation. |

CSS is imported here (see [Styles](#styles-and-the-visual-system)), and the module starts the app itself at the bottom: it waits for `DOMContentLoaded` if needed, calls `initializeDesktopApp()` and always hides the splash afterwards. `main.ts` imports it for its side effect only.

### The mobile review surface (`src/mobile/`)

| Path | Purpose |
| --- | --- |
| `review-app.ts` | Complete Android/iOS review experience: card queue, active-card editing, deck filter, FSRS settings, language switch, updater and safe-area handling. It reuses the same `editor/`, `store/` and `views/` modules as the desktop app but has its own DOM and CSS. It exports `mountMobileReviewApp()`. |
| `mobile.css` | All styles for the review surface. The APK does **not** load `style.css`, so this file defines its own tokens and typography. |
| `android-safe-area.ts` | Reads the native inset bridge and applies CSS variables so content clears the status bar and gesture area. |
| `notes-pagination.ts` | Pagination constants and `paginateNotes()` for long note lists. |

`review-app.ts` imports `katex/dist/katex.min.css` and `mobile.css`; it must not import desktop-only CSS or rely on `index.html` markup.

### Editor engine (`src/editor/`)

Pure, DOM-light modules. This is where block and Markdown behavior belongs; keep them free of app-wide state so they remain testable.

| File | Responsibility |
| --- | --- |
| `tree-engine.ts` | The block tree: IDs, cloning, lookup, flattening, insertion, splitting, indentation, moving, removal, task toggling and formatting. |
| `history.ts` | `DocumentHistory` undo/redo snapshots per note. |
| `markdown.ts` | Block tree ↔ Markdown serialization, system-property lines, card/task tags, sanitized HTML rendering (DOMPurify), style-attribute filtering and KaTeX integration. |
| `markdown-table.ts` | Parse, serialize and edit Markdown tables with alignment. |
| `math.ts` | KaTeX rendering helpers for inline and display math. |
| `fsrs.ts` | FSRS-7 scheduler: ratings, card states, retrievability, intervals and review logging. |
| `fsrs-settings.ts` | FSRS-7 parameter normalization (`normalizeFSRSParameters`); the `sinnotas-fsrs-settings` key remains only as legacy for deck migration. |
| `custom-select.ts` | App-themed dropdown selectors: `CustomSelect` replaces native `<select>`s (`migrateSelect`, `syncCustomSelect`); see `docs/SinNotas.md` → dropdowns. |
| `image-occlusion.ts` | Region normalization, parsing, clamping, updates and mask rendering data for image-occlusion cards. |
| `image-bytes.ts` | Raster image type detection and normalization before saving. |
| `note-search.ts` | Folded, accent-insensitive match search inside blocks. |
| `note-scroll-nav.ts` | Scroll state, edge tolerance and the note scroll controller. |
| `paste-sanitizer.ts` | Clipboard HTML → minimal safe tree → Markdown. Security boundary. |
| `plain-text-paste.ts` | Caret-aware plain-text insertion. |
| `url-safety.ts` | URL, remote-image and private-host validation. Security boundary. |
| `html.ts` | `escapeHtml()` and small HTML helpers. |

### Views (`src/views/`)

View modules render into a container and receive a small `host` interface for callbacks and data access. They must not reach into global `desktop.ts` state directly.

| File | Responsibility |
| --- | --- |
| `flashcard-decks.ts` | Deck tree building, sorting, searching, selection state and flattening; per-deck FSRS settings (`deckFSRSSettings`, `flashcardDeckContainsPageTitle`). |
| `flashcards-manager.ts` | Review queue, page statistics, editable card fields and schedule snapshots. |
| `flashcard-loader.ts` | Progressive hydration of note blocks for card generation. |
| `review-heatmap.ts` | Review heatmap data shaping (days and weeks). |
| `graph-view.ts` | Graph canvas, selection, dragging, panning, zoom, filtering and rendering. |
| `graph-physics.ts` | Force simulation, collision, reveal order and initial positions. |
| `graph-settings.ts` | Persisted graph settings, color rules and physics conversion. |
| `graph-labels.ts` | Label visibility by zoom. |
| `graph-neighborhood.ts` | Connected pages for the preview/neighborhood panel. |
| `concept-map-view.ts` | Concept-map layout and interaction. |
| `kanban-view.ts` | `KanbanManager`: columns, task cards and board rendering. |
| `bibliography.ts` | Bibliography frontmatter schema, status/type constants, item mapping and progress. |
| `bibliography-view.ts` | `BibliographyView`: grid, filters, stats, detail panel and empty state. |
| `bibliography-lookup.ts` | DOI/ISBN/keyword detection, input sanitization and the `bibliography_lookup` command wrapper. |
| `pdf-view.ts` | `PdfReaderView`: page rendering, zoom, text layer, search and capture. |
| `all-pages.ts` | Pure sorting, filtering and date formatting for the all-pages table. |
| `virtual-list.ts` | Offset math and virtualized rendering for long lists. |

### Stores (`src/store/`)

| File | Responsibility |
| --- | --- |
| `vault.ts` | `VaultStore`: the in-memory page collection, localStorage cache, metadata-only boot, LRU block loading, external deltas and persistence. |
| `review-progress.ts` | `ReviewProgressStore`: append/merge/undo review events stored in `.sinnotas/progress/reviews.json`. |
| `flashcard-decks.ts` | Deck schema, validation, limits and pure mutations. |
| `flashcard-deck-storage.ts` | `FlashcardDeckRepository`: reads/writes `.sinnotas/flashcards/decks.json` through Tauri. |
| `content-search.ts` | `ContentSearchIndex`, folded text, match location and snippets for the omnibar. |
| `wikilinks.ts` | Outgoing wikilink extraction. |
| `sidebar-selection.ts` | Pinned/recent page selection rules. |
| `export.ts` | Plain-text serialization, Markdown ZIP/CSV/JSON export and print-to-PDF. |

### Services (`src/services/`)

| File | Responsibility |
| --- | --- |
| `updater.ts` | Update state machine, platform detection (desktop, Android, Store), install-kind detection and subscription API. |
| `update-utils.ts` | Version parsing/comparison, manifest validation, URL allow-listing and byte formatting. |

### Shared frontend modules

| File | Responsibility |
| --- | --- |
| `types.ts` | Shared interfaces: `BlockNode`, `PageData`, `Flashcard`, `KanbanTask`, snapshots, backlinks, etc. Start here before changing a data shape. |
| `i18n.ts` | Spanish-source translation maps for English and Chinese, `translate()`, language preference and dynamic localization. |
| `typography.ts` | Font-size definitions, storage, clamping, migration and per-target application. |
| `app-mode.ts` | Surface selection and the saved review/editor requests. |
| `gamepad.ts` | Controller presets and the `GamepadListener` used by the review mode. |
| `periodic-elements.ts` | Chemistry data and molecule stage definitions. |
| `deck-title.ts` | Deck-path parsing, normalization and validation. |
| `splash.ts` | Hides the boot splash. |
| `vite-env.d.ts` | Vite environment types. |

### Styles and the visual system

All styling is plain CSS: no Sass, no CSS modules, no Tailwind. Files are loaded by `desktop.ts` in this order, and order matters:

1. `katex/dist/katex.min.css` — math.
2. `src/style.css` — base tokens (`--ls-*`), layout, sidebar, editor, all component styles and responsive rules.
3. `src/material-aero.css` — Material 3 “Aero” layer: derives `--md-*` / `--ma-*` roles from `--ls-accent`.
4. `src/theme-lino.css` — light, flat visual theme. Redefines tokens under `:root[data-visual="lino"]`.
5. `src/theme-dracula.css` — dark Dracula theme. Same token-layer strategy under `:root[data-visual="dracula"]`.
6. `src/pdf.css` — PDF reader and split-view styles.
7. `src/bibliography.css` — bibliography view styles, imported next to the bibliography module logic.

`src/mobile/mobile.css` is only loaded by `mobile/review-app.ts`.

The theme system is a **token layer**, not a set of duplicated components:

- `--ls-*` are the semantic tokens: surfaces, text roles, borders, accent, accent tint, radii and font scale.
- `--md-*` and `--ma-*` are Material roles derived from `--ls-accent` with `color-mix()`.
- `theme-lino.css` and `theme-dracula.css` only redefine tokens under `[data-visual]`; they should not re-implement components.
- `style.css` still contains the base component rules. Add new component styles there (or in the view-specific file) using existing tokens.

`style.css` is divided by banner comments, including **TYPOGRAPHY MODES**, **COLLAPSIBLE SIDEBAR**, **MAIN WORKSPACE**, **SETTINGS DROPDOWN MENU**, **VIEWS CONTAINER**, **CANVAS & OUTLINER**, **OUTLINER BLOCKS**, **MATH & CODE**, **BACKLINKS / REFERENCES**, **CONTEXT MENUS**, **KANBAN BOARD VIEW**, **PAGE HISTORY MODAL**, **CONCEPT MAP MODAL**, **TOAST NOTIFICATION**, **IMAGE OCCLUSION**, **VAULT MANAGER**, **KEYBOARD SHORTCUTS MODAL**, **FLASHCARDS**, **GRAPH VIEW**, **ALL PAGES & JOURNALS**, **GRAPH SETTINGS**, **TRANSICIONES SUAVES**, **MÓVIL: EDITOR COMPLETO**, **ACTUALIZACIONES** and **SIDEBAR EN MOSAICO**.

Practical rules:

- Prefer `color-mix(in srgb, var(--ls-accent) …)` over hard-coded colors so themes and accent changes keep working.
- Use `var(--ma-radius-*)` and the existing spacing/font tokens instead of new magic numbers.
- If a value must change per theme, add a token override to the theme files rather than a selector in `style.css`.
- Pressed states should be accent-tinted (`--ls-accent-subtle` or a translucent `color-mix`), not a generic darkening.
- Respect `prefers-reduced-motion` and keep focus-visible styles.
- For a new view, give it a `#view-<name>` section in `index.html`, a `.view-panel` class, styles in `style.css` (or its own CSS file imported by `desktop.ts`) and a nav item with the matching `data-view`.

### HTML shell (`index.html`)

`index.html` is not generated. It contains:

- the splash markup and its inline critical CSS;
- the left sidebar: header, review-mode buttons, search box, navigation icons, recent pages and footer;
- the settings dropdown (`#settings-dropdown-menu`) and its tabs;
- one `<section class="view-panel" id="view-…">` per view: `editor`, `journals`, `flashcards`, `graph`, `kanban`, `all-pages`, `bibliography`, `pdf`;
- shared modals and context menus;
- `<script type="module" src="/src/main.ts">`.

View containers are intentionally empty or skeletal; the TypeScript views build their contents. IDs and `data-*` attributes are a contract with `desktop.ts`, so renaming one means updating every `querySelector`/`getElementById` reference.

### Internationalization (`src/i18n.ts`)

The source language is **Spanish**. `translate("Texto en español")` looks the string up in `englishBySpanish` and `chineseBySpanish` and returns the current language, falling back to the Spanish key. `initializeLocalization()` also translates nodes added later via a `MutationObserver`, which is why dynamically created views can call `translate()` directly.

When adding UI text:

1. Write the Spanish string as the key.
2. Add the English and Chinese entries.
3. Use `translate()` for static labels; note content and Markdown samples stay untranslated.
4. Check long labels in narrow windows and on the mobile surface.

### Rust backend (`src-tauri/src/`)

`main.rs` only calls `sin_notas_lib::run()`. Nearly everything lives in `lib.rs`:

- **Storage abstraction** — `VaultStorage` with two implementations: `FsStorage` (normal filesystem) and `SafStorage` (Android Storage Access Framework). All vault reads and writes go through this trait, so desktop and Android share the same command layer.
- **Active vault state** — `ActiveVault`, `ApprovedVaultRoots`, `VaultCacheState` and the metadata cache runtime. Approved roots are persisted in the app config directory as `approved-vault-roots.json`; without a configured vault the app uses `app_data_dir()`.
- **Path validation** — `resolve_vault_path`, `resolve_note_path`, `resolve_openable_note`, `is_safe_note_component`. These reject traversal, absolute escapes, NUL bytes, reserved folders (`.sinnotas`, legacy `chronos`/`progress`, `.git`), temporary files and unsafe Android URIs. Use them instead of joining paths manually.
- **Markdown and block model** — `BlockNode`, `PageData`, `parse_markdown_with_frontmatter`, `serialize_blocks_to_markdown`, `serialize_page_to_markdown`, frontmatter handling, stable content hashes and journal-date detection.
- **Vault scanning and cache** — `scan_vault`, `VaultCacheRuntime`, delta computation, content search and graph-link extraction. The persistent cache is handled by `metadata_cache.rs`.
- **Commands** — the `#[tauri::command]` functions registered in `generate_handler!` near the end of `lib.rs`. They are grouped below.
- **Snapshot subsystem** — configuration, scheduling, pruning, restore and migration under `.sinnotas/chronos/`.
- **Images and attachments** — save/drop images, resolve asset paths, unused-attachment cleanup.
- **Fonts and rendering policy** — `list_system_fonts()` (cached, runs off the UI thread) and `software_rendering_active()` / `set_native_scrollbar_style()` for VM/no-GPU and Linux scrollbars.
- **Installer/updater helpers** — `save_android_apk()`, `desktop_install_kind()`.

Command groups:

| Group | Commands |
| --- | --- |
| Vault lifecycle | `pick_vault_root`, `load_vault`, `vault_sync_state` |
| Notes | `read_pages_cached`, `read_page`, `save_page`, `rename_page`, `delete_page`, `read_note_created_times`, `export_page_text`, `open_note_with_default_app` |
| Search and links | `search_content`, `graph_links`, `find_backlinks` |
| Review and decks | `read_review_progress`, `write_review_progress`, `read_flashcard_decks`, `write_flashcard_decks` |
| Page history | `read_page_revisions`, `write_page_revisions` |
| Snapshots | `get_snapshot_state`, `activate_snapshots`, `disable_snapshots`, `list_active_snapshot_notes`, `tick_snapshots`, `read_note_snapshots`, `restore_snapshot`, `delete_note_snapshots`, `delete_all_snapshots`, `migrate_legacy_snapshots` |
| PDF | `pdf_list`, `pdf_open`, `pdf_render_page`, `pdf_import`, `pdf_page_text`, `pdf_set_expiry`, `pdf_delete`, `pdf_save_capture`, `pdf_unlink` |
| Images | `resolve_image_path`, `read_image_data`, `save_image`, `save_dropped_image`, `delete_unused_attachments` |
| Metadata and system | `bibliography_lookup`, `list_system_fonts`, `desktop_install_kind`, `save_android_apk`, `software_rendering_active`, `set_native_scrollbar_style` |

Subsystems:

| File | Responsibility |
| --- | --- |
| `metadata_cache.rs` | Persistent per-note cache in `<vault>/.sinnotas_cache.bin` (bincode). Validates every entry as untrusted input, re-parses only notes whose size/mtime changed, never follows symlinks and writes atomically. |
| `bibliography_lookup.rs` | Server-side DOI/ISBN/keyword lookup. Network requests happen in Rust, never in the WebView; responses are sanitized before reaching the frontend. |
| `pdf/mod.rs` | Public PDF API. The UI receives metadata and PNG pages, never the PDF or raw RGBA. |
| `pdf/engine.rs` | Lazy PDFium loading from `resources/pdfium/<os>-<arch>/`, page inspection, PNG rendering and text extraction. |
| `pdf/storage.rs` | Vault PDFs in `assets/pdfs/`, external document links in `.sinnotas/documents/links.json`, expiry and capture saving. |
| `perf_e2e_tests.rs` | Optional end-to-end performance tests. |

### On-disk data

Everything user-authored stays in the vault. Internal state is namespaced:

| Path | Contents |
| --- | --- |
| `<vault>/<note>.md` | Notes. The only user-facing source of truth. |
| `<vault>/.sinnotas_cache.bin` | Binary metadata cache (blocks, frontmatter, links, card summary). Safe to delete; it is rebuilt. |
| `<vault>/.sinnotas/progress/reviews.json` | Review journal (FSRS events, undoable). |
| `<vault>/.sinnotas/flashcards/decks.json` | Custom decks and tombstones. |
| `<vault>/.sinnotas/revisions/<relative-path>.json` | Per-note edit history. |
| `<vault>/.sinnotas/chronos/<note-key>/` | Snapshot files and `config.json` for automatic/manual snapshots. |
| `<vault>/.sinnotas/documents/links.json` | External PDF links (the original file is never modified). |
| `<vault>/assets/pdfs/` | PDFs copied or imported into the vault. |
| `<vault>/assets/` | Images and other attachments referenced by notes. |

Browser-stored preferences (all prefixed `sinnotas-`) live in `localStorage`: theme, visual style, accent, typography, page width, language, deck filters, Kanban hidden-completed, Pomodoro settings, graph settings, settings tab, vault registry (`sinnotas-vault-registry-v1`) and the in-memory page cache (`sinnotas-vault-v4`). The Rust app config directory stores `approved-vault-roots.json`. The Android updater writes `SinNotas-update.apk` to the app cache before moving it to Downloads.

### Tauri configuration and security boundaries

| Path | Contents |
| --- | --- |
| `src-tauri/tauri.conf.json` | Window (undecorated, 1240×840), strict CSP and dev CSP, asset-protocol scope (`$APPDATA/**`), bundle targets, icons, PDFium resource glob, updater endpoint/public key and Windows install mode. |
| `src-tauri/capabilities/default.json` | Minimum permissions shared by all platforms: core window controls, OS platform, clipboard read, opening the repository URLs and writing the temporary APK. |
| `src-tauri/capabilities/desktop.json` | Desktop-only updater and process-restart permissions. |
| `src-tauri/capabilities/android.json` | Android-only HTTP scope limited to this repository's GitHub release assets. |
| `src-tauri/Cargo.toml` | Dependencies and features. `default = ["updater"]`; `--no-default-features --features microsoft-store` builds the read-only MSIX variant. |
| `src-tauri/resources/pdfium/` | Native PDFium libraries downloaded by `scripts/fetch-pdfium.sh`; never committed. |

If a change needs a new Tauri permission, add the narrowest scope to the relevant capability file and explain it in the pull request. Do not broaden `default-src` or the asset scope without a security rationale.

### Build, automation and packaging

| Path | Purpose |
| --- | --- |
| `scripts/fetch-pdfium.sh` | Downloads the PDFium library for the current OS/architecture. |
| `scripts/benchmark-cache.sh`, `scripts/bench.ts` | Startup and cache benchmarks. |
| `scripts/package-linux.sh` | Linux packaging helper. |
| `scripts/patch-android-safe-area.mjs` | Patches the generated Android project for edge-to-edge safe areas (`npm run android:patch`). |
| `scripts/android-icons.mjs` | Generates Android launcher icons (`npm run android:icons`). |
| `scripts/prepare-release-assets.mjs` | Builds `latest.json` and release assets. Tested by `prepare-release-assets.test.ts`. |
| `scripts/prepare-store-icons.mjs`, `scripts/prepare-store-msix.mjs` | Microsoft Store assets and MSIX preparation. |
| `scripts/generate-keystore.sh`, `scripts/sign-local.sh`, `scripts/snap-store-credential.sh` | Signing and store credentials. |
| `packaging/flatpak/` | Flatpak manifest and AppStream metadata. |
| `packaging/windows-store/` | MSIX manifest template. |
| `.github/workflows/ci.yml` | Type-check, tests, build and Rust checks. |
| `.github/workflows/build.yml` | Multi-platform build artifacts. |
| `.github/workflows/release.yml` | Signed releases and update manifest. |
| `.github/workflows/package-linux.yml` | Linux packages. |
| `.github/workflows/store-msix.yml` | Microsoft Store pipeline. |
| `docs/` | Technical reference (`SinNotas.md`), user guides, release/key store notes and feature checklists. Start with `docs/SinNotas.md` for architecture-level detail and the matching `CHECKLIST-*` before touching a subsystem. |

Generated directories (`dist/`, `src-tauri/target/`, `src-tauri/gen/android`, `src-tauri/gen/apple`) and downloaded binaries are not committed. CI regenerates the Android project from scratch.

### Common changes: where to start

- **New view or sidebar entry** — add the `<section id="view-…">` to `index.html`, a `.nav-item` with the same `data-view`, the view module in `src/views/`, wiring in the **NAVIGATION & VIEWS** section of `desktop.ts`, and styles in `style.css` (or a new imported CSS file).
- **New setting** — add the control to the settings markup, read/write it in the **THEME & TYPOGRAPHY MANAGEMENT** or relevant `desktop.ts` section, persist it under a `sinnotas-*` key, and translate the labels.
- **New Rust command** — implement it in `lib.rs`, validate every path with the existing resolvers, add it to `generate_handler!`, expose a typed wrapper in `src/`, and add unit tests for the validation rules. If it crosses a permission boundary, update the capability files.
- **New persisted field** — extend `types.ts`, the Rust structs in `lib.rs` / `metadata_cache.rs`, the cache invalidation logic and the serializer, then add migration/validation tests. Old caches must be discarded safely.
- **New theme** — add a token-only CSS file under `src/`, import it after the existing themes in `desktop.ts`, register the `data-visual` value in the appearance settings, and verify light/dark and accent variants without duplicating component rules.
- **New bibliography field** — add the frontmatter constant in `views/bibliography.ts`, mapping, validation, detail UI, lookup sanitization and tests.
- **New keyboard shortcut** — register it in the **GLOBAL KEYBOARD SHORTCUTS** section (desktop) or the review key handler (mobile), make sure it does not fire while typing in an input, and document it in the shortcuts modal.
- **New translation** — add the Spanish key plus English/Chinese entries in `i18n.ts`; never hard-code translated text in views.
- **Editor behavior** — put pure tree logic in `editor/tree-engine.ts` and its test, then wire the DOM/caret behavior in the **OUTLINER EDITOR** section of `desktop.ts`.

---

## Coding guidelines

### General

- Keep changes focused. Small pull requests are easier to review and safer to merge.
- Follow the style, naming and structure of the surrounding code.
- Prefer plain platform APIs and existing helpers over new dependencies.
- Update tests and documentation in the same change as the behavior they describe.
- Do not commit generated bundles, native PDFium binaries, keystores, secrets or personal vault data.

### Frontend

- Use native TypeScript, HTML and CSS. **Do not introduce React, Tailwind or a component framework.**
- Keep user-visible text translatable. The source strings are Spanish; add the English and Chinese entries in `src/i18n.ts` (`englishBySpanish` and `chineseBySpanish`) when you add or change a label.
- Preserve keyboard navigation, focus visibility and ARIA attributes. Many controls are already reachable by keyboard; do not regress that.
- Sanitize untrusted input. Clipboard content, Markdown, wikilinks, bibliography metadata and file names are all untrusted.
- For editor changes, test both the normal and split view, and check that indentation, selection and undo/redo still behave.

### Rust and filesystem access

- All file operations must stay inside the active vault. Use `resolve_vault_path` instead of joining paths by hand.
- Reject `..`, absolute paths outside the root, NUL bytes, symlinks escaping the vault and Android URIs.
- Validate file types and sizes at the backend boundary, not only in the UI.
- Keep commands small and return structured errors; do not leak absolute paths of linked PDFs to the frontend.
- Run `cargo clippy --all-targets -- -D warnings` before opening a pull request. `cargo fmt` is recommended.

### Security-sensitive areas

Treat these as security boundaries:

- `src/editor/paste-sanitizer.ts` — clipboard whitelist.
- `src/editor/url-safety.ts` — URL and wikilink validation.
- Markdown rendering and review HTML — escape and sanitize with DOMPurify before `innerHTML`.
- Image-occlusion regions — validate and draw with `createElementNS`/`setAttribute`, never string-interpolated HTML.
- Rust path resolution, PDF linking and the updater signature flow.

If your change touches any of them, explain the threat model in the pull request and add a regression test.

### Graph changes

The graph has its own stable interaction contract. If you modify it:

1. Add or update unit tests in `src/views/graph-*.test.ts`.
2. Run the live harness at `http://localhost:1420/graph-harness.html` and confirm `HARNESS PASS`.
3. Check selection with alternating clicks, background click to clear, node dragging, panning, wheel zoom, color propagation and stability after the simulation settles.

See [docs/SinNotas.md#grafo-y-mapa-conceptual](docs/SinNotas.md#grafo-y-mapa-conceptual) for the full checklist.

### Documentation

- Keep `README.md` as the entry point and `docs/SinNotas.md` as the technical reference.
- If you change a workflow, update the relevant checklist in `docs/`.
- If you change a user-facing command, update both the README and the in-app help where appropriate.
- Prefer concrete examples and exact commands over vague descriptions.

---

## Testing checklist

Before opening a pull request, run the checks that apply to your change:

```bash
# Frontend
npm test
npx tsc --noEmit
npm run build

# Rust backend
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings

# Graph-only changes
npm run dev
# open http://localhost:1420/graph-harness.html and confirm HARNESS PASS
```

If you changed startup, metadata parsing or caching, also run the cache benchmark:

```bash
scripts/benchmark-cache.sh
```

If you changed Android code, note that CI regenerates `src-tauri/gen/android` from scratch. Do not rely on a local generated project being committed.

---

## Commit and pull-request process

1. **Fork** the repository and create a branch from `master`:

   ```bash
   git checkout master
   git pull origin master
   git checkout -b fix/editor-selection
   ```

2. **Use a descriptive branch name**, such as `fix/kanban-drag`, `feat/deck-filter` or `docs/contributing-guide`.

3. **Write clear commits.** The project follows a Conventional Commits-style pattern:

   ```text
   feat(kanban): add tasks to the daily note
   fix(linux): avoid WebKitGTK SIGKILL on GNOME 51
   docs: add contributing guide
   ```

4. **Open a pull request** that explains:
   - what problem the change solves;
   - how it was implemented;
   - how it was tested;
   - any screenshots or video for UI changes;
   - any security, migration or compatibility implications.

5. **Keep the PR up to date** with `master` and respond to review comments. CI must pass before merge.

Do not bump the version, create release tags or edit release secrets as part of a normal pull request. Releases are handled separately by maintainers following [docs/RELEASE.md](docs/RELEASE.md).

---

## Translations

The interface source language is Spanish. To add or update a translation:

1. Find the Spanish source string in `src/i18n.ts`.
2. Add the English and/or Chinese entry to the corresponding map.
3. Check the string in the running app, including long labels and narrow windows.
4. Avoid translating keyboard shortcuts, product names or file extensions.

If a string is intentionally not translated (for example a user note or a Markdown sample), leave it as-is.

---

## Reporting security issues

Please do **not** open a public issue for a vulnerability. Contact the maintainer privately through GitHub (or use GitHub private vulnerability reporting if it is enabled for the repository), and include steps to reproduce, affected versions and impact.

The security model and existing boundaries are described in [PRIVACY_POLICY.md](PRIVACY_POLICY.md) and [docs/SinNotas.md#seguridad](docs/SinNotas.md#seguridad).

---

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE), the same license as the project.
