# Correcciones de la auditoría 2026-10-25

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** auditoria  
**Estado:** completed

Rama: `fix/auditoria-2026-10-25`, creada desde `db4e8d4` (`master`).
No se modificó `master` ni se crearon o movieron etiquetas.

## Resumen

Se corrigieron seis hallazgos de la auditoría (A-F). Los cambios mantienen el
comportamiento funcional, añaden pruebas para las rutas de riesgo y no
desactivan comprobaciones de CI. La verificación local con Node.js 22 y Rust
pasa completa.

Queda un bloqueo externo: `cargo audit` sigue detectando tres vulnerabilidades
en `zip 4.6.1`, versión que fija `tauri-plugin-updater 2.14.0`. No se añadió una
excepción a la auditoría; CI seguirá en rojo en ese paso hasta que el plugin
acepte `zip >= 9`.

## Hallazgos y correcciones

### A. Toolchain de Node.js desactualizado

**Hallazgo:** los workflows usaban Node.js 20 mientras Vitest 5 exige
`>= 22.12.0`. `package.json` no declaraba la versión mínima y la documentación
no la mencionaba.

**Corrección** (`e813883`):

- `ci.yml` (3), `build.yml` (1) y `release.yml` (4): `node-version: "22"`.
- `package.json`: `engines.node >= 22.12.0`.
- `README.md`: requisito de Node.js 22.12 o superior.
- Se conservaron `vite ^6.0.11` y el `ignore` de Dependabot.

El diff de `release.yml` se revisó con `git diff db4e8d4..HEAD`: solo cambiaron
las cuatro apariciones de `node-version`.

### B. Profundidad ilimitada del árbol de bullets

**Hallazgo:** el parser construía un árbol tan profundo como la indentación del
Markdown. Un archivo con miles de niveles podía desbordar la pila al
serializarlo con `serde`/`bincode` (el binario compila con `panic = "abort"`).
El serializador ya tenía un límite local de 64, pero el parser no.

**Corrección** (`08a56f7`):

- `MAX_BLOCK_DEPTH = 64` se define una sola vez en `lib.rs` y se comparte con
  `metadata_cache.rs`.
- El parser corta la profundidad con
  `*last_indent >= indent || stack.len() >= MAX_BLOCK_DEPTH`.
- Las líneas que superan el límite se conservan como hermanas en el nivel 63;
  no se pierde contenido.
- El serializador usa la misma constante.
- El test `parser_limits_deep_nesting_and_round_trips_all_lines` genera 3.000
  líneas, recorre el árbol de forma iterativa, comprueba que la profundidad
  máxima es menor que 64 y verifica que el round-trip conserva las 3.000
  líneas.

### C. Ruta de revisiones vulnerable a symlinks

**Hallazgo:** `revisions_file_path` construía la ruta con
`root.join(".sinnotas").join("revisions")` sin resolver enlaces. Si
`.sinnotas` era un symlink fuera de la bóveda, las revisiones se escribían
fuera de ella.

**Corrección** (`81a349a`):

- La ruta se construye con `resolve_vault_path`, que rechaza componentes que
  escapan de la raíz después de resolver symlinks.
- Test Unix
  `revisions_paths_reject_sinnotas_symlink_outside_the_vault`: crea una bóveda,
  enlaza `.sinnotas` a un directorio externo y comprueba que la ruta se rechaza
  y que el archivo externo no se crea.

### D. Validación incompleta de URLs de imágenes remotas

**Hallazgo:** la validación anterior solo cubría una parte de los rangos
privados. Dejaba pasar `0.0.0.0/8`, `100.64.0.0/10`, `::`, `fe80::/10`
completo, `fc00::/7`, IPv4-mapeado en IPv6 y hosts `*.internal`. Tampoco
rechazaba de forma explícita formas numéricas IPv4 mal formadas.

**Corrección** (`eb55844`):

- Nueva utilidad aislada `src/editor/url-safety.ts` con
  `isPrivateOrLocalHostname` e `isAllowedRemoteImageUrl`.
- Solo se permiten `http:` y `https:` hacia hosts públicos. Se bloquean:
  `0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`,
  `192.168/16`, `::`, `::1`, `fe80::/10`, `fc00::/7`, IPv4-mapeado,
  `localhost`, `*.localhost`, `*.local` y `*.internal`.
- `desktop.ts` usa la utilidad antes de descargar una imagen remota.
- `src/editor/url-safety.test.ts` cubre rangos IPv4/IPv6, nombres reservados,
  protocolos no permitidos, URLs inválidas y formas numéricas ofuscadas.

### E. Repintados y primeras aperturas costosas

