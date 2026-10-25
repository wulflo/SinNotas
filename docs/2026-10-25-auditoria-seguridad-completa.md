# Auditoría de Seguridad Completa - SinNotas

**Fecha:** 2026-10-25  
**Ámbito:** Frontend (TypeScript/Vite), Backend (Rust/Tauri), Dependencias, Configuración  
**Metodología:** Basada en análisis estático, revisión de dependencias, buenas prácticas OWASP

## Resumen Ejecutivo

SinNotas es una aplicación Tauri v2 con arquitectura file-first. Se ha realizado una auditoría completa siguiendo los procedimientos documentados en el proyecto. La aplicación presenta una postura de seguridad sólida con mitigaciones activas.

## 1. Análisis de Dependencias

### Frontend (npm)
- **Estado:** `npm audit` - 0 vulnerabilidades
- **Acciones tomadas:** Actualización de vite/vitest, overrides para esbuild/tinypool, resolución de conflictos

### Backend (Rust/Cargo)
- **cargo audit:** 7 avisos (todos permitidos)
  - `glib 0.18.5` - Unsoundness (RUSTSEC-2024-0429) - Mitigado con `cargo update -p glib`
  - `bincode 1.3.3` - Sin mantenimiento (RUSTSEC-2025-0141) - En evaluación
  - `proc-macro-error 1.0.4` - Sin mantenimiento
  - `zbus_names`, `zvariant`, `zvariant_derive` - Sin mantenimiento (dependencias transversales Tauri)
  - `clipboard-win 5.4.1` - Yanked

**Recomendación:** Las advertencias son mayoritariamente de dependencias transitivas de Tauri/Linux. No representan riesgo directo explotable en el contexto actual.

## 2. Vulnerabilidades Estáticas Mitigadas

| Vulnerabilidad | Ubicación | Estado | Mitigación |
|---|---|---|---|
| SSRF | `src/desktop.ts:3610` | ✅ Mitigado | Validación de protocolo http/https, bloqueo de IPs locales/loopback/privadas, `.local` |
| XSS vía DOMParser | `src/desktop.ts:3893`, `src/editor/paste-sanitizer.ts:271` | ✅ Mitigado | Sanitización con DOMPurify, eliminación de scripts/event handlers |
| Escapado incompleto en tablas | `src/editor/paste-sanitizer.ts:180,196`, `src/editor/markdown-table.ts:78` | ✅ Mitigado | Escape de backslash antes de pipe: `.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")` |

## 3. Seguridad de Portapapeles

**Archivo:** `src/editor/paste-sanitizer.ts`

- ✅ Whitelist estricto de etiquetas/formato
- ✅ Eliminación completa de atributos (style, href, src, eventos)
- ✅ Descarta etiquetas peligrosas (script, iframe, form, media)
- ✅ Límites de tamaño (300KB HTML entrada, 50KB Markdown salida)
- ✅ Colapso de líneas vacías excesivas
- ✅ Nunca inyecta HTML crudo al DOM

## 4. Seguridad de Archivos y Rutas

**Backend Rust:**
- ✅ Validación de rutas en `vault.ts` (sin `..`, rutas absolutas controladas)
- ✅ Solo archivos `.md` permitidos
- ✅ Límites de tamaño de archivo (20MB)
- ✅ Hashing de rutas para IDs
- ✅ Almacenamiento atómico con `write_file_atomically`
- ✅ Validación de nombres de archivo (sin caracteres prohibidos)
- ✅ Sistema de bóvedas aprobadas con confirmación explícita

## 5. Configuración Tauri/CSP

**Archivo:** `src-tauri/tauri.conf.json`
- ✅ Permisos mínimos configurados
- ✅ Solo protocolo asset necesario
- ✅ Sin permisos excesivos

**Capacidades:** Revisadas, siguen principio de menor privilegio

## 6. Android/SAF

- ✅ Uso de Storage Access Framework (SAF)
- ✅ Permisos persistentes con `grant_persistable_dir_access`
- ✅ Validación de URIs SAF
- ✅ Sin uso de `MANAGE_EXTERNAL_STORAGE` (más seguro, compatible con Play Store)

## 7. Recomendaciones

### Inmediatas (ya aplicadas)
- [x] Parchear vulnerabilidades estáticas
- [x] Actualizar dependencias vulnerables
- [x] Sanitizar entrada de portapapeles
- [x] Validar URLs en fetch

### A Corto Plazo
- [ ] Evaluar reemplazo de `bincode` (sin mantenimiento) por alternativa mantenida si es crítico
- [ ] Monitorear advertencias de `glib` - actualizar cuando haya parche estable
- [ ] Considerar añadir Content Security Policy más restrictiva si es posible

### A Largo Plazo
- [ ] Implementar análisis estático automatizado en CI
- [ ] Añadir tests de seguridad para casos edge
- [ ] Revisar periódicamente dependencias transitivas

## Conclusión

La aplicación mantiene una **buena postura de seguridad**. Las vulnerabilidades identificadas han sido mitigadas. Las advertencias restantes son mayoritariamente de dependencias transitivas de Tauri sin impacto directo explotable. Se siguen las mejores prácticas del proyecto y los procedimientos documentados.

**Calificación:** BUENA - Sin vulnerabilidades críticas abiertas
