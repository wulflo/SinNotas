import { describe, expect, it } from "vitest";
import {
  MAX_APK_BYTES,
  MAX_RELEASE_NOTES_LENGTH,
  UpdateError,
  bytesToHex,
  compareVersions,
  formatBytes,
  isAllowedUpdateUrl,
  isNewerVersion,
  parseReleaseManifest,
  parseVersion,
} from "./update-utils";

const VALID_APK_URL =
  "https://github.com/wulflo/SinNotas/releases/download/v0.2.0/app-release.apk";
const SHA = "a".repeat(64);

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: "0.2.0",
    notes: "Notas de la versión",
    pub_date: "2026-10-25T12:00:00Z",
    platforms: {
      "android-aarch64": { url: VALID_APK_URL, size: 1024, sha256: SHA },
    },
    ...overrides,
  };
}

describe("parseVersion", () => {
  it("acepta versiones simples y con prefijo v", () => {
    expect(parseVersion("1.2.3")?.numbers).toEqual([1, 2, 3]);
    expect(parseVersion("v0.1.1")?.numbers).toEqual([0, 1, 1]);
    expect(parseVersion(" 1.0 ")?.numbers).toEqual([1, 0]);
  });

  it("separa el sufijo de pre-lanzamiento e ignora metadatos", () => {
    expect(parseVersion("1.0.0-beta.2+abc")?.prerelease).toEqual(["beta", "2"]);
  });

  it("rechaza formatos inválidos", () => {
    for (const value of ["", "v", "1..2", "1.0.0-", "01x", "1.0.0 beta", "-1.0.0"]) {
      expect(parseVersion(value), value).toBeNull();
    }
  });
});

describe("compareVersions / isNewerVersion", () => {
  it("compara componentes numéricos", () => {
    expect(compareVersions("1.2.3", "1.2.4")).toBeLessThan(0);
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("v1.0", "1.0.0")).toBe(0);
  });

  it("trata los pre-lanzamientos como anteriores a la versión estable", () => {
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0-beta.2")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBeLessThan(0);
  });

  it("solo informa actualización cuando la candidata es mayor", () => {
    expect(isNewerVersion("0.1.1", "0.2.0")).toBe(true);
    expect(isNewerVersion("0.2.0", "0.2.0")).toBe(false);
    expect(isNewerVersion("0.2.0", "0.1.9")).toBe(false);
  });

  it("lanza UpdateError con versiones inválidas", () => {
    expect(() => compareVersions("x", "1.0.0")).toThrow(UpdateError);
  });
});

describe("isAllowedUpdateUrl", () => {
  it("acepta releases del repositorio y assets de GitHub", () => {
    expect(isAllowedUpdateUrl(VALID_APK_URL)).toBe(true);
    expect(
      isAllowedUpdateUrl("https://objects.githubusercontent.com/github-production-release-asset/x")
    ).toBe(true);
    expect(
      isAllowedUpdateUrl("https://release-assets.githubusercontent.com/github-production-release-asset/x")
    ).toBe(true);
  });

  it("rechaza otros repositorios, hosts parecidos y protocolos inseguros", () => {
    const rejected = [
      "http://github.com/wulflo/SinNotas/releases/download/v0.2.0/app.apk",
      "https://evilgithub.com/wulflo/SinNotas/releases/download/v0.2.0/app.apk",
      "https://github.com/atacante/SinNotas/releases/download/v0.2.0/app.apk",
      "https://github.com/wulflo/SinNotas/releases/tag/v0.2.0",
      "https://user:pass@github.com/wulflo/SinNotas/releases/download/v0.2.0/app.apk",
      "https://github.com:8443/wulflo/SinNotas/releases/download/v0.2.0/app.apk",
      "ftp://github.com/wulflo/SinNotas/releases/download/v0.2.0/app.apk",
      "javascript:alert(1)",
      "",
    ];
    for (const value of rejected) {
      expect(isAllowedUpdateUrl(value), value).toBe(false);
    }
  });
});

describe("parseReleaseManifest", () => {
  it("normaliza un manifiesto válido", () => {
    const parsed = parseReleaseManifest(manifest(), "android-aarch64");
    expect(parsed.version).toBe("0.2.0");
    expect(parsed.notes).toBe("Notas de la versión");
    expect(parsed.asset).toEqual({ url: VALID_APK_URL, size: 1024, sha256: SHA });
  });

  it("recorta las notas largas", () => {
    const parsed = parseReleaseManifest(
      manifest({ notes: "x".repeat(MAX_RELEASE_NOTES_LENGTH + 500) }),
      "android-aarch64"
    );
    expect(parsed.notes).toHaveLength(MAX_RELEASE_NOTES_LENGTH);
  });

  it("rechaza manifiestos sin la plataforma pedida", () => {
    expect(() => parseReleaseManifest(manifest(), "windows-x86_64")).toThrow(UpdateError);
  });

  it("rechaza URLs no oficiales, huellas inválidas y tamaños excesivos", () => {
    const invalid = [
      manifest({
        platforms: { "android-aarch64": { url: "https://example.com/app.apk", sha256: SHA } },
      }),
      manifest({
        platforms: {
          "android-aarch64": { url: VALID_APK_URL, sha256: "no-es-sha" },
        },
      }),
      manifest({
        platforms: {
          "android-aarch64": { url: VALID_APK_URL, size: MAX_APK_BYTES + 1, sha256: SHA },
        },
      }),
      manifest({ version: "no-version" }),
      manifest({ platforms: { "android-aarch64": { url: VALID_APK_URL, size: -1, sha256: SHA } } }),
      "texto",
      null,
    ];
    for (const value of invalid) {
      expect(() => parseReleaseManifest(value, "android-aarch64")).toThrow(UpdateError);
    }
  });
});

describe("formatBytes y bytesToHex", () => {
  it("formatea tamaños legibles", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1,00 KB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10,0 MB");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("convierte bytes a hexadecimal", () => {
    const buffer = new Uint8Array([0, 15, 16, 255]).buffer;
    expect(bytesToHex(buffer)).toBe("000f10ff");
  });
});
