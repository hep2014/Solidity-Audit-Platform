import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  Loader2,
  Timer,
  XCircle
} from "lucide-react";

import type { AnalysisLogRead } from "../../shared/types/api";
import { formatDateTime, formatDurationMs } from "../../shared/utils/format";
import { Badge } from "../../shared/ui/Badge";
import { buildAnalyzerRunStatus } from "./analyzerRunStatus";

interface AnalyzerRunStatusCardProps {
  logs: AnalysisLogRead[];
}

export function AnalyzerRunStatusCard({ logs }: AnalyzerRunStatusCardProps) {
  const status = buildAnalyzerRunStatus(logs);
  const Icon = getStatusIcon(status.state);

  return (
    <div className={`analyzer-run-card analyzer-run-${status.state}`}>
      <div className="analyzer-run-main">
        <div className="analyzer-run-icon">
          <Icon size={18} className={status.state === "running" ? "spin" : undefined} />
        </div>

        <div>
          <span>Статус запуска</span>
          <strong>{status.label}</strong>
        </div>
      </div>

      <div className="analyzer-run-badges">
        <Badge tone={status.tone}>{status.label}</Badge>

        {status.exitCode !== null && (
          <Badge tone={status.exitCode === 0 ? "success" : "danger"}>
            код {status.exitCode}
          </Badge>
        )}

        {status.hasStdout && <Badge>stdout</Badge>}
        {status.hasStderr && <Badge tone="warning">stderr</Badge>}
        {status.hasErrorMessage && <Badge tone="danger">ошибка</Badge>}
      </div>

      <dl className="analyzer-run-facts">
        <div>
          <dt>
            <Clock size={13} />
            запуск
          </dt>
          <dd>{formatDateTime(status.startedAt)}</dd>
        </div>

        <div>
          <dt>
            <CheckCircle2 size={13} />
            завершение
          </dt>
          <dd>{formatDateTime(status.finishedAt)}</dd>
        </div>

        <div>
          <dt>
            <Timer size={13} />
            длительность
          </dt>
          <dd>{formatDurationMs(status.durationMs)}</dd>
        </div>

        <div>
          <dt>
            <FileText size={13} />
            логов
          </dt>
          <dd>{logs.length}</dd>
        </div>
      </dl>

      {status.latestLog?.error_message && (
        <div className="analyzer-run-error">
          <strong>Сообщение об ошибке</strong>
          <pre>{status.latestLog.error_message}</pre>
        </div>
      )}
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