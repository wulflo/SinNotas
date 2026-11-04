import { PageData, PageRevision, BlockNode, RestoredSnapshot, VaultCacheDelta } from "../types";
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
/** FASE 4: interruptor del arranque con metadatos (bloques bajo demanda). */
const METADATA_BOOT_STORAGE_KEY = "sinnotas-metadata-boot";
/** Máximo de notas con bloques residentes en memoria (LRU; la abierta va pinned). */
const MAX_LOADED_PAGES = 120;

/** Milisegundos que se agrupan las ediciones de texto antes de escribir a disco. */
const SAVE_DEBOUNCE_MS = 300;

/**
 * FASE 4: ¿arranca la app "metadata-only" (títulos/fechas/frontmatter sin
 * árboles de bloques) y rehidrata con `read_pages_cached`?
 * FASE 4-E: ON por defecto. Solo tiene efecto en Tauri con bóveda local (SAF
 * sigue devolviendo bloques completos; sus líneas lazy son no-op). El
 * interruptor `off` queda como escape para una sesión: si algo fallase en
 * campo, el usuario (o soporte) vuelve al arranque completo sin actualizar
 * la app.
 */
export function isMetadataOnlyBoot(): boolean {
  try {
    const stored = window.localStorage.getItem(METADATA_BOOT_STORAGE_KEY);
    if (stored === "off") return false;
    if (stored === "on") return true;
  } catch {
    // localStorage inaccesible: sirve el default.
  }
  return true;
}

let storageWarningShown = false;

/** Normaliza separadores para comparar rutas del vault entre Rust y JS. */
function normalizePathForCompare(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Convierte una ruta del delta nativo (normalmente absoluta) a la ruta
 * relativa que usa el vault en memoria. Sin esto, el watcher añadía una copia
 * de cada nota al guardarla porque `root/nota.md` y `nota.md` no coincidían.
 */
function relativeDeltaPath(path: string, rootPath: string | null): string {
  const normalizedPath = normalizePathForCompare(path);
  const normalizedRoot = rootPath ? normalizePathForCompare(rootPath) : "";
  if (normalizedRoot) {
    if (normalizedPath === normalizedRoot) return "";
    if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
      return normalizedPath.slice(normalizedRoot.length + 1);
    }
  }
  return normalizedPath.replace(/^\/+/, "");
}

export interface ExternalDeltaResult {
  changed: string[];
  added: string[];
  removed: string[];
}

/**
 * Vista de versiones para las vistas con caché por nota (flashcards, Kanban,
 * índice de búsqueda). `getStructural` cambia solo cuando el CONJUNTO de notas
 * cambia (bóveda reemplazada, borrado, renombrado, delta externo); `getPageVersion`
 * es un contador por nota que sube con cada cambio de contenido de esa nota.
 */
export interface VaultVersionView {
  getStructural(): number;
  getPageVersion(page: PageData): number;
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
   * Contador monótono de mutaciones ESTRUCTURALES de la bóveda (reemplazo,
   * borrado, renombrado, deltas externos). Las ediciones de contenido de una
   * nota ya no lo mueven: para eso están los epochs por página.
   */
  private mutationVersion = 0;

  /** Epochs por nota (ruta normalizada => contador) para cachés incrementales. */
  private pageVersions = new Map<string, number>();

  /** Escrituras propias completadas (guardados a disco de esta sesión). */
  private ownWriteEpoch = 0;

  /**
   * FASE 4 (bloques bajo demanda): orden de último uso por nota rehidratada
   * (ruta relativa => tick). Lleva la cuenta del LRU y del sweep de descarga.
   */
  private loadedPageEpochs = new Map<string, number>();
  /** Notas que NO pueden descargarse con el sweep (p. ej. la página abierta). */
  private pinnedLoadedPaths = new Set<string>();
  private loadedTick = 0;

  public getMutationVersion(): number {
    return this.mutationVersion;
  }

  private bumpMutationVersion(): void {
    this.mutationVersion += 1;
  }

