import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { AnalysisResultsView } from "../features/analysisResults/AnalysisResultsView";
import { AnalysisLogsPanel } from "../features/analysisResults/AnalysisLogsPanel";
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
  AnalysisLogRead,
  AnalysisRead,
  AnalysisReport,
  FindingRead
} from "../shared/types/api";
import { formatDateTime } from "../shared/utils/format";
import {
  getStatusLabel,
  getStepLabel,
  isActiveStatus,
  isTerminalStatus
} from "../shared/utils/status";

export function AnalysisPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

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

  const progressTone = getProgressTone(analysis?.status);
  const analysisTitle = getAnalysisTitle(analysis);

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

  async function handleCancel() {
    if (!analysisId) {
      return;
    }

    setActionLoading("cancel");
    setError(null);

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
    setError(null);

    try {
      const response = await retryAnalysis(analysisId, undefined, true);
      navigate(`/analyses/${response.id}`);
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

    const confirmed = window.confirm(
      "Удалить анализ? Все результаты, findings и технические логи этого запуска также будут удалены."
    );

    if (!confirmed) {
      return;
    }

    setActionLoading("delete");
    setError(null);

    try {
      await deleteAnalysis(analysisId);

      if (analysis?.project_id) {
        navigate(`/projects/${analysis.project_id}`);
      } else {
        navigate("/projects");
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
            <span>Загрузка данных анализа...</span>
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
          eyebrow="Анализ"
          title={analysisTitle}
          description="Страница мониторинга запуска: статус, прогресс, этап выполнения, результаты классификации и технические логи анализаторов."
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

              {isActiveStatus(analysis.status) && (
                <Button
                  variant="danger"
                  onClick={handleCancel}
                  disabled={actionLoading !== null}
                  icon={
                    actionLoading === "cancel" ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <Square size={16} />
                    )
                  }
                >
                  Остановить
                </Button>
              )}

              {isTerminalStatus(analysis.status) && (
                <Button
                  variant="secondary"
                  onClick={handleRetry}
                  disabled={actionLoading !== null}
                  icon={
                    actionLoading === "retry" ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <RotateCcw size={16} />
                    )
                  }
                >
                  Повторить
                </Button>
              )}

              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={actionLoading !== null}
                icon={
                  actionLoading === "delete" ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Trash2 size={16} />
                  )
                }
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
              tone={progressTone}
              label="готово"
              size={128}
            />

            <div className="analysis-dashboard-main">
              <div className="project-badges">
                <Badge tone={statusTone(analysis.status)}>
                  {getStatusLabel(analysis.status)}
                </Badge>

                <Badge tone={wsConnected ? "success" : "neutral"}>
                  {wsConnected ? "Live-обновление активно" : "Live-обновление закрыто"}
                </Badge>

                <Badge>{analysis.progress}%</Badge>
              </div>

              <dl className="details-grid details-grid-safe">
                <div>
                  <dt>ID анализа</dt>
                  <dd>{analysis.id}</dd>
                </div>

                <div>
                  <dt>ID проекта</dt>
                  <dd>{analysis.project_id}</dd>
                </div>

                <div>
                  <dt>Задача Celery</dt>
                  <dd>{analysis.celery_task_id || "—"}</dd>
                </div>

                <div>
                  <dt>Текущий этап</dt>
                  <dd>{getStepLabel(analysis.current_step)}</dd>
                </div>

                <div>
                  <dt>Создан</dt>
                  <dd>{formatDateTime(analysis.created_at)}</dd>
                </div>

                <div>
                  <dt>Обновлен</dt>
                  <dd>{formatDateTime(analysis.updated_at)}</dd>
                </div>

                <div>
                  <dt>Запущен</dt>
                  <dd>{formatDateTime(analysis.started_at)}</dd>
                </div>

                <div>
                  <dt>Завершен</dt>
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
            eyebrow="Этапы"
            title="Ход выполнения"
            description="Для полного анализа шаги отмечаются по техническим логам. Для одиночного анализа активным будет соответствующий инструмент."
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
            eyebrow="Сводка"
            title="Итоговая оценка"
            description="Сводка строится на frontend-классификации: уязвимости, ошибки анализаторов, ручные проверки и CFG/DFG-данные считаются отдельно."
            action={
              report && (
                <Button
                  variant="secondary"
                  onClick={downloadReportJson}
                  icon={<Download size={16} />}
                >
                  Скачать JSON
                </Button>
              )
            }
          />

          <div className="card-body">
            <AnalysisResultsView findings={findings} logs={logs} />
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          eyebrow="Логи"
          title="Технический вывод анализаторов"
          description="Здесь отдельно отображаются stdout, stderr и сообщения об ошибках. Эти данные нужны для диагностики и не смешиваются со списком уязвимостей."
        />

        <div className="card-body">
          <AnalysisLogsPanel logs={logs} />
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

function getProgressTone(status: string | null | undefined) {
  if (status === "SUCCESS") {
    return "success";
  }

  if (status === "PARTIAL_SUCCESS") {
    return "warning";
  }

  if (status === "FAILED" || status === "TIMEOUT" || status === "CANCELLED") {
    return "danger";
  }

  if (status === "RUNNING" || status === "PENDING") {
    return "info";
  }

  return "neutral";
}

function getAnalysisTitle(analysis: AnalysisRead | null): string {
  if (!analysis) {
    return "Анализ";
  }

  if (analysis.status === "SUCCESS") {
    return "Анализ успешно завершен";
  }

  if (analysis.status === "PARTIAL_SUCCESS") {
    return "Анализ завершен частично";
  }

  if (analysis.status === "FAILED") {
    return "Анализ завершился с ошибкой";
  }

  if (analysis.status === "TIMEOUT") {
    return "Анализ остановлен по таймауту";
  }

  if (analysis.status === "CANCELLED") {
    return "Анализ отменен";
  }

  return getStepLabel(analysis.current_step);
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