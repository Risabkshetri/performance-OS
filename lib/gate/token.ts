/**
 * Passcode gate. The cookie holds an HMAC of a fixed label keyed by
 * APP_PASSCODE, so it can't be forged without the passcode, and changing the
 * passcode locks every device out. Works in the proxy and in server code.
 */
export const GATE_COOKIE = "pos_gate";
export const GATE_MAX_AGE = 60 * 60 * 24 * 365; // one year

export function gatePasscode(): string | null {
  const p = process.env.APP_PASSCODE?.trim();
  return p ? p : null;
}

export async function gateToken(passcode: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(passcode), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("performance-os/gate/v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
