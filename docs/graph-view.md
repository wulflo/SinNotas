# Arquitectura y mantenimiento de la vista de grafo

> Estado: vigente (2026-10-24). Refleja el comportamiento tras los commits
> `1135ec3`, `641e08b` y `c1eb64b`, más los ajustes configurables de nodos,
> enlaces, etiquetas, fuerzas y grupos de color. Si vas a modificar
> `src/views/graph-view.ts`, `src/views/graph-physics.ts` o
> `src/views/graph-settings.ts`, **lee este documento antes** y ejecuta el
> banco de pruebas al final.

## Archivos implicados

| Archivo | Rol |
| --- | --- |
| `src/views/graph-view.ts` | Vista canvas: coordenadas, interacción (click/drag/pan/zoom/marquee), render, selección, colores, ciclo de datos |
| `src/views/graph-physics.ts` | Física pura: repulsión (O(n²) o Barnes-Hut), colisión, resortes, atracción al centro, integración y decaimiento de alpha |
| `src/views/graph-settings.ts` | Tipos, valores por defecto, validación/rangos, persistencia y reglas de color por nombre |
| `src/views/graph-physics.test.ts` | 20 pruebas unitarias de la física |
| `src/views/graph-settings.test.ts` | 9 pruebas de normalización, persistencia, migración v2 y prioridad de colores |
| `src/views/graph-labels.test.ts` | 7 pruebas del fundido de etiquetas según zoom |
| `graph-harness.html` + `src/dev/graph-harness.ts` | Banco de pruebas en vivo (17 gestos reales en Chromium) |

## Ajustes configurables (Configuración › Grafo)

Los ajustes se guardan en `localStorage["sinnotas-graph-settings"]`. Todo valor
leído (incluido JSON corrupto o manipulado) pasa por
`normalizeGraphSettings()`, que rellena defaults y recorta a rangos seguros.
`GraphView.applySettings()` aplica los cambios en vivo; no es necesario
reconstruir la vista.

| Ajuste | Default | Rango | Efecto |
| --- | --- | --- | --- |
| `nodeBaseRadius` | 5 | 1–30 | Radio base de cada nodo |
| `nodePerConnectionRadius` | 0 | 0–10 | Crecimiento por conexión (0 = radios uniformes) |
| `nodeMaxRadius` | 14 | 2–60 | Tope del radio |
| `linkWidth` | 1 | 0.25–12 | Grosor de enlaces normales |
| `linkHighlightWidth` | 2 | 0.25–20 | Grosor de enlaces resaltados |
| `labelZoomThreshold` | 2 | 0.5–10 | Zoom a partir del cual las etiquetas aparecen con fundido (hover y selección siempre visibles) |
| `physics.repulsion` | 600 | 10–5000 | Repulsión inicial (se aplica como carga negativa) |
| `physics.linkStrength` | 0.55 | 0–2 | Rigidez de los resortes |
| `physics.linkDistance` | 100 | 10–500 | Distancia objetivo entre enlaces |
| `physics.centerStrength` | 0.006 | 0–0.2 | Atracción al centro |
| `physics.collisionStrength` | 1 | 0–5 | Fuerza anti-solapamiento |
| `physics.velocityDecay` | 0.5 | 0.05–0.99 | Amortiguación de velocidad |

`toPhysicsConfig()` combina estos valores con `DEFAULT_PHYSICS_CONFIG` y hace
que `minCollisionRadius` crezca con el tamaño base de los nodos.

### Migración del radio por conexión (marcador v2)

Con la migración a radios uniformes, `nodePerConnectionRadius` por defecto pasa
de 1.2 a 0. La migración se marca en
`localStorage["sinnotas-graph-settings-v2"]` y `loadGraphSettings()` escribe ese
marcador SIEMPRE en la primera carga (aunque no haya ajustes guardados) para no
pisar una elección posterior del usuario. Solo se reescribe el radio guardado
cuando vale exactamente 1.2, el antiguo valor por defecto; una elección manual
previa de 1.2 no se distingue del antiguo default y también pasa a 0.

### Cómo se aplican los cambios

- **Radios**: `applyNodeRadii()` recalcula solo `radius` de cada nodo.
- **Fuerzas**: se reconstruye `physicsConfig` y se despierta la simulación con
  un kick suave (0.3), no con `alpha = 1`.
- **Enlaces/etiquetas**: `applySettings()` pide un `requestRender()` cuando
  cambian `linkWidth`, `linkHighlightWidth` o `labelZoomThreshold`.
- **Colores**: si cambian las reglas se recalculan colores; si solo cambian
  radios o estilos visuales se repinta sin recorrer el BFS.

