import { PageData, Backlink, PageRevision, BlockNode, RestoredSnapshot, VaultCacheDelta } from "../types";
import { getAllBlocksFlat, findNodeLocation, cloneTree } from "../editor/tree-engine";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  hasInvalidDeckTitleCharacters,
  normalizeDeckTitle,
  sanitizeDeckTitle,
  splitDeckTitle,
} from "../deck-title";

function normalizeBlockTypes(blocks: BlockNode[]): void {
  for (const block of blocks) {
    const [firstLine, ...remainingLines] = block.content.split(/\r?\n/);
    const match = firstLine.match(/^!\[([^\]\r\n]*)\]\(([^()\r\n]+)\)$/);
    const source = match?.[2].trim() || firstLine.trim();
    if (source && /\.(?:png|jpe?g|webp|svg|gif|bmp)$/i.test(source)) {
      block.type = "image";
      const fileName = source.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] || "imagen";
      block.imageAlt = match?.[1] || fileName.replace(/\.[^.]+$/, "") || "imagen";
      block.content = [source, ...remainingLines].join("\n");
    } else if (block.type !== "image") {
      block.type = "text";
    }
    normalizeBlockTypes(block.children || []);
  }
}

export const initialVaultPages: PageData[] = [
  {
    id: "p-welcome",
    title: "Welcome to SinNotas",
    path: "pages/Welcome to SinNotas.md",
    updatedAt: "2026-10-17 16:40",
    revisions: [
      {
        id: "rev-w1",
        timestamp: "2026-10-17 16:00",
        summary: "Versión inicial del lienzo outliner",
        blocks: [
          {
            id: "b-w1-old",
            type: "text",
            content: "Bienvenido a SinNotas (borrador inicial).",
            children: [],
            collapsed: false,
          },
        ],
      },
    ],
    blocks: [
      {
        id: "b-w1",
        type: "text",
        content: "Bienvenido a **SinNotas**, tu outliner de alto rendimiento file-first construido con Rust y Tauri.",
        collapsed: false,
        children: [
          {
            id: "b-w2",
            type: "text",
            content: "Presiona **Enter** para crear un nuevo bullet o dividir el bloque en el cursor.",
            collapsed: false,
            children: [],
          },
          {
            id: "b-w3",
            type: "text",
            content: "Presiona **Alt + Tab** para indentar y **Tab** para desindentar.",
            collapsed: false,
            children: [
              {
                id: "b-w4",
                type: "text",
                content: "Las guías visuales verticales conectan automáticamente la jerarquía del árbol.",
                collapsed: false,
                children: [],
              },
            ],
          },
          {
            id: "b-w5",
            type: "text",
            content: "Usa el atajo **Ctrl+B** (o Cmd+B) para colapsar o desplegar la barra lateral.",
            collapsed: false,
            children: [],
          },
        ],
      },
      {
        id: "b-w6",
        type: "text",
        content: "Navega entre páginas usando enlaces bidireccionales como [[Diarios]], [[Rust Core]] y [[Tarjetas de repaso]].",
        collapsed: false,
        children: [],
      },
      {
        id: "b-w7",
        type: "text",
        content: "DOING Probar la vista Kanban de tareas en tiempo real",
        collapsed: false,
        children: [],
      },
      {
        id: "b-w8",
        type: "text",
        content: "En SinNotas, las notas se guardan directamente en archivos {{cloze .md sin base de datos}}. #card",
        collapsed: false,
        children: [],
      },
      {
        id: "b-w9",
        type: "text",
        content: "¿Cuál es la filosofía de SinNotas? :: Almacenar notas en archivos .md directos sin bases de datos intermedias. #card",
        collapsed: false,
        children: [],
      },
    ],
  },
  {
    id: "p-journals",
    title: "Diarios",
    path: "journals/2026_10_17.md",
    isJournal: true,
    journalDate: "2026-10-17",
    updatedAt: "2026-10-17 16:30",
    revisions: [],
    blocks: [
      {
        id: "b-j1",
        type: "text",
        content: "TODO Integrar el algoritmo de repetición espaciada FSRS-4.5 en [[Tarjetas de repaso]]",
        collapsed: false,
        children: [],
      },
      {
        id: "b-j2",
        type: "text",
        content: "DONE Rediseñar la barra lateral con buscador integrado y soporte colapsable",
        collapsed: false,
        children: [],
      },
      {
        id: "b-j3",
        type: "text",
        content: "NOW Revisar los permisos mínimos de la app de escritorio",
        collapsed: false,
        children: [],
      },
      {
        id: "b-j4",
        type: "text",
        content: "El algoritmo FSRS utiliza ==Estabilidad== y ==Dificultad== para predecir la retención de memoria. #card",
        collapsed: false,
        children: [],
      },
      {
        id: "b-j5",
        type: "text",
        content: "LATER Explorar opciones de respaldo cifrado para el vault",
        collapsed: false,
        children: [],
      },
      {
        id: "b-j6",
        type: "text",
        content: "Reunión de arquitectura técnica con el equipo de [[Rust Core]].",
        collapsed: false,
        children: [
          {
            id: "b-j7",
            type: "text",
            content: "La memoria de trabajo de SinNotas en reposo ronda los {{c1::25-30 MB}} frente a los 800 MB de Electron. #card",
            collapsed: false,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "p-rust",
    title: "Rust Core",
    path: "pages/Rust Core.md",
    updatedAt: "2026-10-17 15:45",
    revisions: [],
    blocks: [
      {
        id: "b-r1",
        type: "text",
        content: "El backend en Rust se encarga de la lectura y persistencia atómica de archivos Markdown (.md).",
        collapsed: false,
        children: [
          {
            id: "b-r2",
            type: "text",
            content: "DONE Zero-database: Sin overhead de Datomic ni DataScript",
            collapsed: false,
            children: [],
          },
          {
            id: "b-r3",
            type: "text",
            content: "Tauri utiliza el webview nativo {{cloze WebKitGTK en Linux}} y WRY para máximo rendimiento. #card",
            collapsed: false,
            children: [],
          },
        ],
      },
      {
        id: "b-r4",
        type: "text",
        content: "Conectado directamente a [[Welcome to SinNotas]] y [[Diarios]].",
        collapsed: false,
        children: [],
      },
    ],
  },
  {
    id: "p-flashcards",
    title: "Tarjetas de repaso",
    path: "pages/Tarjetas de repaso.md",
    updatedAt: "2026-10-17 15:30",
    revisions: [],
    blocks: [
      {
        id: "b-f1",
        type: "text",
        content: "Guía de repaso espaciado en SinNotas con soporte para FSRS-4.5 y Cloze Deletions.",
        collapsed: false,
        children: [
          {
            id: "b-f2",
            type: "text",
            content: "Las tarjetas tipo Cloze ocultan texto usando ==resaltado== o bien sintaxis {{c1::tipo Anki}}. #card",
            collapsed: false,
            children: [],
          },
          {
            id: "b-f3",
            type: "text",
            content: "¿Qué 4 calificaciones ofrece FSRS en SinNotas? :: Again (Olvidado), Hard (Difícil), Good (Bien) y Easy (Fácil). #card",
            collapsed: false,
            children: [],
          },
        ],
      },
    ],
  },
];

const VAULT_STORAGE_KEY = "sinnotas-vault-v4";
const REVISIONS_STORAGE_KEY = "sinnotas-revisions-v1";
const REVISIONS_MIGRATED_KEY = "sinnotas-revisions-migrated-v1";
const ACTIVE_ROOT_STORAGE_KEY = "sinnotas-active-vault-root";
const ACTIVE_NAME_STORAGE_KEY = "sinnotas-active-vault-name";

/** Milisegundos que se agrupan las ediciones de texto antes de escribir a disco. */
const SAVE_DEBOUNCE_MS = 300;

let storageWarningShown = false;

/** Normaliza separadores para comparar rutas del vault entre Rust y JS. */
function normalizePathForCompare(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

export interface ExternalDeltaResult {
  changed: string[];
  added: string[];
  removed: string[];
}

/**
 * Escribe en localStorage sin lanzar excepciones si la cuota está llena.
 * Avisa al usuario una única vez mediante el toast existente.
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`No se pudo escribir "${key}" en localStorage:`, error);
    if (!storageWarningShown) {
      storageWarningShown = true;
      window.dispatchEvent(
        new CustomEvent("vault-operation-error", {
          detail:
            "No hay espacio en el almacenamiento local. Las notas se siguen guardando en disco, pero los snapshots y preferencias podrían no conservarse.",
        })
      );
    }
    return false;
  }
}

export class VaultStore {
  private pages: PageData[];
  private activeRootPath: string | null;
  private activeVaultName: string;
  private pendingFileOperations = new Map<string, Promise<void>>();
  private beforeSaveListener: ((page: PageData) => void) | null = null;

  /** Mapa en memoria: ruta de la nota -> PageRevision[]. */
  private revisionCache = new Map<string, PageRevision[]>();

  /** Escrituras a disco diferidas por nota (debounce de edición de texto). */
  private pendingSaves = new Map<string, { page: PageData; timer: number }>();

  /**
   * Contador monótono de mutaciones del vault. Las vistas caras (Kanban,
   * flashcards) lo usan para reutilizar su último escaneo cuando nada cambió.
   */
  private mutationVersion = 0;

  public getMutationVersion(): number {
    return this.mutationVersion;
  }

  private bumpMutationVersion(): void {
    this.mutationVersion += 1;
  }

  constructor() {
    this.activeRootPath = localStorage.getItem(ACTIVE_ROOT_STORAGE_KEY);
    this.activeVaultName = localStorage.getItem(ACTIVE_NAME_STORAGE_KEY) || "Vault local";

    if (isTauri()) {
      // En Tauri los .md son la fuente de verdad: no usamos la copia legacy del vault.
      this.pages = initialVaultPages;
    } else {
      const saved = localStorage.getItem(VAULT_STORAGE_KEY);
      if (saved) {
        try {
          this.pages = JSON.parse(saved);
        } catch {
          this.pages = initialVaultPages;
        }
      } else {
        this.pages = initialVaultPages;
      }
    }
    this.pages.forEach((page) => normalizeBlockTypes(page.blocks));

    if (isTauri()) {
      // Ya migradas las revisiones, la copia completa del vault sobra en localStorage.
      try {
        localStorage.removeItem(VAULT_STORAGE_KEY);
      } catch {
        // removeItem solo falla en contextos sin almacenamiento disponible.
      }
    }
  }

  /**
   * Devuelve los snapshots de una página. `forceRefresh` se usa al abrir el
   * historial para no mostrar una lista vieja si el backend acaba de guardar
   * un snapshot automático.
   */
  public async getRevisions(page: PageData, forceRefresh = false): Promise<PageRevision[]> {
    if (!forceRefresh && this.revisionCache.has(page.path)) {
      return this.revisionCache.get(page.path)!;
    }

    if (!isTauri()) {
      const saved = localStorage.getItem(REVISIONS_STORAGE_KEY);
      let revs: PageRevision[] = [];
      if (saved) {
        try {
          const obj = JSON.parse(saved) as Record<string, PageRevision[]>;
          revs = obj[page.id] || [];
        } catch {
          revs = [];
        }
      }
      this.revisionCache.set(page.path, revs);
      return revs;
    }

    try {
      const revs = await invoke<PageRevision[]>("read_note_snapshots", { filePath: page.path });
      this.revisionCache.set(page.path, revs);
      return revs;
    } catch (error) {
      console.error("No se pudieron leer los snapshots:", error);
      this.revisionCache.set(page.path, []);
      return [];
    }
  }

  /** Migración one-shot: revisiones de localStorage (clave vieja) -> disco. */
  public async migrateLegacyRevisions(): Promise<void> {
    if (!isTauri()) return;
    if (localStorage.getItem(REVISIONS_MIGRATED_KEY)) return;

    const saved = localStorage.getItem(REVISIONS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(REVISIONS_MIGRATED_KEY, "1");
      return;
    }

    let obj: Record<string, PageRevision[]>;
    try {
      obj = JSON.parse(saved) as Record<string, PageRevision[]>;
    } catch {
      localStorage.removeItem(REVISIONS_STORAGE_KEY);
      localStorage.setItem(REVISIONS_MIGRATED_KEY, "1");
      return;
    }

    const pageById = new Map(this.pages.map((p) => [p.id, p]));
    let migrated = 0;
    let orphans = 0;
    let failed = 0;

    for (const [pageId, revs] of Object.entries(obj)) {
      if (!revs?.length) continue;
      const page = pageById.get(pageId);
      if (!page) {
        orphans += revs.length;
        console.warn(`Migración de revisiones: ${revs.length} revisiones huérfanas para id "${pageId}" se descartan.`);
        continue;
      }
      try {
        await invoke("write_page_revisions", { filePath: page.path, revisions: revs });
        migrated += revs.length;
      } catch (error) {
        failed++;
        console.error(`No se pudieron migrar las revisiones de ${page.path}:`, error);
      }
    }

    if (failed === 0) {
      try {
        localStorage.removeItem(REVISIONS_STORAGE_KEY);
      } catch {
        // Ignorar: se reintentará.
      }
      localStorage.setItem(REVISIONS_MIGRATED_KEY, "1");
      if (orphans > 0) {
        console.warn(`Migración de revisiones: ${orphans} revisiones huérfanas descartadas.`);
      }
    } else {
      window.dispatchEvent(new CustomEvent("vault-operation-error", {
        detail: "No se pudo migrar todo el historial de versiones. Se reintentará en el próximo arranque.",
      }));
    }
  }

  public getPages(): PageData[] {
    return this.pages;
  }

  /** Registra un listener que se invoca justo antes de persistir cada página guardada. */
  public onBeforeSave(listener: (page: PageData) => void): void {
    this.beforeSaveListener = listener;
  }

  public getPageByTitle(title: string): PageData | undefined {
    const exact = this.pages.find((p) => p.title.toLowerCase() === title.toLowerCase());
    if (exact) return exact;
    // Los títulos antiguos con `::` y los nuevos con `→` representan el mismo
    // mazo; permitir que enlaces o búsquedas usen cualquiera de las dos formas.
    const normalized = normalizeDeckTitle(title).toLowerCase();
    if (!normalized) return undefined;
    return this.pages.find(
      (p) => normalizeDeckTitle(p.title).toLowerCase() === normalized
    );
  }

  public getActiveVaultName(): string {
    return this.activeVaultName;
  }

  public getActiveRootPath(): string | null {
    return this.activeRootPath;
  }

  public replaceVault(pages: PageData[], rootPath: string, vaultName: string): void {
    pages.forEach((page) => normalizeBlockTypes(page.blocks));
    // Descartar escrituras diferidas del vault anterior.
    this.pendingSaves.forEach((entry) => window.clearTimeout(entry.timer));
    this.pendingSaves.clear();
    this.pages = pages;
    this.activeRootPath = rootPath;
    this.activeVaultName = vaultName;
    this.bumpMutationVersion();
    // Las revisiones viven en disco por vault: solo limpiamos la caché en memoria.
    this.revisionCache.clear();
    safeSetItem(ACTIVE_ROOT_STORAGE_KEY, rootPath);
    safeSetItem(ACTIVE_NAME_STORAGE_KEY, vaultName);
    this.persist();
  }

  /**
   * Aplica el delta que envía el watcher de Rust cuando otra aplicación
   * modifica el vault. Las notas con una escritura diferida pendiente y las
   * rutas de `skipPaths` se conservan: la edición local gana hasta que se
   * vuelva a cargar la nota desde disco.
   */
  public applyExternalDelta(
    delta: VaultCacheDelta,
    options: { skipPaths?: Iterable<string> } = {}
  ): ExternalDeltaResult {
    const result: ExternalDeltaResult = { changed: [], added: [], removed: [] };
    const activeRoot = this.activeRootPath;
    if (!activeRoot) return result;
    const normalizedRoot = normalizePathForCompare(activeRoot);
    const normalizedDeltaRoot = normalizePathForCompare(delta.rootPath);
    if (normalizedRoot !== normalizedDeltaRoot) return result;

    const skip = new Set([...(options.skipPaths || [])].map(normalizePathForCompare));
    const pendingPaths = new Set(
      [...this.pendingSaves.values()].map((entry) => normalizePathForCompare(entry.page.path))
    );
    const removedPaths = new Set(delta.removed.map(normalizePathForCompare));

    const incoming = new Map<string, PageData>();
    for (const page of delta.changed) {
      if (!page?.path || !page.title) continue;
      const key = normalizePathForCompare(page.path);
      if (!key.startsWith(`${normalizedRoot}/`)) continue;
      incoming.set(key, page);
    }

    const nextPages: PageData[] = [];
    for (const page of this.pages) {
      const key = normalizePathForCompare(page.path);
      if (removedPaths.has(key) && !skip.has(key) && !pendingPaths.has(key)) {
        this.revisionCache.delete(page.path);
        result.removed.push(page.path);
        continue;
      }

      const update = incoming.get(key);
      if (!update || skip.has(key) || pendingPaths.has(key)) {
        nextPages.push(page);
        continue;
      }

      incoming.delete(key);
      const updated: PageData = {
        ...update,
        id: page.id,
        pinned: page.pinned,
        pinnedAt: page.pinnedAt,
        revisions: page.revisions,
      };
      normalizeBlockTypes(updated.blocks);
      nextPages.push(updated);
      result.changed.push(page.path);
    }

    for (const [key, page] of incoming) {
      if (skip.has(key) || pendingPaths.has(key) || removedPaths.has(key)) continue;
      const added: PageData = { ...page, blocks: page.blocks || [] };
      normalizeBlockTypes(added.blocks);
      nextPages.push(added);
      result.added.push(added.path);
    }

    if (result.changed.length || result.added.length || result.removed.length) {
      this.pages = nextPages;
      this.bumpMutationVersion();
      this.persist();
    }
    return result;
  }

  public setActiveVault(rootPath: string, vaultName: string): void {
    this.activeRootPath = rootPath;
    this.activeVaultName = vaultName;
    safeSetItem(ACTIVE_ROOT_STORAGE_KEY, rootPath);
    safeSetItem(ACTIVE_NAME_STORAGE_KEY, vaultName);
  }

  public async flushPendingFileOperations(): Promise<void> {
    await this.flushPendingSaves();
    await Promise.all([...new Set(this.pendingFileOperations.values())]);
  }

  /**
   * Actualiza el estado en memoria de inmediato y difiere la escritura a disco
   * (debounce por nota) para no guardar en cada tecla.
   */
  public scheduleSavePage(page: PageData): void {
    this.rememberPage(page);
    // La página ya cambió en memoria; el guardado diferido solo afecta al disco.
    // Sin este incremento, el Kanban reutilizaría un escaneo anterior si se
    // abre antes de que venza el debounce.
    this.bumpMutationVersion();

    const pending = this.pendingSaves.get(page.id);
    if (pending) window.clearTimeout(pending.timer);

    const timer = window.setTimeout(() => {
      this.pendingSaves.delete(page.id);
      void this.persistPage(page).catch((error: unknown) => {
        console.error("No se pudo guardar la nota:", error);
        window.dispatchEvent(new CustomEvent("vault-operation-error", {
          detail: "No se pudo guardar la nota. Verifica el espacio de almacenamiento local.",
        }));
      });
    }, SAVE_DEBOUNCE_MS);

    this.pendingSaves.set(page.id, { page, timer });
  }

  /** Escribe ahora los guardados diferidos pendientes. */
  public async flushPendingSaves(): Promise<void> {
    const pending = [...this.pendingSaves.values()];
    this.pendingSaves.clear();
    await Promise.all(
      pending.map((entry) => {
        window.clearTimeout(entry.timer);
        return this.persistPage(entry.page);
      })
    );
  }

  /** Cancela el guardado diferido de una nota (si lo hubiera). */
  private cancelPendingSave(pageId: string): void {
    const pending = this.pendingSaves.get(pageId);
    if (pending) {
      window.clearTimeout(pending.timer);
      this.pendingSaves.delete(pageId);
    }
  }

  /** Refleja la página en el estado en memoria y avisa al historial de deshacer. */
  private rememberPage(updatedPage: PageData): void {
    normalizeBlockTypes(updatedPage.blocks);
    const idx = this.pages.findIndex((p) => p.id === updatedPage.id);
    if (idx >= 0) {
      this.pages[idx] = updatedPage;
    } else {
      this.pages.unshift(updatedPage);
    }
    this.beforeSaveListener?.(updatedPage);
  }

  /** Persiste la página (localStorage en web y .md en Tauri). */
  private persistPage(updatedPage: PageData, propagateError = false): Promise<void> {
    this.persist();

    if (!isTauri()) return Promise.resolve();
    return this.enqueueFileOperation(
      [updatedPage.path],
      "save markdown file",
      () => invoke("save_page", {
        filePath: updatedPage.path,
        blocks: updatedPage.blocks,
        frontmatter: updatedPage.frontmatter || [],
      }).then(() => undefined),
      propagateError
    );
  }

  public savePage(updatedPage: PageData, propagateError = false): Promise<void> {
    // Un guardado inmediato reemplaza al diferido pendiente de la misma nota.
    this.cancelPendingSave(updatedPage.id);
    this.rememberPage(updatedPage);
    this.bumpMutationVersion();
    return this.persistPage(updatedPage, propagateError);
  }

  public deletePage(pageId: string): boolean {
    const idx = this.pages.findIndex((p) => p.id === pageId);
    if (idx < 0) return false;

    this.cancelPendingSave(pageId);
    const pageToDelete = this.pages[idx];
    this.pages.splice(idx, 1);
    this.revisionCache.delete(pageToDelete.path);
    this.bumpMutationVersion();

    this.persist();

    if (isTauri()) {
      void this.enqueueFileOperation([pageToDelete.path], "delete markdown file", () =>
        invoke("delete_page", { filePath: pageToDelete.path }).then(() => undefined)
      );
    }

    return true;
  }

  public renamePage(pageId: string, newTitle: string): boolean {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) return false;

    // Acepta `::`, `->`, `>` y otros alias, pero guarda siempre la flecha
    // canónica para que el nombre de archivo sea válido en todas las plataformas.
    const trimmed = normalizeDeckTitle(newTitle);
    if (!trimmed) return false;
    if (hasInvalidDeckTitleCharacters(splitDeckTitle(trimmed))) return false;
    if (
      this.pages.some(
        (p) =>
          p.id !== pageId &&
          normalizeDeckTitle(p.title).toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      return false;
    }

    const oldTitle = page.title;
    const oldPath = page.path;
    const pathParts = oldPath.split(/[\\/]/);
    pathParts[pathParts.length - 1] = `${trimmed}.md`;
    const newPath = pathParts.join("/");

    page.title = trimmed;
    page.path = newPath;
    this.bumpMutationVersion();

    // El historial de revisiones viaja con la nota: actualizar la clave de caché.
    const cachedRevisions = this.revisionCache.get(oldPath);
    if (cachedRevisions) {
      this.revisionCache.delete(oldPath);
      this.revisionCache.set(newPath, cachedRevisions);
    }

    // Update wikilinks across all pages, remembering which ones changed
    const oldPattern = new RegExp(`\\[\\[${oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`, "g");
    const newLink = `[[${trimmed}]]`;
    const changedPages: PageData[] = [];

    this.pages.forEach((p) => {
      let changed = false;
      getAllBlocksFlat(p.blocks).forEach((b) => {
        oldPattern.lastIndex = 0;
        if (oldPattern.test(b.content)) {
          oldPattern.lastIndex = 0;
          b.content = b.content.replace(oldPattern, newLink);
          changed = true;
        }
      });
      if (changed) changedPages.push(p);
    });

    this.persist();

    if (isTauri()) {
      void this.enqueueFileOperation([oldPath, newPath], "rename markdown file", () =>
        invoke("rename_page", { oldPath, newPath }).then(() => undefined)
      );
      // Guardar la página renombrada con su nuevo path y contenido actualizado
      void this.savePage(page);
      // Write the updated links to disk (queued after the rename for the renamed page itself)
      changedPages.forEach((p) => void this.savePage(p));
    }

    return true;
  }

  public updateBlockContent(pageTitle: string, blockId: string, newContent: string): void {
    const page = this.getPageByTitle(pageTitle);
    if (!page) return;

    const loc = findNodeLocation(page.blocks, blockId);
    if (loc) {
      loc.parentList[loc.index].content = newContent;
      this.savePage(page);
    }
  }

  /**
   * Restaura un snapshot desde `chronos/`. El backend guarda antes una copia
   * de seguridad del estado actual, de modo que la restauración también se
   * puede deshacer desde el historial.
   */
  public async restoreSnapshot(
    page: PageData,
    revisionId: string
  ): Promise<RestoredSnapshot | null> {
    if (!isTauri()) {
      let revs = this.revisionCache.get(page.path);
      if (!revs) revs = await this.getRevisions(page);
      const rev = revs.find((item) => item.id === revisionId);
      if (!rev) return null;
      return { blocks: cloneTree(rev.blocks), frontmatter: page.frontmatter || [] };
    }

    const restored = await invoke<RestoredSnapshot>("restore_snapshot", {
      filePath: page.path,
      snapshotId: revisionId,
    });
    this.revisionCache.delete(page.path);

    const pageToUpdate = this.pages.find((p) => p.id === page.id);
    if (pageToUpdate) {
      pageToUpdate.blocks = cloneTree(restored.blocks);
      pageToUpdate.frontmatter = [...restored.frontmatter];
      this.bumpMutationVersion();
      // El backend ya escribió el archivo; solo sincronizamos memoria/estado.
      this.rememberPage(pageToUpdate);
    }
    return {
      blocks: cloneTree(restored.blocks),
      frontmatter: [...restored.frontmatter],
    };
  }

  public createPage(title: string): PageData {
    const normalizedTitle = sanitizeDeckTitle(title) || "Nueva nota";
    const existing = this.getPageByTitle(normalizedTitle);
    if (existing) return existing;

    const pagePath = this.activeRootPath
      ? `${this.activeRootPath.replace(/[\\/]+$/, "")}/pages/${normalizedTitle}.md`
      : `pages/${normalizedTitle}.md`;
    const newPage: PageData = {
      id: "p-" + Math.random().toString(36).substring(2, 9),
      title: normalizedTitle,
      path: pagePath,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      revisions: [],
      blocks: [
        {
          id: "b-" + Math.random().toString(36).substring(2, 9),
          type: "text",
          content: "",
          children: [],
          collapsed: false,
        },
      ],
    };

    this.savePage(newPage);
    return newPage;
  }

  public createJournal(date: string): PageData {
    const existing = this.pages.find((page) => page.isJournal && page.journalDate === date);
    if (existing) return existing;

    const journalDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(journalDate.getTime()) || journalDate.toISOString().slice(0, 10) !== date) {
      throw new Error(`Fecha de diario no válida: ${date}`);
    }

    const compactDate = date.replace(/-/g, "_");
    const baseTitle = `Diario ${date}`;
    let title = baseTitle;
    let suffix = 2;
    while (this.getPageByTitle(title)) {
      title = `${baseTitle} (${suffix})`;
      suffix += 1;
    }
    const root = this.activeRootPath?.replace(/[\\/]+$/, "");
    const page: PageData = {
      id: "p-" + Math.random().toString(36).substring(2, 9),
      title,
      path: root
        ? `${root}/journals/${compactDate}.md`
        : `journals/${compactDate}.md`,
      isJournal: true,
      journalDate: date,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      revisions: [],
      blocks: [
        {
          id: "b-" + Math.random().toString(36).substring(2, 9),
          type: "text",
          content: "",
          children: [],
          collapsed: false,
        },
      ],
    };

    this.savePage(page);
    return page;
  }

  public findBacklinksFor(targetTitle: string): Backlink[] {
    const backlinks: Backlink[] = [];
    const pattern = new RegExp(`\\[\\[${targetTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`, "i");

    this.pages.forEach((page) => {
      if (page.title.toLowerCase() === targetTitle.toLowerCase()) return;

      const flat = getAllBlocksFlat(page.blocks);
      flat.forEach((b, idx) => {
        if (pattern.test(b.content)) {
          backlinks.push({
            source_page: page.title,
            source_path: page.path,
            line_number: idx + 1,
            snippet: b.content,
          });
        }
      });
    });

    return backlinks;
  }

  private persist() {
    // En Tauri los .md son la fuente de verdad: NO duplicamos el vault en localStorage.
    // En modo web (demo), se mantiene el guardado completo del vault.
    if (isTauri()) return;
    safeSetItem(VAULT_STORAGE_KEY, JSON.stringify(this.pages));
  }

  private enqueueFileOperation(
    paths: string[],
    operationName: string,
    operation: () => Promise<void>,
    propagateError = false
  ): Promise<void> {
    const uniquePaths = [...new Set(paths)];
    const previous = uniquePaths
      .map((path) => this.pendingFileOperations.get(path))
      .filter((pending): pending is Promise<void> => pending !== undefined);
    const pending = Promise.all(previous)
      .then(operation)
      .catch((error: unknown) => {
        console.error(`No se pudo ${operationName} mediante Tauri:`, error);
        window.dispatchEvent(new CustomEvent("vault-operation-error", {
          detail: `No se pudo ${operationName}. Verifica los permisos de escritura del vault.`,
        }));
        if (propagateError) throw error;
      });

    uniquePaths.forEach((path) => this.pendingFileOperations.set(path, pending));
    const clearPending = () => {
      uniquePaths.forEach((path) => {
        if (this.pendingFileOperations.get(path) === pending) {
          this.pendingFileOperations.delete(path);
        }
      });
    };
    void pending.then(clearPending, clearPending);
    return pending;
  }
}
