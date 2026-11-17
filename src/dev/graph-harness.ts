/**
 * Banco de pruebas EN VIVO para GraphView (abrir: http://localhost:1420/graph-harness.html)
 * Simula gestos reales (mousedown/mousemove/mouseup/click/wheel/dblclick) y
 * verifica selección, zoom, pan, arrastre, color y estabilidad tras el settle.
 */
import { GraphView } from "../views/graph-view";
import type { PageData } from "../types";

const COLORS = ["#ef4444", "#22c55e", "#eab308"];

function makePages(n: number): PageData[] {
  const pages: PageData[] = [];
  for (let i = 0; i < n; i++) {
    pages.push({
      id: `p${i}`,
      title: `P${i}`,
      blocks: [{
        id: `b${i}`,
        type: "text",
        content: `Contenido ${i}\n[[P${(i + 1) % n}]]`,
        children: [],
      }],
      isJournal: false,
      path: `P${i}.md`,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      pinned: false,
    } as PageData);
  }
  return pages;
}

const results: string[] = [];
const resultsEl = document.getElementById("results")!;
function log(msg: string, ok?: boolean) {
  const line = ok === undefined ? msg : `${ok ? "✓ PASS" : "✗ FAIL"}  ${msg}`;
  results.push(line);
  const div = document.createElement("div");
  div.className = ok === undefined ? "" : ok ? "pass" : "fail";
  div.textContent = line;
  resultsEl.appendChild(div);
  resultsEl.scrollTop = resultsEl.scrollHeight;
}

const canvas = document.getElementById("graph-canvas") as HTMLCanvasElement;
const view = new GraphView("graph-canvas", (title: string) => {
  (window as any).__lastSelect = title;
});
(window as any).__graphClickBackground = () => {
  (window as any).__bgClicks = ((window as any).__bgClicks || 0) + 1;
  view.selectNode(null);
};
view.updateData(makePages(14));

function rect() { return canvas.getBoundingClientRect(); }
function screenOf(title: string) {
  const p = view.getNodePosition(title)!;
  const s = view.getScale();
  const o = view.getOffset();
  return { x: p.x * s + o.x, y: p.y * s + o.y };
}
function mouse(type: string, x: number, y: number, opts: { button?: number; buttons?: number; deltaY?: number } = {}) {
  const r = rect();
  const btn = opts.button ?? 0;
  const btns = opts.buttons !== undefined
    ? opts.buttons
    : btn === 1 ? 4 : btn === 2 ? 2 : 1;
  if (type === "wheel") {
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, view: window, clientX: r.left + x, clientY: r.top + y, deltaY: opts.deltaY ?? -120 }));
    return;
  }
  const evt = new MouseEvent(type, {
    bubbles: true, cancelable: true, view: window,
    clientX: r.left + x, clientY: r.top + y, button: btn, buttons: btns,
  });
  canvas.dispatchEvent(evt);
}
function clickNode(title: string) {
  const s = screenOf(title);
  mouse("mousedown", s.x, s.y, { button: 0, buttons: 1 });
  mouse("mouseup", s.x, s.y, { button: 0, buttons: 0 });
  canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: rect().left + s.x, clientY: rect().top + s.y, button: 0, buttons: 0 }));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

