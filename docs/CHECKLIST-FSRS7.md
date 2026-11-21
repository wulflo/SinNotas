# Checklist — FSRS-7 (motor dual-trace) y licencias de terceros

**Estado:** Fases 0–3 implementadas y verificadas en automático; pendiente prueba manual en Tauri y Android · **Última actualización:** 2026-11-20
**Rama de trabajo:** `master`
**Documento principal:** `docs/SinNotas.md`
**Licencias:** [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md)

Este documento es el punto de reanudación si una sesión de trabajo se corta a
mitad. El plan sustituye el motor FSRS-7 de `src/editor/fsrs.ts` por el
algoritmo oficial FSRS-7 y deja constancia de las licencias de PDFium y FSRS-7.

---

## 0. Reglas de reanudación después de una interrupción

> Leer esta sección **antes** de editar cualquier archivo.

1. Ejecutar `git status --short` y `git diff --stat`.
2. Revisar el diff completo antes de tocarlo:
   `git diff -- src/editor/fsrs.ts src/editor/fsrs-settings.ts src/views/flashcards-manager.ts src/store/review-progress.ts src/desktop.ts src/mobile/review-app.ts src/i18n.ts index.html package.json`.
3. Si un archivo está sin seguimiento, leerlo entero con `sed`/`read` antes de
   escribir. No asumir que está completo.
4. Buscar restos de una ejecución cortada:
   `grep -RIn "TODO-FSRS7\|FIXME-FSRS7\|SINNOTAS-FSRS7" src src-tauri/src docs`.
5. Buscar errores de sintaxis antes de continuar:
   `npx tsc --noEmit` y `npm test`.
6. **Nunca** ejecutar `git checkout --`, `git reset --hard`, `git clean -fd`,
   ni borrar un archivo a medias. Una línea incompleta puede contener una
   firma o una decisión que no está documentada en otro sitio.
7. Si un bloque no compila, **repararlo**, no eliminarlo. Si hay que
   reemplazarlo, copiar primero el contenido sospechoso a la sección
   «Restos de interrupciones».
8. Continuar por el primer ítem con estado `[~]` o `[p]`. Si no hay ninguno,
   por el primer `[ ]` de la fase actual.
9. Marcar `[~]` al empezar un ítem y `[x]` solo después de verificarlo.
10. Antes de cambiar de fase, actualizar el estado de este documento y
    preguntar al usuario.

### Estados

| Estado | Significado |
| --- | --- |
| `[ ]` | Pendiente. |
| `[~]` | En curso en esta sesión. |
| `[p]` | Código parcial escrito; puede no compilar. **No borrar.** |
| `[x]` | Implementado y verificado. |
| `[!]` | Bloqueado; anotar el motivo y el error exacto. |
| `[?]` | Implementado pero pendiente de prueba manual. |

### Restos de interrupciones

Anotar aquí cualquier bloque incompleto que se encuentre y la decisión tomada.
Si no hay restos, dejar «Ninguno».

- Ninguno.

---

## 1. Decisiones cerradas

- **Algoritmo:** FSRS-7 oficial de 34 pesos con curva dual
  (`stability` + `stabilityFast`). No se mantiene FSRS-7 como modelo
  alternativo.
- **Implementación:** port oficial `ts-fsrs@6.0.0`, entrada
  `ts-fsrs/models/fsrs-7`. Su código declara ser un port de
  `fsrs-rs/src/model_v7.rs`, así que las fórmulas coinciden con el repo de
  referencia bajado en `/home/alonso/Documentos/Repositorios/fsrs-rs`
  (commit `9fb03928d8c8fd84f5b9df2b2f6ddc631e6cae81`, `v7.0.0-2-g9fb0392`).
- **No se integra el crate Rust `fsrs`:** el planificado es el frontend TS;
  añadir un comando Tauri obligaría a convertir todo el repaso a asíncrono.
- **Migración:** hay dos acciones en **Ajustes → Recalcular propiedades**:
  - **Convertir FSRS-4.5 a FSRS-7** conserva estabilidad, dificultad, repasos,
    lapsos y pasos; añade `card-s-fast::` como `0.8 · stability`, normaliza
    `card-state` y recalcula intervalos y vencimientos de las tarjetas en
    repaso. Es la opción recomendada si se quiere conservar el progreso.
  - **Restablecer FSRS** borra la programación y deja todas las tarjetas como
    nuevas. Es la opción más limpia si se prefiere empezar de cero.
  La guía oficial de `ts-fsrs` 6 desaconseja inventar `stabilityFast`; por eso
  la conversión es una aproximación documentada y el reset sigue siendo la
  única vía para un estado FSRS-7 exacto.
