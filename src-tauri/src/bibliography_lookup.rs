//! Búsqueda de metadatos bibliográficos para la vista de Bibliografía.
//!
//! Es el **único** punto de la aplicación que hace peticiones HTTP salientes
//! para Bibliografía. El frontend nunca construye URLs ni elige hosts: envía
//! una consulta ya saneada y el backend decide el proveedor.
//!
//! Proveedores:
//! - Crossref para DOI y artículos.
//! - Open Library para ISBN y libros.
//!
//! Controles de seguridad principales:
//! - Solo HTTPS, sin redirecciones y con TLS de `rustls` + raíces webpki.
//! - Hosts constantes; no se aceptan URLs del usuario.
//! - Timeouts de conexión y totales.
//! - Cuerpo máximo de 2 MiB, leído por chunks.
//! - `Content-Type` JSON obligatorio.
//! - Rate limit, caché en memoria y límite de resultados.
//! - Todo texto remoto se sanea antes de salir de este módulo.
//! - Los enlaces y portadas solo se aceptan si son HTTPS y de un host
//!   allowlist.

use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use url::Url;

const CROSSREF_WORKS: &str = "https://api.crossref.org/works";
const OPENLIBRARY_SEARCH: &str = "https://openlibrary.org/search.json";
const OPENLIBRARY_BOOKS: &str = "https://openlibrary.org/api/books";
const OPENLIBRARY_BASE: &str = "https://openlibrary.org";

/// Hosts a los que se permite apuntar un enlace devuelto a la UI.
const ALLOWED_RESULT_HOSTS: &[&str] = &["doi.org", "dx.doi.org", "openlibrary.org"];
/// Único host permitido para portadas remotas.
const ALLOWED_COVER_HOST: &str = "covers.openlibrary.org";

const USER_AGENT: &str = concat!(
    "SinNotas/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/wulflo/SinNotas)"
);
const MAX_QUERY_CHARS: usize = 256;
const MAX_RESULTS: usize = 16;
const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(12);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MIN_REQUEST_INTERVAL: Duration = Duration::from_millis(750);
const CACHE_TTL: Duration = Duration::from_secs(10 * 60);
const CACHE_MAX_ENTRIES: usize = 32;

/// Resultado normalizado que consume el frontend.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupResult {
    pub provider: String,
    pub kind: String,
    pub title: String,
    pub subtitle: String,
    pub authors: String,
    pub year: String,
    pub publisher: String,
    pub container: String,
    pub doi: String,
    pub isbn: String,
    pub url: String,
    pub pages: u32,
    pub cover_url: String,
    pub abstract_text: String,
}

/// Error con un código estable para que la UI lo traduzca sin mostrar detalles
/// internos ni el cuerpo de la respuesta remota.
#[derive(Debug, Serialize)]
pub struct LookupError {
    pub code: String,
    pub message: String,
}

impl LookupError {
    fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
        }
    }

    fn invalid_query() -> Self {
        Self::new("invalid_query", "La consulta no es válida.")
    }

    fn not_found() -> Self {
        Self::new("not_found", "No se encontró ningún recurso.")
    }

    fn rate_limited() -> Self {
        Self::new(
            "rate_limited",
            "Demasiadas búsquedas seguidas. Espera un momento.",
        )
    }

    fn too_large() -> Self {
        Self::new(
            "too_large",
            "La respuesta del servicio era demasiado grande.",
        )
    }

    fn invalid_response() -> Self {
        Self::new(
            "invalid_response",
            "El servicio devolvió una respuesta no válida.",
        )
    }

    fn internal() -> Self {
        Self::new("internal", "No se pudo completar la búsqueda.")
    }
}

impl std::fmt::Display for LookupError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.code)
    }
}

impl std::error::Error for LookupError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Mode {
    Doi,
    Isbn,
    Keywords,
}

impl Mode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Doi => "doi",
            Self::Isbn => "isbn",
            Self::Keywords => "keywords",
        }
    }
}

struct CacheEntry {
    created: Instant,
    results: Vec<LookupResult>,
}

/// Comando de Tauri. No expone URLs ni parámetros de red: solo una consulta y
/// un modo. Devuelve resultados ya saneados.
#[tauri::command]
pub async fn bibliography_lookup(
    query: String,
    mode: Option<String>,
) -> Result<Vec<LookupResult>, LookupError> {
    let clean_query = sanitize_query(&query)?;
    let requested = mode
        .as_deref()
        .unwrap_or("auto")
        .trim()
        .to_ascii_lowercase();
    let (resolved_mode, value) = resolve_mode(&clean_query, &requested)?;

    let cache_key = format!(
        "{}:{}",
        resolved_mode.as_str(),
        match resolved_mode {
            Mode::Doi | Mode::Keywords => value.to_lowercase(),
            Mode::Isbn => value.clone(),
        }
    );
    if let Some(cached) = cache_get(&cache_key) {
        return Ok(cached);
    }

    enforce_rate_limit()?;
    let client = http_client()?;

    let results = match resolved_mode {
        Mode::Doi => lookup_crossref_doi(client, &value).await?,
        Mode::Isbn => lookup_openlibrary_isbn(client, &value).await?,
        Mode::Keywords => lookup_keywords(client, &value).await?,
    };

    if results.is_empty() {
        return Err(LookupError::not_found());
    }

    let results = dedupe(results);
    cache_put(cache_key, results.clone());
    Ok(results)
}

