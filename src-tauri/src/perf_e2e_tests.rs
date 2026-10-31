//! FASE 4: arnés de medición end-to-end del pipeline de Rust contra una
//! bóveda REAL (solo lectura; opera sobre una copia en tempdir para no
//! tocar ni la bóveda del usuario ni su caché).
//!
//! Se SALTA si no existe la variable de entorno `SINNOTAS_PERF_VAULT`
//! (apuntando a la raíz de una bóveda .md). Ejecutar en RELEASE para
//! números honestos:
//!
//! ```sh
//! SINNOTAS_PERF_VAULT="/ruta/a/la/boveda" cargo test --release perf_e2e -- --nocapture
//! ```
//!
//! Mide, en orden real de uso:
//! 1. **Arranque frío**: escaneo completo sin caché previa (v3 desde cero).
//! 2. **Arranque seco**: segunda carga con la caché v3 ya en disco (lo que
//!    hace TODA apertura normal de la app).
//! 3. **Pico de RSS** del proceso tras el arranque seco (VmHWM del proceso
//!    de test; sobreestima lo que la app siente: también incluye el scan y
//!    los buffers de copia del tempdir).
//! 4. **Grafo**: construcción de las aristas desde la caché.
//! 5. **Retroenlaces**: `find_cached_backlinks` para 10 títulos muestreados.
//! 6. **Rehidratación**: `to_page_data` de la caché para 5 lotes de 96 notas
//!    (equivalente al hit de `read_pages_cached` sin IO).
//! 7. **Búsqueda de contenido**: construcción del índice plegado (una vez
//!    por vault, como `refresh_content_index`) + 5 consultas.
//!
//! Lo que el arnés NO mide (y la app sí paga): la serialización IPC
//! (JSON/Tauri) del payload al front y la construcción de árboles del
//! editor. El arnés es una cota inferior del tiempo de app.

use crate::metadata_cache::{self, CacheScanOutput};
use crate::{graph_links_from_cache, run_content_search};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// Ignora carpetas/ficheros reservados (mismo criterio que el walker del
/// scan): la copia nace SIN caché, así que el arranque frío del arnés es un
/// rescan completo de verdad.
fn is_reserved_dir_name(path: &Path) -> bool {
    let name = match path.file_name() {
        Some(name) => name.to_string_lossy(),
        None => return false,
    };
    if path.is_dir() {
        crate::RESERVED_DIRS
            .iter()
            .any(|reserved| name.eq_ignore_ascii_case(reserved))
    } else {
        name == metadata_cache::CACHE_FILE_NAME
            || name == metadata_cache::CACHE_DELTA_FILE_NAME
    }
}

