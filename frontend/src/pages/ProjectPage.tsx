import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  FileCode2,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Zap
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge, statusTone } from "../shared/ui/Badge";
import { ProgressRing } from "../shared/ui/ProgressRing";
import { ApiError } from "../shared/api/http";
import {
  ANALYSIS_MODES,
  deleteAnalysis,
  getProjectAnalyses,
  runAnalysis
} from "../shared/api/analyses";
import { deleteProject, getProject } from "../shared/api/projects";
import type {
  AnalysisMode,
  AnalysisRead,
  ProjectRead
} from "../shared/types/api";
import { formatDateTime, stringifyJson } from "../shared/utils/format";
import { getStatusLabel, getStepLabel, isActiveStatus } from "../shared/utils/status";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectRead | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningMode, setRunningMode] = useState<AnalysisMode | null>(null);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestAnalysis = analyses[0] || null;

  const activeAnalysis = useMemo(
    () => analyses.find((analysis) => isActiveStatus(analysis.status)) || null,
    [analyses]
  );

  async function loadProjectData() {
    if (!projectId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectResponse, analysesResponse] = await Promise.all([
        getProject(projectId),
        getProjectAnalyses(projectId)
      ]);

      setProject(projectResponse);
      setAnalyses(analysesResponse);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  }

  async function handleRun(mode: AnalysisMode) {
    if (!projectId) {
      return;
    }

    setRunningMode(mode);
    setError(null);

    try {
      const analysis = await runAnalysis(projectId, mode, force);
      setAnalyses((current) => [analysis, ...current]);
      navigate(`/analyses/${analysis.id}`);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setRunningMode(null);
    }
  }

  async function handleDeleteProject() {
    if (!projectId) {
      return;
    }

    const confirmed = window.confirm(
      "Удалить проект? Все связанные анализы и файлы проекта также будут удалены."
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteProject(projectId);
      navigate("/projects");
    } catch (exception) {
      setError(getErrorMessage(exception));
    }
  }

  async function handleDeleteAnalysis(analysisId: string) {
    const confirmed = window.confirm("Удалить этот анализ?");

    if (!confirmed) {
      return;
    }

    setDeletingAnalysisId(analysisId);

    try {
      await deleteAnalysis(analysisId);
      setAnalyses((current) => current.filter((analysis) => analysis.id !== analysisId));
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setDeletingAnalysisId(null);
    }
  }

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  if (loading) {
    return (
      <Card>
        <div className="card-body">
          <div className="loading-state">
            <Loader2 className="spin" size={22} />
            <span>Загрузка проекта...</span>
          </div>
        </div>
      </Card>
    );
  }

  if (!project) {
    return (
      <Card>
        <div className="card-body">
          <div className="empty-state">
            <strong>Проект не найден</strong>
            <p>{error || "Backend не вернул данные проекта."}</p>
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
          eyebrow="Project"
          title={project.name}
          description="Карточка проекта: metadata, история запусков, отдельные анализаторы и полный pipeline."
          action={
            <div className="actions-row">
              <Link to="/projects">
                <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                  Проекты
                </Button>
              </Link>

              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={handleDeleteProject}
              >
                Удалить проект
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

          <div className="project-overview">
            <div className="project-overview-main">
              <div className="project-icon project-icon-large">
                <FileCode2 size={28} />
              </div>

              <div>
                <div className="project-badges">
                  <Badge>{project.project_type}</Badge>
                  <Badge>{project.solidity_files_count} solidity file(s)</Badge>
                  {project.detected_solc_versions?.map((version) => (
                    <Badge key={version}>solc {version}</Badge>
                  ))}
                </div>

                <dl className="details-grid">
                  <div>
                    <dt>ID</dt>
                    <dd>{project.id}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(project.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Entrypoint</dt>
                    <dd>{project.entrypoint_path || project.file_path}</dd>
                  </div>
                  <div>
                    <dt>Root</dt>
                    <dd>{project.root_path || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <details className="metadata-details">
              <summary>Project metadata</summary>
              <pre>{stringifyJson(project.project_metadata)}</pre>
            </details>
          </div>
        </div>
      </Card>

      <section className="page-grid page-grid-two">
        <Card>
          <CardHeader
            eyebrow="Run"
            title="Запуск анализа"
            description="Можно запускать отдельные инструменты или полный pipeline. При конфликте активного анализа backend вернет 409; для параллельного запуска включите force."
          />

          <div className="card-body">
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
              />
              <span>force=true: разрешить запуск при наличии активного анализа</span>
            </label>

            <div className="analysis-mode-grid">
              {ANALYSIS_MODES.map((item) => (
                <button
                  key={item.mode}
                  className="analysis-mode-card"
                  disabled={runningMode !== null}
                  onClick={() => handleRun(item.mode)}
                >
                  <div className="analysis-mode-top">
                    <div className="analysis-mode-icon">
                      {item.mode === "full" ? <Zap size={20} /> : <Bug size={20} />}
                    </div>

                    {runningMode === item.mode ? (
                      <Loader2 className="spin" size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </div>

                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Latest analysis"
            title="Последний запуск"
            description="Краткая сводка по самому свежему анализу проекта."
            action={
              <Button
                variant="secondary"
                onClick={loadProjectData}
                icon={<RefreshCw size={16} />}
              >
                Обновить
              </Button>
            }
          />

          <div className="card-body">
            {!latestAnalysis ? (
              <div className="empty-state">
                <strong>Анализы еще не запускались</strong>
                <p>Выберите один из режимов слева или запустите полный pipeline.</p>
              </div>
            ) : (
              <div className="latest-analysis">
                <ProgressRing
                  value={latestAnalysis.progress}
                  active={isActiveStatus(latestAnalysis.status)}
                  label="progress"
                />

                <div>
                  <Badge tone={statusTone(latestAnalysis.status)}>
                    {getStatusLabel(latestAnalysis.status)}
                  </Badge>

                  <h3>{getStepLabel(latestAnalysis.current_step)}</h3>

                  <dl className="details-grid compact">
                    <div>
                      <dt>Analysis ID</dt>
                      <dd>{latestAnalysis.id}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDateTime(latestAnalysis.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Started</dt>
                      <dd>{formatDateTime(latestAnalysis.started_at)}</dd>
                    </div>
                    <div>
                      <dt>Finished</dt>
                      <dd>{formatDateTime(latestAnalysis.finished_at)}</dd>
                    </div>
                  </dl>

                  <Link to={`/analyses/${latestAnalysis.id}`}>
                    <Button variant="secondary" icon={<ArrowRight size={16} />}>
                      Открыть анализ
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          eyebrow="History"
          title="История анализов"
          description="Список всех запусков для данного проекта: статус, текущий шаг, прогресс и переход к подробному отчету."
        />

        <div className="card-body">
          {!analyses.length ? (
            <div className="empty-state">
              <strong>История пуста</strong>
              <p>После запуска анализатора здесь появится запись.</p>
            </div>
          ) : (
            <div className="analysis-list">
              {analyses.map((analysis) => (
                <article key={analysis.id} className="analysis-row">
                  <div>
                    <div className="analysis-row-title">
                      <Badge tone={statusTone(analysis.status)}>
                        {getStatusLabel(analysis.status)}
                      </Badge>
                      <strong>{getStepLabel(analysis.current_step)}</strong>
                    </div>

                    <span>
                      {analysis.progress}% · created {formatDateTime(analysis.created_at)}
                    </span>
                  </div>

                  <div className="analysis-row-actions">
                    <Link to={`/analyses/${analysis.id}`}>
                      <Button variant="secondary" icon={<ArrowRight size={16} />}>
                        Открыть
                      </Button>
                    </Link>

                    <Button
                      variant="danger"
                      disabled={deletingAnalysisId === analysis.id}
                      onClick={() => handleDeleteAnalysis(analysis.id)}
                      icon={
                        deletingAnalysisId === analysis.id ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Trash2 size={16} />
                        )
                      }
                    >
                      Удалить
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>

      {activeAnalysis && (
        <div className="floating-run-banner">
          <ShieldCheck size={18} />
          <span>
            Сейчас выполняется анализ: {getStepLabel(activeAnalysis.current_step)} ·{" "}
            {activeAnalysis.progress}%
          </span>
          <Link to={`/analyses/${activeAnalysis.id}`}>Открыть</Link>
        </div>
      )}
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