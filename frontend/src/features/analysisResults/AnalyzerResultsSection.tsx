import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type {
  ClassifiedFinding,
  GroupedAnalyzerFindings
} from "../../domain/analysisTypes";
import {
  getAnalyzerLabel,
  getAnalyzerPurpose
} from "../../domain/analyzerRegistry";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { FindingCard } from "./FindingCard";
import { AnalyzerRunStatusCard } from "./AnalyzerRunStatusCard";
import { buildAnalyzerRunStatus } from "./analyzerRunStatus";

interface AnalyzerResultsSectionProps {
  group: GroupedAnalyzerFindings;
  defaultOpen?: boolean;
  onOpenDetails: (finding: ClassifiedFinding) => void;
}

export function AnalyzerResultsSection({
  group,
  defaultOpen = false,
  onOpenDetails
}: AnalyzerResultsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const runStatus = useMemo(
    () => buildAnalyzerRunStatus(group.logs),
    [group.logs]
  );

  const statusTone = useMemo(() => {
    if (runStatus.state === "failed" || runStatus.state === "timeout") {
      return "danger";
    }

    if (runStatus.state === "running") {
      return "info";
    }

    if (group.toolErrorCount > 0) {
      return "danger";
    }

    if (group.vulnerabilityCount > 0) {
      return "warning";
    }

    if (runStatus.state === "success") {
      return "success";
    }

    if (group.findings.length > 0 || group.logs.length > 0) {
      return "success";
    }

    return "neutral";
  }, [group, runStatus]);

  const statusLabel = useMemo(() => {
    if (runStatus.state === "failed") return "ошибка запуска";
    if (runStatus.state === "timeout") return "таймаут";
    if (runStatus.state === "running") return "выполняется";
    if (group.toolErrorCount > 0) return "есть ошибки";
    if (group.vulnerabilityCount > 0) return "есть риски";
    if (group.manualCheckCount > 0) return "ручная проверка";
    if (group.graphInfoCount > 0) return "графовые данные";
    if (group.noIssueCount > 0) return "без проблем";
    if (runStatus.state === "success") return "завершен";
    return "нет данных";
  }, [group, runStatus]);

  return (
    <section className="analyzer-section">
      <header className="analyzer-section-header">
        <div>
          <div className="analyzer-section-topline">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <span>{getAnalyzerPurpose(group.analyzer)}</span>
          </div>

          <h3>{getAnalyzerLabel(group.analyzer)}</h3>

          <div className="analyzer-counters">
            <Badge>уязвимости: {group.vulnerabilityCount}</Badge>
            <Badge>ошибки: {group.toolErrorCount}</Badge>
            <Badge>ручная проверка: {group.manualCheckCount}</Badge>
            <Badge>графы: {group.graphInfoCount}</Badge>
            <Badge>без проблем: {group.noIssueCount}</Badge>
            <Badge>логи: {group.logs.length}</Badge>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          icon={open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Свернуть" : "Открыть"}
        </Button>
      </header>

      {open && (
        <div className="analyzer-section-body">
          <AnalyzerRunStatusCard logs={group.logs} />

          {group.findings.length === 0 ? (
            <div className="empty-state">
              <strong>Findings не получены</strong>
              <p>
                Для этого анализатора нет нормализованных результатов. Если
                запуск завершился с ошибкой, подробности доступны в технических
                логах.
              </p>
            </div>
          ) : (
            <div className="finding-list">
              {group.findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}