export function validateEndpointUrl(raw: string, kind: "api" | "realtime") {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`URL ${kind} invalida: ${raw}`);
  }

  if (parsed.username || parsed.password) throw new Error(`URL ${kind} nao pode conter credenciais embutidas.`);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]" || parsed.hostname === "::1";
  const allowedProtocol = kind === "api"
    ? (loopback ? ["http:", "https:"] : ["https:"])
    : (loopback ? ["ws:", "wss:"] : ["wss:"]);
  if (!allowedProtocol.includes(parsed.protocol)) {
    const expected = kind === "api" ? "https:// (ou http:// somente em localhost)" : "wss:// (ou ws:// somente em localhost)";
    throw new Error(`URL ${kind} insegura: use ${expected}.`);
  }
  return raw.trim().replace(/\/$/, "");
}
