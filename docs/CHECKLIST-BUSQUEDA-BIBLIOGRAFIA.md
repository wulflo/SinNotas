# Checklist — Búsqueda de metadatos para Bibliografía (DOI, ISBN y palabras clave)

**Estado:** implementación, verificación automática y rendimiento del diálogo completados; matriz manual de UI pendiente · **Última actualización:** 2026-11-03
**Rama de trabajo:** `master`
**Documento principal:** `docs/SinNotas.md`
**Checklists relacionados:** `docs/CHECKLIST-SEGURIDAD-DOCUMENTOS-BIBLIOGRAFIA.md`, `docs/CHECKLIST-PDF.md`
**Origen:** plugin de Obsidian `obsidian-book-search-plugin` (carpeta hermana del repo) y petición de integrar una búsqueda equivalente, pero hecha en Rust y con controles de seguridad explícitos.

> Este documento está pensado para **retomar el trabajo sin conexión**. Si se corta
> internet, no hace falta recordar nada: aquí están el estado, los archivos, los
> comandos y el siguiente paso exacto. No borrar este documento al terminar; se
> actualiza.

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
| `[?]` | Implementado, pendiente de prueba manual. |

### Reglas de trabajo

1. **No descartar trabajo previo.** Antes de tocar nada, ejecutar `git status
   --short` y leer este documento. Si hay cambios sin commit, son parte de esta
   tarea hasta que se demuestre lo contrario.
2. **No usar `git reset --hard`, `git clean -fd` ni `git checkout --`** sobre
   archivos de Bibliografía, Rust o docs. Para revertir algo, hacerlo con
   `git diff` + edición manual o `git restore -p`.
3. **El backend es la fuente de verdad de la red.** El frontend no construye
   URLs, no elige hosts y no hace `fetch` a los proveedores. Solo llama al
   comando `bibliography_lookup`.
4. **Nada de red en segundo plano.** La búsqueda solo se ejecuta cuando el
   usuario pulsa «Buscar en línea» en el diálogo de «Añadir recurso».
5. **No tocar artefactos generados:** `dist/`, `src-tauri/target/`,
   `node_modules/`, `src-tauri/gen/`, APK firmadas ni `.sinnotas/` de una bóveda
   real.
6. **Bóvedas de prueba:** crear bóvedas temporales en `/tmp/opencode` o en el
   directorio temporal del sistema. Nunca usar una bóveda real para pruebas
   destructivas.
7. **Actualizar este documento al terminar cada fase.** Marcar `[x]` solo si
   pasan los criterios de aceptación y las pruebas indicadas.

---

## 1. Estado actual y punto de reanudación

| Campo | Valor |
| --- | --- |
| Commit base al empezar | `1cdf8be chore: release v0.4.4` |
| Estado de `git status` al empezar | limpio |
| Entorno | Linux, Rust `1.99.1`, `cargo` disponible |
| Node/npm en el entorno | **no instalado en el sistema**; se usó Node 22.23.4 temporal desde `/tmp/opencode/node-v22.23.4-linux-x64/bin` para `tsc`, `vitest` y `vite build` |
| Proveedores elegidos | Crossref (DOI y artículos) + Open Library (ISBN y libros) |
| Dependencia HTTP | `reqwest` 0.12 con `rustls-tls` (sin `native-tls`, sin claves API) |
| Almacenamiento de resultados | caché en memoria (10 min, 32 entradas); no se escribe nada a disco |
| Portadas | solo `https://covers.openlibrary.org` (allowlist + CSP) |

### Si se corta internet ahora mismo

1. Ejecutar:
   ```bash
   cd /home/alonso/Documentos/Repositorios/SinNotas
   git status --short
   git diff --stat
   ```
2. Buscar marcas de trabajo pendiente:
   ```bash
   grep -rn "TODO(bib)\|FIXME(bib)\|LOOKUP" src src-tauri/src docs/CHECKLIST-BUSQUEDA-BIBLIOGRAFIA.md
   ```
3. Comprobar que Rust compila sin red (las dependencias ya están en la caché de
   Cargo):
   ```bash
   cd src-tauri
   cargo check --offline
   cargo test --offline
   ```
