# SinNotas

SinNotas is a local, self-contained note-taking app for organizing ideas as a hierarchical outliner. Pages are stored as Markdown files inside the active vault.

<img width="1600" height="852" alt="screenshot" src="https://github.com/user-attachments/assets/266714c0-f454-42d1-9519-7a80c930f48d" />

<img width="1241" height="753" alt="screenshot" src="https://github.com/user-attachments/assets/2ecd2084-3e8e-4ef4-8165-abe40b2c9dcd" />

## Technologies

- **Desktop application:** Tauri v2.
- **Backend and file access:** Rust.
- **Interface:** native TypeScript, HTML and CSS.
- **Frontend development and bundling:** Vite.

The current frontend uses neither React nor Tailwind CSS.

## Features

- **Hierarchical editor:** create and organize bullets, nest blocks, drag them to reorder, and select multiple ones to copy, cut, paste with their hierarchy, or delete them.
- **Slash commands:** insert Markdown tables, H1–H6 headings, images, tasks and Cloze cards; also apply text and background colors.
- **Markdown:** renders inline formatting for bold, italics, underline, highlight and wikilinks. Wikilinks let you open pages and look up backlinks.
- **Inline tags:** `#tag` labels are highlighted with a pill in the theme's accent color.
- **Tables:** tables are stored as native Markdown; Cloze text `==...==` also works inside table cells. Includes full graphical editing with a context menu to add/remove rows and columns, plus drag-and-drop reordering of rows and columns.
- **Flashcards:** basic, Cloze and image occlusion cards with FSRS-4.5 scheduling; includes focus mode, a Pomodoro timer, review statistics and a progress visualization that grows with your practice. New cards go through a learning phase (short fixed steps: 1 min, 10 min) before graduating to FSRS review, avoiding wide initial interval jumps that act as false positives; the learning state is persisted so a card does not jump back to Review after reloading. From the Flashcards settings, reviews can be filtered by note (each note acts as a deck with its own cards) so you don't review everything at once.
- **Image occlusion:** draw rectangles, ellipses and polygons, move, resize and rotate areas, add hints, and keep those transformations in the block's Markdown metadata.
- **Images:** supports PNG, JPG/JPEG, WebP, SVG, GIF and BMP. Inserted images are saved to the vault's `assets/` folder.
- **Kanban tasks:** sort tasks as pending, in progress or completed; move them between columns and hide the completed ones.
- **Concept map / Graph:** graph view with enhanced physics (D3/Obsidian-like model), navigation and visualization of relationships between pages. Interaction stays alive indefinitely —selection with alternating clicks, click on the background to clear, node dragging, panning (middle/right button), wheel zoom and double-click to reset— and custom node colors propagate to neighbors by influence. See [docs/SinNotas.md#grafo-y-mapa-conceptual](docs/SinNotas.md#grafo-y-mapa-conceptual).
- **Version history (snapshots):** save and restore page snapshots; settings let you delete all snapshots at once.
- **Fast startup:** local vaults keep a persistent binary metadata cache (`.sinnotas_cache.bin`) so only new or modified notes are parsed on launch. A native filesystem watcher applies external edits incrementally. See [docs/SinNotas.md#cache-de-metadatos-y-watcher](docs/SinNotas.md#cache-de-metadatos-y-watcher).
- **External vaults:** open Markdown folders through the directory picker and navigate their pages and subfolders.
- **Journals and pages:** create daily journals by date, browse all pages and check version history.
- **Export:** export the current page as plain `.txt` text.
- **Sync:** use your favorite sync service to keep notes up to date across devices.
- **Adaptable UI:** light and dark themes, five accent colors, configurable fonts (system font separate from the font mosaic), glow-intensity control (with 3 positions/extended range), and a Spanish/English/Chinese interface on both desktop and the mobile review app.
- **Repository link:** a button in the settings to visit the project's GitHub repository directly.

## Editor shortcuts

- **Enter:** splits the block at the caret or creates the next bullet.
- **Shift + Enter:** line break inside the same block.
- **Tab:** indents the block (or the selected bullets).
- **Shift + Tab:** outdents the block (or the selected bullets).
- **Alt + Right / Alt + Left:** indent / outdent the selected bullets.
- **Delete / Backspace:** deletes the selected bullets.
- **Ctrl/Cmd + C:** copies the selected bullets (when no text is selected).
- **Ctrl/Cmd + X:** cuts the selected bullets (when no text is selected).
- **Ctrl/Cmd + V:** paste. The clipboard is untrusted data: only indentation, bold, italic, underline, strikethrough, inline code and lists survive; colors, font sizes, links attributes and rich HTML are always discarded.
- **Ctrl + Shift + V:** paste without formatting (plain text only).
- **Ctrl/Cmd + Z:** undo. **Ctrl/Cmd + Y** (or **Ctrl/Cmd + Shift + Z**): redo.
- **Ctrl/Cmd + B:** collapse / expand the sidebar.
- **Ctrl/Cmd + K:** quick search and quick page creation (omnibar).
- **Up / Down arrows:** move the caret between blocks when it is at the start/end of the current block.
- **Botón ? (Ayuda):** abre el modal con todos los atajos de teclado desde el encabezado del editor.

## Clipboard security

Pasted content goes through a whitelist pipeline (`src/editor/paste-sanitizer.ts`): all pasted attributes are ignored (`style`, colors, font sizes, `href`, `src`, event handlers), dangerous tags (script, iframe, form, media) are dropped, excessive blank lines are collapsed, and size limits are enforced. The result is always Markdown text inserted through the model, never raw clipboard HTML injected into the DOM, so the pre-rendered view of pasted LaTeX or code matches the active theme instead of the color of the app the content came from.

## Requirements

- **Node.js 22.12 or newer** (Vitest 5 requires it).
- Rust stable with `rustup`.

On CachyOS, Arch Linux, Manjaro, EndeavourOS

```bash
sudo pacman -S nodejs npm rust
```

Debian, Ubuntu, Linux Mint, Zorin, Pop!_OS and derivatives

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

> Debian and Ubuntu repositories often ship outdated Node and Rust versions. Install them with [nvm](https://github.com/nvm-sh/nvm) or [NodeSource](https://github.com/nodesource/distributions) (Node) and with `rustup` (Rust, see below).

Fedora, Nobara, RHEL and derivatives

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel nodejs npm
sudo dnf group install "c-development"
```

openSUSE (Tumbleweed and Leap)

```bash
sudo zypper up
sudo zypper in webkit2gtk3-devel libopenssl-devel curl wget file \
  libappindicator3-1 librsvg-devel nodejs npm
sudo zypper in -t pattern devel_basis
```

## Web development

```bash
npm install
npm run dev
```

Vite will show the local address in the terminal.

## Tests

```bash
npm test              # unit test suite (vitest)
npx tsc --noEmit      # type checking
npm run build         # production frontend build
```

Live test bench for the graph view (real interaction in a browser):

```bash
npm run dev
# open http://localhost:1420/graph-harness.html
```

The result appears on the page itself (`HARNESS PASS` expected, 17 gesture checks: selection, background, drag, pan, zoom, colors, stability after settle). After modifying the graph, both the test suite and the harness are mandatory; guidelines and the checklist live in [docs/SinNotas.md#grafo-y-mapa-conceptual](docs/SinNotas.md#grafo-y-mapa-conceptual).

Backend tests and lints:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Metadata cache benchmark

Generate a 5,000-note temporary vault and compare a cold startup (full Markdown
parse) with a warm startup (mtime sweep + bincode load):

```bash
scripts/benchmark-cache.sh
# or: cargo run --release --manifest-path src-tauri/Cargo.toml --example cache_benchmark -- 5000
```

The script prints cold/warm milliseconds and the speedup, then deletes the
temporary vault. See [docs/SinNotas.md#cache-de-metadatos-y-watcher](docs/SinNotas.md#cache-de-metadatos-y-watcher).

## Documentation

All project documentation lives in the single technical guide
[docs/SinNotas.md](docs/SinNotas.md). This README is the entry point. The guide
covers the architecture, editor and vault, FSRS/Learning mode, the paginated
mobile notes selector, Android safe area, desktop/Android updater, security,
performance, build and CI/release steps, current 0.2.4 release data and known
limitations.

## Tauri application

From the project root:

```bash
npm run tauri dev
```

## Build the AppImage (Linux)

```bash
npm run tauri -- build --bundles appimage
```

## Desktop updates on Linux

AppImage installs use the `linux-x86_64` entry in `latest.json`. Debian/Ubuntu
installs use the signed `linux-x86_64-deb` entry from 0.2.2 onward, so the app
can download and install the new `.deb` with `pkexec`/`sudo`. An existing
0.2.0/0.2.1 `.deb` install must install 0.2.2 manually once; later releases
update from the app. See [docs/SinNotas.md#actualizador](docs/SinNotas.md#actualizador).

Las releases 0.2.4 y 0.2.5 se publican como una prueba consecutiva del
actualizador de escritorio: instalar 0.2.4 y actualizar a 0.2.5 desde la app.

## Build on Windows

Prerequisites:
- [Node.js](https://nodejs.org/) (recommended with nvm-windows)
- [Rust](https://www.rust-lang.org/tools/install) with `rustup` (adds the MSVC target)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Visual Studio Build Tools with "Desktop development with C++")
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually present on modern Windows 10/11)

From PowerShell or CMD in the project root:

```bash
npm install
npm run tauri build
```

This generates the `.msi` and/or `.exe` (NSIS) installer under `src-tauri/target/release/bundle/`. If you only want to compile without producing installers, use `npm run tauri build -- --no-bundle`.

For Windows development:
```bash
npm install
npm run tauri dev
```

Desktop file operations are validated in the backend and limited to the active vault. The folder picker uses the Tauri permission `dialog:allow-open`; no global filesystem access is granted.

## Android application (review + full editor)

The APK for Android 13 or newer (`minSdkVersion` 33) opens in the review experience: question, answer, image occlusions, editing the active block and FSRS rating. From **Abrir páginas y editor** it can load the full desktop editor, including journals, Kanban, concept map and graph view. Both surfaces respect the Android status and navigation bars through the native safe-area bridge.

The **Repasar notas** selector paginates the vault notes at 20 per page and
renders each page in small animation-frame batches. This matches desktop and
keeps the modal responsive with thousands of notes; the draft selection is kept
while moving between pages, and searching returns to page 1.

```bash
# Local build (requires the Android SDK/NDK and the Rust targets)
npm ci
npm run tauri android init -- --ci
# `android init` regenerates gen/android, so reapply the native safe-area
# bridge that keeps the status/navigation bars from covering the app UI.
npm run android:patch
# `android init` creates the project with Tauri's default icons. Regenerate
# them so gen/android gets the real logo instead of a generic launcher icon.
npm run tauri icon src-tauri/icons/icon-manifest.json
VITE_APP_MODE=flashcards npm run tauri android build -- --apk --debug --target aarch64
```

Android Studio is not required: the SDK command-line tools, platform/build-tools,
NDK and a JDK 17+ are enough. Point `ANDROID_HOME` and `NDK_HOME` at the
installed SDK and NDK before running the commands. The debug APK is written to
`src-tauri/gen/android/app/build/outputs/apk/`; it is signed with the debug
key, so it cannot update an APK signed with the release key (uninstall the
release build first or install it with a different application ID).

If `src-tauri/gen/android` already contains an older safe-area patch, delete it
before running `android init`; the patch script refuses to reuse the old version
silently. This is only relevant for local builds: CI always regenerates the
project from scratch.

The `.github/workflows/ci.yml` workflow builds the APK on pushes/PRs and a signed release APK on `master` or by `workflow_dispatch`; it publishes it as a downloadable artifact but never creates a release. Publishing happens only from a `v*` tag through `.github/workflows/release.yml`. Signing secrets are isolated in the `sign_apk` step. To load the secrets, test without publishing and verify the signature, see [docs/SinNotas.md#ci-y-publicación](docs/SinNotas.md#ci-y-publicación); the full update system is described in [docs/SinNotas.md#actualizador](docs/SinNotas.md#actualizador).

Launch modes:

- `VITE_APP_MODE=flashcards`: forces the review view in any build.
- `VITE_APP_MODE=desktop`: forces the full application.
- No variable: Tauri detects `TAURI_ENV_PLATFORM=android|ios` (or a mobile user agent) and opens the review view; on desktop it opens the full application.

The review build mounts the review app first; the desktop editor is a separate dynamic chunk that loads only when the user opens **Abrir páginas y editor**. On first run, the APK seeds sample notes into the app's internal vault so FSRS, Cloze and occlusions can be tried without depending on the desktop app.

### Paths and Scoped Storage

The backend only accepts real paths inside the active vault root. `resolve_vault_path` rejects `..`, absolute paths outside the root, NUL bytes, symlinks escaping the vault and Android URIs (`content://`, `file://`, `http://`, etc.). The APK works over its internal vault; Scoped Storage URIs are not interpreted as file names and cannot read outside the authorized folder.

### Review HTML safety

Card Markdown is escaped and sanitized with DOMPurify before any `innerHTML`, on both desktop and the APK. Occlusion regions are validated and drawn with `createElementNS`/`setAttribute`, without interpolating user HTML. The backend additionally validates active SVG content before saving it.
