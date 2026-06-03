import { Copy, ExternalLink } from "lucide-react";

import type { ClassifiedFinding } from "../../domain/analysisTypes";
import {
  getAnalyzerLabel,
  getCategoryLabel,
  getDisplayKindLabel
} from "../../domain/analyzerRegistry";
import { getSeverityRuLabel } from "../../domain/severity";
import { parseSpecializedEvidence } from "../../domain/specializedEvidence";
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
      <div className="finding-card-compact">
        <div className="finding-card-content">
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

          <div className="finding-card-meta">
            <span>
              Правило: <code>{finding.rule}</code>
            </span>

            <span>
              Файл: {finding.file_path || "—"}
              {finding.line ? `:${finding.line}` : ""}
            </span>
          </div>

          {specializedEvidence.type !== "none" && (
            <SpecializedEvidenceBlock evidence={specializedEvidence} compact />
          )}
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
      </div>
    </article>
  );
}