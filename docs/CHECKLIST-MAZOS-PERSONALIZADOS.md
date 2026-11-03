# Checklist: mazos personalizados de flashcards

> Registro de progreso para poder retomar la implementación si se interrumpe
> la conexión, se cierra el equipo o hay que revertir una parte.
>
> Última actualización: 2026-11-03

## Decisiones cerradas con el usuario

- [x] Un **mazo** es una selección de notas guardada con un nombre.
- [x] El mazo **Todos** existe siempre y es el estado por defecto.
- [x] Solo puede haber **un mazo activo** a la vez.
- [x] Un mazo se puede **editar**, **crear** y **eliminar** de forma independiente.
- [x] Los mazos son **por bóveda** y deben poder **sincronizarse** entre equipos.
- [x] El **mazo activo es local de cada dispositivo** (no se sincroniza).
- [x] Una nota puede pertenecer a **varios mazos**.
- [x] Los nombres de mazo son **únicos** (sin distinguir mayúsculas/acentos).
- [x] En escritorio, el mosaico y la gestión viven en **Ajustes → Flashcards → General**.
- [x] En escritorio, la vista **Flashcards** tiene un selector rápido de mazo activo.
- [x] En Android debe haber un **selector de mazos independiente** en el modo repaso.

## Arquitectura acordada

### Persistencia

- Definiciones de mazos: archivo interno del vault
  `.sinnotas/flashcards/decks.json`.
- Mazo activo: `localStorage`, con una clave distinta por ruta de bóveda.
- Compatibilidad: al activar un mazo se sigue escribiendo
  `sinnotas-flashcard-pages` con la lista de notas resuelta, para que las
  versiones antiguas de Android sigan repasando lo mismo.
- Fallback web (sin Tauri): el archivo se simula en `localStorage`, separado
  por bóveda.

### Modelo de datos

```ts
interface FlashcardDeck {
  id: string;
  name: string;
  pageTitles: string[];
  createdAt: number;
  updatedAt: number;
}

interface FlashcardDeckFile {
  version: 1;
  decks: FlashcardDeck[];
  tombstones: { id: string; deletedAt: number }[];
}
```

Las lápidas (`tombstones`) permiten que un mazo borrado en un equipo no
reaparezca al fusionar con la copia de otro equipo.

### Fusión entre dispositivos

- Al guardar se lee el archivo actual, se fusiona por `id` usando `updatedAt`
  y se escribe el resultado.
- Un `tombstone` gana si su fecha es mayor o igual que `updatedAt` del mazo.
- Al guardar se respeta lo que el usuario desmarcó: una nota visible en el
  editor que queda sin marcar se elimina del mazo. Solo se conservan las notas
  del mazo que existen en el vault pero no eran editables (por ejemplo, porque
  se quedaron sin tarjetas). Las notas borradas del vault se descartan.
- Un mazo nuevo abre con todas las notas marcadas y sin error de nombre vacío;
  el error aparece cuando el usuario escribe o intenta guardar.
- Los nombres duplicados se resuelven con sufijos `(2)`, `(3)`…
- Límites: 200 mazos, 80 caracteres por nombre, 10 000 notas por mazo,
  500 lápidas y 1 MB de archivo.

### Seguridad

- Validar todo JSON leído (versión, tipos, longitudes, duplicados).
- No usar nombres de mazo como rutas de archivo.
- Pintar nombres con `textContent`, nunca `innerHTML`.
- Backend: ruta interna fija y validada; escritura atómica; límite de tamaño.
- No guardar contenido de tarjetas ni datos sensibles en el archivo de mazos.

### Rendimiento

- Cambiar de mazo no reescanea el vault: solo aplica el filtro en memoria y
  reconstruye la cola.
- Estadísticas por nota calculadas en una sola pasada.
- Guardar solo al confirmar, no en cada checkbox.
- El árbol existente conserva búsqueda, orden, paginado y render por lotes.

## Fases

### Fase 0 — Registro y preparación

- [x] Crear este checklist.
- [x] Revisar estado de git y dejar constancia de la base de partida.
  - Base: `21a2317 chore: release v0.4.3`.
  - Sin cambios previos del usuario; solo este checklist sin seguimiento.

