//! Carga perezosa de PDFium y render de páginas a PNG.

use super::{PdfPageInfo, PdfTextPage, PdfTextRun};
use pdfium_render::prelude::*;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

/// El motor se inicializa la primera vez que se abre o importa un PDF. Así el
/// arranque normal de SinNotas no paga el coste de cargar PDFium.
static PDFIUM: Mutex<Option<Pdfium>> = Mutex::new(None);

const MAX_PDF_PAGES: i32 = 10_000;
const MAX_RENDER_WIDTH: u32 = 2_400;
const MAX_RENDER_HEIGHT: u32 = 12_000;
const MAX_RENDER_PIXELS: u64 = 24_000_000;
const MAX_TEXT_RUNS: usize = 50_000;

fn library_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "pdfium.dll"
    } else if cfg!(target_os = "macos") || cfg!(target_os = "ios") {
        "libpdfium.dylib"
    } else {
        "libpdfium.so"
    }
}

fn target_dir() -> String {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "ios") {
        "ios"
    } else if cfg!(target_os = "android") {
        "android"
    } else {
        "linux"
    };
    format!("{os}-{}", std::env::consts::ARCH)
}

fn bind_library(path: &Path) -> Result<Pdfium, String> {
    if !path.is_file() {
        return Err(format!(
            "No se encontró la librería PDFium en {}.",
            path.display()
        ));
    }
    let bindings = Pdfium::bind_to_library(path)
        .map_err(|error| format!("No se pudo cargar PDFium desde {}: {error}", path.display()))?;
    Ok(Pdfium::new(bindings))
}

/// Busca la librería dentro de un directorio de recursos sin depender de cómo
/// Tauri haya preservado la estructura de `bundle.resources`.
fn find_library_in(directory: &Path) -> Option<PathBuf> {
    let name = library_name();
    WalkDir::new(directory)
        .max_depth(5)
        .into_iter()
        .filter_map(Result::ok)
        .find(|entry| {
            entry.file_type().is_file()
                && entry
                    .file_name()
                    .to_string_lossy()
                    .eq_ignore_ascii_case(name)
        })
        .map(|entry| entry.into_path())
}

fn load_pdfium(app: &AppHandle) -> Result<Pdfium, String> {
    if let Ok(configured) = std::env::var("SINNOTAS_PDFIUM_PATH") {
        let configured = PathBuf::from(configured);
        let path = if configured.is_dir() {
            configured.join(library_name())
        } else {
            configured
        };
        return bind_library(&path);
    }

    let mut candidates = Vec::new();

    // En una app empaquetada la librería vive en `resource_dir`. Se comprueba
    // primero para no depender de la ruta de compilación en la máquina de
    // desarrollo.
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("pdfium")
                .join(target_dir())
                .join(library_name()),
        );
        candidates.push(
            resource_dir
                .join("resources/pdfium")
                .join(target_dir())
                .join(library_name()),
        );
        if let Some(found) = find_library_in(&resource_dir) {
            candidates.push(found);
        }
    }

    // Fallback de desarrollo: `tauri dev` no siempre copia los recursos.
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources/pdfium")
            .join(target_dir())
            .join(library_name()),
    );

    for candidate in candidates {
        if candidate.is_file() {
            return bind_library(&candidate);
        }
    }

    // Último recurso: una librería instalada en el sistema (LD_LIBRARY_PATH,
    // DYLD_LIBRARY_PATH o el directorio del ejecutable).
    Pdfium::bind_to_system_library()
        .map(Pdfium::new)
        .map_err(|error| {
            format!(
                "No se encontró PDFium. Ejecuta scripts/fetch-pdfium.sh o define \
                 SINNOTAS_PDFIUM_PATH. Detalle: {error}"
            )
        })
}

fn with_pdfium<T>(
    app: &AppHandle,
    operation: impl FnOnce(&Pdfium) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = PDFIUM
        .lock()
        .map_err(|_| "El motor PDF no está disponible.".to_string())?;
    if guard.is_none() {
        *guard = Some(load_pdfium(app)?);
    }
    let pdfium = guard
        .as_ref()
        .ok_or_else(|| "El motor PDF no está disponible.".to_string())?;
    operation(pdfium)
}

fn open_document<'a>(pdfium: &'a Pdfium, path: &Path) -> Result<PdfDocument<'a>, String> {
    pdfium
        .load_pdf_from_file(path, None)
        .map_err(|error| format!("No se pudo abrir el PDF: {error}"))
}

fn ensure_page_count(page_count: i32) -> Result<(), String> {
    if page_count > MAX_PDF_PAGES {
        return Err(format!(
            "El PDF tiene {page_count} páginas; el límite es {MAX_PDF_PAGES}."
        ));
    }
    Ok(())
}

