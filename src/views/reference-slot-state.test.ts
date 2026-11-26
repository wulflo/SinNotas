// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createReferenceExpandButton, toggleReferenceExpanded } from "./reference-slot-state";

const labels = { expand: "Ver nota sin truncar", collapse: "Ver nota truncada" };

describe("toggleReferenceExpanded", () => {
  it("alterna solo la ranura indicada sin mutar el conjunto original", () => {
    const original = new Set([0]);
    const next = toggleReferenceExpanded(original, 1);
    expect([...next].sort()).toEqual([0, 1]);
    expect([...original]).toEqual([0]);
    expect([...toggleReferenceExpanded(next, 0)]).toEqual([1]);
  });
});

describe("createReferenceExpandButton", () => {
  it("ajusta clase, aria-pressed, etiqueta y carácter según el estado", () => {
    const collapsed = createReferenceExpandButton(false, labels, () => {});
    expect(collapsed.className).toContain("reference-slot-expand");
    expect(collapsed.getAttribute("aria-pressed")).toBe("false");
    expect(collapsed.title).toBe(labels.expand);
    expect(collapsed.textContent).toBe("⤢");

    const expanded = createReferenceExpandButton(true, labels, () => {});
    expect(expanded.getAttribute("aria-pressed")).toBe("true");
    expect(expanded.title).toBe(labels.collapse);
    expect(expanded.textContent).toBe("⤡");
  });

  it("llama a onToggle al pulsarlo", () => {
    const onToggle = vi.fn();
    createReferenceExpandButton(false, labels, onToggle).click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
