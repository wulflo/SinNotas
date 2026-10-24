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
  "Los títulos aparecen con fundido al acercar hasta este zoom; al pasar el cursor o seleccionar un nodo se muestran siempre.": "Node titles fade in as you zoom up to this level; hovering or selecting a node always shows them.",
  "📌 Fijadas": "📌 Pinned",
  "Recientes": "Recent",
  "Ver todas las notas": "View all pages",
  "Abrir con aplicación predeterminada": "Open with default app",
  "No se pudo abrir la nota con la aplicación predeterminada.": "Could not open the page with the default application.",
  "En el contenido": "In page content",
};

const spanishByEnglish = Object.fromEntries(
  Object.entries(englishBySpanish).map(([spanish, english]) => [english, spanish])
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
  const localized = localizedText(original.trim());
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

function applyLanguage(nextLanguage: InterfaceLanguage): void { if (nextLanguage === "zh") return;
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

export function initializeLocalization(selector: HTMLSelectElement): void {
  const stored = localStorage.getItem("sinnotas-language");
  preference = stored === "es" || stored === "en" || stored === "auto" ? stored : "auto";
  const lang = navigator.language.toLowerCase();
  const systemLanguage: InterfaceLanguage = lang.startsWith("es") ? "es" : lang.startsWith("zh") ? "zh" : "en";
  applyLanguage(preference === "auto" ? systemLanguage : preference);
  selector.value = preference;

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
    preference = selected === "es" || selected === "en" || selected === "zh" || selected === "auto" ? selected : "auto";
    localStorage.setItem("sinnotas-language", preference);
    const l = navigator.language.toLowerCase();
    const sys: InterfaceLanguage = l.startsWith("es") ? "es" : l.startsWith("zh") ? "zh" : "en";
    applyLanguage(preference === "auto" ? sys : preference);
  });

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

