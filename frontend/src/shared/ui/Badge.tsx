import clsx from "clsx";
import type { ReactNode } from "react";
import type { AnalysisStatus } from "../types/api";

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "critical"
  | "high"
  | "medium"
  | "low";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={clsx("badge", `badge-${tone}`, className)}>
      {children}
    </span>
  );
}

export function statusTone(status: AnalysisStatus | string | null | undefined): BadgeTone {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "PARTIAL_SUCCESS":
      return "warning";
    case "FAILED":
    case "TIMEOUT":
    case "CANCELLED":
      return "danger";
    case "RUNNING":
    case "PENDING":
      return "info";
    default:
      return "neutral";
  }
}

export function severityTone(severity: string | null | undefined): BadgeTone {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}