**Hallazgo:** la lista virtual solo recolocaba las filas que entraban en el
viewport. Si cambiaba la altura de una fila, las siguientes conservaban su
`top` anterior y podían solaparse. Además, el splash animaba `width` (provoca
layout en cada frame), el Kanban usaba `gap` para separar tarjetas y las vistas
ocultas se construían por primera vez al abrirlas.

**Corrección** (`cbee167`):

- `VirtualList.positionRows()` recoloca todas las filas montadas al cambiar las
  alturas y antes del siguiente pintado.
- El splash usa `transform: scaleX(...)` con `transform-origin: left center`.
- El Kanban elimina el `gap` y usa `padding: 6px 12px 6px`.
- Las vistas `journals`, `all-pages` y `kanban` se precalientan en tiempo
  ocioso después del primer pintado, sin cambiar la vista activa.
- Los glows de la interfaz declaran `will-change: transform` para promoverlos
  al compositor.

### F. Atajos de teclado incompletos y engañosos

**Hallazgo:** el modal de ayuda existente no estaba traducido, no participaba
en `modalOverlays`, no se cerraba con `Escape` y listaba atajos sin manejador
real (por ejemplo, las flechas). El menú contextual de bullets mostraba
`Alt+↑` y `Alt+↓`, pero no existía ningún manejador para esas combinaciones.

**Corrección** (`73408ee`):

- Nuevo modal `#shortcuts-modal-overlay` y botón `#btn-shortcuts`.
- Se registra en `modalOverlays` y se cierra con `Escape` mediante
  `closeAllModalOverlays()`.
- `Ctrl/Cmd+/` abre o cierra la lista. Si hay otro modal abierto, el atajo se
  ignora.
- Solo se listan atajos con comportamiento real: navegación, edición,
  selección múltiple, deshacer/rehacer y flashcards.
- Traducciones EN/ZH y estilos responsivos.
- Se eliminaron las etiquetas `Alt+↑`/`Alt+↓` del menú contextual porque no
  tenían manejador.

## Verificación

Node.js `v22.23.4` (npm `10.9.9`):

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | Correcto |
| `npm test` | 23 archivos, 224 pruebas en verde |
| `npm run build` | Correcto con Vite `6.4.5` |
| `VITE_APP_MODE=flashcards npm run build` | Correcto |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `npm audit` | 0 vulnerabilidades |

Rust:

| Comando | Resultado |
| --- | --- |
| `cargo fmt --check` | Correcto |
| `cargo test --locked` | 49 pruebas en verde |
| `cargo clippy --locked -- -D warnings` | Correcto |
| `cargo audit --file src-tauri/Cargo.lock` | 3 vulnerabilidades en `zip 4.6.1` y 7 avisos |

`actionlint` no está instalado en el entorno local. El workflow de release no
se ejecutó con etiquetas para no crear ni mover tags; su diff se revisó
manualmente y solo contiene los cuatro cambios de `node-version`.

## Pendientes y riesgos residuales

1. **`zip 4.6.1` en `cargo audit`.** `tauri-plugin-updater 2.14.0` fija
   `zip ^4`; no hay una versión compatible que permita `zip >= 9`. Afecta a
   `RUSTSEC-2026-0367`, `RUSTSEC-2026-0368` y `RUSTSEC-2026-0369`. No se
   añadieron ignores: CI seguirá fallando en `Run cargo audit` hasta que el
   plugin se actualice o se sustituya el actualizador.
2. **`save_dropped_image`.** El comando acepta una ruta absoluta desde el
   frontend y copia el archivo a la bóveda. Si el WebView se compromete, esa
   superficie permite leer archivos arbitrarios con extensión de imagen. Hay
   que limitar el origen a rutas permitidas, usar el evento nativo de arrastre
   o un diálogo, y validar extensión y tamaño antes de copiar.
3. **ACL de comandos propios con `AppManifest`.** Los comandos de la
   aplicación aún no tienen permisos ACL explícitos por ventana/plataforma.
   Conviene declararlos con `AppManifest` y restringir los comandos sensibles
   (`save_dropped_image`, imágenes, snapshots) a la ventana principal.
4. **Migración de Vite 6.** Esta rama conserva `vite ^6.0.11` para no mezclar
   la corrección de Node/CI con un salto de toolchain. Una actualización mayor
   de Vite y la revisión de los `overrides` requieren una rama aparte.
5. **`glib` y `bincode`.** `glib 0.18.5` tiene `RUSTSEC-2024-0429` (unsound) y
   `bincode 1.3.3` está sin mantenimiento (`RUSTSEC-2025-0141`). `glib` se
   actualizará al subir la cadena de Tauri; `bincode` requiere migrar la caché
   de metadatos a otra versión o formato. Los avisos de `zbus_names`,
   `zvariant`, `zvariant_derive`, `proc-macro-error` y `clipboard-win` son
   dependencias transitivas y se revisan con la misma actualización.
