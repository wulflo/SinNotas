import type { PageData, ViewType } from "../types";

/** Estado de desktop.ts que el historial necesita leer o actualizar. */
export interface NavigationHistoryHost {
  getView(): ViewType;
  getPage(): PageData;
  setPage(page: PageData): void;
  clearCursor(): void;
  getPages(): PageData[];
  switchView(view: ViewType): void;
}

let host!: NavigationHistoryHost;

export function configureNavigationHistory(nextHost: NavigationHistoryHost): void {
  host = nextHost;
}

const btnHistoryBack = document.getElementById("btn-history-back") as HTMLButtonElement;
const btnHistoryForward = document.getElementById("btn-history-forward") as HTMLButtonElement;

interface NavigationHistoryEntry {
  view: ViewType;
  pageId: string;
}

const navigationHistory: NavigationHistoryEntry[] = [];
let navigationHistoryIndex = -1;

/** Última vista y página abiertas, para volver a ellas tras recargar la app. */
const LAST_VIEW_STORAGE_KEY = "sinnotas-last-view";
const LAST_PAGE_STORAGE_KEY = "sinnotas-last-page-id";

function persistLastNavigation(): void {
  try {
    localStorage.setItem(LAST_VIEW_STORAGE_KEY, host.getView());
    localStorage.setItem(LAST_PAGE_STORAGE_KEY, host.getPage().id);
  } catch {}
}

export function readLastNavigation(): { view: ViewType; pageId: string } | null {
  try {
    const view = localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    const pageId = localStorage.getItem(LAST_PAGE_STORAGE_KEY);
    if (!view || !pageId) return null;
    const validViews: ViewType[] = [
      "editor",
      "journals",
      "flashcards",
      "graph",
      "kanban",
      "all-pages",
      "bibliography",
      "pdf",
    ];
    if (!validViews.includes(view as ViewType)) return null;
    return { view: view as ViewType, pageId };
  } catch {
    return null;
  }
}
let restoringNavigationHistory = false;

function updateHistoryButtons(): void {
  btnHistoryBack.disabled = navigationHistoryIndex <= 0;
  btnHistoryForward.disabled =
    navigationHistoryIndex < 0 || navigationHistoryIndex >= navigationHistory.length - 1;
}

export function recordNavigationHistory(): void {
  if (restoringNavigationHistory) return;
  const entry: NavigationHistoryEntry = { view: host.getView(), pageId: host.getPage().id };
  const currentEntry = navigationHistory[navigationHistoryIndex];
  if (currentEntry && currentEntry.view === entry.view && currentEntry.pageId === entry.pageId) {
    updateHistoryButtons();
    return;
  }
  navigationHistory.splice(navigationHistoryIndex + 1);
  navigationHistory.push(entry);
  navigationHistoryIndex = navigationHistory.length - 1;
  updateHistoryButtons();
  persistLastNavigation();
}

export function resetNavigationHistory(): void {
  navigationHistory.length = 0;
  navigationHistoryIndex = -1;
  recordNavigationHistory();
}

function restoreNavigationHistory(index: number): void {
  const entry = navigationHistory[index];
  if (!entry || index === navigationHistoryIndex) return;

  const page = host.getPages().find((candidate) => candidate.id === entry.pageId);
  if (entry.view === "editor" && !page) {
    // The page no longer exists (deleted or vault changed): drop stale entries.
    navigationHistory.splice(index, 1);
    if (index < navigationHistoryIndex) navigationHistoryIndex -= 1;
    updateHistoryButtons();
    return;
  }

  restoringNavigationHistory = true;
  try {
    navigationHistoryIndex = index;
    if (page && page.id !== host.getPage().id) host.setPage(page);
    if (entry.view === "editor") host.clearCursor();
    host.switchView(entry.view);
  } finally {
    restoringNavigationHistory = false;
  }
  updateHistoryButtons();
}

btnHistoryBack.addEventListener("click", () => {
  if (navigationHistoryIndex > 0) restoreNavigationHistory(navigationHistoryIndex - 1);
});

btnHistoryForward.addEventListener("click", () => {
  if (navigationHistoryIndex < navigationHistory.length - 1) {
    restoreNavigationHistory(navigationHistoryIndex + 1);
  }
});

updateHistoryButtons();
