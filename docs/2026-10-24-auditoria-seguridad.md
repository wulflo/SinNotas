# Security Audit - SinNotas

> **Nota de vigencia (2026-10-24):** Este documento es el registro de una
> auditoría realizada en una **fase previa** del desarrollo (2026-10-23) y **no
> describe el estado actual del código**. Muchas de sus incidencias —y
> prácticamente todas las de las fases 1 a 4— ya fueron corregidas en commits
> posteriores; la Fase 5 (grafo) también está implementada y `quick-xml` ya está
> actualizado a 0.41. Las anotaciones «(pendiente commit)» reflejan el estado de
> entonces, no el actual. Se conserva como evidencia histórica del proceso; para
> el estado vigente, consultar el historial de Git, el CHANGELOG y la CI.

## Reauditoría vigente — 2026-10-24

Alcance: cadena de suministro de CI, capacidades de Tauri, lectura de la bóveda
en Rust, dependencias npm/Cargo, recursos externos del frontend y arranque con
muchas notas. Esta sección sustituye a las conclusiones históricas de abajo.

### Resultados

| Comprobación | Resultado |
| --- | --- |
| `npm audit --omit=dev` | **0 vulnerabilidades** en dependencias de producción |
| `npm audit` | 5 avisos, todos en la cadena de desarrollo (`vite`/`esbuild`/`vitest`/`tinypool`); corregirlos exige saltos mayores |
| `cargo audit` | **0 vulnerabilidades**; 6 avisos de crates sin mantenimiento/yanked en dependencias transitivas de Tauri |
| `npm test` | 119 pruebas en verde |
| `npx tsc --noEmit` | Limpio |
| `npm run build` | Correcto |
| `cargo test --locked` | 40 pruebas en verde |
| `graph-harness.html` (navegador) | 17/17 (`HARNESS PASS`) |

### Correcciones aplicadas

1. **CI de mínima confianza**
   - Todas las acciones de terceros están fijadas por SHA, incluida
     `tauri-apps/tauri-action` (`1deb371…`, `action-v1.0.0`) y
     `actions/upload-artifact`.
   - Todos los `actions/checkout` usan `persist-credentials: false`.
   - `npm ci --ignore-scripts` en todos los jobs (incluidos los de Android).
   - `permissions: contents: read` a nivel de workflow; el único job que publica
     releases conserva `contents: write` de forma explícita.
2. **Capacidad de apertura de URLs reducida**
   - Se eliminó `opener:allow-default-urls` (permitía `http://*`, `https://*`,
     `mailto:*` y `tel:*`).
   - `opener:allow-open-url` ahora solo autoriza
     `https://github.com/wulflo/SinNotas`, la única URL que abre la app.
3. **Escaneo de bóveda sin notas internas**
   - `scan_vault` omite `.git`, `.sinnotas` y `chronos` bajo la raíz de la
     bóveda, además de las protecciones de `resolve_note_path`.
   - Test: `scan_vault_skips_reserved_directories`.
4. **Sin peticiones externas en el frontend**
   - Se eliminaron las fuentes de Google Fonts del `index.html` y del CSS. La
     app usa pilas de fuentes del sistema, funciona sin conexión y no revela la
     IP del usuario a un tercero al arrancar.
5. **Arranque y escaneo de flashcards**
   - El escaneo se reparte en lotes con `FlashcardLoader`, se cachea por
     versión de bóveda y se aplica al manager solo al terminar.
   - El trabajo pesado de inicio (historial de repaso, snapshots, migración,
     drag & drop, precarga de flashcards) se difiere tras el primer pintado.

### Riesgos residuales aceptados

- **Avisos de herramientas de desarrollo**: `esbuild`/`vite`/`vitest`/`tinypool`
  no se incluyen en el binario distribuido. Actualizarlos requiere migrar a
  Vite 8 / Vitest 5; se hará en una rama aparte para no mezclar cambios de
  seguridad con una migración de toolchain.
- **Crates transitivos de Tauri**: `glib`, `zbus_names`, `zvariant` y
  `proc-macro-error` son avisos de mantenimiento, no vulnerabilidades
  explotables en el modelo de amenazas actual. Se actualizarán al subir la
  versión de Tauri.
