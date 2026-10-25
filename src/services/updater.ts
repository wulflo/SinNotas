/**
 * Servicio de actualizaciones híbrido.
 *
 * - Escritorio (Windows/Linux/macOS): usa el plugin nativo `updater`, que
 *   verifica la firma minisign del paquete y luego relanza la app.
 * - Android: descarga el APK desde la release de GitHub con el plugin HTTP
 *   nativo (los assets de GitHub no envían CORS) y lo guarda en la carpeta de
 *   descargas privada de la app. La instalación es manual: la APK no se ejecuta
 *   ni se instala desde la aplicación.
 *
 * Ninguna comprobación se hace automáticamente: el usuario debe pulsar
 * "Buscar actualizaciones". Así la app no genera tráfico de red por sí sola.
 */
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { platform } from "@tauri-apps/plugin-os";
import {
  MAX_APK_BYTES,
  UpdateError,
  bytesToHex,
  compareVersions,
  formatBytes,
  isNewerVersion,
  parseReleaseManifest,
  type ReleaseAsset,
  type ReleaseManifest,
} from "./update-utils";

export const UPDATE_MANIFEST_URL =
  "https://github.com/wulflo/SinNotas/releases/latest/download/latest.json";
export const ANDROID_UPDATE_PLATFORM_KEY = "android-aarch64";
export const ANDROID_APK_FILE_NAME = "SinNotas-update.apk";
export const ANDROID_APK_DISPLAY_PATH = `Descargas de la app/${ANDROID_APK_FILE_NAME}`;

const CHECK_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const MAX_MANIFEST_BYTES = 256 * 1024;

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error"
  | "unsupported";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  newVersion: string | null;
  notes: string;
  /** Progreso entre 0 y 1, o `null` si el servidor no informa el tamaño. */
  progress: number | null;
  receivedBytes: number;
  totalBytes: number;
  message: string | null;
  apkFileName: string | null;
}

const INITIAL_STATE: UpdateState = {
  status: "idle",
  currentVersion: "",
  newVersion: null,
  notes: "",
  progress: null,
  receivedBytes: 0,
  totalBytes: 0,
  message: null,
  apkFileName: null,
};

type Listener = (state: UpdateState) => void;

type FetchLike = typeof fetch;

let androidFetchPromise: Promise<FetchLike> | null = null;

/**
 * En Android se usa el plugin HTTP nativo: GitHub sirve los assets de sus
 * releases desde `release-assets.githubusercontent.com` sin cabeceras CORS,
 * así que el `fetch` del WebView no puede leer `latest.json` ni el APK.
 * El plugin respeta el scope de `capabilities/android.json`.
 */
function getAndroidFetch(): Promise<FetchLike> {
  androidFetchPromise ??= import("@tauri-apps/plugin-http").then(
    (module) => module.fetch as unknown as FetchLike
  );
  return androidFetchPromise;
}

const listeners = new Set<Listener>();
let state: UpdateState = { ...INITIAL_STATE };
let currentVersion = "";
let checkInFlight: Promise<UpdateState> | null = null;
let installInFlight: Promise<UpdateState> | null = null;

interface DesktopPendingUpdate {
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall: (
    onEvent?: (event: DesktopDownloadEvent) => void,
    options?: { timeout?: number }
  ) => Promise<void>;
  close: () => Promise<void>;
}

interface DesktopDownloadEvent {
  event: "Started" | "Progress" | "Finished";
  data?: { contentLength?: number; chunkLength?: number };
}

let desktopUpdate: DesktopPendingUpdate | null = null;
let androidRelease: ReleaseManifest | null = null;

export type SupportedUpdatePlatform = "android" | "desktop" | "unsupported";

function emit(patch: Partial<UpdateState>): UpdateState {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error("[updater] Un observador de la interfaz falló:", error);
    }
  }
  return state;
}

export function getUpdateState(): Readonly<UpdateState> {
  return state;
}

export function subscribeUpdateState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/** Plataforma soportada por el flujo de actualización. */
export function getUpdatePlatform(): SupportedUpdatePlatform {
  if (!isTauri()) return "unsupported";
  try {
    const value = platform();
    if (value === "android") return "android";
    if (value === "ios") return "unsupported";
    return "desktop";
  } catch (error) {
    console.warn("[updater] No se pudo detectar la plataforma:", error);
    return "unsupported";
  }
}

export function isUpdateSupported(): boolean {
  return getUpdatePlatform() !== "unsupported";
}

