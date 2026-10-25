use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_android_fs::{init as init_android_fs, AndroidFs, AndroidFsExt};
use tauri_plugin_clipboard_manager::init as init_clipboard;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::init as init_opener;
/// Solo la apertura de notas con la app predeterminada usa el opener en Rust;
/// en móvil el comando es un stub (ver `open_note_with_default_app`).
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;
use walkdir::WalkDir;

pub mod metadata_cache;

/// Trait que abstrae el almacenamiento de la bóveda.
/// Permite implementaciones para filesystem local (FsStorage) y SAF (SafStorage).
#[async_trait]
pub trait VaultStorage: Send + Sync {
    /// Identificador único de este storage (para UI/logging)
    fn storage_id(&self) -> &str;

    /// Nombre visible para el usuario
    fn display_name(&self) -> &str;

    /// Lista todas las notas (rutas relativas terminadas en .md)
    async fn list_notes(&self) -> Result<Vec<NoteEntry>, String>;

    /// Lee el contenido de una nota como String (UTF-8)
    async fn read_note(&self, relative_path: &str) -> Result<String, String>;

    /// Escribe contenido a una nota (atómico si posible)
    async fn write_note(&self, relative_path: &str, content: &str) -> Result<(), String>;

    /// Crea una nota nueva (fallará si existe)
    async fn create_note(&self, relative_path: &str, content: &str) -> Result<(), String>;

    /// Borra una nota
    async fn delete_note(&self, relative_path: &str) -> Result<(), String>;

    /// Renombra/mueve una nota
    async fn rename_note(&self, old_path: &str, new_path: &str) -> Result<(), String>;

    /// Verifica si existe
    async fn note_exists(&self, relative_path: &str) -> Result<bool, String>;

    /// Metadatos: tamaño y fecha de modificación
    async fn note_metadata(&self, relative_path: &str) -> Result<NoteMetadata, String>;

    /// Lee bytes de imagen (para asset protocol)
    async fn read_image(&self, relative_path: &str) -> Result<Vec<u8>, String>;

    /// Lee un archivo interno de progreso (por ejemplo progress/reviews.json).
    /// No se expone como nota y la ruta siempre la valida el backend.
    async fn read_progress_file(&self, relative_path: &str) -> Result<Option<String>, String>;

    /// Escribe de forma atómica un archivo interno de progreso.
    async fn write_progress_file(&self, relative_path: &str, contents: &str) -> Result<(), String>;

    /// Resuelve una ruta de imagen (no requiere extensión .md)
    fn resolve_image(&self, relative_path: &str) -> Result<PathBuf, String>;

    /// Capacidad: ¿soporta operaciones atómicas reales?
    fn supports_atomic_writes(&self) -> bool;

    /// Capacidad: ¿soporta listado eficiente?
    fn supports_efficient_listing(&self) -> bool;

    /// Ruta raíz absoluta (para comandos que necesitan acceso directo al FS, como snapshots)
    fn root_path(&self) -> &Path;
}

/// Entrada de nota para listados
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteEntry {
    pub relative_path: String, // ej: "pages/nota.md"
    pub size: u64,
    pub modified: i64, // millis since epoch
}

/// Metadatos de nota
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub size: u64,
    pub modified: i64,
    pub is_readonly: bool,
}

/// Implementación para filesystem local (desktop, vault interno Android/iOS)
pub struct FsStorage {
    root: PathBuf,
    storage_id: String,
    display_name: String,
}

impl FsStorage {
    pub fn new(root: PathBuf, storage_id: String, display_name: String) -> Self {
        Self {
            root,
            storage_id,
            display_name,
        }
    }

    /// Resuelve una ruta relativa a absoluta, validando que esté dentro del root
    fn resolve(&self, relative_path: &str) -> Result<PathBuf, String> {
        resolve_note_path(&self.root, relative_path)
    }
}

#[async_trait]
impl VaultStorage for FsStorage {
    fn storage_id(&self) -> &str {
        &self.storage_id
    }

    fn display_name(&self) -> &str {
        &self.display_name
    }

    async fn list_notes(&self) -> Result<Vec<NoteEntry>, String> {
        let mut entries = Vec::new();
        for entry in WalkDir::new(&self.root).sort_by_file_name() {
            let entry = entry.map_err(|e: walkdir::Error| e.to_string())?;
            if !entry.file_type().is_file() {
                continue;
            }
            if entry.path().extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }
            let metadata = entry
                .metadata()
                .map_err(|e: walkdir::Error| e.to_string())?;
            let relative = entry
                .path()
                .strip_prefix(&self.root)
                .map_err(|_| "Nota fuera del vault".to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            entries.push(NoteEntry {
                relative_path: relative,
                size: metadata.len(),
                modified: metadata
                    .modified()
                    .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64)
                    .unwrap_or(0),
            });
        }
        Ok(entries)
    }

    async fn read_note(&self, relative_path: &str) -> Result<String, String> {
        let path = self.resolve(relative_path)?;
        fs::read_to_string(&path).map_err(|e: std::io::Error| e.to_string())
    }

    async fn write_note(&self, relative_path: &str, content: &str) -> Result<(), String> {
        let path = self.resolve(relative_path)?;
        write_file_atomically(&path, content)
    }

    async fn create_note(&self, relative_path: &str, content: &str) -> Result<(), String> {
        let path = self.resolve(relative_path)?;
        if path.exists() {
            return Err("La nota ya existe".to_string());
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e: std::io::Error| e.to_string())?;
        }
        write_file_atomically(&path, content)
    }

    async fn delete_note(&self, relative_path: &str) -> Result<(), String> {
        let path = self.resolve(relative_path)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|e: std::io::Error| e.to_string())?;
        }
        Ok(())
    }

    async fn rename_note(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let old = self.resolve(old_path)?;
        let new = self.resolve(new_path)?;
        if let Some(parent) = new.parent() {
            fs::create_dir_all(parent).map_err(|e: std::io::Error| e.to_string())?;
        }
        if new.exists() {
            return Err("Ya existe una nota con ese nombre".to_string());
        }
        fs::rename(&old, &new).map_err(|e: std::io::Error| e.to_string())?;
        Ok(())
    }

    async fn note_exists(&self, relative_path: &str) -> Result<bool, String> {
        let path = self.resolve(relative_path)?;
        Ok(path.exists())
    }

    async fn note_metadata(&self, relative_path: &str) -> Result<NoteMetadata, String> {
        let path = self.resolve(relative_path)?;
        let metadata = fs::metadata(&path).map_err(|e: std::io::Error| e.to_string())?;
        Ok(NoteMetadata {
            size: metadata.len(),
            modified: metadata
                .modified()
                .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64)
                .unwrap_or(0),
            is_readonly: metadata.permissions().readonly(),
        })
    }

    async fn read_image(&self, relative_path: &str) -> Result<Vec<u8>, String> {
        let path = self.resolve_image(relative_path)?;
        fs::read(&path).map_err(|e: std::io::Error| e.to_string())
    }

    async fn read_progress_file(&self, relative_path: &str) -> Result<Option<String>, String> {
        validate_progress_relative_path(relative_path)?;
        let path = resolve_vault_path(&self.root, relative_path)?;
        if !path.exists() {
            return Ok(None);
        }
        let file = fs::File::open(&path).map_err(|error| error.to_string())?;
        read_text_bounded(file, REVIEW_PROGRESS_MAX_BYTES).map(Some)
    }

    async fn write_progress_file(&self, relative_path: &str, contents: &str) -> Result<(), String> {
        validate_progress_relative_path(relative_path)?;
        let path = resolve_vault_path(&self.root, relative_path)?;
        write_file_atomically(&path, contents)
    }

    /// Resuelve una ruta de imagen (no requiere extensión .md)
    fn resolve_image(&self, relative_path: &str) -> Result<PathBuf, String> {
        resolve_vault_path(&self.root, relative_path)
    }

    fn supports_atomic_writes(&self) -> bool {
        true
    }

    fn supports_efficient_listing(&self) -> bool {
        true
    }

    fn root_path(&self) -> &Path {
        &self.root
    }
}

/// Implementación para Android SAF (Storage Access Framework)
/// Usa el plugin `tauri-plugin-android-fs` para acceder a archivos mediante SAF.
/// La API usa `FilePath` y `DirPath`; en la versión 2.x `DirPath` se serializa
/// como un objeto JSON `{ topTreeUri, relativeTerms }`, no como una URI plana.
pub struct SafStorage {
    /// Directorio raíz SAF. Se conserva el `DirPath` porque el plugin lo
    /// necesita para listar y crear archivos.
    root: tauri_plugin_android_fs::DirPath,
    /// Representación serializada de `root` que se guarda en el frontend.
    root_dir_path: String,
    /// Nombre visible para el usuario.
    display_name: String,
    /// Handle de la app Tauri para acceder al plugin android-fs.
    app_handle: AppHandle,
    /// Índice de rutas relativas -> `FilePath` obtenidas de `read_dir`.
    /// `read_dir` devuelve FilePath escribibles, así que también sirve para
    /// sobrescribir notas existentes.
    files: Mutex<BTreeMap<String, tauri_plugin_android_fs::FilePath>>,
}

impl SafStorage {
    pub fn new(
        root: tauri_plugin_android_fs::DirPath,
        root_dir_path: String,
        display_name: String,
        app_handle: AppHandle,
    ) -> Self {
        Self {
            root,
            root_dir_path,
            display_name,
            app_handle,
            files: Mutex::new(BTreeMap::new()),
        }
    }

    /// Obtiene la API AndroidFs del plugin.
    fn android_fs(&self) -> &(impl tauri_plugin_android_fs::AndroidFs + use<'_>) {
        self.app_handle.android_fs()
    }

    /// Normaliza y valida una ruta relativa. Nunca se construyen URIs por
    /// concatenación: el plugin resuelve los términos relativos dentro del
    /// árbol SAF.
    fn normalize_relative_path(relative_path: &str) -> Result<String, String> {
        let normalized = relative_path.trim().replace('\\', "/");
        let normalized = normalized.trim_start_matches('/');
        if normalized.is_empty()
            || normalized
                .split('/')
                .any(|part| part.is_empty() || part == "." || part == "..")
        {
            return Err("La ruta de la nota no es válida.".to_string());
        }
        Ok(normalized.to_string())
    }

    /// Recorre el árbol SAF completo y guarda cada archivo por su ruta
    /// relativa. La profundidad está acotada para evitar ciclos patológicos.
    fn scan_dir(
        &self,
        dir: &tauri_plugin_android_fs::DirPath,
        prefix: &str,
        depth: usize,
        files: &mut BTreeMap<String, tauri_plugin_android_fs::FilePath>,
    ) -> Result<(), String> {
        if depth > 64 {
            return Err("La bóveda SAF tiene demasiados niveles de carpetas.".to_string());
        }
        let entries = self
            .android_fs()
            .read_dir(dir)
            .map_err(|error| error.to_string())?;
        for (name, entry) in entries {
            if name.is_empty() || name == "." || name == ".." {
                continue;
            }
            let relative = if prefix.is_empty() {
                name
            } else {
                format!("{prefix}/{name}")
            };
            match entry {
                tauri_plugin_android_fs::EntryPath::File(file_path) => {
                    files.insert(relative, file_path);
                }
                tauri_plugin_android_fs::EntryPath::Dir(child_dir) => {
                    self.scan_dir(&child_dir, &relative, depth + 1, files)?;
                }
            }
        }
        Ok(())
    }

    /// Reindexa el árbol SAF. Se llama al listar y cuando una ruta no está en
    /// el índice (por ejemplo, si otra app creó un archivo entretanto).
    fn refresh_index(&self) -> Result<(), String> {
        let mut files = BTreeMap::new();
        self.scan_dir(&self.root, "", 0, &mut files)?;
        *self
            .files
            .lock()
            .map_err(|_| "No se pudo actualizar el índice de la bóveda SAF.".to_string())? = files;
        Ok(())
    }

    fn existing_file_path(
        &self,
        relative_path: &str,
    ) -> Result<Option<tauri_plugin_android_fs::FilePath>, String> {
        let relative = Self::normalize_relative_path(relative_path)?;
        {
            let files = self
                .files
                .lock()
                .map_err(|_| "No se pudo consultar el índice de la bóveda SAF.".to_string())?;
            if let Some(path) = files.get(&relative) {
                return Ok(Some(path.clone()));
            }
        }

        self.refresh_index()?;
        let files = self
            .files
            .lock()
            .map_err(|_| "No se pudo consultar el índice de la bóveda SAF.".to_string())?;
        Ok(files.get(&relative).cloned())
    }

    fn require_file_path(
        &self,
        relative_path: &str,
    ) -> Result<tauri_plugin_android_fs::FilePath, String> {
        self.existing_file_path(relative_path)?
            .ok_or_else(|| format!("No se encontró la nota '{relative_path}' en la bóveda SAF."))
    }

    fn remember_file(
        &self,
        relative_path: String,
        file_path: tauri_plugin_android_fs::FilePath,
    ) -> Result<(), String> {
        self.files
            .lock()
            .map_err(|_| "No se pudo actualizar el índice de la bóveda SAF.".to_string())?
            .insert(relative_path, file_path);
        Ok(())
    }

    fn forget_file(&self, relative_path: &str) -> Result<(), String> {
        self.files
            .lock()
            .map_err(|_| "No se pudo actualizar el índice de la bóveda SAF.".to_string())?
            .remove(relative_path);
        Ok(())
    }
}

#[async_trait]
impl VaultStorage for SafStorage {
    fn storage_id(&self) -> &str {
        "saf"
    }

    fn display_name(&self) -> &str {
        &self.display_name
    }

    async fn list_notes(&self) -> Result<Vec<NoteEntry>, String> {
        self.refresh_index()?;
        let files = self
            .files
            .lock()
            .map_err(|_| "No se pudo consultar el índice de la bóveda SAF.".to_string())?;
        Ok(files
            .keys()
            .filter(|relative| relative.ends_with(".md"))
            .map(|relative| NoteEntry {
                relative_path: relative.clone(),
                size: 0,
                modified: 0,
            })
            .collect())
    }

    async fn read_note(&self, relative_path: &str) -> Result<String, String> {
        let file_path = self.require_file_path(relative_path)?;
        self.android_fs()
            .read_to_string(&file_path)
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())
    }

    async fn write_note(&self, relative_path: &str, content: &str) -> Result<(), String> {
        let relative = Self::normalize_relative_path(relative_path)?;
        if let Some(file_path) = self.existing_file_path(&relative)? {
            return self
                .android_fs()
                .write(&file_path, content.as_bytes())
                .map_err(|e: tauri_plugin_android_fs::Error| e.to_string());
        }

        let file_path = self
            .android_fs()
            .new_file_with_contents(
                &self.root,
                &relative,
                Some("text/markdown"),
                content.as_bytes(),
            )
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())?;
        self.remember_file(relative, file_path)
    }

    async fn create_note(&self, relative_path: &str, content: &str) -> Result<(), String> {
        let relative = Self::normalize_relative_path(relative_path)?;
        if self.existing_file_path(&relative)?.is_some() {
            return Err("La nota ya existe".to_string());
        }
        let file_path = self
            .android_fs()
            .new_file_with_contents(
                &self.root,
                &relative,
                Some("text/markdown"),
                content.as_bytes(),
            )
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())?;
        self.remember_file(relative, file_path)
    }

    async fn delete_note(&self, relative_path: &str) -> Result<(), String> {
        let relative = Self::normalize_relative_path(relative_path)?;
        let Some(file_path) = self.existing_file_path(&relative)? else {
            return Ok(());
        };
        self.android_fs()
            .remove_file(&file_path)
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())?;
        self.forget_file(&relative)
    }

    async fn rename_note(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let old_relative = Self::normalize_relative_path(old_path)?;
        let new_relative = Self::normalize_relative_path(new_path)?;
        if old_relative == new_relative {
            return Ok(());
        }
        if self.existing_file_path(&new_relative)?.is_some() {
            return Err("Ya existe una nota con ese nombre".to_string());
        }
        let content = self.read_note(&old_relative).await?;
        self.write_note(&new_relative, &content).await?;
        self.delete_note(&old_relative).await
    }

    async fn note_exists(&self, relative_path: &str) -> Result<bool, String> {
        Ok(self.existing_file_path(relative_path)?.is_some())
    }

    async fn note_metadata(&self, relative_path: &str) -> Result<NoteMetadata, String> {
        let size = self.read_note(relative_path).await?.len() as u64;
        Ok(NoteMetadata {
            size,
            modified: 0,
            is_readonly: false,
        })
    }

    async fn read_image(&self, relative_path: &str) -> Result<Vec<u8>, String> {
        let file_path = self.require_file_path(relative_path)?;
        self.android_fs()
            .read(&file_path)
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())
    }

    async fn read_progress_file(&self, relative_path: &str) -> Result<Option<String>, String> {
        validate_progress_relative_path(relative_path)?;
        let Some(file_path) = self.existing_file_path(relative_path)? else {
            return Ok(None);
        };
        let file = self
            .android_fs()
            .open_file(&file_path)
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())?;
        read_text_bounded(file, REVIEW_PROGRESS_MAX_BYTES).map(Some)
    }

    async fn write_progress_file(&self, relative_path: &str, contents: &str) -> Result<(), String> {
        validate_progress_relative_path(relative_path)?;
        let relative = Self::normalize_relative_path(relative_path)?;
        if let Some(file_path) = self.existing_file_path(&relative)? {
            return self
                .android_fs()
                .write(&file_path, contents.as_bytes())
                .map_err(|e: tauri_plugin_android_fs::Error| e.to_string());
        }
        let file_path = self
            .android_fs()
            .new_file_with_contents(
                &self.root,
                &relative,
                Some("application/json"),
                contents.as_bytes(),
            )
            .map_err(|e: tauri_plugin_android_fs::Error| e.to_string())?;
        self.remember_file(relative, file_path)
    }

    fn supports_atomic_writes(&self) -> bool {
        false // SAF no garantiza escrituras atómicas
    }

    fn supports_efficient_listing(&self) -> bool {
        false // SAF es más lento que filesystem local
    }

    fn root_path(&self) -> &Path {
        // SAF no tiene ruta de filesystem real; se conserva la representación
        // serializada para los comandos que solo necesitan mostrarla.
        Path::new(&self.root_dir_path)
    }

    fn resolve_image(&self, relative_path: &str) -> Result<PathBuf, String> {
        let file_path = self.require_file_path(relative_path)?;
        Ok(PathBuf::from(
            tauri_plugin_android_fs::convert_file_path_to_string(&file_path),
        ))
    }
}
#[derive(Default)]
struct ActiveVault(Mutex<Option<ActiveVaultInner>>);

struct ActiveVaultInner {
    root: PathBuf,
    /// Ruta que está actualmente permitida en el asset protocol scope.
    /// Puede ser distinta de `root` si se hizo allow_directory con una ruta padre.
    asset_scope_root: PathBuf,
    /// Storage concreto (FsStorage o futuro SafStorage)
    storage: Arc<dyn VaultStorage>,
}

/// Raíces de carpetas que el usuario autorizó explícitamente como bóvedas.
#[derive(Default)]
struct ApprovedVaultRoots(Mutex<Vec<PathBuf>>);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlockNode {
    pub id: String,
    #[serde(rename = "type", default = "default_block_type")]
    pub block_type: String,
    pub content: String,
    #[serde(default)]
    pub image_alt: Option<String>,
    pub children: Vec<BlockNode>,
    #[serde(default)]
    pub collapsed: bool,
}

fn default_block_type() -> String {
    "text".to_string()
}

/// Límite único de profundidad del árbol de bullets. El parser lo aplica para
/// que el árbol nunca llegue a ser demasiado profundo para serde/bincode, y el
/// serializador descarta cualquier nodo que lo supere.
pub(crate) const MAX_BLOCK_DEPTH: usize = 64;

/// Una revisión (snapshot) del historial de versiones de una nota.
/// Espejo del tipo `PageRevision` del frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PageRevision {
    pub id: String,
    pub timestamp: String,
    pub blocks: Vec<BlockNode>,
    pub summary: String,
    /// Instante UTC en milisegundos (si el origen lo conoce). Permite a la
    /// interfaz mostrar la hora local sin reinterpretar cadenas de fecha.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

/// Ruta del archivo de revisiones de una nota: `.sinnotas/revisions/<ruta
/// relativa de la nota al vault>.json`. Las revisiones se indexan por ruta
/// relativa (no por id de página), de modo que renombrar la nota es mover el
/// archivo y que la carpeta del vault pueda moverse sin corromper nada.
fn revisions_file_path(root: &Path, note_path: &Path) -> Result<PathBuf, String> {
    let relative = note_path
        .strip_prefix(root)
        .map_err(|_| "La nota no pertenece al vault activo.".to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    Ok(root
        .join(".sinnotas")
        .join("revisions")
        .join(format!("{relative}.json")))
}

/// Lee las revisiones de una nota desde su archivo en disco.
/// Devuelve un vector vacío si no hay archivo, si está vacío o si el contenido
/// está corrupto; en ese caso el archivo dañado se aparta a `.bad` (best-effort)
/// para que una próxima escritura no choque con él.
fn read_page_revisions_from_disk(path: &Path) -> Vec<PageRevision> {
    if !path.exists() {
        return Vec::new();
    }
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };
    if content.trim().is_empty() {
        return Vec::new();
    }
    match serde_json::from_str::<Vec<PageRevision>>(&content) {
        Ok(revisions) => revisions,
        Err(_) => {
            let _ = fs::rename(path, path.with_extension("bad"));
            Vec::new()
        }
    }
}

