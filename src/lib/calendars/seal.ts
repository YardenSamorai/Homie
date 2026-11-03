import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * CALENDAR_TOKEN_KEY: 32 random bytes, base64 (`openssl rand -base64 32`). It seals provider tokens before they
 * reach the database and signs the short-lived OAuth cookie. Without it, connecting calendars stays off.
 */
function key(): Buffer | null {
  const raw = process.env.CALENDAR_TOKEN_KEY?.trim();
  if (!raw) return null;
  const bytes = Buffer.from(raw, "base64");
  return bytes.length === 32 ? bytes : null;
}

export const sealingReady = () => key() !== null;

/** AES-256-GCM. `context` (the account id, or "oauth") is bound in, so a sealed value can't be replayed elsewhere. */
export function seal(plain: string, context: string): string {
  const secret = key();
  if (!secret) throw new Error("CALENDAR_TOKEN_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function unseal(sealed: string, context: string): string | null {
  const secret = key();
  const [version, iv, tag, body] = sealed.split(".");
  if (!secret || version !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** PKCE S256 (RFC 7636): the challenge sent to the provider for a verifier kept on the server side. */
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function sameToken(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** A short, stable name for a provider object, without putting the provider's ids in more places than needed. */
export const stableKey = (...parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);
