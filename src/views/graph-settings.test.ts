import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRAPH_SETTINGS,
  colorForPage,
  defaultGraphSettings,
  loadGraphSettings,
  normalizeGraphSettings,
  saveGraphSettings,
  toPhysicsConfig,
  GRAPH_SETTINGS_STORAGE_KEY,
  GRAPH_SETTINGS_MIGRATION_V2_KEY,
  type GraphColorRule,
} from "./graph-settings";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/** Guarda ajustes con un radio por conexión dado y sin marcador de migración. */
function writeLegacySettings(storage: MemoryStorage, radius: number): void {
  const settings = { ...defaultGraphSettings(), nodePerConnectionRadius: radius };
  saveGraphSettings(settings, storage);
  storage.removeItem(GRAPH_SETTINGS_MIGRATION_V2_KEY);
}

describe("graph-settings", () => {
  it("usa nodos más pequeños, etiquetas a más zoom y repulsión más fuerte por defecto", () => {
    expect(DEFAULT_GRAPH_SETTINGS.nodeBaseRadius).toBeLessThan(8);
    expect(DEFAULT_GRAPH_SETTINGS.labelZoomThreshold).toBeGreaterThan(1.35);
    expect(DEFAULT_GRAPH_SETTINGS.physics.repulsion).toBeGreaterThan(300);
    const physics = toPhysicsConfig(DEFAULT_GRAPH_SETTINGS);
    expect(physics.charge).toBeLessThan(0);
    expect(Math.abs(physics.charge)).toBe(DEFAULT_GRAPH_SETTINGS.physics.repulsion);
    expect(physics.minCollisionRadius).toBeGreaterThanOrEqual(6);
  });

  it("completa objetos parciales y limita valores fuera de rango", () => {
    const normalized = normalizeGraphSettings({
      nodeBaseRadius: 999,
      nodeMaxRadius: 1,
      labelZoomThreshold: -5,
      physics: { repulsion: "no-numérico", linkDistance: 1 },
      colorRules: [{ name: "Diario", color: "#ABCDEF" }],
    });

    expect(normalized.nodeBaseRadius).toBeLessThanOrEqual(30);
    expect(normalized.nodeMaxRadius).toBeGreaterThanOrEqual(normalized.nodeBaseRadius);
    expect(normalized.labelZoomThreshold).toBeGreaterThanOrEqual(0.5);
    expect(normalized.physics.repulsion).toBe(DEFAULT_GRAPH_SETTINGS.physics.repulsion);
    expect(normalized.physics.linkDistance).toBeGreaterThanOrEqual(10);
    expect(normalized.colorRules[0].color).toBe("#abcdef");
    expect(normalized.colorRules[0].name).toBe("Diario");
  });

  it("lee y guarda en localStorage sin romperse con JSON corrupto", () => {
    const storage = new MemoryStorage();
    storage.setItem(GRAPH_SETTINGS_STORAGE_KEY, "{no-json");
    expect(loadGraphSettings(storage)).toEqual(defaultGraphSettings());

    const settings = {
      ...defaultGraphSettings(),
      labelZoomThreshold: 2.4,
      colorRules: [{ id: "r1", name: "Proyecto", color: "#22c55e" }],
    };
    saveGraphSettings(settings, storage);
    expect(loadGraphSettings(storage).labelZoomThreshold).toBe(2.4);
    expect(loadGraphSettings(storage).colorRules).toHaveLength(1);
  });

  it("migra un radio por conexión de 1.2 guardado a 0 y escribe el marcador", () => {
    const storage = new MemoryStorage();
    writeLegacySettings(storage, 1.2);
    const settings = loadGraphSettings(storage);

    expect(settings.nodePerConnectionRadius).toBe(0);
    expect(storage.getItem(GRAPH_SETTINGS_MIGRATION_V2_KEY)).toBe("1");
    // La nueva elección se persiste en disco bajo la clave de ajustes.
    const saved = JSON.parse(storage.getItem(GRAPH_SETTINGS_STORAGE_KEY)!);
    expect(saved.nodePerConnectionRadius).toBe(0);
  });

  it("conserva el radio 1.2 si el marcador de migración ya está presente", () => {
    const storage = new MemoryStorage();
    writeLegacySettings(storage, 1.2);
    storage.setItem(GRAPH_SETTINGS_MIGRATION_V2_KEY, "1");

    const settings = loadGraphSettings(storage);
    expect(settings.nodePerConnectionRadius).toBe(1.2);
    // No se reescribe el ajuste ya guardado (elección posterior del usuario).
    const saved = JSON.parse(storage.getItem(GRAPH_SETTINGS_STORAGE_KEY)!);
    expect(saved.nodePerConnectionRadius).toBe(1.2);
  });

  it("sin ajustes guardados devuelve los defaults (radio 0) y escribe el marcador", () => {
    const storage = new MemoryStorage();
    const settings = loadGraphSettings(storage);

    expect(settings.nodePerConnectionRadius).toBe(0);
    expect(settings).toEqual(defaultGraphSettings());
    expect(storage.getItem(GRAPH_SETTINGS_MIGRATION_V2_KEY)).toBe("1");
    // No se crea un ajuste que el usuario nunca guardó.
    expect(storage.getItem(GRAPH_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("deja intacto un radio distinto de 1.2 y escribe el marcador igualmente", () => {
    const storage = new MemoryStorage();
    writeLegacySettings(storage, 2);
    storage.setItem(GRAPH_SETTINGS_MIGRATION_V2_KEY, "1");

    const settings = loadGraphSettings(storage);
    expect(settings.nodePerConnectionRadius).toBe(2);
    const saved = JSON.parse(storage.getItem(GRAPH_SETTINGS_STORAGE_KEY)!);
    expect(saved.nodePerConnectionRadius).toBe(2);
  });

  it("elige la regla más específica y compara sin mayúsculas ni acentos", () => {
    const rules: GraphColorRule[] = [
      { id: "r1", name: "Diario", color: "#ef4444" },
      { id: "r2", name: "Diario de viaje", color: "#22c55e" },
    ];

    expect(colorForPage("Diario de viaje a Japón", rules)).toBe("#22c55e");
    expect(colorForPage("Mi DIARIO personal", rules)).toBe("#ef4444");
    expect(colorForPage("Proyecto", rules)).toBeNull();
  });

  it("ignora reglas vacías y colores inválidos al aplicar", () => {
    const rules: GraphColorRule[] = [
      { id: "r1", name: "   ", color: "#000000" },
      { id: "r2", name: "Nota", color: "rojo" },
    ];
    expect(colorForPage("Nota cualquiera", rules)).toBe("#3b82f6");
  });
});
