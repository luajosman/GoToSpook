/** Shared request handling for the outreach routes. */
import { NextResponse } from "next/server";
import type { z } from "zod";
import { ElevenLabsError, ElevenLabsNotConfiguredError } from "../connectors/elevenlabs";
import { NeedleError, NeedleNotConfiguredError } from "../connectors/needle";
import { findCompany, loadRun } from "../data";
import type { ScoredCompany } from "../types";
import { OutreachBlockedError } from "./service";

export async function withCompany<T extends { companyId: string }>(
  request: Request,
  schema: z.ZodType<T>,
  handle: (company: ScoredCompany, body: T) => Promise<unknown>,
): Promise<NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const company = findCompany(loadRun(), parsed.data.companyId);
  if (!company) return NextResponse.json({ status: "unknown_company", message: "Unknown company." }, { status: 404 });
  try {
    return NextResponse.json({ status: "ok", result: await handle(company, parsed.data) });
  } catch (error) {
    if (error instanceof NeedleNotConfiguredError || error instanceof ElevenLabsNotConfiguredError) {
      return NextResponse.json({ status: "not_configured", message: error.message, missing: error.missing }, { status: 503 });
    }
    if (error instanceof OutreachBlockedError) return NextResponse.json({ status: "blocked", message: error.message }, { status: 409 });
    if (error instanceof NeedleError || error instanceof ElevenLabsError) return NextResponse.json({ status: "failed", message: error.message }, { status: 502 });
    return NextResponse.json({ status: "failed", message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
