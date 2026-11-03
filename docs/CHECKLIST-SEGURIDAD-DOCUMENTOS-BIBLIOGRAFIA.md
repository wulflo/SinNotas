# Checklist — Endurecimiento de seguridad: Documentos y Bibliografía

**Estado:** Fases 1–8 implementadas y publicadas en `v0.4.3`; B4 (búsqueda de metadatos) implementada y verificada automáticamente; matriz manual pendiente · **Última actualización:** 2026-11-03
**Origen:** auditoría de solo lectura de Documentos/PDF y Bibliografía.
**Rama de trabajo:** `master`
**Documento principal:** `docs/SinNotas.md`
**Checklist relacionado:** `docs/CHECKLIST-PDF.md`, `docs/CHECKLIST-BUSQUEDA-BIBLIOGRAFIA.md`

> Este documento registra la auditoría, las decisiones y la implementación. Los
> números de línea son orientativos para la auditoría del 2026-11-02; si
> cambian, buscar por el símbolo indicado.
>
> Las fases se implementaron en el orden D1 → B1 → D2 → D3 → D4 → B2 → B3 y se
> publicaron juntas en la release `v0.4.3`; el historial no se separó por fase.
>
> **B4 — búsqueda de metadatos (2026-11-03):** la nueva búsqueda por DOI, ISBN y
> palabras clave añade una superficie de red saliente. Se implementó en Rust con
> hosts constantes, HTTPS, sin redirecciones, `rustls`, timeouts, límite de
> respuesta, rate limit, caché en memoria y allowlist de portadas. El frontend no
> construye URLs. El diseño completo, el modelo de amenaza y la matriz manual
> están en [`docs/CHECKLIST-BUSQUEDA-BIBLIOGRAFIA.md`](CHECKLIST-BUSQUEDA-BIBLIOGRAFIA.md);
> este documento solo registra que la superficie B4 no altera las invariantes
> D1–D4 ni B1–B3.

---

## 0. Cómo usar este checklist

### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

### Reglas de trabajo

1. **No descartar el trabajo previo.** Los cambios de Bibliografía
   (`index.html`, `src/desktop.ts`, `src/i18n.ts`, `src/style.css`,
   `src/types.ts` y archivos nuevos de Bibliografía) se conservaron y forman
   parte de `v0.4.3`. No usar `git reset --hard`, `git clean -fd` ni
   `git checkout --` sobre ellos.
2. **Una release para el grupo de seguridad.** El trabajo de Bibliografía y el
   endurecimiento se publicaron juntos en `master` como `v0.4.3`.
3. **Commits pequeños por fase.** No mezclar D1 con B1 ni un fix de seguridad
   con un refactor de UI.
4. **El backend es la fuente de verdad.** Una validación solo en el frontend no
   cierra un hallazgo de contención de archivos.
5. **No usar una bóveda real para pruebas destructivas.** Crear bóvedas
   temporales en `/tmp/opencode` o en el directorio temporal del sistema.
6. **No tocar artefactos generados:** `dist/`, `src-tauri/target/`,
   `node_modules/`, APK firmadas ni `.sinnotas/` de una bóveda real.
7. **Actualizar este checklist al terminar cada fase.** Marcar `[x]` solo
   después de cumplir el criterio de aceptación y las pruebas.

---

## 1. Resumen de hallazgos y orden

| ID | Área | Severidad | Objetivo | Estado |
| --- | --- | --- | --- | --- |
| D1 | Documentos | Media | Evitar escrituras fuera del vault por symlinks en registro y capturas. | `[?]` |
| B1 | Bibliografía | Media en web / Baja en Tauri | Validar portadas remotas antes de cargarlas. | `[?]` |
| D2 | Documentos | Media | Eliminar la autoapertura y no confiar en rutas de `links.json`. | `[?]` |
| D3 | Documentos | Baja-media | Revalidar cabecera/tamaño al abrir y limitar recursos de render. | `[?]` |
| D4 | Documentos | Baja | No exponer rutas absolutas de PDFs en la UI. | `[?]` |
| B2 | Bibliografía | Baja | Evitar que títulos con `[]` o saltos de línea rompan wikilinks. | `[?]` |
| B3 | Bibliografía | Baja | Alinear la validación de portadas del modo web con Tauri. | `[?]` |
| B4 | Bibliografía | Media | Búsqueda de metadatos por DOI/ISBN/palabras clave solo desde Rust, con red restringida. | `[x]` |

### Hallazgos que no se corrigen en este plan

- **PDFium nativo sin sandbox:** riesgo residual aceptado. Mantener la versión
  actualizada y no autoabrir PDFs reduce la exposición, pero no elimina una
  vulnerabilidad del parser nativo.
- **DNS rebinding en portadas remotas:** si se permite cualquier host público,
  `isAllowedRemoteImageUrl` no protege frente a un DNS que resuelva a una IP
  privada después de la validación. La opción más segura es no permitir
  portadas remotas; si se permiten, documentar esta limitación.
