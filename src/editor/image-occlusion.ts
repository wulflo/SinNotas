import type { ImageOcclusionRegion } from "../types";

/**
 * Lógica compartida de oclusiones de imagen.
 *
 * La usan tanto la vista de escritorio como la APK de repaso. Las regiones se
 * leen únicamente de la propiedad `image-occlusions::` del bloque y se validan
 * antes de dibujarlas, de modo que un Markdown manipulado no pueda inyectar
 * coordenadas, colores o contenido SVG arbitrario.
 */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Valida y normaliza una región de oclusión. */
export function normalizeImageOcclusionRegion(
  region: unknown
): ImageOcclusionRegion | null {
  if (!region || typeof region !== "object") return null;
  const candidate = region as Partial<ImageOcclusionRegion>;
  const isValid =
    typeof candidate.source === "string" &&
    candidate.source.trim().length > 0 &&
    isFiniteNumber(candidate.x) &&
    isFiniteNumber(candidate.y) &&
    isFiniteNumber(candidate.width) &&
    isFiniteNumber(candidate.height) &&
    candidate.width > 0 &&
    candidate.height > 0;
  if (!isValid) return null;

  const normalized: ImageOcclusionRegion = {
    source: candidate.source!.trim(),
    x: candidate.x!,
    y: candidate.y!,
    width: candidate.width!,
    height: candidate.height!,
  };
  if (candidate.shape === "rect" || candidate.shape === "ellipse" || candidate.shape === "polygon") {
    normalized.shape = candidate.shape;
  }
  if (isFiniteNumber(candidate.rotation)) {
    normalized.rotation = candidate.rotation;
  }
  if (typeof candidate.color === "string" && /^#[\da-f]{6}$/i.test(candidate.color)) {
    normalized.color = candidate.color;
  }
  if (typeof candidate.hint === "string") {
    normalized.hint = candidate.hint.slice(0, 200);
  }
  if (
    Array.isArray(candidate.points) &&
    candidate.points.every((point) =>
      point &&
      isFiniteNumber(point.x) &&
      isFiniteNumber(point.y)
    )
  ) {
    normalized.points = candidate.points.map(({ x, y }) => ({ x, y }));
  }
  return normalized;
}

/** Extrae las oclusiones declaradas en el contenido Markdown de un bloque. */
export function parseImageOcclusions(content: string): ImageOcclusionRegion[] {
  const match = content.match(/(?:^|\n)\s*image-occlusions::\s*(\[[^\n]*\])/i);
  if (!match) return [];

  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) throw new Error("El valor no es una lista.");
    return parsed.flatMap((region) => {
      const normalized = normalizeImageOcclusionRegion(region);
      return normalized ? [normalized] : [];
    });
  } catch (error) {
    console.error("No se pudieron leer las oclusiones de imagen de un bloque:", error);
    return [];
  }
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Redondea a 4 casas decimales. Evita que el redondeo de floating-point haga
 * que el tamaño guardado difiera del que el usuario dibujó con el cursor.
 */