4. Si Node vuelve a estar disponible (o se usa el temporal de `/tmp/opencode`):
   ```bash
   cd /home/alonso/Documentos/Repositorios/SinNotas
   export PATH=/tmp/opencode/node-v22.23.4-linux-x64/bin:$PATH
   npx tsc --noEmit
   npm test
   npm run build
   ```
5. Continuar por la **primera casilla `[ ]` o `[p]`** de la fase correspondiente
   en este documento. El siguiente paso esperado está anotado en la sección 7.

### Qué se puede borrar y qué no

- **Se puede borrar:** `src-tauri/target/` (se regenera), `dist/` (se regenera),
  bóvedas temporales de `/tmp/opencode`.
- **No se puede borrar:** `src-tauri/src/bibliography_lookup.rs`,
  `src/views/bibliography-lookup.ts`, los cambios en
  `src/views/bibliography-view.ts`, `src/desktop.ts`, `src/i18n.ts`,
  `src/bibliography.css`, `src-tauri/Cargo.toml` y este documento.
- Si un archivo nuevo está a medias, marcarlo `[p]` y dejarlo; no vaciarlo.

---

## 2. Auditoría de Dependabot (2026-11-03)

Consulta hecha con `gh api repos/wulflo/SinNotas/dependabot/alerts --paginate`.
Resultado: **16 alertas, 15 corregidas (`fixed`) y 1 descartada
(`dismissed`, riesgo tolerable). Ninguna abierta. No hay PRs abiertos de
Dependabot.**

| # | Paquete | Ecosistema | Severidad | Estado | Versión actual en el lock | Corrección |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `esbuild` | npm (dev) | media | fixed | `0.28.2` | `>= 0.25.0` |
| 2 | `vite` | npm (dev) | media | fixed | `6.4.5` | `6.4.2` |
| 3 | `vitest` | npm (dev) | crítica | fixed | `5.0.5` | `3.2.6` / `4.1.0` |
| 4 | `vite` | npm (dev) | media | fixed | `6.4.5` | `6.4.3` |
| 5 | `vite` | npm (dev) | media | fixed | `6.4.5` | `6.4.3` |
| 6 | `tinypool` | npm (dev) | crítica | fixed | `2.2.0` | `2.1.2` |
| 7 | `tinypool` | npm (dev) | crítica | fixed | `2.2.0` | `2.1.1` |
| 8 | `vite` | npm (dev) | media | fixed | `6.4.5` | `6.4.4` |
| 9 | `vite` | npm (dev) | alta | fixed | `6.4.5` | `6.4.4` |
| 10 | `vite` | npm (dev) | media | fixed | `6.4.5` | `6.4.4` |
| 11 | `vite` | npm (dev) | media | fixed | `6.4.5` | `6.4.4` |
| 12 | `vite` | npm (dev) | baja | fixed | `6.4.5` | `6.4.4` |
| 13 | `glib` | Cargo (runtime) | media | **dismissed** | `0.18.5` | `0.20.0` |
| 14 | `@vitest/mocker` | npm (dev) | media | fixed | incluido en `vitest 5.0.5` | `4.1.11` |
| 15 | `vitest` | npm (dev) | media | fixed | `5.0.5` | `4.1.11` |
| 16 | `@vitest/mocker` | npm (dev) | media | fixed | incluido en `vitest 5.0.5` | `4.1.12` |

### Detalle de la alerta descartada

- **#13 — `glib 0.18.5`**, GHSA-wrw7-89jp-8q8g, severidad media.
- Motivo del descarte: es transitiva de Tauri 2 → GTK 0.18 → glib 0.18. El fix
  está en glib 0.20, incompatible con la pila GTK de Tauri 2; no hay backport a
  0.18. La app no invoca `VariantStrIter` ni `Variant`, así que el riesgo es UB
  local en GTK. **Reactivar cuando Tauri publique con glib 0.20 (o Tauri 3).**
- No cambiar `glib` a mano: rompería la compilación de GTK.

### Acciones de mantenimiento

- [x] Verificar que no hay alertas abiertas.
- [x] Verificar que no hay PRs abiertos de Dependabot.
- [x] Documentar la excepción de `glib`.
- [ ] Volver a ejecutar esta consulta antes de cada release (`gh api ...`).
- [ ] Si se añade `reqwest` como dependencia directa, revisar que su versión
  fijada en `Cargo.lock` no introduzca alertas nuevas (`cargo audit`).

