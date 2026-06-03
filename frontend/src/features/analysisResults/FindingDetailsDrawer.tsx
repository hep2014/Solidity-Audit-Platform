import { X } from "lucide-react";
import { useEffect } from "react";

import type { ClassifiedFinding } from "../../domain/analysisTypes";
import {
  getAnalyzerLabel,
  getCategoryLabel,
  getDisplayKindLabel
} from "../../domain/analyzerRegistry";
import { getSeverityRuLabel } from "../../domain/severity";
import { parseSpecializedEvidence } from "../../domain/specializedEvidence";
import { formatDateTime } from "../../shared/utils/format";
import { Badge, severityTone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { SpecializedEvidenceBlock } from "./SpecializedEvidenceBlock";

interface FindingDetailsDrawerProps {
  finding: ClassifiedFinding | null;
  open: boolean;
  onClose: () => void;
}

export function FindingDetailsDrawer({
  finding,
  open,
  onClose
}: FindingDetailsDrawerProps) {
    useEffect(() => {
        if (!open) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
        }, [open]);
  if (!open || !finding) {
    return null;
  }

  const specializedEvidence = parseSpecializedEvidence(finding);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="finding-details-drawer"
        aria-label="Детали результата анализа"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <div className="finding-badges">
              <Badge tone={severityTone(finding.normalizedSeverity)}>
                {getSeverityRuLabel(finding.normalizedSeverity)}
              </Badge>

              <Badge>{getAnalyzerLabel(finding.analyzer)}</Badge>
              <Badge>{getDisplayKindLabel(finding.displayKind)}</Badge>
              <Badge>{getCategoryLabel(finding.category)}</Badge>
            </div>

            <h2>{finding.title}</h2>
            <p>{finding.shortDescription}</p>
          </div>

          <Button
            type="button"
            variant="ghost"
            icon={<X size={18} />}
            onClick={onClose}
          >
            Закрыть
          </Button>
        </header>

        <div className="drawer-body">
          <section className="drawer-section">
            <strong>Рекомендация</strong>
            <p>{finding.recommendation}</p>
          </section>

          <SpecializedEvidenceBlock evidence={specializedEvidence} />

          <section className="drawer-section">
            <strong>Основные поля</strong>

            <dl className="drawer-facts">
              <div>
                <dt>Правило</dt>
                <dd>
                  <code>{finding.rule}</code>
                </dd>
              </div>

              <div>
                <dt>Анализатор</dt>
                <dd>{getAnalyzerLabel(finding.analyzer)}</dd>
              </div>

              <div>
                <dt>Категория</dt>
                <dd>{getCategoryLabel(finding.category)}</dd>
              </div>

              <div>
                <dt>Тип результата</dt>
                <dd>{getDisplayKindLabel(finding.displayKind)}</dd>
              </div>

              <div>
                <dt>Файл</dt>
                <dd>{finding.file_path || "—"}</dd>
              </div>

              <div>
                <dt>Позиция</dt>
                <dd>
                  {finding.line ? `строка ${finding.line}` : "—"}
                  {finding.column ? `, колонка ${finding.column}` : ""}
                </dd>
              </div>

              <div>
                <dt>Создано</dt>
                <dd>{formatDateTime(finding.created_at)}</dd>
              </div>

              <div>
                <dt>Действие требуется</dt>
                <dd>{finding.isActionable ? "да" : "нет"}</dd>
              </div>

              {finding.evidence.confidence && (
                <div>
                  <dt>Уверенность</dt>
                  <dd>{translateConfidence(finding.evidence.confidence)}</dd>
                </div>
              )}

              {finding.evidence.exitCode !== null && (
                <div>
                  <dt>Код завершения</dt>
                  <dd>{finding.evidence.exitCode}</dd>
                </div>
              )}

              {finding.evidence.targetFile && (
                <div>
                  <dt>Целевой файл</dt>
                  <dd>{finding.evidence.targetFile}</dd>
                </div>
              )}
            </dl>
          </section>

          {Object.keys(finding.evidence.keyValues).length > 0 && (
            <section className="drawer-section">
              <strong>Извлеченные поля</strong>

              <dl className="key-value-list">
                {Object.entries(finding.evidence.keyValues).map(([key, value]) => (
                  <div key={key}>
                    <dt>{translateEvidenceKey(key)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {finding.evidence.stdout && (
            <section className="drawer-section">
              <strong>Стандартный вывод</strong>
              <pre>{finding.evidence.stdout}</pre>
            </section>
          )}

          {finding.evidence.stderr && (
            <section className="drawer-section">
              <strong>Поток ошибок</strong>
              <pre>{finding.evidence.stderr}</pre>
            </section>
          )}

          <section className="drawer-section">
            <strong>Исходное сообщение</strong>
            <pre>{finding.message}</pre>
          </section>

          <section className="drawer-section">
            <strong>Служебные поля</strong>
            <pre>
              {JSON.stringify(
                {
                  id: finding.id,
                  fingerprint: finding.fingerprint,
                  rule: finding.rule,
                  tool: finding.tool,
                  severity: finding.severity,
                  normalizedSeverity: finding.normalizedSeverity,
                  displayKind: finding.displayKind,
                  category: finding.category,
                  isActionable: finding.isActionable
                },
                null,
                2
              )}
            </pre>
          </section>
        </div>
      </aside>
    </div>
  );
}

function translateConfidence(value: "High" | "Medium" | "Low"): string {
  switch (value) {
    case "High":
      return "Высокая";
    case "Medium":
      return "Средняя";
    case "Low":
      return "Низкая";
    default:
      return value;
  }
}

function translateEvidenceKey(key: string): string {
  switch (key) {
    case "File":
      return "Файл";
    case "Function":
      return "Функция";
    case "External call line":
      return "Строка внешнего вызова";
    case "External call code":
      return "Код внешнего вызова";
    case "State write line":
      return "Строка записи состояния";
    case "State variable written after external call":
      return "Переменная состояния";
    case "State write code":
      return "Код записи состояния";
    case "Target file":
      return "Целевой файл";
    case "Exit code":
      return "Код завершения";
    default:
      return key;
  }
}