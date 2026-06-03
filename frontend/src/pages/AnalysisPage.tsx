import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge, statusTone } from "../shared/ui/Badge";
import { FindingTable } from "../shared/ui/FindingTable";
import { TerminalLog } from "../shared/ui/TerminalLog";
import {
  FULL_PIPELINE_STEPS,
  PipelineSteps
} from "../shared/ui/PipelineSteps";
import { ProgressRing } from "../shared/ui/ProgressRing";
import { ApiError } from "../shared/api/http";
import {
  cancelAnalysis,
  deleteAnalysis,
  getAnalysis,
  getAnalysisFindings,
  getAnalysisLogs,
  getAnalysisReport,
  retryAnalysis
} from "../shared/api/analyses";
import { connectAnalysisWs } from "../shared/api/ws";
import type {
  AnalysisRead,
  AnalysisReport,
  FindingRead,
  AnalysisLogRead
} from "../shared/types/api";
import { formatDateTime } from "../shared/utils/format";
import {
  getStatusLabel,
  getStepLabel,
  isActiveStatus,
  isTerminalStatus
} from "../shared/utils/status";
import { sortSeverityEntries } from "../shared/utils/severity";

export function AnalysisPage() {
  const { analysisId } = useParams<{ analysisId: string }>();

  const [analysis, setAnalysis] = useState<AnalysisRead | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [findings, setFindings] = useState<FindingRead[]>([]);
  const [logs, setLogs] = useState<AnalysisLogRead[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedTools = useMemo(
    () =>
      logs
        .filter((log) => log.status === "SUCCESS")
        .map((log) => normalizeToolToStep(log.tool)),
    [logs]
  );

  const failedTools = useMemo(
    () =>
      logs
        .filter((log) => log.status === "FAILED")
        .map((log) => normalizeToolToStep(log.tool)),
    [logs]
  );

  const severityEntries = useMemo(() => {
    const source = report?.summary.by_severity || {};
    return sortSeverityEntries(Object.entries(source));
  }, [report]);

  const toolEntries = useMemo(() => {
    const source = report?.summary.by_tool || {};
    return Object.entries(source).sort((a, b) => b[1] - a[1]);
  }, [report]);

  const loadAnalysisData = useCallback(
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

  async function handleCancel() {
    if (!analysisId) {
      return;
    }

    setActionLoading("cancel");

    try {
      const response = await cancelAnalysis(analysisId);
      setAnalysis(response);
      await loadAnalysisData(true);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetry() {
    if (!analysisId) {
      return;
    }

    setActionLoading("retry");

    try {
      const response = await retryAnalysis(analysisId, undefined, true);
      setAnalysis(response);
      window.history.pushState(null, "", `/analyses/${response.id}`);
      window.location.reload();
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!analysisId) {
      return;
    }

    const confirmed = window.confirm("Удалить анализ? Findings и logs также будут удалены.");

    if (!confirmed) {
      return;
    }

    setActionLoading("delete");

    try {
      await deleteAnalysis(analysisId);

      if (analysis?.project_id) {
        window.location.href = `/projects/${analysis.project_id}`;
      } else {
        window.location.href = "/projects";
      }
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setActionLoading(null);
    }
  }

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
    loadAnalysisData();
  }, [loadAnalysisData]);

  useEffect(() => {
    if (!analysisId) {
      return;
    }

    const socket = connectAnalysisWs(analysisId, {
      onOpen: () => setWsConnected(true),
      onClose: () => setWsConnected(false),
      onError: () => setWsConnected(false),
      onMessage: (message) => {
        if (message.error) {
          setError(message.error);
          return;
        }

        setAnalysis((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            status: message.status || current.status,
            progress: message.progress ?? current.progress,
            current_step: message.current_step ?? current.current_step
          };
        });

        if (message.status && isTerminalStatus(message.status)) {
          loadAnalysisData(true);
        }
      }
    });

    return () => {
      socket.close();
    };
  }, [analysisId, loadAnalysisData]);

  useEffect(() => {
    if (!analysis || !isActiveStatus(analysis.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadAnalysisData(true);
    }, 3500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [analysis, loadAnalysisData]);

  if (loading) {
    return (
      <Card>
        <div className="card-body">
          <div className="loading-state">
            <Loader2 className="spin" size={22} />
            <span>Загрузка анализа...</span>
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
            <p>{error || "Backend не вернул данные анализа."}</p>
            <Link to="/projects">
              <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                Назад к проектам
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="page-grid">
      <Card>
        <CardHeader
          eyebrow="Analysis"
          title={getStepLabel(analysis.current_step)}
          description="Страница live-мониторинга анализа: WebSocket-статус, прогресс, логи инструментов, findings и итоговый report."
          action={
            <div className="actions-row">
              <Link to={`/projects/${analysis.project_id}`}>
                <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                  К проекту
                </Button>
              </Link>

              <Button
                variant="secondary"
                onClick={() => loadAnalysisData(true)}
                disabled={refreshing}
                icon={refreshing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
              >
                Обновить
              </Button>

              {isActiveStatus(analysis.status) && (
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  disabled={actionLoading !== null}
                  icon={actionLoading === "cancel" ? <Loader2 className="spin" size={16} /> : <Square size={16} />}
                >
                  Отменить
                </Button>
              )}

              {isTerminalStatus(analysis.status) && (
                <Button
                  variant="secondary"
                  onClick={handleRetry}
                  disabled={actionLoading !== null}
                  icon={actionLoading === "retry" ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />}
                >
                  Retry
                </Button>
              )}

              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={actionLoading !== null}
                icon={actionLoading === "delete" ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
              >
                Удалить
              </Button>
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

          <div className="analysis-dashboard">
            <ProgressRing
              value={analysis.progress}
              active={isActiveStatus(analysis.status)}
              label="progress"
              size={128}
            />

            <div className="analysis-dashboard-main">
              <div className="project-badges">
                <Badge tone={statusTone(analysis.status)}>
                  {getStatusLabel(analysis.status)}
                </Badge>

                <Badge tone={wsConnected ? "success" : "neutral"}>
                  WebSocket {wsConnected ? "connected" : "closed"}
                </Badge>

                <Badge>{analysis.progress}%</Badge>
              </div>

              <dl className="details-grid">
                <div>
                  <dt>Analysis ID</dt>
                  <dd>{analysis.id}</dd>
                </div>
                <div>
                  <dt>Project ID</dt>
                  <dd>{analysis.project_id}</dd>
                </div>
                <div>
                  <dt>Celery task</dt>
                  <dd>{analysis.celery_task_id || "—"}</dd>
                </div>
                <div>
                  <dt>Current step</dt>
                  <dd>{analysis.current_step || "—"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(analysis.created_at)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(analysis.updated_at)}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{formatDateTime(analysis.started_at)}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{formatDateTime(analysis.finished_at)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </Card>

      <section className="page-grid page-grid-two">
        <Card>
          <CardHeader
            eyebrow="Pipeline"
            title="Ход выполнения"
            description="Для full pipeline шаги постепенно отмечаются по логам. Для одиночного анализа будет активен соответствующий инструмент."
          />

          <div className="card-body">
            <PipelineSteps
              steps={FULL_PIPELINE_STEPS}
              currentStep={normalizeStep(analysis.current_step)}
              completedTools={completedTools}
              failedTools={failedTools}
              active={isActiveStatus(analysis.status)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Summary"
            title="Сводка findings"
            description="Сводка появляется после построения report. Во время выполнения можно смотреть текущие findings ниже."
            action={
              report && (
                <Button
                  variant="secondary"
                  onClick={downloadReportJson}
                  icon={<Download size={16} />}
                >
                  JSON
                </Button>
              )
            }
          />

          <div className="card-body">
            {!report ? (
              <div className="empty-state">
                <strong>Report еще не построен</strong>
                <p>Итоговый отчет доступен после terminal status: SUCCESS, FAILED, TIMEOUT, PARTIAL_SUCCESS или CANCELLED.</p>
              </div>
            ) : (
              <div className="summary-grid">
                <div className="metric-card">
                  <span>Total findings</span>
                  <strong>{report.summary.total}</strong>
                </div>

                {severityEntries.map(([severity, count]) => (
                  <div key={severity} className="metric-card">
                    <span>{severity}</span>
                    <strong>{count}</strong>
                  </div>
                ))}

                {toolEntries.map(([tool, count]) => (
                  <div key={tool} className="metric-card">
                    <span>{tool}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          eyebrow="Logs"
          title="Логи выполнения"
          description="Здесь отображается stdout, stderr и error_message каждого инструмента. Это удобно для поиска места, где ломается Slither, Mythril, Foundry или Echidna."
        />

        <div className="card-body">
          <TerminalLog logs={logs} />
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Findings"
          title="Результаты анализа"
          description="Нормализованные findings из всех инструментов: severity, rule, tool, location, message, recommendation и references."
        />

        <div className="card-body">
          <FindingTable findings={findings} />
        </div>
      </Card>
    </div>
  );
}

function normalizeStep(step: string | null | undefined): string | null {
  if (!step) {
    return null;
  }

  return step.replace("-queued", "").replace("-failed", "");
}

function normalizeToolToStep(tool: string): string {
  if (tool === "basic-scanner") {
    return "basic-scanner";
  }

  if (tool === "custom-cfg-dfg") {
    return "reentrancy-correlation";
  }

  if (tool === "manual-audit") {
    return "manual-audit-checklist";
  }

  return tool;
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