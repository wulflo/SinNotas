/**
 * Cliente de la búsqueda de metadatos de Bibliografía.
 *
 * El frontend no construye URLs ni hace peticiones a los proveedores: solo
 * llama al comando Rust `bibliography_lookup`. Este módulo concentra la
 * validación espejo (para dar errores claros antes de invocar) y el saneado de
 * todo lo que vuelve del backend, por si algún campo remoto llegara sucio.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { BibliographyType, CreateBibliographyInput } from "./bibliography";

export type BibliographyLookupMode = "auto" | "doi" | "isbn" | "keywords";

export interface BibliographyLookupResult {
  provider: string;
  kind: BibliographyType;
  title: string;
  subtitle: string;
  authors: string;
  year: string;
  publisher: string;
  container: string;
  doi: string;
  isbn: string;
  url: string;
  pages: number;
  coverUrl: string;
  abstractText: string;
}

export type BibliographyLookupErrorCode =
  | "invalid_query"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network"
  | "upstream"
  | "too_large"
  | "invalid_response"
  | "unsupported"
  | "internal";

export class BibliographyLookupError extends Error {
  readonly code: BibliographyLookupErrorCode;

  constructor(code: BibliographyLookupErrorCode, message?: string) {
    super(message || code);
    this.name = "BibliographyLookupError";
    this.code = code;
  }
}

const MAX_QUERY_LENGTH = 256;
const MAX_TITLE_LENGTH = 500;
const MAX_AUTHOR_LENGTH = 400;
const MAX_URL_LENGTH = 2048;
const MAX_RESULTS = 16;

const DOI_PREFIXES = [
  "https://doi.org/",
  "http://doi.org/",
  "https://dx.doi.org/",
  "http://dx.doi.org/",
  "doi:",
];

const ALLOWED_RESULT_HOSTS = new Set(["doi.org", "dx.doi.org", "openlibrary.org"]);
const ALLOWED_COVER_HOST = "covers.openlibrary.org";

const LOOKUP_ERROR_MESSAGES: Record<BibliographyLookupErrorCode, string> = {
  invalid_query: "La consulta no es válida. Revisa el DOI o el ISBN.",
  not_found: "No se encontró ningún recurso con esa consulta.",
  rate_limited: "Demasiadas búsquedas seguidas. Espera unos segundos.",
  timeout: "La búsqueda tardó demasiado. Revisa tu conexión.",
  network: "No se pudo conectar. Revisa tu conexión.",
  upstream: "El servicio de metadatos no respondió. Inténtalo más tarde.",
  too_large: "La respuesta del servicio era demasiado grande.",
  invalid_response: "El servicio devolvió una respuesta no válida.",
  unsupported: "La búsqueda en línea solo está disponible en la aplicación.",
  internal: "No se pudo completar la búsqueda.",
};

/** Elimina controles, bidi y zero-width; colapsa espacios y recorta. */
export function sanitizeLookupText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const clean = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(clean).slice(0, Math.max(0, maxLength)).join("").trim();
}

export function sanitizeLookupQuery(value: unknown): string {
  return sanitizeLookupText(value, MAX_QUERY_LENGTH);
}

function stripDoiPrefix(value: string): string {
  const lower = value.trim().toLowerCase();
  for (const prefix of DOI_PREFIXES) {
    if (lower.startsWith(prefix)) return value.trim().slice(prefix.length).trim();
  }
  return value.trim();
}

export function looksLikeDoi(value: string): boolean {
  const stripped = stripDoiPrefix(value);
  return stripped.startsWith("10.") && stripped.includes("/");
}

