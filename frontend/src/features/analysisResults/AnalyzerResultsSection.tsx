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

  const statusTone = useMemo(() => {
    if (group.toolErrorCount > 0) return "danger";
    if (group.vulnerabilityCount > 0) return "warning";
    if (group.findings.length > 0 || group.logs.length > 0) return "success";
    return "neutral";
  }, [group]);

  const statusLabel = useMemo(() => {
    if (group.toolErrorCount > 0) return "есть ошибки";
    if (group.vulnerabilityCount > 0) return "есть риски";
    if (group.manualCheckCount > 0) return "ручная проверка";
    if (group.graphInfoCount > 0) return "графовые данные";
    if (group.noIssueCount > 0) return "без проблем";
    return "нет данных";
  }, [group]);

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
          {group.findings.length === 0 ? (
            <div className="empty-state">
              <strong>Результаты не получены</strong>
              <p>
                Анализатор запускался, но список findings для него пуст.
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