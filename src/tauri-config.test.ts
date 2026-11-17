import { describe, expect, it } from "vitest";
import tauriConfig from "../src-tauri/tauri.conf.json";
import iconManifest from "../src-tauri/icons/icon-manifest.json";
import androidIconManifest from "../src-tauri/icons/icon-manifest.android.json";
import androidBackgroundXml from "../src-tauri/icons/android/values/ic_launcher_background.xml?raw";
import launcherXml from "../src-tauri/icons/android/mipmap-anydpi-v26/ic_launcher.xml?raw";

/**
 * LaTeX usa atributos `style` inline para posicionar superíndices, fracciones y
 * struts. Tauri añade hashes a `style-src` durante el empaquetado y, según la
 * especificación CSP, eso hace que `'unsafe-inline'` se ignore para los
 * atributos. Sin una directiva `style-src-attr` explícita, KaTeX se ve roto
 * únicamente en la app instalada, no en `tauri dev`.
 */
describe("seguridad de la app empaquetada", () => {
  it("permite estilos inline de KaTeX en producción y en desarrollo", () => {
    for (const csp of [tauriConfig.app.security.csp, tauriConfig.app.security.devCsp]) {
      expect(csp).toContain("style-src-attr 'unsafe-inline'");
      expect(csp).toContain("font-src 'self' data:");
    }
  });

  it("genera los iconos de escritorio desde el máster transparente", () => {
    expect(iconManifest.default).toBe("icon-source.png");
    expect(iconManifest.android_fg).toBe("icon-source.png");
  });

  it("usa un logo propio solo en las compilaciones de Android", () => {
    expect(androidIconManifest.default).toBe("android-source.png");
    expect(androidIconManifest.android_fg).toBe("android-source.png");
    expect(androidIconManifest.android_fg_scale).toBeLessThanOrEqual(80);
    expect(androidIconManifest.bg_color).toBe("#1D395D");

    // El manifiesto de escritorio no debe apuntar al logo del APK ni al revés.
    expect(iconManifest.default).not.toBe(androidIconManifest.default);
    expect(iconManifest.android_fg).not.toBe(androidIconManifest.android_fg);
  });

  it("usa el mismo fondo navy en los iconos adaptativos de Android", () => {
    const color = androidBackgroundXml.match(
      /<color name="ic_launcher_background">(#[0-9a-fA-F]{6})<\/color>/,
    )?.[1];

    expect(color?.toLowerCase()).toBe(androidIconManifest.bg_color.toLowerCase());
    expect(launcherXml).toContain('@color/ic_launcher_background');
  });
});
