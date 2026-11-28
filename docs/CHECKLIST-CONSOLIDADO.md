# Checklist Consolidado — SinNotas

**Estado global:** documento único de seguimiento · **Última actualización:** 2026-11-26
**Ámbito:** escritorio Tauri, APK Android de repaso, backend Rust y documentación.
**Origen:** fusión de los 11 archivos `CHECKLIST-*.md` que existían en `docs/` (2026-11-23). Los originales se eliminaron; este archivo es la **única fuente de verdad**.
**Uso:** ↑ [Parte I — Resumen](#1-parte-i--resumen-ejecutivo) · [Parte II — Detalle](#2-parte-ii--detalle-por-área) · [Reglas de edición](#0-reglas-de-edición-lectura-obligatoria-antes-de-tocar-este-archivo)

> Este documento sirve para **retomar el trabajo sin conexión** y para **editar con criterio**. No hace falta recordar nada: aquí están el estado, los archivos, los comandos, el siguiente paso exacto y las reglas para registrar cada cambio. No borrar secciones al terminar una tarea: se marcan y se conserva su registro.

---

## 0. Reglas de edición (lectura obligatoria antes de tocar este archivo)

### 0.1 Principios

1. **Un solo checklist.** No crear nuevos `CHECKLIST-*.md`. Toda tarea, fase o hallazgo que necesite seguimiento se añade aquí.
2. **Los IDs son estables.** `A1`, `B3`, `C2`, `D1`… identifican un área de forma permanente. No renombrarlos ni reordenarlos. Las áreas nuevas se añaden al final de su bloque con el siguiente ID libre.
3. **No eliminar contenido.** Un área terminada se marca `Cerrada`, pero su detalle y su registro se conservan. Un plan obsoleto se marca `Diferida` con fecha y motivo; borrarlo perdería decisiones ya tomadas.
4. **Una casilla = una acción verificable.** Si un ítem contiene varias acciones, divídilo en subc casillas. Nunca marcar `[x]` sin evidencia (comando + resultado, o comprobación manual descrita).
5. **El detalle manda; el resumen lo refleja.** Cualquier cambio de estado en la Parte II debe quedar replicado en la Parte I en la misma edición.
6. **Los números de línea son orientativos.** Buscar siempre por el símbolo, el selector o el comando indicado.
7. **No mezclar trabajo a medias.** Si una sesión se corta, registrar primero el estado parcial aquí y continuar por el primer ítem `[~]`, `[p]`, `[!]` o `[ ]`.

### 0.2 Convención de estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar, terminar.** |
| `[x]` | Implementado y verificado (con evidencia en el registro). |
| `[!]` | Bloqueado; anotar motivo y error exacto. |
| `[?]` | Implementado, pendiente de prueba manual en Tauri/Android. |

### 0.3 Cómo registrar una edición (pasos obligatorios)

1. Actualizar la **fecha** de la cabecera y, si cambia el global, el **Estado global** (arriba).
2. Cambiar la casilla en la sección de detalle (Parte II) y añadir la **evidencia** en el registro de esa sección o en la bitácora central.
3. Añadir una fila a la **bitácora central** (§0.5): fecha, ID de sección, qué cambió, cómo se verificó y commit.
4. Si afecta al estado de un área, actualizar la **tabla de áreas** (§1.1) y los **pendientes consolidados** (§1.2) en la misma edición.
5. Si se abre, cierra o difiere una fase, actualizar la **política de fases** (§0.6) y el «siguiente paso exacto» de esa sección.
6. Si se toca código, registrar la **ruta exacta y el símbolo** (`src/editor/fsrs.ts:nextInterval`), no solo «arreglado».
7. Antes de commitear: `git diff --check` y `grep -RIn "CHECKLIST-" --exclude=CHECKLIST-CONSOLIDADO.md docs README.md src index.html` (debe quedar vacío o solo referencias legítimas a este archivo).

### 0.4 Ordenamiento y estructura de secciones

- **Parte I (resumen):** mapa de áreas, pendientes consolidados, línea base de verificación y decisiones con riesgo. Se lee primero al reanudar.
- **Parte II (detalle):** bloques temáticos con IDs estables:
  - **Bloque A** — Búsqueda, documentos y seguridad (A1–A3).
  - **Bloque B** — Repaso, FSRS y mazos (B1–B4).
  - **Bloque C** — Interfaz y temas visuales (C1–C2).
  - **Bloque D** — Mantenimiento y rendimiento (D1–D2).
- Dentro de cada área, el orden fijo es: **estado → reglas de reanudación → decisiones cerradas → mapa de archivos → fases → verificación → riesgos/decisiones → registro → siguiente paso**.
- Las tablas van antes que los párrafos largos; los comandos van en bloques de código con lenguaje (`bash`, `ts`, `css`, `text`).
- Para insertar un ítem nuevo, usar la plantilla de la §0.7 y respetar el orden anterior.

### 0.5 Bitácora central de cambios

| Fecha | Sección | Cambio | Verificación | Commit |
| --- | --- | --- | --- | --- |
| 2026-11-23 | — | Fusión de los 11 checklist en un único documento; originales eliminados; enlaces actualizados en `README.md`, `docs/SinNotas.md`, `src/editor/fsrs.ts`, `src/style.css` e `index.html`. | Revisión de enlaces y estructura del documento | `5f4d4ac` |
| 2026-11-23 | — | Benchmark renombrado a `docs/BENCHMARK-2026-10-29.md`; referencias del consolidado, `README.md` y `docs/SinNotas.md` apuntan al nuevo nombre. | Comprobación de enlaces locales y `git diff --check` | (este commit) |
| 2026-11-26 | — | Seguimiento externo acordado para las fases de UI móvil, oclusión y editor de tarjetas: `~/Descargas/Checklist-Fases-UI-SinNotas-2026-11-26.md` (diffs en `~/Descargas/diffs/`). Motivo: el usuario quiere retomar desde Descargas sin depender de este documento; responsable: Alonso. Este consolidado conserva solo el puntero, no el detalle. | Creación del archivo externo y de la carpeta de diffs; `git diff --check` | (este commit) |
| 2026-11-27 | — | Seguimiento externo de la remodelación del cuadro de búsqueda (omnibar): `~/Descargas/Checklist-Remodelacion-Buscador-SinNotas-2026-11-27.md` (diffs y capturas en `~/Descargas/diffs-buscador/`). Motivo: el usuario quiere fases y diffs retomables desde Descargas; responsable: Alonso. Este consolidado conserva solo el puntero. | Creación del archivo externo y verificación `npx tsc --noEmit` + `npm test` (594 tests) | (sin commit) |
| 2026-11-27 | — | Seguimiento externo del cambio de sidebar (sin «Ver todas las notas», recientes a 20, menú sin iconos y copiar enlace): `~/Descargas/Checklist-Sidebar-Recientes-2026-11-27.md` (diffs y capturas en `~/Descargas/diffs-sidebar-recientes/`). Motivo: el usuario quiere fases retomables desde Descargas; responsable: Alonso. Este consolidado conserva solo el puntero. | Creación del archivo externo; `tsc`, `npm test`, `npm run build` y `cargo check` en verde | (sin commit) |

> Al añadir filas, mantener el orden cronológico (más reciente abajo). No resumir dos cambios distintos en una sola fila.

### 0.6 Política de cambios futuros (fases) y cuándo NO registrarlos aquí

**Regla general: si un cambio puede interrumpirse, se registra aquí antes de empezar.**

- **Debe registrarse como fase** todo trabajo con dos o más pasos, que toque más de un archivo, que pueda cortarse a mitad o que requiera verificación manual posterior. Cada fase incluirá: objetivo, casillas, criterio de aceptación, comandos de verificación y **siguiente paso exacto**.
- **No se persiguen planes en la memoria ni en conversaciones.** Un plan que no esté escrito en este archivo no se considera acordado. Si no está aquí, no existe.
- **Se permite NO registrar una fase aquí solo si** su seguimiento vive en otro destino concreto (issue/PR de GitHub, otro documento no-checklist). En ese caso se añade obligatoriamente una fila a la bitácora central con: fecha, destino exacto (URL o ruta), motivo y responsable. Este archivo guardará únicamente ese puntero y la fecha, **no el detalle de la fase**. Sin esa fila, la fase debe estar aquí.
- **Cambios de un solo paso** (una casilla, verificable con un comando, sin estado pendiente después) pueden registrarse solo en la bitácora central, sin sección de fases.
- **Estados de una fase:** `Sin empezar` → `En curso` → `En verificación` → `Cerrada`. Alternativas: `Diferida` (con motivo y fecha de revisión) o `Cancelada` (con motivo).
- **Nunca dejar una fase `En curso` sin «siguiente paso exacto».** Si no se sabe cuál es, se escribe esa duda literalmente y se anota el último comando ejecutado y su resultado.
- **Al cerrar una fase:** marcar todas las casillas, mover lo que quede a §1.2 (pendientes consolidados), añadir fila a la bitácora con el hash del commit y revisar que no queden `[~]`, `[p]` ni `[!]` sin explicación.
- **Al reanudar:** leer §1, buscar la fase con primer ítem `[~]`, `[p]`, `[!]` y después `[ ]`, y ejecutar su línea base antes de editar.

### 0.7 Plantillas

**Plantilla de nueva área (se añade al final del bloque que corresponda):**

```markdown
<a id="X9-area"></a>

### X9. Título del área

**Estado:** Sin empezar · **Última actualización:** AAAA-MM-DD
**Objetivo:** una frase.
**Archivos:** `ruta/exacta.ts`, `ruta/otro.rs`.

#### Decisiones cerradas
- (Ninguna todavía.)

#### Fases
##### Fase 0 — Preparación
- [ ] Acción verificable concreta.

**Criterio de aceptación:** …
**Siguiente paso exacto:** …
```

**Plantilla de fase nueva (dentro de un área existente):**

```markdown
##### Fase N — Nombre corto

**Estado:** Sin empezar · **Inicio:** AAAA-MM-DD
**Objetivo:** qué problema resuelve y qué NO entra en el alcance.

- [ ] 1. Acción concreta (archivo:símbolo).
- [ ] 2. Otra acción concreta.

**Criterio de aceptación:**
- [ ] Comprobación observable por el usuario o por test.

**Verificación:**
```bash
npx tsc --noEmit
npm test
```

**Siguiente paso exacto:** (si la sesión se corta, qué se ejecuta y dónde se continúa)
```

**Plantilla de fila de bitácora:**

```markdown
| AAAA-MM-DD | X9 | Qué se cambió (ruta:símbolo) | `comando` → resultado | abc1234 |
```

### 0.8 Protocolo global de reanudación tras una interrupción

```bash
git status --short
git diff --stat
git log --oneline -5
```

1. Leer **§1** y después solo el área afectada de la Parte II.
2. Ejecutar la línea base: `npx tsc --noEmit`, `npm test`, `cargo check --manifest-path src-tauri/Cargo.toml --lib` (añadir `cargo test --lib` si se tocó Rust).
3. Continuar por el primer `[~]`, `[p]`, `[!]` y después `[ ]` del área. Reparar el código parcial; **no eliminarlo**.
4. **No** ejecutar `git checkout --`, `git reset --hard` ni `git clean -fd` sobre trabajo sin commit.
5. Antes de cambiar de fase: actualizar este documento (§0.3) y ejecutar la verificación completa.
6. Bóvedas de prueba solo en `/tmp/opencode`; nunca una bóveda real para pruebas destructivas. No tocar `dist/`, `src-tauri/target/`, `node_modules/` ni APKs firmadas.

---

## 1. Parte I — Resumen ejecutivo

### 1.1 Mapa de áreas

| ID | Área (antes) | Estado | Última actualización | Pendiente principal |
| --- | --- | --- | --- | --- |
| [A1](#a1-seguridad-documentos-y-bibliografia) | Endurecimiento de seguridad: Documentos y Bibliografía | Fases 1–8 y B4 cerradas en automático | 2026-11-03 | Matriz manual de seguridad (Tauri/web) sin ejecutar. |
| [A2](#a2-documentos-y-lector-pdf-nativo-pdfium) | Documentos y lector PDF nativo (PDFium) | Fases 1–4 implementadas, publicadas en `v0.4.3` | 2026-11-03 | Prueba manual con PDF real; Fases 5–7 sin empezar. |
| [A3](#a3-busqueda-de-metadatos-para-bibliografia) | Búsqueda de metadatos (DOI, ISBN, palabras clave) | Código, verificación automática y rendimiento cerrados | 2026-11-03 | Matriz manual de UI (Fase 4); `cargo audit` con red. |
| [B1](#b1-fsrs-7-motor-dual-trace-y-licencias) | FSRS-7 (motor dual-trace) y licencias | Fases 0–3 verificadas en automático; prueba de escritorio hecha | 2026-11-21 | Prueba manual en Android; retención 0.97 en Tauri. |
| [B2](#b2-correcciones-de-la-auditoria-fsrs-7) | Correcciones de la auditoría FSRS-7 | Correcciones aplicadas; 422 pruebas / 43 archivos | 2026-11-20 | Una comprobación manual `[?]`: intervalo en horas/minutos con retención 0.97. |
| [B3](#b3-reparaciones-de-la-auditoria-fsrs-7-lote-2) | Reparaciones FSRS-7 (lote 2) | Fases 1–8 verificadas en automático; 449 pruebas / 44 archivos | 2026-11-21 | Progreso visible con vault grande y prueba en Android. |
| [B4](#b4-mazos-personalizados-de-flashcards) | Mazos personalizados de flashcards | **Cerrada**, publicada en `v0.4.4` | 2026-11-03 | Ninguno. |
| [C1](#c1-temas-visuales-lino--dracula) | Temas visuales (Lino + Dracula) | Bloques 0–7 implementados y verificados en navegador | 2026-10-25 | Confirmación visual del usuario (splash y temas). |
| [C2](#c2-fixes-de-ui) | Fixes de UI (mapa/oclusión, canvas, flashcards) | Fases 1–3 y 5 implementadas; publicado en `v0.5.2` | 2026-11-21 | Prueba manual en app Tauri (botones, oclusión, scroll, imágenes). |
| [D1](#d1-mantenimiento-y-recuperacion) | Mantenimiento y recuperación | 22 de 23 tareas cerradas | 2026-10-29 | T7 fase 2 (edición real de dos paneles) y verificación manual con bóveda real. |
| [D2](#d2-rendimiento-a-escala-14k-notas--200-bullets) | Rendimiento a escala (14k notas × 200 bullets) | Fases 1–4-E implementadas; Fase 5 sin empezar | 2026-10-31 | Verificación end-to-end con app empaquetada; mitad Rust de 4.5. |

### 1.2 Pendientes consolidados

**Bloque A — Búsqueda, documentos y seguridad**

- **A1:** ejecutar la matriz manual de Documentos y Bibliografía (symlinks, autoapertura, portadas `127.0.0.1`/`//host`, wikilinks con `]]`, SVG activo) y la regresión con bóveda real de solo lectura (§A1.5).
- **A2:** con PDF real en Tauri: abrir, navegar, redimensionar, confirmar que no se copia al vault, que quitar el enlace no borra el original, y arrastrar el divisor con ventana estrecha (§A2.1.7). Fase 2 requiere pruebas con PDF de una/tres columnas y texto rotado; Fases 3–7 siguen abiertas.
- **A3:** recorrer la matriz manual de la Fase 4 (DOI/ISBN/palabras clave, sin red, 429, rate limit, portadas, `<script>`, Android) con bóveda temporal (§A3.4); `cargo audit` con red; reconsiderar las 12 alertas altas de CodeQL tras subir el código con DOMPurify.

**Bloque B — Repaso, FSRS y mazos**

- **B1:** prueba manual en Android (retraso de sesión y ajustes) (§B1.3).
- **B2:** repasar una tarjeta con retención 0.97 y verificar intervalo en horas/minutos en Tauri/Android (§B2.6).
- **B3:** verificar que la UI responde y muestra progreso por lotes con vault grande en escritorio (§B3.6.2) y en Android (§B3.7).
- **B4:** sin pendientes.

**Bloque C — Interfaz y temas visuales**

- **C1:** confirmación visual del usuario: splash único en `tauri dev`, temas en XP real y APK sin cambios (§C1.5).
- **C2:** probar en app Tauri: botones del mapa conceptual, cierre/toolbar/guardar de oclusión, contraste de tareas canvas, scroll con rueda en flashcard larga y carga de imágenes en modo repaso (§C2.4, §C2.8).

**Bloque D — Mantenimiento y rendimiento**

- **D1:** T7 fase 2 (historial/guardado independientes por panel, divisor arrastrable y atajos) sigue pendiente; verificación manual en Tauri y APK con bóveda real; `git tag baseline-0.3.5` no se creó.
- **D2:** verificación end-to-end con app empaquetada y flag `sinnotas-metadata-boot` ON (arranque, omnibar, grafo, kanban/flashcards streaming, rename, drag sobre nota fría, sync externo y reinicio). Queda la mitad Rust de 4.5 (árboles en disco + índice sin árboles) y la Fase 5 (editor virtualizado) no está empezada.

### 1.3 Línea base de verificación

> Los números son los registrados por cada área en su momento y sirven como referencia histórica; **volver a ejecutarlos antes de dar por buena una verificación**.

| Comando | Último resultado registrado | Áreas que lo usan |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 errores (múltiples áreas) | Todas |
| `npm test` | 319 → 356 → 381 → 394 → 422 → 449 → 465 pruebas según el área | Todas |
| `npm run build` | Correcto | Todas |
| `cargo check --manifest-path src-tauri/Cargo.toml --lib` | Correcto | A1, A2, A3, B4, D2 |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib` | 87 pruebas (seguridad/PDF/mazos); 66 en el hilo de rendimiento | A1, A2, B4, D2 |

Comandos de control globales:

```bash
npx tsc --noEmit
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml --lib
cargo test --manifest-path src-tauri/Cargo.toml --lib
git diff --check
```

### 1.4 Decisiones con riesgo o decisión pendiente

| Tema | Decisión / riesgo | Sección |
| --- | --- | --- |
| `glib 0.18.5` (GHSA-wrw7-89jp-8q8g) | Riesgo tolerado: transitiva de Tauri 2 → GTK 0.18, sin fix compatible. Reactivar con Tauri 2 con glib 0.20 o Tauri 3. No cambiar a mano. | A3, D1 |
| CodeQL | 12 alertas altas de saneado/XSS abiertas porque el análisis corrió sobre código anterior; 8 `incomplete-multi-character-sanitization`, 3 `bad-tag-filter`, 1 `xss`. `js/request-forgery` descartada como falso positivo. | A3 |
| PDFium nativo sin sandbox | Riesgo residual aceptado: mantener versión actualizada y no autoabrir reduce la exposición, no la elimina. | A1, A2 |
| DNS rebinding en portadas remotas | No protegido por `isAllowedRemoteImageUrl` si el host resuelve a IP privada después de validar. Opción segura: no permitir portadas remotas. | A1 |
| CSP del modo web | No se añade: el modo web no se considera soportado para bóvedas no confiables. Revisar si se confirma como objetivo de producto. | A1 |
| `ease-factor` en FSRS-7 | Se conserva el campo por compatibilidad, pero deja de mutar. | B2, B3 |
| Fuzz de intervalos | Diferido: cambiaría vencimientos y vectores dorados. Solo se permitiría opt-in, determinista por tarjeta y desactivado por defecto. | B3 |
| Vista dividida (T7) | Fase 1 (solo lectura) entregada; edición real de dos paneles diferida por riesgo alto en guardado/undo. | D1 |
| Memoria a 14k notas | Los árboles siguen cargados en la caché de Rust; la mitad Rust de 4.5 (árboles en disco + LRU propio) queda abierta. | D2 |

---

## 2. Parte II — Detalle por área

> Contenido íntegro de los 11 checklist fusionados, con los encabezados reordenados bajo IDs estables. Las referencias entre checklist se han convertido en enlaces internos a estas secciones. Para editar, aplicar las reglas de la §0.

## 2.A Bloque A — Búsqueda, documentos y seguridad

<a id="a1-seguridad-documentos-y-bibliografia"></a>

### A1. Endurecimiento de seguridad: Documentos y Bibliografía

**Estado:** Fases 1–8 implementadas y publicadas en `v0.4.3`; B4 (búsqueda de metadatos) implementada y verificada automáticamente; matriz manual pendiente · **Última actualización:** 2026-11-03
**Origen:** auditoría de solo lectura de Documentos/PDF y Bibliografía.
**Rama de trabajo:** `master`
**Documento principal:** `docs/SinNotas.md`
**Checklist relacionado:** `Checklist consolidado § A2`, `Checklist consolidado § A3`

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
> están en [`Checklist consolidado § A3`](#a3-busqueda-de-metadatos-para-bibliografia);
> este documento solo registra que la superficie B4 no altera las invariantes
> D1–D4 ni B1–B3.

---

#### 0. Cómo usar este checklist

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

##### Reglas de trabajo

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

#### 1. Resumen de hallazgos y orden

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

##### Hallazgos que no se corrigen en este plan

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

#### 2. Estado de partida

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

##### Baseline esperado

- `npx tsc --noEmit` sin errores.
- Suite de Vitest en verde.
- `npm run build` correcto.
- `cargo check` y `cargo test --lib` correctos.
- Si falta PDFium y alguna prueba Rust se omite, anotarlo; no es un fallo del
  cambio.

---

#### 3. Mapa de archivos

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
| `Checklist consolidado § A2` | Reglas específicas del lector PDF. |

---

#### 4. Fases de implementación

##### Fase 1 — D1: contención de registro y capturas

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

##### Fase 2 — B1: validación de portadas remotas

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

##### Fase 3 — D2: quitar autoapertura y validar `links.json`

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

##### Fase 4 — D3: revalidación y límites de recursos

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

##### Fase 5 — D4: dejar de exponer rutas absolutas

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

##### Fase 6 — B2: títulos seguros en wikilinks

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

##### Fase 7 — B3: paridad de validación en modo web

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

##### Fase 8 — Cierre: documentación y verificación global

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
- [x] Añadir una nota en `Checklist consolidado § A2` que apunte a D1–D4.
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

#### 5. Matriz de pruebas manuales

##### Documentos

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

##### Bibliografía

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

##### Regresión general

- [x] `npm test` completo (356 pruebas).
- [x] `npm run build`.
- [x] `cargo test --lib` (87 pruebas).
- [ ] Abrir una bóveda real de solo lectura y comprobar que no se modifica su
      `.sinnotas` ni sus archivos.
- [ ] Cambiar de bóveda y comprobar que no se muestran portadas de la bóveda
      anterior.

---

#### 6. Riesgos y decisiones pendientes

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

#### 7. Definition of Done

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

#### 8. Comandos de referencia

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

#### 9. Notas para la próxima sesión

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


<a id="a2-documentos-y-lector-pdf-nativo-pdfium"></a>

### A2. Documentos y lector PDF nativo (PDFium)

**Estado:** Fases 1–4 implementadas (documentos enlazados, texto, capturas y caducidad); pendiente prueba manual de la UI · **Última actualización:** 2026-11-03
**Rama de trabajo:** `master` (publicado en `v0.4.3`)
**Documento principal:** `docs/SinNotas.md`
**Endurecimiento relacionado:** `Checklist consolidado § A1` (D1–D4)

Este documento es el punto de reanudación si una sesión de trabajo se corta a
mitad. La app debe seguir siendo MIT; el plugin de Anki
(`anki-search-inside-add-card`, AGPL-3.0) se usa **solo como referencia de
comportamiento**, nunca como fuente de código.

---

#### 0. Reglas de reanudación después de una interrupción

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

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

##### Restos de interrupciones

Anotar aquí cualquier bloque incompleto que se encuentre y la decisión tomada.
Si no hay restos, dejar «Ninguno».

- Ninguno.

---

#### 1. Decisiones cerradas

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

##### Tamaños de referencia (PDFium build 8125)

| Plataforma | Librería sin comprimir |
| --- | ---: |
| Linux x86_64 | `libpdfium.so` 8.0 MB |
| Windows x86_64 | `pdfium.dll` 7.6 MB |
| macOS universal | `libpdfium.dylib` 15.2 MB |
| Android arm64 | `libpdfium.so` 6.6 MB |

---

#### 2. Mapa de archivos

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

#### 3. Fases

##### Fase 0 — Base y documentación

- [x] Explorar la arquitectura de SinNotas y el plugin de Anki.
- [x] Confirmar que no se puede reutilizar código AGPL manteniendo MIT.
- [x] Elegir PDFium nativo frente a PDF.js.
- [x] Medir el impacto de tamaño por plataforma.
- [x] Crear este checklist con reglas de reanudación.
- [x] Enlazar este checklist desde `docs/SinNotas.md`.

##### Fase 1 — Infraestructura PDFium y lector mínimo

Objetivo: enlazar un PDF externo, abrirlo, ver la primera página y navegar
entre páginas. Sin capa de texto, sin selección y sin tarjetas.

###### 1.1 Dependencias Rust

- [x] Añadir `pdfium-render = { version = "0.9.5", default-features = false, features = ["pdfium_8125", "thread_safe"] }`.
- [x] Añadir `image = { version = "0.25", default-features = false, features = ["png"] }`.
- [x] Confirmar que no se activa la descarga automática de PDFium.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib`.

###### 1.2 Librería nativa

- [x] Descargar PDFium build 8125 de `bblanchon/pdfium-binaries`.
- [x] Copiar Linux x86_64 a `src-tauri/resources/pdfium/linux-x86_64/libpdfium.so`.
- [x] Copiar `LICENSE` a `src-tauri/resources/pdfium/LICENSE`.
- [x] Añadir script `scripts/fetch-pdfium.sh` para otras plataformas.
- [x] Ignorar los binarios en `.gitignore` y documentar el fetch.
- [x] Resolver la ruta en dev (`CARGO_MANIFEST_DIR`) y en producción
      (`resource_dir`), con override `SINNOTAS_PDFIUM_PATH`.
- [x] Carga perezosa con `Mutex<Option<Pdfium>>`; no inicializar al arrancar la app.

###### 1.3 Módulo Rust

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

###### 1.4 Comandos Tauri

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

###### 1.5 Tipos TypeScript

- [x] Añadir `PdfListItem`, `PdfPageInfo`, `PdfDocumentInfo`.
- [x] Añadir `"pdf"` a `ViewType`.
- [x] Añadir `"pdf"` a `validViews` de `readLastNavigation`.

###### 1.6 Interfaz

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

###### 1.7 Verificación de Fase 1

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

##### Fase 2 — Capa de texto y selección

- [x] Extraer texto por página con posiciones (`FPDFText_*`).
- [x] Devolver `PdfTextPage { widthPoints, heightPoints, runs[] }`.
- [x] Pintar una capa HTML transparente sobre la imagen.
- [x] Selección nativa con ratón y teclado.
- [x] Copiar texto seleccionado.
- [x] Resaltar la selección.
- [x] Manejar PDFs escaneados sin texto.
- [ ] Pruebas con PDF de una columna, dos columnas y texto rotado.

##### Fase 3 — Insertar texto en el editor

- [x] Botón «Insertar en la nota» para la selección.
- [x] Crear un bullet nuevo después del bloque activo.
- [ ] Escapar Markdown y preservar saltos de línea (de momento se normaliza el
      espacio y se conserva como texto plano en un bullet).
- [x] Insertar cita con origen (`pdf-source::`) sin crear tarjeta por sí sola.
- [ ] Cloze: `==texto== #card`.
- [ ] Insertar imagen de página completa como bloque de imagen.
- [ ] Deshacer/rehacer con el historial existente.
- [ ] Pruebas de tree-engine y del flujo de guardado.

##### Fase 4 — Capturas y oclusiones

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

##### Fase 5 — Búsqueda, TOC, enlaces y anotaciones

- [ ] `pdf_search` con `FPDFText_FindStart`/`FindNext`.
- [ ] Panel de resultados y salto a página.
- [ ] Índice/bookmarks.
- [ ] Enlaces internos y externos.
- [ ] Zoom, rotación y modo ajuste.
- [ ] Miniaturas.
- [ ] Resaltados propios en `.sinnotas/pdf/<sha256>.json`.
- [ ] Última página y progreso de lectura.
- [ ] Pruebas de persistencia y migración.

##### Fase 6 — Empaquetado y Android

- [ ] Configurar recursos por plataforma (Linux, Windows, macOS).
- [ ] Añadir paso de fetch/cache de PDFium en CI.
- [ ] Firmar/notarizar la dylib en macOS.
- [ ] Verificar AppImage, NSIS, DMG y `.deb`.
- [ ] Evaluar Android por ABI y SAF.
- [ ] Medir tamaño real de cada instalador.
- [ ] Documentar actualización de PDFium y checksums.

##### Fase 7 — Cierre

- [ ] Actualizar `docs/SinNotas.md` con estado final.
- [ ] Añadir pruebas de regresión al CI.
- [ ] Revisar licencias de PDFium y dependencias.
- [ ] Probar PDFs dañados, cifrados y muy grandes.
- [ ] Revisar consumo de memoria y caché.

---

#### 4. Contratos de la Fase 1

##### `pdf_list`

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

##### `pdf_open`

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

##### `pdf_render_page`

```ts
const png = await invoke<ArrayBuffer>("pdf_render_page", {
  path: "assets/pdfs/libro.pdf",
  pageIndex: 0,
  targetWidth: 1200,
});
```

La respuesta es un PNG binario, no un `Vec<u8>` serializado como JSON.

##### `pdf_import`

Sin argumentos. Abre el selector nativo y guarda un **enlace** al PDF elegido
en `.sinnotas/documents/links.json`; no copia el archivo. Devuelve `null` si el
usuario cancela. En móvil devuelve un error claro hasta la fase 6.

##### `pdf_unlink`

```ts
const removed = await invoke<boolean>("pdf_unlink", { path: "link:<uuid>" });
```

Quita la entrada del registro. No borra ni modifica el archivo original.

---

#### 5. Reglas de seguridad

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
  `Checklist consolidado § A1`: registro/capturas,
  autoapertura, revalidación/límites y rutas absolutas.
- No ejecutar JavaScript embebido en el PDF.
- No escribir en el PDF original.
- No usar `hint` de oclusión con el texto que se quiere ocultar.
- PDFium es C++ nativo: mantenerlo actualizado y registrar la versión usada.

---

#### 6. Comandos de verificación

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

#### 7. Registro de sesiones

| Fecha | Fase | Cambios | Verificación |
| --- | --- | --- | --- |
| 2026-11-01 | 0 | Checklist y decisiones | Documento creado |
| 2026-11-01 | 1 | Dependencias, motor PDFium, comandos y lector mínimo | `cargo check`; `cargo test` (5 pruebas PDF); `tsc`; `npm test` (324 pruebas) |
| 2026-11-01 | 1 | Sección «Documentos», importación por enlace en `.sinnotas/documents/links.json`, quitar enlaces y estado de archivo ausente | `cargo check`; `cargo test` (8 pruebas PDF); `tsc`; `npm test` (324 pruebas) |
| 2026-11-01 | 2–4 | Capa de texto seleccionable, inserción en la nota con `pdf-source::`, capturas en `assets/pdf-captures/`, borrado de documentos, caducidad de enlaces y checkboxes más grandes | `cargo check`; `cargo test --lib pdf::` (12 pruebas); `tsc`; `npm test` (325 pruebas); `npm run build` |
| 2026-11-02 | D1–D4 | Registro/capturas con `resolve_vault_path`, sin autoapertura, revalidación y límites de render, rutas absolutas fuera de la API | `cargo test --lib` (87 pruebas); `npm test` (356 pruebas); `tsc`; `cargo check` |
| 2026-11-03 | UI PDF | Divisor arrastrable entre PDF y editor, límites de ancho, control por teclado, doble clic para restablecer y proporción persistente | `tsc`; `npm test` (356 pruebas); `npm run build`; prueba de humo en modo web con arrastre, teclado, doble clic y recarga |

---

#### 8. Pendientes inmediatos al reanudar

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


<a id="a3-busqueda-de-metadatos-para-bibliografia"></a>

### A3. Búsqueda de metadatos para Bibliografía (DOI, ISBN y palabras clave)

**Estado:** implementación, verificación automática y rendimiento del diálogo completados; matriz manual de UI pendiente · **Última actualización:** 2026-11-03
**Rama de trabajo:** `master`
**Documento principal:** `docs/SinNotas.md`
**Checklists relacionados:** `Checklist consolidado § A1`, `Checklist consolidado § A2`
**Origen:** plugin de Obsidian `obsidian-book-search-plugin` (carpeta hermana del repo) y petición de integrar una búsqueda equivalente, pero hecha en Rust y con controles de seguridad explícitos.

> Este documento está pensado para **retomar el trabajo sin conexión**. Si se corta
> internet, no hace falta recordar nada: aquí están el estado, los archivos, los
> comandos y el siguiente paso exacto. No borrar este documento al terminar; se
> actualiza.

---

#### 0. Cómo usar este checklist

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado, pendiente de prueba manual. |

##### Reglas de trabajo

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

#### 1. Estado actual y punto de reanudación

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

##### Si se corta internet ahora mismo

1. Ejecutar:
   ```bash
   cd /home/alonso/Documentos/Repositorios/SinNotas
   git status --short
   git diff --stat
   ```
2. Buscar marcas de trabajo pendiente:
   ```bash
   grep -rn "TODO(bib)\|FIXME(bib)\|LOOKUP" src src-tauri/src Checklist consolidado § A3
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

##### Qué se puede borrar y qué no

- **Se puede borrar:** `src-tauri/target/` (se regenera), `dist/` (se regenera),
  bóvedas temporales de `/tmp/opencode`.
- **No se puede borrar:** `src-tauri/src/bibliography_lookup.rs`,
  `src/views/bibliography-lookup.ts`, los cambios en
  `src/views/bibliography-view.ts`, `src/desktop.ts`, `src/i18n.ts`,
  `src/bibliography.css`, `src-tauri/Cargo.toml` y este documento.
- Si un archivo nuevo está a medias, marcarlo `[p]` y dejarlo; no vaciarlo.

---

#### 2. Auditoría de Dependabot (2026-11-03)

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

##### Detalle de la alerta descartada

- **#13 — `glib 0.18.5`**, GHSA-wrw7-89jp-8q8g, severidad media.
- Motivo del descarte: es transitiva de Tauri 2 → GTK 0.18 → glib 0.18. El fix
  está en glib 0.20, incompatible con la pila GTK de Tauri 2; no hay backport a
  0.18. La app no invoca `VariantStrIter` ni `Variant`, así que el riesgo es UB
  local en GTK. **Reactivar cuando Tauri publique con glib 0.20 (o Tauri 3).**
- No cambiar `glib` a mano: rompería la compilación de GTK.

##### Acciones de mantenimiento

- [x] Verificar que no hay alertas abiertas.
- [x] Verificar que no hay PRs abiertos de Dependabot.
- [x] Documentar la excepción de `glib`.
- [ ] Volver a ejecutar esta consulta antes de cada release (`gh api ...`).
- [ ] Si se añade `reqwest` como dependencia directa, revisar que su versión
  fijada en `Cargo.lock` no introduzca alertas nuevas (`cargo audit`).

---

#### 3. Objetivo funcional

En la vista **Bibliografía → Añadir recurso**, permitir:

1. Pegar un **DOI** (con o sin `https://doi.org/`, `doi:` o `10.`).
2. Pegar un **ISBN-10 o ISBN-13** (con o sin guiones).
3. Escribir **palabras clave** (título, autor, tema).
4. Ver una lista de resultados con título, autores, año, tipo y proveedor.
5. Pulsar un resultado para **rellenar el formulario** (título, tipo, autor, año,
   páginas, enlace y portada). El usuario revisa y confirma con «Crear recurso».
6. Si no hay red, el formulario manual sigue funcionando y se muestra un error
   claro. Nunca se pierde lo ya escrito.

##### Fuera de alcance (v1)

- Google Books con clave API. Se puede añadir después como proveedor nuevo sin
  cambiar el contrato del comando.
- Descargar la portada al vault. v1 solo devuelve la URL validada de Open
  Library; la descarga segura queda como fase futura.
- Sincronización, bases de datos locales o metadatos en segundo plano.
- Búsqueda desde la vista móvil de repaso (la APK Android se compila con
  `VITE_APP_MODE=flashcards`).

---

#### 4. Diseño de seguridad

##### 4.1 Modelo de amenaza

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

##### 4.2 Validación de entradas

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

##### 4.3 Contrato del comando

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

##### 4.4 Proveedores y endpoints fijos

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

#### 5. Fases de implementación

##### Fase 1 — Backend Rust

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

##### Fase 2 — Cliente y UI

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

##### Fase 3 — CSP y documentación

- [x] Añadir `https://covers.openlibrary.org` a `img-src` en
  `src-tauri/tauri.conf.json` y `devCsp`.
- [x] Documentar el comando, el modelo de amenaza y la lista de verificación en
  este archivo.
- [x] Actualizar `docs/SinNotas.md` con una referencia a este checklist.
- [x] Actualizar `Checklist consolidado § A1` con la
  nueva superficie de red.
- [x] Prueba de humo en vivo (`live_lookup_smoke`, `#[ignore]`) contra Crossref
  y Open Library: DOI, ISBN y palabras clave devuelven resultados.

##### Fase 3b — Radios y rendimiento (2026-11-03)

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

##### Fase 4 — Verificación manual

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

#### 6. Lista de verificación de seguridad (para revisar antes de publicar)

##### Entrada y red

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

##### Salida

- [x] `clean_text` elimina C0/C1, bidi y Zero-Width; colapsa espacios.
- [x] Límites de longitud por campo (título 500, autores 400, resumen 2000…).
- [x] Los resúmenes JATS se desetiquetan y se decodifican entidades básicas.
- [x] `safe_result_url` solo acepta `https` + hosts allowlist.
- [x] `allowed_cover_url` solo acepta `covers.openlibrary.org/b/id/{digitos}-{S,M,L}.jpg`.
- [x] La UI usa `textContent` para títulos, autores y metadatos.
- [x] El tipo se normaliza a `BibliographyType`.

##### Configuración y supply chain

- [x] CSP: solo se añade `covers.openlibrary.org` a `img-src`; no se abre
  `connect-src`.
- [x] `tauri.conf.json` no habilita `dangerousDisableAssetCspModification` ni
  `withGlobalTauri`.
- [x] No se añaden capacidades de Tauri para HTTP: la petición ocurre en Rust.
- [x] `reqwest`/`url`/`tokio` ya estaban en `Cargo.lock`; no se añaden crates
  nuevos no auditados.
- [ ] `cargo audit` sin vulnerabilidades nuevas (requiere red/BD de RustSec).
- [x] Revisar el diff de `Cargo.lock` antes de commitear.

##### Privacidad

- [x] Solo se envía la consulta escrita por el usuario.
- [x] No se envía el contenido de la bóveda, rutas, títulos de notas ni tokens.
- [x] No hay telemetría ni analytics.
- [x] No se persisten resultados en disco.
- [x] La búsqueda es explícita (botón), no automática.

---

#### 7. Siguiente paso exacto

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
     Checklist consolidado § A3 docs/SinNotas.md \
     Checklist consolidado § A1
   git commit -m "feat(bibliografia): búsqueda de metadatos por DOI, ISBN y palabras clave"
   ```

---

#### 8. Notas de implementación y trampas conocidas

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

#### 9. Registro de cambios de este documento

| Fecha | Cambio |
| --- | --- |
| 2026-11-03 | Creación: auditoría de Dependabot, diseño de seguridad, fases y punto de reanudación. |
| 2026-11-03 | Verificación automática cerrada: Rust (99 pruebas, clippy y rustfmt), frontend (394 pruebas, `tsc`, build) y prueba de humo en vivo. Pendiente solo la matriz manual de UI. |
| 2026-11-03 | Radios de Bibliografía tokenizados con `--ma-radius-*` y diagnóstico de rendimiento: se retira el `backdrop-filter` de las superficies de ventana completa (Aero). Medido con Playwright: ~31 fps → ~102-153 fps al escribir; diálogo estable a 60 fps. |
| 2026-11-03 | Revisión de seguridad: Dependabot sin alertas abiertas; hardening de entrada, aritmética de páginas, saneado HTML con DOMPurify y descarga remota de portadas. Ver §10. |

---

#### 10. Revisión de seguridad (2026-11-03)

Alcance: alertas de Dependabot y superficies de la búsqueda DOI/ISBN/palabras
clave (backend Rust, cliente TypeScript, portadas e imágenes pegadas).

##### Estado de dependencias

- **Dependabot:** 0 alertas abiertas (15 `fixed`, 1 `dismissed`). La descartada
  es `glib 0.18.5` (`GHSA-wrw7-89jp-8q8g` / `RUSTSEC-2024-0429`), transitiva de
  `tauri → gtk 0.18`; no existe versión compatible que la corrija y su impacto
  real es bajo (requiere entrada local maliciosa en GTK).
- **`npm audit`:** 0 vulnerabilidades.
- **Floors parcheados:** `vite ^6.4.5`, `tinypool >=2.1.2`, `esbuild >=0.25.0`.
- **`Cargo.lock`:** `async-executor 1.14.1` y `clipboard-win 5.4.3` (ambos
  estaban *yanked*).
- **Dependabot ignores:** los `ignore` de `vite`/`vitest` llevan
  `applies-to: "version-updates"` para que un aviso de seguridad con parche en
  una versión mayor siga abriendo PR.

##### Búsqueda de metadatos: conclusiones

- Hosts constantes y HTTPS en el backend, sin seguir redirecciones, `rustls`,
  timeouts, límite de respuesta de 2 MiB, rate limit y caché. Sin SSRF ni
  inyección explotable.
- El frontend no usa `innerHTML` con datos remotos; las URLs se validan contra
  allowlists antes de renderizar o descargar.
- **Hardening aplicado:**
  - `sanitize_query` rechaza entradas enormes por bytes antes de recorrerlas.
  - `parse_page_count` usa aritmética `checked` (evita *overflow* con rangos
    absurdos de un proveedor comprometido).
  - `sanitizeLookupText` acota la entrada; los resultados IPC no-array,
    no-objeto o con campos no-string se descartan sin lanzar.
  - `paste-sanitizer` y `clipboardHtmlImageSource` usan **solo** DOMPurify; se
    eliminan los *fallbacks* regex incompletos.
  - La descarga de imágenes remotas usa `redirect: "error"`,
    `credentials: "omit"`, `referrerPolicy: "no-referrer"` y un límite de
    10 MiB (cabecera `content-length` + lectura por *stream*).

##### Pendiente / riesgo residual

- **CodeQL:** 12 alertas altas de saneado/XSS permanecen abiertas porque el
  análisis se ejecutó sobre el código anterior: 8
  `js/incomplete-multi-character-sanitization`, 3 `js/bad-tag-filter` y 1
  `js/xss` en `src/desktop.ts` y `src/editor/paste-sanitizer.ts`. Con los
  cambios actuales (DOMPurify como única ruta) deberían cerrarse al subir y
  reejecutar el análisis.
- **`js/request-forgery` (crítica):** descartada como **falso positivo**. La
  petición la hace el cliente de escritorio (Tauri), no un servidor; la URL
  procede de HTML que el usuario pega y la respuesta solo se muestra como
  imagen local. Además ya se bloquean hosts privados/locales y loopback, se
  prohíben redirecciones, se omiten credenciales/referrer y se limita la
  respuesta a 10 MiB. CodeQL no modela la validación de hostname como
  *sanitizer*, por eso la alerta no desaparece con el endurecimiento. Queda
  registrada como `dismissed` con esa justificación.
- **`cargo audit`:** solo warnings informativos (`glib`, `bincode`,
  `proc-macro-error`, `zbus_names`, `zvariant`); sin avisos accionables.
- **`cargo fmt --check`:** falla por formato preexistente en
  `src-tauri/src/lib.rs`, no por esta revisión.


## 2.B Bloque B — Repaso, FSRS y mazos

<a id="b1-fsrs-7-motor-dual-trace-y-licencias"></a>

### B1. FSRS-7 (motor dual-trace) y licencias de terceros

**Estado:** Fases 0–3 implementadas y verificadas en automático; pendiente prueba manual en Tauri y Android · **Última actualización:** 2026-11-20
**Rama de trabajo:** `master`
**Documento principal:** `docs/SinNotas.md`
**Licencias:** [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md)

Este documento es el punto de reanudación si una sesión de trabajo se corta a
mitad. El plan sustituye el motor FSRS-7 de `src/editor/fsrs.ts` por el
algoritmo oficial FSRS-7 y deja constancia de las licencias de PDFium y FSRS-7.

---

#### 0. Reglas de reanudación después de una interrupción

> Leer esta sección **antes** de editar cualquier archivo.

1. Ejecutar `git status --short` y `git diff --stat`.
2. Revisar el diff completo antes de tocarlo:
   `git diff -- src/editor/fsrs.ts src/editor/fsrs-settings.ts src/views/flashcards-manager.ts src/store/review-progress.ts src/desktop.ts src/mobile/review-app.ts src/i18n.ts index.html package.json`.
3. Si un archivo está sin seguimiento, leerlo entero con `sed`/`read` antes de
   escribir. No asumir que está completo.
4. Buscar restos de una ejecución cortada:
   `grep -RIn "TODO-FSRS7\|FIXME-FSRS7\|SINNOTAS-FSRS7" src src-tauri/src docs`.
5. Buscar errores de sintaxis antes de continuar:
   `npx tsc --noEmit` y `npm test`.
6. **Nunca** ejecutar `git checkout --`, `git reset --hard`, `git clean -fd`,
   ni borrar un archivo a medias. Una línea incompleta puede contener una
   firma o una decisión que no está documentada en otro sitio.
7. Si un bloque no compila, **repararlo**, no eliminarlo. Si hay que
   reemplazarlo, copiar primero el contenido sospechoso a la sección
   «Restos de interrupciones».
8. Continuar por el primer ítem con estado `[~]` o `[p]`. Si no hay ninguno,
   por el primer `[ ]` de la fase actual.
9. Marcar `[~]` al empezar un ítem y `[x]` solo después de verificarlo.
10. Antes de cambiar de fase, actualizar el estado de este documento y
    preguntar al usuario.

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

##### Restos de interrupciones

Anotar aquí cualquier bloque incompleto que se encuentre y la decisión tomada.
Si no hay restos, dejar «Ninguno».

- Ninguno.

---

#### 1. Decisiones cerradas

- **Algoritmo:** FSRS-7 oficial de 34 pesos con curva dual
  (`stability` + `stabilityFast`). No se mantiene FSRS-7 como modelo
  alternativo.
- **Implementación:** port oficial `ts-fsrs@6.0.0`, entrada
  `ts-fsrs/models/fsrs-7`. Su código declara ser un port de
  `fsrs-rs/src/model_v7.rs`, así que las fórmulas coinciden con el repo de
  referencia bajado en `/home/alonso/Documentos/Repositorios/fsrs-rs`
  (commit `9fb03928d8c8fd84f5b9df2b2f6ddc631e6cae81`, `v7.0.0-2-g9fb0392`).
- **No se integra el crate Rust `fsrs`:** el planificado es el frontend TS;
  añadir un comando Tauri obligaría a convertir todo el repaso a asíncrono.
- **Migración:** hay dos acciones en **Ajustes → Recalcular propiedades**:
  - **Convertir FSRS-4.5 a FSRS-7** conserva estabilidad, dificultad, repasos,
    lapsos y pasos; añade `card-s-fast::` como `0.8 · stability`, normaliza
    `card-state` y recalcula intervalos y vencimientos de las tarjetas en
    repaso. Es la opción recomendada si se quiere conservar el progreso.
  - **Restablecer FSRS** borra la programación y deja todas las tarjetas como
    nuevas. Es la opción más limpia si se prefiere empezar de cero.
  La guía oficial de `ts-fsrs` 6 desaconseja inventar `stabilityFast`; por eso
  la conversión es una aproximación documentada y el reset sigue siendo la
  única vía para un estado FSRS-7 exacto.
- **Compatibilidad:** mientras no se convierta ni se restablezca, las tarjetas
  antiguas sin `card-s-fast::` se normalizan a `stability · 0.8` para que sigan
  funcionando. Es la misma aproximación que aplica la conversión.
- **Pasos de aprendizaje:** se conservan los pasos cortos actuales
  (`1m 10m` / `10m`) para el retraso de la sesión. FSRS-7 también usa su
  rastro rápido intrínseco; desactivar los pasos no lo desactiva.
- **Intervalos:** FSRS-7 devuelve días fraccionarios. Los intervalos menores
  de un día se conservan fraccionarios (p. ej. `0.173 d` → 4 h) para respetar
  retenciones altas; los de un día o más se redondean (`Math.round`). Se
  conserva el máximo `maximumInterval` de la configuración.
- **Licencias:** [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md) en
  la raíz, con textos completos y versiones de PDFium y FSRS-7.
- **Node:** `ts-fsrs` 6 exige Node ≥ 24; `package.json` se actualiza desde
  `>=22.12.0`.
- La app sigue siendo MIT. Ninguna dependencia añadida es copyleft.

---

#### 2. Mapa de archivos

| Ruta | Responsabilidad |
| --- | --- |
| `src/editor/fsrs.ts` | Motor FSRS-7: `FSRSEngine`, `FSRSItem`, `FSRSParameters`, pesos por defecto. |
| `src/editor/fsrs-settings.ts` | Normalización, carga y guardado de los 34 pesos y los pasos. |
| `src/views/flashcards-manager.ts` | Persistencia de `card-s-fast::`, previews, `rate`, snapshots e historians. |
| `src/store/review-progress.ts` | Diario de repasos: sanea y conserva `stabilityFast`. |
| `src/editor/fsrs.test.ts` | Vectores dorados contra `fsrs-rs` y pruebas del motor. |
| `src/editor/fsrs-settings.test.ts` | Normalización de 34 pesos. |
| `src/views/flashcards-manager.test.ts` | Persistencia, reprogramación y reset. |
| `src/desktop.ts` | Ajustes FSRS, reset y textos de repaso. |
| `src/mobile/review-app.ts` | Ajustes y badge del repaso Android. |
| `src/i18n.ts` | Cadenas ES/EN/ZH. |
| `index.html` | Panel de ajustes y etiquetas FSRS. |
| `package.json` | Dependencia `ts-fsrs` y `engines.node`. |
| `THIRD_PARTY_LICENSES.md` | Licencias de PDFium y FSRS-7. |
| `docs/SinNotas.md` | Resumen técnico y enlace a este checklist. |
| `README.md` | Enlace al checklist. |

---

#### 3. Fases

##### Fase 0 — Base, licencias y referencia

- [x] Crear este checklist con reglas de reanudación.
- [x] Crear `THIRD_PARTY_LICENSES.md` con PDFium (BSD-3-Clause + Apache-2.0 +
  MIT del empaquetado) y FSRS-7 (ts-fsrs MIT, srs-kit BSD-3-Clause, fsrs-rs
  BSD-3-Clause como referencia).
- [x] Confirmar que `ts-fsrs@6.0.0` publica `models/fsrs-7` y que es un port de
  `fsrs-rs/model_v7.rs`.
- [x] Generar vectores dorados con `fsrs-rs` 7.0.0 (commit `9fb0392`) para el
  estado nuevo y el estado de repaso.
- [x] Registrar la dependencia `ts-fsrs@6.0.0` y subir `engines.node` a
  `>=24`.

##### Fase 1 — Motor FSRS-7 y persistencia

- [x] `FSRSItem` incluye `stabilityFast?: number`.
- [x] `defaultFSRSParams.w` son los 34 pesos FSRS-7 de `FSRS7_DEFAULT_WEIGHTS`.
- [x] `FSRSEngine` delega init, `next_state`, curva de olvido e intervalo en
  `FSRS7Algorithm`.
- [x] `nextInterval` recibe el estado completo (S, D, SF), conserva las
  fracciones menores de un día, redondea las de un día o más y aplica el
  máximo.
- [x] Los pasos de aprendizaje conservan el retraso corto y gradúan con el
  intervalo FSRS-7.
- [x] `card-s-fast::` se lee, escribe, compara y borra; `clearFSRSProgress` y
  `applyScheduleSnapshot` lo tratan.
- [x] `rescheduleFSRS` reprograma con el estado completo.
- [x] El diario de repasos (`CardScheduleSnapshot` y `sanitizeSnapshot`)
  conserva `stabilityFast`.
- [x] Pruebas doradas contra `fsrs-rs` y actualización de las existentes.

##### Fase 2 — Ajustes, i18n y documentación

- [x] `normalizeFSRSParameters` valida 34 pesos finitos.
- [x] Añadir la acción **Convertir FSRS-4.5 a FSRS-7** en
  **Ajustes → Recalcular propiedades**, con confirmación y texto de ayuda.
- [x] El panel de ajustes muestra FSRS 7 y los 34 parámetros.
- [x] Cadenas ES/EN/ZH actualizadas (FSRS 7, 34 parámetros).
- [x] `docs/SinNotas.md`, `README.md`, `GUIA-DE-USO.md`, `USER-GUIDE.md` y
  `CONTRIBUTING.md` reflejan FSRS-7 y el reset.
- [x] Este checklist enlazado desde `docs/SinNotas.md` y `README.md`.

##### Fase 3 — Verificación final

- [x] `npm run build` en verde.
- [x] `npm test` en verde.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib` en verde (sin
  cambios de Rust, pero se comprueba que el árbol sigue compilando).
- [x] Prueba manual en escritorio: crear tarjetas, repasar, deshacer y
  restablecer FSRS.
- [ ] Prueba manual en Android: repaso y ajustes.
- [x] Actualizar la tabla de archivos de `Checklist consolidado § D1`.

---

#### 4. Registro

| Fecha | Fase | Cambio | Verificación |
| --- | --- | --- | --- |
| 2026-11-20 | 0 | Checklist, licencias y dependencia `ts-fsrs` 6.0.0. | `npm install`; vectores `fsrs-rs`. |
| 2026-11-20 | 1 | Motor FSRS-7 y persistencia de `card-s-fast::`. | `npm test`; `npx tsc --noEmit`. |
| 2026-11-20 | 2 | Ajustes, i18n y documentación. | `npm run build`; `npm test`. |
| 2026-11-21 | 3 | Prueba manual en escritorio: crear tarjetas, repasar, deshacer y restablecer FSRS. | vite + navegador (modo flashcards tras «Abrir el modo repaso»): nueva tarjeta creada en el editor y persistida; sesión de repaso (mostrar respuesta + rating «Bien»); «Último repaso deshecho» (Deshacer) con «Rehacer repaso» habilitado; «Restablecer FSRS» → «Aplicar recálculo» → estado «Tarjetas actualizadas: 1». |

---

#### 5. Apéndice — Verificación rápida

```bash
npx tsc --noEmit
npm test -- src/editor/fsrs.test.ts src/editor/fsrs-settings.test.ts src/views/flashcards-manager.test.ts src/store/review-progress.test.ts
npm run build
cargo check --manifest-path src-tauri/Cargo.toml --lib
```

Vectores de referencia (`fsrs-rs` 7.0.0, commit `9fb0392`), retención 0.9:

| Caso | S | SF | D | Intervalo (días) |
| --- | ---: | ---: | ---: | ---: |
| Nueva · Again | 0.1104 | 0.08832 | 6.1686 | 0.00003828 |
| Nueva · Hard | 2.2395 | 1.7916 | 5.261278 | 0.59745979 |
| Nueva · Good | 3.9221 | 3.13768 | 3.530724 | 4.77772474 |
| Nueva · Easy | 11.7841 | 9.427279 | 1.0 | 53.86939240 |
| Repaso (S=10, SF=8, D=5) · Again | 2.43025088 | 0.41938692 | 9.04004192 | 0.01400643 |
| Repaso · Hard | 18.25272369 | 120.51950836 | 6.97668457 | 17.78954315 |
| Repaso · Good | 22.89891052 | 190.60226440 | 4.95229959 | 42.85027695 |
| Repaso · Easy | 22.89891052 | 206.47039795 | 2.92791510 | 74.56172943 |

`ts-fsrs` redondea `next_state` a 8 decimales; las comparaciones de las pruebas
usan tolerancia `1e-3` para absorber la diferencia entre el cálculo `f32` de
`fsrs-rs` y el `f64` de `ts-fsrs`.


<a id="b2-correcciones-de-la-auditoria-fsrs-7"></a>

### B2. Correcciones de la auditoría FSRS-7

**Estado:** correcciones aplicadas · **Última actualización:** 2026-11-20
**Rama:** `master` (cambios sin commitear)
**Objetivo:** corregir los hallazgos de la auditoría FSRS-4.5 → FSRS-7 sin romper la
persistencia Markdown, el diario de repasos ni las tarjetas existentes.
**Documento de contexto:** [`Checklist consolidado § B1`](#b1-fsrs-7-motor-dual-trace-y-licencias)

> Todas las fases de código están cerradas y verificadas con `tsc` y la suite
> completa (422 pruebas / 43 archivos). Queda una sola comprobación manual
> marcada `[?]`: repasar en Tauri/Android con retención 0.97 y ver el intervalo
> en horas/minutos.

---

#### 0. Cómo reanudar si se corta la sesión

1. `git status --short` y `git diff --stat`.
2. Leer este archivo entero antes de editar.
3. Ejecutar la línea base:
   ```bash
   npx tsc --noEmit
   npm test
   ```
4. Buscar el primer ítem `[~]`, `[p]` o `[ ]`. No borrar código a medias: si un
   ítem quedó `[p]`, repararlo antes de seguir.
5. Ejecutar solo los tests de la fase mientras se trabaja:
   ```bash
   npx vitest run src/editor/fsrs.test.ts \
     src/editor/fsrs-settings.test.ts \
     src/views/flashcards-manager.test.ts \
     src/store/review-progress.test.ts
   ```
6. Al terminar un ítem, marcarlo `[x]` y anotar la verificación en el registro.
7. Antes de cambiar de fase, ejecutar `npx tsc --noEmit && npm test`.
8. **No** ejecutar `git checkout --`, `git reset --hard` ni `git clean -fd`.

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso. |
| `[p]` | Código parcial; no borrar. |
| `[x]` | Hecho y verificado. |
| `[!]` | Bloqueado; anotar el motivo. |
| `[?]` | Hecho, pendiente de prueba manual en Tauri/Android. |

---

#### 1. Línea base

- [x] `npm test`: **405 pruebas / 43 archivos** en verde antes de tocar código.
- [x] `npx tsc --noEmit`: sin errores.
- [x] Confirmado que no hay base de datos de tarjetas: Markdown +
      `.sinnotas/progress/reviews.json` + `localStorage`.

---

#### 2. Fase 1 — Bugs críticos

##### 2.1 `nextInterval` conserva intervalos fraccionarios menores de un día

- [x] `src/editor/fsrs.ts`: eliminar `Math.max(1, Math.round(raw))`.
      Nuevo comportamiento: `raw < 1` se conserva; `raw >= 1` se redondea.
- [x] `src/editor/fsrs.ts`: actualizar el comentario de “whole days”.
- [x] `src/editor/fsrs.ts`: añadir rama de segundos a `formatInterval`
      y evitar mostrar `24h` cuando corresponde `1d`.
- [x] Tests: `src/editor/fsrs.test.ts` — intervalos de 35m, 4h, 3s, 12h y vector
      oficial Review Good.
- [x] Test existente de lapse actualizado: la graduación de Relearning ya no
      exige `>= 1` día; ahora comprueba `0 < I < 1` y texto `9h`.

**Verificación:** `npx vitest run src/editor/fsrs.test.ts` en verde.

##### 2.2 Deshacer/rehacer repasos anteriores a la migración

- [x] `src/views/flashcards-manager.ts`: normalizar `stabilityFast`
      ausente como `stability * 0.8` en `scheduleSnapshotsEqual`.
- [x] Test de regresión en `src/views/flashcards-manager.test.ts`: una
      instantánea antigua sin `stabilityFast` debe ser igual a la tarjeta
      normalizada.
- [x] Test de persistencia: `updateBlockFSRS` escribe `card-s-fast`, se lee y
      `clearFSRSProgress` lo borra.

**Verificación:** `npx vitest run src/views/flashcards-manager.test.ts` en verde.

---

#### 3. Fase 2 — Validación y robustez

##### 3.1 Motor: recorte de pesos y retención

- [x] `src/editor/fsrs.ts`: importar `clipFSRS7Parameters` y recortar los
      34 pesos en el constructor.
- [x] Acotar `requestRetention` a `[0.7, 0.97]` y `maximumInterval` a `>= 1`
      dentro del constructor (defensa para llamadas directas).
- [x] Validar que los pasos de aprendizaje/reaprendizaje sean `< 1` día; si no,
      caer a los valores por defecto.
- [x] Test: `new FSRSEngine({ requestRetention: 1.2 })` no lanza y produce un
      intervalo finito; pesos fuera de rango se recortan y los pasos inválidos
      caen a `1m`/`10m`.

**Verificación:** `npx vitest run src/editor/fsrs.test.ts` en verde.

##### 3.2 Pasos de aprendizaje < 1 día

- [x] `src/editor/fsrs-settings.ts`: `validSteps` exige `step < 1`.
- [x] `src/editor/fsrs-settings.ts`: `parseLearningSteps` rechaza `days >= 1`.
- [x] `src/editor/fsrs-settings.test.ts`: el caso `1d` ahora espera `null`.
- [x] Test: `normalizeFSRSParameters({ learningSteps: [2] })` cae a los pasos
      por defecto.

**Verificación:** `npx vitest run src/editor/fsrs-settings.test.ts` en verde.

##### 3.3 `sanitizeSnapshot` con cotas

- [x] `src/store/review-progress.ts`: aceptar `stability > 0`,
      `stabilityFast > 0` y `difficulty` en `[1, 10]`; descartar el resto.
- [x] Test en `src/store/review-progress.test.ts`: valores `0`, negativos y
      `difficulty: 99` se descartan.

**Verificación:** `npx vitest run src/store/review-progress.test.ts` en verde.

##### 3.4 Reprogramar tarjetas legacy sin `card-state`

- [x] `src/views/flashcards-manager.ts`: si no hay `card-state` pero sí
      `card-learn-step::`, no reprogramar (es Learning/Relearning).
- [x] Test: contenido con `card-learn-step:: 1` y sin `card-state` devuelve
      `null`.

**Verificación:** `npx vitest run src/views/flashcards-manager.test.ts` en verde.

##### 3.5 `ease-factor` deja de mutar con deltas SM-2

- [x] `src/views/flashcards-manager.ts`: dejar de aplicar
      `-0.2/-0.15/+0.15`; conservar el valor para compatibilidad.
- [x] Comentario que aclare que FSRS-7 no usa `ease-factor`.

**Verificación:** tests de repaso en `flashcards-manager.test.ts` en verde.

##### 3.6 Persistencia segura ante `NaN`

- [x] `updateBlockFSRS` y `applyScheduleSnapshot` normalizan `stability`,
      `difficulty` y `stabilityFast` no finitos antes de escribir Markdown.
- [x] `readScheduleSnapshot` ignora un `card-s-fast` inválido y usa `0.8·S`.

---

#### 4. Fase 3 — Reset e historial

- [x] `src/desktop.ts`: corregir el texto de confirmación para decir que se
      borra la **programación** de las tarjetas, no todo el historial.
- [x] Confirmado que `clearFSRSProgress` borra `card-s-fast`, `card-state` y
      `card-learn-step` (cubierto por tests).
- [x] Decisión documentada: **no** borrar `.sinnotas/progress/reviews.json` ni
      las estadísticas automáticamente, porque el backend fusiona el diario y
      borrarlo requeriría un comando de sobrescritura destructivo. Si se quiere
      un borrado total, crear un ítem aparte con comando Rust y confirmación
      explícita.

---

#### 5. Fase 4 — Documentación y CI

- [x] `docs/SinNotas.md`: sustituir los pesos de FSRS-4.5 por los de FSRS-7.
- [x] `docs/SinNotas.md`: reemplazar `nextRecallStability` por `next_stability`
      (rastro lento + rápido).
- [x] `docs/SinNotas.md`: actualizar el conteo de pruebas a 422 en 43 archivos.
- [x] `Checklist consolidado § B1`: resolver la contradicción reset vs
      normalización: el reset es recomendable; si no se ejecuta, el fallback
      `0.8·S` mantiene las tarjetas funcionando pero no es FSRS-7 exacto.
- [x] `Checklist consolidado § B1`: documentar que los intervalos `< 1 día` se
      conservan fraccionarios.
- [x] `.github/workflows/*.yml`: `node-version: "22"` → `"24"`
      (10 ocurrencias en 5 archivos).

---

#### 6. Fase 5 — Verificación final

- [x] `npx tsc --noEmit`: sin errores.
- [x] `npm test`: **422 pruebas / 43 archivos** en verde.
- [x] `git diff --stat` revisado; no quedan tests temporales
      (`src/__audit.test.ts` eliminado).
- [?] Prueba manual pendiente en Tauri/Android: repasar una tarjeta con
      retención 0.97 y comprobar que el intervalo muestra horas/minutos.
- [x] Registro de este documento actualizado.

---

#### 7. Decisiones y riesgos

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Intervalos `< 1 día` | Se conservan fraccionarios; `>= 1` se redondea | FSRS-7 los devuelve y la retención 0.97 los necesita. Evita cambiar la programación de tarjetas con intervalos largos. |
| Reset obligatorio vs fallback | Se mantiene el fallback `0.8·S` y se añade la conversión no destructiva | Evita romper tarjetas antiguas; el reset sigue disponible para un estado FSRS-7 exacto. |
| Borrar diario/estadísticas al reset | No automático; solo se corrige el texto | El backend fusiona el diario; un borrado requiere un comando destructivo aparte. |
| Vencimiento al reprogramar | Se mantiene `last-reviewed + intervalo` | Conserva el significado actual y el test existente; un cambio a “desde hoy” es una decisión de producto. |
| `ease-factor` | Se conserva el campo, pero deja de mutar | Compatibilidad con tarjetas antiguas; FSRS-7 no lo usa. |
| Pasos `>= 1 día` | Se rechazan en ajustes y en el constructor | Un paso de un día dejaría la tarjeta “aprendiendo” sin actualizar el estado FSRS. |

---

#### 8. Registro

| Fecha | Fase | Cambio | Verificación |
| --- | --- | --- | --- |
| 2026-11-20 | 1 | `nextInterval` fraccionario + `formatInterval` con segundos | `vitest fsrs.test.ts` |
| 2026-11-20 | 1 | Igualdad de snapshots legacy con `stabilityFast` | `vitest flashcards-manager.test.ts` |
| 2026-11-20 | 2 | Recorte de pesos, retención y pasos en el constructor | `vitest fsrs.test.ts` (15 pruebas) |
| 2026-11-20 | 2 | Pasos `< 1` día en ajustes y parseo | `vitest fsrs-settings.test.ts` |
| 2026-11-20 | 2 | Cotas de `stability`/`stabilityFast`/`difficulty` en el diario | `vitest review-progress.test.ts` |
| 2026-11-20 | 2 | No reprogramar tarjetas legacy de aprendizaje | `vitest flashcards-manager.test.ts` |
| 2026-11-20 | 2 | `ease-factor` deja de mutar | `vitest flashcards-manager.test.ts` |
| 2026-11-20 | 3 | Texto de confirmación del reset aclarado | revisión manual |
| 2026-11-20 | 4 | Pesos FSRS-7, `next_stability` y conteo de pruebas | `docs/SinNotas.md` |
| 2026-11-20 | 4 | Reset recomendado vs fallback y fracciones `< 1` día | `Checklist consolidado § B1` |
| 2026-11-20 | 4 | Node 22 → 24 en los 5 workflows | `grep node-version` |
| 2026-11-20 | 5 | Verificación final | `tsc` limpio + 422 pruebas / 43 archivos |
| 2026-11-20 | 6 | Conversión FSRS-4.5 → FSRS-7 desde Ajustes | `vitest flashcards-manager.test.ts` (4 nuevas) |

---

#### 9. Ampliación — Conversión FSRS-4.5 → FSRS-7

- [x] `FlashcardsManager.migrateLegacyFSRS`: detecta tarjetas sin
      `card-s-fast::` y les añade el rastro rápido `0.8 · stability`.
- [x] Normaliza `card-state` en tarjetas antiguas (Review, Learning o
      Relearning) y conserva el paso de aprendizaje.
- [x] Las tarjetas en Review recalculan intervalo y vencimiento con FSRS-7;
      las de Learning/Relearning conservan su paso y su retraso.
- [x] Conversión idempotente: las tarjetas que ya tienen un `card-s-fast`
      válido no se modifican.
- [x] Nueva opción **Convertir FSRS-4.5 a FSRS-7** en
      **Ajustes → Recalcular propiedades**, con confirmación y texto de ayuda.
- [x] Tests: Review, Learning, idempotencia y tarjetas sin datos FSRS.
- [x] Documentación actualizada (`docs/SinNotas.md` y `Checklist consolidado § B1`).

**Verificación:** `npx tsc --noEmit` limpio; `npm test` **422 pruebas / 43
archivos** en verde.

**Decisión:** la conversión conserva el progreso y es la opción recomendada
cuando no se quiere perder el historial de una tarjeta. Sigue siendo una
aproximación (`0.8 · S`) porque FSRS-4.5 nunca guardó el rastro rápido; para un
estado FSRS-7 exacto hay que usar **Restablecer FSRS**.


<a id="b3-reparaciones-de-la-auditoria-fsrs-7-lote-2"></a>

### B3. Reparaciones de la auditoría FSRS-7 (lote 2)

**Estado:** fases 1–8 implementadas y verificadas en automático; pendiente prueba manual en Tauri/Android · **Última actualización:** 2026-11-21
**Rama:** `master` (cambios sin commitear)
**Objetivo:** aplicar, **por orden**, las recomendaciones pendientes de la auditoría
FSRS-7 y añadir una capa intermedia por lotes para que los recálculos masivos no
congelen la interfaz.
**Documentos de contexto:**
[`Checklist consolidado § B1`](#b1-fsrs-7-motor-dual-trace-y-licencias) ·
[`Checklist consolidado § B2`](#b2-correcciones-de-la-auditoria-fsrs-7)

> Este documento es la fuente de verdad para reanudar el trabajo. Si se corta la
> sesión o la conexión, leerlo entero y continuar por el primer ítem `[~]`,
> `[p]`, `[ ]` o `[!]`, en ese orden.

---

#### 0. Reglas para reanudar

1. **No** ejecutar `git checkout --`, `git reset --hard` ni `git clean -fd`.
   Hay trabajo FSRS sin commitear que se perdería.
2. Comprobar el estado sin modificar nada:
   ```bash
   git status --short
   git diff --stat
   ```
3. Leer este archivo entero antes de editar.
4. Línea base rápida antes de tocar código:
   ```bash
   npx tsc --noEmit
   npm test
   ```
   Si falla algo que ya fallaba, anotarlo en el registro y no atribuirlo a esta fase.
5. Buscar el primer ítem `[~]`, `[p]` o `[ ]`. No borrar código a medias: reparar
   el ítem `[p]` antes de avanzar.
6. Mientras se trabaja en una fase, ejecutar solo sus tests:
   ```bash
   npx vitest run src/editor/fsrs.test.ts \
     src/editor/fsrs-settings.test.ts \
     src/views/flashcards-manager.test.ts \
     src/views/flashcard-maintenance.test.ts \
     src/store/review-progress.test.ts
   ```
7. Al cerrar un ítem: marcarlo `[x]` y añadir una fila al registro (§10).
8. Antes de cambiar de fase: `npx tsc --noEmit && npm test`.
9. Las acciones de recálculo **deben** seguir usando el servicio por lotes
   (`src/views/flashcard-maintenance.ts`). No volver a bucles síncronos sobre
   todas las tarjetas.

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso. |
| `[p]` | Código parcial; no borrar, terminar. |
| `[x]` | Hecho y verificado. |
| `[!]` | Bloqueado; anotar el motivo. |
| `[?]` | Hecho, pendiente de prueba manual en Tauri/Android. |

---

#### 1. Línea base y mapa de archivos

- [x] `git status --short` revisado; no se revierte nada existente.
- [x] `npx tsc --noEmit` limpio.
- [x] `npm test` en verde (**449 pruebas / 44 archivos**). La línea base tenía
      un fallo previo en `flashcards-manager.test.ts` (esperaba 338 días del
      motor antiguo); se corrigió a **55 días**, el valor de FSRS-7 para
      S=30, D=5, SF=24 y retención 0.9.

| Archivo | Responsabilidad |
| --- | --- |
| `src/editor/fsrs.ts` | Motor FSRS-7, `previewRatings`, pasos, intervalos, formato. |
| `src/editor/fsrs-settings.ts` | Normalización, parseo/format de pasos, carga/guardado. |
| `src/views/flashcards-manager.ts` | Reprogramación, conversión, snapshots, lectura de propiedades. |
| `src/views/flashcard-maintenance.ts` | **Nuevo**: servicio async por lotes para recálculos masivos. |
| `src/desktop.ts` | Ajustes FSRS y acciones de recálculo de escritorio. |
| `src/mobile/review-app.ts` | Ajustes FSRS y acciones de recálculo en Android. |
| `index.html` | Controles de escritorio. |
| `src/i18n.ts` | Textos ES/EN/ZH. |
| `src/editor/fsrs.test.ts` | Motor, vectores oficiales y pasos. |
| `src/editor/fsrs-settings.test.ts` | Normalización y parseo. |
| `src/views/flashcards-manager.test.ts` | Reprogramación, conversión, estados legacy. |
| `src/views/flashcard-maintenance.test.ts` | **Nuevo**: lotes, progreso, cancelación y guardado. |

---

#### 2. Fase 1 — Núcleo del motor (`src/editor/fsrs.ts`)

##### 2.1 Pasos estrictamente crecientes y únicos

- [x] En el constructor, validar que `learningSteps` y `relearningSteps` sean
      finitos, `> 0`, `< 1` y **estrictamente crecientes**. Si no, usar los
      valores por defecto.
- [x] Copiar siempre los arrays por defecto (no compartir referencias).
- [x] Tests: pasos desordenados (`[10m, 1m]`) y duplicados (`[1m, 1m]`) caen a
      los valores por defecto; los válidos se conservan.

##### 2.2 `Hard` con 3 o más pasos

- [x] `learningTransition`: en el **primer** paso, `Hard` promedia los dos
      primeros; en pasos posteriores **repite el paso actual**.
- [x] Comportamiento esperado con `1m 10m 1h`:
      - `Hard` en el paso 0 → `6m` (media de 1m y 10m).
      - `Hard` en el paso 1 → `10m` (no `35m`).
      - `Hard` en el último paso → ese mismo paso.
- [x] Tests de regresión para los tres casos.

##### 2.3 Pasos de reaprendizaje vacíos

- [x] Revisar la rama `Review + Again`: si `relearningSteps` está vacío, la
      tarjeta debe **graduarse a Review** (`state 2`) con un intervalo FSRS
      positivo, no quedarse en `state 3` con intervalo `0`.
- [x] Mantener el incremento de `lapses` y el flujo normal con pasos no vacíos.
- [x] Test: `relearningSteps: []` en Review + Again devuelve `state 2`,
      `intervalDays > 0` y no deja `learningStep`.

##### 2.4 Vencimientos sin hora heredada

- [x] Añadir un helper único para calcular vencimientos desde una revisión y un
      intervalo (`computeDueDate` en `src/editor/fsrs.ts`).
- [x] Para intervalos `< 1 día`, conservar la hora (pasos cortos).
- [x] Para intervalos `>= 1 día`, normalizar al **inicio del día local**.
- [x] Usarlo en `rescheduleFSRS`, `recalculateDueDate`, `updateBlockFSRS`,
      `applyScheduleSnapshot` y en las vistas previas que escriban fechas.
- [x] Tests: un repaso a las 14:10 con intervalo de 10 días vence a las
      `00:00:00` local del día correspondiente; un paso de 10m conserva la hora.

##### 2.5 `formatInterval` exacto

- [x] Evitar el redondeo grueso de meses (`44d = 1mo`, `45d = 2mo`).
- [x] Usar días hasta 59 y meses con un decimal a partir de 60 días
      (`44d`, `59d`, `2mo`, `2.5mo`), manteniendo `s`, `m`, `h`, `d`, `mo`, `y`.
- [x] Tests: 44, 45, 59, 60, 76 y 365 días; conservar los casos de 35m, 4h, 12h.

---

#### 3. Fase 2 — Normalización y ajustes (`src/editor/fsrs-settings.ts`)

- [x] `normalizeFSRSParameters(null)` y cualquier fallback devuelven arrays
      **nuevos** (`w`, `learningSteps`, `relearningSteps`).
- [x] `validSteps` exige estrictamente crecientes.
- [x] `parseLearningSteps` rechaza pasos desordenados, duplicados, `>= 1d` y
      tokens inválidos. La cadena vacía sigue devolviendo `[]`.
- [x] Nuevo helper `parseMaximumInterval(value: string)`:
      - cadena vacía → `defaultFSRSParams.maximumInterval`;
      - número inválido → `null` (error de formulario);
      - valor válido → entero acotado a `[1, 36500]`.
- [x] Tests de normalización, referencias compartidas, orden de pasos y máximo
      vacío.

---

#### 4. Fase 3 — Reprogramación y datos legacy (`src/views/flashcards-manager.ts`)

##### 4.1 Ancla explícita de reprogramación

- [x] `rescheduleFSRS(content, parameters, options?)` acepta:
      - `anchor: "today" | "last-reviewed"` (por defecto `"last-reviewed"` para
        no romper llamadas existentes);
      - `now?: Date` inyectable en tests.
- [x] Con `"today"`, el vencimiento parte del momento actual.
- [x] Con `"last-reviewed"`, se conserva el comportamiento anterior y puede
      producir fechas pasadas.
- [x] La UI de escritorio y Android ofrecerá el ancla, con `"today"` como opción
      recomendada por defecto.
- [x] Tests para ambas anclas y para el caso de vencimiento pasado.

##### 4.2 Rastro rápido al reprogramar

- [x] Si una tarjeta en Review no tiene `card-s-fast` válido, `rescheduleFSRS`
      añade `card-s-fast:: 0.8 × stability`.
- [x] No duplicar la propiedad si ya existe.
- [x] Test: tarjeta legacy reprogramada contiene `card-s-fast` e intervalo nuevo.

##### 4.3 Estado Relearning en tarjetas sin `card-state`

- [x] En `parseBlockFSRS`, `migrateLegacyFSRS` e `inferSnapshotState`, una
      tarjeta sin `card-state` que tenga `card-learn-step` y `lapses > 0` se
      infiere como `Relearning (3)`, no `Learning (1)`.
- [x] Tests para las tres rutas: lectura, conversión y snapshots antiguos.

##### 4.4 Conversión legacy sin `card-s-fast`

- [x] Confirmar que `migrateLegacyFSRS` sigue añadiendo el rastro rápido y es
      idempotente.
- [x] Test adicional: una tarjeta sin `card-s-fast` pero con `card-state` se
      convierte y una segunda pasada devuelve `null`.

---

#### 5. Fase 4 — Servicio por lotes (anti-freeze)

**Archivo nuevo:** `src/views/flashcard-maintenance.ts`

- [x] Definir `FlashcardMaintenanceAction = "due-dates" | "reschedule" |
      "convert" | "reset"`.
- [x] Definir `FlashcardMaintenanceOptions`:
      `action`, `parameters`, `anchor`, `now`, `batchSize` (por defecto 40),
      `signal`, `yieldControl`, `savePage`, `onProgress`; además `pages` y
      `manager` para localizar los bloques sin acoplar el servicio al vault.
- [x] Agrupar tarjetas por `pageTitle + blockId` para no procesar dos veces el
      mismo bloque (cloze/oclusión pueden generar varias tarjetas).
- [x] Procesar en lotes; entre lotes:
      - ceder el hilo con `requestAnimationFrame` (o `setTimeout(0)` como
        respaldo);
      - informar `{ processed, total, updatedCards, savedPages }`.
- [x] Guardar las páginas tocadas **por lote** con `savePage`, no todas al final.
- [x] Soportar `AbortSignal` y devolver `cancelled: true` sin guardar el lote a
      medias.
- [x] Contar `pastDueCards` cuando el vencimiento resultante sea anterior a
      `now`, para avisar al usuario.
- [x] Tests en `src/views/flashcard-maintenance.test.ts`:
      - un vault sintético de varias páginas procesa todos los bloques;
      - `onProgress` se llama varias veces con lotes pequeños;
      - `yieldControl` se invoca entre lotes;
      - `savePage` recibe solo páginas modificadas;
      - cancelar a mitad no guarda el lote incompleto;
      - acción `reset`, `convert`, `due-dates` y `reschedule` producen el
        contenido esperado;
      - un bloque con varias tarjetas se escribe una sola vez.

---

#### 6. Fase 5 — Escritorio (`src/desktop.ts` + `index.html`)

##### 6.1 Ajustes FSRS

- [x] `saveFSRSSettings` envuelto en `try/catch`; en error:
      `console.error` + estado “No se pudo guardar la configuración FSRS.”
- [x] Intervalo máximo vacío usa el valor por defecto, nunca `1`.
- [x] Validar con `parseMaximumInterval`; valor inválido muestra error y no
      guarda.
- [x] Añadir ayuda visible: el intervalo máximo es un **límite duro** y, si se
      alcanza, la retención efectiva puede ser **mayor** que la objetivo.
- [x] Textos nuevos en `src/i18n.ts` (ES/EN/ZH).

##### 6.2 Recálculo por lotes

- [x] Añadir selector de ancla para reprogramar: “Desde hoy (recomendado)” /
      “Desde el último repaso”.
- [x] Sustituir el bucle síncrono por `runFlashcardMaintenance`.
- [x] Mostrar progreso por lotes en `#flashcard-recalc-status`
      (`Procesando… X/Y · N actualizadas`).
- [x] Al terminar:
      - rescan del vault y refresco de la vista actual;
      - mensaje de tarjetas actualizadas;
      - si `pastDueCards > 0`, aviso explícito y sugerencia de usar “Desde hoy”.
- [x] Mantener deshabilitados selector y botón solo durante el proceso.
- [?] Verificar que la UI responde (progreso visible) con un vault grande
      simulado o real. Los tests cubren el reparto por lotes, pero falta la
      comprobación manual en Tauri.

---

#### 7. Fase 6 — Android (`src/mobile/review-app.ts`)

- [x] Añadir en la hoja FSRS:
      - selector de acción (`due-dates`, `reschedule`, `convert`, `reset`);
      - selector de ancla (visible para `reschedule`);
      - botón “Aplicar recálculo” y estado con progreso.
- [x] Confirmación previa para `reset` y `convert` (y aviso para `reschedule`).
- [x] Usar el mismo `runFlashcardMaintenance`, con `this.vault.savePage`.
- [x] Al terminar: `manager.scanVault`, preservar tarjeta activa si existe,
      `render()` y toast/estado.
- [x] Manejar error y `busy` sin dejar la hoja bloqueada.
- [x] Textos ES/EN/ZH.
- [?] Prueba manual en Android: reprogramar con muchas tarjetas y
      comprobar que la UI no se congela y muestra progreso.

---

#### 8. Fase 7 — Fuzz / reparto de carga (decisión)

- [x] Evaluar fuzz de intervalos sin romper los vectores oficiales ni la
      programación determinista.
- [x] **Decisión de este lote:** **no se implementa**. El fuzz cambiaría los
      vencimientos respecto a los vectores oficiales y a los tests dorados; se
      deja como opción futura opt-in, determinista por tarjeta y desactivada por
      defecto. No se introduce aleatoriedad silenciosa.
- [x] Si se implementa: opt-in, determinista por tarjeta, desactivado por
      defecto, con tests de estabilidad y sin cambiar `nextInterval`.
      (No aplica en este lote: no se implementa.)

---

#### 9. Fase 8 — Verificación final

- [x] `npx tsc --noEmit` limpio.
- [x] Tests dirigidos en verde (`flashcard-maintenance`, `flashcards-manager`,
      `fsrs`, `fsrs-settings`, `review-progress`).
- [x] `npm test` completo en verde: **449 pruebas / 44 archivos**.
- [x] `git diff --stat` revisado; sin tests temporales ni archivos de banco de
      pruebas dentro de `src/`.
- [x] Comprobar que **ningún** recálculo masivo quedó en un bucle síncrono:
      ```bash
      grep -RIn "for (const .* of .*Cards" src/desktop.ts src/mobile/review-app.ts
      ```
      Solo queda un bucle de lectura/estado en `desktop.ts:2452`; toda la
      escritura masiva pasa por `runFlashcardMaintenance`.
- [x] Registrar decisiones y verificación.

---

#### 10. Registro

| Fecha | Fase | Cambio | Verificación |
| --- | --- | --- | --- |
| 2026-11-21 | 0 | Checklist creada para reanudar el trabajo | — |
| 2026-11-21 | 1 | Pasos validados, `Hard` con 3+ pasos, Relearning vacío, `computeDueDate` y `formatInterval` exacto | `vitest fsrs.test.ts` |
| 2026-11-21 | 2 | Normalización con arrays nuevos, orden estricto y `parseMaximumInterval` | `vitest fsrs-settings.test.ts` |
| 2026-11-21 | 3 | Ancla de reprogramación, rastro rápido y Relearning inferido | `vitest flashcards-manager.test.ts` (se corrigió la expectativa obsoleta 338 → 55 días) |
| 2026-11-21 | 4 | Nuevo servicio `flashcard-maintenance.ts` por lotes | `vitest flashcard-maintenance.test.ts` (7 pruebas) |
| 2026-11-21 | 5 | Escritorio: ancla, progreso, `try/catch`, máximo validado y ayuda | `tsc` + `npm test` |
| 2026-11-21 | 6 | Android: acciones de recálculo, ancla, progreso y confirmaciones | `tsc` + `npm run build`; pendiente prueba manual |
| 2026-11-21 | 7 | Fuzz diferido; sin aleatoriedad silenciosa | decisión documentada (§7 y §11) |
| 2026-11-21 | 8 | Verificación final | `tsc` limpio; 449 pruebas / 44 archivos; `npm run build` |

---

#### 11. Decisiones y riesgos

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Ancla de reprogramación | Por defecto en API: `last-reviewed`; en UI: `today` (recomendado) | Conserva tests/llamadas existentes y evita que tarjetas antiguas sigan vencidas. |
| Vencimiento con hora | `< 1 día` conserva hora; `>= 1 día` se normaliza al inicio del día local | Evita que un repaso a las 23:50 venza a las 23:50 y permite agrupar por día. |
| Intervalo máximo | Límite duro; la retención efectiva puede superar la objetivo | Es el comportamiento real de FSRS; la UI debe explicarlo en vez de ocultarlo. |
| Fuzz | Diferido salvo que se pueda hacer opt-in y determinista | No romper vectores oficiales, snapshots ni la reproducibilidad de tests. |
| Pasos vacíos | Graduar a Review con intervalo FSRS | Evita `state 3` con intervalo `0` y tarjetas atascadas. |
| `Hard` con 3+ pasos | Promedio solo en el primer paso; después repetir el paso | Coincide con el comentario y con el comportamiento esperado tipo Anki. |
| Lotes | 40 bloques por lote y guardado por lote | Equilibrio entre rendimiento y presión de I/O; el progreso se ve en la UI. |
| Android | Acciones completas, no solo aviso | Paridad funcional y evita que la APK quede sin mantenimiento FSRS. |


<a id="b4-mazos-personalizados-de-flashcards"></a>

### B4. Mazos personalizados de flashcards

> Registro de progreso para poder retomar la implementación si se interrumpe
> la conexión, se cierra el equipo o hay que revertir una parte.
>
> Última actualización: 2026-11-03

#### Decisiones cerradas con el usuario

- [x] Un **mazo** es una selección de notas guardada con un nombre.
- [x] El mazo **Todos** existe siempre y es el estado por defecto.
- [x] Solo puede haber **un mazo activo** a la vez.
- [x] Un mazo se puede **editar**, **crear** y **eliminar** de forma independiente.
- [x] Los mazos son **por bóveda** y deben poder **sincronizarse** entre equipos.
- [x] El **mazo activo es local de cada dispositivo** (no se sincroniza).
- [x] Una nota puede pertenecer a **varios mazos**.
- [x] Los nombres de mazo son **únicos** (sin distinguir mayúsculas/acentos).
- [x] En escritorio, el mosaico y la gestión viven en **Ajustes → Flashcards → General**.
- [x] En escritorio, la vista **Flashcards** tiene un selector rápido de mazo activo.
- [x] En Android debe haber un **selector de mazos independiente** en el modo repaso.

#### Arquitectura acordada

##### Persistencia

- Definiciones de mazos: archivo interno del vault
  `.sinnotas/flashcards/decks.json`.
- Mazo activo: `localStorage`, con una clave distinta por ruta de bóveda.
- Compatibilidad: al activar un mazo se sigue escribiendo
  `sinnotas-flashcard-pages` con la lista de notas resuelta, para que las
  versiones antiguas de Android sigan repasando lo mismo.
- Fallback web (sin Tauri): el archivo se simula en `localStorage`, separado
  por bóveda.

##### Modelo de datos

```ts
interface FlashcardDeck {
  id: string;
  name: string;
  pageTitles: string[];
  createdAt: number;
  updatedAt: number;
}

interface FlashcardDeckFile {
  version: 1;
  decks: FlashcardDeck[];
  tombstones: { id: string; deletedAt: number }[];
}
```

Las lápidas (`tombstones`) permiten que un mazo borrado en un equipo no
reaparezca al fusionar con la copia de otro equipo.

##### Fusión entre dispositivos

- Al guardar se lee el archivo actual, se fusiona por `id` usando `updatedAt`
  y se escribe el resultado.
- Un `tombstone` gana si su fecha es mayor o igual que `updatedAt` del mazo.
- Al guardar se respeta lo que el usuario desmarcó: una nota visible en el
  editor que queda sin marcar se elimina del mazo. Solo se conservan las notas
  del mazo que existen en el vault pero no eran editables (por ejemplo, porque
  se quedaron sin tarjetas). Las notas borradas del vault se descartan.
- Un mazo nuevo abre con todas las notas marcadas y sin error de nombre vacío;
  el error aparece cuando el usuario escribe o intenta guardar.
- Los nombres duplicados se resuelven con sufijos `(2)`, `(3)`…
- Límites: 200 mazos, 80 caracteres por nombre, 10 000 notas por mazo,
  500 lápidas y 1 MB de archivo.

##### Seguridad

- Validar todo JSON leído (versión, tipos, longitudes, duplicados).
- No usar nombres de mazo como rutas de archivo.
- Pintar nombres con `textContent`, nunca `innerHTML`.
- Backend: ruta interna fija y validada; escritura atómica; límite de tamaño.
- No guardar contenido de tarjetas ni datos sensibles en el archivo de mazos.

##### Rendimiento

- Cambiar de mazo no reescanea el vault: solo aplica el filtro en memoria y
  reconstruye la cola.
- Estadísticas por nota calculadas en una sola pasada.
- Guardar solo al confirmar, no en cada checkbox.
- El árbol existente conserva búsqueda, orden, paginado y render por lotes.

#### Fases

##### Fase 0 — Registro y preparación

- [x] Crear este checklist.
- [x] Revisar estado de git y dejar constancia de la base de partida.
  - Base: `21a2317 chore: release v0.4.3`.
  - Sin cambios previos del usuario; solo este checklist sin seguimiento.

##### Fase 1 — Backend Rust

- [x] Añadir constante `.sinnotas/flashcards/decks.json`.
- [x] Permitir esa ruta en la validación de archivos internos.
- [x] Añadir comandos `read_flashcard_decks` y `write_flashcard_decks`.
- [x] Registrar los comandos en `generate_handler!`.
- [x] Añadir pruebas de ruta permitida/rechazada y lectura/escritura.
- [x] Ejecutar `cargo test` o `cargo check` en `src-tauri`.
  - `cargo check --all-targets`: correcto.
  - `cargo test`: 87 pruebas correctas, 0 fallos.

##### Fase 2 — Almacén compartido TypeScript

- [x] Crear `src/store/flashcard-decks.ts` con tipos, validación, CRUD,
  migración y fusión.
- [x] Crear `src/store/flashcard-deck-storage.ts` con lectura/escritura Tauri,
  fallback web y mazo activo local por bóveda.
- [x] Releer el archivo del vault antes de fusionar al guardar, para no pisar
  cambios sincronizados por otro dispositivo.
- [x] Conservar al guardar las notas que siguen existiendo pero no tienen
  tarjetas en ese momento; descartar las notas borradas del vault.
- [x] Añadir pruebas unitarias del modelo y de la fusión.
- [x] Añadir pruebas del repositorio con `localStorage` simulado.
- [x] Ejecutar `npm test -- flashcard-deck`.
  - `npm test`: 39 archivos y 381 pruebas correctas, 0 fallos.
  - `npm run build`: correcto.

##### Fase 3 — Estadísticas de mazos

- [x] Añadir `getCardStatsByPage()` a `FlashcardsManager`.
- [x] Usar esas estadísticas en el mosaico y en Android.
- [x] Probar que los contadores respetan el filtro actual.
  - En navegador: **Todos** mostró 7 tarjetas; un mazo sin Rust Core mostró 6.
  - En Android web: un mazo con solo **Diarios** mostró `1 / 2` en el repaso.

##### Fase 4 — Escritorio: HTML y estilos

- [x] Añadir selector de mazo activo en Ajustes → Flashcards → General.
- [x] Añadir mosaico `#flashcard-decks-grid` con tarjeta “Todos” y “+ Nuevo”.
- [x] Añadir nombre del mazo y casilla “Activar al guardar” al editor.
- [x] Añadir selector rápido en la cabecera de la vista Flashcards.
- [x] Estilos de mosaico, tarjeta activa y acciones.
- [x] Comprobar accesibilidad básica (foco, `aria-label`, teclado).

##### Fase 5 — Escritorio: lógica

- [x] Cargar mazos al iniciar y al cambiar de bóveda.
- [x] Migrar `sinnotas-flashcard-pages` a un mazo “Selección anterior”.
- [x] Renderizar mosaico, selector y editor.
- [x] Crear mazo nuevo.
- [x] Editar mazo existente.
- [x] Eliminar mazo con confirmación.
- [x] Activar mazo y escribir el filtro de compatibilidad.
- [x] Guardar mazo y refrescar sesión si está activo.
- [x] Validar nombre vacío, duplicado y demasiado largo.
- [x] Actualizar referencias al renombrar una nota.
- [x] Mostrar aviso si el mazo no tiene notas.
- [x] Gestionar cambio de bóveda.
- [x] Recargar mazos al abrir Ajustes o la vista Flashcards.
- [x] Proteger el borrador al reabrir el mismo mazo o activarlo.
- [x] Un mazo nuevo parte con todas las notas marcadas.
- [x] Comparar los cambios sin guardar contra la selección resuelta del vault.

##### Fase 6 — Android

- [x] Añadir acción independiente “Mazos” al menú de repaso.
- [x] Añadir hoja de mazos con “Todos”, mazos, activo y acciones.
- [x] Añadir botón compacto de mazos en la cabecera.
- [x] Añadir nombre del mazo y guardado al editor de notas existente.
- [x] Crear, editar, activar y eliminar mazos desde Android.
- [x] Mantener compatibilidad con `sinnotas-flashcard-pages`.
- [x] Probar en modo web móvil y revisar CSS.
  - Hoja **Mazos**, editor de nombre, casillas, crear, activar, eliminar en
    dos pasos y repaso filtrado (`1 / 2` con un mazo de una sola nota).

##### Fase 7 — i18n y documentación

- [x] Añadir cadenas nuevas a `src/i18n.ts` (inglés y chino).
- [x] Actualizar `docs/SinNotas.md` con la sección de mazos personalizados.
- [x] Actualizar este checklist con el estado final.

##### Fase 8 — Verificación

- [x] `npm test` — 39 archivos, 381 pruebas correctas.
- [x] `npm run build` — `tsc` + Vite correctos.
- [x] `cargo check` / `cargo test` en `src-tauri` — 87 pruebas correctas.
- [x] Prueba manual escritorio:
  - [x] Crear mazo con nombre.
  - [x] Activar/desactivar mazo.
  - [x] Editar notas y guardar (incluido desmarcar una nota visible).
  - [x] Eliminar mazo con confirmación.
  - [x] Renombrar nota incluida en un mazo y comprobar que el mazo y el
    filtro de compatibilidad migran al título nuevo.
  - [x] Reiniciar/recargar app y comprobar persistencia del mazo y del activo.
  - [x] Aislamiento por bóveda: cubierto por las pruebas del repositorio
    (clave de `localStorage` distinta por ruta); no hay selector de bóvedas
    múltiple en el fallback web.
- [x] Prueba manual Android/web móvil:
  - [x] Abrir selector de mazos.
  - [x] Activar un mazo.
  - [x] Crear/editar/eliminar.
  - [x] Repasar solo las notas del mazo.

#### Archivos previstos

- `src-tauri/src/lib.rs`
- `src/store/flashcard-decks.ts` (nuevo)
- `src/store/flashcard-deck-storage.ts` (nuevo)
- `src/store/flashcard-decks.test.ts` (nuevo)
- `src/store/flashcard-deck-storage.test.ts` (nuevo)
- `src/views/flashcards-manager.ts`
- `src/desktop.ts`
- `index.html`
- `src/style.css`
- `src/mobile/review-app.ts`
- `src/mobile/mobile.css`
- `src/i18n.ts`
- `docs/SinNotas.md`

#### Cómo continuar si se interrumpe

1. Abrir este archivo y mirar la última fase marcada.
2. Ejecutar `git status` y `git diff --stat` para ver los archivos tocados.
3. No borrar cambios a medias: cada fase está pensada para compilar por sí sola.
4. Comandos útiles:

```bash
npm test
npm run build
cd src-tauri && cargo check
cd src-tauri && cargo test
```

5. Si una fase falla, revisar primero:
   - que los comandos Rust estén registrados en `generate_handler!`;
   - que la ruta `.sinnotas/flashcards/decks.json` esté permitida;
   - que el JSON guardado tenga `version: 1`;
   - que el mazo activo apunte a un `id` existente.

#### Registro de cambios

| Fecha | Fase | Nota |
| --- | --- | --- |
| 2026-11-03 | 0 | Checklist creado; decisiones cerradas. |
| 2026-11-03 | 1 | Backend: ruta interna, comandos y pruebas añadidas. `cargo` no disponible. |
| 2026-11-03 | 2 | Modelo, repositorio y pruebas creadas. `node`/`npm` no disponibles. |
| 2026-11-03 | 3 | Estadísticas por nota y suma por mazo. |
| 2026-11-03 | 4 | HTML y estilos de escritorio: mosaico, selector y editor. |
| 2026-11-03 | 5 | Lógica de escritorio: migración, CRUD, activación, compatibilidad y borradores. |
| 2026-11-03 | 6 | Android: hoja de mazos, botón de cabecera, editor con nombre y estilos. |
| 2026-11-03 | 7 | i18n (inglés/chino) y documentación funcional. |
| 2026-11-03 | 8 | Verificación automática superada: 380 pruebas JS, build Vite y 87 pruebas Rust. Queda la prueba visual/manual. |
| 2026-11-03 | 8 | Prueba manual de escritorio y Android web superada. Correcciones: la fusión ya no reintroduce notas desmarcadas; el error de nombre vacío no aparece al abrir un mazo nuevo; sufijos de nombre respetan el límite. Total: 381 pruebas JS. |
| 2026-11-03 | 8 | Publicado en la release `v0.4.4`. |


## 2.C Bloque C — Interfaz y temas visuales

<a id="c1-temas-visuales-lino--dracula"></a>

### C1. Temas visuales (Lino + Dracula)

> **Propósito:** registro de avance para retomar el trabajo si se corta la
> conexión y para verificar que nada se haya roto. Marcar `[x]` al completar
> cada ítem. Actualizar la sección "Estado" al final de cada bloque de trabajo.

#### Contexto (continuar desde aquí)

- Arquitectura actual: `src/style.css` define los tokens base `--ls-*` y los
  acentos (`data-accent`); `src/material-aero.css` redefine tokens/superficies
  y se importa SIEMPRE desde `src/desktop.ts` (línea ~18). El modo claro/oscuro
  alterna `data-theme` en `<html>`; el acento alterna `data-accent`.
- Objetivo: atributo `data-visual` en `<html>` con valores
  `aero` (por defecto, actual) · `lino` (claro suave, inspiración RemNote sin
  mencionar) · `dracula` (oscuro Dracula). Los tres responden al acento vía
  `color-mix(in srgb, var(--ls-accent) …)`.
- Carga plan (fijado): mantener el import estático de `material-aero.css`
  SIEMPRE cargado, con orden
  `style.css → material-aero.css → theme-lino.css → theme-dracula.css`.
  El CSS de aero está tokenizado; los temas nuevos SOLO redefinen tokens
  (más una sección "neutralizar aero": sheens/glows/blurs/fondos translúcidos
  hard-coded). Se elige el tema con el atributo `data-visual` en `<html>`
  persistido en `localStorage["sinnotas-visual"]` (default `aero`).

#### 1. Preparación

- [x] Confirmar scripts de `package.json` (build/test) para verificación final.
- [x] `AccentColor`/`accentColors` son locales de `desktop.ts` (móvil tiene el
      suyo, sin tocar). `vite-env.d.ts` no necesita cambios: imports CSS
      normales, no `?inline`.

#### 0. Fix splash triple (25/10/2026)

**Síntoma reportado:** al iniciar la app se veían ~3 splash distintos.

**Causa:** existía UN solo `#app-splash`, pero se le aplicaba estilo en tres
olas que lo repintaban cambiando su apariencia:
1. Bloque crítico inline de `index.html` (tokens inexistentes todavía:
   `--ls-bg` no está definido; fallback de acento `#89b4fa` ≠ `#61afef`).
2. Bloque duplicado en `src/style.css` (7648-7726) con tokens reales.
3. `src/material-aero.css` cambia el fondo de `html/body` tras el splash
   transparente (el splash quedaba carente de fondo).

**Fix aplicado:**
- [x] `index.html`: bloque crítico del splash = única fuente de estilo;
      colores estáticos que igualan el look final de Aero
      (fondo `#0a0c12`, acento por defecto `#61afef`, tipografía sin
      `var(--ls-font-scale)`).
- [x] `src/style.css`: eliminado el bloque duplicado `.app-splash` y sus
      `@keyframes`, con comentario que explica por qué no debe volver.
- [x] `src-tauri/tauri.conf.json`: `backgroundColor: "#0a0c12"` en la ventana
      para eliminar el flash del webview antes del primer paint (Tauri
      2.12.4 soporta esta opción).
> Nota: el CSP (`default-src 'self'`) prohíbe scripts inline, así que el
> splash es siempre oscuro; usuarios en modo claro verán el fade del splash
> oscuro hacia la app clara (una sola transición, no estilos varios).
> Pendiente de verificación manual al correr `npm run dev` (bloque 5).

#### 2. CSS de los temas

- [x] Crear `src/theme-lino.css` (claro suave + variante oscura para el
      conmutador claro/oscuro).
- [x] Crear `src/theme-dracula.css` (Dracula + variante diurna suave).
- [x] Ambos derivan superficie/outline de `var(--ls-accent)` con `color-mix`.

#### 3. Integración desktop

- [x] `src/desktop.ts`: imports `theme-lino.css`/`theme-dracula.css` tras
      `material-aero.css` (orden de cascada garantizado).
- [x] `visualThemes` + `VisualTheme` junto a `AccentColor`; `setVisual`
      espeja el estado en los botones (mismo patrón que `setAccent`).
- [x] `data-visual` persistido en `localStorage["sinnotas-visual"]`
      (default `aero`) y aplicado desde `initThemeAndTypography`.
- N/A: `src/style.css` sin cambios de compat (los temas nuevos redefinen
      tokens `--md-*`/`--ma-*` que aero ya consume; el pequeño añadido
      `.visual-selector` va token-driven).

#### 4. UI de ajustes

- [x] `index.html`: fila "Estilo visual" con botones Aero/Lino/Dracula bajo
      "Tema Visual", `aria-pressed` y help text; wiring de `[data-visual-option]`.
- [x] `src/i18n.ts`: "Estilo visual" + help en EN y ZH (nombres de temas no
      se traducen, son marca).

#### 5. Verificación

- [x] `npm test` sin fallos nuevos (319✓ ×2 ejecuciones).
- [x] `npm run build` (tsc + vite) sin fallos.
- [x] Dev server + navegador (computados + capturas):
  - [x] Aero oscuro: intacto al volver desde otros temas (sheen, blur 26px,
        gradiente radial restaurados).
  - [x] Lino oscuro/claro: superficies opacas `--md-surface-container`,
        sin blur, sin sheen, acento tintando (azul→#61afef/#1d4ed8).
  - [x] Dracula oscuro: fondo #282a36+tinte de acento, estados
        #ffb86c/#8be9fd/#50fa7b; variante diurna `#dde2f2` verificada.
  - [x] Respuesta a acentos: violeta y verde cambian `--md-primary` y las
        superficies en aero, lino y dracula.
  - [x] Selector en Ajustes refleja tema activo; clic en vivo cambia tema
        y persiste en `sinnotas-visual`.
- [ ] Verificación manual del usuario (splash único en `tauri dev`, XP real,
      móvil sin cambios).
- [x] Actualizar tabla de archivos en `Checklist consolidado § D1`.

#### 6. Fix bordes suaves (sesión 2)

**Petición:** reducir border-radius; bordes suaves sin redondeos.

**Solución:** escala de radios por tokens en `material-aero.css`
(`--ma-radius-{xs,sm,md,lg,xl,2xl}` = 4/6/8/10/14/16px) que heredan Lino y
Dracula; mapeo completo de los valores duros:

- 999px (píldoras) → md(8): nav, btn-icon, tabs, tree, kanban badge? /
  badge-chips → sm(6): badges, atajos, progreso FSRS, scrollbars → xs(4);
  toast → md.
- Inputs/botones 12px → lg(10); tablas/kanban-card/imagen 16px → xl(14);
  columnas kanban 22px, paneles 20-28px → 2xl(16).
- Al final de `material-aero.css`: bloque "NORMALIZACIÓN DE RADIOS DUROS"
  que tapa las píldoras de `style.css` que computan en desktop
  (`#headbar-pomodoro-clock`, `#all-pages-sort` (!important), `.editor-tag`,
  badges, subtabs de ajustes, scrollbar thumbs) sin tocar la hoja base
  compartida con la APK móvil.
- Círculos puros intactos (swatches de acento, puntos de settings-tab, 50%).

- [x] Escala de tokens + remapeo completo de `material-aero.css`.
- [x] Normalización de lo que ganaba por especificidad/!important.
- [x] Escaneo 999px/50% por navegación en las 6 vistas: 0 restantes.
- [x] Diálogo de ajustes verificado tras restauración accidental del bloque
      de grid (fue remontado idéntico al original).
- [x] Tests + build verdes (ver abajo).

#### 7. Rediseño del reloj pomodoro (sesión 2)

**Petición del usuario:** la píldora con fondo acento al 50% (iteración previa)
no convencía; pidió que comparta la paleta del botón que colapsa la sidebar
(`.btn-icon`) y que SOLO en pausa cambie a rojo.

**Solución (`src/style.css`, reglas de `#headbar-pomodoro-clock`):**
- Reposo/activo idénticos al `btn-icon` de `#btn-toggle-sidebar`: fondo
  `none`, borde transparente, sin sombra, texto `var(--ls-text-muted)`;
  hover = `--ls-bg-secondary` + borde `--ls-border-subtle` + texto título
  (al usar los tokens `--ls-*` que aero remapea, la paleta sigue igual a la
  del botón en los 3 temas visuales sin doble definición).
- `.is-running` ya sin regla propia (idéntico al reposo).
- `.is-paused`: texto `#e06c75` puro + fondo
  `color-mix(in srgb, #e06c75 14%, transparent)` (patrón `.btn-icon.active`
  pero en rojo); sin gradientes ni glows.
- `border-radius: var(--ma-radius-md, 8px)` queda de la iteración anterior.
- Nota: al medir por computed style, hacerlo con `transition: none` — la
  transición de background-color devuelve el valor inicial en el frame 0.

- [x] Computed style: reposo/activo transparentes e idénticos; pausa roja.
- [x] Capturas de reposo y pausa correctas.
- [x] Tests + build verdes tras el cambio.

#### Estado

- [x] Bloque 0 — Fix splash triple
- [x] Bloque 1 — Preparación
- [x] Bloque 2 — CSS de temas
- [x] Bloque 3 — Integración desktop
- [x] Bloque 4 — UI de ajustes
- [x] Bloque 5 — Verificación final (pendiente: confirmación visual del usuario)
- [x] Bloque 6 — Bordes suaves (pendiente: confirmación visual del usuario)
- [x] Bloque 7 — Reloj pomodoro con paleta del botón de sidebar (pendiente: confirmación visual del usuario)

##### Notas de reanudación

- Si se corta a mitad de bloque: el trabajo queda en el repo; revisar
  `git status`/`git diff` para ver qué archivos del bloque ya están tocados.
- Punto de partida de los tokens nuevos: copiar la estructura de roles
  `--md-*` de `src/material-aero.css:11-99` para que la hoja base
  (`style.css`) siga compilando sin conocer los temas nuevos.
- No usar la palabra propietaria de la app de notas en nombres ni comentarios.


<a id="c2-fixes-de-ui"></a>

### C2. Fixes de UI (botones mapa/oclusión, tareas canvas, scroll flashcards)

**Estado:** Fases 1–3 y Fase 5 (regresiones 8.1–8.3) implementadas; tsc, tests y build ✅. Pendiente la prueba manual en la app Tauri. **Última actualización:** 2026-11-21
**Rama de trabajo:** `master` (se publica en `v0.5.2`)
**Documento principal:** `docs/SinNotas.md`

Este documento es el punto de reanudación si una sesión de trabajo se corta a
mitad.

---

#### 0. Reglas de reanudación después de una interrupción

> Leer esta sección **antes** de editar cualquier archivo.

1. Ejecutar `git status --short` y `git diff --stat`.
2. Revisar el diff completo de los archivos CSS antes de tocarlos:
   `git diff -- src/style.css`.
3. Si un archivo está sin seguimiento, leerlo entero con `sed`/`read` antes de
   escribir. No asumir que está completo.
4. Buscar restos de una ejecución cortada:
   `grep -RIn "TODO-UI-FIX\|FIXME-UI-FIX\|SINNOTAS-UI-FIX" src docs`.
5. Buscar errores de sintaxis antes de continuar: `npx tsc --noEmit` y `npm run build`.
6. **Nunca** ejecutar `git checkout --`, `git reset --hard`, `git clean -fd`,
   ni borrar un archivo a medias.
7. Si un bloque no compila, **repararlo**, no eliminarlo. Si hay que
   reemplazarlo, copiar primero el contenido sospechoso a la sección
   «Restos de interrupciones» de este documento.
8. Continuar por el primer ítem con estado `[~]` o `[p]`. Si no hay ninguno,
   por el primer `[ ]` de la fase actual.
9. Marcar `[~]` al empezar un ítem y `[x]` solo después de verificarlo.
10. Antes de cambiar de fase, actualizar el estado de este documento y
    preguntar al usuario.

##### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

##### Restos de interrupciones

- Ninguno.

---

#### 1. Decisiones cerradas

- Los cambios son **solo CSS** en `src/style.css` (no se toca HTML ni TS para esta fase).
- El cierre de "Oclusión de imagen" (`image-occlusion-header .btn-icon`) pasa a 40×40 px, igual que el encabezado de ajustes (`settings-dialog-header`). Los botones del encabezado de "Mapa conceptual" (`concept-map-tools .btn-icon`) se reducen un 30 % respecto de 40×40 px, es decir, 28×28 px.
- Los botones de la toolbar de oclusión (`font-option-btn`) pasan a `min-height: 40px` y `padding: 8px 12px`.
- El botón "Guardar oclusiones" (`image-occlusion-footer .btn-primary`) se separa del estilo píldora de `.btn-primary` y usa el estilo primario canónico de la app: `border-radius: 8px`, fondo degradado del acento, borde none, texto `--ls-accent-foreground`, sombra y estados hover/activo propios.

---

#### 2. Mapa de archivos

| Ruta | Responsabilidad |
| --- | --- |
| `src/style.css` | Estilos de UI de escritorio (botones mapa mental, oclusión, guardar oclusiones). |
| `index.html` | Estructura de los diálogos (sin cambios previstos en esta fase). |
| `src/desktop.ts` | Lógica de los diálogos (sin cambios previstos en esta fase). |
| `docs/SinNotas.md` | Resumen técnico (actualizar al terminar). |

---

#### 3. Fases

##### Fase 1 — Botones pequeños y estilo "Guardar oclusiones" (HECHO)

- [x] `.concept-map-tools .btn-icon`: 40×40 px → reducido un 30% a 28×28 px, fuente `calc(24px * var(--ls-font-scale, 1))` → `calc(17px * var(--ls-font-scale, 1))`, gap 6px.
- [x] `.image-occlusion-header .btn-icon`: 40×40 px (botón cerrar ×).
- [x] `.image-occlusion-toolbar .font-option-btn`: `min-height: 40px`, `padding: 8px 12px` (escala/rotar/align/distribuir).
- [x] `.image-occlusion-footer .btn-primary`: propio estilo `border-radius: 8px`, fondo degradado del acento, `box-shadow`, hover/activo.
- [x] `npx tsc --noEmit` ✅ y `npm run build` ✅.

##### Fase 2 — Tareas muy oscuras en modo canvas (HECHO)

- [x] `--ls-kanban-card-bg` aclarado de `#17191f` (casi idéntico al fondo) a `#1e242d` para dar contraste frente al fondo principal.
- [x] `--ls-kanban-card-shadow` suavizada de `rgba(0,0,0,0.24)` a `rgba(0,0,0,0.15)` y `rgba(0,0,0,0.08)` a `rgba(0,0,0,0.05)` para no oscurecer las cards.
- [x] `npx tsc --noEmit` ✅ y `npm run build` ✅.

##### Fase 3 — Flashcards: scroll con rueda del mouse dentro de la tarjeta (HECHO)

- [x] `.flashcard-content`: añadido `overflow-y: auto`, `overscroll-behavior: contain` y `scrollbar-gutter: stable` para que el wheel haga scroll dentro del box cuando el contenido exceda el alto.
- [x] `.flashcard-box`: añadido `max-height: 90vh` para activar el scroll interno en contenido largo.
- [x] Las flechas direccionales siguen funcionando (no se tocó).
- [x] `npx tsc --noEmit` ✅ y `npm run build` ✅.

##### Fase 4 — Cierre

- [x] Actualizar `docs/SinNotas.md` con estado final: nueva sección «Ajustes de interfaz (0.4.3)» y nota en «Verificación actual».
- [x] Añadir pruebas de regresión si aplica: no aplica; los cambios son solo CSS y la suite no carga hojas de estilo. Se verificó que las 465 pruebas en 45 archivos siguen pasando.
- [ ] Probar manualmente en app Tauri (no solo modo web): requiere una sesión con la app abierta; no se puede automatizar desde aquí.

#### 4. Contratos / selectores CSS afectados

- `.concept-map-tools .btn-icon` — zoom-in/zoom-out/reset/cerrar del mapa conceptual (28×28 px tras reducción del 30%).
- `.image-occlusion-header .btn-icon` — cierre del diálogo de oclusión (40×40 px).
- `.image-occlusion-toolbar .font-option-btn` — escala (–/+), rotar (↶/↷), alinear, distribuir (min-height 40px).
- `.image-occlusion-footer .btn-primary` — "Guardar oclusiones" (border-radius 8px, fondo degradado).
- `--ls-kanban-card-bg` / `--ls-kanban-card-shadow` — fondo y sombra de tarjetas de tarea en canvas.
- `.flashcard-box` — `max-height: 90vh` (activar scroll interno).
- `.flashcard-content` — `overflow-y: auto`, `overscroll-behavior: contain`, `scrollbar-gutter: stable` (scroll con rueda dentro de la tarjeta).

---

#### 5. Comandos de verificación

```bash
# TypeScript
npx tsc --noEmit

# Build
npm run build

# Pruebas del frontend
npm test

# Buscar restos de interrupciones
grep -RIn "TODO-UI-FIX\|FIXME-UI-FIX\|SINNOTAS-UI-FIX" src docs

# Diff de la fase
git diff --stat
git diff -- src/style.css
```

---

#### 6. Registro de sesiones

| Fecha | Fase | Cambios | Verificación |
| --- | --- | --- | --- |
| 2026-11-21 | 1 | Botones mapa mental y oclusión 40×40 px; "Guardar oclusiones" estilo primario canónico (border-radius 8px, fondo degradado, sombra) | `tsc`; `npm run build` |
| 2026-11-21 | 2–4 | Tareas canvas con `--ls-kanban-card-bg` aclarado; scroll interno de flashcards (`90vh`, `overflow-y`); `docs/SinNotas.md` actualizado y checklist cerrado | `npx tsc --noEmit`; `npm test` (465/45); `npm run build` |
| 2026-11-21 | 5 | Imágenes de repaso: prueba de carga de URL `asset:` + fallback a blob; selector «Mazo» de la hoja FSRS migrado a `CustomSelect`; rueda sin `overscroll-behavior: contain` en tarjeta/imagen | `npx tsc --noEmit`; `npm test` (465/45); `npm run build`; comprobado en navegador (modo repaso) |

---

#### 7. Pendientes inmediatos al reanudar

1. **Fase 5 (regresiones reportadas)**: ver la sección 8; continuar por el primer ítem `[~]` o `[ ]`.
2. Probar manualmente en la app Tauri (no solo modo web): botones del mapa conceptual, cierre/toolbar/guardar de oclusión, contraste de tareas en canvas y scroll con rueda dentro de una tarjeta de flashcards larga.
3. Si la prueba manual revela algo, anotarlo en «Registro de sesiones» y reabrir la fase correspondiente.
4. Si algo no compila, leer el primer error de `npx tsc --noEmit`.

---

#### 8. Fase 5 — Regresiones reportadas el 2026-11-21

> Reportadas por el usuario después de 0.4.16. No borrar esta sección si la
> sesión se corta: cada ítem debe quedar con su estado y las pistas exactas.

##### 8.1 Imágenes no cargan en modo repaso

- [?] Implementado; falta probarlo en la app Tauri real.
- Datos del caso: bóveda `~/.local/share/com.sinnotas.desktop`; nota
  `pages/Rust Core.md`; tarjeta de oclusión con
  `source: "assets/img_20261121_040405324.png"`; el archivo existe (PNG 643×506).
- Diferencia clave: `desktop.ts` (`resolveDisplayImageUrl`) comprueba que la URL
  `asset:` cargue de verdad y, si falla, cae a `read_image_data` + blob.
  `review-app.ts` (`resolveImageUrl`) solo caía al blob cuando fallaba el
  `invoke("resolve_image_path")`, no cuando la URL `asset:` no carga.
- Hecho: `review-app.ts` añade `imageUrlLoads()` (prueba con `new Image()`),
  comprueba la URL `asset:` antes de usarla y cae a `read_image_data` + blob si
  no carga. Si cambia `imageRequest`, devuelve la URL igualmente (solo evita
  cachearla) para no marcar la tarjeta como error.
- Verificación: `npx tsc --noEmit` ✅, `npm test` ✅ (465/45), `npm run build` ✅.
  Pendiente: abrir la tarjeta de `Rust Core` en la app Tauri.

##### 8.2 El selector «Mazo» de la hoja FSRS sigue saliendo nativo

- [x] En la hoja FSRS de repaso (`data-fsrs-deck-select`) el menú lo dibujaba el
  sistema operativo, no `CustomSelect`.
- Causa: `bindEvents` migraba `fsrsRecalcAction` y `fsrsAnchor`, pero **no**
  `fsrsDeckSelect`.
- Hecho: `migrateSelect(this.refs.fsrsDeckSelect)` en `bindEvents`;
  `renderFSRSDeckSelect()` ya llama a `syncCustomSelect()`.
- Verificado en navegador (modo repaso): el `<select>` nativo queda con
  `display: none` y aparecen 3 `.custom-select` (mazo, acción y ancla).

##### 8.3 La rueda del ratón no desplaza dentro de la flashcard

- [?] Implementado; falta probar la rueda en la app Tauri real.
- Causa encontrada: `overscroll-behavior: contain` en contenedores que casi
  nunca desbordan (`.flashcard-content`, `.flashcard-image-scroller` y
  `.mobile-image-viewport`). Al no poder desplazarse por dentro, la rueda
  tampoco se encadenaba al contenedor padre; por eso funcionaba fuera de la
  tarjeta y no dentro.
- Hecho: se retiró `overscroll-behavior: contain` de esos tres contenedores.
  Si el contenido desborda, la rueda sigue desplazando dentro; si no desborda,
  la rueda mueve la vista/repaso como antes.
- Verificación en navegador: con 80 párrafos inyectados, `.flashcard-content`
  mide `clientHeight 445` y `scrollHeight 1902` (desborda y es desplazable);
  con una tarjeta corta no hay desbordamiento interno y la rueda puede
  encadenar al padre.


## 2.D Bloque D — Mantenimiento y rendimiento

<a id="d1-mantenimiento-y-recuperacion"></a>

### D1. Mantenimiento y recuperación

**Base:** `master` en `ffd40a5` (`v0.3.5`) · **Actualizado:** 2026-10-29
**Ámbito:** aplicación de escritorio Tauri y APK Android de repaso.

> Este documento es una guía de trabajo, no una implementación. Cada tarea
> incluye diagnóstico, archivos y símbolos, pasos sugeridos, verificación,
> riesgos y notas para estudiar el código. Los números de línea son
> **orientativos** para `v0.3.5`: si cambian, busca por el símbolo indicado.
>
> Hay 23 entradas numeradas porque algunos puntos de la petición agrupan varias
> subtareas (por ejemplo, T2 incluye ordenación por cabeceras **y**
> redimensionado de columnas; T13 incluye escritorio **y** modo repaso).
>
> **Estado global (29 oct 2026):** 22 de 23 tareas cerradas. T7 queda en su
> fase 1 (panel de referencia de solo lectura); la edición real de dos paneles
> se documenta como fase 2. `npm run build`, `npm test` (319 pruebas),
> `cargo check` y `cargo test --lib` (51 pruebas) en verde. Los cambios se
> publican en `v0.3.6`. Queda la verificación manual en Tauri y APK con una
> bóveda real.

---

#### Aviso de seguridad abierto

##### `glib` — GHSA-wrw7-89jp-8q8g (alerta 13 de Dependabot)

- **Qué es:** código *unsound* en `glib::VariantStrIter` (binding Rust de GTK).
  Produce accesos a memoria inválida/crashes al iterar `Variant`; no es
  ejecución remota ni fuga de datos.
- **Estado (31 oct 2026):** **sin fix alcanzable**. El fix oficial está en
  `glib 0.20.0`, pero la pila GTK de Tauri 2 (`gtk 0.18` / `muda ^0.20` /
  `tao`) exige `glib ^0.18`; `cargo update -p glib` ya está al máximo
  compatible (0.18.5) y la última estable de Tauri (2.12.5) sigue arrastrando
  0.18.
- **Riesgo para SinNotas:** bajo. El backend no llama nunca a `VariantStrIter`
  ni a la API de `Variant`; el código vulnerable solo se alcanzaría desde el
  interior de GTK.
- **Tratamiento:** vigilado con Dependabot y cerrado como riesgo tolerado
  (`tolerable_risk`) con comentario. Criterio de cierre real: migrar cuando
  Tauri publique una 2.x con `glib 0.20` en su pila GTK o en la eventual
  migración a Tauri 3.
- **Actualizaciones hechas mientras tanto:** `tauri 2.12.4 → 2.12.5`
  (+ `tauri-build`/`tauri-codegen`/`tauri-macros` 2.7.4,
  `tauri-runtime-wry 2.12.3`, `ico 0.6.0`), máximo dentro del mismo semver.

---

#### 0. Cómo usar y cómo retomar este trabajo

##### 0.1 Estado de partida

Antes de tocar nada, comprueba que partes de un árbol limpio:

```bash
git status --short
git log --oneline -5
npm run build
npm test
```

El resultado esperado es: árbol limpio, build correcto y toda la suite en verde.
Si ya hay cambios, **no los descartes**: identifica de quién son y guárdalos.

> **Falso positivo conocido:** `src/editor/markdown.test.ts` incluye una prueba
> de ReDoS con un umbral de tiempo (`REDOS_THRESHOLD_MS = 500`). Al ejecutar
> toda la suite en paralelo puede superarlo por unos milisegundos y fallar sin
> que haya una regresión real. Repite el archivo aislado antes de investigar:
> `npm test -- src/editor/markdown.test.ts`. Si pasa aislado, es ruido de
> medición, no un bug del cambio que estés haciendo.

##### 0.2 Reglas de oro

1. **Una rama por tarea o por grupo pequeño.** Ejemplo:
   `fix/topbar-title`, `feat/all-pages-columns`, `fix/flashcards-focus`.
2. **Commits pequeños y verificables.** No mezcles un arreglo funcional con un
   refactor de estilo.
3. **Antes de cada commit:** `npm run build` y `npm test`. Si tocaste Rust:
   `cargo check --manifest-path src-tauri/Cargo.toml`.
4. **Todo texto nuevo de interfaz pasa por i18n.** Añade la cadena a `es`, `en`
   y `zh` en `src/i18n.ts` y úsala con `translate(...)` o `data-i18n`.
5. **Accesibilidad mínima:** `aria-label`, foco visible, navegación con teclado
   y `aria-sort`/`aria-pressed` cuando corresponda.
6. **Movimiento opcional:** cualquier animación nueva debe respetar
   `prefers-reduced-motion: reduce`.
7. **No toques artefactos generados:** `dist/`, `src-tauri/target/`,
   `node_modules/`, APK firmadas ni `.sinnotas/` de una bóveda real.
8. **No cambies el formato en disco sin migración.** Los `.md` son la fuente de
   verdad; cualquier propiedad nueva debe conservar compatibilidad.

##### 0.3 Recuperación tras una interrupción

```bash
# 1. Ver qué quedó a medias
git status
git diff --stat
git diff

# 2. Saber en qué rama estás y qué commits locales hay
git branch --show-current
git log --oneline --decorate -10

# 3. Guardar el trabajo sin perderlo
git stash push -u -m "wip: recuperación interrumpida"

# 4. Recuperarlo después
git stash list
git stash pop
```

Si el build está roto y no sabes qué archivo lo rompió:

```bash
npx tsc --noEmit          # errores de tipos, más rápido que el build completo
npm test -- src/views/all-pages.test.ts   # un test concreto
git diff -U3 -- src/desktop.ts             # revisar solo ese archivo
```

Si necesitas descartar **solo un archivo** (con cuidado, revisa antes el diff):

```bash
git checkout -- src/style.css
```

Si el problema está en una tarea concreta y ya hiciste commits:

```bash
git log --oneline -- <archivo>
git revert <commit>        # revierte sin reescribir historia
```

Si el problema es de estado local de la app (ajustes raros, tema, tamaños),
abre las herramientas de desarrollo y borra las claves indicadas en el
[Apéndice A](#apéndice-a--claves-de-localstorage).

##### 0.4 Verificación global

| Comprobación | Comando | Cuándo |
| --- | --- | --- |
| Tipos + bundle | `npm run build` | Antes de cada commit |
| Tests unitarios | `npm test` | Antes de cada commit |
| Un test concreto | `npm test -- src/views/flashcards-manager.test.ts` | Mientras iteras |
| Rust | `cargo check --manifest-path src-tauri/Cargo.toml` | Si tocas `src-tauri/` |
| Tests Rust | `cargo test --manifest-path src-tauri/Cargo.toml` | Si tocas lógica Rust |
| Benchmark de caché | `bash scripts/benchmark-cache.sh 5000` | Fase de rendimiento |
| App de escritorio | `npm run tauri dev` | Prueba manual |
| APK / modo repaso | `npm run dev` con `VITE_APP_MODE=flashcards` o build Android | Cambios en `src/mobile/` |

##### 0.5 Arquitectura mínima que hay que entender

SinNotas **no usa React ni Tailwind**. Es TypeScript + HTML + CSS nativos,
empaquetados con Vite, con backend Rust para archivos.

| Ruta | Responsabilidad |
| --- | --- |
| `index.html` | Estructura fija del escritorio: barra superior, vistas, ajustes y modales. |
| `src/desktop.ts` | Monolito principal: editor, vistas, ajustes, repaso, grafo, búsqueda. |
| `src/style.css` | Estilos del escritorio (tema, layout, tarjetas, tablas, focus). |
| `src/material-aero.css` | Tema visual Aero de escritorio (capa de superficie translúcida). |
| `src/theme-lino.css` / `src/theme-dracula.css` | Estilos visuales alternativos: redefinen los tokens de `--md-*`/`--ma-*` bajo `:root[data-visual="…"]` y neutralizan el vidrio/brillo de aero. La activación es `data-visual` en `<html>` (persistido en `sinnotas-visual`); el orden de imports en `desktop.ts` garantiza la cascada. |
| `src/views/` | Componentes de vista: flashcards, grafo, kanban, listas virtuales. |
| `src/store/` | Bóveda (`vault.ts`), búsqueda de contenido, progreso de repaso. |
| `src/editor/` | Modelo de bloques, Markdown, FSRS, oclusiones, historial. |
| `src/mobile/` | APK de repaso: `review-app.ts` y `mobile.css`. |
| `src-tauri/src/` | Comandos Rust, lectura/escritura de archivos, caché y watcher. |
| `docs/` | Documentación técnica y este checklist. |

**Patrones importantes del escritorio:**

- Hay **un solo DOM de editor** y estado global: `currentPage`, `cursorState`,
  `documentHistory`, `blocksContainer`, `pageTitleHeading`, etc.
- Las vistas se muestran/ocultan con `switchView(...)`; no hay router.
- Los ajustes se guardan en `localStorage` con claves `sinnotas-*`.
- El editor usa `contenteditable` y un árbol de bloques en memoria.
- La bóveda se carga desde Rust (`load_vault`) y se mantiene en `Vault`.
- El watcher de Rust emite `vault-cache-delta`; además hay una
  `synchronizeVaultFromDisk()` manual al recuperar el foco en flashcards.

##### 0.6 Matriz de tareas

| ID | Tarea | Grupo | Archivos clave | Riesgo | Fase |
| --- | --- | --- | --- | --- | --- |
| 1 | Truncar títulos largos en la barra superior | A | `index.html`, `style.css`, `desktop.ts` | Bajo | 1 |
| 2 | Ordenar por cabeceras y redimensionar columnas | B | `all-pages.ts`, `index.html`, `style.css`, `desktop.ts` | Medio | 1 |
| 3 | Fechas de actualización y creación en “Todas las páginas” | B | `lib.rs`, `metadata_cache.rs`, `all-pages.ts`, `desktop.ts` | Medio | 1 |
| 4 | Fuegos artificiales al calificar “Fácil” | C | `desktop.ts`, `style.css` | Bajo | 3 |
| 5 | Botón junto al mapa conceptual → notas conectadas en el grafo | D | `index.html`, `desktop.ts`, `graph-view.ts` | Medio | 4 |
| 6 | Mover “Grafo” de Ajustes a la vista de grafo | D | `index.html`, `desktop.ts`, `style.css` | Medio | 1 |
| 7 | Vista dividida para editar varias notas | A | `desktop.ts`, `index.html`, `style.css` | **Alto** | 5 |
| 8 | Mapa conceptual: detalle al pasar el ratón, no al hacer clic | D | `concept-map-view.ts`, `desktop.ts`, `index.html` | Medio | 4 |
| 9 | Prueba de rendimiento con miles de notas | I | `scripts/`, `src-tauri/examples/`, vistas | Medio | 0 y 6 |
| 10 | Acentos en escala de grises | G | `desktop.ts`, `style.css`, `index.html`, `mobile/review-app.ts` | Bajo | 1 |
| 11 | Elementos que ignoran el cambio de tipografía | A | `style.css`, `concept-map-view.ts`, `graph-view.ts`, `mobile.css` | Medio | 3 |
| 12 | Mover ancho de página e idioma al inicio de Apariencia | G | `index.html` | Bajo | 1 |
| 13 | Botones +/− de tamaño junto al tipo de tarjeta | C | `index.html`, `desktop.ts`, `mobile/review-app.ts`, `mobile.css` | Bajo | 3 |
| 14 | Sonidos al terminar Pomodoro y alternar enfoque/descanso | C | `desktop.ts` | Bajo | 1 |
| 15 | Resaltar la coincidencia tras elegir un resultado de contenido | E | `desktop.ts`, `style.css` | Medio | 4 |
| 16 | Mostrar el bullet padre como contexto sobre el anverso | C | `flashcards-manager.ts`, `types.ts`, `desktop.ts` | Medio | 3 |
| 17 | Scroll del modo focus de flashcards | C | `style.css` | Bajo | 3 |
| 18 | Bug visual de flashcards al volver de otra ventana | C | `desktop.ts`, `flashcard-loader.ts` | Medio | 2 |
| 19 | Mando genérico Xbox: RT cambia con stick derecho abajo | H | `gamepad.ts`, `gamepad.test.ts` | Bajo | 1 |
| 20 | Buscar dentro de la nota actual en el editor | F | `desktop.ts`, `index.html`, `style.css` | Alto | 5 |
| 21 | Referencias: mostrar también enlaces salientes | E | `vault.ts`, `desktop.ts`, `style.css` | Medio | 4 |
| 22 | Contraste del placeholder “Buscar o crear nota” | G | `style.css` | Bajo | 1 |
| 23 | Reconocer tarjetas programadas al terminar la sesión | C | `flashcards-manager.ts`, `desktop.ts` | Medio | 2 |

---

#### 1. Orden recomendado de implementación

No hace falta seguir el orden numérico. Este orden reduce el riesgo de romper
cosas y permite cerrar victorias rápidas antes de los refactors grandes.

##### Fase 0 — Línea base (antes de cambiar código)

- [x] Ejecutar `npm run build`, `npm test` y `cargo check`.
- [x] Ejecutar `bash scripts/benchmark-cache.sh 5000` y guardar el resultado
      como referencia (T9).
- [x] Crear una bóveda de prueba con muchas notas (ver T9).
- [ ] Etiquetar el punto de partida: `git tag baseline-0.3.5`.

> **Estado:** los tres primeros puntos se cumplieron al iniciar el trabajo;
> las cifras base están en [BENCHMARK-2026-10-29.md](BENCHMARK-2026-10-29.md). No se creó el tag
> porque no se pidieron commits y todos los cambios quedan en el árbol de
> trabajo.

##### Fase 1 — Arreglos rápidos y aislados (bajo riesgo)

T1, T22, T10, T12, T3, T2, T19, T14, T6, T11.

Son cambios contenidos, fáciles de revisar y de revertir. T3 y T2 son algo más
grandes, pero no tocan el núcleo del editor. T11 se cerró junto con esta fase:
los canvas y la APK ahora resuelven la familia tipográfica activa.

> **Estado (28 oct 2026; T11 cerrado el 29):** implementada. `npm run build`,
> `npm test` y `cargo test --lib` en verde. Verificado en el navegador:
> truncado del título, orden y anchos persistentes de "Todas las páginas",
> panel de ajustes del grafo, acento gris y orden del panel de Apariencia.
> T11 añade `activeFontFamily()` y `applyStoredFontFamily()` en
> `src/typography.ts`, usa la familia computada en los canvas del mapa
> conceptual y del grafo, y replica `data-font` en la APK. Queda pendiente la
> comprobación manual en escritorio Tauri con una bóveda real (fechas de
> archivo), en la APK (tipografía, acento gris y sonido) y con un mando físico
> (T19).

##### Fase 2 — Repaso y flashcards (riesgo medio)

T18, T23, T17, T13, T16, T4.

Primero estabiliza el comportamiento (T18, T23), luego la presentación
(T17, T13, T16) y por último el detalle visual (T4).

> **Estado (29 oct 2026):** implementada. T18 unifica `focus` y
> `visibilitychange` en una sola sincronización diferida y evita el estado
> "Escaneando" cuando ya hay una sesión visible. T23 reconstruye la cola al
> terminar, revisa cada 30 s y también al recuperar el foco. T17 añade scroll
> interno a `.flashcard-content` en modo focus. T13 incorpora `−` / `+` en
> escritorio y APK, sincronizados con Apariencia y limitados a 0.8–3 em. T16
> muestra el bullet padre inmediato en ambas superficies. T4 dibuja 26
> partículas en `#celebration-canvas` solo con "Fácil" y con movimiento
> reducido desactivado. `npm run build` y `npm test` (301 pruebas) en verde.
> Queda la comprobación manual en Tauri con una bóveda real y en la APK.

##### Fase 3 — Búsqueda, grafo y editor (riesgo medio-alto)

T15, T21, T8, T5, T20.

T20 (buscar dentro de la nota) conviene después de entender bien el editor y
el manejo de selección. T5 y T8 reutilizan APIs existentes del canvas.

> **Estado (29 oct 2026):** implementada. T15 añade `locateMatch()` con mapa de
> plegado, selección nativa y pulso del bloque; expande ancestros colapsados.
> T21 añade `collectOutgoingLinks()` con deduplicación, omisión de la propia
> nota, soporte de alias, código ignorado y enlaces rotos marcados. T8 mueve el
> detalle del mapa conceptual al hover con como máximo un cálculo por
> fotograma y una tolerancia de 350 ms para llegar al panel; el clic sigue
> fijando el detalle (útil en táctil). T5 añade `connectedPageTitles()` (BFS de
> 1 salto sobre enlaces entrantes y salientes) y un botón en la cabecera que
> abre el grafo filtrado, con chip para volver al grafo completo. T20 añade la
> barra Ctrl/Cmd+F, contador, navegación circular, expansión de ancestros,
> selección con la Highlight API y cierre con Escape devolviendo el foco.
> `npm run build` y la suite completa en verde.

##### Fase 4 — Vista dividida (riesgo alto)

T7. Es el único cambio que exige replantear el estado global del editor.
No lo empieces hasta que T1 y T11 estén cerrados, porque la vista dividida
reutiliza las mismas reglas de títulos y tipografía.

> **Estado (29 oct 2026):** fase 1 implementada. El botón “Dividir” abre un
> panel derecho de solo lectura con selector de nota, título truncado con
> tooltip, scroll propio y restauración tras reiniciar. Se controla con el flag
> `sinnotas-split-view` (`localStorage["sinnotas-split-view"] = "false"` lo
> oculta) y recuerda la nota en `sinnotas-split-reference-page`. La edición
> real de dos paneles (historial y guardado independientes, divisor arrastrable
> y atajos de panel) queda como fase 2; no se tocó `documentHistory`,
> `cursorState` ni el modelo de guardado para no comprometer la estabilidad.

##### Fase 5 — Rendimiento y cierre

T9 de nuevo, con la bóveda grande y todas las vistas. Compara con la línea base
y documenta los resultados.

> **Estado (29 oct 2026):** medición inicial completada. Se ejecutó la caché
> Rust con 5.000 y 20.000 notas, el benchmark JS de 1.000 × 100 bloques y una
> bóveda sintética de 5.000 notas × 30 bloques en el navegador (índice de
> búsqueda, escaneo de tarjetas y grafo). Resultados y comparación con
> `ffd40a5` en [BENCHMARK-2026-10-29.md](BENCHMARK-2026-10-29.md). Queda repetir la medición de
> todas las vistas con una bóveda real en Tauri y con la APK. Los dos checks
> genéricos que siguen abiertos son precisamente la validación en APK y el
> commit: no se hicieron commits por indicación expresa, así que el cambio
> queda en el árbol de trabajo.

---

#### 2. Tareas detalladas

---

#### Grupo A — Títulos, layout y tipografía

##### T1 — Truncar los títulos largos en la barra superior

- [x] Implementado
- [x] Probado con ventana estrecha
- [x] Probado con títulos CJK y con emojis
- [x] i18n / accesibilidad revisadas

**Prioridad:** alta · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** que un título de nota largo no empuje ni desborde los controles
de la barra superior; debe cortarse con puntos suspensivos y mostrar el título
completo en un tooltip.

**Dónde mirar**

- `index.html:220-245` — `<header class="headbar">`, `.headbar-left` y
  `#headbar-breadcrumb`.
- `src/style.css:1171-1191` — `.headbar`.
- `src/style.css:1308-1328` — `.headbar-left` y `.headbar-page-breadcrumb`.
- `src/style.css:1372-1377` — `.headbar-actions`.
- `src/desktop.ts:6860` — `headbarBreadcrumb.innerText = currentPage.title;`
  dentro de `renderEditor()`.

**Diagnóstico**

`.headbar` es `display:flex` con `justify-content:space-between`. A la izquierda,
`.headbar-left` también es flex, pero no tiene `min-width: 0`, así que su hijo
textual no puede encogerse por debajo del ancho intrínseco del título. El
breadcrumb no tiene `overflow: hidden` ni `text-overflow: ellipsis`. Resultado:
con un título largo, la zona izquierda crece y empuja o solapa `.headbar-actions`
(exportar, ventana, etc.).

**Pasos sugeridos**

1. En `.headbar-left`, añade:
   ```css
   .headbar-left {
     min-width: 0;
     flex: 1 1 auto;
     overflow: hidden;
   }
   ```
2. Da a los botones de navegación un tamaño fijo para que no se encojan:
   ```css
   .headbar-left > .btn-icon,
   .headbar-left > .nav-history {
     flex: 0 0 auto;
   }
   ```
3. Convierte el breadcrumb en un contenedor de bloque con elipsis. Si mantienes
   `display: flex`, `text-overflow` no funciona sobre el texto; lo más simple es
   `display: block` o envolver el título en un `<span>`:
   ```css
   .headbar-page-breadcrumb {
     min-width: 0;
     flex: 1 1 auto;
     overflow: hidden;
     white-space: nowrap;
     text-overflow: ellipsis;
     display: block;
   }
   ```
   Si en el futuro el breadcrumb lleva iconos o separadores, envuelve solo el
   texto en `.headbar-page-title` y aplica ahí la elipsis.
4. En `renderEditor()`, añade el título completo como tooltip:
   ```ts
   headbarBreadcrumb.innerText = currentPage.title;
   headbarBreadcrumb.title = currentPage.title;
   ```
5. Comprueba que `.headbar-actions` no se encoja:
   ```css
   .headbar-actions { flex: 0 0 auto; }
   ```
6. Si el diseño lo permite, una máscara de desvanecido queda más integrada que
   los puntos suspensivos:
   ```css
   .headbar-page-breadcrumb {
     mask-image: linear-gradient(90deg, #000 88%, transparent 100%);
   }
   ```
   No combines máscara y `text-overflow` sin probarlo: la máscara ya recorta.

**Verificación**

- Abre una nota con un título de 120+ caracteres y estrecha la ventana hasta
  ~700 px. Los botones de la derecha deben seguir visibles y clicables.
- Pasa el ratón por el título: debe aparecer el título completo.
- Prueba un título con emojis y otro con caracteres CJK (el corte no debe
  romper glifos).
- Comprueba la vista móvil/editor completo (`body.mobile-full-editor`) si el
  mismo headbar se reutiliza allí.

**Riesgos y rollback**

- Riesgo de ocultar el título por completo si `.headbar-left` se queda sin
  ancho. Deja un `min-width` razonable al breadcrumb (por ejemplo `80px`) o
  usa `flex: 1 1 auto` con `min-width: 0`.
- Rollback: `git checkout -- src/style.css src/desktop.ts`.

**Para estudiar**

- Diferencia entre `min-width: auto` (por defecto en flex items) y
  `min-width: 0`; es la causa clásica de desbordes en flexbox.
- `text-overflow: ellipsis` solo actúa en elementos de bloque con
  `overflow: hidden` y `white-space: nowrap`.

---

##### T7 — Vista dividida para editar varias notas

- [x] Diseño decidido (solo lectura vs. edición real) — fase 1: panel de referencia de solo lectura
- [x] Feature flag creado (`sinnotas-split-view`)
- [ ] Dos paneles con historial y guardado independientes — fase 2, pendiente
- [x] Títulos truncados como en Logseq
- [x] Restauración tras reiniciar (panel abierto y nota de referencia)

**Prioridad:** media · **Esfuerzo:** muy alto · **Riesgo:** **alto**

**Objetivo:** poder tener dos (o más) notas abiertas a la vez, editables, con
sus títulos truncados en la cabecera de cada panel, al estilo de Logseq.

**Dónde mirar**

- `index.html:760-804` — vista `#view-editor`, `.page-title-row`,
  `#page-title-heading`, `#blocks-container`, panel de referencias.
- `src/desktop.ts:6852` — `renderEditor()`.
- `src/desktop.ts:5192` — `renderBlockNode(node, parent, page)`.
- `src/desktop.ts:5649` — `renderBlocksTree()`.
- `src/desktop.ts:6887` — `openPage()` / `showEditorPage()`.
- `src/desktop.ts:2980-3040` — historial de navegación.
- `src/editor/tree-engine.ts` — operaciones sobre el árbol.
- `src/store/vault.ts` — guardado y versiones.

**Diagnóstico**

Hoy no existe ninguna noción de “panel”. Hay **un** `blocksContainer`, **un**
`pageTitleHeading`, **un** `cursorState`, **un** `documentHistory` y una variable
global `currentPage`. `renderEditor()` pinta siempre la página activa en ese DOM
único. Por tanto, una vista dividida real no es un cambio de CSS: exige
introducir un contexto de panel y parametrizar las funciones que hoy leen
globales.

**Estrategia recomendada: dos fases**

**Fase 1 — Panel de referencia de solo lectura (entrega rápida, riesgo bajo).**

1. Añade un botón “Dividir” en `.page-title-row` o en la barra superior.
2. Crea un segundo contenedor `#reference-pane` al lado del editor, con su
   propio título y cuerpo.
3. Renderiza la nota de referencia con `renderBlocksTree` en modo lectura:
   clona los bloques, elimina `contenteditable`, desactiva handles y eventos de
   edición.
4. Permite elegir la nota del panel derecho desde la barra lateral o desde un
   selector.
5. Trunca el título de cada panel con las reglas de T1.

Esto cubre “ver dos notas a la vez” sin tocar el modelo de edición. Si el
usuario necesita editar ambas, pasa a la fase 2.

**Fase 2 — Edición real con contextos de panel.**

1. Define un tipo explícito:
   ```ts
   interface EditorPane {
     id: string;
     pageId: string;
     rootEl: HTMLElement;       // contenedor de los bloques
     titleEl: HTMLElement;      // h1 editable
     cursor: CursorState | null;
     history: DocumentHistory;   // instancia por panel
     scrollTop: number;
   }
   ```
2. Sustituye las lecturas de `currentPage` dentro del render por
   `pane.pageId` → `vault.getPageById(...)`. Mantén `currentPage` como “panel
   activo” para no reescribir todo de golpe.
3. Parametriza `renderEditor(pane)`, `renderBlocksTree(pane)` y
   `renderBlockNode(node, parent, page, pane)`.
4. En los listeners, resuelve el panel con
   `event.currentTarget.closest<HTMLElement>("[data-pane-id]")`.
5. El historial de undo/redo debe ser **por panel**. `documentHistory` hoy es
   global; si se comparte, deshacer en un panel puede aplicar cambios al otro.
6. El guardado debe seguir siendo por página (`vault.savePage(page)`); evita
   guardar todo el árbol en cada pulsación.
7. La restauración tras reiniciar (`readLastNavigation`) debe guardar una lista
   de paneles y el panel activo, no solo `view` + `pageId`.
8. Añade un flag `sinnotas-split-view` para poder desactivar la función si algo
   falla en producción.

**UI y detalles tipo Logseq**

- Cabecera por panel con título truncado (`min-width: 0`, `overflow: hidden`,
  `text-overflow: ellipsis`, `white-space: nowrap`) y tooltip con el título
  completo.
- Divisor arrastrable con `pointerdown`/`pointermove`; guarda la proporción en
  `localStorage` (`sinnotas-split-ratio`). Usa `grid-template-columns` y
  `minmax(0, 1fr)` para evitar desbordes.
- Cada panel conserva su scroll y su nota al cambiar de vista.
- Botón “Cerrar panel” que, si queda uno solo, vuelve al modo normal.
- Atajos: `Ctrl/Cmd+\` para dividir, `Ctrl/Cmd+1/2` para enfocar panel.

**Verificación**

- Abre dos notas, edita ambas, deshaz en una y comprueba que la otra no cambia.
- Guarda, cambia de vista y vuelve: ambos paneles conservan nota, scroll y
  estado.
- Reinicia la app: se restauran los dos paneles y el activo.
- Cierra un panel: el otro ocupa todo el ancho y sigue editable.
- Comprueba que los atajos de flashcards no se disparan mientras se escribe en
  cualquiera de los dos paneles.

**Riesgos y rollback**

- **Riesgo alto de regresión** en guardado, undo/redo, snapshots y navegación.
  No lo mezcles con otras tareas.
- Si el refactor se descontrola, vuelve a la fase 1 (solo lectura) y deja la
  edición múltiple para una versión posterior.
- Rollback: mantén la funcionalidad detrás del flag y elimina el botón si es
  necesario. `git revert` del commit completo.

**Para estudiar**

- Cómo funciona `documentHistory` en `src/editor/` y dónde se “siembra” por
  página.
- Diferencias entre estado de vista y estado de documento.
- Patrón de “contexto de panel” para sustituir globales sin reescribir todo el
  monolito.

---

##### T11 — Elementos que ignoran el cambio de tipografía

- [x] Canvas del mapa conceptual usa la fuente configurada
- [x] Canvas del grafo usa la fuente configurada
- [x] APK móvil respeta la tipografía elegida
- [x] Monospace intencionales documentados

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** que al cambiar la tipografía en Apariencia, todos los textos
visibles cambien, salvo los que son intencionadamente monoespaciados (código,
badges FSRS, atajos).

**Dónde mirar**

- `src/style.css:246-263` — reglas `html[data-font="..."]` que definen
  `--ls-font-family`.
- `src/style.css:272-274` — `body { font-family: var(--ls-font-family); }`.
- `src/views/concept-map-view.ts:22-24` — constantes `ROOT_FONT`,
  `BRANCH_FONT`, `LEAF_FONT` con `Inter` fijo.
- `src/views/concept-map-view.ts:237` y `:369` — asignación de `ctx.font`.
- `src/views/graph-view.ts:908-910` — `ctx.font = ... Inter, sans-serif`.
- `src/mobile/mobile.css:27` — `--mobile-font: "Inter", ...`.
- `src/mobile/mobile.css:158` — `font-family: var(--mobile-font)`.
- `src/desktop.ts:1273-1280` — `applySystemFont()`.
- `src/desktop.ts:1304-1320` — `setFont()`.

**Diagnóstico**

El CSS del documento sí cambia con `data-font`, pero:

1. Los canvas no heredan CSS. `concept-map-view.ts` y `graph-view.ts` escriben
   `Inter` directamente en `ctx.font`.
2. La APK móvil define `--mobile-font` con `Inter` fijo y no lee
   `sinnotas-font` / `data-font`.
3. Hay usos legítimos de `monospace` (badges, código, atajos) que **no** deben
   cambiar; hay que distinguirlos de los accidentales.

**Pasos sugeridos**

1. Crea una función única que resuelva la familia activa:
   ```ts
   export function activeFontFamily(): string {
     const raw = getComputedStyle(document.documentElement)
       .getPropertyValue("--ls-font-family")
       .trim();
     return raw || "system-ui, sans-serif";
   }
   ```
   Colócala en un módulo compartido (por ejemplo `src/typography.ts` o
   `src/theme.ts`).
2. En `concept-map-view.ts`, sustituye las constantes por una función que
   reconstruya la fuente con el tamaño y el peso:
   ```ts
   private font(weight: number, size: number): string {
     return `${weight} ${size}px ${activeFontFamily()}`;
   }
   ```
   Llámala en el render y en el cálculo de anchos de texto (`measureText`), no
   solo al pintar: si cambia la fuente, cambian los anchos de los nodos.
3. Haz lo mismo en `graph-view.ts:908-910`. Las etiquetas del grafo se calculan
   con `ctx.measureText`; recalcula el layout o al menos el recorte de etiquetas
   al cambiar la fuente.
4. En móvil, elimina el valor fijo de `--mobile-font` y usa la misma variable:
   ```css
   :root { --mobile-font: var(--ls-font-family, "Inter", system-ui, sans-serif); }
   ```
   Asegúrate de que `applyLanguage`/`applyStoredFontSizes` en `review-app.ts`
   aplica `data-font` o la variable equivalente. La APK comparte
   `localStorage` con el escritorio en la misma instalación, pero no asumas que
   `data-font` existe: replica la lectura de `sinnotas-font` y
   `sinnotas-system-font`.
5. Revisa los `font-family: monospace` de `style.css` y deja un comentario en
   cada uno explicando por qué es intencional. Los candidatos legítimos:
   `code`, `pre`, `.fsrs-stats-badge`, atajos de teclado y bloques de código.
6. Añade una prueba unitaria para `activeFontFamily()` si la extraes como
   función pura (inyectando el valor de la variable).

**Verificación**

- Cambia entre Sans, Serif, Mono, Dyslexic y una fuente del sistema.
- Abre el mapa conceptual y el grafo: las etiquetas deben cambiar de forma
  visible y no solaparse ni salirse de los nodos.
- Abre la APK de repaso y comprueba que la tarjeta y la interfaz usan la misma
  familia.
- Comprueba que el código y los badges FSRS **siguen** en monoespaciada.

**Riesgos y rollback**

- Al cambiar la fuente, los textos pueden medir distinto y romper el layout del
  canvas. Recalcula posiciones o recorta etiquetas con `measureText`.
- Rollback: `git checkout -- src/views/concept-map-view.ts src/views/graph-view.ts src/mobile/mobile.css`.

**Para estudiar**

- `CanvasRenderingContext2D.font` no acepta variables CSS; hay que resolver el
  valor con `getComputedStyle`.
- `measureText` depende de la fuente y del tamaño; cambia el layout, no solo el
  dibujo.

> **Estado (29 oct 2026):** implementada. `activeFontFamily()` lee la familia
> computada del documento y los canvas reconstruyen `ctx.font` en cada medida y
> repintado. `refreshTypography()` recalcula anchos y layout del mapa
> conceptual; el grafo fuerza un repintado. `applyStoredFontFamily()` replica
> `sinnotas-font` / `sinnotas-system-font` en `data-font`, y `mobile.css`
> traduce `data-font` a `--mobile-font`. Los monospace intencionales quedaron
> documentados junto a las reglas de tipografía.

---

#### Grupo B — “Todas las páginas”

##### T2 — Ordenar por cabeceras y redimensionar columnas

- [x] Clic en cabecera ordena asc/desc
- [x] `aria-sort` correcto
- [x] Columnas redimensionables con el ratón
- [x] Anchos persistidos
- [x] Funciona en ventana estrecha

**Prioridad:** alta · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** ordenar la tabla haciendo clic en sus cabeceras (título, fechas y,
si se amplía el modelo, bloques/tipo), y poder arrastrar los bordes de las
columnas para ajustar su ancho.

**Dónde mirar**

- `index.html:1020-1058` — buscador, `<select id="all-pages-sort">` y tabla.
- `src/views/all-pages.ts` — `AllPagesSortKey`, `ALL_PAGES_SORT_VALUES`,
  `parseAllPagesSort`, `sortAllPages`.
- `src/desktop.ts:11267-11426` — constantes, `readAllPagesSort()`,
  `renderAllPagesView()`.
- `src/desktop.ts:3160-3204` — paginación y handler del `<select>`.
- `src/style.css:6506-6541` — estilos de la tabla.

**Diagnóstico**

La ordenación ya existe, pero solo mediante el `<select>`. La tabla se
reconstruye entera en cada `renderAllPagesView()` y no guarda estado de anchos.
No hay `aria-sort` ni cabeceras interactivas. Para redimensionar hacen falta
`<colgroup>` + `table-layout: fixed` o un `grid`; con `border-collapse` y
`width: auto` el navegador recalcula y el arrastre se siente inestable.

**Pasos sugeridos**

1. **Ordenación por cabecera.** Empieza por las columnas que ya soporta
   `sortAllPages`: Título (`title`), Última actualización (`updated`) y Creación
   (`created`). Añade a cada `<th>` un `data-sort-key` y un `<button>` interno
   para que sea accesible por teclado. Si quieres ordenar también por Bloques o
   Tipo, amplía primero `AllPagesSortKey` y `sortAllPages`; no dejes cabeceras
   clicables que no hagan nada.
2. Extrae una función pura para el ciclo de dirección:
   ```ts
   export function nextAllPagesSort(
     current: AllPagesSort,
     key: AllPagesSortKey
   ): AllPagesSort {
     const parsed = parseAllPagesSort(current);
     const direction = parsed.key === key && parsed.direction === "asc" ? "desc" : "asc";
     return `${key}-${direction}` as AllPagesSort;
   }
   ```
   Así puedes probarla sin DOM.
3. En `renderAllPagesView()`, sincroniza `aria-sort`:
   - `ascending` / `descending` en la columna activa.
   - `none` en las demás.
4. Persiste en `localStorage` con `ALL_PAGES_SORT_STORAGE_KEY`
   (`sinnotas-all-pages-sort`), reutilizando el handler actual.
5. **Redimensionado.** Añade un `<colgroup>` con un `<col>` por columna y
   `table-layout: fixed`. En cada `<th>` añade un asa:
   ```html
   <span class="col-resizer" data-col="title" role="separator"
         aria-orientation="vertical" tabindex="0"></span>
   ```
   Implementa `pointerdown` → captura de puntero, `pointermove` → ancho mínimo
   y máximo, `pointerup` → guardar. Permite también flechas izquierda/derecha
   cuando el asa tiene foco.
6. Guarda los anchos en `localStorage` (`sinnotas-all-pages-widths`) como
   `Record<string, number>`. Valida al leer: descarta valores no finitos y
   aplica mínimos por columna (Título 160 px, Bloques 80 px, Tipo 100 px,
   Fecha 140 px, Acciones 80 px).
7. En ventanas estrechas, decide entre scroll horizontal (`overflow-x: auto` en
   un contenedor) o un layout de tarjetas. No dejes que la tabla se comprima
   hasta ilegibilidad.
8. Ten en cuenta la paginación: cambiar el ancho no debe resetear
   `allPagesCurrentPage`.

**Verificación**

- Clic en cada cabecera: alterna asc/desc y reordena; `aria-sort` cambia.
- Recarga la app: se conservan orden y anchos.
- Arrastra el asa de Título al mínimo y al máximo; no se solapan columnas.
- Con 5.000 páginas, ordenar y paginar sigue siendo fluido (ver T9).
- Prueba con lector de pantalla o al menos con Tab/Enter en las cabeceras.

**Riesgos y rollback**

- `table-layout: fixed` puede cortar títulos largos; añade `text-overflow` en
  las celdas y tooltip.
- El arrastre con `pointer` events debe liberar la captura en `pointercancel`.
- Rollback: retira el `<colgroup>` y vuelve al `<select>`; el resto del código
  de ordenación no cambia.

**Para estudiar**

- `table-layout: auto` vs. `fixed` y cómo afecta a `width`/`colgroup`.
- Pointer Events y `setPointerCapture` para arrastres suaves.
- `aria-sort` solo se aplica a la cabecera activa; el resto debe ser `none`.

---

##### T3 — Fechas de actualización y creación en “Todas las páginas”

- [x] `updatedAt` llega desde Rust
- [x] Columna “Creación” visible
- [x] Fechas formateadas según idioma
- [x] Ordenación por ambas fechas correcta
- [x] Sin “Reciente” engañoso

**Prioridad:** alta · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** que la tabla muestre la fecha real de última modificación y la de
creación de cada nota, y que ordenar por ellas sea correcto.

**Dónde mirar**

- `src/types.ts:58-70` — `PageData.updatedAt?: string`.
- `src-tauri/src/lib.rs:723-735` — `struct PageData` (no tiene `updated_at`).
- `src-tauri/src/lib.rs:1707`, `:3130`, `:3387` — construcciones de `PageData`.
- `src-tauri/src/lib.rs:3398-3439` — `read_note_created_times`.
- `src-tauri/src/metadata_cache.rs:78-116` — `CachedNote` y `to_page_data`;
  `modified_ns` existe, pero no se expone.
- `src/desktop.ts:11381-11384` — `updatedCell.textContent = p.updatedAt || "Reciente";`
- `src/desktop.ts:1503-1530` — `flashcardPageCreatedMs()` y
  `fillFlashcardPagesCreatedTimes()`.
- `src/views/all-pages.ts:60-120` — `timestampOf`, `sortAllPages`.
- `src/store/vault.ts:873-935` — creación de páginas en modo web/demo.

**Diagnóstico**

`PageData` en TypeScript declara `updatedAt`, pero el `PageData` de Rust **no
serializa ese campo**. Al cargar una bóveda real, `p.updatedAt` es `undefined`
y la tabla pinta “Reciente” para todas las notas. Solo las páginas creadas en
memoria (modo web/demo o `createPage`) reciben un `updatedAt` local.

La creación sí se consulta, pero de forma perezosa y solo para flashcards o
cuando el usuario ordena por `created-*`. La tabla no tiene columna de creación.
Además, la fecha se muestra como cadena cruda, sin formato local.

**Diseño recomendado (sin dependencias nuevas en Rust)**

Rust ya tiene `SystemTime`; no hay `chrono` en `Cargo.toml`. Para no añadir una
dependencia, expón **milisegundos Unix** y formatea en TypeScript.

1. Añade a `PageData`:
   ```rust
   #[serde(default)]
   pub updated_at_ms: Option<i64>,
   #[serde(default)]
   pub created_at_ms: Option<i64>,
   ```
   Con `#[serde(rename_all = "camelCase")]` llegarán como `updatedAtMs` y
   `createdAtMs`.
2. Rellena ambos en las tres construcciones de `PageData`:
   - `parse_vault` (lectura completa).
   - La ruta incremental/SAF.
   - `parse_note_file` o equivalente.
   Usa `metadata.modified()` y `metadata.created()` con fallback a `modified()`.
   Centraliza la conversión en un helper:
   ```rust
   fn system_time_ms(time: std::io::Result<std::time::SystemTime>) -> Option<i64> {
       time.ok()
           .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
           .map(|d| d.as_millis() as i64)
   }
   ```
3. En `CachedNote`, añade `created_ns: i64` con `#[serde(default)]` y rellénalo
   al escanear. En `to_page_data`, deriva:
   ```rust
   updated_at_ms: Some(self.modified_ns / 1_000_000),
   created_at_ms: Some(self.created_ns / 1_000_000),
   ```
   Si `created_ns` es 0 (caché antigua o FS sin birthtime), usa
   `modified_ns` como aproximación y márcalo como tal en la UI.
4. Actualiza `src/types.ts`:
   ```ts
   updatedAtMs?: number;
   createdAtMs?: number;
   ```
   Conserva `updatedAt?: string` para el modo demo y como fallback.
5. En `all-pages.ts`, ordena con una función que prefiera los ms:
   ```ts
   function updatedMsOf(page: PageData): number | null {
     if (typeof page.updatedAtMs === "number") return page.updatedAtMs;
     return timestampOf(page.updatedAt);
   }
   ```
   Haz lo mismo para creación (`createdAtMs` o el `createdAtOf` inyectado).
6. En `renderAllPagesView()`, añade una columna “Creación” y formatea ambas.
   Ajusta también el `colSpan` de la fila vacía (hoy es `5`) y el
   `row.append(...)` para que el número de celdas coincida con las cabeceras:
   ```ts
   function formatPageDate(ms: number | null | undefined): string {
     if (!ms || !Number.isFinite(ms)) return "—";
     return new Intl.DateTimeFormat(currentLanguage(), {
       dateStyle: "medium",
       timeStyle: "short",
     }).format(new Date(ms));
   }
   ```
   Para diarios, la creación “real” es la fecha del diario (`journalDate`), no
   el birthtime del archivo; úsala como prioridad.
7. Para la creación de notas que no son diarios, mantén la carga perezosa de
   `read_note_created_times` si el coste de `metadata.created()` en Rust es
   alto. Si ya expones `createdAtMs` en el snapshot, elimina la llamada extra.
8. Revisa `vault.savePage()` para actualizar `page.updatedAtMs` en memoria tras
   guardar; si no, la tabla mostrará la fecha anterior hasta recargar.
9. Añade pruebas:
   - `sortAllPages` ordena por `updatedAtMs` y por `createdAtMs`.
   - Fechas desconocidas van al final en ambos sentidos (ya existe para
     `updatedAt` string; extiéndelo).
   - `formatPageDate` devuelve “—” para `undefined`/`NaN`.

**Verificación**

- Abre una bóveda real: ninguna fila debe decir “Reciente” salvo que el sistema
  de archivos no dé fecha.
- Modifica una nota, guarda y vuelve a “Todas las páginas”: la fecha cambia.
- Ordena por “Última actualización” y por “Creación” en ambos sentidos.
- Cambia el idioma de la interfaz: el formato de fecha cambia.
- Los diarios muestran como creación su fecha de diario.

**Riesgos y rollback**

- Cambiar el struct Rust obliga a reconstruir la app; verifica con
  `cargo check`.
- La caché de metadatos debe invalidarse si añades campos: sube la versión de
  caché o usa `#[serde(default)]` para que las entradas antiguas sigan siendo
  válidas.
- Rollback: mantén el render con fallback a `updatedAt` string; si algo falla,
  vuelve al estado anterior sin tocar los `.md`.

**Para estudiar**

- Cómo se serializa `PageData` con `serde(rename_all = "camelCase")`.
- Diferencia entre `created()` (birthtime) y `modified()`; en Linux/ext4 puede
  no haber birthtime y se usa `modified()` como aproximación.
- Por qué la creación se pedía aparte: `metadata.created()` puede ser costoso
  en bóvedas grandes.

---

#### Grupo C — Repaso y flashcards

##### T18 — Bug visual de flashcards al volver de otra ventana

- [x] Reproducido y causa identificada
- [x] No se reinicia la tarjeta activa
- [x] No se muestra “Escaneando” innecesariamente
- [x] Funciona al volver de otra app y de DevTools

**Prioridad:** alta · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** al cambiar a otra ventana/aplicación y volver, la sesión de
flashcards debe quedar exactamente como estaba: misma tarjeta, mismo estado de
respuesta y mismos controles.

**Dónde mirar**

- `src/desktop.ts:12688-12695` — listeners de `window focus` y
  `visibilitychange` que llaman a `synchronizeVaultFromDisk()`.
- `src/desktop.ts:12432-12496` — `synchronizeVaultFromDisk()`.
- `src/desktop.ts:10036-10063` — `ensureFlashcardScan()`.
- `src/desktop.ts:10119-10150` — `startFlashcardsSession()`.
- `src/desktop.ts:10467-10529` — `updateFlashcardUI()`.
- `src/views/flashcard-loader.ts` — caché por versión y `preserve`.
- `src/views/flashcards-manager.ts:709-745` — `setDetectedCards()` /
  `applyPageFilter()`.

**Diagnóstico probable**

Al recuperar el foco se ejecuta una recarga completa de la bóveda:

1. `synchronizeVaultFromDisk()` llama a `vault.replaceVault(...)`.
2. `flashcardLoader.invalidate()` borra la caché.
3. `startFlashcardsSession({ cardId, revealed })` vuelve a escanear.
4. Si la tarjeta activa ya no existe o el índice estaba al final,
   `getCurrentCard()` devuelve `null` y no se conserva nada; la sesión vuelve a
   la primera tarjeta.
5. Mientras dura el escaneo, `flashcardLoading = true` y `updateFlashcardUI()`
   retorna pronto; se pinta el estado “Escaneando…” y luego se reconstruye.

También puede influir que `document.visibilitychange` y `window.focus` se
disparen casi a la vez: la segunda llamada se descarta por
`vaultSyncInFlight`, pero la primera ya cambió el DOM.

**Pasos sugeridos**

1. **Reproduce con instrumentación.** Añade temporalmente logs en
   `synchronizeVaultFromDisk()` y en `startFlashcardsSession()` con
   `activeCardId`, `currentIndex`, `reviewCards.length` y `revealed`. Anota qué
   cambia al volver de otra ventana.
2. **Evita la recarga si no cambió nada.** `vaultContentSignature` ya compara
   contenido; si la firma es igual, no llames a `replaceVault` ni invalides la
   caché. Comprueba que la comparación incluye fechas/contenido relevante.
3. **Conserva el índice, no solo el id.**
   ```ts
   const activeCard = flashcardsManager.getCurrentCard();
   const activeIndex = flashcardsManager.getCurrentIndex();
   const activeCardId = activeCard?.id ?? null;
   ```
   Si `activeCardId` es `null` porque la sesión estaba completada, conserva
   `activeIndex` y el estado de “completado” para no reiniciar desde cero.
4. **No muestres el estado de carga si la caché sigue siendo válida.** En
   `ensureFlashcardScan`, solo pon `flashcardLoading = true` si realmente hay
   que escanear. Si `getCachedCards()` devuelve datos, actualiza la UI sin
   pasar por “Escaneando”.
5. **Ignora el foco de la propia app.** Si el evento `focus` se debe a un
   diálogo interno, a DevTools o a un modal, no sincronices. Puedes comprobar
   `document.hasFocus()` y si hay un overlay montado
   (`hasMountedModalExcept(...)`).
6. **Debounce.** Agrupa `focus` + `visibilitychange` en una sola llamada con un
   `setTimeout(…, 250)` y cancela la anterior.
7. **Preserva el DOM mientras se escanea.** Si hay que rescanear, no sustituyas
   el contenido de la tarjeta hasta tener la nueva tarjeta lista; mantén la
   anterior visible y desactiva solo los botones.
8. Añade una prueba de `FlashcardsManager` que preserve la tarjeta activa
   cuando el id existe y cuando la sesión está completada.

**Verificación**

- Abre flashcards, revela una tarjeta, cambia a otra app y vuelve: misma
  tarjeta y misma respuesta visible.
- Hazlo con la última tarjeta de la cola (índice al final).
- Hazlo con una nota modificada externamente mientras estabas fuera: debe
  recargar, pero sin saltar a la primera tarjeta.
- Abre DevTools, cambia de ventana y vuelve: no debe parpadear el estado de
  carga.
- Prueba en Android/APK si el mismo flujo existe.

**Riesgos y rollback**

- Suprimir la sincronización puede dejar datos obsoletos si otro dispositivo
  editó la bóveda. Mantén la sincronización cuando la firma cambie de verdad.
- Rollback: `git checkout -- src/desktop.ts` y volver al listener anterior.

**Para estudiar**

- Ciclo de vida de `window.focus` vs. `document.visibilitychange`.
- Cómo `flashcardLoader` cachea por `pages` + `version` y por qué
  `invalidate()` es costoso.
- Diferencia entre “tarjeta activa” y “índice activo”.

---

##### T23 — Reconocer tarjetas programadas al terminar la sesión

- [x] La cola se reconstruye al terminar
- [x] No hace falta clic derecho ni reiniciar
- [x] Las tarjetas “Otra vez” reaparecen cuando vencen
- [x] No se entra en bucle infinito

**Prioridad:** alta · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** cuando se termina la cola de repaso, la app debe volver a mirar
qué tarjetas están vencidas y continuar automáticamente si hay alguna, sin
obligar a reiniciar la sesión manualmente.

**Dónde mirar**

- `src/views/flashcards-manager.ts:735-745` — `applyPageFilter()` filtra por
  `isDue(card, new Date())`.
- `src/views/flashcards-manager.ts:866-869` — `restart()` solo hace
  `currentIndex = 0`.
- `src/desktop.ts:10476-10492` — rama “¡Completado!” y botón
  “Reiniciar Sesión”.
- `src/desktop.ts:10584-10641` — `applyFSRSRating()`.
- `src/views/flashcards-manager.ts:820-857` — `rate()` y cálculo de
  `dueDate`.

**Diagnóstico**

La cola `reviewCards` se construye al inicio del escaneo y solo incluye las
tarjetas que estaban vencidas en ese momento. Cuando terminas, `restart()` pone
`currentIndex = 0`, pero **no vuelve a filtrar**: la cola sigue vacía o contiene
las mismas tarjetas ya vistas. Por eso hace falta reiniciar la sesión desde
ajustes o con clic derecho.

Además, las tarjetas calificadas como “Otra vez” se programan a pocos minutos;
no deben aparecer inmediatamente, sino cuando su `dueDate` venza.

**Pasos sugeridos**

1. Añade al manager un método explícito:
   ```ts
   /** Reconstruye la cola con las tarjetas vencidas ahora. */
   public refreshDueQueue(order: FlashcardReviewOrder = "new-first"): number {
     this.applyPageFilter(order);
     return this.reviewCards.length;
   }
   ```
2. En la rama de “¡Completado!” de `updateFlashcardUI()`, en lugar de solo
   resetear el índice, llama a `flashcardsManager.refreshDueQueue(...)`.
   - Si devuelve `> 0`, llama a `updateFlashcardUI()` y continúa.
   - Si devuelve `0`, mantén el estado de completado.
3. Cuidado con el bucle: si una tarjeta sigue vencida y se vuelve a calificar
   mal, la cola podría no vaciarse nunca. Limita la reconstrucción automática a
   una vez por sesión o exige que haya pasado al menos un minuto desde el
   último repaso:
   ```ts
   let lastAutoRefreshAt = 0;
   if (Date.now() - lastAutoRefreshAt > 60_000) { ... }
   ```
4. Si el modo Aprendizaje está activo (`includeAllCards`), no filtres por
   vencimiento: `applyPageFilter` ya lo respeta. Reutilízalo.
5. Si el usuario calificó la última tarjeta y su `dueDate` es futura, el estado
   debe seguir siendo “Completado” y el botón “Reiniciar Sesión” debe seguir
   funcionando.
6. Añade una prueba:
   - Cola con una tarjeta vencida y otra futura; al terminar, `refreshDueQueue`
     devuelve 1 y la futura no aparece.
   - Cola sin vencidas: devuelve 0.
   - `restart()` sigue reiniciando la sesión completa cuando el usuario lo pide.

**Verificación**

- Repasa todas las tarjetas de una nota pequeña; al terminar, crea una tarjeta
  nueva vencida y comprueba que aparece sin reiniciar.
- Califica “Otra vez” en la última tarjeta: no debe reaparecer de inmediato;
  espera el intervalo y vuelve a entrar.
- Comprueba que el mensaje de completado no parpadea en bucle.

**Riesgos y rollback**

- Reconstruir la cola cambia los índices; no lo hagas mientras hay una
  calificación en vuelo (`vaultSyncInFlight`, `reviewHistoryActionInFlight`).
- Rollback: vuelve a `restart()` y al botón manual.

**Para estudiar**

- `isDue()` y cómo se calcula `dueDate` en `rate()`.
- Diferencia entre `allCards`, `cards` y `reviewCards`.
- Por qué el orden “mixed” no debe rebarajarse a mitad de carga.

---

##### T17 — Scroll del modo focus de flashcards

- [x] El contenido largo hace scroll
- [x] No se recorta la respuesta
- [x] Funciona con fuente grande (hasta 3em)
- [x] Ratón, rueda y teclado

**Prioridad:** media · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** que en modo focus una tarjeta con mucho contenido (o con el texto
muy grande) se pueda desplazar sin que la respuesta quede cortada.

**Dónde mirar**

- `src/style.css:5856-5910` — reglas `#app.flashcard-focus-mode`.
- `src/style.css:5562-5578` — `.flashcard-box`.
- `src/style.css:5912-5952` — `.flashcard-content` y `.card-question`.
- `src/style.css:5603-5613` — `.flashcard-review-layout`.

**Diagnóstico**

En focus mode:

```css
#app.flashcard-focus-mode #view-flashcards { overflow: hidden; }
#app.flashcard-focus-mode .flashcards-container { height: 100%; }
#app.flashcard-focus-mode .flashcard-box { height: 100%; }
.flashcard-content { flex: 1 1 auto; min-height: 0; justify-content: safe center; }
```

La cadena de alturas está bien para centrar contenido corto, pero no hay un
contenedor con `overflow-y: auto` para el contenido largo. `overflow: hidden`
en la vista recorta lo que sobresale. `justify-content: safe center` evita
recortar por arriba en algunos navegadores, pero no sustituye a un scroll real.

**Pasos sugeridos**

1. Añade scroll al contenido, no a la tarjeta entera, para que los botones FSRS
   sigan visibles:
   ```css
   #app.flashcard-focus-mode .flashcard-content {
     overflow-y: auto;
     overscroll-behavior: contain;
     scrollbar-gutter: stable;
     padding-right: 4px;
   }
   ```
2. Si el contenido es muy largo, permite que el bloque crezca y que el scroll
   sea de `.flashcard-box`:
   ```css
   #app.flashcard-focus-mode .flashcard-box {
     height: auto;
     max-height: 100%;
     overflow-y: auto;
   }
   ```
   Elige una de las dos estrategias y pruébala con la respuesta revelada.
3. Evita `height: 100%` en `.flashcard-content`; usa `flex: 1 1 auto` +
   `min-height: 0`.
4. Asegúrate de que `.card-actions-area` no se desplaza fuera de la vista:
   puede quedarse fija abajo con `position: sticky; bottom: 0;` y un fondo.
5. Con `--ls-flashcard-text-em: 3`, una tarjeta de 10 líneas debe poder
   recorrerse completa.

**Verificación**

- Activa focus mode con una tarjeta de respuesta larga (10+ líneas, listas y
  tabla).
- Sube el tamaño de tarjeta al máximo y comprueba que puedes llegar al final.
- Usa rueda, trackpad, Page Down y flechas.
- Comprueba que los botones “Otra vez / Difícil / Bien / Fácil” siguen visibles
  o accesibles.

**Riesgos y rollback**

- Si el scroll se aplica a `.flashcard-box`, la cabecera y los botones pueden
  desplazarse; usa `position: sticky` si es necesario.
- Rollback: elimina las reglas nuevas de `style.css`.

**Para estudiar**

- `min-height: 0` en flex children: sin él, un hijo flex no se encoge y el
  `overflow` no funciona.
- `justify-content: safe center` y su soporte.
- `scrollbar-gutter` para evitar saltos de layout.

---

##### T13 — Botones +/− de tamaño junto al tipo de tarjeta

- [x] Botones en escritorio junto a `#card-type-pill`
- [x] Botones en la APK de repaso
- [x] Sincronizados con Apariencia
- [x] Límites 0.8–3em y paso 0.1

**Prioridad:** media · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** poder ajustar el tamaño del texto de la tarjeta sin entrar en
Ajustes, con botones `−` / `+` junto al tipo de tarjeta, tanto en la vista de
repaso de escritorio como en el modo repaso móvil.

**Dónde mirar**

- `index.html:835-839` — `.flashcard-card-header` y `#card-type-pill`.
- `src/desktop.ts:1483-1501` — `applyFlashcardTextSize()`, input y valor.
- `src/desktop.ts:674-675` — `flashcardTextSizeInput` y
  `flashcardTextSizeValue`.
- `src/typography.ts:133-146` — definición `flashcardText`, clave
  `sinnotas-font-size-flashcard-question`, rango 0.8–3, paso 0.1.
- `src/mobile/review-app.ts:841-845` — control de tamaño de interfaz en la APK.
- `src/mobile/mobile.css` — estilos de la tarjeta móvil.

**Pasos sugeridos**

1. En `index.html`, añade al `.flashcard-card-header`:
   ```html
   <div class="flashcard-type-row">
     <span class="flashcard-type-pill" id="card-type-pill">BÁSICA</span>
     <div class="flashcard-size-controls" role="group" aria-label="Tamaño del texto de la tarjeta">
       <button class="btn-icon" id="btn-card-font-decrease" type="button" aria-label="Reducir texto de la tarjeta">−</button>
       <button class="btn-icon" id="btn-card-font-increase" type="button" aria-label="Aumentar texto de la tarjeta">+</button>
     </div>
   </div>
   ```
   Ajusta el `justify-content` de `.flashcard-card-header` para que el tipo
   quede a la izquierda y los controles a la derecha.
2. En `desktop.ts`, crea:
   ```ts
   function nudgeFlashcardTextSize(delta: number): void {
     const next = clampFontSize("flashcardText", currentFontSizes.flashcardText + delta);
     applyFlashcardTextSize(next);
     if (currentView === "flashcards") updateFlashcardUI();
   }
   ```
   Conecta `−` a `-0.1` y `+` a `+0.1`. Desactiva el botón cuando esté en el
   mínimo/máximo (`aria-disabled` + `disabled`).
3. Sincroniza el input de Apariencia: `applyFlashcardTextSize` ya actualiza
   `flashcardTextSizeInput` y `flashcardTextSizeValue`.
4. Añade un `title` con el valor actual (`1.2 em`) y un `aria-live="polite"` en
   un `<output>` si quieres anunciar el cambio.
5. En la APK (`review-app.ts`), añade los mismos botones en la cabecera de la
   tarjeta y reutiliza `writeFontSize("flashcardText", ...)` +
   `applyStoredFontSizes()`. Si la APK no tiene el control, al menos debe leer
   la clave compartida y aplicar `--ls-flashcard-text-em`.
6. Añade estilos compactos en `mobile.css` para que no roben espacio a la
   pregunta.

**Verificación**

- Pulsa `+` y `−` varias veces: el texto cambia de tamaño y el valor se guarda.
- Abre Apariencia: el control refleja el mismo valor.
- Recarga la app: se conserva.
- En los límites, los botones se desactivan y no se puede salir del rango.
- En la APK, el cambio se conserva y no rompe el layout.

**Riesgos y rollback**

- El texto grande puede desbordar la tarjeta; combínalo con T17.
- Rollback: elimina los botones y deja el control de Apariencia.

**Para estudiar**

- `clampFontSize`, `writeFontSize` y `applyFontSizes` en `typography.ts`.
- Cómo se comparte `localStorage` entre escritorio y APK.

---

##### T16 — Mostrar el bullet padre como contexto sobre el anverso

- [x] El padre inmediato se muestra solo si existe
- [x] Solo un nivel hacia arriba
- [x] No se muestra en tarjetas de imagen si no aplica
- [x] Se conserva al recargar/explorar

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** cuando una tarjeta cuelga de un bullet padre, mostrar el texto de
ese padre como contexto (“extra”) encima del anverso, sin convertirlo en parte
de la pregunta ni de la respuesta.

**Dónde mirar**

- `src/views/flashcards-manager.ts:586-700` — `scanPages()`; usa
  `getAllBlocksFlat(page.blocks)`, que pierde la jerarquía.
- `src/types.ts:98-115` — `Flashcard`.
- `src/desktop.ts:10495-10514` — `updateFlashcardUI()` pinta pregunta/respuesta.
- `index.html:844-850` — `.flashcard-content`, `#card-question`.
- `src/mobile/review-app.ts` — render de la tarjeta móvil.

**Diagnóstico**

`getAllBlocksFlat` devuelve una lista plana. Al detectar una tarjeta no se
guarda de qué bullet cuelga, así que la UI no puede mostrar el contexto. Hay que
recorrer el árbol conservando el padre inmediato.

**Pasos sugeridos**

1. Añade a `Flashcard`:
   ```ts
   /** Texto visible del bullet padre inmediato, si existe. */
   parentContent?: string;
   ```
2. Sustituye el recorrido plano de `scanPages()` por una función que visite el
   árbol con contexto:
   ```ts
   function walk(blocks: BlockNode[], parent: BlockNode | null): void {
     for (const block of blocks) {
       detect(block, parent);
       walk(block.children ?? [], block);
     }
   }
   ```
   No uses `getAllBlocksFlat` para esto; sigue usándolo donde solo interese el
   conjunto.
3. Al construir cada tarjeta, calcula:
   ```ts
   parentContent: parent
     ? stripCardTag(stripSystemProperties(parent.content)).trim()
     : undefined,
   ```
   Limpia Markdown y limita a ~200 caracteres para que no domine la tarjeta.
4. En `updateFlashcardUI()`, pinta un bloque antes de la pregunta:
   ```ts
   const parentEl = document.createElement("div");
   parentEl.className = "flashcard-parent-context";
   parentEl.textContent = card.parentContent ?? "";
   parentEl.hidden = !card.parentContent;
   ```
   Insértalo dentro de `.flashcard-content` o justo antes de
   `#card-question`. No lo metas en `card.question`, porque el buscador y el
   editor lo tratarían como parte de la tarjeta.
5. Si el padre es una imagen o no tiene texto visible, no muestres nada.
6. Si el padre está colapsado, igualmente muestra su texto: el contexto no
   depende del estado de la UI.
7. Replica el bloque en la APK (`review-app.ts`) si la tarjeta móvil tiene sitio.
8. Añade una prueba en `flashcards-manager.test.ts`: un árbol
   `padre → hijo con ::` debe producir `parentContent === "padre"`; un bullet
   raíz debe producir `undefined`; un nieto debe mostrar solo al padre, no al
   abuelo.

**Verificación**

- Crea una nota con `Padre` y dentro `Hijo :: Respuesta #card`.
- La tarjeta debe mostrar “Padre” como contexto y “Hijo” como pregunta.
- Una tarjeta en la raíz no debe mostrar contexto vacío.
- Un nieto debe mostrar solo el padre inmediato.
- El buscador del explorador no debe indexar el contexto como si fuera
  pregunta (o, si lo hace, que sea deliberado).

**Riesgos y rollback**

- El texto del padre puede contener la respuesta; si es así, podría convertir
  la tarjeta en un spoiler. Decide si ocultarlo hasta revelar o filtrarlo.
- Rollback: elimina `parentContent` y el bloque visual.

**Para estudiar**

- Cómo se recorre `BlockNode[]` y `children`.
- Diferencia entre `stripSystemProperties`, `stripCardTag` y
  `stripTaskStatus`.

---

##### T4 — Fuegos artificiales al calificar “Fácil”

- [x] Animación ligera y breve
- [x] Solo con “Fácil” (rating 4)
- [x] Respeta `prefers-reduced-motion`
- [x] No bloquea la siguiente tarjeta

**Prioridad:** baja · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** dar una recompensa visual breve al calificar “Fácil”, sin afectar
al rendimiento ni a la legibilidad.

**Dónde mirar**

- `src/desktop.ts:10577-10582` — listener de `.btn-fsrs`.
- `src/desktop.ts:10584-10641` — `applyFSRSRating()`.
- `index.html:867-870` — botón “Fácil” (`data-rating="4"`).
- `src/style.css` — animaciones existentes; busca `@keyframes` y
  `prefers-reduced-motion`.

**Pasos sugeridos**

1. Crea una capa dedicada, fuera del flujo del editor:
   ```html
   <canvas id="celebration-canvas" aria-hidden="true"></canvas>
   ```
   con `position: fixed; inset: 0; pointer-events: none; z-index: 9999;`.
2. Implementa `launchEasyCelebration(origin?: {x:number;y:number})`:
   - 20–30 partículas, 600–900 ms.
   - Colores derivados de `--ls-accent` y blanco.
   - `requestAnimationFrame` con `devicePixelRatio`.
   - Cancela el frame anterior si se lanza otra vez.
3. Llama solo cuando `rating === 4` y `persist === true` (no en modo
   Aprendizaje, para no premiar práctica sin efecto FSRS):
   ```ts
   if (result && rating === 4) launchEasyCelebration();
   ```
   Usa la posición del botón (`getBoundingClientRect`) como origen.
4. Respeta el movimiento reducido:
   ```ts
   const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   if (reduced) return; // o un destello estático de 150 ms
   ```
5. Limpia el canvas y el `requestAnimationFrame` al terminar.

**Verificación**

- Califica “Fácil”: aparece una animación breve y la siguiente tarjeta ya está
  lista.
- Califica “Bien” o “Difícil”: no aparece.
- Activa “reducir movimiento” en el sistema: no hay animación.
- Repite rápido varias veces: no se acumulan partículas ni se dispara el CPU.

**Riesgos y rollback**

- Un canvas a pantalla completa mal limpiado puede dejar residuos o capturar
  clics; usa `pointer-events: none` y limpia al final.
- Rollback: elimina la llamada en `applyFSRSRating()`.

**Para estudiar**

- `requestAnimationFrame`, `cancelAnimationFrame` y delta time.
- `matchMedia("(prefers-reduced-motion: reduce)")`.
- Cómo leer un color CSS con `getComputedStyle`.

---

##### T14 — Sonidos al terminar Pomodoro y alternar enfoque/descanso

- [x] Sonido al terminar enfoque
- [x] Sonido al terminar descanso
- [x] Alternancia correcta (incluido descanso largo)
- [x] No falla si el audio está bloqueado

**Prioridad:** baja · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** avisar con un sonido corto cuando termina un bloque de enfoque o
de descanso, manteniendo la alternancia actual.

**Dónde mirar**

- `src/desktop.ts:467-475` — estado del Pomodoro.
- `src/desktop.ts:9951-9983` — `startPomodoro()` y el `setInterval`.
- `src/desktop.ts:9985-10001` — toggles y reset.
- `index.html:876-886` — panel Pomodoro.
- `index.html:248-255` — mini Pomodoro de la barra superior.

**Diagnóstico**

La alternancia ya existe: al terminar enfoque pasa a descanso (corto o largo) y
al terminar descanso vuelve a enfoque. Falta el aviso sonoro. No hay assets de
audio ni Web Audio en el proyecto.

**Pasos sugeridos**

1. Sintetiza el sonido con Web Audio API para no añadir binarios. Crea **un
   solo** `AudioContext` (perezoso, tras la primera interacción del usuario) y
   reutilízalo:
   ```ts
   let pomodoroAudio: AudioContext | null = null;

   function pomodoroAudioContext(): AudioContext | null {
     try {
       if (!pomodoroAudio) {
         const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
         if (!AudioCtx) return null;
         pomodoroAudio = new AudioCtx();
       }
       if (pomodoroAudio.state === "suspended") void pomodoroAudio.resume();
       return pomodoroAudio;
     } catch {
       return null;
     }
   }

   function playChime(kind: "focus-end" | "break-end"): void {
     const ctx = pomodoroAudioContext();
     if (!ctx) return;
     const now = ctx.currentTime;
     const notes = kind === "focus-end" ? [660, 880] : [520, 392];
     notes.forEach((freq, i) => {
       const osc = ctx.createOscillator();
       const gain = ctx.createGain();
       osc.type = "sine";
       osc.frequency.value = freq;
       gain.gain.setValueAtTime(0.0001, now + i * 0.18);
       gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.18 + 0.02);
       gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
       osc.connect(gain).connect(ctx.destination);
       osc.start(now + i * 0.18);
       osc.stop(now + i * 0.18 + 0.4);
     });
   }
   ```
2. Llama a `playChime("focus-end")` al entrar en descanso y a
   `playChime("break-end")` al volver a enfoque, justo antes o después del
   `showToast`.
3. Si el navegador bloquea el audio hasta una interacción, crea el
   `AudioContext` al pulsar “Iniciar” y reutilízalo; no lo crees en cada
   pitido. No cierres el contexto entre avisos.
4. Añade un ajuste opcional “Sonido al terminar” con `localStorage`
   (`sinnotas-pomodoro-sound`) y un checkbox en Ajustes › Pomodoro. Por defecto
   activado.
5. Si quieres notificación del sistema, es un extra; no lo mezcles con el
   sonido.

**Verificación**

- Inicia un Pomodoro de 1 minuto (pon el ajuste a 1) y comprueba el pitido al
  terminar.
- Comprueba que pasa a descanso y que el segundo pitido suena al volver.
- Con 4 sesiones, comprueba el descanso largo.
- Silencia el sistema: no debe romperse nada.
- Recarga: el ajuste de sonido se conserva.

**Riesgos y rollback**

- Un `AudioContext` por pitido puede agotar recursos; reutilízalo.
- Rollback: elimina las llamadas y el ajuste.

**Para estudiar**

- Web Audio API: `OscillatorNode`, `GainNode`, `exponentialRampToValueAtTime`.
- Política de autoplay de WebView/navegador.
- Cómo `setInterval` deriva con el tiempo; para Pomodoro de precisión conviene
  calcular con `Date.now()` en lugar de restar 1 cada segundo.

---

#### Grupo D — Grafo y mapa conceptual

##### T5 — Botón junto al mapa conceptual → notas conectadas en el grafo

- [x] Botón visible junto a `#btn-concept-map`
- [x] Abre la vista de grafo enfocada en la nota actual
- [x] Muestra solo la vecindad (1 salto) o la destaca
- [x] Respeta los guards de física/visibilidad

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** desde una nota, abrir el grafo mostrando las notas conectadas a
ella (entrantes y salientes), reutilizando la instancia y los controles de
consumo del grafo.

**Dónde mirar**

- `index.html:763-781` — `.page-title-row` y `#btn-concept-map`.
- `src/desktop.ts:2743-2790` — mapa conceptual.
- `src/desktop.ts:10961-10977` — `renderGraphView()` y `graphView.updateData`.
- `src/desktop.ts:3100-3145` — `switchView`, `stopSimulation`.
- `src/views/graph-view.ts:171-178` — `shouldSimulate()`.
- `src/views/graph-view.ts:241-284` — `updateData()`.
- `src/views/graph-view.ts:222-228` — `selectNode()`.
- `src/views/graph-view.ts:144-164` — `visibilitychange` e
  `IntersectionObserver`.

**Diagnóstico**

El grafo ya sabe construir nodos y enlaces, seleccionar un nodo y detener la
simulación cuando no es visible. No hay un botón para “ver conectadas” ni un
filtro de vecindad. `updateData()` recibe todas las páginas y reconstruye el
grafo; si se le pasa un subconjunto, los enlaces a páginas fuera del subconjunto
se descartan (`pageTitles.has`), lo que es justo lo que queremos para una
vecindad.

**Pasos sugeridos**

1. Añade un botón junto a `#btn-concept-map`:
   ```html
   <button class="btn-icon page-title-action" id="btn-graph-neighborhood"
           type="button" title="Ver notas conectadas en el grafo"
           aria-label="Ver notas conectadas en el grafo">…</button>
   ```
2. Implementa un helper puro para calcular la vecindad:
   ```ts
   export function connectedPageTitles(
     pages: PageData[],
     origin: string,
     depth = 1
   ): Set<string> {
     // aristas: wikilinks salientes + entrantes
   }
   ```
   Incluye siempre `origin`. Para `depth = 1`, añade los títulos enlazados
   desde `origin` y los que enlazan a `origin`.
3. Al pulsar:
   - `switchView("graph")`.
   - `renderGraphView()` para asegurar que la instancia existe.
   - Filtra `vault.getPages()` con el conjunto y llama a
     `graphView.updateData(filtered)`.
   - `graphView.selectNode(origin)` y `graphView.resetView()` (o el método de
     encuadre que exista; el mapa conceptual usa `fit()`, pero el grafo no).
4. Añade un modo “vecindad” visible (por ejemplo, un chip “Solo conectadas” con
   una “×” para volver al grafo completo). Guarda el estado en memoria, no en
   `localStorage`, salvo que el usuario lo pida.
5. Reutiliza los guards existentes: no llames a `startSimulation()` a mano;
   deja que `shouldSimulate()` y el `IntersectionObserver` decidan. Si el grafo
   ya está simulando, `updateData()` debe reiniciar la simulación de forma
   controlada.
6. Si el usuario abre el grafo completo después, restaura
   `graphView.updateData(vault.getPages())`.
7. Añade una prueba unitaria de `connectedPageTitles` con enlaces entrantes,
   salientes, duplicados y páginas inexistentes.

**Verificación**

- Abre una nota con 3 enlaces salientes y 2 entrantes; pulsa el botón.
- El grafo debe mostrar la nota y sus vecinas, sin nodos huérfanos.
- Vuelve al grafo completo y comprueba que reaparecen todos.
- Cambia de pestaña/ventana: la simulación se detiene y no consume CPU.
- Con 5.000 notas, la vecindad debe ser rápida.

**Riesgos y rollback**

- Filtrar `updateData()` puede perder posiciones previas; es aceptable para una
  vista enfocada, pero guarda las posiciones si quieres volver sin saltos.
- Rollback: elimina el botón y el filtro; el grafo completo sigue igual.

**Para estudiar**

- Cómo `updateData()` construye `linksBySource` / `linksByTarget` y descarta
  enlaces a títulos inexistentes.
- `IntersectionObserver` y `document.visibilitychange` como guards de consumo.
- `selectNode()` y `resetView()`.

---

##### T6 — Mover “Grafo” de Ajustes a la vista de grafo

- [x] Pestaña “Grafo” eliminada de Ajustes
- [x] Controles accesibles desde la vista de grafo
- [x] Persistencia intacta
- [x] `sinnotas-settings-tab` migrado

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** quitar la pestaña “Grafo” de Configuración y poner esos controles
en la propia vista de grafo, para ajustar sin salir del contexto visual.

**Dónde mirar**

- `index.html:312-320` — pestañas de Ajustes.
- `index.html:464-573` — panel `data-settings-panel="graph"`.
- `index.html:940-968` — vista `#view-graph`.
- `src/desktop.ts:1428-1470` — `switchSettingsTab()`, `settingsTabNames`.
- `src/desktop.ts:10979-11265` — UI de ajustes del grafo,
  `graphSliderBindings`, `syncGraphSettingsUi()`, `updateGraphSettings()`.
- `src/views/graph-settings.ts` — `GRAPH_SETTINGS_STORAGE_KEY`,
  `loadGraphSettings`, `saveGraphSettings`, `normalizeGraphSettings`.

**Diagnóstico**

Los controles del grafo viven dentro del overlay de Ajustes, que se monta y
desmonta. `graphSettingsUiReady` y `syncGraphSettingsUi()` buscan los nodos por
id en el momento de usarlos, así que mover el markup no debería romper la
lógica, pero hay que asegurar que los listeners se registran una sola vez y que
el panel existe cuando se inicializa.

**Pasos sugeridos**

1. Mueve el bloque `<section data-settings-panel="graph">…</section>` a un
   panel lateral dentro de `#view-graph`, por ejemplo:
   ```html
   <aside class="graph-toolbar">
     <button id="btn-toggle-graph-settings" ...>Ajustes del grafo</button>
     <div id="graph-settings-panel" hidden>…</div>
   </aside>
   ```
2. Elimina el botón `data-settings-tab="graph"` de la cabecera de Ajustes.
3. En `desktop.ts`:
   - Quita `"graph"` de `settingsTabNames`.
   - Elimina la rama `if (tabName === "graph")` de `switchSettingsTab()`.
   - Añade un toggle para el panel lateral.
   - Asegura que `syncGraphSettingsUi()` se llama al abrir el panel y al
     entrar en la vista de grafo.
4. Migra `localStorage`:
   ```ts
   const stored = localStorage.getItem("sinnotas-settings-tab");
   if (stored === "graph") localStorage.setItem("sinnotas-settings-tab", "appearance");
   ```
5. Revisa `graphSettingsUiReady`: si el panel se crea de forma perezosa, la
   inicialización debe ejecutarse después de insertar el markup.
6. Los listeners delegados de `settingsOverlay` (`btn-add-graph-color-rule`,
   `btn-reset-graph-settings`) deben pasar al contenedor de la vista de grafo o
   a un handler común. Si se quedan en `settingsOverlay`, dejarán de funcionar.
7. Añade un botón “Restablecer” dentro del panel y conserva el actual.

**Verificación**

- Abre el grafo y ajusta repulsión, distancias, radios y colores: el cambio se
  ve en vivo.
- Recarga: los ajustes se conservan (`sinnotas-graph-settings`).
- Abre Ajustes: ya no hay pestaña “Grafo”.
- Si el usuario tenía `sinnotas-settings-tab = "graph"`, la app abre
  Apariencia sin fallar.
- Los grupos de color se añaden y eliminan correctamente.

**Riesgos y rollback**

- El overlay de Ajustes se desmonta; mover markup a una vista permanente cambia
  el ciclo de vida. Verifica que no queden listeners duplicados.
- Rollback: vuelve a mover la sección y restaura la pestaña.

**Para estudiar**

- `mountOverlay` / `unmountOverlay` y por qué los hijos del overlay se buscan
  en cada uso.
- `graphSettings` como objeto normalizado y guardado con debounce.

---

##### T8 — Mapa conceptual: detalle al pasar el ratón, no al hacer clic

- [x] El detalle aparece al pasar el ratón
- [x] Se oculta al salir del nodo
- [x] No parpadea ni recalcula en cada píxel
- [x] El clic ya no abre el popup (o hace otra acción)

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** que el panel de contenido completo de un nodo del mapa conceptual
aparezca al pasar el ratón por encima, en lugar de exigir un clic.

**Dónde mirar**

- `src/views/concept-map-view.ts:83-99` — estado del puntero y `hitTestNode`.
- `src/views/concept-map-view.ts:400-461` — `pointerdown`/`pointermove`/
  `pointerup`.
- `src/views/concept-map-view.ts:447-456` — `onNodeClick`.
- `src/desktop.ts:2747-2777` — `onNodeClick`, `showConceptMapNodeDetail()`,
  `closeConceptMap()`.
- `index.html:1147-1151` — `#concept-map-node-detail`.

**Diagnóstico**

`ConceptMapView` solo expone `onNodeClick`. El `pointermove` actual se usa para
hacer pan y no hace hit-test si no hay `pointerdown`. El panel de detalle se
muestra con `hidden = false` y se refresca con `requestAnimationFrame`.

**Pasos sugeridos**

1. Añade al view:
   ```ts
   public onNodeHover?: (nodeId: string | null, fullContent: string) => void;
   private hoveredId: string | null = null;
   ```
2. En `pointermove`, cuando **no** se está haciendo pan:
   - Calcula `worldX/worldY`.
   - `hitTestNode`.
   - Si el id cambió, actualiza `hoveredId`, cambia el cursor a `pointer` y
     llama a `onNodeHover`.
   - Limita la frecuencia con `requestAnimationFrame` o un umbral de 30–60 ms.
3. En `pointerleave` del canvas, llama a `onNodeHover(null, "")`.
4. En `desktop.ts`:
   ```ts
   conceptMapView.onNodeHover = (nodeId, content) => {
     if (!nodeId) { conceptMapNodeDetail.hidden = true; conceptMapView.refresh(); return; }
     showConceptMapNodeDetail(nodeId, content);
   };
   ```
5. Decide qué hace el clic ahora:
   - Mantener el clic para “fijar” el detalle (útil en táctil).
   - O hacer clic para abrir la nota del nodo. Si eliges esto, añade un botón
     “Abrir nota” en el panel de detalle en lugar de navegar directamente.
6. En táctil no hay hover: mantén el clic como fallback y detecta
   `pointerType === "touch"`.
7. Evita que el panel tape el nodo: posiciónalo en una esquina fija o junto al
   cursor con `transform: translate(...)` y límites de viewport.
8. Si el panel se oculta al mover el ratón hacia él, añade una zona de
   tolerancia o haz que el panel no reciba `pointerleave` del canvas.

**Verificación**

- Pasa el ratón por varios nodos: el panel cambia de contenido y se oculta al
  salir.
- Mueve el ratón rápido: no debe parpadear ni disparar decenas de renders.
- En una tablet/táctil, un toque sigue mostrando el detalle.
- El pan y el zoom siguen funcionando.
- El panel no tapa el nodo activo.

**Riesgos y rollback**

- `requestAnimationFrame` por cada `pointermove` puede ser costoso con muchos
  nodos; usa un umbral y compara el id antes de tocar el DOM.
- Rollback: vuelve a `onNodeClick` y elimina `onNodeHover`.

**Para estudiar**

- Diferencia entre `pointermove` con y sin captura.
- `hitTestNode` y coordenadas mundo/pantalla.
- Cómo `refresh()` redibuja el canvas.

---

#### Grupo E — Búsqueda y referencias

##### T15 — Resaltar la coincidencia tras elegir un resultado de contenido

- [x] La coincidencia queda resaltada al abrir la nota
- [x] Funciona con bloques colapsados
- [x] No modifica el contenido del `.md`
- [x] Fallback si el plegado cambió longitudes

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** al elegir un resultado de “En el contenido”, además de abrir la
nota y hacer scroll, resaltar el texto exacto que coincidió.

**Dónde mirar**

- `src/store/content-search.ts:3-15` — `ContentHit` (`index`, `matchLength`).
- `src/store/content-search.ts:187-205` — `buildSnippet`.
- `src/desktop.ts:12271-12282` — `openContentHit()`.
- `src/desktop.ts:12219-12264` — `renderContentResults()`.
- `src/desktop.ts:5649-5690` — `renderBlocksTree()` y foco del cursor.
- `src/style.css` — estilos de `mark` y `.block-item`.

**Diagnóstico**

`openContentHit()` abre la página, coloca `cursorState` y hace
`scrollIntoView`, pero no selecciona ni resalta nada. `ContentHit` tiene el
índice y la longitud en el texto **plegado** (`fold`), que puede no coincidir
con el texto original si el plegado cambió caracteres (por ejemplo, acentos o
mayúsculas). El propio código ya contempla esta limitación en
`renderContentResults()`.

**Pasos sugeridos**

1. Extrae una función pura de búsqueda de rango:
   ```ts
   export function locateMatch(
     text: string,
     query: string,
     foldedIndex: number,
     foldedLength: number
   ): { start: number; end: number } | null
   ```
   Si `fold(text).length === text.length`, usa el índice directo. Si no, busca
   la primera aparición de la consulta en el texto original con una
   comparación tolerante a mayúsculas/acentos; si no la encuentras, devuelve
   `null` y usa solo el pulso del bloque.
2. Tras `openPage(hit.page)` y el render, localiza el editor:
   ```ts
   const editor = document.querySelector<HTMLElement>(
     `.block-editor[data-id="${CSS.escape(hit.block.id)}"]`
   );
   ```
3. Crea un `Range` sobre el nodo de texto y selecciónalo:
   ```ts
   const range = document.createRange();
   range.setStart(textNode, start);
   range.setEnd(textNode, end);
   const selection = window.getSelection();
   selection?.removeAllRanges();
   selection?.addRange(range);
   ```
   Esto produce el resaltado nativo sin tocar el contenido del editor.
4. Si el bloque está dentro de un padre colapsado, expándelo antes de renderizar
   (`block.collapsed = false` en los ancestros) y vuelve a pintar. No hay helper
   hoy; recorre `findNodeLocation`/el árbol y limpia `collapsed`.
5. Añade un pulso visual al `.block-item`:
   ```css
   .block-item.search-hit-pulse { animation: search-hit 1.2s ease-out; }
   ```
   y retíralo con `animationend`.
6. Si usas CSS Custom Highlight API (`CSS.highlights`), puedes resaltar sin
   selección; comprueba soporte en el WebView de Tauri. La selección nativa es
   más compatible.
7. Limpia la selección al hacer clic en otro sitio o al cerrar la búsqueda.

**Verificación**

- Busca una palabra que solo aparezca en el contenido de una nota.
- Al pulsar el resultado, la nota se abre, hace scroll y la palabra queda
  seleccionada/resaltada.
- Prueba con mayúsculas/acentos (`pagina` → `Página`).
- Prueba un bloque dentro de un padre colapsado.
- Comprueba que el archivo `.md` no cambia.
- Prueba en una nota con tablas y código.

**Riesgos y rollback**

- Manipular la selección puede interferir con el cursor del editor; guarda y
  restaura `cursorState` si es necesario.
- El índice plegado puede no coincidir; usa el fallback y no resaltes texto
  incorrecto.
- Rollback: elimina el resaltado y deja solo el scroll.

**Para estudiar**

- `Range`, `Selection` y nodos de texto dentro de `contenteditable`.
- `fold()` y por qué cambia longitudes.
- `CSS.highlights` (Highlight API) y su soporte.

---

##### T21 — Referencias: mostrar también los enlaces salientes

- [x] Sección “Enlaces salientes”
- [x] Solo notas existentes o también enlaces rotos marcados
- [x] Navegación al hacer clic
- [x] Contador coherente

**Prioridad:** media · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** que el panel de referencias de una nota muestre tanto las notas
que enlazan a ella (retroenlaces) como las notas a las que ella enlaza.

**Dónde mirar**

- `index.html:791-801` — `#references-section`, `#ref-count`,
  `#backlinks-list`.
- `src/store/vault.ts:937-958` — `findBacklinksFor()` (solo entrantes).
- `src/desktop.ts:6797-6850` — `renderBacklinks()`.
- `src/views/graph-view.ts:32-45` — `collectWikiLinkTitles()`.
- `src/desktop.ts:3700-3790` — helpers de wikilinks.

**Diagnóstico**

`renderBacklinks()` pinta únicamente `vault.findBacklinksFor(currentPage.title)`.
No hay extracción de enlaces salientes ni una sección separada. El grafo ya
tiene un helper para recorrer wikilinks, pero está en `graph-view.ts` y no se
exporta.

**Pasos sugeridos**

1. Extrae un helper compartido, por ejemplo en `src/store/vault.ts` o
   `src/store/wikilinks.ts`:
   ```ts
   export interface WikiLinkRef {
     targetTitle: string;
     blockId: string;
     lineNumber: number;
     snippet: string;
   }
   export function collectOutgoingLinks(page: PageData): WikiLinkRef[]
   ```
   Reutiliza la regex de `collectWikiLinkTitles` y resuelve alias
   (`[[Destino|Alias]]` → `Destino`).
2. Añade `Vault.findOutgoingLinksFor(pageTitle: string)` o calcula en
   `renderBacklinks()` con el helper.
3. Modifica el markup para tener dos grupos:
   ```html
   <div class="references-group">
     <h4>Retroenlaces <span id="ref-count">0</span></h4>
     <div id="backlinks-list"></div>
   </div>
   <div class="references-group">
     <h4>Enlaces salientes <span id="outgoing-count">0</span></h4>
     <div id="outgoing-links-list"></div>
   </div>
   ```
   Si prefieres no duplicar contadores, usa un badge total y subtítulos.
4. Renderiza los salientes con el mismo estilo `.backlink-card`, pero con una
   flecha (`→`) o icono distinto para no confundirlos con entrantes.
5. Si el destino no existe, decide:
   - No mostrarlo (solo enlaces resolubles).
   - Mostrarlo como “enlace roto” con una clase `.is-broken` y permitir crearlo.
   Recomendado: mostrarlo como roto, porque es información útil.
6. Al hacer clic, `loadPage(targetTitle)` o `vault.createPage(...)` según la
   decisión anterior.
7. Actualiza `scheduleRenderBacklinks()` para que ambos grupos se recalculen
   tras editar.
8. Añade pruebas para el helper: alias, duplicados, enlaces en hijos, enlaces
   repetidos en el mismo bloque, enlaces a la propia nota.

**Verificación**

- Una nota A enlaza a B y B enlaza a C: A debe mostrar “Enlaces salientes: B”,
  B debe mostrar “Retroenlaces: A” y “Salientes: C”.
- Un enlace con alias muestra el destino real, no el alias.
- Un enlace a una nota inexistente aparece como roto o se omite según la
  decisión.
- El contador coincide con el número de tarjetas.
- Editar un enlace actualiza el panel sin recargar.

**Riesgos y rollback**

- La extracción de wikilinks debe ignorar código en línea y bloques de código
  para no generar falsos positivos. Revisa la regex existente.
- Rollback: deja solo los retroenlaces y elimina la segunda sección.

**Para estudiar**

- Regex de wikilinks y alias.
- Cómo `findBacklinksFor` recorre todas las páginas y calcula `line_number`.
- `scheduleRenderBacklinks()` y su token para evitar renders obsoletos.

---

#### Grupo F — Editor

##### T20 — Buscar dentro de la nota actual

- [x] `Ctrl/Cmd+F` abre la barra de búsqueda
- [x] Siguiente/anterior y contador
- [x] Resalta y hace scroll
- [x] `Escape` cierra y devuelve el foco
- [x] No secuestra el buscar del navegador fuera del editor

**Prioridad:** media · **Esfuerzo:** alto · **Riesgo:** alto

**Objetivo:** buscar texto dentro de la nota abierta sin usar el buscador global
ni el del navegador, con navegación entre coincidencias.

**Dónde mirar**

- `src/desktop.ts:12338-12420` — atajos globales (`Ctrl+K`, `Ctrl+B`, etc.).
- `src/desktop.ts:5649-5690` — `renderBlocksTree()`.
- `src/desktop.ts:5192-5270` — `renderBlockNode()`.
- `src/editor/tree-engine.ts` — recorrido y utilidades.
- `index.html:760-804` — vista del editor.
- `src/style.css` — estilos de barras de herramientas.

**Diagnóstico**

No existe ningún handler de `Ctrl+F` en el editor. El atajo global actual no lo
intercepta, así que el navegador/WebView abre su propio buscar. Para una
búsqueda con resaltado y navegación hace falta una barra propia y un modelo de
coincidencias.

**Pasos sugeridos**

1. Añade una barra oculta en `#view-editor`:
   ```html
   <div class="note-find-bar" id="note-find-bar" hidden>
     <input id="note-find-input" type="search" placeholder="Buscar en esta nota…" />
     <span id="note-find-count">0/0</span>
     <button id="note-find-prev" ...>↑</button>
     <button id="note-find-next" ...>↓</button>
     <button id="note-find-close" ...>✕</button>
   </div>
   ```
2. Extrae un helper puro:
   ```ts
   export interface NoteMatch {
     blockId: string;
     start: number;
     end: number;
   }
   export function findMatchesInBlocks(
     blocks: BlockNode[],
     query: string,
     caseSensitive = false
   ): NoteMatch[]
   ```
   Recorre el árbol en orden visible, usa el texto visible del bloque (ignora
   propiedades y tags de tarjeta si procede) y acumula índices.
3. En el handler global:
   ```ts
   if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && currentView === "editor") {
     e.preventDefault();
     openNoteFind();
     return;
   }
   ```
   No lo interceptes si hay un modal abierto o si el foco está en un input que
   no sea el editor.
4. `openNoteFind()` muestra la barra, enfoca el input y conserva la selección
   actual como consulta inicial si hay texto seleccionado.
5. Al escribir, calcula coincidencias con debounce (~120 ms) y actualiza el
   contador `actual/total`.
6. Navegación:
   - `Enter` / `↓`: siguiente; `Shift+Enter` / `↑`: anterior.
   - Si el bloque está colapsado, expande ancestros y vuelve a renderizar.
   - Haz scroll al `.block-item` y selecciona el rango con `Range`/`Selection`
     (misma técnica que T15).
7. `Escape` cierra la barra, limpia la selección y devuelve el foco al bloque
   donde estaba el cursor.
8. Resalta todas las coincidencias si puedes; si no, resalta solo la activa.
   Para “todas” usa `CSS.highlights` o una capa superpuesta; no inyectes
   `<mark>` en `contenteditable`, porque modificaría el contenido.
9. Añade estilos compactos y accesibles; en móvil, la barra debe caber.

**Verificación**

- `Ctrl+F` abre la barra; `Escape` la cierra.
- Busca una palabra repetida 10 veces: el contador y la navegación funcionan.
- Busca dentro de un bloque colapsado: se expande y se resalta.
- Busca con mayúsculas/acentos y decide el comportamiento (recomendado:
  insensible a mayúsculas y acentos, como el buscador global).
- Comprueba que `Ctrl+F` fuera del editor (por ejemplo en Ajustes) no se
  intercepta.
- Verifica que el `.md` no cambia.

**Riesgos y rollback**

- **Riesgo alto** de interferir con el cursor, el historial de undo y el
  renderizado del editor. No modifiques el contenido para resaltar.
- Si el editor se re-renderiza mientras buscas, las referencias a nodos de texto
  se pierden; vuelve a calcular las coincidencias tras cada render.
- Rollback: elimina el handler y la barra; el navegador recupera su `Ctrl+F`.

**Para estudiar**

- Cómo `renderBlocksTree()` conserva el foco y el cursor.
- `Range`/`Selection` en `contenteditable`.
- `CSS.highlights` como alternativa sin mutar el DOM.

---

#### Grupo G — Apariencia y ajustes

##### T10 — Acentos en escala de grises

- [x] Acento “Gris” en el selector
- [x] Variables de tema oscuro y claro
- [x] Muestra (swatch) correcta
- [x] Disponible en la APK

**Prioridad:** baja · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** añadir uno o dos acentos neutros (gris/pizarra) a la paleta, para
quien prefiere una interfaz sin color.

**Dónde mirar**

- `src/desktop.ts:453-465` — `accentColors` y `AccentColor`.
- `src/desktop.ts:1114-1115` — validación del acento guardado.
- `src/style.css:123-182` — acentos en tema oscuro.
- `src/style.css:184-243` — acentos en tema claro.
- `src/style.css:1730-1739` — swatches del selector.
- `index.html:329-341` — botones `.accent-option`.
- `src/mobile/review-app.ts:95` y alrededores — acentos en la APK.
- `src/mobile/mobile.css:43` — paleta compartida.

**Pasos sugeridos**

1. Añade `"gray"` (y opcionalmente `"slate"`) a `accentColors`.
2. En `style.css`, define el acento oscuro:
   ```css
   :root[data-accent="gray"] {
     --ls-accent: #9ca3af;
     --ls-accent-subtle: rgba(156, 163, 175, 0.16);
     --ls-text-link: #d1d5db;
     --ls-guideline-hover: rgba(156, 163, 175, 0.4);
   }
   ```
   y el claro:
   ```css
   :root[data-theme="light"][data-accent="gray"] {
     --ls-accent: #4b5563;
     --ls-accent-subtle: rgba(75, 85, 99, 0.1);
     --ls-text-link: #374151;
     --ls-guideline-hover: rgba(75, 85, 99, 0.4);
   }
   ```
3. Añade el swatch:
   ```css
   .accent-option[data-accent-option="gray"] { --swatch-color: #6b7280; }
   ```
4. Añade el botón en `index.html`:
   ```html
   <button class="accent-option" type="button" data-accent-option="gray"
           aria-label="Gris" title="Gris"></button>
   ```
5. Revisa `material-aero.css` (`:root[data-accent]` en las líneas 159-170)
   para asegurarte de que el nuevo acento hereda bien.
6. En la APK, si la lista de acentos está duplicada, añade el valor y su
   etiqueta. Si usa `accentColors` importado, no hace falta duplicar.
7. Añade una prueba de que `accentColors` contiene el nuevo valor y que
   `setAccent` lo acepta (si extraes la validación a una función pura).

**Verificación**

- Selecciona “Gris” en tema oscuro y claro: todos los acentos visuales cambian
  y el contraste de texto sigue siendo legible.
- Recarga: se conserva.
- Comprueba enlaces, botones, badges y el grafo.
- En la APK, el acento aparece y se guarda.

**Riesgos y rollback**

- Un gris demasiado claro puede fallar el contraste en tema claro; usa
  `#4b5563` o similar para texto/enlaces.
- Rollback: elimina el valor y las reglas.

**Para estudiar**

- Cómo `--ls-accent` se propaga por `color-mix` a toda la interfaz.
- Diferencia entre `--ls-accent` y `--ls-text-link` para contraste.

---

##### T12 — Mover ancho de página e idioma al inicio de Apariencia

- [x] “Ancho de página” al inicio del panel
- [x] “Idioma” al inicio del panel
- [x] Sin romper el orden en móvil
- [x] Persistencia intacta

**Prioridad:** baja · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** que los controles de ancho de página e idioma aparezcan al
principio de Apariencia, antes de tema, color, tipografía y tamaño.

**Dónde mirar**

- `index.html:322-403` — panel `data-settings-panel="appearance"`.
- `src/desktop.ts:1130-1147` — lectura de `sinnotas-page-width` y otros.
- `src/desktop.ts:1390-1430` — `applyFontSizes`, `resetFontSizes`.
- `src/i18n.ts` — `applyLanguage` y selectores por id.

**Pasos sugeridos**

1. Mueve los bloques de “Ancho de página” (`#page-width-slider`) e “Idioma de
   la interfaz” (`#interface-language`) justo después de la apertura de la
   sección, antes de “Tema Visual”.
2. Mantén los `id`, `for` y `aria-label`; la lógica los busca por id.
3. Si el panel usa CSS Grid/Flex con `order`, revisa que no haya reglas que
   fuercen el orden anterior.
4. Comprueba el panel en móvil: el ancho de página puede no aplicar, pero el
   idioma sí. No ocultes controles por accidente.
5. Si quieres, agrupa ambos en una sección “General” con un separador visual.

**Verificación**

- Abre Apariencia: los dos controles están arriba.
- Cambia el ancho: el editor responde y se guarda.
- Cambia el idioma: la interfaz se traduce y se conserva tras recargar.
- El resto de controles siguen funcionando.

**Riesgos y rollback**

- Bajo. Si algo se rompe, el orden DOM es la causa más probable.
- Rollback: `git checkout -- index.html`.

**Para estudiar**

- Cómo `applyLanguage` recorre `[data-i18n]` y traduce.
- Diferencia entre `value` del `<select>` y la preferencia `auto`.

---

##### T22 — Contraste del placeholder “Buscar o crear nota”

- [x] Placeholder legible en tema oscuro
- [x] Placeholder legible en tema claro
- [x] No afecta al texto escrito
- [x] Probado con zoom y fuente grande

**Prioridad:** baja · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** que el texto de ayuda del buscador lateral tenga suficiente
contraste, especialmente en tema oscuro.

**Dónde mirar**

- `index.html:130-140` — `#sidebar-search-input` y su `placeholder`.
- `src/style.css:713-736` — `.sidebar-search-input`, `:hover`, `:focus`.
- `src/style.css:60-120` — variables de color (`--ls-text-muted`, etc.).
- `src/material-aero.css:450-466` — overrides del buscador.

**Diagnóstico**

No hay una regla `::placeholder` para `.sidebar-search-input`; el navegador usa
su color por defecto, que en tema oscuro suele quedar por debajo del contraste
recomendado.

**Pasos sugeridos**

1. Añade:
   ```css
   .sidebar-search-input::placeholder {
     color: color-mix(in srgb, var(--ls-text-muted) 82%, var(--ls-text-primary));
     opacity: 1;
   }
   ```
   Ajusta el porcentaje hasta que el contraste sea ≥ 4.5:1 sobre
   `--ls-bg-secondary`.
2. Si `material-aero.css` define un color propio, replica la regla allí o
   elimina el override para que gane la regla base.
3. No cambies el color del texto introducido (`.sidebar-search-input` ya usa
   `--ls-text-title`).
4. Comprueba el estado `:focus`: el placeholder puede seguir visible; no lo
   ocultes salvo que el diseño lo pida.

**Verificación**

- Tema oscuro y claro: el placeholder se lee sin esfuerzo.
- Escribe: el texto real tiene más contraste que el placeholder.
- Aumenta el tamaño de interfaz al máximo: el placeholder no se corta.
- Pasa un comprobador de contraste si tienes uno.

**Riesgos y rollback**

- Bajo. Si el color queda demasiado claro, parece texto real; mantén la
  diferencia con `--ls-text-title`.
- Rollback: elimina la regla.

**Para estudiar**

- `::placeholder` y `opacity: 1` (Firefox aplica opacidad por defecto).
- `color-mix` para derivar un tono intermedio.

---

#### Grupo H — Mando

##### T19 — Mando genérico Xbox: RT cambia con stick derecho abajo

- [x] Ejes 2/3 ya no se interpretan como gatillos
- [x] RT/LT siguen funcionando como botones 6/7
- [x] Mandos no estándar siguen teniendo fallback
- [x] Prueba unitaria con un gamepad falso

**Prioridad:** media · **Esfuerzo:** bajo · **Riesgo:** bajo

**Objetivo:** evitar que mover el stick derecho hacia abajo/izquierda dispare
RT/LT en mandos genéricos, manteniendo el soporte de gatillos analógicos.

**Dónde mirar**

- `src/gamepad.ts:192-221` — `poll()`.
- `src/gamepad.ts:20-37` — etiquetas estándar.
- `src/gamepad.test.ts` — pruebas de presets.

**Diagnóstico**

En el estándar W3C:

- `axes[0]` = stick izquierdo X
- `axes[1]` = stick izquierdo Y
- `axes[2]` = stick derecho X
- `axes[3]` = stick derecho Y
- `buttons[6]` = LT, `buttons[7]` = RT

El código actual hace:

```ts
if (axes.length >= 3 && (axes[2] ?? 0) > 0.5) currentlyPressed.add(6); // LT
if (axes.length >= 4 && (axes[3] ?? 0) > 0.5) currentlyPressed.add(7); // RT
```

Por eso empujar el stick derecho a la derecha dispara LT y empujarlo hacia
abajo dispara RT. Coincide exactamente con el síntoma descrito.

**Pasos sugeridos**

1. Extrae la lectura a una función pura y testeable:
   ```ts
   export function pressedButtonIndexes(
     buttons: readonly GamepadButton[],
     axes: readonly number[],
     mapping: GamepadMappingType
   ): Set<number> {
     const pressed = new Set<number>();
     buttons.forEach((button, index) => {
       if (button.pressed || button.value > 0.1) pressed.add(index);
     });
     // Solo ejes >= 4 y nunca en mandos estándar.
     if (mapping !== "standard") {
       if ((axes[4] ?? 0) > 0.5) pressed.add(6);
       if ((axes[5] ?? 0) > 0.5) pressed.add(7);
     }
     return pressed;
   }
   ```
2. Elimina las comprobaciones de `axes[2]` y `axes[3]`. No son gatillos.
3. Si quieres soportar mandos que exponen el gatillo en reposo como `-1` y
   pulsado como `1`, usa `(axes[4] + 1) / 2 > 0.5`, pero solo para índices
   `>= 4` y `mapping !== "standard"`.
4. Ten en cuenta que algunos mandos genéricos reportan `mapping === ""`. En ese
   caso, el fallback de ejes 4/5 es razonable; si también falla, añade una
   pantalla de calibración (fuera del alcance mínimo).
5. Añade tests:
   - `axes[3] = 0.9` no produce ningún botón.
   - `axes[2] = 0.9` no produce ningún botón.
   - `buttons[7].value = 0.8` produce RT (7).
   - `mapping === ""`, `axes[5] = 0.9` produce RT (7).
   - `mapping === "standard"`, `axes[5] = 0.9` no produce RT si el botón no
     está pulsado.

**Verificación**

- Con un mando genérico/Xbox, mueve el stick derecho en todas las direcciones:
  no debe calificar ni revelar tarjetas.
- Pulsa RT/LT: deben funcionar según el mapeo configurado.
- Pulsa A/B/X/Y, D-pad, LB/RB: sin cambios.
- Prueba en la APK si soporta mandos.

**Riesgos y rollback**

- Algunos mandos no estándar podrían perder el fallback de gatillos; documenta
  que se pueden mapear como botones 6/7.
- Rollback: restaura las dos líneas de `axes[2]`/`axes[3]` (pero no lo hagas
  sin una alternativa).

**Para estudiar**

- Gamepad API: `mapping`, `buttons[].pressed`, `buttons[].value`, `axes[]`.
- Diferencia entre gatillos digitales y analógicos.
- Detección de flanco en `GamepadListener`.

---

#### Grupo I — Rendimiento

##### T9 — Prueba de rendimiento con miles de notas

- [x] Bóveda sintética de 5.000 y 20.000 notas
- [x] Medición de arranque, vistas, búsqueda y repaso
- [x] Comparación antes/después
- [x] Resultados documentados ([BENCHMARK-2026-10-29.md](BENCHMARK-2026-10-29.md))

**Prioridad:** alta (transversal) · **Esfuerzo:** medio · **Riesgo:** medio

**Objetivo:** disponer de una prueba repetible que detecte regresiones de
rendimiento con bóvedas grandes y sirva para priorizar optimizaciones.

**Dónde mirar**

- `scripts/benchmark-cache.sh` — benchmark Rust de caché con 5.000 notas.
- `src-tauri/examples/cache_benchmark.rs` — generador y medición.
- `scripts/bench.ts` — benchmark sintético de 1.000 notas × 100 bloques.
- `src/views/virtual-list.ts` — lista virtual del explorador.
- `src/views/flashcard-loader.ts` — escaneo por lotes.
- `src/store/content-search.ts` — índice de búsqueda.
- `src/views/graph-view.ts` — simulación y render.
- `src/desktop.ts:11286` — `renderAllPagesView()` (coste por fila).
- `src/desktop.ts:5649` — `renderBlocksTree()`.

**Qué medir**

| Escenario | Métrica | Objetivo orientativo |
| --- | --- | --- |
| Arranque con 5.000 notas | tiempo hasta editor usable | < 3 s (escritorio) |
| “Todas las páginas” | tiempo de render por página | < 100 ms |
| Búsqueda de contenido | primera respuesta | < 150 ms tras debounce |
| Explorador de flashcards | tiempo hasta lista | < 1 s con caché |
| Escaneo completo | tiempo y uso de CPU | por lotes, sin bloquear |
| Grafo | primer render y FPS | estable, sin congelar |
| Memoria | heap tras cargar | sin crecimiento sin límite |

**Pasos sugeridos**

1. **Genera la bóveda.** Usa el benchmark existente o crea un script:
   ```bash
   bash scripts/benchmark-cache.sh 5000
   ```
   Para una bóveda real de prueba, genera archivos `.md` con una estructura
   representativa: títulos únicos, 50–200 bloques, wikilinks, tags, tarjetas y
   algún diario.
2. **Añade marcas de rendimiento** en el código:
   ```ts
   performance.mark("all-pages:start");
   // ...
   performance.mark("all-pages:end");
   performance.measure("all-pages", "all-pages:start", "all-pages:end");
   ```
   No las dejes en producción si generan ruido; puedes activarlas con una flag
   (`localStorage.getItem("sinnotas-perf") === "1"`).
3. **Automatiza la medición del navegador.** Con Playwright/Puppeteer (si se
   añade como devDependency) o con un script manual en la consola:
   ```js
   const t0 = performance.now();
   // cambiar de vista
   const t1 = performance.now();
   console.log(t1 - t0);
   ```
   Como el proyecto no tiene Playwright, empieza con mediciones manuales
   reproducibles y documenta el método.
4. **Perfila.** Usa el profiler de DevTools/WebView para identificar:
   - `getAllBlocksFlat` repetido en `renderAllPagesView()` por cada fila.
   - Re-render completo de la tabla en cada tecla.
   - `updateData()` del grafo reconstruyendo todos los nodos.
   - `ContentSearchIndex.update()` recorriendo toda la bóveda.
5. **Optimiza por evidencia, no por intuición.** Candidatos:
   - Cachear el número de bloques por página en `PageData` o en la caché de
     metadatos, en lugar de recorrer el árbol al pintar cada fila.
   - Reutilizar filas del DOM o virtualizar la tabla (hoy solo se pagina).
   - Evitar `innerHTML = ""` y reconstruir solo las filas cambiadas.
   - En el grafo, no reconstruir si la versión del vault no cambió (ya se hace
     con `graphDataVersion`).
   - En búsqueda, indexar solo cuando cambie la versión (ya se hace) y limitar
     resultados.
6. **Mide después de cada fase** y compara con la línea base. Guarda los
   resultados en `docs/benchmark-<fecha>.md` (el script `bench.ts` ya genera un
   archivo así).
7. **Prueba también 20.000 notas** para ver si el crecimiento es lineal o hay
   un acantilado.

**Verificación**

- La app sigue siendo usable con 5.000 notas: cambiar de vista, buscar, abrir
  una nota y repasar.
- No hay bloqueos de UI superiores a ~100 ms en interacciones normales.
- El uso de memoria se estabiliza tras varias navegaciones.
- Los resultados quedan documentados y son comparables entre commits.

**Riesgos y rollback**

- Generar bóvedas enormes en el repo puede contaminar `git status`; usa una
  carpeta temporal fuera del repo (`/tmp/opencode/sinnotas-bench`) y no la
  commitees.
- No optimices prematuramente: mide primero.
- Rollback: las marcas de rendimiento y scripts son aditivos; se pueden
  eliminar sin afectar a la app.

**Para estudiar**

- `performance.mark/measure` y el panel Performance de DevTools.
- Complejidad de `renderAllPagesView()`: por cada página visible se recorre
  todo el árbol para contar bloques.
- Cómo `flashcard-loader` reparte el trabajo en lotes con `setTimeout` y
  `TARGET_CHUNK_MS`.
- Virtualización: `src/views/virtual-list.ts`.

---

#### 3. Apéndices

##### Apéndice A — Claves de `localStorage`

| Clave | Uso |
| --- | --- |
| `sinnotas-theme` | `light` / `dark`. |
| `sinnotas-accent` | Acento activo (`blue`, `green`, …, `gray`). |
| `sinnotas-font` | `sans`, `serif`, `mono`, `dyslexic`, `system`. |
| `sinnotas-system-font` | Familia del sistema elegida. |
| `sinnotas-font-size-*` | Tamaños por tipo (`ui`, `editor`, `pageTitle`, `h1`…). |
| `sinnotas-font-size-flashcard-question` | Tamaño `em` del texto de tarjeta. |
| `sinnotas-page-width` | Ancho de página en px. |
| `sinnotas-settings-tab` | Última pestaña de Ajustes. |
| `sinnotas-all-pages-sort` | Orden de “Todas las páginas”. |
| `sinnotas-all-pages-widths` | Anchos de columnas (nuevo, T2). |
| `sinnotas-flashcard-review-order` | Orden de repaso. |
| `sinnotas-flashcard-pages` | Filtro de notas para repaso. |
| `sinnotas-flashcard-key-*` | Teclas de calificación. |
| `sinnotas-pomodoro-*` | Duraciones, barra y sonido. |
| `sinnotas-graph-settings` | Ajustes del grafo. |
| `sinnotas-last-view` / `sinnotas-last-page-id` | Restauración de navegación. |
| `sinnotas-review-mode` | Forzar modo repaso. |
| `sinnotas-mobile-full-mode` | Forzar editor completo en APK. |
| `sinnotas-learning-mode` | Modo Aprendizaje. |
| `sinnotas-split-view` | Flag de vista dividida (nuevo, T7); `"false"` la desactiva. |
| `sinnotas-split-open` | Si el panel de referencia estaba abierto (T7 fase 1). |
| `sinnotas-split-reference-page` | Título de la nota del panel de referencia (T7 fase 1). |

Para reiniciar la apariencia sin borrar datos:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith("sinnotas-"))
  .forEach((key) => localStorage.removeItem(key));
location.reload();
```

##### Apéndice B — Variables CSS útiles

| Variable | Uso |
| --- | --- |
| `--ls-accent` | Color de acento principal. |
| `--ls-accent-subtle` | Fondo sutil del acento. |
| `--ls-text-link` | Color de enlaces. |
| `--ls-text-title` | Texto de títulos. |
| `--ls-text-primary` | Texto principal. |
| `--ls-text-muted` | Texto secundario. |
| `--ls-bg-primary` / `secondary` / `tertiary` | Fondos. |
| `--ls-border-color` / `--ls-border-subtle` | Bordes. |
| `--ls-font-family` | Familia tipográfica activa. |
| `--ls-font-scale` | Escala global de interfaz. |
| `--ls-font-size-ui` | Tamaño base de interfaz. |
| `--ls-flashcard-text-em` | Multiplicador del texto de tarjeta. |
| `--ls-page-width` | Ancho de página. |
| `--ls-headbar-height` | Altura de la barra superior. |

##### Apéndice C — Tests existentes relevantes

| Área | Archivo |
| --- | --- |
| Todas las páginas | `src/views/all-pages.test.ts` |
| Flashcards (detección, cola, FSRS) | `src/views/flashcards-manager.test.ts` |
| Motor FSRS-7 y vectores dorados | `src/editor/fsrs.test.ts` |
| Ajustes y normalización de FSRS | `src/editor/fsrs-settings.test.ts` |
| Carga por lotes | `src/views/flashcard-loader.test.ts` |
| Recálculo masivo por lotes | `src/views/flashcard-maintenance.test.ts` |
| Grafo | `src/views/graph-physics.test.ts`, `graph-settings.test.ts`, `graph-labels.test.ts` |
| Tipografía | `src/typography.test.ts` |
| Mando | `src/gamepad.test.ts` |
| Búsqueda de contenido | `src/store/content-search.test.ts` |
| Progreso de repaso | `src/store/review-progress.test.ts` |
| Árbol de bloques | `src/editor/tree-engine.test.ts` |
| Markdown | `src/editor/markdown.test.ts`, `markdown-table.test.ts` |
| Kanban / listas | `src/views/kanban-view.test.ts`, `virtual-list.test.ts` |

##### Apéndice D — Definition of Done

Una tarea se considera cerrada cuando:

- [x] El comportamiento solicitado funciona en escritorio.
- [ ] Si aplica, funciona en la APK/modo repaso.
- [x] Hay tests nuevos o actualizados para la lógica pura.
- [x] `npm run build` y `npm test` pasan.
- [x] Si se tocó Rust, `cargo check` y `cargo test` pasan.
- [x] Las cadenas nuevas están en `es`, `en` y `zh`.
- [x] Los controles nuevos son accesibles por teclado y tienen `aria-label`.
- [x] Las animaciones respetan `prefers-reduced-motion`.
- [x] No se rompe el guardado ni el formato `.md`.
- [x] Se probó con una bóveda grande si la tarea afecta a listas, búsqueda o
      repaso.
- [ ] El commit explica qué se cambió y por qué.

##### Apéndice E — Mensajes de commit sugeridos

```text
fix(topbar): truncar el título de la nota con elipsis

fix(all-pages): ordenar por cabeceras y persistir anchos

fix(all-pages): mostrar fechas reales de creación y modificación

feat(review): celebrar la calificación Fácil con una animación breve

feat(graph): abrir la vecindad de la nota desde el mapa conceptual

refactor(settings): mover los ajustes del grafo a la vista de grafo

feat(review): mostrar el bullet padre como contexto de la tarjeta

fix(review): reconstruir la cola de vencidas al terminar la sesión

fix(review): conservar la tarjeta activa al recuperar el foco

fix(gamepad): dejar de mapear el stick derecho a LT/RT

feat(editor): buscar dentro de la nota actual

feat(references): mostrar enlaces salientes además de retroenlaces

perf(all-pages): evitar recorrer el árbol para contar bloques
```

---

#### 4. Notas finales

- **No empieces por T7.** Es el cambio con más probabilidad de romper el
  editor y el que más tiempo requiere. Cierra antes las tareas de una o dos
  horas.
- **T3 y T18 son los bugs con más impacto percibido.** Si solo puedes hacer
  dos cosas, haz esas.
- **T9 no es una tarea única:** es una práctica que debe repetirse al final de
  cada fase. Guarda los resultados para poder comparar.
- **Cuando dudes, lee el test más cercano.** `flashcards-manager.test.ts` y
  `all-pages.test.ts` documentan muchas decisiones de diseño que no están en
  los comentarios.
- **Mantén este checklist actualizado.** Marca las casillas y añade una línea
  con la fecha y el commit cuando cierres una tarea.


<a id="d2-rendimiento-a-escala-14k-notas--200-bullets"></a>

### D2. Rendimiento a escala (14k notas × 200 bullets)

Última actualización: 2026-10-31 (reanudación tras 2.º corte, revisión de
integridad de la FASE 4-B).
Estado base tras la reanudación: temas/contraste/zoom + FASES 1-3 de perf
(**COMMITTED**) y FASE 4-A (**COMMITTED** en `422238c`).
FASE 4-B: lado Rust completo en el árbol (sin commit al retomar); lado front
(sin empezar).
Si se interrumpe el trabajo a mitad de una fase, esta guía dice qué está completo,
qué queda a medias (y qué síntomas de código roto esperar) y cómo continuar.

> **Bitácora de reanudación (2026-10-31):** el corte dejó la FASE 1 a medias
> (últimos 3 errores de `tsc`: `graphEpochs` sin usar en `desktop.ts`, campo
> `entries` muerto en `content-search.ts` y nabla de null en `kanban-view.ts`).
> Se cerró el código (grafo incremental vía epochs), se validó con
> `npx tsc --noEmit` (0 errores) y `npm test` (33/319), y se hizo COMMIT único
> (temas + FASE 1 juntos, porque ambos sets comparten `desktop.ts`).
> Verificación manual F1: PENDIENTE (ver FASE 1).
>
> **Bitácora FASE 2 (2026-10-31):** completada íntegra: diario de deltas
> (2.1/2.2), `vault_sync_state` + `synchronizeVaultFromDisk` sin
> `JSON.stringify` (2.3). `cargo test` 54 en verde (3 nuevos del journal),
> `cargo clippy` sin avisos, `npx tsc --noEmit` y `npm test` 33/319. 2.4
> (medición release) queda manual. Véase la FASE 2 para decisiones de diseño.
>
> **Bitácora FASE 3 (2026-10-31):** retroenlaces vía `find_backlinks` de Rust
> (con fallback JS solo para modo web); autocompletado `[[` con índice
> pre-ordenado regenerado por cambios estructurales; búsqueda de contenido
> resuelta con el índice incremental del front (decisión documentada en la
> FASE 3; "Rust-first" se reevalúa en la FASE 4, cuando los bloques salgan de
> memoria). Validación: `npx tsc --noEmit` 0 y `npm test` 33/319.
>
> **Bitácora FASE 4-A (2026-10-31, COMMITTED `422238c`):** primitivas de
> bloques bajo demanda. Rust: `PageData.blocks_loaded`/`block_count`,
> `to_page_data_metadata`, `load_vault { metadata_only }` (solo bóvedas
> locales) y comando `read_pages_cached` (rehidratación por lotes desde
> caché). Front: `ensurePageLoaded` + `loadPagesCached` (LRU ~120 con
> pin/unpin) en `vault.ts`; boot con flag `sinnotas-metadata-boot` **OFF por
> defecto hasta 4-E**. Validación completa (`cargo test` 55, clippy 0,
> `tsc` 0, `npm test` 33/319). Cableado de consumidores en 4-B/4-C/4-D.
>
> **Bitácora FASE 4-B (2026-10-31, tras 2.º corte):** el lado RUST quedó
> completo en el árbol cuando se fue la luz. Contenido (todo en `lib.rs`):
> comando `search_content { query, limit }` (invocable solo con caché
> activa), índice de contenido plegado con mantenimiento incremental
> (`content_index` + `content_dirty` drenado en cada búsqueda, upsert/lower
> desde `update_paths`), plegado lowercase+NFD sin marcas (criterio `fold`
> del front), posiciones convertidas a unidades UTF-16 para `locateMatch`,
> propiedad `clave:: valor` filtrada como `visibleBlockText`, hit = variante
> `to_page_data_metadata` + bloque ganador completo (salta al cursor sin otra
> ronda IPC), orden por apariciones descendente con desempate alfabético.
> Revisión de integridad tras el corte: `cargo check` ✓, `cargo test` 55 ✓
> (0 nuevos; sin test unitario aún), clippy 0 avisos (se corrigió
> `map_or→is_none_or`), `npx tsc --noEmit` 0 y `npm test` 33/319 ✓ (el front
> no se tocó). PENDIENTE en 4-B: tests unitarios Rust (`fold_text`,
> `visible_block_text`, `count_folded_occurrences`, búsqueda e índice
> incremental) y MIGRACIÓN DEL FRONT (`content-search.ts`/omnibar →
> `search_content` con fallback JS solo-web conservado).
>
> **Bitácora arnés perf (2026-10-31):** nuevo módulo
> `src-tauri/src/perf_e2e_tests.rs` (`#[cfg(test)]`, saltado sin
> `SINNOTAS_PERF_VAULT`): mide el pipeline real de Rust sobre una COPIA de
> la bóveda en tempdir (rescan frío v3, arranque seco, grafo,
> retroenlaces, rehidratación en lotes, índice plegado + búsquedas y pico
> de RSS). Ejecución en release:
> `SINNOTAS_PERF_VAULT="/ruta" cargo test --release perf_e2e -- --nocapture`.
> Es cota inferior de la app (no incluye IPC JSON ni el árbol del editor).
>
> Números medidos sobre `Sin Notas (Copiar)` (4,830 notas, 50.4 MB):
> - Copia a tempdir: 0.97s. **FRÍO** (rescan completo v3): **1.73s**.
> - **SECO** (toda apertura normal): **0.80s** — deserialización bincode
>   de la caché (74 MB) + chequeo mtime/tamaño + payload metadata.
> - RSS pico del proceso de test (incluye copia+frío+índice): 520 MB —
>   la app residente queda muy por debajo (el front solo recibe metadata).
> - **GRAFO:** 324 aristas en **1.4 ms**.
> - **BACKLINKS:** **0.37 ms** por consulta (scan lineal del caché).
> - **REHIDRATACIÓN desde la caché:** **1.95 ms por lote de 96 notas**
>   (sin IO, sin reparsar) — la base kanban/flashcards/preview.
> - **ÍNDICE plegado de búsqueda:** 1,007 ms una vez por vault activo;
>   luego solo deltas por nota tocada.
> - **BÚSQUEDAS (límite 20):** token común ("la") **125 ms**; multi-token
>   real **63 ms**. Ojo: el sample de títulos de retroenlaces resultó sin
>   referentes (0 hits) — el timing vale, el conteo no prueba datos.
>
> Lectura: el arranque seco ya está dominado por la deserialización de la
> caché completa — a escala 14k sería ~2-2.5s si la caché crece lineal.
> Ese es exactamente el punto que ataca la mitad Rust del 4.5 (árboles en
> disco + índice sin árboles + lru en Rust): el próximo único palo de
> palanca que queda. Percepción del usuario con la app viva (4,830 notes,
> flag ON en la ventana de `cargo tauri dev`): "increíblemente veloz".
>
> **Bitácora FASE 4-E (2026-10-31):** flag ON por defecto. (1)
> `isMetadataOnlyBoot()` es true si no hay override (`off` en localStorage
> queda como escape manual de una sesión; `on` explícito también vale).
> Solo aplica a Tauri con bóveda local: los comandos de Rust devuelven el
> flag solo en las ramas locales (SAF queda a bloques completos y todos los
> caminos lazy son no-op con `blocksLoaded: true`). (2) Última grieta del
> boot de metadatos cerrada: `updateBlockContent` (arrastre de tareas del
> Kanban) rehidrata la nota (pin incluido) antes de editar el árbol; antes
> el cambio era un no-op silencioso sobre `blocks: []`. (3) Auditoría
> rápida de los consumidores que quedaban: persist() no serializa en
> Tauri, `renameFlashcardPageReferences` trabaja por título (sin bloques),
> el índice JS de búsqueda solo corre en fallback, documentHistory y sync
> rehidratan la nota abierta (4-A). El grafo/preview/omnibar/all-pages/
> diarios ya se cubrieron en 4-B/4-C/4-D.
>
> Validación: cargo test 66, clippy 0, npx tsc --noEmit 0, npm test
> 33/322. **Pendiente END-TO-END (el único de la fase 4): apertura y
> verificación manual de la app empaquetada con bóveda grande y flag ON:
> arranque, boot seco, omnibar, grafo, kanban streaming, flashcards
> streaming, rename, arrastre de tarea sobre nota fría, sync externo y
> reinicio.**
>
> **Bitácora smoke web (2026-10-31):** smoke test en navegador con el dev
> server (`--port 5199 --strictPort`), modo web (flag metadata inactivo en
> `isTauri() === false`): arranca sin errores de consola (0 errores,
> 0 mensajes perdidos) y navegación por Editor/Flashcards/Tareas/Todas las
> páginas/Vista gráfica sin errores; el grafo pinta nodos y aristas con la
> bóveda demo. Regresión web de los caminos flag-OFF de 4-D: limpia.
> Servidor dev apagado con `fuser -k 5199/tcp`, pestañas cerradas.
>
> **Bitácora FASE 4-D (2026-10-31):** cableado de los consumidores que
> escanean bloques, todo bajo el flag (con flag OFF el comportamiento no
> cambia ni una línea: mismo camino de siempre).
>
> - **Flashcards streaming**: `FlashcardLoader` acepta un hidratador
>   opcional (`FlashcardPageHydrator`); cada lote del scan con
>   `blocksLoaded === false` lo pasa por el hidratador (desktop:
>   `vault.loadPagesCached`) antes de escanearlo, con guard de
>   generación tras el await. El barrido del LRU mantiene la memoria
>   acotada aunque pase toda la bóveda.
> - **Kanban streaming**: epoch centinela `-1` en `KanbanManager` para
>   notas escaneadas sin bloques (`scanTasksForPage` sale temprano); la
>   comparación epoch centinela vs. real marca cambiadas las notas recién
>   hidratadas, así que el rescate incremental procesa exactamente el lote
>   nuevo. `desktop.renderKanbanBoard` dispara `ensureKanbanContentLoaded`
>   (stream por lotes de 96, re-pinta cada vuelta y se corta al salir de
>   la vista; la pendiente se recalcula a cada vuelta, sin estado global).
>   Test nuevo del centinela (`hidratada → rescate → fresca`).
> - **Rename streaming** (`vault.renamePage` ahora async): hidrata la
>   nota renombrada ANTES de mutar su título/ruta (la caché de Rust aún
>   no conoce la nueva; hidratar después sería un read a fichero
>   inexistente). La reescritura de `[[TítuloAntiguo]]` sale de
>   `find_backlinks` (superset con refs por tag que la regex deja pasar) y
>   los candidatos se rehidratan por lotes antes del rewrite; si la
>   consulta falla, cae al escaneo en memoria. El resto del flujo
>   (rename_page + saves encolados) no cambia. Llamadores actualizados a
>   `await` (commitPageTitleRename async, menú contextual).
>
> Validación: `cargo test` 66, clippy 0, `npx tsc --noEmit` 0, `npm test`
> 33/322 (2 nuevos: kanban centinela, loader hidratado). Verificación
> manual con el flag ON (app empaquetada): PENDIENTE.
>
> **Bitácora 4-C fix + FASE 4-D (avance) (2026-10-31):** (1) Corrección de
> un bug del cierre de 4-B: `PageData.path` del vault es RELATIVA
> (`replaceVault` normaliza a relativo), así que el match de la copia
> registrada en `openContentHit` por ruta absoluta nunca casaba; ahora se
> resuelve por id estable (mismo hash de ruta canónica en Rust que en
> `load_vault`) con fallback por título, y `graph_links` sirve su `path`
> relativo (aunque el front no lo usa). (2) `block_count` pasa a semántica
> PLANA (`total_block_count`, hijos anidados incluidos: análoga de
> `getAllBlocksFlat`), rellenado en cache/scan_fallback/SAF/read_page. (3)
> Consumidores con resumen listo para el boot de metadatos: all-pages
> (conteo por fila) y lista de diarios usan `blockCount` cuando la nota
> está descargada, y `showGraphPreview` rehidrata con `ensurePageLoaded` y
> re-pinta. Verificación manual: pendiente (igual que el resto de la FASE
> 4).
>
> **Bitácora FASE 4-C (2026-10-31):** grafo Rust-first completado. (1) La
> caché gana `CachedLinkReference.is_tag` (v2→v3: las cachés antiguas se
> descartan y la bóveda se re-escanea una vez con el fallback diseñado) y
> `extract_links` resuelve el alias (`[[Destino|Alias]]` → `Destino`, bug
> latente del grafo y de los retroenlaces cacheados; alineado también el
> regex del fallback SAF de `find_backlinks`). (2) Comando `graph_links`:
> adyacencia por nota (title + ruta absoluta + targets resueltos sin alias,
> sin tags y SIN deduplicar — el radio de nodo cuenta apariciones),
> O(enlaces cacheados) por llamada, sin tocar bloques. (3) Front:
> `GraphView.updateData(pages, links?)` y `connectedPageTitles(..., links?)`
> aceptan la adyacencia servida (fallback JS idéntico para web/sin caché);
> `applyGraphPages` pasa a async con guard de carrera — y el listener de
> `vault-cache-delta` re-aplica la vecindad en vez de re-escanear bloques.
> > Validación: `cargo test` 66 (3 nuevos: clasificación de links con alias,
> migración v2→v3 y servicio del grafo), clippy 0, `npx tsc --noEmit` 0 y
> `npm test` 33/320 (nuevo test del neighborhood con adyacencia Rust).
> Verificación manual del grafo en la app empaquetada: PENDIENTE.
>
> **Nota de comportamiento 4-C:** con alias resueltos, aristas que antes no
> existían (`[[C|alias]]` caía en un título fantasma) ahora conectan; y los
> retroenlaces (caché y SAF) ya muestran notas que enlazan con alias. Los
> Los
> tags `#` siguen fuera del grafo (criterio vigente) y siguen contando en
> retroenlaces (FASE 3).
>
> **Bitácora FASE 4-B cierre (2026-10-31):** completada. (1) Núcleo de
> búsqueda extraído a `run_content_search` (función libre sin `AppHandle`)
> con 8 tests unitarios Rust: plegado, texto visible, conteo con tope,
> tokenización, índices UTF-16 con multibyte/emoji, filtro de imágenes y de
> bloques solo-propiedades, AND de tokens, mejor bloque por nota (incluido
> anidado), orden + desempate alfabético, truncado y guardas. (2) Front:
> `scheduleContentSearch` → `runContentSearch` async: en Tauri
> `invoke("search_content")`; el fallback JS queda solo para web/sin caché.
> El hit de Rust trae página metadata + bloque ganador COMPLETO (el
> fragmento del omnibar se pinta sin rehidratar); `openContentHit` resuelve
> la página registrada del vault por ruta absoluta antes de abrir (compatible
> con el boot metadata-only de 4-E). `cargo test` 63, clippy 0,
> `npx tsc --noEmit` 0 y `npm test` 33/319. Verificación manual del omnibar
> (app empaquetada, bóveda grande): PENDIENTE.

---

#### 0. Estado del árbol de trabajo al 2026-10-31 (todo sin commit)

Archivos modificados (todos validados: `npx tsc --noEmit` ✓ y `npm test` → 33 archivos / 319 tests ✓):

| Archivo | Contenido del cambio | Estado |
|---|---|---|
| `src/desktop.ts` | ① Zoom de oclusiones: nueva estructura viewport > scroller (`.flashcard-image-scroller`, overflow auto) con controles fijados fuera del área scrollable; retargeting de pointer capture (move/up/cancel sobre el scroller), ~líneas 10564–10724. ② comentarios del tema "Simple". | ✅ Completo, verificado |
| `src/style.css` | ① CSS del scroller (~línea 5345). ② `.accent-option` outline con `color-mix(in srgb, var(--ls-accent) 45%, transparent)` (~línea 1901). | ✅ Completo |
| `src/dev/occlusion-zoom-harness.ts` | DOM del arnés de pruebas de zoom actualizado a la estructura viewport > scroller. | ✅ Completo |
| `src/material-aero.css` (Aero) | Tokens de contraste: hover 14%/pressed 20% oscuro; 10%/14% claro; primary-container 32% oscuro / 28% claro; secondary-container 18% oscuro / 20% claro; accent-subtle 20% / 16%; borde hover de chips 45%. | ✅ Completo |
| `src/theme-lino.css` (Simple) | Papel tapiz plano (#1b1e26 oscuro / #fbfcfe claro), barras #14161d / #ffffff; neutralización de gradientes en (#view-flashcards, #view-journals, .flashcard-box, .flashcard-review-tools, .settings-dropdown-menu.m3-surface); tokens de contraste (hover 13/18 oscuro, 10/14 claro; primary-container 28/20; secondary 17/19; accent-subtle 18/14). | ✅ Completo, verificado visualmente |
| `src/theme-dracula.css` | Tokens de contraste: hover 14/20 oscuro y 10/14 claro; primary-container 32 oscuro / 20 claro; secondary 19/19; accent-subtle 20/15. | ✅ Completo |
| `index.html` | Renombrado visible de "lino" → "Simple" (etiqueta + texto de ayuda). IDs internos (`data-visual="lino"`, localStorage, nombre `theme-lino.css`) NO se tocan por compatibilidad. | ✅ Completo |
| `src/i18n.ts` | Claves EN/ZH actualizadas para el texto de ayuda renombrado. | ✅ Completo |

⚠️ No hagas commits parciales de este set: es coherente y está verificado como conjunto.
Si quieres limpiar el árbol, haz commit del paquete entero primero.

##### Cómo verificar tras una interrupción (sin herramientas especiales)
- Contraste: abrir la app, botón de ajustes → chips de estilo/color en hover y seleccionados en los 3 temas × oscuro/claro. Hover debe notarse (velo + borde tintado), selección con fondo tintado visible y anillo de punto de acento nítido.
- Zoom de oclusiones: abrir repaso con card de occlusion → +/− zoom; el scroll solo mueve la imagen, los botones quedan fijos.
- Comandos de validación: `npx tsc --noEmit` (0 errores) y `npm test` (33/319).

##### Notas del entorno local (por si se rehace la verificación en navegador)
- El servidor dev se lanza con `npm run dev -- --port 5199 --strictPort` y se apaga con `fuser -k 5199/tcp`. **NO** usar `pkill -f "vite --port 5199"` (mata su propio shell).
- Al medir colores con `browser.evaluate`: (a) no espera promesas de página (nada de setTimeout dentro del script); (b) los valores de custom properties (`--md-state-hover`) NO se resuelven en canvas: obtenerlos vía elemento sonda (`probe.style.backgroundColor = "var(--token)"` + `getComputedStyle`); (c) inyectar `<style>*{transition:none !important}</style>` tras cada reload para que las transiciones (250ms) no contaminen las lecturas.

---

#### 1. Diagnóstico histórico de rendimiento (2026-10-31)

> Esta sección conserva el diagnóstico previo a las FASES 4-A–4-E y no
> describe íntegramente el código actual. En particular, el arranque metadata-only,
> la persistencia incremental, la búsqueda Rust-first y los backlinks/grafo
> cacheados se implementaron después. Para el estado vigente, consultar las
> bitácoras posteriores y volver a medir antes de reutilizar estas conclusiones.

Hallazgos clave de la auditoría (exploración del 2026-10-31). Referencias archivo:línea válidas a la versión actual.

**Volumen objetivo:** ~14.000 notas × ~200 bullets ≈ 2.8M `BlockNode`.

##### Flujo actual (arranque → edición)
```
bootstrap() (main.ts:21) → initializeDesktopApp() (desktop.ts:14357)
  → invoke("load_vault") (desktop.ts:14274)         ← RUST carga TODO (árboles completos de las 14k notas)
  → vault.replaceVault(snapshot.pages) (vault.ts:524) ← normaliza cada bloque en JS
  → renderEditor: renderBlocksTree() (desktop.ts:5871) ← solo la nota abierta, sin virtualizar
  (+1200ms: ensureFlashcardScan — rescate COMPLETO de bóveda; +2500ms: prewarm de vistas ocultas)

edición (desktop.ts:5616 input handler)
  → findNodeLocation(page.blocks, id)                ← DFS O(bloques de página) POR TECLA (tree-engine.ts:52)
  → vault.scheduleSavePage → 300ms → invoke("save_page") (vault.ts:711, lib.rs:3640)
      → Rust: reparse nota + cache.clone() DE TODO EL VAULT (lib.rs:1465)
      → thread: bincode de LA BÓVEDA ENTERA + sync_all() (lib.rs:1482-1487, metadata_cache.rs:227-253)
  → bumpMutationVersion() (vault.ts:659)             ← UNA TECLA invalida Flashcards+Search+Kanban+Graph
```

##### Los 10 puntos O(bóveda) con evidencia
1. `load_vault` incluye árboles completos por IPC: `metadata_cache.rs:752` (`pages.push(note.to_page_data(...))`), clonado profundo en `metadata_cache.rs:119`. `read_page` (lib.rs:3415) existe pero NO se usa en el arranque.
2. Guardado = deep-clone de los 14k `CachedNote` (`let snapshot = cache.clone();` lib.rs:1465) + re-serialización bincode completa + fsync (lib.rs:1482-1487). El comentario del propio código admite "decenas de ms" por write.
3. Flashcards: `FlashcardLoader` (src/views/flashcard-loader.ts) cachea por `(páginas, mutación versión)` (flashcard-loader.ts:33-37) → **cualquier tecla** fuerza rescaneo completo después (regex por bloque + 2 renders markdown por cloze: flashcards-manager.ts:585-715, renders dobles en 638-639).
4. `synchronizeVaultFromDisk` (desktop.ts:14126-14190, lanzado 300ms tras cada focus/visibilitychange, desktop.ts:14087): `vaultContentSignature()` = `JSON.stringify` de LA BÓVEDA ENTERA, dos veces (desktop.ts:14112-14118) + `load_vault` completo de nuevo.
5. Backlinks: scan regex JS del 100% de la bóveda en cada apertura de nota (desktop.ts:7019 → vault.ts:950-968). El comando Rust `find_backlinks` (lib.rs:4405) y `find_cached_backlinks` (metadata_cache.rs:784) están cacheados y SIN USAR por el front.
6. Arranque. JS: `replaceVault` re-recorre todo con `normalizeBlockTypes` (vault.ts:11-26) aunque Rust ya saneó y validó el cache (metadata_cache.rs:309-318, 375-403). El bosque de bloques se recorre ≥3 veces incluso con cache caliente.
7. Editor: `renderBlocksTree` vacía `innerHTML` y reconstruye todos los bullets con ~15-20 listeners cada uno (desktop.ts:5871-5893, 5414-5869); un plegar/desplegar → rebuild completo + `save_page` (desktop.ts:5451-5456).
8. Cada tecla hace DFS del árbol de página antes de decidir nada (desktop.ts:5616-5619) + `updateWikilinkAutocomplete` ordena 14k títulos por tecla al teclear `[[` (desktop.ts:4059-4062).
9. Graph: tras cada mutación, regex sobre todos los bloques de todas las notas (desktop.ts:11627 → 11574-11594 → graph-view.ts:242-270).
10. Kanban/All-pages/Search: rescaneos con la versión global (desktop.ts:8029; sort de 14k con `Intl.Collator` all-pages.ts:154-181; rebuild del índice de búsqueda por consulta content-search.ts:145-217).

**Rust ya computa y cachea** (aprovechable): links/tags (`extract_links`, metadata_cache.rs:435), resumen flashcards por nota (metadata_cache.rs:528), backlinks cacheados (metadata_cache.rs:784) — y ya existe el evento incremental `vault-cache-delta` (installVaultCacheDeltaListener, desktop.ts:14204) con `update_paths` (lib.rs:1421-1501) que espiga solo notas cambiadas. La parte incremental del watcher está BIEN hecha; el problema es el camino caliente (teclas/save/focus) y el arranque global.

---

#### 2. Plan por fases (el checklist de trabajo)

> Regla de oro: **una fase = commit**. El código nunca debe quedar a medias entre fases sin commit.
> Si se corta el internet a mitad de fase: ver sección 3 ("protocolo de reanudación").

##### FASE 1 — Invalidación por página + deltas (mata el colgado recurrente) — ✅ COMPLETADA Y COMMITTED 2026-10-31 ✔ (falta verificación manual)

Objetivo: que una tecla/calificar una tarjeta NO invalide toda la bóveda.

- [x] 1.1 `vault.ts`: añadir `mutationEpochs: Map<pagePath, number>` + `getPageVersion(path)`; `bumpMutationVersion()` global SOLO para operaciones estructurales (add/delete/rename de páginas), manteniendo `getMutationVersion()` para compat. → *implementado como `pageVersions` + `VaultVersionView` (`getStructural`/`getPageVersion`) + `collectPageChanges`/`capturePageVersions`; `bumpMutationVersion` queda solo para cambios estructurales.*
- [x] 1.2 `scheduleSavePage` (vault.ts:654-675) pasa a bumpar SOLO la epoch de esa página.
- [x] 1.3 `FlashcardLoader` (src/views/flashcard-loader.ts): la cache-key usa epochs de páginas individuales; en rescate parcial, re-escanear solo páginas con su epoch cambiada (fusionar resultados en `allCards` vía buckets `cardsByPage` + `evaluateCache`).
- [x] 1.4 Kanban (`kanban-view.ts`) y `ContentSearchIndex` (content-search.ts): mismo esquema por-página (reindex incremental de las páginas tocadas; modo legacy numérico conservado).
- [x] 1.5 Deltas Rust→front: `applyExternalDelta` sube los epochs de las notas del delta y ya no llama `flashcardLoader.invalidate()`; las cachés incrementales (flashcards, Kanban, búsqueda, grafo) reescanean solo esas notas. *(Backlinks queda para FASE 3.)*
- [x] 1.6 Fallback: camino de rescaneo completo conservado vía `flashcardLoader.invalidate()` (desktop.ts, 4 puntos) + modo legacy numérico en las tres cachés.

Validación F1: editar una nota con la vista Flashcards abierta no dispara escaneo total (contar scans: log temporal en `ensureFlashcardScan`, desktop.ts:10379). **Tests 33/319 y `tsc` 0 errores en green; la verificación manual con log temporal queda PENDIENTE.** Extra hecho por robustez: `renderGraphView` captura epochs (`graphEpochs`) para detectar ediciones de contenido, ya que ahora las teclas no mueven la versión estructural.

Síntoma de corte a mitad de F1: `tsc` falla en `flashcard-loader.ts`/`vault.ts` por clave de cache sin la nueva firma; ver sección 3.

##### FASE 2 — Guardado barato en Rust + focus sin stringify — ✅ COMPLETADA 2026-10-31 ✔ (falta medición 2.4)

Decisiones de diseño (desviaciones razonadas del texto original del plan):

- **2.1 → diario de deltas** (`metadata_cache.rs`): el nuevo archivo
  `<vault>/.sinnotas_cache_delta.log` (magic `SND1`, versión 1) recibe los
  registros enmarcados (upsert `Option<CachedNote>` / delete con marca de
  tiempo) de cada `update_paths`; el hilo de persistencia solo rebincodea el
  delta y fsynca (O(delta), no O(bóveda)). `cache.clone()` global eliminado:
  el payload de deltas del frontend se construye desde las entradas
  cambiadas. Se compacta (reescribe maestro + trunca journal) tras
  `CACHE_DELTA_COMPACT_RECORDS` (256) registros bajo `persist_lock`
  (`VaultCacheRuntime`, mutex que serializa append/compactación).
  Reglas de rejugada convergentes: upsert gana solo si `modified_ns` es
  mayor que la entrada cacheada; delete aplica salvo recreación posterior
  (sobrevive a un crash entre write_cache_file y truncate).
- **Cambio de formato NO rompe la caché existente**: `.sinnotas_cache.bin`
  mantiene `SNC1` v2; el diario es un archivo aparte con su propia cabecera y
  el fallback de escaneo completo (`load_or_scan_vault`) sigue intacto —a
  además, un cold scan trunca el diario para no replegar registros viejos.
- **Dedupe 2.2**: ya existía en `update_paths` por `content_hash`; ahora las
  escrituras sin cambio ni siquiera tocan el diario.
- **2.3 → comando `vault_sync_state`** (fingerprint O(entradas) sin IO +
  `external_revision` solo de deltas watcher; SAF: fingerprint desde
  `list_notes`). `VaultSnapshot` añade `fingerprint`/`externalRevision`.
  El frontend declina saltarse el reload SOLO si: revision externa sin
  cambiar Y (sin escrituras propias desde el baseline O fingerprint igual).
  Las escrituras propias se rastrean con `vault.getOwnWriteEpoch()` (bump en
  save/delete/rename). Esto sustituye los dos `JSON.stringify` de la bóveda
  entera (menos el caro `blocksContentSignature` recursivo y su sort).
  El cheque primario es la revision (correcto con watcher vivo; el
  fingerprint es el safety net para SAF y cambios sin delta).

- [x] 2.1 Eliminar el `cache.clone()` global por save (lib.rs:1465): journal `append_cache_delta` + `persist_delta` con `persist_lock`.
- [x] 2.2 El hilo de persistencia salta escrituras sin cambio (`update_paths` ya descartaba por content hash; el diario solo recibe deltas reales).
- [x] 2.3 Nuevo comando `vault_fingerprint(&self) -> u64` → implementado como `vault_sync_state` (fingerprint + revision externa en una consulta y con ruta SAF); `synchronizeVaultFromDisk` compara revision/fingerprint y SOLO relee si difieren; los 2 `JSON.stringify` eliminados.
- [ ] 2.4 Medir: `cargo build --release` + nota de 200 bullets, save < ~5 ms de trabajo bloqueante → **MANUAL** (no requiere red; ejecutar en equipo del usuario).

##### FASE 3 — Backlinks y búsqueda desde Rust — ✅ COMPLETADA 2026-10-31 ✔

- [x] 3.1 `renderBacklinks` llama `invoke("find_backlinks", { pageTitle })` (refs ya extraídas por el parseo de Rust en `metadata_cache.find_cached_backlinks`); `findBacklinksFor` eliminado de `vault.ts`. El scan regex queda como fallback SOLO en modo web sin backend (`legacyScanBacklinks` en desktop.ts). Nota de comportamiento: los retroenlaces de Rust incluyen también referencias por `#tag` (superset de lo que mostraba el scan JS de wikilinks); es el mismo criterio del fallback nativo de SAF del comando.
- [x] 3.2 Búsqueda de contenido: **se queda el índice incremental del front** (implantado en FASE 1: `ContentSearchIndex` con epochs por nota; omnibar usa `vault.getVersionView()`). Motivo: con los bloques aún en memoria (FASE 4 pendiente), mantener un índice plegado DUPLICADO en Rust solo añade memoria/formateo sin ganar nada; el camino "Rust-first" se vuelve obligatorio y natural en FASE 4, cuando los bloques salgan de la memoria del front (`blocks: null`). Queda escrita la decisión para esa fase.
- [x] 3.3 `updateWikilinkAutocomplete`: índice pre-ordenado y pre-minúsculas de títulos (`ensureWikilinkTitleIndex`), regenerado SOLO en cambios estructurales (`bumpMutationVersion`: crear/borrar/renombrar/volcado completo), no en cada tecla; el per-key queda un bucle O(títulos) con `includes()` sin sort ni allocs (corta al conseguir 8 + detecta match exacto).

##### FASE 4 — Arranque con metadatos + bloques bajo demanda — ✅ CABLEADA (falta verificación manual con flag ON)

Alcance por ítem original:
- [x] 4.1 (payload metadata-only) → sub-4-A (`load_vault { metadata_only }`, `read_pages_cached`).
- [x] 4.2 (`blocks: null` + `ensurePageLoaded` + LRU) → sub-4-A (`blocksLoaded` + LRU ~120 con pin/unpin).
- [x] 4.3 (auditar consumidores) → 4-B (omnibar/retroenlaces→Rust), 4-C (grafo→Rust, preview rehidrata), 4-D (flashcards/kanban/rename streaming), 4-E (`blockCount` en all-pages/diarios, `updateBlockContent` rehidrata; boot de metadatos en 4-B fix).
- [x] 4.4 (idle liberar no abiertas) → sweep del LRU en `loadPagesCached`/`ensurePageLoaded`.
- [ ] **4.5 parcial** (alcanza al ~2.8M `BlockNode` del FRONT: bajo el boot los residentes son ≤ LRU+pin). La MITAD de RUST sigue abierta: la caché de `metadata_cache.rs` sigue cargando TODOS los árboles en memoria de Rust para poder servir `read_pages_cached` sin IO. Propuesta pendiente: árboles solo en disco con índice por nota sin árboles (o mapa ruta→offset) y `read_pages_cached` leyendo del master con lru propio en Rust.

**Sub-4-A** (primitivas bajo demanda) — ✅ COMMITTED `422238c` (ver bitácora).

**Sub-4-B** (búsqueda de contenido Rust-first) — ✅ COMPLETADA 2026-10-31
(ver bitácora; falta verificación manual en la app empaquetada).

**Sub-4-C** (grafo Rust-first) — ✅ COMPLETADA 2026-10-31 (`231822d`).

**Sub-4-D** (streaming flashcards/kanban/rename) — ✅ COMPLETADA 2026-10-31
(`f93164b`; todo bajo el flag, con flag OFF el camino es el de siempre).

**Sub-4-E** (flag ON) — ✅ IMPLEMENTADA: `isMetadataOnlyBoot` devuelve true
por defecto (escape manual con `off` en localStorage; solo Tauri+bóveda
local; SAF queda full). `updateBlockContent` rehidrata antes de tocar el
árbol (drag de tareas del Kanban sobre notas descargadas).

- [x] 4.B-Rust `search_content`: comando + índice plegado incremental
  (`content_index`/`content_dirty`), hit con página metadata + bloque
  ganador, criterios idénticos al `search` del front. COMMITTED `bd1b9cb`.
- [x] 4.B-Tests unitarios Rust del plegado/búsqueda/índice (8 tests; núcleo
  extraído a `run_content_search` libre de `AppHandle`). COMMITTED `fc9a86f`.
- [x] 4.B-Front: el omnibar consume `invoke("search_content")`; el índice JS
  (`ContentSearchIndex`) queda SOLO como fallback (web sin backend o caché
  inactiva, p. ej. bóveda SAF). Guard de carrera (`contentSearchRun`) para
  respuestas async desordenadas; `openContentHit` prefiere la copia del
  vault por ruta absoluta (compatible con el boot de metadatos de 4-E).

- [ ] 4.1 Cambiar el payload del arranque: nuevo comando (o flag `metadata_only` en `load_vault`) que devuelva títulos/fechas/frontmatter/resumen flashcards, SIN árboles de bloques.
- [ ] 4.2 `vault.replaceVault` construye páginas con `blocks: null` (indicador "no cargada"); todas las APIs de lectura pasan por `ensurePageLoaded(path) → invoke("read_page")` con cache LRU de ~50-100 notas cargadas (liberar las menos recientes).
- [ ] 4.3 Auditar TODO el front que asume `vault.getPages()` con bloques disponibles (riesgo mayor: desktop.ts — flashcards scan, kanban scan, search, graph, all-pages block counts, documentHistory). Cada uno migra a "solo páginas cargadas" o a datos del resumen Rust.
- [ ] 4.4 Tras idle, liberar los bloques de páginas no abiertas (descarga en caliente); conservar frontmatter.
- [ ] 4.5 Memoria objetivo: quitar de una vez los ~2.8M `BlockNode` de JS y de Rust (Rust guarda solo resúmenes; árboles solo en disco/cache on-demand).

⚠️ F4 es la única fase que puede "romper el código" de forma extensa. No empezar sin commit limpio de F1-F3. Si se corta en medio: revertir a commit de F3 y retomar con 4.2 (la lista de llamadas usadoras está mapeada mediante `grep -n "getPages()" src/`).

##### FASE 5 — Editor virtualizado (opcional, solo si se nota lag en página abierta) — 🔴 NO EMPEZADA ☐

- [ ] 5.1 Windowing de `renderBlocksTree` (desktop.ts:5871): DOM solo para rango visible ± buffer (reutilizar la API de `src/views/virtual-list.ts`) + `content-visibility: auto` en `.block-item` como refuerzo.
- [ ] 5.2 Render fino: plegar/toggle de tarea/pill re-renderiza solo el subárbol del bloque (desktop.ts:5451-5456, 5583-5587) en vez de resetear `innerHTML` del contenedor.
- [ ] 5.3 Quitar el DFS por tecla del input handler (desktop.ts:5616-5619): resolver la ubicación en `keydown`/`focus` y cachearla mientras el bloque no se mueve.
- [ ] 5.4 Code-split de `desktop.ts` (558 KB / 14.468 líneas, un solo chunk en vite.config.ts:52-57) por vistas (flashcards/all-pages/graph).

##### FASE 6 — Arranque perezoso por vista (Android-first) — ✅ IMPLEMENTADA 2026-10-31 (6.1/6.3 ya existían) ✔

**Observación del usuario:** en Android entrada a modo repaso primero ⇒ arranque
mucho más rápido que editor-primero (el backend porteado no era el héroe: el
modo repaso monta menos árboles). Al auditar el boot: parte del ticket YA
EXISTÍA — lo nuevo era 6.2.

- [x] 6.1 **Recordar la última vista y arrancar en ella** — ✔ YA EXISTÍA:
  `readLastNavigation` restaura vista+nota (`LAST_VIEW_STORAGE_KEY`) y el boot
  solo llama `renderEditor()` si la última vista era editor; si era repaso/
  kanban/grafo hace `switchView(esa)`. La observación del usuario era este
  comportamiento ya vivo (el editor no se monta si repasaste primero).
- [x] 6.2 **Saltar `normalizeBlockTypes` del vault completo en Tauri** — ✔
  IMPLEMENTADA (`vault.ts`): el pase O(vault) en el hilo principal solo corre
  en modo web (datos legacy). En Tauri el payload SIEMPRE sale del parse de
  Rust (`parse_markdown_with_frontmatter`, lib.rs:1415), que detecta imágenes
  (`markdown_image_parts` → `block_type: "image"` + `image_alt`) y emite
  "text" en el resto: renormalizar era un no-op que pagaba el vault entero en
  cada boot/sync (con SAF los árboles viajan completos Android). Test:
  `vault-replace.test.ts` (web normaliza, Tauri respeta el payload).
- [x] 6.3 **Montaje perezoso del editor** — ✔ YA EXISTÍA por la misma vía del
  restore (renderEditor solo si lastNav.view === "editor"); las vistas
  ocultas se precalientan en idle (schedulePrewarmHiddenViews sin editor).
- [ ] 6.4 Criterio de éxito: PENDIENTE — Android con bóveda grande,
  comparar tiempos perceptibles editor-primero vs. repaso-primero tras la
  6.2 (esperado: la brecha ya casi desaparece porque el pase O(vault) que
  pagaba TODO boot con árboles completos desapareció en ambos caminos).



---

#### 3. Protocolo de reanudación tras corte (como pides: "saber de dónde continuar")

1. **Comprobar integridad del árbol**: `npx tsc --noEmit` y `npm test` (esperado: 33/319).
   - ✓ Todo verde → el árbol está en un estado estable; mira la primera fase sin ☑ arriba y empieza ahí (tras hacer commit de lo pendiente).
   - ✗ Errores de compilación → estás a mitad de una fase. Encuentra LA fase por los archivos con errores:
     - errores en `vault.ts` / `flashcard-loader.ts` / `kanban-view.ts` / `content-search.ts` → corte en **FASE 1** (1.1-1.5; el punto de corte suele ser la cache-key: reanudar en 1.3).
     - errores `src-tauri/src/lib.rs` o `metadata_cache.rs` → corte en **FASE 2** (reanudar en 2.1; el bincode viejo NO debe abrirse con formato nuevo sin cabecera de versión).
     - errores en `desktop.ts` alrededor de `renderBacklinks`/`synchronizeVaultFromDisk` → corte en **FASE 3**.
     - errores masivos de tipos (propagación de `blocks: null`) → corte en **FASE 4**: recomendación revertir al commit de F3 con `git restore` o stash; no continuar sobre el árbol roto.
2. **Nunca mezclar estados a medias con las modificaciones de temas (sección 0)**: si el corte dejó mezclado temas+perf, prioriza commit lo antes posible de lo verde, y aparta lo roto con `git stash` para retomarlo limpio.
3. Tras reanudar, actualizar ESTE archivo: marcar ☑ lo hecho y actualizar la fecha de la cabecera.

#### 4. Comandos de referencia

```bash
npx tsc --noEmit          # tipos (0 errores esperado)
npm test                  # 33 archivos / 319 tests esperado
npm run dev -- --port 5199 --strictPort   # servidor dev (background ideal)
fuser -k 5199/tcp          # matar servidor dev (NO pkill -f vite: mata su propio shell)
cargo build --release      # dentro de src-tauri/ , para validar cambios Rust
```

Validaciones manuales de temas/zoom: ver sección 0.


---

## 3. Fuentes fusionadas (trazabilidad)


Los 11 archivos `CHECKLIST-*.md` originales se eliminaron el 2026-11-23. Esta tabla conserva la correspondencia con las secciones actuales; no son enlaces a archivos existentes.


| Archivo original (eliminado) | Sección | Título |
| --- | --- | --- |

| `CHECKLIST-SEGURIDAD-DOCUMENTOS-BIBLIOGRAFIA.md` | [§ A1](#a1-seguridad-documentos-y-bibliografia) | Endurecimiento de seguridad: Documentos y Bibliografía |

| `CHECKLIST-PDF.md` | [§ A2](#a2-documentos-y-lector-pdf-nativo-pdfium) | Documentos y lector PDF nativo (PDFium) |

| `CHECKLIST-BUSQUEDA-BIBLIOGRAFIA.md` | [§ A3](#a3-busqueda-de-metadatos-para-bibliografia) | Búsqueda de metadatos para Bibliografía (DOI, ISBN y palabras clave) |

| `CHECKLIST-FSRS7.md` | [§ B1](#b1-fsrs-7-motor-dual-trace-y-licencias) | FSRS-7 (motor dual-trace) y licencias de terceros |

| `CHECKLIST-FSRS7-FIXES.md` | [§ B2](#b2-correcciones-de-la-auditoria-fsrs-7) | Correcciones de la auditoría FSRS-7 |

| `CHECKLIST-FSRS7-REPARACIONES.md` | [§ B3](#b3-reparaciones-de-la-auditoria-fsrs-7-lote-2) | Reparaciones de la auditoría FSRS-7 (lote 2) |

| `CHECKLIST-MAZOS-PERSONALIZADOS.md` | [§ B4](#b4-mazos-personalizados-de-flashcards) | Mazos personalizados de flashcards |

| `CHECKLIST-TEMAS-VISUALES.md` | [§ C1](#c1-temas-visuales-lino--dracula) | Temas visuales (Lino + Dracula) |

| `CHECKLIST-FIXES-UI.md` | [§ C2](#c2-fixes-de-ui) | Fixes de UI (botones mapa/oclusión, tareas canvas, scroll flashcards) |

| `CHECKLIST-MANTENIMIENTO.md` | [§ D1](#d1-mantenimiento-y-recuperacion) | Mantenimiento y recuperación |

| `CHECKLIST-PERF-VAULT.md` | [§ D2](#d2-rendimiento-a-escala-14k-notas--200-bullets) | Rendimiento a escala (14k notas × 200 bullets) |
