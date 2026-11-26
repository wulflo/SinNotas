//! Gestión de snapshots automáticos/manuales (`.sinnotas/chronos`).
//! Extraído de `lib.rs` en la fase 14.6; los comandos Tauri conservan su nombre.

use crate::{
    active_root, format_utc_timestamp, now_millis, parse_markdown_with_frontmatter,
    resolve_note_path, resolve_vault_path, serialize_page_to_markdown, stable_content_hash,
    write_file_atomically, ActiveVault, PageRevision, RestoredSnapshot,
    SnapshotConfig, SnapshotGate, SnapshotNoteSummary, SnapshotRecord, SnapshotState,
    INTERNAL_FOLDER, PROGRESS_FOLDER, SNAPSHOT_CLOCK_TOLERANCE_MS, SNAPSHOT_CONFIG_FILE,
    SNAPSHOT_FOLDER, SNAPSHOT_FORMAT_VERSION, SNAPSHOT_MAX_BYTES, SNAPSHOT_MAX_DAYS,
    SNAPSHOT_MAX_FILES_PER_NOTE, SNAPSHOT_RETENTION_MS, SNAPSHOT_SEQUENCE,
};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

/// Ruta relativa de una carpeta interna (siempre dentro de `.sinnotas/`).
pub(crate) fn internal_vault_relative(folder: &str) -> String {
    format!("{INTERNAL_FOLDER}/{folder}")
}

/// Devuelve una carpeta interna del vault, creándola si hace falta y
/// comprobando que el resultado canónico sigue dentro de la bóveda.
pub(crate) fn internal_vault_folder(root: &Path, folder: &str) -> Result<PathBuf, String> {
    let canonical_root = fs::canonicalize(root).map_err(|err| err.to_string())?;
    let path = resolve_vault_path(&canonical_root, &internal_vault_relative(folder))?;
    fs::create_dir_all(&path).map_err(|err| err.to_string())?;
    let canonical_path = fs::canonicalize(&path).map_err(|err| err.to_string())?;
    if !canonical_path.starts_with(&canonical_root) || !canonical_path.is_dir() {
        return Err("La carpeta interna no pertenece al vault activo.".to_string());
    }
    Ok(canonical_path)
}

pub(crate) fn snapshot_root(root: &Path) -> Result<PathBuf, String> {
    internal_vault_folder(root, SNAPSHOT_FOLDER)
}

/// Mueve el contenido de `source` a `destination`. Si el destino ya existe,
/// combina carpeta por carpeta sin sobrescribir archivos. No sigue enlaces
/// simbólicos: una bóveda manipulada no puede sacar datos fuera del vault.
pub(crate) fn move_or_merge_directory(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(source) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Ok(());
    }

    if !destination.exists() {
        if let Some(parent) = destination.parent() {
            if let Ok(metadata) = fs::symlink_metadata(parent) {
                if metadata.file_type().is_symlink() || !metadata.is_dir() {
                    return Err("La carpeta interna del vault no es válida.".to_string());
                }
            }
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        return fs::rename(source, destination).map_err(|error| error.to_string());
    }

    let destination_metadata =
        fs::symlink_metadata(destination).map_err(|error| error.to_string())?;
    if destination_metadata.file_type().is_symlink() || !destination_metadata.is_dir() {
        return Err("La carpeta de destino no es un directorio real.".to_string());
    }
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    let entries = fs::read_dir(source).map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let entry_metadata =
            fs::symlink_metadata(&source_path).map_err(|error| error.to_string())?;
        if entry_metadata.file_type().is_symlink() {
            continue;
        }
        if entry_metadata.is_dir() {
            move_or_merge_directory(&source_path, &destination_path)?;
        } else if !destination_path.exists() {
            fs::rename(&source_path, &destination_path).map_err(|error| error.to_string())?;
        }
    }

    // Solo se retira la carpeta antigua si quedó vacía; si había conflictos,
    // se conserva para no borrar datos que el usuario todavía podría necesitar.
    let _ = fs::remove_dir(source);
    Ok(())
}

