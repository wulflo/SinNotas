# Licencias de terceros

SinNotas se distribuye bajo la licencia MIT ([`LICENSE`](LICENSE)). Este
documento recoge las licencias de los componentes de terceros que se
empaquetan, enlazan o ejecutan con la aplicación.

> **Alcance.** Se incluyen las dependencias de runtime del frontend y del
> backend, el binario nativo de PDFium y las fuentes de KaTeX. Quedan fuera las
> herramientas que solo intervienen en la compilación: `devDependencies` de
> npm (Vite, TypeScript, Vitest, etc.), `build-dependencies` de Cargo
> (`tauri-build`), los crates `proc-macro` y los scripts de CI. También se
> excluyen los paquetes que solo aportan tipos o CLI y no llegan al bundle
> (`@types/trusted-types` y `commander`).
>
> **Licencia aplicada.** Cuando un componente ofrece varias licencias
> alternativas (por ejemplo `MIT OR Apache-2.0`), SinNotas elige la opción
> permisiva que aparece en la columna «Licencia aplicada». Los textos completos
> de todas las licencias aplicadas están al final del documento.

## Resumen

| Componente | Versión | Licencia | Uso en SinNotas |
| --- | --- | --- | --- |
| SinNotas | 0.5.3 | MIT | Aplicación |
| Tauri | 2.12.5 | Apache-2.0 OR MIT | Shell nativo |
| Dependencias npm de runtime | 13 paquetes | MIT / Apache-2.0 / BSD-3-Clause / MPL-2.0 | Frontend |
| Dependencias Rust de runtime | 507 crates de terceros (unión de todas las plataformas) | MIT / Apache-2.0 / BSD-3-Clause / ISC / Zlib / BSL-1.0 / MPL-2.0 / Unicode-3.0 / CC0-1.0 / CDLA-Permissive-2.0 | Backend |
| PDFium (binario nativo) | build 8125 / Chromium 158 | BSD-3-Clause + Apache-2.0 | Lector PDF |
| Empaquetado `pdfium-binaries` | build 8125 | MIT | Envoltorio del binario |
| `pdfium-render` | 0.9.5 | MIT OR Apache-2.0 | Enlace Rust a PDFium |
| `ts-fsrs` | 6.0.0 | MIT | FSRS-7 |
| `@open-spaced-repetition/srs-kit` | 1.0.0 | BSD-3-Clause | Primitivas de FSRS |
| `fsrs-rs` | 7.0.0 (commit `9fb0392`) | BSD-3-Clause | Referencia del port (no se enlaza) |
| Fuentes de KaTeX | 0.19.0 | SIL OFL-1.1 | Tipografía matemática |

## Dependencias del frontend (runtime)

Paquetes que Vite incluye en el bundle que se ejecuta dentro del WebView.

| Paquete | Versión | Licencia declarada | Licencia aplicada | Uso |
| --- | --- | --- | --- | --- |
| `@tauri-apps/api` | 2.12.4 | Apache-2.0 OR MIT | MIT | Puente IPC con el backend Tauri |
| `@tauri-apps/plugin-clipboard-manager` | 2.5.0 | MIT OR Apache-2.0 | MIT | Lectura de imágenes y texto del portapapeles |
| `@tauri-apps/plugin-dialog` | 2.8.3 | MIT OR Apache-2.0 | MIT | Diálogos nativos |
| `@tauri-apps/plugin-fs` | 2.7.1 | MIT OR Apache-2.0 | MIT | Escritura temporal del APK en la caché |
| `@tauri-apps/plugin-http` | 2.8.3 | MIT OR Apache-2.0 | MIT | Descarga de releases en Android |
| `@tauri-apps/plugin-opener` | 2.7.2 | MIT OR Apache-2.0 | MIT | Apertura de enlaces y archivos |
| `@tauri-apps/plugin-os` | 2.4.0 | MIT OR Apache-2.0 | MIT | Detección de plataforma |
| `@tauri-apps/plugin-process` | 2.4.0 | MIT OR Apache-2.0 | MIT | Relanzado tras actualizar en escritorio |
| `@tauri-apps/plugin-updater` | 2.14.0 | MIT OR Apache-2.0 | MIT | Actualizador nativo de escritorio |
| `dompurify` | 3.4.17 | MPL-2.0 OR Apache-2.0 | Apache-2.0 | Sanitización del HTML de las tarjetas |
| `katex` | 0.19.0 | MIT | MIT | Fórmulas matemáticas |
| `ts-fsrs` | 6.0.0 | MIT | MIT | Algoritmo FSRS-7 (`ts-fsrs/models/fsrs-7`) |
| `@open-spaced-repetition/srs-kit` | 1.0.0 | BSD-3-Clause | BSD-3-Clause | Primitivas de `ts-fsrs` |

KaTeX también distribuye las fuentes matemáticas de `dist/fonts/` bajo la
SIL Open Font License 1.1. El código de KaTeX es MIT; las fuentes se rigen por
OFL-1.1.

## Dependencias Rust (runtime)

Inventario generado a partir de `src-tauri/Cargo.lock` y `cargo metadata`.
Incluye las dependencias normales de todas las plataformas (Linux, Windows,
macOS y Android); cada build concreta solo enlaza el subconjunto de su target.
No incluye `build-dependencies`, `dev-dependencies` ni crates
`proc-macro`.

### Dependencias directas

| Crate | Versión | Licencia declarada | Licencia aplicada | Uso | Plataforma |
| --- | --- | --- | --- | --- | --- |
| `async-trait` | 0.1.92 | MIT OR Apache-2.0 | MIT | Traits asíncronos del backend | Todas |
| `bincode` | 1.3.3 | MIT | MIT | Serialización de snapshots | Todas |
| `gtk` | 0.18.2 | MIT | MIT | Estilo de barras nativas GTK (Linux) | Linux |
| `image` | 0.25.10 | MIT OR Apache-2.0 | MIT | Decodificación PNG | Todas |
| `notify` | 6.1.1 | CC0-1.0 | CC0-1.0 | Vigilancia del vault (escritorio) | Escritorio |
| `pdfium-render` | 0.9.5 | MIT OR Apache-2.0 | MIT | Enlace Rust a PDFium | Todas |
| `quick-xml` | 0.41.0 | MIT | MIT | Procesamiento XML | Todas |
| `regex` | 1.13.1 | MIT OR Apache-2.0 | MIT | Validaciones y búsquedas | Todas |
| `reqwest` | 0.12.28 | MIT OR Apache-2.0 | MIT | Consultas de bibliografía | Todas |
| `serde` | 1.0.229 | MIT OR Apache-2.0 | MIT | Serialización de datos | Todas |
| `serde_json` | 1.0.154 | MIT OR Apache-2.0 | MIT | JSON del backend | Todas |
| `tauri` | 2.12.5 | Apache-2.0 OR MIT | MIT | Shell nativo y puente IPC | Todas |
| `tauri-plugin-android-fs` | 2.0.1 | MIT OR Apache-2.0 | MIT | MediaStore y SAF en Android | Android |
| `tauri-plugin-clipboard-manager` | 2.5.0 | Apache-2.0 OR MIT | MIT | Portapapeles nativo | Todas |
| `tauri-plugin-dialog` | 2.8.3 | Apache-2.0 OR MIT | MIT | Diálogos nativos | Todas |
| `tauri-plugin-fs` | 2.7.1 | Apache-2.0 OR MIT | MIT | Acceso a archivos | Todas |
| `tauri-plugin-http` | 2.8.3 | Apache-2.0 OR MIT | MIT | HTTP nativo en Android | Android |
| `tauri-plugin-opener` | 2.7.2 | Apache-2.0 OR MIT | MIT | Apertura de enlaces y archivos | Todas |
| `tauri-plugin-os` | 2.4.0 | Apache-2.0 OR MIT | MIT | Detección de plataforma | Todas |
| `tauri-plugin-process` | 2.4.0 | Apache-2.0 OR MIT | MIT | Relanzado tras actualizar | Escritorio |
| `tauri-plugin-updater` | 2.14.0 | Apache-2.0 OR MIT | MIT | Actualizador nativo (git `ba98bfa`) | Escritorio |
| `tokio` | 1.53.3 | MIT | MIT | Runtime asíncrono | Todas |
| `unicode-normalization` | 0.1.26 | (MIT OR Apache-2.0) AND Unicode-3.0 | MIT + Unicode-3.0 | Normalización Unicode | Todas |
| `url` | 2.5.8 | MIT OR Apache-2.0 | MIT | Parseo de URLs | Todas |
| `uuid` | 1.28.0 | Apache-2.0 OR MIT | MIT | Identificadores únicos | Todas |
| `walkdir` | 2.5.0 | Unlicense/MIT | MIT | Recorrido del vault | Todas |