- **Compatibilidad:** mientras no se convierta ni se restablezca, las tarjetas
  antiguas sin `card-s-fast::` se normalizan a `stability · 0.8` para que sigan
  funcionando. Es la misma aproximación que aplica la conversión.
- **Pasos de aprendizaje:** se conservan los pasos cortos actuales
  (`1m 10m` / `10m`) para el retraso de la sesión. FSRS-7 también usa su
  rastro rápido intrínseco; desactivar los pasos no lo desactiva.
- **Intervalos:** FSRS-7 devuelve días fraccionarios. Los intervalos menores
  de un día se conservan fraccionarios (p. ej. `0.173 d` → 4 h) para respetar
  retenciones altas; los de un día o más se redondean (`Math.round`). Se
  conserva el máximo `maximumInterval` de la configuración.
- **Licencias:** [`THIRD_PARTY_LICENSES.md`](../THIRD_PARTY_LICENSES.md) en
  la raíz, con textos completos y versiones de PDFium y FSRS-7.
- **Node:** `ts-fsrs` 6 exige Node ≥ 24; `package.json` se actualiza desde
  `>=22.12.0`.
- La app sigue siendo MIT. Ninguna dependencia añadida es copyleft.

---

## 2. Mapa de archivos

| Ruta | Responsabilidad |
| --- | --- |
| `src/editor/fsrs.ts` | Motor FSRS-7: `FSRSEngine`, `FSRSItem`, `FSRSParameters`, pesos por defecto. |
| `src/editor/fsrs-settings.ts` | Normalización, carga y guardado de los 34 pesos y los pasos. |
| `src/views/flashcards-manager.ts` | Persistencia de `card-s-fast::`, previews, `rate`, snapshots e historians. |
| `src/store/review-progress.ts` | Diario de repasos: sanea y conserva `stabilityFast`. |
| `src/editor/fsrs.test.ts` | Vectores dorados contra `fsrs-rs` y pruebas del motor. |
| `src/editor/fsrs-settings.test.ts` | Normalización de 34 pesos. |
| `src/views/flashcards-manager.test.ts` | Persistencia, reprogramación y reset. |
| `src/desktop.ts` | Ajustes FSRS, reset y textos de repaso. |
| `src/mobile/review-app.ts` | Ajustes y badge del repaso Android. |
| `src/i18n.ts` | Cadenas ES/EN/ZH. |
| `index.html` | Panel de ajustes y etiquetas FSRS. |
| `package.json` | Dependencia `ts-fsrs` y `engines.node`. |
| `THIRD_PARTY_LICENSES.md` | Licencias de PDFium y FSRS-7. |
| `docs/SinNotas.md` | Resumen técnico y enlace a este checklist. |
| `README.md` | Enlace al checklist. |

---

## 3. Fases

### Fase 0 — Base, licencias y referencia

- [x] Crear este checklist con reglas de reanudación.
- [x] Crear `THIRD_PARTY_LICENSES.md` con PDFium (BSD-3-Clause + Apache-2.0 +
  MIT del empaquetado) y FSRS-7 (ts-fsrs MIT, srs-kit BSD-3-Clause, fsrs-rs
  BSD-3-Clause como referencia).
- [x] Confirmar que `ts-fsrs@6.0.0` publica `models/fsrs-7` y que es un port de
  `fsrs-rs/model_v7.rs`.
- [x] Generar vectores dorados con `fsrs-rs` 7.0.0 (commit `9fb0392`) para el
  estado nuevo y el estado de repaso.
- [x] Registrar la dependencia `ts-fsrs@6.0.0` y subir `engines.node` a
  `>=24`.

### Fase 1 — Motor FSRS-7 y persistencia

- [x] `FSRSItem` incluye `stabilityFast?: number`.
- [x] `defaultFSRSParams.w` son los 34 pesos FSRS-7 de `FSRS7_DEFAULT_WEIGHTS`.
- [x] `FSRSEngine` delega init, `next_state`, curva de olvido e intervalo en
  `FSRS7Algorithm`.
- [x] `nextInterval` recibe el estado completo (S, D, SF), conserva las
  fracciones menores de un día, redondea las de un día o más y aplica el
  máximo.
- [x] Los pasos de aprendizaje conservan el retraso corto y gradúan con el
  intervalo FSRS-7.
