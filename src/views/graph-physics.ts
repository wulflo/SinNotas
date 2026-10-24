import { GraphNode, GraphLink } from "../types";

export interface PhysicsConfig {
  /** Fuerza de carga (repulsión) - negativo = repulsión, positivo = atracción */
  charge: number;
  /** Distancia máxima para la fuerza de carga (Infinity = sin límite) */
  chargeDistance: number;
  /** Fuerza de los enlaces (resorte) */
  linkStrength: number;
  /** Distancia objetivo de los enlaces */
  linkDistance: number;
  /** Fuerza de atracción al centro */
  centerStrength: number;
  /** Fuerza de colisión (evita solapamiento) */
  collisionStrength: number;
  /** Radio de colisión por nodo (mínimo) */
  minCollisionRadius: number;
  /** Amortiguación de velocidad (0.4-0.6 típico) */
  velocityDecay: number;
  /** Alpha inicial */
  alpha: number;
  /** Alpha mínimo */
  alphaMin: number;
  /** Factor de decaimiento de alpha */
  alphaDecay: number;
  /** Límite duro de pasos de física antes de detenerse */
  maxSteps: number;
  /** Límite de velocidad máximo por fotograma */
  maxVelocity: number;
  /** Umbral de nodos para usar Barnes-Hut */
  barnesHutThreshold: number;
  /** Theta para Barnes-Hut (0.5-0.9) */
  barnesHutTheta: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  charge: -600,           // Repulsión (negativo = se repelen); más fuerte al abrir
  chargeDistance: Infinity,
  linkStrength: 0.55,     // Fuerza del resorte (0-1)
  linkDistance: 100,      // Distancia objetivo entre nodos enlazados
  centerStrength: 0.006,  // Atracción al centro
  collisionStrength: 1,   // Fuerza de anti-colisión
  minCollisionRadius: 6,  // Radio mínimo de colisión (nodos pequeños)
  velocityDecay: 0.5,     // Amortiguación (D3 default = 0.4)
  alpha: 1,
  alphaMin: 0.001,
  alphaDecay: 0.04,       // ~170 pasos hasta alphaMin
  maxSteps: 600,          // tope duro (~20 s a 30 Hz) por si alpha no decae
  maxVelocity: 50,
  barnesHutThreshold: 200,
  barnesHutTheta: 0.8,
};

export interface PhysicsState {
  nodes: GraphNode[];
  links: GraphLink[];
  alpha: number;
  config: PhysicsConfig;
  width: number;
  height: number;
  draggedNode: GraphNode | null;
}

export interface PhysicsStepResult {
  nodes: GraphNode[];
  alpha: number;
  energy: number;
  maxVelocity: number;
}

