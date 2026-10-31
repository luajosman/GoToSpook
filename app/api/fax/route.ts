/**
 * POST /api/fax: sends the offer fax for one company, only with a fax number the visitor
 * typed on the personal page and a ticked consent box, at most once per company per hour.
 * The body is validated with zod; nothing here reaches the browser except the outcome.
 */
import { NextResponse } from "next/server";
import { findCompany, loadRun } from "@/lib/data";
import { FileFaxLog } from "@/lib/fax/log";
import { sendOffer, type SendOfferOutcome } from "@/lib/fax/send-offer";

const HTTP_STATUS: Record<SendOfferOutcome["status"], number> = {
  sent: 200,
  invalid: 400,
  unknown_company: 404,
  rate_limited: 429,
  not_configured: 503,
  failed: 502,
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid", message: "Ungültige Anfrage.", issues: [] }, { status: 400 });
  }

  const run = loadRun();
  const outcome = await sendOffer(body, {
    findCompany: (id) => findCompany(run, id),
    log: new FileFaxLog(),
  });

  const headers: Record<string, string> = {};
  if (outcome.status === "rate_limited") {
    const seconds = Math.max(1, Math.ceil((new Date(outcome.retryAt).getTime() - Date.now()) / 1000));
    headers["Retry-After"] = String(seconds);
  }
  if (outcome.status === "unknown_company") {
    return NextResponse.json({ ...outcome, message: "Diese Seite kennen wir nicht." }, { status: 404 });
  }
  return NextResponse.json(outcome, { status: HTTP_STATUS[outcome.status], headers });
}
