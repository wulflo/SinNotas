import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = join(dirname(fileURLToPath(import.meta.url)), "prepare-release-assets.mjs");
const tempDirs: string[] = [];

function makeReleaseDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sinnotas-release-assets-"));
  tempDirs.push(dir);
  return dir;
}

function writeAsset(dir: string, name: string, content = `${name}\n`): void {
  writeFileSync(join(dir, name), content);
}

function writeSignedAsset(dir: string, name: string): void {
  writeAsset(dir, name);
  writeAsset(dir, `${name}.sig`, `sig-${name}\n`);
}

function addRequiredAssets(dir: string): void {
  writeSignedAsset(dir, "Sin.Notas_0.2.2_amd64.AppImage");
  writeSignedAsset(dir, "Sin.Notas_0.2.2_amd64.deb");
  writeSignedAsset(dir, "Sin.Notas_0.2.2_x64-setup.exe");
  writeSignedAsset(dir, "Sin.Notas_0.2.2_universal.app.tar.gz");
  writeAsset(dir, "signed.apk", "apk\n");
}

function run(dir: string) {
  return spawnSync(process.execPath, [script, dir, "v0.2.2"], {
    cwd: dirname(script),
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("prepare-release-assets", () => {
  it("publica AppImage y .deb como destinos Linux separados", () => {
    const dir = makeReleaseDir();
    addRequiredAssets(dir);

    const result = run(dir);

    expect(result.status, result.stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(join(dir, "latest.json"), "utf8")) as {
      version: string;
      platforms: Record<string, { signature: string; url: string; sha256?: string }>;
    };

    expect(manifest.version).toBe("0.2.2");
    expect(manifest.platforms["linux-x86_64"]?.url).toMatch(/\.AppImage$/);
    expect(manifest.platforms["linux-x86_64-deb"]?.url).toMatch(/\.deb$/);
    expect(manifest.platforms["linux-x86_64-deb"]?.signature).toBe(
      "sig-Sin.Notas_0.2.2_amd64.deb"
    );
    expect(manifest.platforms["android-aarch64"]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normaliza espacios como GitHub y publica URLs que existen", () => {
    const dir = makeReleaseDir();
    writeSignedAsset(dir, "Sin Notas_0.2.2_amd64.AppImage");
    writeSignedAsset(dir, "Sin Notas_0.2.2_amd64.deb");
    writeSignedAsset(dir, "Sin Notas_0.2.2_x64-setup.exe");
    writeSignedAsset(dir, "Sin Notas_0.2.2_universal.app.tar.gz");
    writeAsset(dir, "signed.apk", "apk\n");

    const result = run(dir);

    expect(result.status, result.stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(join(dir, "latest.json"), "utf8")) as {
      platforms: Record<string, { url: string }>;
    };
    const linuxUrl = manifest.platforms["linux-x86_64"]?.url ?? "";
    const debUrl = manifest.platforms["linux-x86_64-deb"]?.url ?? "";
    expect(linuxUrl).toContain("Sin.Notas_0.2.2_amd64.AppImage");
    expect(debUrl).toContain("Sin.Notas_0.2.2_amd64.deb");
    expect(linuxUrl).not.toContain("%20");
    expect(debUrl).not.toContain("%20");
    expect(existsSync(join(dir, "Sin.Notas_0.2.2_amd64.AppImage.sig"))).toBe(true);
    expect(existsSync(join(dir, "Sin Notas_0.2.2_amd64.AppImage"))).toBe(false);
  });

  it("falla si el .deb no tiene firma para el actualizador", () => {
    const dir = makeReleaseDir();
    addRequiredAssets(dir);
    rmSync(join(dir, "Sin.Notas_0.2.2_amd64.deb.sig"));

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Falta la firma de Sin.Notas_0.2.2_amd64.deb");
  });
});
