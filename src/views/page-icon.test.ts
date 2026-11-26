// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createPageIcon, pageIconMarkup } from "./page-icon";

describe("pageIconMarkup", () => {
  it("usa currentColor y no colores propios ni emoji", () => {
    const html = pageIconMarkup();
    expect(html).toContain('<svg viewBox="0 0 24 24"');
    expect(html).toContain("page-icon");
    expect(html).not.toContain("📄");
    expect(html).not.toMatch(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i);
  });

  it("la variante diario dibuja el calendario", () => {
    expect(pageIconMarkup(true)).toContain('<rect x="3" y="4"');
    expect(pageIconMarkup(false)).not.toContain("<rect");
  });
});

describe("createPageIcon", () => {
  it("devuelve un span con el SVG adecuado y oculto a lectores de pantalla", () => {
    const icon = createPageIcon(true);
    expect(icon.className).toBe("page-icon");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.querySelector("svg")).not.toBeNull();
  });
});
