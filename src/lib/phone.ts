// Normalizes a US-style phone number to E.164 (e.g. "+15551234567") for use
// as a Supabase Auth identifier. Returns null if it doesn't look like a
// valid 10 (or 11, with leading 1) digit US number.
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