- **Rediseño de la UI:** fuera de alcance. Los fixes deben conservar la
  experiencia actual salvo la eliminación de la autoapertura.

---

## 2. Estado de partida

- [x] Auditoría de solo lectura completada (2026-11-02).
- [x] Ejecutar `git status --short` y `git diff --stat`.
- [x] Revisar el diff actual de Bibliografía antes de tocarlo:
      `git diff -- index.html src/desktop.ts src/i18n.ts src/style.css src/types.ts`.
- [x] Confirmar que los archivos nuevos de Bibliografía están completos y no
      son restos de una ejecución interrumpida.
- [x] Ejecutar la línea base:
      `npx tsc --noEmit`,
      `npm test`,
      `npm run build`,
      `cargo check --manifest-path src-tauri/Cargo.toml --lib`,
      `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
- [x] Publicar el trabajo sobre `master` en la release `v0.4.3`, sin crear una
      rama separada.
- [x] Anotar en este documento cualquier prueba que falle antes de empezar. No
      hubo fallos de línea base.

### Baseline esperado

- `npx tsc --noEmit` sin errores.
- Suite de Vitest en verde.
- `npm run build` correcto.
- `cargo check` y `cargo test --lib` correctos.
- Si falta PDFium y alguna prueba Rust se omite, anotarlo; no es un fallo del
  cambio.

---

## 3. Mapa de archivos

| Ruta | Responsabilidad en este plan |
| --- | --- |
| `src-tauri/src/pdf/storage.rs` | Registro `links.json`, capturas, validación, resolución y tests PDF. |
| `src-tauri/src/pdf/mod.rs` | Tipos serializables y API `open`/`render`/`page_text`. |
| `src-tauri/src/pdf/engine.rs` | Carga de PDFium, inspección, render PNG y límites. |
| `src-tauri/src/lib.rs` | Comandos Tauri, `resolve_vault_path`, `write_file_atomically`, `validate_image_file`. |
| `src/views/pdf-view.ts` | Autoapertura, lista, tooltip y flujo de captura. |
| `src/types.ts` | Tipos `PdfListItem`/`PdfDocumentInfo`. |
| `src/desktop.ts` | `resolveImageUrl`, portadas, bibliografía y escritura de notas. |
| `src/editor/url-safety.ts` | Validación de URLs remotas y tests. |
| `src/views/bibliography.ts` | Frontmatter, wikilinks y tests. |
| `src/views/bibliography-view.ts` | UI de Bibliografía y modales. |
| `src/deck-title.ts` | Saneado de títulos de página. |
| `index.html` | CSP del modo web, si se decide soportarlo. |
| `docs/SinNotas.md` | Política de seguridad y enlace a este checklist. |
| `docs/CHECKLIST-PDF.md` | Reglas específicas del lector PDF. |

---

## 4. Fases de implementación

### Fase 1 — D1: contención de registro y capturas

**Objetivo:** que ninguna ruta interna de PDF pueda leer o escribir fuera del
vault mediante symlinks.

**Evidencia de la auditoría:**

- `registry_path` usa `root.join(LINKS_FOLDER).join(LINKS_FILE)` y
  `load_registry`/`save_registry` escriben directamente
  (`src-tauri/src/pdf/storage.rs:116-141`).
- `save_capture` usa `root.join(CAPTURE_FOLDER)`, `create_dir_all` y `fs::write`
  sin `resolve_vault_path` (`src-tauri/src/pdf/storage.rs:518-532`).
- `write_file_atomically` crea el temporal en el directorio padre y hace
  `rename` (`src-tauri/src/lib.rs:4260-4303`), por lo que sigue un symlink de
  carpeta.
- `pdf_list` purga enlaces caducados y guarda el registro al entrar
  (`src-tauri/src/pdf/storage.rs:245-258`).

**Tareas:**

- [x] Añadir en `storage.rs` un helper interno, por ejemplo
      `resolve_pdf_internal_path(root, relative)`, que delegue en
      `crate::resolve_vault_path` y devuelva `Result<PathBuf, String>`.
- [x] Hacer que `load_registry` y `save_registry` usen el helper para
      `.sinnotas/documents/links.json`.
- [x] Mantener `registry_path` solo si lo usan los tests; si se conserva, que
      no sea la ruta usada para leer/escribir.
- [x] Hacer que `save_capture` resuelva `assets/pdf-captures` con el helper
      antes de `create_dir_all`.
- [x] Resolver también el archivo final de captura con el helper.
- [x] Sustituir `fs::write` por `OpenOptions::new().write(true).create_new(true)`
      para no seguir symlinks de archivo y evitar el TOCTOU.
- [x] Si `create_new` devuelve `AlreadyExists`, probar el siguiente nombre;
      si el error es de symlink o de ruta fuera del vault, fallar con un error
      claro.
- [x] Revisar que no quede ningún `root.join(CAPTURE_FOLDER)` ni
      `root.join(LINKS_FOLDER)` en rutas de escritura.
- [x] Añadir tests Rust en `storage.rs`:
  - [x] `.sinnotas` o `.sinnotas/documents` symlink a una carpeta externa:
        `load_registry`/`save_registry` fallan y no crean el archivo fuera.
  - [x] `links.json` symlink a un archivo externo: la lectura/escritura se
        rechaza.
  - [x] `assets/pdf-captures` symlink a una carpeta externa: `save_capture`
        falla y no crea el PNG fuera.
  - [x] Symlink de archivo de captura a un archivo externo: no se sobrescribe.
  - [x] Caso válido: captura dentro de una carpeta nueva del vault sigue
        funcionando.
  - [x] Los tests de symlink deben ir bajo `#[cfg(unix)]`; en Windows se
        omiten si no hay privilegios.
