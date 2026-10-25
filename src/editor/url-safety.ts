/**
 * Comprobaciones de destino para URLs que llegan desde contenido no confiable
 * (por ejemplo, una imagen remota pegada en una nota).
 *
 * La regla es deliberadamente conservadora: solo se permiten `http:` y
 * `https:` hacia hosts públicos. Cualquier host local, privado, link-local o
 * reservado se rechaza antes de hacer la petición.
 */

function parseIpv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10
    a === 127 || // 127.0.0.0/8
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

function parseIpv6(host: string): number[] | null {
  let value = host.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  const zoneIndex = value.indexOf("%");
  if (zoneIndex >= 0) value = value.slice(0, zoneIndex);
  if (!value.includes(":")) return null;

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (!part) return [];
    const pieces = part.split(":");
    const groups: number[] = [];
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      if (!piece) return null;
      if (piece.includes(".")) {
        if (index !== pieces.length - 1) return null;
        const ipv4 = parseIpv4(piece);
        if (!ipv4) return null;
        groups.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0]);
  if (!head) return null;

  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const tail = parseGroups(halves[1]);
  if (!tail) return null;
  // `::` debe comprimir al menos un grupo de 16 bits.
  if (head.length + tail.length > 7) return null;

  return [
    ...head,
    ...Array<number>(8 - head.length - tail.length).fill(0),
    ...tail,
  ];
}

export function isPrivateOrLocalHostname(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  host = host.replace(/\.+$/, "");
  if (!host) return true;

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  const ipv4 = parseIpv4(host);
  if (ipv4) return isPrivateIpv4(ipv4);
  // Si parece una IPv4 pero no es válida, rechazarla en vez de adivinar.
  if (/^\d+(?:\.\d+){3}$/.test(host)) return true;

  if (!host.includes(":")) return false;

  const groups = parseIpv6(host);
  if (!groups) return true;

  const [first, second, third, fourth, fifth, sixth] = groups;
  if (groups.every((group) => group === 0)) return true; // ::
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) {
    return true; // ::1
  }
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if (
    first === 0 &&
    second === 0 &&
    third === 0 &&
    fourth === 0 &&
    fifth === 0 &&
    sixth === 0xffff
  ) {
    return true; // ::ffff:0:0/96 (IPv4-mapped)
  }

  return false;
}

export function isAllowedRemoteImageUrl(
  urlString: string,
  baseHref = "https://sinnotas.invalid/",
): boolean {
  if (!urlString.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(urlString, baseHref);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return !isPrivateOrLocalHostname(parsed.hostname);
}