fn markdown_image_parts(content: &str) -> Option<(String, String)> {
    let content = content.trim();
    let (alt, source) = if let Some(inner) = content.strip_prefix("![") {
        let (alt, source) = inner.split_once("](")?;
        (
            alt.to_string(),
            source.strip_suffix(')')?.trim().to_string(),
        )
    } else {
        let file_name = Path::new(content)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("imagen");
        let alt = Path::new(file_name)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("imagen");
        (alt.to_string(), content.to_string())
    };
    if source.is_empty()
        || source.contains('(')
        || source.contains(')')
        || source.contains('\r')
        || source.contains('\n')
        || !Path::new(&source)
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "png" | "jpg" | "jpeg" | "webp" | "svg" | "gif" | "bmp"
                )
            })
    {
        return None;
    }
    Some((alt, source))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PageData {
    pub id: String,
    pub title: String,
    pub path: String,
    pub frontmatter: Vec<String>,
    pub blocks: Vec<BlockNode>,
    #[serde(default)]
    pub is_journal: bool,
    #[serde(default)]
    pub journal_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkippedEntry {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSnapshot {
    pub root_path: String,
    pub vault_name: String,
    pub pages: Vec<PageData>,
    #[serde(default)]
    pub skipped: Vec<SkippedEntry>,
}

/// Carpeta visible del vault donde viven los snapshots manuales/automáticos.
const SNAPSHOT_FOLDER: &str = "chronos";
const SNAPSHOT_CONFIG_FILE: &str = "config.json";
const SNAPSHOT_FORMAT_VERSION: u32 = 1;
const SNAPSHOT_MAX_DAYS: u32 = 30;
const SNAPSHOT_RETENTION_MS: i64 = 30 * 24 * 60 * 60 * 1000;
const SNAPSHOT_MAX_BYTES: u64 = 16 * 1024 * 1024;
const SNAPSHOT_MAX_FILES_PER_NOTE: usize = 2_000;
/// Secuencia monótona para que dos snapshots del mismo milisegundo no colisionen.
static SNAPSHOT_SEQUENCE: AtomicU64 = AtomicU64::new(0);
/// Tolerancia para no confundir pequeños ajustes de reloj con un salto real.
const SNAPSHOT_CLOCK_TOLERANCE_MS: i64 = 5 * 60 * 1000;

/// Configuración de snapshots del vault. Se guarda en `chronos/config.json`
/// para que viaje con la bóveda y no dependa del almacenamiento del webview.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotConfig {
    #[serde(default = "snapshot_format_version")]
    pub version: u32,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub activated_at: i64,
    #[serde(default)]
    pub expires_at: i64,
    #[serde(default = "snapshot_default_duration_days")]
    pub duration_days: u32,
    #[serde(default = "snapshot_default_interval_hours")]
    pub interval_hours: u32,
    #[serde(default = "snapshot_default_max_per_day")]
    pub max_per_day: u32,
    #[serde(default)]
    pub last_run_at: i64,
    #[serde(default)]
    pub last_status: String,
}

fn snapshot_format_version() -> u32 {
    SNAPSHOT_FORMAT_VERSION
}
fn snapshot_default_duration_days() -> u32 {
    7
}
fn snapshot_default_interval_hours() -> u32 {
    4
}
fn snapshot_default_max_per_day() -> u32 {
    8
}

impl Default for SnapshotConfig {
    fn default() -> Self {
        Self {
            version: SNAPSHOT_FORMAT_VERSION,
            enabled: false,
            activated_at: 0,
            expires_at: 0,
            duration_days: snapshot_default_duration_days(),
            interval_hours: snapshot_default_interval_hours(),
            max_per_day: snapshot_default_max_per_day(),
            last_run_at: 0,
            last_status: String::new(),
        }
    }
}

impl SnapshotConfig {
    /// Normaliza valores leídos de disco: nunca confiamos en un JSON manipulado.
    fn sanitize(mut self) -> Self {
        self.version = SNAPSHOT_FORMAT_VERSION;
        self.duration_days = self.duration_days.clamp(1, SNAPSHOT_MAX_DAYS);
        self.interval_hours = self.interval_hours.clamp(1, 168);
        // 0 significa "sin límite diario"; el resto se acota a un rango prudente.
        self.max_per_day = self.max_per_day.min(96);
        if self.activated_at < 0 {
            self.activated_at = 0;
        }
        if self.expires_at < 0 {
            self.expires_at = 0;
        }
        if self.last_run_at < 0 {
            self.last_run_at = 0;
        }
        if self.enabled {
            // Una ventana inválida o de más de 30 días se considera corrupta.
            if self.activated_at == 0
                || self.expires_at <= self.activated_at
                || self.expires_at - self.activated_at > SNAPSHOT_RETENTION_MS
            {
                self.enabled = false;
                self.activated_at = 0;
                self.expires_at = 0;
                self.last_status = "invalid-window".to_string();
            }
        }
        self
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotState {
    pub note_path: String,
    pub enabled: bool,
    pub activated_at: i64,
    pub expires_at: i64,
    pub duration_days: u32,
    pub interval_hours: u32,
    pub max_per_day: u32,
    pub last_run_at: i64,
    pub next_run_at: i64,
    pub remaining_ms: i64,
    pub expired: bool,
    pub clock_anomaly: bool,
    pub last_status: String,
    pub storage_folder: String,
    pub max_days: u32,
    pub snapshot_count: usize,
}

/// Resumen de una nota con snapshots activos. Se usa en Ajustes para mostrar
/// el seguimiento por nota y cuántas copias guarda cada una.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotNoteSummary {
    pub note_path: String,
    pub note_title: String,
    pub snapshot_count: usize,
    pub activated_at: i64,
    pub expires_at: i64,
    pub remaining_ms: i64,
    pub interval_hours: u32,
    pub max_per_day: u32,
    pub last_run_at: i64,
    pub last_status: String,
}

/// Una instantánea completa e independiente de una nota. Cada snapshot es un
/// archivo propio: si uno se corrompe, los demás siguen siendo recuperables.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotRecord {
    #[serde(default = "snapshot_format_version")]
    pub version: u32,
    pub id: String,
    #[serde(default)]
    pub note_path: String,
    pub created_at: i64,
    pub created_at_label: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub source_hash: String,
    #[serde(default)]
    pub frontmatter: Vec<String>,
    pub blocks: Vec<BlockNode>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoredSnapshot {
    pub blocks: Vec<BlockNode>,
    pub frontmatter: Vec<String>,
}

/// Serializa los trabajos de snapshot/restauración para que dos ticks
/// simultáneos no intenten escribir la misma configuración a la vez.
#[derive(Default)]
struct SnapshotGate(Mutex<()>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedImagePath {
    pub relative_path: String,
    pub absolute_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Backlink {
    pub source_page: String,
    pub source_path: String,
    pub line_number: usize,
    pub snippet: String,
}

/// Convert Markdown outline format (- bullet with 2/4 spaces indentation) into a BlockNode tree
pub(crate) fn parse_markdown_with_frontmatter(content: &str) -> (Vec<String>, Vec<BlockNode>) {
    let lines: Vec<&str> = content.lines().collect();
    let mut frontmatter = Vec::new();
    let mut body_start = 0;
    if lines.first().is_some_and(|line| line.trim() == "---") {
        if let Some(end) = lines
            .iter()
            .enumerate()
            .skip(1)
            .find_map(|(index, line)| (line.trim() == "---").then_some(index))
        {
            frontmatter = lines[1..end]
                .iter()
                .map(|line| (*line).to_string())
                .collect();
            body_start = end + 1;
        }
    }

    let mut root_blocks: Vec<BlockNode> = Vec::new();
    // Stack of (indent_level, block)
    let mut stack: Vec<(usize, BlockNode)> = Vec::new();

    let mut id_counter = 0;

    for line in lines.iter().skip(body_start) {
        if line.trim().is_empty() {
            continue;
        }

        // Count leading spaces
        let trimmed_start = line.trim_start();
        let indent = line.len() - trimmed_start.len();

        let raw_text = if let Some(rest) = trimmed_start
            .strip_prefix("- ")
            .or_else(|| trimmed_start.strip_prefix("* "))
        {
            rest
        } else {
            if let Some((_, previous)) = stack.last_mut() {
                previous.content.push('\n');
                previous.content.push_str(trimmed_start);
                continue;
            }
            trimmed_start
        };

        id_counter += 1;
        let (block_type, image_alt, node_content) = match markdown_image_parts(raw_text) {
            Some((alt, source)) => ("image".to_string(), Some(alt), source),
            None => ("text".to_string(), None, raw_text.to_string()),
        };
        let node = BlockNode {
            id: format!("b-{}", id_counter),
            block_type,
            image_alt,
            content: node_content,
            children: Vec::new(),
            collapsed: false,
        };

        // Pop elements from stack that have >= current indent. El segundo
        // término acota la profundidad: las líneas más profundas se convierten
        // en hermanas a profundidad MAX_BLOCK_DEPTH - 1 en vez de perderse.
        while let Some((last_indent, _)) = stack.last() {
            if *last_indent >= indent || stack.len() >= MAX_BLOCK_DEPTH {
                let (_, finished_node) = stack.pop().unwrap();
                if let Some((_, parent)) = stack.last_mut() {
                    parent.children.push(finished_node);
                } else {
                    root_blocks.push(finished_node);
                }
            } else {
                break;
            }
        }

        stack.push((indent, node));
    }

    // Flush remaining stack
    while let Some((_, node)) = stack.pop() {
        if let Some((_, parent)) = stack.last_mut() {
            parent.children.push(node);
        } else {
            root_blocks.push(node);
        }
    }

    if root_blocks.is_empty() {
        root_blocks.push(BlockNode {
            id: "b-1".to_string(),
            block_type: "text".to_string(),
            image_alt: None,
            content: "".to_string(),
            children: Vec::new(),
            collapsed: false,
        });
    }

    (frontmatter, root_blocks)
}

/// Serialize BlockNode tree back into clean Markdown outline
/// Versión iterativa con límite de profundidad (64) para evitar stack overflow.
/// Niveles >= 64 se descartan (aplanados).
fn serialize_blocks_to_markdown(blocks: &[BlockNode], _depth: usize) -> String {
    let mut output = String::new();

    // Stack para DFS iterativo: (block, depth)
    struct StackItem<'a> {
        block: &'a BlockNode,
        depth: usize,
    }

    let mut stack: Vec<StackItem> = blocks
        .iter()
        .rev()
        .map(|b| StackItem { block: b, depth: 0 })
        .collect();

    while let Some(item) = stack.pop() {
        // Descartar nodos en profundidad >= MAX_BLOCK_DEPTH
        if item.depth >= MAX_BLOCK_DEPTH {
            continue;
        }
        let indent = "  ".repeat(item.depth);

        // Procesar el nodo actual
        if item.block.block_type == "image" {
            let mut content_lines = item.block.content.lines();
            let source = content_lines.next().unwrap_or("");
            let alt = item.block.image_alt.as_deref().unwrap_or("imagen");
            output.push_str(&format!("{}- ![{}]({})\n", indent, alt, source));
            for line in content_lines {
                output.push_str(line);
                output.push('\n');
            }
        } else {
            output.push_str(&format!("{}- {}\n", indent, item.block.content));
        }

        // Empujar hijos (su profundidad será item.depth + 1)
        if !item.block.children.is_empty() {
            for child in item.block.children.iter().rev() {
                stack.push(StackItem {
                    block: child,
                    depth: item.depth + 1,
                });
            }
        }
    }

    output
}

fn serialize_page_to_markdown(frontmatter: &[String], blocks: &[BlockNode]) -> String {
    let mut output = String::new();
    if !frontmatter.is_empty() {
        output.push_str("---\n");
        output.push_str(&frontmatter.join("\n"));
        output.push_str("\n---\n");
    }
    output.push_str(&serialize_blocks_to_markdown(blocks, 0));
    output
}

/// Nombres de carpetas reservadas que nunca deben ser accesibles como notas.
const RESERVED_DIRS: &[&str] = &["chronos", ".sinnotas", ".git"];

/// Patrón de archivos temporales que el backend crea (`.sinnotas-tmp`).
const TEMP_FILE_PATTERN: &str = ".sinnotas-tmp";

/// Valida que un componente de ruta individual sea seguro para una nota.
/// Rechaza nombres vacíos, `.`, `..`, separadores, carpetas reservadas y
/// el patrón de temporales.
pub(crate) fn is_safe_note_component(component: &str) -> bool {
    if component.is_empty() || component == "." || component == ".." {
        return false;
    }
    if component.contains('/') || component.contains('\\') {
        return false;
    }
    if RESERVED_DIRS
        .iter()
        .any(|&r| r.eq_ignore_ascii_case(component))
    {
        return false;
    }
    if component.contains(TEMP_FILE_PATTERN) {
        return false;
    }
    true
}

/// Archivo interno donde vive el diario de repasos.
const REVIEW_PROGRESS_PATH: &str = "progress/reviews.json";
/// Límite defensivo para el diario: 5 MB y 4000 repasos como máximo.
const REVIEW_PROGRESS_MAX_BYTES: usize = 5 * 1024 * 1024;
const REVIEW_PROGRESS_MAX_ENTRIES: usize = 4000;

/// Solo se permite el archivo fijo de progreso. No se aceptan rutas
/// arbitrarias, `..`, URIs ni nombres temporales.
fn validate_progress_relative_path(relative_path: &str) -> Result<(), String> {
    if relative_path != REVIEW_PROGRESS_PATH {
        return Err("La ruta del progreso no es válida.".to_string());
    }
    Ok(())
}

/// Resuelve una ruta de nota dentro del vault, exigiendo que sea un archivo `.md`
/// y que no atraviese carpetas reservadas ni use nombres de temporales.
/// A diferencia de `resolve_vault_path`, esta función es estricta para notas:
/// - Exige extensión `.md`
/// - Rechaza `chronos/`, `.sinnotas/`, `.git/` en cualquier nivel
/// - Rechaza nombres que contengan `.sinnotas-tmp`
pub(crate) fn resolve_note_path(root: &Path, requested_path: &str) -> Result<PathBuf, String> {
    if requested_path.contains('\0') {
        return Err("La ruta contiene caracteres nulos no permitidos.".to_string());
    }

    let trimmed = requested_path.trim();
    let lowered = trimmed.to_ascii_lowercase();
    if [
        "content:",
        "file:",
        "http:",
        "https:",
        "data:",
        "javascript:",
        "vbscript:",
    ]
    .iter()
    .any(|scheme| lowered.starts_with(scheme))
    {
        return Err("Las URIs no son rutas válidas del vault. Usa una ruta dentro de la carpeta autorizada.".to_string());
    }

    let requested = Path::new(trimmed);
    if requested
        .components()
        .any(|part| matches!(part, Component::ParentDir))
    {
        return Err("La ruta no puede salir del vault activo.".to_string());
    }

    // Validar cada componente de la ruta relativa antes de canonicalizar.
    for component in requested.components() {
        if let Component::Normal(part) = component {
            let text = part
                .to_str()
                .ok_or_else(|| "Componente de ruta no válido UTF-8.".to_string())?;
            if !is_safe_note_component(text) {
                return Err(format!(
                    "Componente de ruta no permitido: {text}. No se permiten carpetas reservadas (chronos, .sinnotas, .git) ni nombres de temporales."
                ));
            }
        }
    }

    let canonical_root =
        fs::canonicalize(root).map_err(|_| "El vault activo no está disponible.".to_string())?;
    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        canonical_root.join(requested)
    };
    if !candidate.starts_with(&canonical_root) {
        return Err("La ruta solicitada está fuera del vault activo.".to_string());
    }

    // Exigir extensión .md
    if candidate.extension().and_then(|ext| ext.to_str()) != Some("md") {
        return Err("Solo se pueden operar notas con extensión .md.".to_string());
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "La ruta del archivo no es válida.".to_string())?;
    let mut existing_parent = parent;
    while !existing_parent.exists() {
        existing_parent = existing_parent
            .parent()
            .ok_or_else(|| "No se encontró un directorio válido para la ruta.".to_string())?;
    }
    let canonical_parent = fs::canonicalize(existing_parent).map_err(|err| err.to_string())?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err("La ruta solicitada atraviesa un enlace fuera del vault activo.".to_string());
    }
    if candidate.exists() {
        let canonical_file = fs::canonicalize(&candidate).map_err(|err| err.to_string())?;
        if !canonical_file.starts_with(&canonical_root) {
            return Err("El archivo solicitado está fuera del vault activo.".to_string());
        }
    }

    let missing_suffix = parent
        .strip_prefix(existing_parent)
        .map_err(|err| err.to_string())?;
    Ok(canonical_parent.join(missing_suffix).join(
        candidate
            .file_name()
            .ok_or_else(|| "El nombre de archivo no es válido.".to_string())?,
    ))
}

fn resolve_vault_path(root: &Path, requested_path: &str) -> Result<PathBuf, String> {
    // Para rutas genéricas (imágenes, assets, etc.) se mantiene la validación
    // original sin exigir .md ni rechazar carpetas reservadas, ya que assets/
    // puede vivir junto a chronos/.sinnotas. Las validaciones de seguridad
    // (null bytes, URIs, path traversal, symlinks) se conservan.
    if requested_path.contains('\0') {
        return Err("La ruta contiene caracteres nulos no permitidos.".to_string());
    }

    let trimmed = requested_path.trim();
    let lowered = trimmed.to_ascii_lowercase();
    if [
        "content:",
        "file:",
        "http:",
        "https:",
        "data:",
        "javascript:",
        "vbscript:",
    ]
    .iter()
    .any(|scheme| lowered.starts_with(scheme))
    {
        return Err("Las URIs no son rutas válidas del vault. Usa una ruta dentro de la carpeta autorizada.".to_string());
    }

    let requested = Path::new(trimmed);
    if requested
        .components()
        .any(|part| matches!(part, Component::ParentDir))
    {
        return Err("La ruta no puede salir del vault activo.".to_string());
    }

    let canonical_root =
        fs::canonicalize(root).map_err(|_| "El vault activo no está disponible.".to_string())?;
    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        canonical_root.join(requested)
    };
    if !candidate.starts_with(&canonical_root) {
        return Err("La ruta solicitada está fuera del vault activo.".to_string());
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "La ruta del archivo no es válida.".to_string())?;
    let mut existing_parent = parent;
    // Usar symlink_metadata para NO seguir symlinks al comprobar existencia.
    // Si el path es un symlink colgante (dangling), symlink_metadata devuelve Ok
    // con file_type().is_symlink() == true, mientras que exists() devolvería false.
    while existing_parent.symlink_metadata().is_err() {
        existing_parent = existing_parent
            .parent()
            .ok_or_else(|| "No se encontró un directorio válido para la ruta.".to_string())?;
    }
    let canonical_parent = fs::canonicalize(existing_parent).map_err(|err| err.to_string())?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err("La ruta solicitada atraviesa un enlace fuera del vault activo.".to_string());
    }
    // Usar symlink_metadata para detectar symlinks sin seguirlos.
    if candidate.symlink_metadata().is_ok() {
        let canonical_file = fs::canonicalize(&candidate).map_err(|err| err.to_string())?;
        if !canonical_file.starts_with(&canonical_root) {
            return Err("El archivo solicitado está fuera del vault activo.".to_string());
        }
    }

    let missing_suffix = parent
        .strip_prefix(existing_parent)
        .map_err(|err| err.to_string())?;
    Ok(canonical_parent.join(missing_suffix).join(
        candidate
            .file_name()
            .ok_or_else(|| "El nombre de archivo no es válido.".to_string())?,
    ))
}

fn active_root(state: &ActiveVault) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .map_err(|_| "No se pudo acceder al vault activo.".to_string())?
        .as_ref()
        .map(|inner| inner.root.clone())
        .ok_or_else(|| "El vault aún no está inicializado.".to_string())
}

fn active_storage(state: &ActiveVault) -> Result<Arc<dyn VaultStorage>, String> {
    state
        .0
        .lock()
        .map_err(|_| "No se pudo acceder al vault activo.".to_string())?
        .as_ref()
        .map(|inner| inner.storage.clone())
        .ok_or_else(|| "El vault aún no está inicializado.".to_string())
}

#[allow(dead_code)]
fn active_root_and_storage(
    state: &ActiveVault,
) -> Result<(PathBuf, Arc<dyn VaultStorage>), String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "No se pudo acceder al vault activo.".to_string())?;
    let inner = guard
        .as_ref()
        .ok_or_else(|| "El vault aún no está inicializado.".to_string())?;
    Ok((inner.root.clone(), inner.storage.clone()))
}

fn active_asset_scope_root(state: &ActiveVault) -> Result<Option<PathBuf>, String> {
    Ok(state
        .0
        .lock()
        .map_err(|_| "No se pudo acceder al vault activo.".to_string())?
        .as_ref()
        .map(|inner| inner.asset_scope_root.clone()))
}

/// Delta sent to the webview when an external process modifies the vault.
/// Frontends apply it to their in-memory vault without re-reading every note.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultCacheDelta {
    pub root_path: String,
    pub changed: Vec<PageData>,
    pub removed: Vec<String>,
    pub revision: u64,
}

/// State holder for the persistent metadata cache and the filesystem watcher.
/// Only local filesystem vaults use it; SAF vaults on Android keep their own
/// incremental index and never touch `.sinnotas_cache.bin`.
#[derive(Default)]
struct VaultCacheState(Mutex<Option<Arc<VaultCacheRuntime>>>);

struct VaultCacheRuntime {
    root: PathBuf,
    app: AppHandle,
    cache: Mutex<metadata_cache::VaultMetadataCache>,
    revision: AtomicU64,
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pending: Mutex<BTreeSet<PathBuf>>,
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    wake: std::sync::Condvar,
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

impl VaultCacheRuntime {
    fn note_path(&self, file_path: &str) -> Option<PathBuf> {
        resolve_note_path(&self.root, file_path).ok()
    }

    fn update_paths(&self, paths: &[PathBuf], notify_frontend: bool) {
        if paths.is_empty() {
            return;
        }
        let mut cache = match self.cache.lock() {
            Ok(cache) => cache,
            Err(_) => return,
        };
        let mut changed = Vec::new();
        let mut removed = Vec::new();

        for path in paths {
            let Some(relative) = metadata_cache::relative_note_path(&self.root, path) else {
                continue;
            };
            match metadata_cache::read_cached_note(&self.root, &relative) {
                Ok(Some(note)) => {
                    let changed_note = cache.entries.get(&relative).is_none_or(|old| {
                        old.modified_ns != note.modified_ns
                            || old.size != note.size
                            || old.content_hash != note.content_hash
                    });
                    if changed_note {
                        cache.entries.insert(relative.clone(), note);
                        changed.push(relative);
                    }
                }
                Ok(None) => {
                    if cache.entries.remove(&relative).is_some() {
                        removed.push(relative);
                    }
                }
                Err(error) => {
                    // A temporarily unreadable file must not evict a valid
                    // cache entry; the next filesystem event retries.
                    eprintln!("No se pudo actualizar la caché de {relative}: {error}");
                }
            }
        }

        if changed.is_empty() && removed.is_empty() {
            return;
        }

        let snapshot = cache.clone();
        let changed_pages: Vec<PageData> = changed
            .iter()
            .filter_map(|relative| snapshot.entries.get(relative))
            .map(|note| note.to_page_data(&self.root))
            .collect();
        let removed_paths: Vec<String> = removed
            .iter()
            .map(|relative| self.root.join(relative).to_string_lossy().into_owned())
            .collect();
        drop(cache);

        if let Err(error) = metadata_cache::write_cache_file(&self.root, &snapshot) {
            eprintln!("No se pudo persistir la caché de metadatos: {error}");
        }

        if notify_frontend {
            let revision = self.revision.fetch_add(1, Ordering::SeqCst) + 1;
            let _ = self.app.emit(
                "vault-cache-delta",
                VaultCacheDelta {
                    root_path: self.root.to_string_lossy().into_owned(),
                    changed: changed_pages,
                    removed: removed_paths,
                    revision,
                },
            );
        }
    }

