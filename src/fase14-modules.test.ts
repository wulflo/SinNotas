// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PageData } from "./types";

/**
 * Regresión de la Fase 14: después de dividir los monolitos, los módulos
 * extraídos deben seguir exportando lo que `desktop.ts` importa y el estado
 * inyectado debe seguir leyendo/escribiendo el mismo localStorage/DOM.
 */
type Modules = {
  journals: typeof import("./views/journals-view");
  toast: typeof import("./ui/toast");
  nav: typeof import("./ui/navigation-history");
  shortcuts: typeof import("./settings/shortcuts-ui");
  allPages: typeof import("./views/all-pages-view");
  graph: typeof import("./views/graph-settings-ui");
  cardEditor: typeof import("./review/card-editor");
};

let m: Modules;

beforeAll(async () => {
  document.body.innerHTML = `
    <div id="toast-notification"></div>
    <button id="btn-history-back"></button>
    <button id="btn-history-forward"></button>
    <div id="shortcuts-modal-overlay" hidden></div>
    <div id="graph-settings-panel" hidden>
      <div id="graph-color-rules"></div>
      <input id="graph-rule-name" />
      <input id="graph-rule-color" type="color" />
      <input id="graph-repulsion" type="range" />
      <output id="graph-repulsion-value"></output>
    </div>
    <select id="all-pages-sort"></select>
  `;
  m = {
    journals: await import("./views/journals-view"),
    toast: await import("./ui/toast"),
    nav: await import("./ui/navigation-history"),
    shortcuts: await import("./settings/shortcuts-ui"),
    allPages: await import("./views/all-pages-view"),
    graph: await import("./views/graph-settings-ui"),
    cardEditor: await import("./review/card-editor"),
  };
});

beforeEach(() => {
  localStorage.clear();
});

describe("fase 14: referencias entre módulos extraídos", () => {
  it("expone las funciones que desktop.ts importa", () => {
    expect(typeof m.journals.localDateKey).toBe("function");
    expect(typeof m.journals.pageDisplayTitle).toBe("function");
    expect(typeof m.journals.renderJournalsView).toBe("function");
    expect(typeof m.journals.configureJournalsView).toBe("function");
    expect(typeof m.toast.showToast).toBe("function");
    expect(typeof m.nav.readLastNavigation).toBe("function");
    expect(typeof m.nav.recordNavigationHistory).toBe("function");
    expect(typeof m.nav.resetNavigationHistory).toBe("function");
    expect(typeof m.nav.configureNavigationHistory).toBe("function");
    expect(typeof m.shortcuts.renderShortcutSettings).toBe("function");
    expect(typeof m.shortcuts.refreshShortcutModalBindings).toBe("function");
    expect(typeof m.allPages.renderAllPagesView).toBe("function");
    expect(typeof m.allPages.resetAllPagesPage).toBe("function");
    expect(typeof m.allPages.getAllPagesSortSelect).toBe("function");
    expect(typeof m.graph.syncGraphSettingsUi).toBe("function");
    expect(typeof m.graph.syncGraphSettingsUiIfPanelOpen).toBe("function");
    expect(typeof m.cardEditor.closeCardEditor).toBe("function");
    expect(typeof m.cardEditor.configureCardEditor).toBe("function");
  });

  it("mantiene el formato de fecha y el título de los diarios", () => {
    expect(m.journals.localDateKey(new Date(2026, 10, 26))).toBe("2026-11-26");
    const journal = {
      id: "j1",
      title: "2026_11_26",
      journalDate: "2026-11-26",
      isJournal: true,
      blocks: [],
    } as unknown as PageData;
    expect(m.journals.pageDisplayTitle(journal)).toContain("Diario");
  });

  it("muestra el toast en el mismo elemento del DOM", () => {
    const toast = document.getElementById("toast-notification")!;
    m.toast.showToast("mensaje de prueba", 5000);
    expect(toast.innerText).toBe("mensaje de prueba");
    expect(toast.classList.contains("visible")).toBe(true);
  });

  it("persiste y lee la navegación usando el host inyectado", () => {
    let page = { id: "p-1" } as PageData;
    m.nav.configureNavigationHistory({
      getView: () => "editor",
      getPage: () => page,
      setPage: (next) => { page = next; },
      clearCursor: () => {},
      getPages: () => [page],
      switchView: () => {},
    });
    m.nav.recordNavigationHistory();
    expect(m.nav.readLastNavigation()).toEqual({ view: "editor", pageId: "p-1" });
    m.nav.resetNavigationHistory();
    expect(m.nav.readLastNavigation()).toEqual({ view: "editor", pageId: "p-1" });
  });

  it("encuentra el selector de ordenación de Todas las páginas", () => {
    const select = document.getElementById("all-pages-sort");
    expect(m.allPages.getAllPagesSortSelect()).toBe(select);
  });

  it("sincroniza el panel del grafo cerrado y vuelve a pintar los sliders al abrirlo", () => {
    const panel = document.getElementById("graph-settings-panel")!;
    panel.hidden = true;
    expect(() => m.graph.syncGraphSettingsUiIfPanelOpen()).not.toThrow();

    const output = document.getElementById("graph-repulsion-value") as HTMLOutputElement;
    panel.hidden = false;
    output.value = "SENTINELA";
    m.graph.syncGraphSettingsUiIfPanelOpen();
    expect(output.value).not.toBe("SENTINELA");
  });
});
