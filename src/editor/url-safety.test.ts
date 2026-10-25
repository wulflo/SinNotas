import { describe, expect, it } from "vitest";
import { isAllowedRemoteImageUrl, isPrivateOrLocalHostname } from "./url-safety";

describe("isPrivateOrLocalHostname", () => {
  it("bloquea nombres locales y reservados", () => {
    for (const host of [
      "localhost",
      "LOCALHOST",
      "localhost.",
      "app.localhost",
      "app.localhost.",
      "printer.local",
      "servicio.internal",
    ]) {
      expect(isPrivateOrLocalHostname(host), host).toBe(true);
    }
    expect(isPrivateOrLocalHostname("")).toBe(true);
    expect(isPrivateOrLocalHostname("   ")).toBe(true);
  });

  it("bloquea los rangos IPv4 privados y reservados", () => {
    for (const host of [
      "0.0.0.0",
      "0.1.2.3",
      "10.0.0.1",
      "10.255.255.255",
      "100.64.0.1",
      "100.127.255.255",
      "127.0.0.1",
      "127.255.255.255",
      "169.254.0.1",
      "169.254.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "192.168.255.255",
    ]) {
      expect(isPrivateOrLocalHostname(host), host).toBe(true);
    }
  });

  it("permite IPv4 públicas y direcciones fuera de los rangos bloqueados", () => {
    for (const host of [
      "1.1.1.1",
      "8.8.8.8",
      "100.63.255.255",
      "100.128.0.0",
      "172.15.255.255",
      "172.32.0.0",
      "192.169.0.1",
    ]) {
      expect(isPrivateOrLocalHostname(host), host).toBe(false);
    }
  });

  it("bloquea IPv6 especial, link-local, unique-local y IPv4-mapeada", () => {
    for (const host of [
      "::",
      "::1",
      "[::]",
      "[::1]",
      "0:0:0:0:0:0:0:1",
      "fe80::1",
      "febf::1",
      "fc00::1",
      "fdff::1",
      "::ffff:127.0.0.1",
      "::ffff:8.8.8.8",
      "[::ffff:7f00:1]",
    ]) {
      expect(isPrivateOrLocalHostname(host), host).toBe(true);
    }
  });

  it("permite IPv6 públicas", () => {
    for (const host of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
      expect(isPrivateOrLocalHostname(host), host).toBe(false);
    }
  });

  it("rechaza hosts IPv4 mal formados en lugar de adivinar", () => {
    expect(isPrivateOrLocalHostname("999.1.1.1")).toBe(true);
  });
});

describe("isAllowedRemoteImageUrl", () => {
  const base = "https://app.example/note";

  it("permite solo http(s) hacia hosts públicos", () => {
    expect(isAllowedRemoteImageUrl("https://example.com/image.png", base)).toBe(true);
    expect(isAllowedRemoteImageUrl("http://example.com/image.png", base)).toBe(true);
    expect(isAllowedRemoteImageUrl("../assets/image.png", base)).toBe(true);
  });

  it("bloquea protocolos distintos de http y https", () => {
    for (const url of [
      "ftp://example.com/image.png",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
    ]) {
      expect(isAllowedRemoteImageUrl(url, base), url).toBe(false);
    }
  });

  it("bloquea hosts privados aunque la URL use una forma numérica", () => {
    for (const url of [
      "https://localhost/image.png",
      "https://app.localhost/image.png",
      "https://printer.local/image.png",
      "https://servicio.internal/image.png",
      "https://127.0.0.1/image.png",
      "https://2130706433/image.png",
      "https://0x7f000001/image.png",
      "https://127.1/image.png",
      "https://10.0.0.1/image.png",
      "https://100.64.0.1/image.png",
      "https://169.254.0.1/image.png",
      "https://172.16.0.1/image.png",
      "https://192.168.0.1/image.png",
      "https://[::1]/image.png",
      "https://[fe80::1]/image.png",
      "https://[fc00::1]/image.png",
      "https://[::ffff:127.0.0.1]/image.png",
      "https://example.com@127.0.0.1/image.png",
    ]) {
      expect(isAllowedRemoteImageUrl(url, base), url).toBe(false);
    }
  });

  it("rechaza URLs inválidas", () => {
    expect(isAllowedRemoteImageUrl("http://[::1", base)).toBe(false);
    expect(isAllowedRemoteImageUrl("", base)).toBe(false);
  });
});
