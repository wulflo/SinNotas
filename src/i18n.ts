export type InterfaceLanguage = "es" | "en" | "zh";
export type LanguagePreference = "auto" | InterfaceLanguage;

const englishBySpanish: Record<string, string> = {
  "Editor": "Editor",
  "Diarios": "Journals",
  "Páginas": "Pages",
  "Vista gráfica": "Graph view",
  "Haz clic en un nodo para ver su contenido · Arrastra para mover · Doble clic para restablecer": "Click a node to preview its content · Drag to move · Double-click to reset",
  "Cerrar vista previa": "Close preview",
  "Contenido de la nota": "Page content",
  "Esta nota no tiene contenido.": "This page has no content.",
  "Imagen": "Image",
  "Tareas": "Tasks",
  "Todas las páginas": "All pages",
  "Páginas recientes": "Recent pages",
  "Buscar o crear nota...": "Search or create a page...",
  "No hay notas coincidentes.": "No matching pages.",
  "Crear nota": "Create page",
  "Seleccionar una carpeta de vault": "Select a vault folder",
  "Colapsar / Desplegar Barra Lateral (Ctrl+B)": "Collapse / expand sidebar (Ctrl+B)",
  "Atrás": "Back",
  "Adelante": "Forward",
  "Historial de Versiones (Snapshots)": "Version history",
  "Convertir en mapa conceptual": "Convert to concept map",
  "Mapa conceptual": "Concept map",
  "Bullets de la nota": "Page bullets",
  "Esta nota no tiene bullets para convertir en mapa.": "This page has no bullets to turn into a map.",
  "Arrastra para mover · Rueda del ratón para hacer zoom · Doble clic para centrar": "Drag to pan · Scroll to zoom · Double-click to center",
  "Alejar": "Zoom out",
  "Acercar": "Zoom in",
  "Centrar": "Center",
  "Cerrar": "Close",
  "Eliminar Página Actual": "Delete current page",
  "Ajustes y Apariencia": "Settings and appearance",
  "Configuración": "Settings",
  "Apariencia": "Appearance",
  "Repaso": "Review",
  "Progreso": "Progress",
  "Pomodoro": "Pomodoro",
  "Exportar": "Export",
  "Avanzado": "Advanced",
  "Orden de repaso": "Review order",
  "Elige qué tarjetas quieres ver primero al iniciar una sesión de repaso.": "Choose which cards you want to see first when starting a review session.",
  "Orden de las tarjetas": "Card order",
  "Nuevas primero": "New first",
  "Repasos primero": "Reviews first",
  "Orden mezclado": "Mixed order",
  "Orden de repaso actualizado.": "Review order updated.",
  "Recalcular propiedades": "Recalculate properties",
  "Actualiza las propiedades de programación de todas las tarjetas del vault.": "Update the scheduling properties of every card in the vault.",
  "Acción de recálculo": "Recalculation action",
  "Recalcular vencimientos": "Recalculate due dates",
  "Restablecer FSRS": "Reset FSRS",
  "Recalcula la fecha de vencimiento usando la última revisión y el intervalo programado.": "Recalculate the due date from the last review and the scheduled interval.",
  "Elimina las propiedades de programación FSRS y convierte todas las tarjetas en nuevas. Esta acción no se puede deshacer.": "Remove FSRS scheduling properties and turn every card into a new card. This action cannot be undone.",
  "Aplicar recálculo": "Apply recalculation",
  "Recalcular fechas": "Recalculate dates",
  "Restablecer propiedades": "Reset properties",
  "Procesando...": "Processing...",
  "Se eliminará el progreso de repaso de todas las tarjetas y volverán a contar como nuevas. ¿Continuar?": "Review progress will be removed from every card and they will count as new again. Continue?",
  "Tarjetas actualizadas:": "Cards updated:",
  "No había tarjetas que actualizar.": "There were no cards to update.",
  "No se pudieron actualizar las propiedades de las tarjetas.": "The card properties could not be updated.",
  "Tema Visual": "Theme",
  "Color de interfaz": "Interface color",
  "Modo Oscuro / Claro": "Dark / light mode",
  "Alternar Modo": "Toggle theme",
  "Modo Claro Activo": "Light mode active",
  "Modo Oscuro Activo": "Dark mode active",
  "Luminosidad del glow": "Glow brightness",
  "Tipografía del Editor": "Editor typography",
  "Tipografía del sistema": "System typography",
  "Selecciona cualquier tipografía instalada en tu dispositivo.": "Choose any font installed on your device.",
  "-- Seleccionar tipografía del sistema --": "-- Select system font --",
  "Seleccionar tipografía instalada en el sistema": "Select an installed system font",
  "Tipografía del sistema aplicada": "System font applied",
  "Sans (sistema)": "Sans (system)",
  "Serif (Georgia)": "Serif (Georgia)",
  "Mono (sistema)": "Mono (system)",
  "Ancho de página": "Page width",
  "Atajos de teclado para Flashcards": "Flashcard keyboard shortcuts",
  "Elige la tecla que califica cada tarjeta durante el repaso.": "Choose the key that rates each card during review.",
  "Tecla para \"Otra vez\"": "Key for \"Again\"",
  "Tecla para \"Difícil\"": "Key for \"Hard\"",
  "Tecla para \"Bien\"": "Key for \"Good\"",
  "Tecla para \"Fácil\"": "Key for \"Easy\"",
  "Tiempo de enfoque (minutos)": "Focus time (minutes)",
  "Descanso corto (minutos)": "Short break (minutes)",
  "Descanso largo (minutos)": "Long break (minutes)",
  "Sesiones antes del descanso largo": "Sessions before long break",
  "Mostrar en la barra superior": "Show in the top bar",
  "Configura los tiempos de enfoque y descanso, y cuántas sesiones completar antes de un descanso largo.": "Set focus and break durations and how many sessions to complete before a long break.",
  "Enfoque": "Focus",
  "Descanso corto": "Short break",
  "Descanso largo": "Long break",
  "Iniciar": "Start",
  "Pausar": "Pause",
  "Reiniciar": "Reset",
  "Ciclo completado. Disfruta de un descanso largo.": "Cycle complete. Enjoy a long break.",
  "Pomodoro completado. Tómate un descanso corto.": "Pomodoro complete. Take a short break.",
  "Descanso completado. ¡A seguir repasando!": "Break complete. Back to reviewing!",
  "Exportar notas": "Export notes",
  "Exportar a PDF": "Export as PDF",
  "Markdown (.zip)": "Markdown (.zip)",
  "Exportar CSV": "Export CSV",
  "Exportar JSON": "Export JSON",
  "Mantenimiento": "Maintenance",
  "Estas acciones no eliminan tus notas. La limpieza de adjuntos solo borra imágenes de": "These actions do not delete your notes. Attachment cleanup only removes images from",
  "que no estén referenciadas en ninguna nota.": "that are not referenced by any note.",
  "Borrar propiedades de los bullets": "Clear bullet properties",
  "Borrar caché": "Clear cache",
  "Borrar estadísticas de repaso": "Clear review statistics",
  "Borrar estadísticas": "Clear statistics",
  "Se borrarán las estadísticas de repaso: repasos de hoy, repasos totales, minutos de enfoque y los puntos del átomo de progreso. La programación FSRS de las tarjetas no se modificará. ¿Continuar?": "Review statistics will be cleared: today's reviews, total reviews, focus minutes and progress atom points. Card FSRS scheduling will not be changed. Continue?",
  "Estadísticas de repaso borradas.": "Review statistics cleared.",
  "Recargar aplicación": "Reload application",
  // Sección "Mantenimiento" de Ajustes > Avanzado (botones y toasts).
  "Eliminar imágenes no usadas de assets": "Remove unused asset images",
  "Borrar todos los snapshots": "Delete all snapshots",
  "Borrar propiedades": "Clear properties",
  "Eliminar imágenes": "Remove images",
  "Borrar todos": "Delete all",
  "Recargar": "Reload",
  "La limpieza de adjuntos requiere la aplicación de escritorio.": "Attachment cleanup requires the desktop application.",
  "Se revisarán todas las notas y se eliminarán de assets las imágenes que no estén referenciadas en ninguna página. Esta acción no se puede deshacer. ¿Continuar?": "All pages will be scanned and images in assets that are not referenced by any page will be deleted. This action cannot be undone. Continue?",
  "Guardando notas antes de revisar los adjuntos…": "Saving pages before scanning attachments…",
  "Buscando imágenes no usadas…": "Scanning for unused images…",
  "No se encontraron imágenes en la carpeta assets.": "No images found in the assets folder.",
  "No había imágenes sin usar en assets.": "There were no unused images in assets.",
  "No se pudo completar la limpieza de adjuntos.": "Attachment cleanup could not be completed.",
  "No se pudieron eliminar los adjuntos sin usar. Revisa la consola.": "Could not remove unused attachments. Check the console.",
  "Se eliminarán las propiedades de todos los bullets y el Frontmatter de las páginas del vault activo. El texto de las notas y sus archivos se conservarán. ¿Continuar?": "The properties of all bullets and the frontmatter of the active vault's pages will be removed. Page text and files will be preserved. Continue?",
  "No se pudieron guardar todas las notas. Revisa la consola y el estado del vault.": "Could not save all pages. Check the console and the vault state.",
  "Se borrarán los cachés web temporales y los datos de sesión de esta aplicación. Las notas, archivos y preferencias guardadas se conservarán.": "Temporary web caches and this application's session data will be cleared. Notes, files and saved preferences are preserved.",
  "Caché temporal borrada.": "Temporary cache cleared.",
  "No se pudo borrar toda la caché temporal. Revisa la consola para más detalles.": "Could not clear the whole temporary cache. Check the console for details.",
  "Se borrarán todas las versiones guardadas de todas las notas en chronos/. Las notas originales no se tocarán. ¿Continuar?": "All saved versions of all pages in chronos/ will be deleted. The original pages will not be touched. Continue?",
  "La interfaz se recargará. Las notas guardadas no se modificarán.": "The interface will reload. Saved pages will not be modified.",
  "Renombrar nota": "Rename page",
  "Nombre de la nota": "Page name",
  "Cancelar": "Cancel",
  "Guardar": "Save",
  "Confirmar acción": "Confirm action",
  "Menú": "Menu",
  "Texto": "Text",
  "Bullet": "Bullet",
  "Hueco Cloze (==...==)": "Cloze deletion (==...==)",
  "Crear Hueco Cloze (==...==)": "Create Cloze deletion (==...==)",
  "Crear Flashcard (#card)": "Create flashcard (#card)",
  "Convertir a Flashcard (#card)": "Convert to flashcard (#card)",
  "Limpiar formato": "Clear formatting",
  "Navegación": "Navigation",
  "Menú de navegación": "Navigation menu",
  "Crear Oclusión de Imagen": "Create image occlusion",
  "Insertar imagen": "Insert image",
  "Alternar Tarea (TODO / DOING / DONE)": "Toggle task (TODO / DOING / DONE)",
  "Mover arriba": "Move up",
  "Mover abajo": "Move down",
  "Copiar": "Copy",
  "Copiar selección": "Copy selection",
  "Copiar bullet": "Copy bullet",
  "Pegar": "Paste",
  "Pegar selección": "Paste selection",
  "Pegar sin formato": "Paste without formatting",
  "No se pudo acceder al portapapeles.": "The clipboard could not be accessed.",
  "El texto pegado era demasiado largo y se recortó.": "The pasted text was too long and was trimmed.",
  "Copiar bullets seleccionados": "Copy selected bullets",
  "Cortar": "Cut",
  "Cortar selección": "Cut selection",
  "Cortar bullet": "Cut bullet",
  "Cortar bullets seleccionados": "Cut selected bullets",
  "Borrar selección": "Delete selection",
  "Borrar bullet": "Delete bullet",
  "Borrar bullets seleccionados": "Delete selected bullets",
  "Eliminar bullet": "Delete bullet",
  "Abrir nota": "Open page",
  "Renombrar": "Rename",
  "Copiar enlace [[...]]": "Copy link [[...]]",
  "Eliminar nota": "Delete page",
  "Oclusión de imagen": "Image occlusion",
  "Arrastra sobre la imagen para crear tarjetas que oculten zonas.": "Drag on the image to create cards that hide areas.",
  "Guardar oclusiones": "Save occlusions",
  "Flashcards": "Flashcards",
  "Repasar": "Review",
  "Explorador de Tarjetas": "Card browser",
  "Explorador de tarjetas": "Card browser",
  "Mostrar Respuesta (Espacio)": "Show answer (Space)",
  "Reiniciar Sesión": "Restart session",
  "Otra vez": "Again",
  "Difícil": "Hard",
  "Bien": "Good",
  "Fácil": "Easy",
  "BÁSICA": "BASIC",
  "CLOZE": "CLOZE",
  "IMAGEN": "IMAGE",
  "Origen:": "Source:",
  "Próximo repaso": "Next review",
  "Último repaso": "Last reviewed",
  "Creada": "Created",
  "Sin registro": "Not recorded",
  "Fecha no válida": "Invalid date",
  "Fecha": "Date",
  "Fecha de vencimiento": "Due date",
  "Editar fecha de vencimiento": "Edit due date",
  "Asignar fecha de vencimiento": "Set due date",
  "Déjalo vacío para quitar la fecha.": "Leave it empty to remove the due date.",
  "Fecha de vencimiento actualizada.": "Due date updated.",
  "Fecha de vencimiento eliminada.": "Due date removed.",
  "No se encontró la nota de la tarea.": "The task's page could not be found.",
  "No se encontró la tarea.": "The task could not be found.",
  "No se pudo guardar la fecha de vencimiento.": "The due date could not be saved.",
  "Ordenar por:": "Sort by:",
  "Vencimiento": "Due date",
  "Creación": "Creation date",
  "Sin tarjetas": "No cards",
  "Sin tarjetas pendientes": "No cards due",
  "¡Completado!": "Completed!",
  "¡Has completado todas las tarjetas pendientes con FSRS-4.5!": "You've completed all cards due for review with FSRS-4.5!",
  "No hay tarjetas pendientes de repaso. Vuelve cuando llegue su fecha de vencimiento.": "No cards are due for review. Come back when they are due.",
  "No se encontraron tarjetas en las notas del vault.": "No cards were found in this vault.",
  "Notas incluidas en el repaso": "Notes included in review",
  "Marcar todo": "Select all",
  "Ninguna": "None",
  "Guardar selección": "Save selection",
  "Cambios sin guardar": "Unsaved changes",
  "Buscar en el título...": "Search title...",
  "Filtrar notas por palabra en el título": "Filter notes by word in the title",
  "Orden de la lista de notas": "Note list sorting",
  "Nombre A-Z": "Name A-Z",
  "Nombre Z-A": "Name Z-A",
  "Creación (más reciente)": "Created (newest first)",
  "Creación (más antigua)": "Created (oldest first)",
  "No hay notas cuyo título coincida con la búsqueda.": "No note titles match the search.",
  "No hay notas seleccionadas: no se repasará ninguna tarjeta.": "No notes selected: no cards will be reviewed.",
  "Sin tarjetas pendientes en las notas seleccionadas": "No pending cards in the selected notes",
  "No hay tarjetas pendientes en las notas seleccionadas. Vuelve cuando llegue su fecha de vencimiento o amplía la selección de notas.": "There are no cards due in the selected notes. Come back when they are due or expand the note selection.",
  "No hay ninguna nota seleccionada para el repaso. Marca y guarda las notas en Ajustes › Flashcards.": "No notes are selected for review. Check and save the notes in Settings › Flashcards.",
  "No se encontraron notas con flashcards en el vault.": "No notes with flashcards were found in the vault.",
  "Se repasarán las tarjetas de todas las notas.": "All notes' cards will be reviewed.",
  "Se repasarán solo las tarjetas de las notas seleccionadas.": "Only the cards of the selected notes will be reviewed.",
  "Cada nota actúa como un mazo que contiene sus flashcards. Selecciona las notas cuyas tarjetas se repasarán y pulsa \"Guardar selección\"; las desmarcadas quedarán excluidas de la sesión de repaso.": "Each note acts as a deck that contains its flashcards. Select the notes whose cards will be reviewed and press \"Save selection\"; unchecked ones will be excluded from the review session.",
  "tarjeta": "card",
  "tarjetas": "cards",
  "No se pudo renombrar la nota.": "The page could not be renamed.",
  "No hay cambios que deshacer.": "There are no changes to undo.",
  "No hay cambios que rehacer.": "There are no changes to redo.",
  "Cambio deshecho.": "Change undone.",
  "Cambio rehecho.": "Change redone.",
  "Snapshots manuales": "Manual snapshots",
  "Snapshots por nota": "Snapshots per page",
  "Seguimiento de snapshots activos": "Active snapshot tracking",
  "Abrir historial de esta nota": "Open this page's history",
  "No hay notas con snapshots activos.": "No pages have active snapshots.",
  "Los snapshots se activan desde el historial de cada nota. Aquí puedes ver las notas que los tienen activos, cuántas versiones guardan y borrarlas. Al vencer el periodo configurado, las versiones se eliminan automáticamente y solo queda la nota original. Las copias viven en la carpeta visible chronos/ dentro del vault.": "Snapshots are enabled from each page's history. Here you can see the pages that have them active, how many versions they keep, and delete them. When the configured period ends, versions are deleted automatically and only the original page remains. Copies live in the visible chronos/ folder inside the vault.",
  "Al activar se guarda una versión ahora y otra cada intervalo si la nota cambió. La ventana dura como máximo 30 días; al vencer, las versiones se eliminan y solo queda la nota original.": "Enabling saves one version now and another at each interval if the page changed. The window lasts at most 30 days; when it ends, versions are deleted and only the original page remains.",
  "Los snapshots se guardan en chronos/ mientras la nota esté activa. Al vencer el periodo o desactivarlos se eliminan.": "Snapshots are stored in chronos/ while the page is active. When the period ends or they are disabled, they are deleted.",
  "Guardado": "Saved",
  "Snapshot automático programado": "Scheduled automatic snapshot",
  "Snapshot inicial": "Initial snapshot",
  "Desactivar snapshots": "Disable snapshots",
  "Activar/Desactivar snapshots de esta nota": "Enable/disable snapshots for this page",
  "Desactivar y eliminar": "Disable and delete",
  "Desactivar los snapshots de esta nota eliminará todas las versiones guardadas. ¿Continuar?": "Disabling snapshots for this page will delete every saved version. Continue?",
  "Borrar snapshots": "Delete snapshots",
  "Snapshots eliminados.": "Snapshots deleted.",
  "No se pudieron borrar los snapshots.": "Snapshots could not be deleted.",
  "No se pudo cargar el seguimiento de snapshots.": "The active snapshot list could not be loaded.",
  "Quedan": "Remaining",
  "Cada": "Every",
  "versión guardada": "version saved",
  "versiones guardadas": "versions saved",
  "SinNotas guarda cada cambio al instante en tu vault local. Los snapshots no se crean automáticamente: al activar una ventana, la aplicación registra versiones recuperables de tus notas durante ese periodo. Las copias se guardan en la carpeta visible chronos/ dentro del vault.": "SinNotas saves every change instantly to your local vault. Snapshots are not created automatically: when you enable a window, the app records recoverable versions of your pages during that period. Copies live in the visible chronos/ folder inside the vault.",
  "Snapshots desactivados.": "Snapshots disabled.",
  "Snapshots activados.": "Snapshots enabled.",
  "Snapshots desactivados. Actívalos para registrar versiones automáticamente.": "Snapshots are off. Enable them to start recording versions automatically.",
  "Snapshots activos": "Snapshots active",
  "Snapshots no disponibles fuera de la aplicación.": "Snapshots are not available outside the app.",
  "Snapshots en pausa: el reloj del sistema retrocedió.": "Snapshots paused: the system clock moved backwards.",
  "La ventana de snapshots expiró. Actívala de nuevo para seguir registrando versiones.": "The snapshot window expired. Enable it again to keep recording versions.",
  "La duración debe estar entre 1 y 30 días.": "Duration must be between 1 and 30 days.",
  "El intervalo debe estar entre 1 y 168 horas.": "The interval must be between 1 and 168 hours.",
  "El límite diario debe estar entre 1 y 96 snapshots.": "The daily limit must be between 1 and 96 snapshots.",
  "No se pudieron activar los snapshots. Revisa el vault e inténtalo de nuevo.": "Snapshots could not be enabled. Check the vault and try again.",
  "No se pudieron desactivar los snapshots.": "Snapshots could not be disabled.",
  "No se pudo restaurar el snapshot.": "The snapshot could not be restored.",
  "Activa una ventana de snapshots o espera al siguiente intervalo para registrar versiones.": "Enable a snapshot window or wait for the next interval to record versions.",
  "Activar snapshots": "Enable snapshots",
  "Desactivar": "Disable",
  "Abrir historial": "Open history",
  "Duración (días)": "Duration (days)",
  "Intervalo (horas)": "Interval (hours)",
  "Límite diario por nota": "Daily limit per page",
  "La ventana dura como máximo 30 días. Solo se crea un snapshot si la nota cambió y el intervalo ya se cumplió.": "The window lasts at most 30 days. A snapshot is only created if the page changed and the interval has elapsed.",
  "Los snapshots se guardan en chronos/ solo mientras una ventana está activa.": "Snapshots are stored in chronos/ only while a window is active.",
  "Carpeta": "Folder",
  "quedan": "remaining",
  "cada": "every",
  "máx.": "max.",
  "al día": "per day",
  "sin límite diario": "no daily limit",
  "Snapshot": "Snapshot",
  "Referencias vinculadas": "Linked references",
  "Todas las Páginas": "All pages",
  "Título": "Title",
  "Bloques": "Blocks",
  "Tipo": "Type",
  "Actualizado": "Updated",
  "Acciones": "Actions",
  "Diario": "Journal",
  "Página": "Page",
  "Reciente": "Recent",
  "Eliminar página": "Delete page",
  "Selecciona una fecha para crear tu primer diario.": "Select a date to create your first journal.",
  "Selecciona una versión para inspeccionar su contenido.": "Select a revision to preview its contents.",
  "Vista previa de la versión": "Revision preview",
  "Restaurar esta Versión": "Restore this revision",
  "Sin snapshots previos aún.": "No previous snapshots yet.",
  "Tareas activas": "Active tasks",
  "Tarea completada": "Task completed",
  "puntos para el átomo de progreso": "points for the progress atom",
  "Por hacer": "TODO",
  "Haciendo": "DOING",
  "Hecho": "DONE",
  "Área": "Area",
  "Todavía no hay áreas ocultas. Arrastra sobre la imagen para añadir una.": "No occlusion areas yet. Drag on the image to add one.",
  "Eliminar área": "Delete area",
  "Cambiar tema": "Toggle theme",
  "Idioma de la interfaz": "Interface language",
  "Automático (Sistema)": "Automatic (system)",
  "Español": "Spanish",
  "Inglés": "English",
  "Herramientas de oclusión": "Occlusion tools",
  "Forma": "Shape",
  "Rectángulo": "Rectangle",
  "Elipse": "Ellipse",
  "Polígono": "Polygon",
  "Color": "Color",
  "Pista / texto": "Hint / text",
  "Escribe una pista para el área seleccionada": "Enter a hint for the selected area",
  "Reducir al 90%": "Scale to 90%",
  "Ampliar al 110%": "Scale to 110%",
  "Finalizar polígono": "Finish polygon",
  "Dibuja el polígono haciendo clic en cada punto y finalízalo con doble clic.": "Draw a polygon by clicking each point, then double-click to finish.",
  "Buscar": "Search",
  "Área seleccionada": "Selected area",
  "Vault local": "Local vault",
  "Welcome to SinNotas": "Bienvenido a SinNotas",
  "Dyslexic": "Dislexia",
  "Vistas de Flashcards": "Flashcard views",
  "Cargando preguntas de tus notas...": "Loading questions from your notes...",
  "Respuesta revelada aquí.": "Revealed answer goes here.",
  "Tarjeta 0 de 0": "Card 0 of 0",
  "0 tarjetas": "0 cards",
  "0 tareas activas": "0 active tasks",
  "0 páginas": "0 pages",
  "Seguimiento de tareas": "Task board",
  "Ocultar completados": "Hide completed",
  "POR HACER (TODO / LATER)": "TO DO (TODO / LATER)",
  "HACIENDO (DOING / NOW)": "DOING (DOING / NOW)",
  "HECHO (DONE)": "DONE (DONE)",
  "Mover a HACIENDO": "Move to Doing",
  "Título de Página": "Page title",
  "Última Actualización": "Last updated",
  "Historial de Versiones: Nota": "Page version history",
  "Imagen para oclusión": "Image for occlusion",
  "No se encontró el bloque de la imagen.": "Image block not found.",
  "No se encontró el bloque donde guardar las oclusiones.": "Could not find the block to save occlusions.",
  "La selección de vaults requiere la aplicación de escritorio.": "Vault selection requires the desktop application.",
  "No se pudo abrir el vault. Revisa los permisos de la carpeta e inténtalo de nuevo.": "Could not open the vault. Check folder permissions and try again.",
  "No se pudo acceder al vault local de la aplicación.": "Could not access the application's local vault.",
  "No se pudo activar la importación de imágenes por arrastre.": "Could not enable drag-and-drop image import.",
  "Ocurrió un error en un diálogo. Se cerró para liberar la interfaz.": "A dialog encountered an error and was closed to restore the interface.",
  "No se pudo cargar la imagen. Se cerró el editor de oclusiones.": "Could not load the image. The occlusion editor was closed.",
  "No se pudo abrir la imagen. Se cerró el editor de oclusiones.": "Could not open the image. The occlusion editor was closed.",
  "No se pudieron guardar las oclusiones. El editor se cerrará sin conservar esos cambios.": "Could not save the occlusions. The editor will close without keeping those changes.",
  "Caché temporal borrada": "Temporary cache cleared",
  "No se pudo exportar. Revisa la consola para más detalles.": "Export failed. See the console for details.",
  "Abriendo vista de impresión para guardar como PDF.": "Opening print view to save as PDF.",
  "El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.": "The browser blocked the print window. Allow pop-ups and try again.",
  "No se pudo preparar el PDF. Revisa la consola para más detalles.": "Could not prepare the PDF. See the console for details.",
  "No se encontró el bloque donde insertar la imagen.": "Could not find the block to insert the image.",
  "No se pudo copiar la imagen al vault. Comprueba su formato y tamaño (máximo 5 MB).": "Could not copy the image to the vault. Check its format and size (maximum 5 MB).",
  "No hay retroenlaces vinculados a esta página.": "No backlinks are linked to this page.",
  "Propiedades de página": "Page properties",
  "¿Estás seguro de que deseas eliminar permanentemente esta página?": "Are you sure you want to permanently delete this page?",
  "Página eliminada con éxito": "Page deleted successfully",
  "Guardado automático de cambios": "Changes saved automatically",
  "¿Deseas restaurar la nota a esta versión?": "Restore the page to this revision?",
  "¡Nota restaurada con éxito a la versión seleccionada!": "Page restored to the selected revision.",
  "El portapapeles no está disponible.": "Clipboard is unavailable.",
  "Mié": "Wed",
  "Sáb": "Sat",
  "Dom": "Sun",
  "Lun": "Mon",
  "Mar": "Tue",
  "Jue": "Thu",
  "Vie": "Fri",
  "Mes anterior": "Previous month",
  "Mes siguiente": "Next month",
  "diario existente": "existing journal",
  "crear diario": "create journal",
  "Por hacer (Después)": "To Do (TODO / LATER)",
  "En progreso (Haciendo)": "Doing (DOING / NOW)",
  "Completado (Finalizado)": "Done (DONE)",
  "Borrar propiedades del bullet": "Clear bullet properties",
  "Insertar query / consulta": "Insert query / search",
  "Mando (Joystick)": "Gamepad (Controller)",
  "Gamepad (Mando)": "Gamepad (Controller)",
  "Mando desactivado": "Gamepad disabled",
  "Mando conectado": "Gamepad connected",
  "Mando no detectado": "Gamepad not detected",
  "Activar soporte de gamepad": "Enable gamepad support",
  "Tipo de mando": "Controller type",
  "Detectar mando": "Detect controller",
  "Buscando gamepad... pulse un botón...": "Searching for gamepad... press a button...",
  "Configura un mando Bluetooth o USB para controlar Flashcards y otras funciones.": "Set up a Bluetooth or USB controller to control Flashcards and other functions.",
  "Fijar nota": "Pin note",
  "Desfijar nota": "Unpin note",
  "Asigna los botones del mando a las respuestas de FSRS (Otra vez, Difícil, Bien, Fácil).": "Assign controller buttons to the FSRS ratings (Again, Hard, Good, Easy).",
  "Mapeo de botones para Flashcards": "Button mapping for Flashcards",
  "Botón para": "Button for",
  "No asignado": "Not assigned",
  "Mapeo de botones adicionales": "Additional button mapping",
  "Visitar repositorio": "Visit repository",
  // Ajustes > Grafo.
  "Grafo": "Graph",
  "Secciones de ajustes": "Settings sections",
  "Grupos de color por nombre": "Color groups by name",
  "Pinta los nodos cuyo título contenga el texto indicado. La regla más específica (texto más largo) tiene prioridad y los colores manuales de cada nota siguen por encima de los grupos.": "Colors nodes whose title contains the given text. The most specific rule (longest text) wins, and each page's manual color still takes precedence over the groups.",
  "Texto del nombre (ej. Diario, Proyecto…)": "Name text (e.g. Journal, Project…)",
  "Texto del nombre para el grupo de color": "Name text for the color group",
  "Color del grupo": "Group color",
  "Añadir grupo": "Add group",
  "Fuerzas de la simulación": "Simulation forces",
  "Repulsión": "Repulsion",
  "Fuerza de enlaces": "Link strength",
  "Distancia de enlaces": "Link distance",
  "Atracción al centro": "Center attraction",
  "Fuerza de colisión": "Collision strength",
  "Amortiguación": "Damping",
  "Tamaño de los nodos": "Node size",
  "Radio base": "Base radius",
  "Radio por conexión": "Radius per connection",
  "Radio máximo": "Maximum radius",
  "Líneas y títulos": "Lines and titles",
  "Grosor de enlaces": "Link width",
  "Grosor resaltado": "Highlight width",
  "Zoom para mostrar títulos": "Zoom to show titles",
  "Los títulos aparecen con fundido al acercar hasta este zoom; al pasar el cursor o seleccionar un nodo se muestran siempre.": "Node titles fade in as you zoom up to this level; hovering or selecting a node always shows them.",
  "Restablecer valores del grafo": "Reset graph values",
  "Ajustes del grafo restablecidos.": "Graph settings reset.",
  "📌 Fijadas": "📌 Pinned",
  "Recientes": "Recent",
  "Ver todas las notas": "View all pages",
  "Abrir con aplicación predeterminada": "Open with default app",
  "No se pudo abrir la nota con la aplicación predeterminada.": "Could not open the page with the default application.",
  "En el contenido": "In page content",
  // Vista móvil de repaso (cadenas propias de review-app.ts).
  "Seleccionar notas para repasar": "Select notes to review",
  "Seleccionar notas": "Select notes",
  "Cambiar idioma": "Change language",
  "Idioma": "Language",
  "Cambiar apariencia": "Change appearance",
  "Actualizar tarjetas": "Refresh cards",
  "Abrir otra bóveda": "Open another vault",
  "Progreso del repaso": "Review progress",
  "Todo al día": "All caught up",
  "No hay tarjetas pendientes en esta bóveda.": "There are no cards due in this vault.",
  "Deshacer": "Undo",
  "Rehacer": "Redo",
  "Editar tarjeta": "Edit card",
  "Mostrar respuesta": "Show answer",
  "Cerrar editor": "Close editor",
  "Pregunta": "Question",
  "Respuesta": "Answer",
  "Texto de la tarjeta": "Card text",
  "Solo se modifica este bloque. Se conservan las propiedades FSRS, la etiqueta #card y el resto de la nota.": "Only this block is modified. FSRS properties, the #card tag and the rest of the page are preserved.",
  "Cerrar apariencia": "Close appearance",
  "Tema": "Theme",
  "Claro": "Light",
  "Oscuro": "Dark",
  "Elige el tema de la app. Se guarda en este dispositivo y se comparte con la versión de escritorio.": "Choose the app theme. It is saved on this device and shared with the desktop version.",
  "Color de acento": "Accent color",
  "Colores de acento": "Accent colors",
  "El color se guarda en este dispositivo y se comparte con la versión de escritorio.": "The color is saved on this device and shared with the desktop version.",
  "Más opciones": "More options",
  "El idioma se guarda en este dispositivo.": "The language is saved on this device.",
  "Notas del repaso": "Review notes",
  "Cerrar selector de notas": "Close note selector",
  "Filtrar notas…": "Filter notes…",
  "Filtrar notas": "Filter notes",
  "Todas": "All",
  "Notas con tarjetas": "Notes with cards",
  "Solo las notas marcadas aportan tarjetas al repaso. La búsqueda no cambia la selección.": "Only checked notes contribute cards to the review. Searching does not change the selection.",
  "Aplicar selección": "Apply selection",
  "Editar oclusión": "Edit occlusion",
  "Cerrar editor de oclusión": "Close occlusion editor",
  "Arrastra la zona resaltada para moverla. Usa el tirador inferior derecho para cambiar el tamaño.": "Drag the highlighted area to move it. Use the bottom-right handle to resize it.",
  "Imagen de la tarjeta de oclusión": "Occlusion card image",
  "Zona de oclusión seleccionada": "Selected occlusion area",
  "Guardar oclusión": "Save occlusion",
  "Azul": "Blue",
  "Verde": "Green",
  "Violeta": "Violet",
  "Ámbar": "Amber",
  "Rosa": "Rose",
  "Cian": "Cyan",
  "Turquesa": "Teal",
  "Índigo": "Indigo",
  "Naranja": "Orange",
  "Fucsia": "Fuchsia",
  "Tema claro activado": "Light theme enabled",
  "Tema oscuro activado": "Dark theme enabled",
};

