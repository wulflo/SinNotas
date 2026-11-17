import { describe, expect, it } from "vitest";
import { labelAlphaForZoom } from "./graph-labels";

describe("labelAlphaForZoom", () => {
  it("devuelve 1 desde el umbral exacto y por encima", () => {
    expect(labelAlphaForZoom(2, 2)).toBe(1);
    expect(labelAlphaForZoom(3, 2)).toBe(1);
  });

  it("devuelve 0 por debajo de 0,75 × umbral, incluyendo el borde exacto", () => {
    expect(labelAlphaForZoom(1, 2)).toBe(0);
    expect(labelAlphaForZoom(1.5, 2)).toBe(0);
  });

  it("hace la transición lineal entre 0,75 × umbral y el umbral", () => {
    // Punto medio: (1.75 - 1.5) / 0.5 = 0.5
    expect(labelAlphaForZoom(1.75, 2)).toBe(0.5);
    // Justo por encima del borde inferior: valor pequeño pero > 0.
    expect(labelAlphaForZoom(1.4925 + 0.0001, 1.99)).toBeGreaterThan(0);
    expect(labelAlphaForZoom(1.99, 1.99)).toBe(1);
  });

  it("funciona con threshold 0.5", () => {
    expect(labelAlphaForZoom(0.2, 0.5)).toBe(0);
    expect(labelAlphaForZoom(0.375, 0.5)).toBe(0);
    expect(labelAlphaForZoom(0.4375, 0.5)).toBe(0.5);
    expect(labelAlphaForZoom(0.5, 0.5)).toBe(1);
  });

  it("funciona con threshold 10", () => {
    expect(labelAlphaForZoom(7, 10)).toBe(0);
    expect(labelAlphaForZoom(7.5, 10)).toBe(0);
    expect(labelAlphaForZoom(8.75, 10)).toBe(0.5);
    expect(labelAlphaForZoom(10, 10)).toBe(1);
  });

  it("devuelve 0 con valores no finitos (NaN e Infinito)", () => {
    expect(labelAlphaForZoom(NaN, 2)).toBe(0);
    expect(labelAlphaForZoom(2, NaN)).toBe(0);
    expect(labelAlphaForZoom(Infinity, 2)).toBe(0);
    expect(labelAlphaForZoom(2, Infinity)).toBe(0);
    expect(labelAlphaForZoom(-Infinity, -Infinity)).toBe(0);
  });

  it("devuelve 0 con escala negativa o cero", () => {
    expect(labelAlphaForZoom(0, 2)).toBe(0);
    expect(labelAlphaForZoom(-1, 2)).toBe(0);
  });
});
