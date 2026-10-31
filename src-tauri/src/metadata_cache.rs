//! Persistent metadata cache for local (filesystem) vaults.
//!
//! The cache keeps the expensive result of parsing every Markdown note:
//! the block tree, frontmatter, extracted wikilinks/tags and a lightweight
//! flashcard summary. On startup the backend only reads `std::fs::metadata`
//! for each note; a note is re-parsed only when it is new or its modification
//! time/size changed. The cache lives in `<vault>/.sinnotas_cache.bin` and is
//! encoded with `bincode`.
//!
//! Security notes:
//! - Relative paths are validated with the same whitelist used by the rest of
//!   the backend (`resolve_note_path`): no `..`, URIs, null bytes, reserved
//!   folders (legacy `chronos`/`progress`, `.sinnotas`, `.git`) or temporary
//!   names.
//! - A cache file is untrusted input. Entries are re-validated and sanitized
//!   before they can become `PageData` for the frontend.
//! - The cache file never follows symlinks and is written atomically with a
//!   temporary file inside the vault root.

use crate::{
    is_safe_note_component, journal_date_from_relative_path, parse_markdown_with_frontmatter,
    resolve_note_path, stable_content_hash, BlockNode, PageData, SkippedEntry, MAX_BLOCK_DEPTH,
    NOTE_MAX_BYTES, RESERVED_DIRS,
};
use bincode::Options;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Component, Path};
use std::sync::LazyLock;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

/// Binary cache file stored at the vault root.
pub const CACHE_FILE_NAME: &str = ".sinnotas_cache.bin";
const CACHE_MAGIC: &[u8; 4] = b"SNC1";
// Historial de versiones (bincode no es auto-descriptivo: cada cambio de
// layout exige bump, y la caché incompatible se descarta con escaneo frío).
// v2: añade `created_ns`.
// v3: `CachedLinkReference.is_tag` separa wikilinks de `#tag`; las cachés
// antiguas no distinguían las dos gramáticas y se re-escanean una vez con el
// fallback de escaneo completo (el camino diseñado para cualquier migración).
const CACHE_FORMAT_VERSION: u32 = 3;
/// Defensive bound for the on-disk cache (a 20 MB note limit makes larger
/// caches implausible).
const MAX_CACHE_BYTES: u64 = 256 * 1024 * 1024;
const MAX_BLOCKS_PER_NOTE: usize = 200_000;
const MAX_BLOCK_CONTENT_BYTES: usize = 2 * 1024 * 1024;
const MAX_BLOCK_ID_BYTES: usize = 160;
const MAX_FRONTMATTER_LINES: usize = 20_000;
const MAX_FRONTMATTER_LINE_BYTES: usize = 64 * 1024;
const MAX_LINK_REFERENCES: usize = 20_000;
const MAX_LINK_TARGET_BYTES: usize = 512;
const MAX_LINK_SNIPPET_BYTES: usize = 2_048;
const MAX_TITLE_BYTES: usize = 512;

/// One extracted outbound reference (wikilink or `#tag`) with the line that
/// contains it. This is what makes cached backlink lookups possible without
/// reading the Markdown file again. `is_tag` separates the two grammars: los
/// retroenlaces cuentan ambos, pero el grafo solo forma aristas con
/// wikilinks (criterio `collectWikiLinkTitles` del front).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedLinkReference {
    /// Destino resuelto: para wikilinks se recorta el alias
    /// (`[[Destino|Alias]]` → `Destino`); para tags es el texto tras `#`.
    pub target: String,
    pub line_number: usize,
    pub snippet: String,
    #[serde(default)]
    pub is_tag: bool,
}

/// Cheap flashcard summary extracted from a note. The frontend still runs the
/// canonical detector; this summary lets the backend expose cache statistics
/// and invalidate views without parsing Markdown.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedFlashcardState {
    pub has_cards: bool,
    pub card_tags: u32,
    pub basic_cards: u32,
    pub cloze_cards: u32,
    pub image_occlusions: u32,
}

/// Everything the backend remembers about one note.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedNote {
    pub relative_path: String,
    /// Modification time in nanoseconds since the Unix epoch (ext4 keeps ns
    /// resolution, so same-second edits are not silently skipped).
    pub modified_ns: i64,
    /// Creation time in nanoseconds since the Unix epoch. `0` means the
    /// filesystem did not expose birthtime (the modification time is used as
    /// an approximation when converting to `PageData`).
    #[serde(default)]
    pub created_ns: i64,
    pub size: u64,
    pub content_hash: String,
    pub title: String,
    pub frontmatter: Vec<String>,
    pub blocks: Vec<BlockNode>,
    #[serde(default)]
    pub is_journal: bool,
    #[serde(default)]
    pub journal_date: Option<String>,
    #[serde(default)]
    pub links: Vec<CachedLinkReference>,
    #[serde(default)]
    pub flashcards: CachedFlashcardState,
}

/// Conteo PLANO de bloques de una nota: incluye los hijos anidados, igual
/// que `getAllBlocksFlat` en el front. Era el número que las vistas
/// resumen mostraban con el scan completo; `block_count` lo replica para
/// sufrir sin los árboles.
pub fn total_block_count(nodes: &[crate::BlockNode]) -> usize {
    fn walk(nodes: &[crate::BlockNode], out: &mut usize) {
        *out += nodes.len();
        for node in nodes {
            walk(&node.children, out);
        }
    }
    let mut total = 0;
    walk(nodes, &mut total);
    total
}

impl CachedNote {
    pub fn to_page_data(&self, root: &Path) -> PageData {
        let absolute = root.join(&self.relative_path);
        let mut hasher = DefaultHasher::new();
        absolute.hash(&mut hasher);
        PageData {
            id: format!("p-{:x}", hasher.finish()),
            title: self.title.clone(),
            path: absolute.to_string_lossy().into_owned(),
            frontmatter: self.frontmatter.clone(),
            blocks: self.blocks.clone(),
            is_journal: self.is_journal,
            journal_date: self.journal_date.clone(),
            updated_at_ms: (self.modified_ns > 0).then_some(self.modified_ns / 1_000_000),
            created_at_ms: Some(
                if self.created_ns > 0 {
                    self.created_ns
                } else {
                    self.modified_ns
                } / 1_000_000,
            ),
            blocks_loaded: true,
            block_count: total_block_count(&self.blocks),
        }
    }

