import { useState } from "react";
import { FileSearch, Loader2, RotateCcw } from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge, severityTone } from "../shared/ui/Badge";
import { FileDropzone } from "../shared/ui/FileDropzone";
import { quickScanSolidity } from "../shared/api/scan";
import { ApiError } from "../shared/api/http";
import type { ScanResponse } from "../shared/types/api";
import { getSeverityLabel } from "../shared/utils/severity";

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
          eyebrow="Quick Scan"
          title="Быстрая проверка Solidity-файла"
          description="Этот режим использует `/api/scan/solidity` и не создает проект в базе. Подходит для мгновенной проверки одного `.sol` файла."
        />

        <div className="card-body page-grid">
          <FileDropzone
            value={file}
            accept=".sol"
            title="Загрузите .sol файл"
            description="Quick Scan принимает только одиночный Solidity-файл."
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
              icon={scanning ? <Loader2 className="spin" size={17} /> : <FileSearch size={17} />}
            >
              {scanning ? "Проверка..." : "Запустить Quick Scan"}
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
          eyebrow="Result"
          title="Результат проверки"
          description="Basic scanner ищет отсутствие SPDX, pragma, contract declaration, а также tx.origin, selfdestruct, delegatecall, low-level call и block.timestamp."
        />

        <div className="card-body">
          {!result ? (
            <div className="empty-state">
              <strong>Результатов пока нет</strong>
              <p>Выберите `.sol` файл и запустите быструю проверку.</p>
            </div>
          ) : (
            <div className="quick-scan-result">
              <div className="metric-grid">
                <div className="metric-card">
                  <span>Filename</span>
                  <strong>{result.filename}</strong>
                </div>

                <div className="metric-card">
                  <span>Total issues</span>
                  <strong>{result.total}</strong>
                </div>
              </div>

              {!result.issues.length ? (
                <div className="empty-state">
                  <strong>Проблем не найдено</strong>
                  <p>Scanner не обнаружил известных простых паттернов.</p>
                </div>
              ) : (
                <div className="quick-issue-list">
                  {result.issues.map((issue, index) => (
                    <article key={`${issue.rule}-${index}`} className="quick-issue-card">
                      <header>
                        <Badge tone={severityTone(issue.severity)}>
                          {getSeverityLabel(issue.severity)}
                        </Badge>

                        <code>{issue.rule}</code>
                      </header>

                      <p>{issue.message}</p>

                      <span>Line: {issue.line ?? "—"}</span>
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

function getErrorMessage(exception: unknown): string {
  if (exception instanceof ApiError) {
    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Unknown error";
}