/**
 * Traducciones al chino simplificado. Se mantiene el español como idioma
 * canónico: la interfaz se escribe en español y este mapa la traduce.
 */
const chineseBySpanish: Record<string, string> = {
  "Editor": "编辑器",
  "Diarios": "日记",
  "Páginas": "页面",
  "Vista gráfica": "图谱视图",
  "Haz clic en un nodo para ver su contenido · Arrastra para mover · Doble clic para restablecer": "点击节点预览内容 · 拖动以移动 · 双击以重置",
  "Cerrar vista previa": "关闭预览",
  "Contenido de la nota": "页面内容",
  "Esta nota no tiene contenido.": "此页面没有内容。",
  "Imagen": "图片",
  "Tareas": "任务",
  "Todas las páginas": "所有页面",
  "Páginas recientes": "最近页面",
  "Buscar o crear nota...": "搜索或创建页面…",
  "No hay notas coincidentes.": "没有匹配的页面。",
  "Crear nota": "创建页面",
  "Seleccionar una carpeta de vault": "选择库文件夹",
  "Colapsar / Desplegar Barra Lateral (Ctrl+B)": "折叠/展开侧边栏 (Ctrl+B)",
  "Atrás": "后退",
  "Adelante": "前进",
  "Historial de Versiones (Snapshots)": "版本历史（快照）",
  "Convertir en mapa conceptual": "转换为概念图",
  "Mapa conceptual": "概念图",
  "Bullets de la nota": "页面项目符号",
  "Esta nota no tiene bullets para convertir en mapa.": "此页面没有可转换为图谱的项目符号。",
  "Arrastra para mover · Rueda del ratón para hacer zoom · Doble clic para centrar": "拖动以平移 · 滚轮缩放 · 双击居中",
  "Alejar": "缩小",
  "Acercar": "放大",
  "Centrar": "居中",
  "Cerrar": "关闭",
  "Eliminar Página Actual": "删除当前页面",
  "Ajustes y Apariencia": "设置与外观",
  "Configuración": "设置",
  "Apariencia": "外观",
  "Repaso": "复习",
  "Progreso": "进度",
  "Pomodoro": "番茄钟",
  "Exportar": "导出",
  "Avanzado": "高级",
  "Orden de repaso": "复习顺序",
  "Elige qué tarjetas quieres ver primero al iniciar una sesión de repaso.": "选择开始复习时优先显示的卡片。",
  "Orden de las tarjetas": "卡片顺序",
  "Nuevas primero": "新卡优先",
  "Repasos primero": "复习卡优先",
  "Orden mezclado": "混合顺序",
  "Orden de repaso actualizado.": "复习顺序已更新。",
  "Recalcular propiedades": "重新计算属性",
  "Actualiza las propiedades de programación de todas las tarjetas del vault.": "更新库中所有卡片的调度属性。",
  "Acción de recálculo": "重新计算操作",
  "Recalcular vencimientos": "重新计算到期日",
  "Restablecer FSRS": "重置 FSRS",
  "Recalcula la fecha de vencimiento usando la última revisión y el intervalo programado.": "根据上次复习和计划间隔重新计算到期日。",
  "Elimina las propiedades de programación FSRS y convierte todas las tarjetas en nuevas. Esta acción no se puede deshacer.": "删除 FSRS 调度属性并将所有卡片变为新卡。此操作无法撤销。",
  "Aplicar recálculo": "应用重新计算",
  "Recalcular fechas": "重新计算日期",
  "Restablecer propiedades": "重置属性",
  "Procesando...": "处理中…",
  "Se eliminará el progreso de repaso de todas las tarjetas y volverán a contar como nuevas. ¿Continuar?": "所有卡片的复习进度将被删除并重新计为新卡。是否继续？",
  "Tarjetas actualizadas:": "已更新卡片：",
  "No había tarjetas que actualizar.": "没有需要更新的卡片。",
  "No se pudieron actualizar las propiedades de las tarjetas.": "无法更新卡片属性。",
  "Tema Visual": "主题",
  "Color de interfaz": "界面颜色",
  "Modo Oscuro / Claro": "深色/浅色模式",
  "Alternar Modo": "切换主题",
  "Modo Claro Activo": "浅色模式已启用",
  "Modo Oscuro Activo": "深色模式已启用",
  "Luminosidad del glow": "光晕亮度",
  "Tipografía del Editor": "编辑器字体",
  "Tipografía del sistema": "系统字体",
  "Selecciona cualquier tipografía instalada en tu dispositivo.": "选择设备上安装的任意字体。",
  "-- Seleccionar tipografía del sistema --": "-- 选择系统字体 --",
  "Seleccionar tipografía instalada en el sistema": "选择系统已安装字体",
  "Tipografía del sistema aplicada": "已应用系统字体",
  "Sans (sistema)": "无衬线（系统）",
  "Serif (Georgia)": "衬线（Georgia）",
  "Mono (sistema)": "等宽（系统）",
  "Ancho de página": "页面宽度",
  "Atajos de teclado para Flashcards": "闪卡键盘快捷键",
  "Elige la tecla que califica cada tarjeta durante el repaso.": "选择复习时给每张卡片评分的按键。",
  "Tecla para \"Otra vez\"": "「重来」按键",
  "Tecla para \"Difícil\"": "「困难」按键",
  "Tecla para \"Bien\"": "「良好」按键",
  "Tecla para \"Fácil\"": "「简单」按键",
  "Tiempo de enfoque (minutos)": "专注时间（分钟）",
  "Descanso corto (minutos)": "短休息（分钟）",
  "Descanso largo (minutos)": "长休息（分钟）",
  "Sesiones antes del descanso largo": "长休息前的专注次数",
  "Mostrar en la barra superior": "在顶栏显示",
  "Configura los tiempos de enfoque y descanso, y cuántas sesiones completar antes de un descanso largo.": "设置专注与休息时长，以及长休息前完成的专注次数。",
  "Enfoque": "专注",
  "Descanso corto": "短休息",
  "Descanso largo": "长休息",
  "Iniciar": "开始",
  "Pausar": "暂停",
  "Reiniciar": "重置",
  "Ciclo completado. Disfruta de un descanso largo.": "周期完成。享受长休息吧。",
  "Pomodoro completado. Tómate un descanso corto.": "番茄钟完成。休息一下吧。",
  "Descanso completado. ¡A seguir repasando!": "休息结束。继续复习吧！",
  "Exportar notas": "导出笔记",
  "Exportar a PDF": "导出为 PDF",
  "Markdown (.zip)": "Markdown (.zip)",
  "Exportar CSV": "导出 CSV",
  "Exportar JSON": "导出 JSON",
  "Mantenimiento": "维护",
  "Estas acciones no eliminan tus notas. La limpieza de adjuntos solo borra imágenes de": "这些操作不会删除你的笔记。附件清理只会删除以下目录中未被引用的图片：",
  "que no estén referenciadas en ninguna nota.": "未被任何页面引用的图片。",
  "Borrar propiedades de los bullets": "清除项目符号属性",
  "Borrar caché": "清除缓存",
  "Borrar estadísticas de repaso": "清除复习统计",
  "Borrar estadísticas": "清除统计",
  "Se borrarán las estadísticas de repaso: repasos de hoy, repasos totales, minutos de enfoque y los puntos del átomo de progreso. La programación FSRS de las tarjetas no se modificará. ¿Continuar?": "复习统计将被清除：今日复习、总复习、专注分钟和进度原子点数。卡片的 FSRS 调度不会改变。是否继续？",
  "Estadísticas de repaso borradas.": "复习统计已清除。",
  "Recargar aplicación": "重新加载应用",
  "Eliminar imágenes no usadas de assets": "删除未使用的资源图片",
  "Borrar todos los snapshots": "删除所有快照",
  "Borrar propiedades": "清除属性",
  "Eliminar imágenes": "删除图片",
  "Borrar todos": "全部删除",
  "Recargar": "重新加载",
  "La limpieza de adjuntos requiere la aplicación de escritorio.": "附件清理需要桌面应用。",
  "Se revisarán todas las notas y se eliminarán de assets las imágenes que no estén referenciadas en ninguna página. Esta acción no se puede deshacer. ¿Continuar?": "将扫描所有页面，并删除 assets 中未被任何页面引用的图片。此操作无法撤销。是否继续？",
  "Guardando notas antes de revisar los adjuntos…": "正在保存页面以便检查附件…",
  "Buscando imágenes no usadas…": "正在查找未使用的图片…",
  "No se encontraron imágenes en la carpeta assets.": "assets 文件夹中没有图片。",
  "No había imágenes sin usar en assets.": "assets 中没有未使用的图片。",
  "No se pudo completar la limpieza de adjuntos.": "无法完成附件清理。",
  "No se pudieron eliminar los adjuntos sin usar. Revisa la consola.": "无法删除未使用的附件。请查看控制台。",
  "Se eliminarán las propiedades de todos los bullets y el Frontmatter de las páginas del vault activo. El texto de las notas y sus archivos se conservarán. ¿Continuar?": "当前库中所有项目符号属性和页面 Frontmatter 将被删除。笔记文本和文件会保留。是否继续？",
  "No se pudieron guardar todas las notas. Revisa la consola y el estado del vault.": "无法保存所有页面。请查看控制台和库状态。",
  "Se borrarán los cachés web temporales y los datos de sesión de esta aplicación. Las notas, archivos y preferencias guardadas se conservarán.": "将清除此应用的临时网页缓存和会话数据。笔记、文件和已保存的偏好会保留。",
  "Caché temporal borrada.": "临时缓存已清除。",
  "No se pudo borrar toda la caché temporal. Revisa la consola para más detalles.": "无法清除全部临时缓存。请查看控制台了解详情。",
  "Se borrarán todas las versiones guardadas de todas las notas en chronos/. Las notas originales no se tocarán. ¿Continuar?": "将删除 chronos/ 中所有页面的已保存版本。原始笔记不会被改动。是否继续？",
  "La interfaz se recargará. Las notas guardadas no se modificarán.": "界面将重新加载。已保存的页面不会改变。",
  "Renombrar nota": "重命名页面",
  "Nombre de la nota": "页面名称",
  "Cancelar": "取消",
  "Guardar": "保存",
  "Confirmar acción": "确认操作",
  "Menú": "菜单",
  "Texto": "文本",
  "Bullet": "项目符号",
  "Hueco Cloze (==...==)": "填空（==…==）",
  "Crear Hueco Cloze (==...==)": "创建填空（==…==）",
  "Crear Flashcard (#card)": "创建闪卡（#card）",
  "Convertir a Flashcard (#card)": "转换为闪卡（#card）",
  "Limpiar formato": "清除格式",
  "Navegación": "导航",
  "Menú de navegación": "导航菜单",
  "Crear Oclusión de Imagen": "创建图片遮挡",
  "Insertar imagen": "插入图片",
  "Alternar Tarea (TODO / DOING / DONE)": "切换任务状态（TODO / DOING / DONE）",
  "Mover arriba": "上移",
  "Mover abajo": "下移",
  "Copiar": "复制",
  "Copiar selección": "复制所选内容",
  "Copiar bullet": "复制项目符号",
  "Pegar": "粘贴",
  "Pegar selección": "粘贴所选内容",
  "Pegar sin formato": "粘贴为纯文本",
  "No se pudo acceder al portapapeles.": "无法访问剪贴板。",
  "El texto pegado era demasiado largo y se recortó.": "粘贴的文本过长，已被截断。",
  "Copiar bullets seleccionados": "复制所选项目符号",
  "Cortar": "剪切",
  "Cortar selección": "剪切所选内容",
  "Cortar bullet": "剪切项目符号",
  "Cortar bullets seleccionados": "剪切所选项目符号",
  "Borrar selección": "删除所选内容",
  "Borrar bullet": "删除项目符号",
  "Borrar bullets seleccionados": "删除所选项目符号",
  "Eliminar bullet": "删除项目符号",
  "Abrir nota": "打开页面",
  "Renombrar": "重命名",
  "Copiar enlace [[...]]": "复制链接 [[…]]",
  "Eliminar nota": "删除页面",
  "Oclusión de imagen": "图片遮挡",
  "Arrastra sobre la imagen para crear tarjetas que oculten zonas.": "在图片上拖动以创建遮挡区域的卡片。",
  "Guardar oclusiones": "保存遮挡",
  "Flashcards": "闪卡",
  "Repasar": "复习",
  "Explorador de Tarjetas": "卡片浏览器",
  "Explorador de tarjetas": "卡片浏览器",
  "Mostrar Respuesta (Espacio)": "显示答案（空格）",
  "Reiniciar Sesión": "重新开始复习",
  "Otra vez": "重来",
  "Difícil": "困难",
  "Bien": "良好",
  "Fácil": "简单",
  "BÁSICA": "基础",
  "CLOZE": "填空",
  "IMAGEN": "图片",
  "Origen:": "来源：",
  "Próximo repaso": "下次复习",
  "Último repaso": "上次复习",
  "Creada": "创建于",
  "Sin registro": "无记录",
  "Fecha no válida": "无效日期",
  "Fecha": "日期",
  "Fecha de vencimiento": "到期日",
  "Editar fecha de vencimiento": "编辑到期日",
  "Asignar fecha de vencimiento": "设置到期日",
  "Déjalo vacío para quitar la fecha.": "留空以移除日期。",
  "Fecha de vencimiento actualizada.": "到期日已更新。",
  "Fecha de vencimiento eliminada.": "到期日已移除。",
  "No se encontró la nota de la tarea.": "未找到任务所属页面。",
  "No se encontró la tarea.": "未找到任务。",
  "No se pudo guardar la fecha de vencimiento.": "无法保存到期日。",
  "Ordenar por:": "排序方式：",
  "Vencimiento": "到期日",
  "Creación": "创建日期",
  "Sin tarjetas": "无卡片",
  "Sin tarjetas pendientes": "没有待复习卡片",
  "¡Completado!": "已完成！",
  "¡Has completado todas las tarjetas pendientes con FSRS-4.5!": "你已完成 FSRS-4.5 的所有到期卡片！",
  "No hay tarjetas pendientes de repaso. Vuelve cuando llegue su fecha de vencimiento.": "没有待复习的卡片。到期后再来吧。",
  "No se encontraron tarjetas en las notas del vault.": "库中的页面没有卡片。",
  "Notas incluidas en el repaso": "纳入复习的页面",
  "Marcar todo": "全选",
  "Ninguna": "无",
  "Guardar selección": "保存选择",
  "Cambios sin guardar": "未保存的更改",
  "Buscar en el título...": "搜索标题…",
  "Filtrar notas por palabra en el título": "按标题中的词筛选页面",
  "Orden de la lista de notas": "页面列表排序",
  "Nombre A-Z": "名称 A-Z",
  "Nombre Z-A": "名称 Z-A",
  "Creación (más reciente)": "创建（最新）",
  "Creación (más antigua)": "创建（最早）",
  "No hay notas cuyo título coincida con la búsqueda.": "没有标题匹配搜索的页面。",
  "No hay notas seleccionadas: no se repasará ninguna tarjeta.": "未选择页面：不会复习任何卡片。",
  "Sin tarjetas pendientes en las notas seleccionadas": "所选页面没有待复习卡片",
  "No hay tarjetas pendientes en las notas seleccionadas. Vuelve cuando llegue su fecha de vencimiento o amplía la selección de notas.": "所选页面没有到期卡片。到期后再来，或扩大页面选择范围。",
  "No hay ninguna nota seleccionada para el repaso. Marca y guarda las notas en Ajustes › Flashcards.": "没有选择用于复习的页面。请在设置 › 闪卡中勾选并保存页面。",
  "No se encontraron notas con flashcards en el vault.": "库中没有包含闪卡的页面。",
  "Se repasarán las tarjetas de todas las notas.": "将复习所有页面的卡片。",
  "Se repasarán solo las tarjetas de las notas seleccionadas.": "仅复习所选页面的卡片。",
  "Cada nota actúa como un mazo que contiene sus flashcards. Selecciona las notas cuyas tarjetas se repasarán y pulsa \"Guardar selección\"; las desmarcadas quedarán excluidas de la sesión de repaso.": "每个页面相当于一副包含其闪卡的牌组。选择要复习的页面并点击「保存选择」；未勾选的页面将不参与复习。",
  "tarjeta": "卡片",
  "tarjetas": "卡片",
  "No se pudo renombrar la nota.": "无法重命名页面。",
  "No hay cambios que deshacer.": "没有可撤销的更改。",
  "No hay cambios que rehacer.": "没有可重做的更改。",
  "Cambio deshecho.": "已撤销更改。",
  "Cambio rehecho.": "已重做更改。",
  "Snapshots manuales": "手动快照",
  "Snapshots por nota": "每页快照",
  "Seguimiento de snapshots activos": "活动快照跟踪",
  "Abrir historial de esta nota": "打开此页面的历史",
  "No hay notas con snapshots activos.": "没有启用快照的页面。",
  "Los snapshots se activan desde el historial de cada nota. Aquí puedes ver las notas que los tienen activos, cuántas versiones guardan y borrarlas. Al vencer el periodo configurado, las versiones se eliminan automáticamente y solo queda la nota original. Las copias viven en la carpeta visible chronos/ dentro del vault.": "快照从每个页面的历史中启用。这里可以查看已启用快照的页面、保存的版本数并删除它们。配置的期限结束后，版本会自动删除，只保留原始页面。副本保存在库内的可见文件夹 chronos/ 中。",
  "Al activar se guarda una versión ahora y otra cada intervalo si la nota cambió. La ventana dura como máximo 30 días; al vencer, las versiones se eliminan y solo queda la nota original.": "启用时会立即保存一个版本，之后若页面有变化则按间隔保存。窗口最长持续 30 天；到期后版本会被删除，只保留原始页面。",
  "Los snapshots se guardan en chronos/ mientras la nota esté activa. Al vencer el periodo o desactivarlos se eliminan.": "页面启用期间，快照保存在 chronos/ 中。期限结束或停用后会被删除。",
  "Guardado": "已保存",
  "Snapshot automático programado": "计划自动快照",
  "Snapshot inicial": "初始快照",
  "Desactivar snapshots": "停用快照",
  "Activar/Desactivar snapshots de esta nota": "启用/停用此页面的快照",
  "Desactivar y eliminar": "停用并删除",
  "Desactivar los snapshots de esta nota eliminará todas las versiones guardadas. ¿Continuar?": "停用此页面的快照将删除所有已保存版本。是否继续？",
  "Borrar snapshots": "删除快照",
  "Snapshots eliminados.": "快照已删除。",
  "No se pudieron borrar los snapshots.": "无法删除快照。",
  "No se pudo cargar el seguimiento de snapshots.": "无法加载活动快照列表。",
  "Quedan": "剩余",
  "Cada": "每",
  "versión guardada": "个已保存版本",
  "versiones guardadas": "个已保存版本",
  "SinNotas guarda cada cambio al instante en tu vault local. Los snapshots no se crean automáticamente: al activar una ventana, la aplicación registra versiones recuperables de tus notas durante ese periodo. Las copias se guardan en la carpeta visible chronos/ dentro del vault.": "SinNotas 会将每次更改立即保存到本地库。快照不会自动创建：启用窗口后，应用会在该期间记录可恢复的页面版本。副本保存在库内的可见文件夹 chronos/ 中。",
  "Snapshots desactivados.": "快照已停用。",
  "Snapshots activados.": "快照已启用。",
  "Snapshots desactivados. Actívalos para registrar versiones automáticamente.": "快照已关闭。启用后可自动记录版本。",
  "Snapshots activos": "快照已启用",
  "Snapshots no disponibles fuera de la aplicación.": "应用外无法使用快照。",
  "Snapshots en pausa: el reloj del sistema retrocedió.": "快照已暂停：系统时钟回退。",
  "La ventana de snapshots expiró. Actívala de nuevo para seguir registrando versiones.": "快照窗口已过期。请重新启用以继续记录版本。",
  "La duración debe estar entre 1 y 30 días.": "期限必须介于 1 到 30 天。",
  "El intervalo debe estar entre 1 y 168 horas.": "间隔必须介于 1 到 168 小时。",
  "El límite diario debe estar entre 1 y 96 snapshots.": "每日上限必须介于 1 到 96 个快照。",
  "No se pudieron activar los snapshots. Revisa el vault e inténtalo de nuevo.": "无法启用快照。请检查库后重试。",
  "No se pudieron desactivar los snapshots.": "无法停用快照。",
  "No se pudo restaurar el snapshot.": "无法恢复快照。",
  "Activa una ventana de snapshots o espera al siguiente intervalo para registrar versiones.": "启用快照窗口，或等待下一个间隔以记录版本。",
  "Activar snapshots": "启用快照",
  "Desactivar": "停用",
  "Abrir historial": "打开历史",
  "Duración (días)": "期限（天）",
  "Intervalo (horas)": "间隔（小时）",
  "Límite diario por nota": "每页每日上限",
  "La ventana dura como máximo 30 días. Solo se crea un snapshot si la nota cambió y el intervalo ya se cumplió.": "窗口最长持续 30 天。仅当页面发生变化且间隔已到时才创建快照。",
  "Los snapshots se guardan en chronos/ solo mientras una ventana está activa.": "仅在窗口启用期间，快照才会保存到 chronos/。",
  "Carpeta": "文件夹",
  "quedan": "剩余",
  "cada": "每",
  "máx.": "最多",
  "al día": "每天",
  "sin límite diario": "无每日上限",
  "Snapshot": "快照",
  "Referencias vinculadas": "反向链接",
  "Todas las Páginas": "所有页面",
  "Título": "标题",
  "Bloques": "块",
  "Tipo": "类型",
  "Actualizado": "已更新",
  "Acciones": "操作",
  "Diario": "日记",
  "Página": "页面",
  "Reciente": "最近",
  "Eliminar página": "删除页面",
  "Selecciona una fecha para crear tu primer diario.": "选择日期以创建第一篇日记。",
  "Selecciona una versión para inspeccionar su contenido.": "选择版本以预览其内容。",
  "Vista previa de la versión": "版本预览",
  "Restaurar esta Versión": "恢复此版本",
  "Sin snapshots previos aún.": "尚无历史快照。",
  "Tareas activas": "活动任务",
  "Tarea completada": "任务已完成",
  "puntos para el átomo de progreso": "进度原子点数",
  "Por hacer": "待办",
  "Haciendo": "进行中",
  "Hecho": "已完成",
  "Área": "区域",
  "Todavía no hay áreas ocultas. Arrastra sobre la imagen para añadir una.": "尚无遮挡区域。在图片上拖动以添加。",
  "Eliminar área": "删除区域",
  "Cambiar tema": "切换主题",
  "Idioma de la interfaz": "界面语言",
  "Automático (Sistema)": "自动（系统）",
  "Español": "西班牙语",
  "Inglés": "英语",
  "Herramientas de oclusión": "遮挡工具",
  "Forma": "形状",
  "Rectángulo": "矩形",
  "Elipse": "椭圆",
  "Polígono": "多边形",
  "Color": "颜色",
  "Pista / texto": "提示/文本",
  "Escribe una pista para el área seleccionada": "为所选区域输入提示",
  "Reducir al 90%": "缩小到 90%",
  "Ampliar al 110%": "放大到 110%",
  "Finalizar polígono": "完成多边形",
  "Dibuja el polígono haciendo clic en cada punto y finalízalo con doble clic.": "依次点击每个点绘制多边形，双击完成。",
  "Buscar": "搜索",
  "Área seleccionada": "所选区域",
  "Vault local": "本地库",
  "Welcome to SinNotas": "欢迎使用 SinNotas",
  "Dyslexic": "阅读障碍",
  "Vistas de Flashcards": "闪卡视图",
  "Cargando preguntas de tus notas...": "正在从笔记加载问题…",
  "Respuesta revelada aquí.": "答案将在此显示。",
  "Tarjeta 0 de 0": "第 0 张，共 0 张",
  "0 tarjetas": "0 张卡片",
  "0 tareas activas": "0 个活动任务",
  "0 páginas": "0 个页面",
  "Seguimiento de tareas": "任务看板",
  "Ocultar completados": "隐藏已完成",
  "POR HACER (TODO / LATER)": "待办（TODO / LATER）",
  "HACIENDO (DOING / NOW)": "进行中（DOING / NOW）",
  "HECHO (DONE)": "已完成（DONE）",
  "Mover a HACIENDO": "移至进行中",
  "Título de Página": "页面标题",
  "Última Actualización": "最后更新",
  "Historial de Versiones: Nota": "页面版本历史",
  "Imagen para oclusión": "用于遮挡的图片",
  "No se encontró el bloque de la imagen.": "未找到图片块。",
  "No se encontró el bloque donde guardar las oclusiones.": "未找到保存遮挡的块。",
  "La selección de vaults requiere la aplicación de escritorio.": "选择库需要桌面应用。",
  "No se pudo abrir el vault. Revisa los permisos de la carpeta e inténtalo de nuevo.": "无法打开库。请检查文件夹权限后重试。",
  "No se pudo acceder al vault local de la aplicación.": "无法访问应用的本地库。",
  "No se pudo activar la importación de imágenes por arrastre.": "无法启用拖放图片导入。",
  "Ocurrió un error en un diálogo. Se cerró para liberar la interfaz.": "对话框发生错误，已关闭以恢复界面。",
  "No se pudo cargar la imagen. Se cerró el editor de oclusiones.": "无法加载图片。遮挡编辑器已关闭。",
  "No se pudo abrir la imagen. Se cerró el editor de oclusiones.": "无法打开图片。遮挡编辑器已关闭。",
  "No se pudieron guardar las oclusiones. El editor se cerrará sin conservar esos cambios.": "无法保存遮挡。编辑器将关闭且不保留这些更改。",
  "Caché temporal borrada": "临时缓存已清除",
  "No se pudo exportar. Revisa la consola para más detalles.": "导出失败。请查看控制台了解详情。",
  "Abriendo vista de impresión para guardar como PDF.": "正在打开打印视图以保存为 PDF。",
  "El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.": "浏览器阻止了打印窗口。请允许弹出窗口后重试。",
  "No se pudo preparar el PDF. Revisa la consola para más detalles.": "无法准备 PDF。请查看控制台了解详情。",
  "No se encontró el bloque donde insertar la imagen.": "未找到插入图片的块。",
  "No se pudo copiar la imagen al vault. Comprueba su formato y tamaño (máximo 5 MB).": "无法将图片复制到库。请检查格式和大小（最大 5 MB）。",
  "No hay retroenlaces vinculados a esta página.": "此页面没有反向链接。",
  "Propiedades de página": "页面属性",
  "¿Estás seguro de que deseas eliminar permanentemente esta página?": "确定要永久删除此页面吗？",
  "Página eliminada con éxito": "页面已成功删除",
  "Guardado automático de cambios": "更改已自动保存",
  "¿Deseas restaurar la nota a esta versión?": "要将页面恢复到此版本吗？",
  "¡Nota restaurada con éxito a la versión seleccionada!": "页面已成功恢复到所选版本！",
  "El portapapeles no está disponible.": "剪贴板不可用。",
  "Mié": "周三",
  "Sáb": "周六",
  "Dom": "周日",
  "Lun": "周一",
  "Mar": "周二",
  "Jue": "周四",
  "Vie": "周五",
  "Mes anterior": "上个月",
  "Mes siguiente": "下个月",
  "diario existente": "现有日记",
  "crear diario": "创建日记",
  "Por hacer (Después)": "待办（稍后）",
  "En progreso (Haciendo)": "进行中",
  "Completado (Finalizado)": "已完成",
  "Borrar propiedades del bullet": "清除项目符号属性",
  "Insertar query / consulta": "插入查询",
  "Mando (Joystick)": "手柄",
  "Gamepad (Mando)": "手柄",
  "Mando desactivado": "手柄已停用",
  "Mando conectado": "手柄已连接",
  "Mando no detectado": "未检测到手柄",
  "Activar soporte de gamepad": "启用手柄支持",
  "Tipo de mando": "手柄类型",
  "Detectar mando": "检测手柄",
  "Buscando gamepad... pulse un botón...": "正在查找手柄…请按一个按钮…",
  "Configura un mando Bluetooth o USB para controlar Flashcards y otras funciones.": "配置蓝牙或 USB 手柄以控制闪卡和其他功能。",
  "Fijar nota": "固定页面",
  "Desfijar nota": "取消固定页面",
  "Asigna los botones del mando a las respuestas de FSRS (Otra vez, Difícil, Bien, Fácil).": "将手柄按钮分配给 FSRS 评分（重来、困难、良好、简单）。",
  "Mapeo de botones para Flashcards": "闪卡按钮映射",
  "Botón para": "按钮用于",
  "No asignado": "未分配",
  "Mapeo de botones adicionales": "其他按钮映射",
  "Visitar repositorio": "访问仓库",
  // Ajustes > Grafo.
  "Grafo": "图谱",
  "Secciones de ajustes": "设置分区",
  "Grupos de color por nombre": "按名称分组的颜色",
  "Pinta los nodos cuyo título contenga el texto indicado. La regla más específica (texto más largo) tiene prioridad y los colores manuales de cada nota siguen por encima de los grupos.": "为标题包含指定文本的节点着色。最具体的规则（文本最长）优先，单个页面的手动颜色仍高于分组。",
  "Texto del nombre (ej. Diario, Proyecto…)": "名称文本（例如：日记、项目……）",
  "Texto del nombre para el grupo de color": "颜色分组的名称文本",
  "Color del grupo": "分组颜色",
  "Añadir grupo": "添加分组",
  "Fuerzas de la simulación": "模拟力",
  "Repulsión": "排斥力",
  "Fuerza de enlaces": "连接强度",
  "Distancia de enlaces": "连接距离",
  "Atracción al centro": "中心吸引力",
  "Fuerza de colisión": "碰撞力",
  "Amortiguación": "阻尼",
  "Tamaño de los nodos": "节点大小",
  "Radio base": "基础半径",
  "Radio por conexión": "每个连接的半径",
  "Radio máximo": "最大半径",
  "Líneas y títulos": "连线与标题",
  "Grosor de enlaces": "连接线宽度",
  "Grosor resaltado": "高亮宽度",
  "Zoom para mostrar títulos": "显示标题的缩放级别",
  "Los títulos aparecen con fundido al acercar hasta este zoom; al pasar el cursor o seleccionar un nodo se muestran siempre.": "缩放到此级别时节点标题会淡入；悬停或选择节点时始终显示。",
  "Restablecer valores del grafo": "重置图谱数值",
  "Ajustes del grafo restablecidos.": "图谱设置已重置。",
  "📌 Fijadas": "📌 已固定",
  "Recientes": "最近",
  "Ver todas las notas": "查看所有页面",
  "Abrir con aplicación predeterminada": "用默认应用打开",
  "No se pudo abrir la nota con la aplicación predeterminada.": "无法用默认应用打开页面。",
  "En el contenido": "页面内容中",
  // Vista móvil de repaso (cadenas propias de review-app.ts).
  "Seleccionar notas para repasar": "选择要复习的页面",
  "Seleccionar notas": "选择页面",
  "Cambiar idioma": "切换语言",
  "Idioma": "语言",
  "Cambiar apariencia": "更改外观",
  "Actualizar tarjetas": "刷新卡片",
  "Abrir otra bóveda": "打开其他库",
  "Progreso del repaso": "复习进度",
  "Todo al día": "全部完成",
  "No hay tarjetas pendientes en esta bóveda.": "此库中没有到期卡片。",
  "Deshacer": "撤销",
  "Rehacer": "重做",
  "Editar tarjeta": "编辑卡片",
  "Mostrar respuesta": "显示答案",
  "Cerrar editor": "关闭编辑器",
  "Pregunta": "问题",
  "Respuesta": "答案",
  "Texto de la tarjeta": "卡片文本",
  "Solo se modifica este bloque. Se conservan las propiedades FSRS, la etiqueta #card y el resto de la nota.": "仅修改此块。FSRS 属性、#card 标签和页面其余内容都会保留。",
  "Cerrar apariencia": "关闭外观",
  "Tema": "主题",
  "Claro": "浅色",
  "Oscuro": "深色",
  "Elige el tema de la app. Se guarda en este dispositivo y se comparte con la versión de escritorio.": "选择应用主题。它会保存在此设备上并与桌面版共享。",
  "Color de acento": "强调色",
  "Colores de acento": "强调色",
  "El color se guarda en este dispositivo y se comparte con la versión de escritorio.": "颜色会保存在此设备上并与桌面版共享。",
  "Más opciones": "更多选项",
  "El idioma se guarda en este dispositivo.": "语言会保存在此设备上。",
  "Notas del repaso": "复习页面",
  "Cerrar selector de notas": "关闭页面选择器",
  "Filtrar notas…": "筛选页面…",
  "Filtrar notas": "筛选页面",
  "Todas": "全部",
  "Notas con tarjetas": "含卡片的页面",
  "Solo las notas marcadas aportan tarjetas al repaso. La búsqueda no cambia la selección.": "只有勾选的页面会提供复习卡片。搜索不会改变选择。",
  "Aplicar selección": "应用选择",
  "Editar oclusión": "编辑遮挡",
  "Cerrar editor de oclusión": "关闭遮挡编辑器",
  "Arrastra la zona resaltada para moverla. Usa el tirador inferior derecho para cambiar el tamaño.": "拖动高亮区域以移动，使用右下角的手柄调整大小。",
  "Imagen de la tarjeta de oclusión": "遮挡卡片图片",
  "Zona de oclusión seleccionada": "所选遮挡区域",
  "Guardar oclusión": "保存遮挡",
  "Azul": "蓝色",
  "Verde": "绿色",
  "Violeta": "紫色",
  "Ámbar": "琥珀色",
  "Rosa": "玫瑰色",
  "Cian": "青色",
  "Turquesa": "蓝绿色",
  "Índigo": "靛蓝色",
  "Naranja": "橙色",
  "Fucsia": "紫红色",
  "Tema claro activado": "已启用浅色主题",
  "Tema oscuro activado": "已启用深色主题",
};

