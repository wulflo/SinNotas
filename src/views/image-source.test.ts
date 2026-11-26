// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createImageBlobUrl, decodeImageSource, imageMimeType, imageUrlLoads } from "./image-source";

describe("imageMimeType", () => {
  it("mapa las extensiones soportadas y usa octet-stream para las demás", () => {
    expect(imageMimeType("PNG")).toBe("image/png");
    expect(imageMimeType("jpeg")).toBe("image/jpeg");
    expect(imageMimeType("svg")).toBe("image/svg+xml");
    expect(imageMimeType("bin")).toBe("application/octet-stream");
  });
});

describe("decodeImageSource", () => {
  it("decodifica escapes y conserva el literal si son inválidos", () => {
    expect(decodeImageSource("assets/mi%20nota.png")).toBe("assets/mi nota.png");
    expect(decodeImageSource("assets/%ZZ.png")).toBe("assets/%ZZ.png");
  });
});

describe("createImageBlobUrl", () => {
  it("crea un Blob con el MIME correcto", () => {
    const create = vi.fn((_blob: Blob) => "blob:test");
    vi.stubGlobal("URL", { ...URL, createObjectURL: create });
    expect(createImageBlobUrl([1, 2, 3], "webp")).toBe("blob:test");
    const [blob] = create.mock.calls[0];
    expect(blob.type).toBe("image/webp");
    vi.unstubAllGlobals();
  });
});

describe("imageUrlLoads", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resuelve true al cargar y false al fallar", async () => {
    const instances: Array<{ onload?: () => void; onerror?: () => void; src?: string }> = [];
    vi.stubGlobal(
      "Image",
      class {
        onload?: () => void;
        onerror?: () => void;
        set src(_value: string) {
          instances.push(this);
        }
      }
    );

    const ok = imageUrlLoads("blob:ok");
    instances[0].onload?.();
    await expect(ok).resolves.toBe(true);

    const bad = imageUrlLoads("blob:bad");
    instances[1].onerror?.();
    await expect(bad).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});
