import fs from "fs";
import path from "path";

function benchmark() {
  const results = {
    timestamp: new Date().toISOString(),
    notes: 1000,
    blocksPerNote: 100
  };

  const startMem = process.memoryUsage();
  const t1 = performance.now();
  const notes = [];
  for (let n = 0; n < 1000; n++) {
    const blocks = [];
    for (let b = 0; b < 100; b++) {
      blocks.push({ id: `n${n}-b${b}`, content: `Block ${b} content with some text #tag` });
    }
    notes.push({ id: `note-${n}`, title: `Note ${n}`, blocks });
  }
  const t2 = performance.now();
  results.create_ms = t2 - t1;

  const t3 = performance.now();
  let found = 0;
  for (let i = 0; i < notes.length; i++) {
    const bl = notes[i].blocks;
    for (let j = 0; j < bl.length; j++) {
      if (bl[j].content.includes("#tag")) found++;
    }
  }
  const t4 = performance.now();
  results.scan_ms = t4 - t3;
  results.matches = found;

  const endMem = process.memoryUsage();
  results.heapUsedMB = Math.round(endMem.heapUsed / 1024 / 1024 * 100) / 100;
  results.heapTotalMB = Math.round(endMem.heapTotal / 1024 / 1024 * 100) / 100;

  const outDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `benchmark-${Date.now()}.md`);
  let md = `# Benchmark de rendimiento\n\n`;
  md += `**Fecha:** ${results.timestamp}\n\n`;
  md += `**Configuración:** ${results.notes} notas × ${results.blocksPerNote} bloques = ${results.notes * results.blocksPerNote} bloques\n\n`;
  md += `## Resultados\n\n| Operación | Tiempo (ms) | Notas |\n|---|---|---|\n`;
  md += `| create_100k_blocks | ${results.create_ms.toFixed(2)} | Estructuras en memoria |\n`;
  md += `| scan_all_blocks_for_tag | ${results.scan_ms.toFixed(2)} | ${results.matches} coincidencias |\n`;
  md += `\n## Memoria\n\n| Métrica | Valor |\n|---|---|\n`;
  md += `| Heap usado | ${results.heapUsedMB} MB |\n`;
  md += `| Heap total | ${results.heapTotalMB} MB |\n`;
  fs.writeFileSync(outFile, md);
  console.log("Benchmark guardado en:", outFile);
}

benchmark();