const spanishByEnglish = Object.fromEntries(
  Object.entries(englishBySpanish).map(([spanish, english]) => [english, spanish])
);

const spanishByChinese = Object.fromEntries(
  Object.entries(chineseBySpanish).map(([spanish, chinese]) => [chinese, spanish])
);

const excludedContentSelector = [
  ".block-editor",
  ".page-title",
  ".headbar-page-breadcrumb",
  ".vault-tree-page",
  ".backlink-snippet",
  ".flashcard-explorer-question",
  ".flashcard-explorer-answer",
  ".history-preview-content",
  ".card-question",
  ".card-answer",
  ".image-occlusion-hint",
  ".graph-preview-title",
  ".graph-preview-body",
  ".graph-preview-meta",
  ".pages-list",
  ".sidebar-pages-list",
  "#active-vault-name",
  // Datos de usuario en la vista móvil: nunca deben traducirse.
  ".mobile-question",
  ".mobile-answer",
  ".mobile-card-source",
  ".mobile-notes-list",
  ".mobile-card-meta",
  ".mobile-occlusion-stage",
  "[contenteditable='true']",
].join(",");

let language: InterfaceLanguage = "es";
let preference: LanguagePreference = "auto";
const originalTexts = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const localizedTexts = new WeakMap<Text, string>();
const localizedAttributes = new WeakMap<Element, Map<string, string>>();
const reverseDictionary = new Map<string, string>([
  ...Object.entries(spanishByEnglish),
  ...Object.entries(spanishByChinese),
]);
const languageChangeListeners = new Set<(language: InterfaceLanguage) => void>();