### Inventario completo

<details>
<summary><strong>507 crates de runtime</strong> (nombre, versión y licencia)</summary>

| Crate | Versión | Licencia declarada | Licencia aplicada |
| --- | --- | --- | --- |
| `adler2` | 2.0.1 | 0BSD OR MIT OR Apache-2.0 | MIT |
| `aho-corasick` | 1.1.5 | Unlicense OR MIT | MIT |
| `alloc-no-stdlib` | 3.0.0 | BSD-3-Clause | BSD-3-Clause |
| `alloc-stdlib` | 0.3.0 | BSD-3-Clause | BSD-3-Clause |
| `android_system_properties` | 0.1.6 | MIT OR Apache-2.0 | MIT |
| `anyhow` | 1.0.104 | MIT OR Apache-2.0 | MIT |
| `arboard` | 3.7.0 | MIT OR Apache-2.0 | MIT |
| `async-broadcast` | 0.7.2 | MIT OR Apache-2.0 | MIT |
| `async-channel` | 2.5.0 | Apache-2.0 OR MIT | MIT |
| `async-executor` | 1.14.1 | Apache-2.0 OR MIT | MIT |
| `async-io` | 2.6.0 | Apache-2.0 OR MIT | MIT |
| `async-lock` | 3.4.2 | Apache-2.0 OR MIT | MIT |
| `async-process` | 2.5.0 | Apache-2.0 OR MIT | MIT |
| `async-signal` | 0.2.14 | Apache-2.0 OR MIT | MIT |
| `async-task` | 4.7.1 | Apache-2.0 OR MIT | MIT |
| `atk` | 0.18.2 | MIT | MIT |
| `atk-sys` | 0.18.2 | MIT | MIT |
| `atomic-waker` | 1.1.2 | Apache-2.0 OR MIT | MIT |
| `base64` | 0.21.7 | MIT OR Apache-2.0 | MIT |
| `base64` | 0.22.1 | MIT OR Apache-2.0 | MIT |
| `base64` | 0.23.1 | MIT OR Apache-2.0 | MIT |
| `bincode` | 1.3.3 | MIT | MIT |
| `bit-set` | 0.8.0 | Apache-2.0 OR MIT | MIT |
| `bit-vec` | 0.8.0 | Apache-2.0 OR MIT | MIT |
| `bitflags` | 1.3.2 | MIT/Apache-2.0 | MIT |
| `bitflags` | 2.13.2 | MIT OR Apache-2.0 | MIT |
| `block-buffer` | 0.10.4 | MIT OR Apache-2.0 | MIT |
| `block2` | 0.6.2 | MIT | MIT |
| `blocking` | 1.7.0 | Apache-2.0 OR MIT | MIT |
| `brotli` | 9.0.0 | BSD-3-Clause AND MIT | BSD-3-Clause + MIT |
| `brotli-decompressor` | 6.0.1 | BSD-3-Clause/MIT | MIT |
| `bs58` | 0.5.1 | MIT/Apache-2.0 | MIT |
| `bytemuck` | 1.25.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `byteorder` | 1.5.0 | Unlicense OR MIT | MIT |
| `byteorder-lite` | 0.1.0 | Unlicense OR MIT | MIT |
| `bytes` | 1.12.1 | MIT | MIT |
| `cairo-rs` | 0.18.5 | MIT | MIT |
| `cairo-sys-rs` | 0.18.2 | MIT | MIT |
| `camino` | 1.2.6 | MIT OR Apache-2.0 | MIT |
| `cargo_metadata` | 0.19.2 | MIT | MIT |
| `cargo-platform` | 0.1.9 | MIT OR Apache-2.0 | MIT |
| `cesu8` | 1.1.0 | Apache-2.0/MIT | MIT |
| `cfb` | 0.14.0 | MIT | MIT |
| `cfg-if` | 1.0.5 | MIT OR Apache-2.0 | MIT |
| `chacha20` | 0.10.2 | MIT OR Apache-2.0 | MIT |
| `chrono` | 0.4.45 | MIT OR Apache-2.0 | MIT |
| `clipboard-win` | 5.4.3 | BSL-1.0 | BSL-1.0 |
| `combine` | 4.6.9 | MIT | MIT |
| `concurrent-queue` | 2.5.0 | Apache-2.0 OR MIT | MIT |
| `console_error_panic_hook` | 0.1.7 | Apache-2.0/MIT | MIT |
| `console_log` | 1.1.0 | MIT/Apache-2.0 | MIT |
| `cookie` | 0.18.2 | MIT OR Apache-2.0 | MIT |
| `cookie_store` | 0.22.1 | MIT OR Apache-2.0 | MIT |
| `core_detect` | 1.0.0 | MIT/Apache-2.0 | MIT |
| `core-foundation` | 0.10.1 | MIT OR Apache-2.0 | MIT |
| `core-foundation` | 0.9.4 | MIT OR Apache-2.0 | MIT |
| `core-foundation-sys` | 0.8.7 | MIT OR Apache-2.0 | MIT |
| `core-graphics` | 0.25.0 | MIT OR Apache-2.0 | MIT |
| `core-graphics-types` | 0.2.0 | MIT OR Apache-2.0 | MIT |
| `cpufeatures` | 0.2.17 | MIT OR Apache-2.0 | MIT |
| `cpufeatures` | 0.3.1 | MIT OR Apache-2.0 | MIT |
| `crc32fast` | 1.5.2 | MIT OR Apache-2.0 | MIT |
| `crossbeam-channel` | 0.5.17 | MIT OR Apache-2.0 | MIT |
| `crossbeam-utils` | 0.8.23 | MIT OR Apache-2.0 | MIT |
| `crunchy` | 0.2.4 | MIT | MIT |
| `crypto-common` | 0.1.7 | MIT OR Apache-2.0 | MIT |
| `cssparser` | 0.37.0 | MPL-2.0 | MPL-2.0 |
| `ctor` | 1.0.13 | Apache-2.0 OR MIT | MIT |
| `data-url` | 0.3.2 | MIT OR Apache-2.0 | MIT |
| `dbus` | 0.9.12 | Apache-2.0/MIT | MIT |
| `defmt` | 1.2.0 | MIT OR Apache-2.0 | MIT |
| `deranged` | 0.5.9 | MIT OR Apache-2.0 | MIT |
| `derive_more` | 2.1.1 | MIT | MIT |
| `digest` | 0.10.7 | MIT OR Apache-2.0 | MIT |
| `dirs` | 7.0.0 | MIT OR Apache-2.0 | MIT |
| `dirs-sys` | 0.5.0 | MIT OR Apache-2.0 | MIT |
| `dispatch2` | 0.3.1 | Zlib OR Apache-2.0 OR MIT | MIT |
| `dlopen2` | 0.8.2 | MIT | MIT |
| `dom_query` | 0.28.0 | MIT | MIT |
| `downcast-rs` | 1.2.1 | MIT/Apache-2.0 | MIT |
| `dpi` | 0.1.2 | Apache-2.0 AND MIT | Apache-2.0 + MIT |
| `dtoa` | 1.0.11 | MIT OR Apache-2.0 | MIT |
| `dtoa-short` | 0.3.5 | MPL-2.0 | MPL-2.0 |
| `dunce` | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 | Apache-2.0 |
| `dyn-clone` | 1.0.20 | MIT OR Apache-2.0 | MIT |
| `either` | 1.19.0 | MIT OR Apache-2.0 | MIT |
| `embed_plist` | 1.2.2 | MIT OR Apache-2.0 | MIT |
| `encoding_rs` | 0.8.42 | (Apache-2.0 OR MIT) AND BSD-3-Clause | MIT + BSD-3-Clause |
| `endi` | 1.1.1 | MIT | MIT |
| `enumflags2` | 0.7.12 | MIT OR Apache-2.0 | MIT |
| `equivalent` | 1.0.3 | Apache-2.0 OR MIT | MIT |
| `erased-serde` | 0.4.10 | MIT OR Apache-2.0 | MIT |
| `errno` | 0.3.14 | MIT OR Apache-2.0 | MIT |
| `error-code` | 3.4.0 | BSL-1.0 | BSL-1.0 |
| `event-listener` | 5.4.2 | Apache-2.0 OR MIT | MIT |
| `event-listener-strategy` | 0.5.4 | Apache-2.0 OR MIT | MIT |
| `fastrand` | 2.5.0 | Apache-2.0 OR MIT | MIT |
| `fax` | 0.2.7 | MIT | MIT |
| `fdeflate` | 0.3.7 | MIT OR Apache-2.0 | MIT |
| `field-offset` | 0.3.6 | MIT OR Apache-2.0 | MIT |
| `filetime` | 0.2.29 | MIT/Apache-2.0 | MIT |
| `fixedbitset` | 0.5.7 | MIT OR Apache-2.0 | MIT |
| `flate2` | 1.1.10 | MIT OR Apache-2.0 | MIT |
| `fnv` | 1.0.7 | Apache-2.0 / MIT | MIT |
| `foldhash` | 0.1.5 | Zlib | Zlib |
| `foldhash` | 0.2.0 | Zlib | Zlib |
| `foreign-types` | 0.5.0 | MIT/Apache-2.0 | MIT |
| `foreign-types-shared` | 0.3.1 | MIT/Apache-2.0 | MIT |
| `form_urlencoded` | 1.2.2 | MIT OR Apache-2.0 | MIT |
| `fsevent-sys` | 4.1.0 | MIT | MIT |
| `futures-channel` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `futures-core` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `futures-executor` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `futures-io` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `futures-lite` | 2.6.1 | Apache-2.0 OR MIT | MIT |
| `futures-sink` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `futures-task` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `futures-util` | 0.3.34 | MIT OR Apache-2.0 | MIT |
| `gdk` | 0.18.2 | MIT | MIT |
| `gdk-pixbuf` | 0.18.5 | MIT | MIT |
| `gdk-pixbuf-sys` | 0.18.0 | MIT | MIT |
| `gdk-sys` | 0.18.2 | MIT | MIT |
| `gdkwayland-sys` | 0.18.2 | MIT | MIT |
| `gdkx11` | 0.18.2 | MIT | MIT |
| `gdkx11-sys` | 0.18.2 | MIT | MIT |
| `generic-array` | 0.14.7 | MIT | MIT |
| `gethostname` | 1.1.0 | Apache-2.0 | Apache-2.0 |
| `getrandom` | 0.2.17 | MIT OR Apache-2.0 | MIT |
| `getrandom` | 0.3.4 | MIT OR Apache-2.0 | MIT |
| `getrandom` | 0.4.3 | MIT OR Apache-2.0 | MIT |
| `gio` | 0.18.4 | MIT | MIT |
| `gio-sys` | 0.18.1 | MIT | MIT |
| `glib` | 0.18.5 | MIT | MIT |
| `glib-sys` | 0.18.1 | MIT | MIT |
| `glob` | 0.3.4 | MIT OR Apache-2.0 | MIT |
| `gobject-sys` | 0.18.0 | MIT | MIT |
| `gtk` | 0.18.2 | MIT | MIT |
| `gtk-sys` | 0.18.2 | MIT | MIT |
| `h2` | 0.4.20 | MIT | MIT |
| `half` | 2.7.1 | MIT OR Apache-2.0 | MIT |
| `hashbrown` | 0.12.3 | MIT OR Apache-2.0 | MIT |
| `hashbrown` | 0.15.5 | MIT OR Apache-2.0 | MIT |
| `hashbrown` | 0.17.1 | MIT OR Apache-2.0 | MIT |
| `heck` | 0.5.0 | MIT OR Apache-2.0 | MIT |
| `hermit-abi` | 0.5.3 | MIT OR Apache-2.0 | MIT |
| `hex` | 0.4.3 | MIT OR Apache-2.0 | MIT |
| `html5ever` | 0.39.0 | MIT OR Apache-2.0 | MIT |
| `http` | 1.5.0 | MIT OR Apache-2.0 | MIT |
| `http-body` | 1.1.0 | MIT | MIT |
| `http-body-util` | 0.1.5 | MIT | MIT |
| `http-range` | 0.1.5 | MIT | MIT |
| `httparse` | 1.10.1 | MIT OR Apache-2.0 | MIT |
| `hyper` | 1.12.0 | MIT | MIT |
| `hyper-rustls` | 0.27.10 | Apache-2.0 OR ISC OR MIT | MIT |
| `hyper-util` | 0.1.21 | MIT | MIT |
| `iana-time-zone` | 0.1.65 | MIT OR Apache-2.0 | MIT |
| `iana-time-zone-haiku` | 0.1.2 | MIT OR Apache-2.0 | MIT |
| `icu_collections` | 2.3.0 | Unicode-3.0 | Unicode-3.0 |
| `icu_locale_core` | 2.3.0 | Unicode-3.0 | Unicode-3.0 |
| `icu_normalizer` | 2.3.0 | Unicode-3.0 | Unicode-3.0 |
| `icu_normalizer_data` | 2.3.0 | Unicode-3.0 | Unicode-3.0 |
| `icu_properties` | 2.3.0 | Unicode-3.0 | Unicode-3.0 |
| `icu_properties_data` | 2.3.0 | Unicode-3.0 | Unicode-3.0 |
| `icu_provider` | 2.3.1 | Unicode-3.0 | Unicode-3.0 |
| `idna` | 1.1.0 | MIT OR Apache-2.0 | MIT |
| `idna_adapter` | 1.2.2 | Apache-2.0 OR MIT | MIT |
| `image` | 0.25.10 | MIT OR Apache-2.0 | MIT |
| `indexmap` | 1.9.3 | Apache-2.0 OR MIT | MIT |
| `indexmap` | 2.14.2 | Apache-2.0 OR MIT | MIT |
| `infer` | 0.22.0 | MIT | MIT |
| `inotify` | 0.9.6 | ISC | ISC |
| `inotify-sys` | 0.1.8 | ISC | ISC |
| `ipnet` | 2.12.2 | MIT OR Apache-2.0 | MIT |
| `is-docker` | 0.2.0 | MIT | MIT |
| `is-wsl` | 0.4.0 | MIT | MIT |
| `itertools` | 0.15.0 | MIT OR Apache-2.0 | MIT |
| `itoa` | 1.0.18 | MIT OR Apache-2.0 | MIT |
| `javascriptcore-rs` | 1.1.2 | MIT | MIT |
| `javascriptcore-rs-sys` | 1.1.1 | MIT | MIT |
| `jiff` | 0.2.38 | Unlicense OR MIT | MIT |
| `jiff-core` | 0.1.1 | Unlicense OR MIT | MIT |
| `jiff-tzdb` | 0.1.9 | Unlicense OR MIT | MIT |
| `jiff-tzdb-platform` | 0.1.3 | Unlicense OR MIT | MIT |
| `jni` | 0.21.1 | MIT/Apache-2.0 | MIT |
| `jni` | 0.22.4 | MIT OR Apache-2.0 | MIT |
| `jni-sys` | 0.3.1 | MIT OR Apache-2.0 | MIT |
| `jni-sys` | 0.4.1 | MIT OR Apache-2.0 | MIT |
| `js-sys` | 0.3.106 | MIT OR Apache-2.0 | MIT |
| `json-patch` | 4.2.0 | MIT/Apache-2.0 | MIT |
| `jsonptr` | 0.7.1 | MIT OR Apache-2.0 | MIT |
| `keyboard-types` | 0.8.3 | MIT OR Apache-2.0 | MIT |
| `kqueue` | 1.2.1 | MIT | MIT |
| `kqueue-sys` | 1.1.2 | MIT | MIT |
| `libappindicator` | 0.9.0 | Apache-2.0 OR MIT | MIT |
| `libappindicator-sys` | 0.9.0 | Apache-2.0 OR MIT | MIT |
| `libc` | 0.2.191 | MIT OR Apache-2.0 | MIT |
| `libdbus-sys` | 0.2.7 | Apache-2.0/MIT | MIT |
| `libloading` | 0.7.4 | ISC | ISC |
| `libredox` | 0.1.25 | MIT | MIT |
| `linux-raw-sys` | 0.12.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | MIT |
| `litemap` | 0.8.3 | Unicode-3.0 | Unicode-3.0 |
| `lock_api` | 0.4.14 | MIT OR Apache-2.0 | MIT |
| `log` | 0.4.34 | MIT OR Apache-2.0 | MIT |
| `lru-slab` | 0.1.3 | MIT OR Apache-2.0 OR Zlib | MIT |
| `markup5ever` | 0.39.0 | MIT OR Apache-2.0 | MIT |
| `maybe-owned` | 0.3.4 | MIT OR Apache-2.0 | MIT |
| `memchr` | 2.8.3 | Unlicense OR MIT | MIT |
| `memoffset` | 0.9.1 | MIT | MIT |
| `mime` | 0.3.17 | MIT OR Apache-2.0 | MIT |
| `minisign-verify` | 0.3.0 | MIT | MIT |
| `miniz_oxide` | 0.8.9 | MIT OR Zlib OR Apache-2.0 | MIT |
| `miniz_oxide` | 0.9.1 | MIT OR Zlib OR Apache-2.0 | MIT |
| `mio` | 0.8.11 | MIT | MIT |
| `mio` | 1.2.4 | MIT | MIT |
| `moxcms` | 0.8.1 | BSD-3-Clause OR Apache-2.0 | Apache-2.0 |
| `muda` | 0.20.0 | Apache-2.0 OR MIT | MIT |
| `ndk` | 0.9.0 | MIT OR Apache-2.0 | MIT |
| `ndk-context` | 0.1.1 | MIT OR Apache-2.0 | MIT |
| `ndk-sys` | 0.6.0+11769913 | MIT OR Apache-2.0 | MIT |
| `new_debug_unreachable` | 1.0.6 | MIT | MIT |
| `nix` | 0.31.3 | MIT | MIT |
| `nom` | 8.0.0 | MIT | MIT |
| `notify` | 6.1.1 | CC0-1.0 | CC0-1.0 |
| `num_enum` | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 | MIT |
| `num-conv` | 0.2.2 | MIT OR Apache-2.0 | MIT |
| `num-traits` | 0.2.19 | MIT OR Apache-2.0 | MIT |
| `objc2` | 0.6.5 | MIT | MIT |
| `objc2-app-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-cloud-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-core-data` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-core-foundation` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-core-graphics` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-core-image` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-core-location` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-core-text` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-encode` | 4.1.0 | MIT | MIT |
| `objc2-exception-helper` | 0.1.1 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-foundation` | 0.3.2 | MIT | MIT |
| `objc2-io-surface` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-osa-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-quartz-core` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-ui-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-user-notifications` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `objc2-web-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | MIT |
| `once_cell` | 1.21.4 | MIT OR Apache-2.0 | MIT |
| `open` | 5.4.4 | MIT | MIT |
| `openssl-probe` | 0.2.1 | MIT OR Apache-2.0 | MIT |
| `option-ext` | 0.2.0 | MPL-2.0 | MPL-2.0 |
| `ordered-stream` | 0.2.0 | MIT OR Apache-2.0 | MIT |
| `os_info` | 3.15.0 | MIT | MIT |
| `os_pipe` | 1.2.3 | MIT | MIT |
| `osakit` | 0.3.1 | MIT OR Apache-2.0 | MIT |
| `pango` | 0.18.3 | MIT | MIT |
| `pango-sys` | 0.18.0 | MIT | MIT |
| `parking` | 2.2.1 | Apache-2.0 OR MIT | MIT |
| `parking_lot` | 0.12.5 | MIT OR Apache-2.0 | MIT |
| `parking_lot_core` | 0.9.12 | MIT OR Apache-2.0 | MIT |
| `pdfium-render` | 0.9.5 | MIT OR Apache-2.0 | MIT |
| `percent-encoding` | 2.3.2 | MIT OR Apache-2.0 | MIT |
| `petgraph` | 0.8.3 | MIT OR Apache-2.0 | MIT |
| `phf` | 0.13.1 | MIT | MIT |
| `phf_shared` | 0.13.1 | MIT | MIT |
| `pin-project-lite` | 0.2.17 | Apache-2.0 OR MIT | MIT |
| `piper` | 0.2.5 | MIT OR Apache-2.0 | MIT |
| `piston-float` | 1.0.1 | MIT | MIT |
| `plist` | 1.10.1 | MIT | MIT |
| `png` | 0.18.1 | MIT OR Apache-2.0 | MIT |
| `polling` | 3.11.0 | Apache-2.0 OR MIT | MIT |
| `portable-atomic` | 1.15.0 | Apache-2.0 OR MIT | MIT |
| `portable-atomic-util` | 0.2.8 | Apache-2.0 OR MIT | MIT |
| `potential_utf` | 0.1.6 | Unicode-3.0 | Unicode-3.0 |
| `powerfmt` | 0.2.1 | MIT OR Apache-2.0 | MIT |
| `precomputed-hash` | 0.1.1 | MIT | MIT |
| `proc-macro2` | 1.0.107 | MIT OR Apache-2.0 | MIT |
| `psl-types` | 2.0.11 | MIT/Apache-2.0 | MIT |
| `publicsuffix` | 2.3.0 | MIT/Apache-2.0 | MIT |
| `pxfm` | 0.1.30 | BSD-3-Clause OR Apache-2.0 | Apache-2.0 |
| `quick-error` | 2.0.1 | MIT/Apache-2.0 | MIT |
| `quick-xml` | 0.41.0 | MIT | MIT |
| `quick-xml` | 0.42.0 | MIT | MIT |
| `quinn` | 0.11.12 | MIT OR Apache-2.0 | MIT |
| `quinn-proto` | 0.11.19 | MIT OR Apache-2.0 | MIT |
| `quinn-udp` | 0.5.16 | MIT OR Apache-2.0 | MIT |
| `quote` | 1.0.47 | MIT OR Apache-2.0 | MIT |
| `r-efi` | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | MIT |
| `r-efi` | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | MIT |
| `rand` | 0.10.3 | MIT OR Apache-2.0 | MIT |
| `rand_core` | 0.10.1 | MIT OR Apache-2.0 | MIT |
| `rand_pcg` | 0.10.2 | MIT OR Apache-2.0 | MIT |
| `raw-window-handle` | 0.6.2 | MIT OR Apache-2.0 OR Zlib | MIT |
| `redox_syscall` | 0.5.18 | MIT | MIT |
| `redox_users` | 0.5.3 | MIT | MIT |
| `ref-cast` | 1.0.27 | MIT OR Apache-2.0 | MIT |
| `regex` | 1.13.1 | MIT OR Apache-2.0 | MIT |
| `regex-automata` | 0.4.18 | MIT OR Apache-2.0 | MIT |
| `regex-syntax` | 0.8.11 | MIT OR Apache-2.0 | MIT |
| `reqwest` | 0.12.28 | MIT OR Apache-2.0 | MIT |
| `reqwest` | 0.13.5 | MIT OR Apache-2.0 | MIT |
| `rfd` | 0.16.0 | MIT | MIT |
| `ring` | 0.17.14 | Apache-2.0 AND ISC | Apache-2.0 + ISC |
| `rustc-hash` | 2.1.3 | Apache-2.0 OR MIT | MIT |
| `rustix` | 1.1.5 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | MIT |
| `rustls` | 0.23.46 | Apache-2.0 OR ISC OR MIT | MIT |
| `rustls-native-certs` | 0.8.5 | Apache-2.0 OR ISC OR MIT | MIT |
| `rustls-pki-types` | 1.15.1 | MIT OR Apache-2.0 | MIT |
| `rustls-platform-verifier` | 0.7.1 | MIT OR Apache-2.0 | MIT |
| `rustls-platform-verifier-android` | 0.2.0 | MIT OR Apache-2.0 | MIT |
| `rustls-webpki` | 0.103.16 | ISC | ISC |
| `ryu` | 1.0.23 | Apache-2.0 OR BSL-1.0 | Apache-2.0 |
| `same-file` | 1.0.6 | Unlicense/MIT | MIT |
| `schannel` | 0.1.30 | MIT | MIT |
| `schemars` | 0.8.22 | MIT | MIT |
| `schemars` | 0.9.0 | MIT | MIT |
| `schemars` | 1.2.3 | MIT | MIT |
| `scopeguard` | 1.2.0 | MIT OR Apache-2.0 | MIT |
| `security-framework` | 3.7.0 | MIT OR Apache-2.0 | MIT |
| `security-framework-sys` | 2.17.0 | MIT OR Apache-2.0 | MIT |
| `selectors` | 0.38.0 | MPL-2.0 | MPL-2.0 |
| `semver` | 1.0.28 | MIT OR Apache-2.0 | MIT |
| `serde` | 1.0.229 | MIT OR Apache-2.0 | MIT |
| `serde_core` | 1.0.229 | MIT OR Apache-2.0 | MIT |
| `serde_json` | 1.0.154 | MIT OR Apache-2.0 | MIT |
| `serde_spanned` | 1.1.2 | MIT OR Apache-2.0 | MIT |
| `serde_urlencoded` | 0.7.1 | MIT/Apache-2.0 | MIT |
| `serde_with` | 3.24.0 | MIT OR Apache-2.0 | MIT |
| `serde-untagged` | 0.1.9 | MIT OR Apache-2.0 | MIT |
| `serialize-to-javascript` | 0.1.2 | MIT OR Apache-2.0 | MIT |
| `servo_arc` | 0.4.3 | MIT OR Apache-2.0 | MIT |
| `sha2` | 0.10.9 | MIT OR Apache-2.0 | MIT |
| `signal-hook-registry` | 1.4.8 | MIT OR Apache-2.0 | MIT |
| `simd_cesu8` | 1.2.0 | Apache-2.0 OR MIT | MIT |
| `simd-adler32` | 0.3.10 | MIT | MIT |
| `simdutf8` | 0.1.5 | MIT OR Apache-2.0 | MIT |
| `siphasher` | 1.0.4 | MIT OR Apache-2.0 | MIT |
| `slab` | 0.4.12 | MIT | MIT |
| `smallvec` | 1.16.3 | MIT OR Apache-2.0 | MIT |
| `socket2` | 0.6.5 | MIT OR Apache-2.0 | MIT |
| `softbuffer` | 0.4.8 | MIT OR Apache-2.0 | MIT |
| `soup3` | 0.5.0 | MIT | MIT |
| `soup3-sys` | 0.5.0 | MIT | MIT |
| `stable_deref_trait` | 1.2.1 | MIT OR Apache-2.0 | MIT |
| `string_cache` | 0.9.0 | MIT OR Apache-2.0 | MIT |
| `subtle` | 2.6.1 | BSD-3-Clause | BSD-3-Clause |
| `swift-rs` | 1.0.9 | MIT OR Apache-2.0 | MIT |
| `syn` | 3.0.9 | MIT OR Apache-2.0 | MIT |
| `sync_wrapper` | 1.0.2 | Apache-2.0 | Apache-2.0 |
| `sys-locale` | 0.3.2 | MIT OR Apache-2.0 | MIT |
| `system-configuration` | 0.7.0 | MIT OR Apache-2.0 | MIT |
| `system-configuration-sys` | 0.6.0 | MIT OR Apache-2.0 | MIT |
| `tao` | 0.37.1 | Apache-2.0 | Apache-2.0 |
| `tar` | 0.4.46 | MIT OR Apache-2.0 | MIT |
| `tauri` | 2.12.5 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-android-fs` | 2.0.1 | MIT OR Apache-2.0 | MIT |
| `tauri-plugin-clipboard-manager` | 2.5.0 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-dialog` | 2.8.3 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-fs` | 2.7.1 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-http` | 2.8.3 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-opener` | 2.7.2 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-os` | 2.4.0 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-process` | 2.4.0 | Apache-2.0 OR MIT | MIT |
| `tauri-plugin-updater` | 2.14.0 | Apache-2.0 OR MIT | MIT |
| `tauri-runtime` | 2.12.2 | Apache-2.0 OR MIT | MIT |
| `tauri-runtime-wry` | 2.12.3 | Apache-2.0 OR MIT | MIT |
| `tauri-utils` | 2.10.2 | Apache-2.0 OR MIT | MIT |
| `tempfile` | 3.27.0 | MIT OR Apache-2.0 | MIT |
| `tendril` | 0.5.1 | MIT OR Apache-2.0 | MIT |
| `thiserror` | 1.0.69 | MIT OR Apache-2.0 | MIT |
| `thiserror` | 2.0.21 | MIT OR Apache-2.0 | MIT |
| `tiff` | 0.11.3 | MIT | MIT |
| `time` | 0.3.55 | MIT OR Apache-2.0 | MIT |
| `time-core` | 0.1.9 | MIT OR Apache-2.0 | MIT |
| `tinystr` | 0.8.4 | Unicode-3.0 | Unicode-3.0 |
| `tinyvec` | 1.13.3 | Zlib OR Apache-2.0 OR MIT | MIT |
| `tokio` | 1.53.3 | MIT | MIT |
| `tokio-rustls` | 0.26.6 | MIT OR Apache-2.0 | MIT |
| `tokio-util` | 0.7.20 | MIT | MIT |
| `toml` | 1.1.8+spec-1.1.0 | MIT OR Apache-2.0 | MIT |
| `toml_datetime` | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 | MIT |
| `toml_parser` | 1.1.5+spec-1.1.0 | MIT OR Apache-2.0 | MIT |
| `toml_writer` | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 | MIT |
| `tower` | 0.5.3 | MIT | MIT |
| `tower-http` | 0.6.11 | MIT | MIT |
| `tower-layer` | 0.3.3 | MIT | MIT |
| `tower-service` | 0.3.3 | MIT | MIT |
| `tracing` | 0.1.44 | MIT | MIT |
| `tracing-core` | 0.1.36 | MIT | MIT |
| `tray-icon` | 0.25.1 | MIT OR Apache-2.0 | MIT |
| `tree_magic_mini` | 3.2.2 | MIT | MIT |
| `try-lock` | 0.2.5 | MIT | MIT |
| `typed-path` | 0.13.0 | MIT OR Apache-2.0 | MIT |
| `typeid` | 1.0.3 | MIT OR Apache-2.0 | MIT |
| `typenum` | 1.20.1 | MIT OR Apache-2.0 | MIT |
| `uds_windows` | 1.2.1 | MIT | MIT |
| `unicode-ident` | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 | MIT + Unicode-3.0 |
| `unicode-normalization` | 0.1.26 | (MIT OR Apache-2.0) AND Unicode-3.0 | MIT + Unicode-3.0 |
| `unicode-segmentation` | 1.13.3 | MIT OR Apache-2.0 | MIT |
| `untrusted` | 0.9.0 | ISC | ISC |
| `url` | 2.5.8 | MIT OR Apache-2.0 | MIT |
| `urlpattern` | 0.6.0 | MIT | MIT |
| `utf16string` | 0.2.0 | MIT OR Apache-2.0 | MIT |
| `utf8_iter` | 1.0.4 | Apache-2.0 OR MIT | MIT |
| `uuid` | 1.28.0 | Apache-2.0 OR MIT | MIT |
| `vecmath` | 1.0.0 | MIT | MIT |
| `walkdir` | 2.5.0 | Unlicense/MIT | MIT |
| `want` | 0.3.2 | MIT | MIT |
| `wasi` | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | MIT |
| `wasip2` | 1.0.4+wasi-0.2.12 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | MIT |
| `wasm-bindgen` | 0.2.129 | MIT OR Apache-2.0 | MIT |
| `wasm-bindgen-futures` | 0.4.79 | MIT OR Apache-2.0 | MIT |
| `wasm-bindgen-shared` | 0.2.129 | MIT OR Apache-2.0 | MIT |
| `wasm-streams` | 0.5.0 | MIT OR Apache-2.0 | MIT |
| `wayland-backend` | 0.3.17 | MIT | MIT |
| `wayland-client` | 0.31.15 | MIT | MIT |
| `wayland-protocols` | 0.32.13 | MIT | MIT |
| `wayland-protocols-wlr` | 0.3.12 | MIT | MIT |
| `wayland-sys` | 0.31.11 | MIT | MIT |
| `web_atoms` | 0.2.6 | MIT OR Apache-2.0 | MIT |
| `web-sys` | 0.3.106 | MIT OR Apache-2.0 | MIT |
| `web-time` | 1.1.0 | MIT OR Apache-2.0 | MIT |
| `webkit2gtk` | 2.0.2 | MIT | MIT |
| `webkit2gtk-sys` | 2.0.2 | MIT | MIT |
| `webpki-root-certs` | 1.0.11 | CDLA-Permissive-2.0 | CDLA-Permissive-2.0 |
| `webpki-roots` | 1.0.11 | CDLA-Permissive-2.0 | CDLA-Permissive-2.0 |
| `webview2-com` | 0.39.1 | MIT | MIT |
| `webview2-com-sys` | 0.39.1 | MIT | MIT |
| `weezl` | 0.1.12 | MIT OR Apache-2.0 | MIT |
| `winapi` | 0.3.9 | MIT/Apache-2.0 | MIT |
| `winapi-i686-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 | MIT |
| `winapi-util` | 0.1.11 | Unlicense OR MIT | MIT |
| `winapi-x86_64-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 | MIT |
| `window-vibrancy` | 0.8.1 | Apache-2.0 OR MIT | MIT |
| `windows` | 0.62.2 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_gnullvm` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_gnullvm` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_gnullvm` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_msvc` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_msvc` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_msvc` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_aarch64_msvc` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_i686_gnu` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_i686_gnu` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_i686_gnu` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_i686_gnu` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_i686_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_i686_gnullvm` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_i686_msvc` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_i686_msvc` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_i686_msvc` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_i686_msvc` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnu` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnu` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnu` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnu` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnullvm` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnullvm` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_gnullvm` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_msvc` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_msvc` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_msvc` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows_x86_64_msvc` | 0.53.1 | MIT OR Apache-2.0 | MIT |
| `windows-collections` | 0.3.2 | MIT OR Apache-2.0 | MIT |
| `windows-core` | 0.62.2 | MIT OR Apache-2.0 | MIT |
| `windows-future` | 0.3.2 | MIT OR Apache-2.0 | MIT |
| `windows-link` | 0.2.1 | MIT OR Apache-2.0 | MIT |
| `windows-numerics` | 0.3.1 | MIT OR Apache-2.0 | MIT |
| `windows-registry` | 0.6.1 | MIT OR Apache-2.0 | MIT |
| `windows-result` | 0.4.1 | MIT OR Apache-2.0 | MIT |
| `windows-strings` | 0.5.1 | MIT OR Apache-2.0 | MIT |
| `windows-sys` | 0.45.0 | MIT OR Apache-2.0 | MIT |
| `windows-sys` | 0.48.0 | MIT OR Apache-2.0 | MIT |
| `windows-sys` | 0.52.0 | MIT OR Apache-2.0 | MIT |
| `windows-sys` | 0.60.2 | MIT OR Apache-2.0 | MIT |
| `windows-sys` | 0.61.2 | MIT OR Apache-2.0 | MIT |
| `windows-targets` | 0.42.2 | MIT OR Apache-2.0 | MIT |
| `windows-targets` | 0.48.5 | MIT OR Apache-2.0 | MIT |
| `windows-targets` | 0.52.6 | MIT OR Apache-2.0 | MIT |
| `windows-targets` | 0.53.5 | MIT OR Apache-2.0 | MIT |
| `windows-threading` | 0.2.1 | MIT OR Apache-2.0 | MIT |
| `windows-version` | 0.1.7 | MIT OR Apache-2.0 | MIT |
| `winnow` | 1.0.4 | MIT | MIT |
| `wit-bindgen` | 0.57.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | MIT |
| `wl-clipboard-rs` | 0.9.4 | MIT OR Apache-2.0 | MIT |
| `writeable` | 0.6.4 | Unicode-3.0 | Unicode-3.0 |
| `wry` | 0.57.0 | Apache-2.0 OR MIT | MIT |
| `x11` | 2.21.0 | MIT | MIT |
| `x11-dl` | 2.21.0 | MIT | MIT |
| `x11rb` | 0.13.2 | MIT OR Apache-2.0 | MIT |
| `x11rb-protocol` | 0.13.2 | MIT OR Apache-2.0 | MIT |
| `xattr` | 1.6.1 | MIT OR Apache-2.0 | MIT |
| `yoke` | 0.8.3 | Unicode-3.0 | Unicode-3.0 |
| `zbus` | 5.19.0 | MIT | MIT |
| `zbus_names` | 4.3.5 | MIT | MIT |
| `zcheapstr` | 1.1.0 | MIT | MIT |
| `zerocopy` | 0.8.63 | BSD-2-Clause OR Apache-2.0 OR MIT | MIT |
| `zerofrom` | 0.1.8 | Unicode-3.0 | Unicode-3.0 |
| `zeroize` | 1.9.1 | Apache-2.0 OR MIT | MIT |
| `zerotrie` | 0.2.5 | Unicode-3.0 | Unicode-3.0 |
| `zerovec` | 0.11.8 | Unicode-3.0 | Unicode-3.0 |
| `zip` | 9.1.1 | MIT | MIT |
| `zlib-rs` | 0.6.8 | Zlib | Zlib |
| `zmij` | 1.0.23 | MIT | MIT |
| `zune-core` | 0.5.3 | MIT OR Apache-2.0 OR Zlib | MIT |
| `zune-jpeg` | 0.5.15 | MIT OR Apache-2.0 OR Zlib | MIT |
| `zvariant` | 5.15.1 | MIT | MIT |
| `zvariant_utils` | 4.2.0 | MIT | MIT |

