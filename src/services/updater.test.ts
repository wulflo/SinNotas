import { describe, expect, it } from "vitest";
import { readAndroidManifestResponse } from "./updater";
import { UpdateError } from "./update-utils";

const MANIFEST = {
  version: "0.2.0",
  notes: "Notas de prueba",
  pub_date: "2026-10-25T00:00:00.000Z",
  platforms: {
    "android-aarch64": {
      url: "https://github.com/wulflo/SinNotas/releases/download/v0.2.0/app-release.apk",
      size: 12_111_282,
      sha256: "a".repeat(64),
    },
  },
};

function jsonResponse(body: unknown, contentType = "application/json"): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

describe("readAndroidManifestResponse", () => {
  it("acepta un manifiesto servido como application/octet-stream", async () => {
    // GitHub sirve los assets de release con este Content-Type aunque el
    // contenido sea JSON. Antes se rechazaba y Android mostraba un falso error.
    const release = await readAndroidManifestResponse(
      jsonResponse(MANIFEST, "application/octet-stream")
    );

    expect(release.version).toBe("0.2.0");
    expect(release.asset.sha256).toBe("a".repeat(64));
    expect(release.asset.size).toBe(12_111_282);
  });

  it("acepta un manifiesto con Content-Type JSON normal", async () => {
    const release = await readAndroidManifestResponse(jsonResponse(MANIFEST));
    expect(release.version).toBe("0.2.0");
  });

  it("rechaza HTML aunque el servidor responda 200", async () => {
    const response = new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });

    await expect(readAndroidManifestResponse(response)).rejects.toMatchObject({
      code: "invalid-manifest",
    });
  });

  it("rechaza un manifiesto sin SHA-256", async () => {
    const withoutHash = {
      ...MANIFEST,
      platforms: {
        "android-aarch64": {
          url: MANIFEST.platforms["android-aarch64"].url,
          size: MANIFEST.platforms["android-aarch64"].size,
        },
      },
    };

    await expect(readAndroidManifestResponse(jsonResponse(withoutHash))).rejects.toMatchObject({
      code: "checksum",
    });
  });

  it("rechaza respuestas HTTP que no son 200", async () => {
    const response = new Response("not found", { status: 404 });
    await expect(readAndroidManifestResponse(response)).rejects.toBeInstanceOf(UpdateError);
    await expect(readAndroidManifestResponse(response)).rejects.toMatchObject({ code: "http" });
  });
});
