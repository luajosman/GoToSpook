"use client";

import { useState } from "react";

export type AiState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; data: T }
  | { kind: "error"; message: string; notConfigured: boolean };

type ErrorBody = { status?: string; message?: string };

/** POSTs to one of the /api/ai routes and tracks loading, result and error. */
export function useAi<T>(endpoint: string, initial: T | null = null) {
  const [state, setState] = useState<AiState<T>>(initial ? { kind: "done", data: initial } : { kind: "idle" });

  async function run(body: Record<string, unknown>) {
    setState({ kind: "loading" });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as T & ErrorBody;
      if (!response.ok) {
        setState({ kind: "error", message: data.message ?? "Something went wrong.", notConfigured: data.status === "not_configured" });
        return;
      }
      setState({ kind: "done", data });
    } catch {
      setState({ kind: "error", message: "No connection to the server.", notConfigured: false });
    }
  }

  return { state, run };
}
