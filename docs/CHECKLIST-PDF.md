# Checklist — Documentos y lector PDF nativo (PDFium)

**Estado:** Fases 1–4 implementadas (documentos enlazados, texto, capturas y caducidad); pendiente prueba manual de la UI · **Última actualización:** 2026-11-03
**Rama de trabajo:** `master` (publicado en `v0.4.3`)
**Documento principal:** `docs/SinNotas.md`
**Endurecimiento relacionado:** `docs/CHECKLIST-SEGURIDAD-DOCUMENTOS-BIBLIOGRAFIA.md` (D1–D4)

Este documento es el punto de reanudación si una sesión de trabajo se corta a
mitad. La app debe seguir siendo MIT; el plugin de Anki
(`anki-search-inside-add-card`, AGPL-3.0) se usa **solo como referencia de
comportamiento**, nunca como fuente de código.

---

## 0. Reglas de reanudación después de una interrupción

> Leer esta sección **antes** de editar cualquier archivo.

1. Ejecutar `git status --short` y `git diff --stat`.
2. Revisar el diff completo de los archivos PDF antes de tocarlos:
   `git diff -- src-tauri/src/pdf src/views/pdf-view.ts src/desktop.ts index.html src/pdf.css`.
3. Si un archivo está sin seguimiento, leerlo entero con `sed`/`read` antes de
   escribir. No asumir que está completo.
4. Buscar restos de una ejecución cortada:
   `grep -RIn "SINNOTAS-PDF\|TODO-PDF\|FIXME-PDF" src src-tauri/src docs`.
5. Buscar errores de sintaxis antes de continuar:
   `npx tsc --noEmit` y `cargo check --manifest-path src-tauri/Cargo.toml --lib`.
6. **Nunca** ejecutar `git checkout --`, `git reset --hard`, `git clean -fd`,
   ni borrar un archivo PDF a medias. Una línea incompleta puede contener una
   decisión de API, una ruta o una firma que no está documentada en otro sitio.
7. Si un bloque no compila, **repararlo**, no eliminarlo. Si hay que
   reemplazarlo, copiar primero el contenido sospechoso a la sección
   «Restos de interrupciones» de este documento.
8. Continuar por el primer ítem con estado `[~]` o `[p]`. Si no hay ninguno,
   por el primer `[ ]` de la fase actual.
9. Marcar `[~]` al empezar un ítem y `[x]` solo después de verificarlo.
10. Antes de cambiar de fase, actualizar el estado de este documento y
    preguntar al usuario.

### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

### Restos de interrupciones

Anotar aquí cualquier bloque incompleto que se encuentre y la decisión tomada.
Si no hay restos, dejar «Ninguno».

- Ninguno.

---

## 1. Decisiones cerradas

- Motor: **PDFium** mediante `pdfium-render` 0.9.5, cargado dinámicamente.
- La UI sigue siendo TypeScript/HTML/CSS dentro del WebView de Tauri.
- La sección de la barra lateral se llama **Documentos** (ES), **Documents**
  (EN) y **文档** (ZH). Los identificadores internos siguen usando `pdf`.
- Los PDFs nuevos se **enlazan** desde su ubicación original; no se copian al
  vault. El registro vive en `.sinnotas/documents/links.json`.
- Los PDFs que ya estén en `assets/pdfs/` se siguen listando por compatibilidad.
- Quitar un enlace nunca borra el archivo original.
- Capturas de página en `assets/pdf-captures/` (fase posterior).
- Anotaciones en `.sinnotas/pdf/<sha256>.json` (fase posterior).
- La lectura no modifica el PDF original.
- Se mantiene MIT. No se copia código AGPL.
- La librería PDFium se empaqueta como recurso de Tauri; no se descarga en
  tiempo de ejecución.
- La carga de PDFium es perezosa: solo al abrir el lector o enlazar un PDF.
- Escritorio primero. Android/SAF queda para una fase posterior.

### Tamaños de referencia (PDFium build 8125)

| Plataforma | Librería sin comprimir |
| --- | ---: |
| Linux x86_64 | `libpdfium.so` 8.0 MB |
| Windows x86_64 | `pdfium.dll` 7.6 MB |
| macOS universal | `libpdfium.dylib` 15.2 MB |
| Android arm64 | `libpdfium.so` 6.6 MB |

---

## 2. Mapa de archivos

