# Checklist — Fixes de UI (botones mapa mental / oclusión, tareas canvas, scroll flashcards)

**Estado:** Fases 1–3 y Fase 5 (regresiones 8.1–8.3) implementadas; tsc, tests y build ✅. Pendiente la prueba manual en la app Tauri. **Última actualización:** 2026-11-21
**Rama de trabajo:** `master` (se publica en `v0.5.1`)
**Documento principal:** `docs/SinNotas.md`

Este documento es el punto de reanudación si una sesión de trabajo se corta a
mitad.

---

## 0. Reglas de reanudación después de una interrupción

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

- Ninguno.

---

## 1. Decisiones cerradas

- Los cambios son **solo CSS** en `src/style.css` (no se toca HTML ni TS para esta fase).
- El cierre de "Oclusión de imagen" (`image-occlusion-header .btn-icon`) pasa a 40×40 px, igual que el encabezado de ajustes (`settings-dialog-header`). Los botones del encabezado de "Mapa conceptual" (`concept-map-tools .btn-icon`) se reducen un 30 % respecto de 40×40 px, es decir, 28×28 px.
- Los botones de la toolbar de oclusión (`font-option-btn`) pasan a `min-height: 40px` y `padding: 8px 12px`.
- El botón "Guardar oclusiones" (`image-occlusion-footer .btn-primary`) se separa del estilo píldora de `.btn-primary` y usa el estilo primario canónico de la app: `border-radius: 8px`, fondo degradado del acento, borde none, texto `--ls-accent-foreground`, sombra y estados hover/activo propios.

---

## 2. Mapa de archivos

| Ruta | Responsabilidad |
| --- | --- |
| `src/style.css` | Estilos de UI de escritorio (botones mapa mental, oclusión, guardar oclusiones). |
| `index.html` | Estructura de los diálogos (sin cambios previstos en esta fase). |
| `src/desktop.ts` | Lógica de los diálogos (sin cambios previstos en esta fase). |
| `docs/SinNotas.md` | Resumen técnico (actualizar al terminar). |

---

## 3. Fases

### Fase 1 — Botones pequeños y estilo "Guardar oclusiones" (HECHO)

- [x] `.concept-map-tools .btn-icon`: 40×40 px → reducido un 30% a 28×28 px, fuente `calc(24px * var(--ls-font-scale, 1))` → `calc(17px * var(--ls-font-scale, 1))`, gap 6px.
- [x] `.image-occlusion-header .btn-icon`: 40×40 px (botón cerrar ×).
- [x] `.image-occlusion-toolbar .font-option-btn`: `min-height: 40px`, `padding: 8px 12px` (escala/rotar/align/distribuir).
- [x] `.image-occlusion-footer .btn-primary`: propio estilo `border-radius: 8px`, fondo degradado del acento, `box-shadow`, hover/activo.
- [x] `npx tsc --noEmit` ✅ y `npm run build` ✅.

### Fase 2 — Tareas muy oscuras en modo canvas (HECHO)

- [x] `--ls-kanban-card-bg` aclarado de `#17191f` (casi idéntico al fondo) a `#1e242d` para dar contraste frente al fondo principal.
- [x] `--ls-kanban-card-shadow` suavizada de `rgba(0,0,0,0.24)` a `rgba(0,0,0,0.15)` y `rgba(0,0,0,0.08)` a `rgba(0,0,0,0.05)` para no oscurecer las cards.
- [x] `npx tsc --noEmit` ✅ y `npm run build` ✅.

### Fase 3 — Flashcards: scroll con rueda del mouse dentro de la tarjeta (HECHO)

- [x] `.flashcard-content`: añadido `overflow-y: auto`, `overscroll-behavior: contain` y `scrollbar-gutter: stable` para que el wheel haga scroll dentro del box cuando el contenido exceda el alto.
- [x] `.flashcard-box`: añadido `max-height: 90vh` para activar el scroll interno en contenido largo.
- [x] Las flechas direccionales siguen funcionando (no se tocó).
- [x] `npx tsc --noEmit` ✅ y `npm run build` ✅.

### Fase 4 — Cierre