/* ==================== Validación de la consulta ==================== */

fn sanitize_query(raw: &str) -> Result<String, LookupError> {
    if raw.chars().count() > MAX_QUERY_CHARS {
        return Err(LookupError::invalid_query());
    }

    let mut out = String::with_capacity(raw.len());
    let mut pending_space = false;
    for character in raw.chars() {
        // Los controles C0/C1 no tienen sitio en una consulta. Un salto de
        // línea pegado se convierte en espacio; el resto se rechaza.
        if character.is_control() {
            if character.is_whitespace() {
                pending_space = !out.is_empty();
                continue;
            }
            return Err(LookupError::invalid_query());
        }
        if is_unsafe_format_character(character) {
            // Zero-width y controles bidi: se eliminan para que no puedan
            // ocultar texto ni falsear el orden visual.
            continue;
        }
        if character.is_whitespace() {
            pending_space = !out.is_empty();
            continue;
        }
        if pending_space {
            out.push(' ');
            pending_space = false;
        }
        out.push(character);
    }

    let trimmed = out.trim().to_string();
    if trimmed.is_empty() {
        return Err(LookupError::invalid_query());
    }
    Ok(trimmed)
}

fn is_unsafe_format_character(character: char) -> bool {
    matches!(
        character,
        '\u{200B}'..='\u{200F}'
            | '\u{202A}'..='\u{202E}'
            | '\u{2060}'..='\u{2064}'
            | '\u{2066}'..='\u{206F}'
            | '\u{FEFF}'
    )
}

fn resolve_mode(raw: &str, requested: &str) -> Result<(Mode, String), LookupError> {
    match requested {
        "doi" => Ok((Mode::Doi, normalize_doi(raw)?)),
        "isbn" => Ok((Mode::Isbn, normalize_isbn(raw)?)),
        "keywords" => Ok((Mode::Keywords, raw.to_string())),
        "auto" | "" => {
            if looks_like_doi(raw) {
                return Ok((Mode::Doi, normalize_doi(raw)?));
            }
            if looks_like_isbn(raw) {
                return Ok((Mode::Isbn, normalize_isbn(raw)?));
            }
            Ok((Mode::Keywords, raw.to_string()))
        }
        _ => Err(LookupError::invalid_query()),
    }
}

fn strip_doi_prefix(value: &str) -> &str {
    let trimmed = value.trim();
    let lowercase = trimmed.to_ascii_lowercase();
    for prefix in [
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
        "doi:",
    ] {
        if lowercase.starts_with(prefix) {
            return trimmed[prefix.len()..].trim();
        }
    }
    trimmed
}

fn looks_like_doi(raw: &str) -> bool {
    let value = strip_doi_prefix(raw);
    value.starts_with("10.") && value.contains('/')
}

fn normalize_doi(raw: &str) -> Result<String, LookupError> {
    let value = strip_doi_prefix(raw);
    if value.len() > 200 || !value.is_ascii() {
        return Err(LookupError::invalid_query());
    }

    let Some((prefix, suffix)) = value.split_once('/') else {
        return Err(LookupError::invalid_query());
    };
    let Some(digits) = prefix.strip_prefix("10.") else {
        return Err(LookupError::invalid_query());
    };
    if digits.len() < 4 || digits.len() > 9 || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(LookupError::invalid_query());
    }
    if suffix.is_empty() || suffix.len() > 200 {
        return Err(LookupError::invalid_query());
    }
    if suffix.bytes().any(|byte| {
        byte.is_ascii_control()
            || byte == b' '
            || byte == b'\\'
            || byte == b'"'
            || byte == b'<'
            || byte == b'>'
    }) {
        return Err(LookupError::invalid_query());
    }

    Ok(format!("10.{digits}/{suffix}"))
}

fn looks_like_isbn(raw: &str) -> bool {
    let cleaned: String = raw
        .chars()
        .filter(|character| !character.is_whitespace() && *character != '-')
        .collect();
    matches!(cleaned.len(), 10 | 13)
        && cleaned
            .chars()
            .all(|character| character.is_ascii_digit() || character == 'X' || character == 'x')
}

fn normalize_isbn(raw: &str) -> Result<String, LookupError> {
    let mut cleaned = String::with_capacity(raw.len());
    for character in raw.trim().chars() {
        match character {
            '0'..='9' => cleaned.push(character),
            'x' | 'X' => cleaned.push('X'),
            '-' | ' ' | '\u{2010}'..='\u{2015}' | '\u{2212}' => {}
            _ => return Err(LookupError::invalid_query()),
        }
    }

    match cleaned.len() {
        10 if isbn10_valid(&cleaned) => Ok(isbn10_to_13(&cleaned)),
        13 if isbn13_valid(&cleaned) => Ok(cleaned),
        _ => Err(LookupError::invalid_query()),
    }
}

fn isbn10_valid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 {
        return false;
    }
    let mut sum = 0u32;
    for (index, byte) in bytes.iter().enumerate() {
        let digit = match byte {
            b'0'..=b'9' => u32::from(byte - b'0'),
            b'X' if index == 9 => 10,
            _ => return false,
        };
        sum += digit * (10 - index as u32);
    }
    sum.is_multiple_of(11)
}

