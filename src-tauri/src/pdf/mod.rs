//! Lector PDF nativo de SinNotas.
//!
//! La UI nunca recibe el PDF ni el RGBA de la página: pide metadatos y un PNG
//! ya renderizado. PDFium se carga de forma perezosa desde
//! `resources/pdfium/<os>-<arch>/` y se serializa con un `Mutex` propio; la
//! feature `thread_safe` de `pdfium-render` protege además las llamadas internas.

mod engine;
mod storage;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

/// Entrada de la biblioteca de documentos del vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfListItem {
    /// Ruta relativa al vault (`assets/pdfs/...`) o enlace interno
    /// (`link:<uuid>`) cuando el documento vive fuera de la bóveda.
    pub relative_path: String,
    pub title: String,
    pub file_size: u64,
    /// Milisegundos desde Unix epoch.
    pub modified: i64,
    /// `true` si el documento está enlazado desde fuera del vault.
    #[serde(default)]
    pub linked: bool,
    /// `true` si un documento enlazado ya no existe en su ubicación original.
    #[serde(default)]
    pub missing: bool,
    /// Milisegundos desde Unix epoch; `None` significa sin caducidad.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
}

/// Dimensiones de una página en puntos PDF (1/72 pulgadas).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPageInfo {
    pub index: u32,
    pub width_points: f32,
    pub height_points: f32,
    pub label: Option<String>,
}

/// Metadatos de un PDF abierto.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfDocumentInfo {
    pub relative_path: String,
    pub title: String,
    pub page_count: u32,
    pub pages: Vec<PdfPageInfo>,
    pub file_size: u64,
    pub modified: i64,
    /// `true` si el documento se abrió desde un enlace externo.
    #[serde(default)]
    pub linked: bool,
    /// Milisegundos desde Unix epoch; `None` significa sin caducidad.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
}

/// Fragmento de texto extraído de una página, en coordenadas normalizadas
/// (0..1) con origen en la esquina superior izquierda.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTextRun {
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Capa de texto seleccionable de una página.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTextPage {
    pub width_points: f32,
    pub height_points: f32,
    pub runs: Vec<PdfTextRun>,
}

/// Lista los PDFs de `assets/pdfs/` y los documentos enlazados.
pub fn list(root: &Path) -> Result<Vec<PdfListItem>, String> {
    storage::list(root)
}

/// Abre un PDF del vault o un documento enlazado y devuelve sus páginas.
pub fn open(app: &AppHandle, root: &Path, requested_path: &str) -> Result<PdfDocumentInfo, String> {
    let resolved = storage::resolve_document_for_open(root, requested_path)?;
    let metadata = fs::metadata(&resolved.path).map_err(|error| error.to_string())?;
    let (page_count, pages) = engine::inspect(app, &resolved.path)?;
    if page_count == 0 {
        return Err("El PDF no contiene páginas legibles.".to_string());
    }

    let title = resolved.title.clone().unwrap_or_else(|| {
        Path::new(&resolved.relative_path)
            .file_stem()
            .and_then(|value| value.to_str())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("Documento")
            .to_string()
    });

    Ok(PdfDocumentInfo {
        relative_path: resolved.relative_path,
        title,
        page_count,
        pages,
        file_size: metadata.len(),
        modified: storage::modified_ms(&metadata),
        linked: resolved.linked,
        expires_at: resolved.expires_at,
    })
}

/// Renderiza una página como PNG.
pub fn render_page(
    app: &AppHandle,
    root: &Path,
    requested_path: &str,
    page_index: u32,
    target_width: u32,
) -> Result<Vec<u8>, String> {
    let resolved = storage::resolve_document_for_open(root, requested_path)?;
    engine::render_png(app, &resolved.path, page_index, target_width)
}

/// Enlaza un PDF externo sin copiarlo al vault y lo abre.
pub fn import_path(
    app: &AppHandle,
    root: &Path,
    source_path: &Path,
    keep_days: Option<u32>,
) -> Result<PdfDocumentInfo, String> {
    let relative_path = storage::link_pdf(root, source_path, keep_days)?;
    open(app, root, &relative_path)
}

/// Extrae la capa de texto de una página para poder seleccionarla en la UI.
pub fn page_text(
    app: &AppHandle,
    root: &Path,
    requested_path: &str,
    page_index: u32,
) -> Result<PdfTextPage, String> {
    let resolved = storage::resolve_document_for_open(root, requested_path)?;
    engine::extract_text(app, &resolved.path, page_index)
}

/// Cambia cuánto tiempo permanece enlazado un documento.
pub fn set_expiry(
    root: &Path,
    requested_path: &str,
    keep_days: Option<u32>,
) -> Result<bool, String> {
    storage::set_expiry(root, requested_path, keep_days)
}

/// Borra un documento de la biblioteca (sin tocar nunca el original externo).
pub fn delete_document(root: &Path, requested_path: &str) -> Result<bool, String> {
    storage::delete_document(root, requested_path)
}

/// Guarda una captura de una región de PDF dentro del vault.
pub fn save_capture(
    root: &Path,
    file_name: &str,
    bytes: &[u8],
) -> Result<crate::SavedImagePath, String> {
    storage::save_capture(root, file_name, bytes)
}

/// Quita un enlace del registro sin tocar el archivo original.
pub fn unlink(root: &Path, requested_path: &str) -> Result<bool, String> {
    storage::unlink(root, requested_path)
}
