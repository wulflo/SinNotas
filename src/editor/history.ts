import { BlockNode } from "../types";
import { cloneTree } from "./tree-engine";

/** Snapshot del documento para deshacer/rehacer. */
export interface DocumentHistoryEntry {
  blocks: BlockNode[];
  title: string;
}

interface InternalEntry extends DocumentHistoryEntry {
  /** Instante en que se registró la entrada (para coalescer ediciones seguidas). */
  at: number;
  /** Firma de la jerarquía (ids y profundidad, sin contenido) para detectar cambios estructurales. */
  structureKey: string;
}

/** Máximo de snapshots retenidos por nota. */
const MAX_ENTRIES_PER_PAGE = 60;
/** Ventana en la que ediciones de texto consecutivas se agrupan en un solo paso de deshacer. */
const COALESCE_WINDOW_MS = 1200;

/** Firma barata de la forma del árbol: ids + profundidad + tipo, sin el contenido. */
function structureKeyOf(blocks: BlockNode[]): string {
  const parts: string[] = [];
  const walk = (nodes: BlockNode[], depth: number) => {
    for (const node of nodes) {
      parts.push(`${depth}:${node.id}:${node.type}`);
      walk(node.children || [], depth + 1);
    }
  };
  walk(blocks, 0);
  return parts.join("|");
}

function blocksEqual(a: BlockNode[], b: BlockNode[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Historial de deshacer/rehacer por nota.
 *
 * Los snapshots se capturan desde un único punto (`VaultStore.onBeforeSave`) para
 * cubrir todas las rutas de edición sin tocar cada llamada a `savePage`.
 * Mientras el usuario teclea seguido en el mismo bloque, las ediciones se
 * agrupan en un solo paso; un cambio estructural (insertar, borrar, mover
 * bloques) siempre abre un paso nuevo.
 */
export class DocumentHistory {
  private undoStacks = new Map<string, InternalEntry[]>();
  private redoStacks = new Map<string, InternalEntry[]>();
  private lastStates = new Map<string, InternalEntry>();
  private lastPushAt = new Map<string, number>();
  private restoring = false;

  /** Verdadero mientras se aplica un snapshot (para no registrarlo como nueva edición). */
  public get isRestoring(): boolean {
    return this.restoring;
  }

  public beginRestore(): void {
    this.restoring = true;
  }

  public endRestore(): void {
    this.restoring = false;
  }

  /** Captura el estado de una nota tras guardarla. No hace nada si no cambió. */
  public capture(pageId: string, blocks: BlockNode[], title: string): void {
    if (this.restoring) return;

    const now = Date.now();
    const snapshot: InternalEntry = {
      blocks: cloneTree(blocks),
      title,
      at: now,
      structureKey: structureKeyOf(blocks),
    };

    const last = this.lastStates.get(pageId);
    if (!last) {
      this.lastStates.set(pageId, snapshot);
      return;
    }
    if (blocksEqual(last.blocks, blocks) && last.title === title) return;

    const undoStack = this.undoStacks.get(pageId) ?? [];
    const structureChanged = last.structureKey !== snapshot.structureKey;
    const lastPush = this.lastPushAt.get(pageId) ?? 0;
    const withinWindow = now - lastPush < COALESCE_WINDOW_MS;

    // Solo se abre un paso nuevo si cambió la estructura o pasó la ventana de
    // coalescing; si no, la edición de texto se agrupa con la anterior.
    if (structureChanged || !withinWindow) {
      undoStack.push(last);
      while (undoStack.length > MAX_ENTRIES_PER_PAGE) undoStack.shift();
      this.lastPushAt.set(pageId, now);
      // Una nueva edición invalida la rama de rehacer.
      this.redoStacks.delete(pageId);
    }

    this.undoStacks.set(pageId, undoStack);
    this.lastStates.set(pageId, snapshot);
  }

  public canUndo(pageId: string): boolean {
    return (this.undoStacks.get(pageId)?.length ?? 0) > 0;
  }

  public canRedo(pageId: string): boolean {
    return (this.redoStacks.get(pageId)?.length ?? 0) > 0;
  }

  /** Devuelve el snapshot a restaurar y deja el estado actual en la pila de rehacer. */
  public undo(pageId: string, currentBlocks: BlockNode[], currentTitle: string): DocumentHistoryEntry | null {
    const undoStack = this.undoStacks.get(pageId);
    if (!undoStack || undoStack.length === 0) return null;

    const current = this.toEntry(currentBlocks, currentTitle);
    const target = undoStack.pop()!;
    const redoStack = this.redoStacks.get(pageId) ?? [];
    redoStack.push(current);
    this.redoStacks.set(pageId, redoStack);
    this.undoStacks.set(pageId, undoStack);
    // Cortar la ventana de coalescing para que la siguiente edición no se agrupe.
    this.lastPushAt.delete(pageId);
    return { blocks: target.blocks, title: target.title };
  }

  /** Devuelve el snapshot a restaurar y deja el estado actual en la pila de deshacer. */
  public redo(pageId: string, currentBlocks: BlockNode[], currentTitle: string): DocumentHistoryEntry | null {
    const redoStack = this.redoStacks.get(pageId);
    if (!redoStack || redoStack.length === 0) return null;

    const current = this.toEntry(currentBlocks, currentTitle);
    const target = redoStack.pop()!;
    const undoStack = this.undoStacks.get(pageId) ?? [];
    undoStack.push(current);
    this.undoStacks.set(pageId, undoStack);
    this.redoStacks.set(pageId, redoStack);
    this.lastPushAt.delete(pageId);
    return { blocks: target.blocks, title: target.title };
  }

  /**
   * Registra explícitamente el estado aplicado tras un undo/redo, para que la
   * siguiente edición se compare contra él y no duplique pasos.
   */
  public markApplied(pageId: string, blocks: BlockNode[], title: string): void {
    this.lastStates.set(pageId, this.toEntry(blocks, title));
  }

  /**
   * Establece la línea base de una nota sin crear un paso de deshacer.
   * Se usa al mostrar la nota en el editor para que la primera edición sí
   * tenga el estado previo registrado y pueda deshacerse.
   */
  public seed(pageId: string, blocks: BlockNode[], title: string): void {
    this.lastStates.set(pageId, this.toEntry(blocks, title));
    // Una sesión de edición nueva no debe coalescer con la anterior.
    this.lastPushAt.delete(pageId);
  }

  public clearPage(pageId: string): void {
    this.undoStacks.delete(pageId);
    this.redoStacks.delete(pageId);
    this.lastStates.delete(pageId);
    this.lastPushAt.delete(pageId);
  }

  public clearAll(): void {
    this.undoStacks.clear();
    this.redoStacks.clear();
    this.lastStates.clear();
    this.lastPushAt.clear();
  }

  private toEntry(blocks: BlockNode[], title: string): InternalEntry {
    return {
      blocks: cloneTree(blocks),
      title,
      at: Date.now(),
      structureKey: structureKeyOf(blocks),
    };
  }
}