/// Migra `chronos/` y `progress/` a `.sinnotas/` una sola vez. Es idempotente:
/// los vaults nuevos ya no tienen las carpetas antiguas en la raíz.
pub(crate) fn migrate_internal_folders(root: &Path) -> Result<(), String> {
    let internal = root.join(INTERNAL_FOLDER);
    fs::create_dir_all(&internal).map_err(|error| error.to_string())?;
    let internal_metadata = fs::symlink_metadata(&internal).map_err(|error| error.to_string())?;
    if internal_metadata.file_type().is_symlink() || !internal_metadata.is_dir() {
        return Err("La carpeta interna del vault no puede ser un enlace simbólico.".to_string());
    }

    move_or_merge_directory(&root.join(SNAPSHOT_FOLDER), &internal.join(SNAPSHOT_FOLDER))?;

    let progress_destination = internal.join(PROGRESS_FOLDER);
    if let Some(parent) = progress_destination.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    move_or_merge_directory(&root.join(PROGRESS_FOLDER), &progress_destination)?;
    Ok(())
}

/// Clave relativa segura de una nota (sin `.md`). Evita `..`, rutas absolutas y
/// enlaces simbólicos: el resultado siempre se usa dentro de `.sinnotas/chronos/`.
pub(crate) fn snapshot_note_key(root: &Path, note_path: &Path) -> Result<String, String> {
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

pub(crate) fn snapshot_dir_for_note(root: &Path, note_path: &Path) -> Result<PathBuf, String> {
    let key = snapshot_note_key(root, note_path)?;
    Ok(snapshot_root(root)?.join(key))
}

pub(crate) fn path_is_markdown_note(path: &Path) -> bool {
    path.extension().and_then(|value| value.to_str()) == Some("md")
}

/// Ruta relativa visible de una nota dentro del vault (siempre con `.md`).
pub(crate) fn snapshot_note_relative_path(root: &Path, note_path: &Path) -> Result<String, String> {
    Ok(format!("{}.md", snapshot_note_key(root, note_path)?))
}

/// Cada nota guarda su propia configuración dentro de `.sinnotas/chronos/<nota>/`.
/// Así el interruptor y el vencimiento son independientes por página y viajan
/// con la nota cuando se renombra.
pub(crate) fn snapshot_config_path_for_note(root: &Path, note_path: &Path) -> Result<PathBuf, String> {
    Ok(snapshot_dir_for_note(root, note_path)?.join(SNAPSHOT_CONFIG_FILE))
}

/// Mueve los snapshots cuando se renombra una nota. Si el destino ya tiene
/// archivos (por ejemplo, una nota borrada y recreada), se combinan sin
/// sobrescribir snapshots existentes.
pub(crate) fn move_snapshot_dir_for_note(root: &Path, old_note: &Path, new_note: &Path) -> Result<(), String> {
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

pub(crate) fn quarantine_file(path: &Path) {
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

pub(crate) fn read_snapshot_config_from_path(path: &Path) -> SnapshotConfig {
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

pub(crate) fn read_note_snapshot_config(root: &Path, note_path: &Path) -> Result<SnapshotConfig, String> {
    let path = snapshot_config_path_for_note(root, note_path)?;
    Ok(read_snapshot_config_from_path(&path))
}

pub(crate) fn write_note_snapshot_config(
    root: &Path,
    note_path: &Path,
    config: &SnapshotConfig,
) -> Result<(), String> {
    let path = snapshot_config_path_for_note(root, note_path)?;
    let json = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    write_file_atomically(&path, &json)
}

pub(crate) fn snapshot_count_for_note(root: &Path, note_path: &Path) -> usize {
    snapshot_dir_for_note(root, note_path)
        .map(|dir| snapshot_json_entries(&dir).len())
        .unwrap_or(0)
}

pub(crate) fn snapshot_state_for_note(
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

pub(crate) fn snapshot_note_summary(
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

pub(crate) fn snapshot_json_entries(dir: &Path) -> Vec<PathBuf> {
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

pub(crate) fn read_snapshot_record(path: &Path) -> Option<SnapshotRecord> {
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

pub(crate) fn latest_snapshot_record(dir: &Path) -> Option<SnapshotRecord> {
    let files = snapshot_json_entries(dir);
    for path in files.iter().rev() {
        if let Some(record) = read_snapshot_record(path) {
            return Some(record);
        }
    }
    None
}

pub(crate) fn snapshot_file_timestamp(path: &Path) -> Option<i64> {
    let name = path.file_name()?.to_str()?;
    let rest = name.strip_prefix("snap-")?;
    let stamp = rest.split('-').next()?;
    stamp.parse::<i64>().ok()
}

pub(crate) fn snapshot_count_for_day(dir: &Path, now: i64) -> usize {
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

pub(crate) fn prune_note_snapshots(dir: &Path, max_files: usize) {
    let files = snapshot_json_entries(dir);
    if files.len() <= max_files {
        return;
    }
    let remove_count = files.len() - max_files;
    for path in files.iter().take(remove_count) {
        let _ = fs::remove_file(path);
    }
}

pub(crate) fn create_snapshot_for_note(
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

pub(crate) fn snapshot_note_if_changed(
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

pub(crate) fn cleanup_old_snapshots(root: &Path, now: i64) -> Result<(), String> {
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

pub(crate) fn collect_note_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut notes = Vec::new();
    let walker = WalkDir::new(root)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 || !entry.file_type().is_dir() {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            !matches!(
                name.as_ref(),
                SNAPSHOT_FOLDER | PROGRESS_FOLDER | ".sinnotas" | ".git"
            )
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

/// Todos los `config.json` de snapshots por nota dentro de `.sinnotas/chronos/`.
/// Queda fuera el antiguo `chronos/config.json` global (profundidad 1).
pub(crate) fn snapshot_config_files(root: &Path) -> Vec<PathBuf> {
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

/// Convierte la carpeta `.sinnotas/chronos/<ruta>/` en la ruta relativa de su nota.
pub(crate) fn note_path_for_snapshot_dir(root: &Path, dir: &Path) -> Result<PathBuf, String> {
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

pub(crate) fn prune_empty_snapshot_dirs(root: &Path) -> Result<(), String> {
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

pub(crate) fn remove_snapshot_dir_if_safe(folder: &Path, dir: &Path) {
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
pub(crate) fn delete_note_snapshots_from_root(root: &Path, note_path: &Path) -> Result<(), String> {
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
/// Vacía el contenido de `.sinnotas/chronos/` (configuraciones, versiones y temporales)
/// pero conserva la carpeta raíz para futuros snapshots. Devuelve el número de
/// entradas eliminadas. Nunca sigue enlaces simbólicos.
pub(crate) fn delete_all_snapshots_from_root(root: &Path) -> Result<usize, String> {
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
pub(crate) fn migrate_legacy_global_snapshot_config(root: &Path, now: i64) -> Result<(), String> {
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
pub(crate) fn activate_snapshots_in_root(
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
pub(crate) fn disable_snapshots_in_root(root: &Path, note_path: &Path) -> Result<SnapshotState, String> {
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

pub(crate) fn list_active_snapshot_notes_from_root(root: &Path) -> Result<Vec<SnapshotNoteSummary>, String> {
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
pub(crate) fn tick_snapshots_in_root(root: &Path) -> Result<Vec<SnapshotNoteSummary>, String> {
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

pub(crate) fn is_safe_snapshot_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 160
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

pub(crate) fn read_note_snapshots_from_root(
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

pub(crate) fn restore_snapshot_from_root(
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

/// Devuelve el estado actual de los snapshots de una nota concreta.
#[tauri::command]
pub(crate) fn get_snapshot_state(
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
pub(crate) fn activate_snapshots(
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
pub(crate) fn disable_snapshots(
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
pub(crate) fn list_active_snapshot_notes(
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<SnapshotNoteSummary>, String> {
    let root = active_root(&state)?;
    list_active_snapshot_notes_from_root(&root)
}

/// Borra los snapshots de una nota y desactiva su seguimiento.
#[tauri::command(async)]
pub(crate) fn delete_note_snapshots(
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
pub(crate) fn delete_all_snapshots(
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
pub(crate) fn tick_snapshots(
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
pub(crate) fn read_note_snapshots(
    file_path: String,
    state: tauri::State<'_, ActiveVault>,
) -> Result<Vec<PageRevision>, String> {
    let root = active_root(&state)?;
    let note = resolve_note_path(&root, &file_path)?;
    read_note_snapshots_from_root(&root, &note)
}

/// Restaura una nota desde un snapshot concreto de `.sinnotas/chronos/`.
#[tauri::command(async)]
pub(crate) fn restore_snapshot(
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
pub(crate) fn migrate_legacy_snapshots(state: tauri::State<'_, ActiveVault>) -> Result<(), String> {
    let root = active_root(&state)?;
    crate::migrate_legacy_revisions(&root, true)
}
