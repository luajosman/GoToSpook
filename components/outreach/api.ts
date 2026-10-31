"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; notConfigured: boolean };

/** POSTs to an outreach route and unwraps { status, result | message }. */
export async function postOutreach<T>(url: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await response.json()) as { status?: string; result?: T; message?: string };
    if (response.ok && json.status === "ok") return { ok: true, data: json.result as T };
    return { ok: false, message: json.message ?? "Something went wrong.", notConfigured: json.status === "not_configured" };
  } catch {
    return { ok: false, message: "No connection to the server.", notConfigured: false };
  }
}