- [x] Ejecutar `cargo test --manifest-path src-tauri/Cargo.toml --lib`.

**Criterio de aceptación:**

- [?] Entrar en Documentos con un `.sinnotas` symlink no escribe fuera del
      vault. Cubierto por tests unitarios; falta la prueba manual de UI.
- [x] Guardar una captura con `assets/pdf-captures` symlink no escribe fuera
      del vault.
- [x] No se pierden las capturas válidas ni el registro normal.
- [x] `cargo test --lib` en verde.

**Resultado (2026-11-02):** D1 implementado en
`src-tauri/src/pdf/storage.rs`. `cargo test --manifest-path
src-tauri/Cargo.toml --lib` termina con **83 pruebas correctas**. La prueba
manual de la vista Documentos queda para la verificación global.

---

### Fase 2 — B1: validación de portadas remotas

**Objetivo:** que una portada remota de una bóveda no confiable no genere
peticiones a hosts no permitidos.

**Evidencia de la auditoría:**

- `resolveImageUrl` devuelve `http:`, `https:` y `blob:` directamente
  (`src/desktop.ts:4644-4647`).
- En modo no Tauri, `imageSourceUrl` devuelve cualquier fuente no bloqueada,
  incluida `//host/imagen.png` (`src/desktop.ts:4633-4637`).
- `resolveBibliographyCover` solo delega en `resolveImageUrl`
  (`src/desktop.ts:5215-5221`).
- `isAllowedRemoteImageUrl` ya existe y se usa para imágenes pegadas/descargadas
  (`src/desktop.ts:4810-4822`, `src/editor/url-safety.ts:126-139`).
- La CSP de Tauri bloquea imágenes remotas (`src-tauri/tauri.conf.json:27`),
  pero el HTML web no tiene CSP equivalente.

**Tareas:**

- [x] Añadir en `src/editor/url-safety.ts` un helper, por ejemplo
      `resolveAllowedRemoteImageUrl(source, base)`, que:
  - [x] Resuelva URLs protocol-relative (`//host/ruta`) con
        `new URL(source, base)`.
  - [x] Acepte `http:`/`https:` solo si `isAllowedRemoteImageUrl` devuelve
        `true`.
  - [x] Rechace `javascript:`, `vbscript:` y esquemas desconocidos.
  - [x] Deje pasar solo `data:image/` y `blob:` si se decide mantenerlos.
  - [x] Devuelva `null` para fuentes locales, que deben seguir resolviéndose
        por `resolve_image_path`.
- [x] Añadir tests en `src/editor/url-safety.test.ts`:
  - [x] `https://example.com/portada.png` permitida.
  - [x] `http://127.0.0.1:8080/x.png` rechazada.
  - [x] `http://localhost/x.png` rechazada.
  - [x] `//127.0.0.1/x.png` rechazada.
  - [x] `//example.com/x.png` resuelta y validada como URL absoluta.
  - [x] `data:image/png;base64,...` permitida.
  - [x] `javascript:...` rechazada.
- [x] Usar el helper en `imageSourceUrl` y `resolveImageUrl` para cubrir
      portadas y, de paso, imágenes de notas.
- [x] Como mínimo, usarlo en `resolveBibliographyCover` si no se quiere cambiar
      el comportamiento global de imágenes. `resolveBibliographyCover` usa
      `resolveImageUrl`, que ya aplica el helper.
- [x] Si la URL se rechaza, devolver `null`; la tarjeta debe mostrar el
      placeholder y no dejar una imagen remota cargando.
- [x] Mantener las rutas locales de portada pasando por `resolve_image_path` y
      `resolve_vault_path`.
- [x] Documentar la decisión sobre portadas remotas: se elige la **Opción B**
      (permitir solo hosts públicos con el helper). En Tauri la CSP seguirá
      bloqueando las portadas remotas; en modo web se permite una URL pública
      validada. La Opción A (solo locales) queda como alternativa si se decide
      endurecer más adelante.
- [x] Decidir la CSP del modo web en esta fase: **no se añade**. El modo web no
      se considera un entorno soportado para bóvedas no confiables y la defensa
      principal es la validación en código. Se revisará en la Fase 8 si se
      confirma que el modo web es un objetivo de producto.
- [?] Prueba manual en web: abrir una bibliografía con
      `bib-portada: http://127.0.0.1:...`, `//127.0.0.1/...` y una URL pública;
      comprobar en la pestaña Network que no hay peticiones no permitidas.
