//! Índice de búsqueda por contenido: plegado, puntuación y comando `search_content`.
//! Extraído de `lib.rs` en la fase 14.7; mantiene índices UTF-16 y límites.

use crate::{active_root, metadata_cache, ActiveVault, BlockNode, PageData, VaultCacheState};
use regex::Regex;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use unicode_normalization::UnicodeNormalization;

/// FASE 4-B: resultado de `search_content` (una coincidencia por nota, tal
/// como producía el índice del front). `page` llega en su variante de
/// metadatos (sin bloques: el front la rehidrata con `read_pages_cached`);
/// `block` es el bloque ganador completo, para saltar al cursor y pintar el
/// fragmento del omnibar sin otra ronda de IPC.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchHit {
    /// Página ganadora (variante metadata: `blocksLoaded: false`).
    pub page: PageData,
    /// Bloque superior con la mejor aparición de la nota.
    pub block: BlockNode,
    /// Apariciones acumuladas de todos los tokens (tope 20 por token).
    pub count: usize,
    /// Índice de la primera coincidencia en el texto PLEGADO (unidades de
    /// código UTF-16 para que mapee con las posiciones de `locateMatch`).
    pub index: usize,
    /// Longitud del primer token coincidente en el texto plegado.
    pub match_length: usize,
}

/// Entrada plegada de un bloque con contenido visible del índice de búsqueda.
pub(crate) struct FoldedBlockEntry {
    pub id: String,
    pub folded: String,
}

/// Entrada plegada de una nota (la unidad de mantenimiento del índice).
pub(crate) struct FoldedNoteEntry {
    pub blocks: Vec<FoldedBlockEntry>,
}

/// Candidato interno de `search_content` antes de servir bloque/página.
pub(crate) struct ContentSearchCandidate {
    /// Id del bloque ganador de la nota (el de más apariciones).
    block_id: String,
    count: usize,
    index: usize,
    match_length: usize,
}

/// Plegado de texto sin mayúsculas ni acentos: el mismo criterio del `fold`
/// del front (lowercase + NFD + descartar marcas de acento). Los rangos
/// cubren las zonas Unicode de marcas combinantes que aparecen tras la
/// descomposición; equivale a `\p{Diacritic}` para los alfabetos latinos y
/// los diacríticos comunes.
pub(crate) fn fold_text(value: &str) -> String {
    const COMBINING_RANGES: [(u32, u32); 5] = [
        (0x0300, 0x036F), // Combining Diacritical Marks
        (0x1AB0, 0x1AFF), // Combining Extended
        (0x1DC0, 0x1DFF), // Combining Supplement
        (0x20D0, 0x20F0), // Combining Marks for Symbols
        (0xFE20, 0xFE2F), // Combining Half Marks
    ];
    value
        .to_lowercase()
        .nfd()
        .filter(|character| {
            let code = *character as u32;
            !COMBINING_RANGES
                .iter()
                .any(|(start, end)| code >= *start && code <= *end)
        })
        .collect()
}

/// Texto visible de un bloque: descarta líneas de propiedad `clave:: valor`
/// (misma regla que `visibleBlockText` en el front).
pub(crate) fn visible_block_text(content: &str) -> String {
    static PROPERTY_LINE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let pattern = PROPERTY_LINE.get_or_init(|| Regex::new(r"^[\w\-]+::\s*.*$").unwrap());
    content
        .split(['\r', '\n'])
        .filter(|line| !pattern.is_match(line.trim()))
        .collect::<Vec<&str>>()
        .join("\n")
}

/// Tokeniza la consulta plegada (criterio `normalizeQuery` del front).
pub(crate) fn normalize_search_query(query: &str) -> Vec<String> {
    fold_text(query)
        .split_whitespace()
        .map(|token| token.to_string())
        .collect()
}

/// Conteo de apariciones de `needle` en `haystack` con tope `cap` (criterio
/// `countOccurrences` con `MAX_COUNT_PER_TOKEN = 20`).
pub(crate) fn count_folded_occurrences(haystack: &str, needle: &str, cap: usize) -> usize {
    let mut count = 0;
    let mut offset = 0;
    while count < cap {
        let Some(found) = haystack[offset..].find(needle) else {
            break;
        };
        count += 1;
        offset += found + needle.len();
    }
    count
}

/// Índices plegados en unidades de código UTF-16: el front compara las pos
/// con `locateMatch` sobre strings JS, así que el servidor convierte el
/// desplazamiento en bytes del plegado Rust a code units.
pub(crate) fn folded_bytes_to_utf16_index(folded: &str, byte_index: usize) -> usize {
    folded[..byte_index].chars().map(char::len_utf16).sum()
}

