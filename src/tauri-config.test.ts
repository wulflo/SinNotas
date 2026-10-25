import { describe, expect, it } from "vitest";
import tauriConfig from "../src-tauri/tauri.conf.json";
import iconManifest from "../src-tauri/icons/icon-manifest.json";

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

  it("genera los iconos desde el máster transparente", () => {
    expect(iconManifest.default).toBe("icon-source.png");
    expect(iconManifest.android_fg).toBe("icon-source.png");
  });
});
