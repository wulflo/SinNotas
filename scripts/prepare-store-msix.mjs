/**
 * Genera el AppxManifest.xml para el paquete MSIX de Microsoft Store.
 *
 * La identidad no se puede inventar: `MS_STORE_PACKAGE_NAME` y
 * `MS_STORE_PUBLISHER` tienen que ser exactamente los valores de
 * Partner Center → Product management → Product identity. El publisher por
 * defecto es el ID de la cuenta; el nombre del paquete lo asigna la Store y
 * no puede contener espacios.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_IDENTITY_NAME = "wulflo.SinNotas";
const DEFAULT_PUBLISHER = "CN=7F51EF66-8407-4798-A8F4-3C4A407DA359";
const RESERVED_NAMES = new Set([
  ".",
  "..",
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** 0.4.10 -> 0.4.10.0; MSIX exige cuatro componentes numéricos. */
function toMsixVersion(version) {
  const base = version.trim().replace(/^v/i, "").split(/[-+]/, 1)[0];
  const parts = base.split(".");
  if (parts.length < 1 || parts.length > 4) {
    fail(`La versión "${version}" no se puede convertir a Major.Minor.Build.Revision.`);
  }
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 65535)) {
    fail(`La versión "${version}" tiene componentes fuera del rango 0-65535.`);
  }
  while (numbers.length < 4) numbers.push(0);
  return numbers.join(".");
}

function validateIdentityName(name) {
  if (name.length < 3 || name.length > 50) {
    fail("MS_STORE_PACKAGE_NAME debe tener entre 3 y 50 caracteres.");
  }
  if (!/^[A-Za-z0-9.-]+$/.test(name)) {
    fail(
      `MS_STORE_PACKAGE_NAME="${name}" contiene caracteres inválidos. ` +
        "Solo se permiten letras, números, puntos y guiones (sin espacios)."
    );
  }
  if (name.endsWith(".") || name.toLowerCase().includes(".xn--")) {
    fail(`MS_STORE_PACKAGE_NAME="${name}" no es un nombre de paquete válido.`);
  }
  if (RESERVED_NAMES.has(name.toLowerCase()) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(name)) {
    fail(`MS_STORE_PACKAGE_NAME="${name}" usa un nombre reservado por Windows.`);
  }
}

const identityName = (process.env.MS_STORE_PACKAGE_NAME ?? DEFAULT_IDENTITY_NAME).trim();
const publisher = (process.env.MS_STORE_PUBLISHER ?? DEFAULT_PUBLISHER).trim();
const displayName = (process.env.MS_STORE_DISPLAY_NAME ?? "Sin Notas").trim();
const publisherDisplayName = (process.env.MS_STORE_PUBLISHER_DISPLAY_NAME ?? "wulflo").trim();
const stagingDir = resolve(process.env.MS_STORE_STAGING_DIR ?? resolve(ROOT, "store-msix"));

if (!identityName) {
  fail(
    "falta MS_STORE_PACKAGE_NAME. Copiá el valor de Partner Center → " +
      "Product management → Product identity → Package/Identity/Name " +
      "(no es el nombre comercial y no puede tener espacios)."
  );
}
validateIdentityName(identityName);

if (!/^CN=.+/.test(publisher)) {
  fail(
    `MS_STORE_PUBLISHER="${publisher}" no empieza con CN=. Copiá el valor de ` +
      "Package/Identity/Publisher en Partner Center."
  );
}

const packageJson = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
const version = toMsixVersion(packageJson.version);

const template = await readFile(
  resolve(ROOT, "packaging/windows-store/AppxManifest.template.xml"),
  "utf8"
);

const manifest = template
  .replaceAll("__IDENTITY_NAME__", xmlEscape(identityName))
  .replaceAll("__PUBLISHER__", xmlEscape(publisher))
  .replaceAll("__VERSION__", version)
  .replaceAll("__DISPLAY_NAME__", xmlEscape(displayName))
  .replaceAll("__PUBLISHER_DISPLAY_NAME__", xmlEscape(publisherDisplayName));

await mkdir(stagingDir, { recursive: true });
const output = resolve(stagingDir, "AppxManifest.xml");
await writeFile(output, manifest, "utf8");

console.log(`Manifest MSIX generado: ${output}`);
console.log(`  Identity:  ${identityName}`);
console.log(`  Publisher: ${publisher}`);
console.log(`  Version:   ${version}`);
