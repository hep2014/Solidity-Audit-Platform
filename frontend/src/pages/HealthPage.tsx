import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  Loader2,
  RadioTower,
  RefreshCw,
  Server
} from "lucide-react";

import { Card, CardHeader } from "../shared/ui/Card";
import { Button } from "../shared/ui/Button";
import { Badge } from "../shared/ui/Badge";
import { getLiveHealth, getReadyHealth } from "../shared/api/health";
import { ApiError } from "../shared/api/http";
import type {
  HealthLiveResponse,
  HealthReadyResponse
} from "../shared/types/api";

export function HealthPage() {
  const [live, setLive] = useState<HealthLiveResponse | null>(null);
  const [ready, setReady] = useState<HealthReadyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHealth() {
    setLoading(true);
    setError(null);

    try {
      const [liveResponse, readyResponse] = await Promise.all([
        getLiveHealth(),
        getReadyHealth()
      ]);

      setLive(liveResponse);
      setReady(readyResponse);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  const databaseOk = ready?.checks.database ?? false;
  const redisOk = ready?.checks.redis ?? false;
  const overallOk = ready?.status === "ok";

  return (
    <div className="page-grid">
      <Card>
        <CardHeader
          eyebrow="Health"
          title="Проверка сервисов"
          description="Эта страница показывает состояние live/ready endpoints, базы данных и Redis/Celery broker."
          action={
            <Button
              variant="secondary"
              onClick={loadHealth}
              disabled={loading}
              icon={loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            >
              Обновить
            </Button>
          }
        />

        <div className="card-body">
          {error && (
            <div className="error-box">
              <strong>Ошибка</strong>
              <pre>{error}</pre>
            </div>
          )}

          <div className="health-grid">
            <article className="health-card">
              <div className="health-icon">
                <Server size={22} />
              </div>

              <span>Live endpoint</span>
              <strong>{live?.status || "unknown"}</strong>

              <Badge tone={live?.status === "ok" ? "success" : "danger"}>
                {live?.status === "ok" ? "online" : "offline"}
              </Badge>
            </article>

            <article className="health-card">
              <div className="health-icon">
                <Activity size={22} />
              </div>

              <span>Ready endpoint</span>
              <strong>{ready?.status || "unknown"}</strong>

              <Badge tone={overallOk ? "success" : "warning"}>
                {overallOk ? "ready" : "degraded"}
              </Badge>
            </article>

            <article className="health-card">
              <div className="health-icon">
                <Database size={22} />
              </div>

              <span>Database</span>
              <strong>{databaseOk ? "OK" : "FAIL"}</strong>

              <Badge tone={databaseOk ? "success" : "danger"}>
                {databaseOk ? "connected" : "failed"}
              </Badge>
            </article>

            <article className="health-card">
              <div className="health-icon">
                <RadioTower size={22} />
              </div>

              <span>Redis / Celery</span>
              <strong>{redisOk ? "OK" : "FAIL"}</strong>

              <Badge tone={redisOk ? "success" : "danger"}>
                {redisOk ? "connected" : "failed"}
              </Badge>
            </article>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Raw response"
          title="Ответ backend"
          description="Сырые ответы endpoint-ов удобно использовать для диагностики проблем с readiness."
        />

        <div className="card-body">
          <div className="raw-grid">
            <div className="raw-block">
              <strong>GET /health/live</strong>
              <pre>{JSON.stringify(live, null, 2)}</pre>
            </div>

            <div className="raw-block">
              <strong>GET /health/ready</strong>
              <pre>{JSON.stringify(ready, null, 2)}</pre>
            </div>
          </div>
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