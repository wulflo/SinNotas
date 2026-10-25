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

Con el modo activo, `rate()` avanza la tarjeta en memoria y actualiza la
interfaz, pero no:

- escribe propiedades FSRS en la página;
- guarda la página;
- añade una entrada a `ReviewProgressStore`.

Las previsualizaciones y el contador siguen funcionando, así que se puede
practicar sin ensuciar el calendario ni el diario.

## Verificación

- `npx tsc --noEmit`
- `npm test -- --run` (22 archivos, 214 pruebas)
- `npm run build`
- `VITE_APP_MODE=flashcards npm run build`
- `cargo check --locked`, `cargo clippy --locked --all-targets -- -D warnings`
  y `cargo fmt --check`
- Prueba manual en navegador: activar el interruptor, calificar una tarjeta y
  comprobar que el contador avanza sin crear `sinnotas-review-progress-v1`;
  desactivarlo y comprobar que la siguiente calificación sí crea la entrada.
- Recarga con el modo activo: el interruptor conserva `aria-checked="true"` y
  el badge sigue en modo aprendizaje.
- Recarga de una tarjeta Learning: conserva `card-state:: 1` y
  `card-learn-step:: 1`, y sus previsualizaciones son `1m`, `10m` y
  graduación, no intervalos de Review.