- [?] Prueba manual en Tauri: confirmar que la CSP sigue bloqueando las remotas.

**Criterio de aceptación:**

- [?] Ninguna portada `http://127.0.0.1`, `localhost` o `//host` genera una
      petición. Cubierto por tests de `url-safety`; falta la prueba manual.
- [x] Las portadas locales siguen funcionando.
- [x] Las URLs permitidas se resuelven correctamente.
- [x] La decisión sobre CSP web queda documentada.

**Resultado (2026-11-02):** B1 implementado en `src/editor/url-safety.ts` y
aplicado en `src/desktop.ts`. `npm test -- src/editor/url-safety.test.ts`
termina con **16 pruebas correctas**, `npm test` completo con **348 pruebas
correctas** y `npx tsc --noEmit` pasa sin errores. Las pruebas manuales de red
quedan para la verificación global.

---

### Fase 3 — D2: quitar autoapertura y validar `links.json`

**Objetivo:** que abrir Documentos no parsee un PDF sin acción del usuario y
que una entrada manipulada del registro no abra una ruta arbitraria.

**Evidencia de la auditoría:**

- `onActivate` llama a `refreshLibrary(true)` la primera vez y abre el primer
  PDF disponible (`src/views/pdf-view.ts:217-226`).
- `refreshLibrary` abre el primer elemento si `autoOpen` es verdadero
  (`src/views/pdf-view.ts:376-389`).
- `pdf_list` incluye los enlaces del registro (`src-tauri/src/pdf/storage.rs:261-279`).
- `resolve_document` canonicaliza `link.path` y solo comprueba que sea archivo y
  `.pdf`; no exige ruta absoluta ni rechaza `..` (`src-tauri/src/pdf/storage.rs:338-363`).

**Tareas:**

- [x] Cambiar `onActivate` para llamar a `refreshLibrary()` sin autoapertura.
- [x] Eliminar el bloque que abre `firstAvailable` al activar la vista.
- [x] Simplificar `refreshLibrary(autoOpen: boolean)` a `refreshLibrary()` sin
      parámetro.
- [x] Actualizar la llamada de `deleteItem` (`src/views/pdf-view.ts:934`).
- [?] Asegurar que el estado vacío del lector se muestra correctamente cuando
      hay documentos pero ninguno está abierto. El código deja el estado vacío
      y actualiza la cabecera; falta comprobarlo visualmente.
- [x] En `resolve_document`, para `link:<id>`:
  - [x] Rechazar `link.path` vacío o con bytes NUL.
  - [x] Exigir que `link.path` sea absoluto.
  - [x] Rechazar componentes `ParentDir` (`..`).
  - [x] Canonicalizar y comprobar `is_file()` y `is_pdf_path()`.
  - [x] Devolver un error claro si la entrada del registro es inválida.
- [x] En `list`, validar las entradas de enlaces antes de `fs::metadata`:
      una ruta inválida debe mostrarse como `missing: true` sin romper toda la
      lista.
- [x] Mantener el comportamiento de `link_pdf`: guarda siempre una ruta
      canónica absoluta.
- [x] Añadir tests Rust:
  - [x] Registro con ruta relativa: `resolve_document` falla.
  - [x] Registro con `../archivo.pdf`: falla.
  - [x] Registro con ruta absoluta válida: sigue funcionando.
  - [x] `list` con una entrada inválida no falla y la marca como missing.
- [?] Prueba manual: bóveda con `assets/pdfs/a.pdf`; entrar en Documentos no
      debe renderizar nada hasta hacer clic.
- [?] Prueba manual: `links.json` con una ruta manipulada; al hacer clic debe
      mostrar error, no abrir el archivo.

**Criterio de aceptación:**

- [?] Entrar en Documentos no llama a PDFium. Cubierto por el flujo de código;
      falta la prueba manual.
- [?] Solo se abre un PDF tras un clic explícito. Cubierto por el flujo de
      código; falta la prueba manual.
- [x] Rutas de registro relativas o con `..` se rechazan.
- [x] La lista sigue mostrando los enlaces válidos y los missing.

**Resultado (2026-11-02):** D2 implementado en `src/views/pdf-view.ts` y
`src-tauri/src/pdf/storage.rs`. `cargo test --manifest-path
src-tauri/Cargo.toml --lib` termina con **84 pruebas correctas** y
`npx tsc --noEmit` pasa sin errores. Las pruebas manuales de UI quedan para la
verificación global.

---

### Fase 4 — D3: revalidación y límites de recursos

**Objetivo:** no entregar a PDFium archivos que no cumplan las reglas de
importación y evitar renders desproporcionados.

**Evidencia de la auditoría:**

- `validate_pdf_source` solo se usa al importar/enlazar
  (`src-tauri/src/pdf/storage.rs:174-202`).
- `resolve_pdf` y `resolve_document` no revalidan cabecera ni tamaño
  (`src-tauri/src/pdf/storage.rs:292-317`, `338-363`).
