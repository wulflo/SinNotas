---
name: mantenimiento-skills
description: Crear y revisar las skills del repo en .agents/skills (frontmatter, descripción que dispara, IDs, enlaces, ejemplos verificables) manteniendo compatibilidad entre agentes y sin duplicar dominios; usar al añadir, mover o auditar una skill.
---

# Mantenimiento de skills — SinNotas

Propósito: que las skills se activen cuando deben, sean ciertas y puedan usarlas otros agentes. **Revisa y reporta**; no reescribas una skill salvo que te lo pidan.

**Origen:** adaptado y fusionado de `review-skill` (paquete `skilld`, licencia MIT) y `skill-authoring` (paquete `dot-skills/.curated`), con las reglas de descubrimiento de OpenCode V2.

## 1. Ubicación e identidad

- Las skills del proyecto viven en `.agents/skills/<id>/SKILL.md`. OpenCode también descubre `.claude/skills` y `.opencode/skills`, pero este repo eligió `.agents` para que cualquier agente las lea; **no recrear `.opencode/skills`**.
- El ID lo da la ruta, no el frontmatter: usar kebab-case en minúsculas que coincida con el directorio (`calidad-pruebas/`, `tauri-desktop/`).
- Un directorio con `SKILL.md` es una skill; OpenCode no busca más dentro. Los archivos de apoyo van junto a `SKILL.md` (`references/`, `scripts/`, `LICENSE.txt`).
- No duplicar IDs entre orígenes: en caso de conflicto gana el origen de mayor precedencia y se cargaría una definición distinta de la esperada.

## 2. Frontmatter y descripción

```markdown
---
name: Nombre legible
description: Qué hace y cuándo usarse, con los términos que escribe el usuario.
---
```

- La **descripción manda**: debe nombrar la capacidad y los disparadores (símbolos, rutas, síntomas) e incluir casos negativos si hay solape con otra skill.
- Reglas críticas al principio: el contenido largo puede truncarse; los detalles van a `references/` y se leen solo cuando hacen falta (progressive disclosure).
- Una skill por dominio: si dos se solapan, dividir por etapa/herramienta con palabras clave distintas.
- Preferir español, como el resto de las skills del repo, salvo que el contenido sea referencia técnica literal.

## 3. Revisión de una skill (checklist)

1. Confirmar que `SKILL.md` existe y que el directorio coincide con el ID.
2. Validar frontmatter: campos soportados, valores correctos, descripción en tercera persona.
3. Seguir **todos** los enlaces y scripts; informar de los que falten o estén rotos.
4. Rechazar symlinks, archivos especiales y rutas que salgan del directorio de la skill.
5. Buscar entradas que faltan, resultados ambiguos y caminos de fallo silenciosos.
6. Revisar comandos por alcance destructivo, exposición de credenciales y descargas sin verificar.
7. Contrastar ejemplos con la API o el código del repo. Si hay toolchain, ejecutarlos y marcar cada ejemplo como **ejecutado**, **leído de fuente** o **sin verificar**. Confirmar una afirmación fallida con una segunda prueba antes de reportarla.
8. Señalar repetición, texto que el lector ya conoce y material que debería estar en `references/`.
9. Verificar que el cuerpo cubre todo lo que la descripción promete.

Clasificación: `error` (la skill lleva a un resultado erróneo, fallo o brecha de seguridad), `warning` (el agente actuará mal o el fallo pasa desapercibido), `note` (precisión, estructura, coste de tokens). Dar ruta exacta, línea y corrección directa. No reescribir salvo petición.

## 4. Al añadir una skill al repo

- Comprobar que no existe otra con el mismo ID ni dominio solapado (`ls .agents/skills`).
- Probar el disparo con frases reales del usuario en español, no solo con la ejecución: una skill perfecta que nunca se activa no aporta nada.
- Si la skill se origina en un pack descargado, conservar atribución y licencia (`LICENSE.txt` cuando corresponda) en un apartado «Origen».
- Actualizar la skill `estructure` (índice técnico en `references/Estructure.md`) y la checklist de la fase en `~/Descargas/` con el commit y el diff.
- Verificar con `git diff --check` y `grep -RIn` que no queden referencias a la ruta antigua.
- Las sesiones ya abiertas necesitan `/reload`; las nuevas descubren la skill sola.

## 5. Skills actuales en este repo

`busqueda-incremental`, `estilo-ui`, `traducciones-ui`, `guia-de-uso`, `vault-performance-guard`, `tauri-desktop`, `calidad-pruebas`, `verificacion-manual` y esta misma.

## Referencias

Documentación oficial: <https://opencode.ai/docs/skills> (descubrimiento, precedencia, IDs y frontmatter). Índice local: skill `estructure`.
