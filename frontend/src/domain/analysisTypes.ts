import type { FindingRead, AnalysisLogRead } from "../shared/types/api";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type AnalyzerKey =
  | "basic-scanner"
  | "slither"
  | "foundry"
  | "mythril"
  | "echidna"
  | "cfg"
  | "dfg"
  | "custom-cfg-dfg"
  | "manual-audit"
  | "unknown";

export type AnalyzerResultType =
  | "vulnerability-rules"
  | "detectors"
  | "test-run"
  | "tool-output"
  | "fuzz-run"
  | "graph-info"
  | "correlation"
  | "manual-checklist"
  | "unknown";

export type VulnerabilityClass =
  | "reentrancy"
  | "access-control"
  | "dangerous-call"
  | "destructive-operation"
  | "randomness-or-time"
  | "testing-failure"
  | "fuzzing-failure"
  | "symbolic-execution"
  | "control-flow"
  | "data-flow"
  | "manual-review"
  | "configuration"
  | "tool-error"
  | "no-issue"
  | "informational"
  | "unknown";

export type FindingDisplayKind =
  | "vulnerability"
  | "manual-check"
  | "tool-status"
  | "graph-info"
  | "no-issue"
  | "tool-error";

export interface AnalyzerMeta {
  key: AnalyzerKey;
  label: string;
  shortLabel: string;
  purpose: string;
  resultType: AnalyzerResultType;
  order: number;
}

export interface FindingEvidence {
  exitCode: number | null;
  targetFile: string | null;
  confidence: "High" | "Medium" | "Low" | null;
  stdout?: string;
  stderr?: string;
  rest?: string;
  keyValues: Record<string, string>;
  warnings: string[];
}

export interface ClassifiedFinding extends FindingRead {
  normalizedSeverity: Severity;
  analyzer: AnalyzerKey;
  category: VulnerabilityClass;
  displayKind: FindingDisplayKind;
  title: string;
  shortDescription: string;
  recommendation: string;
  evidence: FindingEvidence;
  sortWeight: number;
  isActionable: boolean;
}

export interface AnalysisUiSummary {
  totalFindings: number;
  vulnerabilityCount: number;
  manualCheckCount: number;
  toolErrorCount: number;
  noIssueCount: number;
  graphInfoCount: number;
  toolStatusCount: number;
  bySeverity: Record<Severity, number>;
  byAnalyzer: Record<AnalyzerKey, number>;
  byCategory: Record<VulnerabilityClass, number>;
}

export interface GroupedAnalyzerFindings {
  analyzer: AnalyzerKey;
  findings: ClassifiedFinding[];
  logs: AnalysisLogRead[];
  vulnerabilityCount: number;
  manualCheckCount: number;
  toolErrorCount: number;
  noIssueCount: number;
  graphInfoCount: number;
}

export type ParsedCfgEvidence = {
  functionName: string | null;
  startLine: number | null;
  endLine: number | null;
  nodesCount: number | null;
  edgesCount: number | null;
  nodes: Array<{
    id?: string;
    type?: string;
    label?: string;
    line?: number;
  }>;
  edges: Array<{
    from?: string;
    to?: string;
    type?: string;
  }>;
};

export type ParsedDfgEvidence = {
  functionName: string | null;
  stateVariable: string | null;
  accessType: "read" | "write" | string | null;
  line: number | null;
  code: string | null;
};

export type ParsedReentrancyEvidence = {
  file: string | null;
  functionName: string | null;
  externalCallLine: number | null;
  externalCallCode: string | null;
  stateWriteLine: number | null;
  stateVariable: string | null;
  stateWriteCode: string | null;
};

export type SpecializedEvidence =
  | {
      type: "cfg";
      data: ParsedCfgEvidence;
    }
  | {
      type: "dfg";
      data: ParsedDfgEvidence;
    }
  | {
      type: "reentrancy";
      data: ParsedReentrancyEvidence;
    }
  | {
      type: "none";
    };