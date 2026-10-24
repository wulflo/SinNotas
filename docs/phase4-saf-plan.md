# Fase 4A: Plan para Bóvedas Externas en Android con SAF (Storage Access Framework)

> **Nota de vigencia (2026-10-24):** Este documento es el **plan de una fase
> previa** del desarrollo y no describe el estado actual. La funcionalidad SAF
> ya está implementada: el plugin quedó fijado en `tauri-plugin-android-fs`
> 2.0.1 y las bóvedas externas funcionan en Android. Las decisiones que aquí
> aparecen como «pendientes de confirmación» se resolvieron durante la
> implementación. Se conserva como registro de diseño; para el comportamiento
> vigente, consultar el código y el historial de Git.

## Resumen Ejecutivo

Implementar soporte para bóvedas externas en Android usando el **Storage Access Framework (SAF)** mediante `ACTION_OPEN_DOCUMENT_TREE` y el plugin `tauri-plugin-android-fs`. La bóveda típica residirá en una subcarpeta como `Documents/vault`.

**Decisiones clave:**
- Plugin: `tauri-plugin-android-fs` (versión exacta por fijar tras auditoría)
- Selector SAF con opción "solo almacenamiento local"
- Abstracción `VaultStorage` trait con implementaciones `FsStorage` (desktop/interno) y `SafStorage` (Android SAF)
- **El frontend NUNCA ve URIs**; trabaja con rutas relativas normalizadas + ID opaco de bóveda

---

## 1. Abstracción de Almacenamiento: `VaultStorage` Trait

### 1.1 Trait Definition (Rust)

```rust
#[async_trait]
pub trait VaultStorage: Send + Sync {
    /// Identificador único de esta instancia de storage (para UI)
    fn storage_id(&self) -> &str;
    
    /// Nombre visible para el usuario
    fn display_name(&self) -> &str;
    
    /// Lista todas las notas (rutas relativas terminadas en .md)
    async fn list_notes(&self) -> Result<Vec<NoteEntry>, StorageError>;
    
    /// Lee el contenido de una nota como String (UTF-8)
    async fn read_note(&self, relative_path: &str) -> Result<String, StorageError>;
    
    /// Escribe contenido a una nota (atómico si posible)
    async fn write_note(&self, relative_path: &str, content: &str) -> Result<(), StorageError>;
    
    /// Crea una nota nueva (fallará si existe)
    async fn create_note(&self, relative_path: &str, content: &str) -> Result<(), StorageError>;
    
    /// Borra una nota
    async fn delete_note(&self, relative_path: &str) -> Result<(), StorageError>;
    
    /// Renombra/mueve una nota
    async fn rename_note(&self, old_path: &str, new_path: &str) -> Result<(), StorageError>;
    
    /// Verifica si existe
    async fn note_exists(&self, relative_path: &str) -> Result<bool, StorageError>;
    
    /// Metadatos: tamaño y fecha de modificación
    async fn note_metadata(&self, relative_path: &str) -> Result<NoteMetadata, StorageError>;
    
    /// Lee bytes de imagen (para asset protocol)
    async fn read_image(&self, relative_path: &str) -> Result<Vec<u8>, StorageError>;
    
    /// Capacidad: ¿soporta operaciones atómicas reales?
    fn supports_atomic_writes(&self) -> bool;
    
    /// Capacidad: ¿soporta listado eficiente?
    fn supports_efficient_listing(&self) -> bool;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteEntry {
    pub relative_path: String,    // ej: "pages/nota.md"
    pub size: u64,
    pub modified: i64,            // millis since epoch
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub size: u64,
    pub modified: i64,
    pub is_readonly: bool,
}
```

### 1.2 Implementaciones

| Implementación | Plataforma | Backend |
|----------------|------------|---------|
| `FsStorage` | Desktop, Android (vault interno), iOS | `std::fs`, `tokio::fs` |
| `SafStorage` | Android (bóveda externa) | `tauri-plugin-android-fs` (SAF) |