| Ruta | Responsabilidad |
| --- | --- |
| `src-tauri/Cargo.toml` | Dependencias `pdfium-render`, `image`. |
| `src-tauri/resources/pdfium/<target>/` | Librería nativa + licencia. |
| `src-tauri/src/pdf/mod.rs` | API pública del módulo y tipos serializables. |
| `src-tauri/src/pdf/engine.rs` | Carga perezosa de PDFium y render a PNG. |
| `src-tauri/src/pdf/storage.rs` | Listado de `assets/pdfs/`, registro de enlaces en `.sinnotas/documents/links.json`, validación y resolución. |
| `.sinnotas/documents/links.json` | Registro de documentos enlazados (vive en el vault, no en el repositorio). |
| `src-tauri/src/lib.rs` | Comandos Tauri, estado y registro en `generate_handler!`. |
| `src-tauri/tauri.conf.json` | `bundle.resources` de PDFium. |
| `src/views/pdf-view.ts` | Lógica de la vista del lector. |
| `src/pdf.css` | Estilos aislados del lector. |
| `src/types.ts` | Tipos `PdfListItem`, `PdfPageInfo`, `PdfDocumentInfo`. |
| `src/desktop.ts` | Navegación, inicialización y ciclo de vida de la vista. |
| `index.html` | Botón de navegación y panel `#view-pdf`. |
| `src/i18n.ts` | Etiquetas ES/EN/ZH. |
| `docs/SinNotas.md` | Resumen técnico y enlace a este checklist. |

---

## 3. Fases

### Fase 0 — Base y documentación

- [x] Explorar la arquitectura de SinNotas y el plugin de Anki.
- [x] Confirmar que no se puede reutilizar código AGPL manteniendo MIT.
- [x] Elegir PDFium nativo frente a PDF.js.
- [x] Medir el impacto de tamaño por plataforma.
- [x] Crear este checklist con reglas de reanudación.
- [x] Enlazar este checklist desde `docs/SinNotas.md`.

### Fase 1 — Infraestructura PDFium y lector mínimo

Objetivo: enlazar un PDF externo, abrirlo, ver la primera página y navegar
entre páginas. Sin capa de texto, sin selección y sin tarjetas.

#### 1.1 Dependencias Rust

- [x] Añadir `pdfium-render = { version = "0.9.5", default-features = false, features = ["pdfium_8125", "thread_safe"] }`.
- [x] Añadir `image = { version = "0.25", default-features = false, features = ["png"] }`.
- [x] Confirmar que no se activa la descarga automática de PDFium.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`.

#### 1.2 Librería nativa

- [x] Descargar PDFium build 8125 de `bblanchon/pdfium-binaries`.
- [x] Copiar Linux x86_64 a `src-tauri/resources/pdfium/linux-x86_64/libpdfium.so`.
- [x] Copiar `LICENSE` a `src-tauri/resources/pdfium/LICENSE`.
- [x] Añadir script `scripts/fetch-pdfium.sh` para otras plataformas.
- [x] Ignorar los binarios en `.gitignore` y documentar el fetch.
- [x] Resolver la ruta en dev (`CARGO_MANIFEST_DIR`) y en producción
      (`resource_dir`), con override `SINNOTAS_PDFIUM_PATH`.
- [x] Carga perezosa con `Mutex<Option<Pdfium>>`; no inicializar al arrancar la app.

#### 1.3 Módulo Rust

- [x] Crear `src-tauri/src/pdf/mod.rs` con tipos y API pública.
- [x] Crear `src-tauri/src/pdf/engine.rs` con `Pdfium` perezoso, apertura y
      render PNG.
- [x] Crear `src-tauri/src/pdf/storage.rs` con listado, validación de rutas y
      registro de documentos enlazados.
- [x] Validar extensión `.pdf`, tamaño máximo y cabecera `%PDF-`.
- [x] Enlazar el PDF externo sin copiarlo al vault.
- [x] Guardar el registro en `.sinnotas/documents/links.json` con escritura atómica.
- [x] Mantener el listado de PDFs antiguos en `assets/pdfs/`.
- [x] Devolver rutas internas normalizadas (`assets/pdfs/...` o `link:<uuid>`).
- [x] Marcar como «no encontrado» un enlace cuyo original desapareció.
- [x] Guardar caducidad opcional por enlace y purgar los caducados al listar.
- [x] Borrar PDFs de `assets/pdfs/` sin permitir rutas fuera de esa carpeta.
- [x] Guardar capturas validadas en `assets/pdf-captures/`.
- [x] Extraer texto por página como segmentos normalizados (`PdfTextPage`).
- [x] Serializar con `#[serde(rename_all = "camelCase")]`.
- [x] Limitar `targetWidth` a 320–2400 px.
- [x] Codificar la página como PNG para no enviar RGBA por JSON.