fn isbn13_valid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 13 {
        return false;
    }
    let mut sum = 0u32;
    for (index, byte) in bytes.iter().enumerate() {
        if !byte.is_ascii_digit() {
            return false;
        }
        let digit = u32::from(byte - b'0');
        sum += if index % 2 == 0 { digit } else { digit * 3 };
    }
    sum.is_multiple_of(10)
}

fn isbn10_to_13(value: &str) -> String {
    let core = &value[..9];
    let mut digits = String::with_capacity(13);
    digits.push_str("978");
    digits.push_str(core);
    let mut sum = 0u32;
    for (index, byte) in digits.bytes().enumerate() {
        let digit = u32::from(byte - b'0');
        sum += if index % 2 == 0 { digit } else { digit * 3 };
    }
    let check = (10 - (sum % 10)) % 10;
    format!("{digits}{check}")
}

/* ==================== Cliente HTTP y límites ==================== */

fn http_client() -> Result<&'static reqwest::Client, LookupError> {
    static CLIENT: OnceLock<Result<reqwest::Client, ()>> = OnceLock::new();
    match CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .https_only(true)
            // Ningún 3xx se sigue: evita que un proveedor (o un atacante que
            // controle su DNS) redirija la petición a otro host.
            .redirect(reqwest::redirect::Policy::none())
            .timeout(REQUEST_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .build()
            .map_err(|_| ())
    }) {
        Ok(client) => Ok(client),
        Err(()) => Err(LookupError::internal()),
    }
}

fn enforce_rate_limit() -> Result<(), LookupError> {
    static LAST_REQUEST: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    let mut last = LAST_REQUEST
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| LookupError::internal())?;
    let now = Instant::now();
    if let Some(previous) = *last {
        if now.duration_since(previous) < MIN_REQUEST_INTERVAL {
            return Err(LookupError::rate_limited());
        }
    }
    *last = Some(now);
    Ok(())
}

fn cache_get(key: &str) -> Option<Vec<LookupResult>> {
    static CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .ok()?;
    let expired = cache
        .get(key)
        .map(|entry| entry.created.elapsed() > CACHE_TTL)
        .unwrap_or(false);
    if expired {
        cache.remove(key);
        return None;
    }
    cache.get(key).map(|entry| entry.results.clone())
}

fn cache_put(key: String, results: Vec<LookupResult>) {
    static CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();
    let Ok(mut cache) = CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock() else {
        return;
    };
    if cache.len() >= CACHE_MAX_ENTRIES {
        if let Some(oldest) = cache
            .iter()
            .min_by_key(|(_, entry)| entry.created)
            .map(|(key, _)| key.clone())
        {
            cache.remove(&oldest);
        }
    }
    cache.insert(
        key,
        CacheEntry {
            created: Instant::now(),
            results,
        },
    );
}

async fn get_json(client: &reqwest::Client, url: Url) -> Result<Value, LookupError> {
    let response = client
        .get(url)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(map_request_error)?;

    let status = response.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err(LookupError::not_found());
    }
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status == reqwest::StatusCode::SERVICE_UNAVAILABLE
    {
        return Err(LookupError::rate_limited());
    }
    if !status.is_success() {
        return Err(LookupError::new(
            "upstream",
            &format!("El servicio respondió con {}.", status.as_u16()),
        ));
    }

    let is_json = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            let value = value.to_ascii_lowercase();
            value.starts_with("application/json") || value.contains("+json")
        })
        .unwrap_or(false);
    if !is_json {
        return Err(LookupError::invalid_response());
    }

    let body = read_limited(response).await?;
    serde_json::from_slice::<Value>(&body).map_err(|_| LookupError::invalid_response())
}

async fn read_limited(mut response: reqwest::Response) -> Result<Vec<u8>, LookupError> {
    if response
        .content_length()
        .map(|length| length > MAX_BODY_BYTES as u64)
        .unwrap_or(false)
    {
        return Err(LookupError::too_large());
    }

    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_request_error)? {
        if body.len().saturating_add(chunk.len()) > MAX_BODY_BYTES {
            return Err(LookupError::too_large());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

fn map_request_error(error: reqwest::Error) -> LookupError {
    if error.is_timeout() {
        LookupError::new("timeout", "La búsqueda tardó demasiado.")
    } else if error.is_connect() {
        LookupError::new(
            "network",
            "No se pudo conectar con el servicio de metadatos.",
        )
    } else {
        LookupError::new("network", "La búsqueda falló por un problema de red.")
    }
}

/* ==================== Proveedores ==================== */

async fn lookup_crossref_doi(
    client: &reqwest::Client,
    doi: &str,
) -> Result<Vec<LookupResult>, LookupError> {
    let mut url = Url::parse(CROSSREF_WORKS).map_err(|_| LookupError::internal())?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| LookupError::internal())?;
        for part in doi.split('/') {
            segments.push(part);
        }
    }
    let value = get_json(client, url).await?;
    let message = value
        .get("message")
        .ok_or_else(LookupError::invalid_response)?;
    let result = crossref_result(message).ok_or_else(LookupError::not_found)?;
    Ok(vec![result])
}

