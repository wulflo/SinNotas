# Persistent metadata cache

SinNotas stores pages as Markdown files, so the vault remains the source of
truth. Parsing thousands of notes on every launch, however, blocks the first
paint. The metadata cache keeps the parsed result of each note in a binary file
and turns startup into an mtime sweep that only re-parses what changed.

## Files

| Path | Purpose |
| --- | --- |
| `<vault>/.sinnotas_cache.bin` | Binary cache (magic `SNC1` + bincode payload) |
| `src-tauri/src/metadata_cache.rs` | Cache format, validation, cold/warm scan, backlinks |
| `src-tauri/src/lib.rs` (`VaultCacheRuntime`) | Watcher, incremental deltas and Tauri integration |
| `src-tauri/examples/cache_benchmark.rs` | 5,000-note benchmark |
| `scripts/benchmark-cache.sh` | Benchmark wrapper |

The cache is only used for local filesystem vaults. Android SAF vaults keep
their own index and never write `.sinnotas_cache.bin`; the native watcher
(`notify`) is compiled only for desktop targets.

## What is cached

Each entry stores:

- normalized relative path, mtime in nanoseconds, size and a stable content hash;
- the parsed block tree and frontmatter (already converted to `PageData`);
- lightweight flashcard counters (basic/cloze/image-occlusion) and whether the
  note has cards;
- extracted `[[wikilinks]]` and `#tags` with line number and snippet.

The cached backlink index lets `find_backlinks` answer without reopening every
note. The frontend still runs the canonical flashcard detector, so the cache
does not change FSRS behavior or `FlashcardLoader` batches.

## Cold vs. warm startup

`load_or_scan_vault`:

1. Reads `<vault>/.sinnotas_cache.bin`. Missing, corrupted, foreign or
   version-mismatched files are treated as a cache miss.
2. Walks the vault with `WalkDir`, skipping reserved folders.
3. For each `.md`, reads only `std::fs::metadata` and compares `modified_ns` and
   `size` with the entry. A match reuses the parsed note; otherwise the file is
   read and parsed.
4. Drops entries whose files disappeared and writes the cache atomically
   (temporary file + rename) when anything changed.

A note is re-parsed when its mtime or size changes, so edits made by another
application are picked up on the next launch. The first run after adding the
cache is a cold run; subsequent runs are warm.

## Filesystem watcher

On desktop, `notify::recommended_watcher` watches the active vault recursively.
Events are collected in a set, coalesced for 150 ms (atomic saves and renames
produce bursts) and applied by a worker thread. For each path the worker:

- reads only that note and updates/removes its cache entry;
- compares mtime, size and content hash so duplicate events are no-ops;
- persists the cache and emits `vault-cache-delta` to the webview with the
  changed `PageData`, removed paths and a monotonic revision.

Own writes (`save_page`, `delete_page`, `rename_page`) update the cache directly
and do not emit a delta: the editor already has that content. The frontend
applies external deltas with `VaultStore.applyExternalDelta`, invalidates the
flashcard cache, refreshes the sidebar/lists and schedules the graph data
evaluation on the next `requestAnimationFrame`. While the editor has a page
open, that page is not replaced underneath the caret; local edits win until the
page is reloaded. The graph physics loop is untouched.

## Security

The cache file is user-writable data, so it is treated as untrusted input:

- every relative path is revalidated by `resolve_note_path` (no `..`, absolute
  paths, URIs, NUL bytes, backslashes, reserved folders or temp-file names);
- the cache only accepts `.md` paths and re-checks that the title matches the
  file stem;
- block depth, block count, block content, frontmatter, link and title sizes are
  bounded before a `PageData` is produced;
- symlinked cache files are rejected, writes use an exclusive temporary file in
  the vault root and rename atomically;
- invalid entries are dropped instead of failing the vault load.

A malicious or corrupted cache can therefore cause a cold re-parse, but cannot
add notes outside the approved vault or bypass the path whitelist.

## Tests

Rust unit tests cover:

- bincode round-trip through disk;
- corrupt and foreign cache files;
- traversal, reserved-folder and title-spoofing rejection;
- warm scan reuse, mixed modified/new notes and stale-entry removal;
- cached backlink lookup.

Run them with:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## Benchmark

```bash
scripts/benchmark-cache.sh 5000
```

The script creates a temporary vault with 5,000 Markdown notes, measures a cold
full parse (including the cache write) and a warm mtime + bincode scan, prints
the speedup, verifies that the warm scan parsed zero notes, and deletes the
temporary vault.

Reference run (Linux, release build, 5,000 notes):

```text
cold     754.82 ms  notes=5000 parsed=5000 reused=0 cache_loaded=false written=true
warm     250.36 ms  notes=5000 parsed=0    reused=5000 cache_loaded=true written=false
cold: 754.82 ms | warm: 250.36 ms | speedup: 3.01x
```

Exact numbers depend on the filesystem and disk cache. The relevant invariant
is `parsed=0` on the warm run: no Markdown is re-parsed.
