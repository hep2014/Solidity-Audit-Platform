export type UUID = string;
export type ISODateTime = string;

export type AnalysisStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "PARTIAL_SUCCESS"
  | "CANCELLED"
  | "TIMEOUT";

export type AnalysisLogStatus =
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "TIMEOUT"
  | "CANCELLED";

export type FindingSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type ProjectType =
  | "single_file"
  | "multi_file"
  | "foundry"
  | "hardhat"
  | string;

export interface ProjectRead {
  id: UUID;
  name: string;
  description: string | null;
  file_path: string;
  root_path: string | null;
  entrypoint_path: string | null;
  project_type: ProjectType;
  solidity_files_count: number;
  detected_solc_versions: string[] | null;
  project_metadata: Record<string, unknown> | null;
  created_at: ISODateTime;
}

export interface AnalysisRead {
  id: UUID;
  project_id: UUID;
  celery_task_id: string | null;
  status: AnalysisStatus;
  progress: number;
  current_step: string | null;
  started_at: ISODateTime | null;
  finished_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime | null;
}

export interface FindingRead {
  id: UUID;
  severity: FindingSeverity | string;
  rule: string;
  message: string;
  file_path: string | null;
  line: number | null;
  column: number | null;
  end_line: number | null;
  tool: string;
  confidence: string | null;
  description: string | null;
  recommendation: string | null;
  references: string[] | Record<string, unknown> | null;
  fingerprint: string;
  created_at: ISODateTime;
}

export interface AnalysisLogRead {
  id: UUID;
  analysis_id: UUID;
  tool: string;
  status: AnalysisLogStatus | string;
  exit_code: number | null;
  duration_ms: number | null;
  stdout: string | null;
  stderr: string | null;
  error_message: string | null;
  started_at: ISODateTime | null;
  finished_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface ReportAnalysis {
  id: UUID;
  project_id: UUID;
  status: AnalysisStatus;
  progress: number;
  current_step: string | null;
  celery_task_id: string | null;
  started_at: ISODateTime | null;
  finished_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime | null;
}

export interface ReportProject {
  id: UUID;
  name: string;
  description: string | null;
  file_path: string;
  root_path: string | null;
  entrypoint_path: string | null;
  project_type: ProjectType;
  solidity_files_count: number;
  detected_solc_versions: string[] | null;
  project_metadata: Record<string, unknown> | null;
  created_at: ISODateTime;
}

export interface ReportSummary {
  total: number;
  by_severity: Record<string, number>;
  by_tool: Record<string, number>;
}

export interface AnalysisReport {
  analysis: ReportAnalysis;
  project: ReportProject;
  summary: ReportSummary;
  findings: FindingRead[];
  logs: AnalysisLogRead[];
}

export interface ScanIssue {
  severity: FindingSeverity | string;
  rule: string;
  message: string;
  line: number | null;
}

export interface ScanResponse {
  filename: string;
  issues: ScanIssue[];
  total: number;
}

export interface HealthLiveResponse {
  status: "ok" | string;
}

export interface HealthReadyResponse {
  status: "ok" | "degraded" | string;
  checks: {
    database: boolean;
    redis: boolean;
    [key: string]: boolean;
  };
}

export interface DeleteProjectResponse {
  status: "deleted";
  project_id: UUID;
}

export interface DeleteAnalysisResponse {
  status: "deleted";
  analysis_id: UUID;
}

export interface AnalysisWsMessage {
  analysis_id?: UUID;
  status?: AnalysisStatus;
  progress?: number;
  current_step?: string | null;
  error?: string;
}

export type AnalysisMode =
  | "basic"
  | "slither"
  | "foundry"
  | "mythril"
  | "echidna"
  | "cfg"
  | "dfg"
  | "reentrancy-correlation"
  | "manual-checklist"
  | "full";

export interface ApiErrorPayload {
  detail?: unknown;
  message?: string;
}