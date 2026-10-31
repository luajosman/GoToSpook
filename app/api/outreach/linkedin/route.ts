/** LinkedIn outreach through Needle: find people at the company, draft a message, send it. */
import { z } from "zod";
import { withCompany } from "@/lib/outreach/http";
import { previewLinkedinMessage, searchLinkedinPeople, sendLinkedin } from "@/lib/outreach/service";

const person = z.object({ identity: z.string().min(1).max(200), name: z.string().min(1).max(200), headline: z.string().max(400).default(""), profileUrl: z.string().max(400).default("") });

const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("search"), companyId: z.string().min(1), keywords: z.string().max(200).optional(), title: z.string().max(100).optional() }),
  z.object({ op: z.literal("preview"), companyId: z.string().min(1), identity: z.string().min(1).max(200), prompt: z.string().max(2000).optional() }),
  z.object({ op: z.literal("send"), companyId: z.string().min(1), person, action: z.enum(["invitation", "message"]), text: z.string().min(1).max(3000) }),
]);

export async function POST(request: Request) {
  return withCompany(request, bodySchema, async (company, body) => {
    if (body.op === "search") return searchLinkedinPeople(company, body);
    if (body.op === "preview") return previewLinkedinMessage(company, body.identity, body.prompt);
    return sendLinkedin(company, { person: body.person, action: body.action, text: body.text });
  });
}