async fn lookup_crossref_search(
    client: &reqwest::Client,
    query: &str,
) -> Result<Vec<LookupResult>, LookupError> {
    let mut url = Url::parse(CROSSREF_WORKS).map_err(|_| LookupError::internal())?;
    url.query_pairs_mut()
        .append_pair("query.bibliographic", query)
        .append_pair("rows", "10");
    let value = get_json(client, url).await?;
    let items = value
        .pointer("/message/items")
        .and_then(Value::as_array)
        .ok_or_else(LookupError::invalid_response)?;
    Ok(items.iter().filter_map(crossref_result).collect())
}

async fn lookup_openlibrary_isbn(
    client: &reqwest::Client,
    isbn: &str,
) -> Result<Vec<LookupResult>, LookupError> {
    let mut url = Url::parse(OPENLIBRARY_BOOKS).map_err(|_| LookupError::internal())?;
    url.query_pairs_mut()
        .append_pair("bibkeys", &format!("ISBN:{isbn}"))
        .append_pair("format", "json")
        .append_pair("jscmd", "data");
    let value = get_json(client, url).await?;
    let book = value
        .as_object()
        .and_then(|entries| entries.values().next())
        .ok_or_else(LookupError::not_found)?;
    if book.is_null() {
        return Err(LookupError::not_found());
    }
    let result = openlibrary_book(book, isbn).ok_or_else(LookupError::not_found)?;
    Ok(vec![result])
}

async fn lookup_openlibrary_search(
    client: &reqwest::Client,
    query: &str,
) -> Result<Vec<LookupResult>, LookupError> {
    let mut url = Url::parse(OPENLIBRARY_SEARCH).map_err(|_| LookupError::internal())?;
    url.query_pairs_mut()
        .append_pair("q", query)
        .append_pair("limit", "10")
        .append_pair(
            "fields",
            "key,title,subtitle,author_name,first_publish_year,publisher,isbn,cover_i,number_of_pages_median",
        );
    let value = get_json(client, url).await?;
    let docs = value
        .get("docs")
        .and_then(Value::as_array)
        .ok_or_else(LookupError::invalid_response)?;
    Ok(docs.iter().filter_map(openlibrary_doc).collect())
}

async fn lookup_keywords(
    client: &reqwest::Client,
    query: &str,
) -> Result<Vec<LookupResult>, LookupError> {
    // Ambas consultas son independientes. Si una falla y la otra devuelve
    // resultados, se muestran los resultados parciales.
    let (crossref, openlibrary) = tokio::join!(
        lookup_crossref_search(client, query),
        lookup_openlibrary_search(client, query)
    );

    let mut groups = Vec::new();
    let mut errors = Vec::new();
    match crossref {
        Ok(results) => groups.push(results),
        Err(error) => errors.push(error),
    }
    match openlibrary {
        Ok(results) => groups.push(results),
        Err(error) => errors.push(error),
    }

    let merged = interleave_and_dedupe(groups);
    if merged.is_empty() {
        if let Some(error) = errors.into_iter().next() {
            return Err(error);
        }
        return Err(LookupError::not_found());
    }
    Ok(merged)
}

/* ==================== Parseo y saneado ==================== */

fn crossref_result(message: &Value) -> Option<LookupResult> {
    let title = clean_text(&first_string(message.get("title")).unwrap_or_default(), 500);
    if title.is_empty() {
        return None;
    }

    let subtitle = clean_text(
        &first_string(message.get("subtitle")).unwrap_or_default(),
        300,
    );
    let authors = crossref_authors(message);
    let year = crossref_year(message);
    let publisher = clean_text(json_str(message, "publisher"), 200);
    let container = clean_text(
        &first_string(message.get("container-title")).unwrap_or_default(),
        300,
    );
    let kind = crossref_kind(json_str(message, "type"));
    let doi = clean_text(&json_str(message, "DOI").to_ascii_lowercase(), 200);
    let isbn = first_string(message.get("ISBN"))
        .map(|value| clean_text(&value, 20))
        .unwrap_or_default();
    let url = safe_result_url(json_str(message, "URL"), ALLOWED_RESULT_HOSTS)
        .or_else(|| doi_url(&doi))
        .unwrap_or_default();
    let pages = parse_page_count(json_str(message, "page")).unwrap_or(0);
    let abstract_text = message
        .get("abstract")
        .and_then(Value::as_str)
        .map(|raw| clean_text(&strip_jats(raw), 2000))
        .unwrap_or_default();

    Some(LookupResult {
        provider: "crossref".to_string(),
        kind: kind.to_string(),
        title,
        subtitle,
        authors,
        year,
        publisher,
        container,
        doi,
        isbn,
        url,
        pages,
        cover_url: String::new(),
        abstract_text,
    })
}

fn crossref_kind(raw: &str) -> &'static str {
    let kind = raw.to_ascii_lowercase();
    if kind.contains("book") || kind.contains("monograph") || kind.contains("reference") {
        "book"
    } else if kind.contains("dataset") || kind.contains("component") {
        "webpage"
    } else {
        "article"
    }
}

fn crossref_authors(message: &Value) -> String {
    let Some(items) = message.get("author").and_then(Value::as_array) else {
        return String::new();
    };
    let mut names = Vec::new();
    for author in items.iter().take(12) {
        let given = json_str(author, "given").trim();
        let family = json_str(author, "family").trim();
        let name = json_str(author, "name").trim();
        let full = if !given.is_empty() && !family.is_empty() {
            format!("{given} {family}")
        } else if !family.is_empty() {
            family.to_string()
        } else if !given.is_empty() {
            given.to_string()
        } else {
            name.to_string()
        };
        let full = clean_text(&full, 160);
        if !full.is_empty() {
            names.push(full);
        }
    }
    clean_text(&names.join(", "), 400)
}