  /** Epoch (contador de cambios de contenido) de una nota concreta. */
  public getPageVersion(page: PageData): number {
    const key = normalizePathForCompare(page?.path || "");
    if (!key) return 0;
    return this.pageVersions.get(key) ?? 0;
  }

  private bumpPageVersion(page: PageData): void {
    const key = normalizePathForCompare(page?.path || "");
    if (!key) return;
    this.pageVersions.set(key, (this.pageVersions.get(key) ?? 0) + 1);
  }

  /** Copia el mapa de epochs (para vistas que detectan "qué cambió" luego). */
  public capturePageVersions(): ReadonlyMap<string, number> {
    return new Map(this.pageVersions);
  }

  /**
   * Devuelve las notas cuyo epoch actual difiere de la captura dada (o que no
   * existían en ella). Es O(numero total de notas): solo se usa al entrar en
   * una vista cacheada, no en el camino de cada tecla.
   */
  public collectPageChanges(since: ReadonlyMap<string, number>): PageData[] {
    const changed: PageData[] = [];
    this.pages.forEach((page) => {
      const key = normalizePathForCompare(page?.path || "");
      if (key && (since.get(key) ?? -1) !== (this.pageVersions.get(key) ?? 0)) {
        changed.push(page);
      }
    });
    return changed;
  }

  private readonly versionView: VaultVersionView = {
    getStructural: () => this.mutationVersion,
    getPageVersion: (page) => this.getPageVersion(page),
  };

  /** Objeto estable para que las vistas cacheadas consulten versiones. */
  public getVersionView(): VaultVersionView {
    return this.versionView;
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
    // Normalizar rutas heredadas (absolutas/prefijadas) a rutas relativas.
    this.pages.forEach((page) => {
      page.path = this.toRelativeNotePath(page.path, this.activeRootPath);
    });

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

  /** Convierte una ruta de nota a ruta relativa al vault activo. */
  private toRelativeNotePath(path: string, rootPath?: string | null): string {
    let normalized = (path || "").replace(/\\/g, "/").trim();
    if (!normalized) return normalized;

    const normalizedRoot = rootPath?.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalizedRoot && normalized.startsWith(`${normalizedRoot}/`)) {
      normalized = normalized.slice(normalizedRoot.length + 1);
    }

    // Si la ruta sigue siendo absoluta o quedó prefijada por una raíz antigua
    // (p. ej. un JSON de SAF), conservamos solo la parte relativa a partir de
    // las carpetas de notas conocidas.
    const pagesIndex = normalized.lastIndexOf("/pages/");
    const journalsIndex = normalized.lastIndexOf("/journals/");
    const knownIndex = Math.max(pagesIndex, journalsIndex);
    if (knownIndex >= 0) {
      normalized = normalized.slice(knownIndex + 1);
    } else if (/^(?:\/|[a-z]:\/)/i.test(normalized)) {
      // Último recurso: quedarse con el nombre de archivo.
      normalized = normalized.split("/").pop() || normalized;
    }

    return normalized.replace(/^\/+/, "");
  }

  public getActiveRootPath(): string | null {
    return this.activeRootPath;
  }