### Reglas de color por nombre

Cada regla tiene `name` y `color`. La comparación ignora mayúsculas y acentos
(`NFD` + eliminación de diacríticos). Si varias reglas coinciden gana la más
específica (patrón más largo); en empate, la primera de la lista.

Precedencia:

1. Color manual de la nota (`nodeColors`, persistido aparte).
2. Color de la regla de grupo que mejor coincida.
3. Color neutro/computado por tema.

Los colores manuales siguen propagándose a vecinos por BFS. Los colores de
grupo **no** se propagan: pintan solo los nodos cuyo título coincide.

### Regla de mantenimiento de la UI

El overlay de Ajustes se **quita del DOM durante el arranque**. Por eso los
controles del grafo se buscan con `document.getElementById(...)` en el momento
de usarlos y los listeners se delegan en `settingsOverlay`. No captures hijos
del overlay en constantes de módulo: quedarían `null` y los sliders/botones no
responderían (bug corregido el 2026-10-24).

## Modelo de bucles (lo más importante)

Existe **un único bucle `requestAnimationFrame`** (`GraphView.frame`) que hace
dos cosas, desacopladas:

1. **Física (opcional):** corre solo mientras `simulationRunning === true`.
   `simulateForces()` decae `alpha` y, cuando alcanza `alphaMin` o se agota el
   presupuesto duro de pasos (`maxSteps`), llama a `stopSimulation()` y la
   física queda dormida. La física avanza como máximo a 30 Hz; el render solo
   se repinta cuando hubo un paso o cuando una interacción lo pidió.
2. **Render (siempre disponible):** el render puede y debe reactivarse de forma
   independiente mediante `requestRender()`, que marca `needsRender = true` y
   programa un frame si no hay ninguno pendiente.

### Reglas de oro — el freeze de 2026-10-22/23 no debe volver

El freeze original fue causado porque `render()` solo se llamaba dentro del
bucle de física. Al asentarse la simulación (~5-8 s tras abrir la vista), el
bucle moría y **el canvas dejaba de repintar para siempre**: zoom, pan, hover,
arrastre y selección seguían recibiendo eventos pero nada se dibujaba. Cumple
estas directrices para no reintroducirlo:

1. **Nunca renderices solo dentro del bucle de física.** Todo cambio de estado
   visual debe terminar en una llamada a `requestRender()`:
   - `wheel` → `zoomAt()` + `requestRender()`
   - pan (botón central/derecho) → tras mutar `offsetX/offsetY` → `requestRender()`
   - arrastre de nodo → `requestRender()` (+ `wakeSimulation(0.12)`)
   - cambio de `hoveredNode` → `requestRender()`
   - marquee en movimiento → `requestRender()`
   - `selectNode()` / click en fondo → `selectNode(null)` ya repinta
   - `setNodeColor()` → `recomputeColors()` termina en `requestRender()`
   - `resize()` → `requestRender()` (el canvas se limpia al redimensionar)
   - `updateData()` / `settleImmediately()` → repintado tras asentar
2. **Nunca condiciones `wakeSimulation()` al valor actual de `alpha`.** Tras el
   settle, `alpha === alphaMin` y la condición `alpha > alphaMin` es falsa para
   siempre: cualquier gesto que dependa de ella no haría nada. La reactivación
   debe usar `alpha = Math.max(alpha, kick)` y solo comprobar visibilidad y
   `prefersReducedMotion`.
3. **El cuerpo del frame va en try/catch.** Un error de física no debe matar el
   bucle para siempre; se registra y se continúa (apagando la física si fue el
   paso físico el que falló).
4. **No canceles el frame pendiente al apagar la simulación.** `stopSimulation()`
   solo cambia la bandera y pide un último render; cancelar el rAF en otro punto
   puede dejar a medio ciclo un repintado ya prometido. La única cancelación
   válida es implícita: el frame se reprograma solo si hace falta.
5. **El bucle debe terminarse en reposo.** Después del settle y del último
   `requestRender` consumido, `animationFrameId === null`. Los eventos de reloj
   (`revealBatch`, debounce de color) no dependen de rAF. El test L del harness
   verifica esto (protege la batería y el CPU).

### Directrices sobre relojes y estado de interacción

- Los `setTimeout` de revelado gradual se rastrean en `revealTimeouts` y se
  limpian con `clearRevealTimeouts()` en cada `updateData()`. Si añades otro
  temporizador (debounce, reintento), rastéalo y límpialo ahí mismo.
