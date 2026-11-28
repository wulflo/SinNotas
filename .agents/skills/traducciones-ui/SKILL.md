---
name: Traducciones UI
description: Asegurar que las opciones de interfaz y configuración de SinNotas tengan traducción al inglés y al chino (idiomas soportados); usar al añadir textos nuevos, al revisar Ajustes o al cambiar controles y diffs de UI.
---

# Traducciones UI — ES → EN / ZH

Propósito: que **ningún** texto visible de la interfaz o de los ajustes quede solo en español.
Los idiomas soportados son `es`, `en` y `zh` (además de `auto`), gestionados en `src/i18n.ts`.

## Checklist obligatorio

1. **Texto estático en `index.html`**
   - Todo texto visible lleva `data-i18n="Español exacto"` (el español del HTML es la clave).
   - Añadir la misma clave a los diccionarios `en` y `zh` de `src/i18n.ts`.
   - Revisar especialmente `data-settings-panel="advanced"` (Ajustes > Avanzado): cada fila,
     etiqueta, botón, `placeholder`, `title` y `aria-label` debe tener su entrada.
   - Los `aria-label` y `title` también se traducen; no basta con el texto visible.

2. **Texto generado en TypeScript**
   - Usar `translate("Texto en español")` en lugar de literales (`desktop.ts`, `views/*.ts`,
     `mobile/review-app.ts`). Los mensajes de toast, `output` y tooltips también.
   - Si el texto lleva interpolación, construirlo con `translate(...)` para la parte fija.
   - Los días de la semana y las etiquetas derivadas de datos (`Diario`/`Página`) también pasan por
     `translate()`; las claves suelen ya existir en los tres diccionarios.
   - `src/i18n-coverage.test.ts` exige es/en/zh para el HTML visible y una lista de avisos
     dinámicos: ampliar esa lista al envolver un toast nuevo. Deuda pendiente: los `showToast`
     de rutas nativas/poco frecuentes en `mobile/review-app.ts` y `desktop.ts`; cerrarlos por lotes,
     no en un único diff ilegible.

3. **Auditoría de una vista/panel**
   - Buscar literales sin envolver: `grep -n '>[^<]*[áéíóúñÁÉÍÓÚÑ]'` en `index.html` y
     `grep -nE '"[^"]*[áéíóúñÁÉÍÓÚÑ][^"]*"'` en los `.ts` de la zona.
   - Comprobar que cada clave de `data-i18n` existe en **los tres** diccionarios.
   - Probar la app con `localStorage.setItem("sinnotas-language","en")` y `"zh"` y recorrer la
     pantalla: no debe quedar texto en español (salvo nombres propios o datos del usuario).

4. **Si se añade un idioma o se cambia el mecanismo**
   - Actualizar `translate()` y la detección `auto` en `src/i18n.ts`.
   - Actualizar esta skill y la guía de uso (skill `Guía de uso`).

## Verificación final

- `npx tsc --noEmit` y `npm test`.
- Recorrer con el idioma cambiado la vista afectada y, como mínimo, Ajustes > Avanzado.
- Si el cambio afecta a símbolos documentados, actualizar la skill `estructure`.

## Referencias rápidas

| Qué | Dónde |
| :--- | :--- |
| Diccionarios y `translate()` | `src/i18n.ts` |
| Test de cobertura | `src/i18n-coverage.test.ts` |
| Deuda de literales | `~/Descargas/evidencia-refactor-contratos/07-i18n-literales.md` |
| Estructura de Ajustes | `index.html` → `data-settings-panel="advanced"` |
| Preferencia guardada | `localStorage["sinnotas-language"]` (`auto|es|en|zh`) |
| Guías de usuario | `docs/GUIA-DE-USO.md`, `docs/USER-GUIDE.md` |
