---
name: estructure
description: Consultar el índice técnico de SinNotas (mapa de archivos, comandos Tauri, claves de almacenamiento, secciones del editor y rutas de vista a código); usar cuando se pregunte dónde está una función, un comando o una clave, o antes de tocar código para no duplicar o romper estructuras existentes.
---

# Estructure — índice técnico de SinNotas

Propósito: responder «¿dónde está?» sin leer todo el repo. **Revisa y reporta**; no cambies código salvo petición explícita.

El índice completo vive en `references/Estructure.md` (dentro de esta skill). Está escrito para consultarse por sección, no de principio a fin: busca por símbolo, selector o comando.

## Cuándo usarla

- Antes de añadir un archivo, comando Tauri o clave de `localStorage`: comprobar que no existe ya.
- Al buscar dónde se implementa una vista, un ajuste, un atajo, un parser o una ruta Rust.
- Al actualizar documentación técnica tras un cambio visible (la guía de usuario es `guia-de-uso`; aquí van rutas y símbolos).

## Cómo consultarla

1. Leer solo la sección relevante de `references/Estructure.md` (índice al inicio).
2. Confirmar en el código con `grep -RIn "<símbolo>" src src-tauri/src index.html`.
3. Si el cambio afecta a símbolos documentados, actualizar **esta** referencia en el mismo commit.

## Reglas

- Los números de línea son orientativos: buscar por símbolo, no por línea fija.
- Las guías de usuario (`docs/GUIA-DE-USO.md`, `docs/USER-GUIDE.md`) no deben duplicar este índice técnico.
- Esta skill es la fuente técnica única; **no** recrear `docs/Estructure.md`.

## Referencias rápidas

| Qué | Dónde |
| --- | --- |
| Índice completo | `references/Estructure.md` |
| Mapa de vistas y ajustes | `index.html`, `src/desktop.ts` |
| Backend y comandos | `src-tauri/src/lib.rs`, `src-tauri/src/metadata_cache.rs` |
| Trazación de fases | `docs/CHECKLIST-CONSOLIDADO.md` y `~/Descargas/Checklist-0.5.6RC-SN.md` |