function canonicalSpanish(value: string): string {
  const trimmed = value.trim();
  const reversed = reverseDictionary.get(trimmed);
  if (reversed) return reversed;
  const cardMatch = trimmed.match(/^Card (\d+) of (\d+)$/);
  if (cardMatch) return `Tarjeta ${cardMatch[1]} de ${cardMatch[2]}`;
  const vaultMatch = trimmed.match(/^Active vault: (.+)$/);
  if (vaultMatch) return `Vault activo: ${vaultMatch[1]}`;
  const createdMatch = trimmed.match(/^Nota "(.+)" creada$/);
  if (createdMatch) return `Page "${createdMatch[1]}" created`;
  const areaMatch = trimmed.match(/^Area (\d+)$/);
  if (areaMatch) return `Área ${areaMatch[1]}`;
  const cardsMatch = trimmed.match(/^(\d+) cards?$/);
  if (cardsMatch) return `${cardsMatch[1]} tarjeta${cardsMatch[1] === "1" ? "" : "s"}`;
  const pageCardCountMatch = trimmed.match(/^(.+) \((\d+) cards?\)$/);
  if (pageCardCountMatch) {
    return `${pageCardCountMatch[1]} (${pageCardCountMatch[2]} tarjeta${pageCardCountMatch[2] === "1" ? "" : "s"})`;
  }
  const pagesMatch = trimmed.match(/^(\d+) pages?$/);
  if (pagesMatch) return `${pagesMatch[1]} página${pagesMatch[1] === "1" ? "" : "s"}`;
  const tasksMatch = trimmed.match(/^(\d+) active tasks?$/);
  if (tasksMatch) return `${tasksMatch[1]} tareas activas`;
  const sourceMatch = trimmed.match(/^Source: (.+)$/);
  if (sourceMatch) return `Origen: ${sourceMatch[1]}`;
  const renameMatch = trimmed.match(/^Page renamed to "(.+)"$/);
  if (renameMatch) return `Página renombrada a "${renameMatch[1]}"`;
  const deletedMatch = trimmed.match(/^Page "(.+)" deleted$/);
  if (deletedMatch) return `Página "${deletedMatch[1]}" eliminada`;
  const copiedMatch = trimmed.match(/^Link \[\[(.+)\]\] copied to clipboard!$/);
  if (copiedMatch) return `¡Enlace [[${copiedMatch[1]}]] copiado al portapapeles!`;
  const occlusionMatch = trimmed.match(/^(\d+) occlusion\(s\) saved\.$/);
  if (occlusionMatch) return `${occlusionMatch[1]} oclusión(es) guardada(s).`;
  const propertiesMatch = trimmed.match(/^Page properties \((\d+)\)$/);
  if (propertiesMatch) return `Propiedades de página (${propertiesMatch[1]})`;
  const versionHistoryMatch = trimmed.match(/^(?:Historial de Versiones|Version history): (.+)$/);
  if (versionHistoryMatch) return `Historial de Versiones: ${versionHistoryMatch[1]}`;
  const renameConfirmMatch = trimmed.match(/^Are you sure you want to permanently delete page "(.+)"\?$/);
  if (renameConfirmMatch) return `¿Estás seguro de que deseas eliminar permanentemente la página "${renameConfirmMatch[1]}"?`;
  const deleteConfirmMatch = trimmed.match(/^Delete page "(.+)" permanently\?$/);
  if (deleteConfirmMatch) return `¿Eliminar la página "${deleteConfirmMatch[1]}" permanentemente?`;
  const sidebarDeleteMatch = trimmed.match(/^Are you sure you want to delete page "(.+)"\?$/);
  if (sidebarDeleteMatch) return `¿Estás seguro de que deseas eliminar la página "${sidebarDeleteMatch[1]}"?`;
  const clearCacheMatch = trimmed.match(/^Could not clear the temporary cache: (.+)$/);
  if (clearCacheMatch) return `No se pudo borrar la caché temporal: ${clearCacheMatch[1]}`;
  const pdfExportMatch = trimmed.match(/^Could not prepare PDF export: (.+)$/);
  if (pdfExportMatch) return `No se pudo preparar la exportación a PDF: ${pdfExportMatch[1]}`;
  const deleteAreaMatch = trimmed.match(/^Eliminar área (\d+)$/);
  if (deleteAreaMatch) return `Eliminar área ${deleteAreaMatch[1]}`;
  return trimmed;
}

