import { describe, expect, it } from "vitest";
import {
  buildOffsets,
  computeVisibleRange,
  findIndexAtOffset,
} from "./virtual-list";

describe("virtual-list", () => {
  describe("buildOffsets", () => {
    it("acumula alturas y añade el borde final", () => {
      const offsets = buildOffsets([100, 50, 25]);
      expect(Array.from(offsets)).toEqual([0, 100, 150, 175]);
    });

    it("trata alturas negativas como cero", () => {
      const offsets = buildOffsets([10, -5, 10]);
      expect(Array.from(offsets)).toEqual([0, 10, 10, 20]);
    });

    it("devuelve un único borde para una lista vacía", () => {
      expect(Array.from(buildOffsets([]))).toEqual([0]);
    });
  });

  describe("findIndexAtOffset", () => {
    const offsets = buildOffsets([100, 100, 100, 100]);

    it("encuentra la fila que contiene la coordenada", () => {
      expect(findIndexAtOffset(offsets, 0)).toBe(0);
      expect(findIndexAtOffset(offsets, 99)).toBe(0);
      expect(findIndexAtOffset(offsets, 100)).toBe(1);
      expect(findIndexAtOffset(offsets, 250)).toBe(2);
    });

    it("se limita a los extremos de la lista", () => {
      expect(findIndexAtOffset(offsets, -50)).toBe(0);
      expect(findIndexAtOffset(offsets, 10_000)).toBe(4);
      expect(findIndexAtOffset(buildOffsets([]), 10)).toBe(0);
    });
  });

  describe("computeVisibleRange", () => {
    const offsets = buildOffsets([100, 100, 100, 100]);

    it("incluye las filas que cruzan el viewport", () => {
      expect(computeVisibleRange(offsets, 0, 150, 0)).toEqual({ start: 0, end: 2 });
      expect(computeVisibleRange(offsets, 100, 100, 0)).toEqual({ start: 1, end: 2 });
    });

    it("amplía el rango con el margen de seguridad", () => {
      expect(computeVisibleRange(offsets, 100, 100, 50)).toEqual({ start: 0, end: 3 });
    });

    it("no devuelve filas fuera de la lista", () => {
      expect(computeVisibleRange(offsets, 10_000, 100, 0)).toEqual({ start: 4, end: 4 });
      expect(computeVisibleRange(buildOffsets([]), 0, 100, 0)).toEqual({ start: 0, end: 0 });
    });

    it("con 15.000 filas solo selecciona una ventana pequeña", () => {
      const many = buildOffsets(new Array(15_000).fill(120));
      const range = computeVisibleRange(many, 600_000, 800, 300);
      expect(range.end - range.start).toBeLessThan(25);
      expect(range.start).toBeGreaterThan(4_000);
    });
  });
});
