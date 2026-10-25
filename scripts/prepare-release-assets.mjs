#!/usr/bin/env node
/**
 * Normaliza los artefactos de una release y genera `latest.json`.
 *
 * Uso:
 *   node scripts/prepare-release-assets.mjs <carpeta> <tag>
 *
 * - Aplana los archivos que `actions/download-artifact` deja en subcarpetas.
 * - Renombra la APK firmada a `app-release.apk` (nombre estable para el
 *   manifiesto de Android).
 * - Genera `latest.json` con las entradas de escritorio que entiende el plugin
 *   oficial de Tauri y la entrada `android-aarch64` que consume la APK.
 * - Falla si falta una plataforma o una firma, para no publicar una release
 *   que dejaría a los usuarios sin poder actualizar.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const REPOSITORY = "wulflo/SinNotas";
const RELEASE_BASE = `https://github.com/${REPOSITORY}/releases/download`;
const MAX_APK_BYTES = 150 * 1024 * 1024;
const REQUIRED_PLATFORMS = [
  "linux-x86_64",
  "windows-x86_64",
  "darwin-aarch64",
  "darwin-x86_64",
  "android-aarch64",
];

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(message);
}

const assetsDir = path.resolve(process.argv[2] ?? "release-assets");
const tag = (process.argv[3] ?? "").trim();

if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
  fail(`El tag "${tag}" no tiene el formato esperado (vX.Y.Z).`);
}
const version = tag.replace(/^v/, "");

if (!existsSync(assetsDir)) {
  fail(`No existe la carpeta de artefactos: ${assetsDir}`);
}

async function collect(dir, accumulator) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(full, accumulator);
    else if (entry.isFile()) accumulator.push(full);
  }
  return accumulator;
}

const collected = await collect(assetsDir, []);
if (collected.length === 0) fail("No se descargó ningún artefacto.");

// Aplanar: las acciones de upload pueden conservar subcarpetas (nsis/, deb/…).
const seen = new Map();
for (const source of collected) {
  const name = path.basename(source);
  if (seen.has(name)) {
    fail(`Dos artefactos comparten el nombre "${name}": ${seen.get(name)} y ${source}`);
  }
  seen.set(name, source);
  if (path.dirname(source) !== assetsDir) {
    await rename(source, path.join(assetsDir, name));
  }
}

// Borrar subcarpetas ya vacías para que la publicación no incluya basura.
for (const entry of await readdir(assetsDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    await rm(path.join(assetsDir, entry.name), { recursive: true, force: true });
  }
}

let files = (await readdir(assetsDir)).filter((name) => {
  return !name.startsWith(".") && existsSync(path.join(assetsDir, name));
});

// La APK firmada se publica siempre con un nombre estable.
const apks = files.filter((name) => name.toLowerCase().endsWith(".apk"));
if (apks.length !== 1) {
  fail(`Se esperaba exactamente una APK; encontradas ${apks.length}: ${apks.join(", ") || "ninguna"}`);
}
const apkName = "app-release.apk";
if (apks[0] !== apkName) {
  await rename(path.join(assetsDir, apks[0]), path.join(assetsDir, apkName));
  files = files.map((name) => (name === apks[0] ? apkName : name));
}

function findOne(predicate, description) {
  const matches = files.filter((name) => predicate(name.toLowerCase()));
  if (matches.length === 0) fail(`No se encontró ${description}.`);
  if (matches.length > 1) {
    fail(`Se encontraron varios candidatos para ${description}: ${matches.join(", ")}`);
  }
  return matches[0];
}

async function signatureFor(fileName) {
  const sigPath = path.join(assetsDir, `${fileName}.sig`);
  if (!existsSync(sigPath)) {
    fail(
      `Falta la firma de ${fileName}. Revisá que TAURI_SIGNING_PRIVATE_KEY esté configurado ` +
        `y que el build use createUpdaterArtifacts.`
    );
  }
  const signature = (await readFile(sigPath, "utf8")).trim();
  if (!signature) fail(`La firma ${fileName}.sig está vacía.`);
  return signature;
}

function releaseUrl(fileName) {
  return `${RELEASE_BASE}/${encodeURIComponent(tag)}/${encodeURIComponent(fileName)}`;
}

const platforms = {};

async function addUpdaterPlatform(key, fileName) {
  const signature = await signatureFor(fileName);
  platforms[key] = { signature, url: releaseUrl(fileName) };
  info(`  ${key} -> ${fileName}`);
}

// Linux: el actualizador oficial solo soporta AppImage.
const appImageUpdater = findOne(
  (name) => name.endsWith(".appimage.tar.gz"),
  "el archivo .AppImage.tar.gz del actualizador"
);
await addUpdaterPlatform("linux-x86_64", appImageUpdater);

// Windows: se prefiere el instalador NSIS (.exe); si no hay, MSI.
const windowsCandidates = files.filter(
  (name) => /\.(exe|msi)$/i.test(name) && existsSync(path.join(assetsDir, `${name}.sig`))
);
const windowsUpdater =
  windowsCandidates.find((name) => name.toLowerCase().endsWith(".exe")) ??
  windowsCandidates.find((name) => name.toLowerCase().endsWith(".msi"));
if (!windowsUpdater) {
  fail("No se encontró un instalador de Windows con firma (.exe o .msi).");
}
await addUpdaterPlatform("windows-x86_64", windowsUpdater);

// macOS: el build universal produce un único .app.tar.gz válido para ambas
// arquitecturas.
const macUpdater = findOne(
  (name) => name.endsWith(".app.tar.gz"),
  "el archivo .app.tar.gz del actualizador"
);
await addUpdaterPlatform("darwin-aarch64", macUpdater);
await addUpdaterPlatform("darwin-x86_64", macUpdater);

// Android: no usa el plugin nativo. Se publica tamaño y SHA-256 para que la
// app verifique la descarga antes de guardarla.
const apkPath = path.join(assetsDir, apkName);
const apkInfo = await stat(apkPath);
if (apkInfo.size <= 0 || apkInfo.size > MAX_APK_BYTES) {
  fail(`La APK pesa ${apkInfo.size} bytes, fuera del rango permitido.`);
}
const apkBytes = await readFile(apkPath);
const apkSha256 = createHash("sha256").update(apkBytes).digest("hex");
platforms["android-aarch64"] = {
  signature: apkSha256,
  url: releaseUrl(apkName),
  size: apkInfo.size,
  sha256: apkSha256,
};
info(`  android-aarch64 -> ${apkName} (${apkInfo.size} bytes, sha256 ${apkSha256.slice(0, 12)}…)`);

const missing = REQUIRED_PLATFORMS.filter((key) => !platforms[key]);
if (missing.length > 0) fail(`Faltan plataformas en latest.json: ${missing.join(", ")}`);

// Guardia: ningún JSON publicado debe contener material de clave privada.
for (const fileName of files) {
  if (!/\.(json|txt|md)$/i.test(fileName)) continue;
  const content = await readFile(path.join(assetsDir, fileName), "utf8");
  if (/PRIVATE KEY|minisign encrypted secret key/i.test(content)) {
    fail(`El archivo ${fileName} parece contener una clave privada. Se abortó la publicación.`);
  }
}

const manifest = {
  version,
  notes: `Sin Notas ${version}. Instaladores y actualizaciones automáticas.`,
  pub_date: new Date().toISOString(),
  platforms,
};

await writeFile(
  path.join(assetsDir, "latest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

files = await readdir(assetsDir);
info("\nArtefactos listos para publicar:");
for (const fileName of files.sort()) {
  const infoStat = await stat(path.join(assetsDir, fileName));
  info(`  - ${fileName} (${infoStat.size} bytes)`);
}
info(`\nlatest.json generado para v${version} con ${Object.keys(platforms).length} plataformas.`);
