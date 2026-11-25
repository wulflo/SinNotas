// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { setLanguagePreference, translate } from "./i18n";
import { BIBLIOGRAPHY_STATUS_LABELS } from "./views/bibliography";

/**
 * Los párrafos de Ajustes > Avanzado que contienen <code> se traducen nodo a
 * nodo (src/i18n.ts:localizeTextNode). Cada fragmento debe tener entrada en
 * los tres diccionarios; si no, el texto español se filtra en EN/ZH.
 */
const advancedHelpFragments = [
  "Borra la programación FSRS (",
  ", etc.) de todas las tarjetas o de una sola. Las tarjetas vuelven a considerarse nuevas; el texto y las oclusiones no se tocan. El trabajo se hace por lotes para no saturar el equipo.",
  "Quita los marcadores que generan tarjetas (",
  ", resaltados",
  ", cloze, separadores",
  "y datos de repaso) sin borrar el contenido ni la jerarquía de los bullets. Puedes aplicarlo a todo el vault o elegir notas y mazos concretos en el selector paginado. El botón del explorador y la opción del menú contextual usan esta misma acción.",
  "Notas y mazos cuyas tarjetas se van a borrar",
  "Notas y mazos cuyas flashcards se van a quitar",
];

describe("traducciones de Ajustes > Avanzado", () => {
  afterEach(() => setLanguagePreference("es"));

  it("traduce al inglés las descripciones de FSRS y borrado centralizado", () => {
    setLanguagePreference("en");
    for (const fragment of advancedHelpFragments) {
      expect(translate(fragment), fragment).not.toBe(fragment);
    }
    expect(translate("Borra la programación FSRS (")).toBe("Clears the FSRS scheduling (");
    expect(translate(", resaltados")).toBe(", highlights");
  });

  it("traduce al chino las descripciones de FSRS y borrado centralizado", () => {
    setLanguagePreference("zh");
    for (const fragment of advancedHelpFragments) {
      expect(translate(fragment), fragment).not.toBe(fragment);
    }
    expect(translate("Borra la programación FSRS (")).toBe("清除 FSRS 调度（");
    expect(translate(", resaltados")).toBe("，高亮");
  });

  it("usa 'Revisando' para el estado reading y lo traduce", () => {
    expect(BIBLIOGRAPHY_STATUS_LABELS.reading).toBe("Revisando");
    setLanguagePreference("en");
    expect(translate("Revisando")).toBe("Reviewing");
    setLanguagePreference("zh");
    expect(translate("Revisando")).toBe("审阅中");
  });

  it("conserva el español original cuando la preferencia es es", () => {
    setLanguagePreference("es");
    for (const fragment of advancedHelpFragments) {
      expect(translate(fragment), fragment).toBe(fragment);
    }
  });
});
