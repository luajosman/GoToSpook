/**
 * File cache for external calls: data/cache/<provider>/<key>.json (git-ignored).
 * Check it before every call; reruns during the demo must be instant and free.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";

export const DEFAULT_CACHE_ROOT = path.join(process.cwd(), "data", "cache");

export type CacheEntry<T> = { storedAt: string; meta?: Record<string, string>; value: T };

/** A short, stable key from any parts (ids, inputs, prompt versions). */
export function hashKey(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

export function cachePath(provider: string, key: string, root: string = DEFAULT_CACHE_ROOT): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(root, safe(provider), `${safe(key)}.json`);
}

/** Returns the cached entry, or null when missing or no longer matching the schema. */
export function readCache<T>(provider: string, key: string, schema: z.ZodType<T>, root?: string): CacheEntry<T> | null {
  const file = cachePath(provider, key, root);
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { storedAt?: unknown; meta?: Record<string, string>; value?: unknown };
    const value = schema.parse(raw.value);
    return { storedAt: typeof raw.storedAt === "string" ? raw.storedAt : "", meta: raw.meta, value };
  } catch {
    return null;
  }
}

export function writeCache<T>(provider: string, key: string, value: T, meta?: Record<string, string>, root?: string): CacheEntry<T> {
  const file = cachePath(provider, key, root);
  mkdirSync(path.dirname(file), { recursive: true });
  const entry: CacheEntry<T> = { storedAt: new Date().toISOString(), meta, value };
  writeFileSync(file, JSON.stringify(entry, null, 2) + "\n");
  return entry;
}
