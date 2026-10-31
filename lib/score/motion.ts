/**
 * Motion rules, in this order: welcome (registered in the last 90 days), check (low confidence
 * near the threshold), high_touch (at or above the threshold), automated (the rest).
 */
import { config } from "../config";
import type { Company, Estimate, Motion } from "../types";

export const MOTION_ORDER: readonly Motion[] = ["welcome", "check", "high_touch", "automated"];

export const MOTION_LABELS: Record<Motion, string> = {
  high_touch: "High-touch",
  automated: "Automated",
  welcome: "Welcome",
  check: "Check",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then) / DAY_MS);
}

function euro(value: number): string {
  return `€${Math.round(value).toLocaleString("en-US")}`;
}

export function assignMotion(
  company: Pick<Company, "registeredAt">,
  estimate: Pick<Estimate, "acv" | "confidence">,
  threshold: number,
  now: Date,
): { motion: Motion; motionReason: string } {
  const { welcomeDays, checkBand } = config.routing;
  const acv = estimate.acv;

  if (company.registeredAt) {
    const days = daysSince(company.registeredAt, now);
    if (days >= 0 && days <= welcomeDays) {
      return {
        motion: "welcome",
        motionReason: `Registered ${days} days ago, so it gets an early hello before it has picked its tools.`,
      };
    }
  }

  const band = checkBand * threshold;
  if (estimate.confidence === "low" && Math.abs(acv - threshold) <= band) {
    return {
      motion: "check",
      motionReason: `Low confidence and a predicted ACV of ${euro(acv)} within ${Math.round(checkBand * 100)}% of the ${euro(threshold)} threshold, so a person checks the size first.`,
    };
  }

  if (acv >= threshold) {
    return {
      motion: "high_touch",
      motionReason: `Predicted ACV of ${euro(acv)} is at or above the ${euro(threshold)} threshold, so a named rep owns the account.`,
    };
  }

  return {
    motion: "automated",
    motionReason: `Predicted ACV of ${euro(acv)} is below the ${euro(threshold)} threshold, so the company finds, tries and buys on its own.`,
  };
}