fn crossref_year(message: &Value) -> String {
    for key in ["issued", "published-print", "published-online", "created"] {
        let Some(parts) = message
            .get(key)
            .and_then(|value| value.get("date-parts"))
            .and_then(Value::as_array)
        else {
            continue;
        };
        let Some(year) = parts
            .first()
            .and_then(Value::as_array)
            .and_then(|dates| dates.first())
            .and_then(Value::as_i64)
        else {
            continue;
        };
        if (1000..=2999).contains(&year) {
            return year.to_string();
        }
    }
    String::new()
}

fn openlibrary_book(book: &Value, fallback_isbn: &str) -> Option<LookupResult> {
    let title = clean_text(json_str(book, "title"), 500);
    if title.is_empty() {
        return None;
    }

    let subtitle = clean_text(json_str(book, "subtitle"), 300);
    let authors = book
        .get("authors")
        .map(openlibrary_people)
        .unwrap_or_default();
    let publisher = book
        .get("publishers")
        .map(openlibrary_publisher)
        .unwrap_or_default();
    let year = extract_year(json_str(book, "publish_date"));
    let pages = book
        .get("number_of_pages")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(u64::from(u32::MAX)) as u32;
    let isbn = book
        .get("identifiers")
        .and_then(|identifiers| identifiers.get("isbn_13"))
        .map(first_valid_isbn)
        .unwrap_or_default();
    let isbn = if isbn.is_empty() {
        fallback_isbn.to_string()
    } else {
        isbn
    };
    let cover_url = ["medium", "small", "large"]
        .iter()
        .find_map(|key| {
            book.get("cover")
                .and_then(|cover| cover.get(*key))
                .and_then(Value::as_str)
        })
        .and_then(allowed_cover_url)
        .unwrap_or_default();
    let url = book
        .get("key")
        .and_then(Value::as_str)
        .and_then(openlibrary_key_url)
        .or_else(|| {
            if isbn.is_empty() {
                None
            } else {
                Some(openlibrary_isbn_url(&isbn))
            }
        })
        .unwrap_or_default();
    let abstract_text = book
        .get("notes")
        .and_then(Value::as_str)
        .map(|raw| clean_text(raw, 2000))
        .unwrap_or_default();

    Some(LookupResult {
        provider: "openlibrary".to_string(),
        kind: "book".to_string(),
        title,
        subtitle,
        authors,
        year,
        publisher,
        container: String::new(),
        doi: String::new(),
        isbn,
        url,
        pages,
        cover_url,
        abstract_text,
    })
}

fn openlibrary_doc(doc: &Value) -> Option<LookupResult> {
    let title = clean_text(json_str(doc, "title"), 500);
    if title.is_empty() {
        return None;
    }

    let subtitle = clean_text(json_str(doc, "subtitle"), 300);
    let authors = doc
        .get("author_name")
        .and_then(Value::as_array)
        .map(|items| {
            let names: Vec<String> = items
                .iter()
                .take(12)
                .filter_map(Value::as_str)
                .map(|name| clean_text(name, 160))
                .filter(|name| !name.is_empty())
                .collect();
            clean_text(&names.join(", "), 400)
        })
        .unwrap_or_default();
    let year = doc
        .get("first_publish_year")
        .and_then(Value::as_i64)
        .filter(|year| (1000..=2999).contains(year))
        .map(|year| year.to_string())
        .unwrap_or_default();
    let publisher = doc
        .get("publisher")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .map(|value| clean_text(value, 200))
        .unwrap_or_default();
    let isbn = doc.get("isbn").map(first_valid_isbn).unwrap_or_default();
    let cover_url = doc
        .get("cover_i")
        .and_then(Value::as_u64)
        .map(|id| format!("https://{ALLOWED_COVER_HOST}/b/id/{id}-M.jpg"))
        .and_then(|raw| allowed_cover_url(&raw))
        .unwrap_or_default();
    let url = doc
        .get("key")
        .and_then(Value::as_str)
        .and_then(openlibrary_key_url)
        .unwrap_or_default();
    let pages = doc
        .get("number_of_pages_median")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(u64::from(u32::MAX)) as u32;

    Some(LookupResult {
        provider: "openlibrary".to_string(),
        kind: "book".to_string(),
        title,
        subtitle,
        authors,
        year,
        publisher,
        container: String::new(),
        doi: String::new(),
        isbn,
        url,
        pages,
        cover_url,
        abstract_text: String::new(),
    })
}

fn openlibrary_people(value: &Value) -> String {
    let Some(items) = value.as_array() else {
        return String::new();
    };
    let names: Vec<String> = items
        .iter()
        .take(12)
        .filter_map(|person| person.get("name").and_then(Value::as_str))
        .map(|name| clean_text(name, 160))
        .filter(|name| !name.is_empty())
        .collect();
    clean_text(&names.join(", "), 400)
}

