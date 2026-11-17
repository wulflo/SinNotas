//! Descubrimiento, validación y enlace de documentos PDF.
//!
//! La importación **no copia** el PDF dentro del vault: guarda un enlace al
//! archivo original en `.sinnotas/documents/links.json`. Así el usuario sigue
//! siendo dueño de su documento y no se duplica espacio en disco. Los PDFs que
//! ya vivían en `assets/pdfs/` se siguen listando por compatibilidad.

use super::PdfListItem;
use crate::{resolve_vault_path, write_file_atomically, SavedImagePath};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const PDF_FOLDER: &str = "assets/pdfs";
const CAPTURE_FOLDER: &str = "assets/pdf-captures";
const LINKS_FOLDER: &str = ".sinnotas/documents";
const LINKS_FILE: &str = "links.json";
const MAX_PDF_BYTES: u64 = 250 * 1024 * 1024;
const MAX_LINK_REGISTRY_BYTES: usize = 4 * 1024 * 1024;
const MAX_LINKS: usize = 10_000;
const DAY_MS: i64 = 24 * 60 * 60 * 1000;

/// Serializa las escrituras del registro de enlaces para no perder altas
/// cuando dos importaciones terminan a la vez.
static LINK_REGISTRY_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkedDocument {
    id: String,
    /// Ruta absoluta del PDF original, tal como la eligió el usuario.
    path: String,
    title: String,
    /// Milisegundos desde Unix epoch.
    added: i64,
    /// Milisegundos desde Unix epoch; `None` significa sin caducidad.
    #[serde(default)]
    expires_at: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkRegistry {
    #[serde(default)]
    links: Vec<LinkedDocument>,
}

/// Documento resuelto listo para abrir con PDFium.
pub(crate) struct ResolvedDocument {
    pub path: PathBuf,
    pub relative_path: String,
    pub title: Option<String>,
    pub linked: bool,
    pub expires_at: Option<i64>,
}

pub(crate) fn modified_ms(metadata: &fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn expiry_from_days(days: Option<u32>) -> Option<i64> {
    days.map(|days| now_ms() + (days as i64) * DAY_MS)
}

fn is_expired(expires_at: Option<i64>, now: i64) -> bool {
    expires_at
        .map(|expires_at| expires_at <= now)
        .unwrap_or(false)
}

fn is_pdf_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

/// Un enlace del registro apunta a un archivo externo elegido por el usuario.
/// Solo se aceptan rutas absolutas, sin `..`, que resuelvan a un PDF real.
fn resolve_linked_pdf(raw_path: &str) -> Result<PathBuf, String> {
    if raw_path.trim().is_empty() {
        return Err("El enlace no tiene una ruta válida.".to_string());
    }
    if raw_path.contains('\0') {
        return Err("La ruta del enlace contiene caracteres no permitidos.".to_string());
    }

    let requested = Path::new(raw_path);
    if !requested.is_absolute() {
        return Err("La ruta del enlace debe ser absoluta.".to_string());
    }
    if requested
        .components()
        .any(|part| matches!(part, Component::ParentDir))
    {
        return Err("La ruta del enlace no puede contener '..'.".to_string());
    }

    let path = fs::canonicalize(requested)
        .map_err(|_| "El documento enlazado ya no está disponible.".to_string())?;
    if !path.is_file() {
        return Err("El documento enlazado no es un archivo.".to_string());
    }
    if !is_pdf_path(&path) {
        return Err("El documento enlazado ya no es un PDF.".to_string());
    }
    Ok(path)
}

fn relative_from_root(root: &Path, path: &Path) -> Result<String, String> {
    path.strip_prefix(root)
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        .map_err(|_| "El PDF está fuera del vault activo.".to_string())
}

fn link_relative_path(id: &str) -> String {
    format!("link:{id}")
}

/// Los identificadores son UUID v4; cualquier otro valor se rechaza para que
/// el frontend nunca pueda inyectar rutas arbitrarias por esta vía.
fn link_id_from_request(requested: &str) -> Option<&str> {
    let id = requested.trim().strip_prefix("link:")?;
    if id.is_empty()
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return None;
    }
    Some(id)
}

/// Ruta lógica del registro. Solo se usa en tests; las lecturas y escrituras
/// pasan por `resolve_registry_path` para validar symlinks.
#[cfg(test)]
fn registry_path(root: &Path) -> PathBuf {
    root.join(LINKS_FOLDER).join(LINKS_FILE)
}

/// Resuelve una ruta interna del lector PDF sin seguir enlaces que salgan del
/// vault. Es la única puerta para el registro y las capturas.
fn resolve_pdf_internal_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    resolve_vault_path(root, relative_path)
}

