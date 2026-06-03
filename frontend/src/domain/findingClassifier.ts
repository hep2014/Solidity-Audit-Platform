import type {
  AnalyzerKey,
  ClassifiedFinding,
  FindingDisplayKind,
  Severity,
  VulnerabilityClass
} from "./analysisTypes";
import type { FindingRead } from "../shared/types/api";
import { normalizeAnalyzer } from "./analyzerRegistry";
import { normalizeSeverity, SEVERITY_WEIGHT } from "./severity";
import {
  buildEvidence,
  containsAny,
  normalizeRule
} from "./findingParser";

type PartialClassification = {
  category: VulnerabilityClass;
  displayKind: FindingDisplayKind;
  title: string;
  shortDescription: string;
  recommendation: string;
  isActionable: boolean;
};

export function classifyFinding(finding: FindingRead): ClassifiedFinding {
  const analyzer = normalizeAnalyzer(finding.tool);
  const severity = normalizeSeverity(finding.severity);
  const rule = normalizeRule(finding.rule);

  const classification = classifyByAnalyzer(finding, analyzer, severity, rule);
  const sortWeight = buildSortWeight(classification.displayKind, classification.category, analyzer, severity, finding.line);

  return {
    ...finding,
    normalizedSeverity: severity,
    analyzer,
    category: classification.category,
    displayKind: classification.displayKind,
    title: classification.title,
    shortDescription: classification.shortDescription,
    recommendation: classification.recommendation,
    evidence: buildEvidence(finding.message || ""),
    sortWeight,
    isActionable: classification.isActionable
  };
}

