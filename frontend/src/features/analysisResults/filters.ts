import type {
  AnalyzerKey,
  ClassifiedFinding,
  FindingDisplayKind,
  Severity,
  VulnerabilityClass
} from "../../domain/analysisTypes";

export type ResultsFilterState = {
  search: string;
  analyzer: AnalyzerKey | "all";
  severity: Severity | "all";
  category: VulnerabilityClass | "all";
  displayKind: FindingDisplayKind | "default" | "all";
  showGraphInfo: boolean;
  showNoIssue: boolean;
};

export const DEFAULT_RESULTS_FILTERS: ResultsFilterState = {
  search: "",
  analyzer: "all",
  severity: "all",
  category: "all",
  displayKind: "default",
  showGraphInfo: false,
  showNoIssue: false
};

export function applyResultsFilters(
  findings: ClassifiedFinding[],
  filters: ResultsFilterState
): ClassifiedFinding[] {
  return findings.filter((finding) => {
    if (!matchesDefaultVisibility(finding, filters)) {
      return false;
    }

    if (filters.analyzer !== "all" && finding.analyzer !== filters.analyzer) {
      return false;
    }

    if (
      filters.severity !== "all" &&
      finding.normalizedSeverity !== filters.severity
    ) {
      return false;
    }

    if (filters.category !== "all" && finding.category !== filters.category) {
      return false;
    }

    if (
      filters.displayKind !== "all" &&
      filters.displayKind !== "default" &&
      finding.displayKind !== filters.displayKind
    ) {
      return false;
    }

    if (filters.search.trim()) {
      return matchesSearch(finding, filters.search);
    }

    return true;
  });
}

export function hasActiveFilters(filters: ResultsFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.analyzer !== "all" ||
    filters.severity !== "all" ||
    filters.category !== "all" ||
    filters.displayKind !== "default" ||
    filters.showGraphInfo ||
    filters.showNoIssue
  );
}

function matchesDefaultVisibility(
  finding: ClassifiedFinding,
  filters: ResultsFilterState
): boolean {
  if (filters.displayKind === "all") {
    return true;
  }

  if (filters.displayKind !== "default") {
    return finding.displayKind === filters.displayKind;
  }

  if (
    finding.displayKind === "vulnerability" ||
    finding.displayKind === "tool-error" ||
    finding.displayKind === "manual-check"
  ) {
    return true;
  }

  if (finding.displayKind === "graph-info") {
    return filters.showGraphInfo;
  }

  if (
    finding.displayKind === "no-issue" ||
    finding.displayKind === "tool-status"
  ) {
    return filters.showNoIssue;
  }

  return false;
}

function matchesSearch(finding: ClassifiedFinding, query: string): boolean {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableParts = [
    finding.title,
    finding.shortDescription,
    finding.recommendation,
    finding.rule,
    finding.message,
    finding.tool,
    finding.file_path,
    finding.fingerprint,
    finding.evidence.targetFile,
    finding.evidence.stdout,
    finding.evidence.stderr,
    finding.evidence.rest,
    ...Object.keys(finding.evidence.keyValues),
    ...Object.values(finding.evidence.keyValues)
  ];

  return searchableParts.some((part) =>
    normalizeText(part).includes(normalizedQuery)
  );
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim();
}