fn resolve_registry_path(root: &Path) -> Result<PathBuf, String> {
    resolve_pdf_internal_path(root, &format!("{LINKS_FOLDER}/{LINKS_FILE}"))
}

fn load_registry(root: &Path) -> Result<LinkRegistry, String> {
    let path = resolve_registry_path(root)?;
    let file = match fs::File::open(&path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LinkRegistry::default());
        }
        Err(error) => {
            return Err(format!(
                "No se pudo leer el registro de documentos enlazados ({}): {error}",
                path.display()
            ));
        }
    };
    let mut contents = String::new();
    file.take((MAX_LINK_REGISTRY_BYTES + 1) as u64)
        .read_to_string(&mut contents)
        .map_err(|error| {
            format!(
                "No se pudo leer el registro de documentos enlazados ({}): {error}",
                path.display()
            )
        })?;
    if contents.len() > MAX_LINK_REGISTRY_BYTES {
        return Err(
            "El registro de documentos enlazados supera el tamaño máximo permitido.".to_string(),
        );
    }
    let registry: LinkRegistry = serde_json::from_str(&contents).map_err(|error| {
        format!(
            "No se pudo leer el registro de documentos enlazados ({}): {error}",
            path.display()
        )
    })?;
    if registry.links.len() > MAX_LINKS {
        return Err(
            "El registro de documentos enlazados supera el número máximo de entradas.".to_string(),
        );
    }
    Ok(registry)
}

fn save_registry(root: &Path, registry: &LinkRegistry) -> Result<(), String> {
    if registry.links.len() > MAX_LINKS {
        return Err(
            "El registro de documentos enlazados supera el número máximo de entradas.".to_string(),
        );
    }
    let contents = serde_json::to_string_pretty(registry)
        .map_err(|error| format!("No se pudo serializar el registro de documentos: {error}"))?;
    if contents.len() > MAX_LINK_REGISTRY_BYTES {
        return Err(
            "El registro de documentos enlazados supera el tamaño máximo permitido.".to_string(),
        );
    }
    let path = resolve_registry_path(root)?;
    write_file_atomically(&path, &contents)
}

fn document_title(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_stem)
        .unwrap_or_else(|| "Documento".to_string())
}

fn sanitize_stem(stem: &str) -> String {
    let mut sanitized = String::with_capacity(stem.len());
    for character in stem.chars() {
        if character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
        {
            sanitized.push('_');
        } else {
            sanitized.push(character);
        }
    }

    let trimmed = sanitized.trim().trim_matches('.').trim();
    let limited: String = trimmed.chars().take(120).collect();
    if limited.is_empty() {
        "Documento".to_string()
    } else {
        limited
    }
}

fn validate_pdf_source(source: &Path) -> Result<u64, String> {
    if !source.is_file() {
        return Err("El archivo seleccionado no existe o no es un archivo.".to_string());
    }
    if !is_pdf_path(source) {
        return Err("Solo se pueden enlazar archivos PDF.".to_string());
    }

    let metadata = fs::metadata(source).map_err(|error| error.to_string())?;
    if metadata.len() == 0 {
        return Err("El PDF está vacío.".to_string());
    }
    if metadata.len() > MAX_PDF_BYTES {
        return Err("El PDF supera el límite de 250 MB.".to_string());
    }

    let mut file = fs::File::open(source).map_err(|error| error.to_string())?;
    let mut header = [0_u8; 1024];
    let header_len = file.read(&mut header).map_err(|error| error.to_string())?;
    // La especificación permite un prefijo antes de `%PDF-`; por eso se busca
    // dentro de los primeros 1024 bytes y no solo en el byte 0.
    if header_len < 5
        || !header[..header_len]
            .windows(5)
            .any(|bytes| bytes == b"%PDF-")
    {
        return Err("El archivo seleccionado no parece un PDF válido.".to_string());
    }

    Ok(metadata.len())
}

