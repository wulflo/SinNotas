# SinNotas — guía técnica y estado

**Versión:** 0.5.10 · **Fecha:** 2026-11-28

SinNotas es una aplicación local de notas tipo outliner jerárquico. Las páginas
se guardan como Markdown dentro de una bóveda (vault). Tiene una aplicación de
escritorio completa y una APK Android centrada en el repaso de flashcards.

## Cambios en 0.5.10

- **Contratos y normalización:** adaptador tipado para `invoke` en `src/tauri/commands.ts`
  (bóveda, progreso y mazos), `normalizePage()` como único ingress de `PageData` y
  guards de epoch para descartar mutaciones asíncronas obsoletas. Se corrigió un
  contrato roto real: Rust serializa `Backlink` en `source_page` y `vault.ts`
  leía `sourcePage`.
- **Arranque y repaso:** decisiones puras extraídas a `boot-invariants.ts` para
  evitar la nota vacía hasta pulsar «+»; confirmación antes de entrar en Repaso
  desde escritorio.
- **Interfaz:** matriz de 6 estilos/temas verificada, píldora del Pomodoro con
  fondo transparente, quipu con nudos rectangulares centrados y cordel
  segmentado; grafo centrado en el canvas con bóvedas pequeñas sin romper el
  zoom/pan del usuario.
- **Seguridad:** los redirects del actualizador Android se validan contra el
  scope HTTP; escritura atómica con `create_new`; cotas de bytes en lecturas IPC
  de imágenes y notas; copiado de texto del PDF por el portapapeles nativo.
- **i18n:** textos visibles de diarios, todas las páginas y avisos de flashcards
  envueltos en `translate()`, con test de cobertura es/en/zh.

## Cambios en 0.5.9

- Omnibar: el desplegable usa el ancho disponible en pantallas horizontales y
  todo el ancho en verticales; los fragmentos se muestran en varias líneas con
  Markdown saneado, resaltado dentro de la negrita y botón «Ver bloque completo».
- Los resultados (títulos y contenido) se pintan en tandas de 10 con «Mostrar
  más», sin montar un nodo por nota de golpe; se conserva el foco del teclado.
- Sidebar: se quita el botón «Ver todas las notas» (la vista sigue en el mosaico
  de navegación), el límite de recientes sube a 20, se elimina el encabezado
  duplicado y el menú contextual de nota pasa a ser solo texto.
- «Copiar enlace [[]]» usa el portapapeles nativo de Tauri con permiso acotado,
  respaldo en web y aviso de éxito/error. Las notas fijadas mantienen el color
  del texto de las recientes.
- Arranque: la bóveda vacía (`[]` en web o carpeta vacía en Tauri) vuelve a
  tener una nota activa (`VaultStore.ensureNonEmpty`), con pruebas de regresión.
- README en inglés y español (`README.md` / `README.es.md`); skills e índice
  técnico actualizados con los nuevos símbolos y patrones.

## Cambios en 0.5.8

- Refactorización Fase 14: `desktop.ts` y `lib.rs` se dividen en módulos
  (`views/`, `ui/`, `settings/`, `review/` y `src-tauri/src/snapshots.rs` y
  `content_search.rs`) sin cambiar el comportamiento. Los comandos Tauri
  conservan sus nombres y las 51 rutas del `generate_handler!`.
- Pruebas de regresión de las referencias entre módulos y corrección del flag
  de sincronización del panel de ajustes del grafo.
- Diarios: paginación con el padding compacto que ya tenía la de Tareas.
- Oclusión de imagen: la imagen grande aprovecha el ancho de la tarjeta tanto
  en Flashcards como en la vista Review; las imágenes pequeñas conservan su
  tamaño. Ya no aparece una línea de acento vacía al revelar la respuesta.
- Botón de repaso renombrado a «Focus» y traducido al inglés y al chino.
- Traducciones: 139 textos del panel de repaso, mazos y ajustes añadidos a los
  diccionarios inglés y chino, con una prueba que impide nuevos textos sin
  traducir.
- README: se elimina el badge de release duplicado y se conserva el de versión.

## Cambios en 0.5.7

- El grafo del panel de referencias se actualiza al cambiar de nota, sin cerrar
  y volver a abrir el panel.
- «Editar tarjeta» en el repaso: básica con dos campos, cloze con minieditor del
  bullet y sus hijos (indentación incluida) y oclusión con editor responsive;
  disponible también en la superficie de repaso/APK.
- Escritura y SAF: imágenes de oclusión legibles con bóveda SAF en Android,
  diario de repasos serializado y JSON corrupto detectado, permiso persistente
  no fatal y scope del asset protocol revocado al cambiar de bóveda.
- Android: herramientas de la nota debajo del título en pantallas angostas y
  botón de colapsar la sidebar sin recorte.
- Panel de referencias: botón para ver las notas 1/2 completas, con scroll de la
  sección en vez de un visor interior truncado.
- Notas semilla actualizadas: cloze con resaltado `==...==` y contenido actual.
- Grafo: halo del color de acento en vez de un anillo que tapaba la etiqueta;
  backlinks con LaTeX y wikilinks sin corchetes.
- Kanban: paginador `< x/X >`, iconos SVG que siguen el acento, borrado de
  completadas de los últimos 7/30 días y espaciado uniforme entre tarjetas.
- Mantenimiento: lógica compartida entre escritorio y APK, tests de cableado DOM
  y CSS de iconos unificado.

## Stack y estructura

- **Escritorio:** Tauri v2.
- **Backend y acceso a archivos:** Rust.
- **Interfaz:** TypeScript, HTML y CSS nativos; Vite para desarrollo y empaquetado.
- **Sin React ni Tailwind.**

Rutas principales:

| Ruta | Contenido |
| --- | --- |
| `src/desktop.ts` | Aplicación de escritorio, editor, ajustes, repaso y vistas. |
| `src/mobile/review-app.ts` | APK Android: repaso, edición de la tarjeta activa, ajustes y actualizador. |
| `src/editor/` | Modelo de bloques, parser Markdown, FSRS, oclusiones, historial y seguridad de URLs. |
| `src/views/` | Flashcards, grafo, kanban, listas virtuales y componentes de vista. |
| `src/store/` | Vault, búsqueda, progreso de repaso, selección de barra lateral y caché. |
| `src/services/` | Actualizador, utilidades de release y comprobaciones de integridad. |
| `src-tauri/src/` | Comandos Rust, sistema de archivos, caché, SAF y watcher. |
| `.github/workflows/` | CI, APK firmada y publicación de releases. |

