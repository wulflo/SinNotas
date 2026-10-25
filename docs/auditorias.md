# Auditorías de Seguridad y Rendimiento - SinNotas

## Auditoría 2026-10-24

### Fase 1: Seguridad
**npm audit (frontend):**
- esbuild <= 0.24.2 (Moderado) - GHSA-67mh-4wv8-2f99
- vite <= 6.4.3 (afectado por esbuild vulnerable)
- tinypool <= 2.1.1 (Crítico) - GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (Prototype Pollution → RCE)
- Total: 5 vulnerabilidades (2 moderadas, 1 alta, 2 críticas)

**cargo audit (src-tauri):**
- glib 0.18.5 (Unsound) - RUSTSEC-2024-0429 - **Mitigado** vía `cargo update -p glib`
- bincode 1.3.3 (Sin mantenimiento) - RUSTSEC-2025-0141
- proc-macro-error 1.0.4 (Sin mantenimiento) - RUSTSEC-2024-0370
- zbus_names/zvariant/zvariant_derive (Sin mantenimiento/avisos)
- clipboard-win 5.4.1 (Yanked)

**Parche estático aplicado:**
- SSRF mitigado en `src/desktop.ts` (validación de URL http/https, bloqueo de IPs locales/loopback/privadas)
- Sanitización DOMParser en `src/desktop.ts` y `src/editor/paste-sanitizer.ts` (remoción de scripts/event handlers, uso de DOMPurify cuando disponible)
- Escape corregido en `src/editor/paste-sanitizer.ts` (líneas 180, 196) y `src/editor/markdown-table.ts` (línea 78) - escapar `\` antes de `|`
- Funcionalidad de ayuda añadida en editor (botón con modal de atajos)
- Ajustes de UI Kanban (padding mayor en tarjetas y lista)

### Fase 2: Rendimiento
**Optimizaciones aplicadas:**
- `vite.config.ts`: añadido `sourcemap: false`, `minify: "esbuild"`, `chunkSizeWarningLimit: 1000`
- `src-tauri/Cargo.toml`: `opt-level` cambiado a `"s"` para binarios más pequeños
- `package.json`: añadido `esbuild>=0.25.0`, `tinypool>=1.0.2` en devDependencies y overrides, actualizado `vite` a `^5.4.19`, `vitest` a `^3.2.6`
- CSS: transiciones más suaves en botones/iconos

### Validación
- TypeScript: `tsc --noEmit` sin errores
- Restricciones respetadas: Sin modificación de versiones de `@tauri-apps/api`, `@tauri-apps/plugin-*`, `tauri` ni `tauri-build`. Compatibilidad Android mantenida.
