# Checklist — Temas visuales (Lino + Dracula)

> **Propósito:** registro de avance para retomar el trabajo si se corta la
> conexión y para verificar que nada se haya roto. Marcar `[x]` al completar
> cada ítem. Actualizar la sección "Estado" al final de cada bloque de trabajo.

## Contexto (continuar desde aquí)

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

## 1. Preparación

- [x] Confirmar scripts de `package.json` (build/test) para verificación final.
- [x] `AccentColor`/`accentColors` son locales de `desktop.ts` (móvil tiene el
      suyo, sin tocar). `vite-env.d.ts` no necesita cambios: imports CSS
      normales, no `?inline`.

## 0. Fix splash triple (25/10/2026)

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

## 2. CSS de los temas

- [x] Crear `src/theme-lino.css` (claro suave + variante oscura para el
      conmutador claro/oscuro).
- [x] Crear `src/theme-dracula.css` (Dracula + variante diurna suave).
- [x] Ambos derivan superficie/outline de `var(--ls-accent)` con `color-mix`.

## 3. Integración desktop

- [x] `src/desktop.ts`: imports `theme-lino.css`/`theme-dracula.css` tras
      `material-aero.css` (orden de cascada garantizado).
- [x] `visualThemes` + `VisualTheme` junto a `AccentColor`; `setVisual`
      espeja el estado en los botones (mismo patrón que `setAccent`).
- [x] `data-visual` persistido en `localStorage["sinnotas-visual"]`
      (default `aero`) y aplicado desde `initThemeAndTypography`.
- N/A: `src/style.css` sin cambios de compat (los temas nuevos redefinen
      tokens `--md-*`/`--ma-*` que aero ya consume; el pequeño añadido
      `.visual-selector` va token-driven).

## 4. UI de ajustes

- [x] `index.html`: fila "Estilo visual" con botones Aero/Lino/Dracula bajo
      "Tema Visual", `aria-pressed` y help text; wiring de `[data-visual-option]`.
- [x] `src/i18n.ts`: "Estilo visual" + help en EN y ZH (nombres de temas no
      se traducen, son marca).

## 5. Verificación

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
- [x] Actualizar tabla de archivos en `docs/CHECKLIST-MANTENIMIENTO.md`.

## 6. Fix bordes suaves (sesión 2)

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

## 7. Rediseño del reloj pomodoro (sesión 2)

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

## Estado

- [x] Bloque 0 — Fix splash triple
- [x] Bloque 1 — Preparación
- [x] Bloque 2 — CSS de temas
- [x] Bloque 3 — Integración desktop
- [x] Bloque 4 — UI de ajustes
- [x] Bloque 5 — Verificación final (pendiente: confirmación visual del usuario)
- [x] Bloque 6 — Bordes suaves (pendiente: confirmación visual del usuario)
- [x] Bloque 7 — Reloj pomodoro con paleta del botón de sidebar (pendiente: confirmación visual del usuario)

### Notas de reanudación

- Si se corta a mitad de bloque: el trabajo queda en el repo; revisar
  `git status`/`git diff` para ver qué archivos del bloque ya están tocados.
- Punto de partida de los tokens nuevos: copiar la estructura de roles
  `--md-*` de `src/material-aero.css:11-99` para que la hoja base
  (`style.css`) siga compilando sin conocer los temas nuevos.
- No usar la palabra propietaria de la app de notas en nombres ni comentarios.
