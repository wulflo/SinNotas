# FSRS-4.5, fase de aprendizaje y modo Aprendizaje

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** fix  
**Estado:** completed

## Problema

Las tarjetas nuevas y las que fallaban podían saltar directamente a intervalos
de varios días. La causa era doble:

- El motor no distinguía de forma persistente entre `New`, `Learning`,
  `Review` y `Relearning`. Al recargar, una tarjeta en aprendizaje podía
  interpretarse como una tarjeta de repaso y mostrar intervalos largos.
- La fase de aprendizaje no seguía una transición explícita por calificación.
  Esto hacía que las previsualizaciones no coincidieran con el estado real de
  la tarjeta.

Además, faltaba una forma de practicar sin modificar el calendario FSRS ni el
diario de repasos.

## Cambios

### Motor FSRS-4.5

`src/editor/fsrs.ts` se alineó con la especificación oficial de FSRS-4.5:

- 17 pesos por defecto.
- Dificultad inicial `D0(G) = w4 - (G - 3) * w5`.
- Reversión a la media en la dificultad.
- Curva de olvido de potencia con `FACTOR = 19 / 81` y `DECAY = -0.5`.
- Estabilidad tras un fallo (`nextLapseStability`) y estabilidad tras un
  acierto (`nextRecallStability`).
- Intervalo calculado desde la retención solicitada, no desde una tabla fija.
- Intervalos legibles como `10m`, `12h`, `14d`, `1mo` y `1y`; `mo` evita
  confundir un mes con un minuto.

La fase de aprendizaje queda separada de las fórmulas de memoria:

| Estado | Again | Hard | Good | Easy |
| --- | --- | --- | --- | --- |
| Nueva | 1 min | 6 min | 10 min | Graduación FSRS |
| Learning, paso 0 | 1 min | 6 min | 10 min | Graduación FSRS |
| Learning, paso 1 | 1 min | 10 min | Graduación FSRS | Graduación FSRS |
| Review | Relearning 10 min | Intervalo FSRS | Intervalo FSRS | Intervalo FSRS |
| Relearning | 10 min | 10 min | Graduación FSRS | Graduación FSRS |

Los pasos fijos son `1 min` y `10 min` para aprendizaje, y `10 min` para
relearning. La graduación usa la estabilidad calculada por FSRS, por lo que
puede dar varios días en Good/Easy; eso es una salida normal de FSRS, no un
paso de aprendizaje.

### Corrección de Easy en Learning y Relearning

En la primera implementación, Easy desde `Learning` reiniciaba la estabilidad
a `S0(4) = w3` y Easy desde `Relearning` tomaba
`max(S0(4), nextRecallStability(...))`. Eso descartaba la memoria acumulada
durante los pasos y regalaba siempre el intervalo de una tarjeta nueva.

Ahora ambos estados aplican `nextRecallStability(...)` como cualquier acierto.
Again sigue usando `nextLapseStability(...)`; Hard y Good también usan la
fórmula de recuerdo. La transición de pasos no cambia: Easy sigue graduando de
inmediato, pero con la estabilidad que corresponde a la tarjeta.

### Alcance real de la implementación

El motor implementa las fórmulas de memoria de FSRS-4.5 y los estados
`New/Learning/Review/Relearning` con pasos fijos tipo Anki. No implementa:

- optimización/entrenamiento de los 17 pesos (se usan los valores publicados);
- fuzz de intervalos ni balanceo de carga;
- una cola intra-sesión que reencola las tarjetas de `1 min`/`10 min` cuando
  vencen; esas tarjetas vuelven a aparecer al actualizar la bóveda o en una
  sesión posterior.

Es una implementación funcional y verificable del algoritmo, no un clon
completo de Anki.

### Estado persistido

- `FSRSItem.state` y `FSRSItem.learningStep` se guardan en la nota como
  `card-state::` y `card-learn-step::`.
- `FlashcardsManager.readScheduleSnapshot` y `applyScheduleSnapshot` incluyen
  ambos campos, de modo que deshacer un repaso restaura el estado correcto.