export function normalizeDoi(value: string): string | null {
  const stripped = stripDoiPrefix(value);
  if (!/^10\.\d{4,9}\/[^\s]+$/.test(stripped)) return null;
  if (stripped.length > 200 || !/^[\x21-\x7E]+$/.test(stripped)) return null;
  if (/[\\"<>]/.test(stripped)) return null;
  return stripped;
}

export function looksLikeIsbn(value: string): boolean {
  const cleaned = value.replace(/[\s-]/g, "");
  return /^(\d{9}[\dXx]|\d{13})$/.test(cleaned);
}

export function isbn10Valid(value: string): boolean {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const digit = value[index] === "X" ? 10 : Number(value[index]);
    sum += digit * (10 - index);
  }
  return sum % 11 === 0;
}

export function isbn13Valid(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) {
    const digit = Number(value[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  return sum % 10 === 0;
}

function isbn10To13(value: string): string {
  const digits = `978${value.slice(0, 9)}`;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(digits[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

export function normalizeIsbn(value: string): string | null {
  const cleaned = value.replace(/[\s\u2010-\u2015\u2212-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(cleaned) && isbn10Valid(cleaned)) {
    return isbn10To13(cleaned);
  }
  if (/^\d{13}$/.test(cleaned) && isbn13Valid(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Detecta el modo, pero no valida el dígito de control: un ISBN con longitud
 * correcta pero dígito inválido se envía como `isbn` para que el backend
 * devuelva `invalid_query` en vez de buscar los dígitos como palabras clave.
 */
export function detectLookupMode(value: string): BibliographyLookupMode {
  const clean = sanitizeLookupQuery(value);
  if (!clean) return "keywords";
  if (looksLikeDoi(clean)) return "doi";
  if (looksLikeIsbn(clean)) return "isbn";
  return "keywords";
}

export function isAllowedLookupCoverUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;
    if (url.hostname.toLowerCase() !== ALLOWED_COVER_HOST) return false;
    if (url.search || url.hash) return false;
    return /^\/b\/id\/\d+-(?:S|M|L)\.jpg$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function isAllowedLookupUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;
    return ALLOWED_RESULT_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizeKind(value: unknown): BibliographyType {
  return value === "book" || value === "article" || value === "video" || value === "webpage"
    ? value
    : "article";
}

function normalizeLookupResult(raw: BibliographyLookupResult): BibliographyLookupResult {
  return {
    provider: sanitizeLookupText(raw.provider, 40),
    kind: normalizeKind(raw.kind),
    title: sanitizeLookupText(raw.title, MAX_TITLE_LENGTH),
    subtitle: sanitizeLookupText(raw.subtitle, 300),
    authors: sanitizeLookupText(raw.authors, MAX_AUTHOR_LENGTH),
    year: /^\d{4}$/.test(String(raw.year)) ? String(raw.year) : "",
    publisher: sanitizeLookupText(raw.publisher, 200),
    container: sanitizeLookupText(raw.container, 300),
    doi: sanitizeLookupText(raw.doi, 200),
    isbn: sanitizeLookupText(raw.isbn, 20),
    url: isAllowedLookupUrl(raw.url) ? sanitizeLookupText(raw.url, MAX_URL_LENGTH) : "",
    pages: Number.isFinite(raw.pages)
      ? Math.max(0, Math.min(100_000, Math.trunc(raw.pages)))
      : 0,
    coverUrl: isAllowedLookupCoverUrl(raw.coverUrl)
      ? sanitizeLookupText(raw.coverUrl, MAX_URL_LENGTH)
      : "",
    abstractText: sanitizeLookupText(raw.abstractText, 2000),
  };
}

function toLookupError(error: unknown): BibliographyLookupError {
  if (error instanceof BibliographyLookupError) return error;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    if (typeof candidate.code === "string") {
      return new BibliographyLookupError(
        candidate.code as BibliographyLookupErrorCode,
        typeof candidate.message === "string" ? candidate.message : undefined
      );
    }
  }
  return new BibliographyLookupError("network");
}

/** Llama al backend. La consulta ya va saneada y limitada. */
export async function lookupBibliography(
  query: string,
  mode: BibliographyLookupMode = "auto"
): Promise<BibliographyLookupResult[]> {
  if (!lookupErrorMessageIsKnown(mode)) {
    throw new BibliographyLookupError("invalid_query");
  }
  const clean = sanitizeLookupQuery(query);
  if (!clean) throw new BibliographyLookupError("invalid_query");
  if (!isTauri()) throw new BibliographyLookupError("unsupported");

  try {
    const raw = await invoke<BibliographyLookupResult[]>("bibliography_lookup", {
      query: clean,
      mode,
    });
    return raw
      .map(normalizeLookupResult)
      .filter((result) => result.title.length > 0)
      .slice(0, MAX_RESULTS);
  } catch (error) {
    throw toLookupError(error);
  }
}

function lookupErrorMessageIsKnown(mode: string): mode is BibliographyLookupMode {
  return mode === "auto" || mode === "doi" || mode === "isbn" || mode === "keywords";
}

export function lookupErrorMessage(code: string): string {
  return (
    LOOKUP_ERROR_MESSAGES[code as BibliographyLookupErrorCode] ||
    LOOKUP_ERROR_MESSAGES.internal
  );
}

export function lookupErrorCode(error: unknown): BibliographyLookupErrorCode {
  if (error instanceof BibliographyLookupError) return error.code;
  return toLookupError(error).code;
}

/** Convierte un resultado en los campos del formulario de «Añadir recurso». */
export function lookupResultToInput(
  result: BibliographyLookupResult
): CreateBibliographyInput {
  return {
    title: result.title || "Sin título",
    type: result.kind,
    author: result.authors,
    year: result.year,
    total: result.pages,
    cover: result.coverUrl,
    link: result.url,
  };
}