#### 1.4 Comandos Tauri

- [x] `pdf_list` → `PdfListItem[]`.
- [x] `pdf_open({ path })` → `PdfDocumentInfo`.
- [x] `pdf_render_page({ path, pageIndex, targetWidth })` → PNG (`ArrayBuffer`).
- [x] `pdf_import({ keepDays? })` → `PdfDocumentInfo | null` (selector nativo;
      guarda un enlace con caducidad opcional).
- [x] `pdf_unlink({ path })` → `boolean` (quita el enlace sin borrar el original).
- [x] `pdf_page_text({ path, pageIndex })` → `PdfTextPage`.
- [x] `pdf_set_expiry({ path, keepDays })` → `boolean`.
- [x] `pdf_delete({ path })` → `boolean` (enlaces o copias de `assets/pdfs/`).
- [x] `pdf_save_capture({ fileName, bytes })` → `SavedImagePath`.
- [x] Registrar todos los comandos en `generate_handler!`.
- [x] Verificar que los tipos nuevos son `pub(crate)` o `pub` según necesidad.

#### 1.5 Tipos TypeScript

- [x] Añadir `PdfListItem`, `PdfPageInfo`, `PdfDocumentInfo`.
- [x] Añadir `"pdf"` a `ViewType`.
- [x] Añadir `"pdf"` a `validViews` de `readLastNavigation`.

#### 1.6 Interfaz

- [x] Añadir `nav-pdf` a la barra lateral con la etiqueta «Documentos».
- [x] Añadir `section#view-pdf` con lista, toolbar y área de página.
- [x] Crear `src/views/pdf-view.ts`.
- [x] Crear `src/pdf.css` e importarlo desde `desktop.ts`.
- [x] Integrar `pdfView` en `switchView`, `navItems`, `panels` y listeners.
- [x] Cargar la lista de documentos al entrar en la vista, sin abrir ninguno.
- [x] Enlazar un PDF desde la vista; la apertura requiere un clic explícito.
- [x] Mostrar en la biblioteca qué documentos están enlazados y cuáles faltan.
- [x] Quitar enlaces desde la biblioteca sin borrar el archivo original.
- [x] Navegación anterior/siguiente y contador de página.
- [x] Ajuste a ancho del contenedor con `ResizeObserver`.
- [x] Liberar `objectUrl` anteriores para no filtrar memoria.
- [x] Mostrar estados vacío, cargando y error.
- [x] Añadir etiquetas ES/EN/ZH para «Documentos» y los estados de enlace.
- [x] Añadir selector de conservación al importar y por documento enlazado.
- [x] Añadir botón de borrar para todos los documentos de la biblioteca.
- [x] Añadir capa de texto, acciones flotantes y modo de captura.
- [x] Añadir modo «Editor al lado» con PDF y editor en paralelo.
- [x] Añadir divisor arrastrable entre PDF y editor, con límites de ancho,
      doble clic para restablecer, control por teclado y `role="separator"`.
- [x] Persistir la proporción del divisor en
      `sinnotas-pdf-editor-split-ratio` y ocultar el divisor fuera del modo
      paralelo.
- [?] Probar manualmente el arrastre con ratón, los límites en ventanas
      estrechas y la restauración tras reiniciar la app. En modo web ya se
      verificaron arrastre, teclado, doble clic y persistencia; falta la app
      Tauri con un PDF real y una ventana estrecha.
- [x] Agrandar los checkboxes de toda la app (20 px en ajustes).

#### 1.7 Verificación de Fase 1

- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`.
- [x] `npx tsc --noEmit`.
- [x] `npm test`.
- [?] Abrir la app, enlazar un PDF real y ver la página 1.
- [?] Confirmar que el PDF original no se copia al vault.
- [?] Quitar el enlace y confirmar que el archivo original sigue existiendo.
- [?] Navegar a la última página y volver a la primera.
- [?] Redimensionar la ventana y confirmar que la página se reajusta.
- [?] Cerrar y volver a abrir la vista sin recargar la app.

**Criterio de aceptación:** un PDF enlazado se muestra nítido, se puede
navegar, el archivo original no se duplica y no se envía ninguna imagen por JSON.

### Fase 2 — Capa de texto y selección

- [x] Extraer texto por página con posiciones (`FPDFText_*`).
- [x] Devolver `PdfTextPage { widthPoints, heightPoints, runs[] }`.
- [x] Pintar una capa HTML transparente sobre la imagen.
- [x] Selección nativa con ratón y teclado.
- [x] Copiar texto seleccionado.
- [x] Resaltar la selección.
- [x] Manejar PDFs escaneados sin texto.
- [ ] Pruebas con PDF de una columna, dos columnas y texto rotado.

### Fase 3 — Insertar texto en el editor

- [x] Botón «Insertar en la nota» para la selección.
- [x] Crear un bullet nuevo después del bloque activo.
- [ ] Escapar Markdown y preservar saltos de línea (de momento se normaliza el
      espacio y se conserva como texto plano en un bullet).
- [x] Insertar cita con origen (`pdf-source::`) sin crear tarjeta por sí sola.
- [ ] Cloze: `==texto== #card`.
- [ ] Insertar imagen de página completa como bloque de imagen.
- [ ] Deshacer/rehacer con el historial existente.
- [ ] Pruebas de tree-engine y del flujo de guardado.