---

## 3. Objetivo funcional

En la vista **Bibliografía → Añadir recurso**, permitir:

1. Pegar un **DOI** (con o sin `https://doi.org/`, `doi:` o `10.`).
2. Pegar un **ISBN-10 o ISBN-13** (con o sin guiones).
3. Escribir **palabras clave** (título, autor, tema).
4. Ver una lista de resultados con título, autores, año, tipo y proveedor.
5. Pulsar un resultado para **rellenar el formulario** (título, tipo, autor, año,
   páginas, enlace y portada). El usuario revisa y confirma con «Crear recurso».
6. Si no hay red, el formulario manual sigue funcionando y se muestra un error
   claro. Nunca se pierde lo ya escrito.

### Fuera de alcance (v1)

- Google Books con clave API. Se puede añadir después como proveedor nuevo sin
  cambiar el contrato del comando.
- Descargar la portada al vault. v1 solo devuelve la URL validada de Open
  Library; la descarga segura queda como fase futura.
- Sincronización, bases de datos locales o metadatos en segundo plano.
- Búsqueda desde la vista móvil de repaso (la APK Android se compila con
  `VITE_APP_MODE=flashcards`).

---

## 4. Diseño de seguridad

### 4.1 Modelo de amenaza

| Amenaza | Mitigación |
| --- | --- |
| SSRF: que el usuario o un dato remoto haga peticiones a `localhost`, IP privada, metadata cloud o `file://`. | El frontend no envía URLs. El backend solo construye URLs con hosts constantes (`api.crossref.org`, `openlibrary.org`). `https_only(true)` y allowlist de hosts. No se aceptan URLs de usuario. |
| Redirecciones a hosts maliciosos. | `redirect::Policy::none()`: cualquier 3xx se trata como error. |
| TLS débil o deshabilitado. | `reqwest` con `rustls-tls` y raíces webpki; nunca `danger_accept_invalid_certs`. |
| Respuestas enormes o bombas de compresión. | Límite de 2 MiB sobre el cuerpo **descomprimido**; se lee por chunks y se aborta al superar el límite. Sin `brotli`/`gzip` habilitados en el cliente. |
| JSON malicioso o muy profundo. | `serde_json` con límite de recursión por defecto; solo se leen campos conocidos; se ignoran los demás. |
| Inyección de texto/HTML en la UI. | Todo texto remoto pasa por `clean_text` (elimina controles y bidi, colapsa espacios, recorta longitud). La UI usa `textContent`, nunca `innerHTML` con datos remotos. Los resúmenes JATS se desetiquetan. |
| Enlaces `javascript:`/`data:` o a hosts internos. | `safe_result_url` solo acepta `https`, host en allowlist, sin credenciales y puerto 443. |
| Portadas desde cualquier host (tracking, IP privada). | `allowed_cover_url` solo acepta `https://covers.openlibrary.org/b/id/{digitos}-{S,M,L}.jpg`. CSP `img-src` se amplía solo a ese host. |
| Fuga de datos personales o de la bóveda. | Solo se envía el texto de la consulta. No se envían rutas, títulos de notas, tokens ni identificadores de la app. Sin cookies (`reqwest` sin `cookie_store`), sin `Referer`. |
| Fuerza bruta / abuso de la API. | Una consulta cada 750 ms como mínimo; máximo 16 resultados; timeout total 12 s; conexión 5 s. |
| Caché con datos sensibles. | Caché solo en memoria, TTL 10 min, máximo 32 entradas; no se escribe a disco ni se registra en logs. |
| Errores que filtren detalles internos. | El backend devuelve códigos estables (`invalid_query`, `not_found`, `rate_limited`, `timeout`, `network`, `upstream`, `too_large`, `invalid_response`). No se devuelve el cuerpo remoto ni la URL completa. |
| Supply chain. | `reqwest` ya estaba en `Cargo.lock` (transitiva del updater); se fija la misma versión 0.12 y no se añaden crates nuevos fuera de `url`/`tokio` ya presentes. CI ejecuta `cargo audit`. |
| Android. | Se usa el mismo backend; no se añaden permisos nuevos (INTERNET ya está declarado para el actualizador). No se habilita tráfico en claro. |
| CSP. | Se mantiene `default-src 'self'`; solo se añade `https://covers.openlibrary.org` a `img-src` (y a `devCsp`). `connect-src` no cambia porque las peticiones van por Rust. |

