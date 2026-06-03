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
  type ResultsFilterState
} from "./filters";

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
    () => groupFindingsByAnalyzer(visibleFindings, logs),
    [visibleFindings, logs]
  );

  return (
    <div className="analysis-results-view">
      <AnalysisSummaryCards summary={summary} />

      <ResultsFilterBar
        filters={filters}
        onChange={setFilters}
        totalCount={classifiedFindings.length}
        visibleCount={visibleFindings.length}
      />

      {groups.length === 0 ? (
        <div className="empty-state">
          <strong>Нет результатов по выбранным фильтрам</strong>
          <p>
            Измените параметры фильтрации, включите CFG/DFG-данные или покажите
            успешные статусы анализаторов.
          </p>
        </div>
      ) : (
        <div className="analyzer-section-list">
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