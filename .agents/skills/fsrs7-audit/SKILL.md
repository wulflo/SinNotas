---
name: fsrs7-audit
description: Revisar que el repaso FSRS-7 de SinNotas funcione correctamente —34 pesos, cotas de retención y pasos, intervalos fraccionarios, vencimientos, lectura/escritura de propiedades y deshacer—; usar al tocar fsrs.ts, fsrs-settings.ts, flashcards-manager.ts o al auditar programación de repasos.
---

# Auditoría FSRS-7 — SinNotas

Propósito: verificar que el algoritmo y su persistencia sigan siendo correctos. **Revisa y reporta**; no cambies el motor salvo petición explícita y test que demuestre el fallo.

## 1. Mapa

| Archivo:símbolo | Responsabilidad |
| --- | --- |
| `src/editor/fsrs.ts` — `FSRSEngine`, `nextInterval`, `computeDueDate`, `formatInterval`, `previewRatings` | Motor FSRS-7 y vectores dorados |
| `src/editor/fsrs-settings.ts` — `normalizeFSRSParameters`, `parseLearningSteps` | 34 pesos, retención, pasos y validación |
| `src/views/flashcards-manager.ts` — `parseBlockFSRS`, `readScheduleSnapshot`, `updateBlockFSRS`, `applyScheduleSnapshot`, `rate`, `readProperty`, `stripScheduledProperties` | Lectura/escritura de programación en Markdown |
| `src/store/review-progress.ts` — `record`, `commitUndo`, `commitRedo` | Diario y deshacer/rehacer |
| `src/desktop.ts` — `applyFSRSRating`, `findReviewCardBlock`; `src/mobile/review-app.ts` — `rate` | Flujo de calificación en escritorio y APK |
| `src/editor/flashcard-target.ts` — `resolveCardTargetIds`; `src/desktop.ts` — `cardTargetIds`, `createBasicCardFromSelection`, `deleteFlashcardsInSelection` | Atajos `Alt+R`/`Alt+T`: resuelven el bullet objetivo (selección → cursor → foco) y evitan duplicar `#card` en bullets que ya generan tarjeta |

## 2. Invariantes que deben cumplirse

1. **34 pesos**: `FSRS7_DEFAULT_WEIGHTS` y `clipFSRS7Parameters` recortan valores fuera de rango; `normalizeFSRSParameters` devuelve arrays nuevos.
2. **Cotas**: `requestRetention ∈ [0.7, 0.97]`, `maximumInterval >= 1`, pasos de aprendizaje/reaprendizaje estrictamente crecientes y `< 1` día.
3. **Números**: todo intervalo calculado es finito, positivo y no retrógrado; un `raw < 1` se conserva (minutos/horas/segundos); `raw >= 1` se redondea. `formatInterval` distingue s/m/h/d/mo/y y no muestra `24h` cuando corresponde `1d`.
4. **Fechas**: `computeDueDate` conserva la hora en fraccionales y normaliza a inicio de día local en `>= 1` día (decisión documentada).
5. **Rastro rápido**: `card-s-fast` ausente se normaliza a `0.8 · stability`; `ease-factor` se conserva pero no muta.
6. **Propiedades**: solo líneas `clave:: valor` al inicio de línea son metadatos. Un `hint` de `image-occlusions::` con `card-s:: 99` **no** debe crear programación ni romperse al escribir. CRLF no debe mezclarse con LF al guardar.
7. **Una programación por bloque**: las tarjetas de oclusión del mismo bloque comparten estado; al calificar se sincronizan todas en memoria y se registra un solo evento.
8. **Rollback**: si falla `savePage` o `record`, se revierten contenido **en disco**, estadísticas y celebración; si falla `persist` en undo/redo, se restauran el evento y las pilas.
9. **Teclas de calificación**: cuatro teclas no vacías, únicas y comparables (`normalizeRatingKeys`).
10. **Identidad**: `card.id = fc-<tipo>-<page.id>-<b-N>`; la huella ignora propiedades FSRS y espacios. No cambiarla sin migrar `.sinnotas/progress/reviews.json`.
11. **Atajos de creación/borrado**: sin selección de bullets, el objetivo es el bullet con el cursor o el enfocado; con selección gana la raíz de mayor jerarquía. No añadir `#card` si `isFlashcardBlockContent()` ya es `true` (`::`, cloze, oclusión): cambiaría la pregunta y la huella. Quitar marcadores conserva el contenido y la indentación. Los avisos están traducidos a en/zh.

## 3. Verificación automática

```bash
npx tsc --noEmit
npm test -- src/editor/fsrs.test.ts src/editor/fsrs-settings.test.ts \
  src/views/flashcards-manager.test.ts src/store/review-progress.test.ts \
  src/editor/rating-keys.test.ts src/editor/flashcard-target.test.ts \
  src/editor/flashcard-markers.test.ts
npm test
git diff --check
```

Si se tocó Rust: `cargo test --manifest-path src-tauri/Cargo.toml --lib`.

**Fuzz recomendado** (cuando se cambie el motor): estados 0–3, `S ∈ [1e-4, 36500]`, `D ∈ {1,5,10}`, `elapsed ∈ [0, 36500]`, ratings 1–4 → esperar **0** NaN/Infinity/0 y **0** vencimientos retrógrados. La auditoría F15 lo ejecutó sin fallos.

## 4. Comprobaciones manuales (app real)

1. Calificar con `1-4`, con teclas reconfiguradas, con gamepad y en modo focus; verificar que no se salta tarjeta al revelar.
2. Bloque con dos oclusiones: calificar una, cerrar y reabrir; comprobar estado compartido y deshacer.
3. Forzar fallo de escritura (`reviews.json` de solo lectura), calificar y abrir el `.md`: no debe quedar programación nueva; contadores intactos.
4. Deshacer/rehacer varias veces forzando fallo de `write_review_progress`.
5. Calificar y cambiar de bóveda inmediatamente: el evento debe quedar en la bóveda original.
6. Dos notas con el mismo título: comprobar en cuál se escribe el repaso (desktop usa `page.id`; móvil debe hacer lo mismo).
7. Editar a mano un `hint` con `card-s:: 99` y calificar: el JSON de oclusiones debe seguir siendo válido.
8. Esperar a que venza un paso corto con la pantalla de completado abierta: la tarjeta debe reaparecer sola.

## 5. NO tocar sin decisión o migración

- Pesos, `computeDueDate`, `formatInterval` y vectores dorados: están validados.
- Tolerancia de `scheduleNumbersEqual`/`scheduleDatesEqual` e inferencia de estado legacy: evitan falsos conflictos entre dispositivos.
- `cardFingerprint` (incluido `.toLowerCase()`): cambiarlo invalida el diario histórico.
- IDs de oclusión por índice de región: estabilizarlos exige migración del formato.
- Herencia dinámica de parámetros globales en mazos sin `fsrs`: es decisión de producto.

## Referencias

`docs/CHECKLIST-CONSOLIDADO.md` (bloque B), `~/Descargas/Auditoria-Recoleccion-Flashcards.md` (auditoría F15), skill `calidad-pruebas`.
