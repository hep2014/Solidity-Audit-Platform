export const severityOrder: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export function getSeverityLabel(severity: string | null | undefined): string {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "info":
      return "Info";
    default:
      return severity || "Unknown";
  }
}

export function sortSeverityEntries(
  entries: Array<[string, number]>
): Array<[string, number]> {
  return [...entries].sort((a, b) => {
    const left = severityOrder[a[0]?.toLowerCase()] ?? 0;
    const right = severityOrder[b[0]?.toLowerCase()] ?? 0;
    return right - left;
  });
}