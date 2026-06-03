import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileArchive,
  FileCode2,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { FileDropzone } from "../shared/ui/FileDropzone";
import { ApiError } from "../shared/api/http";
import {
  deleteProject,
  listProjects,
  uploadProject
} from "../shared/api/projects";
import type { ProjectRead } from "../shared/types/api";
import { formatDateTime, stringifyJson } from "../shared/utils/format";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRead[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    setLoadingProjects(true);
    setError(null);

    try {
      const response = await listProjects();
      setProjects(response);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const project = await uploadProject(selectedFile);
      setSelectedFile(null);
      setProjects((current) => [project, ...current]);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(projectId: string) {
    const confirmed = window.confirm(
      "Удалить проект? Вместе с ним будут удалены связанные анализы и сохраненные файлы."
    );

    if (!confirmed) {
      return;
    }

    setDeletingProjectId(projectId);
    setError(null);

    try {
      await deleteProject(projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setDeletingProjectId(null);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="page-grid page-grid-two">
      <Card>
        <CardHeader
          eyebrow="Загрузка"
          title="Добавить проект"
          description="Поддерживаются одиночные `.sol` файлы и `.zip` архивы. Для архива автоматически определяется тип проекта, точка входа, список Solidity-файлов и версии компилятора."
        />

        <div className="card-body page-grid">
          <FileDropzone
            value={selectedFile}
            disabled={uploading}
            title="Выберите Solidity-файл или архив"
            description="Загрузите `.sol` файл либо `.zip` архив с проектом."
            onChange={setSelectedFile}
          />

          {error && (
            <div className="error-box">
              <strong>Ошибка</strong>
              <pre>{error}</pre>
            </div>
          )}

          <div className="actions-row">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              icon={
                uploading ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <UploadCloud size={17} />
                )
              }
            >
              {uploading ? "Загрузка..." : "Загрузить"}
            </Button>

            <Button
              variant="secondary"
              onClick={loadProjects}
              disabled={loadingProjects}
              icon={
                loadingProjects ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <RefreshCw size={17} />
                )
              }
            >
              Обновить список
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Форматы"
          title="Поддерживаемые варианты"
          description="Проект проходит проверку имени, размера, структуры архива и количества Solidity-файлов перед сохранением."
        />

        <div className="card-body">
          <div className="info-stack">
            <div className="info-line">
              <FileCode2 size={18} />
              <div>
                <strong>Одиночный Solidity-файл</strong>
                <span>
                  Один `.sol` файл сохраняется как отдельный проект и сразу
                  может быть передан анализаторам.
                </span>
              </div>
            </div>

            <div className="info-line">
              <FileArchive size={18} />
              <div>
                <strong>Архив проекта</strong>
                <span>
                  Поддерживаются Foundry, Hardhat, multi-file и single-file
                  структуры внутри `.zip`.
                </span>
              </div>
            </div>

            <div className="info-line">
              <UploadCloud size={18} />
              <div>
                <strong>Автоматический выбор точки входа</strong>
                <span>
                  Приоритет: `foundry.toml`, затем Solidity-файлы из `src`,
                  затем первый найденный `.sol` файл.
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="wide-card">
        <CardHeader
          eyebrow="Проекты"
          title="Загруженные проекты"
          description="Откройте проект, чтобы запустить отдельный анализатор, полный пайплайн или просмотреть историю проверок."
        />

        <div className="card-body">
          {loadingProjects ? (
            <div className="loading-state">
              <Loader2 className="spin" size={22} />
              <span>Загрузка списка проектов...</span>
            </div>
          ) : !projects.length ? (
            <div className="empty-state">
              <strong>Список проектов пуст</strong>
              <p>Загрузите `.sol` файл или `.zip` архив через форму выше.</p>
            </div>
          ) : (
            <div className="project-card-grid">
              {projects.map((project) => (
                <article key={project.id} className="project-card">
                  <header>
                    <div className="project-icon">
                      {project.project_type === "single_file" ? (
                        <FileCode2 size={22} />
                      ) : (
                        <FileArchive size={22} />
                      )}
                    </div>

                    <Badge>{getProjectTypeLabel(project.project_type)}</Badge>
                  </header>

                  <h3>{project.name}</h3>

                  <div className="project-meta">
                    <span>
                      Solidity-файлов: {project.solidity_files_count}
                    </span>

                    <span>
                      Загружен: {formatDateTime(project.created_at)}
                    </span>

                    <span>
                      Версия solc:{" "}
                      {project.detected_solc_versions?.length
                        ? project.detected_solc_versions.join(", ")
                        : "не определена"}
                    </span>
                  </div>

                  <details className="metadata-details">
                    <summary>Метаданные</summary>
                    <pre>{stringifyJson(project.project_metadata)}</pre>
                  </details>

                  <footer>
                    <Link to={`/projects/${project.id}`}>
                      <Button variant="secondary" icon={<ArrowRight size={16} />}>
                        Открыть
                      </Button>
                    </Link>

                    <Button
                      variant="danger"
                      disabled={deletingProjectId === project.id}
                      onClick={() => handleDelete(project.id)}
                      icon={
                        deletingProjectId === project.id ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Trash2 size={16} />
                        )
                      }
                    >
                      Удалить
                    </Button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      </Card>
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

function getErrorMessage(exception: unknown): string {
  if (exception instanceof ApiError) {
    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Неизвестная ошибка";
}