/// Recorre el árbol de bloques y devuelve el nodo cuyo id coincide (para
/// servir el "best block" de un hit sin otra pasada del front).
pub(crate) fn find_block_by_id<'local>(nodes: &'local [BlockNode], id: &str) -> Option<&'local BlockNode> {
    for node in nodes {
        if node.id == id {
            return Some(node);
        }
        if let Some(found) = find_block_by_id(&node.children, id) {
            return Some(found);
        }
    }
    None
}

/// Núcleo de `search_content`, libre para poder probarlo sin `AppHandle`:
/// puntuación por nota sobre el plegado, orden (apariciones descendente con
/// desempate alfabético por ruta) y servido desde el cache (`page` en
/// variante metadata + bloque ganador completo).
pub(crate) fn run_content_search(
    folded_map: &HashMap<String, FoldedNoteEntry>,
    cache: &BTreeMap<String, metadata_cache::CachedNote>,
    root: &Path,
    tokens: &[String],
    limit: usize,
) -> Vec<ContentSearchHit> {
    if limit == 0 {
        return Vec::new();
    }
    // Puntuación: mejor bloque por nota, plegado en memoria (sin tocar
    // el cache con lock durante el scan).
    let mut candidates: Vec<(String, ContentSearchCandidate)> = Vec::new();
    for (relative, entry) in folded_map {
        let mut best: Option<ContentSearchCandidate> = None;
        for block in &entry.blocks {
            let mut total = 0;
            // (desplazamiento en bytes del plegado, longitud del token en unidades UTF-16)
            let mut first: Option<(usize, usize)> = None;
            let mut all_present = true;
            for token in tokens {
                let count = count_folded_occurrences(&block.folded, token, 20);
                if count == 0 {
                    all_present = false;
                    break;
                }
                total += count;
                if let Some(found) = block.folded.find(token.as_str()) {
                    let earlier = first.is_none_or(|(best_found, _)| found < best_found);
                    if earlier {
                        first = Some((found, token.chars().map(char::len_utf16).sum()));
                    }
                }
            }
            if !all_present {
                continue;
            }
            let Some((found_bytes, match_length)) = first else {
                continue;
            };
            let candidate = ContentSearchCandidate {
                block_id: block.id.clone(),
                count: total,
                index: folded_bytes_to_utf16_index(&block.folded, found_bytes),
                match_length,
            };
            if best.as_ref().is_none_or(|current| current.count < candidate.count) {
                best = Some(candidate);
            }
        }
        if let Some(candidate) = best {
            candidates.push((relative.clone(), candidate));
        }
    }

    // Orden estable: más apariciones primero, desempate alfabético.
    let order_candidates = |left: &(String, ContentSearchCandidate),
                           right: &(String, ContentSearchCandidate)| {
        right
            .1
            .count
            .cmp(&left.1.count)
            .then_with(|| left.0.cmp(&right.0))
    };
    if candidates.len() > limit {
        candidates.select_nth_unstable_by(limit, order_candidates);
        candidates.truncate(limit);
    }
    candidates.sort_by(order_candidates);

    // Servido: page (metadata) + bloque ganador desde el cache.
    let mut hits = Vec::with_capacity(candidates.len());
    for (relative, candidate) in candidates {
        let Some(note) = cache.get(&relative) else {
            continue;
        };
        let Some(block) = find_block_by_id(&note.blocks, &candidate.block_id) else {
            continue;
        };
        hits.push(ContentSearchHit {
            page: note.to_page_data_metadata(root),
            block: block.clone(),
            count: candidate.count,
            index: candidate.index,
            match_length: candidate.match_length,
        });
    }
    hits
}

/// FASE 4-B: búsqueda de contenido desde Rust. Mantén los criterios del
/// índice del front (`search` de `content-search.ts`): bloques donde
/// aparecen TODOS los tokens plegados, el mejor bloque por nota y el orden
/// por apariciones descendente. El frente solo pinta y salta al cursor.
#[tauri::command]
pub(crate) async fn search_content(
    query: String,
    limit: Option<usize>,
    state: tauri::State<'_, ActiveVault>,
    cache_state: tauri::State<'_, VaultCacheState>,
) -> Result<Vec<ContentSearchHit>, String> {
    let _vault_path = active_root(&state)?;
    let Some(runtime) = cache_state.current() else {
        return Err("search_content requiere bóveda local con caché activa.".to_string());
    };
    Ok(runtime.search_content(&query, limit.unwrap_or(25)))
}