### 4.2 Validación de entradas

- Consulta: máximo 256 caracteres; se rechazan caracteres de control; se
  colapsan espacios; se eliminan controles de formato/bidi.
- DOI: se aceptan prefijos `https://doi.org/`, `http://doi.org/`,
  `https://dx.doi.org/`, `doi:` y `10.`; solo ASCII; prefijo `10.` + 4–9
  dígitos + `/` + sufijo no vacío; máximo 200 caracteres. El sufijo se
  percent-encodea por segmentos al construir la URL.
- ISBN: se quitan guiones, espacios, guiones tipográficos y signo menos; solo
  dígitos y `X` final. Se valida el dígito de control ISBN-10 e ISBN-13. ISBN-10
  se convierte a ISBN-13 antes de consultar.
- Palabras clave: texto libre saneado; no se interpretan como operadores.
- Modo: solo `auto`, `doi`, `isbn`, `keywords`; cualquier otro valor es
  `invalid_query`.

### 4.3 Contrato del comando

```text
bibliography_lookup(query: String, mode: Option<String>) -> Result<Vec<LookupResult>, LookupError>
```

- `mode`: `"auto" | "doi" | "isbn" | "keywords"` (por defecto `auto`).
- `LookupResult` (camelCase en JSON): `provider`, `kind`, `title`, `subtitle`,
  `authors`, `year`, `publisher`, `container`, `doi`, `isbn`, `url`, `pages`,
  `coverUrl`, `abstractText`.
- `kind`: `"book" | "article" | "webpage" | "video"` (compatible con
  `BibliographyType`).
- `LookupError`: `{ code, message }`; la UI traduce por `code`.

### 4.4 Proveedores y endpoints fijos

| Proveedor | Uso | Endpoint |
| --- | --- | --- |
| Crossref | DOI exacto | `GET https://api.crossref.org/works/{doi}` |
| Crossref | Palabras clave | `GET https://api.crossref.org/works?query.bibliographic={q}&rows=10` |
| Open Library | ISBN exacto | `GET https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data` |
| Open Library | Palabras clave | `GET https://openlibrary.org/search.json?q={q}&limit=10&fields=...` |
| Open Library | Portadas | `https://covers.openlibrary.org/b/id/{id}-M.jpg` |

No se usa `mailto` ni clave API en v1. Si en el futuro se añade Google Books,
hacerlo como proveedor nuevo, con clave en el backend (nunca en el frontend) y
allowlist de `www.googleapis.com`.

---

## 5. Fases de implementación

### Fase 1 — Backend Rust

- [x] Crear `src-tauri/src/bibliography_lookup.rs` con validación, client,
  proveedores, caché y saneado.
- [x] Añadir `reqwest`, `url` y `tokio` (features `sync`, `macros`) a
  `src-tauri/Cargo.toml`.
- [x] Declarar `pub mod bibliography_lookup;` y registrar el comando en
  `tauri::generate_handler!` de `src-tauri/src/lib.rs`.
- [x] Tests unitarios de ISBN, DOI, saneado, allowlist de portadas y parseo de
  fixtures de Crossref/Open Library.
- [x] `rustfmt --edition 2021 --check src/bibliography_lookup.rs` y
  `cargo clippy --offline --all-targets -- -D warnings` sin errores.
- [x] `cargo check --offline` y `cargo test --offline` en verde (**99 pruebas**
  correctas, 1 prueba en vivo ignorada).

### Fase 2 — Cliente y UI

- [x] Crear `src/views/bibliography-lookup.ts` con tipos, detección de modo,
  validaciones espejo, mapeo a `CreateBibliographyInput` y wrapper de `invoke`.
- [x] Añadir `lookup` a `BibliographyHost` e implementarlo en
  `createBibliographyHost()` de `src/desktop.ts`.
- [x] Añadir el bloque de búsqueda al diálogo `openAddDialog()` de
  `src/views/bibliography-view.ts` (input, selector de modo, botón, estado y
  lista de resultados).
- [x] Rellenar el formulario al pulsar un resultado, sin crear la nota
  automáticamente.