- **CSP con `style-src 'unsafe-inline'` y `style-src-attr 'unsafe-inline'`**:
  necesario para los estilos dinámicos de la interfaz y para los atributos
  `style` que KaTeX usa al posicionar fórmulas. Tauri añade hashes a
  `style-src` durante el empaquetado; según CSP, esos hashes hacen que
  `'unsafe-inline'` se ignore para los atributos, así que `style-src-attr`
  debe declararse explícitamente. No se permite `unsafe-eval` ni scripts
  inline.
- **URL de soporte**: si cambia el repositorio, hay que actualizar también
  `src-tauri/capabilities/default.json`; el scope es intencionalmente exacto.

### Nota sobre la tabla histórica

Las fases 0–5 que siguen se conservan como evidencia de la auditoría original.
Algunas filas mencionan SHA o commits antiguos («pendiente commit»); no deben
usarse como estado actual. Las correcciones vigentes son las de esta sección y
las del historial de Git.

### Caché de metadatos y watcher (2026-10-24)

La caché binaria `.sinnotas_cache.bin` y las rutas que llegan por
`vault-cache-delta` se tratan como entrada no confiable:

| Comprobación | Resultado |
| --- | --- |
| Ruta relativa de cada entrada revalidada con `resolve_note_path` | **Mitigado**: rechaza `..`, rutas absolutas, URIs, NUL, `\`, carpetas reservadas, nombres temporales y extensiones distintas de `.md` |
| Suplantación de título | **Mitigado**: el título debe coincidir con el `file_stem` de la ruta |
| Symlink de caché fuera del vault | **Mitigado**: `symlink_metadata` rechaza enlaces; la escritura usa archivo temporal exclusivo + rename |
| Cache poisoning con bloques gigantes/profundos | **Mitigado**: límites de profundidad (64), bloques (200k), contenido (2 MB), frontmatter, enlaces y título |
| Delta del watcher fuera del vault activo | **Mitigado**: el frontend compara `rootPath` y `applyExternalDelta` descarta rutas fuera de la raíz; Rust solo emite rutas validadas |
| Sustituir la nota abierta mientras se edita | **Mitigado**: el delta omite la página abierta en el editor; las escrituras locales pendientes también ganan |
| Entrada corrupta o versión desconocida | **Mitigado**: se trata como cache miss y se hace escaneo completo |
| Watcher en Android/iOS | **No aplica**: `notify` solo se compila en escritorio; SAF conserva su índice propio |

Pruebas: `metadata_cache::tests` (round-trip bincode, corrupción, traversal,
título falso, reutilización por mtime, entradas obsoletas y backlinks
cacheados). Ver [metadata-cache.md](metadata-cache.md).

## Fase 0: Línea base

**Fecha:** 2026-10-23

### Resultados de tests

| Comando | Estado | Detalles |
|---------|--------|----------|
| `cargo test` | ✅ PASS | 19 tests passed |
| `npm test` | ✅ PASS | 43 tests passed |
| `npm run build` | ✅ PASS | Build exitoso en 3.06s |

### Auditoría de dependencias

#### `cargo audit` (Rust)
```
2 vulnerabilities found (high):
- quick-xml 0.36.2: RUSTSEC-2026-0195 (DoS via unbounded namespace allocation)
- quick-xml 0.36.2: RUSTSEC-2026-0194 (Quadratic runtime on duplicate attributes)
Solution: Upgrade to >=0.41.0