/** Versión instalada de la app (cacheada). */
export async function getCurrentVersion(): Promise<string> {
  if (currentVersion) return currentVersion;
  try {
    currentVersion = await getVersion();
    return currentVersion;
  } catch (error) {
    console.warn("[updater] No se pudo leer la versión instalada:", error);
    return "";
  }
}

function clearPending(): void {
  if (desktopUpdate) {
    const pending = desktopUpdate;
    desktopUpdate = null;
    void pending.close().catch(() => {
      /* el recurso ya pudo liberarse */
    });
  }
  androidRelease = null;
}

function errorState(error: unknown, fallback: string): UpdateState {
  const known = error instanceof UpdateError;
  const message = known ? error.message : fallback;
  console.error("[updater]", error);
  return emit({
    status: "error",
    message,
    progress: null,
    receivedBytes: 0,
    totalBytes: 0,
  });
}

function abortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

interface TimedResponse {
  response: Response;
  /** Cancela el temporizador; debe llamarse cuando termina de leerse el body. */
  dispose: () => void;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init: RequestInit,
  timeoutMessage: string,
  fetchImpl: FetchLike
): Promise<TimedResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    return { response, dispose: () => clearTimeout(timer) };
  } catch (error) {
    clearTimeout(timer);
    if (abortError(error)) throw new UpdateError(timeoutMessage, "timeout");
    if (error instanceof UpdateError) throw error;
    throw new UpdateError(
      "No se pudo conectar con GitHub. Revisá tu conexión e intentá de nuevo.",
      "network"
    );
  }
}

/**
 * Lee y valida el manifiesto que devuelve GitHub.
 *
 * GitHub sirve los assets de una release como `application/octet-stream`
 * aunque el contenido sea JSON. Validar el `Content-Type` producía el falso
 * error "La respuesta de GitHub no es un manifiesto JSON" en Android. La
 * validación real es el límite de tamaño, `JSON.parse` y
 * `parseReleaseManifest`; una respuesta HTML falla igualmente al parsear.
 *
 * Se exporta para poder probar la regresión sin hacer una petición de red.
 */
export async function readAndroidManifestResponse(
  response: Response
): Promise<ReleaseManifest> {
  if (!response.ok) {
    throw new UpdateError(
      `GitHub respondió con HTTP ${response.status}.`,
      "http"
    );
  }

  const text = await response.text();
  if (text.length > MAX_MANIFEST_BYTES) {
    throw new UpdateError("El manifiesto de actualización es demasiado grande.", "invalid-manifest");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new UpdateError("El manifiesto de actualización no es JSON válido.", "invalid-manifest");
  }

  const release = parseReleaseManifest(raw, ANDROID_UPDATE_PLATFORM_KEY);
  if (!release.asset.sha256) {
    // Sin huella no se puede verificar la integridad de la descarga: se falla
    // cerrado en lugar de aceptar un archivo potencialmente corrupto.
    throw new UpdateError(
      "La release no publica la huella SHA-256 del APK; no se puede verificar la descarga.",
      "checksum"
    );
  }
  return release;
}

async function fetchAndroidManifest(): Promise<ReleaseManifest> {
  const { response, dispose } = await fetchWithTimeout(
    UPDATE_MANIFEST_URL,
    CHECK_TIMEOUT_MS,
    {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "application/json" },
    },
    "GitHub tardó demasiado en responder.",
    await getAndroidFetch()
  );

  try {
    return await readAndroidManifestResponse(response);
  } finally {
    dispose();
  }
}

async function readResponseBytes(
  response: Response,
  expectedSize: number | undefined,
  onProgress: (received: number, total: number) => void
): Promise<Uint8Array> {
  const headerLength = Number(response.headers.get("content-length") ?? "0");
  const total = Number.isFinite(headerLength) && headerLength > 0
    ? headerLength
    : expectedSize ?? 0;

  if (total > MAX_APK_BYTES) {
    throw new UpdateError("El APK supera el tamaño máximo permitido (150 MB).", "too-large");
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_APK_BYTES) {
      throw new UpdateError("El APK supera el tamaño máximo permitido (150 MB).", "too-large");
    }
    onProgress(buffer.byteLength, total || buffer.byteLength);
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_APK_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new UpdateError("El APK supera el tamaño máximo permitido (150 MB).", "too-large");
      }
      chunks.push(value);
      onProgress(received, total);
    }
  } catch (error) {
    if (error instanceof UpdateError) throw error;
    if (abortError(error)) {
      throw new UpdateError("La descarga del APK tardó demasiado.", "timeout");
    }
    throw new UpdateError("La descarga del APK se interrumpió.", "network");
  }

  if (received === 0) {
    throw new UpdateError("El APK descargado está vacío.", "download-empty");
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new UpdateError(
      "Este dispositivo no permite verificar la huella del APK.",
      "checksum"
    );
  }
  const digest = await subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return bytesToHex(digest);
}