- `engine::open_document` carga el archivo directamente
  (`src-tauri/src/pdf/engine.rs:146-149`).
- `render_png` limita el ancho a 320–2400, pero no el alto ni los píxeles
  (`src-tauri/src/pdf/engine.rs:254-281`).
- `inspect` recorre todas las páginas (`src-tauri/src/pdf/engine.rs:152-172`).

**Tareas:**

- [x] Añadir una función de resolución para apertura, por ejemplo
      `resolve_document_for_open`, que llame a `resolve_document` y después a
      `validate_pdf_source` sobre la ruta resultante.
- [x] Usarla en `pdf::open`, `pdf::render_page` y `pdf::page_text`.
- [x] Mantener `pdf::delete_document` con la resolución actual para que se
      puedan borrar archivos inválidos de `assets/pdfs/` sin depender de que
      PDFium los abra.
- [x] Definir y documentar constantes:
  - [x] `MAX_PDF_PAGES = 10_000`.
  - [x] `MAX_RENDER_WIDTH = 2_400`.
  - [x] `MAX_RENDER_HEIGHT = 12_000`.
  - [x] `MAX_RENDER_PIXELS = 24_000_000`.
  - [x] `MAX_TEXT_RUNS = 50_000` para limitar los fragmentos de texto por
        página.
- [x] En `inspect`, rechazar PDFs que superen `MAX_PDF_PAGES` con un error
      claro antes de reservar el vector de páginas.
- [x] En `render_png`, calcular el alto proporcional antes de renderizar:
  - [x] Si el alto o los píxeles superan el límite, reducir el ancho objetivo.
  - [x] Si ni con el ancho mínimo cabe, rechazar la página con un error claro.
- [x] En `encode_png`, comprobar dimensiones y píxeles antes de
      `as_rgba_bytes`/`from_raw` como defensa adicional.
- [x] Limitar los runs de texto por página con `MAX_TEXT_RUNS`; al superar el
      límite se devuelve un error en lugar de seguir acumulando memoria.
- [x] Decidir qué hacer con la cabecera PDF: se mantiene la búsqueda de `%PDF-`
      en los primeros 1024 bytes, porque la especificación permite un prefijo
      antes de la cabecera. Se documenta en el código y no se exige que el
      archivo empiece estrictamente por `%PDF-`.
- [x] Añadir tests Rust:
  - [x] Un `.pdf` con contenido no PDF se rechaza antes de PDFium.
  - [x] Un PDF de prueba válido sigue abriéndose.
  - [x] Un enlace externo con extensión `.pdf` pero sin cabecera se rechaza.
  - [x] La función de cálculo de dimensiones reduce o rechaza un aspecto
        extremo.
  - [x] El límite de páginas se comprueba con `ensure_page_count`.
- [?] Prueba manual: reemplazar un PDF del vault por texto y confirmar que la
      app muestra error sin cerrarse.
- [?] Prueba manual: PDF con página de aspecto extremo, si se dispone de uno;
      confirmar que no se produce un consumo de memoria descontrolado.

**Criterio de aceptación:**

- [x] Ningún PDF sin cabecera o por encima del límite llega a PDFium: las tres
      rutas de apertura usan `resolve_document_for_open` y el motor comprueba
      el número de páginas.
- [x] Los PDFs normales se siguen abriendo y renderizando.
- [x] Una página de aspecto extremo se reduce o se rechaza con error.
- [x] `cargo test --lib` en verde.

**Resultado (2026-11-02):** D3 implementado en
`src-tauri/src/pdf/storage.rs`, `src-tauri/src/pdf/engine.rs` y
`src-tauri/src/pdf/mod.rs`. `rustfmt --check` pasa y `cargo test
--manifest-path src-tauri/Cargo.toml --lib` termina con **87 pruebas
correctas**. Las pruebas manuales de archivos dañados y aspectos extremos
quedan para la verificación global.

---

### Fase 5 — D4: dejar de exponer rutas absolutas

**Objetivo:** que el frontend no reciba la ruta absoluta de un PDF enlazado.

**Evidencia de la auditoría:**

- `PdfListItem.source_path` y `PdfDocumentInfo.source_path` se serializan
  (`src-tauri/src/pdf/mod.rs:33-35`, `64-66`).
- La lista lo usa como tooltip (`src/views/pdf-view.ts:337`).
- También se rellena en el resultado de importación
  (`src/views/pdf-view.ts:863`).

**Tareas:**

- [x] Eliminar `source_path` de los tipos públicos `PdfListItem` y
      `PdfDocumentInfo` en Rust y en `src/types.ts`.
- [x] Eliminar también el campo interno `ResolvedDocument::source_path`, que ya
      no se necesita; no se serializa ninguna ruta absoluta.
- [x] Actualizar los constructores de `list`, `open` e `import`.
- [x] Sustituir el tooltip `button.title = item.sourcePath || item.relativePath`
      por el título visible (`item.title || item.relativePath`).
- [x] Actualizar `PdfReaderView` para no copiar `sourcePath` del resultado de
      importación.