/// Calcula un ancho de render que respete el alto y el número de píxeles
/// máximos. Si ni siquiera el ancho mínimo cabe, rechaza la página.
fn safe_render_width(page_width: f32, page_height: f32, target_width: u32) -> Result<u32, String> {
    if !page_width.is_finite()
        || !page_height.is_finite()
        || page_width <= 0.0
        || page_height <= 0.0
    {
        return Err("La página no tiene dimensiones válidas.".to_string());
    }

    let aspect = f64::from(page_height) / f64::from(page_width);
    let mut width = f64::from(target_width.clamp(320, MAX_RENDER_WIDTH));
    loop {
        let height = (width * aspect).ceil();
        if height <= f64::from(MAX_RENDER_HEIGHT) && width * height <= MAX_RENDER_PIXELS as f64 {
            return Ok(width as u32);
        }

        let next = (width * 0.75).floor().max(320.0);
        if next >= width {
            return Err(
                "La página tiene una proporción demasiado grande para renderizarla de forma segura."
                    .to_string(),
            );
        }
        width = next;
    }
}

pub(crate) fn inspect(app: &AppHandle, path: &Path) -> Result<(u32, Vec<PdfPageInfo>), String> {
    with_pdfium(app, |pdfium| {
        let document = open_document(pdfium, path)?;
        let pages = document.pages();
        let page_count = pages.len();
        ensure_page_count(page_count)?;
        let mut page_infos = Vec::with_capacity(page_count.max(0) as usize);

        for index in 0..page_count {
            let page = pages
                .get(index)
                .map_err(|error| format!("No se pudo leer la página {}: {error}", index + 1))?;
            page_infos.push(PdfPageInfo {
                index: index as u32,
                width_points: page.width().value,
                height_points: page.height().value,
                label: page.label().map(|label| label.to_string()),
            });
        }

        Ok((page_count as u32, page_infos))
    })
}

fn extract_text_from_document(
    document: &PdfDocument<'_>,
    page_index: u32,
) -> Result<PdfTextPage, String> {
    let pages = document.pages();
    let page_count = pages.len();
    ensure_page_count(page_count)?;
    if page_index as i32 >= page_count {
        return Err(format!(
            "La página {} no existe (el PDF tiene {} páginas).",
            page_index + 1,
            page_count
        ));
    }

    let page = pages
        .get(page_index as i32)
        .map_err(|error| format!("No se pudo cargar la página: {error}"))?;
    let width_points = page.width().value;
    let height_points = page.height().value;
    if width_points <= 0.0 || height_points <= 0.0 {
        return Err("La página no tiene dimensiones válidas.".to_string());
    }

    let text = page
        .text()
        .map_err(|error| format!("No se pudo leer el texto de la página: {error}"))?;
    let mut runs = Vec::new();
    for segment in text.segments().iter() {
        if runs.len() >= MAX_TEXT_RUNS {
            return Err(format!(
                "La página contiene demasiados fragmentos de texto (límite: {MAX_TEXT_RUNS})."
            ));
        }
        let value = segment.text();
        if value.trim().is_empty() {
            continue;
        }
        let bounds = segment.bounds();
        let width = bounds.width().value;
        let height = bounds.height().value;
        if width <= 0.0 || height <= 0.0 {
            continue;
        }
        runs.push(PdfTextRun {
            text: value,
            x: (bounds.left().value / width_points).clamp(0.0, 1.0),
            y: ((height_points - bounds.top().value) / height_points).clamp(0.0, 1.0),
            width: (width / width_points).clamp(0.0, 1.0),
            height: (height / height_points).clamp(0.0, 1.0),
        });
    }

    Ok(PdfTextPage {
        width_points,
        height_points,
        runs,
    })
}

pub(crate) fn extract_text(
    app: &AppHandle,
    path: &Path,
    page_index: u32,
) -> Result<PdfTextPage, String> {
    with_pdfium(app, |pdfium| {
        let document = open_document(pdfium, path)?;
        extract_text_from_document(&document, page_index)
    })
}

fn encode_png(bitmap: &PdfBitmap<'_>) -> Result<Vec<u8>, String> {
    let bitmap_width = bitmap.width().max(1) as u32;
    let bitmap_height = bitmap.height().max(1) as u32;
    if bitmap_width > MAX_RENDER_WIDTH
        || bitmap_height > MAX_RENDER_HEIGHT
        || u64::from(bitmap_width) * u64::from(bitmap_height) > MAX_RENDER_PIXELS
    {
        return Err("La página renderizada supera los límites de tamaño.".to_string());
    }
    let rgba = bitmap.as_rgba_bytes();
    let image = ::image::RgbaImage::from_raw(bitmap_width, bitmap_height, rgba)
        .ok_or_else(|| "PDFium devolvió un búfer de imagen inválido.".to_string())?;

    let mut output = Cursor::new(Vec::new());
    ::image::DynamicImage::ImageRgba8(image)
        .write_to(&mut output, ::image::ImageFormat::Png)
        .map_err(|error| format!("No se pudo codificar la página como PNG: {error}"))?;
    Ok(output.into_inner())
}

