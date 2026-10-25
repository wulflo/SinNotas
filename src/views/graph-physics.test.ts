import { describe, it, expect } from "vitest";
import {
  physicsStep,
  shouldStopSimulation,
  computeRevealOrder,
  computeInitialPosition,
  applyCollisionForce,
  DEFAULT_PHYSICS_CONFIG,
  PhysicsState,
} from "./graph-physics";
import { GraphNode, GraphLink } from "../types";

function createTestNode(title: string, x: number, y: number, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: title,
    title,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 10,
    isJournal: false,
    connectionsCount: 0,
    ...overrides,
  };
}

function createTestLink(source: string, target: string): GraphLink {
  return { source, target };
}

function createPhysicsState(overrides: Partial<PhysicsState> = {}): PhysicsState {
  const config = { ...DEFAULT_PHYSICS_CONFIG };
  return {
    nodes: [],
    links: [],
    alpha: 1.0,
    config,
    width: 800,
    height: 600,
    draggedNode: null,
    ...overrides,
  };
}

describe("graph-physics", () => {
  describe("physicsStep", () => {
    it("debe limitar la velocidad máxima al valor configurado", () => {
      const node = createTestNode("A", 400, 300, { vx: 100, vy: 100 });
      const state = createPhysicsState({ nodes: [node], alpha: 1.0 });
      const result = physicsStep(state);

      const speed = Math.sqrt(result.nodes[0].vx ** 2 + result.nodes[0].vy ** 2);
      expect(speed).toBeLessThanOrEqual(DEFAULT_PHYSICS_CONFIG.maxVelocity + 0.001);
    });

    it("la energía cinética debe tender a cero tras suficientes pasos (amortiguación)", () => {
      // Nodo en el centro con velocidad - debería amortiguar
      const node = createTestNode("A", 400, 300, { vx: 30, vy: 40 });
      const state = createPhysicsState({ nodes: [node], alpha: 1.0 });

      let currentState = state;

      // Ejecutar muchos pasos hasta que alpha sea mínimo
      for (let i = 0; i < 200; i++) {
        const result = physicsStep(currentState);
        currentState = { ...currentState, nodes: result.nodes, alpha: result.alpha };
        if (result.alpha <= currentState.config.alphaMin) break;
      }

      // Al final, la energía debe ser muy baja (nodo estabilizado en el centro)
      expect(currentState.nodes[0].vx ** 2 + currentState.nodes[0].vy ** 2).toBeLessThan(0.01);
    });

    it("ningún nodo debe salir disparado más allá de N píxeles del centro en un solo paso", () => {
      const maxDisplacement = 200;
      const node = createTestNode("A", 400, 300, { vx: 1000, vy: 1000 });
      const state = createPhysicsState({ nodes: [node], alpha: 1.0 });
      const result = physicsStep(state);

      const dx = result.nodes[0].x - 400;
      const dy = result.nodes[0].y - 300;
      const displacement = Math.sqrt(dx * dx + dy * dy);
      expect(displacement).toBeLessThanOrEqual(maxDisplacement);
    });

    it("debe aplicar fuerza de repulsión (carga negativa) entre nodos", () => {
      const nodeA = createTestNode("A", 390, 300);
      const nodeB = createTestNode("B", 410, 300);
      const state = createPhysicsState({ nodes: [nodeA, nodeB], alpha: 1.0 });
      const result = physicsStep(state);

      // Deben separarse (repulsión por carga negativa)
      expect(result.nodes[0].vx).toBeLessThan(0);
      expect(result.nodes[1].vx).toBeGreaterThan(0);
    });

    it("debe aplicar fuerza de resorte en enlaces (atracción si dist > linkDistance)", () => {
      const nodeA = createTestNode("A", 300, 300);
      const nodeB = createTestNode("B", 500, 300); // 200px > linkDistance (80)
      const link = createTestLink("A", "B");
      const state = createPhysicsState({ nodes: [nodeA, nodeB], links: [link], alpha: 1.0 });
      const result = physicsStep(state);

      // Deben atraerse (distancia > linkDistance)
      expect(result.nodes[0].vx).toBeGreaterThan(0);
      expect(result.nodes[1].vx).toBeLessThan(0);
    });

    it("debe aplicar fuerza de resorte en enlaces (repulsión si dist < linkDistance)", () => {
      const nodeA = createTestNode("A", 390, 300);
      const nodeB = createTestNode("B", 410, 300); // 20px < linkDistance (80)
      const link = createTestLink("A", "B");
      const state = createPhysicsState({ nodes: [nodeA, nodeB], links: [link], alpha: 1.0 });
      const result = physicsStep(state);

      // Deben repelerse (distancia < linkDistance)
      expect(result.nodes[0].vx).toBeLessThan(0);
      expect(result.nodes[1].vx).toBeGreaterThan(0);
    });

    it("debe respetar alphaMin y no bajar de él", () => {
      const node = createTestNode("A", 400, 300);
      const state = createPhysicsState({ nodes: [node], alpha: 0.0005 });
      const result = physicsStep(state);

      expect(result.alpha).toBeGreaterThanOrEqual(DEFAULT_PHYSICS_CONFIG.alphaMin);
    });

    it("no debe modificar el nodo arrastrado (velocidad = 0)", () => {
      const nodeA = createTestNode("A", 400, 300, { vx: 10, vy: 10 });
      const nodeB = createTestNode("B", 410, 300);
      const state = createPhysicsState({
        nodes: [nodeA, nodeB],
        draggedNode: nodeA,
        alpha: 1.0,
      });
      const result = physicsStep(state);

      // nodeA (arrastrado) debe tener velocidad 0
      expect(result.nodes[0].vx).toBe(0);
      expect(result.nodes[0].vy).toBe(0);

      // nodeB sí debe verse afectado por repulsión
      expect(Math.abs(result.nodes[1].vx)).toBeGreaterThan(0);
    });

    it("mantiene la posición del nodo que se está arrastrando", () => {
      const nodeA = createTestNode("A", 123, 456, { vx: 5, vy: 5 });
      const nodeB = createTestNode("B", 400, 300);
      let state = createPhysicsState({
        nodes: [nodeA, nodeB],
        draggedNode: nodeA,
        alpha: 1.0,
      });

      for (let step = 0; step < 10; step += 1) {
        const result = physicsStep(state);
        state = createPhysicsState({
          nodes: result.nodes,
          draggedNode: result.nodes[0],
          alpha: result.alpha,
        });
      }

      expect(state.nodes[0].x).toBeCloseTo(123, 5);
      expect(state.nodes[0].y).toBeCloseTo(456, 5);
      expect(state.nodes[0].vx).toBe(0);
      expect(state.nodes[0].vy).toBe(0);
    });

    it("debe usar Barnes-Hut cuando hay más de 200 nodos", () => {
      const nodes: GraphNode[] = [];
      for (let i = 0; i < 250; i++) {
        nodes.push(createTestNode(`N${i}`, Math.random() * 800, Math.random() * 600));
      }
      const state = createPhysicsState({ nodes, alpha: 0.5 });
      const result = physicsStep(state);

      expect(result.nodes.length).toBe(250);
      expect(result.alpha).toBeLessThan(0.5);
    });

    it("debe evitar solapamiento con fuerza de colisión", () => {
      const nodeA = createTestNode("A", 395, 300, { radius: 20 });
      const nodeB = createTestNode("B", 405, 300, { radius: 20 }); // Solapados (dist=10, minDist=40)
      const state = createPhysicsState({ nodes: [nodeA, nodeB], alpha: 1.0 });
      const result = physicsStep(state);

      // Deben separarse
      expect(result.nodes[0].vx).toBeLessThan(0);
      expect(result.nodes[1].vx).toBeGreaterThan(0);
    });

    it("la colisión con rejilla separa un racimo denso sin producir NaN", () => {
      const nodes: GraphNode[] = [];
      for (let i = 0; i < 300; i += 1) {
        nodes.push(
          createTestNode(`N${i}`, 400 + (i % 20) * 3, 300 + Math.floor(i / 20) * 3, { radius: 12 })
        );
      }

      applyCollisionForce(nodes, 1, 16, 1);

      expect(nodes.every((node) => Number.isFinite(node.vx) && Number.isFinite(node.vy))).toBe(true);
      expect(nodes.some((node) => node.vx !== 0 || node.vy !== 0)).toBe(true);
    });

    it("la rejilla no aplica colisión entre nodos muy alejados", () => {
      const nodeA = createTestNode("A", 0, 0, { radius: 12 });
      const nodeB = createTestNode("B", 5000, 5000, { radius: 12 });

      applyCollisionForce([nodeA, nodeB], 1, 16, 1);

      expect(nodeA.vx).toBe(0);
      expect(nodeA.vy).toBe(0);
      expect(nodeB.vx).toBe(0);
      expect(nodeB.vy).toBe(0);
    });
  });

  describe("shouldStopSimulation", () => {
    it("debe devolver true al alcanzar alphaMin, aunque quede energía residual", () => {
      const config = DEFAULT_PHYSICS_CONFIG;
      expect(shouldStopSimulation(config.alphaMin, 0.001, config)).toBe(true);
      // Regresión del grafo que nunca convergía: con 1.500 nodos la suma de
      // v² se quedaba por encima de 0.01 para siempre.
      expect(shouldStopSimulation(config.alphaMin, 250, config)).toBe(true);
    });

    it("debe devolver false mientras alpha siga por encima del mínimo", () => {
      const config = DEFAULT_PHYSICS_CONFIG;
      expect(shouldStopSimulation(0.1, 0.001, config)).toBe(false);
    });

    it("debe detenerse al agotar el presupuesto duro de pasos", () => {
      const config = DEFAULT_PHYSICS_CONFIG;
      expect(shouldStopSimulation(0.5, 0.001, config, config.maxSteps - 1)).toBe(false);
      expect(shouldStopSimulation(0.5, 0.001, config, config.maxSteps)).toBe(true);
    });
  });

  describe("computeRevealOrder", () => {
    it("debe ordenar nodos por conectividad descendente (basado en enlaces)", () => {
      const nodes: GraphNode[] = [
        createTestNode("A", 0, 0),
        createTestNode("B", 0, 0),
        createTestNode("C", 0, 0),
      ];
      const links: GraphLink[] = [
        createTestLink("B", "A"),
        createTestLink("B", "C"),
      ];

      const result = computeRevealOrder(nodes, links);
      expect(result[0].title).toBe("B");
      expect(result[1].title).toBe("A");
      expect(result[2].title).toBe("C");
    });

    it("debe agrupar vecinos en el orden de revelación", () => {
      const nodes: GraphNode[] = [
        createTestNode("A", 0, 0),
        createTestNode("B", 0, 0),
        createTestNode("C", 0, 0),
        createTestNode("D", 0, 0),
      ];
      const links: GraphLink[] = [
        createTestLink("A", "B"),
        createTestLink("B", "C"),
      ];

      const result = computeRevealOrder(nodes, links);

      const idxD = result.findIndex(n => n.title === "D");
      expect(idxD).toBe(3);

      const idxA = result.findIndex(n => n.title === "A");
      const idxB = result.findIndex(n => n.title === "B");
      const idxC = result.findIndex(n => n.title === "C");
      const cluster = [idxA, idxB, idxC].sort((a, b) => a - b);
      expect(cluster[2] - cluster[0]).toBe(2);
    });
  });

  describe("computeInitialPosition", () => {
    it("debe colocar nodo cerca de un vecino ya cargado", () => {
      const node = createTestNode("New", 0, 0);
      const loaded = [createTestNode("Neighbor", 400, 300)];
      const links = [createTestLink("New", "Neighbor")];

      const pos = computeInitialPosition(node, loaded, links, 800, 600);

      const dist = Math.sqrt((pos.x - 400) ** 2 + (pos.y - 300) ** 2);
      expect(dist).toBeGreaterThanOrEqual(80);
      expect(dist).toBeLessThanOrEqual(120);
    });

    it("debe colocar nodo cerca del centro si no tiene vecinos cargados", () => {
      const node = createTestNode("New", 0, 0);
      const loaded = [createTestNode("Other", 100, 100)];
      const links = [createTestLink("New", "Unloaded")];

      const pos = computeInitialPosition(node, loaded, links, 800, 600);

      const dist = Math.sqrt((pos.x - 400) ** 2 + (pos.y - 300) ** 2);
      expect(dist).toBeGreaterThanOrEqual(50);
      expect(dist).toBeLessThanOrEqual(150);
    });
  });
});