import fs from "fs";
import path from "path";

function benchmark() {
  const results: any = {
    timestamp: new Date().toISOString(),
    notes: 1000,
    blocksPerNote: 100,
    operations: []
  };

  const startMem = process.memoryUsage();

  // Simulate loading
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
  results.operations.push({ name: "create_100k_blocks", ms: t2 - t1 });

  // Simulate search
  const t3 = performance.now();
  let found = 0;
  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j < notes[i].blocks.length; j++) {
      if (notes[i].blocks[j].content.includes("#tag")) found++;
    }
  }
  const t4 = performance.now();
  results.operations.push({ name: "scan_all_blocks_for_tag", ms: t4 - t3, matches: found });

  const endMem = process.memoryUsage();
  results.memory = {
    heapUsedMB: Math.round(endMem.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotalMB: Math.round(endMem.heapTotal / 1024 / 1024 * 100) / 100
  };

  const outDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `benchmark-${Date.now()}.md`);
  let md = `# Benchmark de rendimiento\n\n`;
  md += `**Fecha:** ${results.timestamp}\n\n`;
  md += `**Configuración:** ${results.notes} notas × ${results.blocksPerNote} bloques = ${results.notes * results.blocksPerNote} bloques\n\n`;
  md += `## Operaciones\n\n| Operación | Tiempo (ms) | Notas |\n|---|---|---|\n`;
  for (const op of results.operations) {
    md += `| ${op.name} | ${op.ms.toFixed(2)} | ${op.matches !== undefined ? op.matches + ' coincidencias' : '-'} |\n`;
  }
  md += `\n## Memoria\n\n| Métrica | Valor |\n|---|---|\n`;
  md += `| Heap usado | ${results.memory.heapUsedMB} MB |\n`;
  md += `| Heap total | ${results.memory.heapTotalMB} MB |\n`;
  fs.writeFileSync(outFile, md);
  console.log("Benchmark guardado en:", outFile);
}

benchmark();
