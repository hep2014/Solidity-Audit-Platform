import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge, statusTone } from "../shared/ui/Badge";
import { ApiError } from "../shared/api/http";
import {
  getAnalysis,
  getAnalysisFindings,
  getAnalysisLogs,
  getAnalysisReport
} from "../shared/api/analyses";
import type {
  AnalysisLogRead,
  AnalysisRead,
  AnalysisReport,
  FindingRead
} from "../shared/types/api";
import { AnalysisResultsView } from "../features/analysisResults/AnalysisResultsView";
import { AnalysisLogsPanel } from "../features/analysisResults/AnalysisLogsPanel";
import { formatDateTime } from "../shared/utils/format";
import { getStatusLabel, getStepLabel, isTerminalStatus } from "../shared/utils/status";

export function AnalysisResultsPage() {
  const { analysisId } = useParams<{ analysisId: string }>();

  const [analysis, setAnalysis] = useState<AnalysisRead | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [findings, setFindings] = useState<FindingRead[]>([]);
  const [logs, setLogs] = useState<AnalysisLogRead[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!analysisId) {
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const analysisResponse = await getAnalysis(analysisId);

        const [findingsResponse, logsResponse] = await Promise.all([
          getAnalysisFindings(analysisId),
          getAnalysisLogs(analysisId)
        ]);

        setAnalysis(analysisResponse);
        setFindings(findingsResponse);
        setLogs(logsResponse);

        if (isTerminalStatus(analysisResponse.status)) {
          const reportResponse = await getAnalysisReport(analysisId);
          setReport(reportResponse);
        } else {
          setReport(null);
        }
      } catch (exception) {
        setError(getErrorMessage(exception));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [analysisId]
  );

  function downloadReportJson() {
    if (!report) {
      return;
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `analysis-report-${report.analysis.id}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Card>
        <div className="card-body">
          <div className="loading-state">
            <Loader2 className="spin" size={22} />
            <span>Загрузка результатов анализа...</span>
          </div>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <div className="card-body">
          <div className="empty-state">
            <strong>Анализ не найден</strong>
            <p>{error || "Сервер не вернул данные анализа."}</p>

            <Link to="/projects">
              <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                К проектам
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="page-grid analysis-results-page">
      <Card>
        <CardHeader
          eyebrow="Результаты"
          title="Результаты анализа"
          description="Полная панель результатов: сводка, фильтры, findings, статусы анализаторов, CFG/DFG-данные, корреляция реентерабельности и технические логи."
          action={
            <div className="actions-row">
              <Link to={`/analyses/${analysis.id}`}>
                <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                  К мониторингу
                </Button>
              </Link>

              <Button
                variant="secondary"
                onClick={() => loadData(true)}
                disabled={refreshing}
                icon={
                  refreshing ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <RefreshCw size={16} />
                  )
                }
              >
                Обновить
              </Button>

              {report && (
                <Button
                  variant="secondary"
                  onClick={downloadReportJson}
                  icon={<Download size={16} />}
                >
                  Скачать JSON
                </Button>
              )}
            </div>
          }
        />

        <div className="card-body">
          {error && (
            <div className="error-box">
              <strong>Ошибка</strong>
              <pre>{error}</pre>
            </div>
          )}

          <div className="result-page-meta">
            <Badge tone={statusTone(analysis.status)}>
              {getStatusLabel(analysis.status)}
            </Badge>

            <Badge>{analysis.progress}%</Badge>

            <Badge>{getStepLabel(analysis.current_step)}</Badge>

            <Badge>создан: {formatDateTime(analysis.created_at)}</Badge>
          </div>
        </div>
      </Card>

      <AnalysisResultsView findings={findings} logs={logs} />

      <Card>
        <CardHeader
          eyebrow="Логи"
          title="Технический вывод"
          description="Полный stdout, stderr и сообщения об ошибках по каждому анализатору."
        />

        <div className="card-body">
          <AnalysisLogsPanel logs={logs} />
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

  return "Неизвестная ошибка";
}