function localizedText(value: string): string {
  const canonical = canonicalSpanish(value);
  if (language === "en") {
    const direct = englishBySpanish[canonical];
    if (direct) return direct;
    const cardMatch = canonical.match(/^Tarjeta (\d+) de (\d+)$/);
    if (cardMatch) return `Card ${cardMatch[1]} of ${cardMatch[2]}`;
    const pageCardCountMatch = canonical.match(/^(.+) \((\d+) tarjetas?\)$/);
    if (pageCardCountMatch) {
      return `${pageCardCountMatch[1]} (${pageCardCountMatch[2]} card${pageCardCountMatch[2] === "1" ? "" : "s"})`;
    }
    const atomProgressMatch = canonical.match(/^(\d+) puntos? · (.+) \(Z=(\d+)\)$/);
    if (atomProgressMatch) {
      return `${atomProgressMatch[1]} point${atomProgressMatch[1] === "1" ? "" : "s"} · ${atomProgressMatch[2]} (Z=${atomProgressMatch[3]})`;
    }
    const vaultMatch = canonical.match(/^Vault activo: (.+)$/);
    if (vaultMatch) return `Active vault: ${vaultMatch[1]}`;
    const createdMatch = canonical.match(/^Nota "(.+)" creada$/);
    if (createdMatch) return `Page "${createdMatch[1]}" created`;
    const areaMatch = canonical.match(/^Área (\d+)$/);
    if (areaMatch) return `Area ${areaMatch[1]}`;
    const cardsMatch = canonical.match(/^(\d+) tarjetas?$/);
    if (cardsMatch) return `${cardsMatch[1]} card${cardsMatch[1] === "1" ? "" : "s"}`;
    const pagesMatch = canonical.match(/^(\d+) páginas?$/);
    if (pagesMatch) return `${pagesMatch[1]} page${pagesMatch[1] === "1" ? "" : "s"}`;
    const tasksMatch = canonical.match(/^(\d+) tareas activas$/);
    if (tasksMatch) return `${tasksMatch[1]} active task${tasksMatch[1] === "1" ? "" : "s"}`;
    const sourceMatch = canonical.match(/^Origen: (.+)$/);
    if (sourceMatch) return `Source: ${sourceMatch[1]}`;
    const renameMatch = canonical.match(/^Página renombrada a "(.+)"$/);
    if (renameMatch) return `Page renamed to "${renameMatch[1]}"`;
    const deletedMatch = canonical.match(/^Página "(.+)" eliminada$/);
    if (deletedMatch) return `Page "${deletedMatch[1]}" deleted`;
    const copiedMatch = canonical.match(/^¡Enlace \[\[(.+)\]\] copiado al portapapeles!$/);
    if (copiedMatch) return `Link [[${copiedMatch[1]}]] copied to clipboard!`;
    const occlusionMatch = canonical.match(/^(\d+) oclusión\(es\) guardada\(s\)\.$/);
    if (occlusionMatch) return `${occlusionMatch[1]} occlusion(s) saved.`;
    const propertiesMatch = canonical.match(/^Propiedades de página \((\d+)\)$/);
    if (propertiesMatch) return `Page properties (${propertiesMatch[1]})`;
    const versionHistoryMatch = canonical.match(/^Historial de Versiones: (.+)$/);
    if (versionHistoryMatch) return `Version history: ${versionHistoryMatch[1]}`;
    const renameConfirmMatch = canonical.match(/^¿Estás seguro de que deseas eliminar permanentemente la página "(.+)"\?$/);
    if (renameConfirmMatch) return `Are you sure you want to permanently delete page "${renameConfirmMatch[1]}"?`;
    const deleteConfirmMatch = canonical.match(/^¿Eliminar la página "(.+)" permanentemente\?$/);
    if (deleteConfirmMatch) return `Delete page "${deleteConfirmMatch[1]}" permanently?`;
    const sidebarDeleteMatch = canonical.match(/^¿Estás seguro de que deseas eliminar la página "(.+)"\?$/);
    if (sidebarDeleteMatch) return `Are you sure you want to delete page "${sidebarDeleteMatch[1]}"?`;
    const clearCacheMatch = canonical.match(/^No se pudo borrar la caché temporal: (.+)$/);
    if (clearCacheMatch) return `Could not clear the temporary cache: ${clearCacheMatch[1]}`;
    // Ajustes > Avanzado: mantenimiento (mensajes con conteos interpolados).
    const removedPropertiesMatch = canonical.match(/^Se borraron (\d+) propiedad\(es\) del vault\.$/);
    if (removedPropertiesMatch) {
      const removed = Number(removedPropertiesMatch[1]);
      return `Removed ${removed} propert${removed === 1 ? "y" : "ies"} from the vault.`;
    }
    const unusedRefMatch = canonical.match(/^No hay imágenes sin usar: las (\d+) imágenes de assets están referenciadas\.$/);
    if (unusedRefMatch) {
      return `No unused images: all ${unusedRefMatch[1]} asset images are referenced.`;
    }
    const removedUnusedMatch = canonical.match(/^Se eliminaron (\d+) de (\d+) imágenes sin usar\. Se conservaron (\d+)\. No se pudieron borrar (\d+) archivo\(s\)\.$/);
    if (removedUnusedMatch) {
      return `Removed ${removedUnusedMatch[1]} of ${removedUnusedMatch[2]} unused images. Kept ${removedUnusedMatch[3]}. Could not delete ${removedUnusedMatch[4]} file(s).`;
    }
    const keptUnusedMatch = canonical.match(/^Se eliminaron (\d+) de (\d+) imágenes sin usar\. Se conservaron (\d+)\.$/);
    if (keptUnusedMatch) {
      return `Removed ${keptUnusedMatch[1]} of ${keptUnusedMatch[2]} unused images. Kept ${keptUnusedMatch[3]}.`;
    }
    const cleanupCompleteMatch = canonical.match(/^Limpieza completada: (\d+) imagen\(es\) eliminada\(s\)\.$/);
    if (cleanupCompleteMatch) {
      return `Cleanup complete: ${cleanupCompleteMatch[1]} image(s) removed.`;
    }
    const cacheClearedMatch = canonical.match(/^Caché temporal borrada \((\d+) caché\(s\)\)\.$/);
    if (cacheClearedMatch) {
      return `Temporary cache cleared (${cacheClearedMatch[1]} cache(s)).`;
    }
    const pdfExportMatch = canonical.match(/^No se pudo preparar la exportación a PDF: (.+)$/);
    if (pdfExportMatch) return `Could not prepare PDF export: ${pdfExportMatch[1]}`;
    const deleteAreaMatch = canonical.match(/^Eliminar área (\d+)$/);
    if (deleteAreaMatch) return `Delete area ${deleteAreaMatch[1]}`;
    return canonical;
  }
  if (language === "zh") {
    const direct = chineseBySpanish[canonical];
    if (direct) return direct;
    const cardMatch = canonical.match(/^Tarjeta (\d+) de (\d+)$/);
    if (cardMatch) return `第 ${cardMatch[1]} 张，共 ${cardMatch[2]} 张`;
    const pageCardCountMatch = canonical.match(/^(.+) \((\d+) tarjetas?\)$/);
    if (pageCardCountMatch) {
      return `${pageCardCountMatch[1]}（${pageCardCountMatch[2]} 张卡片）`;
    }
    const atomProgressMatch = canonical.match(/^(\d+) puntos? · (.+) \(Z=(\d+)\)$/);
    if (atomProgressMatch) {
      return `${atomProgressMatch[1]} 点 · ${atomProgressMatch[2]} (Z=${atomProgressMatch[3]})`;
    }
    const vaultMatch = canonical.match(/^Vault activo: (.+)$/);
    if (vaultMatch) return `当前库：${vaultMatch[1]}`;
    const createdMatch = canonical.match(/^Nota "(.+)" creada$/);
    if (createdMatch) return `页面「${createdMatch[1]}」已创建`;
    const areaMatch = canonical.match(/^Área (\d+)$/);
    if (areaMatch) return `区域 ${areaMatch[1]}`;
    const cardsMatch = canonical.match(/^(\d+) tarjetas?$/);
    if (cardsMatch) return `${cardsMatch[1]} 张卡片`;
    const pagesMatch = canonical.match(/^(\d+) páginas?$/);
    if (pagesMatch) return `${pagesMatch[1]} 个页面`;
    const tasksMatch = canonical.match(/^(\d+) tareas activas$/);
    if (tasksMatch) return `${tasksMatch[1]} 个活动任务`;
    const sourceMatch = canonical.match(/^Origen: (.+)$/);
    if (sourceMatch) return `来源：${sourceMatch[1]}`;
    const renameMatch = canonical.match(/^Página renombrada a "(.+)"$/);
    if (renameMatch) return `页面已重命名为「${renameMatch[1]}」`;
    const deletedMatch = canonical.match(/^Página "(.+)" eliminada$/);
    if (deletedMatch) return `页面「${deletedMatch[1]}」已删除`;
    const copiedMatch = canonical.match(/^¡Enlace \[\[(.+)\]\] copiado al portapapeles!$/);
    if (copiedMatch) return `链接 [[${copiedMatch[1]}]] 已复制到剪贴板！`;
    const occlusionMatch = canonical.match(/^(\d+) oclusión\(es\) guardada\(s\)\.$/);
    if (occlusionMatch) return `${occlusionMatch[1]} 个遮挡已保存。`;
    const propertiesMatch = canonical.match(/^Propiedades de página \((\d+)\)$/);
    if (propertiesMatch) return `页面属性（${propertiesMatch[1]}）`;
    const versionHistoryMatch = canonical.match(/^Historial de Versiones: (.+)$/);
    if (versionHistoryMatch) return `版本历史：${versionHistoryMatch[1]}`;
    const renameConfirmMatch = canonical.match(/^¿Estás seguro de que deseas eliminar permanentemente la página "(.+)"\?$/);
    if (renameConfirmMatch) return `确定要永久删除页面「${renameConfirmMatch[1]}」吗？`;
    const deleteConfirmMatch = canonical.match(/^¿Eliminar la página "(.+)" permanentemente\?$/);
    if (deleteConfirmMatch) return `要永久删除页面「${deleteConfirmMatch[1]}」吗？`;
    const sidebarDeleteMatch = canonical.match(/^¿Estás seguro de que deseas eliminar la página "(.+)"\?$/);
    if (sidebarDeleteMatch) return `确定要删除页面「${sidebarDeleteMatch[1]}」吗？`;
    const clearCacheMatch = canonical.match(/^No se pudo borrar la caché temporal: (.+)$/);
    if (clearCacheMatch) return `无法清除临时缓存：${clearCacheMatch[1]}`;
    const removedPropertiesMatch = canonical.match(/^Se borraron (\d+) propiedad\(es\) del vault\.$/);
    if (removedPropertiesMatch) return `已从库中删除 ${removedPropertiesMatch[1]} 个属性。`;
    const unusedRefMatch = canonical.match(/^No hay imágenes sin usar: las (\d+) imágenes de assets están referenciadas\.$/);
    if (unusedRefMatch) return `没有未使用的图片：assets 中的 ${unusedRefMatch[1]} 张图片均已被引用。`;
    const removedUnusedMatch = canonical.match(/^Se eliminaron (\d+) de (\d+) imágenes sin usar\. Se conservaron (\d+)\. No se pudieron borrar (\d+) archivo\(s\)\.$/);
    if (removedUnusedMatch) {
      return `已删除 ${removedUnusedMatch[1]}/${removedUnusedMatch[2]} 张未使用图片。保留了 ${removedUnusedMatch[3]} 张。无法删除 ${removedUnusedMatch[4]} 个文件。`;
    }
    const keptUnusedMatch = canonical.match(/^Se eliminaron (\d+) de (\d+) imágenes sin usar\. Se conservaron (\d+)\.$/);
    if (keptUnusedMatch) {
      return `已删除 ${keptUnusedMatch[1]}/${keptUnusedMatch[2]} 张未使用图片。保留了 ${keptUnusedMatch[3]} 张。`;
    }
    const cleanupCompleteMatch = canonical.match(/^Limpieza completada: (\d+) imagen\(es\) eliminada\(s\)\.$/);
    if (cleanupCompleteMatch) return `清理完成：已删除 ${cleanupCompleteMatch[1]} 张图片。`;
    const cacheClearedMatch = canonical.match(/^Caché temporal borrada \((\d+) caché\(s\)\)\.$/);
    if (cacheClearedMatch) return `临时缓存已清除（${cacheClearedMatch[1]} 个缓存）。`;
    const pdfExportMatch = canonical.match(/^No se pudo preparar la exportación a PDF: (.+)$/);
    if (pdfExportMatch) return `无法准备 PDF 导出：${pdfExportMatch[1]}`;
    const deleteAreaMatch = canonical.match(/^Eliminar área (\d+)$/);
    if (deleteAreaMatch) return `删除区域 ${deleteAreaMatch[1]}`;
    return canonical;
  }
  return canonical;
}
function localizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || parent.closest(excludedContentSelector)) return;
  const previousOutput = localizedTexts.get(node);
  const previousOriginal = originalTexts.get(node);
  const original = previousOriginal !== undefined && node.data === previousOutput
    ? previousOriginal
    : node.data;
  originalTexts.set(node, original);
  const trimmed = original.trim();
  let localized = localizedText(trimmed);
  // Las etiquetas y ayudas del HTML están partidas en varias líneas por el
  // formateo del documento. Para encontrarlas en el diccionario comparamos
  // también con los espacios internos colapsados, pero solo sustituimos si
  // existe una traducción real: así no se altera el texto sin traducir.
  const normalized = trimmed.replace(/\s+/g, " ");
  if (normalized !== trimmed) {
    const normalizedLocalized = localizedText(normalized);
    if (normalizedLocalized !== canonicalSpanish(normalized)) {
      localized = normalizedLocalized;
    }
  }
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  const nextValue = `${leading}${localized}${trailing}`;
  if (node.data !== nextValue) node.data = nextValue;
  localizedTexts.set(node, nextValue);
}