pub(crate) fn render_png(
    app: &AppHandle,
    path: &Path,
    page_index: u32,
    target_width: u32,
) -> Result<Vec<u8>, String> {
    let requested_width = target_width.clamp(320, MAX_RENDER_WIDTH);

    with_pdfium(app, |pdfium| {
        let document = open_document(pdfium, path)?;
        let pages = document.pages();
        let page_count = pages.len();
        ensure_page_count(page_count)?;
        if page_index as i32 >= page_count {
            return Err(format!(
                "La página {} no existe (el PDF tiene {} páginas).",
                page_index + 1,
                page_count
            ));
        }

        let page = pages
            .get(page_index as i32)
            .map_err(|error| format!("No se pudo cargar la página: {error}"))?;
        let width = safe_render_width(page.width().value, page.height().value, requested_width)?;
        let config = PdfRenderConfig::new().set_target_width(width as i32);
        let bitmap = page
            .render_with_config(&config)
            .map_err(|error| format!("No se pudo renderizar la página: {error}"))?;
        encode_png(&bitmap)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_width_respects_pixel_and_height_limits() {
        assert_eq!(safe_render_width(100.0, 100.0, 2_400).unwrap(), 2_400);
        assert_eq!(safe_render_width(100.0, 500.0, 2_400).unwrap(), 1_800);
        assert!(safe_render_width(100.0, 5_000.0, 2_400).is_err());
        assert!(safe_render_width(0.0, 100.0, 600).is_err());
    }

    #[test]
    fn page_count_limit_is_enforced() {
        assert!(ensure_page_count(1).is_ok());
        assert!(ensure_page_count(MAX_PDF_PAGES).is_ok());
        assert!(ensure_page_count(MAX_PDF_PAGES + 1).is_err());
    }

    fn test_pdfium(library: &Path) -> Pdfium {
        match Pdfium::bind_to_library(library) {
            Ok(bindings) => Pdfium::new(bindings),
            // `pdfium-render` guarda las bindings en un `OnceCell` global; si otra
            // prueba del mismo proceso ya las inicializó, se reutilizan.
            Err(PdfiumError::PdfiumLibraryBindingsAlreadyInitialized) => Pdfium::default(),
            Err(error) => panic!("PDFium debe cargar: {error}"),
        }
    }

    #[test]
    fn renders_a_page_to_png_with_the_bundled_library() {
        let library = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources/pdfium")
            .join(target_dir())
            .join(library_name());
        if !library.is_file() {
            eprintln!(
                "Se omite la prueba de render: falta {} (ejecuta scripts/fetch-pdfium.sh).",
                library.display()
            );
            return;
        }

        let pdfium = test_pdfium(&library);
        let document = pdfium
            .load_pdf_from_byte_slice(include_bytes!("test-page.pdf"), None)
            .expect("el PDF de prueba debe abrirse");
        let page = document.pages().first().expect("el PDF tiene una página");
        let bitmap = page
            .render_with_config(&PdfRenderConfig::new().set_target_width(600))
            .expect("la página debe renderizarse");
        let png = encode_png(&bitmap).expect("la página debe codificarse como PNG");

        assert!(bitmap.width() > 0);
        assert!(bitmap.height() > 0);
        assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));
    }

    #[test]
    fn extracts_selectable_text_runs_from_a_page() {
        let library = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources/pdfium")
            .join(target_dir())
            .join(library_name());
        if !library.is_file() {
            eprintln!(
                "Se omite la prueba de texto: falta {} (ejecuta scripts/fetch-pdfium.sh).",
                library.display()
            );
            return;
        }

        let pdfium = test_pdfium(&library);
        let document = pdfium
            .load_pdf_from_byte_slice(include_bytes!("test-page.pdf"), None)
            .expect("el PDF de prueba debe abrirse");
        let text = extract_text_from_document(&document, 0).expect("la página debe tener texto");

        assert!(text.width_points > 0.0);
        assert!(text.height_points > 0.0);
        assert!(!text.runs.is_empty());
        let joined = text
            .runs
            .iter()
            .map(|run| run.text.as_str())
            .collect::<String>();
        assert!(joined.contains("SinNotas"));
        assert!(text
            .runs
            .iter()
            .all(|run| run.x >= 0.0 && run.y >= 0.0 && run.width >= 0.0 && run.height >= 0.0));
    }
}