  public replaceVault(pages: PageData[], rootPath: string, vaultName: string): void {
    // FASE 6.2: el pase O(vault) en el hilo principal solo hace falta para
    // datos legacy del modo web: en Tauri el payload SIEMPRE sale del parse
    // de Rust (parse_markdown_with_frontmatter), que entrega block_type
    // canónicos ("text"/"image" + image_alt) — con SAF además los árboles
    // viajan completos, así que renormalizar aquí pagaba el vault entero en
    // cada arranque y cada sync.
    if (!isTauri()) {
      pages.forEach((page) => normalizeBlockTypes(page.blocks));
    }
    // Las rutas de las notas deben ser relativas al vault. En algunos vaults
    // (especialmente SAF en Android) el frontend pudo haber guardado rutas
    // absolutas o prefijadas con la raíz; las normalizamos aquí para que el
    // backend resuelva siempre dentro del vault activo.
    pages.forEach((page) => {
      page.path = this.toRelativeNotePath(page.path, rootPath);
    });
    // Descartar escrituras diferidas del vault anterior.
    this.pendingSaves.forEach((entry) => window.clearTimeout(entry.timer));
    this.pendingSaves.clear();
    this.pages = pages;
    this.activeRootPath = rootPath;
    this.activeVaultName = vaultName;
    this.bumpMutationVersion();
    // FASE 4: el estado del LRU de bloques pertenece al vault anterior.
    this.loadedPageEpochs.clear();
    this.pinnedLoadedPaths.clear();
    this.loadedTick = 0;
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

    const skip = new Set(
      [...(options.skipPaths || [])].map((path) =>
        normalizePathForCompare(relativeDeltaPath(path, activeRoot))
      )
    );
    const pendingPaths = new Set(
      [...this.pendingSaves.values()].map((entry) =>
        normalizePathForCompare(relativeDeltaPath(entry.page.path, activeRoot))
      )
    );
    const removedPaths = new Set(
      delta.removed.map((path) =>
        normalizePathForCompare(relativeDeltaPath(path, activeRoot))
      )
    );

    const incoming = new Map<string, { page: PageData; relativePath: string }>();
    for (const page of delta.changed) {
      if (!page?.path || !page.title) continue;
      const relativePath = relativeDeltaPath(page.path, activeRoot);
      const key = normalizePathForCompare(relativePath);
      if (!key) continue;
      incoming.set(key, { page, relativePath });
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
        ...update.page,
        path: page.path,
        id: page.id,
        pinned: page.pinned,
        pinnedAt: page.pinnedAt,
        revisions: page.revisions,
      };
      normalizeBlockTypes(updated.blocks);
      nextPages.push(updated);
      result.changed.push(page.path);
      this.bumpPageVersion(page);
    }

