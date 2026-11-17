// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { detectRasterImageMime, normalizeRasterImageFile } from "./image-bytes";

describe("validación de imágenes raster", () => {
  it("detecta PNG, JPEG, GIF, WEBP y BMP", () => {
    expect(detectRasterImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png"
    );
    expect(detectRasterImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectRasterImageMime(new TextEncoder().encode("GIF89a..."))).toBe("image/gif");
    expect(
      detectRasterImageMime(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
      )
    ).toBe("image/webp");
    expect(detectRasterImageMime(new TextEncoder().encode("BM..."))).toBe("image/bmp");
  });

  it("rechaza SVG y archivos truncados", () => {
    expect(detectRasterImageMime(new TextEncoder().encode("<svg><script/></svg>"))).toBeNull();
    expect(detectRasterImageMime(new TextEncoder().encode("<?xml version=\"1.0\"?>"))).toBeNull();
    expect(detectRasterImageMime(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("normaliza el MIME de un raster aunque el archivo declare SVG", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])],
      "portada.svg",
      { type: "image/svg+xml" }
    );
    const normalized = await normalizeRasterImageFile(file);
    expect(normalized?.type).toBe("image/png");
  });

  it("rechaza un SVG aunque declare un MIME raster", async () => {
    const file = new File([new TextEncoder().encode("<svg><script/></svg>")], "portada.png", {
      type: "image/png",
    });
    expect(await normalizeRasterImageFile(file)).toBeNull();
  });

  it("rechaza archivos vacíos", async () => {
    const file = new File([], "portada.png", { type: "image/png" });
    expect(await normalizeRasterImageFile(file)).toBeNull();
  });
});
