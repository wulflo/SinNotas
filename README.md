# SinNotas

Sin Notas es una aplicación local e independiente para tomar notas y organizar ideas como un outliner jerárquico. Las páginas se almacenan como archivos Markdown dentro del vault activo.

<img width="1600" height="852" alt="captura" src="https://github.com/user-attachments/assets/266714c0-f454-42d1-9519-7a80c930f48d" />

## Tecnologías

- **Aplicación de escritorio:** Tauri v2.
- **Backend y acceso a archivos:** Rust.
- **Interfaz:** TypeScript, HTML y CSS nativos.
- **Desarrollo y empaquetado del frontend:** Vite.

El frontend actual no utiliza React ni Tailwind CSS.

## Funcionalidades

- **Editor jerárquico:** crea y organiza bullets, anida bloques, arrástralos para reordenarlos y selecciona varios para copiarlos, cortarlos, pegarlos con su jerarquía o eliminarlos.
- **Comandos `/`:** inserta tablas Markdown, encabezados H1–H6, imágenes, tareas y tarjetas Cloze; también aplica colores de texto y fondo.
- **Markdown:** muestra formato inline para negrita, cursiva, subrayado, resaltado y wikilinks. Los wikilinks permiten abrir páginas y consultar referencias entrantes.
- **Etiquetas inline:** las etiquetas `#tag` se resaltan con un pill con el color de acento del tema.
- **Tablas:** guarda tablas en Markdown nativo; el texto Cloze `==...==` funciona también dentro de las celdas. Incluye edición gráfica completa con menú contextual para añadir/eliminar filas y columnas, y reordenamiento mediante arrastre de filas y columnas.
- **Flashcards:** tarjetas básicas, Cloze y oclusiones de imagen con programación FSRS-4.5; incluye modo focus, temporizador Pomodoro, estadísticas de repaso y un árbol que crece con la práctica. Las tarjetas nuevas pasan por una fase de aprendizaje (pasos fijos cortos: 1 min, 10 min, 1 día) antes de graduarse a repaso FSRS, evitando saltos iniciales de intervalo amplios que actúan como falso positivo. Desde los ajustes de Flashcards se puede filtrar el repaso por nota (cada nota actúa como un mazo con sus tarjetas) para no repasar todas a la vez.
- **Oclusión de imagen:** dibuja rectángulos, elipses y polígonos, mueve, cambia el tamaño y gira áreas, añade pistas y conserva sus transformaciones en los metadatos Markdown del bloque.
- **Imágenes:** admite PNG, JPG/JPEG, WebP, SVG, GIF y BMP. Las imágenes insertadas se guardan en `assets/` del vault.
- **Tareas Kanban:** clasifica tareas como pendientes, en curso o completadas; permite moverlas entre columnas y ocultar las completadas.
- **Mapa conceptual / Grafo:** vista de grafo con física mejorada (modelo tipo D3/Obsidian), navegación y visualización de relaciones entre páginas. La interacción permanece activa indefinidamente —selección con clicks alternos, click en fondo para cerrar, arrastre de nodos, pan (botón central/derecho), zoom con rueda y doble click para restablecer— y los colores personalizados de nodo se propagan a los vecinos por influencia. Ver [docs/graph-view.md](docs/graph-view.md).
- **Historial de versiones (snapshots):** guarda y restaura snapshots de páginas; desde los ajustes se pueden borrar todos los snapshots de una vez.
- **Vaults externos:** abre carpetas Markdown mediante el selector de directorios y navega por sus páginas y subcarpetas.
- **Diarios y páginas:** crea diarios por fecha, explora todas las páginas y consulta el historial de versiones.
- **Exportación:** exporta la página actual como texto plano `.txt`.
- **Sincronización:** usa tu servicio de sincronización favorito para sincronizar tus notas entre dispositivos.
- **Interfaz adaptable:** incluye temas claro y oscuro, cinco colores de acento, tipografías configurables (separadas entre tipografía del sistema y mosaico de fuentes), control de intensidad de glow (con 3 posiciones/rango ampliado), e interfaz en español e inglés.
- **Enlace al repositorio:** botón en la configuración para visitar directamente el repositorio de GitHub del proyecto.

## Atajos del editor

- **Enter:** divide el bloque en el cursor o crea un bullet siguiente.
- **Tab:** indenta el bloque.
- **Shift + Tab:** desindenta el bloque.

## Requisitos

En CachyOS, Arch Linux, Manjaro, EndeavourOS

```bash
sudo pacman -S nodejs npm rust
```

Debian, Ubuntu, Linux Mint, Zorin, Pop!_OS y derivadas

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