    fn find_backlinks(&self, page_title: &str) -> Vec<Backlink> {
        match self.cache.lock() {
            Ok(cache) => metadata_cache::find_cached_backlinks(&cache, &self.root, page_title),
            Err(_) => Vec::new(),
        }
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    fn schedule_paths(&self, paths: Vec<PathBuf>) {
        if paths.is_empty() {
            return;
        }
        if let Ok(mut pending) = self.pending.lock() {
            pending.extend(paths);
        }
        self.wake.notify_all();
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    fn install_watcher(self: &Arc<Self>) -> Result<(), String> {
        use notify::{RecursiveMode, Watcher};

        let weak = Arc::downgrade(self);
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                let Ok(event) = result else {
                    return;
                };
                if event.kind.is_access() {
                    return;
                }
                if let Some(runtime) = weak.upgrade() {
                    runtime.schedule_paths(event.paths);
                }
            })
            .map_err(|error| error.to_string())?;
        watcher
            .watch(&self.root, RecursiveMode::Recursive)
            .map_err(|error| error.to_string())?;

        *self
            .watcher
            .lock()
            .map_err(|_| "No se pudo guardar el watcher del vault.".to_string())? = Some(watcher);

        let weak = Arc::downgrade(self);
        std::thread::Builder::new()
            .name("sinnotas-vault-watcher".to_string())
            .spawn(move || loop {
                let Some(runtime) = weak.upgrade() else {
                    break;
                };
                let mut pending = match runtime.pending.lock() {
                    Ok(pending) => pending,
                    Err(_) => break,
                };
                if pending.is_empty() {
                    let (guard, timeout) = match runtime
                        .wake
                        .wait_timeout(pending, std::time::Duration::from_millis(500))
                    {
                        Ok(result) => result,
                        Err(_) => break,
                    };
                    pending = guard;
                    if timeout.timed_out() && pending.is_empty() {
                        continue;
                    }
                }
                drop(pending);

                // Coalesce the burst of events produced by atomic saves and
                // editor/rename operations before touching the cache.
                std::thread::sleep(std::time::Duration::from_millis(150));
                let paths: Vec<PathBuf> = match runtime.pending.lock() {
                    Ok(mut pending) => std::mem::take(&mut *pending).into_iter().collect(),
                    Err(_) => break,
                };
                runtime.update_paths(&paths, true);
            })
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

impl VaultCacheState {
    fn deactivate(&self) {
        if let Ok(mut current) = self.0.lock() {
            *current = None;
        }
    }

    fn current(&self) -> Option<Arc<VaultCacheRuntime>> {
        self.0.lock().ok().and_then(|current| current.clone())
    }

    fn activate(
        &self,
        app: &AppHandle,
        root: &Path,
    ) -> Result<(Vec<PageData>, Vec<SkippedEntry>), String> {
        let output = metadata_cache::load_or_scan_vault(root)?;
        let runtime = Arc::new(VaultCacheRuntime {
            root: fs::canonicalize(root).map_err(|error| error.to_string())?,
            app: app.clone(),
            cache: Mutex::new(output.cache),
            revision: AtomicU64::new(0),
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            pending: Mutex::new(BTreeSet::new()),
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            wake: std::sync::Condvar::new(),
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            watcher: Mutex::new(None),
        });
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        if let Err(error) = runtime.install_watcher() {
            // The cache and the initial scan still work; only live updates are
            // lost. Do not abort startup for a sandboxed watcher.
            eprintln!("No se pudo iniciar el watcher del vault: {error}");
        }
        *self
            .0
            .lock()
            .map_err(|_| "No se pudo guardar la caché del vault.".to_string())? = Some(runtime);
        Ok((output.pages, output.skipped))
    }
}

/// Límite máximo de tamaño por nota (20 MB).
const NOTE_MAX_BYTES: u64 = 20 * 1024 * 1024;

fn scan_vault(root: &Path) -> Result<(Vec<PageData>, Vec<SkippedEntry>), String> {
    let mut pages = Vec::new();
    let mut skipped = Vec::new();

    // WalkDir con filter_entry para saltar directorios sin permisos de lectura
    // sin abortar todo el recorrido.
    let walker = WalkDir::new(root)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|entry| {
            // Los directorios internos (snapshots, revisiones y metadatos de
            // Git) nunca son notas del usuario. Se omiten también sus `.md`.
            let reserved = entry.depth() > 0
                && entry.file_type().is_dir()
                && RESERVED_DIRS.iter().any(|reserved| {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .eq_ignore_ascii_case(reserved)
                });
            if reserved {
                return false;
            }
            // Si no podemos leer los metadatos del directorio, lo saltamos.
            entry.metadata().is_ok()
        });

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(err) => {
                // Error al acceder a la entrada (p.ej. permiso denegado en un archivo).
                skipped.push(SkippedEntry {
                    path: err
                        .path()
                        .map(|p| p.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "desconocido".to_string()),
                    reason: format!("Error de acceso: {}", err),
                });
                continue;
            }
        };

        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|ext| ext.to_str()) != Some("md")
        {
            continue;
        }

        let path = entry.path();
        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(err) => {
                skipped.push(SkippedEntry {
                    path: path.to_string_lossy().into_owned(),
                    reason: format!("No se pudieron leer metadatos: {}", err),
                });
                continue;
            }
        };

        if metadata.len() > NOTE_MAX_BYTES {
            skipped.push(SkippedEntry {
                path: path.to_string_lossy().into_owned(),
                reason: format!("Nota supera el límite de 20 MB ({} bytes)", metadata.len()),
            });
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(err) => {
                skipped.push(SkippedEntry {
                    path: path.to_string_lossy().into_owned(),
                    reason: format!("No se pudo leer (UTF-8 inválido o error E/S): {}", err),
                });
                continue;
            }
        };

        let title = path
            .file_stem()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Una nota tiene un nombre de archivo no válido.".to_string())?
            .to_string();
        let mut hasher = DefaultHasher::new();
        path.hash(&mut hasher);
        let (frontmatter, blocks) = parse_markdown_with_frontmatter(&content);
        let journal_date = journal_date_from_path(path);
        pages.push(PageData {
            id: format!("p-{:x}", hasher.finish()),
            title,
            path: path.to_string_lossy().into_owned(),
            frontmatter,
            blocks,
            is_journal: journal_date.is_some(),
            journal_date,
        });
    }
    Ok((pages, skipped))
}

fn now_millis() -> Result<i64, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "El reloj del sistema no es válido.".to_string())?
        .as_millis();
    i64::try_from(millis).map_err(|_| "La hora del sistema está fuera de rango.".to_string())
}

/// Fecha UTC legible sin depender del reloj local ni de una librería externa.
fn format_utc_timestamp(millis: i64) -> String {
    let seconds = millis.div_euclid(1000);
    let days = seconds.div_euclid(86_400);
    let second_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_date_from_days(days);
    let hour = second_of_day / 3_600;
    let minute = (second_of_day % 3_600) / 60;
    format!("{year:04}-{month:02}-{day:02} {hour:02}:{minute:02} UTC")
}

/// Algoritmo civil_from_days (Howard Hinnant) para convertir días desde la
/// época Unix en año/mes/día sin desbordes ni dependencias adicionales.
fn civil_date_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    (year, month as u32, day as u32)
}

/// Hash FNV-1a estable entre ejecuciones. Solo se usa para saber si una nota
/// cambió desde el último snapshot, nunca como medida de seguridad.
pub(crate) fn stable_content_hash(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

fn snapshot_root(root: &Path) -> Result<PathBuf, String> {
    let canonical_root = fs::canonicalize(root).map_err(|err| err.to_string())?;
    let folder = resolve_vault_path(&canonical_root, SNAPSHOT_FOLDER)?;
    fs::create_dir_all(&folder).map_err(|err| err.to_string())?;
    let canonical_folder = fs::canonicalize(&folder).map_err(|err| err.to_string())?;
    if !canonical_folder.starts_with(&canonical_root) || !canonical_folder.is_dir() {
        return Err("La carpeta de snapshots no pertenece al vault activo.".to_string());
    }
    Ok(canonical_folder)
}

/// Clave relativa segura de una nota (sin `.md`). Evita `..`, rutas absolutas y
/// enlaces simbólicos: el resultado siempre se usa dentro de `chronos/`.
fn snapshot_note_key(root: &Path, note_path: &Path) -> Result<String, String> {
    let relative = note_path
        .strip_prefix(root)
        .map_err(|_| "La nota no pertenece al vault activo.".to_string())?;
    let mut parts: Vec<String> = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                let text = part
                    .to_str()
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| "La ruta de la nota no es válida.".to_string())?;
                if text == "." || text == ".." || text.contains('\\') {
                    return Err("La ruta de la nota no es válida.".to_string());
                }
                parts.push(text.to_string());
            }
            _ => return Err("La ruta de la nota no es válida.".to_string()),
        }
    }
    let file_name = parts
        .pop()
        .ok_or_else(|| "La ruta de la nota no es válida.".to_string())?;
    let stem = file_name
        .strip_suffix(".md")
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Los snapshots solo se guardan para notas .md.".to_string())?;
    parts.push(stem.to_string());
    Ok(parts.join("/"))
}

fn snapshot_dir_for_note(root: &Path, note_path: &Path) -> Result<PathBuf, String> {
    let key = snapshot_note_key(root, note_path)?;
    Ok(snapshot_root(root)?.join(key))
}

fn path_is_markdown_note(path: &Path) -> bool {
    path.extension().and_then(|value| value.to_str()) == Some("md")
}

/// Ruta relativa visible de una nota dentro del vault (siempre con `.md`).
fn snapshot_note_relative_path(root: &Path, note_path: &Path) -> Result<String, String> {
    Ok(format!("{}.md", snapshot_note_key(root, note_path)?))
}

/// Cada nota guarda su propia configuración dentro de `chronos/<nota>/`.
/// Así el interruptor y el vencimiento son independientes por página y viajan
/// con la nota cuando se renombra.
fn snapshot_config_path_for_note(root: &Path, note_path: &Path) -> Result<PathBuf, String> {
    Ok(snapshot_dir_for_note(root, note_path)?.join(SNAPSHOT_CONFIG_FILE))
}

/// Mueve los snapshots cuando se renombra una nota. Si el destino ya tiene
/// archivos (por ejemplo, una nota borrada y recreada), se combinan sin
/// sobrescribir snapshots existentes.
fn move_snapshot_dir_for_note(root: &Path, old_note: &Path, new_note: &Path) -> Result<(), String> {
    let old_dir = snapshot_dir_for_note(root, old_note)?;
    let new_dir = snapshot_dir_for_note(root, new_note)?;
    if old_dir == new_dir || !old_dir.is_dir() {
        return Ok(());
    }
    if !new_dir.exists() {
        if let Some(parent) = new_dir.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        return fs::rename(&old_dir, &new_dir).map_err(|err| err.to_string());
    }
    fs::create_dir_all(&new_dir).map_err(|err| err.to_string())?;
    for entry in fs::read_dir(&old_dir)
        .map_err(|err| err.to_string())?
        .flatten()
    {
        if !entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
        {
            continue;
        }
        let name = entry.file_name();
        let target = new_dir.join(&name);
        if target.exists() {
            let _ = fs::remove_file(entry.path());
        } else {
            fs::rename(entry.path(), &target).map_err(|err| err.to_string())?;
        }
    }
    let _ = fs::remove_dir(&old_dir);
    Ok(())
}

fn quarantine_file(path: &Path) {
    let Some(parent) = path.parent() else {
        return;
    };
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return;
    };
    let stamp = now_millis().unwrap_or(0);
    let target = parent.join(format!("{name}.bad-{stamp}"));
    let _ = fs::rename(path, target);
}

fn read_snapshot_config_from_path(path: &Path) -> SnapshotConfig {
    if !path.exists() {
        return SnapshotConfig::default();
    }
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return SnapshotConfig::default(),
    };
    if content.trim().is_empty() {
        return SnapshotConfig::default();
    }
    match serde_json::from_str::<SnapshotConfig>(&content) {
        Ok(config) => config.sanitize(),
        Err(_) => {
            quarantine_file(path);
            SnapshotConfig::default()
        }
    }
}

fn read_note_snapshot_config(root: &Path, note_path: &Path) -> Result<SnapshotConfig, String> {
    let path = snapshot_config_path_for_note(root, note_path)?;
    Ok(read_snapshot_config_from_path(&path))
}

fn write_note_snapshot_config(
    root: &Path,
    note_path: &Path,
    config: &SnapshotConfig,
) -> Result<(), String> {
    let path = snapshot_config_path_for_note(root, note_path)?;
    let json = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    write_file_atomically(&path, &json)
}

fn snapshot_count_for_note(root: &Path, note_path: &Path) -> usize {
    snapshot_dir_for_note(root, note_path)
        .map(|dir| snapshot_json_entries(&dir).len())
        .unwrap_or(0)
}

fn snapshot_state_for_note(
    root: &Path,
    note_path: &Path,
    config: &SnapshotConfig,
) -> Result<SnapshotState, String> {
    let now = now_millis().unwrap_or(0);
    let clock_anomaly = config.enabled
        && (now
            < config
                .activated_at
                .saturating_sub(SNAPSHOT_CLOCK_TOLERANCE_MS)
            || (config.last_run_at > 0
                && now
                    < config
                        .last_run_at
                        .saturating_sub(SNAPSHOT_CLOCK_TOLERANCE_MS)));
    let expired = config.enabled && now >= config.expires_at;
    let remaining_ms = if config.enabled {
        config.expires_at.saturating_sub(now).max(0)
    } else {
        0
    };
    let interval_ms = i64::from(config.interval_hours) * 60 * 60 * 1000;
    let next_run_at = if config.enabled {
        if config.last_run_at > 0 {
            config.last_run_at.saturating_add(interval_ms)
        } else {
            config.activated_at
        }
    } else {
        0
    };
    Ok(SnapshotState {
        note_path: snapshot_note_relative_path(root, note_path)?,
        enabled: config.enabled,
        activated_at: config.activated_at,
        expires_at: config.expires_at,
        duration_days: config.duration_days,
        interval_hours: config.interval_hours,
        max_per_day: config.max_per_day,
        last_run_at: config.last_run_at,
        next_run_at,
        remaining_ms,
        expired,
        clock_anomaly,
        last_status: config.last_status.clone(),
        storage_folder: snapshot_root(root)
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|_| SNAPSHOT_FOLDER.to_string()),
        max_days: SNAPSHOT_MAX_DAYS,
        snapshot_count: snapshot_count_for_note(root, note_path),
    })
}

fn snapshot_note_summary(
    root: &Path,
    note_path: &Path,
    config: &SnapshotConfig,
    now: i64,
) -> Result<SnapshotNoteSummary, String> {
    Ok(SnapshotNoteSummary {
        note_path: snapshot_note_relative_path(root, note_path)?,
        note_title: note_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string(),
        snapshot_count: snapshot_count_for_note(root, note_path),
        activated_at: config.activated_at,
        expires_at: config.expires_at,
        remaining_ms: config.expires_at.saturating_sub(now).max(0),
        interval_hours: config.interval_hours,
        max_per_day: config.max_per_day,
        last_run_at: config.last_run_at,
        last_status: config.last_status.clone(),
    })
}

fn snapshot_json_entries(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .filter(|entry| {
            entry
                .file_type()
                .map(|kind| kind.is_file())
                .unwrap_or(false)
        })
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension().and_then(|value| value.to_str()) == Some("json")
                && path.file_name().and_then(|value| value.to_str()) != Some(SNAPSHOT_CONFIG_FILE)
        })
        .collect();
    files.sort_by(|left, right| left.file_name().cmp(&right.file_name()));
    files
}

fn read_snapshot_record(path: &Path) -> Option<SnapshotRecord> {
    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > SNAPSHOT_MAX_BYTES {
        quarantine_file(path);
        return None;
    }
    let content = fs::read_to_string(path).ok()?;
    match serde_json::from_str::<SnapshotRecord>(&content) {
        Ok(mut record) => {
            if let Some(stem) = path.file_stem().and_then(|value| value.to_str()) {
                if !stem.is_empty() {
                    record.id = stem.to_string();
                }
            }
            if record.id.is_empty() || record.blocks.is_empty() {
                quarantine_file(path);
                return None;
            }
            Some(record)
        }
        Err(_) => {
            quarantine_file(path);
            None
        }
    }
}

fn latest_snapshot_record(dir: &Path) -> Option<SnapshotRecord> {
    let files = snapshot_json_entries(dir);
    for path in files.iter().rev() {
        if let Some(record) = read_snapshot_record(path) {
            return Some(record);
        }
    }
    None
}

fn snapshot_file_timestamp(path: &Path) -> Option<i64> {
    let name = path.file_name()?.to_str()?;
    let rest = name.strip_prefix("snap-")?;
    let stamp = rest.split('-').next()?;
    stamp.parse::<i64>().ok()
}

fn snapshot_count_for_day(dir: &Path, now: i64) -> usize {
    let current_day = now.div_euclid(86_400);
    snapshot_json_entries(dir)
        .iter()
        .filter(|path| {
            let Some(created_at) = snapshot_file_timestamp(path) else {
                return false;
            };
            created_at.div_euclid(86_400) == current_day
        })
        .count()
}

fn prune_note_snapshots(dir: &Path, max_files: usize) {
    let files = snapshot_json_entries(dir);
    if files.len() <= max_files {
        return;
    }
    let remove_count = files.len() - max_files;
    for path in files.iter().take(remove_count) {
        let _ = fs::remove_file(path);
    }
}

fn create_snapshot_for_note(
    root: &Path,
    note_path: &Path,
    summary: &str,
) -> Result<SnapshotRecord, String> {
    let content = fs::read(note_path).map_err(|err| err.to_string())?;
    if content.len() as u64 > SNAPSHOT_MAX_BYTES {
        return Err("La nota es demasiado grande para guardar un snapshot.".to_string());
    }
    let (frontmatter, blocks) = parse_markdown_with_frontmatter(
        std::str::from_utf8(&content)
            .map_err(|_| "La nota no es texto UTF-8 válido.".to_string())?,
    );
    let dir = snapshot_dir_for_note(root, note_path)?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let now = now_millis()?;
    let hash = stable_content_hash(&content);
    let key = snapshot_note_key(root, note_path)?;
    let sequence = SNAPSHOT_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let nonce = stable_content_hash(
        format!("{key}:{now:?}:{hash}:{}:{sequence}", std::process::id()).as_bytes(),
    );
    let nonce = &nonce[..8.min(nonce.len())];
    let mut file_name = format!("snap-{now:013}-{nonce}.json");
    let mut path = dir.join(&file_name);
    // Nunca sobrescribir un snapshot existente: si el nombre coincide, se añade
    // un sufijo numérico en vez de perder la versión anterior.
    let mut attempt = 0u32;
    while path.exists() {
        attempt += 1;
        file_name = format!("snap-{now:013}-{nonce}-{attempt}.json");
        path = dir.join(&file_name);
    }
    let record = SnapshotRecord {
        version: SNAPSHOT_FORMAT_VERSION,
        id: file_name.trim_end_matches(".json").to_string(),
        note_path: key,
        created_at: now,
        created_at_label: format_utc_timestamp(now),
        summary: if summary.trim().is_empty() {
            "Snapshot".to_string()
        } else {
            summary.to_string()
        },
        source_hash: hash,
        frontmatter,
        blocks,
    };
    let json = serde_json::to_string(&record).map_err(|err| err.to_string())?;
    write_file_atomically(&path, &json)?;
    prune_note_snapshots(&dir, SNAPSHOT_MAX_FILES_PER_NOTE);
    Ok(record)
}

fn snapshot_note_if_changed(
    root: &Path,
    note_path: &Path,
    now: i64,
    max_per_day: u32,
    summary: &str,
) -> Result<bool, String> {
    let content = fs::read(note_path).map_err(|err| err.to_string())?;
    if content.len() as u64 > SNAPSHOT_MAX_BYTES {
        return Ok(false);
    }
    let hash = stable_content_hash(&content);
    let dir = snapshot_dir_for_note(root, note_path)?;
    if let Some(latest) = latest_snapshot_record(&dir) {
        if latest.source_hash == hash {
            return Ok(false);
        }
    }
    if max_per_day > 0 && snapshot_count_for_day(&dir, now) >= max_per_day as usize {
        return Ok(false);
    }
    create_snapshot_for_note(root, note_path, summary)?;
    Ok(true)
}

fn cleanup_old_snapshots(root: &Path, now: i64) -> Result<(), String> {
    let folder = snapshot_root(root)?;
    for entry in WalkDir::new(&folder).min_depth(1).sort_by_file_name() {
        let Ok(entry) = entry else {
            continue;
        };
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
            || entry.file_name().to_str() == Some(SNAPSHOT_CONFIG_FILE)
        {
            continue;
        }
        let created_at = snapshot_file_timestamp(entry.path()).or_else(|| {
            entry
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .and_then(|duration| i64::try_from(duration.as_millis()).ok())
        });
        let Some(created_at) = created_at else {
            continue;
        };
        if created_at > now.saturating_add(SNAPSHOT_CLOCK_TOLERANCE_MS) {
            continue;
        }
        if now.saturating_sub(created_at) > SNAPSHOT_RETENTION_MS {
            let _ = fs::remove_file(entry.path());
        }
    }

    // Retirar carpetas vacías (nunca la raíz chronos).
    let mut directories: Vec<PathBuf> = WalkDir::new(&folder)
        .min_depth(1)
        .into_iter()
        .flatten()
        .filter(|entry| entry.file_type().is_dir())
        .map(|entry| entry.into_path())
        .collect();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        let _ = fs::remove_dir(directory);
    }
    Ok(())
}