    for (const [key, entry] of incoming) {
      if (skip.has(key) || pendingPaths.has(key) || removedPaths.has(key)) continue;
      const added: PageData = {
        ...entry.page,
        path: entry.relativePath,
        blocks: entry.page.blocks || [],
      };
      normalizeBlockTypes(added.blocks);
      nextPages.push(added);
      result.added.push(added.path);
      this.bumpPageVersion(added);
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

  /**
   * FASE 4 (bloques bajo demanda): marca una nota como NO descargable por el
   * sweep del LRU (la página abierta en el editor, p. ej.).
   */
  public pinPage(path: string): void {
    this.pinnedLoadedPaths.add(this.relativeKeyFor(path));
  }

  /** Devuelve una nota al conjunto que el sweep del LRU puede descargar. */
  public unpinPage(path: string): void {
    this.pinnedLoadedPaths.delete(this.relativeKeyFor(path));
  }

  private relativeKeyFor(path: string): string {
    const root = this.activeRootPath;
    return root ? this.toRelativeNotePath(path, root) : path;
  }

  /**
   * Garantiza que la nota tenga bloques en memoria. En modo full (flag OFF,
   * SAF, web) es un no-op; en metadata-only invoca `read_pages_cached`
   * (cacheada en Rust) y mezcla el resultado.
   */
  public async ensurePageLoaded(
    page: PageData,
    options: { pin?: boolean } = {}
  ): Promise<PageData> {
    if (!isTauri() || page.blocksLoaded !== false) return page;
    await this.loadPagesCached([page], options);
    const fresh = this.pages.find((candidate) => candidate.id === page.id);
    return fresh ?? page;
  }

  /**
   * Rehidrata un lote de notas SIN bloques desde la caché de Rust
   * (`read_pages_cached`): streaming para scans de flashcards/Kanban y
   * renombres en bóvedas enormes. Aplica pin, sube el LRU y barre las notas
   * menos recientes no pinned.
   */
  public async loadPagesCached(
    pages: PageData[],
    options: { pin?: boolean } = {}
  ): Promise<void> {
    if (!isTauri()) return;
    const targets = pages.filter((page) => page.blocksLoaded === false);
    if (targets.length === 0) return;
    const paths = [...new Set(targets.map((page) => page.path))];
    let loaded: PageData[];
    try {
      loaded = await invoke<PageData[]>("read_pages_cached", { paths });
    } catch (error) {
      console.error("No se pudo rehidratar la nota desde la caché de Rust:", error);
      return;
    }
    if (loaded.length === 0) return;
    this.loadedTick += 1;
    const activeRoot = this.activeRootPath;
    const pagesById = new Map(this.pages.map((page) => [page.id, page]));
    const pagesByPath = new Map(
      this.pages.map((page) => [normalizePathForCompare(page.path), page])
    );
    for (const fresh of loaded) {
      if (!Array.isArray(fresh.blocks)) continue;
      normalizeBlockTypes(fresh.blocks);
      if (activeRoot) fresh.path = this.toRelativeNotePath(fresh.path, activeRoot);
      const existing = pagesById.get(fresh.id)
        ?? pagesByPath.get(normalizePathForCompare(fresh.path));
      if (!existing) continue;
      existing.blocks = fresh.blocks;
      existing.blocksLoaded = true;
      existing.blockCount = fresh.blockCount;
      existing.isJournal = fresh.isJournal;
      existing.journalDate = fresh.journalDate;
      existing.updatedAtMs = fresh.updatedAtMs;
      existing.createdAtMs = fresh.createdAtMs;
      this.loadedPageEpochs.set(existing.path, this.loadedTick);
    }
    if (options.pin) {
      for (const fresh of loaded) this.pinPage(fresh.path);
    }
    this.sweepUnpinnedPages();
  }

  /** LRU: descarga (blocks = []) las notas no pinned más viejas del límite. */
  private sweepUnpinnedPages(): void {
    if (this.loadedPageEpochs.size <= MAX_LOADED_PAGES) return;
    const pendingIds = new Set([...this.pendingSaves.values()].map((entry) => entry.page.id));
    const entries = [...this.loadedPageEpochs.entries()].sort(
      (left, right) => left[1] - right[1]
    );
    const pagesByPath = new Map(
      this.pages.map((page) => [normalizePathForCompare(page.path), page])
    );
    let excess = this.loadedPageEpochs.size - MAX_LOADED_PAGES;
    for (const [path] of entries) {
      if (excess <= 0) break;
      if (this.pinnedLoadedPaths.has(path)) continue;
      const page = pagesByPath.get(normalizePathForCompare(path));
      if (!page || page.blocksLoaded === false) {
        this.loadedPageEpochs.delete(path);
        continue;
      }
      if (pendingIds.has(page.id)) continue; // escritura diferida: no se toca.
      page.blocks = [];
      page.blocksLoaded = false;
      this.loadedPageEpochs.delete(path);
      excess -= 1;
    }
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
    // FASE 4: una nota descargada (metadata-only, LRU) no tiene bloques
    // editables en memoria; guardarla aplanaria SU contenido. No-op.
    if (page.blocksLoaded === false) {
      console.warn("savePage ignorado: la nota no tiene bloques cargados:", page.title);
      return;
    }
    this.rememberPage(page);
    // La página cambió en memoria: invalidar SOLO su epoch. Las cachés
    // incrementales (flashcards, Kanban, búsqueda) reescanean únicamente esta
    // nota en lugar de la bóveda completa por cada tecla.
    this.bumpPageVersion(page);

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
    // FASE 4: defensa en profundidad del guard del schedule: no aplanar
    // nunca una nota descargada con `blocks: []`.
    if (updatedPage.blocksLoaded === false) {
      console.warn("persistPage ignorado: la nota no tiene bloques cargados:", updatedPage.title);
      return Promise.resolve();
    }
    this.persist();

    if (!isTauri()) return Promise.resolve();
    return this.enqueueFileOperation(
      [updatedPage.path],
      "save markdown file",
      () => invoke("save_page", {
        filePath: updatedPage.path,
        blocks: updatedPage.blocks,
        frontmatter: updatedPage.frontmatter || [],
      }).then(() => {
        // Escritura propia completada: el baseline de sincronización del
        // disco queda obsoleto sin que existan cambios externos (ver
        // synchronizeVaultFromDisk, que usa este contador para distinguirlos).
        this.ownWriteEpoch += 1;
      }),
      propagateError
    );
  }

  /** Contador de escrituras propias completadas (guardados a disco hechos
   * por esta sesión). Sirve para distinguir en la verificación de frescura
   * un "fingerprint distinto por ediciones propias" de un cambio externo. */
  public getOwnWriteEpoch(): number {
    return this.ownWriteEpoch;
  }

  private markOwnWrite(): void {
    this.ownWriteEpoch += 1;
  }

  public savePage(updatedPage: PageData, propagateError = false): Promise<void> {
    // Un guardado inmediato reemplaza al diferido pendiente de la misma nota.
    this.cancelPendingSave(updatedPage.id);
    // "Todas las páginas" y los diarios ordenan por esta marca: sin
    // actualizarla en memoria la tabla mostraría la fecha anterior al guardar.
    const savedAt = Date.now();
    updatedPage.updatedAtMs = savedAt;
    updatedPage.updatedAt = new Date(savedAt).toISOString().replace("T", " ").substring(0, 16);
    this.rememberPage(updatedPage);
    this.bumpPageVersion(updatedPage);
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
        invoke("delete_page", { filePath: pageToDelete.path }).then(() => {
          this.markOwnWrite();
        })
      );
    }

