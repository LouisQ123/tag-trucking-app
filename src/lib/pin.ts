import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Server-only. A PIN is only ever stored as "salt$hash".
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}$${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function pinMatches(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