### 1.3 Representación de la Raíz Activa

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActiveVaultRoot {
    /// Vault interno de la app (app_data_dir)
    Internal { path: PathBuf },
    /// Vault externo elegido por usuario (desktop)
    External { path: PathBuf },
    /// Vault externo via SAF (Android)
    Saf { 
        tree_uri: String,           // content:// URI del árbol SAF
        display_name: String,       // nombre visible
        subfolder: Option<String>,  // subcarpeta dentro del árbol (ej: "vault")
    },
}
```

- Se serializa en config de la app (`tauri-plugin-store` o similar)
- Al arrancar: reconstruir `VaultStorage` apropiado desde `ActiveVaultRoot`

---

## 2. Modelo de Seguridad SAF

### 2.1 Principio Fundamental

> **El frontend NUNCA recibe ni envía URIs SAF.** Trabaja exclusivamente con:
> - Rutas relativas normalizadas (`pages/nota.md`, `journals/2026_10_23.md`)
> - Un `vault_id` opaco (string) que identifica la bóveda activa

### 2.2 Validaciones en Backend (Rust)

`SafStorage` implementa `resolve_relative_path(relative: &str) -> Result<DocumentFile, Error>`:

```rust
fn resolve_relative_path(&self, relative: &str) -> Result<DocumentFile, StorageError> {
    // 1. Normalizar: quitar ./ inicial, convertir \ a /
    let clean = relative.trim_start_matches("./").replace('\\', "/");
    
    // 2. Rechazar path traversal
    if clean.contains("..") || clean.starts_with('/') {
        return Err(StorageError::InvalidPath);
    }
    
    // 3. Rechazar componentes vacíos
    if clean.split('/').any(|c| c.is_empty()) {
        return Err(StorageError::InvalidPath);
    }
    
    // 4. Rechazar nombres reservados (chronos, .sinnotas, .git, .sinnotas-tmp*)
    for component in clean.split('/') {
        if RESERVED_NAMES.contains(&component.to_lowercase().as_str()) {
            return Err(StorageError::ReservedName);
        }
        if component.contains(".sinnotas-tmp") {
            return Err(StorageError::TempFilePattern);
        }
    }
    
    // 4. Recorrer árbol SAF por nombre de componente (NO concatenar URIs)
    let mut current = self.tree_document_file.clone();
    for component in clean.split('/') {
        current = current.find_file(component)
            .ok_or(StorageError::NotFound)?;
    }
    Ok(current)
}
```

### 2.3 Manejo de Revocación/Movimiento/Desmontaje

| Evento | Detección | Acción |
|--------|-----------|--------|
| Permiso revocado | `SecurityException` al acceder | Mostrar toast "Permiso revocado. Vuelve a elegir la bóveda", resetear a vault interno |
| Carpeta movida/renombrada | `DocumentFile` no encontrado | Igual que revocado |
| Almacenamiento desmontado (SD extraída) | `DocumentFile` devuelve null/vacío | Toast "Almacenamiento no disponible", deshabilitar bóveda hasta reconexión |

**Recuperación:** Al detectar fallo, `VaultStore` muestra diálogo "¿Quieres volver a seleccionar la bóveda?" y llama a `pick_vault_root()` de nuevo.

---

## 3. Estrategia de Escritura en SAF

### 3.1 Análisis del Plugin `tauri-plugin-android-fs`

**Pendiente:** Revisar código del plugin (Rust + Kotlin) para confirmar:
- Modo de apertura: ¿`DocumentFile.openFileOutput()` trunca al abrir? ¿O append?
- Comportamiento ante fallo a medio escribir
- Si expone `createFile()` vs `openFileOutput()`

### 3.2 Propuesta: Escritura con Diario (Journaling)

Dado que SAF no ofrece rename atómico ni transacciones:

```
Escritura segura (journaling):
1. Escribir a archivo temporal hermano: `nota.md.tmp.{uuid}`
2. Verificar lectura: leer de vuelta y comparar hash/contenido
3. Sobrescribir original: `DocumentFile` del original → write bytes del tmp
4. Limpiar temporal
5. En arranque: si existe `*.tmp.*` completo → recuperar (rename atómico sobre original si posible, sino copiar)
```

**Comparación:**

| Estrategia | Pros | Contras |
|------------|------|---------|
| **Diario (propuesta)** | Recuperable tras crash, no pierde datos | 2 escrituras, más lento |
| Sobrescribir directo | Simple, 1 escritura | Pérdida de datos si crash a medio escribir |
| Copy-on-write + rename | Atómico en FS normal | SAF no garantiza rename atómico |

**Justificación:** La integridad de datos (notas del usuario) vale el overhead. Los temporales se limpian en arranque.

---

## 4. ESCRITURAS DEL REPASO (CRÍTICO) - `update_card_properties`

### 4.1 Problema Actual

Hoy: `save_page(page, true)` reserializa **toda la nota** desde el árbol en memoria.
Riesgos:
- (a) **Edición concurrente**: Desktop edita + Syncthing sincroniza mientras móvil repasa → móvil sobrescribe con versión vieja
- (b) **Reformateo innecesario**: Solo cambió `card-s::` pero se reescribe todo el archivo
- (c) **IDs posicionales inestables**: `b-1`, `b-2`... no sirven para ubicar bloque si el archivo cambió externamente

### 4.2 Solución: Comando `update_card_properties`

```rust
#[tauri::command]
async fn update_card_properties(
    vault_id: String,           // ID opaco de la bóveda activa
    relative_path: String,      // "pages/nota.md"
    block_locator: BlockLocator, // Ver abajo
    property_changes: HashMap<String, String>, // ej: {"card-s": "2.5", "card-d": "10"}
    expected_hash: String,      // hash del archivo al cargar (o size+mtime)
) -> Result<UpdateResult, String>
```

#### BlockLocator (localizador estable)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockLocator {
    /// Hash SHA-256 del texto visible del bloque (sin propiedades FSRS)
    pub content_hash: String,
    /// Índice de ocurrencia si hay bloques con mismo hash (1 = primera)
    pub occurrence_index: usize,
    /// Ruta de hashes de padres (para distinguir bloques anidados idénticos)
    pub parent_hashes: Vec<String>,
}
```

