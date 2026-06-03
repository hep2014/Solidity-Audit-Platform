import type { AnalysisUiSummary } from "../../domain/analysisTypes";
import { getSeverityRuLabel } from "../../domain/severity";

interface AnalysisSummaryCardsProps {
  summary: AnalysisUiSummary;
}

export function AnalysisSummaryCards({ summary }: AnalysisSummaryCardsProps) {
  const hasToolErrors = summary.toolErrorCount > 0;
  const hasVulnerabilities = summary.vulnerabilityCount > 0;

  return (
    <div className="analysis-summary-block">
      <div className="analysis-verdict">
        <span>Итоговая оценка</span>

        {hasVulnerabilities ? (
          <strong className="verdict-danger">
            Найдены потенциальные уязвимости
          </strong>
        ) : hasToolErrors ? (
          <strong className="verdict-warning">
            Уязвимости не подтверждены, но есть ошибки анализаторов
          </strong>
        ) : (
          <strong className="verdict-success">
            Подтвержденные уязвимости не найдены
          </strong>
        )}

        <p>
          Сводка считает уязвимостями только результаты типа «Уязвимость».
          Ручные проверки, CFG/DFG-факты и успешные статусы анализаторов не
          включаются в число уязвимостей.
        </p>
      </div>

      <div className="summary-grid">
        <div className="metric-card">
          <span>Всего результатов</span>
          <strong>{summary.totalFindings}</strong>
        </div>

        <div className="metric-card">
          <span>Уязвимости</span>
          <strong>{summary.vulnerabilityCount}</strong>
        </div>

        <div className="metric-card">
          <span>Ошибки анализаторов</span>
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
          <span>Статусы без проблем</span>
          <strong>{summary.noIssueCount + summary.toolStatusCount}</strong>
        </div>
      </div>

      <div className="severity-summary-grid">
        {Object.entries(summary.bySeverity).map(([severity, count]) => (
          <div key={severity} className="severity-summary-card">
            <span>{getSeverityRuLabel(severity)}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}