> Los repositorios de Debian y Ubuntu suelen traer versiones antiguas de Node y Rust. Instálalos con [nvm](https://github.com/nvm-sh/nvm) o [NodeSource](https://github.com/nodesource/distributions) (Node) y con `rustup` (Rust, ver más abajo).

Fedora, Nobara, RHEL y derivadas

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel nodejs npm
sudo dnf group install "c-development"
```

openSUSE (Tumbleweed y Leap)

```bash
sudo zypper up
sudo zypper in webkit2gtk3-devel libopenssl-devel curl wget file \
  libappindicator3-1 librsvg-devel nodejs npm
sudo zypper in -t pattern devel_basis
```

## Desarrollo web

```bash
npm install
npm run dev
```

Vite mostrará la dirección local en la terminal.

## Pruebas

```bash
npm test              # suite unitaria (vitest)
npx tsc --noEmit      # tipos
npm run build         # build de producción frontend
```

Prueba en vivo de la vista de grafo (interacción real en navegador):

```bash
npm run dev
# abrir http://localhost:1420/graph-harness.html
```

El resultado aparece en la propia página (`HARNESS PASS` esperado, 17 comprobaciones de gestos: selección, fondo, arrastre, pan, zoom, colores, estabilidad tras el settle). Después de modificar el grafo es obligatorio pasar tanto la suite como el harness; las directrices y el checklist están en [docs/graph-view.md](docs/graph-view.md).

## Documentación técnica

| Documento | Contenido |
| --- | --- |
| [docs/graph-view.md](docs/graph-view.md) | Arquitectura de la vista de grafo, bucles de render/física, directrices anti-regresión (evitar freezes) y banco de pruebas en vivo |
| [docs/security-audit.md](docs/security-audit.md) | Auditoría de seguridad por fases (backend Rust, frontend, CI/APK, SAF, grafo), hallazgos corregidos y decisiones |
| [docs/RELEASING.md](docs/RELEASING.md) | Publicación de la APK firmada: secretos, keystore y carga inicial |
| [docs/ci-release-diagnosis.md](docs/ci-release-diagnosis.md) | Bitácora histórica del diagnóstico de la CI de release |
| [docs/phase4-saf-plan.md](docs/phase4-saf-plan.md) | Plan de bóvedas externas en Android (Storage Access Framework) |

## Aplicación Tauri

Desde la raíz del proyecto:

```bash
npm run tauri dev
```

## Compilar AppImage (Linux)

```bash
npm run tauri -- build --bundles appimage
```

## Compilar en Windows

Requisitos previos:
- [Node.js](https://nodejs.org/) (recomendado con nvm-windows)
- [Rust](https://www.rust-lang.org/tools/install) con `rustup` (añade el target para MSVC)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Visual Studio Build Tools con "Desarrollo para escritorio con C++")
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (suele venir en Windows 10/11 modernos)

Desde PowerShell o CMD en la raíz del proyecto:

```bash
npm install
npm run tauri build
```

Esto generará el instalador `.msi` y/o `.exe` (NSIS) en `src-tauri/target/release/bundle/`. Si solo deseas compilar sin generar instaladores, puedes usar `npm run tauri build -- --no-bundle`.

Para desarrollo en Windows:
```bash
npm install
npm run tauri dev
```

Las operaciones de archivos de escritorio se validan en el backend y se limitan al vault activo. El selector de carpetas utiliza el permiso Tauri `dialog:allow-open`; no se concede acceso global al sistema de archivos.

## Aplicación Android (solo repaso)

La APK de Android 13 o superior (`minSdkVersion` 33) monta únicamente la experiencia de repaso: pregunta, respuesta, oclusiones de imagen, edición del bloque activo y calificación FSRS. No inicializa el editor, los diarios, Kanban, el mapa conceptual ni la vista de grafo.

```bash
# Compilación local (requiere Android SDK/NDK y los targets de Rust)
npm ci
npm run tauri android init -- --ci
VITE_APP_MODE=flashcards npm run tauri android build -- --apk --debug
```

El flujo `.github/workflows/ci.yml` compila el APK (debug en pushes/PRs y release firmado en tags `v*`) y publica el resultado como artefacto descargable. Los secretos de firma se aíslan en el paso `sign_apk`. Para cargar los secretos, probar sin crear un release y verificar la firma, consulta [docs/RELEASING.md](docs/RELEASING.md).

Modos de arranque:

- `VITE_APP_MODE=flashcards`: fuerza la vista de repaso en cualquier build.
- `VITE_APP_MODE=desktop`: fuerza la aplicación completa.
- Sin variable: Tauri detecta `TAURI_ENV_PLATFORM=android|ios` (o un user agent móvil) y abre la vista de repaso; en escritorio abre la aplicación completa.

En la compilación de repaso, Vite elimina la rama de escritorio del bundle. La primera ejecución de la APK siembra notas de ejemplo en el vault interno de la aplicación para poder probar FSRS, Cloze y oclusiones sin depender del escritorio.

### Rutas y Scoped Storage

El backend solo acepta rutas reales dentro de la raíz del vault activo. `resolve_vault_path` rechaza `..`, rutas absolutas fuera de la raíz, bytes NUL, enlaces simbólicos que escapan del vault y URIs de Android (`content://`, `file://`, `http://`, etc.). La APK trabaja sobre su vault interno; las URIs de Scoped Storage no se interpretan como nombres de archivo ni permiten leer fuera de la carpeta autorizada.

### Seguridad del HTML de repaso

El Markdown de las tarjetas se escapa y se sanea con DOMPurify antes de cualquier `innerHTML`, tanto en escritorio como en la APK. Las regiones de oclusión se validan y se dibujan con `createElementNS`/`setAttribute`, sin interpolar HTML del usuario. El backend además valida el contenido activo de los SVG antes de guardarlos.