function localizeAttribute(element: Element, name: string): void {
  if (element.closest(excludedContentSelector)) return;
  let values = originalAttributes.get(element);
  if (!values) {
    values = new Map();
    originalAttributes.set(element, values);
  }
  let outputs = localizedAttributes.get(element);
  if (!outputs) {
    outputs = new Map();
    localizedAttributes.set(element, outputs);
  }
  const current = element.getAttribute(name);
  if (current === null) return;
  const previousOriginal = values.get(name);
  const original = previousOriginal !== undefined && current === outputs.get(name)
    ? previousOriginal
    : canonicalSpanish(current);
  values.set(name, original);
  const localized = localizedText(original);
  if (current !== localized) element.setAttribute(name, localized);
  outputs.set(name, localized);
}

function localizeElement(element: Element): void {
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node as Text);
    else if (node instanceof Element) localizeElement(node);
  });
  ["title", "placeholder", "aria-label", "aria-description"].forEach((name) =>
    localizeAttribute(element, name)
  );
}

function applyLanguage(nextLanguage: InterfaceLanguage): void {
  language = nextLanguage;
  document.documentElement.lang = language;
  localizeElement(document.body);
  languageChangeListeners.forEach((listener) => listener(language));
}

export function translate(spanish: string): string {
  return localizedText(spanish);
}