- [x] Estilos en `src/bibliography.css`.
- [x] Traducciones en `src/i18n.ts` (es → en/zh).
- [x] Tests de las funciones puras en
  `src/views/bibliography-lookup.test.ts`.
- [x] `npx tsc --noEmit`, `npm test` (**394 pruebas**, 40 archivos) y
  `npm run build` en verde con el Node temporal de `/tmp/opencode`.

### Fase 3 — CSP y documentación

- [x] Añadir `https://covers.openlibrary.org` a `img-src` en
  `src-tauri/tauri.conf.json` y `devCsp`.
- [x] Documentar el comando, el modelo de amenaza y la lista de verificación en
  este archivo.
- [x] Actualizar `docs/SinNotas.md` con una referencia a este checklist.
- [x] Actualizar `docs/CHECKLIST-SEGURIDAD-DOCUMENTOS-BIBLIOGRAFIA.md` con la
  nueva superficie de red.
- [x] Prueba de humo en vivo (`live_lookup_smoke`, `#[ignore]`) contra Crossref
  y Open Library: DOI, ISBN y palabras clave devuelven resultados.

### Fase 3b — Radios y rendimiento (2026-11-03)

- [x] Migrar los radios de `src/bibliography.css` a los tokens existentes
  (`--ma-radius-sm/md/lg/xl/2xl`): el botón «Añadir recurso» pasa de `999px` a
  `10px`, los campos y botones a `8px`, las tarjetas a `14px` y los modales a
  `16px`. Ya no quedan valores sueltos de `999px`, `20px` ni `16px` en la hoja.
- [x] Comprobar en Chromium que los radios calculados son los esperados
  (`10px` botón, `8px` campos/filtros, `16px` modal) y que el diálogo se abre y
  se cierra sin errores de consola.
- [x] Diagnosticar la lentitud con un rastro del compositor: no hay tareas
  largas de JavaScript; el coste está en `DirectRenderer::DrawFrame`
  (rasterización por software) al repintar la ventana completa.
- [x] Medir antes/después con escritura real en el editor:

  | Variante | fps | Peor frame |
  | --- | --- | --- |
  | Aero completo | ~31 | 83 ms |
  | Sin `backdrop-filter` en `.main-container` | ~102 | 33 ms |
  | Sin blur en `.main-container` + `.sidebar-left` | ~153 | 17 ms |
  | Diálogo «Añadir recurso» con velo difuminado | 60 (con tirones de 67 ms) | 67 ms |
  | Diálogo con velo opaco (actual) | 60 estable | 17 ms |

- [x] Quitar `backdrop-filter` de `.main-container`, `.sidebar-left` y del velo
  de los modales de Bibliografía. La diferencia visual medida es del **0,22 %**
  (RMSE) porque el fondo difuminado es un degradado suave.
- [x] Reejecutar `npx tsc --noEmit`, `npm test` (394 pruebas), `npm run build`
  y la comprobación de frames tras el cambio.

### Fase 4 — Verificación manual

- [ ] DOI de artículo: `10.1038/nphys1170` → rellena título, autor, año,
  revista y enlace `https://doi.org/...`.
- [ ] DOI con prefijo: `https://doi.org/10.1038/nphys1170` → mismo resultado.
- [ ] DOI inválido: `10.1/x` → error `invalid_query`, formulario intacto.
- [ ] ISBN-13: `9780140328721` → *Fantastic Mr. Fox*, Roald Dahl, 1988 (o la
  fecha que devuelva Open Library), portada de `covers.openlibrary.org`.
- [ ] ISBN-10: `0140328726` → mismo libro (se convierte a ISBN-13).
- [ ] ISBN con guiones: `978-0-14-032872-1` → mismo libro.
- [ ] ISBN con dígito de control inválido: `9780140328722` → error
  `invalid_query`.
- [ ] Palabras clave: `deep work` → resultados de Crossref y Open Library;
  pulsar uno rellena el formulario.
- [ ] Sin red (modo avión o firewall): error `network`/`timeout`, sin perder el
  texto del formulario; se puede crear el recurso manualmente.