async function saveAndroidApk(bytes: Uint8Array): Promise<void> {
  const { writeFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  try {
    await mkdir("", { baseDir: BaseDirectory.Download, recursive: true });
  } catch (error) {
    // La carpeta de descargas de la app puede existir ya; el error real se
    // manifiesta al escribir el archivo.
    console.warn("[updater] No se pudo preparar la carpeta de descargas:", error);
  }

  try {
    await writeFile(ANDROID_APK_FILE_NAME, bytes, { baseDir: BaseDirectory.Download });
  } catch (error) {
    console.error("[updater] No se pudo guardar el APK:", error);
    throw new UpdateError(
      "No se pudo guardar el APK en la carpeta de descargas.",
      "write-failed"
    );
  }
}

async function downloadAndroidUpdate(release: ReleaseManifest): Promise<UpdateState> {
  const asset: ReleaseAsset = release.asset;
  emit({
    status: "downloading",
    newVersion: release.version,
    notes: release.notes,
    progress: 0,
    receivedBytes: 0,
    totalBytes: asset.size ?? 0,
    message: "Descargando la actualización…",
    apkFileName: null,
  });

  const { response, dispose } = await fetchWithTimeout(
    asset.url,
    DOWNLOAD_TIMEOUT_MS,
    {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "application/vnd.android.package-archive" },
    },
    "La descarga del APK tardó demasiado.",
    await getAndroidFetch()
  );

  try {
    if (!response.ok) {
      throw new UpdateError(`La descarga falló con HTTP ${response.status}.`, "http");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (/text\/html/i.test(contentType)) {
      throw new UpdateError(
        "GitHub devolvió una página HTML en lugar del APK.",
        "invalid-manifest"
      );
    }

    const bytes = await readResponseBytes(response, asset.size, (received, total) => {
      emit({
        progress: total > 0 ? Math.min(0.99, received / total) : null,
        receivedBytes: received,
        totalBytes: total,
      });
    });

    if (asset.size && bytes.byteLength !== asset.size) {
      throw new UpdateError(
        `El APK descargado pesa ${formatBytes(bytes.byteLength)} y la release declara ${formatBytes(asset.size)}.`,
        "checksum"
      );
    }

    emit({ message: "Verificando la integridad del APK…", progress: asset.size ? 0.99 : null });
    const digest = await sha256Hex(bytes);
    if (digest !== asset.sha256) {
      throw new UpdateError(
        "La huella SHA-256 del APK no coincide con la publicada. Se descartó el archivo.",
        "checksum"
      );
    }

    emit({ message: "Guardando el APK…" });
    await saveAndroidApk(bytes);

    return emit({
      status: "ready",
      progress: 1,
      receivedBytes: bytes.byteLength,
      totalBytes: bytes.byteLength,
      apkFileName: ANDROID_APK_FILE_NAME,
      message:
        `APK guardado como ${ANDROID_APK_DISPLAY_PATH}. Abrí un gestor de archivos con acceso a ` +
        `Android/data/com.sinnotas.desktop/files/Download y tocá el archivo para instalarlo.`,
    });
  } finally {
    dispose();
  }
}

async function checkDesktop(): Promise<UpdateState> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check({ timeout: CHECK_TIMEOUT_MS });
  if (!update) {
    return emit({
      status: "up-to-date",
      newVersion: null,
      notes: "",
      message: `Ya tenés la última versión (${state.currentVersion || "actual"}).`,
      progress: null,
    });
  }

  clearPending();
  desktopUpdate = {
    version: update.version,
    body: update.body,
    date: update.date,
    downloadAndInstall: (onEvent, options) => update.downloadAndInstall(onEvent, options),
    close: () => update.close(),
  };

  return emit({
    status: "available",
    newVersion: update.version,
    notes: (update.body ?? "").slice(0, 20_000),
    message: `La versión ${update.version} está disponible.`,
    progress: null,
  });
}

