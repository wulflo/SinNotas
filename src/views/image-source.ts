/** Primitivas puras compartidas por el escritorio y la APK para imágenes. */

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

export function imageMimeType(extension: string): string {
  return MIME_BY_EXTENSION[extension.toLowerCase()] || "application/octet-stream";
}

/** Envuelve los bytes devueltos por `read_image_data` en una URL temporal. */
export function createImageBlobUrl(bytes: number[], extension: string): string {
  return URL.createObjectURL(
    new Blob([Uint8Array.from(bytes)], { type: imageMimeType(extension) })
  );
}

/** True si el navegador puede cargar la URL (para decidir el fallback por IPC). */
export function imageUrlLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = url;
  });
}

/** `decodeURIComponent` tolerante: devuelve el literal si los escapes son inválidos. */
export function decodeImageSource(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}
