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
      "Удалить проект? Вместе с ним будут удалены связанные анализы."
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
          eyebrow="Project intake"
          title="Загрузка проекта"
          description="Backend принимает одиночный `.sol` файл или `.zip` архив. Для архива определяется тип проекта, entrypoint, список Solidity-файлов и версии компилятора."
        />

        <div className="card-body page-grid">
          <FileDropzone
            value={selectedFile}
            disabled={uploading}
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
              icon={uploading ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}
            >
              {uploading ? "Загрузка..." : "Загрузить проект"}
            </Button>

            <Button
              variant="secondary"
              onClick={loadProjects}
              disabled={loadingProjects}
              icon={loadingProjects ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            >
              Обновить список
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Правила приема"
          title="Что поддерживается"
          description="На сервере уже есть защита от небезопасных имен, пустых файлов, больших архивов, zip traversal и symlink внутри архива."
        />

        <div className="card-body">
          <div className="info-stack">
            <div className="info-line">
              <FileCode2 size={18} />
              <div>
                <strong>Single Solidity file</strong>
                <span>Один `.sol` файл анализируется как `single_file` проект.</span>
              </div>
            </div>

            <div className="info-line">
              <FileArchive size={18} />
              <div>
                <strong>ZIP project</strong>
                <span>Поддерживаются Foundry, Hardhat, multi-file и single-file проекты.</span>
              </div>
            </div>

            <div className="info-line">
              <UploadCloud size={18} />
              <div>
                <strong>Entrypoint auto-detection</strong>
                <span>Приоритет: `foundry.toml`, затем файлы из `src`, затем первый `.sol`.</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="wide-card">
        <CardHeader
          eyebrow="Projects"
          title="Загруженные проекты"
          description="Из этого списка можно перейти к карточке проекта и запустить конкретный анализатор или полный pipeline."
        />

        <div className="card-body">
          {loadingProjects ? (
            <div className="loading-state">
              <Loader2 className="spin" size={22} />
              <span>Загрузка проектов...</span>
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

                    <Badge>{project.project_type}</Badge>
                  </header>

                  <h3>{project.name}</h3>

                  <div className="project-meta">
                    <span>Solidity files: {project.solidity_files_count}</span>
                    <span>Created: {formatDateTime(project.created_at)}</span>
                    <span>
                      solc:{" "}
                      {project.detected_solc_versions?.length
                        ? project.detected_solc_versions.join(", ")
                        : "not detected"}
                    </span>
                  </div>

                  <details className="metadata-details">
                    <summary>Metadata</summary>
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

function getErrorMessage(exception: unknown): string {
  if (exception instanceof ApiError) {
    return exception.message;
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Unknown error";
}