/**
 * Tamaños de texto configurables desde Apariencia.
 *
 * El módulo es puro salvo por el acceso opcional a `localStorage` y al nodo
 * raíz del documento, ambos inyectables para poder probarlo sin DOM.
 */

import type { TypographyType } from "./types";

export type FontSizeKey =
  | "ui"
  | "editor"
  | "pageTitle"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "flashcardText";

export type FontSizeUnit = "px" | "em";

export interface FontSizeDefinition {
  key: FontSizeKey;
  storageKey: string;
  cssVariable: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  /**
   * `px` para medidas absolutas y `em` para multiplicadores de la fuente de
   * interfaz. Las tarjetas de repaso usan `em` para que su texto sea siempre
   * más grande que la interfaz sin duplicar la escala global.
   */
  unit?: FontSizeUnit;
}

export const FONT_SIZE_DEFINITIONS: readonly FontSizeDefinition[] = [
  {
    key: "ui",
    storageKey: "sinnotas-font-size-ui",
    cssVariable: "--ls-font-size-ui",
    label: "Interfaz",
    // La interfaz parte de 15 px. La escala global conserva 13 px como base
    // histórica para que los controles compactos crezcan de forma proporcional
    // (15 px dejan la escala en ~1.15×, no en 2×).
    defaultValue: 15,
    min: 11,
    max: 40,
    step: 1,
  },
  {
    key: "editor",
    storageKey: "sinnotas-font-size-editor",
    cssVariable: "--ls-font-size-editor",
    label: "Texto del editor",
    defaultValue: 15,
    min: 12,
    max: 24,
    step: 1,
  },
  {
    key: "pageTitle",
    storageKey: "sinnotas-font-size-page-title",
    cssVariable: "--ls-font-size-page-title",
    label: "Título de página",
    defaultValue: 32,
    min: 20,
    max: 56,
    step: 1,
  },
  {
    key: "h1",
    storageKey: "sinnotas-font-size-h1",
    cssVariable: "--ls-font-size-h1",
    label: "Encabezado H1",
    defaultValue: 28,
    min: 18,
    max: 48,
    step: 1,
  },
  {
    key: "h2",
    storageKey: "sinnotas-font-size-h2",
    cssVariable: "--ls-font-size-h2",
    label: "Encabezado H2",
    defaultValue: 24,
    min: 16,
    max: 42,
    step: 1,
  },
  {
    key: "h3",
    storageKey: "sinnotas-font-size-h3",
    cssVariable: "--ls-font-size-h3",
    label: "Encabezado H3",
    defaultValue: 20,
    min: 14,
    max: 36,
    step: 1,
  },
  {
    key: "h4",
    storageKey: "sinnotas-font-size-h4",
    cssVariable: "--ls-font-size-h4",
    label: "Encabezado H4",
    defaultValue: 18,
    min: 13,
    max: 32,
    step: 1,
  },
  {
    key: "h5",
    storageKey: "sinnotas-font-size-h5",
    cssVariable: "--ls-font-size-h5",
    label: "Encabezado H5",
    defaultValue: 16,
    min: 12,
    max: 28,
    step: 1,
  },
  {
    key: "h6",
    storageKey: "sinnotas-font-size-h6",
    cssVariable: "--ls-font-size-h6",
    label: "Encabezado H6",
    defaultValue: 14,
    min: 11,
    max: 26,
    step: 1,
  },
  {
    key: "flashcardText",
    // Se conserva la clave histórica para respetar el tamaño ya elegido.
    storageKey: "sinnotas-font-size-flashcard-question",
    cssVariable: "--ls-flashcard-text-em",
    label: "Texto de tarjeta",
    // 1 em de la interfaz por defecto; se puede reducir a 0.8em o aumentar
    // hasta 3em desde los ajustes de Flashcards.
    defaultValue: 1,
    min: 0.8,
    max: 3,
    step: 0.1,
    unit: "em",
  },
];

export const FONT_SIZE_KEYS: readonly FontSizeKey[] = FONT_SIZE_DEFINITIONS.map(
  (definition) => definition.key
);

const DEFINITION_BY_KEY = new Map<FontSizeKey, FontSizeDefinition>(
  FONT_SIZE_DEFINITIONS.map((definition) => [definition.key, definition])
);