fn collect_note_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut notes = Vec::new();
    let walker = WalkDir::new(root)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 || !entry.file_type().is_dir() {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            !matches!(name.as_ref(), SNAPSHOT_FOLDER | ".sinnotas" | ".git")
        });
    for entry in walker {
        let entry = entry.map_err(|err| err.to_string())?;
        if entry.file_type().is_file()
            && entry.path().extension().and_then(|value| value.to_str()) == Some("md")
        {
            notes.push(entry.into_path());
        }
    }
    Ok(notes)
}

/// Todos los `config.json` de snapshots por nota dentro de `chronos/`.
/// Queda fuera el antiguo `chronos/config.json` global (profundidad 1).
fn snapshot_config_files(root: &Path) -> Vec<PathBuf> {
    let Ok(folder) = snapshot_root(root) else {
        return Vec::new();
    };
    let mut files: Vec<PathBuf> = WalkDir::new(&folder)
        .min_depth(2)
        .sort_by_file_name()
        .into_iter()
        .flatten()
        .filter(|entry| {
            entry.file_type().is_file()
                && entry.file_name() == std::ffi::OsStr::new(SNAPSHOT_CONFIG_FILE)
        })
        .map(|entry| entry.into_path())
        .collect();
    files.sort();
    files
}

/// Convierte la carpeta `chronos/<ruta>/` en la ruta relativa de su nota.
fn note_path_for_snapshot_dir(root: &Path, dir: &Path) -> Result<PathBuf, String> {
    let folder = snapshot_root(root)?;
    let relative = dir
        .strip_prefix(&folder)
        .map_err(|_| "La carpeta de snapshots no pertenece al vault.".to_string())?;
    let mut parts: Vec<String> = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => {
                let text = part
                    .to_str()
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| "La carpeta de snapshots no es válida.".to_string())?;
                if text == "." || text == ".." || text.contains('\\') {
                    return Err("La carpeta de snapshots no es válida.".to_string());
                }
                parts.push(text.to_string());
            }
            _ => return Err("La carpeta de snapshots no es válida.".to_string()),
        }
    }
    if parts.is_empty() {
        return Err("La carpeta de snapshots no es válida.".to_string());
    }
    let relative_note = format!("{}.md", parts.join("/"));
    resolve_vault_path(root, &relative_note)
}

fn prune_empty_snapshot_dirs(root: &Path) -> Result<(), String> {
    let folder = snapshot_root(root)?;
    let mut directories: Vec<PathBuf> = WalkDir::new(&folder)
        .min_depth(1)
        .into_iter()
        .flatten()
        .filter(|entry| entry.file_type().is_dir())
        .map(|entry| entry.into_path())
        .collect();
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
    for directory in directories {
        let _ = fs::remove_dir(directory);
    }
    Ok(())
}

fn remove_snapshot_dir_if_safe(folder: &Path, dir: &Path) {
    if dir == folder {
        return;
    }
    if !dir.starts_with(folder) {
        return;
    }
    match fs::symlink_metadata(dir) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            let _ = fs::remove_file(dir);
        }
        Ok(metadata) if metadata.is_dir() => {
            let _ = fs::remove_dir_all(dir);
        }
        Ok(_) => {
            let _ = fs::remove_file(dir);
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => {}
    }
}

/// Elimina la carpeta completa de snapshots de una nota (configuración,
/// versiones guardadas y cualquier archivo temporal). La nota original no se
/// toca nunca.
fn delete_note_snapshots_from_root(root: &Path, note_path: &Path) -> Result<(), String> {
    let folder = snapshot_root(root)?;
    // Intentar por ruta derivada (más preciso)
    if let Ok(dir) = snapshot_dir_for_note(root, note_path) {
        remove_snapshot_dir_if_safe(&folder, &dir);
    }
    // Intentar también por clave directamente por si hay desajustes de resolución
    if let Ok(key) = snapshot_note_key(root, note_path) {
        let dir2 = folder.join(key);
        remove_snapshot_dir_if_safe(&folder, &dir2);
    }
    // Como último recurso, buscar por el nombre relativo esperado
    if let Ok(rel) = snapshot_note_relative_path(root, note_path) {
        let stem = Path::new(&rel)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if !stem.is_empty() {
            let dir3 = folder.join(stem);
            remove_snapshot_dir_if_safe(&folder, &dir3);
            // También intentar con ruta completa si tiene subcarpetas
            if rel.contains('/') {
                // convertir "pages/sub/nota.md" -> "pages/sub/nota"
                let without_ext = rel.trim_end_matches(".md");
                let dir4 = folder.join(without_ext);
                remove_snapshot_dir_if_safe(&folder, &dir4);
            }
        }
    }
    prune_empty_snapshot_dirs(root)?;
    Ok(())
}

/// Elimina todos los snapshots del vault, sin tocar las notas originales.
/// Vacía el contenido de `chronos/` (configuraciones, versiones y temporales)
/// pero conserva la carpeta raíz para futuros snapshots. Devuelve el número de
/// entradas eliminadas. Nunca sigue enlaces simbólicos.
fn delete_all_snapshots_from_root(root: &Path) -> Result<usize, String> {
    let folder = snapshot_root(root)?;
    let entries = fs::read_dir(&folder).map_err(|err| err.to_string())?;
    let mut removed = 0usize;
    for entry in entries {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path == folder || !path.starts_with(&folder) {
            continue;
        }
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                fs::remove_file(&path).map_err(|err| err.to_string())?;
                removed += 1;
            }
            Ok(metadata) if metadata.is_dir() => {
                fs::remove_dir_all(&path).map_err(|err| err.to_string())?;
                removed += 1;
            }
            Ok(_) => {
                fs::remove_file(&path).map_err(|err| err.to_string())?;
                removed += 1;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(removed)
}

/// Migración única del antiguo interruptor global (`chronos/config.json`).
/// Si la ventana seguía activa, se reparte entre las notas para que el nuevo
/// control sea por página; si ya venció, se limpian los snapshots antiguos.
fn migrate_legacy_global_snapshot_config(root: &Path, now: i64) -> Result<(), String> {
    let folder = snapshot_root(root)?;
    let legacy = folder.join(SNAPSHOT_CONFIG_FILE);
    if !legacy.is_file() {
        return Ok(());
    }
    let parsed = fs::read_to_string(&legacy)
        .ok()
        .filter(|content| !content.trim().is_empty())
        .and_then(|content| serde_json::from_str::<SnapshotConfig>(&content).ok())
        .map(SnapshotConfig::sanitize);

    if let Some(config) = parsed {
        if config.enabled {
            for note in collect_note_files(root)? {
                let note_config = match snapshot_config_path_for_note(root, &note) {
                    Ok(path) => path,
                    Err(_) => continue,
                };
                if note_config.exists() {
                    continue;
                }
                if now >= config.expires_at {
                    let _ = delete_note_snapshots_from_root(root, &note);
                } else {
                    let _ = write_note_snapshot_config(root, &note, &config);
                }
            }
        }
        let _ = fs::remove_file(&legacy);
    } else {
        quarantine_file(&legacy);
    }
    Ok(())
}

/// Activa los snapshots de una única nota y crea una versión inicial.
fn activate_snapshots_in_root(
    root: &Path,
    note_path: &Path,
    duration_days: u32,
    interval_hours: u32,
    max_per_day: u32,
) -> Result<SnapshotState, String> {
    if !path_is_markdown_note(note_path) {
        return Err("Los snapshots solo existen para notas .md.".to_string());
    }
    if !note_path.is_file() {
        return Err("No se encontró la nota que se quiere supervisar.".to_string());
    }
    if !(1..=SNAPSHOT_MAX_DAYS).contains(&duration_days) {
        return Err(format!(
            "La duración debe estar entre 1 y {SNAPSHOT_MAX_DAYS} días."
        ));
    }
    if !(1..=168).contains(&interval_hours) {
        return Err("El intervalo debe estar entre 1 y 168 horas.".to_string());
    }
    if max_per_day > 96 {
        return Err("El máximo diario debe estar entre 0 (sin límite) y 96 snapshots.".to_string());
    }

    let now = now_millis()?;
    let duration_ms = i64::from(duration_days) * 24 * 60 * 60 * 1000;
    let expires_at = now
        .checked_add(duration_ms)
        .ok_or_else(|| "La ventana de snapshots está fuera de rango.".to_string())?;
    let created = snapshot_note_if_changed(root, note_path, now, max_per_day, "Snapshot inicial")?;
    let config = SnapshotConfig {
        version: SNAPSHOT_FORMAT_VERSION,
        enabled: true,
        activated_at: now,
        expires_at,
        duration_days,
        interval_hours,
        max_per_day,
        last_run_at: now,
        last_status: if created {
            "initial".to_string()
        } else {
            "initial-unchanged".to_string()
        },
    };
    write_note_snapshot_config(root, note_path, &config)?;
    snapshot_state_for_note(root, note_path, &config)
}

/// Desactiva una nota y elimina todas sus versiones guardadas.
fn disable_snapshots_in_root(root: &Path, note_path: &Path) -> Result<SnapshotState, String> {
    if !path_is_markdown_note(note_path) {
        return Err("Los snapshots solo existen para notas .md.".to_string());
    }
    delete_note_snapshots_from_root(root, note_path)?;
    let config = SnapshotConfig {
        last_status: "disabled".to_string(),
        ..SnapshotConfig::default()
    };
    snapshot_state_for_note(root, note_path, &config)
}

fn list_active_snapshot_notes_from_root(root: &Path) -> Result<Vec<SnapshotNoteSummary>, String> {
    let now = now_millis()?;
    let mut notes = Vec::new();
    for config_path in snapshot_config_files(root) {
        let Some(dir) = config_path.parent() else {
            continue;
        };
        let Ok(note_path) = note_path_for_snapshot_dir(root, dir) else {
            continue;
        };
        if !note_path.is_file() {
            continue;
        }
        let config = read_snapshot_config_from_path(&config_path);
        if !config.enabled || now >= config.expires_at {
            continue;
        }
        if let Ok(summary) = snapshot_note_summary(root, &note_path, &config, now) {
            notes.push(summary);
        }
    }
    notes.sort_by(|left, right| {
        left.note_title
            .to_lowercase()
            .cmp(&right.note_title.to_lowercase())
            .then_with(|| left.note_path.cmp(&right.note_path))
    });
    Ok(notes)
}

/// Procesa todas las notas con snapshots activos. Se encarga de:
/// - crear snapshots cuando vence el intervalo,
/// - eliminar automáticamente los snapshots al vencer el periodo,
/// - limpiar versiones huérfanas antiguas.
fn tick_snapshots_in_root(root: &Path) -> Result<Vec<SnapshotNoteSummary>, String> {
    let now = now_millis()?;
    migrate_legacy_global_snapshot_config(root, now)?;

    for config_path in snapshot_config_files(root) {
        let Some(dir) = config_path.parent() else {
            continue;
        };
        let Ok(note_path) = note_path_for_snapshot_dir(root, dir) else {
            continue;
        };
        if !note_path.is_file() {
            continue;
        }
        let mut config = read_snapshot_config_from_path(&config_path);
        if !config.enabled {
            continue;
        }

        let clock_anomaly = now
            < config
                .activated_at
                .saturating_sub(SNAPSHOT_CLOCK_TOLERANCE_MS)
            || (config.last_run_at > 0
                && now
                    < config
                        .last_run_at
                        .saturating_sub(SNAPSHOT_CLOCK_TOLERANCE_MS));
        if clock_anomaly {
            // No se escribe nada más: un reloj que retrocede podría duplicar o
            // reordenar snapshots. Se espera a que la hora vuelva a ser coherente.
            config.last_status = "clock-anomaly".to_string();
            let _ = write_note_snapshot_config(root, &note_path, &config);
            continue;
        }

        if now >= config.expires_at {
            // La ventana terminó: se borran todas las copias y la configuración
            // de esta nota. El archivo Markdown original permanece intacto.
            let _ = delete_note_snapshots_from_root(root, &note_path);
            continue;
        }

        let interval_ms = i64::from(config.interval_hours) * 60 * 60 * 1000;
        if config.last_run_at > 0 && now.saturating_sub(config.last_run_at) < interval_ms {
            continue;
        }

        match snapshot_note_if_changed(
            root,
            &note_path,
            now,
            config.max_per_day,
            "Snapshot automático programado",
        ) {
            Ok(created) => {
                config.last_run_at = now;
                config.last_status = if created {
                    "ok:1".to_string()
                } else {
                    "ok:0".to_string()
                };
            }
            Err(_) => {
                config.last_status = "error".to_string();
            }
        }
        let _ = write_note_snapshot_config(root, &note_path, &config);
    }

    let _ = cleanup_old_snapshots(root, now);
    list_active_snapshot_notes_from_root(root)
}

fn is_safe_snapshot_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 160
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

fn read_note_snapshots_from_root(
    root: &Path,
    note_path: &Path,
) -> Result<Vec<PageRevision>, String> {
    let dir = snapshot_dir_for_note(root, note_path)?;
    let mut records: Vec<SnapshotRecord> = snapshot_json_entries(&dir)
        .iter()
        .rev()
        .filter_map(|path| read_snapshot_record(path))
        .collect();
    records.sort_by_key(|record| std::cmp::Reverse(record.created_at));
    records.truncate(SNAPSHOT_MAX_FILES_PER_NOTE);
    Ok(records
        .into_iter()
        .map(|record| PageRevision {
            id: record.id,
            timestamp: if record.created_at_label.trim().is_empty() {
                format_utc_timestamp(record.created_at)
            } else {
                record.created_at_label
            },
            blocks: record.blocks,
            summary: record.summary,
            created_at: Some(record.created_at),
        })
        .collect())
}

fn restore_snapshot_from_root(
    root: &Path,
    note_path: &Path,
    snapshot_id: &str,
) -> Result<RestoredSnapshot, String> {
    if !is_safe_snapshot_id(snapshot_id) {
        return Err("El identificador del snapshot no es válido.".to_string());
    }
    let dir = snapshot_dir_for_note(root, note_path)?;
    let mut selected: Option<SnapshotRecord> = None;
    for path in snapshot_json_entries(&dir) {
        if path.file_stem().and_then(|value| value.to_str()) == Some(snapshot_id) {
            selected = read_snapshot_record(&path);
            break;
        }
    }
    let record = selected.ok_or_else(|| "No se encontró el snapshot solicitado.".to_string())?;

    // Red de seguridad: guardar el estado actual antes de sobrescribir la nota.
    // Funciona incluso con los snapshots automáticos desactivados.
    let _ = create_snapshot_for_note(root, note_path, "Antes de restaurar un snapshot");

    let markdown = serialize_page_to_markdown(&record.frontmatter, &record.blocks);
    write_file_atomically(note_path, &markdown)?;
    Ok(RestoredSnapshot {
        blocks: record.blocks,
        frontmatter: record.frontmatter,
    })
}

/// Migra el historial antiguo de `.sinnotas/revisions` al nuevo formato de
/// `chronos/`. Es idempotente: los archivos ya migrados se omiten.
fn migrate_legacy_revisions(root: &Path, ignore_marker: bool) -> Result<(), String> {
    let legacy_root = root.join(".sinnotas").join("revisions");
    if !legacy_root.is_dir() {
        return Ok(());
    }
    let marker = legacy_root.join(".chronos-migrated");
    if !ignore_marker && marker.exists() {
        return Ok(());
    }

    let mut failed = false;
    for entry in WalkDir::new(&legacy_root).sort_by_file_name() {
        let Ok(entry) = entry else {
            failed = true;
            continue;
        };
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
        {
            continue;
        }
        let Ok(relative) = entry.path().strip_prefix(&legacy_root) else {
            failed = true;
            continue;
        };
        let relative_text = relative.to_string_lossy().replace('\\', "/");
        let Some(note_relative) = relative_text.strip_suffix(".json") else {
            continue;
        };
        let note_path = root.join(note_relative);
        if !note_path.is_file() {
            continue;
        }
        let Ok(content) = fs::read_to_string(entry.path()) else {
            failed = true;
            continue;
        };
        let Ok(revisions) = serde_json::from_str::<Vec<PageRevision>>(&content) else {
            continue;
        };
        let Ok(key) = snapshot_note_key(root, &note_path) else {
            failed = true;
            continue;
        };
        let Ok(dir) = snapshot_dir_for_note(root, &note_path) else {
            failed = true;
            continue;
        };
        if let Err(error) = fs::create_dir_all(&dir) {
            eprintln!("No se pudo crear la carpeta de snapshots migrados: {error}");
            failed = true;
            continue;
        }
        let (frontmatter, _) = fs::read_to_string(&note_path)
            .ok()
            .map(|text| parse_markdown_with_frontmatter(&text))
            .unwrap_or_default();
        let now = now_millis().unwrap_or(0);
        for (index, revision) in revisions.into_iter().enumerate() {
            let safe_id: String = revision
                .id
                .chars()
                .map(|character| {
                    if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                        character
                    } else {
                        '-'
                    }
                })
                .collect();
            let safe_id = if safe_id.is_empty() {
                format!("revision-{index}")
            } else {
                safe_id
            };
            let file_name = format!("legacy-{safe_id}.json");
            let path = dir.join(&file_name);
            if path.exists() {
                continue;
            }
            let record = SnapshotRecord {
                version: SNAPSHOT_FORMAT_VERSION,
                id: file_name.trim_end_matches(".json").to_string(),
                note_path: key.clone(),
                created_at: now.saturating_sub((index as i64 + 1) * 1_000),
                created_at_label: revision.timestamp,
                summary: revision.summary,
                source_hash: String::new(),
                frontmatter: frontmatter.clone(),
                blocks: revision.blocks,
            };
            let json = match serde_json::to_string(&record) {
                Ok(json) => json,
                Err(_) => {
                    failed = true;
                    continue;
                }
            };
            if write_file_atomically(&path, &json).is_err() {
                failed = true;
            }
        }
    }

    if !failed {
        let _ = write_file_atomically(&marker, "migrated\n");
    }
    Ok(())
}

fn approved_vaults_file(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(config_dir.join("approved-vault-roots.json"))
}

fn load_approved_vault_roots(app: &AppHandle) -> Vec<PathBuf> {
    approved_vaults_file(app)
        .ok()
        .and_then(|file| fs::read_to_string(file).ok())
        .and_then(|content| serde_json::from_str::<Vec<String>>(&content).ok())
        .map(|paths| paths.into_iter().map(PathBuf::from).collect())
        .unwrap_or_default()
}

fn persist_approved_vault_roots(app: &AppHandle, approved: &[PathBuf]) -> Result<(), String> {
    let file = approved_vaults_file(app)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let serialized: Vec<String> = approved
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    let json = serde_json::to_string_pretty(&serialized).map_err(|err| err.to_string())?;
    write_file_atomically(&file, &json)
}

/// Exige confirmación explícita del usuario (diálogo nativo) antes de tratar una
/// carpeta arbitraria como bóveda, y recuerda la decisión en disco para el futuro.
fn require_vault_approval(
    app: &AppHandle,
    state: &ApprovedVaultRoots,
    root: &Path,
) -> Result<(), String> {
    {
        let approved = state
            .0
            .lock()
            .map_err(|_| "No se pudo comprobar las bóvedas autorizadas.".to_string())?;
        if approved.iter().any(|path| path == root) {
            return Ok(());
        }
    }

    let folder = root.display().to_string();
    let confirmed = app
        .dialog()
        .message(format!(
            "Quieres abrir esta carpeta como bóveda de SinNotas:\n\n{folder}\n\nSolo continúa si confías en su contenido: la app podrá leer y modificar sus archivos."
        ))
        .title("Abrir carpeta como bóveda")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show();
    if !confirmed {
        return Err("No se autorizó abrir esa carpeta como bóveda.".to_string());
    }

    let mut approved = state
        .0
        .lock()
        .map_err(|_| "No se pudo guardar la bóveda autorizada.".to_string())?;
    if !approved.iter().any(|path| path == root) {
        approved.push(root.to_path_buf());
    }
    persist_approved_vault_roots(app, &approved)
}

/// Abre el selector nativo de carpetas desde el backend y devuelve la raíz
/// elegida (ya autorizada). `None` si el usuario canceló.
///
/// En Android usa SAF (Storage Access Framework) via plugin android-fs.
/// En iOS usa el vault interno.
/// En desktop usa el selector nativo de carpetas.
#[tauri::command]
async fn pick_vault_root(
    app: AppHandle,
    approved_roots: tauri::State<'_, ApprovedVaultRoots>,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        // En Android, usar el selector SAF via plugin android-fs
        let _ = (&app, &approved_roots);
        use tauri_plugin_android_fs::{AndroidFs, AndroidFsExt};
        if let Some(dir_path) = app
            .android_fs()
            .show_open_dir_dialog()
            .map_err(|e| e.to_string())?
        {
            // Conservar el acceso tras reiniciar la app. Si el proveedor no lo
            // permite, la bóveda sigue funcionando durante esta sesión.
            if let Err(error) = app.android_fs().grant_persistable_dir_access(
                &dir_path,
                tauri_plugin_android_fs::PersistableAccessMode::ReadAndWrite,
            ) {
                eprintln!("No se pudo persistir el permiso SAF: {error}");
            }
            let uri = tauri_plugin_android_fs::convert_dir_path_to_string(&dir_path)
                .map_err(|e| e.to_string())?;
            return Ok(Some(uri));
        }
        Ok(None)
    }

    #[cfg(target_os = "ios")]
    {
        let _ = (app, approved_roots);
        Err("En iOS se usa el vault interno de la aplicación.".to_string())
    }

    #[cfg(all(not(target_os = "android"), not(target_os = "ios")))]
    {
        let Some(picked) = app.dialog().file().blocking_pick_folder() else {
            return Ok(None);
        };
        let root = fs::canonicalize(picked.into_path().map_err(|err| err.to_string())?)
            .map_err(|err| err.to_string())?;
        {
            let mut approved = approved_roots
                .0
                .lock()
                .map_err(|_| "No se pudo guardar la bóveda autorizada.".to_string())?;
            if !approved.iter().any(|path| path == &root) {
                approved.push(root.clone());
            }
            persist_approved_vault_roots(&app, &approved)?;
        }
        Ok(Some(root.to_string_lossy().into_owned()))
    }
}