fn openlibrary_publisher(value: &Value) -> String {
    value
        .as_array()
        .and_then(|items| items.first())
        .and_then(|publisher| publisher.get("name"))
        .and_then(Value::as_str)
        .map(|name| clean_text(name, 200))
        .unwrap_or_default()
}

fn first_valid_isbn(value: &Value) -> String {
    value
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .find(|candidate| isbn13_valid(candidate))
        })
        .map(str::to_string)
        .unwrap_or_default()
}

fn first_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::Array(items) => items.iter().find_map(Value::as_str).map(str::to_string),
        Value::String(text) => Some(text.clone()),
        _ => None,
    }
}

fn json_str<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}

fn parse_page_count(raw: &str) -> Option<u32> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let mut parts = raw.split('-');
    let start = parts.next()?.trim().parse::<u32>().ok()?;
    match parts.next().map(str::trim) {
        Some(end) => {
            let end = end.parse::<u32>().ok()?;
            if end < start {
                None
            } else {
                Some(end - start + 1)
            }
        }
        None => Some(1),
    }
}

fn extract_year(raw: &str) -> String {
    let bytes = raw.as_bytes();
    for index in 0..bytes.len().saturating_sub(3) {
        let Some(slice) = raw.get(index..index + 4) else {
            continue;
        };
        if slice.bytes().all(|byte| byte.is_ascii_digit()) {
            if let Ok(year) = slice.parse::<i64>() {
                if (1000..=2999).contains(&year) {
                    return year.to_string();
                }
            }
        }
    }
    String::new()
}

/* ==================== Saneado y allowlists ==================== */

fn clean_text(raw: &str, max_chars: usize) -> String {
    let mut out = String::with_capacity(raw.len().min(4096));
    let mut pending_space = false;
    let mut count = 0usize;

    for character in raw.chars().take(max_chars.saturating_mul(8)) {
        if character.is_control() || is_unsafe_format_character(character) {
            continue;
        }
        if character.is_whitespace() {
            pending_space = !out.is_empty();
            continue;
        }
        if pending_space {
            if count >= max_chars {
                break;
            }
            out.push(' ');
            count += 1;
            pending_space = false;
        }
        if count >= max_chars {
            break;
        }
        out.push(character);
        count += 1;
    }

    out.trim().to_string()
}

fn strip_jats(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut inside_tag = false;
    for character in raw.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                if !out.is_empty() {
                    out.push(' ');
                }
            }
            _ if !inside_tag => out.push(character),
            _ => {}
        }
    }
    decode_basic_entities(&out)
}

fn decode_basic_entities(raw: &str) -> String {
    raw.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
}

fn safe_result_url(raw: &str, allowed_hosts: &[&str]) -> Option<String> {
    let url = Url::parse(raw.trim()).ok()?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
    {
        return None;
    }
    let host = url.host_str()?.to_ascii_lowercase();
    if !allowed_hosts.contains(&host.as_str()) {
        return None;
    }
    Some(url.to_string())
}

fn allowed_cover_url(raw: &str) -> Option<String> {
    let url = Url::parse(raw.trim()).ok()?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.port().is_some_and(|port| port != 443)
    {
        return None;
    }
    if !url
        .host_str()
        .map(|host| host.eq_ignore_ascii_case(ALLOWED_COVER_HOST))
        .unwrap_or(false)
    {
        return None;
    }

    let segments: Vec<&str> = url.path_segments()?.collect();
    if segments.len() != 3 || segments[0] != "b" || segments[1] != "id" {
        return None;
    }
    let (id, size) = segments[2].split_once('-')?;
    if id.is_empty() || !id.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    if !matches!(size, "S.jpg" | "M.jpg" | "L.jpg") {
        return None;
    }

    Some(url.to_string())
}

fn doi_url(doi: &str) -> Option<String> {
    if doi.is_empty() {
        return None;
    }
    let mut url = Url::parse("https://doi.org").ok()?;
    {
        let mut segments = url.path_segments_mut().ok()?;
        for part in doi.split('/') {
            segments.push(part);
        }
    }
    Some(url.to_string())
}

fn openlibrary_key_url(key: &str) -> Option<String> {
    if !(key.starts_with("/works/") || key.starts_with("/books/")) || key.len() > 120 {
        return None;
    }
    if !key
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'-'))
    {
        return None;
    }
    let mut url = Url::parse(OPENLIBRARY_BASE).ok()?;
    url.set_path(key);
    Some(url.to_string())
}

fn openlibrary_isbn_url(isbn: &str) -> String {
    let Ok(mut url) = Url::parse(OPENLIBRARY_BASE) else {
        return String::new();
    };
    if let Ok(mut segments) = url.path_segments_mut() {
        segments.push("isbn");
        segments.push(isbn);
    }
    url.to_string()
}

/* ==================== Combinación de resultados ==================== */

fn interleave_and_dedupe(groups: Vec<Vec<LookupResult>>) -> Vec<LookupResult> {
    let mut iterators: Vec<std::vec::IntoIter<LookupResult>> =
        groups.into_iter().map(|group| group.into_iter()).collect();
    let mut merged = Vec::new();
    loop {
        let mut pushed = false;
        for iterator in &mut iterators {
            if let Some(result) = iterator.next() {
                merged.push(result);
                pushed = true;
            }
        }
        if !pushed {
            break;
        }
    }
    dedupe(merged)
}

