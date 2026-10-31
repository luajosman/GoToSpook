/** LinkedIn through Needle: find people at the company, show the campaign, enroll a person, sync what Needle sent. */
import { z } from "zod";
import { withCompany } from "@/lib/outreach/http";
import { campaignInfo, enrollInCampaign, searchLinkedinPeople, syncNeedleLead } from "@/lib/outreach/service";

const person = z.object({ identity: z.string().min(1).max(200), name: z.string().min(1).max(200), headline: z.string().max(400).default(""), profileUrl: z.string().max(400).default("") });

const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("search"), companyId: z.string().min(1), keywords: z.string().max(200).optional(), title: z.string().max(100).optional() }),
  z.object({ op: z.literal("campaign"), companyId: z.string().min(1) }),
  z.object({ op: z.literal("enroll"), companyId: z.string().min(1), person }),
  z.object({ op: z.literal("sync"), companyId: z.string().min(1), eventId: z.string().min(1).max(100) }),
]);

export async function POST(request: Request) {
  return withCompany(request, bodySchema, async (company, body) => {
    if (body.op === "search") return searchLinkedinPeople(company, body);
    if (body.op === "campaign") return campaignInfo();
    if (body.op === "enroll") return enrollInCampaign(company, { person: body.person });
    return syncNeedleLead(company, body.eventId);
  });
}