    /// `PageData` SIN los árboles de bloques (FASE 4: arranque con
    /// metadatos y bloques bajo demanda). Conserva título/fechas/frontmatter
    /// y expone `block_count` para las vistas de resumen; el front
    /// rehidrata los bloques con `read_pages_cached` cuando los necesita.
    pub fn to_page_data_metadata(&self, root: &Path) -> PageData {
        let absolute = root.join(&self.relative_path);
        let mut hasher = DefaultHasher::new();
        absolute.hash(&mut hasher);
        PageData {
            id: format!("p-{:x}", hasher.finish()),
            title: self.title.clone(),
            path: absolute.to_string_lossy().into_owned(),
            frontmatter: self.frontmatter.clone(),
            blocks: Vec::new(),
            is_journal: self.is_journal,
            journal_date: self.journal_date.clone(),
            updated_at_ms: (self.modified_ns > 0).then_some(self.modified_ns / 1_000_000),
            created_at_ms: Some(
                if self.created_ns > 0 {
                    self.created_ns
                } else {
                    self.modified_ns
                } / 1_000_000,
            ),
            blocks_loaded: false,
            block_count: total_block_count(&self.blocks),
        }
    }
}

/// Serializable root of the binary cache.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultMetadataCache {
    pub version: u32,
    pub entries: BTreeMap<String, CachedNote>,
}

