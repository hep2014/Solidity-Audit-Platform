import { Copy, ExternalLink } from "lucide-react";

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

interface FindingCardProps {
  finding: ClassifiedFinding;
  onOpenDetails: (finding: ClassifiedFinding) => void;
}

export function FindingCard({ finding, onOpenDetails }: FindingCardProps) {
  const specializedEvidence = parseSpecializedEvidence(finding);

  async function copyFinding() {
    const text = [
      `Название: ${finding.title}`,
      `Анализатор: ${getAnalyzerLabel(finding.analyzer)}`,
      `Категория: ${getCategoryLabel(finding.category)}`,
      `Тип результата: ${getDisplayKindLabel(finding.displayKind)}`,
      `Уровень: ${getSeverityRuLabel(finding.normalizedSeverity)}`,
      `Правило: ${finding.rule}`,
      `Файл: ${finding.file_path || "—"}`,
      `Строка: ${finding.line ?? "—"}`,
      "",
      "Рекомендация:",
      finding.recommendation,
      "",
      "Исходное сообщение:",
      finding.message
    ].join("\n");

    await navigator.clipboard.writeText(text);
  }

  return (
    <article className={`finding-card finding-kind-${finding.displayKind}`}>
      <header className="finding-card-header">
        <div className="finding-card-title-block">
          <div className="finding-badges">
            <Badge tone={severityTone(finding.normalizedSeverity)}>
              {getSeverityRuLabel(finding.normalizedSeverity)}
            </Badge>

            <Badge>{getAnalyzerLabel(finding.analyzer)}</Badge>
            <Badge>{getDisplayKindLabel(finding.displayKind)}</Badge>
            <Badge>{getCategoryLabel(finding.category)}</Badge>
          </div>

          <h3>{finding.title}</h3>
          <p>{finding.shortDescription}</p>
        </div>

        <div className="finding-card-actions">
          <Button
            type="button"
            variant="ghost"
            icon={<Copy size={16} />}
            onClick={copyFinding}
          >
            Скопировать
          </Button>

          <Button
            type="button"
            variant="secondary"
            icon={<ExternalLink size={16} />}
            onClick={() => onOpenDetails(finding)}
          >
            Подробнее
          </Button>
        </div>
      </header>

      <div className="finding-card-main">
        <dl className="finding-facts finding-facts-compact">
          <div>
            <dt>Правило</dt>
            <dd>
              <code>{finding.rule}</code>
            </dd>
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
        </dl>

        <div className="finding-recommendation">
          <strong>Рекомендация</strong>
          <p>{finding.recommendation}</p>
        </div>

        <SpecializedEvidenceBlock evidence={specializedEvidence} compact />
      </div>
    </article>
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