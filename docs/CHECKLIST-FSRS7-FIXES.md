# Checklist — Correcciones de la auditoría FSRS-7

**Estado:** correcciones aplicadas · **Última actualización:** 2026-11-20
**Rama:** `master` (cambios sin commitear)
**Objetivo:** corregir los hallazgos de la auditoría FSRS-4.5 → FSRS-7 sin romper la
persistencia Markdown, el diario de repasos ni las tarjetas existentes.
**Documento de contexto:** [`CHECKLIST-FSRS7.md`](CHECKLIST-FSRS7.md)

> Todas las fases de código están cerradas y verificadas con `tsc` y la suite
> completa (422 pruebas / 43 archivos). Queda una sola comprobación manual
> marcada `[?]`: repasar en Tauri/Android con retención 0.97 y ver el intervalo
> en horas/minutos.

---

## 0. Cómo reanudar si se corta la sesión

1. `git status --short` y `git diff --stat`.
2. Leer este archivo entero antes de editar.
3. Ejecutar la línea base:
   ```bash
   npx tsc --noEmit
   npm test
   ```
4. Buscar el primer ítem `[~]`, `[p]` o `[ ]`. No borrar código a medias: si un
   ítem quedó `[p]`, repararlo antes de seguir.
5. Ejecutar solo los tests de la fase mientras se trabaja:
   ```bash
   npx vitest run src/editor/fsrs.test.ts \
     src/editor/fsrs-settings.test.ts \
     src/views/flashcards-manager.test.ts \
     src/store/review-progress.test.ts
   ```
6. Al terminar un ítem, marcarlo `[x]` y anotar la verificación en el registro.
7. Antes de cambiar de fase, ejecutar `npx tsc --noEmit && npm test`.
8. **No** ejecutar `git checkout --`, `git reset --hard` ni `git clean -fd`.

### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso. |
| `[p]` | Código parcial; no borrar. |
| `[x]` | Hecho y verificado. |
| `[!]` | Bloqueado; anotar el motivo. |
| `[?]` | Hecho, pendiente de prueba manual en Tauri/Android. |

---

## 1. Línea base

- [x] `npm test`: **405 pruebas / 43 archivos** en verde antes de tocar código.
- [x] `npx tsc --noEmit`: sin errores.
- [x] Confirmado que no hay base de datos de tarjetas: Markdown +
      `.sinnotas/progress/reviews.json` + `localStorage`.

---

## 2. Fase 1 — Bugs críticos

### 2.1 `nextInterval` conserva intervalos fraccionarios menores de un día

- [x] `src/editor/fsrs.ts`: eliminar `Math.max(1, Math.round(raw))`.
      Nuevo comportamiento: `raw < 1` se conserva; `raw >= 1` se redondea.
- [x] `src/editor/fsrs.ts`: actualizar el comentario de “whole days”.
- [x] `src/editor/fsrs.ts`: añadir rama de segundos a `formatInterval`
      y evitar mostrar `24h` cuando corresponde `1d`.
- [x] Tests: `src/editor/fsrs.test.ts` — intervalos de 35m, 4h, 3s, 12h y vector
      oficial Review Good.
- [x] Test existente de lapse actualizado: la graduación de Relearning ya no
      exige `>= 1` día; ahora comprueba `0 < I < 1` y texto `9h`.

**Verificación:** `npx vitest run src/editor/fsrs.test.ts` en verde.

### 2.2 Deshacer/rehacer repasos anteriores a la migración

- [x] `src/views/flashcards-manager.ts`: normalizar `stabilityFast`
      ausente como `stability * 0.8` en `scheduleSnapshotsEqual`.
- [x] Test de regresión en `src/views/flashcards-manager.test.ts`: una
      instantánea antigua sin `stabilityFast` debe ser igual a la tarjeta
      normalizada.
- [x] Test de persistencia: `updateBlockFSRS` escribe `card-s-fast`, se lee y
      `clearFSRSProgress` lo borra.

**Verificación:** `npx vitest run src/views/flashcards-manager.test.ts` en verde.

---

## 3. Fase 2 — Validación y robustez

### 3.1 Motor: recorte de pesos y retención

- [x] `src/editor/fsrs.ts`: importar `clipFSRS7Parameters` y recortar los
      34 pesos en el constructor.
- [x] Acotar `requestRetention` a `[0.7, 0.97]` y `maximumInterval` a `>= 1`
      dentro del constructor (defensa para llamadas directas).
- [x] Validar que los pasos de aprendizaje/reaprendizaje sean `< 1` día; si no,
      caer a los valores por defecto.
