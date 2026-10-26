import { BlockNode, PageData } from "../types";
import { stripCardTag, stripSystemProperties, stripTaskStatus } from "../editor/markdown";

interface MapNode {
  id: string;
  label: string;
  /** Contenido completo (sin truncar) del bloque, para expandir al hacer click. */
  fullContent: string;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  children: MapNode[];
}

interface MapLink {
  source: MapNode;
  target: MapNode;
}

const ROOT_FONT = "700 14px Inter, system-ui, sans-serif";
const BRANCH_FONT = "600 12px Inter, system-ui, sans-serif";
const LEAF_FONT = "11px Inter, system-ui, sans-serif";
const ROOT_HEIGHT = 38;
const NODE_HEIGHT = 30;
const H_GAP = 74;
const V_GAP = 12;
const PAD_X = 12;
const MAX_TEXT_WIDTH = 250;
const CLICK_TOLERANCE = 4;

/** Convierte el contenido visible de un bullet en una etiqueta corta y limpia. */
function blockLabel(block: BlockNode): string {
  if (block.type === "image") return block.imageAlt?.trim() || "Imagen";

  let text = stripSystemProperties(block.content);
  text = stripTaskStatus(stripCardTag(text));

  text = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[\w-]+::\s*.*$/i.test(line))
    .join(" ");

  text = text
    .replace(/<\/?u>/gi, "")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/___([^_]+)___/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_match, target: string, alias?: string) => alias || target)
    .replace(/\{\{(?:c\d+::|cloze\s+)?([^}\n]+)\}\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return text || "•";
}

/**
 * Mapa conceptual de una nota: árbol de bullets dibujado en un canvas con
 * desplazamiento y zoom. Inspirado en los editores de mapas mentales.
 */
