# Checklist — Reparaciones de la auditoría FSRS-7 (lote 2)

**Estado:** fases 1–8 implementadas y verificadas en automático; pendiente prueba manual en Tauri/Android · **Última actualización:** 2026-11-21
**Rama:** `master` (cambios sin commitear)
**Objetivo:** aplicar, **por orden**, las recomendaciones pendientes de la auditoría
FSRS-7 y añadir una capa intermedia por lotes para que los recálculos masivos no
congelen la interfaz.
**Documentos de contexto:**
[`CHECKLIST-FSRS7.md`](CHECKLIST-FSRS7.md) ·
[`CHECKLIST-FSRS7-FIXES.md`](CHECKLIST-FSRS7-FIXES.md)

> Este documento es la fuente de verdad para reanudar el trabajo. Si se corta la
> sesión o la conexión, leerlo entero y continuar por el primer ítem `[~]`,
> `[p]`, `[ ]` o `[!]`, en ese orden.

---

## 0. Reglas para reanudar

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

### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso. |
| `[p]` | Código parcial; no borrar, terminar. |
| `[x]` | Hecho y verificado. |
| `[!]` | Bloqueado; anotar el motivo. |
| `[?]` | Hecho, pendiente de prueba manual en Tauri/Android. |

---

## 1. Línea base y mapa de archivos

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

## 2. Fase 1 — Núcleo del motor (`src/editor/fsrs.ts`)

### 2.1 Pasos estrictamente crecientes y únicos

- [x] En el constructor, validar que `learningSteps` y `relearningSteps` sean
      finitos, `> 0`, `< 1` y **estrictamente crecientes**. Si no, usar los
      valores por defecto.
- [x] Copiar siempre los arrays por defecto (no compartir referencias).
- [x] Tests: pasos desordenados (`[10m, 1m]`) y duplicados (`[1m, 1m]`) caen a
      los valores por defecto; los válidos se conservan.

### 2.2 `Hard` con 3 o más pasos

- [x] `learningTransition`: en el **primer** paso, `Hard` promedia los dos
      primeros; en pasos posteriores **repite el paso actual**.
- [x] Comportamiento esperado con `1m 10m 1h`:
      - `Hard` en el paso 0 → `6m` (media de 1m y 10m).
      - `Hard` en el paso 1 → `10m` (no `35m`).
      - `Hard` en el último paso → ese mismo paso.
- [x] Tests de regresión para los tres casos.

### 2.3 Pasos de reaprendizaje vacíos

- [x] Revisar la rama `Review + Again`: si `relearningSteps` está vacío, la
      tarjeta debe **graduarse a Review** (`state 2`) con un intervalo FSRS
      positivo, no quedarse en `state 3` con intervalo `0`.
- [x] Mantener el incremento de `lapses` y el flujo normal con pasos no vacíos.
- [x] Test: `relearningSteps: []` en Review + Again devuelve `state 2`,
      `intervalDays > 0` y no deja `learningStep`.

### 2.4 Vencimientos sin hora heredada

- [x] Añadir un helper único para calcular vencimientos desde una revisión y un
      intervalo (`computeDueDate` en `src/editor/fsrs.ts`).
- [x] Para intervalos `< 1 día`, conservar la hora (pasos cortos).
- [x] Para intervalos `>= 1 día`, normalizar al **inicio del día local**.
- [x] Usarlo en `rescheduleFSRS`, `recalculateDueDate`, `updateBlockFSRS`,
      `applyScheduleSnapshot` y en las vistas previas que escriban fechas.
- [x] Tests: un repaso a las 14:10 con intervalo de 10 días vence a las
      `00:00:00` local del día correspondiente; un paso de 10m conserva la hora.

### 2.5 `formatInterval` exacto

- [x] Evitar el redondeo grueso de meses (`44d = 1mo`, `45d = 2mo`).
- [x] Usar días hasta 59 y meses con un decimal a partir de 60 días
      (`44d`, `59d`, `2mo`, `2.5mo`), manteniendo `s`, `m`, `h`, `d`, `mo`, `y`.
- [x] Tests: 44, 45, 59, 60, 76 y 365 días; conservar los casos de 35m, 4h, 12h.

---

## 3. Fase 2 — Normalización y ajustes (`src/editor/fsrs-settings.ts`)

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

## 4. Fase 3 — Reprogramación y datos legacy (`src/views/flashcards-manager.ts`)

### 4.1 Ancla explícita de reprogramación

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

### 4.2 Rastro rápido al reprogramar

- [x] Si una tarjeta en Review no tiene `card-s-fast` válido, `rescheduleFSRS`
      añade `card-s-fast:: 0.8 × stability`.
- [x] No duplicar la propiedad si ya existe.
- [x] Test: tarjeta legacy reprogramada contiene `card-s-fast` e intervalo nuevo.

### 4.3 Estado Relearning en tarjetas sin `card-state`

- [x] En `parseBlockFSRS`, `migrateLegacyFSRS` e `inferSnapshotState`, una
      tarjeta sin `card-state` que tenga `card-learn-step` y `lapses > 0` se
      infiere como `Relearning (3)`, no `Learning (1)`.
- [x] Tests para las tres rutas: lectura, conversión y snapshots antiguos.

### 4.4 Conversión legacy sin `card-s-fast`

- [x] Confirmar que `migrateLegacyFSRS` sigue añadiendo el rastro rápido y es
      idempotente.
- [x] Test adicional: una tarjeta sin `card-s-fast` pero con `card-state` se
      convierte y una segunda pasada devuelve `null`.

---

## 5. Fase 4 — Servicio por lotes (anti-freeze)

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

## 6. Fase 5 — Escritorio (`src/desktop.ts` + `index.html`)

### 6.1 Ajustes FSRS

- [x] `saveFSRSSettings` envuelto en `try/catch`; en error:
      `console.error` + estado “No se pudo guardar la configuración FSRS.”
- [x] Intervalo máximo vacío usa el valor por defecto, nunca `1`.
- [x] Validar con `parseMaximumInterval`; valor inválido muestra error y no
      guarda.
- [x] Añadir ayuda visible: el intervalo máximo es un **límite duro** y, si se
      alcanza, la retención efectiva puede ser **mayor** que la objetivo.
- [x] Textos nuevos en `src/i18n.ts` (ES/EN/ZH).

### 6.2 Recálculo por lotes

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

## 7. Fase 6 — Android (`src/mobile/review-app.ts`)

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

## 8. Fase 7 — Fuzz / reparto de carga (decisión)

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

## 9. Fase 8 — Verificación final

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

## 10. Registro

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

## 11. Decisiones y riesgos

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
