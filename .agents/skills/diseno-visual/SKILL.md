---
name: Diseño visual
description: Criticar y corregir el diseño visual de SinNotas para hacerlo más moderno y práctico —espaciado, jerarquía, densidad, alineación, contraste, scroll y uso del espacio— con evidencia de la UI real; usar cuando el usuario pida revisar/mejorar la estética de una vista, sidebar, modal o panel, o diga que algo se ve viejo, apretado, desaprovechado o incómodo. No sustituye a `estilo-ui` (controles nativos) ni a `traducciones-ui` (textos).
---

# Diseño visual — crítica y corrección

Propósito: pasar de «se ve raro» a una crítica concreta y a un diff pequeño que mejore la interfaz **sin romper temas, tamaños táctiles ni comportamiento**. Esta skill **revisa y reporta**; solo cambia código de aplicación si el usuario lo pide explícitamente.

> **Origen:** creada el 2026-11-26 a petición del usuario, durante la revisión del espaciado de la sidebar izquierda. Complementa `estilo-ui` (selectores, fechas y foco) y `traducciones-ui` (es/en/zh).

## 1. Reglas críticas (leer primero)

1. **Criticar con evidencia:** abre la vista en el navegador integrado (skill `browser`) o toma el DOM con `evaluate`; describe qué mide (px, gap, scrollHeight) antes de proponer. Nada de juicios sin captura o número.
2. **La intuición no basta:** una queja de «poco espacio» puede ser `overflow:hidden`, `max-height` fijo, `fit-content` sobreestimado o un flex-item que se comprime. Identifica la causa antes de tocar CSS.
3. **Cambio mínimo y reversible:** toca solo el selector implicado. Prefiere una variable `--ls-*` nueva o reutilizada antes que números sueltos repetidos. No «limpies» archivos vecinos.
4. **Un solo sistema de coordenadas:** si un overlay mide la imagen y la máscara mide el contenedor, alinea primero las cajas; no compensar con offsets mágicos.
5. **No romper la plataforma:** revisa `body.mobile-full-editor`, `@container` de la sidebar, `data-theme="light"` y los estilos visuales `lino`/`dracula`. Un cambio que solo funciona en tema oscuro no está terminado.
6. **Objetivos táctiles:** botones de al menos 28–44 px; el scroll debe seguir funcionando con rueda y con dedo donde corresponda (`touch-action`).
7. **Si el cambio es visible para el usuario**, aplica también `guia-de-uso` y `traducciones-ui` cuando haya textos o flujos nuevos.

## 2. Checklist de revisión

1. **Encuadre:** ¿qué vista y qué superficie (escritorio, APK editor completo, APK repaso)? ¿Se usa `style.css`, `mobile.css` o ambos?
2. **Medir:** tamaño del contenedor y de sus hijos, `clientHeight` vs `scrollHeight`, `gap`, `padding`, `overflow`, `max-height`, `touch-action`. Anota los valores actuales.
3. **Diagnosticar:** clasifica el problema en densidad (too apretado), jerarquía (todo al mismo nivel), alineación (orígenes distintos), recorte (contenedor que no crece) o distribución (hueco desaprovechado).
4. **Proponer:** una o varias reglas CSS con tokens existentes; si hace falta una variable nueva, defínela en `:root` (`style.css`) y úsala también en `material-aero.css` si esa capa sobreescribe el selector.
5. **Verificar en los cuatro escenarios:** tema oscuro, tema claro, `data-visual="lino"`/`dracula`, y móvil. Repite la medida del paso 2.
6. **Cerrar:** `npx tsc --noEmit`, `npm test`, `git diff --check`. Guarda el diff en la checklist externa de la fase (`~/Descargas/`).

## 3. Patrones que ya funcionan en este repo

