import { describe, expect, it } from "vitest";
import {
  CHEMICAL_ELEMENTS,
  MOLECULE_STAGES,
  progressStageFromPoints,
} from "./periodic-elements";

describe("progressStageFromPoints", () => {
  it("starts with a lone proton at zero points", () => {
    expect(progressStageFromPoints(0)).toEqual({ kind: "proton", points: 0 });
  });

  it("maps points 1..118 to elements Z=1..118", () => {
    const hydrogen = progressStageFromPoints(1);
    expect(hydrogen.kind).toBe("element");
    if (hydrogen.kind === "element") {
      expect(hydrogen.element.z).toBe(1);
      expect(hydrogen.element.symbol).toBe("H");
    }

    const oganesson = progressStageFromPoints(118);
    expect(oganesson.kind).toBe("element");
    if (oganesson.kind === "element") {
      expect(oganesson.element.z).toBe(118);
      expect(oganesson.element.symbol).toBe("Og");
    }
  });

  it("starts the molecule ladder at 119 points and advances every 30 points", () => {
    const first = progressStageFromPoints(119);
    expect(first.kind).toBe("molecule");
    if (first.kind === "molecule") expect(first.molecule.id).toBe("h2");

    const stillFirst = progressStageFromPoints(148);
    expect(stillFirst.kind).toBe("molecule");
    if (stillFirst.kind === "molecule") expect(stillFirst.molecule.id).toBe("h2");

    const water = progressStageFromPoints(149);
    expect(water.kind).toBe("molecule");
    if (water.kind === "molecule") expect(water.molecule.id).toBe("water");
  });

  it("keeps the last macromolecule for very high scores", () => {
    const last = progressStageFromPoints(10_000);
    expect(last.kind).toBe("molecule");
    if (last.kind === "molecule") {
      expect(last.molecule.id).toBe(MOLECULE_STAGES[MOLECULE_STAGES.length - 1].id);
    }
  });
});

describe("molecule stage data", () => {
  it("is sorted and has a valid structure", () => {
    for (let index = 0; index < MOLECULE_STAGES.length; index++) {
      const stage = MOLECULE_STAGES[index];
      expect(stage.name.length).toBeGreaterThan(0);
      expect(stage.formula.length).toBeGreaterThan(0);
      if (index > 0) {
        expect(stage.minPoints).toBeGreaterThan(MOLECULE_STAGES[index - 1].minPoints);
      }
      stage.bonds.forEach((bond) => {
        expect(stage.atoms[bond.a]).toBeDefined();
        expect(stage.atoms[bond.b]).toBeDefined();
      });
    }
  });

  it("covers every element exactly once", () => {
    expect(CHEMICAL_ELEMENTS).toHaveLength(118);
    expect(new Set(CHEMICAL_ELEMENTS.map((element) => element.z)).size).toBe(118);
  });
});