Dentro de la bóveda, la app solo escribe datos administrados en
`.sinnotas/`: los snapshots viven en `.sinnotas/chronos/`, el diario de
repasos en `.sinnotas/progress/reviews.json` y el registro de documentos
enlazados en `.sinnotas/documents/links.json`. Las carpetas antiguas `chronos/`
y `progress/` se migran automáticamente al cargar la bóveda. El diario de
repasos conserva como máximo 4.000 entradas, 5 MB y 365 días; los repasos más
antiguos se descartan para que el archivo no crezca indefinidamente.

## Funcionalidad esencial

- Editor outliner con bullets jerárquicos, arrastre, selección múltiple, atajos,
  deshacer/rehacer y snapshots.
- Búsqueda dentro de la nota abierta con `Ctrl/Cmd+F`: resalta coincidencias,
  muestra el contador y permite saltar con `Enter`, `Shift+Enter` o las flechas.
- En notas más altas que el área visible aparecen botones flotantes para volver
  al inicio o saltar al final; se ocultan en notas cortas y respetan el scroll
  real del editor normal o dividido.
- Los bullets de una misma jerarquía conservan la alineación aunque tengan
  propiedades; el indicador de propiedades usa el espacio del handle sin
  desplazar el bullet.
- Markdown con negritas, cursivas, subrayado, resaltado, wikilinks, etiquetas,
  tablas, imágenes y tarjetas Cloze.
- Flashcards básicas, Cloze y de oclusión de imagen con FSRS-7.
- Modo Aprendizaje de práctica: reinicia la cola con todas las tarjetas y no
  modifica el estado FSRS (`rate(..., persist=false)`).
- Kanban de tareas, grafo/mapa conceptual, historial de versiones y exportación.
- Interfaz en español, inglés y chino, temas claro/oscuro y varios acentos.
- Sincronización mediante el servicio de archivos que el usuario prefiera; la
  app no impone nube propia.

## Documentos y lector PDF nativo (Fases 1–4)

- Motor **PDFium** mediante `pdfium-render` 0.9.5, cargado dinámicamente y de
  forma perezosa. No se usa PDF.js ni se descarga nada en tiempo de ejecución.
- La sección **Documentos** de la barra lateral lista la biblioteca, abre un
  documento y renderiza sus páginas como PNG. El binario no viaja por JSON:
  Tauri devuelve una respuesta binaria.
- **La importación no copia el PDF**: enlaza el archivo desde su ubicación
  original y guarda el registro en `.sinnotas/documents/links.json`. El archivo
  original nunca se modifica ni se duplica. Los PDFs que ya estén en
  `assets/pdfs/` se siguen mostrando por compatibilidad.
- Los documentos enlazados se pueden quitar de la biblioteca sin borrar el
  archivo original. Si el original desaparece, la entrada queda marcada como
  «Archivo original no encontrado».
- Límite de importación: 250 MB. Se valida la extensión, que `%PDF-` aparezca
  en los primeros 1024 bytes y, para los PDFs del vault, que la ruta esté dentro
  de la raíz.
- **Apertura explícita:** entrar en Documentos solo refresca la biblioteca; no
  abre ningún PDF automáticamente. Cada apertura, render o extracción de texto
  vuelve a validar el archivo antes de entregarlo a PDFium. Las entradas de
  `.sinnotas/documents/links.json` deben ser rutas absolutas, sin `..`, y
  resolver a un PDF real.
- **Límites de render:** 10 000 páginas por PDF, 2 400 px de ancho, 12 000 px de
  alto, 24 000 000 de píxeles y 50 000 fragmentos de texto por página. Si una
  página no cabe ni con el ancho mínimo, se rechaza con un error.
- **Rutas privadas:** el frontend recibe `relativePath` o `link:<id>`, nunca la
  ruta absoluta de un PDF enlazado.
- **Gestión de la biblioteca:** los enlaces se pueden quitar sin borrar el
  original y los PDFs copiados en `assets/pdfs/` se pueden eliminar del vault
  (solo esa carpeta). Cada enlace admite una caducidad opcional (1, 7, 30 o 90
  días; «siempre» por defecto); al caducar desaparece de la biblioteca sin tocar
  el archivo original.
- **Capa de texto seleccionable:** PDFium extrae los segmentos de texto de la
  página y el lector pinta una capa HTML transparente sobre el PNG. La selección
  se puede copiar o insertar como bullet en la nota activa con la propiedad
  `pdf-source::`.
- **Editor al lado y divisor arrastrable:** el botón «Editor al lado» muestra
  el PDF y la nota en paralelo. El divisor central se puede arrastrar para
  repartir el ancho, se ajusta con las flechas cuando tiene el foco (Mayús para
  pasos grandes), `Inicio`/`Fin` llevan a los límites, vuelve al 50 % con doble
  clic y conserva la proporción elegida en `localStorage`. La preferencia se
  mantiene entre sesiones sin afectar a otras vistas.
- **Capturas:** se puede arrastrar un rectángulo sobre la página para guardarlo
  como PNG en `assets/pdf-captures/` e insertarlo en la nota, opcionalmente
  abriendo el editor de oclusiones.
- Comandos Rust: `pdf_list`, `pdf_open`, `pdf_render_page`, `pdf_import`,
  `pdf_unlink`, `pdf_page_text`, `pdf_set_expiry`, `pdf_delete` y
  `pdf_save_capture`.
- La librería nativa vive en `src-tauri/resources/pdfium/<os>-<arch>/` y se
  obtiene con `scripts/fetch-pdfium.sh`. Los binarios no se versionan.
- **Pendiente de fases posteriores:** búsqueda, TOC, enlaces, anotaciones,
  miniaturas y pruebas con PDFs de varias columnas o texto rotado.

