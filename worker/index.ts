/**
 * Cloudflare Worker: HTTP Basic Auth in front of the static site (pages, assets, JSON data).
 * wrangler.jsonc serves dist/ through the ASSETS binding with run_worker_first, so every request
 * passes through here. Credentials come from the Worker secrets BASIC_AUTH_USER and
 * BASIC_AUTH_PASSWORD; locally from .dev.vars (see .dev.vars.example).
 */

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASSWORD?: string;
}

/** Compares two strings in constant time by comparing their SHA-256 digests byte by byte. */
async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const p = new Uint8Array(x);
  const q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

/** Decodes "user:password" from a Basic Authorization header; null if malformed. */
function credentials(header: string | null): [string, string] | null {
  const [scheme, encoded] = (header ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes); // passwords may contain umlauts
    const i = decoded.indexOf(":");
    return i < 0 ? null : [decoded.slice(0, i), decoded.slice(i + 1)];
  } catch {
    return null;
  }
}

const unauthorized = () =>
  new Response("Anmeldung erforderlich.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Querverweise", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const user = env.BASIC_AUTH_USER;
    const password = env.BASIC_AUTH_PASSWORD;
    if (!user || !password) {
      // fail closed: a missing secret must not expose the site
      return new Response("Zugangsdaten sind nicht konfiguriert.", { status: 500 });
    }
    const given = credentials(request.headers.get("Authorization"));
    if (!given) return unauthorized();
    const [okUser, okPassword] = await Promise.all([same(given[0], user), same(given[1], password)]);
    return okUser && okPassword ? env.ASSETS.fetch(request) : unauthorized();
  },
};