export function classifyFindings(findings: FindingRead[]): ClassifiedFinding[] {
  return findings.map(classifyFinding).sort((a, b) => {
    if (b.sortWeight !== a.sortWeight) {
      return b.sortWeight - a.sortWeight;
    }

    const leftLine = a.line ?? Number.MAX_SAFE_INTEGER;
    const rightLine = b.line ?? Number.MAX_SAFE_INTEGER;

    if (leftLine !== rightLine) {
      return leftLine - rightLine;
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function classifyByAnalyzer(
  finding: FindingRead,
  analyzer: AnalyzerKey,
  severity: Severity,
  rule: string
): PartialClassification {
  switch (analyzer) {
    case "basic-scanner":
      return classifyBasicScanner(rule);
    case "slither":
      return classifySlither(finding, severity, rule);
    case "foundry":
      return classifyFoundry(finding, severity, rule);
    case "mythril":
      return classifyMythril(finding, severity, rule);
    case "echidna":
      return classifyEchidna(finding, severity, rule);
    case "cfg":
      return classifyCfg(rule);
    case "dfg":
      return classifyDfg(rule);
    case "custom-cfg-dfg":
      return classifyReentrancyCorrelation(finding, rule);
    case "manual-audit":
      return classifyManualAudit(rule);
    default:
      return classifyUnknown(finding, severity, rule);
  }
}

function classifyBasicScanner(rule: string): PartialClassification {
  const rules: Record<string, PartialClassification> = {
    EMPTY_FILE: {
      category: "configuration",
      displayKind: "tool-error",
      title: "Пустой Solidity-файл",
      shortDescription: "Загруженный файл не содержит кода для анализа.",
      recommendation: "Загрузить непустой `.sol` файл с контрактом, библиотекой или интерфейсом.",
      isActionable: true
    },
    NO_SPDX: {
      category: "configuration",
      displayKind: "vulnerability",
      title: "Отсутствует SPDX-лицензия",
      shortDescription: "В файле не найден идентификатор лицензии SPDX.",
      recommendation: "Добавить строку вида `// SPDX-License-Identifier: MIT` или другой корректный идентификатор лицензии.",
      isActionable: true
    },
    NO_PRAGMA: {
      category: "configuration",
      displayKind: "vulnerability",
      title: "Отсутствует pragma solidity",
      shortDescription: "В контракте не указана версия компилятора Solidity.",
      recommendation: "Добавить `pragma solidity ...`; желательно зафиксировать совместимый диапазон версии компилятора.",
      isActionable: true
    },
    NO_CONTRACT: {
      category: "configuration",
      displayKind: "tool-error",
      title: "Не найдено объявление контракта",
      shortDescription: "Сканер не обнаружил `contract` в загруженном файле.",
      recommendation: "Проверить, что загружен Solidity contract, library или interface, а не вспомогательный текстовый файл.",
      isActionable: true
    },
    TX_ORIGIN: {
      category: "access-control",
      displayKind: "vulnerability",
      title: "Риск авторизации через tx.origin",
      shortDescription: "Использование `tx.origin` для авторизации может привести к phishing-атакам через промежуточный контракт.",
      recommendation: "Заменить проверки `tx.origin` на `msg.sender` и явную owner/role-based модель доступа.",
      isActionable: true
    },
    SELFDESTRUCT: {
      category: "destructive-operation",
      displayKind: "vulnerability",
      title: "Опасная операция selfdestruct",
      shortDescription: "Контракт содержит вызов `selfdestruct`, который может уничтожить контракт или повлиять на баланс.",
      recommendation: "Удалить `selfdestruct` либо жестко ограничить emergency-path и подробно задокументировать условия его применения.",
      isActionable: true
    },
    DELEGATECALL: {
      category: "dangerous-call",
      displayKind: "vulnerability",
      title: "Опасный delegatecall",
      shortDescription: "`delegatecall` выполняет внешний код в контексте storage текущего контракта.",
      recommendation: "Проверить доверенность target-контракта, совместимость storage layout и ограничения доступа.",
      isActionable: true
    },
    LOW_LEVEL_CALL: {
      category: "dangerous-call",
      displayKind: "vulnerability",
      title: "Низкоуровневый внешний вызов",
      shortDescription: "Контракт использует `.call(...)`, что требует ручной проверки результата и reentrancy-сценариев.",
      recommendation: "Проверить return value, порядок checks-effects-interactions и наличие reentrancy guard при необходимости.",
      isActionable: true
    },
    BLOCK_TIMESTAMP: {
      category: "randomness-or-time",
      displayKind: "vulnerability",
      title: "Зависимость от block.timestamp",
      shortDescription: "`block.timestamp` может быть небезопасен для критичной логики, randomness и точных временных условий.",
      recommendation: "Не использовать timestamp как источник случайности или единственный фактор критичной бизнес-логики.",
      isActionable: true
    }
  };

  return rules[rule] ?? {
    category: "unknown",
    displayKind: "vulnerability",
    title: "Неизвестное правило базового сканера",
    shortDescription: "Базовый сканер вернул правило, которого нет в frontend-справочнике.",
    recommendation: "Проверить raw message и при необходимости добавить правило в классификатор.",
    isActionable: true
  };
}

function classifySlither(
  finding: FindingRead,
  severity: Severity,
  rule: string
): PartialClassification {
  if (rule === "SLITHER_NO_FINDINGS") {
    return {
      category: "no-issue",
      displayKind: "no-issue",
      title: "Slither не обнаружил проблем",
      shortDescription: "Статический анализ завершился без detector findings.",
      recommendation: "Дополнительных действий по этому результату не требуется.",
      isActionable: false
    };
  }

  if (rule === "SLITHER_EXECUTION_ERROR" || rule === "SLITHER_FILE_NOT_FOUND" || rule.includes("TIMEOUT")) {
    return toolError("Ошибка запуска Slither", "Slither не смог корректно завершить анализ.", "Проверить входной проект, зависимости, версию solc и stderr анализатора.");
  }

  if (rule.includes("REENTRANCY")) {
    return vulnerability("reentrancy", "Потенциальная реентерабельность", finding.message, "Применить checks-effects-interactions и рассмотреть ReentrancyGuard.");
  }

  if (rule.includes("TX_ORIGIN")) {
    return vulnerability("access-control", "Риск авторизации через tx.origin", finding.message, "Заменить `tx.origin` на `msg.sender` и явную модель ролей.");
  }

  if (rule.includes("DELEGATECALL") || rule.includes("LOW_LEVEL") || rule.includes("LOWLEVEL")) {
    return vulnerability("dangerous-call", "Опасный внешний вызов", finding.message, "Проверить target, return value, reentrancy-риск и ограничения доступа.");
  }

  if (rule.includes("SELFDESTRUCT")) {
    return vulnerability("destructive-operation", "Опасная операция самоуничтожения", finding.message, "Удалить или строго ограничить destructive emergency path.");
  }

  if (rule.includes("TIMESTAMP") || rule.includes("WEAK_PRNG") || rule.includes("RANDOM")) {
    return vulnerability("randomness-or-time", "Небезопасная зависимость от времени или случайности", finding.message, "Не использовать timestamp/block data как надежный источник случайности.");
  }

  if (rule.includes("ACCESS") || rule.includes("AUTH") || rule.includes("OWNER")) {
    return vulnerability("access-control", "Проблема контроля доступа", finding.message, "Проверить owner/admin modifiers, роли и privileged functions.");
  }

  if (rule.includes("UNINITIALIZED") || rule.includes("SHADOW") || rule.includes("VISIBILITY")) {
    return {
      category: "configuration",
      displayKind: "vulnerability",
      title: "Проблема конфигурации или качества кода",
      shortDescription: summarize(finding.message),
      recommendation: "Проверить предупреждение Slither и исправить участок кода согласно detector description.",
      isActionable: true
    };
  }

  return {
    category: severity === "info" ? "informational" : "unknown",
    displayKind: severity === "info" ? "tool-status" : "vulnerability",
    title: severity === "info" ? "Информационный результат Slither" : "Потенциальная проблема Slither",
    shortDescription: summarize(finding.message),
    recommendation: "Изучить описание detector-а Slither и определить применимость результата к контракту.",
    isActionable: severity !== "info"
  };
}

function classifyFoundry(
  finding: FindingRead,
  severity: Severity,
  rule: string
): PartialClassification {
  const message = finding.message || "";

  if (rule === "FOUNDRY_FILE_NOT_FOUND" || rule === "FOUNDRY_TARGET_NOT_FOUND" || rule.includes("TIMEOUT")) {
    return toolError("Ошибка запуска Foundry", "Foundry не получил корректную цель анализа.", "Проверить entrypoint проекта, наличие foundry.toml и структуру workspace.");
  }

  if (rule === "FOUNDRY_BUILD_AND_TEST" && severity === "info") {
    return {
      category: "no-issue",
      displayKind: "tool-status",
      title: "Сборка и тесты Foundry пройдены",
      shortDescription: "Foundry завершил build/test без ошибки завершения.",
      recommendation: "Дополнительных действий по этому статусу не требуется.",
      isActionable: false
    };
  }

  if (containsAny(message, ["Compiler run failed", "CompilerError", "ParserError"])) {
    return {
      category: "testing-failure",
      displayKind: "tool-error",
      title: "Ошибка сборки Foundry",
      shortDescription: "Проект не был успешно скомпилирован Foundry.",
      recommendation: "Проверить ошибки компиляции, import paths, версии solc и зависимости проекта.",
      isActionable: true
    };
  }

  if (containsAny(message, ["[FAIL", "Suite result: FAILED", "Failing tests:"])) {
    return {
      category: "testing-failure",
      displayKind: "vulnerability",
      title: "Тесты Foundry завершились с ошибкой",
      shortDescription: "Один или несколько тестов Foundry упали. Это требует проверки логики контракта или тестового окружения.",
      recommendation: "Открыть stdout/stderr, найти failing test и проверить нарушенное условие.",
      isActionable: true
    };
  }

  return {
    category: "testing-failure",
    displayKind: severity === "high" ? "vulnerability" : "tool-status",
    title: severity === "high" ? "Foundry обнаружил проблему сборки или тестов" : "Результат Foundry",
    shortDescription: summarize(message),
    recommendation: "Проверить вывод Foundry и exit code.",
    isActionable: severity === "high"
  };
}

function classifyMythril(
  finding: FindingRead,
  severity: Severity,
  rule: string
): PartialClassification {
  const message = finding.message || "";

  if (rule === "MYTHRIL_FILE_NOT_FOUND" || rule === "MYTHRIL_NO_SOLIDITY_FILES") {
    return toolError("Ошибка входных данных Mythril", "Mythril не нашел Solidity-файл для анализа.", "Проверить project entrypoint и наличие `.sol` файлов.");
  }

  if (containsAny(message, [
    "SWC-",
    "Integer Overflow",
    "Integer Underflow",
    "Reentrancy",
    "Unchecked Call",
    "Transaction Order Dependence",
    "Timestamp Dependence",
    "Exception State",
    "Dependence on tx.origin"
  ])) {
    return {
      category: "symbolic-execution",
      displayKind: "vulnerability",
      title: "Mythril обнаружил потенциальную уязвимость",
      shortDescription: summarize(message),
      recommendation: "Проверить trace и SWC-описание, затем воспроизвести сценарий на минимальном тесте.",
      isActionable: true
    };
  }

  if (containsAny(message, [
    "Traceback",
    "No such file",
    "Solc experienced a fatal error",
    "ParserError",
    "CompilerError",
    "Timeout",
    "Docker command timed out"
  ])) {
    return toolError("Ошибка выполнения Mythril", "Mythril не смог корректно завершить символьное исполнение.", "Проверить stderr, solc version, imports и ограничения Docker timeout.");
  }

  return {
    category: "symbolic-execution",
    displayKind: severity === "info" ? "tool-status" : "vulnerability",
    title: severity === "info" ? "Mythril завершил символьное исполнение" : "Непроверенный результат Mythril",
    shortDescription: summarize(message),
    recommendation: severity === "info"
      ? "Дополнительных действий по этому статусу не требуется."
      : "Проверить raw output Mythril и определить, является ли результат уязвимостью или ошибкой инструмента.",
    isActionable: severity !== "info"
  };
}

function classifyEchidna(
  finding: FindingRead,
  severity: Severity,
  rule: string
): PartialClassification {
  const message = finding.message || "";

  if (rule === "ECHIDNA_FILE_NOT_FOUND" || rule === "ECHIDNA_NO_SOLIDITY_FILES") {
    return toolError("Ошибка входных данных Echidna", "Echidna не нашла Solidity-файл для fuzzing.", "Проверить структуру проекта и наличие target-контракта.");
  }

  if (rule === "ECHIDNA_CONFIG_NOT_FOUND") {
    return {
      category: "configuration",
      displayKind: "tool-status",
      title: "Конфигурация Echidna не найдена",
      shortDescription: "В проекте нет `echidna.yaml` или `echidna.yml`, поэтому fuzzing не запускался полноценно.",
      recommendation: "Добавить конфигурационный файл Echidna с target contract и свойствами.",
      isActionable: false
    };
  }

  const hasPropertyFailure = containsAny(message, [
    "failed!",
    "falsified",
    "Failed",
    "property",
    "counterexample",
    "Call sequence",
    "Transactions:"
  ]);

  const hasSetupError = containsAny(message, [
    "No contract",
    "could not find",
    "Invalid configuration",
    "YAML",
    "ParserError",
    "CompilerError"
  ]);

  if (severity === "high" && hasPropertyFailure) {
    return {
      category: "fuzzing-failure",
      displayKind: "vulnerability",
      title: "Echidna нашла нарушение свойства",
      shortDescription: "Фаззинг обнаружил failing property или counterexample.",
      recommendation: "Разобрать call sequence/counterexample и исправить нарушенный инвариант.",
      isActionable: true
    };
  }

  if (severity === "high" && hasSetupError) {
    return toolError("Ошибка настройки Echidna", "Echidna завершилась с ошибкой конфигурации, target-контракта или компиляции.", "Проверить echidna.yaml, target contract, imports и compiler errors.");
  }

  return {
    category: severity === "info" ? "no-issue" : "fuzzing-failure",
    displayKind: severity === "info" ? "tool-status" : "vulnerability",
    title: severity === "info" ? "Echidna не сообщила о failing property" : "Проблема fuzzing-запуска Echidna",
    shortDescription: summarize(message),
    recommendation: severity === "info"
      ? "Дополнительных действий по этому статусу не требуется."
      : "Проверить raw output Echidna и определить, это failing property или ошибка настройки.",
    isActionable: severity !== "info"
  };
}

function classifyCfg(rule: string): PartialClassification {
  if (rule === "CFG_FILE_NOT_FOUND") {
    return toolError("Файл для CFG не найден", "CFG-анализатор не смог открыть project entrypoint.", "Проверить, существует ли файл проекта на сервере.");
  }

  if (rule === "CFG_NO_FUNCTIONS") {
    return {
      category: "informational",
      displayKind: "no-issue",
      title: "Функции Solidity не найдены",
      shortDescription: "CFG-анализатор не обнаружил функций для построения графа.",
      recommendation: "Проверить, что анализируемый файл содержит функции контракта.",
      isActionable: false
    };
  }

  if (rule === "CFG_FUNCTION_GRAPH") {
    return {
      category: "control-flow",
      displayKind: "graph-info",
      title: "Граф потока управления функции",
      shortDescription: "CFG-анализатор извлек управляющие конструкции функции. Это не является уязвимостью само по себе.",
      recommendation: "Использовать граф как вспомогательный материал для ручного аудита.",
      isActionable: false
    };
  }

  return classifyUnknownRuleAsInfo("Информационный результат CFG");
}

function classifyDfg(rule: string): PartialClassification {
  if (rule === "DFG_FILE_NOT_FOUND") {
    return toolError("Файл для DFG не найден", "DFG-анализатор не смог открыть project entrypoint.", "Проверить, существует ли файл проекта на сервере.");
  }

  if (rule === "DFG_NO_STATE_VARIABLES") {
    return {
      category: "informational",
      displayKind: "no-issue",
      title: "State variables не найдены",
      shortDescription: "DFG-анализатор не обнаружил переменных состояния.",
      recommendation: "Дополнительных действий по этому статусу не требуется.",
      isActionable: false
    };
  }

  if (rule === "DFG_NO_STATE_ACCESSES") {
    return {
      category: "informational",
      displayKind: "no-issue",
      title: "Обращения к state variables не найдены",
      shortDescription: "Переменные состояния найдены, но чтения/записи не обнаружены.",
      recommendation: "Дополнительных действий по этому статусу не требуется.",
      isActionable: false
    };
  }

  if (rule === "DFG_STATE_READ") {
    return {
      category: "data-flow",
      displayKind: "graph-info",
      title: "Чтение переменной состояния",
      shortDescription: "DFG обнаружил чтение state variable. Это не является уязвимостью без дополнительной корреляции.",
      recommendation: "Использовать факт чтения как вспомогательную информацию для ручного аудита.",
      isActionable: false
    };
  }

  if (rule === "DFG_STATE_WRITE") {
    return {
      category: "data-flow",
      displayKind: "graph-info",
      title: "Запись переменной состояния",
      shortDescription: "DFG обнаружил запись state variable. Это не считается уязвимостью без корреляции с внешним вызовом.",
      recommendation: "Проверять как риск только при наличии корреляционного finding-а по реентерабельности.",
      isActionable: false
    };
  }

  return classifyUnknownRuleAsInfo("Информационный результат DFG");
}

function classifyReentrancyCorrelation(
  finding: FindingRead,
  rule: string
): PartialClassification {
  if (rule === "REENTRANCY_CORRELATION_NO_FILES") {
    return {
      category: "informational",
      displayKind: "no-issue",
      title: "Файлы для корреляции не найдены",
      shortDescription: "Анализатор не нашел Solidity-файлы для проверки реентерабельности.",
      recommendation: "Проверить загруженный проект.",
      isActionable: false
    };
  }

  if (rule === "REENTRANCY_CORRELATION_NO_ISSUES") {
    return {
      category: "no-issue",
      displayKind: "no-issue",
      title: "Паттерн реентерабельности не обнаружен",
      shortDescription: "Корреляция CFG/DFG не нашла внешний вызов перед обновлением состояния.",
      recommendation: "Дополнительных действий по этому статусу не требуется.",
      isActionable: false
    };
  }

  if (rule === "POSSIBLE_REENTRANCY_BY_CFG_DFG") {
    return {
      category: "reentrancy",
      displayKind: "vulnerability",
      title: "Возможная реентерабельность",
      shortDescription: "Обнаружен внешний вызов до обновления состояния контракта.",
      recommendation: "Применить checks-effects-interactions или ReentrancyGuard; сначала обновлять состояние, затем выполнять внешний вызов.",
      isActionable: true
    };
  }

  return vulnerability("reentrancy", "Результат корреляции реентерабельности", finding.message, "Проверить порядок внешнего вызова и обновления состояния.");
}

function classifyManualAudit(rule: string): PartialClassification {
  const base: PartialClassification = {
    category: "manual-review",
    displayKind: "manual-check",
    title: "Пункт ручной проверки",
    shortDescription: "Этот finding является задачей для ручного аудита, а не автоматически подтвержденной уязвимостью.",
    recommendation: "Проверить соответствующий аспект контракта вручную.",
    isActionable: false
  };

  if (rule.startsWith("MANUAL_ACCESS_CONTROL")) {
    return {
      ...base,
      category: "access-control",
      title: "Ручная проверка контроля доступа",
      recommendation: "Проверить owner-only/admin-функции, роли, mint/burn, upgrade и pause/unpause операции."
    };
  }

  if (rule.startsWith("MANUAL_EXTERNAL_CALLS")) {
    return {
      ...base,
      category: "dangerous-call",
      title: "Ручная проверка внешних вызовов",
      recommendation: "Проверить call, delegatecall, staticcall, transfer/send и порядок обновления состояния."
    };
  }

  if (rule.startsWith("MANUAL_REENTRANCY")) {
    return {
      ...base,
      category: "reentrancy",
      title: "Ручная проверка реентерабельности",
      recommendation: "Проверить withdraw, claim, redeem, swap и callback-like функции."
    };
  }

  if (rule.startsWith("MANUAL_ORACLE")) {
    return {
      ...base,
      category: "randomness-or-time",
      title: "Ручная проверка oracle-зависимостей",
      recommendation: "Проверить возможность манипуляции ценой, randomness или внешними источниками данных."
    };
  }

  if (rule.startsWith("MANUAL_UPGRADEABILITY")) {
    return {
      ...base,
      category: "access-control",
      title: "Ручная проверка upgradeability",
      recommendation: "Проверить initializer protection, storage layout compatibility и авторизацию upgrade."
    };
  }

  if (rule.startsWith("MANUAL_EMERGENCY_CONTROLS")) {
    return {
      ...base,
      category: "access-control",
      title: "Ручная проверка emergency controls",
      recommendation: "Проверить pause, emergency withdraw, admin recovery и пределы emergency-полномочий."
    };
  }

  return base;
}

function classifyUnknown(
  finding: FindingRead,
  severity: Severity,
  rule: string
): PartialClassification {
  if (
    rule.includes("_EXECUTION_ERROR") ||
    rule.includes("FILE_NOT_FOUND") ||
    rule.includes("NO_SOLIDITY_FILES")
  ) {
    return toolError("Ошибка анализатора", "Анализатор вернул техническую ошибку.", "Проверить raw output, входной файл и конфигурацию инструмента.");
  }

  if (rule.includes("NO_FINDINGS") || rule.includes("NO_ISSUES")) {
    return {
      category: "no-issue",
      displayKind: "no-issue",
      title: "Проблем не найдено",
      shortDescription: "Анализатор сообщил, что не обнаружил проблем.",
      recommendation: "Дополнительных действий по этому статусу не требуется.",
      isActionable: false
    };
  }

  if (severity === "critical" || severity === "high" || severity === "medium") {
    return {
      category: "unknown",
      displayKind: "vulnerability",
      title: "Потенциальная проблема неизвестного типа",
      shortDescription: summarize(finding.message),
      recommendation: "Проверить raw message и добавить правило в frontend-классификатор.",
      isActionable: true
    };
  }

  return {
    category: "informational",
    displayKind: "tool-status",
    title: "Информационный результат",
    shortDescription: summarize(finding.message),
    recommendation: "Дополнительных действий может не требоваться; проверьте raw output при необходимости.",
    isActionable: false
  };
}

function vulnerability(
  category: VulnerabilityClass,
  title: string,
  message: string,
  recommendation: string
): PartialClassification {
  return {
    category,
    displayKind: "vulnerability",
    title,
    shortDescription: summarize(message),
    recommendation,
    isActionable: true
  };
}

function toolError(title: string, description: string, recommendation: string): PartialClassification {
  return {
    category: "tool-error",
    displayKind: "tool-error",
    title,
    shortDescription: description,
    recommendation,
    isActionable: true
  };
}

function classifyUnknownRuleAsInfo(title: string): PartialClassification {
  return {
    category: "informational",
    displayKind: "tool-status",
    title,
    shortDescription: "Анализатор вернул информационный результат.",
    recommendation: "Проверить raw output при необходимости.",
    isActionable: false
  };
}

function summarize(message: string): string {
  const normalized = String(message || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Описание отсутствует.";
  }

  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

function buildSortWeight(
  kind: FindingDisplayKind,
  category: VulnerabilityClass,
  analyzer: AnalyzerKey,
  severity: Severity,
  line: number | null
): number {
  const kindWeight: Record<FindingDisplayKind, number> = {
    vulnerability: 6000,
    "tool-error": 5000,
    "manual-check": 4000,
    "graph-info": 2000,
    "tool-status": 1000,
    "no-issue": 500
  };

  const categoryWeight: Partial<Record<VulnerabilityClass, number>> = {
    reentrancy: 900,
    "access-control": 800,
    "dangerous-call": 700,
    "destructive-operation": 650,
    "fuzzing-failure": 600,
    "testing-failure": 550,
    "symbolic-execution": 500,
    configuration: 300,
    unknown: 100
  };

  const analyzerWeight: Record<AnalyzerKey, number> = {
    "basic-scanner": 90,
    slither: 80,
    "custom-cfg-dfg": 70,
    mythril: 60,
    echidna: 50,
    foundry: 40,
    cfg: 30,
    dfg: 20,
    "manual-audit": 10,
    unknown: 0
  };

  const lineWeight = line ? Math.max(0, 1000 - line) / 1000 : 0;

  return (
    kindWeight[kind] +
    SEVERITY_WEIGHT[severity] +
    (categoryWeight[category] ?? 0) +
    analyzerWeight[analyzer] +
    lineWeight
  );
}