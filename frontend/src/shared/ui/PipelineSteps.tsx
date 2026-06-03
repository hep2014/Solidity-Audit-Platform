import clsx from "clsx";
import { Check, Circle, Loader2, X } from "lucide-react";

export interface PipelineStep {
  key: string;
  title: string;
  description?: string;
}

interface PipelineStepsProps {
  steps: PipelineStep[];
  currentStep?: string | null;
  completedTools?: string[];
  failedTools?: string[];
  active?: boolean;
}

export function PipelineSteps({
  steps,
  currentStep,
  completedTools = [],
  failedTools = [],
  active = false
}: PipelineStepsProps) {
  return (
    <div className="pipeline">
      {steps.map((step) => {
        const isCurrent = currentStep === step.key;
        const isCompleted = completedTools.includes(step.key);
        const isFailed = failedTools.includes(step.key);

        return (
          <div
            key={step.key}
            className={clsx("pipeline-step", {
              "pipeline-step-current": isCurrent,
              "pipeline-step-completed": isCompleted,
              "pipeline-step-failed": isFailed
            })}
          >
            <div className="pipeline-step-icon">
              {isFailed ? (
                <X size={16} />
              ) : isCompleted ? (
                <Check size={16} />
              ) : isCurrent && active ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Circle size={14} />
              )}
            </div>

            <div>
              <strong>{step.title}</strong>
              {step.description && <span>{step.description}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const FULL_PIPELINE_STEPS: PipelineStep[] = [
  {
    key: "basic-scanner",
    title: "Basic Scanner",
    description: "Базовые регулярные проверки Solidity"
  },
  {
    key: "slither",
    title: "Slither",
    description: "Статический анализ"
  },
  {
    key: "foundry",
    title: "Foundry",
    description: "Build и test"
  },
  {
    key: "mythril",
    title: "Mythril",
    description: "Символьное исполнение"
  },
  {
    key: "echidna",
    title: "Echidna",
    description: "Property-based fuzzing"
  },
  {
    key: "cfg",
    title: "CFG",
    description: "Control-flow graph"
  },
  {
    key: "dfg",
    title: "DFG",
    description: "Data-flow analysis"
  },
  {
    key: "reentrancy-correlation",
    title: "Reentrancy correlation",
    description: "CFG + DFG"
  },
  {
    key: "manual-audit-checklist",
    title: "Manual checklist",
    description: "Ручной аудит"
  }
];