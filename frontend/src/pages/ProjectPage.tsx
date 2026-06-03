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

    setError(null);

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
    setError(null);

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
            <p>{error || "Сервер не вернул данные проекта."}</p>

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
          eyebrow="Проект"
          title={project.name}
          description="Карточка загруженного Solidity-проекта: тип проекта, точка входа, найденные версии компилятора и история запусков анализа."
          action={
            <div className="actions-row">
              <Link to="/projects">
                <Button variant="secondary" icon={<ArrowLeft size={16} />}>
                  К списку проектов
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

              <div className="project-overview-content">
                <div className="project-badges">
                  <Badge>{getProjectTypeLabel(project.project_type)}</Badge>
                  <Badge>{project.solidity_files_count} Solidity-файл(ов)</Badge>

                  {project.detected_solc_versions?.map((version) => (
                    <Badge key={version}>solc {version}</Badge>
                  ))}
                </div>

                <dl className="details-grid details-grid-safe">
                  <div>
                    <dt>ID проекта</dt>
                    <dd>{project.id}</dd>
                  </div>

                  <div>
                    <dt>Дата загрузки</dt>
                    <dd>{formatDateTime(project.created_at)}</dd>
                  </div>

                  <div>
                    <dt>Точка входа</dt>
                    <dd>{project.entrypoint_path || project.file_path}</dd>
                  </div>

                  <div>
                    <dt>Корневая директория</dt>
                    <dd>{project.root_path || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <details className="metadata-details">
              <summary>Метаданные проекта</summary>
              <pre>{stringifyJson(project.project_metadata)}</pre>
            </details>
          </div>
        </div>
      </Card>

      <section className="page-grid page-grid-two">
        <Card>
          <CardHeader
            eyebrow="Запуск"
            title="Выбор режима анализа"
            description="Можно запустить отдельный анализатор или полный pipeline. Если для проекта уже идет активный анализ, сервер вернет конфликт; для принудительного запуска включите соответствующую опцию."
          />

          <div className="card-body">
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
              />

              <span>
                Принудительный запуск: разрешить новый анализ даже при наличии активного запуска
              </span>
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

                  <strong>{getAnalysisModeTitle(item.mode)}</strong>
                  <p>{getAnalysisModeDescription(item.mode)}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Последний запуск"
            title="Состояние последнего анализа"
            description="Краткая сводка по самому свежему запуску для этого проекта."
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
                  tone={getProgressTone(latestAnalysis.status)}
                  label="готово"
                />

                <div className="latest-analysis-content">
                  <Badge tone={statusTone(latestAnalysis.status)}>
                    {getStatusLabel(latestAnalysis.status)}
                  </Badge>

                  <h3>{getStepLabel(latestAnalysis.current_step)}</h3>

                  <dl className="details-grid compact details-grid-safe">
                    <div>
                      <dt>ID анализа</dt>
                      <dd>{latestAnalysis.id}</dd>
                    </div>

                    <div>
                      <dt>Создан</dt>
                      <dd>{formatDateTime(latestAnalysis.created_at)}</dd>
                    </div>

                    <div>
                      <dt>Запущен</dt>
                      <dd>{formatDateTime(latestAnalysis.started_at)}</dd>
                    </div>

                    <div>
                      <dt>Завершен</dt>
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
          eyebrow="История"
          title="История анализов"
          description="Все запуски для данного проекта: статус, этап выполнения, прогресс и переход к подробному отчету."
        />

        <div className="card-body">
          {!analyses.length ? (
            <div className="empty-state">
              <strong>История пуста</strong>
              <p>После запуска анализатора здесь появится первая запись.</p>
            </div>
          ) : (
            <div className="analysis-list">
              {analyses.map((analysis) => (
                <article key={analysis.id} className="analysis-row">
                  <div className="analysis-row-main">
                    <div className="analysis-row-title">
                      <Badge tone={statusTone(analysis.status)}>
                        {getStatusLabel(analysis.status)}
                      </Badge>

                      <strong>{getStepLabel(analysis.current_step)}</strong>
                    </div>

                    <span>
                      {analysis.progress}% · создан {formatDateTime(analysis.created_at)}
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

function getProjectTypeLabel(projectType: string): string {
  switch (projectType) {
    case "single_file":
      return "Одиночный файл";
    case "multi_file":
      return "Несколько файлов";
    case "foundry":
      return "Foundry-проект";
    case "hardhat":
      return "Hardhat-проект";
    default:
      return projectType || "Тип не определен";
  }
}

function getAnalysisModeTitle(mode: AnalysisMode): string {
  switch (mode) {
    case "basic":
      return "Базовый сканер";
    case "slither":
      return "Slither";
    case "foundry":
      return "Foundry";
    case "mythril":
      return "Mythril";
    case "echidna":
      return "Echidna";
    case "cfg":
      return "Граф потока управления";
    case "dfg":
      return "Граф потока данных";
    case "reentrancy-correlation":
      return "Корреляция реентерабельности";
    case "manual-checklist":
      return "Чек-лист ручного аудита";
    case "full":
      return "Полный анализ";
    default:
      return "Анализ";
  }
}

function getAnalysisModeDescription(mode: AnalysisMode): string {
  switch (mode) {
    case "basic":
      return "Быстрая эвристическая проверка: pragma, SPDX, tx.origin, selfdestruct, delegatecall и внешние вызовы.";
    case "slither":
      return "Статический анализ Solidity-кода через Slither detectors.";
    case "foundry":
      return "Сборка проекта и запуск тестов Foundry.";
    case "mythril":
      return "Символьное исполнение и поиск сложных потенциальных дефектов.";
    case "echidna":
      return "Property-based fuzzing при наличии конфигурации Echidna.";
    case "cfg":
      return "Извлечение управляющих конструкций функций.";
    case "dfg":
      return "Анализ чтения и записи переменных состояния.";
    case "reentrancy-correlation":
      return "Проверка паттерна внешнего вызова перед обновлением состояния.";
    case "manual-checklist":
      return "Список пунктов, которые нужно проверить вручную.";
    case "full":
      return "Последовательный запуск всех поддерживаемых анализаторов.";
    default:
      return "Запуск выбранного режима анализа.";
  }
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

function getErrorMessage(exception: unknown): string {
  if (exception instanceof ApiError) {
    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Неизвестная ошибка";
}