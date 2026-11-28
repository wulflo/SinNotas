# Guía de uso de Sin Notas

Esta guía explica cómo usar Sin Notas de principio a fin: desde la primera
bóveda hasta el repaso con FSRS, los mazos, el panel de productividad y la
versión de Android. Está pensada para personas que usan la aplicación, no para
quien la desarrolla. Para la arquitectura y los detalles internos, consulta
[SinNotas.md](SinNotas.md).

> English version: [USER-GUIDE.md](USER-GUIDE.md).

## Índice

1. [Qué es Sin Notas](#qué-es-sin-notas)
2. [Primeros pasos](#primeros-pasos)
3. [La ventana principal](#la-ventana-principal)
4. [El editor de bullets](#el-editor-de-bullets)
5. [Organizar notas](#organizar-notas)
6. [Documentos PDF y bibliografía](#documentos-pdf-y-bibliografía)
7. [Flashcards y repaso](#flashcards-y-repaso)
8. [Mazos y selección de notas](#mazos-y-selección-de-notas)
9. [Panel de productividad y Pomodoro](#panel-de-productividad-y-pomodoro)
10. [Ajustes](#ajustes)
11. [Sin Notas en Android](#sin-notas-en-android)
12. [Datos, copias y sincronización](#datos-copias-y-sincronización)
13. [Privacidad y seguridad](#privacidad-y-seguridad)
14. [Problemas frecuentes](#problemas-frecuentes)

## Qué es Sin Notas

Sin Notas es un outliner local-first: tus notas son archivos Markdown normales
dentro de una carpeta que tú eliges. Encima de esos archivos, la aplicación
añade jerarquía de bullets, enlaces entre notas, tarjetas de repaso con
FSRS-7, un lector de PDF, bibliografía, tablero Kanban y un grafo de
conexiones.

No hay cuenta, nube obligatoria ni base de datos propietaria. Puedes abrir la
bóveda con cualquier editor de texto, hacer copias con tu herramienta favorita
o sincronizarla con el servicio que prefieras.

## Primeros pasos

### Instalar

- **Escritorio:** descarga el instalador de la última release (Windows, Linux o
  macOS) desde GitHub.
- **Android:** descarga el APK y ábrelo con el gestor de archivos del
  dispositivo. Sin Notas no instala APKs por sí mismo. Si ya tienes una versión
  firmada con otra clave, desinstala antes la anterior.

### Elegir la bóveda

Una bóveda es una carpeta con archivos `.md`. En el primer arranque:

1. Pulsa **Seleccionar una carpeta de vault** (escritorio) o **Elegir carpeta**
   (Android).
2. Elige una carpeta vacía para empezar o una carpeta existente con tus notas.
3. Sin Notas recuerda la elección y la abre en los siguientes arranques.

En Android la carpeta se elige con el selector del sistema (SAF). La aplicación
guarda el permiso de lectura y escritura; si el permiso se pierde o la carpeta
se mueve, aparecerá una pantalla para volver a elegirla.

### Crear la primera nota

- **Ctrl/Cmd + K** abre el buscador rápido: escribe un título y pulsa
  **Crear nota** para crear la página.
- También puedes usar el botón **+** de la barra lateral o el menú contextual.
- El título de la página es editable y también define el nombre del archivo.

### Buscar y abrir notas

- El buscador de la barra lateral muestra primero las notas cuyo título coincide
  y, debajo, **En el contenido**, con fragmentos del texto de las notas.
- En pantallas anchas el desplegable se abre sobre el editor para que el
  fragmento no se corte; en pantallas estrechas ocupa todo el ancho disponible.
- Los resultados aparecen en tandas de 10: **Mostrar más notas** y
  **Mostrar más resultados** añaden los siguientes sin borrar los anteriores.
- Si un fragmento supera cuatro líneas, **Ver bloque completo** lo despliega
  dentro del propio desplegable. Las flechas y **Enter** siguen funcionando y
  **Esc** lo cierra.

Las notas nuevas se guardan automáticamente. Los cambios de texto se escriben
en disco con una pequeña demora para no bloquear la escritura.

### Estructura de la bóveda

```text
<tu carpeta>/
├── *.md                        # tus notas, Markdown plano
├── assets/                     # imágenes y capturas de PDF
└── .sinnotas/
    ├── chronos/                # snapshots (historial de versiones)
    ├── progress/reviews.json   # historial de repasos
    └── documents/links.json    # PDFs enlazados
```

La carpeta `.sinnotas/` es interna: puedes hacer copia de seguridad de ella,
pero no necesitas editarla a mano.

## La ventana principal

### Barra lateral

- Lista las páginas de la bóveda y permite crear, buscar, renombrar y eliminar.
- Muestra hasta **20 páginas recientes**; si no hay fijadas ni recientes, aparece
  una pista para abrir una nota. Para ver el listado completo de páginas, usa el
  icono **Todas las páginas** del mosaico de navegación.
- El menú contextual de una nota ofrece solo texto: abrir, renombrar, copiar
  enlace `[[...]]`, fijar/desfijar y eliminar. Las notas fijadas aparecen arriba
  y siguen fijadas al cerrar y reabrir la app: se guardan como `pinned:: true` y
  `pinned-at::` en el frontmatter del archivo `.md`.
- **Ctrl/Cmd + B** la colapsa o la expande.
- En escritorio puedes arrastrar su borde para cambiar el ancho.
- El menú contextual de una nota ofrece renombrar, eliminar, abrir historial y
  otras acciones.

### Barra superior

Muestra la miga de pan de la nota abierta, el historial de navegación
(atrás/adelante), la barra de búsqueda, el temporizador Pomodoro compacto y el
acceso a Ajustes. En Android se adapta a la barra de estado y a la barra de
navegación del sistema.

### Vistas

- **Editor:** el outliner principal.
- **Diarios:** calendario y notas diarias.
- **Flashcards:** repaso y explorador de tarjetas.
- **Grafo:** mapa de conexiones entre notas.
- **Tareas:** tablero Kanban.
- **Todas las páginas:** listado completo con orden y fechas.
- **Bibliografía:** gestor de fuentes.
- **Documentos:** biblioteca y lector de PDF.

Cada vista conserva su estado al cambiar entre ellas.

### Focus

El botón **Focus** de la vista Flashcards oculta la cabecera y el resto de
distracciones para repasar a pantalla completa. Vuelve a pulsarlo para salir.
En Android el editor completo mantiene el mismo comportamiento.

## El editor de bullets

### Escritura básica

- **Enter** divide el bullet en la posición del cursor o crea el siguiente.
- **Shift + Enter** inserta un salto de línea dentro del mismo bullet.
- **Tab** y **Shift + Tab** indentan y desindentan.
- Mantén pulsado el botón izquierdo sobre el tirador de un bullet y arrastra
  para moverlo con toda su jerarquía; suelta sobre otro bullet para antes,
  después o dentro de él.
- Selecciona varios bullets con clic y arrastre o con **Shift** y arrastra para
  copiarlos, cortarlos, moverlos o borrarlos en bloque. Si arrastras el tirador
  de uno que ya está seleccionado, se mueve todo el grupo manteniendo el orden.

### Formato

- Selecciona texto y usa el menú de formato: negrita, cursiva, subrayado,
  tachado, resaltado, código y colores.
- **Ctrl/Cmd + B**, **I** y **U** aplican negrita, cursiva y subrayado.
- Los enlaces entre notas se escriben como `[[Título de la nota]]`.
- Las etiquetas `#tema` se muestran como una píldora con el color de acento.

### Comandos de barra

Escribe `/` al principio de un bullet para abrir el menú de comandos. Desde ahí
puedes insertar:

- títulos H1–H6,
- tablas Markdown,
- imágenes,
- tareas,
- tarjetas básicas (`#card`),
- huecos Cloze (`==texto==`),
- consultas y colores.

### Tablas

Las tablas se guardan como Markdown. Haz clic en una celda para seleccionarla:
aparece una barra de herramientas con botones de iniciales (`+F`, `+C`, `↑F`, …)
cuyo tooltip explica la acción. El formato (negrita, cursiva, subrayado, tachado,
código, cloze y quitar formato) se aplica **solo a la celda seleccionada**, no a
toda la tabla. Puedes añadir o quitar filas y columnas, reordenarlas arrastrando
y usar el menú contextual de la celda. El borde de la esquina superior izquierda
usa la misma variante de acento que el resto de celdas; solo la celda seleccionada
se destaca. El resaltado Cloze funciona también dentro de una celda.

### Imágenes

- Pega una imagen desde el portapapeles o insértala desde el menú.
- Se guardan en `assets/` y se referencian desde la nota.
- Formatos: PNG, JPG/JPEG, WebP, SVG, GIF y BMP.
- Puedes ajustar el tamaño y abrir el editor de oclusión desde la imagen.

### Buscar dentro de una nota

**Ctrl/Cmd + F** abre la barra de búsqueda de la nota. **Enter** y
**Shift + Enter** recorren las coincidencias; **Escape** cierra la búsqueda.
Los botones flotantes llevan al inicio o al final de notas largas.

### Historial y exportación

- **Historial de versiones** guarda y restaura snapshots de la página.
- **Exportar** descarga la nota actual como texto plano `.txt`.

## Organizar notas

### Diarios

La vista **Diarios** muestra un calendario. Pulsa un día para crear o abrir su
nota diaria. Los diarios son notas normales: puedes enlazarlas, etiquetarlas y
convertirlas en tarjetas.

### Todas las páginas

Lista todas las notas con fecha de creación y modificación. Permite ordenar,
filtrar y abrir el historial de cada nota.

### Grafo y mapa conceptual

- El grafo dibuja las conexiones producidas por los wikilinks.
- Haz clic en un nodo para previsualizar su contenido, arrástralo para moverlo y
  haz doble clic para restablecer la vista.
- La rueda hace zoom y el botón derecho o central permite desplazar el lienzo.
- Desde una nota puedes abrir el **mapa conceptual**, que convierte sus bullets
  en un diagrama navegable.
- En los ajustes del grafo puedes crear grupos de color por texto del título y
  ajustar las fuerzas de la simulación.

### Kanban

La vista **Tareas** tiene columnas de pendientes, en curso y completadas.
Arrastra las tarjetas entre columnas para cambiar su estado. Puedes ocultar las
completadas y añadir tareas a la nota diaria.

## Documentos PDF y bibliografía

### Documentos

- La biblioteca lista los PDFs del vault y los abre con el lector nativo.
- Puedes enlazar un PDF externo sin copiarlo o importarlo a `assets/pdfs/`.
- El texto es seleccionable: cópialo o insértalo como bullet en la nota activa.
- El modo dividido muestra el PDF y la nota en paralelo; arrastra el separador
  para ajustar el espacio y haz doble clic para restablecerlo.
- Arrastra un rectángulo sobre una página para guardar una captura en
  `assets/pdf-captures/`, insertarla en la nota o abrir el editor de oclusión.

### Bibliografía

- Cada recurso usa propiedades `bib-*` en el frontmatter de una nota.
- El estado de consulta **Revisando** sirve para libros, vídeos y cualquier otro
  tipo de recurso; no implica necesariamente leer texto.
- Puedes guardar portadas locales o remotas validadas.
- Las notas hijas se enlazan con wikilinks saneados.
- El botón **Añadir recurso** busca por DOI, ISBN-10/13 o palabras clave.

## Flashcards y repaso

### Crear tarjetas

Una tarjeta nace de un bullet. Hay tres formas principales:

1. **Básica con `#card`:** el bullet se convierte en tarjeta. Si contiene `::`,
   la parte izquierda es la pregunta y la derecha la respuesta.
2. **Básica con separador:** `¿Pregunta? :: Respuesta` también crea una tarjeta,
   aunque no lleve `#card`.
3. **Cloze:** el texto resaltado con `==...==` o la sintaxis `{{c1::texto}}` se
   oculta y se pregunta. Añade `#card` para que el bullet sea una tarjeta.
4. **Oclusión de imagen:** inserta una imagen y dibuja zonas rectangulares,
   elípticas o poligonales para ocultar partes. Cada zona puede tener una pista.

También puedes usar los atajos **Alt + R** (crear tarjeta básica) y
**Alt + T** (quitar marcadores) con el cursor en un bullet o con
varios bullets seleccionados; si hay selección, se marca el bullet de mayor
jerarquía. Ambos atajos aparecen en el grupo **Flashcards** del diálogo de
atajos. No se añade `#card` a un bullet que ya genera tarjeta con `::`, `==…==`,
`{{…}}` o una oclusión: el aviso distingue ese caso de un bullet vacío.

También puedes seleccionar varios bullets y usar **Crear tarjeta básica** o
**Convertir en flashcard** desde el menú contextual. Para quitar los marcadores
sin borrar el contenido, usa **Eliminar flashcard**.

### Tipos de tarjeta

- **Básica:** pregunta y respuesta.
- **Cloze:** uno o varios huecos dentro de un texto.
- **Oclusión:** zonas de una imagen que se revelan al responder.

### FSRS-7

FSRS calcula cuándo conviene volver a ver cada tarjeta según tu historial. Cada
repaso guarda:

- **Estabilidad:** cuánto dura el recuerdo.
- **Dificultad:** lo difícil que es para ti.
- **Fecha de vencimiento:** cuándo toca repasar.
- **Historial:** última revisión, número de repasos y estado de aprendizaje.

Las tarjetas nuevas pasan por pasos cortos de aprendizaje (por defecto 1 y 10
minutos) antes de entrar en el ciclo de repaso. Así se evitan intervalos
iniciales engañosos.

### Sesión de repaso

1. Entra en **Flashcards**.
2. Pulsa **Mostrar respuesta** (o la barra espaciadora).
3. Califica con **Otra vez**, **Difícil**, **Bien** o **Fácil**.
4. La tarjeta se reprograma y aparece la siguiente.

Puedes deshacer y rehacer el último repaso con los botones de la cabecera o con
los atajos configurados. El contador y el anillo de progreso muestran cuántas
tarjetas quedan en la sesión.

Durante la sesión puedes pulsar **Editar tarjeta** (o **Editar oclusión** en una
tarjeta de imagen). En una básica se editan pregunta y respuesta; en una cloze se
abre un minieditor con el bullet de la tarjeta y sus bullets hijos, respetando la
indentación; en una oclusión se abre el editor de imagen. Al guardar se
conservan las propiedades FSRS y la tarjeta sigue en su posición de la cola.
En las oclusiones la imagen se adapta al ancho disponible de la tarjeta sin
estirar las imágenes pequeñas, y al revelar la respuesta no queda ningún
separador vacío.

### Atajos de repaso

Los atajos de teclado se configuran en **Ajustes › Flashcards › Repaso**. Por
defecto:

- **Espacio:** mostrar respuesta.
- **1 / 2 / 3 / 4:** Otra vez, Difícil, Bien, Fácil.
- **Ctrl/Cmd + Z:** deshacer el último repaso.
- **Ctrl/Cmd + Y:** rehacer.

También puedes usar un mando desde **Ajustes › Flashcards › Repaso › Gamepad**.

### Modo Aprendizaje

El modo Aprendizaje (en la vista móvil y en la cabecera de repaso) incluye
tarjetas que todavía no vencen y no guarda el progreso FSRS. Es útil para
practicar sin alterar la programación.

### Explorador de tarjetas

La pestaña **Explorador de Tarjetas** lista todas las tarjetas con búsqueda por
pregunta, respuesta o nota, orden por próximo repaso, último repaso o fecha de
creación, y paginación.

### Estadísticas y progreso

- **Actividad:** serpiente anual de los repasos: una fila por mes, un cuadrito por día y curvas que unen los extremos de cada fila. Mantiene los cinco niveles de intensidad; el 29 de febrero de los años bisiestos lleva un borde de acento y su aviso lo identifica. Al pasar el ratón por un cuadrito se ve su fecha y número de repasos.
- **Progreso:** puntos acumulados y una visualización del átomo que avanza por
  etapas a medida que repasas.
- **Pomodoro:** tiempo de enfoque registrado.

Puedes borrar las estadísticas de repaso desde **Ajustes › Avanzado ›
Mantenimiento** sin borrar las tarjetas.

## Mazos y selección de notas

### Mazos jerárquicos

Usa `→` en el título de una nota para crear una jerarquía. Por ejemplo:

```text
Salud mental
Salud mental → Ansiedad
Salud mental → Ansiedad → Tema 1
```

En el selector de notas, marcar un mazo padre incluye todas sus notas hijas. El
buscador no cambia la selección y el estado del borrador se conserva mientras
navegas entre páginas.

### Mazos personalizados

- **Ajustes › Flashcards › General › Mis mazos** permite crear, editar,
  duplicar la selección y eliminar mazos.
- Un mazo guarda una lista explícita de notas; una nota puede estar en varios
  mazos.
- Solo hay un mazo activo a la vez. Los mazos se guardan en la bóveda y se
  sincronizan; el mazo activo es una preferencia del dispositivo.
- El selector de mazos de la cabecera de Flashcards cambia el mazo activo sin
  abrir Ajustes.

### Notas con tarjetas

El árbol del creador de mazos muestra solo las notas que tienen al menos una
tarjeta. Si creas una tarjeta nueva, la nota aparece automáticamente en cuanto
abres Ajustes › Flashcards; no hace falta reiniciar la aplicación. El selector
actualiza su caché reescaneando únicamente las notas modificadas.

## Panel de productividad y Pomodoro

En escritorio, debajo de la flashcard hay un panel horizontal con tres bloques:

- **Pomodoro:** temporizador de enfoque y descansos, con inicio, reinicio,
  descanso corto y descanso largo.
- **Actividad:** mapa de calor de repasos y minutos de enfoque del día.
- **Progreso:** puntos y etapa del átomo.

El interruptor **Panel de productividad**, situado justo debajo de la tarjeta,
muestra u oculta el panel. La preferencia se guarda en el dispositivo. En modo
focus el panel sigue disponible y se desplaza si no cabe.

Los ajustes de Pomodoro (duraciones, sesiones antes del descanso largo,
contador progresivo, sonido y visibilidad en la barra superior) están en
**Ajustes › Flashcards › Pomodoro**.

## Ajustes

### Apariencia

- **Ancho de página:** porcentaje del ancho disponible (50–100 %, por defecto
  100 %). No es un valor fijo en píxeles: Editor, Diarios y Todas las páginas
  crecen con la ventana; el selector es proporcional al ancho de la interfaz.
- **Idioma de la interfaz:** automático, español, inglés o chino.
- **Tema:** claro u oscuro.
- **Estilo visual:** Aero, Simple o Dracula.
- **Color de interfaz:** once acentos.
- **Tipografía:** Sans, Serif, Mono, Dyslexic o una fuente instalada.
- **Tamaño de texto:** interfaz, editor, títulos y tarjetas por separado.

### Flashcards

- **General:** mazo activo, creación y edición de mazos, notas del mazo.
- **Repaso:** orden de las tarjetas, FSRS (retención, intervalo máximo, pasos y
  parámetros), recálculo de vencimientos, atajos de teclado y mando.
- **Pomodoro:** duraciones y comportamiento del temporizador.

### Atajos

- Puedes cambiar los atajos principales desde esta pestaña: pulsa la combinación
  que quieras asignar junto a la acción y se guarda de inmediato.
- Si la combinación ya la usa otra acción (o una reservada, como Copiar/Pegar),
  se rechaza con un aviso; el botón ↺ restablece el valor original.
- El diálogo **Atajos de teclado** muestra siempre las combinaciones vigentes.
  Las teclas de calificación de repaso se configuran en **Flashcards › Repaso**.

### Guardado

- Lista las notas con snapshots activos.
- Muestra cuántas versiones guardan y permite abrir el historial.
- Las copias viven en `.sinnotas/chronos/` y caducan según el periodo
  configurado.

### Avanzado

Al principio de esta sección hay un enlace a esta guía de uso.

- **Actualizaciones:** solo consulta GitHub cuando pulsas el botón. En
  escritorio el paquete se verifica con la firma del actualizador. En Android
  esta sección no se muestra: el APK se instala manualmente.
- **Repaso:** estadísticas (contadores de hoy, totales y minutos de enfoque),
  propiedades FSRS de las tarjetas (borrado por lotes, de todas o de una sola),
  borrado centralizado de flashcards (con selector paginado de notas o mazos e
  historial de repasos). Estas acciones no cambian el texto de las notas.
- **Mantenimiento:** borrar propiedades de bullets, eliminar imágenes no usadas,
  borrar caché, borrar estadísticas de repaso, borrar snapshots y recargar la
  aplicación.
- **Flashcards:** quitar los marcadores de tarjeta de todo el vault sin borrar el
  contenido.
- Todos los textos de esta sección están traducidos al inglés y al chino; la
  preferencia se elige en **Apariencia › Idioma de la interfaz**.

## Sin Notas en Android

La APK abre en la experiencia de repaso: pregunta, respuesta, oclusiones,
edición del bloque activo y calificación FSRS. Desde ahí puedes abrir el editor
completo para acceder a diarios, Kanban, grafo, PDF y bibliografía.

### Elegir y conservar la bóveda

- La primera vez se abre el selector de carpetas del sistema.
- Sin Notas conserva el permiso entre arranques.
- **Cambiar bóveda** vuelve a abrir el selector.
- Si se pierde el permiso, aparece una pantalla para elegir la carpeta otra vez.

### Ajustes y cambio de modo

En la parte inferior de la tarjeta hay un botón **Ajustes** siempre visible,
además de la fila destacada del menú lateral. Desde Ajustes puedes:

- cambiar tema, color de acento, tamaño de texto e idioma;
- abrir **Páginas y editor** para pasar al editor completo;
- cambiar de bóveda, actualizar tarjetas y recargar la aplicación.

Para volver al modo repaso desde el editor completo usa el botón **Volver al
repaso** de la interfaz de escritorio.

### Diferencias con escritorio

- El actualizador de Android descarga el APK desde GitHub y lo guarda en
  `Descargas/SinNotas/`; la instalación sigue siendo manual.
- El panel de productividad (Pomodoro, actividad y progreso) se oculta en el
  editor completo de Android para dejar espacio a las notas.
- La barra de estado y la barra de navegación se respetan mediante el puente de
  safe area.

### Actualizar el APK

1. En **Ajustes → Actualizaciones**, pulsa **Buscar actualizaciones**.
2. Pulsa **Descargar APK**. El archivo se guarda en `Descargas/SinNotas/`.
3. Abre el APK con el gestor de archivos.
4. Acepta la instalación del sistema.

Sin Notas descarga el APK, pero no lo instala por sí mismo: el instalador del
sistema siempre pide confirmación.

## Datos, copias y sincronización

- Tus notas son archivos `.md`. Copia la carpeta completa para respaldar la
  bóveda.
- La caché de metadatos (`.sinnotas_cache.bin`) acelera el arranque; se puede
  borrar desde **Ajustes › Avanzado › Mantenimiento** y se reconstruye sola.
- Para sincronizar entre dispositivos, usa cualquier servicio que sincronice
  archivos. Evita editar la misma nota en dos dispositivos a la vez.
- Los mazos, snapshots, historial de repasos y enlaces de documentos viven en
  `.sinnotas/` dentro de la bóveda.
- El historial de repasos conserva como máximo 4.000 eventos, 5 MB y 365 días.

## Privacidad y seguridad

- Sin Notas no envía telemetría ni crea cuentas.
- La red solo se usa cuando pides una actualización, una búsqueda de bibliografía
  o abres un enlace externo.
- El contenido pegado se sanea: solo sobreviven formatos seguros.
- El HTML de las tarjetas se escapa y se sanea con DOMPurify antes de mostrarse.
- Las rutas de archivos se validan contra la bóveda activa.
- Consulta [PRIVACY_POLICY.md](../PRIVACY_POLICY.md) para la política completa.

## Problemas frecuentes

**No aparece una tarjeta nueva en el creador de mazos.**
Abre **Ajustes › Flashcards** después de crearla. La lista se resincroniza
automáticamente reescaneando solo las notas modificadas. Si sigue sin aparecer,
pulsa **Sincronizar cambios de la bóveda** (↻) en la cabecera de Flashcards.

**Una nota no muestra tarjetas.**
Comprueba que el bullet tenga `#card`, un separador `::`, un resaltado
`==...==` o una sintaxis Cloze, y que la nota esté incluida en el mazo activo.
Recuerda que un mazo vacío significa "ninguna nota", no "todas".

**El APK no se actualiza desde la app.**
Es intencional: el actualizador está oculto en Android. Descarga el APK de la
última release e instálalo manualmente.

**No veo el panel de productividad.**
En escritorio, activa el interruptor **Panel de productividad** debajo de la
tarjeta. En el editor completo de Android está oculto por diseño.

**La bóveda de Android no abre.**
Vuelve a elegir la carpeta desde la pantalla de inicio o desde **Ajustes ›
Cambiar bóveda** para renovar el permiso SAF.

**Los cambios externos no aparecen.**
Sin Notas vigila la bóveda y aplica los cambios incrementales. Si un cambio no
se refleja, pulsa **Recargar aplicación** en Ajustes.

---

Volver al [README](../README.md) · Guía técnica: [SinNotas.md](SinNotas.md) ·
Versión en inglés: [USER-GUIDE.md](USER-GUIDE.md)