- El ciclo de vida de un gesto izquierdo es:
  `mousedown → pressedNode/draggedNode/marquee → (mousemove opcional) → mouseup → click`.
  Reglas invariables:
  - `suppressClick` solo se activa con un gesto real (drag ≥ 3 px o marquee
    ≥ 18 px) y el `click` lo **consume sin seleccionar**.
  - `pressedNode` se limpia siempre que se consume o se aborta el gesto
    (mouseup tras drag, click suprimido, dblclick, reset de datos). Un
    `pressedNode` huérfano seleccionaba nodos equivocados en clicks posteriores.
  - El botón derecho (pan) no toca `suppressClick`: un right-click no genera
    evento `click`, y marcarlo dejaría el siguiente clic izquierdo bloqueado.
  - `mousedown` botón 0 debe restaurar `pointerStart = { x, y }` (umbral de
    arrastre); dejarlo en `null` rompe el arrastre (viajado siempre 0).
- Cambios de datos (`updateData`) resetean **todo** el estado de interacción con
  `resetInteraction()` y limpian relojes. Los nodos nuevos son objetos nuevos;
  quedarse referencias a nodos viejos (`hoveredNode`, `draggedNode`, `selectedNode`
  por identidad) es una fuente clásica de selección fantasma.

### Directrices de física

- `distSq === 0` **no puede ser un `continue` silencioso**: dos nodos con
  coordenadas idénticas quedarían pegados eternos. Usar `separateCoincident()`
  (empujón aleatorio).
- El quadtree tiene tope de profundidad (32) y fusiona como masa agregada: sin
  ese tope, coordenadas idénticas recursan infinitamente y un stack overflow
  dentro del frame mata el bucle (freeze total).
- El `alpha` de arranque solo lo fija `updateData()` (1.0). Ningún otro camino
  debe resetearlo a 1.0 (un click no debe hacer explotar el grafo; el kick de
  drag/sesión viva es 0.12–0.25).
- La colisión usa una rejilla espacial (celdas de `2 * maxRadius`): nunca
  vuelvas a comparar todos los pares. Con 1.500 nodos eran ~1,1 M pares por
  paso y la causa principal de los 4–10 FPS.
- `shouldStopSimulation()` se basa en `alpha <= alphaMin` **o** en agotar
  `maxSteps`. No vuelvas a exigir `energy < 0.01`: en grafos grandes esa suma
  nunca baja y la simulación se quedaba encendida para siempre.
- Las etiquetas aparecen con fundido a partir del zoom configurado
  (`settings.labelZoomThreshold`, `labelAlphaForZoom` en
  `src/views/graph-labels.ts`; hover y selección siempre visibles, y alpha 0 no
  llama a `fillText`). Pintar 1.500 textos por fotograma dominaba el coste del
  render.
- `revealBatch()` debe **recalcular** `this.links` filtrando `allLinks`, nunca
  hacer `push` acumulativo: cada lote volvía a añadir todos los enlaces ya
  cargados y el grafo pasaba de 4.000 a 70.000+ enlaces (física y render
  multiplicados sin aportar información).

### Colores

- `nodeColors` (Map por título) es la fuente manual persistida en
  `localStorage["sinnotas-graph-node-colors"]`.
- `colorRules` vive en `sinnotas-graph-settings`; `baseColorFor()` resuelve
  primero el color manual y después la regla de grupo.
- `computedColor` se recalcula con influencia BFS (factores 1 / 0.5 / 0.25 /
  0.125) usando índices O(1) `linksBySource/linksByTarget`. **Solo los colores
  manuales son fuentes BFS**; los grupos no tiñen a los vecinos.
- Al cambiar color en runtime, `setNodeColor()` actualiza `baseColor` (o vuelve
  a la regla de grupo si se borra) y reprograma `recomputeColors()` (debounce
  50 ms), que termina en `requestRender()`. Sin ese render explícito, el color
  no se ve hasta el siguiente movimiento (fue bug reportado).

## Historial de correcciones (referencia rápida)

