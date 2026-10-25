/**
 * Utilidades puras del sistema de actualizaciones.
 *
 * No importan APIs de Tauri ni tocan el DOM: se pueden probar con Vitest y se
 * comparten entre la app de escritorio y la de repaso en Android.
 */

/** Hosts de GitHub desde los que se permite descargar el APK. */
const ALLOWED_RELEASE_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

/** Ruta del repositorio dentro de github.com para releases. */
const RELEASE_PATH_PREFIX = "/wulflo/sinnotas/releases/download/";

/** Tamaño máximo aceptado para un APK (150 MiB). */
export const MAX_APK_BYTES = 150 * 1024 * 1024;

/** Límite de notas de versión que se muestran en la interfaz. */
export const MAX_RELEASE_NOTES_LENGTH = 20_000;

export type UpdateErrorCode =
  | "unsupported-platform"
  | "not-tauri"
  | "platform-detection"
  | "network"
  | "timeout"
  | "http"
  | "invalid-manifest"
  | "invalid-url"
  | "too-large"
  | "checksum"
  | "download-empty"
  | "no-space"
  | "write-failed"
  | "install-failed"
  | "unknown";

export class UpdateError extends Error {
  readonly code: UpdateErrorCode;

  constructor(message: string, code: UpdateErrorCode) {
    super(message);
    this.name = "UpdateError";
    this.code = code;
  }
}

export interface ParsedVersion {
  numbers: number[];
  prerelease: string[];
}

/**
 * Parsea una versión semántica sencilla (`1.2.3`, `v1.2.3`, `1.2.3-beta.1`).
 * Devuelve `null` si el formato no es reconocible.
 */
export function parseVersion(value: string): ParsedVersion | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  const match = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(trimmed);
  if (!match) return null;

  const numbers = match[1].split(".").map((part) => Number(part));
  if (numbers.some((part) => !Number.isSafeInteger(part) || part < 0)) return null;

  const prerelease = match[2] ? match[2].split(".") : [];
  if (prerelease.some((part) => part.length === 0)) return null;

  return { numbers, prerelease };
}

/**
 * Compara dos versiones. Devuelve un número negativo si `a < b`, 0 si son
 * equivalentes y positivo si `a > b`. Lanza `UpdateError` si alguna es inválida.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new UpdateError("Formato de versión inválido.", "invalid-manifest");
  }

  const length = Math.max(left.numbers.length, right.numbers.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left.numbers[index] ?? 0) - (right.numbers[index] ?? 0);
    if (diff !== 0) return diff;
  }

  // Una versión con sufijo de pre-lanzamiento es anterior a la estable.
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;

  const prereleaseLength = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < prereleaseLength; index += 1) {
    const l = left.prerelease[index];
    const r = right.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;
    const lNumeric = /^\d+$/.test(l);
    const rNumeric = /^\d+$/.test(r);
    if (lNumeric && rNumeric) {
      const diff = Number(l) - Number(r);
      if (diff !== 0) return diff;
      continue;
    }
    if (lNumeric) return -1;
    if (rNumeric) return 1;
    return l < r ? -1 : 1;
  }

  return 0;
}

/** `true` cuando `candidate` es una versión más nueva que `current`. */
export function isNewerVersion(current: string, candidate: string): boolean {
  return compareVersions(candidate, current) > 0;
}

export interface ReleaseAsset {
  url: string;
  size?: number;
  sha256?: string;
}

export interface ReleaseManifest {
  version: string;
  notes: string;
  pubDate?: string;
  asset: ReleaseAsset;
}

/**
 * Comprueba que la URL de descarga pertenezca a GitHub y al repositorio
 * esperado. Evita que un `latest.json` manipulado apunte a otro servidor.
 */
export function isAllowedUpdateUrl(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port !== "" && url.port !== "443") return false;

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_RELEASE_HOSTS.has(host)) return false;

  // Los hosts de assets sirven contenido arbitrario de GitHub; el de github.com
  // además debe apuntar a una release de este repositorio.
  if (host === "github.com" || host === "www.github.com") {
    return url.pathname.toLowerCase().startsWith(RELEASE_PATH_PREFIX);
  }

  return true;
}

/** Convierte bytes a un texto legible ("12,4 MB"). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(".", ",")} ${units[unit]}`;
}

function readPlatformEntry(
  platforms: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const entry = platforms[key];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new UpdateError(
      `La release no incluye un paquete para ${key}.`,
      "invalid-manifest"
    );
  }
  return entry as Record<string, unknown>;
}

/**
 * Valida y normaliza el `latest.json`. Solo se aceptan los campos conocidos y
 * una URL HTTPS de GitHub; las notas se recortan para no bloquear la interfaz.
 */
export function parseReleaseManifest(raw: unknown, platformKey: string): ReleaseManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UpdateError("El manifiesto de actualización no es un objeto JSON.", "invalid-manifest");
  }

  const data = raw as Record<string, unknown>;
  if (typeof data.version !== "string" || !parseVersion(data.version)) {
    throw new UpdateError("El manifiesto no declara una versión válida.", "invalid-manifest");
  }

  if (!data.platforms || typeof data.platforms !== "object" || Array.isArray(data.platforms)) {
    throw new UpdateError("El manifiesto no declara plataformas.", "invalid-manifest");
  }

  const entry = readPlatformEntry(data.platforms as Record<string, unknown>, platformKey);

  const url = entry.url;
  if (typeof url !== "string" || !isAllowedUpdateUrl(url)) {
    throw new UpdateError(
      "La URL de descarga no pertenece a las releases oficiales de SinNotas.",
      "invalid-url"
    );
  }

  let size: number | undefined;
  if (entry.size !== undefined) {
    if (typeof entry.size !== "number" || !Number.isSafeInteger(entry.size) || entry.size <= 0) {
      throw new UpdateError("El tamaño del paquete es inválido.", "invalid-manifest");
    }
    if (entry.size > MAX_APK_BYTES) {
      throw new UpdateError("El paquete supera el tamaño máximo permitido.", "too-large");
    }
    size = entry.size;
  }

  let sha256: string | undefined;
  if (entry.sha256 !== undefined) {
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new UpdateError("La huella SHA-256 del paquete es inválida.", "invalid-manifest");
    }
    sha256 = entry.sha256.toLowerCase();
  }

  let notes = "";
  if (typeof data.notes === "string") {
    notes = data.notes.slice(0, MAX_RELEASE_NOTES_LENGTH);
  }

  let pubDate: string | undefined;
  if (typeof data.pub_date === "string" && data.pub_date.length <= 64) {
    pubDate = data.pub_date;
  }

  return { version: data.version.replace(/^v/, ""), notes, pubDate, asset: { url, size, sha256 } };
}

/** Convierte un `ArrayBuffer` a hexadecimal en minúsculas. */
export function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