#### Algoritmo de Actualización

```rust
async fn update_card_properties(...) -> Result<UpdateResult> {
    // 1. Leer archivo actual desde storage (FsStorage o SafStorage)
    let current_content = storage.read_note(&relative_path).await?;
    
    // 2. Verificar hash esperado (detecta cambios externos)
    let current_hash = stable_hash(&current_content);
    if current_hash != expected_hash {
        // Archivo cambió externamente (Syncthing, desktop, etc.)
        // Re-parsear y re-localizar bloque
        let (frontmatter, blocks) = parse_markdown(&current_content);
        let block = locate_block_stable(&blocks, &block_locator)?;
        if block.is_none() {
            return Err("Block not uniquely locatable after external change".into());
        }
        // Aplicar cambios sobre current_content (no sobre versión vieja)
        let new_content = apply_property_changes(&current_content, &block_locator, property_changes)?;
        storage.write_note(&relative_path, &new_content).await?;
        return Ok(UpdateResult::ExternalChangeMerged);
    }
    
    // 3. Archivo sin cambios externos: localizar bloque en versión original
    let (frontmatter, blocks) = parse_markdown(&current_content);
    let block = locate_block_stable(&blocks, &block_locator)?;
    
    // 4. Aplicar SOLO cambios de líneas de propiedades (preservar EOL, indentación, viñetas, líneas en blanco)
    let new_content = apply_property_changes_minimal(&current_content, &block_locator, property_changes)?;
    
    // 5. Verificar que el bloque sigue localizable de forma única
    let (_, new_blocks) = parse_markdown(&new_content);
    if !is_uniquely_located(&new_blocks, &block_locator) {
        return Err("Property changes would make block ambiguous".into());
    }
    
    // 6. Escribir
    storage.write_note(&relative_path, &new_content).await?;
    Ok(UpdateResult::Ok)
}
```

#### `apply_property_changes_minimal`

- Opera sobre **líneas** del texto original
- Identifica líneas de propiedades del bloque (`card-s::`, `card-d::`, etc.)
- Reemplaza/inserte/elimina **solo esas líneas**
- Preserva: finales de línea (`\n` vs `\r\n`), indentación, viñetas (`- ` vs `* `), líneas en blanco

### 4.3 Tests Requeridos

| Test | Escenario |
|------|-----------|
| `concurrent_edit_simulation` | Desktop modifica nota → Syncthing → móvil repasa; verificar merge |
| `external_reformat` | Formateador externo (Prettier) reescribe nota; verificar localización por hash |
| `duplicate_blocks` | Dos bloques con mismo texto visible; verificar `occurrence_index` y `parent_hashes` |
| `property_add_remove` | Añadir `card-new::`, eliminar `card-lapses::`; verificar solo esas líneas cambian |
| `unresolvable_block` | Bloque borrado externamente; debe fallar y avisar |

### 4.4 Uso en Desktop

Mismo comando `update_card_properties` disponible en desktop para el repaso, eliminando el problema de reserialización completa allí también.

---

## 5. Syncthing y Similares

### 5.1 Archivos a Ignorar (no cargar como notas)

| Patrón | Acción |
|--------|--------|
| `.stfolder` | Ignorar carpeta completamente |
| `.stversions/` | Ignorar carpeta completamente |
| `.syncthing.*.tmp` | Ignorar archivo |
| `*.sync-conflict-*.md` | **No cargar como nota**, no duplicar tarjetas; contar y mostrar en UI: "Se omitieron X conflictos de Syncthing" |