async function installDesktopUpdate(): Promise<UpdateState> {
  if (!desktopUpdate) {
    throw new UpdateError("No hay una actualización pendiente.", "unknown");
  }
  const pending = desktopUpdate;
  let total = 0;
  let received = 0;

  emit({
    status: "downloading",
    progress: 0,
    receivedBytes: 0,
    totalBytes: 0,
    message: "Descargando e instalando la actualización…",
  });

  await pending.downloadAndInstall(
    (event) => {
      if (event.event === "Started") {
        total = event.data?.contentLength ?? 0;
        emit({ totalBytes: total });
        return;
      }
      if (event.event === "Progress") {
        received += event.data?.chunkLength ?? 0;
        emit({
          receivedBytes: received,
          totalBytes: total,
          progress: total > 0 ? Math.min(0.99, received / total) : null,
        });
        return;
      }
      emit({ progress: 1, receivedBytes: total || received, totalBytes: total || received });
    },
    { timeout: DOWNLOAD_TIMEOUT_MS }
  );

  desktopUpdate = null;
  emit({
    status: "ready",
    progress: 1,
    message: "Actualización instalada. Reiniciando Sin Notas…",
  });

  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (error) {
    console.error("[updater] No se pudo reiniciar la app:", error);
    emit({
      status: "ready",
      message: "Actualización instalada. Cerrá y volvé a abrir Sin Notas para usarla.",
    });
  }

  return state;
}

/**
 * Busca actualizaciones. Es seguro llamarla varias veces: las llamadas
 * concurrentes comparten la misma promesa.
 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (checkInFlight) return checkInFlight;
  if (installInFlight) return installInFlight;

  checkInFlight = (async () => {
    const supported = getUpdatePlatform();
    if (supported === "unsupported") {
      return emit({
        status: "unsupported",
        message: "Las actualizaciones integradas no están disponibles en esta plataforma.",
      });
    }

    const version = await getCurrentVersion();
    emit({
      status: "checking",
      currentVersion: version,
      newVersion: null,
      notes: "",
      progress: null,
      receivedBytes: 0,
      totalBytes: 0,
      message: "Buscando actualizaciones…",
      apkFileName: null,
    });

    try {
      return supported === "android" ? await checkAndroid() : await checkDesktop();
    } catch (error) {
      return errorState(
        error,
        supported === "android"
          ? "No se pudo comprobar la actualización en Android."
          : "No se pudo comprobar la actualización."
      );
    }
  })().finally(() => {
    checkInFlight = null;
  });

  return checkInFlight;
}

async function checkAndroid(): Promise<UpdateState> {
  const release = await fetchAndroidManifest();
  if (!isNewerVersion(state.currentVersion, release.version)) {
    return emit({
      status: "up-to-date",
      newVersion: null,
      notes: "",
      progress: null,
      message: `Ya tenés la última versión (${state.currentVersion || "actual"}).`,
    });
  }

  clearPending();
  androidRelease = release;
  return emit({
    status: "available",
    newVersion: release.version,
    notes: release.notes,
    progress: null,
    receivedBytes: 0,
    totalBytes: release.asset.size ?? 0,
    message: `La versión ${release.version} está disponible (${formatBytes(
      release.asset.size ?? 0
    )}).`,
  });
}

/**
 * Descarga e instala (escritorio) o descarga y guarda (Android) la
 * actualización anunciada por `checkForUpdates`.
 */
export async function installAvailableUpdate(): Promise<UpdateState> {
  if (installInFlight) return installInFlight;
  if (state.status !== "available") {
    return state;
  }

  installInFlight = (async () => {
    try {
      if (getUpdatePlatform() === "android") {
        if (!androidRelease) {
          throw new UpdateError("No hay una actualización pendiente.", "unknown");
        }
        return await downloadAndroidUpdate(androidRelease);
      }
      return await installDesktopUpdate();
    } catch (error) {
      return errorState(error, "No se pudo completar la actualización.");
    } finally {
      installInFlight = null;
    }
  })();

  return installInFlight;
}

/** Descarta una actualización pendiente y libera recursos nativos. */
export function resetUpdateState(): void {
  clearPending();
  emit({ ...INITIAL_STATE, currentVersion: state.currentVersion });
}

/**
 * Compara la versión instalada con una publicada. Se exporta para reutilizar
 * la misma lógica en pruebas y en mensajes informativos.
 */
export { compareVersions, isNewerVersion };