- [x] Actualizar tests que comprobaban `source_path`; la prueba de enlaces
      comprueba además que el JSON serializado no contiene `sourcePath`.
- [x] Verificar que no queda ningún `sourcePath` de PDF en la UI:
      `grep -RIn "sourcePath\\|source_path" src/views/pdf-view.ts src/types.ts`
      solo encuentra `Backlink.source_path`, que no pertenece a PDF.
- [?] Prueba manual: abrir un enlace externo y comprobar que el tooltip no
      muestra la ruta del sistema.

**Criterio de aceptación:**

- [x] El frontend no recibe rutas absolutas de PDFs.
- [x] La UI sigue distinguiendo documentos del vault y enlaces externos mediante
      `linked` y `missing`.
- [x] `npx tsc --noEmit` y `cargo check` en verde.

**Resultado (2026-11-02):** D4 implementado en
`src-tauri/src/pdf/mod.rs`, `src-tauri/src/pdf/storage.rs`, `src/types.ts` y
`src/views/pdf-view.ts`. `cargo test --lib` con **87 pruebas**, `npm test` con
**348 pruebas**, `npx tsc --noEmit` y `cargo check` pasan. La prueba manual del
tooltip queda para la verificación global.

---

### Fase 6 — B2: títulos seguros en wikilinks

**Objetivo:** que un título con `[`, `]`, `\r` o `\n` no rompa el wikilink ni
inyecte Markdown en una nota nueva.

**Evidencia de la auditoría:**

- `sanitizeDeckTitle` no elimina `[`/`]` ni saltos de línea
  (`src/deck-title.ts:45-49`).
- `createBibliographyLinkedNote` interpola `[[${item.page.title}]]`
  (`src/desktop.ts:5124-5138`).
- `pageLinksToTitle` usa el mismo patrón (`src/views/bibliography.ts:324-326`).
- El frontmatter ya está protegido por `quoteYamlScalar`
  (`src/views/bibliography.ts:138-144`).

**Tareas:**

- [x] Añadir una función `sanitizeWikilinkTitle` en `bibliography.ts`:
  - [x] Convertir `\r` y `\n` en espacio.
  - [x] Reemplazar `[` y `]` por paréntesis seguros.
  - [x] Colapsar espacios y hacer `trim`; si queda vacío, usar `Sin título`.
- [x] Añadir `bibliographyWikilink(title)` para construir el cuerpo de forma
      segura y reutilizable.
- [x] Usarla al construir el cuerpo de `createBibliographyLinkedNote`.
- [x] Actualizar `pageLinksToTitle` para que siga reconociendo notas antiguas
      con el título original y las nuevas con el título saneado.
- [x] Mantener el frontmatter `bib-padre` con el título completo; ya está
      citado correctamente por `quoteYamlScalar`.
- [x] Añadir tests en `src/views/bibliography.test.ts`:
  - [x] Un título con `]]` no inyecta contenido adicional en el cuerpo; el
        wikilink conserva un único cierre `]]`.
  - [x] Un título con salto de línea no crea un bloque o encabezado nuevo.
  - [x] `pageLinksToTitle` sigue encontrando una nota antigua con `[[Título]]`.
  - [x] El frontmatter conserva el título original y sigue siendo YAML válido.
- [?] Prueba manual: crear un recurso con un título que contenga `]]` y otro
      con salto de línea; crear una nota hija y comprobar que el vínculo y el
      contenido son correctos.

**Criterio de aceptación:**

- [x] Ningún título puede cerrar el wikilink antes de tiempo.
- [x] No se inyectan encabezados, imágenes ni propiedades en la nota nueva.
- [x] Las notas antiguas siguen vinculándose.
- [x] `npm test -- src/views/bibliography.test.ts` en verde.

**Resultado (2026-11-02):** B2 implementado en `src/views/bibliography.ts`,
`src/views/bibliography.test.ts` y `src/desktop.ts`. La prueba específica pasa
con **14 pruebas**, la suite completa con **351 pruebas** y `npx tsc --noEmit`
pasa sin errores. La prueba manual de creación de notas queda para la
verificación global.

---

### Fase 7 — B3: paridad de validación en modo web

**Objetivo:** que el modo web no guarde portadas con contenido no validado.

**Evidencia de la auditoría:**

- En Tauri, `uploadBibliographyCover` usa `save_image` y
  `validate_image_file` (`src/desktop.ts:5178-5207`,
  `src-tauri/src/lib.rs:4825-4852`).
- En modo no Tauri, solo comprueba tamaño/tipo y devuelve un data URL; no
  valida magic bytes ni SVG activo.

**Tareas:**

- [x] Decidir la política del modo web: se elige la **Opción B** (validar magic
      bytes de PNG/JPEG/GIF/WEBP/BMP y rechazar SVG). Es más estricta que Tauri,
      que acepta SVG saneados, y evita duplicar el saneador en el frontend.
- [x] Añadir `src/editor/image-bytes.ts` con detección por magic bytes y
      normalización del MIME real del archivo.