- [x] Test: `new FSRSEngine({ requestRetention: 1.2 })` no lanza y produce un
      intervalo finito; pesos fuera de rango se recortan y los pasos inválidos
      caen a `1m`/`10m`.

**Verificación:** `npx vitest run src/editor/fsrs.test.ts` en verde.

### 3.2 Pasos de aprendizaje < 1 día

- [x] `src/editor/fsrs-settings.ts`: `validSteps` exige `step < 1`.
- [x] `src/editor/fsrs-settings.ts`: `parseLearningSteps` rechaza `days >= 1`.
- [x] `src/editor/fsrs-settings.test.ts`: el caso `1d` ahora espera `null`.
- [x] Test: `normalizeFSRSParameters({ learningSteps: [2] })` cae a los pasos
      por defecto.

**Verificación:** `npx vitest run src/editor/fsrs-settings.test.ts` en verde.

### 3.3 `sanitizeSnapshot` con cotas

- [x] `src/store/review-progress.ts`: aceptar `stability > 0`,
      `stabilityFast > 0` y `difficulty` en `[1, 10]`; descartar el resto.
- [x] Test en `src/store/review-progress.test.ts`: valores `0`, negativos y
      `difficulty: 99` se descartan.

**Verificación:** `npx vitest run src/store/review-progress.test.ts` en verde.

### 3.4 Reprogramar tarjetas legacy sin `card-state`

- [x] `src/views/flashcards-manager.ts`: si no hay `card-state` pero sí
      `card-learn-step::`, no reprogramar (es Learning/Relearning).
- [x] Test: contenido con `card-learn-step:: 1` y sin `card-state` devuelve
      `null`.

**Verificación:** `npx vitest run src/views/flashcards-manager.test.ts` en verde.

### 3.5 `ease-factor` deja de mutar con deltas SM-2

- [x] `src/views/flashcards-manager.ts`: dejar de aplicar
      `-0.2/-0.15/+0.15`; conservar el valor para compatibilidad.
- [x] Comentario que aclare que FSRS-7 no usa `ease-factor`.

**Verificación:** tests de repaso en `flashcards-manager.test.ts` en verde.

### 3.6 Persistencia segura ante `NaN`

- [x] `updateBlockFSRS` y `applyScheduleSnapshot` normalizan `stability`,
      `difficulty` y `stabilityFast` no finitos antes de escribir Markdown.
- [x] `readScheduleSnapshot` ignora un `card-s-fast` inválido y usa `0.8·S`.

---

## 4. Fase 3 — Reset e historial

- [x] `src/desktop.ts`: corregir el texto de confirmación para decir que se
      borra la **programación** de las tarjetas, no todo el historial.
- [x] Confirmado que `clearFSRSProgress` borra `card-s-fast`, `card-state` y
      `card-learn-step` (cubierto por tests).
- [x] Decisión documentada: **no** borrar `.sinnotas/progress/reviews.json` ni
      las estadísticas automáticamente, porque el backend fusiona el diario y
      borrarlo requeriría un comando de sobrescritura destructivo. Si se quiere
      un borrado total, crear un ítem aparte con comando Rust y confirmación
      explícita.

---

## 5. Fase 4 — Documentación y CI

- [x] `docs/SinNotas.md`: sustituir los pesos de FSRS-4.5 por los de FSRS-7.
- [x] `docs/SinNotas.md`: reemplazar `nextRecallStability` por `next_stability`
      (rastro lento + rápido).
- [x] `docs/SinNotas.md`: actualizar el conteo de pruebas a 422 en 43 archivos.
- [x] `docs/CHECKLIST-FSRS7.md`: resolver la contradicción reset vs
      normalización: el reset es recomendable; si no se ejecuta, el fallback
      `0.8·S` mantiene las tarjetas funcionando pero no es FSRS-7 exacto.
- [x] `docs/CHECKLIST-FSRS7.md`: documentar que los intervalos `< 1 día` se
      conservan fraccionarios.
- [x] `.github/workflows/*.yml`: `node-version: "22"` → `"24"`
      (10 ocurrencias en 5 archivos).

---

## 6. Fase 5 — Verificación final

- [x] `npx tsc --noEmit`: sin errores.
- [x] `npm test`: **422 pruebas / 43 archivos** en verde.
- [x] `git diff --stat` revisado; no quedan tests temporales
      (`src/__audit.test.ts` eliminado).
- [?] Prueba manual pendiente en Tauri/Android: repasar una tarjeta con
      retención 0.97 y comprobar que el intervalo muestra horas/minutos.
- [x] Registro de este documento actualizado.