    return true;
  }

  public async renamePage(pageId: string, newTitle: string): Promise<boolean> {
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

    // FASE 4-D: hidrata la nota renombrada ANTES de tocarla (con el boot de
    // metadatos, su renombre cambia la ruta que la caché de Rust todavía no
    // conoce; si se hidratara después, el read fallaría como fichero inexistente).
    if (isMetadataOnlyBoot() && isTauri() && page.blocksLoaded === false) {
      await this.ensurePageLoaded(page);
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
    const changedPages = await this.rewriteRenameLinks(oldTitle, oldPattern, newLink, page);

    this.persist();

    if (isTauri()) {
      void this.enqueueFileOperation([oldPath, newPath], "rename markdown file", () =>
        invoke("rename_page", { oldPath, newPath }).then(() => {
          this.markOwnWrite();
        })
      );
      // Guardar la página renombrada con su nuevo path y contenido actualizado
      void this.savePage(page);
      // Write the updated links to disk (queued after the rename for the renamed page itself)
      changedPages.forEach((p) => void this.savePage(p));
    }

    return true;
  }

  /**
   * FASE 4-D: reescritura de los `[[TítuloAntiguo]]` del vault tras un
   * rename.
   * - Modo completo (flag OFF, SAF, web): escaneo JS de todas las páginas,
   *   como siempre.
   * - Modo metadata-only: los candidatos salen de `find_backlinks` (cached:
   *   superset — incluye refs por #tag que la regex audita deja pasar de
   *   largo) y se rehidratan por lotes con el barrido del LRU antes del
   *   rewrite. Si falla la consulta, cae al escaneo en memoria.
   */
  private async rewriteRenameLinks(
    oldTitle: string,
    oldPattern: RegExp,
    newLink: string,
    renamedPage: PageData
  ): Promise<PageData[]> {
    const rewrite = (pages: PageData[]): PageData[] => {
      const changedPages: PageData[] = [];
      pages.forEach((p) => {
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
      return changedPages;
    };

    if (!isMetadataOnlyBoot() || !isTauri()) return rewrite(this.pages);

    let backlinks: Array<{ sourcePath: string; sourcePage: string }> = [];
    try {
      backlinks = await invoke<Array<{ sourcePath: string; sourcePage: string }>>(
        "find_backlinks",
        { pageTitle: oldTitle }
      );
    } catch (error) {
      console.error("find_backlinks no disponible; reescritura en memoria:", error);
      return rewrite(this.pages);
    }

    // Los retroenlaces de Rust citan la página por título del file stem:
    // resuelve a las notas del vault. El propia renombrada puede seguir
    // contieniendo enlaces de texto planos a su título anterior: entra en
    // el lote de hidratación aunque tenga bloques pendientes.
    const byTitle = new Map<string, PageData>();
    this.pages.forEach((p) => byTitle.set(p.title.toLowerCase(), p));
    const candidates: PageData[] = [];
    const seen = new Set<string>();
    const push = (page: PageData | undefined): void => {
      if (!page || seen.has(page.id)) return;
      seen.add(page.id);
      candidates.push(page);
    };
    [...new Set(backlinks.map((b) => b.sourcePage.toLowerCase()))].forEach((key) =>
      push(byTitle.get(key))
    );
    if (renamedPage.blocksLoaded === false) push(renamedPage);

    // Rehidratación por lotes; el barrido del LRU descarta lo que no queda
    // residente, así que la memoria no crece con el tamaño del vault.
    const dry = candidates.filter((p) => p.blocksLoaded === false);
    if (dry.length > 0) await this.loadPagesCached(dry);

    return rewrite(candidates);
  }

  /**
   * Cambia el contenido de un bloque por título de nota (el residuo de las
   * tareas del Kanban). FASE 4-E: la nota puede estar descargada (boot de
   * metadatos); rehidrata ANTES de tocar el árbol, o el cambio sería un
   * no-op silencioso.
   */
  public async updateBlockContent(pageTitle: string, blockId: string, newContent: string): Promise<void> {
    let page = this.getPageByTitle(pageTitle);
    if (!page) return;
    if (page.blocksLoaded === false && isTauri()) {
      await this.ensurePageLoaded(page, { pin: true });
      page = this.getPageByTitle(pageTitle);
      if (!page || page.blocksLoaded === false) return;
    }

    const loc = findNodeLocation(page.blocks, blockId);
    if (loc) {
      loc.parentList[loc.index].content = newContent;
      await this.savePage(page);
    }
  }

  /**
   * Restaura un snapshot desde `.sinnotas/chronos/`. El backend guarda antes una copia
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
      // Solo cambia el contenido de esta nota: bump de su epoch (las vistas
      // incrementales reescanean únicamente esta página).
      this.bumpPageVersion(pageToUpdate);
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

    const pagePath = `pages/${normalizedTitle}.md`;
    const createdAt = Date.now();
    const newPage: PageData = {
      id: "p-" + Math.random().toString(36).substring(2, 9),
      title: normalizedTitle,
      path: pagePath,
      updatedAt: new Date(createdAt).toISOString().replace("T", " ").substring(0, 16),
      updatedAtMs: createdAt,
      createdAtMs: createdAt,
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
    // El título de una nota es su nombre de archivo. Usar exactamente el mismo
    // valor que el stem evita que, tras recargar, el diario aparezca con otro
    // título (antes: "Diario 2026-10-28" en memoria y "2026_10_28" en disco).
    const title = compactDate;
    const createdAt = Date.now();
    const page: PageData = {
      id: "p-" + Math.random().toString(36).substring(2, 9),
      title,
      path: `journals/${compactDate}.md`,
      isJournal: true,
      journalDate: date,
      updatedAt: new Date(createdAt).toISOString().replace("T", " ").substring(0, 16),
      updatedAtMs: createdAt,
      // La fecha "real" de un diario es su journalDate; este valor solo cubre
      // notas creadas en memoria (modo web/demo).
      createdAtMs: createdAt,
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
        const detail = error instanceof Error ? error.message : String(error);
        console.error(`No se pudo ${operationName} mediante Tauri:`, error);
        window.dispatchEvent(new CustomEvent("vault-operation-error", {
          detail: `No se pudo ${operationName}: ${detail}`,
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
