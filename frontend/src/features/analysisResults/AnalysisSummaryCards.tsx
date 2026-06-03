import type { AnalysisUiSummary } from "../../domain/analysisTypes";
import { getSeverityRuLabel } from "../../domain/severity";

interface AnalysisSummaryCardsProps {
  summary: AnalysisUiSummary;
}

export function AnalysisSummaryCards({ summary }: AnalysisSummaryCardsProps) {
  const hasToolErrors = summary.toolErrorCount > 0;
  const hasVulnerabilities = summary.vulnerabilityCount > 0;

  return (
    <section className="result-summary-panel">
      <div className="result-summary-verdict">
        <span>Итоговая оценка</span>

        <strong
          className={
            hasVulnerabilities
              ? "verdict-danger"
              : hasToolErrors
                ? "verdict-warning"
                : "verdict-success"
          }
        >
          {hasVulnerabilities
            ? "Найдены потенциальные уязвимости"
            : hasToolErrors
              ? "Есть ошибки анализаторов"
              : "Подтвержденные уязвимости не найдены"}
        </strong>

        <p>
          Уязвимостями считаются только результаты соответствующего типа. Ручные
          проверки, CFG/DFG-факты и успешные статусы анализаторов учитываются
          отдельно.
        </p>
      </div>

      <div className="result-summary-metrics">
        <Metric label="Всего результатов" value={summary.totalFindings} />
        <Metric label="Уязвимости" value={summary.vulnerabilityCount} />
        <Metric label="Ошибки анализаторов" value={summary.toolErrorCount} />
        <Metric label="Ручная проверка" value={summary.manualCheckCount} />
        <Metric label="Графовые данные" value={summary.graphInfoCount} />
        <Metric
          label="Статусы без проблем"
          value={summary.noIssueCount + summary.toolStatusCount}
        />
      </div>

      <div className="result-severity-row">
        {Object.entries(summary.bySeverity).map(([severity, count]) => (
          <div key={severity}>
            <span>{getSeverityRuLabel(severity)}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="result-summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}