6 warnings (unmaintained/unsound/yanked):
- proc-macro-error 1.0.4 (unmaintained)
- zbus_names 4.3.5 (unmaintained)
- zvariant 5.15.1 (unmaintained)
- zvariant_derive 5.15.1 (unmaintained)
- glib 0.18.5 (unsound Iterator impl)
- clipboard-win 5.4.1 (yanked)
```

#### `npm audit` (Node.js)
```
5 vulnerabilities (2 critical, 1 high, 2 moderate):
- esbuild <=0.24.2: GHSA-67mh-4wv8-2f99 (moderate) - dev server request smuggling
- tinypool <=2.1.1: GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (critical) - prototype pollution → RCE
Fix: `npm audit fix --force` (breaking: vite@8, vitest@5)
```

### Versiones de dependencias clave (package.json)

| Paquete | Versión actual | Última estable | Estado |
|---------|---------------|----------------|--------|
| dompurify | 3.4.17 | 3.4.17 | ✅ Actualizado |
| katex | 0.19.0 | 0.19.0 | ✅ Actualizado |

---

## Hallazgos por fase

### Fase 1: Seguridad del backend Rust

| # | Hallazgo | Veredicto | Evidencia | Commit | Riesgo residual |
|---|----------|-----------|-----------|--------|-----------------|
| 1.1 | `save_page`, `delete_page`, `rename_page` no restringen extensión ni carpetas reservadas | **Confirmado y corregido** | Nuevo helper `resolve_note_path` (l.483) y tests `resolve_note_path_rejects_*` | (pendiente commit) | Bajo |
| 1.2 | `scan_vault` aborta toda la carga si un .md no es UTF-8 o carpeta no legible | **Confirmado y corregido** | `scan_vault` retorna `(pages, skipped)`; `VaultSnapshot.skipped` con `#[serde(default)]`; tope 20 MB/nota; test `scan_vault_skips_invalid_utf8_and_unreadable_entries` | (pendiente commit) | Bajo |
| 1.3 | Parser sin límites (anidación extrema, notas enormes) | **Confirmado y corregido** | Parser ya iterativo; `serialize_blocks_to_markdown` ahora iterativo con límite 64; `cloneTree`, `findNodeLocation`, `getFlatVisibleBlocks`, `getAllBlocksFlat`, `getSelectedBlockRoots`, `removeBlocks` iterativos con límite 64 en TS; tests `parser_handles_deep_nesting_without_stack_overflow`, `serialize_blocks_respects_max_depth_limit`, `parser_handles_many_lines`, `parser_handles_very_long_line` | (pendiente commit) | Bajo |
| 1.4 | `load_vault` hace `create_dir_all` ANTES de pedir aprobación | **Confirmado y corregido** | Para bóvedas no predeterminadas: valida que la carpeta exista, canonicaliza, pide aprobación, y SOLO entonces continúa. Vault predeterminado sí crea dirs. Test `load_vault_non_default_does_not_create_dirs` | (pendiente commit) | Bajo |
| 1.5 | Protocolo asset solo crece (`allow_directory` sin revocar) | **Confirmado y corregido** | `load_vault` ahora revoca el directorio anterior (`forbid_directory` recursivo) antes de permitir el nuevo; prohíbe explícitamente `chronos/` y `.sinnotas/` en ambos vaults; `ActiveVault` rastrea `asset_scope_root` | (pendiente commit) | Bajo |
| 1.6 | `resolve_vault_path` usa `exists()` que sigue symlinks | **Confirmado y corregido** | Cambiado a `symlink_metadata` para detectar symlinks sin seguirlos; test `resolve_vault_path_rejects_dangling_symlink_outside_vault` + `vault_paths_reject_symlinks_that_escape_the_root` | (pendiente commit) | Bajo |
| 1.7 | `approved-vault-roots.json` se escribe con `fs::write` directo | **Confirmado y corregido** | Ahora usa `write_file_atomically` (temp + rename) igual que notas y snapshots | (pendiente commit) | Bajo |

**Decisión: `panic="abort"` mantenido**. Con las correcciones iterativas y límites de profundidad/tamaño, el riesgo de stack overflow está mitigado. `panic="abort"` evita unwinding impredecible en producción.

### Fase 2: Seguridad y robustez del frontend