- [x] Usar `normalizeRasterImageFile` en `uploadBibliographyCover` antes de
      guardar el data URL en modo web.
- [x] Rechazar SVG en modo web aunque el archivo declare un MIME raster.
- [?] Añadir una prueba manual con un SVG con `<script>` y comprobar que no se
      ejecuta y que la portada se rechaza.
- [x] Documentar que la validación fuerte vive en el backend de Tauri y que el
      modo web usa una validación más estricta, no un saneador equivalente.

**Criterio de aceptación:**

- [x] Una portada web no puede almacenar un SVG activo sin control: se rechaza
      cualquier archivo sin magic bytes de raster permitido.
- [x] Las portadas raster válidas siguen funcionando; sus MIME se normalizan
      según el contenido real.
- [x] La diferencia Tauri/web queda documentada.

**Resultado (2026-11-02):** B3 implementado en `src/editor/image-bytes.ts`,
`src/editor/image-bytes.test.ts` y `src/desktop.ts`. La prueba específica pasa
con **5 pruebas**, la suite completa con **356 pruebas** y `npx tsc --noEmit`
pasa sin errores. La prueba manual con un SVG activo queda para la verificación
global.

---

### Fase 8 — Cierre: documentación y verificación global

**Objetivo:** dejar el trabajo reproducible y verificado.

**Tareas de documentación:**

- [x] Actualizar la sección «Seguridad» de `docs/SinNotas.md` con las nuevas
      invariantes:
  - [x] registro y capturas PDF pasan por `resolve_vault_path`;
  - [x] Documentos no autoabre PDFs;
  - [x] los PDFs se revalidan al abrir;
  - [x] no se exponen rutas absolutas de PDFs;
  - [x] las portadas remotas se validan o se rechazan.
- [x] Enlazar este checklist desde `docs/SinNotas.md`.
- [x] Añadir una nota en `docs/CHECKLIST-PDF.md` que apunte a D1–D4.
- [x] Anotar en este documento las decisiones tomadas: portadas públicas
      validadas, SVG rechazado en web, CSP web no añadida y límites numéricos.

**Tareas de verificación:**

- [x] `npx tsc --noEmit`
- [x] `npm test -- src/editor/url-safety.test.ts src/views/bibliography.test.ts`
      → **30 pruebas**.
- [x] `npm test` → **356 pruebas**.
- [x] `npm run build`.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib` → **87 pruebas**.
- [x] Revisar el diff completo con `git diff --stat`, `git diff` y
      `git diff --check`.
- [x] Confirmar que no se han añadido `console.log` de depuración ni rutas
      absolutas de la máquina en el código; la única mención a `/tmp/opencode`
      es la regla de pruebas de este documento.
- [x] Confirmar que no se ha tocado `dist/`, `src-tauri/target/` ni una bóveda
      real; ambos directorios generados siguen ignorados.
- [x] Publicar el trabajo en `v0.4.3`. El historial se integró en un commit de
      release en lugar de separarse por fase.
- [x] Revisión manual del usuario antes de publicar.

**Resultado (2026-11-03):** cierre documental completado y release `v0.4.3`
publicada. Verificación automática final: `npx tsc --noEmit`, `npm test` (356),
`npm run build`, `cargo check --lib` y `cargo test --lib` (87). La matriz manual
de seguridad sigue pendiente.

---

## 5. Matriz de pruebas manuales

### Documentos

- [ ] Bóveda nueva con `assets/pdfs/a.pdf`: entrar en Documentos muestra la
      lista y **no** abre el PDF.
- [ ] Hacer clic en el PDF: se abre y renderiza.
- [ ] `.sinnotas` symlink a una carpeta externa: importar o listar no escribe
      fuera del vault.
- [ ] `.sinnotas/documents/links.json` symlink externo: no se lee/escribe
      fuera.
- [ ] `assets/pdf-captures` symlink externo: capturar una región falla y no
      crea el PNG fuera.
- [ ] `links.json` con una ruta relativa: no se abre; error claro.
- [ ] `links.json` con `../archivo.pdf`: no se abre.
- [ ] PDF del vault reemplazado por texto: abrir muestra error, no crash.
- [ ] Enlace externo eliminado: se quita del registro, el original sigue.
- [ ] PDF del vault eliminado: solo se borra dentro de `assets/pdfs/`.
- [ ] Tooltip de un enlace externo: no muestra ruta absoluta.

### Bibliografía

- [ ] Portada local (`assets/portada.png`): se muestra.
- [ ] `bib-portada: https://example.com/portada.png`: en Tauri queda bloqueada
      por CSP; en web, si se permite, se valida el host.
- [ ] `bib-portada: http://127.0.0.1:8080/x.png`: no genera petición.
- [ ] `bib-portada: //127.0.0.1/x.png`: no genera petición.
- [ ] `bib-portada: //example.com/x.png`: se resuelve como URL absoluta y se
      valida.
- [ ] `bib-portada: javascript:...`: se rechaza.
- [ ] Título con `]]` y salto de línea: no rompe el wikilink ni inyecta
      contenido.
