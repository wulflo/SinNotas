# SinNotas — Checklist de mantenimiento y recuperación

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

## 0. Cómo usar y cómo retomar este trabajo

### 0.1 Estado de partida

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

### 0.2 Reglas de oro

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

### 0.3 Recuperación tras una interrupción

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

### 0.4 Verificación global

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

### 0.5 Arquitectura mínima que hay que entender

SinNotas **no usa React ni Tailwind**. Es TypeScript + HTML + CSS nativos,
empaquetados con Vite, con backend Rust para archivos.

| Ruta | Responsabilidad |
| --- | --- |
| `index.html` | Estructura fija del escritorio: barra superior, vistas, ajustes y modales. |
| `src/desktop.ts` | Monolito principal: editor, vistas, ajustes, repaso, grafo, búsqueda. |
| `src/style.css` | Estilos del escritorio (tema, layout, tarjetas, tablas, focus). |
| `src/material-aero.css` | Capa visual adicional sobre el tema. |
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

### 0.6 Matriz de tareas

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

## 1. Orden recomendado de implementación

No hace falta seguir el orden numérico. Este orden reduce el riesgo de romper
cosas y permite cerrar victorias rápidas antes de los refactors grandes.

### Fase 0 — Línea base (antes de cambiar código)

- [x] Ejecutar `npm run build`, `npm test` y `cargo check`.
- [x] Ejecutar `bash scripts/benchmark-cache.sh 5000` y guardar el resultado
      como referencia (T9).
- [x] Crear una bóveda de prueba con muchas notas (ver T9).
- [ ] Etiquetar el punto de partida: `git tag baseline-0.3.5`.

> **Estado:** los tres primeros puntos se cumplieron al iniciar el trabajo;
> las cifras base están en `docs/benchmark-2026-10-29.md`. No se creó el tag
> porque no se pidieron commits y todos los cambios quedan en el árbol de
> trabajo.

### Fase 1 — Arreglos rápidos y aislados (bajo riesgo)

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

### Fase 2 — Repaso y flashcards (riesgo medio)

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

### Fase 3 — Búsqueda, grafo y editor (riesgo medio-alto)

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

### Fase 4 — Vista dividida (riesgo alto)

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

### Fase 5 — Rendimiento y cierre

T9 de nuevo, con la bóveda grande y todas las vistas. Compara con la línea base
y documenta los resultados.

> **Estado (29 oct 2026):** medición inicial completada. Se ejecutó la caché
> Rust con 5.000 y 20.000 notas, el benchmark JS de 1.000 × 100 bloques y una
> bóveda sintética de 5.000 notas × 30 bloques en el navegador (índice de
> búsqueda, escaneo de tarjetas y grafo). Resultados y comparación con
> `ffd40a5` en `docs/benchmark-2026-10-29.md`. Queda repetir la medición de
> todas las vistas con una bóveda real en Tauri y con la APK. Los dos checks
> genéricos que siguen abiertos son precisamente la validación en APK y el
> commit: no se hicieron commits por indicación expresa, así que el cambio
> queda en el árbol de trabajo.

---

## 2. Tareas detalladas

---

## Grupo A — Títulos, layout y tipografía

### T1 — Truncar los títulos largos en la barra superior

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

### T7 — Vista dividida para editar varias notas

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

### T11 — Elementos que ignoran el cambio de tipografía

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

## Grupo B — “Todas las páginas”

### T2 — Ordenar por cabeceras y redimensionar columnas

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

### T3 — Fechas de actualización y creación en “Todas las páginas”

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

## Grupo C — Repaso y flashcards

### T18 — Bug visual de flashcards al volver de otra ventana

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

### T23 — Reconocer tarjetas programadas al terminar la sesión

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

### T17 — Scroll del modo focus de flashcards

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

### T13 — Botones +/− de tamaño junto al tipo de tarjeta

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

### T16 — Mostrar el bullet padre como contexto sobre el anverso

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

### T4 — Fuegos artificiales al calificar “Fácil”

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

### T14 — Sonidos al terminar Pomodoro y alternar enfoque/descanso

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

## Grupo D — Grafo y mapa conceptual

### T5 — Botón junto al mapa conceptual → notas conectadas en el grafo

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

### T6 — Mover “Grafo” de Ajustes a la vista de grafo

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

### T8 — Mapa conceptual: detalle al pasar el ratón, no al hacer clic

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

## Grupo E — Búsqueda y referencias

### T15 — Resaltar la coincidencia tras elegir un resultado de contenido

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

### T21 — Referencias: mostrar también los enlaces salientes

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

## Grupo F — Editor

### T20 — Buscar dentro de la nota actual

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

## Grupo G — Apariencia y ajustes

### T10 — Acentos en escala de grises

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

### T12 — Mover ancho de página e idioma al inicio de Apariencia

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

### T22 — Contraste del placeholder “Buscar o crear nota”

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

## Grupo H — Mando

### T19 — Mando genérico Xbox: RT cambia con stick derecho abajo

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

## Grupo I — Rendimiento

### T9 — Prueba de rendimiento con miles de notas

- [x] Bóveda sintética de 5.000 y 20.000 notas
- [x] Medición de arranque, vistas, búsqueda y repaso
- [x] Comparación antes/después
- [x] Resultados documentados (`docs/benchmark-2026-10-29.md`)

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

## 3. Apéndices

### Apéndice A — Claves de `localStorage`

| Clave | Uso |
| --- | --- |
| `sinnotas-theme` | `light` / `dark`. |
| `sinnotas-accent` | Acento activo (`blue`, `green`, …, `gray`). |
| `sinnotas-font` | `sans`, `serif`, `mono`, `dyslexic`, `system`. |
| `sinnotas-system-font` | Familia del sistema elegida. |
| `sinnotas-font-size-*` | Tamaños por tipo (`ui`, `editor`, `pageTitle`, `h1`…). |
| `sinnotas-font-size-flashcard-question` | Tamaño `em` del texto de tarjeta. |
| `sinnotas-page-width` | Ancho de página en px. |
| `sinnotas-glow-intensity` | Intensidad Aero (0–100). |
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

### Apéndice B — Variables CSS útiles

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

### Apéndice C — Tests existentes relevantes

| Área | Archivo |
| --- | --- |
| Todas las páginas | `src/views/all-pages.test.ts` |
| Flashcards (detección, cola, FSRS) | `src/views/flashcards-manager.test.ts` |
| Carga por lotes | `src/views/flashcard-loader.test.ts` |
| Grafo | `src/views/graph-physics.test.ts`, `graph-settings.test.ts`, `graph-labels.test.ts` |
| Tipografía | `src/typography.test.ts` |
| Mando | `src/gamepad.test.ts` |
| Búsqueda de contenido | `src/store/content-search.test.ts` |
| Progreso de repaso | `src/store/review-progress.test.ts` |
| Árbol de bloques | `src/editor/tree-engine.test.ts` |
| Markdown | `src/editor/markdown.test.ts`, `markdown-table.test.ts` |
| Kanban / listas | `src/views/kanban-view.test.ts`, `virtual-list.test.ts` |

### Apéndice D — Definition of Done

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

### Apéndice E — Mensajes de commit sugeridos

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

## 4. Notas finales

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