impl Default for VaultMetadataCache {
    fn default() -> Self {
        Self {
            version: CACHE_FORMAT_VERSION,
            entries: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheScanStats {
    pub total_notes: usize,
    pub parsed_notes: usize,
    pub reused_notes: usize,
    pub removed_entries: usize,
    pub cache_loaded: bool,
    pub cache_written: bool,
    pub scan_ms: u128,
    pub write_ms: u128,
}

pub struct CacheScanOutput {
    pub pages: Vec<PageData>,
    pub skipped: Vec<SkippedEntry>,
    pub cache: VaultMetadataCache,
    pub stats: CacheScanStats,
}

fn cache_options() -> impl Options {
    bincode::DefaultOptions::new()
        .with_fixint_encoding()
        .with_limit(MAX_CACHE_BYTES)
}

/// Reads and deserializes a cache file. Any corruption is treated as a cache
/// miss: the caller falls back to a cold scan instead of failing the vault.
pub fn load_cache_file(root: &Path) -> Option<VaultMetadataCache> {
    let path = root.join(CACHE_FILE_NAME);
    let metadata = fs::symlink_metadata(&path).ok()?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return None;
    }
    if metadata.len() > MAX_CACHE_BYTES {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    if !bytes.starts_with(CACHE_MAGIC) {
        return None;
    }
    let mut cache = cache_options()
        .deserialize::<VaultMetadataCache>(&bytes[CACHE_MAGIC.len()..])
        .ok()?;
    if cache.version != CACHE_FORMAT_VERSION {
        return None;
    }
    // Replay del diario de deltas al día (orden: registro a registro; las
    // reglas de apply_cache_delta son convergentes, así que rejugar registros
    // ya plegados en el archivo maestro es inofensivo). Se aplica ANTES de
    // sanitizar para validar también las entradas que trajo el diario.
    if let Some(records) = load_cache_delta(root) {
        let _applied = apply_cache_delta(&mut cache, &records);
    }
    sanitize_cache(root, &mut cache);
    Some(cache)
}

/// Serializes the cache to disk atomically (temp file + rename).
pub fn write_cache_file(root: &Path, cache: &VaultMetadataCache) -> Result<(), String> {
    let path = root.join(CACHE_FILE_NAME);
    let payload = bincode::DefaultOptions::new()
        .with_fixint_encoding()
        .serialize(cache)
        .map_err(|error| format!("No se pudo serializar la caché: {error}"))?;
    if payload.len() as u64 > MAX_CACHE_BYTES {
        return Err("La caché de metadatos supera el tamaño máximo permitido.".to_string());
    }

    let temp_name = format!(
        ".sinnotas-cache-tmp-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default()
    );
    let temp_path = root.join(temp_name);
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)
        .map_err(|error| error.to_string())?;
    let result = (|| -> Result<(), String> {
        file.write_all(CACHE_MAGIC)
            .map_err(|error| error.to_string())?;
        file.write_all(&payload)
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        match fs::rename(&temp_path, &path) {
            Ok(()) => Ok(()),
            Err(error) => {
                // Windows does not replace an existing destination with
                // `rename`. Remove it and retry; the cache is disposable and
                // the previous copy is only a fallback for the next launch.
                #[cfg(windows)]
                if path.exists() {
                    fs::remove_file(&path).map_err(|remove_error| remove_error.to_string())?;
                    return fs::rename(&temp_path, &path).map_err(|retry| retry.to_string());
                }
                Err(error.to_string())
            }
        }
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

// ==================== Diario de deltas (2.1/2.2) ====================

/// Journal of incremental cache updates, next to the main cache file. Every
/// `update_paths` batch appends framed records (an upsert or a delete) instead
/// of re-serializing the whole vault: with a cold 14k-note cache a full write
/// costs tens of ms of blocking work, while the journal costs O(delta).
/// On load the journal replays over the base cache; when it accumulates
/// `CACHE_DELTA_COMPACT_RECORDS` records it is folded back into the main
/// cache file and truncated.
pub const CACHE_DELTA_FILE_NAME: &str = ".sinnotas_cache_delta.log";
const CACHE_DELTA_MAGIC: &[u8; 4] = b"SND1";
const CACHE_DELTA_FORMAT_VERSION: u32 = 1;
/// Fold the journal back into the main cache after this many records.
pub const CACHE_DELTA_COMPACT_RECORDS: u64 = 256;
/// Defensive cap on how old a journaled record may be.
const MAX_CACHE_DELTA_RECORD_BYTES: usize = 64 * 1024 * 1024;
const MAX_CACHE_DELTA_RECORDS: usize = 512_000;

/// One journal record: an upsert (`note: Some`) or a delete (`note: None`,
/// with the deletion timestamp for convergence rules).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheDeltaRecord {
    pub relative_path: String,
    pub note: Option<CachedNote>,
    pub deleted_at_ns: i64,
}

fn delta_options() -> impl Options {
    bincode::DefaultOptions::new().with_fixint_encoding()
}

/// Framerate-free journal header: magic + version, written when the journal
/// is (re)created empty.
fn write_delta_header<W: Write>(file: &mut W) -> Result<(), String> {
    file.write_all(CACHE_DELTA_MAGIC)
        .map_err(|error| error.to_string())?;
    file.write_all(&CACHE_DELTA_FORMAT_VERSION.to_le_bytes())
        .map_err(|error| error.to_string())
}

fn is_delta_header_missing(path: &std::path::PathBuf) -> bool {
    fs::metadata(path)
        .map(|meta| meta.len() < 8)
        .unwrap_or(true)
}

/// Appends a batch of delta records (upserts then removes) to the journal,
/// creating an empty headered journal when needed, and fsyncs. Returns how
/// many records were actually appended.
pub fn append_cache_delta(
    root: &Path,
    changed: &[(String, CachedNote)],
    removed: &[(String, i64)],
) -> Result<usize, String> {
    if changed.is_empty() && removed.is_empty() {
        return Ok(0);
    }
    let path = root.join(CACHE_DELTA_FILE_NAME);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    if is_delta_header_missing(&path) {
        // A missing/short header means a fresh (or damaged) journal: since we
        // opened in append mode there is nothing to truncate, just stamp it.
        write_delta_header(&mut file)?;
    }
    let mut count = 0usize;
    for (relative, note) in changed {
        let record = CacheDeltaRecord {
            relative_path: relative.clone(),
            note: Some(note.clone()),
            deleted_at_ns: 0,
        };
        let payload = bincode::DefaultOptions::new()
            .with_fixint_encoding()
            .serialize(&record)
            .map_err(|error| format!("No se pudo serializar el delta: {error}"))?;
        file.write_all(&(payload.len() as u32).to_le_bytes())
            .map_err(|error| error.to_string())?;
        file.write_all(&payload).map_err(|error| error.to_string())?;
        count += 1;
    }
    for (relative, deleted_at_ns) in removed {
        let record = CacheDeltaRecord {
            relative_path: relative.clone(),
            note: None,
            deleted_at_ns: *deleted_at_ns,
        };
        let payload = bincode::DefaultOptions::new()
            .with_fixint_encoding()
            .serialize(&record)
            .map_err(|error| format!("No se pudo serializar el delta: {error}"))?;
        file.write_all(&(payload.len() as u32).to_le_bytes())
            .map_err(|error| error.to_string())?;
        file.write_all(&payload).map_err(|error| error.to_string())?;
        count += 1;
    }
    file.sync_all().map_err(|error| error.to_string())?;
    Ok(count)
}

/// Reads and parses the journal. A damaged or truncated tail is discarded
/// (the cache file plus the valid prefix is still consistent); returning
/// `None` means "no journal / unusable header" and replay is skipped.
pub fn load_cache_delta(root: &Path) -> Option<Vec<CacheDeltaRecord>> {
    let path = root.join(CACHE_DELTA_FILE_NAME);
    let bytes = fs::read(&path).ok()?;
    if bytes.len() < 8 || &bytes[..4] != CACHE_DELTA_MAGIC {
        return None;
    }
    let version = u32::from_le_bytes(
        bytes[4..8]
            .try_into()
            .ok()?,
    );
    if version != CACHE_DELTA_FORMAT_VERSION {
        return None;
    }
    let mut records = Vec::new();
    let mut cursor = 8usize;
    while cursor + 4 <= bytes.len() && records.len() < MAX_CACHE_DELTA_RECORDS {
        let length = u32::from_le_bytes(bytes[cursor..cursor + 4].try_into().ok()?) as usize;
        cursor += 4;
        if length > MAX_CACHE_DELTA_RECORD_BYTES {
            break;
        }
        let end = cursor.checked_add(length)?;
        if end > bytes.len() {
            // Truncated tail (crash mid-append): stop at the last full record.
            break;
        }
        let record = delta_options()
            .deserialize::<CacheDeltaRecord>(&bytes[cursor..end])
            .ok()?;
        cursor = end;
        records.push(record);
    }
    Some(records)
}

/// Replays journal records over a base cache. Rules are convergent so that
/// re-playing a journal that survived a mid-compaction crash cannot revert
/// newer changes:
/// - Upsert: only wins when the cached entry is strictly older
///   (`cached.modified_ns >= note.modified_ns` → keep the cached one).
/// - Delete: applies unless a later upsert already re-created the note
///   (`cached.modified_ns > deleted_at_ns` → keep).
///
/// Returns the number of records that actually changed the base.
pub fn apply_cache_delta(cache: &mut VaultMetadataCache, records: &[CacheDeltaRecord]) -> usize {
    let mut applied = 0usize;
    for record in records {
        match (&record.note, record.deleted_at_ns) {
            (Some(note), _) => {
                let dominated = cache
                    .entries
                    .get(&record.relative_path)
                    .is_some_and(|cached| cached.modified_ns >= note.modified_ns);
                if !dominated {
                    cache
                        .entries
                        .insert(record.relative_path.clone(), note.clone());
                    applied += 1;
                }
            }
            (None, deleted_at_ns) => {
                let dominated = cache
                    .entries
                    .get(&record.relative_path)
                    .is_some_and(|cached| cached.modified_ns > deleted_at_ns);
                if !dominated && cache.entries.remove(&record.relative_path).is_some() {
                    applied += 1;
                }
            }
        }
    }
    applied
}

/// Truncates the journal back to its (empty) header. Used (a) right after a
/// cold scan rewrites the main cache — the scan already saw the current
/// disk state, so pending records are stale — and (b) after compaction.
pub fn truncate_cache_delta(root: &Path) -> Result<(), String> {
    let path = root.join(CACHE_DELTA_FILE_NAME);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    write_delta_header(&mut file)?;
    file.sync_all().map_err(|error| error.to_string())
}

/// Compaction: rewrite the main cache file, then drop the journal whose
/// records are now folded into it. Caller must serialize this against
/// concurrent `append_cache_delta` calls (the runtime persist lock).
pub fn compact_cache_file(root: &Path, cache: &VaultMetadataCache) -> Result<(), String> {
    write_cache_file(root, cache)?;
    truncate_cache_delta(root)
}

/// Deterministic fingerprint of a materialized cache: size + ordered
/// (path, mtime, size, content hash) tuples. O(notes) string hashing, no
/// IPC/IO — used by `vault_sync_state` to detect changes without reloading.
pub fn vault_fingerprint(cache: &VaultMetadataCache) -> u64 {
    let mut hasher = DefaultHasher::new();
    hasher.write_u64(cache.entries.len() as u64);
    for (relative, note) in &cache.entries {
        hasher.write(relative.as_bytes());
        hasher.write_u8(0);
        hasher.write_i64(note.modified_ns);
        hasher.write_u8(0);
        hasher.write_u64(note.size);
        hasher.write_u8(0);
        hasher.write(note.content_hash.as_bytes());
        hasher.write_u8(0);
    }
    hasher.finish()
}

/// Converts a watcher path to a normalized vault-relative note path, if it is
/// a valid `.md` note inside the root. Returns `None` for cache files, temp
/// files, reserved folders and anything outside the vault.
pub fn relative_note_path(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    if relative.as_os_str().is_empty() {
        return None;
    }
    let normalized = relative.to_string_lossy().replace('\\', "/");
    if normalized.contains("sinnotas-tmp")
        || normalized.contains(CACHE_FILE_NAME.trim_start_matches('.'))
        || normalized.contains(CACHE_DELTA_FILE_NAME.trim_start_matches('.'))
    {
        return None;
    }
    sanitize_relative_path(root, &normalized).ok()
}

/// Validates a cache path with the backend whitelist and returns its canonical
/// normalized form. Absolute paths are rejected for cache entries.
pub fn sanitize_relative_path(root: &Path, relative: &str) -> Result<String, String> {
    if relative.is_empty() || relative.contains('\0') {
        return Err("Ruta de caché vacía o con bytes nulos.".to_string());
    }
    if relative.contains('\\') {
        return Err("La caché debe usar separadores '/'.".to_string());
    }
    let path = Path::new(relative);
    if path.is_absolute() {
        return Err("La caché no puede contener rutas absolutas.".to_string());
    }
    if path.components().any(|component| {
        !matches!(component, Component::Normal(_)) || matches!(component, Component::CurDir)
    }) {
        return Err("La caché contiene componentes de ruta no permitidos.".to_string());
    }
    for component in path.components() {
        let Component::Normal(part) = component else {
            return Err("Componente de ruta no válido.".to_string());
        };
        let text = part
            .to_str()
            .ok_or_else(|| "Componente de ruta no UTF-8.".to_string())?;
        if !is_safe_note_component(text) {
            return Err(format!("Componente reservado o no permitido: {text}"));
        }
    }
    if path.extension().and_then(|extension| extension.to_str()) != Some("md") {
        return Err("La caché solo puede indexar notas .md.".to_string());
    }
    // Final canonical check: symlinks must not escape the vault either.
    resolve_note_path(root, relative)?;
    Ok(relative.to_string())
}

fn sanitize_cache(root: &Path, cache: &mut VaultMetadataCache) {
    let mut valid = BTreeMap::new();
    for (key, note) in std::mem::take(&mut cache.entries) {
        if key == note.relative_path && sanitize_cached_note(root, &note).is_ok() {
            valid.insert(key, note);
        }
    }
    cache.version = CACHE_FORMAT_VERSION;
    cache.entries = valid;
}

/// Re-validates a cache entry. The cache file is user-writable data, so it must
/// pass the same path/entry whitelist as a freshly parsed note before reaching
/// the frontend.
pub fn sanitize_cached_note(root: &Path, note: &CachedNote) -> Result<(), String> {
    let normalized = sanitize_relative_path(root, &note.relative_path)?;
    if normalized != note.relative_path {
        return Err("La ruta de caché no está normalizada.".to_string());
    }
    if note.modified_ns < 0 {
        return Err("mtime inválido en la caché.".to_string());
    }
    if note.created_ns < 0 {
        return Err("ctime inválido en la caché.".to_string());
    }
    if note.size > NOTE_MAX_BYTES {
        return Err("La nota en caché supera el límite de tamaño.".to_string());
    }
    if note.title.is_empty() || note.title.len() > MAX_TITLE_BYTES {
        return Err("Título inválido en la caché.".to_string());
    }
    let file_stem = Path::new(&note.relative_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if note.title != file_stem {
        return Err("El título no coincide con el nombre del archivo.".to_string());
    }
    if note.frontmatter.len() > MAX_FRONTMATTER_LINES {
        return Err("Frontmatter demasiado grande en la caché.".to_string());
    }
    if note
        .frontmatter
        .iter()
        .any(|line| line.len() > MAX_FRONTMATTER_LINE_BYTES || line.contains('\0'))
    {
        return Err("Frontmatter inválido en la caché.".to_string());
    }
    if note.links.len() > MAX_LINK_REFERENCES {
        return Err("Demasiadas referencias en la caché.".to_string());
    }
    for link in &note.links {
        if link.target.is_empty()
            || link.target.len() > MAX_LINK_TARGET_BYTES
            || link.line_number == 0
            || link.snippet.len() > MAX_LINK_SNIPPET_BYTES
            || link.target.contains('\0')
            || link.snippet.contains('\0')
        {
            return Err("Referencia inválida en la caché.".to_string());
        }
    }
    let mut count = 0usize;
    validate_blocks(&note.blocks, 0, &mut count)
}

fn validate_blocks(blocks: &[BlockNode], depth: usize, count: &mut usize) -> Result<(), String> {
    if depth > MAX_BLOCK_DEPTH {
        return Err("Árbol de bloques demasiado profundo en la caché.".to_string());
    }
    for block in blocks {
        *count += 1;
        if *count > MAX_BLOCKS_PER_NOTE {
            return Err("Demasiados bloques en la caché.".to_string());
        }
        if block.id.is_empty() || block.id.len() > MAX_BLOCK_ID_BYTES || block.id.contains('\0') {
            return Err("Id de bloque inválido en la caché.".to_string());
        }
        if !matches!(block.block_type.as_str(), "text" | "image") {
            return Err("Tipo de bloque no permitido en la caché.".to_string());
        }
        if block.content.len() > MAX_BLOCK_CONTENT_BYTES || block.content.contains('\0') {
            return Err("Contenido de bloque inválido en la caché.".to_string());
        }
        if block
            .image_alt
            .as_ref()
            .is_some_and(|alt| alt.len() > MAX_LINK_SNIPPET_BYTES || alt.contains('\0'))
        {
            return Err("Texto alternativo inválido en la caché.".to_string());
        }
        validate_blocks(&block.children, depth + 1, count)?;
    }
    Ok(())
}

fn modified_ns(metadata: &fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| i64::try_from(duration.as_nanos()).ok())
        .unwrap_or(0)
}

fn created_ns(metadata: &fs::Metadata) -> i64 {
    metadata
        .created()
        .or_else(|_| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| i64::try_from(duration.as_nanos()).ok())
        .unwrap_or(0)
}

fn is_reserved_dir(entry: &walkdir::DirEntry) -> bool {
    entry.depth() > 0
        && entry.file_type().is_dir()
        && RESERVED_DIRS.iter().any(|reserved| {
            entry
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case(reserved)
        })
}

fn extract_links(content: &str) -> Vec<CachedLinkReference> {
    let mut links = Vec::new();
    for (index, line) in content.lines().enumerate() {
        if links.len() >= MAX_LINK_REFERENCES {
            break;
        }
        let snippet = truncate_chars(line.trim(), MAX_LINK_SNIPPET_BYTES);

        // Wikilinks: [[target]]. Manual scanning avoids a large Unicode regex
        // and keeps the parser bounded on pathological lines.
        let mut cursor = 0;
        while let Some(open) = line[cursor..].find("[[") {
            let start = cursor + open + 2;
            let Some(close) = line[start..].find("]]") else {
                break;
            };
            let target = line[start..start + close].trim();
            // Con alias la arista apunta al destino real: `[[Destino|Alias]]`
            // enlaza a `Destino` (lo que ya hacía el scan del front para los
            // retroenlaces; sin esto el alias quedaba pegado al título).
            let target = target.split('|').next().unwrap_or(target).trim();
            if !target.is_empty()
                && target.len() <= MAX_LINK_TARGET_BYTES
                && !target.contains(['[', ']', '\r', '\n', '\0'])
            {
                links.push(CachedLinkReference {
                    target: target.to_string(),
                    line_number: index + 1,
                    snippet: snippet.clone(),
                    is_tag: false,
                });
                if links.len() >= MAX_LINK_REFERENCES {
                    break;
                }
            }
            cursor = start + close + 2;
            if cursor >= line.len() {
                break;
            }
        }

        // Inline tags: #tag. A tag starts after a boundary and uses letters,
        // digits, underscore, slash or hyphen.
        let characters: Vec<(usize, char)> = line.char_indices().collect();
        for (position, (_, character)) in characters.iter().enumerate() {
            if *character != '#' {
                continue;
            }
            let previous = position
                .checked_sub(1)
                .and_then(|previous| characters.get(previous))
                .map(|(_, value)| *value);
            if previous.is_some_and(|value| value.is_alphanumeric() || value == '_') {
                continue;
            }
            let mut target = String::new();
            for (_, next) in characters.iter().skip(position + 1) {
                if next.is_alphanumeric() || matches!(next, '_' | '/' | '-') {
                    target.push(*next);
                    if target.len() >= MAX_LINK_TARGET_BYTES {
                        break;
                    }
                } else {
                    break;
                }
            }
            if !target.is_empty() && target.len() <= MAX_LINK_TARGET_BYTES {
                links.push(CachedLinkReference {
                    target,
                    line_number: index + 1,
                    snippet: snippet.clone(),
                    is_tag: true,
                });
                if links.len() >= MAX_LINK_REFERENCES {
                    break;
                }
            }
        }
    }
    links
}

fn truncate_chars(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_string();
    }
    let mut end = max_bytes;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_string()
}

/// Regex de tarjetas de relleno (cloze). Compilada una sola vez: se usa en
/// cada re-parseo de notas y compilaba una copia nueva por llamada.
static CLOZE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\{\{(?:c\d+::|cloze\s+)?(.*?)\}\}|==(.*?)==").expect("cloze regex")
});

fn flashcard_state(blocks: &[BlockNode]) -> CachedFlashcardState {
    let mut state = CachedFlashcardState::default();
    let mut stack: Vec<&BlockNode> = blocks.iter().collect();
    while let Some(block) = stack.pop() {
        let content = &block.content;
        let has_card_tag = content
            .split(|character: char| character.is_whitespace() || character == '(')
            .any(|token| token.eq_ignore_ascii_case("#card"));
        let has_colon = content.contains("::");
        if content.to_ascii_lowercase().contains("image-occlusions::") {
            state.image_occlusions = state.image_occlusions.saturating_add(1);
        }
        if CLOZE_RE.is_match(content) {
            state.cloze_cards = state.cloze_cards.saturating_add(1);
            state.has_cards = true;
        } else if has_card_tag || has_colon {
            state.basic_cards = state.basic_cards.saturating_add(1);
            state.has_cards = true;
        }
        if has_card_tag {
            state.card_tags = state.card_tags.saturating_add(1);
        }
        for child in &block.children {
            stack.push(child);
        }
    }
    state
}

/// Builds a cache entry from Markdown content already in memory.
pub fn cached_note_from_content(
    relative_path: &str,
    modified_ns: i64,
    created_ns: i64,
    size: u64,
    content: &str,
) -> Result<CachedNote, String> {
    let title = Path::new(relative_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|title| !title.is_empty())
        .ok_or_else(|| "La nota no tiene un nombre de archivo válido.".to_string())?
        .to_string();
    let (frontmatter, blocks) = parse_markdown_with_frontmatter(content);
    let journal_date = journal_date_from_relative_path(relative_path);
    let flashcards = flashcard_state(&blocks);
    let note = CachedNote {
        relative_path: relative_path.to_string(),
        modified_ns,
        created_ns,
        size,
        content_hash: stable_content_hash(content.as_bytes()),
        title,
        frontmatter,
        blocks,
        is_journal: journal_date.is_some(),
        journal_date,
        links: extract_links(content),
        flashcards,
    };
    let mut count = 0usize;
    validate_blocks(&note.blocks, 0, &mut count)?;
    Ok(note)
}

/// Reads a note from disk and builds its cache entry. `Ok(None)` means the
/// note no longer exists (deleted or renamed).
pub fn read_cached_note(root: &Path, relative: &str) -> Result<Option<CachedNote>, String> {
    let relative = sanitize_relative_path(root, relative)?;
    let path = resolve_note_path(root, &relative)?;
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    if !metadata.is_file() {
        return Ok(None);
    }
    if metadata.len() > NOTE_MAX_BYTES {
        return Err(format!(
            "Nota supera el límite de 20 MB ({} bytes)",
            metadata.len()
        ));
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    cached_note_from_content(
        &relative,
        modified_ns(&metadata),
        created_ns(&metadata),
        metadata.len(),
        &content,
    )
    .map(Some)
}

/// Loads the cache (if any), sweeps the vault with `std::fs::metadata` and
/// reparses only new/modified notes.
pub fn load_or_scan_vault(root: &Path) -> Result<CacheScanOutput, String> {
    load_or_scan_vault_with_mode(root, false)
}

/// FASE 4: con `metadata_only = true`, las páginas del arranque NO traen los
/// árboles de bloques (títulos/fechas/frontmatter/límites de bloques sí); el
/// front las rehidrata a demanda con `read_pages_cached`. La caché en disco
/// sigue idéntica: el modo afecta solo al payload IPC.
pub fn load_or_scan_vault_with_mode(
    root: &Path,
    metadata_only: bool,
) -> Result<CacheScanOutput, String> {
    let started = std::time::Instant::now();
    let canonical_root =
        fs::canonicalize(root).map_err(|_| "El vault activo no está disponible.".to_string())?;
    let mut previous = load_cache_file(&canonical_root);
    let mut stats = CacheScanStats {
        cache_loaded: previous.is_some(),
        ..CacheScanStats::default()
    };
    let old_entries = previous
        .take()
        .map(|cache| cache.entries)
        .unwrap_or_default();
    let original_keys: BTreeSet<String> = old_entries.keys().cloned().collect();

    let mut entries = BTreeMap::new();
    let mut pages = Vec::new();
    let mut skipped = Vec::new();
    let mut seen = BTreeSet::new();

    let walker = WalkDir::new(&canonical_root)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|entry| {
            if is_reserved_dir(entry) {
                return false;
            }
            entry.metadata().is_ok()
        });

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                skipped.push(SkippedEntry {
                    path: error
                        .path()
                        .map(|path| path.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "desconocido".to_string()),
                    reason: format!("Error de acceso: {error}"),
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
            Ok(metadata) => metadata,
            Err(error) => {
                skipped.push(SkippedEntry {
                    path: path.to_string_lossy().into_owned(),
                    reason: format!("No se pudieron leer metadatos: {error}"),
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
        let relative = match path.strip_prefix(&canonical_root) {
            Ok(relative) => relative.to_string_lossy().replace('\\', "/"),
            Err(_) => {
                skipped.push(SkippedEntry {
                    path: path.to_string_lossy().into_owned(),
                    reason: "Nota fuera del vault".to_string(),
                });
                continue;
            }
        };
        let relative = match sanitize_relative_path(&canonical_root, &relative) {
            Ok(relative) => relative,
            Err(error) => {
                skipped.push(SkippedEntry {
                    path: path.to_string_lossy().into_owned(),
                    reason: error,
                });
                continue;
            }
        };

        let mtime = modified_ns(&metadata);
        let size = metadata.len();
        let reusable = old_entries.get(&relative).filter(|cached| {
            cached.modified_ns == mtime
                && cached.size == size
                && sanitize_cached_note(&canonical_root, cached).is_ok()
        });

        let note = if let Some(cached) = reusable {
            stats.reused_notes += 1;
            cached.clone()
        } else {
            let content = match fs::read_to_string(path) {
                Ok(content) => content,
                Err(error) => {
                    skipped.push(SkippedEntry {
                        path: path.to_string_lossy().into_owned(),
                        reason: format!("No se pudo leer (UTF-8 inválido o error E/S): {error}"),
                    });
                    continue;
                }
            };
            match cached_note_from_content(&relative, mtime, created_ns(&metadata), size, &content)
            {
                Ok(note) => {
                    stats.parsed_notes += 1;
                    note
                }
                Err(error) => {
                    skipped.push(SkippedEntry {
                        path: path.to_string_lossy().into_owned(),
                        reason: error,
                    });
                    continue;
                }
            }
        };

        seen.insert(relative.clone());
        pages.push(if metadata_only {
            note.to_page_data_metadata(&canonical_root)
        } else {
            note.to_page_data(&canonical_root)
        });
        entries.insert(relative, note);
    }

    stats.total_notes = pages.len();
    stats.removed_entries = original_keys.difference(&seen).count();
    let cache = VaultMetadataCache {
        version: CACHE_FORMAT_VERSION,
        entries,
    };
    let dirty = stats.parsed_notes > 0
        || stats.removed_entries > 0
        || !stats.cache_loaded
        || old_entries.len() != cache.entries.len();
    if dirty {
        let write_started = std::time::Instant::now();
        if write_cache_file(&canonical_root, &cache).is_ok() {
            stats.cache_written = true;
            // El escaneo ya vio el estado actual del disco: cualquier registro
            // pendiente del diario es viejo. Se trunca para que la próxima
            // carga no re-pliegue registros obsoletos sobre el maestro fresco.
            let _ = truncate_cache_delta(&canonical_root);
        }
        stats.write_ms = write_started.elapsed().as_millis();
    }
    stats.scan_ms = started.elapsed().as_millis();

    Ok(CacheScanOutput {
        pages,
        skipped,
        cache,
        stats,
    })
}

/// Cached backlink lookup used by `find_backlinks` on filesystem vaults.
pub fn find_cached_backlinks(
    cache: &VaultMetadataCache,
    root: &Path,
    page_title: &str,
) -> Vec<crate::Backlink> {
    let mut backlinks = Vec::new();
    for note in cache.entries.values() {
        if note.title.eq_ignore_ascii_case(page_title) {
            continue;
        }
        for link in &note.links {
            if link.target.eq_ignore_ascii_case(page_title) {
                backlinks.push(crate::Backlink {
                    source_page: note.title.clone(),
                    source_path: root
                        .join(&note.relative_path)
                        .to_string_lossy()
                        .into_owned(),
                    line_number: link.line_number,
                    snippet: link.snippet.clone(),
                });
            }
        }
    }
    backlinks
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_root(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "sinnotas-cache-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::canonicalize(root).unwrap()
    }

    fn sample_content() -> &'static str {
        "---\ntags:\n  - study\n---\n- Pregunta :: respuesta #card\ncard-s:: 0.4\n  - Enlace a [[Otra nota]]\n"
    }

    #[test]
    fn cache_round_trips_through_bincode_and_disk() {
        let root = test_root("roundtrip");
        let note =
            cached_note_from_content("pages/nota.md", 123, 100, 456, sample_content()).unwrap();
        let mut cache = VaultMetadataCache::default();
        cache
            .entries
            .insert(note.relative_path.clone(), note.clone());

        write_cache_file(&root, &cache).unwrap();
        let loaded = load_cache_file(&root).expect("la caché debe cargarse");
        assert_eq!(loaded.version, CACHE_FORMAT_VERSION);
        assert_eq!(loaded.entries.len(), 1);
        let loaded_note = loaded.entries.get("pages/nota.md").unwrap();
        assert_eq!(loaded_note.title, "nota");
        assert_eq!(loaded_note.modified_ns, 123);
        assert_eq!(loaded_note.blocks.len(), 1);
        assert!(loaded_note.flashcards.has_cards);
        assert_eq!(loaded_note.flashcards.card_tags, 1);
        assert!(loaded_note
            .links
            .iter()
            .any(|link| link.target == "Otra nota"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn corrupt_or_foreign_cache_files_are_ignored() {
        let root = test_root("corrupt");
        fs::write(root.join(CACHE_FILE_NAME), b"not a cache").unwrap();
        assert!(load_cache_file(&root).is_none());

        fs::write(root.join(CACHE_FILE_NAME), b"SNC1\xff\xff\xff").unwrap();
        assert!(load_cache_file(&root).is_none());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cache_entries_cannot_escape_the_vault_or_spoof_titles() {
        let root = test_root("scope");
        let mut note =
            cached_note_from_content("pages/nota.md", 1, 1, 10, "- contenido\n").unwrap();
        note.relative_path = "../outside.md".to_string();
        assert!(sanitize_cached_note(&root, &note).is_err());

        note.relative_path = "chronos/nota.md".to_string();
        assert!(sanitize_cached_note(&root, &note).is_err());

        note.relative_path = "pages/nota.md".to_string();
        note.title = "otra".to_string();
        assert!(sanitize_cached_note(&root, &note).is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn warm_scan_reuses_mtimes_and_parses_only_modified_notes() {
        let root = test_root("warm");
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::write(root.join("pages/a.md"), "- nota a\n").unwrap();
        fs::write(root.join("pages/b.md"), "- nota b\n").unwrap();

        let cold = load_or_scan_vault(&root).unwrap();
        assert_eq!(cold.pages.len(), 2);
        assert_eq!(cold.stats.parsed_notes, 2);
        assert_eq!(cold.stats.reused_notes, 0);

        let warm = load_or_scan_vault(&root).unwrap();
        assert_eq!(warm.pages.len(), 2);
        assert_eq!(warm.stats.parsed_notes, 0);
        assert_eq!(warm.stats.reused_notes, 2);

        std::thread::sleep(std::time::Duration::from_millis(5));
        fs::write(root.join("pages/a.md"), "- nota a modificada\n").unwrap();
        fs::write(root.join("pages/c.md"), "- nota c\n").unwrap();
        let mixed = load_or_scan_vault(&root).unwrap();
        assert_eq!(mixed.pages.len(), 3);
        assert_eq!(mixed.stats.parsed_notes, 2);
        assert_eq!(mixed.stats.reused_notes, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn stale_cache_entries_are_removed_when_files_disappear() {
        let root = test_root("stale");
        fs::write(root.join("borrada.md"), "- temporal\n").unwrap();
        let first = load_or_scan_vault(&root).unwrap();
        assert_eq!(first.cache.entries.len(), 1);

        fs::remove_file(root.join("borrada.md")).unwrap();
        let second = load_or_scan_vault(&root).unwrap();
        assert!(second.pages.is_empty());
        assert!(second.cache.entries.is_empty());
        assert_eq!(second.stats.removed_entries, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn metadata_only_scan_serves_blocks_on_demand() {
        let root = test_root("metadata-only");
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::write(root.join("pages/nota.md"), "- uno\n- dos\n- tres\n").unwrap();

        // Modo metadata-only: sin árboles, pero con metadatos y conteo.
        let metadata_scan = load_or_scan_vault_with_mode(&root, true).unwrap();
        assert_eq!(metadata_scan.pages.len(), 1);
        let metadata_page = &metadata_scan.pages[0];
        assert!(metadata_page.blocks.is_empty());
        assert!(!metadata_page.blocks_loaded);
        assert_eq!(metadata_page.block_count, 3);
        assert_eq!(metadata_page.title, "nota");
        assert_eq!(metadata_page.path, root.join("pages/nota.md").to_string_lossy());

        // Modo completo: bloques presentes y conteo coherente.
        let full_scan = load_or_scan_vault_with_mode(&root, false).unwrap();
        let full_page = &full_scan.pages[0];
        assert!(full_page.blocks_loaded);
        assert_eq!(full_page.block_count, 3);
        assert_eq!(full_page.blocks.len(), 3);
        // El id deriva de la ruta absoluta: estable entre ambos modos.
        assert_eq!(metadata_page.id, full_page.id);

        // Rehidratación individual: la entrada cacheada sigue disponible para
        // el comando `read_pages_cached` (sirve `to_page_data` sobre la misma
        // `CachedNote`; aquí solo verificamos la conservación del conteo).
        let cached = full_scan.cache.entries.get("pages/nota.md").unwrap();
        let served = cached.to_page_data(&root);
        assert!(served.blocks_loaded);
        assert_eq!(served.block_count, 3);
        let metadata_served = cached.to_page_data_metadata(&root);
        assert!(!metadata_served.blocks_loaded);
        assert_eq!(metadata_served.block_count, 3);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cached_backlinks_are_found_without_reopening_notes() {
        let root = test_root("backlinks");
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::write(
            root.join("pages/origen.md"),
            "- Texto con [[Destino]] y #Destino\n",
        )
        .unwrap();
        fs::write(root.join("pages/destino.md"), "- destino\n").unwrap();
        let output = load_or_scan_vault(&root).unwrap();
        let backlinks = find_cached_backlinks(&output.cache, &root, "Destino");
        assert_eq!(backlinks.len(), 2);
        assert_eq!(backlinks[0].source_page, "origen");
        assert_eq!(backlinks[0].line_number, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cache_delta_round_trips_with_upserts_and_removes() {
        let root = test_root("delta-roundtrip");
        let note = cached_note_from_content("pages/nota.md", 100, 0, 10, "- contenido\n").unwrap();

        // Caché base en disco SIN la nota.
        write_cache_file(&root, &VaultMetadataCache::default()).unwrap();

        // Upsert por diario.
        assert_eq!(
            append_cache_delta(&root, &[("pages/nota.md".to_string(), note.clone())], &[]).unwrap(),
            1
        );
        let loaded = load_cache_file(&root).expect("el diario debe rejugarse");
        assert!(loaded.entries.contains_key("pages/nota.md"));
        assert_eq!(loaded.entries["pages/nota.md"].modified_ns, 100);

        // Upsert más nuevo gana al envejecer de diario.
        let newer = cached_note_from_content("pages/nota.md", 200, 0, 10, "- otro\n").unwrap();
        append_cache_delta(&root, &[("pages/nota.md".to_string(), newer)], &[]).unwrap();
        let reloaded = load_cache_file(&root).unwrap();
        assert_eq!(reloaded.entries["pages/nota.md"].modified_ns, 200);

        // Upsert más viejo NO revierte al plegado.
        let older = cached_note_from_content("pages/nota.md", 150, 0, 10, "- viejo\n").unwrap();
        append_cache_delta(&root, &[("pages/nota.md".to_string(), older)], &[]).unwrap();
        let reloaded = load_cache_file(&root).unwrap();
        assert_eq!(reloaded.entries["pages/nota.md"].modified_ns, 200);

        // Borrado: la nota desaparece.
        append_cache_delta(&root, &[], &[("pages/nota.md".to_string(), 900)]).unwrap();
        let reloaded = load_cache_file(&root).unwrap();
        assert!(reloaded.entries.is_empty());

        // Borrado con recreación posterior (mtime > delete): la recreación gana.
        let recreated = cached_note_from_content("pages/nota.md", 1_000, 0, 10, "- nueva\n").unwrap();
        append_cache_delta(
            &root,
            &[("pages/nota.md".to_string(), recreated)],
            &[("pages/nota.md".to_string(), 900)],
        )
        .unwrap();
        let reloaded = load_cache_file(&root).unwrap();
        assert_eq!(reloaded.entries["pages/nota.md"].modified_ns, 1_000);

        // Compacción: plega el diario y trunca; la carga sigue igual.
        let snapshot = load_cache_file(&root).unwrap();
        compact_cache_file(&root, &snapshot).unwrap();
        let reloaded = load_cache_file(&root).unwrap();
        assert_eq!(reloaded.entries["pages/nota.md"].modified_ns, 1_000);
        let journal = load_cache_delta(&root).unwrap_or_default();
        assert!(journal.is_empty());

        // Fingerprint determinista y sensible al contenido.
        let before = vault_fingerprint(&reloaded);
        assert_eq!(before, vault_fingerprint(&load_cache_file(&root).unwrap()));
        let other_note =
            cached_note_from_content("pages/otra.md", 1_000, 0, 10, "- otra\n").unwrap();
        append_cache_delta(&root, &[("pages/otra.md".to_string(), other_note)], &[]).unwrap();
        let after = vault_fingerprint(&load_cache_file(&root).unwrap());
        assert_ne!(before, after);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn journal_tail_damage_is_tolerated_and_header_versioning_rejects_old_layouts() {
        let root = test_root("delta-damage");
        let note = cached_note_from_content("pages/nota.md", 100, 0, 10, "- contenido\n").unwrap();
        let other =
            cached_note_from_content("pages/nota.md", 200, 0, 10, "- segundo\n").unwrap();
        append_cache_delta(
            &root,
            &[
                ("pages/nota.md".to_string(), note),
                ("pages/nota.md".to_string(), other),
            ],
            &[],
        )
        .unwrap();

        let journal_path = root.join(CACHE_DELTA_FILE_NAME);
        let bytes = fs::read(&journal_path).unwrap();

        // Cola truncada: se conservan los registros completos (aquí solo hay
        // uno; la carga no debe fallar por bytes rotos).
        let mut damaged = bytes.clone();
        damaged.pop();
        fs::write(&journal_path, damaged).unwrap();
        let records = load_cache_delta(&root).unwrap();
        assert_eq!(records.len(), 1);

        // Cabecera de versión incompatible: el diario se ignora (la base gana).
        let mut wrong_version = bytes.clone();
        wrong_version[7] = 0xFF;
        fs::write(&journal_path, wrong_version).unwrap();
        assert!(load_cache_delta(&root).is_none());

        // Truncado de diario (compacción/cold scan): vacía y válida.
        truncate_cache_delta(&root).unwrap();
        assert!(load_cache_delta(&root).unwrap().is_empty());
        assert_eq!(
            append_cache_delta(
                &root,
                &[(
                    "pages/otra.md".to_string(),
                    cached_note_from_content("pages/otra.md", 5, 0, 5, "- o\n").unwrap()
                )],
                &[]
            )
            .unwrap(),
            1
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cold_scan_after_journal_activity_truncates_pending_records() {
        let root = test_root("delta-cold-scan");
        fs::write(root.join("fresca.md"), "- nota desde el diario\n").unwrap();
        // Journal dice que la nota tiene OTRO contenido más nuevo en disco.
        let stale = cached_note_from_content(
            "fresca.md",
            i64::MAX / 2,
            0,
            3,
            "- contenido que ya no existe\n",
        )
        .unwrap();
        append_cache_delta(&root, &[("fresca.md".to_string(), stale)], &[]).unwrap();

        // El escaneo frío reescribe la caché desde el disco real y trunca el
        // diario: el contenuo viejo del diario no puede reinsertarse encima
        // del estado real en la siguiente carga.
        let output = load_or_scan_vault(&root).unwrap();
        assert!(output.stats.cache_written);
        let journal = load_cache_delta(&root).unwrap_or_default();
        assert!(journal.is_empty(), "el diario debe vaciarse tras el cold scan");
        let reloaded = load_or_scan_vault(&root).unwrap();
        assert!(reloaded
            .pages
            .iter()
            .all(|page| page.blocks[0].content.contains("desde el diario")));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cached_links_separate_wikilinks_from_tags_and_resolve_alias() {
        // El alias se recorta del destino (el grafo y los retroenlaces
        // enlazan al título real) y `is_tag` distingue las dos gramáticas.
        let links =
            extract_links("- error [[|Alias]] no vale\n- [[Destino|Alias]] y [[Otra]] y #Papel\n");
        assert_eq!(links.len(), 3);
        assert_eq!(links[0].target, "Destino");
        assert!(!links[0].is_tag);
        assert_eq!(links[1].target, "Otra");
        assert!(!links[1].is_tag);
        assert_eq!(links[2].target, "Papel");
        assert!(links[2].is_tag);

        // Wikilinks repetidos se cachean dos veces: el radio de nodo del
        // grafo front cuenta apariciones.
        let links = extract_links("- [[Igual]] y [[Igual]]\n");
        assert_eq!(links.len(), 2);
        assert!(links.iter().all(|link| !link.is_tag));
    }

    #[test]
    fn cache_from_older_format_is_discarded_and_rescanned() {
        let root = test_root("migracion-formato");
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::write(root.join("pages/nota.md"), "- Enlaza a [[Destino]]\n").unwrap();

        let scanned = load_or_scan_vault(&root).unwrap();

        // Simula un archivo en formato v2 (histórico: sin `is_tag`): la
        // versión no coincide y la caché se descarta en favor del escaneo.
        let old = VaultMetadataCache {
            version: 2,
            entries: scanned.cache.entries.clone(),
        };
        write_cache_file(&root, &old).unwrap();
        assert!(load_cache_file(&root).is_none());

        let rescanned = load_or_scan_vault(&root).unwrap();
        assert_eq!(rescanned.cache.version, CACHE_FORMAT_VERSION);
        let note = rescanned.cache.entries.get("pages/nota.md").unwrap();
        let link = note.links.first().unwrap();
        assert_eq!(link.target, "Destino");
        assert!(!link.is_tag);

        fs::remove_dir_all(root).unwrap();
    }
}