/** Cuadrante para Barnes-Hut */
interface Quad {
  x: number;
  y: number;
  mass: number;
  charge: number;
  node: GraphNode | null;
  children: (Quad | null)[];
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/** Construye el quadtree para Barnes-Hut */
function buildQuadtree(nodes: GraphNode[], width: number, height: number): Quad {
  const root: Quad = {
    x: 0, y: 0, mass: 0, charge: 0, node: null,
    children: [null, null, null, null],
    xmin: 0, ymin: 0, xmax: width, ymax: height,
  };

  for (const node of nodes) {
    if (node.vx === 0 && node.vy === 0 && node.x === 0 && node.y === 0) continue;
    insertNode(root, node);
  }
  return root;
}

function insertNode(quad: Quad, node: GraphNode, depth = 0) {
  if (quad.node !== null) {
    // Subdividir
    const existing = quad.node;
    quad.node = null;

    insertNode(quad, existing, depth + 1);
    insertNode(quad, node, depth + 1);
    return;
  }

  if (quad.mass === 0) {
    // Cuadrante vacío - colocar nodo aquí
    quad.node = node;
    quad.mass = 1;
    quad.charge = 1; // todos los nodos tienen misma carga
    quad.x = node.x;
    quad.y = node.y;
    return;
  }

  // Protección anti-recursión infinita: dos nodos con coordenadas idénticas
  // caerían siempre en el mismo cuadrante y desbordarían la pila, matando el
  // bucle de física (freeze total del lienzo). Se funden como nodo agregado.
  if (depth > 32) {
    quad.mass += 1;
    quad.charge += 1;
    quad.x = (quad.x * (quad.mass - 1) + node.x) / quad.mass;
    quad.y = (quad.y * (quad.mass - 1) + node.y) / quad.mass;
    return;
  }

  // Cuadrante interno - actualizar centro de masa y subdividir
  const xmid = (quad.xmin + quad.xmax) / 2;
  const ymid = (quad.ymin + quad.ymax) / 2;

  const idx = (node.x >= xmid ? 1 : 0) + (node.y >= ymid ? 2 : 0);
  if (!quad.children[idx]) {
    const cxmin = idx & 1 ? xmid : quad.xmin;
    const cxmax = idx & 1 ? quad.xmax : xmid;
    const cymin = idx & 2 ? ymid : quad.ymin;
    const cymax = idx & 2 ? quad.ymax : ymid;
    quad.children[idx] = {
      x: 0, y: 0, mass: 0, charge: 0, node: null,
      children: [null, null, null, null],
      xmin: cxmin, ymin: cymin, xmax: cxmax, ymax: cymax,
    };
  }
  insertNode(quad.children[idx]!, node, depth + 1);

  // Actualizar centro de masa
  quad.mass += 1;
  quad.charge += 1;
  quad.x = (quad.x * (quad.mass - 1) + node.x) / quad.mass;
  quad.y = (quad.y * (quad.mass - 1) + node.y) / quad.mass;
}

/** Calcula la fuerza de Barnes-Hut sobre un nodo */
function applyBarnesHutForce(
  node: GraphNode,
  quad: Quad,
  charge: number,
  chargeDistance: number,
  theta: number,
  alpha: number
) {
  if (quad.mass === 0) return;
  if (quad.node === node) return;

  const dx = quad.x - node.x;
  const dy = quad.y - node.y;
  const distSq = dx * dx + dy * dy;

  if (distSq === 0) return;

  // Si es hoja o ratio tamaño/distancia < theta, aplicar fuerza
  const quadSize = Math.max(quad.xmax - quad.xmin, quad.ymax - quad.ymin);
  if (quad.node !== null || (quadSize * quadSize) / distSq < theta * theta) {
    if (chargeDistance !== Infinity && distSq > chargeDistance * chargeDistance) return;
    const dist = Math.sqrt(distSq);
    // Fuerza de Coulomb: k * q1 * q2 / r^2
    const force = (charge * quad.charge) / distSq * alpha;
    node.vx += (dx / dist) * force;
    node.vy += (dy / dist) * force;
  } else {
    // Recursar en hijos
    for (const child of quad.children) {
      if (child) applyBarnesHutForce(node, child, charge, chargeDistance, theta, alpha);
    }
  }
}

/** Aplica un empujón aleatoria a dos nodos exactamente coincidentes: si no,
 * `distSq === 0` los excluía de TODAS las fuerzas (repulsión, colisión) y
 * quedaban pegados para siempre, además de poder reventar el quadtree. */
function separateCoincident(a: GraphNode, b: GraphNode) {
  const angle = Math.random() * Math.PI * 2;
  const push = 0.5 + Math.random() * 0.5;
  a.vx -= Math.cos(angle) * push;
  a.vy -= Math.sin(angle) * push;
  b.vx += Math.cos(angle) * push;
  b.vy += Math.sin(angle) * push;
}

/** Fuerza de colisión (evita solapamiento) usando una rejilla espacial.
 *
 * Antes esto era O(n²): con 1.500 nodos son ~1,1 M pares por fotograma, la
 * causa principal de los 4-10 FPS del grafo. La rejilla solo compara nodos de
 * celdas vecinas, así que el coste pasa a O(n) en la práctica.
 */
export function applyCollisionForce(
  nodes: GraphNode[],
  strength: number,
  minRadius: number,
  alpha: number
): void {
  const nodeCount = nodes.length;
  if (nodeCount < 2) return;

  let maxRadius = minRadius;
  for (let i = 0; i < nodeCount; i += 1) {
    const radius = nodes[i].radius;
    if (radius > maxRadius) maxRadius = radius;
  }
  // Dos nodos pueden solaparse como máximo a 2*maxRadius de distancia; con
  // celdas de ese tamaño basta revisar las 3x3 celdas vecinas.
  const cellSize = Math.max(1, maxRadius * 2);
  const buckets = new Map<number, number[]>();
  const cellKey = (cx: number, cy: number): number =>
    (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0;
  for (let i = 0; i < nodeCount; i += 1) {
    const node = nodes[i];
    const key = cellKey(Math.floor(node.x / cellSize), Math.floor(node.y / cellSize));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }

  // Protección contra colisiones del hash numérico: una misma pareja solo
  // puede recibir la fuerza de colisión una vez por paso.
  const visited = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) {
    const n1 = nodes[i];
    const r1 = Math.max(n1.radius, minRadius);
    const cx = Math.floor(n1.x / cellSize);
    const cy = Math.floor(n1.y / cellSize);
    const stamp = i + 1;

    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const bucket = buckets.get(cellKey(cx + ox, cy + oy));
        if (!bucket) continue;

        for (const j of bucket) {
          if (j <= i || visited[j] === stamp) continue;
          visited[j] = stamp;
          const n2 = nodes[j];
          const r2 = Math.max(n2.radius, minRadius);
          const minDist = r1 + r2;

          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy;
          if (distSq === 0) {
            separateCoincident(n1, n2);
            continue;
          }

          const dist = Math.sqrt(distSq);
          if (dist < minDist) {
            const overlap = (minDist - dist) / dist;
            const force = overlap * strength * alpha;
            const fx = dx * force;
            const fy = dy * force;
            n1.vx -= fx;
            n1.vy -= fy;
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }
    }
  }
}

/** Paso de física puro - modelo D3/Obsidian */
export function physicsStep(state: PhysicsState): PhysicsStepResult {
  const { nodes, links, alpha, config, width, height, draggedNode } = state;
  const nodeCount = nodes.length;

  // Índices O(1) para enlaces
  const nodeIndex = new Map<string, number>();
  nodes.forEach((n, i) => nodeIndex.set(n.title, i));

  // --- REPULSIÓN (Carga) ---
  if (nodeCount > config.barnesHutThreshold) {
    // Barnes-Hut O(n log n)
    const quadtree = buildQuadtree(nodes, width, height);
    for (const node of nodes) {
      if (node === draggedNode) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      applyBarnesHutForce(node, quadtree, config.charge, config.chargeDistance, config.barnesHutTheta, alpha);
    }
  } else {
    // O(n²) para pocos nodos
    for (let i = 0; i < nodeCount; i++) {
      const n1 = nodes[i];
      if (n1 === draggedNode) { n1.vx = 0; n1.vy = 0; continue; }
      for (let j = i + 1; j < nodeCount; j++) {
        const n2 = nodes[j];
        if (n2 === draggedNode) continue;

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy;
        if (distSq === 0) {
          separateCoincident(n1, n2);
          continue;
        }

        if (config.chargeDistance !== Infinity && distSq > config.chargeDistance * config.chargeDistance) continue;

        const dist = Math.sqrt(distSq);
        const force = (config.charge * config.charge) / distSq * alpha; // q1*q2, ambos = 1
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        n1.vx -= fx;
        n1.vy -= fy;
        n2.vx += fx;
        n2.vy += fy;
      }
    }
  }

  // --- COLISIÓN (Anti-solapamiento) ---
  applyCollisionForce(nodes, config.collisionStrength, config.minCollisionRadius, alpha);

  // --- RESORTES (Enlaces) ---
  for (const link of links) {
    const si = nodeIndex.get(link.source);
    const ti = nodeIndex.get(link.target);
    if (si === undefined || ti === undefined) continue;

    const source = nodes[si];
    const target = nodes[ti];
    if (source === draggedNode && target === draggedNode) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0) continue;
    const dist = Math.sqrt(distSq);

    // Hooke's law: F = k * (x - x0)
    const force = (dist - config.linkDistance) * config.linkStrength * alpha;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (source !== draggedNode) {
      source.vx += fx;
      source.vy += fy;
    }
    if (target !== draggedNode) {
      target.vx -= fx;
      target.vy -= fy;
    }
  }