| Necesidad | Solución probada |
| --- | --- |
| Diálogo grande con contenido largo | `display:grid` con fila `minmax(0,1fr)` y `overflow:auto` solo en el cuerpo (ver editor de oclusión y editor de tarjeta). |
| Imagen con scroll interno | viewport con `overflow:auto` + `touch-action:pan-x pan-y`; el stage se ajusta al tamaño real de la imagen. |
| Ocultar controles en móvil | `body.mobile-full-editor <selector> { display:none }` con ID para ganar especificidad sobre `material-aero.css`. |
| Espaciado coherente de la sidebar | tokens `--ls-sidebar-*` en `:root` y `calc()` en las `@container`; la capa Aero reutiliza el token. |
| Toolbars agrupadas | una sola fila con `overflow-x:auto`, separadores por contexto y botones de 28–44 px (ver `createTableToolbar`). |
| Desplegable que no trunca | `.search-results-dropdown` crece con el viewport (`max-height: min(70vh, 520px)`; en landscape ancho `width: clamp(320px, 30vw, 440px)` y superposición con sombra). El fragmento envuelve hasta 4 líneas con `--ls-search-snippet-max-height` y ofrece «Ver bloque completo»; **no** usar `white-space:nowrap` + ellipsis para texto de apoyo. |
| Sidebar: fijadas y estado vacío | Las fijadas se distinguen por negrita + icono de acento, **no** por el color del texto: `.sidebar-pinned .vault-tree-page-label` hereda el color de `.nav-item` (antes tenía `color:var(--ls-accent)` y `opacity:0.6`). Sin fijadas ni recientes, `.sidebar-empty-hint` da una pista en vez de dejar un hueco mudo. |
| Actividad anual | Si la cuadrícula tipo GitHub se considera demasiado convencional, una **serpiente de 12 filas mensuales** (`buildReviewHeatmapSnake`) mantiene un cuadrito por día pero añade curvas en los extremos; el 29 de febrero se marca con `data-leap`. Referencias consultadas: *Year in Pixels* (12×31) y *serpentine/snake timeline* (amCharts, Vega). |
| Árbol de progreso | Para dar profundidad sin sobrecargar el acento, el fondo usa átomos difusos y un campo con `--ls-text-muted` a 4–28 % de opacidad (`renderAtomBackdrop`), fuera del grupo escalado y con `aria-hidden`. Las tres variantes (protón, elemento, molécula) comparten el mismo `<g transform="scale(1.18)">`. |

## 4. Errores frecuentes a evitar

- Subir `max-height` sin dar `overflow:auto`: el contenido sigue recortado.
- Añadir `padding` a un flex-item sin `min-height:0`: el item no se encoge y empuja a los hermanos.
- Medir `offsetX/offsetY` en un contenedor transformado: usar `getBoundingClientRect()` de la imagen pintada.
- Dejar un `<select>` nativo o un color hexadecimal nuevo en un control: ver `estilo-ui`.
- Añadir texto nuevo sin `data-i18n` y sus entradas en es/en/zh: ver `traducciones-ui`.
- Usar un selector descendiente que alcance HTML generado: `.search-dropdown-content strong` ponía en `display:block` las negritas del Markdown del snippet (una palabra por línea). El título se selecciona con `> strong` para no afectar al contenido.
- Cambiar `touch-action:none` en un área de dibujo sin ofrecer otra forma de desplazarse.

## 5. Verificación final

- [ ] La crítica cita selectors y medidas reales (antes/después).
- [ ] El diff usa tokens `--ls-*` y no colores fijos nuevos.
- [ ] Comprobado en tema claro/oscuro y en móvil cuando aplica.
- [ ] `npx tsc --noEmit`, `npm test`, `git diff --check` en verde.

## Referencias

- Tokens y componentes: `src/style.css` (`:root`, sidebar, diálogos), `src/material-aero.css`, `src/theme-lino.css`, `src/theme-dracula.css`.
- Índice técnico y mapa de vistas: skill `estructure`.
- Navegador y capturas: skill `browser` y skill `verificacion-manual`.
- Controles específicos: skill `estilo-ui`; textos: skill `traducciones-ui`.
