# Carga progresiva de flashcards

> Estado: vigente (2026-10-24). Documenta `src/views/flashcard-loader.ts` y su
> integración en `src/desktop.ts`. Si cambias el escaneo de tarjetas, lee esto
> y ejecuta `npx vitest run src/views/flashcard-loader.test.ts`.

## Problema que resuelve

Antes, entrar en Flashcards ejecutaba `scanVault()` de forma síncrona sobre
todas las notas. Con una bóveda grande (miles de notas y cientos de miles de
bloques) la interfaz se congelaba, no había progreso visible y el orden
`mixed` podía rebarajarse a mitad de carga.

## Diseño

`FlashcardLoader` es un intermediario entre `Vault` y `FlashcardsManager`:

1. **Escaneo por lotes**: `scanPages()` procesa un subconjunto de notas y
   devuelve tarjetas sin mutar el manager. El loader acumula resultados y cede
   el hilo con `setTimeout(0)` entre lotes.
2. **Tamaño adaptativo**: empieza con 16 notas por lote, baja hasta 4 si un
   lote tarda más de 28 ms y sube hasta 64 si tarda menos de 7 ms.
3. **Caché por identidad y versión**: guarda `{ pages, version, cards }`. La
   caché solo es válida si la referencia de `vault.getPages()` y
   `vault.getMutationVersion()` coinciden.
4. **Aplicación atómica**: el manager recibe las tarjetas con
   `setDetectedCards()` **solo al terminar** (o al usar una caché válida). Así
   no se reconstruye la cola a mitad de escaneo y se puede preservar la tarjeta
   activa.
5. **Suscriptores reutilizables**: si ya hay una carga en curso para la misma
   bóveda, `load()` se une a ella y solo actualiza orden, tarjeta a preservar y
   callbacks. Evita escaneos duplicados entre Ajustes, Repaso y Explorador.
6. **Progreso parcial**: `getCardsForDisplay()` expone las tarjetas ya
   detectadas para que el explorador muestre resultados mientras llega el resto.
7. **Cancelación**: `cancel()` invalida la generación y limpia el temporizador;
   `invalidate()` además borra la caché (cambio de bóveda, sincronización).

## Integración en la UI

- `ensureFlashcardScan()` es el único punto de entrada y activa
  `flashcardLoading` mientras no haya caché.
- Mientras `flashcardLoading` es `true`, revelar o calificar está bloqueado para
  no operar sobre una lista incompleta.
- El explorador pagina de 50 en 50, filtra con `searchText` ya normalizado y
  solo se repinta cada 350 ms durante el escaneo.
- La precarga de inicio se programa tras el primer pintado y un retraso de
  1,2 s. Si el usuario entra antes en Flashcards, esa entrada adelanta el
  escaneo y el temporizador se convierte en un no-op.
- Cambios de bóveda (`replaceVault`, sincronización, importación masiva) llaman
  a `flashcardLoader.invalidate()`.

## Invariantes que no se deben romper

- No aplicar tarjetas al manager por cada lote.
- No comparar páginas por contenido para la caché: usa referencia + versión.
- No conservar callbacks de una carga cancelada (la generación lo impide).
- No iniciar un segundo escaneo si hay uno en curso para la misma bóveda.
- Mantener `searchText` sin HTML, en minúsculas y sin acentos.

## Pruebas

`src/views/flashcard-loader.test.ts` cubre:

- aplicación atómica y progreso al terminar;
- reutilización de caché sin volver a escanear;
- rescan tras invalidar o cambiar la versión;
- bóveda vacía resuelta de inmediato;
- índice `searchText` normalizado.

También se ejecutan las 13 pruebas de `flashcards-manager.test.ts`, que cubren
el refresco incremental y la conservación de la tarjeta activa.