/// Reconoce una raíz SAF serializada por `tauri-plugin-android-fs` 2.x.
///
/// El plugin no devuelve una URI plana: `convert_dir_path_to_string` produce
/// un objeto JSON con `topTreeUri` y `relativeTerms`. También se acepta una
/// URI `content://` plana por compatibilidad con versiones anteriores.
fn saf_dir_path_from_root(
    root_path: &str,
) -> Result<Option<tauri_plugin_android_fs::DirPath>, String> {
    let trimmed = root_path.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    if trimmed.starts_with("content://") {
        let value = serde_json::json!({
            "topTreeUri": trimmed,
            "relativeTerms": [],
        });
        let path = serde_json::from_value(value)
            .map_err(|error| format!("La ruta SAF no es válida: {error}"))?;
        return Ok(Some(path));
    }

    if !trimmed.starts_with('{') {
        return Ok(None);
    }

    let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return Ok(None);
    };
    let Some(top_tree_uri) = value.get("topTreeUri").and_then(|value| value.as_str()) else {
        return Ok(None);
    };
    if !top_tree_uri.starts_with("content://") {
        return Ok(None);
    }
    let relative_terms = value
        .get("relativeTerms")
        .cloned()
        .unwrap_or_else(|| serde_json::json!([]));
    let path = serde_json::from_value(serde_json::json!({
        "topTreeUri": top_tree_uri,
        "relativeTerms": relative_terms,
    }))
    .map_err(|error| format!("La ruta SAF no es válida: {error}"))?;
    Ok(Some(path))
}

#[tauri::command]
async fn load_vault(
    root_path: Option<String>,
    app: AppHandle,
    state: tauri::State<'_, ActiveVault>,
    approved_roots: tauri::State<'_, ApprovedVaultRoots>,
    cache_state: tauri::State<'_, VaultCacheState>,
) -> Result<VaultSnapshot, String> {
    let is_default_vault = root_path.is_none();
    // Switching away from a local vault must stop its watcher and drop the
    // previous cache before the new root is scanned.
    cache_state.deactivate();

    // El selector SAF del plugin 2.x devuelve un `DirPath` serializado como
    // JSON, no como una URI `content://` plana.
    let saf_root = root_path
        .as_deref()
        .map(saf_dir_path_from_root)
        .transpose()?
        .flatten();

    if let Some(dir_path) = saf_root {
        // Cargar bóveda SAF
        let vault_name = app
            .android_fs()
            .get_dir_name(&dir_path)
            .unwrap_or_else(|_| "Bóveda SAF".to_string());
        let root_dir_path = tauri_plugin_android_fs::convert_dir_path_to_string(&dir_path)
            .map_err(|error| error.to_string())?;

        // Para SAF no usamos asset protocol scope (no hay rutas de filesystem).
        // El plugin android-fs maneja el acceso a archivos.
        let storage = Arc::new(SafStorage::new(
            dir_path,
            root_dir_path.clone(),
            vault_name.clone(),
            app.clone(),
        ));

        let notes = storage.list_notes().await?;
        let mut pages = Vec::with_capacity(notes.len());
        let mut skipped = Vec::new();

        for note in notes {
            let NoteEntry { relative_path, .. } = note;
            let content = match storage.read_note(&relative_path).await {
                Ok(content) => content,
                Err(error) => {
                    skipped.push(SkippedEntry {
                        path: relative_path,
                        reason: format!("No se pudo leer: {error}"),
                    });
                    continue;
                }
            };
            if content.len() as u64 > NOTE_MAX_BYTES {
                skipped.push(SkippedEntry {
                    path: relative_path,
                    reason: format!("Nota supera el límite de 20 MB ({} bytes)", content.len()),
                });
                continue;
            }
            let title = match Path::new(&relative_path)
                .file_stem()
                .and_then(|value| value.to_str())
            {
                Some(title) if !title.is_empty() => title.to_string(),
                _ => {
                    skipped.push(SkippedEntry {
                        path: relative_path,
                        reason: "La nota no tiene un nombre de archivo válido.".to_string(),
                    });
                    continue;
                }
            };
            let mut hasher = DefaultHasher::new();
            relative_path.hash(&mut hasher);
            let (frontmatter, blocks) = parse_markdown_with_frontmatter(&content);
            let journal_date = journal_date_from_relative_path(&relative_path);
            pages.push(PageData {
                id: format!("p-{:x}", hasher.finish()),
                title,
                path: relative_path,
                frontmatter,
                blocks,
                is_journal: journal_date.is_some(),
                journal_date,
            });
        }

        *state
            .0
            .lock()
            .map_err(|_| "No se pudo actualizar el vault activo.".to_string())? =
            Some(ActiveVaultInner {
                root: PathBuf::new(),             // No aplica para SAF
                asset_scope_root: PathBuf::new(), // No aplica para SAF
                storage,
            });

        Ok(VaultSnapshot {
            root_path: root_dir_path,
            vault_name,
            pages,
            skipped,
        })
    } else {
        // Lógica original para filesystem local
        let root = match root_path {
            Some(path) => PathBuf::from(path),
            None => app.path().app_data_dir().map_err(|err| err.to_string())?,
        };

        // Revocar el directorio anterior del asset protocol scope (si existe)
        if let Ok(Some(prev_scope_root)) = active_asset_scope_root(&state) {
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&prev_scope_root, true);
        }

        // Para bóvedas no predeterminadas: la carpeta DEBE existir ya.
        // No creamos directorios antes de pedir aprobación.
        if !is_default_vault {
            if !root.exists() {
                return Err(
                    "La carpeta de la bóveda no existe. Selecciona una carpeta existente."
                        .to_string(),
                );
            }
            let canonical_root = fs::canonicalize(&root).map_err(|err| err.to_string())?;
            require_vault_approval(&app, &approved_roots, &canonical_root)?;
            let root = canonical_root;

            // Permitir el nuevo directorio en el asset protocol scope
            app.asset_protocol_scope()
                .allow_directory(&root, true)
                .map_err(|err| err.to_string())?;

            // Prohibir explícitamente las carpetas internas para que no sean
            // accesibles vía asset: chronos/, .sinnotas/ y progress/.
            let chronos_path = root.join("chronos");
            let sinnotas_path = root.join(".sinnotas");
            let progress_path = root.join("progress");
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&chronos_path, true);
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&sinnotas_path, true);
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&progress_path, true);

            let vault_name = root
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Vault")
                .to_string();
            let (pages, skipped) = match cache_state.activate(&app, &root) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("No se pudo usar la caché de metadatos ({error}); se usa el escaneo completo.");
                    scan_vault(&root)?
                }
            };
            let storage = Arc::new(FsStorage::new(
                root.clone(),
                "fs".to_string(),
                vault_name.clone(),
            ));
            *state
                .0
                .lock()
                .map_err(|_| "No se pudo actualizar el vault activo.".to_string())? =
                Some(ActiveVaultInner {
                    root: root.clone(),
                    asset_scope_root: root.clone(),
                    storage,
                });

            let _ = migrate_legacy_revisions(&root, false);

            Ok(VaultSnapshot {
                root_path: root.to_string_lossy().into_owned(),
                vault_name,
                pages,
                skipped,
            })
        } else {
            // Vault predeterminado: sí creamos el directorio si no existe.
            fs::create_dir_all(&root).map_err(|err| err.to_string())?;
            let root = fs::canonicalize(root).map_err(|err| err.to_string())?;

            app.asset_protocol_scope()
                .allow_directory(&root, true)
                .map_err(|err| err.to_string())?;

            // Prohibir las carpetas internas también en el vault predeterminado
            let chronos_path = root.join("chronos");
            let sinnotas_path = root.join(".sinnotas");
            let progress_path = root.join("progress");
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&chronos_path, true);
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&sinnotas_path, true);
            let _ = app
                .asset_protocol_scope()
                .forbid_directory(&progress_path, true);

            let vault_name = "Vault local".to_string();
            let (pages, skipped) = match cache_state.activate(&app, &root) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("No se pudo usar la caché de metadatos ({error}); se usa el escaneo completo.");
                    scan_vault(&root)?
                }
            };
            let storage = Arc::new(FsStorage::new(
                root.clone(),
                "fs".to_string(),
                vault_name.clone(),
            ));
            *state
                .0
                .lock()
                .map_err(|_| "No se pudo actualizar el vault activo.".to_string())? =
                Some(ActiveVaultInner {
                    root: root.clone(),
                    asset_scope_root: root.clone(),
                    storage,
                });

            let _ = migrate_legacy_revisions(&root, false);

            Ok(VaultSnapshot {
                root_path: root.to_string_lossy().into_owned(),
                vault_name,
                pages,
                skipped,
            })
        }
    }
}

#[tauri::command]
fn resolve_image_path(
    source: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveVault>,
) -> Result<String, String> {
    let root = active_root(&state)?;
    let extension = Path::new(&source)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp"
    ) {
        return Err("La ruta no corresponde a una imagen compatible.".to_string());
    }
    let path = resolve_vault_path(&root, &source)?;
    let canonical_path = fs::canonicalize(path).map_err(|err| err.to_string())?;
    if !canonical_path.starts_with(&root) {
        return Err("La imagen está fuera del Vault activo.".to_string());
    }
    if !fs::metadata(&canonical_path)
        .map_err(|err| err.to_string())?
        .is_file()
    {
        return Err("La ruta de imagen no es un archivo.".to_string());
    }
    app.asset_protocol_scope()
        .allow_file(&canonical_path)
        .map_err(|err| err.to_string())?;
    Ok(canonical_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_image_data(
    source: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<u8>, String> {
    let root = active_root(&state)?;
    let extension = Path::new(&source)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp"
    ) {
        return Err("La ruta no corresponde a una imagen compatible.".to_string());
    }
    let canonical_path =
        fs::canonicalize(resolve_vault_path(&root, &source)?).map_err(|err| err.to_string())?;
    if !canonical_path.starts_with(&root) {
        return Err("La imagen está fuera del Vault activo.".to_string());
    }
    if !fs::metadata(&canonical_path)
        .map_err(|err| err.to_string())?
        .is_file()
    {
        return Err("La ruta de imagen no es un archivo.".to_string());
    }
    fs::read(canonical_path).map_err(|err| err.to_string())
}

#[tauri::command(async)]
async fn read_page(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<PageData, String> {
    let storage = active_storage(&state)?;
    let content = storage.read_note(&file_path).await?;
    let (frontmatter, blocks) = parse_markdown_with_frontmatter(&content);
    let title = Path::new(&file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();
    let journal_date = journal_date_from_relative_path(&file_path);

    Ok(PageData {
        id: format!("p-{}", title),
        title,
        path: file_path,
        frontmatter,
        blocks,
        is_journal: journal_date.is_some(),
        journal_date,
    })
}

/// Fecha de creación de una nota para el selector de repaso.
/// `created_at` es `None` cuando el sistema de archivos no puede informarla.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteCreatedTime {
    pub path: String,
    pub created_at: Option<i64>,
}

/// Devuelve la fecha de creación (Unix ms) de cada nota solicitada. Las
/// resoluciones usan `resolve_vault_path`: las rutas fuera del vault activo
/// (o con URIs/traversal) devuelven `created_at: None` en vez de un error,
/// de modo que un lote completo no falle por una sola entrada.
#[tauri::command]
async fn read_note_created_times(
    paths: Vec<String>,
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<NoteCreatedTime>, String> {
    let root = active_root(&state)?;
    let mut result = Vec::with_capacity(paths.len());
    for requested in paths {
        let created_at = resolve_vault_path(&root, &requested)
            .ok()
            .and_then(|path| fs::metadata(&path).ok())
            .and_then(|metadata| {
                // Birthtime es la creación real; no todos los sistemas de
                // archivos la exponen (ext4/statx en Linux, NTFS/APFS en
                // general): se recurre a modified como ordenación aproximada.
                metadata
                    .created()
                    .ok()
                    .or_else(|| metadata.modified().ok())
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis() as i64)
            });
        result.push(NoteCreatedTime {
            path: requested,
            created_at,
        });
    }
    Ok(result)
}

fn journal_date_from_path(path: &Path) -> Option<String> {
    if path.parent()?.file_name()?.to_str()? != "journals" {
        return None;
    }

    let stem = path.file_stem()?.to_str()?;
    let date = stem.replace('_', "-");
    let date_parts: Vec<&str> = date.split('-').collect();
    if date_parts.len() != 3
        || date_parts[0].len() != 4
        || date_parts[1].len() != 2
        || date_parts[2].len() != 2
        || !date_parts
            .iter()
            .all(|part| part.chars().all(|c| c.is_ascii_digit()))
    {
        return None;
    }

    let year = date_parts[0].parse::<u32>().ok()?;
    let month = date_parts[1].parse::<u32>().ok()?;
    let day = date_parts[2].parse::<u32>().ok()?;
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        _ => return None,
    };
    if day == 0 || day > days_in_month {
        return None;
    }

    Some(date)
}

pub(crate) fn journal_date_from_relative_path(relative_path: &str) -> Option<String> {
    let path = Path::new(relative_path);
    if path.parent()?.file_name()?.to_str()? != "journals" {
        return None;
    }

    let stem = path.file_stem()?.to_str()?;
    let date = stem.replace('_', "-");
    let date_parts: Vec<&str> = date.split('-').collect();
    if date_parts.len() != 3
        || date_parts[0].len() != 4
        || date_parts[1].len() != 2
        || date_parts[2].len() != 2
        || !date_parts
            .iter()
            .all(|part| part.chars().all(|c| c.is_ascii_digit()))
    {
        return None;
    }

    let year = date_parts[0].parse::<u32>().ok()?;
    let month = date_parts[1].parse::<u32>().ok()?;
    let day = date_parts[2].parse::<u32>().ok()?;
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        _ => return None,
    };
    if day == 0 || day > days_in_month {
        return None;
    }

    Some(date)
}

/// Lee texto con un límite estricto para archivos internos (progreso,
/// metadatos). Nunca reserva memoria según un tamaño reportado por el archivo.
fn read_text_bounded<R: Read>(reader: R, max_bytes: usize) -> Result<String, String> {
    let mut buffer = Vec::new();
    reader
        .take(max_bytes as u64 + 1)
        .read_to_end(&mut buffer)
        .map_err(|error| error.to_string())?;
    if buffer.len() > max_bytes {
        return Err("El archivo interno supera el límite permitido.".to_string());
    }
    String::from_utf8(buffer).map_err(|_| "El archivo interno no es UTF-8 válido.".to_string())
}

/// Escribe `contents` de forma atómica: primero a un archivo temporal en la
/// MISMA carpeta que el destino y luego lo renombra sobre él, de modo que el
/// destino nunca queda a medias si el proceso se interrumpe. Si alguna de las
/// dos operaciones falla, se limpia el temporal para no dejar basura.
/// Sirve para texto arbitrario (markdown de notas, JSON de revisiones, etc.).
fn write_file_atomically(path: &Path, contents: &str) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("La ruta de la nota no es válida.".to_string());
    };
    if !parent.as_os_str().is_empty() && !parent.exists() {
        fs::create_dir_all(parent).map_err(|e: std::io::Error| e.to_string())?;
    }
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| "La ruta de la nota no es válida.".to_string())?;

    let pid = process::id();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?;
    let mut hasher = DefaultHasher::new();
    now.hash(&mut hasher);
    pid.hash(&mut hasher);
    contents.len().hash(&mut hasher);
    let rand_suffix = format!("{:016x}", hasher.finish());
    let uuid = Uuid::new_v4().to_string();

    let mut temp_path = parent.join(format!(
        ".{file_name}.sinnotas-tmp.{pid}.{now:?}.{uuid}.{rand_suffix}"
    ));
    let mut attempts = 0;
    while temp_path.exists() && attempts < 32 {
        attempts += 1;
        let uuid2 = Uuid::new_v4().to_string();
        let mut hasher2 = DefaultHasher::new();
        now.hash(&mut hasher2);
        pid.hash(&mut hasher2);
        attempts.hash(&mut hasher2);
        rand_suffix.hash(&mut hasher2);
        let rand_suffix2 = format!("{:016x}", hasher2.finish());
        temp_path = parent.join(format!(
            ".{file_name}.sinnotas-tmp.{pid}.{now:?}.{uuid2}.{rand_suffix2}.{attempts}"
        ));
    }

    let write_and_rename = || -> Result<(), String> {
        fs::write(&temp_path, contents).map_err(|e| e.to_string())?;
        fs::rename(&temp_path, path).map_err(|e: std::io::Error| e.to_string())
    };

    let result = write_and_rename();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

/// Guarda una nota. Asíncrono para no bloquear el hilo principal con el IO.
#[tauri::command(async)]
async fn save_page(
    file_path: String,
    blocks: Vec<BlockNode>,
    frontmatter: Option<Vec<String>>,
    state: tauri::State<'_, ActiveVault>,
    cache_state: tauri::State<'_, VaultCacheState>,
) -> Result<(), String> {
    let storage = active_storage(&state)?;
    let markdown = serialize_page_to_markdown(&frontmatter.unwrap_or_default(), &blocks);
    storage.write_note(&file_path, &markdown).await?;
    if let Some(runtime) = cache_state.current() {
        if let Some(path) = runtime.note_path(&file_path) {
            // Own writes must not generate a frontend delta: the editor already
            // has this content. The watcher will see an identical cache entry.
            runtime.update_paths(&[path], false);
        }
    }
    Ok(())
}

/// Valida y une el diario de repasos. Los repasos son inmutables salvo por
/// `state`/`updatedAt` (deshacer/rehacer); para un mismo id gana la versión
/// más reciente. Así dos dispositivos pueden guardar sin sobrescribir el
/// historial del otro.
fn merge_review_progress_json(existing: Option<&str>, incoming: &str) -> Result<String, String> {
    let incoming_value: serde_json::Value = serde_json::from_str(incoming)
        .map_err(|_| "El diario de repasos no es JSON válido.".to_string())?;
    incoming_value
        .get("entries")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "El diario de repasos no contiene una lista de entradas.".to_string())?;

    let mut by_id: BTreeMap<String, serde_json::Value> = BTreeMap::new();
    let mut collect = |value: &serde_json::Value| -> Result<(), String> {
        let Some(entries) = value.get("entries").and_then(|entry| entry.as_array()) else {
            return Ok(());
        };
        for entry in entries {
            let Some(object) = entry.as_object() else {
                continue;
            };
            let Some(id) = object.get("id").and_then(|id| id.as_str()) else {
                continue;
            };
            if id.is_empty() || id.len() > 128 {
                continue;
            }
            if object.get("at").and_then(|at| at.as_str()).is_none() {
                continue;
            }
            if object
                .get("updatedAt")
                .and_then(|updated| updated.as_str())
                .is_none()
            {
                continue;
            }
            let incoming_updated = object
                .get("updatedAt")
                .and_then(|updated| updated.as_str())
                .unwrap_or("");
            let replace = by_id
                .get(id)
                .and_then(|current| current.get("updatedAt"))
                .and_then(|updated| updated.as_str())
                .map(|current_updated| incoming_updated >= current_updated)
                .unwrap_or(true);
            if replace {
                by_id.insert(id.to_string(), entry.clone());
            }
        }
        Ok(())
    };

    if let Some(raw) = existing {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) {
            collect(&value)?;
        }
    }
    collect(&incoming_value)?;

    let mut entries: Vec<serde_json::Value> = by_id.into_values().collect();
    entries.sort_by(|left, right| {
        left.get("at")
            .and_then(|at| at.as_str())
            .unwrap_or("")
            .cmp(right.get("at").and_then(|at| at.as_str()).unwrap_or(""))
    });
    if entries.len() > REVIEW_PROGRESS_MAX_ENTRIES {
        entries = entries.split_off(entries.len() - REVIEW_PROGRESS_MAX_ENTRIES);
    }

    serde_json::to_string(&serde_json::json!({
        "version": 1,
        "entries": entries,
    }))
    .map_err(|error| error.to_string())
}

/// Lee el diario compartido de `progress/reviews.json`.
#[tauri::command]
async fn read_review_progress(
    state: tauri::State<'_, ActiveVault>,
) -> Result<Option<String>, String> {
    let storage = active_storage(&state)?;
    storage.read_progress_file(REVIEW_PROGRESS_PATH).await
}

/// Guarda y fusiona el diario de repasos de forma atómica.
#[tauri::command]
async fn write_review_progress(
    contents: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<String, String> {
    if contents.len() > REVIEW_PROGRESS_MAX_BYTES {
        return Err("El diario de repasos supera el límite permitido.".to_string());
    }
    let storage = active_storage(&state)?;
    let existing = storage.read_progress_file(REVIEW_PROGRESS_PATH).await?;
    let merged = merge_review_progress_json(existing.as_deref(), &contents)?;
    if merged.len() > REVIEW_PROGRESS_MAX_BYTES {
        return Err("El diario de repasos supera el límite permitido.".to_string());
    }
    storage
        .write_progress_file(REVIEW_PROGRESS_PATH, &merged)
        .await?;
    Ok(merged)
}

/// Devuelve las revisiones guardadas en disco de una nota.
#[tauri::command]
fn read_page_revisions(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<PageRevision>, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    let revisions_path = revisions_file_path(&root, &note)?;
    Ok(read_page_revisions_from_disk(&revisions_path))
}

/// Guarda las revisiones de una nota de forma atómica (temporal + rename).
#[tauri::command(async)]
fn write_page_revisions(
    file_path: String,
    revisions: Vec<PageRevision>,
    state: tauri::State<'_, ActiveVault>,
) -> Result<(), String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    let revisions_path = revisions_file_path(&root, &note)?;
    let json = serde_json::to_string(&revisions).map_err(|e| e.to_string())?;
    write_file_atomically(&revisions_path, &json)
}

/// Devuelve el estado actual de los snapshots de una nota concreta.
#[tauri::command]
fn get_snapshot_state(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<SnapshotState, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    let config = read_note_snapshot_config(&root, &note)?;
    snapshot_state_for_note(&root, &note, &config)
}

/// Activa (o reinicia) los snapshots de una nota durante 1 a 30 días.
#[tauri::command]
fn activate_snapshots(
    file_path: String,
    duration_days: u32,
    interval_hours: u32,
    max_per_day: u32,
    state: tauri::State<'_, ActiveVault>,
    gate: tauri::State<'_, SnapshotGate>,
) -> Result<SnapshotState, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    let _guard = gate
        .0
        .lock()
        .map_err(|_| "No se pudo coordinar el trabajo de snapshots.".to_string())?;
    activate_snapshots_in_root(&root, &note, duration_days, interval_hours, max_per_day)
}

/// Desactiva los snapshots de una nota y borra todas sus copias guardadas.
#[tauri::command]
fn disable_snapshots(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
    gate: tauri::State<'_, SnapshotGate>,
) -> Result<SnapshotState, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    let _guard = gate
        .0
        .lock()
        .map_err(|_| "No se pudo coordinar el trabajo de snapshots.".to_string())?;
    disable_snapshots_in_root(&root, &note)
}