/** Versión de los valores por defecto; permite migrar ajustes históricos. */
const FONT_DEFAULTS_VERSION_KEY = "sinnotas-font-defaults-version";
const CURRENT_FONT_DEFAULTS_VERSION = "2";
/** Valores de interfaz que fueron defaults en versiones anteriores. */
const LEGACY_UI_DEFAULTS = new Set([24, 26]);
/** Base usada por las tarjetas cuando su tamaño se guardaba en píxeles. */
const LEGACY_REVIEW_PX_BASE = 15;
const LEGACY_REVIEW_SCALE = 2;

export const DEFAULT_FONT_SIZES: Readonly<Record<FontSizeKey, number>> = Object.freeze(
  FONT_SIZE_DEFINITIONS.reduce(
    (sizes, definition) => {
      sizes[definition.key] = definition.defaultValue;
      return sizes;
    },
    {} as Record<FontSizeKey, number>
  )
);

export interface FontSizeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FontSizeTarget {
  style: {
    setProperty(property: string, value: string): void;
  };
}

export function fontSizeDefinition(key: FontSizeKey): FontSizeDefinition {
  const definition = DEFINITION_BY_KEY.get(key);
  if (!definition) throw new Error(`Tamaño de texto desconocido: ${key}`);
  return definition;
}

export function clampFontSize(key: FontSizeKey, value: number): number {
  const definition = fontSizeDefinition(key);
  if (!Number.isFinite(value)) return definition.defaultValue;
  const stepped = Math.round(value / definition.step) * definition.step;
  const clamped = Math.min(definition.max, Math.max(definition.min, stepped));
  // Evita valores como 2.4000000000000004 en los multiplicadores `em`.
  return Number(clamped.toFixed(2));
}

/**
 * Migra los defaults históricos de la interfaz (24/26 px) a 15 px una sola
 * vez. Los valores personalizados distintos de esos defaults se conservan.
 */
export function migrateFontSizeDefaults(
  storage: FontSizeStorage | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    if (storage.getItem(FONT_DEFAULTS_VERSION_KEY) === CURRENT_FONT_DEFAULTS_VERSION) return;
    const uiDefinition = fontSizeDefinition("ui");
    const storedUi = Number(storage.getItem(uiDefinition.storageKey));
    if (LEGACY_UI_DEFAULTS.has(storedUi)) {
      storage.setItem(uiDefinition.storageKey, String(uiDefinition.defaultValue));
    }
    storage.setItem(FONT_DEFAULTS_VERSION_KEY, CURRENT_FONT_DEFAULTS_VERSION);
  } catch {
    // Si el almacenamiento está bloqueado se mantienen los defaults en memoria.
  }
}

function defaultStorage(): FontSizeStorage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function defaultTarget(): FontSizeTarget | null {
  if (typeof document === "undefined") return null;
  return document.documentElement;
}

export function readFontSize(
  key: FontSizeKey,
  storage: FontSizeStorage | null = defaultStorage()
): number {
  const definition = fontSizeDefinition(key);
  if (!storage) return definition.defaultValue;
  let stored: string | null = null;
  try {
    stored = storage.getItem(definition.storageKey);
  } catch {
    return definition.defaultValue;
  }
  if (stored === null || stored.trim() === "") return definition.defaultValue;
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) return definition.defaultValue;
  // Las tarjetas guardaban píxeles (20/18 por defecto). Si el valor excede el
  // rango `em` actual lo interpretamos como el tamaño efectivo anterior
  // (px × escala 2) y lo convertimos a múltiplos de la interfaz.
  if (definition.unit === "em" && parsed > definition.max) {
    return clampFontSize(
      key,
      (parsed * LEGACY_REVIEW_SCALE) / LEGACY_REVIEW_PX_BASE
    );
  }
  return clampFontSize(key, parsed);
}

export function readFontSizes(
  storage: FontSizeStorage | null = defaultStorage()
): Record<FontSizeKey, number> {
  migrateFontSizeDefaults(storage);
  return FONT_SIZE_DEFINITIONS.reduce(
    (sizes, definition) => {
      sizes[definition.key] = readFontSize(definition.key, storage);
      return sizes;
    },
    {} as Record<FontSizeKey, number>
  );
}

