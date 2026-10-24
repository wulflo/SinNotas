import { DEFAULT_PHYSICS_CONFIG, PhysicsConfig } from "./graph-physics";

/** Clave de localStorage donde se guardan los ajustes del grafo. */
export const GRAPH_SETTINGS_STORAGE_KEY = "sinnotas-graph-settings";

/** Marcador de la migración única al radio por conexión 0 (radios uniformes). */
export const GRAPH_SETTINGS_MIGRATION_V2_KEY = "sinnotas-graph-settings-v2";

/** Antiguo valor por defecto de nodePerConnectionRadius (pre-v2). */
const LEGACY_NODE_PER_CONNECTION_RADIUS = 1.2;

/** Regla de color por nombre de nota. */
export interface GraphColorRule {
  id: string;
  /** Fragmento de texto que debe contener el título (sin distinguir mayúsculas/acentos). */
  name: string;
  /** Color hexadecimal de 6 dígitos (#rrggbb). */
  color: string;
}

/** Fuerzas expuestas en Configuración › Grafo. */
export interface GraphPhysicsSettings {
  /** Magnitud positiva de la repulsión; internamente se aplica como carga negativa. */
  repulsion: number;
  linkStrength: number;
  linkDistance: number;
  centerStrength: number;
  collisionStrength: number;
  velocityDecay: number;
}

export interface GraphSettings {
  colorRules: GraphColorRule[];
  nodeBaseRadius: number;
  nodePerConnectionRadius: number;
  nodeMaxRadius: number;
  linkWidth: number;
  linkHighlightWidth: number;
  /** Zoom a partir del cual las etiquetas aparecen con fundido (0..1). */
  labelZoomThreshold: number;
  physics: GraphPhysicsSettings;
}

/**
 * Valores por defecto tras el rediseño de rendimiento:
 * - nodos uniformes (5 px base, 0 de crecimiento por conexión, 14 px máximo),
 * - etiquetas con fundido al acercar (2×),
 * - repulsión inicial más fuerte (-600) y enlaces algo más largos.
 */
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  colorRules: [],
  nodeBaseRadius: 5,
  nodePerConnectionRadius: 0,
  nodeMaxRadius: 14,
  linkWidth: 1,
  linkHighlightWidth: 2,
  labelZoomThreshold: 2,
  physics: {
    repulsion: 600,
    linkStrength: 0.55,
    linkDistance: 100,
    centerStrength: 0.006,
    collisionStrength: 1,
    velocityDecay: 0.5,
  },
};

/** Rangos seguros para evitar valores absurdos desde localStorage o la UI. */
const LIMITS = {
  repulsion: { min: 10, max: 5000 },
  linkStrength: { min: 0, max: 2 },
  linkDistance: { min: 10, max: 500 },
  centerStrength: { min: 0, max: 0.2 },
  collisionStrength: { min: 0, max: 5 },
  velocityDecay: { min: 0.05, max: 0.99 },
  nodeBaseRadius: { min: 1, max: 30 },
  nodePerConnectionRadius: { min: 0, max: 10 },
  nodeMaxRadius: { min: 2, max: 60 },
  linkWidth: { min: 0.25, max: 12 },
  linkHighlightWidth: { min: 0.25, max: 20 },
  labelZoomThreshold: { min: 0.5, max: 10 },
} as const;

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function cloneSettings(settings: GraphSettings): GraphSettings {
  return {
    ...settings,
    colorRules: settings.colorRules.map((rule) => ({ ...rule })),
    physics: { ...settings.physics },
  };
}