/// Copia recursiva simple (fs::copy mantiene permisos; los .md son triviales).
fn copy_vault(src: &Path, dst: &Path) -> Result<u64, String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let mut total = 0u64;
    let mut stack = vec![src.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in
            fs::read_dir(&dir).map_err(|e| format!("read_dir {}: {e}", dir.display()))?
        {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let rel = path.strip_prefix(src).unwrap();
            let target = dst.join(rel);
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            if file_type.is_dir() {
                if is_reserved_dir_name(&path) {
                    continue;
                }
                stack.push(path.clone());
                fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            } else if file_type.is_file() {
                if is_reserved_dir_name(&path) {
                    continue;
                }
                total += fs::copy(&path, &target).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(total)
}

/// Pico de RSS del proceso (VmHWM en kB de Linux), 0 si no está disponible.
fn peak_rss_kb() -> usize {
    fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|status| {
            status
                .lines()
                .find(|line| line.starts_with("VmHWM:"))
                .and_then(|line| {
                    line.split_whitespace()
                        .nth(1)
                        .and_then(|num| num.parse::<usize>().ok())
                })
        })
        .unwrap_or(0)
}

/// Pego el índice plegado como lo hace `VaultCacheRuntime::refresh_content_index`
/// en su rama de construcción (misma unidad de mantenimiento: nota a nota del
/// caché, vía la función asociada real `fold_note_entries`).
fn build_folded_index(
    entries: &BTreeMap<String, metadata_cache::CachedNote>,
) -> HashMap<String, crate::FoldedNoteEntry> {
    let mut built = HashMap::with_capacity(entries.len());
    for (relative, note) in entries {
        built.insert(relative.clone(), crate::VaultCacheRuntime::fold_note_entries(note));
    }
    built
}

#[cfg(test)]
mod perf_e2e {
    use super::*;

    fn vault_root() -> Option<PathBuf> {
        std::env::var("SINNOTAS_PERF_VAULT")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
    }

    /// Muestreo determinista: n elementos espaciados por igual del cache.
    fn sample<T: Clone>(values: &[T], count: usize) -> Vec<T> {
        if values.len() <= count {
            return values.to_vec();
        }
        let step = values.len() / count;
        (0..count).map(|i| values[i * step].clone()).collect()
    }

    #[test]
    fn perf_e2e_cold_warm_search_graph_backlinks() {
        let Some(source) = vault_root() else {
            eprintln!("[perf-e2e] SINNOTAS_PERF_VAULT no definida: no hay medición.");
            return;
        };

        let workdir = std::env::temp_dir().join(format!(
            "sinnotas-perf-e2e-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        println!("[perf-e2e] Copiando {} → {} (sin caché)", source.display(), workdir.display());
        let copy_started = Instant::now();
        let bytes = copy_vault(&source, &workdir).expect("la copia de la bóveda debe salir");
        println!(
            "[perf-e2e] Copia lista: {:.1} MB en {:.2}s",
            bytes as f64 / 1_048_576.0,
            copy_started.elapsed().as_secs_f64()
        );

        // 1) ARRANQUE FRÍO: sin caché previa, v3 escrita de cero.
        let cold: CacheScanOutput = {
            let started = Instant::now();
            let output = metadata_cache::load_or_scan_vault_with_mode(&workdir, true)
                .expect("el arranque frío debe salir");
            let wall = started.elapsed();
            let stats = &output.stats;
            println!(
                "[perf-e2e] FRÍO: calle {:.3}s (scan interno {:.3}s, cache escrito: {}); notas totales {}, reutilizadas {}, parseadas {}",
                wall.as_secs_f32(),
                Duration::from_millis(stats.scan_ms as u64).as_secs_f32(),
                stats.cache_written,
                stats.total_notes,
                stats.reused_notes,
                stats.parsed_notes,
            );
            assert!(stats.cache_written, "el frío debe escribir la caché");
            output
        };
        // El payload metadata-only no trae árboles: el front recibe bloques vacíos.
        assert!(
            cold.pages.iter().all(|page| !page.blocks_loaded),
            "el arranque metadata-only debe servir páginas sin bloques"
        );
        assert!(!cold.pages.is_empty(), "la bóveda debe aportar notas");

        // 2) ARRANQUE SECO (lo que hace toda apertura normal).
        let warm_pages_count = {
            let started = Instant::now();
            let output = metadata_cache::load_or_scan_vault_with_mode(&workdir, true)
                .expect("el arranque seco debe salir");
            let wall = started.elapsed();
            let stats = &output.stats;
            println!(
                "[perf-e2e] SECO: calle {:.3}s (scan interno {:.3}s, reutilizadas {}/{})",
                wall.as_secs_f32(),
                Duration::from_millis(stats.scan_ms as u64).as_secs_f32(),
                stats.reused_notes,
                stats.total_notes,
            );
            assert!(stats.cache_loaded, "el arranque seco debe cargar la caché");
            output.pages.len()
        };

        // 3) MEMORIA pico hasta el instante (VmHWM; incluye el copiado y frío).
        println!(
            "[perf-e2e] RSS pico del proceso: {:.1} MB (incluye copia temporal y frío)",
            peak_rss_kb() as f64 / 1024.0
        );

        let entries = &cold.cache.entries;
        let root = workdir.clone();

        // 4) GRAFO aristas servidas desde la caché (4-C).
        let graph_started = Instant::now();
        let links = graph_links_from_cache(entries);
        println!(
            "[perf-e2e] GRAFO: {} aristas en {:.2} ms ({barra} notas del caché)",
            links.len(),
            graph_started.elapsed().as_secs_f64() * 1000.0,
            barra = entries.len(),
        );

        // 5) RETROENLACES: 10 títulos muestreados (nota con refs imaginables).
        {
            let titles: Vec<String> = sample(
                &entries.values().map(|note| note.title.clone()).collect::<Vec<_>>(),
                10,
            );
            let per_call = Instant::now();
            let mut total_hits = 0usize;
            for title in &titles {
                total_hits += metadata_cache::find_cached_backlinks(&cold.cache, &root, title).len();
            }
            let wall = per_call.elapsed();
            println!(
                "[perf-e2e] BACKLINKS: 10 llamadas en {:.2} ms TOTAL (uno a uno {:.2} ms), {} retroenlaces acumulados",
                wall.as_secs_f64() * 1000.0,
                wall.as_secs_f64() * 100.0,
                total_hits,
            );
        }

        // 6) REHIDRATACIÓN: 5 lotes de 96 desde la caché (hit del
        //    read_pages_cached sin IO, sin reparsar).
        {
            let keys: Vec<String> = entries.keys().cloned().collect();
            let mut total = Duration::ZERO;
            let mut served = 0usize;
            for batch in sample(&keys, 96 * 5).chunks(96) {
                let started = Instant::now();
                for key in batch {
                    if let Some(note) = entries.get(key) {
                        let _page = note.to_page_data(&root);
                    }
                    served += 1;
                }
                total += started.elapsed();
            }
            println!(
                "[perf-e2e] REHIDRATACIÓN: {} notas en 5 lotes de 96 → {:.2} ms por lote",
                served,
                total.as_secs_f64() * 1000.0 / 5.0
            );
        }

        // 7) BÚSQUEDA: índice plegado (una vez) + consultas reales.
        {
            let index_started = Instant::now();
            let folded = build_folded_index(entries);
            println!(
                "[perf-e2e] ÍNDICE plegado: {:.2} ms (una vez por vault activo; luego solo deltas)",
                index_started.elapsed().as_secs_f64() * 1000.0
            );

            // Consultas sacadas del contenido real: dos tokens frecuentes y
            // tres consultas multi-token de bloques reales muestreados.
            let mut queries: Vec<Vec<String>> = Vec::new();
            queries.push(vec!["la".to_string()]);
            queries.push(vec!["de".to_string()]);
            let retrier: Vec<&metadata_cache::CachedNote> =
                sample(&entries.values().collect::<Vec<_>>(), 3);
            for note in retrier {
                let blocks = crate::VaultCacheRuntime::fold_note_entries(note)
                    .blocks
                    .iter()
                    .map(|b| b.folded.clone())
                    .collect::<Vec<_>>();
                let Some(pick) = blocks.iter().filter(|text| text.len() > 24).max_by_key(|text| text.len()) else {
                    continue;
                };
                let tokens: Vec<String> = pick
                    .split_whitespace()
                    .filter(|word| word.chars().count() > 3)
                    .take(2)
                    .map(|word| word.to_string())
                    .collect();
                if tokens.len() == 2 {
                    queries.push(tokens);
                }
            }

            for tokens in &queries {
                let started = Instant::now();
                let hits = run_content_search(&folded, entries, &root, tokens, 20);
                let wall = started.elapsed();
                println!(
                    "[perf-e2e] BUSQUEDA {:?}: {:.2} ms → {} hits",
                    tokens.join(" "),
                    wall.as_secs_f64() * 1000.0,
                    hits.len()
                );
            }
        }

        let _ = warm_pages_count;
        let _ = fs::remove_dir_all(&workdir);
        println!("[perf-e2e] Tempdir limpiado. (Lo que NO mide el arnés: la serialización IPC JSON al front y el montaje del árbol del editor; es cota inferior del tiempo de la app.)")
    }
}
