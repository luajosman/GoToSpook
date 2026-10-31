/** Small RFC 4180 CSV reader: quoted fields, escaped quotes, commas and line breaks inside quotes. */

export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const sep = delimiter ?? guessDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** German exports often use semicolons. */
function guessDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** Rows as objects keyed by the header row. */
export function csvObjects(text: string, delimiter?: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text, delimiter);
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** First non-empty value among header aliases, compared case- and accent-insensitively. */
export function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const wanted = new Set(aliases.map(norm));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.has(norm(key)) && value.trim()) return value.trim();
  }
  return undefined;
}
