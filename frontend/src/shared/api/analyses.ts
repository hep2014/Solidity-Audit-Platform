import { apiDelete, apiGet, apiPost, withQuery } from "./http";
import type {
  AnalysisMode,
  AnalysisRead,
  AnalysisReport,
  DeleteAnalysisResponse,
  FindingRead,
  AnalysisLogRead,
  UUID
} from "../types/api";

const RUN_ENDPOINT_BY_MODE: Record<AnalysisMode, string> = {
  basic: "run-basic",
  slither: "run-slither",
  foundry: "run-foundry",
  mythril: "run-mythril",
  echidna: "run-echidna",
  cfg: "run-cfg",
  dfg: "run-dfg",
  "reentrancy-correlation": "run-reentrancy-correlation",
  "manual-checklist": "run-manual-checklist",
  full: "run-full"
};

export const ANALYSIS_MODES: Array<{
  mode: AnalysisMode;
  title: string;
  description: string;
}> = [
  {
    mode: "basic",
    title: "Basic Scanner",
    description: "Быстрая регулярная проверка Solidity-кода: SPDX, pragma, tx.origin, selfdestruct, delegatecall, low-level call."
  },
  {
    mode: "slither",
    title: "Slither",
    description: "Статический анализ смарт-контрактов через Slither."
  },
  {
    mode: "foundry",
    title: "Foundry",
    description: "Сборка и тестирование Foundry-проекта или одиночного файла."
  },
  {
    mode: "mythril",
    title: "Mythril",
    description: "Символьное исполнение и поиск потенциальных уязвимостей."
  },
  {
    mode: "echidna",
    title: "Echidna",
    description: "Property-based fuzzing при наличии echidna.yaml или echidna.yml."
  },
  {
    mode: "cfg",
    title: "CFG",
    description: "Построение упрощенного графа потока управления по функциям."
  },
  {
    mode: "dfg",
    title: "DFG",
    description: "Анализ чтения и записи state variables."
  },
  {
    mode: "reentrancy-correlation",
    title: "CFG/DFG Reentrancy",
    description: "Корреляция внешних вызовов и записи состояния после вызова."
  },
  {
    mode: "manual-checklist",
    title: "Manual Checklist",
    description: "Чек-лист ручного аудита: access control, oracle, accounting, emergency controls."
  },
  {
    mode: "full",
    title: "Full Pipeline",
    description: "Полный прогон всех поддерживаемых анализаторов."
  }
];

export async function runAnalysis(
  projectId: UUID,
  mode: AnalysisMode,
  force = false
): Promise<AnalysisRead> {
  const endpoint = RUN_ENDPOINT_BY_MODE[mode];

  return apiPost<AnalysisRead>(
    withQuery(`/api/analyses/${projectId}/${endpoint}`, { force })
  );
}

export async function getAnalysis(analysisId: UUID): Promise<AnalysisRead> {
  return apiGet<AnalysisRead>(`/api/analyses/${analysisId}`);
}

export async function getProjectAnalyses(projectId: UUID): Promise<AnalysisRead[]> {
  return apiGet<AnalysisRead[]>(`/api/analyses/project/${projectId}`);
}

export async function getAnalysisFindings(analysisId: UUID): Promise<FindingRead[]> {
  return apiGet<FindingRead[]>(`/api/analyses/${analysisId}/findings`);
}

export async function getAnalysisLogs(analysisId: UUID): Promise<AnalysisLogRead[]> {
  return apiGet<AnalysisLogRead[]>(`/api/analyses/${analysisId}/logs`);
}

export async function getAnalysisReport(analysisId: UUID): Promise<AnalysisReport> {
  return apiGet<AnalysisReport>(`/api/analyses/${analysisId}/report`);
}

export async function cancelAnalysis(analysisId: UUID): Promise<AnalysisRead> {
  return apiPost<AnalysisRead>(`/api/analyses/${analysisId}/cancel`);
}

export async function retryAnalysis(
  analysisId: UUID,
  mode?: AnalysisMode,
  force = false
): Promise<AnalysisRead> {
  return apiPost<AnalysisRead>(
    withQuery(`/api/analyses/${analysisId}/retry`, { mode, force })
  );
}

export async function deleteAnalysis(analysisId: UUID): Promise<DeleteAnalysisResponse> {
  return apiDelete<DeleteAnalysisResponse>(`/api/analyses/${analysisId}`);
}