El plan detallado, las reglas de reanudación tras una interrupción y el estado
exacto por fase viven en la [sección A2 del checklist consolidado](CHECKLIST-CONSOLIDADO.md#a2-documentos-y-lector-pdf-nativo-pdfium).

## Bibliografía y búsqueda de metadatos

- La vista **Bibliografía** gestiona recursos con frontmatter `bib-*`, portadas
  locales o remotas validadas y notas hijas enlazadas con wikilinks saneados.
- **Búsqueda en línea:** en «Añadir recurso» se puede pegar un DOI, un ISBN-10 o
  ISBN-13, o escribir palabras clave. Los resultados se muestran en una lista y,
  al pulsar uno, rellenan el formulario sin crear la nota automáticamente.
- **Proveedores:** Crossref para DOI y artículos; Open Library para ISBN y
  libros. Sin claves API y sin Google Books en esta versión.
- **La red ocurre solo en Rust.** El frontend nunca construye URLs ni hace
  `fetch` a los proveedores: invoca el comando `bibliography_lookup`, que aplica
  HTTPS obligatorio, hosts constantes, sin redirecciones, `rustls`, timeouts
  (5 s de conexión, 12 s total), límite de 2 MiB, `Content-Type` JSON, rate
  limit de 750 ms, máximo 16 resultados y caché en memoria de 10 minutos.
- Todo texto remoto se sanea antes de mostrarse; las portadas solo se aceptan de
  `https://covers.openlibrary.org` y la CSP amplía `img-src` únicamente para ese
  host. La búsqueda es explícita, nunca en segundo plano, y el formulario manual
  sigue funcionando sin red.
- La descarga de portadas al vault queda fuera de alcance en esta versión.

El estado, el modelo de amenaza, la matriz de pruebas manuales y el punto de
reanudación viven en la [sección A3 del checklist consolidado](CHECKLIST-CONSOLIDADO.md#a3-busqueda-de-metadatos-para-bibliografia).

## FSRS y repaso

- FSRS-7 implementado en `src/editor/fsrs.ts`.
- Se usan los **34 pesos oficiales** de FSRS-7 (`ts-fsrs` 6.0.0), no una
  aproximación propia: `0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, ...`.
- Los ajustes de recálculo (pesos, retención deseada, intervalo máximo, pasos
  de aprendizaje) son **propios de cada mazo** (`FlashcardDeck.fsrs`, en
  `src/store/flashcard-decks.ts`); se editan en la sección *FSRS 7* del
  escritorio y en la hoja *Ajustes de FSRS* de Android. Los mazos sin
  configuración heredan valores por defecto (`deckFSRSSettings`); los que
  tenían configuración global legada la heredan al cargar
  (`FlashcardDeckRepository.load`).
- Recálculo masivo (**Ajustes → Recalcular propiedades**): por nota,
  `runFlashcardMaintenance` aplica el recálculo **con los ajustes del mazo que
  contiene la nota** (`resolveDeckParameters`); con `batchSize` 40, cede el
  hilo con rAF entre lotes y guarda página a página, así el dispositivo no se
  satura.
- Los menús selectores desplegables de la app usan `CustomSelect`
  (`src/views/custom-select.ts`): estilo de tema de la app (claro/oscuro y
  estilos visuales) en vez del nativo del sistema operativo.
- Fases de aprendizaje: pasos cortos de 1 min y 10 min antes de graduarse a
  repaso, para evitar intervalos iniciales irreales.
- El estado de aprendizaje se persiste; una tarjeta no vuelve a Review al
  recargar.
- En Learning/Relearning, **Easy** aplica `next_stability` sobre el rastro
  lento y el rápido de FSRS-7, sin reiniciar a `S0(4)`.
- Los intervalos se muestran en unidades legibles: `m`, `h`, `d`, `mo`, `y`.
- Migración: **Ajustes → Recalcular propiedades → Convertir FSRS-4.5 a
  FSRS-7** conserva estabilidad, dificultad, repasos, lapsos y pasos, añade
  `card-s-fast::` como `0.8 × estabilidad`, normaliza `card-state` y recalcula
  las tarjetas en repaso. **Restablecer FSRS** sigue disponible para empezar
  de cero.
- El modo Aprendizaje no guarda progreso; al activarlo o desactivarlo la cola se
  reinicia con todas las tarjetas para que ninguna quede oculta.

## Oclusión de imagen

- Las tarjetas de oclusión guardan las regiones normalizadas (`x`, `y`, `width`,
  `height` entre 0 y 1) en la propiedad `image-occlusions::`.
- En la **pregunta** se ocultan todas las regiones. La región de la tarjeta
  activa se resalta para que el usuario sepa qué debe recordar.
- En la **respuesta** se muestra únicamente la imagen limpia: no se dibujan
  máscaras, contornos ni la región activa. Antes se volvían a pintar las demás
  regiones, un remanente de cuando se enseñaban a la vez la imagen con y sin
  oclusión.
- La vista previa de las tarjetas ajusta su caja al tamaño real de la imagen
  (`width: fit-content` y `img { width:auto; max-width:100% }`). Antes la imagen
  se dibujaba con `object-fit: contain` dentro de una caja más ancha, así que las
  máscaras se escalaban contra el espacio vacío y parecían desplazadas un ~5 %
  respecto de lo que el cursor marcó.
- Al guardar se recortan las regiones al lienzo, se aplica un tamaño mínimo y se
  redondean a 4 decimales en escritorio y Android. Así el dato guardado coincide
  con el gesto y no acumula ruido de coma flotante.
- El editor móvil y el de escritorio miden siempre contra el rectángulo real de
  la imagen (`getBoundingClientRect`), que es la misma referencia usada por el
  cursor.

## Mazos jerárquicos y selector de repaso

Los títulos de las notas también son nombres de archivo. Por eso el separador
canónico de mazos es ` → ` (U+2192), válido en Windows, macOS y Linux; `::` no
es válido en un nombre de archivo de Windows. Al crear o renombrar una nota se
aceptan `::`, `->`, `=>`, `›`, `»` y `>` como alias, pero se guardan como ` → `.
Los títulos antiguos con `::` se siguen interpretando como jerarquía y, al
renombrarlos, se convierten al separador canónico.

- `Salud mental` es un único mazo.
- `Salud mental → Ansiedad → Tema 1` crea tres niveles.
- Un título sin separador sigue siendo una nota y un mazo a la vez.
- Seleccionar un mazo marca todas sus notas descendientes. La casilla muestra
  estado marcado, desmarcado o parcial.
- Los contadores de tarjetas y notas de cada mazo suman sus descendientes.
- La búsqueda conserva los ancestros de las coincidencias y los expande; no
  cambia la selección.
- El paginado muestra **20 mazos raíz visibles por página**. Un mazo y sus hijos
  nunca se separan entre páginas; los descendientes de un mazo contraído no
  ocupan filas.
- **Marcar todo** y **Ninguna** afectan a todas las notas, no solo a la página o
  a los resultados de búsqueda visibles.
- La selección persistida sigue siendo una lista de títulos exactos de notas;
  el árbol es una capa de presentación. Al renombrar una nota se migran el
  filtro y el borrador para no perder la selección.

La lógica compartida está en `src/deck-title.ts` (separadores, normalización y
saneado de nombres) y `src/views/flashcard-decks.ts` (árbol, búsqueda,
selección y aplanado). Tiene pruebas en `src/deck-title.test.ts` y
`src/views/flashcard-decks.test.ts`.

El selector **Repasar notas** de la APK y la pestaña de Flashcards de escritorio
usan el mismo criterio:

- **Anterior / Siguiente** y contador `Página X de Y`.
- La búsqueda reinicia el paginado a la página 1.
- La selección en borrador se conserva al cambiar de página, buscar, expandir o
  marcar mazos.
- La página móvil se pinta en **lotes de 8 filas por fotograma**; así cientos de
  notas no bloquean el WebView ni hacen colapsar el modal.
- Los cambios de una selección se confirman al pulsar **Guardar mazo** en
  escritorio o Android.

La lógica pura de paginado está en `src/mobile/notes-pagination.ts` y tiene
pruebas de regresión en `src/mobile/notes-pagination.test.ts`.

### Mazos personalizados

Sobre la jerarquía de títulos, un **mazo personalizado** es una selección de
notas guardada con un nombre. Sirve para preparar juegos de repaso distintos
(exámenes, asignaturas, repasos rápidos) reutilizando las mismas notas.

- Una nota puede pertenecer a varios mazos.
- Los nombres son únicos sin distinguir mayúsculas, acentos ni espacios
  sobrantes. Si la fusión entre equipos detecta un duplicado, añade `(2)`, `(3)`…
- **Todos** es un mazo virtual permanente y el estado por defecto; no se puede
  editar ni eliminar.
- Solo hay **un mazo activo** a la vez.
- Los mazos se guardan por bóveda y se sincronizan entre escritorio y Android.
- El **mazo activo es local de cada dispositivo**: no viaja con la bóveda.
- Al renombrar una nota se actualizan todos los mazos que la contenían.

Persistencia y sincronización:

- Definiciones: `.sinnotas/flashcards/decks.json` (versión 1), con `decks` y
  `tombstones`. Las lápidas impiden que un mazo borrado reaparezca al fusionar
  con la copia de otro equipo.
- Mazo activo: `localStorage`, con una clave distinta por ruta de bóveda.
- Compatibilidad: al activar un mazo se sigue escribiendo
  `sinnotas-flashcard-pages` con la lista resuelta de notas, para versiones
  anteriores.
- La selección antigua sin mazos se migra una sola vez a un mazo llamado
  **Selección anterior** con id estable.
- Al guardar se relee la copia actual del vault y se fusiona por `id` y
  `updatedAt`; una lápida gana si es igual o posterior a la última edición.
- Al guardar un mazo se conservan las notas que siguen existiendo aunque ahora
  no tengan tarjetas (el editor solo muestra notas con tarjetas). Las notas
  borradas del vault se descartan.
- Límites defensivos: 200 mazos, 80 caracteres por nombre, 10 000 notas por
  mazo, 500 lápidas y 1 MB de archivo. El backend valida la ruta interna fija y
  escribe de forma atómica.

Interfaz:

- **Escritorio:** mosaico de gestión en **Ajustes → Flashcards → General** con
  tarjeta **Todos**, tarjetas de mazos y **+ Nuevo mazo**. Incluye editar,
  eliminar y activar. La cabecera de la vista Flashcards tiene un selector
  rápido de mazo activo.
- **Android:** acción independiente **Mazos** en el menú, botón compacto en la
  cabecera y hoja de gestión con activar, editar, eliminar y crear. El editor de
  notas existente añade el nombre del mazo y el botón **Guardar mazo**.
- Cambiar de mazo no reescanea la bóveda: solo aplica el filtro en memoria y
  reconstruye la cola. Las estadísticas por nota se calculan en una sola pasada.
- Los nombres se pintan con `textContent`, nunca como HTML.

## Safe area en Android

La APK usa un puente nativo `SinNotasSafeArea` que combina `WindowInsets` con
`ViewCompat.getRootWindowInsets`. El frontend escucha los cambios y escribe las
variables CSS `--sinnotas-safe-area-*`, de modo que la barra de estado y la barra
de navegación no tapen el contenido.

La v0.2.3 corrige también el editor completo que se abre con **Abrir páginas y
editor**. Al montar esa superficie, `src/main.ts` vuelve a instalar el puente y
el CSS de `body.mobile-full-editor` aplica `--mobile-full-safe-*` a `.headbar`,
`.sidebar-left` y `.content-scroll`. La cabecera reserva la inset superior, el
cajón lateral respeta las cuatro insets y el contenido reserva la inferior; el
layout usa `100dvh` y deja que `.view-panel` crezca con flex. El modo repaso
conserva sus propias reglas en `src/mobile/mobile.css`.

El puente se inyecta con:

```bash
npm run android:patch
```

El script `scripts/patch-android-safe-area.mjs` se ejecuta después de
`tauri android init` y antes de compilar. CI siempre regenera `gen/android` y
vuelve a aplicar el parche.

## Bóveda en Android

La APK abre el selector SAF de directorios (`show_open_dir_dialog`) para que el
usuario elija cualquier carpeta accesible. El permiso de lectura y escritura se
conserva entre reinicios con `grant_persistable_dir_access`, y la representación
serializada del `DirPath` se guarda en el frontend y se pasa a `load_vault`, que
usa `SafStorage` para leer y escribir las notas.

En el modo repaso, el primer arranque sin una bóveda guardada abre el selector
automáticamente. Si el usuario cancela o el permiso ya no es válido, se muestra
una pantalla central para volver a elegir la carpeta en lugar de cargar el
directorio privado `files`. El botón **Cambiar bóveda** usa el mismo selector.
Al pasar a **Abrir páginas y editor** se conserva la raíz seleccionada, de modo
que el editor completo trabaja sobre la misma bóveda; si aún no hay ninguna,
también ofrece el selector SAF.

El directorio privado de la aplicación
(`/data/data/com.sinnotas.desktop/files`) sigue existiendo como bóveda interna
de respaldo para el modo web y para el editor cuando se cancela la selección.
Para respaldar o sincronizar una bóveda SAF se usa el servicio de archivos que
prefiera el usuario.

## Actualizador

### Escritorio

Usa el plugin nativo `updater` de Tauri. Verifica la firma minisign del paquete
y relanza la app. En Linux el manifiesto publica dos destinos:

- `linux-x86_64`: AppImage firmado. Lo usan las instalaciones AppImage.
- `linux-x86_64-deb`: `.deb` firmado con la misma clave. El plugin 2.14+ lo
  descarga, verifica la firma y lo instala con `pkexec`/`sudo`, pidiendo
  autorización. Lo usan las instalaciones Debian/Ubuntu.

La v0.2.2 es la primera release que anuncia `linux-x86_64-deb`. Por eso, una
instalación `.deb` de 0.2.0/0.2.1 debe instalar 0.2.2 manualmente una vez; a
partir de ahí las releases siguientes, como 0.2.3, se actualizan desde la app.
La firma que valida el updater es minisign, no una firma de paquete Debian.

### Android

El WebView no puede leer los assets de GitHub Releases por CORS. Por eso la APK
usa `@tauri-apps/plugin-http` para:

1. Descargar `latest.json` desde
   `https://github.com/wulflo/SinNotas/releases/latest/download/latest.json`.
2. Validar tamaño, JSON y esquema.
3. Descargar el APK de `android-aarch64`.
4. Verificar su SHA-256 contra el manifiesto.
5. Guardarlo temporalmente en la caché privada y copiarlo a
   `Descargas/SinNotas/` mediante MediaStore (`tauri-plugin-android-fs`).

Así el APK queda en el almacenamiento público de Descargas, visible para los
gestores de archivos y para el instalador de Android. No se usan permisos
legacy de almacenamiento: `minSdk 33` y MediaStore permiten escribir archivos
propios en Descargas. La instalación sigue siendo manual: la app no ejecuta ni
instala el APK.

El flujo se verificó en Android con 0.2.6 → 0.2.7: el APK quedó en
`Descargas/SinNotas/`, se abrió desde el gestor de archivos y se instaló
manualmente. Si MediaStore encuentra un nombre repetido, agrega un sufijo y la
interfaz muestra el nombre real del archivo.

**Fix 0.2.0/0.2.1:** GitHub sirve los assets de release como
`application/octet-stream`, incluso cuando el contenido es JSON. El código
anterior rechazaba cualquier `Content-Type` que no contuviera `json` y mostraba
*“La respuesta de GitHub no es un manifiesto JSON”*. Ahora no se valida esa
cabecera: mandan el límite de tamaño, `JSON.parse` y `parseReleaseManifest`.

La v0.2.0 ya instalada conserva el bug, así que hay que instalar la APK corregida
manualmente una vez. Después, el flujo de actualización funciona con releases
nuevas.

## Grafo y mapa conceptual

La vista de grafo usa un modelo de física de fuerzas propio con selección,
arrastre de nodos, paneo, zoom con rueda, doble clic para recentrar y reglas de
color por nombre. El revelado se hace por lotes para no congelar la interfaz.
El banco de pruebas interactivo está en `graph-harness.html`:

```bash
npm run dev
# abrir http://localhost:1420/graph-harness.html
```

Debe mostrar `HARNESS PASS`. Al tocar el grafo hay que ejecutar la suite y el
harness.

## Ajustes de interfaz (0.4.3)

Correcciones de solo CSS en `src/style.css`; no cambian HTML ni TypeScript.

- **Mapa conceptual:** los botones de `.concept-map-tools .btn-icon` (zoom,
  recentrar y cerrar) miden 28×28 px, un 30 % menos que los 40×40 px del
  encabezado de ajustes, y usan `calc(17px * var(--ls-font-scale, 1))`. El
  `gap` de la barra pasa a 6 px.
- **Oclusión de imagen:** el cierre del diálogo
  (`.image-occlusion-header .btn-icon`) se mantiene en 40×40 px; los botones de
  la toolbar (escalar, rotar, alinear, distribuir) usan `min-height: 40px` y
  `padding: 8px 12px`. "Guardar oclusiones"
  (`.image-occlusion-footer .btn-primary`) deja el estilo píldora y usa el
  primario canónico: `border-radius: 8px`, fondo degradado del acento, texto
  `--ls-accent-foreground`, sombra y estados hover/activo propios.
- **Tareas en modo canvas:** `--ls-kanban-card-bg` sube de `#17191f` a
  `#1e242d` y la sombra se suaviza (`rgba(0,0,0,0.15)` y `rgba(0,0,0,0.05)`)
  para que las tarjetas se distingan del fondo sin oscurecerse.
- **Flashcards:** `.flashcard-box` limita su alto a `90vh` y
  `.flashcard-content` añade `overflow-y: auto` y `scrollbar-gutter: stable`,
  de modo que la rueda del ratón hace scroll dentro de la tarjeta cuando el
  contenido excede el alto. Las flechas direccionales no cambian.

## Regresiones corregidas en repaso

- **Imágenes de tarjetas:** `review-app.ts` ya no confía ciegamente en la URL
  del protocolo `asset:`: la prueba con un `Image()` y, si no carga, lee los
  bytes con `read_image_data` y usa una URL `blob:`. Así una ruta canónica
  válida pero un protocolo de assets no disponible ya no muestra «No se pudo
  cargar la imagen de esta tarjeta». Es el mismo respaldo que ya usaba el
  editor de escritorio en `resolveDisplayImageUrl`.
- **Selector «Mazo» de la hoja FSRS:** se migra con `CustomSelect` igual que la
  acción y el ancla de recálculo, así que el menú sigue el tema de la app en
  lugar del menú nativo del sistema.
- **Rueda del ratón:** se retiró `overscroll-behavior: contain` de
  `.flashcard-content`, `.flashcard-image-scroller` y
  `.mobile-image-viewport`. Esos contenedores casi nunca desbordan; al
  contener el scroll, la rueda tampoco se encadenaba al contenedor padre y
  parecía no funcionar dentro de la tarjeta. Ahora, si el contenido desborda,
  se desplaza dentro; si no, la rueda mueve la vista o el repaso.

## Cache de metadatos y watcher

Las bóvedas locales guardan un índice binario (`.sinnotas_cache.bin`) para que
un arranque caliente solo procese notas nuevas o modificadas. Un watcher nativo
aplica cambios externos de forma incremental. El benchmark crea 5.000 notas y
compara arranque frío/caliente:

```bash
scripts/benchmark-cache.sh
# o: cargo run --release --manifest-path src-tauri/Cargo.toml --example cache_benchmark -- 5000
```

Los resultados registrados están en [BENCHMARK-2026-10-29.md](BENCHMARK-2026-10-29.md) y el seguimiento de la tarea T9 en la [sección D1 del checklist consolidado](CHECKLIST-CONSOLIDADO.md#d1-mantenimiento-y-recuperacion).

## Seguridad

- Las operaciones de archivos se limitan a la bóveda activa.
- `resolve_vault_path` rechaza `..`, rutas absolutas fuera de la raíz, bytes NUL,
  symlinks que escapan de la bóveda y URIs `content://`, `file://` o `http://`.
- El registro de documentos PDF y las capturas se resuelven con
  `resolve_vault_path`; las capturas usan `create_new` para no seguir enlaces
  existentes. Las entradas de `links.json` se validan antes de abrir.
- Documentos no autoabre PDFs. Al abrir, renderizar o extraer texto se revalida
  la cabecera `%PDF-` y el tamaño; el motor limita páginas, dimensiones,
  píxeles y fragmentos de texto.
- La API de PDF no serializa rutas absolutas: solo `relativePath`, `link:<id>`,
  `linked` y `missing`.
- Las portadas remotas de Bibliografía pasan por
  `resolveAllowedRemoteImageUrl`: solo se aceptan `http(s)` públicos y se
  rechazan hosts privados, `localhost` y URLs protocol-relative inseguras. En
  Tauri la CSP sigue bloqueando las imágenes remotas; en modo web se permite una
  URL pública validada.
- En modo web las portadas subidas se validan por magic bytes (PNG, JPEG, GIF,
  WEBP o BMP) y se rechaza SVG. Tauri acepta SVG solo si `validate_image_file`
  confirma que no tiene contenido activo. El modo web no añade CSP en esta fase
  y no se considera un entorno soportado para bóvedas no confiables.
- La búsqueda de metadatos de Bibliografía se ejecuta solo en Rust con hosts
  constantes, HTTPS, sin redirecciones, `rustls`, timeouts, límite de respuesta,
  rate limit y caché en memoria. El frontend no envía URLs ni recibe el cuerpo
  remoto; los errores usan códigos estables y el texto remoto se sanea antes de
  mostrarse.
- El portapapeles pasa por una lista blanca; nunca se inyecta HTML crudo.
- La CSP solo permite `self` e IPC. Las descargas las hacen plugins nativos.
- Android accede solo a la carpeta que el usuario autoriza mediante el selector
  SAF y conserva ese permiso; no solicita acceso global al almacenamiento.
- `allowBackup=false` en el manifiesto Android.
- La APK release se firma con la clave de release; los secretos solo existen en
  el paso de firma de CI.
- El actualizador Android verifica SHA-256 antes de ofrecer el archivo.

## Rendimiento

- Caché binaria de metadatos (`.sinnotas_cache.bin`) para arranques calientes.
- Watcher nativo para cambios externos.
- Escaneo de flashcards por lotes con caché y cancelación.
- Listas virtuales para grandes volúmenes.
- Grafo con revelado por lotes y física estable.
- Selector de notas móvil paginado y con render escalonado.
- Sin `backdrop-filter` en las superficies que ocupan toda la ventana
  (`.main-container`, `.sidebar-left`) ni en los velos de modal: el fondo que
  difuminan es un degradado suave, así que el efecto era casi invisible, pero
  obligaba a reprocesar la ventana completa en cada repintado. Medido en
  rasterización por software: escribir pasaba de ~100 fps a ~30 fps. Los
  desenfoques de superficies pequeñas (cabecera, avisos, menús flotantes) se
  mantienen.

## Requisitos y comandos

- Node.js 24 o superior.
- Rust estable.
- JDK 17 o superior para Android.
- Android SDK/NDK para compilar la APK.

```bash
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### Build Android local

```bash
npm ci
npm run tauri android init -- --ci
npm run android:patch
# La APK usa su propio logo (icon-manifest.android.json); no cambia los
# iconos de escritorio.
npm run android:icons
VITE_APP_MODE=flashcards npm run tauri android build -- --apk --debug --target aarch64
```

No hace falta Android Studio: con SDK/NDK, build-tools y un JDK alcanza. La APK
debug se firma con la clave debug y no puede actualizar una release firmada con
la clave de release.

### CI y publicación

- `.github/workflows/ci.yml`: lint/test, APK debug y APK release firmada en
  `master` o por `workflow_dispatch`. Publica artefactos, no crea releases.
- `.github/workflows/release.yml`: se dispara con tags `v*`, genera los paquetes
  de escritorio, la APK, `latest.json` y publica la release. El job Linux firma
  además el `.deb` con `tauri signer sign --app-version` y sube `.deb.sig`.
- `scripts/prepare-release-assets.mjs` exige `linux-x86_64-deb` y falla si
  falta el `.deb` o su firma, igual que con el resto de plataformas.
- El `latest.json` se genera y publica solo desde el workflow de release; un
  artefacto local de CI no actualiza el manifiesto.
- Secretos de firma Android: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
  `KEY_PASSWORD`, `KEY_ALIAS`.
- Secretos del updater de escritorio: `TAURI_SIGNING_PRIVATE_KEY`,
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### Publicar una release sin errores

El workflow de release se dispara **solo** con un tag que empiece por `v` y
compara el número del tag con **cinco** archivos. El procedimiento completo está
en [`docs/RELEASE.md`](./RELEASE.md). Para publicar la `0.5.10`:

```bash
# 1. Las cinco versiones deben ser idénticas
node -p "require('./package.json').version"
node -p "require('./src-tauri/tauri.conf.json').version"
sed -n 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' src-tauri/Cargo.toml | head -n 1
sed -n '/^name = "sin-notas"$/{n;s/^version = "\([^"]*\)".*/\1/p;}' src-tauri/Cargo.lock | head -n 1
sed -n "s/^version: '\([^']*\)'.*/\1/p" snapcraft.yaml | head -n 1

# 2. Commit y tag anotado sobre ese commit
git add -A
git commit -m "chore: release v0.5.10"
git tag -a v0.5.10 -m "v0.5.10"            # el tag SIEMPRE lleva la v

# 3. Empujar y comprobar que arrancó el workflow
git push origin master
git push origin v0.5.10
gh run list --workflow=release.yml --limit 1
```

Puntos que causan el error de “número de release distinto” o `already_exists`:

- **El tag no lleva `v`.** Un tag `0.2.8` no dispara `release.yml` (filtro
  `v*`), así que GitHub guarda una release sin artefactos y `latest.json`
  devuelve 404.
- **El tag no coincide con las cinco versiones.** El job `validate` falla antes
  de compilar. El número de `latest.json` se genera sin la `v`; no se debe
  escribir a mano.
- **La release se creó o guardó antes en la interfaz web.** Al pulsar
  *Save release* GitHub crea el tag en el commit que elija la UI, no en el
  commit local. Después, el workflow intenta publicar sobre un tag que ya
  apunta a otro sitio y falla con `already_exists` o con una release vacía.
  La release se crea **solo** dejando que el workflow la genere desde el tag.
- **Se reutiliza un tag viejo.** Si el tag ya existe en otro commit, hay que
  borrarlo en local y en remoto, volver a crearlo sobre el commit correcto y
  empujarlo con `--force`. Nunca se edita una release a mano para “arreglar”
  el número.

En la primera publicación de la v0.2.8 el tag se empujó junto con `master` y
GitHub no inició el workflow de Release; no se pudo confirmar la causa. Se
resolvió borrando el tag remoto y volviéndolo a crear sobre el commit correcto.
La comprobación con `gh run list --workflow=release.yml` es obligatoria después
de cada push: si no aparece el run, se borra el tag remoto, se vuelve a crear
sobre el commit correcto y se empuja de nuevo.

### Microsoft Store (MSIX)

La Store firma los paquetes MSIX después de la certificación, así que este
canal no necesita certificado de CA ni la clave del updater. La app se instala
en `WindowsApps` (solo lectura) y las actualizaciones las gestiona la Store;
por eso la build de tienda **no compila** `tauri-plugin-updater`.

- Workflow: `.github/workflows/store-msix.yml` (solo `workflow_dispatch`).
- Genera un `.msix` sin firmar como artifact de Actions; no toca GitHub
  Releases ni `latest.json`.
- Compila con `npm run build:store`, que usa
  `--no-default-features --features microsoft-store` y
  `src-tauri/tauri.store.conf.json`.
- Identidad actual en Partner Center:
  - `Package/Identity/Name`: `wulflo.SinNotas`
  - `Package/Identity/Publisher`: `CN=7F51EF66-8407-4798-A8F4-3C4A407DA359`
  - `Package/Properties/PublisherDisplayName`: `wulflo`
  - `Package Family Name`: `wulflo.SinNotas_m5406cz1kxss8`
  - Store ID: `9N9TFK88D7JK`
- El workflow usa esos valores por defecto. Si se recrea el producto o cambia
  la identidad, se puede sobrescribir con las variables de repositorio
  `MS_STORE_PACKAGE_NAME` y `MS_STORE_PUBLISHER`.
- Privacidad para la ficha de la Store:
  `https://github.com/wulflo/SinNotas/blob/master/PRIVACY_POLICY.md`.

El manifiesto MSIX se genera desde
`packaging/windows-store/AppxManifest.template.xml` con
`node scripts/prepare-store-msix.mjs`. La versión de `package.json` se
convierte a cuatro componentes (`0.4.10` → `0.4.10.0`); cada envío a la Store
debe subir ese número.

Antes de enviar el paquete conviene probarlo en Windows con un certificado
autofirmado (`Add-AppxPackage`), pero ese certificado **no** se sube a Partner
Center. WebView2 tiene que estar instalado en el sistema (Windows 10/11 lo
trae con Edge); si falta, la app no arranca dentro del MSIX.

Con el PFN `wulflo.SinNotas_m5406cz1kxss8`, los datos que la app escriba en
`%APPDATA%` quedan virtualizados en
`%LOCALAPPDATA%\Packages\wulflo.SinNotas_m5406cz1kxss8\LocalCache\Roaming\`.
Las bóvedas elegidas en Documentos siguen siendo accesibles porque el paquete
declara `runFullTrust`.

## Datos de la release Android

- Paquete: `com.sinnotas.desktop`
- Última release publicada: `0.5.10` (`versionCode 5010`)
- `minSdk 33`, `targetSdk 37`
- Arquitectura: `arm64-v8a`
- Firma release esperada (SHA-256 del certificado):
  `fd3aa8bff77d23bfad24fc4a0c6eb50cdfa3f822611e4ea6a12b78ddcee25b2c`
- DN: `CN=Sin Notas, OU=Android, O=SinNotas, L=Bogota, ST=Bogota, C=CO`

## Limitaciones conocidas

- Las bóvedas externas en Android dependen del acceso SAF autorizado por el
  usuario; no se interpretan URIs como rutas locales. Si se revoca el permiso o
  se mueve la carpeta, hay que volver a elegirla desde la pantalla de bóveda.
- Los snapshots del editor completo siguen siendo una función de escritorio:
  el backend los resuelve con rutas de filesystem y no están disponibles sobre
  una bóveda SAF.
- La APK abre en modo repaso. El editor completo, con diarios, Kanban, grafo y
  mapa conceptual, se abre desde **Abrir páginas y editor**.
- El fix de safe area del editor completo se validó con estilos computados en el
  navegador; falta confirmarlo en un dispositivo Android real.
- La actualización automática de `.deb` no se probó de extremo a extremo en
  hardware real: requiere `pkexec`/`sudo` y una instalación 0.2.2 previa.

## Compatibilidad con versiones antiguas

- Una app v0.2.0 instalada no puede autoactualizarse por el bug del
  `Content-Type`; requiere instalar la APK corregida manualmente una vez.
- Una instalación `.deb` de 0.2.0/0.2.1 debe instalar 0.2.2 manualmente una vez;
  desde 0.2.2 el updater ya puede descargar e instalar el `.deb`.

## Verificación actual

- `npx tsc --noEmit`: correcto.
- `npm test`: **465 pruebas en 45 archivos**; incluye los pesos oficiales de
  FSRS-7, los vectores dorados de intervalos y las regresiones de oclusión.
  Además de mazos con ajustes de FSRS por mazo, los selectores desplegables de
  la app usan `CustomSelect` (estilo de tema de la app).
- Ajustes de interfaz 0.4.3 (mapa conceptual, oclusión, tareas canvas y scroll
  de flashcards): solo CSS; `npx tsc --noEmit`, `npm test` y `npm run build`
  pasan. Falta la comprobación manual en la app Tauri, no solo en modo web.
- Regresiones de repaso (imágenes, selector de mazo y rueda del ratón):
  implementadas y verificadas en navegador; `npx tsc --noEmit`, `npm test`
  (465 pruebas en 45 archivos) y `npm run build` pasan. Falta abrir una tarjeta
  con imagen y probar la rueda en la app Tauri real.
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`: correcto.
- Lector PDF Fases 1–4: 12 pruebas Rust (`cargo test ... pdf`), incluidas la
  carga de PDFium, el render PNG, la extracción de texto, las capturas y la
  caducidad/borrado de documentos.
- CI de `master`: lint/test, APK debug y APK release firmada.
- Safe area del editor completo: estilos computados en navegador con inset
  superior 24 px e inferior 16 px; `.headbar` mide 72 px, el cajón lateral y el
  contenido reservan sus insets y el layout encaja en el viewport.
- Release v0.2.3: APK `versionName 0.2.3` / `versionCode 2003`, firmas v3,
  `.deb.sig` y `latest.json` verificados; las URLs de AppImage, `.deb`, Windows,
  macOS y Android devuelven 200. Las firmas minisign del AppImage y del `.deb`
  se validaron contra la clave pública del updater.
- Release v0.2.6: APK `versionName 0.2.6` / `versionCode 2006`; el SHA-256 del
  APK coincide con `latest.json`, las URLs devuelven 200 y las firmas minisign
  del AppImage y del `.deb` se validaron contra la clave pública del updater.
- Release v0.2.7: APK `versionName 0.2.7` / `versionCode 2007`; el SHA-256 del
  APK coincide con `latest.json`, las URLs devuelven 200, las firmas minisign
  del AppImage y del `.deb` se validaron y el certificado Android es el mismo
  que el de 0.2.6.
- Release v0.2.8: publicada como *latest*; APK `versionName 0.2.8` /
  `versionCode 2008`, paquete `com.sinnotas.desktop`, `minSdk 33` y
  `targetSdk 37`. El SHA-256 del APK
  (`54e47dfe23d9151a3a65941ba279e948281f416aa62bf00fa66de8f72f5c3a35`)
  coincide con `latest.json`; `latest.json` declara `version: "0.2.8"` e incluye
  Linux (`AppImage` y `.deb`), Windows, macOS universal y Android. Las descargas
  de `latest.json` y del APK devuelven 200. En local, los pesos oficiales de
  FSRS-7 están aplicados, las 422 pruebas y `tsc --noEmit` pasan, la respuesta
  de oclusión ya no dibuja máscaras y la vista previa ajusta su caja al tamaño
  real de la imagen.
- Oclusión de imagen, medición en navegador: con el CSS anterior una imagen
  vertical 400×1200 dejaba la caja de la máscara un **72,1 %** más ancha que la
  imagen visible; con `width: fit-content` y la imagen en `width: auto` la caja,
  la imagen y la capa de máscaras coinciden al píxel (0 % de desajuste).
- Actualización Android 0.2.6 → 0.2.7: APK guardado en `Descargas/SinNotas/`,
  visible desde el gestor de archivos e instalado manualmente.
- Alineación de bullets con propiedades: verificada en navegador midiendo la
  posición horizontal de los bullets; todos coinciden dentro de la misma
  jerarquía.
- El generador de `latest.json` normaliza los espacios de los assets a puntos,
  igual que GitHub, para que las URLs publicadas coincidan con los nombres
  reales de los archivos.

## Política de documentación

La documentación técnica y de estado vive en este archivo: `docs/SinNotas.md`.
El README de la raíz es el punto de entrada y enlaza aquí.

Las fases largas que pueden interrumpirse mantienen además un único checklist
operativo, [`docs/CHECKLIST-CONSOLIDADO.md`](CHECKLIST-CONSOLIDADO.md), con el
estado exacto, los archivos tocados, los pendientes consolidados y las reglas
para reanudar sin borrar código parcial. Todo el seguimiento (PDF, seguridad de
Documentos/Bibliografía, búsqueda de metadatos, FSRS, mazos, temas visuales,
ajustes de interfaz, mantenimiento y rendimiento) vive en secciones con ID
estable dentro de ese archivo; no se crean checklist nuevos por área. Su §0
define cómo registrar cada edición, cómo ordenar las secciones y cuándo debe
crearse una fase (o, en su defecto, registrarse su destino externo).
