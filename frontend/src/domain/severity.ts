import type { Severity } from "./analysisTypes";

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 50,
  high: 40,
  medium: 30,
  low: 20,
  info: 10
};

export function normalizeSeverity(value: string | null | undefined): Severity {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";

  return "info";
}

export function getSeverityRuLabel(severity: Severity | string | null | undefined): string {
  switch (normalizeSeverity(severity)) {
    case "critical":
      return "Критично";
    case "high":
      return "Высокий риск";
    case "medium":
      return "Средний риск";
    case "low":
      return "Низкий риск";
    case "info":
      return "Информация";
    default:
      return "Информация";
  }
}

export function isRiskSeverity(severity: Severity): boolean {
  return severity === "critical" || severity === "high" || severity === "medium" || severity === "low";
}