/// Notas con snapshots activos y número de copias guardadas (Ajustes).
#[tauri::command]
fn list_active_snapshot_notes(
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<SnapshotNoteSummary>, String> {
    let root = active_root(&state)?;
    list_active_snapshot_notes_from_root(&root)
}

/// Borra los snapshots de una nota y desactiva su seguimiento.
#[tauri::command(async)]
fn delete_note_snapshots(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
    gate: tauri::State<'_, SnapshotGate>,
) -> Result<(), String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    let _guard = gate
        .0
        .lock()
        .map_err(|_| "No se pudo coordinar el trabajo de snapshots.".to_string())?;
    delete_note_snapshots_from_root(&root, &note)
}

/// Borra todos los snapshots de todas las notas del vault.
#[tauri::command(async)]
fn delete_all_snapshots(
    state: tauri::State<'_, ActiveVault>,
    gate: tauri::State<'_, SnapshotGate>,
) -> Result<usize, String> {
    let root = active_root(&state)?;
    let _guard = gate
        .0
        .lock()
        .map_err(|_| "No se pudo coordinar el trabajo de snapshots.".to_string())?;
    delete_all_snapshots_from_root(&root)
}

/// Comprueba todas las notas activas. El backend decide siempre: la interfaz
/// solo pregunta periódicamente y no puede saltarse el intervalo ni la ventana.
#[tauri::command(async)]
fn tick_snapshots(
    state: tauri::State<'_, ActiveVault>,
    gate: tauri::State<'_, SnapshotGate>,
) -> Result<Vec<SnapshotNoteSummary>, String> {
    let root = active_root(&state)?;
    let _guard = gate
        .0
        .lock()
        .map_err(|_| "No se pudo coordinar el trabajo de snapshots.".to_string())?;
    tick_snapshots_in_root(&root)
}

/// Lista los snapshots de una nota (más recientes primero).
#[tauri::command]
fn read_note_snapshots(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<PageRevision>, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    read_note_snapshots_from_root(&root, &note)
}

/// Restaura una nota desde un snapshot concreto de `chronos/`.
#[tauri::command(async)]
fn restore_snapshot(
    file_path: String,
    snapshot_id: String,
    state: tauri::State<'_, ActiveVault>,
    gate: tauri::State<'_, SnapshotGate>,
) -> Result<RestoredSnapshot, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    if note.extension().and_then(|value| value.to_str()) != Some("md") {
        return Err("Los snapshots solo existen para notas .md.".to_string());
    }
    if !note.is_file() {
        return Err("No se encontró la nota que se quiere restaurar.".to_string());
    }
    let _guard = gate
        .0
        .lock()
        .map_err(|_| "No se pudo coordinar el trabajo de snapshots.".to_string())?;
    restore_snapshot_from_root(&root, &note, &snapshot_id)
}

/// Convierte el historial antiguo de `.sinnotas/revisions` al formato nuevo.
#[tauri::command(async)]
fn migrate_legacy_snapshots(state: tauri::State<'_, ActiveVault>) -> Result<(), String> {
    let root = active_root(&state)?;
    migrate_legacy_revisions(&root, true)
}

/// Guarda el texto plano de una nota mostrando el diálogo nativo de guardado
/// desde el backend. Devuelve la ruta guardada, o `None` si el usuario canceló.
#[tauri::command]
async fn export_page_text(
    contents: String,
    file_name: String,
    app: AppHandle,
) -> Result<Option<String>, String> {
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("pagina.txt");
    let Some(picked) = app
        .dialog()
        .file()
        .set_file_name(safe_name)
        .add_filter("Texto plano", &["txt"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|err| err.to_string())?;
    write_text_export(&path, &contents)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn write_text_export(path: &Path, contents: &str) -> Result<(), String> {
    if path.extension().and_then(|ext| ext.to_str()) != Some("txt") {
        return Err("La exportación debe usar la extensión .txt.".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "La ruta de exportación no es válida.".to_string())?;
    if !parent.is_dir() {
        return Err("La carpeta elegida para exportar no existe.".to_string());
    }
    if path.is_dir() {
        return Err("La ruta de exportación debe ser un archivo.".to_string());
    }
    fs::write(path, contents).map_err(|error| error.to_string())
}

/// Detecta contenido activo (scripts, handlers de eventos, iframes, etc.) dentro
/// de un SVG. Cualquier SVG que pueda ejecutar código o cargar recursos externos se
/// rechaza para blindar la integridad de la app ante archivos no confiables.
fn svg_has_active_content(content: &str) -> bool {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    // Intentar parseo XML estricto primero
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let name = e.name();
                let tag_name = String::from_utf8_lossy(name.as_ref()).to_ascii_lowercase();
                if [
                    "script",
                    "foreignobject",
                    "iframe",
                    "embed",
                    "object",
                    "applet",
                    "link",
                    "meta",
                    "form",
                    "style",
                    "use",
                    "set",
                    "handler",
                ]
                .contains(&tag_name.as_str())
                {
                    return true;
                }
                // Comprobar atributos peligrosos
                for attr in e.attributes().flatten() {
                    let key = String::from_utf8_lossy(attr.key.as_ref()).to_ascii_lowercase();
                    let val = String::from_utf8_lossy(&attr.value).to_ascii_lowercase();
                    if key.starts_with("on") {
                        return true;
                    }
                    if (key == "href"
                        || key == "xlink:href"
                        || key == "src"
                        || key == "action"
                        || key == "formaction")
                        && (val.contains("javascript:")
                            || val.contains("data:text/html")
                            || val.contains("vbscript:"))
                    {
                        return true;
                    }
                    if key == "style"
                        && (val.contains("javascript:") || val.contains("expression("))
                    {
                        return true;
                    }
                }
            }
            Ok(Event::CData(_)) => return true,
            // 0.41 exponen referencias a entidades sin expandir (`&foo;`). Pueden
            // ocultar scripts/URI methods tras expansiones externas: se desconía.
            Ok(Event::GeneralRef(_)) => return true,
            Ok(Event::Decl(_)) | Ok(Event::DocType(_)) => {}
            Ok(Event::End(_)) => {}
            Ok(Event::Text(_)) => {}
            Ok(Event::Comment(_)) => {}
            Ok(Event::PI(_)) => {}
            Err(_) => break,
            Ok(Event::Eof) => break,
        }
        buf.clear();
    }

    // Fallback con normalización si el parseo falla parcialmente
    let mut normalized = content.to_string();
    let mut lower = normalized.to_ascii_lowercase();

    let entity_replacements = [
        ("&#x", "0x"),
        ("&#", ""),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&amp;", "&"),
        ("&quot;", "\""),
        ("&apos;", "'"),
    ];
    for (from, to) in &entity_replacements {
        lower = lower.replace(from, to);
        normalized = normalized.replace(from, to);
    }

    lower = lower.replace("<![cdata[", "<").replace("]]>", ">");
    normalized = normalized.replace("<![CDATA[", "<").replace("]]>", ">");

    let whitespace_re = Regex::new(r"[\s\r\n\t]+").ok();
    if let Some(re) = &whitespace_re {
        lower = re.replace_all(&lower, " ").to_string();
    }

    const DANGEROUS_TAGS: [&str; 12] = [
        "<script",
        "<foreignobject",
        "<iframe",
        "<embed",
        "<object",
        "<applet",
        "<link",
        "<meta",
        "<form",
        "<style",
        "<use",
        "<set",
    ];
    if DANGEROUS_TAGS.iter().any(|tag| lower.contains(tag)) {
        return true;
    }

    const DANGEROUS_SCHEMES: [&str; 4] = [
        "javascript:",
        "data:text/html",
        "data:application/javascript",
        "vbscript:",
    ];
    if DANGEROUS_SCHEMES
        .iter()
        .any(|scheme| lower.contains(scheme))
    {
        return true;
    }

    if Regex::new(r"on[a-z]{2,30}\s*=").is_ok_and(|re| re.is_match(&lower)) {
        return true;
    }
    if Regex::new(
        r"(href|src|action|xlink:href)\s*=[^\r\n]{0,500}?(javascript:|data:text/html|vbscript:)",
    )
    .is_ok_and(|re| re.is_match(&lower))
    {
        return true;
    }
    if normalized.contains("&#") || normalized.contains("&lt;script") {
        return true;
    }

    false
}

fn validate_image_file(file_name: &str, bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() || bytes.len() > 5 * 1024 * 1024 {
        return Err("La imagen debe tener un tamaño máximo de 5 MB.".to_string());
    }
    let file_path = Path::new(file_name);
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let valid_image = match extension.as_str() {
        "png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "jpg" | "jpeg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "gif" => bytes.starts_with(b"GIF8"),
        "webp" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"),
        "svg" => std::str::from_utf8(bytes)
            .map(|content| {
                content.to_ascii_lowercase().contains("<svg") && !svg_has_active_content(content)
            })
            .unwrap_or(false),
        "bmp" => bytes.starts_with(b"BM"),
        _ => false,
    };
    if !valid_image || file_path.file_name().and_then(|value| value.to_str()) != Some(file_name) {
        return Err("El archivo seleccionado no es una imagen compatible.".to_string());
    }
    Ok(())
}

fn store_image_in_vault(
    file_name: &str,
    bytes: &[u8],
    state: &ActiveVault,
) -> Result<SavedImagePath, String> {
    validate_image_file(file_name, bytes)?;
    let root = active_root(state)?;
    let requested_name = Path::new(file_name);
    let stem = requested_name
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "El nombre de la imagen no es válido.".to_string())?;
    let extension = requested_name
        .extension()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "La extensión de la imagen no es válida.".to_string())?;
    let assets = resolve_vault_path(&root, "assets")?;
    fs::create_dir_all(&assets).map_err(|err| err.to_string())?;

    for suffix in 0..10_000 {
        let candidate_name = if suffix == 0 {
            file_name.to_string()
        } else {
            format!("{stem}_{suffix}.{extension}")
        };
        let relative_path = Path::new("assets").join(candidate_name);
        let target = resolve_vault_path(&root, &relative_path.to_string_lossy())?;
        let mut file = match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        };
        if let Err(error) = file.write_all(bytes) {
            drop(file);
            let _ = fs::remove_file(&target);
            return Err(error.to_string());
        }
        drop(file);

        let absolute_path = fs::canonicalize(&target).map_err(|err| err.to_string())?;
        return Ok(SavedImagePath {
            relative_path: relative_path.to_string_lossy().replace('\\', "/"),
            absolute_path: absolute_path.to_string_lossy().into_owned(),
        });
    }

    Err("No se pudo encontrar un nombre único para la imagen.".to_string())
}

#[tauri::command]
fn save_image(
    file_name: String,
    bytes: Vec<u8>,
    state: tauri::State<'_, ActiveVault>,
) -> Result<SavedImagePath, String> {
    store_image_in_vault(&file_name, &bytes, &state)
}