- [ ] Respuesta 429 simulada (si se puede): error `rate_limited`.
- [ ] Dos búsquedas seguidas muy rápido: la segunda muestra `rate_limited`.
- [ ] Portada remota: se muestra en el preview y queda en `bib-portada`; si se
  bloquea el host, no se muestra y el formulario sigue funcionando.
- [ ] Título con `<script>` o `[]`: se muestra como texto, no rompe el wikilink.
- [ ] Android: la vista de Bibliografía no está en la APK de repaso; si se
  habilita, el comando compila y no pide permisos nuevos.

---

## 6. Lista de verificación de seguridad (para revisar antes de publicar)

### Entrada y red

- [x] El frontend no puede elegir host ni URL.
- [x] Solo HTTPS; `https_only(true)`.
- [x] Sin redirecciones (`Policy::none()`).
- [x] TLS con `rustls` + raíces webpki.
- [x] Timeout de conexión (5 s) y total (12 s).
- [x] Límite de 2 MiB por respuesta, aplicado al cuerpo leído.
- [x] `Content-Type` debe ser JSON.
- [x] Solo `GET`; no se envían cuerpos.
- [x] Sin cookies, sin credenciales, sin `Referer`.
- [x] User-Agent identificable (`SinNotas/<versión> (+repo)`).
- [x] Rate limit de 750 ms entre consultas.
- [x] Máximo 16 resultados combinados.
- [x] Caché en memoria con TTL y límite de entradas.
- [x] Los errores no incluyen cuerpo remoto ni URL completa.

### Salida

- [x] `clean_text` elimina C0/C1, bidi y Zero-Width; colapsa espacios.
- [x] Límites de longitud por campo (título 500, autores 400, resumen 2000…).
- [x] Los resúmenes JATS se desetiquetan y se decodifican entidades básicas.
- [x] `safe_result_url` solo acepta `https` + hosts allowlist.
- [x] `allowed_cover_url` solo acepta `covers.openlibrary.org/b/id/{digitos}-{S,M,L}.jpg`.
- [x] La UI usa `textContent` para títulos, autores y metadatos.
- [x] El tipo se normaliza a `BibliographyType`.

### Configuración y supply chain

- [x] CSP: solo se añade `covers.openlibrary.org` a `img-src`; no se abre
  `connect-src`.
- [x] `tauri.conf.json` no habilita `dangerousDisableAssetCspModification` ni
  `withGlobalTauri`.
- [x] No se añaden capacidades de Tauri para HTTP: la petición ocurre en Rust.
- [x] `reqwest`/`url`/`tokio` ya estaban en `Cargo.lock`; no se añaden crates
  nuevos no auditados.
- [ ] `cargo audit` sin vulnerabilidades nuevas (requiere red/BD de RustSec).
- [x] Revisar el diff de `Cargo.lock` antes de commitear.

### Privacidad

- [x] Solo se envía la consulta escrita por el usuario.
- [x] No se envía el contenido de la bóveda, rutas, títulos de notas ni tokens.
- [x] No hay telemetría ni analytics.
- [x] No se persisten resultados en disco.
- [x] La búsqueda es explícita (botón), no automática.

---

## 7. Siguiente paso exacto

La implementación, la verificación automática y la pasada de rendimiento están
cerradas. Falta la matriz manual de la Fase 4, que requiere ejecutar la app
Tauri con una bóveda temporal:

> **No lanzar la app con `LIBGL_ALWAYS_SOFTWARE=1`,
> `WEBKIT_DISABLE_DMABUF_RENDERER=1` ni `WEBKIT_DISABLE_COMPOSITING_MODE=1`.**
> Esos flags se usaron para capturar la ventana por X11 y fuerzan rasterización
> por software: la app se siente lentísima aunque no tenga ningún problema de
> código. Si hay que usar X11, basta `GDK_BACKEND=x11`.

1. Crear una bóveda temporal en `/tmp/opencode/bibliografia-manual` y abrirla
   con `npm run tauri dev` (o el binario de desarrollo).
2. Recorrer la lista de la Fase 4 y marcar cada caso como `[x]` o `[!]` con el
   error exacto.
3. Si algo falla, corregirlo y volver a ejecutar:
   ```bash
   cd src-tauri
   cargo check --offline
   cargo test --offline
   cargo clippy --offline --all-targets -- -D warnings
   rustfmt --edition 2021 --check src/bibliography_lookup.rs
   ```
   ```bash
   export PATH=/tmp/opencode/node-v22.23.4-linux-x64/bin:$PATH
   npx tsc --noEmit
   npm test
   npm run build
   ```