---

## 7. Decisiones y riesgos

| Tema | Decisión | Motivo |
| --- | --- | --- |
| Intervalos `< 1 día` | Se conservan fraccionarios; `>= 1` se redondea | FSRS-7 los devuelve y la retención 0.97 los necesita. Evita cambiar la programación de tarjetas con intervalos largos. |
| Reset obligatorio vs fallback | Se mantiene el fallback `0.8·S` y se añade la conversión no destructiva | Evita romper tarjetas antiguas; el reset sigue disponible para un estado FSRS-7 exacto. |
| Borrar diario/estadísticas al reset | No automático; solo se corrige el texto | El backend fusiona el diario; un borrado requiere un comando destructivo aparte. |
| Vencimiento al reprogramar | Se mantiene `last-reviewed + intervalo` | Conserva el significado actual y el test existente; un cambio a “desde hoy” es una decisión de producto. |
| `ease-factor` | Se conserva el campo, pero deja de mutar | Compatibilidad con tarjetas antiguas; FSRS-7 no lo usa. |
| Pasos `>= 1 día` | Se rechazan en ajustes y en el constructor | Un paso de un día dejaría la tarjeta “aprendiendo” sin actualizar el estado FSRS. |

---

## 8. Registro

| Fecha | Fase | Cambio | Verificación |
| --- | --- | --- | --- |
| 2026-11-20 | 1 | `nextInterval` fraccionario + `formatInterval` con segundos | `vitest fsrs.test.ts` |
| 2026-11-20 | 1 | Igualdad de snapshots legacy con `stabilityFast` | `vitest flashcards-manager.test.ts` |
| 2026-11-20 | 2 | Recorte de pesos, retención y pasos en el constructor | `vitest fsrs.test.ts` (15 pruebas) |
| 2026-11-20 | 2 | Pasos `< 1` día en ajustes y parseo | `vitest fsrs-settings.test.ts` |
| 2026-11-20 | 2 | Cotas de `stability`/`stabilityFast`/`difficulty` en el diario | `vitest review-progress.test.ts` |
| 2026-11-20 | 2 | No reprogramar tarjetas legacy de aprendizaje | `vitest flashcards-manager.test.ts` |
| 2026-11-20 | 2 | `ease-factor` deja de mutar | `vitest flashcards-manager.test.ts` |
| 2026-11-20 | 3 | Texto de confirmación del reset aclarado | revisión manual |
| 2026-11-20 | 4 | Pesos FSRS-7, `next_stability` y conteo de pruebas | `docs/SinNotas.md` |
| 2026-11-20 | 4 | Reset recomendado vs fallback y fracciones `< 1` día | `docs/CHECKLIST-FSRS7.md` |
| 2026-11-20 | 4 | Node 22 → 24 en los 5 workflows | `grep node-version` |
| 2026-11-20 | 5 | Verificación final | `tsc` limpio + 422 pruebas / 43 archivos |
| 2026-11-20 | 6 | Conversión FSRS-4.5 → FSRS-7 desde Ajustes | `vitest flashcards-manager.test.ts` (4 nuevas) |

---

## 9. Ampliación — Conversión FSRS-4.5 → FSRS-7

- [x] `FlashcardsManager.migrateLegacyFSRS`: detecta tarjetas sin
      `card-s-fast::` y les añade el rastro rápido `0.8 · stability`.
- [x] Normaliza `card-state` en tarjetas antiguas (Review, Learning o
      Relearning) y conserva el paso de aprendizaje.
- [x] Las tarjetas en Review recalculan intervalo y vencimiento con FSRS-7;
      las de Learning/Relearning conservan su paso y su retraso.
- [x] Conversión idempotente: las tarjetas que ya tienen un `card-s-fast`
      válido no se modifican.
- [x] Nueva opción **Convertir FSRS-4.5 a FSRS-7** en
      **Ajustes → Recalcular propiedades**, con confirmación y texto de ayuda.
- [x] Tests: Review, Learning, idempotencia y tarjetas sin datos FSRS.
- [x] Documentación actualizada (`docs/SinNotas.md` y `docs/CHECKLIST-FSRS7.md`).

**Verificación:** `npx tsc --noEmit` limpio; `npm test` **422 pruebas / 43
archivos** en verde.

**Decisión:** la conversión conserva el progreso y es la opción recomendada
cuando no se quiere perder el historial de una tarjeta. Sigue siendo una
aproximación (`0.8 · S`) porque FSRS-4.5 nunca guardó el rastro rápido; para un
estado FSRS-7 exacto hay que usar **Restablecer FSRS**.
