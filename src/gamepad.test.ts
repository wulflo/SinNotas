import { describe, expect, it } from "vitest";
import {
  CONTROLLER_PRESETS,
  CONTROLLER_TYPE_OPTIONS,
  buttonLabelsFor,
  type ControllerType,
} from "./gamepad";

describe("gamepad presets", () => {
  it("cada preset tiene 16 botones etiquetados", () => {
    (Object.keys(CONTROLLER_PRESETS) as ControllerType[]).forEach((key) => {
      expect(CONTROLLER_PRESETS[key].buttons).toHaveLength(16);
      CONTROLLER_PRESETS[key].buttons.forEach((label) => {
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });

  it("automático ('') devuelve las etiquetas genéricas W3C", () => {
    const labels = buttonLabelsFor("");
    expect(labels).toHaveLength(16);
    expect(labels[0]).toContain("0");
  });

  it("PlayStation etiqueta el botón 0 como ✕ y el 3 como △", () => {
    const labels = buttonLabelsFor("playstation");
    expect(labels[0]).toContain("✕");
    expect(labels[3]).toContain("△");
  });

  it("Nintendo invierte A/B e X/Y respecto al orden Xbox (mapeo W3C)", () => {
    const nintendo = buttonLabelsFor("switch");
    const xbox = buttonLabelsFor("xbox");
    expect(nintendo[0]).toBe("B");
    expect(nintendo[1]).toBe("A");
    expect(xbox[0]).toBe("A");
    expect(xbox[1]).toBe("B");
  });

  it("las opciones del selector cubren los 5 tipos + automático", () => {
    const values = CONTROLLER_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("");
    expect(values).toContain("xbox");
    expect(values).toContain("playstation");
    expect(values).toContain("switch");
    expect(values).toContain("steamdeck");
    expect(values).toContain("generic");
  });
});