| Bug | Causa raíz | Corrección | Commits |
| --- | --- | --- | --- |
| Freeze total (zoom/pan/hover/selección) tras ~5-8 s | Render solo existía dentro del bucle de física; al settle el bucle moría | Bucle unificado + `requestRender()` en cada mutation de estado visual; `stopSimulation()` pide último render | `c1eb64b` |
| Selección deja de funcionar tras varios clicks | `wakeSimulation` condicionado a `alpha > alphaMin` (falso tras settle); estados de gesto huérfanos (`pressedNode`, `suppressClick`) | `wakeSimulation` con kick `alpha = max(alpha, kick)`; limpieza exhaustiva de estado en todos los caminos | `1135ec3`, `641e08b`, `c1eb64b` |
| Click en segundo plano bloquea/barea selección posterior | `pressedNode`/`marquee` huérfanos; marquee pequeño sin limpiar | Ciclo de vida del gesto definido y limpiado en mousedown/mouseup/click/dblclick | `1135ec3`, `641e08b` |
| Arrastrar un nodo selecciona/abre preview | `suppressClick` consumía el click y aún seleccionaba lo que quedara bajo el cursor | Drag consume el click **sin seleccionar**; las < 3 px no activan `suppressClick` | `c1eb64b` |
| Arrastre de nodo muerto tras cambios | `pointerStart` reseteado a `null` en mousedown (umbral siempre 0) | `pointerStart = { x, y }` restaurado | `c1eb64b` |
| Cambio de color no visible hasta recargar | `recomputeColors()` no repintaba | `requestRender()` al final del recálculo | `c1eb64b` |
| Física puede morir por stack overflow | Nodos coincidentes exentos de todas las fuerzas (`distSq === 0 → continue`) + quadtree sin tope de profundidad | `separateCoincident()` + tope de profundidad 32 con fusión | `c1eb64b` |
| Reveals de una sesión filtrándose a otra | `setTimeout` de batches acumulados sin limpiar | `revealTimeouts` + `clearRevealTimeouts()` en `updateData()` | `c1eb64b` |
| Nodos surgían de golpe, física agresiva | Batches grandes, sin settle suave | Revelado gradual de 30 nodos/lote, `alpha` con decaimiento D3-like, `prefers-reduced-motion` → `settleImmediately()` | preexistentes, verificados |
| 4–10 FPS y física que no converge en 1.500 nodos | Colisión O(n²) + parada por energía + etiquetas de 1.500 nodos por frame | Rejilla espacial, parada por alpha/límite de pasos, física a 30 Hz, enlaces en un solo path y etiquetas selectivas | P0 rendimiento |
| Enlaces duplicados durante el revelado | `revealBatch()` hacía `push` de todo enlace ya cargado en cada lote (4.000 → 70.939) | Recalcular `links = allLinks.filter(...)` en cada lote | Benchmark 1.000 notas |

## Banco de pruebas en vivo (regresión obligatoria)

Cada vez que se modifique el grafo:

```bash
npm run dev
# abrir http://localhost:1420/graph-harness.html en un navegador
```

El harness simula gestos reales (mousedown/mousemove/mouseup/click/wheel/dblclick
sintéticos) y verifica 17 pasos: clicks alternos, click en fondo, re-selección,
**zoom y pan y arrastre DESPUÉS del settle** (la regresión principal), drag sin
selección ni estados atascados, cambio de color, hover, doble click reset, y
término del bucle en reposo. El resultado es visible en la página y en
`document.title` (`HARNESS PASS` / `HARNESS FAIL`). Todos los pasos deben estar
en verde; añade ahí pasos nuevos para cada bug nuevo que corrijas.

Complementos:

```bash
npx vitest run src/views/graph-physics.test.ts    # física pura (20 tests)
npx vitest run src/views/graph-settings.test.ts   # ajustes y colores (9 tests)
npx vitest run src/views/graph-labels.test.ts     # fundido de etiquetas (7 tests)
npm test                                           # suite completa (119 tests)
npx tsc --noEmit                                   # tipos
```

## Checklist antes de commitear cambios del grafo

- [ ] Todo handler nuevo que mute estado visual llama a `requestRender()`.
- [ ] Ninguna condición de arranque depende de `this.alpha` «actual».
- [ ] El frame no puede quedar muerto: sin `return` incondicional que evite
      reprogramar mientras `simulationRunning || needsRender`.
- [ ] Todo `setTimeout`/`setInterval` nuevo se rastrea y limpia en `updateData`.
- [ ] Físicamente: ningún `continue` por `distSq === 0` sin `separateCoincident()`.
- [ ] Un cambio de `linkWidth`, `linkHighlightWidth` o `labelZoomThreshold`
      termina en `requestRender()` (aunque no cambien las fuerzas).
- [ ] Las reglas de grupo no se añaden como fuentes BFS; los colores manuales
      siguen teniendo prioridad.
- [ ] Los controles del panel de Ajustes se consultan en tiempo de uso, no en
      constantes de módulo (el overlay se desmonta al arrancar).
- [ ] `npx vitest run` → 153/153, `npx tsc --noEmit` limpio, `npm run build` OK.
- [ ] Harness en vivo → `HARNESS PASS` (17/17) con errores de consola vacíos.
