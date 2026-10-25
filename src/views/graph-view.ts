import { GraphNode, GraphLink, PageData } from "../types";
import {
  physicsStep,
  shouldStopSimulation,
  computeRevealOrder,
  computeInitialPosition,
  PhysicsConfig,
} from "./graph-physics";
import {
  colorForPage,
  defaultGraphSettings,
  loadGraphSettings,
  normalizeGraphSettings,
  toPhysicsConfig,
  type GraphSettings,
} from "./graph-settings";
import { labelAlphaForZoom } from "./graph-labels";

const GRAPH_COLOR_PALETTE = ["#ef4444", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899", "#06b6d4", "#64748b"];

export { GRAPH_COLOR_PALETTE };

/** La física corre a 30 Hz; el render sigue el ritmo de las interacciones. */
const PHYSICS_INTERVAL_MS = 1000 / 30;

interface RevealBatch {
  nodes: GraphNode[];
  startTime: number;
}

export class GraphView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: GraphNode[] = [];
  private links: GraphLink[] = [];
  private allNodes: GraphNode[] = [];
  private allLinks: GraphLink[] = [];
  private revealOrder: GraphNode[] = [];
  private revealBatches: RevealBatch[] = [];
  private currentBatchIndex = 0;
  private loadedTitles = new Set<string>();
  private revealBatchSize = 30; // 20-40 nodos por fotograma
  private revealDuration = 800; // 600-1000ms total
  private nodeColors = new Map<string, string>();
  private alpha = 1.0;
  private animationFrameId: number | null = null;
  private hoveredNode: GraphNode | null = null;
  private draggedNode: GraphNode | null = null;
  private pressedNode: GraphNode | null = null;
  private selectedNode: GraphNode | null = null;
  private onNodeSelectCallback: (pageTitle: string) => void;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private marquee: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private pointerStart: { x: number; y: number } | null = null;
  private suppressClick = false;
  private nodeDragMoved = false;
  private simulationRunning = false;
  private simulationSteps = 0;
  private lastPhysicsAt = 0;
  private isVisible = true;
  private prefersReducedMotion = false;
  private dpr = 1;

  // Índices O(1) para evitar búsquedas lineales
  private nodesByTitle = new Map<string, GraphNode>();
  private linksBySource = new Map<string, GraphLink[]>();
  private linksByTarget = new Map<string, GraphLink[]>();

  // Debounce para recoloreo
  private colorDebounce: number | null = null;
  private revealTimeouts: number[] = [];
  private renderNodeMap = new Map<string, GraphNode>();

  // Bucle de render unificado: pinta bajo demanda aunque la física esté parada
  private needsRender = false;
  private renderCount = 0;

  // Configuración de física, tamaño y colores
  private settings: GraphSettings = loadGraphSettings();
  private physicsConfig: PhysicsConfig = toPhysicsConfig(this.settings);

  constructor(
    canvasId: string,
    onNodeSelect: (pageTitle: string) => void
  ) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.onNodeSelectCallback = onNodeSelect;

    this.dpr = window.devicePixelRatio || 1;
    this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      const stored = localStorage.getItem("sinnotas-graph-node-colors");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        Object.entries(parsed).forEach(([title, color]) => this.nodeColors.set(title, color));
      }
    } catch {
      // ignore
    }

    const themeObserver = new MutationObserver(() => this.recomputeColors());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    // Observer para prefers-reduced-motion
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", (e) => {
      this.prefersReducedMotion = e.matches;
      if (this.prefersReducedMotion && this.simulationRunning) {
        this.stopSimulation();
        this.settleImmediately();
      } else if (!this.prefersReducedMotion && !this.simulationRunning && this.nodes.length > 0) {
        this.startSimulation();
      }
    });

    // Visibilidad de la página/tab
    document.addEventListener("visibilitychange", () => {
      this.isVisible = !document.hidden;
      if (!this.isVisible) {
        this.stopSimulation();
      } else if (this.shouldSimulate()) {
        this.startSimulation();
      }
    });

    // IntersectionObserver para detectar si el canvas sale de viewport
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isVisible = entry.isIntersecting;
        if (!this.isVisible) {
          this.stopSimulation();
        } else if (this.shouldSimulate()) {
          this.startSimulation();
        }
      }
    }, { threshold: 0.01 });
    observer.observe(this.canvas);

    this.setupEvents();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private shouldSimulate(): boolean {
    return (
      this.isVisible &&
      !this.prefersReducedMotion &&
      this.simulationSteps < this.physicsConfig.maxSteps &&
      this.alpha > this.physicsConfig.alphaMin
    );
  }

  public resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    this.requestRender();
  }

  public zoomIn(): void {
    this.zoomAt(this.canvas.width / 2 / this.dpr, this.canvas.height / 2 / this.dpr, 1.2);
    this.requestRender();
  }

  public zoomOut(): void {
    this.zoomAt(this.canvas.width / 2 / this.dpr, this.canvas.height / 2 / this.dpr, 1 / 1.2);
    this.requestRender();
  }

  public resetView(): void {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.requestRender();
  }

  public resetInteraction(): void {
    this.hoveredNode = null;
    this.draggedNode = null;
    this.pressedNode = null;
    this.nodeDragMoved = false;
    this.suppressClick = false;
    this.marquee = null;
    this.pointerStart = null;
    this.canvas.style.cursor = "default";
  }

  public selectNode(title: string | null): void {
    this.selectedNode = title ? this.nodesByTitle.get(title) ?? null : null;
    this.requestRender();
  }

  /* ===== Getters de depuración/pruebas ===== */
  public getSelected(): string | null { return this.selectedNode?.title ?? null; }
  public getScale(): number { return this.scale; }
  public getOffset(): { x: number; y: number } { return { x: this.offsetX, y: this.offsetY }; }
  public isSimulating(): boolean { return this.simulationRunning; }
  public getRenderCount(): number { return this.renderCount; }
  public getNodePosition(title: string): { x: number; y: number } | null {
    const n = this.nodesByTitle.get(title);
    return n ? { x: n.x, y: n.y } : null;
  }
  public getNodeColorComputed(title: string): string | null {
    return this.nodesByTitle.get(title)?.computedColor ?? null;
  }

  public updateData(pages: PageData[]) {
    const width = (this.canvas.width || 800) / this.dpr;
    const height = (this.canvas.height || 600) / this.dpr;

    this.links = [];
    this.allLinks = [];
    this.linksBySource.clear();
    this.linksByTarget.clear();
    const linkMap = new Map<string, number>();

    // Pre-build title set for O(1) existence check
    const pageTitles = new Set(pages.map(p => p.title));

    pages.forEach((p) => {
      const content = JSON.stringify(p.blocks);
      const matches = content.match(/\[\[(.*?)\]\]/g);
      if (matches) {
        matches.forEach((m) => {
          const targetTitle = m.slice(2, -2);
          if (pageTitles.has(targetTitle)) {
            const link = { source: p.title, target: targetTitle };
            this.allLinks.push(link);
            // Build adjacency indexes
            let srcArr = this.linksBySource.get(p.title);
            if (!srcArr) { srcArr = []; this.linksBySource.set(p.title, srcArr); }
            srcArr.push(link);
            let tgtArr = this.linksByTarget.get(targetTitle);
            if (!tgtArr) { tgtArr = []; this.linksByTarget.set(targetTitle, tgtArr); }
            tgtArr.push(link);
            linkMap.set(p.title, (linkMap.get(p.title) || 0) + 1);
            linkMap.set(targetTitle, (linkMap.get(targetTitle) || 0) + 1);
          }
        });
      }
    });

    const existingNodeMap = new Map<string, GraphNode>();
    this.nodes.forEach((n) => existingNodeMap.set(n.title, n));
    const selectedTitle = this.selectedNode?.title ?? null;
    this.hoveredNode = null;

    // Crear todos los nodos con posiciones iniciales (se ajustarán en revelación)
    this.allNodes = pages.map((p, idx) => {
      const existing = existingNodeMap.get(p.title);
      const connections = linkMap.get(p.title) || 0;

      // Posición inicial temporal - se recalculará en revelación gradual
      let x: number, y: number;
      if (existing) {
        x = existing.x;
        y = existing.y;
      } else {
        const angle = (idx / Math.max(1, pages.length)) * Math.PI * 2;
        const radiusDist = 220 + Math.random() * 160;
        x = width / 2 + Math.cos(angle) * radiusDist;
        y = height / 2 + Math.sin(angle) * radiusDist;
      }

      return {
        id: p.id,
        title: p.title,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius: this.radiusFor(connections),
        isJournal: !!p.isJournal,
        connectionsCount: connections,
        baseColor: this.baseColorFor(p.title),
        computedColor: undefined,
      };
    });

    // Build node index
    this.nodesByTitle.clear();
    this.allNodes.forEach(n => this.nodesByTitle.set(n.title, n));

    this.selectedNode = selectedTitle
      ? this.nodesByTitle.get(selectedTitle) ?? null
      : null;

    // Calcular orden de revelación (más conectados primero, vecindad)
    this.revealOrder = computeRevealOrder(this.allNodes, this.allLinks);

    // Preparar batches de revelación gradual
    this.prepareRevealBatches(width, height);

    // Reset estado
    this.nodes = [];
    this.links = [];
    this.loadedTitles.clear();
    this.currentBatchIndex = 0;
    this.resetInteraction();
    this.clearRevealTimeouts();

    if (this.prefersReducedMotion) {
      this.stopSimulation();
      this.settleImmediately();
    } else {
      this.alpha = 1.0;
      this.simulationSteps = 0;
      this.lastPhysicsAt = 0;
      this.startSimulation();
      this.scheduleNextRevealBatch();
    }
  }

  private prepareRevealBatches(width: number, height: number) {
    this.revealBatches = [];
    const totalNodes = this.revealOrder.length;
    const batchCount = Math.max(1, Math.ceil(totalNodes / this.revealBatchSize));
    const batchDuration = this.revealDuration / batchCount;

    for (let i = 0; i < totalNodes; i += this.revealBatchSize) {
      const batchNodes = this.revealOrder.slice(i, i + this.revealBatchSize);
      // Calcular posición inicial para cada nodo del batch
      batchNodes.forEach(node => {
        const pos = computeInitialPosition(node, this.nodes, this.allLinks, width, height);
        node.x = pos.x;
        node.y = pos.y;
        node.vx = (Math.random() - 0.5) * 0.5;
        node.vy = (Math.random() - 0.5) * 0.5;
      });
      this.revealBatches.push({
        nodes: batchNodes,
        startTime: performance.now() + (this.revealBatches.length * batchDuration),
      });
    }
  }

  private scheduleNextRevealBatch() {
    if (this.currentBatchIndex >= this.revealBatches.length) return;

    const batch = this.revealBatches[this.currentBatchIndex];
    const delay = Math.max(0, batch.startTime - performance.now());

    const id = window.setTimeout(() => this.revealBatch(), delay);
    this.revealTimeouts.push(id);
  }

  private clearRevealTimeouts() {
    this.revealTimeouts.forEach(id => clearTimeout(id));
    this.revealTimeouts = [];
    if (this.colorDebounce) {
      clearTimeout(this.colorDebounce);
      this.colorDebounce = null;
    }
  }

  private revealBatch() {
    if (this.currentBatchIndex >= this.revealBatches.length) return;

    const batch = this.revealBatches[this.currentBatchIndex];
    batch.nodes.forEach((n) => {
      this.nodes.push(n);
      this.loadedTitles.add(n.title);
    });

    // Recalcular los enlaces cargados en lugar de acumularlos: recorrer
    // `allLinks` y hacer push en cada lote volvía a añadir los enlaces ya
    // presentes y multiplicaba el grafo (4.000 enlaces → 70.000+ tras 34
    // lotes), encareciendo física y render sin aportar nada.
    this.links = this.allLinks.filter(
      (link) => this.loadedTitles.has(link.source) && this.loadedTitles.has(link.target)
    );

    this.currentBatchIndex++;
    this.scheduleNextRevealBatch();

    if (this.currentBatchIndex >= this.revealBatches.length) {
      this.recomputeColors();
    }
  }

  private wakeSimulation(kick = 0.25) {
    if (!this.isVisible || this.prefersReducedMotion) return;
    // Cada interacción renueva el presupuesto de pasos, pero sin volver a
    // arrancar una física agresiva desde cero.
    this.simulationSteps = 0;
    if (!this.simulationRunning) {
      // Re-energizar la física: tras estabilizarse alpha queda en alphaMin y
      // `shouldSimulate()` sería falso, dejando drag/selección sin reacción.
      this.alpha = Math.max(this.alpha, kick);
      this.lastPhysicsAt = 0;
      this.startSimulation();
    }
  }

  /**
   * Bucle unificado de física + render. La simulación puede apagarse (alpha en
   * mínimo o presupuesto agotado) pero el render SIEMPRE puede repintar bajo
   * demanda mediante `requestRender()`. Antes, al detenerse la física moría
   * también el render y el lienzo quedaba congelado: zoom, pan, hover y
   * selección dejaban de responder visualmente.
   *
   * La física avanza como máximo a 30 Hz; el render solo se repinta cuando hubo
   * un paso de física o cuando una interacción lo pidió. Con 1.500 nodos eso
   * reduce a la mitad el trabajo por segundo sin perder fluidez de gestos.
   */
  private frame = (now: number) => {
    this.animationFrameId = null;
    let simulated = false;

    if (this.simulationRunning) {
      const elapsed = now - this.lastPhysicsAt;
      if (this.lastPhysicsAt === 0 || elapsed >= PHYSICS_INTERVAL_MS) {
        this.lastPhysicsAt = now;
        try {
          this.simulateForces();
          simulated = true;
        } catch (err) {
          // Un error de física no debe matar el bucle para siempre.
          console.error("[graph] physics step failed", err);
          this.simulationRunning = false;
        }
      }
    }

    if (simulated || this.needsRender) {
      try {
        this.render();
        this.renderCount++;
      } catch (err) {
        console.error("[graph] render failed", err);
      }
      this.needsRender = false;
    }
    if (this.simulationRunning || this.needsRender) {
      this.animationFrameId = requestAnimationFrame(this.frame);
    }
  };

  private requestRender(): void {
    this.needsRender = true;
    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this.frame);
    }
  }

  public startSimulation() {
    if (this.simulationRunning) return;
    this.simulationRunning = true;
    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this.frame);
    }
  }

  public stopSimulation() {
    this.simulationRunning = false;
    // Garantiza un último repintado con el estado final asentado.
    this.requestRender();
  }

  private settleImmediately() {
    // Calcular layout final sin animación (para prefers-reduced-motion)
    // Ejecutar varios pasos de física con alpha=alphaMin hasta estabilizar
    const tempNodes = this.allNodes.map(n => ({ ...n }));
    const tempLinks = [...this.allLinks];
    let tempAlpha = this.physicsConfig.alphaMin;

    const state = {
      nodes: tempNodes,
      links: tempLinks,
      alpha: tempAlpha,
      config: this.physicsConfig,
      width: this.canvas.width / this.dpr,
      height: this.canvas.height / this.dpr,
      draggedNode: null as GraphNode | null,
    };

    // Ejecutar hasta que la energía sea muy baja, con tope duro de pasos.
    for (let i = 0; i < this.physicsConfig.maxSteps; i++) {
      const result = physicsStep(state);
      state.alpha = result.alpha;
      if (result.energy < 0.01) break;
    }

    // Copiar posiciones finales a nodos reales
    const finalPos = new Map<string, { x: number; y: number }>();
    tempNodes.forEach(n => finalPos.set(n.title, { x: n.x, y: n.y }));

    this.allNodes.forEach(n => {
      const pos = finalPos.get(n.title);
      if (pos) { n.x = pos.x; n.y = pos.y; }
    });
    this.nodes = [...this.allNodes];
    this.links = [...this.allLinks];
    this.loadedTitles = new Set(this.allNodes.map(n => n.title));
    this.currentBatchIndex = this.revealBatches.length;
    this.recomputeColors();
    this.render();
  }

  private simulateForces() {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    const state = {
      nodes: this.nodes,
      links: this.links,
      alpha: this.alpha,
      config: this.physicsConfig,
      width,
      height,
      draggedNode: this.draggedNode,
    };

    const result = physicsStep(state);
    this.alpha = result.alpha;
    this.simulationSteps += 1;

    // Detener simulación al agotar alpha o el presupuesto duro de pasos.
    // Mientras se arrastra un nodo no se duerme: el gesto debe seguir vivo.
    if (
      !this.draggedNode &&
      shouldStopSimulation(this.alpha, result.energy, this.physicsConfig, this.simulationSteps)
    ) {
      this.stopSimulation();
    }
  }

  private screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale,
    };
  }

  private zoomAt(screenX: number, screenY: number, factor: number): void {
    const next = Math.max(0.25, Math.min(8, this.scale * factor));
    const world = this.screenToWorld(screenX, screenY);
    this.scale = next;
    this.offsetX = screenX - world.x * this.scale;
    this.offsetY = screenY - world.y * this.scale;
  }

  private zoomToRect(x1: number, y1: number, x2: number, y2: number): void {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const width = Math.max(24, right - left);
    const height = Math.max(24, bottom - top);
    const worldA = this.screenToWorld(left, top);
    const worldB = this.screenToWorld(right, bottom);
    const worldWidth = Math.max(1, worldB.x - worldA.x);
    const worldHeight = Math.max(1, worldB.y - worldA.y);
    const nextScale = Math.max(
      0.25,
      Math.min(8, Math.min(this.canvas.width / worldWidth, this.canvas.height / worldHeight) * 0.9)
    );
    const centerX = (worldA.x + worldB.x) / 2;
    const centerY = (worldA.y + worldB.y) / 2;
    this.scale = nextScale;
    this.offsetX = this.canvas.width / 2 / this.dpr - centerX * this.scale;
    this.offsetY = this.canvas.height / 2 / this.dpr - centerY * this.scale;
    void width;
    void height;
  }

  public setNodeColor(title: string, color: string | null) {
    if (color === null) this.nodeColors.delete(title);
    else this.nodeColors.set(title, color);
    try {
      localStorage.setItem("sinnotas-graph-node-colors", JSON.stringify(Object.fromEntries(this.nodeColors)));
    } catch {
      // ignore
    }
    // Si no hay color manual, puede aplicar una regla de grupo por nombre.
    this.allNodes.forEach((node) => {
      if (node.title === title) node.baseColor = this.baseColorFor(title);
    });
    // Debounce recoloreo
    if (this.colorDebounce) clearTimeout(this.colorDebounce);
    this.colorDebounce = window.setTimeout(() => this.recomputeColors(), 50);
  }

  public getNodeColor(title: string): string | null {
    return this.nodeColors.get(title) ?? null;
  }

  public getColorPalette(): string[] {
    return GRAPH_COLOR_PALETTE;
  }

  /** Devuelve una copia de los ajustes activos del grafo. */
  public getSettings(): GraphSettings {
    return {
      ...this.settings,
      colorRules: this.settings.colorRules.map((rule) => ({ ...rule })),
      physics: { ...this.settings.physics },
    };
  }

  /**
   * Aplica ajustes en vivo. Solo recalcula lo que cambió: mover un slider de
   * fuerzas no debe recorrer el grafo entero para recalcular colores.
   */
  public applySettings(settings: GraphSettings): void {
    const previous = this.settings;
    const next = normalizeGraphSettings(settings);
    const colorsChanged =
      JSON.stringify(previous.colorRules) !== JSON.stringify(next.colorRules);
    const radiiChanged =
      previous.nodeBaseRadius !== next.nodeBaseRadius ||
      previous.nodePerConnectionRadius !== next.nodePerConnectionRadius ||
      previous.nodeMaxRadius !== next.nodeMaxRadius;
    const physicsChanged =
      JSON.stringify(previous.physics) !== JSON.stringify(next.physics) ||
      previous.nodeBaseRadius !== next.nodeBaseRadius;
    const visualChanged =
      previous.linkWidth !== next.linkWidth ||
      previous.linkHighlightWidth !== next.linkHighlightWidth ||
      previous.labelZoomThreshold !== next.labelZoomThreshold;

    this.settings = next;
    this.physicsConfig = toPhysicsConfig(next);

    if (radiiChanged) this.applyNodeRadii();
    if (colorsChanged) {
      this.applyBaseColors();
      this.recomputeColors();
    } else if (radiiChanged || visualChanged) {
      this.requestRender();
    }

    if (physicsChanged && this.nodes.length > 0) {
      this.wakeSimulation(0.3);
    }
  }

  /** Restaura los valores por defecto del grafo. */
  public resetSettings(): void {
    this.applySettings(defaultGraphSettings());
  }

  private radiusFor(connections: number): number {
    return Math.max(
      2,
      Math.min(
        this.settings.nodeMaxRadius,
        this.settings.nodeBaseRadius + connections * this.settings.nodePerConnectionRadius
      )
    );
  }

  private baseColorFor(title: string): string | null {
    return this.nodeColors.get(title) ?? colorForPage(title, this.settings.colorRules);
  }

  private applyNodeRadii(): void {
    this.allNodes.forEach((node) => {
      node.radius = this.radiusFor(node.connectionsCount);
    });
  }

  private applyBaseColors(): void {
    this.allNodes.forEach((node) => {
      node.baseColor = this.baseColorFor(node.title);
    });
  }

  private recomputeColors() {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const neutralFor = (node: GraphNode) =>
      node.isJournal ? (isLight ? "#b45309" : "#e5c07b") : (isLight ? "#2563eb" : "#61afef");

    // factores precalculados por distancia (lista fija, no se calculan en vivo)
    const LEVEL_FACTORS = [1, 0.5, 0.25, 0.125];

    const toRgb = (hex: string) => {
      const h = hex.replace("#", "");
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    };
    const toHex = (r: number, g: number, b: number) =>
      "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

    // influencia acumulada por nodo: mapa title -> {r,g,b,w}
    const influence = new Map<string, { r: number; g: number; b: number; w: number }>();
    this.allNodes.forEach((n) => influence.set(n.title, { r: 0, g: 0, b: 0, w: 0 }));

    // Solo los colores manuales se propagan a los vecinos. Los grupos por
    // nombre pintan exactamente los nodos que coinciden, sin teñir medio grafo.
    const coloredSources = this.allNodes.filter((n) => this.nodeColors.has(n.title));

    coloredSources.forEach((source) => {
      const color = toRgb(source.baseColor!);
      // BFS con cola circular (evita shift O(n))
      const visited = new Set<string>([source.title]);
      const queue: { title: string; depth: number }[] = [{ title: source.title, depth: 0 }];
      let qHead = 0;
      // aplicar al propio nodo (factor 1)
      const selfInf = influence.get(source.title)!;
      selfInf.r += color.r * LEVEL_FACTORS[0];
      selfInf.g += color.g * LEVEL_FACTORS[0];
      selfInf.b += color.b * LEVEL_FACTORS[0];
      selfInf.w += LEVEL_FACTORS[0];

      while (qHead < queue.length) {
        const { title, depth } = queue[qHead++];
        if (depth >= LEVEL_FACTORS.length - 1) continue;
        // Usar índice O(1) en lugar de find
        const node = this.nodesByTitle.get(title);
        if (!node) continue;
        // Vecinos via índices O(grado) en lugar de filter O(links)
        const neighbors: string[] = [];
        const outLinks = this.linksBySource.get(title);
        if (outLinks) outLinks.forEach(l => neighbors.push(l.target));
        const inLinks = this.linksByTarget.get(title);
        if (inLinks) inLinks.forEach(l => neighbors.push(l.source));

        neighbors.forEach((nb) => {
          if (visited.has(nb)) return;
          visited.add(nb);
          const factor = LEVEL_FACTORS[depth + 1];
          const inf = influence.get(nb);
          if (inf) {
            inf.r += color.r * factor;
            inf.g += color.g * factor;
            inf.b += color.b * factor;
            inf.w += factor;
          }
          queue.push({ title: nb, depth: depth + 1 });
        });
      }
    });

    // color final - usar índice para sync
    this.allNodes.forEach((node) => {
      const inf = influence.get(node.title)!;
      if (node.baseColor) {
        node.computedColor = node.baseColor;
      } else if (inf.w > 0) {
        const neutral = toRgb(neutralFor(node));
        const totalW = Math.min(1, inf.w);
        const r = neutral.r * (1 - totalW) + inf.r;
        const g = neutral.g * (1 - totalW) + inf.g;
        const b = neutral.b * (1 - totalW) + inf.b;
        node.computedColor = toHex(r, g, b);
      } else {
        node.computedColor = neutralFor(node);
      }
      // sync to loaded nodes via index
      const loaded = this.nodesByTitle.get(node.title);
      if (loaded) {
        loaded.baseColor = node.baseColor;
        loaded.computedColor = node.computedColor;
      }
    });
    // Forzar repintado aunque la simulación esté parada
    this.requestRender();
  }

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.offsetX * this.dpr, this.offsetY * this.dpr);

    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const lineColor = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
    const lineHighlight = isLight ? "#2563eb" : "#61afef";
    const textColor = isLight ? "#1f2937" : "#e5e9f0";

    // Cache node map for O(1) link rendering
    this.renderNodeMap.clear();
    this.nodes.forEach(n => this.renderNodeMap.set(n.title, n));

    // Todos los enlaces normales en un único path: antes se hacía un
    // beginPath/stroke por enlace (4.500 draws con el vault real).
    const highlighted: GraphLink[] = [];
    ctx.beginPath();
    this.links.forEach((link) => {
      const source = this.renderNodeMap.get(link.source);
      const target = this.renderNodeMap.get(link.target);
      if (!source || !target) return;
      if (
        this.hoveredNode &&
        (this.hoveredNode.title === source.title || this.hoveredNode.title === target.title)
      ) {
        highlighted.push(link);
        return;
      }
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = this.settings.linkWidth;
    ctx.stroke();

    if (highlighted.length > 0) {
      ctx.beginPath();
      highlighted.forEach((link) => {
        const source = this.renderNodeMap.get(link.source);
        const target = this.renderNodeMap.get(link.target);
        if (!source || !target) return;
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
      });
      ctx.strokeStyle = lineHighlight;
      ctx.lineWidth = this.settings.linkHighlightWidth;
      ctx.stroke();
    }

    const viewWidth = this.canvas.width / this.dpr;
    const viewHeight = this.canvas.height / this.dpr;
    const margin = 60;
    const minX = (-this.offsetX - margin) / this.scale;
    const maxX = (viewWidth - this.offsetX + margin) / this.scale;
    const minY = (-this.offsetY - margin) / this.scale;
    const maxY = (viewHeight - this.offsetY + margin) / this.scale;

    // Las etiquetas aparecen con fundido al acercar (umbral de zoom real, ver
    // graph-labels.ts); el hover y la selección siempre las muestran nítidas.
    // La fuente se escala inversamente para que tengan tamaño fijo en pantalla.
    const labelAlpha = labelAlphaForZoom(this.scale, this.settings.labelZoomThreshold);
    ctx.textAlign = "center";

    this.nodes.forEach((node) => {
      if (node.x < minX || node.x > maxX || node.y < minY || node.y > maxY) return;
      const isHovered = this.hoveredNode === node;
      const isSelected = this.selectedNode === node;
      const isJournal = node.isJournal;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = lineHighlight;
        ctx.lineWidth = this.settings.linkHighlightWidth;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);

      const nodeColor = node.computedColor || (isJournal ? (isLight ? "#f59e0b" : "#e5c07b") : (isLight ? "#2563eb" : "#61afef"));
      ctx.fillStyle = nodeColor;

      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Etiqueta: hover y selección siempre visibles (alpha 1, fuente mayor);
      // el resto hace fundido con labelAlpha y se salta si es 0. El fillStyle
      // se reasigna aquí porque pintar el círculo lo cambió por nodeColor.
      const emphasized = isHovered || isSelected;
      if (emphasized || labelAlpha > 0) {
        ctx.fillStyle = textColor;
        ctx.font = emphasized
          ? `bold ${12 / this.scale}px Inter, sans-serif`
          : `${11 / this.scale}px Inter, sans-serif`;
        if (!emphasized) ctx.globalAlpha = labelAlpha;
        ctx.fillText(node.title, node.x, node.y + node.radius + 10 / this.scale);
        if (!emphasized) ctx.globalAlpha = 1;
      }
    });

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.marquee) {
      const left = Math.min(this.marquee.x1, this.marquee.x2);
      const top = Math.min(this.marquee.y1, this.marquee.y2);
      const width = Math.abs(this.marquee.x2 - this.marquee.x1);
      const height = Math.abs(this.marquee.y2 - this.marquee.y1);
      ctx.fillStyle = "rgba(97, 175, 239, 0.12)";
      ctx.strokeStyle = "#61afef";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(left, top, width, height);
      ctx.strokeRect(left, top, width, height);
      ctx.setLineDash([]);
    }
  }

  private nodeAt(screenX: number, screenY: number): GraphNode | undefined {
    const world = this.screenToWorld(screenX, screenY);
    return this.nodes.find((n) => {
      const dx = n.x - world.x;
      const dy = n.y - world.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5 / this.scale;
    });
  }

  private setupEvents() {
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
      // Zoom puramente transformacional (como Obsidian): no reinicia física.
      this.requestRender();
    }, { passive: false });

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.marquee) {
        this.marquee.x2 = x;
        this.marquee.y2 = y;
        this.canvas.style.cursor = "crosshair";
        this.requestRender();
        return;
      }

      if (this.draggedNode) {
        if (!this.nodeDragMoved) {
          const start = this.pointerStart;
          const travelled = start ? Math.hypot(x - start.x, y - start.y) : 0;
          if (travelled < 3) return;
          this.nodeDragMoved = true;
          this.suppressClick = true;
        }
        const world = this.screenToWorld(x, y);
        this.draggedNode.x = world.x;
        this.draggedNode.y = world.y;
        this.wakeSimulation(0.12);
        this.requestRender();
        return;
      }

      const found = this.nodeAt(x, y);
      const hoveredChanged = (found || null) !== this.hoveredNode;
      this.hoveredNode = found || null;
      this.canvas.style.cursor = found ? "pointer" : ((e.buttons & 4) || (e.buttons & 2) ? "grabbing" : "default");
      if (hoveredChanged) this.requestRender();
    });

    this.canvas.addEventListener("mousedown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (e.button === 1 || e.button === 2) {
        // Botón central o derecho se usan para desplazar el lienzo.
        this.pointerStart = { x, y };
        this.draggedNode = null;
        this.pressedNode = null;
        this.marquee = null;
        this.suppressClick = false;
        this.nodeDragMoved = false;
        this.canvas.style.cursor = "grabbing";
        if (e.button === 2) e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      this.pointerStart = { x, y };
      this.suppressClick = false;
      this.nodeDragMoved = false;
      this.marquee = null;

      const found = this.nodeAt(x, y);
      // Guardamos el nodo pulsado: entre mousedown y click la simulación puede
      // moverlo y un nuevo hit-test fallaría (o seleccionaría otro nodo).
      this.pressedNode = found || null;
      if (found) {
        this.hoveredNode = found;
        this.draggedNode = found;
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
        this.canvas.style.cursor = "grabbing";
        this.wakeSimulation();
        return;
      }

      this.hoveredNode = null;
      this.pressedNode = null;
      this.marquee = { x1: x, y1: y, x2: x, y2: y };
      this.canvas.style.cursor = "crosshair";
      this.requestRender();
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 1 || e.button === 2) {
        this.pointerStart = null;
        this.canvas.style.cursor = this.hoveredNode ? "pointer" : "default";
        return;
      }
      if (this.marquee) {
        const width = Math.abs(this.marquee.x2 - this.marquee.x1);
        const height = Math.abs(this.marquee.y2 - this.marquee.y1);
        if (width > 18 && height > 18) {
          const zoomingOut = this.marquee.x2 < this.marquee.x1;
          if (zoomingOut) this.zoomOut();
          else this.zoomToRect(this.marquee.x1, this.marquee.y1, this.marquee.x2, this.marquee.y2);
          this.suppressClick = true;
          this.requestRender();
        }
        this.marquee = null;
      }
      if (this.draggedNode) {
        this.draggedNode = null;
        this.nodeDragMoved = false;
        this.suppressClick = false;
        this.pressedNode = null;
        this.canvas.style.cursor = this.hoveredNode ? "pointer" : "default";
      } else if (this.nodeDragMoved) {
        this.nodeDragMoved = false;
        this.suppressClick = false;
        this.pressedNode = null;
      }
      this.pointerStart = null;
    });

    window.addEventListener("mousemove", (e) => {
      if ((e.buttons & 4) || (e.buttons & 2)) {
        if (this.pointerStart) {
          const rect = this.canvas.getBoundingClientRect();
          const dx = e.clientX - (rect.left + this.pointerStart.x);
          const dy = e.clientY - (rect.top + this.pointerStart.y);
          this.offsetX += dx;
          this.offsetY += dy;
          this.pointerStart.x = e.clientX - rect.left;
          this.pointerStart.y = e.clientY - rect.top;
          e.preventDefault();
          // El pan debe repintar aunque la simulación esté parada.
          this.requestRender();
        }
      }
    }, { passive: false });

    this.canvas.addEventListener("dblclick", (event) => {
      event.preventDefault();
      this.resetInteraction();
      this.resetView();
    });

    this.canvas.addEventListener("click", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      if (this.suppressClick) {
        // El clic tras un arrastre o marquee se descarta siempre; el gesto de
        // selección real no pasa por aquí (sin arrastre, suppressClick es false).
        this.suppressClick = false;
        this.pressedNode = null;
        return;
      }
      // Preferimos el nodo pulsado en mousedown; el hit-test en click puede
      // fallar si la simulación lo desplazó unos píxeles mientras tanto.
      const found = this.pressedNode ?? this.nodeAt(event.clientX - rect.left, event.clientY - rect.top);
      this.pressedNode = null;
      if (found) {
        this.onNodeSelectCallback(found.title);
        return;
      }
      try { (window as any).__graphClickBackground?.(); } catch {}
    });
  }
}