### Fase 4 — Capturas y oclusiones

- [x] Seleccionar una región de la página.
- [x] Guardar recorte en `assets/pdf-captures/` con validación PNG y 5 MB.
- [x] Crear bloque `![...](assets/pdf-captures/...)`.
- [x] Reutilizar `openImageOcclusionEditor`.
- [x] Ofrecer «Insertar imagen» o «Crear oclusión» tras capturar.
- [ ] Añadir `image-occlusions::` automáticamente al bloque (hoy se añade al
      dibujar las áreas en el editor).
- [ ] Convertir la región en tarjeta de oclusión sin interacción adicional.
- [ ] No poner texto oculto como `hint`.
- [ ] Pruebas de coordenadas normalizadas y guardado completo del flujo.

### Fase 5 — Búsqueda, TOC, enlaces y anotaciones

- [ ] `pdf_search` con `FPDFText_FindStart`/`FindNext`.
- [ ] Panel de resultados y salto a página.
- [ ] Índice/bookmarks.
- [ ] Enlaces internos y externos.
- [ ] Zoom, rotación y modo ajuste.
- [ ] Miniaturas.
- [ ] Resaltados propios en `.sinnotas/pdf/<sha256>.json`.
- [ ] Última página y progreso de lectura.
- [ ] Pruebas de persistencia y migración.

### Fase 6 — Empaquetado y Android

- [ ] Configurar recursos por plataforma (Linux, Windows, macOS).
- [ ] Añadir paso de fetch/cache de PDFium en CI.
- [ ] Firmar/notarizar la dylib en macOS.
- [ ] Verificar AppImage, NSIS, DMG y `.deb`.
- [ ] Evaluar Android por ABI y SAF.
- [ ] Medir tamaño real de cada instalador.
- [ ] Documentar actualización de PDFium y checksums.

### Fase 7 — Cierre

- [ ] Actualizar `docs/SinNotas.md` con estado final.
- [ ] Añadir pruebas de regresión al CI.
- [ ] Revisar licencias de PDFium y dependencias.
- [ ] Probar PDFs dañados, cifrados y muy grandes.
- [ ] Revisar consumo de memoria y caché.

---

## 4. Contratos de la Fase 1

### `pdf_list`

Sin argumentos. Devuelve:

```ts
interface PdfListItem {
  relativePath: string; // "assets/pdfs/libro.pdf" o "link:<uuid>"
  title: string;
  fileSize: number;
  modified: number; // ms Unix
  linked: boolean;
  missing: boolean;
  sourcePath?: string | null; // ruta absoluta del original enlazado
}
```

### `pdf_open`

```ts
invoke<PdfDocumentInfo>("pdf_open", { path: "link:8f14e45f-..." })
```

```ts
interface PdfDocumentInfo {
  relativePath: string;
  title: string;
  pageCount: number;
  pages: PdfPageInfo[];
  fileSize: number;
  modified: number;
  linked: boolean;
  sourcePath?: string | null;
}

interface PdfPageInfo {
  index: number;
  widthPoints: number;
  heightPoints: number;
  label: string | null;
}
```

### `pdf_render_page`

```ts
const png = await invoke<ArrayBuffer>("pdf_render_page", {
  path: "assets/pdfs/libro.pdf",
  pageIndex: 0,
  targetWidth: 1200,
});
```

La respuesta es un PNG binario, no un `Vec<u8>` serializado como JSON.

### `pdf_import`

Sin argumentos. Abre el selector nativo y guarda un **enlace** al PDF elegido
en `.sinnotas/documents/links.json`; no copia el archivo. Devuelve `null` si el
usuario cancela. En móvil devuelve un error claro hasta la fase 6.