export class ConceptMapView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private wrap: HTMLElement;
  private empty: HTMLElement;

  private root: MapNode | null = null;
  private nodes: MapNode[] = [];
  private links: MapLink[] = [];

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private panning = false;
  private pointerId: number | null = null;
  private panStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };
  private clickStart = { x: 0, y: 0 };

  public onNodeClick?: (nodeId: string, fullContent: string) => void;

  constructor(canvasId: string, wrapId: string, emptyId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.wrap = document.getElementById(wrapId) as HTMLElement;
    this.empty = document.getElementById(emptyId) as HTMLElement;
    this.setupEvents();
  }

  /** Devuelve el nodo (si lo hay) que contiene al punto dado en coordenadas
   * del mundo (ya desescalado y desoffsetado del lienzo). */
  private hitTestNode(worldX: number, worldY: number): MapNode | null {
    for (const node of this.nodes) {
      if (
        worldX >= node.x &&
        worldX <= node.x + node.width &&
        worldY >= node.y &&
        worldY <= node.y + node.height
      ) {
        return node;
      }
    }
    return null;
  }

  /** Construye y dibuja el mapa correspondiente a la nota indicada. */
  public setPage(page: PageData): void {
    this.root = this.buildTree(page);
    this.nodes = [];
    this.links = [];

    if (this.root) {
      this.collect(this.root);
      this.nodes.forEach((node) => this.measure(node));
      this.layout(this.root);
    }

    const hasContent = !!this.root && this.root.children.length > 0;
    this.empty.hidden = hasContent;
    this.canvas.hidden = !hasContent;
    this.empty.textContent = "Esta nota no tiene bullets para convertir en mapa.";

    if (!hasContent) return;

    this.resize();
    this.fit();
    this.render();
  }

  public zoomIn(): void {
    this.zoomAt(this.wrap.clientWidth / 2, this.wrap.clientHeight / 2, 1.2);
  }

  public zoomOut(): void {
    this.zoomAt(this.wrap.clientWidth / 2, this.wrap.clientHeight / 2, 1 / 1.2);
  }

  public fit(): void {
    if (!this.root || this.nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of this.nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const margin = 48;
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    const availableWidth = Math.max(1, this.wrap.clientWidth);
    const availableHeight = Math.max(1, this.wrap.clientHeight);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    this.scale = Math.max(0.08, Math.min(1.4, Math.min(availableWidth / width, availableHeight / height)));
    this.offsetX = (availableWidth - width * this.scale) / 2 - minX * this.scale;
    this.offsetY = (availableHeight - height * this.scale) / 2 - minY * this.scale;
    this.render();
  }

  /** Recalcula el tamaño del lienzo (por ejemplo, al abrir un panel) sin perder el zoom. */
  public refresh(): void {
    if (this.canvas.hidden) return;
    this.resize();
    this.render();
  }

  private buildTree(page: PageData): MapNode {
    const root: MapNode = {
      id: "root",
      label: page.title || "Sin título",
      fullContent: page.title || "Sin título",
      depth: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      children: [],
    };

    const addChildren = (parent: MapNode, blocks: BlockNode[], depth: number): void => {
      blocks.forEach((block) => {
        const label = blockLabel(block);
        if (label === "•" && block.children.length > 0) {
          // Bullet vacío: sus hijos suben un nivel para no dejar nodos fantasma.
          addChildren(parent, block.children, depth);
          return;
        }
        if (label === "•" && block.children.length === 0) return;

        const node: MapNode = {
          id: block.id,
          label,
          fullContent: block.content,
          depth,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          children: [],
        };
        parent.children.push(node);
        addChildren(node, block.children, depth + 1);
      });
    };

    addChildren(root, page.blocks, 1);
    return root;
  }

  private collect(node: MapNode): void {
    this.nodes.push(node);
    node.children.forEach((child) => {
      this.links.push({ source: node, target: child });
      this.collect(child);
    });
  }

  private measure(node: MapNode): void {
    const isRoot = node.depth === 0;
    const isLeaf = node.children.length === 0;
    this.ctx.font = isRoot ? ROOT_FONT : isLeaf ? LEAF_FONT : BRANCH_FONT;

    let label = node.label;
    const measured = this.ctx.measureText(label).width;
    if (measured > MAX_TEXT_WIDTH) {
      const ratio = MAX_TEXT_WIDTH / measured;
      label = `${label.slice(0, Math.max(3, Math.floor(label.length * ratio) - 1)).trimEnd()}…`;
    }
    node.label = label;

    const textWidth = Math.min(this.ctx.measureText(label).width, MAX_TEXT_WIDTH);
    node.width = Math.ceil(textWidth + PAD_X * 2 + (isRoot ? 8 : 0));
    node.height = isRoot ? ROOT_HEIGHT : NODE_HEIGHT;
  }

  private layout(root: MapNode): void {
    const columnWidths: number[] = [];
    for (const node of this.nodes) {
      columnWidths[node.depth] = Math.max(columnWidths[node.depth] || 0, node.width);
    }

    const columnX: number[] = [];
    let cursorX = 0;
    columnWidths.forEach((width, depth) => {
      columnX[depth] = cursorX;
      cursorX += width + H_GAP;
    });

    let cursorY = 0;
    const place = (node: MapNode): void => {
      if (node.children.length === 0) {
        node.y = cursorY;
        cursorY += node.height + V_GAP;
      } else {
        node.children.forEach(place);
        const first = node.children[0];
        const last = node.children[node.children.length - 1];
        node.y = (first.y + last.y) / 2;
      }
      node.x = columnX[node.depth];
    };
    place(root);

    // Centrar padres puede hacer que dos nodos de la misma columna compartan
    // altura. Los separamos por profundidad (columnas distintas no se solapan).
    const byDepth = new Map<number, MapNode[]>();
    for (const node of this.nodes) {
      const column = byDepth.get(node.depth);
      if (column) column.push(node);
      else byDepth.set(node.depth, [node]);
    }
    byDepth.forEach((column) => {
      column.sort((a, b) => a.y - b.y);
      let previousBottom = -Infinity;
      for (const node of column) {
        if (node.y < previousBottom + V_GAP) node.y = previousBottom + V_GAP;
        previousBottom = node.y + node.height;
      }
    });
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, this.wrap.clientWidth);
    const height = Math.max(1, this.wrap.clientHeight);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private zoomAt(screenX: number, screenY: number, factor: number): void {
    const next = Math.max(0.08, Math.min(4, this.scale * factor));
    const worldX = (screenX - this.offsetX) / this.scale;
    const worldY = (screenY - this.offsetY) / this.scale;
    this.scale = next;
    this.offsetX = screenX - worldX * this.scale;
    this.offsetY = screenY - worldY * this.scale;
    this.render();
  }

  private render(): void {
    if (!this.root || this.nodes.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.offsetX, dpr * this.offsetY);

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--ls-accent").trim() || "#61afef";
    const accentForeground = styles.getPropertyValue("--ls-accent-foreground").trim() || "#17202a";
    const textColor = styles.getPropertyValue("--ls-text-primary").trim() || "#abb2bf";
    const borderColor = styles.getPropertyValue("--ls-border-color").trim() || "#353b45";
    const surfaceColor = styles.getPropertyValue("--ls-bg-secondary").trim() || "#21252b";

    // Conexiones.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = accent;
    for (const link of this.links) {
      const x1 = link.source.x + link.source.width;
      const y1 = link.source.y + link.source.height / 2;
      const x2 = link.target.x;
      const y2 = link.target.y + link.target.height / 2;
      const midX = (x1 + x2) / 2;

      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Nodos.
    for (const node of this.nodes) {
      const isRoot = node.depth === 0;
      this.roundRect(node.x, node.y, node.width, node.height, isRoot ? 10 : 8);

      if (isRoot) {
        ctx.fillStyle = accent;
        ctx.fill();
      } else {
        ctx.fillStyle = surfaceColor;
        ctx.fill();
        ctx.strokeStyle = node.depth === 1 ? accent : borderColor;
        ctx.lineWidth = node.depth === 1 ? 1.5 : 1;
        ctx.stroke();
      }

      ctx.font = isRoot ? ROOT_FONT : node.children.length === 0 ? LEAF_FONT : BRANCH_FONT;
      ctx.fillStyle = isRoot ? accentForeground : textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x + PAD_X, node.y + node.height / 2 + 0.5);
    }
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  private setupEvents(): void {
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY < 0 ? 1.12 : 1 / 1.12
      );
    }, { passive: false });

    let pointerDown = false;
    let pointerMoved = false;
    const endPan = (): void => {
      if (!pointerDown) return;
      pointerDown = false;
      this.panning = false;
      if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId)) {
        this.canvas.releasePointerCapture(this.pointerId);
      }
      this.pointerId = null;
      this.canvas.classList.remove("is-panning");
      pointerMoved = false;
    };
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pointerDown = true;
      pointerMoved = false;
      this.pointerId = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.panStart = {
        x: event.clientX,
        y: event.clientY,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
      };
      this.clickStart = { x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!pointerDown) return;
      const dx = Math.abs(event.clientX - this.panStart.x);
      const dy = Math.abs(event.clientY - this.panStart.y);
      if (dx > CLICK_TOLERANCE || dy > CLICK_TOLERANCE) {
        pointerMoved = true;
        this.panning = true;
        this.canvas.classList.add("is-panning");
      }
      if (this.panning) {
        this.offsetX = this.panStart.offsetX + (event.clientX - this.panStart.x);
        this.offsetY = this.panStart.offsetY + (event.clientY - this.panStart.y);
        this.render();
      }
    });
    this.canvas.addEventListener("pointerup", (event) => {
      const wasPan = this.panning;
      endPan();
      // Un clic puro (sin arrastre) sobre un nodo expande su contenido completo.
      if (!wasPan && !pointerMoved && this.onNodeClick) {
        const dx = Math.abs(event.clientX - this.clickStart.x);
        const dy = Math.abs(event.clientY - this.clickStart.y);
        if (dx <= CLICK_TOLERANCE && dy <= CLICK_TOLERANCE) {
          const rect = this.canvas.getBoundingClientRect();
          const worldX = (event.clientX - rect.left - this.offsetX) / this.scale;
          const worldY = (event.clientY - rect.top - this.offsetY) / this.scale;
          const node = this.hitTestNode(worldX, worldY);
          if (node && node.id !== "root") {
            this.onNodeClick(node.id, node.fullContent);
          }
        }
      }
    });
    this.canvas.addEventListener("pointercancel", endPan);

    this.canvas.addEventListener("dblclick", () => this.fit());

    window.addEventListener("resize", () => {
      if (this.canvas.hidden) return;
      this.resize();
      this.fit();
    });
  }
}
