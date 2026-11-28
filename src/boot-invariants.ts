/**
 * Decisiones puras del arranque que antes vivían inline en `desktop.ts`.
 * Son las que provocaban el bug histórico «la nota se abre vacía hasta pulsar
 * +»: si el editor iba a pintarse con una nota metadata-only, había que
 * hidratarla ANTES del primer render.
 */
import type { ViewType } from "./types";

export interface LastNavigationHint {
  view: ViewType;
  pageId: string;
}

export function shouldRenderEditorOnBoot(
  restored: boolean,
  lastNavigation: LastNavigationHint | null,
  pdfEditorSplitPreferred: boolean
): boolean {
  return (
    !restored ||
    lastNavigation?.view === "editor" ||
    (lastNavigation?.view === "pdf" && pdfEditorSplitPreferred)
  );
}

export function needsEditorHydration(
  willRenderEditor: boolean,
  blocksLoaded: boolean | undefined,
  isTauriRuntime: boolean
): boolean {
  return willRenderEditor && blocksLoaded === false && isTauriRuntime;
}