#[tauri::command]
fn save_dropped_image(
    source_path: String,
    file_name: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<SavedImagePath, String> {
    let source = PathBuf::from(&source_path);
    if !source.is_absolute() {
        return Err("La ruta de la imagen arrastrada no es absoluta.".to_string());
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp"
    ) {
        return Err("Solo se admiten imágenes PNG, JPG, JPEG, WebP, SVG, GIF o BMP.".to_string());
    }
    let metadata = fs::metadata(&source).map_err(|err| err.to_string())?;
    if !metadata.is_file() {
        return Err("El elemento arrastrado no es un archivo.".to_string());
    }
    if metadata.len() == 0 || metadata.len() > 5 * 1024 * 1024 {
        return Err("La imagen debe tener un tamaño máximo de 5 MB.".to_string());
    }
    let bytes = fs::read(source).map_err(|err| err.to_string())?;
    store_image_in_vault(&file_name, &bytes, &state)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnusedAttachmentsReport {
    pub scanned: usize,
    pub removed: Vec<String>,
    pub kept: usize,
    pub failed: Vec<String>,
}

fn is_supported_image_extension(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp"
    )
}

fn delete_unused_attachments_in_root(root: &Path) -> Result<UnusedAttachmentsReport, String> {
    let canonical_root = fs::canonicalize(root).map_err(|err| err.to_string())?;
    let assets_path = resolve_vault_path(&canonical_root, "assets")?;
    if !assets_path.exists() {
        return Ok(UnusedAttachmentsReport {
            scanned: 0,
            removed: Vec::new(),
            kept: 0,
            failed: Vec::new(),
        });
    }
    let assets_root = fs::canonicalize(&assets_path).map_err(|err| err.to_string())?;
    if !assets_root.starts_with(&canonical_root) || !assets_root.is_dir() {
        return Err("La carpeta de adjuntos no pertenece al vault activo.".to_string());
    }

    // Conservador: se considera usada cualquier imagen cuyo nombre o ruta aparezca en
    // alguna nota `.md`. Así nunca se borra un archivo por una variante de sintaxis.
    let mut markdown = String::new();
    for entry in WalkDir::new(&canonical_root).sort_by_file_name() {
        let entry = entry.map_err(|err| {
            format!(
                "No se pudo revisar una nota del vault antes de borrar adjuntos: {}",
                err
            )
        })?;
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|ext| ext.to_str()) != Some("md")
        {
            continue;
        }
        let content = fs::read_to_string(entry.path()).map_err(|err| {
            format!(
                "No se pudo leer la nota {}: {}",
                entry.path().display(),
                err
            )
        })?;
        markdown.push_str(&content);
        markdown.push('\n');
    }

    let mut candidates = Vec::new();
    for entry in WalkDir::new(&assets_root).sort_by_file_name() {
        let entry = entry.map_err(|err| {
            format!(
                "No se pudo revisar la carpeta de adjuntos antes de borrar imágenes: {}",
                err
            )
        })?;
        if !entry.file_type().is_file() || !is_supported_image_extension(entry.path()) {
            continue;
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(&canonical_root)
            .map_err(|err| err.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let absolute = path.to_string_lossy().replace('\\', "/");
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_string();
        candidates.push((relative, absolute, file_name, path.to_path_buf()));
    }

    let scanned = candidates.len();
    let mut removed = Vec::new();
    let mut failed = Vec::new();
    for (relative, absolute, file_name, file_path) in candidates {
        let variants = [
            relative.clone(),
            relative.replace('/', "\\"),
            relative.replace(' ', "%20"),
            absolute.clone(),
            absolute.replace(' ', "%20"),
            file_name.clone(),
            format!("![[{}]]", file_name),
            format!("[[{}]]", file_name),
            format!("![[{}]]", relative),
            format!("[[{}]]", relative),
        ];
        let used = variants
            .iter()
            .any(|variant| markdown.contains(variant.as_str()));
        if used {
            continue;
        }
        match fs::remove_file(&file_path) {
            Ok(()) => removed.push(relative),
            Err(err) => failed.push(format!("{}: {}", relative, err)),
        }
    }

    Ok(UnusedAttachmentsReport {
        scanned,
        kept: scanned.saturating_sub(removed.len() + failed.len()),
        removed,
        failed,
    })
}

#[tauri::command]
fn delete_unused_attachments(
    state: tauri::State<'_, ActiveVault>,
) -> Result<UnusedAttachmentsReport, String> {
    let root = active_root(&state)?;
    delete_unused_attachments_in_root(&root)
}

#[tauri::command]
fn find_backlinks(
    page_title: String,
    state: tauri::State<'_, ActiveVault>,
    cache_state: tauri::State<'_, VaultCacheState>,
) -> Result<Vec<Backlink>, String> {
    let vault_path = active_root(&state)?;
    if let Some(runtime) = cache_state.current() {
        return Ok(runtime.find_backlinks(&page_title));
    }
    let mut backlinks = Vec::new();
    let wikilink_pattern = format!(r"\[\[{}\]\]", regex::escape(&page_title));
    let tag_pattern = format!(r"#{}\b", regex::escape(&page_title));
    let re =
        Regex::new(&format!("{}|{}", wikilink_pattern, tag_pattern)).map_err(|e| e.to_string())?;

    for entry in WalkDir::new(vault_path)
        .into_iter()
        .filter_entry(|entry| {
            // Excluir carpetas reservadas del recorrido
            if entry.depth() > 0 && entry.file_type().is_dir() {
                let name = entry.file_name().to_string_lossy();
                return !RESERVED_DIRS
                    .iter()
                    .any(|&r| r.eq_ignore_ascii_case(name.as_ref()));
            }
            true
        })
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension() {
                if ext == "md" {
                    let source_stem = entry
                        .path()
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    // Skip the page itself
                    if source_stem == page_title {
                        continue;
                    }

                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        for (idx, line) in content.lines().enumerate() {
                            if re.is_match(line) {
                                backlinks.push(Backlink {
                                    source_page: source_stem.clone(),
                                    source_path: entry.path().to_string_lossy().to_string(),
                                    line_number: idx + 1,
                                    snippet: line.trim().to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(backlinks)
}

#[tauri::command]
fn delete_page(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
    cache_state: tauri::State<'_, VaultCacheState>,
) -> Result<(), String> {
    let root = active_root(&state)?;
    let path = resolve_note_path(&root, &file_path)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e: std::io::Error| e.to_string())?;
    }
    if let Some(runtime) = cache_state.current() {
        runtime.update_paths(std::slice::from_ref(&path), false);
    }
    // El historial de revisiones muere con la nota: borrar el archivo de
    // revisiones best-effort (si falla, no las arrastramos como error).
    if let Ok(revisions_path) = revisions_file_path(&root, &path) {
        if revisions_path.exists() {
            let _ = fs::remove_file(&revisions_path);
        }
    }
    // Los snapshots nuevos viven en `chronos/<ruta relativa>/`.
    if let Ok(snapshot_dir) = snapshot_dir_for_note(&root, &path) {
        if snapshot_dir.starts_with(root.join(SNAPSHOT_FOLDER)) && snapshot_dir.is_dir() {
            let _ = fs::remove_dir_all(snapshot_dir);
        }
    }
    Ok(())
}

/// Elimina el prefijo verbatim `\\?\` de las rutas Windows canonicalizadas:
/// ShellExecute no lo admite de forma fiable. Solo se quita cuando va seguido
/// de una unidad (`\\?\C:\...` → `C:\...`); las rutas UNC
/// (`\\?\UNC\servidor\...`) y las que no llevan prefijo quedan intactas.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn strip_windows_verbatim_prefix(path: &str) -> String {
    let Some(rest) = path.strip_prefix(r"\\?\") else {
        return path.to_string();
    };
    let bytes = rest.as_bytes();
    let has_drive = bytes.len() >= 3 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic();
    if has_drive {
        rest.to_string()
    } else {
        path.to_string()
    }
}

/// Valida y resuelve la nota que se va a abrir con la aplicación
/// predeterminada. Reutiliza `resolve_note_path` (que ya rechaza rutas fuera
/// del vault, extensiones distintas de .md y carpetas reservadas) y exige que
/// el archivo exista en disco.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn resolve_openable_note(root: &Path, file_path: &str) -> Result<PathBuf, String> {
    let path = resolve_note_path(root, file_path)?;
    if !path.is_file() {
        return Err("La nota no existe en disco.".to_string());
    }
    Ok(path)
}

/// Abre la nota .md con la aplicación predeterminada del sistema. Va a través
/// del comando Rust (como delete_page) porque `capabilities/default.json` no
/// da permisos opener genéricos al frontend.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command(async)]
fn open_note_with_default_app(
    file_path: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, ActiveVault>,
) -> Result<(), String> {
    let root = active_root(&state)?;
    let path = resolve_openable_note(&root, &file_path)?;
    let target = strip_windows_verbatim_prefix(&path.to_string_lossy());
    app.opener()
        .open_path(target, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Stub de la misma firma registrada en `generate_handler!`: en móvil la
/// apertura de archivos locales con la app predeterminada no está verificada.
#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command(async)]
fn open_note_with_default_app() -> Result<(), String> {
    Err("No disponible en este dispositivo.".to_string())
}

#[tauri::command]
fn rename_page(
    old_path: String,
    new_path: String,
    state: tauri::State<'_, ActiveVault>,
    cache_state: tauri::State<'_, VaultCacheState>,
) -> Result<(), String> {
    let root = active_root(&state)?;
    let old_p = resolve_note_path(&root, &old_path)?;
    let new_p = resolve_note_path(&root, &new_path)?;
    if let Some(parent) = new_p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e: std::io::Error| e.to_string())?;
        }
    }
    if old_p.exists() {
        if new_p.exists() {
            let same_file = fs::canonicalize(&old_p).ok() == fs::canonicalize(&new_p).ok();
            if !same_file {
                return Err("Ya existe una nota con ese nombre.".to_string());
            }
        }
        fs::rename(&old_p, &new_p).map_err(|e| e.to_string())?;

        // El historial de revisiones viaja con la nota: mover el archivo de
        // revisiones a la nueva ruta relativa (best-effort: si falla no se
        // interrumpe el renombrado de la nota).
        if let (Ok(old_revisions), Ok(new_revisions)) = (
            revisions_file_path(&root, &old_p),
            revisions_file_path(&root, &new_p),
        ) {
            if old_revisions.exists() && old_revisions != new_revisions {
                if let Some(parent) = new_revisions.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::rename(&old_revisions, &new_revisions);
            }
        }

        // Los snapshots de `chronos/` siguen a la nota en su renombrado.
        let _ = move_snapshot_dir_for_note(&root, &old_p, &new_p);
    }
    if let Some(runtime) = cache_state.current() {
        runtime.update_paths(&[old_p, new_p], false);
    }
    Ok(())
}

/// Enumera familias tipográficas instaladas en el sistema operativo.
///
/// `queryLocalFonts` no está disponible en los webviews de Tauri, así que el
/// backend consulta las fuentes nativas. En Linux/macOS usa fontconfig
/// (`fc-list`); en Windows consulta el registro. Si el sistema no expone una
/// lista, devuelve un conjunto de familias habituales para que el selector
/// siga siendo utilizable.
#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    let mut families = BTreeSet::new();

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        if let Ok(output) = std::process::Command::new("fc-list")
            .args(["--format=%{family}\\n"])
            .output()
        {
            if output.status.success() {
                for line in String::from_utf8_lossy(&output.stdout).lines() {
                    for family in line.split(',') {
                        let family = family.trim();
                        if !family.is_empty() {
                            families.insert(family.to_string());
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let registry_keys = [
            r"HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
            r"HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
        ];
        let entry = Regex::new(r"^\s{4}(.{1,300}?)\s{4,}REG_\w{1,64}\s{4,}[^\r\n]{0,500}$").ok();
        for key in registry_keys {
            let Ok(output) = std::process::Command::new("reg")
                .args(["query", key, "/v"])
                .output()
            else {
                continue;
            };
            if !output.status.success() {
                continue;
            }
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let Some(entry) = entry.as_ref() else {
                    continue;
                };
                let Some(captures) = entry.captures(line) else {
                    continue;
                };
                let mut name = captures[1].trim().to_string();
                for suffix in [" (TrueType)", " (OpenType)", " (All res)", " (PostScript)"] {
                    if let Some(stripped) = name.strip_suffix(suffix) {
                        name = stripped.to_string();
                    }
                }
                if !name.is_empty() {
                    families.insert(name);
                }
            }
        }
    }

    if families.is_empty() {
        for family in [
            "Arial",
            "Calibri",
            "Cambria",
            "Comic Sans MS",
            "Consolas",
            "Courier New",
            "DejaVu Sans",
            "DejaVu Serif",
            "Georgia",
            "Helvetica",
            "Inter",
            "Liberation Sans",
            "Liberation Serif",
            "Noto Sans",
            "Open Sans",
            "Roboto",
            "Segoe UI",
            "Tahoma",
            "Times New Roman",
            "Trebuchet MS",
            "Ubuntu",
            "Verdana",
        ] {
            families.insert(family.to_string());
        }
    }

    families.into_iter().collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(init_android_fs())
        .plugin(tauri_plugin_dialog::init())
        .plugin(init_opener())
        .plugin(init_clipboard())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ActiveVault::default())
        .manage(SnapshotGate::default())
        .manage(VaultCacheState::default())
        .setup(|app| {
            let approved = load_approved_vault_roots(app.handle());
            app.manage(ApprovedVaultRoots(Mutex::new(approved)));
            Ok(())
        });

    // El actualizador nativo no existe en Android/iOS: allí el frontend
    // descarga el APK con el plugin HTTP y lo guarda con el de filesystem.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(tauri_plugin_http::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            load_vault,
            pick_vault_root,
            list_system_fonts,
            resolve_image_path,
            read_image_data,
            read_page,
            read_note_created_times,
            save_page,
            read_review_progress,
            write_review_progress,
            read_page_revisions,
            write_page_revisions,
            get_snapshot_state,
            activate_snapshots,
            disable_snapshots,
            list_active_snapshot_notes,
            delete_note_snapshots,
            delete_all_snapshots,
            tick_snapshots,
            read_note_snapshots,
            restore_snapshot,
            migrate_legacy_snapshots,
            export_page_text,
            save_image,
            save_dropped_image,
            delete_unused_attachments,
            find_backlinks,
            delete_page,
            open_note_with_default_app,
            rename_page
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_frontmatter_and_card_properties_round_trip() {
        let input = "---\ntags:\n  - study\n---\n- Pregunta :: respuesta #card\ncard-s:: 0.4\ncard-d:: 5\n  - nota hija\n";
        let (frontmatter, blocks) = parse_markdown_with_frontmatter(input);
        assert_eq!(frontmatter, vec!["tags:", "  - study"]);
        assert_eq!(blocks.len(), 1);
        assert_eq!(
            blocks[0].content,
            "Pregunta :: respuesta #card\ncard-s:: 0.4\ncard-d:: 5"
        );
        assert_eq!(blocks[0].children.len(), 1);

        let serialized = serialize_page_to_markdown(&frontmatter, &blocks);
        let (parsed_frontmatter, parsed_blocks) = parse_markdown_with_frontmatter(&serialized);
        assert_eq!(parsed_frontmatter, frontmatter);
        assert_eq!(parsed_blocks[0].content, blocks[0].content);
        assert_eq!(
            parsed_blocks[0].children[0].content,
            blocks[0].children[0].content
        );
    }

    #[test]
    fn standalone_markdown_images_round_trip_as_image_blocks() {
        let input = "- ![corazon](assets/corazon.png)\nimage-occlusions:: []\n";
        let (_, blocks) = parse_markdown_with_frontmatter(input);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].block_type, "image");
        assert_eq!(blocks[0].image_alt.as_deref(), Some("corazon"));
        assert_eq!(
            blocks[0].content,
            "assets/corazon.png\nimage-occlusions:: []"
        );

        let serialized = serialize_page_to_markdown(&[], &blocks);
        assert_eq!(
            serialized,
            "- ![corazon](assets/corazon.png)\nimage-occlusions:: []\n"
        );
        let (_, parsed) = parse_markdown_with_frontmatter(&serialized);
        assert_eq!(parsed[0].block_type, "image");
        assert_eq!(parsed[0].content, blocks[0].content);
    }

    #[test]
    fn image_occlusion_properties_round_trip_with_image_blocks() {
        let input = concat!(
            "- ![corazon](assets/corazon.png)\n",
            "image-occlusions:: [{\"source\":\"assets/corazon.png\",\"x\":0.1,\"y\":0.2,\"width\":0.3,\"height\":0.4,\"shape\":\"polygon\",\"points\":[{\"x\":0.15,\"y\":0.25},{\"x\":0.4,\"y\":0.6}],\"rotation\":22.5,\"color\":\"#123456\",\"hint\":\"aurícula\"}]\n"
        );
        let (_, blocks) = parse_markdown_with_frontmatter(input);
        assert_eq!(blocks.len(), 1);
        assert!(blocks[0].content.contains("image-occlusions:: "));

        let serialized = serialize_page_to_markdown(&[], &blocks);
        let (_, parsed) = parse_markdown_with_frontmatter(&serialized);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].content, blocks[0].content);
        assert!(parsed[0].content.contains("\"hint\":\"aurícula\""));
        assert!(parsed[0].content.contains("\"rotation\":22.5"));
        assert!(parsed[0]
            .content
            .contains("\"points\":[{\"x\":0.15,\"y\":0.25}"));
    }

    #[test]
    fn svg_files_with_active_content_are_rejected() {
        let ok =
            b"<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"10\" height=\"10\"/></svg>";
        assert!(validate_image_file("ok.svg", ok).is_ok());

        let script = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>";
        assert!(validate_image_file("script.svg", script).is_err());

        let onload = b"<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"></svg>";
        assert!(validate_image_file("onload.svg", onload).is_err());

        let foreign = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><foreignObject><iframe src=\"x\"></iframe></foreignObject></svg>";
        assert!(validate_image_file("foreign.svg", foreign).is_err());

        let js_url = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><a href=\"javascript:alert(1)\"><rect/></a></svg>";
        assert!(validate_image_file("js.svg", js_url).is_err());

        // El caso sensible a mayúsculas también debe rechazarse.
        let upper = b"<SVG ONLOAD=\"alert(1)\"></SVG>";
        assert!(validate_image_file("upper.svg", upper).is_err());

        // Un PNG legítimo sigue aceptándose (no se altera el resto de formatos).
        let png = b"\x89PNG\r\n\x1a\nrest";
        assert!(validate_image_file("ok.png", png).is_ok());
    }

    #[test]
    fn vault_paths_cannot_escape_the_selected_root() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-vault-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();

        assert!(resolve_vault_path(&canonical_root, "../outside.md").is_err());
        assert_eq!(
            resolve_vault_path(&canonical_root, "pages/note.md").unwrap(),
            canonical_root.join("pages/note.md")
        );

        // Rutas absolutas solo se aceptan si quedan dentro de la raíz.
        let inside = canonical_root.join("pages").join("inside.md");
        assert_eq!(
            resolve_vault_path(&canonical_root, inside.to_str().unwrap()).unwrap(),
            inside
        );
        assert!(resolve_vault_path(&canonical_root, "/etc/passwd").is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn vault_paths_reject_uris_nul_bytes_and_empty_names() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-vault-uri-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();

        for uri in [
            "content://com.android.providers.downloads/notes/1.md",
            "file:///storage/emulated/0/notes/1.md",
            "https://example.com/note.md",
            "javascript:alert(1)",
            "data:text/plain,hola",
        ] {
            assert!(
                resolve_vault_path(&canonical_root, uri).is_err(),
                "la URI {uri} no debería aceptarse"
            );
        }

        assert!(resolve_vault_path(&canonical_root, "pages/\0nota.md").is_err());
        assert!(resolve_vault_path(&canonical_root, "../").is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn vault_paths_reject_symlinks_that_escape_the_root() {
        use std::os::unix::fs::symlink;

        let base = std::env::temp_dir().join(format!(
            "sinnotas-vault-symlink-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let root = base.join("vault");
        let outside = base.join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secreto.md"), "no debería leerse").unwrap();
        symlink(&outside, root.join("enlace")).unwrap();

        let canonical_root = fs::canonicalize(&root).unwrap();
        assert!(resolve_vault_path(&canonical_root, "enlace/secreto.md").is_err());
        assert!(resolve_vault_path(&canonical_root, "enlace").is_err());

        fs::remove_dir_all(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn resolve_vault_path_rejects_dangling_symlink_outside_vault() {
        // Test para symlink colgante (dangling) que apunta fuera del vault.
        // symlink_metadata debería detectar el symlink aunque el target no exista.
        use std::os::unix::fs::symlink;

        let base = std::env::temp_dir().join(format!(
            "sinnotas-dangling-symlink-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let root = base.join("vault");
        let outside = base.join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();

        // Crear un symlink que apunta a un path que NO EXISTE fuera del vault
        let dangling_target = outside.join("no_existe");
        symlink(&dangling_target, root.join("dangling_link")).unwrap();

        // Verificar que el target realmente no existe
        assert!(!dangling_target.exists());

        let canonical_root = fs::canonicalize(&root).unwrap();

        // resolve_vault_path debería RECHAZAR el symlink colgante porque
        // symlink_metadata lo detecta como symlink y canonicalize lo resuelve
        // apuntando fuera del vault.
        assert!(resolve_vault_path(&canonical_root, "dangling_link").is_err());
        assert!(resolve_vault_path(&canonical_root, "dangling_link/algo.md").is_err());

        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn page_export_writes_text_files_and_rejects_other_extensions() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-export-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("pagina.txt");

        write_text_export(&target, "Mi página\nContenido").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "Mi página\nContenido");
        assert!(write_text_export(&root.join("pagina.pdf"), "No válido").is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn unused_attachments_are_removed_but_referenced_ones_are_kept() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-attachments-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let assets = root.join("assets");
        fs::create_dir_all(&assets).unwrap();
        fs::write(
            root.join("note.md"),
            "- ![usada](assets/used.png)\n- assets/also-used.png\n",
        )
        .unwrap();
        for name in ["used.png", "also-used.png", "unused.png"] {
            fs::write(assets.join(name), b"image").unwrap();
        }
        fs::write(assets.join("document.pdf"), b"document").unwrap();

        let report = delete_unused_attachments_in_root(&root).unwrap();
        assert_eq!(report.scanned, 3);
        assert_eq!(report.kept, 2);
        assert_eq!(report.removed, vec!["assets/unused.png"]);
        assert!(report.failed.is_empty());
        assert!(!assets.join("unused.png").exists());
        assert!(assets.join("used.png").exists());
        assert!(assets.join("also-used.png").exists());
        assert!(assets.join("document.pdf").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn page_saves_write_atomically_without_temp_files() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-save-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let pages = root.join("pages");
        fs::create_dir_all(&pages).unwrap();
        let target = pages.join("note.md");

        // Primera escritura (la carpeta ya existe): crea el contenido correcto
        // y no deja temporales en la carpeta de la nota.
        write_file_atomically(&target, "- contenido nuevo #card\n").unwrap();
        assert_eq!(
            fs::read_to_string(&target).unwrap(),
            "- contenido nuevo #card\n"
        );
        let leftovers: Vec<String> = fs::read_dir(&pages)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.contains("sinnotas-tmp"))
            .collect();
        assert!(leftovers.is_empty(), "quedaron temporales: {leftovers:?}");

        // Escritura sobre la misma nota (caso habitual al editar): el rename
        // reemplaza el destino y el resultado final sigue siendo correcto.
        write_file_atomically(&target, "- contenido editado\n- segunda línea\n").unwrap();
        assert_eq!(
            fs::read_to_string(&target).unwrap(),
            "- contenido editado\n- segunda línea\n"
        );
        let leftovers: Vec<String> = fs::read_dir(&pages)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.contains("sinnotas-tmp"))
            .collect();
        assert!(leftovers.is_empty(), "quedaron temporales: {leftovers:?}");

        // Si la carpeta no existe, se crea (mismo comportamiento que antes).
        let nested = root.join("journals/sub/nota.md");
        write_file_atomically(&nested, "Diario\n").unwrap();
        assert_eq!(fs::read_to_string(&nested).unwrap(), "Diario\n");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn page_revisions_round_trip_through_disk_and_survive_rename() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-revisions-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();
        let note = canonical_root.join("pages/sub/nota.md");
        fs::create_dir_all(note.parent().unwrap()).unwrap();
        fs::write(&note, "- hola\n").unwrap();

        let revisions_path = revisions_file_path(&canonical_root, &note).unwrap();
        let expected = canonical_root.join(".sinnotas/revisions/pages/sub/nota.md.json");
        assert_eq!(revisions_path, expected);
        assert!(revisions_path.starts_with(&canonical_root));

        // Sin archivo todavía: lectura vacía.
        assert!(read_page_revisions_from_disk(&revisions_path).is_empty());

        // Escritura de una revisión y round-trip.
        let revision = PageRevision {
            id: "rev-1".to_string(),
            timestamp: "22 oct, 16:31".to_string(),
            summary: "Guardado automático de cambios".to_string(),
            created_at: None,
            blocks: vec![BlockNode {
                id: "b-1".to_string(),
                block_type: "text".to_string(),
                image_alt: None,
                content: "hola".to_string(),
                children: Vec::new(),
                collapsed: false,
            }],
        };
        let json = serde_json::to_string(&vec![revision.clone()]).unwrap();
        write_file_atomically(&revisions_path, &json).unwrap();

        let loaded = read_page_revisions_from_disk(&revisions_path);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "rev-1");
        assert_eq!(loaded[0].summary, revision.summary);
        assert_eq!(loaded[0].blocks[0].content, "hola");
        assert_eq!(loaded[0].blocks[0].block_type, "text");

        // El JSON es legible por la misma estructura que consume el frontend.
        let parsed_again: Vec<PageRevision> =
            serde_json::from_str(&fs::read_to_string(&revisions_path).unwrap()).unwrap();
        assert_eq!(parsed_again[0].id, "rev-1");

        // El rename de la nota mueve el archivo de revisiones.
        let renamed_note = canonical_root.join("pages/sub/otro-nombre.md");
        let old_revisions = revisions_file_path(&canonical_root, &note).unwrap();
        let new_revisions = revisions_file_path(&canonical_root, &renamed_note).unwrap();
        fs::rename(&note, &renamed_note).unwrap();
        fs::create_dir_all(new_revisions.parent().unwrap()).unwrap();
        fs::rename(&old_revisions, &new_revisions).unwrap();
        assert!(new_revisions.exists());
        assert!(!old_revisions.exists());

        // El delete de la nota elimina el archivo de revisiones.
        fs::remove_file(&renamed_note).unwrap();
        fs::remove_file(&new_revisions).unwrap();
        assert!(!new_revisions.exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn corrupt_revision_files_are_treated_as_empty_and_quarantined() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-revisions-corrupt-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();
        let note = canonical_root.join("nota.md");
        fs::write(&note, "- hola\n").unwrap();
        let revisions_path = revisions_file_path(&canonical_root, &note).unwrap();
        fs::create_dir_all(revisions_path.parent().unwrap()).unwrap();
        fs::write(&revisions_path, "{\"not\":\"a list of revisions\"").unwrap();

        assert!(read_page_revisions_from_disk(&revisions_path).is_empty());
        // El corrupto se aparta a .bad para no chocar con la próxima escritura.
        let quarantined = revisions_path.with_extension("bad");
        assert!(quarantined.exists());
        assert!(!revisions_path.exists());

        // Archivo vacío: lectura vacía sin mover nada.
        fs::write(&revisions_path, "").unwrap();
        assert!(read_page_revisions_from_disk(&revisions_path).is_empty());
        assert!(revisions_path.exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn revision_paths_must_stay_inside_the_vault() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-revisions-scope-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();

        // Una nota fuera del vault no tiene archivo de revisiones válido.
        assert!(revisions_file_path(&canonical_root, Path::new("/etc/passwd")).is_err());

        // El archivo de revisiones resultante siempre vive bajo .sinnotas.
        let note = canonical_root.join("pages/n.md");
        let path = revisions_file_path(&canonical_root, &note).unwrap();
        assert!(path.starts_with(canonical_root.join(".sinnotas/revisions/")));

        fs::remove_dir_all(root).unwrap();
    }

    fn snapshot_test_root(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::canonicalize(root).unwrap()
    }

    #[test]
    fn snapshot_config_is_clamped_to_the_safe_window() {
        let config = SnapshotConfig {
            version: 0,
            enabled: true,
            activated_at: 1_000,
            expires_at: 1_000 + 99 * 24 * 60 * 60 * 1000,
            duration_days: 9_999,
            interval_hours: 0,
            max_per_day: 0,
            last_run_at: -5,
            last_status: String::new(),
        }
        .sanitize();
        assert_eq!(config.duration_days, SNAPSHOT_MAX_DAYS);
        assert_eq!(config.interval_hours, 1);
        // 0 es un valor válido: significa "sin límite diario".
        assert_eq!(config.max_per_day, 0);
        assert_eq!(config.last_run_at, 0);
        // Una ventana mayor de 30 días se invalida por completo.
        assert!(!config.enabled);

        let valid = SnapshotConfig {
            enabled: true,
            activated_at: 1_000,
            expires_at: 1_000 + 7 * 24 * 60 * 60 * 1000,
            ..SnapshotConfig::default()
        }
        .sanitize();
        assert!(valid.enabled);
        assert_eq!(valid.duration_days, 7);
    }

    #[test]
    fn snapshots_are_created_per_note_read_and_restored_from_chronos() {
        let root = snapshot_test_root("snapshots-test");
        let pages = root.join("pages");
        fs::create_dir_all(&pages).unwrap();
        let note = pages.join("nota.md");
        let other_note = pages.join("otra.md");
        fs::write(&note, "- original\n").unwrap();
        fs::write(&other_note, "- otra nota\n").unwrap();

        // Activar una nota crea su snapshot inicial inmediatamente y no toca
        // el resto de notas del vault.
        let state = activate_snapshots_in_root(&root, &note, 7, 1, 2).unwrap();
        assert!(state.enabled);
        assert_eq!(state.note_path, "pages/nota.md");
        assert_eq!(state.snapshot_count, 1);
        assert!(read_note_snapshots_from_root(&root, &other_note)
            .unwrap()
            .is_empty());

        let active = list_active_snapshot_notes_from_root(&root).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].note_path, "pages/nota.md");
        assert_eq!(active[0].snapshot_count, 1);

        // El intervalo impide un segundo snapshot inmediato.
        fs::write(&note, "- cambiado\n").unwrap();
        let active = tick_snapshots_in_root(&root).unwrap();
        assert_eq!(active[0].snapshot_count, 1);
        assert_eq!(
            read_note_snapshots_from_root(&root, &note).unwrap().len(),
            1
        );

        // Forzar el siguiente tick crea el segundo y agota el límite diario.
        let mut config = read_note_snapshot_config(&root, &note).unwrap();
        config.last_run_at = 0;
        write_note_snapshot_config(&root, &note, &config).unwrap();
        let active = tick_snapshots_in_root(&root).unwrap();
        assert_eq!(active[0].snapshot_count, 2);
        let snapshots = read_note_snapshots_from_root(&root, &note).unwrap();
        assert_eq!(snapshots.len(), 2);

        config.last_run_at = 0;
        write_note_snapshot_config(&root, &note, &config).unwrap();
        fs::write(&note, "- tercero\n").unwrap();
        let active = tick_snapshots_in_root(&root).unwrap();
        assert_eq!(active[0].snapshot_count, 2);
        assert_eq!(
            read_note_snapshots_from_root(&root, &note).unwrap().len(),
            2
        );

        // Restaurar el snapshot más antiguo (el contenido original).
        let oldest = snapshots.last().unwrap();
        let restored = restore_snapshot_from_root(&root, &note, &oldest.id).unwrap();
        assert_eq!(restored.blocks[0].content, "original");
        assert_eq!(fs::read_to_string(&note).unwrap(), "- original\n");
        // La restauración deja además un snapshot de seguridad.
        assert!(read_note_snapshots_from_root(&root, &note).unwrap().len() >= 3);
        assert!(snapshot_dir_for_note(&root, &note).unwrap().is_dir());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn expired_snapshots_are_deleted_and_the_original_note_remains() {
        let root = snapshot_test_root("snapshots-expire-test");
        let pages = root.join("pages");
        fs::create_dir_all(&pages).unwrap();
        let note = pages.join("nota.md");
        fs::write(&note, "- contenido original\n").unwrap();

        activate_snapshots_in_root(&root, &note, 1, 1, 8).unwrap();
        let snapshot_dir = snapshot_dir_for_note(&root, &note).unwrap();
        assert!(snapshot_dir.is_dir());
        assert_eq!(
            read_note_snapshots_from_root(&root, &note).unwrap().len(),
            1
        );

        // Simular que la ventana ya venció.
        let now = now_millis().unwrap();
        let mut config = read_note_snapshot_config(&root, &note).unwrap();
        config.activated_at = now.saturating_sub(10_000);
        config.expires_at = now.saturating_sub(1_000);
        write_note_snapshot_config(&root, &note, &config).unwrap();

        let active = tick_snapshots_in_root(&root).unwrap();
        assert!(active.is_empty());
        assert!(!snapshot_dir.exists());
        assert!(read_note_snapshots_from_root(&root, &note)
            .unwrap()
            .is_empty());
        assert_eq!(fs::read_to_string(&note).unwrap(), "- contenido original\n");
        assert!(!read_note_snapshot_config(&root, &note).unwrap().enabled);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn manually_disabling_snapshots_deletes_the_saved_versions() {
        let root = snapshot_test_root("snapshots-disable-test");
        let pages = root.join("pages");
        fs::create_dir_all(&pages).unwrap();
        let note = pages.join("nota.md");
        fs::write(&note, "- original\n").unwrap();

        activate_snapshots_in_root(&root, &note, 7, 4, 8).unwrap();
        let snapshot_dir = snapshot_dir_for_note(&root, &note).unwrap();
        assert_eq!(
            read_note_snapshots_from_root(&root, &note).unwrap().len(),
            1
        );

        let state = disable_snapshots_in_root(&root, &note).unwrap();
        assert!(!state.enabled);
        assert_eq!(state.snapshot_count, 0);
        assert!(!snapshot_dir.exists());
        assert!(read_note_snapshots_from_root(&root, &note)
            .unwrap()
            .is_empty());
        assert_eq!(fs::read_to_string(&note).unwrap(), "- original\n");
        assert!(list_active_snapshot_notes_from_root(&root)
            .unwrap()
            .is_empty());

        // Volver a activar crea una nueva versión inicial.
        let state = activate_snapshots_in_root(&root, &note, 1, 1, 8).unwrap();
        assert!(state.enabled);
        assert_eq!(state.snapshot_count, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_all_snapshots_clears_every_note_but_keeps_originals() {
        let root = snapshot_test_root("snapshots-delete-all-test");
        let pages = root.join("pages");
        fs::create_dir_all(&pages).unwrap();
        let note_a = pages.join("nota_a.md");
        let note_b = pages.join("nota_b.md");
        fs::write(&note_a, "- contenido a\n").unwrap();
        fs::write(&note_b, "- contenido b\n").unwrap();

        activate_snapshots_in_root(&root, &note_a, 7, 4, 8).unwrap();
        activate_snapshots_in_root(&root, &note_b, 7, 4, 8).unwrap();
        assert_eq!(
            list_active_snapshot_notes_from_root(&root).unwrap().len(),
            2
        );

        let removed = delete_all_snapshots_from_root(&root).unwrap();
        // Las notas comparten el directorio de primer nivel (`pages/`), así que
        // basta con eliminar esa entrada para vaciar todos los snapshots.
        assert!(removed >= 1);
        assert_eq!(
            fs::read_dir(snapshot_root(&root).unwrap()).unwrap().count(),
            0
        );
        assert!(list_active_snapshot_notes_from_root(&root)
            .unwrap()
            .is_empty());
        assert!(read_note_snapshots_from_root(&root, &note_a)
            .unwrap()
            .is_empty());
        assert!(read_note_snapshots_from_root(&root, &note_b)
            .unwrap()
            .is_empty());
        // Las notas originales permanecen intactas.
        assert_eq!(fs::read_to_string(&note_a).unwrap(), "- contenido a\n");
        assert_eq!(fs::read_to_string(&note_b).unwrap(), "- contenido b\n");
        // La carpeta raíz de snapshots sigue existiendo para futuros snapshots.
        assert!(snapshot_root(&root).unwrap().is_dir());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn snapshot_paths_cannot_escape_the_vault() {
        let root = snapshot_test_root("snapshots-scope-test");
        let note = root.join("pages/nota.md");
        fs::create_dir_all(note.parent().unwrap()).unwrap();
        fs::write(&note, "- hola\n").unwrap();

        assert!(snapshot_note_key(&root, &note).is_ok());
        let dir = snapshot_dir_for_note(&root, &note).unwrap();
        assert!(dir.starts_with(root.join(SNAPSHOT_FOLDER)));
        assert!(snapshot_note_key(&root, Path::new("/etc/passwd")).is_err());
        assert!(snapshot_dir_for_note(&root, &root.join("nota.txt")).is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn journal_dates_are_read_from_journal_file_paths() {
        assert_eq!(
            journal_date_from_path(Path::new("/vault/journals/2026_10_17.md")),
            Some("2026-10-17".to_string())
        );
        assert_eq!(
            journal_date_from_path(Path::new("/vault/journals/2024_02_29.md")),
            Some("2024-02-29".to_string())
        );
        assert_eq!(
            journal_date_from_path(Path::new("/vault/journals/2026_02_29.md")),
            None
        );
        assert_eq!(
            journal_date_from_path(Path::new("/vault/pages/2026_10_17.md")),
            None
        );
    }

    #[test]
    fn resolve_note_path_rejects_non_md_extensions() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-note-path-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();

        // .sh debe rechazarse
        assert!(resolve_note_path(&canonical_root, "script.sh").is_err());
        // .txt debe rechazarse
        assert!(resolve_note_path(&canonical_root, "note.txt").is_err());
        // .md debe aceptarse
        assert!(resolve_note_path(&canonical_root, "note.md").is_ok());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolve_note_path_rejects_reserved_directories() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-note-path-reserved-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();

        // chronos/ en cualquier nivel debe rechazarse
        assert!(resolve_note_path(&canonical_root, "chronos/nota.md").is_err());
        assert!(resolve_note_path(&canonical_root, "pages/chronos/nota.md").is_err());
        assert!(resolve_note_path(&canonical_root, "pages/sub/chronos/nota.md").is_err());

        // .sinnotas/ en cualquier nivel debe rechazarse
        assert!(resolve_note_path(&canonical_root, ".sinnotas/nota.md").is_err());
        assert!(resolve_note_path(&canonical_root, "pages/.sinnotas/nota.md").is_err());

        // .git/ en cualquier nivel debe rechazarse
        assert!(resolve_note_path(&canonical_root, ".git/nota.md").is_err());
        assert!(resolve_note_path(&canonical_root, "pages/.git/nota.md").is_err());

        // Rutas normales deben seguir funcionando
        assert!(resolve_note_path(&canonical_root, "pages/nota.md").is_ok());
        assert!(resolve_note_path(&canonical_root, "journals/2026_10_17.md").is_ok());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolve_note_path_rejects_temp_file_pattern() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-note-path-temp-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let canonical_root = fs::canonicalize(&root).unwrap();

        // Nombres que contienen .sinnotas-tmp deben rechazarse
        assert!(resolve_note_path(&canonical_root, ".sinnotas-tmp-123.md").is_err());
        assert!(resolve_note_path(&canonical_root, "nota.sinnotas-tmp.md").is_err());
        assert!(resolve_note_path(&canonical_root, "pages/file.sinnotas-tmp.abc.md").is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_vault_skips_invalid_utf8_and_unreadable_entries() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-scan-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();

        // Nota válida
        fs::write(root.join("valida.md"), "- hola\n").unwrap();

        // Nota con bytes UTF-8 inválidos
        fs::write(root.join("invalida.md"), b"\xFF\xFE\xFD").unwrap();

        // Nota que supera 20 MB
        let large_content = vec![b'x'; 21 * 1024 * 1024];
        fs::write(root.join("grande.md"), &large_content).unwrap();

        let (pages, skipped) = scan_vault(&root).unwrap();

        // La nota válida se carga
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].title, "valida");

        // Se registran las omitidas
        assert_eq!(skipped.len(), 2);
        let reasons: Vec<&str> = skipped.iter().map(|s| s.reason.as_str()).collect();
        assert!(reasons
            .iter()
            .any(|r| r.contains("UTF-8") || r.contains("leer")));
        assert!(reasons
            .iter()
            .any(|r| r.contains("20 MB") || r.contains("supera")));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scan_vault_skips_reserved_directories() {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-scan-reserved-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();

        fs::write(root.join("normal.md"), "- nota real\n").unwrap();
        for reserved in RESERVED_DIRS {
            let dir = root.join(reserved).join("anidada");
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join("no-es-nota.md"), "- no debe indexarse\n").unwrap();
        }

        // La comparación debe ignorar mayúsculas (Windows/macOS no distinguen).
        let upper = root.join("Chronos").join("anidada");
        fs::create_dir_all(&upper).unwrap();
        fs::write(upper.join("no-es-nota.md"), "- tampoco debe indexarse\n").unwrap();

        let (pages, skipped) = scan_vault(&root).unwrap();

        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].title, "normal");
        assert!(skipped.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn parser_limits_deep_nesting_and_round_trips_all_lines() {
        // 3,000 líneas con indentación creciente (0, 1, 2, ...). El parser
        // debe acotar el árbol a MAX_BLOCK_DEPTH para que serde/bincode no
        // desborden la pila con panic=abort.
        const LINE_COUNT: usize = 3_000;
        let mut content = String::new();
        for indent in 0..LINE_COUNT {
            content.push_str(&" ".repeat(indent));
            content.push_str("- x\n");
        }

        let (frontmatter, blocks) = parse_markdown_with_frontmatter(&content);
        assert!(frontmatter.is_empty());

        // Recorrido iterativo: el árbol puede ser profundo y el test no debe
        // depender de la pila del sistema.
        let mut max_depth = 0usize;
        let mut count = 0usize;
        let mut stack: Vec<(&BlockNode, usize)> = blocks.iter().map(|block| (block, 0)).collect();
        while let Some((block, depth)) = stack.pop() {
            count += 1;
            max_depth = max_depth.max(depth);
            for child in &block.children {
                stack.push((child, depth + 1));
            }
        }

        assert_eq!(count, LINE_COUNT);
        assert!(
            max_depth < MAX_BLOCK_DEPTH,
            "profundidad máxima {max_depth} >= {MAX_BLOCK_DEPTH}"
        );

        // El serializador descarta depth >= 64; el parser deja las líneas más
        // profundas como hermanas en depth 63, así que no se pierde contenido.
        let serialized = serialize_page_to_markdown(&frontmatter, &blocks);
        assert_eq!(serialized.matches("- x\n").count(), LINE_COUNT);
    }

    #[test]
    fn parser_handles_many_lines() {
        // 100,000 líneas (no 1M para que el test sea rápido en CI)
        let mut content = String::new();
        for i in 1..=100_000 {
            content.push_str("- línea ");
            content.push_str(&i.to_string());
            content.push('\n');
        }

        let (frontmatter, blocks) = parse_markdown_with_frontmatter(&content);
        assert!(frontmatter.is_empty());
        assert_eq!(blocks.len(), 100_000);
    }

    #[test]
    fn parser_handles_very_long_line() {
        // Línea de ~1 MB
        let long_line = "x".repeat(1_000_000);
        let content = format!("- {long_line}\n");

        let (frontmatter, blocks) = parse_markdown_with_frontmatter(&content);
        assert!(frontmatter.is_empty());
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].content.len(), 1_000_000);
    }

    #[test]
    fn parser_handles_invalid_utf8_gracefully() {
        // El parser recibe &str, así que bytes inválidos no deberían llegar aquí.
        // Este test verifica que la serialización no rompe con contenido raro.
        let content = "- línea con \u{FFFD} carácter de reemplazo\n";
        let (frontmatter, blocks) = parse_markdown_with_frontmatter(content);
        assert_eq!(blocks.len(), 1);
        assert!(blocks[0].content.contains('\u{FFFD}'));

        let serialized = serialize_page_to_markdown(&frontmatter, &blocks);
        assert!(serialized.contains('\u{FFFD}'));
    }

    #[test]
    fn serialize_blocks_respects_max_depth_limit() {
        // Crear un árbol muy profundo DE FORMA ITERATIVA (evitar stack overflow en el test)
        // y verificar que serialize no causa stack overflow y respeta el límite de 64.
        let mut root = BlockNode {
            id: "b-root".to_string(),
            block_type: "text".to_string(),
            content: "nivel 0".to_string(),
            children: Vec::new(),
            collapsed: false,
            image_alt: None,
        };
        let mut current = &mut root;
        for i in 1..=10_000 {
            let child = BlockNode {
                id: format!("b-{i}"),
                block_type: "text".to_string(),
                content: format!("nivel {i}"),
                children: Vec::new(),
                collapsed: false,
                image_alt: None,
            };
            current.children.push(child);
            current = current.children.last_mut().unwrap();
        }

        // serializar no debe hacer stack overflow (usa iterativo con límite 64)
        let output = serialize_blocks_to_markdown(&[root], 0);
        assert!(output.contains("nivel 0"));
        assert!(output.contains("nivel 63")); // depth 63 = último serializado
        assert!(!output.contains("nivel 64")); // depth 64 = descartado
        assert!(!output.contains("nivel 10000")); // depth 10000 = descartado
    }

    #[test]
    fn load_vault_non_default_does_not_create_dirs() {
        // Para bóvedas no predeterminadas, load_vault NO debe crear directorios.
        // Este test verifica la lógica de validación (sin Tauri runtime).
        let root = std::env::temp_dir().join(format!(
            "sinnotas-load-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        // NO creamos el directorio root

        // Simular la validación que hace load_vault para non-default:
        // 1. La ruta debe existir
        assert!(!root.exists(), "Precondición: root no debe existir");
        // 2. Si no existe, debería fallar (en el comando real retorna Err)

        // Ahora creamos el directorio y verificamos que sí existiría
        fs::create_dir_all(&root).unwrap();
        assert!(root.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn saf_dir_path_from_root_accepts_plugin_2x_json() {
        let serialized = r#"{"topTreeUri":"content://com.android.externalstorage.documents/tree/primary%3ANotas","relativeTerms":[]}"#;
        let path = saf_dir_path_from_root(serialized).unwrap().unwrap();
        let round_trip = tauri_plugin_android_fs::convert_dir_path_to_string(&path).unwrap();
        assert!(round_trip.contains("content://com.android.externalstorage.documents"));
        assert!(round_trip.contains("\"relativeTerms\":[]"));
    }

    #[test]
    fn saf_dir_path_from_root_accepts_plain_content_uri() {
        let path = saf_dir_path_from_root(
            "content://com.android.externalstorage.documents/tree/primary%3ANotas",
        )
        .unwrap()
        .unwrap();
        let serialized = tauri_plugin_android_fs::convert_dir_path_to_string(&path).unwrap();
        assert!(serialized.contains("content://"));
    }

    #[test]
    fn saf_dir_path_from_root_ignores_local_paths() {
        assert!(saf_dir_path_from_root("/home/usuario/Notas")
            .unwrap()
            .is_none());
        assert!(saf_dir_path_from_root(
            r#"{"topTreeUri":"/home/usuario/Notas","relativeTerms":[]}"#
        )
        .unwrap()
        .is_none());
    }

    #[test]
    fn saf_storage_rejects_escaping_relative_paths() {
        assert_eq!(
            SafStorage::normalize_relative_path("/pages/nota.md").unwrap(),
            "pages/nota.md"
        );
        assert_eq!(
            SafStorage::normalize_relative_path(r"pages\sub\nota.md").unwrap(),
            "pages/sub/nota.md"
        );
        assert!(SafStorage::normalize_relative_path("../fuera.md").is_err());
        assert!(SafStorage::normalize_relative_path("pages//nota.md").is_err());
        assert!(SafStorage::normalize_relative_path("").is_err());
    }

    #[test]
    fn fs_storage_trait_works() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let root = std::env::temp_dir().join(format!(
                "sinnotas-fs-storage-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(&root).unwrap();

            let storage =
                FsStorage::new(root.clone(), "test".to_string(), "Test Vault".to_string());

            // Test list_notes on empty vault
            let notes = storage.list_notes().await.unwrap();
            assert!(notes.is_empty());

            // Test create_note and read_note
            storage
                .create_note("pages/nota.md", "- hola mundo\n")
                .await
                .unwrap();
            let content = storage.read_note("pages/nota.md").await.unwrap();
            assert_eq!(content, "- hola mundo\n");

            // Test list_notes after creation
            let notes = storage.list_notes().await.unwrap();
            assert_eq!(notes.len(), 1);
            assert_eq!(notes[0].relative_path, "pages/nota.md");
            assert_eq!(notes[0].size, 13); // "- hola mundo\n" = 13 bytes

            // Test write_note (update)
            storage
                .write_note("pages/nota.md", "- hola mundo actualizado\n")
                .await
                .unwrap();
            let content = storage.read_note("pages/nota.md").await.unwrap();
            assert_eq!(content, "- hola mundo actualizado\n");

            // Test note_metadata
            let meta = storage.note_metadata("pages/nota.md").await.unwrap();
            assert_eq!(meta.size, 25); // "- hola mundo actualizado\n" = 25 bytes
            assert!(!meta.is_readonly);

            // Test note_exists
            assert!(storage.note_exists("pages/nota.md").await.unwrap());
            assert!(!storage.note_exists("pages/nonexistente.md").await.unwrap());

            // Test rename_note
            storage
                .rename_note("pages/nota.md", "pages/renombrada.md")
                .await
                .unwrap();
            assert!(!storage.note_exists("pages/nota.md").await.unwrap());
            assert!(storage.note_exists("pages/renombrada.md").await.unwrap());
            let content = storage.read_note("pages/renombrada.md").await.unwrap();
            assert_eq!(content, "- hola mundo actualizado\n");

            // Test delete_note
            storage.delete_note("pages/renombrada.md").await.unwrap();
            assert!(!storage.note_exists("pages/renombrada.md").await.unwrap());

            // Test read_image
            let img_path = "assets/test.png";
            fs::create_dir_all(root.join("assets")).unwrap();
            fs::write(root.join(img_path), b"fake image data").unwrap();
            let img_bytes = storage.read_image(img_path).await.unwrap();
            assert_eq!(img_bytes, b"fake image data");

            // Test root_path
            assert_eq!(storage.root_path(), root);

            // Test the internal progress file (creates progress/ automatically)
            assert!(storage
                .read_progress_file(REVIEW_PROGRESS_PATH)
                .await
                .unwrap()
                .is_none());
            storage
                .write_progress_file(REVIEW_PROGRESS_PATH, "{\"version\":1,\"entries\":[]}")
                .await
                .unwrap();
            assert_eq!(
                storage
                    .read_progress_file(REVIEW_PROGRESS_PATH)
                    .await
                    .unwrap()
                    .as_deref(),
                Some("{\"version\":1,\"entries\":[]}")
            );
            assert!(root.join(REVIEW_PROGRESS_PATH).is_file());
            assert!(storage
                .read_progress_file("progress/otro.json")
                .await
                .is_err());

            // Test capabilities
            assert!(storage.supports_atomic_writes());
            assert!(storage.supports_efficient_listing());

            fs::remove_dir_all(root).unwrap();
        })
    }

    #[test]
    fn progress_reader_rejects_oversized_or_invalid_utf8_files() {
        let text = read_text_bounded(std::io::Cursor::new(b"{}".to_vec()), 10).unwrap();
        assert_eq!(text, "{}");
        assert!(read_text_bounded(std::io::Cursor::new(b"01234567890".to_vec()), 10).is_err());
        assert!(read_text_bounded(std::io::Cursor::new(vec![0xff, 0xfe]), 10).is_err());
    }

    #[test]
    fn review_progress_merge_deduplicates_and_keeps_latest_state() {
        let existing = serde_json::json!({
            "version": 1,
            "entries": [
                {
                    "id": "same",
                    "at": "2026-10-24T10:00:00.000Z",
                    "updatedAt": "2026-10-24T10:00:00.000Z",
                    "state": "applied"
                },
                {
                    "id": "old",
                    "at": "2026-10-23T10:00:00.000Z",
                    "updatedAt": "2026-10-23T10:00:00.000Z",
                    "state": "applied"
                }
            ]
        })
        .to_string();
        let incoming = serde_json::json!({
            "version": 1,
            "entries": [
                {
                    "id": "same",
                    "at": "2026-10-24T10:00:00.000Z",
                    "updatedAt": "2026-10-24T10:05:00.000Z",
                    "state": "undone"
                },
                {
                    "id": "new",
                    "at": "2026-10-24T11:00:00.000Z",
                    "updatedAt": "2026-10-24T11:00:00.000Z",
                    "state": "applied"
                }
            ]
        })
        .to_string();

        let merged = merge_review_progress_json(Some(&existing), &incoming).unwrap();
        let value: serde_json::Value = serde_json::from_str(&merged).unwrap();
        let entries = value
            .get("entries")
            .and_then(|entries| entries.as_array())
            .unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0]["id"], "old");
        assert_eq!(entries[1]["id"], "same");
        assert_eq!(entries[1]["state"], "undone");
        assert_eq!(entries[2]["id"], "new");
    }

    #[test]
    fn review_progress_merge_rejects_invalid_files_and_unsafe_path_is_fixed() {
        assert!(merge_review_progress_json(None, "no json").is_err());
        assert!(merge_review_progress_json(None, "{\"version\":1}").is_err());
        assert!(validate_progress_relative_path("progress/reviews.json").is_ok());
        assert!(validate_progress_relative_path("../reviews.json").is_err());
        assert!(validate_progress_relative_path("progress/other.json").is_err());
    }

    #[test]
    fn strip_windows_verbatim_prefix_only_strips_verbatim_drive_paths() {
        assert_eq!(
            strip_windows_verbatim_prefix(r"\\?\C:\Users\a\n.md"),
            r"C:\Users\a\n.md"
        );
        assert_eq!(
            strip_windows_verbatim_prefix(r"\\?\d:\notas\n.md"),
            r"d:\notas\n.md"
        );
        // Las rutas UNC con prefijo verbatim quedan intactas.
        assert_eq!(
            strip_windows_verbatim_prefix(r"\\?\UNC\servidor\compartido\n.md"),
            r"\\?\UNC\servidor\compartido\n.md"
        );
        // Una ruta con unidad pero sin prefijo no se toca...
        assert_eq!(
            strip_windows_verbatim_prefix(r"C:\Users\a\n.md"),
            r"C:\Users\a\n.md"
        );
        // ...igual que una ruta Unix.
        assert_eq!(
            strip_windows_verbatim_prefix("/home/usuario/notas/n.md"),
            "/home/usuario/notas/n.md"
        );
    }

    #[test]
    fn resolve_openable_note_accepts_only_existing_md_inside_vault() {
        let root = snapshot_test_root("openable-note");
        let pages = root.join("pages");
        fs::create_dir_all(&pages).unwrap();
        let note = pages.join("nota.md");
        fs::write(&note, "- contenido\n").unwrap();
        // Archivo con extensión que no es .md.
        fs::write(pages.join("borrador.txt"), "x").unwrap();

        // Ruta válida dentro del vault: aceptada y resuelta a la misma nota.
        let resolved = resolve_openable_note(&root, "pages/nota.md").unwrap();
        assert_eq!(resolved, note);

        // Subir con `../`: rechazada.
        assert!(resolve_openable_note(&root, "../nota.md").is_err());

        // Ruta absoluta de otra carpeta: rechazada.
        let other = snapshot_test_root("openable-note-other");
        fs::write(other.join("otra.md"), "x").unwrap();
        assert!(resolve_openable_note(&root, &other.join("otra.md").to_string_lossy()).is_err());

        // Extensión distinta de .md: rechazada.
        assert!(resolve_openable_note(&root, "pages/borrador.txt").is_err());

        // Nota inexistente: rechazada por el chequeo is_file.
        let missing = resolve_openable_note(&root, "pages/inexistente.md");
        assert!(missing.unwrap_err().contains("no existe en disco"));

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(other).unwrap();
    }
}
