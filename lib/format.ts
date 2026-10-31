/** Number and date formats. English for the app, German for the personal page and letters. */

const EUR_EN = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUR_DE = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const INT_EN = new Intl.NumberFormat("en-US");
const INT_DE = new Intl.NumberFormat("de-DE");
const DATE_EN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
const DATE_DE = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

/** "€17,700" */
export function money(value: number): string {
  return EUR_EN.format(Math.round(value));
}

/** "17.700 €" */
export function moneyDe(value: number): string {
  return EUR_DE.format(Math.round(value));
}

/** "€6k" for scales */
export function moneyK(value: number): string {
  return `€${Math.round(value / 1000)}k`;
}

export function count(value: number): string {
  return INT_EN.format(value);
}

export function countDe(value: number): string {
  return INT_DE.format(value);
}

/** "25 Oct 2026" */
export function dateEn(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_EN.format(date);
}

/** "25.10.2026" */
export function dateDe(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_DE.format(date);
}

/** Two letters from the company name, e.g. "Brandt & Söhne Haustechnik GmbH" → "BS". */
export function initialsOf(name: string): string {
  const words = name
    .split(/[\s&/]+/)
    .map((word) => word.replace(/[^A-Za-zÄÖÜäöüßİı]/g, ""))
    .filter((word) => word.length > 0 && !/^(GmbH|Co|KG|UG|eK|und|AG)$/i.test(word));
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join("") || name.slice(0, 2).toUpperCase();
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