export function writeFontSize(
  key: FontSizeKey,
  value: number,
  storage: FontSizeStorage | null = defaultStorage()
): number {
  const clamped = clampFontSize(key, value);
  if (storage) {
    try {
      storage.setItem(fontSizeDefinition(key).storageKey, String(clamped));
    } catch {
      // La configuración visual sigue aplicándose aunque no se pueda guardar.
    }
  }
  return clamped;
}

export function resetFontSizes(storage: FontSizeStorage | null = defaultStorage()): void {
  if (!storage) return;
  FONT_SIZE_DEFINITIONS.forEach((definition) => {
    try {
      storage.removeItem(definition.storageKey);
    } catch {
      // Ignorar almacenamiento bloqueado.
    }
  });
}

export function applyFontSizes(
  sizes: Partial<Record<FontSizeKey, number>>,
  target: FontSizeTarget | null = defaultTarget()
): void {
  if (!target) return;
  FONT_SIZE_DEFINITIONS.forEach((definition) => {
    const value = clampFontSize(
      definition.key,
      sizes[definition.key] ?? definition.defaultValue
    );
    target.style.setProperty(
      definition.cssVariable,
      definition.unit === "em" ? String(value) : `${value}px`
    );
  });
  // La misma escala global alimenta escritorio (`--ls-font-scale`) y la vista
  // de repaso (`--mobile-font-scale`). Así el tamaño elegido en una superficie
  // se conserva al volver a la otra.
  const scale = String(mobileFontScale(sizes.ui ?? fontSizeDefinition("ui").defaultValue));
  target.style.setProperty("--ls-font-scale", scale);
  target.style.setProperty("--mobile-font-scale", scale);
}

/**
 * La escala global parte del tamaño de interfaz. El tamaño base histórico es
 * 13 px, así que el default actual de 15 px deja la escala en ~1.15×. El rango
 * permite bajar a ~0.85× (11 px) o subir hasta 3× sin desbordar los controles.
 *
 * Las tarjetas de repaso no usan esta escala para su texto: su tamaño se
 * expresa en `em` de `--ls-font-size-ui` (por defecto 2.4em).
 */
/**
 * Familia activa para los canvas. `CanvasRenderingContext2D.font` no entiende
 * variables CSS, así que hay que resolver el valor computado del documento.
 * Se acepta una fuente inyectable para poder probarlo sin DOM.
 */
export function activeFontFamily(
  source: { fontFamily?: string } | null = typeof document !== "undefined"
    ? getComputedStyle(document.body)
    : null
): string {
  return source?.fontFamily?.trim() || "system-ui, sans-serif";
}

const VALID_TYPOGRAPHY = new Set<TypographyType>([
  "sans",
  "serif",
  "mono",
  "dyslexic",
  "system",
]);

/**
 * Aplica la tipografía guardada al documento. La vista móvil no carga
 * `style.css`, pero comparte `localStorage` con el escritorio: esto replica la
 * lectura de `sinnotas-font` y `sinnotas-system-font` para que la APK use la
 * misma familia que el editor.
 */
export function applyStoredFontFamily(
  root: FontFamilyTarget | null = typeof document !== "undefined"
    ? document.documentElement
    : null,
  storage: FontSizeStorage | null = defaultStorage()
): TypographyType {
  const saved = storage?.getItem("sinnotas-font");
  const font: TypographyType =
    saved && VALID_TYPOGRAPHY.has(saved as TypographyType)
      ? (saved as TypographyType)
      : "sans";

  if (font === "system") {
    const system = storage?.getItem("sinnotas-system-font")?.trim();
    if (system) {
      root?.style.setProperty(
        "--ls-system-font",
        `"${system}", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
      );
    } else {
      root?.style.removeProperty("--ls-system-font");
    }
  }
  root?.setAttribute("data-font", font);
  return font;
}

export interface FontFamilyTarget {
  setAttribute(name: string, value: string): void;
  style: {
    setProperty(property: string, value: string): void;
    removeProperty(property: string): string;
  };
}

export function mobileFontScale(uiSize: number): number {
  const ratio = clampFontSize("ui", uiSize) / 13;
  return Math.min(3, Math.max(0.85, ratio));
}
