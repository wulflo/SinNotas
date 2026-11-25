---
name: Guía de uso
description: Actualizar la documentación de usuario de SinNotas cuando se añaden funciones o cambian ajustes, mantenimiento, vistas o flujos; usar al terminar una modificación visible para el usuario.
---

# Guía de uso — documentación del usuario

Propósito: que la guía describa siempre **lo que la app hace ahora**, no una versión anterior.
Aplica cuando se añade una función, se cambia un ajuste (p. ej. mantenimiento/FSRS/ancho de página),
se renombra un control o se modifica un flujo visible.

## Checklist obligatorio

1. **Identificar el cambio visible**
   - ¿Nueva vista/acción? ¿Nuevo ajuste? ¿Cambió una etiqueta, un atajo o el comportamiento de un
     botón? ¿Se eliminó una opción? Anotarlo antes de tocar la guía.

2. **Actualizar ambas guías**
   - `docs/GUIA-DE-USO.md` (español) y `docs/USER-GUIDE.md` (inglés) en paralelo.
   - Si el texto es nuevo, revisar también la traducción al chino (skill `Traducciones UI`).
   - Revisar si el README también requiere actualizaciones.
   - Mantener el mismo orden de secciones en ambos idiomas.

3. **Qué documentar**
   - **Ajustes y mantenimiento:** nuevo parámetro, rango/unidades (porcentaje frente a píxeles),
     valor por defecto, dónde se guarda y efecto visible.
   - **Vistas (Editor, Diarios, Todas las páginas, Bibliografía, Flashcards, Grafo, Kanban, PDF):**
     cómo acceder, qué se ve y qué acciones tiene la vista.
   - **Editor de tablas:** selección de celda, toolbar, formato por celda, movimiento de filas/columnas.
   - **Repaso/FSRS:** calificación, Undo/Redo, parámetros globales y por mazo.
   - **Atajos de teclado:** `index.html` → shortcuts modal y `src/desktop.ts`.

4. **No duplicar el índice técnico**
   - Las rutas de código, comandos Tauri y claves de almacenamiento van en la skill
     `estructure`, no en la guía de uso.
   - La guía responde a «¿cómo se usa?»; el índice a «¿dónde está?».

5. **Verificación final**
   - `npx tsc --noEmit` y `npm test` si el cambio también tocó código.
   - Leer el diff de la guía: sin instrucciones obsoletas (p. ej. «anchos en px» cuando ahora son %).

## Referencias rápidas

| Qué | Dónde |
| :--- | :--- |
| Guía ES | `docs/GUIA-DE-USO.md` |
| Guía EN | `docs/USER-GUIDE.md` |
| Visión general y atajos | `README.md` |
| Índice técnico | skill `estructure` |
| Trazación de fases | `docs/CHECKLIST-CONSOLIDADO.md` |
