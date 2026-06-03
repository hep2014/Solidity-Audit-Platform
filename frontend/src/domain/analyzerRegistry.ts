import type { AnalyzerKey, AnalyzerMeta, VulnerabilityClass, FindingDisplayKind } from "./analysisTypes";

export const ANALYZERS: Record<AnalyzerKey, AnalyzerMeta> = {
  "basic-scanner": {
    key: "basic-scanner",
    label: "Базовый сканер",
    shortLabel: "Basic",
    purpose: "Быстрые эвристические проверки Solidity-кода",
    resultType: "vulnerability-rules",
    order: 10
  },
  slither: {
    key: "slither",
    label: "Slither",
    shortLabel: "Slither",
    purpose: "Статический анализ Solidity-контрактов",
    resultType: "detectors",
    order: 20
  },
  "custom-cfg-dfg": {
    key: "custom-cfg-dfg",
    label: "Корреляция реентерабельности",
    shortLabel: "Reentrancy",
    purpose: "Поиск внешнего вызова перед обновлением состояния",
    resultType: "correlation",
    order: 30
  },
  mythril: {
    key: "mythril",
    label: "Mythril",
    shortLabel: "Mythril",
    purpose: "Символьное исполнение смарт-контрактов",
    resultType: "tool-output",
    order: 40
  },
  echidna: {
    key: "echidna",
    label: "Echidna",
    shortLabel: "Echidna",
    purpose: "Фаззинг свойств и инвариантов",
    resultType: "fuzz-run",
    order: 50
  },
  foundry: {
    key: "foundry",
    label: "Foundry",
    shortLabel: "Foundry",
    purpose: "Сборка проекта и запуск тестов",
    resultType: "test-run",
    order: 60
  },
  cfg: {
    key: "cfg",
    label: "Граф потока управления",
    shortLabel: "CFG",
    purpose: "Извлечение управляющих конструкций функций",
    resultType: "graph-info",
    order: 70
  },
  dfg: {
    key: "dfg",
    label: "Граф потока данных",
    shortLabel: "DFG",
    purpose: "Анализ чтения и записи state variables",
    resultType: "graph-info",
    order: 80
  },
  "manual-audit": {
    key: "manual-audit",
    label: "Ручная проверка",
    shortLabel: "Manual",
    purpose: "Чек-лист ручного аудита смарт-контракта",
    resultType: "manual-checklist",
    order: 90
  },
  unknown: {
    key: "unknown",
    label: "Неизвестный анализатор",
    shortLabel: "Unknown",
    purpose: "Источник результата не распознан frontend-ом",
    resultType: "unknown",
    order: 999
  }
};

export function normalizeAnalyzer(value: string | null | undefined): AnalyzerKey {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "basic-scanner") return "basic-scanner";
  if (normalized === "slither") return "slither";
  if (normalized === "foundry") return "foundry";
  if (normalized === "mythril") return "mythril";
  if (normalized === "echidna") return "echidna";
  if (normalized === "cfg") return "cfg";
  if (normalized === "dfg") return "dfg";
  if (normalized === "custom-cfg-dfg") return "custom-cfg-dfg";
  if (normalized === "manual-audit") return "manual-audit";

  return "unknown";
}

export function getAnalyzerLabel(analyzer: AnalyzerKey): string {
  return ANALYZERS[analyzer]?.label ?? ANALYZERS.unknown.label;
}

export function getAnalyzerPurpose(analyzer: AnalyzerKey): string {
  return ANALYZERS[analyzer]?.purpose ?? ANALYZERS.unknown.purpose;
}

export function getCategoryLabel(category: VulnerabilityClass): string {
  switch (category) {
    case "reentrancy":
      return "Реентерабельность";
    case "access-control":
      return "Контроль доступа";
    case "dangerous-call":
      return "Опасный внешний вызов";
    case "destructive-operation":
      return "Разрушающая операция";
    case "randomness-or-time":
      return "Время или псевдослучайность";
    case "testing-failure":
      return "Ошибка тестов";
    case "fuzzing-failure":
      return "Ошибка фаззинга";
    case "symbolic-execution":
      return "Символьное исполнение";
    case "control-flow":
      return "Поток управления";
    case "data-flow":
      return "Поток данных";
    case "manual-review":
      return "Ручная проверка";
    case "configuration":
      return "Конфигурация";
    case "tool-error":
      return "Ошибка анализатора";
    case "no-issue":
      return "Проблем не найдено";
    case "informational":
      return "Информационная запись";
    default:
      return "Неизвестная категория";
  }
}

export function getDisplayKindLabel(kind: FindingDisplayKind): string {
  switch (kind) {
    case "vulnerability":
      return "Уязвимость";
    case "manual-check":
      return "Ручная проверка";
    case "tool-status":
      return "Статус анализатора";
    case "graph-info":
      return "Графовая информация";
    case "no-issue":
      return "Проблем не найдено";
    case "tool-error":
      return "Ошибка анализатора";
    default:
      return "Результат";
  }
}