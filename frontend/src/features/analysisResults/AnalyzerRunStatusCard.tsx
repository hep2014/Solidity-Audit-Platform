import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  XCircle
} from "lucide-react";

import type { AnalysisLogRead } from "../../shared/types/api";
import { formatDurationMs } from "../../shared/utils/format";
import { Badge } from "../../shared/ui/Badge";
import { buildAnalyzerRunStatus } from "./analyzerRunStatus";

interface AnalyzerRunStatusCardProps {
  logs: AnalysisLogRead[];
}

export function AnalyzerRunStatusCard({ logs }: AnalyzerRunStatusCardProps) {
  const status = buildAnalyzerRunStatus(logs);
  const Icon = getStatusIcon(status.state);

  return (
    <div className={`analyzer-run-strip analyzer-run-${status.state}`}>
      <div className="analyzer-run-strip-main">
        <div className="analyzer-run-strip-icon">
          <Icon
            size={17}
            className={status.state === "running" ? "spin" : undefined}
          />
        </div>

        <div>
          <span>Статус запуска</span>
          <strong>{status.label}</strong>
        </div>
      </div>

      <div className="analyzer-run-strip-badges">
        <Badge tone={status.tone}>{status.label}</Badge>

        {status.exitCode !== null && (
          <Badge tone={status.exitCode === 0 ? "success" : "danger"}>
            код {status.exitCode}
          </Badge>
        )}

        <Badge>логов: {logs.length}</Badge>

        {status.durationMs !== null && (
          <Badge>{formatDurationMs(status.durationMs)}</Badge>
        )}

        {status.hasStderr && <Badge tone="warning">stderr</Badge>}
        {status.hasErrorMessage && <Badge tone="danger">ошибка</Badge>}
      </div>
    </div>
  );
}

function getStatusIcon(state: string) {
  switch (state) {
    case "running":
      return Loader2;
    case "success":
      return CheckCircle2;
    case "failed":
    case "timeout":
      return XCircle;
    case "cancelled":
      return AlertTriangle;
    default:
      return CircleDashed;
  }
}