/** Fax numbers: accept the usual German spellings, store E.164. */

/** Returns the E.164 number, or null when the input is not a plausible fax number. */
export function normalizeFaxNumber(input: string): string | null {
  let trimmed = input.trim();
  if (!trimmed) return null;
  // "+49 (0)30 …": the bracketed trunk zero is not dialled from abroad.
  trimmed = trimmed.replace(/^(\+\d{1,3}|00\d{1,3})\s*\(0\)/, "$1");
  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  if (!/^\d+$/.test(digits)) return null;

  let e164: string;
  if (international) {
    e164 = `+${digits}`;
  } else if (digits.startsWith("0")) {
    // National German number: 030 123456 -> +4930123456
    e164 = `+49${digits.slice(1)}`;
  } else {
    return null;
  }
  const length = e164.length - 1;
  if (length < 8 || length > 15) return null;
  return e164;
}