- Las tarjetas antiguas que solo tienen `card-learn-step::` se migran a
  `Learning`. Las que no tienen ningún paso se interpretan como `Review` si
  ya tienen repasos.
- `clearFSRSProgress` elimina también `card-state::` y `card-learn-step::`.
- `ReviewProgressStore` valida `state` (solo enteros de 0 a 3) al importar el
  diario compartido.

### Modo Aprendizaje

En el menú lateral de la vista de repaso, la tarjeta **Repaso** se sustituyó
por un interruptor `role="switch"`:

- Rojo cuando está inactivo y verde cuando está activo.
- Se guarda en `localStorage` con `sinnotas-learning-mode`.
- El estado se traduce en español, inglés y chino, igual que el resto de la
  interfaz.
- El badge de la tarjeta muestra `Aprendizaje · sin guardar` mientras está
  activo.

Con el modo activo, `rate()` avanza la cola y actualiza la interfaz, pero no
modifica ni `card.fsrs` ni `card.dueDate`. Tampoco:

- escribe propiedades FSRS en la página;
- guarda la página;
- añade una entrada a `ReviewProgressStore`.

Las previsualizaciones y el contador siguen funcionando, así que se puede
practicar sin ensuciar el calendario ni el diario.

### Corrección del reinicio de la cola

La primera versión del modo Aprendizaje tenía dos fallos de sesión:

- Al activarlo no se reiniciaba la cola, así que las tarjetas ya vistas en la
  sesión no volvían a aparecer.
- `rate()` modificaba `card.fsrs` y `card.dueDate` en memoria aunque no
  guardara la página. Al desactivar el modo, esas tarjetas ya no estaban
  vencidas y desaparecían para el repaso real.

Ahora `FlashcardsManager` distingue entre la cola normal (solo vencidas) y una
cola de sesión que puede incluir todas las tarjetas:

- `setIncludeAllCards(true)` hace que los escaneos incluyan también las
  tarjetas que aún no vencen. Se usa mientras el modo Aprendizaje está activo.
- `restartWithAllCards()` reconstruye la cola con todas las tarjetas del filtro
  actual, sin cambiar el modo persistente. Se usa al activar y al desactivar el
  interruptor.
- `rate(rating, false)` avanza sin persistir ni mutar la programación. El modo
  Aprendizaje lo usa; el repaso normal sigue llamando a `rate(rating)`.

Por tanto:

- al activar Aprendizaje, la cola vuelve a empezar con todas las tarjetas;
- al desactivarlo, vuelve a empezar con todas para poder calificarlas de
  verdad en esa sesión;
- si después se actualiza la bóveda o se cambia el filtro, la cola vuelve al
  comportamiento normal de solo vencidas.

## Verificación

- `npx tsc --noEmit`: OK.
- `npm test`: 236 pruebas en 24 archivos, todas en verde.
- `npm run build` y `VITE_APP_MODE=flashcards npm run build`: OK.
- `cargo check --locked`, `cargo clippy --locked --all-targets -- -D warnings`
  y `cargo fmt --check`.
- Prueba manual en navegador (español e inglés): activar el interruptor muestra
  `1 / 7` con todas las tarjetas, aunque antes no hubiera ninguna vencida;
  calificar en modo Aprendizaje no cambia `S`, `D`, `reps` ni `due-date`; al
  desactivarlo la cola vuelve a `1 / 7` y la tarjeta conserva su programación
  para el repaso real.
- El cambio de idioma en vivo traduce el interruptor (`Learning`,
  `Aprendizaje`), su descripción, el badge y los avisos.
- Recarga con el modo activo: el interruptor conserva `aria-checked="true"` y
  el badge sigue en modo aprendizaje.
- Recarga de una tarjeta Learning: conserva `card-state:: 1` y
  `card-learn-step:: 1`, y sus previsualizaciones son `1m`, `10m` y
  graduación, no intervalos de Review.
- Las pruebas nuevas cubren `rate(..., false)`, la inclusión de tarjetas no
  vencidas, el reinicio al desactivar y Easy en Learning/Relearning.