/// Lista los PDFs de `assets/pdfs/` y los documentos enlazados fuera del vault.
pub(crate) fn list(root: &Path) -> Result<Vec<PdfListItem>, String> {
    let canonical_root =
        fs::canonicalize(root).map_err(|_| "El vault activo no está disponible.".to_string())?;
    let mut items = Vec::new();

    let pdfs_dir = canonical_root.join(PDF_FOLDER);
    if pdfs_dir.exists() {
        let canonical_pdfs = fs::canonicalize(&pdfs_dir).map_err(|error| error.to_string())?;
        if !canonical_pdfs.starts_with(&canonical_root) || !canonical_pdfs.is_dir() {
            return Err("La carpeta de PDFs no pertenece al vault activo.".to_string());
        }

        for entry in fs::read_dir(&canonical_pdfs).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path.is_file() || !is_pdf_path(&path) {
                continue;
            }
            let canonical_path = match fs::canonicalize(&path) {
                Ok(path) if path.starts_with(&canonical_root) => path,
                _ => continue,
            };
            let metadata = match fs::metadata(&canonical_path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            let relative_path = relative_from_root(&canonical_root, &canonical_path)?;
            items.push(PdfListItem {
                relative_path,
                title: document_title(&canonical_path),
                file_size: metadata.len(),
                modified: modified_ms(&metadata),
                linked: false,
                missing: false,
                expires_at: None,
            });
        }
    }

    let now = now_ms();
    let links = {
        let _guard = LINK_REGISTRY_LOCK
            .lock()
            .map_err(|_| "El registro de documentos no está disponible.".to_string())?;
        let mut registry = load_registry(&canonical_root)?;
        let previous_len = registry.links.len();
        registry
            .links
            .retain(|link| !is_expired(link.expires_at, now));
        if registry.links.len() != previous_len {
            save_registry(&canonical_root, &registry)?;
        }
        registry.links
    };

    for link in links {
        let resolved = resolve_linked_pdf(&link.path).ok();
        let metadata = resolved.as_ref().and_then(|path| fs::metadata(path).ok());
        let missing = metadata.is_none();
        items.push(PdfListItem {
            relative_path: link_relative_path(&link.id),
            title: link.title,
            file_size: metadata
                .as_ref()
                .map(|metadata| metadata.len())
                .unwrap_or(0),
            modified: metadata.as_ref().map(modified_ms).unwrap_or(link.added),
            linked: true,
            missing,
            expires_at: link.expires_at,
        });
    }

    items.sort_by(|left, right| {
        left.title
            .to_lowercase()
            .cmp(&right.title.to_lowercase())
            .then_with(|| left.relative_path.cmp(&right.relative_path))
    });
    Ok(items)
}

/// Resuelve una ruta relativa del frontend a un PDF real dentro del vault.
pub(crate) fn resolve_pdf(root: &Path, requested_path: &str) -> Result<(PathBuf, String), String> {
    let trimmed = requested_path.trim();
    if trimmed.is_empty() {
        return Err("No se indicó ningún PDF.".to_string());
    }
    if Path::new(trimmed).is_absolute() {
        return Err("La ruta del PDF debe ser relativa al vault.".to_string());
    }
    if !is_pdf_path(Path::new(trimmed)) {
        return Err("La ruta no corresponde a un archivo PDF.".to_string());
    }

    let canonical_root =
        fs::canonicalize(root).map_err(|_| "El vault activo no está disponible.".to_string())?;
    let resolved = resolve_vault_path(&canonical_root, trimmed)?;
    let canonical_path = fs::canonicalize(&resolved).map_err(|error| error.to_string())?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("El PDF está fuera del vault activo.".to_string());
    }
    if !canonical_path.is_file() {
        return Err("La ruta del PDF no es un archivo.".to_string());
    }

    let relative_path = relative_from_root(&canonical_root, &canonical_path)?;
    Ok((canonical_path, relative_path))
}

