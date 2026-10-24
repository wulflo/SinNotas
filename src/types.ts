import { FSRSItem } from "./editor/fsrs";

export interface BlockNode {
  id: string;
  type: "text" | "image";
  content: string;
  imageAlt?: string;
  children: BlockNode[];
  collapsed?: boolean;
}

export interface PageRevision {
  id: string;
  timestamp: string;
  blocks: BlockNode[];
  summary: string;
  /** Instante UTC en milisegundos, si el backend pudo determinarlo. */
  createdAt?: number;
}

export interface SnapshotState {
  notePath: string;
  enabled: boolean;
  activatedAt: number;
  expiresAt: number;
  durationDays: number;
  intervalHours: number;
  maxPerDay: number;
  lastRunAt: number;
  nextRunAt: number;
  remainingMs: number;
  expired: boolean;
  clockAnomaly: boolean;
  lastStatus: string;
  storageFolder: string;
  maxDays: number;
  snapshotCount: number;
}

export interface SnapshotActiveNote {
  notePath: string;
  noteTitle: string;
  snapshotCount: number;
  activatedAt: number;
  expiresAt: number;
  remainingMs: number;
  intervalHours: number;
  maxPerDay: number;
  lastRunAt: number;
  lastStatus: string;
}

export interface RestoredSnapshot {
  blocks: BlockNode[];
  frontmatter: string[];
}

export interface PageData {
  id: string;
  title: string;
  path: string;
  blocks: BlockNode[];
  frontmatter?: string[];
  isJournal?: boolean;
  journalDate?: string; // YYYY-MM-DD
  updatedAt?: string;
  revisions?: PageRevision[];
  pinned?: boolean;
  pinnedAt?: string;
}

export interface Backlink {
  source_page: string;
  source_path: string;
  line_number: number;
  snippet: string;
}

/**
 * Cambio incremental emitido por el watcher de Rust cuando otra aplicación
 * modifica el vault. `changed` trae las notas ya parseadas y `removed` las
 * rutas absolutas que dejaron de existir.
 */
export interface VaultCacheDelta {
  rootPath: string;
  changed: PageData[];
  removed: string[];
  revision: number;
}

export interface CursorState {
  blockId: string;
  offset: number;
}

export type FlashcardType = "basic" | "cloze" | "image-occlusion";

export interface Flashcard {
  id: string;
  pageTitle: string;
  blockId: string;
  cardType: FlashcardType;
  question: string;
  answer: string;
  fsrs: FSRSItem;
  lastIntervalDays: number;
  easeFactor: number;
  createdAt?: string;
  dueDate?: string;
  imageSource?: string;
  imageOcclusion?: ImageOcclusionRegion;
  imageOcclusions?: ImageOcclusionRegion[];
  /** Texto plano normalizado para la búsqueda del explorador (no se persiste). */
  searchText?: string;
}

export interface ImageOcclusionRegion {
  source: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: "rect" | "ellipse" | "polygon";
  points?: Array<{ x: number; y: number }>;
  rotation?: number;
  color?: string;
  hint?: string;
}

export type KanbanStatus = "todo" | "doing" | "done";

export interface KanbanTask {
  id: string;
  pageTitle: string;
  blockId: string;
  text: string;
  content: string;
  status: KanbanStatus;
  dueDate?: string;
  doingStartedAt?: string;
  completedAt?: string;
  doingDurationSeconds?: number;
}

export type TypographyType = "sans" | "serif" | "mono" | "dyslexic" | "custom" | "system";

export type ViewType = "editor" | "journals" | "flashcards" | "graph" | "kanban" | "all-pages";

export interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isJournal: boolean;
  connectionsCount: number;
  baseColor?: string | null;
  computedColor?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}
