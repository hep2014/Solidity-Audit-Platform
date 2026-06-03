import { useState } from "react";
import { FileSearch, Loader2, RotateCcw } from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge, severityTone } from "../shared/ui/Badge";
import { FileDropzone } from "../shared/ui/FileDropzone";
import { quickScanSolidity } from "../shared/api/scan";
import { ApiError } from "../shared/api/http";
import type { ScanIssue, ScanResponse } from "../shared/types/api";
import { getSeverityRuLabel, normalizeSeverity } from "../domain/severity";

export function QuickScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!file) {
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const response = await quickScanSolidity(file);
      setResult(response);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="page-grid page-grid-two">
      <Card>
        <CardHeader
          eyebrow="Быстрая проверка"
          title="Проверить один Solidity-файл"
          description="Режим для мгновенной эвристической проверки одного `.sol` файла без добавления проекта в общий список."
        />

        <div className="card-body page-grid">
          <FileDropzone
            value={file}
            accept=".sol"
            title="Выберите `.sol` файл"
            description="Быстрая проверка принимает только одиночный Solidity-файл."
            disabled={scanning}
            onChange={setFile}
          />

          {error && (
            <div className="error-box">
              <strong>Ошибка</strong>
              <pre>{error}</pre>
            </div>
          )}

          <div className="actions-row">
            <Button
              disabled={!file || scanning}
              onClick={handleScan}
              icon={
                scanning ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <FileSearch size={17} />
                )
              }
            >
              {scanning ? "Проверка..." : "Запустить проверку"}
            </Button>

            <Button
              variant="secondary"
              onClick={reset}
              disabled={scanning}
              icon={<RotateCcw size={17} />}
            >
              Сбросить
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Результат"
          title="Итоги быстрой проверки"
          description="Сканер проверяет базовые признаки риска: отсутствие pragma/SPDX, использование tx.origin, selfdestruct, delegatecall, низкоуровневых вызовов и block.timestamp."
        />

        <div className="card-body">
          {!result ? (
            <div className="empty-state">
              <strong>Результатов пока нет</strong>
              <p>Выберите `.sol` файл и запустите проверку.</p>
            </div>
          ) : (
            <div className="quick-scan-result">
              <div className="metric-grid">
                <div className="metric-card">
                  <span>Файл</span>
                  <strong>{result.filename}</strong>
                </div>

                <div className="metric-card">
                  <span>Найдено записей</span>
                  <strong>{result.total}</strong>
                </div>
              </div>

              {!result.issues.length ? (
                <div className="empty-state">
                  <strong>Проблем не найдено</strong>
                  <p>
                    Базовый сканер не обнаружил известных эвристических
                    паттернов риска.
                  </p>
                </div>
              ) : (
                <div className="quick-issue-list">
                  {result.issues.map((issue, index) => (
                    <article
                      key={`${issue.rule}-${index}`}
                      className="quick-issue-card"
                    >
                      <header>
                        <Badge tone={severityTone(issue.severity)}>
                          {getSeverityRuLabel(normalizeSeverity(issue.severity))}
                        </Badge>

                        <code>{issue.rule}</code>
                      </header>

                      <h3>{getIssueTitle(issue)}</h3>
                      <p>{getIssueDescription(issue)}</p>

                      <span>
                        Строка: {issue.line ?? "—"}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function getIssueTitle(issue: ScanIssue): string {
  switch (issue.rule) {
    case "EMPTY_FILE":
      return "Пустой файл";
    case "NO_SPDX":
      return "Отсутствует SPDX-лицензия";
    case "NO_PRAGMA":
      return "Отсутствует pragma solidity";
    case "NO_CONTRACT":
      return "Не найдено объявление контракта";
    case "TX_ORIGIN":
      return "Риск авторизации через tx.origin";
    case "SELFDESTRUCT":
      return "Опасная операция selfdestruct";
    case "DELEGATECALL":
      return "Опасный delegatecall";
    case "LOW_LEVEL_CALL":
      return "Низкоуровневый внешний вызов";
    case "BLOCK_TIMESTAMP":
      return "Зависимость от block.timestamp";
    default:
      return "Найдено предупреждение";
  }
}

function getIssueDescription(issue: ScanIssue): string {
  switch (issue.rule) {
    case "NO_SPDX":
      return "В файле не указан идентификатор лицензии. Рекомендуется добавить строку вида `// SPDX-License-Identifier: MIT` или другой корректный SPDX identifier.";
    case "NO_PRAGMA":
      return "В файле не задана версия компилятора Solidity. Рекомендуется явно указать совместимый диапазон версии.";
    case "NO_CONTRACT":
      return "Сканер не обнаружил объявление контракта. Проверьте, что загружен корректный Solidity-файл.";
    case "TX_ORIGIN":
      return "Использование tx.origin в авторизации может привести к phishing-сценариям через промежуточный контракт.";
    case "SELFDESTRUCT":
      return "selfdestruct может уничтожить контракт или привести к опасному изменению жизненного цикла системы.";
    case "DELEGATECALL":
      return "delegatecall выполняет внешний код в контексте storage текущего контракта и требует строгого контроля target-адреса.";
    case "LOW_LEVEL_CALL":
      return "Низкоуровневый вызов требует проверки результата, порядка обновления состояния и риска реентерабельности.";
    case "BLOCK_TIMESTAMP":
      return "block.timestamp не следует использовать как надежный источник случайности или критическое условие бизнес-логики.";
    default:
      return issue.message;
  }
}

function getErrorMessage(exception: unknown): string {
  if (exception instanceof ApiError) {
    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Неизвестная ошибка";
}