| # | Hallazgo | Veredicto | Evidencia | Commit | Riesgo residual |
|---|----------|-----------|-----------|--------|-----------------|
| 2.1 | Posible ReDoS en patrones inline (cloze `{{...}}`, wikilink `[[...]]`, math `$...$`, display math `$$...$$`, fenced code) | **Confirmado y corregido** | `renderInline` y `renderBlockContent` reescritos con: cuantificadores acotados `{1,500}`, patrones separados, pre-check de `$` balanceados, lookahead en math display; tests ReDoS en markdown.test.ts | (pendiente commit) | Bajo |
| 2.2 | KaTeX: faltan `maxSize`, `maxExpand`, tope longitud fórmula | **Parcial** | math.ts:17-18 tiene maxSize/maxExpand; tope 500 chars añadido en regex inline; display math limitado a 50k | (pendiente commit) | Bajo |
| 2.3 | Auditoría `innerHTML` sin sanitizar | **Confirmado y verificado** | 33 ocurrencias auditadas en desktop.ts, mobile/review-app.ts, i18n.ts. **Todas las entradas de usuario usan sanitización**: `sanitizeHtml()`, `renderMarkdownToHtml()` (llama a sanitizeHtml), `renderMathToHtml()` (KaTeX trust:false). Las demás son: strings estáticos, templates sin interpolación, DOM API, o vaciado (`innerHTML = ""`). **Mejora sugerida**: backlink snippet (desktop.ts:4936-4945) usa escape manual; migrar a `escapeHtml()` o `sanitizeHtml()`. | (pendiente commit) | Bajo |
| 2.4 | CSP requiere `unsafe-inline` para styles | **Verificado - necesario** | tauri.conf.json usa `style-src 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'`. Tauri añade hashes a `style-src` al empaquetar, lo que anula `'unsafe-inline'` para atributos; sin `style-src-attr` los estilos inline de KaTeX se bloquean solo en la app instalada. Requerido también para el cambio de tema y CSS dinámico. No se puede eliminar sin romper la UI. | (pendiente commit) | Bajo |

### Fase 3: CI y APK

| # | Hallazgo | Veredicto | Evidencia | Commit | Riesgo residual |
|---|----------|-----------|-----------|--------|-----------------|
| 3.1 | Secretos de firma en env de TODO el job | **Corregido (workflow creado)** | `.github/workflows/ci.yml`: `npm ci --ignore-scripts`, secretos solo en step de firma con `apksigner`, env vars en step aislado | (pendiente commit) | Bajo |
| 3.2 | Acciones de terceros sin fijar por SHA | **Corregido (workflow creado)** | Todas las actions fijadas por SHA con comentario de versión: `actions/checkout@11bd719...`, `actions/setup-node@49933ea...`, `dtolnay/rust-toolchain@c5a9a0b...`, `swatinem/rust-cache@9d4c8b1...`, `android-actions/setup-android@b9b5c6c...`, `actions/upload-artifact@ea165f8...`, `softprops/action-gh-release@de2c0eb...`; `permissions: contents: read` en todos los jobs | (pendiente commit) | Bajo |
| 3.3 | APK debug subido cuando faltan secretos | **Corregido (workflow creado)** | Debug APK subido como artifact `DEBUG-no-distribuir` (nombre inequívoco); release APK solo desde tags `v*` con firma | (pendiente commit) | Bajo |
| 3.4 | AndroidManifest generado en CI, no inspeccionado | **Corregido (workflow creado)** | Paso `Inspect signed APK manifest` con `aapt2 dump permissions` y `aapt2 dump xmltree`; falla si: INTERNET, MANAGE/READ/WRITE_EXTERNAL_STORAGE, debuggable=true, usesCleartextTraffic=true | (pendiente commit) | Bajo |
| 3.5 | `generate-keystore.sh` usa JKS, imprime secretos | **Corregido** | Ahora usa PKCS12 (`-storetype PKCS12`), contraseñas via `-storepass:env`/`-keypass:env`, secretos escritos a archivo 600 (`keystore-secrets.txt`), NO a stdout | (pendiente commit) | Bajo |

**Nuevo**: `.github/dependabot.yml` configurado para actualizaciones semanales de GitHub Actions, npm (con ignore de major versions para vite/vitest) y Cargo.

### Fase 4: Bóvedas externas en Android (SAF)

