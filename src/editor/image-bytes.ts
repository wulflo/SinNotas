/** Formatos raster que el modo web puede mostrar sin ejecutar contenido activo. */
export type RasterImageMime =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "image/bmp";

function matchesAt(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Detecta un formato raster por sus magic bytes. Devuelve `null` para SVG y desconocidos. */
export function detectRasterImageMime(bytes: Uint8Array): RasterImageMime | null {
  if (matchesAt(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (matchesAt(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matchesAt(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    matchesAt(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    matchesAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  if (matchesAt(bytes, 0, [0x42, 0x4d])) return "image/bmp";
  return null;
}

/**
 * Valida una portada del modo web y normaliza su MIME según el contenido real.
 * Los SVG se rechazan: el backend de Tauri solo acepta SVG saneados y el modo
 * web no tiene un saneador equivalente.
 */
export async function normalizeRasterImageFile(file: File): Promise<File | null> {
  if (!file.size) return null;
  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mime = detectRasterImageMime(header);
    if (!mime) return null;
    return new File([file], file.name, {
      type: mime,
      lastModified: file.lastModified,
    });
  } catch {
    return null;
  }
}