### 5.2 Implementación

En `scan_vault` / `SafStorage::list_notes`:
```rust
fn is_syncthing_ignored(path: &str) -> bool {
    path.contains(".stfolder") 
        || path.contains(".stversions/")
        || path.contains(".syncthing.") && path.ends_with(".tmp")
        || path.contains(".sync-conflict-") && path.ends_with(".md")
}
```

Contador en `VaultSnapshot`: `syncthing_conflicts_skipped: usize` → UI muestra aviso.

---

## 6. Rendimiento: Índice en Caché

### 6.1 Problema

Listar/leer cientos/miles de notas via SAF es **lento** (IPC + Binder por cada archivo).

### 6.2 Solución: Índice Persistente en Almacenamiento Privado

**Ubicación:** `app_config_dir()/vault_index/{vault_id}.json`

**Estructura:**
```json
{
  "vault_id": "saf:abc123:vault",
  "last_scan": 1700000000000,
  "entries": {
    "pages/nota.md": { "size": 1024, "modified": 1699999999000, "hash": "a1b2c3...", "cards": 3 },
    "journals/2026_10_23.md": { "size": 2048, "modified": 1700000001000, "hash": "d4e5f6...", "cards": 1 }
  }
}
```

**Algoritmo de carga:**
1. Cargar índice si existe y `vault_id` coincide
2. `list_notes()` via SAF → obtener `(path, size, modified)` para cada archivo
3. Comparar con índice:
   - **Igual size+modified**: usar datos del índice (cards, hash)
   - **Distinto**: leer nota, extraer tarjetas, actualizar entrada
   - **Nuevo**: leer, indexar
   - **Borrado en índice pero no en FS**: eliminar entrada
4. Guardar índice actualizado
5. Mostrar barra de progreso: "Indexando bóveda... 234/1000 notas"

### 6.3 Objetivo de Rendimiento

| Métrica | Objetivo |
|---------|----------|
| Primera carga (1000 notas) | < 10s (depende de SAF) |
| Cargas posteriores (sin cambios) | < 500ms |
| Carga incremental (10 notas nuevas) | < 1s |

**Si no se alcanza:** Reportar métricas reales antes de continuar.

---

## 7. Imágenes: Blob URLs

### 7.1 Problema

SAF no da rutas de filesystem reales → protocolo `asset://` no funciona.

### 7.2 Solución: Blob URLs

1. Backend lee bytes de imagen via SAF (`read_image` → `Vec<u8>`)
2. Validaciones existentes: tipo MIME (magic bytes), tamaño ≤ 5MB
3. Frontend: `URL.createObjectURL(new Blob([bytes], { type: mime }))`
4. CSP ya permite `img-src blob:` (ver `tauri.conf.json`)

### 7.3 Limpieza

```typescript
// En componente que renderiza imagen
useEffect(() => {
  return () => URL.revokeObjectURL(blobUrl);
}, [blobUrl]);
```

---

## 8. Comandos Desktop Deshabilitados en SAF

| Comando | Razón | UI Feedback |
|---------|-------|-------------|
| `create_snapshot` / `list_snapshots` / `restore_snapshot` | `chronos/` no accesible via SAF (fuera del árbol elegido) | Botones deshabilitados + tooltip "Snapshots no disponibles en bóvedas SAF" |
| `delete_unused_attachments` | Requiere escanear todo `assets/` recursivo; lento en SAF | Deshabilitado + tooltip |
| `export_page_text` (diálogo nativo guardar) | Funciona (usa file picker nativo) | **Habilitado** |

**Comunicación:** `VaultSnapshot` incluye `capabilities: VaultCapabilities`:
```rust
#[derive(Serialize)]
pub struct VaultCapabilities {
    pub snapshots: bool,
    pub unused_attachments_cleanup: bool,
    pub native_save_dialog: bool,
}
```
Frontend usa esto para habilitar/deshabilitar UI.

---

## 9. Interfaz de Usuario

### 9.1 Selector de Bóveda

```
┌─────────────────────────────────────┐
│  📁 Bóveda actual: Documents/vault  │
│  [Cambiar bóveda]                   │
├─────────────────────────────────────┤
│  ℹ️ Al elegir una carpeta, SinNotas │
│  solicitará permiso para acceder a  │
│  sus archivos. Solo se leerán/escri-│
│  birán archivos .md dentro de la    │
│  carpeta seleccionada.              │
│                                     │
│  [Botón: Elegir carpeta...]         │
└─────────────────────────────────────┘
```

### 9.2 Flujo