fn find_link(root: &Path, id: &str) -> Result<LinkedDocument, String> {
    let guard = LINK_REGISTRY_LOCK
        .lock()
        .map_err(|_| "El registro de documentos no está disponible.".to_string())?;
    let registry = load_registry(root)?;
    drop(guard);
    let link = registry
        .links
        .into_iter()
        .find(|link| link.id == id)
        .ok_or_else(|| "El documento enlazado ya no está registrado.".to_string())?;
    if is_expired(link.expires_at, now_ms()) {
        return Err("El enlace a este documento ha caducado.".to_string());
    }
    Ok(link)
}

/// Resuelve un documento del vault (`assets/pdfs/...`) o un enlace externo
/// (`link:<uuid>`). Los enlaces solo se resuelven desde el registro interno.
pub(crate) fn resolve_document(
    root: &Path,
    requested_path: &str,
) -> Result<ResolvedDocument, String> {
    if let Some(id) = link_id_from_request(requested_path) {
        let link = find_link(root, id)?;
        let path = resolve_linked_pdf(&link.path)?;
        return Ok(ResolvedDocument {
            path,
            relative_path: link_relative_path(id),
            title: Some(link.title),
            linked: true,
            expires_at: link.expires_at,
        });
    }

    let (path, relative_path) = resolve_pdf(root, requested_path)?;
    Ok(ResolvedDocument {
        path,
        relative_path,
        title: None,
        linked: false,
        expires_at: None,
    })
}

/// Resuelve un documento y revalida el archivo antes de entregarlo a PDFium.
/// Se usa al abrir, renderizar o extraer texto; borrar no pasa por aquí para
/// permitir retirar copias dañadas de `assets/pdfs/`.
pub(crate) fn resolve_document_for_open(
    root: &Path,
    requested_path: &str,
) -> Result<ResolvedDocument, String> {
    let resolved = resolve_document(root, requested_path)?;
    validate_pdf_source(&resolved.path)?;
    Ok(resolved)
}

/// Guarda un enlace al PDF externo sin copiarlo dentro del vault.
///
/// Devuelve la ruta interna (`link:<uuid>`) que usará el lector. Si el mismo
/// archivo ya estaba enlazado se reutiliza su entrada.
pub(crate) fn link_pdf(
    root: &Path,
    source: &Path,
    keep_days: Option<u32>,
) -> Result<String, String> {
    validate_pdf_source(source)?;

    let canonical_source = fs::canonicalize(source)
        .map_err(|error| format!("No se pudo resolver el PDF seleccionado: {error}"))?;
    let source_path = canonical_source.to_string_lossy().to_string();

    // Si el PDF ya vive en la carpeta de la biblioteca del vault no hace falta
    // registrar un enlace: se devuelve su ruta relativa para no duplicarlo.
    if let Ok(canonical_root) = fs::canonicalize(root) {
        if canonical_source.starts_with(&canonical_root) {
            let relative = relative_from_root(&canonical_root, &canonical_source)?;
            if relative.starts_with(&format!("{PDF_FOLDER}/")) {
                return Ok(relative);
            }
        }
    }

    let guard = LINK_REGISTRY_LOCK
        .lock()
        .map_err(|_| "El registro de documentos no está disponible.".to_string())?;
    let mut registry = load_registry(root)?;
    if let Some(existing) = registry
        .links
        .iter_mut()
        .find(|link| link.path == source_path)
    {
        existing.expires_at = expiry_from_days(keep_days);
        let id = existing.id.clone();
        save_registry(root, &registry)?;
        drop(guard);
        return Ok(link_relative_path(&id));
    }

    let id = uuid::Uuid::new_v4().to_string();
    registry.links.push(LinkedDocument {
        id: id.clone(),
        path: source_path,
        title: document_title(&canonical_source),
        added: now_ms(),
        expires_at: expiry_from_days(keep_days),
    });
    save_registry(root, &registry)?;
    drop(guard);

    Ok(link_relative_path(&id))
}

/// Quita un enlace del registro. Nunca borra el archivo original.
pub(crate) fn unlink(root: &Path, requested_path: &str) -> Result<bool, String> {
    let id = link_id_from_request(requested_path)
        .ok_or_else(|| "Solo se pueden quitar documentos enlazados.".to_string())?;

    let guard = LINK_REGISTRY_LOCK
        .lock()
        .map_err(|_| "El registro de documentos no está disponible.".to_string())?;
    let mut registry = load_registry(root)?;
    let previous_len = registry.links.len();
    registry.links.retain(|link| link.id != id);
    if registry.links.len() == previous_len {
        return Ok(false);
    }
    save_registry(root, &registry)?;
    drop(guard);
    Ok(true)
}

