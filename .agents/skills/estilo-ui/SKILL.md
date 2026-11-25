---
name: Estilo UI
description: Revisar que los menúes desplegables, selectores de fecha y botones nuevos o modificados de SinNotas conserven la estética visual de la app (temas, tipografía, padding y foco); usar al añadir controles o al revisar diffs de UI.
---

# Estilo UI — revisión de controles

Propósito: evitar que aparezcan controles con el estilo del sistema operativo o desalineados con el resto de la app. **Revisa y reporta**; no cambies código de aplicación salvo que te lo pidan explícitamente.

## Checklist obligatorio

1. **Selectores desplegables**
   - Todo `<select>` nuevo debe pasar por `migrateSelect(select)` de `src/views/custom-select.ts`. Nunca dejar un `<select>` nativo visible: su menú depende del SO.
   - Si se escribe `select.value` por código (restauración, sincronización), llamar siempre a `syncCustomSelect(select)` justo después.
   - Comprobar que el `<select>` original sigue siendo la fuente de verdad y que el evento `change` sigue llegando al manejador existente.
   - Revisar la lista de `migrateSelect(...)` en `desktop.ts` (bloque «selector personalizado») y los módulos con vistas propias (`bibliography-view.ts`, etc.).

2. **Entradas de fecha y otros controles nativos**
   - `input[type="date"]` y similares deben incluirse explícitamente en las reglas de `.settings-row input[type="..."]` de `src/style.css` y en la capa `material-aero.css`; si no, el navegador aplica su font/padding.
   - Ajustar también `::-webkit-calendar-picker-indicator` con `filter` por tema (el tema oscuro es el predeterminado, sin `data-theme`).

3. **Variables y temas**
   - Usar solo tokens `--ls-*` (y `--md-*`/`--ma-*` en la capa Aero). Prohibidos colores hexadecimales fijos en componentes nuevos.
   - Verificar con `data-theme="light"` (tema claro) y sin atributo (tema oscuro).
   - Verificar los estilos visuales `data-visual="lino"` y `data-visual="dracula"`: neutralizan Aero y pueden sobrescribir `background`, `border-radius` o `box-shadow`.
   - Si un tema redefine una superficie (p. ej. `--ls-kanban-card-bg`), la regla base debe leer la variable, no un color fijo.

4. **Tipografía, padding y foco**
   - `font: inherit` / `font-family: inherit` y `font-size: var(--ls-font-size-ui)` o `calc(Npx * var(--ls-font-scale, 1))`.
   - Padding coherente con `.settings-row input`, `.font-option-btn` y `.custom-select` (aprox. 6–10 px verticales).
   - `box-sizing: border-box` cuando haya `width`/`height` fijos; si no, el borde ensancha el control y el icono se recorta.
   - `:focus-visible` con `outline` o `box-shadow` en color de acento; `:hover` con `--ls-bg-hover` o `--ls-accent-subtle`.

5. **Toolbars y agrupación**
   - Agrupar acciones por contexto (insertar / mover / borrar) con separadores, como en `createTableToolbar` (`desktop.ts`).
   - Un toolbar de edición va en flujo normal, encima del contenido; nunca `position:absolute` tapando celdas.
   - El toolbar de tablas se muestra **solo mientras una celda está seleccionada** y usa
     `width: fit-content` + `flex-wrap: nowrap` con `overflow-x:auto`: una sola fila aunque falte ancho.
   - Objetivos táctiles de al menos 28–44 px.

6. **Verificación final**
   - `npx tsc --noEmit` y `npm test`.
   - Si el cambio afecta a símbolos documentados, actualizar la skill `estructure`.

## Referencias rápidas

| Qué | Dónde |
| :--- | :--- |
| Implementación del dropdown | `src/views/custom-select.ts` (`CustomSelect`, `migrateSelect`, `syncCustomSelect`) |
| Tokens y temas | `src/style.css` (`--ls-*`), `src/material-aero.css`, `src/theme-lino.css`, `src/theme-dracula.css` |
| Reglas de controles | `src/style.css` (SETTINGS DROPDOWN, CustomSelect, settings inputs) |
| Ejemplo de toolbar agrupado | `desktop.ts` → `createTableToolbar` |
| Mapa de estilos | skill `estructure` → `references/Estructure.md` §11.3 |
