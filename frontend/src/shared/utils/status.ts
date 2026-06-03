import type { AnalysisStatus } from "../types/api";

export function isTerminalStatus(status: string | null | undefined): boolean {
  return (
    status === "SUCCESS" ||
    status === "FAILED" ||
    status === "TIMEOUT" ||
    status === "PARTIAL_SUCCESS" ||
    status === "CANCELLED"
  );
}

export function isActiveStatus(status: string | null | undefined): boolean {
  return status === "PENDING" || status === "RUNNING";
}

export function getStatusLabel(status: AnalysisStatus | string | null | undefined): string {
  switch (status) {
    case "PENDING":
      return "В очереди";
    case "RUNNING":
      return "Выполняется";
    case "SUCCESS":
      return "Успешно";
    case "FAILED":
      return "Ошибка";
    case "PARTIAL_SUCCESS":
      return "Частично успешно";
    case "CANCELLED":
      return "Отменено";
    case "TIMEOUT":
      return "Таймаут";
    default:
      return "Неизвестно";
  }
}

export function getStepLabel(step: string | null | undefined): string {
  if (!step) {
    return "Ожидание";
  }

  const labels: Record<string, string> = {
    "basic-scanner-queued": "Basic Scanner поставлен в очередь",
    "slither-queued": "Slither поставлен в очередь",
    "foundry-queued": "Foundry поставлен в очередь",
    "mythril-queued": "Mythril поставлен в очередь",
    "echidna-queued": "Echidna поставлен в очередь",
    "cfg-queued": "CFG поставлен в очередь",
    "dfg-queued": "DFG поставлен в очередь",
    "reentrancy-correlation-queued": "CFG/DFG correlation поставлен в очередь",
    "manual-audit-checklist-queued": "Manual audit checklist поставлен в очередь",
    "full-analysis-queued": "Full pipeline поставлен в очередь",

    "basic-scanner": "Basic Scanner",
    slither: "Slither",
    foundry: "Foundry",
    mythril: "Mythril",
    echidna: "Echidna",
    cfg: "CFG",
    dfg: "DFG",
    "reentrancy-correlation": "CFG/DFG reentrancy correlation",
    "manual-audit-checklist": "Manual audit checklist",

    completed: "Завершено",
    cancelled: "Отменено",
    "full-analysis-failed": "Full pipeline завершился с ошибкой"
  };

  return labels[step] || step;
}