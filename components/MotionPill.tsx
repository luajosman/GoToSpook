import { MOTION_LABELS } from "@/lib/score/motion";
import type { Motion } from "@/lib/types";

/** Colors per motion: High-touch green, Automated grey, Welcome amber, Check outlined. */
export const MOTION_PILL: Record<Motion, string> = {
  high_touch: "bg-brand-tint text-brand-text",
  automated: "bg-track text-muted",
  welcome: "bg-amber-tint text-amber-text",
  check: "bg-white text-ink border border-line-strong",
};

export const MOTION_DOT: Record<Motion, string> = {
  high_touch: "bg-brand",
  automated: "bg-automated",
  welcome: "bg-amber",
  check: "bg-white border border-mark",
};

export const MOTION_BAR: Record<Motion, string> = {
  high_touch: "bg-brand",
  automated: "bg-automated",
  welcome: "bg-amber",
  check: "bg-white border border-mark",
};

export function MotionPill({ motion, className = "" }: { motion: Motion; className?: string }) {
  const padding = motion === "check" ? "px-[9px] py-[3px]" : "px-2.5 py-1";
  return (
    <span className={`inline-flex items-center rounded-full text-[13px] font-semibold whitespace-nowrap ${padding} ${MOTION_PILL[motion]} ${className}`}>
      {MOTION_LABELS[motion]}
    </span>
  );
}
