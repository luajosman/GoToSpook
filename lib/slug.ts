/** Stable company id: a slug from the name (without the legal form) and the zip code. */

const LEGAL_FORM_WORDS = new Set(["gmbh", "co", "kg", "ug", "ek", "e", "k", "ag", "ohg", "haftungsbeschraenkt"]);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => !LEGAL_FORM_WORDS.has(word))
    .join("-");
}

export function companyId(name: string, zip?: string): string {
  const base = slugify(name) || "company";
  return zip ? `${base}-${zip}` : base;
}

/** Name for matching across sources: no legal form, no punctuation, umlauts transliterated. */
export function normalizeName(name: string): string {
  return slugify(name)
    .split("-")
    .filter((word) => word !== "und" && word !== "and")
    .join("");
}
