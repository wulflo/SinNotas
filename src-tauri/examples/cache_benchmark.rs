//! Benchmark for the persistent metadata cache.
//!
//! Generates a vault with 5,000 Markdown notes, measures a cold startup (full
//! Markdown parse + cache write) and a warm startup (mtime sweep + bincode
//! load), then reports the speedup.
//!
//! Run with:
//!   cargo run --release --manifest-path src-tauri/Cargo.toml \
//!     --example cache_benchmark -- [note-count]
//!
//! The generated vault is always a temporary directory (never an existing
//! user vault) and is removed before exiting.

use sin_notas_lib::metadata_cache::{load_or_scan_vault, CacheScanOutput, CACHE_FILE_NAME};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const DEFAULT_NOTES: usize = 5_000;

fn create_vault(root: &Path, notes: usize) -> std::io::Result<()> {
    fs::create_dir_all(root.join("pages"))?;

    for index in 0..notes {
        let content = format!(
            "# Nota {index}\n\n\
             - Párrafo de prueba con **formato** y un enlace a [[nota-{:05}]].\n\
             - Otro bullet con #etiqueta y texto Unicode: ñ, á, 日本語, 中文.\n\
             - ¿Pregunta de repaso {index}? :: Respuesta número {index}. #card\n\
             - {{c1::Cloze}} de ejemplo para la tarjeta {index}.\n\
             - Línea final del archivo.\n",
            (index + 1) % notes
        );
        fs::write(
            root.join("pages").join(format!("nota-{index:05}.md")),
            content,
        )?;
    }
    Ok(())
}

fn run_scan(label: &str, root: &Path) -> (Duration, CacheScanOutput) {
    let started = Instant::now();
    let output = load_or_scan_vault(root).expect("the benchmark vault must scan");
    let elapsed = started.elapsed();

    let stats = &output.stats;
    println!(
        "{label:<6} {:>8.2} ms  notes={} parsed={} reused={} cache_loaded={} written={}",
        elapsed.as_secs_f64() * 1_000.0,
        stats.total_notes,
        stats.parsed_notes,
        stats.reused_notes,
        stats.cache_loaded,
        stats.cache_written,
    );
    assert_eq!(output.pages.len(), stats.total_notes);
    (elapsed, output)
}

fn main() {
    let notes = std::env::args()
        .nth(1)
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(DEFAULT_NOTES);
    assert!(notes > 0, "the note count must be greater than zero");

    let root: PathBuf = std::env::temp_dir().join(format!(
        "sinnotas-cache-bench-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default()
    ));

    println!("SinNotas metadata cache benchmark");
    println!("vault: {}", root.display());
    println!("notes: {notes}");

    if let Err(error) = create_vault(&root, notes) {
        let _ = fs::remove_dir_all(&root);
        eprintln!("Could not create the benchmark vault: {error}");
        std::process::exit(1);
    }

    let (cold, cold_output) = run_scan("cold", &root);
    assert!(cold_output.cache.entries.len() == notes);
    assert!(
        root.join(CACHE_FILE_NAME).is_file(),
        "cold scan must write the cache"
    );

    let (warm, warm_output) = run_scan("warm", &root);
    assert!(
        warm_output.stats.cache_loaded,
        "warm scan must load the cache"
    );
    assert_eq!(
        warm_output.stats.parsed_notes, 0,
        "warm scan must not re-parse unchanged notes"
    );

    let speedup = cold.as_secs_f64() / warm.as_secs_f64().max(f64::EPSILON);
    println!();
    println!(
        "cold: {:.2} ms | warm: {:.2} ms | speedup: {:.2}x",
        cold.as_secs_f64() * 1_000.0,
        warm.as_secs_f64() * 1_000.0,
        speedup
    );

    let _ = fs::remove_dir_all(&root);
}
