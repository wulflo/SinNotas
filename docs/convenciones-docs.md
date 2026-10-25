# Convenciones para Documentación

**Fecha de creación:** 2026-10-25  
**Última actualización:** 2026-10-25

## Ubicación

- `README.md` en la raíz es el punto de entrada y el índice general del
  proyecto.
- Todo documento que solo registre o explique algo vive en `docs/`: guías,
  arquitectura, auditorías, benchmarks, diagnósticos y registros de progreso.
- Los registros cronológicos (auditorías, benchmarks, diagnósticos, features,
  fixes y progreso) llevan fecha `YYYY-MM-DD-` al inicio.
- Las guías y documentos permanentes usan un nombre descriptivo en minúsculas,
  sin fecha.
- `keystore.base64.txt` no es documentación: es un artefacto de firma y no debe
  moverse a `docs/`.

## Nomenclatura de Archivos

Todos los documentos en `docs/` deben seguir estas convenciones:

### Formato General
- **Minúsculas**: Usar siempre letras minúsculas
- **Sin espacios**: Reemplazar espacios por guiones `-`
- **Sin tildes ni caracteres especiales**: Usar solo `a-z`, `0-9`, `-`, `_`
- **Sin mayúsculas**: Evitar MAYÚSCULAS excepto casos muy específicos aprobados

### Prefijo con Fecha
Para documentos cronológicos (auditorías, benchmarks, changelogs), usar formato `YYYY-MM-DD-` al inicio:

```
2026-10-25-auditoria-seguridad.md
2026-10-25-benchmark-rendimiento.md
2026-10-26-implementacion-feature-x.md
```

### Sin Fecha para Documentación Permanente
Para guías, convenciones, arquitectura que son permanentes, NO añadir fecha:

```
convenciones-docs.md
arquitectura.md
guia-contribucion.md
api-reference.md
```

## Tipos de Documentación

| Tipo | Prefijo/Patrón | Ejemplo |
|---|---|---|
| **Auditorías** | `auditoria-` o `YYYY-MM-DD-auditoria-` | `2026-10-25-auditoria-seguridad.md` |
| **Benchmarks** | `benchmark-` con timestamp o fecha | `benchmark-1792899153245.md` o `2026-10-25-benchmark-mobile.md` |
| **Features/Implementaciones** | `YYYY-MM-DD-feature-` | `2026-10-25-feature-menu-contextual.md` |
| **Fixes/Bugs** | `YYYY-MM-DD-fix-` | `2026-10-25-fix-saf-android.md` |
| **Diagnósticos** | `YYYY-MM-DD-diagnostico-` | `2026-10-24-diagnostico-ci-release.md` |
| **Planes** | `YYYY-MM-DD-plan-` | `2026-10-24-plan-saf-android.md` |
| **Registros de progreso** | `YYYY-MM-DD-registro-` | `2026-10-25-registro-progreso.md` |
| **Guías/Procedimientos** | Sin fecha, descriptivo | `guia-desarrollo.md` |
| **Arquitectura** | Sin fecha, descriptivo | `arquitectura-tauri.md` |

## Estructura de Documento

Todo documento debe incluir al menos:

```markdown
# Título del Documento

**Fecha:** YYYY-MM-DD  
**Autor:** wulflo  
**Tipo:** auditoria|benchmark|feature|fix|diagnostico|plan|registro|guia  
**Estado:** draft|in-progress|completed

## Contenido...
```

## Reglas Prácticas

1. **Ser descriptivo**: El nombre debe indicar claramente el contenido
2. **Conciso**: Máximo 3-4 palabras clave después del prefijo
3. **Consistente**: Seguir siempre estas reglas
4. **Actualizar**: Si un documento permanente se actualiza significativamente, añadir "Última actualización: YYYY-MM-DD"
5. **No duplicar**: Revisar si ya existe un documento similar antes de crear uno nuevo

## Ejemplos Correctos vs Incorrectos

| Incorrecto | Correcto | Razón |
|---|---|---|
| `Auditoria Seguridad.md` | `2026-10-25-auditoria-seguridad.md` | Minúsculas, sin espacios, con fecha |
| `BENCHMARK_MOBILE.md` | `benchmark-mobile.md` | Minúsculas, guiones |
| `fix SAF Android.md` | `2026-10-25-fix-saf-android.md` | Minúsculas, guiones, fecha para fix |
| `CONVENCIONES-DOCS.md` | `convenciones-docs.md` | Documento permanente, minúsculas |

## Comandos Útiles

```bash
# Crear documento con fecha
DATE=$(date +%Y-%m-%d)
touch docs/${DATE}-nombre-descriptivo.md

# Renombrar a formato correcto
mv "Mi Documento.md" "mi-documento.md"
```

---

**Nota:** Estas convenciones se aplican a todos los documentos nuevos. Los
documentos existentes ya se migraron a minúsculas y, cuando corresponde,
incorporaron la fecha al nombre.