| # | Hallazgo | Veredicto | Evidencia | Commit | Riesgo residual |
|---|----------|-----------|-----------|--------|-----------------|
| 4A | Plan de abstracción VaultStorage + SafStorage | **Completado (documento)** | Ver `docs/2026-10-24-plan-saf-android.md`: trait `VaultStorage`, `FsStorage`/`SafStorage`, modelo seguridad SAF, escritura con diario, `update_card_properties`, Syncthing, índice caché, blob URLs, comandos deshabilitados, UI, plan de pruebas, riesgos | (pendiente commit) | - |
| 4B | Implementación por commits | **En progreso - commit (a) completado** | Trait `VaultStorage` + `FsStorage` implementado y testeado (test `fs_storage_trait_works`); comandos `read_page` y `save_page` migrados al trait; `Arc<dyn VaultStorage>` en estado activo | (pendiente commit) | - |

### Fase 5: Grafo (graph-view.ts)

> **Actualización (2026-10-24):** la fase 5 se completó en los commits
> `1135ec3`, `641e08b` y `c1eb64b`, con validación en vivo (17 gestos reales en
> Chromium) y sin errores de consola. La arquitectura resultante, el historial
> de bugs y las directrices anti-regresión están documentados en
> [docs/graph-view.md](graph-view.md).

| # | Hallazgo | Veredicto | Evidencia | Commit | Riesgo residual |
|---|----------|-----------|-----------|--------|-----------------|
| 5.1 | Nodos aparecen de golpe, fuerzas altas | **Corregido** | Revelado gradual por batches (30 nodos/lote), positions iniciales cerca de vecinos, alpha con decaimiento D3-like | pre-`1135ec3` + `c1eb64b` | Bajo |
| 5.2 | Sin `prefers-reduced-motion` | **Corregido** | Detección + `settleImmediately()` (layout sin animación) y sin simulación | pre-`1135ec3` | Bajo |
| 5.3 | Freeze total del lienzo tras ~5-8 s (el render solo existía dentro del bucle de física; al asentarse la simulación el bucle moría y zoom/pan/hover/selección dejaban de repintar) | **Confirmado y corregido** | Bucle unificado física+render con render bajo demanda `requestRender()`; `stopSimulation()` garantiza último repintado; frame en try/catch; verificado con harness en vivo | `c1eb64b` | Bajo |
| 5.4 | Selección/estados de gesto huérfanos (`pressedNode`, `suppressClick`, `pointerStart`) causaban selección fantasma y arrastre muerto tras clicks alternos, fondo y drags | **Confirmado y corregido** | Ciclo de vida del gesto definido, limpieza en mousedown/mouseup/click/dblclick/updateData; drag consume click sin seleccionar | `1135ec3`, `641e08b`, `c1eb64b` | Bajo |
| 5.5 | Riesgo de freeze por stack overflow: nodos coincidentes exentos de todas las fuerzas (`distSq === 0 → continue`) y quadtree sin tope de profundidad | **Confirmado y corregido** | `separateCoincident()` en repulsión/colisión; tope de profundidad 32 con fusión de masa | `c1eb64b` | Bajo |
| 5.6 | Timeouts de revelado de una sesión filtrándose a otra en `updateData`, cambio de color no visible sin repintado | **Confirmado y corregido** | `revealTimeouts` + `clearRevealTimeouts()`; `recomputeColors()` termina en `requestRender()` | `c1eb64b` | Bajo |

Regresión obligatoria al tocar el grafo: [docs/graph-view.md](graph-view.md)
(banco de pruebas en vivo `graph-harness.html` → 17/17 PASS).

---

## Decisiones pendientes de confirmación

1. **allowBackup en AndroidManifest**: ¿Se debe fijar en `false`? (Por defecto Tauri lo pone en `true`)
2. **panic="unwind" + catch_unwind**: ¿Conviene cambiar de `panic="abort"` para atrapar panics en comandos Tauri?
3. **Actualización de dependencias vulnerables**: 
   - quick-xml → 0.41+ (requiere cambios en `svg_has_active_content`)
   - vite/vitest → versiones mayores (breaking changes)
4. **Logo en APK**: El logo compilado no se conserva al instalar la APK. Investigar `tauri.conf.json` icon config.

---

## Próximos pasos

Iniciar **Fase 1.1**: Crear helper `resolve_note_path` y usarlo en todos los comandos que operan sobre notas.