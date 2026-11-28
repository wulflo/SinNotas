---
name: calidad-pruebas
description: Escribir y revisar pruebas Vitest y Rust de SinNotas, investigar bugs con hipótesis verificables y simplificar/refactorizar con diffs pequeños sin cambiar comportamiento; usar al añadir tests, depurar o limpiar código.
---

# Calidad, pruebas y depuración — SinNotas

Propósito: que cada cambio tenga una prueba que guarde una invariante real y que la depuración termine en una causa, no en un parche. **Revisa y reporta**; no cambies código salvo petición explícita.

**Origen:** adaptado y fusionado de las skills descargadas `vitest`, `rust-write-tests`, `tdd`, `debug`, `code-simplifier`, `refactor`, `rust-refactor` y `typescript` (paquete `dot-skills/.curated`). Se conservan las reglas aplicables a este repo; se descartan las de stacks que no usa (React, Next, Tailwind, Rails…).

## 1. Línea base (no dar por buena una verify antigua)

```bash
npx tsc --noEmit
npm test                 # 648 pruebas / 70 archivos en la última verificación (2026-11-28)
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked   # 109 pasan, 1 smoke de red ignorado (2026-11-28)
git diff --check
```

## 2. Vitest en este repo

- Los tests puros van junto al módulo: `src/editor/*.test.ts`, `src/views/*.test.ts`, `src/store/*.test.ts`, `src/shortcuts.test.ts`, `src/i18n.test.ts`.
- `desktop.ts` no tiene tests: antes de testear DOM, extraer la lógica a un helper puro (`tree-engine.ts`, `flashcard-markers.ts`, `shortcuts.ts` son el patrón).
- Los tests que usan DOM llevan `// @vitest-environment happy-dom` (configuración en `vite.config.ts`, dependencia en `package.json`).
- **Aislamiento:** limpiar `localStorage` en `beforeEach`; restaurar preferencias (idioma, pestaña de ajustes) en `afterEach`; `vi.restoreAllMocks()` después de cada test con spies. Nada de estado mutable compartido entre tests.
- Nombre descriptivo y patrón Arrange–Act–Assert; una aserción lógica por test; factories para datos complejos (`block()`, `page()`…).
- Cubrir el caso normal **y** el límite: vacío, duplicado, nota con `::` sin espacios, selección con padre e hijo, orden de ramas disjuntas, error de guardado con rollback.
- Invariantes de arranque: si el estado persistido puede estar vacío, probar el constructor con `localStorage.setItem(..., "[]")` además del dato corrupto (caso real: `VaultStore` + `currentPage.title` en `desktop.ts`). El test debe fallar antes del arreglo y verificar la invariante, no solo que no lance.
- La misma invariante aplica **después** de cargar: `replaceVault([])` seguido de `ensureNonEmpty()` debe dejar una nota, y una bóveda no vacía no debe provocar escrituras. Probar ambos lados.
- Si el cambio es en i18n, comprobar las tres claves (es/en/zh) con `translate()` tras `setLanguagePreference()`.

## 3. Rust (`src-tauri`)

Antes de escribir un test, responder «¿qué puede romperse?»:

1. ¿Qué invariante mantiene este código? (ruta dentro del vault, límites de render, contención de PDFs…)
2. ¿Qué caso límite la violaría? (symlink, `..`, archivo vacío, cabecera falsa, longitud extrema)
3. ¿Qué diferencia de plataforma aparecería? (separadores de ruta, sensibilidad a mayúsculas, symlinks en Windows)
4. ¿Qué podría romper un refactor futuro? (campo nuevo no serializado, cambio de orden de vencimientos)

- Comparar el objeto completo, no solo `is_ok()`; comprobar también el mensaje de error y que no se escribió fuera del vault.
- Tests de symlink bajo `#[cfg(unix)]`; en Windows se omiten si no hay privilegios.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` y `rustfmt --check`.

## 4. Depuración dirigida por hipótesis

1. Reproducir antes de investigar: buscar por símbolo/selector, no por número de línea.
2. Separar síntoma de causa; escribir esperado vs real; revisar cambios recientes (`git log`, `git blame`).
3. Una hipótesis a la vez; localizar el **dónde** antes del **por qué**; descartar lo obvio primero.
4. Búsqueda binaria sobre el código (comentar/aislar bloques) y logging estratégico de entradas/salidas.
5. Confirmar la causa con un test que falle; arreglar; volver a ejecutar la suite completa.
6. No dejar `console.log` de depuración ni rutas absolutas de esta máquina en el código.

## 5. Simplificar y refactorizar sin romper

- Conservar salidas, mensajes de error, firmas públicas y efectos secundarios (guardados, eventos, foco).
- Diff pequeño y revisable: tocar solo el código relacionado con el cambio, no «limpiar» archivos vecinos.
- Las convenciones del repo ganan sobre las mejores prácticas genéricas: estilo de `src/desktop.ts`, tokens `--ls-*`, patrón de `tree-engine.ts`.
- Rust: decidir modo **defensivo** (añadir tipo/abstracción por seguridad) frente a **ofensivo** (borrar indirección que solo reenvía). No quitar capas de seguridad; no añadir abstracciones donde no aportan.
- TS: exports con tipo explícito, evitar `await` dentro de bucles, `Promise.all` solo para operaciones independientes **y acotado** (ver skill `vault-performance-guard`).
- Frontera Tauri: construir los argumentos de `invoke` en `src/tauri/commands.ts` con tipos compartidos; un test por wrapper comprueba la forma exacta. Los `await` que mutan estado usan `isStaleMutation()` para descartar resultados obsoletos.
- Antes de terminar: `npx tsc --noEmit`, `npm test`, `git diff --check`. Si el refactor tocó Rust, también `cargo check`.

## Checklist antes de responder

- [ ] ¿La prueba verifica una invariante o solo repite el happy path?
- [ ] ¿Hay limpieza de estado y mocks entre tests?
- [ ] ¿Se reproduce el bug y se confirmó la causa con un test que fallaba?
- [ ] ¿El diff conserva errores, firmas y efectos secundarios?
- [ ] ¿Suite completa y `git diff --check` en verde?
