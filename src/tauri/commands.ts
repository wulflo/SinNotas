/**
 * Adaptador tipado para los comandos Tauri que transportan datos de dominio.
 *
 * Antes cada llamada `invoke` construía sus argumentos en el sitio de uso; un
 * nombre cambiado o un argumento ausente llegaba como `undefined` al backend.
 * Aquí el contrato es explícito y las formas de datos se normalizan en un
 * único sitio.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  Backlink,
  BlockNode,
  PageData,
  PageRevision,
  RestoredSnapshot,
} from "../types";

function assertRequired(args: Record<string, unknown>, fields: readonly string[]): void {
  if (!import.meta.env.DEV) return;
  for (const field of fields) {
    if (args[field] === undefined || args[field] === null) {
      throw new Error(`invoke: falta el argumento "${field}"`);
    }
  }
}

export interface SavePageArgs {
  filePath: string;
  blocks: BlockNode[];
  frontmatter?: string[];
}

export function savePageCmd(args: SavePageArgs): Promise<void> {
  assertRequired(args as unknown as Record<string, unknown>, ["filePath", "blocks"]);
  return invoke("save_page", {
    filePath: args.filePath,
    blocks: args.blocks,
    frontmatter: args.frontmatter ?? [],
  });
}

export function readPagesCachedCmd(paths: string[]): Promise<PageData[]> {
  assertRequired({ paths }, ["paths"]);
  return invoke<PageData[]>("read_pages_cached", { paths });
}

export function readNoteSnapshotsCmd(filePath: string): Promise<PageRevision[]> {
  assertRequired({ filePath }, ["filePath"]);
  return invoke<PageRevision[]>("read_note_snapshots", { filePath });
}

export function writePageRevisionsCmd(filePath: string, revisions: PageRevision[]): Promise<void> {
  assertRequired({ filePath, revisions }, ["filePath", "revisions"]);
  return invoke("write_page_revisions", { filePath, revisions });
}

export function deletePageCmd(filePath: string): Promise<void> {
  assertRequired({ filePath }, ["filePath"]);
  return invoke("delete_page", { filePath });
}

export function renamePageCmd(oldPath: string, newPath: string): Promise<void> {
  assertRequired({ oldPath, newPath }, ["oldPath", "newPath"]);
  return invoke("rename_page", { oldPath, newPath });
}

/** Rust serializa `Backlink` en snake_case; el resto del front usa camelCase. */
interface BacklinkWire {
  source_page?: string;
  source_path?: string;
  line_number?: number;
  snippet?: string;
  sourcePage?: string;
  sourcePath?: string;
  lineNumber?: number;
}

export async function findBacklinksCmd(pageTitle: string): Promise<Backlink[]> {
  assertRequired({ pageTitle }, ["pageTitle"]);
  const raw = await invoke<BacklinkWire[]>("find_backlinks", { pageTitle });
  return raw.map((item) => ({
    source_page: item.source_page ?? item.sourcePage ?? "",
    source_path: item.source_path ?? item.sourcePath ?? "",
    line_number: item.line_number ?? item.lineNumber ?? 0,
    snippet: item.snippet ?? "",
  }));
}

export function restoreSnapshotCmd(filePath: string, snapshotId: string): Promise<RestoredSnapshot> {
  assertRequired({ filePath, snapshotId }, ["filePath", "snapshotId"]);
  return invoke<RestoredSnapshot>("restore_snapshot", { filePath, snapshotId });
}

export function readReviewProgressCmd(): Promise<string | null> {
  return invoke<string | null>("read_review_progress");
}

export function writeReviewProgressCmd(contents: string): Promise<string> {
  assertRequired({ contents }, ["contents"]);
  return invoke<string>("write_review_progress", { contents });
}

export function clearReviewProgressCmd(): Promise<void> {
  return invoke("clear_review_progress");
}

export function readFlashcardDecksCmd(): Promise<string | null> {
  return invoke<string | null>("read_flashcard_decks");
}

export function writeFlashcardDecksCmd(contents: string): Promise<void> {
  assertRequired({ contents }, ["contents"]);
  return invoke("write_flashcard_decks", { contents });
}
