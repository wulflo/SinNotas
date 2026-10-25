# UI de repaso, tipografía y atajos (2026-10-25)

## Acceso al repaso

- El botón de emoji que vivía en el pie de la barra lateral se eliminó.
- El acceso ahora es una tarjeta destacada **encima del buscador**, con icono
  SVG de tarjetas en el color de acento, etiqueta y flecha.
- En la build de repaso, el botón equivalente para volver desde el editor
  completo usa la misma tarjeta y queda en el mismo lugar.
- Los botones se ocultan según la superficie (`desktop-review-only` y
  `mobile-editor-only`), igual que antes, sin duplicar accesos en el pie.

## Menú de repaso

Se reemplazaron los emojis del menú por iconos SVG de trazo, todos en
`var(--mobile-accent)`:

- Tarjetas para **Repaso**.
- Lista/documento para **Repasar notas**.
- Lápiz para **Abrir páginas y editor**.
- Controles deslizantes para **Ajustes**.

También se unificaron con SVG los iconos de deshacer/rehacer, cerrar,
tema claro/oscuro y el check de “Todo al día”. Los tamaños acompañan
`--mobile-font-scale` para no quedar diminutos con el texto grande.

## Tipografía por defecto

La interfaz parte de **15 px** (antes 24/26 px). La escala global conserva la
base histórica de 13 px, así que el valor por defecto deja la escala en
~1.15×, no en 2×:

```ts
mobileFontScale(13) === 1;
mobileFontScale(15) ≈ 1.1538;
```

`applyFontSizes` publica la misma escala en `--ls-font-scale` (escritorio) y
`--mobile-font-scale` (repaso).

El texto de las tarjetas de repaso no usa la escala global: se expresa en
múltiplos (`em`) de `--ls-font-size-ui`, de modo que sea más grande que la
interfaz sin inflar los controles:

| Medida | Por defecto | Con UI 15 px |
| --- | --- | --- |
| Pregunta de tarjeta | 2.4em | 36 px |
| Respuesta de tarjeta | 2em | 30 px |

- `applyFontSizes` publica `--ls-flashcard-question-em` y
  `--ls-flashcard-answer-em` como números sin unidad; el CSS hace
  `calc(var(--ls-font-size-ui) * var(--ls-flashcard-question-em))`.
- Los deslizadores van de 1.5em a 3em (paso 0.1) y muestran la unidad `em`.
- La interfaz sigue siendo configurable entre 11 y 40 px (escala ~0.85–3×).

### Migración de valores guardados

- Una marca `sinnotas-font-defaults-version=2` migra una sola vez los defaults
  históricos de interfaz 24/26 px a 15 px. Cualquier otro valor personalizado
  se conserva.
- Los tamaños de tarjeta guardados en píxeles se convierten a `em` con
  `(px × 2) / 15`, que reproduce el tamaño efectivo anterior con escala 2.

### Ajustes sin solapamientos

- `.settings-tab-panel > *` usa `flex: 0 0 auto` para que el panel con scroll
  no comprima las filas hasta su `min-height` (era la causa de que las
  etiquetas grandes se dibujaran sobre la sección siguiente).
- `.settings-row` permite `flex-wrap`; las etiquetas y el grid de tipografías
  usan `minmax(0, …)`, `overflow-wrap` y alturas mínimas para crecer en
  vertical en vez de desbordar.
- El selector «Tipografía del sistema» queda fuera de la regla
  `.settings-row > select` para no heredar el `flex-basis` de 220 px en una
  columna (lo estiraba a 220 px de alto).

## Cambio de sección sin retardo

- `switchView()` ya no reaplica `view-entering`: el panel se muestra al
  instante y desaparece el reflow forzado (`void element.offsetWidth`) de
  `replayAnimation`.
- Las pestañas de Ajustes tampoco reaplican `is-section-entering`.
- Se conservan las animaciones de menús, apertura/cierre del overlay de
  Ajustes y cierres diferidos, que sí necesitan reiniciarse.
- Medición en navegador (Chromium, esperando 2 frames): todos los cambios de
  vista y de pestaña de Ajustes terminan en ~33 ms, sin los picos de
  98–154 ms medidos antes en WebKitGTK.


## Separadores de tarjeta básica

- Móvil vertical: `border-top: 4px solid var(--mobile-accent)`.
- Móvil horizontal: `border-left: 4px solid var(--mobile-accent)`.
- Escritorio: `.card-answer` usa `4px solid var(--ls-accent)`.
- Cloze revelado: sin separador, porque solo se muestra la respuesta.

## Enter para salir de una jerarquía

En el editor de escritorio, Enter al final de un bullet sigue este flujo:

1. **Primer Enter:** crea el bullet nuevo (hijo o hermano según el bullet
   actual). Es el comportamiento previo.
2. **Segundo Enter:** si el bullet nuevo sigue vacío y es anidado, lo
   desindenta un nivel sin mover hijos.
3. **Tercer Enter:** crea otro bullet en ese nivel, en lugar de desindentar
   otra vez.

La lógica pura vive en `enterAtEnd` (`src/editor/tree-engine.ts`) y el estado
de “ya desindentado” se conserva en `desktop.ts` solo mientras el foco siga en
ese bullet vacío. Se limpia al escribir, usar otra tecla o dividir el bloque en
medio.

## Verificación

- `npx tsc --noEmit`: OK.
- `npm test`: 189 pruebas en 21 archivos, todas en verde.
- `npm run build`: OK (escritorio y `VITE_APP_MODE=flashcards`).
- Navegador (1000×700): interfaz a 15 px; pregunta 36 px y respuesta 30 px.
  Con UI 30/40 px no hay filas solapadas, texto recortado ni contenido que
  invada la columna de herramientas; las palabras largas de la tarjeta se
  parten con `overflow-wrap: break-word`.
- El selector «Tipografía del sistema» mide 37 px de alto a UI 15 y 64 px a
  UI 40 (antes quedaba estirado a 220 px).
- Cambio de vista y de pestaña de Ajustes: ~33 ms por cambio.
- Secuencia Enter comprobada en árbol real: primer Enter crea hermano anidado,
  segundo lo desindenta y tercero crea un hermano en el nivel desindentado.
- La compilación/validación visual de la APK queda en CI: esta máquina no tiene
  Android SDK ni dispositivo/emulador.
