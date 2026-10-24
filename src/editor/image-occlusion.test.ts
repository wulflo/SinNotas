import { describe, expect, it } from "vitest";
import {
  clampImageOcclusionRegion,
  parseImageOcclusions,
  updateImageOcclusionInContent,
} from "./image-occlusion";
import type { ImageOcclusionRegion } from "../types";

const first: ImageOcclusionRegion = {
  source: "assets/anatomia.png",
  x: 0.1,
  y: 0.2,
  width: 0.3,
  height: 0.4,
  color: "#4ade80",
};

const second: ImageOcclusionRegion = {
  source: "assets/anatomia.png",
  x: 0.55,
  y: 0.15,
  width: 0.2,
  height: 0.25,
  shape: "ellipse",
};

describe("updateImageOcclusionInContent", () => {
  it("mueve solo la región activa y conserva FSRS, texto y demás oclusiones", () => {
    const content = [
      "![[assets/anatomia.png]]",
      `image-occlusions:: ${JSON.stringify([first, second])}`,
      "card-s:: 2.7",
      "card-d:: 4.2",
      "last-reviewed:: 2026-10-20T10:00:00.000Z",
    ].join("\n");

    const updated = updateImageOcclusionInContent(content, first, {
      ...first,
      x: 0.25,
      y: 0.35,
      width: 0.25,
      height: 0.3,
    });

    const regions = parseImageOcclusions(updated);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ x: 0.25, y: 0.35, width: 0.25, height: 0.3 });
    expect(regions[1]).toEqual(second);
    expect(updated).toContain("card-s:: 2.7");
    expect(updated).toContain("card-d:: 4.2");
    expect(updated).toContain("last-reviewed:: 2026-10-20T10:00:00.000Z");
    expect(updated.split("\n")[0]).toBe("![[assets/anatomia.png]]");
  });

  it("usa el índice preferido cuando hay regiones con la misma geometría", () => {
    const duplicate = { ...first, hint: "segunda" };
    const content = `imagen\nimage-occlusions:: ${JSON.stringify([first, duplicate])}`;
    const updated = updateImageOcclusionInContent(
      content,
      duplicate,
      { ...duplicate, x: 0.4 },
      1
    );
    const regions = parseImageOcclusions(updated);
    expect(regions[0]).toMatchObject({ x: 0.1 });
    expect(regions[1]).toMatchObject({ x: 0.4, hint: "segunda" });
  });

  it("no modifica nada si la región no pertenece al bloque", () => {
    const content = `imagen\nimage-occlusions:: ${JSON.stringify([first])}`;
    const missing = { ...second, source: "otra.png" };
    expect(updateImageOcclusionInContent(content, missing, { ...missing, x: 0.8 })).toBe(content);
  });

  it("conserva una propiedad inválida sin romper el guardado", () => {
    const content = "imagen\nimage-occlusions:: [{rota: true}]";
    expect(updateImageOcclusionInContent(content, first, first)).toBe(content);
  });

  it("impide que la región activa salga de la imagen", () => {
    const clamped = clampImageOcclusionRegion({
      ...first,
      x: 0.95,
      y: -0.4,
      width: 0.5,
      height: 0.05,
    });
    expect(clamped.x).toBeCloseTo(0.5);
    expect(clamped.y).toBe(0);
    expect(clamped.width).toBeCloseTo(0.5);
    expect(clamped.height).toBeCloseTo(0.05);
  });
});