fn dedupe(results: Vec<LookupResult>) -> Vec<LookupResult> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for result in results {
        if !seen.insert(result_key(&result)) {
            continue;
        }
        unique.push(result);
        if unique.len() >= MAX_RESULTS {
            break;
        }
    }
    unique
}

fn result_key(result: &LookupResult) -> String {
    let title: String = result
        .title
        .to_lowercase()
        .chars()
        .filter(|character| character.is_alphanumeric())
        .collect();
    format!("{}|{}", title, result.year)
}

/* ==================== Tests ==================== */

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitizes_queries_without_allowing_controls() {
        assert_eq!(sanitize_query("  deep   work \n").unwrap(), "deep work");
        assert_eq!(sanitize_query("a\u{202E}b").unwrap(), "ab");
        assert!(sanitize_query("\u{7}").is_err());
        assert!(sanitize_query("   ").is_err());
        assert!(sanitize_query(&"x".repeat(MAX_QUERY_CHARS + 1)).is_err());
    }

    #[test]
    fn validates_and_normalizes_dois() {
        assert_eq!(
            normalize_doi("https://doi.org/10.1038/nphys1170").unwrap(),
            "10.1038/nphys1170"
        );
        assert_eq!(
            normalize_doi("doi:10.1038/nphys1170").unwrap(),
            "10.1038/nphys1170"
        );
        assert_eq!(
            normalize_doi("10.1000/xyz?query=1").unwrap(),
            "10.1000/xyz?query=1"
        );
        assert!(normalize_doi("10.1/x").is_err());
        assert!(normalize_doi("10.1234/").is_err());
        assert!(normalize_doi("10.1234/a b").is_err());
        assert!(normalize_doi("https://evil.example/10.1234/x").is_err());
        assert!(normalize_doi("10.1234/ñ").is_err());
        assert!(looks_like_doi("10.1234/abc"));
        assert!(!looks_like_doi("deep work"));
    }

    #[test]
    fn validates_isbn10_and_isbn13() {
        assert!(isbn10_valid("0140328726"));
        assert!(isbn13_valid("9780140328721"));
        assert!(!isbn10_valid("0140328727"));
        assert!(!isbn13_valid("9780140328722"));
        assert_eq!(isbn10_to_13("0140328726"), "9780140328721");
        assert_eq!(
            normalize_isbn("978-0-14-032872-1").unwrap(),
            "9780140328721"
        );
        assert_eq!(normalize_isbn("0140328726").unwrap(), "9780140328721");
        assert!(normalize_isbn("9780140328722").is_err());
        assert!(normalize_isbn("978014032872X").is_err());
        assert!(looks_like_isbn("978-0-14-032872-1"));
        assert!(looks_like_isbn("0140328726"));
    }

    #[test]
    fn resolves_auto_mode_and_rejects_bad_identifiers() {
        assert_eq!(
            resolve_mode("10.1038/nphys1170", "auto").unwrap().0,
            Mode::Doi
        );
        assert_eq!(
            resolve_mode("978-0-14-032872-1", "auto").unwrap().0,
            Mode::Isbn
        );
        assert_eq!(resolve_mode("deep work", "auto").unwrap().0, Mode::Keywords);
        assert!(resolve_mode("10.1/x", "auto").is_err());
        assert!(resolve_mode("9780140328722", "auto").is_err());
        assert!(resolve_mode("deep work", "otro").is_err());
    }

    #[test]
    fn parses_crossref_work_and_authors() {
        let message = json!({
            "title": ["Measured measurement"],
            "subtitle": null,
            "author": [
                {"given": "Markus", "family": "Aspelmeyer"},
                {"given": "Anton", "family": "Zeilinger"}
            ],
            "issued": {"date-parts": [[2009, 1]]},
            "publisher": "Springer Science and Business Media LLC",
            "container-title": ["Nature Physics"],
            "type": "journal-article",
            "DOI": "10.1038/NPHYS1170",
            "URL": "https://doi.org/10.1038/nphys1170",
            "page": "11-12",
            "abstract": "<jats:p>Hola &amp; adiós</jats:p>"
        });
        let result = crossref_result(&message).unwrap();
        assert_eq!(result.title, "Measured measurement");
        assert_eq!(result.authors, "Markus Aspelmeyer, Anton Zeilinger");
        assert_eq!(result.year, "2009");
        assert_eq!(result.kind, "article");
        assert_eq!(result.doi, "10.1038/nphys1170");
        assert_eq!(result.pages, 2);
        assert_eq!(result.abstract_text, "Hola & adiós");
        assert_eq!(result.url, "https://doi.org/10.1038/nphys1170");
    }

    #[test]
    fn parses_openlibrary_book_and_cover() {
        let book = json!({
            "title": "Fantastic Mr. Fox",
            "authors": [{"name": "Roald Dahl"}],
            "publish_date": "October 1, 1988",
            "publishers": [{"name": "Puffin"}],
            "number_of_pages": 96,
            "key": "/books/OL7353617M",
            "identifiers": {"isbn_13": ["9780140328721"]},
            "cover": {
                "small": "https://covers.openlibrary.org/b/id/15152634-S.jpg",
                "medium": "https://covers.openlibrary.org/b/id/15152634-M.jpg",
                "large": "https://covers.openlibrary.org/b/id/15152634-L.jpg"
            }
        });
        let result = openlibrary_book(&book, "9780140328721").unwrap();
        assert_eq!(result.title, "Fantastic Mr. Fox");
        assert_eq!(result.authors, "Roald Dahl");
        assert_eq!(result.year, "1988");
        assert_eq!(result.isbn, "9780140328721");
        assert_eq!(result.pages, 96);
        assert_eq!(
            result.cover_url,
            "https://covers.openlibrary.org/b/id/15152634-M.jpg"
        );
        assert_eq!(result.url, "https://openlibrary.org/books/OL7353617M");
    }

    #[test]
    fn parses_openlibrary_search_document() {
        let doc = json!({
            "key": "/works/OL17713267W",
            "title": "Deep Work",
            "subtitle": "Rules for Focused Success in a Distracted World",
            "author_name": ["Cal Newport"],
            "first_publish_year": 2016,
            "publisher": ["Grand Central Publishing"],
            "isbn": ["9781455586677", "3868816577"],
            "cover_i": 7988607,
            "number_of_pages_median": 303
        });
        let result = openlibrary_doc(&doc).unwrap();
        assert_eq!(result.title, "Deep Work");
        assert_eq!(result.authors, "Cal Newport");
        assert_eq!(result.year, "2016");
        assert_eq!(result.isbn, "9781455586677");
        assert_eq!(result.pages, 303);
        assert_eq!(
            result.cover_url,
            "https://covers.openlibrary.org/b/id/7988607-M.jpg"
        );
        assert_eq!(result.url, "https://openlibrary.org/works/OL17713267W");
    }

    #[test]
    fn only_accepts_allowlisted_https_urls() {
        assert!(safe_result_url("https://doi.org/10.1000/x", ALLOWED_RESULT_HOSTS).is_some());
        assert!(
            safe_result_url("https://openlibrary.org/works/OL1W", ALLOWED_RESULT_HOSTS).is_some()
        );
        assert!(safe_result_url("http://doi.org/10.1000/x", ALLOWED_RESULT_HOSTS).is_none());
        assert!(safe_result_url("https://127.0.0.1/x", ALLOWED_RESULT_HOSTS).is_none());
        assert!(safe_result_url("https://doi.org@evil.example/x", ALLOWED_RESULT_HOSTS).is_none());
        assert!(safe_result_url("https://evil.example/x", ALLOWED_RESULT_HOSTS).is_none());
    }

    #[test]
    fn only_accepts_openlibrary_cover_urls() {
        assert!(allowed_cover_url("https://covers.openlibrary.org/b/id/12345-M.jpg").is_some());
        assert!(allowed_cover_url("http://covers.openlibrary.org/b/id/12345-M.jpg").is_none());
        assert!(allowed_cover_url("https://evil.example/b/id/12345-M.jpg").is_none());
        assert!(allowed_cover_url("https://covers.openlibrary.org/b/isbn/9780-M.jpg").is_none());
        assert!(allowed_cover_url("https://covers.openlibrary.org/b/id/12x45-M.jpg").is_none());
        assert!(allowed_cover_url("https://covers.openlibrary.org/b/id/12345-M.jpg?x=1").is_none());
    }

    #[test]
    fn parses_page_ranges_without_overflow() {
        assert_eq!(parse_page_count("11-12"), Some(2));
        assert_eq!(parse_page_count("123"), Some(1));
        assert_eq!(parse_page_count("12-10"), None);
        assert_eq!(parse_page_count("e123"), None);
        assert_eq!(parse_page_count(""), None);
    }

    #[test]
    fn strips_jats_markup_and_entities() {
        assert_eq!(
            strip_jats("<jats:p>Hola &amp; adiós</jats:p>"),
            "Hola & adiós "
        );
    }

    #[test]
    fn deduplicates_by_title_and_year() {
        let make = |title: &str, year: &str| LookupResult {
            provider: "crossref".to_string(),
            kind: "book".to_string(),
            title: title.to_string(),
            subtitle: String::new(),
            authors: String::new(),
            year: year.to_string(),
            publisher: String::new(),
            container: String::new(),
            doi: String::new(),
            isbn: String::new(),
            url: String::new(),
            pages: 0,
            cover_url: String::new(),
            abstract_text: String::new(),
        };
        let results = dedupe(vec![
            make("Deep Work", "2016"),
            make("deep work!", "2016"),
            make("Deep Work", "2017"),
        ]);
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    #[ignore = "requiere red; se ejecuta a mano con --ignored"]
    async fn live_lookup_smoke() {
        let doi = bibliography_lookup(
            "https://doi.org/10.1038/nphys1170".to_string(),
            Some("auto".to_string()),
        )
        .await
        .expect("DOI lookup");
        assert_eq!(doi[0].title, "Measured measurement");

        std::thread::sleep(Duration::from_millis(800));
        let isbn = bibliography_lookup("978-0-14-032872-1".to_string(), Some("auto".to_string()))
            .await
            .expect("ISBN lookup");
        assert_eq!(isbn[0].title, "Fantastic Mr. Fox");

        std::thread::sleep(Duration::from_millis(800));
        let keywords = bibliography_lookup("deep work".to_string(), Some("keywords".to_string()))
            .await
            .expect("keyword lookup");
        assert!(!keywords.is_empty());
    }
}