/// Cambia la caducidad de un enlace. `keep_days = None` lo deja sin caducidad.
pub(crate) fn set_expiry(
    root: &Path,
    requested_path: &str,
    keep_days: Option<u32>,
) -> Result<bool, String> {
    let id = link_id_from_request(requested_path).ok_or_else(|| {
        "Solo se puede programar la caducidad de documentos enlazados.".to_string()
    })?;

    let guard = LINK_REGISTRY_LOCK
        .lock()
        .map_err(|_| "El registro de documentos no está disponible.".to_string())?;
    let mut registry = load_registry(root)?;
    let link = registry
        .links
        .iter_mut()
        .find(|link| link.id == id)
        .ok_or_else(|| "El documento enlazado ya no está registrado.".to_string())?;
    link.expires_at = expiry_from_days(keep_days);
    save_registry(root, &registry)?;
    drop(guard);
    Ok(true)
}

/// Elimina un documento de la biblioteca.
///
/// Para enlaces externos solo borra el registro; el PDF original nunca se toca.
/// Para copias dentro del vault únicamente permite borrar archivos que vivan en
/// `assets/pdfs/`.
pub(crate) fn delete_document(root: &Path, requested_path: &str) -> Result<bool, String> {
    if link_id_from_request(requested_path).is_some() {
        return unlink(root, requested_path);
    }

    let (path, relative_path) = resolve_pdf(root, requested_path)?;
    if !relative_path.starts_with(&format!("{PDF_FOLDER}/")) {
        return Err("Solo se pueden borrar PDFs de la biblioteca del vault.".to_string());
    }
    fs::remove_file(&path).map_err(|error| format!("No se pudo borrar el PDF: {error}"))?;
    Ok(true)
}

/// Crea el archivo de captura sin seguir symlinks ni sobrescribir uno existente.
fn create_capture_file(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)?;
    if let Err(error) = file.write_all(bytes) {
        drop(file);
        let _ = fs::remove_file(target);
        return Err(error);
    }
    Ok(())
}