  // --- ATACCIÓN AL CENTRO ---
  const centerX = width / 2;
  const centerY = height / 2;
  for (const node of nodes) {
    if (node === draggedNode) { node.vx = 0; node.vy = 0; continue; }
    const dx = centerX - node.x;
    const dy = centerY - node.y;
    node.vx += dx * config.centerStrength * alpha;
    node.vy += dy * config.centerStrength * alpha;
  }

  // --- AMORTIGUACIÓN + LÍMITE VELOCIDAD + INTEGRACIÓN ---
  let totalEnergy = 0;
  let maxVel = 0;
  const maxV = config.maxVelocity;
  const maxVSq = maxV * maxV;
  const damp = config.velocityDecay;

  for (const node of nodes) {
    if (node === draggedNode) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    // Amortiguación
    node.vx *= damp;
    node.vy *= damp;

    // Límite de velocidad
    const vSq = node.vx * node.vx + node.vy * node.vy;
    if (vSq > maxVSq) {
      const scale = maxV / Math.sqrt(vSq);
      node.vx *= scale;
      node.vy *= scale;
    }

    // Integración
    node.x += node.vx;
    node.y += node.vy;

    totalEnergy += vSq;
    maxVel = Math.max(maxVel, Math.sqrt(vSq));
  }

  // Decaimiento de alpha
  const nextAlpha = Math.max(config.alphaMin, alpha - alpha * config.alphaDecay);

