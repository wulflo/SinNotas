import { describe, expect, it } from "vitest";
import { isSafVaultRoot } from "./vault";

describe("isSafVaultRoot", () => {
  it("reconoce el DirPath serializado por el plugin android-fs", () => {
    expect(
      isSafVaultRoot('{"topTreeUri":"content://com.android.externalstorage.documents/tree/primary%3ASinNotas","relativeTerms":[]}')
    ).toBe(true);
    expect(isSafVaultRoot('  {"topTreeUri":"content://provider/tree/notes"}  ')).toBe(true);
  });

  it("no confunde rutas locales ni JSON ajeno con una bóveda SAF", () => {
    expect(isSafVaultRoot("/home/usuario/SinNotas")).toBe(false);
    expect(isSafVaultRoot("C:\\Documentos\\SinNotas")).toBe(false);
    expect(isSafVaultRoot(null)).toBe(false);
    expect(isSafVaultRoot("")).toBe(false);
    expect(isSafVaultRoot('{"topTreeUri":"file:///tmp/notas"}')).toBe(false);
    expect(isSafVaultRoot('{"otro":1}')).toBe(false);
    expect(isSafVaultRoot("{no es json")).toBe(false);
  });
});
