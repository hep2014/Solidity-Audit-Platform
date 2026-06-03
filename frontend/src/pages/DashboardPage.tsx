import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  FileCode2,
  FolderKanban,
  Gauge,
  ShieldAlert
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { getReadyHealth } from "../shared/api/health";
import { listProjects } from "../shared/api/projects";
import type { HealthReadyResponse, ProjectRead } from "../shared/types/api";
import { formatDateTime } from "../shared/utils/format";

export function DashboardPage() {
  const [health, setHealth] = useState<HealthReadyResponse | null>(null);
  const [projects, setProjects] = useState<ProjectRead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      try {
        const [healthResponse, projectsResponse] = await Promise.all([
          getReadyHealth(),
          listProjects()
        ]);

        if (!ignore) {
          setHealth(healthResponse);
          setProjects(projectsResponse);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  const latestProjects = projects.slice(0, 4);
  const databaseOk = health?.checks.database ?? false;
  const redisOk = health?.checks.redis ?? false;
  const servicesReady = health?.status === "ok";

  return (
    <div className="page-grid">
      <section className="page-grid page-grid-two">
        <Card>
          <CardHeader
            eyebrow="Обзор"
            title="Панель аудита Solidity"
            description="Единая точка управления проверками: загрузка проекта, запуск анализаторов, отслеживание выполнения, просмотр результатов и технических логов."
            action={
              <Link to="/projects">
                <Button icon={<FolderKanban size={17} />}>
                  Открыть проекты
                </Button>
              </Link>
            }
          />

          <div className="card-body">
            <div className="metric-grid">
              <div className="metric-card">
                <span>Проекты</span>
                <strong>{loading ? "…" : projects.length}</strong>
              </div>

              <div className="metric-card">
                <span>База данных</span>
                <strong>{databaseOk ? "Доступна" : "Сбой"}</strong>
              </div>

              <div className="metric-card">
                <span>Очередь задач</span>
                <strong>{redisOk ? "Доступна" : "Сбой"}</strong>
              </div>

              <div className="metric-card">
                <span>Сервисы</span>
                <strong>{getReadinessLabel(health?.status)}</strong>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Состояние"
            title="Готовность сервисов"
            description="Перед запуском тяжелого анализа стоит убедиться, что база данных и очередь задач доступны."
          />

          <div className="card-body">
            <div className="service-list">
              <div className="service-row">
                <div>
                  <Activity size={18} />
                  <strong>База данных</strong>
                </div>

                <Badge tone={databaseOk ? "success" : "danger"}>
                  {databaseOk ? "доступна" : "недоступна"}
                </Badge>
              </div>

              <div className="service-row">
                <div>
                  <Gauge size={18} />
                  <strong>Очередь задач</strong>
                </div>

                <Badge tone={redisOk ? "success" : "danger"}>
                  {redisOk ? "доступна" : "недоступна"}
                </Badge>
              </div>

              <div className="service-row">
                <div>
                  <ShieldAlert size={18} />
                  <strong>Общий статус</strong>
                </div>

                <Badge tone={servicesReady ? "success" : "warning"}>
                  {servicesReady ? "готово" : "ограниченная готовность"}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="page-grid page-grid-three">
        <Link to="/projects" className="feature-card">
          <div className="feature-card-icon">
            <FolderKanban size={22} />
          </div>

          <span>Раздел</span>
          <strong>Проекты</strong>
          <p>
            Загрузка `.sol` и `.zip`, просмотр структуры проекта, запуск
            отдельных анализаторов или полного пайплайна.
          </p>

          <ArrowRight size={18} />
        </Link>

        <Link to="/quick-scan" className="feature-card">
          <div className="feature-card-icon">
            <FileCode2 size={22} />
          </div>

          <span>Проверка файла</span>
          <strong>Быстрый сканер</strong>
          <p>
            Мгновенная эвристическая проверка одного Solidity-файла без
            сохранения проекта в списке.
          </p>

          <ArrowRight size={18} />
        </Link>

        <Link to="/health" className="feature-card">
          <div className="feature-card-icon">
            <Activity size={22} />
          </div>

          <span>Инфраструктура</span>
          <strong>Сервисы</strong>
          <p>
            Проверка доступности API, базы данных и очереди задач перед запуском
            анализа.
          </p>

          <ArrowRight size={18} />
        </Link>
      </section>

      <Card>
        <CardHeader
          eyebrow="Последние загрузки"
          title="Недавние проекты"
          description="Быстрый доступ к последним загруженным контрактам и архивам."
        />

        <div className="card-body">
          {!latestProjects.length ? (
            <div className="empty-state">
              <strong>Проекты пока не загружены</strong>
              <p>
                Перейдите в раздел проектов и загрузите одиночный `.sol` файл
                или `.zip` архив.
              </p>
            </div>
          ) : (
            <div className="project-list">
              {latestProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="project-row"
                >
                  <div>
                    <strong>{project.name}</strong>
                    <span>
                      {getProjectTypeLabel(project.project_type)} ·{" "}
                      {project.solidity_files_count} Solidity-файл(ов) ·{" "}
                      {formatDateTime(project.created_at)}
                    </span>
                  </div>

                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function getReadinessLabel(status: string | null | undefined): string {
  if (status === "ok") {
    return "Готово";
  }

  if (status === "degraded") {
    return "Ограничено";
  }

  return "Неизвестно";
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