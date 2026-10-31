import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorResponse } from "@/lib/ai/client";
import { welcomeFor } from "@/lib/ai/welcome";
import { findCompany, loadRun } from "@/lib/data";

const bodySchema = z.object({ companyId: z.string().min(1).max(200), refresh: z.boolean().optional() });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "invalid", message: "Send a companyId." }, { status: 400 });
  const run = loadRun();
  const company = findCompany(run, parsed.data.companyId);
  if (!company) return NextResponse.json({ status: "unknown_company", message: "Unknown company." }, { status: 404 });
  if (company.motion !== "welcome") {
    return NextResponse.json({ status: "invalid", message: "Welcome drafts are only for companies in the Welcome motion." }, { status: 400 });
  }
  try {
    const result = await welcomeFor(company, run, { refresh: parsed.data.refresh });
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const { status, body } = aiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
