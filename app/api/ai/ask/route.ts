import { NextResponse } from "next/server";
import { z } from "zod";
import { askRun, questionSchema } from "@/lib/ai/ask";
import { aiErrorResponse } from "@/lib/ai/client";
import { loadRun } from "@/lib/data";

const bodySchema = z.object({ question: questionSchema });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid", message: parsed.error.issues[0]?.message ?? "Send a question." }, { status: 400 });
  }
  try {
    const result = await askRun(loadRun(), parsed.data.question);
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const { status, body } = aiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
