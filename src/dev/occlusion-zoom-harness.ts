import "../style.css";
import type { ImageOcclusionRegion } from "../types";
import { appendOcclusionMasks } from "../editor/image-occlusion";

/**
 * Harness manual del zoom de repaso de oclusiones: replica la estructura DOM
 * de createImageOcclusionPreview (desktop) y comprueba que, a cualquier
 * nivel de zoom, cada máscara cae exactamente sobre la fracción de imagen que
 * indica su región (imagen y oclusiones escalan a la vez).
 */

let zoomOfLatest = 1;

const regions: ImageOcclusionRegion[] = [
  { source: "test", x: 0.1, y: 0.15, width: 0.25, height: 0.2, shape: "rect" },
  { source: "test", x: 0.55, y: 0.45, width: 0.3, height: 0.3, shape: "ellipse" },
  {
    source: "test",
    x: 0.2,
    y: 0.6,
    width: 0.4,
    height: 0.25,
    shape: "polygon",
    points: [
      { x: 0.25, y: 0.6 },
      { x: 0.55, y: 0.65 },
      { x: 0.5, y: 0.85 },
      { x: 0.2, y: 0.8 },
    ],
    hint: "Célula",
  },
];

const stage = document.getElementById("stage")!;
const viewport = document.createElement("div");
viewport.className = "flashcard-image-viewport";
const preview = document.createElement("div");
preview.className = "flashcard-image-preview";
const layer = document.createElement("div");
layer.className = "flashcard-image-mask-layer";
preview.appendChild(layer);
viewport.appendChild(preview);
stage.appendChild(viewport);

const image = document.createElement("img");
image.decoding = "sync";
image.style.maxHeight = "none";
preview.appendChild(image);
image.src = "/logo.jpg";

image.addEventListener("load", () => {
  layer.replaceChildren();
  appendOcclusionMasks(layer, regions, image, "image-occlusion-mask", regions[1], true);
  runChecks();
}, { once: true });
image.addEventListener("error", () => {
  document.getElementById("results")!.textContent = "ERROR: no cargó /logo.jpg";
}, { once: true });

function checkAlignment(label: string): string {
  let out = "";
  const imgRect = image.getBoundingClientRect();
  const svg = layer.querySelector("svg")!;
  const svgRect = svg.getBoundingClientRect();
  if (!rectsAlmostEqual(svgRect, imgRect)) {
    out += `${label}: FAIL la capa SVG no cubre la imagen (svg ${fmt(svgRect)} vs img ${fmt(imgRect)})\n`;
    return out;
  }
  const masks = layer.querySelectorAll<SVGElement>(".image-occlusion-mask");
  // Bounding box esperado: para rect/elipse sale de la región; para polígono,
  // del bbox de sus vértices (el dibujo usa los puntos, no la caja).
  const expected = regions.map((region) => {
    const sourcePoints = region.shape === "polygon" && region.points?.length
      ? region.points
      : [
        { x: region.x, y: region.y },
        { x: region.x + region.width, y: region.y + region.height },
      ];
    const xs = sourcePoints.map((p: { x: number }) => p.x);
    const ys = sourcePoints.map((p: { y: number }) => p.y);
    return {
      left: imgRect.left + Math.min(...xs) * imgRect.width,
      top: imgRect.top + Math.min(...ys) * imgRect.height,
      right: imgRect.left + Math.max(...xs) * imgRect.width,
      bottom: imgRect.top + Math.max(...ys) * imgRect.height,
    };
  });
  if (masks.length !== regions.length) {
    out += `${label}: FAIL número de máscaras ${masks.length} != ${regions.length}\n`;
    return out;
  }
  masks.forEach((mask, index) => {
    const rect = mask.getBoundingClientRect();
    // Para elipse/polígono el bbox SVG del rect incluye la rotación 0 y toca
    // el borde, así que toleramos 4 px por el stroke.
    const tol = 4;
    const ok =
      Math.abs(rect.left - expected[index].left) <= tol &&
      Math.abs(rect.top - expected[index].top) <= tol &&
      Math.abs(rect.right - expected[index].right) <= tol &&
      Math.abs(rect.bottom - expected[index].bottom) <= tol;
    out += `${label} máscara ${index} (${regions[index].shape}): ${ok ? "ok" : "FAIL"}\n`;
    if (!ok) {
      out += `  esperado ${JSON.stringify(expected[index])} obtenido ${JSON.stringify({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })}\n`;
    }
  });
  return out;
}

function rectsAlmostEqual(
  a: DOMRect,
  b: DOMRect,
  tol = 2
): boolean {
  return (
    Math.abs(a.left - b.left) <= tol &&
    Math.abs(a.top - b.top) <= tol &&
    Math.abs(a.width - b.width) <= tol &&
    Math.abs(a.height - b.height) <= tol
  );
}

function fmt(r: DOMRect): string {
  return `[${r.left.toFixed(1)},${r.top.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}]`;
}

function runChecks(): void {
  const lines: string[] = [];
  lines.push(checkAlignment("zoom 1.0x"));
  const base = image.getBoundingClientRect().height;
  zoomOfLatest = 1;
  for (const zoom of [1.5, 2, 3, 4]) {
    zoomOfLatest = zoom;
    image.style.maxHeight = "none";
    image.style.maxWidth = "none";
    image.style.height = `${Math.round((base / zoomOfLatest) * zoom)}px`;
    preview.style.maxWidth = "none";
    lines.push(checkAlignment(`zoom ${zoom}x`));
  }
  const allOk = lines.join("\n").split("\n").every(
    (line) => !line.includes("FAIL")
  );
  const results = document.getElementById("results")!;
  results.innerHTML = "";
  const title = document.createElement("div");
  title.className = allOk ? "pass" : "fail";
  title.textContent = allOk ? "TODOS LOS NIVELES ALINEADOS" : "Hay fallos de alineamiento";
  results.appendChild(title);
  const pre = document.createElement("pre");
  pre.textContent = lines.join("\n");
  results.appendChild(pre);
}