/// Guarda una captura de una región de PDF en `assets/pdf-captures/`.
pub(crate) fn save_capture(
    root: &Path,
    file_name: &str,
    bytes: &[u8],
) -> Result<SavedImagePath, String> {
    crate::validate_image_file(file_name, bytes)?;
    let requested = Path::new(file_name);
    if requested.file_name().and_then(|value| value.to_str()) != Some(file_name) {
        return Err("El nombre de la captura no es válido.".to_string());
    }
    let stem = requested
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Captura".to_string());
    let extension = requested
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png")
        .to_ascii_lowercase();

    let folder = resolve_pdf_internal_path(root, CAPTURE_FOLDER)?;
    fs::create_dir_all(&folder)
        .map_err(|error| format!("No se pudo preparar la carpeta de capturas: {error}"))?;

    let base = format!("capture_{}_{}", now_ms(), stem);
    for suffix in 0..10_000 {
        let name = if suffix == 0 {
            format!("{base}.{extension}")
        } else {
            format!("{base}_{}.{extension}", suffix + 1)
        };
        let relative_path = format!("{CAPTURE_FOLDER}/{name}");
        let target = resolve_pdf_internal_path(root, &relative_path)?;
        match create_capture_file(&target, bytes) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!("No se pudo guardar la captura: {error}"));
            }
        }

        let absolute_path = fs::canonicalize(&target)
            .map_err(|error| format!("No se pudo guardar la captura: {error}"))?;
        return Ok(SavedImagePath {
            relative_path,
            absolute_path: absolute_path.to_string_lossy().to_string(),
        });
    }

    Err("No se pudo encontrar un nombre único para la captura.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_PNG: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];

    fn test_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "sinnotas-pdf-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn registry_rejects_oversized_files_and_too_many_links() {
        let root = test_dir("registry-limits");
        let registry_file = registry_path(&root);
        fs::create_dir_all(registry_file.parent().unwrap()).unwrap();
        fs::write(&registry_file, vec![b' '; MAX_LINK_REGISTRY_BYTES + 1]).unwrap();
        assert!(load_registry(&root).is_err());

        let registry = LinkRegistry {
            links: (0..=MAX_LINKS)
                .map(|index| LinkedDocument {
                    id: format!("link-{index}"),
                    path: format!("/tmp/{index}.pdf"),
                    title: format!("Documento {index}"),
                    added: 0,
                    expires_at: None,
                })
                .collect(),
        };
        let contents = serde_json::to_vec(&registry).unwrap();
        assert!(contents.len() <= MAX_LINK_REGISTRY_BYTES);
        fs::write(&registry_file, contents).unwrap();
        assert!(load_registry(&root).is_err());
        assert!(save_registry(&root, &registry).is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn sanitize_stem_removes_path_and_windows_characters() {
        assert_eq!(sanitize_stem("  Mi:PDF?. "), "Mi_PDF_");
        assert_eq!(sanitize_stem("..."), "Documento");
    }

    #[test]
    fn rejects_non_pdf_paths() {
        let root = std::env::temp_dir();
        assert!(resolve_pdf(&root, "assets/pdfs/libro.txt").is_err());
        assert!(resolve_pdf(&root, "../libro.pdf").is_err());
        assert!(resolve_pdf(&root, "/tmp/libro.pdf").is_err());
    }

    #[test]
    fn linked_registry_paths_must_be_absolute_and_without_parent_dir() {
        let base = test_dir("linked-registry-paths");
        let vault = base.join("vault");
        fs::create_dir_all(&vault).unwrap();
        let source = base.join("Libro.pdf");
        fs::write(&source, include_bytes!("test-page.pdf")).unwrap();
        let valid = fs::canonicalize(&source).unwrap();
        let parent_path = base.join("sub").join("..").join("Libro.pdf");

        let registry = LinkRegistry {
            links: vec![
                LinkedDocument {
                    id: "relative".to_string(),
                    path: "assets/pdfs/Libro.pdf".to_string(),
                    title: "Relativo".to_string(),
                    added: 0,
                    expires_at: None,
                },
                LinkedDocument {
                    id: "parent".to_string(),
                    path: parent_path.to_string_lossy().to_string(),
                    title: "Con parent".to_string(),
                    added: 0,
                    expires_at: None,
                },
                LinkedDocument {
                    id: "valid".to_string(),
                    path: valid.to_string_lossy().to_string(),
                    title: "Válido".to_string(),
                    added: 0,
                    expires_at: None,
                },
            ],
        };
        save_registry(&vault, &registry).unwrap();

        let items = list(&vault).unwrap();
        assert_eq!(items.len(), 3);
        let relative = items
            .iter()
            .find(|item| item.relative_path == "link:relative")
            .unwrap();
        let parent = items
            .iter()
            .find(|item| item.relative_path == "link:parent")
            .unwrap();
        let valid_item = items
            .iter()
            .find(|item| item.relative_path == "link:valid")
            .unwrap();
        assert!(relative.missing);
        assert!(parent.missing);
        assert!(!valid_item.missing);

        assert!(resolve_document(&vault, "link:relative").is_err());
        assert!(resolve_document(&vault, "link:parent").is_err());
        assert!(resolve_document(&vault, "link:valid").is_ok());

        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn opening_revalidates_vault_and_linked_pdfs() {
        let base = test_dir("open-validation");
        let vault = base.join("vault");
        let pdfs = vault.join(PDF_FOLDER);
        fs::create_dir_all(&pdfs).unwrap();

        let valid = pdfs.join("Valido.pdf");
        fs::write(&valid, include_bytes!("test-page.pdf")).unwrap();
        let invalid = pdfs.join("Falso.pdf");
        fs::write(&invalid, b"no soy un pdf").unwrap();

        assert!(resolve_document_for_open(&vault, "assets/pdfs/Valido.pdf").is_ok());
        assert!(resolve_document_for_open(&vault, "assets/pdfs/Falso.pdf").is_err());

        let external = base.join("Externo.pdf");
        fs::write(&external, b"no soy un pdf").unwrap();
        let registry = LinkRegistry {
            links: vec![LinkedDocument {
                id: "externo".to_string(),
                path: fs::canonicalize(&external)
                    .unwrap()
                    .to_string_lossy()
                    .to_string(),
                title: "Externo".to_string(),
                added: 0,
                expires_at: None,
            }],
        };
        save_registry(&vault, &registry).unwrap();
        assert!(resolve_document_for_open(&vault, "link:externo").is_err());

        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn link_rejects_files_without_pdf_header() {
        let root = std::env::temp_dir().join(format!("sinnotas-pdf-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let source = root.join("falso.pdf");
        fs::write(&source, b"no soy un pdf").unwrap();
        let target = root.join("vault");
        fs::create_dir_all(&target).unwrap();
        assert!(link_pdf(&target, &source, None).is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn links_a_valid_pdf_without_copying_it() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-link-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let vault = root.join("vault");
        fs::create_dir_all(&vault).unwrap();

        let source = root.join("Mi PDF.pdf");
        fs::write(&source, include_bytes!("test-page.pdf")).unwrap();

        let relative = link_pdf(&vault, &source, None).unwrap();
        assert!(relative.starts_with("link:"));
        assert!(source.is_file());
        assert!(!vault.join("assets/pdfs/Mi PDF.pdf").exists());
        assert!(!vault.join(PDF_FOLDER).exists());

        let items = list(&vault).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].relative_path, relative);
        assert_eq!(items[0].title, "Mi PDF");
        assert!(items[0].linked);
        assert!(!items[0].missing);
        assert!(!serde_json::to_string(&items[0])
            .unwrap()
            .contains("sourcePath"));

        let resolved = resolve_document(&vault, &relative).unwrap();
        assert_eq!(resolved.path, fs::canonicalize(&source).unwrap());
        assert!(resolved.linked);

        // Enlazar dos veces el mismo archivo reutiliza la entrada.
        assert_eq!(link_pdf(&vault, &source, None).unwrap(), relative);
        assert_eq!(list(&vault).unwrap().len(), 1);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn linking_a_pdf_already_in_the_library_keeps_its_relative_path() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-inside-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let vault = root.join("vault");
        let pdfs = vault.join(PDF_FOLDER);
        fs::create_dir_all(&pdfs).unwrap();
        let source = pdfs.join("Libro.pdf");
        fs::write(&source, include_bytes!("test-page.pdf")).unwrap();

        let relative = link_pdf(&vault, &source, None).unwrap();
        assert_eq!(relative, "assets/pdfs/Libro.pdf");
        // No se crea un registro de enlaces para un PDF que ya está en la
        // biblioteca del vault.
        assert!(!registry_path(&vault).exists());
        assert_eq!(list(&vault).unwrap().len(), 1);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn unlink_removes_the_entry_but_keeps_the_original() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-unlink-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let vault = root.join("vault");
        fs::create_dir_all(&vault).unwrap();

        let source = root.join("Libro.pdf");
        fs::write(&source, include_bytes!("test-page.pdf")).unwrap();
        let relative = link_pdf(&vault, &source, None).unwrap();

        assert!(unlink(&vault, &relative).unwrap());
        assert!(source.is_file());
        assert!(list(&vault).unwrap().is_empty());
        // Quitar dos veces no es un error: simplemente no había nada que quitar.
        assert!(!unlink(&vault, &relative).unwrap());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_linked_files_are_listed_as_missing() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-missing-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let vault = root.join("vault");
        fs::create_dir_all(&vault).unwrap();

        let source = root.join("Se irá.pdf");
        fs::write(&source, include_bytes!("test-page.pdf")).unwrap();
        let relative = link_pdf(&vault, &source, None).unwrap();
        fs::remove_file(&source).unwrap();

        let items = list(&vault).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].relative_path, relative);
        assert!(items[0].linked);
        assert!(items[0].missing);
        assert!(resolve_document(&vault, &relative).is_err());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn expiry_can_be_scheduled_and_purges_expired_links() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-expiry-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let vault = root.join("vault");
        fs::create_dir_all(&vault).unwrap();

        let source = root.join("Temporal.pdf");
        fs::write(&source, include_bytes!("test-page.pdf")).unwrap();
        let relative = link_pdf(&vault, &source, Some(7)).unwrap();

        let items = list(&vault).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].expires_at.is_some());

        assert!(set_expiry(&vault, &relative, None).unwrap());
        assert!(list(&vault).unwrap()[0].expires_at.is_none());

        // Una caducidad de cero días elimina el enlace en el siguiente listado.
        assert!(set_expiry(&vault, &relative, Some(0)).unwrap());
        assert!(list(&vault).unwrap().is_empty());
        assert!(source.is_file());
        assert!(resolve_document(&vault, &relative).is_err());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_removes_vault_copies_but_never_external_sources() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-delete-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let vault = root.join("vault");
        let pdfs = vault.join(PDF_FOLDER);
        fs::create_dir_all(&pdfs).unwrap();

        let stored = pdfs.join("Copia.pdf");
        fs::write(&stored, include_bytes!("test-page.pdf")).unwrap();
        assert!(delete_document(&vault, "assets/pdfs/Copia.pdf").unwrap());
        assert!(!stored.exists());

        let external = root.join("Externo.pdf");
        fs::write(&external, include_bytes!("test-page.pdf")).unwrap();
        let relative = link_pdf(&vault, &external, None).unwrap();
        assert!(delete_document(&vault, &relative).unwrap());
        assert!(external.is_file());
        assert!(list(&vault).unwrap().is_empty());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn captures_are_saved_inside_a_dedicated_assets_folder() {
        let root =
            std::env::temp_dir().join(format!("sinnotas-pdf-capture-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();

        let saved = save_capture(&root, "Región.png", TEST_PNG).unwrap();
        assert!(saved.relative_path.starts_with("assets/pdf-captures/"));
        assert!(Path::new(&saved.absolute_path).is_file());
        let canonical_capture_folder = fs::canonicalize(root.join(CAPTURE_FOLDER)).unwrap();
        assert!(Path::new(&saved.absolute_path).starts_with(canonical_capture_folder));
        assert!(save_capture(&root, "Falsa.png", b"no soy png").is_err());

        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn registry_rejects_symlinked_internal_folder_outside_vault() {
        use std::os::unix::fs::symlink;

        let base = test_dir("registry-symlink-folder");
        let vault = base.join("vault");
        let outside = base.join("outside");
        fs::create_dir_all(&vault).unwrap();
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, vault.join(".sinnotas")).unwrap();

        assert!(load_registry(&vault).is_err());
        assert!(save_registry(&vault, &LinkRegistry::default()).is_err());
        assert!(!outside.join("documents").exists());

        fs::remove_dir_all(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn registry_rejects_symlinked_links_file_outside_vault() {
        use std::os::unix::fs::symlink;

        let base = test_dir("registry-symlink-file");
        let vault = base.join("vault");
        let docs = vault.join(LINKS_FOLDER);
        fs::create_dir_all(&docs).unwrap();
        let outside_file = base.join("outside-links.json");
        fs::write(&outside_file, "{}").unwrap();
        symlink(&outside_file, docs.join(LINKS_FILE)).unwrap();

        assert!(load_registry(&vault).is_err());
        assert!(save_registry(&vault, &LinkRegistry::default()).is_err());
        assert_eq!(fs::read_to_string(&outside_file).unwrap(), "{}");

        fs::remove_dir_all(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn captures_reject_symlinked_folder_outside_vault() {
        use std::os::unix::fs::symlink;

        let base = test_dir("capture-symlink-folder");
        let vault = base.join("vault");
        let outside = base.join("outside");
        fs::create_dir_all(vault.join("assets")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        symlink(&outside, vault.join(CAPTURE_FOLDER)).unwrap();

        assert!(save_capture(&vault, "captura.png", TEST_PNG).is_err());
        assert_eq!(fs::read_dir(&outside).unwrap().count(), 0);

        fs::remove_dir_all(base).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn capture_creation_does_not_follow_file_symlinks() {
        use std::os::unix::fs::symlink;

        let base = test_dir("capture-symlink-file");
        let outside_file = base.join("outside.png");
        fs::write(&outside_file, b"keep").unwrap();
        let target = base.join("capture.png");
        symlink(&outside_file, &target).unwrap();

        let error = create_capture_file(&target, TEST_PNG).unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists);
        assert_eq!(fs::read(&outside_file).unwrap(), b"keep");

        fs::remove_dir_all(base).unwrap();
    }
}