  return { nodes, alpha: nextAlpha, energy: totalEnergy, maxVelocity: maxVel };
}

/**
 * Decide cuándo dormir la física.
 *
 * Antes exigía `alpha <= alphaMin && energy < 0.01`. En grafos grandes la
 * energía residual (suma de v² de 1.500 nodos) nunca baja de 0.01, así que la
 * simulación seguía consumiendo CPU indefinidamente. Ahora basta con que
 * alpha llegue al mínimo o con agotar el presupuesto duro de pasos.
 */
export function shouldStopSimulation(
  alpha: number,
  _energy: number,
  config: PhysicsConfig,
  steps = 0
): boolean {
  return steps >= config.maxSteps || alpha <= config.alphaMin;
}

export function computeRevealOrder(allNodes: GraphNode[], allLinks: GraphLink[]): GraphNode[] {
  const degree = new Map<string, number>();
  for (const link of allLinks) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }

  const nodesWithDegree = allNodes.map(node => ({
    node,
    degree: degree.get(node.title) || 0,
  }));

  nodesWithDegree.sort((a, b) => b.degree - a.degree || a.node.title.localeCompare(b.node.title));

  const visited = new Set<string>();
  const result: GraphNode[] = [];
  const adjacency = new Map<string, string[]>();

  for (const link of allLinks) {
    let arr = adjacency.get(link.source);
    if (!arr) { arr = []; adjacency.set(link.source, arr); }
    arr.push(link.target);
    arr = adjacency.get(link.target);
    if (!arr) { arr = []; adjacency.set(link.target, arr); }
    arr.push(link.source);
  }

  for (const { node } of nodesWithDegree) {
    if (visited.has(node.title)) continue;
    const queue: GraphNode[] = [node];
    visited.add(node.title);

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjacency.get(current.title) || [];
      neighbors.sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0));

      for (const nbTitle of neighbors) {
        if (!visited.has(nbTitle)) {
          visited.add(nbTitle);
          const nbNode = allNodes.find(n => n.title === nbTitle);
          if (nbNode) queue.push(nbNode);
        }
      }
    }
  }

  for (const { node } of nodesWithDegree) {
    if (!visited.has(node.title)) result.push(node);
  }

  return result;
}

export function computeInitialPosition(
  node: GraphNode,
  loadedNodes: GraphNode[],
  links: GraphLink[],
  width: number,
  height: number
): { x: number; y: number } {
  const loadedTitles = new Set(loadedNodes.map(n => n.title));
  const neighbors: GraphNode[] = [];

  for (const link of links) {
    if (link.source === node.title && loadedTitles.has(link.target)) {
      const n = loadedNodes.find(ln => ln.title === link.target);
      if (n) neighbors.push(n);
    }
    if (link.target === node.title && loadedTitles.has(link.source)) {
      const n = loadedNodes.find(ln => ln.title === link.source);
      if (n) neighbors.push(n);
    }
  }

  if (neighbors.length > 0) {
    const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    const angle = Math.random() * Math.PI * 2;
    // Radio = linkDistance + espacio para no solapar
    const radius = 80 + Math.random() * 40;
    return {
      x: neighbor.x + Math.cos(angle) * radius,
      y: neighbor.y + Math.sin(angle) * radius,
    };
  }

  const angle = Math.random() * Math.PI * 2;
  const radius = 50 + Math.random() * 100;
  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius,
  };
}