- [x] `card-s-fast::` se lee, escribe, compara y borra; `clearFSRSProgress` y
  `applyScheduleSnapshot` lo tratan.
- [x] `rescheduleFSRS` reprograma con el estado completo.
- [x] El diario de repasos (`CardScheduleSnapshot` y `sanitizeSnapshot`)
  conserva `stabilityFast`.
- [x] Pruebas doradas contra `fsrs-rs` y actualización de las existentes.

### Fase 2 — Ajustes, i18n y documentación

- [x] `normalizeFSRSParameters` valida 34 pesos finitos.
- [x] Añadir la acción **Convertir FSRS-4.5 a FSRS-7** en
  **Ajustes → Recalcular propiedades**, con confirmación y texto de ayuda.
- [x] El panel de ajustes muestra FSRS 7 y los 34 parámetros.
- [x] Cadenas ES/EN/ZH actualizadas (FSRS 7, 34 parámetros).
- [x] `docs/SinNotas.md`, `README.md`, `GUIA-DE-USO.md`, `USER-GUIDE.md` y
  `CONTRIBUTING.md` reflejan FSRS-7 y el reset.
- [x] Este checklist enlazado desde `docs/SinNotas.md` y `README.md`.

### Fase 3 — Verificación final

- [x] `npm run build` en verde.
- [x] `npm test` en verde.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --lib` en verde (sin
  cambios de Rust, pero se comprueba que el árbol sigue compilando).
- [x] Prueba manual en escritorio: crear tarjetas, repasar, deshacer y
  restablecer FSRS.
- [ ] Prueba manual en Android: repaso y ajustes.
- [x] Actualizar la tabla de archivos de `docs/CHECKLIST-MANTENIMIENTO.md`.

---

## 4. Registro

| Fecha | Fase | Cambio | Verificación |
| --- | --- | --- | --- |
| 2026-11-20 | 0 | Checklist, licencias y dependencia `ts-fsrs` 6.0.0. | `npm install`; vectores `fsrs-rs`. |
| 2026-11-20 | 1 | Motor FSRS-7 y persistencia de `card-s-fast::`. | `npm test`; `npx tsc --noEmit`. |
| 2026-11-20 | 2 | Ajustes, i18n y documentación. | `npm run build`; `npm test`. |
| 2026-11-21 | 3 | Prueba manual en escritorio: crear tarjetas, repasar, deshacer y restablecer FSRS. | vite + navegador (modo flashcards tras «Abrir el modo repaso»): nueva tarjeta creada en el editor y persistida; sesión de repaso (mostrar respuesta + rating «Bien»); «Último repaso deshecho» (Deshacer) con «Rehacer repaso» habilitado; «Restablecer FSRS» → «Aplicar recálculo» → estado «Tarjetas actualizadas: 1». |

---

## 5. Apéndice — Verificación rápida

```bash
npx tsc --noEmit
npm test -- src/editor/fsrs.test.ts src/editor/fsrs-settings.test.ts src/views/flashcards-manager.test.ts src/store/review-progress.test.ts
npm run build
cargo check --manifest-path src-tauri/Cargo.toml --lib
```

Vectores de referencia (`fsrs-rs` 7.0.0, commit `9fb0392`), retención 0.9:

| Caso | S | SF | D | Intervalo (días) |
| --- | ---: | ---: | ---: | ---: |
| Nueva · Again | 0.1104 | 0.08832 | 6.1686 | 0.00003828 |
| Nueva · Hard | 2.2395 | 1.7916 | 5.261278 | 0.59745979 |
| Nueva · Good | 3.9221 | 3.13768 | 3.530724 | 4.77772474 |
| Nueva · Easy | 11.7841 | 9.427279 | 1.0 | 53.86939240 |
| Repaso (S=10, SF=8, D=5) · Again | 2.43025088 | 0.41938692 | 9.04004192 | 0.01400643 |
| Repaso · Hard | 18.25272369 | 120.51950836 | 6.97668457 | 17.78954315 |
| Repaso · Good | 22.89891052 | 190.60226440 | 4.95229959 | 42.85027695 |
| Repaso · Easy | 22.89891052 | 206.47039795 | 2.92791510 | 74.56172943 |

`ts-fsrs` redondea `next_state` a 8 decimales; las comparaciones de las pruebas
usan tolerancia `1e-3` para absorber la diferencia entre el cálculo `f32` de
`fsrs-rs` y el `f64` de `ts-fsrs`.
