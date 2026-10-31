/** AI calls through ElevenLabs: start one, or fetch its status and transcript afterwards. */
import { z } from "zod";
import { withCompany } from "@/lib/outreach/http";
import { startCall, syncCall } from "@/lib/outreach/service";

const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("start"), companyId: z.string().min(1), to: z.string().min(3).max(40), contactName: z.string().max(120).optional() }),
  z.object({ op: z.literal("sync"), companyId: z.string().min(1), eventId: z.string().min(1).max(100) }),
]);

export async function POST(request: Request) {
  return withCompany(request, bodySchema, async (company, body) => {
    if (body.op === "start") return startCall(company, { to: body.to, contactName: body.contactName });
    return syncCall(company, body.eventId);
  });
}
