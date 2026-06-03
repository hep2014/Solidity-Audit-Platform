import { Filter, RotateCcw, Search } from "lucide-react";

import type {
  AnalyzerKey,
  FindingDisplayKind,
  Severity,
  VulnerabilityClass
} from "../../domain/analysisTypes";
import {
  
  getAnalyzerLabel,
  getCategoryLabel,
  getDisplayKindLabel
} from "../../domain/analyzerRegistry";
import { getSeverityRuLabel } from "../../domain/severity";
import { Button } from "../../shared/ui/Button";
import type { ResultsFilterState } from "./filters";
import { DEFAULT_RESULTS_FILTERS, hasActiveFilters } from "./filters";

interface ResultsFilterBarProps {
  filters: ResultsFilterState;
  onChange: (filters: ResultsFilterState) => void;
  totalCount: number;
  visibleCount: number;
}

const ANALYZER_OPTIONS: Array<AnalyzerKey | "all"> = [
  "all",
  "basic-scanner",
  "slither",
  "custom-cfg-dfg",
  "mythril",
  "echidna",
  "foundry",
  "cfg",
  "dfg",
  "manual-audit",
  "unknown"
];

const SEVERITY_OPTIONS: Array<Severity | "all"> = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "info"
];

const DISPLAY_KIND_OPTIONS: Array<FindingDisplayKind | "default" | "all"> = [
  "default",
  "vulnerability",
  "tool-error",
  "manual-check",
  "graph-info",
  "no-issue",
  "tool-status",
  "all"
];

const CATEGORY_OPTIONS: Array<VulnerabilityClass | "all"> = [
  "all",
  "reentrancy",
  "access-control",
  "dangerous-call",
  "destructive-operation",
  "randomness-or-time",
  "testing-failure",
  "fuzzing-failure",
  "symbolic-execution",
  "configuration",
  "control-flow",
  "data-flow",
  "tool-error",
  "no-issue",
  "informational",
  "unknown"
];

export function ResultsFilterBar({
  filters,
  onChange,
  totalCount,
  visibleCount
}: ResultsFilterBarProps) {
  function patch(next: Partial<ResultsFilterState>) {
    onChange({
      ...filters,
      ...next
    });
  }

  function reset() {
    onChange(DEFAULT_RESULTS_FILTERS);
  }

  return (
    <div className="results-filter-panel">
      <div className="results-filter-header">
        <div>
          <div className="results-filter-title">
            <Filter size={17} />
            <strong>Фильтры результатов</strong>
          </div>

          <span>
            Показано {visibleCount} из {totalCount}
          </span>
        </div>

        <Button
          type="button"
          variant="secondary"
          icon={<RotateCcw size={16} />}
          disabled={!hasActiveFilters(filters)}
          onClick={reset}
        >
          Сбросить
        </Button>
      </div>

      <div className="results-search">
        <Search size={17} />
        <input
          value={filters.search}
          placeholder="Поиск по правилу, сообщению, функции, переменной, строке вывода..."
          onChange={(event) => patch({ search: event.target.value })}
        />
      </div>

      <div className="results-filter-grid">
        <label>
          <span>Анализатор</span>
          <select
            value={filters.analyzer}
            onChange={(event) =>
              patch({ analyzer: event.target.value as AnalyzerKey | "all" })
            }
          >
            {ANALYZER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "Все анализаторы" : getAnalyzerLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Уровень риска</span>
          <select
            value={filters.severity}
            onChange={(event) =>
              patch({ severity: event.target.value as Severity | "all" })
            }
          >
            {SEVERITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "all"
                  ? "Все уровни"
                  : getSeverityRuLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Тип результата</span>
          <select
            value={filters.displayKind}
            onChange={(event) =>
              patch({
                displayKind: event.target.value as
                  | FindingDisplayKind
                  | "default"
                  | "all"
              })
            }
          >
            {DISPLAY_KIND_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {getDisplayKindOptionLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Категория</span>
          <select
            value={filters.category}
            onChange={(event) =>
              patch({
                category: event.target.value as VulnerabilityClass | "all"
              })
            }
          >
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "Все категории" : getCategoryLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="results-filter-toggles">
        <label>
          <input
            type="checkbox"
            checked={filters.showGraphInfo}
            onChange={(event) =>
              patch({ showGraphInfo: event.target.checked })
            }
          />
          <span>Показывать CFG/DFG-данные</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={filters.showNoIssue}
            onChange={(event) =>
              patch({ showNoIssue: event.target.checked })
            }
          />
          <span>Показывать успешные статусы анализаторов</span>
        </label>
      </div>
    </div>
  );
}

function getDisplayKindOptionLabel(
  value: FindingDisplayKind | "default" | "all"
): string {
  if (value === "default") {
    return "Основные результаты";
  }

  if (value === "all") {
    return "Все типы";
  }

  return getDisplayKindLabel(value);
}