4. Actualizar el estado de las casillas y la fecha de este documento.
5. Commit sugerido (no ejecutar sin revisar el diff):
   ```bash
   git add src-tauri/src/bibliography_lookup.rs src-tauri/src/lib.rs \
     src-tauri/Cargo.toml src-tauri/Cargo.lock src/views/bibliography-lookup.ts \
     src/views/bibliography-lookup.test.ts src/views/bibliography-view.ts \
     src/desktop.ts src/i18n.ts src/bibliography.css src-tauri/tauri.conf.json \
     docs/CHECKLIST-BUSQUEDA-BIBLIOGRAFIA.md docs/SinNotas.md \
     docs/CHECKLIST-SEGURIDAD-DOCUMENTOS-BIBLIOGRAFIA.md
   git commit -m "feat(bibliografia): búsqueda de metadatos por DOI, ISBN y palabras clave"
   ```

---

## 8. Notas de implementación y trampas conocidas

- **`node` no está instalado en el sistema.** Para verificar el frontend, usar el
  Node temporal de `/tmp/opencode/node-v22.23.4-linux-x64/bin` añadiéndolo a
  `PATH`; no hace falta instalar nada globalmente. Si esa ruta ya no existe,
  repetir solo la parte Rust y dejar TypeScript como pendiente.
- **Pruebas de UI automatizadas.** No hace falta añadir Playwright al
  `package.json` del repo: está instalado aparte en `/tmp/opencode/pwtest`
  (`npm install playwright` + `npx playwright install chromium`) y se ejecuta
  contra el Vite de desarrollo (`http://127.0.0.1:1420`). Sirve para medir
  frames, leer `getComputedStyle` y hacer capturas sin tocar dependencias del
  proyecto. Recordar que en modo web no existe `invoke`, así que la búsqueda en
  línea real solo se prueba en la app Tauri.
- **Open Library devuelve `http://openlibrary.org/...`** en el campo `url`. No
  usarlo directamente: construir `https://openlibrary.org{key}` y validar el
  host. Nunca aceptar `http`.
- **Crossref `subtitle` puede ser `null`** (no siempre un array). El parser debe
  aceptar `null`, string o array.
- **Crossref devuelve `title` como array**; tomar el primer elemento no vacío.
- **ISBN-10**: la `X` solo es válida en la última posición; se convierte a
  ISBN-13 antes de consultar Open Library.
- **CSP**: si la portada no se ve en Tauri, comprobar que `img-src` incluye
  `https://covers.openlibrary.org` en la configuración compilada (no solo en
  `devCsp`).
- **No usar `innerHTML`** para resultados remotos. La única excepción existente
  es `iconSvg` con SVG constantes, no datos de red.
- **Rate limit**: si se hacen dos búsquedas seguidas, la segunda puede fallar
  con `rate_limited`; es intencional. La UI debe mostrar el mensaje y permitir
  reintentar.
- **Modo web (`vite` sin Tauri)**: `invoke` no existe. La UI debe mostrar
  «La búsqueda en línea solo está disponible en la aplicación» y mantener el
  formulario manual.
- **Android**: el comando usa `reqwest` + rustls; no añadir `native-tls` ni
  permisos de almacenamiento. La APK de repaso no incluye esta vista, pero el
  código debe compilar para `aarch64-linux-android`.

---

## 9. Registro de cambios de este documento

| Fecha | Cambio |
| --- | --- |
| 2026-11-03 | Creación: auditoría de Dependabot, diseño de seguridad, fases y punto de reanudación. |
| 2026-11-03 | Verificación automática cerrada: Rust (99 pruebas, clippy y rustfmt), frontend (394 pruebas, `tsc`, build) y prueba de humo en vivo. Pendiente solo la matriz manual de UI. |
| 2026-11-03 | Radios de Bibliografía tokenizados con `--ma-radius-*` y diagnóstico de rendimiento: se retira el `backdrop-filter` de las superficies de ventana completa (Aero). Medido con Playwright: ~31 fps → ~102-153 fps al escribir; diálogo estable a 60 fps. |