### Fase 1 — Backend Rust

- [x] Añadir constante `.sinnotas/flashcards/decks.json`.
- [x] Permitir esa ruta en la validación de archivos internos.
- [x] Añadir comandos `read_flashcard_decks` y `write_flashcard_decks`.
- [x] Registrar los comandos en `generate_handler!`.
- [x] Añadir pruebas de ruta permitida/rechazada y lectura/escritura.
- [x] Ejecutar `cargo test` o `cargo check` en `src-tauri`.
  - `cargo check --all-targets`: correcto.
  - `cargo test`: 87 pruebas correctas, 0 fallos.

### Fase 2 — Almacén compartido TypeScript

- [x] Crear `src/store/flashcard-decks.ts` con tipos, validación, CRUD,
  migración y fusión.
- [x] Crear `src/store/flashcard-deck-storage.ts` con lectura/escritura Tauri,
  fallback web y mazo activo local por bóveda.
- [x] Releer el archivo del vault antes de fusionar al guardar, para no pisar
  cambios sincronizados por otro dispositivo.
- [x] Conservar al guardar las notas que siguen existiendo pero no tienen
  tarjetas en ese momento; descartar las notas borradas del vault.
- [x] Añadir pruebas unitarias del modelo y de la fusión.
- [x] Añadir pruebas del repositorio con `localStorage` simulado.
- [x] Ejecutar `npm test -- flashcard-deck`.
  - `npm test`: 39 archivos y 381 pruebas correctas, 0 fallos.
  - `npm run build`: correcto.

### Fase 3 — Estadísticas de mazos

- [x] Añadir `getCardStatsByPage()` a `FlashcardsManager`.
- [x] Usar esas estadísticas en el mosaico y en Android.
- [x] Probar que los contadores respetan el filtro actual.
  - En navegador: **Todos** mostró 7 tarjetas; un mazo sin Rust Core mostró 6.
  - En Android web: un mazo con solo **Diarios** mostró `1 / 2` en el repaso.

### Fase 4 — Escritorio: HTML y estilos

- [x] Añadir selector de mazo activo en Ajustes → Flashcards → General.
- [x] Añadir mosaico `#flashcard-decks-grid` con tarjeta “Todos” y “+ Nuevo”.
- [x] Añadir nombre del mazo y casilla “Activar al guardar” al editor.
- [x] Añadir selector rápido en la cabecera de la vista Flashcards.
- [x] Estilos de mosaico, tarjeta activa y acciones.
- [x] Comprobar accesibilidad básica (foco, `aria-label`, teclado).

### Fase 5 — Escritorio: lógica

- [x] Cargar mazos al iniciar y al cambiar de bóveda.
- [x] Migrar `sinnotas-flashcard-pages` a un mazo “Selección anterior”.
- [x] Renderizar mosaico, selector y editor.
- [x] Crear mazo nuevo.
- [x] Editar mazo existente.
- [x] Eliminar mazo con confirmación.
- [x] Activar mazo y escribir el filtro de compatibilidad.
- [x] Guardar mazo y refrescar sesión si está activo.
- [x] Validar nombre vacío, duplicado y demasiado largo.
- [x] Actualizar referencias al renombrar una nota.
- [x] Mostrar aviso si el mazo no tiene notas.
- [x] Gestionar cambio de bóveda.
- [x] Recargar mazos al abrir Ajustes o la vista Flashcards.
- [x] Proteger el borrador al reabrir el mismo mazo o activarlo.
- [x] Un mazo nuevo parte con todas las notas marcadas.
- [x] Comparar los cambios sin guardar contra la selección resuelta del vault.

### Fase 6 — Android

- [x] Añadir acción independiente “Mazos” al menú de repaso.
- [x] Añadir hoja de mazos con “Todos”, mazos, activo y acciones.
- [x] Añadir botón compacto de mazos en la cabecera.
- [x] Añadir nombre del mazo y guardado al editor de notas existente.
- [x] Crear, editar, activar y eliminar mazos desde Android.
- [x] Mantener compatibilidad con `sinnotas-flashcard-pages`.
- [x] Probar en modo web móvil y revisar CSS.
  - Hoja **Mazos**, editor de nombre, casillas, crear, activar, eliminar en
    dos pasos y repaso filtrado (`1 / 2` con un mazo de una sola nota).