export function currentLanguage(): InterfaceLanguage {
  return language;
}

export function onLanguageChange(listener: (language: InterfaceLanguage) => void): () => void {
  languageChangeListeners.add(listener);
  return () => languageChangeListeners.delete(listener);
}

function systemLanguageFromNavigator(): InterfaceLanguage {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

function isInterfaceLanguage(value: string | null): value is InterfaceLanguage {
  return value === "es" || value === "en" || value === "zh";
}

/**
 * Inicializa el idioma guardado y mantiene traducidos los nodos que se añaden
 * dinámicamente. El selector es opcional: la vista móvil no tiene un
 * `<select>`, pero sí necesita el mismo sistema de traducción.
 */
export function initializeLocalization(selector: HTMLSelectElement | null = null): void {
  const stored = localStorage.getItem("sinnotas-language");
  preference = isInterfaceLanguage(stored) || stored === "auto" ? stored : "auto";
  applyLanguage(preference === "auto" ? systemLanguageFromNavigator() : preference);
  if (selector) selector.value = preference;

  if (selector) {
    // Clear existing options
    selector.innerHTML = "";
    // Add new options
    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = "Automático (Sistema)";
    selector.appendChild(autoOption);

    const esOption = document.createElement("option");
    esOption.value = "es";
    esOption.textContent = "Español";
    selector.appendChild(esOption);

    const enOption = document.createElement("option");
    enOption.value = "en";
    enOption.textContent = "English";
    selector.appendChild(enOption);

    const zhOption = document.createElement("option");
    zhOption.value = "zh";
    zhOption.textContent = "中文";
    selector.appendChild(zhOption);

    selector.value = preference;
    selector.addEventListener("change", () => {
      const selected = selector.value;
      preference = isInterfaceLanguage(selected) || selected === "auto" ? selected : "auto";
      localStorage.setItem("sinnotas-language", preference);
      applyLanguage(preference === "auto" ? systemLanguageFromNavigator() : preference);
    });
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "characterData" && record.target instanceof Text) {
        localizeTextNode(record.target);
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof Text) localizeTextNode(node);
        else if (node instanceof Element) localizeElement(node);
      });
      if (record.type === "attributes" && record.target instanceof Element && record.attributeName) {
        localizeAttribute(record.target, record.attributeName);
      }
    });
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "placeholder", "aria-label", "aria-description"],
  });
}

