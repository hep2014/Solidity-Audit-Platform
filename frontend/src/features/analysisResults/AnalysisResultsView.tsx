import { useMemo, useState } from "react";

import type { AnalysisLogRead, FindingRead } from "../../shared/types/api";
import type { ClassifiedFinding } from "../../domain/analysisTypes";
import { classifyFindings } from "../../domain/findingClassifier";
import {
  buildAnalysisUiSummary,
  groupFindingsByAnalyzer
} from "../../domain/analysisSummary";
import { AnalysisSummaryCards } from "./AnalysisSummaryCards";
import { AnalyzerResultsSection } from "./AnalyzerResultsSection";
import { ResultsFilterBar } from "./ResultsFilterBar";
import { FindingDetailsDrawer } from "./FindingDetailsDrawer";
import {
  applyResultsFilters,
  DEFAULT_RESULTS_FILTERS,
  hasActiveFilters,
  type ResultsFilterState
} from "./filters";
import { Button } from "../../shared/ui/Button";

interface AnalysisResultsViewProps {
  findings: FindingRead[];
  logs: AnalysisLogRead[];
}

export function AnalysisResultsView({
  findings,
  logs
}: AnalysisResultsViewProps) {
  const [filters, setFilters] = useState<ResultsFilterState>(
    DEFAULT_RESULTS_FILTERS
  );
  const [selectedFinding, setSelectedFinding] =
    useState<ClassifiedFinding | null>(null);

  const classifiedFindings = useMemo(
    () => classifyFindings(findings),
    [findings]
  );

  const summary = useMemo(
    () => buildAnalysisUiSummary(classifiedFindings),
    [classifiedFindings]
  );

  const visibleFindings = useMemo(
    () => applyResultsFilters(classifiedFindings, filters),
    [classifiedFindings, filters]
  );

  const groups = useMemo(
    () =>
      groupFindingsByAnalyzer(visibleFindings, logs, {
        includeLogOnlyGroups: false
      }),
    [visibleFindings, logs]
  );

  const hiddenGraphCount = summary.graphInfoCount;
  const hiddenStatusCount = summary.noIssueCount + summary.toolStatusCount;

  function showGraphInfo() {
    setFilters((current) => ({
      ...current,
      showGraphInfo: true,
      displayKind: current.displayKind === "default" ? "all" : current.displayKind
    }));
  }

  function showStatuses() {
    setFilters((current) => ({
      ...current,
      showNoIssue: true,
      displayKind: current.displayKind === "default" ? "all" : current.displayKind
    }));
  }

  function resetFilters() {
    setFilters(DEFAULT_RESULTS_FILTERS);
  }

  return (
    <div className="analysis-results-view">
      <AnalysisSummaryCards summary={summary} />

      <ResultsFilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={classifiedFindings.length}
        visibleCount={visibleFindings.length}
      />

      {hiddenGraphCount > 0 && !filters.showGraphInfo && (
        <div className="results-hint-card">
          <strong>CFG/DFG-данные скрыты</strong>
          <p>
            Анализаторы графа вернули {hiddenGraphCount} результат(ов). По
            умолчанию они скрыты, чтобы не смешивать вспомогательную графовую
            информацию с уязвимостями.
          </p>

          <Button type="button" variant="secondary" onClick={showGraphInfo}>
            Показать CFG/DFG-данные
          </Button>
        </div>
      )}

      {hiddenStatusCount > 0 && !filters.showNoIssue && (
        <div className="results-hint-card">
          <strong>Успешные статусы скрыты</strong>
          <p>
            Есть {hiddenStatusCount} информационных статус(ов) без проблем. Они
            скрыты, чтобы основной список оставался компактным.
          </p>

          <Button type="button" variant="secondary" onClick={showStatuses}>
            Показать статусы без проблем
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-state results-empty-state">
          <strong>Нет результатов по выбранным фильтрам</strong>
          <p>
            Сейчас фильтр показывает 0 записей. Измените параметры фильтрации,
            включите CFG/DFG-данные или сбросьте фильтры.
          </p>

          {hasActiveFilters(filters) && (
            <Button type="button" variant="secondary" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          )}
        </div>
      ) : (
        <div className="analyzer-section-list analyzer-section-cards">
          {groups.map((group) => (
            <AnalyzerResultsSection
              key={group.analyzer}
              group={group}
              defaultOpen={
                group.vulnerabilityCount > 0 ||
                group.toolErrorCount > 0 ||
                group.manualCheckCount > 0
              }
              onOpenDetails={setSelectedFinding}
            />
          ))}
        </div>
      )}

      <FindingDetailsDrawer
        finding={selectedFinding}
        open={selectedFinding !== null}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}