</details>

## PDFium

### Binario PDFium (build 8125 / Chromium 158)

El lector PDF carga dinámicamente `libpdfium.so`, `pdfium.dll` o
`libpdfium.dylib` desde `src-tauri/resources/pdfium/<os>-<arch>/`. El binario
se obtiene con `scripts/fetch-pdfium.sh` de
[`bblanchon/pdfium-binaries`](https://github.com/bblanchon/pdfium-binaries/releases),
release `chromium/8125`.

El paquete incluye el archivo `licenses/pdfium.txt`, que contiene la licencia
BSD-3-Clause de los autores de PDFium y la Apache-2.0 de los componentes
adicionales incluidos en el binario. Los textos completos de ambas licencias
están en las secciones [BSD-3-Clause](#bsd-3-clause) y
[Apache-2.0](#apache-20).

### Empaquetado `pdfium-binaries`

El archivo `LICENSE` raíz del paquete (copiado a
`src-tauri/resources/pdfium/LICENSE`) es MIT, Copyright 2014-2025 Benoit
Blanchon. El texto completo está en la sección [MIT](#mit).

### Componentes adicionales del binario

El paquete de PDFium también distribuye las licencias de los componentes que
compilan dentro del binario. Están en `licenses/` y se listan aquí para poder
revisarlas cuando se actualice el build:

`abseil.txt`, `agg23.txt`, `dragonbox-Apache2-LLVM.txt`,
`dragonbox-Boost.txt`, `fast_float.txt`, `freetype.txt`,
`harfbuzz.txt`, `highway.txt`, `icu.txt`, `lcms.txt`,
`libjpeg_turbo.ijg`, `libjpeg_turbo.md`, `libopenjpeg.txt`,
`libpng.txt`, `llvm-libc.txt`, `simdutf.txt`, `zlib.txt`.

### `pdfium-render` 0.9.5

Crate Rust que carga el binario de PDFium. Se distribuye como
`MIT OR Apache-2.0`, a elección del receptor. SinNotas lo usa bajo MIT.

## FSRS-7

### `ts-fsrs` 6.0.0

La app usa la entrada `ts-fsrs/models/fsrs-7`, el port oficial de
`fsrs-rs/src/model_v7.rs`. Licencia MIT, Copyright (c) 2026 Open Spaced
Repetition. Texto completo en la sección [MIT](#mit).

### `@open-spaced-repetition/srs-kit` 1.0.0

Dependencia de `ts-fsrs` con las primitivas y esquemas del framework.
Licencia BSD-3-Clause, Copyright (c) 2026 Open Spaced Repetition contributors.
Texto completo en la sección [BSD-3-Clause](#bsd-3-clause).

### `fsrs-rs` 7.0.0 (referencia)

El port de `ts-fsrs` declara haberse hecho desde
[`fsrs-rs/src/model_v7.rs`](https://github.com/open-spaced-repetition/fsrs-rs).
El repositorio de referencia está en el commit
`9fb03928d8c8fd84f5b9df2b2f6ddc631e6cae81` (`v7.0.0-2-g9fb0392`). No se enlaza
ni se redistribuye, pero se incluye su licencia BSD-3-Clause, Copyright (c)
2023 Open Spaced Repetition, por ser la procedencia del algoritmo. Texto
completo en la sección [BSD-3-Clause](#bsd-3-clause).

## Textos de licencia

Los avisos de copyright concretos de cada paquete figuran en su archivo
`LICENSE` o `COPYING` dentro de la distribución de origen. Los textos
íntegros de las licencias aplicadas son los siguientes.

### MIT

```text
MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### Apache-2.0

```text
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

"License" shall mean the terms and conditions for use, reproduction, and distribution as defined by Sections 1 through 9 of this document.

"Licensor" shall mean the copyright owner or entity authorized by the copyright owner that is granting the License.

"Legal Entity" shall mean the union of the acting entity and all other entities that control, are controlled by, or are under common control with that entity. For the purposes of this definition, "control" means (i) the power, direct or indirect, to cause the direction or management of such entity, whether by contract or otherwise, or (ii) ownership of fifty percent (50%) or more of the outstanding shares, or (iii) beneficial ownership of such entity.

"You" (or "Your") shall mean an individual or Legal Entity exercising permissions granted by this License.

"Source" form shall mean the preferred form for making modifications, including but not limited to software source code, documentation source, and configuration files.

"Object" form shall mean any form resulting from mechanical transformation or translation of a Source form, including but not limited to compiled object code, generated documentation, and conversions to other media types.

"Work" shall mean the work of authorship, whether in Source or Object form, made available under the License, as indicated by a copyright notice that is included in or attached to the work (an example is provided in the Appendix below).

"Derivative Works" shall mean any work, whether in Source or Object form, that is based on (or derived from) the Work and for which the editorial revisions, annotations, elaborations, or other modifications represent, as a whole, an original work of authorship. For the purposes of this License, Derivative Works shall not include works that remain separable from, or merely link (or bind by name) to the interfaces of, the Work and Derivative Works thereof.

"Contribution" shall mean any work of authorship, including the original version of the Work and any modifications or additions to that Work or Derivative Works thereof, that is intentionally submitted to Licensor for inclusion in the Work by the copyright owner or by an individual or Legal Entity authorized to submit on behalf of the copyright owner. For the purposes of this definition, "submitted" means any form of electronic, verbal, or written communication sent to the Licensor or its representatives, including but not limited to communication on electronic mailing lists, source code control systems, and issue tracking systems that are managed by, or on behalf of, the Licensor for the purpose of discussing and improving the Work, but excluding communication that is conspicuously marked or otherwise designated in writing by the copyright owner as "Not a Contribution."

"Contributor" shall mean Licensor and any individual or Legal Entity on behalf of whom a Contribution has been received by Licensor and subsequently incorporated within the Work.

2. Grant of Copyright License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare Derivative Works of, publicly display, publicly perform, sublicense, and distribute the Work and such Derivative Works in Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable (except as stated in this section) patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer the Work, where such license applies only to those patent claims licensable by such Contributor that are necessarily infringed by their Contribution(s) alone or by combination of their Contribution(s) with the Work to which such Contribution(s) was submitted. If You institute patent litigation against any entity (including a cross-claim or counterclaim in a lawsuit) alleging that the Work or a Contribution incorporated within the Work constitutes direct or contributory patent infringement, then any patent licenses granted to You under this License for that Work shall terminate as of the date such litigation is filed.

4. Redistribution. You may reproduce and distribute copies of the Work or Derivative Works thereof in any medium, with or without modifications, and in Source or Object form, provided that You meet the following conditions:

     (a) You must give any other recipients of the Work or Derivative Works a copy of this License; and

     (b) You must cause any modified files to carry prominent notices stating that You changed the files; and

     (c) You must retain, in the Source form of any Derivative Works that You distribute, all copyright, patent, trademark, and attribution notices from the Source form of the Work, excluding those notices that do not pertain to any part of the Derivative Works; and

     (d) If the Work includes a "NOTICE" text file as part of its distribution, then any Derivative Works that You distribute must include a readable copy of the attribution notices contained within such NOTICE file, excluding those notices that do not pertain to any part of the Derivative Works, in at least one of the following places: within a NOTICE text file distributed as part of the Derivative Works; within the Source form or documentation, if provided along with the Derivative Works; or, within a display generated by the Derivative Works, if and wherever such third-party notices normally appear. The contents of the NOTICE file are for informational purposes only and do not modify the License. You may add Your own attribution notices within Derivative Works that You distribute, alongside or as an addendum to the NOTICE text from the Work, provided that such additional attribution notices cannot be construed as modifying the License.

     You may add Your own copyright statement to Your modifications and may provide additional or different license terms and conditions for use, reproduction, or distribution of Your modifications, or for any such Derivative Works as a whole, provided Your use, reproduction, and distribution of the Work otherwise complies with the conditions stated in this License.

5. Submission of Contributions. Unless You explicitly state otherwise, any Contribution intentionally submitted for inclusion in the Work by You to the Licensor shall be under the terms and conditions of this License, without any additional terms or conditions. Notwithstanding the above, nothing herein shall supersede or modify the terms of any separate license agreement you may have executed with Licensor regarding such Contributions.

6. Trademarks. This License does not grant permission to use the trade names, trademarks, service marks, or product names of the Licensor, except as required for reasonable and customary use in describing the origin of the Work and reproducing the content of the NOTICE file.

7. Disclaimer of Warranty. Unless required by applicable law or agreed to in writing, Licensor provides the Work (and each Contributor provides its Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied, including, without limitation, any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A PARTICULAR PURPOSE. You are solely responsible for determining the appropriateness of using or redistributing the Work and assume any risks associated with Your exercise of permissions under this License.

8. Limitation of Liability. In no event and under no legal theory, whether in tort (including negligence), contract, or otherwise, unless required by applicable law (such as deliberate and grossly negligent acts) or agreed to in writing, shall any Contributor be liable to You for damages, including any direct, indirect, special, incidental, or consequential damages of any character arising as a result of this License or out of the use or inability to use the Work (including but not limited to damages for loss of goodwill, work stoppage, computer failure or malfunction, or any and all other commercial damages or losses), even if such Contributor has been advised of the possibility of such damages.

9. Accepting Warranty or Additional Liability. While redistributing the Work or Derivative Works thereof, You may choose to offer, and charge a fee for, acceptance of support, warranty, indemnity, or other liability obligations and/or rights consistent with this License. However, in accepting such obligations, You may act only on Your own behalf and on Your sole responsibility, not on behalf of any other Contributor, and only if You agree to indemnify, defend, and hold each Contributor harmless for any liability incurred by, or claims asserted against, such Contributor by reason of your accepting any such warranty or additional liability.

END OF TERMS AND CONDITIONS

APPENDIX: How to apply the Apache License to your work.

To apply the Apache License to your work, attach the following boilerplate notice, with the fields enclosed by brackets "[]" replaced with your own identifying information. (Don't include the brackets!)  The text should be enclosed in the appropriate comment syntax for the file format. We also recommend that a file or class name and description of purpose be included on the same "printed page" as the copyright notice for easier identification within third-party archives.

Copyright [yyyy] [name of copyright owner]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### BSD-3-Clause

```text
Copyright (c) <year> <owner>. 

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### ISC

```text
ISC License

Copyright <year> <owner> 

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Zlib

```text
zlib License

This software is provided 'as-is', without any express or implied warranty.  In no event will the authors be held liable for any damages arising from the use of this software.

Permission is granted to anyone to use this software for any purpose, including commercial applications, and to alter it and redistribute it freely, subject to the following restrictions:

     1. The origin of this software must not be misrepresented; you must not claim that you wrote the original software. If you use this software in a product, an acknowledgment in the product documentation would be appreciated but is not required.

     2. Altered source versions must be plainly marked as such, and must not be misrepresented as being the original software.

     3. This notice may not be removed or altered from any source distribution.
```

### BSL-1.0

```text
Boost Software License - Version 1.0 - August 17th, 2003

Permission is hereby granted, free of charge, to any person or organization obtaining a copy of the software and accompanying documentation covered by this license (the "Software") to use, reproduce, display, distribute, execute, and transmit the Software, and to prepare derivative works of the Software, and to permit third-parties to whom the Software is furnished to do so, all subject to the following:

The copyright notices in the Software and this entire statement, including the above license grant, this restriction and the following disclaimer, must be included in all copies of the Software, in whole or in part, and all derivative works of the Software, unless such copies or derivative works are solely in the form of machine-executable object code generated by a source language processor.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### MPL-2.0

```text
Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in 
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at https://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
```

### Unicode-3.0

```text
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 1991-2023 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.
```

### CC0-1.0

```text
Creative Commons Legal Code

CC0 1.0 Universal

    CREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE
    LEGAL SERVICES. DISTRIBUTION OF THIS DOCUMENT DOES NOT CREATE AN
    ATTORNEY-CLIENT RELATIONSHIP. CREATIVE COMMONS PROVIDES THIS
    INFORMATION ON AN "AS-IS" BASIS. CREATIVE COMMONS MAKES NO WARRANTIES
    REGARDING THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS
    PROVIDED HEREUNDER, AND DISCLAIMS LIABILITY FOR DAMAGES RESULTING FROM
    THE USE OF THIS DOCUMENT OR THE INFORMATION OR WORKS PROVIDED
    HEREUNDER.

Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer
exclusive Copyright and Related Rights (defined below) upon the creator
and subsequent owner(s) (each and all, an "owner") of an original work of
authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for
the purpose of contributing to a commons of creative, cultural and
scientific works ("Commons") that the public can reliably and without fear
of later claims of infringement build upon, modify, incorporate in other
works, reuse and redistribute as freely as possible in any form whatsoever
and for any purposes, including without limitation commercial purposes.
These owners may contribute to the Commons to promote the ideal of a free
culture and the further production of creative, cultural and scientific
works, or to gain reputation or greater distribution for their Work in
part through the use and efforts of others.

For these and/or other purposes and motivations, and without any
expectation of additional consideration or compensation, the person
associating CC0 with a Work (the "Affirmer"), to the extent that he or she
is an owner of Copyright and Related Rights in the Work, voluntarily
elects to apply CC0 to the Work and publicly distribute the Work under its
terms, with knowledge of his or her Copyright and Related Rights in the
Work and the meaning and intended legal effect of CC0 on those rights.

1. Copyright and Related Rights. A Work made available under CC0 may be
protected by copyright and related or neighboring rights ("Copyright and
Related Rights"). Copyright and Related Rights include, but are not
limited to, the following:

  i. the right to reproduce, adapt, distribute, perform, display,
     communicate, and translate a Work;
 ii. moral rights retained by the original author(s) and/or performer(s);
iii. publicity and privacy rights pertaining to a person's image or
     likeness depicted in a Work;
 iv. rights protecting against unfair competition in regards to a Work,
     subject to the limitations in paragraph 4(a), below;
  v. rights protecting the extraction, dissemination, use and reuse of data
     in a Work;
 vi. database rights (such as those arising under Directive 96/9/EC of the
     European Parliament and of the Council of 11 March 1996 on the legal
     protection of databases, and under any national implementation
     thereof, including any amended or successor version of such
     directive); and
vii. other similar, equivalent or corresponding rights throughout the
     world based on applicable law or treaty, and any national
     implementations thereof.

2. Waiver. To the greatest extent permitted by, but not in contravention
of, applicable law, Affirmer hereby overtly, fully, permanently,
irrevocably and unconditionally waives, abandons, and surrenders all of
Affirmer's Copyright and Related Rights and associated claims and causes
of action, whether now known or unknown (including existing as well as
future claims and causes of action), in the Work (i) in all territories
worldwide, (ii) for the maximum duration provided by applicable law or
treaty (including future time extensions), (iii) in any current or future
medium and for any number of copies, and (iv) for any purpose whatsoever,
including without limitation commercial, advertising or promotional
purposes (the "Waiver"). Affirmer makes the Waiver for the benefit of each
member of the public at large and to the detriment of Affirmer's heirs and
successors, fully intending that such Waiver shall not be subject to
revocation, rescission, cancellation, termination, or any other legal or
equitable action to disrupt the quiet enjoyment of the Work by the public
as contemplated by Affirmer's express Statement of Purpose.

3. Public License Fallback. Should any part of the Waiver for any reason
be judged legally invalid or ineffective under applicable law, then the
Waiver shall be preserved to the maximum extent permitted taking into
account Affirmer's express Statement of Purpose. In addition, to the
extent the Waiver is so judged Affirmer hereby grants to each affected
person a royalty-free, non transferable, non sublicensable, non exclusive,
irrevocable and unconditional license to exercise Affirmer's Copyright and
Related Rights in the Work (i) in all territories worldwide, (ii) for the
maximum duration provided by applicable law or treaty (including future
time extensions), (iii) in any current or future medium and for any number
of copies, and (iv) for any purpose whatsoever, including without
limitation commercial, advertising or promotional purposes (the
"License"). The License shall be deemed effective as of the date CC0 was
applied by Affirmer to the Work. Should any part of the License for any
reason be judged legally invalid or ineffective under applicable law, such
partial invalidity or ineffectiveness shall not invalidate the remainder
of the License, and in such case Affirmer hereby affirms that he or she
will not (i) exercise any of his or her remaining Copyright and Related
Rights in the Work or (ii) assert any associated claims and causes of
action with respect to the Work, in either case contrary to Affirmer's
express Statement of Purpose.

4. Limitations and Disclaimers.

 a. No trademark or patent rights held by Affirmer are waived, abandoned,
    surrendered, licensed or otherwise affected by this document.
 b. Affirmer offers the Work as-is and makes no representations or
    warranties of any kind concerning the Work, express, implied,
    statutory or otherwise, including without limitation warranties of
    title, merchantability, fitness for a particular purpose, non
    infringement, or the absence of latent or other defects, accuracy, or
    the present or absence of errors, whether or not discoverable, all to
    the greatest extent permissible under applicable law.
 c. Affirmer disclaims responsibility for clearing rights of other persons
    that may apply to the Work or any use thereof, including without
    limitation any person's Copyright and Related Rights in the Work.
    Further, Affirmer disclaims responsibility for obtaining any necessary
    consents, permissions or other rights required for any use of the
    Work.
 d. Affirmer understands and acknowledges that Creative Commons is not a
    party to this document and has no duty or obligation with respect to
    this CC0 or use of the Work.
```

### CDLA-Permissive-2.0

```text
Community Data License Agreement - Permissive - Version 2.0

This is the Community Data License Agreement - Permissive, Version 2.0 (the "agreement"). Data Provider(s) and Data Recipient(s) agree as follows:

1. Provision of the Data

1.1. A Data Recipient may use, modify, and share the Data made available by Data Provider(s) under this agreement if that Data Recipient follows the terms of this agreement.

1.2. This agreement does not impose any restriction on a Data Recipient's use, modification, or sharing of any portions of the Data that are in the public domain or that may be used, modified, or shared under any other legal exception or limitation.

2. Conditions for Sharing Data

2.1. A Data Recipient may share Data, with or without modifications, so long as the Data Recipient makes available the text of this agreement with the shared Data.

3. No Restrictions on Results

3.1. This agreement does not impose any restriction or obligations with respect to the use, modification, or sharing of Results.

4. No Warranty; Limitation of Liability

4.1. All Data Recipients receive the Data subject to the following terms:

THE DATA IS PROVIDED ON AN "AS IS" BASIS, WITHOUT REPRESENTATIONS, WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

NO DATA PROVIDER SHALL HAVE ANY LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING WITHOUT LIMITATION LOST PROFITS), HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE DATA OR RESULTS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

5. Definitions

5.1. "Data" means the material received by a Data Recipient under this agreement.

5.2. "Data Provider" means any person who is the source of Data provided under this agreement and in reliance on a Data Recipient's agreement to its terms.

5.3. "Data Recipient" means any person who receives Data directly or indirectly from a Data Provider and agrees to the terms of this agreement.

5.4. "Results" means any outcome obtained by computational analysis of Data, including for example machine learning models and models' insights.
```

### OFL-1.1

```text
SIL OPEN FONT LICENSE

Version 1.1 - 26 February 2007

PREAMBLE

The goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

DEFINITIONS

"Font Software" refers to the set of files released by the Copyright Holder(s) under this license and clearly marked as such. This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the copyright statement(s).

"Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting, or substituting — in part or in whole — any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS

Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.

5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.

TERMINATION

This license becomes null and void if any of the above conditions are not met.

DISCLAIMER

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Nota de cumplimiento

SinNotas es MIT. Ninguna de las dependencias de runtime es copyleft fuerte:

- PDFium es BSD-3-Clause/Apache-2.0 y su empaquetado es MIT.
- `pdfium-render` es MIT/Apache-2.0.
- La pila de FSRS-7 es MIT + BSD-3-Clause.
- Las dependencias npm son MIT, Apache-2.0, BSD-3-Clause o MPL-2.0
  (DOMPurify se usa bajo Apache-2.0).
- Las dependencias Rust son mayoritariamente MIT/Apache-2.0. Los crates
  `cssparser`, `dtoa-short`, `option-ext` y `selectors` son MPL-2.0
  (copyleft débil, a nivel de archivo); `notify` es CC0-1.0; `webpki-roots`
  y `webpki-root-certs` son CDLA-Permissive-2.0.
- Las fuentes de KaTeX son OFL-1.1, que permite incorporarlas y redistribuirlas
  con la aplicación.

No se incluye código AGPL.