- [x] Actualizar `docs/SinNotas.md` con estado final: nueva sección «Ajustes de interfaz (0.4.3)» y nota en «Verificación actual».
- [x] Añadir pruebas de regresión si aplica: no aplica; los cambios son solo CSS y la suite no carga hojas de estilo. Se verificó que las 465 pruebas en 45 archivos siguen pasando.
- [ ] Probar manualmente en app Tauri (no solo modo web): requiere una sesión con la app abierta; no se puede automatizar desde aquí.

## 4. Contratos / selectores CSS afectados

- `.concept-map-tools .btn-icon` — zoom-in/zoom-out/reset/cerrar del mapa conceptual (28×28 px tras reducción del 30%).
- `.image-occlusion-header .btn-icon` — cierre del diálogo de oclusión (40×40 px).
- `.image-occlusion-toolbar .font-option-btn` — escala (–/+), rotar (↶/↷), alinear, distribuir (min-height 40px).
- `.image-occlusion-footer .btn-primary` — "Guardar oclusiones" (border-radius 8px, fondo degradado).
- `--ls-kanban-card-bg` / `--ls-kanban-card-shadow` — fondo y sombra de tarjetas de tarea en canvas.
- `.flashcard-box` — `max-height: 90vh` (activar scroll interno).
- `.flashcard-content` — `overflow-y: auto`, `overscroll-behavior: contain`, `scrollbar-gutter: stable` (scroll con rueda dentro de la tarjeta).

---

## 5. Comandos de verificación

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

## 6. Registro de sesiones

| Fecha | Fase | Cambios | Verificación |
| --- | --- | --- | --- |
| 2026-11-21 | 1 | Botones mapa mental y oclusión 40×40 px; "Guardar oclusiones" estilo primario canónico (border-radius 8px, fondo degradado, sombra) | `tsc`; `npm run build` |
| 2026-11-21 | 2–4 | Tareas canvas con `--ls-kanban-card-bg` aclarado; scroll interno de flashcards (`90vh`, `overflow-y`); `docs/SinNotas.md` actualizado y checklist cerrado | `npx tsc --noEmit`; `npm test` (465/45); `npm run build` |
| 2026-11-21 | 5 | Imágenes de repaso: prueba de carga de URL `asset:` + fallback a blob; selector «Mazo» de la hoja FSRS migrado a `CustomSelect`; rueda sin `overscroll-behavior: contain` en tarjeta/imagen | `npx tsc --noEmit`; `npm test` (465/45); `npm run build`; comprobado en navegador (modo repaso) |

---

## 7. Pendientes inmediatos al reanudar

1. **Fase 5 (regresiones reportadas)**: ver la sección 8; continuar por el primer ítem `[~]` o `[ ]`.
2. Probar manualmente en la app Tauri (no solo modo web): botones del mapa conceptual, cierre/toolbar/guardar de oclusión, contraste de tareas en canvas y scroll con rueda dentro de una tarjeta de flashcards larga.
3. Si la prueba manual revela algo, anotarlo en «Registro de sesiones» y reabrir la fase correspondiente.
4. Si algo no compila, leer el primer error de `npx tsc --noEmit`.

---

## 8. Fase 5 — Regresiones reportadas el 2026-11-21

> Reportadas por el usuario después de 0.4.16. No borrar esta sección si la
> sesión se corta: cada ítem debe quedar con su estado y las pistas exactas.

### 8.1 Imágenes no cargan en modo repaso

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

### 8.2 El selector «Mazo» de la hoja FSRS sigue saliendo nativo

- [x] En la hoja FSRS de repaso (`data-fsrs-deck-select`) el menú lo dibujaba el
  sistema operativo, no `CustomSelect`.
- Causa: `bindEvents` migraba `fsrsRecalcAction` y `fsrsAnchor`, pero **no**
  `fsrsDeckSelect`.
- Hecho: `migrateSelect(this.refs.fsrsDeckSelect)` en `bindEvents`;
  `renderFSRSDeckSelect()` ya llama a `syncCustomSelect()`.
- Verificado en navegador (modo repaso): el `<select>` nativo queda con
  `display: none` y aparecen 3 `.custom-select` (mazo, acción y ancla).

### 8.3 La rueda del ratón no desplaza dentro de la flashcard

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
