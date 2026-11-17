#!/usr/bin/env node
/**
 * Prepara los assets de la Microsoft Store (MSIX) desde el icono de Linux.
 *
 * El icono de Linux (`src-tauri/icons/icon.png`) ya tiene canal alfa y el
 * encuadre correcto. Los assets del MSIX se derivan de él para que el tile sea
 * transparente de verdad y el logo ocupe todo el asset (sin el margen
 * transparente que lo hace verse pequeño).
 *
 * Además de los cuatro assets del manifiesto, genera las variantes
 * `targetsize-*` (con `_altform-unplated` y `_altform-lightunplated`) del icono
 * de la app. Sin ellas Windows dibuja una bandeja de fondo y encoge el icono en
 * la barra de tareas, Start y la búsqueda. Para que Windows use esas variantes
 * el paquete necesita un `resources.pri`: lo genera `makepri.exe` en el
 * workflow, después de copiar los assets al stage.
 *
 * No toca los demás iconos ni la generación de Android/iOS. Es idempotente.
 *
 * Uso: node scripts/prepare-store-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS = join(ROOT, "src-tauri", "icons");
const SOURCE = join(ICONS, "icon.png");
const BASE_OUTPUTS = [
  ["StoreLogo.png", 50],
  ["Square44x44Logo.png", 44],
  ["Square150x150Logo.png", 150],
  ["Square310x310Logo.png", 310],
];
// Tamaños exactos que Windows pide para el icono de la app (barra de tareas,
// Start, búsqueda, menús contextuales). Se generan las tres formas: la normal
// (con bandeja) y las dos "unplated" (sin bandeja, una por tema).
const TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256];
const TARGET_FORMS = ["", "_altform-unplated", "_altform-lightunplated"];
const TARGET_OUTPUTS = TARGET_SIZES.flatMap((size) =>
  TARGET_FORMS.map((form) => [
    `Square44x44Logo.targetsize-${size}${form}.png`,
    size,
  ]),
);
const OUTPUTS = [...BASE_OUTPUTS, ...TARGET_OUTPUTS];
const PADDING_PCT = 2;
const ALPHA_THRESHOLD = 8;

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("no es PNG");
  let pos = 8;
  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0,
    interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8 || interlace !== 0 || channels !== 4) {
    throw new Error(
      `Se esperaba PNG RGBA 8-bit sin entrelazar: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`,
    );
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = new Uint8Array(width * height * bpp);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[src++];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = y > 0 ? out[prevStart + x] : 0;
      const c = y > 0 && x >= bpp ? out[prevStart + x - bpp] : 0;
      let value;
      switch (filter) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a),
            pb = Math.abs(p - b),
            pc = Math.abs(p - c);
          value = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`filtro PNG desconocido: ${filter}`);
      }
      out[rowStart + x] = value & 0xff;
    }
  }
  return { width, height, data: out };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Aplica un filtro PNG (0-4) a una fila y devuelve los bytes filtrados.
function filterRow(cur, prev, type, out, offset) {
  const bpp = 4;
  const stride = cur.length;
  for (let x = 0; x < stride; x++) {
    const raw = cur[x];
    const a = x >= bpp ? cur[x - bpp] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= bpp ? prev[x - bpp] : 0;
    let value;
    switch (type) {
      case 0:
        value = raw;
        break;
      case 1:
        value = raw - a;
        break;
      case 2:
        value = raw - b;
        break;
      case 3:
        value = raw - ((a + b) >> 1);
        break;
      case 4: {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value = raw - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        break;
      }
      default:
        throw new Error(`filtro PNG desconocido: ${type}`);
    }
    out[offset + x] = value & 0xff;
  }
}

// Codifica RGBA eligiendo el filtro que mejor comprime cada fila (heurística
// estándar: suma de diferencias absolutas). Sin esto los PNG pesan 20x más.
function encodePNG(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    let bestType = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let type = 0; type < 5; type++) {
      filterRow(cur, prev, type, candidate, 0);
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const v = candidate[x];
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    raw[y * (stride + 1)] = bestType;
    filterRow(cur, prev, bestType, raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const { width, height, data } = decodePNG(readFileSync(SOURCE));

let minX = width,
  minY = height,
  maxX = -1,
  maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < ALPHA_THRESHOLD) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
if (maxX < 0) throw new Error(`${SOURCE} está vacío`);

// Recorte cuadrado centrado con un pequeño margen para que no toque los bordes.
const side = Math.min(maxX - minX + 1, maxY - minY + 1);
const pad = Math.round((side * PADDING_PCT) / 100);
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
const half = side / 2 + pad;
const x0 = Math.max(0, Math.round(cx - half));
const y0 = Math.max(0, Math.round(cy - half));
const w = Math.min(width - x0, Math.round(half * 2));
const h = Math.min(height - y0, Math.round(half * 2));

const cropped = new Uint8Array(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const src = ((y0 + y) * width + (x0 + x)) * 4;
    const dst = (y * w + x) * 4;
    cropped[dst] = data[src];
    cropped[dst + 1] = data[src + 1];
    cropped[dst + 2] = data[src + 2];
    cropped[dst + 3] = data[src + 3];
  }
}

function axisWeights(size, target) {
  const scale = size / target;
  const weights = [];
  for (let i = 0; i < target; i++) {
    const start = (i * size) / target;
    const end = ((i + 1) * size) / target;
    const i0 = Math.floor(start);
    const i1 = Math.ceil(end);
    const list = [];
    for (let j = i0; j < i1; j++) {
      const lo = Math.max(start, j);
      const hi = Math.min(end, j + 1);
      list.push([j, (hi - lo) / scale]);
    }
    weights.push(list);
  }
  return weights;
}

// Escalado por promedio de área con premultiplicación alfa (evita halos grises).
function scaleArea(src, sw, sh, dw, dh) {
  const xw = axisWeights(sw, dw);
  const yw = axisWeights(sh, dh);
  const out = new Uint8Array(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const [sy, wy] of yw[dy]) {
        for (const [sx, wx] of xw[dx]) {
          const weight = wy * wx;
          const i = (sy * sw + sx) * 4;
          const pa = src[i + 3] / 255;
          r += src[i] * pa * weight;
          g += src[i + 1] * pa * weight;
          b += src[i + 2] * pa * weight;
          a += src[i + 3] * weight;
        }
      }
      const o = (dy * dw + dx) * 4;
      if (a > 0) {
        out[o] = Math.round((r * 255) / a);
        out[o + 1] = Math.round((g * 255) / a);
        out[o + 2] = Math.round((b * 255) / a);
      }
      out[o + 3] = Math.round(a);
    }
  }
  return out;
}

for (const [name, size] of OUTPUTS) {
  const pixels = scaleArea(cropped, w, h, size, size);
  writeFileSync(join(ICONS, name), encodePNG(size, size, pixels));
  console.log(`  ${name} (${size}x${size})`);
}
console.log(
  `Assets MSIX generados desde ${SOURCE} (recorte ${w}x${h}, ${OUTPUTS.length} archivos).`,
);
