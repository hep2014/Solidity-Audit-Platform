import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import type { AnalysisLogRead, FindingRead } from "../../shared/types/api";
import { classifyFindings } from "../../domain/findingClassifier";
import { buildAnalysisUiSummary } from "../../domain/analysisSummary";
import { Button } from "../../shared/ui/Button";

interface AnalysisResultsPreviewProps {
  analysisId: string;
  findings: FindingRead[];
  logs: AnalysisLogRead[];
}

export function AnalysisResultsPreview({
  analysisId,
  findings,
  logs
}: AnalysisResultsPreviewProps) {
  const classified = classifyFindings(findings);
  const summary = buildAnalysisUiSummary(classified);

  const hasRisks = summary.vulnerabilityCount > 0;
  const hasToolErrors = summary.toolErrorCount > 0;

  return (
    <div className="analysis-results-preview">
      <div className="analysis-preview-verdict">
        <span>Итоговая оценка</span>

        <strong
          className={
            hasRisks
              ? "verdict-danger"
              : hasToolErrors
                ? "verdict-warning"
                : "verdict-success"
          }
        >
          {hasRisks
            ? "Найдены потенциальные уязвимости"
            : hasToolErrors
              ? "Есть ошибки анализаторов"
              : "Критичных результатов не найдено"}
        </strong>

        <p>
          Представлена краткая сводка.
        </p>
      </div>

      <div className="analysis-preview-grid">
        <div className="metric-card">
          <span>Всего результатов</span>
          <strong>{summary.totalFindings}</strong>
        </div>

        <div className="metric-card">
          <span>Уязвимости</span>
          <strong>{summary.vulnerabilityCount}</strong>
        </div>

        <div className="metric-card">
          <span>Ошибки</span>
          <strong>{summary.toolErrorCount}</strong>
        </div>

        <div className="metric-card">
          <span>Ручная проверка</span>
          <strong>{summary.manualCheckCount}</strong>
        </div>

        <div className="metric-card">
          <span>Графовые данные</span>
          <strong>{summary.graphInfoCount}</strong>
        </div>

        <div className="metric-card">
          <span>Логи</span>
          <strong>{logs.length}</strong>
        </div>
      </div>

      <Link to={`/analyses/${analysisId}/results`}>
        <Button icon={<ArrowRight size={16} />}>
          Открыть результаты
        </Button>
      </Link>
    </div>
  );
}