### `pdf_unlink`

```ts
const removed = await invoke<boolean>("pdf_unlink", { path: "link:<uuid>" });
```

Quita la entrada del registro. No borra ni modifica el archivo original.

---

## 5. Reglas de seguridad

- Nunca aceptar rutas absolutas desde el frontend para abrir un PDF del vault.
- Resolver siempre los PDFs del vault con `resolve_vault_path` y comprobar que
  el archivo está dentro del root canónico.
- Los documentos externos solo se resuelven por `link:<uuid>` contra el
  registro interno; el frontend nunca envía su ruta absoluta.
- Rechazar URIs (`http:`, `file:`, `content:`), `..` y bytes nulos.
- Rechazar archivos que no contengan `%PDF-` en los primeros 1024 bytes; se
  permite un prefijo antes de la cabecera.
- Límite de importación: 250 MB.
- D1–D4 están detallados en
  `docs/CHECKLIST-SEGURIDAD-DOCUMENTOS-BIBLIOGRAFIA.md`: registro/capturas,
  autoapertura, revalidación/límites y rutas absolutas.
- No ejecutar JavaScript embebido en el PDF.
- No escribir en el PDF original.
- No usar `hint` de oclusión con el texto que se quiere ocultar.
- PDFium es C++ nativo: mantenerlo actualizado y registrar la versión usada.

---

## 6. Comandos de verificación

```bash
# Rust
cargo check --manifest-path src-tauri/Cargo.toml --lib

# TypeScript
npx tsc --noEmit

# Pruebas del frontend
npm test

# Buscar restos de interrupciones
grep -RIn "SINNOTAS-PDF\|TODO-PDF\|FIXME-PDF" src src-tauri/src docs

# Diff de la fase
git diff --stat
git diff -- src-tauri/src/pdf src/views/pdf-view.ts src/desktop.ts index.html src/pdf.css
```

---

## 7. Registro de sesiones

| Fecha | Fase | Cambios | Verificación |
| --- | --- | --- | --- |
| 2026-11-01 | 0 | Checklist y decisiones | Documento creado |
| 2026-11-01 | 1 | Dependencias, motor PDFium, comandos y lector mínimo | `cargo check`; `cargo test` (5 pruebas PDF); `tsc`; `npm test` (324 pruebas) |
| 2026-11-01 | 1 | Sección «Documentos», importación por enlace en `.sinnotas/documents/links.json`, quitar enlaces y estado de archivo ausente | `cargo check`; `cargo test` (8 pruebas PDF); `tsc`; `npm test` (324 pruebas) |
| 2026-11-01 | 2–4 | Capa de texto seleccionable, inserción en la nota con `pdf-source::`, capturas en `assets/pdf-captures/`, borrado de documentos, caducidad de enlaces y checkboxes más grandes | `cargo check`; `cargo test --lib pdf::` (12 pruebas); `tsc`; `npm test` (325 pruebas); `npm run build` |
| 2026-11-02 | D1–D4 | Registro/capturas con `resolve_vault_path`, sin autoapertura, revalidación y límites de render, rutas absolutas fuera de la API | `cargo test --lib` (87 pruebas); `npm test` (356 pruebas); `tsc`; `cargo check` |
| 2026-11-03 | UI PDF | Divisor arrastrable entre PDF y editor, límites de ancho, control por teclado, doble clic para restablecer y proporción persistente | `tsc`; `npm test` (356 pruebas); `npm run build`; prueba de humo en modo web con arrastre, teclado, doble clic y recarga |

---

## 8. Pendientes inmediatos al reanudar

1. Si la app no está compilando, leer el primer error de `cargo check` y
   revisar `src-tauri/src/pdf/`.
2. Si la vista no aparece, comprobar que `#view-pdf` existe en `index.html` y
   que `switchView` incluye `"pdf"` en `navItems` y `panels`.
3. Si PDFium no carga, comprobar la ruta con:
   `ls -l src-tauri/resources/pdfium/linux-x86_64/libpdfium.so` y definir
   `SINNOTAS_PDFIUM_PATH` si hace falta.
4. Si una página sale en blanco, verificar que el PNG se genera y que el
   `objectUrl` se revoca solo después de cargar la nueva imagen.
5. Si un documento enlazado no abre, comprobar el registro:
   `cat <vault>/.sinnotas/documents/links.json` y que la ruta `path` siga
   existiendo.
6. Antes de empezar la Fase 5 (búsqueda, TOC, anotaciones), consultar al usuario
   y actualizar este archivo.