### Fase 7 — i18n y documentación

- [x] Añadir cadenas nuevas a `src/i18n.ts` (inglés y chino).
- [x] Actualizar `docs/SinNotas.md` con la sección de mazos personalizados.
- [x] Actualizar este checklist con el estado final.

### Fase 8 — Verificación

- [x] `npm test` — 39 archivos, 381 pruebas correctas.
- [x] `npm run build` — `tsc` + Vite correctos.
- [x] `cargo check` / `cargo test` en `src-tauri` — 87 pruebas correctas.
- [x] Prueba manual escritorio:
  - [x] Crear mazo con nombre.
  - [x] Activar/desactivar mazo.
  - [x] Editar notas y guardar (incluido desmarcar una nota visible).
  - [x] Eliminar mazo con confirmación.
  - [x] Renombrar nota incluida en un mazo y comprobar que el mazo y el
    filtro de compatibilidad migran al título nuevo.
  - [x] Reiniciar/recargar app y comprobar persistencia del mazo y del activo.
  - [x] Aislamiento por bóveda: cubierto por las pruebas del repositorio
    (clave de `localStorage` distinta por ruta); no hay selector de bóvedas
    múltiple en el fallback web.
- [x] Prueba manual Android/web móvil:
  - [x] Abrir selector de mazos.
  - [x] Activar un mazo.
  - [x] Crear/editar/eliminar.
  - [x] Repasar solo las notas del mazo.

## Archivos previstos

- `src-tauri/src/lib.rs`
- `src/store/flashcard-decks.ts` (nuevo)
- `src/store/flashcard-deck-storage.ts` (nuevo)
- `src/store/flashcard-decks.test.ts` (nuevo)
- `src/store/flashcard-deck-storage.test.ts` (nuevo)
- `src/views/flashcards-manager.ts`
- `src/desktop.ts`
- `index.html`
- `src/style.css`
- `src/mobile/review-app.ts`
- `src/mobile/mobile.css`
- `src/i18n.ts`
- `docs/SinNotas.md`

## Cómo continuar si se interrumpe

1. Abrir este archivo y mirar la última fase marcada.
2. Ejecutar `git status` y `git diff --stat` para ver los archivos tocados.
3. No borrar cambios a medias: cada fase está pensada para compilar por sí sola.
4. Comandos útiles:

```bash
npm test
npm run build
cd src-tauri && cargo check
cd src-tauri && cargo test
```

5. Si una fase falla, revisar primero:
   - que los comandos Rust estén registrados en `generate_handler!`;
   - que la ruta `.sinnotas/flashcards/decks.json` esté permitida;
   - que el JSON guardado tenga `version: 1`;
   - que el mazo activo apunte a un `id` existente.

## Registro de cambios

| Fecha | Fase | Nota |
| --- | --- | --- |
| 2026-11-03 | 0 | Checklist creado; decisiones cerradas. |
| 2026-11-03 | 1 | Backend: ruta interna, comandos y pruebas añadidas. `cargo` no disponible. |
| 2026-11-03 | 2 | Modelo, repositorio y pruebas creadas. `node`/`npm` no disponibles. |
| 2026-11-03 | 3 | Estadísticas por nota y suma por mazo. |
| 2026-11-03 | 4 | HTML y estilos de escritorio: mosaico, selector y editor. |
| 2026-11-03 | 5 | Lógica de escritorio: migración, CRUD, activación, compatibilidad y borradores. |
| 2026-11-03 | 6 | Android: hoja de mazos, botón de cabecera, editor con nombre y estilos. |
| 2026-11-03 | 7 | i18n (inglés/chino) y documentación funcional. |
| 2026-11-03 | 8 | Verificación automática superada: 380 pruebas JS, build Vite y 87 pruebas Rust. Queda la prueba visual/manual. |
| 2026-11-03 | 8 | Prueba manual de escritorio y Android web superada. Correcciones: la fusión ya no reintroduce notas desmarcadas; el error de nombre vacío no aparece al abrir un mazo nuevo; sufijos de nombre respetan el límite. Total: 381 pruebas JS. |
