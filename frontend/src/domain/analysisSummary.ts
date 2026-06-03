import type {
  AnalysisUiSummary,
  AnalyzerKey,
  ClassifiedFinding,
  GroupedAnalyzerFindings,
  Severity,
  VulnerabilityClass
} from "./analysisTypes";
import type { AnalysisLogRead } from "../shared/types/api";
import { ANALYZERS, normalizeAnalyzer } from "./analyzerRegistry";

const EMPTY_SEVERITY_COUNTS: Record<Severity, number> = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0
};

const ALL_ANALYZERS = Object.keys(ANALYZERS) as AnalyzerKey[];

const ALL_CATEGORIES: VulnerabilityClass[] = [
  "reentrancy",
  "access-control",
  "dangerous-call",
  "destructive-operation",
  "randomness-or-time",
  "testing-failure",
  "fuzzing-failure",
  "symbolic-execution",
  "control-flow",
  "data-flow",
  "manual-review",
  "configuration",
  "tool-error",
  "no-issue",
  "informational",
  "unknown"
];

export function buildAnalysisUiSummary(findings: ClassifiedFinding[]): AnalysisUiSummary {
  const bySeverity = { ...EMPTY_SEVERITY_COUNTS };
  const byAnalyzer = Object.fromEntries(ALL_ANALYZERS.map((key) => [key, 0])) as Record<AnalyzerKey, number>;
  const byCategory = Object.fromEntries(ALL_CATEGORIES.map((key) => [key, 0])) as Record<VulnerabilityClass, number>;

  let vulnerabilityCount = 0;
  let manualCheckCount = 0;
  let toolErrorCount = 0;
  let noIssueCount = 0;
  let graphInfoCount = 0;
  let toolStatusCount = 0;

  for (const finding of findings) {
    byAnalyzer[finding.analyzer] += 1;
    byCategory[finding.category] += 1;

    if (finding.displayKind === "vulnerability") {
      vulnerabilityCount += 1;
      bySeverity[finding.normalizedSeverity] += 1;
    }

    if (finding.displayKind === "manual-check") {
      manualCheckCount += 1;
    }

    if (finding.displayKind === "tool-error") {
      toolErrorCount += 1;
    }

    if (finding.displayKind === "no-issue") {
      noIssueCount += 1;
    }

    if (finding.displayKind === "graph-info") {
      graphInfoCount += 1;
    }

    if (finding.displayKind === "tool-status") {
      toolStatusCount += 1;
    }
  }

  return {
    totalFindings: findings.length,
    vulnerabilityCount,
    manualCheckCount,
    toolErrorCount,
    noIssueCount,
    graphInfoCount,
    toolStatusCount,
    bySeverity,
    byAnalyzer,
    byCategory
  };
}

export function groupFindingsByAnalyzer(
  findings: ClassifiedFinding[],
  logs: AnalysisLogRead[]
): GroupedAnalyzerFindings[] {
  const groups = new Map<AnalyzerKey, GroupedAnalyzerFindings>();

  for (const analyzer of ALL_ANALYZERS) {
    if (analyzer === "unknown") {
      continue;
    }

    groups.set(analyzer, createGroup(analyzer));
  }

  for (const finding of findings) {
    if (!groups.has(finding.analyzer)) {
      groups.set(finding.analyzer, createGroup(finding.analyzer));
    }

    const group = groups.get(finding.analyzer)!;
    group.findings.push(finding);

    if (finding.displayKind === "vulnerability") group.vulnerabilityCount += 1;
    if (finding.displayKind === "manual-check") group.manualCheckCount += 1;
    if (finding.displayKind === "tool-error") group.toolErrorCount += 1;
    if (finding.displayKind === "no-issue") group.noIssueCount += 1;
    if (finding.displayKind === "graph-info") group.graphInfoCount += 1;
  }

  for (const log of logs) {
    const analyzer = normalizeAnalyzer(log.tool);

    if (!groups.has(analyzer)) {
      groups.set(analyzer, createGroup(analyzer));
    }

    groups.get(analyzer)!.logs.push(log);
  }

  return [...groups.values()]
    .filter((group) => group.findings.length > 0 || group.logs.length > 0)
    .sort((a, b) => ANALYZERS[a.analyzer].order - ANALYZERS[b.analyzer].order);
}

export function filterDefaultVisibleFindings(findings: ClassifiedFinding[]): ClassifiedFinding[] {
  return findings.filter((finding) => {
    return (
      finding.displayKind === "vulnerability" ||
      finding.displayKind === "tool-error" ||
      finding.displayKind === "manual-check"
    );
  });
}

function createGroup(analyzer: AnalyzerKey): GroupedAnalyzerFindings {
  return {
    analyzer,
    findings: [],
    logs: [],
    vulnerabilityCount: 0,
    manualCheckCount: 0,
    toolErrorCount: 0,
    noIssueCount: 0,
    graphInfoCount: 0
  };
}