1. Usuario pulsa "Elegir carpeta"
2. `pick_vault_root()` → `ACTION_OPEN_DOCUMENT_TREE` con `EXTRA_INITIAL_URI = Documents/`
3. Usuario navega y pulsa "Seleccionar"
4. Backend recibe `tree_uri`, valida que sea almacenamiento local (no nube)
5. Guarda `ActiveVaultRoot::Saf { tree_uri, display_name, subfolder: None }` en config
6. `load_vault()` → reconstruye `SafStorage`, escanea, muestra progreso
7. UI actualiza nombre de bóveda visible

### 9.3 Revocar Permiso

- Botón "Revocar acceso" en ajustes de bóveda
- Llama a `revoke_saf_permission(tree_uri)` (via `ContentResolver.revokeUriPermission`)
- Resetea a vault interno

---

## 10. Plan de Pruebas

### 10.1 Tests Unitarios (Rust - mock SAF)

```rust
#[cfg(test)]
mod saf_storage_tests {
    use mock_saf::MockDocumentFile;
    
    #[test]
    fn resolve_relative_path_rejects_traversal() { ... }
    #[test]
    fn resolve_relative_path_rejects_reserved_names() { ... }
    #[test]
    fn write_note_journaling_recovers_after_crash() { ... }
    #[test]
    fn update_card_properties_external_change_merge() { ... }
    #[test]
    fn update_card_properties_duplicate_blocks_resolved_by_occurrence() { ... }
    #[test]
    fn syncthing_conflict_files_skipped() { ... }
}
```

### 10.2 Tests de Integración (Emulador Android)

| Test | Descripción |
|------|-------------|
| `pick_vault_then_load` | Abrir picker, elegir `Documents/vault`, verificar carga |
| `permission_revoked` | Revocar permiso en ajustes Android → app detecta y pide reelegir |
| `sd_card_removed` | Extraer SD → app muestra aviso; volver a insertar → recupera |
| `concurrent_desktop_mobile` | Desktop edita via Syncthing → móvil repasa → merge correcto |
| `large_vault_performance` | 1000 notas → medir tiempo de carga inicial/incremental |

### 10.3 Casos Límite

| Caso | Comportamiento Esperado |
|------|------------------------|
| Nota borrada y recreada con mismo nombre | `update_card_properties` detecta hash cambiado, re-localiza por contenido |
| App cerrada a medio escribir | Al arrancar, temporal `*.tmp.*` se recupera y sobrescribe original |
| Dos repasos seguidos (sin cerrar app) | Segunda actualización usa hash actualizado, no hay conflicto |
| Subcarpeta `vault` movida dentro del árbol SAF | `DocumentFile.find_file("vault")` la encuentra en nueva ubicación |

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| `tauri-plugin-android-fs` no mantenido / API rota | Media | Alto | Auditoría previa del código; fork si necesario |
| SAF extremadamente lento (>30s para 1000 notas) | Media | Alto | Índice en caché + barra de progreso; medir antes de Fase 4B |
| `update_card_properties` no localiza bloque tras edición externa | Baja | Alto | Hash de contenido + `occurrence_index` + `parent_hashes`; test exhaustivo |
| Usuario elige carpeta raíz del almacenamiento (miles de archivos) | Baja | Medio | Validar en picker: sugerir subcarpeta; limitar scan a `.md` |
| Plugin SAF no soporta `read_image` eficiente | Media | Medio | Fallback: leer todo el archivo a memoria (≤5MB) |

---

## Próximos Pasos (Fase 4B)

Tras aprobación de este plan, implementación por commits:

1. **(a)** Refactor `VaultStorage` trait + `FsStorage` sin cambios de comportamiento
2. **(b)** `SafStorage` solo lectura (`list_notes`, `read_note`, `read_image`)
3. **(c)** `update_card_properties` con localización estable + verificación hash
4. **(d)** Escritura SAF con diario + recuperación en arranque
5. **(e)** UI: selector bóveda, indicador capacidades, revocar permiso
6. **(f)** Actualizar CI: test emulador Android, inspección manifest SAF

---

## Decisiones Pendientes de Confirmación

1. **Versión exacta de `tauri-plugin-android-fs`**: ¿Usar `main` branch o tag específico? Necesito auditar su código primero.
2. **Subcarpeta por defecto**: ¿Asumir `Documents/vault` o pedir al usuario que la cree/elija dentro del árbol SAF?
3. **Índice en caché**: ¿Activar por defecto o solo para >500 notas?
4. **allowBackup en AndroidManifest**: ¿`false` para bóvedas SAF? (Ver Fase 3.4)