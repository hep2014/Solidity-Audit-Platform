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

  return (
    <div className="page-grid">
      <section className="page-grid page-grid-two">
        <Card>
          <CardHeader
            eyebrow="Главная панель"
            title="Центр аудита Solidity"
            description="Здесь собран общий маршрут работы: загрузка проекта, запуск анализаторов, просмотр прогресса, логов и итогового отчета."
            action={
              <Link to="/projects">
                <Button icon={<FolderKanban size={17} />}>Открыть проекты</Button>
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
                <span>Database</span>
                <strong>{databaseOk ? "OK" : "FAIL"}</strong>
              </div>

              <div className="metric-card">
                <span>Redis</span>
                <strong>{redisOk ? "OK" : "FAIL"}</strong>
              </div>

              <div className="metric-card">
                <span>Status</span>
                <strong>{health?.status || "…"}</strong>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Сервисы"
            title="Готовность backend"
            description="Frontend проверяет readiness endpoint: база данных и Redis/Celery broker."
          />

          <div className="card-body">
            <div className="service-list">
              <div className="service-row">
                <div>
                  <Activity size={18} />
                  <strong>Database</strong>
                </div>
                <Badge tone={databaseOk ? "success" : "danger"}>
                  {databaseOk ? "online" : "offline"}
                </Badge>
              </div>

              <div className="service-row">
                <div>
                  <Gauge size={18} />
                  <strong>Redis / Celery broker</strong>
                </div>
                <Badge tone={redisOk ? "success" : "danger"}>
                  {redisOk ? "online" : "offline"}
                </Badge>
              </div>

              <div className="service-row">
                <div>
                  <ShieldAlert size={18} />
                  <strong>Overall</strong>
                </div>
                <Badge tone={health?.status === "ok" ? "success" : "warning"}>
                  {health?.status || "unknown"}
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
          <p>Загрузка `.sol` или `.zip`, просмотр metadata, запуск анализаторов.</p>
          <ArrowRight size={18} />
        </Link>

        <Link to="/quick-scan" className="feature-card">
          <div className="feature-card-icon">
            <FileCode2 size={22} />
          </div>
          <span>Быстрая проверка</span>
          <strong>Quick Scan</strong>
          <p>Мгновенная регулярная проверка одного Solidity-файла без создания проекта.</p>
          <ArrowRight size={18} />
        </Link>

        <Link to="/health" className="feature-card">
          <div className="feature-card-icon">
            <Activity size={22} />
          </div>
          <span>Диагностика</span>
          <strong>Health</strong>
          <p>Проверка backend, database и Redis перед запуском тяжелого анализа.</p>
          <ArrowRight size={18} />
        </Link>
      </section>

      <Card>
        <CardHeader
          eyebrow="Недавние проекты"
          title="Последние загруженные контракты"
          description="Список берется из `/api/projects`, сортировка выполняется на сервере по времени создания."
        />

        <div className="card-body">
          {!latestProjects.length ? (
            <div className="empty-state">
              <strong>Проекты пока не загружены</strong>
              <p>Перейдите в раздел проектов и загрузите `.sol` файл или `.zip` архив.</p>
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
                      {project.project_type} · {project.solidity_files_count} Solidity file(s) ·{" "}
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