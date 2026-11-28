import { describe, expect, it } from "vitest";
import { isStaleMutation } from "./epoch-guard";

describe("isStaleMutation", () => {
  it("no marca como obsoleto el mismo epoch", () => {
    expect(isStaleMutation(4, 4)).toBe(false);
  });

  it("marca como obsoleto cualquier cambio de epoch", () => {
    expect(isStaleMutation(4, 5)).toBe(true);
    expect(isStaleMutation(5, 4)).toBe(true);
  });

  it("considera obsoleto incluso un cambio idempotente de vuelta al valor", () => {
    expect(isStaleMutation(2, 2)).toBe(false);
    expect(isStaleMutation(2, 3)).toBe(true);
  });
});
