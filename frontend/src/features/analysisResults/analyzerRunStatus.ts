import type { AnalysisLogRead } from "../../shared/types/api";

export type AnalyzerRunState =
  | "not-started"
  | "running"
  | "success"
  | "failed"
  | "timeout"
  | "cancelled"
  | "unknown";

export interface AnalyzerRunStatus {
  state: AnalyzerRunState;
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  latestLog: AnalysisLogRead | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  hasStdout: boolean;
  hasStderr: boolean;
  hasErrorMessage: boolean;
}

export function buildAnalyzerRunStatus(logs: AnalysisLogRead[]): AnalyzerRunStatus {
  if (!logs.length) {
    return {
      state: "not-started",
      label: "логов нет",
      tone: "neutral",
      latestLog: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      exitCode: null,
      hasStdout: false,
      hasStderr: false,
      hasErrorMessage: false
    };
  }

  const sortedLogs = [...logs].sort((a, b) => {
    const left = new Date(a.created_at).getTime();
    const right = new Date(b.created_at).getTime();
    return right - left;
  });

  const latestLog = sortedLogs[0];
  const state = normalizeLogStatus(latestLog.status);

  return {
    state,
    label: getRunStateLabel(state),
    tone: getRunStateTone(state),
    latestLog,
    startedAt: latestLog.started_at,
    finishedAt: latestLog.finished_at,
    durationMs: latestLog.duration_ms,
    exitCode: latestLog.exit_code,
    hasStdout: Boolean(latestLog.stdout?.trim()),
    hasStderr: Boolean(latestLog.stderr?.trim()),
    hasErrorMessage: Boolean(latestLog.error_message?.trim())
  };
}

function normalizeLogStatus(status: string | null | undefined): AnalyzerRunState {
  switch (status) {
    case "RUNNING":
      return "running";
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "failed";
    case "TIMEOUT":
      return "timeout";
    case "CANCELLED":
      return "cancelled";
    default:
      return "unknown";
  }
}

function getRunStateLabel(state: AnalyzerRunState): string {
  switch (state) {
    case "not-started":
      return "логов нет";
    case "running":
      return "выполняется";
    case "success":
      return "завершен успешно";
    case "failed":
      return "завершен с ошибкой";
    case "timeout":
      return "таймаут";
    case "cancelled":
      return "отменен";
    default:
      return "неизвестный статус";
  }
}

function getRunStateTone(
  state: AnalyzerRunState
): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (state) {
    case "running":
      return "info";
    case "success":
      return "success";
    case "failed":
    case "timeout":
      return "danger";
    case "cancelled":
      return "warning";
    default:
      return "neutral";
  }
}