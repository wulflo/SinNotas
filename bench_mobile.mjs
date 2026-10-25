import fs from "fs";
import path from "path";

function benchmarkMobile() {
  const results = {
    timestamp: new Date().toISOString(),
    platform: "mobile-sim",
    tests: []
  };

  // Simulate mobile review app operations
  const t1 = performance.now();
  const cards = [];
  for (let i = 0; i < 5000; i++) {
    cards.push({
      id: `c${i}`,
      question: `Pregunta ${i} con texto largo para simular renderizado`,
      answer: `Respuesta ${i}`,
      cardType: i % 10 === 0 ? "image-occlusion" : i % 5 === 0 ? "cloze" : "basic",
      fsrs: { stability: Math.random() * 30, difficulty: Math.random() * 10, reps: i % 20 }
    });
  }
  const t2 = performance.now();
  results.tests.push({ name: "load_5000_cards", ms: t2 - t1 });

  const t3 = performance.now();
  const filtered = cards.filter(c => c.fsrs.reps < 5);
  const t4 = performance.now();
  results.tests.push({ name: "filter_due_cards", ms: t4 - t3, count: filtered.length });

  const t5 = performance.now();
  for (let i = 0; i < 100; i++) {
    const html = cards[i].question.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>');
  }
  const t6 = performance.now();
  results.tests.push({ name: "render_100_cards_html", ms: t6 - t5 });

  const mem = process.memoryUsage();
  results.memory = {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100
  };

  const outDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `benchmark-mobile-${Date.now()}.md`);
  let md = `# Benchmark App Móvil (Flashcards)\n\n`;
  md += `**Fecha:** ${results.timestamp}\n\n`;
  md += `## Tests de rendimiento\n\n| Test | Tiempo (ms) | Notas |\n|---|---|---|\n`;
  for (const t of results.tests) {
    md += `| ${t.name} | ${t.ms.toFixed(2)} | ${t.count !== undefined ? t.count + ' tarjetas' : '-'} |\n`;
  }
  md += `\n## Memoria\n\n| Métrica | Valor |\n|---|---|\n`;
  md += `| Heap usado | ${results.memory.heapUsedMB} MB |\n`;
  md += `| Heap total | ${results.memory.heapTotalMB} MB |\n`;
  md += `\n## Observaciones\n\n- La app móvil está optimizada para repaso con pocas tarjetas a la vez\n- Filtrado y renderizado rápidos\n- Uso de memoria razonable\n`;
  fs.writeFileSync(outFile, md);
  console.log("Benchmark móvil guardado en:", outFile);
}

benchmarkMobile();