function roundRegionValue(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Mantiene una región dentro de la imagen y con un tamaño mínimo usable.
 * Se aplica al editar coordenadas desde la APK para que ni un gesto ni un dato
 * manipulado puedan producir máscaras fuera del lienzo.
 */
export function clampImageOcclusionRegion(
  region: ImageOcclusionRegion
): ImageOcclusionRegion {
  const width = roundRegionValue(clampNumber(region.width, 0.02, 1));
  const height = roundRegionValue(clampNumber(region.height, 0.02, 1));
  const x = roundRegionValue(clampNumber(region.x, 0, 1 - width));
  const y = roundRegionValue(clampNumber(region.y, 0, 1 - height));
  return normalizeImageOcclusionRegion({
    ...region,
    x,
    y,
    width,
    height,
    points: region.points?.map((point) => ({
      x: roundRegionValue(clampNumber(point.x, 0, 1)),
      y: roundRegionValue(clampNumber(point.y, 0, 1)),
    })),
  }) ?? region;
}

/**
 * Reemplaza una única región de la propiedad `image-occlusions::`.
 *
 * - Solo modifica la región que coincide con `current` (misma geometría y
 *   fuente), no el texto del bloque ni las propiedades FSRS.
 * - Conserva el resto de regiones y las entradas inválidas ya existentes.
 * - Si no hay una propiedad válida o no hay coincidencia, devuelve el contenido
 *   original sin cambios (el llamador puede detectarlo y avisar).
 */
export function updateImageOcclusionInContent(
  content: string,
  current: ImageOcclusionRegion,
  updated: ImageOcclusionRegion,
  preferredIndex = -1
): string {
  const propertyMatch = content.match(
    /(^|\n)([ \t]*)image-occlusions::\s*(\[[^\n]*\])/i
  );
  if (!propertyMatch || propertyMatch.index === undefined) return content;

  let rawRegions: unknown;
  try {
    rawRegions = JSON.parse(propertyMatch[3]);
  } catch {
    return content;
  }
  if (!Array.isArray(rawRegions)) return content;

  const normalized = rawRegions.map((region) => normalizeImageOcclusionRegion(region));
  const preferred = preferredIndex >= 0 ? normalized[preferredIndex] : null;
  const index =
    preferred &&
    preferred.source === current.source &&
    occlusionRegionsMatch(preferred, current)
      ? preferredIndex
      : normalized.findIndex(
          (region) =>
            region !== null &&
            region.source === current.source &&
            occlusionRegionsMatch(region, current)
        );
  if (index < 0) return content;

  const safeUpdated = normalizeImageOcclusionRegion({
    ...updated,
    source: current.source,
  });
  if (!safeUpdated) return content;

  rawRegions[index] = safeUpdated;
  const newline = propertyMatch[1] || "";
  const indentation = propertyMatch[2] || "";
  const replacement = `${newline}${indentation}image-occlusions:: ${JSON.stringify(rawRegions)}`;
  const start = propertyMatch.index;
  return content.slice(0, start) + replacement + content.slice(start + propertyMatch[0].length);
}

export function occlusionRegionsMatch(
  left: ImageOcclusionRegion,
  right: ImageOcclusionRegion
): boolean {
  return (
    left === right ||
    (
      left.source === right.source &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height &&
      (left.shape || "rect") === (right.shape || "rect") &&
      (left.rotation || 0) === (right.rotation || 0)
    )
  );
}

/**
 * Dibuja las máscaras SVG de una tarjeta de oclusión. Todos los atributos SVG
 * se asignan con `setAttribute` a partir de valores numéricos/validados; nunca
 * se interpola HTML del usuario.
 */
export function appendOcclusionMasks(
  layer: HTMLElement,
  regions: ImageOcclusionRegion[],
  imageElement?: HTMLImageElement,
  className = "image-occlusion-mask",
  highlightedRegion?: ImageOcclusionRegion
): void {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const viewWidth = imageElement ? imageElement.clientWidth : (layer.clientWidth || 1000);
  const viewHeight = imageElement ? imageElement.clientHeight : (layer.clientHeight || 1000);
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("image-occlusion-layer");
  svg.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  regions.forEach((region) => {
    const isQuestionTarget = Boolean(highlightedRegion && occlusionRegionsMatch(region, highlightedRegion));
    const color = isQuestionTarget
      ? "#ef4444"
      : region.color && /^#[\da-f]{6}$/i.test(region.color)
        ? region.color
        : "#4ade80";
    const shape = region.shape || "rect";
    const mask = document.createElementNS(
      svgNamespace,
      shape === "ellipse" ? "ellipse" : shape === "polygon" ? "polygon" : "rect"
    );
    mask.classList.add(className);
    if (isQuestionTarget) mask.classList.add("image-occlusion-mask-question");

    if (shape === "ellipse") {
      mask.setAttribute("cx", String((region.x + region.width / 2) * viewWidth));
      mask.setAttribute("cy", String((region.y + region.height / 2) * viewHeight));
      mask.setAttribute("rx", String(region.width * viewWidth / 2));
      mask.setAttribute("ry", String(region.height * viewHeight / 2));
    } else if (shape === "polygon") {
      const points = region.points?.length
        ? region.points
        : [
          { x: region.x, y: region.y },
          { x: region.x + region.width, y: region.y },
          { x: region.x + region.width, y: region.y + region.height },
          { x: region.x, y: region.y + region.height },
        ];
      mask.setAttribute("points", points.map(({ x, y }) => `${x * viewWidth},${y * viewHeight}`).join(" "));
    } else {
      mask.setAttribute("x", String(region.x * viewWidth));
      mask.setAttribute("y", String(region.y * viewHeight));
      mask.setAttribute("width", String(region.width * viewWidth));
      mask.setAttribute("height", String(region.height * viewHeight));
    }

    const centerX = (region.x + region.width / 2) * viewWidth;
    const centerY = (region.y + region.height / 2) * viewHeight;
    mask.setAttribute("transform", `rotate(${region.rotation || 0} ${centerX} ${centerY})`);
    mask.setAttribute("fill", color);
    mask.setAttribute("style", `fill:${color}`);
    mask.setAttribute("data-region", JSON.stringify(region));
    svg.appendChild(mask);

    if (region.hint) {
      const hint = document.createElementNS(svgNamespace, "text");
      hint.classList.add("image-occlusion-hint");
      hint.setAttribute("x", String(centerX));
      hint.setAttribute("y", String(centerY));
      hint.setAttribute("text-anchor", "middle");
      hint.setAttribute("dominant-baseline", "middle");
      hint.setAttribute("transform", `rotate(${region.rotation || 0} ${centerX} ${centerY})`);
      hint.textContent = region.hint;
      svg.appendChild(hint);
    }
  });

  layer.appendChild(svg);
}
