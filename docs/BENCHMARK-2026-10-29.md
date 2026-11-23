# Benchmark de rendimiento

**Fecha:** 2026-10-29T03:27:20.686Z

**Configuración:** 1000 notas × 100 bloques = 100000 bloques

## Operaciones

| Operación | Tiempo (ms) | Notas |
|---|---|---|
| create_100k_blocks | 61.21 | - |
| scan_all_blocks_for_tag | 11.66 | 100000 coincidencias |

## Memoria

| Métrica | Valor |
|---|---|
| Heap usado | 20.93 MB |
| Heap total | 49.04 MB |

## Caché de metadatos Rust (T9)

Método: `bash scripts/benchmark-cache.sh <notas>` en perfil `release`. La
bóveda generada vive en un directorio temporal y se elimina al terminar. La
primera lectura es fría (parseo completo + escritura de caché) y la segunda es
caliente (barrido de mtimes + carga de bincode).

| Notas | Frío | Caliente | Aceleración |
| --- | ---: | ---: | ---: |
| 5.000 | 1.446,71 ms | 253,82 ms | 5,70× |
| 20.000 | 5.423,30 ms | 1.019,74 ms | 5,32× |

Lectura: el coste crece de forma aproximadamente lineal con el número de
notas. Con 20.000 notas el arranque en caliente ronda 1 s solo para metadata;
el editor debe pintar después. Es el principal motivo para no invalidar la
caché en cada arranque.

## Bóveda sintética en el navegador

Método: 5.000 notas × 30 bloques (150.000 bloques), 10.000 tarjetas
potenciales, ejecutado en la pestaña de desarrollo con los módulos reales
(`ContentSearchIndex`, `FlashcardsManager.scanPages`, `GraphView.updateData`).
Los tiempos son de la operación síncrona, no incluyen el primer pintado.

| Operación | Tiempo | Observaciones |
| --- | ---: | --- |
| Construir índice de contenido | 182,30 ms | 150.000 bloques |
| Buscar “relleno 12” (25 resultados) | 41,80 ms | después del debounce |
| Escanear tarjetas | 1.415,70 ms | 10.000 tarjetas; en la app va por lotes |
| Grafo: `updateData` | 91,00 ms | 5.000 nodos, 5.000 enlaces |
| Heap JS tras las pruebas | 195 MB | incluye la app y la bóveda sintética |

## Comparación y conclusiones

No había una medición equivalente en la línea base `v0.3.5`; estas cifras son
la referencia para las próximas fases. Las optimizaciones ya presentes que
explican parte del resultado:

- El grafo solo reconstruye nodos cuando cambia la versión del vault o se
  entra/sale de la vecindad (T5 usa esta misma guarda).
- El índice de contenido se reconstruye por versión, no en cada tecla.
- El escaneo de flashcards se hace en lotes con caché por versión; la cifra de
  1,4 s es el coste total del escaneo, no un bloqueo de la interfaz.

Riesgos detectados: con 5.000 notas el grafo y el índice siguen por debajo de
los 200 ms en la operación síncrona; el escaneo completo de tarjetas es el
punto más caro y debe mantenerse por lotes. El heap de la prueba sintética no
es comparable con una sesión normal porque retiene todos los objetos generados.

### Línea base `ffd40a5` (v0.3.5)

El mismo benchmark de caché con 5.000 notas sobre un worktree limpio del commit
base:

| Revisión | Frío | Caliente |
| --- | ---: | ---: |
| `ffd40a5` (base) | 1.356,84 ms | 263,22 ms |
| Cambios actuales | 1.446,71 ms | 253,82 ms |

La diferencia está dentro del ruido de una única ejecución (≈6 % en frío,
≈4 % en caliente). No se observa una regresión atribuible a los cambios de
mantenimiento; para afirmarlo con rigor harían falta varias repeticiones y la
misma máquina descargada. El resto de comparaciones antes/después de vistas
queda pendiente de una bóveda real en Tauri.