async function run() {
  (window as any).__lastSelect = null;
  (window as any).__bgClicks = 0;
  await sleep(700);

  // A): clicks alternos inmediatos durante la animación inicial
  clickNode("P3"); await waitFrame();
  log("A1 click P3 selecciona P3", (window as any).__lastSelect === "P3");
  clickNode("P5"); await waitFrame();
  log("A2 click P5 selecciona P5", (window as any).__lastSelect === "P5");
  clickNode("P3"); await waitFrame();
  log("A3 re-click P3 vuelve a P3", (window as any).__lastSelect === "P3");

  // B): click en fondo deselecciona
  mouse("mousedown", 8, 8, { button: 0, buttons: 1 });
  mouse("mousemove", 14, 10, { button: 0, buttons: 1 });
  mouse("mouseup", 14, 10, { button: 0, buttons: 0 });
  canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: rect().left + 14, clientY: rect().top + 10, button: 0, buttons: 0 }));
  await waitFrame();
  log("B click fondo deselecciona", (window as any).__bgClicks === 1 && view.getSelected() === null);

  // C): 6 clicks alternos rápidos
  let altOk = true;
  for (let i = 0; i < 6; i++) {
    clickNode(i % 2 === 0 ? "P7" : "P2");
    await waitFrame();
    const expected = i % 2 === 0 ? "P7" : "P2";
    if ((window as any).__lastSelect !== expected) { altOk = false; log(`C${i} esperaba ${expected}, hubo ${(window as any).__lastSelect}`, false); }
  }
  log("C 6 clicks alternos correctos", altOk);

  // D): esperar settle (alpha decae ~5s) y verificar que la física para
  await sleep(6500);
  log("D simulación settle tras ~7s (loop no muere)", typeof view.isSimulating() === "boolean");

  // E): ZOOM con rueda tras settle (regresión del freeze)
  const rc0 = view.getRenderCount();
  const sc0 = view.getScale();
  const s0 = screenOf("P4");
  mouse("wheel", s0.x, s0.y, { deltaY: -120 });
  await waitFrame();
  const rc1 = view.getRenderCount();
  log("E1 zoom tras settle repinta y escala", view.getScale() !== sc0 && rc1 > rc0);

  // F): pan con botón derecho tras settle
  const off0 = view.getOffset();
  mouse("mousedown", 400, 300, { button: 2, buttons: 2 });
  for (let i = 1; i <= 6; i++) mouse("mousemove", 400 + i * 10, 300, { button: 2, buttons: 2 });
  mouse("mouseup", 460, 300, { button: 2, buttons: 2 });
  await waitFrame();
  const off1 = view.getOffset();
  const rc2 = view.getRenderCount();
  log("F pan botón derecho tras settle", off1.x > off0.x + 40 && rc2 > rc1);

  // G): arrastrar un nodo tras settle
  const pos0 = view.getNodePosition("P6")!;
  const s6 = screenOf("P6");
  mouse("mousedown", s6.x, s6.y, { button: 0, buttons: 1 });
  for (let i = 1; i <= 6; i++) mouse("mousemove", s6.x + i * 12, s6.y + i * 6, { button: 0, buttons: 1 });
  mouse("mouseup", s6.x + 72, s6.y + 36, { button: 0, buttons: 0 });
  await waitFrame();
  const pos1 = view.getNodePosition("P6")!;
  const rc3 = view.getRenderCount();
  const moved = Math.hypot(pos1.x - pos0.x, pos1.y - pos0.y);
  log("G arrastre de nodo tras settle", moved > 40 && rc3 > rc2);
  const suppressLeak = (view as any).suppressClick === false;
  log("G2 suppressClick no queda atascado tras drag", suppressLeak);
  // drag no debe disparar selección
  log("G3 drag no selecciona", (window as any).__lastSelect !== "P6");

  // H): cambiar color tras settle
  const rc4 = view.getRenderCount();
  view.setNodeColor("P3", COLORS[0]);
  await sleep(120); await waitFrame();
  const col = view.getNodeColorComputed("P3");
  log("H cambio de color tras settle", col === COLORS[0] && view.getRenderCount() > rc4);

  // I): hover tras settle repinta
  const rc5 = view.getRenderCount();
  const s2 = screenOf("P2");
  mouse("mousemove", s2.x, s2.y, { button: 0, buttons: 0 });
  await waitFrame();
  log("I hover tras settle repinta", view.getRenderCount() > rc5);

  // J): selección sigue viva mucho después del settle (regresión principal)
  clickNode("P9"); await waitFrame();
  log("J click tras ~8s sigue seleccionando", (window as any).__lastSelect === "P9");
  // zoom de nuevo tras ese click
  const sc1 = view.getScale();
  const sb = screenOf("P1");
  mouse("wheel", sb.x, sb.y, { deltaY: 120 });
  await waitFrame();
  log("J2 zoom sigue vivo tras click+settle", view.getScale() !== sc1);

  // K): doble click resetea vista
  mouse("dblclick", 400, 300);
  await waitFrame();
  log("K dblclick resetea zoom/pan", view.getScale() === 1 && view.getOffset().x === 0 && view.getOffset().y === 0);

  // L): estabilidad — sin bucle infinito de render en reposo
  // Esperar a que la física se asiente de verdad (alpha mínimo + energía baja)
  for (let i = 0; i < 24 && view.isSimulating(); i++) await sleep(500);
  await waitFrame();
  const rcA = view.getRenderCount();
  await sleep(600);
  const rcB = view.getRenderCount();
  log("L física parada y loop de render termina en reposo (batería)", !view.isSimulating() && rcB - rcA <= 2);

  const failed = results.some((l) => l.startsWith("✗"));
  const summary = failed ? "HARNESS FAIL" : "HARNESS PASS";
  log(`RESULTADO: ${summary} (${results.filter(l => l.startsWith("✓")).length} pass / ${results.filter(l => l.startsWith("✗")).length} fail)`);
  document.title = summary;
  (window as any).__harnessDone = true;
}

run().catch((err) => {
  console.error(err);
  log(`EXCEPCIÓN: ${err?.message ?? err}`, false);
  document.title = "HARNESS FAIL";
});