/** Copia profunda de los valores por defecto (segura para mutar). */
export function defaultGraphSettings(): GraphSettings {
  return cloneSettings(DEFAULT_GRAPH_SETTINGS);
}

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function makeRuleId(index: number): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : null;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `graph-rule-${cryptoObj.randomUUID()}`;
  }
  return `graph-rule-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeColorRules(value: unknown): GraphColorRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw, index): GraphColorRule | null => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;
      const color = normalizeColor(record.color, "#3b82f6");
      const id = typeof record.id === "string" && record.id.trim()
        ? record.id
        : makeRuleId(index);
      return { id, name, color };
    })
    .filter((rule): rule is GraphColorRule => rule !== null);
}

/** Valida y completa cualquier objeto (incluido JSON corrupto) con los defaults. */
export function normalizeGraphSettings(raw: unknown): GraphSettings {
  const defaults = DEFAULT_GRAPH_SETTINGS;
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const physicsRaw = record.physics && typeof record.physics === "object"
    ? (record.physics as Record<string, unknown>)
    : {};

  const nodeBaseRadius = clamp(
    record.nodeBaseRadius,
    defaults.nodeBaseRadius,
    LIMITS.nodeBaseRadius.min,
    LIMITS.nodeBaseRadius.max
  );
  const nodeMaxRadius = Math.max(
    nodeBaseRadius,
    clamp(record.nodeMaxRadius, defaults.nodeMaxRadius, LIMITS.nodeMaxRadius.min, LIMITS.nodeMaxRadius.max)
  );

  return {
    colorRules: normalizeColorRules(record.colorRules),
    nodeBaseRadius,
    nodePerConnectionRadius: clamp(
      record.nodePerConnectionRadius,
      defaults.nodePerConnectionRadius,
      LIMITS.nodePerConnectionRadius.min,
      LIMITS.nodePerConnectionRadius.max
    ),
    nodeMaxRadius,
    linkWidth: clamp(record.linkWidth, defaults.linkWidth, LIMITS.linkWidth.min, LIMITS.linkWidth.max),
    linkHighlightWidth: clamp(
      record.linkHighlightWidth,
      defaults.linkHighlightWidth,
      LIMITS.linkHighlightWidth.min,
      LIMITS.linkHighlightWidth.max
    ),
    labelZoomThreshold: clamp(
      record.labelZoomThreshold,
      defaults.labelZoomThreshold,
      LIMITS.labelZoomThreshold.min,
      LIMITS.labelZoomThreshold.max
    ),
    physics: {
      repulsion: clamp(physicsRaw.repulsion, defaults.physics.repulsion, LIMITS.repulsion.min, LIMITS.repulsion.max),
      linkStrength: clamp(
        physicsRaw.linkStrength,
        defaults.physics.linkStrength,
        LIMITS.linkStrength.min,
        LIMITS.linkStrength.max
      ),
      linkDistance: clamp(
        physicsRaw.linkDistance,
        defaults.physics.linkDistance,
        LIMITS.linkDistance.min,
        LIMITS.linkDistance.max
      ),
      centerStrength: clamp(
        physicsRaw.centerStrength,
        defaults.physics.centerStrength,
        LIMITS.centerStrength.min,
        LIMITS.centerStrength.max
      ),
      collisionStrength: clamp(
        physicsRaw.collisionStrength,
        defaults.physics.collisionStrength,
        LIMITS.collisionStrength.min,
        LIMITS.collisionStrength.max
      ),
      velocityDecay: clamp(
        physicsRaw.velocityDecay,
        defaults.physics.velocityDecay,
        LIMITS.velocityDecay.min,
        LIMITS.velocityDecay.max
      ),
    },
  };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Migración única "v2": el radio por conexión por defecto pasa de 1.2 a 0
 * (todos los nodos con el mismo radio). El marcador se escribe SIEMPRE en la
 * primera carga —haya o no ajustes guardados— para no volver a pisar una
 * elección posterior del usuario. Solo se reescribe el radio cuando vale
 * exactamente 1.2, el antiguo valor por defecto; una elección manual previa
 * de 1.2 no se distingue del antiguo default y también pasa a 0.
 */
function migratePerConnectionRadiusV2(
  settings: GraphSettings,
  hadStoredSettings: boolean,
  storage: Storage
): void {
  if (storage.getItem(GRAPH_SETTINGS_MIGRATION_V2_KEY) !== null) return;
  try {
    if (
      hadStoredSettings &&
      settings.nodePerConnectionRadius === LEGACY_NODE_PER_CONNECTION_RADIUS
    ) {
      settings.nodePerConnectionRadius = DEFAULT_GRAPH_SETTINGS.nodePerConnectionRadius;
      saveGraphSettings(settings, storage);
    }
    storage.setItem(GRAPH_SETTINGS_MIGRATION_V2_KEY, "1");
  } catch {
    // Almacenamiento lleno o bloqueado: se reintentará en la próxima carga.
  }
}

/** Lee los ajustes guardados; nunca lanza (JSON corrupto → defaults). */
export function loadGraphSettings(storage: Storage | null = getStorage()): GraphSettings {
  if (!storage) return defaultGraphSettings();
  let stored: string | null = null;
  try {
    stored = storage.getItem(GRAPH_SETTINGS_STORAGE_KEY);
    const settings = stored
      ? normalizeGraphSettings(JSON.parse(stored))
      : defaultGraphSettings();
    migratePerConnectionRadiusV2(settings, stored !== null, storage);
    return settings;
  } catch {
    return defaultGraphSettings();
  }
}

export function saveGraphSettings(
  settings: GraphSettings,
  storage: Storage | null = getStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(GRAPH_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeGraphSettings(settings)));
  } catch {
    // Almacenamiento lleno o bloqueado: los ajustes siguen activos en memoria.
  }
}

/** Normaliza títulos y patrones para comparar sin acentos ni mayúsculas. */
function normalizeMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/**
 * Devuelve el color de la regla que mejor encaja con el título.
 * Gana la coincidencia más específica (patrón más largo) y, en empate, la
 * primera de la lista. Las reglas vacías se ignoran.
 */
export function colorForPage(
  pageTitle: string,
  rules: readonly GraphColorRule[]
): string | null {
  const title = normalizeMatch(pageTitle);
  if (!title) return null;

  let best: { color: string; length: number; order: number } | null = null;
  for (const [order, rule] of rules.entries()) {
    const pattern = normalizeMatch(rule.name);
    if (!pattern || !title.includes(pattern)) continue;
    if (
      !best ||
      pattern.length > best.length ||
      (pattern.length === best.length && order < best.order)
    ) {
      best = { color: normalizeColor(rule.color, "#3b82f6"), length: pattern.length, order };
    }
  }
  return best ? best.color : null;
}

/** Convierte los ajustes de UI a la configuración completa de física. */
export function toPhysicsConfig(settings: GraphSettings): PhysicsConfig {
  return {
    ...DEFAULT_PHYSICS_CONFIG,
    charge: -Math.abs(settings.physics.repulsion),
    linkStrength: settings.physics.linkStrength,
    linkDistance: settings.physics.linkDistance,
    centerStrength: settings.physics.centerStrength,
    collisionStrength: settings.physics.collisionStrength,
    velocityDecay: settings.physics.velocityDecay,
    // La separación mínima acompaña al tamaño de los nodos: si se agrandan,
    // la colisión debe crecer con ellos para que no se solapen.
    minCollisionRadius: Math.max(6, settings.nodeBaseRadius + 1),
  };
}