- [ ] Crear/editar/eliminar recurso: sigue funcionando.
- [ ] Crear nota hija: frontmatter y cuerpo correctos.
- [ ] Renombrar recurso: se actualiza `bib-padre` de las notas hijas.
- [ ] Portada SVG con contenido activo en Tauri: se rechaza.
- [ ] Portada SVG en web: se rechaza o se normaliza, sin ejecución.

### Regresión general

- [x] `npm test` completo (356 pruebas).
- [x] `npm run build`.
- [x] `cargo test --lib` (87 pruebas).
- [ ] Abrir una bóveda real de solo lectura y comprobar que no se modifica su
      `.sinnotas` ni sus archivos.
- [ ] Cambiar de bóveda y comprobar que no se muestran portadas de la bóveda
      anterior.

---

## 6. Riesgos y decisiones pendientes

| Tema | Riesgo | Decisión tomada |
| --- | --- | --- |
| Symlinks en `.sinnotas` | Usuarios que sincronizan `.sinnotas` mediante symlink podrían dejar de funcionar. | Rechazar symlinks fuera del vault; permitir symlinks internos. Implementado en D1. |
| Autoabrir PDF | Cambio de UX: la vista queda vacía hasta hacer clic. | Aceptado por seguridad; Documentos solo refresca la lista al entrar. Implementado en D2. |
| Límite de páginas/render | PDFs legítimos muy grandes podrían rechazarse. | Límites de 10 000 páginas, 2 400×12 000 px, 24 Mpx y 50 000 runs; se reduce el ancho antes de rechazar. Implementado en D3. |
| Portadas remotas | Si se permiten públicas, Tauri las bloqueará por CSP y el web puede hacer peticiones. | Solo hosts públicos validados; Tauri sigue bloqueándolas por CSP y el web solo permite una URL pública validada. Implementado en B1. |
| CSP web | Añadir CSP puede romper Vite/HMR. | No se añade en esta fase; el modo web no se considera soportado para bóvedas no confiables. Revisar si se confirma como objetivo de producto. |
| `source_path` | Algún diagnóstico podría depender de la ruta absoluta. | Eliminada de los tipos serializados; el frontend solo recibe `relativePath` y `link:<id>`. Implementado en D4. |
| SVG en portadas web | Un SVG activo podría ejecutarse si se almacena sin validar. | El modo web rechaza SVG y exige magic bytes raster; Tauri mantiene el saneado del backend. Implementado en B3. |
| PDFium | Sigue siendo código nativo sin sandbox. | Mantener la versión actualizada; el fix reduce la exposición, no la elimina. |

---

## 7. Definition of Done

- [x] D1: registro y capturas usan rutas resueltas y rechazan symlinks externos.
- [x] B1: las portadas remotas no permitidas no generan peticiones.
- [x] D2: Documentos no autoabre PDFs y `links.json` se valida.
- [x] D3: los PDFs se revalidan al abrir y el render tiene límites.
- [x] D4: el frontend no recibe rutas absolutas de PDFs.
- [x] B2: los títulos no rompen wikilinks ni inyectan Markdown.
- [x] B3: la validación de portadas en web es explícita y documentada.
- [x] La documentación de seguridad está actualizada.
- [x] La suite completa y el build están en verde.
- [ ] La matriz manual está comprobada en Tauri y, si aplica, en web.
- [x] No se han perdido los cambios de Bibliografía que ya existían.
- [x] No quedan hallazgos de severidad media sin decisión documentada.

---

## 8. Comandos de referencia

```bash
# Estado del árbol
git status --short
git diff --stat

# Frontend
npx tsc --noEmit
npm test -- src/editor/url-safety.test.ts src/views/bibliography.test.ts
npm test
npm run build

# Rust
cargo check --manifest-path src-tauri/Cargo.toml --lib
cargo test --manifest-path src-tauri/Cargo.toml --lib

# Búsquedas de control
grep -RIn "root.join(CAPTURE_FOLDER)\|root.join(LINKS_FOLDER)" src-tauri/src/pdf/storage.rs
grep -RIn "sourcePath\|source_path" src/types.ts src/views/pdf-view.ts
grep -RIn "isAllowedRemoteImageUrl" src/desktop.ts src/editor/url-safety.ts
grep -RIn "innerHTML" src/views/bibliography-view.ts
```

---

## 9. Notas para la próxima sesión

- Empezar por la Fase 1 (D1), que es la brecha más clara de contención.
- No implementar B1 y D1 en el mismo commit: son áreas y pruebas distintas.
- Antes de tocar `storage.rs`, leer los tests existentes y el helper
  `resolve_vault_path`; no duplicar validaciones.
- Antes de tocar `pdf-view.ts`, revisar el flujo de importación y el estado
  vacío para no romper la UX.
- Si una prueba manual requiere symlinks y la plataforma no lo permite, anotar
  `[!]` con el motivo y verificar el caso en Linux/macOS.
- Actualizar este documento al terminar cada fase; no dejarlo como un plan
  obsoleto.
