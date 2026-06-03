import {
  AlertTriangle,
  GitBranch,
  GitCommitHorizontal,
  ShieldAlert
} from "lucide-react";

import type {
  ParsedCfgEvidence,
  ParsedDfgEvidence,
  ParsedReentrancyEvidence,
  SpecializedEvidence
} from "../../domain/analysisTypes";
import { Badge } from "../../shared/ui/Badge";

interface SpecializedEvidenceBlockProps {
  evidence: SpecializedEvidence;
  compact?: boolean;
}

export function SpecializedEvidenceBlock({
  evidence,
  compact = false
}: SpecializedEvidenceBlockProps) {
  if (evidence.type === "cfg") {
    return <CfgEvidenceBlock data={evidence.data} compact={compact} />;
  }

  if (evidence.type === "dfg") {
    return <DfgEvidenceBlock data={evidence.data} compact={compact} />;
  }

  if (evidence.type === "reentrancy") {
    return <ReentrancyEvidenceBlock data={evidence.data} compact={compact} />;
  }

  return null;
}

function CfgEvidenceBlock({
  data,
  compact
}: {
  data: ParsedCfgEvidence;
  compact: boolean;
}) {
  const visibleNodes = compact ? data.nodes.slice(0, 3) : data.nodes.slice(0, 12);

  return (
    <section className="special-evidence special-evidence-cfg">
      <header>
        <div className="special-evidence-icon">
          <GitBranch size={20} />
        </div>

        <div>
          <span>Граф потока управления</span>
          <strong>{data.functionName || "Функция не определена"}</strong>
        </div>
      </header>

      <div className="special-evidence-grid">
        <Fact label="Начальная строка" value={data.startLine ?? "—"} />
        <Fact label="Конечная строка" value={data.endLine ?? "—"} />
        <Fact label="Узлов" value={data.nodesCount ?? "—"} />
        <Fact label="Ребер" value={data.edgesCount ?? "—"} />
      </div>

      {visibleNodes.length > 0 && (
        <div className="special-node-list">
          {visibleNodes.map((node, index) => (
            <article key={node.id || index}>
              <Badge>{node.type || "node"}</Badge>
              <code>{node.label || node.id || "—"}</code>
              <span>строка {node.line ?? "—"}</span>
            </article>
          ))}
        </div>
      )}

      {compact && data.nodes.length > visibleNodes.length && (
        <div className="special-compact-hint">
          Показаны первые {visibleNodes.length} узла. Полный граф доступен в деталях.
        </div>
      )}
    </section>
  );
}

function DfgEvidenceBlock({
  data,
  compact
}: {
  data: ParsedDfgEvidence;
  compact: boolean;
}) {
  const isWrite = data.accessType === "write";

  return (
    <section className="special-evidence special-evidence-dfg">
      <header>
        <div className="special-evidence-icon">
          <GitCommitHorizontal size={20} />
        </div>

        <div>
          <span>Доступ к состоянию</span>
          <strong>
            {isWrite ? "Запись переменной состояния" : "Чтение переменной состояния"}
          </strong>
        </div>
      </header>

      <div className="special-evidence-grid">
        <Fact label="Функция" value={data.functionName || "—"} />
        <Fact label="Переменная" value={data.stateVariable || "—"} />
        <Fact label="Тип доступа" value={translateAccessType(data.accessType)} />
        <Fact label="Строка" value={data.line ?? "—"} />
      </div>

      {data.code && !compact && (
        <div className="special-code-block">
          <span>Фрагмент кода</span>
          <pre>{data.code}</pre>
        </div>
      )}

      {data.code && compact && (
        <div className="special-code-inline">
          <span>Фрагмент:</span>
          <code>{data.code}</code>
        </div>
      )}
    </section>
  );
}

function ReentrancyEvidenceBlock({
  data,
  compact
}: {
  data: ParsedReentrancyEvidence;
  compact: boolean;
}) {
  if (compact) {
    return (
      <section className="special-evidence special-evidence-reentrancy">
        <header>
          <div className="special-evidence-icon">
            <ShieldAlert size={20} />
          </div>

          <div>
            <span>Корреляция CFG/DFG</span>
            <strong>Внешний вызов до обновления состояния</strong>
          </div>
        </header>

        <div className="special-evidence-grid">
          <Fact label="Функция" value={data.functionName || "—"} />
          <Fact label="Внешний вызов" value={data.externalCallLine ?? "—"} />
          <Fact label="Запись состояния" value={data.stateWriteLine ?? "—"} />
          <Fact label="Переменная" value={data.stateVariable || "—"} />
        </div>

        <div className="special-warning">
          Обнаружен рискованный порядок операций: внешний вызов выполняется до
          записи состояния. Полная цепочка доступна в деталях.
        </div>
      </section>
    );
  }

  return (
    <section className="special-evidence special-evidence-reentrancy">
      <header>
        <div className="special-evidence-icon">
          <ShieldAlert size={20} />
        </div>

        <div>
          <span>Корреляция CFG/DFG</span>
          <strong>Внешний вызов до обновления состояния</strong>
        </div>
      </header>

      <div className="reentrancy-flow">
        <article>
          <div>
            <AlertTriangle size={18} />
            <strong>1. Внешний вызов</strong>
          </div>

          <span>
            Функция: {data.functionName || "—"} · строка{" "}
            {data.externalCallLine ?? "—"}
          </span>

          <pre>{data.externalCallCode || "Код вызова не извлечен"}</pre>
        </article>

        <article>
          <div>
            <AlertTriangle size={18} />
            <strong>2. Запись состояния после вызова</strong>
          </div>

          <span>
            Переменная: {data.stateVariable || "—"} · строка{" "}
            {data.stateWriteLine ?? "—"}
          </span>

          <pre>{data.stateWriteCode || "Код записи не извлечен"}</pre>
        </article>
      </div>

      <div className="special-warning">
        Состояние контракта обновляется после внешнего вызова. Такой порядок
        требует проверки на реентерабельность. Рекомендуется применить
        checks-effects-interactions или ReentrancyGuard.
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function translateAccessType(value: string | null): string {
  if (value === "read") {
    return "чтение";
  }

  if (value === "write") {
    return "запись";
  }

  return value || "—";
}