#!/usr/bin/env node
/**
 * Genera el juego de iconos exclusivo de Android a partir de
 * `src-tauri/icons/icon-manifest.android.json`.
 *
 * El manifiesto de escritorio (`icon-manifest.json`) no se toca: los iconos de
 * Windows/macOS/Linux siguen generándose con `tauri icon` y su fuente propia.
 * Este script escribe el resultado en `src-tauri/icons/android/` y, si existe
 * el proyecto nativo, también en `src-tauri/gen/android/app/src/main/res/`,
 * que es de donde empaqueta la APK.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const manifest = path.join(root, "src-tauri", "icons", "icon-manifest.android.json");
const iconsTarget = path.join(root, "src-tauri", "icons", "android");
const androidRes = path.join(
  root,
  "src-tauri",
  "gen",
  "android",
  "app",
  "src",
  "main",
  "res",
);

/** Copia el contenido de `src` dentro de `dest` sin anidar la carpeta. */
function copyContents(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    cpSync(path.join(src, entry.name), path.join(dest, entry.name), { recursive: true });
  }
}

if (!existsSync(cli)) {
  console.error("No se encontró el CLI de Tauri. Ejecuta `npm install` primero.");
  process.exit(1);
}
if (!existsSync(manifest)) {
  console.error(`No se encontró el manifiesto de Android: ${manifest}`);
  process.exit(1);
}

const output = mkdtempSync(path.join(tmpdir(), "sinnotas-android-icons-"));
try {
  const result = spawnSync(
    process.execPath,
    [cli, "icon", manifest, "-o", output],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const generated = path.join(output, "android");
  if (!existsSync(generated)) {
    console.error("Tauri no generó la carpeta `android` de iconos.");
    process.exit(1);
  }

  // Iconos versionados de Android. Se mantienen separados de los de escritorio
  // para que un build de escritorio no pueda reutilizar el logo del APK. Se
  // reemplaza la carpeta completa para no conservar assets de una generación
  // anterior (por ejemplo, XML de iconos que el CLI ya no produce).
  rmSync(iconsTarget, { recursive: true, force: true });
  copyContents(generated, iconsTarget);

  if (existsSync(androidRes)) {
    copyContents(generated, androidRes);
    console.log("Iconos de Android copiados a gen/android.");
  } else {
    console.log(
      "Proyecto nativo no inicializado; ejecuta `npm run tauri android init -- --ci` y repite.",
    );
  }

  console.log("Iconos de Android actualizados. Los iconos de escritorio no cambiaron.");
} finally {
  rmSync(output, { recursive: true, force: true });
}
