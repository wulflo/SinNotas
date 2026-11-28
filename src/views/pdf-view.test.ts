// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfReaderView, type PdfReaderHost } from "./pdf-view";

function makeRoot(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <div id="pdf-list"></div><div id="pdf-library-empty"></div>
    <button id="pdf-import"></button>
    <select id="pdf-retention"><option value="7">7</option></select>
    <select id="pdf-current-retention"><option value="7">7</option></select>
    <button id="pdf-prev"></button><button id="pdf-next"></button><button id="pdf-fit"></button>
    <button id="pdf-toggle-text"></button><button id="pdf-capture"></button>
    <div id="pdf-current-title"></div><div id="pdf-current-meta"></div><div id="pdf-page-indicator"></div>
    <div id="pdf-stage"></div><div id="pdf-stage-empty"></div><div id="pdf-page"></div>
    <img id="pdf-page-image" /><div id="pdf-text-layer"></div><div id="pdf-capture-layer"></div>
    <div id="pdf-capture-selection"></div><div id="pdf-selection-actions"></div>
    <div id="pdf-capture-actions"></div><div id="pdf-capture-label"></div>
    <button id="pdf-insert-selection"></button><button id="pdf-copy-selection"></button>
    <button id="pdf-clear-selection"></button><button id="pdf-insert-capture"></button>
    <button id="pdf-insert-occlusion"></button><button id="pdf-cancel-capture"></button>
    <div id="pdf-status"></div>`;
  return root;
}

describe("PdfReaderView", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        disconnect(): void {}
      }
    );
  });

  it("copia la selección mediante el host, sin usar la Clipboard API directamente", async () => {
    const host: PdfReaderHost = {
      insertText: vi.fn(async () => {}),
      insertCapture: vi.fn(async () => {}),
      confirmOpenLinked: vi.fn(async () => true),
      confirmDelete: vi.fn(async () => true),
      copyText: vi.fn(async () => {}),
    };
    const root = makeRoot();
    const view = new PdfReaderView(root, host);
    Object.assign(view, { selectedText: "texto seleccionado" });

    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    root.querySelector<HTMLButtonElement>("#pdf-copy-selection")!.click();
    await vi.waitFor(() => expect(host.copyText).toHaveBeenCalledWith("texto seleccionado"));
    expect(writeText).not.toHaveBeenCalled();
  });
});
